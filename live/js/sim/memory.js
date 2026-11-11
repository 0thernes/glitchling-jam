// Memory systems (pass 3 -> pass 11 -> pass 15 -> pass 16 anatomical trisynaptic hippocampal-entorhinal upgrade).
// 1) HDC / FHRR spatial cognitive map: unit phasors P(x,z)_j = gate_j * exp(i (ax_j x + az_j z)).
//    - Value maps are written error-driven (LMS / delta rule) and keep a replay ring buffer.
//    - Cross-spectral 2-fold coherence + Wiener ARD gate + diagonal Gauss-Newton frequency refinement in N3 sleep improves
//      held-out correlation both when the initial frequency prior is well-tuned (0.35) and when it is mis-tuned (0.8).
// 2) Anatomical Trisynaptic Hippocampal-Entorhinal Circuit (EC_II/III -> DG -> CA3 -> CA1):
//    - EC_II / EC_III (72-D): Empirical-Bayes observation-mask posterior + closed-form Marginalized Denoising Autoencoder (mDAE)
//      manifold denoiser along the perforant and temporoammonic paths (automatically suppressing low-SNR / silent channels).
//    - Dentate Gyrus (DG, 576 granule cells = 8x cortical expansion, k = 28 / 4.9% k-WTA basket-cell lateral inhibition):
//      synaptic receptive fields tile the active entorhinal manifold via competitive Hebbian + anti-Hebbian orthogonalization
//      during N3 sleep, projecting sparse mossy-fiber detonator codes to CA3 for pattern separation.
//    - CA3 (up to 1024 autoassociative engrams): mossy-fiber + SNR-weighted masked-subspace cosine/Mahalanobis scoring followed
//      by 2-step recurrent collateral attractor settlement, usage-based forgetting, and sleep consolidation merging.
//    - CA1 Schaffer-collateral (CA3 -> CA1) vs temporoammonic (EC_III mDAE -> CA1) comparator: computes live CA1 mismatch novelty
//      (gating event-segmented episodic storage) and blends CA3 attractor completion with EC_III manifold-denoised features.
import { mulberry, gauss, clamp } from './util.js';

export const N_DG = 576; // 8x Dentate Gyrus granule-cell expansion over 72-D Entorhinal Cortex
export const K_DG = 28;  // ~4.86% sparse k-WTA granule activation (hilar basket-interneuron inhibition)

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const nrm = (v) => {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = Math.sqrt(s) || 1;
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / s;
  return out;
};

/** Solve (A) X = B in-place via partial-pivoted Gauss-Jordan; A is D x D, B is D x K (both row-major Float64Array). Returns X (D x K). */
function solveMatrix(A, B, D, K) {
  const M = Float64Array.from(A);
  const X = Float64Array.from(B);
  for (let col = 0; col < D; col++) {
    let piv = col, best = Math.abs(M[col * D + col]);
    for (let r = col + 1; r < D; r++) {
      const v = Math.abs(M[r * D + col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-12) continue;
    if (piv !== col) {
      for (let j = col; j < D; j++) { const t = M[col * D + j]; M[col * D + j] = M[piv * D + j]; M[piv * D + j] = t; }
      for (let j = 0; j < K; j++) { const t = X[col * K + j]; X[col * K + j] = X[piv * K + j]; X[piv * K + j] = t; }
    }
    const inv = 1 / M[col * D + col];
    for (let j = col; j < D; j++) M[col * D + j] *= inv;
    for (let j = 0; j < K; j++) X[col * K + j] *= inv;
    for (let r = 0; r < D; r++) {
      if (r === col) continue;
      const f = M[r * D + col];
      if (f === 0) continue;
      for (let j = col; j < D; j++) M[r * D + j] -= f * M[col * D + j];
      for (let j = 0; j < K; j++) X[r * K + j] -= f * X[col * K + j];
    }
  }
  return X;
}

export class HDCMap {
  constructor(seed, D = 1024, scale = 0.45) {
    const r = mulberry(seed * 991 + 7);
    this.r = r;
    this.D = D;
    this.scale0 = scale;
    this.ax = new Float64Array(D);
    this.az = new Float64Array(D);
    for (let j = 0; j < D; j++) {
      this.ax[j] = gauss(r) * scale;
      this.az[j] = gauss(r) * scale;
    }
    this.gate = new Float64Array(D).fill(1);
    this.re = new Float64Array(D);
    this.im = new Float64Array(D);
    this.n = 0;
    this.buf = [];
    this.bufCap = 960;
    this.resampled = 0;
    this.fixed = false;
  }

  add(x, z, w) {
    const { D, ax, az } = this;
    for (let j = 0; j < D; j++) {
      const p = ax[j] * x + az[j] * z;
      this.re[j] += w * Math.cos(p);
      this.im[j] += w * Math.sin(p);
    }
    this.n++;
  }

  recall(x, z) {
    const { D, ax, az, gate, re, im } = this;
    let s = 0;
    if (this.fixed) {
      for (let j = 0; j < D; j++) {
        const p = ax[j] * x + az[j] * z;
        s += re[j] * Math.cos(p) + im[j] * Math.sin(p);
      }
      return s / D;
    }
    for (let j = 0; j < D; j++) {
      const p = ax[j] * x + az[j] * z;
      s += gate[j] * (re[j] * Math.cos(p) + im[j] * Math.sin(p));
    }
    return s / D;
  }

  learn(x, z, y, lr = 0.3, keep = true) {
    const d = y - this.recall(x, z);
    const { D, ax, az, gate, re, im } = this;
    if (this.fixed) {
      for (let j = 0; j < D; j++) {
        const p = ax[j] * x + az[j] * z;
        re[j] += lr * d * Math.cos(p);
        im[j] += lr * d * Math.sin(p);
      }
    } else {
      for (let j = 0; j < D; j++) {
        const g = gate[j] * lr * d;
        const p = ax[j] * x + az[j] * z;
        re[j] += g * Math.cos(p);
        im[j] += g * Math.sin(p);
      }
    }
    this.n++;
    if (keep) {
      if (this.buf.length < this.bufCap) this.buf.push([x, z, y]);
      else this.buf[this.n % this.bufCap] = [x, z, y];
    }
    return d;
  }

  sleep(frac = 0.1, passes = 2) {
    if (this.fixed || this.buf.length < 16) return 0;
    const D = this.D, r = this.r, B = this.buf, M = B.length;
    const reA = new Float64Array(D), imA = new Float64Array(D);
    const reB = new Float64Array(D), imB = new Float64Array(D);

    const perm = new Int32Array(M);
    for (let i = 0; i < M; i++) perm[i] = i;
    for (let i = M - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[k]; perm[k] = t; }
    const half = M >> 1;

    const fitFold = (i0, i1, reF, imF) => {
      for (const eta of [0.28, 0.18]) {
        for (let idx = i0; idx < i1; idx++) {
          const [x, z, y] = B[perm[idx]];
          let pred = 0;
          for (let j = 0; j < D; j++) {
            const p = this.ax[j] * x + this.az[j] * z;
            pred += reF[j] * Math.cos(p) + imF[j] * Math.sin(p);
          }
          const g = eta * (y - pred / D);
          for (let j = 0; j < D; j++) {
            const p = this.ax[j] * x + this.az[j] * z;
            reF[j] += g * Math.cos(p);
            imF[j] += g * Math.sin(p);
          }
        }
      }
    };
    fitFold(0, half, reA, imA);
    fitFold(half, M, reB, imB);

    const coh = new Float64Array(D), rho = new Float64Array(D);
    for (let j = 0; j < D; j++) {
      const c = reA[j] * reB[j] + imA[j] * imB[j];
      const e = 0.5 * (reA[j] * reA[j] + imA[j] * imA[j] + reB[j] * reB[j] + imB[j] * imB[j]) + 1e-8;
      coh[j] = c;
      rho[j] = clamp(c / e, -1, 1);
      this.re[j] = 0.5 * (reA[j] + reB[j]);
      this.im[j] = 0.5 * (imA[j] + imB[j]);
    }

    const idx = Array.from({ length: D }, (_, j) => j).sort((a, b) => coh[a] - coh[b]);
    const maxReplace = Math.floor(D * Math.min(frac, 0.18));
    const nDonors = Math.max(16, Math.floor(D * 0.30));
    const scales = [0.55, 0.80, 1.0, 1.25, 1.65];
    let replaced = 0;
    for (let q = 0; q < maxReplace; q++) {
      const j = idx[q];
      if (rho[j] > 0.32) break;
      const src = idx[D - 1 - Math.floor(r() * nDonors)];
      const mult = scales[q % scales.length];
      let nax = this.ax[src] * mult + 0.06 * gauss(r);
      let naz = this.az[src] * mult + 0.06 * gauss(r);
      const rad = Math.hypot(nax, naz);
      if (rad < 0.04) { nax += 0.18 * gauss(r); naz += 0.18 * gauss(r); }
      else if (rad > 1.6) { nax *= 1.6 / rad; naz *= 1.6 / rad; }
      this.ax[j] = nax;
      this.az[j] = naz;
      this.re[j] = 0;
      this.im[j] = 0;
      rho[j] = 0.22;
      replaced++;
    }

    const gAx = new Float64Array(D), gAz = new Float64Array(D);
    const hAx = new Float64Array(D).fill(1e-5), hAz = new Float64Array(D).fill(1e-5);
    const nSub = Math.min(M, 200);
    for (let s = 0; s < nSub; s++) {
      const [x, z, y] = B[perm[s]];
      let pred = 0;
      for (let j = 0; j < D; j++) {
        const p = this.ax[j] * x + this.az[j] * z;
        pred += this.re[j] * Math.cos(p) + this.im[j] * Math.sin(p);
      }
      const err = pred / D - y;
      for (let j = 0; j < D; j++) {
        const p = this.ax[j] * x + this.az[j] * z;
        const dp = (-this.re[j] * Math.sin(p) + this.im[j] * Math.cos(p)) / D;
        const jx = dp * x, jz = dp * z;
        gAx[j] += err * jx;
        gAz[j] += err * jz;
        hAx[j] += jx * jx;
        hAz[j] += jz * jz;
      }
    }
    for (let j = 0; j < D; j++) {
      if (rho[j] <= 0.05) continue;
      this.ax[j] = clamp(this.ax[j] - 0.035 * (gAx[j] / Math.sqrt(nSub * hAx[j])), -1.8, 1.8);
      this.az[j] = clamp(this.az[j] - 0.035 * (gAz[j] / Math.sqrt(nSub * hAz[j])), -1.8, 1.8);
    }

    let g2Mean = 0;
    for (let j = 0; j < D; j++) {
      const g = 0.22 + 0.95 * Math.max(0, rho[j]);
      this.gate[j] = 0.35 * this.gate[j] + 0.65 * g;
      g2Mean += this.gate[j] * this.gate[j];
    }
    g2Mean /= D;
    const scaleG = Math.sqrt(0.48 / Math.max(0.08, g2Mean));
    for (let j = 0; j < D; j++) this.gate[j] = clamp(this.gate[j] * scaleG, 0.12, 1.35);

    this.re.fill(0);
    this.im.fill(0);
    const nPasses = Math.max(3, passes + 2);
    for (let p = 0; p < nPasses; p++) {
      const eta = 0.42 / (1 + 0.65 * p);
      for (let i = 0; i < M; i++) {
        const [x, z, y] = B[perm[(i + p * 37) % M]];
        this.learn(x, z, y, eta, false);
      }
      for (let j = 0; j < D; j++) { this.re[j] *= 0.996; this.im[j] *= 0.996; }
    }
    this.resampled += replaced;
    return replaced;
  }

  decay(f) {
    for (let j = 0; j < this.D; j++) { this.re[j] *= f; this.im[j] *= f; }
  }
}

export class Hopfield {
  constructor(dim, cap = 1024, beta = 24, seed = 1) {
    this.dim = dim;
    this.cap = cap;
    this.beta = beta;
    this.X = [];        // CA3 unit-normalised engrams
    this.Vraw = [];     // CA3 unnormalised engrams
    this.dgCodes = [];  // Sparse mossy-fiber (DG -> CA3) index codes per slot
    this.meta = [];
    this.use = [];
    this.cnt = [];
    this.Kc = [];
    this.dirty = true;
    this.lastSim = 0;
    this.lastIdx = -1;
    this.merged = 0;
    this.learnKeys = true;
    this.trained = false;
    this.dgSeeded = false;
    this.lesionDG = false;
    this.r = mulberry(seed * 31 + 5);

    // Dentate Gyrus (DG): 576 granule cells (8x expansion) with k-WTA (k = 28, ~4.9% sparsity) pattern separation
    this.nDG = N_DG;
    this.kDG = K_DG;
    this.dgSparsity = K_DG / N_DG;
    this.Wdg = new Float64Array(N_DG * dim);
    for (let g = 0; g < N_DG; g++) {
      let s2 = 0;
      const off = g * dim;
      for (let d = 0; d < dim; d++) {
        const v = gauss(this.r);
        this.Wdg[off + d] = v;
        s2 += v * v;
      }
      const inv = 1 / (Math.sqrt(s2) || 1);
      for (let d = 0; d < dim; d++) this.Wdg[off + d] *= inv;
    }
    this.dgActive = new Uint16Array(K_DG);
    this._dgScores = new Float64Array(N_DG);

    // Entorhinal & CA1 learned parameters (fit unsupervised during N3 sleep):
    this.sig2 = new Float64Array(dim).fill(0.05);
    this.snrGate = new Float64Array(dim).fill(1); // Wiener channel SNR gate sig2 / (sig2 + noise2): 0 on silent channels!
    this.prec = new Float64Array(dim).fill(1);
    this.Wimp = new Float64Array(dim * dim);     // EC mDAE cross-channel denoiser + completer
    this.W = new Float64Array(dim * dim);
    for (let k = 0; k < dim; k++) this.W[k * dim + k] = 1;
    this.conLoss = 0;
    this.denMSE = 0;

    // CA1 comparator telemetry & event-boundary segmentation stats
    this.ca1Novelty = 1.0;
    this.ca3Entropy = 0;
    this.eventsStored = 0;
    this.eventsSkipped = 0;
  }

  norm(v) { return nrm(v); }

  key(v) {
    if (!this.learnKeys || !this.trained) return nrm(v);
    const D = this.dim, out = new Float64Array(D);
    for (let d = 0; d < D; d++) out[d] = this.prec[d] * v[d];
    return nrm(out);
  }

  /**
   * Dentate Gyrus (DG) perforant-path encoder: projects EC state onto 576 granule cells on the learned active
   * signal subspace and enforces hilar basket-cell k-WTA (k=28, 4.9% sparsity) lateral inhibition.
   */
  dgEncode(v, gMask = null) {
    const D = this.dim, G = this.nDG, K = this.kDG;
    const sc = this._dgScores;
    let vNorm2 = 0;
    if (gMask) {
      for (let d = 0; d < D; d++) vNorm2 += gMask[d] * v[d] * v[d];
    } else {
      for (let d = 0; d < D; d++) vNorm2 += v[d] * v[d];
    }
    const invV = 1 / (Math.sqrt(vNorm2) + 1e-8);

    for (let g = 0; g < G; g++) {
      const off = g * D;
      let dp = 0, wNorm2 = 0;
      if (gMask) {
        for (let d = 0; d < D; d++) {
          const gd = gMask[d], wgd = this.Wdg[off + d];
          dp += gd * v[d] * wgd;
          wNorm2 += gd * wgd * wgd;
        }
        sc[g] = (dp * invV) / (Math.sqrt(wNorm2) + 1e-6);
      } else {
        for (let d = 0; d < D; d++) dp += v[d] * this.Wdg[off + d];
        sc[g] = dp * invV;
      }
    }

    const idx = new Uint16Array(K);
    const act = new Float32Array(K);
    act.fill(-1e9);
    for (let g = 0; g < G; g++) {
      const val = sc[g];
      if (val <= act[K - 1]) continue;
      let pos = K - 1;
      while (pos > 0 && val > act[pos - 1]) {
        act[pos] = act[pos - 1];
        idx[pos] = idx[pos - 1];
        pos--;
      }
      act[pos] = val;
      idx[pos] = g;
    }

    const thr = Math.max(0, act[K - 1] * 0.92);
    let a2 = 0;
    for (let k = 0; k < K; k++) {
      const a = Math.max(0, act[k] - thr);
      const p = a * Math.sqrt(a);
      act[k] = p;
      a2 += p * p;
      this.dgActive[k] = idx[k];
    }
    const invA = 1 / (Math.sqrt(a2) || 1);
    for (let k = 0; k < K; k++) act[k] *= invA;
    return { idx, act };
  }

  /** Sparse mossy-fiber dot product between two k-WTA DG codes */
  dgOverlap(cA, cB) {
    if (!cA || !cB || this.lesionDG) return 0;
    const iA = cA.idx, aA = cA.act, iB = cB.idx, aB = cB.act;
    let sum = 0;
    for (let i = 0; i < iA.length; i++) {
      const gi = iA[i];
      for (let j = 0; j < iB.length; j++) {
        if (iB[j] === gi) { sum += aA[i] * aB[j]; break; }
      }
    }
    return sum;
  }

  /**
   * Event-boundary storage gate driven by CA1 Schaffer-vs-temporoammonic mismatch novelty:
   * prevents consecutive smoothly correlated 1-Hz waking states from crowding CA3 with redundant copies.
   */
  shouldStore(v, forceEvent = false, noveltyThr = 0.14) {
    if (forceEvent || this.X.length < 12) return true;
    const x = nrm(v);
    let maxCos = -1;
    for (let i = 0; i < this.X.length; i++) {
      const c = dot(this.X[i], x);
      if (c > maxCos) maxCos = c;
    }
    const nov = Math.max(this.ca1Novelty, 1 - maxCos);
    if (nov >= noveltyThr) return true;
    this.eventsSkipped++;
    return false;
  }

  store(v, meta, r) {
    const x = nrm(v);
    const raw = Float64Array.from(v);
    const dgc = this.trained ? this.dgEncode(x, null) : null;
    this.eventsStored++;
    if (this.X.length < this.cap) {
      this.X.push(x);
      this.Vraw.push(raw);
      this.dgCodes.push(dgc);
      this.meta.push(meta);
      this.use.push(1);
      this.cnt.push(1);
    } else {
      let k = 0;
      if (this.randomReplace) k = Math.floor(r() * this.cap);
      else for (let i = 1; i < this.X.length; i++) if (this.use[i] < this.use[k]) k = i;
      this.X[k] = x;
      this.Vraw[k] = raw;
      this.dgCodes[k] = dgc;
      this.meta[k] = meta;
      this.use[k] = 1;
      this.cnt[k] = 1;
    }
    this.dirty = true;
  }

  /**
   * Anatomical Trisynaptic Retrieval (EC_II/III -> DG -> CA3 -> CA1):
   *  - Raw mode (learnKeys=false): 1-step softmax(beta * X * q) over stored slots.
   *  - Learned trisynaptic mode (learnKeys=true):
   *      1) EC_II/III Empirical-Bayes observation-mask posterior + closed-form mDAE cross-channel manifold denoiser
   *         (zeroing out silent/low-SNR channels where raw keys are dominated by additive noise!).
   *      2) DG 576-granule-cell 5% k-WTA sparse pattern separation + mossy-fiber projection onto CA3.
   *      3) CA3 SNR-weighted masked-subspace cosine + mossy-fiber drive + 2-step recurrent collateral attractor.
   *      4) CA1 Schaffer-collateral (CA3) + temporoammonic (EC_III mDAE manifold) comparator & adaptive readout.
   */
  retrieve(q) {
    const X = this.X, N = X.length, D = this.dim;
    if (!N) return null;

    if (!this.learnKeys || !this.trained) {
      if (this.dirty || this.Kc.length !== N) {
        this.Kc = X.map((x) => nrm(x));
        this.dirty = false;
      }
      const kq = nrm(q);
      const s = new Float64Array(N);
      let m = -1e9, top = 0;
      for (let n = 0; n < N; n++) {
        const v = dot(this.Kc[n], kq);
        s[n] = v;
        if (v > m) { m = v; top = n; }
      }
      let Z = 0;
      const w = new Float64Array(N);
      for (let n = 0; n < N; n++) { const e = Math.exp(this.beta * (s[n] - m)); w[n] = e; Z += e; }
      const xi = new Float64Array(D);
      for (let n = 0; n < N; n++) {
        const wn = w[n] / Z;
        w[n] = wn;
        if (wn > 1e-4) {
          this.use[n] += wn;
          const xn = X[n];
          for (let d = 0; d < D; d++) xi[d] += wn * xn[d];
        }
      }
      this.lastSim = m;
      this.lastIdx = top;
      this.ca1Novelty = clamp(1 - m, 0, 1);
      return { xi, w, top, sim: m, novelty: this.ca1Novelty };
    }

    // 1) EC_II / EC_III Empirical-Bayes noise-floor & observation-mask posterior + mDAE cross-channel completion
    const q2s = Float64Array.from(q, (v) => v * v).sort();
    const sigmaN2 = clamp(q2s[Math.floor(D * 0.35)] / 0.21, 0.0018, 0.006);
    const inv2Sig = 0.5 / sigmaN2;
    const LN2 = 0.6931471805599453;

    const vMdae = new Float64Array(D);
    const wObs = new Float64Array(D);
    let qSub2 = 0;
    for (let d = 0; d < D; d++) {
      let pred = 0;
      const off = d * D;
      for (let j = 0; j < D; j++) pred += this.Wimp[off + j] * q[j];
      vMdae[d] = pred;
      const s2 = this.sig2[d];
      if (s2 < 5e-5) { wObs[d] = 0; continue; }
      const snr = s2 / (s2 + sigmaN2);
      const llr = clamp(0.5 * q[d] * q[d] * (1 / sigmaN2 - 1 / (s2 + sigmaN2)) - 0.5 * Math.log(1 + s2 / sigmaN2), -10, 10);
      const wo = snr * (1 / (1 + Math.exp(-llr)));
      wObs[d] = wo;
      qSub2 += wo * q[d] * q[d];
    }
    const invQSub = 1 / (Math.sqrt(qSub2) + 1e-6);
    const xMdae = nrm(vMdae);

    // 2) Dentate Gyrus (DG, 576 granule cells, 4.9% k-WTA) sparse pattern separation + nonlinear prototype completion
    const qDG = this.lesionDG ? null : this.dgEncode(xMdae, null);
    const vEC = new Float64Array(D);
    if (qDG && this.Rdg) {
      for (let d = 0; d < D; d++) {
        let dgRec = 0;
        for (let k = 0; k < K_DG; k++) dgRec += qDG.act[k] * this.Rdg[qDG.idx[k] * D + d];
        vEC[d] = 0.88 * vMdae[d] + 0.12 * dgRec;
      }
    } else {
      vEC.set(vMdae);
    }
    const xEC = nrm(vEC);

    // 3) CA3 Perforant Subspace Cosine + DG Mossy-Fiber Code + Rectified NMDA Dendritic Spine Mixture Log-Likelihood
    const s1 = new Float64Array(N);
    let m1 = -1e9;
    for (let n = 0; n < N; n++) {
      const vn = this.Vraw[n], xn = X[n];
      let dotSub = 0, vSub2 = 1e-6, sumL = 0;
      for (let d = 0; d < D; d++) {
        const w = wObs[d], vd = vn[d];
        dotSub += w * q[d] * vd;
        vSub2 += w * vd * vd;
        if (vd !== 0) {
          const u = clamp((2 * q[d] * vd - vd * vd) * inv2Sig, -20, 35);
          const lse = u > 0 ? u + Math.log(1 + Math.exp(-u)) : Math.log(1 + Math.exp(u));
          sumL += lse - LN2;
        }
      }
      const cosSub = (dotSub * invQSub) / Math.sqrt(vSub2);
      const dgSim = qDG ? this.dgOverlap(qDG, this.dgCodes[n]) : 0;
      const nmdaPlateau = Math.max(0, sumL);
      const sc = 0.54 * dot(xMdae, xn) + 0.36 * cosSub + 0.10 * dgSim + 0.025 * nmdaPlateau;
      s1[n] = sc;
      if (sc > m1) m1 = sc;
    }

    // 2-step CA3 recurrent collateral attractor settlement
    const ca3Step1 = new Float64Array(D);
    for (let n = 0; n < N; n++) {
      const e = Math.exp(clamp(18 * (s1[n] - m1), -35, 0));
      if (e > 1e-4) {
        const xn = X[n];
        for (let d = 0; d < D; d++) ca3Step1[d] += e * xn[d];
      }
    }
    const ca3Mid = nrm(ca3Step1);

    let m = -1e9, top = 0;
    const s = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const sc = 0.85 * s1[n] + 0.15 * dot(X[n], ca3Mid);
      s[n] = sc;
      if (sc > m) { m = sc; top = n; }
    }

    let Z = 0;
    const w = new Float64Array(N);
    for (let n = 0; n < N; n++) { const e = Math.exp(clamp(20 * (s[n] - m), -35, 0)); w[n] = e; Z += e; }
    const xiCA3 = new Float64Array(D);
    let ent = 0;
    for (let n = 0; n < N; n++) {
      const wn = w[n] / Z;
      w[n] = wn;
      if (wn > 1e-4) {
        this.use[n] += wn;
        ent -= wn * Math.log(wn + 1e-12);
        const xn = X[n];
        for (let d = 0; d < D; d++) xiCA3[d] += wn * xn[d];
      }
    }
    this.ca3Entropy = ent;
    const ca3Final = nrm(xiCA3);

    // 4) CA1 Schaffer-collateral (CA3 attractor) + Temporoammonic (EC_III mDAE+DG manifold) Comparator & Readout
    const ca1Agree = dot(ca3Final, xEC);
    const hitSharp = w[top];
    this.ca1Novelty = clamp(1 - 0.55 * ca1Agree - 0.45 * hitSharp, 0, 1);

    const alpha = clamp(0.56 + 0.24 * hitSharp, 0.56, 0.80);
    const xi = new Float64Array(D);
    for (let d = 0; d < D; d++) xi[d] = alpha * ca3Final[d] + (1 - alpha) * xEC[d];
    const xiOut = nrm(xi);
    this.lastSim = clamp(Math.min(1, m), -1, 1);
    this.lastIdx = top;
    return { xi: xiOut, w, top, sim: this.lastSim, novelty: this.ca1Novelty };
  }

  /** Sleep consolidation: usage decay, CA3 near-duplicate merging, DG manifold orthogonalization, mDAE + InfoNCE */
  sleep(steps = 30) {
    const X = this.X, V = this.Vraw;
    for (let i = 0; i < this.use.length; i++) this.use[i] *= 0.9;
    let merged = 0;
    for (let i = 0; i < X.length; i++) {
      for (let j = i + 1; j < X.length; j++) {
        if (dot(X[i], X[j]) > 0.97) {
          const a = this.cnt[i], b = this.cnt[j];
          const u = new Float64Array(this.dim), vr = new Float64Array(this.dim);
          for (let d = 0; d < this.dim; d++) {
            u[d] = (a * X[i][d] + b * X[j][d]) / (a + b);
            vr[d] = (a * V[i][d] + b * V[j][d]) / (a + b);
          }
          X[i] = nrm(u);
          V[i] = vr;
          this.cnt[i] += b;
          this.use[i] += this.use[j];
          X.splice(j, 1); V.splice(j, 1); this.dgCodes.splice(j, 1);
          this.meta.splice(j, 1); this.cnt.splice(j, 1); this.use.splice(j, 1);
          j--;
          merged++;
        }
      }
    }
    this.merged += merged;
    if (this.learnKeys && X.length >= 16) this.contrast(steps);
    this.dirty = true;
    return merged;
  }

  contrast(steps = 30, lr = 0.05, tau = 14) {
    const N = this.Vraw.length, r = this.r, D = this.dim, B = 16;
    if (N < B) return;

    // 1) Empirical clean per-channel variance sig2[d], Wiener SNR gate, and covariance C = (1/N) V^T V
    const C = new Float64Array(D * D);
    let tr = 0;
    for (let d = 0; d < D; d++) this.sig2[d] = 0;
    for (let n = 0; n < N; n++) {
      const v = this.Vraw[n];
      for (let i = 0; i < D; i++) {
        const vi = v[i], off = i * D;
        this.sig2[i] += vi * vi;
        for (let j = i; j < D; j++) C[off + j] += vi * v[j];
      }
    }
    for (let i = 0; i < D; i++) {
      this.sig2[i] /= N;
      this.snrGate[i] = this.sig2[i] / (this.sig2[i] + 0.0025);
      tr += C[i * D + i];
      for (let j = 0; j < i; j++) C[i * D + j] = C[j * D + i];
    }

    // 2) Seed & train Dentate Gyrus (DG, 576 granule cells) strictly on the active entorhinal manifold
    if (!this.dgSeeded) {
      this.dgSeeded = true;
      for (let g = 0; g < this.nDG; g++) {
        const a = this.X[g % N], b = this.X[(g * 13 + 7) % N];
        const off = g * D;
        let n2 = 0;
        for (let d = 0; d < D; d++) {
          const v = (a[d] + 0.35 * (b[d] - a[d]) + 0.08 * gauss(r)) * Math.sqrt(this.snrGate[d]);
          this.Wdg[off + d] = v;
          n2 += v * v;
        }
        const inv = 1 / (Math.sqrt(n2) || 1);
        for (let d = 0; d < D; d++) this.Wdg[off + d] *= inv;
      }
    }
    for (let ep = 0; ep < 2; ep++) {
      const etaDG = 0.16 / (1 + ep);
      for (let n = 0; n < N; n++) {
        const xn = this.X[n];
        let g1 = 0, s1 = -1e9, g2 = 1, s2 = -1e9;
        for (let g = 0; g < this.nDG; g++) {
          const off = g * D;
          let dp = 0;
          for (let d = 0; d < D; d++) dp += xn[d] * this.Wdg[off + d];
          if (dp > s1) { s2 = s1; g2 = g1; s1 = dp; g1 = g; }
          else if (dp > s2) { s2 = dp; g2 = g; }
        }
        const o1 = g1 * D, o2 = g2 * D;
        let n1 = 0, n2 = 0;
        for (let d = 0; d < D; d++) {
          this.Wdg[o1 + d] += etaDG * (xn[d] - s1 * this.Wdg[o1 + d]);
          n1 += this.Wdg[o1 + d] ** 2;
          if (s2 > 0.65) this.Wdg[o2 + d] -= 0.05 * etaDG * (xn[d] - s2 * this.Wdg[o2 + d]);
          n2 += this.Wdg[o2 + d] ** 2;
        }
        const inv1 = 1 / (Math.sqrt(n1) || 1), inv2 = 1 / (Math.sqrt(n2) || 1);
        for (let d = 0; d < D; d++) { this.Wdg[o1 + d] *= inv1; this.Wdg[o2 + d] *= inv2; }
      }
    }

    // 3) Exact analytical Marginalized Denoising Autoencoder (mDAE, Chen et al. 2012) on EC perforant correlations:
    //    E[q q^T]_{i,j} = 0.25 C_{i,j} (i != j),  0.5 C_{i,i} + sigma_n^2 + reg (i == j);  E[v q^T] = 0.5 C.
    const G = new Float64Array(D * D);
    const RHS = new Float64Array(D * D);
    const noiseAndReg = 0.0025 + 0.008 * (tr / (N * D));
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        const cij = C[i * D + j] / N;
        G[i * D + j] = i === j ? 0.5 * cij + noiseAndReg : 0.25 * cij;
        RHS[i * D + j] = 0.5 * cij;
      }
    }
    const Wm = solveMatrix(G, RHS, D, D);
    for (let d = 0; d < D; d++) for (let j = 0; j < D; j++) this.Wimp[d * D + j] = Wm[j * D + d];

    // 4) Contrastive InfoNCE training of channel precisions `this.prec[d]`
    if (!this.trained) {
      for (let d = 0; d < D; d++) this.prec[d] = 0.30 + 0.90 * this.snrGate[d];
      this.trained = true;
    }
    let L = 0, mse = 0;
    const qTmp = new Float64Array(D);
    const gradP = new Float64Array(D);
    for (let st = 0; st < steps; st++) {
      const Q = new Array(B), Tgt = new Array(B);
      for (let b = 0; b < B; b++) {
        const idx = Math.floor(r() * N);
        const v = this.Vraw[idx], x = this.X[idx];
        Tgt[b] = x;
        for (let d = 0; d < D; d++) qTmp[d] = (r() < 0.5 ? 0 : v[d]) + 0.05 * gauss(r);
        const full = new Float64Array(D);
        for (let d = 0; d < D; d++) {
          let pr = 0;
          const off = d * D;
          for (let j = 0; j < D; j++) pr += this.Wimp[off + j] * qTmp[j];
          full[d] = pr;
        }
        const u = nrm(full);
        if (st === steps - 1) for (let d = 0; d < D; d++) mse += (u[d] - x[d]) ** 2;
        Q[b] = u;
      }
      gradP.fill(0);
      for (let i = 0; i < B; i++) {
        const s = new Float64Array(B);
        let m = -1e9;
        for (let j = 0; j < B; j++) {
          let sc = 0;
          for (let d = 0; d < D; d++) sc += this.prec[d] * Q[i][d] * Tgt[j][d];
          sc *= tau;
          s[j] = sc;
          if (sc > m) m = sc;
        }
        let Z = 0;
        const p = new Float64Array(B);
        for (let j = 0; j < B; j++) { const e = Math.exp(s[j] - m); p[j] = e; Z += e; }
        L -= Math.log(p[i] / Z + 1e-12);
        for (let j = 0; j < B; j++) {
          const c = tau * (p[j] / Z - (i === j ? 1 : 0));
          for (let d = 0; d < D; d++) gradP[d] += c * Q[i][d] * Tgt[j][d];
        }
      }
      let pMean = 0;
      for (let d = 0; d < D; d++) {
        this.prec[d] = clamp(this.prec[d] - (lr / B) * gradP[d], 0.15, 2.5);
        pMean += this.prec[d];
      }
      pMean /= D;
      for (let d = 0; d < D; d++) {
        this.prec[d] /= pMean || 1;
        this.W[d * D + d] = this.prec[d];
      }
    }

    // Refresh sparse mossy-fiber DG codes and fit DG -> EC nonlinear prototype reconstruction table Rdg
    this.Rdg = this.Rdg || new Float64Array(this.nDG * D);
    this.Rdg.fill(0);
    const dgWsum = new Float64Array(this.nDG);
    for (let n = 0; n < N; n++) {
      const dgc = this.dgEncode(this.X[n], null);
      this.dgCodes[n] = dgc;
      const vn = this.Vraw[n];
      for (let k = 0; k < K_DG; k++) {
        const g = dgc.idx[k], ak = dgc.act[k], off = g * D;
        dgWsum[g] += ak;
        for (let d = 0; d < D; d++) this.Rdg[off + d] += ak * vn[d];
      }
    }
    for (let g = 0; g < this.nDG; g++) {
      const inv = dgWsum[g] > 1e-6 ? 1 / dgWsum[g] : 0, off = g * D;
      for (let d = 0; d < D; d++) this.Rdg[off + d] *= inv;
    }

    this.conLoss = L / (steps * B);
    this.denMSE = mse / B;
  }
}
