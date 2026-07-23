"""Tests for draft()/fuse() with the Anthropic SDK mocked.

Cardinal rule: tests must NEVER hit the real paid API. We replace the Anthropic
client with a fake that returns a canned response, then assert on OUR logic
(slate parsing, usage accumulation, the research banner). Fast, free, stable.
"""

import importlib
from types import SimpleNamespace

from openly.content_types import ContentType
from openly.draft import draft, fuse

# NOTE: `openly/__init__.py` binds the *function* `draft` into the package,
# which shadows the `openly.draft` *module* attribute. Grab the real module
# object via importlib so monkeypatching its globals (Anthropic) works.
draft_mod = importlib.import_module("openly.draft")


def _fake_anthropic(text: str, *, input_tokens=10, output_tokens=20):
    """Return a factory that mimics Anthropic() -> .messages.create(...)."""

    def create(**_kwargs):
        block = SimpleNamespace(type="text", text=text)
        usage = SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens)
        return SimpleNamespace(content=[block], stop_reason="end_turn", usage=usage)

    return lambda *a, **k: SimpleNamespace(messages=SimpleNamespace(create=create))


def test_draft_parses_slate_and_sums_usage(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    delim = draft_mod.VARIATION_DELIMITER
    monkeypatch.setattr(
        draft_mod, "Anthropic", _fake_anthropic(f"one{delim}two{delim}three")
    )

    result = draft(ContentType.PROGRESS_UPDATE, "shipped X", n_variations=3)

    assert result.variations == ["one", "two", "three"]
    assert result.usage.input_tokens == 10
    assert result.usage.output_tokens == 20
    assert result.needs_verification is False  # progress_update needs no research


def test_draft_flags_unverified_when_research_needed_but_unavailable(monkeypatch):
    # concept_explainer needs research; with no TAVILY key it must be flagged.
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    monkeypatch.setattr(draft_mod, "Anthropic", _fake_anthropic("some explainer"))

    result = draft(ContentType.CONCEPT_EXPLAINER, "what is RAG", n_variations=1)

    assert result.needs_verification is True
    assert "UNVERIFIED" in result.render()


def test_draft_requires_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    try:
        draft(ContentType.PROGRESS_UPDATE, "x")
        raised = False
    except RuntimeError:
        raised = True
    assert raised


def test_n_variations_is_clamped(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(draft_mod, "Anthropic", _fake_anthropic("only one"))
    # Asking for 99 must not blow up; it clamps to MAX_VARIATIONS.
    result = draft(ContentType.PROGRESS_UPDATE, "x", n_variations=99)
    assert len(result.variations) >= 1


def test_fuse_returns_single_post(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(draft_mod, "Anthropic", _fake_anthropic("fused post"))

    result = fuse(ContentType.PROGRESS_UPDATE, ["a", "b"], instruction="tighter")

    assert result.variations == ["fused post"]
    assert result.text == "fused post"
