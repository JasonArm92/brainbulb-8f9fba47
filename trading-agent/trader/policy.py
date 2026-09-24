"""Policy: turn a typed Decision into an intent. Gates and sizing live here.

Jev judges; this module decides. Order of evaluation:
  1. no/invalid decision            -> HOLD
  2. deterministic exits (stop/TP)  -> EXIT (code-owned, never model-gated)
  3. escalation triggers            -> ESCALATE (+ REDUCE in crisis)
  4. risk_state == reduce           -> REDUCE
  5. opposite position              -> EXIT (no flip on the same bar)
  6. entry gate                     -> ENTER sized by capped fractional Kelly
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass, field

from .calibration import Calibrator
from .config import GateConfig, RiskLimits
from .decision import Decision
from .jev_schema import CompiledSchema
from .portfolio import Portfolio
from .risk import unit_beta
from .state_engine import Snapshot


@dataclass(frozen=True)
class Intent:
    kind: str                 # hold | enter | exit | reduce | escalate
    symbol: str
    side: str = ""            # buy | sell
    notional: float = 0.0
    reason: str = ""
    escalate: bool = False
    p_win: float = 0.0
    kelly: float = 0.0


@dataclass(frozen=True)
class ExitRules:
    min_stop_bps: float = 40.0
    stop_rv_mult: float = 3.0
    reward_risk: float = 1.5   # take-profit distance / stop distance
    crisis_reduce_frac: float = 0.5
    reduce_frac: float = 0.5


def kelly_fraction(p: float, b: float) -> float:
    """Full Kelly for a binary bet paying b:1 with win probability p."""
    if b <= 0:
        return 0.0
    return p - (1 - p) / b


@dataclass
class Policy:
    gate: GateConfig
    limits: RiskLimits
    calibrator: Calibrator
    exits: ExitRules = ExitRules()
    stops: dict[str, float] = field(default_factory=dict)  # symbol -> stop bps set at entry
    beta: Callable[[str], float] = unit_beta                 # same provider the risk layer uses

    def stop_bps(self, snap: Snapshot) -> float:
        return max(self.exits.min_stop_bps, self.exits.stop_rv_mult * snap.rv_bps)

    def evaluate(
        self,
        d: Decision | None,
        snap: Snapshot,
        portfolio: Portfolio,
        schema: CompiledSchema,
        frozen: bool = False,
        cost_bps: float = 0.0,
        funding_bps: dict[str, float] | None = None,
    ) -> Intent:
        sym = snap.symbol
        pos_notional = portfolio.notional(sym)
        has_pos = abs(pos_notional) > 1e-9
        close_side = "sell" if pos_notional > 0 else "buy"

        # 2. deterministic exits run even with no decision
        if has_pos:
            stop = self.stops.get(sym, self.stop_bps(snap))
            if snap.upnl_bps <= -stop:
                return Intent("exit", sym, close_side, abs(pos_notional), f"stop {snap.upnl_bps:.0f}bps")
            if snap.upnl_bps >= stop * self.exits.reward_risk:
                return Intent("exit", sym, close_side, abs(pos_notional), f"take-profit {snap.upnl_bps:.0f}bps")

        if d is None:
            return Intent("hold", sym, reason="no valid decision")

        # 3. escalation. Crisis always escalates. Low confidence escalates when we
        # hold exposure; when flat, low confidence already means "hold" and a
        # deep re-read would not change the action.
        g = self.gate
        low_conf = d.direction_conf < g.escalate_below_confidence
        if d.regime in g.escalate_regimes or (low_conf and has_pos):
            why = f"escalate: conf={d.direction_conf:.2f} regime={d.regime}"
            if d.regime in g.escalate_regimes and has_pos:
                return Intent("reduce", sym, close_side, abs(pos_notional) * self.exits.crisis_reduce_frac,
                              why + " (crisis de-risk)", escalate=True)
            return Intent("escalate", sym, reason=why, escalate=True)

        # 4. model says reduce
        if d.risk_state == "reduce" and has_pos:
            return Intent("reduce", sym, close_side, abs(pos_notional) * self.exits.reduce_frac, "risk_state=reduce")

        # 5. opposite position -> close first
        want = {"long": "buy", "short": "sell"}.get(d.direction)
        if has_pos and want and want == close_side:
            return Intent("exit", sym, close_side, abs(pos_notional), f"direction flipped to {d.direction}")

        # 6. entry gate
        fails = []
        if frozen:
            fails.append("symbol frozen pending brain review")
        if d.setup_quality < g.min_setup_quality:
            fails.append(f"setup {d.setup_quality:.2f}<{g.min_setup_quality}")
        if not d.direction_conf > g.min_direction_confidence:
            fails.append(f"conf {d.direction_conf:.2f}<={g.min_direction_confidence}")
        if d.risk_state != g.required_risk_state:
            fails.append(f"risk_state={d.risk_state}")
        if d.toxic_flow_p >= g.max_toxic_flow_prob:
            fails.append(f"toxic {d.toxic_flow_p:.2f}")
        if d.direction == "neutral" or want is None:
            fails.append("neutral")
        elif want == "sell" and not self.limits.allow_short and not has_pos:
            fails.append("down-bets not allowed (spot only)")
        elif d.direction not in schema.allowed_directions:
            fails.append(f"{d.direction} not allowed for {schema.finalist}")
        if low_conf:
            fails.append(f"low confidence {d.direction_conf:.2f}")
        if (self.limits.max_open_positions is not None and not has_pos
                and sum(1 for p in portfolio.positions.values() if abs(p.qty) > 1e-12) >= self.limits.max_open_positions):
            fails.append(f"no room: already holding {self.limits.max_open_positions} coins")
        if fails:
            return Intent("hold", sym, reason="; ".join(fails))

        # sizing: Kelly on our calibrated p_win, payoff net of round-trip costs and
        # the funding this side expects to PAY over the hold (never credited).
        fund = max(0.0, (funding_bps or {}).get(want, 0.0))
        stop = self.stop_bps(snap)
        win_bps = stop * self.exits.reward_risk - cost_bps - fund
        loss_bps = stop + cost_bps + fund
        b = win_bps / loss_bps if loss_bps > 0 else 0.0
        p = self.calibrator.p_win(d.direction_conf)
        f_star = kelly_fraction(p, b)
        if f_star <= 0 and g.require_edge_after_costs:
            return Intent("hold", sym, reason=f"no edge after costs p={p:.3f} b={b:.2f} funding={fund:.1f}bps",
                          p_win=p)
        if f_star <= 0:
            f_used = g.fixed_risk_frac                               # fast practice mode: small fixed risk
        else:
            f_used = min(g.kelly_fraction, g.kelly_cap) * f_star    # never above quarter Kelly
        equity = portfolio.equity()
        risk_capital = f_used * equity                               # capital lost if stopped
        notional = risk_capital / (loss_bps / 1e4)
        room = self.limits.max_position_frac * equity - abs(pos_notional)
        gross_room = self.limits.max_gross_frac * equity - portfolio.gross_notional()
        b_sym = max(1.0, self.beta(sym))
        beta_room = (self.limits.max_beta_gross_frac * equity
                     - portfolio.beta_gross_notional(lambda s: max(1.0, self.beta(s)))) / b_sym
        notional = max(0.0, min(notional, self.limits.max_order_frac * equity, room, gross_room, beta_room))
        if self.limits.require_cash and want == "buy":
            notional = min(notional, portfolio.cash * 0.98)             # keep a little back for fees
        if 0 < notional < self.limits.min_order_notional:
            return Intent("hold", sym, reason="no room: bet would be below the exchange minimum", p_win=p, kelly=f_star)
        if notional <= 0 or not math.isfinite(notional):
            return Intent("hold", sym, reason="no room under position/gross/beta-gross limit", p_win=p, kelly=f_star)
        self.stops[sym] = stop
        return Intent("enter", sym, want, notional,
                      f"gate pass p={p:.3f} b={b:.2f} f*={f_star:.3f} funding={fund:.1f}bps",
                      p_win=p, kelly=f_star)
