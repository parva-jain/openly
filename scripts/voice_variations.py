"""One-off: generate origin-narrative variations matched to the author's voice.

This is a hands-on preview of Stage M7 (style memory / RAG): we feed the
author's OWN rough draft in as a voice anchor (few-shot) and ask the model to
produce variations that match their thesis and tone — instead of the engine's
generic voice. Run: .venv/bin/python scripts/voice_variations.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from anthropic import Anthropic  # noqa: E402

from openly.cost import Usage  # noqa: E402

MODEL = "claude-sonnet-5"

USER_EXAMPLE = """Building personal brand has become a necessity rather than a choice to be relevant or get opportunities in today's time. Earlier, if you have certain skills and can build meaningful thing, you can easily get opportunities, but now you need to sell your skills as well and thats why personal brand building is a must.
Im someone who doesnt like to put out content about what im building. Idk i feel there's some force which stops me from doing so. So thats why i decided to make this process autonomous. Imagine you can keep building or learning and there's a tool which can put personalized content on your behalf, adding autonomous brand building to your engineering sessions. Thats why im building openly that enables you to build or learn in public without shifting your focus from your main work, building"""

SYSTEM = """You are ghostwriting the FIRST post announcing a project called Openly, for X (Twitter).

Openly turns your real engineering/learning work into build-in-public content with almost no writing effort — so you can build or learn in public without shifting focus from the actual work.

You are given the author's OWN rough draft of this post. It is the gold standard for VOICE, ANGLE, and THESIS — study it and match it. The author's real thesis:
- Personal brand is now a necessity, not a choice — skills alone used to be enough to get opportunities; now you must also sell/signal them.
- The author personally dislikes/resists posting about their work — there's an internal friction that stops them.
- The fix is to make brand-building AUTONOMOUS: keep building/learning while a tool ships personalized content on your behalf.
- Value: build/learn in public without losing focus on the main work — building.

Voice to match: first person, honest, conversational, a little raw and unpolished, thinks out loud, no marketing gloss, no hype, no emoji, no hashtags. Sound like a real engineer, not a brand account. You may tighten the author's language, but keep it their voice — do NOT make it sound corporate or like a LinkedIn influencer.

Write 5 DISTINCT variations, each a complete, standalone X post (single post or short thread; if a thread, separate posts with a line containing only ---). Each variation must enter from a different angle:
1. Confession-led: open with the personal resistance to posting.
2. Thesis-led: open with 'personal brand is now a necessity, not a choice'.
3. Vision-led: open with the 'imagine you keep building and the content ships itself' idea.
4. Observation/contrarian: open with 'skills used to be enough — not anymore'.
5. Short & punchy: the whole idea in a tight few lines.

Output format: for each, a header line 'VARIATION N — <angle>' then the post. Separate variations with a line of exactly '========'. Output nothing else."""


def main() -> None:
    user = (
        "Here is my rough draft (my voice and angle to match):\n\n"
        f"<my_rough_draft>\n{USER_EXAMPLE}\n</my_rough_draft>\n\n"
        "Now write the 5 variations."
    )
    client = Anthropic()
    r = client.messages.create(
        model=MODEL, max_tokens=2000, system=SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in r.content if b.type == "text").strip()
    print(text)
    print("\n" + "=" * 70)
    u = Usage(model=MODEL, input_tokens=r.usage.input_tokens, output_tokens=r.usage.output_tokens)
    print(u.summary(), " (sonnet-5 price is an estimate — verify)")


if __name__ == "__main__":
    main()
