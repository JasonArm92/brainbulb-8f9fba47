import json

from fastapi.testclient import TestClient

from updown.config import Config, SimMarketConfig
from updown.engine import Engine
from updown.server import create_app, load_token

from conftest import Clock, WalkFeed

T0 = 1790330400.0


def app(tmp_path):
    clock = Clock(T0 - 1)
    e = Engine(Config(sim=SimMarketConfig(seed=3), db_path=str(tmp_path / "l.sqlite"), kill_path=str(tmp_path / "K")),
               WalkFeed(clock), clock=clock)
    for _ in range(1400):
        clock.t += 0.5
        e.tick()
    tok = load_token(str(tmp_path / "token"))
    return e, tok, TestClient(create_app(e, tok, page=b"<html>Up/Down Lab</html>", push_every_s=0.01))


def test_key_link_cookie_and_state(tmp_path):
    e, tok, c = app(tmp_path)
    assert c.get("/").status_code == 403 and c.get("/api/state").status_code == 403
    r = c.get(f"/?k={tok}")
    assert r.status_code == 200 and "httponly" in r.headers["set-cookie"].lower() and "samesite=strict" in r.headers["set-cookie"].lower()
    s = c.get("/api/state").json()                              # cookie now set on the client
    assert s["mode"] == "paper" and s["market"] == "simulated" and s["window"]["slug"].startswith("btc-updown-5m-")


def test_websocket_pushes_state(tmp_path):
    e, tok, c = app(tmp_path)
    c.get(f"/?k={tok}")
    with c.websocket_connect("/ws") as ws:
        a, b = json.loads(ws.receive_text()), json.loads(ws.receive_text())
    assert "fair" in a and "account" in b


def test_websocket_needs_cookie(tmp_path):
    e, tok, c = app(tmp_path)
    try:
        with c.websocket_connect("/ws") as ws:
            ws.receive_text()
        assert False, "should have been refused"
    except Exception:
        pass


def test_kill_switch_writes_are_guarded(tmp_path):
    e, tok, c = app(tmp_path)
    assert c.post("/api/kill", json={"on": True}, headers={"X-Lab": "1"}).status_code == 403     # no cookie
    c.get(f"/?k={tok}")
    assert c.post("/api/kill", json={"on": True}).status_code == 403                               # no header
    assert c.post("/api/kill", json={"on": True}, headers={"X-Lab": "1", "Origin": "http://evil.example"}).status_code == 403
    assert not e.risk.killed
    assert c.post("/api/kill", json={"on": True}, headers={"X-Lab": "1"}).json()["killed"] is True
    assert e.risk.killed and e.ledger.get("killed") is True
    assert c.post("/api/kill", json={"on": False}, headers={"X-Lab": "1"}).json()["killed"] is False
    e.risk.halted_until = e.clock() + 999
    assert c.post("/api/breaker/clear", headers={"X-Lab": "1"}).status_code == 200 and not e.snapshot()["risk"]["halted"]
