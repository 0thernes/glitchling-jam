// Developmental motor genome (pass 12). Replaces the hand-written innate motor wiring for locomotion, turning and righting.
// The genome is a short vector of numbers. A fixed developmental program (develop()) expands it into hundreds of synapses by
// body position and bilateral symmetry, the way segment-identity genes set up repeated circuits: e.g. the turn command's
// weight onto the lateral longitudinal muscle of segment s is t0 + t1*s/5 on the inside of the turn, mirrored for the other
// direction. So the weights are an indirect encoding (a hand-chosen basis, not a free-form CPPN) and the numbers in it come
// from evolution: test/evolve_genome.mjs runs CMA-ES in Node on the box, scoring each genome by forward speed, turning rate in
// both directions, staying upright and righting from the back on simulated bodies (see CHANGELOG pass 12). Learning in the
// page (node-perturbation motor learning, STDP) then adjusts the developed weights within bounds.
// Not in the genome (still hand-set): the gaze/eye-stalk wiring and the reach/grip/jump/curl/pitch synergies.
export const GENES = [
  // segmental CPG -> longitudinal muscles
  ['segAg0', 0, 4], ['segAg1', -2, 2], ['segAnt0', 0, 3], ['segAnt1', -2, 2], ['segTop', -1.5, 1.5], ['segRad', -1, 1], ['wvAsc', 0, 3], ['wvDesc', 0, 1.5],
  // leg oscillators -> leg swing / grip / extension (all four legs; front/rear coupling to the body wave below)
  ['sF', 0, 3.5], ['sB', -1.5, 1.5], ['gF', 0, 3], ['gB', -1.5, 1.5], ['eF', -1, 2.5], ['eB', -1.5, 1.5], ['eB2', -1.5, 1.5],
  ['cS', 0, 2.5], ['cO', -1.5, 1.5], ['rS', 0, 2.5], ['rO', -1.5, 1.5], ['tauA', 0.15, 0.8], ['cf', 0.3, 2.5],
  // arm oscillators -> arm muscles
  ['aS', 0, 3], ['aR1', -1, 2], ['aR2', -1, 2], ['aG', -1, 2.5],
  // turn command (MOT1 = left, MOT2 = right is its mirror image)
  ['cturn', 0, 3], ['legTurn', -2, 2], ['t0', -1, 4], ['t1', -3, 3], ['tAnt', -1, 3], ['tRad0', -1, 3], ['tRad1', -3, 3],
  ['tGripIn', -2, 2], ['tGripOut', -2, 2], ['tSwIn', -2, 2], ['tSwOut', -2, 2], ['tExIn', -2, 2], ['tExOut', -2, 2], ['tArmIn', -2, 2], ['tArmOut', -2, 2],
  ['lift', 0, 0.8],
  // vestibular righting (tilt -> down-side extensors, ventral muscles)
  ['rLeg', -1, 3], ['rArm', -1, 3], ['rVent', -1, 3],
];
export const NG = GENES.length;
/** stage 2 (sense -> MOT drive). Sense indices: 0 bearL, 1 bearR, 2 forage, 3 obstacle, 4 nearGoal, 5 rockTouch, 6 stuck, 7 nociception,
 *  8 upside-down, 9 spring near, 12 dream prior, 13 bias. MOT: 0 fwd, 1 turnL, 2 turnR, 3 pitch, 4 reach, 5 grip, 6 jump, 7 curl. */
export const STEER_GENES = [['kBear', 0, 4], ['kSlow', 0, 3], ['kFwd', 0, 4], ['kStuckF', -2, 1], ['kObstP', 0, 3], ['kRockP', 0, 2], ['kNearR', 0, 3], ['kRockG', 0, 3], ['kObstG', 0, 2],
  ['kStuckJ', 0, 2], ['kSpringJ', 0, 2.5], ['kNociC', 0, 3], ['kUpsC', 0, 3], ['kDream', 0, 1.5], ['kBias', 0, 1.2], ['kNearF', -2, 1], ['kCourse', 0, 1]];
export const HAND_STEER = { kBear: 1.8, kSlow: 0, kFwd: 2.2, kStuckF: -0.4, kObstP: 1.5, kRockP: 0.6, kNearR: 1.8, kRockG: 1.4, kObstG: 0.5, kStuckJ: 0.7, kSpringJ: 1.0, kNociC: 1.6, kUpsC: 1.6, kDream: 0.5, kBias: 0.55, kNearF: 0, kCourse: 0 };
/** grow the sense -> MOT matrix; M(mot, sense, w) sets one entry */
export function developSteer(g, M) { M(0, 2, g.kFwd); M(0, 6, g.kStuckF); M(0, 0, -g.kSlow); M(0, 1, -g.kSlow); M(0, 4, g.kNearF); M(1, 0, g.kBear); M(2, 1, g.kBear); M(3, 3, g.kObstP); M(3, 5, g.kRockP); M(4, 4, g.kNearR); M(5, 5, g.kRockG); M(5, 3, g.kObstG);
  M(6, 6, g.kStuckJ); M(6, 9, g.kSpringJ); M(7, 7, g.kNociC); M(7, 8, g.kUpsC); M(0, 12, g.kDream); for (let m = 0; m < 8; m++) M(m, 13, g.kBias); }
/** the pass-1..11 hand-designed wiring expressed in this encoding (kept only as a comparison point) */
export const HAND = { segAg0: 2.2, segAg1: 0, segAnt0: 1.2, segAnt1: 0, segTop: 0, segRad: 0.4, wvAsc: 1.6, wvDesc: 0.4, sF: 2.2, sB: 0, gF: 1.8, gB: 0, eF: 1.0, eB: 0, eB2: 0, cS: 1.2, cO: 0, rS: 1.2, rO: 0, tauA: 0.35, cf: 1.3,
  aS: 1.8, aR1: 1.2, aR2: 0.6, aG: 1.5, cturn: 1.4, legTurn: 0, t0: 2.4, t1: 0, tAnt: 1.6, tRad0: 1.5, tRad1: 0, tGripIn: 0, tGripOut: 0, tSwIn: 0, tSwOut: 0, tExIn: 0, tExOut: 0, tArmIn: 0, tArmOut: 0, lift: 0.5, rLeg: 1.8, rArm: 1.4, rVent: 1.2 };
export const toObj = (v) => Object.fromEntries(GENES.map(([n], i) => [n, v[i]]));
export const toVec = (o) => GENES.map(([n]) => o[n]);
export const clampGenome = (v) => v.map((x, i) => Math.min(GENES[i][2], Math.max(GENES[i][1], x)));
/**
 * Expand a genome into synapses. wc(ch, ant, cpgNeuron, w), wm(ch, ant, mot, w), wp(ch, ant, phi, w) add to the weight matrices.
 * CH = muscle channel layout. Turn-in side for MOT1 (left turn) is the left (ring side 1); MOT2 mirrors it.
 */
export function develop(g, CH, wc, wm, wp) {
  for (let s = 0; s < 6; s++) { const L = 2 * s, R = L + 1, lch = CH.long + s * 4 + 1, rch = CH.long + s * 4 + 3, p = s / 5; const ag = g.segAg0 + g.segAg1 * p, an = g.segAnt0 + g.segAnt1 * p;
    wc(lch, 0, L, ag); wc(rch, 1, L, an); wc(rch, 0, R, ag); wc(lch, 1, R, an); wc(CH.long + s * 4, 0, L, g.segTop); wc(CH.long + s * 4 + 2, 0, R, g.segTop); wc(CH.radial + s, 0, L, g.segRad); wc(CH.radial + s + 1, 1, R, g.segRad); }
  for (let l = 0; l < 4; l++) { const F = 12 + 2 * l, B = F + 1, sw = CH.leg + l * 2; wc(sw, 0, F, g.sF); wc(sw, 1, B, g.sF); wc(sw, 0, B, g.sB); wc(sw, 1, F, g.sB); wc(CH.legGrip + l, 1, F, g.gF); wc(CH.legGrip + l, 0, B, g.gF); wc(CH.legGrip + l, 0, F, g.gB); wc(CH.legGrip + l, 1, B, g.gB); wc(sw + 1, 0, F, g.eF); wc(sw + 1, 0, B, g.eB); wc(sw + 1, 1, F, g.eB2); }
  for (let a = 0; a < 2; a++) { const F = 20 + 2 * a, B = F + 1, sw = CH.arm + a * 3; wc(sw, 0, F, g.aS); wc(sw, 1, B, g.aS); wc(sw + 2, 0, F, g.aR1); wc(sw + 2, 1, B, g.aR2); wc(CH.armGrip + a, 0, B, g.aG); }
  for (const [mot, inSide] of [[1, 1], [2, 3]]) { const outSide = inSide === 1 ? 3 : 1;
    for (let s = 0; s < 6; s++) { const p = s / 5; wm(CH.long + s * 4 + inSide, 0, mot, g.t0 + g.t1 * p); wm(CH.long + s * 4 + outSide, 1, mot, g.tAnt); }
    for (let s = 0; s < 7; s++) { const v = g.tRad0 + g.tRad1 * (s / 6 - 0.5); if (v > 0) wm(CH.radial + s, 0, mot, v); else wm(CH.radial + s, 1, mot, -v); }
    for (let l = 0; l < 4; l++) { const side = l & 1 ? 3 : 1, inn = side === inSide; const gi = inn ? g.tGripIn : g.tGripOut, si = inn ? g.tSwIn : g.tSwOut, ei = inn ? g.tExIn : g.tExOut;
      wm(CH.legGrip + l, gi >= 0 ? 0 : 1, mot, Math.abs(gi)); wm(CH.leg + l * 2, si >= 0 ? 0 : 1, mot, Math.abs(si)); wm(CH.leg + l * 2 + 1, ei >= 0 ? 0 : 1, mot, Math.abs(ei)); }
    for (let a = 0; a < 2; a++) { const side = a ? 3 : 1, v = side === inSide ? g.tArmIn : g.tArmOut; wm(CH.arm + a * 3, v >= 0 ? 0 : 1, mot, Math.abs(v)); } }
  for (const [p, down] of [[14, 1], [15, 3]]) { for (let l = 0; l < 4; l++) if ((l & 1 ? 3 : 1) === down) wp(CH.leg + l * 2 + 1, 0, p, g.rLeg); for (let a = 0; a < 2; a++) if ((a ? 3 : 1) === down) wp(CH.arm + a * 3 + 1, 0, p, g.rArm); for (let sg = 0; sg < 6; sg++) wp(CH.long + sg * 4 + 2, 0, p, g.rVent); }
}
