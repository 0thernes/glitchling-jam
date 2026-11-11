// Glitchling v2 "live" (pass 15 architecture):
// Spiking 2-compartment cortical/hippocampal/thalamic brain + LTC CPG + 122 sLTC motor neurons + 3D soft Verlet body +
// metabolism + binocular ommatidial retina & learned hippocampal SLAM landmark map + online RTRL selective SSM + deep SiLU
// residual world model with heteroscedastic uncertainty + Eshkol order-3 Taylor-jet Frenet-Serret thought curvature &
// metacognition + Fisher/EWC & Moonlab SVD weight-space consolidation + Tsotchke 8-qubit statevector QRNG + unified 21-option
// striatal D1/D2 spike race (16 sites + 3 water pools + dropped snack + HDC epistemic exploration). DOM-free; runs in Node & Web.
import { mulberry, clamp, gauss, betaIG, IG0 } from './util.js';
import { World, SITES } from './world.js';
import { Body, CH, NS } from './body.js';
import { HDCMap, Hopfield } from './memory.js';
import { develop, developSteer } from './genome.js';
import { Nav, VIEW } from './nav.js';
import { Retina, STEREO_RANGE } from './vision.js';
import { Metacognition } from './metacog.js';
import { TsotchkeQRNG } from '../tsotchke/qrng.js';
import { STARTER, STARTER_INFO } from './starter_genome.js';
import { Brain, R0, RN, NSTR_OPT } from './brain.js';
import { CPG, NCPG } from './cpg.js';
import { Metab } from './metab.js';
import { SelectiveSSM, WorldModel, Sleep, PredictiveCoding } from './mind.js';
import { Skin } from './skin.js';

export const DEFAULT_FLAWS = {
  scramble: { on: false, period: 90, noise: 0.25 },
  leaky: { on: false, rate: 0.06 },
  backwards: { on: false },
  misfire: { on: false, period: 60, sd: 0.3, jolts: 20 },
};
export const MOT_NAMES = ['forward', 'turn L', 'turn R', 'rear up', 'reach', 'grip', 'jump', 'curl'];
export const GAIT = { sF: 2.2, sB: 0, gF: 1.8, gB: 0, eF: 1.0, eB: 0, eB2: 0, cS: 1.2, cO: 0, rS: 1.2, rO: 0, wv: 1, tauA: 0.35, gk: 5, cf: 1.3 };
const PCMIX = globalThis.TW?.pcMix ?? 0.25;
const SUN_AZ = 0.8;
const NMN = CH.N * 2, NPHI = 20, NY = 25, NZ = 64 + 8;

export class Creature {
  constructor(seed = 1, opts = {}) {
    this.seed = seed;
    const r = (this.r = mulberry(seed));
    this.gr = mulberry(seed * 9973 + 7);
    this.qrng = new TsotchkeQRNG(seed);
    this.flaws = JSON.parse(JSON.stringify(opts.flaws || DEFAULT_FLAWS));

    this.world = new World(seed);
    this.body = new Body(this.world, 0, 0, r() * Math.PI * 2);
    this.brain = new Brain(seed);
    this.gen = { ...STARTER, ...(globalThis.TW?.genome || {}) };
    const gn = this.gen;
    this.G = {
      ...GAIT,
      cS: gn.cS, cO: gn.cO, rS: gn.rS, rO: gn.rO, tauA: gn.tauA, cf: gn.cf, wvAsc: gn.wvAsc, wvDesc: gn.wvDesc,
      ...(globalThis.TW?.gait || {}),
    };
    this.cpg = new CPG(seed, this.G);
    this.liftK = globalThis.TW?.lift ?? gn.lift;
    if (globalThis.TW?.coulomb) this.body.coulomb = globalThis.TW.coulomb;

    this.metab = new Metab();
    this.sleep = new Sleep();
    {
      const F3 = this.body.F[3], c0 = this.body.com();
      this.prevHdg = Math.atan2(F3.f[2], F3.f[0]);
      this.prevSy = F3.s[1];
      this.rollVelEMA = 0;
      this.nav = new Nav(seed, this.prevHdg);
      this.nav.px = c0[0];
      this.nav.pz = c0[2];
      this.navErr = { hd: 0, pos: 0 };
    }
    this.retina = new Retina(seed, SITES, this.world.pools.length);
    this.ssm = new SelectiveSSM(NY + 8, 32, seed);
    this.wm = new WorldModel(NZ, NY, seed, 48);
    this.metacog = new Metacognition(seed, 96);
    this.metaFeat = new Float64Array(96);

    this.z = new Float64Array(NZ);
    this.y = new Float64Array(NY);
    this.yPrev = new Float64Array(NY);
    this.zPrev = new Float64Array(NZ);

    this.lesion = {
      mot: false, cpg: false, mn: false, stdp: false, wm: false, astro: false, learnMotor: false,
      efe: false, veto: false, dream: false, vision: false, metacog: false, ssmLearn: false, qrng: false, homeo: false,
    };
    this.t = 0; this.frame = 0; this.tick = 0; this.hour = 8; this.dayLen = 1440;

    // Motor connectome: innate genome-developed W*0 + learned plastic W* + intrinsic biases + diagonal Fisher EWC anchors
    this.mnAct = new Float64Array(NMN);
    this.xi = new Float64Array(NMN);
    this.phi = new Float64Array(NPHI);
    this.motRate = new Float64Array(8);
    this.mnHomeo = new Float64Array(NMN);
    this.motBias = new Float64Array(8);
    this.mnAvg = new Float64Array(NMN).fill(0.1);
    this.motDrive = new Float64Array(8);

    this.Wc = new Float64Array(NMN * NCPG);
    this.Wm = new Float64Array(NMN * 8);
    this.Wp = new Float64Array(NMN * NPHI);
    this.Wmot = new Float64Array(8 * NPHI);
    this.Ec = new Float64Array(NMN * NCPG);
    this.Em = new Float64Array(NMN * 8);
    this.Ep = new Float64Array(NMN * NPHI);
    this.Emot = new Float64Array(8 * NPHI);

    this.yAvg = new Float64Array(NCPG);
    this.mAvg = new Float64Array(8);
    this.initMotorWiring();

    // Innate ("unlearned") snapshots vs EWC consolidated anchors & Fisher precision
    this.Wc0 = Float64Array.from(this.Wc);
    this.Wm0 = Float64Array.from(this.Wm);
    this.Wp0 = Float64Array.from(this.Wp);
    this.Wmot0 = Float64Array.from(this.Wmot);
    this.WcAnc = Float64Array.from(this.Wc);
    this.WmAnc = Float64Array.from(this.Wm);
    this.WmotAnc = Float64Array.from(this.Wmot);
    this.fishWc = new Float32Array(this.Wc.length);
    this.fishWm = new Float32Array(this.Wm.length);
    this.fishWmot = new Float32Array(this.Wmot.length);
    this.ewcEnergy = 0;

    // Beliefs & spatial/episodic memories
    this.wSite = new Float32Array(SITES).fill(0.25);
    this.bA = new Float64Array(SITES).fill(1);
    this.bB = new Float64Array(SITES).fill(1);
    this.wAv = new Float64Array(SITES);
    this.visits = new Float64Array(SITES);
    this.featC = new Float64Array(4).fill(0.15);
    this.featS = new Float64Array(4).fill(0.15);
    this.senPerm = [...Array(16).keys()];

    this.goal = null; this.race = null; this.goalT = 0; this.lastDist = null;
    this.rBar = 0; this.da = 0; this.rpe = 0; this.nociception = 0; this.stuck = 0; this.progEMA = 0;
    this.recent = new Float64Array(SITES);
    this.selfV = 0.35; this.selfW = 0.45;
    this.goalBest = 1e9; this.goalBestT = 0;
    this.lastRaceBestG = 0; this.lastRaceAltG = 0;

    this.Vimg = new Float64Array(8);
    this.episodes = [];
    this.hdcVisit = new HDCMap(seed, 1024, 0.45);
    this.hdcFood = new HDCMap(seed + 1, 1024, 0.35);
    this.hdcWater = new HDCMap(seed + 2, 1024, 0.35);
    this.hop = new Hopfield(NZ, 1024, 24, seed);
    this.consolidated = false;
    this.zMean = new Float64Array(NZ);
    this.familiar = 0;
    this.drinking = 0;
    this.cephalic = 0;
    this.limbUse = new Float64Array(6);
    this.limbUseEMA = new Float64Array(6);
    this.limbUseN = 0;
    this.pc = new PredictiveCoding(seed, NY);

    this.memStats = { stored: 0, retrievals: 0, dreamSim: 0, famMean: 0 };
    this.stats = {
      eats: 0, rewards: 0, tries: 0, vetoes: 0, races: 0, dreams: 0, replays: 0,
      mirrored: 0, rewires: 0, misfires: 0, dist: 0, stings: 0, snacks: 0, urine: 0, feces: 0, drinks: 0,
    };
    this.events = [];
    this.motorHist = [];
    this.entropy = 0;
    this.lastCom = this.body.com();
    this.growth = 0;
    this.raceLog = new Float64Array(NSTR_OPT * 2);
    this.dreamLog = [];
    this.skin = new Skin();
    this.speedEMA = 0;

    // Initial retinal look around starting pose
    this.retina.step(this.body, this.world, this.nav, false, false);
  }

  ev(type, msg) { this.events.push({ t: this.tick, type, msg }); if (this.events.length > 80) this.events.shift(); }
  mn(ch, ant) { return ch * 2 + (ant ? 1 : 0); }

  initMotorWiring() {
    const r = mulberry(this.seed * 211 + 9), C = NCPG;
    const wc = (ch, ant, k, v) => { this.Wc[this.mn(ch, ant) * C + k] += v; };
    const wm = (ch, ant, m, v) => { this.Wm[this.mn(ch, ant) * 8 + m] += v; };
    const wp = (ch, ant, p, v) => { this.Wp[this.mn(ch, ant) * NPHI + p] += v; };
    for (let i = 0; i < this.Wc.length; i++) this.Wc[i] = (r() - 0.5) * 0.25;
    for (let i = 0; i < this.Wm.length; i++) this.Wm[i] = (r() - 0.5) * 0.12;
    for (let i = 0; i < this.Wp.length; i++) this.Wp[i] = (r() - 0.5) * 0.08;
    // 100% of innate motor, righting, roll-damping, synergy, stalk, gaze & steering weights grow from the genome!
    develop(this.gen, CH, wc, wm, wp);
    const M = (m, p, v) => { this.Wmot[m * NPHI + p] = v; };
    developSteer(this.gen, M);
  }

  updateSwingVel() {
    const B = this.body;
    if (!this.gripOf) {
      this.gripOf = new Int8Array(CH.N).fill(-1);
      B.limbs.forEach((L, k) => { this.gripOf[L.grip] = k; });
      this.swingVel = new Float64Array(B.limbs.length);
      this.swingPrev = new Float64Array(B.limbs.length);
    }
    B.limbs.forEach((L, k) => {
      const sw = L.kind === 'leg' ? CH.leg + L.idx * 2 : CH.arm + L.idx * 3;
      const st = B.stretch[sw];
      const v = (st - this.swingPrev[k]) * 60;
      this.swingPrev[k] = st;
      this.swingVel[k] += 0.3 * (v - this.swingVel[k]);
    });
  }

  setFlaws(f) {
    const was = this.flaws.scramble.on;
    this.flaws = JSON.parse(JSON.stringify(f));
    if (this.flaws.scramble.on && !was) this.rewire();
    if (!this.flaws.scramble.on) this.senPerm = [...Array(16).keys()];
  }

  rewire() {
    const p = [...Array(16).keys()];
    for (let i = 15; i > 0; i--) { const j = Math.floor(this.gr() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    this.senPerm = p;
    this.stats.rewires++;
    this.ev('scramble', 'senses rewired: SENS neurons now report through a new permutation');
  }

  // ------------------------------------------------------------------ sensing & binocular retinal-hippocampal navigation
  target() {
    const g = this.goal;
    if (!g) return null;
    if (g.type === 'site') {
      if (globalThis.TW?.omni) {
        const P = this.world.plants[g.k];
        return [P.x, P.y + 0.3, P.z];
      }
      // Use hippocampal remembered landmark coordinates learned from binocular visual sightings (not omniscient map!)
      const mp = this.retina.sitePos(g.k, this.world);
      // If never glimpsed yet (conf=0) and probe forced a site goal directly, allow coarse floral plume / horizon prior
      if (mp.conf === 0) {
        const P = this.world.plants[g.k];
        return [P.x, P.y + 0.3, P.z];
      }
      return [mp.x, this.world.height(mp.x, mp.z) + 0.3, mp.z];
    }
    if (g.type === 'water') {
      if (g.pool !== undefined && !globalThis.TW?.omni) {
        const mp = this.retina.poolPos(g.pool, this.world);
        if (mp) return [mp.x, this.world.height(mp.x, mp.z), mp.z];
      }
      return [g.x, this.world.height(g.x, g.z), g.z];
    }
    if (g.type === 'snack') {
      const s = this.world.snacks.find((q) => q.id === g.id);
      if (!s) { this.goal = null; return null; }
      return [s.x, s.y, s.z];
    }
    return [g.x, this.world.height(g.x, g.z), g.z];
  }

  sense() {
    const B = this.body, F = B.F, W = this.world, hd = B.head(), fr = F[this.bearSeg ?? (+(globalThis.process?.env?.BSEG ?? 6))];
    const frAz = Math.atan2(fr.f[2], fr.f[0]);
    const wrapAz = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    B.curvature();

    // Estimate current goal bearing/distance prior to retinal pass so boulder-tangent symmetry breaking knows goal side
    const tgPre = this.target();
    let preBear = 0, preDist = 1e9;
    if (tgPre) {
      if (this.lesion.nav) {
        preDist = Math.hypot(tgPre[0] - hd[0], tgPre[2] - hd[2]);
      } else {
        const ex = tgPre[0] - this.nav.px, ez = tgPre[2] - this.nav.pz;
        preBear = wrapAz(Math.atan2(ez, ex) - this.nav.heading());
        preDist = Math.hypot(ex, ez);
      }
    }

    // Update binocular ommatidial retina + hippocampal landmark SLAM at 60 Hz while awake (20 Hz in sleep)
    if (this.sleep.stage === 0 || this.frame % 3 === 1) {
      this.retina.step(B, W, this.nav, !!this.lesion.nav, !!this.lesion.vision, preBear, preDist);
    }

    const tg = this.target(), g = this.goal;
    let bear = 0, dist = 0, up = 0;
    this.navMode = 'sight';

    if (tg) {
      // Check if goal landmark is currently visible on the unoccluded binocular retina
      const lmId = g?.type === 'site' ? g.k : g?.type === 'water' && g.pool !== undefined ? SITES + g.pool : -1;
      if (globalThis.TW?.omni) {
        const dx = tg[0] - hd[0], dy = tg[1] - hd[1], dz = tg[2] - hd[2];
        bear = wrapAz(Math.atan2(dz, dx) - frAz);
        dist = Math.hypot(dx, dz);
        up = clamp(dy / 3, -1, 1);
      } else if (lmId >= 0 && !this.lesion.vision && this.retina.vis[lmId] === 1) {
        // High-acuity close binocular stereo fix (<= 9 u, unoccluded, inside 260-deg FOV)
        bear = this.retina.visBear[lmId];
        dist = this.retina.visDist[lmId];
        up = clamp((tg[1] - hd[1]) / 3, -1, 1);
        this.navMode = 'sight';
      } else if (g?.type === 'snack') {
        const dx = tg[0] - hd[0], dy = tg[1] - hd[1], dz = tg[2] - hd[2];
        const dTrue = Math.hypot(dx, dz);
        if (dTrue <= VIEW) {
          bear = wrapAz(Math.atan2(dz, dx) - frAz);
          dist = dTrue;
          up = clamp(dy / 3, -1, 1);
        } else if (this.lesion.nav) {
          bear = 0; this.navMode = 'none';
        } else {
          const N = this.nav, ex = tg[0] - N.px, ez = tg[2] - N.pz;
          bear = wrapAz(Math.atan2(ez, ex) - N.heading());
          dist = Math.hypot(ex, ez);
          this.navMode = 'path-integration';
        }
      } else {
        // Occluded by rock/ridge or outside 260-deg FOV -> vector navigation from hippocampal landmark + path integration
        if (this.lesion.nav) {
          bear = 0;
          dist = Math.hypot(tg[0] - hd[0], tg[2] - hd[2]);
          this.navMode = 'none';
        } else {
          const N = this.nav;
          const neckHdg = N.heading();
          const hx = N.px + 1.15 * Math.cos(neckHdg), hz = N.pz + 1.15 * Math.sin(neckHdg);
          const ex = tg[0] - hx, ez = tg[2] - hz;
          bear = wrapAz(Math.atan2(ez, ex) - neckHdg);
          dist = Math.hypot(ex, ez);
          this.navMode = 'path-integration';
        }
      }
    }

    // Course-over-ground optic-flow drift compensation
    {
      const v = this.vel || [0, 0, 0];
      this.vEMA = this.vEMA || [0, 0];
      this.vEMA[0] += 0.05 * (v[0] - this.vEMA[0]);
      this.vEMA[1] += 0.05 * (v[2] - this.vEMA[1]);
      const sp = Math.hypot(this.vEMA[0], this.vEMA[1]) * 60;
      if (tg && sp > 0.12 && !this.lesion.course) {
        const hdgHead = Math.atan2(fr.f[2], fr.f[0]), course = Math.atan2(this.vEMA[1], this.vEMA[0]);
        let off = course - hdgHead;
        off = Math.atan2(Math.sin(off), Math.cos(off));
        const w = (this.gen.kCourse ?? 0) * Math.min(1, (sp - 0.12) / 0.2);
        bear = Math.atan2(Math.sin(bear - w * off), Math.cos(bear - w * off));
      }
    }

    this.bear = bear;
    this.dist = dist;
    const [vx, vy, vz] = this.vel || [0, 0, 0];
    const vf = (vx * fr.f[0] + vy * fr.f[1] + vz * fr.f[2]) * 60;
    const vl = (vx * fr.s[0] + vy * fr.s[1] + vz * fr.s[2]) * 60;
    this.vf = vf;
    this.speedEMA += 0.02 * (Math.hypot(vx, vz) * 60 - this.speedEMA);

    // Retinal obstacle looming (central + lateralised left/right hemifields)
    const obst = this.lesion.vision ? 0 : this.retina.obstAhead;
    const obstL = this.lesion.vision ? 0 : this.retina.obstL;
    const obstR = this.lesion.vision ? 0 : this.retina.obstR;

    let spring = 0;
    for (const S of W.springs) { const d = Math.hypot(S.x - hd[0], S.z - hd[2]); if (d < 3) spring = Math.max(spring, 1 - d / 3); }
    let rockT = 0;
    for (let i = 0; i < B.n; i++) if (B.contact[i] === 2) rockT++;
    rockT = clamp(rockT / 6);

    const upY = F[3].u[1];
    const upside = clamp(-upY * 1.5);
    const sy = F[3].s[1];
    const rollRate = clamp((sy - (this.prevSy ?? sy)) * 60, -6, 6);
    this.prevSy = sy;
    this.rollVelEMA = 0.65 * (this.rollVelEMA || 0) + 0.35 * rollRate;

    const hunger = this.metab.hunger();
    const awake = this.sleep.stage === 0;
    // Proprioceptive uphill load recruitment (Golgi-tendon / spindle effort reflex) + posture-gated stride
    const driveLevel = Math.max(hunger, this.lesion.thirst ? 0 : this.metab.thirst);
    const upGate = clamp((upY + 0.25) / 0.55, 0.35, 1);
    const loadBoost = awake && this.goal && !this.drinking ? clamp((0.32 - vf) * 0.55, 0, 0.32) : 0;
    const forage = awake && this.goal ? (this.drinking ? 0.08 : (0.94 + 0.28 * driveLevel + loadBoost) * upGate) : 0;

    // Vestibulospinal roll-stability gating: attenuate hard lateral turns when tilted so righting plants the down-side feet first
    const turnStab = clamp((upY - 0.25) / 0.42, 0.05, 1);
    const P = this.phi;
    const turnGoalGate = 1 - 0.5 * Math.max(bear < 0 ? obstL : 0, bear > 0 ? obstR : 0);
    P[0] = clamp(-bear / 0.7) * (tg ? turnStab * turnGoalGate : 0);
    P[1] = clamp(bear / 0.7) * (tg ? turnStab * turnGoalGate : 0);
    P[2] = forage;
    P[3] = obst;
    P[4] = tg ? clamp(1 - dist / 1.8) : 0;
    P[5] = rockT;
    P[6] = clamp(this.stuck);
    P[7] = clamp(this.nociception);
    P[8] = upside;
    P[9] = spring * (tg ? 1 : 0.2);
    P[10] = Math.sin(bear);
    P[11] = up;
    P[12] = clamp(this.Vimg[0] * 2, -1, 1) * 0.5;
    P[13] = 1;
    // Vestibular utricle static tilt (dead-zone latch only near 180-deg apex |sy|<=0.18; always track true lower side when |sy|>0.18)
    const tilt = clamp((0.82 - upY) * 1.65);
    if (upY > 0.55) {
      this.rightSide = 0;
    } else if (Math.abs(sy) > 0.18 || !this.rightSide) {
      this.rightSide = sy >= 0 ? 1 : -1;
    }
    const rSide = this.rightSide || (sy >= 0 ? 1 : -1);
    P[14] = tilt * (rSide > 0 ? 1 : 0);
    P[15] = tilt * (rSide < 0 ? 1 : 0);
    const rGate = clamp((0.83 - upY) * 1.9);
    P[16] = sy > 0.12 && this.rollVelEMA > 0 ? clamp(this.rollVelEMA * 0.3) * rGate : 0;
    P[17] = sy < -0.12 && this.rollVelEMA < 0 ? clamp(-this.rollVelEMA * 0.3) * rGate : 0;
    if (globalThis.TW?.noTilt) P[14] = P[15] = P[16] = P[17] = 0;
    // Retinal lateral boulder looming (left vs right hemifield), roll-stabilised
    P[18] = obstL * (tg ? Math.max(0.35, turnStab) : 0.4);
    P[19] = obstR * (tg ? Math.max(0.35, turnStab) : 0.4);

    // World-model 25-dim proprioceptive + vestibular + contact + bearing vector y
    const y = this.y;
    for (let i = 0; i < 6; i++) { y[i] = clamp(B.curvL[i] / 3, -2, 2); y[6 + i] = clamp(B.curvU[i] / 3, -2, 2); }
    y[12] = clamp(vf / 3, -2, 2); y[13] = clamp(vl / 3, -2, 2); y[14] = clamp(vy * 20, -2, 2); y[15] = upY; y[16] = sy;
    B.limbs.forEach((L, k) => { y[17 + k] = B.contact[L.foot] ? 1 : 0; });
    y[23] = Math.sin(bear); y[24] = Math.cos(bear) * (tg ? 1 : 0);

    // Neural drive currents for all non-motor brain regions
    const ext = this.brain.ext, nm = this.brain.nm;
    ext.fill(0);
    const sens = new Float64Array(16);
    for (let i = 0; i < 8; i++) {
      const ph = -Math.PI + ((i + 0.5) * 2 * Math.PI) / 8;
      let d = Math.abs(bear - ph);
      if (d > Math.PI) d = 2 * Math.PI - d;
      sens[i] = tg ? 1.5 * Math.exp(-(d * d) / 0.4) : 0;
    }
    // Chromatic retinal response (pooled R/G/B + UV/shimmer across the 32 ommatidia)
    let rSum = 0, gSum = 0, bSum = 0;
    for (let b = 0; b < 32; b++) {
      rSum += this.retina.rgb[3 * b];
      gSum += this.retina.rgb[3 * b + 1];
      bSum += this.retina.rgb[3 * b + 2];
    }
    sens[8] = clamp(gSum / 6) * 1.4;
    sens[9] = clamp(rSum / 6) * 1.4;
    sens[10] = clamp(bSum / 6) * 1.4;
    sens[11] = clamp(this.retina.opticFlowMean * 3) * 1.2;
    sens[12] = 2 * clamp(this.nociception);
    sens[13] = rockT * 1.2;
    sens[14] = this.light * 1.0;
    sens[15] = Math.max(obst, obstL, obstR) * 1.4;

    const sc = this.flaws.scramble;
    for (let i = 0; i < 16; i++) ext[R0.SENS + this.senPerm[i]] = 0.6 + sens[i] + (sc.on ? sc.noise * gauss(this.gr) : 0);
    for (let i = 0; i < 6; i++) {
      ext[R0.PROP + 2 * i] = 0.7 + clamp(B.curvL[i] / 2) * 1.5;
      ext[R0.PROP + 2 * i + 1] = 0.7 + clamp(-B.curvL[i] / 2) * 1.5;
      ext[R0.PROP + 12 + 2 * i] = 0.7 + clamp(B.curvU[i] / 2) * 1.5;
      ext[R0.PROP + 13 + 2 * i] = 0.7 + clamp(-B.curvU[i] / 2) * 1.5;
    }
    B.limbs.forEach((L, k) => { if (k < 6) ext[R0.PROP + 24 + k] = 0.6 + 1.2 * (B.contact[L.foot] ? 1 : 0); });
    ext[R0.PROP + 30] = 0.6 + 1.5 * upside;
    ext[R0.PROP + 31] = 0.6 + clamp(Math.abs(vf) / 2) * 1.2;

    const M = this.metab;
    const intero = [clamp(0.95 - M.blood.glc / 3) * 2, M.ghrelin, clamp(M.bladder / 1.2), clamp(M.colon / 1.5), clamp(1 - M.atp / 2), M.thirst, M.cortisol, clamp((M.hr - 60) / 60)];
    for (let i = 0; i < 8; i++) ext[R0.INS + i] = 0.6 + 1.2 * intero[i];
    for (let i = 0; i < 16; i++) ext[R0.HYP + i] = 0.5 + (i < 8 ? 1.2 * hunger : 1.0 * M.thirst + 0.6 * this.sleep.S);
    const ph = (2 * Math.PI * this.hour) / 24;
    for (let i = 0; i < 8; i++) ext[R0.SCN + i] = 0.7 + 0.6 * Math.max(0, Math.cos(ph - (i * 2 * Math.PI) / 8));
    for (let i = 0; i < 6; i++) {
      ext[R0.VTA + i] = 0.9 + 3 * Math.max(0, this.rpe) - 1.5 * Math.max(0, -this.rpe);
      ext[R0.LC + i] = 0.8 + 2.5 * ((1 - PCMIX) * this.wm.surprise + PCMIX * this.pc.surprise) + 2 * clamp(this.nociception) + (awake ? 0.2 : -0.3);
      ext[R0.RAPHE + i] = 0.8 + 0.5 * clamp(1 - hunger) + (awake ? 0.2 : -0.2) * (this.sleep.stage === 4 ? -2 : 1);
      ext[R0.BF + i] = 0.8 + 0.6 * this.uncert() * (this.metacog?.achGain ?? 1) + (awake || this.sleep.stage === 4 ? 0.3 : -0.3);
    }
    const ens = clamp((M.gut.glc + M.gut.fat + M.gut.prot) / 6);
    for (let i = 0; i < 48; i++) ext[R0.ENS + i] = 0.6 + 0.8 * ens + 0.4 * M.para;

    for (let i = 0; i < RN.STR; i++) ext[R0.STR + i] = 0.4;
    for (let i = 0; i < RN.CTX; i++) ext[R0.CTX + i] = 0.55 + 0.3 * nm.ACh;
    for (let i = 0; i < RN.THAL; i++) ext[R0.THAL + i] = awake ? 0.5 : this.sleep.stage === 4 ? 0.45 : 0.2;
    for (let i = 0; i < RN.HIP; i++) ext[R0.HIP + i] = 0.45;
    if (!this.brain.delegated && !this.lesion.nav && awake) this.brain.drivePlaceCells(this.nav.px, this.nav.pz, 1.15);
    if (this.familiar > 0 && this.hop.lastIdx >= 0) {
      for (let j = 0; j < 8; j++) ext[R0.HIP + ((this.hop.lastIdx * 7 + j * 5) % RN.HIP)] += 1.4 * this.familiar;
    }
    if (this.race) this.raceDrive(ext);

    // Sense -> MOT drive (genome-grown Wmot + plastic updates + learned intrinsic motBias)
    for (let m = 0; m < 8; m++) {
      let s = this.motBias[m];
      for (let p = 0; p < NPHI; p++) s += this.Wmot[m * NPHI + p] * P[p];
      this.motDrive[m] = s;
      ext[R0.MOT + m] = awake ? s : -1;
    }
    this.light = clamp(0.5 + 0.6 * Math.cos(((this.hour - 13) * 2 * Math.PI) / 24));
  }

  uncert() {
    let s = 0;
    for (let k = 0; k < SITES; k++) s += Math.sqrt((this.bA[k] * this.bB[k]) / ((this.bA[k] + this.bB[k]) ** 2 * (this.bA[k] + this.bB[k] + 1)));
    return clamp((s / SITES) * 3.5);
  }

  // ------------------------------------------------------------------ Unified 21-channel Striatal D1/D2 Race
  // Channels: 0..15 = plant sites, 16..18 = water pools, 19 = dropped snack, 20 = HDC epistemic exploration.
  travelTerms(tx, tz) {
    const hd = this.body.head(), F = this.body.F[NS - 1];
    const px = this.lesion.nav ? hd[0] : this.nav.px, pz = this.lesion.nav ? hd[2] : this.nav.pz;
    const d = Math.hypot(tx - px, tz - pz);
    const bear = Math.abs(Math.atan2((tx - px) * F.s[0] + (tz - pz) * F.s[2], (tx - px) * F.f[0] + (tz - pz) * F.f[2]));
    const tTravel = d / Math.max(0.1, this.selfV) + bear / Math.max(0.12, this.selfW);
    const baseCost = this.lesion.selfModel ? 0.012 * d * (1 + this.metab.cortisol) : 0.015 * tTravel * (1 + this.metab.cortisol);
    return { d, bear, tTravel, baseCost };
  }

  efe(k) {
    const M = this.metab, hunger = M.hunger(), temp = this.metacog?.exploreTemp ?? 1;
    if (k < SITES) {
      const P = this.world.plants[k];
      const mp = this.retina.sitePos(k, this.world);
      const mean = this.bA[k] / (this.bA[k] + this.bB[k]);
      const hdcV = this.lesion.hdc ? 0 : clamp(this.hdcFood.recall(mp.x, mp.z), -1, 1);
      const foodDrive = 0.45 + 0.95 * hunger;
      const prag = foodDrive * (this.lesion.hdc ? 0.5 * this.wSite[k] + 0.5 * mean : 0.45 * this.wSite[k] + 0.45 * mean + 0.25 * hdcV);
      const epi = this.lesion.efe ? 0 : temp * (0.28 * (0.5 + this.brain.nm.ACh + 0.5 * this.brain.nm.NE) * (betaIG(this.bA[k], this.bB[k]) / IG0 - 0.5) + 0.14 * (1 - mp.conf));
      const { tTravel, baseCost } = this.travelTerms(mp.x, mp.z);
      const visFruitPenalty = this.retina.vis[k] > 0 && P.fruit < 0.3 ? 0.45 : 0;
      const cost = baseCost + visFruitPenalty + (this.lesion.ior ? 0 : 0.9 * this.recent[k]);
      return { G: -(prag + epi - cost), prag, epi, cost, tTravel, harm: this.wAv[k] * (1 + M.cortisol) };
    }
    if (k < SITES + 3) {
      // Water pool channel (p = k - 16)
      if (this.lesion.thirst || M.thirst < 0.16) return null;
      const p = k - SITES, Wp = this.world.pools[p], hd = this.body.head();
      const mp = this.retina.poolPos(p, this.world);
      // Hygroreception (humidity gradient within 22 u) + visual memory + HDC water value map
      const dHumid = Math.hypot(Wp.x - hd[0], Wp.z - hd[2]);
      let tx = mp ? mp.x : null, tz = mp ? mp.z : null;
      if (tx === null && dHumid < 22) { tx = Wp.x; tz = Wp.z; }
      if (tx === null) {
        // Search HDC water map or explore outward for humidity
        let bestV = -1e9, bx = 0, bz = 0;
        for (let q = 0; q < 24; q++) {
          const ex = (this.draw01() - 0.5) * 34, ez = (this.draw01() - 0.5) * 34;
          const v = this.hdcWater.recall(ex, ez);
          if (v > bestV) { bestV = v; bx = ex; bz = ez; }
        }
        if (bestV > 0.12) { tx = bx; tz = bz; }
        else { const a = (p * 2.094) + this.t * 0.05; tx = clamp(hd[0] + 11 * Math.cos(a), -16, 16); tz = clamp(hd[2] + 11 * Math.sin(a), -16, 16); }
      }
      const wMem = this.lesion.hdc ? 0.5 : clamp(0.5 + 0.5 * this.hdcWater.recall(tx, tz), 0.2, 1.2);
      const prag = 2.8 * M.thirst * wMem;
      const epi = this.lesion.efe ? 0 : 0.2 * (mp ? 1 - mp.conf : 0.8);
      const { tTravel, baseCost } = this.travelTerms(tx, tz);
      return { G: -(prag + epi - baseCost * 0.85), prag, epi, cost: baseCost * 0.85, tTravel, harm: 0, x: tx, z: tz, pool: p };
    }
    if (k === SITES + 3) {
      // Dropped snack channel (competes in striatal race rather than hardcoded bypass!)
      const hd = this.body.head();
      let bestS = null, bd = 16;
      for (const s of this.world.snacks) {
        const d = Math.hypot(s.x - hd[0], s.z - hd[2]);
        if (d < bd) { bd = d; bestS = s; }
      }
      if (!bestS) return null;
      const prag = 1.15 + 0.8 * hunger;
      const { tTravel, baseCost } = this.travelTerms(bestS.x, bestS.z);
      return { G: -(prag - baseCost), prag, epi: 0.1, cost: baseCost, tTravel, harm: 0, snackId: bestS.id };
    }
    // k === 20: Epistemic curiosity / HDC least-visited place (replaces the old 24x24 visit-count grid!)
    const hd = this.body.head();
    let bx = 0, bz = 0, bv = 1e9;
    for (let q = 0; q < 36; q++) {
      const ex = (this.draw01() - 0.5) * 34, ez = (this.draw01() - 0.5) * 34;
      const dd = Math.hypot(ex - hd[0], ez - hd[2]);
      if (dd < 4.5) continue;
      const vis = this.lesion.hdc ? 0 : this.hdcVisit.recall(ex, ez);
      const v = vis + 0.025 * dd + 0.25 * this.draw01();
      if (v < bv) { bv = v; bx = ex; bz = ez; }
    }
    const prag = 0.12;
    const epi = (this.lesion.efe ? 0.25 : 0.42 * temp * clamp(1.1 - hunger - M.thirst, 0.2, 1.0)) + 0.25 * (this.metacog?.regret ?? 0);
    const { tTravel, baseCost } = this.travelTerms(bx, bz);
    return { G: -(prag + epi - baseCost * 0.7), prag, epi, cost: baseCost * 0.7, tTravel, harm: 0, x: bx, z: bz };
  }

  draw01() { return this.lesion.qrng ? this.r() : this.qrng.next01(); }
  drawGauss() { return this.lesion.qrng ? gauss(this.r) : this.qrng.gauss(); }

  startRace(exclude = new Set()) {
    const terms = [];
    for (let k = 0; k < NSTR_OPT; k++) terms.push(exclude.has(k) ? null : this.efe(k));
    this.race = { terms, cnt: new Float64Array(NSTR_OPT), cntD2: new Float64Array(NSTR_OPT), t: 0, exclude };
    this.stats.races++;
  }

  raceDrive(ext) {
    const R = this.race;
    let tot = 0;
    for (let k = 0; k < NSTR_OPT; k++) tot += this.brain.rate[R0.STR + k];
    const inhib = 0.0035 * tot;
    for (let k = 0; k < NSTR_OPT; k++) {
      const T = R.terms[k];
      if (!T) { ext[R0.STR + k] = -1; ext[R0.STR + NSTR_OPT + k] = 0.2; continue; }
      ext[R0.STR + k] = 0.85 + 1.6 * -T.G - inhib;
      ext[R0.STR + NSTR_OPT + k] = 0.8 + 1.5 * T.harm + 0.8 * T.cost;
    }
  }

  raceCount() {
    const R = this.race, b = this.brain;
    for (let k = 0; k < NSTR_OPT; k++) {
      if (b.spk[R0.STR + k]) R.cnt[k] += 1;
      if (b.spk[R0.STR + NSTR_OPT + k]) R.cntD2[k] += 1;
    }
  }

  raceCheck(dt) {
    const R = this.race;
    R.t += dt;
    let best = -1, bv = -1e9, secondG = 0;
    for (let k = 0; k < NSTR_OPT; k++) {
      if (!R.terms[k]) continue;
      const v = R.cnt[k] - 0.6 * R.cntD2[k];
      this.raceLog[k] = R.cnt[k];
      this.raceLog[NSTR_OPT + k] = R.cntD2[k];
      if (v > bv) { bv = v; best = k; }
    }
    const needSpikes = this.lesion.metacog ? 8 : (this.metacog?.delibThr ?? 8);
    if (bv < needSpikes && R.t < 1.25) return;
    if (best < 0) { this.race = null; return; }

    let bestAltG = 1e9;
    for (let k = 0; k < NSTR_OPT; k++) if (k !== best && R.terms[k] && R.terms[k].G < bestAltG) bestAltG = R.terms[k].G;
    secondG = bestAltG < 1e8 ? bestAltG : R.terms[best].G;

    const k = best, T = R.terms[k];
    if (!this.lesion.veto && T.harm > 0.3 * (1 + this.brain.nm['5HT'])) {
      this.stats.vetoes++;
      this.ev('veto', `veto: cancelled option ${k} (predicted harm ${T.harm.toFixed(2)}), re-racing`);
      const ex = new Set(R.exclude); ex.add(k);
      this.startRace(ex);
      return;
    }
    this.lastRaceBestG = T.G;
    this.lastRaceAltG = secondG;
    this.race = null;
    this.lastDist = null;

    if (k < SITES) {
      let ke = k;
      if (this.flaws.backwards.on) { ke = SITES - 1 - k; this.stats.mirrored++; this.ev('backwards', `chose site ${k}, body heads to mirrored site ${ke}`); }
      this.goal = { type: 'site', k: ke, chosen: k, since: this.t };
      this.ev('decide', `race won by site ${k} (G=${T.G.toFixed(2)}: val ${T.prag.toFixed(2)}, info ${T.epi.toFixed(2)}, cost ${T.cost.toFixed(2)})`);
    } else if (k < SITES + 3) {
      this.goal = { type: 'water', pool: T.pool, x: T.x, z: T.z, since: this.t };
      this.ev('thirst', `striatal race chose water pool ${T.pool} (thirst ${this.metab.thirst.toFixed(2)}, G=${T.G.toFixed(2)})`);
    } else if (k === SITES + 3) {
      this.goal = { type: 'snack', id: T.snackId, since: this.t };
      this.ev('decide', `striatal race chose dropped food (G=${T.G.toFixed(2)})`);
    } else {
      this.goal = { type: 'explore', x: T.x, z: T.z, since: this.t };
      this.ev('explore', `striatal race chose HDC epistemic search (G=${T.G.toFixed(2)})`);
    }
  }

  // ------------------------------------------------------------------ main step (dt = 1/60 s)
  step() {
    const dt = 1 / 60, B = this.body, br = this.brain, cpg = this.cpg;
    this.frame++;
    this.t += dt;
    this.world.step(dt, this.tick);
    this.sense();

    const stage = this.sleep.stage, awake = stage === 0;
    br.atonia = stage >= 2 ? 3 : stage === 1 ? 0.8 : 0;
    br.sleepStage = stage;
    br.lesion.stdp = !!this.lesion.stdp;
    br.lesion.astro = !!this.lesion.astro;
    br.lesion.mot = !!this.lesion.mot;
    br.lesion.homeo = !!this.lesion.homeo;
    this.ssm.fixedProj = !!this.lesion.ssmLearn;

    const back = this.flaws.backwards.on;
    const cext = new Float64Array(NCPG);
    const mnI = new Float64Array(NMN);
    const GK = this.lesion.gripReflex ? 0 : this.G.gk;
    this.updateSwingVel();

    for (let s = 0; s < 8; s++) {
      for (let m = 0; m < 8; m++) {
        this.motRate[m] = this.forceMot
          ? this.forceMot[m]
          : this.babble?.on
          ? this.babble.mot[m]
          : 1.05 * Math.tanh(br.rate[R0.MOT + (back ? 7 - m : m)] / 36);
      }
      const mr = this.motRate;
      if (!this.forceMot && !this.babble?.on && !this.lesion.motNorm) {
        let tot = 0;
        for (let m = 0; m < 8; m++) tot += mr[m];
        for (let m = 0; m < 8; m++) mr[m] = mr[m] / (1 + 0.3 * (tot - mr[m]));
      }
      const fwd = mr[0], turn = mr[1] - mr[2];
      for (let i = 0; i < NCPG; i++) cext[i] = this.lesion.cpg ? -6 : (awake ? 0.15 : -0.6) + this.G.cf * fwd + 0.5 * mr[6] + 0.3 * mr[4];
      for (let o = 2; o < 6; o++) { cext[2 * o] += this.gen.cturn * turn; cext[2 * o + 1] -= this.gen.cturn * turn; }
      {
        const kL = this.gen.legTurn;
        for (let l = 0; l < 4; l++) {
          const sgn = l & 1 ? 1 : -1;
          cext[12 + 2 * l] += kL * sgn * turn;
          cext[13 + 2 * l] += kL * sgn * turn;
        }
      }
      for (let o = 0; o < 6; o++) {
        cext[2 * o] += 0.35 * clamp(B.stretch[CH.long + o * 4 + 3] * 4, -1, 1);
        cext[2 * o + 1] += 0.35 * clamp(B.stretch[CH.long + o * 4 + 1] * 4, -1, 1);
      }
      cpg.step(0.002, cext);
      const y = cpg.x;

      for (let n = 0; n < NMN; n++) {
        let I = 0.55 + this.xi[n] + this.mnHomeo[n];
        const oc = n * NCPG, om = n * 8, op = n * NPHI;
        for (let k = 0; k < NCPG; k++) I += this.Wc[oc + k] * y[k];
        for (let m = 0; m < 8; m++) I += this.Wm[om + m] * mr[m];
        for (let p = 0; p < NPHI; p++) I += this.Wp[op + p] * this.phi[p];
        const ch = n >> 1;
        I -= 0.4 * clamp(B.stretch[ch] * (n & 1 ? -1 : 1) * -3, -1, 1);
        if (this.gripOf[ch] >= 0) {
          const sv = this.swingVel[this.gripOf[ch]];
          I += (n & 1 ? -1 : 1) * clamp(GK * sv, -1.5, 1.5);
        }
        if (ch >= CH.gaze) I += br.atonia * (stage === 4 ? 1.1 : 0.9);
        mnI[n] = I;
        br.ext[R0.MN + n] = this.lesion.mn ? -5 : I;
      }
      br.step(0.002);
      if (this.race) this.raceCount();
      for (let n = 0; n < NMN; n++) this.mnAct[n] = this.mnAct[n] * 0.976 + (br.spk[R0.MN + n] ? 0.12 : 0);
      for (let k = 0; k < NCPG; k++) this.yAvg[k] += y[k] / 48;
      for (let m = 0; m < 8; m++) this.mAvg[m] += mr[m] / 48;
      if ((this.frame * 8 + s) % 10 === 0) br.slow(0.02, stage, this.lesion.metacog ? 1 : (this.metacog?.achGain ?? 1));
    }
    this.wm.lesion = !!this.lesion.wm;

    for (let c = 0; c < CH.N; c++) B.u[c] = clamp((this.muscleGain ?? 2.4) * (this.mnAct[2 * c] - this.mnAct[2 * c + 1]), -1, 1);
    B.limbs.forEach((L, k) => {
      const sw = L.kind === 'leg' ? CH.leg + L.idx * 2 : CH.arm + L.idx * 3;
      this.limbUse[k] += Math.abs(B.u[sw]) + Math.abs(B.u[sw + 1]) + 0.5 * Math.abs(B.u[L.grip]);
    });
    this.limbUseN++;
    B.scaleLift = this.lesion.scales ? 0 : this.liftK;
    B.step(1 / 120);
    B.step(1 / 120);

    const com = B.com();
    this.vel = [com[0] - this.lastCom[0], com[1] - this.lastCom[1], com[2] - this.lastCom[2]];
    this.navStep(dt, com);
    this.stats.dist += Math.hypot(this.vel[0], this.vel[2]);
    this.lastCom = com;
    this.nociception *= 0.97;
    if (this.race) this.raceCheck(dt);
    this.interact();
    if (this.frame % 6 === 0) this.tenHz();
    if (this.frame % 4 === 0) this.skin.step(this);
    if (this.frame % 15 === 0) this.minute();
    this.updateNM(dt);
  }

  navStep(dt, com) {
    const F3 = this.body.F[3], N = this.nav;
    const h = Math.atan2(F3.f[2], F3.f[0]);
    let w = h - this.prevHdg;
    w = Math.atan2(Math.sin(w), Math.cos(w));
    this.prevHdg = h;
    const omega = (w / dt) * (1 + 0.05 * gauss(this.gr));
    const az = this.light > 0.35 ? Math.atan2(Math.sin(SUN_AZ - h), Math.cos(SUN_AZ - h)) : null;
    N.step(dt, omega, az);
    this.omega = omega;
    this.babbleStep(dt);
    const [vx, , vz] = this.vel;
    const ch = Math.cos(h), sh = Math.sin(h);
    const vf = (vx * ch + vz * sh) / dt, vl = (-vx * sh + vz * ch) / dt;
    N.integrate(dt, vf, vl);
    if (this.frame % 6 === 0) {
      let e = N.heading() - h;
      this.navErr.hd = Math.abs(Math.atan2(Math.sin(e), Math.cos(e)));
      this.navErr.pos = Math.hypot(N.px - com[0], N.pz - com[2]);
    }
  }

  babbleStep(dt) {
    if (!this.babble) {
      this.babble = {
        on: !this.lesion.babble && !this.forceMot && !globalThis.TW?.noBabble,
        t: 0, next: 0, blockStart: 0, mot: new Float64Array(8), sc: 0, cc: 0, yaw: 0, stepIdx: 0,
      };
    }
    const b = this.babble;
    if (!b.on) return;
    b.t += dt;
    // Accumulate yaw only after the 0.40 s neuromuscular + CPG reversal transient has settled!
    if (b.t - b.blockStart >= 0.4) b.yaw += this.omega * dt;
    if (b.t >= b.next) {
      if (b.t > 1.3 && b.t - b.blockStart >= 0.75) {
        const win = b.t - b.blockStart - 0.4;
        const c = b.mot[1] - b.mot[2], y = -b.yaw / Math.max(0.2, win);
        b.sc += c * y;
        b.cc += c * c;
      }
      b.yaw = 0;
      b.blockStart = b.t;
      b.next += 1.2;
      b.mot.fill(0);
      // 1.2-s steady synergy blocks sweep left/right cleanly (calibrating true steady-state yaw gain AND scanning the 260-deg retina)
      const k = (b.stepIdx++) % 5;
      b.mot[0] = k < 4 ? 0.85 + 0.15 * this.gr() : 0.5;
      if (k === 0 || k === 2) b.mot[1] = 0.65 + 0.35 * this.gr();
      if (k === 1 || k === 3) b.mot[2] = 0.65 + 0.35 * this.gr();
    }
    if (b.t >= 12) {
      b.on = false;
      this.turnGain = b.sc / Math.max(1e-6, b.cc);
      const g0 = globalThis.TW?.turnGain0 ?? (STARTER_INFO.turnGain0 || 1.55);
      const k = clamp(g0 / Math.max(0.25, this.turnGain), 0.55, 1.75);
      this.babbleScale = k;
      for (const [m, p] of [[1, 0], [2, 1]]) { this.Wmot[m * NPHI + p] *= k; this.Wmot0[m * NPHI + p] *= k; this.WmotAnc[m * NPHI + p] *= k; }
      this.selfW = Math.max(this.selfW ?? 0.35, 0.6 * Math.max(0.2, this.turnGain));
      this.ev('babble', `motor babbling done: turn gain ${this.turnGain.toFixed(2)} rad/s, steering x${k.toFixed(2)}, landmarks seen ${this.retina.seenCount}`);
    }
  }

  updateNM(dt) {
    const br = this.brain, nm = br.nm;
    const lp = (k, v, tau) => { nm[k] += (dt / tau) * (v - nm[k]); };
    const vta = br.regionRate('VTA');
    this.vtaBase = (this.vtaBase ?? vta) + 0.002 * (vta - (this.vtaBase ?? vta));
    lp('DA', clamp(0.3 + (vta - this.vtaBase) / 20, 0, 1.2), 0.3);
    lp('NE', clamp(0.2 + br.regionRate('LC') / 50, 0, 1.2), 0.4);
    lp('5HT', clamp(0.2 + br.regionRate('RAPHE') / 45, 0, 1.2), 1.0);
    lp('ACh', clamp(0.1 + br.regionRate('BF') / 40, 0, 1.2), 0.6);
    nm.cortisol = this.metab.cortisol;
  }

  // ------------------------------------------------------------------ 10 Hz: SSM + deep WM + metacognition + thought curvature + plasticity
  tenHz() {
    const u = new Float64Array(NY + 8);
    u.set(this.y);
    for (let m = 0; m < 8; m++) u[NY + m] = this.mAvg[m];
    this.ssm.step(u);
    const z = this.z;
    this.ssm.features(z);
    for (let m = 0; m < 8; m++) z[64 + m] = this.mAvg[m];

    let wmStepSE = 0;
    if (this.frame > 12) {
      const achMod = (0.5 + this.brain.nm.ACh) * (this.lesion.metacog ? 1 : (this.metacog?.achGain ?? 1));
      wmStepSE = this.wm.learn(this.zPrev, this.y, 0.045 * achMod, this.lesion.ssmLearn ? null : this.ssm);
    }
    this.zPrev.set(z);
    for (let i = 0; i < NZ; i++) this.zMean[i] += 0.01 * (z[i] - this.zMean[i]);
    this.pc.lesionLearn = !!this.lesion.pc;
    this.pc.step(this.y, 0.6 + 0.8 * this.brain.nm.ACh);

    // Build 96-D cortical + hippocampal + SSM neural manifold state & evaluate Eshkol Taylor-jet thought curvature + metacognition
    {
      const mf = this.metaFeat;
      for (let i = 0; i < 64; i++) mf[i] = z[i] - this.zMean[i];
      const ctxSt = Math.max(1, Math.floor(RN.CTX / 16)), hipSt = Math.max(1, Math.floor(RN.HIP / 16));
      for (let i = 0; i < 16; i++) {
        mf[64 + i] = this.brain.rate[R0.CTX + Math.min(RN.CTX - 1, i * ctxSt)] / 20;
        mf[80 + i] = this.brain.rate[R0.HIP + Math.min(RN.HIP - 1, i * hipSt)] / 20;
      }
      this.metacog.step(mf, wmStepSE, this.wm.predVar, this.familiar, this.progEMA, this.lastRaceAltG, this.lastRaceBestG, !!this.lesion.metacog);
      if (this.frame % 60 === 0) this.metacog.auditAndConsolidate(this, false);
    }

    // Sleep consolidation on entering deep NREM (stage 3): Hopfield mDAE + InfoNCE, HDC cross-spectral Wiener, EWC anchor + Moonlab SVD
    if (this.sleep.stage === 0) this.consolidated = false;
    else if (this.sleep.stage === 3 && !this.consolidated) {
      this.consolidated = true;
      const L = !!this.lesion.memLearn;
      this.hop.learnKeys = !L;
      for (const H of [this.hdcFood, this.hdcWater]) H.fixed = L;
      if (!this.lesion.hopfield) this.memStats.merged = (this.memStats.merged || 0) + this.hop.sleep();
      this.hdcFood.sleep();
      this.hdcWater.sleep();
      // Consolidate motor weights via Moonlab Jacobi SVD denoising and update EWC synaptic anchors
      this.metacog.auditAndConsolidate(this, true);
      for (let i = 0; i < this.Wc.length; i++) this.WcAnc[i] = 0.6 * this.WcAnc[i] + 0.4 * this.Wc[i];
      for (let i = 0; i < this.Wm.length; i++) this.WmAnc[i] = 0.6 * this.WmAnc[i] + 0.4 * this.Wm[i];
      for (let i = 0; i < this.Wmot.length; i++) this.WmotAnc[i] = 0.6 * this.WmotAnc[i] + 0.4 * this.Wmot[i];
      this.memStats.consolidations = (this.memStats.consolidations || 0) + 1;
    }

    if (this.frame % 60 === 0 && this.sleep.stage === 0 && !this.lesion.hopfield) {
      const c = Float64Array.from(z, (v, i) => v - this.zMean[i]);
      const R = this.hop.retrieve(c);
      this.familiar = R ? clamp((R.sim - 0.4) / 0.5) : 0;
      this.memStats.famMean += 0.02 * (this.familiar - this.memStats.famMean);
      this.memStats.retrievals++;
      this.hop.store(c, { ep: this.episodes[this.episodes.length - 1], t: this.t }, this.r);
      this.memStats.stored++;
    }
    if (this.sleep.stage === 0 && (this.episodes.length < 400 ? true : this.frame % 60 === 0)) {
      const ctx = [];
      for (let i = 0; i < RN.CTX && ctx.length < 48; i++) if (this.brain.rate[R0.CTX + i] > 15) ctx.push(i);
      const ep = { z: Float64Array.from(z), y: Float64Array.from(this.y), ssm: [Float64Array.from(this.ssm.re), Float64Array.from(this.ssm.im)], ctx, vf: this.vf };
      this.episodes.push(ep);
      if (this.episodes.length > 400) this.episodes.splice(Math.floor(this.r() * 400), 1);
    }

    // 3-factor motor learning reward + EWC synaptic protection
    const tg = this.target();
    let R = 0;
    if (tg && this.sleep.stage === 0 && !this.drinking) {
      const d = this.dist;
      if (this.lastDist !== null) {
        R = (this.lastDist - d) * 10 * 0.5;
        if (Math.abs(this.bear) < 0.6) this.selfV += 0.01 * (clamp((this.lastDist - d) * 10, 0.02, 2.5) - this.selfV);
      }
      this.lastDist = d;
    } else this.lastDist = null;

    {
      const F = this.body.F[3].f, h = Math.atan2(F[2], F[0]);
      if (this.lastYaw !== undefined) {
        let dh = h - this.lastYaw;
        if (dh > Math.PI) dh -= 2 * Math.PI;
        if (dh < -Math.PI) dh += 2 * Math.PI;
        if (tg && Math.abs(this.bear) > 0.6) this.selfW += 0.01 * (Math.abs(dh) * 10 - this.selfW);
      }
      this.lastYaw = h;
    }

    this.progEMA += 0.05 * ((tg && !this.drinking ? R : 0.3) - this.progEMA);
    R -= 0.0015 * this.body.energy;
    R -= 0.35 * clamp(0.55 - this.body.F[3].u[1]);
    this.stuck = clamp((0.02 - this.progEMA) * 4) * (tg && this.goal && !this.drinking && this.t - this.goal.since > 6 ? 1 : 0);
    const delta = R - this.rBar;
    this.rBar += 0.05 * delta;
    this.motorDelta = delta;
    if (tg && this.sleep.stage === 0 && !this.lesion.learnMotor && !this.drinking) this.motorLearn(delta);

    // Homeostatic intrinsic biases on postural MOT[3..7] (and optional MN pool if enabled via TW.mnHomeo)
    if (!this.lesion.homeo) {
      if (this.homeo) {
        for (let n = 0; n < NMN; n++) {
          this.mnAvg[n] += 0.1 * (this.mnAct[n] - this.mnAvg[n]);
          this.mnHomeo[n] = clamp(this.mnHomeo[n] + 0.04 * ((globalThis.TW?.hs ?? 0.12) - this.mnAvg[n]), -2, globalThis.TW?.hmax ?? 0.6);
        }
      } else this.mnHomeo.fill(0);
      // Keep postural/episodic MOT[3..7] from drifting into tonic hyperactivity
      for (let m = 3; m < 8; m++) {
        const mr = this.brain.rate[R0.MOT + m];
        if (mr > 12) this.motBias[m] = clamp(this.motBias[m] - 0.008 * (mr - 12), -0.8, 0.3);
        else this.motBias[m] *= 0.995;
      }
    } else {
      this.mnHomeo.fill(0);
      this.motBias.fill(0);
    }

    const temp = this.lesion.metacog ? 1 : Math.min(1.25, this.metacog?.exploreTemp ?? 1);
    const sigma = 0.18 * temp * (0.75 + 0.55 * this.brain.nm.NE) * (this.sleep.stage === 0 ? 1 : 0.3);
    for (let n = 0; n < NMN; n++) this.xi[n] = 0.7 * this.xi[n] + 0.7 * sigma * this.drawGauss();
    this.yAvg.fill(0);
    this.mAvg.fill(0);

    // Behavioural repertoire entropy (raw & bias-corrected)
    const Bu = this.body.u;
    const avg = (a, b, st = 1) => { let s = 0, n = 0; for (let i = a; i < b; i += st) { s += Bu[i]; n++; } return s / n; };
    const bits = [
      avg(CH.long + 13, CH.long + 24, 2) > 0.05, avg(CH.long + 1, CH.long + 12, 2) > 0.05,
      avg(CH.long, CH.long + 24, 4) > 0.05, avg(CH.radial, CH.radial + 7) > 0.05,
      avg(CH.legGrip, CH.legGrip + 4) > 0, avg(CH.arm + 2, CH.arm + 6, 3) > 0.05, this.vf > 0.25,
    ];
    const code = bits.reduce((a, b, i) => a | ((b ? 1 : 0) << i), 0);
    this.motorHist.push(code);
    if (this.motorHist.length > 600) this.motorHist.shift();
    {
      const an = [avg(CH.long + 13, CH.long + 24, 2), avg(CH.long + 1, CH.long + 12, 2), avg(CH.long, CH.long + 24, 4), avg(CH.radial, CH.radial + 7), avg(CH.legGrip, CH.legGrip + 4), avg(CH.arm + 2, CH.arm + 6, 3), this.vf];
      this.anMean = this.anMean || an.slice();
      let c2 = 0;
      for (let i = 0; i < 7; i++) { this.anMean[i] += 0.003 * (an[i] - this.anMean[i]); if (an[i] > this.anMean[i] + 0.01) c2 |= 1 << i; }
      (this.motorHist2 = this.motorHist2 || []).push(c2);
      if (this.motorHist2.length > 600) this.motorHist2.shift();
      if (this.frame % 60 === 0) {
        const c = new Map(); for (const x of this.motorHist2) c.set(x, (c.get(x) || 0) + 1);
        let H = 0; for (const v of c.values()) { const p = v / this.motorHist2.length; H -= p * Math.log2(p); }
        this.entropy2 = H;
      }
    }
    if (this.frame % 60 === 0) {
      const c = new Map(); for (const x of this.motorHist) c.set(x, (c.get(x) || 0) + 1);
      let H = 0; for (const v of c.values()) { const p = v / this.motorHist.length; H -= p * Math.log2(p); }
      this.entropy = H; this.states = c.size;
    }
  }

  motorLearn(delta) {
    const achMod = (0.5 + this.brain.nm.ACh) * (this.lesion.metacog ? 1 : (this.metacog?.achGain ?? 1));
    // Asymmetric 3-factor RPE: reinforce positive progress strongly, damp negative RPE on steep slopes so CPG coordination isn't erased
    const effDelta = delta >= 0 ? clamp(delta, 0, 1) : 0.25 * clamp(delta, -1, 0);
    const lr = 0.0022 * achMod * effDelta;
    const decay = 0.85, ewcK = 0.022;
    const posR = delta > 0.05;
    let ewcE = 0;

    for (let n = 0; n < NMN; n++) {
      const x = this.xi[n];
      const oc = n * NCPG;
      for (let k = 0; k < NCPG; k++) {
        const idx = oc + k;
        this.Ec[idx] = decay * this.Ec[idx] + x * this.yAvg[k];
        if (posR) this.fishWc[idx] = 0.995 * this.fishWc[idx] + 0.005 * Math.min(4, this.Ec[idx] * this.Ec[idx]);
        const fEff = 0.12 + this.fishWc[idx];
        const ewcPull = ewcK * fEff * (this.Wc[idx] - this.WcAnc[idx]);
        ewcE += fEff * (this.Wc[idx] - this.WcAnc[idx]) ** 2;
        this.Wc[idx] = clamp(this.Wc[idx] + lr * this.Ec[idx] - ewcPull, this.Wc0[idx] - 0.5, this.Wc0[idx] + 0.5);
      }
      const om = n * 8;
      for (let m = 0; m < 8; m++) {
        const idx = om + m;
        this.Em[idx] = decay * this.Em[idx] + x * this.mAvg[m];
        if (posR) this.fishWm[idx] = 0.995 * this.fishWm[idx] + 0.005 * Math.min(4, this.Em[idx] * this.Em[idx]);
        const fEff = 0.12 + this.fishWm[idx];
        const ewcPull = ewcK * fEff * (this.Wm[idx] - this.WmAnc[idx]);
        this.Wm[idx] = clamp(this.Wm[idx] + lr * this.Em[idx] - ewcPull, this.Wm0[idx] - 0.5, this.Wm0[idx] + 0.5);
      }
      const op = n * NPHI;
      for (let p = 0; p < NPHI; p++) {
        const idx = op + p;
        this.Ep[idx] = decay * this.Ep[idx] + x * this.phi[p];
        this.Wp[idx] = clamp(this.Wp[idx] + 0.5 * lr * this.Ep[idx], this.Wp0[idx] - 0.5, this.Wp0[idx] + 0.5);
      }
    }
    for (let m = 0; m < 8; m++) {
      const post = this.mAvg[m] - (m < 3 ? 0.3 : 0.08);
      for (let p = 0; p < NPHI; p++) {
        const idx = m * NPHI + p;
        this.Emot[idx] = decay * this.Emot[idx] + post * this.phi[p];
        if (posR) this.fishWmot[idx] = 0.995 * this.fishWmot[idx] + 0.005 * Math.min(4, this.Emot[idx] * this.Emot[idx]);
        const fEff = 0.1 + this.fishWmot[idx];
        const ewcPull = ewcK * fEff * (this.Wmot[idx] - this.WmotAnc[idx]);
        this.Wmot[idx] = clamp(this.Wmot[idx] + 0.3 * lr * this.Emot[idx] - ewcPull, this.Wmot0[idx] - 0.8, this.Wmot0[idx] + 0.8);
      }
    }
    this.ewcEnergy = 0.5 * ewcE;
  }

  // ------------------------------------------------------------------ physical interaction: drinking, eating, stings, snacks
  interact() {
    const hd = this.body.head(), W = this.world, g = this.goal;

    // Drinking: head or snout within water pool radius while awake, thirsty, and thirst reflex intact
    let inPool = null;
    for (const P of W.pools) if (Math.hypot(P.x - hd[0], P.z - hd[2]) < P.r + 0.35) inPool = P;
    if (inPool && this.sleep.stage === 0 && !this.lesion.thirst && this.metab.thirst > 0.04) {
      this.metab.drink(0.045);
      this.stats.drinks = (this.stats.drinks || 0) + 0.045;
      if (!this.drinking) {
        this.ev('drink', 'drinking from pool');
        this.hdcWater.learn(inPool.x, inPool.z, 1);
        this.outcome(null, 0.85);
      }
      this.drinking = 1;
      // Pause give-up timer while actively drinking!
      this.goalBestT = this.t;
    } else {
      this.drinking = 0;
    }
    if (g && g.type === 'water' && this.metab.thirst < 0.07) {
      this.ev('sated', 'thirst sated');
      this.goal = null;
    }

    for (let i = W.snacks.length - 1; i >= 0; i--) {
      const s = W.snacks[i];
      if (Math.hypot(s.x - hd[0], s.y - hd[1], s.z - hd[2]) < 0.95 && this.sleep.stage === 0) {
        W.snacks.splice(i, 1);
        this.metab.eat(s.kind, 1.2);
        this.hdcFood.learn(s.x, s.z, 0.65);
        this.outcome(null, 1);
        this.stats.snacks++;
        this.ev('eat', `ate dropped ${s.kind}`);
        if (g && g.type === 'snack') this.goal = null;
      }
    }

    if (g && g.type === 'site') {
      const P = W.plants[g.k];
      if (Math.hypot(P.x - hd[0], P.z - hd[2]) < (globalThis.TW?.eatR ?? 1.3)) {
        this.stats.tries++;
        let r = 0;
        if (P.fruit > 0.3 && this.r() < P.p * (0.6 + 0.4 * P.fruit) * 2.2) {
          r = 1;
          this.metab.eat('plant', 1);
          this.stats.eats++;
        }
        P.fruit = Math.max(0, P.fruit - 0.7);
        if (P.s === 3 && this.r() < 0.35) {
          this.nociception = 1;
          this.stats.stings++;
          this.wAv[g.k] += 0.3 * (1 - this.wAv[g.k]);
          this.ev('sting', `thorn plant ${g.k} stung (aversive value now ${this.wAv[g.k].toFixed(2)})`);
        } else this.wAv[g.k] *= 0.95;
        this.recent[g.k] = 1;
        // Write outcome at hippocampal perceived position
        const mp = this.retina.sitePos(g.k, W);
        this.hdcFood.learn(mp.x, mp.z, r - 0.35);
        this.outcome(g.chosen ?? g.k, r);
        this.ev(r ? 'reward' : 'miss', `site ${g.k}: ${r ? 'fed' : 'nothing'} (true p ${P.p.toFixed(2)})`);
        this.goal = null;
      }
    }

    if (g && !this.drinking) {
      if (g !== this.goalRef) { this.goalRef = g; this.goalBest = 1e9; this.goalBestT = this.t; }
      if (this.lastDist !== null && this.dist < this.goalBest - 0.5) { this.goalBest = this.dist; this.goalBestT = this.t; }
      const lim = Math.max(45, 3 * ((this.goalBest < 1e8 ? this.goalBest : 10) / Math.max(0.08, this.selfV)));
      if (this.t - this.goalBestT > 22 || this.t - g.since > lim) {
        this.ev('give-up', `gave up on goal (${(this.t - g.since).toFixed(0)} s, no progress for ${(this.t - this.goalBestT).toFixed(0)} s)`);
        if (g.type === 'site') this.wSite[g.chosen ?? g.k] *= 0.9;
        this.goal = null;
      }
    }
  }

  outcome(k, r) {
    let q = 0.7;
    if (k !== null && k !== undefined) {
      q = 0.5 * this.wSite[k] + (0.5 * this.bA[k]) / (this.bA[k] + this.bB[k]);
      this.wSite[k] += 0.25 * (r - this.wSite[k]);
      if (r) this.bA[k] += 1; else this.bB[k] += 1;
      this.visits[k]++;
      const P = this.world.plants[k];
      this.featC[P.c] += 0.1 * (r - this.featC[P.c]);
      this.featS[P.s] += 0.1 * (r - this.featS[P.s]);
    }
    this.rpe = r - q;
    this.stats.rewards += r;
    this.rpe *= 0.85;
  }

  // ------------------------------------------------------------------ one simulated minute: metabolism, sleep, unified striatal race, growth
  minute() {
    for (let k = 0; k < SITES; k++) this.recent[k] *= 0.996;
    this.tick++;
    this.hour = (8 + (this.tick * 24) / this.dayLen) % 24;
    const M = this.metab, br = this.brain;
    this.rpe *= 0.3;

    const evs = M.tick({ hour: this.hour, ens: clamp(br.regionRate('ENS') / 30), motorCost: this.body.energy, spikes: br.spikes * 240, stress: clamp(this.nociception + 0.5 * this.wm.surprise) });
    for (const e of evs) {
      const c = this.body.c[0];
      this.world.waste.push({ x: this.body.x[c], y: this.body.y[c], z: this.body.z[c], type: e.type, age: 0, amount: e.amount });
      this.stats[e.type]++;
      this.ev('waste', e.type === 'urine' ? 'urinated (bladder emptied)' : 'defecated (colon emptied)');
    }

    // Cephalic-phase insulin from seeing/smelling nearby fruiting plant or dropped snack
    {
      const hd = this.body.head();
      let see = 0;
      for (let k = 0; k < this.world.plants.length; k++) {
        const P = this.world.plants[k];
        if (P.fruit > 0.3 && Math.hypot(P.x - hd[0], P.z - hd[2]) < 3.2 && (this.lesion.vision || this.retina.vis[k] > 0)) see = 1;
      }
      for (const s of this.world.snacks) if (Math.hypot(s.x - hd[0], s.z - hd[2]) < 3.2) see = 1;
      this.cephalic += 0.2 * (see - this.cephalic);
      M.cephalic = this.lesion.cephalic ? 0 : this.cephalic;
    }

    const prev = this.sleep.stage;
    const stage = this.sleep.tick(this.hour, clamp(this.speedEMA), br.nm.NE, clamp(1 - this.light), clamp(br.spikes / 60));
    if (stage !== prev) {
      this.ev('sleep', `stage ${['WAKE', 'N1', 'N2', 'N3', 'REM'][prev]} -> ${['WAKE', 'N1', 'N2', 'N3', 'REM'][stage]}`);
      if (stage) { this.goal = null; this.race = null; }
    }
    if (stage === 2 || stage === 3) this.replay();
    if (stage === 4 && !this.lesion.dream) this.dream();

    // Hypothalamic osmoreceptor / snack re-deliberation trigger -> enters the unified 21-channel striatal race!
    if (stage === 0 && !this.babble?.on) {
      const hd = this.body.head();
      const hasCloseSnack = this.world.snacks.some((s) => Math.hypot(s.x - hd[0], s.z - hd[2]) < 14);
      if (hasCloseSnack && this.goal && this.goal.type !== 'snack' && !this.race && this.draw01() < 0.25) {
        this.goal = null;
        this.startRace();
      } else if (!this.lesion.thirst && M.thirst > 0.34 && this.goal && this.goal.type !== 'water' && !this.race && this.draw01() < 0.06 * M.thirst) {
        this.ev('thirst', `osmotic thirst (${M.thirst.toFixed(2)}) triggers striatal re-deliberation`);
        this.goal = null;
        this.startRace();
      }
      if (!this.goal && !this.race) this.startRace();
    }

    if (this.goal && this.goal.type === 'water' && !this.drinking) {
      const hd = this.body.head();
      if (Math.hypot(this.goal.x - hd[0], this.goal.z - hd[2]) < 1.0) {
        this.hdcWater.learn(this.goal.x, this.goal.z, -0.35);
        this.ev('miss', 'no water where remembered');
        this.goal = null;
      }
    }
    if (this.goal && this.goal.type === 'explore') {
      const hd = this.body.head();
      if (Math.hypot(this.goal.x - hd[0], this.goal.z - hd[2]) < 1.6) this.goal = null;
    }

    // Continuous FHRRphasor visit density update (no 24x24 discrete grid!)
    if (this.tick % 4 === 0 && !this.lesion.nav) {
      this.hdcVisit.add(this.nav.px, this.nav.pz, 0.25);
      this.hdcVisit.decay(0.9997);
    }

    // Morphological & use-dependent limb growth
    const target = 1 + clamp(M.tissue * 0.4, 0, 0.35);
    this.body.scale += 0.01 * (target - this.body.scale);
    if (!this.lesion.growth) {
      const B = this.body;
      for (let i = 0; i < NS; i++) B.girth[i] += 0.004 * (0.85 + 0.35 * M.leptin - B.girth[i]);
      B.limbs.forEach((L, k) => {
        const use = clamp(this.limbUse[k] / Math.max(1, this.limbUseN) / 2.2);
        this.limbUseEMA[k] += 0.02 * (use - this.limbUseEMA[k]);
        const grow = 0.00025 * this.limbUseEMA[k] * (0.4 + clamp(M.muscle / 150)) - 0.0006 * (B.limbLen[k] - 1);
        B.limbLen[k] = clamp(B.limbLen[k] + grow, 0.85, 1.45);
      });
      this.limbUse.fill(0);
      this.limbUseN = 0;
    }
    this.flawTick();
  }

  flawTick() {
    const F = this.flaws, br = this.brain, t = this.tick;
    if (F.scramble.on && t % Math.max(1, Math.round(F.scramble.period)) === 0) this.rewire();
    if (F.leaky.on) {
      const L = F.leaky.rate;
      for (let k = 0; k < SITES; k++) this.wSite[k] += L * (0.25 - this.wSite[k]);
      for (let s = 0; s < br.S; s++) if (br.plastic[s]) br.w[s] += L * 0.05 * (br.w0[s] - br.w[s]);
      for (let i = 0; i < this.Wc.length; i++) this.Wc[i] += L * 0.05 * (this.Wc0[i] - this.Wc[i]);
      for (let i = 0; i < this.Wmot.length; i++) this.Wmot[i] += L * 0.05 * (this.Wmot0[i] - this.Wmot[i]);
    }
    if (F.misfire.on && t % Math.max(1, Math.round(F.misfire.period)) === 0) {
      const k = Math.floor(this.gr() * SITES);
      this.wSite[k] = clamp(this.wSite[k] + F.misfire.sd * gauss(this.gr));
      for (let j = 0; j < F.misfire.jolts; j++) {
        br.jolt[Math.floor(this.gr() * br.N)] += 4;
        const s = Math.floor(this.gr() * br.S);
        br.w[s] += F.misfire.sd * gauss(this.gr) * (Math.abs(br.w[s]) + 0.1);
      }
      this.stats.misfires++;
      this.ev('misfire', `misfire: ${F.misfire.jolts} neurons jolted, synapses + site ${k} value perturbed`);
    }
  }

  replay() {
    const E = this.episodes;
    if (!E.length) return;
    for (let j = 0; j < 4; j++) {
      const e = E[Math.floor(this.r() * E.length)];
      this.wm.learn(e.z, e.y, 0.02);
      for (const i of e.ctx) this.brain.jolt[R0.CTX + i] += 1.5;
      for (let i = 0; i < 4; i++) this.brain.jolt[R0.HIP + Math.floor(this.r() * RN.HIP)] += 1.2;
      this.stats.replays++;
    }
  }

  dream() {
    for (let k = 0; k < SITES; k++) {
      if (this.visits[k] === 0) {
        const P = this.world.plants[k];
        const vh = clamp(this.featC[P.c] + this.featS[P.s]);
        this.bA[k] += 0.75 * (1 + 6 * vh - this.bA[k]);
        this.bB[k] += 0.75 * (1 + 6 * (1 - vh) - this.bB[k]);
      }
    }
    const E = this.episodes;
    if (E.length < 10 || this.wm.lesion) return;
    let e = E[Math.floor(this.r() * E.length)];
    if (!this.lesion.hopfield && this.hop.X.length > 8) {
      const cue = Float64Array.from(this.zPrev, (v, i) => (this.r() < 0.5 ? 0 : v - this.zMean[i]) + 0.1 * gauss(this.r));
      const R = this.hop.retrieve(cue);
      const m = this.hop.meta[R.top];
      if (m && m.ep) { e = m.ep; this.memStats.dreamSim = R.sim; }
    }
    const ssm = this.ssm.clone();
    const log = [];
    for (let m = 0; m < 8; m++) {
      ssm.re.set(e.ssm[0]);
      ssm.im.set(e.ssm[1]);
      const z = Float64Array.from(e.z), y = new Float64Array(NY), u = new Float64Array(NY + 8);
      let prog = 0;
      for (let s = 0; s < 8; s++) {
        for (let q = 0; q < 8; q++) z[64 + q] = q === m ? 0.9 : 0.15;
        this.wm.predict(z, y);
        prog += y[12];
        u.set(y);
        for (let q = 0; q < 8; q++) u[NY + q] = z[64 + q];
        ssm.step(u);
        ssm.features(z);
      }
      this.Vimg[m] += 0.2 * (prog / 8 - this.Vimg[m]);
      log.push(prog / 8);
    }
    this.dreamLog = log;
    this.stats.dreams++;
    for (let i = 0; i < 6; i++) this.brain.jolt[R0.CTX + Math.floor(this.r() * Math.min(64, RN.CTX))] += 2;
  }

  poke(i, dir) {
    const B = this.body;
    B.poke(i, dir[0] * 0.25, dir[1] * 0.25, dir[2] * 0.25);
    this.nociception = 1;
    this.sleep.forceWake = 20;
    this.ev('poke', 'poked: nociceptors -> LC burst, cortisol');
  }
}
