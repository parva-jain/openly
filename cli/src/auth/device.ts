// Device-code login (SSH/headless fallback). Prints a code + URL, then polls
// until the user approves it in a browser.
import { api } from "../http.js";
import { openBrowser } from "../util/browser.js";
import type { DeviceStartResponse, DevicePending, TokenResponse } from "../contract.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function deviceLogin(baseUrl: string): Promise<TokenResponse> {
  const start = await api<DeviceStartResponse>(baseUrl, "/auth/cli/device/start", {
    method: "POST",
  });
  const url = `${baseUrl}${start.verification_uri}`;
  console.log(`\nTo authorize, open:\n  ${url}\nand enter code: ${start.user_code}\n`);
  openBrowser(url);

  let intervalMs = start.interval * 1000;
  const deadline = Date.now() + start.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const res = await api<TokenResponse | DevicePending>(baseUrl, "/auth/cli/device/token", {
      method: "POST",
      body: { device_code: start.device_code },
    });
    if ("token" in res) return res;
    if (res.status === "slow_down") intervalMs += 2000;
  }
  throw new Error("device login timed out — run `openly login` again");
}
