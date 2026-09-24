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
    monkeypatch.setattr(cs, "FX_CACHE", str(tmp_path / ".fx.json"))
    monkeypatch.setattr(cs, "SHADOW_SUMMARY", str(tmp_path / "no-shadow.json"))
    monkeypatch.setattr(cs, "FX_URL", "http://127.0.0.1:9/unreachable")
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


def test_fx_falls_back_to_last_good_rate(tapes):
    assert cs.fx_rate(D0) is None                          # nothing cached, network down
    (tapes / ".fx.json").write_text(json.dumps({"gbp_per_usd": 0.755, "ts": D0, "source": "Coinbase", "stale": False}))
    fx = cs.fx_rate(D0 + 60)
    assert fx["gbp_per_usd"] == 0.755 and fx["stale"] is True


def test_hourly_spark_points(tapes):
    write_day(tapes / "okx-20260924.jsonl", D0, D0 + 5 * 3600, step=60)
    out = cs.collect(now=D0 + 5 * 3600)
    pts = out["spark"]["BTC"]
    assert [p[0] for p in pts] == [D0 + h * 3600 for h in range(5)]
    assert pts[0][1] == pytest.approx(100.05)


def test_shadow_summary_and_alerts(tapes, monkeypatch):
    write_day(tapes / "okx-20260924.jsonl", D0, D0 + 600)
    sfile = tapes / "summary.json"
    sfile.write_text(json.dumps({"updated_ts": D0 - 1200, "equity_usd": 12000, "day_pnl_frac": -0.026,
                                 "limits": {"max_daily_loss": 0.03}, "kill": {"tripped": True, "reason": "max drawdown 15%"},
                                 "equity_series": [[D0, 12500], [D0 + 900, 12000]]}))
    monkeypatch.setattr(cs, "SHADOW_SUMMARY", str(sfile))
    out = cs.collect(now=D0 + 600)
    assert out["shadow"]["equity_usd"] == 12000 and "equity_series" not in out["shadow"]
    assert out["shadow_equity"] == [[D0 + 900, 12000]]              # one point per hour
    texts = " ".join(a["text"] for a in out["alerts"])
    assert "emergency stop" in texts and "not updated" in texts and "daily limit" in texts


def test_okx_hourly_parses_and_sorts(monkeypatch):
    import io
    body = json.dumps({"code": "0", "data": [["1790272800000", "1", "1", "1", "84100.5", "0"],
                                             ["1790269200000", "1", "1", "1", "84000.0", "0"]]}).encode()

    class R(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(cs.urllib.request, "urlopen", lambda req, timeout=0: R(body))
    assert cs.okx_hourly("BTC") == [[1790269200.0, 84000.0], [1790272800.0, 84100.5]]
    monkeypatch.setattr(cs.urllib.request, "urlopen", lambda req, timeout=0: R(b'{"code":"50011","data":[]}'))
    assert cs.okx_hourly("BTC") is None
