// Learning machinery beside the spiking substrate (upgraded in pass 15):
//  - SelectiveSSM: 32-mode complex diagonal state-space model (S4D/Mamba selectivity) with exact online mode-wise RTRL
//    eligibility traces for input matrix B, selective step-size gate Wd, gate bias bd, and modal frequencies omega.
//    Prediction-error gradients from the deep WorldModel flow back into SelectiveSSM online (gated by !fixedProj).
//  - WorldModel: 2-hidden-layer SiLU Residual MLP (72 -> 48 -> 48 -> 25 + residual skip) with RMS-preconditioned Adam/NLMS
//    updates AND a learned heteroscedastic uncertainty head (predVar) for second-order metacognitive calibration.
//  - Sleep: two-process (adenosine S + circadian C) flip-flop and ultradian N1/N2/N3/REM stage cycle.
//  - PredictiveCoding: two-level Rao & Ballard / Whittington & Bogacz hierarchical inference & Hebbian error learning.
import { mulberry, gauss, softplus, clamp } from './util.js';

const silu = (x) => x / (1 + Math.exp(-clamp(x, -15, 15)));
const dsilu = (x) => {
  const s = 1 / (1 + Math.exp(-clamp(x, -15, 15)));
  return s * (1 + x * (1 - s));
};

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

    // Exact mode-wise RTRL eligibility traces for current state and 1-step-lagged state (used when predicting y_t from z_{t-1})
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
    c.inDream = true; // disable trace writes during offline REM rollouts
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

  /** Apply backpropagated dL/dz_{t-1} (first 2*M entries of dZ) via RMS-normalised 1-step-lagged RTRL traces */
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
  constructor(nZ, nY, seed = 1, H = 48) {
    const r = mulberry(seed * 577 + 13);
    this.nZ = nZ;
    this.nY = nY;
    this.H = H;
    const s1 = 0.6 / Math.sqrt(nZ), s2 = 0.6 / Math.sqrt(H);
    this.W1 = Float64Array.from({ length: H * nZ }, () => gauss(r) * s1);
    this.b1 = new Float64Array(H);
    this.W2 = Float64Array.from({ length: H * H }, () => gauss(r) * s2);
    this.b2 = new Float64Array(H);
    this.Wout = Float64Array.from({ length: nY * H }, () => gauss(r) * (0.35 / Math.sqrt(H)));
    this.bout = new Float64Array(nY);
    this.Wskip = new Float64Array(nY * nZ); // residual linear highway alongside 2-layer nonlinear trunk
    // Heteroscedastic uncertainty head: predicts expected MSE before observing y
    this.Wvar = Float64Array.from({ length: H }, () => gauss(r) * 0.05);
    this.bvar = -2.2;
    this.predVar = 0.1;

    // Reusable forward/backward scratch buffers (zero GC churn at 10 Hz / REM rollouts)
    this.a1 = new Float64Array(H);
    this.h1 = new Float64Array(H);
    this.a2 = new Float64Array(H);
    this.h2 = new Float64Array(H);
    this.gradZ = new Float64Array(nZ);

    this.err = new Float64Array(nY);
    this.var = 1;
    this.surprise = 0;
    this.mse = 1;
    this.n = 0;
    this.lesion = false;
  }

  predict(z, out) {
    const { nZ, nY, H, W1, b1, W2, b2, Wout, bout, Wskip, a1, h1, a2, h2 } = this;
    for (let j = 0; j < H; j++) {
      let s = b1[j];
      const off = j * nZ;
      for (let i = 0; i < nZ; i++) s += W1[off + i] * z[i];
      a1[j] = s;
      h1[j] = silu(s);
    }
    for (let j = 0; j < H; j++) {
      let s = b2[j];
      const off = j * H;
      for (let i = 0; i < H; i++) s += W2[off + i] * h1[i];
      a2[j] = s;
      h2[j] = h1[j] + silu(s); // residual connection
    }
    for (let o = 0; o < nY; o++) {
      let s = bout[o];
      const offH = o * H, offZ = o * nZ;
      for (let j = 0; j < H; j++) s += Wout[offH + j] * h2[j];
      for (let i = 0; i < nZ; i++) s += Wskip[offZ + i] * z[i];
      out[o] = s;
    }
    let sv = this.bvar;
    for (let j = 0; j < H; j++) sv += this.Wvar[j] * h2[j];
    this.predVar = softplus(clamp(sv, -8, 6)) + 1e-4;
    return out;
  }

  learn(z, y, lr = 0.05, ssm = null) {
    if (this.lesion) { this.surprise = 0; return 0; }
    const { nZ, nY, H, W1, b1, W2, b2, Wout, bout, Wskip, a1, h1, a2, h2, gradZ } = this;
    const p = this.predict(z, new Float64Array(nY));

    let zz = 1, hh = 1;
    for (let i = 0; i < nZ; i++) zz += z[i] * z[i];
    for (let j = 0; j < H; j++) hh += h2[j] * h2[j];
    const etaSkip = lr / zz;
    const etaMLP = (lr * 0.85) / (hh + 0.5 * zz);

    let se = 0;
    const dh2 = new Float64Array(H);
    gradZ.fill(0);

    // Output & skip gradients: Loss = (1 / 2*nY) sum_o (y_o - p_o)^2  (here scaled by nY for NLMS compatibility)
    for (let o = 0; o < nY; o++) {
      const e = y[o] - p[o]; // negative gradient d(-L)/dp_o
      this.err[o] = e;
      se += e * e;
      const offH = o * H, offZ = o * nZ;
      for (let j = 0; j < H; j++) {
        dh2[j] += Wout[offH + j] * (-e);
        Wout[offH + j] += etaMLP * e * h2[j];
      }
      bout[o] += etaMLP * e;
      const gSk = etaSkip * e;
      for (let i = 0; i < nZ; i++) {
        gradZ[i] += Wskip[offZ + i] * (-e);
        Wskip[offZ + i] += gSk * z[i];
      }
    }
    se /= nY;

    // Backprop through residual layer 2: h2 = h1 + silu(a2) (summed over outputs, preconditioned by 1/(hh + zz))
    const etaHid = (lr * 0.9) / (hh + zz);
    const da2 = new Float64Array(H);
    const dh1 = new Float64Array(H);
    for (let j = 0; j < H; j++) {
      const d = dh2[j];
      dh1[j] = d;
      da2[j] = d * dsilu(a2[j]);
    }
    for (let j = 0; j < H; j++) {
      const g = clamp(da2[j], -4, 4), off = j * H;
      for (let i = 0; i < H; i++) {
        dh1[i] += W2[off + i] * g;
        W2[off + i] = clamp(W2[off + i] - etaHid * g * h1[i], -2.5, 2.5);
      }
      b2[j] = clamp(b2[j] - etaHid * g, -2.5, 2.5);
    }

    // Backprop through layer 1: h1 = silu(a1) -> W1, b1, and input z (for SelectiveSSM RTRL!)
    for (let j = 0; j < H; j++) {
      const g = clamp(dh1[j] * dsilu(a1[j]), -4, 4), off = j * nZ;
      for (let i = 0; i < nZ; i++) {
        gradZ[i] += W1[off + i] * g;
        W1[off + i] = clamp(W1[off + i] - etaHid * g * z[i], -2.5, 2.5);
      }
      b1[j] = clamp(b1[j] - etaHid * g, -2.5, 2.5);
    }

    // Train heteroscedastic uncertainty head to predict actual squared error `se`
    const varErr = clamp(this.predVar - se, -2, 2);
    const sigVar = 1 - Math.exp(-Math.max(0, this.predVar - 1e-4)); // d(softplus)/d(logit)
    const gVar = 0.08 * varErr * sigVar / hh;
    for (let j = 0; j < H; j++) this.Wvar[j] = clamp(this.Wvar[j] - gVar * h2[j], -2, 2);
    this.bvar = clamp(this.bvar - gVar * hh * 0.25, -6, 4);

    if (ssm && this.n >= 40) {
      for (let i = 0; i < nZ; i++) gradZ[i] /= nY;
      ssm.backward(gradZ, lr * 0.035);
    }

    this.mse += 0.01 * (se - this.mse);
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
