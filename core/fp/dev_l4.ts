// Isolated dev test: percept accuracy from the input layer (online normalised LMS read-out, as the creature's recon uses) vs raw-argmax accuracy,
// on the HOT1 stream (rectified receptor input, sd 0.4). Goal (FIRST-PRINCIPLES.md): accuracy within 3 points of raw. Also arm: same read-out on a
// shuffled-weight (random relabelled) layer = control that decoding is not trivial. Metric: accuracy trials 300-399.
import { InputLayer } from "./l4";
const B = Number(process.env.SEEDBASE ?? 0), N = Number(process.env.NSEEDS ?? 16); if (B < 2000) throw new Error("dev seeds only");
const rng = (s: number) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const am = (a: number[]) => a.indexOf(Math.max(...a));
const run = (s: number, arm: "l4" | "raw") => { const r = rng(s * 31 + 3); const g = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); const L = new InputLayer(4, 16, s); const W = Array.from({ length: 4 }, () => new Array(17).fill(0)); let ok = 0;
  for (let t = 0; t < 400; t++) { const c = Math.floor(r() * 4); const x = [0, 1, 2, 3].map((j) => Math.max(0, (j === c ? 1 : 0) + 0.4 * g())); const f = [...L.out(x), 1]; const y = W.map((w) => w.reduce((a, v, i) => a + v * f[i], 0));
    if (t >= 300) ok += +((arm === "raw" ? am(x) : am(y)) === c); const n = 1 + f.reduce((a, v) => a + v * v, 0); for (let k = 0; k < 4; k++) { const e = (k === c ? 1 : 0) - y[k]; for (let i = 0; i < 17; i++) W[k][i] += 0.2 * e * f[i] / n; } } return ok / 100; };
const S = Array.from({ length: N }, (_, i) => B + i); console.log(JSON.stringify({ arms: { "input-layer read-out": S.map((s) => run(s, "l4")), "raw argmax": S.map((s) => run(s, "raw")) } }));
