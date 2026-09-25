"""BTC/USD reference price and the USD->GBP rate. Public endpoints only, no keys.

Polymarket resolves these markets on Chainlink Data Streams, which is not publicly readable.
Chainlink builds its price from many exchanges, so the lab approximates it with the MEDIAN of
Coinbase, Kraken and Bitstamp mid prices, polled every second. If fewer than two sources are
fresh the reference is marked untrusted and the market maker stops quoting."""

from __future__ import annotations

import json
import statistics
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "updown-lab/1.0"}


def _get(url: str, timeout: float = 4.0):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return json.loads(r.read())


def coinbase(get=_get) -> float:
    d = get("https://api.exchange.coinbase.com/products/BTC-USD/ticker")
    return (float(d["bid"]) + float(d["ask"])) / 2


def kraken(get=_get) -> float:
    d = get("https://api.kraken.com/0/public/Ticker?pair=XBTUSD")["result"]
    t = next(iter(d.values()))
    return (float(t["b"][0]) + float(t["a"][0])) / 2


def bitstamp(get=_get) -> float:
    d = get("https://www.bitstamp.net/api/v2/ticker/btcusd/")
    return (float(d["bid"]) + float(d["ask"])) / 2


def gbp_per_usd(get=_get) -> float:
    r = float(get("https://api.coinbase.com/v2/exchange-rates?currency=USD")["data"]["rates"]["GBP"])
    if not 0.3 < r < 2.0:
        raise ValueError(r)
    return r


SOURCES = {"coinbase": coinbase, "kraken": kraken, "bitstamp": bitstamp}


class ReferenceFeed:
    """Background poller. `latest()` returns (ts, median price, fresh sources, per-source prices)."""

    def __init__(self, poll_s: float = 1.0, max_age_s: float = 5.0, sources=None, fx=gbp_per_usd, clock=time.time):
        self.poll_s, self.max_age_s, self.clock = poll_s, max_age_s, clock
        self.sources = sources or SOURCES
        self.fx_fn = fx
        self.quotes: dict[str, tuple[float, float]] = {}
        self.fx = 0.74                  # replaced within seconds by the live rate
        self.fx_ts = 0.0
        self.errors: dict[str, str] = {}
        self._stop = threading.Event()
        self._pool = ThreadPoolExecutor(max_workers=len(self.sources))

    def poll_once(self) -> None:
        now = self.clock()
        futs = {n: self._pool.submit(f) for n, f in self.sources.items()}
        for n, fu in futs.items():
            try:
                self.quotes[n] = (self.clock(), fu.result(timeout=5))
                self.errors.pop(n, None)
            except Exception as e:
                self.errors[n] = repr(e)[:120]
        if now - self.fx_ts > 600:
            try:
                self.fx, self.fx_ts = self.fx_fn(), now
            except Exception as e:
                self.errors["fx"] = repr(e)[:120]

    def latest(self) -> tuple[float, float | None, int, dict]:
        now = self.clock()
        fresh = {n: p for n, (t, p) in self.quotes.items() if now - t <= self.max_age_s}
        med = statistics.median(fresh.values()) if fresh else None
        return now, med, len(fresh), fresh

    def run(self) -> None:
        while not self._stop.is_set():
            t0 = time.time()
            self.poll_once()
            self._stop.wait(max(0.0, self.poll_s - (time.time() - t0)))

    def start(self) -> threading.Thread:
        th = threading.Thread(target=self.run, daemon=True, name="feed")
        th.start()
        return th

    def stop(self) -> None:
        self._stop.set()
