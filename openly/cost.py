"""The cost meter.

You pay per *token*, not per request. Every API response tells us exactly
how many input and output tokens it used; this module turns that into an
estimated dollar cost so no draft is ever a mystery.

IMPORTANT: these prices are hand-entered ballparks (USD per 1,000,000
tokens). Confirm/update them against https://www.anthropic.com/pricing —
they are the one thing here that goes stale.
"""

from __future__ import annotations

from dataclasses import dataclass

# USD per 1,000,000 tokens: (input_price, output_price).
# Output is billed much higher than input — that's why concise prompts and
# not-overlong drafts keep costs down.
PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-8": (15.0, 75.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
}


@dataclass(frozen=True)
class Usage:
    model: str
    input_tokens: int
    output_tokens: int

    @property
    def cost_usd(self) -> float:
        in_price, out_price = PRICING.get(self.model, (0.0, 0.0))
        return (
            self.input_tokens / 1_000_000 * in_price
            + self.output_tokens / 1_000_000 * out_price
        )

    def summary(self) -> str:
        known = self.model in PRICING
        cost = f"${self.cost_usd:.4f}" if known else "cost: unknown model"
        return (
            f"tokens: {self.input_tokens:,} in / {self.output_tokens:,} out"
            f"  ·  est. {cost}  ·  model: {self.model}"
        )
