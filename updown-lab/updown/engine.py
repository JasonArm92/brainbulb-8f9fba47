"""The paper engine: one loop, ticking every half second.

Each tick: read the reference price -> roll the 5-minute window if needed -> fair P(UP) ->
simulated crowd book -> our quotes (after guardrails) -> simulated takers fill us -> hedge if
needed -> checkpoints for live calibration -> circuit breaker. At each window end: resolve
UP/DOWN from the reference, pay out £1 per winning share; all money is in GBP."""

from __future__ import annotations

import os
import random
import threading
import time
from collections import deque

from .config import Config, WINDOW_S, assert_paper
from .ledger import Ledger
from .mm import HedgeAction, Inventory, Quote, RiskState, hedge, make_quote
from .model import Inputs, VolTracker, fair_value
from .simmarket import SimMarket
from .windows import Window, window_start

CHECKPOINTS = (60, 120, 180, 240)


class Engine:
    def __init__(self, cfg: Config, feed, ledger: Ledger | None = None, clock=time.time, rng=None):
        assert_paper()
        self.cfg, self.feed, self.clock = cfg, feed, clock
        self.ledger = ledger or Ledger(cfg.db_path)
        self.rng = rng or random.Random(cfg.sim.seed)
        self.sim = SimMarket(cfg.sim, cfg.mm.tick, self.rng)
        self.vol = VolTracker(cfg.model)
        self.lock = threading.RLock()
        br = self.ledger.get("bankroll_gbp")
        if br is None:
            br = cfg.risk.start_gbp
            self.ledger.put("bankroll_gbp", br)
            self.ledger.put("start_gbp", br)
            self.ledger.put("started_ts", clock())
        self.risk = RiskState(bankroll_gbp=br, peak_gbp=self.ledger.get("peak_gbp", br),
                              halted_until=self.ledger.get("halted_until", 0.0), halt_reason=self.ledger.get("halt_reason", ""),
                              killed=bool(self.ledger.get("killed", False)))
        self.window: Window | None = None
        self.inv = Inventory()
        self.observe_only = False
        self.pending: deque = deque()
        self.last_tick = None
        self.last_ts = 0.0
        self.fair = None
        self.quote = Quote(None, None, 0, 0, "starting")
        self.hedge_note = ""
        self.ref = (0.0, None, 0, {})
        self.spot_hist: deque = deque(maxlen=900)          # 15 min at 1 s
        self.win_hist: list = []                            # per tick in this window
        self._last_hist = 0.0
        self._skip_logged = None
        self._stop = threading.Event()
        self._restore()

    # ------------------------------------------------------------------ restart recovery
    def _restore(self) -> None:
        now = self.clock()
        ow = self.ledger.get("open_window")
        ws = window_start(now)
        if ow and ow["start"] != ws:
            # the engine was down when that window closed: we cannot know the true close, so void it at cost
            inv = self._inv_from_fills(ow["start"])
            self.ledger.resolve(ow["start"], {"open_ref": ow.get("open_ref"), "outcome": "VOID", "pnl_gbp": 0.0,
                                              "gbp_per_usd": self._fx(), "note": "engine was offline at the close; voided at cost",
                                              **{k: v for k, v in inv.as_dict().items() if k in ("yes_qty", "yes_cost", "no_qty", "no_cost", "pairs", "hedge_bleed", "fees")},
                                              "maker_fills": inv.maker_fills, "taker_fills": inv.taker_fills})
            self.ledger.event("restart", f"window {ow['start']} closed while offline: voided at cost")
            self.ledger.put("open_window", None)
        elif ow and ow["start"] == ws:
            self.window = Window(ws, ow.get("open_ref"))
            self.inv = self._inv_from_fills(ws)
            self.observe_only = bool(ow.get("observe_only"))

    def _inv_from_fills(self, w: int) -> Inventory:
        inv = Inventory()
        for f in self.ledger.fills(w):
            inv.add(f["side"], f["price"], f["qty"], f["fee"])
            inv.hedge_bleed += f["bleed"] or 0.0
            if f["kind"] == "maker":
                inv.maker_fills += 1
            else:
                inv.taker_fills += 1
        return inv

    def _fx(self) -> float:
        return getattr(self.feed, "fx", 0.74) or 0.74

    # ------------------------------------------------------------------ controls
    def set_kill(self, on: bool, who: str = "phone") -> None:
        with self.lock:
            self.risk.killed = on
            self.ledger.put("killed", on)
            self.ledger.event("kill", f"kill switch {'ON' if on else 'off'} ({who})")

    def clear_breaker(self) -> None:
        with self.lock:
            self.risk.halted_until = 0.0
            self.risk.recent.clear()
            self.risk.peak_gbp = self.risk.bankroll_gbp
            self.ledger.put("halted_until", 0.0)
            self.ledger.put("peak_gbp", self.risk.peak_gbp)
            self.ledger.event("breaker", "circuit breaker cleared from the phone (peak reset to current bankroll)")

    # ------------------------------------------------------------------ window roll
    def _open(self, start: int, now: float, ref: float | None) -> None:
        w = Window(start)
        if ref is not None and now - start <= 2.0:
            w.open_ref = ref
        else:
            p = self.vol.price_at(start)
            h = self.vol.hist
            if p is not None and h and h[0][0] <= start and any(abs(t - start) <= 2 for t, _ in h):
                w.open_ref = p
        self.window, self.inv, self.win_hist = w, Inventory(), []
        self.observe_only = w.open_ref is None
        self.pending.clear()
        self.hedge_note = ""
        self.ledger.put("open_window", {"start": start, "open_ref": w.open_ref, "observe_only": self.observe_only})
        if self.observe_only:
            self.ledger.event("window", f"{w.slug}: joined after the open, watching only")

    def _resolve(self, now: float, ref: float | None) -> None:
        w, inv = self.window, self.inv
        note = ""
        close = ref if (ref is not None and now - w.end <= 3.0) else None
        if close is None:
            p = self.vol.price_at(w.end)
            close = p
            note = "close taken from the nearest earlier price (feed gap)"
        w.close_ref = close
        outcome = w.outcome() if not self.observe_only else None
        if outcome is None:
            pnl, payout, outcome = 0.0, inv.cost, (w.outcome() or "VOID")
            note = note or ("not traded: joined after the open" if self.observe_only else "no reference")
            if self.observe_only:
                outcome = "WATCHED"
        else:
            payout = inv.payout(outcome)
            pnl = payout - inv.cost
        fx = self._fx()
        self.risk.bankroll_gbp += pnl
        self.risk.peak_gbp = max(self.risk.peak_gbp, self.risk.bankroll_gbp)
        self.ledger.put("bankroll_gbp", self.risk.bankroll_gbp)
        self.ledger.put("peak_gbp", self.risk.peak_gbp)
        d = inv.as_dict()
        self.ledger.resolve(w.start, {"open_ref": w.open_ref, "close_ref": close, "outcome": outcome,
                                      "yes_qty": d["yes_qty"], "yes_cost": d["yes_cost"], "no_qty": d["no_qty"], "no_cost": d["no_cost"],
                                      "pairs": d["pairs"], "pair_cost": d["pair_cost"], "hedge_bleed": d["hedge_bleed"], "fees": d["fees"],
                                      "payout": payout, "pnl_gbp": pnl, "gbp_per_usd": fx, "maker_fills": inv.maker_fills,
                                      "taker_fills": inv.taker_fills, "note": note})
        if outcome in ("UP", "DOWN") and self.window.open_ref:
            # a checkpoint at resolution time helps the live calibration record every window
            pass
        self.ledger.put("open_window", None)

    # ------------------------------------------------------------------ main tick
    def tick(self) -> None:
        with self.lock:
            now = self.clock()
            dt = min(2.0, now - self.last_tick) if self.last_tick else 0.5
            self.last_tick = now
            ts, ref, nsrc, srcs = self.feed.latest()
            self.ref = (ts, ref, nsrc, srcs)
            if ref is not None and ts > self.last_ts:
                self.vol.update(ts, ref)
                self.last_ts = ts
                if now - self._last_hist >= 1.0:
                    self.spot_hist.append((round(ts, 2), ref))
            ws = window_start(now)
            if self.window is None:
                self._open(ws, now, ref)
            elif ws != self.window.start:
                self._resolve(now, ref)
                self._open(ws, now, ref)
            w = self.window
            if self.cfg.kill_path and os.path.exists(self.cfg.kill_path) and not self.risk.killed:
                self.set_kill(True, "KILL file")
            ref_ok = ref is not None and nsrc >= self.cfg.risk.min_sources
            tl = w.time_left(now)
            self.fair = None
            if ref is not None and w.open_ref:
                mom, acc = self.vol.momentum_bps(now)
                self.fair = fair_value(Inputs(ref, w.open_ref, tl, self.vol.vol_bps, mom, acc), self.cfg.model)
                stale = self.vol.price_at(now - self.cfg.sim.crowd_lag_s) or ref
                zs = fair_value(Inputs(stale, w.open_ref, tl + self.cfg.sim.crowd_lag_s, self.vol.vol_bps, 0, 0), self.cfg.model).z
                self.sim.update_book(self.sim.crowd_prob(zs, dt))
                for at in CHECKPOINTS:
                    if WINDOW_S - tl >= at and WINDOW_S - tl < at + 5:
                        self.ledger.checkpoint(w.start, at, now, self.fair.p_up, self.fair.as_dict())
            if self.fair is None or self.observe_only:
                self.quote = Quote(None, None, 0, 0, "watching only: joined after the window opened" if self.observe_only else "waiting for prices")
            else:
                self.quote = make_quote(self.fair.p_up, self.inv, tl, self.cfg.mm, self.cfg.risk, self.risk, now, ref_ok)
            self.pending.append((now, self.quote, dt))
            # informed takers act on what they saw `lead` seconds ahead of our quotes
            lead = self.cfg.sim.informed_lead_s
            while self.pending and self.pending[0][0] <= now - lead:
                t0, q, qdt = self.pending.popleft()
                if self.fair is None or q.yes_bid is None and q.no_bid is None:
                    continue
                cur = make_quote(self.fair.p_up, self.inv, tl, self.cfg.mm, self.cfg.risk, self.risk, now, ref_ok)
                ys = min(q.yes_size, cur.yes_size) if q.yes_bid is not None else 0
                ns = min(q.no_size, cur.no_size) if q.no_bid is not None else 0
                for f in self.sim.takers(qdt, q.yes_bid, q.no_bid, ys, ns, self.fair.p_up):
                    fee = f.price * f.qty * self.cfg.mm.maker_fee_rate
                    self.inv.add(f.side, f.price, f.qty, fee)
                    self.inv.maker_fills += 1
                    fair_side = self.fair.p_up if f.side == "YES" else 1 - self.fair.p_up
                    self.ledger.fill(w.start, now, f.side, f.price, f.qty, fee, "maker", f.informed, fair_side, 0.0,
                                     "informed seller" if f.informed else "noise seller")
            if self.fair is not None and not self.observe_only and ref_ok:
                h = hedge(self.fair.p_up, self.inv, tl, self.sim.book, self.cfg.mm, self.risk, now)
                if isinstance(h, HedgeAction):
                    self.inv.add(h.side, h.price, h.qty, h.fee)
                    self.inv.hedge_bleed += h.bleed
                    self.inv.taker_fills += 1
                    self.risk.recent.append((now, max(0.0, h.bleed)))
                    fair_side = self.fair.p_up if h.side == "YES" else 1 - self.fair.p_up
                    self.ledger.fill(w.start, now, h.side, h.price, h.qty, h.fee, "hedge", False, fair_side, h.bleed, h.why)
                    self.hedge_note = f"hedged: bought {h.qty:.0f} {h.side} at {h.price:.2f} ({h.why})"
                elif isinstance(h, str):
                    self.hedge_note = h
                    if self._skip_logged != w.start:          # log a skipped hedge once per window, not every tick
                        self._skip_logged = w.start
                        self.ledger.event("hedge", f"{w.slug}: {h}")
            why = self.risk.breaker(now, self.cfg.risk)
            if why:
                self.ledger.put("halted_until", self.risk.halted_until)
                self.ledger.put("halt_reason", why)
                self.ledger.event("breaker", f"quoting halted for {self.cfg.risk.breaker_cooldown_s / 60:.0f} min: {why}")
            if now - self._last_hist >= 1.0:
                self._last_hist = now
                if self.fair is not None:
                    self.win_hist.append({"t": round(now - w.start, 1), "p": round(self.fair.p_up, 4), "crowd": round(self.sim.book.mid, 4),
                                          "yb": self.quote.yes_bid, "nb": self.quote.no_bid, "yes": round(self.inv.yes_qty, 2),
                                          "no": round(self.inv.no_qty, 2), "bleed": round(self.inv.hedge_bleed, 4),
                                          "pc": round(self.inv.pair_cost, 4) if self.inv.pair_cost is not None else None})

    def run(self, every_s: float = 0.5) -> None:
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception as e:                    # keep running; log the problem
                self.ledger.event("error", repr(e)[:300])
            self._stop.wait(every_s)

    def start(self) -> threading.Thread:
        th = threading.Thread(target=self.run, daemon=True, name="engine")
        th.start()
        return th

    def stop(self) -> None:
        self._stop.set()

    # ------------------------------------------------------------------ state for the UI
    def snapshot(self) -> dict:
        with self.lock:
            now = self.clock()
            w = self.window
            fx = self._fx()
            start = self.ledger.get("start_gbp", self.risk.bankroll_gbp)
            unreal = 0.0
            if self.fair is not None:
                unreal = self.inv.yes_qty * self.fair.p_up + self.inv.no_qty * (1 - self.fair.p_up) - self.inv.cost
            ts, ref, nsrc, srcs = self.ref
            tot = self.ledger.totals()
            return {
                "ts": now, "mode": "paper", "market": "simulated", "fx_gbp_per_usd": fx,
                "account": {"bankroll_gbp": self.risk.bankroll_gbp, "start_gbp": start, "pnl_gbp": self.risk.bankroll_gbp - start,
                            "unrealised_gbp": unreal, "peak_gbp": self.risk.peak_gbp},
                "totals": tot,
                "window": {"start": w.start if w else None, "slug": w.slug if w else None, "open_ref": w.open_ref if w else None,
                           "time_left": w.time_left(now) if w else None, "observe_only": self.observe_only},
                "reference": {"price": ref, "sources": srcs, "n": nsrc, "ok": ref is not None and nsrc >= self.cfg.risk.min_sources,
                              "errors": dict(getattr(self.feed, "errors", {}))},
                "fair": self.fair.as_dict() if self.fair else None,
                "book": {"yes_bid": self.sim.book.yes_bid, "yes_ask": self.sim.book.yes_ask, "no_bid": self.sim.book.no_bid, "no_ask": self.sim.book.no_ask},
                "quote": self.quote.as_dict(), "inventory": self.inv.as_dict(), "hedge_note": self.hedge_note,
                "risk": {"killed": self.risk.killed, "halted": now < self.risk.halted_until, "halted_until": self.risk.halted_until,
                         "halt_reason": self.risk.halt_reason, "bleed_hour_gbp": sum(b for t, b in self.risk.recent if t >= now - self.cfg.risk.breaker_window_s),
                         "drawdown": 1 - self.risk.bankroll_gbp / self.risk.peak_gbp if self.risk.peak_gbp else 0.0,
                         "limits": {"max_window_cost_gbp": self.cfg.risk.max_window_cost_gbp, "max_unpaired_gbp": self.cfg.risk.max_unpaired_gbp,
                                    "breaker_bleed_gbp": self.cfg.risk.breaker_bleed_gbp, "breaker_drawdown_frac": self.cfg.risk.breaker_drawdown_frac}},
                "spot_hist": list(self.spot_hist)[-600:], "win_hist": self.win_hist[-300:],
                "recent_windows": self.ledger.windows(40),
                "fills": [{k: f[k] for k in ("ts", "side", "price", "qty", "kind", "informed", "why")}
                          for f in (self.ledger.fills(w.start)[-160:] if w else [])], "events": self.ledger.events(12),
                "calibration_live": self.ledger.calibration(), "backtest": self.ledger.get("backtest"),
                "config": {"half_spread": self.cfg.mm.half_spread, "max_pair_cost": self.cfg.mm.max_pair_cost,
                           "taker_fee_rate": self.cfg.mm.taker_fee_rate, "quote_size": self.cfg.mm.quote_size,
                           "informed_share": self.cfg.sim.informed_share, "informed_lead_s": self.cfg.sim.informed_lead_s,
                           "crowd_spread": self.cfg.sim.crowd_spread, "momentum_weight": self.cfg.model.momentum_weight},
            }
