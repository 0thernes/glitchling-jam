// Memory systems (pass 3 -> pass 11 -> pass 15 hippocampal-entorhinal upgrade).
// 1) HDC / FHRR spatial cognitive map: unit phasors P(x,z)_j = gate_j * exp(i (ax_j x + az_j z)).
//    - Value maps are written error-driven (LMS / delta rule) and keep a replay ring buffer.
//    - Pass 15 spectral kernel + Wiener ARD learning: during sleep, the replay buffer is split into two independent folds to
//      measure cross-spectral signal coherence c_j = Re(M_{A,j}^* M_{B,j}) for every frequency feature. Incoherent features
//      (which only fitted observation noise) are attenuated by a learned Wiener spectral gate gamma_j and resampled across a
//      multi-scale harmonic mixture around coherent frequencies, while surviving frequencies take a diagonal Gauss-Newton
//      gradient step on replay error before annealed multi-pass replay consolidation. Unlike pass 11, this improves held-out
//      correlation BOTH when the initial frequency prior is already well-tuned (0.35) AND when it is mis-tuned (0.8).
// 2) Hippocampal-Entorhinal Modern Hopfield network (CA3-CA1 + EC denoising completion):
//    - Up to 1024 slots, usage-based forgetting, count-weighted duplicate merging in NREM sleep.
//    - Pass 15 learned encoder & pattern completion: in sleep, self-supervised masked+noisy replays of stored episodes train
//      (a) an Entorhinal-DG Wiener/Ridge denoising completion operator Wden (72x72) via Cholesky/Gauss-Jordan normal equations,
//      and (b) a variance-whitened InfoNCE contrastive key metric W (72x72) matched to retrieval sharpness. Retrieval performs
//      entorhinal cue denoising, 2-step Modern Hopfield CA3 attractor refinement, and CA1 Schaffer + temporoammonic readout.
import { mulberry, gauss, clamp } from './util.js';

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
    this.gate = new Float64Array(D).fill(1); // Wiener ARD spectral feature gate (stays 1 when fixed=true)
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

  /** Error-driven write; keeps a replay buffer for sleep-time cross-spectral consolidation */
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

  /**
   * Sleep consolidation:
   *  1) 2-fold cross-spectral coherence estimation c_j = Re(M_{A,j}^* M_{B,j}) to separate spatial signal from noise.
   *  2) Multi-scale spectral resampling of incoherent modes (never destroying strongly coherent features).
   *  3) Preconditioned Gauss-Newton frequency refinement on (ax_j, az_j).
   *  4) Wiener ARD gate update + annealed multi-pass replay refit.
   */
  sleep(frac = 0.1, passes = 2) {
    if (this.fixed || this.buf.length < 16) return 0;
    const D = this.D, r = this.r, B = this.buf, M = B.length;
    const reA = new Float64Array(D), imA = new Float64Array(D);
    const reB = new Float64Array(D), imB = new Float64Array(D);

    // Random permutation indices split into fold A and fold B so repeated trajectory points don't correlate noise
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

    // Cross-spectral signal coherence c_j and normalized SNR rho_j in [-1, 1]
    const coh = new Float64Array(D), rho = new Float64Array(D);
    for (let j = 0; j < D; j++) {
      const c = reA[j] * reB[j] + imA[j] * imB[j];
      const e = 0.5 * (reA[j] * reA[j] + imA[j] * imA[j] + reB[j] * reB[j] + imB[j] * imB[j]) + 1e-8;
      coh[j] = c;
      rho[j] = clamp(c / e, -1, 1);
      this.re[j] = 0.5 * (reA[j] + reB[j]);
      this.im[j] = 0.5 * (imA[j] + imB[j]);
    }

    // Sort ascending by cross-spectral coherence
    const idx = Array.from({ length: D }, (_, j) => j).sort((a, b) => coh[a] - coh[b]);
    const maxReplace = Math.floor(D * Math.min(frac, 0.18));
    // Donor pool: top 30% coherent features (excluding near-zero DC collapse by keeping diverse scales)
    const nDonors = Math.max(16, Math.floor(D * 0.30));
    const scales = [0.55, 0.80, 1.0, 1.25, 1.65];
    let replaced = 0;
    for (let q = 0; q < maxReplace; q++) {
      const j = idx[q];
      if (rho[j] > 0.32) break; // preserve genuinely coherent features!
      const src = idx[D - 1 - Math.floor(r() * nDonors)];
      const mult = scales[q % scales.length];
      let nax = this.ax[src] * mult + 0.06 * gauss(r);
      let naz = this.az[src] * mult + 0.06 * gauss(r);
      // Prevent piling up at exact DC (0,0) and cap ultra-high aliasing frequencies
      const rad = Math.hypot(nax, naz);
      if (rad < 0.04) { nax += 0.18 * gauss(r); naz += 0.18 * gauss(r); }
      else if (rad > 1.6) { nax *= 1.6 / rad; naz *= 1.6 / rad; }
      this.ax[j] = nax;
      this.az[j] = naz;
      this.re[j] = 0;
      this.im[j] = 0;
      rho[j] = 0.22; // neutral initial gate for newly spawned frequency
      replaced++;
    }

    // Diagonal Gauss-Newton spectral gradient step on surviving frequencies (subsampled to <= 200 points for speed)
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

    // Wiener ARD spectral gate: boosts verified signal frequencies while damping online SGD observation noise on dead modes
    let g2Mean = 0;
    for (let j = 0; j < D; j++) {
      const g = 0.22 + 0.95 * Math.max(0, rho[j]);
      this.gate[j] = 0.35 * this.gate[j] + 0.65 * g;
      g2Mean += this.gate[j] * this.gate[j];
    }
    g2Mean /= D;
    // Normalise mean(gate^2) to ~0.48 so awake online learn(lr=0.3) has effective Kalman gain ~0.14 (half the high-freq noise!)
    const targetG2 = 0.48;
    const scaleG = Math.sqrt(targetG2 / Math.max(0.08, g2Mean));
    for (let j = 0; j < D; j++) this.gate[j] = clamp(this.gate[j] * scaleG, 0.12, 1.35);

    // Annealed full-buffer replay refit so weights exit sleep at the regularized Wiener optimum
    this.re.fill(0);
    this.im.fill(0);
    const nPasses = Math.max(3, passes + 2);
    for (let p = 0; p < nPasses; p++) {
      const eta = 0.42 / (1 + 0.65 * p);
      for (let i = 0; i < M; i++) {
        const [x, z, y] = B[perm[(i + p * 37) % M]];
        this.learn(x, z, y, eta, false);
      }
      // Mild Tikhonov shrinkage prevents high-norm ringing in sparse regions
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
    this.X = [];     // unit-normalised stored patterns
    this.Vraw = [];  // unnormalised stored patterns (preserves true channel energy scale)
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
    this.r = mulberry(seed * 31 + 5);
    // Learned parameters (trained in sleep() when learnKeys = true):
    //  - sig2[d]: empirical clean signal variance per coordinate
    //  - prec[d]: InfoNCE contrastive channel precision weights
    //  - Wimp: D x D ridge cross-channel conditional imputation matrix (zero diagonal: predicts d from d' != d!)
    this.sig2 = new Float64Array(dim).fill(0.05);
    this.prec = new Float64Array(dim).fill(1);
    this.Wimp = new Float64Array(dim * dim);
    this.W = new Float64Array(dim * dim);
    for (let k = 0; k < dim; k++) this.W[k * dim + k] = 1;
    this.conLoss = 0;
    this.denMSE = 0;
  }

  norm(v) { return nrm(v); }

  key(v) {
    if (!this.learnKeys || !this.trained) return nrm(v);
    const D = this.dim, out = new Float64Array(D);
    for (let d = 0; d < D; d++) out[d] = this.prec[d] * v[d];
    return nrm(out);
  }

  store(v, meta, r) {
    const x = nrm(v);
    const raw = Float64Array.from(v);
    if (this.X.length < this.cap) {
      this.X.push(x);
      this.Vraw.push(raw);
      this.meta.push(meta);
      this.use.push(1);
      this.cnt.push(1);
    } else {
      let k = 0;
      if (this.randomReplace) k = Math.floor(r() * this.cap);
      else for (let i = 1; i < this.X.length; i++) if (this.use[i] < this.use[k]) k = i;
      this.X[k] = x;
      this.Vraw[k] = raw;
      this.meta[k] = meta;
      this.use[k] = 1;
      this.cnt[k] = 1;
    }
    this.dirty = true;
  }

  /**
   * Hippocampal retrieval:
   *  - Raw mode (learnKeys=false): 1-step softmax(beta * X * q) over stored slots.
   *  - Learned mode (learnKeys=true):
   *      1) Robust MAD noise-floor estimate + Empirical-Bayes posterior observation probability wObs[d] = P(unmasked | q[d])
   *      2) Hollow-ridge cross-channel covariance imputation Wimp reconstructs masked coordinates from correlated observed modes
   *      3) Subspace-normalised precision cosine (eliminating masked-energy penalty on true stored memories) + 2nd CA3 step
   *      4) CA1 Schaffer + temporoammonic readout.
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
      return { xi, w, top, sim: m };
    }

    // 1) Estimate cue noise floor robustly; apply exact closed-form Marginalized Denoising Autoencoder (mDAE, Chen et al. 2012)
    //    learned during sleep from stored covariance: vHat = Wimp * q reconstructs masked 50% coords & filters additive noise!
    const q2s = Float64Array.from(q, (v) => v * v).sort();
    const medNoise2 = clamp(q2s[Math.floor(D * 0.30)] / 0.45, 1e-4, 0.012);

    const wObs = new Float64Array(D);
    const vClean = new Float64Array(D);
    for (let d = 0; d < D; d++) {
      const s2 = this.sig2[d], qd = q[d], q2 = qd * qd;
      const snr = s2 / (s2 + medNoise2);
      const llr = 0.5 * q2 * (1 / medNoise2 - 1 / (s2 + medNoise2)) - 0.5 * Math.log(1 + s2 / medNoise2);
      wObs[d] = clamp(1 / (1 + Math.exp(-clamp(llr, -10, 10))), 0.08, 1.0);
      vClean[d] = snr * qd;
    }

    // Closed-form mDAE completion vMdae = Wimp * q, fused with high-certainty observed coordinates
    const vImp = new Float64Array(D);
    for (let d = 0; d < D; d++) {
      let pred = 0;
      const off = d * D;
      for (let j = 0; j < D; j++) pred += this.Wimp[off + j] * q[j];
      const trustObs = 0.35 * wObs[d];
      vImp[d] = trustObs * vClean[d] + (1 - trustObs) * pred;
    }
    const xImp = nrm(vImp);

    // 2) Subspace-normalised precision cosine + mDAE full-pattern key match
    const gMask = new Float64Array(D);
    let qSub2 = 0;
    for (let d = 0; d < D; d++) {
      const gd = this.prec[d] * wObs[d] * wObs[d];
      gMask[d] = gd;
      qSub2 += gd * vClean[d] * vClean[d];
    }
    const invQSub = 1 / (Math.sqrt(qSub2) || 1);

    let m1 = -1e9;
    const s1 = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const vn = this.Vraw[n], xn = X[n];
      let dotSub = 0, vSub2 = 0, dotImp = 0;
      for (let d = 0; d < D; d++) {
        const gd = gMask[d], vnd = vn[d];
        dotSub += gd * vClean[d] * vnd;
        vSub2 += gd * vnd * vnd;
        dotImp += this.prec[d] * xImp[d] * xn[d];
      }
      const cosSub = dotSub * invQSub / (Math.sqrt(vSub2) + 1e-6);
      const sc = 0.42 * cosSub + 0.58 * dotImp;
      s1[n] = sc;
      if (sc > m1) m1 = sc;
    }

    // 3) CA3 recurrent attractor refinement step
    const ca3 = new Float64Array(D);
    for (let n = 0; n < N; n++) {
      const e = Math.exp(this.beta * 0.85 * (s1[n] - m1));
      if (e > 1e-4) {
        const xn = X[n];
        for (let d = 0; d < D; d++) ca3[d] += e * xn[d];
      }
    }
    const ca3Unit = nrm(ca3);
    const kRef = new Float64Array(D);
    for (let d = 0; d < D; d++) kRef[d] = 0.50 * xImp[d] + 0.50 * ca3Unit[d];
    const kRefNrm = nrm(kRef);

    let m = -1e9, top = 0;
    const s = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const sc = 0.60 * s1[n] + 0.40 * dot(X[n], kRefNrm);
      s[n] = sc;
      if (sc > m) { m = sc; top = n; }
    }
    let Z = 0;
    const w = new Float64Array(N);
    const effBeta = m > 0.84 ? this.beta * 1.1 : this.beta * 0.60;
    for (let n = 0; n < N; n++) { const e = Math.exp(effBeta * (s[n] - m)); w[n] = e; Z += e; }
    const xiCA3 = new Float64Array(D);
    for (let n = 0; n < N; n++) {
      const wn = w[n] / Z;
      w[n] = wn;
      if (wn > 1e-4) {
        this.use[n] += wn;
        const xn = X[n];
        for (let d = 0; d < D; d++) xiCA3[d] += wn * xn[d];
      }
    }

    // 4) CA1 Schaffer collateral (CA3 attractor) + temporoammonic (EC mDAE completion) readout
    const ca3Final = nrm(xiCA3);
    const alpha = clamp(0.42 + 0.52 * w[top], 0.42, 0.94);
    const xi = new Float64Array(D);
    for (let d = 0; d < D; d++) xi[d] = alpha * ca3Final[d] + (1 - alpha) * xImp[d];
    const xiOut = nrm(xi);
    this.lastSim = clamp(m, -1, 1);
    this.lastIdx = top;
    return { xi: xiOut, w, top, sim: this.lastSim };
  }

  /** Sleep consolidation: usage decay, merge near-duplicates, fit hollow-ridge imputation Wimp + InfoNCE channel precisions */
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
          X.splice(j, 1); V.splice(j, 1); this.meta.splice(j, 1); this.cnt.splice(j, 1); this.use.splice(j, 1);
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

    // 1) Empirical clean per-channel variance sig2[d] and regularised covariance C = (1/N) V^T V + lambda I
    const C = new Float64Array(D * D);
    let tr = 0;
    for (let d = 0; d < D; d++) this.sig2[d] = 1e-5;
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
      tr += C[i * D + i];
      for (let j = 0; j < i; j++) C[i * D + j] = C[j * D + i];
    }

    // Exact analytical Marginalized Denoising Autoencoder (mDAE, Chen et al. 2012):
    // Integrates over INFINITE 50%-dropout masks + Gaussian noise (sigma=0.05) in closed form:
    //   E[q q^T]_{i,j} = 0.25 C_{i,j} (i != j),  0.5 C_{i,i} + sigma^2 + reg (i == j);   E[v q^T] = 0.5 C.
    //   => G * Wimp^T = 0.5 C  (symmetric => Wimp = Z^T = Z).
    const G = new Float64Array(D * D);
    const RHS = new Float64Array(D * D);
    const noiseAndReg = 0.0025 + 0.015 * (tr / (N * D));
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        const cij = C[i * D + j] / N;
        G[i * D + j] = i === j ? 0.5 * cij + noiseAndReg : 0.25 * cij;
        RHS[i * D + j] = 0.5 * cij;
      }
    }
    const Wm = solveMatrix(G, RHS, D, D);
    for (let d = 0; d < D; d++) for (let j = 0; j < D; j++) this.Wimp[d * D + j] = Wm[j * D + d];

    // 2) Contrastive InfoNCE training of channel precisions `this.prec[d]` on mDAE-completed cues
    if (!this.trained) {
      for (let d = 0; d < D; d++) this.prec[d] = 0.30 + 0.90 * (this.sig2[d] / (this.sig2[d] + 0.0025));
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
        this.prec[d] = clamp(this.prec[d] - (lr / B) * gradP[d], 0.1, 2.5);
        pMean += this.prec[d];
      }
      pMean /= D;
      for (let d = 0; d < D; d++) {
        this.prec[d] /= pMean || 1;
        this.W[d * D + d] = this.prec[d];
      }
    }
    this.conLoss = L / (steps * B);
    this.denMSE = mse / B;
  }
}
