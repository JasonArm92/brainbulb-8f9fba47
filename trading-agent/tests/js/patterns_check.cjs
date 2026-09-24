global.window = global; global.document = { getElementById: () => null, addEventListener() {} }; global.localStorage = { getItem: () => null, setItem() {} };
global.matchMedia = () => ({ matches: false }); global.addEventListener = () => {};
require(require("path").join(__dirname, "..", "..", "trader")+"/static/learn.js");
window.LightweightCharts = {};
require(require("path").join(__dirname, "..", "..", "trader")+"/static/charts.js");
const { patternsOf, atr, rsi, ema, heikin } = window.CHARTS;
let ok = 0;
for (const p of LEARN.PATTERNS) {
  // lead-in: 20 candles trending into the example's first candle, scaled to its size
  const ex = p.ex, first = ex[0], dir = ex[ex.length - 2][3] - first[0] >= 0 ? 1 : -1, step = 0.4;
  const lead = Array.from({ length: 20 }, (_, i) => { const o = first[0] - dir * step * (20 - i), c = o + dir * step * 0.8; return [o, Math.max(o, c) + 0.3, Math.min(o, c) - 0.3, c]; });
  const k = [...lead, ...ex].map((c, i) => ({ t: i, o: c[0], h: c[1], l: c[2], c: c[3], v: 1 }));
  const got = patternsOf(k, atr(k))[k.length - 1];
  console.log((got === p.id ? "OK  " : "MISS") + " " + p.id + " -> " + got); if (got === p.id) ok++;
}
console.log(ok + "/" + LEARN.PATTERNS.length);
// indicator sanity
const c = Array.from({ length: 40 }, (_, i) => 100 + i); console.log("rsi rising", rsi(c).at(-1), "ema", ema([1, 2, 3, 4, 5], 3).join(","));
if (ok !== LEARN.PATTERNS.length) process.exit(1);
