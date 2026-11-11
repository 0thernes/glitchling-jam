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
export const FULL_GENES = [...GENES, ...STEER_GENES];

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
