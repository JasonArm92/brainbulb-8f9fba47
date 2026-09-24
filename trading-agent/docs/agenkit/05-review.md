# Phase 5: Adversarial review

| # | Question | Finding | Status |
|---|---|---|---|
| 1 | Is any hard limit delegated to the model? | No. Limits are a frozen dataclass. `risk.py` imports nothing model-related (enforced by a test). The Brain's output schema has no size or limit fields. | Closed |
| 2 | Can model output reach the broker unvalidated? | No. Every value is checked by `Decision.__post_init__`; errors and timeouts mean hold. | Closed |
| 3 | Can the nightly loop loosen risk? | Revisions may only change wording and narrow directions. Promotion needs a named approver. Thresholds are code. | Closed |
| 4 | Look-ahead in features or in review labels? | Features use only events with ts ≤ as_of. Review labels use forward marks and are used only offline. | Closed |
| 5 | Does the strategy survive costs? | Kelly uses round-trip fees + spread + slippage + expected funding; zero or negative edge means no trade. The replay harness (`trader/replay.py`, `python -m trader replay`) and an OKX tape recorder (`scripts/record_okx.py`) are built and tested, and `rung1_check` encodes the ship-ladder exit criteria. **No 30-day real tape has been recorded yet, so there is still no evidence of edge.** | **Harness closed; evidence open: record ≥ 30 days and replay** |
| 6 | Jev SDK surface verified? | Checked on 2026-09-24 against docs.typesafe.ai and the published `typesafe-sdk` 0.7.1 package. Fixed: package name (`typesafe_sdk`), Choice `criteria` mapping, Score `criteria` list (0-based), Noul answer field `.noul`, SDK retries off, model pinned to `jev-1.13.0`. Tests drive the real SDK over a mocked HTTP transport (`tests/test_jev_adapter.py`). | **Closed for the surface. A live call still needs a `TYPESAFE_API_KEY`** |
| 7 | Brain unavailable? | Fail closed: symbols stay frozen until the 60-bar cooldown. | Closed |
| 8 | Latency | Jev publishes 70–500 ms. The timeout is 500 ms, and escalations run off the hot path. | Closed |
| 9 | Correlation | `RiskLimits.max_beta_gross_frac = 0.30` caps Σ\|notional\|×β-to-BTC. β is an EWMA estimate from bar mids (`trader/correlation.py`), shrunk toward a 1.5 prior until warm, floored at 1.0 and capped at 3.0. A faulty provider is clamped to ≥ 1.0 in `risk.py`, so the cap can only tighten the existing 30% gross limit. Policy sizes inside the same room, so the paper run has 0 rejects. | Closed |
| 10 | Funding costs | `trader/funding.py`: sizing charges the side that pays, uses the worse of the latest rate and the 7-day mean, never credits received funding, and charges 0.01%/8h to both sides when the rate is unknown. Settlements move cash in paper/replay P&L (`Portfolio.apply_funding`). Tested on 30 days of real OKX BTC funding. | Closed |
| 11 | Venue risk | No venue adapter shipped. Custody and counterparty risk are out of scope for code. | By design |
