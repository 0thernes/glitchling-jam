// Isolation: modules A,B each with 13 cells coding a (or b) with noise. 26 DMUL cells: basal from own module, apical from the other (fixed random weights).
// Linear decoder (LMS, 160 train / 60 test like RPT2R) of a XOR b from [own-module raw rates + DMUL outputs] vs additive vs apical cut.
import { dmulOut, addOut } from "./dmul";
const mul = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const run = (seed: number, mode: "dmul" | "add" | "cut"): number => { const r = mul(seed), N = 13; const tune = Array.from({ length: 2 * N }, () => r() * 2 - 1);
  const Wa = Array.from({ length: 2 * N }, () => Array.from({ length: N }, () => (r() * 2 - 1) / Math.sqrt(N) * 2));
  const w = new Float64Array(2 * N + 1); let ok = 0;
  for (let t = 0; t < 220; t++) { const a = r() < 0.5 ? 1 : 0, b = r() < 0.5 ? 1 : 0; const rA = Array.from({ length: N }, (_, i) => Math.max(0, 0.5 + 0.5 * tune[i] * (2 * a - 1) + 0.2 * (r() - 0.5))), rB = Array.from({ length: N }, (_, i) => Math.max(0, 0.5 + 0.5 * tune[N + i] * (2 * b - 1) + 0.2 * (r() - 0.5)));
    const f: number[] = []; for (let j = 0; j < 2 * N; j++) { const own = j < N ? rA[j] : rB[j - N], oth = j < N ? rB : rA; let ap = 0; for (let k = 0; k < N; k++) ap += Wa[j][k] * oth[k]; f.push(mode === "dmul" ? dmulOut(own, ap) : mode === "add" ? addOut(own, ap) : dmulOut(own, 0)); } f.push(1);
    const y = a ^ b; let z = 0; for (let i = 0; i < f.length; i++) z += w[i] * f[i]; if (t >= 160) ok += +((z > 0.5 ? 1 : 0) === y); let nn = 1e-6; for (const v of f) nn += v * v; for (let i = 0; i < f.length; i++) w[i] += (0.5 * (y - z) * f[i]) / nn; }
  return ok / 60; };
const B = Number(process.argv[2] ?? 3285); const st = (x: number[]) => { const m = x.reduce((p, q) => p + q, 0) / x.length; return [m, Math.sqrt(x.reduce((p, q) => p + (q - m) ** 2, 0) / (x.length - 1))]; };
const S = Array.from({ length: 16 }, (_, i) => B + i), res: any = {}; for (const m of ["dmul", "add", "cut"] as const) res[m] = S.map((s) => run(s, m));
const dt = (x: number[], y: number[]) => { const [mx, sx] = st(x), [my, sy] = st(y); return [(mx - my) / Math.sqrt((sx * sx + sy * sy) / 2), (mx - my) / Math.sqrt((sx * sx + sy * sy) / 16)].map((v) => v.toFixed(2)).join("/"); };
console.log(JSON.stringify({ seeds: B, dmul: st(res.dmul)[0].toFixed(3), add: st(res.add)[0].toFixed(3), cut: st(res.cut)[0].toFixed(3), "d/t vs add": dt(res.dmul, res.add), "d/t vs cut": dt(res.dmul, res.cut) }));
