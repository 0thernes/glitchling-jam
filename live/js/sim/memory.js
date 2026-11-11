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

/**
 * Conductance-based Biophysical Spiking Trisynaptic Microcircuit (964 neurons across 7 hippocampal subtypes):
 *   EC_II/III (72) -> DG Granule (576) <-> Hilar Mossy (36) & PV+ Basket (48, fast somatic GABA_A)
 *                  -> CA3 Pyramidal (128, Mg2+-unblocked NMDA + recurrent AMPA)
 *                  -> SST+ O-LM Interneurons (32, slow apical GABA_B theta-phase gate) & CA1 Pyramidal (72)
 * Includes 7 Hz medial-septal theta rhythm (encoding at trough vs CA3 retrieval at peak) and 160 Hz N3 SWR bursts.
 */
export class SpikingTrisynapticCircuit {
  constructor(dim = 72, seed = 1) {
    this.dim = dim;
    this.nEC = dim;
    this.nDG = N_DG;
    this.nMossy = 36;
    this.nPV = 48;
    this.nCA3 = 128;
    this.nOLM = 32;
    this.nCA1 = dim;
    this.totalN = this.nEC + this.nDG + this.nMossy + this.nPV + this.nCA3 + this.nOLM + this.nCA1; // 964

    // Membrane potentials in biological mV (-70 mV rest, -50 mV threshold, 0 mV AMPA/NMDA, -70 mV GABA_A, -90 mV GABA_B)
    this.V = new Float32Array(this.totalN).fill(-68);
    this.gAMPA = new Float32Array(this.totalN);
    this.gNMDA = new Float32Array(this.totalN);
    this.gGABAA = new Float32Array(this.totalN);
    this.gGABAB = new Float32Array(this.totalN);
    this.ref = new Float32Array(this.totalN);
    this.spk = new Uint8Array(this.totalN);
    this.rate = new Float32Array(this.totalN);

    this.thetaPhase = 0;      // 7 Hz medial-septal pacemaker phase [0, 2*pi)
    this.swrPower = 0;        // 160 Hz sharp-wave ripple envelope
    this.swrBursts = 0;
    this.olmGate = 0.5;       // dynamic SST+ O-LM apical gate in [0, 1]
    this.pvRateHz = 0;
    this.ca3NmdaFrac = 0;
    this.r = mulberry(seed * 499 + 17);
  }

  /** Advance conductance-based hippocampal synaptology by dt seconds */
  step(dt, ecDrive, novelty = 0.3, sleepStage = 0) {
    const N = this.totalN;
    const oDG = this.nEC;
    const oMos = oDG + this.nDG;
    const oPV = oMos + this.nMossy;
    const oCA3 = oPV + this.nPV;
    const oOLM = oCA3 + this.nCA3;
    const oCA1 = oOLM + this.nOLM;

    // 7 Hz theta in wake/REM; 160 Hz SWR ripple bursts in N2/N3 slow-wave sleep
    const thetaHz = sleepStage === 2 || sleepStage === 3 ? 1.8 : 7.2;
    this.thetaPhase = (this.thetaPhase + 2 * Math.PI * thetaHz * dt) % (2 * Math.PI);
    const thetaMod = 0.5 + 0.5 * Math.cos(this.thetaPhase); // 1 = EC encoding trough, 0 = CA3 retrieval peak

    const isNREM = sleepStage === 2 || sleepStage === 3;
    if (isNREM && (this.swrPower < 0.15 && this.r() < dt * 35)) {
      this.swrPower = 1.0;
      this.swrBursts++;
    } else {
      this.swrPower *= Math.exp(-dt / 0.045);
    }
    const swrOsc = this.swrPower > 0.05 ? this.swrPower * (0.65 + 0.35 * Math.sin(this.thetaPhase * 22.0)) : 0;

    // Exponential synaptic conductance decays: AMPA (5 ms), NMDA (65 ms), GABA_A (8 ms), GABA_B (120 ms)
    const dAmpa = Math.exp(-dt / 0.005);
    const dNmda = Math.exp(-dt / 0.065);
    const dGa = Math.exp(-dt / 0.008);
    const dGb = Math.exp(-dt / 0.120);
    const dRate = Math.exp(-dt / 0.12);

    // Aggregate population firing rates (Hz) for conductance-based microcircuit synaptic routing
    let hzEC = 0, hzDG = 0, hzMos = 0, hzPV = 0, hzCA3 = 0, hzOLM = 0, hzCA1 = 0;
    for (let i = 0; i < oDG; i++) hzEC += this.rate[i];
    for (let i = oDG; i < oMos; i++) hzDG += this.rate[i];
    for (let i = oMos; i < oPV; i++) hzMos += this.rate[i];
    for (let i = oPV; i < oCA3; i++) hzPV += this.rate[i];
    for (let i = oCA3; i < oOLM; i++) hzCA3 += this.rate[i];
    for (let i = oOLM; i < oCA1; i++) hzOLM += this.rate[i];
    for (let i = oCA1; i < N; i++) hzCA1 += this.rate[i];

    const ecMean = hzEC / this.nEC;
    const dgMean = hzDG / this.nDG;
    const mosMean = hzMos / this.nMossy;
    const pvMean = hzPV / this.nPV;
    const ca3Mean = hzCA3 / this.nCA3;
    const olmMean = hzOLM / this.nOLM;
    this.ecRateHz = ecMean;
    this.dgRateHz = dgMean;
    this.ca3RateHz = ca3Mean;
    this.ca1RateHz = hzCA1 / this.nCA1;

    const aAmpa = 1 - dAmpa, aNmda = 1 - dNmda, aGa = 1 - dGa, aGb = 1 - dGb;
    let pvSum = 0, olmSum = 0, nmdaAccum = 0;
    for (let i = 0; i < N; i++) {
      let ga = this.gAMPA[i] * dAmpa;
      let gn = this.gNMDA[i] * dNmda;
      let gba = this.gGABAA[i] * dGa;
      let gbb = this.gGABAB[i] * dGb;
      // Desynchronized intrinsic excitability + stochastic miniature synaptic bombardment
      const jit = 0.72 + 0.56 * ((i * 2654435761 >>> 24) / 255);
      const mini = 0.08 * (this.r() - 0.35);

      // Exact dt-invariant conductance drives (rheobase g_AMPA* = 0.36 at -50 mV; DG g_AMPA* = 0.46 at -46.5 mV)
      if (i < oDG) {
        // EC_II/III stellate/pyramidal cells (~11-16 Hz)
        const d = ecDrive ? Math.abs(ecDrive[i % ecDrive.length]) : 0.25;
        ga += aAmpa * (jit * (0.31 + 0.48 * d * (0.65 + 0.55 * thetaMod) + 0.22 * swrOsc) + mini);
        gba += aGa * (0.0025 * pvMean);
      } else if (i < oMos) {
        // DG granule cells (~1.5-3.5 Hz sparse!): high spike threshold (-46.5 mV) + PV basket & mossy lateral inhibition
        const d = ecDrive ? Math.abs(ecDrive[(i * 7 + 3) % ecDrive.length]) : 0.2;
        ga += aAmpa * (jit * (0.34 + 0.48 * d * (0.55 + 0.65 * thetaMod)) + mini);
        gn += aNmda * (0.14 * d);
        gba += aGa * (0.0036 * pvMean + 0.0028 * mosMean);
      } else if (i < oPV) {
        // Hilar Mossy cells (~8-14 Hz)
        ga += aAmpa * (jit * (0.33 + 0.015 * dgMean + 0.004 * ecMean) + mini);
        gba += aGa * (0.0030 * pvMean);
      } else if (i < oCA3) {
        // PV+ Fast-Spiking Basket Interneurons (~26-42 Hz): fast membrane (gL = 1.45 -> rheobase 0.52)
        ga += aAmpa * (jit * (0.38 + 0.005 * ecMean + 0.012 * dgMean + 0.004 * mosMean + 0.005 * ca3Mean + 0.24 * swrOsc) + mini);
        gba += aGa * (0.0042 * pvMean);
      } else if (i < oOLM) {
        // CA3 Pyramidal cells (~7-13 Hz): mossy-fiber detonators + recurrent Mg2+-unblocked NMDA + SWR burst
        ga += aAmpa * (jit * (0.31 + 0.016 * dgMean + 0.006 * ca3Mean * (1.25 - 0.5 * thetaMod) + 0.34 * swrOsc) + mini);
        gn += aNmda * (0.014 * ca3Mean + 0.028 * dgMean + 0.28 * swrOsc + 0.08);
        gba += aGa * (0.0032 * pvMean);
        gbb += aGb * (0.0028 * olmMean);
      } else if (i < oCA1) {
        // SST+ O-LM Interneurons (~8-16 Hz): cholinergic novelty suppression -> apical GABA_B onto EC->CA1
        const achSuppress = 1 - 0.55 * clamp(novelty, 0, 1);
        ga += aAmpa * (jit * (0.35 + 0.008 * ca3Mean) * achSuppress + mini);
        gba += aGa * (0.0030 * pvMean);
      } else {
        // CA1 Pyramidal cells (~8-15 Hz): Schaffer collateral (CA3) vs Temporoammonic (EC_III, gated by O-LM GABA_B!)
        const d = ecDrive ? Math.abs(ecDrive[(i - oCA1) % ecDrive.length]) : 0.2;
        ga += aAmpa * (jit * (0.30 + 0.007 * ca3Mean * (1.2 - 0.45 * thetaMod) + 0.32 * d * thetaMod + 0.30 * swrOsc) + mini);
        gn += aNmda * (0.012 * ca3Mean + 0.12 * d + 0.06);
        gba += aGa * (0.0030 * pvMean);
        gbb += aGb * (0.0045 * olmMean);
      }
      ga = Math.max(0, ga);

      const V = this.V[i];
      // Jahr-Stevens extracellular Mg2+ (1 mM) voltage-dependent unblock B(V) = 1 / (1 + 0.28 * exp(-0.062 * V))
      const mgUnblock = 1 / (1 + 0.28 * Math.exp(clamp(-0.062 * V, -12, 12)));
      const gNmdaEff = gn * mgUnblock;
      if (i >= oCA3 && i < oOLM) nmdaAccum += gNmdaEff / (ga + gNmdaEff + 1e-6);

      this.gAMPA[i] = ga;
      this.gNMDA[i] = gn;
      this.gGABAA[i] = gba;
      this.gGABAB[i] = gbb;

      let r = this.rate[i] * dRate;
      if (this.ref[i] > 0) {
        this.ref[i] -= dt;
        this.V[i] = -69.0;
        this.spk[i] = 0;
      } else {
        const gL = i >= oPV && i < oCA3 ? 1.45 : 1.0;
        const gTot = gL + ga + gNmdaEff + gba + gbb;
        const vInf = (gL * -68.0 - gba * 70.0 - gbb * 90.0) / gTot;
        const tauV = 0.014 / gTot;
        const vNext = vInf + (V - vInf) * Math.exp(-dt / Math.max(1e-4, tauV));
        const vThr = i >= oDG && i < oMos ? -46.5 : -50.0;
        if (vNext >= vThr) {
          this.V[i] = -69.0;
          this.ref[i] = i >= oPV && i < oCA3 ? 0.004 : 0.008; // fast-spiking PV (4 ms) vs pyramidal/granule (8 ms) AHP
          this.spk[i] = 1;
          r += 1 / 0.12;
          if (i >= oCA3) this.gNMDA[i] += 0.04;
        } else {
          this.V[i] = clamp(vNext, -92, -40);
          this.spk[i] = 0;
        }
      }
      this.rate[i] = r;
      if (i >= oPV && i < oCA3) pvSum += r;
      else if (i >= oOLM && i < oCA1) olmSum += r;
    }

    this.pvRateHz = pvSum / this.nPV;
    const olmHz = olmSum / this.nOLM;
    this.olmGate = clamp(olmHz / (olmHz + 8.0), 0.08, 0.92);
    this.ca3NmdaFrac = nmdaAccum / this.nCA3;
  }
}

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
    this.sigCond2 = new Float64Array(dim).fill(0.02); // conditional residual variance Var(v_d | q_{-d})
    this.snrGate = new Float64Array(dim).fill(1); // Wiener channel SNR gate sig2 / (sig2 + noise2): 0 on silent channels!
    this.prec = new Float64Array(dim).fill(1);
    this.Wimp = new Float64Array(dim * dim);      // EC full mDAE denoiser
    this.Wcross = new Float64Array(dim * dim);    // EC Hollow-mDAE zero-diagonal conditional schema predictor E[v_d | q_{-d}]
    this.W = new Float64Array(dim * dim);
    for (let k = 0; k < dim; k++) this.W[k * dim + k] = 1;
    this.conLoss = 0;
    this.denMSE = 0;

    // Dedicated 964-neuron conductance-based biophysical spiking hippocampal microcircuit (AMPA / Mg2+-NMDA / PV GABA_A / O-LM GABA_B)
    this.circuit = new SpikingTrisynapticCircuit(dim, seed);

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

    // 1) EC_II / EC_III Empirical-Bayes Conditional Wiener Schema Completion + Biophysical Spiking Microcircuit Step
    this.circuit.step(0.004, q, this.ca1Novelty, 0);

    const q2s = Float64Array.from(q, (v) => v * v).sort();
    const sigmaN2 = clamp(q2s[Math.floor(D * 0.35)] / 0.21, 0.0018, 0.006);
    const inv2Sig = 0.5 / sigmaN2;
    const LN2 = 0.6931471805599453;

    const vMdae = new Float64Array(D);
    const vBayes = new Float64Array(D);
    const pObs = new Float64Array(D);
    const wObs = new Float64Array(D);
    let qSub2 = 0;

    for (let d = 0; d < D; d++) {
      const off = d * D;
      let predFull = 0, predCross = 0;
      for (let j = 0; j < D; j++) {
        predFull += this.Wimp[off + j] * q[j];
        predCross += this.Wcross[off + j] * q[j]; // strictly zero diagonal: independent of q[d]!
      }
      vMdae[d] = predFull;

      const s2 = this.sig2[d];
      if (s2 < 5e-5) { wObs[d] = 0; vBayes[d] = 0; continue; }

      // Conditional residual variance Var(v_d | q_{-d}) + sigma_n^2 vs pure masked noise N(0, sigma_n^2)
      const sc2 = Math.max(0.28 * s2, this.sigCond2[d]);
      const varObs = sc2 + sigmaN2;
      const diffC = q[d] - predCross;
      // Exact log-likelihood ratio log( P(q_d | m_d=1, q_{-d}) / P(q_d | m_d=0) )
      const llrCond = clamp(
        0.5 * ((q[d] * q[d]) / sigmaN2 - (diffC * diffC) / varObs - Math.log(varObs / sigmaN2)),
        -12,
        12
      );
      const po = 1 / (1 + Math.exp(-llrCond));
      pObs[d] = po;

      const snr = s2 / (s2 + sigmaN2);
      wObs[d] = snr * po;
      qSub2 += wObs[d] * q[d] * q[d];

      // MMSE conditional expectation E[v_d | q_1..q_D] with finite-sample floor on observed-channel retention
      const wShrink = Math.max(0.68 * snr, sc2 / varObs);
      const vGivenObs = wShrink * q[d] + (1 - wShrink) * predCross;
      vBayes[d] = po * vGivenObs + (1 - po) * predCross;
    }
    const invQSub = 1 / (Math.sqrt(qSub2) + 1e-6);
    const xBayes = nrm(vBayes);

    // 2) Dentate Gyrus (DG, 576 granule cells, 4.9% k-WTA) sparse pattern separation + nonlinear mossy-fiber completion
    const qDG = this.lesionDG ? null : this.dgEncode(xBayes, null);
    const vEC = new Float64Array(D);
    if (qDG && this.Rdg) {
      for (let d = 0; d < D; d++) {
        let dgRec = 0;
        for (let k = 0; k < K_DG; k++) dgRec += qDG.act[k] * this.Rdg[qDG.idx[k] * D + d];
        vEC[d] = vBayes[d] + 0.14 * (1 - pObs[d]) * (dgRec - vBayes[d]);
      }
    } else {
      vEC.set(vBayes);
    }
    const xEC = nrm(vEC);

    // 3) CA3 Perforant Subspace Cosine + DG Mossy-Fiber Code + Rectified Mg2+-Unblocked NMDA Spine Log-Likelihood
    const s1 = new Float64Array(N);
    const sMan = new Float64Array(N); // smooth cosine manifold similarity (without winner-take-all NMDA spike)
    let m1 = -1e9, mMan = -1e9;
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
      const ecCos = dot(xEC, xn);
      const dgSim = qDG ? this.dgOverlap(qDG, this.dgCodes[n]) : 0;
      const nmdaPlateau = Math.max(0, sumL);
      const scMan = 0.54 * cosSub + 0.46 * ecCos;
      const sc = 0.45 * ecCos + 0.45 * cosSub + 0.10 * dgSim + 0.025 * nmdaPlateau;
      sMan[n] = scMan;
      if (scMan > mMan) mMan = scMan;
      s1[n] = sc;
      if (sc > m1) m1 = sc;
    }

    // Soft local CA3 manifold chart (barycentric chord interpolation across bracketing manifold neighbors!)
    const vCA3Soft = new Float64Array(D);
    const ca3Step1 = new Float64Array(D);
    let zSoft = 0;
    for (let n = 0; n < N; n++) {
      const eSoft = Math.exp(clamp(10.5 * (s1[n] - m1), -35, 0));
      zSoft += eSoft;
      if (eSoft > 1e-4) {
        const vn = this.Vraw[n];
        for (let d = 0; d < D; d++) vCA3Soft[d] += eSoft * vn[d];
      }
      const eMid = Math.exp(clamp(20 * (s1[n] - m1), -35, 0));
      if (eMid > 1e-4) {
        const xn = X[n];
        for (let d = 0; d < D; d++) ca3Step1[d] += eMid * xn[d];
      }
    }
    const invZSoft = 1 / (zSoft || 1);
    for (let d = 0; d < D; d++) vCA3Soft[d] *= invZSoft;
    const ca3Mid = nrm(ca3Step1);

    // 2nd-step sharp CA3 recurrent collateral attractor settlement for exact episodic engram lock
    let m = -1e9, top = 0;
    const s = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const sc = 0.84 * s1[n] + 0.16 * dot(X[n], ca3Mid);
      s[n] = sc;
      if (sc > m) { m = sc; top = n; }
    }

    let Z = 0;
    const w = new Float64Array(N);
    for (let n = 0; n < N; n++) { const e = Math.exp(clamp(25 * (s[n] - m), -35, 0)); w[n] = e; Z += e; }
    const xiCA3 = new Float64Array(D);
    const vCA3Raw = new Float64Array(D);
    let ent = 0;
    for (let n = 0; n < N; n++) {
      const wn = w[n] / Z;
      w[n] = wn;
      if (wn > 1e-4) {
        this.use[n] += wn;
        ent -= wn * Math.log(wn + 1e-12);
        const xn = X[n], vn = this.Vraw[n];
        for (let d = 0; d < D; d++) {
          xiCA3[d] += wn * xn[d];
          vCA3Raw[d] += wn * vn[d];
        }
      }
    }
    this.ca3Entropy = ent;
    const ca3Final = nrm(xiCA3);

    // 4) SST+ O-LM-Gated CA1 Local-Manifold Kalman Innovation Comparator:
    //    - InnovObs measures how observed sensory channels deviate from the local CA3 manifold chart `vCA3Soft`.
    //    - Temporoammonic `Wcross` propagates observed sensory innovations across coupled modalities onto masked channels!
    //    - Stored episode hit (`obsMseRatio` near 1): O-LM gates in sharp Schaffer-collateral `ca3Final`.
    //    - Out-of-sample / held-out trajectory state: CA1 outputs local-manifold Kalman reconstruction `xNovel`!
    const noiseRef = Math.max(0.0022, sigmaN2);
    const innovJS = new Float64Array(D);
    const gainJS = new Float64Array(D);
    let obsErr2 = 0, obsSoftErr2 = 0, obsW = 1e-6;
    for (let d = 0; d < D; d++) {
      const snr = this.snrGate[d];
      const po = pObs[d] * snr;
      const diffSoft = q[d] - vCA3Soft[d];
      const diffSharp = q[d] - vCA3Raw[d];
      // Per-channel James-Stein / Empirical-Bayes shrinkage gate:
      // suppresses pure measurement noise (diffSoft^2 <= 1.35 * sigmaN2) on stored episodes while passing genuine
      // sensory/motor state excursions through on novel / held-out trajectory states!
      const gJS = snr * Math.max(0, 1 - (1.35 * noiseRef) / (diffSoft * diffSoft + 1e-8));
      gainJS[d] = gJS;
      innovJS[d] = pObs[d] * gJS * diffSoft;
      obsSoftErr2 += po * diffSoft * diffSoft;
      obsErr2 += po * diffSharp * diffSharp;
      obsW += po;
    }
    const obsSoftRatio = (obsSoftErr2 / obsW) / noiseRef;
    const obsMseRatio = (obsErr2 / obsW) / noiseRef;
    const hitSharp = w[top];
    const ca1Agree = dot(ca3Final, xEC);
    const pEpisodic = 1 / (1 + Math.exp(clamp(3.2 * (obsMseRatio - 1.22) - 1.8 * (hitSharp - 0.68), -10, 10)));
    this.ca1Novelty = clamp(1 - 0.50 * pEpisodic - 0.30 * ca1Agree - 0.20 * hitSharp, 0, 1);

    const vOut = new Float64Array(D);
    for (let d = 0; d < D; d++) {
      const po = pObs[d];
      const snr = this.snrGate[d];
      const off = d * D;
      let crossDelta = 0;
      for (let j = 0; j < D; j++) crossDelta += this.Wcross[off + j] * innovJS[j];
      const vBase = pEpisodic * vCA3Raw[d] + (1 - pEpisodic) * vCA3Soft[d];
      // Even when pEpisodic is moderate, any observed channel with a >1.2*sigma excursion updates itself & coupled masked channels!
      vOut[d] =
        vBase +
        po * gainJS[d] * (q[d] - vBase) +
        (1 - po) * 0.85 * snr * crossDelta;
    }
    const xiOut = nrm(vOut);
    this.lastSim = clamp(Math.min(1, m), -1, 1);
    this.lastIdx = top;
    return { xi: xiOut, w, top, sim: this.lastSim, novelty: this.ca1Novelty, pEpisodic };
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

    // 3) Exact analytical Marginalized Denoising Autoencoder (mDAE) + Zero-Diagonal Hollow-mDAE Conditional Schema (`Wcross`):
    //    Solving G * [Wm | Ginv] = [RHS | I] in one Gauss-Jordan sweep yields both full mDAE and exact Lagrange-constrained
    //    leave-one-channel-out predictor w_cross,d = w_full,d - (w_full,d[d] / Ginv[d,d]) * Ginv[:,d] (Wcross[d,d] === 0)!
    const G = new Float64Array(D * D);
    const RHS2 = new Float64Array(D * (2 * D));
    const noiseAndReg = 0.0025 + 0.008 * (tr / (N * D));
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        const cij = C[i * D + j] / N;
        G[i * D + j] = i === j ? 0.5 * cij + noiseAndReg : 0.25 * cij;
        RHS2[i * (2 * D) + j] = 0.5 * cij;
        RHS2[i * (2 * D) + D + j] = i === j ? 1 : 0;
      }
    }
    const Sol = solveMatrix(G, RHS2, D, 2 * D);
    for (let d = 0; d < D; d++) {
      const wDiag = Sol[d * (2 * D) + d];
      const gInvDiag = Math.max(1e-12, Sol[d * (2 * D) + D + d]);
      const lam = wDiag / gInvDiag;
      let explained = 0;
      for (let j = 0; j < D; j++) {
        const wFull = Sol[j * (2 * D) + d];
        const gInvJ = Sol[j * (2 * D) + D + d];
        this.Wimp[d * D + j] = wFull;
        const wc = j === d ? 0 : wFull - lam * gInvJ;
        this.Wcross[d * D + j] = wc;
        explained += wc * (0.5 * (C[d * D + j] / N));
      }
      this.sigCond2[d] = clamp(this.sig2[d] - explained, 0.0004, Math.max(0.0005, this.sig2[d]));
    }

    // Also run N3 SWR replay bursts through the conductance-based biophysical spiking microcircuit
    for (let sw = 0; sw < 8; sw++) {
      const replayVec = this.X[Math.floor(r() * this.X.length)];
      this.circuit.step(0.005, replayVec, 0.1, 3);
    }

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
