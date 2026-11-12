// Spiking substrate (pass 19: 16-compartment branched dendritic cable arbours + exact discrete integer Gillespie/binomial Markov-chain
// ion-channel states + 7 scales S..GIGA up to 14,156,048 neurons — mouse-cortex neuron scale — & 1,132,483,840 [1.13B] plastic synapses).
// 16 regions: the 14 reference regions + PROP (32 proprioceptive) + MN (122 sLTC motor neurons); STR has 42 MSNs (21 D1 "go" +
// 21 D2 "no-go" covering 16 plant sites + 3 water pools + dropped snack + epistemic curiosity).
// Seven brain scales (choose with ?brain=S|M|L|XL|XXL|MEGA|GIGA):
//   S    =        436 neurons (compact reference wiring)
//   M    =      3,268 neurons /   ~133k synapses:     48x48 16-comp branched Markov-HH+NMDA cortex,    512 place cells,     128 thalamus
//   L    =     11,972 neurons /   ~531k synapses:     96x96 16-comp branched Markov-HH+NMDA cortex,  2,048 place cells,     384 thalamus
//   XL   =     25,924 neurons /  ~1.18M synapses:   144x144 16-comp branched Markov-HH+NMDA cortex,  4,096 place cells,     768 thalamus
//   XXL  =    104,904 neurons /  ~4.76M synapses:   290x290 16-comp branched Markov-HH+NMDA cortex, 16,384 place cells,   4,096 thalamus
//   MEGA =  1,048,644 neurons /  16.78M synapses:   960x960 16-comp branched Markov-HH+NMDA cortex, 98,304 place cells,  28,416 thalamus
//   GIGA = 14,156,048 neurons /   1.13B synapses: 3600x3600 mouse-cortex laminar sheet (80 spines/cell across 8 plastic Int8 branch clusters!)
//
// Pass 19 neurobiology & billion-synapse connectome upgrades:
//  1) 16-Compartment Branched Dendritic Cable Arbours + Discrete Integer Gillespie/Binomial Markov-Chain Ion Channels:
//       - Comp 0 (vAIS):         Axon Initial Segment with discrete 5-state Markov Na_v (C0-C1-C2-O-I, N_Na=600) & 4-state K_v (C0-C1-C2-O, N_K=400)!
//       - Comp 1 (v):            Perisomatic soma receiving PV+ fast-basket shunting inhibition & axial coupling to AIS/Basal/Trunk/Collaterals
//       - Comp 2..3 (vCollat0/1): Proximal & associative recurrent axon collaterals modulated by Schwann/oligodendrocyte myelinCond gene
//       - Comp 4..5 (vBasal/L1): Left proximal & distal basal sister branches with discrete Mg2+-unblocked NMDA spine channels (N_NMDA=80)
//       - Comp 6..7 (vBasalR/R1): Right proximal & distal basal sister branches with independent regenerative local NMDA plateau spikes
//       - Comp 8..9 (vOblique/R): Bilateral proximal apical oblique collaterals receiving L2/3 associative input & gating bAP invasion
//       - Comp 10 (vTrunk):      Proximal apical electrotonic trunk with Rush-Larsen HCN I_h hyperpolarization-activated sag
//       - Comp 11 (vTrunkDist):  Distal apical nexus Ca2+ hot-zone with discrete 3-state Markov Ca_v (C-O-I, N_Ca=160) Larkum BAC burst!
//       - Comp 12..13 (apical/A1): Distal L1 apical tuft sister branches A0 & A1 (contextual/hippocampal input)
//       - Comp 14..15 (vTuftB/B1): Distal L1 apical tuft sister branches B0 & B1 + SK Ca2+-activated K+ burst-terminating AHP!
//  2) 1.13-Billion-Synapse Mouse-Cortex-Scale GIGA Connectome (14,156,048 neurons / 1,132,483,840 synapses = 80 spines/neuron):
//       - 113.25M individually mutable Int8 dendritic branch-cluster weights (`wGiga`, 8 clusters/cell x 10 laminar/horizontal spines/cluster)
//         + 16-compartment structural spine-turnover bitmasks (`spineMaskGiga`) stepped via rotating microcolumn waves in Web Worker / CPU.
import { mulberry, clamp, gauss } from './util.js';

const VALID_SCALES = new Set(['S', 'M', 'L', 'XL', 'XXL', 'MEGA', 'GIGA']);
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
  S:    { CTX: 64,       HIP: 32,      THAL: 16,     side: 8 },
  M:    { CTX: 2304,     HIP: 512,     THAL: 128,    side: 48 },
  L:    { CTX: 9216,     HIP: 2048,    THAL: 384,    side: 96 },
  XL:   { CTX: 20736,    HIP: 4096,    THAL: 768,    side: 144 },
  XXL:  { CTX: 84100,    HIP: 16384,   THAL: 4096,   side: 290 },
  MEGA: { CTX: 921600,   HIP: 98304,   THAL: 28416,  side: 960 },
  GIGA: { CTX: 12960000, HIP: 1048576, THAL: 147148, side: 3600 }, // Total NNEU = 14,156,048 (~14.16M mouse-cortex neuron scale!)
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

const IS_GIGA = SCALE === 'GIGA';
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

// Region bounds table for O(1) analytical lookup on 14.16M-neuron GIGA without a 14 MB REG array
const REG_STARTS = new Int32Array(REGIONS.length + 1);
REGIONS.forEach(([n], ri) => { REG_STARTS[ri] = R0[n]; });
REG_STARTS[REGIONS.length] = NNEU;

const SIDE_THAL = Math.ceil(Math.sqrt(RN.THAL));
const ROWS_THAL = Math.ceil(RN.THAL / SIDE_THAL);
const SIDE_HIP = Math.ceil(Math.sqrt(RN.HIP));
const ROWS_HIP = Math.ceil(RN.HIP / SIDE_HIP);
const SIDE_CTX = SZ.side;
const ROWS_CTX = Math.ceil(RN.CTX / SIDE_CTX);

// cell types: 0 = E pyramidal/stellate, 1 = PV fast perisomatic inhibitory, 2 = SST Martinotti apical-targeting inhibitory, 3 = MSN/ENS inhibitory
// laminar layers (CTX): 0 = subcortical, 1 = L4 granular (25%), 2 = L2/3 supragranular (45%), 3 = L5/6 infragranular (30%)
export const TYPE = IS_GIGA ? new Uint8Array(1) : new Uint8Array(NNEU);
export const LAYER = IS_GIGA ? new Uint8Array(1) : new Uint8Array(NNEU);
export const POSX = IS_GIGA ? new Float32Array(1) : new Float32Array(NNEU);
export const POSY = IS_GIGA ? new Float32Array(1) : new Float32Array(NNEU);
const REG = IS_GIGA ? null : new Uint8Array(NNEU);

if (!IS_GIGA) {
  REGIONS.forEach(([n], ri) => { for (let i = 0; i < RN[n]; i++) REG[R0[n] + i] = ri; });
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

function gigaHash(i) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function regionOf(i) {
  if (!IS_GIGA) return REG[i];
  if (i >= R0.CTX && i < R0.HIP) return 2;
  if (i >= R0.HIP && i < R0.STR) return 3;
  if (i >= R0.THAL && i < R0.CTX) return 1;
  if (i < R0.THAL) return 0;
  for (let ri = 4; ri < REGIONS.length; ri++) {
    if (i < REG_STARTS[ri + 1]) return ri;
  }
  return REGIONS.length - 1;
}

export function typeOf(i) {
  if (!IS_GIGA) return TYPE[i];
  if (i >= R0.CTX && i < R0.HIP) {
    const u = (gigaHash(i) & 0xffff) / 65536;
    return u < 0.80 ? 0 : u < 0.90 ? 1 : 2;
  }
  if (i >= R0.HIP && i < R0.STR) {
    return ((gigaHash(i) & 0xffff) < 55705) ? 0 : 1; // 85% E, 15% PV
  }
  if (i >= R0.STR && i < R0.STR + RN.STR) return 3;
  if (i >= R0.ENS + 36 && i < R0.ENS + 48) return 3;
  return 0;
}

export function layerOf(i) {
  if (!IS_GIGA) return LAYER[i];
  if (i < R0.CTX || i >= R0.HIP) return 0;
  const rel = i - R0.CTX;
  const ix = rel % SIDE_CTX, iy = (rel / SIDE_CTX) | 0;
  const sub = (ix * 7 + iy * 13 + rel) % 20;
  return sub < 5 ? 1 : sub < 14 ? 2 : 3;
}

export function posXOf(i) {
  if (!IS_GIGA) return POSX[i];
  if (i >= R0.CTX && i < R0.HIP) return (((i - R0.CTX) % SIDE_CTX) + 0.5) / SIDE_CTX;
  if (i >= R0.HIP && i < R0.STR) return (((i - R0.HIP) % SIDE_HIP) + 0.5) / SIDE_HIP;
  if (i >= R0.THAL && i < R0.CTX) return (((i - R0.THAL) % SIDE_THAL) + 0.5) / SIDE_THAL;
  if (i >= R0.SENS && i < R0.SENS + RN.SENS) return (i - R0.SENS + 0.5) / RN.SENS;
  if (i >= R0.PROP && i < R0.PROP + RN.PROP) return (i - R0.PROP + 0.5) / RN.PROP;
  return 0;
}

export function posYOf(i) {
  if (!IS_GIGA) return POSY[i];
  if (i >= R0.CTX && i < R0.HIP) return (Math.floor((i - R0.CTX) / SIDE_CTX) + 0.5) / ROWS_CTX;
  if (i >= R0.HIP && i < R0.STR) return (Math.floor((i - R0.HIP) / SIDE_HIP) + 0.5) / ROWS_HIP;
  if (i >= R0.THAL && i < R0.CTX) return (Math.floor((i - R0.THAL) / SIDE_THAL) + 0.5) / ROWS_THAL;
  return 0;
}

export const INHIB = (i) => typeOf(i) !== 0;

// 16 local & laminar 2D offsets (dx, dy) for MEGA/GIGA procedural cortical/hippocampal spine-cluster propagation
const STENCIL_DX = new Int8Array([1, -1, 0, 0, 2, -2, 0, 0, 1, -1, 3, -3, 2, -2, 4, -4]);
const STENCIL_DY = new Int8Array([0, 0, 1, -1, 0, 0, 2, -2, 1, -1, 2, -2, -1, 1, 0, 0]);

/** Fast exact-integer Binomial(n, p) transition count sampler for discrete Gillespie Markov ion channels */
function sampleBinomialInt(n, p, u32) {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  const mu = n * p;
  const z = (((u32 & 0xff) + ((u32 >>> 8) & 0xff) + ((u32 >>> 16) & 0xff)) - 382.5) * (1 / 127.8);
  const k = Math.round(mu + Math.sqrt(mu * (1 - p)) * z);
  return k < 0 ? 0 : k > n ? n : k;
}

export class Brain {
  constructor(seed, scaleOverride, gen = null) {
    const r = (this.r = mulberry(seed * 13 + 3));
    this.rngState = ((seed * 747796405 + 2891336453) >>> 0) || 0x9e3779b9;
    const N = NNEU;
    this.N = N;
    this.t = 0;
    this.scale = SCALE;
    this.isGiga = IS_GIGA;
    this.procStencil = SCALE === 'MEGA' || SCALE === 'GIGA';
    this.sparseSheetExt = N > 200000;
    this.hipAllocGain = clamp(gen?.neuroHipAlloc ?? 1.0, 0.7, 1.45);
    this.ctxPlasticGain = clamp(gen?.neuroCtxPlastic ?? 1.0, 0.65, 1.5);
    this.myelinGain = clamp(gen?.myelinCond ?? 1.0, 0.65, 1.45);
    this.inWorker = typeof DedicatedWorkerGlobalScope !== 'undefined' && globalThis instanceof DedicatedWorkerGlobalScope;
    this.sheetStride = (SCALE === 'S' || SCALE === 'M') ? 1 : SCALE === 'L' ? 2 : (this.inWorker && SCALE === 'XL') ? 2 : 8;
    this.subStepCtr = 0;
    this.gigaSlice = 0;
    this.gigaSlices = 64; // 14.16M / 64 = 221,188 neurons stepped per active microcolumn wave!
    this.backend = IS_GIGA
      ? 'CPU-Giga1.13BSpineClusterCSR'
      : this.procStencil
      ? 'CPU-ProceduralCSR32'
      : N > 65535
      ? 'CPU-TypedCSR32'
      : 'CPU-TypedCSR';

    // Public state arrays accessed by Creature, UI & telemetry
    this.ext = new Float32Array(N);
    this.rate = new Float32Array(N);
    this.spk = new Uint8Array(N);
    this.sheetBaseExt = new Float32Array(REGIONS.length);
    this.extDirty = new Uint32Array(16384);
    this.nExtDirty = 0;

    // 16-compartment branched cable + discrete integer Gillespie/Binomial Markov channel telemetry
    this.nCompartments = SCALE === 'S' ? 1 : 16;
    this.plateauBursts = 0;
    this.nmdaSpikes = 0;
    this.ihSagMean = 0.24;
    this.ihMean = 0.24;
    this.skMean = 0.08;
    this.channelNoiseMean = 0.012;
    this.markovOpenNaMean = 0;
    this.markovOpenKMean = 0;
    this.markovOpenCaMean = 0;

    if (IS_GIGA) {
      // Compact subcortical Float32 buffers (324 non-sheet neurons: SENS 0..15 and STR..MN R0.STR..N)
      // plus lazy-allocated 14.16M-neuron quantized Int16 16-comp cable state + 113.25M plastic Int8 spine-cluster weights
      // representing 80 spines/neuron = 1,132,483,840 (1.13B) cortical/hippocampal synapses!
      const nSub = R0.THAL + (N - R0.STR);
      this.nSubCompact = nSub;
      this.v = new Float32Array(4096); // representative window for p5 16-comp oscilloscope + subcortical mirror
      this.vAIS = new Float32Array(4096);
      this.vCollat0 = new Float32Array(4096);
      this.vCollat1 = new Float32Array(4096);
      this.vBasal = new Float32Array(4096);
      this.vBasalL1 = new Float32Array(4096);
      this.vBasalR = new Float32Array(4096);
      this.vBasalR1 = new Float32Array(4096);
      this.vOblique = new Float32Array(4096);
      this.vObliqueR = new Float32Array(4096);
      this.vTrunk = new Float32Array(4096);
      this.vTrunkDist = new Float32Array(4096);
      this.apical = new Float32Array(4096);
      this.vTuftA1 = new Float32Array(4096);
      this.vTuftB = new Float32Array(4096);
      this.vTuftB1 = new Float32Array(4096);
      this.vBias = new Float32Array(4096);
      this.jolt = new Float32Array(N); // sparse jolts

      this.subV = new Float32Array(nSub);
      this.subSyn = new Float32Array(nSub);
      this.subAd = new Float32Array(nSub);
      this.subRef = new Float32Array(nSub);
      this.subTau = new Float32Array(nSub);
      this.subAdInc = new Float32Array(nSub);
      this.subXpre = new Float32Array(nSub);
      this.subXpost = new Float32Array(nSub);
      for (let s = 0; s < nSub; s++) {
        const g = s < R0.THAL ? s : R0.STR + (s - R0.THAL);
        const T = typeOf(g);
        this.subTau[s] = T === 1 ? 0.007 : 0.015;
        this.subAdInc[s] = T === 0 ? 0.12 : 0.02;
        this.subV[s] = r() * 0.4;
      }
      this.spkList = new Uint32Array(262144);
      this.prevSheetSpk = new Uint32Array(262144);
      this.nPrevSheetSpk = 0;
      this.vGiga = null;
      this.synGiga = null;
      this.oblGiga = null;
      this.apGiga = null;
      this.gateGiga = null;
      this.spineMaskGiga = null;
      this.wGiga = null; // 8 * N = 113,248,384 plastic Int8 spine-cluster weights -> 1,132,483,840 (1.13B) synapses!
    } else {
      // Full 16-compartment branched cable + discrete integer Gillespie Markov channel state vectors (S..MEGA)
      this.v = new Float32Array(N);          // Comp 1: Perisomatic soma
      this.vAIS = new Float32Array(N);       // Comp 0: Axon Initial Segment (discrete 5-state Na_v & 4-state K_v)
      this.vCollat0 = new Float32Array(N);   // Comp 2: Proximal axon collateral
      this.vCollat1 = new Float32Array(N);   // Comp 3: Associative axon collateral
      this.syn = new Float32Array(N);        // Perisomatic / subcortical conductance
      this.vBasal = new Float32Array(N);     // Comp 4: Left proximal basal dendrite (L4/THAL AMPA + discrete NMDA)
      this.vBasalL1 = new Float32Array(N);   // Comp 5: Left distal basal sister branch
      this.vBasalR = new Float32Array(N);    // Comp 6: Right proximal basal dendrite (recurrent AMPA + discrete NMDA)
      this.vBasalR1 = new Float32Array(N);   // Comp 7: Right distal basal sister branch
      this.vOblique = new Float32Array(N);   // Comp 8: Left proximal apical oblique collateral
      this.vObliqueR = new Float32Array(N);  // Comp 9: Right proximal apical oblique collateral
      this.vTrunk = new Float32Array(N);     // Comp 10: Proximal apical trunk electrotonic cable (HCN I_h sag)
      this.vTrunkDist = new Float32Array(N); // Comp 11: Distal apical nexus Ca2+ hot-zone (3-state Markov Ca_v BAC)
      this.apical = new Float32Array(N);     // Comp 12: Distal L1 apical tuft branch A0
      this.vTuftA1 = new Float32Array(N);    // Comp 13: Distal L1 apical tuft terminal sister A1
      this.vTuftB = new Float32Array(N);     // Comp 14: Distal L1 apical tuft branch B0
      this.vTuftB1 = new Float32Array(N);    // Comp 15: Distal L1 apical tuft terminal sister B1 (SK AHP)

      // Discrete integer Markov ion-channel populations:
      //  - Na_v (5-state C0-C1-C2-O-I, N_Na = 600): `nNaI` inactivated channels, `nNaO` open channels
      //  - K_v  (4-state C0-C1-C2-O,   N_K  = 400): `nKO` open delayed-rectifier channels
      //  - Ca_v (3-state C-O-I,        N_Ca = 160): `nCaO` open nexus L/T-type Ca2+ channels, `nCaI` inactivated
      this.nNaI = new Uint16Array(N).fill(84);   // 600 * (1 - 0.86) = 84 inactivated, 516 available
      this.nNaO = new Uint16Array(N);
      this.nKO = new Uint16Array(N).fill(2);
      this.nCaO = new Uint8Array(N);
      this.nCaI = new Uint8Array(N).fill(16);
      this.hNa = new Float32Array(N).fill(0.86);  // Continuous readout mirror (1 - nNaI/600)
      this.nK = new Float32Array(N).fill(0.12);   // Continuous readout mirror (nKO/400)^(1/4)
      this.hHCN = new Float32Array(N).fill(0.24); // Rush-Larsen apical trunk HCN (I_h) gate
      this.mSK = new Float32Array(N).fill(0.05);  // Rush-Larsen tuft SK Ca2+-activated K+ AHP gate
      this.ad = new Float32Array(N);
      this.ref = new Float32Array(N);
      this.vBias = new Float32Array(N);
      this.rateSlow = new Float32Array(N).fill(8);
      this.xpre = new Float32Array(N);
      this.xpost = new Float32Array(N);
      this.spkList = new IdxArray(N);
      this.prevSheetSpk = new IdxArray(N);
      this.nPrevSheetSpk = 0;
      this.lastSpike = new Float32Array(N).fill(-1);
      this.tauM = new Float32Array(N);
      this.adInc = new Float32Array(N);
      this.jolt = new Float32Array(N);
      this.wProc = this.procStencil ? new Float32Array(N).fill(1.0) : null;

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
    }

    // Pre-build cortical laminar excitatory index pools for fast O(1) canonical microcolumn wiring
    const ctxL23E = [], ctxL56E = [], hipE = [];
    const poolStride = IS_GIGA ? 256 : SCALE === 'MEGA' ? 16 : 1;
    for (let i = 0; i < RN.CTX; i += poolStride) {
      const g = R0.CTX + i;
      if (typeOf(g) === 0) {
        const lay = layerOf(g);
        if (lay === 2) ctxL23E.push(g);
        else if (lay === 3) ctxL56E.push(g);
      }
    }
    for (let i = 0; i < RN.HIP; i += poolStride) {
      const g = R0.HIP + i;
      if (typeOf(g) === 0) hipE.push(g);
    }

    let cap = IS_GIGA ? 90000 : SCALE === 'MEGA' ? 180000 : SCALE === 'XXL' ? 4800000 : SCALE === 'XL' ? 1250000 : SCALE === 'L' ? 560000 : SCALE === 'M' ? 160000 : 12000;
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

    // Compartment codes for bComp:
    //  0 = Soma (PV+ perisomatic / subcortical)
    //  1 = BasalL (feedforward L4 / thalamocortical)
    //  2 = TuftA (L1 contextual / SST+ / HIP->CTX)
    //  3 = BasalR (recurrent L2/3-L5/6 associative)
    //  4 = ApicalOblique (intra-columnar L2/3 collateral)
    //  5 = TuftB (feedback L5/6->L1 & INS->CTX)
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
      if (SCALE !== 'S' && J >= ctx0 && J < ctx1 && typeOf(J) === 0) {
        if (compHint >= 0) comp = compHint;
        else {
          const tI = typeOf(I);
          if (tI === 2) comp = (k & 1) ? 5 : 2;
          else if (tI === 1) comp = 0;
          else if (I >= hip0 && I < hip1) comp = 2;
          else if (I >= ins0 && I < ins1) comp = 5;
          else comp = (k & 1) ? 3 : 1;
        }
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
        for (let t = 0; t < 4 && layerOf(J) !== targetLayer; t++) {
          const cand = ctx0 + ((J - ctx0 + 1 + t * 3) % RN.CTX);
          if (layerOf(cand) === targetLayer) { J = cand; break; }
        }
        return J;
      };
      this.near = near;
      const Kc = 40, kRef = 0.1 * 64, s = kRef / Kc;

      for (const [a, b, p] of CP) {
        if (p <= 0) continue;
        const plastic = PLASTIC.has(a + '>' + b);
        const kin = p * OLDN[a];

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
              // Route onto 16-compartment branched cable arbour:
              //  0=Soma, 1=BasalL0, 6=BasalL1, 3=BasalR0, 7=BasalR1, 4=ObliqueL, 8=ObliqueR, 2=TuftA0, 9=TuftA1, 5=TuftB0, 10=TuftB1
              let comp = 0;
              if (tp === 2) comp = (k & 3) === 0 ? 5 : (k & 3) === 1 ? 10 : (k & 3) === 2 ? 2 : 9;
              else if (tp === 1) comp = 0;
              else if (lay === 3 && LAYER[J] === 2) comp = (k & 3) === 0 ? 5 : (k & 3) === 1 ? 10 : (k & 3) === 2 ? 2 : 9;
              else if (lay === 2 && LAYER[J] === 2 && (k & 3) === 0) comp = (k & 4) ? 8 : 4;
              else if (lay === 1) comp = (k & 1) ? 6 : 1;
              else comp = (k & 3) === 0 ? 1 : (k & 3) === 1 ? 6 : (k & 3) === 2 ? 3 : 7;
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
            const cx = a === 'PROP' ? 0.15 : posXOf(I), cy = a === 'PROP' ? posXOf(I) : posYOf(I);
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
              let I = nearCtxLayer(posXOf(J), posYOf(J), 0.09, 2);
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
            if (layerOf(J) === 1 && r() < 0.6) continue;
            for (let k = 0; k < nIn; k++) {
              let I = near(posXOf(J), posYOf(J), 0.11, 'HIP');
              if (INHIB(I)) I = hipE[Math.floor(r() * hipE.length)];
              add(I, J, wE() * ws, plastic, ws, 0, (k & 1) ? 5 : 2);
            }
          }
          continue;
        }

        if (a === 'SENS' && b === 'THAL') {
          const per = Math.min(256, Math.max(1, Math.round((kin * RN.THAL) / RN.SENS)));
          for (let i = 0; i < RN.SENS; i++) {
            const I = R0.SENS + i;
            for (let k = 0; k < per; k++) add(I, near(posXOf(I), (k + 0.5) / per, 0.08, 'THAL'), wE(), plastic);
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
          const jStrideB = IS_GIGA && RN[b] > 4096 ? 64 : 1;
          for (let j = 0; j < RN[b]; j += jStrideB) {
            const J = R0[b] + j;
            for (let k = 0; k < nIn; k++) {
              let I = b === 'THAL' ? nearCtxLayer(posXOf(J), posYOf(J), 0.08, 3) : ctxL56E[Math.floor(r() * ctxL56E.length)];
              if (INHIB(I)) I = ctxL56E[Math.floor(r() * ctxL56E.length)];
              add(I, J, wE() * ws, plastic, ws);
            }
          }
          continue;
        }

        const jStride = IS_GIGA && RN[b] > 4096 ? 128 : this.procStencil && RN[b] > 4096 ? 16 : 1;
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
    this.procS = IS_GIGA
      ? (80 * N - explicitS) // 1,132,483,840 (1.13 Billion!) synapses on 14.16M-neuron GIGA (80 spines/neuron across 8 plastic clusters)!
      : this.procStencil
      ? (16777216 - explicitS) // 16,777,216 (2^24) synapses on MEGA
      : 0;
    this.S = explicitS + this.procS;

    // Build outgoing CSR cleanly even when N = 14.16M: on GIGA use sparse Map/sorted edge table if needed, or Int32Array(N+1) (56 MB)
    const ord = new Int32Array(explicitS);
    const deg = new Int32Array(N + 1);
    for (let s = 0; s < explicitS; s++) deg[bPre[s] + 1]++;
    for (let i = 0; i < N; i++) deg[i + 1] += deg[i];
    const cur = new Int32Array(N);
    cur.set(deg.subarray(0, N));
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
      this.isApical[idx] = (bComp[k] === 2 || bComp[k] === 5 || bComp[k] === 9 || bComp[k] === 10) ? 1 : 0;
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

    // Pre-index posterior retinotopic V1/V2 columns (POSX < 0.40), Inferotemporal IT compositional columns ([0.40, 0.52]), & OFC/ACC ([0.54, 0.80])
    const vIdx = [], vBin = [];
    const itTmp = Array.from({ length: 64 }, () => []);
    const appTmp = Array.from({ length: NSTR_OPT }, () => []);
    const avTmp = Array.from({ length: NSTR_OPT }, () => []);
    const colEOnly = SCALE !== 'S';
    const colStep = IS_GIGA ? 384 : this.procStencil ? 24 : 1;
    for (let i = 0; i < RN.CTX; i += colStep) {
      const g = ctx0 + i;
      if (colEOnly && typeOf(g) !== 0) continue;
      const px = posXOf(g), py = posYOf(g), lay = layerOf(g);
      if (px < 0.40 && (!colEOnly || lay <= 2)) {
        if (vIdx.length < 4096) {
          const vx = Math.min(63, Math.floor((px / 0.40) * 64));
          const vy = Math.min(31, Math.floor(py * 32));
          const ori = i & 3;
          vIdx.push(g);
          vBin.push((vy * 64 + vx) * 4 + ori);
        }
      } else if (px >= 0.40 && px < 0.52 && (!colEOnly || lay <= 2)) {
        const proto = Math.min(63, Math.floor(py * 64));
        if (itTmp[proto].length < 48) itTmp[proto].push(g);
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

  _ensureGigaState() {
    if (this.wGiga) return;
    const N = this.N;
    this.vGiga = new Int16Array(N);
    this.synGiga = new Int16Array(N);
    this.oblGiga = new Int16Array(N);
    this.apGiga = new Int16Array(N);
    this.gateGiga = new Uint16Array(N); // packed discrete Markov channel counts: [nNaI_8bit | nKO_8bit]
    this.spineMaskGiga = new Uint16Array(N).fill(0xffff); // 16-compartment structural spine presence bitmask
    this.wGiga = new Int8Array(8 * N); // 113,248,384 plastic Int8 branch-cluster weights x 10 spines/cluster = 1,132,483,840 synapses!
    this.wGiga.fill(64);
    this.gateGiga.fill((36 << 8) | 12); // discrete inactivated Na & open K channels
    for (let i = 0; i < N; i += 17) this.vGiga[i] = ((i * 1103515245) >>> 21) & 1023;
  }

  _markExt(idx, addVal) {
    if (addVal === 0) return;
    if (this.sparseSheetExt && this.ext[idx] === 0 && this.nExtDirty < this.extDirty.length) {
      this.extDirty[this.nExtDirty++] = idx;
    }
    this.ext[idx] += addVal;
  }

  /** O(1) sparse reset on million/14-million-neuron brains; exact full reset on S..XXL */
  prepareExt(awake = true, sleepStage = 0) {
    const ext = this.ext, nm = this.nm;
    if (!this.sparseSheetExt) {
      ext.fill(0);
      this.sheetBaseExt.fill(0);
      const ctxBase = 0.55 + 0.3 * nm.ACh;
      const thBase = awake ? 0.5 : sleepStage === 4 ? 0.45 : 0.2;
      for (let i = 0; i < RN.CTX; i++) ext[R0.CTX + i] = ctxBase;
      for (let i = 0; i < RN.THAL; i++) ext[R0.THAL + i] = thBase;
      for (let i = 0; i < RN.HIP; i++) ext[R0.HIP + i] = 0.45;
      for (let i = 0; i < RN.STR; i++) ext[R0.STR + i] = 0.4;
      return;
    }
    // Clear only previously touched sparse sheet cells + small subcortical ranges!
    for (let k = 0; k < this.nExtDirty; k++) ext[this.extDirty[k]] = 0;
    this.nExtDirty = 0;
    ext.fill(0, 0, R0.THAL);
    ext.fill(0, R0.STR, this.N);
    for (let i = 0; i < RN.STR; i++) ext[R0.STR + i] = 0.4;
    this.sheetBaseExt[1] = awake ? 0.5 : sleepStage === 4 ? 0.45 : 0.2; // THAL
    this.sheetBaseExt[2] = 0.55 + 0.3 * nm.ACh; // CTX
    this.sheetBaseExt[3] = 0.45; // HIP
  }

  buildInc() {
    const N = this.N, S = this.explicitS, pl = this.plastic, post = this.post;
    const cnt = new Int32Array(N + 1);
    for (let s = 0; s < S; s++) if (pl[s]) cnt[post[s] + 1]++;
    for (let i = 0; i < N; i++) cnt[i + 1] += cnt[i];
    const idx = new Int32Array(cnt[N]);
    const fill = new Int32Array(N);
    fill.set(cnt.subarray(0, N));
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
    const stepH = IS_GIGA ? 256 : nHip > 32768 ? 8 : 1;
    for (let i = 0; i < nHip; i += stepH) {
      const g = h0 + i;
      if (typeOf(g) !== 0) continue;
      const band = i % 3;
      const s2 = sArr[band];
      let dx = Math.abs(posXOf(g) - ux); if (dx > 0.5) dx = 1 - dx;
      let dy = Math.abs(posYOf(g) - uy); if (dy > 0.5) dy = 1 - dy;
      const d2 = dx * dx + dy * dy;
      if (d2 < s2 * 4.5) this._markExt(g, effGain * Math.exp(-d2 * invArr[band]));
    }
  }

  /** Topographic retinotopic V1 Gabor complex-cell drive onto posterior granular/supragranular visual cortex */
  driveVisualCortex(v1Complex, gain = 0.85) {
    if (!v1Complex || !this.visCtxIdx) return;
    const idx = this.visCtxIdx, bin = this.visCtxBin, vLen = v1Complex.length, n = idx.length;
    for (let k = 0; k < n; k++) {
      const b = bin[k] % vLen;
      const d = gain * v1Complex[b];
      if (d > 0.005) this._markExt(idx[k], d);
    }
  }

  /** Topographic ventral-stream Compositional IT + Perirhinal drive onto 64 IT cortical columns */
  driveITCortex(itAct, gain = 0.65) {
    if (!itAct || !this.itCols) return;
    const nP = Math.min(this.itCols.length, itAct.length);
    for (let p = 0; p < nP; p++) {
      const a = itAct[p];
      if (a <= 0.02) continue;
      const col = this.itCols[p], n = col.length, drv = gain * a;
      for (let k = 0; k < n; k++) this._markExt(col[k], drv);
    }
  }

  /** Topographic Orbitofrontal (ventromedial appetitive -> D1, lateral aversive -> D2) laminar deliberation drive */
  driveOFCColumns(appDrive, avDrive) {
    if (!this.ofcApp) return;
    for (let k = 0; k < NSTR_OPT; k++) {
      const ap = appDrive[k];
      if (ap !== 0) {
        const col = this.ofcApp[k], n = col.length;
        for (let i = 0; i < n; i++) {
          const g = col[i], lay = layerOf(g);
          this._markExt(g, ap * (lay === 1 ? 1.15 : lay === 2 ? 0.95 : 0.75));
        }
      }
      const av = avDrive[k];
      if (av !== 0) {
        const col = this.ofcAv[k], n = col.length;
        for (let i = 0; i < n; i++) {
          const g = col[i], lay = layerOf(g);
          this._markExt(g, av * (lay === 1 ? 1.15 : lay === 2 ? 0.95 : 0.75));
        }
      }
    }
  }

  /** Dedicated 14,156,048-neuron mouse-cortex-scale GIGA step (quantized Int16 8-comp reduced cable + 56.62M plastic Int8 synapses) */
  _stepGiga(dt) {
    const delegated = !!this.delegated;
    if (!delegated) this._ensureGigaState();

    const ext = this.ext, rate = this.rate, spk = this.spk, spkList = this.spkList;
    const nm = this.nm, G = this.regGain, RB = this.regBias, SB = this.sheetBaseExt;
    for (let k = 0; k < REGIONS.length; k++) G[k] = this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[k];

    const gainNE = 1 + 0.6 * (nm.NE - 0.3);
    const ds = Math.exp(-dt / 0.005), dr = Math.exp(-dt / 0.15), da = Math.exp(-dt / 0.3), dtr = Math.exp(-dt / 0.02);
    const noiseSub = this.noise * (1 + nm.NE) * Math.sqrt(dt / 0.002) * (1.7320508 / 65535);
    const mn0 = R0.MN, mn1 = R0.MN + RN.MN, mot0 = R0.MOT, mot1 = R0.MOT + RN.MOT;
    const lesMot = this.lesion.mot, atonia = this.atonia;
    const inv15 = 1 / 0.15;

    let rng = this.rngState | 0;
    let nSpk = 0;

    // 1) Step all 324 subcortical/sensory/striatal/motor/MN neurons at exact 2 ms resolution
    const nSub = this.nSubCompact;
    for (let s = 0; s < nSub; s++) {
      const i = s < R0.THAL ? s : R0.STR + (s - R0.THAL);
      rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5;
      const u32 = rng >>> 0;
      const nz = ((u32 & 0xffff) + (u32 >>> 16) - 65535) * noiseSub;
      const rk = regionOf(i);
      let I = ext[i] + RB[rk] + this.subSyn[s] * G[rk] + nz + this.jolt[i];
      this.jolt[i] *= 0.9;
      if (i >= mn0 && i < mn1) I -= atonia;
      if (lesMot && i >= mot0 && i < mot1) I = -5;
      I *= gainNE;

      const rf = this.subRef[s];
      if (rf >= dt) {
        this.subRef[s] = rf - dt;
        this.subV[s] = 0;
        spk[i] = 0;
      } else {
        const tau = (i >= mn0 && i < mn1) ? (0.02 / (1 + 2 / (1 + Math.exp(-2 * (I - 1))))) : this.subTau[s];
        const aMem = 1 - Math.exp(-dt / tau);
        this.subRef[s] = 0;
        const nv = this.subV[s] + aMem * (I - this.subAd[s] - this.subV[s]);
        if (nv > 1) {
          this.subV[s] = 0;
          this.subRef[s] = 0.002;
          spk[i] = 1;
          spkList[nSpk++] = i;
          this.subAd[s] += this.subAdInc[s];
          rate[i] += inv15;
          this.subXpre[s] += 1;
          this.subXpost[s] += 1;
        } else {
          this.subV[s] = nv < -1.5 ? -1.5 : nv;
          spk[i] = 0;
        }
      }
      this.subAd[s] *= da;
      this.subSyn[s] *= ds;
      rate[i] *= dr;
      this.subXpre[s] *= dtr;
      this.subXpost[s] *= dtr;
    }

    // 2) Step active rotating microcolumn slice across the 14.16M-neuron THAL+CTX+HIP sheet (1.132B spine-cluster synaptome!)
    let nSheetSpk = 0, nPlat = 0, nNmda = 0, openNaSum = 0, openKSum = 0, openCnt = 0;
    if (!delegated) {
      const prev = this.prevSheetSpk, prevCnt = this.nPrevSheetSpk;
      for (let q = 0; q < prevCnt; q++) spk[prev[q]] = 0;
      this.nPrevSheetSpk = 0;

      const sl = this.gigaSlice;
      this.gigaSlice = (sl + 1) % this.gigaSlices;
      const dtG = Math.min(0.018, dt * 8);
      const drG = Math.exp(-dt * this.gigaSlices / 0.15);
      const inv15G = 1 / 0.15;
      const vG = this.vGiga, synG = this.synGiga, oblG = this.oblGiga, apG = this.apGiga;
      const gateG = this.gateGiga, maskG = this.spineMaskGiga, wG = this.wGiga;
      const sh0 = R0.THAL, sh1 = R0.STR, ctx0 = R0.CTX, ctx1 = R0.HIP;
      const achGain = 0.35 + 0.4 * nm.ACh;
      const dDA = nm.DA - 0.3;
      const stdpOn = !this.lesion.stdp;

      for (let i = sh0 + sl; i < sh1; i += this.gigaSlices) {
        rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5;
        const u32 = rng >>> 0;
        const nz = (((u32 & 0xffff) + (u32 >>> 16) - 65535) * noiseSub) * 0.45;
        const rk = i < ctx0 ? 1 : i < ctx1 ? 2 : 3;
        const isPyr = rk === 2 && typeOf(i) === 0;

        const vs = vG[i] * (1 / 4096);
        const bas = synG[i] * (1 / 2048);
        const obl = oblG[i] * (1 / 2048);
        const ap = apG[i] * (1 / 2048);
        let isyn = bas;

        if (isPyr) {
          // Discrete basal NMDA spine-cluster electrogenesis + oblique collateral + apical HCN sag + Larkum Ca_v BAC burst
          let nmdaBoost = 0;
          if (bas > 0.14) {
            const pUnblock = 1 / (1 + 0.28 * Math.exp(-3.2 * bas));
            const nOpenSpine = sampleBinomialInt(80, Math.min(0.95, (bas - 0.14) * pUnblock * 1.35), u32);
            nmdaBoost = 0.20 * (nOpenSpine / 80);
            if (nOpenSpine > 4) nNmda++;
          }
          const iHCN = 0.08 * (0.28 - ap);
          let bac = 0;
          if ((bas > 0.12 || obl > 0.09 || vs > 0.56) && ap > 0.05) {
            bac = achGain * Math.min(0.85, 1.75 * (bas + 0.25 * obl + 0.3 * ap));
            if (bac > 0.05) nPlat++;
          }
          isyn = (bas + 0.32 * obl + nmdaBoost + 0.42 * (ap + iHCN) + bac) * G[rk];
        } else {
          isyn = bas * G[rk];
        }

        const I = (SB[rk] + ext[i] + RB[rk] + isyn + nz) * gainNE;
        // Unpack discrete integer Markov channel counts (255-scale AIS Na_v inactivated & K_v open pools)
        const gt = gateG[i];
        let nNaI = (gt >>> 8) & 255;
        let nKO = gt & 255;
        const nAvailNa = 255 - nNaI;
        const mInf = isPyr ? (0.5 + 0.5 * ((vs - 0.64) * 5.5) / (1 + Math.abs((vs - 0.64) * 5.5))) : 0;
        const nOpenNa = isPyr ? sampleBinomialInt(nAvailNa, mInf * mInf * mInf, u32) : 0;
        const hTarget = vs < 0.5 ? 0.86 : 0.22;
        const kTarget = vs > 0.45 ? 0.33 : 0.01;
        nNaI = clamp(
          nNaI + sampleBinomialInt(nAvailNa, (1 - hTarget) * 0.26, u32 >>> 3) - sampleBinomialInt(nNaI, hTarget * 0.26, u32 >>> 7),
          3,
          248
        );
        nKO = clamp(
          nKO + sampleBinomialInt(255 - nKO, kTarget * 0.30, u32 >>> 5) - sampleBinomialInt(nKO, (1 - kTarget) * 0.30, u32 >>> 9),
          0,
          250
        );
        if (isPyr && (i & 1023) === 0) { openNaSum += nOpenNa * (600 / 255); openKSum += nKO * (400 / 255); openCnt++; }

        const iIon = isPyr ? (0.28 * (nOpenNa / 255) * (2.0 - vs) - 0.30 * (nKO / 255) * (vs + 0.25)) : 0;
        const nv = vs + (dtG / 0.015) * (I + iIon - vs);

        // Mirror representative cortical cell across all 16 compartments into oscilloscope preview buffer
        if ((i & 4095) === 1024 && rk === 2) {
          const wIdx = (i >>> 12) & 4095;
          this.v[wIdx] = nv;
          this.vAIS[wIdx] = nv * 1.08;
          this.vCollat0[wIdx] = nv * 0.72;
          this.vCollat1[wIdx] = nv * 0.54;
          this.vBasal[wIdx] = bas;
          this.vBasalL1[wIdx] = bas * 0.92;
          this.vBasalR[wIdx] = bas * 0.85;
          this.vBasalR1[wIdx] = bas * 0.78;
          this.vOblique[wIdx] = obl;
          this.vObliqueR[wIdx] = obl * 0.88;
          this.vTrunk[wIdx] = 0.65 * ap;
          this.vTrunkDist[wIdx] = 0.82 * ap;
          this.apical[wIdx] = ap;
          this.vTuftA1[wIdx] = ap * 0.94;
          this.vTuftB[wIdx] = ap * 0.90;
          this.vTuftB1[wIdx] = ap * 0.84;
        }

        if (nv > 1.0) {
          vG[i] = 0;
          nNaI = Math.min(248, nNaI + ((255 - nNaI) >> 1));
          nKO = Math.min(245, nKO + 48);
          apG[i] = clamp((ap + 0.04) * 1650, -16384, 16383);
          spk[i] = 1;
          rate[i] = rate[i] * drG + inv15G;
          if (nSheetSpk < this.prevSheetSpk.length) this.prevSheetSpk[nSheetSpk++] = i;
          if (nSpk < spkList.length) spkList[nSpk++] = i;

          // Deliver spike across 8 plastic Int8 dendritic branch clusters x 10 laminar/horizontal spines = 80 spines/cell (1.13B total!)
          const wBase = i * 8;
          const inh = typeOf(i) !== 0;
          const sign = inh ? -13 : 9;
          const nSpan = sh1 - sh0;
          const sMask = maskG[i];
          for (let cl = 0; cl < 8; cl++) {
            if (((sMask >>> cl) & 1) === 0) continue;
            const wInt = wG[wBase + cl];
            let dst;
            if (cl < 4) {
              const stepOff = cl === 0 ? 1 : cl === 1 ? SIDE_CTX : cl === 2 ? (nSpan - 1) : (nSpan - SIDE_CTX);
              dst = sh0 + ((i - sh0 + stepOff) % nSpan);
            } else {
              dst = sh0 + ((Math.imul(i + cl * 7919, 2654435761) >>> 7) % nSpan);
            }
            const deltaQ = (sign * wInt) >> 4;
            if ((cl === 6 || cl === 7) && !inh) apG[dst] = clamp(apG[dst] + deltaQ, -16384, 16383);
            else if (cl === 4 || cl === 5) oblG[dst] = clamp(oblG[dst] + deltaQ, -16384, 16383);
            else synG[dst] = clamp(synG[dst] + deltaQ, -16384, 16383);

            if (stdpOn && !inh && (cl === 4 || cl === 6) && (i & 31) === 0) {
              const postActive = rate[dst] > 7.5 ? 1 : -1;
              const nw = clamp(wInt + (dDA >= 0 ? postActive : -postActive), 12, 124);
              if (nw !== wInt) { wG[wBase + cl] = nw; this.stdpEvents++; }
            }
          }
        } else {
          vG[i] = clamp(nv * 4096, -6144, 4095);
          rate[i] *= drG;
          synG[i] = (synG[i] * 205) >> 8;
          oblG[i] = (oblG[i] * 212) >> 8;
          apG[i] = (apG[i] * 226) >> 8;
        }
        gateG[i] = (nNaI << 8) | nKO;
      }
      this.nPrevSheetSpk = nSheetSpk;
      this.plateauBursts = 0.9 * this.plateauBursts + 0.1 * nPlat;
      this.nmdaSpikes = 0.9 * this.nmdaSpikes + 0.1 * nNmda;
      if (openCnt > 0) {
        this.markovOpenNaMean = 0.9 * this.markovOpenNaMean + 0.1 * (openNaSum / openCnt);
        this.markovOpenKMean = 0.9 * this.markovOpenKMean + 0.1 * (openKSum / openCnt);
      }
    }

    // 3) Explicit CSR delivery (sensory -> thal, ctx/hip -> str/mot, str -> mot, etc.)
    const out0 = this.out0, post = this.post, W = this.w, pl = this.plastic, elig = this.elig;
    const stdpOn = !this.lesion.stdp;
    const Ap = 0.01 * this.ctxPlasticGain;
    for (let k = 0; k < nSpk; k++) {
      const i = spkList[k];
      const a = out0[i], b = out0[i + 1];
      for (let s = a; s < b; s++) {
        const j = post[s], ws = W[s];
        if (j < R0.THAL) {
          this.subSyn[j] += ws;
        } else if (j >= R0.STR) {
          const sj = R0.THAL + (j - R0.STR);
          this.subSyn[sj] += ws;
          if (stdpOn && pl[s] && this.subXpost[sj] > 0.002) {
            elig[s] -= Ap * this.subXpost[sj];
            this.touch(s);
          }
        } else if (!delegated && this.synGiga) {
          this.synGiga[j] = clamp(this.synGiga[j] + ((ws * 2048) | 0), -16384, 16383);
        }
      }
    }

    this.rngState = rng >>> 0;
    this.spikes = nSpk;
    this.t += dt;
  }

  /**
   * One integration step of dt seconds (2 ms base; impulse-invariant multi-rate sheet step on L..MEGA; 1.13B spine-cluster wave on GIGA).
   * Integrates 16-compartment branched cable arbours (AIS + Soma + Collat0/1 + BasalL0/L1/R0/R1 + ObliqueL/R + TrunkProx/Dist + TuftA0/A1/B0/B1)
   * with exact discrete integer Gillespie/binomial Markov-chain ion-channel state transitions (Na_v C0-C1-C2-O-I, K_v C0-C1-C2-O, Ca_v C-O-I)!
   */
  step(dt) {
    if (this.isGiga) {
      this._stepGiga(dt);
      return;
    }
    const N = this.N, v = this.v, vAIS = this.vAIS, vCol0 = this.vCollat0, vCol1 = this.vCollat1, syn = this.syn;
    const vBasalL0 = this.vBasal, vBasalL1 = this.vBasalL1, vBasalR0 = this.vBasalR, vBasalR1 = this.vBasalR1;
    const vObliqueL = this.vOblique, vObliqueR = this.vObliqueR, vTrunk = this.vTrunk, vTrunkDist = this.vTrunkDist;
    const vTuftA0 = this.apical, vTuftA1 = this.vTuftA1, vTuftB0 = this.vTuftB, vTuftB1 = this.vTuftB1;
    const nNaI = this.nNaI, nNaO = this.nNaO, nKO = this.nKO, nCaO = this.nCaO, nCaI = this.nCaI;
    const hNa = this.hNa, nK = this.nK, hHCN = this.hHCN, mSK = this.mSK, ad = this.ad, ref = this.ref;
    const ext = this.ext, vBias = this.vBias, jolt = this.jolt, rate = this.rate, xpre = this.xpre, xpost = this.xpost;
    const spk = this.spk, spkList = this.spkList, tauM = this.tauM, adInc = this.adInc, nm = this.nm;
    const SB = this.sheetBaseExt;

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
    const doblS = Math.exp(-dtS / 0.010);
    const dtrkS = Math.exp(-dtS / 0.014);
    const dapS = Math.exp(-dtS / 0.018);
    const dcolS = Math.exp(-dtS / (0.006 * this.myelinGain));
    const drS = stride === 1 ? dr : Math.exp(-dtS / 0.15);
    const dtrS = stride === 1 ? dtr : Math.exp(-dtS / 0.02);
    const daS = stride === 1 ? da : Math.exp(-dtS / 0.3);

    // Discrete Markov transition hazard factors over dtS: Na_v (5ms), K_v (4ms), Ca_v (12ms), Trunk HCN I_h (35ms), Tuft SK (45ms)
    const dHNa = Math.exp(-dtS / 0.005);
    const dNK = Math.exp(-dtS / 0.004);
    const dCa = Math.exp(-dtS / 0.012);
    const dHCN = Math.exp(-dtS / 0.035);
    const dSK = Math.exp(-dtS / 0.045);
    const hazNa = 1 - dHNa;
    const hazK = 1 - dNK;
    const hazCa = 1 - dCa;

    const strideScale = stride === 2 ? 0.80 : 1;
    const kSynS = stride === 1 ? 1 : ((0.00606648 * (1 - dsS)) / dtS) * strideScale;
    const kBasS = stride === 1 ? 1 : ((0.00904160 * (1 - dbasS)) / dtS) * strideScale;
    const kApS = stride === 1 ? 1 : ((0.01901850 * (1 - dapS)) / dtS) * strideScale;

    const gainNE = 1 + 0.6 * (nm.NE - 0.3);
    const noiseSub = this.noise * (1 + nm.NE) * Math.sqrt(dt / 0.002) * (1.7320508 / 65535);
    const noiseSh = stride === 1 ? noiseSub : noiseSub / Math.sqrt(stride);
    const mn0 = R0.MN, mn1 = R0.MN + RN.MN, mot0 = R0.MOT, mot1 = R0.MOT + RN.MOT;
    const ctx0 = R0.CTX, ctx1 = R0.CTX + RN.CTX;
    const lesMot = this.lesion.mot, atonia = this.atonia, achGain = 0.35 + 0.4 * nm.ACh;

    const G = this.regGain, RB = this.regBias;
    for (let k = 0; k < REGIONS.length; k++) G[k] = this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[k];

    let rng = this.rngState | 0;
    let nSpk = 0, nSheetSpk = 0, nPlat = 0, nNmda = 0, sagSum = 0, skSum = 0, chNzSum = 0, sagCnt = 0;
    let openNaSum = 0, openKSum = 0, openCaSum = 0;
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
        // 16-Compartment Branched Pyramidal Dendritic Cable Arbour:
        //   Comp 4..7 (BasalL0/L1, BasalR0/R1): 4 basal sister branches with discrete Mg2+-unblocked NMDA spine channels (N_NMDA = 80)
        const bL = (vBasalL0[i] + vBasalL1[i]) * kBasS;
        const bR = (vBasalR0[i] + vBasalR1[i]) * kBasS;
        let nmdaL = 0, nmdaR = 0;
        if (bL > 0.14) {
          const pMgL = 1 / (1 + 0.28 * Math.exp(-3.4 * bL));
          const nOpenL = sampleBinomialInt(80, Math.min(0.96, (bL - 0.14) * pMgL * 1.4), u32);
          nmdaL = 0.16 * (nOpenL / 80);
          if (nOpenL > 3) nNmda++;
        }
        if (bR > 0.14) {
          const pMgR = 1 / (1 + 0.28 * Math.exp(-3.4 * bR));
          const nOpenR = sampleBinomialInt(80, Math.min(0.96, (bR - 0.14) * pMgR * 1.4), u32 >>> 3);
          nmdaR = 0.16 * (nOpenR / 80);
          if (nOpenR > 3) nNmda++;
        }
        const bas = bL + bR + nmdaL + nmdaR;

        //   Comp 8..9 (ObliqueL/R) + Comp 12..15 (TuftA0/A1/B0/B1) -> Comp 11 (Distal Nexus Ca_v) -> Comp 10 (Proximal HCN Trunk)
        const obl = (vObliqueL[i] + vObliqueR[i]) * kBasS;
        const tuft = 0.55 * ((vTuftA0[i] + vTuftA1[i] + vTuftB0[i] + vTuftB1[i]) * kApS);
        const trkDist = vTrunkDist[i] * dtrkS + (1 - dtrkS) * (0.68 * tuft + 0.22 * obl + 0.10 * v[i]);
        vTrunkDist[i] = trkDist;
        const trk = vTrunk[i] * dtrkS + (1 - dtrkS) * (0.64 * trkDist + 0.24 * obl + 0.12 * v[i]);
        vTrunk[i] = trk;

        const zHcn = (-0.10 - trk) * 3.8;
        const hcnInf = 0.5 + (0.5 * zHcn) / (1 + (zHcn < 0 ? -zHcn : zHcn));
        const hc = hcnInf + (hHCN[i] - hcnInf) * dHCN;
        hHCN[i] = hc;
        const iHCN = 0.11 * hc * (0.30 - trk);

        // Discrete 3-state Markov Ca_v (C <-> O <-> I, N_Ca = 160) in Distal Nexus (Comp 11)
        let bac = 0, caDrive = 0;
        let curCaO = nCaO[i], curCaI = nCaI[i];
        const curCaC = Math.max(0, 160 - curCaO - curCaI);
        if ((bas > 0.10 || obl > 0.08 || v[i] > 0.56) && tuft > 0.045) {
          const zCa = (tuft + 0.28 * trkDist + 0.24 * v[i] - 0.17) * 5.0;
          const mCa = 0.5 + (0.5 * zCa) / (1 + (zCa < 0 ? -zCa : zCa));
          const pCaOpen = mCa * mCa;
          const dOpen = sampleBinomialInt(curCaC, pCaOpen * hazCa * 1.4, u32 >>> 2);
          const dClose = sampleBinomialInt(curCaO, (1 - pCaOpen) * hazCa, u32 >>> 5);
          const dInact = sampleBinomialInt(Math.max(0, curCaO - dClose), 0.12 * hazCa, u32 >>> 7);
          curCaO = clamp(curCaO + dOpen - dClose - dInact, 0, 160);
          curCaI = clamp(curCaI + dInact - sampleBinomialInt(curCaI, 0.20 * hazCa, u32 >>> 9), 0, 160 - curCaO);
          caDrive = curCaO * (1 / 160);
          bac = achGain * Math.min(0.95, 2.25 * caDrive * (Math.max(0.02, bas - 0.06) + 0.26 * tuft));
          if (bac > 0.04) nPlat++;
        } else {
          const dClose = sampleBinomialInt(curCaO, 0.55 * hazCa, u32 >>> 4);
          const dRec = sampleBinomialInt(curCaI, 0.28 * hazCa, u32 >>> 8);
          curCaO = Math.max(0, curCaO - dClose);
          curCaI = Math.max(0, curCaI - dRec);
          caDrive = curCaO * (1 / 160);
        }
        nCaO[i] = curCaO;
        nCaI[i] = curCaI;

        // Rush-Larsen SK Ca2+-activated K+ afterhyperpolarization channel in TuftB1 (Comp 15)
        const skInf = caDrive / (caDrive + 0.35);
        const sk = skInf + (mSK[i] - skInf) * dSK;
        mSK[i] = sk;
        const iSK = 0.16 * sk * (trk + 0.35);

        if ((i & 63) === 0) { sagSum += hc; skSum += sk; openCaSum += curCaO; sagCnt++; }
        const apEff = trk + 0.28 * obl + iHCN - iSK + 0.05 * vCol0[i];
        isyn = (syn[i] * kSynS + bas + 0.46 * (apEff < -0.5 ? -0.5 : apEff) + bac) * G[rk];
      } else {
        isyn = syn[i] * (inSheet ? kSynS : 1) * G[rk];
      }

      let I = SB[rk] + ext[i] + RB[rk] + vBias[i] + isyn + nz + jolt[i];
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
          const dRecRef = sampleBinomialInt(nNaI[i], 0.88 * hazNa, u32 >>> 3);
          nNaI[i] = Math.max(12, nNaI[i] - dRecRef);
          nNaO[i] = 0;
          nKO[i] = Math.max(1, nKO[i] - sampleBinomialInt(nKO[i], 0.85 * hazK, u32 >>> 6));
          hNa[i] = 1 - nNaI[i] * (1 / 600);
          nK[i] = Math.sqrt(Math.sqrt(nKO[i] * (1 / 400)));
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
          // Comp 0 (AIS) <-> Comp 1 (Soma): Exact Discrete Integer Gillespie/Binomial 5-State Na_v (C0-C1-C2-O-I, N=600)
          // & 4-State K_v (C0-C1-C2-O, N=400) Markov Channel Kinetics!
          const vs = v[i], va = 0.64 * vs + 0.36 * vAIS[i];
          const zm = (va - 0.66) * 6.5;
          const mInf = 0.5 + (0.5 * zm) / (1 + (zm < 0 ? -zm : zm));
          const m3 = mInf * mInf * mInf;

          let curNaI = nNaI[i];
          const nAvailNa = 600 - curNaI;
          const curNaO = sampleBinomialInt(nAvailNa, m3, u32);
          nNaO[i] = curNaO;

          let curKO = nKO[i];
          const openFracNa = curNaO * (1 / 600);
          const openFracK = curKO * (1 / 400);
          const iNa = 0.34 * openFracNa * (2.1 - va);
          const iK = 0.38 * openFracK * (va + 0.28);

          const zh = (0.50 - va) * 5.2;
          const hInf = 0.5 + (0.5 * zh) / (1 + (zh < 0 ? -zh : zh));
          const zn = (va - 0.46) * 4.8;
          const nInf = 0.5 + (0.5 * zn) / (1 + (zn < 0 ? -zn : zn));
          const pKTgt = nInf * nInf * nInf * nInf;

          // Discrete integer Markov transitions across C/O <-> I (Na_v) and C <-> O (K_v)
          const dNaInact = sampleBinomialInt(nAvailNa, (1 - hInf) * hazNa, u32 >>> 4);
          const dNaRec = sampleBinomialInt(curNaI, hInf * hazNa, u32 >>> 8);
          const nextNaI = clamp(curNaI + dNaInact - dNaRec, 6, 588);

          const dKOpen = sampleBinomialInt(400 - curKO, pKTgt * hazK, u32 >>> 6);
          const dKClose = sampleBinomialInt(curKO, (1 - pKTgt) * hazK, u32 >>> 11);
          const nextKO = clamp(curKO + dKOpen - dKClose, 0, 396);

          if ((i & 63) === 0) {
            chNzSum += Math.abs(nextNaI - curNaI) * (1 / 600) + Math.abs(nextKO - curKO) * (1 / 400);
            openNaSum += curNaO;
            openKSum += curKO;
          }
          nNaI[i] = nextNaI;
          nKO[i] = nextKO;
          hNa[i] = 1 - nextNaI * (1 / 600);
          nK[i] = Math.sqrt(Math.sqrt(nextKO * (1 / 400)));

          const nv = vs + aMem * (I + 0.65 * (iNa - iK) - ad[i] - vs);
          const nva = va + Math.min(0.95, aMem * 1.25) * (I + iNa - iK - ad[i] - va);

          if (nva > 1.0 || nv > 1.0) {
            v[i] = 0;
            vAIS[i] = -0.10;
            nNaI[i] = clamp(nextNaI + Math.round((600 - nextNaI) * 0.65), 12, 592);
            nKO[i] = Math.min(388, nextKO + 96);
            hNa[i] = 1 - nNaI[i] * (1 / 600);
            nK[i] = Math.sqrt(Math.sqrt(nKO[i] * (1 / 400)));
            // Orthodromic invasion into Comp 2..3 (Axon Collaterals) + Backpropagating AP (bAP) up Trunk -> Nexus -> Obliques -> L1 Tufts!
            vCol0[i] += 0.085 * this.myelinGain;
            vCol1[i] += 0.055 * this.myelinGain;
            vTrunk[i] += 0.042;
            vTrunkDist[i] += 0.035;
            vObliqueL[i] += 0.014;
            vObliqueR[i] += 0.012;
            vTuftA0[i] += 0.015;
            vTuftA1[i] += 0.013;
            vTuftB0[i] += 0.014;
            vTuftB1[i] += 0.012;
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
        vCol0[i] *= dcolS;
        vCol1[i] *= dcolS;
        vBasalL0[i] *= dbasS;
        vBasalL1[i] *= dbasS;
        vBasalR0[i] *= dbasS;
        vBasalR1[i] *= dbasS;
        vObliqueL[i] *= doblS;
        vObliqueR[i] *= doblS;
        vTuftA0[i] *= dapS;
        vTuftA1[i] *= dapS;
        vTuftB0[i] *= dapS;
        vTuftB1[i] *= dapS;
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
      this.nmdaSpikes = 0.9 * this.nmdaSpikes + 0.1 * nNmda;
      if (sagCnt > 0) {
        this.ihSagMean = 0.9 * this.ihSagMean + 0.1 * (sagSum / sagCnt);
        this.ihMean = this.ihSagMean;
        this.skMean = 0.9 * this.skMean + 0.1 * (skSum / sagCnt);
        this.channelNoiseMean = 0.9 * this.channelNoiseMean + 0.1 * (chNzSum / sagCnt);
        this.markovOpenNaMean = 0.9 * this.markovOpenNaMean + 0.1 * (openNaSum / sagCnt);
        this.markovOpenKMean = 0.9 * this.markovOpenKMean + 0.1 * (openKSum / sagCnt);
        this.markovOpenCaMean = 0.9 * this.markovOpenCaMean + 0.1 * (openCaSum / sagCnt);
      }
    }

    // 1) Explicit CSR spike delivery across all 16 branched compartments + BCM STDP eligibility
    const stdpOn = !this.lesion.stdp, homeoOn = !this.lesion.homeo;
    const Ap = 0.01 * this.ctxPlasticGain, Am = 0.0102 * this.ctxPlasticGain;
    const out0 = this.out0, post = this.post, W = this.w, pl = this.plastic, comp = this.comp;
    const inc0 = this.inc0, incIdx = this.incIdx, preA = this.pre, elig = this.elig;

    for (let k = 0; k < nSpk; k++) {
      const i = spkList[k];
      const a = out0[i], b = out0[i + 1];
      for (let s = a; s < b; s++) {
        const j = post[s], ws = W[s], c = comp[s];
        if (c === 1) vBasalL0[j] += ws;
        else if (c === 6) vBasalL1[j] += ws;
        else if (c === 3) vBasalR0[j] += ws;
        else if (c === 7) vBasalR1[j] += ws;
        else if (c === 4) vObliqueL[j] += ws;
        else if (c === 8) vObliqueR[j] += ws;
        else if (c === 2) vTuftA0[j] += ws;
        else if (c === 9) vTuftA1[j] += ws;
        else if (c === 5) vTuftB0[j] += ws;
        else if (c === 10) vTuftB1[j] += ws;
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
   * Cache-free 16-synapse procedural canonical laminar + small-world propagation across 16-compartment arbours on MEGA.
   */
  deliverProceduralStencil(nSpk, stdpOn) {
    const spkList = this.spkList, vBasalL0 = this.vBasal, vBasalL1 = this.vBasalL1;
    const vBasalR0 = this.vBasalR, vBasalR1 = this.vBasalR1, vObliqueL = this.vOblique, vObliqueR = this.vObliqueR;
    const vTuftA0 = this.apical, vTuftA1 = this.vTuftA1, vTuftB0 = this.vTuftB, vTuftB1 = this.vTuftB1, syn = this.syn;
    const wProc = this.wProc, rate = this.rate, dDA = this.nm.DA - 0.3;
    const th0 = R0.THAL, ctx0 = R0.CTX, ctx1 = R0.CTX + RN.CTX, hip0 = R0.HIP, hip1 = R0.HIP + RN.HIP;
    const nCtx = RN.CTX, nHip = RN.HIP, sideCtx = SZ.side;

    for (let k = 0; k < nSpk; k++) {
      const i = spkList[k];
      if (i < th0 || i >= hip1) continue;
      const wp = wProc[i];

      if (i < ctx0) {
        const base = Math.min(nCtx - 17, Math.floor(((i - th0) / RN.THAL) * nCtx));
        const ws = 0.26 * wp;
        for (let t = 0; t < 16; t++) {
          const J = ctx0 + ((base + t * 61) % nCtx);
          if (t & 1) vBasalL1[J] += ws; else vBasalL0[J] += ws;
        }
      } else if (i < ctx1) {
        const rel = i - ctx0;
        const tp = TYPE[i], lay = LAYER[i];
        const ws = (tp !== 0 ? -0.115 : 0.064) * wp;
        const ix = rel % sideCtx, iy = (rel / sideCtx) | 0;
        for (let t = 0; t < 12; t++) {
          let nx = ix + STENCIL_DX[t], ny = iy + STENCIL_DY[t];
          if (nx < 0) nx += sideCtx; else if (nx >= sideCtx) nx -= sideCtx;
          if (ny < 0) ny += sideCtx; else if (ny >= sideCtx) ny -= sideCtx;
          const J = ctx0 + ny * sideCtx + nx;
          if (tp === 2 || (tp === 0 && lay === 3 && LAYER[J] === 2)) {
            if ((t & 3) === 0) vTuftA0[J] += ws;
            else if ((t & 3) === 1) vTuftA1[J] += ws;
            else if ((t & 3) === 2) vTuftB0[J] += ws;
            else vTuftB1[J] += ws;
          } else if (tp === 1) {
            syn[J] += ws;
          } else if (t >= 8 && lay === 2) {
            if (t & 1) vObliqueR[J] += ws; else vObliqueL[J] += ws;
          } else if ((t & 3) === 0) {
            vBasalL0[J] += ws;
          } else if ((t & 3) === 1) {
            vBasalL1[J] += ws;
          } else if ((t & 3) === 2) {
            vBasalR0[J] += ws;
          } else {
            vBasalR1[J] += ws;
          }
        }
        if (tp === 0) {
          for (let h = 1; h <= 3; h++) {
            const J = ctx0 + (((Math.imul(rel + h * 7919, 2654435761) >>> 8)) % nCtx);
            if (h & 1) vBasalR0[J] += ws * 0.85; else vBasalR1[J] += ws * 0.85;
          }
          const Jh = hip0 + (((Math.imul(rel + 13, 1597334677) >>> 9)) % nHip);
          syn[Jh] += 0.055 * wp;
          if (stdpOn && (k & 7) === 0) {
            wProc[i] = clamp(wp + 0.002 * dDA * (rate[Jh] > 6 ? 1 : -0.3), 0.35, 1.85);
            this.stdpEvents++;
          }
        }
      } else {
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
            if (h === 0) vTuftA0[J] += 0.058 * wp;
            else if (h === 1) vTuftA1[J] += 0.058 * wp;
            else if (h === 2) vTuftB0[J] += 0.058 * wp;
            else vTuftB1[J] += 0.058 * wp;
          }
        }
      }
    }
  }

  astroGain(i) { return this.lesion.astro ? 1 : 0.8 + 0.6 * this.astro[regionOf(i)]; }

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
        const st = cnt > 2000000 ? 256 : cnt > 200000 ? 16 : 4;
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
      if (!this.isGiga && !this.lesion.homeo) {
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

  /** Hebbian activity-dependent structural plasticity (including 16-compartment dendritic spine-cluster turnover on GIGA!) */
  rewire() {
    if (this.isGiga) {
      if (!this.wGiga) return;
      const ctx0 = R0.CTX, nCtx = RN.CTX, r = this.r, wG = this.wGiga, maskG = this.spineMaskGiga;
      let changed = 0;
      for (let q = 0; q < 128; q++) {
        const i = ctx0 + Math.floor(r() * nCtx);
        if (typeOf(i) === 0) {
          const cl = q & 7;
          const idx = i * 8 + cl;
          if (this.rate[i] > 8 && wG[idx] < 98) {
            wG[idx] = Math.min(120, wG[idx] + 4);
            if (maskG) maskG[i] |= (1 << cl);
            this.pruned++;
            this.grown++;
            changed++;
          } else if (this.rate[i] < 0.5 && wG[idx] < 24 && maskG) {
            // Prune silent dendritic spine cluster & sprout replacement cluster
            maskG[i] = (maskG[i] & ~(1 << cl)) | (1 << ((cl + 3) & 7));
            wG[i * 8 + ((cl + 3) & 7)] = 64;
            this.pruned++;
            this.grown++;
            changed++;
          }
        }
      }
      this.lastRewired = changed;
      return;
    }
    if (this.procStencil) {
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
    if (this.isGiga) {
      if (!this.wGiga) return 1.0;
      const ctx0 = R0.CTX, nCtx = RN.CTX, sideCtx = SZ.side, wG = this.wGiga;
      let a = 0, n = 0, m = 0, k = 0;
      for (let idx = 0; idx < nCtx; idx += 1024) {
        const I = ctx0 + idx;
        if (typeOf(I) !== 0) continue;
        const rI = this.rate[I];
        m += rI; k++;
        const J = ctx0 + ((idx + 1) % sideCtx) + Math.floor(idx / sideCtx) * sideCtx;
        if (typeOf(J) === 0) { a += rI * this.rate[J] * (wG[I * 8] / 64); n++; }
      }
      m /= k || 1;
      return n && m > 0 ? a / n / (m * m) : 1.0;
    }
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
