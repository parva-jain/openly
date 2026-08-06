import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configPath, readConfig, resolveUrl, writeConfig } from "../src/config.js";

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "openly-"));
  process.env.OPENLY_HOME = home;
  delete process.env.OPENLY_URL;
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  delete process.env.OPENLY_HOME;
});

describe("config", () => {
  test("read on a fresh machine returns the default url, no token", () => {
    const c = readConfig();
    assert.equal(c.url, "http://localhost:3000");
    assert.equal(c.token, undefined);
  });

  test("write then read round-trips and file is 0600", () => {
    writeConfig({ url: "http://localhost:3000", token: "openly_abc", expiresAt: "2026-09-01" });
    const c = readConfig();
    assert.equal(c.token, "openly_abc");
    const mode = statSync(configPath()).mode & 0o777;
    assert.equal(mode, 0o600);
  });

  test("resolveUrl precedence: flag > env > config > default", () => {
    writeConfig({ url: "http://from-config" });
    assert.equal(resolveUrl("http://from-flag"), "http://from-flag");
    process.env.OPENLY_URL = "http://from-env";
    assert.equal(resolveUrl(), "http://from-env");
    delete process.env.OPENLY_URL;
    assert.equal(resolveUrl(), "http://from-config");
  });
});
