// Primate-Acuity Log-Polar Foveated Binocular Visual Hierarchy (Dual 256x128 Retinas = 65,536 Photoreceptors / 196,608 L/M/S+Rod Channels
// -> 6 Retinal Ganglion Cell Mosaics -> Parvo/Magno/Konio LGN -> V1 Gabor -> V2 Curvature/Junctions -> V4 32x16 Max-Pooling
// -> 65,536-Concept Compositional IT/PRh grounded in a 4-Tier Symbolic Hypernym & Relational Affordance Ontology + MT Flow + EKF-SLAM).
//
// Pass 19 upgrades:
//  1) 4x higher photoreceptor count over pass 18 (113.8x over pass 16): Dual 256x128 Left/Right sheets (32,768 per eye = 65,536 receptors /
//     196,608 L/M/S cone + scotopic rod signals + inverse-depth) with primate log-polar foveal magnification and 4 Hz microsaccades.
//  2) 6 Explicit Primate Retinal Ganglion Cell (RGC) Mosaics (196,608 RGC channels):
//       - P-ON & P-OFF Midget RGCs (sustained L-M / M-L chromatic acuity),
//       - M-ON & M-OFF Parasol RGCs (transient broadband increment/looming decrement DoG),
//       - Small Bistratified Koniocellular RGCs (S - (L+M) blue-yellow opponency),
//       - Intrinsically photosensitive Melanopsin ipRGCs (480 nm ambient irradiance / circadian drive).
//  3) High-res 32x16x8 V4 + 32x16x3 (1,536-D) foveal RGB patch (`fovealPatch`) feeding the 2-Stage Spatial-Pyramid Patch-VAE + Flow World Model.
//  4) 256 Shape x 256 Attribute = 65,536 Compositional IT/Perirhinal Concepts grounded in a 4-Tier Symbolic Hypernym & Relational
//     Affordance Ontology DAG (`ONTOLOGY_DAG`: Root -> Domain -> Taxon -> Morphotype + proto-lexical symbols & Subject-Predicate-Object scene triples).
import { clamp, gauss, mulberry } from './util.js';
import { NS, CH } from './body.js';

export const NBINS = 32;
export const W_RET = 256;
export const H_RET = 128;
export const W_LGN = 128;
export const H_LGN = 64;
export const W_V1 = 64;
export const H_V1 = 32;
export const W_V2 = 32;
export const H_V2 = 16;
export const W_V4 = 32;
export const H_V4 = 16;
export const N_ORI = 4; // 0, 45, 90, 135 deg
export const N_IT = 64; // 64 cortical IT summary columns (32 form + 32 attribute marginals; product space = 256 x 256 = 65,536 concepts!)
export const N_IT_SHAPE = 256;
export const N_IT_ATTR = 256;
export const N_IT_CONCEPTS = N_IT_SHAPE * N_IT_ATTR; // 65,536 compositional zero-shot visual concepts
export const N_VIS_PATCH = W_V4 * H_V4 * 3; // 1,536-D (32x16x3) foveal RGB pixel patch for Patch-VAE + Flow world model
export const FOV = (260 * Math.PI) / 180;
export const VFOV = (110 * Math.PI) / 180;
export const STEREO_RANGE = 9.0;
export const HORIZON_RANGE = 26;

// 4-Tier Grounded Symbolic Hypernym & Relational Affordance Ontology DAG:
// Affordance vector order: [edible, potable, hazard, social, shelter, graspable]
export const ONTOLOGY_DAG = {
  tiers: ['Root', 'Domain', 'Taxon', 'Morphotype'],
  affordanceAxes: ['edible', 'potable', 'hazard', 'social', 'shelter', 'graspable'],
  synsets: [
    { id: 0,  lexeme: 'MINT-BULB',        hypernyms: ['Entity', 'Biotic.Autotroph',   'Flora.NectarBearing',   'Morph.SpheroidBulb'],   aff: [0.94, 0.18, 0.02, 0.00, 0.15, 0.38] },
    { id: 1,  lexeme: 'MAGENTA-CHALICE',  hypernyms: ['Entity', 'Biotic.Autotroph',   'Flora.NectarBearing',   'Morph.PrismChalice'],   aff: [0.91, 0.22, 0.04, 0.00, 0.20, 0.34] },
    { id: 2,  lexeme: 'CYAN-FROND',       hypernyms: ['Entity', 'Biotic.Autotroph',   'Flora.NectarBearing',   'Morph.SpireFrond'],     aff: [0.88, 0.25, 0.03, 0.00, 0.28, 0.30] },
    { id: 3,  lexeme: 'AMBER-STARPOD',    hypernyms: ['Entity', 'Biotic.Autotroph',   'Flora.NectarBearing',   'Morph.ThornStarpod'],   aff: [0.92, 0.12, 0.14, 0.00, 0.14, 0.36] },
    { id: 4,  lexeme: 'DORMANT-STALK',    hypernyms: ['Entity', 'Biotic.Autotroph',   'Flora.Vegetative',      'Morph.WoodyStalk'],     aff: [0.22, 0.06, 0.02, 0.00, 0.35, 0.42] },
    { id: 5,  lexeme: 'KIN-CONSPECIFIC',  hypernyms: ['Entity', 'Biotic.Heterotroph', 'Agent.Conspecific',     'Morph.CladePeer'],      aff: [0.00, 0.00, 0.10, 0.95, 0.12, 0.05] },
    { id: 6,  lexeme: 'RIVAL-MORPH',      hypernyms: ['Entity', 'Biotic.Heterotroph', 'Agent.Conspecific',     'Morph.DivergentClade'], aff: [0.00, 0.00, 0.28, 0.72, 0.05, 0.04] },
    { id: 7,  lexeme: 'EGG-CLUTCH',       hypernyms: ['Entity', 'Biotic.Heterotroph', 'Agent.Brood',           'Morph.AmnioticOvoid'],  aff: [0.08, 0.00, 0.02, 0.84, 0.06, 0.55] },
    { id: 8,  lexeme: 'APEX-PREDATOR',    hypernyms: ['Entity', 'Biotic.Heterotroph', 'Agent.ApexPredator',    'Morph.LeviathanHunter'],aff: [0.00, 0.00, 0.98, 0.08, 0.00, 0.00] },
    { id: 9,  lexeme: 'SYMBIOTIC-MITE',   hypernyms: ['Entity', 'Biotic.Heterotroph', 'Agent.MicroFauna',      'Morph.PelagicMite'],    aff: [0.46, 0.04, 0.05, 0.18, 0.00, 0.62] },
    { id: 10, lexeme: 'BENTHIC-ISOPOD',   hypernyms: ['Entity', 'Biotic.Heterotroph', 'Agent.MicroFauna',      'Morph.Detritivore'],    aff: [0.52, 0.05, 0.04, 0.12, 0.00, 0.68] },
    { id: 11, lexeme: 'LIPID-MORSEL',     hypernyms: ['Entity', 'Biotic.Detritus',    'Resource.NutrientSnack','Morph.LipidGlobule'],   aff: [0.97, 0.08, 0.01, 0.00, 0.00, 0.88] },
    { id: 12, lexeme: 'SPRING-POOL',      hypernyms: ['Entity', 'Abiotic.Geosphere',  'Hydrology.FreshPool',   'Morph.ThermalBasin'],   aff: [0.04, 0.99, 0.08, 0.16, 0.30, 0.00] },
    { id: 13, lexeme: 'BASALT-MONOLITH',  hypernyms: ['Entity', 'Abiotic.Geosphere',  'Lithology.Obstacle',    'Morph.BasaltBoulder'],  aff: [0.00, 0.00, 0.42, 0.00, 0.78, 0.25] },
    { id: 14, lexeme: 'FUMAROLE-VENT',    hypernyms: ['Entity', 'Abiotic.Geosphere',  'Geothermal.BlackSmoker','Morph.SulfideChimney'], aff: [0.00, 0.10, 0.56, 0.05, 0.64, 0.00] },
    { id: 15, lexeme: 'OPEN-TERRAIN',     hypernyms: ['Entity', 'Abiotic.Geosphere',  'Topography.Horizon',    'Morph.RegolithPlain'],  aff: [0.02, 0.02, 0.03, 0.00, 0.10, 0.08] },
  ],
};

const HUE_RGB = [
  [0.22, 1.0, 0.62],
  [1.0, 0.24, 0.94],
  [0.24, 0.97, 1.0],
  [1.0, 0.69, 0.18],
];

// Log-polar foveated angle <-> retinal pixel mapping:
// Maps normalized angle a in [-0.5, +0.5] through sinh/asinh compression so central fovea has ~3.6x higher sampling density!
const FOV_K = 2.6;
const ASINH_HALF = Math.asinh(0.5 * FOV_K * 2); // asinh(2.6)
function angleToFoveaNorm(aNorm) {
  // aNorm in [-0.5, +0.5] -> pixel norm in [0, 1]
  return 0.5 + 0.5 * (Math.asinh(clamp(aNorm, -0.6, 0.6) * 2 * FOV_K) / ASINH_HALF);
}
const RET_AZ_NORM = new Float32Array(W_RET);
const RET_EL_NORM = new Float32Array(H_RET);
for (let px = 0; px < W_RET; px++) {
  const u = ((px + 0.5) / W_RET - 0.5) * 2; // [-1, 1]
  RET_AZ_NORM[px] = 0.5 * (Math.sinh(u * ASINH_HALF) / FOV_K);
}
for (let py = 0; py < H_RET; py++) {
  const v = (0.5 - (py + 0.5) / H_RET) * 2; // [+1 top .. -1 bottom]
  RET_EL_NORM[py] = 0.5 * (Math.sinh(v * ASINH_HALF) / FOV_K);
}

// Precompute 4-orientation 5x5 quadrature zero-DC 2D Gabor kernels
const GABOR_COS = new Float32Array(N_ORI * 25);
const GABOR_SIN = new Float32Array(N_ORI * 25);
{
  const sigma = 1.15, gamma = 0.75, lambda = 2.6;
  for (let o = 0; o < N_ORI; o++) {
    const th = (o * Math.PI) / N_ORI;
    const ct = Math.cos(th), st = Math.sin(th);
    let sumC = 0, normC = 0, normS = 0;
    const off = o * 25;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xp = dx * ct + dy * st;
        const yp = -dx * st + dy * ct;
        const env = Math.exp(-(xp * xp + gamma * gamma * yp * yp) / (2 * sigma * sigma));
        const ph = (2 * Math.PI * xp) / lambda;
        const k = off + (dy + 2) * 5 + (dx + 2);
        GABOR_COS[k] = env * Math.cos(ph);
        GABOR_SIN[k] = env * Math.sin(ph);
        sumC += GABOR_COS[k];
      }
    }
    const meanC = sumC / 25;
    for (let i = 0; i < 25; i++) {
      GABOR_COS[off + i] -= meanC;
      normC += GABOR_COS[off + i] ** 2;
      normS += GABOR_SIN[off + i] ** 2;
    }
    const scC = 1 / Math.sqrt(normC || 1), scS = 1 / Math.sqrt(normS || 1);
    for (let i = 0; i < 25; i++) {
      GABOR_COS[off + i] *= scC;
      GABOR_SIN[off + i] *= scS;
    }
  }
}

export class Retina {
  constructor(seed = 1, nSites = 16, nPools = 3) {
    this.r = mulberry(seed * 6151 + 19);
    this.nSites = nSites;
    this.nPools = nPools;

    // 1) Dual 256x128 Log-Polar Foveated Photoreceptor Sheets (32,768 L + 32,768 R = 65,536 receptors / 196,608 L/M/S+Rod channels)
    const NPX = W_RET * H_RET; // 32,768 per eye
    const NLGN = W_LGN * H_LGN; // 8,192 pooled thalamic relay cells per pathway
    this.nReceptors = NPX * 2;        // 65,536 photoreceptors
    this.nConeChannels = NPX * 6;     // 196,608 L/M/S cone + scotopic rod signals
    this.nGanglionAxons = NPX * 6;    // 196,608 retinal ganglion cell (RGC) output channels across 6 mosaics
    this.retL = new Float32Array(NPX * 3);
    this.retR = new Float32Array(NPX * 3);
    this.invDL = new Float32Array(NPX);
    this.invDR = new Float32Array(NPX);
    this.scotopicRod = new Float32Array(NPX);
    this.microPhase = 0;
    this.microsaccadeAz = 0;
    this.microsaccadeEl = 0;

    // 2) 6 Primate Retinal Ganglion Cell (RGC) Mosaics (256x128 each = 196,608 RGC channels) + 128x64 Thalamic LGN Relay
    this.lumCur = new Float32Array(NPX);
    this.lum2DPrev = new Float32Array(NPX);
    this.rgcMidgetON = new Float32Array(NPX);  // P-ON sustained L-M red-green center-surround
    this.rgcMidgetOFF = new Float32Array(NPX); // P-OFF sustained M-L green-red center-surround
    this.rgcParasolON = new Float32Array(NPX); // M-ON transient broadband luminance increment DoG
    this.rgcParasolOFF = new Float32Array(NPX);// M-OFF transient broadband luminance decrement / looming DoG
    this.rgcBistrat = new Float32Array(NPX);   // Koniocellular S - 0.5*(L+M) short-wavelength blue-yellow
    this.rgcIpRGC = new Float32Array(NPX);     // Melanopsin 480nm intrinsically photosensitive ambient irradiance
    this.ipRgcLux = 0.25;
    this.lgnMag = new Float32Array(NPX);       // Signed M-ON - M-OFF full-res 256x128 Magnocellular sheet
    this.lgnMag128 = new Float32Array(NLGN);   // 2x2 anti-aliased 128x64 LGN relay sheet driving V1 Gabor hypercolumns
    this.lumLgn128 = new Float32Array(NLGN);
    this.lumLgn128Prev = new Float32Array(NLGN);
    this.lgnRG = this.rgcMidgetON;             // Parvocellular compatibility alias
    this.lgnBY = this.rgcBistrat;              // Koniocellular compatibility alias

    // 3) V1 (64x32x4 = 8,192 orientation hypercolumns)
    const NV1 = W_V1 * H_V1;
    this.v1Simple = new Float32Array(NV1 * N_ORI);
    this.v1Complex = new Float32Array(NV1 * N_ORI);
    this.v1Disparity = new Float32Array(NV1);

    // 4) V2 (32x16x4 = 2,048 contour/junction cells: [smooth-curved, box-ortho, cone-acute, star-thorn])
    const NV2 = W_V2 * H_V2;
    this.v2Cells = new Float32Array(NV2 * 4);

    // 5) V4 (32x16x8 = 4,096 scale/translation-tolerant max-pooled part descriptors) + 1,536-D (32x16x3) Foveal RGB Patch
    const NV4 = W_V4 * H_V4;
    this.v4Map = new Float32Array(NV4 * 8);
    this.v4Orient = new Float32Array(N_ORI);
    this.v4Fovea = new Float32Array(8);
    this.v4 = this.v4Map;
    this.fovealPatch = new Float32Array(N_VIS_PATCH); // 32x16x3 (1,536-D) RGB pixel tensor for Patch-VAE + Flow WorldModel

    // 6) Compositional Product-Quantized Ventral IT + Perirhinal (PRh) Cortex (256 Shape x 256 Attr = 65,536 Concepts!)
    //    Grounded in the 4-Tier Symbolic Hypernym & Relational Affordance Ontology (`ONTOLOGY_DAG`)
    this.itShapeFeat = new Float32Array(16);
    this.itAttrFeat = new Float32Array(16);
    this.itFeat = new Float32Array(16);
    this.WitShape = new Float32Array(N_IT_SHAPE * 16);
    this.WitAttr = new Float32Array(N_IT_ATTR * 16);
    this.Wit = this.WitShape;
    this.itShapeAct = new Float32Array(N_IT_SHAPE);
    this.itAttrAct = new Float32Array(N_IT_ATTR);
    this.itShapeTrace = new Float32Array(N_IT_SHAPE);
    this.itAttrTrace = new Float32Array(N_IT_ATTR);
    this.itAct = new Float32Array(N_IT); // 64-column cortical summary (32 pooled form + 32 pooled attribute channels)
    this.itTrace = this.itShapeTrace;
    this._initITPrototypes();
    this.itConceptCapacity = N_IT_CONCEPTS; // 65,536 compositional concepts
    this.itActiveConcept = -1;
    this.itObservedConcepts = new Uint8Array(N_IT_CONCEPTS);
    this.itUniqueConceptsSeen = 0;
    this.itTopShape = -1;
    this.itTopAttr = -1;
    this.itTopCat = -1;
    this.itInvariance = 0.85;
    this._prevItVec = new Float32Array(N_IT);
    this._prevTopId = -1;

    // Grounded 4-Tier Symbolic Hypernym & Relational Affordance Ontology state
    this.ontologyDAG = ONTOLOGY_DAG;
    this.ontologySynset = ONTOLOGY_DAG.synsets[15];
    this.activeLexeme = 'OPEN-TERRAIN#c00000';
    this.hypernymPath = 'Entity > Abiotic.Geosphere > Topography.Horizon > Morph.RegolithPlain';
    this.affordanceVec = new Float32Array(ONTOLOGY_DAG.synsets[15].aff); // [edible, potable, hazard, social, shelter, graspable]
    this.sceneGraphTriples = [];

    // Dorsal MT 2D optic flow (on 64x32 V1 grid)
    this.mtFlowX = new Float32Array(NV1);
    this.mtFlowY = new Float32Array(NV1);
    this.mtDiv = 0;
    this.v1EnergyMean = 0;

    // 32-bin azimuthal summary
    this.rgb = new Float32Array(NBINS * 3);
    this.loom = new Float32Array(NBINS);
    this.lumPrev = new Float32Array(NBINS);
    this.flow = new Float32Array(NBINS);

    // Hippocampal EKF-SLAM landmark map
    const tot = nSites + nPools;
    this.memX = new Float64Array(tot);
    this.memZ = new Float64Array(tot);
    this.conf = new Float64Array(tot);
    this.lmVar = new Float64Array(tot).fill(1e6);
    this.egoVar = 0.02;
    this.slamFrame = 0;
    this.prevNavX = 0;
    this.prevNavZ = 0;
    this.navInit = false;

    this.vis = new Float32Array(tot);
    this.visBear = new Float32Array(tot);
    this.visDist = new Float32Array(tot);

    this.obstAhead = 0;
    this.obstL = 0;
    this.obstR = 0;
    this.opticFlowMean = 0;
    this.seenCount = 0;
    this.loopClosures = 0;
    this.socialSeen = 0;
    this.microSeen = 0;
    this.predatorLoom = 0;
  }

  _initITPrototypes() {
    // Seed 256 3D-form prototypes (WitShape) and 256 chromatic/surface/animacy attribute prototypes (WitAttr) -> 65,536 concepts
    for (let k = 0; k < N_IT_SHAPE; k++) {
      const off = k * 16;
      const ori = k & 3, junc = (k >> 2) & 3, aspect = (k >> 4) & 3, fine = (k >> 6) & 3;
      this.WitShape[off + ori] = 0.52 + 0.04 * fine;
      this.WitShape[off + 4 + junc] = 0.72 - 0.03 * fine;
      this.WitShape[off + 8 + aspect] = 0.45 + 0.05 * ((k >> 5) & 1);
      this.WitShape[off + 12 + ((ori + junc + fine) & 3)] = 0.34 + 0.07 * (k % 3);
      let n2 = 0;
      for (let j = 0; j < 16; j++) n2 += this.WitShape[off + j] ** 2;
      const inv = 1 / (Math.sqrt(n2) || 1);
      for (let j = 0; j < 16; j++) this.WitShape[off + j] *= inv;
    }
    for (let k = 0; k < N_IT_ATTR; k++) {
      const off = k * 16;
      const hue = k & 3, opp = (k >> 2) & 3, anim = (k >> 4) & 3, surf = (k >> 6) & 3;
      this.WitAttr[off + hue] = 0.74 - 0.03 * surf;
      this.WitAttr[off + 4 + opp] = 0.54 + 0.04 * surf;
      this.WitAttr[off + 8 + anim] = 0.44 + 0.05 * ((k >> 5) & 1);
      this.WitAttr[off + 12 + ((hue + anim + surf) & 3)] = 0.32 + 0.07 * (k % 3);
      let n2 = 0;
      for (let j = 0; j < 16; j++) n2 += this.WitAttr[off + j] ** 2;
      const inv = 1 / (Math.sqrt(n2) || 1);
      for (let j = 0; j < 16; j++) this.WitAttr[off + j] *= inv;
    }
  }

  occluded(world, ex, ey, ez, tx, ty, tz, ignoreRock = -1) {
    const dx = tx - ex, dy = ty - ey, dz = tz - ez;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1e-6) return false;
    const len = Math.sqrt(len2);
    const rocks = world.rocks;
    for (let i = 0; i < rocks.length; i++) {
      if (i === ignoreRock) continue;
      const R = rocks[i];
      const rx = R.x - ex, ry = R.y - ey, rz = R.z - ez;
      const proj = (rx * dx + ry * dy + rz * dz) / len;
      if (proj <= 0.05 || proj >= len - R.r * 0.4) continue;
      const perp2 = rx * rx + ry * ry + rz * rz - proj * proj;
      const rad = R.r * 0.92;
      if (perp2 < rad * rad) return true;
    }
    if (len > 4) {
      for (const f of [0.35, 0.68]) {
        const mx = ex + dx * f, my = ey + dy * f, mz = ez + dz * f;
        if (world.height(mx, mz) > my + 0.28) return true;
      }
    }
    return false;
  }

  /** Rasterize a 3D silhouette onto a 64x32 log-polar foveated eye sheet with z-buffer occlusion */
  paintEyeShape(ret, invD, az, el, angRad, shape, rCol, gCol, bCol, idval) {
    const aN = az / FOV, eN = el / VFOV;
    if (Math.abs(aN) > 0.56 || Math.abs(eN) > 0.56) return;
    const uC = angleToFoveaNorm(aN) * W_RET;
    const vC = (1 - angleToFoveaNorm(eN)) * H_RET;
    // Local cortical magnification factor d(pixel)/d(angle) at eccentricity (aN, eN)
    const magU = (FOV_K / (ASINH_HALF * Math.sqrt(1 + (2 * FOV_K * aN) ** 2))) * W_RET;
    const magV = (FOV_K / (ASINH_HALF * Math.sqrt(1 + (2 * FOV_K * eN) ** 2))) * H_RET;
    const rx = clamp((angRad / FOV) * magU, 0.75, W_RET * 0.42);
    const ry = clamp((angRad / VFOV) * magV, 0.75, H_RET * 0.45);
    const x0 = Math.max(0, Math.floor(uC - rx - 0.6)), x1 = Math.min(W_RET - 1, Math.ceil(uC + rx + 0.6));
    const y0 = Math.max(0, Math.floor(vC - ry - 0.6)), y1 = Math.min(H_RET - 1, Math.ceil(vC + ry + 0.6));

    for (let py = y0; py <= y1; py++) {
      const ny = (py + 0.5 - vC) / ry;
      for (let px = x0; px <= x1; px++) {
        const nx = (px + 0.5 - uC) / rx;
        let inside = false;
        let shade = 1.0;
        if (shape === 0) {
          const r2 = nx * nx + ny * ny;
          if (r2 <= 1.05) { inside = true; shade = 0.65 + 0.35 * Math.sqrt(Math.max(0, 1 - 0.85 * r2)) - 0.15 * ny; }
        } else if (shape === 1) {
          if (Math.abs(nx) <= 0.95 && Math.abs(ny) <= 0.95) { inside = true; shade = nx < 0 ? 1.06 : 0.76; }
        } else if (shape === 2) {
          const halfW = clamp(0.52 * (ny + 1.0), 0.08, 1.05);
          if (ny >= -1.0 && ny <= 1.0 && Math.abs(nx) <= halfW) { inside = true; shade = 0.92 - 0.20 * Math.abs(nx); }
        } else if (shape === 3) {
          const l1 = Math.abs(nx) + Math.abs(ny);
          const spike = Math.abs(Math.abs(nx) - Math.abs(ny)) < 0.22 && Math.max(Math.abs(nx), Math.abs(ny)) <= 1.25;
          if (l1 <= 1.12 || spike) { inside = true; shade = spike && l1 > 0.88 ? 1.28 : 0.88; }
        } else if (shape === 5) {
          // Articulated conspecific / organism silhouette (elongated horizontal body + dorsal crest)
          const bodyEq = (nx * 0.72) ** 2 + (ny * 1.35) ** 2;
          const crest = Math.abs(nx) < 0.7 && ny < -0.25 && ny > -0.85 && Math.sin(nx * 9) > 0;
          if (bodyEq <= 1.0 || crest) { inside = true; shade = crest ? 1.22 : 0.85 - 0.2 * ny; }
        } else {
          if (nx * nx + ny * ny * 2.4 <= 1.05) { inside = true; shade = 0.9 + 0.1 * Math.cos(nx * 3); }
        }
        if (!inside) continue;
        const idx = py * W_RET + px;
        if (idval >= invD[idx] * 0.96) {
          invD[idx] = Math.max(invD[idx], idval);
          const p3 = idx * 3;
          ret[p3] = clamp(rCol * shade, 0, 1.6);
          ret[p3 + 1] = clamp(gCol * shade, 0, 1.6);
          ret[p3 + 2] = clamp(bCol * shade, 0, 1.6);
        }
      }
    }
  }

  /** Run 6 RGC Mosaics -> Parvo/Magno/Konio LGN -> V1 Gabor -> V2 Junctions -> V4 32x16 Max-Pool -> 65,536-Concept Ontology-Grounded IT/PRh */
  processVisualCortex(lesionVision) {
    const NPX = W_RET * H_RET;
    if (lesionVision) {
      this.rgcMidgetON.fill(0); this.rgcMidgetOFF.fill(0);
      this.rgcParasolON.fill(0); this.rgcParasolOFF.fill(0);
      this.rgcBistrat.fill(0); this.rgcIpRGC.fill(0); this.scotopicRod.fill(0);
      this.lgnMag.fill(0); this.lgnMag128.fill(0);
      this.v1Simple.fill(0); this.v1Complex.fill(0); this.v1Disparity.fill(0);
      this.v2Cells.fill(0); this.v4Map.fill(0); this.v4Orient.fill(0); this.v4Fovea.fill(0);
      this.itAct.fill(0); this.itShapeAct.fill(0); this.itAttrAct.fill(0); this.fovealPatch.fill(0);
      this.mtFlowX.fill(0); this.mtFlowY.fill(0);
      this.mtDiv = 0; this.v1EnergyMean = 0; this.ipRgcLux = 0;
      this.sceneGraphTriples = [];
      return;
    }

    // 1) Binocular cyclopean L/M/S cone + scotopic rod transduction & Midget/Bistratified/Melanopsin-ipRGC mosaics (256x128 = 32,768/mosaic)
    const lum = this.lumCur, rL = this.retL, rR = this.retR;
    let ipSum = 0;
    for (let i = 0; i < NPX; i++) {
      const p3 = i * 3;
      const Lc = 0.5 * (rL[p3] + rR[p3]);
      const Mc = 0.5 * (rL[p3 + 1] + rR[p3 + 1]);
      const Sc = 0.5 * (rL[p3 + 2] + rR[p3 + 2]);
      const photopic = 0.30 * Lc + 0.55 * Mc + 0.15 * Sc;
      const rod = Math.sqrt(Math.max(0, 0.12 * Lc + 0.52 * Mc + 0.36 * Sc)) * 0.35; // 498 nm rhodopsin scotopic rod signal
      this.scotopicRod[i] = rod;
      lum[i] = photopic + 0.18 * rod;
      const rg = Lc - Mc;
      this.rgcMidgetON[i] = rg;                     // P-ON Midget (also aliased as this.lgnRG)
      this.rgcMidgetOFF[i] = Math.max(0, -rg);      // P-OFF Midget M-L center
      this.rgcBistrat[i] = Sc - 0.5 * (Lc + Mc);    // Koniocellular Small Bistratified S - (L+M)
      const ip = 0.18 * Mc + 0.82 * Sc;             // 480 nm Melanopsin ipRGC ambient irradiance
      this.rgcIpRGC[i] = ip;
      ipSum += ip;
    }
    this.ipRgcLux = 0.92 * this.ipRgcLux + 0.08 * (ipSum / NPX);

    // Extract central 128x64 foveal region pooled 4x4 into 32x16x3 (1,536-D) pixel tensor for 2-Stage Spatial-Pyramid Patch-VAE + Flow WorldModel
    for (let py = 0; py < H_V4; py++) {
      const yBase = 32 + py * 4;
      for (let px = 0; px < W_V4; px++) {
        const xBase = 64 + px * 4;
        let sr = 0, sg = 0, sb = 0;
        for (let dy = 0; dy < 4; dy++) {
          const row = (yBase + dy) * W_RET + xBase;
          for (let dx = 0; dx < 4; dx++) {
            const p3 = (row + dx) * 3;
            sr += 0.5 * (rL[p3] + rR[p3]);
            sg += 0.5 * (rL[p3 + 1] + rR[p3 + 1]);
            sb += 0.5 * (rL[p3 + 2] + rR[p3 + 2]);
          }
        }
        const o3 = (py * W_V4 + px) * 3;
        this.fovealPatch[o3] = sr * (1 / 16);
        this.fovealPatch[o3 + 1] = sg * (1 / 16);
        this.fovealPatch[o3 + 2] = sb * (1 / 16);
      }
    }

    // 2) M-ON / M-OFF Parasol RGC Difference-of-Gaussians (256x128) + 2x2 Pooled Thalamic Magnocellular LGN Relay (128x64)
    const microGain = 1 + 8.0 * Math.hypot(this.microsaccadeAz, this.microsaccadeEl);
    for (let y = 0; y < H_RET; y++) {
      const ym = Math.max(0, y - 1) * W_RET, yc = y * W_RET, yp = Math.min(H_RET - 1, y + 1) * W_RET;
      for (let x = 0; x < W_RET; x++) {
        const xm = Math.max(0, x - 1), xp = Math.min(W_RET - 1, x + 1);
        const idx = yc + x;
        const c = lum[idx];
        const surr = (
          0.15 * (lum[yc + xm] + lum[yc + xp] + lum[ym + x] + lum[yp + x]) +
          0.10 * (lum[ym + xm] + lum[ym + xp] + lum[yp + xm] + lum[yp + xp])
        );
        const trans = 0.14 * (c - this.lum2DPrev[idx]);
        const dog = (c - surr) * microGain + trans;
        this.lgnMag[idx] = dog;
        this.rgcParasolON[idx] = dog > 0 ? dog : 0;
        this.rgcParasolOFF[idx] = dog < 0 ? -dog : 0;
      }
    }
    for (let yl = 0; yl < H_LGN; yl++) {
      const rA = (yl * 2) * W_RET, rB = (yl * 2 + 1) * W_RET;
      const oL = yl * W_LGN;
      for (let xl = 0; xl < W_LGN; xl++) {
        const xA = xl * 2, xB = xA + 1;
        this.lgnMag128[oL + xl] = 0.25 * (this.lgnMag[rA + xA] + this.lgnMag[rA + xB] + this.lgnMag[rB + xA] + this.lgnMag[rB + xB]);
        this.lumLgn128[oL + xl] = 0.25 * (lum[rA + xA] + lum[rA + xB] + lum[rB + xA] + lum[rB + xB]);
      }
    }

    // 3) V1 (64x32x4 = 8,192 units): Unrolled 5x5 Quadrature Gabor Simple/Complex + Binocular Disparity + MT 2D Optic Flow
    this.v4Orient.fill(0);
    let totE = 0, divSum = 0;
    const lgnM = this.lgnMag128, lum128 = this.lumLgn128, lum128Prv = this.lumLgn128Prev;
    for (let vy = 0; vy < H_V1; vy++) {
      const cy = vy * 2 + 1;
      const r0 = Math.max(0, cy - 2) * W_LGN, r1 = Math.max(0, cy - 1) * W_LGN, r2 = cy * W_LGN;
      const r3 = Math.min(H_LGN - 1, cy + 1) * W_LGN, r4 = Math.min(H_LGN - 1, cy + 2) * W_LGN;
      for (let vx = 0; vx < W_V1; vx++) {
        const cx = vx * 2 + 1;
        const x0 = Math.max(0, cx - 2), x1 = Math.max(0, cx - 1), x2 = cx;
        const x3 = Math.min(W_LGN - 1, cx + 1), x4 = Math.min(W_LGN - 1, cx + 2);
        const vIdx = vy * W_V1 + vx;
        const vOff = vIdx * N_ORI;

        const m00 = lgnM[r0 + x0], m01 = lgnM[r0 + x1], m02 = lgnM[r0 + x2], m03 = lgnM[r0 + x3], m04 = lgnM[r0 + x4];
        const m10 = lgnM[r1 + x0], m11 = lgnM[r1 + x1], m12 = lgnM[r1 + x2], m13 = lgnM[r1 + x3], m14 = lgnM[r1 + x4];
        const m20 = lgnM[r2 + x0], m21 = lgnM[r2 + x1], m22 = lgnM[r2 + x2], m23 = lgnM[r2 + x3], m24 = lgnM[r2 + x4];
        const m30 = lgnM[r3 + x0], m31 = lgnM[r3 + x1], m32 = lgnM[r3 + x2], m33 = lgnM[r3 + x3], m34 = lgnM[r3 + x4];
        const m40 = lgnM[r4 + x0], m41 = lgnM[r4 + x1], m42 = lgnM[r4 + x2], m43 = lgnM[r4 + x3], m44 = lgnM[r4 + x4];

        for (let o = 0; o < N_ORI; o++) {
          const k = o * 25;
          const sCos =
            m00 * GABOR_COS[k] + m01 * GABOR_COS[k + 1] + m02 * GABOR_COS[k + 2] + m03 * GABOR_COS[k + 3] + m04 * GABOR_COS[k + 4] +
            m10 * GABOR_COS[k + 5] + m11 * GABOR_COS[k + 6] + m12 * GABOR_COS[k + 7] + m13 * GABOR_COS[k + 8] + m14 * GABOR_COS[k + 9] +
            m20 * GABOR_COS[k + 10] + m21 * GABOR_COS[k + 11] + m22 * GABOR_COS[k + 12] + m23 * GABOR_COS[k + 13] + m24 * GABOR_COS[k + 14] +
            m30 * GABOR_COS[k + 15] + m31 * GABOR_COS[k + 16] + m32 * GABOR_COS[k + 17] + m33 * GABOR_COS[k + 18] + m34 * GABOR_COS[k + 19] +
            m40 * GABOR_COS[k + 20] + m41 * GABOR_COS[k + 21] + m42 * GABOR_COS[k + 22] + m43 * GABOR_COS[k + 23] + m44 * GABOR_COS[k + 24];
          const sSin =
            m00 * GABOR_SIN[k] + m01 * GABOR_SIN[k + 1] + m02 * GABOR_SIN[k + 2] + m03 * GABOR_SIN[k + 3] + m04 * GABOR_SIN[k + 4] +
            m10 * GABOR_SIN[k + 5] + m11 * GABOR_SIN[k + 6] + m12 * GABOR_SIN[k + 7] + m13 * GABOR_SIN[k + 8] + m14 * GABOR_SIN[k + 9] +
            m20 * GABOR_SIN[k + 10] + m21 * GABOR_SIN[k + 11] + m22 * GABOR_SIN[k + 12] + m23 * GABOR_SIN[k + 13] + m24 * GABOR_SIN[k + 14] +
            m30 * GABOR_SIN[k + 15] + m31 * GABOR_SIN[k + 16] + m32 * GABOR_SIN[k + 17] + m33 * GABOR_SIN[k + 18] + m34 * GABOR_SIN[k + 19] +
            m40 * GABOR_SIN[k + 20] + m41 * GABOR_SIN[k + 21] + m42 * GABOR_SIN[k + 22] + m43 * GABOR_SIN[k + 23] + m44 * GABOR_SIN[k + 24];
          const energy = Math.hypot(sCos, sSin);
          this.v1Simple[vOff + o] = Math.max(0, sCos);
          this.v1Complex[vOff + o] = energy;
          this.v4Orient[o] += energy;
          totE += energy;
        }

        const pRet = (cy * 2) * W_RET + (cx * 2);
        this.v1Disparity[vIdx] = 0.5 * (this.invDL[pRet] + this.invDR[pRet]);

        const pC = r2 + x2;
        const ix = 0.5 * (lum128[r2 + x3] - lum128[r2 + x1]);
        const iy = 0.5 * (lum128[r3 + x2] - lum128[r1 + x2]);
        const it = lum128[pC] - lum128Prv[pC];
        const denom = ix * ix + iy * iy + 0.025;
        const fx = -ix * it / denom, fy = -iy * it / denom;
        this.mtFlowX[vIdx] = 0.75 * this.mtFlowX[vIdx] + 0.25 * fx;
        this.mtFlowY[vIdx] = 0.75 * this.mtFlowY[vIdx] + 0.25 * fy;

        const rx = (vx - 31.5) / 31.5, ry = (vy - 15.5) / 15.5;
        divSum += this.mtFlowX[vIdx] * rx + this.mtFlowY[vIdx] * ry;
      }
    }

    const invNV1 = 1 / (W_V1 * H_V1);
    for (let o = 0; o < N_ORI; o++) this.v4Orient[o] *= invNV1;
    this.v1EnergyMean = totE * invNV1 * 0.25;
    this.mtDiv = clamp(divSum * invNV1 * 2.5, -1, 1);

    // 4) V2 (32x16x4 = 2,048 units): Contour Curvature, Orthogonal Box Corners, Acute Cone Vertices & Diagonal Spines
    for (let y2 = 0; y2 < H_V2; y2++) {
      for (let x2 = 0; x2 < W_V2; x2++) {
        let e0 = 0, e45 = 0, e90 = 0, e135 = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const off = ((y2 * 2 + dy) * W_V1 + (x2 * 2 + dx)) * N_ORI;
            e0 = Math.max(e0, this.v1Complex[off]);
            e45 = Math.max(e45, this.v1Complex[off + 1]);
            e90 = Math.max(e90, this.v1Complex[off + 2]);
            e135 = Math.max(e135, this.v1Complex[off + 3]);
          }
        }
        const sumE = e0 + e45 + e90 + e135 + 1e-5;
        const o2 = (y2 * W_V2 + x2) * 4;
        const minAll = Math.min(e0, e45, e90, e135);
        this.v2Cells[o2] = 2.2 * minAll;
        this.v2Cells[o2 + 1] = Math.max(0, Math.sqrt(e0 * e90) - 0.45 * (e45 + e135));
        this.v2Cells[o2 + 2] = Math.max(0, 0.7 * (e45 + e135) - 0.5 * e90);
        this.v2Cells[o2 + 3] = Math.sqrt(e45 * e135) * (1 + (e45 + e135) / sumE);
      }
    }

    // 5) V4 (32x16x8 = 4,096 units): 3x3 HMAX C2 Scale/Position-Tolerant Max-Pooling + Parvo/Konio Opponent Hue Bands
    this.v4Fovea.fill(0);
    const maxV2 = new Float32Array(4);
    const maxHue = new Float32Array(4);
    const quadShape = new Float32Array(4);
    let nFov = 0, maxDisp = 0;
    for (let y4 = 0; y4 < H_V4; y4++) {
      const ym = Math.max(0, y4 - 1), yp = Math.min(H_V2 - 1, y4 + 1);
      for (let x4 = 0; x4 < W_V4; x4++) {
        const xm = Math.max(0, x4 - 1), xp = Math.min(W_V2 - 1, x4 + 1);
        const o4 = (y4 * W_V4 + x4) * 8;
        let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
        for (let yy = ym; yy <= yp; yy++) {
          for (let xx = xm; xx <= xp; xx++) {
            const o2 = (yy * W_V2 + xx) * 4;
            if (this.v2Cells[o2] > c0) c0 = this.v2Cells[o2];
            if (this.v2Cells[o2 + 1] > c1) c1 = this.v2Cells[o2 + 1];
            if (this.v2Cells[o2 + 2] > c2) c2 = this.v2Cells[o2 + 2];
            if (this.v2Cells[o2 + 3] > c3) c3 = this.v2Cells[o2 + 3];
          }
        }
        const rPy = (y4 * 8 + 4) * W_RET + (x4 * 8 + 4);
        const p3 = rPy * 3;
        const R = 0.5 * (rL[p3] + rR[p3]), G = 0.5 * (rL[p3 + 1] + rR[p3 + 1]), B = 0.5 * (rL[p3 + 2] + rR[p3 + 2]);
        const hMint = Math.max(0, G - 0.65 * R - 0.25 * B);
        const hMag = Math.max(0, 0.55 * (R + B) - G);
        const hCyan = Math.max(0, 0.55 * (G + B) - R);
        const hAmb = Math.max(0, 0.6 * R + 0.4 * G - B);

        this.v4Map[o4] = c0; this.v4Map[o4 + 1] = c1; this.v4Map[o4 + 2] = c2; this.v4Map[o4 + 3] = c3;
        this.v4Map[o4 + 4] = hMint; this.v4Map[o4 + 5] = hMag; this.v4Map[o4 + 6] = hCyan; this.v4Map[o4 + 7] = hAmb;

        if (x4 >= 8 && x4 <= 23 && y4 >= 4 && y4 <= 11) {
          if (c0 > maxV2[0]) maxV2[0] = c0;
          if (c1 > maxV2[1]) maxV2[1] = c1;
          if (c2 > maxV2[2]) maxV2[2] = c2;
          if (c3 > maxV2[3]) maxV2[3] = c3;
          if (hMint > maxHue[0]) maxHue[0] = hMint;
          if (hMag > maxHue[1]) maxHue[1] = hMag;
          if (hCyan > maxHue[2]) maxHue[2] = hCyan;
          if (hAmb > maxHue[3]) maxHue[3] = hAmb;
          const qIdx = (y4 >= 8 ? 2 : 0) + (x4 >= 16 ? 1 : 0);
          quadShape[qIdx] = Math.max(quadShape[qIdx], c0 + c1 + c2 + c3);
          const disp = 0.5 * (this.invDL[rPy] + this.invDR[rPy]);
          if (disp > maxDisp) maxDisp = disp;
          for (let o = 0; o < 4; o++) this.v4Fovea[o] += this.v4Map[o4 + o];
          this.v4Fovea[4] += Math.max(0, this.rgcMidgetON[rPy]);
          this.v4Fovea[5] += this.rgcMidgetOFF[rPy];
          this.v4Fovea[6] += Math.max(0, this.rgcBistrat[rPy]);
          this.v4Fovea[7] += lum[rPy];
          nFov++;
        }
      }
    }
    for (let k = 0; k < 8; k++) this.v4Fovea[k] /= Math.max(1, nFov);

    // 6) Compositional Product-Quantized Ventral IT + Perirhinal (PRh) Cortex (256 Shape x 256 Attribute = 65,536 Concepts!)
    const fs = this.itShapeFeat, fa = this.itAttrFeat;
    const nOri = Math.hypot(this.v4Orient[0], this.v4Orient[1], this.v4Orient[2], this.v4Orient[3]) + 1e-5;
    const nV2 = Math.hypot(maxV2[0], maxV2[1], maxV2[2], maxV2[3]) + 1e-5;
    const nQuad = Math.hypot(quadShape[0], quadShape[1], quadShape[2], quadShape[3]) + 1e-5;
    const nHue = Math.hypot(maxHue[0], maxHue[1], maxHue[2], maxHue[3]) + 1e-5;

    for (let i = 0; i < 4; i++) {
      fs[i] = (this.v4Orient[i] / nOri) * 0.55;
      fs[4 + i] = (maxV2[i] / nV2) * 0.75;
      fs[8 + i] = (quadShape[i] / nQuad) * 0.40;
      fs[12 + i] = (maxV2[(i + 1) & 3] / nV2) * 0.25;

      fa[i] = (maxHue[i] / nHue) * 0.78;
      fa[4 + i] = clamp(this.v4Fovea[4 + i] * 2.2, 0, 1) * 0.50;
    }
    const animCue = clamp(this.socialSeen * 0.35 + this.predatorLoom * 0.8 + this.microSeen * 0.12, 0, 1);
    fa[8] = animCue * 0.45;
    fa[9] = clamp(Math.abs(this.mtDiv), 0, 1) * 0.35;
    fa[10] = clamp(maxDisp * 0.35, 0, 1) * 0.30;
    fa[11] = clamp(this.v4Fovea[7], 0, 1) * 0.35;
    for (let i = 0; i < 4; i++) fa[12 + i] = (maxHue[(i + 2) & 3] / nHue) * 0.25;

    this.itFeat.set(fs.subarray(0, 8), 0);
    this.itFeat.set(fa.subarray(0, 8), 8);

    let ns2 = 0, na2 = 0;
    for (let j = 0; j < 16; j++) { ns2 += fs[j] * fs[j]; na2 += fa[j] * fa[j]; }
    if (ns2 > 0.015 && na2 > 0.015) {
      const invS = 1 / Math.sqrt(ns2), invA = 1 / Math.sqrt(na2);
      for (let j = 0; j < 16; j++) { fs[j] *= invS; fa[j] *= invA; }

      let bestSVal = -1, bestS = 0;
      for (let k = 0; k < N_IT_SHAPE; k++) {
        let dp = 0;
        const off = k * 16;
        for (let j = 0; j < 16; j++) dp += this.WitShape[off + j] * fs[j];
        const act = Math.max(0, dp);
        this.itShapeAct[k] = act;
        if (act > bestSVal) { bestSVal = act; bestS = k; }
      }

      let bestAVal = -1, bestA = 0;
      for (let k = 0; k < N_IT_ATTR; k++) {
        let dp = 0;
        const off = k * 16;
        for (let j = 0; j < 16; j++) dp += this.WitAttr[off + j] * fa[j];
        const act = Math.max(0, dp);
        this.itAttrAct[k] = act;
        if (act > bestAVal) { bestAVal = act; bestA = k; }
      }

      // 64-column cortical readout (32 max-pooled form columns [8 prototypes/col] + 32 max-pooled attribute columns [8 prototypes/col])
      for (let c = 0; c < 32; c++) {
        let mS = 0, mA = 0;
        const base = c * 8;
        for (let q = 0; q < 8; q++) {
          if (this.itShapeAct[base + q] > mS) mS = this.itShapeAct[base + q];
          if (this.itAttrAct[base + q] > mA) mA = this.itAttrAct[base + q];
        }
        this.itAct[c] = mS;
        this.itAct[32 + c] = mA;
      }

      const conceptId = bestS * N_IT_ATTR + bestA; // 0 .. 65,535 Perirhinal compositional concept!
      this.itActiveConcept = conceptId;
      this.itTopShape = bestS;
      this.itTopAttr = bestA;
      this.itTopCat = ((bestS >> 4) * 4 + (bestA & 3)) % N_IT;
      if (!this.itObservedConcepts[conceptId]) {
        this.itObservedConcepts[conceptId] = 1;
        this.itUniqueConceptsSeen++;
      }

      // Ground visual concept in the 4-Tier Symbolic Hypernym & Relational Affordance Ontology (`ONTOLOGY_DAG`)
      let synIdx = 15;
      if (this.predatorLoom > 0.20) synIdx = 8;
      else if (this.socialSeen > 0 && animCue > 0.28) synIdx = (bestA & 1) ? 6 : 5;
      else if (this.microSeen > 0 && maxDisp > 0.25 && nHue < 0.08) synIdx = (bestS & 1) ? 10 : 9;
      else if (this.obstAhead > 0.35 && nHue < 0.12) synIdx = 13;
      else if (maxHue[2] > 0.35 && maxV2[0] > maxV2[2]) synIdx = 12;
      else if (nHue > 0.08) {
        let topHue = 0;
        for (let h = 1; h < 4; h++) if (maxHue[h] > maxHue[topHue]) topHue = h;
        synIdx = topHue; // 0: MINT-BULB, 1: MAGENTA-CHALICE, 2: CYAN-FROND, 3: AMBER-STARPOD
      } else if (nV2 > 0.10) {
        synIdx = 4; // DORMANT-STALK
      }
      const syn = ONTOLOGY_DAG.synsets[synIdx];
      this.ontologySynset = syn;
      this.activeLexeme = `${syn.lexeme}#c${String(conceptId).padStart(5, '0')}`;
      this.hypernymPath = syn.hypernyms.join(' > ');
      for (let a = 0; a < 6; a++) this.affordanceVec[a] = 0.85 * this.affordanceVec[a] + 0.15 * syn.aff[a];

      // Build grounded Subject --[Predicate:Affordance]--> Object relational scene-graph triples
      const triples = [];
      triples.push([
        'SELF',
        syn.aff[0] > 0.5 ? `forages:edible(${syn.aff[0].toFixed(2)})`
          : syn.aff[1] > 0.5 ? `seeks:potable(${syn.aff[1].toFixed(2)})`
          : syn.aff[2] > 0.5 ? `evades:hazard(${syn.aff[2].toFixed(2)})`
          : syn.aff[3] > 0.5 ? `attends:social(${syn.aff[3].toFixed(2)})`
          : `inspects:shelter(${syn.aff[4].toFixed(2)})`,
        `${syn.hypernyms[2]}:${syn.lexeme}`,
      ]);
      if (this.predatorLoom > 0.08) {
        triples.push(['Agent.ApexPredator:APEX-PREDATOR', `loomsAt:hazard(${this.predatorLoom.toFixed(2)})`, 'SELF']);
      }
      if (this.socialSeen > 0) {
        triples.push(['SELF', `cohabitsWith:kin(${this.socialSeen})`, 'Agent.Conspecific:KIN-CONSPECIFIC']);
      }
      if (this.obstAhead > 0.15) {
        triples.push(['Lithology.Obstacle:BASALT-MONOLITH', `occludesPath:prox(${this.obstAhead.toFixed(2)})`, 'SELF']);
      }
      this.sceneGraphTriples = triples;

      // Measure view/scale invariance as cosine stability of 64-D IT population vector while approaching fixated object
      let dotPrev = 0, nCur = 0, nPrv = 0;
      for (let k = 0; k < N_IT; k++) {
        dotPrev += this.itAct[k] * this._prevItVec[k];
        nCur += this.itAct[k] ** 2;
        nPrv += this._prevItVec[k] ** 2;
      }
      if (nCur > 1e-4 && nPrv > 1e-4 && this._prevTopId === this.itTopCat) {
        const cosStab = dotPrev / Math.sqrt(nCur * nPrv);
        this.itInvariance = 0.96 * this.itInvariance + 0.04 * cosStab;
      }
      this._prevItVec.set(this.itAct);
      this._prevTopId = this.itTopCat;

      // Online Foldiak / Wallis-Rolls slow temporal-trace Hebbian learning on both 256-entry Shape & Attribute codebooks
      for (let k = 0; k < N_IT_SHAPE; k++) this.itShapeTrace[k] = 0.88 * this.itShapeTrace[k] + 0.12 * (k === bestS ? 1 : 0);
      for (let k = 0; k < N_IT_ATTR; k++) this.itAttrTrace[k] = 0.88 * this.itAttrTrace[k] + 0.12 * (k === bestA ? 1 : 0);
      const etaS = 0.004 * this.itShapeTrace[bestS];
      if (etaS > 0.0005) {
        const off = bestS * 16;
        let w2 = 0;
        for (let j = 0; j < 16; j++) {
          this.WitShape[off + j] += etaS * (fs[j] - bestSVal * this.WitShape[off + j]);
          w2 += this.WitShape[off + j] ** 2;
        }
        const invW = 1 / (Math.sqrt(w2) || 1);
        for (let j = 0; j < 16; j++) this.WitShape[off + j] *= invW;
      }
      const etaA = 0.004 * this.itAttrTrace[bestA];
      if (etaA > 0.0005) {
        const off = bestA * 16;
        let w2 = 0;
        for (let j = 0; j < 16; j++) {
          this.WitAttr[off + j] += etaA * (fa[j] - bestAVal * this.WitAttr[off + j]);
          w2 += this.WitAttr[off + j] ** 2;
        }
        const invW = 1 / (Math.sqrt(w2) || 1);
        for (let j = 0; j < 16; j++) this.WitAttr[off + j] *= invW;
      }
    } else {
      this.itAct.fill(0);
    }

    this.lum2DPrev.set(lum);
    this.lumLgn128Prev.set(this.lumLgn128);
  }

  /**
   * Project the 3D world (including A-Life conspecifics, eggs, bio-mites & predators) onto dual 64x32 log-polar
   * foveated sheets, run LGN -> V1 -> V2 -> V4 -> IT + MT, and update EKF-SLAM landmark localization.
   */
  step(body, world, nav, lesionNav = false, lesionVision = false, goalBear = 0, goalDist = 1e9) {
    const X = body.x, Y = body.y, Z = body.z;
    const Fh = body.F[NS - 1];
    const eL = body.stalks[0]?.eye ?? body.c[NS - 1];
    const eR = body.stalks[1]?.eye ?? body.c[NS - 1];
    const ex = 0.5 * (X[eL] + X[eR]), ey = 0.5 * (Y[eL] + Y[eR]), ez = 0.5 * (Z[eL] + Z[eR]);

    const F3 = body.F[3];
    const spineAz = Math.atan2(F3.f[2], F3.f[0]);
    const gazeYawL = body.u[CH.gaze] * 0.35, gazePitchL = body.u[CH.gaze + 1] * 0.25;
    const gazeYawR = body.u[CH.gaze + 2] * 0.35, gazePitchR = body.u[CH.gaze + 3] * 0.25;
    const gazeYaw = 0.25 * (body.u[CH.gaze] + body.u[CH.gaze + 2] + body.u[CH.gaze + 4]) / 0.75 * 0.35;
    const headAz = Math.atan2(Fh.f[2], Fh.f[0]);
    const neckYaw = Math.atan2(Math.sin(headAz - spineAz), Math.cos(headAz - spineAz));
    const gazeAz = headAz + gazeYaw;
    const eyeAzL = headAz + gazeYawL, eyeAzR = headAz + gazeYawR;

    this.rgb.fill(0);
    this.loom.fill(0);
    this.vis.fill(0);
    this.socialSeen = 0;
    this.predatorLoom = 0;
    const doSheet = !lesionVision && !this.skipSheet && ((this._sheetTick = (this._sheetTick || 0) + 1) % 3 === 1);
    if (doSheet) {
      this._sheetsCleared = false;
      this.invDL.fill(0);
      this.invDR.fill(0);
      // Physiological 4 Hz ocular microsaccadic tremor + efference-copy tracking (prevents Troxler adaptation fade)
      this.microPhase = (this.microPhase + 1.256637) % (2 * Math.PI);
      this.microsaccadeAz = 0.0055 * Math.sin(this.microPhase * 2.0);
      this.microsaccadeEl = 0.0042 * Math.cos(this.microPhase * 3.0);
    } else if (lesionVision && !this._sheetsCleared) {
      this.invDL.fill(0);
      this.invDR.fill(0);
      this.microsaccadeAz = 0;
      this.microsaccadeEl = 0;
    }

    // 0) Fast interpolated 16-ray horizon contour onto both 64x32 log-polar foveated sheets (20 Hz biological cortical sweep)
    if (doSheet) {
      const N_HOR = 16;
      const hTabL = new Float32Array(N_HOR + 1);
      const hTabR = new Float32Array(N_HOR + 1);
      for (let i = 0; i <= N_HOR; i++) {
        const aN = i / N_HOR - 0.5;
        const rL = eyeAzL + aN * FOV, rR = eyeAzR + aN * FOV;
        hTabL[i] = Math.atan2(world.height(X[eL] + 7 * Math.cos(rL), Z[eL] + 7 * Math.sin(rL)) - Y[eL], 7) - gazePitchL;
        hTabR[i] = Math.atan2(world.height(X[eR] + 7 * Math.cos(rR), Z[eR] + 7 * Math.sin(rR)) - Y[eR], 7) - gazePitchR;
      }
      for (let px = 0; px < W_RET; px++) {
        const s = (RET_AZ_NORM[px] + 0.5) * N_HOR;
        const si = clamp(Math.floor(s), 0, N_HOR - 1), sf = clamp(s - si, 0, 1);
        const horElL = hTabL[si] * (1 - sf) + hTabL[si + 1] * sf;
        const horElR = hTabR[si] * (1 - sf) + hTabR[si + 1] * sf;
        for (let py = 0; py < H_RET; py++) {
          const el = RET_EL_NORM[py] * VFOV;
          const idx = py * W_RET + px, p3 = idx * 3;
          if (el > horElL) {
            this.retL[p3] = 0.08; this.retL[p3 + 1] = 0.11; this.retL[p3 + 2] = 0.22;
          } else {
            this.retL[p3] = 0.06; this.retL[p3 + 1] = 0.09; this.retL[p3 + 2] = 0.08;
            this.invDL[idx] = 0.08;
          }
          if (el > horElR) {
            this.retR[p3] = 0.08; this.retR[p3 + 1] = 0.11; this.retR[p3 + 2] = 0.22;
          } else {
            this.retR[p3] = 0.06; this.retR[p3 + 1] = 0.09; this.retR[p3 + 2] = 0.08;
            this.invDR[idx] = 0.08;
          }
        }
      }
    } else if (lesionVision && !this._sheetsCleared) {
      this.retL.fill(0);
      this.retR.fill(0);
    }

    const doSlam = !lesionNav && !!nav && (++this.slamFrame % 6 === 0);
    let navHeadX = 0, navHeadZ = 0;
    if (doSlam) {
      if (!this.navInit) {
        this.prevNavX = nav.px;
        this.prevNavZ = nav.pz;
        this.navInit = true;
      }
      nav.px = clamp(nav.px, -19.5, 19.5);
      nav.pz = clamp(nav.pz, -19.5, 19.5);
      const move = Math.hypot(nav.px - this.prevNavX, nav.pz - this.prevNavZ);
      this.prevNavX = nav.px;
      this.prevNavZ = nav.pz;
      this.egoVar = Math.min(6.0, this.egoVar + 0.045 * move + 0.001);
      for (let i = 0; i < this.lmVar.length; i++) if (this.lmVar[i] < 1e5) this.lmVar[i] += 0.003;
      const neckHdg = nav.heading() + 0.35 * neckYaw;
      navHeadX = nav.px + 1.25 * Math.cos(neckHdg);
      navHeadZ = nav.pz + 1.25 * Math.sin(neckHdg);
    }

    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const binOf = (ang) => {
      const u = (ang + FOV * 0.5) / FOV;
      return u >= 0 && u < 1 ? Math.min(NBINS - 1, Math.floor(u * NBINS)) : -1;
    };

    const projectBinocular2D = (tx, ty, tz, radWorld, shape, rC, gC, bC) => {
      if (!doSheet) return;
      const dLx = tx - X[eL], dLy = ty - Y[eL], dLz = tz - Z[eL];
      const distL = Math.hypot(dLx, dLz);
      if (distL > 0.12) {
        const azL = wrap(Math.atan2(dLz, dLx) - eyeAzL);
        const elL = Math.atan2(dLy, distL) - gazePitchL;
        this.paintEyeShape(this.retL, this.invDL, azL, elL, Math.atan2(radWorld, distL), shape, rC, gC, bC, 1 / distL);
      }
      const dRx = tx - X[eR], dRy = ty - Y[eR], dRz = tz - Z[eR];
      const distR = Math.hypot(dRx, dRz);
      if (distR > 0.12) {
        const azR = wrap(Math.atan2(dRz, dRx) - eyeAzR);
        const elR = Math.atan2(dRy, distR) - gazePitchR;
        this.paintEyeShape(this.retR, this.invDR, azR, elR, Math.atan2(radWorld, distR), shape, rC, gC, bC, 1 / distR);
      }
    };

    // 1) Rocks -> 2D foveated retinas + obstacle avoidance cone
    let oAhead = 0, oL = 0, oR = 0;
    for (let i = 0; i < world.rocks.length; i++) {
      const R = world.rocks[i];
      const dx = R.x - ex, dz = R.z - ez;
      const distC = Math.hypot(dx, dz);
      const surfD = Math.max(0.05, distC - R.r);
      if (surfD <= 14) projectBinocular2D(R.x, R.y + R.r * 0.35, R.z, R.r, 0, 0.36, 0.30, 0.56);
      if (surfD > 8) continue;
      const ang = wrap(Math.atan2(dz, dx) - gazeAz);
      const halfSpan = Math.atan2(R.r + 0.22, Math.max(0.25, distC));
      const prox = clamp(1 - surfD / 3.4);
      const b0 = Math.max(0, Math.floor(((ang - halfSpan + FOV * 0.5) / FOV) * NBINS));
      const b1 = Math.min(NBINS - 1, Math.ceil(((ang + halfSpan + FOV * 0.5) / FOV) * NBINS));
      for (let b = b0; b <= b1; b++) {
        if (prox > this.loom[b]) this.loom[b] = prox;
        this.rgb[3 * b] += 0.18 * prox;
        this.rgb[3 * b + 2] += 0.28 * prox;
      }
      const hAng = wrap(Math.atan2(dz, dx) - headAz);
      const clearCone = Math.min(0.62, halfSpan + 0.22);
      if (surfD < 1.5 && Math.abs(hAng) < clearCone && goalDist > surfD + 0.4) {
        const w = clamp(1 - surfD / 1.5) * clamp(1 - Math.abs(hAng) / (clearCone + 0.25), 0.3, 1);
        if (surfD < 1.25 && Math.abs(hAng) < 0.42) oAhead = Math.max(oAhead, clamp(1 - surfD / 1.25));
        const relToGoal = wrap(goalBear - hAng);
        if (relToGoal >= 0) oL = Math.max(oL, w);
        else oR = Math.max(oR, w);
      }
    }
    this.obstAhead = oAhead;
    this.obstL = oL;
    this.obstR = oR;

    const measureLandmark = (id, tx, ty, tz, heightCue, rgb, maxR, shape = 0, radWorld = 0.42) => {
      const dx = tx - ex, dz = tz - ez;
      const trueD = Math.hypot(dx, dz);
      if (trueD > maxR) return;
      const hBear = wrap(Math.atan2(dz, dx) - headAz);
      const rAng = wrap(Math.atan2(dz, dx) - gazeAz);
      const b = binOf(rAng);
      if (b < 0 && !lesionVision) return;
      if (!lesionVision && this.occluded(world, ex, ey, ez, tx, ty, tz)) return;

      const aL = Math.atan2(tz - Z[eL], tx - X[eL]);
      const aR = Math.atan2(tz - Z[eR], tx - X[eR]);
      const dispTrue = Math.abs(wrap(aL - aR));
      const dispObs = dispTrue + (lesionVision ? 0 : 0.0035 * gauss(this.r));
      const bPerp = Math.abs((X[eR] - X[eL]) * (-dz / Math.max(0.1, trueD)) + (Z[eR] - Z[eL]) * (dx / Math.max(0.1, trueD)));
      const rhoStereo = dispObs / Math.max(0.12, bPerp);
      const subtense = Math.atan2(heightCue, Math.max(0.25, trueD));
      const subObs = clamp(subtense + (lesionVision ? 0 : 0.006 * gauss(this.r)), 0.012, 1.45);
      const rhoSub = Math.tan(subObs) / heightCue;
      const inBinoc = Math.abs(hBear) < 1.08 && bPerp > 0.22;
      const wSt = inBinoc ? 1 / (1 + (trueD / 9) ** 2) : 0;
      const rhoEst = clamp(wSt * rhoStereo + (1 - wSt) * rhoSub, 1 / 28, 4.5);
      const dEst = 1 / rhoEst;
      const bEst = hBear + (lesionVision ? 0 : 0.01 * gauss(this.r));

      const inten = clamp(1.3 / (1 + 0.12 * dEst));
      projectBinocular2D(tx, ty, tz, radWorld, shape, rgb[0] * inten, rgb[1] * inten, rgb[2] * inten);

      if (b >= 0) {
        this.rgb[3 * b] += rgb[0] * inten;
        this.rgb[3 * b + 1] += rgb[1] * inten;
        this.rgb[3 * b + 2] += rgb[2] * inten;
      }

      this.vis[id] = dEst <= STEREO_RANGE ? 1 : 0.45;
      this.visBear[id] = bEst;
      this.visDist[id] = dEst;

      if (doSlam) {
        const worldAz = wrap(nav.heading() + neckYaw + bEst);
        const obsX = clamp(navHeadX + dEst * Math.cos(worldAz), -19.5, 19.5);
        const obsZ = clamp(navHeadZ + dEst * Math.sin(worldAz), -19.5, 19.5);
        const rObs = 0.04 + 0.025 * dEst * dEst;
        const vNew = this.egoVar + rObs;
        const vOld = this.lmVar[id];

        if (vOld < 1.2 && dEst < 7.5 && this.egoVar > 0.05) {
          const neckHdg = nav.heading() + 0.35 * neckYaw;
          const impX = this.memX[id] - dEst * Math.cos(worldAz) - 1.25 * Math.cos(neckHdg);
          const impZ = this.memZ[id] - dEst * Math.sin(worldAz) - 1.25 * Math.sin(neckHdg);
          const kEgo = clamp(0.45 * (this.egoVar / (this.egoVar + vOld + rObs)), 0, 0.32);
          nav.reset(impX, impZ, kEgo);
          this.prevNavX = nav.px;
          this.prevNavZ = nav.pz;
          navHeadX = nav.px + 1.25 * Math.cos(neckHdg);
          navHeadZ = nav.pz + 1.25 * Math.sin(neckHdg);
          this.egoVar *= 1 - kEgo;
          this.loopClosures++;
        }

        if (vOld > 1e5) {
          this.memX[id] = obsX;
          this.memZ[id] = obsZ;
          this.lmVar[id] = vNew;
          this.seenCount++;
        } else if (vNew < vOld * 2.2 || dEst < 6.0) {
          const kLm = clamp(vOld / (vOld + vNew), 0.05, 0.85);
          this.memX[id] = clamp(this.memX[id] + kLm * (obsX - this.memX[id]), -19.5, 19.5);
          this.memZ[id] = clamp(this.memZ[id] + kLm * (obsZ - this.memZ[id]), -19.5, 19.5);
          this.lmVar[id] = Math.max(0.05, (1 - kLm) * vOld);
        }
        this.conf[id] = clamp(1 / (1 + Math.sqrt(this.lmVar[id]) * 0.55), 0.05, 0.99);
      }
    };

    // 2) Project the 16 plants
    for (let k = 0; k < world.plants.length; k++) {
      const P = world.plants[k];
      const col = HUE_RGB[P.c];
      const br = 0.35 + 0.65 * P.fruit;
      if (!lesionVision && Math.hypot(P.x - ex, P.z - ez) < 12) {
        projectBinocular2D(P.x, P.y + 0.6, P.z, 0.16, 1, 0.12, 0.34, 0.22);
      }
      measureLandmark(
        k, P.x, P.y + 1.35, P.z, 1.35,
        [col[0] * br, col[1] * br, col[2] * br],
        HORIZON_RANGE,
        P.s,
        0.34 + 0.18 * P.fruit
      );
    }

    // 3) Project the 3 water pools
    for (let p = 0; p < world.pools.length; p++) {
      const Wp = world.pools[p];
      const wy = world.height(Wp.x, Wp.z) + 0.15;
      measureLandmark(this.nSites + p, Wp.x, wy, Wp.z, Wp.r, [0.2, 0.85, 1.0], HORIZON_RANGE - 2, 4, Wp.r * 0.65);
    }

    // 4) Project dropped snacks
    for (const s of world.snacks) {
      const dx = s.x - ex, dz = s.z - ez, d = Math.hypot(dx, dz);
      if (d > 16) continue;
      const b = binOf(wrap(Math.atan2(dz, dx) - gazeAz));
      if (!this.occluded(world, ex, ey, ez, s.x, s.y + 0.15, s.z)) {
        const w = clamp(1.5 / (1 + 0.15 * d));
        const rC = w, gC = (s.kind === 'fat' ? 0.8 : 0.4) * w, bC = (s.kind === 'fat' ? 0.4 : 0.8) * w;
        projectBinocular2D(s.x, s.y + 0.15, s.z, 0.22, 0, rC, gC, bC);
        if (b >= 0) {
          this.rgb[3 * b] += rC;
          this.rgb[3 * b + 1] += gC;
          this.rgb[3 * b + 2] += bC;
        }
      }
    }

    // 5) Project A-Life Ecosystem entities (conspecifics, eggs, bio-mites, predators & embodied micro-fauna) onto retinas!
    this.microSeen = 0;
    const eco = world.eco;
    if (eco && !lesionVision) {
      for (const peer of eco.peers) {
        if (!peer.alive) continue;
        const d = Math.hypot(peer.x - ex, peer.z - ez);
        if (d < 18) {
          this.socialSeen++;
          projectBinocular2D(peer.x, peer.y + 0.28 * peer.scale, peer.z, 0.55 * peer.scale, 5, peer.colR, peer.colG, peer.colB);
        }
      }
      for (const egg of eco.eggs) {
        if (Math.hypot(egg.x - ex, egg.z - ez) < 12) {
          projectBinocular2D(egg.x, egg.y + 0.18, egg.z, 0.22, 0, 1.0, 0.88, 0.45);
        }
      }
      for (let m = 0; m < eco.mites.length; m += 2) {
        const mt = eco.mites[m];
        if (Math.hypot(mt.x - ex, mt.z - ez) < 9) {
          this.microSeen++;
          projectBinocular2D(mt.x, mt.y, mt.z, 0.10, 3, 0.45, 1.0, 0.82);
        }
      }
      for (const pred of eco.predators) {
        const d = Math.hypot(pred.x - ex, pred.z - ez);
        if (d < 22) {
          projectBinocular2D(pred.x, pred.y, pred.z, 1.15, 5, 1.15, 0.15, 0.28);
          this.predatorLoom = Math.max(this.predatorLoom, clamp(1 - d / 14));
        }
      }
    }
    if (world.microFauna && !lesionVision) {
      for (let m = 0; m < world.microFauna.length; m += 4) {
        const mf = world.microFauna[m];
        if (Math.hypot(mf.x - ex, mf.z - ez) < 7.5) {
          this.microSeen++;
          projectBinocular2D(mf.x, mf.y, mf.z, 0.08, mf.guild === 1 ? 3 : 0, mf.r, mf.g, mf.b);
        }
      }
    }

    // 6) Run LGN -> V1 -> V2 -> V4 -> IT + MT hierarchy (on 20 Hz cortical refresh or lesion clear)
    if (doSheet) {
      this.processVisualCortex(false);
    } else if (lesionVision && !this._sheetsCleared) {
      this.processVisualCortex(true);
      this._sheetsCleared = true;
    }

    // 7) Azimuthal optic-flow summary
    let flowSum = 0;
    for (let b = 0; b < NBINS; b++) {
      const lum = 0.33 * (this.rgb[3 * b] + this.rgb[3 * b + 1] + this.rgb[3 * b + 2]) + 0.5 * this.loom[b];
      const df = Math.abs(lum - this.lumPrev[b]);
      this.lumPrev[b] = lum;
      this.flow[b] = 0.8 * this.flow[b] + 0.2 * df;
      flowSum += this.flow[b];
    }
    this.opticFlowMean = flowSum / NBINS;
  }

  sitePos(k, world) {
    if (globalThis.TW?.exactMap) {
      const P = world.plants[k];
      return { x: P.x, z: P.z, conf: 1 };
    }
    if (this.conf[k] > 0) return { x: this.memX[k], z: this.memZ[k], conf: this.conf[k] };
    const gx = ((k & 3) - 1.5) * 8.5, gz = ((k >> 2) - 1.5) * 8.5;
    return { x: gx, z: gz, conf: 0 };
  }

  poolPos(p, world) {
    const id = this.nSites + p;
    if (globalThis.TW?.exactMap) {
      const Wp = world.pools[p];
      return { x: Wp.x, z: Wp.z, conf: 1 };
    }
    if (this.conf[id] > 0) return { x: this.memX[id], z: this.memZ[id], conf: this.conf[id] };
    return null;
  }
}
