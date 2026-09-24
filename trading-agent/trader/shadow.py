"""Shadow trading: the unchanged agent, live prices, a paper account.

This is rung 2 of the ship ladder run early and on paper: the same `Agent`,
policy, risk layer and paper broker as replay, fed from the recorder's live
tape instead of a finished file. Nothing here can reach an exchange account:
there is no venue adapter, no API key is read for orders, and the only broker
is `PaperBroker`.

    python -m trader shadow --tape-dir tapes --start-gbp 10000

How it works
  * Follows tapes/<prefix>-YYYYMMDD.jsonl (okx-, or cb- for the UK Coinbase
    GBP spot profile) as the recorder appends to it, and moves
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

import dataclasses
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
from . import settings as settings_mod
from . import uk_tax

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
    ("paused by you", "Paused by you"),
    ("switched off", "Coin switched off by you"),
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

    def __init__(self, tape_dir: str, parser: TapeParser, prefix: str = "okx"):
        self.dir = tape_dir
        self.prefix = prefix
        self.parser = parser
        self._f = None
        self._day = None
        self._buf = ""

    def _path(self, day: str) -> str:
        return os.path.join(self.dir, f"{self.prefix}-{day}.jsonl")

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
    fills_all: list = field(default_factory=list)       # every fill, for the tax record
    equity: list = field(default_factory=list)          # [ts, equity_usd] every 15 min, capped
    thoughts: list = field(default_factory=list)        # latest decision per coin + why, for the live view
    _last_dec: dict = field(default_factory=dict)

    def observe(self, kind: str, ts: float, d: dict) -> None:
        c = self.counts
        if kind == "decision" and d.get("decision") is not None:
            c["decisions"] += 1
            dec = d["decision"]
            self._last_dec[_g(dec, "symbol")] = {k: _g(dec, k) for k in (
                "direction", "direction_conf", "setup_quality", "regime", "risk_state", "toxic_flow_p")}
        elif kind == "intent":
            it = d["intent"]
            k = it.kind if hasattr(it, "kind") else it["kind"]
            reason = it.reason if hasattr(it, "reason") else it.get("reason", "")
            sym = it.symbol if hasattr(it, "symbol") else it.get("symbol", "")
            if k == "hold":
                c["holds"] += 1
                lab = hold_label(reason)
                self.holds[lab] = self.holds.get(lab, 0) + 1
            dec = self._last_dec.pop(sym, None)
            self.thoughts.append({"ts": ts, "sym": sym, "kind": k, "reason": reason,
                                  "label": hold_label(reason) if k == "hold" else k,
                                  "p_win": _g(it, "p_win"), **({"ai": dec} if dec else {})})
            self.thoughts = self.thoughts[-40:]
        elif kind == "fill":
            o, f = d["order"], d["fill"]
            ik = d.get("intent_kind", "")
            c[{"enter": "entries", "exit": "exits", "reduce": "reduces"}.get(ik, "entries")] += 1
            self.trades.append({"ts": ts, "sym": _g(o, "symbol"), "side": _g(o, "side"), "qty": _g(f, "qty"),
                                "px": _g(f, "price"), "fee": _g(f, "fee"), "kind": ik, "reason": _g(o, "reason")})
            self.fills_all.append(self.trades[-1])
            self.fills_all = self.fills_all[-20000:]
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
    tape_prefix: str = "okx"
    currency: str = "USD"                 # account currency; "GBP" for the UK spot profile
    profile: str = "perp-research"
    live_every_s: float = 2.0
    settings_every_s: float = 1.0


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
        self.settings_path = os.path.join(cfg.out_dir, "settings.json")
        self.reset_path = os.path.join(cfg.out_dir, "reset.json")
        self._handle_reset(clock())
        cfg = self.cfg
        st = self._load()
        if st:
            self.meta = st["meta"]
            pf = Portfolio(cash=st["cash"])
        else:
            fx = 1.0 if cfg.currency == "GBP" else gbp_per_usd
            start_usd = cfg.start_gbp / fx
            self.meta = {"started_ts": clock(), "start_gbp": cfg.start_gbp, "fx_at_start": fx,
                         "start_usd": start_usd, "currency": cfg.currency, "profile": cfg.profile}
            pf = Portfolio(cash=start_usd)
        now = clock()
        self._day = utc_day(now)
        self.agent = Agent(agent_cfg, engine, schemas, pf, brain=brain, calibrator=calibrator,
                           ledger=TapLedger(self._ledger_path(now), self.book))
        if st:
            self._restore(st)
        self.parser = TapeParser()
        self.tape = LiveTape(cfg.tape_dir, self.parser, cfg.tape_prefix)
        self.live_path = os.path.join(cfg.out_dir, "live.json")
        self.latest: dict[str, tuple[float, float]] = {}      # sym -> (ts, mid) from the newest book seen
        self.hist: dict[str, list] = {}                       # sym -> [[ts, mid]] every 10 s, last hour
        self._last_live = 0.0
        self.clockbars = BarClock(cfg.bar_s, cfg.grace_s, math.floor(now / cfg.bar_s) * cfg.bar_s + cfg.bar_s)
        self.warmed = False
        self._stop = False
        self.settings: dict | None = None
        self._settings_mtime: float | None = -1.0
        self._settings_check = 0.0
        self.apply_settings(now)

    # ---- operator settings -------------------------------------------------
    def _profile(self) -> str | None:
        p = self.meta.get("profile") or self.cfg.profile
        return p if p in settings_mod.PROFILES else None

    def apply_settings(self, now: float) -> bool:
        """Re-read settings.json if it changed and apply it to the running bot."""
        prof = self._profile()
        if prof is None:
            return False
        try:
            m = os.stat(self.settings_path).st_mtime
        except OSError:
            m = None
        if m == self._settings_mtime:
            return False
        self._settings_mtime = m
        s = settings_mod.load(self.settings_path, prof)
        gate, lim, stop_bps, rr = settings_mod.apply_to(prof, s, self.agent.risk.limits.kill_switch_path)
        pol = self.agent.policy
        pol.gate = gate
        pol.limits = lim
        self.agent.risk.limits = lim
        pol.exits = dataclasses.replace(pol.exits, min_stop_bps=stop_bps, reward_risk=rr)
        pol.paused = bool(s["paused"])
        pol.blocked = set(settings_mod.COINS) - set(s["coins"])
        bar = float(s["decision_every_s"])
        if bar != self.clockbars.bar_s:
            self.clockbars.bar_s = bar
            self.clockbars.next_end = math.floor(now / bar) * bar + bar
        self.settings = s
        return True

    def _handle_reset(self, now: float) -> None:
        """A reset request from the live view: archive this account and start again."""
        if not os.path.exists(self.reset_path):
            return
        try:
            with open(self.reset_path) as f:
                req = json.load(f)
            start = float(req.get("start_gbp", self.cfg.start_gbp))
            if not 10 <= start <= 1_000_000:
                raise ValueError(start)
        except (OSError, ValueError, TypeError):
            start = self.cfg.start_gbp
        arch = os.path.join(os.path.dirname(os.path.abspath(self.cfg.out_dir)), "archive",
                            f"{os.path.basename(os.path.abspath(self.cfg.out_dir))}-{int(now)}")
        os.makedirs(arch, exist_ok=True)
        for name in os.listdir(self.cfg.out_dir):
            if name in ("settings.json", "reset.json") or name.endswith(".log"):
                continue
            os.replace(os.path.join(self.cfg.out_dir, name), os.path.join(arch, name))
        os.remove(self.reset_path)
        self.cfg = dataclasses.replace(self.cfg, start_gbp=start)

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
        self.book.fills_all = b.get("fills_all", list(self.book.trades))

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
                     "equity": self.book.equity, "fills_all": self.book.fills_all},
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
            positions.append({"sym": s.split("-")[0], "side": "up" if p.qty > 0 else "down",
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
                       "max_beta_gross_frac": risk.limits.max_beta_gross_frac,
                       "max_position_frac": risk.limits.max_position_frac,
                       "max_open_positions": risk.limits.max_open_positions,
                       "allow_short": risk.limits.allow_short},
            "positions": positions, "trades": self.book.trades[-25:], "counts": self.book.counts,
            "holds": dict(sorted(self.book.holds.items(), key=lambda kv: -kv[1])[:6]),
            "equity_series": self.book.equity,
            "tax": self.tax_summary(),
        }

    def tax_summary(self) -> dict | None:
        if self.meta.get("currency") != "GBP":
            return None
        rep = uk_tax.compute(uk_tax.from_trades(self.book.fills_all))
        return {"years": rep.by_year(), "disposals": len(rep.disposals), "warnings": rep.warnings[:5],
                "recent": [{"day": d.day.isoformat(), "asset": d.asset, "qty": d.qty, "proceeds": d.proceeds,
                            "cost": d.cost, "gain": d.gain, "rule": d.rule} for d in rep.disposals[-10:]]}

    # ---- real-time view ----------------------------------------------------
    def _note_prices(self, events: list) -> None:
        for e in events:
            if isinstance(e, BookUpdate):
                mid = (e.bids[0][0] + e.asks[0][0]) / 2
                self.latest[e.symbol] = (e.ts, mid)
                h = self.hist.setdefault(e.symbol, [])
                if not h or e.ts - h[-1][0] >= 10:
                    h.append([e.ts, mid])
                    if len(h) > 360:
                        del h[:len(h) - 360]

    def live(self, now: float) -> dict:
        """Account marked to the newest prices seen, not just the last bar."""
        pf = self.agent.portfolio
        mark = lambda s: self.latest.get(s, (0, pf.marks.get(s, 0.0)))[1]
        positions, value = [], pf.cash
        for s, p in sorted(pf.positions.items()):
            if p.qty == 0:
                continue
            m = mark(s) or p.avg_price
            value += p.qty * m
            positions.append({"sym": s.split("-")[0], "side": "up" if p.qty > 0 else "down", "qty": p.qty,
                              "entry": p.avg_price, "mark": m, "value": abs(p.qty * m),
                              "upnl": (m - p.avg_price) * p.qty,
                              "upnl_pct": (m / p.avg_price - 1) * (1 if p.qty > 0 else -1) * 100,
                              "stop_bps": self.agent.policy.stops.get(s)})
        prices = {}
        for s in self.agent.schemas:
            if s in self.latest:
                ts, m = self.latest[s]
                h = self.hist.get(s, [])
                prices[s.split("-")[0]] = {"mid": m, "ts": ts, "chg_1h": (m / h[0][1] - 1) * 100 if h else 0.0,
                                           "hist": [[round(a), round(b, 6)] for a, b in h[-180:]]}
        risk = self.agent.risk
        return {
            "ts": now, "currency": self.meta.get("currency", "USD"), "profile": self.meta.get("profile"),
            "engine": self.engine_name, "start": self.meta["start_usd"], "started_ts": self.meta["started_ts"],
            "value": value, "cash": pf.cash, "peak": max(pf.peak_equity, value),
            "day_start": pf.day_start_equity, "fees": pf.fees_paid,
            "next_decision_s": max(0.0, self.clockbars.next_end + self.cfg.grace_s - now),
            "positions": positions, "prices": prices, "trades": self.book.trades[-20:], "counts": self.book.counts,
            "holds": dict(sorted(self.book.holds.items(), key=lambda kv: -kv[1])[:6]),
            "kill": {"tripped": risk.tripped, "reason": risk.trip_reason, "file": risk.kill_file_present()},
            "limits": {k: getattr(risk.limits, k) for k in ("max_drawdown", "max_daily_loss", "max_gross_frac",
                                                            "max_position_frac", "max_open_positions")},
            "equity_series": self.book.equity[-400:], "tax": self.tax_summary(),
            "decision_every_s": self.clockbars.bar_s, "paused": self.agent.policy.paused,
            "settings": self.settings, "thoughts": self.book.thoughts[-24:],
        }

    # ---- loop --------------------------------------------------------------
    def warm_up(self) -> None:
        now = self.clock()
        recent = self.tape.poll(now, min_ts=now - self.cfg.warm_s)
        self._note_prices(recent)
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
        evs = self.tape.poll(now)
        self._note_prices(evs)
        self.clockbars.push(evs)
        if now - self._settings_check >= self.cfg.settings_every_s:
            self._settings_check = now
            self.apply_settings(now)
            if os.path.exists(self.reset_path):
                self._stop = True            # launchd restarts us; __init__ archives and starts fresh
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
        if n or now - self._last_live >= self.cfg.live_every_s:
            self._last_live = now
            self._atomic(self.live_path, self.live(now))
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
