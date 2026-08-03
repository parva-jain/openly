import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { EphemeralStore } from "./ephemeralCodes.js";

describe("EphemeralStore", () => {
  test("get returns a stored value before expiry", () => {
    const s = new EphemeralStore<number>();
    s.set("k", 42, 1000);
    assert.equal(s.get("k"), 42);
  });

  test("take removes the value (single-use)", () => {
    const s = new EphemeralStore<number>();
    s.set("k", 42, 1000);
    assert.equal(s.take("k"), 42);
    assert.equal(s.get("k"), undefined);
  });

  test("expired entries are gone", () => {
    const s = new EphemeralStore<number>();
    s.set("k", 42, -1); // already expired
    assert.equal(s.get("k"), undefined);
  });
});
