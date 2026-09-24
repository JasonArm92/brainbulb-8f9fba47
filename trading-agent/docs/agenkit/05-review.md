# Phase 5: Adversarial review

| # | Question | Finding | Status |
|---|---|---|---|
| 1 | Is any hard limit delegated to the model? | No. Limits are a frozen dataclass. `risk.py` imports nothing model-related (enforced by a test). The Brain's output schema has no size or limit fields. | Closed |
| 2 | Can model output reach the broker unvalidated? | No. Every value is checked by `Decision.__post_init__`; errors and timeouts mean hold. | Closed |
| 3 | Can the nightly loop loosen risk? | Revisions may only change wording and narrow directions. Promotion needs a named approver. Thresholds are code. | Closed |
| 4 | Look-ahead in features or in review labels? | Features use only events with ts ≤ as_of. Review labels use forward marks and are used only offline. | Closed |
| 5 | Does the strategy survive costs? | Kelly uses round-trip fees + spread + slippage; zero or negative edge means no trade. **Not yet shown on real data.** | **Open: needs a real-tape replay** |
| 6 | Jev SDK surface verified? | Written from public summaries; `_call_sdk`/`_parse` are isolated and flagged. | **Open: verify at docs.typesafe.ai** |
| 7 | Brain unavailable? | Fail closed: symbols stay frozen until the 60-bar cooldown. | Closed |
| 8 | Latency | Jev publishes 70–500 ms. The timeout is 500 ms, and escalations run off the hot path. | Closed |
| 9 | Correlation | Seven crypto perps are close to one factor in a selloff. The 30% gross cap bounds the damage, but there is no correlation-aware cap. | **Open: add a beta-weighted gross cap** |
| 10 | Funding costs | Perp funding is not yet in the cost model. It matters for the ENA/SUI shorts. | **Open** |
| 11 | Venue risk | No venue adapter shipped. Custody and counterparty risk are out of scope for code. | By design |
