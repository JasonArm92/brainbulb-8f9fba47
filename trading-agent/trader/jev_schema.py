"""Typed Jev decision schema: definition, validation, compile, versioning.

The *shape* of the schema is fixed in code (question names, types, option
sets). The nightly review may only rewrite natural-language `instructions`
and may only *narrow* `allowed_directions`. `validate_revision` enforces that.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

REGIMES = ("trending", "mean_reverting", "high_vol", "crisis")
DIRECTIONS = ("long", "short", "neutral")
RISK_STATES = ("safe", "near_limit", "reduce")
SETUP_LEVELS = 4  # Score levels 0..3

QUESTION_SHAPE: dict[str, dict[str, Any]] = {
    "regime": {"type": "choice", "options": list(REGIMES)},
    "direction": {"type": "choice", "options": list(DIRECTIONS)},
    "toxic_flow": {"type": "noul"},
    "setup_quality": {"type": "score", "levels": SETUP_LEVELS},
    "risk_state": {"type": "choice", "options": list(RISK_STATES)},
}

DEFAULT_INSTRUCTIONS = {
    "regime": (
        "Classify the current market regime from the snapshot. trending: rN and r1 agree in sign and "
        "rN magnitude is large relative to rv. mean_reverting: rN small vs rv, price oscillating. "
        "high_vol: rv elevated, spread widening, depth thinning. crisis: extreme rv, very wide spread, "
        "collapsing depth or dd near limits."
    ),
    "direction": (
        "Given the thesis context and the snapshot, which direction has positive expected value over "
        "the next bars AFTER fees and slippage? Answer neutral unless the evidence is clear."
    ),
    "toxic_flow": (
        "Is current order flow likely informed/toxic, meaning a passive or new position would be "
        "adversely selected (e.g. one-sided aggressive flow against the book, thinning depth, widening spread)?"
    ),
    "setup_quality": (
        "Rate the setup for this thesis right now: 0 no setup, 1 weak, 2 valid with acceptable "
        "risk/reward after costs, 3 strong with confluence of flow, book and trend."
    ),
    "risk_state": (
        "Given inventory, unrealized P&L, drawdown and daily P&L in the snapshot, is it safe to add risk, "
        "near a limit, or should exposure be reduced?"
    ),
}


class SchemaError(ValueError):
    pass


@dataclass(frozen=True)
class CompiledSchema:
    version: int
    symbol: str
    finalist: str
    context: str
    questions: dict[str, dict[str, Any]]
    allowed_directions: tuple[str, ...]

    def to_json(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "symbol": self.symbol,
            "finalist": self.finalist,
            "context": self.context,
            "questions": self.questions,
            "allowed_directions": list(self.allowed_directions),
        }

    @staticmethod
    def from_json(d: dict[str, Any]) -> "CompiledSchema":
        s = CompiledSchema(
            version=int(d["version"]),
            symbol=d["symbol"],
            finalist=d["finalist"],
            context=d["context"],
            questions=d["questions"],
            allowed_directions=tuple(d["allowed_directions"]),
        )
        validate_shape(s)
        return s


def validate_shape(s: CompiledSchema) -> None:
    if set(s.questions) != set(QUESTION_SHAPE):
        raise SchemaError(f"questions must be exactly {sorted(QUESTION_SHAPE)}")
    for name, shape in QUESTION_SHAPE.items():
        q = s.questions[name]
        for k, v in shape.items():
            if q.get(k) != v:
                raise SchemaError(f"{name}.{k} must be {v!r}, got {q.get(k)!r}")
        if not isinstance(q.get("instructions"), str) or not q["instructions"].strip():
            raise SchemaError(f"{name} needs non-empty instructions")
        if len(q["instructions"]) > 1200:
            raise SchemaError(f"{name} instructions too long")
    if not set(s.allowed_directions) <= set(DIRECTIONS) or "neutral" not in s.allowed_directions:
        raise SchemaError("allowed_directions must be a subset of DIRECTIONS and include neutral")
    if len(s.context) > 800:
        raise SchemaError("context too long; keep the thesis summary tight")


def compile_schema(finalist: dict[str, Any], version: int = 1) -> CompiledSchema:
    """Compile a research finalist (research/finalists.json entry) into a Jev schema."""
    context = (
        f"{finalist['name']} thesis: {finalist['thesis_short']} "
        f"Invalidate if: {finalist['invalidation_short']}"
    )
    questions = {
        name: {**shape, "instructions": DEFAULT_INSTRUCTIONS[name]}
        for name, shape in QUESTION_SHAPE.items()
    }
    s = CompiledSchema(
        version=version,
        symbol=finalist["symbol"],
        finalist=finalist["name"],
        context=context,
        questions=questions,
        allowed_directions=tuple(finalist["allowed_directions"]),
    )
    validate_shape(s)
    return s


def validate_revision(old: CompiledSchema, new: CompiledSchema) -> None:
    """A nightly rewrite may change wording only, and may only narrow directions."""
    validate_shape(new)
    if new.symbol != old.symbol or new.finalist != old.finalist:
        raise SchemaError("revision cannot change symbol/finalist")
    if new.version != old.version + 1:
        raise SchemaError("revision must bump version by exactly 1")
    if not set(new.allowed_directions) <= set(old.allowed_directions):
        raise SchemaError("revision may only narrow allowed_directions (widening needs operator)")


def schema_path(schema_dir: str, symbol: str, version: int) -> str:
    return os.path.join(schema_dir, f"{symbol}.v{version}.json")


def save(schema: CompiledSchema, schema_dir: str) -> str:
    os.makedirs(schema_dir, exist_ok=True)
    path = schema_path(schema_dir, schema.symbol, schema.version)
    if os.path.exists(path):
        raise SchemaError(f"{path} exists; schema versions are immutable")
    with open(path, "w") as f:
        json.dump(schema.to_json(), f, indent=2, sort_keys=True)
        f.write("\n")
    return path


def load_latest(schema_dir: str, symbol: str) -> CompiledSchema:
    prefix = f"{symbol}.v"
    versions = [
        int(f[len(prefix):-5])
        for f in os.listdir(schema_dir)
        if f.startswith(prefix) and f.endswith(".json")
    ]
    if not versions:
        raise FileNotFoundError(f"no schema for {symbol} in {schema_dir}")
    with open(schema_path(schema_dir, symbol, max(versions))) as f:
        return CompiledSchema.from_json(json.load(f))
