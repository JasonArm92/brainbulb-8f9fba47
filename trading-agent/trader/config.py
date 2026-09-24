"""Hard limits and gate thresholds.

Everything here is owned by code and the operator. Nothing in this module is
ever read from a model response. `RiskLimits` is frozen so no runtime path can
mutate it; changing a limit is a code change that goes through review.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class RiskLimits:
    max_drawdown: float = 0.15            # peak-to-trough equity, trips kill switch
    max_daily_loss: float = 0.03          # fraction of start-of-day equity
    max_position_frac: float = 0.10       # per-symbol notional / equity
    max_gross_frac: float = 0.30          # sum of |notional| / equity
    max_order_frac: float = 0.05          # single order notional / equity
    max_price_deviation_bps: float = 50.0 # limit price vs mid sanity band
    max_snapshot_age_s: float = 5.0       # stale data -> no orders
    max_orders_per_minute: int = 20
    kill_switch_path: str = "runtime/KILL"


@dataclass(frozen=True)
class GateConfig:
    min_setup_quality: int = 2            # Score 0..3
    min_direction_confidence: float = 0.80  # strictly greater than
    required_risk_state: str = "safe"
    max_toxic_flow_prob: float = 0.50     # Noul P(toxic) must be below this
    escalate_below_confidence: float = 0.60
    escalate_regimes: tuple[str, ...] = ("crisis",)
    # A freeze is lifted by a Brain "clear", or after this many bars without a
    # fresh escalation trigger. None = only the Brain can lift it.
    freeze_expiry_bars: int | None = 60
    kelly_fraction: float = 0.25          # fractional Kelly multiplier
    kelly_cap: float = 0.25               # hard cap: never above quarter Kelly


@dataclass(frozen=True)
class CostModel:
    taker_fee_bps: float = 5.0
    maker_fee_bps: float = 2.0
    slippage_bps_per_frac_of_depth: float = 20.0  # impact vs top-of-book depth
    min_slippage_bps: float = 1.0


@dataclass(frozen=True)
class AgentConfig:
    risk: RiskLimits = field(default_factory=RiskLimits)
    gate: GateConfig = field(default_factory=GateConfig)
    costs: CostModel = field(default_factory=CostModel)
    schema_dir: str = "schemas"
    ledger_path: str = "runtime/ledger.jsonl"
    snapshot_token_budget: int = 400
