from trader.decision import Decision
from trader.jev_schema import compile_schema
from trader.state_engine import BookUpdate, Snapshot

FINALIST = {
    "symbol": "BTC-PERP", "name": "BTC", "thesis_short": "t", "invalidation_short": "i",
    "allowed_directions": ["long", "short", "neutral"],
}


def schema(**kw):
    return compile_schema({**FINALIST, **kw})


def book(ts=100.0, mid=100.0, spread_bps=2.0, depth=50.0, sym="BTC-PERP"):
    half = mid * spread_bps / 2e4
    tick = mid * 1e-4
    return BookUpdate(ts, sym,
                      tuple((mid - half - i * tick, depth) for i in range(5)),
                      tuple((mid + half + i * tick, depth) for i in range(5)))


def snap(sym="BTC-PERP", mid=100.0, as_of=100.0, data_ts=100.0, rv=10.0, upnl=0.0, **kw):
    base = dict(symbol=sym, as_of=as_of, data_ts=data_ts, mid=mid, spread_bps=2.0, imbalance=0.0,
                depth_usd=5e4, ret_1_bps=0.0, ret_n_bps=0.0, rv_bps=rv, flow_imb=0.0, inventory=0.0,
                upnl_bps=upnl, drawdown=0.0, day_pnl=0.0)
    base.update(kw)
    return Snapshot(**base)


def decision(**kw):
    base = dict(symbol="BTC-PERP", schema_version=1, regime="trending", regime_conf=0.9,
                direction="long", direction_conf=0.9, toxic_flow_p=0.1, setup_quality=2.5,
                setup_conf=0.8, risk_state="safe", risk_conf=0.9)
    base.update(kw)
    return Decision(**base)
