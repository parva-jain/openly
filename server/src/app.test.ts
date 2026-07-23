// Tests for the Express app. Uses Node's built-in test runner (node:test) and
// supertest for in-process HTTP. We inject FAKE AI services, so these tests
// never touch the Python service or the network — fast and deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp, type AiServices } from "./app.js";
import { AiServiceError } from "./aiService.js";
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

test("GET /health reports ok and AI reachability", async () => {
  const app = createApp(makeServices());
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.aiReachable, true);
});

test("POST /api/draft forwards and returns the slate", async () => {
  const app = createApp(makeServices());
  const res = await request(app)
    .post("/api/draft")
    .send({ content_type: "progress_update", intent: "x" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.variations, ["a", "b"]);
});

test("POST /api/draft rejects missing fields with 400", async () => {
  const app = createApp(makeServices());
  const res = await request(app).post("/api/draft").send({ intent: "x" });
  assert.equal(res.status, 400);
});

test("POST /api/draft maps AI service errors to their status", async () => {
  const app = createApp(
    makeServices({
      draft: async () => {
        throw new AiServiceError("AI down", 503);
      },
    }),
  );
  const res = await request(app)
    .post("/api/draft")
    .send({ content_type: "progress_update", intent: "x" });
  assert.equal(res.status, 503);
  assert.equal(res.body.error, "AI down");
});

test("POST /api/fuse requires non-empty variations", async () => {
  const app = createApp(makeServices());
  const res = await request(app)
    .post("/api/fuse")
    .send({ content_type: "progress_update", variations: [] });
  assert.equal(res.status, 400);
});

test("POST /api/fuse returns the fused text", async () => {
  const app = createApp(makeServices());
  const res = await request(app)
    .post("/api/fuse")
    .send({ content_type: "progress_update", variations: ["a", "b"] });
  assert.equal(res.status, 200);
  assert.equal(res.body.text, "fused");
});
