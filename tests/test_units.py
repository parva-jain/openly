"""Unit tests for the pure logic — no API calls, fast and deterministic."""

from openly.capture import sanitize
from openly.content_types import TYPE_SPECS, ContentType, spec_for
from openly.cost import PRICING, Usage
from openly.draft import _parse_variations
from openly.prompts import (
    VARIATION_DELIMITER,
    build_fuse_user_prompt,
    build_system_prompt,
    build_user_prompt,
    output_contract,
)


# ---- cost meter ----
def test_cost_computation_matches_pricing():
    u = Usage(model="claude-sonnet-4-6", input_tokens=1_000_000, output_tokens=1_000_000)
    in_price, out_price = PRICING["claude-sonnet-4-6"]
    assert u.cost_usd == in_price + out_price


def test_cost_unknown_model_is_zero_and_flagged():
    u = Usage(model="made-up-model", input_tokens=100, output_tokens=100)
    assert u.cost_usd == 0.0
    assert "unknown model" in u.summary()


# ---- content types ----
def test_every_content_type_has_a_spec():
    for ct in ContentType:
        assert ct in TYPE_SPECS
        assert spec_for(ct).label


def test_concept_explainer_needs_research():
    assert spec_for(ContentType.CONCEPT_EXPLAINER).needs_research is True
    assert spec_for(ContentType.PROGRESS_UPDATE).needs_research is False


# ---- prompts ----
def test_output_contract_single_vs_slate():
    assert VARIATION_DELIMITER not in output_contract(1)
    slate = output_contract(3)
    assert VARIATION_DELIMITER in slate
    assert "3" in slate


def test_system_prompt_includes_research_policy_only_when_enabled():
    with_research = build_system_prompt(ContentType.CONCEPT_EXPLAINER, research_enabled=True)
    without = build_system_prompt(ContentType.PROGRESS_UPDATE, research_enabled=False)
    assert "web_search" in with_research
    assert "web_search" not in without


def test_user_prompt_fences_inputs_and_omits_missing():
    p = build_user_prompt("my intent", session_context="ctx", research_notes=None)
    assert "<intent>" in p and "my intent" in p
    assert "<session_context>" in p and "ctx" in p
    assert "<research_notes>" not in p  # omitted when not provided


def test_fuse_user_prompt_labels_each_variation():
    p = build_fuse_user_prompt(["one", "two"], instruction="tighter")
    assert "<variation_1>" in p and "<variation_2>" in p
    assert "tighter" in p


# ---- variation parsing ----
def test_parse_single_variation():
    assert _parse_variations("just one post", 1) == ["just one post"]


def test_parse_slate_splits_on_delimiter():
    raw = f"A{VARIATION_DELIMITER}B{VARIATION_DELIMITER}C"
    assert _parse_variations(raw, 3) == ["A", "B", "C"]


def test_parse_slate_falls_back_when_delimiter_missing():
    # Model ignored the delimiter — we still return something usable.
    assert _parse_variations("no delimiter here", 3) == ["no delimiter here"]


# ---- secret sanitization (privacy is load-bearing) ----
def test_sanitize_redacts_keys_and_secrets():
    text = "here is sk-ant-abc123DEF and tvly-secret999 and api_key=hunter2"
    out = sanitize(text)
    assert "sk-ant-abc123DEF" not in out
    assert "tvly-secret999" not in out
    assert "hunter2" not in out
    assert "[REDACTED]" in out
