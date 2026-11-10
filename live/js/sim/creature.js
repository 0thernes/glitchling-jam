// Glitchling v2 "live": one creature = spiking brain + LTC central pattern generator + motor-neuron pool + soft body + metabolism
// + selective SSM memory + learned world model + Beta beliefs over 16 feeding sites + striatal D1/D2 spike race with expected-free-
// energy terms and a veto + sleep with NREM replay and REM dreaming (world-model rollouts). DOM-free: runs in Node for tests.
import { mulberry, clamp, gauss, betaIG, IG0, sig } from './util.js';
import { World, SITES } from './world.js';
import { Body, CH, NS } from './body.js';
import { HDCMap, Hopfield } from './memory.js';
import { PredictiveCoding } from './mind.js';
import { Brain, R0, RN, NNEU } from './brain.js';
import { CPG, NCPG } from './cpg.js';
import { Metab } from './metab.js';
import { SelectiveSSM, WorldModel, Sleep, STAGES } from './mind.js';
import { Skin } from './skin.js';
export const DEFAULT_FLAWS = { scramble: { on: false, period: 90, noise: 0.25 }, leaky: { on: false, rate: 0.06 }, backwards: { on: false }, misfire: { on: false, period: 60, sd: 0.3, jolts: 20 } };
export const MOT_NAMES = ['forward', 'turn L', 'turn R', 'rear up', 'reach', 'grip', 'jump', 'curl'];
export const GAIT = { sF: 2.2, sB: 0, gF: 1.8, gB: 0, eF: 1.0, eB: 0, eB2: 0, cS: 1.2, cO: 0, rS: 1.2, rO: 0, wv: 1, tauA: 0.35, gk: 5, cf: 1.3 };
const PCMIX = globalThis.TW?.pcMix ?? 0.25;
const NMN = CH.N * 2, NPHI = 16, NY = 25, NZ = 64 + 8;
const PHI_NAMES = ['bearL', 'bearR', 'forage', 'obstacle', 'nearGoal', 'rockTouch', 'stuck', 'nocicept', 'upsideDown', 'springNear', 'bearSin', 'goalUp', 'dreamPrior', 'bias'];
export class Creature {
  constructor(seed = 1, opts = {}) {
    this.seed = seed; const r = (this.r = mulberry(seed)); this.gr = mulberry(seed * 9973 + 7); this.flaws = JSON.parse(JSON.stringify(opts.flaws || DEFAULT_FLAWS));
    this.world = new World(seed); this.body = new Body(this.world, 0, 0, r() * Math.PI * 2); this.brain = new Brain(seed); this.G = { ...GAIT, ...(globalThis.TW?.gait || {}) }; this.cpg = new CPG(seed, this.G); this.metab = new Metab(); this.sleep = new Sleep();
    this.ssm = new SelectiveSSM(NY + 8, 32, seed); this.wm = new WorldModel(NZ, NY); this.z = new Float64Array(NZ); this.y = new Float64Array(NY); this.yPrev = new Float64Array(NY); this.zPrev = new Float64Array(NZ);
    this.lesion = { mot: false, cpg: false, mn: false, stdp: false, wm: false, astro: false, learnMotor: false, efe: false, veto: false, dream: false };
    this.t = 0; this.frame = 0; this.tick = 0; this.hour = 8; this.dayLen = 1440;
    // motor system
    this.mnAct = new Float64Array(NMN); this.xi = new Float64Array(NMN); this.phi = new Float64Array(NPHI); this.motRate = new Float64Array(8); this.mnHomeo = new Float64Array(NMN); this.mnAvg = new Float64Array(NMN).fill(0.1); this.motDrive = new Float64Array(8);
    this.Wc = new Float64Array(NMN * NCPG); this.Wm = new Float64Array(NMN * 8); this.Wp = new Float64Array(NMN * NPHI); this.Wmot = new Float64Array(8 * NPHI);
    this.Ec = new Float64Array(NMN * NCPG); this.Em = new Float64Array(NMN * 8); this.Ep = new Float64Array(NMN * NPHI); this.Emot = new Float64Array(8 * NPHI); this.yAvg = new Float64Array(NCPG); this.mAvg = new Float64Array(8); this.win = 0;
    this.initMotorWiring(); this.Wc0 = Float64Array.from(this.Wc); this.Wm0 = Float64Array.from(this.Wm); this.Wp0 = Float64Array.from(this.Wp); this.Wmot0 = Float64Array.from(this.Wmot);
    // values and beliefs over the 16 sites (names follow the reference organism)
    this.wSite = new Float32Array(SITES).fill(0.25); this.bA = new Float64Array(SITES).fill(1); this.bB = new Float64Array(SITES).fill(1); this.wAv = new Float64Array(SITES); this.visits = new Float64Array(SITES); this.featC = new Float64Array(4).fill(0.15); this.featS = new Float64Array(4).fill(0.15);
    this.senPerm = [...Array(16).keys()]; this.goal = null; this.race = null; this.goalT = 0; this.lastDist = null; this.rBar = 0; this.da = 0; this.rpe = 0; this.nociception = 0; this.stuck = 0; this.progEMA = 0; this.recent = new Float64Array(SITES); this.selfV = 0.3; this.selfW = 0.25; this.goalBest = 1e9; this.goalBestT = 0;
    this.Vimg = new Float64Array(8); this.episodes = []; this.novelty = new Float32Array(24 * 24); this.hdcVisit = new HDCMap(seed, 512, 0.45); this.hdcFood = new HDCMap(seed + 1, 512, 0.35); this.hop = new Hopfield(NZ, 256, 24); this.zMean = new Float64Array(NZ); this.familiar = 0; this.limbUse = new Float64Array(6); this.limbUseEMA = new Float64Array(6); this.limbUseN = 0; this.pc = new PredictiveCoding(seed, NY); this.memStats = { stored: 0, retrievals: 0, dreamSim: 0, famMean: 0 }; this.stats = { eats: 0, rewards: 0, tries: 0, vetoes: 0, races: 0, dreams: 0, replays: 0, mirrored: 0, rewires: 0, misfires: 0, dist: 0, stings: 0, snacks: 0, urine: 0, feces: 0 };
    this.events = []; this.motorHist = []; this.entropy = 0; this.lastCom = this.body.com(); this.growth = 0; this.raceLog = new Float64Array(SITES * 2); this.dreamLog = [];
    this.skin = new Skin(); this.speedEMA = 0;
  }
  ev(type, msg) { this.events.push({ t: this.tick, type, msg }); if (this.events.length > 80) this.events.shift(); }
  mn(ch, ant) { return ch * 2 + (ant ? 1 : 0); }
  initMotorWiring() { const r = mulberry(this.seed * 211 + 9), C = NCPG; const wc = (ch, ant, k, v) => { this.Wc[this.mn(ch, ant) * C + k] += v; }, wm = (ch, ant, m, v) => { this.Wm[this.mn(ch, ant) * 8 + m] += v; }, wp = (ch, ant, p, v) => { this.Wp[this.mn(ch, ant) * NPHI + p] += v; };
    for (let i = 0; i < this.Wc.length; i++) this.Wc[i] = (r() - 0.5) * 0.3; for (let i = 0; i < this.Wm.length; i++) this.Wm[i] = (r() - 0.5) * 0.15; for (let i = 0; i < this.Wp.length; i++) this.Wp[i] = (r() - 0.5) * 0.1;
    for (let s = 0; s < 6; s++) { const L = 2 * s, R = L + 1, lch = CH.long + s * 4 + 1, rch = CH.long + s * 4 + 3; const WV = { ...GAIT, ...(globalThis.TW?.gait || {}) }.wv; wc(lch, 0, L, 2.2 * WV); wc(rch, 1, L, 1.2 * WV); wc(rch, 0, R, 2.2 * WV); wc(lch, 1, R, 1.2 * WV);
      wc(CH.long + s * 4, 0, L, (r() - 0.5) * 0.8); wc(CH.long + s * 4 + 2, 0, R, (r() - 0.5) * 0.8); wc(CH.radial + s, 0, L, 0.4); wc(CH.radial + s + 1, 1, R, 0.4); }
    const G = { ...GAIT, ...(globalThis.TW?.gait || {}) }; // leg-gait genome (trained offline by test/evolve_gait.mjs; see CHANGELOG pass 2)
    for (let l = 0; l < 4; l++) { const F = 12 + 2 * l, B = F + 1, sw = CH.leg + l * 2; wc(sw, 0, F, G.sF); wc(sw, 1, B, G.sF); wc(sw, 0, B, G.sB); wc(sw, 1, F, G.sB); wc(CH.legGrip + l, 1, F, G.gF); wc(CH.legGrip + l, 0, B, G.gF); wc(CH.legGrip + l, 0, F, G.gB); wc(CH.legGrip + l, 1, B, G.gB); wc(sw + 1, 0, F, G.eF); wc(sw + 1, 0, B, G.eB); wc(sw + 1, 1, F, G.eB2); }
    for (let a = 0; a < 2; a++) { const F = 20 + 2 * a, B = F + 1, sw = CH.arm + a * 3; wc(sw, 0, F, 1.8); wc(sw, 1, B, 1.8); wc(sw + 2, 0, F, 1.2); wc(sw + 2, 1, B, 0.6); wc(CH.armGrip + a, 0, B, 1.5); }
    const TK = globalThis.TW?.turnK ?? 1; for (const s of (globalThis.TW?.turnSegs ?? [2, 3, 4, 5])) { /* contracting the left longitudinal muscles bends/yaws the body left (measured in test/gait_probe.mjs) */ wm(CH.long + s * 4 + 1, 0, 1, 2.4 * TK); wm(CH.long + s * 4 + 3, 1, 1, 1.6 * TK); wm(CH.long + s * 4 + 3, 0, 2, 2.4 * TK); wm(CH.long + s * 4 + 1, 1, 2, 1.6 * TK); wm(CH.long + s * 4, 0, 3, 1.6); }
    for (let s = 0; s < 6; s++) { wm(CH.long + s * 4 + 2, 0, 7, 1.6); wm(CH.radial + s, 1, 7, 0.8); } wm(CH.radial + 6, 0, 6, 1.5);
    for (let a = 0; a < 2; a++) { wm(CH.arm + a * 3, 0, 4, 1.5); wm(CH.arm + a * 3 + 1, 0, 4, 1.2); wm(CH.arm + a * 3 + 2, 0, 3, 1.4); wm(CH.armGrip + a, 0, 5, 1.6); }
    for (let l = 0; l < 4; l++) { wm(CH.legGrip + l, 0, 5, 1.4); wm(CH.leg + l * 2 + 1, 0, 6, 2.4); } for (let i = 0; i < 7; i++) wm(CH.radial + i, 0, 6, 1.4);
    for (let s = 0; s < 2; s++) { wm(CH.stalk + s * 2, 0, 1, 0.8); wm(CH.stalk + s * 2, 1, 2, 0.8); }
    { const kg = globalThis.TW?.gripTurn ?? 0; for (let l = 0; l < 4; l++) { const left = !(l & 1); /* inner-side feet loosen their grip, outer-side feet grip harder */ wm(CH.legGrip + l, left ? 1 : 0, 1, kg); wm(CH.legGrip + l, left ? 0 : 1, 2, kg); } }
    for (let e = 0; e < 3; e++) { wp(CH.gaze + e * 2, 0, 10, 1.6); wp(CH.gaze + e * 2, 1, 10, -1.6); wp(CH.gaze + e * 2 + 1, 0, 11, 1.2); wp(CH.gaze + e * 2 + 1, 1, 11, -1.2); }
    // vestibulospinal righting reflex (innate, plastic): when lying on a side, extend the legs/arms on the DOWN side and contract the
    // ventral longitudinal muscles. Pattern found by test/roll_probe.mjs (rights the body from either side in 4/4 trials).
    for (const [p, down] of [[14, 1], [15, 3]]) { for (let l = 0; l < 4; l++) if ((l & 1 ? 3 : 1) === down) wp(CH.leg + l * 2 + 1, 0, p, 1.8); for (let a = 0; a < 2; a++) if ((a ? 3 : 1) === down) wp(CH.arm + a * 3 + 1, 0, p, 1.4); for (let sg = 0; sg < 6; sg++) wp(CH.long + sg * 4 + 2, 0, p, 1.2); }
    const M = (m, p, v) => { this.Wmot[m * NPHI + p] = v; }; // innate sense -> MOT drive (learning reweights these)
    M(0, 2, 2.2); M(0, 6, -0.4); if (globalThis.TW?.slowTurn) { M(0, 0, -globalThis.TW.slowTurn); M(0, 1, -globalThis.TW.slowTurn); } M(1, 0, 1.8); M(2, 1, 1.8); M(3, 3, 1.5); M(3, 5, 0.6); M(4, 4, 1.8); M(5, 5, 1.4); M(5, 3, 0.5); M(6, 6, 0.7); M(6, 9, 1.0); M(7, 7, 1.6); M(7, 8, 1.6); M(0, 12, 0.5);
    for (let m = 0; m < 8; m++) M(m, 13, 0.55); }
  /** per limb: rate of change of the swing muscle's stretch (muscle-spindle velocity signal), low-passed */
  updateSwingVel() { const B = this.body; if (!this.gripOf) { this.gripOf = new Int8Array(CH.N).fill(-1); B.limbs.forEach((L, k) => { this.gripOf[L.grip] = k; }); this.swingVel = new Float64Array(B.limbs.length); this.swingPrev = new Float64Array(B.limbs.length); }
    B.limbs.forEach((L, k) => { const sw = L.kind === 'leg' ? CH.leg + L.idx * 2 : CH.arm + L.idx * 3; const st = B.stretch[sw]; const v = (st - this.swingPrev[k]) * 60; this.swingPrev[k] = st; this.swingVel[k] += 0.3 * (v - this.swingVel[k]); }); }
  setFlaws(f) { const was = this.flaws.scramble.on; this.flaws = JSON.parse(JSON.stringify(f)); if (this.flaws.scramble.on && !was) this.rewire(); if (!this.flaws.scramble.on) this.senPerm = [...Array(16).keys()]; }
  rewire() { const p = [...Array(16).keys()]; for (let i = 15; i > 0; i--) { const j = Math.floor(this.gr() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } this.senPerm = p; this.stats.rewires++; this.ev('scramble', 'senses rewired: SENS neurons now report through a new permutation'); }
  // ------------------------------------------------------------------ sensing
  target() { const g = this.goal; if (!g) return null; if (g.type === 'site') { const P = this.world.plants[g.k]; return [P.x, P.y + 0.3, P.z]; } if (g.type === 'snack') { const s = this.world.snacks.find((q) => q.id === g.id); if (!s) { this.goal = null; return null; } return [s.x, s.y, s.z]; } return [g.x, this.world.height(g.x, g.z), g.z]; }
  sense() {
    const B = this.body, F = B.F, W = this.world, hd = B.head(), fr = F[this.bearSeg ?? (+(globalThis.process?.env?.BSEG ?? 6))]; B.curvature(); const tg = this.target(); let bear = 0, dist = 0, up = 0;
    if (tg) { const dx = tg[0] - hd[0], dy = tg[1] - hd[1], dz = tg[2] - hd[2]; const ff = dx * fr.f[0] + dz * fr.f[2], ss = dx * fr.s[0] + dz * fr.s[2]; bear = Math.atan2(ss, ff); dist = Math.hypot(dx, dz); up = clamp(dy / 3, -1, 1); }
    this.bear = bear; this.dist = dist; const [vx, vy, vz] = this.vel || [0, 0, 0];
    const vf = (vx * fr.f[0] + vy * fr.f[1] + vz * fr.f[2]) * 60, vl = (vx * fr.s[0] + vy * fr.s[1] + vz * fr.s[2]) * 60; this.vf = vf; this.speedEMA += 0.02 * (Math.hypot(vx, vz) * 60 - this.speedEMA);
    // rock directly ahead? (obstacle), spring nearby?, tilt
    let obst = 0; for (const R of W.rocks) { const dx = R.x - hd[0], dz = R.z - hd[2]; const d = Math.hypot(dx, dz) - R.r; const a = (dx * fr.f[0] + dz * fr.f[2]) / (Math.hypot(dx, dz) || 1); if (d < 1.6 && a > 0.5) obst = Math.max(obst, 1 - d / 1.6); }
    let spring = 0; for (const S of W.springs) { const d = Math.hypot(S.x - hd[0], S.z - hd[2]); if (d < 3) spring = Math.max(spring, 1 - d / 3); }
    let rockT = 0; for (let i = 0; i < B.n; i++) if (B.contact[i] === 2) rockT++; rockT = clamp(rockT / 6); const upY = F[3].u[1]; const upside = clamp(-upY * 1.5);
    const hunger = this.metab.hunger(); const awake = this.sleep.stage === 0; const forage = awake && this.goal ? 0.6 + 0.6 * hunger : 0;
    const P = this.phi; P[0] = clamp(-bear / 0.7) * (tg ? 1 : 0); P[1] = clamp(bear / 0.7) * (tg ? 1 : 0); P[2] = forage; P[3] = obst; P[4] = tg ? clamp(1 - dist / 1.8) : 0; P[5] = rockT; P[6] = clamp(this.stuck); P[7] = clamp(this.nociception); P[8] = upside; P[9] = spring * (tg ? 1 : 0.3); P[10] = Math.sin(bear); P[11] = up; P[12] = clamp(this.Vimg[0] * 2, -1, 1) * 0.5; P[13] = 1;
    /* vestibular tilt (utricle-like): magnitude of tilt split by which side faces down; drives the righting reflex below */ const tilt = clamp((0.75 - upY) * 1.6), sy = F[3].s[1]; P[14] = tilt * (sy > 0 ? 1 : 0); P[15] = tilt * (sy > 0 ? 0 : 1); if (globalThis.TW?.noTilt) P[14] = P[15] = 0;
    // world-model target vector y (proprioception + vestibular + contacts + goal bearing)
    const y = this.y; for (let i = 0; i < 6; i++) { y[i] = clamp(B.curvL[i] / 3, -2, 2); y[6 + i] = clamp(B.curvU[i] / 3, -2, 2); } y[12] = clamp(vf / 3, -2, 2); y[13] = clamp(vl / 3, -2, 2); y[14] = clamp(vy * 20, -2, 2); y[15] = upY; y[16] = F[3].s[1];
    B.limbs.forEach((L, k) => { y[17 + k] = B.contact[L.foot] ? 1 : 0; }); y[23] = Math.sin(bear); y[24] = Math.cos(bear) * (tg ? 1 : 0);
    // neural drive currents for every non-motor region
    const ext = this.brain.ext, nm = this.brain.nm; ext.fill(0);
    const sens = new Float64Array(16); for (let i = 0; i < 8; i++) { const ph = -Math.PI + ((i + 0.5) * 2 * Math.PI) / 8; let d = Math.abs(bear - ph); if (d > Math.PI) d = 2 * Math.PI - d; sens[i] = tg ? 1.5 * Math.exp(-(d * d) / 0.4) : 0; }
    let near = null, nd = 1e9; for (const Pl of W.plants) { const d = Math.hypot(Pl.x - hd[0], Pl.z - hd[2]); if (d < nd && Pl.fruit > 0.3) { nd = d; near = Pl; } } if (near && nd < 8) sens[8 + near.c] = 1.3 * (1 - nd / 8);
    sens[12] = 2 * clamp(this.nociception); sens[13] = rockT * 1.2; sens[14] = this.light * 1.0; sens[15] = obst * 1.4;
    const sc = this.flaws.scramble; for (let i = 0; i < 16; i++) ext[R0.SENS + this.senPerm[i]] = 0.6 + sens[i] + (sc.on ? sc.noise * gauss(this.gr) : 0);
    for (let i = 0; i < 6; i++) { ext[R0.PROP + 2 * i] = 0.7 + clamp(B.curvL[i] / 2) * 1.5; ext[R0.PROP + 2 * i + 1] = 0.7 + clamp(-B.curvL[i] / 2) * 1.5; ext[R0.PROP + 12 + 2 * i] = 0.7 + clamp(B.curvU[i] / 2) * 1.5; ext[R0.PROP + 13 + 2 * i] = 0.7 + clamp(-B.curvU[i] / 2) * 1.5; }
    B.limbs.forEach((L, k) => { if (k < 6) ext[R0.PROP + 24 + k] = 0.6 + 1.2 * (B.contact[L.foot] ? 1 : 0); }); ext[R0.PROP + 30] = 0.6 + 1.5 * upside; ext[R0.PROP + 31] = 0.6 + clamp(Math.abs(vf) / 2) * 1.2;
    const M = this.metab, intero = [clamp(0.95 - M.blood.glc / 3) * 2, M.ghrelin, clamp(M.bladder / 1.2), clamp(M.colon / 1.5), clamp(1 - M.atp / 2), M.thirst, M.cortisol, clamp((M.hr - 60) / 60)];
    for (let i = 0; i < 8; i++) ext[R0.INS + i] = 0.6 + 1.2 * intero[i];
    for (let i = 0; i < 16; i++) ext[R0.HYP + i] = 0.5 + (i < 8 ? 1.2 * hunger : 0.8 * M.thirst + 0.6 * this.sleep.S);
    const ph = (2 * Math.PI * this.hour) / 24; for (let i = 0; i < 8; i++) ext[R0.SCN + i] = 0.7 + 0.6 * Math.max(0, Math.cos(ph - (i * 2 * Math.PI) / 8));
    for (let i = 0; i < 6; i++) { ext[R0.VTA + i] = 0.9 + 3 * Math.max(0, this.rpe) - 1.5 * Math.max(0, -this.rpe); ext[R0.LC + i] = 0.8 + 2.5 * ((1 - PCMIX) * this.wm.surprise + PCMIX * this.pc.surprise) /* arousal from both world-model and predictive-coding surprise */ + 2 * clamp(this.nociception) + (awake ? 0.2 : -0.3); ext[R0.RAPHE + i] = 0.8 + 0.5 * clamp(1 - hunger) + (awake ? 0.2 : -0.2) * (this.sleep.stage === 4 ? -2 : 1); ext[R0.BF + i] = 0.8 + 0.6 * this.uncert() + (awake || this.sleep.stage === 4 ? 0.3 : -0.3); }
    const ens = clamp((M.gut.glc + M.gut.fat + M.gut.prot) / 6); for (let i = 0; i < 48; i++) ext[R0.ENS + i] = 0.6 + 0.8 * ens + 0.4 * M.para;
    for (let i = 0; i < RN.STR; i++) ext[R0.STR + i] = 0.4; for (let i = 0; i < RN.CTX; i++) ext[R0.CTX + i] = 0.55 + 0.3 * nm.ACh; for (let i = 0; i < RN.THAL; i++) ext[R0.THAL + i] = awake ? 0.5 : this.sleep.stage === 4 ? 0.45 : 0.2; for (let i = 0; i < RN.HIP; i++) ext[R0.HIP + i] = 0.5; if (this.familiar > 0 && this.hop.lastIdx >= 0) for (let j = 0; j < 8; j++) ext[R0.HIP + ((this.hop.lastIdx * 7 + j * 5) % RN.HIP)] += 1.4 * this.familiar; /* Hopfield recognition re-activates that memory's index assembly */
    if (this.race) this.raceDrive(ext);
    // MOT: innate sense -> drive matrix (plastic) + imagined synergy values from dreams
    for (let m = 0; m < 8; m++) { let s = 0; for (let p = 0; p < NPHI; p++) s += this.Wmot[m * NPHI + p] * P[p]; this.motDrive[m] = s; ext[R0.MOT + m] = awake ? s : -1; }
    this.light = clamp(0.5 + 0.6 * Math.cos(((this.hour - 13) * 2 * Math.PI) / 24));
  }
  uncert() { let s = 0; for (let k = 0; k < SITES; k++) s += Math.sqrt((this.bA[k] * this.bB[k]) / ((this.bA[k] + this.bB[k]) ** 2 * (this.bA[k] + this.bB[k] + 1))); return clamp((s / SITES) * 3.5); }
  // ------------------------------------------------------------------ the striatal race (D1 = STR 0..15 "go" for site k, D2 = STR 16..31 "no-go")
  efe(k) { const P = this.world.plants[k], hd = this.body.head(); const mean = this.bA[k] / (this.bA[k] + this.bB[k]); const hdcV = this.lesion.hdc ? 0 : clamp(this.hdcFood.recall(P.x, P.z), -1, 1); const prag = this.lesion.hdc ? 0.5 * this.wSite[k] + 0.5 * mean : 0.45 * this.wSite[k] + 0.45 * mean + 0.25 * hdcV; /* + spatial generalisation from the HDC food map */
    const epi = this.lesion.efe ? 0 : 0.3 * (0.5 + this.brain.nm.ACh + 0.5 * this.brain.nm.NE) * (betaIG(this.bA[k], this.bB[k]) / IG0 - 0.5); const d = Math.hypot(P.x - hd[0], P.z - hd[2]), F = this.body.F[NS - 1]; const bear = Math.abs(Math.atan2((P.x - hd[0]) * F.s[0] + (P.z - hd[2]) * F.s[2], (P.x - hd[0]) * F.f[0] + (P.z - hd[2]) * F.f[2]));
    // cost = predicted travel time from the creature's own measured approach speed and turn rate (a learned self-model), x energy price
    const tTravel = d / Math.max(0.08, this.selfV) + bear / Math.max(0.08, this.selfW); const cost = this.lesion.selfModel ? 0.012 * d * (1 + this.metab.cortisol) : 0.018 * tTravel * (1 + this.metab.cortisol) + (P.fruit < 0.3 ? 0.4 : 0) + (this.lesion.ior ? 0 : 0.9 * this.recent[k]); /* inhibition of return: recently visited sites are discounted for ~1 min */
    return { G: -(prag + epi - cost), prag, epi, cost, tTravel, harm: this.wAv[k] * (1 + this.metab.cortisol) }; }
  startRace(exclude = new Set()) { const terms = []; for (let k = 0; k < SITES; k++) terms.push(exclude.has(k) ? null : this.efe(k)); this.race = { terms, cnt: new Float64Array(SITES), cntD2: new Float64Array(SITES), t: 0, exclude }; this.stats.races++; }
  raceDrive(ext) { const R = this.race; let tot = 0; for (let k = 0; k < SITES; k++) tot += this.brain.rate[R0.STR + k]; const inhib = 0.004 * tot;
    for (let k = 0; k < SITES; k++) { const T = R.terms[k]; if (!T) { ext[R0.STR + k] = -1; continue; } ext[R0.STR + k] = 0.85 + 1.6 * -T.G - inhib; ext[R0.STR + 16 + k] = 0.8 + 1.5 * T.harm + 0.8 * T.cost; } }
  raceCount() { const R = this.race, b = this.brain; for (let k = 0; k < SITES; k++) { if (b.spk[R0.STR + k]) R.cnt[k] += 1; if (b.spk[R0.STR + 16 + k]) R.cntD2[k] += 1; } }
  raceCheck(dt) { const R = this.race; R.t += dt; let best = -1, bv = -1e9; for (let k = 0; k < SITES; k++) { if (!R.terms[k]) continue; const v = R.cnt[k] - 0.6 * R.cntD2[k]; this.raceLog[k] = R.cnt[k]; this.raceLog[16 + k] = R.cntD2[k]; if (v > bv) { bv = v; best = k; } }
    if (bv < 8 && R.t < 1.2) return; if (best < 0) { this.race = null; return; } let k = best; const T = R.terms[k];
    if (!this.lesion.veto && T.harm > 0.3 * (1 + this.brain.nm['5HT'])) { this.stats.vetoes++; this.ev('veto', `veto: cancelled site ${k} (predicted harm ${T.harm.toFixed(2)}), re-racing`); const ex = new Set(R.exclude); ex.add(k); this.startRace(ex); return; }
    let ke = k; if (this.flaws.backwards.on) { ke = SITES - 1 - k; this.stats.mirrored++; this.ev('backwards', `chose site ${k}, body heads to mirrored site ${ke}`); }
    this.goal = { type: 'site', k: ke, chosen: k, since: this.t }; this.race = null; this.lastDist = null; this.ev('decide', `race won by site ${k} (G=${T.G.toFixed(2)}: value ${T.prag.toFixed(2)}, info ${T.epi.toFixed(2)}, cost ${T.cost.toFixed(2)})`); }
  // ------------------------------------------------------------------ main step (dt = 1/60 s)
  step() {
    const dt = 1 / 60, B = this.body, br = this.brain, cpg = this.cpg; this.frame++; this.t += dt; this.world.step(dt, this.tick); this.sense();
    const stage = this.sleep.stage, awake = stage === 0; br.atonia = stage >= 2 ? 3 : stage === 1 ? 0.8 : 0; br.sleepStage = stage; br.lesion.stdp = this.lesion.stdp; br.lesion.astro = this.lesion.astro; br.lesion.mot = this.lesion.mot;
    const back = this.flaws.backwards.on; const cext = new Float64Array(NCPG); const mnI = new Float64Array(NMN); const GK = this.lesion.gripReflex ? 0 : this.G.gk; this.updateSwingVel();
    for (let s = 0; s < 8; s++) {
      for (let m = 0; m < 8; m++) this.motRate[m] = this.forceMot ? this.forceMot[m] : (globalThis.TW?.motSat ? 1.2 * Math.tanh(br.rate[R0.MOT + (back ? 7 - m : m)] / 45) : br.rate[R0.MOT + (back ? 7 - m : m)] / 40);
      const mr = this.motRate; if (!this.forceMot && !this.lesion.motNorm) { let tot = 0; for (let m = 0; m < 8; m++) tot += mr[m]; for (let m = 0; m < 8; m++) mr[m] = mr[m] / (1 + 0.3 * (tot - mr[m])); } /* divisive normalisation across MOT synergies (shared inhibitory pool) */ const fwd = mr[0], turn = mr[1] - mr[2];
      for (let i = 0; i < NCPG; i++) cext[i] = this.lesion.cpg ? -6 : (awake ? 0.15 : -0.6) + this.G.cf * fwd + 0.5 * mr[6] + 0.3 * mr[4];
      for (let o = 2; o < 6; o++) { cext[2 * o] += (globalThis.TW?.cturn ?? 1.4) * turn; cext[2 * o + 1] -= (globalThis.TW?.cturn ?? 1.4) * turn; } { const kL = globalThis.TW?.legTurn ?? 0; for (let l = 0; l < 4; l++) { const sgn = l & 1 ? 1 : -1; /* right legs (odd) speed up, left legs slow down for a left turn */ cext[12 + 2 * l] += kL * sgn * turn; cext[13 + 2 * l] += kL * sgn * turn; } } for (let o = 0; o < 6; o++) { cext[2 * o] += 0.35 * clamp(B.stretch[CH.long + o * 4 + 3] * 4, -1, 1); cext[2 * o + 1] += 0.35 * clamp(B.stretch[CH.long + o * 4 + 1] * 4, -1, 1); } // stretch-receptor (edge cell) feedback entrains the rhythm
      cpg.step(0.002, cext); const y = cpg.x;
      for (let n = 0; n < NMN; n++) { let I = 0.55 + this.xi[n] + this.mnHomeo[n]; const oc = n * NCPG; for (let k = 0; k < NCPG; k++) I += this.Wc[oc + k] * y[k]; const om = n * 8; for (let m = 0; m < 8; m++) I += this.Wm[om + m] * mr[m]; const op = n * NPHI; for (let p = 0; p < NPHI; p++) I += this.Wp[op + p] * this.phi[p];
        const ch = n >> 1; I -= 0.4 * clamp(B.stretch[ch] * (n & 1 ? -1 : 1) * -3, -1, 1); // stretch reflex: a lengthened agonist is excited
        if (this.gripOf[ch] >= 0) { const sv = this.swingVel[this.gripOf[ch]]; I += (n & 1 ? -1 : 1) * clamp(GK * sv, -1.5, 1.5); } // stance/swing reflex: swing-muscle velocity (chordotonal-like) gates foot grip
        if (ch >= CH.gaze) I += br.atonia * (stage === 4 ? 1.1 : 0.9); // eye muscles escape sleep atonia (REM eye movements)
        mnI[n] = I; br.ext[R0.MN + n] = this.lesion.mn ? -5 : I; }
      br.step(0.002); if (this.race) this.raceCount();
      for (let n = 0; n < NMN; n++) { this.mnAct[n] = this.mnAct[n] * 0.976 + (br.spk[R0.MN + n] ? 0.12 : 0); }
      for (let k = 0; k < NCPG; k++) this.yAvg[k] += y[k] / 48; for (let m = 0; m < 8; m++) this.mAvg[m] += mr[m] / 48;
      if ((this.frame * 8 + s) % 10 === 0) br.slow(0.02, stage);
    }
    for (let c = 0; c < CH.N; c++) B.u[c] = clamp((this.muscleGain ?? 2.4) * (this.mnAct[2 * c] - this.mnAct[2 * c + 1]), -1, 1);
    B.limbs.forEach((L, k) => { const sw = L.kind === 'leg' ? CH.leg + L.idx * 2 : CH.arm + L.idx * 3; this.limbUse[k] += Math.abs(B.u[sw]) + Math.abs(B.u[sw + 1]) + 0.5 * Math.abs(B.u[L.grip]); }); this.limbUseN++;
    B.step(1 / 120); B.step(1 / 120); const com = B.com(); this.vel = [com[0] - this.lastCom[0], com[1] - this.lastCom[1], com[2] - this.lastCom[2]]; this.stats.dist += Math.hypot(this.vel[0], this.vel[2]); this.lastCom = com;
    this.nociception *= 0.97; if (this.race) this.raceCheck(dt); this.interact();
    if (this.frame % 6 === 0) this.tenHz(); if (this.frame % 4 === 0) this.skin.step(this); if (this.frame % 15 === 0) this.minute();
    this.updateNM(dt);
  }
  updateNM(dt) { const br = this.brain, nm = br.nm; const lp = (k, v, tau) => { nm[k] += (dt / tau) * (v - nm[k]); };
    const vta = br.regionRate('VTA'); this.vtaBase = (this.vtaBase ?? vta) + 0.002 * (vta - (this.vtaBase ?? vta)); lp('DA', clamp(0.3 + (vta - this.vtaBase) / 20, 0, 1.2), 0.3); /* DA = phasic VTA firing relative to its own slow baseline */ lp('NE', clamp(0.2 + br.regionRate('LC') / 50, 0, 1.2), 0.4); lp('5HT', clamp(0.2 + br.regionRate('RAPHE') / 45, 0, 1.2), 1.0); lp('ACh', clamp(0.1 + br.regionRate('BF') / 40, 0, 1.2), 0.6); nm.cortisol = this.metab.cortisol; }
  // ------------------------------------------------------------------ 10 Hz: SSM, world model, motor learning, behaviour statistics
  tenHz() {
    const u = new Float64Array(NY + 8); u.set(this.y); for (let m = 0; m < 8; m++) u[NY + m] = this.mAvg[m]; this.ssm.step(u);
    const z = this.z; this.ssm.features(z); for (let m = 0; m < 8; m++) z[64 + m] = this.mAvg[m];
    if (this.frame > 12) { this.wm.learn(this.zPrev, this.y, 0.05 * (0.5 + this.brain.nm.ACh)); } this.zPrev.set(z);
    for (let i = 0; i < NZ; i++) this.zMean[i] += 0.01 * (z[i] - this.zMean[i]); this.pc.lesionLearn = !!this.lesion.pc; this.pc.step(this.y, 0.6 + 0.8 * this.brain.nm.ACh);
    if (this.frame % 60 === 0 && this.sleep.stage === 0 && !this.lesion.hopfield) { const c = Float64Array.from(z, (v, i) => v - this.zMean[i]); const R = this.hop.retrieve(c); this.familiar = R ? clamp((R.sim - 0.4) / 0.5) : 0; this.memStats.famMean += 0.02 * (this.familiar - this.memStats.famMean); this.memStats.retrievals++;
      this.hop.store(c, { ep: this.episodes[this.episodes.length - 1], t: this.t }, this.r); this.memStats.stored++; }
    if (this.sleep.stage === 0 && this.episodes.length < 400 ? true : this.frame % 60 === 0) { const ctx = []; for (let i = 0; i < RN.CTX; i++) if (this.brain.rate[R0.CTX + i] > 15) ctx.push(i); const ep = { z: Float64Array.from(z), y: Float64Array.from(this.y), ssm: [Float64Array.from(this.ssm.re), Float64Array.from(this.ssm.im)], ctx, vf: this.vf };
      if (this.sleep.stage === 0) { this.episodes.push(ep); if (this.episodes.length > 400) this.episodes.splice(Math.floor(this.r() * 400), 1); } }
    // reward for motor learning: progress toward the current goal, minus effort. delta = R - Rbar is the dopamine-like third factor.
    const tg = this.target(); let R = 0; if (tg && this.sleep.stage === 0) { const d = this.dist; if (this.lastDist !== null) { R = (this.lastDist - d) * 10 * 0.5; if (Math.abs(this.bear) < 0.6) this.selfV += 0.01 * ((this.lastDist - d) * 10 - this.selfV); } this.lastDist = d; } else this.lastDist = null;
    { const F = this.body.F[3].f, h = Math.atan2(F[2], F[0]); if (this.lastYaw !== undefined) { let dh = h - this.lastYaw; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI; if (tg && Math.abs(this.bear) > 0.6) this.selfW += 0.01 * (Math.abs(dh) * 10 - this.selfW); } this.lastYaw = h; }
    this.progEMA += 0.05 * ((tg ? R : 0.3) - this.progEMA); /* 'stuck' uses pure goal progress (not the posture/effort terms, which made a tumble -> stuck -> jump -> tumble loop) */ R -= 0.0015 * this.body.energy; R -= 0.3 * clamp(0.5 - this.body.F[3].u[1]); /* being on its back costs reward */ this.stuck = clamp((0.02 - this.progEMA) * 4) * (tg && this.goal && this.t - this.goal.since > 6 ? 1 : 0);
    const delta = R - this.rBar; this.rBar += 0.05 * delta; this.motorDelta = delta;
    if (tg && this.sleep.stage === 0 && !this.lesion.learnMotor) this.motorLearn(delta);
    // homeostatic intrinsic plasticity: each motor neuron slowly shifts its own bias so its average activation tracks a set point
    // (tau ~ 5 s). Without it, rising hunger/NE drove every motor pool into tonic co-contraction and the body thrashed and tumbled.
    if (this.homeo) for (let n = 0; n < NMN; n++) { this.mnAvg[n] += 0.1 * (this.mnAct[n] - this.mnAvg[n]); this.mnHomeo[n] = clamp(this.mnHomeo[n] + 0.04 * ((globalThis.TW?.hs ?? 0.12) - this.mnAvg[n]), -2, globalThis.TW?.hmax ?? 0.6); } else this.mnHomeo.fill(0);
    const sigma = 0.35 * (1 + this.brain.nm.NE) * (this.sleep.stage === 0 ? 1 : 0.3); for (let n = 0; n < NMN; n++) this.xi[n] = 0.7 * this.xi[n] + 0.7 * sigma * gauss(this.r);
    this.yAvg.fill(0); this.mAvg.fill(0);
    // behavioural repertoire: discretise the motor state into 7 bits, entropy over the last 60 s
    const Bu = this.body.u; const avg = (a, b, st = 1) => { let s = 0, n = 0; for (let i = a; i < b; i += st) { s += Bu[i]; n++; } return s / n; };
    const bits = [avg(CH.long + 13, CH.long + 24, 2) > 0.05, avg(CH.long + 1, CH.long + 12, 2) > 0.05, avg(CH.long, CH.long + 24, 4) > 0.05, avg(CH.radial, CH.radial + 7) > 0.05, avg(CH.legGrip, CH.legGrip + 4) > 0, avg(CH.arm + 2, CH.arm + 6, 3) > 0.05, this.vf > 0.25];
    const code = bits.reduce((a, b, i) => a | ((b ? 1 : 0) << i), 0); this.motorHist.push(code); if (this.motorHist.length > 600) this.motorHist.shift();
    if (this.frame % 60 === 0) { const c = new Map(); for (const x of this.motorHist) c.set(x, (c.get(x) || 0) + 1); let H = 0; for (const v of c.values()) { const p = v / this.motorHist.length; H -= p * Math.log2(p); } this.entropy = H; this.states = c.size; }
  }
  motorLearn(delta) { const lr = 0.003 * (0.5 + this.brain.nm.ACh) * clamp(delta, -1, 1); const decay = 0.85;
    for (let n = 0; n < NMN; n++) { const x = this.xi[n]; const oc = n * NCPG; for (let k = 0; k < NCPG; k++) { this.Ec[oc + k] = decay * this.Ec[oc + k] + x * this.yAvg[k]; this.Wc[oc + k] = clamp(this.Wc[oc + k] + lr * this.Ec[oc + k], this.Wc0[oc + k] - 1, this.Wc0[oc + k] + 1); }
      const om = n * 8; for (let m = 0; m < 8; m++) { this.Em[om + m] = decay * this.Em[om + m] + x * this.mAvg[m]; this.Wm[om + m] = clamp(this.Wm[om + m] + lr * this.Em[om + m], this.Wm0[om + m] - 1, this.Wm0[om + m] + 1); }
      const op = n * NPHI; for (let p = 0; p < NPHI; p++) { this.Ep[op + p] = decay * this.Ep[op + p] + x * this.phi[p]; this.Wp[op + p] = clamp(this.Wp[op + p] + 0.5 * lr * this.Ep[op + p], this.Wp0[op + p] - 1, this.Wp0[op + p] + 1); } }
    for (let m = 0; m < 8; m++) { const post = this.mAvg[m] - 0.3; for (let p = 0; p < NPHI; p++) { this.Emot[m * NPHI + p] = decay * this.Emot[m * NPHI + p] + post * this.phi[p]; this.Wmot[m * NPHI + p] = clamp(this.Wmot[m * NPHI + p] + 0.3 * lr * this.Emot[m * NPHI + p], -3, 3); } } }
  // ------------------------------------------------------------------ physical interaction: eating, stings, snacks
  interact() { const hd = this.body.head(), W = this.world; const g = this.goal;
    for (let i = W.snacks.length - 1; i >= 0; i--) { const s = W.snacks[i]; if (Math.hypot(s.x - hd[0], s.y - hd[1], s.z - hd[2]) < 0.9 && this.sleep.stage === 0) { W.snacks.splice(i, 1); this.metab.eat(s.kind, 1.2); this.hdcFood.add(s.x, s.z, 0.5); this.outcome(null, 1); this.stats.snacks++; this.ev('eat', `ate dropped ${s.kind}`); if (g && g.type === 'snack') this.goal = null; } }
    if (g && g.type === 'site') { const P = W.plants[g.k]; if (Math.hypot(P.x - hd[0], P.z - hd[2]) < (globalThis.TW?.eatR ?? 1.3)) { this.stats.tries++; let r = 0; if (P.fruit > 0.3 && this.r() < P.p * (0.6 + 0.4 * P.fruit) * 2.2) { r = 1; this.metab.eat('plant', 1); this.stats.eats++; } P.fruit = Math.max(0, P.fruit - 0.7);
        if (P.s === 3 && this.r() < 0.35) { this.nociception = 1; this.stats.stings++; this.wAv[g.k] += 0.3 * (1 - this.wAv[g.k]); this.ev('sting', `thorn plant ${g.k} stung (aversive value now ${this.wAv[g.k].toFixed(2)})`); } else this.wAv[g.k] *= 0.95;
        this.recent[g.k] = 1; this.hdcFood.add(P.x, P.z, r - 0.35); this.outcome(g.chosen ?? g.k, r); this.ev(r ? 'reward' : 'miss', `site ${g.k}: ${r ? 'fed' : 'nothing'} (true p ${P.p.toFixed(2)})`); this.goal = null; } }
    if (g) { if (g !== this.goalRef) { this.goalRef = g; this.goalBest = 1e9; this.goalBestT = this.t; } if (this.lastDist !== null && this.dist < this.goalBest - 0.5) { this.goalBest = this.dist; this.goalBestT = this.t; }
      // give up when no 0.5-unit improvement for 20 s, or after 3x the self-predicted travel time (min 45 s)
      const lim = Math.max(45, 3 * ((this.goalBest < 1e8 ? this.goalBest : 10) / Math.max(0.08, this.selfV))); if (this.t - this.goalBestT > 20 || this.t - g.since > lim) { this.ev('give-up', `gave up on goal (${(this.t - g.since).toFixed(0)} s, no progress for ${(this.t - this.goalBestT).toFixed(0)} s)`); if (g.type === 'site') this.wSite[g.chosen ?? g.k] *= 0.9; this.goal = null; } } }
  outcome(k, r) { let q = 0.7; if (k !== null && k !== undefined) { q = 0.5 * this.wSite[k] + 0.5 * this.bA[k] / (this.bA[k] + this.bB[k]); this.wSite[k] += 0.25 * (r - this.wSite[k]); if (r) this.bA[k] += 1; else this.bB[k] += 1; this.visits[k]++; const P = this.world.plants[k]; this.featC[P.c] += 0.1 * (r - this.featC[P.c]); this.featS[P.s] += 0.1 * (r - this.featS[P.s]); }
    this.rpe = r - q; this.stats.rewards += r; setTimeout0(() => { this.rpe *= 0.2; }); }
  // ------------------------------------------------------------------ one simulated minute: metabolism, sleep, decisions, flaws, replay/dreams, growth
  minute() {
    for (let k = 0; k < SITES; k++) this.recent[k] *= 0.996; this.tick++; this.hour = (8 + (this.tick * 24) / this.dayLen) % 24; const M = this.metab, br = this.brain; this.rpe *= 0.3;
    const evs = M.tick({ hour: this.hour, ens: clamp(br.regionRate('ENS') / 30), motorCost: this.body.energy, spikes: br.spikes * 240, stress: clamp(this.nociception + 0.5 * this.wm.surprise) });
    for (const e of evs) { const c = this.body.c[0]; this.world.waste.push({ x: this.body.x[c], y: this.body.y[c], z: this.body.z[c], type: e.type, age: 0, amount: e.amount }); this.stats[e.type]++; this.ev('waste', e.type === 'urine' ? 'urinated (bladder emptied)' : 'defecated (colon emptied)'); }
    const prev = this.sleep.stage; const stage = this.sleep.tick(this.hour, clamp(this.speedEMA), br.nm.NE, clamp(1 - this.light), clamp(br.spikes / 60));
    if (stage !== prev) { this.ev('sleep', `stage ${['WAKE', 'N1', 'N2', 'N3', 'REM'][prev]} -> ${['WAKE', 'N1', 'N2', 'N3', 'REM'][stage]}`); if (stage) { this.goal = null; this.race = null; } }
    if (stage === 2 || stage === 3) this.replay(); if (stage === 4 && !this.lesion.dream) this.dream();
    // decide: hungry -> striatal race over sites; dropped food in view -> innate orienting; otherwise curiosity: least-visited place
    if (stage === 0 && !this.goal && !this.race) { const hd = this.body.head(); const sn = this.world.snacks.filter((s) => Math.hypot(s.x - hd[0], s.z - hd[2]) < 14);
      if (sn.length) { const s = sn[0]; this.goal = { type: 'snack', id: s.id, since: this.t }; this.ev('orient', 'oriented to dropped food'); }
      else if (M.hunger() > 0.18 || this.r() < 0.5) this.startRace(); else if (!this.lesion.hdc) { /* curiosity from the HDC visit map: sample candidate places, go where the map recalls the fewest visits */ let bx = 0, bz = 0, bv = 1e9; for (let q = 0; q < 48; q++) { const ex = (this.r() - 0.5) * 36, ez = (this.r() - 0.5) * 36; const dd = Math.hypot(ex - hd[0], ez - hd[2]); if (dd < 4) continue; const v = this.hdcVisit.recall(ex, ez) + 0.03 * dd + 0.3 * this.r(); if (v < bv) { bv = v; bx = ex; bz = ez; } }
        this.goal = { type: 'explore', x: bx, z: bz, since: this.t }; this.ev('explore', `curiosity: heading to the place the HDC map recalls least (visit recall ${bv.toFixed(2)})`); }
      else { let best = 0, bv = 1e9; for (let i = 0; i < this.novelty.length; i++) { const ex = ((i % 24) / 24 - 0.5) * 36, ez = (Math.floor(i / 24) / 24 - 0.5) * 36; const dd = Math.hypot(ex - hd[0], ez - hd[2]); const v = this.novelty[i] + this.r() * 0.5 + (dd < 4 ? 99 : 0.04 * dd); if (v < bv) { bv = v; best = i; } } this.goal = { type: 'explore', x: ((best % 24) / 24 - 0.5) * 36, z: (Math.floor(best / 24) / 24 - 0.5) * 36, since: this.t }; this.ev('explore', 'curiosity: heading to least-visited area'); } }
    if (this.goal && this.goal.type === 'explore') { const hd = this.body.head(); if (Math.hypot(this.goal.x - hd[0], this.goal.z - hd[2]) < 1.5) this.goal = null; }
    const com = this.body.com(); const gi = clamp(Math.floor((com[0] / 36 + 0.5) * 24), 0, 23) + 24 * clamp(Math.floor((com[2] / 36 + 0.5) * 24), 0, 23); this.novelty[gi] += 1; if (this.tick % 4 === 0) { this.hdcVisit.add(com[0], com[2], 0.25); this.hdcVisit.decay(0.9997); }
    // morphological growth: anabolic tissue gain slowly scales the body (bounded)
    const target = 1 + clamp(M.tissue * 0.4, 0, 0.35); this.body.scale += 0.01 * (target - this.body.scale);
    // per-part growth: girth follows fat stores (leptin); each limb grows with its own recent use (use-dependent hypertrophy,
    // paid for from the protein/tissue pool) and slowly atrophies when idle. Rest lengths of that limb's constraints scale with it.
    if (!this.lesion.growth) { const B = this.body; for (let i = 0; i < NS; i++) B.girth[i] += 0.004 * (0.85 + 0.35 * M.leptin - B.girth[i]);
      B.limbs.forEach((L, k) => { const use = clamp(this.limbUse[k] / Math.max(1, this.limbUseN) / 2.2); this.limbUseEMA[k] += 0.02 * (use - this.limbUseEMA[k]); const grow = 0.00025 * this.limbUseEMA[k] * (0.4 + clamp(M.muscle / 150)) - 0.0006 * (B.limbLen[k] - 1); B.limbLen[k] = clamp(B.limbLen[k] + grow, 0.85, 1.45); }); this.limbUse.fill(0); this.limbUseN = 0; }
    this.flawTick();
  }
  flawTick() { const F = this.flaws, br = this.brain, t = this.tick;
    if (F.scramble.on && t % Math.max(1, Math.round(F.scramble.period)) === 0) this.rewire();
    if (F.leaky.on) { const L = F.leaky.rate; for (let k = 0; k < SITES; k++) this.wSite[k] += L * (0.25 - this.wSite[k]); for (let s = 0; s < br.S; s++) if (br.plastic[s]) br.w[s] += L * 0.05 * (br.w0[s] - br.w[s]); for (let i = 0; i < this.Wc.length; i++) this.Wc[i] += L * 0.05 * (this.Wc0[i] - this.Wc[i]); for (let i = 0; i < this.Wmot.length; i++) this.Wmot[i] += L * 0.05 * (this.Wmot0[i] - this.Wmot[i]); }
    if (F.misfire.on && t % Math.max(1, Math.round(F.misfire.period)) === 0) { const k = Math.floor(this.gr() * SITES); this.wSite[k] = clamp(this.wSite[k] + F.misfire.sd * gauss(this.gr)); for (let j = 0; j < F.misfire.jolts; j++) { br.jolt[Math.floor(this.gr() * br.N)] += 4; const s = Math.floor(this.gr() * br.S); br.w[s] += F.misfire.sd * gauss(this.gr) * (Math.abs(br.w[s]) + 0.1); } this.stats.misfires++; this.ev('misfire', `misfire: ${F.misfire.jolts} neurons jolted, synapses + site ${k} value perturbed`); } }
  /** NREM: replay stored waking episodes - re-train the world model on them and re-activate their cortical assemblies so STDP consolidates them */
  replay() { const E = this.episodes; if (!E.length) return; for (let j = 0; j < 4; j++) { const e = E[Math.floor(this.r() * E.length)]; this.wm.learn(e.z, e.y, 0.02); for (const i of e.ctx) this.brain.jolt[R0.CTX + i] += 1.5; for (let i = 0; i < 4; i++) this.brain.jolt[R0.HIP + Math.floor(this.r() * 32)] += 1.2; this.stats.replays++; } }
  /** REM: dreaming. (1) reference dreamBelief: unexperienced sites get a low-confidence belief from colour/shape features;
   *  (2) offline rollouts: start from a remembered state, imagine 8 steps of each MOT synergy through the learned world model
   *  (feeding predictions back into a copy of the SSM), and store the imagined forward progress as that synergy's value prior. */
  dream() { for (let k = 0; k < SITES; k++) if (this.visits[k] === 0) { const P = this.world.plants[k]; const vh = clamp(this.featC[P.c] + this.featS[P.s]); this.bA[k] += 0.75 * (1 + 6 * vh - this.bA[k]); this.bB[k] += 0.75 * (1 + 6 * (1 - vh) - this.bB[k]); }
    const E = this.episodes; if (E.length < 10 || this.wm.lesion) return; let e = E[Math.floor(this.r() * E.length)]; if (!this.lesion.hopfield && this.hop.X.length > 8) { /* pattern completion: a noisy, half-masked cue of the current state retrieves a whole stored episode to dream from */ const cue = Float64Array.from(this.zPrev, (v, i) => (this.r() < 0.5 ? 0 : v - this.zMean[i]) + 0.1 * gauss(this.r)); const R = this.hop.retrieve(cue); const m = this.hop.meta[R.top]; if (m && m.ep) { e = m.ep; this.memStats.dreamSim = R.sim; } }
    const ssm = this.ssm.clone(); const log = [];
    for (let m = 0; m < 8; m++) { ssm.re.set(e.ssm[0]); ssm.im.set(e.ssm[1]); const z = Float64Array.from(e.z), y = new Float64Array(NY), u = new Float64Array(NY + 8); let prog = 0;
      for (let s = 0; s < 8; s++) { for (let q = 0; q < 8; q++) z[64 + q] = q === m ? 0.9 : 0.15; this.wm.predict(z, y); prog += y[12]; u.set(y); for (let q = 0; q < 8; q++) u[NY + q] = z[64 + q]; ssm.step(u); ssm.features(z); }
      this.Vimg[m] += 0.2 * (prog / 8 - this.Vimg[m]); log.push(prog / 8); }
    this.dreamLog = log; this.stats.dreams++; for (let i = 0; i < 6; i++) this.brain.jolt[R0.CTX + Math.floor(this.r() * 64)] += 2; }
  // ------------------------------------------------------------------ user interaction
  poke(i, dir) { const B = this.body; B.poke(i, dir[0] * 0.25, dir[1] * 0.25, dir[2] * 0.25); this.nociception = 1; this.sleep.forceWake = 20; this.ev('poke', 'poked: nociceptors -> LC burst, cortisol'); }
}
function setTimeout0(f) { f(); }
