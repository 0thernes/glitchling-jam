// Learning machinery beside the spiking substrate (upgraded in pass 16):
//  - SelectiveSSM: 32-mode complex diagonal state-space model (S4D/Mamba selectivity) with exact online mode-wise RTRL
//    eligibility traces for input matrix B, selective step-size gate Wd, gate bias bd, and modal frequencies omega.
//    Prediction-error gradients from the Causal Transformer-SSM WorldModel flow back into SelectiveSSM online.
//  - WorldModel: Transformer-XL Causal Multi-Head RoPE Self-Attention + RMSNorm + SwiGLU + RTRL-SSM Hybrid World Model
//    over a T=8 causal token ring buffer (effective receptive field L*(T-1)+1 steps), predicting BOTH 1-step (+0.1 s)
//    and action-conditioned 5-step (+0.5 s) nonlinear horizons + heteroscedastic predVar, with selectable scales:
//      * 'std'   (L=2, d=64,  H=4, ffn=128 -> 114,484 params, real-time default)
//      * 'large' (L=3, d=128, H=4, ffn=256 -> 549,940 params)
//      * 'xl'    (L=4, d=168, H=6, ffn=320 -> 1,141,620 params, >1M-parameter causal Transformer)
//  - Sleep: two-process (adenosine S + circadian C) flip-flop and ultradian N1/N2/N3/REM stage cycle.
//  - PredictiveCoding: two-level Rao & Ballard / Whittington & Bogacz hierarchical inference & Hebbian error learning.
import { mulberry, gauss, softplus, clamp } from './util.js';

const silu = (x) => x / (1 + Math.exp(-clamp(x, -15, 15)));
const dsilu = (x) => {
  const s = 1 / (1 + Math.exp(-clamp(x, -15, 15)));
  return s * (1 + x * (1 - s));
};

export const WM_SCALES = {
  std:   { L: 2, d: 64,  H: 4, ffn: 128, T: 8, d5: 64 },
  large: { L: 3, d: 128, H: 4, ffn: 256, T: 8, d5: 96 },
  xl:    { L: 4, d: 168, H: 6, ffn: 320, T: 8, d5: 112 },
};

function resolveWMScale(scaleArg) {
  if (typeof scaleArg === 'string' && WM_SCALES[scaleArg]) return scaleArg;
  if (typeof scaleArg === 'number') return scaleArg >= 160 ? 'xl' : scaleArg >= 96 ? 'large' : 'std';
  const g =
    globalThis.WM_SCALE ||
    globalThis.TW?.wmScale ||
    (typeof process !== 'undefined' && process.env?.WM_SCALE) ||
    (typeof location !== 'undefined' && new URLSearchParams(location.search).get('wm')) ||
    'std';
  const k = String(g).toLowerCase();
  return WM_SCALES[k] ? k : 'std';
}

function rmsNormFwd(x, gamma, out) {
  const d = x.length;
  let ss = 0;
  for (let i = 0; i < d; i++) ss += x[i] * x[i];
  const invRms = 1 / Math.sqrt(ss / d + 1e-5);
  for (let i = 0; i < d; i++) out[i] = x[i] * invRms * gamma[i];
  return invRms;
}

function rmsNormBwdUpdate(x, invRms, gamma, dOut, dxAcc, etaGamma) {
  const d = x.length;
  let dot = 0;
  for (let i = 0; i < d; i++) dot += dOut[i] * gamma[i] * x[i];
  const c = (dot * invRms * invRms) / d;
  for (let i = 0; i < d; i++) {
    const dy = dOut[i];
    const u = dy * gamma[i];
    dxAcc[i] += invRms * (u - x[i] * c);
    gamma[i] = clamp(gamma[i] - etaGamma * clamp(dy * x[i] * invRms, -2, 2), 0.2, 3.0);
  }
}

export class SelectiveSSM {
  constructor(nIn, nModes, seed) {
    const r = mulberry(seed * 101 + 7);
    this.nIn = nIn;
    this.M = nModes;
    this.re = new Float64Array(nModes);
    this.im = new Float64Array(nModes);
    this.alpha = Float64Array.from({ length: nModes }, (_, k) => 0.02 * Math.pow(100, k / (nModes - 1)));
    this.omega = Float64Array.from({ length: nModes }, () => (r() - 0.5) * 1.2);
    this.omega0 = Float64Array.from(this.omega);
    this.B = Float64Array.from({ length: nModes * nIn }, () => gauss(r) / Math.sqrt(nIn));
    this.B0 = Float64Array.from(this.B);
    this.Wd = Float64Array.from({ length: nModes * nIn }, () => (gauss(r) * 0.5) / Math.sqrt(nIn));
    this.Wd0 = Float64Array.from(this.Wd);
    this.bd = new Float64Array(nModes).fill(0);
    this.delta = new Float64Array(nModes);
    this.fixedProj = false;

    const MN = nModes * nIn;
    this.eBr = new Float64Array(MN); this.eBi = new Float64Array(MN);
    this.eWr = new Float64Array(MN); this.eWi = new Float64Array(MN);
    this.ebr = new Float64Array(nModes); this.ebi = new Float64Array(nModes);
    this.ewr = new Float64Array(nModes); this.ewi = new Float64Array(nModes);

    this.pBr = new Float64Array(MN); this.pBi = new Float64Array(MN);
    this.pWr = new Float64Array(MN); this.pWi = new Float64Array(MN);
    this.pbr = new Float64Array(nModes); this.pbi = new Float64Array(nModes);
    this.pwr = new Float64Array(nModes); this.pwi = new Float64Array(nModes);
    this.gradNorm = 0;
  }

  clone() {
    const c = Object.create(SelectiveSSM.prototype);
    Object.assign(c, this);
    c.re = Float64Array.from(this.re);
    c.im = Float64Array.from(this.im);
    c.delta = Float64Array.from(this.delta);
    c.inDream = true;
    return c;
  }

  step(u) {
    const M = this.M, n = this.nIn;
    const track = !this.inDream && !this.fixedProj;
    if (track) {
      this.pBr.set(this.eBr); this.pBi.set(this.eBi);
      this.pWr.set(this.eWr); this.pWi.set(this.eWi);
      this.pbr.set(this.ebr); this.pbi.set(this.ebi);
      this.pwr.set(this.ewr); this.pwi.set(this.ewi);
    }
    for (let k = 0; k < M; k++) {
      const off = k * n;
      let g = this.bd[k], bu = 0;
      for (let i = 0; i < n; i++) {
        g += this.Wd[off + i] * u[i];
        bu += this.B[off + i] * u[i];
      }
      const D = softplus(g);
      this.delta[k] = D;
      const al = this.alpha[k], om = this.omega[k];
      const mag = Math.exp(-D * al), th = D * om;
      const c = mag * Math.cos(th), s = mag * Math.sin(th);
      const rk = this.re[k], ik = this.im[k];

      if (track) {
        const sig = 1 / (1 + Math.exp(-clamp(g, -15, 15)));
        const dc_dD = -al * c - om * s;
        const ds_dD = -al * s + om * c;
        const gR = sig * (dc_dD * rk - ds_dD * ik + al * mag * bu);
        const gI = sig * (ds_dD * rk + dc_dD * ik);
        const omR = D * (-s * rk - c * ik);
        const omI = D * (c * rk - s * ik);
        const oneMinusMag = 1 - mag;
        for (let i = 0; i < n; i++) {
          const ui = u[i], idx = off + i;
          const bR = this.eBr[idx], bI = this.eBi[idx];
          this.eBr[idx] = c * bR - s * bI + oneMinusMag * ui;
          this.eBi[idx] = s * bR + c * bI;
          const wR = this.eWr[idx], wI = this.eWi[idx];
          this.eWr[idx] = c * wR - s * wI + gR * ui;
          this.eWi[idx] = s * wR + c * wI + gI * ui;
        }
        const br0 = this.ebr[k], bi0 = this.ebi[k];
        this.ebr[k] = c * br0 - s * bi0 + gR;
        this.ebi[k] = s * br0 + c * bi0 + gI;
        const wr0 = this.ewr[k], wi0 = this.ewi[k];
        this.ewr[k] = c * wr0 - s * wi0 + omR;
        this.ewi[k] = s * wr0 + c * wi0 + omI;
      }

      this.re[k] = c * rk - s * ik + (1 - mag) * bu;
      this.im[k] = s * rk + c * ik;
    }
  }

  backward(dZ, lr = 0.002) {
    if (this.fixedProj) return;
    const M = this.M, n = this.nIn;
    let gn2 = 0;
    for (let k = 0; k < M; k++) {
      const dR = clamp(dZ[2 * k], -2, 2), dI = clamp(dZ[2 * k + 1], -2, 2);
      const off = k * n;
      for (let i = 0; i < n; i++) {
        const idx = off + i;
        const gB = dR * this.pBr[idx] + dI * this.pBi[idx];
        const gW = dR * this.pWr[idx] + dI * this.pWi[idx];
        gn2 += gB * gB + gW * gW;
      }
      const gb = dR * this.pbr[k] + dI * this.pbi[k];
      const gw = dR * this.pwr[k] + dI * this.pwi[k];
      gn2 += gb * gb + gw * gw;
    }
    const gn = Math.sqrt(gn2);
    this.gradNorm = 0.9 * this.gradNorm + 0.1 * gn;
    const lrEff = lr / (1 + gn);
    for (let k = 0; k < M; k++) {
      const dR = clamp(dZ[2 * k], -2, 2), dI = clamp(dZ[2 * k + 1], -2, 2);
      const off = k * n;
      for (let i = 0; i < n; i++) {
        const idx = off + i;
        const gB = dR * this.pBr[idx] + dI * this.pBi[idx];
        const gW = dR * this.pWr[idx] + dI * this.pWi[idx];
        this.B[idx] = clamp(this.B[idx] - lrEff * gB - 0.02 * lrEff * (this.B[idx] - this.B0[idx]), -2.5, 2.5);
        this.Wd[idx] = clamp(this.Wd[idx] - 0.6 * lrEff * gW - 0.02 * lrEff * (this.Wd[idx] - this.Wd0[idx]), -2.0, 2.0);
      }
      const gb = dR * this.pbr[k] + dI * this.pbi[k];
      const gw = dR * this.pwr[k] + dI * this.pwi[k];
      this.bd[k] = clamp(this.bd[k] - 0.5 * lrEff * gb - 0.02 * lrEff * this.bd[k], -2.5, 2.5);
      this.omega[k] = clamp(this.omega[k] - 0.25 * lrEff * gw - 0.02 * lrEff * (this.omega[k] - this.omega0[k]), -3.5, 3.5);
    }
  }

  features(out) {
    for (let k = 0; k < this.M; k++) { out[2 * k] = this.re[k]; out[2 * k + 1] = this.im[k]; }
    return out;
  }
}

export class WorldModel {
  constructor(nZ, nY, seed = 1, scale = null) {
    const r = mulberry(seed * 577 + 13);
    const scaleName = resolveWMScale(scale);
    const cfg = WM_SCALES[scaleName];
    const { L, d, H, ffn, T, d5 } = cfg;
    const dh = (d / H) | 0;
    const halfDh = dh >> 1;

    this.scaleName = scaleName;
    this.nZ = nZ;
    this.nY = nY;
    this.nLayers = L;
    this.dModel = d;
    this.H = d; // compatibility alias
    this.nHeads = H;
    this.dHead = dh;
    this.dFFN = ffn;
    this.ctxLen = T;
    this.d5 = d5;
    this.K5 = 5;
    this.nAct = Math.min(8, nZ);
    this.nA5 = this.K5 * this.nAct;

    let pCount = 0;
    const allocF32 = (len, std) => {
      pCount += len;
      const a = new Float32Array(len);
      if (std > 0) for (let i = 0; i < len; i++) a[i] = gauss(r) * std;
      return a;
    };
    const allocOnes = (len) => {
      pCount += len;
      const a = new Float32Array(len);
      a.fill(1);
      return a;
    };

    // Token input projection: z_t -> x^(0)_t in R^d
    this.Win = allocF32(d * nZ, 0.75 / Math.sqrt(nZ));
    this.bin = allocF32(d, 0);

    // Precompute multi-scale Rotary Position Embeddings (RoPE) for causal lags 0..T-1
    this.ropeCos = new Float32Array(T * halfDh);
    this.ropeSin = new Float32Array(T * halfDh);
    for (let lag = 0; lag < T; lag++) {
      for (let m = 0; m < halfDh; m++) {
        const freq = 0.85 * Math.pow(20, (-2 * m) / dh);
        const ang = lag * freq;
        this.ropeCos[lag * halfDh + m] = Math.cos(ang);
        this.ropeSin[lag * halfDh + m] = Math.sin(ang);
      }
    }

    // L Transformer-XL blocks: RMSNorm -> Causal Multi-Head RoPE Self-Attention -> RMSNorm -> SwiGLU FFN
    const sProj = 0.75 / Math.sqrt(d);
    const sRes = 0.35 / Math.sqrt(2 * L * d);
    const sFFN = 0.75 / Math.sqrt(d);
    const sDown = 0.35 / Math.sqrt(2 * L * ffn);
    const pastCap = T - 1;

    this.blocks = [];
    for (let l = 0; l < L; l++) {
      this.blocks.push({
        rms1: allocOnes(d),
        Wq: allocF32(d * d, sProj),
        Wk: allocF32(d * d, sProj),
        Wv: allocF32(d * d, sProj),
        Wo: allocF32(d * d, sRes),
        rms2: allocOnes(d),
        Wgate: allocF32(ffn * d, sFFN),
        Wup: allocF32(ffn * d, sFFN),
        Wdown: allocF32(d * ffn, sDown),
        // Transformer-XL recurrent KV & normalized activation ring buffer for past T-1 tokens
        pastXNorm: new Float32Array(pastCap * d),
        pastKRaw: new Float32Array(pastCap * d),
        pastV: new Float32Array(pastCap * d),
        // Forward cache for exact analytical backprop on active token
        xIn: new Float32Array(d),
        xNorm1: new Float32Array(d),
        invRms1: 1,
        q: new Float32Array(d),
        kRaw0: new Float32Array(d),
        v0: new Float32Array(d),
        alpha: new Float32Array(H * T),
        kRotCache: new Float32Array(T * d),
        attnOut: new Float32Array(d),
        uMid: new Float32Array(d),
        uNorm2: new Float32Array(d),
        invRms2: 1,
        gatePre: new Float32Array(ffn),
        upPre: new Float32Array(ffn),
        ffnAct: new Float32Array(ffn),
      });
    }

    // 1-step (+0.1 s) output head + causal velocity/linear skip highways
    this.rmsOut = allocOnes(d);
    this.Wout = allocF32(nY * d, 0.14 / Math.sqrt(d));
    this.bout = allocF32(nY, 0);
    this.Wskip = allocF32(nY * nZ, 0);
    this.Wvel = allocF32(nY * nZ, 0); // first-difference temporal skip (z_t - z_{t-1})

    // 5-step (+0.5 s) action-conditioned nonlinear SwiGLU horizon head
    const nA5 = this.nA5;
    this.Wg5h = allocF32(d5 * d, 0.65 / Math.sqrt(d));
    this.Wg5a = allocF32(d5 * nA5, 0.9 / Math.sqrt(12));
    this.bg5 = allocF32(d5, 0);
    this.Wu5h = allocF32(d5 * d, 0.65 / Math.sqrt(d));
    this.Wu5a = allocF32(d5 * nA5, 0.9 / Math.sqrt(12));
    this.bu5 = allocF32(d5, 0);
    this.Wout5 = allocF32(nY * d5, 0.04 / Math.sqrt(d5));
    this.bout5 = allocF32(nY, 0);
    this.Wskip5z = allocF32(nY * nZ, 0);
    this.Wskip5a = allocF32(nY * nA5, 0);
    this.Wvel5 = allocF32(nY * nZ, 0);

    // Heteroscedastic uncertainty head (predicts expected MSE before observing y)
    this.Wvar = allocF32(d, 0.05);
    this.bvar = -2.4;
    pCount += 1;
    this.predVar = 0.08;
    this.paramCount = pCount;

    // Causal token history ring buffer (stores past T-1 tokens)
    this.pastCap = pastCap;
    this.ringPtr = 0; // points to newest committed slot; -1 before any commit
    this.ringCount = 0;
    this.lastZ = new Float64Array(nZ);
    this.hasLastZ = false;
    this.attnEntropy = 0;

    // 5-step (+0.5 s) causal FIFO buffer for online multi-horizon learning
    this.fifo5 = Array.from({ length: this.K5 }, () => ({
      z: new Float64Array(nZ),
      dz: new Float64Array(nZ),
      h: new Float32Array(d),
      act: new Float64Array(this.nAct),
    }));
    this.fifoLen = 0;
    this.fifoHead = 0; // oldest index when full
    this.actSeqBuf = new Float64Array(nA5);
    this.p5Buf = new Float64Array(nY);
    this.g5Buf = new Float32Array(d5);
    this.u5Buf = new Float32Array(d5);
    this.act5Buf = new Float32Array(d5);

    // Forward/backward scratch buffers (zero GC churn)
    this.xCur = new Float32Array(d);
    this.xNext = new Float32Array(d);
    this.hOutNorm = new Float32Array(d);
    this.invRmsOut = 1;
    this.dzBuf = new Float64Array(nZ);
    this.pBuf = new Float64Array(nY);
    this.dxBuf = new Float32Array(d);
    this.duBuf = new Float32Array(d);
    this.duNormBuf = new Float32Array(d);
    this.dxNormBuf = new Float32Array(d);
    this.dAttnBuf = new Float32Array(d);
    this.dqBuf = new Float32Array(d);
    this.dkRawBuf = new Float32Array(d);
    this.dvBuf = new Float32Array(d);
    this.dFfnBuf = new Float32Array(ffn);
    this.dGateBuf = new Float32Array(ffn);
    this.dUpBuf = new Float32Array(ffn);
    this.gradZ = new Float64Array(nZ);

    this.err = new Float64Array(nY);
    this.err5 = new Float64Array(nY);
    this.var = 1;
    this.surprise = 0;
    this.mse = 1;
    this.mse5 = 1;
    this.n = 0;
    this.n5 = 0;
    this.lesion = false;
  }

  /** Create an isolated causal KV rollout context for multi-step REM dream rollouts */
  newRolloutCtx() {
    const pastCap = this.pastCap, d = this.dModel, L = this.nLayers;
    return {
      ringPtr: this.ringPtr,
      ringCount: this.ringCount,
      hasLastZ: this.hasLastZ,
      lastZ: Float64Array.from(this.lastZ),
      pastKRaw: Array.from({ length: L }, (_, l) => Float32Array.from(this.blocks[l].pastKRaw)),
      pastV: Array.from({ length: L }, (_, l) => Float32Array.from(this.blocks[l].pastV)),
      pastCap,
      d,
    };
  }

  /** Encode token z through Win + L Causal Multi-Head RoPE Self-Attention + SwiGLU blocks */
  _encode(z, useHistory = true, ctx = null) {
    const { nZ, dModel: d, nLayers: L, nHeads: H, dHead: dh, dFFN: ffn, Win, bin, ropeCos, ropeSin, pastCap } = this;
    const halfDh = dh >> 1;
    const invSqrtDh = 1 / Math.sqrt(dh);
    const x = this.xCur;
    const xNext = this.xNext;

    for (let j = 0; j < d; j++) {
      let s = bin[j];
      const off = j * nZ;
      for (let i = 0; i < nZ; i++) s += Win[off + i] * z[i];
      x[j] = s;
    }

    const histCount = useHistory ? (ctx ? ctx.ringCount : this.ringCount) : 0;
    const histPtr = ctx ? ctx.ringPtr : this.ringPtr;
    const nLags = 1 + histCount; // lag 0 = current token, lag 1..histCount = past causal tokens
    let entSum = 0;

    for (let l = 0; l < L; l++) {
      const blk = this.blocks[l];
      blk.xIn.set(x);
      blk.invRms1 = rmsNormFwd(x, blk.rms1, blk.xNorm1);

      const { Wq, Wk, Wv, Wo, xNorm1, q, kRaw0, v0, alpha, kRotCache, attnOut } = blk;
      for (let j = 0; j < d; j++) {
        const off = j * d;
        let sq = 0, sk = 0, sv = 0;
        for (let i = 0; i < d; i++) {
          const xi = xNorm1[i];
          sq += Wq[off + i] * xi;
          sk += Wk[off + i] * xi;
          sv += Wv[off + i] * xi;
        }
        q[j] = sq;
        kRaw0[j] = sk;
        v0[j] = sv;
      }

      const pK = ctx ? ctx.pastKRaw[l] : blk.pastKRaw;
      const pV = ctx ? ctx.pastV[l] : blk.pastV;

      // Multi-head RoPE scaled dot-product causal self-attention
      for (let h = 0; h < H; h++) {
        const hOff = h * dh;
        const aOff = h * this.ctxLen;
        let maxScore = -1e30;

        for (let lag = 0; lag < nLags; lag++) {
          let srcK, kOff;
          if (lag === 0) {
            srcK = kRaw0;
            kOff = hOff;
          } else {
            const slot = (histPtr - (lag - 1) + pastCap) % pastCap;
            srcK = pK;
            kOff = slot * d + hOff;
          }
          const rOff = lag * halfDh;
          const rotBase = lag * d + hOff;
          let dot = 0;
          for (let m = 0; m < halfDh; m++) {
            const c = ropeCos[rOff + m], s = ropeSin[rOff + m];
            const k0 = srcK[kOff + 2 * m], k1 = srcK[kOff + 2 * m + 1];
            const kr0 = k0 * c - k1 * s;
            const kr1 = k0 * s + k1 * c;
            kRotCache[rotBase + 2 * m] = kr0;
            kRotCache[rotBase + 2 * m + 1] = kr1;
            dot += q[hOff + 2 * m] * kr0 + q[hOff + 2 * m + 1] * kr1;
          }
          const sc = dot * invSqrtDh;
          alpha[aOff + lag] = sc;
          if (sc > maxScore) maxScore = sc;
        }

        let sumExp = 0;
        for (let lag = 0; lag < nLags; lag++) {
          const w = Math.exp(alpha[aOff + lag] - maxScore);
          alpha[aOff + lag] = w;
          sumExp += w;
        }
        const invSum = 1 / (sumExp + 1e-12);
        for (let m = 0; m < dh; m++) attnOut[hOff + m] = 0;
        let hEnt = 0;
        for (let lag = 0; lag < nLags; lag++) {
          const w = alpha[aOff + lag] * invSum;
          alpha[aOff + lag] = w;
          if (w > 1e-7) hEnt -= w * Math.log(w);
          let srcV, vOff;
          if (lag === 0) {
            srcV = v0;
            vOff = hOff;
          } else {
            const slot = (histPtr - (lag - 1) + pastCap) % pastCap;
            srcV = pV;
            vOff = slot * d + hOff;
          }
          for (let m = 0; m < dh; m++) attnOut[hOff + m] += w * srcV[vOff + m];
        }
        entSum += hEnt;
      }

      // Output projection + attention residual
      for (let j = 0; j < d; j++) {
        let s = x[j];
        const off = j * d;
        for (let i = 0; i < d; i++) s += Wo[off + i] * attnOut[i];
        blk.uMid[j] = s;
      }

      // Pre-FFN RMSNorm + SwiGLU FFN + residual
      blk.invRms2 = rmsNormFwd(blk.uMid, blk.rms2, blk.uNorm2);
      const { Wgate, Wup, Wdown, uNorm2, gatePre, upPre, ffnAct } = blk;
      for (let k = 0; k < ffn; k++) {
        const off = k * d;
        let sg = 0, su = 0;
        for (let i = 0; i < d; i++) {
          const ui = uNorm2[i];
          sg += Wgate[off + i] * ui;
          su += Wup[off + i] * ui;
        }
        gatePre[k] = sg;
        upPre[k] = su;
        ffnAct[k] = silu(sg) * su;
      }
      for (let j = 0; j < d; j++) {
        let s = blk.uMid[j];
        const off = j * ffn;
        for (let k = 0; k < ffn; k++) s += Wdown[off + k] * ffnAct[k];
        xNext[j] = s;
      }
      x.set(xNext);
    }

    this.attnEntropy = entSum / (L * H);
    this.invRmsOut = rmsNormFwd(x, this.rmsOut, this.hOutNorm);

    // If a mutable rollout context was supplied (e.g. REM dream rollout), advance its KV ring buffer
    if (ctx) {
      const nextSlot = (ctx.ringPtr + 1) % pastCap;
      for (let l = 0; l < L; l++) {
        ctx.pastKRaw[l].set(this.blocks[l].kRaw0, nextSlot * d);
        ctx.pastV[l].set(this.blocks[l].v0, nextSlot * d);
      }
      ctx.ringPtr = nextSlot;
      if (ctx.ringCount < pastCap) ctx.ringCount++;
    }
    return this.hOutNorm;
  }

  /** Commit active token's normalized activations and KV projections into the live waking ring buffer */
  _commitToken(z) {
    const { dModel: d, nLayers: L, pastCap } = this;
    const nextSlot = (this.ringCount === 0 ? 0 : (this.ringPtr + 1) % pastCap);
    for (let l = 0; l < L; l++) {
      const blk = this.blocks[l];
      blk.pastXNorm.set(blk.xNorm1, nextSlot * d);
      blk.pastKRaw.set(blk.kRaw0, nextSlot * d);
      blk.pastV.set(blk.v0, nextSlot * d);
    }
    this.ringPtr = nextSlot;
    if (this.ringCount < pastCap) this.ringCount++;
    this.lastZ.set(z);
    this.hasLastZ = true;
  }

  /** 1-step (+0.1 s) prediction: y_{t+1} from z_t + causal T=8 token history */
  predict(z, out, rolloutCtx = null, useHistory = true) {
    const { nZ, nY, dModel: d, Wout, bout, Wskip, Wvel, dzBuf } = this;
    const hasPrev = useHistory && (rolloutCtx ? rolloutCtx.hasLastZ : this.hasLastZ);
    const prevZ = rolloutCtx ? rolloutCtx.lastZ : this.lastZ;
    if (hasPrev) {
      for (let i = 0; i < nZ; i++) dzBuf[i] = z[i] - prevZ[i];
    } else {
      dzBuf.fill(0);
    }

    const h = this._encode(z, useHistory, rolloutCtx);
    if (rolloutCtx) {
      rolloutCtx.lastZ.set(z);
      rolloutCtx.hasLastZ = true;
    }

    for (let o = 0; o < nY; o++) {
      let s = bout[o];
      const offD = o * d, offZ = o * nZ;
      for (let j = 0; j < d; j++) s += Wout[offD + j] * h[j];
      for (let i = 0; i < nZ; i++) s += Wskip[offZ + i] * z[i] + Wvel[offZ + i] * dzBuf[i];
      out[o] = s;
    }

    let sv = this.bvar;
    for (let j = 0; j < d; j++) sv += this.Wvar[j] * h[j];
    this.predVar = softplus(clamp(sv, -8, 6)) + 1e-4;
    return out;
  }

  /** 5-step (+0.5 s) action-conditioned multi-horizon prediction: y_{t+5} from (z_t, 5-step motor plan A_5) */
  predict5(z0, actSeq40, out, hCtx = null, dz0 = null) {
    const { nZ, nY, dModel: d, d5, nA5, Wg5h, Wg5a, bg5, Wu5h, Wu5a, bu5, Wout5, bout5, Wskip5z, Wskip5a, Wvel5, g5Buf, u5Buf, act5Buf } = this;
    const h = hCtx || this._encode(z0, false, null);

    for (let k = 0; k < d5; k++) {
      const offH = k * d, offA = k * nA5;
      let sg = bg5[k], su = bu5[k];
      for (let j = 0; j < d; j++) {
        const hj = h[j];
        sg += Wg5h[offH + j] * hj;
        su += Wu5h[offH + j] * hj;
      }
      for (let a = 0; a < nA5; a++) {
        const va = actSeq40[a];
        sg += Wg5a[offA + a] * va;
        su += Wu5a[offA + a] * va;
      }
      g5Buf[k] = sg;
      u5Buf[k] = su;
      act5Buf[k] = silu(sg) * su;
    }

    for (let o = 0; o < nY; o++) {
      let s = bout5[o];
      const off5 = o * d5, offZ = o * nZ, offA = o * nA5;
      for (let k = 0; k < d5; k++) s += Wout5[off5 + k] * act5Buf[k];
      for (let i = 0; i < nZ; i++) s += Wskip5z[offZ + i] * z0[i];
      if (dz0) for (let i = 0; i < nZ; i++) s += Wvel5[offZ + i] * dz0[i];
      for (let a = 0; a < nA5; a++) s += Wskip5a[offA + a] * actSeq40[a];
      out[o] = s;
    }
    return out;
  }

  /** Online analytical backprop through the 5-step (+0.5 s) SwiGLU horizon head */
  _learn5(z0, dz0, h0, actSeq40, yTarget, lr) {
    const { nZ, nY, dModel: d, d5, nA5, Wg5h, Wg5a, bg5, Wu5h, Wu5a, bu5, Wout5, bout5, Wskip5z, Wskip5a, Wvel5, g5Buf, u5Buf, act5Buf, p5Buf } = this;
    this.predict5(z0, actSeq40, p5Buf, h0, dz0);

    let zz = 1, dzz = 1, aa = 1, hh = 1, f5n = 1;
    for (let i = 0; i < nZ; i++) {
      zz += z0[i] * z0[i];
      dzz += dz0[i] * dz0[i];
    }
    for (let a = 0; a < nA5; a++) aa += actSeq40[a] * actSeq40[a];
    for (let j = 0; j < d; j++) hh += h0[j] * h0[j];
    for (let k = 0; k < d5; k++) f5n += act5Buf[k] * act5Buf[k];

    // zz and aa already start at 1 above, so joint linear norm = zz + aa - 1
    const linNorm5 = zz + aa - 1;
    const etaSkZ = (0.88 * lr) / linNorm5;
    const etaSkA = (0.88 * lr) / linNorm5;
    const etaVel5 = (0.32 * lr) / (linNorm5 + dzz);
    const etaOut5 = (0.24 * lr) / (f5n + linNorm5);
    const etaHid5 = (0.9 * lr) / (hh + 2 * aa + 4);

    const dAct5 = this.dFfnBuf; // length ffn >= d5
    for (let k = 0; k < d5; k++) dAct5[k] = 0;

    let se5 = 0;
    for (let o = 0; o < nY; o++) {
      const gp = p5Buf[o] - yTarget[o];
      this.err5[o] = -gp;
      se5 += gp * gp;
      const off5 = o * d5, offZ = o * nZ, offA = o * nA5;
      for (let k = 0; k < d5; k++) {
        dAct5[k] += Wout5[off5 + k] * gp;
        Wout5[off5 + k] = clamp(Wout5[off5 + k] - etaOut5 * gp * act5Buf[k], -2.5, 2.5);
      }
      bout5[o] = clamp(bout5[o] - 0.2 * etaSkZ * gp, -2.5, 2.5);
      for (let i = 0; i < nZ; i++) {
        Wskip5z[offZ + i] = clamp(Wskip5z[offZ + i] - etaSkZ * gp * z0[i], -2.5, 2.5);
        Wvel5[offZ + i] = clamp(Wvel5[offZ + i] - etaVel5 * gp * dz0[i], -2.0, 2.0);
      }
      for (let a = 0; a < nA5; a++) Wskip5a[offA + a] = clamp(Wskip5a[offA + a] - etaSkA * gp * actSeq40[a], -2.5, 2.5);
    }
    se5 /= nY;
    this.lastSe5 = se5;

    for (let k = 0; k < d5; k++) {
      const da = dAct5[k];
      const dg = clamp(da * u5Buf[k] * dsilu(g5Buf[k]), -3, 3);
      const du = clamp(da * silu(g5Buf[k]), -3, 3);
      const offH = k * d, offA = k * nA5;
      for (let j = 0; j < d; j++) {
        const hj = h0[j];
        Wg5h[offH + j] = clamp(Wg5h[offH + j] - etaHid5 * dg * hj, -2.5, 2.5);
        Wu5h[offH + j] = clamp(Wu5h[offH + j] - etaHid5 * du * hj, -2.5, 2.5);
      }
      for (let a = 0; a < nA5; a++) {
        const va = actSeq40[a];
        Wg5a[offA + a] = clamp(Wg5a[offA + a] - etaHid5 * dg * va, -2.5, 2.5);
        Wu5a[offA + a] = clamp(Wu5a[offA + a] - etaHid5 * du * va, -2.5, 2.5);
      }
      bg5[k] = clamp(bg5[k] - etaHid5 * dg, -2.5, 2.5);
      bu5[k] = clamp(bu5[k] - etaHid5 * du, -2.5, 2.5);
    }

    this.mse5 = this.n5 === 0 ? se5 : this.mse5 + 0.01 * (se5 - this.mse5);
    this.n5++;
    return se5;
  }

  /** Online analytical backprop through Output + L Causal RoPE-SwiGLU Transformer blocks + SelectiveSSM RTRL */
  learn(z, y, lr = 0.05, ssm = null, isSeq = null) {
    if (this.lesion) { this.surprise = 0; return 0; }
    // Sequential waking call unless explicitly marked non-sequential (e.g. random sleep replay)
    const seq = isSeq !== null ? !!isSeq : (ssm !== null || this.n < 8);
    const {
      nZ, nY, dModel: d, nLayers: L, nHeads: H, dHead: dh, dFFN: ffn,
      Win, bin, Wout, bout, Wskip, Wvel, ropeCos, ropeSin, pastCap,
      hOutNorm, dzBuf, pBuf, dxBuf, duBuf, duNormBuf, dxNormBuf, dAttnBuf, dqBuf, dkRawBuf, dvBuf, dFfnBuf, dGateBuf, dUpBuf, gradZ,
    } = this;
    const halfDh = dh >> 1;
    const invSqrtDh = 1 / Math.sqrt(dh);

    this.predict(z, pBuf, null, seq);

    let zz = 1, dzz = 1, hh = 1;
    for (let i = 0; i < nZ; i++) {
      zz += z[i] * z[i];
      dzz += dzBuf[i] * dzBuf[i];
    }
    for (let j = 0; j < d; j++) hh += hOutNorm[j] * hOutNorm[j];

    const hasVel = seq && this.hasLastZ;
    // zz already starts at 1 above!
    const etaSkip = (0.86 * lr) / zz;
    const etaVel = hasVel ? (0.35 * lr) / (zz + dzz) : 0;
    const etaOut = (0.45 * lr) / (hh + 0.5 * zz);
    const etaTr = (0.65 * lr) / (d + zz);
    const etaNorm = 0.15 * etaTr;

    let se = 0;
    const dOutNorm = duNormBuf;
    dOutNorm.fill(0);
    gradZ.fill(0);

    for (let o = 0; o < nY; o++) {
      const gp = pBuf[o] - y[o]; // d(nY * L)/dp_o
      this.err[o] = -gp;
      se += gp * gp;
      const offD = o * d, offZ = o * nZ;
      for (let j = 0; j < d; j++) {
        dOutNorm[j] += Wout[offD + j] * gp;
        Wout[offD + j] = clamp(Wout[offD + j] - etaOut * gp * hOutNorm[j], -2.5, 2.5);
      }
      bout[o] = clamp(bout[o] - etaSkip * gp, -2.5, 2.5);
      for (let i = 0; i < nZ; i++) {
        gradZ[i] += (Wskip[offZ + i] + (etaVel > 0 ? Wvel[offZ + i] : 0)) * gp;
        Wskip[offZ + i] = clamp(Wskip[offZ + i] - etaSkip * gp * z[i], -2.5, 2.5);
        if (etaVel > 0) Wvel[offZ + i] = clamp(Wvel[offZ + i] - etaVel * gp * dzBuf[i], -2.0, 2.0);
      }
    }
    se /= nY;

    // Backprop through final RMSNorm into x^(L)
    dxBuf.fill(0);
    const xFinal = this.xCur;
    rmsNormBwdUpdate(xFinal, this.invRmsOut, this.rmsOut, dOutNorm, dxBuf, etaNorm);

    const histCount = seq ? this.ringCount : 0;
    const nLags = 1 + histCount;

    // Backprop analytically through all L Transformer-XL blocks (SwiGLU FFN + Multi-Head RoPE Self-Attention)
    for (let l = L - 1; l >= 0; l--) {
      const blk = this.blocks[l];
      const { Wq, Wk, Wv, Wo, Wgate, Wup, Wdown, uMid, uNorm2, gatePre, upPre, ffnAct, xIn, xNorm1, q, v0, alpha, kRotCache, attnOut } = blk;

      // 1) SwiGLU FFN backward: xNext = uMid + Wdown * (silu(gatePre) * upPre)
      duBuf.set(dxBuf);
      dFfnBuf.fill(0);
      for (let j = 0; j < d; j++) {
        const dxj = clamp(dxBuf[j], -3, 3);
        const off = j * ffn;
        for (let k = 0; k < ffn; k++) {
          dFfnBuf[k] += Wdown[off + k] * dxj;
          Wdown[off + k] = clamp(Wdown[off + k] - etaTr * dxj * ffnAct[k], -2.5, 2.5);
        }
      }
      duNormBuf.fill(0);
      for (let k = 0; k < ffn; k++) {
        const df = dFfnBuf[k];
        const dg = clamp(df * upPre[k] * dsilu(gatePre[k]), -3, 3);
        const du = clamp(df * silu(gatePre[k]), -3, 3);
        dGateBuf[k] = dg;
        dUpBuf[k] = du;
        const off = k * d;
        for (let i = 0; i < d; i++) {
          const ui = uNorm2[i];
          duNormBuf[i] += Wgate[off + i] * dg + Wup[off + i] * du;
          Wgate[off + i] = clamp(Wgate[off + i] - etaTr * dg * ui, -2.5, 2.5);
          Wup[off + i] = clamp(Wup[off + i] - etaTr * du * ui, -2.5, 2.5);
        }
      }
      rmsNormBwdUpdate(uMid, blk.invRms2, blk.rms2, duNormBuf, duBuf, etaNorm);

      // 2) Multi-Head RoPE Self-Attention backward: uMid = xIn + Wo * attnOut
      dxBuf.set(duBuf); // residual path into xIn
      dAttnBuf.fill(0);
      for (let j = 0; j < d; j++) {
        const duj = clamp(duBuf[j], -3, 3);
        const off = j * d;
        for (let i = 0; i < d; i++) {
          dAttnBuf[i] += Wo[off + i] * duj;
          Wo[off + i] = clamp(Wo[off + i] - etaTr * duj * attnOut[i], -2.5, 2.5);
        }
      }

      dqBuf.fill(0);
      dxNormBuf.fill(0);

      for (let lag = 0; lag < nLags; lag++) {
        dkRawBuf.fill(0);
        dvBuf.fill(0);
        const slot = lag === 0 ? -1 : (this.ringPtr - (lag - 1) + pastCap) % pastCap;
        const rOff = lag * halfDh;
        const rotBase = lag * d;

        for (let h = 0; h < H; h++) {
          const hOff = h * dh;
          const aOff = h * this.ctxLen;
          const wLag = alpha[aOff + lag];

          // Value gradient dv_lag = alpha[h, lag] * dAttn_h
          for (let m = 0; m < dh; m++) dvBuf[hOff + m] = wLag * dAttnBuf[hOff + m];

          // Softmax score gradient dScore[h, lag]
          let dotLag = 0, expectedDot = 0;
          for (let lag2 = 0; lag2 < nLags; lag2++) {
            let srcV2, vOff2;
            if (lag2 === 0) {
              srcV2 = v0;
              vOff2 = hOff;
            } else {
              const s2 = (this.ringPtr - (lag2 - 1) + pastCap) % pastCap;
              srcV2 = blk.pastV;
              vOff2 = s2 * d + hOff;
            }
            let dvDot = 0;
            for (let m = 0; m < dh; m++) dvDot += dAttnBuf[hOff + m] * srcV2[vOff2 + m];
            if (lag2 === lag) dotLag = dvDot;
            expectedDot += alpha[aOff + lag2] * dvDot;
          }
          const dScore = clamp(wLag * (dotLag - expectedDot) * invSqrtDh, -3, 3);

          // RoPE backward: dq_h += dScore * kRot_lag, dkRaw_lag = RoPE(-lag, dScore * q_h)
          for (let m = 0; m < halfDh; m++) {
            const c = ropeCos[rOff + m], s = ropeSin[rOff + m];
            dqBuf[hOff + 2 * m] += dScore * kRotCache[rotBase + hOff + 2 * m];
            dqBuf[hOff + 2 * m + 1] += dScore * kRotCache[rotBase + hOff + 2 * m + 1];
            const q0 = dScore * q[hOff + 2 * m], q1 = dScore * q[hOff + 2 * m + 1];
            dkRawBuf[hOff + 2 * m] = q0 * c + q1 * s;       // R(-lag) = R(lag)^T
            dkRawBuf[hOff + 2 * m + 1] = -q0 * s + q1 * c;
          }
        }

        // Update Wk and Wv for this causal lag (and accumulate dxNorm1 on lag 0)
        const srcX = lag === 0 ? xNorm1 : blk.pastXNorm;
        const xOff = lag === 0 ? 0 : slot * d;
        const etaLag = lag === 0 ? etaTr : (0.5 * etaTr) / nLags;
        for (let j = 0; j < d; j++) {
          const dk = clamp(dkRawBuf[j], -3, 3), dv = clamp(dvBuf[j], -3, 3);
          const off = j * d;
          if (lag === 0) {
            for (let i = 0; i < d; i++) {
              const xi = srcX[i];
              dxNormBuf[i] += Wk[off + i] * dk + Wv[off + i] * dv;
              Wk[off + i] = clamp(Wk[off + i] - etaLag * dk * xi, -2.5, 2.5);
              Wv[off + i] = clamp(Wv[off + i] - etaLag * dv * xi, -2.5, 2.5);
            }
          } else {
            for (let i = 0; i < d; i++) {
              const xi = srcX[xOff + i];
              Wk[off + i] = clamp(Wk[off + i] - etaLag * dk * xi, -2.5, 2.5);
              Wv[off + i] = clamp(Wv[off + i] - etaLag * dv * xi, -2.5, 2.5);
            }
          }
        }
      }

      // Update Wq and accumulate query gradient into dxNorm1
      for (let j = 0; j < d; j++) {
        const dq = clamp(dqBuf[j], -3, 3), off = j * d;
        for (let i = 0; i < d; i++) {
          dxNormBuf[i] += Wq[off + i] * dq;
          Wq[off + i] = clamp(Wq[off + i] - etaTr * dq * xNorm1[i], -2.5, 2.5);
        }
      }
      rmsNormBwdUpdate(xIn, blk.invRms1, blk.rms1, dxNormBuf, dxBuf, etaNorm);
    }

    // Backprop through input token embedding Win -> gradZ (for SelectiveSSM RTRL!)
    for (let j = 0; j < d; j++) {
      const dx = clamp(dxBuf[j], -3, 3), off = j * nZ;
      for (let i = 0; i < nZ; i++) {
        gradZ[i] += Win[off + i] * dx;
        Win[off + i] = clamp(Win[off + i] - etaTr * dx * z[i], -2.5, 2.5);
      }
      bin[j] = clamp(bin[j] - etaTr * dx, -2.5, 2.5);
    }

    // Heteroscedastic uncertainty head update
    const varErr = clamp(this.predVar - se, -2, 2);
    const sigVar = 1 - Math.exp(-Math.max(0, this.predVar - 1e-4));
    const gVar = (0.08 * varErr * sigVar) / hh;
    for (let j = 0; j < d; j++) this.Wvar[j] = clamp(this.Wvar[j] - gVar * hOutNorm[j], -2, 2);
    this.bvar = clamp(this.bvar - gVar * hh * 0.25, -6, 4);

    // Online 5-step (+0.5 s) multi-horizon training on sequential waking streams
    if (seq) {
      const nAct = this.nAct, K5 = this.K5;
      const actStart = nZ - nAct;
      if (this.fifoLen === K5 - 1) {
        // fifo holds [t-5, t-4, t-3, t-2]; combining with current z_{t-1}'s action yields exact 5-step plan -> y_t
        const oldest = this.fifo5[this.fifoHead];
        for (let s = 0; s < K5 - 1; s++) {
          const entry = this.fifo5[(this.fifoHead + s) % K5];
          this.actSeqBuf.set(entry.act, s * nAct);
        }
        for (let a = 0; a < nAct; a++) this.actSeqBuf[(K5 - 1) * nAct + a] = z[actStart + a];
        this._learn5(oldest.z, oldest.dz, oldest.h, this.actSeqBuf, y, lr);
        // Overwrite oldest slot with current step (z_{t-1}, dz_{t-1}, h_{t-1}, act_{t-1}) and advance head
        oldest.z.set(z);
        oldest.dz.set(dzBuf);
        oldest.h.set(hOutNorm);
        for (let a = 0; a < nAct; a++) oldest.act[a] = z[actStart + a];
        this.fifoHead = (this.fifoHead + 1) % K5;
      } else {
        const slot = this.fifo5[(this.fifoHead + this.fifoLen) % K5];
        slot.z.set(z);
        slot.dz.set(dzBuf);
        slot.h.set(hOutNorm);
        for (let a = 0; a < nAct; a++) slot.act[a] = z[actStart + a];
        this.fifoLen++;
      }
      this._commitToken(z);
    }

    if (ssm && this.n >= 40) {
      for (let i = 0; i < nZ; i++) gradZ[i] /= nY;
      ssm.backward(gradZ, lr * 0.035);
    }

    this.mse = this.n === 0 ? se : this.mse + 0.01 * (se - this.mse);
    this.var += 0.002 * (se - this.var);
    this.surprise = clamp(se / (this.var + 1e-6) / 4);
    this.n++;
    return se;
  }
}

export const STAGES = ['WAKE', 'N1', 'N2', 'N3', 'REM'];
export class Sleep {
  constructor() { this.S = 0.35; this.asleep = false; this.ultra = 0; this.stage = 0; this.orx = 0; this.forceWake = 0; this.cycles = 0; }
  tick(hour, eng, ne, melatonin, spikesNorm) {
    if (!this.asleep) this.S += 0.0009 * (1 + 0.5 * spikesNorm) * (1 - this.S); else this.S -= 0.0028 * this.S;
    const scnOut = Math.cos((2 * Math.PI * (hour - 14)) / 24); const C = 0.25 * scnOut; this.orx += 0.02 * (Math.min(1, eng) - this.orx);
    const drive = this.S - C + 0.15 * melatonin - 0.1 * Math.max(0, ne - 0.3); const thr = 0.62 + 0.5 * this.orx; const forced = this.forceWake > 0; if (this.forceWake > 0) this.forceWake--;
    if (!this.asleep && drive > thr && !forced) { this.asleep = true; this.ultra = 0; } else if (this.asleep && (drive < 0.2 || forced)) this.asleep = false;
    if (this.asleep) { this.ultra += 1 / 90; if (this.ultra >= 1) { this.ultra = 0; this.cycles++; } }
    if (!this.asleep) this.stage = 0; else { const u = this.ultra; this.stage = u < 0.1 ? 1 : u < 0.3 ? 2 : u < 0.75 - 0.25 * clamp(0.6 - this.S) ? (this.S > 0.35 ? 3 : 2) : 4; }
    this.drive = drive; return this.stage;
  }
}

export class PredictiveCoding {
  constructor(seed, nY, n1 = 16, n2 = 8) {
    const r = mulberry(seed * 313 + 5);
    this.nY = nY; this.n1 = n1; this.n2 = n2;
    this.r1 = new Float64Array(n1); this.r2 = new Float64Array(n2);
    this.W1 = Float64Array.from({ length: nY * n1 }, () => (r() - 0.5) * 0.2);
    this.W2 = Float64Array.from({ length: n1 * n2 }, () => (r() - 0.5) * 0.2);
    this.e0 = new Float64Array(nY); this.e1 = new Float64Array(n1);
    this.err = 1; this.errSlow = 1; this.surprise = 0; this.lesionLearn = false; this.n = 0;
  }
  step(y, prec = 1, K = 12, eta = 0.12, lr = 0.01) {
    const { nY, n1, n2, W1, W2, r1, r2, e0, e1 } = this;
    const f1 = new Float64Array(n1), f2 = new Float64Array(n2);
    for (let k = 0; k < K; k++) {
      for (let i = 0; i < n1; i++) f1[i] = Math.tanh(r1[i]);
      for (let i = 0; i < n2; i++) f2[i] = Math.tanh(r2[i]);
      for (let o = 0; o < nY; o++) { let p = 0; for (let i = 0; i < n1; i++) p += W1[o * n1 + i] * f1[i]; e0[o] = prec * (y[o] - p); }
      for (let i = 0; i < n1; i++) { let p = 0; for (let j = 0; j < n2; j++) p += W2[i * n2 + j] * f2[j]; e1[i] = r1[i] - p; }
      for (let i = 0; i < n1; i++) { let g = 0; for (let o = 0; o < nY; o++) g += W1[o * n1 + i] * e0[o]; r1[i] += eta * (g * (1 - f1[i] * f1[i]) - e1[i]); }
      for (let j = 0; j < n2; j++) { let g = 0; for (let i = 0; i < n1; i++) g += W2[i * n2 + j] * e1[i]; r2[j] += eta * (g * (1 - f2[j] * f2[j]) - 0.05 * r2[j]); }
    }
    if (!this.lesionLearn) {
      for (let o = 0; o < nY; o++) for (let i = 0; i < n1; i++) W1[o * n1 + i] += lr * e0[o] * Math.tanh(r1[i]);
      for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) W2[i * n2 + j] += lr * e1[i] * Math.tanh(r2[j]);
    }
    let se = 0; for (let o = 0; o < nY; o++) se += (e0[o] / prec) ** 2; se /= nY;
    this.err = se; this.errSlow += 0.01 * (se - this.errSlow);
    this.surprise = clamp(se / (this.errSlow + 1e-6) / 3); this.n++;
    return se;
  }
}
