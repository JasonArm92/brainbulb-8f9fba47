"""Map Jev direction confidence to an empirical win probability.

Jev reports calibrated confidence, but "calibrated on TypeSafe's eval set" is
not "calibrated on our P&L after costs". Sizing therefore uses p_win from our
own realised outcomes, binned by confidence, shrunk toward a conservative
prior until enough samples exist. The overnight review refits this.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

N_BINS = 10


def _bin(conf: float) -> int:
    return min(N_BINS - 1, max(0, int(conf * N_BINS)))


@dataclass
class Calibrator:
    prior_shrink: float = 0.5     # prior mean = 0.5 + (conf - 0.5) * shrink
    prior_strength: float = 30.0  # pseudo-observations
    wins: list[float] = field(default_factory=lambda: [0.0] * N_BINS)
    counts: list[float] = field(default_factory=lambda: [0.0] * N_BINS)

    def p_win(self, conf: float) -> float:
        b = _bin(conf)
        prior = 0.5 + (conf - 0.5) * self.prior_shrink
        a = prior * self.prior_strength
        return (self.wins[b] + a) / (self.counts[b] + self.prior_strength)

    def observe(self, conf: float, won: bool) -> None:
        b = _bin(conf)
        self.counts[b] += 1
        self.wins[b] += 1.0 if won else 0.0

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as f:
            json.dump({"wins": self.wins, "counts": self.counts,
                       "prior_shrink": self.prior_shrink, "prior_strength": self.prior_strength}, f)

    @staticmethod
    def load(path: str) -> "Calibrator":
        if not os.path.exists(path):
            return Calibrator()
        with open(path) as f:
            d = json.load(f)
        return Calibrator(d["prior_shrink"], d["prior_strength"], d["wins"], d["counts"])
