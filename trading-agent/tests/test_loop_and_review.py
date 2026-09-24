import json

from tests.helpers import schema
from trader.agent import Agent
from trader.brain import BrainVerdict
from trader.config import AgentConfig, RiskLimits
from trader.jev_client import SimulatedEngine, decide_batch
from trader.jev_schema import save
from trader.portfolio import Portfolio
from trader.review import brier, promote, ReviewConfig, run_review
from trader.sim import SimMarket


def cfg(tmp_path):
    return AgentConfig(risk=RiskLimits(kill_switch_path=str(tmp_path / "KILL")),
                       ledger_path=str(tmp_path / "ledger.jsonl"), schema_dir=str(tmp_path / "schemas"))


def run(tmp_path, bars=400, engine=None, brain=None):
    c = cfg(tmp_path)
    schemas = {"BTC-PERP": schema(), "ETH-PERP": schema(symbol="ETH-PERP", name="ETH")}
    for s in schemas.values():
        save(s, c.schema_dir)
    a = Agent(c, engine or SimulatedEngine(), schemas, Portfolio(cash=1e5), brain=brain)
    m = SimMarket(tuple(schemas), seed=3)
    for _ in range(bars):
        a.on_bar(*m.step())
    a.close()
    return a, c


def test_loop_runs_and_respects_limits(tmp_path):
    a, c = run(tmp_path)
    recs = [json.loads(l) for l in open(c.ledger_path)]
    assert any(r["kind"] == "fill" for r in recs)
    assert a.portfolio.gross_notional() <= c.risk.max_gross_frac * a.portfolio.equity() * 1.05
    assert all(r["kind"] != "reject" for r in recs), "policy should size inside risk limits"


def test_kill_file_halts_loop(tmp_path):
    c = cfg(tmp_path)
    open(c.risk.kill_switch_path, "w").close()
    a = Agent(c, SimulatedEngine(), {"BTC-PERP": schema()}, Portfolio(cash=1e5))
    m = SimMarket(("BTC-PERP",))
    for _ in range(50):
        a.on_bar(*m.step())
    a.close()
    recs = [json.loads(l) for l in open(c.ledger_path)]
    assert not any(r["kind"] == "fill" for r in recs)


class Boom:
    def decide(self, s, sch):
        raise RuntimeError("jev down")


def test_engine_failure_means_hold(tmp_path):
    a, c = run(tmp_path, bars=100, engine=Boom())
    recs = [json.loads(l) for l in open(c.ledger_path)]
    assert not any(r["kind"] == "fill" for r in recs)


class Slow:
    def decide(self, s, sch):
        import time
        time.sleep(1)


def test_timeout_means_hold():
    from tests.helpers import snap
    out = decide_batch(Slow(), [(snap(), schema())], timeout_s=0.05)
    assert out == {"BTC-PERP": None}


class ClearingBrain:
    calls = 0

    def review_escalation(self, payload):
        ClearingBrain.calls += 1
        return BrainVerdict("clear", "ok")

    def propose_rewrite(self, payload):
        return {"instructions": {k: f"rewritten {k}" for k in
                                 ("regime", "direction", "toxic_flow", "setup_quality", "risk_state")},
                "drop_directions": ["short"], "rationale": "test"}


def test_review_brier_calibration_and_candidate(tmp_path):
    a, c = run(tmp_path, bars=500, brain=ClearingBrain())
    rc = ReviewConfig(calibration_path=str(tmp_path / "cal.json"), candidates_dir=str(tmp_path / "cand"))
    rep = run_review(c.ledger_path, c.schema_dir, rc, ClearingBrain())
    sym = rep["symbols"]["BTC-PERP"]
    assert 0 <= sym["direction_brier"] <= 1 and sym["n_directional"] > 0
    cand = rep["candidates"]["BTC-PERP"]
    assert cand["path"].endswith("BTC-PERP.v2.json")
    # candidates are not live until promoted by a named operator
    from trader.jev_schema import load_latest
    assert load_latest(c.schema_dir, "BTC-PERP").version == 1
    promote(cand["path"], c.schema_dir, approved_by="operator")
    live = load_latest(c.schema_dir, "BTC-PERP")
    assert live.version == 2 and live.allowed_directions == ("long", "neutral")


def test_brier():
    assert brier([(1.0, 1), (0.0, 0)]) == 0
    assert brier([(0.5, 1), (0.5, 0)]) == 0.25
