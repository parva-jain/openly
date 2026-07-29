// Express app factory.
//
// We separate "create the app" from "start the server" (that's in index.ts).
// The app takes its dependencies as an argument (dependency injection): a
// Database, plus the AI-service functions (with the real ones as defaults).
// Tests pass a real test Postgres and/or fake AI services — so routes can be
// exercised without a running Python service or a bound port.

import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import * as realAi from "./aiService.js";
import { AiServiceError } from "./aiService.js";
import type { Database } from "./db/client.js";
import { requireAuth } from "./auth/middleware.js";
import { authRouter } from "./routes/auth.js";
import { jobsRouter } from "./routes/jobs.js";
import type { FuseRequest } from "./types.js";

export interface AiServices {
  draft: typeof realAi.draft;
  fuse: typeof realAi.fuse;
  aiHealthy: typeof realAi.aiHealthy;
}

export interface AppDeps {
  db: Database;
  ai?: AiServices;
}

export function createApp(deps: AppDeps): express.Express {
  const ai = deps.ai ?? realAi;
  const app = express();
  app.use(express.json());

  app.get("/health", async (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "openly-backend",
      aiReachable: await ai.aiHealthy(),
    });
  });

  app.use("/auth", authRouter(deps.db));
  app.use("/api/jobs", jobsRouter(deps.db));

  // Fuse stays synchronous (interactive dashboard action on a slate the user is
  // already looking at), now behind auth.
  app.post("/api/fuse", requireAuth, async (req: Request, res: Response) => {
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
    res.json(await ai.fuse(body));
  });

  app.use(errorHandler);
  return app;
}

// Central error handler. Express 5 forwards rejected async handlers here, so
// routes can just throw. AI-service errors keep their upstream status.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AiServiceError) {
    res.status(err.status).json({ error: err.message, detail: err.detail });
    return;
  }
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "internal error" });
};
