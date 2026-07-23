// Express app factory.
//
// We separate "create the app" from "start the server" (that's in index.ts).
// The app takes its AI-service dependencies as an argument (dependency
// injection) with the real ones as defaults. Tests pass fakes instead — so we
// can exercise every route WITHOUT a running Python service or a bound port.

import express, { type Request, type Response } from "express";
import * as realAi from "./aiService.js";
import { AiServiceError } from "./aiService.js";
import type { DraftRequest, FuseRequest } from "./types.js";

export interface AiServices {
  draft: typeof realAi.draft;
  fuse: typeof realAi.fuse;
  aiHealthy: typeof realAi.aiHealthy;
}

export function createApp(services: AiServices = realAi): express.Express {
  const app = express();
  app.use(express.json());

  app.get("/health", async (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "openly-backend",
      aiReachable: await services.aiHealthy(),
    });
  });

  app.post("/api/draft", async (req: Request, res: Response) => {
    const body = req.body as DraftRequest;
    if (!body?.content_type || !body?.intent) {
      res.status(400).json({ error: "content_type and intent are required" });
      return;
    }
    try {
      res.json(await services.draft(body));
    } catch (err) {
      handleAiError(err, res);
    }
  });

  app.post("/api/fuse", async (req: Request, res: Response) => {
    const body = req.body as FuseRequest;
    if (
      !body?.content_type ||
      !Array.isArray(body?.variations) ||
      body.variations.length === 0
    ) {
      res
        .status(400)
        .json({ error: "content_type and a non-empty variations[] are required" });
      return;
    }
    try {
      res.json(await services.fuse(body));
    } catch (err) {
      handleAiError(err, res);
    }
  });

  return app;
}

function handleAiError(err: unknown, res: Response): void {
  if (err instanceof AiServiceError) {
    res.status(err.status).json({ error: err.message, detail: err.detail });
    return;
  }
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "internal error" });
}
