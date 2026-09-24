"""Shadow auto-trading: live tape in, paper account out, safe across restarts."""

import json
import os

import pytest

from tests.helpers import decision, schema
from trader.config import AgentConfig, RiskLimits
from trader.jev_client import SimulatedEngine
from trader.shadow import BarClock, LiveTape, ShadowConfig, ShadowTrader, hold_label
from trader.replay import TapeParser

D0 = 1790208000.0  # 2026-09-24 00:00 UTC


class Clock:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t


class AlwaysLong:
    def decide(self, snap, sch):
        return decision(symbol=snap.symbol, direction_conf=0.95, setup_quality=3.0)


def book_line(ts, sym="BTC-PERP", mid=100.0):
    return json.dumps({"t": "book", "ts": ts, "sym": sym, "bids": [[mid - 0.01, 50.0], [mid - 0.02, 50.0]],
                       "asks": [[mid + 0.01, 50.0], [mid + 0.02, 50.0]]})


def append(path, lines):
    with open(path, "a") as f:
        f.write("".join(l + "\n" for l in lines))


def make(tmp_path, clock, engine=None, start_gbp=10_000.0):
    cfg = AgentConfig(risk=RiskLimits(kill_switch_path=str(tmp_path / "KILL")),
                      ledger_path=str(tmp_path / "unused.jsonl"), schema_dir=str(tmp_path / "schemas"))
    scfg = ShadowConfig(tape_dir=str(tmp_path / "tapes"), out_dir=str(tmp_path / "shadow"), start_gbp=start_gbp,
                        warm_s=1800)
    return ShadowTrader(scfg, cfg, {"BTC-PERP": schema()}, engine or SimulatedEngine(), gbp_per_usd=0.8,
                        clock=clock)


@pytest.fixture
def tape(tmp_path):
    os.makedirs(tmp_path / "tapes")
    return tmp_path / "tapes" / "okx-20260924.jsonl"


def test_partial_lines_wait_for_the_newline(tmp_path, tape):
    lt = LiveTape(str(tmp_path / "tapes"), TapeParser())
    line = book_line(D0 + 1)
    with open(tape, "w") as f:
        f.write(line[:30])
    assert lt.poll(D0 + 2) == []
    with open(tape, "a") as f:
        f.write(line[30:] + "\n")
    evs = lt.poll(D0 + 3)
    assert len(evs) == 1 and evs[0].symbol == "BTC-PERP" and lt.parser.st.malformed == 0


def test_day_rollover_finishes_old_file_then_follows_new(tmp_path, tape):
    lt = LiveTape(str(tmp_path / "tapes"), TapeParser())
    append(tape, [book_line(D0 + 86390)])
    assert len(lt.poll(D0 + 86395)) == 1
    append(tape, [book_line(D0 + 86399)])                       # late line in the old file
    nxt = tmp_path / "tapes" / "okx-20260925.jsonl"
    append(nxt, [book_line(D0 + 86401)])
    evs = lt.poll(D0 + 86402)
    assert [e.ts for e in evs] == [D0 + 86399, D0 + 86401]


def test_bar_clock_waits_for_grace_and_keeps_late_lines_in_their_bar():
    bc = BarClock(60, 3, next_end=D0 + 60)
    bc.push([type("E", (), {"ts": D0 + 59.5})()])
    assert bc.due(D0 + 61) == []                                 # inside grace
    out = bc.due(D0 + 63)
    assert len(out) == 1 and out[0][0] == D0 + 60
    assert bc.due(D0 + 200)[0][0] == D0 + 120                    # empty bars still tick


def test_warm_up_never_trades_then_live_bars_do(tmp_path, tape):
    append(tape, [book_line(D0 + 3600 + i * 2, mid=100 + i * 0.001) for i in range(900)])   # 30 min of history
    clk = Clock(D0 + 3600 + 1800)
    st = make(tmp_path, clk, engine=AlwaysLong())
    st.step()
    assert st.warmed and st.book.counts["decisions"] == 0 and not st.book.trades
    for k in range(1, 4):                                        # three live minutes
        append(tape, [book_line(clk.t + i, mid=101) for i in range(0, 60, 2)])
        clk.t += 63
        st.step()
    assert st.book.counts["decisions"] > 0
    assert st.book.counts["entries"] >= 1
    s = json.load(open(tmp_path / "shadow" / "summary.json"))
    assert s["start_gbp"] == 10_000 and s["start_usd"] == pytest.approx(12_500)
    assert s["positions"] and s["positions"][0]["side"] == "up"


def test_restart_restores_account_and_repeats_nothing(tmp_path, tape):
    append(tape, [book_line(D0 + 3600 + i * 2) for i in range(900)])
    clk = Clock(D0 + 5400)
    a = make(tmp_path, clk, engine=AlwaysLong())
    a.step()
    for _ in range(3):
        append(tape, [book_line(clk.t + i, mid=101) for i in range(0, 60, 2)])
        clk.t += 63
        a.step()
    a.save()
    before = json.load(open(tmp_path / "shadow" / "state.json"))
    fills_before = a.book.counts["entries"]
    assert fills_before >= 1
    a.agent.close()

    b = make(tmp_path, clk, engine=AlwaysLong(), start_gbp=99_999)   # start_gbp ignored on restore
    assert b.agent.portfolio.cash == pytest.approx(before["cash"])
    assert {s: [p.qty, p.avg_price] for s, p in b.agent.portfolio.positions.items()} == before["positions"]
    b.step()                                                     # warm-up after restart
    assert b.book.counts["entries"] == fills_before              # history is never re-traded
    assert b.meta["start_gbp"] == 10_000


def test_kill_switch_latch_survives_restart(tmp_path, tape):
    append(tape, [book_line(D0 + 60)])
    clk = Clock(D0 + 120)
    a = make(tmp_path, clk)
    a.agent.risk.trip("test trip")
    a.save()
    a.agent.close()
    b = make(tmp_path, clk)
    assert b.agent.risk.tripped and "test trip" in b.agent.risk.trip_reason


def test_stale_feed_blocks_entries(tmp_path, tape):
    append(tape, [book_line(D0 + 3600 + i * 2) for i in range(900)])
    clk = Clock(D0 + 5400)
    st = make(tmp_path, clk, engine=AlwaysLong())
    st.step()
    for _ in range(3):                                           # data stops; bars keep ticking
        clk.t += 63
        st.step()
    assert st.book.counts["entries"] == 0
    assert st.book.counts["bars"] == 3
    assert st.book.counts["rejects"] >= 1                        # the risk layer refused, not the engine


def test_hold_labels_are_plain_english():
    assert hold_label("setup 1.20<2; conf 0.50<=0.8") == "Set-up not strong enough"
    assert hold_label("no edge after costs p=0.5") == "Not worth it after fees"
    assert hold_label("symbol frozen pending brain review; neutral") == "Paused for a second opinion"
    assert hold_label("something new") == "Other"


def test_shadow_module_cannot_reach_a_venue():
    import trader.shadow as m
    src = open(m.__file__).read()
    assert "urllib" not in src and "requests" not in src and "socket" not in src
    assert "PaperBroker" in open(os.path.join(os.path.dirname(m.__file__), "agent.py")).read()


def test_cli_shadow_command_wires_up(monkeypatch, tmp_path):
    """Runs the real `python -m trader shadow` path up to the loop."""
    import sys
    import trader.__main__ as cli
    import trader.shadow as sh
    seen = {}

    class Stub:
        def __init__(self, scfg, cfg, schemas, engine, fx, engine_name, brain=None, calibrator=None):
            seen.update(scfg=scfg, schemas=schemas, engine_name=engine_name, fx=fx)

        def run(self):
            seen["ran"] = True

    monkeypatch.setattr(sh, "ShadowTrader", Stub)
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    monkeypatch.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    monkeypatch.setattr(sys, "argv", ["trader", "shadow", "--tape-dir", str(tmp_path), "--out", str(tmp_path / "o")])
    cli.main()
    assert seen["ran"] and seen["engine_name"] == "practice" and len(seen["schemas"]) == 7
    assert seen["scfg"].start_gbp == 10_000 and 0.3 < seen["fx"] < 2
