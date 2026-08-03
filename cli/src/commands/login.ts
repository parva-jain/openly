import { resolveUrl, writeConfig } from "../config.js";
import { loopbackLogin } from "../auth/loopback.js";
import { deviceLogin } from "../auth/device.js";

export async function loginCommand(opts: { url?: string; device?: boolean }): Promise<void> {
  const url = resolveUrl(opts.url);
  const token = opts.device ? await deviceLogin(url) : await loopbackLogin(url);
  writeConfig({ url, token: token.token, expiresAt: token.expires_at });
  console.log("✓ logged in");
}
