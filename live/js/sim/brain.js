// Spiking substrate. The 14 regions, their sizes (272 neurons) and the region-to-region connection probabilities are
// ported from the reference organism (core/organism.ts REGIONS/CP); this browser build adds PROP (32 proprioceptive
// neurons) and MN (122 motor neurons = 61 muscle channels x agonist/antagonist).
// Neuron model: leaky integrate-and-fire with spike-frequency adaptation and refractoriness, exponential synaptic currents.
// Motor neurons use a liquid (input-dependent) membrane time constant ("sLTC": spiking LTC - our reading of Alex's term).
// Plasticity: pair-based STDP writes into per-synapse eligibility traces; a third factor (dopamine relative to baseline,
// scaled by acetylcholine) turns eligibility into weight change while awake. In NREM sleep, STDP during replay consolidates
// directly and all plastic weights are slightly down-scaled (synaptic homeostasis). Astrocyte-like slow calcium per region
// integrates activity over seconds and scales that region's synaptic gain.
import { mulberry, clamp, gauss } from './util.js';
export const REGIONS = [['SENS', 16], ['THAL', 16], ['CTX', 64], ['HIP', 32], ['STR', 32], ['HYP', 16], ['VTA', 6], ['RAPHE', 6], ['LC', 6], ['BF', 6], ['INS', 8], ['SCN', 8], ['MOT', 8], ['ENS', 48], ['PROP', 32], ['MN', 122]];
export const R0 = {}, RN = {}; export let NNEU = 0; for (const [n, k] of REGIONS) { R0[n] = NNEU; RN[n] = k; NNEU += k; }
export const NREF = 272;
const CP = [['SENS', 'THAL', 0.25], ['THAL', 'CTX', 0.12], ['CTX', 'THAL', 0.06], ['CTX', 'CTX', 0.1], ['CTX', 'HIP', 0.06], ['HIP', 'CTX', 0.06], ['HIP', 'HIP', 0.05],
  ['CTX', 'STR', 0.08], ['STR', 'MOT', 0.15], ['CTX', 'MOT', 0.05], ['HYP', 'VTA', 0.2], ['HYP', 'LC', 0.15], ['HYP', 'HYP', 0.1], ['INS', 'LC', 0.25], ['INS', 'CTX', 0.06], ['INS', 'HYP', 0.15],
  ['VTA', 'STR', 0.1], ['LC', 'CTX', 0.08], ['RAPHE', 'CTX', 0.05], ['BF', 'CTX', 0.06], ['BF', 'HIP', 0.1], ['SCN', 'HYP', 0.25], ['SCN', 'RAPHE', 0.15], ['CTX', 'INS', 0.06], ['ENS', 'ENS', 0.12], ['ENS', 'HYP', 0.05],
  /* added in this build */ ['PROP', 'THAL', 0.12], ['PROP', 'CTX', 0.06], ['CTX', 'HIP', 0.0], ['THAL', 'STR', 0.05]];
export const INHIB = (i) => (i >= R0.CTX + 52 && i < R0.CTX + 64) || (i >= R0.STR && i < R0.STR + 32) || (i >= R0.ENS + 36 && i < R0.ENS + 48);
export const regionOf = (() => { const a = new Uint8Array(4096); REGIONS.forEach(([n], ri) => { for (let i = 0; i < RN[n]; i++) a[R0[n] + i] = ri; }); return (i) => a[i]; })();
const PLASTIC = new Set(['SENS>THAL', 'THAL>CTX', 'CTX>CTX', 'CTX>HIP', 'HIP>CTX', 'HIP>HIP', 'CTX>STR', 'STR>MOT', 'CTX>MOT', 'PROP>CTX', 'PROP>THAL', 'THAL>STR', 'INS>CTX']);
export class Brain {
  constructor(seed) {
    const r = (this.r = mulberry(seed * 13 + 3)); const N = NNEU; this.N = N; this.t = 0;
    this.v = new Float64Array(N); this.syn = new Float64Array(N); this.ad = new Float64Array(N); this.ref = new Float64Array(N); this.ext = new Float64Array(N);
    this.rate = new Float64Array(N); this.xpre = new Float64Array(N); this.xpost = new Float64Array(N); this.spk = new Uint8Array(N); this.lastSpike = new Float64Array(N).fill(-1);
    this.tauM = new Float64Array(N); for (let i = 0; i < N; i++) { this.tauM[i] = 0.012 + 0.008 * r(); this.v[i] = r() * 0.5; }
    // CSR synapses by presynaptic neuron
    const pre = [], post = [], w = [], pl = []; for (const [a, b, p] of CP) { if (p <= 0) continue; const plastic = PLASTIC.has(a + '>' + b);
      for (let i = 0; i < RN[a]; i++) for (let j = 0; j < RN[b]; j++) { const I = R0[a] + i, J = R0[b] + j; if (I === J || r() >= p) continue; pre.push(I); post.push(J); w.push(INHIB(I) ? -(0.5 + 0.4 * r()) : 0.25 + 0.35 * r()); pl.push(plastic && !INHIB(I) ? 1 : 0); } }
    const S = pre.length; this.S = S; const ord = [...Array(S).keys()].sort((x, y) => pre[x] - pre[y]);
    this.pre = Int32Array.from(ord.map((k) => pre[k])); this.post = Int32Array.from(ord.map((k) => post[k])); this.w = Float64Array.from(ord.map((k) => w[k])); this.w0 = Float64Array.from(this.w); this.plastic = Uint8Array.from(ord.map((k) => pl[k])); this.elig = new Float64Array(S);
    this.out0 = new Int32Array(N + 1); for (let s = 0; s < S; s++) this.out0[this.pre[s] + 1]++; for (let i = 0; i < N; i++) this.out0[i + 1] += this.out0[i];
    const inc = Array.from({ length: N }, () => []); for (let s = 0; s < S; s++) if (this.plastic[s]) inc[this.post[s]].push(s); this.inc = inc.map((a) => Int32Array.from(a));
    this.nm = { DA: 0.3, NE: 0.3, '5HT': 0.4, ACh: 0.4, cortisol: 0.3 }; this.astro = new Float64Array(REGIONS.length).fill(0.2); this.regRate = new Float64Array(REGIONS.length);
    this.lesion = { mot: false, stdp: false, astro: false }; this.spikes = 0; this.spikeLog = []; this.wNorm0 = this.plasticNorm(); this.stdpEvents = 0;
    this.noise = 0.15; this.sleepStage = 0; this.atonia = 0; this.jolt = new Float64Array(N);
  }
  plasticNorm() { let s = 0; for (let k = 0; k < this.S; k++) if (this.plastic[k]) s += this.w[k]; return s; }
  /** one integration step of dt seconds (typically 2 ms). ext[] must be filled by the caller. */
  step(dt) {
    const N = this.N, v = this.v, syn = this.syn, ad = this.ad, ext = this.ext, r = this.r, nm = this.nm; const ds = Math.exp(-dt / 0.005), dr = Math.exp(-dt / 0.15), dtr = Math.exp(-dt / 0.02), da = Math.exp(-dt / 0.3);
    const gainNE = 1 + 0.6 * (nm.NE - 0.3), noise = this.noise * (1 + nm.NE) * Math.sqrt(dt / 0.002); this.spikes = 0; const mn0 = R0.MN, mn1 = R0.MN + RN.MN, mot0 = R0.MOT, mot1 = R0.MOT + RN.MOT;
    for (let i = 0; i < N; i++) { let I = ext[i] + syn[i] * this.astroGain(i) + noise * gauss(r) + this.jolt[i]; this.jolt[i] *= 0.9;
      if (i >= mn0 && i < mn1) I -= this.atonia; if (this.lesion.mot && i >= mot0 && i < mot1) I = -5;
      I *= gainNE; let tau = this.tauM[i]; if (i >= mn0 && i < mn1) tau = 0.02 / (1 + 2 / (1 + Math.exp(-2 * (I - 1)))); // sLTC: liquid membrane time constant
      if (this.ref[i] > 0) { this.ref[i] -= dt; v[i] = 0; } else v[i] += (dt * (-v[i] + I - ad[i])) / tau;
      this.spk[i] = 0; if (v[i] > 1) { v[i] = 0; this.ref[i] = 0.002; this.spk[i] = 1; this.spikes++; ad[i] += INHIB(i) ? 0.02 : 0.12; this.rate[i] += 1 / 0.15; this.lastSpike[i] = this.t; }
      ad[i] *= da; syn[i] *= ds; this.rate[i] *= dr; this.xpre[i] *= dtr; this.xpost[i] *= dtr; }
    const stdpOn = !this.lesion.stdp; const Ap = 0.01, Am = 0.0105;
    for (let i = 0; i < N; i++) { if (!this.spk[i]) continue; const a = this.out0[i], b = this.out0[i + 1];
      for (let s = a; s < b; s++) { const j = this.post[s]; syn[j] += this.w[s]; if (stdpOn && this.plastic[s]) { this.elig[s] -= Am * this.xpost[j]; this.stdpEvents++; } }
      if (stdpOn) { const inc = this.inc[i]; for (let q = 0; q < inc.length; q++) { const s = inc[q]; this.elig[s] += Ap * this.xpre[this.pre[s]]; } }
      this.xpre[i] += 1; this.xpost[i] += 1; }
    this.t += dt;
  }
  astroGain(i) { return this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[regionOf(i)]; }
  /** slower housekeeping (call every ~20 ms): third-factor plasticity, sleep consolidation, astrocyte calcium, region rates */
  slow(dt, stage) {
    const nm = this.nm; const dDA = nm.DA - 0.3; const eDecay = Math.exp(-dt / 1.0); const awake = stage === 0, nrem = stage === 2 || stage === 3;
    const lr = (0.6 + nm.ACh) * 0.8; let dw = 0;
    for (let s = 0; s < this.S; s++) { if (!this.plastic[s]) continue; let e = this.elig[s]; if (!this.lesion.stdp) {
        let d = 0; if (awake) d = lr * dDA * e; else if (nrem) d = 0.15 * e - 0.0004 * dt * (this.w[s] - this.w0[s] * 0.5); // NREM: STDP of replayed sequences consolidates directly + downscaling
        this.w[s] = clamp(this.w[s] + d, 0, 1.6); dw += Math.abs(d); } this.elig[s] = e * eDecay; }
    this.dwLast = dw;
    for (let k = 0; k < REGIONS.length; k++) { const [n, cnt] = REGIONS[k]; let s = 0; for (let i = 0; i < cnt; i++) s += this.rate[R0[n] + i]; this.regRate[k] = s / cnt;
      this.astro[k] += (dt / 4) * (clamp(this.regRate[k] / 25) - this.astro[k]); } // astrocyte Ca2+: ~4 s integration of local activity
  }
  regionRate(name) { const k = REGIONS.findIndex((x) => x[0] === name); return this.regRate[k]; }
}
