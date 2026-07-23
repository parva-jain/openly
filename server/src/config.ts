// Central config, read from the environment.
// Node 24 can load a .env file natively (no dotenv dependency needed).
import { existsSync } from "node:fs";

// Load .env if present (won't override real env vars already set).
if (existsSync(new URL("../.env", import.meta.url))) {
  process.loadEnvFile(new URL("../.env", import.meta.url));
}

export const config = {
  // Where the stateless Python AI service lives. Env-driven so the same code
  // works locally, in Docker (M3), and in the cloud (M9) with no edits.
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000",
  port: Number(process.env.PORT ?? 3000),
};
