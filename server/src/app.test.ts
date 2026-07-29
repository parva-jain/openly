// Unit tests for the routes that DON'T touch Postgres (health, fuse, auth
// guard). We inject FAKE AI services and a stub DB, so these are fast and need
// no running Python service, no bound port, and no database. DB-backed routes
// (auth, jobs, worker) are covered in integration.test.ts against real Postgres.

import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp, type AiServices } from "./app.js";
import { AiServiceError } from "./aiService.js";
import type { Database } from "./db/client.js";
import { signToken } from "./auth/tokens.js";
import type { DraftResponse, FuseResponse } from "./types.js";

const fakeUsage = { model: "fake", input_tokens: 1, output_tokens: 1, cost_usd: 0 };

function makeServices(overrides: Partial<AiServices> = {}): AiServices {
  return {
    draft: async (req): Promise<DraftResponse> => ({
      variations: ["a", "b"],
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
    ...overrides,
  };
}

// Health & fuse never query the DB, so a stub is fine here.
const stubDb = {} as Database;

function makeApp(overrides: Partial<AiServices> = {}) {
  return createApp({ db: stubDb, ai: makeServices(overrides) });
}

const authHeader = async () => `Bearer ${await signToken("user-1")}`;

test("GET /health reports ok and AI reachability", async () => {
  const res = await request(makeApp()).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.aiReachable, true);
});

test("POST /api/fuse requires a bearer token", async () => {
  const res = await request(makeApp())
    .post("/api/fuse")
    .send({ content_type: "progress_update", variations: ["a", "b"] });
  assert.equal(res.status, 401);
});

test("POST /api/fuse requires non-empty variations", async () => {
  const res = await request(makeApp())
    .post("/api/fuse")
    .set("Authorization", await authHeader())
    .send({ content_type: "progress_update", variations: [] });
  assert.equal(res.status, 400);
});

test("POST /api/fuse returns the fused text", async () => {
  const res = await request(makeApp())
    .post("/api/fuse")
    .set("Authorization", await authHeader())
    .send({ content_type: "progress_update", variations: ["a", "b"] });
  assert.equal(res.status, 200);
  assert.equal(res.body.text, "fused");
});

test("POST /api/fuse maps AI service errors to their status", async () => {
  const res = await request(
    makeApp({
      fuse: async () => {
        throw new AiServiceError("AI down", 503);
      },
    }),
  )
    .post("/api/fuse")
    .set("Authorization", await authHeader())
    .send({ content_type: "progress_update", variations: ["a", "b"] });
  assert.equal(res.status, 503);
  assert.equal(res.body.error, "AI down");
});
