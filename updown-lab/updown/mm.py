"""Hedged market-making for one 5-minute window, plus the risk guardrails.

The idea: keep buying YES and NO below fair value. One YES plus one NO always pays exactly
£1 at resolution, whatever happens. If the pair costs less than £1 the difference is profit
("paired cost" below 1). Fills rarely arrive evenly, so inventory tilts to one side; the hedge
manager first skews quotes to attract the missing side, and if that is not enough (too big a
tilt, or too little time left) it crosses the spread and buys the missing side, paying
"hedge bleed". Anything still unpaired at the end rides on the outcome.

Risk guardrails (checked before every quote and every hedge):
  * per-window spend cap and unpaired (directional) exposure cap, plus an aggregate cap;
  * circuit breaker: too much hedge bleed or drawdown in a rolling hour halts quoting;
  * kill switch (file or phone): halts everything;
  * paper mode only (see config.assert_paper).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from .config import MMConfig, RiskConfig
from .simmarket import Book, floor_tick


@dataclass
class Inventory:
    yes_qty: float = 0.0
    yes_cost: float = 0.0          # USD, fees included
    no_qty: float = 0.0
    no_cost: float = 0.0
    hedge_bleed: float = 0.0       # USD paid above fair value when crossing
    fees: float = 0.0
    maker_fills: int = 0
    taker_fills: int = 0

    def add(self, side: str, price: float, qty: float, fee: float) -> None:
        if side == "YES":
            self.yes_qty += qty
            self.yes_cost += price * qty + fee
        else:
            self.no_qty += qty
            self.no_cost += price * qty + fee
        self.fees += fee

    @property
    def imbalance(self) -> float:           # + means more YES
        return self.yes_qty - self.no_qty

    @property
    def pairs(self) -> float:
        return min(self.yes_qty, self.no_qty)

    def avg(self, side: str) -> float | None:
        q, c = (self.yes_qty, self.yes_cost) if side == "YES" else (self.no_qty, self.no_cost)
        return c / q if q > 1e-9 else None

    @property
    def pair_cost(self) -> float | None:
        a, b = self.avg("YES"), self.avg("NO")
        return a + b if a is not None and b is not None else None

    @property
    def cost(self) -> float:
        return self.yes_cost + self.no_cost

    @property
    def unpaired_gbp(self) -> float:
        heavy = "YES" if self.imbalance > 0 else "NO"
        a = self.avg(heavy) or 0.0
        return abs(self.imbalance) * a

    def payout(self, outcome: str) -> float:
        return self.yes_qty if outcome == "UP" else self.no_qty

    def as_dict(self) -> dict:
        return {"yes_qty": self.yes_qty, "yes_cost": self.yes_cost, "no_qty": self.no_qty, "no_cost": self.no_cost,
                "avg_yes": self.avg("YES"), "avg_no": self.avg("NO"), "pair_cost": self.pair_cost,
                "pairs": self.pairs, "imbalance": self.imbalance, "unpaired_gbp": self.unpaired_gbp,
                "hedge_bleed": self.hedge_bleed, "fees": self.fees, "cost": self.cost,
                "maker_fills": self.maker_fills, "taker_fills": self.taker_fills}


@dataclass
class Quote:
    yes_bid: float | None
    no_bid: float | None
    yes_size: float
    no_size: float
    reason: str = ""

    def as_dict(self) -> dict:
        return {"yes_bid": self.yes_bid, "no_bid": self.no_bid, "yes_size": self.yes_size,
                "no_size": self.no_size, "reason": self.reason}


@dataclass
class RiskState:
    bankroll_gbp: float
    peak_gbp: float
    halted_until: float = 0.0
    halt_reason: str = ""
    killed: bool = False
    recent: list = field(default_factory=list)      # (ts, bleed_gbp)

    def breaker(self, now: float, cfg: RiskConfig) -> str | None:
        """Trip the circuit breaker if bleed or drawdown in the rolling window is too big."""
        self.recent = [(t, b) for t, b in self.recent if t >= now - cfg.breaker_window_s]
        bleed = sum(b for _, b in self.recent)
        dd = 1 - self.bankroll_gbp / self.peak_gbp if self.peak_gbp > 0 else 0.0
        why = None
        if bleed > cfg.breaker_bleed_gbp:
            why = f"hedge bleed £{bleed:.2f} in the last hour is over £{cfg.breaker_bleed_gbp:.0f}"
        elif dd > cfg.breaker_drawdown_frac:
            why = f"drawdown {dd:.1%} from peak is over {cfg.breaker_drawdown_frac:.0%}"
        if why and now >= self.halted_until:
            self.halted_until = now + cfg.breaker_cooldown_s
            self.halt_reason = why
            return why
        return None

    def halted(self, now: float) -> bool:
        return self.killed or now < self.halted_until


def make_quote(p_up: float, inv: Inventory, time_left: float, mm: MMConfig, risk: RiskConfig,
               rs: RiskState, now: float, ref_ok: bool) -> Quote:
    """Our two bids for this tick, after every guardrail."""
    if rs.killed:
        return Quote(None, None, 0, 0, "kill switch on")
    if now < rs.halted_until:
        return Quote(None, None, 0, 0, "circuit breaker: " + rs.halt_reason)
    if not ref_ok:
        return Quote(None, None, 0, 0, "price reference not trusted (too few sources)")
    if time_left < mm.stop_quoting_s:
        return Quote(None, None, 0, 0, f"last {mm.stop_quoting_s:.0f} s: no new quotes")
    I = inv.imbalance
    yb = floor_tick(p_up - mm.half_spread - mm.skew_per_share * I, mm.tick)
    nb = floor_tick((1 - p_up) - mm.half_spread + mm.skew_per_share * I, mm.tick)
    # paired-cost discipline: never pay so much for one side that the pair would cost >= max
    if inv.avg("NO") is not None:
        yb = min(yb, floor_tick(mm.max_pair_cost - inv.avg("NO") - mm.maker_fee_rate, mm.tick))
    if inv.avg("YES") is not None:
        nb = min(nb, floor_tick(mm.max_pair_cost - inv.avg("YES") - mm.maker_fee_rate, mm.tick))
    ys = ns = mm.quote_size
    reasons = []
    # exposure caps: stop adding to the heavy side once unpaired exposure hits the cap
    if I > 0 and inv.unpaired_gbp >= risk.max_unpaired_gbp:
        ys, _ = 0, reasons.append("YES paused: unpaired cap")
    if I < 0 and inv.unpaired_gbp >= risk.max_unpaired_gbp:
        ns, _ = 0, reasons.append("NO paused: unpaired cap")
    room = risk.max_window_cost_gbp - inv.cost
    if yb and yb > 0:
        ys = max(0.0, min(ys, room / yb))
    if nb and nb > 0:
        ns = max(0.0, min(ns, room / nb))
    if room <= 0:
        reasons.append("window spend cap reached")
    ybid = yb if yb >= 0.01 and ys >= mm.min_size else None
    nbid = nb if nb >= 0.01 and ns >= mm.min_size else None
    return Quote(ybid, nbid, ys if ybid else 0, ns if nbid else 0, "; ".join(reasons) or "quoting both sides")


@dataclass
class HedgeAction:
    side: str
    price: float
    qty: float
    fee: float
    bleed: float
    why: str


def hedge(p_up: float, inv: Inventory, time_left: float, book: Book, mm: MMConfig, rs: RiskState,
          now: float) -> HedgeAction | str | None:
    """Cross the spread to pair up inventory when it is too tilted or time is short.
    Returns an action, a reason string when a needed hedge is skipped, or None if nothing to do."""
    if rs.killed:
        return None
    need = abs(inv.imbalance)
    late = time_left <= mm.hedge_before_end_s
    if need < mm.min_size or not (need >= mm.hedge_imbalance or late) or time_left <= 1:
        return None
    heavy = "YES" if inv.imbalance > 0 else "NO"
    missing = "NO" if heavy == "YES" else "YES"
    price = book.no_ask if missing == "NO" else book.yes_ask
    fee_per = price * mm.taker_fee_rate
    pair = (inv.avg(heavy) or 0) + price + fee_per
    if pair > mm.max_cross_pair_cost:
        return f"hedge skipped: pairing now would cost {pair*100:.1f}p per £1 (limit {mm.max_cross_pair_cost*100:.1f}p); holding {need:.0f} unpaired {heavy}"
    fair_missing = (1 - p_up) if missing == "NO" else p_up
    qty = math.floor(need * 100 + 1e-9) / 100          # round down: a hedge never flips the tilt
    bleed = qty * (price + fee_per - fair_missing)
    return HedgeAction(missing, price, qty, qty * fee_per, bleed, "late in window" if late else f"imbalance {need:.0f} shares")
