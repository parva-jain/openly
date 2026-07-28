// requireAuth: the single gate in front of every /api route.
//
// It reads `Authorization: Bearer <jwt>`, verifies it, and puts `req.userId` on
// the request. Business routes only ever read `req.userId` — never the token —
// so the whole auth mechanism could change (even to a managed provider) without
// touching those routes.

import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "./tokens.js";

// Augment Express's Request so `req.userId` is typed everywhere.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  try {
    req.userId = await verifyToken(header.slice("Bearer ".length));
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}
