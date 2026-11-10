// Isolated TPC checks. A: delayed match (cue 4 ticks, blank delay, cue recurs as probe): decode cue from h at delay end (nearest centroid,
// train first half / test second half). B: anticipatory homeostasis: daily scheduled meal, insulin target = reactive PI + TPC glucose forecast;
// score fraction of post-meal ticks in band. Conditions: tpc (learned, reentry), noReentry (lam 0), frozen (no learning).
import { TPC } from "./tpc";
const S0 = Number(process.env.S ?? 3077), NS = Number(process.env.NS ?? 8); const rng = (s: number) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const C: Record<string, any> = { tpc: {}, tpcL03: { lam: 0.3 }, tpcK1: { K: 1 }, noReentry: { lam: 0 }, frozen: { learn: false } }; const out: Record<string, Record<string, number[]>> = { A: {}, B: {} };
for (const [cn, co] of Object.entries(C)) for (let s = S0; s < S0 + NS; s++) {
  { const r = rng(s), DEL = Number(process.env.DEL ?? 40), m = new TPC(4, r, { K: DEL + 4, ...co, ...(co.K ? { K: 1 } : {}) }); const H: number[][] = [], Y: number[] = []; for (let tr = 0; tr < 400; tr++) { const c = Math.floor(r() * 4); const x = [0, 0, 0, 0]; x[c] = 1; for (let k = 0; k < 4; k++) m.step(x); for (let k = 0; k < DEL; k++) m.step([0, 1, 2, 3].map(() => 0.3 * (r() - 0.5))); H.push(Array.from(m.h)); Y.push(c); for (let k = 0; k < 4; k++) m.step(x); for (let k = 0; k < 6; k++) m.step([0, 0, 0, 0]); }
    const cen = [0, 1, 2, 3].map((c) => { const z = new Array(m.N).fill(0); let n = 0; for (let i = 200; i < 300; i++) if (Y[i] === c) { n++; H[i].forEach((v, j) => (z[j] += v)); } return z.map((v) => v / Math.max(1, n)); });
    let ok = 0; for (let i = 300; i < 400; i++) { let b = 0, bd = 1e9; cen.forEach((z, c) => { const d = z.reduce((a, v, j) => a + (v - H[i][j]) ** 2, 0); if (d < bd) { bd = d; b = c; } }); ok += +(b === Y[i]); } (out.A[cn] ??= []).push(ok / 100); }
  { const r = rng(s + 1e5), DAY = 240, K = 20, m = new TPC(3, r, { K, ...co }); let glc = 3, gut = 0, ins = 0.3, I = 0, ok = 0, n = 0;
    for (let t = 0; t < 12 * DAY; t++) { const ph = (2 * Math.PI * (t % DAY)) / DAY; if (t % DAY === 100) gut += 6; const ab = 0.08 * gut; gut -= ab; glc += ab - 0.15 * ins * glc + 0.03 * (3 - glc) * 0 + 0.012 + 0.05 * (r() - 0.5);
      const f = m.step([glc / 3 - 1, Math.sin(ph), Math.cos(ph)]); const e = glc / 3 - 1; I = Math.max(-1, Math.min(1, I + 0.01 * e)); ins += 0.2 * (Math.max(0, Math.min(1, 0.3 + 1.5 * e + I + 1.5 * Math.max(0, f[0] - e))) - ins);
      if (t >= 8 * DAY && t % DAY >= 100 && t % DAY < 160) { n++; ok += +(glc > 2 && glc < 4.5); } } (out.B[cn] ??= []).push(ok / n); }
}
console.log(JSON.stringify(out));
