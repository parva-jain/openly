// requireAuth: the single gate in front of every /api route.
//
// It reads `Authorization: Bearer <token>`, verifies it, and puts `req.userId`
// on the request. It accepts either the web JWT or an opaque CLI token
// (openly_..., M5). Business routes only ever read `req.userId` — never the
// token — so the whole auth mechanism could change without touching them.

import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Database } from "../db/client.js";
import { verifyToken } from "./tokens.js";
import { isCliToken, verifyCliToken } from "./cliToken.js";

// Augment Express's Request so `req.userId` is typed everywhere.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// A factory so the middleware can reach the DB (needed to look up CLI tokens).
export function requireAuth(db: Database): RequestHandler {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "missing bearer token" });
      return;
    }
    const token = header.slice("Bearer ".length);
    try {
      req.userId = isCliToken(token)
        ? await verifyCliToken(db, token)
        : await verifyToken(token);
      next();
    } catch {
      res.status(401).json({ error: "invalid or expired token" });
    }
  };
}
