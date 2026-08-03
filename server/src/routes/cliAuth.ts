// The CLI authentication flows (M5).
//
//   Loopback (default):
//     GET  /cli-auth            -> login form (carries port/state/code_challenge)
//     POST /cli-auth            -> verify creds, mint one-time code, 302 to
//                                  http://127.0.0.1:<port>/callback?code&state
//     POST /auth/cli/exchange   -> code + code_verifier (PKCE) -> CLI token
//
//   Device (SSH/headless fallback):
//     POST /auth/cli/device/start -> device_code, user_code, verification_uri
//     POST /auth/cli/device/token -> device_code -> pending | CLI token
//     GET/POST /activate          -> login + enter user_code -> approve
import { createHash, randomBytes, randomInt } from "node:crypto";
import { Router, urlencoded } from "express";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { users } from "../db/schema.js";
import { verifyPassword } from "../auth/password.js";
import { mintCliToken } from "../auth/cliToken.js";
import { EphemeralStore } from "../auth/ephemeralCodes.js";
import { activatePage, loopbackLoginPage, successPage } from "../auth/cliAuthPages.js";

interface AuthCode {
  userId: string;
  codeChallenge: string;
}
interface DeviceReq {
  userCode: string;
  approvedUserId: string | null;
}

const CODE_TTL = 60_000; // one-time loopback code
const DEVICE_TTL = 600_000; // device request

function base64url(b: Buffer): string {
  return b.toString("base64url");
}
function makeUserCode(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const pick = (): string =>
    Array.from({ length: 4 }, () => A[randomInt(A.length)]).join("");
  return `${pick()}-${pick()}`;
}

async function findUser(db: Database, email: unknown, password: unknown) {
  if (typeof email !== "string" || typeof password !== "string") return null;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    return null;
  }
  return user;
}

export function cliAuthRouter(db: Database): Router {
  const router = Router();
  const form = urlencoded({ extended: false });

  const authCodes = new EphemeralStore<AuthCode>();
  const deviceByCode = new EphemeralStore<DeviceReq>(); // keyed by device_code
  const deviceByUserCode = new EphemeralStore<string>(); // user_code -> device_code

  // ---- Loopback ------------------------------------------------------------
  router.get("/cli-auth", (req, res) => {
    res.type("html").send(
      loopbackLoginPage({
        port: String(req.query.port ?? ""),
        state: String(req.query.state ?? ""),
        codeChallenge: String(req.query.code_challenge ?? ""),
      }),
    );
  });

  router.post("/cli-auth", form, async (req, res) => {
    const { port, state, code_challenge, email, password } = req.body ?? {};
    const user = await findUser(db, email, password);
    if (!user) {
      res
        .status(401)
        .type("html")
        .send(
          loopbackLoginPage({
            port: String(port ?? ""),
            state: String(state ?? ""),
            codeChallenge: String(code_challenge ?? ""),
            error: "invalid credentials",
          }),
        );
      return;
    }
    const code = base64url(randomBytes(24));
    authCodes.set(code, { userId: user.id, codeChallenge: String(code_challenge) }, CODE_TTL);
    const redirect = `http://127.0.0.1:${encodeURIComponent(String(port))}/callback?code=${code}&state=${encodeURIComponent(String(state))}`;
    res.redirect(302, redirect);
  });

  router.post("/auth/cli/exchange", async (req, res) => {
    const { code, code_verifier } = (req.body ?? {}) as {
      code?: unknown;
      code_verifier?: unknown;
    };
    if (typeof code !== "string" || typeof code_verifier !== "string") {
      res.status(400).json({ error: "code and code_verifier are required" });
      return;
    }
    const entry = authCodes.take(code); // single-use
    if (!entry) {
      res.status(400).json({ error: "invalid or expired code" });
      return;
    }
    const challenge = base64url(createHash("sha256").update(code_verifier).digest());
    if (challenge !== entry.codeChallenge) {
      res.status(400).json({ error: "PKCE verification failed" });
      return;
    }
    const { token, expiresAt } = await mintCliToken(db, entry.userId, "openly cli");
    res.json({ token, expires_at: expiresAt.toISOString() });
  });

  // ---- Device flow ---------------------------------------------------------
  router.post("/auth/cli/device/start", (_req, res) => {
    const deviceCode = base64url(randomBytes(24));
    const userCode = makeUserCode();
    deviceByCode.set(deviceCode, { userCode, approvedUserId: null }, DEVICE_TTL);
    deviceByUserCode.set(userCode, deviceCode, DEVICE_TTL);
    res.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: "/activate",
      interval: 5,
      expires_in: 600,
    });
  });

  router.post("/auth/cli/device/token", async (req, res) => {
    const { device_code } = (req.body ?? {}) as { device_code?: unknown };
    if (typeof device_code !== "string") {
      res.status(400).json({ error: "device_code is required" });
      return;
    }
    const entry = deviceByCode.get(device_code);
    if (!entry) {
      res.status(400).json({ error: "expired_token" });
      return;
    }
    if (!entry.approvedUserId) {
      res.json({ status: "authorization_pending" });
      return;
    }
    deviceByCode.take(device_code); // consume
    const { token, expiresAt } = await mintCliToken(
      db,
      entry.approvedUserId,
      "openly cli (device)",
    );
    res.json({ token, expires_at: expiresAt.toISOString() });
  });

  router.get("/activate", (req, res) => {
    res.type("html").send(
      activatePage({
        userCode: req.query.user_code ? String(req.query.user_code) : undefined,
      }),
    );
  });

  router.post("/activate", form, async (req, res) => {
    const { email, password, user_code } = req.body ?? {};
    const user = await findUser(db, email, password);
    const deviceCode =
      typeof user_code === "string" ? deviceByUserCode.get(user_code) : undefined;
    const entry = deviceCode ? deviceByCode.get(deviceCode) : undefined;
    if (!user || !entry) {
      res
        .status(user ? 400 : 401)
        .type("html")
        .send(
          activatePage({
            userCode: typeof user_code === "string" ? user_code : undefined,
            error: user ? "unknown or expired code" : "invalid credentials",
          }),
        );
      return;
    }
    deviceByCode.update(deviceCode!, { ...entry, approvedUserId: user.id });
    res.type("html").send(successPage());
  });

  return router;
}
