"""The Python AI service (FastAPI) — Openly's stateless "AI brain".

This wraps the existing `draft()` engine in an HTTP API so other services (the
Node/TS backend) can call it over the network. It is deliberately STATELESS:
no database, no users, no queue. Give it a request, get a draft back. All
product state lives in the Node backend (see CLAUDE.md §5).

Run it locally:
    .venv/bin/uvicorn openly.api:app --reload --port 8000

Then:
    GET  http://localhost:8000/health
    POST http://localhost:8000/draft   {content_type, intent, ...}
    Interactive docs: http://localhost:8000/docs
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from openly.content_types import ContentType
from openly.draft import DEFAULT_VARIATIONS, MAX_VARIATIONS, draft, fuse

app = FastAPI(
    title="Openly AI Service",
    description="Stateless drafting engine: typed intent -> a platform draft.",
    version="1.0.0",
)


# --- Request/response schemas ------------------------------------------------
# Pydantic models ARE the contract with the Node backend. FastAPI uses them to
# validate incoming JSON and to auto-generate docs at /docs. Node will send
# JSON matching DraftRequest and receive JSON matching DraftResponse.


class DraftRequest(BaseModel):
    content_type: ContentType = Field(
        ..., description="One of the typed content types (drives format/research)."
    )
    intent: str = Field(..., min_length=1, description="One-line description of the moment.")
    session_context: str | None = Field(
        None, description="Optional sanitized window of the coding session."
    )
    research_notes: str | None = Field(
        None, description="Optional pre-verified external facts."
    )
    n_variations: int = Field(
        DEFAULT_VARIATIONS,
        ge=1,
        le=MAX_VARIATIONS,
        description=f"How many distinct variations to return (1-{MAX_VARIATIONS}).",
    )
    model: str | None = Field(None, description="Optional model id override.")


class FuseRequest(BaseModel):
    content_type: ContentType = Field(
        ..., description="The content type of the variations being fused."
    )
    variations: list[str] = Field(
        ..., min_length=1, description="The selected variations to synthesize into one."
    )
    instruction: str | None = Field(
        None, description="Optional steer, e.g. 'more raw', 'shorter'."
    )
    model: str | None = Field(None, description="Optional model id override.")


class SourceOut(BaseModel):
    title: str
    url: str
    snippet: str


class UsageOut(BaseModel):
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


class DraftResponse(BaseModel):
    variations: list[str]
    content_type: str
    needs_verification: bool
    sources: list[SourceOut]
    usage: UsageOut


class FuseResponse(BaseModel):
    text: str
    content_type: str
    usage: UsageOut


# --- Endpoints ---------------------------------------------------------------


@app.get("/health")
def health() -> dict:
    """Liveness check. Used by Docker/load balancers and for quick sanity."""
    return {"status": "ok", "service": "openly-ai"}


def _usage_out(result) -> UsageOut:
    return UsageOut(
        model=result.usage.model,
        input_tokens=result.usage.input_tokens,
        output_tokens=result.usage.output_tokens,
        cost_usd=round(result.usage.cost_usd, 6),
    )


@app.post("/draft", response_model=DraftResponse)
def create_draft(req: DraftRequest) -> DraftResponse:
    """Draft a SLATE of N variations from a typed intent. Stateless."""
    try:
        kwargs = dict(
            content_type=req.content_type,
            intent=req.intent,
            session_context=req.session_context,
            research_notes=req.research_notes,
            n_variations=req.n_variations,
        )
        if req.model:
            kwargs["model"] = req.model
        result = draft(**kwargs)
    except RuntimeError as exc:
        # e.g. missing ANTHROPIC_API_KEY — a server-side config problem.
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return DraftResponse(
        variations=result.variations,
        content_type=result.content_type.value,
        needs_verification=result.needs_verification,
        sources=[
            SourceOut(title=s.title, url=s.url, snippet=s.snippet)
            for s in result.sources
        ],
        usage=_usage_out(result),
    )


@app.post("/fuse", response_model=FuseResponse)
def fuse_variations(req: FuseRequest) -> FuseResponse:
    """Synthesize selected variations into one stronger post. Stateless."""
    try:
        kwargs = dict(
            content_type=req.content_type,
            variations=req.variations,
            instruction=req.instruction,
        )
        if req.model:
            kwargs["model"] = req.model
        result = fuse(**kwargs)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return FuseResponse(
        text=result.text,
        content_type=result.content_type.value,
        usage=_usage_out(result),
    )
