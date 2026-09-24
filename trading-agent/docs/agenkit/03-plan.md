# Phase 3: Plan (file by file)

All paths are relative to `trading-agent/`.

| Order | File | Responsibility | Tests |
|---|---|---|---|
| 1 | `trader/config.py` | Frozen `RiskLimits`, `GateConfig`, `CostModel`, `AgentConfig` | used everywhere |
| 2 | `trader/portfolio.py` | Cash, positions, marks, equity, peak, drawdown, day P&L | `test_state_engine::test_inventory_and_drawdown_from_portfolio` |
| 3 | `trader/state_engine.py` | Causal ingestion, snapshot, token budget | `tests/test_state_engine.py` |
| 4 | `trader/jev_schema.py` | Fixed shape, compile, validate, immutable versions, revision rules | `tests/test_schema_and_decision.py` |
| 5 | `trader/decision.py` | Typed, validated `Decision` | same |
| 6 | `trader/jev_client.py` | `DecisionEngine`, `JevEngine` (SDK isolated), `SimulatedEngine`, `decide_batch` | `tests/test_loop_and_review.py` |
| 7 | `trader/calibration.py` | Confidence → p_win | via policy/review tests |
| 8 | `trader/policy.py` | Exits, escalation, gates, Kelly sizing | `tests/test_policy.py` |
| 9 | `trader/risk.py` | Hard pre-trade checks, kill switch | `tests/test_risk.py` |
| 10 | `trader/execution.py` | `PaperBroker` costs model, `RiskGuardedBroker` | `tests/test_risk.py` |
| 11 | `trader/brain.py` | Opus 5.5 escalation + rewrite, strict JSON, fail closed | `tests/test_loop_and_review.py` (stub brain) |
| 12 | `trader/ledger.py` | Append-only JSONL | via loop tests |
| 13 | `trader/agent.py` | Live loop | `tests/test_loop_and_review.py` |
| 14 | `trader/review.py` | Brier, reliability, misses, calibration refit, candidates, `promote` | same |
| 15 | `trader/sim.py` | Synthetic regime-switching market | plumbing only |
| 16 | `trader/__main__.py` | CLI: compile / paper / review / promote | smoke |
| 17 | `scripts/nightly.sh` | Cron entry for the overnight loop | manual |

**Remaining tasks before capped-live (not built on purpose):**
- `trader/feeds/<venue>.py`: websocket book + trades using the exchange timestamp. Reject on gaps and resync from a REST snapshot.
- `trader/venues/<venue>.py`: a `Broker` implementation with idempotent client IDs, fill reconciliation and a reduce-only flag.
- `trader/research_refresh.py`: pulls primary metrics (DefiLlama fees/TVL, Tokenomist unlocks, venue funding/OI, ETF issuer flows) into `research/metrics/<date>.json`.
- A replay harness over recorded real books, so the nightly review can A/B schema versions on the same tape.
