"""Perpetual-swap funding: a sizing cost and a P&L cash flow.

Convention (OKX, Binance, Bybit, Hyperliquid): a positive rate means longs pay
shorts. Payment per settlement = position notional x rate.

Two uses, deliberately asymmetric:

* **Sizing** (`expected_cost_bps`) is pessimistic. It charges the side that
  would pay, uses the worse of the latest rate and the recent mean, and never
  credits funding the position would receive. A short into a positive-funding
  market does not get a bigger size because it expects to be paid. Funding can
  flip within one interval, and a squeeze usually flips it.
* **Accounting** (`settle`) is exact. Paid and received funding both move cash,
  so replay and paper P&L match what a venue would book.

Rates come from the venue feed or a recorded tape, never from a model.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from .portfolio import Portfolio


@dataclass(frozen=True)
class FundingConfig:
    expected_hold_hours: float = 24.0     # sizing horizon; longer = more conservative
    window: int = 21                      # settlements averaged (7 days at 8h)
    # Rate assumed when a symbol has no observations yet: 0.01% per 8h, the
    # common venue baseline, charged to BOTH sides. Unknown is never free.
    unknown_abs_rate_per_8h: float = 0.0001
    default_interval_h: float = 8.0


@dataclass(frozen=True)
class FundingEvent:
    ts: float
    symbol: str
    rate: float                           # per settlement interval, signed
    interval_h: float = 8.0


@dataclass
class FundingBook:
    cfg: FundingConfig = field(default_factory=FundingConfig)
    _rates: dict[str, deque] = field(default_factory=dict)
    _interval: dict[str, float] = field(default_factory=dict)

    def observe(self, symbol: str, rate: float, interval_h: float | None = None) -> None:
        if rate != rate or abs(rate) > 0.05:  # NaN or >5% per interval: bad data, ignore
            return
        self._rates.setdefault(symbol, deque(maxlen=self.cfg.window)).append(rate)
        if interval_h:
            self._interval[symbol] = interval_h

    def interval_h(self, symbol: str) -> float:
        return self._interval.get(symbol, self.cfg.default_interval_h)

    def pessimistic_rate(self, symbol: str, side: str) -> float:
        """The rate the given side should plan for: the worse of latest and mean."""
        rs = self._rates.get(symbol)
        if not rs:
            u = self.cfg.unknown_abs_rate_per_8h * self.interval_h(symbol) / 8.0
            return u if side == "buy" else -u
        latest, mean = rs[-1], sum(rs) / len(rs)
        return max(latest, mean) if side == "buy" else min(latest, mean)

    def expected_cost_bps(self, symbol: str, side: str, hold_hours: float | None = None) -> float:
        """Expected funding paid over the hold, in bps of notional. Never negative."""
        hold = self.cfg.expected_hold_hours if hold_hours is None else hold_hours
        periods = max(0.0, hold) / self.interval_h(symbol)
        r = self.pessimistic_rate(symbol, side)
        paid_per_period = r if side == "buy" else -r
        return max(0.0, paid_per_period) * periods * 1e4

    def cost_by_side(self, symbol: str) -> dict[str, float]:
        return {s: self.expected_cost_bps(symbol, s) for s in ("buy", "sell")}

    @staticmethod
    def settle(portfolio: Portfolio, ev: FundingEvent) -> float:
        """Book one settlement. Returns cash paid (+) or received (-)."""
        return portfolio.apply_funding(ev.symbol, ev.rate)
