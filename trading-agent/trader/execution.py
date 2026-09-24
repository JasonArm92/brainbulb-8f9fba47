"""Execution: broker interface, paper broker with costs, and the risk guard.

`RiskGuardedBroker` is the only broker the loop is handed. Every submit goes
through `RiskManager.check` first; there is no other path to a venue.

Live venue adapters are intentionally NOT shipped. Going live is an operator
gate (see docs/agenkit/06-ship.md), not a config flag.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .config import CostModel
from .portfolio import Portfolio
from .risk import Order, RiskManager, RiskVerdict
from .state_engine import BookUpdate, Snapshot


@dataclass(frozen=True)
class Fill:
    symbol: str
    side: str
    qty: float
    price: float
    fee: float
    slippage_bps: float


@dataclass(frozen=True)
class ExecResult:
    order: Order
    verdict: RiskVerdict
    fill: Fill | None
    note: str = ""


class Broker(Protocol):
    def execute(self, order: Order, book: BookUpdate) -> Fill | None: ...


class PaperBroker:
    """Marketable-limit IOC against the top-of-book with a depth impact model."""

    def __init__(self, costs: CostModel):
        self.costs = costs

    def execute(self, order: Order, book: BookUpdate) -> Fill | None:
        levels = book.asks if order.side == "buy" else book.bids
        touch = levels[0][0]
        top_depth_qty = sum(q for _, q in levels[:5]) or 1e-12
        impact_bps = max(
            self.costs.min_slippage_bps,
            self.costs.slippage_bps_per_frac_of_depth * order.qty / top_depth_qty,
        )
        sign = 1 if order.side == "buy" else -1
        px = touch * (1 + sign * impact_bps / 1e4)
        if (order.side == "buy" and px > order.limit_price) or (order.side == "sell" and px < order.limit_price):
            return None  # would breach limit -> miss
        fee = abs(order.qty * px) * self.costs.taker_fee_bps / 1e4
        mid = (book.bids[0][0] + book.asks[0][0]) / 2
        slip = sign * (px - mid) / mid * 1e4
        return Fill(order.symbol, order.side, order.qty, px, fee, slip)


class RiskGuardedBroker:
    def __init__(self, broker: Broker, risk: RiskManager, portfolio: Portfolio):
        self._broker = broker
        self._risk = risk
        self._portfolio = portfolio

    def submit(self, order: Order, snap: Snapshot, book: BookUpdate, now: float) -> ExecResult:
        verdict = self._risk.check(order, self._portfolio, snap, now)
        if not verdict.ok:
            return ExecResult(order, verdict, None, "rejected by risk")
        fill = self._broker.execute(order, book)
        if fill is None:
            return ExecResult(order, verdict, None, "no fill within limit")
        self._portfolio.apply_fill(fill.symbol, fill.side, fill.qty, fill.price, fill.fee)
        self._risk.update(self._portfolio)
        return ExecResult(order, verdict, fill)
