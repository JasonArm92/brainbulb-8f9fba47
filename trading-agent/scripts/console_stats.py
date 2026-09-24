#!/usr/bin/env python3
"""Recorder health for the operator console. Read-only: never touches trading.

  python3 scripts/console_stats.py            # JSON to stdout
  python3 scripts/console_stats.py --pretty

What it reports:
  * coverage per UTC day: minutes that have at least one order-book snapshot,
    and every gap of 10+ minutes (the Mac slept, the network dropped, the
    recorder stopped);
  * tape hygiene: malformed, crossed, out-of-order lines, recorder gap lines;
  * the newest book per coin (mid, spread);
  * recorder process, charger state, disk space;
  * alerts, each with a level (critical / warning / info).

Finished days are cached in tapes/.stats-cache.json keyed by file name, size
and mtime, so a run only parses today's file in full.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAPES = os.path.join(ROOT, "tapes")
CACHE = os.path.join(TAPES, ".stats-cache.json")
TARGET_DAYS = 30
GAP_MIN = 10            # minutes without a book that count as a gap
STALE_MIN = 15          # newest book older than this -> critical
LABEL = "com.jason.okx-recorder"
SHADOW_LABEL = "com.jason.shadow-trader"
SHADOW_SUMMARY = os.path.join(ROOT, "runtime", "shadow", "summary.json")
FX_URL = "https://api.coinbase.com/v2/exchange-rates?currency=USD"
FX_CACHE = os.path.join(TAPES, ".fx.json")
UNLOCKS = {"SUI": "2026-10-01", "ENA": "2026-10-02", "HYPE": "2026-10-06"}

_TS = re.compile(r'"ts":\s*([0-9.]+)')
_SYM = re.compile(r'"sym":\s*"([A-Z0-9-]+)"')


def _open(path: str):
    return gzip.open(path, "rt") if path.endswith(".gz") else open(path)


def scan_file(path: str) -> dict:
    """One pass over a tape file. Book lines are parsed with a cheap regex;
    everything else is only type-checked."""
    minutes: set[int] = set()
    hourly: dict[str, dict[int, str]] = {}      # sym -> hour -> last book line in that hour
    books: dict[str, int] = {}
    last: dict[str, list] = {}
    st = {"lines": 0, "malformed": 0, "crossed": 0, "out_of_order": 0, "recorder_gaps": 0,
          "first_ts": None, "last_ts": None}
    prev: dict[tuple, float] = {}
    with _open(path) as f:
        for line in f:
            st["lines"] += 1
            if line.startswith('{"t": "book"'):
                m, s = _TS.search(line), _SYM.search(line)
                if not (m and s):
                    st["malformed"] += 1
                    continue
                ts, sym = float(m.group(1)), s.group(1)
                if ts < prev.get((sym, "book"), -math.inf):
                    st["out_of_order"] += 1
                    continue
                prev[(sym, "book")] = ts
                minutes.add(int(ts // 60))
                books[sym] = books.get(sym, 0) + 1
                st["first_ts"] = ts if st["first_ts"] is None else min(st["first_ts"], ts)
                st["last_ts"] = ts if st["last_ts"] is None else max(st["last_ts"], ts)
                last[sym] = [ts, line]
                hourly.setdefault(sym, {})[int(ts // 3600)] = line
            elif line.startswith('{"t": "gap"'):
                st["recorder_gaps"] += 1
            elif line.startswith('{"t": "trade"'):
                m, s = _TS.search(line), _SYM.search(line)
                if not (m and s):
                    st["malformed"] += 1
                    continue
                key = (s.group(1), "trade")
                ts = float(m.group(1))
                if ts < prev.get(key, -math.inf):
                    st["out_of_order"] += 1
                else:
                    prev[key] = ts
            elif line.startswith(('{"t": "funding"', '{"t": "meta"')):
                continue
            elif line.strip():
                st["malformed"] += 1
    newest = {}
    for sym, (ts, line) in last.items():
        try:
            r = json.loads(line)
            bid, ask = r["bids"][0][0], r["asks"][0][0]
            if bid >= ask:
                st["crossed"] += 1
                continue
            mid = (bid + ask) / 2
            newest[sym] = {"ts": ts, "mid": mid, "spread_bp": (ask - bid) / mid * 1e4}
        except (ValueError, KeyError, IndexError):
            st["malformed"] += 1
    spark = {}
    for sym, hrs in hourly.items():
        pts = []
        for h, line in sorted(hrs.items()):
            try:
                r = json.loads(line)
                pts.append([h * 3600, round((r["bids"][0][0] + r["asks"][0][0]) / 2, 8)])
            except (ValueError, KeyError, IndexError):
                pass
        spark[sym] = pts
    return {"minutes": sorted(minutes), "books": books, "newest": newest, "spark": spark, **st}


def day_of(path: str) -> str:
    m = re.search(r"okx-(\d{8})\.jsonl", os.path.basename(path))
    return m.group(1) if m else ""


def coverage(day: str, minutes: list[int], rec_start: float, now: float) -> dict:
    d0 = datetime.strptime(day, "%Y%m%d").replace(tzinfo=timezone.utc).timestamp()
    lo = max(d0, math.floor(rec_start / 60) * 60)
    hi = min(d0 + 86400, now)
    expected = max(0, int((hi - lo) // 60))
    have = set(minutes)
    gaps, run = [], None
    for k in range(int(lo // 60), int(lo // 60) + expected):
        if k not in have:
            run = run or [k, k]
            run[1] = k
        elif run:
            gaps.append(run)
            run = None
    if run:
        gaps.append(run)
    gaps = [{"from": g[0] * 60, "to": (g[1] + 1) * 60, "min": g[1] - g[0] + 1}
            for g in gaps if g[1] - g[0] + 1 >= GAP_MIN]
    covered = len([k for k in have if lo // 60 <= k < lo // 60 + expected])
    return {"day": f"{day[:4]}-{day[4:6]}-{day[6:]}", "hours": round(covered / 60, 2),
            "expected_hours": round(expected / 60, 2), "gaps": gaps}


def _run(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def system_state() -> dict:
    out = _run(["launchctl", "print", f"gui/{os.getuid()}/{LABEL}"])
    running = bool(re.search(r"^\s*state = running", out, re.M))
    pid = re.search(r"^\s*pid = (\d+)", out, re.M)
    batt = _run(["pmset", "-g", "batt"])
    on_ac = None if not batt else ("AC Power" in batt)
    du = shutil.disk_usage(os.path.expanduser("~"))
    return {"recorder_running": running if out else None, "pid": int(pid.group(1)) if pid else None,
            "on_ac": on_ac, "disk_free_gb": round(du.free / 1e9, 1),
            "disk_used_pct": round(100 * (du.total - du.free) / du.total, 1),
            "tape_bytes": sum(os.path.getsize(os.path.join(TAPES, f)) for f in os.listdir(TAPES)
                              if f.startswith("okx-")) if os.path.isdir(TAPES) else 0}


def fx_rate(now: float) -> dict | None:
    """GBP per 1 USD from Coinbase's public rates endpoint. Falls back to the
    last good value (marked stale) so a network blip never breaks the report."""
    try:
        req = urllib.request.Request(FX_URL, headers={"User-Agent": "trading-agent-console/1.0"})
        with urllib.request.urlopen(req, timeout=6) as r:
            rate = float(json.loads(r.read())["data"]["rates"]["GBP"])
        if not 0.3 < rate < 2.0:
            raise ValueError(rate)
        fx = {"gbp_per_usd": rate, "ts": now, "source": "Coinbase", "stale": False}
        try:
            with open(FX_CACHE, "w") as f:
                json.dump(fx, f)
        except OSError:
            pass
        return fx
    except Exception:
        try:
            fx = json.load(open(FX_CACHE))
            fx["stale"] = True
            return fx
        except (OSError, ValueError):
            return None


OKX_CANDLES = "https://www.okx.com/api/v5/market/candles?instId={inst}&bar=1H&limit=48"
COINS = {"BTC": "BTC-USDT-SWAP", "ETH": "ETH-USDT-SWAP", "SOL": "SOL-USDT-SWAP", "HYPE": "HYPE-USDT-SWAP",
         "AAVE": "AAVE-USDT-SWAP", "ENA": "ENA-USDT-SWAP", "SUI": "SUI-USDT-SWAP"}


def okx_hourly(coin: str) -> list | None:
    """48 hourly closes from OKX's public candles endpoint, oldest first."""
    try:
        req = urllib.request.Request(OKX_CANDLES.format(inst=COINS[coin]), headers={"User-Agent": "trading-agent-console/1.0"})
        with urllib.request.urlopen(req, timeout=6) as r:
            d = json.loads(r.read())
        if str(d.get("code")) != "0":
            return None
        return sorted([int(c[0]) / 1000, float(c[4])] for c in d["data"])
    except Exception:
        return None


def hourly(points: list) -> list:
    """Keep the last point of each hour (and the very last point), at most 30 days."""
    by_h = {}
    for ts, v in points:
        by_h[int(ts // 3600)] = [ts, v]
    out = [by_h[h] for h in sorted(by_h)]
    return out[-720:]


def shadow_state(now: float) -> dict | None:
    """The auto-trader's own summary, trimmed for the console."""
    try:
        with open(SHADOW_SUMMARY) as f:
            s = json.load(f)
    except (OSError, ValueError):
        return None
    out = _run(["launchctl", "print", f"gui/{os.getuid()}/{SHADOW_LABEL}"])
    s["process_running"] = bool(re.search(r"^\s*state = running", out, re.M)) if out else None
    s["age_s"] = now - s.get("updated_ts", 0)
    return s


def collect(now: float | None = None) -> dict:
    now = now or time.time()
    files = sorted(os.path.join(TAPES, f) for f in os.listdir(TAPES)
                   if re.match(r"okx-\d{8}\.jsonl(\.gz)?$", f)) if os.path.isdir(TAPES) else []
    try:
        cache = json.load(open(CACHE))
    except (OSError, ValueError):
        cache = {}
    today = datetime.fromtimestamp(now, timezone.utc).strftime("%Y%m%d")
    scans = {}
    for p in files:
        s = os.stat(p)
        key = f"{os.path.basename(p)}:{s.st_size}:{int(s.st_mtime)}"
        day = day_of(p)
        if day != today and key in cache:
            scans[day] = cache[key]
            continue
        scans[day] = scan_file(p)
        if day != today:
            cache = {k: v for k, v in cache.items() if not k.startswith(f"okx-{day}")}
            cache[key] = scans[day]
    try:
        with open(CACHE, "w") as f:
            json.dump(cache, f)
    except OSError:
        pass

    firsts = [s["first_ts"] for s in scans.values() if s["first_ts"]]
    lasts = [s["last_ts"] for s in scans.values() if s["last_ts"]]
    rec_start, rec_last = (min(firsts), max(lasts)) if firsts else (None, None)
    days = [coverage(d, scans[d]["minutes"], rec_start, now) for d in sorted(scans)] if rec_start else []
    covered_h = sum(d["hours"] for d in days)
    books = {}
    newest = {}
    for d in sorted(scans):
        for k, v in scans[d]["books"].items():
            books[k] = books.get(k, 0) + v
        newest.update(scans[d]["newest"])
    spark: dict[str, list] = {}
    for d in sorted(scans):
        for k, pts in scans[d].get("spark", {}).items():
            spark.setdefault(k.replace("-PERP", ""), []).extend(pts)
    spark = {k: [p for p in v if p[0] >= now - 48 * 3600] for k, v in spark.items()}
    spark_src = "tape"
    if os.environ.get("CONSOLE_OFFLINE") != "1":
        fetched = {c: okx_hourly(c) for c in COINS}
        if all(fetched.values()):
            spark, spark_src = fetched, "okx_1h"
    tot = {k: sum(s[k] for s in scans.values()) for k in ("malformed", "crossed", "out_of_order", "recorder_gaps")}
    sysst = system_state()

    alerts = []
    if sysst["recorder_running"] is False:
        alerts.append({"level": "critical", "text": "The recorder is not running."})
    if rec_last is not None and now - rec_last > STALE_MIN * 60:
        alerts.append({"level": "critical",
                       "text": f"No new order-book data for {int((now - rec_last) // 60)} min. "
                               "The Mac may be asleep or offline."})
    if rec_last is None:
        alerts.append({"level": "critical", "text": "No tape files found."})
    recent = [g for d in days for g in d["gaps"] if g["to"] > now - 86400]
    big = [g for g in recent if g["min"] >= 60]
    if big:
        worst = max(big, key=lambda g: g["min"])
        alerts.append({"level": "warning", "text": f"{len(big)} gap(s) over 1 hour in the last 24 h; longest "
                       f"{worst['min'] // 60} h {worst['min'] % 60} min from "
                       f"{datetime.fromtimestamp(worst['from'], timezone.utc):%d %b %H:%M} UTC."})
    if sysst["disk_free_gb"] < 1:
        alerts.append({"level": "critical", "text": f"Only {sysst['disk_free_gb']} GB disk free."})
    elif sysst["disk_free_gb"] < 3:
        alerts.append({"level": "warning", "text": f"Disk space low: {sysst['disk_free_gb']} GB free."})
    if sysst["on_ac"] is False:
        alerts.append({"level": "warning", "text": "The Mac is on battery, so it can sleep and stop recording."})
    for coin, d in UNLOCKS.items():
        t = datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
        if now >= t:
            alerts.append({"level": "info", "text": f"The {coin} unlock ({d}) has passed. Re-check its thesis."})
    sh = shadow_state(now)
    if sh is not None:
        if sh.get("kill", {}).get("tripped"):
            alerts.append({"level": "critical", "text": "The auto-trader hit its emergency stop: "
                           + (sh["kill"].get("reason") or "no reason recorded") + ". It will only close bets until reset."})
        if sh.get("process_running") is False or sh.get("age_s", 0) > 600:
            alerts.append({"level": "warning", "text": "The auto-trader has not updated for "
                           f"{int(sh.get('age_s', 0) // 60)} min."})
        lim = sh.get("limits", {})
        if lim and sh.get("day_pnl_frac", 0) <= -0.8 * lim.get("max_daily_loss", 1):
            alerts.append({"level": "warning", "text": f"Today's paper loss is {abs(sh['day_pnl_frac']) * 100:.1f}%, "
                           f"close to the {lim['max_daily_loss'] * 100:.0f}% daily limit."})
    if rec_start and covered_h >= TARGET_DAYS * 24 * 0.97:
        alerts.append({"level": "info", "text": "30 days of tape recorded. Ready for the replay rung."})

    return {
        "updated_utc": datetime.fromtimestamp(now, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "updated_ts": now,
        "rec_start": rec_start, "rec_last": rec_last,
        "covered_hours": round(covered_h, 2),
        "target_hours": TARGET_DAYS * 24,
        "books_per_coin": books,
        "book_interval_s": round((rec_last - rec_start) / max(1, max(books.values(), default=1)), 2) if rec_start else None,
        "tape": tot,
        "newest": {k.replace("-PERP", ""): v for k, v in sorted(newest.items())},
        "system": sysst,
        "fx": fx_rate(now),
        "alerts": alerts,
        "days": days,
        "spark": spark,
        "spark_source": spark_src,
        "shadow": {k: v for k, v in sh.items() if k != "equity_series"} if sh else None,
        "shadow_equity": hourly(sh.get("equity_series", [])) if sh else [],
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pretty", action="store_true")
    a = ap.parse_args()
    json.dump(collect(), sys.stdout, indent=2 if a.pretty else None)
    sys.stdout.write("\n")
