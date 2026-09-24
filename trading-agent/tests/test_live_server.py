"""Real-time view: token-gated, read-only, streams live.json."""

import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from trader import live_server


@pytest.fixture
def srv(tmp_path):
    live = tmp_path / "live.json"
    live.write_text(json.dumps({"ts": 1.0, "value": 50.0}))
    (tmp_path / "state.json").write_text(json.dumps({"book": {"fills_all": [
        {"ts": 1790240000.0, "sym": "BTC-GBP", "side": "buy", "qty": 0.0002, "px": 60000.0, "fee": 0.07},
        {"ts": 1790243600.0, "sym": "BTC-GBP", "side": "sell", "qty": 0.0002, "px": 61000.0, "fee": 0.07}]}}))
    tok = live_server.load_token(str(tmp_path / "tok"))
    assert oct(os.stat(tmp_path / "tok").st_mode)[-3:] == "600"
    assert live_server.load_token(str(tmp_path / "tok")) == tok        # stable across restarts
    page = open(os.path.join(live_server.HERE, "live_page.html"), "rb").read()
    h = ThreadingHTTPServer(("127.0.0.1", 0), live_server.make_handler(str(live), str(tmp_path / "summary.json"), tok, page))
    h.daemon_threads = True
    threading.Thread(target=h.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{h.server_port}", tok, live
    h.shutdown()


def get(url, cookie=None):
    req = urllib.request.Request(url, headers={"Cookie": cookie} if cookie else {})
    return urllib.request.urlopen(req, timeout=5)


def test_needs_the_key(srv):
    base, tok, _ = srv
    for path in ("/", "/live.json", "/events", "/tax.csv", "/?k=wrong"):
        with pytest.raises(urllib.error.HTTPError) as e:
            get(base + path)
        assert e.value.code == 403


def test_key_sets_cookie_then_cookie_works(srv):
    base, tok, _ = srv
    r = get(f"{base}/?k={tok}")
    assert r.status == 200 and b"Live Trader" in r.read()
    ck = r.headers["Set-Cookie"]
    assert "HttpOnly" in ck and "SameSite=Strict" in ck
    d = json.load(get(base + "/live.json", cookie=f"tl={tok}"))
    assert d["value"] == 50.0


def test_read_only(srv):
    base, tok, _ = srv
    req = urllib.request.Request(f"{base}/live.json?k={tok}", data=b"{}", method="POST")
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(req, timeout=5)
    assert e.value.code == 501


def test_events_stream_new_snapshots(srv):
    base, tok, live = srv
    r = get(f"{base}/events?k={tok}")
    assert r.headers["Content-Type"] == "text/event-stream"
    first = r.readline()
    assert json.loads(first[len(b"data: "):])["value"] == 50.0
    r.readline()
    time.sleep(0.05)
    live.write_text(json.dumps({"ts": 3.0, "value": 51.5}))
    os.utime(live, ns=(time.time_ns(), time.time_ns() + 10**9))
    line = r.readline()
    assert json.loads(line[len(b"data: "):])["value"] == 51.5
    r.close()


def test_tax_csv(srv):
    base, tok, _ = srv
    body = get(f"{base}/tax.csv?k={tok}").read().decode()
    rows = body.strip().splitlines()
    assert rows[0].startswith("date,tax_year,asset") and len(rows) == 2
    assert ",BTC," in rows[1] and "same-day" in rows[1]
