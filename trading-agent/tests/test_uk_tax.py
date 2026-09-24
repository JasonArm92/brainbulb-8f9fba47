"""HMRC matching rules: same-day, 30-day, section 104 pool, fees, tax years."""

from datetime import date, datetime, timezone

import pytest

from trader.uk_tax import Fill, compute, tax_year, uk_day


def ts(y, m, d, h=12):
    return datetime(y, m, d, h, tzinfo=timezone.utc).timestamp()


def test_section_104_average_cost():
    r = compute([Fill(ts(2026, 5, 1), "BTC", "buy", 100, 1.0, 0), Fill(ts(2026, 5, 10), "BTC", "buy", 100, 2.0, 0),
                 Fill(ts(2026, 7, 1), "BTC", "sell", 50, 3.0, 0)])
    (d,) = r.disposals
    assert (d.rule, d.cost, d.proceeds, d.gain) == ("s104", pytest.approx(75.0), 150.0, pytest.approx(75.0))
    assert r.pools["BTC"] == (pytest.approx(150), pytest.approx(225.0))


def test_same_day_beats_the_pool():
    r = compute([Fill(ts(2026, 5, 1), "ETH", "buy", 100, 1.0, 0),
                 Fill(ts(2026, 7, 1, 9), "ETH", "buy", 10, 2.0, 0), Fill(ts(2026, 7, 1, 15), "ETH", "sell", 10, 3.0, 0)])
    (d,) = r.disposals
    assert d.rule == "same-day" and d.cost == pytest.approx(20.0) and d.gain == pytest.approx(10.0)
    assert r.pools["ETH"][0] == pytest.approx(100)


def test_bed_and_breakfast_30_day_rule():
    r = compute([Fill(ts(2026, 5, 1), "SOL", "buy", 100, 1.0, 0), Fill(ts(2026, 7, 1), "SOL", "sell", 10, 3.0, 0),
                 Fill(ts(2026, 7, 6), "SOL", "buy", 10, 2.5, 0)])
    (d,) = r.disposals
    assert d.rule == "30-day" and d.cost == pytest.approx(25.0)          # not the pool's GBP 10
    assert r.pools["SOL"] == (pytest.approx(100), pytest.approx(100.0))    # sale matched to the rebuy; pool untouched


def test_after_30_days_the_pool_applies():
    r = compute([Fill(ts(2026, 5, 1), "SOL", "buy", 100, 1.0, 0), Fill(ts(2026, 7, 1), "SOL", "sell", 10, 3.0, 0),
                 Fill(ts(2026, 8, 5), "SOL", "buy", 10, 2.5, 0)])
    assert r.disposals[0].rule == "s104" and r.disposals[0].cost == pytest.approx(10.0)


def test_mixed_rules_on_one_disposal():
    r = compute([Fill(ts(2026, 5, 1), "BTC", "buy", 10, 1.0, 0), Fill(ts(2026, 7, 1, 8), "BTC", "buy", 2, 2.0, 0),
                 Fill(ts(2026, 7, 1, 16), "BTC", "sell", 5, 3.0, 0), Fill(ts(2026, 7, 10), "BTC", "buy", 1, 4.0, 0)])
    (d,) = r.disposals
    assert d.rule == "same-day+30-day+s104"
    assert d.cost == pytest.approx(2 * 2.0 + 1 * 4.0 + 2 * 1.0)


def test_fees_are_allowable():
    r = compute([Fill(ts(2026, 5, 1), "BTC", "buy", 1, 100.0, 0.6), Fill(ts(2026, 6, 1), "BTC", "sell", 1, 110.0, 0.66)])
    assert r.disposals[0].gain == pytest.approx(110 - 0.66 - 100.6)


def test_uk_day_and_tax_year_boundaries():
    assert uk_day(datetime(2026, 7, 1, 23, 30, tzinfo=timezone.utc).timestamp()) == date(2026, 7, 2)   # BST
    assert uk_day(datetime(2026, 12, 1, 23, 30, tzinfo=timezone.utc).timestamp()) == date(2026, 12, 1)  # GMT
    assert tax_year(date(2027, 4, 5)) == "2026/27" and tax_year(date(2027, 4, 6)) == "2027/28"


def test_year_totals_and_exempt_amount():
    r = compute([Fill(ts(2026, 5, 1), "BTC", "buy", 1, 100.0, 0), Fill(ts(2026, 6, 1), "BTC", "sell", 0.5, 150.0, 0),
                 Fill(ts(2026, 7, 1), "BTC", "sell", 0.5, 40.0, 0)])
    y = r.by_year()["2026/27"]
    assert (y["disposals"], y["gains"], y["losses"], y["net"]) == (2, pytest.approx(25), pytest.approx(30), pytest.approx(-5))
    assert y["annual_exempt_amount"] == 3000.0 and y["taxable_after_aea"] == 0.0
    assert r.csv().splitlines()[0].startswith("date,tax_year,asset")


def test_overselling_is_flagged_not_hidden():
    r = compute([Fill(ts(2026, 5, 1), "BTC", "sell", 1, 100.0, 0)])
    assert r.warnings and "pool held" in r.warnings[0]
