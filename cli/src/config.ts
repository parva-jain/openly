// Local CLI state: ~/.openly/config.json (mode 0600). Directory is overridable
// via OPENLY_HOME so tests don't touch the real home dir.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_URL = "http://localhost:3000";

export interface Config {
  url: string;
  token?: string;
  expiresAt?: string;
}

function configDir(): string {
  return process.env.OPENLY_HOME ?? join(homedir(), ".openly");
}
export function configPath(): string {
  return join(configDir(), "config.json");
}

export function readConfig(): Config {
  const path = configPath();
  if (!existsSync(path)) return { url: DEFAULT_URL };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Config>;
    return { url: parsed.url ?? DEFAULT_URL, token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return { url: DEFAULT_URL };
  }
}

export function writeConfig(config: Config): void {
  mkdirSync(configDir(), { recursive: true });
  const path = configPath();
  writeFileSync(path, JSON.stringify(config, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600); // ensure 0600 even if the file pre-existed
}

export function resolveUrl(flagUrl?: string): string {
  return flagUrl ?? process.env.OPENLY_URL ?? readConfig().url ?? DEFAULT_URL;
}
