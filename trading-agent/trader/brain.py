"""The Brain: slow, deep reasoning via Claude Opus 5.5.

Used in two places only:
  * escalations (low Jev confidence or a crisis regime) -> a verdict that can
    only keep a symbol frozen, clear the freeze, or request a de-risk;
  * the nightly review -> proposed rewrites of schema *instructions*.

The Brain can never open a position, size a trade, or change a limit. Its
output is validated against a closed JSON schema, and every failure mode
(no key, timeout, refusal, bad JSON) fails closed: stay frozen / keep the
current schema.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Protocol

MODEL = "claude-opus-5-5"

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["stay_frozen", "clear", "reduce"]},
        "reason": {"type": "string"},
    },
    "required": ["action", "reason"],
    "additionalProperties": False,
}

REWRITE_SCHEMA = {
    "type": "object",
    "properties": {
        "instructions": {
            "type": "object",
            "properties": {k: {"type": "string"} for k in
                           ("regime", "direction", "toxic_flow", "setup_quality", "risk_state")},
            "required": ["regime", "direction", "toxic_flow", "setup_quality", "risk_state"],
            "additionalProperties": False,
        },
        "drop_directions": {"type": "array", "items": {"type": "string", "enum": ["long", "short"]}},
        "rationale": {"type": "string"},
    },
    "required": ["instructions", "drop_directions", "rationale"],
    "additionalProperties": False,
}

ESCALATION_SYSTEM = (
    "You are the risk-review brain of an automated crypto trading system. A fast model flagged "
    "low confidence or a crisis regime for one symbol. You receive the thesis, the latest numeric "
    "snapshots and the fast model's outputs. Decide whether new entries for this symbol should stay "
    "frozen, be cleared (the normal code gates still apply afterwards), or whether existing exposure "
    "should be reduced. You cannot open positions or change limits. When evidence is ambiguous, "
    "prefer stay_frozen: missing a trade is cheap, a bad one in a crisis is not."
)

REWRITE_SYSTEM = (
    "You maintain the instruction text of a typed decision schema used by a fast classifier on every "
    "candle. You receive last session's calibration report (Brier scores, reliability bins, P&L after "
    "costs, missed and taken trades). Rewrite the five instruction strings to fix the observed "
    "miscalibration. Keep each under 1000 characters, reference only fields present in the snapshot "
    "(mid spr imb dep r1 rN rv flow inv upnl dd dpnl), and do not change the answer options. You may "
    "list directions to drop for this symbol if the evidence says they lose after costs."
)


@dataclass(frozen=True)
class BrainVerdict:
    action: str   # stay_frozen | clear | reduce
    reason: str


class Brain(Protocol):
    def review_escalation(self, payload: dict) -> BrainVerdict: ...
    def propose_rewrite(self, payload: dict) -> dict | None: ...


class FailClosedBrain:
    """Default when no API key: never clears a freeze, never rewrites."""

    def review_escalation(self, payload: dict) -> BrainVerdict:
        return BrainVerdict("stay_frozen", "no brain configured; fail closed")

    def propose_rewrite(self, payload: dict) -> dict | None:
        return None


class OpusBrain:
    def __init__(self, timeout_s: float = 120.0):
        import anthropic  # optional dependency: pip install anthropic

        self._anthropic = anthropic
        self._client = anthropic.Anthropic(timeout=timeout_s, max_retries=2)

    def _ask(self, system: str, payload: dict, schema: dict, effort: str) -> dict | None:
        a = self._anthropic
        try:
            resp = self._client.messages.create(
                model=MODEL,
                max_tokens=16000,
                system=system,
                messages=[{"role": "user", "content": json.dumps(payload, sort_keys=True)}],
                output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
            )
        except (a.RateLimitError, a.APIStatusError, a.APIConnectionError):
            return None
        if resp.stop_reason != "end_turn":
            return None  # refusal / max_tokens -> fail closed
        text = next((b.text for b in resp.content if b.type == "text"), None)
        if text is None:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    def review_escalation(self, payload: dict) -> BrainVerdict:
        out = self._ask(ESCALATION_SYSTEM, payload, VERDICT_SCHEMA, effort="high")
        if not out or out.get("action") not in ("stay_frozen", "clear", "reduce"):
            return BrainVerdict("stay_frozen", "brain unavailable or invalid; fail closed")
        return BrainVerdict(out["action"], str(out.get("reason", ""))[:500])

    def propose_rewrite(self, payload: dict) -> dict | None:
        return self._ask(REWRITE_SYSTEM, payload, REWRITE_SCHEMA, effort="xhigh")


def make_brain() -> Brain:
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        try:
            return OpusBrain()
        except ImportError:
            pass
    return FailClosedBrain()
