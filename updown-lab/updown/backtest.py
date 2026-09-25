"""Validate the fair-value model on real history before trusting it live.

Downloads Coinbase BTC-USD 1-minute candles (public, no key), splits them into 5-minute
UTC windows, and at 1, 2, 3 and 4 minutes into each window asks the model for P(UP) given
the price so far. Scores against what actually happened:
  * Brier score (lower is better; always saying 50% scores 0.25)
  * log loss (lower is better; always 50% scores 0.693)
  * reliability: when the model said ~70%, did UP happen ~70% of the time?
Also tries a few model variants (momentum weight, volatility scaling) and reports which is best.

    python -m updown.backtest --days 30

Minute data limits this to whole-minute checkpoints; the live engine keeps logging second-level
checkpoints so calibration keeps improving over time.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import time
import urllib.request

from .config import ModelConfig
from .model import Inputs, fair_value

URL = "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&start={s}&end={e}"


def fetch(days: int, cache: str, opener=urllib.request.urlopen, sleep=time.sleep) -> list[tuple]:
    """[(t, open, high, low, close)] oldest first, cached to CSV."""
    rows: dict[int, tuple] = {}
    if os.path.exists(cache):
        with open(cache) as f:
            for r in csv.reader(f):
                rows[int(r[0])] = (int(r[0]), *map(float, r[1:5]))
    now = int(time.time()) // 60 * 60
    start = now - days * 86400
    t = start
    while t < now:
        e = min(now, t + 300 * 60)
        if not all(k in rows for k in range(t, e, 60 * 30)):     # skip chunks we already have
            iso = lambda x: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(x))
            req = urllib.request.Request(URL.format(s=iso(t), e=iso(e)), headers={"User-Agent": "updown-lab/1.0"})
            for attempt in range(4):
                try:
                    with opener(req, timeout=15) as r:
                        for c in json.loads(r.read()):          # [time, low, high, open, close, volume]
                            rows[int(c[0])] = (int(c[0]), float(c[3]), float(c[2]), float(c[1]), float(c[4]))
                    break
                except Exception:
                    sleep(1.5 * (attempt + 1))
            sleep(0.25)
        t = e
    out = sorted(v for k, v in rows.items() if k >= start)
    os.makedirs(os.path.dirname(cache) or ".", exist_ok=True)
    with open(cache, "w", newline="") as f:
        csv.writer(f).writerows(out)
    return out


def checkpoints(candles: list[tuple], cfg: ModelConfig, vol_scale: float = 1.0, vol_lookback_min: int = 30):
    """Yield (minute_into_window, p_up, outcome_up, inputs) for every complete window."""
    by_t = {c[0]: c for c in candles}
    closes = [c[4] for c in candles]
    idx = {c[0]: i for i, c in enumerate(candles)}
    t0 = candles[0][0] // 300 * 300 + 300
    for w in range(t0, candles[-1][0] - 300, 300):
        mins = [by_t.get(w + 60 * k) for k in range(5)]
        if not all(mins) or w not in idx or idx[w] < vol_lookback_min + 2:
            continue
        s0 = mins[0][1]                                  # price at the window open
        up = mins[4][4] >= s0                            # close of the last minute
        for k in range(1, 5):
            i = idx[w + 60 * (k - 1)]                    # the candle that just closed
            rets = [math.log(closes[j] / closes[j - 1]) for j in range(i - vol_lookback_min + 1, i + 1)]
            var_min = sum(r * r for r in rets) / len(rets)
            vol_bps = math.sqrt(var_min / 60) * 1e4 * vol_scale
            mom = math.log(closes[i] / closes[i - 1]) * 1e4 / 2       # ~30 s worth of a 1-min move
            inp = Inputs(spot=closes[i], open_ref=s0, time_left_s=(5 - k) * 60, vol_bps=vol_bps,
                         momentum_bps=mom, accel_bps=0.0)
            yield k, fair_value(inp, cfg).p_up, up, inp


def score(rows) -> dict:
    n = len(rows)
    if not n:
        return {"n": 0}
    brier = sum((p - (1 if y else 0)) ** 2 for _, p, y, _ in rows) / n
    ll = -sum(math.log(p if y else 1 - p) for _, p, y, _ in rows) / n
    bins = []
    for b in range(10):
        lo, hi = b / 10, (b + 1) / 10
        sel = [(p, y) for _, p, y, _ in rows if lo <= p < hi or (b == 9 and p == 1.0)]
        if sel:
            bins.append({"lo": lo, "hi": hi, "n": len(sel), "said": sum(p for p, _ in sel) / len(sel),
                         "happened": sum(1 for _, y in sel if y) / len(sel)})
    up_rate = sum(1 for _, _, y, _ in rows if y) / n
    return {"n": n, "brier": brier, "logloss": ll, "brier_coinflip": 0.25, "logloss_coinflip": math.log(2),
            "skill_vs_coinflip": 1 - brier / 0.25, "up_rate": up_rate, "reliability": bins}


def run(candles, base: ModelConfig | None = None) -> dict:
    base = base or ModelConfig()
    variants = []
    for mw in (0.0, 0.5, 1.0, -0.5):
        for vs in (0.8, 1.0, 1.25):
            cfg = ModelConfig(**{**base.__dict__, "momentum_weight": mw})
            rows = list(checkpoints(candles, cfg, vol_scale=vs))
            s = score(rows)
            variants.append({"momentum_weight": mw, "vol_scale": vs, "brier": s["brier"], "logloss": s["logloss"]})
    best = min(variants, key=lambda v: v["logloss"])
    cfg = ModelConfig(**{**base.__dict__, "momentum_weight": best["momentum_weight"]})
    rows = list(checkpoints(candles, cfg, vol_scale=best["vol_scale"]))
    default_rows = list(checkpoints(candles, base))
    per_min = {k: score([r for r in rows if r[0] == k]) for k in range(1, 5)}
    return {
        "generated_ts": time.time(), "candles": len(candles), "from_ts": candles[0][0], "to_ts": candles[-1][0],
        "windows": len(rows) // 4, "default": score(default_rows), "best": {**best, **score(rows)},
        "by_minute": {k: {kk: v[kk] for kk in ("n", "brier", "logloss", "skill_vs_coinflip")} for k, v in per_min.items()},
        "variants": variants,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--cache", default="runtime/btcusd_1m.csv")
    ap.add_argument("--out", default="runtime/backtest.json")
    a = ap.parse_args()
    candles = fetch(a.days, a.cache)
    res = run(candles)
    with open(a.out, "w") as f:
        json.dump(res, f, indent=1)
    d, b = res["default"], res["best"]
    print(f"{res['windows']} windows, {res['candles']} candles")
    print(f"default model: Brier {d['brier']:.4f} (coin flip 0.25), log loss {d['logloss']:.4f} (coin flip 0.693), skill {d['skill_vs_coinflip']:.1%}")
    print(f"best variant (momentum {b['momentum_weight']}, vol x{b['vol_scale']}): Brier {b['brier']:.4f}, log loss {b['logloss']:.4f}")
    for k, v in res["by_minute"].items():
        print(f"  {k} min in: Brier {v['brier']:.4f}, skill {v['skill_vs_coinflip']:.1%} (n={v['n']})")
    print("reliability (model said -> happened):")
    for r in b["reliability"]:
        print(f"  {r['lo']:.1f}-{r['hi']:.1f}: said {r['said']:.2f}, happened {r['happened']:.2f} (n={r['n']})")


if __name__ == "__main__":
    main()
