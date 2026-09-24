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
    # sum of |notional| x beta-to-BTC / equity. Betas are floored at 1.0
    # (trader/correlation.py), so this can only be tighter than max_gross_frac.
    max_beta_gross_frac: float = 0.30
    max_order_frac: float = 0.05          # single order notional / equity
    max_price_deviation_bps: float = 50.0 # limit price vs mid sanity band
    max_snapshot_age_s: float = 5.0       # stale data -> no orders
    max_orders_per_minute: int = 20
    kill_switch_path: str = "runtime/KILL"
    # Spot-market switches. Defaults change nothing; the UK profile below turns
    # them on, and each one can only refuse orders, never allow more.
    allow_short: bool = True              # False: no position may go below zero
    require_cash: bool = False            # True: a buy must be paid for in full from cash
    max_open_positions: int | None = None # cap on coins held at once
    min_order_notional: float = 0.0       # exchange minimum order, in account currency


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
    # True (default): only bet when the calibrated odds beat fees and slippage.
    # False is for the practice-only fast profile below: it may bet without a
    # proven edge, risking a small fixed slice of the account instead.
    require_edge_after_costs: bool = True
    fixed_risk_frac: float = 0.005        # used only when the edge check is off


@dataclass(frozen=True)
class CostModel:
    taker_fee_bps: float = 5.0
    maker_fee_bps: float = 2.0
    slippage_bps_per_frac_of_depth: float = 20.0  # impact vs top-of-book depth
    min_slippage_bps: float = 1.0


# ---------------------------------------------------------------------------
# UK retail profile (chosen by the operator, 2026-09-24).
# The FCA bans crypto derivatives for UK retail, so this profile trades spot
# only: real coins bought with pounds, no down-bets, no borrowing. It is sized
# for a GBP 50 account, where the default 5%-per-order cap (GBP 2.50) would sit
# below useful order sizes: one bet may use up to 30% of the account and at
# most two coins are held at once. The loss stops (15% worst fall, 3% a day)
# are unchanged.
UK_SMALL_ACCOUNT = RiskLimits(
    max_position_frac=0.30,
    max_order_frac=0.30,
    max_gross_frac=0.50,
    max_beta_gross_frac=0.50,
    allow_short=False,
    require_cash=True,
    max_open_positions=2,
    min_order_notional=0.72,              # Coinbase GBP pairs: min_market_funds 0.72
)

# Coinbase Advanced, lowest volume tier (Aug 2026): 0.40% maker, 0.60% taker.
# The paper broker fills as a taker, so every trade pays 0.60%.
COINBASE_GBP_COSTS = CostModel(taker_fee_bps=60.0, maker_fee_bps=40.0,
                               slippage_bps_per_frac_of_depth=20.0, min_slippage_bps=1.0)

# Fast practice profile (chosen by the operator, 2026-09-24): trades more often
# for smaller gains, run side by side with the careful profile on pretend money
# to see which does better. Entry bar lowered (set-up >= 1, confidence > 0.65)
# and bets are allowed without a proven edge after fees, each risking 0.5% of
# the account. Every hard limit in UK_SMALL_ACCOUNT still applies unchanged,
# including the 15% and 3% loss stops. Practice only: not for real money.
UK_FAST_GATE = GateConfig(min_setup_quality=1, min_direction_confidence=0.65,
                          require_edge_after_costs=False, fixed_risk_frac=0.005)


@dataclass(frozen=True)
class AgentConfig:
    risk: RiskLimits = field(default_factory=RiskLimits)
    gate: GateConfig = field(default_factory=GateConfig)
    costs: CostModel = field(default_factory=CostModel)
    schema_dir: str = "schemas"
    ledger_path: str = "runtime/ledger.jsonl"
    snapshot_token_budget: int = 400
    spot: bool = False                    # spot market: no funding payments
    min_stop_bps: float = 40.0            # smallest stop-loss distance; spot uses a wider one to clear fees
    reward_risk: float = 1.5              # take-profit distance / stop distance
