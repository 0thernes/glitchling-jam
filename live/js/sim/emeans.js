// e-means: mini-batch k-means with exponential-moving-average centroid updates.
// Port of Bessa et al., "e-means: outperforming k-means (in one-tenth the epochs)", FAIR/Meta, arXiv 2611.09501
// (https://e-means.github.io; reference code faiss/contrib/e_means). What follows the paper, section by section:
//  - Eq. 2-4: per cluster an EMA count N_j and EMA sum S_j; centroid c_j = S_j / N_j (centroids are never stored).
//  - Init: N_j = 1e-10, S_j = N_j * c_j(0), so the initial centroids are returned exactly but carry no weight.
//    Initial centroids = random choice of data points (Algorithm 1, line 2).
//  - Eq. 5: step alpha = 1 - gamma annealed on a cosine schedule from alpha0 to eps*alpha0, eps = 0.1, over M = T*floor(n/B) updates.
//  - Eq. 6 (step law):  alpha0 = min(0.824 k^-0.46 B^0.90 n^-0.45 T^-0.11, 1)          (Table 2)
//  - Eq. 7 (batch law): B = 0.035 k^0.13 n^0.88 T^0.81, rounded to the nearest power of two, capped at n
//                       (divided by 8 for n > 2M, Table 2 "knee / 8").
//    The laws take n, k, T (and B); dimension d does not appear in them. The paper notes (Sec. 3.3, "Effect of
//    dimensionality & Limitation") that they were fitted on high-dimensional data and are not optimal for very
//    low-dimensional, tiny problems - which is what a creature's senses are. We use them unchanged anyway.
//  - Dead-cluster revival (Sec. 3.1, App. H.1): every 5 batches, clusters with N_j < tau * mean(N), tau = 0.1, are rebuilt
//    by splitting a donor drawn without replacement with probability proportional to N; the donor centroid is
//    multiplied by [1+d,1-d,...] for the dead slot and [1-d,1+d,...] for the donor, d = BF16 machine epsilon (2^-7),
//    and the donor's count is halved between the two; S = c * N is written back.
//  - Finalisation (Sec. 3.2): last-epoch mean (batch mode) and an optional slow EMA (App. I) at a constant step equal to
//    a multiple of the cosine floor eps*alpha0.
// STREAMING ADAPTATION (not in the paper, which clusters a fixed dataset): a creature's sensory stream never ends and
// drifts. In streaming mode, n is a "horizon" (how many recent samples the prototypes should summarise), T = 1, the
// cosine schedule runs over the first M = floor(n/B) updates and then HOLDS at the floor eps*alpha0 instead of stopping,
// so the prototypes keep tracking a non-stationary stream. Initial centroids are the first k samples seen (a random
// choice of the data is not available before the data arrive). There is no last-epoch-mean finalisation in streaming
// mode (there is no last epoch); the slow EMA is kept as the "consolidated" read-out.
// REPLAY (also not in the paper; opts.replay = R > 0): the paper's mini-batches are drawn from a shuffled dataset. A walking
// creature's stream is strongly autocorrelated (128 consecutive place samples are one stretch of path), and feeding such
// batches straight in makes the EMA counts of unvisited clusters decay, so they are "revived" away and places are forgotten
// (measured in test/emeans_streams.mjs). With replay, each new sample goes into an R-slot buffer (random replacement once
// full, so memory decays with mean age R) and every `every` new samples one update runs on B rows drawn uniformly from the
// buffer. Each sample is then seen about B/every times, so the laws are evaluated with T = B/every and M = n/every.
// The creature uses every = B (same update rate as plain streaming, T = 1): more frequent replay (every = B/4) forgot
// unvisited clusters faster and was worse on a synthetic dwell stream (test/emeans_test.mjs).
export const BF16_EPS = 2 ** -7;
export function batchLaw(n, k, T = 1) { let B = 0.035 * k ** 0.13 * n ** 0.88 * T ** 0.81; if (n > 2e6) B /= 8; B = 2 ** Math.round(Math.log2(Math.max(1, B))); return Math.max(1, Math.min(n, B)); }
export function stepLaw(n, k, B, T = 1) { return Math.min(0.824 * k ** -0.46 * B ** 0.9 * n ** -0.45 * T ** -0.11, 1); }
export function cosineStep(t, M, a0, eps = 0.1) { if (t >= M) return eps * a0; return a0 * (eps + (1 - eps) * 0.5 * (1 + Math.cos((Math.PI * t) / M))); }
const rng = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export class EMeans {
  /** opts: k, d, n (dataset size or streaming horizon), T (epochs; 1 in streaming), B / alpha0 (override the laws), seed,
   *  revive (default true), tau (0.1), slow (slow-EMA speed as a multiple of the floor step; 0 = off), streaming (bool) */
  constructor({ k, d, n, T = 1, B, alpha0, seed = 1, revive = true, tau = 0.1, slow = 0, streaming = false, replay = 0, every }) {
    this.k = k; this.d = d; this.n = n; this.T = T; this.B = B ?? batchLaw(n, k, T); this.replay = replay; this.every = every ?? Math.max(1, this.B / 4); if (replay) { this.T = T = this.B / this.every; this.rb = new Float64Array(replay * d); this.rn = 0; this.since = 0; }
    this.alpha0 = alpha0 ?? stepLaw(n, k, this.B, T); this.M = replay ? Math.max(1, Math.floor(n / this.every)) : T * Math.max(1, Math.floor(n / this.B));
    this.N = new Float64Array(k); this.S = new Float64Array(k * d); this.C = new Float64Array(k * d); this.t = 0; this.revive = revive; this.tau = tau; this.streaming = streaming; this.r = rng(seed);
    this.slow = slow; if (slow) { this.Ns = new Float64Array(k); this.Ss = new Float64Array(k * d); }
    this.ready = false; this.nInit = 0; this.buf = new Float64Array(this.B * d); this.nb = 0; this.lastAlpha = this.alpha0; this.revived = 0; this.loss = NaN; this.moved = NaN; this.seen = 0; }
  /** set initial centroids (k x d, row-major) */
  init(C0) { const { k, d } = this; for (let j = 0; j < k; j++) { this.N[j] = 1e-10; for (let i = 0; i < d; i++) { this.S[j * d + i] = 1e-10 * C0[j * d + i]; this.C[j * d + i] = C0[j * d + i]; } if (this.slow) { this.Ns[j] = 1e-10; for (let i = 0; i < d; i++) this.Ss[j * d + i] = 1e-10 * C0[j * d + i]; } } this.ready = true; this.nInit = k; }
  /** nearest centroid: returns index; this.lastD2 holds the squared distance */
  assign(x, off = 0) { const { k, d, C } = this; let best = 0, bd = Infinity; for (let j = 0; j < k; j++) { let s = 0; const o = j * d; for (let i = 0; i < d; i++) { const u = x[off + i] - C[o + i]; s += u * u; if (s >= bd) break; } if (s < bd) { bd = s; best = j; } } this.lastD2 = bd; return best; }
  /** soft assignment (softmax of -d^2 / temp) into out[k] */
  soft(x, out, temp = 1) { const { k, d, C } = this; let mx = -Infinity; for (let j = 0; j < k; j++) { let s = 0; const o = j * d; for (let i = 0; i < d; i++) { const u = x[i] - C[o + i]; s += u * u; } out[j] = -s / temp; if (out[j] > mx) mx = out[j]; } let z = 0; for (let j = 0; j < k; j++) { out[j] = Math.exp(out[j] - mx); z += out[j]; } for (let j = 0; j < k; j++) out[j] /= z; return out; }
  /** one EMA update on a batch X (nb x d, row-major). Returns the batch's mean squared distance before the update. */
  update(X, nb) { const { k, d } = this; const cnt = new Float64Array(k), sum = new Float64Array(k * d); let L = 0; const a = new Int32Array(nb);
    for (let b = 0; b < nb; b++) { const j = this.assign(X, b * d); a[b] = j; L += this.lastD2; cnt[j]++; for (let i = 0; i < d; i++) sum[j * d + i] += X[b * d + i]; }
    const al = cosineStep(this.t, this.M, this.alpha0); this.lastAlpha = al; const g = 1 - al; this.t++;
    let mv = 0; for (let j = 0; j < k; j++) { this.N[j] = g * this.N[j] + al * cnt[j]; for (let i = 0; i < d; i++) { const o = j * d + i; this.S[o] = g * this.S[o] + al * sum[o]; const c = this.S[o] / this.N[j]; mv += (c - this.C[o]) ** 2; this.C[o] = c; } }
    if (this.slow) { const as = this.slow * 0.1 * this.alpha0, gs = 1 - as; for (let j = 0; j < k; j++) { this.Ns[j] = gs * this.Ns[j] + as * cnt[j]; for (let i = 0; i < d; i++) this.Ss[j * d + i] = gs * this.Ss[j * d + i] + as * sum[j * d + i]; } }
    if (this.revive && this.t % 5 === 0) this.reviveDead(); this.loss = L / nb; this.moved = Math.sqrt(mv / k); this.lastAssign = a; return this.loss; }
  /** App. H.1: split donors (drawn without replacement, prob. proportional to N) into clusters whose N < tau * mean N */
  reviveDead() { const { k, d } = this; let mean = 0; for (let j = 0; j < k; j++) mean += this.N[j]; mean /= k; const dead = []; for (let j = 0; j < k; j++) if (this.N[j] < this.tau * mean) dead.push(j); if (!dead.length) return 0;
    const avail = new Uint8Array(k).fill(1); for (const j of dead) avail[j] = 0; let n = 0;
    for (const j of dead) { let tot = 0; for (let q = 0; q < k; q++) if (avail[q]) tot += this.N[q]; if (tot <= 0) break; let u = this.r() * tot, dn = -1; for (let q = 0; q < k; q++) { if (!avail[q]) continue; u -= this.N[q]; if (u <= 0) { dn = q; break; } } if (dn < 0) break; avail[dn] = 0;
      const h = this.N[dn] / 2; this.N[dn] = h; this.N[j] = h; for (let i = 0; i < d; i++) { const c = this.C[dn * d + i], s = i % 2 === 0 ? 1 : -1; this.C[j * d + i] = c * (1 + s * BF16_EPS); this.C[dn * d + i] = c * (1 - s * BF16_EPS); this.S[j * d + i] = this.C[j * d + i] * h; this.S[dn * d + i] = this.C[dn * d + i] * h; }
      if (this.slow) { this.Ns[j] = this.Ns[dn] / 2; this.Ns[dn] /= 2; for (let i = 0; i < d; i++) { this.Ss[j * d + i] = this.C[j * d + i] * this.Ns[j]; this.Ss[dn * d + i] = this.C[dn * d + i] * this.Ns[dn]; } } n++; }
    this.revived += n; return n; }
  /** streaming: add one sample; the first k samples become the initial centroids, then every B samples trigger an update */
  push(x) { const d = this.d; this.seen++; if (!this.ready) { if (!this.C0) this.C0 = new Float64Array(this.k * d); this.C0.set(x.subarray ? x.subarray(0, d) : x.slice(0, d), this.nInit * d); this.nInit++; if (this.nInit === this.k) this.init(this.C0); return false; }
    if (this.replay) { const R = this.replay, row = this.rn < R ? this.rn++ : Math.floor(this.r() * R); this.rb.set(x.subarray ? x.subarray(0, d) : x.slice(0, d), row * d); if (++this.since < this.every) return false; this.since = 0;
      for (let b = 0; b < this.B; b++) { const q = Math.floor(this.r() * this.rn); this.buf.set(this.rb.subarray(q * d, q * d + d), b * d); } this.update(this.buf, this.B); return true; }
    this.buf.set(x.subarray ? x.subarray(0, d) : x.slice(0, d), this.nb * d); this.nb++; if (this.nb >= this.B) { this.update(this.buf, this.nb); this.nb = 0; return true; } return false; }
  /** batch mode (Algorithm 1): T epochs over X (n x d), random-choice init, revival, last-epoch-mean finalisation */
  fit(X, n, onBatch) { const { k, d } = this; const idx = Array.from({ length: n }, (_, i) => i); const C0 = new Float64Array(k * d); for (let j = 0; j < k; j++) { const q = j + Math.floor(this.r() * (n - j)); [idx[j], idx[q]] = [idx[q], idx[j]]; C0.set(X.subarray(idx[j] * d, idx[j] * d + d), j * d); } this.init(C0);
    const Bt = new Float64Array(this.B * d); const last = new Int32Array(n);
    for (let e = 0; e < this.T; e++) { for (let i = n - 1; i > 0; i--) { const q = Math.floor(this.r() * (i + 1)); [idx[i], idx[q]] = [idx[q], idx[i]]; }
      for (let s = 0; s + this.B <= n; s += this.B) { for (let b = 0; b < this.B; b++) Bt.set(X.subarray(idx[s + b] * d, idx[s + b] * d + d), b * d); this.update(Bt, this.B); if (e === this.T - 1) for (let b = 0; b < this.B; b++) last[idx[s + b]] = this.lastAssign[b]; onBatch?.(this); }
      if (e === this.T - 1) { const tail = n - (n % this.B); for (let s = tail; s < n; s++) last[idx[s]] = this.assign(X, idx[s] * d); } }
    /* last-epoch-mean finalisation: each centroid = mean of the points assigned to it during the last epoch */
    const cnt = new Float64Array(k), sum = new Float64Array(k * d); for (let p = 0; p < n; p++) { const j = last[p]; cnt[j]++; for (let i = 0; i < d; i++) sum[j * d + i] += X[p * d + i]; }
    for (let j = 0; j < k; j++) if (cnt[j] > 0) for (let i = 0; i < d; i++) this.C[j * d + i] = sum[j * d + i] / cnt[j]; this.assignments = last; return this; }
  /** mean squared distance of X (n x d) to the nearest centroid */
  mse(X, n, useSlow = false) { const C = useSlow ? this.slowC() : null; const save = this.C; if (C) this.C = C; let L = 0; for (let p = 0; p < n; p++) { this.assign(X, p * this.d); L += this.lastD2; } this.C = save; return L / n; }
  slowC() { const { k, d } = this; const C = new Float64Array(k * d); for (let j = 0; j < k; j++) for (let i = 0; i < d; i++) C[j * d + i] = this.Ns[j] > 1e-9 ? this.Ss[j * d + i] / this.Ns[j] : this.C[j * d + i]; return C; }
}
