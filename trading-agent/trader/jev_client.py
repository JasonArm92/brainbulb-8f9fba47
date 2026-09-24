"""Reflex decision engines.

`DecisionEngine` is the only interface the live loop uses. Implementations:

* `JevEngine`   - TypeSafe Jev System One model (key from console.typesafe.ai,
                  env TYPESAFE_API_KEY). All SDK touch points live in
                  `_call_sdk` / `_parse`; verify them against docs.typesafe.ai
                  before enabling live (they were written from public docs
                  summaries, not tested against the real endpoint).
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
class JevEngine:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("TYPESAFE_API_KEY")
        if not self.api_key:
            raise RuntimeError("TYPESAFE_API_KEY not set (get one at console.typesafe.ai)")
        try:
            import typesafe  # type: ignore  # pip install typesafe-sdk
        except ImportError as e:  # pragma: no cover - optional dependency
            raise RuntimeError("pip install typesafe-sdk to use JevEngine") from e
        self._sdk = typesafe
        self._client = typesafe.TypeSafeClient(api_key=self.api_key)

    def decide(self, snapshot: Snapshot, schema: CompiledSchema) -> Decision:
        t0 = time.perf_counter()
        raw = self._call_sdk(snapshot, schema)
        return self._parse(raw, snapshot, schema, (time.perf_counter() - t0) * 1e3)

    def _call_sdk(self, snapshot: Snapshot, schema: CompiledSchema) -> Any:  # pragma: no cover
        sdk = self._sdk
        q = schema.questions
        questions = {
            "regime": sdk.Choice(instructions=q["regime"]["instructions"], criteria=q["regime"]["options"]),
            "direction": sdk.Choice(instructions=q["direction"]["instructions"], criteria=q["direction"]["options"]),
            "toxic_flow": sdk.Noul(instructions=q["toxic_flow"]["instructions"]),
            "setup_quality": sdk.Score(instructions=q["setup_quality"]["instructions"], levels=q["setup_quality"]["levels"]),
            "risk_state": sdk.Choice(instructions=q["risk_state"]["instructions"], criteria=q["risk_state"]["options"]),
        }
        state = f"{schema.context}\n{snapshot.to_prompt()}"
        return self._client.system_one(state=state, questions=questions)

    @staticmethod
    def _get(obj: Any, *names: str) -> Any:
        for n in names:
            if isinstance(obj, dict) and n in obj:
                return obj[n]
            if hasattr(obj, n):
                return getattr(obj, n)
        raise InvalidDecision(f"response missing any of {names}")

    def _parse(self, raw: Any, snapshot: Snapshot, schema: CompiledSchema, latency_ms: float) -> Decision:
        g = self._get
        answers = g(raw, "answers") if not isinstance(raw, dict) or "answers" in raw else raw
        reg, dirn, tox = g(answers, "regime"), g(answers, "direction"), g(answers, "toxic_flow")
        setup, risk = g(answers, "setup_quality"), g(answers, "risk_state")
        # Setup is a 0..3 scale. VERIFY: whether the SDK's score position is 0- or 1-based.
        sq = float(g(setup, "score", "value"))
        return Decision(
            symbol=snapshot.symbol,
            schema_version=schema.version,
            regime=str(g(reg, "choice", "value")),
            regime_conf=float(g(reg, "confidence")),
            direction=str(g(dirn, "choice", "value")),
            direction_conf=float(g(dirn, "confidence")),
            toxic_flow_p=float(tox) if isinstance(tox, (int, float)) else float(g(tox, "probability", "value")),
            setup_quality=sq,
            setup_conf=float(g(setup, "confidence")),
            risk_state=str(g(risk, "choice", "value")),
            risk_conf=float(g(risk, "confidence")),
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
