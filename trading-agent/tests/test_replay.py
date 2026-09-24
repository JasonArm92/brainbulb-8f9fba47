"""Replay harness (review item #5) and the OKX tape recorder."""

import dataclasses
import json
import os

import pytest

from tests.helpers import schema
from trader.config import AgentConfig, RiskLimits
from trader.jev_client import SimulatedEngine
from trader.okx_tape import Recorder, book_line, funding_lines, trade_lines
from trader.replay import (ReplayResult, TapeStats, bars, read_tape, replay, rung1_check)
from trader.sim import SimMarket

RAW = json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", "okx_raw_2026-09-24.json")))
SYMS = ("BTC-PERP", "ETH-PERP")


def cfg(tmp_path):
    return AgentConfig(risk=RiskLimits(kill_switch_path=str(tmp_path / "KILL")),
                       ledger_path=str(tmp_path / "ledger.jsonl"), schema_dir=str(tmp_path / "schemas"))


def schemas():
    return {"BTC-PERP": schema(), "ETH-PERP": schema(symbol="ETH-PERP", name="ETH")}


def write_tape(path, n_bars=300, bar_s=600.0, funding_rate=0.0001, seed=5, extra=()):
    """Tape in the recorder's format, driven by SimMarket prices, with 8h funding prints."""
    m = SimMarket(SYMS, seed=seed, bar_s=bar_s)
    with open(path, "w") as f:
        f.write(json.dumps({"t": "meta", "venue": "test"}) + "\n")
        next_funding = (m.t // 28800 + 1) * 28800
        for _ in range(n_bars):
            now, books, trades = m.step()
            for b in books.values():
                f.write(json.dumps({"t": "book", "ts": b.ts, "sym": b.symbol,
                                    "bids": [list(x) for x in b.bids], "asks": [list(x) for x in b.asks]}) + "\n")
            for t in trades:
                f.write(json.dumps({"t": "trade", "ts": t.ts, "sym": t.symbol, "px": t.price,
                                    "qty": t.qty, "side": t.side}) + "\n")
            while next_funding <= now:
                for s in SYMS:
                    f.write(json.dumps({"t": "funding", "ts": next_funding, "sym": s, "rate": funding_rate}) + "\n")
                next_funding += 28800
        for line in extra:
            f.write(line + "\n")
    return path


# --- recorder parsing against real OKX responses --------------------------------
def test_real_okx_book_parses_to_base_units():
    line = book_line(RAW["books"], "BTC-PERP", ct_val=0.01)
    assert line["ts"] == pytest.approx(1790268861.706)
    assert line["bids"][0] == [84446.9, pytest.approx(4.7141)]   # 471.41 contracts x 0.01 BTC
    assert line["asks"][0] == [84447.0, pytest.approx(15.0416)]
    assert line["bids"][0][0] < line["asks"][0][0]


def test_real_okx_trades_dedupe_and_gap_detection():
    lines, last, gap = trade_lines(RAW["trades"], "BTC-PERP", 0.01, last_id=None)
    assert [l["id"] for l in lines] == sorted(l["id"] for l in lines) and len(lines) == 5
    assert last == 2882543835 and gap is None
    again, _, _ = trade_lines(RAW["trades"], "BTC-PERP", 0.01, last_id=last)
    assert again == []                                              # nothing double-counted
    _, _, gap = trade_lines(RAW["trades"], "BTC-PERP", 0.01, last_id=2882543800)
    assert gap and "30 trade ids" in gap["detail"]


def test_funding_lines_emit_each_settlement_once():
    resp = {"code": "0", "data": [{"fundingTime": "1790236800000", "realizedRate": "0.0000295"},
                                  {"fundingTime": "1790208000000", "realizedRate": "0.0000049"}]}
    seen = set()
    first = funding_lines(resp, "BTC-PERP", seen)
    assert [l["ts"] for l in first] == [1790208000.0, 1790236800.0]
    assert funding_lines(resp, "BTC-PERP", seen) == []


def test_okx_error_code_raises():
    with pytest.raises(RuntimeError):
        book_line({"code": "51001", "msg": "Instrument ID does not exist"}, "X", 1.0)


def test_recorder_writes_valid_tape_and_records_holes(tmp_path):
    def fake_get(path, **p):
        if path.endswith("instruments"):
            return RAW["instrument"]
        if path.endswith("books"):
            if p["instId"] == "ETH-USDT-SWAP":
                raise TimeoutError("simulated outage")
            return RAW["books"]
        if path.endswith("trades"):
            return RAW["trades"]
        return {"code": "0", "data": [{"fundingTime": "1790236800000", "realizedRate": "0.0000295"}]}

    rec = Recorder(str(tmp_path / "t.jsonl"), symbols={"BTC-PERP": "BTC-USDT-SWAP", "ETH-PERP": "ETH-USDT-SWAP"},
                   get=fake_get)
    rec.load_specs()
    lines = rec.poll_once(now=1790268862.0)
    kinds = [l["t"] for l in lines]
    assert "book" in kinds and "trade" in kinds and "funding" in kinds
    assert any(l["t"] == "gap" and l["sym"] == "ETH-PERP" for l in lines)
    with open(tmp_path / "t.jsonl", "w") as f:
        for l in lines:
            f.write(json.dumps(l) + "\n")
    st = TapeStats()
    evs = list(read_tape(str(tmp_path / "t.jsonl"), st))
    assert st.books == 1 and st.funding == 2 and st.recorder_gaps == 1 and st.malformed == 0
    assert len(evs) == st.books + st.trades + st.funding


# --- tape hygiene ---------------------------------------------------------------
def test_bad_lines_are_counted_and_dropped(tmp_path):
    p = tmp_path / "bad.jsonl"
    p.write_text("\n".join([
        '{"t":"book","ts":10,"sym":"BTC-PERP","bids":[[100,1]],"asks":[[101,1]]}',
        '{"t":"book","ts":11,"sym":"BTC-PERP","bids":[[102,1]],"asks":[[101,1]]}',   # crossed
        '{"t":"book","ts":9,"sym":"BTC-PERP","bids":[[100,1]],"asks":[[101,1]]}',    # out of order
        '{"t":"trade","ts":12,"sym":"BTC-PERP","px":-1,"qty":1,"side":"buy"}',       # bad price
        'not json',
        '{"t":"funding","ts":13,"sym":"BTC-PERP","rate":0.0001}',
    ]))
    st = TapeStats()
    evs = list(read_tape(str(p), st))
    assert (st.books, st.crossed, st.out_of_order, st.malformed, st.funding) == (1, 1, 1, 2, 1)
    assert [type(e).__name__ for e in evs] == ["BookUpdate", "FundingEvent"]


def test_bars_close_on_boundaries_and_never_include_future():
    from trader.state_engine import BookUpdate, Trade
    b = lambda ts: BookUpdate(ts, "BTC-PERP", ((99.0, 1.0),), ((101.0, 1.0),))
    evs = [b(5), Trade(30, "BTC-PERP", 100, 1, "buy"), b(61), b(200)]
    out = list(bars(evs, 60))
    assert [e for e, *_ in out] == [60, 120, 180, 240]
    for end, books, trades, _ in out:
        assert all(x.ts <= end for x in books.values()) and all(t.ts <= end for t in trades)
    assert out[2][1] == {}                                          # empty bar still ticks


# --- end-to-end -----------------------------------------------------------------
def test_replay_runs_loop_books_funding_and_is_causal(tmp_path):
    tape = write_tape(tmp_path / "tape.jsonl", n_bars=432)            # 3 days of 10-min bars
    res = replay(str(tape), schemas(), SimulatedEngine(), cfg(tmp_path), bar_s=600, heldout_frac=1 / 3)
    assert res.tape.malformed == 0 and res.causality_rejects == 0
    assert len(res.days) >= 3 and res.heldout_days == res.days[-len(res.heldout_days):]
    assert res.fills > 0
    recs = [json.loads(l) for l in open(res.ledger_path)]
    assert any(r["kind"] == "funding" for r in recs)
    total_daily = sum(d["net_pnl"] for d in res.daily.values())
    assert total_daily == pytest.approx(res.net_pnl, abs=1e-6)
    assert res.max_drawdown < RiskLimits().max_drawdown
    ok, fails = rung1_check(res)
    assert not ok and any("days of tape" in f for f in fails)       # 3 days can never pass rung 1


def test_funding_changes_replay_pnl(tmp_path):
    a = replay(str(write_tape(tmp_path / "a.jsonl", 300, funding_rate=0.0)), schemas(), SimulatedEngine(),
               dataclasses.replace(cfg(tmp_path), ledger_path=str(tmp_path / "a.ledger")), bar_s=600)
    b = replay(str(write_tape(tmp_path / "b.jsonl", 300, funding_rate=0.003)), schemas(), SimulatedEngine(),
               dataclasses.replace(cfg(tmp_path), ledger_path=str(tmp_path / "b.ledger")), bar_s=600)
    assert a.funding_paid == 0.0 and b.funding_paid != 0.0


class AlwaysLong:
    """Engine that always wants in, so only the risk layer can stop an entry."""

    def decide(self, snap, sch):
        from tests.helpers import decision
        return decision(symbol=snap.symbol, direction_conf=0.95, setup_quality=3.0)


def test_stale_symbol_cannot_trade(tmp_path):
    # ETH books stop early; its snapshot goes stale and the risk layer must refuse every entry.
    tape = tmp_path / "stale.jsonl"
    write_tape(tape, n_bars=200)
    lines = open(tape).read().splitlines()
    cutoff = json.loads(lines[1])["ts"] + 3000
    kept = [l for l in lines if not (json.loads(l).get("sym") == "ETH-PERP"
                                     and json.loads(l).get("t") in ("book", "trade")
                                     and json.loads(l)["ts"] > cutoff)]
    tape.write_text("\n".join(kept) + "\n")
    res = replay(str(tape), schemas(), AlwaysLong(), cfg(tmp_path), bar_s=600)
    recs = [json.loads(l) for l in open(res.ledger_path)]
    late = [r for r in recs if r["kind"] in ("fill", "reject") and r["order"]["symbol"] == "ETH-PERP"
            and r["ts"] > cutoff + 600]
    assert late, "the engine kept asking to trade ETH"
    assert all(r["kind"] == "reject" for r in late)
    assert all(any("stale market data" in x for x in r["reasons"]) for r in late)


def test_replay_refuses_to_overwrite_a_ledger(tmp_path):
    c = cfg(tmp_path)
    open(c.ledger_path, "w").close()
    with pytest.raises(FileExistsError):
        replay(str(write_tape(tmp_path / "t.jsonl", 10)), schemas(), SimulatedEngine(), c, bar_s=600)


def _result(**kw):
    base = dict(tape=TapeStats(), days=[f"d{i}" for i in range(30)], heldout_days=["d29"], daily={},
                net_pnl=10.0, heldout_net_pnl=1.0, fees=1.0, funding_paid=0.5, fills=10, risk_rejects=0,
                causality_rejects=0, max_drawdown=0.01, kill_tripped=False, n_calls_heldout=500,
                heldout_brier=0.2, heldout_brier_baseline=0.25, heldout_brier_skill=0.2, ledger_path="x")
    base.update(kw)
    return ReplayResult(**base)


def test_rung1_passes_only_when_every_criterion_holds():
    assert rung1_check(_result()) == (True, [])
    for bad in (dict(days=["d"] * 29), dict(heldout_brier_skill=0.0), dict(heldout_brier_skill=None),
                dict(net_pnl=-1.0), dict(heldout_net_pnl=0.0), dict(kill_tripped=True),
                dict(n_calls_heldout=10)):
        ok, fails = rung1_check(_result(**bad))
        assert not ok and fails, bad


def test_recorder_touches_only_public_read_endpoints():
    import re
    import trader.okx_tape as m
    src = open(m.__file__).read()
    paths = set(re.findall(r'"(/api/v5/[^"]+)"', src))
    assert paths and all(p.startswith(("/api/v5/public/", "/api/v5/market/")) for p in paths), paths
    assert "method=" not in src and "POST" not in src and "api_key" not in src.lower()


def test_stale_trades_response_cannot_rewind_cursor():
    fresh = {"code": "0", "data": [{"tradeId": str(i), "px": "1", "sz": "1", "side": "buy", "ts": str(1000 + i)}
                                   for i in range(10, 21)]}
    stale = {"code": "0", "data": [{"tradeId": str(i), "px": "1", "sz": "1", "side": "buy", "ts": str(1000 + i)}
                                   for i in range(5, 13)]}
    _, cur, _ = trade_lines(fresh, "X", 1.0, None)
    lines, cur2, gap = trade_lines(stale, "X", 1.0, cur)
    assert cur == cur2 == 20 and lines == [] and gap is None
    again, _, _ = trade_lines(fresh, "X", 1.0, cur2)
    assert again == []                                              # no duplicates after a stale reply


def test_recorder_skips_stale_book_snapshot():
    books = [RAW["books"], json.loads(json.dumps(RAW["books"]))]
    books[1]["data"][0]["ts"] = str(int(books[0]["data"][0]["ts"]) - 5000)   # older, cached copy
    it = iter(books)

    def get(path, **p):
        if path.endswith("instruments"):
            return RAW["instrument"]
        if path.endswith("books"):
            return next(it)
        return {"code": "0", "data": []}

    rec = Recorder("unused", symbols={"BTC-PERP": "BTC-USDT-SWAP"}, get=get, funding_every_s=1e12)
    rec.load_specs()
    first = [l for l in rec.poll_once(1.0) if l["t"] == "book"]
    second = [l for l in rec.poll_once(2.0) if l["t"] == "book"]
    assert len(first) == 1 and second == []
