"""The worker — drains pending jobs by drafting them.

This is the "async drafting lands in the review dashboard" half of the
non-blocking design (CLAUDE.md §4). `mark` queued the job instantly; the
worker does the slow part (the model call, incl. web research) later, and
writes each finished draft to `data/drafts/<id>.md` for review.

For now you run `work` by hand. Automating it (run-on-trigger, or a real
Claude Code hook/skill) is a later-stage upgrade — the queue makes that swap
trivial because the worker doesn't care who calls it.
"""

from __future__ import annotations

from datetime import datetime, timezone

from openly import queue
from openly.content_types import ContentType
from openly.draft import draft
from openly.queue import DRAFTS_DIR, Job


def _render_draft_file(job: Job, result) -> str:
    """The reviewable artifact: metadata header + the draft + its sources."""
    when = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    header = (
        f"# Draft for job {job.id}\n\n"
        f"- type: {job.content_type}\n"
        f"- intent: {job.intent}\n"
        f"- model: {result.model}\n"
        f"- usage: {result.usage.summary()}\n"
        f"- drafted: {when}\n\n"
        "---\n\n"
    )
    return header + result.render() + "\n"


def process_job(job: Job) -> Job:
    """Draft one job, save the result, and update its status."""
    try:
        result = draft(
            content_type=ContentType(job.content_type),
            intent=job.intent,
            session_context=job.session_context,
        )
        path = DRAFTS_DIR / f"{job.id}.md"
        DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(_render_draft_file(job, result))

        job.status = queue.DRAFTED
        job.draft_path = str(path)
        job.error = None
    except Exception as exc:
        job.status = queue.ERROR
        job.error = str(exc)
    queue.update(job)
    return job


def process_pending() -> list[Job]:
    """Draft every pending job. Returns the jobs it touched."""
    pending = queue.list_jobs(status=queue.PENDING)
    return [process_job(job) for job in pending]
