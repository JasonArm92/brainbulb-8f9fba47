"""Console stats: coverage, gaps, cache and alerts from recorder tapes."""

import gzip
import importlib.util
import json
import os

import pytest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("console_stats", os.path.join(HERE, "scripts", "console_stats.py"))
cs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cs)

D0 = 1790208000.0  # 2026-09-24T00:00:00Z


def book(ts, sym="BTC-PERP", bid=100.0, ask=100.1):
    return json.dumps({"t": "book", "ts": ts, "sym": sym, "bids": [[bid, 1.0]], "asks": [[ask, 1.0]]})


@pytest.fixture
def tapes(tmp_path, monkeypatch):
    monkeypatch.setattr(cs, "TAPES", str(tmp_path))
    monkeypatch.setattr(cs, "CACHE", str(tmp_path / ".stats-cache.json"))
    monkeypatch.setattr(cs, "system_state", lambda: {"recorder_running": True, "pid": 1, "on_ac": True,
                                                     "disk_free_gb": 50.0, "disk_used_pct": 50.0, "tape_bytes": 0})
    return tmp_path


def write_day(path, start, end, step=2.0, skip=None, gz=False):
    lines = [json.dumps({"t": "meta", "venue": "okx"})]
    t = start
    while t < end:
        if not (skip and skip[0] <= t < skip[1]):
            lines.append(book(t))
            lines.append(json.dumps({"t": "trade", "ts": t, "sym": "BTC-PERP", "px": 100, "qty": 1, "side": "buy"}))
        t += step
    data = "\n".join(lines) + "\n"
    if gz:
        with gzip.open(str(path) + ".gz", "wt") as f:
            f.write(data)
    else:
        path.write_text(data)


def test_coverage_counts_hours_and_finds_the_sleep_gap(tapes):
    # day 1 from 06:00 with a 2 h sleep at 12:00; day 2 partial to 03:00
    write_day(tapes / "okx-20260924.jsonl", D0 + 6 * 3600, D0 + 86400,
              skip=(D0 + 12 * 3600, D0 + 14 * 3600), gz=True)
    write_day(tapes / "okx-20260925.jsonl", D0 + 86400, D0 + 86400 + 3 * 3600)
    out = cs.collect(now=D0 + 86400 + 3 * 3600)
    d1, d2 = out["days"]
    assert d1["day"] == "2026-09-24" and d1["expected_hours"] == 18.0
    assert d1["hours"] == pytest.approx(16.0, abs=0.05)
    assert [g["min"] for g in d1["gaps"]] == [120]
    assert d2["hours"] == pytest.approx(3.0, abs=0.05) and d2["gaps"] == []
    assert out["covered_hours"] == pytest.approx(19.0, abs=0.1)
    assert any(a["level"] == "warning" and "gap" in a["text"] for a in out["alerts"])
    assert not any(a["level"] == "critical" for a in out["alerts"])
    assert out["newest"]["BTC"]["spread_bp"] == pytest.approx(10.0, rel=0.01)


def test_stale_tape_raises_critical(tapes):
    write_day(tapes / "okx-20260924.jsonl", D0, D0 + 3600)
    out = cs.collect(now=D0 + 3600 + 30 * 60)
    crit = [a["text"] for a in out["alerts"] if a["level"] == "critical"]
    assert crit and "30 min" in crit[0]
    assert out["days"][0]["gaps"][-1]["min"] >= 29      # the trailing silence is a gap too


def test_finished_days_come_from_cache(tapes, monkeypatch):
    write_day(tapes / "okx-20260924.jsonl", D0, D0 + 86400, step=30)
    write_day(tapes / "okx-20260925.jsonl", D0 + 86400, D0 + 86400 + 600)
    cs.collect(now=D0 + 86400 + 600)
    calls = []
    real = cs.scan_file
    monkeypatch.setattr(cs, "scan_file", lambda p: calls.append(os.path.basename(p)) or real(p))
    cs.collect(now=D0 + 86400 + 600)
    assert calls == ["okx-20260925.jsonl"]                 # only today is re-read


def test_bad_lines_and_system_alerts(tapes, monkeypatch):
    p = tapes / "okx-20260924.jsonl"
    write_day(p, D0, D0 + 600)
    with open(p, "a") as f:
        f.write("garbage\n" + book(D0 + 10) + "\n")     # out of order
    monkeypatch.setattr(cs, "system_state", lambda: {"recorder_running": False, "pid": None, "on_ac": False,
                                                     "disk_free_gb": 2.0, "disk_used_pct": 99.0, "tape_bytes": 0})
    out = cs.collect(now=D0 + 600)
    assert out["tape"]["malformed"] == 1 and out["tape"]["out_of_order"] == 1
    texts = " ".join(a["text"] for a in out["alerts"])
    assert "not running" in texts and "battery" in texts and "Disk space low" in texts


def test_unlock_reminders_after_the_date(tapes):
    write_day(tapes / "okx-20261003.jsonl", D0 + 9 * 86400, D0 + 9 * 86400 + 600)
    out = cs.collect(now=D0 + 9 * 86400 + 600)            # 3 Oct
    infos = [a["text"] for a in out["alerts"] if a["level"] == "info"]
    assert any("SUI" in t for t in infos) and any("ENA" in t for t in infos) and not any("HYPE" in t for t in infos)


def test_empty_tape_dir_is_critical_not_a_crash(tapes):
    out = cs.collect(now=D0)
    assert out["days"] == [] and any(a["level"] == "critical" for a in out["alerts"])
