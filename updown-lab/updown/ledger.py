"""SQLite ledger: windows, fills, model checkpoints, risk events and account state.
A restart rebuilds the open window's inventory from its fills, so nothing is lost."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS windows (
  start INTEGER PRIMARY KEY, open_ref REAL, close_ref REAL, outcome TEXT,
  yes_qty REAL, yes_cost REAL, no_qty REAL, no_cost REAL, pairs REAL, pair_cost REAL,
  hedge_bleed REAL, fees REAL, payout REAL, pnl_gbp REAL, gbp_per_usd REAL,
  maker_fills INTEGER, taker_fills INTEGER, note TEXT, resolved_ts REAL);
CREATE TABLE IF NOT EXISTS fills (
  id INTEGER PRIMARY KEY AUTOINCREMENT, window INTEGER, ts REAL, side TEXT, price REAL, qty REAL,
  fee REAL, kind TEXT, informed INTEGER, fair REAL, bleed REAL, why TEXT);
CREATE INDEX IF NOT EXISTS fills_w ON fills(window);
CREATE TABLE IF NOT EXISTS checkpoints (
  window INTEGER, at_s INTEGER, ts REAL, p_up REAL, inputs TEXT, outcome_up INTEGER,
  PRIMARY KEY (window, at_s));
CREATE TABLE IF NOT EXISTS events (ts REAL, kind TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
"""


class Ledger:
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.lock = threading.Lock()
        with self.lock:
            self.db.executescript(SCHEMA)
            self._migrate_to_gbp()

    def _migrate_to_gbp(self) -> None:
        """Older ledgers kept money in USD. Convert every amount once, at the GBP rate recorded with each window."""
        cols = [r[1] for r in self.db.execute("PRAGMA table_info(windows)")]
        if "pnl_usd" not in cols:
            return
        self.db.execute("BEGIN")
        self.db.execute("""UPDATE windows SET yes_cost=yes_cost*COALESCE(gbp_per_usd,0.74), no_cost=no_cost*COALESCE(gbp_per_usd,0.74),
                           hedge_bleed=hedge_bleed*COALESCE(gbp_per_usd,0.74), fees=fees*COALESCE(gbp_per_usd,0.74),
                           payout=payout*COALESCE(gbp_per_usd,0.74), pnl_usd=pnl_usd*COALESCE(gbp_per_usd,0.74)""")
        self.db.execute("ALTER TABLE windows RENAME COLUMN pnl_usd TO pnl_gbp")
        kv = {k: json.loads(v) for k, v in self.db.execute("SELECT k,v FROM kv")}
        if "bankroll_usd" in kv:
            start = 1000.0
            pnl = self.db.execute("SELECT COALESCE(SUM(pnl_gbp),0) FROM windows").fetchone()[0]
            fx = self.db.execute("SELECT gbp_per_usd FROM windows WHERE gbp_per_usd IS NOT NULL ORDER BY start DESC LIMIT 1").fetchone()
            fx = fx[0] if fx else 0.74
            bank = start + pnl
            peak = max(bank, kv.get("peak_usd", 0) * fx)
            for k, v in (("start_gbp", start), ("bankroll_gbp", bank), ("peak_gbp", peak)):
                self.db.execute("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, json.dumps(v)))
            self.db.execute("DELETE FROM kv WHERE k IN ('bankroll_usd','peak_usd','start_usd')")
        self.db.execute("COMMIT")

    def _x(self, sql, args=()):
        with self.lock:
            return self.db.execute(sql, args)

    # ---- key/value -----------------------------------------------------------
    def get(self, k: str, default=None):
        r = self._x("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
        return json.loads(r[0]) if r else default

    def put(self, k: str, v) -> None:
        self._x("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, json.dumps(v)))

    # ---- fills, checkpoints, events -----------------------------------------------
    def fill(self, window: int, ts: float, side: str, price: float, qty: float, fee: float, kind: str,
             informed: bool = False, fair: float | None = None, bleed: float = 0.0, why: str = "") -> None:
        self._x("INSERT INTO fills(window,ts,side,price,qty,fee,kind,informed,fair,bleed,why) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (window, ts, side, price, qty, fee, kind, int(informed), fair, bleed, why))

    def fills(self, window: int) -> list[dict]:
        cur = self._x("SELECT ts,side,price,qty,fee,kind,informed,fair,bleed,why FROM fills WHERE window=? ORDER BY id", (window,))
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def checkpoint(self, window: int, at_s: int, ts: float, p_up: float, inputs: dict) -> None:
        self._x("INSERT OR IGNORE INTO checkpoints(window,at_s,ts,p_up,inputs) VALUES(?,?,?,?,?)",
                (window, at_s, ts, p_up, json.dumps(inputs)))

    def event(self, kind: str, detail: str, ts: float | None = None) -> None:
        self._x("INSERT INTO events(ts,kind,detail) VALUES(?,?,?)", (ts or time.time(), kind, detail))

    def events(self, n: int = 20) -> list[dict]:
        return [{"ts": t, "kind": k, "detail": d} for t, k, d in
                self._x("SELECT ts,kind,detail FROM events ORDER BY ts DESC LIMIT ?", (n,)).fetchall()]

    # ---- windows -------------------------------------------------------------------
    def resolve(self, start: int, row: dict) -> None:
        cols = ["open_ref", "close_ref", "outcome", "yes_qty", "yes_cost", "no_qty", "no_cost", "pairs", "pair_cost",
                "hedge_bleed", "fees", "payout", "pnl_gbp", "gbp_per_usd", "maker_fills", "taker_fills", "note"]
        self._x(f"INSERT OR REPLACE INTO windows(start,{','.join(cols)},resolved_ts) VALUES(?,{','.join('?' * len(cols))},?)",
                (start, *[row.get(c) for c in cols], time.time()))
        if row.get("outcome") in ("UP", "DOWN"):
            self._x("UPDATE checkpoints SET outcome_up=? WHERE window=?", (1 if row["outcome"] == "UP" else 0, start))

    def windows(self, n: int = 50) -> list[dict]:
        cur = self._x("SELECT * FROM windows ORDER BY start DESC LIMIT ?", (n,))
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def totals(self) -> dict:
        r = self._x("""SELECT COUNT(*), COALESCE(SUM(pnl_gbp),0), COALESCE(SUM(CASE WHEN pnl_gbp>0 THEN 1 ELSE 0 END),0),
                       COALESCE(SUM(CASE WHEN yes_qty+no_qty>0 THEN 1 ELSE 0 END),0),
                       COALESCE(SUM(maker_fills+taker_fills),0), COALESCE(SUM(hedge_bleed),0), COALESCE(SUM(pairs),0),
                       COALESCE(SUM(pair_cost*pairs),0), COALESCE(SUM(fees),0),
                       COALESCE(SUM(pnl_gbp),0)
                       FROM windows WHERE outcome IN ('UP','DOWN')""").fetchone()
        n, pnl, wins, traded, fills, bleed, pairs, paircost_w, fees, pnl_gbp = r
        return {"windows": n, "traded_windows": traded, "pnl_gbp": pnl_gbp, "wins": wins,
                "win_rate": wins / traded if traded else None, "fills": fills, "hedge_bleed_gbp": bleed,
                "pairs": pairs, "avg_pair_cost": paircost_w / pairs if pairs else None, "fees_gbp": fees}

    def calibration(self) -> dict:
        rows = self._x("SELECT at_s,p_up,outcome_up FROM checkpoints WHERE outcome_up IS NOT NULL").fetchall()
        n = len(rows)
        if not n:
            return {"n": 0}
        brier = sum((p - y) ** 2 for _, p, y in rows) / n
        bins = []
        for b in range(10):
            sel = [(p, y) for _, p, y in rows if b / 10 <= p < (b + 1) / 10 or (b == 9 and p >= 1)]
            if sel:
                bins.append({"lo": b / 10, "said": sum(p for p, _ in sel) / len(sel), "happened": sum(y for _, y in sel) / len(sel), "n": len(sel)})
        return {"n": n, "brier": brier, "skill_vs_coinflip": 1 - brier / 0.25, "reliability": bins}
