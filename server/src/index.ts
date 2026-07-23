// Openly product backend (Node/TS) — M2.
//
// The smallest useful version: expose our own endpoints and fulfill them by
// calling the Python AI service over HTTP. No DB, no auth yet (M4). This proves
// the polyglot boundary: Node owns the product surface, Python does the AI.

import express, { type Request, type Response } from "express";
import { config } from "./config.js";
import { AiServiceError, aiHealthy, draft, fuse } from "./aiService.js";
import type { DraftRequest, FuseRequest } from "./types.js";

const app = express();
app.use(express.json());

// Our own liveness — plus whether the AI service behind us is reachable.
app.get("/health", async (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "openly-backend", aiReachable: await aiHealthy() });
});

// Forward a draft request to Python and return the variation slate.
// (Later this will create a queued job tied to a user; for M2 it's a passthrough.)
app.post("/api/draft", async (req: Request, res: Response) => {
  const body = req.body as DraftRequest;
  if (!body?.content_type || !body?.intent) {
    res.status(400).json({ error: "content_type and intent are required" });
    return;
  }
  try {
    res.json(await draft(body));
  } catch (err) {
    handleAiError(err, res);
  }
});

// Forward a fuse request to Python.
app.post("/api/fuse", async (req: Request, res: Response) => {
  const body = req.body as FuseRequest;
  if (!body?.content_type || !Array.isArray(body?.variations) || body.variations.length === 0) {
    res.status(400).json({ error: "content_type and a non-empty variations[] are required" });
    return;
  }
  try {
    res.json(await fuse(body));
  } catch (err) {
    handleAiError(err, res);
  }
});

function handleAiError(err: unknown, res: Response): void {
  if (err instanceof AiServiceError) {
    // Surface the AI service's status, but keep the shape our clients expect.
    res.status(err.status).json({ error: err.message, detail: err.detail });
    return;
  }
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "internal error" });
}

app.listen(config.port, () => {
  console.log(`openly-backend listening on http://localhost:${config.port}`);
  console.log(`  -> AI service: ${config.pythonServiceUrl}`);
});
