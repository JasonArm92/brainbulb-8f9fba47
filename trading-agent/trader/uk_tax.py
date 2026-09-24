"""UK Capital Gains Tax record for crypto trades (HMRC share-pooling rules).

HMRC treats each token type as a pooled asset (Cryptoassets Manual CRYPTO22200)
and matches every disposal in this order:
  1. same-day rule  - against acquisitions of the same token on the same day
                      (TCGA 1992 s105);
  2. 30-day rule    - against acquisitions in the 30 days AFTER the disposal,
                      earliest first (s106A, "bed and breakfasting");
  3. section 104    - against the pool's average cost (s104).

Allowable costs include trading fees: a buy's fee is added to its cost, a sell's
fee is deducted from its proceeds. Days are UK calendar days (Europe/London).
The tax year runs 6 April to 5 April.

This is a record-keeping aid, not tax advice. Practice-account trades are not
taxable; the same code will keep the real account's record.
"""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

UK = ZoneInfo("Europe/London")
ANNUAL_EXEMPT_AMOUNT = {"2024/25": 3000.0, "2025/26": 3000.0, "2026/27": 3000.0}


def uk_day(ts: float) -> date:
    return datetime.fromtimestamp(ts, UK).date()


def tax_year(d: date) -> str:
    start = d.year if (d.month, d.day) >= (4, 6) else d.year - 1
    return f"{start}/{str(start + 1)[-2:]}"


@dataclass
class Fill:
    ts: float
    asset: str          # e.g. "BTC"
    side: str           # "buy" | "sell"
    qty: float
    price: float        # GBP per token
    fee: float          # GBP


@dataclass
class Disposal:
    day: date
    asset: str
    qty: float
    proceeds: float
    cost: float
    rule: str           # "same-day" | "30-day" | "s104" | mixture joined by "+"

    @property
    def gain(self) -> float:
        return self.proceeds - self.cost


@dataclass
class TaxReport:
    disposals: list[Disposal] = field(default_factory=list)
    pools: dict[str, tuple[float, float]] = field(default_factory=dict)   # asset -> (qty, cost)
    warnings: list[str] = field(default_factory=list)

    def by_year(self) -> dict[str, dict]:
        out: dict[str, dict] = {}
        for d in self.disposals:
            y = out.setdefault(tax_year(d.day), {"disposals": 0, "proceeds": 0.0, "costs": 0.0,
                                                 "gains": 0.0, "losses": 0.0})
            y["disposals"] += 1
            y["proceeds"] += d.proceeds
            y["costs"] += d.cost
            if d.gain >= 0:
                y["gains"] += d.gain
            else:
                y["losses"] += -d.gain
        for k, y in out.items():
            y["net"] = y["gains"] - y["losses"]
            aea = ANNUAL_EXEMPT_AMOUNT.get(k, 3000.0)
            y["annual_exempt_amount"] = aea
            y["taxable_after_aea"] = max(0.0, y["net"] - aea)
        return out

    def csv(self) -> str:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["date", "tax_year", "asset", "quantity", "proceeds_gbp", "allowable_cost_gbp", "gain_gbp", "rule"])
        for d in sorted(self.disposals, key=lambda d: (d.day, d.asset)):
            w.writerow([d.day.isoformat(), tax_year(d.day), d.asset, f"{d.qty:.8f}", f"{d.proceeds:.2f}",
                        f"{d.cost:.2f}", f"{d.gain:.2f}", d.rule])
        return buf.getvalue()


def compute(fills: list[Fill]) -> TaxReport:
    rep = TaxReport()
    per_asset: dict[str, list[Fill]] = defaultdict(list)
    for f in fills:
        per_asset[f.asset].append(f)
    for asset, fs in per_asset.items():
        # aggregate per UK day: buys (qty, cost incl. fee), sells (qty, proceeds net of fee)
        buys: dict[date, list[float]] = defaultdict(lambda: [0.0, 0.0])
        sells: dict[date, list[float]] = defaultdict(lambda: [0.0, 0.0])
        for f in fs:
            d = uk_day(f.ts)
            if f.side == "buy":
                buys[d][0] += f.qty
                buys[d][1] += f.qty * f.price + f.fee
            else:
                sells[d][0] += f.qty
                sells[d][1] += f.qty * f.price - f.fee
        matched: dict[date, list] = defaultdict(list)     # disposal day -> [(qty, proceeds, cost, rule)]

        def take(src: list[float], q: float) -> float:
            """Remove q units from a [qty, value] bucket, returning the value removed."""
            v = src[1] * (q / src[0]) if src[0] > 0 else 0.0
            src[0] -= q
            src[1] -= v
            return v

        # 1. same day
        for d in sorted(sells):
            if d in buys and buys[d][0] > 1e-12 and sells[d][0] > 1e-12:
                q = min(buys[d][0], sells[d][0])
                cost = take(buys[d], q)
                matched[d].append((q, take(sells[d], q), cost, "same-day"))
        # 2. next 30 days, earliest acquisition first
        for d in sorted(sells):
            for k in range(1, 31):
                if sells[d][0] <= 1e-12:
                    break
                b = buys.get(d + timedelta(days=k))
                if b and b[0] > 1e-12:
                    q = min(b[0], sells[d][0])
                    cost = take(b, q)
                    matched[d].append((q, take(sells[d], q), cost, "30-day"))
        # 3. section 104 pool, in date order
        pool = [0.0, 0.0]
        for d in sorted(set(buys) | set(sells)):
            if d in buys and buys[d][0] > 1e-12:
                pool[0] += buys[d][0]
                pool[1] += buys[d][1]
            if d in sells and sells[d][0] > 1e-12:
                q = sells[d][0]
                if q > pool[0] + 1e-9:
                    rep.warnings.append(f"{asset} {d}: sold {q:.8f} but the pool held {pool[0]:.8f}")
                    q = pool[0]
                if q > 1e-12:
                    cost = take(pool, q)
                    matched[d].append((q, take(sells[d], q), cost, "s104"))
        for d, parts in matched.items():
            rep.disposals.append(Disposal(d, asset, sum(p[0] for p in parts), sum(p[1] for p in parts),
                                          sum(p[2] for p in parts), "+".join(dict.fromkeys(p[3] for p in parts))))
        rep.pools[asset] = (pool[0], pool[1])
    rep.disposals.sort(key=lambda x: (x.day, x.asset))
    return rep


def from_trades(trades: list[dict]) -> list[Fill]:
    """Shadow/live trade records -> Fills. Symbols like 'BTC-GBP' become 'BTC'."""
    return [Fill(t["ts"], t["sym"].split("-")[0], t["side"], float(t["qty"]), float(t["px"]), float(t.get("fee", 0.0)))
            for t in trades]
