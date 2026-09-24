"""Real-time view of the auto-trader, served from the Mac. Read-only.

    python -m trader live --port 8787

Streams runtime/uk-spot/live.json (rewritten every 2 s by the trader) to the
browser with Server-Sent Events, so prices, the account value, open bets and
new trades appear within a couple of seconds.

Safety:
  * read-only: GET only, no endpoint changes anything;
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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import uk_tax

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


def make_handler(live_path: str, summary_path: str, token: str, page: bytes):
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

        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            ok, fresh = self._authed(urllib.parse.parse_qs(u.query))
            if not ok:
                return self._send(403, b"Access key needed. Open the link that includes ?k=...", "text/plain")
            cookie = {"Set-Cookie": f"tl={token}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Strict"} if fresh else None
            if u.path == "/":
                return self._send(200, page, "text/html; charset=utf-8", cookie)
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


def serve(live_path: str, summary_path: str, token_path: str, host: str = "0.0.0.0", port: int = 8787):
    token = load_token(token_path)
    with open(os.path.join(HERE, "live_page.html"), "rb") as f:
        page = f.read()
    httpd = ThreadingHTTPServer((host, port), make_handler(live_path, summary_path, token, page))
    httpd.daemon_threads = True
    print(f"live view on http://{host}:{port}/?k={token}", flush=True)
    httpd.serve_forever()
