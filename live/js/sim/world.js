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
export const N_SOIL = 32;
export const N_PHER = 64;
export const N_MICRO = 64;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

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
        initPop += (m0 + pk0) * 1000;
        if (poolW > 0.2) { pBloomSum += pk0; pBloomCnt++; }
      }
    }
    this.microbeTotalPop = Math.round(initPop); // > 1.4M microorganisms across the 4,096 spatial cells
    this.planktonBloom = pBloomCnt > 0 ? clamp(pBloomSum / (pBloomCnt * 2.6), 0, 1) : 0.65;

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
  }

  /** Local microclimate temperature (C) at (x, z) given solar hour, season, altitude, rain & geothermal vents */
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
    return 21.5 + seasonal + diurnal + altCool + rainCool + ventWarmth;
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
        popSum += (mNext + pkNext) * 1000;
      }
    }
    MG.set(MT);
    this.microbeTotalPop = Math.round(popSum);
    this.planktonBloom = pBloomCnt > 0 ? clamp(pBloomSum / (pBloomCnt * 2.6), 0.05, 1.0) : 0.65;

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
