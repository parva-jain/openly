"""The `openly` command — the manual trigger and review workflow.

Subcommands
-----------
  mark   Trigger: queue a content job from a type + intent (NON-BLOCKING).
         Captures a window of the current session for session-anchored types.
  work   Drain the queue: draft all pending jobs (the slow, async half).
  list   Show all jobs and their status.
  show   Print a finished draft.

Typical flow (mid-coding):
  # instant — you keep working:
  python scripts/openly_cli.py mark progress_update "shipped the job queue"
  # later, drafts everything queued:
  python scripts/openly_cli.py work
  python scripts/openly_cli.py list
  python scripts/openly_cli.py show <job_id>
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, __file__.rsplit("/scripts/", 1)[0])

from openly import queue  # noqa: E402
from openly.capture import capture_window  # noqa: E402
from openly.content_types import ContentType, spec_for  # noqa: E402
from openly.worker import process_pending  # noqa: E402


def cmd_mark(args: argparse.Namespace) -> None:
    content_type = ContentType(args.content_type)
    spec = spec_for(content_type)

    # Decide whether to snapshot the session: default to the type's nature,
    # but let flags override.
    do_capture = spec.session_anchored
    if args.capture:
        do_capture = True
    if args.no_capture:
        do_capture = False

    session_context = None
    if do_capture:
        session_context = capture_window(max_messages=args.window)

    job = queue.enqueue(
        content_type=content_type.value,
        intent=args.intent,
        session_context=session_context,
    )

    captured = (
        f"{len(session_context)} chars captured"
        if session_context
        else "no session window"
    )
    print(f"✓ queued job {job.id}  ({content_type.value}; {captured})")
    print("  drafting is async — run `work` when you want the draft.")


def cmd_work(_args: argparse.Namespace) -> None:
    touched = process_pending()
    if not touched:
        print("nothing pending.")
        return
    for job in touched:
        if job.status == queue.DRAFTED:
            print(f"✓ drafted {job.id} -> {job.draft_path}")
        else:
            print(f"✗ error   {job.id}: {job.error}")


def cmd_list(_args: argparse.Namespace) -> None:
    jobs = queue.list_jobs()
    if not jobs:
        print("queue is empty.")
        return
    for j in jobs:
        when = datetime.fromtimestamp(j.created_at).strftime("%m-%d %H:%M")
        print(f"{j.id}  {when}  {j.status:<8}  {j.content_type:<20}  {j.intent[:50]}")


def cmd_show(args: argparse.Namespace) -> None:
    job = queue.get(args.job_id)
    if job is None:
        print(f"no job {args.job_id!r}")
        return
    if not job.draft_path or not Path(job.draft_path).exists():
        print(f"job {job.id} has no draft yet (status: {job.status}).")
        return
    print(Path(job.draft_path).read_text())


def main() -> None:
    parser = argparse.ArgumentParser(prog="openly")
    sub = parser.add_subparsers(dest="command", required=True)

    p_mark = sub.add_parser("mark", help="queue a content job (non-blocking)")
    p_mark.add_argument("content_type", choices=[t.value for t in ContentType])
    p_mark.add_argument("intent", help="one-line description of the moment")
    p_mark.add_argument("--capture", action="store_true", help="force session capture")
    p_mark.add_argument("--no-capture", action="store_true", help="skip session capture")
    p_mark.add_argument("--window", type=int, default=30, help="messages to capture")
    p_mark.set_defaults(func=cmd_mark)

    p_work = sub.add_parser("work", help="draft all pending jobs")
    p_work.set_defaults(func=cmd_work)

    p_list = sub.add_parser("list", help="show all jobs")
    p_list.set_defaults(func=cmd_list)

    p_show = sub.add_parser("show", help="print a finished draft")
    p_show.add_argument("job_id")
    p_show.set_defaults(func=cmd_show)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
