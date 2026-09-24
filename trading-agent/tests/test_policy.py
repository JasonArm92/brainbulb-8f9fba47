import pytest

from tests.helpers import decision, schema, snap
from trader.calibration import Calibrator
from trader.config import GateConfig, RiskLimits
from trader.policy import Policy, kelly_fraction
from trader.portfolio import Portfolio


def policy(**gate):
    # calibrator fully trusting confidence, so sizing tests are deterministic
    return Policy(GateConfig(**gate), RiskLimits(), Calibrator(prior_shrink=1.0, prior_strength=1e9))


def ev(p, d, s=None, pf=None, sch=None, **kw):
    return p.evaluate(d, s or snap(), pf or Portfolio(cash=1e5), sch or schema(), **kw)


def test_gate_passes_only_when_all_conditions_hold():
    assert ev(policy(), decision()).kind == "enter"


@pytest.mark.parametrize("override", [
    {"setup_quality": 1.99},
    {"direction_conf": 0.80},          # must be strictly greater
    {"risk_state": "near_limit"},
    {"toxic_flow_p": 0.6},
    {"direction": "neutral"},
])
def test_gate_blocks(override):
    assert ev(policy(), decision(**override)).kind == "hold"


def test_disallowed_direction_blocked_by_schema():
    sch = schema(allowed_directions=["short", "neutral"])
    assert ev(policy(), decision(direction="long"), sch=sch).kind == "hold"


def test_none_decision_holds():
    assert ev(policy(), None).kind == "hold"


def test_crisis_escalates_and_derisks():
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 10, 100, 0)
    it = ev(policy(), decision(regime="crisis"), pf=pf)
    assert it.escalate and it.kind == "reduce" and it.side == "sell"
    assert it.notional == pytest.approx(500)


def test_low_confidence_escalates_when_exposed_holds_when_flat():
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 10, 100, 0)
    assert ev(policy(), decision(direction_conf=0.55), pf=pf).kind == "escalate"
    flat = ev(policy(), decision(direction_conf=0.55))
    assert flat.kind == "hold" and not flat.escalate


def test_frozen_symbol_cannot_enter():
    assert ev(policy(), decision(), frozen=True).kind == "hold"


def test_stop_and_take_profit_are_code_owned_even_without_decision():
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 10, 100, 0)
    p = policy()
    assert ev(p, None, s=snap(upnl=-500), pf=pf).kind == "exit"
    assert ev(p, None, s=snap(upnl=+500), pf=pf).kind == "exit"


def test_opposite_signal_exits_before_flipping():
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 10, 100, 0)
    it = ev(policy(), decision(direction="short"), pf=pf)
    assert it.kind == "exit" and it.side == "sell"


def test_kelly_formula():
    assert kelly_fraction(0.6, 1.0) == pytest.approx(0.2)
    assert kelly_fraction(0.5, 1.0) == pytest.approx(0.0)


def test_kelly_capped_at_quarter_even_if_config_asks_more():
    big = policy(kelly_fraction=1.0, kelly_cap=0.25)
    quarter = policy(kelly_fraction=0.25, kelly_cap=0.25)
    # loosen notional limits so the Kelly term binds
    for p in (big, quarter):
        p.limits = RiskLimits(max_order_frac=10, max_position_frac=10, max_gross_frac=10)
    a = ev(big, decision(direction_conf=0.95))
    b = ev(quarter, decision(direction_conf=0.95))
    assert a.notional == pytest.approx(b.notional)


def test_no_edge_after_costs_holds():
    it = ev(policy(), decision(direction_conf=0.81), cost_bps=200)
    assert it.kind == "hold" and "no edge" in it.reason


def test_size_never_exceeds_position_or_order_limit():
    it = ev(policy(), decision(direction_conf=0.99))
    assert it.notional <= RiskLimits().max_order_frac * 1e5 + 1e-6
