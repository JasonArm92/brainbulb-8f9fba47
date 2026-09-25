import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Clock:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t


class WalkFeed:
    """Deterministic BTC random walk standing in for the exchange poller."""

    def __init__(self, clock, seed=1, vol_bps=0.9, sources=3, price=60000.0):
        self.clock, self.rng, self.vol, self.n = clock, random.Random(seed), vol_bps / 1e4, sources
        self.p, self.t, self.fx, self.errors = price, clock(), 0.75, {}

    def latest(self):
        now = self.clock()
        while self.t < now:
            dt = min(0.5, now - self.t)
            self.p *= math.exp(self.rng.gauss(0, self.vol * math.sqrt(dt)))
            self.t += dt
        srcs = {f"s{i}": self.p for i in range(self.n)}
        return now, (self.p if self.n else None), self.n, srcs
