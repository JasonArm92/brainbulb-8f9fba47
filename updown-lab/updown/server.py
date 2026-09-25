"""FastAPI + WebSocket server for the lab's phone view.

    python -m updown.server --port 8788

Same access pattern as the Coinbase bot's live view: open the link with ?k=<key> once
(key in runtime/token), after which an HttpOnly cookie is used. Writes (kill switch,
clearing the breaker) need the cookie AND an X-Lab header, and are refused from other sites.
Meant to be reached over Tailscale, not the open internet."""

from __future__ import annotations

import argparse
import asyncio
import hmac
import json
import os
import secrets

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

from .config import Config, assert_paper

HERE = os.path.dirname(os.path.abspath(__file__))


def load_token(path: str) -> str:
    if os.path.exists(path):
        t = open(path).read().strip()
        if len(t) >= 16:
            return t
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    t = secrets.token_urlsafe(18)
    with open(path, "w") as f:
        f.write(t)
    os.chmod(path, 0o600)
    return t


def create_app(engine, token: str, page: bytes | None = None, push_every_s: float = 1.0) -> FastAPI:
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    page = page if page is not None else open(os.path.join(HERE, "static", "index.html"), "rb").read()

    def ok_cookie(c: str | None) -> bool:
        return bool(c) and hmac.compare_digest(c, token)

    def nocache(r):
        r.headers["Cache-Control"] = "no-store"
        r.headers["X-Content-Type-Options"] = "nosniff"
        r.headers["Referrer-Policy"] = "no-referrer"
        return r

    @app.get("/")
    def index(request: Request, k: str = ""):
        fresh = bool(k) and hmac.compare_digest(k, token)
        if not fresh and not ok_cookie(request.cookies.get("ul")):
            return PlainTextResponse("Access key needed. Open the link that includes ?k=...", status_code=403)
        r = nocache(HTMLResponse(page))
        if fresh:
            r.set_cookie("ul", token, max_age=31536000, httponly=True, samesite="strict")
        return r

    @app.get("/api/state")
    def state(request: Request):
        if not ok_cookie(request.cookies.get("ul")):
            return PlainTextResponse("forbidden", status_code=403)
        return nocache(JSONResponse(engine.snapshot()))

    def guard(request: Request):
        if not ok_cookie(request.cookies.get("ul")) or request.headers.get("x-lab") != "1":
            return PlainTextResponse("forbidden", status_code=403)
        origin = request.headers.get("origin")
        if origin and origin.split("://", 1)[-1] != request.headers.get("host"):
            return PlainTextResponse("bad origin", status_code=403)
        return None

    @app.post("/api/kill")
    async def kill(request: Request):
        if (bad := guard(request)) is not None:
            return bad
        body = await request.json()
        engine.set_kill(bool(body.get("on")), "phone")
        return {"ok": True, "killed": engine.risk.killed}

    @app.post("/api/breaker/clear")
    def clear(request: Request):
        if (bad := guard(request)) is not None:
            return bad
        engine.clear_breaker()
        return {"ok": True}

    @app.websocket("/ws")
    async def ws(sock: WebSocket):
        if not ok_cookie(sock.cookies.get("ul")):
            await sock.close(code=4403)
            return
        await sock.accept()
        try:
            while True:
                await sock.send_text(json.dumps(engine.snapshot()))
                await asyncio.sleep(push_every_s)
        except (WebSocketDisconnect, RuntimeError):
            return

    return app


def main() -> None:
    import uvicorn

    from .engine import Engine
    from .feeds import ReferenceFeed

    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8788)
    ap.add_argument("--token-file", default="runtime/token")
    a = ap.parse_args()
    assert_paper()
    cfg = Config()
    feed = ReferenceFeed()
    feed.poll_once()
    feed.start()
    eng = Engine(cfg, feed)
    def load_backtest():                        # picks up the daily re-run (com.jason.updown-backtest)
        import threading
        import time as _t
        while True:
            try:
                if os.path.exists("runtime/backtest.json"):
                    eng.ledger.put("backtest", json.load(open("runtime/backtest.json")))
            except (OSError, ValueError):
                pass
            _t.sleep(3600)
    import threading
    threading.Thread(target=load_backtest, daemon=True).start()
    eng.start()
    token = load_token(a.token_file)
    print(f"updown-lab on http://{a.host}:{a.port}/?k={token}", flush=True)
    uvicorn.run(create_app(eng, token), host=a.host, port=a.port, log_level="warning")


if __name__ == "__main__":
    main()
