"""Deterministic synthetic market for tests, paper runs and backtests.

Regime-switching log-price walk with an order book and trade tape. It is
plumbing, not evidence: no result on this feed says anything about real edge.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from .state_engine import BookUpdate, Trade

REGIME_PARAMS = {  # (drift bps/bar, vol bps/bar, spread bps, depth qty)
    "trending": (4.0, 20.0, 2.0, 50.0),
    "mean_reverting": (0.0, 15.0, 2.0, 60.0),
    "high_vol": (0.0, 80.0, 8.0, 20.0),
    "crisis": (-30.0, 200.0, 60.0, 5.0),
}


@dataclass
class SimMarket:
    symbols: tuple[str, ...]
    seed: int = 7
    start_price: float = 100.0
    bar_s: float = 60.0

    def __post_init__(self) -> None:
        self.rng = random.Random(self.seed)
        self.t = 1_760_000_000.0
        self.price = {s: self.start_price * (1 + i) for i, s in enumerate(self.symbols)}
        self.regime = {s: "trending" for s in self.symbols}
        self.trend_sign = {s: 1 for s in self.symbols}

    def step(self) -> tuple[float, dict[str, BookUpdate], list[Trade]]:
        self.t += self.bar_s
        books, trades = {}, []
        for s in self.symbols:
            if self.rng.random() < 0.02:
                self.regime[s] = self.rng.choices(
                    list(REGIME_PARAMS), weights=[0.4, 0.4, 0.17, 0.03])[0]
                self.trend_sign[s] = self.rng.choice((-1, 1))
            drift, vol, spr, depth = REGIME_PARAMS[self.regime[s]]
            if self.regime[s] == "trending":
                drift *= self.trend_sign[s]
            r = (drift + vol * self.rng.gauss(0, 1)) / 1e4
            self.price[s] *= math.exp(r)
            mid = self.price[s]
            half = mid * spr / 2e4
            tick = mid * 1e-4
            skew = 1 + 0.3 * math.tanh(r * 1e4 / max(vol, 1))
            bids = tuple((mid - half - i * tick, depth * skew * (1 + 0.2 * i)) for i in range(5))
            asks = tuple((mid + half + i * tick, depth / skew * (1 + 0.2 * i)) for i in range(5))
            books[s] = BookUpdate(self.t - 0.5, s, bids, asks)
            for _ in range(5):
                side = "buy" if self.rng.random() < 0.5 + 0.3 * math.tanh(r * 1e4 / max(vol, 1)) else "sell"
                trades.append(Trade(self.t - self.rng.random() * self.bar_s * 0.9, s, mid,
                                    self.rng.expovariate(1 / 2.0), side))
        trades.sort(key=lambda x: x.ts)
        return self.t, books, trades
