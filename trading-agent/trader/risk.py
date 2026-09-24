"""Hard deterministic risk layer. The model can never override it.

`RiskManager.check` runs immediately before every order reaches a broker (see
`execution.RiskGuardedBroker`). It sees orders, the portfolio and the market
snapshot. It never sees a model Decision, so no model output can reach it.

Kill switch semantics:
  * KILL file present (operator)  -> every order rejected, including reduce-only.
  * tripped (max drawdown breach) -> latched; only reduce-only orders allowed
                                      until an operator calls `reset`.
  * daily loss limit breached     -> reduce-only until the UTC day rolls.
"""

from __future__ import annotations

import math
import os
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field

from .config import RiskLimits
from .portfolio import Portfolio
from .state_engine import Snapshot


@dataclass(frozen=True)
class Order:
    symbol: str
    side: str            # "buy" | "sell"
    qty: float
    limit_price: float
    reduce_only: bool = False
    client_id: str = ""
    reason: str = ""


@dataclass(frozen=True)
class RiskVerdict:
    ok: bool
    reasons: tuple[str, ...] = ()


def unit_beta(symbol: str) -> float:
    return 1.0


@dataclass
class RiskManager:
    limits: RiskLimits
    # Beta-to-BTC per symbol, from market prices (trader/correlation.py). Values
    # below 1.0 are clamped up here as well, so a faulty provider cannot loosen
    # the cap below the raw gross limit.
    beta: Callable[[str], float] = unit_beta
    tripped: bool = False
    trip_reason: str = ""
    _order_times: deque = field(default_factory=lambda: deque(maxlen=1000))

    # --- kill switch -----------------------------------------------------
    def kill_file_present(self) -> bool:
        return os.path.exists(self.limits.kill_switch_path)

    def trip(self, reason: str) -> None:
        if not self.tripped:
            self.tripped = True
            self.trip_reason = reason

    def reset(self, operator_ack: str) -> None:
        """Operator-only. Requires an explicit acknowledgement string."""
        if operator_ack != "I have reviewed the drawdown and accept restart":
            raise PermissionError("operator acknowledgement required")
        self.tripped = False
        self.trip_reason = ""

    def update(self, portfolio: Portfolio) -> None:
        """Call on every tick; latches the kill switch on a drawdown breach."""
        if portfolio.drawdown() >= self.limits.max_drawdown:
            self.trip(f"max drawdown {portfolio.drawdown():.2%} >= {self.limits.max_drawdown:.0%}")

    def halted_for_new_risk(self, portfolio: Portfolio) -> bool:
        return (
            self.kill_file_present()
            or self.tripped
            or portfolio.daily_pnl_frac() <= -self.limits.max_daily_loss
        )

    def safe_beta(self, symbol: str) -> float:
        try:
            b = float(self.beta(symbol))
        except Exception:
            return 3.0  # provider failure: assume the worst
        if not math.isfinite(b):
            return 3.0
        return max(1.0, b)

    # --- pre-trade check -------------------------------------------------
    def check(self, order: Order, portfolio: Portfolio, snap: Snapshot, now: float) -> RiskVerdict:
        self.update(portfolio)
        L = self.limits
        r: list[str] = []

        if self.kill_file_present():
            return RiskVerdict(False, ("KILL switch file present",))

        if order.side not in ("buy", "sell"):
            r.append(f"bad side {order.side!r}")
        if not (math.isfinite(order.qty) and order.qty > 0):
            r.append("qty must be finite and > 0")
        if not (math.isfinite(order.limit_price) and order.limit_price > 0):
            r.append("limit price must be finite and > 0")
        if r:
            return RiskVerdict(False, tuple(r))

        if snap.symbol != order.symbol:
            r.append("snapshot/order symbol mismatch")
        if now - snap.data_ts > L.max_snapshot_age_s:
            r.append(f"stale market data ({now - snap.data_ts:.1f}s)")
        dev_bps = abs(order.limit_price - snap.mid) / snap.mid * 1e4
        if dev_bps > L.max_price_deviation_bps:
            r.append(f"limit {dev_bps:.0f}bps from mid > {L.max_price_deviation_bps:.0f}")

        equity = portfolio.equity()
        if equity <= 0:
            return RiskVerdict(False, ("non-positive equity",))

        # Exposure is judged in quantity space (sign-safe), valued at mid.
        pos = portfolio.positions.get(order.symbol)
        cur_qty = pos.qty if pos else 0.0
        post_qty = cur_qty + (order.qty if order.side == "buy" else -order.qty)
        cur = cur_qty * snap.mid
        post = post_qty * snap.mid
        order_notional = order.qty * order.limit_price  # worst-case fill price
        reduces = (
            cur_qty != 0
            and abs(post_qty) < abs(cur_qty) - 1e-12
            and (abs(post_qty) < 1e-12 or math.copysign(1, post_qty) == math.copysign(1, cur_qty))
        )

        if order.reduce_only and not reduces:
            r.append("reduce_only order would not reduce exposure")

        if not L.allow_short and post_qty < -1e-12:
            r.append("short selling is not allowed (spot only)")

        if not reduces:
            if self.tripped:
                r.append(f"kill switch tripped: {self.trip_reason}")
            if portfolio.daily_pnl_frac() <= -L.max_daily_loss:
                r.append(f"daily loss {portfolio.daily_pnl_frac():.2%} breached limit")
            if order_notional > L.max_order_frac * equity + 1e-9:
                r.append("order notional exceeds max_order_frac")
            if abs(post) > L.max_position_frac * equity + 1e-9:
                r.append("post-trade position exceeds max_position_frac")
            gross_post = portfolio.gross_notional() - abs(cur) + abs(post)
            if gross_post > L.max_gross_frac * equity + 1e-9:
                r.append("post-trade gross exposure exceeds max_gross_frac")
            if L.require_cash and order.side == "buy" and order_notional > portfolio.cash + 1e-9:
                r.append("not enough cash to pay for this buy")
            if L.max_open_positions is not None and cur_qty == 0:
                held = sum(1 for p in portfolio.positions.values() if abs(p.qty) > 1e-12)
                if held >= L.max_open_positions:
                    r.append(f"already holding the maximum of {L.max_open_positions} coins")
            if order_notional < L.min_order_notional - 1e-12:
                r.append("order below the exchange minimum")
            beta_post = portfolio.beta_gross_notional(self.safe_beta, override=(order.symbol, post))
            if beta_post > L.max_beta_gross_frac * equity + 1e-9:
                r.append("post-trade beta-weighted gross exceeds max_beta_gross_frac")

        recent = [t for t in self._order_times if now - t < 60]
        if len(recent) >= L.max_orders_per_minute:
            r.append("order rate limit")

        if r:
            return RiskVerdict(False, tuple(r))
        self._order_times.append(now)
        return RiskVerdict(True)
