"""Real-time view of the auto-trader, served from the Mac. Read-only.

    python -m trader live --port 8787

Streams runtime/uk-spot/live.json (rewritten every 2 s by the trader) to the
browser with Server-Sent Events, so prices, the account value, open bets and
new trades appear within a couple of seconds.

Safety:
  * the only writes are practice-bot settings and practice-account resets
    (POST /settings, POST /reset). Hard safety limits can only be tightened
    (trader/settings.py). Writes need the cookie (not a ?k= link) plus an
    X-Trader header, so another website cannot trigger them;
  * every request needs the access key from runtime/live_token (created on first
    start), passed once as ?k=... and then kept in a cookie;
  * meant to be reached over Tailscale (private network between your devices)
    or home Wi-Fi, not exposed to the internet.
"""

from __future__ import annotations

import hmac
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import settings as settings_mod
from . import uk_tax

COIN_OK = set(settings_mod.COINS)
GRANULARITY = {60, 300, 900, 3600, 21600, 86400}
CB_CANDLES = "https://api.exchange.coinbase.com/products/{coin}-GBP/candles?granularity={g}"
STATIC = {"lwc.js": "application/javascript", "LICENSE-lightweight-charts.txt": "text/plain",
          "learn.js": "application/javascript", "charts.js": "application/javascript"}
_cache: dict = {}


def fetch_candles(coin: str, g: int, now: float | None = None, opener=None) -> list:
    """Coinbase public candles, oldest first, as [t, open, high, low, close, volume].
    Cached for a few seconds so several phones do not hammer the API."""
    now = now or time.time()
    key = (coin, g)
    hit = _cache.get(key)
    if hit and now - hit[0] < (5 if g == 60 else 20):
        return hit[1]
    req = urllib.request.Request(CB_CANDLES.format(coin=coin, g=g), headers={"User-Agent": "trader-live/1.0"})
    with (opener or urllib.request.urlopen)(req, timeout=8) as r:
        rows = json.loads(r.read())
    out = sorted([int(c[0]), float(c[3]), float(c[2]), float(c[1]), float(c[4]), float(c[5])] for c in rows)
    _cache[key] = (now, out)
    return out


def read_depth(tape_dir: str, prefix: str, coin: str, minutes: float, now: float | None = None,
               step_s: float = 10.0, max_bytes: int = 24_000_000) -> list:
    """Order-book snapshots for one coin from the tail of today's tape, one every step_s."""
    now = now or time.time()
    day = time.strftime("%Y%m%d", time.gmtime(now))
    path = os.path.join(tape_dir, f"{prefix}-{day}.jsonl")
    sym = f'"sym": "{coin}-GBP"'
    out, last = [], -1e18
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - max_bytes))
            if f.tell():
                f.readline()
            for raw in f:
                if b'"t": "book"' not in raw or sym.encode() not in raw:
                    continue
                try:
                    ev = json.loads(raw)
                except ValueError:
                    continue
                ts = float(ev.get("ts", 0))
                if ts < now - minutes * 60 or ts - last < step_s:
                    continue
                last = ts
                out.append({"ts": ts, "bids": ev["bids"][:10], "asks": ev["asks"][:10]})
    except OSError:
        return []
    return out

HERE = os.path.dirname(os.path.abspath(__file__))


def load_token(path: str) -> str:
    if os.path.exists(path):
        with open(path) as f:
            tok = f.read().strip()
        if len(tok) >= 16:
            return tok
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tok = secrets.token_urlsafe(18)
    with open(path, "w") as f:
        f.write(tok)
    os.chmod(path, 0o600)
    return tok


def make_handler(accounts: dict[str, str], token: str, page: bytes, tape_dir: str = "tapes",
                 tape_prefix: str = "cb", opener=None):
    """accounts: name -> output folder holding live.json / summary.json / state.json.
    The first one is shown by default; ?a=<name> picks another."""
    names = list(accounts)

    class H(BaseHTTPRequestHandler):
        server_version = "trader-live/1.0"

        def log_message(self, *a):          # keep the log quiet
            pass

        def _authed(self, q: dict) -> tuple[bool, bool]:
            k = (q.get("k") or [""])[0]
            if k and hmac.compare_digest(k, token):
                return True, True
            for part in (self.headers.get("Cookie") or "").split(";"):
                name, _, val = part.strip().partition("=")
                if name == "tl" and hmac.compare_digest(val, token):
                    return True, False
            return False, False

        def _send(self, code: int, body: bytes, ctype: str, extra: dict | None = None):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _profile(self, acct: str) -> str:
            for name in ("live.json", "state.json"):
                try:
                    with open(os.path.join(accounts[acct], name)) as f:
                        d = json.load(f)
                    p = d.get("profile") or d.get("meta", {}).get("profile")
                    if p in settings_mod.PROFILES:
                        return p
                except (OSError, ValueError):
                    pass
            return "uk-spot-fast" if "fast" in acct else "uk-spot"

        def do_POST(self):
            u = urllib.parse.urlparse(self.path)
            ok, _ = self._authed({})                    # cookie only for writes, never a ?k= link
            if not ok:
                return self._send(403, b"forbidden", "text/plain")
            # cross-site guard: a custom header forces a CORS preflight that this server never answers
            if self.headers.get("X-Trader") != "1":
                return self._send(403, b"missing header", "text/plain")
            origin = self.headers.get("Origin")
            if origin and urllib.parse.urlparse(origin).netloc != self.headers.get("Host"):
                return self._send(403, b"bad origin", "text/plain")
            q = urllib.parse.parse_qs(u.query)
            acct = (q.get("a") or [names[0]])[0]
            if acct not in accounts:
                return self._send(404, b"unknown account", "text/plain")
            try:
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(min(n, 20000)) or b"{}")
                if not isinstance(body, dict):
                    raise ValueError
            except ValueError:
                return self._send(400, b"bad json", "text/plain")
            d = accounts[acct]
            if u.path == "/settings":
                s, notes = settings_mod.save(os.path.join(d, "settings.json"), self._profile(acct), body)
                return self._send(200, json.dumps({"settings": s, "notes": notes}).encode(), "application/json")
            if u.path == "/reset":
                try:
                    start = float(body.get("start_gbp"))
                except (TypeError, ValueError):
                    return self._send(400, b"start_gbp needed", "text/plain")
                if not 10 <= start <= 1_000_000:
                    return self._send(400, b"start_gbp must be 10 to 1,000,000", "text/plain")
                tmp = os.path.join(d, "reset.json.tmp")
                with open(tmp, "w") as f:
                    json.dump({"start_gbp": start, "requested_ts": time.time()}, f)
                os.replace(tmp, os.path.join(d, "reset.json"))
                return self._send(200, b'{"ok":true}', "application/json")
            return self._send(404, b"not found", "text/plain")

        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            ok, fresh = self._authed(urllib.parse.parse_qs(u.query))
            if not ok:
                return self._send(403, b"Access key needed. Open the link that includes ?k=...", "text/plain")
            cookie = {"Set-Cookie": f"tl={token}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Strict"} if fresh else None
            q = urllib.parse.parse_qs(u.query)
            acct = (q.get("a") or [names[0]])[0]
            if acct not in accounts:
                return self._send(404, b"unknown account", "text/plain")
            live_path = os.path.join(accounts[acct], "live.json")
            summary_path = os.path.join(accounts[acct], "summary.json")
            if u.path == "/":
                return self._send(200, page, "text/html; charset=utf-8", cookie)
            if u.path == "/accounts":
                return self._send(200, json.dumps(names).encode(), "application/json", cookie)
            if u.path.startswith("/static/"):
                name = u.path[len("/static/"):]
                if name not in STATIC:
                    return self._send(404, b"not found", "text/plain")
                with open(os.path.join(HERE, "static", name), "rb") as f:
                    return self._send(200, f.read(), STATIC[name], {"Cache-Control": "max-age=3600"})
            if u.path == "/settings":
                prof = self._profile(acct)
                s = settings_mod.load(os.path.join(accounts[acct], "settings.json"), prof)
                return self._send(200, json.dumps({"profile": prof, "settings": s,
                                                   "spec": settings_mod.spec_for(prof)}).encode(), "application/json")
            if u.path == "/candles":
                coin = (q.get("coin") or ["BTC"])[0].upper()
                try:
                    g = int((q.get("g") or ["60"])[0])
                except ValueError:
                    g = 0
                if coin not in COIN_OK or g not in GRANULARITY:
                    return self._send(400, b"bad coin or granularity", "text/plain")
                try:
                    rows = fetch_candles(coin, g, opener=opener)
                except Exception:
                    return self._send(502, b'{"error":"Coinbase candles unavailable"}', "application/json")
                return self._send(200, json.dumps(rows).encode(), "application/json")
            if u.path == "/depth":
                coin = (q.get("coin") or ["BTC"])[0].upper()
                try:
                    mins = max(1.0, min(60.0, float((q.get("mins") or ["15"])[0])))
                except ValueError:
                    mins = 15.0
                if coin not in COIN_OK:
                    return self._send(400, b"bad coin", "text/plain")
                step = max(2.0, mins * 60 / 120)
                return self._send(200, json.dumps(read_depth(tape_dir, tape_prefix, coin, mins, step_s=step)).encode(),
                                  "application/json")
            if u.path == "/fills":
                try:
                    with open(os.path.join(accounts[acct], "state.json")) as f:
                        fills = json.load(f)["book"].get("fills_all", [])[-500:]
                except (OSError, ValueError, KeyError):
                    fills = []
                return self._send(200, json.dumps(fills).encode(), "application/json")
            if u.path == "/live.json":
                try:
                    with open(live_path, "rb") as f:
                        return self._send(200, f.read(), "application/json", cookie)
                except OSError:
                    return self._send(503, b'{"error":"trader not running yet"}', "application/json")
            if u.path == "/tax.csv":
                try:
                    with open(summary_path) as f:
                        fills = json.load(f).get("fills_all")
                except (OSError, ValueError):
                    fills = None
                if fills is None:
                    try:
                        with open(os.path.join(os.path.dirname(summary_path), "state.json")) as f:
                            fills = json.load(f)["book"].get("fills_all", [])
                    except (OSError, ValueError, KeyError):
                        fills = []
                body = uk_tax.compute(uk_tax.from_trades(fills)).csv().encode()
                return self._send(200, body, "text/csv", {"Content-Disposition": 'attachment; filename="crypto-cgt-record.csv"'})
            if u.path == "/events":
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Accel-Buffering", "no")
                self.end_headers()
                last, beat = None, time.time()
                try:
                    while True:
                        try:
                            m = os.stat(live_path).st_mtime_ns
                        except OSError:
                            m = None
                        if m is not None and m != last:
                            last = m
                            with open(live_path, "rb") as f:
                                data = f.read().replace(b"\n", b"")
                            self.wfile.write(b"data: " + data + b"\n\n")
                            self.wfile.flush()
                            beat = time.time()
                        elif time.time() - beat > 15:
                            self.wfile.write(b": ping\n\n")
                            self.wfile.flush()
                            beat = time.time()
                        time.sleep(0.5)
                except (BrokenPipeError, ConnectionResetError):
                    return
            return self._send(404, b"not found", "text/plain")

    return H


def serve(accounts: dict[str, str], token_path: str, host: str = "0.0.0.0", port: int = 8787,
          tape_dir: str = "tapes", tape_prefix: str = "cb"):
    token = load_token(token_path)
    with open(os.path.join(HERE, "live_page.html"), "rb") as f:
        page = f.read()
    httpd = ThreadingHTTPServer((host, port), make_handler(accounts, token, page, tape_dir, tape_prefix))
    httpd.daemon_threads = True
    print(f"live view on http://{host}:{port}/?k={token}", flush=True)
    httpd.serve_forever()
