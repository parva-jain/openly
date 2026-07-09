"""A tiny command-line front end for the `draft` call.

Examples
--------
    python scripts/draft_cli.py progress_update \\
        "shipped the stage 0 draft call — types, prompts, cost meter"

    python scripts/draft_cli.py origin_narrative \\
        "why i'm building a build-in-public content agent"

    # pipe in extra context from a file:
    python scripts/draft_cli.py progress_update "shipped capture layer" \\
        --context "$(cat notes.txt)"

Run with no args to see the list of content types.
"""

from __future__ import annotations

import argparse
import sys

# Make `import openly` work when run as `python scripts/draft_cli.py`.
sys.path.insert(0, __file__.rsplit("/scripts/", 1)[0])

from openly import ContentType, draft  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Draft a build-in-public post.")
    parser.add_argument(
        "content_type",
        choices=[t.value for t in ContentType],
        help="the kind of post to write",
    )
    parser.add_argument("intent", help="one-line description of what to write about")
    parser.add_argument("--context", default=None, help="optional session context")
    parser.add_argument("--research", default=None, help="optional verified research notes")
    parser.add_argument("--model", default=None, help="override the model id")
    args = parser.parse_args()

    kwargs = dict(
        content_type=ContentType(args.content_type),
        intent=args.intent,
        session_context=args.context,
        research_notes=args.research,
    )
    if args.model:
        kwargs["model"] = args.model

    result = draft(**kwargs)

    print("\n" + "=" * 70)
    print(result.render())
    print("=" * 70)
    print(result.usage.summary())


if __name__ == "__main__":
    main()
