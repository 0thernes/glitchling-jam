// Isolated dev test for HOT-3R. Stream: 4-way noisy cue (amplitude 0.5-1.2, noise sd 0.3); first-order choice = argmax; confidence = softmax top-2 margin.
// Safe option pays the agent's own running accuracy (so opt-out has value only if confidence discriminates trials). Metric: mean reward trials 160-259.
// Arms: metacognitive opt-out vs random opt-out at matched per-seed rate vs confidence-shuffled opt-out (bin table from shuffled confidences).
import { OptOut, MarginConf } from "./hot3";
const B = Number(process.env.SEEDBASE ?? 0), N = Number(process.env.NSEEDS ?? 16); if (B < 2000) throw new Error("dev seeds only");
const rng = (s: number) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rate: number[] = [];
const run = (s: number, si: number, mode: "meta" | "rand" | "shuf") => { const r = rng(s * 613 + 1), rr = rng(s * 17 + 5); const g = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); const o = new OptOut(); const mc = new MarginConf(); let acc = 0.5, R = 0, n = 0, outs = 0;
  for (let t = 0; t < 260; t++) { const c = Math.floor(r() * 4), amp = 0.5 + 0.7 * r(); const x = [0, 1, 2, 3].map((j) => (j === c ? amp : 0) + 0.3 * g()); const e = x.map((v) => Math.exp(4 * v)); const z = e.reduce((a, b) => a + b, 0); const p = e.map((v) => v / z).sort((a, b) => b - a);
    const conf = mc.read(p[0] - p[1]); const ch = x.indexOf(Math.max(...x)); const ok = ch === c; const cf = mode === "shuf" ? rr() * 0.9 : conf;
    const out = mode === "rand" ? rr() < rate[si] : o.decide(cf, acc); const rw = out ? acc : ok ? 1 : 0; if (t >= 160) { R += rw; n++; outs += +out; } o.learn(cf, ok); acc += 0.05 * ((ok ? 1 : 0) - acc); }
  if (mode === "meta") rate[si] = outs / n; return R / n; };
const S = Array.from({ length: N }, (_, i) => B + i); const meta = S.map((s, i) => run(s, i, "meta"));
console.log(JSON.stringify({ arms: { "metacognitive opt-out": meta, "random opt-out (matched rate)": S.map((s, i) => run(s, i, "rand")), "confidence shuffled": S.map((s, i) => run(s, i, "shuf")) } }));
