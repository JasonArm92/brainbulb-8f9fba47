"""Coinbase GBP recorder against real Coinbase responses."""

import json
import os
import re

import pytest

from trader.coinbase_tape import CoinbaseRecorder, book_line, iso_ts, trade_lines
from trader.replay import TapeParser

RAW = json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", "coinbase_raw_2026-09-24.json")))


def test_nanosecond_timestamps():
    assert iso_ts("2026-09-24T22:18:41.278374160Z") == pytest.approx(1790288321.278374)
    assert iso_ts("2026-09-24T22:18:41Z") == pytest.approx(1790288321.0)


def test_real_book_parses_in_pounds():
    b = book_line(RAW["book"], "BTC-GBP")
    assert b["bids"][0] == [63640.03, 0.0039] and b["asks"][0] == [63650.77, 0.00713238]
    assert b["ts"] == pytest.approx(1790288321.278374)
    ev = TapeParser().feed(json.dumps(b))
    assert ev is not None and ev.symbol == "BTC-GBP"


def test_trade_side_is_flipped_to_the_aggressor():
    lines, cursor, gap = trade_lines(RAW["trades"], "BTC-GBP", None)
    assert [l["id"] for l in lines] == ["49432249", "49432250", "49432251"]
    assert [l["side"] for l in lines] == ["buy", "sell", "buy"]         # maker sell = taker buy
    assert cursor == 49432251 and gap is None
    again, c2, _ = trade_lines(RAW["trades"][1:], "BTC-GBP", cursor)   # stale reply
    assert again == [] and c2 == cursor


def test_recorder_poll_and_outage(tmp_path):
    def get(path, **p):
        if "ETH-GBP" in path:
            raise TimeoutError("down")
        return RAW["book"] if path.endswith("/book") else RAW["trades"]

    rec = CoinbaseRecorder(str(tmp_path / "t.jsonl"), symbols={"BTC-GBP": "BTC-GBP", "ETH-GBP": "ETH-GBP"}, get=get)
    lines = rec.poll_once(now=1790288322.0)
    kinds = [(l["t"], l["sym"]) for l in lines]
    assert ("book", "BTC-GBP") in kinds and ("trade", "BTC-GBP") in kinds and ("gap", "ETH-GBP") in kinds
    assert rec.poll_once(now=1790288324.0) == [] or all(l["t"] != "book" for l in rec.poll_once(1790288326.0))


def test_recorder_uses_public_read_endpoints_only():
    import trader.coinbase_tape as m
    src = open(m.__file__).read()
    assert set(re.findall(r'f"(/products/[^"]+)"', src)) == {"/products/{pid}/book", "/products/{pid}/trades"}
    assert "POST" not in src and "api_key" not in src.lower() and "/orders" not in src
