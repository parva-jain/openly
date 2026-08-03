// Capture a window of the current Claude Code session and sanitize it before
// anything leaves the machine (CLAUDE.md §4: privacy is load-bearing). Plain
// file reading — not an AI step. Port of openly/capture.py.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9\-_]+/g, // Anthropic keys
  /tvly-[A-Za-z0-9\-_]+/g, // Tavily keys
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI-style keys
  /ghp_[A-Za-z0-9]{20,}/g, // GitHub tokens
  /(api[_-]?key|secret|token|password)\s*[=:]\s*\S+/gi,
];

export function sanitize(text: string): string {
  return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, "[REDACTED]"), text);
}

function encodedProjectDir(cwd: string): string {
  return cwd.replaceAll("/", "-");
}

export function findLatestTranscript(cwd: string = process.cwd()): string | null {
  const dir = join(homedir(), ".claude", "projects", encodedProjectDir(cwd));
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => join(dir, f));
  if (files.length === 0) return null;
  files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0];
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text") parts.push(String(b.text ?? ""));
    else if (b.type === "tool_use") parts.push(`[called tool: ${String(b.name ?? "?")}]`);
    else if (b.type === "tool_result") parts.push("[tool result]");
  }
  return parts.filter(Boolean).join("\n");
}

export function readSessionWindow(transcriptPath: string, maxMessages = 30): string {
  const messages: string[] = [];
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    const msg = obj.message;
    if (typeof msg !== "object" || msg === null) continue;
    const m = msg as Record<string, unknown>;
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = extractText(m.content).trim();
    if (text) messages.push(`${(m.role as string).toUpperCase()}: ${text}`);
  }
  return sanitize(messages.slice(-maxMessages).join("\n\n"));
}

export function captureWindow(maxMessages = 30, cwd: string = process.cwd()): string | null {
  const transcript = findLatestTranscript(cwd);
  return transcript ? readSessionWindow(transcript, maxMessages) : null;
}
