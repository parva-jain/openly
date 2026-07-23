"""Tests for the FastAPI service.

We use FastAPI's TestClient (in-process HTTP, no real server/port) and
monkeypatch the drafting functions so the endpoints are exercised WITHOUT
touching the model. This tests the contract: validation, status codes, shape.
"""

from fastapi.testclient import TestClient

import openly.api as api
from openly.content_types import ContentType
from openly.cost import Usage
from openly.draft import DraftResult

client = TestClient(api.app)


def _fake_draft_result(variations):
    return DraftResult(
        variations=variations,
        content_type=ContentType.PROGRESS_UPDATE,
        model="fake",
        usage=Usage(model="fake", input_tokens=1, output_tokens=1),
        needs_verification=False,
        sources=[],
    )


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_draft_returns_slate(monkeypatch):
    monkeypatch.setattr(api, "draft", lambda **kw: _fake_draft_result(["a", "b", "c"]))
    r = client.post(
        "/draft",
        json={"content_type": "progress_update", "intent": "x", "n_variations": 3},
    )
    assert r.status_code == 200
    assert r.json()["variations"] == ["a", "b", "c"]


def test_draft_rejects_bad_content_type():
    r = client.post("/draft", json={"content_type": "nope", "intent": "x"})
    assert r.status_code == 422


def test_draft_rejects_too_many_variations():
    r = client.post(
        "/draft",
        json={"content_type": "progress_update", "intent": "x", "n_variations": 9},
    )
    assert r.status_code == 422


def test_draft_requires_intent():
    r = client.post("/draft", json={"content_type": "progress_update"})
    assert r.status_code == 422


def test_fuse_returns_text(monkeypatch):
    monkeypatch.setattr(
        api, "fuse", lambda **kw: _fake_draft_result(["fused"])
    )
    r = client.post(
        "/fuse",
        json={"content_type": "progress_update", "variations": ["a", "b"]},
    )
    assert r.status_code == 200
    assert r.json()["text"] == "fused"


def test_fuse_rejects_empty_variations():
    r = client.post("/fuse", json={"content_type": "progress_update", "variations": []})
    assert r.status_code == 422
