// Open-Ended Multi-Agent A-Life Biosphere (pass 18):
//  - Up to 32 Autonomous Conspecific Glitchlings (`peers`) with heritable 108-gene Hox + Morphogen Evo-Devo genomes
//    (expressing variable 4-limb quadruped, 6-limb hexapod, and 8-limb octopod topologies + dorsal osteoderms),
//    articulated 7-segment 3D bodies, chemotactic pheromone navigation, foraging, drinking, basking, courtship, and senescence.
//  - Diploid Sexual Reproduction via Simulated Binary Crossover (SBX) + Polynomial Mutation across all 108 genes, producing
//    physical 3D Bioluminescent Eggs (`eggs`) whose incubation speed depends on microclimate/vent warmth, hatching into
//    neonates (`egg -> neonate -> juvenile -> adult -> elder`) and recording a live multi-generational `lineageTree`.
//  - Mutualistic/Prey Photonic Bio-Mites (`mites`) coupled to the > 1.4M Saprotrophic/Phytoplankton Microbial Continuum.
//  - Shadow-Leviathan Apex Predators (`predators`) that patrol the biosphere perimeter, testing alarm calls, Schreckstoff
//    pheromone cascades, crystal-spire sheltering, chromatophore camouflage, and defensive curling.
import { mulberry, clamp, gauss } from './util.js';
import { FULL_GENES, evalHoxGRN } from './genome.js';
import { STARTER } from './starter_genome.js';
import { WORLD, SITES } from './world.js';

export const LIFE_STAGES = ['neonate', 'juvenile', 'adult', 'elder'];

/** Diploid Simulated Binary Crossover (SBX) + bounded polynomial mutation over all 108 developmental & Hox GRN genes */
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
    // Give wild conspecifics rich morphological & pigment diversity right from generation 0
    if (nm === 'pigmentHue') u = r();
    else if (nm === 'crestFin' || nm === 'tailFluke') u = clamp(0.15 + 0.75 * r(), 0.05, 0.95);
    else if (nm === 'bodyLen' || nm === 'bodyGirth' || nm === 'foreLimb' || nm === 'hindLimb') u = clamp(0.5 + 0.55 * (r() - 0.5), 0.1, 0.9);
    else if (nm === 'limbTopo') u = clamp(0.06 + 0.88 * r(), 0.04, 0.96); // wild 4/6/8-limb clade radiation!
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

    this.maxPeers = opts.maxPeers ?? 32;
    const initPeers = opts.peers ?? 8;
    const initMites = opts.mites ?? 36;
    const initPreds = opts.predators ?? 1;

    this.peers = [];
    this.eggs = [];
    this.mites = [];
    this.predators = [];
    this.lineageTree = [
      { id: 0, parentA: -1, parentB: -1, gen: 0, t: 0, hue: 0.75, crestFin: 1.0, bodyLen: 1.0, limbPairs: 3, label: 'Focal-0' },
    ];
    this.stats = {
      births: 0,
      eggsLaid: 0,
      courtships: 0,
      mitesEaten: 0,
      pollinationEvents: 0,
      alarmCalls: 0,
      maxGen: 0,
    };

    world.coEvolvePlants = true;
    world.eco = this;

    for (let i = 0; i < initPeers; i++) this.spawnPeer(null, null, true);
    for (let i = 0; i < initMites; i++) this.spawnMite();
    for (let i = 0; i < initPreds; i++) this.spawnPredator();
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
    const peer = {
      id,
      gen: g,
      hox,
      limbPairs: hox.limbPairs,
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
      segX, segY, segZ,
    };
    this.peers.push(peer);
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
      isFocalChild: peer.parentA === 0 || peer.parentB === 0,
    });
    if (this.lineageTree.length > 96) this.lineageTree.shift();
    if (generation > this.stats.maxGen) this.stats.maxGen = generation;
    return peer;
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
      const tgt = clamp(Math.round(peers), 0, 32);
      this.maxPeers = Math.max(this.maxPeers, Math.min(32, tgt + 4));
      while (this.peers.length < tgt) this.spawnPeer(null, null, true);
      while (this.peers.length > tgt) this.peers.pop();
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
        // Check if focal creature or a peer is exposed far from crystal shelters
        let candX = null, candZ = null, bestD = 13.5;
        const checkPrey = (px, pz, camo, curl) => {
          if (camo > 0.65 || curl > 0.65) return;
          for (let s = 0; s < W.shelters.length; s++) {
            if (Math.hypot(px - W.shelters[s].x, pz - W.shelters[s].z) < 2.6) return; // safe inside crystal spire!
          }
          const d = Math.hypot(px - pr.x, pz - pr.z);
          if (d < bestD) { bestD = d; candX = px; candZ = pz; }
        };
        if (focalCreature && focalCreature.sleep.stage === 0) {
          checkPrey(fHd[0], fHd[2], focalCreature.camoLevel || 0, focalCreature.body.u[53] || 0);
        }
        for (let k = 0; k < this.peers.length; k++) {
          const p = this.peers[k];
          checkPrey(p.x, p.z, p.camo, p.curl);
        }
        if (candX !== null) {
          tx = candX; tz = candZ;
          pr.swoop = Math.min(1, pr.swoop + dt * 1.1);
        }
      }

      // Repelled by geothermal hydrothermal steam plumes
      for (let v = 0; v < W.vents.length; v++) {
        const vt = W.vents[v];
        const dx = pr.x - vt.x, dz = pr.z - vt.z, d = Math.hypot(dx, dz);
        if (d < 3.2 && d > 1e-3) { tx += (dx / d) * 6; tz += (dz / d) * 6; }
      }

      const angTo = Math.atan2(tz - pr.z, tx - pr.x);
      let dAng = Math.atan2(Math.sin(angTo - pr.hdg), Math.cos(angTo - pr.hdg));
      pr.hdg += clamp(dAng, -1.8 * dt, 1.8 * dt);
      const sp = pr.speed * (1 + 0.65 * pr.swoop);
      pr.x = clamp(pr.x + Math.cos(pr.hdg) * sp * dt, -WORLD + 1.5, WORLD - 1.5);
      pr.z = clamp(pr.z + Math.sin(pr.hdg) * sp * dt, -WORLD + 1.5, WORLD - 1.5);
      const hGround = W.height(pr.x, pr.z);
      pr.y += (hGround + 1.35 - 0.55 * pr.swoop - pr.y) * Math.min(1, dt * 4);

      // Close swoop startles focal creature or peer -> releases Schreckstoff alarm pheromone & resets predator cooldown!
      if (focalCreature) {
        const df = Math.hypot(pr.x - fHd[0], pr.z - fHd[2]);
        if (df < 2.2 && pr.cooldown <= 0) {
          pr.cooldown = 14.0;
          W.depositPheromone(fHd[0], fHd[2], 1, 2.2); // Schreckstoff alarm burst!
          focalCreature.nociception = Math.max(focalCreature.nociception, 0.65);
          focalCreature.vocalFreq = 680;
          focalCreature.vocalAmp = 0.9;
          this.stats.alarmCalls++;
          focalCreature.ev('alarm', 'Shadow-Leviathan swooped — emitted alarm call & Schreckstoff plume!');
        }
      }
      for (let k = 0; k < this.peers.length; k++) {
        const p = this.peers[k];
        if (Math.hypot(pr.x - p.x, pr.z - p.z) < 2.0 && pr.cooldown <= 0) {
          pr.cooldown = 12.0;
          p.energy = Math.max(0.2, p.energy - 0.12);
          p.curl = 1.0;
          p.vocalFreq = 710;
          p.vocalAmp = 0.85;
          W.depositPheromone(p.x, p.z, 1, 2.0);
          this.stats.alarmCalls++;
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

      // Alarm & predator check
      let predNear = 0;
      for (let q = 0; q < this.predators.length; q++) {
        const pr = this.predators[q];
        const dp = Math.hypot(pr.x - p.x, pr.z - p.z);
        if (dp < 6.5) predNear = Math.max(predNear, 1 - dp / 6.5);
      }
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
          if (df < bd) { bd = df; mateX = fHd[0]; mateZ = fHd[2]; mateRef = 'focal'; }
        }
        for (let j = 0; j < this.peers.length; j++) {
          if (j === i) continue;
          const pj = this.peers[j];
          if (pj.stage !== 'adult' || pj.energy < 0.52 || pj.mateCooldown > 0) continue;
          const dj = Math.hypot(pj.x - p.x, pj.z - p.z);
          if (dj < bd) { bd = dj; mateX = pj.x; mateZ = pj.z; mateRef = pj; }
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
              focalCreature.ev('courtship', `courted conspecific #${p.id} (${p.limbPairs * 2}L) — diploid 108-gene Hox egg laid!`);
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
      const strideGain = (0.55 + 0.35 * (p.gen.legSw ?? 1.0)) * (0.65 + 0.35 * p.scale) * (1 - 0.7 * p.curl);
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

      p.y = W.height(p.x, p.z) + 0.26 * p.scale;
      p.gaitPh = (p.gaitPh + dt * f0 * Math.PI * 2) % (Math.PI * 2);
      const bLen = (p.gen.bodyLen ?? 1.0) * p.scale;
      const cf = Math.cos(p.hdg), sf = Math.sin(p.hdg);
      for (let s = 0; s < 7; s++) {
        const axial = (s - 3) * 0.33 * bLen * (1 - 0.45 * p.curl);
        const latWave = 0.075 * bLen * Math.sin(p.gaitPh - s * 0.75) * (1 - p.curl);
        const sx = p.x + cf * axial - sf * latWave;
        const sz = p.z + sf * axial + cf * latWave;
        p.segX[s] = sx;
        p.segZ[s] = sz;
        p.segY[s] = W.height(sx, sz) + (0.25 + 0.04 * Math.abs(Math.cos(p.gaitPh + s * 0.5))) * p.scale;
      }
    }
  }
}
