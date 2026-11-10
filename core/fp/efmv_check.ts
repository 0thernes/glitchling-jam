// Finite-difference check of EFMV.gradV (the scalar EFM path is Eshkol-verified; same cell code).
import { EFMV } from "./efm"; let a = 7; const r = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
const m = new EFMV(16, 16, r, 16); const xs = Array.from({ length: 20 }, () => Array.from({ length: 16 }, () => r())), ys = xs.map(() => Array.from({ length: 16 }, () => r()));
const g = m.gradV(xs, ys, 4); let mx = 0; for (let i = 0; i < m.n; i += 7) { const p0 = m.p[i]; m.p[i] = p0 + 1e-6; const lp = m.lossV(m.p, xs, ys, 4); m.p[i] = p0 - 1e-6; const lm = m.lossV(m.p, xs, ys, 4); m.p[i] = p0; mx = Math.max(mx, Math.abs((lp - lm) / 2e-6 - g[i])); }
console.log("EFMV grad vs finite difference max abs diff", mx.toExponential(2), "params", m.n);
