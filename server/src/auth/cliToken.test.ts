import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { hashToken, isCliToken, CLI_TOKEN_PREFIX } from "./cliToken.js";

describe("cliToken pure helpers", () => {
  test("isCliToken recognises the prefix", () => {
    assert.equal(isCliToken(`${CLI_TOKEN_PREFIX}abc`), true);
    assert.equal(isCliToken("eyJhbGciOi.jwt.here"), false);
  });

  test("hashToken is stable sha256 hex", () => {
    const a = hashToken("openly_secret");
    const b = hashToken("openly_secret");
    assert.equal(a, b);
    assert.equal(a.length, 64);
    assert.notEqual(a, hashToken("openly_other"));
  });
});
