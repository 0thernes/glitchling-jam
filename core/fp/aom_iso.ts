// Isolation: depleting 16-site bandit with the creature's statistics (p = 0.05 + 0.25 cv/3 + 0.25 sv/3; success -> p x 0.1, linear recovery over 120 ticks).
// One choice every 18 ticks (creature's forage rate), 400 choices. Arms: AOM+IG (kappa 1, fixed a priori) vs AOM without IG vs IG without consequence curve.
import { AOM } from "./aom";
const mul = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const run = (seed: number, arm: string): number => { const r = mul(seed), rp = mul(seed * 7 + 1); const perm = (n: number) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cv = perm(4), sv = perm(4), pb = Array.from({ length: 16 }, (_, k) => 0.05 + (0.25 * cv[k & 3]) / 3 + (0.25 * sv[k >> 2]) / 3), dep = new Float64Array(16);
  const M = new AOM(16, 9, 15, 2e-5, arm !== "nocurve"), kap = arm === "noig" ? 0 : 1; let R = 0, t = 0;
  for (let n = 0; n < 400; n++) { for (let s = 0; s < 18; s++) { t++; M.tick(); for (let k = 0; k < 16; k++) dep[k] = Math.max(0, dep[k] - 1 / 120); }
    let bk = 0, bv = -1e9; for (let k = 0; k < 16; k++) { const v = (arm === "blind" ? M.m[k] : M.pred(k, t)) + kap * M.ig(k, t) + 0.02 * -Math.log(-Math.log(rp() + 1e-12) + 1e-12); if (v > bv) { bv = v; bk = k; } }
    const got = r() < pb[bk] * (1 - 0.9 * dep[bk]) ? 1 : 0; if (got) dep[bk] = 1; R += got; M.observe(bk, t, got); }
  return R; };
const B = Number(process.argv[2] ?? 3285), S = Array.from({ length: 16 }, (_, i) => B + i); const st = (x: number[]) => { const m = x.reduce((p, q) => p + q, 0) / x.length; return [m, Math.sqrt(x.reduce((p, q) => p + (q - m) ** 2, 0) / (x.length - 1))]; };
const dt = (x: number[], y: number[]) => { const [mx, sx] = st(x), [my, sy] = st(y); return [(mx - my) / Math.sqrt((sx * sx + sy * sy) / 2), (mx - my) / Math.sqrt((sx * sx + sy * sy) / 16)].map((v) => v.toFixed(2)).join("/"); };
const res: any = {}; for (const a of ["full", "noig", "nocurve", "blind"]) res[a] = S.map((s) => run(s, a));
console.log(JSON.stringify({ seeds: B, full: st(res.full)[0].toFixed(1), noIG: st(res.noig)[0].toFixed(1), noCurve: st(res.nocurve)[0].toFixed(1), "d/t vs noIG": dt(res.full, res.noig), "d/t vs noCurve": dt(res.full, res.nocurve), blindValue: st(res.blind)[0].toFixed(1), "d/t vs blindValue": dt(res.full, res.blind) }));
