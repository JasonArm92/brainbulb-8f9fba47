import os

import pytest

from tests.helpers import book, snap
from trader.config import CostModel, RiskLimits
from trader.execution import PaperBroker, RiskGuardedBroker
from trader.portfolio import Portfolio
from trader.risk import Order, RiskManager


@pytest.fixture
def rm(tmp_path):
    return RiskManager(RiskLimits(kill_switch_path=str(tmp_path / "KILL")))


def buy(q=10, px=100.0, **kw):
    return Order("BTC-PERP", "buy", q, px, **kw)


def test_ok_order_passes(rm):
    assert rm.check(buy(), Portfolio(cash=1e5), snap(), now=100).ok


def test_kill_file_blocks_everything_including_reduce(rm):
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 10, 100, 0)
    open(rm.limits.kill_switch_path, "w").close()
    assert not rm.check(buy(), pf, snap(), 100).ok
    assert not rm.check(Order("BTC-PERP", "sell", 10, 100, reduce_only=True), pf, snap(), 100).ok


def test_drawdown_trips_latched_kill_switch_allows_only_reduce(rm):
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 900, 100, 0)
    pf.mark("BTC-PERP", 80)  # -18k on 100k = 18% drawdown
    rm.update(pf)
    assert rm.tripped
    assert not rm.check(buy(1, 80), pf, snap(mid=80), 100).ok
    assert rm.check(Order("BTC-PERP", "sell", 900, 80, reduce_only=True), pf, snap(mid=80), 100).ok
    pf.mark("BTC-PERP", 100)  # recovery does not un-latch
    rm.update(pf)
    assert rm.tripped


def test_reset_requires_operator_ack(rm):
    rm.trip("x")
    with pytest.raises(PermissionError):
        rm.reset("yes")
    rm.reset("I have reviewed the drawdown and accept restart")
    assert not rm.tripped


def test_daily_loss_blocks_new_risk(rm):
    pf = Portfolio(cash=1e5)
    pf.roll_day("d1")
    pf.cash -= 4000  # -4% on the day
    assert not rm.check(buy(), pf, snap(), 100).ok
    pf.roll_day("d2")
    assert rm.check(buy(), pf, snap(), 100).ok


@pytest.mark.parametrize("order,reason", [
    (buy(q=60), "max_order_frac"),                  # 6000 > 5% of 100k
    (buy(px=101), "from mid"),                      # 100 bps band breach
    (buy(q=-1), "qty"),
    (buy(q=float("nan")), "qty"),
    (Order("BTC-PERP", "buy", 1, 100, reduce_only=True), "reduce_only"),
])
def test_rejections(rm, order, reason):
    v = rm.check(order, Portfolio(cash=1e5), snap(), 100)
    assert not v.ok and any(reason in r for r in v.reasons)


def test_position_limit(rm):
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 80, 100, 0)
    v = rm.check(buy(q=30), pf, snap(), 100)
    assert not v.ok and any("max_position_frac" in r for r in v.reasons)


def test_short_cover_counts_as_reduce(rm):
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "sell", 10, 100, 0)
    rm.trip("x")
    assert rm.check(Order("BTC-PERP", "buy", 10, 100.2, reduce_only=True), pf, snap(), 100).ok


def test_stale_data_rejected(rm):
    v = rm.check(buy(), Portfolio(cash=1e5), snap(data_ts=90), now=100)
    assert not v.ok and any("stale" in r for r in v.reasons)


def test_rate_limit(rm):
    pf = Portfolio(cash=1e5)
    for _ in range(rm.limits.max_orders_per_minute):
        assert rm.check(buy(q=0.1), pf, snap(), 100).ok
    assert not rm.check(buy(q=0.1), pf, snap(), 100).ok


def test_guarded_broker_never_fills_rejected_order(rm):
    pf = Portfolio(cash=1e5)
    gb = RiskGuardedBroker(PaperBroker(CostModel()), rm, pf)
    res = gb.submit(buy(q=60), snap(), book(), 100)
    assert res.fill is None and not res.verdict.ok
    assert pf.positions == {}


def test_paper_broker_charges_fees_and_slippage(rm):
    pf = Portfolio(cash=1e5)
    gb = RiskGuardedBroker(PaperBroker(CostModel()), rm, pf)
    res = gb.submit(buy(q=10, px=100.2), snap(), book(), 100)
    assert res.fill and res.fill.fee > 0 and res.fill.price > 100
    assert pf.equity() < 1e5


def test_risk_module_has_no_model_inputs():
    import ast
    import inspect
    from trader import risk
    tree = ast.parse(inspect.getsource(risk))
    imported = {n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)}
    assert not imported & {"decision", "jev_client", "jev_schema", "policy", "brain"}
