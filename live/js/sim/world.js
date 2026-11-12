// The 3D A-Life Biosphere & Abiotic World (upgraded in pass 18):
//  - Dynamic morphing heightfield, 16 fruiting plants, climbable basalt-geode rocks, spring pads & 3 water pools
//    (exact primary RNG stream preserved so single-creature navigation/foraging benchmarks remain bit-aligned).
//  - 3 Geothermal Hydrothermal Vents (radiating physical warmth & mineral nutrients) + 4 Crystal Spire Shelters.
//  - 32x32 Soil Nitrogen/Carbon Nutrient Grid fertilized by creature waste (urine -> N, feces -> C) & hydrothermal minerals,
//    coupled to a 32-edge Underground Mycelial Fungal Network transporting nutrients & systemic stress signals between plants,
//    plus co-evolving plant fruit/defense traits on seed-dispersal regeneration.
//  - 64x64 Saprotrophic Soil Decomposer, Diazotrophic Rhizobial & Bioluminescent Aquatic Phytoplankton Metapopulation
//    Continuum (> 1.4M microorganisms closing the N/C mineralization, nitrogen-fixation & aquatic trophic loop).
//  - 64x64x3 Wind-Advected Reaction-Diffusion Pheromone Field (Ch 0: Food trail, Ch 1: Alarm Schreckstoff, Ch 2: Courtship/Kin).
//  - 4-Season Ecological Cycle ('spring' | 'summer' | 'autumn' | 'winter') & microclimate thermal field ambientTemp(x, z, hour).
import { fbm, mulberry, clamp } from './util.js';

export const SITES = 16, WORLD = 22;
export const R_DOME = 21.6;
export const N_SOIL = 32;
export const N_PHER = 64;
export const N_MICRO = 64;
export const N_MICRO_FAUNA = 256; // 256 discrete embodied 3D benthic/pelagic/rhizosphere micro-fauna
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const LEDGER_POOLS = [
  'flora', 'gut', 'blood', 'stores', 'atp', 'tissue',
  'kinetic', 'elastic', 'detritus', 'heatPhys', 'dissNum',
];

export class World {
  constructor(seed) {
    this.seed = seed;
    const r = (this.r = mulberry(seed * 31 + 5));
    this.t = 0;
    this.morph = 0;
    this.gx = 0;
    this.gz = 0;
    this.g = 9.8;

    const cv = [0, 1, 2, 3].sort(() => r() - 0.5), sv = [0, 1, 2, 3].sort(() => r() - 0.5);
    this.plants = [];
    for (let k = 0; k < SITES; k++) {
      const gx = (k & 3) - 1.5, gz = (k >> 2) - 1.5;
      const x = gx * 9 + (r() - 0.5) * 3, z = gz * 9 + (r() - 0.5) * 3;
      const p = 0.05 + (0.25 * cv[k & 3]) / 3 + (0.25 * sv[k >> 2]) / 3;
      this.plants.push({
        k, x, z, y: 0, c: k & 3, s: k >> 2, p, pBase: p,
        fruit: 1, regrow: 0,
        sugarTrait: 1.0, defenseTrait: (k >> 2) === 3 ? 1.0 : 0.15, crownScale: 1.0,
        stress: 0, mycFlux: 0, gen: 0, pollinated: 0,
      });
    }
    this.best = this.plants.reduce((b, q) => (q.p > b.p ? q : b)).k;
    this.rocks = [];
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2, d = 5 + r() * 13;
      this.rocks.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, r: 0.9 + r() * 1.6 });
    }
    this.springs = [];
    for (let i = 0; i < 3; i++) {
      const a = r() * Math.PI * 2, d = 4 + r() * 12;
      this.springs.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, r: 1.3, comp: 0, v: 0 });
    }
    {
      const rw = mulberry(seed * 97 + 3);
      this.pools = [];
      for (let i = 0; i < 3; i++) {
        const a = rw() * Math.PI * 2, d = 6 + rw() * 12;
        this.pools.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 2.2, level: 1 });
      }
    }

    // Separate ecological RNG stream so primary plant/rock/wind RNG is 100% unchanged!
    const re = (this.re = mulberry(seed * 131 + 11));
    this.vents = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * 2.094) + (re() - 0.5) * 0.8, d = 7.5 + re() * 9.5;
      this.vents.push({
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        y: 0,
        r: 1.8,
        heat: 0.9 + 0.35 * re(),
        mineral: 0.75 + 0.25 * re(),
        phase: re() * Math.PI * 2,
      });
    }
    this.shelters = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI * 0.5) + 0.4 + (re() - 0.5) * 0.5, d = 9 + re() * 8;
      this.shelters.push({
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        y: 0,
        r: 1.55,
        h: 1.9 + 0.9 * re(),
        hue: re(),
      });
    }

    // 32x32 Soil Nitrogen (N) & Carbon (C) grids
    this.soilN = new Float32Array(N_SOIL * N_SOIL);
    this.soilC = new Float32Array(N_SOIL * N_SOIL);
    for (let iz = 0; iz < N_SOIL; iz++) {
      for (let ix = 0; ix < N_SOIL; ix++) {
        const wx = ((ix + 0.5) / N_SOIL - 0.5) * 2 * WORLD;
        const wz = ((iz + 0.5) / N_SOIL - 0.5) * 2 * WORLD;
        this.soilN[iz * N_SOIL + ix] = 0.42 + 0.22 * fbm(wx * 0.12, wz * 0.12, seed + 19);
        this.soilC[iz * N_SOIL + ix] = 0.38 + 0.22 * fbm(wx * 0.14 + 5, wz * 0.14 - 3, seed + 23);
      }
    }

    // Build underground Mycelial Fungal Root Network connecting each plant to its 3 nearest fungal neighbors
    this.mycelia = [];
    const seenEdge = new Set();
    for (let i = 0; i < SITES; i++) {
      const pi = this.plants[i];
      const nbrs = this.plants
        .map((pj, j) => ({ j, d: j === i ? 1e9 : Math.hypot(pj.x - pi.x, pj.z - pi.z) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      for (const { j, d } of nbrs) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seenEdge.has(key)) {
          seenEdge.add(key);
          this.mycelia.push({ a: Math.min(i, j), b: Math.max(i, j), len: d, cond: 0.65 + 0.35 * re(), flux: 0 });
        }
      }
    }

    // 64x64 Saprotrophic Soil Microbe + Rhizobial & Aquatic Bioluminescent Phytoplankton Continuum (units: 10^3 organisms / cell)
    this.microbeGrid = new Float32Array(N_MICRO * N_MICRO);
    this.planktonGrid = new Float32Array(N_MICRO * N_MICRO);
    this.microbeTmp = new Float32Array(N_MICRO * N_MICRO);
    this.poolMask = new Float32Array(N_MICRO * N_MICRO);
    this.rhizoMask = new Float32Array(N_MICRO * N_MICRO);
    let initPop = 0, pBloomSum = 0, pBloomCnt = 0;
    for (let iz = 0; iz < N_MICRO; iz++) {
      const wz = ((iz + 0.5) / N_MICRO - 0.5) * 2 * WORLD;
      for (let ix = 0; ix < N_MICRO; ix++) {
        const wx = ((ix + 0.5) / N_MICRO - 0.5) * 2 * WORLD;
        const idx = iz * N_MICRO + ix;
        let rootBoost = 0;
        for (let k = 0; k < SITES; k++) {
          const d2 = (wx - this.plants[k].x) ** 2 + (wz - this.plants[k].z) ** 2;
          if (d2 < 9.0) rootBoost += 0.35 * Math.exp(-d2 / 3.2);
        }
        this.rhizoMask[idx] = Math.min(1.0, rootBoost);
        let poolW = 0;
        for (let p = 0; p < this.pools.length; p++) {
          const pl = this.pools[p];
          const dp = Math.hypot(wx - pl.x, wz - pl.z);
          if (dp < pl.r * 1.35) poolW = Math.max(poolW, clamp(1.25 - dp / pl.r, 0, 1));
        }
        this.poolMask[idx] = poolW;
        const m0 = (0.28 + 0.16 * fbm(wx * 0.15 - 4, wz * 0.15 + 2, seed + 41) + 0.24 * this.rhizoMask[idx]) * (1 - 0.55 * poolW);
        const pk0 = poolW > 0.02 ? poolW * (1.85 + 0.75 * fbm(wx * 0.28, wz * 0.28, seed + 53)) : 0;
        this.microbeGrid[idx] = m0;
        this.planktonGrid[idx] = pk0;
        initPop += (m0 + pk0) * 3800;
        if (poolW > 0.2) { pBloomSum += pk0; pBloomCnt++; }
      }
    }
    this.microbeTotalPop = Math.round(initPop); // > 5.2M microorganisms across the 4,096 spatial cells
    this.planktonBloom = pBloomCnt > 0 ? clamp(pBloomSum / (pBloomCnt * 2.6), 0, 1) : 0.65;

    // 256 discrete embodied 3D Micro-Fauna across 3 trophic guilds (using ecological RNG `re` so primary `r` is untouched!):
    //  - Guild 0 (0..95):   96 Benthic Detritivore Isopods shredding organic soilC / waste into bioavailable N
    //  - Guild 1 (96..175): 80 Pelagic Bioluminescent Copepods swimming in water pools & grazing phytoplankton
    //  - Guild 2 (176..255):80 Rhizosphere Springtails (Collembola) cycling root/mycorrhizal nutrients around plants
    this.microFauna = [];
    for (let i = 0; i < N_MICRO_FAUNA; i++) {
      const guild = i < 96 ? 0 : i < 176 ? 1 : 2;
      let mx = 0, mz = 0, tIdx = 0;
      if (guild === 1 && this.pools.length) {
        tIdx = i % this.pools.length;
        const pl = this.pools[tIdx];
        const ang = re() * Math.PI * 2, rad = re() * pl.r * 0.85;
        mx = pl.x + Math.cos(ang) * rad;
        mz = pl.z + Math.sin(ang) * rad;
      } else if (guild === 2 && this.plants.length) {
        tIdx = i % SITES;
        const pl = this.plants[tIdx];
        const ang = re() * Math.PI * 2, rad = 0.4 + re() * 1.8;
        mx = pl.x + Math.cos(ang) * rad;
        mz = pl.z + Math.sin(ang) * rad;
      } else {
        const ang = re() * Math.PI * 2, rad = 2.0 + re() * (WORLD - 4.0);
        mx = Math.cos(ang) * rad;
        mz = Math.sin(ang) * rad;
      }
      mx = clamp(mx, -WORLD + 1.5, WORLD - 1.5);
      mz = clamp(mz, -WORLD + 1.5, WORLD - 1.5);
      const col = guild === 0
        ? [0.86, 0.58, 0.28] // amber detritivore isopod
        : guild === 1
          ? [0.18, 0.92, 1.00] // cyan bioluminescent copepod
          : [0.58, 0.96, 0.36]; // lime rhizosphere springtail
      this.microFauna.push({
        x: mx,
        y: 0,
        z: mz,
        vx: (re() - 0.5) * 0.5,
        vz: (re() - 0.5) * 0.5,
        guild,
        targetIdx: tIdx,
        energy: 0.65 + 0.3 * re(),
        r: col[0],
        g: col[1],
        b: col[2],
        ph: re() * Math.PI * 2,
      });
    }
    this.microFaunaBiomass = N_MICRO_FAUNA * 0.8;

    // 64x64x3 Wind-Advected Reaction-Diffusion Pheromone Grid (interleaved 3 channels: [food, alarm, mate])
    this.pher = new Float32Array(N_PHER * N_PHER * 3);
    this.pherTmp = new Float32Array(N_PHER * N_PHER * 3);
    this._ecoAcc = 0;

    // Season & microclimate state
    this.seasonMode = 'auto';
    this.seasonPhase = 0.15; // starts in spring
    this.season = 'spring';
    this.baseTemp = 22.0;    // Celsius
    this.meanSoilN = 0.48;
    this.totalPheromone = 0;
    this.coEvolvePlants = false; // enabled automatically when Ecosystem is attached

    this.snacks = [];
    this.waste = [];
    this.wind = { x: 0, z: 0, tx: 0, tz: 0, rain: 0 };
    this.eco = null; // populated when Ecosystem multi-agent biosphere is active
    this.pherMean = 0;

    // -------------------------------------------------------------------------
    // Pass 20: Dedicated 3rd RNG stream `this.rd` so `this.r` and `this.re` stay
    // 100% bit-identical for all existing navigation/foraging/ecosystem probes!
    // -------------------------------------------------------------------------
    const rd = (this.rd = mulberry(seed * 277 + 19));

    // Attach FMO Vibronic-ENAQT quantum photosynthesis & Daisyworld albedo traits to the 16 plants
    this.isingSpins = new Int8Array(SITES);
    for (let k = 0; k < SITES; k++) {
      const q = this.plants[k];
      q.albedoTrait = (k & 1) ? (0.62 + 0.18 * rd()) : (0.16 + 0.18 * rd()); // pale reflective vs dark thermophilic
      q.enaqtEff = 0.88;
      q.forsterEff = 0.72; // classical Förster hopping surrogate for honest comparison
      this.isingSpins[k] = rd() < 0.5 ? -1 : 1;
    }

    // Two-Layer Geodesic Biodome ("The Dome"): atmospheric gases, Daisyworld albedo, geomagnetic field & aurora storms
    this.dome = {
      radius: R_DOME,
      o2: 20.95,           // % atmospheric O2
      co2: 412.0,          // ppm atmospheric CO2
      pressureKPa: 101.32, // kPa barometric pressure
      humidity: 0.58,
      albedo: 0.42,        // Watson-Lovelock Daisyworld biotic planetary/dome albedo
      greenhouseDeltaC: 0.0,
      stefanBoltzmannKW: 0.0,
      fieldUT: 48.5,       // ~48.5 uT geomagnetic field intensity
      inclination: 1.08,   // ~62 deg magnetic dip angle (rad) for Cryptochrome-4 inclination compass
      declination: 0.0,
      auroraStorm: 0.0,    // [0..1] cosmic-ray / RF magnetic storm intensity
      auroraPhase: rd() * Math.PI * 2,
      boundaryTouches: 0,
      glitchDiscoveries: 0,
      isingOrder: 0,
    };

    // 3 Drifting Reality-Glitch Anomaly Seams inside Layer-1 Dome (exploitable physics seams!)
    const anomSpecs = [
      { kind: 'low-g', gravityMul: 0.54, dragMul: 0.90, phaseNoise: 0.05, hue: 0.53 },
      { kind: 'chrono-visc', gravityMul: 1.00, dragMul: 1.48, phaseNoise: 0.12, hue: 0.82 },
      { kind: 'sensory-crack', gravityMul: 0.86, dragMul: 0.96, phaseNoise: 0.38, hue: 0.12 },
    ];
    this.anomalyZones = anomSpecs.map((sp, i) => {
      const ang = i * ((Math.PI * 2) / 3) + 0.55 + (rd() - 0.5) * 0.35;
      const dist = 10.5 + rd() * 5.5;
      return {
        ...sp,
        id: i,
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        y: 0,
        r: 2.35,
        ang,
        dist,
        omega: (i % 2 === 0 ? 1 : -1) * (0.018 + 0.008 * rd()),
        probed: 0,
      };
    });

    // 4 Quantum-Geometric Crystal Resonance Monoliths + C3 Cospectral Twin Obelisks (sigma_0 / sigma_1)
    const monoDefs = [
      { kind: 'ck31', label: 'Conway-Kochen 31-Ray Cube', rays: 31, hue: 0.52 },
      { kind: 'cabello33', label: 'Cabello 33-Ray Hex-Prism', rays: 33, hue: 0.34 },
      { kind: 'cega18', label: 'CEGA 18-Ray Entanglement Forge', rays: 18, hue: 0.78 },
      { kind: 'hoggar64', label: 'Hoggar 64-Line + C3 Twins (σ0/σ1)', rays: 64, hue: 0.11 },
    ];
    this.monoliths = monoDefs.map((md, i) => {
      const ang = i * (Math.PI * 0.5) + 0.98;
      const dist = 13.4 + (rd() - 0.5) * 1.8;
      const mx = Math.cos(ang) * dist, mz = Math.sin(ang) * dist;
      return {
        ...md,
        id: i,
        x: mx,
        z: mz,
        y: 0,
        r: 1.35,
        h: 2.85 + 0.35 * i,
        charge: 0.85,
        phase: rd() * Math.PI * 2,
        // Monolith 3 carries the C3 cospectral twin obelisk pair: sigma_1 (safe, frust=344) vs sigma_0 (contextual trap, frust=347)
        twins: md.kind === 'hoggar64' ? [
          { tag: 'sigma0', frust: 347, trace3: 14976, dx: -1.15, dz: 0.45, safe: false },
          { tag: 'sigma1', frust: 344, trace3: 15360, dx: 1.15, dz: -0.45, safe: true },
        ] : null,
      };
    });

    // 2 Giant Bioluminescent Big-Tree Sanctuary Beings (`GATE-DOME-REFUGE` predation damping + thermal buffer + nectar fruit)
    this.sanctuaries = [0, 1].map((i) => {
      const ang = i * Math.PI + 0.32 + (rd() - 0.5) * 0.25;
      const dist = 8.8 + rd() * 2.4;
      return {
        id: i,
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        y: 0,
        r: 3.35,       // canopy refuge radius
        h: 3.9 + 0.4 * rd(),
        nectar: 1.0,
        hue: i === 0 ? 0.46 : 0.62,
        visitors: 0,
      };
    });

    // 6 Movable Lithic DomeStones (pushable/carryable tools, cairn windbreaks & cache nutcrackers)
    this.domeStones = Array.from({ length: 6 }, (_, i) => {
      const ang = (i * Math.PI) / 3 + 0.2 + (rd() - 0.5) * 0.3;
      const dist = 4.8 + rd() * 8.5;
      return {
        id: i,
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        y: 0,
        vx: 0,
        vz: 0,
        r: 0.24 + 0.05 * rd(),
        mass: 1.8,
        heldBy: null,
        cairnNeighbors: 0,
      };
    });

    // Spoiling Nutrient Caches, Physarum Low-Drag Slime Trails & Shed Exuvia Chitin Shells
    this.domeCaches = Array.from({ length: 4 }, (_, i) => {
      const ang = i * (Math.PI * 0.5) + 0.72;
      const dist = 6.5 + rd() * 6.5;
      return {
        id: i,
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        y: 0,
        energy: 0.85,
        freshness: 1.0, // spoils slowly over time towardritus!
        hardShell: i % 2 === 0, // hard-shelled caches open faster with a nearby DomeStone!
      };
    });
    this.slimeTrails = []; // { x, z, strength } -> up to 48 nodes giving -20% locomotion drag
    this.exuvia = [];      // { x, y, z, mineral, hue, age } -> shed chitin shells recycled by detritivores

    // 11-Pool FP64 Kahan-Compensated First-Law Dome Energy Ledger (`GATE-03`: normalized closure error < 1e-12)
    this.initEnergyLedger();

    this.fixY();
  }

  height(x, z) {
    const m = this.morph;
    let h =
      2.2 * (fbm(x * 0.06 + 0.13 * Math.sin(m * 0.7), z * 0.06 + 0.11 * Math.cos(m * 0.5), this.seed) - 0.5) +
      0.6 * (fbm(x * 0.17, z * 0.17 + m * 0.05, this.seed + 3) - 0.5);
    const d = Math.hypot(x, z);
    if (d > WORLD - 3) h += 0.6 * (d - WORLD + 3) ** 1.5;
    return h;
  }

  normal(x, z) {
    const e = 0.05;
    const hx = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e);
    const hz = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
    const n = Math.hypot(hx, 1, hz);
    return [-hx / n, 1 / n, -hz / n];
  }

  fixY() {
    for (const q of this.rocks) q.y = this.height(q.x, q.z) + q.r * 0.35;
    for (const q of this.plants) q.y = this.height(q.x, q.z);
    for (const s of this.springs) s.y = this.height(s.x, s.z);
    for (const v of this.vents) v.y = this.height(v.x, v.z);
    for (const sh of this.shelters) sh.y = this.height(sh.x, sh.z);
    for (const s of this.snacks) if (!s.held) s.y = Math.max(s.y, this.height(s.x, s.z) + 0.15);
    if (this.microFauna) {
      for (let i = 0; i < this.microFauna.length; i++) {
        const mf = this.microFauna[i];
        mf.y = this.height(mf.x, mf.z) + (mf.guild === 1 ? 0.08 : 0.05);
      }
    }
    if (this.monoliths) {
      for (const m of this.monoliths) m.y = this.height(m.x, m.z);
    }
    if (this.sanctuaries) {
      for (const sc of this.sanctuaries) sc.y = this.height(sc.x, sc.z);
    }
    if (this.anomalyZones) {
      for (const az of this.anomalyZones) az.y = this.height(az.x, az.z) + 0.35;
    }
    if (this.domeStones) {
      for (const st of this.domeStones) {
        if (!st.heldBy) st.y = this.height(st.x, st.z) + st.r * 0.72;
      }
    }
    if (this.domeCaches) {
      for (const dc of this.domeCaches) dc.y = this.height(dc.x, dc.z) + 0.14;
    }
    if (this.exuvia) {
      for (const ex of this.exuvia) ex.y = this.height(ex.x, ex.z) + 0.10;
    }
  }

  // ---------------------------------------------------------------------------
  // 11-Pool FP64 Kahan-Compensated First-Law Dome Energy Ledger (`GATE-03`)
  // Pools: 0=flora, 1=gut, 2=blood, 3=stores, 4=atp, 5=tissue,
  //        6=kinetic, 7=elastic, 8=detritus, 9=heatPhys, 10=dissNum
  // ---------------------------------------------------------------------------
  initEnergyLedger() {
    const pools = new Float64Array([
      160.0, // 0: flora chemical energy (kJ)
      12.0,  // 1: gut chyme
      18.0,  // 2: blood glucose/lipids
      45.0,  // 3: hepatic/adipose stores
      14.0,  // 4: cellular ATP pool
      85.0,  // 5: structural somatic tissue
      4.0,   // 6: macroscopic kinetic energy
      3.0,   // 7: Neo-Hookean elastic potential
      32.0,  // 8: soil/exuvia/cache detritus
      120.0, // 9: dome thermal reservoir (heatPhys)
      0.0,   // 10: numerical dissipation audit sink
    ]);
    let initSum = 0;
    for (let i = 0; i < 11; i++) initSum += pools[i];
    this.ledger = {
      pools,
      comp: new Float64Array(11),
      initialTotal: initSum,
      solarIn: 0.0,
      solarComp: 0.0,
      geothermalIn: 0.0,
      geoComp: 0.0,
      radiatedOut: 0.0,
      radComp: 0.0,
      closureErr: 0.0,
    };
  }

  _kahanAddPool(idx, delta) {
    const L = this.ledger;
    const y = delta - L.comp[idx];
    const t = L.pools[idx] + y;
    L.comp[idx] = (t - L.pools[idx]) - y;
    L.pools[idx] = t;
  }

  _kahanAddScalar(valKey, compKey, delta) {
    const L = this.ledger;
    const y = delta - L[compKey];
    const t = L[valKey] + y;
    L[compKey] = (t - L[valKey]) - y;
    L[valKey] = t;
  }

  /** Conservative internal energy transfer between two Dome pools (kJ) */
  transferEnergy(fromIdx, toIdx, amount) {
    if (!this.ledger || amount <= 0 || fromIdx === toIdx) return 0;
    const avail = Math.max(0, this.ledger.pools[fromIdx]);
    const actual = Math.min(avail, amount);
    if (actual <= 0) return 0;
    this._kahanAddPool(fromIdx, -actual);
    this._kahanAddPool(toIdx, actual);
    return actual;
  }

  /** External Dome boundary influx (solar PAR or hydrothermal mantle heat) */
  injectExternalEnergy(poolIdx, amount, source = 'solar') {
    if (!this.ledger || amount <= 0) return;
    this._kahanAddPool(poolIdx, amount);
    if (source === 'geothermal') this._kahanAddScalar('geothermalIn', 'geoComp', amount);
    else this._kahanAddScalar('solarIn', 'solarComp', amount);
  }

  /** Stefan-Boltzmann radiative heat rejection through the Geodesic Dome canopy */
  radiateHeat(amount) {
    if (!this.ledger || amount <= 0) return 0;
    const actual = Math.min(Math.max(0, this.ledger.pools[9]), amount);
    if (actual <= 0) return 0;
    this._kahanAddPool(9, -actual);
    this._kahanAddScalar('radiatedOut', 'radComp', actual);
    return actual;
  }

  /** Compute normalized First-Law energy closure error (`GATE-03` requires < 1e-12) */
  auditEnergyClosure() {
    const L = this.ledger;
    if (!L) return 0;
    let sumP = 0, cP = 0;
    for (let i = 0; i < 11; i++) {
      const y = (L.pools[i] - L.comp[i]) - cP;
      const t = sumP + y;
      cP = (t - sumP) - y;
      sumP = t;
    }
    const lhs = sumP + (L.radiatedOut - L.radComp);
    const rhs = L.initialTotal + (L.solarIn - L.solarComp) + (L.geothermalIn - L.geoComp);
    L.closureErr = Math.abs(lhs - rhs) / (Math.abs(rhs) + 1e-9);
    return L.closureErr;
  }

  /** Enforce soft elastic containment at the Geodesic Dome shell R_DOME */
  enforceDomeBoundary(x, z, vx = 0, vz = 0, margin = 0.45) {
    const maxR = (this.dome?.radius || R_DOME) - margin;
    const d = Math.hypot(x, z);
    if (d <= maxR || d < 1e-6) return { x, z, vx, vz, hit: false };
    const nx = x / d, nz = z / d;
    const vn = vx * nx + vz * nz;
    const rvx = vn > 0 ? vx - 1.65 * vn * nx : vx;
    const rvz = vn > 0 ? vz - 1.65 * vn * nz : vz;
    if (this.dome) this.dome.boundaryTouches++;
    return { x: nx * maxR, z: nz * maxR, vx: rvx, vz: rvz, hit: true };
  }

  /** True when (x, z) lies inside a Big-Tree Sanctuary Refuge (`GATE-DOME-REFUGE`) */
  isInsideSanctuary(x, z) {
    if (!this.sanctuaries) return false;
    for (let i = 0; i < this.sanctuaries.length; i++) {
      const s = this.sanctuaries[i];
      if ((x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r) return true;
    }
    return false;
  }

  /** Sample local Reality-Glitch Anomaly physics seam multipliers at (x, z) */
  sampleAnomaly(x, z, markDiscovery = false) {
    if (!this.anomalyZones) return { gravityMul: 1, dragMul: 1, phaseNoise: 0, zoneIdx: -1 };
    for (let i = 0; i < this.anomalyZones.length; i++) {
      const az = this.anomalyZones[i];
      const d2 = (x - az.x) ** 2 + (z - az.z) ** 2;
      if (d2 < az.r * az.r) {
        const w = 1 - Math.sqrt(d2) / az.r;
        if (markDiscovery && az.probed < 1) {
          az.probed = 1;
          if (this.dome) this.dome.glitchDiscoveries++;
        }
        return {
          gravityMul: 1 + (az.gravityMul - 1) * w,
          dragMul: 1 + (az.dragMul - 1) * w,
          phaseNoise: az.phaseNoise * w,
          zoneIdx: i,
          kind: az.kind,
        };
      }
    }
    return { gravityMul: 1, dragMul: 1, phaseNoise: 0, zoneIdx: -1, kind: null };
  }

  /** Sample Physarum slime highway drag multiplier at (x, z) (down to 0.80 = -20% drag) */
  sampleSlimeDrag(x, z) {
    if (!this.slimeTrails || this.slimeTrails.length === 0) return 1.0;
    let best = 0;
    for (let i = 0; i < this.slimeTrails.length; i++) {
      const sl = this.slimeTrails[i];
      const d2 = (x - sl.x) ** 2 + (z - sl.z) ** 2;
      if (d2 < 1.44) best = Math.max(best, sl.strength * (1 - d2 / 1.44));
    }
    return 1.0 - 0.20 * clamp(best, 0, 1);
  }

  depositSlime(x, z, strength = 0.65) {
    if (!this.slimeTrails) return;
    for (let i = 0; i < this.slimeTrails.length; i++) {
      const sl = this.slimeTrails[i];
      if ((x - sl.x) ** 2 + (z - sl.z) ** 2 < 0.64) {
        sl.strength = Math.min(1.0, sl.strength + 0.35 * strength);
        return;
      }
    }
    if (this.slimeTrails.length >= 48) this.slimeTrails.shift();
    this.slimeTrails.push({ x, z, strength: clamp(strength, 0.1, 1.0) });
  }

  spawnExuvia(x, z, hue = 0.72) {
    if (!this.exuvia) return;
    if (this.exuvia.length >= 16) this.exuvia.shift();
    this.exuvia.push({ x, z, y: this.height(x, z) + 0.10, mineral: 1.0, hue, age: 0 });
    this.transferEnergy(5, 8, 0.45); // shed somatic chitin tissue -> detritus pool!
  }

  /** Push nearby movable DomeStones when a body/limb contacts them, returning impulse reaction */
  pushDomeStones(x, z, radius, vx, vz) {
    if (!this.domeStones) return 0;
    let hits = 0;
    for (let i = 0; i < this.domeStones.length; i++) {
      const st = this.domeStones[i];
      if (st.heldBy) continue;
      const dx = st.x - x, dz = st.z - z;
      const minD = radius + st.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d;
        const pen = minD - d;
        st.x += nx * pen * 0.65;
        st.z += nz * pen * 0.65;
        st.vx += nx * 1.4 + vx * 0.25;
        st.vz += nz * 1.4 + vz * 0.25;
        hits++;
      }
    }
    return hits;
  }

  /** Local microclimate temperature (C) at (x, z) given solar hour, season, altitude, rain, vents, Daisyworld & Sanctuaries */
  ambientTemp(x, z, hour = 12) {
    const sAng = this.seasonPhase * Math.PI * 2;
    const seasonal = 5.5 * Math.sin(sAng); // +5.5C summer, -5.5C winter
    const diurnal = 4.2 * Math.cos(((hour - 13.5) * 2 * Math.PI) / 24);
    const altCool = -0.7 * Math.max(0, this.height(x, z));
    const rainCool = -2.8 * (this.wind.rain || 0);
    let ventWarmth = 0;
    for (let i = 0; i < this.vents.length; i++) {
      const v = this.vents[i];
      const d2 = (x - v.x) ** 2 + (z - v.z) ** 2;
      if (d2 < 36) ventWarmth += 14.0 * v.heat * Math.exp(-d2 / 9.5);
    }
    let tLoc = 21.5 + seasonal + diurnal + altCool + rainCool + ventWarmth + (this.dome?.greenhouseDeltaC || 0);
    // Big-Tree Sanctuary canopies buffer extreme microclimate swings toward 23.0 C
    if (this.sanctuaries) {
      for (let i = 0; i < this.sanctuaries.length; i++) {
        const sc = this.sanctuaries[i];
        const d2 = (x - sc.x) ** 2 + (z - sc.z) ** 2;
        if (d2 < sc.r * sc.r) {
          const w = 0.45 * (1 - d2 / (sc.r * sc.r));
          tLoc = tLoc * (1 - w) + 23.0 * w;
        }
      }
    }
    return tLoc;
  }

  soilIndex(x, z) {
    const ix = clamp(Math.floor(((x / (2 * WORLD)) + 0.5) * N_SOIL), 0, N_SOIL - 1);
    const iz = clamp(Math.floor(((z / (2 * WORLD)) + 0.5) * N_SOIL), 0, N_SOIL - 1);
    return iz * N_SOIL + ix;
  }

  microbeIndex(x, z) {
    const ix = clamp(Math.floor(((x / (2 * WORLD)) + 0.5) * N_MICRO), 0, N_MICRO - 1);
    const iz = clamp(Math.floor(((z / (2 * WORLD)) + 0.5) * N_MICRO), 0, N_MICRO - 1);
    return iz * N_MICRO + ix;
  }

  sampleMicrobe(x, z) {
    return this.microbeGrid[this.microbeIndex(x, z)];
  }

  samplePlankton(x, z) {
    return this.planktonGrid[this.microbeIndex(x, z)];
  }

  depositPheromone(x, z, ch, amount) {
    if (amount <= 0 || ch < 0 || ch > 2) return;
    const fx = ((x / (2 * WORLD)) + 0.5) * (N_PHER - 1);
    const fz = ((z / (2 * WORLD)) + 0.5) * (N_PHER - 1);
    const ix = clamp(Math.round(fx), 0, N_PHER - 1);
    const iz = clamp(Math.round(fz), 0, N_PHER - 1);
    const idx = (iz * N_PHER + ix) * 3 + ch;
    this.pher[idx] = Math.min(4.0, this.pher[idx] + amount);
  }

  samplePheromone(x, z, ch) {
    const fx = clamp(((x / (2 * WORLD)) + 0.5) * (N_PHER - 1), 0, N_PHER - 1.001);
    const fz = clamp(((z / (2 * WORLD)) + 0.5) * (N_PHER - 1), 0, N_PHER - 1.001);
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
    const P = this.pher;
    const i00 = (iz * N_PHER + ix) * 3 + ch;
    const i10 = i00 + 3;
    const i01 = i00 + N_PHER * 3;
    const i11 = i01 + 3;
    const a = P[i00] + (P[i10] - P[i00]) * tx;
    const b = P[i01] + (P[i11] - P[i01]) * tx;
    return a + (b - a) * tz;
  }

  /** Sample bilateral antennal concentration [concCenter, leftMinusRight] for chemotaxis */
  sampleAntennalPheromone(hx, hz, fx, fz, sx, sz, ch) {
    const span = 0.42;
    const lx = hx + fx * 0.25 - sx * span, lz = hz + fz * 0.25 - sz * span;
    const rx = hx + fx * 0.25 + sx * span, rz = hz + fz * 0.25 + sz * span;
    const cL = this.samplePheromone(lx, lz, ch);
    const cR = this.samplePheromone(rx, rz, ch);
    return [0.5 * (cL + cR), cL - cR];
  }

  /** Step 64x64 microbial/planktonic continuum + 64x64x3 wind-advected pheromones + 32x32 soil/mycelial network at 10 Hz */
  stepBiosphereGrid(dt) {
    // 1) Season progression
    if (this.seasonMode === 'auto') {
      this.seasonPhase = (this.seasonPhase + dt * 0.00055) % 1;
    } else {
      const idx = SEASONS.indexOf(this.seasonMode);
      if (idx >= 0) this.seasonPhase = (idx + 0.25) / 4;
    }
    this.season = SEASONS[Math.floor(this.seasonPhase * 4) % 4];
    const seasonGrow = this.season === 'spring' ? 1.22 : this.season === 'summer' ? 1.1 : this.season === 'autumn' ? 0.92 : 0.68;

    // 2) Waste detritus inoculation + hydrothermal vent mineral enrichment
    const sN = this.soilN, sC = this.soilC;
    const MG = this.microbeGrid, PG = this.planktonGrid, MT = this.microbeTmp;
    for (let i = 0; i < this.waste.length; i++) {
      const w = this.waste[i];
      const idx = this.soilIndex(w.x, w.z);
      const mIdx = this.microbeIndex(w.x, w.z);
      if (w.type === 'urine') sN[idx] = Math.min(2.0, sN[idx] + dt * 0.08 * (w.amount || 1));
      else {
        sC[idx] = Math.min(2.0, sC[idx] + dt * 0.09 * (w.amount || 1));
        MG[mIdx] = Math.min(1.6, MG[mIdx] + dt * 0.14 * (w.amount || 1));
      }
    }
    for (let i = 0; i < this.vents.length; i++) {
      const v = this.vents[i];
      v.phase = (v.phase + dt * 2.4) % (Math.PI * 2);
      const idx = this.soilIndex(v.x, v.z);
      const mIdx = this.microbeIndex(v.x, v.z);
      sN[idx] = Math.min(2.0, sN[idx] + dt * 0.025 * v.mineral);
      sC[idx] = Math.min(2.0, sC[idx] + dt * 0.02 * v.mineral);
      MG[mIdx] = Math.min(1.6, MG[mIdx] + dt * 0.04 * v.mineral); // thermophilic chemolithotrophs!
    }

    // 3) 64x64 Saprotrophic Soil Decomposer, Rhizobial N2-Fixation & Bioluminescent Phytoplankton Continuum PDE
    const q10 = seasonGrow * (1 + 0.18 * (this.wind.rain || 0));
    const mDiff = clamp(0.06 * dt, 0, 0.12);
    let popSum = 0, pBloomSum = 0, pBloomCnt = 0;
    for (let iz = 0; iz < N_MICRO; iz++) {
      const sz = iz >> 1;
      const zU = iz > 0 ? iz - 1 : 0, zD = iz + 1 < N_MICRO ? iz + 1 : N_MICRO - 1;
      for (let ix = 0; ix < N_MICRO; ix++) {
        const sx = ix >> 1;
        const sIdx = sz * N_SOIL + sx;
        const idx = iz * N_MICRO + ix;
        const xL = ix > 0 ? ix - 1 : 0, xR = ix + 1 < N_MICRO ? ix + 1 : N_MICRO - 1;

        const mCur = MG[idx];
        const lap = MG[iz * N_MICRO + xL] + MG[iz * N_MICRO + xR] + MG[zU * N_MICRO + ix] + MG[zD * N_MICRO + ix] - 4 * mCur;
        const cAvail = sC[sIdx];
        const rhizo = this.rhizoMask[idx];
        const poolW = this.poolMask[idx];
        // Monod saprotrophic growth + diazotrophic root N2-fixation carrying capacity
        const carryM = (0.26 + 0.42 * (cAvail / (0.35 + cAvail)) + 0.28 * rhizo) * (1 - 0.5 * poolW);
        const mNext = clamp(mCur + dt * 0.16 * q10 * mCur * (1 - mCur / Math.max(0.08, carryM)) + mDiff * lap, 0.04, 1.8);
        MT[idx] = mNext;

        // Saprotrophic mineralization of soilC -> bioavailable soilN + rhizobial N2 fixation
        const mineralize = dt * 0.0022 * mNext * cAvail;
        sC[sIdx] = Math.max(0.08, sC[sIdx] - mineralize * 0.65);
        sN[sIdx] = Math.min(2.0, sN[sIdx] + mineralize + dt * 0.0014 * rhizo * mNext);

        // Aquatic bioluminescent phytoplankton logistic bloom in water pools
        let pkNext = 0;
        if (poolW > 0.02) {
          const pkCur = PG[idx];
          const carryP = poolW * (1.75 + 1.35 * sN[sIdx]) * seasonGrow;
          pkNext = clamp(pkCur + dt * 0.22 * (pkCur + 0.03 * poolW) * (1 - pkCur / Math.max(0.1, carryP)), 0.02, 4.2);
          if (poolW > 0.2) { pBloomSum += pkNext; pBloomCnt++; }
        }
        PG[idx] = pkNext;
        popSum += (mNext + pkNext) * 3800;
      }
    }
    MG.set(MT);
    this.microbeTotalPop = Math.round(popSum);
    this.planktonBloom = pBloomCnt > 0 ? clamp(pBloomSum / (pBloomCnt * 2.6), 0.05, 1.0) : 0.65;

    // 3b) Step 256 Embodied 3D Benthic/Pelagic/Rhizosphere Micro-Fauna (`microFauna`, using only `this.re`)
    if (this.microFauna) {
      let mfBio = 0;
      const re = this.re;
      for (let i = 0; i < this.microFauna.length; i++) {
        const mf = this.microFauna[i];
        mf.ph = (mf.ph + dt * (mf.guild === 2 ? 11.0 : 7.5)) % (Math.PI * 2);
        let ax = (re() - 0.5) * 0.8, az = (re() - 0.5) * 0.8;
        if (mf.guild === 1 && this.pools.length) {
          const pl = this.pools[mf.targetIdx % this.pools.length];
          const dx = pl.x - mf.x, dz = pl.z - mf.z, dp = Math.hypot(dx, dz);
          if (dp > pl.r * 0.85) { ax += (dx / dp) * 2.4; az += (dz / dp) * 2.4; }
          const mIdx = this.microbeIndex(mf.x, mf.z);
          if (PG[mIdx] > 0.15) {
            PG[mIdx] = Math.max(0.05, PG[mIdx] - dt * 0.025);
            mf.energy = clamp(mf.energy + dt * 0.04, 0.2, 1.2);
          }
        } else if (mf.guild === 2 && this.plants.length) {
          const pl = this.plants[mf.targetIdx % SITES];
          const dx = pl.x - mf.x, dz = pl.z - mf.z, dp = Math.hypot(dx, dz);
          if (dp > 1.9) { ax += (dx / dp) * 1.8; az += (dz / dp) * 1.8; }
          else if (dp < 0.35 && dp > 1e-3) { ax -= (dx / dp) * 0.9; az -= (dz / dp) * 0.9; }
          const sIdx = this.soilIndex(mf.x, mf.z);
          sN[sIdx] = Math.min(2.0, sN[sIdx] + dt * 0.0025);
          mf.energy = clamp(mf.energy + dt * 0.02, 0.25, 1.15);
        } else {
          // Guild 0: benthic detritivore isopod climbs local soilC gradient & shreds organic matter -> N
          const sIdx = this.soilIndex(mf.x, mf.z);
          const sIdxR = this.soilIndex(mf.x + 1.2, mf.z);
          const sIdxU = this.soilIndex(mf.x, mf.z + 1.2);
          ax += (sC[sIdxR] - sC[sIdx]) * 2.5;
          az += (sC[sIdxU] - sC[sIdx]) * 2.5;
          if (sC[sIdx] > 0.2) {
            const shred = dt * 0.004 * sC[sIdx];
            sC[sIdx] -= shred;
            sN[sIdx] = Math.min(2.0, sN[sIdx] + shred * 1.15);
            mf.energy = clamp(mf.energy + dt * 0.03, 0.25, 1.2);
          }
        }
        mf.vx = clamp(mf.vx * 0.82 + ax * dt * 2.5, -0.95, 0.95);
        mf.vz = clamp(mf.vz * 0.82 + az * dt * 2.5, -0.95, 0.95);
        mf.x = clamp(mf.x + mf.vx * dt, -WORLD + 1.5, WORLD - 1.5);
        mf.z = clamp(mf.z + mf.vz * dt, -WORLD + 1.5, WORLD - 1.5);
        const hop = mf.guild === 2 ? 0.035 * Math.max(0, Math.sin(mf.ph)) : 0.015 * Math.sin(mf.ph);
        mf.y = this.height(mf.x, mf.z) + (mf.guild === 1 ? 0.07 : 0.04) + hop;
        mf.energy = Math.max(0.2, mf.energy - dt * 0.012);
        mfBio += mf.energy;
      }
      this.microFaunaBiomass = mfBio;
    }

    // 4) Underground Mycelial Fungal Network: redistribute soil N/C & systemic plant defense signals!
    for (let e = 0; e < this.mycelia.length; e++) {
      const m = this.mycelia[e];
      const pa = this.plants[m.a], pb = this.plants[m.b];
      const ia = this.soilIndex(pa.x, pa.z), ib = this.soilIndex(pb.x, pb.z);
      const dN = (sN[ia] - sN[ib]) * 0.14 * m.cond * dt;
      const dC = (sC[ia] - sC[ib]) * 0.12 * m.cond * dt;
      sN[ia] -= dN; sN[ib] += dN;
      sC[ia] -= dC; sC[ib] += dC;
      m.flux = Math.abs(dN) + Math.abs(dC);
      // Systemic mycorrhizal stress signaling: grazed plant warns connected neighbors!
      const dStress = (pa.stress - pb.stress) * 0.25 * dt;
      pa.stress = clamp(pa.stress - dStress, 0, 1);
      pb.stress = clamp(pb.stress + dStress, 0, 1);
      m.cond = clamp(m.cond + dt * (0.04 * m.flux - 0.002 * (m.cond - 0.65)), 0.3, 1.4);
    }

    let nTot = 0;
    for (let i = 0; i < sN.length; i++) {
      sN[i] = clamp(sN[i] + dt * 0.003 * (0.48 - sN[i]), 0.08, 2.0);
      sC[i] = clamp(sC[i] + dt * 0.003 * (0.45 - sC[i]), 0.08, 2.0);
      nTot += sN[i];
    }
    this.meanSoilN = nTot / sN.length;

    // Co-evolution & nutrient-coupled fruiting when Ecosystem is active
    if (this.coEvolvePlants) {
      for (let k = 0; k < SITES; k++) {
        const q = this.plants[k];
        q.stress = Math.max(0, q.stress - dt * 0.02);
        const si = this.soilIndex(q.x, q.z);
        const fert = 0.6 + 0.5 * (sN[si] + sC[si]);
        if (q.fruit < 1) {
          const boost = dt * 0.012 * fert * seasonGrow * (1 + 0.35 * q.pollinated);
          q.fruit = Math.min(1, q.fruit + boost);
          sN[si] = Math.max(0.08, sN[si] - boost * 0.06);
        }
        q.pollinated = Math.max(0, q.pollinated - dt * 0.015);
        // When heavily grazed (fruit < 0.08), sprout next-generation seed variant with slight trait mutation
        if (q.fruit < 0.08 && this.re() < dt * 0.08) {
          q.gen++;
          q.sugarTrait = clamp(q.sugarTrait + (this.re() - 0.5) * 0.12 + 0.04 * (sC[si] - 0.45), 0.65, 1.55);
          q.defenseTrait = clamp(q.defenseTrait + (this.re() - 0.5) * 0.10 + 0.08 * q.stress, 0.05, 1.45);
          q.crownScale = clamp(0.82 + 0.28 * q.sugarTrait, 0.75, 1.45);
          q.p = clamp(q.pBase * (0.85 + 0.22 * q.sugarTrait), 0.05, 0.72);
        }
      }
    }

    // 5) 64x64x3 Semi-Lagrangian Wind Advection + 5-point Diffusion + Decay
    const P = this.pher, T = this.pherTmp;
    const cellSize = (2 * WORLD) / N_PHER;
    const shiftX = (this.wind.x * 0.32 * dt) / cellSize;
    const shiftZ = (this.wind.z * 0.32 * dt) / cellSize;
    const diff = clamp(0.18 * dt * 6, 0, 0.22);
    const decay0 = Math.exp(-dt * 0.045); // food trail persists ~22 s
    const decay1 = Math.exp(-dt * 0.085); // alarm Schreckstoff persists ~12 s
    const decay2 = Math.exp(-dt * 0.035); // mate plume persists ~28 s
    let pSum = 0;

    for (let iz = 0; iz < N_PHER; iz++) {
      const sz = clamp(Math.round(iz - shiftZ), 0, N_PHER - 1);
      const zU = sz > 0 ? sz - 1 : 0, zD = sz + 1 < N_PHER ? sz + 1 : N_PHER - 1;
      for (let ix = 0; ix < N_PHER; ix++) {
        const sx = clamp(Math.round(ix - shiftX), 0, N_PHER - 1);
        const xL = sx > 0 ? sx - 1 : 0, xR = sx + 1 < N_PHER ? sx + 1 : N_PHER - 1;
        const dst = (iz * N_PHER + ix) * 3;
        const c0 = (sz * N_PHER + sx) * 3;
        const l0 = (sz * N_PHER + xL) * 3, r0 = (sz * N_PHER + xR) * 3;
        const u0 = (zU * N_PHER + sx) * 3, d0 = (zD * N_PHER + sx) * 3;

        const v0 = ((1 - 4 * diff) * P[c0] + diff * (P[l0] + P[r0] + P[u0] + P[d0])) * decay0;
        const v1 = ((1 - 4 * diff) * P[c0 + 1] + diff * (P[l0 + 1] + P[r0 + 1] + P[u0 + 1] + P[d0 + 1])) * decay1;
        const v2 = ((1 - 4 * diff) * P[c0 + 2] + diff * (P[l0 + 2] + P[r0 + 2] + P[u0 + 2] + P[d0 + 2])) * decay2;
        T[dst] = v0 < 1e-4 ? 0 : v0;
        T[dst + 1] = v1 < 1e-4 ? 0 : v1;
        T[dst + 2] = v2 < 1e-4 ? 0 : v2;
        pSum += T[dst] + T[dst + 1] + T[dst + 2];
      }
    }
    P.set(T);
    this.totalPheromone = pSum;
    this.pherMean = pSum / (N_PHER * N_PHER * 3);

    // 6) Pass 20: Geodesic Biodome Homeostasis, FMO ENAQT Photosynthesis, p-Bit Ising Mycelia,
    //    Reality-Glitch Seams, DomeStones, DomeCaches, Exuvia & 11-Pool FP64 First-Law Ledger
    this.stepDomePhysics(dt, seasonGrow);
  }

  /** Step Two-Layer Geodesic Biodome physics, quantum flora/mycelia, manipulable Things & FP64 First-Law Ledger */
  stepDomePhysics(dt, seasonGrow = 1.0) {
    const D = this.dome;
    const rd = this.rd;
    if (!D || !rd) return;

    // 6a) FMO Vibronic-Exciton ENAQT Photosynthesis + Watson-Lovelock Daisyworld Albedo Co-Regulation
    let albSum = 0, enaqtMean = 0, photoKJ = 0;
    for (let k = 0; k < SITES; k++) {
      const q = this.plants[k];
      const tLeaf = this.ambientTemp(q.x, q.z, 12.5) + 3.2 * (0.5 - (q.albedoTrait ?? 0.4));
      // Thermal dephasing rate gamma_phi(T_leaf) -> authentic ENAQT bell curve (Anderson freeze < optimal ~24C < Zeno trap)
      const gammaRatio = Math.exp((tLeaf - 24.0) / 11.5);
      q.enaqtEff = clamp((0.96 * gammaRatio) / (0.36 + 0.62 * gammaRatio + 0.34 * gammaRatio * gammaRatio), 0.18, 0.95);
      // Classical Förster incoherent hopping surrogate (monotonically slower, lacks vibronic delocalization peak)
      q.forsterEff = clamp(0.74 * (gammaRatio / (0.85 + gammaRatio)), 0.15, 0.76);

      // Daisyworld selection: cool microclimates favor dark heat-absorbing crowns (low albedo); hot favor pale reflective crowns
      const targetAlb = tLeaf < 22.0 ? 0.16 : tLeaf > 24.0 ? 0.78 : 0.42;
      q.albedoTrait = clamp((q.albedoTrait ?? 0.42) + dt * 0.015 * (targetAlb - (q.albedoTrait ?? 0.42)), 0.12, 0.85);
      albSum += q.albedoTrait;
      enaqtMean += q.enaqtEff;
      photoKJ += dt * 0.035 * q.enaqtEff * seasonGrow * (0.4 + 0.6 * q.fruit);
    }
    D.albedo = albSum / SITES;
    D.meanEnaqt = enaqtMean / SITES;
    // Daisyworld planetary energy balance: absorbed solar (1 - albedo) vs radiative cooling buffers greenhouseDeltaC!
    const solarAbsorbed = 1.0 - D.albedo; // [0.15 .. 0.88]
    const co2Forcing = 0.85 * Math.log2(Math.max(200, D.co2) / 410.0);
    const eqDeltaC = 2.6 * (solarAbsorbed - 0.58) + co2Forcing;
    D.greenhouseDeltaC = clamp(D.greenhouseDeltaC + dt * 0.08 * (eqDeltaC - D.greenhouseDeltaC), -2.5, 2.8);

    // 6b) Cahan-Datta Room-Temperature Stochastic p-Bit Ising Root Network (classical Boltzmann network)
    if (this.isingSpins) {
      let mSum = 0;
      for (let k = 0; k < SITES; k++) {
        let hField = 1.6 * ((this.plants[k].stress || 0) - 0.25);
        for (let e = 0; e < this.mycelia.length; e++) {
          const ed = this.mycelia[e];
          if (ed.a === k) hField += 0.45 * ed.cond * this.isingSpins[ed.b];
          else if (ed.b === k) hField += 0.45 * ed.cond * this.isingSpins[ed.a];
        }
        const pUp = 0.5 * (1 + Math.tanh(1.35 * hField));
        this.isingSpins[k] = rd() < pUp ? 1 : -1;
        mSum += this.isingSpins[k];
      }
      D.isingOrder = Math.abs(mSum) / SITES;
    }

    // 6c) Atmospheric O2 / CO2 biogeochemical balance & Cosmic-Ray Aurora Storms (clamped <= 0.4 Hz smooth envelope!)
    D.auroraPhase = (D.auroraPhase + dt * 0.14) % (Math.PI * 2);
    const stormWave = Math.max(0, Math.sin(D.auroraPhase) * Math.sin(D.auroraPhase * 0.37 + 1.1) - 0.52) / 0.48;
    D.auroraStorm = clamp(0.88 * D.auroraStorm + 0.12 * stormWave, 0, 1);
    D.humidity = clamp(0.48 + 0.38 * (this.wind.rain || 0) + 0.08 * Math.sin(this.t * 0.03), 0.25, 0.96);
    // Photosynthesis fixes CO2 -> O2; soil microbe + fauna respiration oxidizes C -> CO2
    const respRate = 0.018 * (this.microbeTotalPop / 5.2e6);
    D.o2 = clamp(D.o2 + dt * (0.042 * D.meanEnaqt - 0.034 * respRate + 0.01 * (20.95 - D.o2)), 19.2, 22.8);
    D.co2 = clamp(D.co2 + dt * (4.2 * respRate - 4.8 * D.meanEnaqt + 0.08 * (412 - D.co2)), 320, 620);
    D.pressureKPa = 101.32 + 0.45 * Math.sin(this.t * 0.015) - 0.35 * (this.wind.rain || 0);

    // 6d) Orbiting Reality-Glitch Anomaly Seams, Quantum Monoliths & Big-Tree Sanctuaries
    for (let i = 0; i < this.anomalyZones.length; i++) {
      const az = this.anomalyZones[i];
      az.ang = (az.ang + dt * az.omega) % (Math.PI * 2);
      az.x = Math.cos(az.ang) * az.dist;
      az.z = Math.sin(az.ang) * az.dist;
      az.y = this.height(az.x, az.z) + 0.35;
    }
    for (let i = 0; i < this.monoliths.length; i++) {
      const mn = this.monoliths[i];
      mn.phase = (mn.phase + dt * 1.6) % (Math.PI * 2); // ~0.25 Hz (< 3 Hz photosensitive limit!)
      mn.charge = clamp(mn.charge + dt * 0.025, 0.2, 1.0);
    }
    for (let i = 0; i < this.sanctuaries.length; i++) {
      const sc = this.sanctuaries[i];
      sc.nectar = clamp(sc.nectar + dt * 0.018 * seasonGrow, 0, 1.0);
    }

    // 6e) Movable DomeStones friction + Cairn Shelter Detection, Spoiling DomeCaches, Slime & Exuvia Recycling
    for (let i = 0; i < this.domeStones.length; i++) {
      const st = this.domeStones[i];
      if (!st.heldBy) {
        st.x += st.vx * dt;
        st.z += st.vz * dt;
        const damp = Math.exp(-dt * 4.2);
        st.vx *= damp;
        st.vz *= damp;
        const b = this.enforceDomeBoundary(st.x, st.z, st.vx, st.vz, 0.8);
        st.x = b.x; st.z = b.z; st.vx = b.vx; st.vz = b.vz;
        st.y = this.height(st.x, st.z) + st.r * 0.72;
      }
      let nbrs = 0;
      for (let j = 0; j < this.domeStones.length; j++) {
        if (i !== j && (st.x - this.domeStones[j].x) ** 2 + (st.z - this.domeStones[j].z) ** 2 < 1.69) nbrs++;
      }
      st.cairnNeighbors = nbrs;
    }

    for (let i = 0; i < this.domeCaches.length; i++) {
      const dc = this.domeCaches[i];
      if (dc.energy > 0.02) {
        const spoil = Math.min(dc.energy, dt * 0.0025);
        dc.energy -= spoil;
        dc.freshness = clamp(dc.freshness - dt * 0.003, 0.1, 1.0);
        this.transferEnergy(0, 8, spoil); // cache spoilage -> detritus!
        const sIdx = this.soilIndex(dc.x, dc.z);
        this.soilC[sIdx] = Math.min(2.0, this.soilC[sIdx] + spoil * 0.25);
      } else if (rd() < dt * 0.04) {
        // Replenish cache from flora surplus conservatively
        const refill = this.transferEnergy(0, 1, 0.65);
        if (refill > 0.1) {
          this.transferEnergy(1, 0, refill); // stays in flora/cache chemical store until eaten
          dc.energy = refill;
          dc.freshness = 1.0;
        }
      }
    }

    for (let i = this.slimeTrails.length - 1; i >= 0; i--) {
      this.slimeTrails[i].strength -= dt * 0.018;
      if (this.slimeTrails[i].strength <= 0.02) this.slimeTrails.splice(i, 1);
    }

    for (let i = this.exuvia.length - 1; i >= 0; i--) {
      const ex = this.exuvia[i];
      ex.age += dt;
      const decay = Math.min(ex.mineral, dt * 0.012);
      ex.mineral -= decay;
      const sIdx = this.soilIndex(ex.x, ex.z);
      this.soilN[sIdx] = Math.min(2.0, this.soilN[sIdx] + decay * 0.18);
      this.soilC[sIdx] = Math.min(2.0, this.soilC[sIdx] + decay * 0.15);
      if (ex.mineral <= 0.03) this.exuvia.splice(i, 1);
    }

    // 6f) First-Law Dome Energy Ledger Fluxes + Exact Stefan-Boltzmann Radiative Cap + Closure Audit
    const geoKJ = dt * 0.095 * this.vents.length;
    this.injectExternalEnergy(0, photoKJ * (1 - 0.35 * D.albedo), 'solar');
    this.injectExternalEnergy(9, geoKJ + photoKJ * 0.25, 'geothermal');
    this.transferEnergy(8, 9, dt * 0.04 * respRate); // microbial respiration: detritus -> heatPhys
    // Stefan-Boltzmann radiative rejection sigma * A * T^4 linearized around 295 K
    const tKelvinRatio = (273.15 + 21.5 + D.greenhouseDeltaC) / 295.0;
    const radKJ = dt * 0.34 * Math.pow(tKelvinRatio, 4);
    const actualRad = this.radiateHeat(radKJ);
    D.stefanBoltzmannKW = actualRad / Math.max(1e-4, dt);
    this.auditEnergyClosure();
  }

  /** one environment step (dt seconds of sim time); tick = metabolic minute counter */
  step(dt, tick) {
    this.t += dt;
    this.morph += dt * 0.004;
    const W = this.wind, r = this.r;
    if (r() < dt * 0.05) {
      W.tx = (r() - 0.5) * 3;
      W.tz = (r() - 0.5) * 3;
      W.rainT = r() < 0.3 ? 1 : 0;
    }
    W.x += (W.tx - W.x) * dt * 0.2;
    W.z += (W.tz - W.z) * dt * 0.2;
    W.rain += ((W.rainT || 0) - W.rain) * dt * 0.1;
    for (const q of this.plants) {
      if (q.fruit < 1) q.fruit = Math.min(1, q.fruit + dt * (0.02 + 0.03 * W.rain));
    }
    for (const s of this.springs) {
      s.v += (-40 * s.comp - 4 * s.v) * dt;
      s.comp += s.v * dt;
      s.comp = clamp(s.comp, -0.3, 0.6);
    }
    for (const s of this.snacks) {
      if (s.held) continue;
      if (s.y > this.height(s.x, s.z) + 0.15) {
        s.vy = (s.vy || 0) - 9.8 * dt;
        s.y += s.vy * dt;
      } else {
        s.vy = 0;
        s.y = this.height(s.x, s.z) + 0.15;
      }
    }
    for (const w of this.waste) w.age += dt;
    this.waste = this.waste.filter((w) => w.age < 120);
    if (Math.floor(this.t / 2) !== Math.floor((this.t - dt) / 2)) this.fixY();

    this._ecoAcc += dt;
    if (!this.fastEval && this._ecoAcc >= 0.1) {
      const dte = this._ecoAcc;
      this._ecoAcc = 0;
      this.stepBiosphereGrid(dte);
    }
  }

  dropSnack(x, z, y) {
    if (this.snacks.length > 24) this.snacks.shift();
    this.snacks.push({ x, z, y: y ?? this.height(x, z) + 4, vy: 0, kind: this.r() < 0.5 ? 'sugar' : 'fat', id: Math.floor(this.r() * 1e9), held: false });
  }
  addRock(x, z, rad = 1.2) {
    if (this.rocks.length > 20) this.rocks.shift();
    this.rocks.push({ x, z, r: rad, y: this.height(x, z) + rad * 0.35 });
  }
  addSpring(x, z) {
    if (this.springs.length > 10) this.springs.shift();
    this.springs.push({ x, z, r: 1.3, comp: 0, v: 0, y: this.height(x, z) });
  }
  addVent(x, z) {
    if (this.vents.length > 8) this.vents.shift();
    this.vents.push({ x, z, y: this.height(x, z), r: 1.8, heat: 1.05, mineral: 0.9, phase: 0 });
  }
}
