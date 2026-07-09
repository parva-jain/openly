"""The content types Openly can draft.

CLAUDE.md §3 is emphatic: content is *typed*, and the type drives the
format, whether research is needed, and whether it's anchored to a coding
session. We do NOT overfit to one shape. This enum is the single place
that knowledge lives, so the rest of the code stays type-agnostic.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ContentType(str, Enum):
    """The kinds of posts we can draft. Extend this list as new types appear."""

    PROGRESS_UPDATE = "progress_update"
    ORIGIN_NARRATIVE = "origin_narrative"
    LEARNING_REFLECTION = "learning_reflection"
    CONCEPT_EXPLAINER = "concept_explainer"


@dataclass(frozen=True)
class TypeSpec:
    """Everything the drafter needs to know about one content type.

    `needs_research` is wired now but only *acted on* in Stage 1 (when the
    drafter gets a web-search tool). Until then, a type that needs research
    gets an honesty banner instead of silently making facts up — accuracy is
    load-bearing (CLAUDE.md §4).
    """

    label: str            # human-friendly name
    needs_research: bool   # does accurate output require external sources?
    session_anchored: bool  # is this usually tied to a coding session?
    shape: str            # plain-English description of the post's structure


# The source of truth for per-type behaviour.
TYPE_SPECS: dict[ContentType, TypeSpec] = {
    ContentType.PROGRESS_UPDATE: TypeSpec(
        label="Progress update / build log",
        needs_research=False,
        session_anchored=True,
        shape=(
            "A short update on what you just shipped or moved forward. "
            "Lead with the concrete thing that changed, say why it matters, "
            "and end with what's next or what you learned. Specific > vague."
        ),
    ),
    ContentType.ORIGIN_NARRATIVE: TypeSpec(
        label="Origin / narrative",
        needs_research=False,
        session_anchored=False,
        shape=(
            "The story behind the project or idea — how it started, the "
            "itch it scratches, the moment it clicked. Personal and honest, "
            "not a feature list. Pull the reader into the 'why'."
        ),
    ),
    ContentType.LEARNING_REFLECTION: TypeSpec(
        label="Learning / reflection",
        needs_research=False,
        session_anchored=False,
        shape=(
            "A reflection on something you learned. Name the lesson plainly, "
            "show the concrete experience that taught it, and make it useful "
            "to someone who hasn't hit it yet. Earned insight, not platitudes."
        ),
    ),
    ContentType.CONCEPT_EXPLAINER: TypeSpec(
        label="Concept explainer",
        needs_research=True,   # <- until Stage 1 wires research, we flag it
        session_anchored=False,
        shape=(
            "Explain a technical concept clearly to a smart non-expert. "
            "Use a concrete anchor or analogy, avoid jargon, and stay "
            "accurate. Depth over hand-waving."
        ),
    ),
}


def spec_for(content_type: ContentType) -> TypeSpec:
    return TYPE_SPECS[content_type]
