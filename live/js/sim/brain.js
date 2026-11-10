// Spiking substrate. The 14 reference regions and their region-to-region connection probabilities are ported from the
// reference organism (core/organism.ts REGIONS/CP); this build adds PROP (32 proprioceptive neurons) and MN (122 motor neurons
// = 61 muscle channels x agonist/antagonist).
// Neuron model: leaky integrate-and-fire with spike-frequency adaptation and refractoriness, exponential synaptic currents.
// Motor neurons use a liquid (input-dependent) membrane time constant ("sLTC").
// Plasticity: pair-based STDP writes per-synapse eligibility traces; dopamine (relative to baseline, scaled by ACh) turns
// eligibility into weight change while awake; in NREM, replayed STDP consolidates directly and plastic weights are slowly
// down-scaled. Astrocyte-like slow calcium per region scales that region's synaptic gain.
// Pass 14 - scale and structure. Three sizes:
//   S  = the original 426-neuron network (random wiring within the reference probabilities)
//   M  = ~3,400 neurons: cortex is a 48x48 sheet, hippocampus 512, thalamus 128
//   L  = ~12,200 neurons: cortex 96x96, hippocampus 2048, thalamus 384
// In M/L the cortex, hippocampus and thalamus are 2D sheets of cells with types: excitatory (E, adapting), PV-like fast
// inhibitory (short time constant, no adaptation) and SST-like slow inhibitory (adapting). Cortex-to-cortex wiring is
// distance-dependent (Gaussian, on a torus) with 5% long-range shortcuts (a small-world graph); thalamus->cortex and
// proprioception->cortex are topographic (each input neuron targets a patch of the sheet; proprioception lands in a
// "somatosensory" strip), and cortex->MOT comes from a "motor" strip. Other region pairs keep the reference in-degree
// (expected number of inputs per neuron) so the overall drive stays comparable to S.
// Structural plasticity (M/L): once per simulated second, cortical E->E synapses that STDP has weakened below 25% of their
// initial weight are pruned and regrown onto the most active of three nearby candidate cells (activity-dependent
// synaptogenesis), so the wiring itself is shaped by experience.
// Updates are event-driven where it matters: spikes propagate through a CSR (compressed sparse row) synapse table, and
// eligibility/weight updates touch only synapses with a live eligibility trace. Everything is typed arrays on the main
// thread (no Web Worker / WebGPU in this build).
import { mulberry, clamp, gauss } from './util.js';
const AUTO_SCALE = false; // pass 12 ships the small brain by default; larger ones via ?brain=M|L
const SCALE = (() => { const q = globalThis.TW?.brain ?? globalThis.BRAIN_SCALE ?? (globalThis.location ? new URLSearchParams(globalThis.location.search).get('brain') : null);
  if (q === 'S' || q === 'M' || q === 'L') return q; if (!AUTO_SCALE) return 'S'; if (globalThis.process?.versions?.node) return 'M';
  const nav = globalThis.navigator || {}; const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches; return !coarse && (nav.hardwareConcurrency || 4) >= 8 ? 'L' : 'M'; })();
export const BRAIN_SCALE = SCALE;
const SZ = { S: { CTX: 64, HIP: 32, THAL: 16, side: 8 }, M: { CTX: 2304, HIP: 512, THAL: 128, side: 48 }, L: { CTX: 9216, HIP: 2048, THAL: 384, side: 96 } }[SCALE];
export const REGIONS = [['SENS', 16], ['THAL', SZ.THAL], ['CTX', SZ.CTX], ['HIP', SZ.HIP], ['STR', 32], ['HYP', 16], ['VTA', 6], ['RAPHE', 6], ['LC', 6], ['BF', 6], ['INS', 8], ['SCN', 8], ['MOT', 8], ['ENS', 48], ['PROP', 32], ['MN', 122]];
export const R0 = {}, RN = {}; export let NNEU = 0; for (const [n, k] of REGIONS) { R0[n] = NNEU; RN[n] = k; NNEU += k; }
export const NREF = 272;
const OLDN = { SENS: 16, THAL: 16, CTX: 64, HIP: 32, STR: 32, HYP: 16, VTA: 6, RAPHE: 6, LC: 6, BF: 6, INS: 8, SCN: 8, MOT: 8, ENS: 48, PROP: 32, MN: 122 };
const CP = [['SENS', 'THAL', 0.25], ['THAL', 'CTX', 0.12], ['CTX', 'THAL', 0.06], ['CTX', 'CTX', 0.1], ['CTX', 'HIP', 0.06], ['HIP', 'CTX', 0.06], ['HIP', 'HIP', 0.05],
  ['CTX', 'STR', 0.08], ['STR', 'MOT', 0.15], ['CTX', 'MOT', 0.05], ['HYP', 'VTA', 0.2], ['HYP', 'LC', 0.15], ['HYP', 'HYP', 0.1], ['INS', 'LC', 0.25], ['INS', 'CTX', 0.06], ['INS', 'HYP', 0.15],
  ['VTA', 'STR', 0.1], ['LC', 'CTX', 0.08], ['RAPHE', 'CTX', 0.05], ['BF', 'CTX', 0.06], ['BF', 'HIP', 0.1], ['SCN', 'HYP', 0.25], ['SCN', 'RAPHE', 0.15], ['CTX', 'INS', 0.06], ['ENS', 'ENS', 0.12], ['ENS', 'HYP', 0.05],
  ['PROP', 'THAL', 0.12], ['PROP', 'CTX', 0.06], ['CTX', 'HIP', 0.0], ['THAL', 'STR', 0.05]];
const PLASTIC = new Set(['SENS>THAL', 'THAL>CTX', 'CTX>CTX', 'CTX>HIP', 'HIP>CTX', 'HIP>HIP', 'CTX>STR', 'STR>MOT', 'CTX>MOT', 'PROP>CTX', 'PROP>THAL', 'THAL>STR', 'INS>CTX']);
// cell types: 0 = E, 1 = PV-like fast inhibitory, 2 = SST-like slow inhibitory, 3 = other inhibitory (STR, ENS)
export const TYPE = new Uint8Array(NNEU); export const POSX = new Float32Array(NNEU), POSY = new Float32Array(NNEU);
const REG = new Uint8Array(NNEU); REGIONS.forEach(([n], ri) => { for (let i = 0; i < RN[n]; i++) REG[R0[n] + i] = ri; });
{ const r = mulberry(4242); for (const n of ['CTX', 'HIP', 'THAL']) { const N = RN[n], side = Math.ceil(Math.sqrt(N)); for (let i = 0; i < N; i++) { const g = R0[n] + i; POSX[g] = ((i % side) + 0.5) / side; POSY[g] = (Math.floor(i / side) + 0.5) / side;
      if (SCALE === 'S') TYPE[g] = n === 'CTX' && i >= 52 ? 1 : 0; else if (n !== 'THAL') { const u = r(); TYPE[g] = u < (n === 'CTX' ? 0.8 : 0.85) ? 0 : n === 'HIP' || u < 0.9 ? 1 : 2; } } }
  for (let i = 0; i < 32; i++) TYPE[R0.STR + i] = 3; for (let i = 36; i < 48; i++) TYPE[R0.ENS + i] = 3;
  for (let i = 0; i < RN.SENS; i++) { POSX[R0.SENS + i] = (i + 0.5) / RN.SENS; } for (let i = 0; i < RN.PROP; i++) { POSX[R0.PROP + i] = (i + 0.5) / RN.PROP; } }
export const INHIB = (i) => TYPE[i] !== 0;
export const regionOf = (i) => REG[i];
export class Brain {
  constructor(seed) {
    const r = (this.r = mulberry(seed * 13 + 3)); const N = NNEU; this.N = N; this.t = 0; this.scale = SCALE;
    this.v = new Float64Array(N); this.syn = new Float64Array(N); this.ad = new Float64Array(N); this.ref = new Float64Array(N); this.ext = new Float64Array(N);
    this.rate = new Float64Array(N); this.xpre = new Float64Array(N); this.xpost = new Float64Array(N); this.spk = new Uint8Array(N); this.lastSpike = new Float64Array(N).fill(-1);
    this.tauM = new Float64Array(N); this.adInc = new Float64Array(N); for (let i = 0; i < N; i++) { const T = TYPE[i]; this.tauM[i] = T === 1 && SCALE !== 'S' ? 0.006 + 0.003 * r() : T === 2 ? 0.02 + 0.008 * r() : 0.012 + 0.008 * r(); this.adInc[i] = T === 0 ? 0.12 : T === 2 ? 0.08 : 0.02; this.v[i] = r() * 0.5; }
    const pre = [], post = [], w = [], pl = [], sc = [], st = []; const add = (I, J, wt, plastic, scale = 1, struct = 0) => { pre.push(I); post.push(J); w.push(wt); pl.push(plastic && !INHIB(I) ? 1 : 0); sc.push(scale); st.push(struct); };
    const wE = () => 0.25 + 0.35 * r(), wI = () => -(0.5 + 0.4 * r());
    if (SCALE === 'S') { for (const [a, b, p] of CP) { if (p <= 0) continue; const plastic = PLASTIC.has(a + '>' + b); for (let i = 0; i < RN[a]; i++) for (let j = 0; j < RN[b]; j++) { const I = R0[a] + i, J = R0[b] + j; if (I === J || r() >= p) continue; add(I, J, INHIB(I) ? wI() : wE(), plastic); } } }
    else { const poisson = (lam) => { let L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
      const near = (x, y, sig, reg) => { const side = Math.ceil(Math.sqrt(RN[reg])); let nx = x + sig * gauss(r), ny = y + sig * gauss(r); nx -= Math.floor(nx); ny -= Math.floor(ny); return R0[reg] + Math.min(RN[reg] - 1, Math.floor(ny * side) * side + Math.floor(nx * side)); };
      this.near = near; const Kc = 40, kRef = 0.1 * 64, s = kRef / Kc;
      for (const [a, b, p] of CP) { if (p <= 0) continue; const plastic = PLASTIC.has(a + '>' + b); const kin = p * OLDN[a]; // expected inputs per post neuron in the reference network
        if (a === 'CTX' && b === 'CTX') { for (let i = 0; i < RN.CTX; i++) { const I = R0.CTX + i, inh = INHIB(I); for (let k = 0; k < Kc; k++) { const J = r() < 0.05 && !inh ? R0.CTX + Math.floor(r() * RN.CTX) : near(POSX[I], POSY[I], inh ? 0.03 : 0.05, 'CTX'); if (J === I) continue; add(I, J, (inh ? wI() : wE()) * s, plastic, s, inh ? 0 : 1); } } continue; }
        if (a === 'HIP' && b === 'HIP') { const K = 20, s2 = kin / K; for (let i = 0; i < RN.HIP; i++) { const I = R0.HIP + i, inh = INHIB(I); for (let k = 0; k < K; k++) { const J = R0.HIP + Math.floor(r() * RN.HIP); if (J === I) continue; add(I, J, (inh ? wI() : wE()) * s2, plastic, s2); } } continue; }
        if ((a === 'THAL' || a === 'PROP') && b === 'CTX') { // topographic: each input neuron targets a patch of the sheet (PROP: the x < 0.3 strip)
          const per = Math.max(1, Math.round((kin * RN.CTX) / RN[a])); for (let i = 0; i < RN[a]; i++) { const I = R0[a] + i; const cx = a === 'PROP' ? 0.15 : POSX[I], cy = a === 'PROP' ? POSX[I] : POSY[I]; for (let k = 0; k < per; k++) add(I, near(cx, cy, a === 'PROP' ? 0.06 : 0.07, 'CTX'), wE(), plastic); } continue; }
        if (a === 'SENS' && b === 'THAL') { const per = Math.max(1, Math.round((kin * RN.THAL) / RN.SENS)); for (let i = 0; i < RN.SENS; i++) { const I = R0.SENS + i; for (let k = 0; k < per; k++) add(I, near(POSX[I], 0.5 + 0.3 * gauss(r), 0.06, 'THAL'), wE(), plastic); } continue; }
        for (let j = 0; j < RN[b]; j++) { const J = R0[b] + j; let n = poisson(kin); if (a === 'CTX' && b === 'MOT') { for (let k = 0; k < n; k++) { const I = near(0.85, (j + 0.5) / 8, 0.05, 'CTX'); add(I, J, INHIB(I) ? wI() : wE(), plastic); } continue; } // motor strip
          for (let k = 0; k < n; k++) { const I = R0[a] + Math.floor(r() * RN[a]); if (I === J) continue; add(I, J, INHIB(I) ? wI() : wE(), plastic); } } } }
    const S = pre.length; this.S = S; const ord = Array.from({ length: S }, (_, k) => k).sort((x, y) => pre[x] - pre[y]);
    this.pre = Int32Array.from(ord, (k) => pre[k]); this.post = Int32Array.from(ord, (k) => post[k]); this.w = Float64Array.from(ord, (k) => w[k]); this.w0 = Float64Array.from(this.w); this.plastic = Uint8Array.from(ord, (k) => pl[k]); this.wsc = Float32Array.from(ord, (k) => sc[k]); this.struct = Uint8Array.from(ord, (k) => st[k]); this.elig = new Float64Array(S);
    this.out0 = new Int32Array(N + 1); for (let s = 0; s < S; s++) this.out0[this.pre[s] + 1]++; for (let i = 0; i < N; i++) this.out0[i + 1] += this.out0[i];
    this.buildInc(); this.act = new Uint8Array(S); this.actList = new Int32Array(S); this.nAct = 0;
    this.nm = { DA: 0.3, NE: 0.3, '5HT': 0.4, ACh: 0.4, cortisol: 0.3 }; this.astro = new Float64Array(REGIONS.length).fill(0.2); this.regRate = new Float64Array(REGIONS.length); this.regGain = new Float64Array(REGIONS.length).fill(1);
    this.lesion = { mot: false, stdp: false, astro: false, struct: false }; this.spikes = 0; this.stdpEvents = 0; this.pruned = 0; this.grown = 0; this.slowT = 0;
    this.noise = 0.15; this.sleepStage = 0; this.atonia = 0; this.jolt = new Float64Array(N);
  }
  buildInc() { const N = this.N, cnt = new Int32Array(N + 1); for (let s = 0; s < this.S; s++) if (this.plastic[s]) cnt[this.post[s] + 1]++; for (let i = 0; i < N; i++) cnt[i + 1] += cnt[i]; const idx = new Int32Array(cnt[N]), fill = cnt.slice(0, N); for (let s = 0; s < this.S; s++) if (this.plastic[s]) idx[fill[this.post[s]]++] = s; this.inc0 = cnt; this.incIdx = idx; }
  touch(s) { if (!this.act[s]) { this.act[s] = 1; this.actList[this.nAct++] = s; } }
  /** one integration step of dt seconds (typically 2 ms). ext[] must be filled by the caller. */
  step(dt) {
    const N = this.N, v = this.v, syn = this.syn, ad = this.ad, ext = this.ext, r = this.r, nm = this.nm; const ds = Math.exp(-dt / 0.005), dr = Math.exp(-dt / 0.15), dtr = Math.exp(-dt / 0.02), da = Math.exp(-dt / 0.3);
    const gainNE = 1 + 0.6 * (nm.NE - 0.3), noise = this.noise * (1 + nm.NE) * Math.sqrt(dt / 0.002); this.spikes = 0; const mn0 = R0.MN, mn1 = R0.MN + RN.MN, mot0 = R0.MOT, mot1 = R0.MOT + RN.MOT;
    const G = this.regGain; for (let k = 0; k < REGIONS.length; k++) G[k] = this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[k]; const exact = SCALE === 'S';
    for (let i = 0; i < N; i++) { const nz = exact ? gauss(r) : (r() + r() + r() - 1.5) * 2; let I = ext[i] + syn[i] * G[REG[i]] + noise * nz + this.jolt[i]; this.jolt[i] *= 0.9;
      if (i >= mn0 && i < mn1) I -= this.atonia; if (this.lesion.mot && i >= mot0 && i < mot1) I = -5;
      I *= gainNE; let tau = this.tauM[i]; if (i >= mn0 && i < mn1) tau = 0.02 / (1 + 2 / (1 + Math.exp(-2 * (I - 1))));
      if (this.ref[i] > 0) { this.ref[i] -= dt; v[i] = 0; } else v[i] += (dt * (-v[i] + I - ad[i])) / tau;
      this.spk[i] = 0; if (v[i] > 1) { v[i] = 0; this.ref[i] = 0.002; this.spk[i] = 1; this.spikes++; ad[i] += this.adInc[i]; this.rate[i] += 1 / 0.15; this.lastSpike[i] = this.t; }
      ad[i] *= da; syn[i] *= ds; this.rate[i] *= dr; this.xpre[i] *= dtr; this.xpost[i] *= dtr; }
    const stdpOn = !this.lesion.stdp; const Ap = 0.01, Am = 0.0105, post = this.post, W = this.w, pl = this.plastic, inc0 = this.inc0, incIdx = this.incIdx, preA = this.pre;
    for (let i = 0; i < N; i++) { if (!this.spk[i]) continue; const a = this.out0[i], b = this.out0[i + 1];
      for (let s = a; s < b; s++) { const j = post[s]; syn[j] += W[s]; if (stdpOn && pl[s]) { this.elig[s] -= Am * this.xpost[j]; this.touch(s); this.stdpEvents++; } }
      if (stdpOn) for (let q = inc0[i]; q < inc0[i + 1]; q++) { const s = incIdx[q]; this.elig[s] += Ap * this.xpre[preA[s]]; this.touch(s); }
      this.xpre[i] += 1; this.xpost[i] += 1; }
    this.t += dt;
  }
  astroGain(i) { return this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[REG[i]]; }
  /** slower housekeeping (call every ~20 ms): third-factor plasticity (only synapses with a live trace), sleep downscaling, structural plasticity, astrocytes */
  slow(dt, stage) {
    const nm = this.nm; const dDA = nm.DA - 0.3; const eDecay = Math.exp(-dt / 1.0); const awake = stage === 0, nrem = stage === 2 || stage === 3; const lr = (0.6 + nm.ACh) * 0.8; let dw = 0;
    const L = this.actList; for (let q = 0; q < this.nAct; q++) { const s = L[q]; const e = this.elig[s]; if (!this.lesion.stdp) { let d = 0; if (awake) d = lr * dDA * e; else if (nrem) d = 0.15 * e; d *= this.wsc[s]; this.w[s] = clamp(this.w[s] + d, 0, 1.6 * this.wsc[s]); dw += Math.abs(d); }
      const e2 = e * eDecay; if (Math.abs(e2) < 1e-6) { this.elig[s] = 0; this.act[s] = 0; L[q] = L[--this.nAct]; q--; } else this.elig[s] = e2; }
    this.dwLast = dw; this.slowT += dt;
    if (this.slowT >= 1) { const T = this.slowT; this.slowT = 0;
      if (nrem && !this.lesion.stdp) for (let s = 0; s < this.S; s++) if (this.plastic[s]) this.w[s] = clamp(this.w[s] - 0.0004 * T * (this.w[s] - this.w0[s] * 0.5), 0, 1.6 * this.wsc[s]); // NREM synaptic downscaling
      if (SCALE !== 'S' && !this.lesion.struct && !this.lesion.stdp) this.rewire(); }
    for (let k = 0; k < REGIONS.length; k++) { const [n, cnt] = REGIONS[k]; let s = 0; for (let i = 0; i < cnt; i++) s += this.rate[R0[n] + i]; this.regRate[k] = s / cnt; this.astro[k] += (dt / 4) * (clamp(this.regRate[k] / 25) - this.astro[k]); }
  }
  /** structural plasticity: prune weak cortical E->E synapses and regrow them onto the most active of 3 nearby cells */
  rewire() { const r = this.r; let changed = 0; for (let s = 0; s < this.S; s++) { if (!this.struct[s] || this.w[s] > 0.25 * this.w0[s] || r() > 0.5) continue; const I = this.pre[s]; let best = -1, br = -1;
      for (let c = 0; c < 3; c++) { const J = this.near(POSX[I], POSY[I], 0.05, 'CTX'); if (J === I) continue; if (this.rate[J] > br) { br = this.rate[J]; best = J; } } if (best < 0) continue;
      this.post[s] = best; this.w0[s] = (0.25 + 0.35 * r()) * this.wsc[s]; this.w[s] = 0.5 * this.w0[s]; this.elig[s] = 0; this.pruned++; this.grown++; changed++; }
    if (changed) this.buildInc(); this.lastRewired = changed; }
  /** mean rate product over cortical E->E synapses relative to random E pairs (> 1 = wiring aligned with co-activity) */
  alignment() { let a = 0, n = 0; for (let s = 0; s < this.S; s++) if (this.struct[s]) { a += this.rate[this.pre[s]] * this.rate[this.post[s]]; n++; } let m = 0, k = 0; for (let i = 0; i < RN.CTX; i++) if (!TYPE[R0.CTX + i]) { m += this.rate[R0.CTX + i]; k++; } m /= k || 1; return n && m > 0 ? a / n / (m * m) : 0; }
  regionRate(name) { const k = REGIONS.findIndex((x) => x[0] === name); return this.regRate[k]; }
}
