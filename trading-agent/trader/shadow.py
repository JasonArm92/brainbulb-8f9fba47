"""Shadow trading: the unchanged agent, live prices, a paper account.

This is rung 2 of the ship ladder run early and on paper: the same `Agent`,
policy, risk layer and paper broker as replay, fed from the recorder's live
tape instead of a finished file. Nothing here can reach an exchange account:
there is no venue adapter, no API key is read for orders, and the only broker
is `PaperBroker`.

    python -m trader shadow --tape-dir tapes --start-gbp 10000

How it works
  * Follows tapes/okx-YYYYMMDD.jsonl as the recorder appends to it, and moves
    to the next day's file at UTC midnight (an open handle keeps reading the
    old file even after the recorder gzips it).
  * Every line goes through `replay.TapeParser`, the same validation replay
    uses.
  * Bars close on the exchange clock at multiples of `bar_s`, `grace_s` after
    wall time passes the bar end, so late-arriving lines still land in their
    bar. A bar with no data still ticks, and the risk layer refuses to trade
    on stale books.
  * On start it replays the last `warm_s` of tape through `Agent.warm`, which
    builds the price window without making a single decision.
  * State (cash, positions, peak, day P&L, stops, kill-switch latch) is saved
    after every bar and restored on restart, so a reboot never resets the
    account or repeats a trade.
  * `summary.json` is rewritten after every bar for the console.
"""

from __future__ import annotations

import json
import math
import os
import signal
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from .agent import Agent
from .config import AgentConfig
from .funding import FundingEvent
from .jev_schema import CompiledSchema
from .ledger import Ledger
from .portfolio import Portfolio, Position
from .replay import TapeParser, bars
from .state_engine import BookUpdate, Trade

STATE_VERSION = 1

# first clause of a hold reason -> plain words for the console
HOLD_WORDS = [
    ("no valid decision", "No decision from the AI"),
    ("symbol frozen", "Paused for a second opinion"),
    ("halted", "Paused by a safety rule"),
    ("setup", "Set-up not strong enough"),
    ("conf", "Not confident enough"),
    ("low confidence", "Not confident enough"),
    ("risk_state", "AI flagged the risk"),
    ("toxic", "Suspicious trading activity"),
    ("neutral", "No clear direction"),
    ("not allowed", "Direction not allowed for this coin"),
    ("no edge", "Not worth it after fees"),
    ("no room", "Safety limits already full"),
]


def hold_label(reason: str) -> str:
    first = (reason or "").split(";")[0].strip().lower()
    for key, words in HOLD_WORDS:
        if key in first:
            return words
    return "Other"


def utc_day(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y%m%d")


# --------------------------------------------------------------------------- tape
class LiveTape:
    """Reads new complete lines from the recorder's growing daily file."""

    def __init__(self, tape_dir: str, parser: TapeParser):
        self.dir = tape_dir
        self.parser = parser
        self._f = None
        self._day = None
        self._buf = ""

    def _path(self, day: str) -> str:
        return os.path.join(self.dir, f"okx-{day}.jsonl")

    def _drain(self, min_ts: float | None = None) -> list:
        out = []
        if self._f is None:
            return out
        chunk = self._f.read()
        if not chunk:
            return out
        self._buf += chunk
        *lines, self._buf = self._buf.split("\n")
        for line in lines:
            ev = self.parser.feed(line)
            if ev is not None and (min_ts is None or ev.ts >= min_ts):
                out.append(ev)
        return out

    def poll(self, wall_now: float, min_ts: float | None = None) -> list:
        """New validated events since the last poll. `min_ts` drops older ones
        (used at start-up so a full day's file is not held in memory)."""
        day = utc_day(wall_now)
        out = self._drain(min_ts)
        if day != self._day:
            path = self._path(day)
            if os.path.exists(path):
                out += self._drain(min_ts)    # finish yesterday's file first
                if self._f:
                    self._f.close()
                self._f, self._day, self._buf = open(path), day, ""
                out += self._drain(min_ts)
        return out


# --------------------------------------------------------------------------- bars
@dataclass
class BarClock:
    bar_s: float
    grace_s: float
    next_end: float
    pending: list = field(default_factory=list)

    def push(self, events: list) -> None:
        self.pending.extend(events)

    def due(self, wall_now: float) -> list[tuple[float, dict, list, list]]:
        out = []
        while self.next_end + self.grace_s <= wall_now:
            end = self.next_end
            now_evs = [e for e in self.pending if e.ts <= end]
            self.pending = [e for e in self.pending if e.ts > end]
            books: dict[str, BookUpdate] = {}
            trades: list[Trade] = []
            funding: list[FundingEvent] = []
            for e in sorted(now_evs, key=lambda e: e.ts):
                if isinstance(e, BookUpdate):
                    books[e.symbol] = e
                elif isinstance(e, Trade):
                    trades.append(e)
                else:
                    funding.append(e)
            out.append((end, books, trades, funding))
            self.next_end += self.bar_s
        return out


# --------------------------------------------------------------------------- ledger tap
class TapLedger(Ledger):
    """Writes the normal ledger and keeps the console's running counters."""

    def __init__(self, path: str, book: "ShadowBook"):
        super().__init__(path)
        self.book = book

    def write(self, kind: str, ts: float, **data: Any) -> None:
        super().write(kind, ts, **data)
        self.book.observe(kind, ts, data)


@dataclass
class ShadowBook:
    counts: dict = field(default_factory=lambda: {"bars": 0, "decisions": 0, "entries": 0, "exits": 0,
                                                  "reduces": 0, "holds": 0, "escalations": 0, "rejects": 0})
    holds: dict = field(default_factory=dict)
    trades: list = field(default_factory=list)          # newest last, capped
    equity: list = field(default_factory=list)          # [ts, equity_usd] every 15 min, capped

    def observe(self, kind: str, ts: float, d: dict) -> None:
        c = self.counts
        if kind == "decision" and d.get("decision") is not None:
            c["decisions"] += 1
        elif kind == "intent":
            it = d["intent"]
            k = it.kind if hasattr(it, "kind") else it["kind"]
            reason = it.reason if hasattr(it, "reason") else it.get("reason", "")
            if k == "hold":
                c["holds"] += 1
                lab = hold_label(reason)
                self.holds[lab] = self.holds.get(lab, 0) + 1
        elif kind == "fill":
            o, f = d["order"], d["fill"]
            ik = d.get("intent_kind", "")
            c[{"enter": "entries", "exit": "exits", "reduce": "reduces"}.get(ik, "entries")] += 1
            self.trades.append({"ts": ts, "sym": _g(o, "symbol"), "side": _g(o, "side"), "qty": _g(f, "qty"),
                                "px": _g(f, "price"), "fee": _g(f, "fee"), "kind": ik, "reason": _g(o, "reason")})
            self.trades = self.trades[-60:]
        elif kind == "reject":
            c["rejects"] += 1
        elif kind == "escalation":
            c["escalations"] += 1
        elif kind == "bar":
            c["bars"] += 1
            if not self.equity or ts - self.equity[-1][0] >= 900:
                self.equity.append([ts, round(d.get("equity", 0.0), 2)])
                self.equity = self.equity[-2880:]


def _g(obj, name):
    return getattr(obj, name) if hasattr(obj, name) else obj.get(name)


# --------------------------------------------------------------------------- trader
@dataclass
class ShadowConfig:
    tape_dir: str = "tapes"
    out_dir: str = "runtime/shadow"
    bar_s: float = 60.0
    grace_s: float = 3.0
    warm_s: float = 45 * 60
    poll_s: float = 1.0
    start_gbp: float = 10_000.0


class ShadowTrader:
    def __init__(self, cfg: ShadowConfig, agent_cfg: AgentConfig, schemas: dict[str, CompiledSchema], engine,
                 gbp_per_usd: float, engine_name: str = "practice", clock: Callable[[], float] = time.time,
                 brain=None, calibrator=None):
        self.cfg, self.clock = cfg, clock
        os.makedirs(cfg.out_dir, exist_ok=True)
        self.state_path = os.path.join(cfg.out_dir, "state.json")
        self.summary_path = os.path.join(cfg.out_dir, "summary.json")
        self.book = ShadowBook()
        self.engine_name = engine_name
        st = self._load()
        if st:
            self.meta = st["meta"]
            pf = Portfolio(cash=st["cash"])
        else:
            start_usd = cfg.start_gbp / gbp_per_usd
            self.meta = {"started_ts": clock(), "start_gbp": cfg.start_gbp, "fx_at_start": gbp_per_usd,
                         "start_usd": start_usd}
            pf = Portfolio(cash=start_usd)
        now = clock()
        self._day = utc_day(now)
        self.agent = Agent(agent_cfg, engine, schemas, pf, brain=brain, calibrator=calibrator,
                           ledger=TapLedger(self._ledger_path(now), self.book))
        if st:
            self._restore(st)
        self.parser = TapeParser()
        self.tape = LiveTape(cfg.tape_dir, self.parser)
        self.clockbars = BarClock(cfg.bar_s, cfg.grace_s, math.floor(now / cfg.bar_s) * cfg.bar_s + cfg.bar_s)
        self.warmed = False
        self._stop = False

    # ---- persistence -------------------------------------------------------
    def _ledger_path(self, ts: float) -> str:
        return os.path.join(self.cfg.out_dir, f"ledger-{utc_day(ts)}.jsonl")

    def _load(self) -> dict | None:
        try:
            with open(self.state_path) as f:
                st = json.load(f)
            return st if st.get("version") == STATE_VERSION else None
        except (OSError, ValueError):
            return None

    def _restore(self, st: dict) -> None:
        pf = self.agent.portfolio
        pf.positions = {s: Position(q, a) for s, (q, a) in st["positions"].items()}
        pf.marks = dict(st["marks"])
        pf.peak_equity, pf.day_start_equity, pf.day = st["peak"], st["day_start"], st["day"]
        pf.fees_paid, pf.funding_paid = st["fees"], st["funding"]
        self.agent.policy.stops.update(st.get("stops", {}))
        if st.get("tripped"):
            self.agent.risk.trip(st.get("trip_reason") or "restored from saved state")
        b = st.get("book", {})
        self.book.counts.update(b.get("counts", {}))
        self.book.holds.update(b.get("holds", {}))
        self.book.trades = b.get("trades", [])
        self.book.equity = b.get("equity", [])

    def _atomic(self, path: str, obj: dict) -> None:
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(obj, f)
        os.replace(tmp, path)

    def save(self) -> None:
        pf = self.agent.portfolio
        self._atomic(self.state_path, {
            "version": STATE_VERSION, "meta": self.meta, "cash": pf.cash,
            "positions": {s: [p.qty, p.avg_price] for s, p in pf.positions.items() if p.qty != 0},
            "marks": pf.marks, "peak": pf.peak_equity, "day_start": pf.day_start_equity, "day": pf.day,
            "fees": pf.fees_paid, "funding": pf.funding_paid, "stops": self.agent.policy.stops,
            "tripped": self.agent.risk.tripped, "trip_reason": self.agent.risk.trip_reason,
            "book": {"counts": self.book.counts, "holds": self.book.holds, "trades": self.book.trades,
                     "equity": self.book.equity},
        })
        self._atomic(self.summary_path, self.summary())

    def summary(self) -> dict:
        pf, risk = self.agent.portfolio, self.agent.risk
        eq = pf.equity()
        positions = []
        for s, p in sorted(pf.positions.items()):
            if p.qty == 0:
                continue
            mark = pf.marks.get(s, p.avg_price)
            upnl = (mark - p.avg_price) * p.qty
            positions.append({"sym": s.replace("-PERP", ""), "side": "up" if p.qty > 0 else "down",
                              "qty": p.qty, "entry": p.avg_price, "mark": mark, "notional_usd": abs(p.qty * mark),
                              "upnl_usd": upnl, "upnl_pct": (mark / p.avg_price - 1) * (1 if p.qty > 0 else -1) * 100})
        beta = self.agent.risk.safe_beta
        return {
            **self.meta, "engine": self.engine_name, "updated_ts": self.clock(), "warmed": self.warmed,
            "equity_usd": eq, "cash_usd": pf.cash, "peak_usd": pf.peak_equity, "drawdown": pf.drawdown(),
            "day_pnl_frac": pf.daily_pnl_frac(), "fees_usd": pf.fees_paid, "funding_usd": pf.funding_paid,
            "gross_frac": pf.gross_notional() / eq if eq > 0 else 0.0,
            "beta_gross_frac": pf.beta_gross_notional(beta) / eq if eq > 0 else 0.0,
            "kill": {"tripped": risk.tripped, "reason": risk.trip_reason, "file": risk.kill_file_present()},
            "limits": {"max_drawdown": risk.limits.max_drawdown, "max_daily_loss": risk.limits.max_daily_loss,
                       "max_gross_frac": risk.limits.max_gross_frac,
                       "max_beta_gross_frac": risk.limits.max_beta_gross_frac},
            "positions": positions, "trades": self.book.trades[-25:], "counts": self.book.counts,
            "holds": dict(sorted(self.book.holds.items(), key=lambda kv: -kv[1])[:6]),
            "equity_series": self.book.equity,
        }

    # ---- loop --------------------------------------------------------------
    def warm_up(self) -> None:
        now = self.clock()
        recent = self.tape.poll(now, min_ts=now - self.cfg.warm_s)
        for end, books, trades, _funding in bars(sorted(recent, key=lambda e: e.ts), self.cfg.bar_s):
            if end <= now:
                self.agent.warm(end, books, trades)
        self.clockbars.next_end = max(self.clockbars.next_end, math.floor(now / self.cfg.bar_s) * self.cfg.bar_s + self.cfg.bar_s)
        self.warmed = True
        self.save()

    def step(self) -> int:
        """One poll: ingest new tape lines and run every bar that is due. Returns bars run."""
        now = self.clock()
        if not self.warmed:
            self.warm_up()
        self.clockbars.push(self.tape.poll(now))
        n = 0
        for end, books, trades, funding in self.clockbars.due(now):
            if utc_day(end) != self._day:
                self._day = utc_day(end)
                self.agent.ledger.close()
                self.agent.ledger = TapLedger(self._ledger_path(end), self.book)
            books = {s: b for s, b in books.items() if s in self.agent.schemas}
            trades = [t for t in trades if t.symbol in self.agent.schemas]
            funding = [f for f in funding if f.symbol in self.agent.schemas]
            self.agent.on_bar(end, books, trades, funding)
            n += 1
        if n:
            self.save()
        return n

    def run(self) -> None:
        def _stop(*_):
            self._stop = True
        signal.signal(signal.SIGTERM, _stop)
        signal.signal(signal.SIGINT, _stop)
        try:
            while not self._stop:
                self.step()
                time.sleep(self.cfg.poll_s)
        finally:
            self.save()
            self.agent.close()
