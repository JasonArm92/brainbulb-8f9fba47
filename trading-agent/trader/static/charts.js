/* Charts tab: live Coinbase GBP charts in many modes, indicators, pattern spotting,
   plain-English breakdowns, tap-a-candle explanations, order-book heatmap, 3D depth.
   Needs lightweight-charts (static/lwc.js, Apache-2.0, TradingView) and learn.js. */
(function () {
  "use strict";
  const LW = window.LightweightCharts, LEARN = window.LEARN;
  const T = (id, text) => LEARN.termLink(id, text);
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const px = v => v == null || !isFinite(v) ? "—" : v >= 1000 ? "£" + v.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : v >= 1 ? "£" + v.toFixed(2) : v >= 0.01 ? "£" + v.toFixed(4) : "£" + (+v.toPrecision(4)).toFixed(Math.min(12, 3 - Math.floor(Math.log10(Math.abs(v) || 1e-12))));
  const pxp = v => v >= 1000 ? "£" + v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : px(v);
  const pc = (v, d = 2) => v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + v.toFixed(d) + "%";
  const ukTime = (t, o) => new Date(t * 1000).toLocaleString("en-GB", { timeZone: "Europe/London", ...o });
  const UP = "#34d399", DN = "#fb7185", ACC = "#8b9dff", ACC2 = "#c084fc", MUTE = "#9aa3b8", GRID = "rgba(255,255,255,.06)";
  const COINS = ["BTC", "ETH", "SOL", "LINK", "ADA", "DOT", "LTC", "DOGE", "AAVE", "ALGO", "ATOM", "SHIB", "BCH", "UNI", "FIL", "ETC"];
  const TFS = [[60, "1m"], [300, "5m"], [900, "15m"], [3600, "1h"], [21600, "6h"], [86400, "1d"]];
  const MODES = [["candles", "Candles"], ["heikin", "Heikin-Ashi"], ["bars", "OHLC bars"], ["line", "Line"], ["area", "Area"],
    ["baseline", "Baseline"], ["depth", "Depth now"], ["heatmap", "Book heatmap"], ["d3", "3D depth"]];
  const INDS = [["ema", "EMA 9/21"], ["sma", "SMA 50"], ["bb", "Bollinger"], ["vwap", "VWAP"], ["vol", "Volume"],
    ["rsi", "RSI"], ["macd", "MACD"], ["sr", "Support/resistance"], ["pat", "Patterns"], ["trades", "Bot trades"]];
  const BOOK_WIN = [[5, "5 min"], [15, "15 min"], [30, "30 min"], [60, "1 hour"]];
  const MODE_HELP = {
    candles: `Each ${T("candle", "candle")} shows open, high, low and close for one period. Green closed higher than it opened, red lower. <b>Tap a candle</b> to have it explained.`,
    heikin: `${T("heikin")} candles average each bar with the last one, so ${T("trend", "trends")} show as long runs of one colour and noise is smoothed. The prices are averages, not real trades.`,
    bars: `${T("ohlc")} bars: the vertical line is the high-to-low range, the left tick is the open, the right tick the close. Same data as candles, less ink.`,
    line: `A line through each period's close. Simplest view of direction; hides the wicks.`,
    area: `A line chart with the space below filled in. Good for seeing the overall shape of a move.`,
    baseline: `Coloured green above and red below the first price shown, so you can see at a glance whether you'd be up or down since the start of the view.`,
    depth: `The ${T("orderbook")} right now as two staircases: how much you could sell into the bids (green) or buy from the asks (red) before the price moves. The gap in the middle is the ${T("spread")}.`,
    heatmap: `The ${T("orderbook")} over time. Brighter = more coins waiting at that price. Green are ${T("bid", "bids")} below the price, red ${T("ask", "asks")} above; the white line is the mid price. Bright bands are ${T("wall", "walls")}.`,
    d3: `The same ${T("depth")} data as a landscape: left to right is price, front to back is time (older at the back), height is how much is waiting. Drag to spin it.`,
  };

  const S = { coin: "BTC", tf: 900, mode: "candles", inds: new Set(["ema", "vol", "sr", "pat", "trades"]), win: 15,
    candles: [], depth: [], fills: [], chart: null, series: {}, markers: null, timer: null, active: false, a3: { yaw: -0.6, pitch: 0.45, auto: true } };
  try { const v = JSON.parse(localStorage.getItem("chartPrefs") || "null"); if (v) { Object.assign(S, { coin: v.coin || S.coin, tf: v.tf || S.tf, mode: v.mode || S.mode, win: v.win || S.win }); if (v.inds) S.inds = new Set(v.inds); } } catch (_) {}
  const savePrefs = () => { try { localStorage.setItem("chartPrefs", JSON.stringify({ coin: S.coin, tf: S.tf, mode: S.mode, win: S.win, inds: [...S.inds] })); } catch (_) {} };

  // ------------------------------------------------------------------ maths
  const sma = (a, n) => a.map((_, i) => i < n - 1 ? null : a.slice(i - n + 1, i + 1).reduce((s, v) => s + v, 0) / n);
  function ema(a, n) { const k = 2 / (n + 1), out = []; let e = null; a.forEach((v, i) => { if (i < n - 1) { out.push(null); return; } if (e === null) e = a.slice(0, n).reduce((s, x) => s + x, 0) / n; else e = v * k + e * (1 - k); out.push(e); }); return out; }
  function bbands(c, n = 20, m = 2) { const mid = sma(c, n); return mid.map((md, i) => { if (md === null) return null; const sl = c.slice(i - n + 1, i + 1), sd = Math.sqrt(sl.reduce((s, v) => s + (v - md) ** 2, 0) / n); return { mid: md, up: md + m * sd, lo: md - m * sd }; }); }
  function rsi(c, n = 14) { const out = Array(c.length).fill(null); if (c.length <= n) return out; let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; } g /= n; l /= n; out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l); for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } return out; }
  function macd(c) { const a = ema(c, 12), b = ema(c, 26), line = c.map((_, i) => a[i] != null && b[i] != null ? a[i] - b[i] : null); const start = line.findIndex(v => v != null); const sig = Array(c.length).fill(null); if (start >= 0) { const e = ema(line.slice(start), 9); e.forEach((v, j) => sig[start + j] = v); } return line.map((v, i) => ({ line: v, sig: sig[i], hist: v != null && sig[i] != null ? v - sig[i] : null })); }
  function atr(k, n = 14) { const tr = k.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - k[i - 1].c), Math.abs(b.l - k[i - 1].c))); const out = []; let a = null; tr.forEach((v, i) => { if (i < n - 1) { out.push(null); return; } a = a === null ? tr.slice(0, n).reduce((s, x) => s + x, 0) / n : (a * (n - 1) + v) / n; out.push(a); }); return out; }
  function vwap(k, tf) { let pv = 0, vv = 0, day = null; return k.map(b => { const d = tf >= 86400 ? "all" : ukTime(b.t, { year: "numeric", month: "2-digit", day: "2-digit" }); if (d !== day) { day = d; pv = 0; vv = 0; } pv += (b.h + b.l + b.c) / 3 * b.v; vv += b.v; return vv > 0 ? pv / vv : null; }); }
  function heikin(k) { const out = []; k.forEach((b, i) => { const c = (b.o + b.h + b.l + b.c) / 4, o = i === 0 ? (b.o + b.c) / 2 : (out[i - 1].o + out[i - 1].c) / 2; out.push({ t: b.t, o, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c), c, v: b.v }); }); return out; }
  function pivots(k, w = 3) { const hi = [], lo = []; for (let i = w; i < k.length - w; i++) { let isH = true, isL = true; for (let j = i - w; j <= i + w; j++) { if (j === i) continue; if (k[j].h >= k[i].h) isH = false; if (k[j].l <= k[i].l) isL = false; } if (isH) hi.push(i); if (isL) lo.push(i); } return { hi, lo }; }

  // ------------------------------------------------------------------ pattern spotting
  function patternsOf(k, A) {
    const found = {};
    const prior = i => { if (i < 6) return 0; const d = k[i - 1].c - k[i - 6].c, a = A[i] || (k[i].h - k[i].l); return d > 0.6 * a ? 1 : d < -0.6 * a ? -1 : 0; };
    for (let i = 3; i < k.length; i++) {
      const b = k[i], p = k[i - 1], a = A[i]; if (!a) continue;
      const body = Math.abs(b.c - b.o), rng = b.h - b.l, upper = b.h - Math.max(b.o, b.c), lower = Math.min(b.o, b.c) - b.l, ctx = prior(i);
      const pb = Math.abs(p.c - p.o), green = b.c > b.o, pgreen = p.c > p.o;
      let hit = null;
      const q = k[i - 2], qb = Math.abs(q.c - q.o);
      if (qb >= 0.6 * a && pb <= 0.35 * qb && body >= 0.5 * qb) {
        if (q.c < q.o && green && b.c > (q.o + q.c) / 2 && ctx <= 0) hit = "morning";
        if (q.c > q.o && !green && b.c < (q.o + q.c) / 2 && ctx >= 0) hit = "evening";
      }
      if (!hit && i >= 3) {
        const three = [k[i - 2], k[i - 1], b];
        const strong = three.every(x => Math.abs(x.c - x.o) >= 0.5 * a);
        if (strong && three.every(x => x.c > x.o) && three.every(x => (x.h - x.c) <= 0.3 * (x.h - x.l)) && b.c > p.c && p.c > q.c && b.o > p.o && p.o > q.o) hit = "soldiers";
        if (strong && three.every(x => x.c < x.o) && three.every(x => (x.c - x.l) <= 0.3 * (x.h - x.l)) && b.c < p.c && p.c < q.c && b.o < p.o && p.o < q.o) hit = "crows";
      }
      if (!hit && pb >= 0.3 * a && body > pb) {
        if (!pgreen && green && b.c >= p.o && b.o <= p.c && ctx <= 0) hit = "bullengulf";
        if (pgreen && !green && b.c <= p.o && b.o >= p.c && ctx >= 0) hit = "bearengulf";
      }
      if (!hit && rng >= 0.5 * a) {
        if (lower >= 2 * Math.max(body, rng * 0.05) && upper <= 0.15 * rng) hit = ctx < 0 ? "hammer" : ctx > 0 ? "hanging" : null;
        else if (upper >= 2 * Math.max(body, rng * 0.05) && lower <= 0.15 * rng) hit = ctx > 0 ? "shooting" : ctx < 0 ? "invhammer" : null;
      }
      if (!hit && body >= 0.9 * rng && rng >= 1.2 * a) hit = "marubozu";
      if (!hit && b.h < p.h && b.l > p.l && (p.h - p.l) >= 1.2 * a) hit = "inside";
      if (!hit && rng >= 0.6 * a && body <= 0.08 * rng) hit = "doji";
      if (hit) found[i] = hit;
    }
    return found;
  }
  const patById = id => LEARN.PATTERNS.find(p => p.id === id);

  // ------------------------------------------------------------------ support / resistance
  function levels(k, A) {
    if (k.length < 20) return { sup: [], res: [] };
    const pv = pivots(k, k.length > 150 ? 4 : 3), last = k[k.length - 1].c, a = A[A.length - 1] || last * 0.005;
    const tol = Math.max(0.5 * a, last * 0.0015);
    const pts = [...pv.hi.map(i => ({ p: k[i].h, i })), ...pv.lo.map(i => ({ p: k[i].l, i }))].sort((x, y) => x.p - y.p);
    const cl = [];
    pts.forEach(x => { const c = cl[cl.length - 1]; if (c && x.p - c.hi <= tol) { c.ps.push(x.p); c.hi = x.p; c.last = Math.max(c.last, x.i); } else cl.push({ ps: [x.p], hi: x.p, last: x.i }); });
    const lv = cl.map(c => ({ p: c.ps.reduce((s, v) => s + v, 0) / c.ps.length, n: c.ps.length, last: c.last }))
      .filter(l => l.n >= 2 || l.last >= k.length - 40);
    const sup = lv.filter(l => l.p < last - tol * 0.3).sort((x, y) => y.p - x.p).slice(0, 2);
    const res = lv.filter(l => l.p > last + tol * 0.3).sort((x, y) => x.p - y.p).slice(0, 2);
    return { sup, res };
  }

  // ------------------------------------------------------------------ analysis
  function analyse(k, tf) {
    const out = { cards: [], pats: {}, lv: { sup: [], res: [] }, headline: "Not enough candles yet", tone: "neutral" };
    if (k.length < 35) return out;
    const c = k.map(b => b.c), A = atr(k), last = k[k.length - 1], close = last.c, a = A[A.length - 1];
    const e9 = ema(c, 9), e21 = ema(c, 21), s50 = sma(c, 50), R = rsi(c), M = macd(c), B = bbands(c), V = k.map(b => b.v);
    const n = k.length - 1, tfName = (TFS.find(x => x[0] === tf) || [0, ""])[1];
    out.pats = patternsOf(k, A); out.lv = levels(k, A);
    let score = 0;
    // trend
    const e21n = e21[n], e21p = e21[Math.max(0, n - 10)], slope = e21p ? (e21n - e21p) / e21p * 100 : 0, aPct = a / close * 100;
    const pv = pivots(k, 3), hs = pv.hi.slice(-2).map(i => k[i].h), ls = pv.lo.slice(-2).map(i => k[i].l);
    const hh = hs.length === 2 && hs[1] > hs[0], hl = ls.length === 2 && ls[1] > ls[0], lh = hs.length === 2 && hs[1] < hs[0], ll = ls.length === 2 && ls[1] < ls[0];
    let trend = "sideways";
    if (close > e21n && slope > 0.3 * aPct && (s50[n] == null || e21n > s50[n])) trend = "up";
    else if (close < e21n && slope < -0.3 * aPct && (s50[n] == null || e21n < s50[n])) trend = "down";
    score += trend === "up" ? 2 : trend === "down" ? -2 : 0;
    const struct = hh && hl ? `${T("hhhl", "higher highs and higher lows")}` : lh && ll ? "lower highs and lower lows" : "mixed swing points (no clean staircase)";
    out.cards.push({ title: "Trend", tone: trend === "up" ? "bull" : trend === "down" ? "bear" : "neutral",
      body: `<b>${trend === "up" ? "Up-trend" : trend === "down" ? "Down-trend" : "Sideways / no clear trend"}</b> on the ${tfName} chart. Price is ${close > e21n ? "above" : "below"} the ${T("ema", "EMA 21")} (${px(e21n)}), which has moved ${pc(slope)} over the last 10 candles. Recent swings show ${struct}.`
        + `<div class="how">${trend === "up" ? "Trend traders look to buy pullbacks towards the EMA 21 or a support level, not after a big green candle, with a stop below the last higher low." : trend === "down" ? "In a down-trend, buying dips is fighting the tide. Many traders wait for a higher low and a break of the last lower high before buying." : "In a range, traders buy near support and sell near resistance, or wait for a breakout with volume."}</div>` });
    // momentum
    const r = R[n];
    let div = "";
    const ph = pv.hi.filter(i => i > n - 60).slice(-2), pl = pv.lo.filter(i => i > n - 60).slice(-2);
    if (ph.length === 2 && k[ph[1]].h > k[ph[0]].h && R[ph[1]] != null && R[ph[0]] != null && R[ph[1]] < R[ph[0]] - 2) { div = `<b>Bearish ${T("divergence", "divergence")}:</b> price made a higher high but RSI made a lower one, so the push up is losing strength. `; score -= 1; }
    if (pl.length === 2 && k[pl[1]].l < k[pl[0]].l && R[pl[1]] != null && R[pl[0]] != null && R[pl[1]] > R[pl[0]] + 2) { div += `<b>Bullish ${T("divergence", "divergence")}:</b> price made a lower low but RSI didn't, so selling is losing strength. `; score += 1; }
    if (r != null) {
      score += r > 55 ? 0.5 : r < 45 ? -0.5 : 0;
      out.cards.push({ title: `RSI ${r.toFixed(0)}`, tone: r >= 70 ? "warn" : r <= 30 ? "warn" : r > 50 ? "bull" : "bear",
        body: `${T("rsi", "RSI")} is <b>${r.toFixed(0)}</b>: ${r >= 70 ? `${T("overbought")}, meaning price has risen fast. In a strong up-trend that can last; it's a reason not to chase, not an automatic sell.` : r <= 30 ? `${T("overbought", "oversold")}, meaning price has fallen fast. Bounces are common, but in a down-trend it can stay low.` : r > 50 ? "above 50, so recent rises have outweighed falls (mildly bullish momentum)." : "below 50, so recent falls have outweighed rises (mildly bearish momentum)."} ${div}` });
    }
    // MACD
    const m = M[n], mp = M[n - 1];
    if (m && m.line != null && m.sig != null) {
      let cross = "";
      for (let j = n; j > n - 3 && j > 0; j--) { const x = M[j], y = M[j - 1]; if (x.line != null && y.line != null && x.sig != null && y.sig != null) { if (y.line <= y.sig && x.line > x.sig) { cross = "up"; break; } if (y.line >= y.sig && x.line < x.sig) { cross = "down"; break; } } }
      score += m.hist > 0 ? 0.5 : -0.5;
      out.cards.push({ title: "MACD", tone: m.hist > 0 ? "bull" : "bear",
        body: `${T("macd")} is ${m.line > m.sig ? "above" : "below"} its signal line${cross ? ` and <b>crossed ${cross === "up" ? "upwards" : "downwards"}</b> in the last few candles` : ""}. The ${T("histogram")} is ${mp && mp.hist != null && Math.abs(m.hist) > Math.abs(mp.hist) ? "growing (momentum strengthening)" : "shrinking (momentum fading)"}. MACD is ${m.line > 0 ? "above zero: the short-term average is above the longer one" : "below zero: the short-term average is below the longer one"}.` });
    }
    // volatility & fees
    const bb = B[n];
    if (bb) {
      const widths = B.slice(-120).filter(Boolean).map(x => (x.up - x.lo) / x.mid), wNow = (bb.up - bb.lo) / bb.mid;
      const rank = widths.filter(w => w <= wNow).length / widths.length;
      const where = close > bb.up ? "closed <b>above the upper band</b>, a very strong push that often pauses soon" : close < bb.lo ? "closed <b>below the lower band</b>, a very strong drop that often pauses soon" : close > bb.mid ? "is in the upper half of the bands" : "is in the lower half of the bands";
      out.cards.push({ title: "Volatility", tone: rank <= 0.1 ? "warn" : "neutral",
        body: `${T("bollinger")}: price ${where}. Band width is ${rank <= 0.1 ? `near its narrowest of the last ${widths.length} candles: a ${T("squeeze")}, so a bigger move may be building (direction unknown)` : rank >= 0.9 ? "near its widest: the market is unusually wild right now" : "about normal"}. ${T("atr", "ATR")}: a typical ${tfName} candle moves <b>${aPct.toFixed(2)}%</b> (${px(a)}).`
          + `<div class="how">Fees check: a buy and a sell on Coinbase cost about <b>1.2%</b>. That's ${(1.2 / aPct).toFixed(1)}× a typical ${tfName} candle, so on this timeframe ${aPct < 0.3 ? "fees swamp normal movement; short-term trading here is very hard to profit from" : aPct < 1.2 ? "a trade needs several candles of movement just to break even" : "one candle can cover the fees, but losses come just as fast"}.</div>` });
    }
    // volume
    const done = n - 1, avgV = V.slice(Math.max(0, done - 20), done).reduce((s, v) => s + v, 0) / Math.min(20, Math.max(1, done));
    if (avgV > 0) {
      const ratio = V[done] / avgV, dir = k[done].c >= k[done].o ? "up" : "down";
      out.cards.push({ title: "Volume", tone: ratio >= 2 ? "warn" : "neutral",
        body: `The last finished candle traded <b>${ratio.toFixed(1)}×</b> the recent average ${T("volume", "volume")}${ratio >= 2 ? `: a spike on a move ${dir}. Big volume gives a move more weight` : ratio < 0.6 ? ": quiet. Moves on thin volume are less trustworthy" : ": about normal"}.` });
    }
    // levels
    const { sup, res } = out.lv;
    const lvTxt = (l, kind) => `${px(l.p)} (${pc((l.p / close - 1) * 100)}, ${l.n} touch${l.n === 1 ? "" : "es"})`;
    out.cards.push({ title: "Support & resistance", tone: "neutral",
      body: `${T("resistance", "Resistance")} above: ${res.length ? res.map(l => lvTxt(l)).join(", ") : "none found in view (price is near the top of the range)"}.<br>${T("support", "Support")} below: ${sup.length ? sup.map(l => lvTxt(l)).join(", ") : "none found in view (price is near the bottom of the range)"}.`
        + (sup.length && res.length ? `<div class="how">Room to the nearest ceiling is ${pc((res[0].p / close - 1) * 100)} and to the nearest floor ${pc((sup[0].p / close - 1) * 100)}. A trade from here with a stop under support aims for about ${((res[0].p - close) / Math.max(close - sup[0].p, 1e-9)).toFixed(1)}:1 ${T("rr", "reward to risk")} before fees.</div>` : "") });
    // recent patterns
    const recent = Object.entries(out.pats).filter(([i]) => +i >= n - 5).map(([i, id]) => ({ i: +i, p: patById(id) }));
    if (recent.length) {
      const top = recent[recent.length - 1];
      score += top.p.tone === "bull" ? 0.75 : top.p.tone === "bear" ? -0.75 : 0;
      out.cards.push({ title: "Candle patterns", tone: top.p.tone === "bull" ? "bull" : top.p.tone === "bear" ? "bear" : "neutral",
        body: recent.map(x => `<b>${esc(x.p.name)}</b> ${n - x.i === 0 ? "on the current (unfinished) candle" : `${n - x.i} candle${n - x.i === 1 ? "" : "s"} ago`}: ${esc(x.p.means)}`).join("<br>")
          + `<div class="how">${esc(top.p.tip)} <a href="#" class="patlink" data-pat="${top.p.id}">See the ${esc(top.p.name)} in the pattern library</a>.</div>` });
    }
    out.score = score; out.trend = trend; out.rsi = r; out.atrPct = aPct; out.atr = a;
    out.tone = score >= 1.5 ? "bull" : score <= -1.5 ? "bear" : "neutral";
    const mood = score >= 2.5 ? "strongly bullish" : score >= 1.5 ? "leaning bullish" : score <= -2.5 ? "strongly bearish" : score <= -1.5 ? "leaning bearish" : "mixed";
    out.headline = `${S.coin} on the ${tfName} chart looks <b>${mood}</b>: ${trend === "up" ? "up-trend" : trend === "down" ? "down-trend" : "no clear trend"}, RSI ${r != null ? r.toFixed(0) : "—"}, ${recent.length ? "recent " + recent[recent.length - 1].p.name.toLowerCase() : "no fresh candle pattern"}.`;
    return out;
  }

  function explainCandle(k, i, A, pats) {
    const b = k[i]; if (!b) return "";
    const rng = b.h - b.l, body = Math.abs(b.c - b.o), up = b.c >= b.o, a = A[i];
    const upper = b.h - Math.max(b.o, b.c), lower = Math.min(b.o, b.c) - b.l, chg = (b.c / b.o - 1) * 100;
    const tfName = (TFS.find(x => x[0] === S.tf) || [0, ""])[1];
    const end = ukTime(b.t + S.tf, { hour: "2-digit", minute: "2-digit" }), start = ukTime(b.t, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    let s = `<b>${start}–${end}</b> (${tfName} candle, UK time). Opened ${pxp(b.o)}, reached ${pxp(b.h)} high and ${pxp(b.l)} low, ${i === k.length - 1 ? "is currently at" : "closed at"} ${pxp(b.c)}: <b class="${up ? "up" : "down"}">${pc(chg)}</b>. `;
    s += `It's <b>${up ? "green" : "red"}</b> because it ${up ? "closed above" : "closed below"} its open. `;
    s += `The ${T("body", "body")} is ${rng ? Math.round(body / rng * 100) : 0}% of the full range`;
    s += body / (rng || 1) > 0.7 ? `: one side was firmly in control. ` : body / (rng || 1) < 0.2 ? `: little net progress, a sign of indecision. ` : ". ";
    if (lower > body * 1.5 && lower > upper) s += `The long lower ${T("wick", "wick")} shows sellers pushed it down to ${px(b.l)} but buyers pushed it back. `;
    if (upper > body * 1.5 && upper > lower) s += `The long upper ${T("wick", "wick")} shows buyers pushed it up to ${px(b.h)} but sellers pushed it back. `;
    if (a) s += `Its range was ${(rng / a).toFixed(1)}× the typical (${T("atr", "ATR")}) ${tfName} candle${rng > 1.6 * a ? ": a big move" : rng < 0.5 * a ? ": a quiet one" : ""}. `;
    if (pats[i]) { const p = patById(pats[i]); s += `<br><b>Pattern: ${esc(p.name)}.</b> ${esc(p.means)} <a href="#" class="patlink" data-pat="${p.id}">Learn this pattern</a>`; }
    if (i === k.length - 1) s += `<br><span class="faint">This candle isn't finished yet, so it can still change shape.</span>`;
    return s;
  }

  // ------------------------------------------------------------------ data
  async function getJSON(url) { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error(r.status); return r.json(); }
  async function loadCandles() { const rows = await getJSON(`candles?coin=${S.coin}&g=${S.tf}`); S.candles = rows.map(r => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] })); }
  async function loadFills() { try { const a = window.APP && APP.acct(); S.fills = await getJSON("fills" + (a ? "?a=" + encodeURIComponent(a) : "")); } catch (_) { S.fills = []; } }
  async function loadDepth() { S.depth = await getJSON(`depth?coin=${S.coin}&mins=${S.mode === "depth" ? 2 : S.win}`); }

  // ------------------------------------------------------------------ UI shell
  function chips(id, items, isOn, onPick) {
    const el = $(id); el.innerHTML = items.map(([v, l]) => `<button class="chip${isOn(v) ? " on" : ""}" data-v="${v}">${l}</button>`).join("");
    el.querySelectorAll(".chip").forEach(b => b.onclick = () => onPick(isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v));
  }
  const bookMode = () => ["depth", "heatmap", "d3"].includes(S.mode);
  function drawControls() {
    chips("cCoin", COINS.map(c => [c, c]), v => v === S.coin, v => { S.coin = v; savePrefs(); drawControls(); refresh(true); });
    chips("cTf", TFS, v => v === S.tf, v => { S.tf = v; savePrefs(); drawControls(); refresh(true); });
    chips("cMode", MODES, v => v === S.mode, v => { S.mode = v; savePrefs(); drawControls(); refresh(true); });
    chips("cInd", INDS, v => S.inds.has(v), v => { S.inds.has(v) ? S.inds.delete(v) : S.inds.add(v); savePrefs(); drawControls(); build(); });
    chips("cWin", BOOK_WIN, v => v === S.win, v => { S.win = v; savePrefs(); drawControls(); refresh(true); });
    $("cTfRow").hidden = bookMode(); $("cIndRow").hidden = bookMode(); $("cWinRow").hidden = !(S.mode === "heatmap" || S.mode === "d3");
    $("cModeHelp").innerHTML = MODE_HELP[S.mode] || "";
  }

  // ------------------------------------------------------------------ lightweight-charts
  function destroyChart() { if (S.chart) { S.chart.remove(); S.chart = null; S.series = {}; S.markers = null; } }
  function build() {
    const box = $("chMain"), cv = $("cCanvas");
    document.querySelector(".chartwrap").classList.toggle("tall", !bookMode() && (S.inds.has("rsi") || S.inds.has("macd")));
    if (bookMode()) { destroyChart(); box.hidden = true; cv.hidden = false; drawBook(); $("cLegend").innerHTML = ""; return; }
    box.hidden = false; cv.hidden = true;
    destroyChart();
    const k = S.candles; if (!k.length) return;
    const tfs = S.tf;
    const chart = LW.createChart(box, {
      autoSize: true, layout: { background: { type: "solid", color: "transparent" }, textColor: MUTE, fontSize: 11, panes: { separatorColor: "rgba(255,255,255,.1)" } },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      rightPriceScale: { borderColor: "rgba(255,255,255,.12)" }, timeScale: { borderColor: "rgba(255,255,255,.12)", timeVisible: tfs < 86400, secondsVisible: false },
      crosshair: { mode: 0 },
      localization: { locale: "en-GB", priceFormatter: p => px(p), timeFormatter: t => ukTime(t, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) },
    });
    chart.timeScale().applyOptions({ tickMarkFormatter: (t, type) => type >= 3 ? ukTime(t, { hour: "2-digit", minute: "2-digit" }) : ukTime(t, { day: "numeric", month: "short" }) });
    S.chart = chart;
    const pf = { type: "custom", formatter: p => px(p), minMove: Math.pow(10, Math.floor(Math.log10(k[k.length - 1].c || 1)) - 4) };
    const data = S.mode === "heikin" ? heikin(k) : k;
    const ohlc = data.map(b => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
    const closes = k.map(b => ({ time: b.t, value: b.c }));
    let main;
    if (S.mode === "candles" || S.mode === "heikin") main = chart.addSeries(LW.CandlestickSeries, { upColor: UP, downColor: DN, borderVisible: false, wickUpColor: UP, wickDownColor: DN, priceFormat: pf });
    else if (S.mode === "bars") main = chart.addSeries(LW.BarSeries, { upColor: UP, downColor: DN, thinBars: false, priceFormat: pf });
    else if (S.mode === "line") main = chart.addSeries(LW.LineSeries, { color: ACC, lineWidth: 2, priceFormat: pf });
    else if (S.mode === "area") main = chart.addSeries(LW.AreaSeries, { lineColor: ACC, topColor: "rgba(139,157,255,.4)", bottomColor: "rgba(139,157,255,0)", lineWidth: 2, priceFormat: pf });
    else main = chart.addSeries(LW.BaselineSeries, { baseValue: { type: "price", price: k[0].c }, topLineColor: UP, topFillColor1: "rgba(52,211,153,.3)", topFillColor2: "rgba(52,211,153,.02)", bottomLineColor: DN, bottomFillColor1: "rgba(251,113,133,.02)", bottomFillColor2: "rgba(251,113,133,.3)", priceFormat: pf });
    main.setData(["candles", "heikin", "bars"].includes(S.mode) ? ohlc : closes);
    S.series.main = main;
    const c = k.map(b => b.c), line = (vals, color, w = 1.5, pane = 0, extra = {}) => { const s = chart.addSeries(LW.LineSeries, { color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: pf, ...extra }, pane); s.setData(vals.map((v, i) => v == null ? { time: k[i].t } : { time: k[i].t, value: v })); return s; };
    if (S.inds.has("ema")) { line(ema(c, 9), "#fbbf24"); line(ema(c, 21), "#60a5fa"); }
    if (S.inds.has("sma")) line(sma(c, 50), "#f472b6", 2);
    if (S.inds.has("bb")) { const B = bbands(c); line(B.map(x => x && x.up), "rgba(192,132,252,.8)", 1); line(B.map(x => x && x.mid), "rgba(192,132,252,.45)", 1, 0, { lineStyle: 2 }); line(B.map(x => x && x.lo), "rgba(192,132,252,.8)", 1); }
    if (S.inds.has("vwap")) line(vwap(k, S.tf), "#22d3ee", 2, 0, { lineStyle: 1 });
    if (S.inds.has("vol")) { const v = chart.addSeries(LW.HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false }); v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } }); v.setData(k.map(b => ({ time: b.t, value: b.v, color: b.c >= b.o ? "rgba(52,211,153,.35)" : "rgba(251,113,133,.35)" }))); }
    let pane = 1;
    if (S.inds.has("rsi")) { const s = line(rsi(c), ACC2, 1.5, pane, { priceFormat: { type: "price", precision: 0, minMove: 1 }, lastValueVisible: true }); s.createPriceLine({ price: 70, color: "rgba(251,113,133,.6)", lineStyle: 2, lineWidth: 1, title: "70" }); s.createPriceLine({ price: 30, color: "rgba(52,211,153,.6)", lineStyle: 2, lineWidth: 1, title: "30" }); pane++; }
    if (S.inds.has("macd")) { const M = macd(c), mf = { type: "price", precision: k[k.length - 1].c < 10 ? 4 : 2, minMove: 0.0001 };
      const h = chart.addSeries(LW.HistogramSeries, { priceFormat: mf, lastValueVisible: false, priceLineVisible: false }, pane);
      h.setData(M.map((x, i) => x.hist == null ? { time: k[i].t } : { time: k[i].t, value: x.hist, color: x.hist >= 0 ? "rgba(52,211,153,.55)" : "rgba(251,113,133,.55)" }));
      line(M.map(x => x.line), "#60a5fa", 1.5, pane, { priceFormat: mf }); line(M.map(x => x.sig), "#fbbf24", 1.5, pane, { priceFormat: mf }); pane++; }
    const panes = chart.panes(); if (panes.length > 1) { panes[0].setStretchFactor(3); for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1); }
    // analysis overlays
    const an = S.an;
    if (an && S.inds.has("sr")) { an.lv.sup.forEach(l => main.createPriceLine({ price: l.p, color: "rgba(52,211,153,.75)", lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: `support ×${l.n}` })); an.lv.res.forEach(l => main.createPriceLine({ price: l.p, color: "rgba(251,113,133,.75)", lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: `resistance ×${l.n}` })); }
    const mk = [];
    if (an && S.inds.has("pat")) {
      // label only the few most recent meaningful patterns; older ones are small dots (tap them to read)
      const ents = Object.entries(an.pats).filter(([i, id]) => +i >= k.length - 120 && !(id === "inside" || id === "doji"));
      ents.forEach(([i, id], j) => { const p = patById(id), b = k[+i]; mk.push({ time: b.t, position: p.tone === "bear" ? "aboveBar" : "belowBar", shape: "circle", color: p.tone === "bull" ? UP : p.tone === "bear" ? DN : "#fbbf24", text: j >= ents.length - 3 ? p.name : "", size: 0.5 }); });
    }
    if (S.inds.has("trades")) S.fills.forEach(f => { const coin = (f.sym || "").split("-")[0]; if (coin !== S.coin || f.ts < k[0].t) return; const t = Math.floor(f.ts / S.tf) * S.tf; mk.push({ time: t, position: f.side === "buy" ? "belowBar" : "aboveBar", shape: f.side === "buy" ? "arrowUp" : "arrowDown", color: f.side === "buy" ? "#22c55e" : "#f43f5e", text: `${f.side === "buy" ? "Bot bought" : "Bot sold"} £${(f.qty * f.px).toFixed(0)}` }); });
    mk.sort((x, y) => x.time - y.time);
    S.markers = LW.createSeriesMarkers(main, mk);
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, k.length - (window.innerWidth < 600 ? 70 : 140)), to: k.length + 3 });
    chart.subscribeCrosshairMove(p => legend(p && p.time));
    chart.subscribeClick(p => { if (!p || p.time == null) return; const i = k.findIndex(b => b.t === p.time); if (i >= 0) { $("cTap").innerHTML = explainCandle(k, i, atr(k), an ? an.pats : {}); $("cTap").hidden = false; } });
    legend(null);
  }
  function legend(t) {
    const k = S.candles; if (!k.length) return; const i = t == null ? k.length - 1 : k.findIndex(b => b.t === t); const b = k[i]; if (!b) return;
    const ch = (b.c / b.o - 1) * 100, tfName = (TFS.find(x => x[0] === S.tf) || [0, ""])[1];
    $("cLegend").innerHTML = `<b>${S.coin}/GBP · ${tfName}</b> <span class="faint">${ukTime(b.t, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span><br>O ${pxp(b.o)} H ${pxp(b.h)} L ${pxp(b.l)} C ${pxp(b.c)} <span class="${ch >= 0 ? "up" : "down"}">${pc(ch)}</span>`;
  }

  // ------------------------------------------------------------------ order-book canvases
  function canvasCtx() { const cv = $("cCanvas"), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, r.width, r.height); x.font = "11px -apple-system,system-ui,sans-serif"; return [x, r.width, r.height]; }
  function noBook(x, w, h) { x.fillStyle = MUTE; x.textAlign = "center"; x.fillText("No order-book data yet: the recorder needs to be running on the Mac.", w / 2, h / 2); }
  function drawBook() { if (S.mode === "depth") drawDepthNow(); else if (S.mode === "heatmap") drawHeat(); else draw3D(); }

  function drawDepthNow() {
    const [x, w, h] = canvasCtx(), snap = S.depth[S.depth.length - 1];
    if (!snap) { noBook(x, w, h); $("cBookInfo").innerHTML = ""; return; }
    const bids = snap.bids, asks = snap.asks, mid = (bids[0][0] + asks[0][0]) / 2;
    let cb = 0, ca = 0; const B = bids.map(([p, s]) => [p, cb += s]), Aa = asks.map(([p, s]) => [p, ca += s]);
    const lo = B[B.length - 1][0], hi = Aa[Aa.length - 1][0], mx = Math.max(cb, ca), m = { l: 8, r: 8, t: 14, b: 26 };
    const X = p => m.l + (p - lo) / (hi - lo || 1) * (w - m.l - m.r), Y = v => h - m.b - v / (mx || 1) * (h - m.t - m.b);
    const stair = (pts, col, fill) => { x.beginPath(); x.moveTo(X(pts[0][0]), Y(0)); pts.forEach(([p, v], i) => { x.lineTo(X(p), Y(i ? pts[i - 1][1] : 0)); x.lineTo(X(p), Y(v)); }); x.lineTo(X(pts[pts.length - 1][0]), Y(0)); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = col; x.lineWidth = 2; x.stroke(); };
    stair(B, UP, "rgba(52,211,153,.18)"); stair(Aa, DN, "rgba(251,113,133,.18)");
    x.strokeStyle = "rgba(255,255,255,.4)"; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(X(mid), m.t); x.lineTo(X(mid), h - m.b); x.stroke(); x.setLineDash([]);
    x.fillStyle = MUTE; x.textAlign = "left"; x.fillText(px(lo), m.l, h - 8); x.textAlign = "right"; x.fillText(px(hi), w - m.r, h - 8); x.textAlign = "center"; x.fillStyle = "#fff"; x.fillText("mid " + pxp(mid), X(mid), h - 8);
    const spread = asks[0][0] - bids[0][0], imb = cb / (cb + ca);
    $("cBookInfo").innerHTML = `Best ${T("bid")} ${pxp(bids[0][0])} · best ${T("ask")} ${pxp(asks[0][0])} · ${T("spread")} ${pxp(spread)} (${(spread / mid * 100).toFixed(3)}%).<br>Top 10 levels: <b class="up">${cb.toFixed(4)} ${S.coin}</b> wanted by buyers (≈${px(cb * mid)}), <b class="down">${ca.toFixed(4)} ${S.coin}</b> offered by sellers (≈${px(ca * mid)}). `
      + `${T("imbalance", "Imbalance")}: ${(imb * 100).toFixed(0)}% bids. ${imb > 0.62 ? "More buyers are waiting close to the price, which can act like a cushion." : imb < 0.38 ? "More sellers are waiting close to the price, which can act like a lid." : "Fairly balanced."} <span class="faint">Snapshot ${ukTime(snap.ts, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}. Orders can be pulled at any moment.</span>`;
  }

  function drawHeat() {
    const [x, w, h] = canvasCtx(), D = S.depth;
    if (D.length < 2) { noBook(x, w, h); $("cBookInfo").innerHTML = ""; return; }
    const mids = D.map(d => (d.bids[0][0] + d.asks[0][0]) / 2);
    let lo = Infinity, hi = -Infinity; D.forEach(d => { lo = Math.min(lo, d.bids[d.bids.length - 1][0]); hi = Math.max(hi, d.asks[d.asks.length - 1][0]); });
    const m = { l: 4, r: 62, t: 8, b: 22 }, rows = 90, cw = (w - m.l - m.r) / D.length, rh = (h - m.t - m.b) / rows;
    const Y = p => m.t + (hi - p) / (hi - lo || 1) * (h - m.t - m.b);
    let mx = 0; D.forEach(d => [...d.bids, ...d.asks].forEach(l => mx = Math.max(mx, l[1])));
    const lmx = Math.log1p(mx);
    D.forEach((d, j) => {
      const put = (lvls, rgb) => lvls.forEach(([p, s]) => { const a = Math.min(1, Math.log1p(s) / lmx); x.fillStyle = `rgba(${rgb},${0.08 + 0.92 * a})`; const y = Y(p); x.fillRect(m.l + j * cw, y - rh / 2, Math.ceil(cw) + 0.5, Math.max(2, rh)); });
      put(d.bids, "52,211,153"); put(d.asks, "251,113,133");
    });
    x.strokeStyle = "#fff"; x.lineWidth = 1.5; x.beginPath(); mids.forEach((mm, j) => { const X = m.l + (j + 0.5) * cw; j ? x.lineTo(X, Y(mm)) : x.moveTo(X, Y(mm)); }); x.stroke();
    x.fillStyle = MUTE; x.textAlign = "left"; for (let i = 0; i <= 4; i++) { const p = hi - (hi - lo) * i / 4; x.fillText(px(p), w - m.r + 6, Y(p) + 4); }
    x.textAlign = "left"; x.fillText(ukTime(D[0].ts, { hour: "2-digit", minute: "2-digit" }), m.l, h - 6); x.textAlign = "right"; x.fillText(ukTime(D[D.length - 1].ts, { hour: "2-digit", minute: "2-digit" }), w - m.r, h - 6);
    const chg = (mids[mids.length - 1] / mids[0] - 1) * 100;
    // strongest resting level in the latest snapshot
    const last = D[D.length - 1], big = [...last.bids.map(l => [...l, "bid"]), ...last.asks.map(l => [...l, "ask"])].sort((a, b) => b[1] - a[1])[0];
    $("cBookInfo").innerHTML = `Last ${S.win} minutes of Coinbase's ${S.coin}/GBP ${T("orderbook", "order book")}, ${D.length} snapshots. Mid price moved ${pc(chg)}. Biggest resting order right now: <b class="${big[2] === "bid" ? "up" : "down"}">${big[1].toFixed(4)} ${S.coin}</b> at ${pxp(big[0])} (${big[2] === "bid" ? "buyers" : "sellers"}). `
      + `Look for bright horizontal bands that stay put: those are levels where someone is keen to trade, and price often pauses there. Bands that vanish as price approaches were likely pulled.`;
  }

  function draw3D() {
    const [x, w, h] = canvasCtx(), D = S.depth;
    if (D.length < 2) { noBook(x, w, h); $("cBookInfo").innerHTML = ""; return; }
    const step = Math.max(1, Math.floor(D.length / 40)), snaps = D.filter((_, i) => i % step === 0 || i === D.length - 1);
    // x: price offset from each snapshot's mid (in %), z: time, y: cumulative size
    let maxOff = 0, maxCum = 0;
    const curves = snaps.map(d => { const mid = (d.bids[0][0] + d.asks[0][0]) / 2; let cb = 0, ca = 0;
      const b = d.bids.map(([p, s]) => [(p / mid - 1) * 100, cb += s]), a = d.asks.map(([p, s]) => [(p / mid - 1) * 100, ca += s]);
      maxOff = Math.max(maxOff, Math.abs(b[b.length - 1][0]), Math.abs(a[a.length - 1][0])); maxCum = Math.max(maxCum, cb, ca); return { b, a, ts: d.ts }; });
    const { yaw, pitch } = S.a3, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), sc = Math.min(w, h) * 0.36;
    const P = (px_, py, pz) => { const X1 = px_ * cy - pz * sy, Z1 = px_ * sy + pz * cy; const Y2 = py * cp - Z1 * sp, Z2 = py * sp + Z1 * cp; const f = 3.2 / (3.2 + Z2); return [w / 2 + X1 * sc * f, h * 0.62 - Y2 * sc * f, Z2]; };
    const nx = v => v / (maxOff || 1), ny = v => v / (maxCum || 1) * 0.9, nz = i => (i / (curves.length - 1) - 0.5) * 1.6;
    // floor grid
    x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 1;
    for (let g = -1; g <= 1.001; g += 0.5) { let a = P(g, 0, -0.8), b = P(g, 0, 0.8); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); a = P(-1, 0, g * 0.8); b = P(1, 0, g * 0.8); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    const order = curves.map((c, i) => ({ c, i, z: P(0, 0, nz(i))[2] })).sort((a, b) => b.z - a.z);
    order.forEach(({ c, i }) => {
      const z = nz(i), age = i / (curves.length - 1), alpha = 0.12 + 0.5 * age;
      const side = (pts, rgb) => { x.beginPath(); let p0 = P(0, 0, z); x.moveTo(p0[0], p0[1]); pts.forEach(([o, v]) => { const q = P(nx(o), ny(v), z); x.lineTo(q[0], q[1]); }); const e = P(nx(pts[pts.length - 1][0]), 0, z); x.lineTo(e[0], e[1]); x.closePath(); x.fillStyle = `rgba(${rgb},${alpha * 0.55})`; x.fill(); x.strokeStyle = `rgba(${rgb},${Math.min(1, alpha + 0.25)})`; x.lineWidth = i === curves.length - 1 ? 2.2 : 1; x.stroke(); };
      side(c.b, "52,211,153"); side(c.a, "251,113,133");
    });
    x.fillStyle = MUTE; x.textAlign = "center";
    let q = P(-1, 0, 0.9); x.fillText(`−${maxOff.toFixed(2)}% (bids)`, q[0], q[1] + 14); q = P(1, 0, 0.9); x.fillText(`+${maxOff.toFixed(2)}% (asks)`, q[0], q[1] + 14);
    q = P(0, 0, -0.95); x.fillText("older", q[0], q[1] - 6); q = P(0, 0, 0.95); x.fillText("now", q[0], q[1] + 14);
    const lastC = curves[curves.length - 1], firstC = curves[0], tb = lastC.b[lastC.b.length - 1][1], ta = lastC.a[lastC.a.length - 1][1], fb = firstC.b[firstC.b.length - 1][1], fa = firstC.a[firstC.a.length - 1][1];
    $("cBookInfo").innerHTML = `Each slice is one snapshot of the top 10 price levels; the front slice is now. Tallest walls: ${maxCum.toFixed(3)} ${S.coin} stacked within ${maxOff.toFixed(2)}% of the price. Over the window, buyer-side ${T("depth", "depth")} went from ${fb.toFixed(3)} to <b class="up">${tb.toFixed(3)}</b> and seller-side from ${fa.toFixed(3)} to <b class="down">${ta.toFixed(3)}</b> ${S.coin}. `
      + `Thinning depth means the price can move more easily (more ${T("slippage")} for big orders). <span class="faint">Drag to rotate.</span>`;
    if (S.a3.auto && !matchMedia("(prefers-reduced-motion: reduce)").matches && S.mode === "d3" && S.active) { cancelAnimationFrame(S.a3.raf); S.a3.raf = requestAnimationFrame(() => { S.a3.yaw += 0.004; draw3D(); }); }
  }
  function hook3D() {
    const cv = $("cCanvas"); let drag = null;
    cv.addEventListener("pointerdown", e => { if (S.mode !== "d3") return; drag = [e.clientX, e.clientY, S.a3.yaw, S.a3.pitch]; S.a3.auto = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => { if (!drag) return; S.a3.yaw = drag[2] + (e.clientX - drag[0]) * 0.01; S.a3.pitch = Math.max(0.05, Math.min(1.3, drag[3] + (e.clientY - drag[1]) * 0.008)); draw3D(); });
    cv.addEventListener("pointerup", () => drag = null); cv.addEventListener("pointercancel", () => drag = null);
    cv.addEventListener("click", e => { if (S.mode !== "heatmap" || S.depth.length < 2) return; const r = cv.getBoundingClientRect(), j = Math.floor((e.clientX - r.left - 4) / ((r.width - 66) / S.depth.length)); const d = S.depth[Math.max(0, Math.min(S.depth.length - 1, j))]; const sp = d.asks[0][0] - d.bids[0][0]; $("cTap").innerHTML = `<b>${ukTime(d.ts, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b>: best bid ${pxp(d.bids[0][0])}, best ask ${pxp(d.asks[0][0])}, spread ${pxp(sp)}. Buyers had ${d.bids.reduce((s, l) => s + l[1], 0).toFixed(3)} ${S.coin} waiting in the top 10 levels, sellers ${d.asks.reduce((s, l) => s + l[1], 0).toFixed(3)}.`; $("cTap").hidden = false; });
    addEventListener("resize", () => { if (S.active && bookMode()) drawBook(); });
  }

  // ------------------------------------------------------------------ analysis panel + bot thoughts
  function renderAnalysis() {
    const an = S.an, box = $("cAnalysis");
    if (bookMode()) { box.innerHTML = `<p class="mute">Switch to a price chart mode (Candles, Line…) for the full chart breakdown. Order-book views are explained under the chart.</p>`; return; }
    if (!an) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="headline ${an.tone}">${an.headline}</div>
      <div class="acards">${an.cards.map(c => `<div class="acard ${c.tone}"><div class="at">${esc(c.title)}</div><div>${c.body}</div></div>`).join("")}</div>
      <p class="note">This describes what the chart shows; it isn't a prediction or advice. Patterns and indicators are probabilities, and they fail often, especially on short timeframes.</p>`;
  }
  function renderThoughts() {
    const L = window.APP && APP.live(); const box = $("cBot"); if (!box) return;
    const th = ((L && L.thoughts) || []).filter(t => (t.sym || "").startsWith(S.coin + "-")).slice(-6).reverse();
    if (!th.length) { box.innerHTML = `<div class="empty">No recent decisions for ${S.coin} yet.</div>`; return; }
    box.innerHTML = th.map(t => { const ai = t.ai || {}; const dir = ai.direction === "long" ? "up" : ai.direction === "short" ? "down" : "flat";
      return `<div class="row"><div><b>${ukTime(t.ts, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b> · <span class="${t.kind === "enter" ? "up" : t.kind === "exit" ? "down" : "mute"}">${esc(t.kind === "hold" ? "Waited: " + t.label : t.kind === "enter" ? "Bought" : t.kind === "exit" ? "Sold" : t.kind)}</span>`
        + `<div class="faint" style="font-size:12px">AI saw: ${dir}, ${T("confidence", "confidence")} ${ai.direction_conf != null ? Math.round(ai.direction_conf * 100) + "%" : "—"}, ${T("setup", "set-up")} ${ai.setup_quality != null ? (+ai.setup_quality).toFixed(1) : "—"}/3, ${T("regime", "regime")} ${esc(ai.regime || "—")}${t.p_win != null ? `, win chance after calibration ${Math.round(t.p_win * 100)}%` : ""}</div></div></div>`; }).join("");
  }

  // ------------------------------------------------------------------ refresh loop
  let busy = false;
  async function refresh(full) {
    if (!S.active || busy) return; busy = true;
    try {
      if (bookMode()) { await loadDepth(); build(); renderAnalysis(); }
      else { await Promise.all([loadCandles(), full || !S.fills.length ? loadFills() : null]); S.an = analyse(S.candles, S.tf);
        if (full || !S.chart) build(); else update(); renderAnalysis(); }
      $("cErr").hidden = true;
    } catch (e) { $("cErr").hidden = false; $("cErr").textContent = "Couldn't load chart data (" + e.message + "). Retrying…"; }
    busy = false; renderThoughts(); schedule();
  }
  function update() {
    const k = S.candles, main = S.series.main; if (!main || !k.length) return build();
    // cheap path: rebuild keeps logic simple and correct for all overlays; preserve the visible range
    const r = S.chart.timeScale().getVisibleLogicalRange(); build(); if (r) S.chart.timeScale().setVisibleLogicalRange(r);
  }
  function schedule() { clearTimeout(S.timer); if (!S.active) return; const ms = bookMode() ? (S.mode === "depth" ? 3000 : 10000) : S.tf <= 60 ? 10000 : S.tf <= 900 ? 30000 : 60000; S.timer = setTimeout(() => refresh(false), ms); }

  function init(root) {
    root.innerHTML = `
    <section class="card span">
      <div class="crow" id="cCoinRow"><div class="seg scroll" id="cCoin"></div></div>
      <div class="crow" id="cTfRow"><span class="lbl">Timeframe</span><div class="seg" id="cTf"></div></div>
      <div class="crow"><span class="lbl">Chart</span><div class="seg scroll" id="cMode"></div></div>
      <div class="crow" id="cWinRow"><span class="lbl">Window</span><div class="seg" id="cWin"></div></div>
      <div class="crow" id="cIndRow"><span class="lbl">Show</span><div class="seg scroll" id="cInd"></div></div>
      <div class="chartwrap"><div id="chMain"></div><canvas id="cCanvas" hidden></canvas><div id="cLegend" class="legend"></div></div>
      <div class="note" id="cModeHelp"></div>
      <div class="tapinfo" id="cTap" hidden></div>
      <div class="tapinfo" id="cBookInfo"></div>
      <div class="banner show" id="cErr" hidden></div>
    </section>
    <section class="card span"><h2>Chart breakdown</h2><div id="cAnalysis"></div></section>
    <section class="card span"><h2>What the bot decided on this coin</h2><div id="cBot"></div>
      <p class="note">Compare the bot's view with the chart breakdown above. Where they disagree is a good place to learn: ask yourself which one you'd trust, and why.</p></section>`;
    drawControls(); hook3D();
    document.addEventListener("click", e => { const a = e.target.closest(".patlink"); if (a) { e.preventDefault(); window.APP && APP.showPattern(a.dataset.pat); } });
  }
  function setActive(on) { S.active = on; if (on) { refresh(true); } else { clearTimeout(S.timer); cancelAnimationFrame(S.a3.raf); } }
  function open(opts) { if (opts) { if (opts.mode) S.mode = opts.mode; if (opts.tf) S.tf = opts.tf; if (opts.ind) opts.ind.forEach(i => S.inds.add(i)); savePrefs(); drawControls(); } }

  window.CHARTS = { init, setActive, open, analyse, patternsOf, atr, heikin, rsi, ema, sma, macd, bbands, levels, explainCandle, S };
})();
