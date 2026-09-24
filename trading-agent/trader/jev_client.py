"""Reflex decision engines.

`DecisionEngine` is the only interface the live loop uses. Implementations:

* `JevEngine`   - TypeSafe Jev System One model (key from console.typesafe.ai,
                  env TYPESAFE_API_KEY). SDK touch points (`build_questions`,
                  `_call_sdk`, `_parse`) were checked against docs.typesafe.ai on
                  2026-09-24 and are covered by tests with documented response
                  shapes. Not yet run against the live endpoint.
* `SimulatedEngine` - deterministic heuristic stand-in for offline tests and
                  backtests. It is NOT an edge; it exists so the plumbing,
                  gating and risk layer can be tested end to end.

`decide_batch` evaluates every finalist concurrently (one dispatch per
candle); a timeout or any error for a symbol yields None -> hold.
"""

from __future__ import annotations

import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, wait
from typing import Any, Protocol

from .decision import Decision, InvalidDecision
from .jev_schema import CompiledSchema
from .state_engine import Snapshot


class DecisionEngine(Protocol):
    def decide(self, snapshot: Snapshot, schema: CompiledSchema) -> Decision: ...


def decide_batch(
    engine: DecisionEngine,
    items: list[tuple[Snapshot, CompiledSchema]],
    timeout_s: float = 0.5,
    pool: ThreadPoolExecutor | None = None,
) -> dict[str, Decision | None]:
    own = pool is None
    pool = pool or ThreadPoolExecutor(max_workers=max(1, len(items)))
    try:
        futs = {pool.submit(engine.decide, snap, sch): snap.symbol for snap, sch in items}
        done, _ = wait(futs, timeout=timeout_s)
        out: dict[str, Decision | None] = {}
        for fut, sym in futs.items():
            if fut not in done:
                out[sym] = None
                fut.cancel()
                continue
            try:
                out[sym] = fut.result()
            except Exception:  # invalid output, network, SDK error: all -> hold
                out[sym] = None
        return out
    finally:
        if own:
            pool.shutdown(wait=False, cancel_futures=True)


# ---------------------------------------------------------------------------
# Verified against docs.typesafe.ai on 2026-09-24 (Python SDK pages: sdk/python,
# api/clients/sync, api/types/questions, api/types/responses, api/retries).
#   package  : pip install typesafe-sdk   -> import typesafe_sdk
#   client   : TypeSafeClient(api_key=..., timeout=..., retry=RetryPolicy(...))
#   call     : client.system_one(state=..., questions={name: Question})
#   Choice   : criteria = Mapping[label, description | None]   (required)
#   Score    : criteria = ordered list, one entry per score FROM ZERO (0-based)
#   Noul     : instructions only; answer field is `.noul` (P(yes), 0..1)
#   response : SystemOneResponse.answers[name] ->
#                ChoiceAnswer(choice, confidence, probabilities)
#                ScoreAnswer(score: float expected value, may fall between levels,
#                            confidence, probabilities, legend)
#                NoulAnswer(noul)
# Still untested against the live endpoint (no API key in this build).

# Pinned, not "jev-latest": the calibrator is fitted to one model's outputs, so a silent
# alias move would invalidate it. Changing this is a reviewed code change.
JEV_MODEL = "jev-1.13.0"

SETUP_RUBRIC = (
    "0: no setup",
    "1: weak setup",
    "2: valid setup with acceptable risk/reward after costs",
    "3: strong setup with confluence of flow, book and trend",
)


class JevEngine:
    def __init__(
        self,
        api_key: str | None = None,
        *,
        timeout_s: float = 0.5,
        model: str = JEV_MODEL,
        sdk: Any = None,
        client: Any = None,
    ):
        """`sdk`/`client` exist so tests can inject doubles; production passes neither."""
        if sdk is None:
            try:
                import typesafe_sdk as sdk  # type: ignore  # pip install typesafe-sdk
            except ImportError as e:  # pragma: no cover - optional dependency
                raise RuntimeError("pip install typesafe-sdk to use JevEngine") from e
        self._sdk = sdk
        if client is None:
            self.api_key = api_key or os.environ.get("TYPESAFE_API_KEY")
            if not self.api_key:
                raise RuntimeError("TYPESAFE_API_KEY not set (get one at console.typesafe.ai)")
            # No SDK retries: the loop has a 500 ms budget and a timeout means hold.
            client = sdk.TypeSafeClient(
                api_key=self.api_key,
                model=model,
                timeout=timeout_s,
                retry=sdk.RetryPolicy(max_retries=0, timeout=timeout_s),
            )
        self._client = client

    def close(self) -> None:
        close = getattr(self._client, "close", None)
        if callable(close):
            close()

    def decide(self, snapshot: Snapshot, schema: CompiledSchema) -> Decision:
        t0 = time.perf_counter()
        raw = self._call_sdk(snapshot, schema)
        return self._parse(raw, snapshot, schema, (time.perf_counter() - t0) * 1e3)

    def build_questions(self, schema: CompiledSchema) -> dict[str, Any]:
        sdk = self._sdk
        q = schema.questions
        levels = int(q["setup_quality"]["levels"])
        rubric = list(SETUP_RUBRIC) if levels == len(SETUP_RUBRIC) else [str(i) for i in range(levels)]

        def choice(name: str) -> Any:
            return sdk.Choice(
                instructions=q[name]["instructions"],
                criteria={opt: None for opt in q[name]["options"]},
            )

        return {
            "regime": choice("regime"),
            "direction": choice("direction"),
            "toxic_flow": sdk.Noul(instructions=q["toxic_flow"]["instructions"]),
            "setup_quality": sdk.Score(instructions=q["setup_quality"]["instructions"], criteria=rubric),
            "risk_state": choice("risk_state"),
        }

    def _call_sdk(self, snapshot: Snapshot, schema: CompiledSchema) -> Any:
        state = f"{schema.context}\n{snapshot.to_prompt()}"
        return self._client.system_one(state=state, questions=self.build_questions(schema))

    @staticmethod
    def _field(obj: Any, name: str) -> Any:
        if isinstance(obj, dict):
            if name in obj:
                return obj[name]
        elif hasattr(obj, name):
            return getattr(obj, name)
        raise InvalidDecision(f"response missing {name!r}")

    def _parse(self, raw: Any, snapshot: Snapshot, schema: CompiledSchema, latency_ms: float) -> Decision:
        f = self._field
        answers = f(raw, "answers")

        def ans(name: str, kind: str) -> Any:
            a = f(answers, name)
            t = a.get("type") if isinstance(a, dict) else getattr(a, "type", kind)
            if t != kind:
                raise InvalidDecision(f"{name}: expected {kind} answer, got {t!r}")
            return a

        reg, dirn, risk = ans("regime", "choice"), ans("direction", "choice"), ans("risk_state", "choice")
        tox, setup = ans("toxic_flow", "noul"), ans("setup_quality", "score")
        for name, a in (("regime", reg), ("direction", dirn), ("risk_state", risk)):
            if f(a, "choice") not in schema.questions[name]["options"]:
                raise InvalidDecision(f"{name}: {f(a, 'choice')!r} not in schema options")
        # Score is 0-based per the docs, so it maps straight onto setup 0..3.
        return Decision(
            symbol=snapshot.symbol,
            schema_version=schema.version,
            regime=str(f(reg, "choice")),
            regime_conf=float(f(reg, "confidence")),
            direction=str(f(dirn, "choice")),
            direction_conf=float(f(dirn, "confidence")),
            toxic_flow_p=float(f(tox, "noul")),
            setup_quality=float(f(setup, "score")),
            setup_conf=float(f(setup, "confidence")),
            risk_state=str(f(risk, "choice")),
            risk_conf=float(f(risk, "confidence")),
            latency_ms=latency_ms,
        )


# ---------------------------------------------------------------------------
class SimulatedEngine:
    """Deterministic stand-in. Maps snapshot features to typed outputs."""

    def decide(self, s: Snapshot, schema: CompiledSchema) -> Decision:
        rv = max(s.rv_bps, 1e-6)
        trend_z = s.ret_n_bps / (rv * math.sqrt(30))
        if rv > 150 or s.spread_bps > 50:
            regime, rconf = "crisis", 0.9
        elif rv > 60:
            regime, rconf = "high_vol", 0.75
        elif abs(trend_z) > 1.0:
            regime, rconf = "trending", min(0.95, 0.6 + 0.1 * abs(trend_z))
        else:
            regime, rconf = "mean_reverting", 0.7

        signal = 0.6 * math.tanh(trend_z) + 0.25 * s.imbalance + 0.15 * s.flow_imb
        if abs(signal) < 0.2:
            direction = "neutral"
        else:
            direction = "long" if signal > 0 else "short"
        dconf = 0.5 + 0.5 * min(1.0, abs(signal))

        toxic = 1 / (1 + math.exp(-(abs(s.flow_imb) * 4 + s.spread_bps / 10 - 3)))
        setup = max(0.0, min(3.0, abs(signal) * 3.5 - (1.0 if regime in ("crisis", "high_vol") else 0.0)))

        if s.drawdown > 0.10 or s.day_pnl < -0.02:
            risk = "reduce"
        elif s.drawdown > 0.05 or abs(s.inventory) > 0.08:
            risk = "near_limit"
        else:
            risk = "safe"
        return Decision(
            symbol=s.symbol, schema_version=schema.version,
            regime=regime, regime_conf=rconf,
            direction=direction, direction_conf=dconf,
            toxic_flow_p=toxic, setup_quality=setup, setup_conf=0.7,
            risk_state=risk, risk_conf=0.8, latency_ms=0.0,
        )
