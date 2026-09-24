"""Record OKX public market data to a replay tape. Read-only, no API keys.

Only PUBLIC endpoints are used (order book, trades, funding history, instrument
specs). Nothing here can place, cancel or modify an order, and nothing reads
account data. This is a data recorder for the replay rung, not a venue adapter.

Limits of REST polling, stated plainly:
  * the book is sampled every `poll_s`, so faster book changes are missed;
  * each trades call returns the newest 100 trades; if more printed since the
    last poll, the recorder writes a `gap` line (detected via tradeId), so the
    replay report can show how much flow was lost. A websocket recorder removes
    both limits and is the upgrade path.

Sizes are converted from contracts to base units with the instrument's ctVal.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

BASE = "https://www.okx.com"

DEFAULT_SYMBOLS = {
    "BTC-PERP": "BTC-USDT-SWAP", "ETH-PERP": "ETH-USDT-SWAP", "SOL-PERP": "SOL-USDT-SWAP",
    "HYPE-PERP": "HYPE-USDT-SWAP", "AAVE-PERP": "AAVE-USDT-SWAP", "ENA-PERP": "ENA-USDT-SWAP",
    "SUI-PERP": "SUI-USDT-SWAP",
}


def _data(resp: dict) -> list:
    if str(resp.get("code")) != "0":
        raise RuntimeError(f"OKX error {resp.get('code')}: {resp.get('msg')}")
    return resp["data"]


def book_line(resp: dict, sym: str, ct_val: float) -> dict:
    d = _data(resp)[0]
    lv = lambda side: [[float(p), float(sz) * ct_val] for p, sz, *_ in d[side]]
    return {"t": "book", "ts": int(d["ts"]) / 1000, "sym": sym, "bids": lv("bids"), "asks": lv("asks"),
            "seq": d.get("seqId")}


def trade_lines(resp: dict, sym: str, ct_val: float, last_id: int | None) -> tuple[list[dict], int | None, dict | None]:
    """New trades since last_id, oldest first, plus the new last_id and an optional gap line."""
    rows = sorted(_data(resp), key=lambda r: int(r["tradeId"]))
    new = [r for r in rows if last_id is None or int(r["tradeId"]) > last_id]
    gap = None
    if new and last_id is not None and int(new[0]["tradeId"]) > last_id + 1:
        missed = int(new[0]["tradeId"]) - last_id - 1
        gap = {"t": "gap", "ts": int(new[0]["ts"]) / 1000, "sym": sym, "what": "trades",
               "detail": f"{missed} trade ids not captured"}
    lines = [{"t": "trade", "ts": int(r["ts"]) / 1000, "sym": sym, "px": float(r["px"]),
              "qty": float(r["sz"]) * ct_val, "side": r["side"], "id": r["tradeId"]} for r in new]
    return lines, (int(rows[-1]["tradeId"]) if rows else last_id), gap


def funding_lines(resp: dict, sym: str, seen: set, interval_h: float = 8.0) -> list[dict]:
    out = []
    for r in sorted(_data(resp), key=lambda r: int(r["fundingTime"])):
        t = int(r["fundingTime"])
        if t in seen:
            continue
        seen.add(t)
        rate = r.get("realizedRate") or r.get("fundingRate")
        out.append({"t": "funding", "ts": t / 1000, "sym": sym, "rate": float(rate), "interval_h": interval_h})
    return out


def _get(path: str, **params) -> dict:
    url = f"{BASE}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "trading-agent-recorder/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


@dataclass
class Recorder:
    out_path: str
    symbols: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_SYMBOLS))
    poll_s: float = 2.0
    funding_every_s: float = 300.0
    get: object = _get           # injectable for tests
    ct_val: dict[str, float] = field(default_factory=dict)
    _last_trade: dict[str, int | None] = field(default_factory=dict)
    _funding_seen: dict[str, set] = field(default_factory=dict)
    _last_funding_poll: float = 0.0

    def load_specs(self) -> None:
        for sym, inst in self.symbols.items():
            spec = _data(self.get("/api/v5/public/instruments", instType="SWAP", instId=inst))[0]
            self.ct_val[sym] = float(spec["ctVal"])

    def poll_once(self, now: float) -> list[dict]:
        lines: list[dict] = []
        for sym, inst in self.symbols.items():
            cv = self.ct_val[sym]
            try:
                lines.append(book_line(self.get("/api/v5/market/books", instId=inst, sz=5), sym, cv))
                tl, self._last_trade[sym], gap = trade_lines(
                    self.get("/api/v5/market/trades", instId=inst, limit=100), sym, cv, self._last_trade.get(sym))
                if gap:
                    lines.append(gap)
                lines.extend(tl)
            except Exception as e:  # network or venue error: record the hole, keep going
                lines.append({"t": "gap", "ts": now, "sym": sym, "what": "poll", "detail": repr(e)[:200]})
        if now - self._last_funding_poll >= self.funding_every_s:
            self._last_funding_poll = now
            for sym, inst in self.symbols.items():
                try:
                    resp = self.get("/api/v5/public/funding-rate-history", instId=inst, limit=3)
                    lines.extend(funding_lines(resp, sym, self._funding_seen.setdefault(sym, set())))
                except Exception as e:
                    lines.append({"t": "gap", "ts": now, "sym": sym, "what": "funding", "detail": repr(e)[:200]})
        return lines

    def run(self, duration_s: float | None = None) -> None:
        self.load_specs()
        start = time.time()
        with open(self.out_path, "a") as f:
            f.write(json.dumps({"t": "meta", "venue": "okx", "symbols": self.symbols, "ct_val": self.ct_val,
                                "poll_s": self.poll_s, "started": start}) + "\n")
            while duration_s is None or time.time() - start < duration_s:
                t0 = time.time()
                for line in self.poll_once(t0):
                    f.write(json.dumps(line) + "\n")
                f.flush()
                time.sleep(max(0.0, self.poll_s - (time.time() - t0)))
