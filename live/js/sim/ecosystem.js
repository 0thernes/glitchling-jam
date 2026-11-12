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

export const LIFE_STAGES = ['neonate', 'juvenile', 'adult', 'elder'];
export const COLONY_CASTES = ['Sovereign α', 'Harvester β', 'Sentinel γ', 'Weaver δ', 'Disruptor ε'];

/** Normalized genetic distance across key bauplan & pigment loci + assortative speciation gate */
export function canAssortativeMate(genA, genB, hoxA, hoxB) {
  const iso = 0.5 * ((genA.speciationIso ?? 0.35) + (genB.speciationIso ?? 0.35));
  if (hoxA && hoxB && hoxA.limbPairs !== hoxB.limbPairs) {
    const pairDiff = Math.abs(hoxA.limbPairs - hoxB.limbPairs);
    // Strong assortative reproductive isolation blocks cross-clade mating when speciationIso is high
    if (iso > 0.62 || (pairDiff >= 2 && iso > 0.44)) return false;
  }
  const dHue = Math.min(Math.abs((genA.pigmentHue ?? 0.5) - (genB.pigmentHue ?? 0.5)), 1 - Math.abs((genA.pigmentHue ?? 0.5) - (genB.pigmentHue ?? 0.5)));
  const dBody = Math.abs((genA.bodyLen ?? 1.0) - (genB.bodyLen ?? 1.0));
  const genDist = 0.6 * dHue + 0.4 * dBody;
  return genDist <= (0.88 - 0.52 * iso);
}

/** Diploid Simulated Binary Crossover (SBX) + bounded polynomial mutation over all 128 developmental, Zygote & Hox GRN genes */
export function crossoverGenomes(genA, genB, r, mutRate = 0.14, etaC = 4.0) {
  const child = {};
  for (let i = 0; i < FULL_GENES.length; i++) {
    const [nm, lo, hi] = FULL_GENES[i];
    const span = hi - lo;
    const ua = clamp(((genA[nm] ?? STARTER[nm] ?? (lo + hi) * 0.5) - lo) / span, 0, 1);
    const ub = clamp(((genB[nm] ?? STARTER[nm] ?? (lo + hi) * 0.5) - lo) / span, 0, 1);
    let u;
    if (r() < 0.85 && Math.abs(ua - ub) > 1e-6) {
      const uRand = Math.min(0.9999, Math.max(1e-4, r()));
      const beta = uRand <= 0.5
        ? Math.pow(2 * uRand, 1 / (etaC + 1))
        : Math.pow(1 / (2 * (1 - uRand)), 1 / (etaC + 1));
      const c1 = 0.5 * ((1 + beta) * ua + (1 - beta) * ub);
      const c2 = 0.5 * ((1 - beta) * ua + (1 + beta) * ub);
      u = r() < 0.5 ? c1 : c2;
    } else {
      u = r() < 0.5 ? ua : ub;
    }
    if (r() < mutRate) {
      u += 0.11 * gauss(r);
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
    let u = (base - lo) / (hi - lo) + spread * (r() - 0.5);
    // Give wild conspecifics rich 5-clade macro-evolutionary, patagium, angler-lure & pigment diversity right from generation 0
    if (nm === 'pigmentHue') u = r();
    else if (nm === 'crestFin' || nm === 'tailFluke') u = clamp(0.15 + 0.75 * r(), 0.05, 0.95);
    else if (nm === 'bodyLen' || nm === 'bodyGirth' || nm === 'foreLimb' || nm === 'hindLimb') u = clamp(0.5 + 0.55 * (r() - 0.5), 0.1, 0.9);
    else if (nm === 'limbTopo' || nm === 'cladeGene') u = clamp(0.04 + 0.92 * r(), 0.03, 0.97); // wild 0L/4L/6L/8L/10L 5-clade radiation!
    else if (nm === 'patagiumGene' || nm === 'anglerLure') u = clamp(0.08 + 0.84 * r(), 0.04, 0.96);
    else if (nm === 'speciationIso') u = clamp(0.18 + 0.62 * r(), 0.10, 0.90);
    else if (nm === 'osteoderm' || nm === 'gillFronds') u = clamp(0.15 + 0.75 * r(), 0.05, 0.95);
    g[nm] = +(lo + clamp(u, 0.03, 0.97) * (hi - lo)).toFixed(4);
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
    this.refugeImmunityEnabled = opts.refugeImmunityEnabled ?? true; // causal switch for V4 4-arm sanctuary audit
    this.rk = mulberry((seed * 15401 + 73) >>> 0); // dedicated Multi-Kingdom RNG stream (keeps `this.r` untouched!)
    this.cladeCounts = { '0L': 0, '4L': 0, '6L': 0, '8L': 0, '10L': 0 };
    this.casteCounts = { 'Sovereign α': 0, 'Harvester β': 0, 'Sentinel γ': 0, 'Weaver δ': 0, 'Disruptor ε': 0 };
    this.colonyOrderR = 0.5;
    this.speciesCount = 1;
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
      sanctuarySaves: 0,
      predations: 0,
      devourSalvages: 0,
      forgePurifications: 0,
      titanAlliances: 0,
      titanWars: 0,
      shoggothBargains: 0,
    };

    world.coEvolvePlants = true;
    world.eco = this;

    for (let i = 0; i < initPeers; i++) this.spawnPeer(null, null, true);
    for (let i = 0; i < initMites; i++) this.spawnMite();
    for (let i = 0; i < initPreds; i++) this.spawnPredator();
    this.initMultiKingdomDome(opts);
  }

  spawnPeer(gen = null, pos = null, adultStart = false, meta = {}) {
    const r = this.r, W = this.world;
    if (this.peers.length >= this.maxPeers) {
      // Recycle oldest elder biomass into soil nutrients to sustain open-ended generational turnover
      let oldestIdx = 0, bestAge = -1;
      for (let i = 0; i < this.peers.length; i++) {
        if (this.peers[i].age > bestAge) { bestAge = this.peers[i].age; oldestIdx = i; }
      }
      const old = this.peers.splice(oldestIdx, 1)[0];
      if (old) {
        const si = W.soilIndex(old.x, old.z);
        W.soilN[si] = Math.min(2.0, W.soilN[si] + 0.35);
        W.soilC[si] = Math.min(2.0, W.soilC[si] + 0.40);
        W.transferEnergy?.(5, 8, 0.35);
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
      tempOpt: 25.0 + 4.0 * (childGen.thermOpt ?? 0),
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
          checkPrey(p.x, p.z, p.camo, p.curl, p.deceive || 0);
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
      // Deterministic Leviathan wake ploughs soil strata slightly without touching `this.r`!
      const sIdxPr = W.soilIndex(pr.x, pr.z);
      W.soilN[sIdxPr] = Math.min(2.0, W.soilN[sIdxPr] + dt * 0.008);

      // Close swoop startles focal creature or peer -> releases Schreckstoff alarm pheromone & resets predator cooldown!
      if (focalCreature) {
        const df = Math.hypot(pr.x - fHd[0], pr.z - fHd[2]);
        const safeInRefuge = this.refugeImmunityEnabled && W.isInsideSanctuary?.(fHd[0], fHd[2]);
        if (df < 2.2 && pr.cooldown <= 0 && !safeInRefuge) {
          pr.cooldown = 14.0;
          W.depositPheromone(fHd[0], fHd[2], 1, 2.2); // Schreckstoff alarm burst!
          focalCreature.nociception = Math.max(focalCreature.nociception, 0.65);
          focalCreature.heptarch?.inflictLimbTrauma(Math.floor(this.rk() * 6), 0.26);
          focalCreature.vocalFreq = 680;
          focalCreature.vocalAmp = 0.9;
          this.stats.alarmCalls++;
          this.stats.predations++;
          focalCreature.ev('alarm', 'Shadow-Leviathan swooped — limb V_mem depolarized & Schreckstoff emitted!');
        } else if (df < 2.2 && safeInRefuge) {
          this.stats.sanctuarySaves++;
        }
      }
      for (let k = 0; k < this.peers.length; k++) {
        const p = this.peers[k];
        if (Math.hypot(pr.x - p.x, pr.z - p.z) < 2.0 && pr.cooldown <= 0) {
          if (this.refugeImmunityEnabled && W.isInsideSanctuary?.(p.x, p.z)) {
            this.stats.sanctuarySaves++;
            continue;
          }
          pr.cooldown = 12.0;
          p.energy = Math.max(0.2, p.energy - 0.12);
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
      eg.progress += (dt / 26.0) * thermRate; // ~20-28 s incubation
      if (eg.progress >= 1.0) {
        this.eggs.splice(i, 1);
        const neo = this.spawnPeer(eg.gen, [eg.x, eg.z], false, {
          parentA: eg.parentA,
          parentB: eg.parentB,
          generation: eg.generation,
        });
        this.stats.births++;
        if (focalCreature && eg.focalInvolved) {
          focalCreature.ev('hatch', `offspring #${neo.id} (gen ${neo.generation}) hatched from incubated egg!`);
        }
      }
    }

    // 4) Step Autonomous Conspecific Glitchlings (`peers`) + Diploid Courtship & Breeding
    for (let i = 0; i < this.peers.length; i++) {
      const p = this.peers[i];
      p.age += dt;
      p.stage = p.age < 22 ? 'neonate' : p.age < 50 ? 'juvenile' : p.age < 260 ? 'adult' : 'elder';
      const targetScale = p.stage === 'neonate' ? 0.48 + 0.012 * p.age : p.stage === 'juvenile' ? 0.74 + 0.009 * (p.age - 22) : p.stage === 'elder' ? 0.96 : 1.0;
      p.scale += (targetScale - p.scale) * Math.min(1, dt * 1.5);

      p.energy = clamp(p.energy - dt * 0.0045, 0.05, 1.2);
      p.hydration = clamp(p.hydration - dt * 0.0035, 0.05, 1.1);
      p.mateCooldown = Math.max(0, p.mateCooldown - dt);
      p.courtship = Math.max(0, p.courtship - dt * 0.6);
      p.vocalAmp = Math.max(0, p.vocalAmp - dt * 1.4);
      p.goalTimer -= dt;

      const tAmb = W.ambientTemp(p.x, p.z, hour);
      const tPref = 22.5 + 4.5 * (p.gen.thermOpt ?? 0);
      p.bodyTemp += (tAmb + 1.8 - p.bodyTemp) * Math.min(1, dt * 0.35);

      // Alarm & predator check (Sentinel gamma has extended 8.8u perimeter radar & RS[15,11] burst-proof acoustic broadcast!)
      p.rsCooldown = Math.max(0, (p.rsCooldown || 0) - dt);
      const vigRange = p.casteId === 2 ? 8.8 : 6.5;
      let predNear = 0, seenPred = null;
      for (let q = 0; q < this.predators.length; q++) {
        const pr = this.predators[q];
        const dp = Math.hypot(pr.x - p.x, pr.z - p.z);
        if (dp < vigRange && 1 - dp / vigRange > predNear) {
          predNear = 1 - dp / vigRange;
          seenPred = pr;
        }
      }
      if (p.casteId === 2 && seenPred && predNear > 0.22 && p.rsCooldown <= 0) {
        p.rsCooldown = 5.5;
        // Encode RS[15,11] Neuralese alarm call, corrupt up to 2 symbols with storm/misfire noise, and decode at focal/peers!
        const txCw = encodeAcousticCallRS(1, seenPred.x, seenPred.z, predNear, p.casteId);
        const rxCw = Uint8Array.from(txCw);
        const stormErrs = (W.dome?.auroraStorm || 0) > 0.15 ? 2 : 1;
        for (let e = 0; e < stormErrs; e++) {
          const pos = Math.floor(this.rk() * 15);
          rxCw[pos] ^= (1 + Math.floor(this.rk() * 15)) & 0x0f;
        }
        const dec = decodeAcousticCallRS(rxCw);
        this.stats.rsCallsSent++;
        this.stats.rsSymbolsRepaired += dec.correctedSymbols;
        if (dec.ok) {
          W.depositPheromone(dec.x, dec.z, 1, 1.35 * dec.urgency);
          if (focalCreature?.heptarch) {
            focalCreature.heptarch.rsFramesDecoded++;
            focalCreature.heptarch.rsSymbolsRepaired += dec.correctedSymbols;
          }
        }
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
      const threat = Math.max(predNear, clamp(alarmConc * 0.6, 0, 1));
      p.camo += ((threat > 0.25 ? 0.9 : 0.08) - p.camo) * Math.min(1, dt * 2.5);
      p.curl += ((threat > 0.68 ? 0.9 : 0) - p.curl) * Math.min(1, dt * 3.0);

      // Goal selection: flee to shelter > thermal basking > water > courtship > foraging
      if (threat > 0.32 && W.shelters.length) {
        let bestS = W.shelters[0], bd = 1e9;
        for (const sh of W.shelters) {
          const d = Math.hypot(sh.x - p.x, sh.z - p.z);
          if (d < bd) { bd = d; bestS = sh; }
        }
        p.goalX = bestS.x; p.goalZ = bestS.z; p.goalType = 'shelter';
      } else if (p.bodyTemp < tPref - 3.2 && W.vents.length) {
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
      } else if (p.stage === 'adult' && p.energy > 0.58 && p.mateCooldown <= 0) {
        // Emit sex/kin pheromone & seek nearest receptive adult (focal creature or conspecific)
        W.depositPheromone(p.x, p.z, 2, dt * 0.9);
        let mateX = null, mateZ = null, mateRef = null, bd = 14.0;
        if (focalCreature && focalCreature.sleep.stage === 0 && focalCreature.metab.hunger() < 0.65 && (focalCreature.mateCooldown || 0) <= 0) {
          const df = Math.hypot(fHd[0] - p.x, fHd[2] - p.z);
          if (df < bd && canAssortativeMate(p.gen, focalCreature.gen, p.hox, focalCreature.body?.hox)) {
            bd = df; mateX = fHd[0]; mateZ = fHd[2]; mateRef = 'focal';
          }
        }
        for (let j = 0; j < this.peers.length; j++) {
          if (j === i) continue;
          const pj = this.peers[j];
          if (pj.stage !== 'adult' || pj.energy < 0.52 || pj.mateCooldown > 0) continue;
          const dj = Math.hypot(pj.x - p.x, pj.z - p.z);
          if (dj < bd && canAssortativeMate(p.gen, pj.gen, p.hox, pj.hox)) {
            bd = dj; mateX = pj.x; mateZ = pj.z; mateRef = pj;
          }
        }
        if (mateX !== null) {
          p.goalX = mateX; p.goalZ = mateZ; p.goalType = 'mate';
          if (bd < 2.25) {
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
              p.mateCooldown = 38;
              mateRef.mateCooldown = 38;
              p.energy -= 0.14;
              mateRef.energy -= 0.14;
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
      const strideGain = (0.55 + 0.35 * (p.gen.legSw ?? 1.0)) * (0.65 + 0.35 * p.scale) * patGlide * (1 - 0.7 * p.curl);
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
            p.energy = Math.min(1.15, p.energy + 0.32 * pl.sugarTrait);
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

    // 5) Step Multi-Kingdom Dome Beings (`Xenomimics`, `Xylos`, `Titans`, `Shoggoths`)
    this.stepMultiKingdomDome(dt, focalCreature, fHd);
  }

  /**
   * Initialize the 4 distinct non-Glitchling Multi-Kingdom Dome species using dedicated stream `this.rk`
   * (Bestiary Invariant: every kingdom has a distinct body plan, sensory manifold, and ecological niche!):
   *  - 4 Xenomimics (2 entangled +kappa / -kappa Bell twin pairs with zero-signaling Horodecki CHSH coordination)
   *  - 4 Xylos (radial 6-group x 8 = 48 Poincaré-disk hyperbolic manifold gliders with 2-slot Global Workspace)
   *  - 3 Titans (armored geodesic litho-colossi with Energy/Matter/Entropy ledgers & staggered IPD treaties/wars)
   *  - 2 Shoggoths (amorphous multi-tendril ambushers with `meek = 1 - 0.6 * deceive` & conservation-exact bargains)
   */
  initMultiKingdomDome(opts = {}) {
    const rk = this.rk, W = this.world;

    // 1) 4 Xenomimics = 2 Entangled Twin Pairs (+kappa mimic & -kappa anti-mimic)
    const nXenoPairs = opts.xenomimicPairs ?? 2;
    this.xenoPairs = [];
    for (let pairId = 0; pairId < nXenoPairs; pairId++) {
      const pairState = {
        id: pairId,
        concurrence: 0.94,                // Bell singlet concurrence C in [0..1]
        chshS: 2 * Math.sqrt(1 + 0.94 * 0.94), // Horodecki exact S_max = 2*sqrt(1 + C^2) > 2.0!
        marginalBias: 0.0,                // Tr_B(|Phi+><Phi+|) = I/2 -> strict zero superluminal signaling!
        sharedTargetPlant: Math.floor(rk() * SITES),
      };
      this.xenoPairs.push(pairState);
      for (let signIdx = 0; signIdx < 2; signIdx++) {
        const kappaSign = signIdx === 0 ? 1 : -1;
        const ang = pairId * Math.PI + signIdx * 0.45 + 0.8;
        const dist = 6.8 + rk() * 5.0;
        const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
        this.xenomimics.push({
          id: pairId * 2 + signIdx,
          pairId,
          pair: pairState,
          kappaSign,
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
          marginalBias: pairState.marginalBias,
        });
      }
    }

    // 2) 4 Xylos Hyperbolic Poincaré-Disk Gliders (48 foci across 6 sensory groups -> 2-slot Global Workspace)
    const nXylos = opts.xylos ?? 4;
    for (let i = 0; i < nXylos; i++) {
      const ang = (i * Math.PI) / 2 + 0.35;
      const dist = 5.5 + rk() * 7.5;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const fociRel = new Float32Array(48);
      for (let f = 0; f < 48; f++) fociRel[f] = 0.5 + 0.5 * rk();
      this.xylos.push({
        id: i,
        x, z,
        y: W.height(x, z) + 0.55,
        vx: 0, vz: 0,
        hdg: rk() * Math.PI * 2,
        fociAct: new Float32Array(48),
        fociRel,
        diskR: 0.35,   // Poincaré disk radial norm |w| < 0.98
        diskAng: ang,
        slotA: 0,      // Winning Global Workspace slot 1 (0..5)
        slotB: 2,      // Winning Global Workspace slot 2 (0..5)
        energy: 0.85,
        hue: 0.30 + 0.08 * i,
        ph: rk() * Math.PI * 2,
      });
    }

    // 3) 3 Geopolitical IPD Titans (Energy / Matter / Entropy ledgers + all-pairs treaty matrix)
    const nTitans = opts.titans ?? 3;
    this.titanRelations = Array.from({ length: nTitans }, () => Array(nTitans).fill('truce'));
    for (let i = 0; i < nTitans; i++) {
      const ang = (i * Math.PI * 2) / 3 + 1.05;
      const dist = 10.5 + rk() * 3.5;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      this.titans.push({
        id: i,
        x, z,
        y: W.height(x, z) + 0.95,
        hdg: ang + Math.PI * 0.5,
        energy: 12.0,
        matter: 10.0,
        entropy: 1.0,
        trust: new Float32Array([0.65, 0.65, 0.65]),
        ipdTimer: 2.0 + i * 1.8, // staggered asynchronous diplomacy!
        stance: 'truce',
        shockwave: 0,
        ph: rk() * Math.PI * 2,
      });
    }

    // 4) 2 Deceptive & Bargaining Shoggoths (`meek = 1 - 0.6 * deceive`)
    const nShog = opts.shoggoths ?? 2;
    for (let i = 0; i < nShog; i++) {
      const ang = i * Math.PI + 2.25;
      const dist = 9.2 + rk() * 4.5;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      this.shoggoths.push({
        id: i,
        x, z,
        y: W.height(x, z) + 0.38,
        hdg: rk() * Math.PI * 2,
        energy: 2.4,
        matter: 2.0,
        deceive: 0.75,
        meek: 1 - 0.6 * 0.75, // 0.55 emission/posture suppression!
        bargainCooldown: 3.0,
        ph: rk() * Math.PI * 2,
      });
    }
  }

  stepMultiKingdomDome(dt, focalCreature, fHd) {
    const W = this.world, rk = this.rk;
    const storm = W.dome?.auroraStorm || 0;

    // A) Xenomimic Entangled Twin Pairs (+kappa / -kappa opposite-curvature flanking & CEGA-18 Forge purification)
    for (let p = 0; p < this.xenoPairs.length; p++) {
      const pr = this.xenoPairs[p];
      pr.concurrence = clamp(pr.concurrence - dt * (0.008 + 0.035 * storm), 0.18, 1.0);
      pr.chshS = 2 * Math.sqrt(1 + pr.concurrence * pr.concurrence);
      pr.marginalBias = 0.0; // exact no-signaling reduced state I/2
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

      // Seek CEGA-18 Entanglement Forge (Monolith #2) when concurrence < 0.68; otherwise flank shared plant
      let tx = 0, tz = 0;
      const forge = W.monoliths?.[2] || W.monoliths?.[0];
      if (forge && pr.concurrence < 0.68) {
        tx = forge.x; tz = forge.z;
        if (Math.hypot(xm.x - forge.x, xm.z - forge.z) < 2.4) {
          pr.concurrence = 1.0;
          pr.chshS = 2 * Math.SQRT2;
          this.stats.forgePurifications++;
        }
      } else {
        const pl = W.plants[pr.sharedTargetPlant % SITES];
        // Silent CHSH-correlated opposite-chirality flanking offset (+kappa left arc vs -kappa right arc!)
        const flankAng = Math.atan2(pl.z - xm.z, pl.x - xm.x) + xm.kappaSign * 0.52 * pr.concurrence;
        tx = xm.x + Math.cos(flankAng) * 3.0;
        tz = xm.z + Math.sin(flankAng) * 3.0;
        if (Math.hypot(pl.x - xm.x, pl.z - xm.z) < 1.15) {
          xm.energy = clamp(xm.energy + 0.18, 0.2, 1.2);
          xm.mimicHue = (0.32 + 0.12 * (pl.c || 0)) % 1; // chromatic mimicry of host flora!
          if (xm.kappaSign > 0) pr.sharedTargetPlant = (pr.sharedTargetPlant + 3 + Math.floor(rk() * 5)) % SITES;
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

    // B) Xylos 48-Foci Poincaré-Disk Manifold Gliders (2-slot Global Workspace + Physarum Slime Deposition)
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
      for (let g = 0; g < 6; g++) {
        let gSum = 0;
        for (let f = 0; f < 8; f++) {
          const idx = g * 8 + f;
          const act = Math.tanh(grpInputs[g] * (0.7 + 0.08 * f));
          xy.fociAct[idx] = 0.85 * xy.fociAct[idx] + 0.15 * act;
          xy.fociRel[idx] = clamp(xy.fociRel[idx] + dt * 0.02 * (1 - Math.abs(act - xy.fociAct[idx]) - 0.3), 0.2, 1.0);
          gSum += xy.fociAct[idx] * xy.fociRel[idx];
        }
        if (gSum > bestAScore) { bestB = bestA; bestBScore = bestAScore; bestA = g; bestAScore = gSum; }
        else if (gSum > bestBScore) { bestB = g; bestBScore = gSum; }
      }
      xy.slotA = bestA;
      xy.slotB = bestB;
      xy.gwSlotA = bestA;
      xy.gwSlotB = bestB;

      // Möbius-like hyperbolic disk radial drift |w| in [0.1, 0.94]
      xy.diskR = clamp(0.88 * xy.diskR + 0.12 * Math.tanh(0.45 * (bestAScore + bestBScore)), 0.08, 0.94);
      const steerX = haz > 0.25 ? -gx : gx + 0.35 * Math.cos(xy.hdg);
      const steerZ = haz > 0.25 ? -gz : gz + 0.35 * Math.sin(xy.hdg);
      if (Math.hypot(steerX, steerZ) > 1e-3) {
        const tgtH = Math.atan2(steerZ, steerX);
        xy.hdg += clamp(Math.atan2(Math.sin(tgtH - xy.hdg), Math.cos(tgtH - xy.hdg)), -1.8 * dt, 1.8 * dt);
      } else {
        xy.hdg += (rk() - 0.5) * dt * 1.2;
      }
      xy.diskAng = xy.hdg;
      const spd = 0.78 * (1 + 0.35 * xy.diskR);
      xy.x += Math.cos(xy.hdg) * spd * dt;
      xy.z += Math.sin(xy.hdg) * spd * dt;
      const b = W.enforceDomeBoundary(xy.x, xy.z, 0, 0, 1.4);
      xy.x = b.x; xy.z = b.z;
      xy.y = W.height(xy.x, xy.z) + 0.52 + 0.10 * Math.sin(xy.ph);
      xy.energy = clamp(xy.energy + dt * (0.015 * nutr - 0.01), 0.25, 1.1);
      if (rk() < dt * 0.85) W.depositSlime(xy.x, xy.z, 0.55); // Physarum low-drag highway!
    }

    // C) Geopolitical IPD Titans (Energy / Matter / Entropy ledgers + Truce / Alliance / War treaties)
    for (let i = 0; i < this.titans.length; i++) {
      const ti = this.titans[i];
      ti.treaty = this.titanRelations[i];
      ti.ph = (ti.ph + dt * 1.4) % (Math.PI * 2);
      ti.shockwave = Math.max(0, ti.shockwave - dt * 1.2);
      ti.ipdTimer -= dt;
      // Slow majestic geodesic patrol
      ti.hdg += dt * 0.09 * (i % 2 === 0 ? 1 : -1);
      ti.x += Math.cos(ti.hdg) * 0.34 * dt;
      ti.z += Math.sin(ti.hdg) * 0.34 * dt;
      const b = W.enforceDomeBoundary(ti.x, ti.z, 0, 0, 2.5);
      if (b.hit) ti.hdg += Math.PI * 0.65;
      ti.x = b.x; ti.z = b.z;
      ti.y = W.height(ti.x, ti.z) + 0.92;
      ti.entropy = clamp(ti.entropy + dt * 0.008, 0.2, 6.0);

      if (ti.ipdTimer <= 0) {
        ti.ipdTimer = 5.2 + rk() * 2.0;
        const j = (i + 1 + Math.floor(rk() * (this.titans.length - 1))) % Math.max(1, this.titans.length);
        if (j !== i && this.titans[j]) {
          const tj = this.titans[j];
          // Tit-for-Tat with forgiveness & resource-scarcity temptation
          const coopI = ti.trust[j] > 0.42 && ti.energy > 3.5;
          const coopJ = tj.trust[i] > 0.42 && tj.energy > 3.5;
          if (coopI && coopJ) {
            this.titanRelations[i][j] = this.titanRelations[j][i] = 'alliance';
            ti.stance = tj.stance = 'alliance';
            ti.trust[j] = clamp(ti.trust[j] + 0.12, 0, 1);
            tj.trust[i] = clamp(tj.trust[i] + 0.12, 0, 1);
            // Mutual trade & mineral fertilization
            const dM = Math.min(0.35, ti.matter * 0.04);
            ti.matter -= dM; tj.matter += dM;
            ti.entropy = Math.max(0.2, ti.entropy - 0.18);
            const sIdx = W.soilIndex(0.5 * (ti.x + tj.x), 0.5 * (ti.z + tj.z));
            W.soilN[sIdx] = Math.min(2.0, W.soilN[sIdx] + 0.18);
            this.stats.titanAlliances++;
          } else if (!coopI && !coopJ) {
            this.titanRelations[i][j] = this.titanRelations[j][i] = 'war';
            ti.stance = tj.stance = 'war';
            ti.shockwave = tj.shockwave = 1.0;
            // Conservative war attrition -> dome heatPhys!
            const loss = Math.min(0.45, ti.energy * 0.05, tj.energy * 0.05);
            ti.energy -= loss; tj.energy -= loss;
            ti.entropy += 0.35; tj.entropy += 0.35;
            this.stats.titanWars++;
            // Multilateral war sanction: 3rd Titan lowers trust in aggressors!
            for (let k = 0; k < this.titans.length; k++) {
              if (k !== i && k !== j) {
                this.titans[k].trust[i] = Math.max(0.15, this.titans[k].trust[i] - 0.08);
                this.titans[k].trust[j] = Math.max(0.15, this.titans[k].trust[j] - 0.08);
              }
            }
          } else {
            this.titanRelations[i][j] = this.titanRelations[j][i] = 'truce';
            ti.stance = 'truce';
            if (!coopI) tj.trust[i] = Math.max(0.1, tj.trust[i] - 0.22);
            if (!coopJ) ti.trust[j] = Math.max(0.1, ti.trust[j] - 0.22);
          }
        }
      }
    }

    // D) Amorphous Deceptive & Bargaining Shoggoths (`meek = 1 - 0.6 * deceive`)
    for (let i = 0; i < this.shoggoths.length; i++) {
      const sh = this.shoggoths[i];
      sh.ph = (sh.ph + dt * 3.1) % (Math.PI * 2);
      sh.bargainCooldown = Math.max(0, sh.bargainCooldown - dt);

      // Check proximity to dominant Titans -> adopt high-deceive `meek` posture & strike conservation-exact bargain!
      let nearTitan = null, dTitan = 1e9;
      for (let t = 0; t < this.titans.length; t++) {
        const d = Math.hypot(this.titans[t].x - sh.x, this.titans[t].z - sh.z);
        if (d < dTitan) { dTitan = d; nearTitan = this.titans[t]; }
      }
      sh.deceive = dTitan < 7.0 ? 0.95 : 0.65 + 0.25 * Math.sin(this.t * 0.25 + i);
      sh.meek = 1.0 - 0.6 * sh.deceive; // Raider Cold-Strike origin: [0.43 .. 1.0]

      if (nearTitan && dTitan < 3.6 && sh.bargainCooldown <= 0 && sh.matter > 0.35 && nearTitan.energy > 2.0) {
        // Exact conservation bargain: Shoggoth trades 0.25 matter to Titan in exchange for 0.25 energy!
        sh.matter -= 0.25;
        nearTitan.matter += 0.25;
        nearTitan.energy -= 0.25;
        sh.energy += 0.25;
        sh.bargainCooldown = 8.0;
        this.stats.shoggothBargains++;
      }

      // Shoggoths are repelled by Big-Tree Sanctuary Refuges!
      let vx = Math.cos(sh.hdg) * 0.72, vz = Math.sin(sh.hdg) * 0.72;
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
