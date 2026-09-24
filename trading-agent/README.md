# trading-agent

A 24/7 autonomous crypto trading agent with a strict split between layers. The **Brain**
(Claude Opus 5.5) does the research, compiles decision schemas, reviews escalations and runs the
nightly review. The **Reflex** (TypeSafe Jev) returns one typed, calibrated decision per candle.
**Code** owns every threshold, size and side effect. The operator approves the gates.

The agent is **paper-only as shipped.** No live venue adapter is included. Going live is the ship
ladder in `docs/agenkit/06-ship.md`, not a flag.

```
research/REPORT.md        market regime + 7 finalists, re-verified against primary sources 2026-09-24
research/metrics/         dated raw primary figures, each with its source URL and source timestamp
research/finalists.json   machine-readable finalists -> compiled into schemas/
schemas/*.v1.json         compiled Jev schema per finalist (immutable, versioned)
trader/state_engine.py    causal order-book -> <400-token numeric snapshot
trader/jev_schema.py      schema shape, compile, revision rules
trader/jev_client.py      Jev adapter + parallel dispatch + simulated stand-in
trader/policy.py          gates (setup>=2, conf>0.80, safe, non-toxic) + capped fractional Kelly
trader/risk.py            hard limits + beta-weighted gross cap + kill switch (no model inputs)
trader/funding.py         perp funding: pessimistic sizing cost, exact P&L settlement
trader/correlation.py     EWMA beta-to-BTC for the correlation-aware cap (floored at 1.0)
trader/replay.py          rung 1: recorded real tape through the same loop; rung1_check
trader/okx_tape.py        OKX public-data recorder (no keys, no orders); scripts/record_okx.py
trader/execution.py       risk-guarded broker, paper broker with fees/slippage
trader/brain.py           Opus 5.5 escalation + nightly rewrite, fail-closed
trader/agent.py           the live loop
trader/review.py          overnight review: Brier, reliability, misses, calibration, candidates, promote
docs/agenkit/             six-phase build plan with gate checklists
scripts/nightly.sh        overnight job
```

```bash
python3 -m pip install -r requirements-dev.txt && python3 -m pytest -q
python3 -m trader paper --bars 3000 && python3 -m trader review
python3 scripts/record_okx.py --out tapes/okx.jsonl        # record real OKX books/trades/funding
python3 -m trader replay tapes/okx-*                         # rung 1 on real data (daily files, .gz ok)
# with keys:  TYPESAFE_API_KEY=... ANTHROPIC_API_KEY=... python3 -m trader paper --engine jev
```

Changing a hard limit means editing `trader/config.py`, which goes through review. Creating a
file at `runtime/KILL` halts every order, including reduce-only ones.

## Final check

- **Is the edge organic or incentive driven?** HYPE and AAVE revenue comes from real users paying
  fees. ENA's buyback exists only on paper until USDe reaches $7.5B. SOL staking yield is
  inflation, not revenue. BTC/ETH trades are flow and positioning trades, not fundamentals trades.
- **Is the catalyst already priced in?** Probably, for HYPE (at its ATH) and for every scheduled
  unlock (public dates). Alpenglow is speculation. The ETF-flow reversal is the least priced-in
  signal, and it is also the least persistent.
- **Does value accrue to the token?** HYPE and AAVE: yes, through buybacks. ENA: not yet. SOL, SUI,
  BTC, ETH: only indirectly.
- **Will it survive costs and slippage?** Unknown. Sizing is now net of fees, spread, slippage and
  expected funding, and the replay harness exists, but no 30-day real tape has been recorded yet.
  Until `rung1_check` passes on real data, assume it does not.
- **Is any hard limit delegated to the model?** No. `risk.py` imports nothing model-related (a test
  checks this). The Brain's schema has no size or limit fields. Nightly revisions can only narrow.

## WHAT COULD I BE WRONG ABOUT?

1. **The data.** Re-verified on 2026-09-24 against primary sources
   (`research/metrics/2026-09-24.json`). It resolved BTC at ~$84k (not $87k) and dominance at
   ~56% (coinpaprika, universe-dependent). HYPE revenue is ~$0.7B/yr with fees ~$0.9B (the "$1.3B"
   was all-time). AAVE revenue is ~$97M/yr, not $402M. ENA dates corrected. Still unverified:
   unlock **amounts** (Tokenomist Pro), all-venue OI, SOL ETF streak and AUM. OKX-only OI and
   funding are not market-wide.
2. **Jev's API.** The surface now matches docs.typesafe.ai and `typesafe-sdk` 0.7.1 (Score is
   0-based; Noul answers are `.noul`). But it has never made a live call, so latency, rate limits
   ("adjusting dynamically" per the docs) and calibration on this state are untested. If Jev is
   slower or less calibrated than advertised, the reflex adds noise, not edge.
3. **That there is any edge at all.** Nothing here shows positive expectancy. The synthetic results
   show only that the plumbing and the risk layer work. The review correctly scored the stand-in
   engine as *worse than a constant forecast*. A real model can do the same.
4. **Calibration transfer.** "Calibrated" on TypeSafe's objective is not calibrated on after-cost
   crypto returns. Kelly on a miscalibrated p is how accounts blow up. The pessimistic calibrator
   and the ¼-Kelly cap reduce that risk; they do not remove it.
5. **Correlation.** Seven crypto perps behave like one asset in a crash. A beta-weighted gross cap
   now counts alt exposure at its beta to BTC. But beta is estimated from recent bars, and in a
   crash correlations go to 1 faster than an EWMA adapts. A correlated gap can still take out the
   daily limit in a single bar. The 15% drawdown stop is checked on marks, and a gap can jump
   straight through it.
6. **Macro regime.** A Fed that is hiking with more hikes signalled has historically been hostile to
   crypto beta. The current rally is squeeze-led. The regime call can be wrong in either direction
   within days.
7. **Event shorts.** Shorting unlocks (ENA, SUI) is a crowded, well-known trade. Funding is now
   costed (a short that would pay negative funding is sized down or blocked), but a squeeze can
   move price far faster than funding accrues. The SUI unlock goes to the Community Reserve, which
   weakens that thesis.
8. **Self-improvement overfitting.** A nightly rewrite scored on the same day's tape is
   curve-fitting. That is why candidates need held-out replay and a named approver, never auto-ship.
9. **Operational risk the code can't see.** Venue outages, API-key compromise, liquidation engines,
   custody. Keep venue-side limits (sub-account caps, withdrawal lock, IP allow-list) as a second,
   independent kill switch.
10. **Replay realism.** The recorder polls OKX REST every 2 s, so it samples the book and can drop
   trades in busy seconds (it logs every gap). The paper broker fills against that sampled book
   with no queue position or latency. Replay P&L is therefore an optimistic upper bound, and the
   shadow rung is what tests real fills.

Nothing here is financial advice. The system is designed to survive first. Keep it on paper until
the replay and shadow rungs pass on real data.
