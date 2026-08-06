import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readSessionWindow, sanitize } from "../src/capture.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("capture", () => {
  test("sanitize redacts known secret shapes", () => {
    assert.match(sanitize("token=sk-ant-abcdef123456"), /\[REDACTED\]/);
    assert.doesNotMatch(sanitize("token=sk-ant-abcdef123456"), /sk-ant/);
  });

  test("reads user/assistant turns, formats blocks, and redacts secrets", () => {
    const w = readSessionWindow(join(fixtures, "session.jsonl"), 30);
    assert.match(w, /USER: hello there/);
    assert.match(w, /ASSISTANT: hi\n\[called tool: Bash\]/);
    assert.match(w, /\[REDACTED\]/);
    assert.doesNotMatch(w, /sk-ant-abcdef/);
  });

  test("maxMessages keeps only the last N turns", () => {
    const w = readSessionWindow(join(fixtures, "session.jsonl"), 1);
    assert.match(w, /REDACTED/); // last message is the user secret line
    assert.doesNotMatch(w, /hello there/);
  });
});
