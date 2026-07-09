"""Prompt engineering lives here.

This is the core Stage 0 concept. A good prompt for a *tool* (as opposed to
a chat message) is assembled from clearly separated parts, so the same inputs
always produce consistent, on-format output:

  1. ROLE / VOICE   — who is writing, and how they sound.
  2. PLATFORM        — the format rules for the target platform (X for now).
  3. TYPE SHAPE      — the structure for this specific content type.
  4. OUTPUT CONTRACT — exactly what to return (draft only, no preamble).
  5. THE INPUTS      — the user's intent + any context, kept clearly separate
                       from the instructions so the model can't confuse the
                       two (this separation is a real prompt-safety habit).

We build the first four into the *system prompt* (the standing instructions)
and put #5 in the *user message* (the actual request). Splitting them this
way is deliberate: system = the rules, user = the task.
"""

from __future__ import annotations

from openly.content_types import ContentType, spec_for


# ---- 1. ROLE / VOICE -------------------------------------------------------
# There's no learned style yet — that arrives in Stage 2 (RAG style memory).
# For now this is a sensible generic "good build-in-public voice". When we
# build style memory, retrieved rules + examples get injected right here.
VOICE = """\
You are a ghostwriter drafting build-in-public content for a developer who \
is building projects and sharing the journey. Their voice is: honest, \
specific, and unpretentious. They sound like a real engineer talking to \
peers — not a marketer. No hype, no buzzword soup, no forced enthusiasm. \
Concrete details over vague claims. Show the actual work.

Hard rules on voice:
- Never invent facts, numbers, or events. Only use what the inputs give you.
- No emoji unless it genuinely fits. Never more than one.
- No hashtag spam. At most one, and only if it truly adds reach.
- Don't start with "I'm excited to..." or other LinkedIn-isms.\
"""


# ---- 2. PLATFORM: X --------------------------------------------------------
# Stage 0 targets X only. Other platforms get their own block later.
PLATFORM_X = """\
Target platform: X (Twitter).
Format rules:
- Keep it tight. A single post is best; only use a short thread (2-4 posts) \
if the idea genuinely needs the room.
- If it's a thread, separate posts with a line containing only "---".
- Each post must stand on its own and stay well under 280 characters.
- Open with a hook that earns the next line. No slow warm-ups.
- Plain language. Line breaks are fine for rhythm.\
"""


# ---- 4. OUTPUT CONTRACT ----------------------------------------------------
# We shape the output by telling the model to return ONLY the draft. This is
# the lightweight form of "structured output": a predictable payload we can
# drop straight into a review flow, with no "Here's your draft:" preamble to
# strip. (We'll graduate to real structured/JSON output when a later stage
# needs machine-readable metadata alongside the text.)
OUTPUT_CONTRACT = """\
Output ONLY the post text itself. No preamble, no explanation, no quotes \
around it, no "Here's a draft". Just the content, ready to review.\
"""


def build_system_prompt(content_type: ContentType) -> str:
    """Assemble the standing instructions for one content type."""
    spec = spec_for(content_type)

    type_shape = (
        f"Content type: {spec.label}.\n"
        f"Shape this post like so: {spec.shape}"
    )

    return "\n\n".join([VOICE, PLATFORM_X, type_shape, OUTPUT_CONTRACT])


def build_user_prompt(
    intent: str,
    session_context: str | None = None,
    research_notes: str | None = None,
) -> str:
    """Assemble the actual request from the user's inputs.

    We wrap each input in labelled tags. Tags give the model a crisp boundary
    between "here is your instruction" and "here is the raw material", which
    keeps pasted session text from being read as commands.
    """
    parts = [f"<intent>\n{intent.strip()}\n</intent>"]

    if session_context and session_context.strip():
        parts.append(
            "<session_context>\n"
            "Raw material from the work session. Use it for accuracy; do not "
            "quote secrets, keys, client names, or private code.\n"
            f"{session_context.strip()}\n"
            "</session_context>"
        )

    if research_notes and research_notes.strip():
        parts.append(
            "<research_notes>\n"
            "Verified external facts. If you use a specific claim from here, "
            "keep it accurate.\n"
            f"{research_notes.strip()}\n"
            "</research_notes>"
        )

    parts.append("Write the post now, following all the rules above.")
    return "\n\n".join(parts)
