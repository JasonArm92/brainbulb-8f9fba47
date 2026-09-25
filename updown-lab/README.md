# Up/Down Lab

A paper-only lab for **hedged market-making on BTC 5-minute Up/Down markets**, the kind
Polymarket runs. It is a separate project from `trading-agent/` (the Coinbase spot bot): no
shared trading code, only the same design conventions and phone-over-Tailscale set-up.

## Why a lab and not a bot

UK residents can't trade these markets. Polymarket's help centre (updated 14 Aug 2026) lists the
UK as fully restricted and bans VPN workarounds. Kalshi's member agreement restricts the UK. The
FCA's 2019 ban on selling binary options to retail is still in force (it is reviewing prediction
markets, but no rule has changed). So this project never reads Polymarket and **contains no code
that can place a real order anywhere**. `config.MODE` is hard-wired to `"paper"` and the engine
refuses to start otherwise.

## What's real and what's simulated

| Real | Simulated |
|---|---|
| BTC/USD reference: median of Coinbase, Kraken and Bitstamp mids, every second (stands in for the Chainlink Data Streams price Polymarket settles on, which isn't public) | The market: a crowd pricing off a 3 s stale spot with its own noise, quoting a 2-cent book |
| 5-minute UTC windows and their UP/DOWN outcomes | Takers who sell into our bids: 75% random, 25% "informed" (they see the price 2 s ahead and only sell when we overpay) |
| The fair-value model and its backtest | Fees on crossing (1% by default; set it to a venue's schedule) |
| USD→GBP rate (Coinbase) | Profit and loss. It shows how well the hedging manages risk, not what a real market would pay |

## The model

`P(UP) = Φ( ln(S/S0) / (σ·√t) )`: price vs the window's opening reference, scaled by the expected
move over the time left (σ = EWMA realised volatility per √second). Momentum and acceleration are
computed and logged but weighted 0.

**Validated before anything else** (`python -m updown.backtest --days 30`): on 8,632 real
5-minute windows from Coinbase BTC-USD (Aug–Sep 2026), Brier score 0.1625 vs 0.25 for a coin flip
(35% skill), with reliability close to the diagonal (said 25% → happened 22%, said 75% → 77%).
Adding momentum made forecasts worse, so it stays off. The live engine logs checkpoints at 1, 2, 3
and 4 minutes into each window, so live calibration builds up over time. The backtest re-runs
every morning.

## The strategy

Bid for both YES and NO below fair value. One YES plus one NO always pays £1 (the simulated market is priced in pounds), so a pair bought for
less than £1 is locked-in profit ("paired cost"). Fills arrive unevenly, so the hedge manager:
1. skews quotes towards the missing side;
2. crosses the spread to buy the missing side when the tilt passes 60 shares, or in the last 45 s,
   if the pair would still cost ≤ £1.02 (the extra is "hedge bleed");
3. otherwise holds the unpaired residual through resolution.

Guardrails (`mm.py`, checked before every quote and hedge):
- never quote a side if the pair would cost more than 98.5p;
- £90 of quote spend per window (risk-reducing hedges are exempt);
- £45 of unpaired exposure per window, £70 in aggregate;
- circuit breaker at £20 of hedge bleed or a 5% drawdown in a rolling hour (30-minute pause, hedging still allowed);
- kill switch from the phone or a `runtime/KILL` file (stops everything).

## Run it

```bash
bash scripts/install_mac.sh        # venv, backtest, launchd services, key in runtime/token
# phone (Tailscale): http://<mac-name>:8788/?k=<runtime/token>
.venv/bin/python -m pytest -q
```

State is in `runtime/lab.sqlite` (windows, fills, checkpoints, events). A restart rebuilds the open
window from its fills; a window that closed while the engine was off is voided at cost.
