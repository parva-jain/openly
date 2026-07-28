// JWT signing/verifying with `jose` (ESM-native, zero-dep).
//
// The token is stateless: it carries the user id in `sub`, signed with
// JWT_SECRET. We verify the signature + expiry on each request — no DB lookup.
// Short-lived (1h); refresh tokens are deliberately deferred (see M4 spec).

import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

const ALG = "HS256";
const secret = new TextEncoder().encode(config.jwtSecret);

export function signToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

/** Verify a token and return the user id (`sub`). Throws if invalid/expired. */
export async function verifyToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
  if (!payload.sub) throw new Error("token missing subject");
  return payload.sub;
}
