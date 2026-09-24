"""Portfolio accounting: cash, positions, equity, drawdown, daily P&L.

Pure bookkeeping. All numbers the risk layer depends on are computed here, in
code, from fills and marks. Nothing here consults a model.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Position:
    qty: float = 0.0
    avg_price: float = 0.0


@dataclass
class Portfolio:
    cash: float
    positions: dict[str, Position] = field(default_factory=dict)
    marks: dict[str, float] = field(default_factory=dict)
    peak_equity: float = 0.0
    day_start_equity: float = 0.0
    day: str = ""
    fees_paid: float = 0.0
    funding_paid: float = 0.0             # net: + paid, - received

    def __post_init__(self) -> None:
        eq = self.equity()
        self.peak_equity = self.peak_equity or eq
        self.day_start_equity = self.day_start_equity or eq

    # --- marks -----------------------------------------------------------
    def mark(self, symbol: str, price: float) -> None:
        if price <= 0:
            raise ValueError(f"non-positive mark for {symbol}: {price}")
        self.marks[symbol] = price
        self.peak_equity = max(self.peak_equity, self.equity())

    def roll_day(self, day: str) -> None:
        """Call on every tick with the UTC date; resets daily loss baseline."""
        if day != self.day:
            self.day = day
            self.day_start_equity = self.equity()

    # --- fills -----------------------------------------------------------
    def apply_fill(self, symbol: str, side: str, qty: float, price: float, fee: float) -> None:
        if qty <= 0 or price <= 0:
            raise ValueError("fill qty and price must be positive")
        signed = qty if side == "buy" else -qty
        pos = self.positions.setdefault(symbol, Position())
        new_qty = pos.qty + signed
        if pos.qty == 0 or (pos.qty > 0) == (signed > 0):
            # opening or adding
            total = abs(pos.qty) + qty
            pos.avg_price = (pos.avg_price * abs(pos.qty) + price * qty) / total
        elif abs(signed) > abs(pos.qty):
            # flipping through zero
            pos.avg_price = price
        elif new_qty == 0:
            pos.avg_price = 0.0
        pos.qty = new_qty
        self.cash -= signed * price + fee
        self.fees_paid += fee
        self.marks.setdefault(symbol, price)
        self.peak_equity = max(self.peak_equity, self.equity())

    def apply_funding(self, symbol: str, rate: float) -> float:
        """One perp funding settlement. Positive rate: longs pay, shorts receive."""
        pos = self.positions.get(symbol)
        if not pos or pos.qty == 0:
            return 0.0
        payment = self.notional(symbol) * rate
        self.cash -= payment
        self.funding_paid += payment
        return payment

    # --- derived ---------------------------------------------------------
    def notional(self, symbol: str) -> float:
        pos = self.positions.get(symbol)
        if not pos or pos.qty == 0:
            return 0.0
        return pos.qty * self.marks.get(symbol, pos.avg_price)

    def gross_notional(self) -> float:
        return sum(abs(self.notional(s)) for s in self.positions)

    def beta_gross_notional(self, beta, override: tuple[str, float] | None = None) -> float:
        """Sum of |notional| x beta. `override=(symbol, notional)` swaps in a post-trade value."""
        syms = set(self.positions) | ({override[0]} if override else set())
        total = 0.0
        for s in syms:
            n = override[1] if override and s == override[0] else self.notional(s)
            total += abs(n) * beta(s)
        return total

    def equity(self) -> float:
        return self.cash + sum(self.notional(s) for s in self.positions)

    def drawdown(self) -> float:
        peak = max(self.peak_equity, 1e-12)
        return max(0.0, (peak - self.equity()) / peak)

    def daily_pnl_frac(self) -> float:
        base = max(self.day_start_equity, 1e-12)
        return (self.equity() - self.day_start_equity) / base

    def unrealized_bps(self, symbol: str) -> float:
        pos = self.positions.get(symbol)
        if not pos or pos.qty == 0 or pos.avg_price == 0:
            return 0.0
        mark = self.marks.get(symbol, pos.avg_price)
        sign = 1 if pos.qty > 0 else -1
        return sign * (mark - pos.avg_price) / pos.avg_price * 1e4
