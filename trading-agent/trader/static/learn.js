/* Learn: glossary, candle-pattern library, lessons, quizzes and a break-even calculator.
   Plain English, UK context (Coinbase GBP spot, pounds, HMRC). Exposes window.LEARN. */
(function () {
  "use strict";

  // ------------------------------------------------------------------ glossary
  // id: [term, short definition, example or tip]
  const G = {
    candle: ["Candlestick", "One bar on the chart covering a set time (1 minute, 1 hour…). It shows four prices: where it opened, the highest, the lowest and where it closed.", "A 1-hour candle from 14:00 to 15:00 that opened at £63,000 and closed at £63,400 is green."],
    body: ["Body", "The thick part of a candle, between the open and the close. A big body means buyers or sellers were firmly in control for that period.", "Body = |close − open|."],
    wick: ["Wick (shadow)", "The thin lines above and below the body. They show prices that were reached but rejected before the candle closed.", "A long lower wick means sellers pushed the price down but buyers pushed it back up."],
    ohlc: ["OHLC", "Open, High, Low, Close: the four prices every candle or bar is built from.", "OHLC bars draw the same data as candles, with small ticks for open (left) and close (right)."],
    timeframe: ["Timeframe", "How much time each candle covers. Short timeframes (1m, 5m) are noisy; longer ones (1h, 1d) show the bigger picture.", "Professionals often check a longer timeframe for direction and a shorter one for timing."],
    bullish: ["Bullish", "Expecting or showing prices going up.", "A green candle closing near its high is bullish."],
    bearish: ["Bearish", "Expecting or showing prices going down.", "A run of lower highs and lower lows is bearish."],
    trend: ["Trend", "The general direction over many candles. Up-trend: higher highs and higher lows. Down-trend: lower highs and lower lows. Sideways: neither.", "“The trend is your friend”: trading with the trend usually has better odds than against it."],
    hhhl: ["Higher highs / higher lows", "The building blocks of an up-trend: each peak and each dip is above the one before.", "If a dip falls below the previous dip, the up-trend is in doubt."],
    range: ["Range (sideways market)", "Price bouncing between a floor and a ceiling without a clear trend.", "In a range, buying near the floor and selling near the ceiling is a common approach."],
    support: ["Support", "A price level where falls have stopped before, because buyers stepped in. Think of it as a floor.", "The more times a level has held, the more traders watch it."],
    resistance: ["Resistance", "A price level where rises have stalled before, because sellers stepped in. Think of it as a ceiling.", "When resistance breaks, it often turns into support."],
    breakout: ["Breakout", "Price pushing through support or resistance with conviction, often with a jump in volume.", "A breakout on low volume is more likely to fail (a “fakeout”)."],
    fakeout: ["Fakeout", "A move through a level that quickly reverses back. It traps traders who jumped in too early.", "Waiting for a candle to close beyond the level cuts down on fakeouts."],
    pullback: ["Pullback (retracement)", "A temporary move against the trend, e.g. a dip during an up-trend.", "Many trend traders wait for a pullback rather than chase a price that has already jumped."],
    reversal: ["Reversal", "When a trend changes direction.", "Reversal patterns (like an evening star at a peak) warn that a trend may be ending."],
    consolidation: ["Consolidation", "A quiet period where price moves in a tight range, often before a bigger move.", "Bollinger Bands squeezing together is a classic sign."],
    ma: ["Moving average (MA)", "The average closing price of the last N candles, drawn as a line. It smooths out noise to show direction.", "Price above a rising average is a simple up-trend signal."],
    sma: ["SMA (simple moving average)", "A moving average where every candle counts equally.", "SMA 50: the average close of the last 50 candles."],
    ema: ["EMA (exponential moving average)", "A moving average that gives recent candles more weight, so it reacts faster than an SMA.", "EMA 9 crossing above EMA 21 is a popular short-term buy signal."],
    crossover: ["Crossover", "When a faster line crosses a slower one. Upward crossings are read as bullish, downward as bearish.", "Crossovers lag: by the time they happen, part of the move is gone."],
    golden: ["Golden cross / death cross", "The 50-period average crossing above (golden) or below (death) the 200-period average. A long-term trend signal.", "Mostly watched on daily charts."],
    rsi: ["RSI (Relative Strength Index)", "A 0–100 score of how strong recent rises were compared with recent falls, usually over 14 candles.", "Above 70 is called overbought, below 30 oversold. In strong trends RSI can stay there for a long time."],
    overbought: ["Overbought / oversold", "RSI above 70 (overbought) or below 30 (oversold): the price has moved a lot, fast, one way.", "It is a warning to be careful, not an automatic signal to trade the other way."],
    divergence: ["Divergence", "When price and an indicator disagree, e.g. price makes a higher high but RSI makes a lower high. It hints the move is running out of steam.", "Bearish divergence at resistance is a common warning sign."],
    momentum: ["Momentum", "How fast price is moving in one direction.", "RSI and MACD are momentum indicators."],
    macd: ["MACD", "Moving Average Convergence Divergence: the gap between a 12- and a 26-period EMA (the MACD line), a 9-period EMA of that gap (the signal line), and the difference as bars (the histogram).", "MACD line crossing above its signal line is read as bullish."],
    histogram: ["MACD histogram", "Bars showing MACD minus its signal line. Growing bars mean momentum is strengthening.", "Shrinking bars often come before a crossover."],
    bollinger: ["Bollinger Bands", "A 20-period average with bands two standard deviations above and below. The bands widen when prices swing more and narrow when they calm down.", "About 95% of closes land inside the bands in normal conditions."],
    squeeze: ["Squeeze", "Bollinger Bands at their narrowest for a while: the market is quiet, and quiet often comes before a big move.", "A squeeze does not tell you which way the move will go."],
    volatility: ["Volatility", "How much and how fast the price jumps around.", "Crypto is far more volatile than shares: a 3% day in Bitcoin is ordinary."],
    atr: ["ATR (Average True Range)", "The average size of a candle's full move (including gaps) over the last 14 candles. A ruler for “normal” movement.", "Stops closer than about one ATR often get hit by ordinary noise."],
    volume: ["Volume", "How much of the coin changed hands in each candle. Moves on high volume carry more weight.", "A breakout with 2× normal volume is more convincing."],
    vwap: ["VWAP", "Volume-Weighted Average Price: the average price paid today, weighted by how much traded at each price. Resets at the start of each day.", "Big traders often judge a fill as good or bad against VWAP."],
    heikin: ["Heikin-Ashi", "A smoothed candle style (Japanese for “average bar”). Each candle averages with the one before, so trends show as long runs of one colour.", "Great for seeing trend; the prices shown are not real traded prices."],
    orderbook: ["Order book", "The live list of everyone's buy offers (bids) and sell offers (asks) waiting on the exchange, at each price.", "Your bot reads Coinbase's order book several times a second."],
    bid: ["Bid", "The highest price someone is currently willing to pay.", "If you sell right now at market, you get about the best bid."],
    ask: ["Ask (offer)", "The lowest price someone is currently willing to sell at.", "If you buy right now at market, you pay about the best ask."],
    spread: ["Spread", "The gap between the best ask and the best bid. It is a hidden cost: buy and sell instantly and you lose the spread.", "Bitcoin's spread on Coinbase GBP is usually tiny; smaller coins have wider spreads."],
    depth: ["Market depth", "How much is waiting to be bought or sold at prices near the current one. Deep books absorb big orders without the price moving much.", "The depth chart shows it as two cumulative staircases."],
    liquidity: ["Liquidity", "How easily you can buy or sell without moving the price.", "Low liquidity means more slippage."],
    imbalance: ["Order-book imbalance", "More size waiting on one side (bids vs asks). A heavy bid side can act like a cushion under the price.", "Big orders can be pulled at any moment, so treat walls with suspicion."],
    wall: ["Wall", "An unusually large order at one price in the book, visible as a bright band on the heatmap.", "Walls can be real interest or a bluff (spoofing, which is illegal but happens)."],
    slippage: ["Slippage", "The difference between the price you expected and the price you got, usually because the order ate through several levels of the book.", "Bigger orders and thinner books mean more slippage."],
    market_order: ["Market order", "Buy or sell immediately at the best available price. Fast, but you pay the taker fee and the spread.", "The practice bots trade like this."],
    limit_order: ["Limit order", "Buy or sell only at your chosen price or better. It may not fill, but if it rests on the book you pay the lower maker fee.", "Coinbase Advanced: 0.40% maker vs 0.60% taker at the lowest tier."],
    maker_taker: ["Maker / taker fee", "Makers add orders to the book (limit orders that wait); takers remove them (market orders). Exchanges charge takers more.", "Coinbase Advanced lowest tier: 0.40% maker, 0.60% taker."],
    fees: ["Round-trip cost", "Everything a buy-then-sell costs: two fees, the spread and slippage. On Coinbase GBP as a taker that is roughly 1.2% or more.", "A trade must move more than about 1.2% just to break even."],
    long: ["Long / going long", "Buying something because you expect it to rise.", "Under UK rules the bots only go long: they buy real coins."],
    short: ["Short / going short", "Betting on a fall, usually by borrowing and selling. Uses derivatives, which the FCA bans for UK retail crypto.", "The bots never short."],
    spot: ["Spot trading", "Buying and selling the actual coin for immediate delivery, paid in full. No borrowing, no expiry.", "Allowed for UK retail; derivatives are not."],
    derivative: ["Derivative", "A contract whose value tracks something else (futures, options, CFDs). Crypto derivatives are banned for UK retail customers by the FCA.", "“Perpetual futures” are the most common crypto derivative."],
    leverage: ["Leverage", "Trading with borrowed money to magnify gains and losses. 10× leverage means a 10% fall wipes you out.", "Not available to UK retail in crypto, and the bots never use it."],
    stoploss: ["Stop-loss", "A pre-set price where you sell to cap a loss. Decide it before you enter, never after.", "Every bot bet has one; it widens automatically when the market is jumpy."],
    takeprofit: ["Take-profit", "A pre-set price where you sell to lock in a gain.", "The bots set it as a multiple of the stop distance."],
    rr: ["Reward-to-risk (R:R)", "How far the profit target is compared with the stop. 2:1 means you aim to win twice what you risk.", "With 2:1 you can be wrong most of the time and still profit, before fees."],
    winrate: ["Win rate", "The share of trades that make money.", "A high win rate means little if the losses are much bigger than the wins."],
    breakeven: ["Break-even win rate", "The win rate you need just to not lose money, given your stop, target and fees.", "Try the calculator in the Learn tab."],
    expectancy: ["Expectancy", "Average profit per trade: (win rate × average win) − (loss rate × average loss). It must be positive after fees.", "Positive expectancy plus sensible sizing is the whole game."],
    sizing: ["Position sizing", "Choosing how much to put in each trade, usually so a stop-loss costs a fixed small share of the account (e.g. 0.5%).", "Good sizing keeps you in the game through losing streaks."],
    kelly: ["Kelly criterion", "A formula for the bet size that grows money fastest given your edge. Full Kelly is very aggressive; the bots use at most a quarter of it.", "Over-betting, even with an edge, can wipe you out."],
    drawdown: ["Drawdown", "How far the account has fallen from its highest point.", "The bots stop for good at a 15% drawdown until you reset them."],
    edge: ["Edge", "A genuine, repeatable reason your trades win more than chance after costs. Without it, trading more just pays more fees.", "The careful bot only trades when it thinks it has an edge after fees."],
    overtrading: ["Overtrading", "Trading too often, usually from boredom or chasing losses. Fees pile up and quality drops.", "The fast bot is a live experiment in this."],
    fomo: ["FOMO", "Fear of missing out: jumping in after a big move because everyone else is.", "By the time a move is on the news, much of it has usually happened."],
    compounding: ["Compounding", "Reinvesting profits so future gains are earned on a bigger pot. It works for losses too.", "Losing 50% needs a 100% gain to get back to even."],
    cgt: ["Capital Gains Tax (CGT)", "UK tax on profit when you sell or swap crypto. The first £3,000 of net gains each tax year (6 April to 5 April) is tax-free.", "HMRC matches sells to buys using same-day, 30-day and pooled-cost rules. The live view keeps that record for you."],
    s104: ["Section 104 pool", "HMRC's rule that all your units of one coin share one average cost, used for most sells.", "Same-day and 30-day matches come first."],
    fca: ["FCA", "The Financial Conduct Authority, the UK regulator. It bans crypto derivatives for retail and requires crypto firms to be registered.", "Coinbase is registered with the FCA for UK crypto activity."],
    confidence: ["Confidence (bot)", "How sure the bot's AI is about the direction, from 0 to 1. The bot only bets above your chosen level.", "Change it in Settings."],
    setup: ["Set-up quality (bot)", "The AI's 0–3 score for how clean the current chart set-up looks.", "The careful bot needs 2 or more; the fast bot 1 or more."],
    toxic: ["Toxic flow", "Trading that looks one-sided and aggressive, as if someone knows something or is pushing the price. The bot avoids entering then.", "Shows as “Suspicious trading activity”."],
    regime: ["Market regime", "The overall mood the AI detects: calm, trending, choppy or crisis.", "In a crisis the bot cuts risk."],
  };

  function termLink(id, text) {
    const t = G[id];
    return `<a href="#" class="term" data-term="${id}">${text || (t ? t[0] : id)}</a>`;
  }

  // ------------------------------------------------------------------ patterns
  // Each pattern: mini OHLC example (last candles are the pattern), meaning, how to spot.
  const up = (n, s = 100, step = 1.2) => Array.from({ length: n }, (_, i) => { const o = s + i * step, c = o + step * 0.9; return [o, c + 0.4, o - 0.4, c]; });
  const dn = (n, s = 110, step = 1.2) => Array.from({ length: n }, (_, i) => { const o = s - i * step, c = o - step * 0.9; return [o, o + 0.4, c - 0.4, c]; });
  // candles as [open, high, low, close]
  const PATTERNS = [
    { id: "hammer", name: "Hammer", tone: "bull", ex: [...dn(5), [103.6, 104.0, 99.5, 104.1].map((v, i) => i === 1 ? 104.3 : v)],
      spot: ["Comes after a fall", "Small body near the top of the candle", "Lower wick at least twice the body", "Little or no upper wick"],
      means: "Sellers pushed the price well down, but buyers fought back and closed it near the high. A possible bottom.",
      tip: "Stronger if the next candle closes higher, and if it sits on a support level.", terms: ["wick", "support", "reversal"] },
    { id: "hanging", name: "Hanging man", tone: "bear", ex: [...up(5), [106.5, 106.8, 102.4, 106.7]],
      spot: ["Comes after a rise", "Same shape as a hammer: small body at the top, long lower wick"],
      means: "Buyers are still closing it high, but the deep dip shows sellers testing. A possible top.",
      tip: "Needs a weak next candle to count. On its own it is only a warning.", terms: ["wick", "reversal", "resistance"] },
    { id: "shooting", name: "Shooting star", tone: "bear", ex: [...up(5), [106.3, 110.2, 106.0, 106.0]],
      spot: ["Comes after a rise", "Small body near the bottom", "Long upper wick, at least twice the body"],
      means: "Buyers pushed the price up, sellers slammed it back down. A possible top.",
      tip: "Watch for it at resistance.", terms: ["wick", "resistance", "reversal"] },
    { id: "invhammer", name: "Inverted hammer", tone: "bull", ex: [...dn(5), [103.8, 107.6, 103.5, 104.2]],
      spot: ["Comes after a fall", "Small body near the bottom", "Long upper wick"],
      means: "Buyers tried to push up for the first time in a while. A possible early sign of a bottom.",
      tip: "Weaker than a hammer; wait for confirmation.", terms: ["wick", "reversal"] },
    { id: "doji", name: "Doji", tone: "neutral", ex: [...up(4), [105, 107, 103, 105.05]],
      spot: ["Open and close almost the same", "Wicks on one or both sides"],
      means: "Indecision: buyers and sellers ended the period level.",
      tip: "After a long trend, a doji can mean the trend is tiring. In a range it means little.", terms: ["candle", "consolidation"] },
    { id: "bullengulf", name: "Bullish engulfing", tone: "bull", ex: [...dn(4), [105.0, 105.3, 103.6, 103.8], [103.4, 106.2, 103.2, 106.0]],
      spot: ["Comes after a fall", "A red candle, then a bigger green candle", "The green body covers the whole red body"],
      means: "Buyers overwhelmed the sellers of the previous candle. A strong reversal sign.",
      tip: "More convincing with higher volume on the green candle.", terms: ["body", "reversal", "volume"] },
    { id: "bearengulf", name: "Bearish engulfing", tone: "bear", ex: [...up(4), [105.0, 106.5, 104.8, 106.3], [106.7, 106.9, 104.2, 104.4]],
      spot: ["Comes after a rise", "A green candle, then a bigger red candle", "The red body covers the whole green body"],
      means: "Sellers overwhelmed the buyers. A strong warning of a top.", tip: "Stronger at resistance.", terms: ["body", "reversal"] },
    { id: "morning", name: "Morning star", tone: "bull", ex: [...dn(3), [106.4, 106.6, 102.8, 103.0], [102.6, 103.2, 101.9, 102.4], [102.8, 106.0, 102.6, 105.8]],
      spot: ["Three candles after a fall", "1: big red", "2: small body (the “star”), often gapping lower", "3: big green closing past the middle of candle 1"],
      means: "Selling runs out (star), then buyers take over. A classic bottom.", tip: "One of the more reliable patterns on longer timeframes.", terms: ["reversal", "body"] },
    { id: "evening", name: "Evening star", tone: "bear", ex: [...up(3), [103.6, 107.2, 103.4, 107.0], [107.4, 108.1, 107.0, 107.6], [107.2, 107.4, 103.8, 104.0]],
      spot: ["Three candles after a rise", "1: big green", "2: small body at the top", "3: big red closing past the middle of candle 1"],
      means: "Buying runs out, then sellers take over. A classic top.", tip: "Check volume: a heavy third candle adds weight.", terms: ["reversal", "body"] },
    { id: "soldiers", name: "Three white soldiers", tone: "bull", ex: [...dn(3, 106), [102.4, 104.4, 102.2, 104.2], [104.0, 106.2, 103.8, 106.0], [105.8, 108.1, 105.6, 107.9]],
      spot: ["Three green candles in a row", "Each opens inside the previous body", "Each closes near its high"],
      means: "Steady, determined buying. Often starts a new up-trend.", tip: "If RSI is already very high, the move may be stretched.", terms: ["bullish", "trend", "rsi"] },
    { id: "crows", name: "Three black crows", tone: "bear", ex: [...up(3), [107.8, 108.0, 105.8, 106.0], [106.2, 106.4, 104.0, 104.2], [104.4, 104.6, 102.1, 102.3]],
      spot: ["Three red candles in a row", "Each opens inside the previous body", "Each closes near its low"],
      means: "Steady, determined selling. Often starts a down-trend.", tip: "Watch nearby support for where it might stop.", terms: ["bearish", "trend", "support"] },
    { id: "marubozu", name: "Marubozu", tone: "neutral", ex: [[104, 104.6, 103.6, 104.2], [104.2, 104.8, 103.8, 104.0], [104.0, 104.5, 103.7, 104.3], [104.3, 108.3, 104.3, 108.3]],
      spot: ["A big body with almost no wicks"],
      means: "One side was in control from open to close. Green is strongly bullish, red strongly bearish.", tip: "Often appears at the start of breakouts.", terms: ["body", "breakout"] },
    { id: "inside", name: "Inside bar", tone: "neutral", ex: [...up(3), [104, 108.5, 103.5, 108], [107, 107.8, 105.5, 106.2]],
      spot: ["A candle whose high and low fit inside the previous candle's"],
      means: "A pause: the market is catching its breath.", tip: "Traders often place orders for a break above or below the bigger candle.", terms: ["consolidation", "breakout"] },
  ];

  function miniSVG(candles, opts = {}) {
    const w = opts.w || 160, h = opts.h || 90, pad = 6, n = candles.length;
    const hi = Math.max(...candles.map(c => c[1])), lo = Math.min(...candles.map(c => c[2]));
    const X = i => pad + (i + 0.5) * (w - 2 * pad) / n, Y = v => pad + (hi - v) / (hi - lo || 1) * (h - 2 * pad);
    const bw = Math.max(3, (w - 2 * pad) / n * 0.6), hl = opts.highlight || 0;
    let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${opts.label || "pattern example"}">`;
    if (hl) s += `<rect x="${X(n - hl) - bw}" y="1" width="${X(n - 1) - X(n - hl) + 2 * bw}" height="${h - 2}" rx="6" fill="rgba(139,157,255,.14)" stroke="rgba(139,157,255,.45)"/>`;
    candles.forEach((c, i) => {
      const [o, hh, l, cl] = c, col = cl >= o ? "#34d399" : "#fb7185";
      s += `<line x1="${X(i)}" x2="${X(i)}" y1="${Y(hh)}" y2="${Y(l)}" stroke="${col}" stroke-width="1.4"/>`;
      const top = Y(Math.max(o, cl)), bh = Math.max(1.2, Math.abs(Y(o) - Y(cl)));
      s += `<rect x="${X(i) - bw / 2}" y="${top}" width="${bw}" height="${bh}" rx="1" fill="${col}"/>`;
    });
    return s + "</svg>";
  }

  // ------------------------------------------------------------------ lessons
  const L = (id, title, mins, html, tryit) => ({ id, title, mins, html, tryit });
  const LESSONS = [
    L("chart", "What a price chart shows", 2, `
      <p>A chart is the record of every agreement between a buyer and a seller. The price only moves when one side is keener than the other: more eager buyers lift the ${termLink("ask")}, more eager sellers hit the ${termLink("bid")}.</p>
      <p>Charts can't predict the future. What they do well is show <b>who has been in control</b>, <b>where the crowd has reacted before</b> and <b>how wild the swings are</b>. That's enough to make better-informed decisions and to size risk sensibly.</p>
      <p>Always check the ${termLink("timeframe")}: a scary drop on a 1-minute chart can be a blip on the daily chart.</p>`, { mode: "line", tf: 3600 }),
    L("candles", "Reading a candlestick", 3, `
      <p>Each ${termLink("candle")} covers one period. Green (up) if it closed above where it opened, red (down) if below.</p>
      <ul><li>The ${termLink("body")} runs from open to close: big body = conviction.</li>
      <li>The ${termLink("wick", "wicks")} show the extremes that were rejected.</li>
      <li>Long lower wick: sellers tried, buyers won. Long upper wick: buyers tried, sellers won.</li></ul>
      <p>In the Charts tab, <b>tap any candle</b> and the page explains it in plain words.</p>`, { mode: "candles", tf: 300 }),
    L("trend", "Trends and market structure", 3, `
      <p>An up-${termLink("trend")} is a staircase of ${termLink("hhhl", "higher highs and higher lows")}. A down-trend is the opposite. If neither, it's a ${termLink("range")}.</p>
      <p>Trends are easiest to see with ${termLink("heikin")} candles or a ${termLink("ma", "moving average")}: price above a rising average is up-trend territory.</p>
      <p>Most beginner losses come from fighting the trend: buying every dip in a falling market. Check a longer timeframe first.</p>`, { mode: "heikin", tf: 3600, ind: ["ema"] }),
    L("sr", "Support and resistance", 3, `
      <p>${termLink("support", "Support")} is a floor where buyers keep turning up; ${termLink("resistance", "resistance")} is a ceiling where sellers keep appearing. They work partly <i>because</i> so many traders watch them.</p>
      <p>The page finds them automatically from swing points and draws dashed lines. The more touches, the stronger the level.</p>
      <p>When a level breaks with volume (a ${termLink("breakout")}), it often flips: old resistance becomes new support. Beware the ${termLink("fakeout")}.</p>`, { mode: "candles", tf: 900, ind: ["sr"] }),
    L("ma", "Moving averages", 3, `
      <p>A ${termLink("sma")} treats every candle equally; an ${termLink("ema")} reacts faster to recent ones. Common pairs: EMA 9 and 21 for short-term, SMA 50 and 200 for the big picture.</p>
      <p>A ${termLink("crossover")} (fast above slow) is a simple trend signal, but it always lags. Averages work well in trends and badly in choppy ranges, where they whipsaw.</p>`, { mode: "candles", tf: 900, ind: ["ema", "sma"] }),
    L("rsi", "RSI and momentum", 3, `
      <p>${termLink("rsi")} scores recent up-moves against down-moves on a 0–100 scale. Above 70 = ${termLink("overbought")}, below 30 = oversold.</p>
      <p>Common mistake: selling just because RSI is above 70. In strong up-trends RSI can stay above 70 for ages. It's more useful for spotting ${termLink("divergence")}: price makes a new high but RSI doesn't, which shows weakening ${termLink("momentum")}.</p>`, { mode: "candles", tf: 900, ind: ["rsi"] }),
    L("macd", "MACD", 3, `
      <p>${termLink("macd")} is built from two EMAs. The MACD line crossing above its signal line is read as bullish; below as bearish. The ${termLink("histogram")} shows the gap: growing bars mean strengthening momentum.</p>
      <p>MACD above zero means the short-term average is above the long-term one, a mild up-trend sign.</p>`, { mode: "candles", tf: 3600, ind: ["macd"] }),
    L("vol", "Volatility and Bollinger Bands", 3, `
      <p>${termLink("volatility")} is how much price swings. ${termLink("bollinger")} wrap price in a band that widens when things get wild and narrows when calm.</p>
      <p>A ${termLink("squeeze")} (very narrow bands) often comes before a big move, though not in a predictable direction. ${termLink("atr")} measures typical candle size: use it to set stops beyond normal noise.</p>`, { mode: "candles", tf: 900, ind: ["bb"] }),
    L("volume", "Volume and VWAP", 2, `
      <p>${termLink("volume")} is the fuel. A breakout on double the usual volume is more believable than one on thin volume.</p>
      <p>${termLink("vwap")} is the average price paid today, weighted by volume. Price above VWAP means today's buyers are, on average, in profit.</p>`, { mode: "candles", tf: 300, ind: ["vol", "vwap"] }),
    L("book", "The order book, spread and depth", 4, `
      <p>The ${termLink("orderbook")} lists every waiting buy (${termLink("bid")}) and sell (${termLink("ask")}). The gap between the best of each is the ${termLink("spread")}.</p>
      <p>The <b>Depth</b> chart stacks them up: two staircases showing how much you could sell (green) or buy (red) before the price moves by a given amount. Steep, tall staircases = deep, ${termLink("liquidity", "liquid")} market.</p>
      <p>The <b>Heatmap</b> shows the book over time: bright bands are big resting orders (${termLink("wall", "walls")}). The <b>3D</b> view shows the same thing as a landscape you can spin.</p>
      <p>A big market order “walks the book”, filling at worse and worse prices: that's ${termLink("slippage")}.</p>`, { mode: "heatmap" }),
    L("risk", "Risk: stops, targets and sizing", 4, `
      <p>Professionals decide three things before every trade: where they're wrong (the ${termLink("stoploss")}), where they'll take profit (the ${termLink("takeprofit")}), and how much to put in (${termLink("sizing", "position size")}).</p>
      <p>Size so that hitting the stop costs a small, fixed slice of the account, say 0.5–1%. Then 10 losses in a row hurt but don't end the game.</p>
      <p>${termLink("rr", "Reward-to-risk")} and ${termLink("winrate", "win rate")} are linked: at 2:1 you only need to win about a third of the time (before fees). Use the break-even calculator below.</p>`, null),
    L("fees", "Fees: the silent killer", 3, `
      <p>On Coinbase GBP at the lowest tier, a market buy and sell cost about 0.6% each, plus the ${termLink("spread")} and ${termLink("slippage")}. That's a ${termLink("fees", "round-trip cost")} of roughly 1.2%.</p>
      <p>So a trade aiming for +1% is a guaranteed loss. This is why the careful bot trades rarely and why the fast bot is an experiment. Watch the “Fees paid” tile on each account.</p>
      <p>Ways people cut costs: ${termLink("limit_order", "limit orders")} (maker fee 0.4%), higher-volume fee tiers, and fewer, better trades.</p>`, null),
    L("mind", "Psychology and common mistakes", 3, `
      <ul><li>${termLink("fomo", "FOMO")}: buying after a big jump. Much of the move is usually done.</li>
      <li>Revenge trading: trying to win back a loss straight away. Losses compound.</li>
      <li>${termLink("overtrading", "Overtrading")}: fees and tiredness add up.</li>
      <li>Moving your stop further away because you “know” it will come back.</li>
      <li>Judging a strategy on a handful of trades. You need dozens to hundreds.</li></ul>
      <p>Bots help because they follow rules without emotion. They still need good rules and a real ${termLink("edge")}.</p>`, null),
    L("uk", "UK rules and tax", 3, `
      <p>UK retail customers can buy and sell real crypto (${termLink("spot")}) through an FCA-registered firm. ${termLink("derivative", "Derivatives")}, ${termLink("leverage")} and ${termLink("short", "shorting")} crypto are banned for retail by the ${termLink("fca")}.</p>
      <p>Selling or swapping crypto can trigger ${termLink("cgt")}. The first £3,000 of net gains each tax year is tax-free. HMRC matches sells against buys on the same day, then the next 30 days, then the ${termLink("s104", "pooled average cost")}. The live view keeps that record and exports it as CSV. It's a record-keeping aid, not tax advice.</p>`, null),
  ];

  // ------------------------------------------------------------------ break-even maths
  function breakeven(stopPct, rr, costPct) {
    const win = stopPct * rr - costPct, loss = stopPct + costPct;
    if (win <= 0) return { p: 1, win, loss, impossible: true };
    return { p: loss / (win + loss), win, loss, impossible: false };
  }


  // ------------------------------------------------------------------ UI
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const toneTag = t => `<span class="tone ${t}">${t === "bull" ? "Bullish" : t === "bear" ? "Bearish" : "Neutral"}</span>`;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };

  function patternCard(p, open) {
    return `<div class="pcard" id="pat-${p.id}"><div class="pmini">${miniSVG(p.ex, { highlight: ["morning", "evening", "soldiers", "crows"].includes(p.id) ? 3 : ["bullengulf", "bearengulf", "inside"].includes(p.id) ? 2 : 1, label: p.name })}</div>
      <div><div class="pt"><b>${esc(p.name)}</b> ${toneTag(p.tone)}</div>
      <details${open ? " open" : ""}><summary>How to spot it</summary><ul>${p.spot.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <p><b>What it suggests:</b> ${esc(p.means)}</p><p class="faint">${esc(p.tip)} Related: ${p.terms.map(t => termLink(t)).join(", ")}.</p></details></div></div>`;
  }

  function render(root, app) {
    const done = store.get("lessonsDone", {});
    root.innerHTML = `
      <section class="card span"><h2>Learn to read the charts</h2>
        <p class="mute">Short lessons using the live charts in this app. Tap <b>Try it</b> to open the chart set up for that lesson, then read the Chart breakdown under it. Tap any <a href="#" class="term" data-term="candle">underlined term</a> for a definition.</p>
        <div id="lProg" class="note"></div><div id="lList"></div></section>
      <section class="card"><h2>Break-even calculator</h2>
        <p class="mute">How often must a trade win just to not lose money? Change the numbers or load a bot's settings.</p>
        <div class="grid2"><div><label>Stop-loss % <b id="beSv"></b></label><input id="beS" type="range" min="0.3" max="6" step="0.1" value="2.5"></div>
        <div><label>Target ÷ stop <b id="beRv"></b></label><input id="beR" type="range" min="0.5" max="4" step="0.1" value="1.5"></div></div>
        <label>Round-trip costs % <b id="beCv"></b></label><input id="beC" type="range" min="0" max="2.5" step="0.05" value="1.25">
        <div class="seg" style="margin-top:14px"><button class="chip" id="beCareful">Careful bot</button><button class="chip" id="beFast">Fast bot</button><button class="chip" id="beMaker">With limit orders</button></div>
        <div id="beOut" class="tapinfo"></div></section>
      <section class="card"><h2>Test yourself</h2><p class="mute">Knowledge quizzes, chart challenges on real past charts and the trading simulator are in Training mode.</p>
        <div class="lbtns"><button class="btn primary" data-go="quiz">Take a quiz</button><button class="btn" data-go="chal">Chart challenges</button><button class="btn" data-go="sim">Simulator</button></div></section>
      <section class="card span"><h2>Candle pattern library</h2>
        <p class="mute">The shaded candles are the pattern. The Charts tab marks these automatically when it spots them. No pattern works every time; context (trend, support/resistance, volume) matters more than the shape alone.</p>
        <div class="pgrid" id="pGrid">${PATTERNS.map(p => patternCard(p)).join("")}</div></section>
      <section class="card span"><h2>Glossary</h2><input id="gSearch" type="search" placeholder="Search ${Object.keys(G).length} terms…" style="width:100%">
        <div id="gList" class="glist"></div></section>`;
    // lessons
    const list = root.querySelector("#lList");
    list.innerHTML = LESSONS.map((l, i) => `<details class="lesson" data-id="${l.id}"><summary><span class="ln">${i + 1}</span><span>${esc(l.title)}</span><span class="lm">${l.mins} min${done[l.id] ? " · ✓" : ""}</span></summary>
      <div class="lbody">${l.html}<div class="lbtns">${l.tryit ? `<button class="btn" data-try="${i}">Try it on the chart</button>` : ""}<button class="btn" data-done="${l.id}">${done[l.id] ? "Done ✓" : "Mark as done"}</button></div></div></details>`).join("");
    const prog = () => { const n = Object.keys(store.get("lessonsDone", {})).length; root.querySelector("#lProg").textContent = `${n} of ${LESSONS.length} lessons done`; };
    prog();
    list.querySelectorAll("[data-try]").forEach(b => b.onclick = () => app.openChart(LESSONS[+b.dataset.try].tryit));
    list.querySelectorAll("[data-done]").forEach(b => b.onclick = () => { const d = store.get("lessonsDone", {}); d[b.dataset.done] = 1; store.set("lessonsDone", d); b.textContent = "Done ✓"; prog(); });
    // calculator
    const be = () => { const s = +root.querySelector("#beS").value, r = +root.querySelector("#beR").value, c = +root.querySelector("#beC").value;
      root.querySelector("#beSv").textContent = s.toFixed(1) + "%"; root.querySelector("#beRv").textContent = r.toFixed(1) + "×"; root.querySelector("#beCv").textContent = c.toFixed(2) + "%";
      const o = breakeven(s, r, c), gross = s * r;
      root.querySelector("#beOut").innerHTML = o.impossible
        ? `Target ${gross.toFixed(2)}% is smaller than the ${c.toFixed(2)}% costs, so <b class="down">every “win” still loses money</b>. No win rate can make this profitable.`
        : `Target <b>+${gross.toFixed(2)}%</b>, stop <b>−${s.toFixed(2)}%</b>. After costs a win nets <b class="up">+${o.win.toFixed(2)}%</b> and a loss costs <b class="down">−${o.loss.toFixed(2)}%</b>.<br>You need to win <b>${(o.p * 100).toFixed(0)}%</b> of trades just to break even${o.p > 0.7 ? ", which is very hard to sustain" : o.p < 0.45 ? ", which is achievable with a modest edge" : ""}. Without costs it would be ${(1 / (1 + r) * 100).toFixed(0)}%, so costs add ${((o.p - 1 / (1 + r)) * 100).toFixed(0)} points.`; };
    ["#beS", "#beR", "#beC"].forEach(id => root.querySelector(id).addEventListener("input", be));
    const preset = (s, r, c) => { root.querySelector("#beS").value = s; root.querySelector("#beR").value = r; root.querySelector("#beC").value = c; be(); };
    root.querySelector("#beCareful").onclick = () => preset(2.5, 1.5, 1.25); root.querySelector("#beFast").onclick = () => preset(1.5, 1.2, 1.25); root.querySelector("#beMaker").onclick = () => preset(1.5, 1.2, 0.85);
    be();
    // glossary
    const gl = root.querySelector("#gList"), draw = q => { q = (q || "").toLowerCase(); gl.innerHTML = Object.entries(G).filter(([id, t]) => !q || (t[0] + " " + t[1]).toLowerCase().includes(q)).sort((a, b) => a[1][0].localeCompare(b[1][0]))
      .map(([id, t]) => `<div class="gitem" id="g-${id}"><b>${esc(t[0])}</b><div>${esc(t[1])}</div><div class="faint">${esc(t[2])}</div></div>`).join("") || `<div class="empty">No match.</div>`; };
    root.querySelector("#gSearch").addEventListener("input", e => draw(e.target.value)); draw("");
    root.querySelectorAll("[data-go]").forEach(b => b.onclick = () => app.showTab && app.showTab(b.dataset.go));
    // (the pattern / term quiz moved to Training > Quiz)
    if (!root.querySelector("#qBox")) return;
    let mode = "pat";
    const score = store.get("quizScore", { right: 0, total: 0 });
    const showScore = () => root.querySelector("#qScore").textContent = score.total ? `Score so far: ${score.right} of ${score.total} (${Math.round(score.right / score.total * 100)}%)` : "";
    const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    function ask() {
      const box = root.querySelector("#qBox");
      if (mode === "pat") {
        const p = PATTERNS[Math.floor(Math.random() * PATTERNS.length)], opts = shuffle([p, ...shuffle(PATTERNS.filter(x => x.id !== p.id)).slice(0, 3)]);
        box.innerHTML = `<p>Which pattern are the shaded candles?</p><div class="pmini big">${miniSVG(p.ex, { w: 240, h: 120, highlight: ["morning", "evening", "soldiers", "crows"].includes(p.id) ? 3 : ["bullengulf", "bearengulf", "inside"].includes(p.id) ? 2 : 1 })}</div>
          <div class="qopts">${opts.map(o => `<button class="chip" data-a="${o.id}">${esc(o.name)}</button>`).join("")}</div><div class="qfb"></div>`;
        box.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { const ok = b.dataset.a === p.id; score.total++; if (ok) score.right++; store.set("quizScore", score); showScore();
          box.querySelectorAll("[data-a]").forEach(x => { x.disabled = true; if (x.dataset.a === p.id) x.classList.add("on"); });
          box.querySelector(".qfb").innerHTML = `${ok ? "<b class='up'>Correct.</b>" : `<b class='down'>Not quite:</b> it's a ${esc(p.name)}.`} ${esc(p.means)} <button class="btn" id="qNext">Next</button>`; box.querySelector("#qNext").onclick = ask; });
      } else {
        const ids = Object.keys(G), id = ids[Math.floor(Math.random() * ids.length)], opts = shuffle([id, ...shuffle(ids.filter(x => x !== id)).slice(0, 3)]);
        box.innerHTML = `<p>Which term matches this?</p><div class="tapinfo">${esc(G[id][1])}</div><div class="qopts">${opts.map(o => `<button class="chip" data-a="${o}">${esc(G[o][0])}</button>`).join("")}</div><div class="qfb"></div>`;
        box.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { const ok = b.dataset.a === id; score.total++; if (ok) score.right++; store.set("quizScore", score); showScore();
          box.querySelectorAll("[data-a]").forEach(x => { x.disabled = true; if (x.dataset.a === id) x.classList.add("on"); });
          box.querySelector(".qfb").innerHTML = `${ok ? "<b class='up'>Correct.</b>" : `<b class='down'>It's ${esc(G[id][0])}.</b>`} ${esc(G[id][2])} <button class="btn" id="qNext">Next</button>`; box.querySelector("#qNext").onclick = ask; });
      }
    }
    root.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { mode = b.dataset.q; root.querySelectorAll("[data-q]").forEach(x => x.classList.toggle("on", x === b)); ask(); });
    ask(); showScore();
  }

  function showPattern(root, id) {
    const el = root.querySelector("#pat-" + id); if (!el) return;
    el.querySelector("details").open = true; el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600);
  }

  window.LEARN = { G, PATTERNS, LESSONS, termLink, miniSVG, breakeven, render, showPattern };
})();
