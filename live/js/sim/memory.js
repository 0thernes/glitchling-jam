// Memory systems (pass 3, rebuilt in pass 11).
// 1) HDC / vector-symbolic cognitive map: Fourier holographic reduced representations (FHRR). A place is a D-dim unit phasor
//    vector  P(x,z)_j = exp(i (ax_j x + az_j z))  (fractional power encoding, Plate 1995; Frady et al. 2021). Recall at q is
//    Re<M, P(q)>/D = sum_k w_k K(q - x_k) for a kernel K set by the frequency distribution, so one vector holds a whole
//    spatial value map and generalises to never-visited places.
//    Pass 11: (a) value maps are written error-driven (LMS / delta rule: M += lr (y - recall) P) instead of pure superposition,
//    so recall converges to the local mean outcome instead of growing with visit count; (b) the encoder itself is learned:
//    in sleep, the 10% of phasor features carrying the least weight are re-drawn from the frequencies of the most useful
//    features (with jitter) and the map is re-fitted by replaying recent samples. The frequency spectrum therefore drifts
//    toward the spatial scales present in the creature's own data (a resampling form of kernel learning). Visit maps stay
//    plain superpositions (they are densities).
// 2) Modern Hopfield network (Ramsauer et al. 2020): xi <- V^T softmax(beta K q). Pass 11: up to 1024 slots; usage-based
//    forgetting (the least-retrieved slot is overwritten, not a random one); sleep consolidation merges near-duplicate
//    episodes (cosine > 0.97, count-weighted); keys pass through a learned linear map W (72x72, starts at identity) trained
//    in sleep with a contrastive (InfoNCE) objective: a half-masked, noisy replay of a stored episode should score its own
//    key above 15 others.
import { mulberry, gauss } from './util.js';
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const nrm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Float64Array.from(v, (x) => x / s); };
export class HDCMap {
  constructor(seed, D = 1024, scale = 0.45) { const r = mulberry(seed * 991 + 7); this.r = r; this.D = D; this.ax = new Float64Array(D); this.az = new Float64Array(D); for (let j = 0; j < D; j++) { this.ax[j] = gauss(r) * scale; this.az[j] = gauss(r) * scale; } this.re = new Float64Array(D); this.im = new Float64Array(D); this.n = 0; this.buf = []; this.resampled = 0; this.fixed = false; }
  add(x, z, w) { const { D, ax, az } = this; for (let j = 0; j < D; j++) { const p = ax[j] * x + az[j] * z; this.re[j] += w * Math.cos(p); this.im[j] += w * Math.sin(p); } this.n++; }
  recall(x, z) { const { D, ax, az } = this; let s = 0; for (let j = 0; j < D; j++) { const p = ax[j] * x + az[j] * z; s += this.re[j] * Math.cos(p) + this.im[j] * Math.sin(p); } return s / D; }
  /** error-driven write; keeps a replay buffer for sleep-time refits */
  learn(x, z, y, lr = 0.3, keep = true) { const d = y - this.recall(x, z); const { D, ax, az } = this; for (let j = 0; j < D; j++) { const p = ax[j] * x + az[j] * z; this.re[j] += lr * d * Math.cos(p); this.im[j] += lr * d * Math.sin(p); } this.n++; if (keep) { this.buf.push([x, z, y]); if (this.buf.length > 300) this.buf.splice(Math.floor(this.r() * 300), 1); } return d; }
  /** sleep: re-draw the weakest features from the strongest ones, then refit by replay */
  sleep(frac = 0.1, passes = 2) { if (this.fixed || this.buf.length < 8) return 0; const D = this.D, r = this.r; const w = new Float64Array(D); for (let j = 0; j < D; j++) w[j] = this.re[j] ** 2 + this.im[j] ** 2; const idx = Array.from({ length: D }, (_, j) => j).sort((a, b) => w[a] - w[b]); const n = Math.floor(D * frac);
    for (let q = 0; q < n; q++) { const j = idx[q], src = idx[D - 1 - Math.floor(r() * D * 0.5)]; this.ax[j] = this.ax[src] * (1 + 0.15 * gauss(r)) + 0.03 * gauss(r); this.az[j] = this.az[src] * (1 + 0.15 * gauss(r)) + 0.03 * gauss(r); this.re[j] = 0; this.im[j] = 0; }
    for (let p = 0; p < passes; p++) for (const [x, z, y] of this.buf) this.learn(x, z, y, 0.3, false); this.resampled += n; return n; }
  decay(f) { for (let j = 0; j < this.D; j++) { this.re[j] *= f; this.im[j] *= f; } }
}
export class Hopfield {
  constructor(dim, cap = 1024, beta = 24, seed = 1) { this.dim = dim; this.cap = cap; this.beta = beta; this.X = []; this.meta = []; this.use = []; this.cnt = []; this.Kc = []; this.dirty = true; this.lastSim = 0; this.lastIdx = -1; this.merged = 0; this.learnKeys = true; this.r = mulberry(seed * 31 + 5);
    this.W = Array.from({ length: dim }, (_, k) => Float64Array.from({ length: dim }, (_, d) => (k === d ? 1 : 0) + 0.01 * gauss(this.r))); this.conLoss = 0; }
  norm(v) { return nrm(v); }
  key(v) { if (!this.learnKeys) return nrm(v); const y = new Float64Array(this.dim); for (let k = 0; k < this.dim; k++) y[k] = dot(this.W[k], v); return nrm(y); }
  store(v, meta, r) { const x = nrm(v); if (this.X.length < this.cap) { this.X.push(x); this.meta.push(meta); this.use.push(1); this.cnt.push(1); } else { let k = 0; if (this.randomReplace) k = Math.floor(r() * this.cap); else for (let i = 1; i < this.X.length; i++) if (this.use[i] < this.use[k]) k = i; /* forget the least-used slot */ this.X[k] = x; this.meta[k] = meta; this.use[k] = 1; this.cnt[k] = 1; } this.dirty = true; }
  /** one-step retrieval; returns { xi, w (attention weights), top, sim } */
  retrieve(q) { const X = this.X; if (!X.length) return null; if (this.dirty || this.Kc.length !== X.length) { this.Kc = X.map((x) => this.key(x)); this.dirty = false; } const kq = this.key(q); const s = this.Kc.map((k) => dot(k, kq));
    let m = -1e9, top = 0; s.forEach((v, i) => { if (v > m) { m = v; top = i; } }); let Z = 0; const w = s.map((v) => { const e = Math.exp(this.beta * (v - m)); Z += e; return e; }); for (let i = 0; i < w.length; i++) w[i] /= Z;
    const xi = new Float64Array(this.dim); for (let k = 0; k < X.length; k++) if (w[k] > 1e-4) { this.use[k] += w[k]; for (let i = 0; i < this.dim; i++) xi[i] += w[k] * X[k][i]; }
    this.lastSim = m; this.lastIdx = top; return { xi, w, top, sim: m }; }
  /** sleep consolidation: usage decay, merge near-duplicates, contrastive key learning. Returns slots merged. */
  sleep(steps = 30) { const X = this.X; for (let i = 0; i < this.use.length; i++) this.use[i] *= 0.9; let merged = 0;
    for (let i = 0; i < X.length; i++) for (let j = i + 1; j < X.length; j++) if (dot(X[i], X[j]) > 0.97) { const a = this.cnt[i], b = this.cnt[j]; X[i] = nrm(X[i].map((x, d) => (a * x + b * X[j][d]) / (a + b))); this.cnt[i] += b; this.use[i] += this.use[j]; for (const L of [X, this.meta, this.cnt, this.use]) L.splice(j, 1); j--; merged++; }
    this.merged += merged; if (this.learnKeys) this.contrast(steps); this.dirty = true; return merged; }
  contrast(steps = 30, lr = 0.005, tau = 4) { const N = this.X.length, r = this.r, D = this.dim, B = 16; if (N < B) return; let L = 0;
    for (let st = 0; st < steps; st++) { const Bv = [], Av = []; for (let b = 0; b < B; b++) { const x = this.X[Math.floor(r() * N)]; Bv.push(x); Av.push(Float64Array.from(x, (v) => (r() < 0.5 ? 0 : v) + 0.05 * gauss(r))); }
      const WA = Av.map((a) => this.W.map((w) => dot(w, a))), WB = Bv.map((b) => this.W.map((w) => dot(w, b))); const G = this.W.map(() => new Float64Array(D));
      for (let i = 0; i < B; i++) { const s = WB.map((wb) => tau * dot(WA[i], wb)); const m = Math.max(...s); let Z = 0; const p = s.map((v) => { const e = Math.exp(v - m); Z += e; return e; }); for (let j = 0; j < B; j++) p[j] /= Z; L -= Math.log(p[i] + 1e-12);
        for (let j = 0; j < B; j++) { const c = tau * (p[j] - (i === j ? 1 : 0)); if (Math.abs(c) < 1e-5) continue; for (let k = 0; k < D; k++) { const g1 = c * WB[j][k], g2 = c * WA[i][k], Gk = G[k], ai = Av[i], bj = Bv[j]; for (let d = 0; d < D; d++) Gk[d] += g1 * ai[d] + g2 * bj[d]; } } }
      for (let k = 0; k < D; k++) for (let d = 0; d < D; d++) this.W[k][d] -= (lr / B) * G[k][d];
      let F = 0; for (const w of this.W) F += dot(w, w); F = Math.sqrt(D / F); for (const w of this.W) for (let d = 0; d < D; d++) w[d] *= F; }
    this.conLoss = L / (steps * B); }
}
