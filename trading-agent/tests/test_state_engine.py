import pytest

from tests.helpers import book
from trader.portfolio import Portfolio
from trader.state_engine import CausalityError, StateEngine, Trade, estimate_tokens


def test_snapshot_never_uses_future_events():
    se = StateEngine()
    pf = Portfolio(cash=1e5)
    se.on_book(book(ts=100, mid=100))
    se.on_book(book(ts=200, mid=150))  # future relative to as_of=150
    s = se.snapshot("BTC-PERP", 150, pf)
    assert s.mid == pytest.approx(100)
    assert s.data_ts <= s.as_of


def test_late_events_rejected_not_merged():
    se = StateEngine()
    assert se.on_book(book(ts=100))
    assert not se.on_book(book(ts=99))
    assert not se.on_trade(Trade(98, "BTC-PERP", 100, 1, "buy"))
    assert se.rejected("BTC-PERP") == 2


def test_trades_after_as_of_excluded_from_flow():
    se = StateEngine()
    pf = Portfolio(cash=1e5)
    se.on_book(book(ts=100))
    se.on_trade(Trade(101, "BTC-PERP", 100, 5, "buy"))
    se.snapshot("BTC-PERP", 100.5, pf)  # first bar
    se.on_trade(Trade(102, "BTC-PERP", 100, 5, "sell"))
    s = se.snapshot("BTC-PERP", 101.5, pf)
    assert s.flow_imb == pytest.approx(1.0)  # the 102 sell is in the future


def test_snapshot_as_of_must_not_go_backwards():
    se = StateEngine()
    pf = Portfolio(cash=1e5)
    se.on_book(book(ts=100))
    se.snapshot("BTC-PERP", 110, pf)
    with pytest.raises(CausalityError):
        se.snapshot("BTC-PERP", 105, pf)


def test_no_book_raises():
    with pytest.raises(CausalityError):
        StateEngine().snapshot("BTC-PERP", 1, Portfolio(cash=1))


def test_crossed_book_rejected():
    from trader.state_engine import BookUpdate
    with pytest.raises(ValueError):
        StateEngine().on_book(BookUpdate(1, "X", ((101, 1),), ((100, 1),)))


def test_numbers_computed_in_code_and_under_token_budget():
    se = StateEngine()
    pf = Portfolio(cash=1e5)
    for i, m in enumerate([100, 101, 100, 102, 101]):
        se.on_book(book(ts=100 + i, mid=m, spread_bps=4))
        s = se.snapshot("BTC-PERP", 100 + i + 0.5, pf)
    assert s.spread_bps == pytest.approx(4, rel=1e-6)
    assert s.rv_bps > 0
    assert -1 <= s.imbalance <= 1
    assert estimate_tokens(s.to_prompt()) < 400


def test_inventory_and_drawdown_from_portfolio():
    se = StateEngine()
    pf = Portfolio(cash=1e5)
    pf.apply_fill("BTC-PERP", "buy", 100, 100.0, 0.0)
    pf.mark("BTC-PERP", 90.0)
    se.on_book(book(ts=100, mid=90))
    s = se.snapshot("BTC-PERP", 100, pf)
    assert s.inventory == pytest.approx(9000 / pf.equity())
    assert s.drawdown == pytest.approx(1000 / 1e5)
    assert s.upnl_bps == pytest.approx(-1000)
