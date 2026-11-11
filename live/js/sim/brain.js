// Spiking substrate (pass 17: 4-compartment Rush-Larsen Hodgkin-Huxley pyramidal cable trees + 6 scales S..MEGA up to 1.05M neurons / 16.78M synapses).
// 16 regions: the 14 reference regions + PROP (32 proprioceptive) + MN (122 sLTC motor neurons); STR has 42 MSNs (21 D1 "go" +
// 21 D2 "no-go" covering 16 plant sites + 3 water pools + dropped snack + epistemic curiosity).
// Six brain scales (choose with ?brain=S|M|L|XL|XXL|MEGA):
//   S    =       436 neurons (compact reference wiring)
//   M    =     3,268 neurons /  ~133k synapses:   48x48 4-comp HH laminar cortex,     512 hippocampal place cells,    128 thalamus
//   L    =    11,972 neurons /  ~531k synapses:   96x96 4-comp HH laminar cortex,   2,048 hippocampal place cells,    384 thalamus
//   XL   =    25,924 neurons / ~1.18M synapses: 144x144 4-comp HH laminar cortex,   4,096 hippocampal place cells,    768 thalamus
//   XXL  =   104,904 neurons / ~4.76M synapses: 290x290 4-comp HH laminar cortex,  16,384 hippocampal place cells,  4,096 thalamus
//   MEGA = 1,048,576 neurons / 16.78M synapses: 960x960 4-comp HH laminar cortex,  98,304 hippocampal place cells, 28,416 thalamus
//
// Pass 17 neurobiology & systems upgrades:
//  1) 4-compartment Rush-Larsen Hodgkin-Huxley cortical pyramidal cable trees:
//       - Compartment 0 (vAIS):  Axon Initial Segment with high-density fast Na_v (m_inf^3 * h_Na) + delayed-rectifier K_v (n_K^4) AP initiation
//       - Compartment 1 (v):     Perisomatic soma receiving PV+ basket shunting inhibition & axial cable coupling to AIS, Basal & Apical
//       - Compartment 2 (vBasal):Basal dendritic arbor receiving L4 thalamocortical & recurrent L2/3-L5/6 AMPA/NMDA input
//       - Compartment 3 (apical):Distal L1 apical tuft with Rush-Larsen HCN I_h hyperpolarization sag, SST+ Martinotti inhibition,
//                                backpropagating AP (bAP) coincidence, and high-voltage Ca_v (m_Ca^2) Larkum BAC plateau bursts!
//  2) Million-neuron MEGA scale (1,048,576 neurons / 16,777,216 synapses): combines explicit plastic TypedArray CSR for all
//     thalamocortical/corticostriatal/motor/neuromodulatory projections with a cache-free 16-tap procedural canonical laminar
//     (L4 -> L2/3 -> L5/6 + PV + SST) & small-world associative stencil + per-neuron BCM/DA plastic efficacy (runs in Web Worker & WebGPU WGSL!).
//  3) Topographic inferotemporal (IT) object-category cortex columns (driveITCortex) alongside V1 Gabor & Orbitofrontal D1/D2 value columns,
//     plus Evo-Devo genetic modulation of hippocampal place gain (neuroHipAlloc) and cortical STDP plasticity (neuroCtxPlastic).
import { mulberry, clamp, gauss } from './util.js';

const VALID_SCALES = new Set(['S', 'M', 'L', 'XL', 'XXL', 'MEGA']);
const SCALE = (() => {
  let envScale = globalThis.process?.env?.BRAIN_SCALE || null;
  if (!envScale && globalThis.process?.env?.TW) {
    try { envScale = JSON.parse(globalThis.process.env.TW).brain; } catch { /* ignore */ }
  }
  const q = globalThis.TW?.brain ?? globalThis.BRAIN_SCALE ?? envScale ??
    (globalThis.location ? new URLSearchParams(globalThis.location.search).get('brain') : null);
  if (VALID_SCALES.has(q)) return q;
  return 'M';
})();
export const BRAIN_SCALE = SCALE;
export const NSTR_OPT = 21; // 16 sites + 3 pools + 1 snack + 1 epistemic explore

const SZ = {
  S:    { CTX: 64,     HIP: 32,    THAL: 16,    side: 8 },
  M:    { CTX: 2304,   HIP: 512,   THAL: 128,   side: 48 },
  L:    { CTX: 9216,   HIP: 2048,  THAL: 384,   side: 96 },
  XL:   { CTX: 20736,  HIP: 4096,  THAL: 768,   side: 144 },
  XXL:  { CTX: 84100,  HIP: 16384, THAL: 4096,  side: 290 },
  MEGA: { CTX: 921600, HIP: 98304, THAL: 28416, side: 960 }, // Total NNEU = 1,048,576 (2^20) exact!
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
    const N = RN[n], side = n === 'CTX' ? SZ.side : Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / side);
    for (let i = 0; i < N; i++) {
      const g = R0[n] + i;
      const ix = i % side, iy = Math.floor(i / side);
      POSX[g] = (ix + 0.5) / side;
      POSY[g] = (iy + 0.5) / rows;
      if (n === 'CTX') {
        const sub = (ix * 7 + iy * 13 + i) % 20;
        LAYER[g] = sub < 5 ? 1 : sub < 14 ? 2 : 3;
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

// 12 local canonical laminar 2D offsets (dx, dy) for MEGA procedural cortical/hippocampal sheet propagation
const STENCIL_DX = new Int8Array([1, -1, 0, 0, 2, -2, 0, 0, 1, -1, 3, -3]);
const STENCIL_DY = new Int8Array([0, 0, 1, -1, 0, 0, 2, -2, 1, -1, 2, -2]);

export class Brain {
  constructor(seed, scaleOverride, gen = null) {
    const r = (this.r = mulberry(seed * 13 + 3));
    this.rngState = ((seed * 747796405 + 2891336453) >>> 0) || 0x9e3779b9;
    const N = NNEU;
    this.N = N;
    this.t = 0;
    this.scale = SCALE;
    this.procStencil = SCALE === 'MEGA';
    this.hipAllocGain = clamp(gen?.neuroHipAlloc ?? 1.0, 0.7, 1.45);
    this.ctxPlasticGain = clamp(gen?.neuroCtxPlastic ?? 1.0, 0.65, 1.5);
    this.inWorker = typeof DedicatedWorkerGlobalScope !== 'undefined' && globalThis instanceof DedicatedWorkerGlobalScope;
    this.sheetStride = (SCALE === 'S' || SCALE === 'M') ? 1 : SCALE === 'L' ? 2 : (this.inWorker && SCALE === 'XL') ? 2 : 8;
    this.subStepCtr = 0;
    this.backend = this.procStencil ? 'CPU-ProceduralCSR32' : N > 65535 ? 'CPU-TypedCSR32' : 'CPU-TypedCSR';

    // Cache-compact Float32 4-compartment Hodgkin-Huxley cable state vectors
    this.v = new Float32Array(N);        // Compartment 1: Somatic membrane potential
    this.vAIS = new Float32Array(N);     // Compartment 0: Axon Initial Segment Na_v/K_v spike-initiation potential
    this.syn = new Float32Array(N);      // Perisomatic / subcortical conductance
    this.vBasal = new Float32Array(N);   // Compartment 2: Basal dendritic AMPA/NMDA potential (CTX pyramidal)
    this.apical = new Float32Array(N);   // Compartment 3: L1 Apical tuft contextual potential (CTX pyramidal)
    this.hNa = new Float32Array(N).fill(0.86);  // Rush-Larsen HH Na_v inactivation gate h
    this.nK = new Float32Array(N).fill(0.12);   // Rush-Larsen HH K_v delayed-rectifier gate n
    this.hHCN = new Float32Array(N).fill(0.24); // Rush-Larsen apical HCN (I_h) hyperpolarization sag gate
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
    this.ihSagMean = 0.24;
    this.wProc = this.procStencil ? new Float32Array(N).fill(1.0) : null;

    // Pre-build cortical laminar excitatory index pools for fast O(1) canonical microcolumn wiring
    const ctxL23E = [], ctxL56E = [], hipE = [];
    const poolStride = SCALE === 'MEGA' ? 16 : 1;
    for (let i = 0; i < RN.CTX; i += poolStride) {
      const g = R0.CTX + i;
      if (TYPE[g] === 0) {
        if (LAYER[g] === 2) ctxL23E.push(g);
        else if (LAYER[g] === 3) ctxL56E.push(g);
      }
    }
    for (let i = 0; i < RN.HIP; i += poolStride) {
      const g = R0.HIP + i;
      if (TYPE[g] === 0) hipE.push(g);
    }

    this.aMemSub = new Float32Array(N);
    this.aMemSh = new Float32Array(N);
    const dtSh0 = 0.002 * this.sheetStride;
    for (let i = 0; i < N; i++) {
      const T = TYPE[i], L = LAYER[i];
      const lScale = L === 1 ? 0.85 : L === 3 ? 1.12 : 1.0;
      const tm = T === 1 && SCALE !== 'S' ? 0.006 + 0.003 * r() : T === 2 ? 0.02 + 0.008 * r() : (0.012 + 0.008 * r()) * lScale;
      this.tauM[i] = tm;
      this.aMemSub[i] = 1 - Math.exp(-0.002 / tm);
      this.aMemSh[i] = 1 - Math.exp(-dtSh0 / tm);
      this.adInc[i] = T === 0 ? (L === 3 ? 0.11 : 0.14) : T === 2 ? 0.09 : 0.02;
      const v0 = r() * 0.5;
      this.v[i] = v0;
      this.vAIS[i] = v0;
    }

    let cap = SCALE === 'MEGA' ? 180000 : SCALE === 'XXL' ? 4800000 : SCALE === 'XL' ? 1250000 : SCALE === 'L' ? 560000 : SCALE === 'M' ? 160000 : 12000;
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
        else if (TYPE[I] === 2) comp = 2;
        else if (TYPE[I] === 1) comp = 0;
        else if ((I >= hip0 && I < hip1) || (I >= ins0 && I < ins1)) comp = 2;
        else comp = 1;
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
        const Nreg = RN[reg];
        const side = reg === 'CTX' ? sideCtx : Math.ceil(Math.sqrt(Nreg));
        const rows = Math.ceil(Nreg / side);
        let nx = x + sig * gauss(r), ny = y + sig * gauss(r);
        nx -= Math.floor(nx); ny -= Math.floor(ny);
        return R0[reg] + Math.min(Nreg - 1, Math.floor(ny * rows) * side + Math.floor(nx * side));
      };
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

        // On million-neuron MEGA scale, dense intra-sheet & sheet<->sheet meshes propagate via the 16-tap procedural
        // canonical laminar + small-world stencil (16.78M total synapses) while keeping explicit plastic CSR on all
        // sensory, corticostriatal, thalamostriatal, motor and neuromodulatory pathways!
        if (this.procStencil && (
          (a === 'CTX' && (b === 'CTX' || b === 'HIP' || b === 'THAL')) ||
          (a === 'HIP' && (b === 'HIP' || b === 'CTX')) ||
          (a === 'THAL' && b === 'CTX') ||
          ((a === 'LC' || a === 'RAPHE' || a === 'BF' || a === 'INS') && (b === 'CTX' || b === 'HIP'))
        )) {
          continue;
        }

        if (a === 'CTX' && b === 'CTX') {
          for (let i = 0; i < RN.CTX; i++) {
            const I = ctx0 + i, tp = TYPE[I], inh = tp !== 0, lay = LAYER[I];
            for (let k = 0; k < Kc; k++) {
              let J;
              if (inh) {
                J = near(POSX[I], POSY[I], tp === 2 ? 0.045 : 0.03, 'CTX');
              } else if (lay === 1) {
                J = r() < 0.65 ? nearCtxLayer(POSX[I], POSY[I], 0.025, 2) : near(POSX[I], POSY[I], 0.035, 'CTX');
              } else if (lay === 2) {
                if (r() < 0.06) J = ctx0 + Math.floor(r() * RN.CTX);
                else J = r() < 0.55 ? nearCtxLayer(POSX[I], POSY[I], 0.055, 2) : nearCtxLayer(POSX[I], POSY[I], 0.025, 3);
              } else {
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
          const rawPer = Math.round((kin * RN.CTX) / RN[a]);
          const per = this.procStencil ? 48 : Math.max(1, rawPer);
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
          const nIn = Math.max(6, Math.round(kin * 1.2));
          const ws = kin / nIn;
          for (let j = 0; j < RN.CTX; j++) {
            const J = ctx0 + j;
            if (LAYER[J] === 1 && r() < 0.6) continue;
            for (let k = 0; k < nIn; k++) {
              let I = near(POSX[J], POSY[J], 0.11, 'HIP');
              if (INHIB(I)) I = hipE[Math.floor(r() * hipE.length)];
              add(I, J, wE() * ws, plastic, ws, 0, 2);
            }
          }
          continue;
        }

        if (a === 'SENS' && b === 'THAL') {
          const per = Math.min(256, Math.max(1, Math.round((kin * RN.THAL) / RN.SENS)));
          for (let i = 0; i < RN.SENS; i++) {
            const I = R0.SENS + i;
            for (let k = 0; k < per; k++) add(I, near(POSX[I], (k + 0.5) / per, 0.08, 'THAL'), wE(), plastic);
          }
          continue;
        }

        if (a === 'HIP' && b === 'STR') {
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

        const jStride = this.procStencil && RN[b] > 4096 ? 16 : 1;
        for (let j = 0; j < RN[b]; j += jStride) {
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

    const explicitS = synPtr;
    this.explicitS = explicitS;
    this.procS = this.procStencil ? (16777216 - explicitS) : 0; // Exact 16,777,216 (2^24) synapses on MEGA!
    this.S = explicitS + this.procS;

    const ord = new Int32Array(explicitS);
    const deg = new Int32Array(N + 1);
    for (let s = 0; s < explicitS; s++) deg[bPre[s] + 1]++;
    for (let i = 0; i < N; i++) deg[i + 1] += deg[i];
    const cur = deg.slice(0, N);
    for (let s = 0; s < explicitS; s++) ord[cur[bPre[s]]++] = s;

    this.pre = new IdxArray(explicitS);
    this.post = new IdxArray(explicitS);
    this.w = new Float32Array(explicitS);
    this.w0 = new Float32Array(explicitS);
    this.plastic = new Uint8Array(explicitS);
    this.wsc = new Float32Array(explicitS);
    this.struct = new Uint8Array(explicitS);
    this.comp = new Uint8Array(explicitS);
    this.isApical = new Uint8Array(explicitS);
    this.elig = new Float32Array(explicitS);
    for (let idx = 0; idx < explicitS; idx++) {
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

    this.act = new Uint8Array(explicitS);
    this.actList = new Int32Array(explicitS);
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

    // Pre-index posterior retinotopic V1/V2 columns (POSX < 0.40), Inferotemporal IT object columns ([0.40, 0.52]), & OFC/ACC ([0.54, 0.80])
    const vIdx = [], vBin = [];
    const itTmp = Array.from({ length: 24 }, () => []);
    const appTmp = Array.from({ length: NSTR_OPT }, () => []);
    const avTmp = Array.from({ length: NSTR_OPT }, () => []);
    const colEOnly = SCALE !== 'S';
    const colStep = this.procStencil ? 24 : 1;
    for (let i = 0; i < RN.CTX; i += colStep) {
      const g = ctx0 + i;
      if (colEOnly && TYPE[g] !== 0) continue;
      const px = POSX[g], py = POSY[g];
      if (px < 0.40 && (!colEOnly || LAYER[g] <= 2)) {
        const vx = Math.min(31, Math.floor((px / 0.40) * 32));
        const vy = Math.min(15, Math.floor(py * 16));
        const ori = i & 3;
        vIdx.push(g);
        vBin.push((vy * 32 + vx) * 4 + ori);
      } else if (px >= 0.40 && px < 0.52 && (!colEOnly || LAYER[g] <= 2)) {
        const proto = Math.min(23, Math.floor(py * 24));
        if (itTmp[proto].length < 64) itTmp[proto].push(g);
      } else if (px >= 0.54 && px <= 0.66) {
        const opt = Math.min(NSTR_OPT - 1, Math.floor(py * NSTR_OPT));
        if (appTmp[opt].length < 128) appTmp[opt].push(g);
      } else if (px >= 0.68 && px <= 0.80) {
        const opt = Math.min(NSTR_OPT - 1, Math.floor(py * NSTR_OPT));
        if (avTmp[opt].length < 128) avTmp[opt].push(g);
      }
    }
    this.visCtxIdx = new IdxArray(vIdx);
    this.visCtxBin = new Uint16Array(vBin);
    this.itCols = itTmp.map((a) => new IdxArray(a));
    this.ofcApp = appTmp.map((a) => new IdxArray(a));
    this.ofcAv = avTmp.map((a) => new IdxArray(a));
  }

  buildInc() {
    const N = this.N, S = this.explicitS, pl = this.plastic, post = this.post;
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

  /** Drive multi-scale septotemporal hippocampal place modules (modulated by Evo-Devo neuroHipAlloc gene) */
  drivePlaceCells(px, pz, gain = 1.15) {
    const effGain = gain * this.hipAllocGain;
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
        if (d2 < 0.24) ext[g] += effGain * Math.exp(-d2 * inv2s);
      }
      return;
    }
    const sigFine = SCALE === 'M' ? 0.0085 : SCALE === 'L' ? 0.0042 : 0.0028;
    const sArr = [sigFine, 0.014, 0.028];
    const invArr = [0.5 / sigFine, 0.5 / 0.014, 0.5 / 0.028];
    const stepH = nHip > 32768 ? 8 : 1;
    for (let i = 0; i < nHip; i += stepH) {
      const g = h0 + i;
      if (TYPE[g] !== 0) continue;
      const band = i % 3;
      const s2 = sArr[band];
      let dx = Math.abs(POSX[g] - ux); if (dx > 0.5) dx = 1 - dx;
      let dy = Math.abs(POSY[g] - uy); if (dy > 0.5) dy = 1 - dy;
      const d2 = dx * dx + dy * dy;
      if (d2 < s2 * 4.5) ext[g] += effGain * Math.exp(-d2 * invArr[band]);
    }
  }

  /** Topographic retinotopic V1 Gabor complex-cell drive onto posterior granular/supragranular visual cortex */
  driveVisualCortex(v1Complex, gain = 0.85) {
    if (!v1Complex || !this.visCtxIdx) return;
    const idx = this.visCtxIdx, bin = this.visCtxBin, ext = this.ext, n = idx.length;
    for (let k = 0; k < n; k++) ext[idx[k]] += gain * v1Complex[bin[k]];
  }

  /** Topographic ventral-stream Inferotemporal (IT) invariant object-category drive onto IT cortical columns */
  driveITCortex(itAct, gain = 0.65) {
    if (!itAct || !this.itCols) return;
    const ext = this.ext, nP = Math.min(24, itAct.length);
    for (let p = 0; p < nP; p++) {
      const a = itAct[p];
      if (a <= 0.02) continue;
      const col = this.itCols[p], n = col.length, drv = gain * a;
      for (let k = 0; k < n; k++) ext[col[k]] += drv;
    }
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

  /**
   * One integration step of dt seconds (2 ms base; impulse-invariant multi-rate sheet step on L..MEGA).
   * Integrates 4-compartment Rush-Larsen Hodgkin-Huxley cable trees (AIS + Soma + Basal + Apical) across CTX pyramidal cells.
   */
  step(dt) {
    const N = this.N, v = this.v, vAIS = this.vAIS, syn = this.syn, vBasal = this.vBasal, apical = this.apical;
    const hNa = this.hNa, nK = this.nK, hHCN = this.hHCN, ad = this.ad, ref = this.ref;
    const ext = this.ext, vBias = this.vBias, jolt = this.jolt, rate = this.rate, xpre = this.xpre, xpost = this.xpost;
    const spk = this.spk, spkList = this.spkList, tauM = this.tauM, adInc = this.adInc, nm = this.nm;

    const sh0 = R0.THAL, sh1 = R0.STR;
    const delegated = !!this.delegated;
    const stride = delegated ? 1 : this.sheetStride;
    const runSheets = !delegated && ((this.subStepCtr++ % stride) === 0);

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

    // Exact Rush-Larsen exponential gating relaxation factors for AIS Na_v (tau_h=5ms), K_v (tau_n=4ms) & Apical HCN I_h (tau_hcn=35ms)
    const dHNa = Math.exp(-dtS / 0.005);
    const dNK = Math.exp(-dtS / 0.004);
    const dHCN = Math.exp(-dtS / 0.035);

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
    let nSpk = 0, nSheetSpk = 0, nPlat = 0, sagSum = 0, sagCnt = 0;
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
      const isPyr = i >= ctx0 && i < ctx1 && TYPE[i] === 0 && SCALE !== 'S';

      let isyn;
      if (isPyr) {
        // 4-compartment pyramidal cable integration:
        //   Apical (Comp 3): Rush-Larsen HCN I_h sag + high-voltage Ca_v (m_Ca^2) Larkum BAC plateau
        //   Basal  (Comp 2): Feedforward/recurrent AMPA+NMDA axial current into Soma
        //   Soma   (Comp 1): Perisomatic PV+ shunt + axial exchange with Basal, Apical & AIS
        const bas = vBasal[i] * kBasS;
        const ap = apical[i] * kApS;
        const zHcn = (-0.10 - ap) * 3.8;
        const hcnInf = 0.5 + (0.5 * zHcn) / (1 + (zHcn < 0 ? -zHcn : zHcn));
        const hc = hcnInf + (hHCN[i] - hcnInf) * dHCN;
        hHCN[i] = hc;
        const iHCN = 0.11 * hc * (0.30 - ap);
        if ((i & 63) === 0) { sagSum += hc; sagCnt++; }

        let bac = 0;
        if ((bas > 0.11 || v[i] > 0.58) && ap > 0.05) {
          const zCa = (ap + 0.32 * v[i] - 0.18) * 5.0;
          const mCa = 0.5 + (0.5 * zCa) / (1 + (zCa < 0 ? -zCa : zCa));
          bac = achGain * Math.min(0.95, 2.2 * mCa * mCa * (Math.max(0.02, bas - 0.07) + 0.25 * ap));
          if (bac > 0.04) nPlat++;
        }
        const apEff = ap + iHCN;
        isyn = (syn[i] * kSynS + bas + 0.45 * (apEff < -0.5 ? -0.5 : apEff) + bac) * G[rk];
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
        if (isPyr) {
          vAIS[i] = 0;
          hNa[i] = 0.88 + (hNa[i] - 0.88) * dHNa;
          nK[i] = 0.12 + (nK[i] - 0.12) * dNK;
        }
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

        if (isPyr) {
          // Compartment 0 (AIS) <-> Compartment 1 (Soma) Rush-Larsen Hodgkin-Huxley Na_v (m^3*h) & K_v (n^4)
          const vs = v[i], va = 0.65 * vs + 0.35 * vAIS[i];
          const zm = (va - 0.66) * 6.5;
          const mInf = 0.5 + (0.5 * zm) / (1 + (zm < 0 ? -zm : zm));
          const m3 = mInf * mInf * mInf;
          const hn = hNa[i], nk = nK[i], nk2 = nk * nk;
          const iNa = 0.34 * m3 * hn * (2.1 - va);
          const iK = 0.38 * nk2 * nk2 * (va + 0.28);

          // Rush-Larsen voltage-dependent gate updates
          const zh = (0.50 - va) * 5.2;
          const hInf = 0.5 + (0.5 * zh) / (1 + (zh < 0 ? -zh : zh));
          hNa[i] = hInf + (hn - hInf) * dHNa;
          const zn = (va - 0.46) * 4.8;
          const nInf = 0.5 + (0.5 * zn) / (1 + (zn < 0 ? -zn : zn));
          nK[i] = nInf + (nk - nInf) * dNK;

          const nv = vs + aMem * (I + 0.65 * (iNa - iK) - ad[i] - vs);
          const nva = va + Math.min(0.95, aMem * 1.25) * (I + iNa - iK - ad[i] - va);

          if (nva > 1.0 || nv > 1.0) {
            v[i] = 0;
            vAIS[i] = -0.10;
            hNa[i] *= 0.32; // Na_v fast inactivation during AP upstroke
            nK[i] = Math.min(0.95, nK[i] + 0.34); // K_v delayed-rectifier activation
            apical[i] += 0.035; // Backpropagating action potential (bAP) into L1 apical tuft!
            ref[i] = 0.002;
            spk[i] = 1;
            spkList[nSpk++] = i;
            if (inSheet && stride > 1) prevSh[nSheetSpk++] = i;
            ad[i] += adInc[i];
            rate[i] += inv15;
            this.lastSpike[i] = now;
          } else {
            v[i] = nv < -1.5 ? -1.5 : nv;
            vAIS[i] = nva < -1.5 ? -1.5 : nva;
            spk[i] = 0;
          }
        } else {
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
    if (runSheets) {
      this.plateauBursts = 0.9 * this.plateauBursts + 0.1 * nPlat;
      if (sagCnt > 0) this.ihSagMean = 0.9 * this.ihSagMean + 0.1 * (sagSum / sagCnt);
    }

    // 1) Explicit CSR spike delivery + BCM STDP eligibility
    const stdpOn = !this.lesion.stdp, homeoOn = !this.lesion.homeo;
    const Ap = 0.01 * this.ctxPlasticGain, Am = 0.0102 * this.ctxPlasticGain;
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

    // 2) Million-neuron MEGA procedural canonical laminar + small-world 16-tap stencil spike propagation
    if (this.procStencil && runSheets) {
      this.deliverProceduralStencil(nSpk, stdpOn);
    }

    this.t += dt;
  }

  /**
   * Cache-free 16-synapse procedural canonical laminar + small-world propagation for 1,048,576-neuron MEGA brain.
   */
  deliverProceduralStencil(nSpk, stdpOn) {
    const spkList = this.spkList, vBasal = this.vBasal, apical = this.apical, syn = this.syn;
    const wProc = this.wProc, rate = this.rate, dDA = this.nm.DA - 0.3;
    const th0 = R0.THAL, ctx0 = R0.CTX, ctx1 = R0.CTX + RN.CTX, hip0 = R0.HIP, hip1 = R0.HIP + RN.HIP;
    const nCtx = RN.CTX, nHip = RN.HIP, sideCtx = SZ.side;

    for (let k = 0; k < nSpk; k++) {
      const i = spkList[k];
      if (i < th0 || i >= hip1) continue;
      const wp = wProc[i];

      if (i < ctx0) {
        // THAL -> 16 topographic L4/L5 cortical granular columns
        const base = Math.min(nCtx - 17, Math.floor(((i - th0) / RN.THAL) * nCtx));
        const ws = 0.26 * wp;
        for (let t = 0; t < 16; t++) {
          const J = ctx0 + ((base + t * 61) % nCtx);
          vBasal[J] += ws;
        }
      } else if (i < ctx1) {
        // CTX canonical laminar microcolumn (12 local 2D offsets + 3 small-world associative + 1 CTX->HIP perforant)
        const rel = i - ctx0;
        const tp = TYPE[i], lay = LAYER[i];
        const ws = (tp !== 0 ? -0.115 : 0.064) * wp;
        const ix = rel % sideCtx, iy = (rel / sideCtx) | 0;
        for (let t = 0; t < 12; t++) {
          let nx = ix + STENCIL_DX[t], ny = iy + STENCIL_DY[t];
          if (nx < 0) nx += sideCtx; else if (nx >= sideCtx) nx -= sideCtx;
          if (ny < 0) ny += sideCtx; else if (ny >= sideCtx) ny -= sideCtx;
          const J = ctx0 + ny * sideCtx + nx;
          if (tp === 2 || (tp === 0 && lay === 3 && LAYER[J] === 2)) apical[J] += ws;
          else if (tp === 1) syn[J] += ws;
          else vBasal[J] += ws;
        }
        if (tp === 0) {
          for (let h = 1; h <= 3; h++) {
            const J = ctx0 + (((Math.imul(rel + h * 7919, 2654435761) >>> 8)) % nCtx);
            vBasal[J] += ws * 0.85;
          }
          const Jh = hip0 + (((Math.imul(rel + 13, 1597334677) >>> 9)) % nHip);
          syn[Jh] += 0.055 * wp;
          if (stdpOn && (k & 7) === 0) {
            wProc[i] = clamp(wp + 0.002 * dDA * (rate[Jh] > 6 ? 1 : -0.3), 0.35, 1.85);
            this.stdpEvents++;
          }
        }
      } else {
        // HIP CA3/CA1 recurrent (12 local) + 4 top-down HIP -> CTX L1 apical tuft synapses
        const rel = i - hip0;
        const inh = INHIB(i);
        const ws = (inh ? -0.095 : 0.055) * wp;
        for (let t = 0; t < 12; t++) {
          const J = hip0 + ((rel + (t + 1) * 37) % nHip);
          syn[J] += ws;
        }
        if (!inh) {
          const cBase = Math.floor((rel / nHip) * nCtx);
          for (let h = 0; h < 4; h++) {
            const J = ctx0 + ((cBase + h * 241) % nCtx);
            apical[J] += 0.058 * wp;
          }
        }
      }
    }
  }

  astroGain(i) { return this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[REG[i]]; }

  /** Slow housekeeping (~20 ms): 3-factor STDP, intrinsic + Turrigiano homeostasis, sleep scaling, Hebbian synaptogenesis */
  slow(dt, stage, achMetaGain = 1) {
    const nm = this.nm;
    const dDA = nm.DA - 0.3;
    const awake = stage === 0, nrem = stage === 2 || stage === 3;
    const lrBase = (0.6 + nm.ACh) * 0.8 * achMetaGain * this.ctxPlasticGain;
    const W = this.w, wsc = this.wsc;
    const stdpOn = !this.lesion.stdp;

    const eligStride = this.explicitS > 2000000 ? 8 : this.explicitS > 600000 ? 4 : 1;
    this.eligCtr = ((this.eligCtr || 0) + 1) % eligStride;
    if (this.eligCtr === 0) {
      const dtE = dt * eligStride;
      const eDecay = Math.exp(-dtE / 1.0);
      const eMin = this.explicitS > 600000 ? 8e-4 : 1e-5;
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
      if (cnt > 32768) {
        const st = cnt > 200000 ? 16 : 4;
        let nSmp = 0;
        for (let i = 0; i < cnt; i += st) { s += this.rate[r0 + i]; nSmp++; }
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
          const iStep = RN[reg] > 200000 ? 8 : 1;
          const iOff = iStep > 1 ? ((this.homeoSlice = ((this.homeoSlice || 0) + 1) & 7)) : 0;
          for (let i = a0 + iOff; i < a1; i += iStep) {
            const rs = 0.88 * this.rateSlow[i] + 0.12 * this.rate[i];
            this.rateSlow[i] = rs;
            if (rs < 0.8) this.vBias[i] = Math.min(0.45, this.vBias[i] + 0.025 * (0.8 - rs));
            else if (rs > 28) this.vBias[i] = Math.max(-0.45, this.vBias[i] - 0.015 * (rs - 28));
            else this.vBias[i] *= 0.992;
          }
        }
        const ctx0 = R0.CTX, hip1 = R0.HIP + RN.HIP;
        const stepS = this.explicitS > 1500000 ? 4 : 1;
        const offS = this.explicitS > 1500000 ? ((this.turrSlice = ((this.turrSlice || 0) + 1) & 3)) : 0;
        for (let s = offS; s < this.explicitS; s += stepS) {
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
        for (let s = 0; s < this.explicitS; s++) {
          if (this.plastic[s]) W[s] = clamp(W[s] - 0.0003 * T * (W[s] - this.w0[s] * 0.82), 0.03 * wsc[s], 1.6 * wsc[s]);
        }
      }
      if (SCALE !== 'S' && !this.lesion.struct && stdpOn) {
        this.rewireCtr = (this.rewireCtr || 0) + 1;
        if (this.explicitS <= 600000 || this.rewireCtr % 3 === 0) this.rewire();
      }
    }
  }

  /** Hebbian activity-dependent structural plasticity */
  rewire() {
    if (this.procStencil) {
      // On MEGA procedural stencil, structural plasticity adapts weak presynaptic efficacy wProc toward co-active neighbors
      const ctx0 = R0.CTX, nCtx = RN.CTX, r = this.r;
      let changed = 0;
      for (let q = 0; q < 96; q++) {
        const i = ctx0 + Math.floor(r() * nCtx);
        if (TYPE[i] === 0 && this.rate[i] > 10 && this.wProc[i] < 1.35) {
          this.wProc[i] += 0.04;
          this.pruned++;
          this.grown++;
          changed++;
        }
      }
      this.lastRewired = changed;
      return;
    }
    const r = this.r, now = this.t;
    let mE = 0, nE = 0;
    const stride = RN.CTX > 16384 ? 4 : 1;
    for (let i = 0; i < RN.CTX; i += stride) if (!TYPE[R0.CTX + i]) { mE += this.rate[R0.CTX + i]; nE++; }
    mE /= nE || 1;
    let changed = 0;
    const maxPerSec = Math.min(240, Math.max(16, Math.floor(RN.CTX * 0.012)));
    const scanStep = this.explicitS > 1500000 ? 4 : 1;
    const scanOff = this.explicitS > 1500000 ? Math.floor(r() * 4) : 0;
    for (let s = scanOff; s < this.explicitS && changed < maxPerSec; s += scanStep) {
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
    if (this.procStencil) {
      const ctx0 = R0.CTX, nCtx = RN.CTX, sideCtx = SZ.side;
      let a = 0, n = 0, m = 0, k = 0;
      for (let idx = 0; idx < nCtx; idx += 64) {
        const I = ctx0 + idx;
        if (TYPE[I] !== 0) continue;
        const rI = this.rate[I];
        m += rI; k++;
        const J = ctx0 + ((idx + 1) % sideCtx) + Math.floor(idx / sideCtx) * sideCtx;
        if (TYPE[J] === 0) { a += rI * this.rate[J] * this.wProc[I]; n++; }
      }
      m /= k || 1;
      return n && m > 0 ? a / n / (m * m) : 0;
    }
    let a = 0, n = 0;
    const st = this.explicitS > 1500000 ? 4 : 1;
    for (let s = 0; s < this.explicitS; s += st) if (this.struct[s]) { a += this.rate[this.pre[s]] * this.rate[this.post[s]]; n++; }
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
