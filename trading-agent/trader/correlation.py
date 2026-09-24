"""Beta to a reference asset, for the correlation-aware exposure cap.

In a crypto selloff the finalists trade close to one factor, so seven 4%
positions behave like one 28% position. The raw gross cap counts them as
independent. This module estimates each symbol's beta to BTC from bar mids
(EWMA covariance of log returns) so the risk layer can cap
sum(|notional| x beta) as well.

Guarantees the risk layer relies on:
  * beta is floored at 1.0, so the beta-weighted gross is never below the raw
    gross, and the extra cap can only tighten, never loosen;
  * until a symbol has `min_obs` returns, its beta is shrunk toward a
    conservative prior (1.5 for non-reference symbols);
  * beta is capped so one bad print cannot freeze all trading.

Inputs are market prices only. Nothing here reads a model output.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class BetaEstimator:
    reference: str = "BTC-PERP"
    halflife_bars: float = 240.0
    prior_beta: float = 1.5
    floor: float = 1.0
    cap: float = 3.0
    min_obs: int = 60
    _last: dict[str, float] = field(default_factory=dict)
    _var_ref: float = 0.0
    _cov: dict[str, float] = field(default_factory=dict)
    _n: dict[str, int] = field(default_factory=dict)

    @property
    def _alpha(self) -> float:
        return 1 - math.exp(math.log(0.5) / self.halflife_bars)

    def update(self, mids: dict[str, float]) -> None:
        """Feed one bar of mids. Symbols missing this bar are skipped for this bar."""
        rets = {}
        for s, px in mids.items():
            if px > 0 and s in self._last and self._last[s] > 0:
                rets[s] = math.log(px / self._last[s])
            if px > 0:
                self._last[s] = px
        r_ref = rets.get(self.reference)
        if r_ref is None:
            return
        a = self._alpha
        self._var_ref = (1 - a) * self._var_ref + a * r_ref * r_ref
        for s, r in rets.items():
            if s == self.reference:
                continue
            self._cov[s] = (1 - a) * self._cov.get(s, 0.0) + a * r * r_ref
            self._n[s] = self._n.get(s, 0) + 1

    def raw_beta(self, symbol: str) -> float | None:
        if symbol == self.reference:
            return 1.0
        if self._var_ref <= 0 or symbol not in self._cov:
            return None
        return self._cov[symbol] / self._var_ref

    def beta(self, symbol: str) -> float:
        if symbol == self.reference:
            return max(self.floor, 1.0)
        raw = self.raw_beta(symbol)
        n = self._n.get(symbol, 0)
        w = n / (n + self.min_obs)
        est = self.prior_beta if raw is None else w * raw + (1 - w) * self.prior_beta
        return min(self.cap, max(self.floor, est))

    __call__ = beta
