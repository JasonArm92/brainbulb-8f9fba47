# Market research and finalists (as of 2026-09-24)

> **Verification status (re-pulled 2026-09-24, 16:00–17:00 UTC).** Every figure below was
> re-checked against a primary source. The raw values, each with its source URL and the source's
> own timestamp, are in [`metrics/2026-09-24.json`](metrics/2026-09-24.json). Labels:
> **[Verified]** = matches a primary source; **[Corrected]** = the primary source disagrees and the
> primary value is shown; **[Resolved]** = a former conflict settled by a primary source;
> **[Unverified]** = no primary source reachable (reason given); **[Estimate]** = my inference;
> **[Speculation]** = catalyst not confirmed.
>
> **Could not reach:** CoinGecko (robots.txt), Binance futures (HTTP 451), Bybit (HTTP 403),
> Tokenomist unlock *amounts* (paid tier). Exchange data therefore comes from OKX and Coinbase, and
> OI and funding figures are **OKX-only**, not all-venue totals.

## 1. Regime

| Input | Verified reading | Label | Primary source |
|---|---|---|---|
| Fed policy | FOMC raised the target range 25 bp to 3.75–4.00% on 2026-09-16, vote 12–0 | [Verified] | [Federal Reserve](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm) |
| Dot plot "16 of 18 expect another hike" | Not re-checked against the SEP PDF | [Unverified] | — |
| BTC spot ETF flows | Sep 18 +$433.0M, Sep 21 +$999.0M, Sep 22 +$714.7M (3 days: **+$2.15B**), Sep 23 +$346.9M. Preceded by Sep 15 −$450.4M and Sep 16 −$295.9M | [Verified] | [Farside BTC table](https://farside.co.uk/btc/) (issuer-level daily) |
| "2026 YTD flows turned positive" | Farside's total row is cumulative since launch ($57.3B), not YTD | [Unverified] | — |
| BTC price | **$84,069** Coinbase spot at 2026-09-24 13:33Z; OKX perp $83,316 at 09:29Z, 24h open $85,871. The "$87K reclaim" is not supported at pull time; the "$84k" figure is | [Resolved] | [Coinbase](https://api.exchange.coinbase.com/products/BTC-USD/ticker), OKX ticker |
| BTC funding (OKX, 8h) | Mean of last 90 periods **0.0057%**, last 30 periods 0.0066%, last settled 0.0095%. Annualised ≈ 6–7%. Well below the 0.03% "crowded" level | [Verified, OKX only] | OKX funding-rate-history; series in `tests/fixtures/okx_btc_usdt_swap_funding.csv` |
| BTC dominance | **56.3%** (total cap $2.99T) | [Corrected] Both earlier figures (57.3%, 59.2%) were higher. Dominance depends on the coin universe | [coinpaprika /v1/global](https://api.coinpaprika.com/v1/global) 06:07Z |
| Stablecoin supply | **$306.1B**, +0.55% over 7 days; USDT 59.95% share | [Corrected] (was $308B, stale) | [DefiLlama stablecoins](https://defillama.com/stablecoins) |
| ETH | **$2,694** OKX perp (07:46Z). ETF flows for the week of Sep 14–18: **−$140.6M**, with Sep 18 +$143.7M. Sep 21–23 +$434.7M | [Verified] | OKX ticker; [Farside ETH](https://farside.co.uk/eth/) |
| ETH OI "$31.5B four-month high" | OKX alone is $1.64B. All-venue OI needs CoinGlass/Binance, both unreachable | [Unverified] | — |
| Buyback narrative ($638M Jan–Aug) | Secondary only | [Unverified] | — |

**Regime call [Estimate], unchanged after verification:** a flow-driven, short-squeeze-led
rebound inside a macro regime that is tightening again. The primary data sharpens one point. BTC
gave back about 3% in the 24h to the pull (OKX open $85,871 → $83,316), and total crypto market
cap was −2.98% on the day, while ETF creations kept coming. Flows and price are already diverging
intraday. The live agent should read this as `high_vol`, not `trending`.

## 2. Finalists

A setup is only asymmetric after costs. Hard rules for every finalist: the code-owned risk layer
applies unchanged, and `allowed_directions` in `research/finalists.json` limits what Jev can act
on.

### 2.1 BTC (both directions): flow trend
- **Thesis:** ETF creations have returned in size and funding is moderate, so the move is not yet
  crowded. This is a flow-following trade, not a valuation call.
- **Verified data:** ETF creations of +$2.15B over Sep 18/21/22 and +$346.9M on Sep 23 (Farside).
  OKX funding is 0.0057%/8h on a 30-day mean, so the move is not crowded.
- **Catalysts:** [Verified] ETF creations on Sep 18–23. [Speculation] More Treasury "intervention"
  comments ([CoinDesk 2026-08-20](https://www.coindesk.com/tech/2026/08/20/live-updates-bitcoin-etfs-draw-usd517-million-ether-pulls-usd189-million-in-biggest-inflows-in-months)).
- **Bear case:** The Fed is hiking with more to come. ETF flows swung from redemptions to creations
  within one week, so they can reverse just as fast. A squeeze-led rally loses its fuel once the
  shorts have covered. The "back to its January level" and "YTD low in the high $50ks" claims are
  [Unverified].
- **Value accrual:** None beyond monetary premium, so there is no fundamental floor to the trade.
- **Invalidation:** A week of net ETF outflows; funding above 0.03%/8h while price falls; a daily
  close back below the September breakout.

### 2.2 ETH (both directions): leverage-led move
- **Verified data:** ETF flows −$140.6M in the week of Sep 14–18, then +$434.7M over Sep 21–23
  (Farside). OKX-only OI is $1.64B. The all-venue "$31.5B, four-month high" is [Unverified].
- **Thesis:** OI is reported at a four-month high while ETF flows are mixed. Positioning is building, which
  means the move can extend or unwind sharply. That is the reason to trade both sides.
- **Bear case:** Rising OI without steady spot/ETF demand is how long squeezes start.
- **Invalidation:** OI keeps rising while price stalls, or ETF outflows resume for a full week.

### 2.3 SOL (long only): ETF-bid L1
- **Verified data:** $114.53 OKX perp (Sep 23 21:42Z), 24h open $118. US spot SOL ETF net flows
  (Farside, Mon–Fri weeks): Sep 7–11 **+$10.3M**, Sep 14–18 **+$60.7M**, Sep 21–23 **+$68.6M**;
  cumulative since launch **$1,479M** (matches the "~$1.4B" claim). [Verified]
- **[Unverified]:** "12 straight weeks" (only 3 weeks checked), AUM ~$1.62B, ~70% staked, the
  250 ms slot time and Transaction V1 dates. These need the issuer files and Solana release notes.
- **Thesis:** ETF demand is positive but small. The Sep 7–11 week was only +$10.3M, so the "streak"
  nearly broke two weeks ago. That supports the bear case below.
- **Catalysts:** [Speculation] Alpenglow (≈100 ms finality) is still in testing. "Nears October"
  claims come from promotional press releases and do not count as confirmation.
- **Bear case:** ETF AUM is small next to SOL's market cap, so a flow streak can stall at any time.
  Staking yield is inflation, not revenue. Upgrade catalysts are often priced in ahead of time.
- **Invalidation:** A net-negative ETF week; Alpenglow slips with no date; a network outage.

### 2.4 HYPE (both directions): real revenue vs unlock overhang
- **Verified data:** $93.17 OKX perp (Sep 23 20:16Z), 24h high $97.98. DefiLlama: fees 30d
  **$76.1M** (≈ **$926M** annualised), fees 1y **$918M**, revenue 1y **$695M**, revenue all-time
  **$1.27B**.
- **[Resolved] revenue conflict:** Neither "$1.3B annualised fees" nor "$429M revenue, leads 2026"
  matches. The $1.3B figure is close to DefiLlama's **all-time** revenue ($1.27B), so it was probably
  mislabelled as annualised. Use fees ≈ $0.9B/yr and revenue ≈ $0.7B/yr.
- **[Corrected] "ATH ~$83":** Price is now above that. The ATH itself was not re-checked (CoinGecko
  unreachable), but "near the ATH" is at least as true as before.
- **Unlock:** 2026-10-06 to Core Contributors [Verified date, Tokenomist]. About 22.24% of total supply is
  unlocked to date. **Amount [Unverified]:** Tokenomist Pro only.
- **Thesis:** Fees are organic and reach the token through programmatic buybacks. The 97%-of-fees
  figure is [Unverified].
- **Bear case:** Priced for good news; the contributor unlock is 12 days out; revenue is cyclical
  with perp volume; regulation cuts both ways.
- **Invalidation:** Unlocked tokens moved to exchanges; a sharp drop in 30d fees; adverse US action.

### 2.5 AAVE (long only): buyback engine. **Weakened by verification**
- **Verified data:** $144.90 OKX perp (Sep 24 16:45Z). DefiLlama: fees 1y **$750M**, but protocol
  **revenue 1y $97.5M**, revenue 30d **$5.1M** (≈ **$62M/yr** run rate).
- **[Corrected]:** The "$402M annualised revenue" figure is wrong by roughly 4–6×. It is closer to
  gross fees paid to suppliers than to protocol revenue.
- **[Verified with a date correction]:** The buyback budget was cut from ~$50M to ~$30M a year,
  citing borrow fees ~25% below peak. The governance post is dated **2026-02-28**, not March.
- **What this does to the thesis [Estimate]:** At a ~$62M/yr run rate, a $30M buyback is about
  half of revenue. That is a real bid, but it is small next to AAVE's market cap, and revenue is
  falling as rates compress. The long-only thesis is **much weaker** than the original write-up.
  **Recommendation for Gate 1:** narrow `allowed_directions` to `["neutral"]` (watch-only) until
  the 30d revenue trend turns up. This is a narrowing, so it is allowed, but the operator makes the
  call. It has **not** been changed in `finalists.json`.
- **Invalidation:** Revenue keeps falling; another budget cut; a bad-debt event.

### 2.6 ENA (short only, event-driven): fee switch not live, unlock ahead
- **Verified data:** $0.2057 OKX perp (Sep 23 21:42Z). USDe supply **$4.89B** (DefiLlama), slightly
  above the $4.07–4.75B reported range.
- **[Corrected] fee switch:** The Snapshot vote passed on **2026-09-08** (not Sep 3). Tiers:
  $7.5B → 5% take rate, $10B → 10%, $15B → 15%, $20B → 20%. The trigger is the **14-day trailing
  average** of USDe supply ([Ethena governance](https://gov.ethenafoundation.com/t/ena-fee-switch-activation/830)).
  USDe needs +53% to reach the first tier.
- **[Corrected] unlock date:** Tokenomist shows the next unlock on **2026-10-02** (Core
  Contributors), not Oct 5. **Amount [Unverified]** (Tokenomist Pro). The "1.41B ENA ≈ $212M" pair
  implies $0.15/ENA, which does not match today's $0.206. At today's price, 1.41B ENA would be
  ≈ $290M. Treat both numbers as unverified.
- **Funding (OKX, 4h):** Pinned at the +0.005%/4h cap for long stretches in August, with negative
  spells. A short *earns* funding while it is positive. It pays when funding flips negative, and
  that is the squeeze risk. This is now in the cost model (see `trader/funding.py`).
- **Bear case (against the short):** A crowded, well-known trade into a scheduled unlock.
  "Near a ~100% rally" is [Unverified].
- **Invalidation:** The USDe 14-day average climbs fast toward $7.5B; deeply negative funding; the
  unlock is absorbed without impact.

### 2.7 SUI (short only, event-driven): unlock supply. **Weakened by verification**
- **Verified data:** $0.9662 OKX perp (Sep 23 21:42Z), 24h open $1.0094.
- **Unlock:** 2026-10-01 to the **Community Reserve** [Verified date and recipient, Tokenomist].
  **Amount conflict ($61.2M vs $180.4M): still unresolved.** The amount is Tokenomist Pro only.
- **What this does to the thesis [Estimate]:** Community Reserve tranches are usually not sold on
  arrival the way investor or contributor tranches can be. A supply-shock short on a reserve
  unlock is a weaker setup than the original write-up assumed.
- **Funding (OKX, 8h):** Often pinned at the +0.01%/8h cap in August. A short earns that while it
  lasts.
- **Bear case (against the short):** Unlock dates are public and often priced in. "Sell the rumour,
  buy the news" reversals are common.
- **Invalidation:** Rising spot volume with positive flow through the unlock; deeply negative
  funding before it.

**Watched, not a finalist:** ASTER (~$503.6M unlock on 2026-10-05, per KuCoin; [Unverified]:
Tokenomist has no ASTER page). Data quality is too thin to meet the bar.

## 3. Engine notes (Jev)
- [Sourced] Jev takes unstructured state plus a predeclared schema and returns typed values:
  **Choice** (≤255 options, with per-option probabilities and a confidence), **Score** (2–10 levels,
  can land between levels, with confidence) and **Noul** (a single yes-probability) ([MarkTechPost 2026-09-19](https://www.marktechpost.com/2026/09/19/typesafe-ai-releases-jev/), [TypeSafe confidence docs](https://docs.typesafe.ai/confidence)).
- [Sourced] Published latency is **70–500 ms** end to end. The brief's "~81 ms" sits at the low end
  of that range, so the loop's Jev timeout is 500 ms, and a timeout means hold.
- [Estimate] "Calibrated" means calibrated on TypeSafe's training objective, not on our after-cost
  P&L. So sizing uses our own `Calibrator`, not raw confidence.

## Sources
Primary, fetched 2026-09-24: Federal Reserve; Coinbase Exchange API; OKX public API (tickers,
open interest, funding history); coinpaprika global API; DefiLlama (stablecoins, fees and revenue
API); Farside Investors ETF flow tables (BTC, ETH, SOL); Tokenomist (unlock dates only); Ethena
governance forum; Aave governance forum. Raw values with timestamps are in
`research/metrics/2026-09-24.json`.

Secondary, from the original 2026-09-24 search pass and still cited where marked [Unverified]:
CNBC; Bloomberg; investingLive; CryptoTimes; CoinDesk; Datawallet; tv-hub; Reap; UseTheBitcoin;
CoinCentral; CryptoTicker; KuCoin; AMBCrypto; Bitget; crypto.news; Yahoo Finance; The Defiant;
Bankless; DL News; Pluang; Crypto-Corner; openPR; Benzinga; MarkTechPost.

## Still open (left for later)
- Unlock **amounts** for SUI (Oct 1), ENA (Oct 2) and HYPE (Oct 6): Tokenomist Pro is paid.
  Alternatives: each project's own vesting docs or on-chain vesting contracts.
- All-venue OI and funding: Binance (HTTP 451) and Bybit (HTTP 403) were unreachable.
  CoinGlass is the usual aggregator.
- SOL ETF 12-week streak and AUM: issuer files (Bitwise BSOL and others).
- The FOMC dot plot (SEP PDF) and HYPE's all-time high (CoinGecko blocked).
