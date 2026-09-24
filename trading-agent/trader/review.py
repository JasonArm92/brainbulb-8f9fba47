"""Overnight review: score every decision, fill and miss; refit calibration;
propose (never auto-ship) the next schema version.

Outcome definitions (all computed from the ledger's own marks, so they are
causal with respect to the decision and reproducible):
  * direction: forward log return over H bars, in the called direction, net of
    round-trip cost > 0  -> outcome 1 else 0. Forecast = direction_conf.
  * toxic_flow (proxy): |forward return| > 2 * rv * sqrt(H)  -> 1 else 0.
  * setup_quality (proxy): does setup >= 2 predict direction wins?
Brier skill is reported against a constant base-rate forecast.
"""

from __future__ import annotations

import json
import math
import os
from collections import defaultdict
from dataclasses import dataclass

from .brain import Brain, FailClosedBrain
from .calibration import Calibrator
from .jev_schema import CompiledSchema, load_latest, save, validate_revision
from .ledger import read


def brier(pairs: list[tuple[float, int]]) -> float | None:
    if not pairs:
        return None
    return sum((p - o) ** 2 for p, o in pairs) / len(pairs)


def reliability(pairs: list[tuple[float, int]], bins: int = 10) -> list[dict]:
    acc = defaultdict(lambda: [0, 0.0, 0])
    for p, o in pairs:
        b = min(bins - 1, int(p * bins))
        acc[b][0] += 1
        acc[b][1] += p
        acc[b][2] += o
    return [
        {"bin": f"{b / bins:.1f}-{(b + 1) / bins:.1f}", "n": n, "mean_p": sp / n, "hit_rate": so / n}
        for b, (n, sp, so) in sorted(acc.items())
    ]


@dataclass
class ReviewConfig:
    horizon_bars: int = 5
    cost_bps: float = 14.0
    calibration_path: str = "runtime/calibration.json"
    candidates_dir: str = "schemas/candidates"


def run_review(ledger_path: str, schema_dir: str, cfg: ReviewConfig | None = None,
               brain: Brain | None = None) -> dict:
    cfg = cfg or ReviewConfig()
    brain = brain or FailClosedBrain()
    recs = list(read(ledger_path))

    marks: dict[str, list[tuple[float, float, float]]] = defaultdict(list)
    for r in recs:
        if r["kind"] == "mark":
            marks[r["symbol"]].append((r["ts"], r["mid"], r["rv_bps"]))
    idx = {s: {ts: i for i, (ts, _, _) in enumerate(m)} for s, m in marks.items()}

    def fwd(sym: str, ts: float) -> tuple[float, float] | None:
        i = idx.get(sym, {}).get(ts)
        m = marks.get(sym, [])
        if i is None or i + cfg.horizon_bars >= len(m):
            return None
        return math.log(m[i + cfg.horizon_bars][1] / m[i][1]) * 1e4, m[i][2]

    per_sym = defaultdict(lambda: {"dir": [], "tox": [], "setup_hit": [], "regimes": defaultdict(int)})
    for r in recs:
        if r["kind"] != "decision" or not r.get("decision"):
            continue
        d, sym = r["decision"], r["symbol"]
        f = fwd(sym, r["ts"])
        if f is None:
            continue
        ret, rv = f
        ps = per_sym[sym]
        ps["regimes"][d["regime"]] += 1
        if d["direction"] in ("long", "short"):
            sign = 1 if d["direction"] == "long" else -1
            won = int(sign * ret - cfg.cost_bps > 0)
            ps["dir"].append((d["direction_conf"], won))
            if d["setup_quality"] >= 2:
                ps["setup_hit"].append(won)
        big = int(abs(ret) > 2 * max(rv, 1e-6) * math.sqrt(cfg.horizon_bars))
        ps["tox"].append((d["toxic_flow_p"], big))

    misses = defaultdict(lambda: {"n": 0, "would_win": 0})
    for r in recs:
        if r["kind"] != "miss":
            continue
        f = fwd(r["symbol"], r["ts"])
        if f is None:
            continue
        sign = 1 if r["direction"] == "long" else -1
        key = r["reason"].split(";")[0].split(" ")[0]
        misses[key]["n"] += 1
        misses[key]["would_win"] += int(sign * f[0] - cfg.cost_bps > 0)

    fills = [r for r in recs if r["kind"] == "fill"]
    fees = sum(r["fill"]["fee"] for r in fills)
    slip = [r["fill"]["slippage_bps"] for r in fills]
    bars = [r for r in recs if r["kind"] == "bar"]
    rejects = defaultdict(int)
    for r in recs:
        if r["kind"] == "reject":
            for reason in r["reasons"]:
                rejects[reason.split(" (")[0]] += 1

    cal = Calibrator.load(cfg.calibration_path)
    report_syms = {}
    for sym, ps in per_sym.items():
        for p, o in ps["dir"]:
            cal.observe(p, bool(o))
        base = sum(o for _, o in ps["dir"]) / len(ps["dir"]) if ps["dir"] else None
        b = brier(ps["dir"])
        b0 = brier([(base, o) for _, o in ps["dir"]]) if base is not None else None
        report_syms[sym] = {
            "n_directional": len(ps["dir"]),
            "direction_brier": b,
            "direction_brier_baseline": b0,
            "direction_brier_skill": (1 - b / b0) if b is not None and b0 else None,
            "direction_reliability": reliability(ps["dir"]),
            "toxic_brier": brier(ps["tox"]),
            "setup>=2_hit_rate": (sum(ps["setup_hit"]) / len(ps["setup_hit"])) if ps["setup_hit"] else None,
            "regime_counts": dict(ps["regimes"]),
        }
    cal.save(cfg.calibration_path)

    report = {
        "horizon_bars": cfg.horizon_bars,
        "cost_bps_assumed": cfg.cost_bps,
        "symbols": report_syms,
        "fills": len(fills),
        "fees_paid": fees,
        "funding_paid": bars[-1].get("funding_paid") if bars else None,
        "avg_slippage_bps": (sum(slip) / len(slip)) if slip else None,
        "risk_rejects": dict(rejects),
        "misses_by_reason": {k: {**v, "would_win_rate": v["would_win"] / v["n"]} for k, v in misses.items()},
        "equity_start": bars[0]["equity"] if bars else None,
        "equity_end": bars[-1]["equity"] if bars else None,
        "max_drawdown": max((b["drawdown"] for b in bars), default=None),
        "p99_loop_ms": sorted(b["loop_ms"] for b in bars)[int(0.99 * (len(bars) - 1))] if bars else None,
        "candidates": {},
    }

    # propose next schema versions (written to candidates/, never to live)
    for sym, srep in report_syms.items():
        try:
            cur = load_latest(schema_dir, sym)
        except FileNotFoundError:
            continue
        proposal = brain.propose_rewrite({"schema": cur.to_json(), "report": srep,
                                          "misses": report["misses_by_reason"]})
        if not proposal:
            report["candidates"][sym] = "no proposal (brain unavailable or declined)"
            continue
        q = {k: {**v, "instructions": proposal["instructions"][k]} for k, v in cur.questions.items()}
        allowed = tuple(d for d in cur.allowed_directions if d not in proposal.get("drop_directions", []))
        cand = CompiledSchema(cur.version + 1, cur.symbol, cur.finalist, cur.context, q, allowed)
        try:
            validate_revision(cur, cand)
            path = save(cand, cfg.candidates_dir)
            report["candidates"][sym] = {"path": path, "rationale": proposal.get("rationale", "")}
        except Exception as e:
            report["candidates"][sym] = f"rejected: {e}"
    return report


def promote(candidate_path: str, schema_dir: str, approved_by: str) -> str:
    """Operator gate: move a validated candidate into the live schema dir."""
    if not approved_by.strip():
        raise PermissionError("promotion requires a named approver")
    with open(candidate_path) as f:
        cand = CompiledSchema.from_json(json.load(f))
    cur = load_latest(schema_dir, cand.symbol)
    validate_revision(cur, cand)
    path = save(cand, schema_dir)
    with open(path + ".approval", "w") as f:
        f.write(f"approved_by={approved_by}\n")
    return path
