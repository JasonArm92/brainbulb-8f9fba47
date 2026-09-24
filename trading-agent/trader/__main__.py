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
    sh.add_argument("--out", default="runtime/shadow")
    sh.add_argument("--start-gbp", type=float, default=10_000.0)
    sh.add_argument("--engine", choices=["auto", "sim", "jev"], default="auto",
                    help="auto = Jev if TYPESAFE_API_KEY is set, otherwise the practice engine")
    pr = sub.add_parser("promote")
    pr.add_argument("path")
    pr.add_argument("--approved-by", required=True)
    a = ap.parse_args()
    cfg = AgentConfig()

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

        schemas = {fin["symbol"]: load_latest(cfg.schema_dir, fin["symbol"]) for fin in finalists}
        use_jev = a.engine == "jev" or (a.engine == "auto" and os.environ.get("TYPESAFE_API_KEY"))
        engine = JevEngine() if use_jev else SimulatedEngine()
        try:
            with open(os.path.join(a.tape_dir, ".fx.json")) as f:
                fx = float(json.load(f)["gbp_per_usd"])
        except (OSError, ValueError, KeyError):
            fx = 0.755
        scfg = ShadowConfig(tape_dir=a.tape_dir, out_dir=a.out, start_gbp=a.start_gbp)
        rcfg = dataclasses.replace(cfg, ledger_path=os.path.join(a.out, "unused.jsonl"))
        ShadowTrader(scfg, rcfg, schemas, engine, fx, engine_name="jev" if use_jev else "practice",
                     brain=make_brain(), calibrator=Calibrator.load("runtime/calibration.json")).run()
        return

    if a.cmd == "promote":
        from .review import promote

        print(promote(a.path, cfg.schema_dir, a.approved_by))


if __name__ == "__main__":
    main()
