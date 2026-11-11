// Spiking substrate (pass 16: 3-compartment canonical laminar microcolumns, S<M<L<XL<XXL scaling & multi-rate CSR).
// 16 regions: the 14 reference regions + PROP (32 proprioceptive) + MN (122 sLTC motor neurons); STR has 42 MSNs (21 D1 "go" +
// 21 D2 "no-go" covering 16 plant sites + 3 water pools + dropped snack + epistemic curiosity).
// Five brain scales (choose with ?brain=S|M|L|XL|XXL):
//   S   =     436 neurons (compact reference wiring)
//   M   =   3,268 neurons / ~125k synapses:  48x48 3-compartment laminar cortex,    512 hippocampal place cells,   128 thalamus
//   L   =  11,972 neurons / ~498k synapses:  96x96 3-compartment laminar cortex,  2,048 hippocampal place cells,   384 thalamus
//   XL  =  25,924 neurons / ~1.08M synapses: 144x144 3-compartment laminar cortex, 4,096 hippocampal place cells,  768 thalamus
//   XXL = 104,904 neurons / ~4.35M synapses: 290x290 3-compartment laminar cortex, 16,384 hippocampal place cells, 4,096 thalamus
//
// Pass 16 neurobiology & systems upgrades:
//  1) Canonical 3-layer cortical microcolumns (L4 25% granular thalamorecipient -> L2/3 45% supragranular recurrent associative
//     -> L5/6 30% infragranular pyramidal output to STR, MOT, INS & corticothalamic THAL) with excitatory-only long-range axons.
//  2) Three-compartment cortical pyramidal neurons: somatic (v + PV basket perisomatic shunt), basal dendritic (vBasal, L4 &
//     recurrent AMPA/NMDA), and L1 apical tuft (apical, top-down HIP/INS excitation + SST Martinotti distal inhibition) with
//     nonlinear Larkum BAC Ca2+ plateau burst coincidence amplification.
//  3) Multi-scale septotemporal hippocampal place modules (dorsal fine / intermediate / ventral coarse) + variance-reduced
//     population pooling onto STR and MOT so larger brains monotonically improve foraging SNR & spatial resolution (S < M < L).
//  4) Pre-allocated TypedArray CSR construction (Uint32Array indices for >65k neurons in XXL) + impulse-invariant multi-rate
//     exponential-Euler sheet integration so XL runs <9 ms/step even on single-thread CPU, alongside Web Worker & WebGPU backends.
import { mulberry, clamp, gauss } from './util.js';

const SCALE = (() => {
  let envScale = globalThis.process?.env?.BRAIN_SCALE || null;
  if (!envScale && globalThis.process?.env?.TW) {
    try { envScale = JSON.parse(globalThis.process.env.TW).brain; } catch { /* ignore */ }
  }
  const q = globalThis.TW?.brain ?? globalThis.BRAIN_SCALE ?? envScale ??
    (globalThis.location ? new URLSearchParams(globalThis.location.search).get('brain') : null);
  if (q === 'S' || q === 'M' || q === 'L' || q === 'XL' || q === 'XXL') return q;
  return 'M';
})();
export const BRAIN_SCALE = SCALE;
export const NSTR_OPT = 21; // 16 sites + 3 pools + 1 snack + 1 epistemic explore

const SZ = {
  S:   { CTX: 64,    HIP: 32,    THAL: 16,   side: 8 },
  M:   { CTX: 2304,  HIP: 512,   THAL: 128,  side: 48 },
  L:   { CTX: 9216,  HIP: 2048,  THAL: 384,  side: 96 },
  XL:  { CTX: 20736, HIP: 4096,  THAL: 768,  side: 144 },
  XXL: { CTX: 84100, HIP: 16384, THAL: 4096, side: 290 },
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

const IdxArray = NNEU > 65535 ? Uint32Array : Uint16Array;

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

// cell types: 0 = E pyramidal/stellate, 1 = PV fast perisomatic inhibitory, 2 = SST Martinotti apical-targeting inhibitory, 3 = MSN/ENS inhibitory
// laminar layers (CTX): 0 = subcortical, 1 = L4 granular (25%), 2 = L2/3 supragranular (45%), 3 = L5/6 infragranular (30%)
export const TYPE = new Uint8Array(NNEU);
export const LAYER = new Uint8Array(NNEU);
export const POSX = new Float32Array(NNEU), POSY = new Float32Array(NNEU);
const REG = new Uint8Array(NNEU);
REGIONS.forEach(([n], ri) => { for (let i = 0; i < RN[n]; i++) REG[R0[n] + i] = ri; });
{
  const r = mulberry(4242);
  for (const n of ['CTX', 'HIP', 'THAL']) {
    const N = RN[n], side = Math.ceil(Math.sqrt(N));
    for (let i = 0; i < N; i++) {
      const g = R0[n] + i;
      const ix = i % side, iy = Math.floor(i / side);
      POSX[g] = (ix + 0.5) / side;
      POSY[g] = (iy + 0.5) / side;
      if (n === 'CTX') {
        const sub = (ix * 7 + iy * 13 + i) % 20;
        LAYER[g] = sub < 5 ? 1 : sub < 14 ? 2 : 3; // 25% L4, 45% L2/3, 30% L5/6 in every local microcolumn
      }
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
    this.inWorker = typeof DedicatedWorkerGlobalScope !== 'undefined' && globalThis instanceof DedicatedWorkerGlobalScope;
    this.sheetStride = (SCALE === 'S' || SCALE === 'M') ? 1 : SCALE === 'L' ? 2 : (this.inWorker && SCALE === 'XL') ? 2 : 8;
    this.subStepCtr = 0;
    this.backend = N > 65535 ? 'CPU-TypedCSR32' : 'CPU-TypedCSR';

    // Cache-compact Float32 3-compartment state vectors
    this.v = new Float32Array(N);        // Compartment 0: Somatic membrane potential
    this.syn = new Float32Array(N);      // Perisomatic / subcortical conductance
    this.vBasal = new Float32Array(N);   // Compartment 1: Basal dendritic AMPA/NMDA potential (CTX pyramidal)
    this.apical = new Float32Array(N);   // Compartment 2: L1 Apical tuft contextual potential (CTX pyramidal)
    this.ad = new Float32Array(N);
    this.ref = new Float32Array(N);
    this.ext = new Float32Array(N);
    this.vBias = new Float32Array(N);
    this.rate = new Float32Array(N);
    this.rateSlow = new Float32Array(N).fill(8);
    this.xpre = new Float32Array(N);
    this.xpost = new Float32Array(N);
    this.spk = new Uint8Array(N);
    this.spkList = new IdxArray(N);
    this.prevSheetSpk = new IdxArray(N);
    this.nPrevSheetSpk = 0;
    this.lastSpike = new Float32Array(N).fill(-1);
    this.tauM = new Float32Array(N);
    this.adInc = new Float32Array(N);
    this.jolt = new Float32Array(N);
    this.plateauBursts = 0;

    // Pre-build cortical laminar excitatory index pools for fast O(1) canonical microcolumn wiring
    const ctxL23E = [], ctxL56E = [], hipE = [];
    for (let i = 0; i < RN.CTX; i++) {
      const g = R0.CTX + i;
      if (TYPE[g] === 0) {
        if (LAYER[g] === 2) ctxL23E.push(g);
        else if (LAYER[g] === 3) ctxL56E.push(g);
      }
    }
    for (let i = 0; i < RN.HIP; i++) {
      const g = R0.HIP + i;
      if (TYPE[g] === 0) hipE.push(g);
    }

    this.aMemSub = new Float32Array(N);
    this.aMemSh = new Float32Array(N);
    const dtSh0 = 0.002 * this.sheetStride;
    for (let i = 0; i < N; i++) {
      const T = TYPE[i], L = LAYER[i];
      const lScale = L === 1 ? 0.85 : L === 3 ? 1.12 : 1.0; // L4 fast stellate, L5/6 bursting thick-tufted pyramidal
      const tm = T === 1 && SCALE !== 'S' ? 0.006 + 0.003 * r() : T === 2 ? 0.02 + 0.008 * r() : (0.012 + 0.008 * r()) * lScale;
      this.tauM[i] = tm;
      this.aMemSub[i] = 1 - Math.exp(-0.002 / tm);
      this.aMemSh[i] = 1 - Math.exp(-dtSh0 / tm);
      this.adInc[i] = T === 0 ? (L === 3 ? 0.11 : 0.14) : T === 2 ? 0.09 : 0.02;
      this.v[i] = r() * 0.5;
    }

    // Flat growable TypedArray synapse builder (avoids multi-million boxed JS Array.push on XL/XXL!)
    let cap = SCALE === 'XXL' ? 4800000 : SCALE === 'XL' ? 1250000 : SCALE === 'L' ? 560000 : SCALE === 'M' ? 160000 : 12000;
    let bPre = new IdxArray(cap), bPost = new IdxArray(cap);
    let bW = new Float32Array(cap), bSc = new Float32Array(cap);
    let bPl = new Uint8Array(cap), bSt = new Uint8Array(cap), bComp = new Uint8Array(cap);
    let synPtr = 0;

    const grow = () => {
      cap = Math.floor(cap * 1.5);
      const growArr = (old, Ctor) => { const nx = new Ctor(cap); nx.set(old); return nx; };
      bPre = growArr(bPre, IdxArray); bPost = growArr(bPost, IdxArray);
      bW = growArr(bW, Float32Array); bSc = growArr(bSc, Float32Array);
      bPl = growArr(bPl, Uint8Array); bSt = growArr(bSt, Uint8Array); bComp = growArr(bComp, Uint8Array);
    };

    const ctx0 = R0.CTX, ctx1 = R0.CTX + RN.CTX, hip0 = R0.HIP, hip1 = R0.HIP + RN.HIP, ins0 = R0.INS, ins1 = R0.INS + RN.INS;
    // Compartment codes: 0 = somatic (subcortical or PV perisomatic inhibition), 1 = CTX basal dendrite, 2 = CTX L1 apical tuft
    const add = (I, J, wt, plastic, scale = 1, struct = 0, compHint = -1) => {
      if (synPtr >= cap) grow();
      const k = synPtr++;
      bPre[k] = I;
      bPost[k] = J;
      bW[k] = wt;
      bPl[k] = plastic && !INHIB(I) ? 1 : 0;
      bSc[k] = scale;
      bSt[k] = struct;
      let comp = 0;
      if (SCALE !== 'S' && J >= ctx0 && J < ctx1 && TYPE[J] === 0) {
        if (compHint >= 0) comp = compHint;
        else if (TYPE[I] === 2) comp = 2; // SST Martinotti interneuron -> L1 apical tuft inhibition!
        else if (TYPE[I] === 1) comp = 0; // PV basket cell -> perisomatic shunt!
        else if ((I >= hip0 && I < hip1) || (I >= ins0 && I < ins1)) comp = 2; // HIP/INS -> L1 apical tuft!
        else comp = 1; // Thalamic L4 & local cortical E -> basal dendrite!
      }
      bComp[k] = comp;
    };
    const wE = () => 0.24 + 0.32 * r(), wI = () => -(0.52 + 0.42 * r());

    if (SCALE === 'S') {
      for (const [a, b, p] of CP) {
        if (p <= 0) continue;
        const plastic = PLASTIC.has(a + '>' + b);
        const longRangeEOnly = (a === 'CTX' || a === 'HIP') && a !== b;
        for (let i = 0; i < RN[a]; i++) {
          const I = R0[a] + i;
          if (longRangeEOnly && INHIB(I)) continue;
          const pEff = longRangeEOnly ? p * 1.22 : p;
          for (let j = 0; j < RN[b]; j++) {
            const J = R0[b] + j;
            if (I === J || r() >= pEff) continue;
            add(I, J, INHIB(I) ? wI() : wE(), plastic);
          }
        }
      }
    } else {
      const sideCtx = SZ.side;
      const poisson = (lam) => {
        if (lam > 16) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(r)));
        let L = Math.exp(-lam), k = 0, p = 1;
        do { k++; p *= r(); } while (p > L);
        return k - 1;
      };
      const near = (x, y, sig, reg) => {
        const side = reg === 'CTX' ? sideCtx : Math.ceil(Math.sqrt(RN[reg]));
        let nx = x + sig * gauss(r), ny = y + sig * gauss(r);
        nx -= Math.floor(nx); ny -= Math.floor(ny);
        return R0[reg] + Math.min(RN[reg] - 1, Math.floor(ny * side) * side + Math.floor(nx * side));
      };
      // Laminar-aware cortical target selector within local microcolumn patch
      const nearCtxLayer = (x, y, sig, targetLayer) => {
        let J = near(x, y, sig, 'CTX');
        for (let t = 0; t < 4 && LAYER[J] !== targetLayer; t++) {
          const cand = ctx0 + ((J - ctx0 + 1 + t * 3) % RN.CTX);
          if (LAYER[cand] === targetLayer) { J = cand; break; }
        }
        return J;
      };
      this.near = near;
      const Kc = 40, kRef = 0.1 * 64, s = kRef / Kc;

      for (const [a, b, p] of CP) {
        if (p <= 0) continue;
        const plastic = PLASTIC.has(a + '>' + b);
        const kin = p * OLDN[a];

        if (a === 'CTX' && b === 'CTX') {
          // Canonical laminar microcolumn: L4 -> L2/3 -> L5/6 + horizontal L2/3 + PV perisomatic + SST L1 apical inhibition
          for (let i = 0; i < RN.CTX; i++) {
            const I = ctx0 + i, tp = TYPE[I], inh = tp !== 0, lay = LAYER[I];
            for (let k = 0; k < Kc; k++) {
              let J;
              if (inh) {
                J = near(POSX[I], POSY[I], tp === 2 ? 0.045 : 0.03, 'CTX');
              } else if (lay === 1) {
                // L4 granular stellate -> vertical feedforward onto local L2/3 (65%) or local L4/L5 (35%)
                J = r() < 0.65 ? nearCtxLayer(POSX[I], POSY[I], 0.025, 2) : near(POSX[I], POSY[I], 0.035, 'CTX');
              } else if (lay === 2) {
                // L2/3 supragranular -> horizontal associative L2/3 (55%, incl. 6% long-range) or feedforward to L5/6 (45%)
                if (r() < 0.06) J = ctx0 + Math.floor(r() * RN.CTX);
                else J = r() < 0.55 ? nearCtxLayer(POSX[I], POSY[I], 0.055, 2) : nearCtxLayer(POSX[I], POSY[I], 0.025, 3);
              } else {
                // L5/6 infragranular -> deep recurrent L5/6 (60%) or translaminar feedback to L2/3 (40%)
                J = r() < 0.60 ? nearCtxLayer(POSX[I], POSY[I], 0.05, 3) : nearCtxLayer(POSX[I], POSY[I], 0.03, 2);
              }
              if (J === I) continue;
              const comp = tp === 2 ? 2 : tp === 1 ? 0 : (lay === 3 && LAYER[J] === 2 ? 2 : 1);
              add(I, J, (inh ? wI() : wE()) * s, plastic, s, inh ? 0 : 1, comp);
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
          // Core thalamocortical & proprioceptive afferents preferentially target L4 granular layer (80%) + L5/6 collateral (20%)
          const per = Math.max(1, Math.round((kin * RN.CTX) / RN[a]));
          for (let i = 0; i < RN[a]; i++) {
            const I = R0[a] + i;
            const cx = a === 'PROP' ? 0.15 : POSX[I], cy = a === 'PROP' ? POSX[I] : POSY[I];
            for (let k = 0; k < per; k++) {
              const targetL = r() < 0.80 ? 1 : 3;
              const J = nearCtxLayer(cx, cy, a === 'PROP' ? 0.06 : 0.07, targetL);
              add(I, J, wE(), plastic, 1, 0, 1);
            }
          }
          continue;
        }

        if (a === 'CTX' && b === 'HIP') {
          // Superficial L2/3 cortical -> entorhinal/hippocampal topographic projection (excitatory only!)
          const nIn = Math.max(6, Math.round(kin * 1.25));
          const ws = kin / nIn;
          for (let j = 0; j < RN.HIP; j++) {
            const J = R0.HIP + j;
            for (let k = 0; k < nIn; k++) {
              let I = nearCtxLayer(POSX[J], POSY[J], 0.09, 2);
              for (let t = 0; t < 8 && INHIB(I); t++) I = ctxL23E[Math.floor(r() * ctxL23E.length)];
              add(I, J, wE() * ws, plastic, ws);
            }
          }
          continue;
        }

        if (a === 'HIP' && b === 'CTX') {
          // Hippocampal CA1/subicular excitatory feedback onto L2/3 & L5/6 apical tufts (compartment 2)
          const nIn = Math.max(6, Math.round(kin * 1.2));
          const ws = kin / nIn;
          for (let j = 0; j < RN.CTX; j++) {
            const J = ctx0 + j;
            if (LAYER[J] === 1 && r() < 0.6) continue; // L4 receives sparse apical feedback; L2/3 & L5/6 receive dense L1 tuft input
            for (let k = 0; k < nIn; k++) {
              let I = near(POSX[J], POSY[J], 0.11, 'HIP');
              if (INHIB(I)) I = hipE[Math.floor(r() * hipE.length)];
              add(I, J, wE() * ws, plastic, ws, 0, 2);
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
          // Multi-scale excitatory hippocampal place cells -> striatal D1/D2 channels (variance-reduced population fan-in)
          const fanIn = SCALE === 'M' ? 36 : SCALE === 'L' ? 96 : SCALE === 'XL' ? 144 : 192;
          const ws = (0.12 * 27) / fanIn;
          for (let j = 0; j < RN.STR; j++) {
            const J = R0.STR + j;
            const opt = j % NSTR_OPT;
            const ang = (opt < 16 ? (opt / 16) : ((opt - 16) / 5)) * Math.PI * 2;
            const tx = clamp(0.5 + 0.26 * Math.cos(ang), 0.08, 0.92);
            const ty = clamp(0.5 + 0.26 * Math.sin(ang), 0.08, 0.92);
            for (let k = 0; k < fanIn; k++) {
              let I = k < (fanIn >> 1) ? near(tx, ty, 0.22, 'HIP') : hipE[Math.floor(r() * hipE.length)];
              if (INHIB(I)) I = hipE[Math.floor(r() * hipE.length)];
              add(I, J, wE() * ws * 0.55, true, ws * 1.4);
            }
          }
          continue;
        }

        if (a === 'CTX' && b === 'STR') {
          // Deep L5/6 excitatory corticostriatal projection: ventromedial OFC (cx=0.60) -> D1 Go; lateral OFC/ACC (cx=0.74) -> D2 No-Go!
          // Higher cortical sheet resolution (48x48 M vs 96x96 L) sharpens columnar channel selectivity & 1/sqrt(fanIn) SNR!
          const fanIn = SCALE === 'M' ? 28 : SCALE === 'L' ? 72 : SCALE === 'XL' ? 108 : 144;
          const sigOFC = SCALE === 'M' ? 0.020 : 0.013;
          const ws = ((SCALE === 'M' ? 0.095 : 0.125) * 52) / fanIn;
          for (let j = 0; j < RN.STR; j++) {
            const J = R0.STR + j;
            const isD2 = j >= NSTR_OPT;
            const cx = isD2 ? 0.74 : 0.60;
            const cy = ((j % NSTR_OPT) + 0.5) / NSTR_OPT;
            const nTopo = Math.round(fanIn * (SCALE === 'M' ? 0.86 : 0.94));
            for (let k = 0; k < fanIn; k++) {
              let I = k < nTopo ? nearCtxLayer(cx, cy, sigOFC, 3) : ctxL56E[Math.floor(r() * ctxL56E.length)];
              if (INHIB(I)) I = ctxL56E[Math.floor(r() * ctxL56E.length)];
              add(I, J, wE() * ws, plastic, ws);
            }
          }
          continue;
        }

        if (a === 'THAL' && b === 'STR') {
          // Balanced thalamostriatal pooling (eliminates Poisson(0.8) channel-to-channel lottery bias!)
          const fanIn = SCALE === 'M' ? 16 : SCALE === 'L' ? 32 : SCALE === 'XL' ? 48 : 64;
          const ws = (0.05 * 16) / fanIn;
          for (let j = 0; j < RN.STR; j++) {
            const J = R0.STR + j;
            for (let k = 0; k < fanIn; k++) {
              const I = R0.THAL + Math.floor(r() * RN.THAL);
              add(I, J, wE() * ws, plastic, ws);
            }
          }
          continue;
        }

        if (a === 'CTX' && b === 'MOT') {
          // Deep L5 pyramidal tract projection onto motor synergy pool MOT[0..7]
          const fanIn = SCALE === 'M' ? 20 : SCALE === 'L' ? 48 : SCALE === 'XL' ? 72 : 96;
          const ws = (0.085 * 52) / fanIn;
          for (let j = 0; j < RN.MOT; j++) {
            const J = R0.MOT + j;
            for (let k = 0; k < fanIn; k++) {
              let I = nearCtxLayer(0.85, (j + 0.5) / 8, 0.06, 3);
              if (INHIB(I)) I = ctxL56E[Math.floor(r() * ctxL56E.length)];
              add(I, J, wE() * ws, plastic, ws);
            }
          }
          continue;
        }

        if (a === 'CTX' && (b === 'THAL' || b === 'INS')) {
          // Corticothalamic (L6 -> THAL) and cortico-insular (L5 -> INS) excitatory projections
          const nIn = Math.max(6, Math.round(kin * 1.25));
          const ws = (p * 52) / nIn;
          for (let j = 0; j < RN[b]; j++) {
            const J = R0[b] + j;
            for (let k = 0; k < nIn; k++) {
              let I = b === 'THAL' ? nearCtxLayer(POSX[J], POSY[J], 0.08, 3) : ctxL56E[Math.floor(r() * ctxL56E.length)];
              if (INHIB(I)) I = ctxL56E[Math.floor(r() * ctxL56E.length)];
              add(I, J, wE() * ws, plastic, ws);
            }
          }
          continue;
        }

        for (let j = 0; j < RN[b]; j++) {
          const J = R0[b] + j;
          const n = poisson(kin);
          for (let k = 0; k < n; k++) {
            const I = R0[a] + Math.floor(r() * RN[a]);
            if (I === J) continue;
            add(I, J, INHIB(I) ? wI() : wE(), plastic);
          }
        }
      }
    }

    const S = synPtr;
    this.S = S;
    const ord = new Int32Array(S);
    // O(N + S) bucket sort by presynaptic neuron `pre` into CSR layout
    const deg = new Int32Array(N + 1);
    for (let s = 0; s < S; s++) deg[bPre[s] + 1]++;
    for (let i = 0; i < N; i++) deg[i + 1] += deg[i];
    const cur = deg.slice(0, N);
    for (let s = 0; s < S; s++) ord[cur[bPre[s]]++] = s;

    this.pre = new IdxArray(S);
    this.post = new IdxArray(S);
    this.w = new Float32Array(S);
    this.w0 = new Float32Array(S);
    this.plastic = new Uint8Array(S);
    this.wsc = new Float32Array(S);
    this.struct = new Uint8Array(S);
    this.comp = new Uint8Array(S);
    this.isApical = new Uint8Array(S); // kept for compatibility (= comp === 2)
    this.elig = new Float32Array(S);
    for (let idx = 0; idx < S; idx++) {
      const k = ord[idx];
      this.pre[idx] = bPre[k];
      this.post[idx] = bPost[k];
      this.w[idx] = bW[k];
      this.w0[idx] = bW[k];
      this.plastic[idx] = bPl[k];
      this.wsc[idx] = bSc[k];
      this.struct[idx] = bSt[k];
      this.comp[idx] = bComp[k];
      this.isApical[idx] = bComp[k] === 2 ? 1 : 0;
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
    this.regBias = new Float32Array(REGIONS.length);
    this.lesion = { mot: false, stdp: false, astro: false, struct: false, homeo: false };
    this.spikes = 0;
    this.stdpEvents = 0;
    this.pruned = 0;
    this.grown = 0;
    this.slowT = 0;
    this.noise = 0.15;
    this.sleepStage = 0;
    this.atonia = 0;

    // Pre-index posterior retinotopic V1/V4 cortical columns (POSX < 0.42) & Orbitofrontal/ACC option columns (POSX in [0.53, 0.81])
    const vIdx = [], vBin = [];
    const appTmp = Array.from({ length: NSTR_OPT }, () => []);
    const avTmp = Array.from({ length: NSTR_OPT }, () => []);
    const colEOnly = SCALE !== 'S'; // on 436-neuron S, include feed-forward I cells (52..63) to preserve E/I balance
    for (let i = 0; i < RN.CTX; i++) {
      const g = ctx0 + i;
      if (colEOnly && TYPE[g] !== 0) continue;
      const px = POSX[g], py = POSY[g];
      if (px < 0.42 && ( !colEOnly || LAYER[g] <= 2 )) {
        const vx = Math.min(11, Math.floor((px / 0.42) * 12));
        const vy = Math.min(5, Math.floor(py * 6));
        const ori = i & 3;
        vIdx.push(g);
        vBin.push((vy * 12 + vx) * 4 + ori);
      } else if (px >= 0.54 && px <= 0.66) {
        const opt = Math.min(NSTR_OPT - 1, Math.floor(py * NSTR_OPT));
        appTmp[opt].push(g);
      } else if (px >= 0.68 && px <= 0.80) {
        const opt = Math.min(NSTR_OPT - 1, Math.floor(py * NSTR_OPT));
        avTmp[opt].push(g);
      }
    }
    this.visCtxIdx = new IdxArray(vIdx);
    this.visCtxBin = new Uint16Array(vBin);
    this.ofcApp = appTmp.map((a) => new IdxArray(a));
    this.ofcAv = avTmp.map((a) => new IdxArray(a));
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

  /** Drive multi-scale septotemporal hippocampal place modules (dorsal fine, intermediate, ventral coarse) */
  drivePlaceCells(px, pz, gain = 1.15) {
    const ux = clamp(px / 38 + 0.5, 0.02, 0.98);
    const uy = clamp(pz / 38 + 0.5, 0.02, 0.98);
    const nHip = RN.HIP, h0 = R0.HIP, ext = this.ext;
    if (SCALE === 'S') {
      const inv2s = 0.5 / 0.052;
      for (let i = 0; i < nHip; i++) {
        const g = h0 + i;
        if (TYPE[g] !== 0) continue;
        let dx = Math.abs(POSX[g] - ux); if (dx > 0.5) dx = 1 - dx;
        let dy = Math.abs(POSY[g] - uy); if (dy > 0.5) dy = 1 - dy;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.24) ext[g] += gain * Math.exp(-d2 * inv2s);
      }
      return;
    }
    // Dorsal (fine metric) / intermediate / ventral (broad context) septotemporal place-field hierarchy
    const sigFine = SCALE === 'M' ? 0.0085 : SCALE === 'L' ? 0.0042 : 0.0028;
    const sArr = [sigFine, 0.014, 0.028];
    const invArr = [0.5 / sigFine, 0.5 / 0.014, 0.5 / 0.028];
    for (let i = 0; i < nHip; i++) {
      const g = h0 + i;
      if (TYPE[g] !== 0) continue;
      const band = i % 3;
      const s2 = sArr[band];
      let dx = Math.abs(POSX[g] - ux); if (dx > 0.5) dx = 1 - dx;
      let dy = Math.abs(POSY[g] - uy); if (dy > 0.5) dy = 1 - dy;
      const d2 = dx * dx + dy * dy;
      if (d2 < s2 * 4.5) ext[g] += gain * Math.exp(-d2 * invArr[band]);
    }
  }

  /** Topographic retinotopic V1 Gabor complex-cell drive onto posterior granular/supragranular visual cortex */
  driveVisualCortex(v1Complex, gain = 0.85) {
    if (!v1Complex || !this.visCtxIdx) return;
    const idx = this.visCtxIdx, bin = this.visCtxBin, ext = this.ext, n = idx.length;
    for (let k = 0; k < n; k++) ext[idx[k]] += gain * v1Complex[bin[k]];
  }

  /** Topographic Orbitofrontal (ventromedial appetitive -> D1, lateral aversive -> D2) laminar deliberation drive */
  driveOFCColumns(appDrive, avDrive) {
    if (!this.ofcApp) return;
    const ext = this.ext;
    for (let k = 0; k < NSTR_OPT; k++) {
      const ap = appDrive[k];
      if (ap !== 0) {
        const col = this.ofcApp[k], n = col.length;
        for (let i = 0; i < n; i++) {
          const g = col[i];
          ext[g] += ap * (LAYER[g] === 1 ? 1.15 : LAYER[g] === 2 ? 0.95 : 0.75);
        }
      }
      const av = avDrive[k];
      if (av !== 0) {
        const col = this.ofcAv[k], n = col.length;
        for (let i = 0; i < n; i++) {
          const g = col[i];
          ext[g] += av * (LAYER[g] === 1 ? 1.15 : LAYER[g] === 2 ? 0.95 : 0.75);
        }
      }
    }
  }

  /** One integration step of dt seconds (2 ms base; impulse-invariant multi-rate sheet step on L/XL/XXL). */
  step(dt) {
    const N = this.N, v = this.v, syn = this.syn, vBasal = this.vBasal, apical = this.apical, ad = this.ad, ref = this.ref;
    const ext = this.ext, vBias = this.vBias, jolt = this.jolt, rate = this.rate, xpre = this.xpre, xpost = this.xpost;
    const spk = this.spk, spkList = this.spkList, tauM = this.tauM, adInc = this.adInc, nm = this.nm;

    const sh0 = R0.THAL, sh1 = R0.STR;
    const delegated = !!this.delegated;
    const stride = delegated ? 1 : this.sheetStride;
    const runSheets = !delegated && ((this.subStepCtr++ % stride) === 0);

    // Clear stale sheet spike flags on fast subcortical-only substeps in O(nPrevSheetSpk)
    if (!runSheets && this.nPrevSheetSpk > 0) {
      const prev = this.prevSheetSpk, cnt = this.nPrevSheetSpk;
      for (let q = 0; q < cnt; q++) spk[prev[q]] = 0;
      this.nPrevSheetSpk = 0;
    }

    const dtS = dt * stride;
    const ds = Math.exp(-dt / 0.005), dr = Math.exp(-dt / 0.15), dtr = Math.exp(-dt / 0.02), da = Math.exp(-dt / 0.3);
    const dsS = stride === 1 ? ds : Math.exp(-dtS / 0.005);
    const dbasS = Math.exp(-dtS / 0.008);
    const dapS = Math.exp(-dtS / 0.018);
    const drS = stride === 1 ? dr : Math.exp(-dtS / 0.15);
    const dtrS = stride === 1 ? dtr : Math.exp(-dtS / 0.02);
    const daS = stride === 1 ? da : Math.exp(-dtS / 0.3);

    // Impulse-invariant synaptic charge matching across multi-rate sheet strides
    const kSynS = stride === 1 ? 1 : (0.00606648 * (1 - dsS)) / dtS;
    const kBasS = stride === 1 ? 1 : (0.00904160 * (1 - dbasS)) / dtS;
    const kApS = stride === 1 ? 1 : (0.01901850 * (1 - dapS)) / dtS;

    const gainNE = 1 + 0.6 * (nm.NE - 0.3);
    const noiseSub = this.noise * (1 + nm.NE) * Math.sqrt(dt / 0.002) * (1.7320508 / 65535);
    const noiseSh = stride === 1 ? noiseSub : noiseSub / Math.sqrt(stride);
    const mn0 = R0.MN, mn1 = R0.MN + RN.MN, mot0 = R0.MOT, mot1 = R0.MOT + RN.MOT;
    const ctx0 = R0.CTX, ctx1 = R0.CTX + RN.CTX;
    const lesMot = this.lesion.mot, atonia = this.atonia, achGain = 0.35 + 0.4 * nm.ACh;

    const G = this.regGain, RB = this.regBias;
    for (let k = 0; k < REGIONS.length; k++) G[k] = this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[k];

    let rng = this.rngState | 0;
    let nSpk = 0, nSheetSpk = 0, nPlat = 0;
    const prevSh = this.prevSheetSpk;
    const inv15 = 1 / 0.15, now = this.t;

    for (let i = 0; i < N; i++) {
      if (i === sh0 && !runSheets) { i = sh1 - 1; continue; }
      const inSheet = i >= sh0 && i < sh1;
      const dti = inSheet ? dtS : dt;

      rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5;
      const u32 = rng >>> 0;
      const nz = ((u32 & 0xffff) + (u32 >>> 16) - 65535) * (inSheet ? noiseSh : noiseSub);
      const rk = REG[i];

      let isyn;
      if (i >= ctx0 && i < ctx1 && TYPE[i] === 0 && SCALE !== 'S') {
        // 3-compartment pyramidal integration: perisomatic syn + basal dendrite + L1 apical tuft + Larkum BAC plateau
        const bas = vBasal[i] * kBasS;
        const ap = apical[i] * kApS;
        let bac = 0;
        if (bas > 0.11 && ap > 0.05) {
          bac = achGain * Math.min(0.95, (bas - 0.09) * ap * 2.4);
          nPlat++;
        }
        isyn = (syn[i] * kSynS + bas + 0.45 * (ap < -0.5 ? -0.5 : ap) + bac) * G[rk];
      } else {
        isyn = syn[i] * (inSheet ? kSynS : 1) * G[rk];
      }

      let I = ext[i] + RB[rk] + vBias[i] + isyn + nz + jolt[i];
      jolt[i] *= inSheet && stride > 1 ? 0.72 : 0.9;
      if (i >= mn0 && i < mn1) I -= atonia;
      if (lesMot && i >= mot0 && i < mot1) I = -5;
      I *= gainNE;

      const rf = ref[i];
      if (rf >= dti) {
        ref[i] = rf - dti;
        v[i] = 0;
        spk[i] = 0;
      } else {
        let aMem;
        if (i >= mn0 && i < mn1) {
          const tau = 0.02 / (1 + 2 / (1 + Math.exp(-2 * (I - 1))));
          const dtEff = rf > 0 ? dti - rf : dti;
          aMem = dtEff < tau * 0.25 ? dtEff / tau : 1 - Math.exp(-dtEff / tau);
        } else if (rf > 0) {
          const dtEff = dti - rf;
          const tau = tauM[i];
          aMem = dtEff < tau * 0.25 ? dtEff / tau : 1 - Math.exp(-dtEff / tau);
        } else {
          aMem = inSheet ? this.aMemSh[i] : this.aMemSub[i];
        }
        ref[i] = 0;
        const nv = v[i] + aMem * (I - ad[i] - v[i]);
        if (nv > 1) {
          v[i] = 0;
          ref[i] = 0.002;
          spk[i] = 1;
          spkList[nSpk++] = i;
          if (inSheet && stride > 1) prevSh[nSheetSpk++] = i;
          ad[i] += adInc[i];
          rate[i] += inv15;
          this.lastSpike[i] = now;
        } else {
          v[i] = nv < -1.5 ? -1.5 : nv;
          spk[i] = 0;
        }
      }

      if (inSheet) {
        ad[i] *= daS;
        syn[i] *= dsS;
        vBasal[i] *= dbasS;
        apical[i] *= dapS;
        rate[i] *= drS;
        xpre[i] *= dtrS;
        xpost[i] *= dtrS;
      } else {
        ad[i] *= da;
        syn[i] *= ds;
        rate[i] *= dr;
        xpre[i] *= dtr;
        xpost[i] *= dtr;
      }
    }
    this.rngState = rng >>> 0;
    this.spikes = runSheets && stride > 1 ? Math.round(nSpk / stride) : nSpk;
    if (runSheets && stride > 1) this.nPrevSheetSpk = nSheetSpk;
    if (runSheets) this.plateauBursts = 0.9 * this.plateauBursts + 0.1 * nPlat;

    // Sparse event-driven CSR spike delivery into somatic / basal / apical compartments + BCM STDP eligibility
    const stdpOn = !this.lesion.stdp, homeoOn = !this.lesion.homeo;
    const Ap = 0.01, Am = 0.0102;
    const out0 = this.out0, post = this.post, W = this.w, pl = this.plastic, comp = this.comp;
    const inc0 = this.inc0, incIdx = this.incIdx, preA = this.pre, elig = this.elig;

    for (let k = 0; k < nSpk; k++) {
      const i = spkList[k];
      const a = out0[i], b = out0[i + 1];
      for (let s = a; s < b; s++) {
        const j = post[s], ws = W[s], c = comp[s];
        if (c === 1) vBasal[j] += ws;
        else if (c === 2) apical[j] += ws;
        else syn[j] += ws;

        if (stdpOn && pl[s]) {
          const xp = xpost[j];
          if (xp > 0.002) {
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
    const awake = stage === 0, nrem = stage === 2 || stage === 3;
    const lrBase = (0.6 + nm.ACh) * 0.8 * achMetaGain;
    const W = this.w, wsc = this.wsc;
    const stdpOn = !this.lesion.stdp;

    // Impulse-invariant multi-rate eligibility sweep on >600k-synapse XL/XXL sheets (eliminates 48 Hz random-access cache thrashing)
    const eligStride = this.S > 2000000 ? 8 : this.S > 600000 ? 4 : 1;
    this.eligCtr = ((this.eligCtr || 0) + 1) % eligStride;
    if (this.eligCtr === 0) {
      const dtE = dt * eligStride;
      const eDecay = Math.exp(-dtE / 1.0);
      const eMin = this.S > 600000 ? 8e-4 : 1e-5;
      const lr = lrBase * eligStride;
      const nremK = 0.12 * eligStride;
      let dw = 0;
      const L = this.actList, elig = this.elig, act = this.act;
      for (let q = 0; q < this.nAct; q++) {
        const s = L[q];
        const e = elig[s];
        if (stdpOn) {
          let d = 0;
          if (awake) d = lr * dDA * e;
          else if (nrem) d = nremK * e;
          d *= wsc[s];
          if (d !== 0) {
            const mx = 1.6 * wsc[s];
            const nw = W[s] + d;
            W[s] = nw < 0 ? 0 : nw > mx ? mx : nw;
            dw += Math.abs(d);
          }
        }
        const e2 = e * eDecay;
        if (Math.abs(e2) < eMin) {
          elig[s] = 0;
          act[s] = 0;
          L[q] = L[--this.nAct];
          q--;
        } else elig[s] = e2;
      }
      this.dwLast = dw / eligStride;
    }

    for (let k = 0; k < REGIONS.length; k++) {
      if (this.delegated && k >= 1 && k <= 3) continue;
      const [n, cnt] = REGIONS[k];
      let s = 0;
      const r0 = R0[n];
      // Strided unbiased mean estimate only when cnt > 32768 (XXL) to keep 50 Hz housekeeping < 0.1 ms
      if (cnt > 32768) {
        let nSmp = 0;
        for (let i = 0; i < cnt; i += 4) { s += this.rate[r0 + i]; nSmp++; }
        s = (s / nSmp) * cnt;
      } else {
        for (let i = 0; i < cnt; i++) s += this.rate[r0 + i];
      }
      const meanR = s / cnt;
      this.regRate[k] = meanR;
      this.astro[k] += (dt / 4) * (clamp(meanR / 25) - this.astro[k]);
      if (!this.lesion.homeo && (n === 'CTX' || n === 'HIP' || n === 'THAL')) {
        const tgt = n === 'THAL' ? 10 : 9.0;
        this.regBias[k] = clamp(this.regBias[k] + 0.22 * dt * (tgt - meanR), -0.85, 0.50);
      } else if (this.lesion.homeo) {
        this.regBias[k] = 0;
      }
    }

    this.slowT += dt;
    if (!this.delegated && this.slowT >= 1.5) {
      const T = this.slowT;
      this.slowT = 0;
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
        // Turrigiano multiplicative synaptic scaling (rotating slice on XXL so 4.3M synapses never hitch a single frame)
        const ctx0 = R0.CTX, hip1 = R0.HIP + RN.HIP;
        const stepS = this.S > 1500000 ? 4 : 1;
        const offS = this.S > 1500000 ? ((this.turrSlice = ((this.turrSlice || 0) + 1) & 3)) : 0;
        for (let s = offS; s < this.S; s += stepS) {
          if (!this.plastic[s]) continue;
          const j = this.post[s];
          if (j >= ctx0 && j < hip1 && TYPE[j] === 0) {
            const rs = this.rateSlow[j];
            if (rs < 1.2 || rs > 26.0) {
              const mult = clamp(1 + 0.018 * stepS * clamp((8.5 - rs) / 8.5, -1, 1), 0.95, 1.05);
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
      if (SCALE !== 'S' && !this.lesion.struct && stdpOn) {
        this.rewireCtr = (this.rewireCtr || 0) + 1;
        if (this.S <= 600000 || this.rewireCtr % 3 === 0) this.rewire();
      }
    }
  }

  /** Hebbian activity-dependent structural plasticity: prune weak cortical E->E synapses and regrow onto co-active local E partners */
  rewire() {
    const r = this.r, now = this.t;
    let mE = 0, nE = 0;
    const stride = RN.CTX > 16384 ? 4 : 1;
    for (let i = 0; i < RN.CTX; i += stride) if (!TYPE[R0.CTX + i]) { mE += this.rate[R0.CTX + i]; nE++; }
    mE /= nE || 1;
    let changed = 0;
    const maxPerSec = Math.min(240, Math.max(16, Math.floor(RN.CTX * 0.012)));
    const scanStep = this.S > 1500000 ? 4 : 1;
    const scanOff = this.S > 1500000 ? Math.floor(r() * 4) : 0;
    for (let s = scanOff; s < this.S && changed < maxPerSec; s += scanStep) {
      if (!this.struct[s] || this.w[s] > 0.28 * this.w0[s] || r() > 0.25) continue;
      const I = this.pre[s];
      if (this.rate[I] < mE * 1.1) continue;
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
    const st = this.S > 1500000 ? 4 : 1;
    for (let s = 0; s < this.S; s += st) if (this.struct[s]) { a += this.rate[this.pre[s]] * this.rate[this.post[s]]; n++; }
    let m = 0, k = 0;
    for (let i = 0; i < RN.CTX; i += st) if (!TYPE[R0.CTX + i]) { m += this.rate[R0.CTX + i]; k++; }
    m /= k || 1;
    return n && m > 0 ? a / n / (m * m) : 0;
  }

  regionRate(name) {
    const k = REGIONS.findIndex((x) => x[0] === name);
    return this.regRate[k];
  }
}
