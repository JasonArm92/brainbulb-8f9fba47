"""CLI.

  python -m trader compile                 # research/finalists.json -> schemas/*.v1.json
  python -m trader paper --bars 2000       # paper loop on the synthetic feed (SimulatedEngine)
  python -m trader paper --engine jev      # paper loop, real Jev decisions (needs TYPESAFE_API_KEY)
  python -m trader review                  # overnight review -> runtime/review.json
  python -m trader promote PATH --approved-by NAME
"""

from __future__ import annotations

import argparse
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

    if a.cmd == "promote":
        from .review import promote

        print(promote(a.path, cfg.schema_dir, a.approved_by))


if __name__ == "__main__":
    main()
