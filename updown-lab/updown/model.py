"""Fair probability that BTC finishes the 5-minute window at or above its opening reference.

Random-walk model: over the time left, log(price) moves ~ N(drift, sigma^2 * t). Then
    P(UP) = Phi( (ln(S/S0) + momentum_weight * projected_momentum) / (sigma * sqrt(time_left)) )
Every input and each term's contribution is returned so the number is auditable."""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass

from .config import ModelConfig


def phi(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


@dataclass
class Inputs:
    spot: float
    open_ref: float
    time_left_s: float
    vol_bps: float            # per sqrt(second), basis points
    momentum_bps: float       # log return over the momentum look-back, bps
    accel_bps: float          # momentum now minus momentum one look-back ago, bps

    @property
    def delta_bps(self) -> float:
        return math.log(self.spot / self.open_ref) * 1e4


@dataclass
class Fair:
    p_up: float
    z: float
    z_delta: float            # contribution of where price is vs the open
    z_momentum: float         # contribution of recent momentum (0 when the weight is 0)
    sigma_left_bps: float     # expected move over the time left, bps (1 standard deviation)
    inputs: Inputs

    def as_dict(self) -> dict:
        i = self.inputs
        return {"p_up": self.p_up, "z": self.z, "z_delta": self.z_delta, "z_momentum": self.z_momentum,
                "sigma_left_bps": self.sigma_left_bps, "spot": i.spot, "open_ref": i.open_ref,
                "time_left_s": i.time_left_s, "vol_bps": i.vol_bps, "momentum_bps": i.momentum_bps,
                "accel_bps": i.accel_bps, "delta_bps": i.delta_bps}


def fair_value(i: Inputs, cfg: ModelConfig) -> Fair:
    vol = max(cfg.vol_floor_bps, i.vol_bps) / 1e4
    t = max(i.time_left_s, 1e-3)
    sig = vol * math.sqrt(t)
    proj_mom = (i.momentum_bps / 1e4) * min(1.0, t / cfg.momentum_s)
    z_d = math.log(i.spot / i.open_ref) / sig
    z_m = cfg.momentum_weight * proj_mom / sig
    z = z_d + z_m
    p = min(1 - cfg.p_clip, max(cfg.p_clip, phi(z)))
    if i.time_left_s <= 0:
        p = 1.0 if i.spot >= i.open_ref else 0.0
    return Fair(p, z, z_d, z_m, sig * 1e4, i)


class VolTracker:
    """EWMA realised volatility per sqrt(second), from irregular ticks; plus momentum history."""

    def __init__(self, cfg: ModelConfig):
        self.cfg = cfg
        self.var_rate = (cfg.vol_prior_bps / 1e4) ** 2
        self.last: tuple[float, float] | None = None
        self.hist: deque = deque(maxlen=4000)          # (ts, price)

    def update(self, ts: float, price: float) -> None:
        if self.last and ts > self.last[0]:
            dt = ts - self.last[0]
            r = math.log(price / self.last[1])
            w = 1 - 0.5 ** (dt / self.cfg.vol_halflife_s)
            self.var_rate = (1 - w) * self.var_rate + w * (r * r / dt)
        self.last = (ts, price)
        self.hist.append((ts, price))

    def price_at(self, ts: float) -> float | None:
        best = None
        for t, p in reversed(self.hist):
            if t <= ts:
                return p
            best = p
        return best

    @property
    def vol_bps(self) -> float:
        return math.sqrt(self.var_rate) * 1e4

    def momentum_bps(self, now: float) -> tuple[float, float]:
        L = self.cfg.momentum_s
        p0, p1, p2 = self.price_at(now), self.price_at(now - L), self.price_at(now - 2 * L)
        if not (p0 and p1 and p2):
            return 0.0, 0.0
        m_now, m_prev = math.log(p0 / p1) * 1e4, math.log(p1 / p2) * 1e4
        return m_now, m_now - m_prev
