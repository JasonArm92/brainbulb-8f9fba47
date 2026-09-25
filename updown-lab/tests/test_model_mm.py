import pytest

from updown.config import MMConfig, ModelConfig, RiskConfig, assert_paper
from updown.mm import Inventory, RiskState, hedge, make_quote
from updown.model import Inputs, fair_value
from updown.simmarket import Book


def test_paper_only():
    assert_paper("paper")
    with pytest.raises(SystemExit):
        assert_paper("live")


def test_fair_value_shape():
    c = ModelConfig()
    p = lambda d, t: fair_value(Inputs(60000 * (1 + d / 1e4), 60000, t, 0.9, 0, 0), c).p_up
    assert p(0, 300) == pytest.approx(0.5)
    assert p(5, 150) > p(5, 250) > 0.5          # same lead is worth more with less time left
    assert p(-5, 60) < 0.5
    assert fair_value(Inputs(60001, 60000, 0, 0.9, 0, 0), c).p_up == 1.0


def rs(**kw):
    return RiskState(bankroll_usd=1300, peak_usd=1300, **kw)


def test_quotes_both_sides_below_fair():
    q = make_quote(0.6, Inventory(), 200, MMConfig(), RiskConfig(), rs(), 0, True)
    assert q.yes_bid == pytest.approx(0.58) and q.no_bid == pytest.approx(0.38)
    assert q.yes_bid + q.no_bid <= 0.96 + 1e-9


def test_pair_cost_discipline_and_skew():
    inv = Inventory()
    inv.add("NO", 0.62, 40, 0)                   # bought NO expensively earlier
    q = make_quote(0.60, inv, 200, MMConfig(), RiskConfig(), rs(), 0, True)
    assert q.yes_bid <= 0.985 - 0.62 + 1e-9      # YES capped so the pair stays under 0.985
    inv2 = Inventory()
    inv2.add("YES", 0.5, 50, 0)
    q2 = make_quote(0.5, inv2, 200, MMConfig(), RiskConfig(), rs(), 0, True)
    assert q2.yes_bid < 0.48 and q2.no_bid >= 0.48   # heavy YES -> YES bid lower, NO bid higher


def test_guardrails_stop_quotes():
    inv = Inventory()
    assert make_quote(0.5, inv, 200, MMConfig(), RiskConfig(), rs(killed=True), 0, True).yes_bid is None
    assert make_quote(0.5, inv, 200, MMConfig(), RiskConfig(), rs(halted_until=10), 0, True).yes_bid is None
    assert make_quote(0.5, inv, 10, MMConfig(), RiskConfig(), rs(), 0, True).yes_bid is None
    assert make_quote(0.5, inv, 200, MMConfig(), RiskConfig(), rs(), 0, False).yes_bid is None
    big = Inventory()
    big.add("YES", 0.5, 130, 0)                  # $65 unpaired > $60 cap
    q = make_quote(0.5, big, 200, MMConfig(), RiskConfig(), rs(), 0, True)
    assert q.yes_bid is None and q.no_bid is not None


def test_hedge_crosses_or_holds():
    inv = Inventory()
    inv.add("YES", 0.45, 80, 0)
    h = hedge(0.5, inv, 200, Book(0.49, 0.51), MMConfig(), rs(), 0)
    assert h.side == "NO" and h.qty == 80 and h.price == pytest.approx(0.51) and h.bleed > 0
    pricey = hedge(0.5, inv, 200, Book(0.40, 0.42), MMConfig(), rs(), 0)   # NO ask 0.60 -> pair 1.05
    assert isinstance(pricey, str) and "skipped" in pricey
    small = Inventory()
    small.add("YES", 0.45, 20, 0)
    assert hedge(0.5, small, 200, Book(0.49, 0.51), MMConfig(), rs(), 0) is None      # not tilted enough
    assert hedge(0.5, small, 30, Book(0.49, 0.51), MMConfig(), rs(), 0).qty == 20     # but late: flatten


def test_circuit_breaker():
    r = rs()
    r.recent = [(100, 14.0), (200, 12.0)]
    why = r.breaker(300, RiskConfig())
    assert why and "bleed" in why and r.halted(301) and not r.halted(300 + 1801)
    r2 = RiskState(bankroll_usd=900, peak_usd=1000)
    assert "drawdown" in r2.breaker(0, RiskConfig())
