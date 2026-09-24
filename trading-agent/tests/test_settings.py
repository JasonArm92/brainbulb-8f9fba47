"""Operator settings from the live view: strategy knobs move freely, safety limits only tighten."""

import json
import os

from trader import settings as S
from trader.config import UK_SMALL_ACCOUNT, RiskLimits

from tests.test_uk_spot import Clock, Scripted, cb_line, uk_trader, D0


def test_limits_can_only_tighten():
    s, notes = S.clean("uk-spot", {"max_per_coin_pct": 90, "daily_loss_pct": 10, "drawdown_pct": 50,
                                    "max_coins": 5, "max_total_pct": 20})
    assert (s["max_per_coin_pct"], s["daily_loss_pct"], s["drawdown_pct"], s["max_coins"]) == (30, 3, 15, 2)
    assert s["max_total_pct"] == 20                                          # tighter is fine
    assert sum("can only be made stricter" in n for n in notes) == 4
    _g, lim, _st, _rr = S.apply_to("uk-spot", s, "runtime/KILL")
    for f in ("max_position_frac", "max_order_frac", "max_gross_frac", "max_daily_loss", "max_drawdown"):
        assert getattr(lim, f) <= getattr(UK_SMALL_ACCOUNT, f)
    assert lim.max_gross_frac == 0.20 and not lim.allow_short and lim.require_cash
    assert RiskLimits().max_drawdown == 0.15                                 # defaults untouched


def test_knob_bounds_and_junk():
    s, notes = S.clean("uk-spot-fast", {"min_confidence": 0.2, "stop_pct": 99, "decision_every_s": 12,
                                         "coins": ["BTC", "DOGE"], "bogus": 1, "reward_risk": "x"})
    assert s["min_confidence"] == 0.60 and s["stop_pct"] == 5.0 and s["decision_every_s"] in (10, 15)
    assert s["coins"] == ["BTC"] and "bogus" not in s and s["reward_risk"] == 1.2
    assert S.defaults("uk-spot-fast")["require_edge"] is False and S.defaults("uk-spot")["require_edge"] is True


def test_running_bot_picks_up_settings_and_pause(tmp_path):
    os.makedirs(tmp_path / "tapes")
    tape = tmp_path / "tapes" / "cb-20260924.jsonl"
    with open(tape, "w") as f:
        f.write("".join(cb_line(D0 + 3600 + i * 2, 60000 + i) + "\n" for i in range(900)))
    clk = Clock(D0 + 5400)
    st = uk_trader(tmp_path, clk, Scripted())
    st.step()
    assert st.clockbars.bar_s == 60 and st.settings["decision_every_s"] == 60
    S.save(st.settings_path, "uk-spot", {"decision_every_s": 15, "paused": True, "max_per_coin_pct": 10})
    clk.t += 1.5
    st.step()
    assert st.clockbars.bar_s == 15 and st.agent.policy.paused
    assert st.agent.risk.limits.max_position_frac == 0.10 and st.agent.policy.limits is st.agent.risk.limits
    with open(tape, "a") as f:
        f.write("".join(cb_line(clk.t + i, 61000) + "\n" for i in range(0, 60, 2)))
    clk.t += 63
    st.step()
    assert not st.agent.portfolio.positions or all(p.qty == 0 for p in st.agent.portfolio.positions.values())
    live = json.load(open(tmp_path / "uk" / "live.json"))
    assert live["paused"] and live["decision_every_s"] == 15
    assert any(t["label"] == "Paused by you" for t in live["thoughts"])
    assert live["thoughts"][-1]["ai"]["direction"] == "long"


def test_reset_archives_and_restarts_with_new_money(tmp_path):
    os.makedirs(tmp_path / "tapes")
    clk = Clock(D0 + 5400)
    st = uk_trader(tmp_path, clk, Scripted())
    st.save()
    S.save(st.settings_path, "uk-spot", {"paused": True})
    with open(st.reset_path, "w") as f:
        json.dump({"start_gbp": 2500}, f)
    clk.t += 2
    st.step()
    assert st._stop                                                          # exits so launchd restarts it
    st2 = uk_trader(tmp_path, clk, Scripted())
    assert st2.agent.portfolio.cash == 2500 and st2.meta["start_gbp"] == 2500
    assert not os.path.exists(st2.reset_path) and os.path.exists(st2.settings_path)   # settings kept
    arch = os.listdir(tmp_path / "archive")
    assert len(arch) == 1 and "state.json" in os.listdir(tmp_path / "archive" / arch[0])
