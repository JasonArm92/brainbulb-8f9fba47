"""CLI.

  python -m trader compile                 # research/finalists.json -> schemas/*.v1.json
  python -m trader paper --bars 2000       # paper loop on the synthetic feed (SimulatedEngine)
  python -m trader paper --engine jev      # paper loop, real Jev decisions (needs TYPESAFE_API_KEY)
  python -m trader review                  # overnight review -> runtime/review.json
  python -m trader promote PATH --approved-by NAME
  python -m trader shadow [--start-gbp 10000]   # live prices from the recorder, paper account, runs until stopped
  python -m trader replay TAPE... [--engine sim|jev] [--bar 60] [--schemas DIR]   # rung 1 on recorded data
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import os

from .config import AgentConfig
from .jev_schema import compile_schema, load_latest, save


def main() -> None:
    ap = argparse.ArgumentParser(prog="trader")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("compile")
    p = sub.add_parser("paper")
    p.add_argument("--bars", type=int, default=2000)
    p.add_argument("--engine", choices=["sim", "jev"], default="sim")
    p.add_argument("--equity", type=float, default=100_000.0)
    p.add_argument("--seed", type=int, default=7)
    r = sub.add_parser("review")
    r.add_argument("--horizon", type=int, default=5)
    rp = sub.add_parser("replay")
    rp.add_argument("tape", nargs="+", help="one or more tape files (.jsonl or .jsonl.gz), e.g. tapes/okx-*")
    rp.add_argument("--engine", choices=["sim", "jev"], default="sim")
    rp.add_argument("--bar", type=float, default=60.0)
    rp.add_argument("--equity", type=float, default=100_000.0)
    rp.add_argument("--heldout", type=float, default=0.3)
    rp.add_argument("--schemas", default=None, help="schema dir to replay (e.g. schemas/candidates for A/B)")
    rp.add_argument("--out", default="runtime/replay")
    sh = sub.add_parser("shadow")
    sh.add_argument("--tape-dir", default="tapes")
    sh.add_argument("--out", default=None, help="default runtime/uk-spot or runtime/shadow")
    sh.add_argument("--profile", choices=["uk-spot", "uk-spot-fast", "perp-research"], default="uk-spot",
                    help="uk-spot: Coinbase GBP spot, up-bets only, small-account rules (UK retail). "
                         "uk-spot-fast: same rules, trades more often for smaller gains (practice only). "
                         "perp-research: the original OKX perpetuals set-up, research only.")
    sh.add_argument("--start-gbp", type=float, default=None, help="default 1000 for the uk profiles, 10000 for perp-research")
    sh.add_argument("--engine", choices=["auto", "sim", "jev"], default="auto",
                    help="auto = Jev if TYPESAFE_API_KEY is set, otherwise the practice engine")
    lv = sub.add_parser("live", help="real-time web view of the auto-trader (read-only)")
    lv.add_argument("--account", action="append", metavar="NAME=DIR",
                    help="repeatable; default careful=runtime/uk-spot fast=runtime/uk-fast")
    lv.add_argument("--host", default="0.0.0.0")
    lv.add_argument("--port", type=int, default=8787)
    lv.add_argument("--token-file", default="runtime/live_token")
    pr = sub.add_parser("promote")
    pr.add_argument("path")
    pr.add_argument("--approved-by", required=True)
    a = ap.parse_args()
    cfg = AgentConfig()

    if a.cmd == "live":
        from .live_server import serve
        accts = dict(x.split("=", 1) for x in a.account) if a.account else {
            "careful": "runtime/uk-spot", "fast": "runtime/uk-fast"}
        serve(accts, a.token_file, a.host, a.port)
        return

    with open("research/finalists.json") as f:
        finalists = json.load(f)["finalists"]

    if a.cmd == "compile":
        for fin in finalists:
            try:
                print(save(compile_schema(fin), cfg.schema_dir))
            except Exception as e:
                print(f"{fin['symbol']}: {e}")
        return

    if a.cmd == "paper":
        from .agent import Agent
        from .brain import make_brain
        from .calibration import Calibrator
        from .jev_client import JevEngine, SimulatedEngine
        from .portfolio import Portfolio
        from .sim import SimMarket

        schemas = {fin["symbol"]: load_latest(cfg.schema_dir, fin["symbol"]) for fin in finalists}
        engine = JevEngine() if a.engine == "jev" else SimulatedEngine()
        agent = Agent(cfg, engine, schemas, Portfolio(cash=a.equity), brain=make_brain(),
                      calibrator=Calibrator.load("runtime/calibration.json"))
        mkt = SimMarket(tuple(schemas), seed=a.seed)
        try:
            for _ in range(a.bars):
                now, books, trades = mkt.step()
                agent.on_bar(now, books, trades)
        finally:
            agent.close()
        pf = agent.portfolio
        print(json.dumps({"equity": round(pf.equity(), 2), "drawdown": round(pf.drawdown(), 4),
                          "fees": round(pf.fees_paid, 2), "kill_tripped": agent.risk.tripped}, indent=2))
        return

    if a.cmd == "review":
        from .brain import make_brain
        from .review import ReviewConfig, run_review

        rep = run_review(cfg.ledger_path, cfg.schema_dir, ReviewConfig(horizon_bars=a.horizon), make_brain())
        os.makedirs("runtime", exist_ok=True)
        with open("runtime/review.json", "w") as f:
            json.dump(rep, f, indent=2, default=str)
        print(json.dumps({k: rep[k] for k in ("fills", "fees_paid", "max_drawdown", "candidates")}, indent=2, default=str))
        return

    if a.cmd == "replay":
        import time as _time

        from .calibration import Calibrator
        from .jev_client import JevEngine, SimulatedEngine
        from .replay import replay, rung1_check

        sdir = a.schemas or cfg.schema_dir
        schemas = {fin["symbol"]: load_latest(sdir, fin["symbol"]) for fin in finalists}
        os.makedirs(a.out, exist_ok=True)
        stamp = _time.strftime("%Y%m%dT%H%M%SZ", _time.gmtime())
        rcfg = dataclasses.replace(cfg, ledger_path=os.path.join(a.out, f"ledger-{stamp}.jsonl"))
        engine = JevEngine() if a.engine == "jev" else SimulatedEngine()
        res = replay(a.tape, schemas, engine, rcfg, bar_s=a.bar, equity=a.equity, heldout_frac=a.heldout,
                     calibrator=Calibrator.load("runtime/calibration.json"))
        ok, fails = rung1_check(res)
        rep = {**res.to_json(), "rung1_passed": ok, "rung1_failures": fails, "engine": a.engine,
               "schema_dir": sdir}
        path = os.path.join(a.out, f"replay-{stamp}.json")
        with open(path, "w") as f:
            json.dump(rep, f, indent=2, default=str)
        print(json.dumps({k: rep[k] for k in ("days", "net_pnl", "heldout_net_pnl", "funding_paid", "fees",
                                              "heldout_brier_skill", "rung1_passed", "rung1_failures")},
                         indent=2, default=str))
        print(path)
        return

    if a.cmd == "shadow":
        from .brain import make_brain
        from .calibration import Calibrator
        from .jev_client import JevEngine, SimulatedEngine
        from .shadow import ShadowConfig, ShadowTrader

        uk = a.profile.startswith("uk-spot")
        fast = a.profile == "uk-spot-fast"
        if uk:
            from .config import COINBASE_GBP_COSTS, UK_FAST_GATE, UK_SMALL_ACCOUNT
            with open("research/uk_spot.json") as f:
                finalists = json.load(f)["finalists"]
            cfg = dataclasses.replace(cfg, risk=UK_SMALL_ACCOUNT, costs=COINBASE_GBP_COSTS, spot=True,
                                      min_stop_bps=250.0)
            if fast:   # closer exits: 1.5% stop-loss, 1.8% take-profit (see trader/settings.py PROFILES)
                from .settings import profile_config
                cfg = profile_config(cfg, "uk-spot-fast")
        out = a.out or ("runtime/uk-fast" if fast else "runtime/uk-spot" if uk else "runtime/shadow")
        start = a.start_gbp if a.start_gbp is not None else (1000.0 if uk else 10_000.0)
        schemas = {fin["symbol"]: load_latest(cfg.schema_dir, fin["symbol"]) for fin in finalists}
        use_jev = a.engine == "jev" or (a.engine == "auto" and os.environ.get("TYPESAFE_API_KEY"))
        engine = JevEngine() if use_jev else SimulatedEngine()
        try:
            with open(os.path.join(a.tape_dir, ".fx.json")) as f:
                fx = float(json.load(f)["gbp_per_usd"])
        except (OSError, ValueError, KeyError):
            fx = 0.755
        scfg = ShadowConfig(tape_dir=a.tape_dir, out_dir=out, start_gbp=start,
                            tape_prefix="cb" if uk else "okx", currency="GBP" if uk else "USD", profile=a.profile)
        rcfg = dataclasses.replace(cfg, ledger_path=os.path.join(out, "unused.jsonl"))
        ShadowTrader(scfg, rcfg, schemas, engine, fx, engine_name="jev" if use_jev else "practice",
                     brain=make_brain(), calibrator=Calibrator.load("runtime/calibration.json")).run()
        return

    if a.cmd == "promote":
        from .review import promote

        print(promote(a.path, cfg.schema_dir, a.approved_by))


if __name__ == "__main__":
    main()
