# Phase 1: Spec

## Goal
A 24/7 agent that trades a small set of researched crypto perps. Survival comes first:
over a full cycle, never lose more than 15% peak-to-trough. Profit comes second.

## Actors
- **Brain** (Claude Opus 5.5, `claude-opus-5-5`): research, schema authoring, escalation reviews,
  nightly review. Slow, and never on the order path.
- **Reflex** (TypeSafe Jev): one typed decision per symbol per candle.
- **Code**: state engine, gates, sizing, risk, execution, ledger. Owns every number and every side effect.
- **Operator**: approves the phase gates, schema promotions, limit changes and go-live. Holds the kill switch.

## Functional requirements
1. Every bar, build a snapshot per symbol from book + trades + portfolio. Under 400 tokens, strictly causal.
2. Send all finalists to Jev in one concurrent dispatch with a 500 ms timeout. Errors and timeouts mean hold.
3. Schema per finalist: `regime` Choice{trending, mean_reverting, high_vol, crisis};
   `direction` Choice{long, short, neutral}; `toxic_flow` Noul; `setup_quality` Score 0–3;
   `risk_state` Choice{safe, near_limit, reduce}.
4. Enter only if setup ≥ 2 AND direction confidence > 0.80 AND risk_state = safe AND P(toxic) < 0.5
   AND the direction is in `allowed_directions`.
5. Size with Kelly on *our* calibrated p_win, net of costs and expected funding paid, × min(fraction, 0.25).
6. Escalate to the Brain if regime = crisis, or if confidence < 0.60 while holding exposure. The
   symbol is then frozen for new entries until the Brain clears it or a 60-bar cooldown passes.
7. Hard limits (code, frozen dataclass): max DD 15% (latched kill, reduce-only after), daily loss 3%,
   position 10%, gross 30%, beta-weighted gross 30% (β floored at 1), order 5%, 50 bp price band, 5 s staleness, 20 orders/min, KILL file.
8. Nightly: Brier score and reliability per question, fills, fees, slippage, misses by gate reason,
   calibration refit, a candidate schema v+1 written to `schemas/candidates/`. Promotion needs a named approver.

## Non-goals (v1)
Live venue adapter. Market making. Leverage above the gross cap. Any model-set threshold.

## Gate 1 checklist
- [~] Every figure in `research/REPORT.md` re-pulled from a primary source, with a timestamp
      (`research/metrics/2026-09-24.json`). BTC price, dominance, HYPE revenue and the ENA dates are
      resolved or corrected. **Still open:** unlock amounts for SUI, ENA and HYPE (Tokenomist Pro is
      paid), all-venue OI (Binance/Bybit unreachable), SOL ETF streak and AUM, and the FOMC dot plot.
- [ ] Finalists and `allowed_directions` confirmed by the operator. Recommended: AAVE → watch-only
      (revenue is ~$97M/yr, not $402M); SUI short thesis weakened (the unlock goes to the Community Reserve).
- [x] Jev SDK surface verified against docs.typesafe.ai and `typesafe-sdk` 0.7.1 (2026-09-24).
