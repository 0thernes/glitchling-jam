// Full developmental genome (pass 12 -> pass 15 unified innate-to-plastic connectome).
// Expands a 78-gene developmental specification into ALL innate motor, synergy, vestibulo-ocular, roll-damping and steering
// pathways by segment identity and bilateral symmetry — eliminating all hand-wired synergy loops in creature.js and replacing
// hand-set steering genes with offline multi-body CMA-ES evolved parameters (further adaptable by in-page lineage evolution and
// lifelong 3-factor / EWC synaptic plasticity).
export const GENES = [
  // segmental CPG -> longitudinal & radial muscles (8)
  ['segAg0', 0, 4], ['segAg1', -2, 2], ['segAnt0', 0, 3], ['segAnt1', -2, 2],
  ['segTop', -1.5, 1.5], ['segRad', -1, 1], ['wvAsc', 0, 3], ['wvDesc', 0, 1.5],
  // leg oscillators -> leg swing / grip / extension & CPG coupling (13)
  ['sF', 0, 3.5], ['sB', -1.5, 1.5], ['gF', 0, 3], ['gB', -1.5, 1.5], ['eF', -1, 2.5], ['eB', -1.5, 1.5], ['eB2', -1.5, 1.5],
  ['cS', 0, 2.5], ['cO', -1.5, 1.5], ['rS', 0, 2.5], ['rO', -1.5, 1.5], ['tauA', 0.15, 0.8], ['cf', 0.3, 2.5],
  // arm oscillators -> arm muscles (4)
  ['aS', 0, 3], ['aR1', -1, 2], ['aR2', -1, 2], ['aG', -1, 2.5],
  // turn command MOT1/MOT2 bilateral axial + appendicular gradient (16)
  ['cturn', 0, 3], ['legTurn', -2, 2], ['t0', -1, 4], ['t1', -3, 3], ['tAnt', -1, 3], ['tRad0', -1, 3], ['tRad1', -3, 3],
  ['tGripIn', -2, 2], ['tGripOut', -2, 2], ['tSwIn', -2, 2], ['tSwOut', -2, 2], ['tExIn', -2, 2], ['tExOut', -2, 2],
  ['tArmIn', -2, 2], ['tArmOut', -2, 2], ['lift', 0, 0.8],
  // vestibular utricle static tilt + semicircular-canal dynamic roll-velocity damping (4)
  ['rLeg', -1, 3.5], ['rArm', -1, 3.5], ['rVent', -1, 3], ['rRollDamp', 0, 3.5],
  // whole-body motor synergies: pitch/rear (MOT3), reach (MOT4), grip (MOT5), jump (MOT6), curl (MOT7), stalk & gaze (13)
  ['synPitchLong', 0, 3], ['synPitchArm', 0, 2.5],
  ['synReachSw', 0, 2.5], ['synReachEx', 0, 2.5],
  ['synGripArm', 0, 2.5], ['synGripLeg', 0, 2.5],
  ['synJumpLeg', 0, 3.5], ['synJumpRad', 0, 2.5],
  ['synCurlVent', 0, 3], ['synCurlRad', 0, 2],
  ['synStalkTurn', 0, 2], ['synGazeYaw', 0, 2.8], ['synGazePitch', 0, 2.5],
];
export const NG = GENES.length;

/**
 * Sense -> MOT steering & postural-threshold genome (20 genes).
 * Sense phi indices:
 *   0 bearL, 1 bearR, 2 forage, 3 obstAhead, 4 nearGoal, 5 rockTouch, 6 stuck, 7 nociception,
 *   8 upsideDown, 9 springNear, 10 bearSin, 11 goalUp, 12 dreamPrior, 13 bias=1,
 *   14 tiltL, 15 tiltR, 16 rollVelL, 17 rollVelR, 18 obstL, 19 obstR.
 * MOT indices: 0 fwd, 1 turnL, 2 turnR, 3 pitch, 4 reach, 5 grip, 6 jump, 7 curl.
 */
export const STEER_GENES = [
  ['kBear', 0, 4.5], ['kSlow', 0, 3], ['kFwd', 0, 4.5], ['kStuckF', -2, 1],
  ['kObstP', 0, 2.5], ['kRockP', 0, 2], ['kNearR', 0, 3], ['kRockG', 0, 3], ['kObstG', 0, 2],
  ['kStuckJ', 0, 2], ['kSpringJ', 0, 2.5], ['kNociC', 0, 3], ['kUpsC', 0, 3], ['kDream', 0, 1.5],
  ['kBias', 0, 1.2], ['kBiasPost', -1.0, 0.5], ['kNearF', -2, 1], ['kCourse', 0, 1.2],
  ['kObstTurn', 0, 4.0], ['kObstSlow', -2.0, 0.5],
];

/**
 * Heritable 3D Evo-Devo Body Morphology & Neural-Allocation Genome (14 genes, total FULL_GENES = 92):
 * Co-evolves body segment spacing, rostro-caudal taper, radial muscle girth, forelimb/hindlimb proportions,
 * binocular eye-stalk baseline, dorsal thermoregulatory/display fin-crest, caudal tail fluke, ventral scute
 * friction anisotropy, anisotropic I4 myofibril continuum stiffness, chromatophore pigment hue, thermal niche,
 * hippocampal place/trisynaptic gain allocation, and cortical/neuromuscular plasticity gain!
 */
export const MORPH_GENES = [
  ['bodyLen', 0.85, 1.18],        // axial spine segment length multiplier (1.0 = starter)
  ['bodyTaper', -0.22, 0.22],     // rostro-caudal radius taper gradient (0.0 = starter)
  ['bodyGirth', 0.86, 1.16],      // radial muscle cross-section multiplier (1.0 = starter)
  ['foreLimb', 0.82, 1.24],       // anterior manipulator arm length multiplier (1.0 = starter)
  ['hindLimb', 0.84, 1.24],       // quadrupedal leg length multiplier (1.0 = starter)
  ['stalkHeight', 0.78, 1.32],    // binocular eye-stalk elevation & stereo baseline (1.0 = starter)
  ['crestFin', 0.20, 1.50],       // dorsal bioluminescent fin-crest height (0.65 = starter)
  ['tailFluke', 0.20, 1.50],      // caudal counter-balance & aquatic fluke span (0.60 = starter)
  ['scuteAniso', 0.75, 1.28],     // ventral directional scute ratchet anisotropy (1.0 = starter)
  ['fiberStiff', 0.72, 1.38],     // anisotropic I4 continuum collagen/myofibril stiffness (1.0 = starter)
  ['pigmentHue', 0.0, 1.0],       // heritable chromatophore baseline hue (0.52 = starter)
  ['thermOpt', 0.25, 0.75],       // metabolic thermal optimum (0.50 = starter)
  ['neuroHipAlloc', 0.78, 1.32],  // hippocampal place/trisynaptic drive allocation (1.0 = starter)
  ['neuroCtxPlastic', 0.70, 1.40],// cortical & motor STDP / 3-factor plasticity multiplier (1.0 = starter)
];

/**
 * Pass 18 Embryonic Hox + Morphogen Reaction-Diffusion Gene-Regulatory Network (GRN) Genome (16 genes -> FULL_GENES = 108):
 * Integrates a 4-morphogen (Anterior Wnt-antagonist, Thoracic Shh/Dll appendage field, Abdominal Fgf8, Dorsal Bmp4)
 * embryonic reaction-diffusion cascade across segments 0..6, expressing topological limb-pair count (2 = 4-limb quadruped,
 * 3 = 6-limb hexapod, 4 = 8-limb octopod), axial girth/stiffness profiles, dorsal osteoderm armor, gill/antenna barbules,
 * and Huxley actin-myosin cross-bridge maximum shortening velocity (sarcomereVmax).
 */
export const HOX_GENES = [
  ['hoxAnt', 0.25, 1.35],         // anterior HoxA / labial cranial-cervical identity (0.80 = starter)
  ['hoxThor', 0.25, 1.35],        // thoracic HoxB / Antennapedia appendage-field identity (0.85 = starter)
  ['hoxAbd', 0.25, 1.35],         // abdominal HoxC / Ultrabithorax trunk identity (0.75 = starter)
  ['hoxCaud', 0.25, 1.35],        // caudal HoxD / Abdominal-B tail identity (0.70 = starter)
  ['grnAA', -0.55, 0.55],         // GRN anterior auto-regulation weight (0.0 = starter)
  ['grnAB', -0.55, 0.55],         // GRN anterior -> thoracic cross-regulation (0.0 = starter)
  ['grnBA', -0.55, 0.55],         // GRN abdominal -> thoracic Ultrabithorax repression (0.0 = starter)
  ['grnBB', -0.55, 0.55],         // GRN thoracic bistable self-activation (0.0 = starter)
  ['grnShh', 0.45, 1.55],         // Sonic hedgehog (Shh) ventral/limb-bud outgrowth gain (1.0 = starter)
  ['grnFgf', 0.45, 1.55],         // FGF8 posterior elongation & somite wave gain (1.0 = starter)
  ['grnBmp', 0.45, 1.55],         // BMP4 dorsal crest & osteoderm mineralization gain (1.0 = starter)
  ['grnWnt', 0.45, 1.55],         // Canonical Wnt rostro-caudal organizer slope (1.0 = starter)
  ['limbTopo', 0.0, 1.0],         // macro-bauplan selector (<0.14 => 0L, 0.14..0.34 => 4L, 0.34..0.66 => 6L, 0.66..0.86 => 8L, >0.86 => 10L)
  ['osteoderm', 0.05, 1.25],      // dorsal osteoderm scute armor relief & dermal toughness (0.45 = starter)
  ['gillFronds', 0.15, 1.45],     // cephalic chemotactic antenna / gill-barbule span (0.68 = starter)
  ['sarcomereVmax', 0.65, 1.45],  // Huxley sarcomere actin-myosin max shortening velocity Vmax (1.0 = starter)
];

/**
 * Pass 19 Single-Cell Zygote Cleavage, 3D Gastrulation, Somitogenesis & Macro-Bauplan Speciation Genome (20 genes -> FULL_GENES = 128):
 * Governs 7 mitotic cleavage divisions (1 -> 2 -> 4 -> 8 -> 16 -> 32 -> 64 -> 128 3D blastomeres), maternal polarity gradients,
 * E-/N-cadherin differential adhesion, Spemann-Mangold Nodal/Lefty/Chordin gastrulation into Ectoderm/Mesoderm/Endoderm + Neural Crest,
 * Hes7/Notch clock-and-wavefront somitogenesis, 5 macro-clades (0L Serpent, 4L Tetrapod, 6L Hexapod, 8L Octopod, 10L Decapod),
 * gliding Patagium wing-membranes, cranial bioluminescent Angler-Lure (esca), Henneman muscle-fascicle recruitment & speciation isolation.
 */
export const ZYGOTE_GENES = [
  ['bicoidAnt', 0.45, 1.55],      // maternal anterior Bicoid morphogen gradient (1.0 = starter)
  ['nanosPost', 0.45, 1.55],      // maternal posterior Nanos/Caudal morphogen gradient (1.0 = starter)
  ['dorsalVent', 0.45, 1.55],     // maternal Dorsal/Toll nuclear dorso-ventral gradient (1.0 = starter)
  ['chordinDors', 0.45, 1.55],    // Spemann-Mangold Chordin/Noggin dorsal BMP antagonist (1.0 = starter)
  ['cleavAsym', -0.35, 0.35],     // mitotic spindle cleavage-plane spiral/asymmetry bias (0.0 = starter)
  ['cadhE', 0.50, 1.50],          // E-cadherin ectodermal differential cell-cell adhesion (1.0 = starter)
  ['cadhN', 0.50, 1.50],          // N-cadherin neural-plate & paraxial mesoderm adhesion (1.0 = starter)
  ['nodalOrg', 0.45, 1.55],       // Nodal endomesodermal gastrulation invagination drive (1.0 = starter)
  ['leftyInh', 0.45, 1.55],       // Lefty long-range reaction-diffusion Nodal inhibitor (1.0 = starter)
  ['hes7Clock', 0.55, 1.55],      // Hes7/Her1 presomitic segmentation clock frequency (1.0 = starter)
  ['notchWave', 0.50, 1.50],      // Delta-Notch intercellular somite phase-synchrony gain (1.0 = starter)
  ['tbxFore', 0.45, 1.55],        // Tbx5 pectoral/forelimb field selector (1.0 = starter)
  ['tbxHind', 0.45, 1.55],        // Tbx4/Pitx1 pelvic/posterior field selector (1.0 = starter)
  ['patagiumSpan', 0.0, 1.35],    // lateral gliding patagium wing-membrane span (0.18 = starter)
  ['anglerLure', 0.0, 1.40],      // cranial neural-crest bioluminescent esca / angler-lure stalk (0.24 = starter)
  ['undulWave', 0.40, 1.85],      // anguilliform lateral axial travelling-wave gain (1.0 = starter)
  ['decapodBud', 0.0, 1.0],       // supernumerary thoracic/abdominal appendage permissive factor (0.50 = starter)
  ['fascicleRecruit', 0.60, 1.45],// Henneman size-principle slow-to-fast muscle fascicle recruitment slope (1.0 = starter)
  ['myelinCond', 0.65, 1.45],     // oligodendrocyte/Schwann axonal myelination velocity gain (1.0 = starter)
  ['speciationIso', 0.0, 1.0],    // assortative pre-zygotic clade recognition & speciation locus (0.50 = starter)
];

export const CLADE_NAMES = {
  0: '0L Serpent',
  2: '4L Tetrapod',
  3: '6L Hexapod',
  4: '8L Octopod',
  5: '10L Decapod',
};

export const FULL_GENES = [...GENES, ...STEER_GENES, ...MORPH_GENES, ...HOX_GENES, ...ZYGOTE_GENES];

/**
 * Simulate single-cell fertilized zygote embryogenesis through 7 mitotic cleavage divisions (1 -> 2 -> 4 -> 8 -> 16 -> 32 -> 64 -> 128
 * 3D blastomeres), blastocoel cavitation, Spemann-Mangold Nodal/Lefty/Chordin gastrulation into 3 primary germ layers + neural crest,
 * cadherin differential-adhesion sorting, convergent-extension neurulation, and Hes7/Notch clock-and-wavefront somitogenesis.
 */
export function developZygoteEmbryo(g = {}) {
  const bic0 = g.bicoidAnt ?? 1.0, nan0 = g.nanosPost ?? 1.0;
  const dor0 = g.dorsalVent ?? 1.0, chd0 = g.chordinDors ?? 1.0;
  const asym = g.cleavAsym ?? 0.0;
  const cadE = g.cadhE ?? 1.0, cadN = g.cadhN ?? 1.0;
  const nodalG = g.nodalOrg ?? 1.0, leftyG = g.leftyInh ?? 1.0;
  const hes7 = g.hes7Clock ?? 1.0, notch = g.notchWave ?? 1.0;

  // Start from N = 1 single fertilized zygote cell at embryonic origin
  let cells = [{
    x: 0, y: 0, z: 0, r: 1.0,
    bic: bic0, nan: nan0, dor: dor0, chd: chd0,
    nodal: 0.5 * nodalG, germ: 0, somite: 3,
  }];

  // 7 mitotic cleavage divisions: 1 -> 2 -> 4 -> 8 -> 16 -> 32 -> 64 -> 128 blastomeres
  for (let div = 0; div < 7; div++) {
    const next = [];
    const daughterR = Math.cbrt(0.5) ** (div + 1);
    const sep = 0.36 * daughterR;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      // Canonical embryonic cleavage axis schedule: meridional X, meridional Z, equatorial Y, then spiral/oblique 3D axes
      let ax = 0, ay = 0, az = 0;
      if (div === 0) { ax = 1; ay = 0.12 * asym; }
      else if (div === 1) { az = 1; ax = 0.15 * asym; }
      else if (div === 2) { ay = 1; az = 0.15 * asym; }
      else {
        const ang = (div * 1.91 + i * 0.6180339887) + asym * 0.85;
        const el = ((i & 3) - 1.5) * 0.42 + 0.2 * asym;
        const ce = Math.cos(el);
        ax = ce * Math.cos(ang);
        ay = Math.sin(el);
        az = ce * Math.sin(ang);
      }
      const norm = Math.hypot(ax, ay, az) || 1;
      ax /= norm; ay /= norm; az /= norm;
      const volSplit = 0.5 + 0.08 * asym * (div >= 2 ? ay : ax);
      const rA = daughterR * Math.cbrt(2 * volSplit);
      const rB = daughterR * Math.cbrt(2 * (1 - volSplit));

      // Asymmetric cytoplasmic mRNA partitioning along maternal animal-vegetal & anterior-posterior poles
      const dBic = 0.18 * ax * bic0, dNan = -0.18 * ax * nan0;
      const dDor = -0.20 * ay * dor0, dChd = 0.16 * (0.7 * ay + 0.3 * ax) * chd0;
      next.push({
        x: c.x + ax * sep, y: c.y + ay * sep, z: c.z + az * sep, r: rA,
        bic: Math.max(0.02, c.bic + dBic), nan: Math.max(0.02, c.nan + dNan),
        dor: Math.max(0.02, c.dor + dDor), chd: Math.max(0.02, c.chd + dChd),
        nodal: 0, germ: 0, somite: 0,
      });
      next.push({
        x: c.x - ax * sep, y: c.y - ay * sep, z: c.z - az * sep, r: rB,
        bic: Math.max(0.02, c.bic - dBic), nan: Math.max(0.02, c.nan - dNan),
        dor: Math.max(0.02, c.dor - dDor), chd: Math.max(0.02, c.chd - dChd),
        nodal: 0, germ: 0, somite: 0,
      });
    }
    cells = next;
  }

  // Blastula cavitation + Spemann-Mangold Nodal/Lefty gastrulation & convergent-extension neurulation
  const N = cells.length; // 128 blastomeres
  let meanNodal = 0;
  for (let i = 0; i < N; i++) {
    const c = cells[i];
    const rad = Math.hypot(c.x, c.y, c.z) || 1e-4;
    // Hollow blastocoel cavitation pushes blastomeres onto blastoderm shell prior to invagination
    const shell = 0.62 + 0.28 * rad;
    c.x = (c.x / rad) * shell;
    c.y = (c.y / rad) * shell;
    c.z = (c.z / rad) * shell;
    c.nodal = nodalG * (0.55 * c.dor + 0.35 * c.nan) / (0.65 + 0.45 * leftyG * c.bic);
    meanNodal += c.nodal / N;
  }

  let ectoCount = 0, mesoCount = 0, endoCount = 0, crestCount = 0;
  const somiteMeso = new Float64Array(7);
  const somiteCrest = new Float64Array(7);
  const somiteCounts = new Uint16Array(7);

  for (let i = 0; i < N; i++) {
    const c = cells[i];
    const relNodal = c.nodal / (meanNodal || 1);
    // Germ-layer specification + gastrulation invagination + cadherin sorting + convergent-extension AP elongation
    if (relNodal > 1.26) {
      c.germ = 2; // Endoderm (vegetal archenteron gut tube)
      c.y *= 0.28;
      c.z *= 0.42;
      endoCount++;
    } else if (relNodal > 0.90) {
      c.germ = 1; // Paraxial & lateral-plate Mesoderm (involuting through blastopore lip)
      c.y *= 0.58;
      c.z *= 0.78 / Math.max(0.6, cadN);
      mesoCount++;
    } else if (c.chd > 0.96 * chd0 && c.y > 0.08) {
      c.germ = 3; // Dorsal Neural Plate / Neural Crest (Chordin BMP-inhibition + N-cadherin neurulation)
      c.y = Math.min(0.85, c.y * 1.08);
      c.z *= 0.45 / Math.max(0.6, cadN);
      crestCount++;
    } else {
      c.germ = 0; // Surface Epidermal Ectoderm (E-cadherin epithelial sheet)
      c.z *= 0.95 * Math.min(1.25, cadE);
      ectoCount++;
    }
    // Planar-cell-polarity (Wnt/PCP) convergent-extension elongates rostro-caudal X axis
    c.x = c.x * (1.35 + 0.22 * (c.bic - c.nan));

    // Hes7 + Delta-Notch clock-and-wavefront somitogenesis maps AP coordinate + phase wave onto 7 somites (0 tail .. 6 head)
    const uAP = Math.min(0.999, Math.max(0, 0.5 + 0.42 * c.x));
    const clockWave = 0.035 * notch * Math.sin(2 * Math.PI * 7 * hes7 * uAP);
    const sIdx = Math.min(6, Math.max(0, Math.floor((uAP + clockWave) * 7)));
    c.somite = sIdx;
    somiteCounts[sIdx]++;
    if (c.germ === 1) somiteMeso[sIdx] += 1;
    if (c.germ === 3) somiteCrest[sIdx] += 1;
  }

  return {
    blastomeres: N,
    ectoCount,
    mesoCount,
    endoCount,
    crestCount,
    somiteCounts,
    somiteMeso,
    somiteCrest,
    cells,
  };
}

const REF_ZYGOTE = developZygoteEmbryo({});

function runHoxCascade(g, zyg = null) {
  const NS = 7;
  const Z = zyg || developZygoteEmbryo(g);
  const hAnt = g.hoxAnt ?? 0.80, hThor = g.hoxThor ?? 0.85, hAbd = g.hoxAbd ?? 0.75, hCaud = g.hoxCaud ?? 0.70;
  const wAA = g.grnAA ?? 0.0, wAB = g.grnAB ?? 0.0, wBA = g.grnBA ?? 0.0, wBB = g.grnBB ?? 0.0;
  const shh = g.grnShh ?? 1.0, fgf = g.grnFgf ?? 1.0, bmp = g.grnBmp ?? 1.0, wnt = g.grnWnt ?? 1.0;
  const bic = g.bicoidAnt ?? 1.0, nan = g.nanosPost ?? 1.0, chd = g.chordinDors ?? 1.0;

  const A = new Float64Array(NS), T = new Float64Array(NS), B = new Float64Array(NS), D = new Float64Array(NS);
  const nA = new Float64Array(NS), nT = new Float64Array(NS), nB = new Float64Array(NS), nD = new Float64Array(NS);

  // Maternal + gastrulated somitic mesoderm/neural-crest morphogen boundary conditions (s = 0 tail .. s = 6 head)
  for (let s = 0; s < NS; s++) {
    const u = s / (NS - 1); // 0 = caudal, 1 = rostral
    const mesoBoost = 0.88 + 0.12 * (Z.somiteMeso[s] / Math.max(1, REF_ZYGOTE.somiteMeso[s] || 6));
    const crestBoost = 0.90 + 0.10 * (Z.somiteCrest[s] / Math.max(1, REF_ZYGOTE.somiteCrest[s] || 3));
    A[s] = hAnt * Math.exp(-((1 - u) ** 2) / 0.18) * wnt * bic * crestBoost;
    T[s] = hThor * Math.exp(-((u - 0.52) ** 2) / 0.16) * shh * mesoBoost;
    B[s] = (hAbd * Math.exp(-((u - 0.26) ** 2) / 0.16) * fgf + 0.35 * hCaud * (1 - u) * nan) * mesoBoost;
    D[s] = (0.55 * bmp / Math.max(0.55, 0.35 + 0.65 * chd)) * (0.6 + 0.4 * Math.sin(Math.PI * u)) * crestBoost;
  }

  const tanh = Math.tanh;
  const diff = 0.16, dt = 0.28;
  for (let step = 0; step < 6; step++) {
    for (let s = 0; s < NS; s++) {
      const sL = s > 0 ? s - 1 : s, sR = s + 1 < NS ? s + 1 : s;
      const lapA = A[sL] + A[sR] - 2 * A[s];
      const lapT = T[sL] + T[sR] - 2 * T[s];
      const lapB = B[sL] + B[sR] - 2 * B[s];
      const lapD = D[sL] + D[sR] - 2 * D[s];

      const rA = tanh(0.9 * A[s] + wAA * A[s] - 0.35 * B[s]) - 0.75 * A[s];
      const rT = tanh((0.85 + wBB) * T[s] + wAB * A[s] - (0.30 - wBA) * B[s] + 0.18 * shh) - 0.72 * T[s];
      const rB = tanh(0.88 * B[s] - 0.30 * A[s] + 0.15 * fgf) - 0.74 * B[s];
      const rD = tanh(0.75 * D[s] + 0.25 * bmp * (T[s] + 0.5 * A[s])) - 0.70 * D[s];

      nA[s] = Math.max(0.02, A[s] + dt * (diff * lapA + rA));
      nT[s] = Math.max(0.02, T[s] + dt * (diff * lapT + rT));
      nB[s] = Math.max(0.02, B[s] + dt * (diff * lapB + rB));
      nD[s] = Math.max(0.02, D[s] + dt * (diff * lapD + rD));
    }
    A.set(nA); T.set(nT); B.set(nB); D.set(nD);
  }
  return { A, T, B, D, zygote: Z };
}

const REF_HOX = runHoxCascade({}, REF_ZYGOTE);

/**
 * Evaluate the 128-gene Single-Cell Zygote Cleavage -> Gastrulation -> Somitogenesis -> Hox-GRN cascade
 * to express adult macro-bauplan clade (0L/4L/6L/8L/10L), patagium wings, angler-lure & segmental tissue properties.
 * Normalized relative to REF_HOX so STARTER keeps exact calibrated 1.0 baseline gains while mutations sculpt topology & form.
 */
export function evalHoxGRN(g = {}) {
  const zyg = developZygoteEmbryo(g);
  const { A, T, B, D } = runHoxCascade(g, zyg);
  const segGirthMod = new Float64Array(7);
  const segStiffMod = new Float64Array(7);
  const osteodermProfile = new Float64Array(7);
  const cpgPhaseBias = new Float64Array(5);
  const osteoBase = Math.min(1.5, Math.max(0, g.osteoderm ?? 0.45));

  for (let s = 0; s < 7; s++) {
    const dT = T[s] - REF_HOX.T[s], dB = B[s] - REF_HOX.B[s], dA = A[s] - REF_HOX.A[s], dD = D[s] - REF_HOX.D[s];
    segGirthMod[s] = Math.min(1.26, Math.max(0.78, 1.0 + 0.24 * dT + 0.18 * dB - 0.10 * dA));
    segStiffMod[s] = Math.min(1.34, Math.max(0.74, 1.0 + 0.28 * dD + 0.15 * dT));
    osteodermProfile[s] = Math.min(1.6, Math.max(0.02, osteoBase * (0.65 + 0.55 * (D[s] / (REF_HOX.D[s] || 1)))));
  }
  for (let s = 0; s < 5; s++) {
    const grad = (B[s + 1] - B[s]) - (REF_HOX.B[s + 1] - REF_HOX.B[s]);
    cpgPhaseBias[s] = Math.min(0.28, Math.max(-0.28, 0.45 * grad));
  }

  // Integrated Tbx5/Tbx4/Dll/Shh limb-field score maps continuously onto 5 macro-evolutionary clades:
  //   0 = 0L Serpent (0 limbs), 2 = 4L Tetrapod (4 limbs), 3 = 6L Hexapod (6 limbs, starter),
  //   4 = 8L Octopod (8 limbs), 5 = 10L Decapod (10 limbs)!
  const thorDelta =
    ((T[2] + T[3]) - (REF_HOX.T[2] + REF_HOX.T[3])) * 0.24 +
    0.18 * ((g.decapodBud ?? 0.50) - 0.50) +
    0.08 * ((g.tbxFore ?? 1.0) + (g.tbxHind ?? 1.0) - 2.0);
  const topoScore = (g.limbTopo ?? 0.50) + thorDelta;
  const limbPairs =
    topoScore < 0.14 ? 0 :
    topoScore < 0.34 ? 2 :
    topoScore <= 0.66 ? 3 :
    topoScore <= 0.86 ? 4 : 5;

  const patagium = Math.min(1.35, Math.max(0, g.patagiumSpan ?? 0.18));
  const anglerLure = Math.min(1.40, Math.max(0, (g.anglerLure ?? 0.24) * (0.75 + 0.25 * (zyg.crestCount / Math.max(1, REF_ZYGOTE.crestCount)))));

  return {
    limbPairs,
    cladeName: CLADE_NAMES[limbPairs] || `${limbPairs * 2}L`,
    topoScore,
    segGirthMod,
    segStiffMod,
    osteodermProfile,
    cpgPhaseBias,
    osteoderm: osteoBase,
    gillFronds: Math.min(1.6, Math.max(0.1, g.gillFronds ?? 0.68)),
    sarcomereVmax: Math.min(1.6, Math.max(0.55, g.sarcomereVmax ?? 1.0)),
    patagium,
    anglerLure,
    undulWave: Math.min(1.85, Math.max(0.40, g.undulWave ?? 1.0)),
    fascicleRecruit: Math.min(1.45, Math.max(0.60, g.fascicleRecruit ?? 1.0)),
    myelinCond: Math.min(1.45, Math.max(0.65, g.myelinCond ?? 1.0)),
    speciationIso: Math.min(1.0, Math.max(0.0, g.speciationIso ?? 0.50)),
    zygote: {
      blastomeres: zyg.blastomeres,
      ectoderm: zyg.ectoCount,
      mesoderm: zyg.mesoCount,
      endoderm: zyg.endoCount,
      neuralCrest: zyg.crestCount,
      somites: zyg.somiteCounts,
      cells: zyg.cells,
    },
  };
}

/** Legacy pass-1..14 hand values kept solely as an ablation comparison point */
export const HAND_STEER = {
  kBear: 1.8, kSlow: 0, kFwd: 2.2, kStuckF: -0.4, kObstP: 1.5, kRockP: 0.6, kNearR: 1.8, kRockG: 1.4, kObstG: 0.5,
  kStuckJ: 0.7, kSpringJ: 1.0, kNociC: 1.6, kUpsC: 1.6, kDream: 0.5, kBias: 0.55, kBiasPost: 0.55,
  kNearF: 0, kCourse: 0, kObstTurn: 0, kObstSlow: 0,
};
export const HAND = {
  segAg0: 2.2, segAg1: 0, segAnt0: 1.2, segAnt1: 0, segTop: 0, segRad: 0.4, wvAsc: 1.6, wvDesc: 0.4,
  sF: 2.2, sB: 0, gF: 1.8, gB: 0, eF: 1.0, eB: 0, eB2: 0, cS: 1.2, cO: 0, rS: 1.2, rO: 0, tauA: 0.35, cf: 1.3,
  aS: 1.8, aR1: 1.2, aR2: 0.6, aG: 1.5, cturn: 1.4, legTurn: 0, t0: 2.4, t1: 0, tAnt: 1.6, tRad0: 1.5, tRad1: 0,
  tGripIn: 0, tGripOut: 0, tSwIn: 0, tSwOut: 0, tExIn: 0, tExOut: 0, tArmIn: 0, tArmOut: 0, lift: 0.5,
  rLeg: 1.8, rArm: 1.4, rVent: 1.2, rRollDamp: 0,
  synPitchLong: 1.6, synPitchArm: 1.4, synReachSw: 1.5, synReachEx: 1.2, synGripArm: 1.6, synGripLeg: 1.4,
  synJumpLeg: 2.4, synJumpRad: 1.4, synCurlVent: 1.6, synCurlRad: 0.8, synStalkTurn: 0.8, synGazeYaw: 1.6, synGazePitch: 1.2,
};

/** Grow the 8 x NPHI sense -> MOT steering & synergy-gating matrix */
export function developSteer(g, M) {
  M(0, 2, g.kFwd);
  M(0, 6, g.kStuckF);
  M(0, 0, -g.kSlow);
  M(0, 1, -g.kSlow);
  M(0, 4, g.kNearF ?? 0);
  M(0, 3, g.kObstSlow ?? 0);
  M(0, 12, g.kDream);

  // Goal bearing + retinal lateral boulder-avoidance reflex (boulder on left -> turn right; boulder on right -> turn left)
  M(1, 0, g.kBear);
  M(2, 1, g.kBear);
  M(2, 18, g.kObstTurn ?? 0);
  M(1, 19, g.kObstTurn ?? 0);

  // Postural & episodic synergies: triggered by specific affordances, NOT tonic walking bias
  M(3, 3, g.kObstP);
  M(3, 5, g.kRockP);
  M(4, 4, g.kNearR);
  M(5, 5, g.kRockG);
  M(5, 3, g.kObstG);
  M(6, 6, g.kStuckJ);
  M(6, 9, g.kSpringJ);
  M(7, 7, g.kNociC);
  M(7, 8, g.kUpsC);

  const bLoco = g.kBias ?? 0.55;
  const bPost = g.kBiasPost ?? 0.08;
  M(0, 13, bLoco);
  M(1, 13, bLoco * 0.35);
  M(2, 13, bLoco * 0.35);
  for (let m = 3; m < 8; m++) M(m, 13, bPost);
}

export const toObj = (v, spec = GENES) => Object.fromEntries(spec.map(([n], i) => [n, v[i]]));
export const toVec = (o, spec = GENES) => spec.map(([n, lo, hi]) => o[n] ?? (lo + hi) * 0.5);
export const clampGenome = (v, spec = GENES) => v.map((x, i) => Math.min(spec[i][2], Math.max(spec[i][1], x)));

/**
 * Expand a full developmental genome into neuromuscular & sensory-motor synapses:
 *  wc(ch, ant, cpgNeuron, w), wm(ch, ant, mot, w), wp(ch, ant, phi, w)
 */
export function develop(g, CH, wc, wm, wp) {
  // 1) Segmental axial CPG wave
  for (let s = 0; s < 6; s++) {
    const L = 2 * s, R = L + 1, lch = CH.long + s * 4 + 1, rch = CH.long + s * 4 + 3, p = s / 5;
    const ag = g.segAg0 + g.segAg1 * p, an = g.segAnt0 + g.segAnt1 * p;
    wc(lch, 0, L, ag); wc(rch, 1, L, an);
    wc(rch, 0, R, ag); wc(lch, 1, R, an);
    wc(CH.long + s * 4, 0, L, g.segTop); wc(CH.long + s * 4 + 2, 0, R, g.segTop);
    wc(CH.radial + s, 0, L, g.segRad); wc(CH.radial + s + 1, 1, R, g.segRad);
  }
  // 2) Quadrupedal leg CPG -> swing, plantar grip & stance extension
  for (let l = 0; l < 4; l++) {
    const F = 12 + 2 * l, B = F + 1, sw = CH.leg + l * 2;
    wc(sw, 0, F, g.sF); wc(sw, 1, B, g.sF); wc(sw, 0, B, g.sB); wc(sw, 1, F, g.sB);
    wc(CH.legGrip + l, 1, F, g.gF); wc(CH.legGrip + l, 0, B, g.gF);
    wc(CH.legGrip + l, 0, F, g.gB); wc(CH.legGrip + l, 1, B, g.gB);
    wc(sw + 1, 0, F, g.eF); wc(sw + 1, 0, B, g.eB); wc(sw + 1, 1, F, g.eB2);
  }
  // 3) Anterior raptorial/manipulator arms
  for (let a = 0; a < 2; a++) {
    const F = 20 + 2 * a, B = F + 1, sw = CH.arm + a * 3;
    wc(sw, 0, F, g.aS); wc(sw, 1, B, g.aS);
    wc(sw + 2, 0, F, g.aR1); wc(sw + 2, 1, B, g.aR2);
    wc(CH.armGrip + a, 0, B, g.aG);
  }
  // 4) Bilateral turning synergies (MOT1 = turn left, MOT2 = mirror turn right)
  for (const [mot, inSide] of [[1, 1], [2, 3]]) {
    const outSide = inSide === 1 ? 3 : 1;
    for (let s = 0; s < 6; s++) {
      const p = s / 5;
      wm(CH.long + s * 4 + inSide, 0, mot, g.t0 + g.t1 * p);
      wm(CH.long + s * 4 + outSide, 1, mot, g.tAnt);
    }
    for (let s = 0; s < 7; s++) {
      const v = g.tRad0 + g.tRad1 * (s / 6 - 0.5);
      if (v > 0) wm(CH.radial + s, 0, mot, v); else wm(CH.radial + s, 1, mot, -v);
    }
    for (let l = 0; l < 4; l++) {
      const side = l & 1 ? 3 : 1, inn = side === inSide;
      const gi = inn ? g.tGripIn : g.tGripOut, si = inn ? g.tSwIn : g.tSwOut, ei = inn ? g.tExIn : g.tExOut;
      wm(CH.legGrip + l, gi >= 0 ? 0 : 1, mot, Math.abs(gi));
      wm(CH.leg + l * 2, si >= 0 ? 0 : 1, mot, Math.abs(si));
      wm(CH.leg + l * 2 + 1, ei >= 0 ? 0 : 1, mot, Math.abs(ei));
    }
    for (let a = 0; a < 2; a++) {
      const side = a ? 3 : 1, v = side === inSide ? g.tArmIn : g.tArmOut;
      wm(CH.arm + a * 3, v >= 0 ? 0 : 1, mot, Math.abs(v));
    }
  }
  // 5) Vestibular static righting (utricle P[14], P[15]) + dynamic roll-velocity outrigger damping (semicircular canal P[16], P[17])
  const rd = g.rRollDamp ?? 1.4;
  for (const [pTilt, pRate, down] of [[14, 16, 1], [15, 17, 3]]) {
    for (let l = 0; l < 4; l++) {
      if ((l & 1 ? 3 : 1) === down) {
        wp(CH.leg + l * 2 + 1, 0, pTilt, g.rLeg);
        wp(CH.leg + l * 2 + 1, 0, pRate, rd);
      }
    }
    for (let a = 0; a < 2; a++) {
      if ((a ? 3 : 1) === down) {
        wp(CH.arm + a * 3 + 1, 0, pTilt, g.rArm);
        wp(CH.arm + a * 3 + 1, 0, pRate, 0.8 * rd);
      }
    }
    for (let sg = 0; sg < 6; sg++) wp(CH.long + sg * 4 + 2, 0, pTilt, g.rVent);
  }
  // 6) Evolved whole-body synergies (previously hand-wired in creature.js):
  //    MOT3 pitch/rear, MOT4 reach, MOT5 grip, MOT6 jump, MOT7 curl, eye-stalk turn lead & 3-eye foveation gaze
  const pL = g.synPitchLong ?? 1.4, pA = g.synPitchArm ?? 1.2;
  const rSw = g.synReachSw ?? 1.5, rEx = g.synReachEx ?? 1.2;
  const gA = g.synGripArm ?? 1.6, gL = g.synGripLeg ?? 1.4;
  const jL = g.synJumpLeg ?? 2.2, jR = g.synJumpRad ?? 1.3;
  const cV = g.synCurlVent ?? 1.5, cR = g.synCurlRad ?? 0.8;
  const stT = g.synStalkTurn ?? 0.85, gzY = g.synGazeYaw ?? 1.6, gzP = g.synGazePitch ?? 1.2;

  for (let s = 0; s < 6; s++) {
    wm(CH.long + s * 4, 0, 3, pL);
    wm(CH.long + s * 4 + 2, 0, 7, cV);
    wm(CH.radial + s, 1, 7, cR);
  }
  wm(CH.radial + 6, 0, 6, jR);
  for (let a = 0; a < 2; a++) {
    wm(CH.arm + a * 3, 0, 4, rSw);
    wm(CH.arm + a * 3 + 1, 0, 4, rEx);
    wm(CH.arm + a * 3 + 2, 0, 3, pA);
    wm(CH.armGrip + a, 0, 5, gA);
  }
  for (let l = 0; l < 4; l++) {
    wm(CH.legGrip + l, 0, 5, gL);
    wm(CH.leg + l * 2 + 1, 0, 6, jL);
  }
  for (let i = 0; i < 7; i++) wm(CH.radial + i, 0, 6, jR);
  for (let s = 0; s < 2; s++) {
    wm(CH.stalk + s * 2, 0, 1, stT);
    wm(CH.stalk + s * 2, 1, 2, stT);
  }
  for (let e = 0; e < 3; e++) {
    wp(CH.gaze + e * 2, 0, 10, gzY);
    wp(CH.gaze + e * 2, 1, 10, -gzY);
    wp(CH.gaze + e * 2 + 1, 0, 11, gzP);
    wp(CH.gaze + e * 2 + 1, 1, 11, -gzP);
  }
}
