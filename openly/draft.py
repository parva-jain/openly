"""The `draft` call — Stage 0's deliverable.

Hand it a content type + a one-line intent (+ optional context) and it
returns a usable first draft for X, plus the token/cost usage.

This is a single, plain API call. No agents, no tools, no memory yet —
those are later stages. Keeping it this simple is intentional (CLAUDE.md §4:
"simplest thing that works first").
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from anthropic import Anthropic
from dotenv import load_dotenv

from openly.content_types import ContentType, spec_for
from openly.cost import Usage
from openly.prompts import build_system_prompt, build_user_prompt

# Load .env into the environment as soon as this module is imported, so the
# Anthropic client finds ANTHROPIC_API_KEY. `.env` is gitignored.
load_dotenv()

DEFAULT_MODEL = "claude-sonnet-4-6"  # best quality-per-cost for writing
MAX_TOKENS = 1024  # a cap on output length (also a cost ceiling per call)

# Shown when a content type needs research but we can't do it yet (Stage 1).
_UNVERIFIED_BANNER = (
    "⚠️  UNVERIFIED — this type ('{label}') needs web research, which isn't "
    "wired up until Stage 1. Treat every factual claim below as unconfirmed "
    "and verify before publishing.\n"
    "----------------------------------------------------------------------\n"
)


@dataclass
class DraftResult:
    """What a draft run gives back."""

    text: str
    content_type: ContentType
    model: str
    usage: Usage
    needs_verification: bool

    def render(self) -> str:
        """Human-facing view: honesty banner (if needed) + the draft."""
        if self.needs_verification:
            banner = _UNVERIFIED_BANNER.format(
                label=spec_for(self.content_type).label
            )
            return banner + self.text
        return self.text


def draft(
    content_type: ContentType,
    intent: str,
    session_context: str | None = None,
    research_notes: str | None = None,
    model: str = DEFAULT_MODEL,
) -> DraftResult:
    """Produce one platform draft from a typed intent.

    Args mirror the pipeline contract from CLAUDE.md:
      {content_type, intent, session_context?, research_notes?}
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and "
            "paste your key in."
        )

    spec = spec_for(content_type)
    system_prompt = build_system_prompt(content_type)
    user_prompt = build_user_prompt(intent, session_context, research_notes)

    client = Anthropic()  # reads the key from the environment
    response = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system=system_prompt,        # standing rules
        messages=[{"role": "user", "content": user_prompt}],  # the request
    )

    text = "".join(
        block.text for block in response.content if block.type == "text"
    ).strip()

    usage = Usage(
        model=model,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
    )

    # We can't do research yet, so if the type needs it, flag rather than
    # silently trust the model's own knowledge (accuracy > everything, §4).
    needs_verification = spec.needs_research and not research_notes

    return DraftResult(
        text=text,
        content_type=content_type,
        model=model,
        usage=usage,
        needs_verification=needs_verification,
    )
