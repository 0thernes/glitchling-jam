// Metacognition, Exact Taylor-Jet Frenet-Serret Thought Curvature & Torsion, and Weight-Space Geometry.
// 1) ThoughtManifold: learns an 8-D cortical+hippocampal+SSM neural subspace online via Oja's orthonormal Hebbian rule,
//    then evaluates a cubic Catmull-Rom trajectory spline using Tsotchke/Eshkol order-3 Taylor jets (js/tsotchke/taylor.js)
//    to extract exact analytic velocity z'(t), acceleration z''(t) and jerk z'''(t), yielding Frenet-Serret thought
//    curvature kappa(t) and torsion tau(t).
// 2) Metacognition: monitors world-model uncertainty calibration (2nd-order epistemic confidence), thought curvature,
//    Hopfield familiarity and counterfactual opportunity regret; causally modulates striatal race deliberation threshold,
//    cholinergic plasticity gain, exploration temperature and adaptive goal switching.
import * as T from '../tsotchke/taylor.js';
import { clamp, mulberry } from './util.js';
import { weightSpaceDecomp, phasorQGT } from '../tsotchke/qgtl.js';
import { spectralConsolidate, vidalMPS, mpsContract, meraRenormalize, MPSQuantumSimulator32Q } from '../tsotchke/moonlab.js';

export const K_CHART = 8;

export class Metacognition {
  constructor(seed, nFeat = 96) {
    const r = mulberry(seed * 7919 + 29);
    this.nFeat = nFeat;
    this.mps32q = new MPSQuantumSimulator32Q(32, 32);
    this.mu = new Float64Array(nFeat);
    // K_CHART x nFeat Oja projection matrix (rows orthonormalised)
    this.P = new Float64Array(K_CHART * nFeat);
    for (let k = 0; k < K_CHART; k++) {
      let s = 0;
      for (let i = 0; i < nFeat; i++) { const v = r() - 0.5; this.P[k * nFeat + i] = v; s += v * v; }
      s = Math.sqrt(s) || 1;
      for (let i = 0; i < nFeat; i++) this.P[k * nFeat + i] /= s;
    }
    this.hist = []; // ring of last 4 K_CHART manifold points
    this.kappa = 0; // Frenet-Serret thought curvature
    this.torsion = 0; // Frenet-Serret thought torsion (3rd-order jet)
    this.speed = 0; // neural manifold arc speed ||z'||
    this.kMean = 1.2;
    this.kSD = 0.6;
    // Second-order metacognitive calibration & control signals
    this.calibErr = 0.25; // discrepancy between predicted uncertainty and actual squared error
    this.confidence = 0.6; // [0, 1] epistemic + trajectory confidence
    this.regret = 0; // counterfactual opportunity regret vs runner-up option
    this.delibThr = 8; // adaptive striatal race spike threshold (6..13)
    this.achGain = 1; // metacognitive precision/learning multiplier
    this.exploreTemp = 1; // exploration noise multiplier
    // Weight-space & Tsotchke QGTL / Moonlab telemetry
    this.ws = {
      motorLearnedFrac: 0,
      steerLearnedFrac: 0,
      brainLearnedFrac: 0,
      wmLearnedNorm: 0,
      biasNorm: 0,
      qgtFidelity: 1,
      fubiniTrace: 0,
      berryCurv: 0,
      svdRank: 1,
      mpsEntropy: 0,
      ewcPenalty: 0,
    };
  }

  /**
   * 10 Hz step: project neural feature vector -> Oja subspace update -> Order-3 Eshkol Taylor jet curvature & torsion
   * -> metacognitive confidence, calibration & control outputs.
   */
  step(feat, wmErr, wmPredVar, familiar, progressEMA, bestAltG, currentG, lesion = false) {
    const n = Math.min(this.nFeat, feat.length);
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const d = feat[i] - this.mu[i];
      this.mu[i] += 0.005 * d;
      x[i] = d;
    }
    // Project y = P x and apply Sanger/Oja generalized Hebbian subspace learning
    const y = new Float64Array(K_CHART);
    for (let k = 0; k < K_CHART; k++) {
      let s = 0;
      const off = k * this.nFeat;
      for (let i = 0; i < n; i++) s += this.P[off + i] * x[i];
      y[k] = s;
    }
    if (!lesion) {
      const eta = 0.0015 / (1 + this.dotNorm(x));
      const recon = new Float64Array(n);
      for (let k = 0; k < K_CHART; k++) {
        const yk = y[k], off = k * this.nFeat;
        for (let i = 0; i < n; i++) {
          recon[i] += yk * this.P[off + i];
          this.P[off + i] += eta * yk * (x[i] - recon[i]);
        }
      }
    }

    this.hist.push(y);
    if (this.hist.length > 4) this.hist.shift();

    // Exact Order-3 Eshkol Taylor-mode AD jet evaluation of the cubic Catmull-Rom neural trajectory r(t) at t = 0.5
    if (this.hist.length === 4) {
      const [p0, p1, p2, p3] = this.hist;
      const t = T.Jet.vari(0.5, 3), t2 = T.mul(t, t), t3 = T.mul(t2, t);
      const b0 = T.mul(0.5, T.add(T.add(T.neg(t3), T.mul(2, t2)), T.neg(t)));
      const b1 = T.mul(0.5, T.add(T.sub(T.mul(3, t3), T.mul(5, t2)), 2));
      const b2 = T.mul(0.5, T.add(T.add(T.mul(-3, t3), T.mul(4, t2)), t));
      const b3 = T.mul(0.5, T.sub(t3, t2));

      const d1 = new Float64Array(K_CHART), d2 = new Float64Array(K_CHART), d3 = new Float64Array(K_CHART);
      for (let k = 0; k < K_CHART; k++) {
        const jk = T.add(
          T.add(T.mul(b0, p0[k]), T.mul(b1, p1[k])),
          T.add(T.mul(b2, p2[k]), T.mul(b3, p3[k]))
        );
        d1[k] = jk.deriv(1);
        d2[k] = jk.deriv(2);
        d3[k] = jk.deriv(3);
      }
      const g11 = this.dot(d1, d1), g22 = this.dot(d2, d2), g33 = this.dot(d3, d3);
      const g12 = this.dot(d1, d2), g13 = this.dot(d1, d3), g23 = this.dot(d2, d3);
      const sp = Math.sqrt(g11);
      this.speed = 0.85 * this.speed + 0.15 * sp;
      if (sp > 1e-4) {
        const area2 = Math.max(0, g11 * g22 - g12 * g12);
        const kap = Math.min(40, Math.sqrt(area2) / (sp * g11 + 1e-6));
        // 3x3 Gram determinant det([g11 g12 g13; g12 g22 g23; g13 g23 g33]) for generalized Frenet torsion
        const det3 = Math.max(
          0,
          g11 * (g22 * g33 - g23 * g23) - g12 * (g12 * g33 - g23 * g13) + g13 * (g12 * g23 - g22 * g13)
        );
        const tor = area2 > 1e-8 ? Math.min(40, Math.sqrt(det3) / (area2 + 1e-5)) : 0;
        this.kappa = 0.88 * this.kappa + 0.12 * kap;
        this.torsion = 0.88 * this.torsion + 0.12 * tor;
        this.kMean += 0.005 * (this.kappa - this.kMean);
        this.kSD += 0.005 * (Math.abs(this.kappa - this.kMean) - this.kSD);
      }
    }

    // Second-order calibration: does the world model know when it doesn't know?
    const relCalib = Math.abs(wmErr - wmPredVar) / (wmPredVar + wmErr + 0.02);
    this.calibErr = 0.94 * this.calibErr + 0.06 * relCalib;
    const zKappa = (this.kappa - this.kMean) / (this.kSD + 0.1);

    if (lesion) {
      this.confidence = 0.5;
      this.regret = 0;
      this.delibThr = 8;
      this.achGain = 1;
      this.exploreTemp = 1;
      return;
    }

    // Confidence combines calibrated world-model certainty, smooth/geodesic thought trajectory (-zKappa) and familiarity
    this.confidence = clamp(0.62 - 0.35 * this.calibErr - 0.14 * zKappa + 0.16 * familiar, 0.08, 0.96);
    // Counterfactual opportunity regret: rises when an alternative option had better EFE (-bestAltG > -currentG) and progress is low
    const altAdv = clamp((-bestAltG) - (-currentG), -0.5, 1.5);
    const stall = clamp(0.18 - progressEMA, 0, 0.5) * 2;
    this.regret = clamp(0.9 * this.regret + 0.1 * clamp(0.5 * altAdv + 0.7 * stall), 0, 1);

    // Causal cognitive control outputs:
    //  - Uncertain / high-curvature thought -> accumulate more striatal spikes (deeper deliberation) before deciding
    this.delibThr = 6.5 + 5.5 * (1 - this.confidence);
    //  - Miscalibration + high curvature -> boost cholinergic learning gain to update internal models rapidly
    this.achGain = clamp(0.75 + 0.9 * (1 - this.confidence) + 0.25 * clamp(zKappa, 0, 2), 0.6, 1.85);
    //  - Regret + uncertainty -> higher epistemic exploration temperature
    this.exploreTemp = clamp(0.75 + 0.7 * (1 - this.confidence) + 0.45 * this.regret, 0.6, 1.8);
  }

  /** Audit weight-space decomposition and perform sleep-time Moonlab SVD + 32-Qubit (chi=32) Vidal MPS & 512-D Binary MERA consolidation */
  auditAndConsolidate(cr, doSleepConsolidate = false) {
    const mDec = weightSpaceDecomp(cr.Wc, cr.Wc0, cr.mnHomeo);
    const sDec = weightSpaceDecomp(cr.Wmot, cr.Wmot0, cr.motBias);
    let bDec = weightSpaceDecomp(cr.brain.w, cr.brain.w0, cr.brain.vBias, cr.brain.plastic);
    if (cr.brain.isGiga && cr.brain.wGiga) {
      // Sample 1.13B-synapse Int8 branch-cluster plastic weights vs canonical initial 64.0 spine priors on GIGA
      const wg = cr.brain.wGiga, nG = wg.length, stG = Math.max(64, (nG / 8192) | 0);
      let n0 = 0, ndw = 0, sa = 0, sb = 0, fSum = 0;
      for (let i = 0; i < nG; i += stG) {
        const w0 = 64.0;
        const w = wg[i], dw = w - w0;
        n0 += w0 * w0; ndw += dw * dw;
        const aw = Math.abs(w), aw0 = Math.abs(w0);
        sa += aw; sb += aw0; fSum += Math.sqrt(aw * aw0);
      }
      const inn = Math.sqrt(n0 * stG), lrn = Math.sqrt(ndw * stG);
      bDec = {
        ...bDec,
        innateNorm: inn,
        learnedNorm: lrn,
        learnedFrac: lrn / (inn + lrn + 1e-9),
        qgtFid: (sa > 1e-9 && sb > 1e-9) ? Math.min(1, (fSum * fSum) / (sa * sb)) : 1,
      };
    }
    const qgt = phasorQGT(cr.hdcFood.ax, cr.hdcFood.az, cr.hdcFood.re, cr.hdcFood.im);
    // Construct 512-D (L = 9 sites) multimodal neural + visual + hippocampal cognitive state vector for chi=32 MPS & 512-D Binary MERA
    const extPsi = new Float64Array(512);
    const ret = cr.retina || cr.vision;
    for (let i = 0; i < 64; i++) {
      extPsi[i] = cr.z[i] || 0;
      extPsi[64 + i] = cr.zMean[i] || 0;
      extPsi[128 + i] = ret?.itForm ? (ret.itForm[i % ret.itForm.length] || 0) : 0;
      extPsi[192 + i] = ret?.itColor ? (ret.itColor[i % ret.itColor.length] || 0) : 0;
      extPsi[256 + i] = ret?.v4 ? (ret.v4[i % ret.v4.length] || 0) : (cr.brain.regRate[i & 7] || 0);
      extPsi[320 + i] = cr.hippo?.ca1Rate ? (cr.hippo.ca1Rate[i % cr.hippo.ca1Rate.length] || 0) : 0;
      extPsi[384 + i] = cr.hippo?.subRate ? (cr.hippo.subRate[i % cr.hippo.subRate.length] || 0) : 0;
      extPsi[448 + i] = cr.wm?.zFlow ? (cr.wm.zFlow[i & 31] || 0) : 0;
    }
    const mps = vidalMPS(extPsi, 8, 32);
    const mera = meraRenormalize(extPsi, 9);
    // Step 32-Qubit (2^32 = 4.29B Hilbert space, chi=32) Vidal Canonical MPS circuit driven by live 32-mode SSM angles
    const thetas32 = new Float64Array(32);
    for (let q = 0; q < 32; q++) thetas32[q] = 0.35 + 0.65 * Math.tanh(cr.z[q] || 0);
    const mps32 = this.mps32q.runEntanglingCircuit(thetas32, doSleepConsolidate ? 3 : 2);

    if (doSleepConsolidate && !cr.lesion.metacog) {
      // Moonlab Jacobi SVD denoises rank-1 motor perturbation jitter in Wm (122 x 8) while keeping top-5 learned synergies
      const sv = spectralConsolidate(cr.Wm, cr.Wm0, cr.Wm.length >> 3, 8, 5, 0.35);
      this.ws.svdRank = sv.effRank;
      // Vidal canonical MPS (bond chi = 32) compresses & denoises the 64-D SSM baseline mean zMean during NREM sleep
      const zMps = vidalMPS(cr.zMean, 6, 32);
      const zRec = mpsContract(zMps);
      for (let i = 0; i < 64; i++) cr.zMean[i] = 0.7 * cr.zMean[i] + 0.3 * zRec[i];
    }

    let wmNorm = 0;
    for (const arr of [cr.wm.Wout, cr.wm.Wskip, cr.wm.Wvel, cr.wm.Wout5, cr.wm.Wout20, cr.wm.Wout60, cr.wm.WvaeDec1, cr.wm.WvaeDec2, cr.wm.Wflow2]) {
      if (arr) for (let i = 0; i < arr.length; i++) wmNorm += arr[i] * arr[i];
    }

    this.ws.motorLearnedFrac = mDec.learnedFrac;
    this.ws.steerLearnedFrac = sDec.learnedFrac;
    this.ws.brainLearnedFrac = bDec.learnedFrac;
    this.ws.wmLearnedNorm = Math.sqrt(wmNorm);
    this.ws.biasNorm = Math.hypot(mDec.biasNorm, sDec.biasNorm, bDec.biasNorm * 0.05);
    this.ws.qgtFidelity = 0.5 * (mDec.qgtFid + bDec.qgtFid);
    this.ws.fubiniTrace = qgt.trace;
    this.ws.berryCurv = qgt.berry;
    this.ws.mpsEntropy = mps.meanS;
    this.ws.mpsBond = mps.maxBond;
    this.ws.mpsFidelity = mps.keptFidelity;
    this.ws.mps32MaxBond = mps32.maxBond;
    this.ws.mps32Entropy = mps32.meanEntropy;
    this.ws.mps32Fidelity = mps32.fidelity;
    this.ws.meraIrEntropy = mera.irEntropy;
    this.ws.meraScaleRatio = mera.scaleRatio;
    this.ws.meraScales = mera.scales;
    this.ws.ewcPenalty = cr.ewcEnergy || 0;
  }

  dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  dotNorm(a) { return this.dot(a, a); }
}
