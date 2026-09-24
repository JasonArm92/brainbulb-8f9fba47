"""Review items #9 (correlation-aware cap) and #10 (perp funding costs)."""

import csv
import dataclasses
import math
import os
import random

import pytest

from tests.helpers import decision, schema, snap
from trader.calibration import Calibrator
from trader.config import GateConfig, RiskLimits
from trader.correlation import BetaEstimator
from trader.funding import FundingBook, FundingConfig, FundingEvent
from trader.policy import Policy
from trader.portfolio import Portfolio
from trader.risk import Order, RiskManager

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "okx_btc_usdt_swap_funding.csv")


def policy(beta=None):
    kw = {"beta": beta} if beta else {}
    return Policy(GateConfig(), RiskLimits(), Calibrator(prior_shrink=1.0, prior_strength=1e9), **kw)


# --- limits are not loosened ---------------------------------------------------
def test_existing_hard_limits_unchanged():
    L = RiskLimits()
    assert (L.max_drawdown, L.max_daily_loss, L.max_position_frac, L.max_gross_frac, L.max_order_frac,
            L.max_price_deviation_bps, L.max_snapshot_age_s, L.max_orders_per_minute) == (
        0.15, 0.03, 0.10, 0.30, 0.05, 50.0, 5.0, 20)
    assert L.max_beta_gross_frac <= L.max_gross_frac
    with pytest.raises(dataclasses.FrozenInstanceError):
        L.max_beta_gross_frac = 1.0


# --- funding: accounting -------------------------------------------------------
def test_positive_funding_long_pays_short_receives():
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 100, 100, 0)       # +10k notional
    pf.apply_fill("ETH-PERP", "sell", 100, 100, 0)      # -10k notional
    eq0 = pf.equity()
    FundingBook.settle(pf, FundingEvent(0, "BTC-PERP", 0.0001))
    FundingBook.settle(pf, FundingEvent(0, "ETH-PERP", 0.0001))
    assert pf.equity() == pytest.approx(eq0 - 1.0 + 1.0)
    assert pf.funding_paid == pytest.approx(0.0)
    FundingBook.settle(pf, FundingEvent(0, "ETH-PERP", -0.0005))  # short pays when negative
    assert pf.equity() == pytest.approx(eq0 - 5.0)


def test_funding_on_flat_symbol_is_zero():
    pf = Portfolio(cash=1e5)
    assert FundingBook.settle(pf, FundingEvent(0, "BTC-PERP", 0.01)) == 0.0


# --- funding: sizing is pessimistic --------------------------------------------
def test_unknown_symbol_charges_both_sides():
    fb = FundingBook()
    assert fb.expected_cost_bps("X", "buy", 24) == pytest.approx(3.0)   # 0.01% x 3
    assert fb.expected_cost_bps("X", "sell", 24) == pytest.approx(3.0)


def test_receiving_side_is_never_credited():
    fb = FundingBook()
    for _ in range(10):
        fb.observe("SUI-PERP", 0.0001)
    assert fb.expected_cost_bps("SUI-PERP", "sell", 24) == 0.0          # short would receive
    assert fb.expected_cost_bps("SUI-PERP", "buy", 24) == pytest.approx(3.0)


def test_uses_worse_of_latest_and_mean():
    fb = FundingBook()
    for r in [0.0001] * 20 + [-0.0004]:  # flipped negative on the last print: shorts now pay
        fb.observe("ENA-PERP", r)
    assert fb.expected_cost_bps("ENA-PERP", "sell", 24) == pytest.approx(0.0004 * 3 * 1e4)
    assert fb.expected_cost_bps("ENA-PERP", "buy", 24) > 0            # mean still positive


def test_interval_respected_for_4h_venues():
    fb = FundingBook()
    fb.observe("ENA-PERP", 0.00005, interval_h=4)
    assert fb.expected_cost_bps("ENA-PERP", "buy", 24) == pytest.approx(0.00005 * 6 * 1e4)


def test_garbage_rates_ignored():
    fb = FundingBook()
    fb.observe("BTC-PERP", float("nan"))
    fb.observe("BTC-PERP", 0.5)
    assert fb.expected_cost_bps("BTC-PERP", "sell", 24) == pytest.approx(3.0)  # still "unknown"


def test_real_okx_btc_series_cost():
    """30 days of real OKX BTC-USDT-SWAP funding (2026-08-26..09-24)."""
    rates = [float(r["realized_rate"]) for r in csv.DictReader(open(FIXTURE))]
    assert len(rates) == 90 and all(abs(r) <= 0.00375 for r in rates)
    fb = FundingBook()
    for r in rates:
        fb.observe("BTC-PERP", r)
    long_cost = fb.expected_cost_bps("BTC-PERP", "buy", 24)
    assert 1.5 < long_cost < 3.5                          # ~0.006-0.01%/8h x 3
    assert fb.expected_cost_bps("BTC-PERP", "sell", 24) == 0.0


def test_funding_shrinks_or_blocks_entry():
    p = policy()
    base = p.evaluate(decision(direction_conf=0.9), snap(), Portfolio(cash=1e5), schema(), cost_bps=14)
    p2 = policy()
    paid = p2.evaluate(decision(direction_conf=0.9), snap(), Portfolio(cash=1e5), schema(), cost_bps=14,
                       funding_bps={"buy": 20.0, "sell": 0.0})
    assert base.kind == paid.kind == "enter"
    assert paid.kelly < base.kelly and "funding=20.0bps" in paid.reason
    blocked = policy().evaluate(decision(direction_conf=0.82), snap(), Portfolio(cash=1e5), schema(),
                                cost_bps=14, funding_bps={"buy": 60.0})
    assert blocked.kind == "hold" and "no edge" in blocked.reason


def test_received_funding_never_increases_size():
    a = policy().evaluate(decision(), snap(), Portfolio(cash=1e5), schema(), cost_bps=14)
    b = policy().evaluate(decision(), snap(), Portfolio(cash=1e5), schema(), cost_bps=14,
                          funding_bps={"buy": -50.0})
    assert a.notional == pytest.approx(b.notional)


# --- correlation-aware cap -----------------------------------------------------
def test_beta_estimator_recovers_beta_and_respects_floor_and_prior():
    rng = random.Random(1)
    be = BetaEstimator(halflife_bars=500, min_obs=60)
    assert be.beta("SOL-PERP") == 1.5                       # prior before data
    px = {"BTC-PERP": 100.0, "SOL-PERP": 100.0, "LOW-PERP": 100.0}
    for _ in range(3000):
        m = rng.gauss(0, 0.01)
        px["BTC-PERP"] *= math.exp(m)
        px["SOL-PERP"] *= math.exp(2.0 * m + rng.gauss(0, 0.004))
        px["LOW-PERP"] *= math.exp(0.3 * m + rng.gauss(0, 0.004))
        be.update(px)
    assert be.raw_beta("SOL-PERP") == pytest.approx(2.0, abs=0.2)
    assert be.beta("SOL-PERP") == pytest.approx(2.0, abs=0.2)
    assert be.raw_beta("LOW-PERP") < 0.6 and be.beta("LOW-PERP") == 1.0  # floored: never loosens
    assert be.beta("BTC-PERP") == 1.0


def test_beta_cap_blocks_correlated_book_that_raw_gross_allows(tmp_path):
    betas = {"BTC-PERP": 1.0, "SOL-PERP": 2.0, "ENA-PERP": 2.5}
    rm = RiskManager(RiskLimits(kill_switch_path=str(tmp_path / "K")), beta=lambda s: betas[s])
    pf = Portfolio(cash=1e5)
    pf.apply_fill("SOL-PERP", "buy", 80, 100, 0)            # 8k x 2.0 = 16k
    pf.apply_fill("ENA-PERP", "buy", 40, 100, 0)            # 4k x 2.5 = 10k  -> 26k beta-gross
    assert pf.gross_notional() == pytest.approx(12_000)     # raw gross 12% is well under 30%
    v = rm.check(Order("BTC-PERP", "buy", 50, 100), pf, snap(), 100)   # +5k x 1.0 -> 31k
    assert not v.ok and any("beta-weighted" in r for r in v.reasons)
    assert rm.check(Order("BTC-PERP", "buy", 30, 100), pf, snap(), 100).ok  # 29k fits


def test_beta_cap_never_blocks_reduce(tmp_path):
    rm = RiskManager(RiskLimits(kill_switch_path=str(tmp_path / "K")), beta=lambda s: 3.0)
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 100, 100, 0)
    assert rm.check(Order("BTC-PERP", "sell", 50, 100, reduce_only=True), pf, snap(), 100).ok


@pytest.mark.parametrize("bad", [lambda s: 0.1, lambda s: float("nan"), lambda s: 1 / 0])
def test_faulty_beta_provider_cannot_loosen(tmp_path, bad):
    rm = RiskManager(RiskLimits(kill_switch_path=str(tmp_path / "K")), beta=bad)
    assert rm.safe_beta("X") >= 1.0
    pf = Portfolio(cash=1e5)
    pf.apply_fill("ETH-PERP", "buy", 280, 100, 0)           # 28k raw gross
    assert not rm.check(Order("BTC-PERP", "buy", 30, 100), pf, snap(), 100).ok


def test_policy_sizes_inside_beta_room():
    betas = {"BTC-PERP": 1.0, "SOL-PERP": 2.0}
    pf = Portfolio(cash=1e5)
    pf.apply_fill("SOL-PERP", "buy", 135, 100, 0)           # 13.5k x 2 = 27k of 30k
    unconstrained = policy().evaluate(decision(direction_conf=0.99), snap(), Portfolio(cash=1e5), schema())
    it = policy(beta=lambda s: betas[s]).evaluate(decision(direction_conf=0.99), snap(), pf, schema())
    assert unconstrained.notional > 3_000                   # so the beta room is what binds below
    assert it.kind == "enter" and 0 < it.notional <= 3_000 + 1e-6
