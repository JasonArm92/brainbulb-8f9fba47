# Phase 2: Architecture

```
            ┌──────────────────── BRAIN (Opus 5.5, async, never on order path) ───────────────────┐
            │ research → finalists.json → compile → schemas/*.vN.json                             │
            │ escalation review (stay_frozen | clear | reduce)   nightly rewrite → candidates/    │
            └───────────────▲──────────────────────────────────────────────▲──────────────────────┘
                            │ escalations (bg thread)                      │ ledger.jsonl
 book/trades ─► StateEngine ─► Snapshot(<400 tok) ─► Jev (all symbols, 1 dispatch, 500ms) ─► Decision
                (causal ts)                                                      │ (typed, validated)
                                                                                 ▼
                                                   Policy: exits → escalation → gate → Kelly(≤¼)
                                                                                 │ Intent
                                                                                 ▼
                                    RiskGuardedBroker ─► RiskManager.check (hard, no model input)
                                                                                 │
                                                                           PaperBroker / venue
```

## Invariants (each one has a test)
| Invariant | Enforced in | Test |
|---|---|---|
| Snapshot never contains data with ts > as_of | `state_engine.py` | `test_snapshot_never_uses_future_events`, `test_trades_after_as_of_excluded_from_flow` |
| Late events are rejected, not merged | `state_engine.py` | `test_late_events_rejected_not_merged` |
| Snapshot under 400 tokens | `state_engine.py` | `test_numbers_computed_in_code_and_under_token_budget` |
| Out-of-schema model output → hold | `decision.py`, `jev_client.decide_batch` | `test_out_of_schema_values_rejected`, `test_engine_failure_means_hold`, `test_timeout_means_hold` |
| Gate thresholds exactly as spec | `policy.py` | `test_gate_blocks[*]` |
| Kelly never above ¼ | `policy.py` | `test_kelly_capped_at_quarter_even_if_config_asks_more` |
| Risk layer imports nothing model-related | `risk.py` | `test_risk_module_has_no_model_inputs` |
| Every order passes risk before a fill | `execution.RiskGuardedBroker` | `test_guarded_broker_never_fills_rejected_order` |
| 15% DD latches kill, reduce-only after | `risk.py` | `test_drawdown_trips_latched_kill_switch_allows_only_reduce` |
| KILL file blocks everything | `risk.py`, `agent.py` | `test_kill_file_blocks_everything_including_reduce`, `test_kill_file_halts_loop` |
| Schema revisions cannot widen | `jev_schema.validate_revision` | `test_revision_cannot_widen_or_change_options` |
| Candidates are not live until promoted | `review.promote` | `test_review_brier_calibration_and_candidate` |
| Brain failure = fail closed | `brain.py` | `FailClosedBrain` default; `OpusBrain` returns stay_frozen on any error |
| Beta-weighted gross cap can only tighten | `risk.py`, `correlation.py` | `test_beta_cap_blocks_correlated_book_that_raw_gross_allows`, `test_faulty_beta_provider_cannot_loosen` |
| Existing hard limits unchanged | `config.py` | `test_existing_hard_limits_unchanged` |
| Funding never increases size | `policy.py`, `funding.py` | `test_received_funding_never_increases_size`, `test_receiving_side_is_never_credited` |
| Replay uses the same loop and is causal | `replay.py` | `test_replay_runs_loop_books_funding_and_is_causal`, `test_stale_symbol_cannot_trade` |
| Jev output parsed only via the documented SDK shape | `jev_client.py` | `test_real_sdk_end_to_end_over_mock_transport`, `test_malformed_response_is_rejected[*]` |

## Why confidence ≠ win probability
Jev's confidence summarises the shape of its own output distribution. Kelly needs P(trade wins after
costs). `calibration.Calibrator` maps one to the other from our own outcomes, using binned counts
shrunk toward `0.5 + 0.5·(conf − 0.5)`. It starts pessimistic, so thin evidence produces small bets.
