import dataclasses
import json
import os

from updown.config import Config, RiskConfig, SimMarketConfig
from updown.engine import Engine
from updown.ledger import Ledger

from conftest import Clock, WalkFeed

T0 = 1790330400.0     # 2026-09-25 10:00:00 UTC, a window boundary


def make(tmp_path, clock, feed=None, **risk):
    cfg = Config(sim=SimMarketConfig(seed=7), risk=dataclasses.replace(RiskConfig(), **risk),
                 db_path=str(tmp_path / "lab.sqlite"), kill_path=str(tmp_path / "KILL"))
    return Engine(cfg, feed or WalkFeed(clock), clock=clock), cfg


def run(e, clock, seconds, step=0.5):
    end = clock.t + seconds
    while clock.t < end:
        clock.t += step
        e.tick()


def test_three_hours_of_windows(tmp_path):
    clock = Clock(T0 - 1)
    e, cfg = make(tmp_path, clock)
    start = e.risk.bankroll_usd
    run(e, clock, 3 * 3600)
    wins = [w for w in e.ledger.windows(100) if w["outcome"] in ("UP", "DOWN")]
    assert len(wins) >= 34
    tot = e.ledger.totals()
    assert abs(e.risk.bankroll_usd - (start + tot["pnl_usd"])) < 1e-6         # books balance
    assert tot["pairs"] > 0 and tot["avg_pair_cost"] < 1.0                   # paired below $1
    for w in wins:                                                          # quotes respect the spend cap;
        fl = e.ledger.fills(w["start"])                                      # only risk-reducing hedges go past it
        assert sum(f["price"] * f["qty"] for f in fl if f["kind"] == "maker") <= cfg.risk.max_window_cost_usd + 1e-6
        yes = no = 0.0
        for f in fl:
            if f["kind"] == "hedge":
                assert (f["side"] == "NO" and yes > no) or (f["side"] == "YES" and no > yes)   # hedge buys the light side
                assert f["qty"] <= abs(yes - no) + 1e-6                                  # never flips the tilt
            yes += f["qty"] if f["side"] == "YES" else 0
            no += f["qty"] if f["side"] == "NO" else 0
    for w in wins:                                                          # payout = winning side's shares
        assert abs(w["payout"] - (w["yes_qty"] if w["outcome"] == "UP" else w["no_qty"])) < 1e-9
    snap = e.snapshot()
    json.dumps(snap)                                                         # UI state is serialisable
    assert snap["mode"] == "paper" and snap["market"] == "simulated" and snap["account"]["bankroll_gbp"] > 0
    cal = e.ledger.calibration()
    assert cal["n"] >= 100


def test_restart_mid_window_keeps_inventory(tmp_path):
    clock = Clock(T0 - 1)
    e, cfg = make(tmp_path, clock)
    run(e, clock, 300 + 200)                                                 # into the second window
    inv = e.inv.as_dict()
    assert inv["yes_qty"] + inv["no_qty"] > 0
    e2 = Engine(cfg, e.feed, clock=clock)
    assert e2.window.start == e.window.start and e2.inv.yes_qty == inv["yes_qty"] and e2.inv.no_qty == inv["no_qty"]


def test_restart_after_missed_close_voids_at_cost(tmp_path):
    clock = Clock(T0 - 1)
    e, cfg = make(tmp_path, clock)
    run(e, clock, 150)
    br = e.risk.bankroll_usd
    clock.t += 600                                                           # offline over a close
    e2 = Engine(cfg, e.feed, clock=clock)
    w = [x for x in e2.ledger.windows(5) if x["start"] == int(T0)][0]
    assert w["outcome"] == "VOID" and w["pnl_usd"] == 0 and e2.risk.bankroll_usd == br


def test_kill_switch_file_and_phone(tmp_path):
    clock = Clock(T0 - 1)
    e, cfg = make(tmp_path, clock)
    run(e, clock, 30)
    open(cfg.kill_path, "w").close()
    run(e, clock, 2)
    assert e.risk.killed and e.quote.yes_bid is None
    os.remove(cfg.kill_path)
    e.set_kill(False)
    run(e, clock, 2)
    assert e.quote.yes_bid is not None


def test_breaker_halts_quoting(tmp_path):
    clock = Clock(T0 - 1)
    e, cfg = make(tmp_path, clock, breaker_bleed_usd=0.01)                   # trips on the first real hedge
    run(e, clock, 1800)
    assert any(ev["kind"] == "breaker" for ev in e.ledger.events(50))
    assert e.snapshot()["risk"]["halted"]


def test_untrusted_reference_stops_quotes(tmp_path):
    clock = Clock(T0 - 1)
    e, _ = make(tmp_path, clock, feed=WalkFeed(Clock(0) if False else clock, sources=1))
    run(e, clock, 20)
    assert e.quote.yes_bid is None and "not trusted" in e.quote.reason
