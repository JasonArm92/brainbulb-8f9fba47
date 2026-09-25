"""Real-time view: token-gated, read-only, streams live.json."""

import io
import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from trader import live_server


srv_calls: list = []


@pytest.fixture
def srv(tmp_path):
    (tmp_path / "fast").mkdir()
    (tmp_path / "fast" / "live.json").write_text(json.dumps({"ts": 1.0, "value": 990.0}))
    live = tmp_path / "live.json"
    live.write_text(json.dumps({"ts": 1.0, "value": 50.0}))
    (tmp_path / "state.json").write_text(json.dumps({"book": {"fills_all": [
        {"ts": 1790240000.0, "sym": "BTC-GBP", "side": "buy", "qty": 0.0002, "px": 60000.0, "fee": 0.07},
        {"ts": 1790243600.0, "sym": "BTC-GBP", "side": "sell", "qty": 0.0002, "px": 61000.0, "fee": 0.07}]}}))
    tok = live_server.load_token(str(tmp_path / "tok"))
    assert oct(os.stat(tmp_path / "tok").st_mode)[-3:] == "600"
    assert live_server.load_token(str(tmp_path / "tok")) == tok        # stable across restarts
    page = open(os.path.join(live_server.HERE, "live_page.html"), "rb").read()
    tapes = tmp_path / "tapes"
    tapes.mkdir()
    now = time.time()
    day = time.strftime("%Y%m%d", time.gmtime(now))
    with open(tapes / f"cb-{day}.jsonl", "w") as f:
        for i in range(120):
            for sym in ("BTC-GBP", "ETH-GBP"):
                f.write(json.dumps({"t": "book", "ts": now - 600 + i * 5, "sym": sym,
                                    "bids": [[100 - k, 1.0] for k in range(12)],
                                    "asks": [[101 + k, 1.0] for k in range(12)]}) + "\n")

    class Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    calls = []

    def opener(req, timeout=0):
        calls.append(req.full_url)
        # Coinbase order: [time, low, high, open, close, volume], newest first
        return Resp(json.dumps([[1060, 9, 12, 10, 11, 5.5], [1000, 8, 11, 9, 10, 2.0]]).encode())

    live_server._cache.clear()
    h = ThreadingHTTPServer(("127.0.0.1", 0), live_server.make_handler(
        {"careful": str(tmp_path), "fast": str(tmp_path / "fast")}, tok, page, str(tapes), "cb", opener,
        str(tmp_path / "training" / "progress.json")))
    srv_calls.clear()
    srv_calls.extend([calls])
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


def test_a_key_link_alone_cannot_write(srv):
    base, tok, _ = srv
    req = urllib.request.Request(f"{base}/settings?k={tok}", data=b"{}", method="POST",
                                 headers={"X-Trader": "1"})
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(req, timeout=5)
    assert e.value.code == 403


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


def test_two_accounts(srv):
    base, tok, _ = srv
    assert json.load(get(f"{base}/accounts?k={tok}")) == ["careful", "fast"]
    assert json.load(get(f"{base}/live.json?a=fast&k={tok}"))["value"] == 990.0
    assert json.load(get(f"{base}/live.json?k={tok}"))["value"] == 50.0
    with pytest.raises(urllib.error.HTTPError) as e:
        get(f"{base}/live.json?a=../etc&k={tok}")
    assert e.value.code == 404


def post(url, body, cookie=None, header=True, origin=None):
    h = {"Content-Type": "application/json"}
    if cookie:
        h["Cookie"] = cookie
    if header:
        h["X-Trader"] = "1"
    if origin:
        h["Origin"] = origin
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=h, method="POST")
    return urllib.request.urlopen(req, timeout=5)


def test_settings_round_trip_and_write_guards(srv, tmp_path):
    base, tok, _ = srv
    ck = f"tl={tok}"
    d = json.load(get(f"{base}/settings?a=fast", cookie=ck))
    assert d["profile"] == "uk-spot-fast" and d["settings"]["require_edge"] is False
    assert any(x["key"] == "daily_loss_pct" and x["max"] == 3.0 for x in d["spec"])
    r = json.load(post(f"{base}/settings?a=careful", {"decision_every_s": 15, "daily_loss_pct": 9}, cookie=ck))
    assert r["settings"]["decision_every_s"] == 15 and r["settings"]["daily_loss_pct"] == 3.0 and r["notes"]
    assert json.load(open(tmp_path / "settings.json"))["decision_every_s"] == 15
    for kw in ({"cookie": None}, {"cookie": ck, "header": False}, {"cookie": ck, "origin": "http://evil.example"}):
        with pytest.raises(urllib.error.HTTPError) as e:
            post(f"{base}/settings?a=careful&k={tok}", {"paused": True}, **kw)
        assert e.value.code == 403
    assert not json.load(open(tmp_path / "settings.json"))["paused"]


def test_reset_request(srv, tmp_path):
    base, tok, _ = srv
    ck = f"tl={tok}"
    with pytest.raises(urllib.error.HTTPError) as e:
        post(f"{base}/reset?a=fast", {"start_gbp": 5}, cookie=ck)
    assert e.value.code == 400
    assert json.load(post(f"{base}/reset?a=fast", {"start_gbp": 1500}, cookie=ck))["ok"]
    assert json.load(open(tmp_path / "fast" / "reset.json"))["start_gbp"] == 1500


def test_candles_depth_static(srv):
    base, tok, _ = srv
    ck = f"tl={tok}"
    rows = json.load(get(f"{base}/candles?coin=btc&g=60", cookie=ck))
    assert rows == [[1000, 9.0, 11.0, 8.0, 10.0, 2.0], [1060, 10.0, 12.0, 9.0, 11.0, 5.5]]   # t,o,h,l,c,v
    json.load(get(f"{base}/candles?coin=BTC&g=60", cookie=ck))
    with pytest.raises(urllib.error.HTTPError):
        get(f"{base}/candles?coin=XRP&g=60", cookie=ck)
    dep = json.load(get(f"{base}/depth?coin=ETH&mins=5", cookie=ck))
    assert 50 <= len(dep) <= 62 and len(dep[0]["bids"]) == 10
    js = get(f"{base}/static/lwc.js", cookie=ck).read()
    assert b"LightweightCharts" in js[:5000] or len(js) > 100000
    with pytest.raises(urllib.error.HTTPError):
        get(f"{base}/static/../live_server.py", cookie=ck)


def test_history_candles_for_training(srv):
    base, tok, _ = srv
    ck = f"tl={tok}"
    live_server._cache.clear()
    end = 1735689600 + 3600 * 5 + 17                      # 2025-01-01 05:00:17 -> floored to the hour
    json.load(get(f"{base}/candles?coin=ETH&g=3600&end={end}", cookie=ck))
    url = srv_calls[0][-1]
    assert "ETH-GBP" in url and "granularity=3600" in url
    assert "end=2025-01-01T05:00:00Z" in url and "start=2024-12-19T17:00:00Z" in url   # 300 hours earlier
    for bad in ("end=100", f"end={int(time.time()) + 86400}", "end=abc"):
        with pytest.raises(urllib.error.HTTPError) as e:
            get(f"{base}/candles?coin=ETH&g=3600&{bad}", cookie=ck)
        assert e.value.code == 400


def test_training_progress_sync(srv, tmp_path):
    base, tok, _ = srv
    ck = f"tl={tok}"
    assert json.load(get(f"{base}/progress", cookie=ck)) == {}
    assert json.load(post(f"{base}/progress", {"xp": 120, "updated": 5}, cookie=ck))["ok"]
    assert json.load(get(f"{base}/progress", cookie=ck))["xp"] == 120
    with pytest.raises(urllib.error.HTTPError) as e:
        post(f"{base}/progress", {"xp": 1}, cookie=ck, header=False)
    assert e.value.code == 403
    with pytest.raises(urllib.error.HTTPError) as e:
        post(f"{base}/progress", {"blob": "x" * 500_000}, cookie=ck)
    assert e.value.code == 413
    assert json.load(open(tmp_path / "training" / "progress.json"))["xp"] == 120
