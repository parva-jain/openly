"""Capture — snapshot a window of the current coding session.

This is NOT an AI step (CLAUDE.md §4/§5: "Capture is event hooks, not AI").
It's plain file reading + sanitising. Claude Code writes each session as a
JSONL transcript under:

    ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl

where <encoded-cwd> is the working directory with "/" replaced by "-".

For the manual trigger we use a simple heuristic: the *most recently modified*
transcript in this project's folder is "the current session". (The precise,
hook-supplied session_id arrives when we turn this into a real skill/hook in a
later stage — see §6.) We then take the last N messages as the moment window.

Privacy is load-bearing (§4): we redact obvious secrets before the text is
ever stored or sent to a model.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


def _encoded_project_dir(cwd: Path) -> str:
    """Turn /Users/parv/Desktop/openly into -Users-parv-Desktop-openly."""
    return str(cwd).replace("/", "-")


def find_latest_transcript(cwd: Path | None = None) -> Path | None:
    """Return the most recently modified transcript for this project, if any."""
    cwd = cwd or Path.cwd()
    project_dir = Path.home() / ".claude" / "projects" / _encoded_project_dir(cwd)
    if not project_dir.is_dir():
        return None
    transcripts = sorted(
        project_dir.glob("*.jsonl"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return transcripts[0] if transcripts else None


# --- Sanitising --------------------------------------------------------------
# Redact things that must never leak into a public draft. This is deliberately
# conservative; better to over-redact than to leak a key.
_SECRET_PATTERNS = [
    re.compile(r"sk-ant-[A-Za-z0-9\-_]+"),          # Anthropic keys
    re.compile(r"tvly-[A-Za-z0-9\-_]+"),            # Tavily keys
    re.compile(r"sk-[A-Za-z0-9]{20,}"),             # OpenAI-style keys
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),            # GitHub tokens
    re.compile(r"(?i)(api[_-]?key|secret|token|password)\s*[=:]\s*\S+"),
]


def sanitize(text: str) -> str:
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


def _extract_text(content) -> str:
    """Pull readable text out of a message's content (string or block list)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "text":
                parts.append(block.get("text", ""))
            elif btype == "tool_use":
                parts.append(f"[called tool: {block.get('name', '?')}]")
            elif btype == "tool_result":
                parts.append("[tool result]")
        return "\n".join(p for p in parts if p)
    return ""


def read_session_window(transcript_path: Path, max_messages: int = 30) -> str:
    """Read the last `max_messages` user/assistant turns as a text window."""
    lines = transcript_path.read_text(errors="ignore").splitlines()

    messages: list[str] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = obj.get("message")
        if not isinstance(msg, dict):
            continue
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue
        text = _extract_text(msg.get("content")).strip()
        if text:
            messages.append(f"{role.upper()}: {text}")

    window = messages[-max_messages:]
    return sanitize("\n\n".join(window))


def capture_window(max_messages: int = 30, cwd: Path | None = None) -> str | None:
    """Find the current transcript and return a sanitised recent window."""
    transcript = find_latest_transcript(cwd)
    if transcript is None:
        return None
    return read_session_window(transcript, max_messages=max_messages)
