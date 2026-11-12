// Pass 15: e-means vs k-means on the creature's own data streams. Usage: node test/emeans_streams.mjs SEED [SECS]
// Records the three prototype-layer input streams (percepts d=35, concepts d=53, places d=18) at 10 Hz from a live run, then
// (a) batch: e-means (T = 1, 3 epochs, laws for B and step) vs Lloyd (T = 1, 3, 25) vs Sculley mini-batch (T = 3, same B),
//     all from a random choice of k data points; reports MSE on the stream;
// (b) streaming (also: finalAll = MSE of the final streaming prototypes over the whole recorded stream, i.e. how well they summarise everything seen)
// (b) streaming (what the creature actually runs): prequential loss (each sample scored before it is learned) for
//     e-means streaming, e-means without dead-cluster revival, MacQueen online k-means, and a constant-step EMA
//     (VQ-VAE style, step = the e-means floor, no schedule, no revival); plus learning speed: samples (10 Hz ticks) until the 200-sample running prequential loss has made 90% of its drop
//     from the first window to its best window.
import { EMeans } from '../js/sim/emeans.js'; import { K1, K2, K3, D1, D2, D3 } from '../js/sim/protolayers.js';
import { lloyd, mse, sculley, MacQueen, nearest } from './kmeans_ref.mjs';
const seed = +(process.argv[2] || 1), secs = +(process.argv[3] || 600); const { Creature } = await import('../js/sim/creature.js');
const fs = await import('node:fs'); const cache = `/tmp/emeans_streams_${seed}_${secs}.json`; let S;
if (fs.existsSync(cache)) S = JSON.parse(fs.readFileSync(cache, 'utf8')).map((L) => L.map((v) => Float64Array.from(v)));
else { const c = new Creature(seed); S = [[], [], []]; for (let f = 0; f < secs * 60; f++) { c.step(); if (f % 6 === 5) { S[0].push(Float64Array.from(c.protos.x1)); S[1].push(Float64Array.from(c.protos.x2)); S[2].push(Float64Array.from(c.protos.x3)); } } fs.writeFileSync(cache, JSON.stringify(S.map((L) => L.map((v) => Array.from(v))))); }
const res = {}; for (const [li, name, k, d, H] of [[0, 'percepts', K1, D1, 3000], [1, 'concepts', K2, D2, 3000], [2, 'places', K3, D3, 6000]]) { const n = S[li].length, X = new Float64Array(n * d); S[li].forEach((v, i) => X.set(v, i * d));
  const r = {}; const avg = (f) => { let s = 0; for (const q of [1, 2, 3]) s += f(q); return +(s / 3).toFixed(4); };
  r.emeans_T1 = avg((q) => new EMeans({ k, d, n, T: 1, seed: q }).fit(X, n).mse(X, n)); r.emeans_T3 = avg((q) => new EMeans({ k, d, n, T: 3, seed: q }).fit(X, n).mse(X, n));
  r.lloyd_T1 = avg((q) => mse(lloyd(X, n, k, d, 1, q), k, d, X, n)); r.lloyd_T3 = avg((q) => mse(lloyd(X, n, k, d, 3, q), k, d, X, n)); r.lloyd_T25 = avg((q) => mse(lloyd(X, n, k, d, 25, q), k, d, X, n));
  const B3 = new EMeans({ k, d, n, T: 3 }).B; r.sculley_T3 = avg((q) => mse(sculley(X, n, k, d, 3, B3, q), k, d, X, n));
  const preq = (mk) => { const m = mk(); let L = 0, Ln = 0; const run = []; for (let p = 0; p < n; p++) { const x = S[li][p]; const l = m.score(x); if (l !== null) { L += l; Ln++; run.push(l); } m.learn(x); } const w = 200, sm = run.map((_, i) => run.slice(Math.max(0, i - w), i + 1).reduce((a, b) => a + b, 0) / Math.min(i + 1, w + 1)); const s0 = sm[w], mn = Math.min(...sm.slice(w)); let st = sm.length; for (let i = w; i < sm.length; i++) if (sm[i] <= mn + 0.1 * (s0 - mn)) { st = i; break; } const t3 = run.slice(Math.floor((2 * run.length) / 3)); const Cf = m.C ? m.C() : null; const fin = Cf ? +(mse(Cf, k, d, X, n)).toFixed(4) : null; return { all: +(L / Ln).toFixed(4), finalAll: fin, last3rd: +(t3.reduce((a, b) => a + b, 0) / t3.length).toFixed(4), ticksTo90pct: st + k }; };
  const em = (rev, rep = 0) => () => { const e0 = new EMeans({ k, d, n: H }); const e = new EMeans({ k, d, n: H, seed: 1, streaming: true, slow: 1, revive: rev, replay: rep ? 8 * e0.B : 0, every: rep === 2 ? e0.B : undefined }); return { score: (x) => (e.ready ? (e.assign(x), e.lastD2) : null), learn: (x) => e.push(x), C: () => e.C }; };
  r.stream_emeans = preq(em(true)); r.stream_emeans_noRevival = preq(em(false)); r.stream_emeans_replay = preq(em(true, 1)); r.stream_emeans_replayEveryB = preq(em(true, 2)); r.stream_emeans_replay_noRevival = preq(em(false, 1));
  r.stream_macqueen = preq(() => { const q = new MacQueen(k, d); return { score: (x) => (q.n0 >= k ? nearest(q.C, k, d, x, 0)[1] : null), learn: (x) => q.push(x), C: () => q.C }; });
  const floor = 0.1 * new EMeans({ k, d, n: H }).alpha0; r.stream_constEMA = preq(() => { const C = new Float64Array(k * d); let n0 = 0; return { score: (x) => (n0 >= k ? nearest(C, k, d, x, 0)[1] : null), learn: (x) => { if (n0 < k) { C.set(x, n0 * d); n0++; return; } const [j] = nearest(C, k, d, x, 0); for (let i = 0; i < d; i++) C[j * d + i] += floor * (x[i] - C[j * d + i]); }, C: () => C }; });
  res[name] = { n, k, d, B: new EMeans({ k, d, n: H }).B, ...r }; }
console.log(JSON.stringify({ seed, secs, res }, null, 1));
