"""The `draft` call — now with a tool-use loop for research.

Stage 0 was a single closed-book API call. Stage 1 upgrades it: for content
types that need facts, we hand the model a web_search tool and run the
tool-use loop:

    send prompt (+ tools)
      -> model either writes the draft, OR asks to call a tool
      -> if it asks: WE run the tool, send the result back
      -> repeat until the model stops asking and writes the draft

The model only ever *requests* a tool; our code executes it. That keeps us in
control of what gets searched and lets us record sources for the review step.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from anthropic import Anthropic
from dotenv import load_dotenv

from openly.content_types import ContentType, spec_for
from openly.cost import Usage
from openly.prompts import build_system_prompt, build_user_prompt
from openly.research import WEB_SEARCH_TOOL, Source, execute_tool

# Load .env into the environment as soon as this module is imported, so the
# Anthropic client finds ANTHROPIC_API_KEY. `.env` is gitignored.
load_dotenv()

DEFAULT_MODEL = "claude-sonnet-4-6"  # best quality-per-cost for writing
MAX_TOKENS = 1024  # a cap on output length (also a cost ceiling per call)
MAX_TOOL_ROUNDS = 5  # safety cap so a runaway loop can't rack up cost

# Shown when a content type needs research but we can't do it (no Tavily key).
_UNVERIFIED_BANNER = (
    "⚠️  UNVERIFIED — this type ('{label}') needs web research, but no "
    "TAVILY_API_KEY is set, so nothing was fact-checked. Treat every factual "
    "claim below as unconfirmed and verify before publishing.\n"
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
    sources: list[Source] = field(default_factory=list)

    def render(self) -> str:
        """Human-facing view: banner (if unverified) + draft + sources."""
        out = ""
        if self.needs_verification:
            out += _UNVERIFIED_BANNER.format(
                label=spec_for(self.content_type).label
            )
        out += self.text
        if self.sources:
            out += "\n\nSOURCES USED (verify before publishing):"
            for i, s in enumerate(self.sources, 1):
                out += f"\n[{i}] {s.title} — {s.url}"
        return out


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

    # Offer the search tool ONLY when this type needs research and we have a
    # key for it. Session-anchored types (progress updates) never get it.
    research_enabled = bool(spec.needs_research and os.environ.get("TAVILY_API_KEY"))
    tools = [WEB_SEARCH_TOOL] if research_enabled else []

    system_prompt = build_system_prompt(content_type, research_enabled=research_enabled)
    user_prompt = build_user_prompt(intent, session_context, research_notes)

    client = Anthropic()
    messages = [{"role": "user", "content": user_prompt}]

    # We accumulate token usage across every turn of the loop, and collect any
    # sources the model pulled in, so the final cost/citations are complete.
    total_input = 0
    total_output = 0
    sources: list[Source] = []

    for _ in range(MAX_TOOL_ROUNDS):
        create_kwargs = dict(
            model=model,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            messages=messages,
        )
        if tools:
            create_kwargs["tools"] = tools

        response = client.messages.create(**create_kwargs)
        total_input += response.usage.input_tokens
        total_output += response.usage.output_tokens

        if response.stop_reason != "tool_use":
            break  # the model wrote the draft; we're done

        # The model asked for one or more tools. Record its request, run each
        # tool, and feed the results back as a user turn — then loop again.
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result_text, found = execute_tool(block.name, block.input)
                sources.extend(found)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_text,
                    }
                )
        messages.append({"role": "user", "content": tool_results})

    text = "".join(
        block.text for block in response.content if block.type == "text"
    ).strip()

    usage = Usage(model=model, input_tokens=total_input, output_tokens=total_output)

    # Banner only if research was needed but we couldn't do it (no key / no notes).
    needs_verification = (
        spec.needs_research and not research_enabled and not research_notes
    )

    # De-duplicate sources by URL, preserving order.
    seen: set[str] = set()
    unique_sources = [
        s for s in sources if s.url and not (s.url in seen or seen.add(s.url))
    ]

    return DraftResult(
        text=text,
        content_type=content_type,
        model=model,
        usage=usage,
        needs_verification=needs_verification,
        sources=unique_sources,
    )
