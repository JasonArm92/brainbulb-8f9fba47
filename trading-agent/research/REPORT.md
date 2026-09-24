# Market research and finalists (as of 2026-09-24)

> **Data-quality warning.** The build environment's network policy blocked primary data APIs
> (exchange REST, DefiLlama, CoinGecko, Tokenomist) and most direct page fetches. All figures below
> come from **web-search results dated September 2026**, mostly secondary coverage. Where sources
> disagree, both values are shown. **Nothing here is verified.** Phase 1 of the build plan
> (`docs/agenkit/01-spec.md`) requires re-pulling every number from a primary source before the
> operator opens the live gate. Labels used: **[Sourced]** = reported by a cited source;
> **[Conflict]** = sources disagree; **[Estimate]** = my inference; **[Speculation]** = catalyst not
> confirmed.

## 1. Regime

| Input | Reading | Label | Source |
|---|---|---|---|
| Fed policy | FOMC **raised** the funds rate 25 bp to 3.75–4.00% on 2026-09-16, 12–0. Dot plot: 16 of 18 expect another hike | [Sourced, primary] | [Federal Reserve statement 2026-09-16](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm), [CNBC 2026-09-16](https://www.cnbc.com/2026/09/16/fed-rate-decision-september-2026.html) |
| BTC spot ETF flows | ~$2B of creations across Sep 18, 21, 22; Sep 21 net +$998.95M (SoSoValue), the largest day of 2026; 2026 YTD flows turned positive | [Sourced] | [Bloomberg 2026-09-23](https://www.bloomberg.com/news/articles/2026-09-23/bitcoin-etf-flows-turn-positive-after-4-6-billion-rebound), [investingLive](https://investinglive.com/cryptocurrency/bitcoin-etf-flows-turn-positive-for-2026-after-near-1-billion-inflow-day/) |
| BTC price | "Past $84k" on Sep 23 vs "reclaiming $87K" on Sep 24; YTD low in the high $50ks | [Conflict] | [CryptoTimes 2026-09-24](https://www.cryptotimes.io/2026/09/24/inside-bitcoins-september-2026-rally-btc-reclaiming-87k-2b-in-etf-inflows-and-a-short-squeeze/), [investingLive](https://investinglive.com/cryptocurrency/bitcoin-etf-flows-turn-positive-for-2026-after-near-1-billion-inflow-day/) |
| BTC funding | ~0.0075%/8h (~8% annualised) vs 30-day average ~0.0054%; below the ~0.03% "crowded" level | [Sourced, venue not pinned] | Search coverage of the Sep 23 short squeeze; verify on venue API |
| BTC dominance | 57.3% vs 59.2% | [Conflict] | [Datawallet](https://www.datawallet.com/bitcoin-dominance), [tv-hub](https://www.tv-hub.org/guide/bitcoin-dominance) |
| Stablecoin supply | ~$308B (figure dated 2026-08-13) | [Sourced, stale] | [Reap](https://reap.global/blog/stablecoin-statistics-2026) |
| ETH | ~$2,704 on Sep 21; OI ~$31.5B, a four-month high; ETH ETFs −$140M in the week to Sep 18, then +$143.7M on Sep 18 | [Sourced] | [UseTheBitcoin 2026-09-20](https://usethebitcoin.com/eth/ethereum-price-september-20-2026/), [CoinCentral](https://coincentral.com/ethereum-eth-price-eth-squeezes-shorts-and-pulls-in-141m-in-etf-inflows-in-one-day/), [CryptoTicker](https://cryptoticker.io/en/ethereum-etf-outflows-check/) |
| Narrative rotation | Revenue/buyback tokens (HYPE, AAVE, PUMP) are the dominant 2026 narrative. Tracked buybacks were ~$638M Jan–Aug 2026, ~90% from Hyperliquid and Pump.fun | [Sourced] | [KuCoin](https://www.kucoin.com/news/flash/crypto-buybacks-reach-638m-in-2026-driven-by-hyperliquid-and-pump-fun), [AMBCrypto](https://ambcrypto.com/crypto-buybacks-reach-638m-as-hyperliquid-dominates-is-the-model-sustainable/) |

**Regime call [Estimate]: a flow-driven, short-squeeze-led rebound inside a macro regime that is
tightening again.** Crypto trend is up, but the Fed hiked and signalled more hikes, so the macro
backdrop is working against it. That combination tends to produce sharp two-way moves. For the
live agent this maps to `trending` or `high_vol`, not `crisis`. It argues for smaller size, trading
both sides on majors, and no leverage beyond the risk caps. It is **not** a regime for buying
long-dated beta on narrative alone.

## 2. Finalists

A setup is only asymmetric after costs. Hard rules for every finalist: the code-owned risk layer
applies unchanged, and `allowed_directions` in `research/finalists.json` limits what Jev can act
on.

### 2.1 BTC (both directions): flow trend
- **Thesis:** ETF creations have returned in size and funding is moderate, so the move is not yet
  crowded. This is a flow-following trade, not a valuation call.
- **Catalysts:** [Sourced] ETF creations on Sep 18–22. [Speculation] More Treasury "intervention"
  comments ([CoinDesk 2026-08-20](https://www.coindesk.com/tech/2026/08/20/live-updates-bitcoin-etfs-draw-usd517-million-ether-pulls-usd189-million-in-biggest-inflows-in-months)).
- **Bear case:** The Fed is hiking with more to come. ETF flows swung from redemptions to creations
  within one week, so they can reverse just as fast. A squeeze-led rally loses its fuel once the
  shorts have covered. Price is only back to its January level.
- **Value accrual:** None beyond monetary premium, so there is no fundamental floor to the trade.
- **Invalidation:** A week of net ETF outflows; funding above 0.03%/8h while price falls; a daily
  close back below the September breakout.

### 2.2 ETH (both directions): leverage-led move
- **Thesis:** OI is at a four-month high while ETF flows are mixed. Positioning is building, which
  means the move can extend or unwind sharply. That is the reason to trade both sides.
- **Bear case:** Rising OI without steady spot/ETF demand is how long squeezes start.
- **Invalidation:** OI keeps rising while price stalls, or ETF outflows resume for a full week.

### 2.3 SOL (long only): ETF-bid L1
- **Thesis:** [Sourced] US spot SOL ETFs have 12 straight weeks of net inflows (~$1.4B; AUM ~$1.62B
  on Sep 20). About 70% of supply is staked. Slot time cut to 250 ms on 2026-09-18 ([CryptoTicker](https://cryptoticker.io/en/solana-three-month-high-etf-inflows-check/), [Benzinga](https://www.benzinga.com/crypto/26/09/61884616/solana-price-forms-bullish-flag-as-etf-and-staking-inflows-jump)).
- **Catalysts:** Confirmed: slot-time reduction, Transaction V1 format (2026-09-09).
  **[Speculation]:** Alpenglow (≈100 ms finality) is still in testing. "Nears October" claims come
  from promotional press releases ([openPR](https://www.openpr.com/news/4641624/solana-sol-price-prediction-picks-up-speed-as-alpenglow-nears)) and do not count as confirmation.
- **Bear case:** ETF AUM is small next to SOL's market cap, so a flow streak can stall at any time.
  Staking yield is inflation, not revenue. The "upgrade" catalyst is a recurring pattern that is
  often priced in ahead of time.
- **Invalidation:** The inflow streak breaks; Alpenglow slips with no date; a network outage.

### 2.4 HYPE (both directions): real revenue vs unlock overhang
- **Thesis:** Fees are organic and flow to the token through programmatic buybacks (the Assistance
  Fund; reported as 97% of fees). Value accrual is as direct as it gets in crypto.
- **Metrics [Conflict]:** "$1.3B annualised fees" ([Bitget](https://www.bitget.com/news/detail/12560605430973)) vs "$429M revenue, leads 2026" ([crypto.news](https://crypto.news/hyperliquid-posts-strong-429m-revenue-leads-2026/)). These may cover different periods or definitions. Pull the primary figure from [DefiLlama](https://defillama.com/protocol/hyperliquid).
- **Catalysts:** [Sourced] Coinbase routing perps through Hyperliquid infrastructure; reported CFTC
  engagement. [Speculation] US access.
- **Bear case:** Price is at or near its ATH (~$83, [Yahoo](https://finance.yahoo.com/markets/crypto/articles/hyperliquid-sets-high-1-2b-213100245.html)), so the good news is largely priced in.
  A core-contributor unlock lands on **2026-10-06**. Past claim rates were low (~1.75%), but that
  can change. Regulatory risk runs both ways. Revenue is cyclical and moves with perp volume.
- **Invalidation:** Unlocked tokens claimed and moved to exchanges; a sharp drop in fee revenue;
  adverse US action.

### 2.5 AAVE (long only): buyback engine
- **Thesis:** Aavenomics 3.0 went live on 2026-06-27 and routes revenue to automated open-market
  buybacks ([The Defiant](https://thedefiant.io/news/defi/aave-confirms-aavenomics-3-0-live-buybacks-dao-spending-cut)). Revenue comes from lending spread, not emissions.
- **Bear case:** [Sourced] In March 2026 governance **cut** the buyback budget from ~$50M to ~$30M,
  citing borrow-fee revenue down ~25% from peak ([Aave governance](https://governance.aave.com/t/aave-dao-funding-insights/24192)). Lending revenue is pro-cyclical, and a rate-hike cycle can cut leverage demand. The "$402M annualised revenue" figure comes from a low-quality source.
- **Invalidation:** Revenue keeps falling; another budget cut; a bad-debt event.

### 2.6 ENA (short only, event-driven): fee switch not live, unlock ahead
- **Thesis:** The fee switch passed (2026-09-03) but only activates once USDe supply reaches
  **$7.5B**. Reported supply is **$4.07–4.75B** ([Bankless](https://www.bankless.com/read/news/ethena-fee-switch-vote-ties-ena-buybacks-to-usde-growth), [DL News](https://www.dlnews.com/articles/defi/ethena-fee-switch-milestone-a-top-priority-as-usde-hits-all-time-high/), [Pluang](https://pluang.com/en/news-feed/jadwal-pembelian-kembali-ena-ethena-fee-switch)). So the "value accrual" narrative is not yet backed by cash flow. About 1.41B ENA (~$212M) unlocks on **2026-10-05** ([KuCoin](https://www.kucoin.com/news/insight/SUI/6ab29fac74fd460007c4ca60)).
- **Bear case (against the short):** Headlines report ENA near a ~100% rally ([Yahoo](https://finance.yahoo.com/markets/crypto/articles/ethena-just-paid-early-investors-161011399.html)). Shorting strength into a scheduled unlock is a crowded, well-known trade, and negative funding can make holding it expensive. USDe supply grows fast whenever funding rates are high.
- **Invalidation:** USDe supply climbing fast toward $7.5B; deeply negative funding; the unlock
  absorbed without impact.

### 2.7 SUI (short only, event-driven): unlock supply
- **Thesis:** A scheduled unlock on 2026-10-01 adds supply.
- **Metrics [Conflict]:** $61.2M vs ~$180.4M for the same event ([KuCoin](https://www.kucoin.com/news/insight/SUI/6ab29fac74fd460007c4ca60), [Crypto-Corner](https://crypto-corner.com/2026/09/22/upcoming-token-unlocks-sep-oct-2026/)). Check [Tokenomist](https://tokenomist.ai/) before trading.
- **Bear case (against the short):** Unlock dates are public and often priced in weeks ahead.
  "Sell the rumour, buy the news" reversals are common.
- **Invalidation:** Rising spot volume with positive flow through the unlock; deeply negative
  funding before it.

**Watched, not a finalist:** ASTER (~$503.6M unlock on 2026-10-05, per KuCoin). The unlock is large
relative to the token's history, but liquidity and data quality are too thin to meet the bar.

## 3. Engine notes (Jev)
- [Sourced] Jev takes unstructured state plus a predeclared schema and returns typed values:
  **Choice** (≤255 options, with per-option probabilities and a confidence), **Score** (2–10 levels,
  can land between levels, with confidence) and **Noul** (a single yes-probability) ([MarkTechPost 2026-09-19](https://www.marktechpost.com/2026/09/19/typesafe-ai-releases-jev/), [TypeSafe confidence docs](https://docs.typesafe.ai/confidence)).
- [Sourced] Published latency is **70–500 ms** end to end. The brief's "~81 ms" sits at the low end
  of that range, so the loop's Jev timeout is 500 ms, and a timeout means hold.
- [Estimate] "Calibrated" means calibrated on TypeSafe's training objective, not on our after-cost
  P&L. So sizing uses our own `Calibrator`, not raw confidence.

## Sources
Federal Reserve; CNBC; Bloomberg; investingLive; CryptoTimes; CoinDesk; Datawallet; tv-hub; Reap;
UseTheBitcoin; CoinCentral; CryptoTicker; KuCoin; AMBCrypto; Bitget; crypto.news; DefiLlama; Yahoo
Finance; The Defiant; Aave governance forum; Bankless; DL News; Pluang; Crypto-Corner; Tokenomist;
openPR; Benzinga; MarkTechPost; TypeSafe docs. All accessed via search on 2026-09-24. URLs inline above.
