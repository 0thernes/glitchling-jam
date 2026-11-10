// Learning machinery that sits beside the spiking substrate:
//  - SelectiveSSM: diagonal complex state-space memory (S4D/LRU-style modes with log-spaced decay) whose step size Delta is
//    input-dependent (Mamba-style selectivity). Fixed random input/gating projections; it is the creature's medium-term memory.
//  - WorldModel: predicts the next sensory/proprioceptive vector from SSM features + motor command; readout trained online by
//    normalised LMS. Its prediction error is "surprise" (drives LC/noradrenaline and a curiosity bonus) and it is the simulator
//    used for offline rollouts in REM sleep.
//  - Sleep: two-process (adenosine S + circadian C) flip-flop and ultradian stage cycle ported from the reference organism.
import { mulberry, gauss, softplus, clamp } from './util.js';
export class SelectiveSSM {
  constructor(nIn, nModes, seed) { const r = mulberry(seed * 101 + 7); this.nIn = nIn; this.M = nModes; this.re = new Float64Array(nModes); this.im = new Float64Array(nModes);
    this.alpha = Float64Array.from({ length: nModes }, (_, k) => 0.02 * Math.pow(100, k / (nModes - 1))); this.omega = Float64Array.from({ length: nModes }, () => (r() - 0.5) * 1.2);
    this.B = Float64Array.from({ length: nModes * nIn }, () => gauss(r) / Math.sqrt(nIn)); this.Wd = Float64Array.from({ length: nModes * nIn }, () => (gauss(r) * 0.5) / Math.sqrt(nIn)); this.bd = new Float64Array(nModes).fill(0); this.delta = new Float64Array(nModes); }
  clone() { const c = Object.create(SelectiveSSM.prototype); Object.assign(c, this); c.re = Float64Array.from(this.re); c.im = Float64Array.from(this.im); c.delta = Float64Array.from(this.delta); return c; }
  step(u) { const M = this.M, n = this.nIn; for (let k = 0; k < M; k++) { let g = this.bd[k], bu = 0; for (let i = 0; i < n; i++) { g += this.Wd[k * n + i] * u[i]; bu += this.B[k * n + i] * u[i]; }
      const D = softplus(g); this.delta[k] = D; const mag = Math.exp(-D * this.alpha[k]), th = D * this.omega[k]; const c = mag * Math.cos(th), s = mag * Math.sin(th);
      const re = c * this.re[k] - s * this.im[k] + (1 - mag) * bu, im = s * this.re[k] + c * this.im[k]; this.re[k] = re; this.im[k] = im; } }
  features(out) { for (let k = 0; k < this.M; k++) { out[2 * k] = this.re[k]; out[2 * k + 1] = this.im[k]; } return out; }
}
export class WorldModel {
  constructor(nZ, nY) { this.nZ = nZ; this.nY = nY; this.W = new Float64Array(nY * (nZ + 1)); this.err = new Float64Array(nY); this.var = 1; this.surprise = 0; this.mse = 1; this.n = 0; this.lesion = false; }
  predict(z, out) { const n = this.nZ; for (let o = 0; o < this.nY; o++) { let s = this.W[o * (n + 1) + n]; for (let i = 0; i < n; i++) s += this.W[o * (n + 1) + i] * z[i]; out[o] = s; } return out; }
  learn(z, y, lr = 0.05) { if (this.lesion) { this.surprise = 0; return 0; } const n = this.nZ; const p = this.predict(z, new Float64Array(this.nY)); let zz = 1; for (let i = 0; i < n; i++) zz += z[i] * z[i]; let se = 0;
    for (let o = 0; o < this.nY; o++) { const e = y[o] - p[o]; this.err[o] = e; se += e * e; const g = (lr * e) / zz; for (let i = 0; i < n; i++) this.W[o * (n + 1) + i] += g * z[i]; this.W[o * (n + 1) + n] += g; }
    se /= this.nY; this.mse += 0.01 * (se - this.mse); this.var += 0.002 * (se - this.var); this.surprise = clamp(se / (this.var + 1e-6) / 4); this.n++; return se; }
}
export const STAGES = ['WAKE', 'N1', 'N2', 'N3', 'REM'];
export class Sleep {
  constructor() { this.S = 0.35; this.asleep = false; this.ultra = 0; this.stage = 0; this.orx = 0; this.forceWake = 0; this.cycles = 0; }
  /** per simulated minute. hour 0..24; eng = sensory engagement 0..1; ne = noradrenaline */
  tick(hour, eng, ne, melatonin, spikesNorm) {
    if (!this.asleep) this.S += 0.0009 * (1 + 0.5 * spikesNorm) * (1 - this.S); else this.S -= 0.0028 * this.S;
    const scnOut = Math.cos((2 * Math.PI * (hour - 14)) / 24); const C = 0.25 * scnOut; this.orx += 0.02 * (Math.min(1, eng) - this.orx);
    const drive = this.S - C + 0.15 * melatonin - 0.1 * Math.max(0, ne - 0.3); const thr = 0.62 + 0.5 * this.orx; const forced = this.forceWake > 0; if (this.forceWake > 0) this.forceWake--;
    if (!this.asleep && drive > thr && !forced) { this.asleep = true; this.ultra = 0; } else if (this.asleep && (drive < 0.2 || forced)) this.asleep = false;
    if (this.asleep) { this.ultra += 1 / 90; if (this.ultra >= 1) { this.ultra = 0; this.cycles++; } }
    // stage within the ~90-minute ultradian cycle (reference formula): N1 -> N2 -> N3 (while sleep pressure is high) -> REM
    if (!this.asleep) this.stage = 0; else { const u = this.ultra; this.stage = u < 0.1 ? 1 : u < 0.3 ? 2 : u < 0.75 - 0.25 * clamp(0.6 - this.S) ? (this.S > 0.35 ? 3 : 2) : 4; }
    this.drive = drive; return this.stage; }
}
/** Two-level predictive-coding hierarchy (Rao & Ballard 1999; Whittington & Bogacz 2017 learning rule).
 *  Level-1 causes r1 (16) predict the 25-dim body-sense vector y (proprioceptive curvature, vestibular, foot contacts, goal
 *  bearing) through W1; level-2 causes r2 (8) predict r1 through W2. Each 10 Hz tick runs K inference iterations that descend the
 *  precision-weighted prediction-error energy, then updates W1, W2 with local Hebbian error x activity products. Causes persist
 *  between ticks, so the previous state is the prior. Sensory precision is set by acetylcholine (as proposed for ACh). */
export class PredictiveCoding {
  constructor(seed, nY, n1 = 16, n2 = 8) { const r = mulberry(seed * 313 + 5); this.nY = nY; this.n1 = n1; this.n2 = n2; this.r1 = new Float64Array(n1); this.r2 = new Float64Array(n2);
    this.W1 = Float64Array.from({ length: nY * n1 }, () => (r() - 0.5) * 0.2); this.W2 = Float64Array.from({ length: n1 * n2 }, () => (r() - 0.5) * 0.2); this.e0 = new Float64Array(nY); this.e1 = new Float64Array(n1);
    this.err = 1; this.errSlow = 1; this.surprise = 0; this.lesionLearn = false; this.n = 0; }
  step(y, prec = 1, K = 12, eta = 0.12, lr = 0.01) { const { nY, n1, n2, W1, W2, r1, r2, e0, e1 } = this; const f1 = new Float64Array(n1), f2 = new Float64Array(n2);
    for (let k = 0; k < K; k++) { for (let i = 0; i < n1; i++) f1[i] = Math.tanh(r1[i]); for (let i = 0; i < n2; i++) f2[i] = Math.tanh(r2[i]);
      for (let o = 0; o < nY; o++) { let p = 0; for (let i = 0; i < n1; i++) p += W1[o * n1 + i] * f1[i]; e0[o] = prec * (y[o] - p); }
      for (let i = 0; i < n1; i++) { let p = 0; for (let j = 0; j < n2; j++) p += W2[i * n2 + j] * f2[j]; e1[i] = r1[i] - p; }
      for (let i = 0; i < n1; i++) { let g = 0; for (let o = 0; o < nY; o++) g += W1[o * n1 + i] * e0[o]; r1[i] += eta * (g * (1 - f1[i] * f1[i]) - e1[i]); }
      for (let j = 0; j < n2; j++) { let g = 0; for (let i = 0; i < n1; i++) g += W2[i * n2 + j] * e1[i]; r2[j] += eta * (g * (1 - f2[j] * f2[j]) - 0.05 * r2[j]); } }
    if (!this.lesionLearn) { for (let o = 0; o < nY; o++) for (let i = 0; i < n1; i++) W1[o * n1 + i] += lr * e0[o] * Math.tanh(r1[i]); for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) W2[i * n2 + j] += lr * e1[i] * Math.tanh(r2[j]); }
    let se = 0; for (let o = 0; o < nY; o++) se += (e0[o] / prec) ** 2; se /= nY; this.err = se; this.errSlow += 0.01 * (se - this.errSlow); this.surprise = clamp(se / (this.errSlow + 1e-6) / 3); this.n++; return se; }
}
