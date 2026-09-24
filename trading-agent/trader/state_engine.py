"""Deterministic state engine.

Turns the live order book + trade tape + portfolio into one compact numeric
snapshot per block/candle. This snapshot is the ONLY thing Jev sees.

Causality rules (enforced, not assumed):
  * every event carries an exchange timestamp `ts` (seconds, float);
  * events are ingested in non-decreasing `ts` per symbol; late events are
    rejected and counted, never silently merged into the past;
  * `snapshot(as_of)` only reads events with ts <= as_of; anything newer is
    held back, so a snapshot can never contain information from the future;
  * the snapshot carries `as_of` and the ts of the newest input it used.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field

from .portfolio import Portfolio


@dataclass(frozen=True)
class BookUpdate:
    ts: float
    symbol: str
    bids: tuple[tuple[float, float], ...]  # (price, qty), best first
    asks: tuple[tuple[float, float], ...]


@dataclass(frozen=True)
class Trade:
    ts: float
    symbol: str
    price: float
    qty: float
    side: str  # aggressor: "buy" | "sell"


@dataclass(frozen=True)
class Snapshot:
    symbol: str
    as_of: float
    data_ts: float          # newest input timestamp used (<= as_of)
    mid: float
    spread_bps: float
    imbalance: float        # top-N depth imbalance in [-1, 1]
    depth_usd: float        # top-N bid+ask notional
    ret_1_bps: float        # last bar mid return
    ret_n_bps: float        # window mid return
    rv_bps: float           # realized vol: stdev of bar returns, bps
    flow_imb: float         # signed aggressor volume imbalance over window
    inventory: float        # position notional / equity
    upnl_bps: float
    drawdown: float
    day_pnl: float

    def to_prompt(self) -> str:
        """Compact, fixed-order, fixed-precision serialization."""
        return (
            f"sym={self.symbol} t={self.as_of:.0f} mid={self.mid:.6g} "
            f"spr={self.spread_bps:.2f} imb={self.imbalance:+.3f} dep={self.depth_usd:.3g} "
            f"r1={self.ret_1_bps:+.1f} rN={self.ret_n_bps:+.1f} rv={self.rv_bps:.1f} "
            f"flow={self.flow_imb:+.3f} inv={self.inventory:+.3f} upnl={self.upnl_bps:+.1f} "
            f"dd={self.drawdown:.4f} dpnl={self.day_pnl:+.4f}"
        )


def estimate_tokens(text: str) -> int:
    """Conservative token estimate for numeric text (~3 chars/token)."""
    return math.ceil(len(text) / 3)


class CausalityError(ValueError):
    pass


@dataclass
class _SymbolState:
    books: deque = field(default_factory=lambda: deque(maxlen=64))
    trades: deque = field(default_factory=lambda: deque(maxlen=4096))
    mids: deque = field(default_factory=lambda: deque(maxlen=512))  # (as_of, mid)
    last_ts: float = -math.inf
    rejected_late: int = 0


class StateEngine:
    def __init__(self, depth_levels: int = 5, window: int = 30, token_budget: int = 400):
        self.depth_levels = depth_levels
        self.window = window
        self.token_budget = token_budget
        self._s: dict[str, _SymbolState] = {}

    def _state(self, symbol: str) -> _SymbolState:
        return self._s.setdefault(symbol, _SymbolState())

    # --- ingestion -------------------------------------------------------
    def _accept(self, st: _SymbolState, ts: float) -> bool:
        if ts < st.last_ts:
            st.rejected_late += 1
            return False
        st.last_ts = ts
        return True

    def on_book(self, u: BookUpdate) -> bool:
        if not u.bids or not u.asks:
            raise ValueError("book update needs both sides")
        if u.bids[0][0] >= u.asks[0][0]:
            raise ValueError(f"crossed book for {u.symbol}")
        st = self._state(u.symbol)
        if not self._accept(st, u.ts):
            return False
        st.books.append(u)
        return True

    def on_trade(self, t: Trade) -> bool:
        st = self._state(t.symbol)
        if not self._accept(st, t.ts):
            return False
        st.trades.append(t)
        return True

    def rejected(self, symbol: str) -> int:
        return self._state(symbol).rejected_late

    # --- snapshot --------------------------------------------------------
    def snapshot(self, symbol: str, as_of: float, portfolio: Portfolio) -> Snapshot:
        st = self._state(symbol)
        book = next((b for b in reversed(st.books) if b.ts <= as_of), None)
        if book is None:
            raise CausalityError(f"no book for {symbol} at or before {as_of}")
        if st.mids and as_of < st.mids[-1][0]:
            raise CausalityError("snapshots must be taken in non-decreasing as_of")

        bid, ask = book.bids[0][0], book.asks[0][0]
        mid = (bid + ask) / 2
        spread_bps = (ask - bid) / mid * 1e4
        n = self.depth_levels
        bid_d = sum(p * q for p, q in book.bids[:n])
        ask_d = sum(p * q for p, q in book.asks[:n])
        depth = bid_d + ask_d
        imbalance = (bid_d - ask_d) / depth if depth > 0 else 0.0

        if not st.mids or st.mids[-1][0] != as_of:
            st.mids.append((as_of, mid))
        mids = [m for _, m in list(st.mids)[-(self.window + 1):]]
        rets = [math.log(b / a) * 1e4 for a, b in zip(mids, mids[1:])]
        ret_1 = rets[-1] if rets else 0.0
        ret_n = math.log(mids[-1] / mids[0]) * 1e4 if len(mids) > 1 else 0.0
        if len(rets) > 1:
            mu = sum(rets) / len(rets)
            rv = math.sqrt(sum((r - mu) ** 2 for r in rets) / (len(rets) - 1))
        else:
            rv = 0.0

        window_start = st.mids[max(0, len(st.mids) - self.window - 1)][0]
        buy_v = sell_v = 0.0
        newest_trade_ts = -math.inf
        for t in st.trades:
            if window_start <= t.ts <= as_of:
                if t.side == "buy":
                    buy_v += t.qty * t.price
                else:
                    sell_v += t.qty * t.price
                newest_trade_ts = max(newest_trade_ts, t.ts)
        tot = buy_v + sell_v
        flow_imb = (buy_v - sell_v) / tot if tot > 0 else 0.0

        eq = portfolio.equity()
        inventory = portfolio.notional(symbol) / eq if eq > 0 else 0.0

        snap = Snapshot(
            symbol=symbol,
            as_of=as_of,
            data_ts=max(book.ts, newest_trade_ts),
            mid=mid,
            spread_bps=spread_bps,
            imbalance=imbalance,
            depth_usd=depth,
            ret_1_bps=ret_1,
            ret_n_bps=ret_n,
            rv_bps=rv,
            flow_imb=flow_imb,
            inventory=inventory,
            upnl_bps=portfolio.unrealized_bps(symbol),
            drawdown=portfolio.drawdown(),
            day_pnl=portfolio.daily_pnl_frac(),
        )
        assert snap.data_ts <= as_of, "causality violated"
        tokens = estimate_tokens(snap.to_prompt())
        if tokens >= self.token_budget:
            raise ValueError(f"snapshot {tokens} tokens exceeds budget {self.token_budget}")
        return snap
