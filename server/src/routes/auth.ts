// Public auth routes: register + login. Both return a JWT the client sends on
// subsequent /api requests. Passwords are argon2id-hashed; we never reveal
// which field was wrong on a failed login.

import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signToken } from "../auth/tokens.js";

export function authRouter(db: Database): Router {
  const router = Router();

  router.post("/register", async (req, res) => {
    const { email, password } = (req.body ?? {}) as {
      email?: unknown;
      password?: unknown;
    };
    if (
      typeof email !== "string" ||
      !email.includes("@") ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      res.status(400).json({ error: "valid email and password (min 8 chars) are required" });
      return;
    }

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "email already registered" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email });
    const token = await signToken(user.id);
    res.status(201).json({ token, user });
  });

  router.post("/login", async (req, res) => {
    const { email, password } = (req.body ?? {}) as {
      email?: unknown;
      password?: unknown;
    };
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      res.status(401).json({ error: "invalid credentials" });
      return;
    }
    const token = await signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email } });
  });

  return router;
}
