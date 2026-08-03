import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import request from "supertest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createApp, type AiServices } from "../app.js";
import { createDb } from "../db/client.js";
import type { DraftResponse, FuseResponse } from "../types.js";

const usage = { model: "fake", input_tokens: 1, output_tokens: 1, cost_usd: 0 };
const ai: AiServices = {
  draft: async (req): Promise<DraftResponse> => ({
    variations: ["a"],
    content_type: req.content_type,
    needs_verification: false,
    sources: [],
    usage,
  }),
  fuse: async (req): Promise<FuseResponse> => ({
    text: "x",
    content_type: req.content_type,
    usage,
  }),
  aiHealthy: async () => true,
};

describe(
  "CLI auth flows (real Postgres)",
  { skip: process.env.DATABASE_URL ? false : "DATABASE_URL not set" },
  () => {
    const conn = createDb(process.env.DATABASE_URL);
    const app = createApp({ db: conn.db, ai });
    const b64url = (buf: Buffer): string => buf.toString("base64url");

    before(async () => {
      await migrate(conn.db, { migrationsFolder: "./drizzle" });
    });
    beforeEach(async () => {
      await conn.db.execute(
        sql`truncate table cli_tokens, drafts, jobs, users restart identity cascade`,
      );
    });
    after(async () => {
      await conn.pool.end();
    });

    async function register(email: string): Promise<void> {
      const res = await request(app)
        .post("/auth/register")
        .send({ email, password: "password123" });
      assert.equal(res.status, 201, JSON.stringify(res.body));
    }

    test("loopback: login -> code -> exchange mints a usable CLI token", async () => {
      await register("loop@x.com");
      const verifier = b64url(randomBytes(32));
      const challenge = b64url(createHash("sha256").update(verifier).digest());

      // POST the login form; it 302-redirects to the loopback callback with a code.
      const login = await request(app).post("/cli-auth").type("form").send({
        port: "5555",
        state: "st",
        code_challenge: challenge,
        email: "loop@x.com",
        password: "password123",
      });
      assert.equal(login.status, 302);
      const loc = new URL(login.headers.location);
      assert.equal(loc.hostname, "127.0.0.1");
      const code = loc.searchParams.get("code")!;
      assert.ok(code);
      assert.equal(loc.searchParams.get("state"), "st");

      const ex = await request(app)
        .post("/auth/cli/exchange")
        .send({ code, code_verifier: verifier });
      assert.equal(ex.status, 200);
      assert.ok(ex.body.token.startsWith("openly_"));

      // The token authenticates an /api/jobs request.
      const job = await request(app)
        .post("/api/jobs")
        .set("Authorization", `Bearer ${ex.body.token}`)
        .send({ content_type: "progress_update", intent: "via cli token" });
      assert.equal(job.status, 201);
    });

    test("exchange rejects a wrong PKCE verifier", async () => {
      await register("pkce@x.com");
      const challenge = b64url(createHash("sha256").update("right").digest());
      const login = await request(app).post("/cli-auth").type("form").send({
        port: "1",
        state: "s",
        code_challenge: challenge,
        email: "pkce@x.com",
        password: "password123",
      });
      const code = new URL(login.headers.location).searchParams.get("code")!;
      const ex = await request(app)
        .post("/auth/cli/exchange")
        .send({ code, code_verifier: "wrong" });
      assert.equal(ex.status, 400);
    });

    test("exchange code is single-use", async () => {
      await register("once@x.com");
      const verifier = b64url(randomBytes(32));
      const challenge = b64url(createHash("sha256").update(verifier).digest());
      const login = await request(app).post("/cli-auth").type("form").send({
        port: "1",
        state: "s",
        code_challenge: challenge,
        email: "once@x.com",
        password: "password123",
      });
      const code = new URL(login.headers.location).searchParams.get("code")!;
      await request(app).post("/auth/cli/exchange").send({ code, code_verifier: verifier });
      const second = await request(app)
        .post("/auth/cli/exchange")
        .send({ code, code_verifier: verifier });
      assert.equal(second.status, 400);
    });

    test("device: start -> pending -> activate -> token", async () => {
      await register("dev@x.com");
      const start = await request(app).post("/auth/cli/device/start");
      assert.equal(start.status, 200);
      const { device_code, user_code } = start.body;

      const pending = await request(app)
        .post("/auth/cli/device/token")
        .send({ device_code });
      assert.equal(pending.body.status, "authorization_pending");

      const activate = await request(app)
        .post("/activate")
        .type("form")
        .send({ email: "dev@x.com", password: "password123", user_code });
      assert.equal(activate.status, 200);

      const got = await request(app)
        .post("/auth/cli/device/token")
        .send({ device_code });
      assert.ok(got.body.token.startsWith("openly_"));
    });

    test("logout revokes the CLI token", async () => {
      await register("out@x.com");
      const verifier = b64url(randomBytes(32));
      const challenge = b64url(createHash("sha256").update(verifier).digest());
      const login = await request(app).post("/cli-auth").type("form").send({
        port: "1",
        state: "s",
        code_challenge: challenge,
        email: "out@x.com",
        password: "password123",
      });
      const code = new URL(login.headers.location).searchParams.get("code")!;
      const ex = await request(app)
        .post("/auth/cli/exchange")
        .send({ code, code_verifier: verifier });
      const token = ex.body.token as string;

      const del = await request(app)
        .delete("/api/cli/token")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(del.status, 204);

      const after = await request(app)
        .get("/api/jobs")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(after.status, 401);
    });
  },
);
