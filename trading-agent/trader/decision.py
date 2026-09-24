"""Typed decision returned by the reflex engine, with strict validation.

Any value outside the schema is a hard error. Callers treat an invalid
decision exactly like no decision: hold, open nothing.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .jev_schema import DIRECTIONS, REGIMES, RISK_STATES, SETUP_LEVELS


class InvalidDecision(ValueError):
    pass


@dataclass(frozen=True)
class Decision:
    symbol: str
    schema_version: int
    regime: str
    regime_conf: float
    direction: str
    direction_conf: float
    toxic_flow_p: float
    setup_quality: float      # may land between levels, e.g. 2.04
    setup_conf: float
    risk_state: str
    risk_conf: float
    latency_ms: float = 0.0

    def __post_init__(self) -> None:
        if self.regime not in REGIMES:
            raise InvalidDecision(f"regime {self.regime!r}")
        if self.direction not in DIRECTIONS:
            raise InvalidDecision(f"direction {self.direction!r}")
        if self.risk_state not in RISK_STATES:
            raise InvalidDecision(f"risk_state {self.risk_state!r}")
        for name in ("regime_conf", "direction_conf", "toxic_flow_p", "setup_conf", "risk_conf"):
            v = getattr(self, name)
            if not isinstance(v, (int, float)) or math.isnan(v) or not 0.0 <= v <= 1.0:
                raise InvalidDecision(f"{name}={v!r} not a probability")
        if not 0.0 <= self.setup_quality <= SETUP_LEVELS - 1:
            raise InvalidDecision(f"setup_quality={self.setup_quality!r}")
