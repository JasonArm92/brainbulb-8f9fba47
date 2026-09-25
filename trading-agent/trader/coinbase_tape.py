"""Record Coinbase GBP spot market data to a replay tape. Read-only, no keys.

Public Coinbase Exchange endpoints only (order book and trades). Nothing here
can place, cancel or modify an order, and nothing reads account data.

Coinbase quirks handled here:
  * a trade's `side` is the MAKER's side, so the aggressor (what the flow signal
    needs) is the opposite: a "sell" print means a buyer lifted the offer;
  * timestamps are ISO-8601 with nanoseconds; we keep microseconds;
  * GBP pairs are quoted in pounds, so the tape and the account need no FX.

Same tape format as trader/okx_tape.py (see trader/replay.py), written to
tapes/cb-YYYYMMDD.jsonl.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime

from .okx_tape import aggregate_trades

BASE = "https://api.exchange.coinbase.com"
# Top-100 coins (CoinGecko, 2026-09-25) with a fully tradeable Coinbase GBP pair, busiest GBP market first.
# XRP-GBP and ICP-GBP are delisted; stablecoins are left out.
UK_COINS = ["BTC", "LINK", "ETH", "SOL", "ADA", "DOT", "UNI", "LTC", "DOGE", "FIL", "AAVE", "ALGO", "ATOM", "SHIB", "BCH", "ETC"]
DEFAULT_SYMBOLS = {f"{c}-GBP": f"{c}-GBP" for c in UK_COINS}
BUSY = {"BTC-GBP", "LINK-GBP", "ETH-GBP", "SOL-GBP"}        # trades fetched every cycle; others every 3rd


def iso_ts(s: str) -> float:
    s = s.rstrip("Z")
    if "." in s:
        head, frac = s.split(".", 1)
        s = f"{head}.{frac[:6]}"
    return datetime.fromisoformat(s + "+00:00").timestamp()


def book_line(resp: dict, sym: str, depth: int = 5, recv_ts: float | None = None) -> dict:
    lv = lambda side: [[float(p), float(q)] for p, q, *_ in resp[side][:depth]]
    ts = iso_ts(resp["time"]) if resp.get("time") else recv_ts
    if ts is None:
        raise ValueError("book has no timestamp")
    return {"t": "book", "ts": ts, "sym": sym, "bids": lv("bids"), "asks": lv("asks"), "seq": resp.get("sequence")}


def trade_lines(resp: list, sym: str, last_id: int | None) -> tuple[list[dict], int | None, dict | None]:
    rows = sorted(resp, key=lambda r: int(r["trade_id"]))
    new = [r for r in rows if last_id is None or int(r["trade_id"]) > last_id]
    gap = None
    if new and last_id is not None and int(new[0]["trade_id"]) > last_id + 1:
        gap = {"t": "gap", "ts": iso_ts(new[0]["time"]), "sym": sym, "what": "trades",
               "detail": f"{int(new[0]['trade_id']) - last_id - 1} trade ids not captured"}
    lines = [{"t": "trade", "ts": iso_ts(r["time"]), "sym": sym, "px": float(r["price"]), "qty": float(r["size"]),
              "side": "buy" if r["side"] == "sell" else "sell", "id": str(r["trade_id"])} for r in new]
    newest = int(rows[-1]["trade_id"]) if rows else None
    cursor = newest if last_id is None else max(last_id, newest if newest is not None else last_id)
    return lines, cursor, gap


def _get(path: str, **params):
    url = f"{BASE}{path}" + (f"?{urllib.parse.urlencode(params)}" if params else "")
    req = urllib.request.Request(url, headers={"User-Agent": "trading-agent-recorder/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


@dataclass
class CoinbaseRecorder:
    out_path: str
    symbols: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_SYMBOLS))
    poll_s: float = 2.0
    aggregate: bool = True
    max_rps: float = 6.0          # Coinbase public limit is ~10/s per IP; leave room for the live view
    trade_every: int = 3          # quieter coins: fetch trades every Nth cycle
    busy: set = field(default_factory=lambda: set(BUSY))
    _cycle: int = 0
    get: object = _get
    _last_trade: dict[str, int | None] = field(default_factory=dict)
    _last_book_ts: dict[str, float] = field(default_factory=dict)

    def _fetch(self, path, **params):
        try:
            return self.get(path, **params), None
        except Exception as e:
            return None, e

    def poll_once(self, now: float) -> list[dict]:
        """One cycle: every coin's book, and trades for busy coins (all coins every `trade_every` cycles).
        Requests are spread out to stay under `max_rps`."""
        lines: list[dict] = []
        all_trades = self._cycle % max(1, self.trade_every) == 0
        self._cycle += 1
        gap_s = 1.0 / self.max_rps if self.max_rps else 0.0
        with ThreadPoolExecutor(max_workers=4) as pool:
            futs = {}
            for sym, pid in self.symbols.items():
                fb = pool.submit(self._fetch, f"/products/{pid}/book", level=2)
                if gap_s and len(self.symbols) > 4:
                    time.sleep(gap_s)
                ft = None
                if all_trades or sym in self.busy or len(self.symbols) <= 4:
                    ft = pool.submit(self._fetch, f"/products/{pid}/trades", limit=100)
                    if gap_s and len(self.symbols) > 4:
                        time.sleep(gap_s)
                futs[sym] = (fb, ft)
        for sym, (fb, ft) in futs.items():
            try:
                (book, be), (trades, te) = fb.result(), (ft.result() if ft else ([], None))
                if be:
                    raise be
                bl = book_line(book, sym, recv_ts=now)
                if bl["bids"] and bl["asks"] and bl["ts"] > self._last_book_ts.get(sym, 0.0):
                    self._last_book_ts[sym] = bl["ts"]
                    lines.append(bl)
                if te:
                    raise te
                if ft is None:
                    continue
                tl, self._last_trade[sym], gap = trade_lines(trades, sym, self._last_trade.get(sym))
                if gap:
                    lines.append(gap)
                lines.extend(aggregate_trades(tl) if self.aggregate else tl)
            except Exception as e:
                lines.append({"t": "gap", "ts": now, "sym": sym, "what": "poll", "detail": repr(e)[:200]})
        return lines

    def run(self, duration_s: float | None = None) -> None:
        start = time.time()
        with open(self.out_path, "a") as f:
            f.write(json.dumps({"t": "meta", "venue": "coinbase", "symbols": self.symbols, "quote": "GBP",
                                "poll_s": self.poll_s, "started": start}) + "\n")
            while duration_s is None or time.time() - start < duration_s:
                t0 = time.time()
                for line in self.poll_once(t0):
                    f.write(json.dumps(line) + "\n")
                f.flush()
                time.sleep(max(0.0, self.poll_s - (time.time() - t0)))
