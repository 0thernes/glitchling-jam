// Open-Ended Multi-Agent & Multi-Species A-Life Biosphere (pass 19):
//  - Up to 48 Autonomous Conspecific Glitchlings (`peers`) with heritable 128-gene Zygote-Cleavage + Hox + Morphogen Evo-Devo
//    genomes radiating across 5 macro-evolutionary bauplan clades (`0L Serpent`, `4L Tetrapod`, `6L Hexapod`, `8L Octopod`,
//    `10L Decapod`), aerodynamic Patagium gliding wing-membranes, cranial bioluminescent Angler-Lures (`esca`), and assortative
//    sympatric speciation (`speciationIso` + `speciesCount` clade-diversity tracking).
//  - Diploid Sexual Reproduction via Simulated Binary Crossover (SBX) + Polynomial Mutation across all 128 genes, producing
//    physical 3D Bioluminescent Eggs (`eggs`) whose incubation speed depends on microclimate/vent warmth, hatching into
//    neonates (`egg -> neonate -> juvenile -> adult -> elder`) and recording a live multi-generational `lineageTree`.
//  - Mutualistic/Prey Photonic Bio-Mites (`mites`) + 256 Embodied 3D Micro-Fauna coupled to > 5.2M Microbial Continuum.
//  - Shadow-Leviathan Apex Predators (`predators`) that patrol the biosphere perimeter, testing alarm calls, Schreckstoff
//    pheromone cascades, crystal-spire sheltering, chromatophore camouflage, patagium escape glides, and defensive curling.
import { mulberry, clamp, gauss } from './util.js';
import { FULL_GENES, evalHoxGRN, developZygoteEmbryo } from './genome.js';
import { STARTER } from './starter_genome.js';
import { WORLD, SITES } from './world.js';
import { encodeAcousticCallRS, decodeAcousticCallRS } from './heptarch.js';
import { poincareDist, poincareExpMap } from '../tsotchke/qgtl.js';

export const LIFE_STAGES = ['neonate', 'juvenile', 'adult', 'elder'];
export const COLONY_CASTES = ['Sovereign α', 'Harvester β', 'Sentinel γ', 'Weaver δ', 'Disruptor ε'];

/**
 * Exact 4x4 Two-Qubit Density Matrix CHSH Non-Local Game Trial via Sequential Lüders Measurement (ZERO superluminal signaling!).
 * Basis {|00>, |01>, |10>, |11>}. Alice measures A_0 = Z (x=0) or A_1 = X (x=1);
 * Bob measures B_0 = (Z+X)/sqrt(2) (y=0) or B_1 = (Z-X)/sqrt(2) (y=1).
 * Winning condition: (a ^ b) === (x & y). Classical Bell LHV ceiling = 0.75; Tsirelson |Phi+> bound = cos^2(pi/8) = 0.853553.
 */
export function runCHSHDensityMatrixTrial(rho4x4, x, y, uA, uB, classicalLHV = false) {
  if (classicalLHV) {
    // Optimal Bell-local hidden variable deterministic/convex strategy (shared pre-established lambda in {0,1,2,3})
    const lam = Math.floor(uA * 4) & 3;
    const a = lam === 0 ? 0 : lam === 1 ? 1 : lam === 2 ? x : (1 - x);
    const b = lam === 0 ? 0 : lam === 1 ? 1 : lam === 2 ? 0 : y;
    return { a, b, win: (a ^ b) === (x & y), pA0: 0.5 };
  }
  // 1) Alice local projector Pi_{a=0|x} on qubit A:
  //    x=0 (Z): |0><0|;  x=1 (X): |+><+| = 0.5 * [[1,1],[1,1]]
  //    Compute Alice's local marginal P_A(a=0 | x) = Tr(rho * (Pi_{0|x} otimes I_2)) — strictly independent of Bob's y!
  let pA0 = 0;
  // Post-measurement unnormalized 2x2 state on Bob for a=0 and a=1
  let b0_00 = 0, b0_01 = 0, b0_11 = 0;
  let b1_00 = 0, b1_01 = 0, b1_11 = 0;
  if (x === 0) {
    b0_00 = rho4x4[0]; b0_01 = rho4x4[1]; b0_11 = rho4x4[5];
    b1_00 = rho4x4[10]; b1_01 = rho4x4[11]; b1_11 = rho4x4[15];
  } else {
    // <+| rho_AB |+> = 0.5 * (rho_{0b,0b'} + rho_{0b,1b'} + rho_{1b,0b'} + rho_{1b,1b'})
    b0_00 = 0.5 * (rho4x4[0] + rho4x4[2] + rho4x4[8] + rho4x4[10]);
    b0_01 = 0.5 * (rho4x4[1] + rho4x4[3] + rho4x4[9] + rho4x4[11]);
    b0_11 = 0.5 * (rho4x4[5] + rho4x4[7] + rho4x4[13] + rho4x4[15]);
    b1_00 = 0.5 * (rho4x4[0] - rho4x4[2] - rho4x4[8] + rho4x4[10]);
    b1_01 = 0.5 * (rho4x4[1] - rho4x4[3] - rho4x4[9] + rho4x4[11]);
    b1_11 = 0.5 * (rho4x4[5] - rho4x4[7] - rho4x4[13] + rho4x4[15]);
  }
  pA0 = clamp(b0_00 + b0_11, 0, 1);
  const a = uA < pA0 ? 0 : 1;
  const norm = a === 0 ? Math.max(1e-12, b0_00 + b0_11) : Math.max(1e-12, b1_00 + b1_11);
  const rB00 = (a === 0 ? b0_00 : b1_00) / norm;
  const rB01 = (a === 0 ? b0_01 : b1_01) / norm;
  const rB11 = (a === 0 ? b0_11 : b1_11) / norm;

  // 2) Bob local measurement B_y = (Z + s_y X)/sqrt(2) where s_y = (y===0 ? +1 : -1)
  //    Expectation <B_y> = ( (rB00 - rB11) + s_y * 2 * rB01 ) / sqrt(2), so P(b=0 | x,a,y) = 0.5 * (1 + <B_y>)
  const sy = y === 0 ? 1 : -1;
  const expBy = ((rB00 - rB11) + sy * 2 * rB01) * Math.SQRT1_2;
  const pB0 = clamp(0.5 * (1 + expBy), 0, 1);
  const b = uB < pB0 ? 0 : 1;
  return { a, b, win: (a ^ b) === (x & y), pA0 };
}

/** Exact Wootters concurrence & Horodecki CHSH S_max directly from 4x4 real symmetric Bell-diagonal/Werner density matrix */
export function evalTwoQubitBellMetrics(rho4x4) {
  const coh = Math.abs(rho4x4[3]);
  const conc = Math.max(0, 2 * coh - 2 * Math.sqrt(Math.max(0, rho4x4[5] * rho4x4[10])));
  const txx = 2 * (rho4x4[3] + rho4x4[6]);
  const tzz = rho4x4[0] + rho4x4[15] - rho4x4[5] - rho4x4[10];
  const chshS = 2 * Math.sqrt(tzz * tzz + txx * txx);
  // Exact reduced marginal bias ||rho_A - I/2||_1
  const rhoA00 = rho4x4[0] + rho4x4[5];
  const rhoA01 = rho4x4[2] + rho4x4[7];
  const marginalBias = Math.hypot(rhoA00 - 0.5, rhoA01);
  return { concurrence: clamp(conc, 0, 1), chshS, marginalBias };
}

function getAlleleClasses(g) {
  // Exact 8 equal-measure octile bins (uniform neutral share = 1/8 = 0.125) across each locus's [lo, hi] range in genome.js:
  // pigmentHue in [0.0, 1.0], thermOpt in [0.25, 0.75], osteoderm in [0.05, 1.25]
  const uHue = clamp(g.pigmentHue ?? 0.5, 0, 0.9999);
  const uTherm = clamp(((g.thermOpt ?? 0.5) - 0.25) / 0.50, 0, 0.9999);
  const uArmor = clamp(((g.osteoderm ?? 0.45) - 0.05) / 1.20, 0, 0.9999);
  return [`hue:${Math.floor(uHue * 8)}`, `therm:${Math.floor(uTherm * 8)}`, `armor:${Math.floor(uArmor * 8)}`];
}

/** Normalized genetic distance across key bauplan & pigment loci + assortative speciation gate */
export function canAssortativeMate(genA, genB, hoxA, hoxB) {
  const iso = 0.5 * ((genA.speciationIso ?? 0.35) + (genB.speciationIso ?? 0.35));
  if (hoxA && hoxB && hoxA.limbPairs !== hoxB.limbPairs) {
    const pairDiff = Math.abs(hoxA.limbPairs - hoxB.limbPairs);
    // Strong assortative reproductive isolation blocks cross-clade mating when speciationIso is high
    if (iso > 0.72 || (pairDiff >= 3 && iso > 0.56)) return false;
  }
  const dHue = Math.min(Math.abs((genA.pigmentHue ?? 0.5) - (genB.pigmentHue ?? 0.5)), 1 - Math.abs((genA.pigmentHue ?? 0.5) - (genB.pigmentHue ?? 0.5)));
  const dBody = Math.abs((genA.bodyLen ?? 1.0) - (genB.bodyLen ?? 1.0));
  const dTherm = 0.5 * Math.abs((genA.thermOpt ?? 0.0) - (genB.thermOpt ?? 0.0));
  const genDist = 0.40 * dHue + 0.25 * dBody + 0.35 * dTherm;
  return genDist <= (0.92 - 0.45 * iso);
}

/**
 * Mendelian Diploid 128-Locus Recombination + Doubly-Stochastic Reflecting Mutation:
 * Preserves exact Hardy-Weinberg standing genetic variance and uniform stationary measure under neutral panmixia
 * (used identically by both `layEgg` and the Bedau-Packard `_neutralShadowBirth` model!).
 */
export function crossoverGenomes(genA, genB, r, mutRate = 0.14) {
  const child = {};
  for (let i = 0; i < FULL_GENES.length; i++) {
    const [nm, lo, hi] = FULL_GENES[i];
    const span = hi - lo;
    const ua = clamp(((genA[nm] ?? STARTER[nm] ?? (lo + hi) * 0.5) - lo) / span, 0.02, 0.98);
    const ub = clamp(((genB[nm] ?? STARTER[nm] ?? (lo + hi) * 0.5) - lo) / span, 0.02, 0.98);
    // Independent 50/50 Mendelian allelic segregation across all 128 developmental, Zygote & Hox GRN loci
    let u = r() < 0.5 ? ua : ub;
    if (r() < mutRate) {
      // Symmetric uniform step with specular reflection on [0.02, 0.98] -> exact uniform stationary measure!
      u += (r() - 0.5) * 0.28;
      if (u < 0.02) u = 0.04 - u;
      if (u > 0.98) u = 1.96 - u;
    }
    u = clamp(u, 0.02, 0.98);
    child[nm] = +(lo + u * span).toFixed(4);
  }
  return child;
}

export function mutateStarterGenome(r, spread = 0.16) {
  const g = {};
  for (let i = 0; i < FULL_GENES.length; i++) {
    const [nm, lo, hi] = FULL_GENES[i];
    const base = STARTER[nm] ?? (lo + hi) * 0.5;
    const r0 = r();
    let u = (base - lo) / (hi - lo) + spread * (r0 - 0.5);
    // Give wild conspecifics rich 5-clade macro-evolutionary, thermal, patagium, angler-lure & pigment diversity right from generation 0
    if (nm === 'pigmentHue') u = 0.02 + 0.96 * r();
    else if (nm === 'thermOpt') u = 0.02 + 0.96 * r0;
    else if (nm === 'crestFin' || nm === 'tailFluke') u = clamp(0.15 + 0.75 * r(), 0.05, 0.95);
    else if (nm === 'bodyLen' || nm === 'bodyGirth' || nm === 'foreLimb' || nm === 'hindLimb') u = clamp(0.5 + 0.55 * (r() - 0.5), 0.1, 0.9);
    else if (nm === 'limbTopo' || nm === 'cladeGene') u = clamp(0.04 + 0.92 * r(), 0.03, 0.97); // wild 0L/4L/6L/8L/10L 5-clade radiation!
    else if (nm === 'patagiumGene' || nm === 'anglerLure') u = clamp(0.08 + 0.84 * r(), 0.04, 0.96);
    else if (nm === 'speciationIso') u = clamp(0.18 + 0.62 * r(), 0.10, 0.90);
    else if (nm === 'osteoderm') u = 0.02 + 0.96 * r();
    else if (nm === 'gillFronds') u = clamp(0.15 + 0.75 * r(), 0.05, 0.95);
    g[nm] = +(lo + clamp(u, 0.02, 0.98) * (hi - lo)).toFixed(4);
  }
  return g;
}

export class Ecosystem {
  constructor(world, seed = 1, opts = {}) {
    this.world = world;
    this.seed = seed;
    this.r = mulberry(seed * 7919 + 37);
    this.t = 0;
    this.nextId = 1;

    this.maxPeers = opts.maxPeers ?? 48;
    const initPeers = opts.peers ?? 12;
    const initMites = opts.mites ?? 40;
    const initPreds = opts.predators ?? 1;

    this.peers = [];
    this.eggs = [];
    this.mites = [];
    this.predators = [];
    this.xenomimics = [];
    this.xylos = [];
    this.titans = [];
    this.shoggoths = [];
    this.acousticPackets = [];
    this.refugeImmunityEnabled = opts.refugeImmunityEnabled ?? true; // causal switch for V4 4-arm sanctuary audit
    this.eccEnabled = opts.eccEnabled ?? true;                       // causal switch for T9 RS[15,11] burst-noise ECC audit
    this.xenoClassicalSurrogate = opts.xenoClassicalSurrogate ?? false; // causal LHV bound switch for T5 CHSH audit
    this.titanSanctionsEnabled = opts.titanSanctionsEnabled ?? true; // multilateral coalition embargo against defectors
    this.rk = mulberry((seed * 15401 + 73) >>> 0); // dedicated Multi-Kingdom RNG stream (keeps `this.r` untouched!)
    this.cladeCounts = { '0L': 0, '4L': 0, '6L': 0, '8L': 0, '10L': 0 };
    this.casteCounts = { 'Sovereign α': 0, 'Harvester β': 0, 'Sentinel γ': 0, 'Weaver δ': 0, 'Disruptor ε': 0 };
    this.colonyOrderR = 0.5;
    this.speciesCount = 1;
    // Bedau-Packard Cumulative Evolutionary Activity vs Neutral Shadow Drift Model (`T11`)
    this.bedauRealMap = new Map();
    this.bedauNeutralMap = new Map();
    this.neutralShadowPeers = [];
    this.bedauActivity = 0.0;
    this.bedauNeutralActivity = 0.0;
    this._bedauAcc = 0.0;
    // Empirical 4x4 CHSH Non-Local Game Contingency Table (`T5`)
    this.chshStats = {
      trials: 0,
      wins: 0,
      winRate: 0.0,
      empiricalS: 0.0,
      noSignalingMaxDiff: 0.0,
      counts: new Uint32Array(16), // [ (x*2 + y)*4 + (a*2 + b) ]
    };
    this.lineageTree = [
      { id: 0, parentA: -1, parentB: -1, gen: 0, t: 0, hue: 0.75, crestFin: 1.0, bodyLen: 1.0, limbPairs: 3, clade: '6L Hexapod', label: 'Focal-0' },
    ];
    this.stats = {
      births: 0,
      eggsLaid: 0,
      courtships: 0,
      mitesEaten: 0,
      pollinationEvents: 0,
      alarmCalls: 0,
      maxGen: 0,
      rsCallsSent: 0,
      rsSymbolsRepaired: 0,
      rsFramesDropped: 0,
      rsEarlyEvasions: 0,
      sanctuarySaves: 0,
      predations: 0,
      starvations: 0,
      devourSalvages: 0,
      forgePurifications: 0,
      titanAlliances: 0,
      titanWars: 0,
      shoggothBargains: 0,
      shoggothCooperativeGains: 0,
      shoggothAmbushes: 0,
      shoggothEvasions: 0,
      shoggothNetPayoff: 0.0,
    };

    world.coEvolvePlants = true;
    world.eco = this;

    for (let i = 0; i < initPeers; i++) this.spawnPeer(null, null, true);
    // Clone exact generation-0 genomes & lifecycle state into the demographically-matched Neutral Shadow Drift Population!
    for (let i = 0; i < this.peers.length; i++) {
      const p0 = this.peers[i];
      this.neutralShadowPeers.push({ gen: { ...p0.gen }, hox: p0.hox, age: p0.age, mateCooldown: p0.mateCooldown });
    }
    for (let i = 0; i < initMites; i++) this.spawnMite();
    for (let i = 0; i < initPreds; i++) this.spawnPredator();
    this.initMultiKingdomDome(opts);
  }

  _neutralShadowDeath() {
    const S = this.neutralShadowPeers;
    if (S.length > 1) {
      const adultIdxs = [];
      for (let i = 0; i < S.length; i++) if (S[i].age >= 14) adultIdxs.push(i);
      const rmIdx = adultIdxs.length > 0
        ? adultIdxs[Math.floor(this.rk() * adultIdxs.length)]
        : Math.floor(this.rk() * S.length);
      S.splice(rmIdx, 1);
    }
  }

  _neutralShadowBirth() {
    const S = this.neutralShadowPeers;
    if (S.length < 2) return;
    const rk = this.rk;
    // Exact demographically-matched Bedau-Packard Neutral Shadow: same maturation/cooldown & crossoverGenomes(..., 0.15), fitness-blind!
    const elig = [];
    for (let i = 0; i < S.length; i++) {
      if (S[i].age >= 32 && S[i].mateCooldown <= 0) elig.push(S[i]);
    }
    const pool = elig.length >= 2 ? elig : S;
    const iA = Math.floor(rk() * pool.length);
    let iB = Math.floor(rk() * (pool.length - 1));
    if (iB >= iA) iB++;
    const pA = pool[iA], pB = pool[iB];
    pA.mateCooldown = 13;
    pB.mateCooldown = 13;
    const child = crossoverGenomes(pA.gen, pB.gen, rk, 0.15);
    S.push({ gen: child, hox: evalHoxGRN(child), age: 0, mateCooldown: 16 });
  }

  spawnPeer(gen = null, pos = null, adultStart = false, meta = {}) {
    const r = this.r, W = this.world;
    if (this.peers.length >= this.maxPeers) {
      // Selective carrying-capacity competition: lowest-energy / thermally stressed adult is displaced & recycled into soil N/C
      let cullIdx = 0, worstVit = 1e9;
      for (let i = 0; i < this.peers.length; i++) {
        const pi = this.peers[i];
        const vit = (pi.age < 14 ? 2.5 : 0.0) + pi.energy + 0.30 * (pi._tpc ?? 0.5) + 0.20 * (pi._uArmor ?? 0.4) - 0.002 * pi.age;
        if (vit < worstVit) { worstVit = vit; cullIdx = i; }
      }
      const old = this.peers.splice(cullIdx, 1)[0];
      if (old) {
        const si = W.soilIndex(old.x, old.z);
        W.fluxSoilN ? W.fluxSoilN(si, 0.35, 2) : (W.soilN[si] = Math.min(2.0, W.soilN[si] + 0.35));
        W.fluxSoilC ? W.fluxSoilC(si, 0.40, 2) : (W.soilC[si] = Math.min(2.0, W.soilC[si] + 0.40));
        W.transferEnergy?.(5, 8, 0.35);
        this._neutralShadowDeath();
        // `devourBrain` horizontal trait salvage: nearby kin absorbs 5% of elder's thermOpt/legSw adaptation
        for (let k = 0; k < this.peers.length; k++) {
          const nb = this.peers[k];
          if ((nb.x - old.x) ** 2 + (nb.z - old.z) ** 2 < 16.0) {
            nb.gen.legSw = +(((nb.gen.legSw ?? 1.0) * 0.95 + (old.gen.legSw ?? 1.0) * 0.05)).toFixed(4);
            this.stats.devourSalvages++;
            break;
          }
        }
      }
    }

    const g = gen || mutateStarterGenome(r, 0.22);
    const a = r() * Math.PI * 2, d = 5 + r() * 11;
    const x = pos ? pos[0] : Math.cos(a) * d;
    const z = pos ? pos[1] : Math.sin(a) * d;
    const y = W.height(x, z) + 0.28;
    const id = this.nextId++;
    const generation = meta.generation ?? 0;
    const age = adultStart ? 55 + r() * 70 : 0;
    const stage = age < 22 ? 'neonate' : age < 50 ? 'juvenile' : age < 260 ? 'adult' : 'elder';
    const scale = stage === 'neonate' ? 0.48 : stage === 'juvenile' ? 0.76 : 1.0;

    // 7-segment articulated spine coordinates for 3D rendering & binocular retinal projection
    const segX = new Float32Array(7), segY = new Float32Array(7), segZ = new Float32Array(7);
    const hdg = r() * Math.PI * 2;
    const bLen = g.bodyLen ?? 1.0;
    for (let s = 0; s < 7; s++) {
      const off = (s - 3) * 0.34 * bLen * scale;
      segX[s] = x + Math.cos(hdg) * off;
      segZ[s] = z + Math.sin(hdg) * off;
      segY[s] = W.height(segX[s], segZ[s]) + 0.26 * scale;
    }

    const hox = evalHoxGRN(g);
    const embryo = developZygoteEmbryo(g);
    const peer = {
      id,
      gen: g,
      hox,
      embryoBlastomeres: embryo.nBlastomeres,
      limbPairs: hox.limbPairs,
      clade: hox.cladeName || `${hox.limbPairs * 2}L`,
      patagium: hox.patagium || 0,
      anglerLure: hox.anglerLure || 0,
      generation,
      parentA: meta.parentA ?? -1,
      parentB: meta.parentB ?? -1,
      x, y, z,
      vx: 0, vz: 0,
      hdg,
      age,
      stage,
      scale,
      energy: adultStart ? 0.72 + 0.2 * r() : 0.68,
      hydration: 0.8 + 0.15 * r(),
      bodyTemp: 23.0,
      mateCooldown: adultStart ? 6 + r() * 10 : 25,
      courtship: 0,
      camo: 0,
      curl: 0,
      vocalFreq: 320 + 260 * (g.pigmentHue ?? 0.5),
      vocalAmp: 0,
      gaitPh: r() * Math.PI * 2,
      goalX: 0,
      goalZ: 0,
      goalType: 'wander',
      goalTimer: 0,
      casteId: id % 5,
      caste: COLONY_CASTES[id % 5],
      deceive: (id % 5) === 4 ? 0.45 : 0, // Disruptor epsilon default feint posture
      rsCooldown: 0,
      segX, segY, segZ,
    };
    this.peers.push(peer);
    this.updateCladeCensus();
    this.lineageTree.push({
      id,
      parentA: peer.parentA,
      parentB: peer.parentB,
      gen: generation,
      t: +this.t.toFixed(1),
      hue: g.pigmentHue ?? 0.5,
      crestFin: g.crestFin ?? 1.0,
      bodyLen: g.bodyLen ?? 1.0,
      limbPairs: hox.limbPairs,
      clade: peer.clade,
      patagium: +(peer.patagium.toFixed(2)),
      anglerLure: +(peer.anglerLure.toFixed(2)),
      isFocalChild: peer.parentA === 0 || peer.parentB === 0,
    });
    if (this.lineageTree.length > 128) this.lineageTree.shift();
    if (generation > this.stats.maxGen) this.stats.maxGen = generation;
    return peer;
  }

  updateCladeCensus() {
    const cc = { '0L': 0, '4L': 0, '6L': 0, '8L': 0, '10L': 0 };
    const kc = { 'Sovereign α': 0, 'Harvester β': 0, 'Sentinel γ': 0, 'Weaver δ': 0, 'Disruptor ε': 0 };
    for (let i = 0; i < this.peers.length; i++) {
      const k = `${this.peers[i].limbPairs * 2}L`;
      if (cc[k] !== undefined) cc[k]++;
      const cname = this.peers[i].caste || COLONY_CASTES[i % 5];
      if (kc[cname] !== undefined) kc[cname]++;
    }
    this.cladeCounts = cc;
    this.casteCounts = kc;
    let sp = 0;
    for (const k of Object.keys(cc)) if (cc[k] > 0) sp++;
    this.speciesCount = Math.max(1, sp);
  }

  layEgg(x, z, genA, genB, idA, idB, genNum, focalInvolved = false) {
    if (this.eggs.length >= 24) return null;
    const W = this.world;
    const childGen = crossoverGenomes(genA, genB, this.r, 0.15);
    const egg = {
      id: this.nextId++,
      x: clamp(x, -WORLD + 2, WORLD - 2),
      z: clamp(z, -WORLD + 2, WORLD - 2),
      y: W.height(x, z) + 0.16,
      gen: childGen,
      parentA: idA,
      parentB: idB,
      generation: genNum,
      focalInvolved,
      progress: 0,
      tempOpt: 19.0 + 13.0 * clamp(((childGen.thermOpt ?? 0.5) - 0.25) / 0.50, 0, 1),
      hue: childGen.pigmentHue ?? 0.5,
      pulse: this.r() * Math.PI * 2,
      held: false,
    };
    this.eggs.push(egg);
    this.stats.eggsLaid++;
    return egg;
  }

  spawnMite(pos = null) {
    if (this.mites.length >= 80) return null;
    const r = this.r, W = this.world;
    const a = r() * Math.PI * 2, d = 2 + r() * 16;
    const x = pos ? pos[0] : Math.cos(a) * d;
    const z = pos ? pos[1] : Math.sin(a) * d;
    const m = {
      x, z,
      y: W.height(x, z) + 0.12,
      vx: (r() - 0.5) * 1.2,
      vz: (r() - 0.5) * 1.2,
      hue: 0.25 + 0.5 * r(),
      targetPlant: Math.floor(r() * SITES),
      pollen: 0,
      ph: r() * Math.PI * 2,
    };
    this.mites.push(m);
    return m;
  }

  spawnPredator() {
    if (this.predators.length >= 3) return null;
    const r = this.r, W = this.world;
    const a = r() * Math.PI * 2, d = 15 + r() * 4;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const p = {
      x, z,
      y: W.height(x, z) + 1.35,
      hdg: a + Math.PI * 0.5,
      speed: 1.55,
      swoop: 0,
      cooldown: 4 + r() * 6,
      ph: r() * Math.PI * 2,
    };
    this.predators.push(p);
    return p;
  }

  setPopulationTargets({ peers, mites, predators }) {
    if (peers !== undefined) {
      const tgt = clamp(Math.round(peers), 0, 48);
      this.maxPeers = Math.max(this.maxPeers, Math.min(48, tgt + 6));
      while (this.peers.length < tgt) this.spawnPeer(null, null, true);
      while (this.peers.length > tgt) this.peers.pop();
      this.updateCladeCensus();
    }
    if (mites !== undefined) {
      const tgt = clamp(Math.round(mites), 0, 80);
      while (this.mites.length < tgt) this.spawnMite();
      while (this.mites.length > tgt) this.mites.pop();
    }
    if (predators !== undefined) {
      const tgt = clamp(Math.round(predators), 0, 3);
      while (this.predators.length < tgt) this.spawnPredator();
      while (this.predators.length > tgt) this.predators.pop();
    }
  }

  /** Step full multi-agent biosphere: predators, bio-mites, incubated eggs, conspecific AI, courtship & focal interactions */
  step(dt, focalCreature = null) {
    this.t += dt;
    const W = this.world, r = this.r;
    const hour = focalCreature ? focalCreature.hour : 12;
    const fHd = focalCreature ? focalCreature.body.head() : [0, 0, 0];

    // 1) Step Shadow-Leviathan Apex Predators
    for (let i = 0; i < this.predators.length; i++) {
      const pr = this.predators[i];
      pr.ph = (pr.ph + dt * 3.2) % (Math.PI * 2);
      pr.cooldown = Math.max(0, pr.cooldown - dt);

      // Orbit outer ridge by default; occasionally swoop toward exposed un-camouflaged prey
      let tx = Math.cos(this.t * 0.11 + i * 3.1) * 15.5;
      let tz = Math.sin(this.t * 0.11 + i * 3.1) * 15.5;
      pr.swoop = Math.max(0, pr.swoop - dt * 0.45);

      if (pr.cooldown <= 0) {
        // Check if focal creature or a peer is exposed far from crystal shelters & Big-Tree Sanctuaries
        let candX = null, candZ = null, bestD = 13.5;
        const checkPrey = (px, pz, camo, curl, deceive = 0) => {
          const effStealth = Math.max(camo, 0.72 * deceive); // Raider Cold-Strike / Disruptor emission suppression!
          if (effStealth > 0.65 || curl > 0.65) return;
          if (this.refugeImmunityEnabled && W.isInsideSanctuary?.(px, pz)) {
            this.stats.sanctuarySaves++;
            return; // safe inside Big-Tree Sanctuary Refuge (`GATE-DOME-REFUGE`)!
          }
          for (let s = 0; s < W.shelters.length; s++) {
            if (Math.hypot(px - W.shelters[s].x, pz - W.shelters[s].z) < 2.6) return; // safe inside crystal spire!
          }
          const d = Math.hypot(px - pr.x, pz - pr.z);
          if (d < bestD) { bestD = d; candX = px; candZ = pz; }
        };
        if (focalCreature && focalCreature.sleep.stage === 0) {
          checkPrey(
            fHd[0], fHd[2],
            focalCreature.camoLevel || 0,
            focalCreature.body.u[53] || 0,
            focalCreature.heptarch?.deceive || 0
          );
        }
        for (let k = 0; k < this.peers.length; k++) {
          const p = this.peers[k];
          const rawHueDiff = Math.abs((p.gen.pigmentHue ?? 0.5) - 0.42);
          const dSubstr = Math.min(rawHueDiff, 1.0 - rawHueDiff); // [0..0.5] contrast against moss-cyan Biodome floor
          const passiveCrypsis = 0.48 * Math.max(0, 1.0 - dSubstr * 3.2);
          checkPrey(p.x, p.z, Math.max(p.camo, passiveCrypsis), p.curl, p.deceive || 0);
        }
        if (candX !== null) {
          tx = candX; tz = candZ;
          pr.swoop = Math.min(1, pr.swoop + dt * 1.1);
        }
      }

      // Repelled by geothermal hydrothermal steam plumes & Big-Tree Sanctuary canopies
      for (let v = 0; v < W.vents.length; v++) {
        const vt = W.vents[v];
        const dx = pr.x - vt.x, dz = pr.z - vt.z, d = Math.hypot(dx, dz);
        if (d < 3.2 && d > 1e-3) { tx += (dx / d) * 6; tz += (dz / d) * 6; }
      }
      if (this.refugeImmunityEnabled && W.sanctuaries) {
        for (let s = 0; s < W.sanctuaries.length; s++) {
          const sc = W.sanctuaries[s];
          const dx = pr.x - sc.x, dz = pr.z - sc.z, d = Math.hypot(dx, dz);
          if (d < sc.r + 0.9 && d > 1e-3) { tx += (dx / d) * 8; tz += (dz / d) * 8; }
        }
      }

      const angTo = Math.atan2(tz - pr.z, tx - pr.x);
      let dAng = Math.atan2(Math.sin(angTo - pr.hdg), Math.cos(angTo - pr.hdg));
      pr.hdg += clamp(dAng, -1.8 * dt, 1.8 * dt);
      const sp = pr.speed * (1 + 0.65 * pr.swoop);
      pr.x = clamp(pr.x + Math.cos(pr.hdg) * sp * dt, -WORLD + 1.5, WORLD - 1.5);
      pr.z = clamp(pr.z + Math.sin(pr.hdg) * sp * dt, -WORLD + 1.5, WORLD - 1.5);
      const hGround = W.height(pr.x, pr.z);
      pr.y += (hGround + 1.35 - 0.55 * pr.swoop - pr.y) * Math.min(1, dt * 4);
      // Deterministic Leviathan wake ploughs soil strata conservatively without touching `this.r`!
      const sIdxPr = W.soilIndex(pr.x, pr.z);
      if (W.fluxSoilN) W.fluxSoilN(sIdxPr, dt * 0.008, 2);
      else W.soilN[sIdxPr] = Math.min(2.0, W.soilN[sIdxPr] + dt * 0.008);

      // Close swoop startles focal creature or peer -> releases Schreckstoff alarm pheromone & resets predator cooldown!
      if (focalCreature) {
        const df = Math.hypot(pr.x - fHd[0], pr.z - fHd[2]);
        const safeInRefuge = this.refugeImmunityEnabled && W.isInsideSanctuary?.(fHd[0], fHd[2]);
        const focalWarned = (focalCreature._rsWarnTimer || 0) > 0;
        if (df < 2.2 && pr.cooldown <= 0 && !safeInRefuge) {
          if (focalWarned) {
            this.stats.rsEarlyEvasions++;
            pr.cooldown = 6.0;
          } else {
            pr.cooldown = 14.0;
            W.depositPheromone(fHd[0], fHd[2], 1, 2.2); // Schreckstoff alarm burst!
            focalCreature.nociception = Math.max(focalCreature.nociception, 0.65);
            focalCreature.heptarch?.inflictLimbTrauma(Math.floor(this.rk() * 6), 0.26);
            focalCreature.vocalFreq = 680;
            focalCreature.vocalAmp = 0.9;
            this.stats.alarmCalls++;
            this.stats.predations++;
            focalCreature.ev('alarm', 'Shadow-Leviathan swooped — limb V_mem depolarized & Schreckstoff emitted!');
          }
        } else if (df < 2.2 && safeInRefuge) {
          this.stats.sanctuarySaves++;
        }
      }
      for (let k = 0; k < this.peers.length; k++) {
        const p = this.peers[k];
        if (Math.hypot(pr.x - p.x, pr.z - p.z) < 2.1 && pr.cooldown <= 0) {
          if (this.refugeImmunityEnabled && W.isInsideSanctuary?.(p.x, p.z)) {
            this.stats.sanctuarySaves++;
            continue;
          }
          // Pre-contact osteoderm carapace curl (only when warned at range > 2.4u via RS[15,11] broadcast!) deflects strike
          if ((p.earlyWarnTimer || 0) > 0 && p.curl > 0.65) {
            this.stats.rsEarlyEvasions++;
            pr.cooldown = 4.5;
            continue;
          }
          pr.cooldown = 7.5;
          const armor = clamp(p.gen.osteoderm ?? 0.3, 0, 1);
          p.energy = Math.max(0.02, p.energy - 0.34 * (1 - 0.68 * armor));
          p.curl = 1.0;
          p.vocalFreq = 710;
          p.vocalAmp = 0.85;
          W.depositPheromone(p.x, p.z, 1, 2.0);
          this.stats.alarmCalls++;
          this.stats.predations++;
        }
      }
    }

    // 2) Step Photonic Bio-Mites (mutualistic plant pollinators + mobile protein prey)
    while (this.mites.length < 12 && r() < dt * 0.4) this.spawnMite();
    for (let i = this.mites.length - 1; i >= 0; i--) {
      const m = this.mites[i];
      m.ph = (m.ph + dt * 9.0) % (Math.PI * 2);
      const pl = W.plants[m.targetPlant];
      const dx = pl.x - m.x, dz = pl.z - m.z, d = Math.hypot(dx, dz);
      if (d < 0.75) {
        if (pl.fruit > 0.25) {
          pl.pollinated = Math.min(1.5, pl.pollinated + 0.35);
          this.stats.pollinationEvents++;
        }
        m.targetPlant = Math.floor(r() * SITES);
      } else {
        m.vx += ((dx / (d + 1e-4)) * 1.4 - m.vx) * dt * 2.2 + (r() - 0.5) * 0.35;
        m.vz += ((dz / (d + 1e-4)) * 1.4 - m.vz) * dt * 2.2 + (r() - 0.5) * 0.35;
      }
      // Scatter away from alarm pheromone
      const alarm = W.samplePheromone(m.x, m.z, 1);
      if (alarm > 0.2) { m.vx *= 1.04; m.vz *= 1.04; }
      m.x = clamp(m.x + m.vx * dt, -WORLD + 1.5, WORLD - 1.5);
      m.z = clamp(m.z + m.vz * dt, -WORLD + 1.5, WORLD - 1.5);
      m.y = W.height(m.x, m.z) + 0.11 + 0.04 * Math.abs(Math.sin(m.ph));

      // Focal creature catches nearby bio-mite when awake & hungry!
      if (focalCreature && focalCreature.sleep.stage === 0 && Math.hypot(m.x - fHd[0], m.z - fHd[2]) < 0.92) {
        this.mites.splice(i, 1);
        focalCreature.metab.eat('protein', 0.85);
        focalCreature.stats.snacks++;
        this.stats.mitesEaten++;
        focalCreature.outcome(null, 0.9);
        W.depositPheromone(fHd[0], fHd[2], 0, 0.8);
        focalCreature.ev('hunt', 'caught a photonic bio-mite (protein + pollination mutualist)');
        continue;
      }
    }

    // 3) Step Physical 3D Incubated Eggs (thermally coupled incubation -> neonate hatching!)
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const eg = this.eggs[i];
      eg.pulse = (eg.pulse + dt * 3.5) % (Math.PI * 2);
      if (!eg.held) eg.y = W.height(eg.x, eg.z) + 0.16;
      const tAmb = W.ambientTemp(eg.x, eg.z, hour);
      const tDiff = Math.abs(tAmb - eg.tempOpt);
      const thermRate = clamp(1.35 - 0.08 * tDiff, 0.35, 1.45); // faster incubation near warm hydrothermal vents!
      eg.progress += (dt / 12.0) * thermRate; // ~9-16 s incubation for multi-generational turnover
      if (eg.progress >= 1.0) {
        this.eggs.splice(i, 1);
        const neo = this.spawnPeer(eg.gen, [eg.x, eg.z], false, {
          parentA: eg.parentA,
          parentB: eg.parentB,
          generation: eg.generation,
        });
        this.stats.births++;
        this._neutralShadowBirth();
        if (focalCreature && eg.focalInvolved) {
          focalCreature.ev('hatch', `offspring #${neo.id} (gen ${neo.generation}) hatched from incubated egg!`);
        }
      }
    }

    if (focalCreature && focalCreature._rsWarnTimer > 0) {
      focalCreature._rsWarnTimer = Math.max(0, focalCreature._rsWarnTimer - dt);
    }

    // 3b) Propagate & decode spatial RS[15,11] Neuralese acoustic packets across receivers!
    for (let a = this.acousticPackets.length - 1; a >= 0; a--) {
      const pkt = this.acousticPackets[a];
      pkt.age += dt;
      if (pkt.age > 0.85) { this.acousticPackets.splice(a, 1); continue; }
      const waveR = pkt.age * 20.0;
      const tryReceive = (rxX, rxZ, receiverObj, isFocal = false) => {
        if (pkt.receivedBy.has(receiverObj)) return;
        const dSrc = Math.hypot(rxX - pkt.srcX, rxZ - pkt.srcZ);
        if (dSrc > waveR || dSrc > 16.5) return;
        pkt.receivedBy.add(receiverObj);
        // Corrupt independent GF(2^4) symbols along acoustic ray (2 burst symbol errors from storm + multipathing)
        const rxCw = Uint8Array.from(pkt.txCw);
        const nErrs = (W.dome?.auroraStorm || 0) > 0.12 || dSrc > 5.0 ? 2 : 1;
        const p0 = Math.floor(this.rk() * 15);
        rxCw[p0] ^= (1 + Math.floor(this.rk() * 15)) & 0x0f;
        if (nErrs >= 2) {
          const p1 = (p0 + 1 + Math.floor(this.rk() * 14)) % 15;
          rxCw[p1] ^= (1 + Math.floor(this.rk() * 15)) & 0x0f;
        }
        const canECC = this.eccEnabled && !(isFocal && focalCreature?.lesion?.heptarch);
        if (!canECC) {
          // Uncoded / ECC-ablated receiver: any symbol corruption breaks parity syndrome -> packet dropped!
          this.stats.rsFramesDropped++;
          return;
        }
        const dec = decodeAcousticCallRS(rxCw);
        if (dec.ok) {
          this.stats.rsSymbolsRepaired += dec.correctedSymbols;
          if (isFocal) {
            focalCreature._rsWarnTimer = 4.5;
            if (focalCreature.heptarch) {
              focalCreature.heptarch.rsFramesDecoded++;
              focalCreature.heptarch.rsSymbolsRepaired += dec.correctedSymbols;
            }
          } else if (Math.hypot(rxX - dec.x, rxZ - dec.z) > 2.4) {
            receiverObj.earlyWarnTimer = 5.5;
            receiverObj.earlyPredX = dec.x;
            receiverObj.earlyPredZ = dec.z;
            W.depositPheromone(dec.x, dec.z, 1, 0.45 * dec.urgency);
          }
        } else {
          this.stats.rsFramesDropped++;
        }
      };
      if (focalCreature) tryReceive(fHd[0], fHd[2], focalCreature, true);
      for (let k = 0; k < this.peers.length; k++) {
        if (this.peers[k].id !== pkt.senderId) tryReceive(this.peers[k].x, this.peers[k].z, this.peers[k], false);
      }
    }

    // 4) Step Autonomous Conspecific Glitchlings (`peers`) + Natural Selection + Diploid Courtship
    for (let i = this.peers.length - 1; i >= 0; i--) {
      const p = this.peers[i];
      p.age += dt;
      p.stage = p.age < 14 ? 'neonate' : p.age < 32 ? 'juvenile' : p.age < 260 ? 'adult' : 'elder';
      const targetScale = p.stage === 'neonate' ? 0.48 + 0.016 * p.age : p.stage === 'juvenile' ? 0.74 + 0.012 * (p.age - 14) : p.stage === 'elder' ? 0.96 : 1.0;
      p.scale += (targetScale - p.scale) * Math.min(1, dt * 1.5);

      const tAmb = W.ambientTemp(p.x, p.z, hour);
      const uTherm = clamp(((p.gen.thermOpt ?? 0.5) - 0.25) / 0.50, 0, 1);
      const uArmor = clamp(((p.gen.osteoderm ?? 0.45) - 0.05) / 1.20, 0, 1);
      const rawHueD = Math.abs((p.gen.pigmentHue ?? 0.5) - 0.4375);
      const crypsis = Math.max(0, 1.0 - Math.min(rawHueD, 1.0 - rawHueD) * 3.8);
      const tPref = 19.0 + 13.0 * uTherm;
      p.bodyTemp += (tAmb + 1.8 - p.bodyTemp) * Math.min(1, dt * 0.35);
      // Huey-Stevenson ectotherm thermal performance curve + substrate crypsis + osteoderm mass trade-off
      const tpc = Math.exp(-(((tAmb - tPref) / 3.5) ** 2));
      p._tpc = tpc;
      p._crypsis = crypsis;
      p._uArmor = uArmor;
      const armorCost = 0.0004 * uArmor;
      const thermBurn = 0.0044 * (1.0 - tpc);
      const crypsisStress = 0.0014 * (1.0 - crypsis);
      p.energy = clamp(p.energy - dt * (0.0010 + thermBurn + crypsisStress + armorCost), 0.0, 1.2);
      p.hydration = clamp(p.hydration - dt * 0.0035, 0.05, 1.1);
      p.earlyWarnTimer = Math.max(0, (p.earlyWarnTimer || 0) - dt);

      // Genuine starvation mortality (with minimum 4-peer refugium floor so catastrophe tests stay populated)
      if (p.energy <= 0.045 && this.peers.length > 4) {
        this.peers.splice(i, 1);
        const si = W.soilIndex(p.x, p.z);
        if (W.fluxSoilN) W.fluxSoilN(si, 0.28, 2);
        if (W.fluxSoilC) W.fluxSoilC(si, 0.32, 2);
        W.transferEnergy?.(5, 8, 0.25);
        this.stats.starvations++;
        this._neutralShadowDeath();
        this.updateCladeCensus();
        continue;
      }

      p.mateCooldown = Math.max(0, p.mateCooldown - dt);
      p.courtship = Math.max(0, p.courtship - dt * 0.6);
      p.vocalAmp = Math.max(0, p.vocalAmp - dt * 1.4);
      p.goalTimer -= dt;

      // Alarm & predator check (Sentinel gamma has extended 13.5u perimeter radar & RS[15,11] burst-proof broadcast!)
      p.rsCooldown = Math.max(0, (p.rsCooldown || 0) - dt);
      const vigRange = p.casteId === 2 ? 13.5 : 3.2;
      let predNear = 0, seenPred = null;
      for (let q = 0; q < this.predators.length; q++) {
        const pr = this.predators[q];
        const dp = Math.hypot(pr.x - p.x, pr.z - p.z);
        if (dp < vigRange && 1 - dp / vigRange > predNear) {
          predNear = 1 - dp / vigRange;
          seenPred = pr;
        }
      }
      if (p.casteId === 2 && seenPred && predNear > 0.16 && p.rsCooldown <= 0) {
        p.rsCooldown = 3.8;
        const txCw = encodeAcousticCallRS(1, seenPred.x, seenPred.z, predNear, p.casteId);
        this.acousticPackets.push({
          senderId: p.id,
          srcX: p.x,
          srcZ: p.z,
          txCw,
          age: 0,
          receivedBy: new Set([p]),
        });
        if (Math.hypot(seenPred.x - p.x, seenPred.z - p.z) > 2.4) p.earlyWarnTimer = 5.5;
        this.stats.rsCallsSent++;
      }
      // Weaver delta nudges nearby DomeStones toward nearest shelter to build protective cairns
      if (p.casteId === 3 && W.domeStones && W.shelters?.length) {
        for (let si = 0; si < W.domeStones.length; si++) {
          const st = W.domeStones[si];
          if (st.heldBy) continue;
          if ((st.x - p.x) ** 2 + (st.z - p.z) ** 2 < 1.44) {
            const sh0 = W.shelters[0];
            const dxs = sh0.x - st.x, dzs = sh0.z - st.z, ds = Math.hypot(dxs, dzs) || 1;
            if (ds > 1.2) { st.vx += (dxs / ds) * dt * 1.8; st.vz += (dzs / ds) * dt * 1.8; }
          }
        }
      }
      p.deceive = p.casteId === 4 ? (predNear > 0.15 ? 0.92 : 0.45) : 0;
      const alarmConc = W.samplePheromone(p.x, p.z, 1);
      const rsThreat = (p.earlyWarnTimer || 0) > 0 ? 0.85 : 0;
      const threat = Math.max(predNear, rsThreat, clamp(alarmConc * 0.6, 0, 1));
      p.camo += ((threat > 0.25 ? 0.9 : 0.08) - p.camo) * Math.min(1, dt * 2.5);
      p.curl += ((threat > 0.68 ? 0.92 : 0) - p.curl) * Math.min(1, dt * 3.0);

      // Goal selection: flee to shelter > thermal basking > water > courtship > foraging
      if (threat > 0.32 && W.shelters.length) {
        let bestS = W.shelters[0], bd = 1e9;
        for (const sh of W.shelters) {
          const d = Math.hypot(sh.x - p.x, sh.z - p.z);
          if (d < bd) { bd = d; bestS = sh; }
        }
        p.goalX = bestS.x; p.goalZ = bestS.z; p.goalType = 'shelter';
      } else if (p.bodyTemp < tPref - 4.5 && p.energy > 0.45 && W.vents.length) {
        let bestV = W.vents[0], bd = 1e9;
        for (const vt of W.vents) {
          const d = Math.hypot(vt.x - p.x, vt.z - p.z);
          if (d < bd) { bd = d; bestV = vt; }
        }
        p.goalX = bestV.x; p.goalZ = bestV.z; p.goalType = 'bask';
      } else if (p.hydration < 0.38 && W.pools.length) {
        let bestW = W.pools[0], bd = 1e9;
        for (const pl of W.pools) {
          const d = Math.hypot(pl.x - p.x, pl.z - p.z);
          if (d < bd) { bd = d; bestW = pl; }
        }
        p.goalX = bestW.x; p.goalZ = bestW.z; p.goalType = 'water';
      } else if (p.stage === 'adult' && p.energy > 0.56 && p.mateCooldown <= 0) {
        // Emit sex/kin pheromone & seek nearest receptive adult (focal creature or conspecific)
        W.depositPheromone(p.x, p.z, 2, dt * 0.9);
        let mateX = null, mateZ = null, mateRef = null, bd = 22.0, bestMateScore = -1e9;
        if (focalCreature && focalCreature.sleep.stage === 0 && focalCreature.metab.hunger() < 0.65 && (focalCreature.mateCooldown || 0) <= 0) {
          const df = Math.hypot(fHd[0] - p.x, fHd[2] - p.z);
          if (df < bd && canAssortativeMate(p.gen, focalCreature.gen, p.hox, focalCreature.body?.hox)) {
            bd = df; mateX = fHd[0]; mateZ = fHd[2]; mateRef = 'focal'; bestMateScore = 1.0 - 0.03 * df;
          }
        }
        for (let j = 0; j < this.peers.length; j++) {
          if (j === i) continue;
          const pj = this.peers[j];
          if (pj.stage !== 'adult' || pj.energy < 0.50 || pj.mateCooldown > 0) continue;
          const dj = Math.hypot(pj.x - p.x, pj.z - p.z);
          if (dj < 22.0 && canAssortativeMate(p.gen, pj.gen, p.hox, pj.hox)) {
            // Condition-dependent Darwinian mate choice (Andersson 1994): favors high-energy partners within courtship range
            const sc = pj.energy - 0.025 * dj;
            if (sc > bestMateScore) {
              bestMateScore = sc; bd = dj; mateX = pj.x; mateZ = pj.z; mateRef = pj;
            }
          }
        }
        if (mateX !== null) {
          p.goalX = mateX; p.goalZ = mateZ; p.goalType = 'mate';
          if (bd < 2.35) {
            p.courtship = Math.min(1, p.courtship + dt * 1.8);
            p.vocalAmp = 0.65;
            if (mateRef === 'focal' && focalCreature) {
              this.stats.courtships++;
              p.mateCooldown = 36;
              focalCreature.mateCooldown = 36;
              p.energy -= 0.14;
              const genNum = Math.max(p.generation, focalCreature.generation || 0) + 1;
              this.layEgg(0.5 * (p.x + fHd[0]), 0.5 * (p.z + fHd[2]), focalCreature.gen, p.gen, 0, p.id, genNum, true);
              focalCreature.outcome(null, 0.95);
              focalCreature.vocalFreq = 0.5 * (p.vocalFreq + 440);
              focalCreature.vocalAmp = 0.75;
              focalCreature.ev('courtship', `courted conspecific #${p.id} (${p.clade}) — diploid 128-gene Zygote+Hox egg laid!`);
            } else if (mateRef && mateRef.id > p.id) {
              this.stats.courtships++;
              p.mateCooldown = 13;
              mateRef.mateCooldown = 13;
              p.energy -= 0.09;
              mateRef.energy -= 0.09;
              const genNum = Math.max(p.generation, mateRef.generation) + 1;
              this.layEgg(0.5 * (p.x + mateRef.x), 0.5 * (p.z + mateRef.z), p.gen, mateRef.gen, p.id, mateRef.id, genNum, false);
            }
          }
        } else if (p.goalTimer <= 0) {
          p.goalType = 'food';
        }
      } else if (p.goalTimer <= 0 || p.goalType === 'mate') {
        // Choose promising fruiting plant + food pheromone bias
        let bestP = W.plants[0], bestScore = -1e9;
        for (let k = 0; k < SITES; k++) {
          const pl = W.plants[k];
          const d = Math.hypot(pl.x - p.x, pl.z - p.z);
          const phFood = W.samplePheromone(pl.x, pl.z, 0);
          const sc = pl.fruit * (0.6 + pl.p) + 0.25 * phFood - 0.04 * d + 0.15 * r();
          if (sc > bestScore) { bestScore = sc; bestP = pl; }
        }
        p.goalX = bestP.x; p.goalZ = bestP.z; p.goalType = 'food'; p.goalPlant = bestP.k;
        p.goalTimer = 7 + 5 * r();
      }

      // Locomotion & articulated 7-segment gait kinematics
      const dx = p.goalX - p.x, dz = p.goalZ - p.z, dGoal = Math.hypot(dx, dz);
      const f0 = p.gen.f0 ?? 2.1;
      const patGlide = p.patagium > 0.3 ? (1 + 0.28 * p.patagium) : 1.0;
      const armorDrag = 1.08 - 0.22 * clamp(p.gen.osteoderm ?? 0.3, 0, 1);
      const tpcGain = 0.52 + 0.62 * (p._tpc ?? 0.85);
      const strideGain = (0.55 + 0.35 * (p.gen.legSw ?? 1.0)) * (0.65 + 0.35 * p.scale) * patGlide * armorDrag * tpcGain * (1 - 0.7 * p.curl);
      if (dGoal > 0.45) {
        const targetHdg = Math.atan2(dz, dx);
        const dH = Math.atan2(Math.sin(targetHdg - p.hdg), Math.cos(targetHdg - p.hdg));
        p.hdg += clamp(dH, -2.4 * dt, 2.4 * dt);
        const spd = strideGain * (threat > 0.3 ? 1.35 : 0.95);
        p.vx = Math.cos(p.hdg) * spd;
        p.vz = Math.sin(p.hdg) * spd;
        p.x = clamp(p.x + p.vx * dt, -WORLD + 1.8, WORLD - 1.8);
        p.z = clamp(p.z + p.vz * dt, -WORLD + 1.8, WORLD - 1.8);
      } else {
        p.vx *= 0.85; p.vz *= 0.85;
        if (p.goalType === 'food' && p.goalPlant !== undefined) {
          const pl = W.plants[p.goalPlant];
          if (pl && pl.fruit > 0.25) {
            pl.fruit = Math.max(0, pl.fruit - 0.45);
            pl.stress = Math.min(1, pl.stress + 0.25);
            const gutAssim = (0.62 + 0.50 * (p._tpc ?? 0.8)) * (0.72 + 0.38 * (p._crypsis ?? 0.5));
            p.energy = Math.min(1.15, p.energy + 0.32 * pl.sugarTrait * gutAssim);
            W.depositPheromone(pl.x, pl.z, 0, 0.95); // deposit food trail pheromone!
            if (r() < 0.25) W.waste.push({ x: p.x, y: p.y, z: p.z, type: r() < 0.5 ? 'urine' : 'feces', age: 0, amount: 0.7 });
          }
          p.goalTimer = 0;
        } else if (p.goalType === 'water') {
          p.hydration = Math.min(1.05, p.hydration + dt * 0.45);
        }
      }

      const glideAlt = p.patagium > 0.35 && Math.hypot(p.vx, p.vz) > 0.65 ? 0.14 * p.patagium : 0;
      p.y = W.height(p.x, p.z) + 0.26 * p.scale + glideAlt;
      p.gaitPh = (p.gaitPh + dt * f0 * Math.PI * 2) % (Math.PI * 2);
      const bLen = (p.gen.bodyLen ?? 1.0) * p.scale;
      const cf = Math.cos(p.hdg), sf = Math.sin(p.hdg);
      const undulGain = p.limbPairs === 0 ? 1.95 : 1.0; // 0L Serpent anguilliform lateral traveling wave!
      for (let s = 0; s < 7; s++) {
        const axial = (s - 3) * 0.33 * bLen * (1 - 0.45 * p.curl);
        const latWave = 0.075 * undulGain * bLen * Math.sin(p.gaitPh - s * 0.75) * (1 - p.curl);
        const sx = p.x + cf * axial - sf * latWave;
        const sz = p.z + sf * axial + cf * latWave;
        p.segX[s] = sx;
        p.segZ[s] = sz;
        p.segY[s] = W.height(sx, sz) + (0.25 + 0.04 * Math.abs(Math.cos(p.gaitPh + s * 0.5))) * p.scale;
      }
    }

    // Colony Kuramoto gait/phase order parameter R = |1/N sum exp(i * gaitPh)|
    if (this.peers.length > 0) {
      let cSum = 0, sSum = 0;
      for (let i = 0; i < this.peers.length; i++) {
        cSum += Math.cos(this.peers[i].gaitPh);
        sSum += Math.sin(this.peers[i].gaitPh);
      }
      this.colonyOrderR = Math.hypot(cSum, sSum) / this.peers.length;
    }

    // 4b) Bedau-Packard (1998) Cumulative Evolutionary Activity vs Matched Neutral Shadow Population (`T11`)
    this._bedauAcc += dt;
    if (this._bedauAcc >= 1.0) {
      this._bedauAcc -= 1.0;
      for (let i = 0; i < this.neutralShadowPeers.length; i++) {
        this.neutralShadowPeers[i].age += 1.0;
        this.neutralShadowPeers[i].mateCooldown = Math.max(0, this.neutralShadowPeers[i].mateCooldown - 1.0);
      }
      const evalPopActivity = (pop, map) => {
        const nTot = pop.length;
        if (!nTot) return 0;
        const counts = new Map();
        for (let i = 0; i < nTot; i++) {
          const alleles = getAlleleClasses(pop[i].gen);
          for (let a = 0; a < alleles.length; a++) {
            counts.set(alleles[a], (counts.get(alleles[a]) || 0) + 1);
          }
        }
        for (const k of map.keys()) {
          if (!counts.has(k)) map.delete(k); // extinct allele class resets persistence!
        }
        let sumAct = 0;
        const c0 = 0.25; // Bedau, Snyder & Packard (1998, ALife VI Eq. 4) neutral drift baseline (2/K for K=8 octiles)
        for (const [k, cnt] of counts.entries()) {
          const conc = cnt / nTot;
          const delta = Math.max(0, conc - c0); // excess adaptive concentration increment above neutral baseline
          const aNew = (map.get(k) || 0) + delta;
          map.set(k, aNew);
          sumAct += conc * aNew;
        }
        return sumAct / 3.0; // mean over the 3 ecological adaptation loci
      };
      this.bedauActivity = evalPopActivity(this.peers, this.bedauRealMap);
      this.bedauNeutralActivity = evalPopActivity(this.neutralShadowPeers, this.bedauNeutralMap);
    }

    // 5) Step Multi-Kingdom Dome Beings (`Xenomimics`, `Xylos`, `Titans`, `Shoggoths`)
    this.stepMultiKingdomDome(dt, focalCreature, fHd);
  }

  /**
   * Initialize the 4 distinct non-Glitchling Multi-Kingdom Dome species using dedicated stream `this.rk`
   * (Bestiary Invariant: every kingdom has a distinct body plan, sensory manifold, and ecological niche!):
   *  - 4 Xenomimics (2 entangled +kappa / -kappa 4x4 density-matrix Bell twin pairs with zero-signaling CHSH game)
   *  - 4 Xylos (radial 6-group x 8 = 48 Poincaré-disk K=-1 hyperbolic geodesic gliders with 2-slot Global Workspace)
   *  - 3 Titans (armored geodesic litho-colossi with Press-Dyson Memory-1 IPD strategies & multilateral sanctions)
   *  - 2 Shoggoths (amorphous multi-tendril ambushers with Bayesian costly-signaling bargain/ambush game)
   */
  initMultiKingdomDome(opts = {}) {
    const rk = this.rk, W = this.world;

    // 1) 4 Xenomimics = 2 Entangled Twin Pairs (+kappa mimic & -kappa anti-mimic) sharing explicit 4x4 rho_AB(t)
    const nXenoPairs = opts.xenomimicPairs ?? (opts.xenomimics !== undefined ? Math.max(1, Math.floor(opts.xenomimics / 2)) : 2);
    this.xenoPairs = [];
    for (let pairId = 0; pairId < nXenoPairs; pairId++) {
      // Explicit 4x4 Bell-state density matrix |Phi+><Phi+| on {|00>, |01>, |10>, |11>}
      const rho4x4 = new Float64Array(16);
      rho4x4[0] = 0.485; rho4x4[15] = 0.485;
      rho4x4[5] = 0.015; rho4x4[10] = 0.015;
      rho4x4[3] = 0.470; rho4x4[12] = 0.470; // Wootters C = 2*0.47 - 2*0.015 = 0.91 -> CHSH S > 2.70!
      const met = evalTwoQubitBellMetrics(rho4x4);
      const pairState = {
        id: pairId,
        rho4x4,
        concurrence: met.concurrence,
        chshS: met.chshS,
        marginalBias: 0.0,
        chshTimer: 0.35 + 0.2 * pairId,
        lastWin: true,
        members: [],
      };
      this.xenoPairs.push(pairState);
      for (let signIdx = 0; signIdx < 2; signIdx++) {
        const kappaSign = signIdx === 0 ? 1 : -1;
        const ang = pairId * Math.PI + signIdx * 0.45 + 0.8;
        const dist = 6.8 + rk() * 5.0;
        const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
        const xm = {
          id: pairId * 2 + signIdx,
          pairId,
          pair: pairState,
          kappaSign,
          localPlant: (pairId * 5 + signIdx * 3 + Math.floor(rk() * SITES)) % SITES,
          lastA: 0,
          x, z,
          y: W.height(x, z) + 0.42,
          hdg: ang + kappaSign * 0.6,
          speed: 1.18,
          hue: pairId === 0 ? 0.50 : 0.84,
          mimicHue: pairId === 0 ? 0.50 : 0.84,
          energy: 0.82,
          ph: rk() * Math.PI * 2,
          phase: 0,
          chirality: signIdx === 0 ? 1 : -1,
          bellFidelity: pairState.concurrence,
          chshS: pairState.chshS,
          marginalBias: 0.0,
        };
        pairState.members.push(xm);
        this.xenomimics.push(xm);
      }
    }

    // 2) 4 Xylos Hyperbolic Poincaré-Disk Gliders (48 foci across 6 sensory groups -> true K=-1 poincareExpMap)
    const nXylos = opts.xylos ?? 4;
    for (let i = 0; i < nXylos; i++) {
      const ang = (i * Math.PI) / 2 + 0.35;
      const dist = 5.5 + rk() * 7.5;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const fociRel = new Float32Array(48);
      for (let f = 0; f < 48; f++) fociRel[f] = 0.5 + 0.5 * rk();
      const wx = 0.35 * Math.cos(ang), wy = 0.35 * Math.sin(ang);
      this.xylos.push({
        id: i,
        x, z,
        y: W.height(x, z) + 0.55,
        vx: 0, vz: 0,
        hdg: rk() * Math.PI * 2,
        fociAct: new Float32Array(48),
        fociRel,
        wx, wy,        // Exact 2D Poincaré-disk coordinate w = (wx, wy) in D^2 (|w| < 1)
        diskR: 0.35,   // Euclidean disk radius |w| < 0.98
        diskAng: ang,
        hyperbolicDist: poincareDist(0, 0, wx, wy), // 2 * artanh(|w|)
        slotA: 0,      // Winning Global Workspace slot 1 (0..5)
        slotB: 2,      // Winning Global Workspace slot 2 (0..5)
        energy: 0.85,
        hue: 0.30 + 0.08 * i,
        ph: rk() * Math.PI * 2,
      });
    }

    // 3) 3 Geopolitical Press-Dyson Memory-1 IPD Titans (Energy / Matter / Entropy ledgers + treaty matrix)
    const nTitans = opts.titans ?? 3;
    this.titanRelations = Array.from({ length: nTitans }, () => Array(nTitans).fill('truce'));
    this.titanLastMove = Array.from({ length: nTitans }, () => new Int8Array(nTitans).fill(-1));
    // Archetypal memory-1 stochastic IPD strategies [p0, p_CC, p_CD, p_DC, p_DD]:
    //  0: Generous Tit-for-Tat (Nowak & Sigmund 1992), 1: Firm-but-Fair (Frean 1994 contrite cooperator), 2: Opportunistic Raider (Defector)
    const baseStrats = [
      [0.96, 0.98, 0.32, 0.92, 0.25],
      [0.96, 0.98, 0.12, 0.94, 0.35],
      [0.12, 0.18, 0.06, 0.22, 0.08],
    ];
    for (let i = 0; i < nTitans; i++) {
      const ang = (i * Math.PI * 2) / 3 + 1.05;
      const dist = 10.5 + rk() * 3.5;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const st = baseStrats[i % 3];
      this.titans.push({
        id: i,
        archetype: i === 0 ? 'GTFT' : i === 1 ? 'FBF' : 'Defector',
        ipdStrat: new Float64Array(st),
        ipdPayoff: 0.0,
        ipdRounds: 0,
        coopMoves: 0,
        x, z,
        y: W.height(x, z) + 0.95,
        hdg: ang + Math.PI * 0.5,
        energy: 12.0,
        matter: 10.0,
        entropy: 1.0,
        trust: new Float32Array([0.65, 0.65, 0.65]),
        ipdTimer: 1.4 + i * 1.1, // staggered asynchronous diplomacy!
        stance: 'truce',
        shockwave: 0,
        ph: rk() * Math.PI * 2,
      });
    }

    // 4) 2 Bayesian Costly-Signaling Shoggoths (`meek = 1 - 0.6 * deceive`)
    const nShog = opts.shoggoths ?? 2;
    this.shoggothPriorD = 0.50; // Online Bayesian prior over Shoggoth deception rate
    for (let i = 0; i < nShog; i++) {
      const ang = i * Math.PI + 2.25;
      const dist = 9.2 + rk() * 4.5;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const isDeceptive = i === 0;
      this.shoggoths.push({
        id: i,
        x, z,
        y: W.height(x, z) + 0.38,
        hdg: rk() * Math.PI * 2,
        energy: 2.4,
        matter: 2.0,
        isDeceptive,
        deceiveProb: i === 0 ? 0.78 : 0.22,
        signalGlow: isDeceptive ? 0.42 : 0.78,
        deceive: isDeceptive ? 0.82 : 0.30,
        meek: 1 - 0.6 * (isDeceptive ? 0.82 : 0.30),
        bargainCooldown: 3.0,
        focalCooldown: 1.8 + i * 1.2,
        ph: rk() * Math.PI * 2,
      });
    }
  }

  stepMultiKingdomDome(dt, focalCreature, fHd) {
    const W = this.world, rk = this.rk;
    const storm = W.dome?.auroraStorm || 0;

    // A) Xenomimic Entangled Twin Pairs: Local Kraus Decoherence on 4x4 rho_AB(t) + Zero-Signaling CHSH Game (`T5`)
    const forceLHV = this.xenoClassicalSurrogate || !!focalCreature?.lesion?.xenoBell;
    for (let p = 0; p < this.xenoPairs.length; p++) {
      const pr = this.xenoPairs[p];
      const rho = pr.rho4x4;
      // Local independent qubit dephasing + isotropic Werner depolarizing Kraus channel (strictly trace- & marginal-preserving!)
      const gDeph = Math.exp(-dt * (0.006 + 0.032 * storm));
      const gDep = clamp(dt * (0.0025 + 0.014 * storm), 0, 0.25);
      rho[3] *= gDeph * (1 - gDep);
      rho[12] = rho[3];
      rho[5] = (1 - gDep) * rho[5] + 0.25 * gDep;
      rho[10] = rho[5];
      rho[0] = 0.5 - rho[5];
      rho[15] = rho[0];

      const met = evalTwoQubitBellMetrics(rho);
      pr.concurrence = forceLHV ? 0.0 : met.concurrence;
      pr.chshS = forceLHV ? 2.0 : met.chshS;
      pr.marginalBias = met.marginalBias < 1e-15 ? 0.0 : met.marginalBias;

      // Execute non-local CHSH game trial using strictly independent local settings (x at Twin A, y at Twin B)
      pr.chshTimer -= dt;
      if (pr.chshTimer <= 0 && pr.members.length === 2) {
        pr.chshTimer = 0.35;
        const x = rk() < 0.5 ? 0 : 1; // Twin A local binary setting
        const y = rk() < 0.5 ? 0 : 1; // Twin B local binary setting
        const trial = runCHSHDensityMatrixTrial(rho, x, y, rk(), rk(), forceLHV);
        pr.lastWin = trial.win;
        pr.members[0].lastA = trial.a;
        pr.members[1].lastA = trial.b;

        const C = this.chshStats;
        C.trials++;
        if (trial.win) C.wins++;
        C.counts[(x * 2 + y) * 4 + (trial.a * 2 + trial.b)]++;
        C.winRate = C.wins / C.trials;
        // Recompute empirical CHSH S & empirical No-Signaling max marginal discrepancy from 4x4 counts
        let sEmp = 0;
        const pA0GivenXY = new Float64Array(4), pB0GivenXY = new Float64Array(4);
        for (let xyIdx = 0; xyIdx < 4; xyIdx++) {
          const base = xyIdx * 4;
          const n00 = C.counts[base], n01 = C.counts[base + 1], n10 = C.counts[base + 2], n11 = C.counts[base + 3];
          const nTot = n00 + n01 + n10 + n11;
          if (nTot > 0) {
            const corr = (n00 + n11 - n01 - n10) / nTot;
            sEmp += xyIdx === 3 ? -corr : corr;
            pA0GivenXY[xyIdx] = (n00 + n01) / nTot;
            pB0GivenXY[xyIdx] = (n00 + n10) / nTot;
          }
        }
        C.empiricalS = sEmp;
        C.noSignalingMaxDiff = Math.max(
          Math.abs(pA0GivenXY[0] - pA0GivenXY[1]),
          Math.abs(pA0GivenXY[2] - pA0GivenXY[3]),
          Math.abs(pB0GivenXY[0] - pB0GivenXY[2]),
          Math.abs(pB0GivenXY[1] - pB0GivenXY[3])
        );
      }
    }
    for (let i = 0; i < this.xenomimics.length; i++) {
      const xm = this.xenomimics[i];
      const pr = xm.pair;
      xm.ph = (xm.ph + dt * 3.8) % (Math.PI * 2); // ~0.6 Hz (< 3 Hz safe)
      xm.phase = xm.ph;
      xm.chirality = xm.kappaSign;
      xm.bellFidelity = pr.concurrence;
      xm.chshS = pr.chshS;
      xm.marginalBias = pr.marginalBias;

      // Seek CEGA-18 Entanglement Forge (Monolith #2) when concurrence < 0.72; otherwise forage local plant (NO sharedTargetPlant mutation!)
      let tx = 0, tz = 0;
      const forge = W.monoliths?.[2] || W.monoliths?.[0];
      if (!forceLHV && forge && pr.concurrence < 0.72) {
        tx = forge.x; tz = forge.z;
        if (Math.hypot(xm.x - forge.x, xm.z - forge.z) < 2.4) {
          pr.rho4x4.fill(0);
          pr.rho4x4[0] = 0.5; pr.rho4x4[15] = 0.5;
          pr.rho4x4[3] = 0.5; pr.rho4x4[12] = 0.5; // exact purified |Phi+><Phi+|!
          pr.concurrence = 1.0;
          pr.chshS = 2 * Math.SQRT2;
          this.stats.forgePurifications++;
        }
      } else {
        const pl = W.plants[xm.localPlant % SITES];
        const arcSign = (xm.lastA === 0 ? 1 : -1) * xm.kappaSign;
        const flankAng = Math.atan2(pl.z - xm.z, pl.x - xm.x) + arcSign * (pr.lastWin ? 0.36 : 0.78);
        tx = xm.x + Math.cos(flankAng) * 3.0;
        tz = xm.z + Math.sin(flankAng) * 3.0;
        if (Math.hypot(pl.x - xm.x, pl.z - xm.z) < 1.15) {
          xm.energy = clamp(xm.energy + (pr.lastWin ? 0.20 : 0.11), 0.2, 1.2);
          xm.mimicHue = (0.32 + 0.12 * (pl.c || 0)) % 1; // chromatic mimicry of host flora!
          xm.localPlant = (xm.localPlant + 3 + Math.floor(rk() * 5)) % SITES;
        }
      }
      // Anti-correlated split when a Shadow-Leviathan approaches!
      for (let k = 0; k < this.predators.length; k++) {
        const lv = this.predators[k];
        const dl = Math.hypot(lv.x - xm.x, lv.z - xm.z);
        if (dl < 5.5) {
          const escAng = Math.atan2(xm.z - lv.z, xm.x - lv.x) + xm.kappaSign * (Math.PI * 0.42);
          tx = xm.x + Math.cos(escAng) * 5.0;
          tz = xm.z + Math.sin(escAng) * 5.0;
        }
      }
      const dAng = Math.atan2(Math.sin(Math.atan2(tz - xm.z, tx - xm.x) - xm.hdg), Math.cos(Math.atan2(tz - xm.z, tx - xm.x) - xm.hdg));
      xm.hdg += clamp(dAng, -2.6 * dt, 2.6 * dt);
      xm.x += Math.cos(xm.hdg) * xm.speed * dt;
      xm.z += Math.sin(xm.hdg) * xm.speed * dt;
      const b = W.enforceDomeBoundary(xm.x, xm.z, 0, 0, 1.2);
      xm.x = b.x; xm.z = b.z;
      xm.y = W.height(xm.x, xm.z) + 0.42 + 0.08 * Math.sin(xm.ph);
    }

    // B) Xylos 48-Foci Poincaré-Disk Manifold Gliders (True K=-1 Riemannian poincareExpMap + 2-slot Global Workspace)
    for (let i = 0; i < this.xylos.length; i++) {
      const xy = this.xylos[i];
      xy.ph = (xy.ph + dt * 2.6) % (Math.PI * 2);
      const sIdx = W.soilIndex(xy.x, xy.z);
      const nutr = (W.soilN[sIdx] + W.soilC[sIdx]) * 0.5;
      const haz = W.samplePheromone(xy.x, xy.z, 1);
      const pherF = W.samplePheromone(xy.x, xy.z, 0);
      const gx = W.soilN[W.soilIndex(xy.x + 1.5, xy.z)] - W.soilN[sIdx];
      const gz = W.soilN[W.soilIndex(xy.x, xy.z + 1.5)] - W.soilN[sIdx];
      const homeo = Math.max(0, 0.9 - xy.energy);
      const grpInputs = [nutr, haz, pherF, Math.abs(gx) * 3, Math.abs(gz) * 3, homeo];

      let bestA = 0, bestAScore = -1, bestB = 1, bestBScore = -1;
      let tvx = -0.35 * xy.wx, tvy = -0.35 * xy.wy; // geodesic centering pullback on D^2
      for (let g = 0; g < 6; g++) {
        let gSum = 0;
        for (let f = 0; f < 8; f++) {
          const idx = g * 8 + f;
          const act = Math.tanh(grpInputs[g] * (0.7 + 0.08 * f));
          xy.fociAct[idx] = 0.85 * xy.fociAct[idx] + 0.15 * act;
          xy.fociRel[idx] = clamp(xy.fociRel[idx] + dt * 0.02 * (1 - Math.abs(act - xy.fociAct[idx]) - 0.3), 0.2, 1.0);
          gSum += xy.fociAct[idx] * xy.fociRel[idx];
        }
        const rayAng = (g * Math.PI) / 3;
        tvx += 0.14 * gSum * Math.cos(rayAng);
        tvy += 0.14 * gSum * Math.sin(rayAng);
        if (gSum > bestAScore) { bestB = bestA; bestBScore = bestAScore; bestA = g; bestAScore = gSum; }
        else if (gSum > bestBScore) { bestB = g; bestBScore = gSum; }
      }
      xy.slotA = bestA;
      xy.slotB = bestB;
      xy.gwSlotA = bestA;
      xy.gwSlotB = bestB;

      // Exact K=-1 Riemannian exponential map Exp_w(dt * v) on Poincaré disk D^2 (`T6`)
      const wNext = poincareExpMap(xy.wx, xy.wy, tvx * dt, tvy * dt);
      const rRaw = Math.hypot(wNext[0], wNext[1]);
      if (rRaw > 0.94) {
        xy.wx = (wNext[0] / rRaw) * 0.94;
        xy.wy = (wNext[1] / rRaw) * 0.94;
      } else {
        xy.wx = wNext[0];
        xy.wy = wNext[1];
      }
      xy.diskR = clamp(Math.hypot(xy.wx, xy.wy), 0.04, 0.94);
      xy.hyperbolicDist = poincareDist(0, 0, xy.wx, xy.wy);
      const steerX = haz > 0.25 ? -gx : gx + 0.35 * Math.cos(xy.hdg);
      const steerZ = haz > 0.25 ? -gz : gz + 0.35 * Math.sin(xy.hdg);
      if (Math.hypot(steerX, steerZ) > 1e-3) {
        const tgtH = Math.atan2(steerZ, steerX);
        xy.hdg += clamp(Math.atan2(Math.sin(tgtH - xy.hdg), Math.cos(tgtH - xy.hdg)), -1.8 * dt, 1.8 * dt);
      } else {
        xy.hdg += (rk() - 0.5) * dt * 1.2;
      }
      xy.diskAng = Math.atan2(xy.wy, xy.wx);
      const spd = 0.78 * (1 + 0.35 * xy.diskR);
      xy.x += Math.cos(xy.hdg) * spd * dt;
      xy.z += Math.sin(xy.hdg) * spd * dt;
      const b = W.enforceDomeBoundary(xy.x, xy.z, 0, 0, 1.4);
      xy.x = b.x; xy.z = b.z;
      xy.y = W.height(xy.x, xy.z) + 0.52 + 0.10 * Math.sin(xy.ph);
      xy.energy = clamp(xy.energy + dt * (0.015 * nutr - 0.01), 0.25, 1.1);
      if (rk() < dt * 0.85) W.depositSlime(xy.x, xy.z, 0.55); // Physarum low-drag highway!
    }

    // C) Geopolitical Press-Dyson Memory-1 IPD Titans (Trembling-Hand Noise + Multilateral Sanctions + First-Law Heat)
    for (let i = 0; i < this.titans.length; i++) {
      const ti = this.titans[i];
      ti.treaty = this.titanRelations[i];
      ti.ph = (ti.ph + dt * 1.4) % (Math.PI * 2);
      ti.shockwave = Math.max(0, ti.shockwave - dt * 1.2);
      ti.ipdTimer -= dt;
      ti.hdg += dt * 0.09 * (i % 2 === 0 ? 1 : -1);
      ti.x += Math.cos(ti.hdg) * 0.34 * dt;
      ti.z += Math.sin(ti.hdg) * 0.34 * dt;
      const b = W.enforceDomeBoundary(ti.x, ti.z, 0, 0, 2.5);
      if (b.hit) ti.hdg += Math.PI * 0.65;
      ti.x = b.x; ti.z = b.z;
      ti.y = W.height(ti.x, ti.z) + 0.92;
      ti.entropy = clamp(ti.entropy + dt * 0.008, 0.2, 6.0);

      if (ti.ipdTimer <= 0) {
        ti.ipdTimer = 2.0 + rk() * 0.9;
        // Partner-choice weighted diplomacy: under multilateral sanctions, high-trust allies are favored over chronic defectors
        let j = (i + 1) % Math.max(1, this.titans.length);
        if (this.titans.length >= 3) {
          const j1 = (i + 1) % this.titans.length, j2 = (i + 2) % this.titans.length;
          const w1 = this.titanSanctionsEnabled ? (0.15 + ti.trust[j1]) : 0.5;
          const w2 = this.titanSanctionsEnabled ? (0.15 + ti.trust[j2]) : 0.5;
          j = rk() * (w1 + w2) < w1 ? j1 : j2;
        }
        if (j !== i && this.titans[j]) {
          const tj = this.titans[j];
          const prevI = this.titanLastMove[i][j], prevJ = this.titanLastMove[j][i];
          const idxI = prevI < 0 ? 0 : (prevI === 1 && prevJ === 1) ? 1 : (prevI === 1 && prevJ === 0) ? 2 : (prevI === 0 && prevJ === 1) ? 3 : 4;
          const idxJ = prevJ < 0 ? 0 : (prevJ === 1 && prevI === 1) ? 1 : (prevJ === 1 && prevI === 0) ? 2 : (prevJ === 0 && prevI === 1) ? 3 : 4;
          // Reputation-gated memory-1 probability (WSLS/GTFT forgive trembling-hand slips among trusted allies, guard against chronic raiders)
          const rawPI = (idxI === 4 && ti.trust[j] < 0.42) ? 0.04 : ti.ipdStrat[idxI];
          const rawPJ = (idxJ === 4 && tj.trust[i] < 0.42) ? 0.04 : tj.ipdStrat[idxJ];
          const pCoopI = 0.97 * rawPI + 0.03 * (1 - rawPI);
          const pCoopJ = 0.97 * rawPJ + 0.03 * (1 - rawPJ);
          const coopI = rk() < pCoopI ? 1 : 0;
          const coopJ = rk() < pCoopJ ? 1 : 0;
          this.titanLastMove[i][j] = coopI;
          this.titanLastMove[j][i] = coopJ;
          ti.ipdRounds++; tj.ipdRounds++;
          if (coopI) ti.coopMoves = (ti.coopMoves || 0) + 1;
          if (coopJ) tj.coopMoves = (tj.coopMoves || 0) + 1;

          // Canonical Axelrod IPD payoffs (T=0.50 > R=0.36 > P=0.08 > S=-0.12, 2R=0.72 > T+S=0.38) + Multilateral Coalition Embargo
          const sanction = this.titanSanctionsEnabled ? 0.30 : 0.0;
          if (coopI && coopJ) {
            this.titanRelations[i][j] = this.titanRelations[j][i] = 'alliance';
            ti.stance = tj.stance = 'alliance';
            ti.ipdPayoff += 0.36; tj.ipdPayoff += 0.36;
            ti.energy = Math.min(18.0, ti.energy + 0.16);
            tj.energy = Math.min(18.0, tj.energy + 0.16);
            ti.trust[j] = clamp(ti.trust[j] + 0.12, 0, 1);
            tj.trust[i] = clamp(tj.trust[i] + 0.12, 0, 1);
            const dM = Math.min(0.35, ti.matter * 0.04);
            ti.matter -= dM; tj.matter += dM;
            ti.entropy = Math.max(0.2, ti.entropy - 0.18);
            const sIdx = W.soilIndex(0.5 * (ti.x + tj.x), 0.5 * (ti.z + tj.z));
            if (W.fluxSoilN) W.fluxSoilN(sIdx, 0.18, 0);
            else W.soilN[sIdx] = Math.min(2.0, W.soilN[sIdx] + 0.18);
            this.stats.titanAlliances++;
          } else if (!coopI && !coopJ) {
            this.titanRelations[i][j] = this.titanRelations[j][i] = 'war';
            ti.stance = tj.stance = 'war';
            ti.shockwave = tj.shockwave = 1.0;
            // Ohtsuki-Iwasa standing-weighted coalition reputation of i & j determines multilateral embargo tariff
            let pubI = 0, wSumI = 0, pubJ = 0, wSumJ = 0;
            for (let k = 0; k < this.titans.length; k++) {
              const tk = this.titans[k];
              const standing = 0.20 + (tk.coopMoves || 0) / Math.max(1, tk.ipdRounds);
              if (k !== i) { pubI += standing * tk.trust[i]; wSumI += standing; }
              if (k !== j) { pubJ += standing * tk.trust[j]; wSumJ += standing; }
            }
            ti.ipdPayoff += (0.08 - ((pubI / Math.max(1e-6, wSumI)) < 0.44 ? sanction : 0));
            tj.ipdPayoff += (0.08 - ((pubJ / Math.max(1e-6, wSumJ)) < 0.44 ? sanction : 0));
            const loss = Math.min(0.45, ti.energy * 0.05, tj.energy * 0.05);
            ti.energy -= loss; tj.energy -= loss;
            W.transferEnergy?.(5, 9, loss * 0.04); // First-Law war attrition dissipated to Dome heatPhys!
            ti.entropy += 0.35; tj.entropy += 0.35;
            this.stats.titanWars++;
          } else {
            this.titanRelations[i][j] = this.titanRelations[j][i] = 'truce';
            ti.stance = 'truce';
            if (!coopI) {
              // i unilaterally defected on cooperative j: gains T=0.50 minus multilateral coalition embargo & image-scoring broadcast!
              ti.ipdPayoff += (0.50 - sanction);
              tj.ipdPayoff -= 0.12;
              tj.trust[i] = Math.max(0.08, tj.trust[i] - 0.24);
              if (this.titanSanctionsEnabled) {
                for (let k = 0; k < this.titans.length; k++) {
                  if (k !== i && k !== j) this.titans[k].trust[i] = Math.max(0.08, this.titans[k].trust[i] - 0.14);
                }
              }
            } else {
              tj.ipdPayoff += (0.50 - sanction);
              ti.ipdPayoff -= 0.12;
              ti.trust[j] = Math.max(0.08, ti.trust[j] - 0.24);
              if (this.titanSanctionsEnabled) {
                for (let k = 0; k < this.titans.length; k++) {
                  if (k !== j && k !== i) this.titans[k].trust[j] = Math.max(0.08, this.titans[k].trust[j] - 0.14);
                }
              }
            }
          }
        }
      }
    }

    // D) Bayesian Costly-Signaling Shoggoths (`meek = 1 - 0.6 * deceive` + Level-2 ToM vs Level-0 Naive Bargain/Ambush)
    for (let i = 0; i < this.shoggoths.length; i++) {
      const sh = this.shoggoths[i];
      sh.ph = (sh.ph + dt * 3.1) % (Math.PI * 2);
      sh.bargainCooldown = Math.max(0, sh.bargainCooldown - dt);
      sh.focalCooldown = Math.max(0, (sh.focalCooldown || 0) - dt);

      let nearTitan = null, dTitan = 1e9;
      for (let t = 0; t < this.titans.length; t++) {
        const d = Math.hypot(this.titans[t].x - sh.x, this.titans[t].z - sh.z);
        if (d < dTitan) { dTitan = d; nearTitan = this.titans[t]; }
      }
      sh.deceive = sh.isDeceptive ? (dTitan < 7.0 ? 0.95 : 0.80) : 0.25;
      sh.meek = 1.0 - 0.6 * sh.deceive;

      if (nearTitan && dTitan < 3.6 && sh.bargainCooldown <= 0 && sh.matter > 0.35 && nearTitan.energy > 2.0) {
        sh.matter -= 0.25;
        nearTitan.matter += 0.25;
        nearTitan.energy -= 0.25;
        sh.energy += 0.25;
        sh.bargainCooldown = 8.0;
        this.stats.shoggothBargains++;
      }

      // Costly-signaling encounter with focal creature (`T10`):
      // Cooperative Shoggoth emits costly high bioluminescence s ~ N(0.76, 0.11^2);
      // Deceptive Shoggoth feigns meekness with weaker counterfeit glow s ~ N(0.42, 0.13^2).
      if (focalCreature && sh.focalCooldown <= 0) {
        const dFoc = Math.hypot(fHd[0] - sh.x, fHd[2] - sh.z);
        if (dFoc < 6.8) {
          sh.focalCooldown = 2.6;
          const sig = clamp((sh.isDeceptive ? 0.42 : 0.76) + (sh.isDeceptive ? 0.13 : 0.11) * gauss(rk), 0, 1);
          sh.signalGlow = sig;
          const level2ToM = !focalCreature.lesion?.heptarch && !focalCreature.lesion?.metacog;
          let accept = false;
          if (level2ToM) {
            // Exact Bayesian likelihood ratio inversion with online Beta-updated deception prior!
            const piD = clamp(this.shoggothPriorD, 0.10, 0.90);
            const lD = Math.exp(-0.5 * ((sig - 0.42) / 0.13) ** 2) / 0.13;
            const lC = Math.exp(-0.5 * ((sig - 0.76) / 0.11) ** 2) / 0.11;
            const postD = (piD * lD) / (piD * lD + (1 - piD) * lC + 1e-12);
            // Expected utility E[U(accept) | s] = (1 - postD)*(+0.24) + postD*(-0.36) > 0  <=>  postD < 0.40
            accept = postD < 0.40;
          } else {
            // Level-0 naive surface-posture trust: fooled by submissive `meek` posture (`meek < 0.72` or `sig > 0.22`)!
            accept = sh.meek < 0.72 || sig > 0.22;
          }
          if (accept) {
            this.stats.shoggothBargains++;
            if (sh.isDeceptive) {
              this.stats.shoggothAmbushes++;
              this.stats.shoggothNetPayoff -= 0.36;
              focalCreature.nociception = Math.max(focalCreature.nociception || 0, 0.42);
              W.transferEnergy?.(4, 9, 0.06); // ATP ambush loss dissipated conservatively to heatPhys!
              this.shoggothPriorD = clamp(0.85 * this.shoggothPriorD + 0.15 * 1.0, 0.10, 0.90);
            } else {
              this.stats.shoggothCooperativeGains++;
              this.stats.shoggothNetPayoff += 0.24;
              focalCreature.metab?.eat('sugar', 0.20);
              this.shoggothPriorD = clamp(0.85 * this.shoggothPriorD + 0.15 * 0.0, 0.10, 0.90);
            }
          } else {
            this.stats.shoggothEvasions++;
          }
          // Re-draw Shoggoth hidden type for next encounter
          sh.isDeceptive = rk() < sh.deceiveProb;
        }
      }

      // Shoggoths move gently toward nearby prey/bargain partners unless repelled by Big-Tree Sanctuary Refuges
      let vx = Math.cos(sh.hdg) * 0.72, vz = Math.sin(sh.hdg) * 0.72;
      if (focalCreature) {
        const dfx = fHd[0] - sh.x, dfz = fHd[2] - sh.z, dfd = Math.hypot(dfx, dfz);
        if (dfd > 3.2 && dfd < 14.0) {
          vx += (dfx / dfd) * 0.38;
          vz += (dfz / dfd) * 0.38;
        }
      }
      if (this.refugeImmunityEnabled && W.sanctuaries) {
        for (let s = 0; s < W.sanctuaries.length; s++) {
          const sc = W.sanctuaries[s];
          const dx = sh.x - sc.x, dz = sh.z - sc.z, d = Math.hypot(dx, dz);
          if (d < sc.r + 0.8 && d > 1e-3) {
            vx += (dx / d) * 1.8;
            vz += (dz / d) * 1.8;
          }
        }
      }
      sh.hdg = Math.atan2(vz, vx) + (rk() - 0.5) * dt * 0.9;
      sh.x += Math.cos(sh.hdg) * 0.72 * dt;
      sh.z += Math.sin(sh.hdg) * 0.72 * dt;
      const b = W.enforceDomeBoundary(sh.x, sh.z, 0, 0, 1.4);
      sh.x = b.x; sh.z = b.z;
      sh.y = W.height(sh.x, sh.z) + 0.36;
    }
  }
}
