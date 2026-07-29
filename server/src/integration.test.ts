// Integration tests against a REAL Postgres (M4's correctness hinges on real
// FK/unique constraints + SKIP LOCKED, which an in-memory fake can't reproduce).
//
// Gated on DATABASE_URL: with it set (CI's postgres service, or `docker compose
// up db` locally) these run; without it they're skipped, so `npm test` still
// passes on a machine with no database. CI applies migrations before running.

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createApp, type AiServices } from "./app.js";
import { createDb } from "./db/client.js";
import { processNextJob } from "./worker.js";
import type { DraftResponse, FuseResponse } from "./types.js";

const fakeUsage = { model: "fake", input_tokens: 1, output_tokens: 1, cost_usd: 0 };
const ai: AiServices = {
  draft: async (req): Promise<DraftResponse> => ({
    variations: ["draft-a", "draft-b", "draft-c"],
    content_type: req.content_type,
    needs_verification: false,
    sources: [],
    usage: fakeUsage,
  }),
  fuse: async (req): Promise<FuseResponse> => ({
    text: "fused",
    content_type: req.content_type,
    usage: fakeUsage,
  }),
  aiHealthy: async () => true,
};

describe(
  "integration (real Postgres)",
  { skip: process.env.DATABASE_URL ? false : "DATABASE_URL not set" },
  () => {
    const conn = createDb(process.env.DATABASE_URL);
    const { db } = conn;
    const app = createApp({ db, ai });

    before(async () => {
      await migrate(db, { migrationsFolder: "./drizzle" });
    });
    beforeEach(async () => {
      await db.execute(sql`truncate table drafts, jobs, users restart identity cascade`);
    });
    after(async () => {
      await conn.pool.end();
    });

    async function register(email: string): Promise<string> {
      const res = await request(app)
        .post("/auth/register")
        .send({ email, password: "password123" });
      assert.equal(
        res.status,
        201,
        `register ${email} failed: ${JSON.stringify(res.body)}`,
      );
      return res.body.token as string;
    }

    const bearer = (token: string): [string, string] => [
      "Authorization",
      `Bearer ${token}`,
    ];

    test("register then login returns a token", async () => {
      await register("login@x.com");
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "login@x.com", password: "password123" });
      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, "login@x.com");
    });

    test("duplicate email is rejected with 409", async () => {
      await register("dup@x.com");
      const res = await request(app)
        .post("/auth/register")
        .send({ email: "dup@x.com", password: "password123" });
      assert.equal(res.status, 409);
    });

    test("wrong password is rejected with 401", async () => {
      await register("pw@x.com");
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "pw@x.com", password: "wrongwrong" });
      assert.equal(res.status, 401);
    });

    test("job flow: enqueue -> worker drafts -> fetch slate", async () => {
      const token = await register("flow@x.com");
      const create = await request(app)
        .post("/api/jobs")
        .set(...bearer(token))
        .send({ content_type: "progress_update", intent: "shipped M4" });
      assert.equal(create.status, 201);
      const jobId = create.body.jobId as string;
      assert.equal(create.body.status, "pending");

      // Run the worker once — it should claim and draft exactly this job.
      const processed = await processNextJob({ db, ai });
      assert.equal(processed, jobId);

      const get = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set(...bearer(token));
      assert.equal(get.status, 200);
      assert.equal(get.body.job.status, "drafted");
      assert.deepEqual(get.body.draft.variations, ["draft-a", "draft-b", "draft-c"]);
    });

    test("worker records failure as error status", async () => {
      const token = await register("fail@x.com");
      const create = await request(app)
        .post("/api/jobs")
        .set(...bearer(token))
        .send({ content_type: "progress_update", intent: "boom" });
      const jobId = create.body.jobId as string;

      const failingAi: AiServices = {
        ...ai,
        draft: async () => {
          throw new Error("python exploded");
        },
      };
      await processNextJob({ db, ai: failingAi });

      const get = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set(...bearer(token));
      assert.equal(get.body.job.status, "error");
      assert.equal(get.body.job.error, "python exploded");
    });

    test("empty queue: worker returns null", async () => {
      assert.equal(await processNextJob({ db, ai }), null);
    });

    test("requests without a token are 401", async () => {
      const res = await request(app).get("/api/jobs");
      assert.equal(res.status, 401);
    });

    // The M4 "done" bar: two users have fully private queues.
    test("tenancy: a user cannot see another user's jobs", async () => {
      const tokenA = await register("a@x.com");
      const tokenB = await register("b@x.com");

      const create = await request(app)
        .post("/api/jobs")
        .set(...bearer(tokenA))
        .send({ content_type: "progress_update", intent: "A's private work" });
      const jobId = create.body.jobId as string;

      // B's list is empty...
      const listB = await request(app)
        .get("/api/jobs")
        .set(...bearer(tokenB));
      assert.equal(listB.status, 200);
      assert.equal(listB.body.jobs.length, 0);

      // ...and B cannot fetch A's job by id (404, not 403 — don't leak existence).
      const getB = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set(...bearer(tokenB));
      assert.equal(getB.status, 404);

      // A still sees their own.
      const listA = await request(app)
        .get("/api/jobs")
        .set(...bearer(tokenA));
      assert.equal(listA.body.jobs.length, 1);
    });
  },
);
