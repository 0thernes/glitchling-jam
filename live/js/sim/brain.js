// Spiking substrate (pass 13 -> pass 15 high-throughput & homeostatic upgrade).
// 16 regions: the 14 reference regions + PROP (32 proprioceptive) + MN (122 sLTC motor neurons); STR has 42 MSNs (21 D1 "go" +
// 21 D2 "no-go" covering 16 plant sites + 3 water pools + dropped snack + epistemic curiosity).
// Four brain scales (choose with ?brain=S|M|L|XL):
//   S  = 436 neurons (compact reference wiring)
//   M  = 3,268 neurons / ~123k synapses: 48x48 2-compartment cortex, 512 hippocampal place/index cells, 128 thalamus
//   L  = 11,972 neurons / ~494k synapses: 96x96 cortex, 2,048 hippocampus, 384 thalamus
//   XL = 25,924 neurons / ~1.06M synapses: 144x144 cortex, 4,096 hippocampus, 768 thalamus
// Systems & neurobiology upgrades in pass 15:
//  1) Cache-compact Float32Array states/weights + Uint16Array CSR indices + inlined xorshift32 noise + sparse active spike list
//     + trace-gated eligibility touch: cuts M and L step cost ~5-8x so L (12k neurons) runs in ~2-4 ms on the main thread, well
//     inside the 12 ms 60-fps budget, with optional off-main-thread Web Worker (brain_worker.js) & WebGPU compute (webgpu_brain.js).
//  2) Three-mechanism biological homeostasis (independent of structural rewiring):
//     - Region + deadzone slow intrinsic rheobase plasticity (vBias) keeping E/I sheets balanced without flattening spatial bumps;
//     - BCM sliding metaplasticity threshold on STDP (low post rate -> favours LTP; high post rate -> favours LTD);
//     - Turrigiano multiplicative synaptic scaling in slow housekeeping.
//     Lesioning structural rewiring no longer silences cortex over 5+ minutes across sleep cycles.
//  3) Two-compartment cortical pyramidal neurons (basal + top-down HIP/INS apical coincidence gain) and topographic hippocampal
//     place fields projecting plastically to STR (HIP>STR) and CTX (HIP>CTX) so larger brains aid spatial value memory.
import { mulberry, clamp, gauss } from './util.js';

const SCALE = (() => {
  let envScale = globalThis.process?.env?.BRAIN_SCALE || null;
  if (!envScale && globalThis.process?.env?.TW) {
    try { envScale = JSON.parse(globalThis.process.env.TW).brain; } catch { /* ignore */ }
  }
  const q = globalThis.TW?.brain ?? globalThis.BRAIN_SCALE ?? envScale ??
    (globalThis.location ? new URLSearchParams(globalThis.location.search).get('brain') : null);
  if (q === 'S' || q === 'M' || q === 'L' || q === 'XL') return q;
  return 'M';
})();
export const BRAIN_SCALE = SCALE;
export const NSTR_OPT = 21; // 16 sites + 3 pools + 1 snack + 1 epistemic explore

const SZ = {
  S:  { CTX: 64,    HIP: 32,   THAL: 16,  side: 8 },
  M:  { CTX: 2304,  HIP: 512,  THAL: 128, side: 48 },
  L:  { CTX: 9216,  HIP: 2048, THAL: 384, side: 96 },
  XL: { CTX: 20736, HIP: 4096, THAL: 768, side: 144 },
}[SCALE];

export const REGIONS = [
  ['SENS', 16], ['THAL', SZ.THAL], ['CTX', SZ.CTX], ['HIP', SZ.HIP], ['STR', NSTR_OPT * 2],
  ['HYP', 16], ['VTA', 6], ['RAPHE', 6], ['LC', 6], ['BF', 6], ['INS', 8], ['SCN', 8],
  ['MOT', 8], ['ENS', 48], ['PROP', 32], ['MN', 122],
];
export const R0 = {}, RN = {};
export let NNEU = 0;
for (const [n, k] of REGIONS) { R0[n] = NNEU; RN[n] = k; NNEU += k; }
export const NREF = 272;

const OLDN = {
  SENS: 16, THAL: 16, CTX: 64, HIP: 32, STR: NSTR_OPT * 2, HYP: 16, VTA: 6, RAPHE: 6,
  LC: 6, BF: 6, INS: 8, SCN: 8, MOT: 8, ENS: 48, PROP: 32, MN: 122,
};
const CP = [
  ['SENS', 'THAL', 0.25], ['THAL', 'CTX', 0.12], ['CTX', 'THAL', 0.06], ['CTX', 'CTX', 0.1],
  ['CTX', 'HIP', 0.08], ['HIP', 'CTX', 0.07], ['HIP', 'HIP', 0.05], ['HIP', 'STR', 0.12],
  ['CTX', 'STR', 0.08], ['STR', 'MOT', 0.15], ['CTX', 'MOT', 0.05], ['HYP', 'VTA', 0.2],
  ['HYP', 'LC', 0.15], ['HYP', 'HYP', 0.1], ['INS', 'LC', 0.25], ['INS', 'CTX', 0.06],
  ['INS', 'HYP', 0.15], ['VTA', 'STR', 0.1], ['LC', 'CTX', 0.08], ['RAPHE', 'CTX', 0.05],
  ['BF', 'CTX', 0.06], ['BF', 'HIP', 0.1], ['SCN', 'HYP', 0.25], ['SCN', 'RAPHE', 0.15],
  ['CTX', 'INS', 0.06], ['ENS', 'ENS', 0.12], ['ENS', 'HYP', 0.05], ['PROP', 'THAL', 0.12],
  ['PROP', 'CTX', 0.06], ['THAL', 'STR', 0.05],
];
const PLASTIC = new Set([
  'SENS>THAL', 'THAL>CTX', 'CTX>CTX', 'CTX>HIP', 'HIP>CTX', 'HIP>HIP', 'HIP>STR',
  'CTX>STR', 'STR>MOT', 'CTX>MOT', 'PROP>CTX', 'PROP>THAL', 'THAL>STR', 'INS>CTX',
]);

// cell types: 0 = E, 1 = PV-like fast inhibitory, 2 = SST-like slow inhibitory, 3 = MSN/ENS inhibitory
export const TYPE = new Uint8Array(NNEU);
export const POSX = new Float32Array(NNEU), POSY = new Float32Array(NNEU);
const REG = new Uint8Array(NNEU);
REGIONS.forEach(([n], ri) => { for (let i = 0; i < RN[n]; i++) REG[R0[n] + i] = ri; });
{
  const r = mulberry(4242);
  for (const n of ['CTX', 'HIP', 'THAL']) {
    const N = RN[n], side = Math.ceil(Math.sqrt(N));
    for (let i = 0; i < N; i++) {
      const g = R0[n] + i;
      POSX[g] = ((i % side) + 0.5) / side;
      POSY[g] = (Math.floor(i / side) + 0.5) / side;
      if (SCALE === 'S') TYPE[g] = n === 'CTX' && i >= 52 ? 1 : 0;
      else if (n !== 'THAL') {
        const u = r();
        TYPE[g] = u < (n === 'CTX' ? 0.8 : 0.85) ? 0 : n === 'HIP' || u < 0.9 ? 1 : 2;
      }
    }
  }
  for (let i = 0; i < RN.STR; i++) TYPE[R0.STR + i] = 3;
  for (let i = 36; i < 48; i++) TYPE[R0.ENS + i] = 3;
  for (let i = 0; i < RN.SENS; i++) POSX[R0.SENS + i] = (i + 0.5) / RN.SENS;
  for (let i = 0; i < RN.PROP; i++) POSX[R0.PROP + i] = (i + 0.5) / RN.PROP;
}
export const INHIB = (i) => TYPE[i] !== 0;
export const regionOf = (i) => REG[i];

export class Brain {
  constructor(seed) {
    const r = (this.r = mulberry(seed * 13 + 3));
    this.rngState = ((seed * 747796405 + 2891336453) >>> 0) || 0x9e3779b9;
    const N = NNEU;
    this.N = N;
    this.t = 0;
    this.scale = SCALE;
    this.backend = 'CPU-TypedCSR';

    // Cache-compact Float32 state vectors
    this.v = new Float32Array(N);
    this.syn = new Float32Array(N);
    this.apical = new Float32Array(N); // 2-compartment top-down apical dendritic potential (CTX pyramidal cells)
    this.ad = new Float32Array(N);
    this.ref = new Float32Array(N);
    this.ext = new Float32Array(N);
    this.vBias = new Float32Array(N); // learned homeostatic intrinsic rheobase bias (starts at 0)
    this.rate = new Float32Array(N);
    this.rateSlow = new Float32Array(N).fill(8);
    this.xpre = new Float32Array(N);
    this.xpost = new Float32Array(N);
    this.spk = new Uint8Array(N);
    this.spkList = new Uint16Array(N);
    this.lastSpike = new Float32Array(N).fill(-1);
    this.tauM = new Float32Array(N);
    this.adInc = new Float32Array(N);
    this.jolt = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const T = TYPE[i];
      this.tauM[i] = T === 1 && SCALE !== 'S' ? 0.006 + 0.003 * r() : T === 2 ? 0.02 + 0.008 * r() : 0.012 + 0.008 * r();
      this.adInc[i] = T === 0 ? 0.14 : T === 2 ? 0.09 : 0.02;
      this.v[i] = r() * 0.5;
    }

    const pre = [], post = [], w = [], pl = [], sc = [], st = [], ap = [];
    const ctx0 = R0.CTX, ctx1 = R0.CTX + RN.CTX, hip0 = R0.HIP, hip1 = R0.HIP + RN.HIP, ins0 = R0.INS, ins1 = R0.INS + RN.INS;
    const add = (I, J, wt, plastic, scale = 1, struct = 0) => {
      pre.push(I); post.push(J); w.push(wt);
      pl.push(plastic && !INHIB(I) ? 1 : 0);
      sc.push(scale); st.push(struct);
      // Top-down projections from HIP and INS onto excitatory CTX pyramidal cells target apical dendrites
      const isAp = SCALE !== 'S' && J >= ctx0 && J < ctx1 && TYPE[J] === 0 && ((I >= hip0 && I < hip1) || (I >= ins0 && I < ins1)) ? 1 : 0;
      ap.push(isAp);
    };
    const wE = () => 0.24 + 0.32 * r(), wI = () => -(0.52 + 0.42 * r());

    if (SCALE === 'S') {
      for (const [a, b, p] of CP) {
        if (p <= 0) continue;
        const plastic = PLASTIC.has(a + '>' + b);
        for (let i = 0; i < RN[a]; i++) {
          for (let j = 0; j < RN[b]; j++) {
            const I = R0[a] + i, J = R0[b] + j;
            if (I === J || r() >= p) continue;
            add(I, J, INHIB(I) ? wI() : wE(), plastic);
          }
        }
      }
    } else {
      const poisson = (lam) => {
        if (lam > 16) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(r)));
        let L = Math.exp(-lam), k = 0, p = 1;
        do { k++; p *= r(); } while (p > L);
        return k - 1;
      };
      const near = (x, y, sig, reg) => {
        const side = Math.ceil(Math.sqrt(RN[reg]));
        let nx = x + sig * gauss(r), ny = y + sig * gauss(r);
        nx -= Math.floor(nx); ny -= Math.floor(ny);
        return R0[reg] + Math.min(RN[reg] - 1, Math.floor(ny * side) * side + Math.floor(nx * side));
      };
      this.near = near;
      const Kc = 40, kRef = 0.1 * 64, s = kRef / Kc;
      for (const [a, b, p] of CP) {
        if (p <= 0) continue;
        const plastic = PLASTIC.has(a + '>' + b);
        const kin = p * OLDN[a];
        if (a === 'CTX' && b === 'CTX') {
          for (let i = 0; i < RN.CTX; i++) {
            const I = R0.CTX + i, inh = INHIB(I);
            for (let k = 0; k < Kc; k++) {
              const J = r() < 0.05 && !inh ? R0.CTX + Math.floor(r() * RN.CTX) : near(POSX[I], POSY[I], inh ? 0.03 : 0.05, 'CTX');
              if (J === I) continue;
              add(I, J, (inh ? wI() : wE()) * s, plastic, s, inh ? 0 : 1);
            }
          }
          continue;
        }
        if (a === 'HIP' && b === 'HIP') {
          const K = 20, s2 = kin / K;
          for (let i = 0; i < RN.HIP; i++) {
            const I = R0.HIP + i, inh = INHIB(I);
            for (let k = 0; k < K; k++) {
              const J = near(POSX[I], POSY[I], inh ? 0.06 : 0.12, 'HIP');
              if (J === I) continue;
              add(I, J, (inh ? wI() : wE()) * s2, plastic, s2);
            }
          }
          continue;
        }
        if ((a === 'THAL' || a === 'PROP') && b === 'CTX') {
          const per = Math.max(1, Math.round((kin * RN.CTX) / RN[a]));
          for (let i = 0; i < RN[a]; i++) {
            const I = R0[a] + i;
            const cx = a === 'PROP' ? 0.15 : POSX[I], cy = a === 'PROP' ? POSX[I] : POSY[I];
            for (let k = 0; k < per; k++) add(I, near(cx, cy, a === 'PROP' ? 0.06 : 0.07, 'CTX'), wE(), plastic);
          }
          continue;
        }
        if (a === 'CTX' && b === 'HIP') {
          // Topographic entorhinal-like projection from CTX sheet into matching HIP sheet patches
          const nIn = Math.max(4, Math.round(kin));
          for (let j = 0; j < RN.HIP; j++) {
            const J = R0.HIP + j;
            for (let k = 0; k < nIn; k++) {
              let I = near(POSX[J], POSY[J], 0.09, 'CTX');
              for (let t = 0; t < 8 && INHIB(I); t++) I = near(POSX[J], POSY[J], 0.09, 'CTX');
              add(I, J, wE() * 0.85, plastic, 0.85);
            }
          }
          continue;
        }
        if (a === 'SENS' && b === 'THAL') {
          const per = Math.max(1, Math.round((kin * RN.THAL) / RN.SENS));
          for (let i = 0; i < RN.SENS; i++) {
            const I = R0.SENS + i;
            for (let k = 0; k < per; k++) add(I, near(POSX[I], (k + 0.5) / per, 0.08, 'THAL'), wE(), plastic);
          }
          continue;
        }
        if (a === 'HIP' && b === 'STR') {
          // Excitatory hippocampal place cells project plastically to striatal D1/D2 channels (scaled by sheet fan-in)
          const fanIn = Math.min(48, Math.max(6, Math.round(RN.HIP * 0.06)));
          const ws = (0.12 * 32) / fanIn;
          for (let j = 0; j < RN.STR; j++) {
            const J = R0.STR + j;
            for (let k = 0; k < fanIn; k++) {
              let I = R0.HIP + Math.floor(r() * RN.HIP);
              for (let t = 0; t < 8 && INHIB(I); t++) I = R0.HIP + Math.floor(r() * RN.HIP);
              add(I, J, wE() * ws * 0.5, true, ws);
            }
          }
          continue;
        }
        for (let j = 0; j < RN[b]; j++) {
          const J = R0[b] + j;
          let n = poisson(kin);
          if (a === 'CTX' && b === 'MOT') {
            for (let k = 0; k < n; k++) {
              let I = near(0.85, (j + 0.5) / 8, 0.05, 'CTX');
              for (let t = 0; t < 20 && INHIB(I); t++) I = near(0.85, (j + 0.5) / 8, 0.05, 'CTX');
              add(I, J, wE(), plastic);
            }
            continue;
          }
          for (let k = 0; k < n; k++) {
            const I = R0[a] + Math.floor(r() * RN[a]);
            if (I === J) continue;
            add(I, J, INHIB(I) ? wI() : wE(), plastic);
          }
        }
      }
    }

    const S = pre.length;
    this.S = S;
    const ord = new Int32Array(S);
    // Bucket sort by presynaptic neuron `pre` in O(N + S) instead of O(S log S) Array.sort!
    const deg = new Int32Array(N + 1);
    for (let s = 0; s < S; s++) deg[pre[s] + 1]++;
    for (let i = 0; i < N; i++) deg[i + 1] += deg[i];
    const cur = deg.slice(0, N);
    for (let s = 0; s < S; s++) ord[cur[pre[s]]++] = s;

    this.pre = new Uint16Array(S);
    this.post = new Uint16Array(S);
    this.w = new Float32Array(S);
    this.w0 = new Float32Array(S);
    this.plastic = new Uint8Array(S);
    this.wsc = new Float32Array(S);
    this.struct = new Uint8Array(S);
    this.isApical = new Uint8Array(S);
    this.elig = new Float32Array(S);
    for (let idx = 0; idx < S; idx++) {
      const k = ord[idx];
      this.pre[idx] = pre[k];
      this.post[idx] = post[k];
      this.w[idx] = w[k];
      this.w0[idx] = w[k];
      this.plastic[idx] = pl[k];
      this.wsc[idx] = sc[k];
      this.struct[idx] = st[k];
      this.isApical[idx] = ap[k];
    }
    this.out0 = deg;
    this.buildInc();

    this.act = new Uint8Array(S);
    this.actList = new Int32Array(S);
    this.nAct = 0;

    this.nm = { DA: 0.3, NE: 0.3, '5HT': 0.4, ACh: 0.4, cortisol: 0.3 };
    this.astro = new Float32Array(REGIONS.length).fill(0.2);
    this.regRate = new Float32Array(REGIONS.length);
    this.regGain = new Float32Array(REGIONS.length).fill(1);
    this.regBias = new Float32Array(REGIONS.length); // region-level homeostatic E/I set-point offset
    this.lesion = { mot: false, stdp: false, astro: false, struct: false, homeo: false };
    this.spikes = 0;
    this.stdpEvents = 0;
    this.pruned = 0;
    this.grown = 0;
    this.slowT = 0;
    this.noise = 0.15;
    this.sleepStage = 0;
    this.atonia = 0;
  }

  buildInc() {
    const N = this.N, S = this.S, pl = this.plastic, post = this.post;
    const cnt = new Int32Array(N + 1);
    for (let s = 0; s < S; s++) if (pl[s]) cnt[post[s] + 1]++;
    for (let i = 0; i < N; i++) cnt[i + 1] += cnt[i];
    const idx = new Int32Array(cnt[N]), fill = cnt.slice(0, N);
    for (let s = 0; s < S; s++) if (pl[s]) idx[fill[post[s]]++] = s;
    this.inc0 = cnt;
    this.incIdx = idx;
  }

  touch(s) {
    if (!this.act[s]) { this.act[s] = 1; this.actList[this.nAct++] = s; }
  }

  /** Drive topographic hippocampal place cells from allocentric path-integrator + visual coordinates (px, pz in [-18, 18]) */
  drivePlaceCells(px, pz, gain = 1.15) {
    const ux = clamp(px / 38 + 0.5, 0.02, 0.98);
    const uy = clamp(pz / 38 + 0.5, 0.02, 0.98);
    const nHip = RN.HIP, h0 = R0.HIP, ext = this.ext;
    // Spatial selectivity sharpens automatically with hippocampal sheet resolution (S -> M -> L -> XL)
    const sig2 = SCALE === 'S' ? 0.055 : SCALE === 'M' ? 0.012 : SCALE === 'L' ? 0.0045 : 0.0025;
    const inv2s = 0.5 / sig2;
    for (let i = 0; i < nHip; i++) {
      const g = h0 + i;
      if (TYPE[g] !== 0) continue;
      let dx = Math.abs(POSX[g] - ux); if (dx > 0.5) dx = 1 - dx;
      let dy = Math.abs(POSY[g] - uy); if (dy > 0.5) dy = 1 - dy;
      const d2 = dx * dx + dy * dy;
      if (d2 < sig2 * 4.5) ext[g] += gain * Math.exp(-d2 * inv2s);
    }
  }

  /** One integration step of dt seconds (typically 2 ms). ext[] must be filled by the caller. */
  step(dt) {
    const N = this.N, v = this.v, syn = this.syn, apical = this.apical, ad = this.ad, ref = this.ref;
    const ext = this.ext, vBias = this.vBias, jolt = this.jolt, rate = this.rate, xpre = this.xpre, xpost = this.xpost;
    const spk = this.spk, spkList = this.spkList, tauM = this.tauM, adInc = this.adInc, nm = this.nm;
    const ds = Math.exp(-dt / 0.005), dap = Math.exp(-dt / 0.018), dr = Math.exp(-dt / 0.15), dtr = Math.exp(-dt / 0.02), da = Math.exp(-dt / 0.3);
    const gainNE = 1 + 0.6 * (nm.NE - 0.3);
    const noiseAmp = this.noise * (1 + nm.NE) * Math.sqrt(dt / 0.002) * (1.7320508 / 65535);
    const mn0 = R0.MN, mn1 = R0.MN + RN.MN, mot0 = R0.MOT, mot1 = R0.MOT + RN.MOT;
    const ctx0 = R0.CTX, ctx1 = R0.CTX + RN.CTX;
    const sh0 = R0.THAL, sh1 = R0.STR, delegated = !!this.delegated;
    const lesMot = this.lesion.mot, atonia = this.atonia, achGain = 0.3 + 0.35 * nm.ACh;

    const G = this.regGain, RB = this.regBias;
    for (let k = 0; k < REGIONS.length; k++) G[k] = this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[k];

    let rng = this.rngState | 0;
    let nSpk = 0;
    const inv15 = 1 / 0.15, now = this.t;

    for (let i = 0; i < N; i++) {
      if (delegated && i === sh0) { i = sh1 - 1; continue; }
      rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5;
      const u32 = rng >>> 0;
      const nz = ((u32 & 0xffff) + (u32 >>> 16) - 65535) * noiseAmp;
      const rk = REG[i];
      // Two-compartment apical coincidence amplification on cortical excitatory pyramidal cells
      const apMod = (i >= ctx0 && i < ctx1 && TYPE[i] === 0 && apical[i] > 0.01) ? 1 + achGain * Math.min(1.2, apical[i]) : 1;
      let I = ext[i] + RB[rk] + vBias[i] + syn[i] * G[rk] * apMod + nz + jolt[i];
      jolt[i] *= 0.9;
      if (i >= mn0 && i < mn1) I -= atonia;
      if (lesMot && i >= mot0 && i < mot1) I = -5;
      I *= gainNE;

      let tau = tauM[i];
      if (i >= mn0 && i < mn1) tau = 0.02 / (1 + 2 / (1 + Math.exp(-2 * (I - 1))));

      if (ref[i] > 0) {
        ref[i] -= dt;
        v[i] = 0;
        spk[i] = 0;
      } else {
        const nv = v[i] + (dt * (-v[i] + I - ad[i])) / tau;
        if (nv > 1) {
          v[i] = 0;
          ref[i] = 0.002;
          spk[i] = 1;
          spkList[nSpk++] = i;
          ad[i] += adInc[i];
          rate[i] += inv15;
          this.lastSpike[i] = now;
        } else {
          v[i] = nv < -1.5 ? -1.5 : nv;
          spk[i] = 0;
        }
      }
      ad[i] *= da;
      syn[i] *= ds;
      apical[i] *= dap;
      rate[i] *= dr;
      xpre[i] *= dtr;
      xpost[i] *= dtr;
    }
    this.rngState = rng >>> 0;
    this.spikes = nSpk;

    // Sparse event-driven CSR spike delivery + BCM-stabilised STDP eligibility traces
    const stdpOn = !this.lesion.stdp, homeoOn = !this.lesion.homeo;
    const Ap = 0.01, Am = 0.0102;
    const out0 = this.out0, post = this.post, W = this.w, pl = this.plastic, isAp = this.isApical;
    const inc0 = this.inc0, incIdx = this.incIdx, preA = this.pre, elig = this.elig;

    for (let k = 0; k < nSpk; k++) {
      const i = spkList[k];
      const a = out0[i], b = out0[i + 1];
      for (let s = a; s < b; s++) {
        const j = post[s], ws = W[s];
        if (isAp[s]) { apical[j] += ws; syn[j] += 0.45 * ws; }
        else syn[j] += ws;
        if (stdpOn && pl[s]) {
          const xp = xpost[j];
          if (xp > 0.002) {
            // BCM sliding metaplasticity: under-active post cells experience less LTD; hyper-active post cells get stronger LTD
            const bcm = homeoOn ? clamp(rate[j] / 10, 0.35, 1.75) : 1;
            elig[s] -= Am * bcm * xp;
            if (!this.act[s]) { this.act[s] = 1; this.actList[this.nAct++] = s; }
            this.stdpEvents++;
          }
        }
      }
      if (stdpOn) {
        const ia = inc0[i], ib = inc0[i + 1];
        for (let q = ia; q < ib; q++) {
          const s = incIdx[q];
          const xr = xpre[preA[s]];
          if (xr > 0.002) {
            elig[s] += Ap * xr;
            if (!this.act[s]) { this.act[s] = 1; this.actList[this.nAct++] = s; }
          }
        }
      }
      xpre[i] += 1;
      xpost[i] += 1;
    }
    this.t += dt;
  }

  astroGain(i) { return this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[REG[i]]; }

  /** Slow housekeeping (~20 ms): 3-factor STDP, intrinsic + Turrigiano homeostasis, sleep scaling, Hebbian synaptogenesis */
  slow(dt, stage, achMetaGain = 1) {
    const nm = this.nm;
    const dDA = nm.DA - 0.3;
    const eDecay = Math.exp(-dt / 1.0);
    const awake = stage === 0, nrem = stage === 2 || stage === 3;
    const lr = (0.6 + nm.ACh) * 0.8 * achMetaGain;
    let dw = 0;
    const L = this.actList, elig = this.elig, W = this.w, wsc = this.wsc, act = this.act;
    const stdpOn = !this.lesion.stdp;

    for (let q = 0; q < this.nAct; q++) {
      const s = L[q];
      const e = elig[s];
      if (stdpOn) {
        let d = 0;
        if (awake) d = lr * dDA * e;
        else if (nrem) d = 0.12 * e;
        d *= wsc[s];
        if (d !== 0) {
          const mx = 1.6 * wsc[s];
          const nw = W[s] + d;
          W[s] = nw < 0 ? 0 : nw > mx ? mx : nw;
          dw += Math.abs(d);
        }
      }
      const e2 = e * eDecay;
      if (Math.abs(e2) < 1e-5) {
        elig[s] = 0;
        act[s] = 0;
        L[q] = L[--this.nAct];
        q--;
      } else elig[s] = e2;
    }
    this.dwLast = dw;

    // Region firing rates + astrocyte Ca2+ + region-mean homeostat (preserves spatial bump contrast while preventing silence/runaway)
    for (let k = 0; k < REGIONS.length; k++) {
      if (this.delegated && k >= 1 && k <= 3) continue;
      const [n, cnt] = REGIONS[k];
      let s = 0;
      const r0 = R0[n];
      for (let i = 0; i < cnt; i++) s += this.rate[r0 + i];
      const meanR = s / cnt;
      this.regRate[k] = meanR;
      this.astro[k] += (dt / 4) * (clamp(meanR / 25) - this.astro[k]);
      if (!this.lesion.homeo && (n === 'CTX' || n === 'HIP' || n === 'THAL')) {
        const tgt = n === 'THAL' ? 10 : 9.5;
        this.regBias[k] = clamp(this.regBias[k] + 0.08 * dt * (tgt - meanR), -0.68, 0.45);
      } else if (this.lesion.homeo) {
        this.regBias[k] = 0;
      }
    }

    this.slowT += dt;
    if (!this.delegated && this.slowT >= 1.5) {
      const T = this.slowT;
      this.slowT = 0;
      // Per-neuron slow deadzone intrinsic excitability + Turrigiano multiplicative synaptic scaling
      if (!this.lesion.homeo) {
        for (const reg of ['CTX', 'HIP', 'THAL']) {
          const a0 = R0[reg], a1 = a0 + RN[reg];
          for (let i = a0; i < a1; i++) {
            const rs = 0.88 * this.rateSlow[i] + 0.12 * this.rate[i];
            this.rateSlow[i] = rs;
            if (rs < 0.8) this.vBias[i] = Math.min(0.45, this.vBias[i] + 0.025 * (0.8 - rs));
            else if (rs > 28) this.vBias[i] = Math.max(-0.45, this.vBias[i] - 0.015 * (rs - 28));
            else this.vBias[i] *= 0.992;
          }
        }
        // Turrigiano multiplicative scaling on plastic synapses into silent/epileptic CTX/HIP excitatory neurons
        const ctx0 = R0.CTX, hip1 = R0.HIP + RN.HIP;
        for (let s = 0; s < this.S; s++) {
          if (!this.plastic[s]) continue;
          const j = this.post[s];
          if (j >= ctx0 && j < hip1 && TYPE[j] === 0) {
            const rs = this.rateSlow[j];
            if (rs < 1.2 || rs > 26.0) {
              const mult = clamp(1 + 0.018 * clamp((8.5 - rs) / 8.5, -1, 1), 0.96, 1.04);
              const mx = 1.6 * wsc[s], mn = 0.04 * wsc[s];
              W[s] = clamp(W[s] * mult, mn, mx);
            }
          }
        }
      }
      if (nrem && stdpOn) {
        for (let s = 0; s < this.S; s++) {
          if (this.plastic[s]) W[s] = clamp(W[s] - 0.0003 * T * (W[s] - this.w0[s] * 0.82), 0.03 * wsc[s], 1.6 * wsc[s]);
        }
      }
      if (SCALE !== 'S' && !this.lesion.struct && stdpOn) this.rewire();
    }
  }

  /** Hebbian activity-dependent structural plasticity: prune weak cortical E->E synapses from active cells and regrow onto co-active local E partners */
  rewire() {
    const r = this.r, now = this.t;
    let mE = 0, nE = 0;
    for (let i = 0; i < RN.CTX; i++) if (!TYPE[R0.CTX + i]) { mE += this.rate[R0.CTX + i]; nE++; }
    mE /= nE || 1;
    let changed = 0;
    const maxPerSec = Math.max(16, Math.floor(RN.CTX * 0.012));
    for (let s = 0; s < this.S && changed < maxPerSec; s++) {
      if (!this.struct[s] || this.w[s] > 0.28 * this.w0[s] || r() > 0.25) continue;
      const I = this.pre[s];
      if (this.rate[I] < mE * 1.1) continue; // sprout from strongly active assembly cells
      let best = -1, br = -1;
      const tI = this.lastSpike[I];
      for (let c = 0; c < 6; c++) {
        const J = this.near(POSX[I], POSY[I], 0.04, 'CTX');
        if (J === I || TYPE[J] !== 0) continue;
        const coSpike = tI > 0 && this.lastSpike[J] > 0 && Math.abs(tI - this.lastSpike[J]) < 0.05 && now - tI < 0.25 ? 1.5 : 1;
        const score = this.rate[J] * coSpike;
        if (score > br) { br = score; best = J; }
      }
      if (best < 0 || this.rate[best] < mE * 1.1) continue;
      this.post[s] = best;
      this.w0[s] = (0.30 + 0.35 * r()) * this.wsc[s];
      this.w[s] = 0.75 * this.w0[s];
      this.elig[s] = 0;
      this.pruned++;
      this.grown++;
      changed++;
    }
    if (changed) this.buildInc();
    this.lastRewired = changed;
  }

  /** Mean rate product over cortical E->E synapses relative to random E pairs (> 1 = wiring aligned with co-activity) */
  alignment() {
    let a = 0, n = 0;
    for (let s = 0; s < this.S; s++) if (this.struct[s]) { a += this.rate[this.pre[s]] * this.rate[this.post[s]]; n++; }
    let m = 0, k = 0;
    for (let i = 0; i < RN.CTX; i++) if (!TYPE[R0.CTX + i]) { m += this.rate[R0.CTX + i]; k++; }
    m /= k || 1;
    return n && m > 0 ? a / n / (m * m) : 0;
  }

  regionRate(name) {
    const k = REGIONS.findIndex((x) => x[0] === name);
    return this.regRate[k];
  }
}
