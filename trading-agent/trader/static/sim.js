/* Training mode: a trading simulator on real past Coinbase GBP data, multiple-choice chart challenges,
   an adaptive knowledge quiz, and progress tracking (XP, levels, topic mastery, badges).
   Pretend money only. Nothing here talks to the bots or an exchange account.
   Needs lwc.js, learn.js, charts.js and quizbank.js. Exposes window.TRAIN. */
(function () {
  "use strict";
  const LW = window.LightweightCharts, C = window.CHARTS, L = window.LEARN, QB = window.QUIZBANK;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = (id, text) => L.termLink(id, text);
  const gbp = (v, d = 2) => (v < 0 ? "−" : "") + "£" + Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  const px = window.__pxReal = v => v >= 1000 ? "£" + v.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : v >= 1 ? "£" + v.toFixed(2) : v >= 0.01 ? "£" + v.toFixed(4) : "£" + (+v.toPrecision(4)).toFixed(Math.min(12, 3 - Math.floor(Math.log10(Math.abs(v) || 1e-12))));
  let PXF = null;                                        // blind-mode price formatter (index, not pounds)
  const idx = v => v >= 1000 ? v.toFixed(0) : v.toFixed(2);
  /** Rescale a window so candle `at` closes at 100: hides the coin's real price level. Percentages are unchanged. */
  function blindify(w, at) { const f = 100 / w.k[at].c; return { ...w, real: w.k, scale: f, k: w.k.map(b => ({ t: b.t, o: b.o * f, h: b.h * f, l: b.l * f, c: b.c * f, v: b.v })) }; }
  const pc = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%";
  const ukDate = (t, o) => new Date(t * 1000).toLocaleString("en-GB", { timeZone: "Europe/London", ...o });
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const UP = "#34d399", DN = "#fb7185", MUTE = "#9aa3b8";
  const COINS = ["BTC", "ETH", "SOL", "LINK", "ADA", "DOT", "LTC", "DOGE", "AAVE", "ALGO", "ATOM", "SHIB", "BCH", "UNI", "FIL", "ETC"];
  const TFS = { 900: "15m", 3600: "1h", 21600: "6h", 86400: "1d" };
  const HIST_RANGE = { 900: 60 * 86400, 3600: 400 * 86400, 21600: 1200 * 86400, 86400: 1700 * 86400 };
  const FEE = 0.006;                     // Coinbase Advanced lowest-tier taker fee, per side
  let APP = null;

  // ================================================================== progress (local + synced to the Mac)
  const LEVELS = [[0, "Novice"], [100, "Apprentice"], [300, "Chart Reader"], [600, "Pattern Spotter"], [1000, "Risk Manager"],
    [1600, "Swing Trader"], [2500, "Analyst"], [3600, "Strategist"], [5000, "Pro"]];
  const BADGES = {
    first_quiz: ["First quiz", "Finished a quiz"], perfect_quiz: ["Perfect ten", "10 out of 10 in a quiz"],
    streak10: ["On a roll", "10 right answers in a row"], first_sim: ["First run", "Finished a simulator run"],
    beat_hold: ["Beat the market", "Beat buy-and-hold in a simulator run"], disciplined: ["Disciplined", "A profitable run with a stop on every buy and no chasing"],
    chart_eye: ["Chart eye", "20 chart challenges right"], topic_master: ["Topic master", "80%+ on a topic after 10+ answers"],
    all_topics: ["All-rounder", "Answered questions in every topic"], week: ["Habit", "Trained on 7 different days"],
  };
  const blank = () => ({ v: 1, updated: 0, xp: 0, days: {}, topics: {}, wrong: {}, seen: {}, sims: [], chal: { a: 0, c: 0 }, badges: {}, run: 0, best_run: 0 });
  let P = blank(), saveT = null, toastQ = [];
  const store = { get() { try { return JSON.parse(localStorage.getItem("trainer.v1") || "null"); } catch (_) { return null; } }, set(v) { try { localStorage.setItem("trainer.v1", JSON.stringify(v)); } catch (_) {} } };
  async function loadProgress() {
    const local = store.get() || blank();
    let remote = null;
    try { const r = await fetch("progress", { cache: "no-store" }); if (r.ok) remote = await r.json(); } catch (_) {}
    P = Object.assign(blank(), remote && remote.updated > (local.updated || 0) ? remote : local);
    store.set(P);
  }
  function saveProgress() {
    P.updated = Date.now(); store.set(P);
    clearTimeout(saveT);
    saveT = setTimeout(() => fetch("progress", { method: "POST", headers: { "Content-Type": "application/json", "X-Trader": "1" }, body: JSON.stringify(P) }).catch(() => {}), 1200);
  }
  const levelOf = xp => { let i = 0; LEVELS.forEach(([t], j) => { if (xp >= t) i = j; }); return { i, name: LEVELS[i][1], from: LEVELS[i][0], to: (LEVELS[i + 1] || [LEVELS[i][0] + 2000])[0] }; };
  function addXP(n, why) {
    const before = levelOf(P.xp).i; P.xp += n;
    P.days[new Date().toISOString().slice(0, 10)] = 1;
    if (Object.keys(P.days).length >= 7) badge("week");
    const after = levelOf(P.xp);
    toast(`+${n} XP · ${why}`);
    if (after.i > before) toast(`Level up: ${after.name}!`, true);
    saveProgress();
  }
  function badge(id) { if (P.badges[id]) return; P.badges[id] = Date.now(); toast(`Badge earned: ${BADGES[id][0]}`, true); saveProgress(); }
  function answered(topic, ok, qid) {
    const t = P.topics[topic] = P.topics[topic] || { a: 0, c: 0 }; t.a++; if (ok) t.c++;
    if (qid) { P.seen[qid] = (P.seen[qid] || 0) + 1; if (ok) { if (P.wrong[qid]) P.wrong[qid] = Math.max(0, P.wrong[qid] - 1); } else P.wrong[qid] = (P.wrong[qid] || 0) + 1; }
    P.run = ok ? P.run + 1 : 0; P.best_run = Math.max(P.best_run, P.run);
    if (P.run >= 10) badge("streak10");
    if (t.a >= 10 && t.c / t.a >= 0.8) badge("topic_master");
    if (Object.keys(QB.TOPICS).every(k => P.topics[k] && P.topics[k].a)) badge("all_topics");
    saveProgress();
  }
  function toast(msg, big) {
    let box = $("tToast"); if (!box) { box = document.createElement("div"); box.id = "tToast"; document.body.appendChild(box); }
    const el = document.createElement("div"); el.className = "toast" + (big ? " big" : ""); el.textContent = msg; box.appendChild(el);
    setTimeout(() => el.classList.add("out"), big ? 2800 : 1800); setTimeout(() => el.remove(), big ? 3300 : 2300);
  }

  // ================================================================== data
  async function randomWindow(coin, tf, need = 220) {
    const now = Math.floor(Date.now() / 1000);
    for (let tries = 0; tries < 5; tries++) {
      const c = coin === "random" ? pick(COINS) : coin;
      const end = Math.floor((now - rnd(0.05, 1) * HIST_RANGE[tf]) / tf) * tf;
      try {
        const r = await fetch(`candles?coin=${c}&g=${tf}&end=${end}`, { cache: "no-store" }); if (!r.ok) throw new Error(r.status);
        const k = (await r.json()).map(x => ({ t: x[0], o: x[1], h: x[2], l: x[3], c: x[4], v: x[5] }));
        if (k.length >= need) return { coin: c, tf, k };
      } catch (_) {}
    }
    throw new Error("couldn't load past prices from Coinbase");
  }

  // ================================================================== simulator engine (pure, testable)
  function newSim(k, histN = 100, start = 1000, fee = FEE) {
    return { k, i: histN - 1, histN, start, fee, cash: start, qty: 0, cost: 0, fees: 0, trades: [], stop: null, target: null, equity: [], done: false };
  }
  const price = s => s.k[s.i].c;
  const value = s => s.cash + s.qty * price(s);
  function buy(s, frac, reason = "you") {
    const notional = Math.min(s.cash, s.cash * frac); if (notional < 1) return null;
    const p = price(s), fee = notional * s.fee, q = (notional - fee) / p;
    s.cash -= notional; s.qty += q; s.cost += notional; s.fees += fee;
    const tr = { i: s.i, side: "buy", px: p, qty: q, notional, fee, reason, stop: s.stop, target: s.target };
    s.trades.push(tr); return tr;
  }
  function sell(s, frac, reason = "you", at = null) {
    if (s.qty <= 0) return null;
    const q = frac >= 1 ? s.qty : s.qty * frac, p = at ?? price(s), gross = q * p, fee = gross * s.fee;
    const costShare = s.cost * (q / s.qty);
    s.qty -= q; s.cost -= costShare; if (s.qty < 1e-12) { s.qty = 0; s.cost = 0; }
    s.cash += gross - fee; s.fees += fee;
    const tr = { i: s.i, side: "sell", px: p, qty: q, notional: gross, fee, reason, pnl: gross - fee - costShare };
    s.trades.push(tr); return tr;
  }
  const avgEntry = s => s.qty > 0 ? s.cost / s.qty : null;          // includes the buy fee
  const stopPx = s => s.qty > 0 && s.stop ? avgEntry(s) * (1 - s.stop / 100) : null;
  const targetPx = s => s.qty > 0 && s.target ? avgEntry(s) * (1 + s.target / 100) : null;
  /** Reveal the next candle, then apply the stop/target against its range (stop first if both touched). */
  function step(s) {
    if (s.i >= s.k.length - 1) { s.done = true; return []; }
    s.i++;
    const b = s.k[s.i], out = [], sp = stopPx(s), tp = targetPx(s);
    if (s.qty > 0 && sp && b.l <= sp) out.push(sell(s, 1, "stop", Math.min(sp, b.o)));
    else if (s.qty > 0 && tp && b.h >= tp) out.push(sell(s, 1, "target", Math.max(tp, b.o)));
    s.equity.push([b.t, value(s)]);
    if (s.i >= s.k.length - 1) s.done = true;
    return out.filter(Boolean);
  }
  function report(s) {
    const k = s.k, first = k[s.histN - 1].c, last = k[s.i].c, A = C.atr(k), end = value(s);
    const ret = (end / s.start - 1) * 100, hold = ((1 - s.fee) * (1 - s.fee) * last / first - 1) * 100;
    // round trips: flat -> flat
    const rts = []; let run = null;
    const qtyAfter = []; let q = 0; s.trades.forEach(t => { q += t.side === "buy" ? t.qty : -t.qty; qtyAfter.push(q); });
    s.trades.forEach((t, j) => { if (t.side === "buy" && !run) run = { pnl: 0, i0: t.i, fees: 0 }; if (run) { run.fees += t.fee; if (t.side === "sell") run.pnl += t.pnl; if (qtyAfter[j] < 1e-12) { run.i1 = t.i; rts.push(run); run = null; } } });
    const wins = rts.filter(r => r.pnl > 0), losses = rts.filter(r => r.pnl <= 0);
    const avgW = wins.length ? wins.reduce((a, r) => a + r.pnl, 0) / wins.length : 0, avgL = losses.length ? losses.reduce((a, r) => a + r.pnl, 0) / losses.length : 0;
    let peak = s.start, mdd = 0; s.equity.forEach(([, v]) => { peak = Math.max(peak, v); mdd = Math.max(mdd, 1 - v / peak); });
    const played = Math.max(1, s.i - s.histN + 1), buys = s.trades.filter(t => t.side === "buy");
    // habits
    const habits = [];
    const chase = buys.filter(t => t.i >= 3 && A[t.i] && k[t.i].c - k[t.i - 3].c > 1.5 * A[t.i]);
    if (chase.length) habits.push({ bad: true, t: "Chasing pumps", x: `${chase.length} of your ${buys.length} buys came right after a sharp rise (more than 1.5× a normal candle's move in 3 candles). Buying after a spike often means buying near a short-term top. Try waiting for a pullback.`, lesson: "trend", g: "fomo" });
    const panic = s.trades.filter(t => t.side === "sell" && t.reason === "you" && t.i >= 3 && A[t.i] && k[t.i - 3].c - k[t.i].c > 1.5 * A[t.i] && k.slice(t.i + 1, t.i + 11).some(b => b.c > t.px + A[t.i]));
    if (panic.length) habits.push({ bad: true, t: "Panic selling", x: `${panic.length} sell${panic.length > 1 ? "s" : ""} came after a sharp drop, and the price recovered soon after. A stop-loss set in advance decides this for you, calmly.`, lesson: "risk", g: "stoploss" });
    const noStop = buys.filter(t => !t.stop);
    if (noStop.length) habits.push({ bad: true, t: "Buying without a stop-loss", x: `${noStop.length} of ${buys.length} buys had no stop-loss. Professionals decide where they're wrong before they enter.`, lesson: "risk", g: "stoploss" });
    else if (buys.length) habits.push({ bad: false, t: "Stops on every buy", x: "Every buy had a stop-loss. That's the single most important habit." });
    const perHundred = s.trades.length / played * 100;
    if (perHundred > 12) habits.push({ bad: true, t: "Overtrading", x: `${s.trades.length} trades in ${played} candles. Fees came to ${gbp(s.fees)}, ${(s.fees / s.start * 100).toFixed(1)}% of the account.`, lesson: "fees", g: "overtrading" });
    if (wins.length >= 2 && losses.length >= 2 && avgW < Math.abs(avgL) * 0.6) habits.push({ bad: true, t: "Small wins, big losses", x: `Your average win was ${gbp(avgW)} but your average loss was ${gbp(Math.abs(avgL))}. Letting winners run and cutting losers quickly (a higher reward-to-risk) fixes this.`, lesson: "risk", g: "rr" });
    const gross = s.trades.filter(t => t.side === "sell").reduce((a, t) => a + t.pnl + t.fee, 0);
    if (s.fees > 5 && gross > 0 && s.fees > 0.5 * gross) habits.push({ bad: true, t: "Fees ate the profit", x: `Fees (${gbp(s.fees)}) were more than half of what your trades made before fees.`, lesson: "fees", g: "fees" });
    if (!s.trades.length) habits.push({ bad: false, t: "Sat on your hands", x: "No trades. Sometimes that's the right call, but the simulator only teaches when you act. Try a buy with a stop next time." });
    // score: return vs holding, plus discipline
    let score = 50 + Math.max(-25, Math.min(25, (ret - hold) * 2)) + Math.max(-10, Math.min(10, ret));
    score += buys.length && !noStop.length ? 10 : 0; score -= chase.length * 3 + panic.length * 4 + (perHundred > 12 ? 8 : 0);
    score = Math.round(Math.max(0, Math.min(100, score)));
    return { end, ret, hold, trades: s.trades.length, rts: rts.length, wins: wins.length, winRate: rts.length ? wins.length / rts.length : null, avgW, avgL, fees: s.fees, mdd: mdd * 100, played, habits, score, beatHold: ret > hold, chase: chase.length, panic: panic.length, noStop: noStop.length };
  }

  // ================================================================== shared chart
  function makeChart(el, { blind = false, tf = 3600, rsi = false } = {}) {
    const chart = LW.createChart(el, {
      autoSize: true, layout: { background: { type: "solid", color: "transparent" }, textColor: MUTE, fontSize: 11, attributionLogo: false, panes: { separatorColor: "rgba(255,255,255,.1)" } },
      grid: { vertLines: { color: "rgba(255,255,255,.05)" }, horzLines: { color: "rgba(255,255,255,.05)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,.12)" }, timeScale: { borderColor: "rgba(255,255,255,.12)", timeVisible: tf < 86400, rightOffset: 6 },
      crosshair: { mode: 0 }, handleScroll: true, handleScale: true,
      localization: { locale: "en-GB", timeFormatter: t => blind ? "" : ukDate(t, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
    });
    if (blind) chart.timeScale().applyOptions({ tickMarkFormatter: () => "" });
    else chart.timeScale().applyOptions({ tickMarkFormatter: (t, type) => type >= 3 ? ukDate(t, { hour: "2-digit", minute: "2-digit" }) : ukDate(t, { day: "numeric", month: "short" }) });
    const main = chart.addSeries(LW.CandlestickSeries, { upColor: UP, downColor: DN, borderVisible: false, wickUpColor: UP, wickDownColor: DN, priceFormat: { type: "custom", formatter: blind ? idx : px } });
    const e9 = chart.addSeries(LW.LineSeries, { color: "#fbbf24", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const e21 = chart.addSeries(LW.LineSeries, { color: "#60a5fa", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const vol = chart.addSeries(LW.HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    let r = null;
    if (rsi) { r = chart.addSeries(LW.LineSeries, { color: "#c084fc", lineWidth: 1.5, priceLineVisible: false, priceFormat: { type: "price", precision: 0, minMove: 1 } }, 1);
      r.createPriceLine({ price: 70, color: "rgba(251,113,133,.6)", lineStyle: 2, axisLabelVisible: false }); r.createPriceLine({ price: 30, color: "rgba(52,211,153,.6)", lineStyle: 2, axisLabelVisible: false }); chart.panes()[0].setStretchFactor(3); }
    const markers = LW.createSeriesMarkers(main, []);
    const api = {
      chart, main, markers, lines: [],
      set(k) {
        const lp = k.length ? k[k.length - 1].c : 1;
        main.applyOptions({ priceFormat: { type: "custom", formatter: blind ? idx : px, minMove: Math.pow(10, Math.floor(Math.log10(lp || 1)) - 4) } });
        main.setData(k.map(b => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
        const c = k.map(b => b.c), E9 = C.ema(c, 9), E21 = C.ema(c, 21);
        e9.setData(k.map((b, i) => E9[i] == null ? { time: b.t } : { time: b.t, value: E9[i] }));
        e21.setData(k.map((b, i) => E21[i] == null ? { time: b.t } : { time: b.t, value: E21[i] }));
        vol.setData(k.map(b => ({ time: b.t, value: b.v, color: b.c >= b.o ? "rgba(52,211,153,.3)" : "rgba(251,113,133,.3)" })));
        if (r) { const R = C.rsi(c); r.setData(k.map((b, i) => R[i] == null ? { time: b.t } : { time: b.t, value: R[i] })); }
      },
      line(price, color, title) { const l = main.createPriceLine({ price, color, lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title }); api.lines.push(l); return l; },
      clearLines() { api.lines.forEach(l => main.removePriceLine(l)); api.lines = []; },
      fit(n = 90) { const len = main.data().length; chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, len - n), to: len + 4 }); },
      remove() { chart.remove(); },
    };
    return api;
  }

  // ================================================================== SIMULATOR UI
  const SIM = { s: null, meta: null, ch: null, timer: null, speed: 0, blind: true, coach: true, stopOn: true, stopPct: 3, tgtOn: true, tgtPct: 6 };
  function simSetup(root) {
    clearInterval(SIM.timer); if (SIM.ch) { SIM.ch.remove(); SIM.ch = null; }
    const pr = P.sims.slice(-1)[0];
    root.innerHTML = `
    <section class="card span train-hero"><h2>Trading simulator</h2>
      <p style="margin-top:0">Trade a real stretch of past Coinbase prices with a pretend <b>£1,000</b>, one candle at a time. You only see the past; the future is revealed as you play. Fees are Coinbase's 0.6% each way, and you can only buy and sell coins you hold (UK rules). At the end you get a report card and coaching on your habits.</p>
      <div class="grid2" style="margin-top:6px">
        <div><label>Coin</label><div class="seg" id="sCoin">${["random", ...COINS].map(c => `<button class="chip${c === "random" ? " on" : ""}" data-v="${c}">${c === "random" ? "Mystery" : c}</button>`).join("")}</div></div>
        <div><label>Candle size</label><div class="seg" id="sTf">${Object.entries(TFS).map(([g, n]) => `<button class="chip${+g === 3600 ? " on" : ""}" data-v="${g}">${n}</button>`).join("")}</div></div>
      </div>
      <div class="set"><div class="sl"><span>Blind mode (hide the date and coin until the end)</span><button class="switch" role="switch" aria-checked="true" id="sBlind"></button></div><div class="sh">Stops you recognising a famous crash or rally and trading on memory.</div></div>
      <div class="set"><div class="sl"><span>Coach hints while you play</span><button class="switch" role="switch" aria-checked="true" id="sCoach"></button></div><div class="sh">Shows a live one-line read of the chart (trend, RSI, patterns) under the price.</div></div>
      <div class="lbtns"><button class="btn primary big" id="sGo">Start a run</button></div>
      ${pr ? `<p class="note">Last run: ${esc(pr.coin)} ${esc(TFS[pr.tf])}, you ${pc(pr.ret)} vs holding ${pc(pr.hold)}, score ${pr.score}/100.</p>` : ""}
    </section>
    <section class="card span"><h2>How it works</h2><ol class="howto">
      <li>You see 100 past candles. Read the chart: trend, levels, patterns.</li>
      <li>Press <b>Play</b> (or <b>Step</b> one candle at a time). Buy with 25%, 50% or 100% of your cash.</li>
      <li>Set a <b>stop-loss</b> and <b>take-profit</b> before you buy; they trigger automatically as candles form.</li>
      <li>After about 200 candles (or when you press Finish) you get your result against simply buying and holding, plus coaching.</li></ol></section>`;
    const segPick = id => root.querySelectorAll(`#${id} .chip`).forEach(b => b.onclick = () => { root.querySelectorAll(`#${id} .chip`).forEach(x => x.classList.toggle("on", x === b)); });
    segPick("sCoin"); segPick("sTf");
    ["sBlind", "sCoach"].forEach(id => root.querySelector("#" + id).onclick = e => e.target.setAttribute("aria-checked", String(e.target.getAttribute("aria-checked") !== "true")));
    root.querySelector("#sGo").onclick = async () => {
      const coin = root.querySelector("#sCoin .on").dataset.v, tf = +root.querySelector("#sTf .on").dataset.v;
      SIM.blind = root.querySelector("#sBlind").getAttribute("aria-checked") === "true"; SIM.coach = root.querySelector("#sCoach").getAttribute("aria-checked") === "true";
      const b = root.querySelector("#sGo"); b.disabled = true; b.textContent = "Loading past prices…";
      try { const w = await randomWindow(coin, tf, 240); SIM.meta = SIM.blind ? blindify(w, 99) : w; simStart(root); }
      catch (e) { b.disabled = false; b.textContent = "Start a run"; toast("Couldn't load prices: " + e.message); }
    };
  }
  function simStart(root) {
    const { k, tf, coin } = SIM.meta;
    SIM.s = newSim(k, 100, 1000);
    root.innerHTML = `
    <section class="card span sim">
      <div class="simtop"><div><b>${SIM.blind ? "Mystery coin" : esc(coin) + "/GBP"}</b> <span class="mute">· ${TFS[tf]} candles${SIM.blind ? " · prices shown as an index (start = 100)" : " · " + ukDate(k[0].t, { day: "numeric", month: "short", year: "numeric" })}</span></div><div class="mute" id="sProg"></div></div>
      <div class="chartwrap simchart"><div id="sChart" style="position:absolute;inset:0"></div></div>
      <div class="levels" id="sKey"></div>
      <div class="coach" id="sCoachLine" ${SIM.coach ? "" : "hidden"}></div>
      <div class="simbar">
        <div class="seg"><button class="btn" id="sPlay">▶ Play</button><button class="btn" id="sStep">Step ›</button>
          <select id="sSpeed" aria-label="Speed"><option value="1200">1×</option><option value="600">2×</option><option value="250">4×</option></select></div>
        <div class="seg"><button class="btn buy" data-b="0.25">Buy 25%</button><button class="btn buy" data-b="0.5">Buy 50%</button><button class="btn buy" data-b="1">Buy all</button></div>
        <div class="seg"><button class="btn sell" data-s="0.5">Sell half</button><button class="btn sell" data-s="1">Sell all</button><button class="btn" id="sEnd">Finish</button></div>
      </div>
      <div class="grid2 simrisk">
        <div class="set"><div class="sl"><span>Stop-loss</span><button class="switch" role="switch" aria-checked="${SIM.stopOn}" id="sStopOn"></button></div><input type="range" id="sStop" min="0.5" max="15" step="0.5" value="${SIM.stopPct}"><div class="sh" id="sStopTxt"></div></div>
        <div class="set"><div class="sl"><span>Take-profit</span><button class="switch" role="switch" aria-checked="${SIM.tgtOn}" id="sTgtOn"></button></div><input type="range" id="sTgt" min="0.5" max="30" step="0.5" value="${SIM.tgtPct}"><div class="sh" id="sTgtTxt"></div></div>
      </div>
      <div class="stats" id="sAcct"></div>
      <div class="feed" id="sLog"></div>
      <p class="note">Keyboard: <b>space</b> play/pause, <b>→</b> step, <b>B</b> buy 50%, <b>S</b> sell all.</p>
    </section>`;
    SIM.ch = makeChart($("sChart"), { blind: SIM.blind, tf });
    SIM.px = SIM.blind ? idx : px;
    SIM.ch.set(k.slice(0, SIM.s.i + 1)); SIM.ch.fit(90);
    const risk = () => { SIM.stopPct = +$("sStop").value; SIM.tgtPct = +$("sTgt").value; SIM.stopOn = $("sStopOn").getAttribute("aria-checked") === "true"; SIM.tgtOn = $("sTgtOn").getAttribute("aria-checked") === "true";
      SIM.s.stop = SIM.stopOn ? SIM.stopPct : null; SIM.s.target = SIM.tgtOn ? SIM.tgtPct : null;
      const beOk = L.breakeven(SIM.stopPct, SIM.tgtPct / SIM.stopPct, 1.25);
      $("sStopTxt").textContent = SIM.stopOn ? `Sell automatically if it falls ${SIM.stopPct}% below your average buy price.` : "Off: nothing limits your loss.";
      $("sTgtTxt").textContent = SIM.tgtOn ? `Sell automatically at +${SIM.tgtPct}%. With the stop, you'd need to win ${beOk.impossible ? "(impossible after fees)" : Math.round(beOk.p * 100) + "% of trades"} to break even.` : "Off: you decide when to take profit.";
      simDraw(); };
    ["sStop", "sTgt"].forEach(id => $(id).addEventListener("input", risk));
    ["sStopOn", "sTgtOn"].forEach(id => $(id).onclick = e => { e.target.setAttribute("aria-checked", String(e.target.getAttribute("aria-checked") !== "true")); risk(); });
    $("sPlay").onclick = () => simPlay(!SIM.timer);
    $("sStep").onclick = () => { simPlay(false); simStep(); };
    $("sSpeed").onchange = () => { if (SIM.timer) { simPlay(false); simPlay(true); } };
    root.querySelectorAll("[data-b]").forEach(b => b.onclick = () => { const t = buy(SIM.s, +b.dataset.b); if (t) simLog(t); simDraw(); });
    root.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { const t = sell(SIM.s, +b.dataset.s); if (t) simLog(t); simDraw(); });
    $("sEnd").onclick = () => simFinish(root);
    risk();
  }
  function simPlay(on) {
    clearInterval(SIM.timer); SIM.timer = null; if ($("sPlay")) $("sPlay").textContent = on ? "❚❚ Pause" : "▶ Play";
    if (on) SIM.timer = setInterval(simStep, +$("sSpeed").value);
  }
  function simStep() {
    const s = SIM.s; if (!s || s.done) return;
    const trs = step(s); const b = s.k[s.i];
    SIM.ch.set(s.k.slice(0, s.i + 1));
    trs.forEach(simLog); simDraw();
    if (s.done) simFinish(document.getElementById("tab-sim"));
  }
  function simLog(t) {
    const s = SIM.s, why = t.reason === "stop" ? "stop-loss hit" : t.reason === "target" ? "take-profit hit" : "you";
    const el = document.createElement("div"); el.className = "row new";
    el.innerHTML = `<div><span class="tag ${t.side}">${t.side.toUpperCase()}</span> ${gbp(t.notional)} at ${SIM.px(t.px)} <span class="faint">(${why}, fee ${gbp(t.fee)})</span>${t.pnl != null ? ` <b class="${t.pnl >= 0 ? "up" : "down"}">${t.pnl >= 0 ? "+" : ""}${gbp(t.pnl)}</b>` : ""}</div>`;
    $("sLog").prepend(el);
  }
  function simDraw() {
    const s = SIM.s; if (!s || !SIM.ch) return;
    const v = value(s), played = s.i - s.histN + 1, total = s.k.length - s.histN, first = s.k[s.histN - 1].c, hold = ((1 - s.fee) ** 2 * price(s) / first - 1) * 100;
    $("sProg").textContent = `Candle ${played} of ${total}`;
    $("sAcct").innerHTML = `<div class="stat"><span>Account</span><b>${gbp(v)}</b></div><div class="stat"><span>Cash</span><b>${gbp(s.cash)}</b></div>
      <div class="stat"><span>In coin</span><b>${gbp(s.qty * price(s))}</b></div><div class="stat"><span>Your return</span><b class="${v >= s.start ? "up" : "down"}">${pc((v / s.start - 1) * 100)}</b></div><div class="stat"><span>If you'd just held</span><b>${pc(hold)}</b></div><div class="stat"><span>Fees</span><b>${gbp(s.fees)}</b></div>`;
    SIM.ch.clearLines();
    const ae = avgEntry(s), sp = stopPx(s), tp = targetPx(s);
    if (ae) SIM.ch.line(ae, "rgba(255,255,255,.65)", "");
    if (sp) SIM.ch.line(sp, DN, ""); if (tp) SIM.ch.line(tp, UP, "");
    $("sKey").innerHTML = (ae ? `<span style="color:#e5e7eb"><i></i>Your average buy ${SIM.px(ae)}</span>${sp ? `<span class="down"><i></i>Stop ${SIM.px(sp)}</span>` : ""}${tp ? `<span class="up"><i></i>Target ${SIM.px(tp)}</span>` : ""}` : "")
      + (s.trades.length ? `<span class="up">▲ Your buys</span><span class="down">▼ Your sells</span>` : "");
    SIM.ch.markers.setMarkers(s.trades.map(t => ({ time: s.k[t.i].t, position: t.side === "buy" ? "belowBar" : "aboveBar", shape: t.side === "buy" ? "arrowUp" : "arrowDown", color: t.side === "buy" ? "#22c55e" : "#f43f5e", text: "" })));
    if (SIM.coach && $("sCoachLine")) { const an = C.analyse(s.k.slice(0, s.i + 1), SIM.meta.tf); $("sCoachLine").innerHTML = "Coach: " + an.headline.replace(/^\w+ on the/, SIM.blind ? "The" : "$&"); }
  }
  function simFinish(root) {
    simPlay(false); const s = SIM.s; if (!s || s.finished) return; s.finished = true;
    const r = report(s), { coin, tf, k } = SIM.meta;
    P.sims.push({ ts: Date.now(), coin, tf, ret: +r.ret.toFixed(2), hold: +r.hold.toFixed(2), score: r.score, trades: r.trades }); P.sims = P.sims.slice(-50);
    let xp = 20 + Math.round(r.score / 5); if (r.beatHold && r.trades) xp += 25; if (r.ret > 0) xp += 10;
    badge("first_sim"); if (r.beatHold && r.trades) badge("beat_hold"); if (r.ret > 0 && r.trades && !r.noStop && !r.chase) badge("disciplined");
    addXP(xp, "simulator run");
    const box = document.createElement("section"); box.className = "card span report";
    box.innerHTML = `<h2>Report card</h2>
      <div class="scorebig ${r.score >= 60 ? "up" : r.score < 40 ? "down" : ""}">${r.score}<small>/100</small></div>
      <p>This was <b>${esc(coin)}/GBP</b>${SIM.meta.real ? ` (real prices ${px(SIM.meta.real[s.histN - 1].c)} → ${px(SIM.meta.real[s.i].c)}; the chart showed them as an index starting at 100)` : ""}, ${TFS[tf]} candles, ${ukDate(k[s.histN - 1].t, { day: "numeric", month: "short", year: "numeric" })} to ${ukDate(k[s.i].t, { day: "numeric", month: "short", year: "numeric" })}.
      You finished on <b>${gbp(r.end)}</b> (${pc(r.ret)}). Simply buying at the start and holding would have given <b>${pc(r.hold)}</b>, so you ${r.beatHold ? "<b class='up'>beat</b>" : "<b class='down'>trailed</b>"} the market by ${Math.abs(r.ret - r.hold).toFixed(1)} points.</p>
      <div class="stats"><div class="stat"><span>Trades</span><b>${r.trades}</b></div><div class="stat"><span>Win rate</span><b>${r.winRate == null ? "—" : Math.round(r.winRate * 100) + "%"}</b></div>
        <div class="stat"><span>Avg win / loss</span><b>${gbp(r.avgW, 0)} / ${gbp(r.avgL, 0)}</b></div><div class="stat"><span>Fees paid</span><b>${gbp(r.fees)}</b></div><div class="stat"><span>Worst fall</span><b>${r.mdd.toFixed(1)}%</b></div></div>
      <h2 style="margin-top:16px">Coaching</h2>
      ${r.habits.map(h => `<div class="habit ${h.bad ? "bad" : "good"}"><b>${h.bad ? "⚠" : "✓"} ${esc(h.t)}</b><div>${esc(h.x)}${h.g ? ` ${T(h.g, "What's this?")}` : ""}</div></div>`).join("")}
      <p class="note">One run is mostly luck. What matters is the habits: stops on every trade, no chasing, few trades with good reward-to-risk. Do a few runs and watch the coaching change.</p>
      <div class="lbtns"><button class="btn primary" id="sAgain">New run</button><button class="btn" id="sQuiz">Quiz me on this</button></div>`;
    root.prepend(box); box.scrollIntoView({ behavior: "smooth" });
    box.querySelector("#sAgain").onclick = () => simSetup(root);
    box.querySelector("#sQuiz").onclick = () => { QUIZ.topic = r.habits.some(h => h.lesson === "fees") ? "fees" : "risk"; APP.showTab("quiz"); };
  }
  document.addEventListener("keydown", e => {
    if (!SIM.s || SIM.s.finished || !$("sChart") || document.body.dataset.tab !== "sim" || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === " ") { e.preventDefault(); simPlay(!SIM.timer); } else if (e.key === "ArrowRight") { simPlay(false); simStep(); }
    else if (e.key.toLowerCase() === "b") { const t = buy(SIM.s, 0.5); if (t) simLog(t); simDraw(); } else if (e.key.toLowerCase() === "s") { const t = sell(SIM.s, 1); if (t) simLog(t); simDraw(); }
  });

  // ================================================================== CHART CHALLENGES
  const CH = { ch: null, w: null, q: null, n: 0, right: 0 };
  function genQuestion(w, only = null, fixedCut = null) {
    const { k, tf } = w, types = only ? [only] : shuffle(["trend", "pattern", "rsi", "support", "next", "fees", "rr"]), px = w.scale ? idx : window.__pxReal;
    const A = C.atr(k);
    for (const type of types) {
      if (type === "pattern") {
        const pats = C.patternsOf(k, A), idx = Object.keys(pats).map(Number).filter(i => i >= 60 && i <= k.length - 2 && pats[i] !== "inside");
        if (!idx.length) continue;
        const i = fixedCut != null && idx.includes(fixedCut) ? fixedCut : pick(idx), p = L.PATTERNS.find(x => x.id === pats[i]), others = shuffle(L.PATTERNS.filter(x => x.id !== p.id)).slice(0, 3), opts = shuffle([p, ...others]);
        return { type, topic: "candles", cut: i, q: "Which candle pattern has just formed on the last candle(s)?", o: opts.map(x => x.name), a: opts.indexOf(p),
          x: `It's a <b>${esc(p.name)}</b>. How to spot it: ${p.spot.map(esc).join("; ")}. ${esc(p.means)}`, g: p.terms[0], mark: { i, text: p.name } };
      }
      const cut = fixedCut != null ? fixedCut : Math.floor(rnd(90, k.length - 25)), kk = k.slice(0, cut + 1), an = C.analyse(kk, tf), last = kk[cut].c;
      if (type === "trend") {
        const lab = { up: "Up-trend", down: "Down-trend", sideways: "Sideways / no clear trend" }, o = ["Up-trend", "Down-trend", "Sideways / no clear trend"];
        return { type, topic: "trend", cut, q: "Looking at the whole chart, what best describes the trend right now?", o, a: o.indexOf(lab[an.trend]),
          x: an.cards[0].body.replace(/<div class="how">.*$/, "") + " The yellow line is the EMA 9 and the blue one the EMA 21." , g: "trend" };
      }
      if (type === "rsi" && an.rsi != null) {
        const r = an.rsi, zone = r >= 70 ? 0 : r <= 30 ? 1 : r > 50 ? 2 : 3;
        const o = ["Overbought (above 70)", "Oversold (below 30)", "Neutral, leaning bullish (50–70)", "Neutral, leaning bearish (30–50)"];
        return { type, topic: "indicators", cut, rsi: true, q: "The purple line in the lower panel is RSI(14). Which zone is it in on the last candle?", o, a: zone,
          x: `RSI reads <b>${r.toFixed(0)}</b>. ${zone === 0 ? "Overbought: a fast rise. In strong up-trends it can stay high; it's a warning not to chase." : zone === 1 ? "Oversold: a fast fall. Bounces are common but not guaranteed in a down-trend." : zone === 2 ? "Above 50: recent rises outweigh falls." : "Below 50: recent falls outweigh rises."}`, g: "rsi" };
      }
      if (type === "support" && an.lv.sup.length) {
        const s = an.lv.sup[0].p, res = an.lv.res[0] ? an.lv.res[0].p : last * 1.04, gap = Math.max(an.atr || last * 0.01, last * 0.006);
        const cands = [s, res, last + (res - last) * 0.5 + gap * 0.2, s - 2.5 * gap, last - (last - s) * 0.4].filter((v, i, a) => v > 0 && a.findIndex(x => Math.abs(x - v) / v < 0.003) === i);
        if (cands.length < 4) continue;
        const o = shuffle(cands.slice(0, 4));
        return { type, topic: "levels", cut, q: `The last price is ${px(last)}. Which price is the nearest support level?`, o: o.map(px), a: o.indexOf(s),
          x: `Support is at about <b>${px(s)}</b>: price has turned up there ${an.lv.sup[0].n} time${an.lv.sup[0].n > 1 ? "s" : ""}. Levels above the current price are resistance, not support.`, g: "support", line: { p: s, t: "support" }, line2: an.lv.res[0] ? { p: an.lv.res[0].p, t: "resistance" } : null };
      }
      if (type === "rr" && an.lv.sup.length && an.lv.res.length) {
        const s = an.lv.sup[0].p * 0.997, rgt = an.lv.res[0].p, rr = (rgt - last) / (last - s);
        if (!(rr > 0.2 && rr < 8)) continue;
        const vals = [rr, rr * 2.2 + 0.4, Math.max(0.1, rr / 2.5), rr + 1.5].map(v => Math.round(v * 10) / 10), uniq = [...new Set(vals)];
        if (uniq.length < 4) continue;
        const o = shuffle(uniq);
        return { type, topic: "levels", cut, q: `You buy at ${px(last)} with a stop just under support (${px(s)}) and a target at resistance (${px(rgt)}). What's the reward-to-risk, before fees?`, o: o.map(v => v.toFixed(1) + " : 1"), a: o.indexOf(Math.round(rr * 10) / 10),
          x: `Reward ${px(rgt - last)} ÷ risk ${px(last - s)} = <b>${rr.toFixed(1)} : 1</b>. ${rr >= 2 ? "Decent: you can be wrong more often than right." : "Low: you'd need to win most of the time, especially after ~1.2% fees."}`, g: "rr", line: { p: s, t: "stop" }, line2: { p: rgt, t: "target" } };
      }
      if (type === "fees") {
        const j = Math.min(k.length - 1, cut + Math.floor(rnd(4, 20))), b = k[j].c, net = ((1 - FEE) ** 2 * b / last - 1) * 100, gross = (b / last - 1) * 100;
        const vals = [net, gross, gross + 1.2, -net].map(v => Math.round(v * 10) / 10), uniq = [...new Set(vals)];
        if (uniq.length < 4 || Math.abs(gross) < 0.3) continue;
        const o = shuffle(uniq);
        return { type, topic: "fees", cut, q: `You bought at ${px(last)} and sold later at ${px(b)} (a ${pc(gross)} move). With Coinbase's 0.6% fee on the buy and the sell, what was your result?`, o: o.map(v => pc(v, 1)), a: o.indexOf(Math.round(net * 10) / 10),
          x: `Fees take about 1.2% in total: ${pc(gross)} before fees became <b>${pc(net)}</b> after. ${gross > 0 && net < 0 ? "A winning move turned into a loss because of fees." : ""}`, g: "fees" };
      }
      if (type === "next") {
        const H = 15, j = Math.min(k.length - 1, cut + H), ch = (k[j].c / last - 1) * 100, band = Math.max(0.8, Math.round((an.atrPct || 1) * 2 * 10) / 10);
        const o = [`Up more than ${band}%`, `Down more than ${band}%`, `Stayed within ±${band}%`], a = ch > band ? 0 : ch < -band ? 1 : 2;
        return { type, topic: "basics", cut, reveal: j, q: `What did the price do over the next ${H} candles?`, o, a,
          x: `It went ${pc(ch)}. The chart read was "${an.headline.replace(/<[^>]+>/g, "")}". Even professionals are right only a little over half the time on questions like this. That's why stops and sizing matter more than predictions.`, g: "edge" };
      }
    }
    return null;
  }
  async function chalNext(root) {
    root.querySelector("#cQ").innerHTML = `<p class="mute">Loading a past chart…</p>`;
    try {
      if (!CH.w || CH.used >= 3) { CH.w = await randomWindow("random", pick([900, 3600, 3600, 21600, 86400]), 220); CH.used = 0; }
      CH.used++;
      const raw = genQuestion(CH.w); if (!raw) { CH.w = null; return chalNext(root); }
      // regenerate on an index-scaled copy so price-based options don't reveal the coin
      const bw = blindify(CH.w, raw.cut); let q = null;
      for (let n = 0; n < 12 && !q; n++) { const t = genQuestion(bw, raw.type, raw.cut); if (t) q = t; }
      CH.view = q ? bw : CH.w; CH.q = q || raw; chalShow(root);
    } catch (e) { root.querySelector("#cQ").innerHTML = `<div class="banner show">${esc(e.message)}</div><button class="btn" id="cRetry">Try again</button>`; root.querySelector("#cRetry").onclick = () => chalNext(root); }
  }
  function chalShow(root) {
    const q = CH.q, { k, tf } = CH.view;
    if (CH.ch) CH.ch.remove();
    CH.ch = makeChart(root.querySelector("#cChartBox"), { blind: !!CH.view.scale, tf, rsi: !!q.rsi });
    CH.ch.set(k.slice(0, q.cut + 1)); CH.ch.fit(q.type === "pattern" ? 50 : 110);
    root.querySelector("#cKey").innerHTML = "";
    root.querySelector("#cQ").innerHTML = `<div class="qmeta">${TFS[tf]} candles · ${esc(QB.TOPICS[q.topic])}</div><p class="qtext">${esc(q.q)}</p>
      <div class="qopts col">${q.o.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join("")}</div><div class="qfb"></div>`;
    root.querySelectorAll("#cQ .opt").forEach(b => b.onclick = () => chalAnswer(root, +b.dataset.i));
  }
  function chalAnswer(root, i) {
    const q = CH.q, ok = i === q.a, { k } = CH.view;
    root.querySelectorAll("#cQ .opt").forEach(b => { b.disabled = true; const j = +b.dataset.i; if (j === q.a) b.classList.add("right"); else if (j === i) b.classList.add("wrong"); });
    CH.n++; if (ok) CH.right++; P.chal.a++; if (ok) P.chal.c++;
    answered(q.topic, ok, null); addXP(ok ? (q.type === "next" ? 10 : 15) : 2, ok ? "chart challenge" : "for trying");
    if (P.chal.c >= 20) badge("chart_eye");
    const lc = t => t === "support" || t === "target" ? UP : DN;
    if (q.line) CH.ch.line(q.line.p, lc(q.line.t), "");
    if (q.line2) CH.ch.line(q.line2.p, lc(q.line2.t), "");
    const cap = t => t[0].toUpperCase() + t.slice(1), keyTxt = [q.line, q.line2].filter(Boolean).map(l => `<span class="${lc(l.t) === UP ? "up" : "down"}"><i></i>${cap(l.t)} ${CH.view.scale ? idx(l.p) : px(l.p)}</span>`);
    if (q.mark) { CH.ch.markers.setMarkers([{ time: k[q.mark.i].t, position: "aboveBar", shape: "arrowDown", color: "#fbbf24", text: "" }]); keyTxt.push(`<span style="color:#fbbf24">▼ ${esc(q.mark.text)}</span>`); }
    if (q.reveal) { let j = q.cut; const t = setInterval(() => { j++; CH.ch.set(k.slice(0, j + 1)); CH.ch.fit(110); if (j >= q.reveal) clearInterval(t); }, 120); CH.ch.line(k[q.cut].c, "rgba(255,255,255,.65)", ""); keyTxt.push(`<span style="color:#e5e7eb"><i></i>Price when the question was asked</span>`); }
    root.querySelector("#cKey").innerHTML = keyTxt.join("");
    root.querySelector("#cQ .qfb").innerHTML = `<div class="tapinfo">${ok ? "<b class='up'>Correct.</b> " : "<b class='down'>Not this time.</b> "}${q.x} ${q.g ? T(q.g, "Learn the term") : ""}
      <div class="faint" style="margin-top:6px">This was ${esc(CH.w.coin)}/GBP around ${ukDate(k[q.cut].t, { day: "numeric", month: "short", year: "numeric" })}.</div></div>
      <button class="btn primary" id="cNext">Next challenge</button>`;
    root.querySelector("#cNext").onclick = () => chalNext(root);
    root.querySelector("#cScore").textContent = `This session: ${CH.right} of ${CH.n} · all time ${P.chal.c} of ${P.chal.a}`;
  }
  function chalInit(root) {
    root.innerHTML = `<section class="card span train-hero"><h2>Chart challenges</h2>
      <p style="margin-top:0">Multiple-choice questions on real past Coinbase charts. The coin and date are hidden until you answer, and prices are shown as an index (the last candle = 100), so you have to read the chart, not remember it. Questions cover trends, candle patterns, RSI, support and resistance, reward-to-risk, fees, and what happened next.</p>
      <div class="note" id="cScore"></div></section>
      <section class="card span"><div class="chartwrap chalchart" style="margin-top:0"><div id="cChartBox" style="position:absolute;inset:0"></div></div><div class="levels" id="cKey"></div><div id="cQ"></div></section>`;
    chalNext(root);
  }

  // ================================================================== KNOWLEDGE QUIZ
  const QUIZ = { topic: "smart", level: 0, len: 10, list: [], i: 0, right: 0, res: [] };
  function pickQuestions(topic, level, n) {
    let pool = QB.BANK.filter(q => (topic === "smart" || topic === "mistakes" || q.t === topic) && (!level || q.l === level));
    if (topic === "mistakes") pool = pool.filter(q => P.wrong[q.id] > 0);
    const lvl = levelOf(P.xp).i;
    const w = q => { const t = P.topics[q.t], m = t && t.a ? t.c / t.a : 0.5; return 1 + 4 * (P.wrong[q.id] || 0) + (1 - m) * 2 + (P.seen[q.id] ? 0 : 1.5) + (q.l <= 1 + Math.floor(lvl / 2) ? 1 : 0); };
    const out = [];
    if (topic === "smart") {   // up to 30% of the quiz goes to past mistakes, most-missed first
      const miss = shuffle(pool.filter(q => P.wrong[q.id] > 0)).sort((x, y) => P.wrong[y.id] - P.wrong[x.id]);
      out.push(...miss.slice(0, Math.ceil(n * 0.3)));
    }
    const left = pool.filter(q => !out.includes(q));
    while (out.length < n && left.length) { const tot = left.reduce((a, q) => a + w(q), 0); let r = Math.random() * tot, j = 0; for (; j < left.length; j++) { r -= w(left[j]); if (r <= 0) break; } out.push(left.splice(Math.min(j, left.length - 1), 1)[0]); }
    return out;
  }
  function quizSetup(root) {
    const nWrong = Object.values(P.wrong).filter(v => v > 0).length;
    root.innerHTML = `<section class="card span train-hero"><h2>Knowledge quiz</h2>
      <p style="margin-top:0">${QB.BANK.length} questions across ${Object.keys(QB.TOPICS).length} topics, from beginner to advanced. <b>Smart mix</b> favours your weakest topics and brings back questions you got wrong until they stick.</p>
      <label>Topic</label><div class="seg" id="qTopic"><button class="chip${QUIZ.topic === "smart" ? " on" : ""}" data-v="smart">Smart mix</button>${nWrong ? `<button class="chip${QUIZ.topic === "mistakes" ? " on" : ""}" data-v="mistakes">My mistakes (${nWrong})</button>` : ""}${Object.entries(QB.TOPICS).map(([k, v]) => `<button class="chip${QUIZ.topic === k ? " on" : ""}" data-v="${k}">${esc(v)}</button>`).join("")}</div>
      <label>Level</label><div class="seg" id="qLevel">${[[0, "All"], [1, "Beginner"], [2, "Intermediate"], [3, "Advanced"]].map(([v, n]) => `<button class="chip${QUIZ.level === v ? " on" : ""}" data-v="${v}">${n}</button>`).join("")}</div>
      <label>Length</label><div class="seg" id="qLen">${[5, 10, 20].map(v => `<button class="chip${QUIZ.len === v ? " on" : ""}" data-v="${v}">${v} questions</button>`).join("")}</div>
      <div class="lbtns"><button class="btn primary big" id="qGo">Start quiz</button></div></section>`;
    const seg = (id, key, num) => root.querySelectorAll(`#${id} .chip`).forEach(b => b.onclick = () => { QUIZ[key] = num ? +b.dataset.v : b.dataset.v; root.querySelectorAll(`#${id} .chip`).forEach(x => x.classList.toggle("on", x === b)); });
    seg("qTopic", "topic"); seg("qLevel", "level", 1); seg("qLen", "len", 1);
    root.querySelector("#qGo").onclick = () => { QUIZ.list = pickQuestions(QUIZ.topic, QUIZ.level, QUIZ.len); if (!QUIZ.list.length) { toast("No questions match that choice."); return; } QUIZ.i = 0; QUIZ.right = 0; QUIZ.res = []; quizShow(root); };
  }
  function quizShow(root) {
    const q = QUIZ.list[QUIZ.i], order = shuffle(q.o.map((o, i) => i));
    root.innerHTML = `<section class="card span quiz"><div class="qbar"><i style="width:${QUIZ.i / QUIZ.list.length * 100}%"></i></div>
      <div class="qmeta">Question ${QUIZ.i + 1} of ${QUIZ.list.length} · ${esc(QB.TOPICS[q.t])} · ${["", "Beginner", "Intermediate", "Advanced"][q.l]}</div>
      <p class="qtext">${esc(q.q)}</p><div class="qopts col">${order.map(i => `<button class="opt" data-i="${i}">${esc(q.o[i])}</button>`).join("")}</div><div class="qfb"></div>
      <div class="note"><a href="#" id="qQuit">End quiz</a></div></section>`;
    root.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      const i = +b.dataset.i, ok = i === q.a; if (ok) QUIZ.right++; QUIZ.res.push({ q, ok, pick: i });
      root.querySelectorAll(".opt").forEach(x => { x.disabled = true; const j = +x.dataset.i; if (j === q.a) x.classList.add("right"); else if (j === i) x.classList.add("wrong"); });
      answered(q.t, ok, q.id); if (ok) addXP(5 * q.l + 5, "correct answer");
      root.querySelector(".qfb").innerHTML = `<div class="tapinfo">${ok ? "<b class='up'>Correct.</b>" : `<b class='down'>The answer is: ${esc(q.o[q.a])}.</b>`} ${esc(q.x)} ${q.g ? T(q.g, "Learn the term") : ""}</div>
        <button class="btn primary" id="qNext">${QUIZ.i + 1 < QUIZ.list.length ? "Next question" : "See results"}</button>`;
      root.querySelector("#qNext").onclick = () => { QUIZ.i++; QUIZ.i < QUIZ.list.length ? quizShow(root) : quizEnd(root); };
      root.querySelector("#qNext").focus();
    });
    root.querySelector("#qQuit").onclick = e => { e.preventDefault(); QUIZ.res.length ? quizEnd(root) : quizSetup(root); };
  }
  function quizEnd(root) {
    const n = QUIZ.res.length, pct = n ? QUIZ.right / n : 0; badge("first_quiz"); if (n >= 10 && QUIZ.right === n) badge("perfect_quiz");
    addXP(10, "quiz finished");
    const byT = {}; QUIZ.res.forEach(r => { const t = byT[r.q.t] = byT[r.q.t] || [0, 0]; t[1]++; if (r.ok) t[0]++; });
    const miss = QUIZ.res.filter(r => !r.ok);
    root.innerHTML = `<section class="card span report"><h2>Quiz results</h2><div class="scorebig ${pct >= 0.7 ? "up" : pct < 0.5 ? "down" : ""}">${QUIZ.right}<small>/${n}</small></div>
      <p>${pct === 1 ? "Perfect score." : pct >= 0.8 ? "Strong result." : pct >= 0.5 ? "Solid base; the review below covers the gaps." : "Good start. The questions you missed will come back in Smart mix until they stick."}</p>
      <div class="mastery">${Object.entries(byT).map(([t, [c, a]]) => `<div class="mrow"><span>${esc(QB.TOPICS[t])}</span><div class="bar"><i style="width:${c / a * 100}%"></i></div><span>${c}/${a}</span></div>`).join("")}</div>
      ${miss.length ? `<h2 style="margin-top:14px">Review</h2>${miss.map(r => `<div class="habit bad"><b>${esc(r.q.q)}</b><div>Answer: <b>${esc(r.q.o[r.q.a])}</b>. ${esc(r.q.x)}</div></div>`).join("")}` : ""}
      <div class="lbtns"><button class="btn primary" id="qAgain">Another quiz</button>${miss.length ? `<button class="btn" id="qMiss">Retry my mistakes</button>` : ""}</div></section>`;
    root.querySelector("#qAgain").onclick = () => quizSetup(root);
    if (miss.length) root.querySelector("#qMiss").onclick = () => { QUIZ.topic = "mistakes"; QUIZ.list = shuffle(miss.map(r => r.q)); QUIZ.i = 0; QUIZ.right = 0; QUIZ.res = []; quizShow(root); };
  }

  // ================================================================== PROGRESS
  function progInit(root) {
    const lv = levelOf(P.xp), days = Object.keys(P.days).length, sims = P.sims, best = sims.length ? Math.max(...sims.map(s => s.ret)) : null;
    const beat = sims.filter(s => s.ret > s.hold).length, qa = Object.values(P.topics).reduce((a, t) => [a[0] + t.c, a[1] + t.a], [0, 0]);
    root.innerHTML = `<section class="card span train-hero"><h2>Your progress</h2>
      <div class="lvl"><div class="lvlbadge">${lv.i + 1}</div><div style="flex:1"><b style="font-size:20px">${esc(lv.name)}</b><div class="mute">${P.xp} XP · ${Math.max(0, lv.to - P.xp)} XP to ${esc((LEVELS[lv.i + 1] || ["", "max"])[1])}</div>
        <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, (P.xp - lv.from) / (lv.to - lv.from) * 100)}%"></i></div></div></div>
      <div class="stats"><div class="stat"><span>Days trained</span><b>${days}</b></div><div class="stat"><span>Quiz accuracy</span><b>${qa[1] ? Math.round(qa[0] / qa[1] * 100) + "%" : "—"}</b></div>
        <div class="stat"><span>Chart challenges</span><b>${P.chal.a ? `${P.chal.c}/${P.chal.a}` : "—"}</b></div><div class="stat"><span>Simulator runs</span><b>${sims.length}</b></div>
        <div class="stat"><span>Beat holding</span><b>${sims.length ? `${beat}/${sims.length}` : "—"}</b></div><div class="stat"><span>Best streak</span><b>${P.best_run}</b></div></div>
      <p class="note">Progress is saved on your Mac, so it follows you between your phone and computer.</p></section>
    <section class="card"><h2>Topic mastery</h2><div class="mastery">${Object.entries(QB.TOPICS).map(([k, n]) => { const t = P.topics[k] || { a: 0, c: 0 }, m = t.a ? t.c / t.a : 0;
      return `<div class="mrow"><span>${esc(n)}</span><div class="bar"><i style="width:${m * 100}%;${t.a < 5 ? "opacity:.45" : ""}"></i></div><span>${t.a ? Math.round(m * 100) + "%" : "new"}</span><button class="chip sm" data-practise="${k}">Practise</button></div>`; }).join("")}</div>
      <p class="note">Faded bars have fewer than 5 answers, so they're still rough estimates.</p></section>
    <section class="card"><h2>Badges</h2><div class="badges">${Object.entries(BADGES).map(([id, [n, d]]) => `<div class="bdg${P.badges[id] ? " got" : ""}"><div class="bi">${P.badges[id] ? "★" : "☆"}</div><b>${esc(n)}</b><span>${esc(d)}</span></div>`).join("")}</div></section>
    <section class="card span"><h2>Simulator history</h2>${sims.length ? `<div class="feed">${sims.slice().reverse().slice(0, 15).map(s => `<div class="row"><div><b>${esc(s.coin)}</b> <span class="mute">${esc(TFS[s.tf])} · ${new Date(s.ts).toLocaleDateString("en-GB")}</span><div class="faint" style="font-size:12px">${s.trades} trades · score ${s.score}</div></div><div style="text-align:right"><b class="${s.ret >= 0 ? "up" : "down"}">${pc(s.ret)}</b><div class="faint" style="font-size:12px">holding ${pc(s.hold)}</div></div></div>`).join("")}</div>${best != null ? `<p class="note">Best run: ${pc(best)}.</p>` : ""}` : `<div class="empty">No runs yet. Try the simulator.</div>`}
      <div class="lbtns" style="margin-top:12px"><button class="btn danger" id="pReset">Reset all progress</button></div></section>`;
    root.querySelectorAll("[data-practise]").forEach(b => b.onclick = () => { QUIZ.topic = b.dataset.practise; QUIZ.level = 0; APP.showTab("quiz"); });
    root.querySelector("#pReset").onclick = e => { const b = e.target; if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Tap again to erase all training progress"; setTimeout(() => { b.dataset.c = ""; b.textContent = "Reset all progress"; }, 4000); return; } P = blank(); saveProgress(); progInit(root); };
  }

  // ================================================================== wiring
  const INIT = { sim: simSetup, chal: chalInit, quiz: quizSetup, prog: progInit };
  const inited = {};
  async function init(app) { APP = app; await loadProgress(); }
  function show(tab) {
    const root = $("tab-" + tab); if (!root || !INIT[tab]) return;
    if (tab === "prog" || tab === "quiz" && !(QUIZ.list.length && QUIZ.i < QUIZ.list.length) || !inited[tab]) { INIT[tab](root); inited[tab] = true; }
  }
  function hide(tab) { if (tab === "sim") simPlay(false); }
  window.TRAIN = { init, show, hide, engine: { newSim, buy, sell, step, report, value, avgEntry, stopPx, targetPx }, genQuestion, pickQuestions, levelOf, get P() { return P; }, set P(v) { P = v; }, blank };
})();
