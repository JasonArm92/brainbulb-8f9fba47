"""UK spot profile: no down-bets, no borrowing, small-account sizing, fees that bite."""

import dataclasses

import pytest

from tests.helpers import decision, schema, snap
from trader.calibration import Calibrator
from trader.config import COINBASE_GBP_COSTS, GateConfig, RiskLimits, UK_SMALL_ACCOUNT
from trader.policy import ExitRules, Policy
from trader.portfolio import Portfolio
from trader.risk import Order, RiskManager


def limits(tmp_path, **kw):
    return dataclasses.replace(UK_SMALL_ACCOUNT, kill_switch_path=str(tmp_path / "KILL"), **kw)


def spot_policy(tmp_path, stop=250.0):
    return Policy(GateConfig(), limits(tmp_path), Calibrator(prior_shrink=1.0, prior_strength=1e9),
                  exits=ExitRules(min_stop_bps=stop))


def test_profile_keeps_loss_stops_and_defaults_unchanged():
    assert UK_SMALL_ACCOUNT.max_drawdown == RiskLimits().max_drawdown == 0.15
    assert UK_SMALL_ACCOUNT.max_daily_loss == RiskLimits().max_daily_loss == 0.03
    d = RiskLimits()
    assert (d.allow_short, d.require_cash, d.max_open_positions, d.min_order_notional) == (True, False, None, 0.0)
    assert COINBASE_GBP_COSTS.taker_fee_bps == 60.0


def test_no_short_selling(tmp_path):
    rm = RiskManager(limits(tmp_path))
    pf = Portfolio(cash=50.0)
    v = rm.check(Order("BTC-GBP", "sell", 0.0001, 100.0), pf, snap(sym="BTC-GBP"), 100)
    assert not v.ok and any("short selling" in r for r in v.reasons)


def test_selling_what_you_hold_is_fine_but_not_more(tmp_path):
    rm = RiskManager(limits(tmp_path))
    pf = Portfolio(cash=50.0)
    pf.apply_fill("BTC-GBP", "buy", 0.1, 100.0, 0.0)
    assert rm.check(Order("BTC-GBP", "sell", 0.1, 100.0, reduce_only=True), pf, snap(sym="BTC-GBP"), 100).ok
    assert not rm.check(Order("BTC-GBP", "sell", 0.2, 100.0), pf, snap(sym="BTC-GBP"), 100).ok


def test_buys_must_be_paid_for_in_cash(tmp_path):
    rm = RiskManager(limits(tmp_path, max_order_frac=1.0, max_position_frac=1.0, max_gross_frac=1.0,
                                max_beta_gross_frac=1.0))
    pf = Portfolio(cash=50.0)
    v = rm.check(Order("BTC-GBP", "buy", 0.6, 100.0), pf, snap(sym="BTC-GBP"), 100)   # GBP 60 > GBP 50
    assert not v.ok and any("not enough cash" in r for r in v.reasons)


def test_at_most_two_coins(tmp_path):
    rm = RiskManager(limits(tmp_path))
    pf = Portfolio(cash=50.0)
    pf.apply_fill("BTC-GBP", "buy", 0.05, 100.0, 0.0)
    pf.apply_fill("ETH-GBP", "buy", 0.05, 100.0, 0.0)
    v = rm.check(Order("SOL-GBP", "buy", 0.05, 100.0), pf, snap(sym="SOL-GBP"), 100)
    assert not v.ok and any("maximum of 2 coins" in r for r in v.reasons)
    assert rm.check(Order("BTC-GBP", "buy", 0.02, 100.0), pf, snap(sym="BTC-GBP"), 100).ok  # adding to one held


def test_exchange_minimum(tmp_path):
    rm = RiskManager(limits(tmp_path))
    v = rm.check(Order("BTC-GBP", "buy", 0.005, 100.0), Portfolio(cash=50.0), snap(sym="BTC-GBP"), 100)  # GBP 0.50
    assert not v.ok and any("exchange minimum" in r for r in v.reasons)


def test_policy_sizes_a_50_pound_bet_inside_every_rule(tmp_path):
    it = spot_policy(tmp_path).evaluate(decision(symbol="BTC-GBP", direction_conf=0.97, setup_quality=3.0),
                                        snap(sym="BTC-GBP"), Portfolio(cash=50.0), schema(symbol="BTC-GBP"),
                                        cost_bps=125.0)
    assert it.kind == "enter" and it.side == "buy"
    assert 0.72 <= it.notional <= 15.0 + 1e-9                      # at most 30% of GBP 50


def test_policy_never_opens_a_down_bet(tmp_path):
    it = spot_policy(tmp_path).evaluate(decision(symbol="BTC-GBP", direction="short"), snap(sym="BTC-GBP"),
                                        Portfolio(cash=50.0), schema(symbol="BTC-GBP"), cost_bps=125.0)
    assert it.kind == "hold" and "down-bets not allowed" in it.reason


def test_policy_holds_when_two_coins_are_held(tmp_path):
    pf = Portfolio(cash=30.0)
    pf.apply_fill("ETH-GBP", "buy", 0.1, 100.0, 0.0)
    pf.apply_fill("SOL-GBP", "buy", 0.1, 100.0, 0.0)
    it = spot_policy(tmp_path).evaluate(decision(symbol="BTC-GBP", direction_conf=0.97), snap(sym="BTC-GBP"),
                                        pf, schema(symbol="BTC-GBP"), cost_bps=125.0)
    assert it.kind == "hold" and "holding 2 coins" in it.reason


def test_uk_fees_kill_minute_scalping_but_not_wider_stops(tmp_path):
    """At 0.60% a side, a 0.40% stop can never pay. A 2.5% stop can, if the AI is right often enough."""
    d = decision(symbol="BTC-GBP", direction_conf=0.95, setup_quality=3.0)
    tight = spot_policy(tmp_path, stop=40.0).evaluate(d, snap(sym="BTC-GBP"), Portfolio(cash=50.0),
                                                      schema(symbol="BTC-GBP"), cost_bps=125.0)
    wide = spot_policy(tmp_path, stop=250.0).evaluate(d, snap(sym="BTC-GBP"), Portfolio(cash=50.0),
                                                      schema(symbol="BTC-GBP"), cost_bps=125.0)
    assert tight.kind == "hold" and "no edge" in tight.reason
    assert wide.kind == "enter"


# ------------------------------------------------------------------ end to end
import json
import os

from trader.config import AgentConfig
from trader.shadow import ShadowConfig, ShadowTrader

D0 = 1790208000.0


class Clock:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t


class Scripted:
    """Wants in until told otherwise, then wants out: exercises a full buy -> sell round trip."""

    def __init__(self):
        self.mode = "long"

    def decide(self, s, sch):
        if self.mode == "long":
            return decision(symbol=s.symbol, direction="long", direction_conf=0.97, setup_quality=3.0)
        return decision(symbol=s.symbol, direction="short", direction_conf=0.97, setup_quality=3.0)


def cb_line(ts, mid, sym="BTC-GBP"):
    return json.dumps({"t": "book", "ts": ts, "sym": sym, "bids": [[mid - 1, 1.0]], "asks": [[mid + 1, 1.0]]})


def uk_trader(tmp_path, clk, engine):
    cfg = AgentConfig(risk=limits(tmp_path), costs=COINBASE_GBP_COSTS, spot=True, min_stop_bps=250.0,
                      ledger_path=str(tmp_path / "u.jsonl"))
    scfg = ShadowConfig(tape_dir=str(tmp_path / "tapes"), out_dir=str(tmp_path / "uk"), start_gbp=50.0,
                        tape_prefix="cb", currency="GBP", profile="uk-spot", warm_s=1800)
    return ShadowTrader(scfg, cfg, {"BTC-GBP": schema(symbol="BTC-GBP", allowed_directions=["long", "neutral"])},
                        engine, gbp_per_usd=0.75, clock=clk)


def test_uk_spot_end_to_end_live_view_and_tax(tmp_path):
    os.makedirs(tmp_path / "tapes")
    tape = tmp_path / "tapes" / "cb-20260924.jsonl"
    with open(tape, "w") as f:
        f.write("".join(cb_line(D0 + 3600 + i * 2, 60000 + i) + "\n" for i in range(900)))
    clk, eng = Clock(D0 + 5400), Scripted()
    st = uk_trader(tmp_path, clk, eng)
    st.step()
    assert st.meta["currency"] == "GBP" and st.meta["start_usd"] == 50.0       # no FX on a GBP account

    def minute(mid):
        with open(tape, "a") as f:
            f.write("".join(cb_line(clk.t + i, mid) + "\n" for i in range(0, 60, 2)))
        clk.t += 63
        st.step()

    minute(61000)
    pos = st.agent.portfolio.positions["BTC-GBP"]
    assert pos.qty > 0 and pos.qty * 61000 <= 15.0 + 1e-6                     # <= 30% of GBP 50
    live = json.load(open(tmp_path / "uk" / "live.json"))
    assert live["currency"] == "GBP" and live["positions"][0]["side"] == "up" and live["prices"]["BTC"]["mid"] > 0

    # the live file refreshes between decisions, marked to the newest price
    with open(tape, "a") as f:
        f.write(cb_line(clk.t + 1, 63000) + "\n")
    clk.t += 2.5
    assert st.step() == 0
    live2 = json.load(open(tmp_path / "uk" / "live.json"))
    assert live2["ts"] > live["ts"] and live2["value"] > live["value"]

    eng.mode = "short"                                                         # AI turns: close the up-bet
    minute(62000)
    assert "BTC-GBP" not in st.agent.portfolio.positions or st.agent.portfolio.positions["BTC-GBP"].qty == 0
    assert all(p.qty >= 0 for p in st.agent.portfolio.positions.values())      # never went short
    tax = json.load(open(tmp_path / "uk" / "summary.json"))["tax"]
    assert tax["disposals"] == 1 and "2026/27" in tax["years"]
    assert tax["recent"][0]["asset"] == "BTC" and tax["recent"][0]["rule"] == "same-day"
