// Isolation: modules A,B (13 noisy tuned cells each, centred). Readout = 26 raw rates + two 8-unit L5 pools (A basal/B apical and B basal/A apical). LMS decode, 160 train / 60 test.
import { L5Pool } from "./l5";
const mul = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const run = (seed: number, mode: string): number => { const r = mul(seed), N = 13, tune = Array.from({ length: 2 * N }, () => r() * 2 - 1); const PA = new L5Pool(8, N, r), PB = new L5Pool(8, N, r); const w = new Float64Array(2 * N + 17); let ok = 0;
  for (let t = 0; t < 220; t++) { const a = r() < 0.5 ? 1 : 0, b = r() < 0.5 ? 1 : 0; const cA = Array.from({ length: N }, (_, i) => 0.5 * tune[i] * (2 * a - 1) + 0.2 * (r() - 0.5)), cB = Array.from({ length: N }, (_, i) => 0.5 * tune[N + i] * (2 * b - 1) + 0.2 * (r() - 0.5));
    const md = mode === "add" ? "add" : "mul", cut = mode === "cut"; const f = [...cA.map((v) => Math.max(0, 0.5 + v)), ...cB.map((v) => Math.max(0, 0.5 + v)), ...PA.step(cA, cut ? null : cB, md), ...PB.step(cB, cut ? null : cA, md), 1];
    const y = a ^ b; let z = 0; for (let i = 0; i < f.length; i++) z += w[i] * f[i]; if (t >= 160) ok += +((z > 0.5 ? 1 : 0) === y); let nn = 1e-6; for (const v of f) nn += v * v; for (let i = 0; i < f.length; i++) w[i] += (0.5 * (y - z) * f[i]) / nn; }
  return ok / 60; };
const B = Number(process.argv[2] ?? 3365), S = Array.from({ length: 16 }, (_, i) => B + i); const st = (x: number[]) => { const m = x.reduce((p, q) => p + q, 0) / x.length; return [m, Math.sqrt(x.reduce((p, q) => p + (q - m) ** 2, 0) / (x.length - 1))]; };
const dt = (x: number[], y: number[]) => { const [mx, sx] = st(x), [my, sy] = st(y); return [(mx - my) / Math.sqrt((sx * sx + sy * sy) / 2), (mx - my) / Math.sqrt((sx * sx + sy * sy) / 16)].map((v) => v.toFixed(2)).join("/"); };
const R: any = {}; for (const m of ["mul", "add", "cut"]) R[m] = S.map((s) => run(s, m));
console.log(JSON.stringify({ seeds: B, l5: st(R.mul)[0].toFixed(3), add: st(R.add)[0].toFixed(3), cut: st(R.cut)[0].toFixed(3), "d/t vs add": dt(R.mul, R.add), "d/t vs cut": dt(R.mul, R.cut) }));
