import { api, ApiError } from "../http.js";
import { readConfig, writeConfig } from "../config.js";

export async function logoutCommand(): Promise<void> {
  const cfg = readConfig();
  if (cfg.token) {
    try {
      await api(cfg.url, "/api/cli/token", { method: "DELETE", token: cfg.token });
    } catch (err) {
      // Already-invalid tokens are fine to "log out" locally.
      if (!(err instanceof ApiError)) throw err;
    }
  }
  writeConfig({ url: cfg.url });
  console.log("✓ logged out");
}
