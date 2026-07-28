// Password hashing with argon2id (via @node-rs/argon2 — prebuilt binaries, so
// no native build toolchain is needed in Docker). We NEVER store plain
// passwords; only the hash goes in the DB.

import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain);
}
