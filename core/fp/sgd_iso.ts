// B23 isolation: surprise-gated dendritic covariance learning (phasic LC-NE at stimulus change gates Oja plasticity; Sara 2009, Yu & Dayan 2005).
// Two modules x 13 cells: 3 cue cells per module carry the cue; all cells share a large slow drift (OU) plus noise. Cue shown 3 ticks, blank 1 tick (RPT2R schedule).
// L5 pools (8 units each; basal own module, apical partner) learn online; readout = raw rates + both pools; LMS decode of a^b on trials 160-219.
import { L5Pool } from "./l5";
const mul = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const run = (seed: number, arm: string): number => { const r = mul(seed), N = 13, gs = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
  const cueW = [0, 1].map(() => Array.from({ length: N }, (_, i) => (i < 3 ? (r() < 0.5 ? -1 : 1) * 0.5 : 0))), drW = [0, 1].map(() => Array.from({ length: N }, () => gs())); let dr = [0, 0];
  const PA = new L5Pool(8, N, r), PB = new L5Pool(8, N, r); PA.norm = PB.norm = process.env.NORM === "1"; const mu = [new Float64Array(N), new Float64Array(N)]; let prev = [0, 0]; let xp: number[][] | null = null; const w = new Float64Array(2 * N + 17); let ok = 0;
  const tick = (cues: number[]) => { const x = [0, 1].map((m) => { dr[m] = 0.97 * dr[m] + 0.25 * gs(); return Array.from({ length: N }, (_, i) => cueW[m][i] * cues[m] + 0.6 * drW[m][i] * dr[m] + 0.15 * gs()); });
    const c = x.map((v, m) => v.map((q, i) => { mu[m][i] += 0.02 * (q - mu[m][i]); return q - mu[m][i]; })); const sur = Math.abs(cues[0] - prev[0]) + Math.abs(cues[1] - prev[1]); prev = cues.slice();
    const dx = xp ? x.map((v, m) => v.map((q, i) => q - xp![m][i])) : null; xp = x;
    if (arm !== "random" && dx) { const g = arm === "gated" ? (sur > 0 ? 1 : 0) : 1, eta = 0.02 * g; if (eta > 0) { PA.learn(dx[0], dx[1], eta); PB.learn(dx[1], dx[0], eta); } } return c; }; /* plasticity reads the phasic (change) response */
  for (let t = 0; t < 220; t++) { const a = r() < 0.5 ? 1 : 0, b = r() < 0.5 ? 1 : 0; let c: number[][] = []; for (let k = 0; k < 3; k++) c = tick([2 * a - 1, 2 * b - 1]);
    const f = [...c[0], ...c[1], ...PA.step(c[0], c[1]), ...PB.step(c[1], c[0]), 1]; const y = a ^ b; let z = 0; for (let i = 0; i < f.length; i++) z += w[i] * f[i]; if (t >= 160) ok += +((z > 0.5 ? 1 : 0) === y);
    let nn = 1e-6; for (const v of f) nn += v * v; for (let i = 0; i < f.length; i++) w[i] += (0.5 * (y - z) * f[i]) / nn; tick([0, 0]); }
  return ok / 60; };
const B = Number(process.argv[2] ?? 3445), S = Array.from({ length: 16 }, (_, i) => B + i); const st = (x: number[]) => { const m = x.reduce((p, q) => p + q, 0) / x.length; return [m, Math.sqrt(x.reduce((p, q) => p + (q - m) ** 2, 0) / (x.length - 1))]; };
const dt = (x: number[], y: number[]) => { const [mx, sx] = st(x), [my, sy] = st(y); return [(mx - my) / Math.sqrt((sx * sx + sy * sy) / 2), (mx - my) / Math.sqrt((sx * sx + sy * sy) / 16)].map((v) => v.toFixed(2)).join("/"); };
const R: any = {}; for (const a of ["gated", "ungated", "random"]) R[a] = S.map((s) => run(s, a));
console.log(JSON.stringify({ seeds: B, gated: st(R.gated)[0].toFixed(3), ungated: st(R.ungated)[0].toFixed(3), random: st(R.random)[0].toFixed(3), "d/t vs ungated": dt(R.gated, R.ungated), "d/t vs random": dt(R.gated, R.random) }));
