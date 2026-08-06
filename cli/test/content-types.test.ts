import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isContentType, isSessionAnchored } from "../src/content-types.js";

describe("content-types", () => {
  test("known type is recognised", () => {
    assert.equal(isContentType("progress_update"), true);
    assert.equal(isContentType("nonsense"), false);
  });
  test("progress_update is session-anchored, origin is not", () => {
    assert.equal(isSessionAnchored("progress_update"), true);
    assert.equal(isSessionAnchored("origin_narrative"), false);
  });
});
