"""Replay recorded real order-book data through the unchanged live loop.

This is rung 1 of the ship ladder (docs/agenkit/06-ship.md). The same `Agent`,
policy, risk layer and paper broker run over a recorded tape instead of
`SimMarket`, so the only difference from paper trading is where the events
come from.

Tape format: JSON Lines, one event per line, timestamps are the EXCHANGE's
(seconds, float). Written by `scripts/record_okx.py`.

    {"t": "meta", "venue": "okx", "symbols": {"BTC-PERP": "BTC-USDT-SWAP"}, ...}
    {"t": "book", "ts": 1790268861.706, "sym": "BTC-PERP",
     "bids": [[84446.9, 4.7141], ...], "asks": [[84447.0, 15.0416], ...]}
    {"t": "trade", "ts": 1790268861.9, "sym": "BTC-PERP", "px": 84447.0, "qty": 0.03, "side": "buy"}
    {"t": "funding", "ts": 1790236800.0, "sym": "BTC-PERP", "rate": 0.0000295, "interval_h": 8}
    {"t": "gap", "ts": ..., "sym": ..., "what": "trades", "detail": "..."}   (recorder-detected)

Quantities are in base units (contracts x contract value), prices in quote.

Tape hygiene is enforced, not assumed: malformed lines, crossed books and
out-of-order events are counted and dropped. Nothing is merged into the past.
A symbol whose newest book is older than the risk layer's staleness limit
cannot trade, because `RiskManager` rejects stale snapshots.

The rung-1 exit check (`rung1_check`) mirrors 06-ship.md:
  >= 30 days of tape; direction Brier skill > 0 on held-out days; net P&L > 0
  after fees, spread, slippage and funding (whole tape AND held-out days).
"""

from __future__ import annotations

import json
import math
import os
from collections import defaultdict
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .brain import Brain
from .config import AgentConfig
from .funding import FundingEvent
from .jev_client import DecisionEngine
from .jev_schema import CompiledSchema
from .ledger import read
from .state_engine import BookUpdate, Trade


# --------------------------------------------------------------------------- tape
@dataclass
class TapeStats:
    lines: int = 0
    books: int = 0
    trades: int = 0
    funding: int = 0
    malformed: int = 0
    crossed: int = 0
    out_of_order: int = 0
    recorder_gaps: int = 0
    first_ts: float | None = None
    last_ts: float | None = None
    symbols: set = field(default_factory=set)


def _levels(raw) -> tuple[tuple[float, float], ...]:
    out = tuple((float(p), float(q)) for p, q in raw)
    if not out or any(not (math.isfinite(p) and p > 0 and math.isfinite(q) and q >= 0) for p, q in out):
        raise ValueError("bad levels")
    return out


def read_tape(path: str, stats: TapeStats | None = None) -> Iterator[BookUpdate | Trade | FundingEvent]:
    """Parse and validate a tape. Yields events in file order, dropping bad ones."""
    st = stats if stats is not None else TapeStats()
    last: dict[tuple[str, str], float] = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            st.lines += 1
            try:
                r = json.loads(line)
                kind = r["t"]
                if kind == "meta":
                    continue
                if kind == "gap":
                    st.recorder_gaps += 1
                    continue
                ts, sym = float(r["ts"]), str(r["sym"])
                if not math.isfinite(ts):
                    raise ValueError("ts")
                if kind == "book":
                    ev = BookUpdate(ts, sym, _levels(r["bids"]), _levels(r["asks"]))
                    if ev.bids[0][0] >= ev.asks[0][0]:
                        st.crossed += 1
                        continue
                elif kind == "trade":
                    px, qty, side = float(r["px"]), float(r["qty"]), r["side"]
                    if side not in ("buy", "sell") or not (px > 0 and qty > 0):
                        raise ValueError("trade")
                    ev = Trade(ts, sym, px, qty, side)
                elif kind == "funding":
                    ev = FundingEvent(ts, sym, float(r["rate"]), float(r.get("interval_h", 8.0)))
                else:
                    raise ValueError(f"kind {kind!r}")
            except (KeyError, ValueError, TypeError, json.JSONDecodeError):
                st.malformed += 1
                continue
            stream = (sym, kind)
            if ts < last.get(stream, -math.inf):
                st.out_of_order += 1
                continue
            last[stream] = ts
            st.symbols.add(sym)
            st.first_ts = ts if st.first_ts is None else min(st.first_ts, ts)
            st.last_ts = ts if st.last_ts is None else max(st.last_ts, ts)
            if kind == "book":
                st.books += 1
            elif kind == "trade":
                st.trades += 1
            else:
                st.funding += 1
            yield ev


def bars(events: Iterable[BookUpdate | Trade | FundingEvent], bar_s: float
         ) -> Iterator[tuple[float, dict[str, BookUpdate], list[Trade], list[FundingEvent]]]:
    """Group events into bars closing at multiples of bar_s. Needs ts-sorted input
    across symbols; `replay` sorts the tape first. Only books updated inside the
    bar are passed (the Agent keeps the last one for execution)."""
    end = None
    books: dict[str, BookUpdate] = {}
    trades: list[Trade] = []
    funding: list[FundingEvent] = []
    for ev in events:
        if end is None:
            end = math.floor(ev.ts / bar_s) * bar_s + bar_s
        while ev.ts > end:
            yield end, books, trades, funding
            books, trades, funding = {}, [], []
            end += bar_s
        if isinstance(ev, BookUpdate):
            books[ev.symbol] = ev
        elif isinstance(ev, Trade):
            trades.append(ev)
        else:
            funding.append(ev)
    if end is not None:
        yield end, books, trades, funding


# --------------------------------------------------------------------------- scoring
def _day(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")


def direction_outcomes(recs: list[dict], horizon_bars: int, cost_bps: float) -> list[tuple[float, str, float, int]]:
    """(ts, symbol, forecast=direction_conf, outcome) for every long/short call.

    Outcome 1 if the forward log return over `horizon_bars` marks, in the called
    direction, beats the round-trip cost. Same definition as review.py.
    """
    marks: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for r in recs:
        if r["kind"] == "mark":
            marks[r["symbol"]].append((r["ts"], r["mid"]))
    idx = {s: {ts: i for i, (ts, _) in enumerate(m)} for s, m in marks.items()}
    out = []
    for r in recs:
        if r["kind"] != "decision" or not r.get("decision"):
            continue
        d, sym = r["decision"], r["symbol"]
        if d["direction"] not in ("long", "short"):
            continue
        i = idx.get(sym, {}).get(r["ts"])
        m = marks.get(sym, [])
        if i is None or i + horizon_bars >= len(m):
            continue
        ret = math.log(m[i + horizon_bars][1] / m[i][1]) * 1e4
        sign = 1 if d["direction"] == "long" else -1
        out.append((r["ts"], sym, float(d["direction_conf"]), int(sign * ret - cost_bps > 0)))
    return out


def _brier(pairs: list[tuple[float, int]]) -> float | None:
    return sum((p - o) ** 2 for p, o in pairs) / len(pairs) if pairs else None


@dataclass
class ReplayResult:
    tape: TapeStats
    days: list[str]
    heldout_days: list[str]
    daily: dict[str, dict]
    net_pnl: float
    heldout_net_pnl: float
    fees: float
    funding_paid: float
    fills: int
    risk_rejects: int
    causality_rejects: int
    max_drawdown: float
    kill_tripped: bool
    n_calls_heldout: int
    heldout_brier: float | None
    heldout_brier_baseline: float | None
    heldout_brier_skill: float | None
    ledger_path: str

    def to_json(self) -> dict:
        d = dict(self.__dict__)
        t = dict(self.tape.__dict__)
        t["symbols"] = sorted(t["symbols"])
        d["tape"] = t
        return d


def summarize(ledger_path: str, tape: TapeStats, heldout_frac: float, horizon_bars: int,
              cost_bps: float, causality_rejects: int, kill_tripped: bool) -> ReplayResult:
    recs = list(read(ledger_path))
    bar_recs = [r for r in recs if r["kind"] == "bar"]
    daily: dict[str, dict] = {}
    prev_eq = None
    prev_fees = prev_fund = 0.0
    for r in bar_recs:
        day = _day(r["ts"])
        d = daily.setdefault(day, {"equity_start": prev_eq if prev_eq is not None else r["equity"],
                                   "fees": 0.0, "funding": 0.0, "fills": 0})
        d["equity_end"] = r["equity"]
        d["fees"] += r.get("fees_paid", 0.0) - prev_fees
        d["funding"] += r.get("funding_paid", 0.0) - prev_fund
        prev_eq, prev_fees, prev_fund = r["equity"], r.get("fees_paid", 0.0), r.get("funding_paid", 0.0)
    for r in recs:
        if r["kind"] == "fill" and _day(r["ts"]) in daily:
            daily[_day(r["ts"])]["fills"] += 1
    for d in daily.values():
        d["net_pnl"] = d.get("equity_end", 0.0) - d.get("equity_start", 0.0)

    days = sorted(daily)
    n_hold = int(round(len(days) * heldout_frac)) if len(days) > 1 else 0
    held = days[len(days) - n_hold:] if n_hold else []
    held_set, insample = set(held), set(days[:len(days) - n_hold])

    calls = direction_outcomes(recs, horizon_bars, cost_bps)
    ins = [(p, o) for ts, _, p, o in calls if _day(ts) in insample]
    out = [(p, o) for ts, _, p, o in calls if _day(ts) in held_set]
    base = (sum(o for _, o in ins) / len(ins)) if ins else 0.5   # base rate learned in-sample only
    b = _brier(out)
    b0 = _brier([(base, o) for _, o in out])
    skill = (1 - b / b0) if (b is not None and b0) else None

    eq_start = bar_recs[0]["equity"] if bar_recs else 0.0
    eq_end = bar_recs[-1]["equity"] if bar_recs else 0.0
    return ReplayResult(
        tape=tape, days=days, heldout_days=held, daily=daily,
        net_pnl=eq_end - eq_start,
        heldout_net_pnl=sum(daily[d]["net_pnl"] for d in held),
        fees=sum(r["fill"]["fee"] for r in recs if r["kind"] == "fill"),
        funding_paid=bar_recs[-1].get("funding_paid", 0.0) if bar_recs else 0.0,
        fills=sum(1 for r in recs if r["kind"] == "fill"),
        risk_rejects=sum(1 for r in recs if r["kind"] == "reject"),
        causality_rejects=causality_rejects,
        max_drawdown=max((r["drawdown"] for r in bar_recs), default=0.0),
        kill_tripped=kill_tripped,
        n_calls_heldout=len(out),
        heldout_brier=b, heldout_brier_baseline=b0, heldout_brier_skill=skill,
        ledger_path=ledger_path,
    )


def rung1_check(res: ReplayResult, min_days: int = 30, min_heldout_calls: int = 200) -> tuple[bool, list[str]]:
    """Ship-ladder rung 1 exit criteria. Returns (passed, reasons it failed)."""
    fails = []
    if len(res.days) < min_days:
        fails.append(f"only {len(res.days)} days of tape (< {min_days})")
    if res.n_calls_heldout < min_heldout_calls:
        fails.append(f"only {res.n_calls_heldout} held-out directional calls (< {min_heldout_calls})")
    if res.heldout_brier_skill is None or not res.heldout_brier_skill > 0:
        fails.append(f"held-out direction Brier skill {res.heldout_brier_skill} is not > 0")
    if not res.net_pnl > 0:
        fails.append(f"net P&L {res.net_pnl:.2f} after fees, slippage and funding is not > 0")
    if not res.heldout_net_pnl > 0:
        fails.append(f"held-out net P&L {res.heldout_net_pnl:.2f} is not > 0")
    if res.kill_tripped:
        fails.append("drawdown kill switch tripped during replay")
    return (not fails, fails)


# --------------------------------------------------------------------------- run
def replay(
    tape_path: str,
    schemas: dict[str, CompiledSchema],
    engine: DecisionEngine,
    cfg: AgentConfig,
    bar_s: float = 60.0,
    equity: float = 100_000.0,
    heldout_frac: float = 0.3,
    horizon_bars: int = 5,
    brain: Brain | None = None,
    calibrator=None,
) -> ReplayResult:
    from .agent import Agent  # local import: keeps this module importable without the loop
    from .portfolio import Portfolio

    stats = TapeStats()
    events = sorted(read_tape(tape_path, stats), key=lambda e: e.ts)  # stable: file order on ties
    if os.path.exists(cfg.ledger_path):
        raise FileExistsError(f"{cfg.ledger_path} exists; replay writes a fresh ledger")
    agent = Agent(cfg, engine, schemas, Portfolio(cash=equity), brain=brain, calibrator=calibrator)
    try:
        for now, books, trades, funding in bars(events, bar_s):
            books = {s: b for s, b in books.items() if s in schemas}
            trades = [t for t in trades if t.symbol in schemas]
            funding = [f for f in funding if f.symbol in schemas]
            agent.on_bar(now, books, trades, funding)
    finally:
        agent.close()
    causality = sum(agent.state.rejected(s) for s in schemas)
    cost_bps = 2 * cfg.costs.taker_fee_bps + 2 * cfg.costs.min_slippage_bps + 2.0
    return summarize(cfg.ledger_path, stats, heldout_frac, horizon_bars, cost_bps, causality,
                     agent.risk.tripped)
