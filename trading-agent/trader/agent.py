"""The live loop. One call to `on_bar` per candle/block.

    events -> StateEngine -> Snapshot (<400 tokens) -> Jev (all finalists, one dispatch)
           -> Policy (gates, Kelly) -> RiskGuardedBroker (hard limits) -> Ledger

Escalations go to the Brain on a background thread; the symbol is frozen for
new entries until a verdict arrives. Verdicts are applied at the start of the
next bar, so the reflex path never blocks on slow reasoning.
"""

from __future__ import annotations

import time
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone

from .brain import Brain, BrainVerdict, FailClosedBrain
from .calibration import Calibrator
from .config import AgentConfig
from .correlation import BetaEstimator
from .execution import PaperBroker, RiskGuardedBroker
from .funding import FundingBook, FundingEvent
from .jev_client import DecisionEngine, decide_batch
from .jev_schema import CompiledSchema
from .ledger import Ledger
from .policy import Intent, Policy
from .portfolio import Portfolio
from .risk import Order, RiskManager
from .state_engine import BookUpdate, CausalityError, StateEngine, Trade


class Agent:
    def __init__(
        self,
        cfg: AgentConfig,
        engine: DecisionEngine,
        schemas: dict[str, CompiledSchema],
        portfolio: Portfolio,
        brain: Brain | None = None,
        calibrator: Calibrator | None = None,
        ledger: Ledger | None = None,
        jev_timeout_s: float = 0.5,
        funding: FundingBook | None = None,
        beta: BetaEstimator | None = None,
    ):
        self.cfg = cfg
        self.engine = engine
        self.schemas = schemas
        self.portfolio = portfolio
        self.brain = brain or FailClosedBrain()
        self.state = StateEngine(token_budget=cfg.snapshot_token_budget)
        ref = "BTC-PERP" if "BTC-PERP" in schemas else next(iter(schemas), "BTC-PERP")
        self.beta = beta or BetaEstimator(reference=ref)
        self.funding = funding or FundingBook()
        self.risk = RiskManager(cfg.risk, beta=self.beta)
        self.broker = RiskGuardedBroker(PaperBroker(cfg.costs), self.risk, portfolio)
        self.policy = Policy(cfg.gate, cfg.risk, calibrator or Calibrator(), beta=self.beta)
        self.ledger = ledger or Ledger(cfg.ledger_path)
        self.jev_timeout_s = jev_timeout_s
        self.frozen: dict[str, int] = {}  # symbol -> bar index of last escalation trigger
        self._pending: dict[str, Future] = {}
        self._brain_pool = ThreadPoolExecutor(max_workers=2)
        self._jev_pool = ThreadPoolExecutor(max_workers=max(1, len(schemas)))
        self._n = 0
        self._books: dict[str, BookUpdate] = {}  # newest ingested book per symbol, for execution

    # ------------------------------------------------------------------
    def _cost_bps(self, spread_bps: float) -> float:
        c = self.cfg.costs
        return 2 * c.taker_fee_bps + spread_bps + 2 * c.min_slippage_bps

    def _order_for(self, intent: Intent, book: BookUpdate, mid: float) -> Order:
        band = self.cfg.risk.max_price_deviation_bps * 0.5 / 1e4
        if intent.side == "buy":
            limit = min(book.asks[0][0] * (1 + band / 2), mid * (1 + band))
        else:
            limit = max(book.bids[0][0] * (1 - band / 2), mid * (1 - band))
        qty = intent.notional / max(limit, mid)  # never exceed intended notional at worst fill
        if intent.kind in ("exit", "reduce"):
            pos = self.portfolio.positions.get(intent.symbol)
            qty = min(qty, abs(pos.qty)) if pos else 0.0
        return Order(intent.symbol, intent.side, qty, limit,
                     reduce_only=intent.kind in ("exit", "reduce"),
                     client_id=f"{intent.symbol}-{self._n}", reason=intent.reason)

    def _apply_brain_verdicts(self, now: float) -> list[tuple[str, BrainVerdict]]:
        done = []
        for sym, fut in list(self._pending.items()):
            if fut.done():
                del self._pending[sym]
                try:
                    v = fut.result()
                except Exception as e:  # fail closed
                    v = BrainVerdict("stay_frozen", f"brain error {e!r}")
                self.ledger.write("brain_verdict", now, symbol=sym, verdict=v)
                if v.action == "clear":
                    self.frozen.pop(sym, None)
                done.append((sym, v))
        return done

    # ------------------------------------------------------------------
    def on_bar(self, now: float, books: dict[str, BookUpdate], trades: list[Trade],
               funding: list[FundingEvent] | None = None) -> None:
        self._n += 1
        t_start = time.perf_counter()
        self.portfolio.roll_day(datetime.fromtimestamp(now, timezone.utc).strftime("%Y-%m-%d"))

        # ingest strictly in timestamp order
        events = [(b.ts, 0, b) for b in books.values()] + [(t.ts, 1, t) for t in trades]
        for _, kind, ev in sorted(events, key=lambda e: (e[0], e[1])):
            if ev.ts > now:
                continue  # never ingest the future
            (self.state.on_book if kind == 0 else self.state.on_trade)(ev)

        mids = {}
        for sym, b in books.items():
            if b.ts > now:
                continue
            if sym in self._books and b.ts < self._books[sym].ts:
                continue
            self._books[sym] = b
            mids[sym] = (b.bids[0][0] + b.asks[0][0]) / 2
            self.portfolio.mark(sym, mids[sym])
        self.beta.update(mids)

        # funding settlements that fell inside this bar: book cash, update the sizing view
        for ev in sorted(funding or [], key=lambda e: e.ts):
            if ev.ts > now:
                continue
            paid = FundingBook.settle(self.portfolio, ev)
            self.funding.observe(ev.symbol, ev.rate, ev.interval_h)
            self.ledger.write("funding", now, symbol=ev.symbol, rate=ev.rate, paid=paid, event_ts=ev.ts)
        self.risk.update(self.portfolio)

        verdicts = self._apply_brain_verdicts(now)
        expiry = self.cfg.gate.freeze_expiry_bars
        if expiry is not None:
            for sym, since in list(self.frozen.items()):
                if self._n - since >= expiry and sym not in self._pending:
                    del self.frozen[sym]
                    self.ledger.write("unfreeze", now, symbol=sym, reason=f"{expiry} bars without trigger")

        if self.risk.kill_file_present():
            self.ledger.write("halt", now, reason="KILL file present")
            return

        snaps = {}
        for sym in self.schemas:
            try:
                snaps[sym] = self.state.snapshot(sym, now, self.portfolio)
            except CausalityError as e:
                self.ledger.write("no_snapshot", now, symbol=sym, error=str(e))
        for sym, s in snaps.items():
            self.ledger.write("mark", now, symbol=sym, mid=s.mid, rv_bps=s.rv_bps, spread_bps=s.spread_bps)

        # drawdown kill switch tripped: flatten, nothing else
        if self.risk.tripped:
            for sym, s in snaps.items():
                n = self.portfolio.notional(sym)
                if abs(n) > 1e-9:
                    it = Intent("exit", sym, "sell" if n > 0 else "buy", abs(n), "kill switch flatten")
                    self._execute(it, s, now)
            self.ledger.write("halt", now, reason=self.risk.trip_reason)
            return

        decisions = decide_batch(self.engine, [(snaps[s], self.schemas[s]) for s in snaps],
                                 timeout_s=self.jev_timeout_s, pool=self._jev_pool)

        for sym, v in verdicts:
            if v.action == "reduce" and sym in snaps:
                n = self.portfolio.notional(sym)
                if abs(n) > 1e-9:
                    it = Intent("reduce", sym, "sell" if n > 0 else "buy", abs(n) * 0.5, "brain: reduce")
                    self._execute(it, snaps[sym], now)

        for sym, snap in snaps.items():
            d = decisions.get(sym)
            self.ledger.write("decision", now, symbol=sym, snapshot=snap.to_prompt(),
                              decision=d, schema_version=self.schemas[sym].version)
            intent = self.policy.evaluate(d, snap, self.portfolio, self.schemas[sym],
                                          frozen=sym in self.frozen,
                                          cost_bps=self._cost_bps(snap.spread_bps),
                                          funding_bps=self.funding.cost_by_side(sym))
            if self.risk.halted_for_new_risk(self.portfolio) and intent.kind == "enter":
                intent = Intent("hold", sym, reason="halted for new risk (daily loss / kill)")
            self.ledger.write("intent", now, intent=intent)

            if intent.escalate:
                self.frozen[sym] = self._n
            if intent.escalate and sym not in self._pending:
                payload = {"symbol": sym, "context": self.schemas[sym].context,
                           "snapshot": snap.to_prompt(), "decision": d.__dict__ if d else None}
                self._pending[sym] = self._brain_pool.submit(self.brain.review_escalation, payload)
                self.ledger.write("escalation", now, symbol=sym, reason=intent.reason)

            if intent.kind in ("enter", "exit", "reduce"):
                self._execute(intent, snap, now)
            elif intent.kind == "hold" and d is not None and d.direction != "neutral":
                # a directional view that the gate rejected: scored overnight as a "miss"
                self.ledger.write("miss", now, symbol=sym, direction=d.direction,
                                  conf=d.direction_conf, reason=intent.reason)

        self.ledger.write("bar", now, loop_ms=(time.perf_counter() - t_start) * 1e3,
                          equity=self.portfolio.equity(), drawdown=self.portfolio.drawdown(),
                          funding_paid=self.portfolio.funding_paid, fees_paid=self.portfolio.fees_paid)

    def _execute(self, intent: Intent, snap, now: float) -> None:
        book = self._books.get(intent.symbol)
        if book is None:
            self.ledger.write("no_book", now, symbol=intent.symbol, intent_kind=intent.kind)
            return
        order = self._order_for(intent, book, snap.mid)
        if order.qty <= 0:
            return
        res = self.broker.submit(order, snap, book, now)
        if res.fill:
            self.ledger.write("fill", now, order=order, fill=res.fill, intent_kind=intent.kind,
                              p_win=intent.p_win)
            if intent.kind in ("exit",) or abs(self.portfolio.notional(intent.symbol)) < 1e-9:
                self.policy.stops.pop(intent.symbol, None)
        elif not res.verdict.ok:
            self.ledger.write("reject", now, order=order, reasons=list(res.verdict.reasons))
        else:
            self.ledger.write("no_fill", now, order=order)

    def close(self) -> None:
        self._brain_pool.shutdown(wait=False, cancel_futures=True)
        self._jev_pool.shutdown(wait=False, cancel_futures=True)
        self.ledger.close()
