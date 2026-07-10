"""A dead-simple job queue, backed by one JSON file.

This is what makes the trigger NON-BLOCKING (CLAUDE.md §4). `mark` appends a
job here and returns instantly; drafting happens later when `work` drains the
queue. No database yet — flat JSON is the §9-sanctioned "simplest thing that
works". We swap in SQLite/vectors only when we outgrow this.

The queue file and drafts live under `data/`, which is gitignored: captured
session windows can contain private content and must never be committed (§4).
"""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
QUEUE_FILE = DATA_DIR / "queue.json"
DRAFTS_DIR = DATA_DIR / "drafts"

# Job status values.
PENDING = "pending"
DRAFTED = "drafted"
ERROR = "error"


@dataclass
class Job:
    id: str
    created_at: float
    content_type: str
    intent: str
    session_context: str | None = None
    status: str = PENDING
    draft_path: str | None = None
    error: str | None = None
    extra: dict = field(default_factory=dict)


def _ensure_dirs() -> None:
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)


def _load() -> list[dict]:
    if not QUEUE_FILE.exists():
        return []
    return json.loads(QUEUE_FILE.read_text() or "[]")


def _save(jobs: list[dict]) -> None:
    _ensure_dirs()
    QUEUE_FILE.write_text(json.dumps(jobs, indent=2))


def enqueue(
    content_type: str,
    intent: str,
    session_context: str | None = None,
) -> Job:
    """Append a new pending job and return it. Instant, non-blocking."""
    job = Job(
        id=uuid.uuid4().hex[:8],
        created_at=time.time(),
        content_type=content_type,
        intent=intent,
        session_context=session_context,
    )
    jobs = _load()
    jobs.append(asdict(job))
    _save(jobs)
    return job


def list_jobs(status: str | None = None) -> list[Job]:
    jobs = [Job(**j) for j in _load()]
    if status:
        jobs = [j for j in jobs if j.status == status]
    return jobs


def get(job_id: str) -> Job | None:
    for j in _load():
        if j["id"] == job_id:
            return Job(**j)
    return None


def update(job: Job) -> None:
    """Persist changes to an existing job (matched by id)."""
    jobs = _load()
    for i, j in enumerate(jobs):
        if j["id"] == job.id:
            jobs[i] = asdict(job)
            break
    _save(jobs)
