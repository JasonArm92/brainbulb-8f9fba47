// Simulator engine + question bank checks (run by tests/test_charts_js.py).
const path = require("path"), D = p => path.join(__dirname, "..", "..", "trader", "static", p);
global.window = global; global.document = { getElementById: () => null, addEventListener() {}, body: { dataset: {} } };
global.localStorage = { getItem: () => null, setItem() {} }; global.matchMedia = () => ({ matches: false }); global.addEventListener = () => {};
window.LightweightCharts = {};
require(D("learn.js")); require(D("charts.js")); require(D("quizbank.js")); require(D("sim.js"));
const E = TRAIN.engine; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL " + m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
// 110 flat candles at 100, then a path we control
const k = Array.from({ length: 110 }, (_, i) => ({ t: i * 60, o: 100, h: 100.5, l: 99.5, c: 100, v: 1 }));
const add = (o, h, l, c) => k.push({ t: k.length * 60, o, h, l, c, v: 1 });
add(100, 101, 99.8, 101); add(101, 103, 100.8, 103); add(103, 103.2, 94, 97); add(97, 112, 96.9, 110); add(110, 111, 109, 110);
// 1. buy: fee comes off the notional
let s = E.newSim(k, 100, 1000, 0.006);
const b = E.buy(s, 0.5);
ok(near(s.cash, 500) && near(b.fee, 3) && near(s.qty, 497 / 100), "buy maths");
ok(near(E.avgEntry(s), 500 / 4.97), "avg entry includes the fee");
// 2. sell half at 100: proceeds minus fee, pnl vs cost share
const sh = E.sell(s, 0.5);
ok(near(sh.fee, 2.485 * 100 * 0.006) && near(sh.pnl, 248.5 - 1.491 - 250), "sell maths");
// 3. round trip at the same price loses ~1.2%
s = E.newSim(k, 100, 1000, 0.006); E.buy(s, 1); E.sell(s, 1);
ok(near(s.cash, 1000 * 0.994 * 0.994), "round trip costs ~1.2%");
// 4. stop triggers on the candle low, at the stop price (or the open if it gapped below)
s = E.newSim(k, 110, 1000, 0.006); s.stop = 5; s.target = 20; E.buy(s, 1);       // bought at 100 (i=109)
const sp = E.stopPx(s); ok(near(sp, E.avgEntry(s) * 0.95), "stop price");
E.step(s); E.step(s); ok(s.qty > 0, "no stop yet");
const t3 = E.step(s); ok(t3.length === 1 && t3[0].reason === "stop" && near(t3[0].px, sp), "stop filled at stop price");
// 5. target hit
s = E.newSim(k, 110, 1000, 0.006); s.target = 0.3; E.buy(s, 1); const tp = E.targetPx(s);
const t1 = E.step(s); ok(t1.length === 1 && t1[0].reason === "target" && near(t1[0].px, tp), "target filled at target price");
// 6. both touched in one candle -> stop first (conservative)
const kk = k.slice(0, 110); kk.push({ t: 110 * 60, o: 100, h: 130, l: 70, c: 100, v: 1 });
s = E.newSim(kk, 110, 1000, 0.006); s.stop = 5; s.target = 5; E.buy(s, 1); const tb = E.step(s);
ok(tb[0].reason === "stop", "stop wins when both touched");
// 7. report: no-stop habit, buy-and-hold comparison, win rate
s = E.newSim(k, 110, 1000, 0.006); E.buy(s, 1); while (!s.done) E.step(s); E.sell(s, 1);
const r = E.report(s);
ok(r.habits.some(h => h.t.includes("without a stop")), "flags buys without stops");
ok(near(r.hold, (0.994 * 0.994 * 110 / 100 - 1) * 100, 1e-9), "buy-and-hold includes both fees");
ok(r.rts === 1 && r.wins === 1 && r.winRate === 1, "one winning round trip");
ok(r.score >= 0 && r.score <= 100, "score in range");
// 8. question bank integrity
const ids = new Set();
QUIZBANK.BANK.forEach(q => {
  ok(!ids.has(q.id), "unique id " + q.id); ids.add(q.id);
  ok(q.o.length === 4 && new Set(q.o).size === 4, "4 distinct options " + q.id);
  ok(Number.isInteger(q.a) && q.a >= 0 && q.a < 4, "answer index " + q.id);
  ok(QUIZBANK.TOPICS[q.t], "topic " + q.id); ok([1, 2, 3].includes(q.l), "level " + q.id);
  ok(!q.g || LEARN.G[q.g], "glossary link " + q.id + " -> " + q.g);
});
Object.keys(QUIZBANK.TOPICS).forEach(t => ok(QUIZBANK.BANK.filter(q => q.t === t).length >= 5, "at least 5 questions in " + t));
// 9. smart pick favours past mistakes
TRAIN.P = Object.assign(TRAIN.blank(), { wrong: { f2: 5 } });
let hits = 0; for (let n = 0; n < 200; n++) if (TRAIN.pickQuestions("smart", 0, 5).some(q => q.id === "f2")) hits++;
ok(hits > 100, "a repeatedly-missed question comes back often (" + hits + "/200)");
ok(TRAIN.pickQuestions("fees", 1, 20).every(q => q.t === "fees" && q.l === 1), "topic/level filter");
// 10. chart challenge generator produces valid questions on a random walk
let p = 100; const walk = Array.from({ length: 300 }, (_, i) => { const o = p; p = o * (1 + (Math.sin(i / 17) * 0.004) + (Math.random() - 0.5) * 0.01); return { t: i * 3600, o, h: Math.max(o, p) * 1.003, l: Math.min(o, p) * 0.997, c: p, v: 1 + Math.random() }; });
const types = new Set();
for (let n = 0; n < 60; n++) { const q = TRAIN.genQuestion({ k: walk, tf: 3600, coin: "BTC" }); if (!q) continue; types.add(q.type);
  ok(q.o.length >= 3 && q.a >= 0 && q.a < q.o.length && new Set(q.o).size === q.o.length, "challenge options valid (" + q.type + ")"); ok(q.cut < walk.length, "cut in range"); }
ok(types.size >= 5, "challenge variety " + [...types].join(","));
console.log(fails ? fails + " FAILED" : "ALL OK " + QUIZBANK.BANK.length + " questions");
process.exit(fails ? 1 : 0);
