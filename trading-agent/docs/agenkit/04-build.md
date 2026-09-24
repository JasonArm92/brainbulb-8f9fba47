# Phase 4: Test-first build

```bash
cd trading-agent
python3 -m pip install -r requirements-dev.txt
python3 -m pytest -q                 # 104 tests
python3 -m trader compile            # research/finalists.json -> schemas/*.v1.json (idempotent: errors if present)
python3 -m trader paper --bars 3000  # synthetic feed + SimulatedEngine
python3 -m trader review             # runtime/review.json
python3 scripts/record_okx.py --out tapes/okx.jsonl --duration 600   # record real OKX data (public, no keys)
python3 -m trader replay tapes/okx-*                                   # rung 1: same loop on the daily tapes
```

Results on the synthetic feed (seed 7, 3,000 bars, 7 symbols): 1,095 fills, 0 risk rejects,
max drawdown 0.7%, p99 loop time about 9 ms (re-run 2026-09-24 with funding and the beta cap wired in: same fills, still 0 rejects), not counting Jev network latency.
**These numbers say nothing about edge.** The feed and the engine are both synthetic. The useful
signal is that the review scored the stand-in engine's direction calls with **negative Brier
skill** (worse than a constant forecast). Because the calibrator is pessimistic, Kelly then sizes
those calls down or to zero. That is the intended behaviour.

Two bugs were caught here by the paper run and are now covered by tests:
1. Reduce-only buys that closed a short were rejected. Exposure was measured as notional at the
   limit price vs the mark, which flips sign. Fixed by measuring in quantity space
   (`test_short_cover_counts_as_reduce`).
2. The sizer used mid while the risk check used the limit price, so orders came out a few bp over
   the cap. Fixed by sizing at the worst-case fill price.
