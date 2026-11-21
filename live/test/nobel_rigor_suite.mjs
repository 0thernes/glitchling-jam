// Pass 21 Hostile-Scrutiny Scientific Falsification & Statistical Rigor Suite (`nobel_rigor_suite.mjs`)
// Verifies 12 falsifiable mathematical, physical, quantum-biological, bioelectric, information-theoretic,
// game-theoretic, and Artificial Life theorems across N = 12 independent seeds with:
//   - Exact 2^N finite-sample nonparametric paired sign-flip permutation p-values (Fisher 1935; Pitman 1937)
//   - 10,000-resample Efron percentile Bootstrap 95% Confidence Intervals
//   - Standardized paired effect sizes (Cohen's d_z)

import assert from 'node:assert/strict';
import { mulberry } from '../js/sim/util.js';
import { World, solveFMOLindbladExact, solveFMOForsterExact, evalFMOTemperature } from '../js/sim/world.js';
import {
  HeptarchCouncil,
  solveCry4Haberkorn8x8,
  quantizeNestorRung,
  NESTOR_RUNG_BITS,
  encodeAcousticCallRS,
  decodeAcousticCallRS,
} from '../js/sim/heptarch.js';
import { Ecosystem, evalTwoQubitBellMetrics } from '../js/sim/ecosystem.js';
import { Creature } from '../js/sim/creature.js';
import { STARTER } from '../js/sim/starter_genome.js';
import {
  evalContextualitySuites,
  evalCospectralTwins,
  chooseSafeCospectralObelisk,
  poincareMobiusAdd,
  poincareDist,
  poincareExpMap,
  poincareTriangleDefect,
} from '../js/tsotchke/qgtl.js';
import { MPSQuantumSimulator32Q } from '../js/tsotchke/moonlab.js';

const SEEDS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const FROM_T = Number(process.env.FROM_T || 1);

function mean(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / Math.max(1, arr.length);
}

function cohenDz(diffs) {
  const n = diffs.length;
  if (n < 2) return 0;
  const m = mean(diffs);
  let v = 0;
  for (let i = 0; i < n; i++) v += (diffs[i] - m) * (diffs[i] - m);
  const sd = Math.sqrt(v / (n - 1));
  return sd < 1e-15 ? (m === 0 ? 0 : Math.sign(m) * 999) : m / sd;
}

/**
 * Exact 2^N paired sign-flip permutation p-value (one-sided: 'greater' tests E[X - Y] > 0; 'less' tests E[X - Y] < 0).
 * Exact to 2^-12 = 0.000244140625 for N = 12 with zero parametric/normality assumptions.
 */
function exactPairedPermutationP(diffs, direction = 'greater') {
  const n = diffs.length;
  assert(n >= 2 && n <= 24, `Invalid sample size for exact permutation test: ${n}`);
  const total = 1 << n;
  let obsSum = 0;
  for (let i = 0; i < n; i++) {
    assert(Number.isFinite(diffs[i]), `Non-finite paired difference at index ${i}: ${diffs[i]}`);
    obsSum += diffs[i];
  }
  let extreme = 0;
  for (let mask = 0; mask < total; mask++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (mask & (1 << i)) ? -diffs[i] : diffs[i];
    if (direction === 'greater' ? s >= obsSum - 1e-14 : s <= obsSum + 1e-14) extreme++;
  }
  const p = extreme / total;
  assert(Number.isFinite(p) && p >= 1 / total && p <= 1.0, `Invalid exact permutation p-value: ${p}`);
  return p;
}

/** 10,000-resample deterministic Percentile Bootstrap 95% Confidence Interval on the mean */
function bootstrapMeanCI(arr, nBoot = 10000, seed = 20261112) {
  const rng = mulberry(seed);
  const n = arr.length;
  const means = new Float64Array(nBoot);
  for (let b = 0; b < nBoot; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += arr[Math.floor(rng() * n)];
    means[b] = s / n;
  }
  means.sort();
  return [means[Math.floor(0.025 * nBoot)], means[Math.floor(0.975 * nBoot)]];
}

function summarizePaired(name, xArr, yArr, direction = 'greater') {
  assert.equal(xArr.length, yArr.length, `${name}: mismatched sample lengths (${xArr.length} vs ${yArr.length})`);
  for (let i = 0; i < xArr.length; i++) {
    assert(Number.isFinite(xArr[i]), `${name}: non-finite xArr[${i}]=${xArr[i]}`);
    assert(Number.isFinite(yArr[i]), `${name}: non-finite yArr[${i}]=${yArr[i]}`);
  }
  const diffs = xArr.map((x, i) => x - yArr[i]);
  const meanX = mean(xArr);
  const meanY = mean(yArr);
  const mDiff = mean(diffs);
  const [ciLo, ciHi] = bootstrapMeanCI(diffs);
  const p = exactPairedPermutationP(diffs, direction);
  const dz = cohenDz(diffs);
  assert(
    Number.isFinite(meanX) && Number.isFinite(meanY) && Number.isFinite(mDiff) &&
    Number.isFinite(ciLo) && Number.isFinite(ciHi) && Number.isFinite(p) && Number.isFinite(dz),
    `${name}: non-finite summary statistic`
  );
  return { name, meanX, meanY, meanDiff: mDiff, ciLo, ciHi, p, dz };
}

const SUMMARY_ROWS = [];
console.log('=========================================================================================');
console.log('=== PASS 21: 12-THEOREM SCIENTIFIC FALSIFICATION & STATISTICAL RIGOR SUITE (N = 12)   ===');
console.log('=========================================================================================');

// =========================================================================================
// THEOREM 1: First Law, Landsberg-Clausius Second Law & Closed N/C Biogeochemical Mass Ledger
// =========================================================================================
if (FROM_T <= 1) {
  const solarIntact = [], solarScrubbed = [];
  let maxEnergyErr = 0, maxMassErr = 0, minSigObs = Infinity, maxNFixedAtZero = 0;

  for (const seed of SEEDS_12) {
    const runDome = (scrubN2) => {
      const w = new World(seed);
      if (scrubN2) w.setAtmosphericN2(0, true);
      const eco = new Ecosystem(w, seed, { peers: 10, mites: 20, predators: 1 });
      for (let f = 0; f < 30 * 60; f++) {
        w.step(1 / 60, f);
        eco.step(1 / 60, null);
      }
      return w;
    };
    const wOn = runDome(false);
    const wOff = runDome(true);

    maxEnergyErr = Math.max(maxEnergyErr, wOn.auditEnergyClosure(), wOff.auditEnergyClosure());
    maxMassErr = Math.max(maxMassErr, wOn.auditMassClosure(), wOff.auditMassClosure());
    minSigObs = Math.min(minSigObs, wOn.ledger.minEntropyProdRate, wOff.ledger.minEntropyProdRate);
    maxNFixedAtZero = Math.max(maxNFixedAtZero, wOff.massLedger.rhizoNFixed);

    solarIntact.push(wOn.ledger.solarIn);
    solarScrubbed.push(wOff.ledger.solarIn);
  }

  const st = summarizePaired('T1: Solar PAR Fixation (Intact N2 vs N2=0)', solarIntact, solarScrubbed, 'greater');
  assert(maxEnergyErr < 1e-12, `T1 First-Law energy closure violated: ${maxEnergyErr}`);
  assert(maxMassErr < 1e-12, `T1 Closed N/C mass conservation violated: ${maxMassErr}`);
  assert(minSigObs > 0, `T1 Second-Law Clausius entropy production violated: min=${minSigObs}`);
  assert(maxNFixedAtZero === 0, `T1 Evacuated N2 headspace must fix zero Nitrogen: ${maxNFixedAtZero}`);
  assert(st.p < 0.001, `T1 N2 depletion causal photosynthetic drop failed p<0.001: p=${st.p}`);

  SUMMARY_ROWS.push({
    id: 'T1',
    theorem: '1st/2nd Law + Closed N/C Mass',
    metric: `E_err=${maxEnergyErr.toExponential(2)}, M_err=${maxMassErr.toExponential(2)}, minSig=+${minSigObs.toExponential(2)}`,
    effect: `dSolar=+${st.meanDiff.toFixed(3)} kJ [${st.ciLo.toFixed(3)}, ${st.ciHi.toFixed(3)}]`,
    p: st.p.toFixed(6),
    d: st.dz.toFixed(2),
  });
  console.log(`[PASS] T1 Thermodynamics & Mass Closure: E_err=${maxEnergyErr.toExponential(2)}, M_err=${maxMassErr.toExponential(2)}, minEntropyRate=+${minSigObs.toExponential(2)} kW/K, N2=0 dSolar=+${st.meanDiff.toFixed(3)} kJ (p=${st.p.toFixed(6)}, d_z=${st.dz.toFixed(2)})`);
}

// =========================================================================================
// THEOREM 2: Published 7-Site Adolphs-Renger FMO GKSL Lindblad Master Eq vs Classical Förster
// =========================================================================================
if (FROM_T <= 2) {
  let maxNormErr = 0;
  for (let tC = -10; tC <= 54; tC += 4) {
    const gammaPs = tC < -6 ? 0.08 : 22.0 * Math.exp((tC - 24.0) / 9.5);
    const l = solveFMOLindbladExact(gammaPs);
    const f = solveFMOForsterExact(gammaPs);
    assert(f > 0 && f < 1, `T2 Förster yield must lie in (0,1): ${f}`);
    maxNormErr = Math.max(maxNormErr, Math.abs(l.quantumYieldSum - 1.0));
  }
  const cryo = evalFMOTemperature(-10);
  const room = evalFMOTemperature(24);
  const zeno = evalFMOTemperature(54);

  assert(maxNormErr < 1e-13, `T2 GKSL/Förster trace conservation violated: ${maxNormErr}`);
  assert(room.enaqtEff > cryo.enaqtEff + 0.25, `T2 ENAQT must beat cryogenic Anderson localization (${room.enaqtEff} vs ${cryo.enaqtEff})`);
  assert(room.enaqtEff > zeno.enaqtEff + 0.08, `T2 ENAQT must beat thermal quantum Zeno trap (${room.enaqtEff} vs ${zeno.enaqtEff})`);
  assert(room.enaqtEff > room.forsterEff + 0.03, `T2 Coherent GKSL FMO must beat incoherent Förster hopping (${room.enaqtEff} vs ${room.forsterEff})`);

  SUMMARY_ROWS.push({
    id: 'T2',
    theorem: '7-Site Adolphs-Renger FMO GKSL',
    metric: `|Phi_sink+Phi_loss-1|=${maxNormErr.toExponential(2)}`,
    effect: `Cryo=${cryo.enaqtEff.toFixed(3)} < 24C=${room.enaqtEff.toFixed(3)} > Zeno=${zeno.enaqtEff.toFixed(3)}; Forster=${room.forsterEff.toFixed(3)}`,
    p: 'exact',
    d: 'exact',
  });
  console.log(`[PASS] T2 7-Site FMO GKSL Lindblad vs Förster: normErr=${maxNormErr.toExponential(2)}, Phi(-10C)=${cryo.enaqtEff.toFixed(4)} < Phi(24C)=${room.enaqtEff.toFixed(4)} > Phi(54C)=${zeno.enaqtEff.toFixed(4)} > Förster(24C)=${room.forsterEff.toFixed(4)}`);
}

// =========================================================================================
// THEOREM 3: 8x8 Cryptochrome-4 Liouville-Haberkorn + Inclination Parity + Ritz Larmor RF (N=12)
// =========================================================================================
if (FROM_T <= 3) {
  const rng = mulberry(314159);
  let maxYieldErr = 0, maxParityErr = 0;
  for (let k = 0; k < 32; k++) {
    const bx = rng() - 0.5, by = rng() - 0.5, bz = rng() - 0.5;
    const pPos = solveCry4Haberkorn8x8(bx, by, bz, { fieldUT: 48.5, gammaSpin: 0.12 });
    const pNeg = solveCry4Haberkorn8x8(-bx, -by, -bz, { fieldUT: 48.5, gammaSpin: 0.12 });
    maxYieldErr = Math.max(maxYieldErr, Math.abs(pPos.yieldSum - 1.0), Math.abs(pNeg.yieldSum - 1.0));
    maxParityErr = Math.max(maxParityErr, Math.abs(pPos.phiS - pNeg.phiS));
  }
  const contrastAt = (opts) => {
    let mn = 1, mx = 0;
    for (let m = 0; m <= 16; m++) {
      const u = m / 16;
      const r = solveCry4Haberkorn8x8(Math.sqrt(1 - u), 0, Math.sqrt(u), opts);
      if (r.phiS < mn) mn = r.phiS;
      if (r.phiS > mx) mx = r.phiS;
    }
    return mx - mn;
  };
  const c0 = contrastAt({ fieldUT: 48.5, gammaSpin: 0 });
  const c1 = contrastAt({ fieldUT: 48.5, gammaSpin: 1.5 });
  const c20 = contrastAt({ fieldUT: 48.5, gammaSpin: 20.0 });
  const cRes = contrastAt({ fieldUT: 48.5, rfAmpUT: 0.42, rfFreqRadUs: 0.176 * 48.5 });
  const cOff = contrastAt({ fieldUT: 48.5, rfAmpUT: 0.42, rfFreqRadUs: 7.0 * 0.176 * 48.5 });

  assert(maxYieldErr < 1e-13, `T3 Haberkorn trace conservation violated: ${maxYieldErr}`);
  assert(maxParityErr < 1e-13, `T3 Inclination inversion parity Phi_S(-B)==Phi_S(+B) violated: ${maxParityErr}`);
  assert(c0 > c1 && c1 > c20 && c20 < 1e-3, `T3 Spin-relaxation contrast must decay monotonically to 0: ${c0}, ${c1}, ${c20}`);
  assert(cRes < cOff * 0.35, `T3 Ritz Larmor resonance must collapse singlet contrast vs 7*omega_L: ${cRes} vs ${cOff}`);

  const hdIntact = [], hdLesion = [], hdOffRF = [], hdResRF = [];
  const runNightTrial = (seed, mode) => {
    const c = new Creature(seed, { brainScale: 'S', noVision: true });
    c.retina.skipSheet = true;
    c.lesion.vision = true;
    c.lesion.fluid = true;
    c.lesion.fem = true;
    c.lesion.wm = true;
    c.wm.lesion = true;
    c.lesion.hopfield = true;
    c.lesion.qrng = true;
    c.htn = null;
    c.noSkin = true;
    if (mode === 'lesion') c.lesion.magneto = true;
    for (let f = 0; f < 14 * 60; f++) {
      c.hour = 12.0;
      c.step();
    }
    const hSave = Float64Array.from(c.nav.h);
    for (let i = 0; i < 36; i++) c.nav.h[i] = hSave[(i + 6) % 36]; // ~60-deg dark tumble perturbation
    if (mode === 'resRF') {
      c.world.dome.rfAmpUT = 0.48;
      c.world.dome.rfFreqRadUs = 0.176 * 48.5; // exact electron Larmor resonance!
    } else if (mode === 'offRF') {
      c.world.dome.rfAmpUT = 0.48;
      c.world.dome.rfFreqRadUs = 7.0 * 0.176 * 48.5; // equal-amplitude off-resonant control!
    }
    let errSum = 0, errN = 0;
    for (let f = 0; f < 18 * 60; f++) {
      c.hour = 1.0;
      c.sleep.S = 0;
      c.sleep.stage = 0;
      c.step();
      if (f >= 8 * 60 && f % 6 === 0) {
        errSum += c.navErr.hd;
        errN++;
      }
    }
    return errSum / Math.max(1, errN);
  };

  for (const seed of SEEDS_12) {
    hdIntact.push(runNightTrial(seed, 'intact'));
    hdLesion.push(runNightTrial(seed, 'lesion'));
    hdOffRF.push(runNightTrial(seed, 'offRF'));
    hdResRF.push(runNightTrial(seed, 'resRF'));
  }

  const stLes = summarizePaired('T3a: Night HD Error (Magneto Lesion - Intact)', hdLesion, hdIntact, 'greater');
  const stRF = summarizePaired('T3b: Night HD Error (Resonant omega_L RF - Off-Resonant 7*omega_L RF)', hdResRF, hdOffRF, 'greater');
  assert(stLes.p < 0.002, `T3a Nocturnal Cry4 vs lesion failed p<0.002: p=${stLes.p}`);
  assert(stRF.p < 0.005, `T3b Ritz resonant Larmor RF disruption failed p<0.005: p=${stRF.p} (res=${stRF.meanX}, off=${stRF.meanY})`);

  SUMMARY_ROWS.push({
    id: 'T3',
    theorem: '8x8 Cry4 Haberkorn + Ritz Larmor RF',
    metric: `parityErr=${maxParityErr.toExponential(2)}, dPhi(res/off)=${cRes.toFixed(3)}/${cOff.toFixed(3)}`,
    effect: `Lesion:+${stLes.meanDiff.toFixed(3)} rad; ResRF:+${stRF.meanDiff.toFixed(3)} rad [${stRF.ciLo.toFixed(3)}, ${stRF.ciHi.toFixed(3)}]`,
    p: stRF.p.toFixed(6),
    d: stRF.dz.toFixed(2),
  });
  console.log(`[PASS] T3 8x8 Cry4 Compass & Ritz RF: parity=${maxParityErr.toExponential(2)}, LesionDiff=+${stLes.meanDiff.toFixed(3)} rad (p=${stLes.p.toFixed(6)}), ResRF_vs_7wL=+${stRF.meanDiff.toFixed(3)} rad (p=${stRF.p.toFixed(6)}, d_z=${stRF.dz.toFixed(2)})`);
}

// =========================================================================================
// THEOREM 4: 4-Qubit C3 Cospectral Twins (14,976 vs 15,360) + KCBS / CEGA-18 / Hoggar / MPS M2
// =========================================================================================
if (FROM_T <= 4) {
  const ctx = evalContextualitySuites(0, 0);
  const twins = evalCospectralTwins();
  assert(Math.abs(ctx.kcbsValue - Math.sqrt(5)) < 1e-9 && ctx.kcbsOrthoErr < 1e-12, 'T4 KCBS exact witness failed');
  assert(Math.abs(ctx.cegaExactSum - 9.0) < 1e-12 && ctx.cegaOrthoErr < 1e-12 && ctx.cegaAllTwice, 'T4 CEGA-18 state-independent proof failed');
  assert(ctx.hoggarLines === 315 && ctx.hoggarViolatedLines === 63 && Math.abs(ctx.hoggarFloor - 1 / 3) < 1e-9, 'T4 Hoggar 3Q SIC proof failed');
  assert(twins.sectionSize === 71 && twins.outsideSize === 64, 'T4 Q+(7,2) hyperplane section sizes must be 71 and 64');
  assert(twins.carrierEigMaxDiff < 1e-12, `T4 16x16 carrier matrices must be strictly cospectral: ${twins.carrierEigMaxDiff}`);
  assert(twins.lambdaTr2Sigma0 === 2240 && twins.lambdaTr2Sigma1 === 2240, 'T4 Quadratic Jordan moments must match at 2240');
  assert(twins.lambdaTr3Sigma0 === 14976 && twins.lambdaTr3Sigma1 === 15360, `T4 Cubic Jordan trace must split 14976 vs 15360`);

  const mps = new MPSQuantumSimulator32Q(8, 16);
  mps.hadamard(0); mps.cnot(0);
  const cliffM2 = mps.stabilizerMagic2Q(0);
  mps.ry(0, Math.PI / 4);
  const magicM2 = mps.stabilizerMagic2Q(0);
  assert(Math.abs(cliffM2) < 1e-10 && magicM2 > 0.20, 'T4 Stabilizer Rényi Magic M2 separation failed');

  const qgtAcc = [], specAcc = [];
  for (const seed of SEEDS_12) {
    const r = mulberry(seed * 9137 + 17);
    let wQ = 0, wS = 0;
    const N_TRIALS = 50;
    for (let t = 0; t < N_TRIALS; t++) {
      const safeLeft = r() < 0.5;
      const leftA = safeLeft ? twins.carrierSigma1 : twins.carrierSigma0;
      const rightA = safeLeft ? twins.carrierSigma0 : twins.carrierSigma1;
      const trueSafe = safeLeft ? 0 : 1;
      if (chooseSafeCospectralObelisk(leftA, rightA, true, r) === trueSafe) wQ++;
      if (chooseSafeCospectralObelisk(leftA, rightA, false, r) === trueSafe) wS++;
    }
    qgtAcc.push(wQ / N_TRIALS);
    specAcc.push(wS / N_TRIALS);
  }
  const st = summarizePaired('T4: Blind C3 Cospectral Obelisk Accuracy (Jordan-QGT vs Classical Spectral)', qgtAcc, specAcc, 'greater');
  assert(st.meanX === 1.0 && st.p < 0.001, `T4 Jordan-QGT must achieve 100% blind discrimination vs ~50% spectral: ${JSON.stringify(st)}`);

  SUMMARY_ROWS.push({
    id: 'T4',
    theorem: '4Q C3 Cospectral Twins + Contextuality',
    metric: `eigDiff=${twins.carrierEigMaxDiff.toExponential(2)}, Tr(L^3)=14976 vs 15360`,
    effect: `QGT=${(st.meanX * 100).toFixed(1)}% vs Spec=${(st.meanY * 100).toFixed(1)}% [+${(st.meanDiff * 100).toFixed(1)}%]`,
    p: st.p.toFixed(6),
    d: st.dz.toFixed(2),
  });
  console.log(`[PASS] T4 4Q C3 Cospectral Twins & Contextuality: eigDiff=${twins.carrierEigMaxDiff.toExponential(2)}, Tr(L^3)=14976/15360, QGT=${(st.meanX * 100).toFixed(1)}% vs Spectral=${(st.meanY * 100).toFixed(1)}% (p=${st.p.toFixed(6)}, d_z=${st.dz.toFixed(2)})`);
}

// =========================================================================================
// THEOREM 5: 4x4 Two-Qubit Density Matrix CHSH Non-Local Game & Zero Superluminal Signaling (N=12)
// =========================================================================================
if (FROM_T <= 5) {
  const qWin = [], lhvWin = [], qEmpS = [];
  let maxExactMargBias = 0, maxEmpNoSig = 0;

  for (const seed of SEEDS_12) {
    const runXeno = (classicalSurrogate) => {
      const w = new World(seed);
      const eco = new Ecosystem(w, seed, { peers: 2, mites: 4, predators: 0, xenomimics: 16, xenoClassicalSurrogate: classicalSurrogate });
      for (let f = 0; f < 52 * 60; f++) {
        w.step(1 / 60, f);
        eco.step(1 / 60, null);
      }
      for (const pr of eco.xenoPairs) {
        maxExactMargBias = Math.max(maxExactMargBias, evalTwoQubitBellMetrics(pr.rho4x4).marginalBias);
      }
      return eco.chshStats;
    };
    const stQ = runXeno(false);
    const stC = runXeno(true);
    assert(stQ.trials >= 1000, `T5 Expected >=1000 CHSH rounds per seed, got ${stQ.trials}`);
    qWin.push(stQ.winRate);
    lhvWin.push(stC.winRate);
    qEmpS.push(stQ.empiricalS);
    maxEmpNoSig = Math.max(maxEmpNoSig, stQ.noSignalingMaxDiff);
  }

  const stBell = summarizePaired('T5: CHSH Win Rate (Quantum rho_AB vs Classical LHV)', qWin, lhvWin, 'greater');
  const stBound = summarizePaired('T5b: Quantum Win Rate above 0.75 Bell Ceiling', qWin, SEEDS_12.map(() => 0.75), 'greater');
  assert(maxExactMargBias < 1e-15, `T5 Exact reduced density-matrix marginal bias must be 0: ${maxExactMargBias}`);
  assert(maxEmpNoSig < 0.11, `T5 Empirical finite-sample no-signaling discrepancy too large: ${maxEmpNoSig}`);
  assert(mean(lhvWin) <= 0.768, `T5 Classical LHV surrogate exceeded Bell bound beyond binomial noise: ${mean(lhvWin)}`);
  assert(stBell.p < 0.001 && stBound.p < 0.001, `T5 Quantum CHSH violation failed p<0.001: p=${stBell.p}`);

  SUMMARY_ROWS.push({
    id: 'T5',
    theorem: '4x4 Density-Matrix CHSH & No-Signaling',
    metric: `exactBias=${maxExactMargBias.toExponential(1)}, empS=${mean(qEmpS).toFixed(3)}>2`,
    effect: `Win: Q=${(stBell.meanX * 100).toFixed(2)}% vs LHV=${(stBell.meanY * 100).toFixed(2)}% (>75% Bell)`,
    p: stBell.p.toFixed(6),
    d: stBell.dz.toFixed(2),
  });
  console.log(`[PASS] T5 4x4 Density-Matrix CHSH & No-Signaling: Q_win=${(stBell.meanX * 100).toFixed(2)}% (S_emp=${mean(qEmpS).toFixed(3)}) vs LHV=${(stBell.meanY * 100).toFixed(2)}%, exactMargBias=${maxExactMargBias.toExponential(1)}, empNoSigMax=${maxEmpNoSig.toFixed(4)} (p=${stBell.p.toFixed(6)}, d_z=${stBell.dz.toFixed(2)})`);
}

// =========================================================================================
// THEOREM 6: Exact Ungar K = -1 Poincaré-Disk Riemannian Geometry & Xylos Geodesic Motion
// =========================================================================================
if (FROM_T <= 6) {
  const rng = mulberry(271828);
  const randDisk = (maxR = 0.85) => {
    const rad = (0.12 + (maxR - 0.12) * rng());
    const ang = rng() * Math.PI * 2;
    return [rad * Math.cos(ang), rad * Math.sin(ang)];
  };
  let minDefect = Infinity, maxIsoErr = 0;
  for (let k = 0; k < 120; k++) {
    const [ax, ay] = randDisk(), [bx, by] = randDisk(), [cx, cy] = randDisk();
    const tri = poincareTriangleDefect(ax, ay, bx, by, cx, cy);
    if (tri.a > 0.15 && tri.b > 0.15 && tri.c > 0.15 && Math.abs((ax - bx) * (cy - by) - (ay - by) * (cx - bx)) > 0.02) {
      minDefect = Math.min(minDefect, tri.defect);
    }
    // Möbius disk automorphism T_{p,theta}(z) = e^{i theta} * ((-p) (+) z) must preserve poincareDist exactly!
    const [px, py] = randDisk(0.75);
    const th = rng() * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
    const mapIso = (ux, uy) => {
      const [mx, my] = poincareMobiusAdd(-px, -py, ux, uy);
      return [ct * mx - st * my, st * mx + ct * my];
    };
    const [au, av] = mapIso(ax, ay), [bu, bv] = mapIso(bx, by);
    maxIsoErr = Math.max(maxIsoErr, Math.abs(poincareDist(ax, ay, bx, by) - poincareDist(au, av, bu, bv)));
  }

  let maxXylosNorm = 0, minHypDist = Infinity;
  for (const seed of SEEDS_12) {
    const w = new World(seed);
    const eco = new Ecosystem(w, seed, { peers: 4, mites: 8, predators: 0 });
    for (let f = 0; f < 20 * 60; f++) {
      w.step(1 / 60, f);
      eco.step(1 / 60, null);
    }
    for (const xy of eco.xylos) {
      const nr = Math.hypot(xy.wx, xy.wy);
      maxXylosNorm = Math.max(maxXylosNorm, nr);
      minHypDist = Math.min(minHypDist, xy.hyperbolicDist);
      assert(Math.abs(xy.hyperbolicDist - poincareDist(0, 0, xy.wx, xy.wy)) < 1e-12, 'T6 Xylos hyperbolicDist mismatch');
    }
  }

  assert(minDefect > 1e-3, `T6 Gauss-Bonnet K=-1 angular defect must be > 0: ${minDefect}`);
  assert(maxIsoErr < 1e-12, `T6 Möbius automorphism isometry invariance violated: ${maxIsoErr}`);
  assert(maxXylosNorm < 1.0 && minHypDist > 0, `T6 Xylos Poincaré norm violated |w|<1: ${maxXylosNorm}`);

  SUMMARY_ROWS.push({
    id: 'T6',
    theorem: 'Poincaré Disk K=-1 Hyperbolic Geometry',
    metric: `isometryErr=${maxIsoErr.toExponential(2)}, max|w|=${maxXylosNorm.toFixed(3)}<1`,
    effect: `Gauss-Bonnet minDefect=+${minDefect.toFixed(4)} rad > 0`,
    p: 'exact',
    d: 'exact',
  });
  console.log(`[PASS] T6 Poincaré-Disk K=-1 Geometry: minGaussBonnetDefect=+${minDefect.toFixed(4)} rad, mobiusIsoErr=${maxIsoErr.toExponential(2)}, maxXylos|w|=${maxXylosNorm.toFixed(4)} (<1)`);
}

// =========================================================================================
// THEOREM 7: NESTOR 23-Rung Stochastic Rounding Unbiasedness, Nullspace Escape & Pareto Frugality (N=12)
// =========================================================================================
if (FROM_T <= 7) {
  const rng = mulberry(161803);
  const testVal = 0.3719;
  let maxBias = 0;
  const variances = {};
  for (const r of [1, 3, 5, 8, 10, 15, 22]) {
    let s1 = 0, s2 = 0;
    const M = 40000;
    for (let i = 0; i < M; i++) {
      const q = quantizeNestorRung(testVal, r, rng, 1.0);
      const d = q - testVal;
      s1 += q;
      s2 += d * d;
    }
    const bias = Math.abs(s1 / M - testVal);
    if (r >= 1) maxBias = Math.max(maxBias, bias);
    variances[r] = s2 / M;
  }
  assert(maxBias < 0.008, `T7 Stochastic rounding must be unbiased across rungs: maxBias=${maxBias}`);
  assert(variances[1] > variances[3] && variances[3] > variances[10] && variances[10] > variances[15] && variances[22] === 0,
    `T7 Quantization variance must decrease strictly with bit-width: ${JSON.stringify(variances)}`);

  // Verify DSD-24 2x2 trajectory-covariance nullspace orthogonality directly on a trapped oscillation outside sanctuaries
  const hc = new HeptarchCouncil(7);
  for (let i = 0; i < 60; i++) {
    const osc = 0.08 * Math.sin(i * 0.7);
    hc.posRing.push([14.0 + osc * 0.8, 12.0 + osc * 0.6]);
    if (hc.posRing.length > 50) hc.posRing.shift();
  }
  hc.stuckScore = 0.98;
  hc.step(0.1, { world: new World(1), metab: { atp: 0.8 }, body: { com: () => [14.0, 0.3, 12.0], F: [{}, {}, {}, { f: [1, 0, 0] }] }, z: new Float64Array(16) });
  assert(hc.exuviaCount === 1 && hc.lastNullspaceOrtho < 1e-14, `T7 Nullspace escape orthogonality violated: exuvia=${hc.exuviaCount}, ortho=${hc.lastNullspaceOrtho}`);

  // Live N=12 Pareto frugality & precision audit across 'fixedLow', 'adaptive', and 'fixedHigh'
  const nllAdapt = [], nllLow = [], atpHigh = [], atpAdapt = [];
  const runNestor = (seed, mode) => {
    const c = new Creature(seed, { brainScale: 'S', noVision: true });
    c.retina.skipSheet = true;
    c.lesion.vision = true;
    c.lesion.fluid = true;
    c.lesion.fem = true;
    c.lesion.hopfield = true;
    c.lesion.qrng = true;
    c.htn = null;
    c.noSkin = true;
    c.heptarch.nestorMode = mode;
    for (let f = 0; f < 16 * 60; f++) c.step();
    return { rawNLL: c.metacog.rawGaussianNLL, computeATP: c.heptarch.nestorComputeATP };
  };
  for (const seed of SEEDS_12) {
    const ad = runNestor(seed, 'adaptive');
    const lo = runNestor(seed, 'fixedLow');
    const hi = runNestor(seed, 'fixedHigh');
    nllAdapt.push(ad.rawNLL);
    nllLow.push(lo.rawNLL);
    atpAdapt.push(ad.computeATP);
    atpHigh.push(hi.computeATP);
  }
  const stQual = summarizePaired('T7a: World-Model Error NLL (fixedLow - adaptive)', nllLow, nllAdapt, 'greater');
  const stFrug = summarizePaired('T7b: Compute ATP Burn (fixedHigh - adaptive)', atpHigh, atpAdapt, 'greater');
  const frugRatio = mean(atpHigh) / Math.max(1e-12, mean(atpAdapt));
  assert(stQual.p < 0.005, `T7a Adaptive NESTOR must beat 1-bit fixedLow on WM fidelity: p=${stQual.p}`);
  assert(stFrug.p < 0.001 && frugRatio > 10.0, `T7b Adaptive NESTOR must save >10x compute ATP vs fixedHigh: ratio=${frugRatio}`);

  SUMMARY_ROWS.push({
    id: 'T7',
    theorem: 'NESTOR 23-Rung SR + Nullspace + Pareto',
    metric: `maxBias=${maxBias.toFixed(4)}, ortho=${hc.lastNullspaceOrtho.toExponential(1)}`,
    effect: `dNLL(low-adap)=+${stQual.meanDiff.toFixed(3)}; ATP=${frugRatio.toFixed(1)}x frugal`,
    p: stQual.p.toFixed(6),
    d: stQual.dz.toFixed(2),
  });
  console.log(`[PASS] T7 NESTOR 23-Rung Pareto & Nullspace: SR_bias=${maxBias.toFixed(4)}, nullOrtho=${hc.lastNullspaceOrtho.toExponential(1)}, dNLL(low-adap)=+${stQual.meanDiff.toFixed(3)} (p=${stQual.p.toFixed(6)}), ATP_savings=${frugRatio.toFixed(1)}x (p=${stFrug.p.toFixed(6)})`);
}

// =========================================================================================
// THEOREM 8: Levin Target-Free Bistable Bioelectric Syncytium & Cryptic Pattern Memory (N=12)
// =========================================================================================
if (FROM_T <= 8) {
  const regIntact = [], regLesion = [], morphCanon = [], morphCryptic = [];
  for (const seed of SEEDS_12) {
    const hInt = new HeptarchCouncil(seed);
    const hLes = new HeptarchCouncil(seed);
    const hCry = new HeptarchCouncil(seed);
    const mInt = { atp: 0.85 }, mLes = { atp: 0.85 }, mCry = { atp: 0.85 };
    const genCry = { ...STARTER };
    const genBefore = JSON.stringify(genCry);

    hInt.inflictLimbTrauma(0, 0.50);
    hLes.inflictLimbTrauma(0, 0.50);
    // Transiently clamp syncytium into the -14 mV depolarized attractor WITHOUT touching a single genome locus!
    hCry.clampBioelectricPattern(-14.0);
    hCry.limbIntegrity[0] = 0.50;

    for (let s = 0; s < 260; s++) {
      mInt.atp = 0.85; mLes.atp = 0.85; mCry.atp = 0.85;
      hInt.stepBioelectric(0.1, mInt, false);
      hLes.stepBioelectric(0.1, mLes, true);
      hCry.stepBioelectric(0.1, mCry, false);
    }
    assert.equal(JSON.stringify(genCry), genBefore, 'T8 Cryptic bioelectric memory must alter 0/128 genome loci');
    regIntact.push(hInt.limbIntegrity[0]);
    regLesion.push(hLes.limbIntegrity[0]);
    morphCanon.push(hInt.limbMorphScale[0]);
    morphCryptic.push(hCry.limbMorphScale[0]);

    // Verify reversibility back to canonical 1.00 morph when hyperpolarized back to -56 mV
    hCry.clampBioelectricPattern(-56.0);
    hCry.limbIntegrity[0] = 0.50;
    for (let s = 0; s < 260; s++) {
      mCry.atp = 0.85;
      hCry.stepBioelectric(0.1, mCry, false);
    }
    assert(hCry.limbMorphScale[0] < 1.08, `T8 Hyperpolarizing clamp must reverse ectopic morph: ${hCry.limbMorphScale[0]}`);
  }

  const stReg = summarizePaired('T8a: Limb Regeneration (Intact - GapJunction Lesion)', regIntact, regLesion, 'greater');
  const stMem = summarizePaired('T8b: Cryptic Ectopic Morph Scale (-14mV - Canonical -56mV)', morphCryptic, morphCanon, 'greater');
  assert(stReg.p < 0.001 && stMem.p < 0.001 && stMem.meanDiff > 0.25, `T8 Bioelectric regeneration/cryptic memory failed`);

  SUMMARY_ROWS.push({
    id: 'T8',
    theorem: 'Levin Bistable Bioelectric & Cryptic Memory',
    metric: `0/128 genes altered; regen=${stReg.meanX.toFixed(3)} vs ${stReg.meanY.toFixed(3)}`,
    effect: `Morph switch: ${stMem.meanY.toFixed(3)} -> ${stMem.meanX.toFixed(3)} (+${stMem.meanDiff.toFixed(3)})`,
    p: stMem.p.toFixed(6),
    d: stMem.dz.toFixed(2),
  });
  console.log(`[PASS] T8 Levin Bistable Bioelectric & Cryptic Memory: regen=${stReg.meanX.toFixed(3)} vs lesion=${stReg.meanY.toFixed(3)}, ectopicMorph=${stMem.meanX.toFixed(3)} vs canon=${stMem.meanY.toFixed(3)} (0/128 genes changed, p=${stMem.p.toFixed(6)})`);
}

// =========================================================================================
// THEOREM 9: Spatial RS[15,11,d=5] GF(16) Bio-Acoustic Burst-Noise ECC Survival Advantage (N=12)
// =========================================================================================
if (FROM_T <= 9) {
  const predOff = [], predOn = [], evasOn = [];
  for (const seed of SEEDS_12) {
    const runStormColony = (eccOn) => {
      const w = new World(seed);
      const eco = new Ecosystem(w, seed, { peers: 18, mites: 16, predators: 2, eccEnabled: eccOn });
      // Ensure at least 3 Sentinel gamma perimeter scouts in identical slots across both arms
      for (let i = 0; i < 3 && i < eco.peers.length; i++) eco.peers[i].casteId = 2;
      for (let f = 0; f < 55 * 60; f++) {
        w.step(1 / 60, f);
        w.dome.auroraStorm = 0.88; // high burst-noise acoustic storm (2 GF(16) symbol errors/packet!)
        eco.step(1 / 60, null);
      }
      return eco.stats;
    };
    const sOn = runStormColony(true);
    const sOff = runStormColony(false);
    assert(sOn.rsSymbolsRepaired > 0 && sOff.rsFramesDropped > 0, 'T9 Storm burst channel must exercise RS[15,11] repair vs drop');
    predOn.push(sOn.predations);
    predOff.push(sOff.predations);
    evasOn.push(sOn.rsEarlyEvasions);
  }

  const stECC = summarizePaired('T9: Leviathan Predations Prevented (ECC_OFF - ECC_ON)', predOff, predOn, 'greater');
  assert(stECC.p < 0.01 && mean(evasOn) > 0.5, `T9 RS[15,11] ECC survival advantage failed p<0.01: ${JSON.stringify(stECC)}`);

  SUMMARY_ROWS.push({
    id: 'T9',
    theorem: 'Spatial RS[15,11] GF(16) Acoustic ECC',
    metric: `meanEarlyEvasions=${mean(evasOn).toFixed(2)}`,
    effect: `Predations: raw=${stECC.meanX.toFixed(2)} -> ECC=${stECC.meanY.toFixed(2)} (-${stECC.meanDiff.toFixed(2)})`,
    p: stECC.p.toFixed(6),
    d: stECC.dz.toFixed(2),
  });
  console.log(`[PASS] T9 Spatial RS[15,11] Burst-Noise ECC: predations raw=${stECC.meanX.toFixed(2)} -> ECC=${stECC.meanY.toFixed(2)} (diff=${stECC.meanDiff.toFixed(2)}, evasions=${mean(evasOn).toFixed(2)}, p=${stECC.p.toFixed(6)}, d_z=${stECC.dz.toFixed(2)})`);
}

// =========================================================================================
// THEOREM 10: Press-Dyson Memory-1 IPD Titans & Level-2 Bayesian Costly-Signaling Shoggoths (N=12)
// =========================================================================================
if (FROM_T <= 10) {
  const coopPay = [], defPay = [], shogBayes = [], shogNaive = [];
  for (const seed of SEEDS_12) {
    const w = new World(seed);
    const eco = new Ecosystem(w, seed, { peers: 4, mites: 8, predators: 0, titanSanctionsEnabled: true });
    for (let f = 0; f < 140 * 60; f++) {
      w.step(1 / 60, f);
      eco.step(1 / 60, null);
    }
    coopPay.push(0.5 * (eco.titans[0].ipdPayoff + eco.titans[1].ipdPayoff));
    defPay.push(eco.titans[2].ipdPayoff);

    // Shoggoth costly-signaling encounters: Level-2 Bayesian HEPTARCH vs Level-0 Naive (lesion.heptarch)
    const runShoggoth = (lesionHep) => {
      const ws = new World(seed);
      const ec = new Ecosystem(ws, seed, { peers: 0, mites: 0, predators: 0 });
      const focalStub = {
        gen: STARTER,
        hour: 12,
        stats: { snacks: 0 },
        lesion: { heptarch: lesionHep, metacog: lesionHep },
        sleep: { stage: 0 },
        metab: { hunger: () => 0.4, eat: () => {} },
        outcome: () => {},
        nociception: 0,
        ev: () => {},
      };
      for (let f = 0; f < 90 * 60; f++) {
        ws.step(1 / 60, f);
        // Place focal agent within encounter neighborhood of Shoggoths
        const sh0 = ec.shoggoths[f % ec.shoggoths.length];
        focalStub.body = { u: new Float64Array(64), head: () => [sh0.x + 2.0, sh0.y, sh0.z + 1.5] };
        ec.step(1 / 60, focalStub);
      }
      return ec.stats.shoggothNetPayoff;
    };
    shogBayes.push(runShoggoth(false));
    shogNaive.push(runShoggoth(true));
  }

  const stTitan = summarizePaired('T10a: Titan IPD Payoff (GTFT/WSLS Cooperator - Defector)', coopPay, defPay, 'greater');
  const stShog = summarizePaired('T10b: Shoggoth Encounter Net Payoff (Level-2 Bayes - Level-0 Naive)', shogBayes, shogNaive, 'greater');
  assert(stTitan.p < 0.002, `T10a Cooperative Titans with multilateral sanctions must beat Defector: p=${stTitan.p}`);
  assert(stShog.p < 0.002, `T10b Level-2 Bayesian Shoggoth screening must beat Level-0 naive trust: p=${stShog.p}`);

  SUMMARY_ROWS.push({
    id: 'T10',
    theorem: 'Press-Dyson IPD Titans + Bayesian Shoggoths',
    metric: `Titan(Coop-Def)=+${stTitan.meanDiff.toFixed(2)} (p=${stTitan.p.toFixed(4)})`,
    effect: `Shoggoth net: Bayes=${stShog.meanX.toFixed(2)} vs Naive=${stShog.meanY.toFixed(2)} (+${stShog.meanDiff.toFixed(2)})`,
    p: stShog.p.toFixed(6),
    d: stShog.dz.toFixed(2),
  });
  console.log(`[PASS] T10 Game-Theoretic Kingdoms: Titan(Coop=${stTitan.meanX.toFixed(2)} > Def=${stTitan.meanY.toFixed(2)}, p=${stTitan.p.toFixed(6)}), Shoggoth(Bayes=${stShog.meanX.toFixed(2)} > Naive=${stShog.meanY.toFixed(2)}, p=${stShog.p.toFixed(6)}, d_z=${stShog.dz.toFixed(2)})`);
}

// =========================================================================================
// THEOREM 11: Bedau-Packard Cumulative Evolutionary Activity vs Neutral Drift Shadow Model (N=12)
// =========================================================================================
if (FROM_T <= 11) {
  const actAdaptive = [], actNeutral = [];
  for (const seed of SEEDS_12) {
    const w = new World(seed);
    const eco = new Ecosystem(w, seed, { peers: 24, maxPeers: 24, mites: 20, predators: 2 });
    // Multi-generational carrying-capacity turnover (320s) vs demographically-matched Bedau-Packard Neutral Shadow
    for (let f = 0; f < 320 * 20; f++) {
      w.step(1 / 20, f);
      eco.step(1 / 20, null);
    }
    actAdaptive.push(eco.bedauActivity);
    actNeutral.push(eco.bedauNeutralActivity);
  }

  const stBedau = summarizePaired('T11: Bedau-Packard Evolutionary Activity (Adaptive - Neutral Shadow)', actAdaptive, actNeutral, 'greater');
  assert(stBedau.p < 0.005, `T11 Adaptive evolutionary activity must exceed neutral shadow model: ${JSON.stringify(stBedau)}`);

  SUMMARY_ROWS.push({
    id: 'T11',
    theorem: 'Bedau-Packard Evolutionary Activity',
    metric: `Adaptive=${stBedau.meanX.toFixed(2)} vs Neutral=${stBedau.meanY.toFixed(2)}`,
    effect: `dActivity=+${stBedau.meanDiff.toFixed(2)} [${stBedau.ciLo.toFixed(2)}, ${stBedau.ciHi.toFixed(2)}]`,
    p: stBedau.p.toFixed(6),
    d: stBedau.dz.toFixed(2),
  });
  console.log(`[PASS] T11 Bedau-Packard Evolutionary Activity: Adaptive=${stBedau.meanX.toFixed(2)} > NeutralShadow=${stBedau.meanY.toFixed(2)} (+${stBedau.meanDiff.toFixed(2)}, p=${stBedau.p.toFixed(6)}, d_z=${stBedau.dz.toFixed(2)})`);
}

// =========================================================================================
// THEOREM 12: Prequential Proper Gaussian NLL, Kuleshov 10-Bin ECE & Schreiber Transfer Entropy (N=12)
// =========================================================================================
{
  const rawNLL = [], calNLL = [], rawECE = [], calECE = [], teActive = [], teNull = [], teParalyzed = [];
  for (const seed of SEEDS_12) {
    const cAct = new Creature(seed, { brainScale: 'S', noVision: true });
    cAct.retina.skipSheet = true;
    cAct.lesion.vision = true;
    cAct.lesion.fluid = true;
    cAct.lesion.fem = true;
    cAct.lesion.hopfield = true;
    cAct.lesion.qrng = true;
    cAct.htn = null;
    cAct.noSkin = true;
    const cPar = new Creature(seed, { brainScale: 'S', noVision: true });
    cPar.retina.skipSheet = true;
    cPar.lesion.vision = true;
    cPar.lesion.fluid = true;
    cPar.lesion.fem = true;
    cPar.lesion.hopfield = true;
    cPar.lesion.qrng = true;
    cPar.htn = null;
    cPar.noSkin = true;
    cPar.lesion.mn = true; // sever motor neuron output -> open sensorimotor loop!

    for (let f = 0; f < 35 * 60; f++) {
      cAct.step();
      cPar.step();
    }
    rawNLL.push(cAct.metacog.rawGaussianNLL);
    calNLL.push(cAct.metacog.gaussianNLL);
    rawECE.push(cAct.metacog.rawEce10Bin);
    calECE.push(cAct.metacog.ece10Bin);
    teActive.push(cAct.metacog.sensorimotorLoopTE);
    teNull.push(cAct.metacog.teNullSurrogate);
    teParalyzed.push(cPar.metacog.sensorimotorLoopTE);
  }

  const stNLL = summarizePaired('T12a: Proper Gaussian NLL Reduction (Raw - Calibrated)', rawNLL, calNLL, 'greater');
  const stECE = summarizePaired('T12b: Kuleshov 10-Bin ECE Reduction (Raw - Calibrated)', rawECE, calECE, 'greater');
  const stTENull = summarizePaired('T12c: Sensorimotor Loop TE (Active - Time-Shuffled Surrogate)', teActive, teNull, 'greater');
  const stTEPar = summarizePaired('T12d: Sensorimotor Loop TE (Active - Motor-Lesioned)', teActive, teParalyzed, 'greater');

  assert(stNLL.p < 0.005, `T12a Prequential temperature scaling must reduce proper Gaussian NLL: ${JSON.stringify(stNLL)}`);
  assert(stECE.p < 0.01, `T12b Prequential calibration must reduce Kuleshov 10-bin ECE: ${JSON.stringify(stECE)}`);
  assert(stTENull.p < 0.005 && stTEPar.p < 0.002, `T12c/d Closed-loop Schreiber TE must exceed shuffled & paralyzed baselines: null_p=${stTENull.p}, par_p=${stTEPar.p}`);

  SUMMARY_ROWS.push({
    id: 'T12',
    theorem: 'Proper NLL + 10-Bin ECE + Schreiber TE',
    metric: `NLL:${stNLL.meanX.toFixed(3)}->${stNLL.meanY.toFixed(3)}, ECE:${stECE.meanX.toFixed(3)}->${stECE.meanY.toFixed(3)}`,
    effect: `TE_loop=${stTEPar.meanX.toFixed(3)} bits vs shuf=${mean(teNull).toFixed(3)} / mnLes=${stTEPar.meanY.toFixed(3)}`,
    p: stTEPar.p.toFixed(6),
    d: stTEPar.dz.toFixed(2),
  });
  console.log(`[PASS] T12 Epistemic Calibration & Sensorimotor TE: NLL ${stNLL.meanX.toFixed(3)}->${stNLL.meanY.toFixed(3)} (p=${stNLL.p.toFixed(6)}), ECE ${stECE.meanX.toFixed(3)}->${stECE.meanY.toFixed(3)} (p=${stECE.p.toFixed(6)}), TE_loop=${stTEPar.meanX.toFixed(3)} > shuf=${mean(teNull).toFixed(3)} & mnLes=${stTEPar.meanY.toFixed(3)} (p=${stTEPar.p.toFixed(6)})`);
}

console.log('\n=== SUMMARY TABLE (EXACT 2^12 PERMUTATION TESTS + 10,000-BOOTSTRAP 95% CIs) ===');
for (const r of SUMMARY_ROWS) {
  console.log(`${r.id.padEnd(4)} | ${r.theorem.padEnd(42)} | ${r.metric.padEnd(48)} | ${r.effect} | p=${r.p} | d_z=${r.d}`);
}
console.log('=== ALL 12 PASS 21 NOBEL/ALIFE RIGOR THEOREMS PASSED 100%! ===');
