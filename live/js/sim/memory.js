// Memory systems (pass 3).
// 1) HDC / vector-symbolic cognitive map: Fourier holographic reduced representations (FHRR). A place is a D-dim unit phasor
//    vector  P(x,z)_j = exp(i (ax_j x + az_j z)) with random frequencies (fractional power encoding, Plate 1995; Frady et al. 2021).
//    Memories are superpositions  M = sum_k w_k P(x_k, z_k); recall at q is Re<M, P(q)>/D, which equals sum_k w_k K(q - x_k)
//    for a smooth kernel K set by the frequency distribution - so one fixed-size vector stores a whole spatial value map and
//    generalises to nearby, never-visited places. Two maps: FOOD (signed outcomes) and VISIT (where the body has been).
// 2) Modern Hopfield network (Ramsauer et al. 2020): episodes are stored as rows of X; retrieval is one step of
//    xi <- X^T softmax(beta X xi). Used for recognition (familiarity -> hippocampus neurons) and to seed REM rollouts from a
//    retrieved, completed memory rather than a random one.
import { mulberry, gauss } from './util.js';
export class HDCMap {
  constructor(seed, D = 512, scale = 0.45) { const r = mulberry(seed * 991 + 7); this.D = D; this.ax = new Float64Array(D); this.az = new Float64Array(D); for (let j = 0; j < D; j++) { this.ax[j] = gauss(r) * scale; this.az[j] = gauss(r) * scale; } this.re = new Float64Array(D); this.im = new Float64Array(D); this.n = 0; }
  add(x, z, w) { const { D, ax, az } = this; for (let j = 0; j < D; j++) { const p = ax[j] * x + az[j] * z; this.re[j] += w * Math.cos(p); this.im[j] += w * Math.sin(p); } this.n++; }
  recall(x, z) { const { D, ax, az } = this; let s = 0; for (let j = 0; j < D; j++) { const p = ax[j] * x + az[j] * z; s += this.re[j] * Math.cos(p) + this.im[j] * Math.sin(p); } return s / D; }
  decay(f) { for (let j = 0; j < this.D; j++) { this.re[j] *= f; this.im[j] *= f; } }
}
export class Hopfield {
  constructor(dim, cap = 256, beta = 8) { this.dim = dim; this.cap = cap; this.beta = beta; this.X = []; this.meta = []; this.lastSim = 0; this.lastIdx = -1; }
  norm(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Float64Array.from(v, (x) => x / s); }
  store(v, meta, r) { const x = this.norm(v); if (this.X.length < this.cap) { this.X.push(x); this.meta.push(meta); } else { const k = Math.floor(r() * this.cap); this.X[k] = x; this.meta[k] = meta; } }
  /** one-step retrieval; returns { xi, w (attention weights), top, sim } */
  retrieve(q) { const X = this.X; if (!X.length) return null; const xq = this.norm(q); const s = X.map((x) => { let d = 0; for (let i = 0; i < this.dim; i++) d += x[i] * xq[i]; return d; });
    let m = -1e9, top = 0; s.forEach((v, i) => { if (v > m) { m = v; top = i; } }); let Z = 0; const w = s.map((v) => { const e = Math.exp(this.beta * (v - m)); Z += e; return e; }); for (let i = 0; i < w.length; i++) w[i] /= Z;
    const xi = new Float64Array(this.dim); for (let k = 0; k < X.length; k++) if (w[k] > 1e-4) for (let i = 0; i < this.dim; i++) xi[i] += w[k] * X[k][i];
    this.lastSim = m; this.lastIdx = top; return { xi, w, top, sim: m }; }
}
