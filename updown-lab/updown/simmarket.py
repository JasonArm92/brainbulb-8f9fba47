"""A SIMULATED prediction market for one BTC 5-minute window. Not Polymarket data.

Why simulate: Polymarket blocks the UK, so the lab cannot read its live book. This module
stands in for the other traders so the market-making and hedging logic can be exercised
honestly. It models the two forces that decide whether a market maker makes money:

  * the crowd: prices YES from a slightly stale spot plus its own noise, quoting a 2-cent
    wide book. Our bids only fill if they are at least as good as the crowd's;
  * takers who SELL into bids (selling YES hits YES bids, selling NO hits NO bids):
      - noise takers pick a side at random (they pay us the spread);
      - informed takers see the price `informed_lead_s` seconds ahead of us and only sell
        when our bid is richer than the true value (adverse selection - they cost us).

Crossing the spread (for hedging) buys at the crowd's ask plus the taker fee.
All randomness comes from one seeded RNG so tests are reproducible.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from .config import SimMarketConfig
from .model import phi


def floor_tick(p: float, tick: float) -> float:
    return math.floor(p / tick + 1e-9) * tick


def ceil_tick(p: float, tick: float) -> float:
    return math.ceil(p / tick - 1e-9) * tick


@dataclass
class Book:
    """Crowd best bid/ask for YES; NO is the mirror (NO bid = 1 - YES ask)."""
    yes_bid: float
    yes_ask: float

    @property
    def no_bid(self) -> float:
        return round(1 - self.yes_ask, 6)

    @property
    def no_ask(self) -> float:
        return round(1 - self.yes_bid, 6)

    @property
    def mid(self) -> float:
        return (self.yes_bid + self.yes_ask) / 2


@dataclass
class TakerFill:
    side: str          # "YES" or "NO" - the token WE buy
    price: float
    qty: float
    informed: bool


class SimMarket:
    def __init__(self, cfg: SimMarketConfig, tick: float = 0.01, rng: random.Random | None = None):
        self.cfg, self.tick = cfg, tick
        self.rng = rng or random.Random(cfg.seed)
        self.noise = 0.0
        self.book = Book(0.49, 0.51)

    def crowd_prob(self, z_stale: float, dt: float) -> float:
        # Ornstein-Uhlenbeck disagreement around the crowd's (stale) model price
        th = 1 / 20.0
        self.noise += -th * self.noise * dt + self.cfg.crowd_noise * math.sqrt(2 * th * dt) * self.rng.gauss(0, 1)
        return min(0.99, max(0.01, phi(z_stale) + self.noise))

    def update_book(self, p_crowd: float) -> Book:
        h = self.cfg.crowd_spread / 2
        bid = max(0.01, floor_tick(p_crowd - h, self.tick))
        ask = min(0.99, ceil_tick(p_crowd + h, self.tick))
        if ask <= bid:
            ask = round(bid + self.tick, 6)
        self.book = Book(round(bid, 6), round(ask, 6))
        return self.book

    def takers(self, dt: float, our_yes_bid: float | None, our_no_bid: float | None,
               yes_size: float, no_size: float, p_true_ahead: float) -> list[TakerFill]:
        """Takers arriving over `dt` seconds who sell into our bids."""
        out: list[TakerFill] = []
        n = self._poisson(self.cfg.taker_rate_per_s * dt)
        for _ in range(n):
            informed = self.rng.random() < self.cfg.informed_share
            size = max(1.0, self.rng.expovariate(1 / self.cfg.taker_size_mean))
            if informed:
                # sells whichever side we overpay for most, if the overpayment beats their edge
                rich_yes = (our_yes_bid - p_true_ahead) if our_yes_bid is not None else -1
                rich_no = (our_no_bid - (1 - p_true_ahead)) if our_no_bid is not None else -1
                side = "YES" if rich_yes >= rich_no else "NO"
                if max(rich_yes, rich_no) < self.cfg.informed_edge:
                    continue
            else:
                side = "YES" if self.rng.random() < 0.5 else "NO"
            ours = our_yes_bid if side == "YES" else our_no_bid
            crowd = self.book.yes_bid if side == "YES" else self.book.no_bid
            left = yes_size if side == "YES" else no_size
            if ours is None or left <= 0 or ours < crowd - 1e-9:
                continue
            share = 1.0 if ours > crowd + 1e-9 else 0.5          # at the same price we split the flow
            q = min(left, round(size * share, 2))
            if q <= 0:
                continue
            out.append(TakerFill(side, ours, q, informed))
            if side == "YES":
                yes_size -= q
            else:
                no_size -= q
        return out

    def _poisson(self, lam: float) -> int:
        l, k, p = math.exp(-lam), 0, 1.0
        while True:
            p *= self.rng.random()
            if p <= l:
                return k
            k += 1
