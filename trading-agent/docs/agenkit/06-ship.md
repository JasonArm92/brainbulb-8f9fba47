# Phase 6: Ship ladder

No step is skipped, and each rung needs operator approval plus its exit criteria.

| Rung | What runs | Exit criteria to climb |
|---|---|---|
| 0. Synthetic | `trader paper` on `SimMarket` | tests green; 0 risk rejects; review runs |
| 1. Replay | recorded real books through the same loop, real Jev calls | ≥ 30 days of tape; direction Brier skill > 0 on held-out days; net P&L > 0 after fees, spread, slippage and funding |
| 2. Shadow | live feed, real Jev, **paper broker** | ≥ 14 days; realised slippage within 1.5× the model; 0 causality rejects unexplained; p99 loop < 600 ms |
| 3. Capped live | live venue, equity cap small enough to lose in full, limits ÷ 4 | ≥ 30 days; no kill-switch trip; live vs shadow fills reconcile |
| 4. Scale | raise the equity cap in steps of at most 2× per month | the same criteria keep holding |

Nightly schema promotions go through `python -m trader promote PATH --approved-by NAME` and apply
at the next start. Limit changes are code changes that go through Phase 5 review.
