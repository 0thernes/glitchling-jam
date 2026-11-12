// Shipped full 78-gene developmental starter genome (58 motor/CPG/turning/righting/synergy/gaze + 20 sense->MOT steering/obstacle/posture).
// Found by two-stage multi-body rough-ground CMA-ES across 6 training bodies (seeds 1,2,3,9,10,11) and verified on held-out bodies:
//   - Stage 1 (evolve_genome.mjs, 16 gens x 16 = 256 multi-body genomes on rough terrain with rocks, springs & zig-zag trials):
//     held-out rough fitness (seeds 4,5,6,7,8,12) rose from 5.05 (pass 14) / 5.30 to 5.55 (v = 0.67 u/s, up = 0.92, upZ = 0.94).
//   - Stage 2 (evolve_steer.mjs, 12 gens x 12 = 144 multi-body closed-loop near+far navigation genomes on seeds 1,2,3,9,10,11):
//     reached 12/12 training goals and beat HAND_STEER on held-out bodies 4,5,6,7,8,12,13,14 (fit 1.939 vs 1.824, 15/16 arrived
//     in 45 s, upright 0.920 vs 0.894, inverted steps 0.49% vs 2.55%).
export const MOTOR = {
  segAg0: 1.632, segAg1: 0.6459, segAnt0: 0.0789, segAnt1: -1.2376, segTop: 1.2319, segRad: -0.5279, wvAsc: 0, wvDesc: 1.3519,
  sF: 3.0408, sB: -1.4223, gF: 2.1798, gB: -1.0966, eF: 1.1843, eB: -1.1578, eB2: -0.1029,
  cS: 1.4571, cO: -1.1298, rS: 2.1257, rO: -1.0935, tauA: 0.705, cf: 2.1508,
  aS: 1.7425, aR1: -0.0302, aR2: 1.9338, aG: -0.6166,
  cturn: 1.527, legTurn: -1.296, t0: 1.436, t1: 1.0485, tAnt: -0.271, tRad0: 0.6069, tRad1: 2.0418,
  tGripIn: -0.5406, tGripOut: -1.4304, tSwIn: 2, tSwOut: -0.3847, tExIn: -0.2895, tExOut: -1.9549, tArmIn: 2, tArmOut: -1.3165,
  lift: 0.6357, rLeg: 1.8867, rArm: 2.3533, rVent: 1.6432, rRollDamp: 1.0283,
  synPitchLong: 1.1475, synPitchArm: 1.1061, synReachSw: 1.285, synReachEx: 1.1161, synGripArm: 1.6457, synGripLeg: 1.4112,
  synJumpLeg: 2.3256, synJumpRad: 0.9427, synCurlVent: 1.2676, synCurlRad: 0.4145, synStalkTurn: 0.9238, synGazeYaw: 1.6312, synGazePitch: 1.2553,
};

export const STEER = {
  kBear: 2.0993, kSlow: 0.1138, kFwd: 2.5975, kStuckF: -0.4949,
  kObstP: 0.0935, kRockP: 0.0252, kNearR: 1.6822, kRockG: 1.4278, kObstG: 0.627,
  kStuckJ: 0.2796, kSpringJ: 0.5344, kNociC: 1.6271, kUpsC: 0, kDream: 0.6162,
  kBias: 0.5279, kBiasPost: 0.0134, kNearF: 0.0535, kCourse: 0,
  kObstTurn: 1.2079, kObstSlow: -0.1069,
};

export const MORPH = {
  bodyLen: 1.0, bodyTaper: 0.0, bodyGirth: 1.0, foreLimb: 1.0, hindLimb: 1.0, stalkHeight: 1.0,
  crestFin: 0.65, tailFluke: 0.60, scuteAniso: 1.0, fiberStiff: 1.0, pigmentHue: 0.52, thermOpt: 0.50,
  neuroHipAlloc: 1.0, neuroCtxPlastic: 1.0,
};

export const HOX = {
  hoxAnt: 0.80, hoxThor: 0.85, hoxAbd: 0.75, hoxCaud: 0.70,
  grnAA: 0.0, grnAB: 0.0, grnBA: 0.0, grnBB: 0.0,
  grnShh: 1.0, grnFgf: 1.0, grnBmp: 1.0, grnWnt: 1.0,
  limbTopo: 0.50, osteoderm: 0.45, gillFronds: 0.68, sarcomereVmax: 1.0,
};

export const ZYGOTE = {
  bicoidAnt: 1.0, nanosPost: 1.0, dorsalVent: 1.0, chordinDors: 1.0,
  cleavAsym: 0.0, cadhE: 1.0, cadhN: 1.0, nodalOrg: 1.0, leftyInh: 1.0,
  hes7Clock: 1.0, notchWave: 1.0, tbxFore: 1.0, tbxHind: 1.0,
  patagiumSpan: 0.18, anglerLure: 0.24, undulWave: 1.0, decapodBud: 0.50,
  fascicleRecruit: 1.0, myelinCond: 1.0, speciationIso: 0.50,
};

export const STARTER = { ...MOTOR, ...STEER, ...MORPH, ...HOX, ...ZYGOTE };
export const STARTER_INFO = {
  source: 'two-stage multi-body CMA-ES + 128-gene Zygote-Cleavage / Gastrulation / Hox-GRN Evo-Devo specification (58 motor + 20 steering + 14 morpho/neuro + 16 Hox-GRN + 20 Zygote/Embryogenesis genes)',
  trainSeeds: [1, 2, 3, 9, 10, 11],
  motorGens: 16,
  steerGens: 12,
  turnGain0: 1.37,
};
