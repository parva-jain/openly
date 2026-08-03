// Opaque, revocable CLI tokens (M5). Unlike the web JWT, these are random
// high-entropy strings stored only as a sha256 hash, with a sliding 30-day
// expiry. sha256 (not argon2) is correct here: a 256-bit random token has no
// brute-force surface, so we want a fast, indexable hash for lookup.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { cliTokens } from "../db/schema.js";

export const CLI_TOKEN_PREFIX = "openly_";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding

export function isCliToken(token: string): boolean {
  return token.startsWith(CLI_TOKEN_PREFIX);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function mintCliToken(
  db: Database,
  userId: string,
  label?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = CLI_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db
    .insert(cliTokens)
    .values({ userId, tokenHash: hashToken(token), label: label ?? null, expiresAt });
  return { token, expiresAt };
}

/** Verify a CLI token; return its userId. Slides expiry + last_used. Throws if
 *  the token is unknown or expired. */
export async function verifyCliToken(db: Database, token: string): Promise<string> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(cliTokens)
    .where(and(eq(cliTokens.tokenHash, hashToken(token)), gt(cliTokens.expiresAt, now)))
    .limit(1);
  if (!row) throw new Error("invalid or expired cli token");
  await db
    .update(cliTokens)
    .set({ lastUsedAt: now, expiresAt: new Date(Date.now() + TTL_MS) })
    .where(eq(cliTokens.id, row.id));
  return row.userId;
}

export async function revokeCliToken(db: Database, token: string): Promise<void> {
  await db.delete(cliTokens).where(eq(cliTokens.tokenHash, hashToken(token)));
}
