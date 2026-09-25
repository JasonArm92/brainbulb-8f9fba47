"""All settings in one place. MODE is hard-wired to paper: this codebase contains no code
that can place a real order anywhere, and the engine refuses to start in any other mode."""

from __future__ import annotations

from dataclasses import dataclass, field

MODE = "paper"                  # the only supported value
WINDOW_S = 300                  # 5-minute windows aligned to UTC (like Polymarket's btc-updown-5m-<ts>)


def assert_paper(mode: str = MODE) -> None:
    if mode != "paper":
        raise SystemExit("updown-lab is paper-only. Live trading is not implemented and is not legal "
                         "for UK retail (FCA binary-options ban; Polymarket and Kalshi block the UK).")


@dataclass(frozen=True)
class ModelConfig:
    vol_halflife_s: float = 120.0       # EWMA half-life for realised volatility
    vol_floor_bps: float = 0.3          # per-sqrt-second floor so P(UP) never goes wild on a quiet tape
    vol_prior_bps: float = 0.9          # starting guess (≈50% annualised) before data arrives
    momentum_s: float = 30.0            # look-back for the momentum input
    momentum_weight: float = 0.0        # 0 = pure random walk. Logged either way; set from the backtest
    p_clip: float = 0.005


@dataclass(frozen=True)
class SimMarketConfig:
    """The SIMULATED crowd and takers. Nothing here is real Polymarket data."""
    crowd_lag_s: float = 3.0            # the crowd prices off a slightly stale spot
    crowd_noise: float = 0.02           # extra disagreement in the crowd's probability (OU noise, std)
    crowd_spread: float = 0.02          # crowd best bid/ask width (2 cents)
    taker_rate_per_s: float = 0.6       # Poisson arrivals of takers selling YES or NO
    informed_share: float = 0.25        # share of takers who see the price a little ahead of us
    informed_lead_s: float = 2.0        # how far ahead they see
    informed_edge: float = 0.01         # they only trade when our bid is at least this rich
    taker_size_mean: float = 25.0       # shares
    seed: int | None = None


@dataclass(frozen=True)
class MMConfig:
    tick: float = 0.01                  # Polymarket price tick for these markets
    min_size: float = 5.0               # minimum order size in shares
    quote_size: float = 25.0
    half_spread: float = 0.02           # each bid sits this far below its side's fair price
    skew_per_share: float = 0.0004      # inventory skew: lower the heavy side's bid by this per share of imbalance
    max_pair_cost: float = 0.985        # never buy a side if the pair would cost more than this (maker)
    hedge_imbalance: float = 60.0       # cross the spread to rebalance above this many unpaired shares
    hedge_before_end_s: float = 45.0    # in the last 45 s, flatten imbalance by crossing if affordable
    max_cross_pair_cost: float = 1.02   # accept up to 2 cents of hedge bleed per pair to get flat
    stop_quoting_s: float = 20.0        # no new maker quotes in the final 20 s
    taker_fee_rate: float = 0.01        # fee on crossing (set to the venue's schedule)
    maker_fee_rate: float = 0.0


@dataclass(frozen=True)
class RiskConfig:
    start_gbp: float = 1000.0
    max_window_cost_usd: float = 120.0      # spend on resting quotes per window (hedges that REDUCE risk are exempt)
    max_unpaired_usd: float = 60.0          # directional (unpaired) exposure cap per window, at cost
    max_aggregate_unpaired_usd: float = 90.0
    breaker_window_s: float = 3600.0
    breaker_bleed_usd: float = 25.0         # hedge bleed in the rolling hour that trips the breaker
    breaker_drawdown_frac: float = 0.05     # fall from peak bankroll that trips it
    breaker_cooldown_s: float = 1800.0
    min_sources: int = 2                    # price sources needed to trust the reference


@dataclass(frozen=True)
class Config:
    model: ModelConfig = field(default_factory=ModelConfig)
    sim: SimMarketConfig = field(default_factory=SimMarketConfig)
    mm: MMConfig = field(default_factory=MMConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    db_path: str = "runtime/lab.sqlite"
    kill_path: str = "runtime/KILL"
