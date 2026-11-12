// NESTOR v0.1 + HEPTARCH v0.2 Composite Sub-Brain Council, Raider 6-Phase Cold-Strike Automaton,
// Avian/Amphibian Cryptochrome-4 Radical-Pair Magnetoreception, Burst-Proof GF(2^4) RS[15,11] Neuralese,
// Bicursive Self Sync (DSD + RSR), DSD-24 Exuvia Nullspace Escape & Levin Bioelectric V_mem Regeneration.
// 100% tokenless Layer-1 numerical organism module (zero LLMs, zero prompts, zero external network calls).

import * as T from '../tsotchke/taylor.js';
import { clamp, mulberry } from './util.js';
import { evalContextualitySuites } from '../tsotchke/qgtl.js';

// =============================================================================
// 1. Systematic Reed-Solomon RS[15, 11, d=5] Codec over GF(2^4) (prim = x^4 + x + 1 = 0x13)
//    Corrects up to t = 2 arbitrary 4-bit symbol errors per 15-symbol bio-acoustic frame!
// =============================================================================
const GF16_EXP = new Uint8Array(32);
const GF16_LOG = new Uint8Array(16);
(() => {
  let x = 1;
  for (let i = 0; i < 15; i++) {
    GF16_EXP[i] = x;
    GF16_EXP[i + 15] = x;
    GF16_LOG[x] = i;
    x <<= 1;
    if (x & 0x10) x ^= 0x13;
  }
  GF16_EXP[30] = GF16_EXP[0];
  GF16_LOG[0] = 255;
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF16_EXP[GF16_LOG[a & 15] + GF16_LOG[b & 15]]);
const gfInv = (a) => (a === 0 ? 0 : GF16_EXP[15 - GF16_LOG[a & 15]]);
const gfDiv = (a, b) => (a === 0 || b === 0 ? 0 : GF16_EXP[GF16_LOG[a & 15] + 15 - GF16_LOG[b & 15]]);

// Generator polynomial g(x) = (x - a^1)(x - a^2)(x - a^3)(x - a^4) over GF(2^4)
const RS_GEN = (() => {
  let g = [1];
  for (let r = 1; r <= 4; r++) {
    const root = GF16_EXP[r];
    const next = new Array(g.length + 1).fill(0);
    for (let i = 0; i < g.length; i++) {
      next[i] ^= g[i];
      next[i + 1] ^= gfMul(g[i], root);
    }
    g = next;
  }
  return Uint8Array.from(g); // degree 4: [1, g1, g2, g3, g4]
})();

/** Encode 11 4-bit symbols into a systematic 15-symbol RS[15, 11, d=5] codeword */
export function encodeNeuraleseRS15_11(msg11) {
  const cw = new Uint8Array(15);
  for (let i = 0; i < 11; i++) cw[i] = (msg11[i] || 0) & 0x0f;
  const par = new Uint8Array(4);
  for (let i = 0; i < 11; i++) {
    const fb = cw[i] ^ par[0];
    par[0] = par[1] ^ gfMul(RS_GEN[1], fb);
    par[1] = par[2] ^ gfMul(RS_GEN[2], fb);
    par[2] = par[3] ^ gfMul(RS_GEN[3], fb);
    par[3] = gfMul(RS_GEN[4], fb);
  }
  cw[11] = par[0]; cw[12] = par[1]; cw[13] = par[2]; cw[14] = par[3];
  return cw;
}

/** Decode a noisy 15-symbol RS[15,11] codeword, repairing up to 2 arbitrary symbol errors */
export function decodeNeuraleseRS15_11(rx15) {
  const cw = Uint8Array.from({ length: 15 }, (_, i) => (rx15[i] || 0) & 0x0f);
  // Syndromes S_j = C(alpha^j) for j = 1..4, where cw[0] is x^14 ... cw[14] is x^0
  const S = new Uint8Array(4);
  let allZero = true;
  for (let j = 0; j < 4; j++) {
    const a = GF16_EXP[j + 1];
    let acc = 0;
    for (let i = 0; i < 15; i++) acc = gfMul(acc, a) ^ cw[i];
    S[j] = acc;
    if (acc !== 0) allZero = false;
  }
  if (allZero) {
    return { msg: cw.subarray(0, 11), codeword: cw, correctedSymbols: 0, uncorrectable: false };
  }

  // Berlekamp-Massey over GF(2^4) for t = 2 (4 syndromes)
  let C = new Uint8Array([1, 0, 0, 0, 0]);
  let B = new Uint8Array([1, 0, 0, 0, 0]);
  let L = 0, m = 1, b = 1;
  for (let n = 0; n < 4; n++) {
    let d = S[n];
    for (let i = 1; i <= L; i++) d ^= gfMul(C[i], S[n - i]);
    if (d === 0) {
      m++;
    } else if (2 * L <= n) {
      const Tpoly = Uint8Array.from(C);
      const coef = gfDiv(d, b);
      for (let i = 0; i + m < 5; i++) C[i + m] ^= gfMul(coef, B[i]);
      L = n + 1 - L;
      B = Tpoly;
      b = d;
      m = 1;
    } else {
      const coef = gfDiv(d, b);
      for (let i = 0; i + m < 5; i++) C[i + m] ^= gfMul(coef, B[i]);
      m++;
    }
  }
  if (L < 1 || L > 2) {
    return { msg: cw.subarray(0, 11), codeword: cw, correctedSymbols: 0, uncorrectable: true };
  }

  // Chien search: find error positions pos in 0..14 (corresponding to power k = 14 - pos, X_l = alpha^k, root X_l^{-1})
  const errPos = [];
  const errX = [];
  for (let pos = 0; pos < 15; pos++) {
    const k = 14 - pos;
    const xInv = GF16_EXP[(15 - k) % 15];
    let val = 1;
    let xp = 1;
    for (let i = 1; i <= L; i++) {
      xp = gfMul(xp, xInv);
      val ^= gfMul(C[i], xp);
    }
    if (val === 0) {
      errPos.push(pos);
      errX.push(GF16_EXP[k]);
    }
  }
  if (errPos.length !== L) {
    return { msg: cw.subarray(0, 11), codeword: cw, correctedSymbols: 0, uncorrectable: true };
  }

  // Error evaluator Omega(x) = S(x) * C(x) mod x^4; in characteristic 2, C'(x) = C[1] + C[3] x^2 = C[1] (for L <= 2)
  const omega = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    let acc = 0;
    for (let j = 0; j <= i; j++) acc ^= gfMul(S[i - j], C[j]);
    omega[i] = acc;
  }
  for (let idx = 0; idx < errPos.length; idx++) {
    const pos = errPos[idx];
    const Xl = errX[idx];
    const xInv = gfInv(Xl);
    // For generator roots alpha^1..alpha^4 (b0 = 1), Forney magnitude e_l = Omega(X_l^{-1}) / C'(X_l^{-1})
    let num = 0, xp = 1;
    for (let i = 0; i < 4; i++) {
      num ^= gfMul(omega[i], xp);
      xp = gfMul(xp, xInv);
    }
    const den = C[1]; // formal derivative of 1 + C1*x + C2*x^2 in char 2 is C1
    if (den === 0) {
      return { msg: cw.subarray(0, 11), codeword: cw, correctedSymbols: 0, uncorrectable: true };
    }
    const mag = gfDiv(num, den);
    cw[pos] ^= mag & 0x0f;
  }

  return { msg: cw.subarray(0, 11), codeword: cw, correctedSymbols: errPos.length, uncorrectable: false };
}

/** Quantize & RS[15,11]-encode a physical bio-acoustic call (type, world x, world z, urgency, caste) */
export function encodeAcousticCallRS(typeId, x, z, urgency = 0.8, casteId = 0) {
  const qx = clamp(Math.round(((x + 24) / 48) * 255), 0, 255);
  const qz = clamp(Math.round(((z + 24) / 48) * 255), 0, 255);
  const qu = clamp(Math.round(clamp(urgency, 0, 1) * 15), 0, 15);
  const msg = new Uint8Array([
    typeId & 0x0f,
    (qx >> 4) & 0x0f, qx & 0x0f,
    (qz >> 4) & 0x0f, qz & 0x0f,
    qu,
    casteId & 0x0f,
    (typeId ^ (qx & 0x0f)) & 0x0f,
    (qu ^ (qz & 0x0f)) & 0x0f,
    ((qx >> 4) ^ (qz >> 4)) & 0x0f,
    0x0a,
  ]);
  return encodeNeuraleseRS15_11(msg);
}

/** Decode a potentially storm/jester-corrupted RS[15,11] bio-acoustic codeword back to world coordinates */
export function decodeAcousticCallRS(codeword15) {
  const res = decodeNeuraleseRS15_11(codeword15);
  const m = res.msg;
  const qx = ((m[1] & 0x0f) << 4) | (m[2] & 0x0f);
  const qz = ((m[3] & 0x0f) << 4) | (m[4] & 0x0f);
  return {
    ok: !res.uncorrectable && m[10] === 0x0a,
    correctedSymbols: res.correctedSymbols,
    typeId: m[0] & 0x0f,
    x: (qx / 255) * 48 - 24,
    z: (qz / 255) * 48 - 24,
    urgency: (m[5] & 0x0f) / 15,
    casteId: m[6] & 0x0f,
  };
}

// =============================================================================
// 2. HEPTARCH v0.2 Seven-Seat Council, Raider Cold Strike & NESTOR Governor
// =============================================================================
export const SEAT_NAMES = ['Surge', 'Chronoscope', 'Keel', 'Capacitor', 'Wildcard', 'LongGame', 'Jester'];
export const MODE_NAMES = ['Stillwater', 'Gambit', 'Supernova', 'ColdStrike', 'Raid', 'Zenkai', 'Crossroads'];

// Mode-dependent per-seat weight caps pi_m^{max}(sigma_t) <= 0.46 (Law 1: strict anti-monarchy cap)
const MODE_CAPS = {
  Stillwater: [0.22, 0.34, 0.42, 0.44, 0.20, 0.34, 0.20],
  Gambit:     [0.36, 0.38, 0.32, 0.30, 0.34, 0.38, 0.32],
  Supernova:  [0.45, 0.24, 0.36, 0.44, 0.36, 0.22, 0.24],
  ColdStrike: [0.42, 0.36, 0.36, 0.42, 0.28, 0.36, 0.38],
  Raid:       [0.36, 0.34, 0.34, 0.30, 0.28, 0.44, 0.34],
  Zenkai:     [0.45, 0.32, 0.42, 0.36, 0.22, 0.32, 0.24],
  Crossroads: [0.26, 0.38, 0.46, 0.26, 0.24, 0.38, 0.24],
};

export class HeptarchCouncil {
  constructor(seed = 1) {
    this.rng = mulberry((seed * 48271 + 97) >>> 0);
    this.t = 0;

    // 7-seat weights pi_m(t) (sum = 1, max <= 0.46)
    this.seats = new Float64Array([0.14, 0.16, 0.20, 0.14, 0.12, 0.14, 0.10]);
    this.rawLogits = new Float64Array(7);
    this.dominantSeat = 'Keel';
    this.mode = 'Stillwater';
    this.modeHold = 0;

    // Law 2: Order-3 PAD Affect Jet (valence-arousal composite scalar + 3 derivatives)
    this.affectHist = [0, 0, 0, 0];
    this.affect = 0;
    this.affectD1 = 0;
    this.affectD2 = 0;
    this.affectD3 = 0;
    this.affectClamp = 1.0; // kappa_a -> 0.05 during Cold Strike Phase 4-5!
    this.rageTripwire = false;

    // Law 3: Organism-scale sLTC Capacitor bank E in [0, 1] + Zenkai plasticity debt
    this.capacitor = 0.55;
    this.zenkaiDebt = 0.0;
    this.zenkaiGain = 1.0;

    // Raider 6-Phase Cold Strike state machine:
    // 0=idle, 1=recon, 2=feign, 3=compile, 4=clamp, 5=commit, 6=disengage
    this.csPhase = 0;
    this.csTimer = 0;
    this.csCooldown = 0;
    this.deceive = 0;        // [0..1] emission suppression (scales glow/vocal by 1 - 0.6*deceive)
    this.gatesFrozen = false; // freezes striatal deliberation mid-commit (zero hesitation)
    this.forceGain = 1.0;     // burst muscle gain paid from capacitor/ATP
    this.coldStrikesCompleted = 0;

    // Ring-0 Keel safety & curiosity gate
    this.ttc = 60.0;
    this.curiosityGate = 1.0;
    this.keelVetoes = 0;

    // Law 5: Capped Level-k Theory of Mind (k in {0, 1, 2})
    this.tomLevel = 1;
    this.rivalPredictEntropy = 0.5;

    // NESTOR 23-rung adaptive precision ladder & Bicursive Self Sync (BSS = DSD + RSR)
    this.rungs = {
      spindleReflex: 5,    // ternary b1.58
      gangliaCfC: 8,       // FP4 E2M1 / ChronoBlock-4
      cortexCSR: 10,       // INT8 + stochastic rounding
      foveaFlowVAE: 15,    // BF16
      femHemodynamics: 18, // FP32
      ring0Ledger: 20,     // FP64 + Kahan
    };
    this.shadowQuantDiv = 0.02;
    this.activeMotifs = 24.0; // N(t) evolved by Eq. 23: dN/dt = r_+ - r_-
    this.dsdMerges = 0;
    this.rsrSplits = 0;

    // DSD-24 Stagnation / Limit-Cycle Detector & Exuvia Nullspace Escape
    this.posRing = [];
    this.stuckScore = 0;
    this.exuviaCount = 0;
    this.escapeImpulse = 0;
    this.escapeHeading = 0;

    // Avian/Amphibian Cryptochrome-4 Radical-Pair Magnetoreception
    this.magAz = null;
    this.singletContrast = 0;
    this.spinCoherence = 0;
    this.inSanctuary = false;
    this.nearMonolith = -1;

    // Michael Levin Somatic Bioelectric V_mem Prepattern & Blastema Limb Regeneration (10 limb slots)
    this.vMem = new Float64Array(10);
    this.vTarget = new Float64Array(10);
    this.limbIntegrity = new Float64Array(10);
    for (let l = 0; l < 10; l++) {
      const vt = -55.0 + 4.5 * Math.cos((2 * Math.PI * l) / 10);
      this.vTarget[l] = vt;
      this.vMem[l] = vt;
      this.limbIntegrity[l] = 1.0;
    }

    // Live Quantum Contextuality Witness snapshot (KCBS / CEGA-18 / Hoggar / C3)
    this.ctxWitness = evalContextualitySuites(0, 0);

    // RS[15,11] Acoustic Telemetry counters
    this.rsFramesDecoded = 0;
    this.rsSymbolsRepaired = 0;
  }

  /**
   * 8-state [FAD.- ... TrpH.+] Avian/Amphibian Cryptochrome-4 radical-pair compass.
   * Integrates anisotropic hyperfine coupling (A_perp, A_z) against the Dome's geomagnetic inclination vector
   * across 8 retinal cryptochrome orientations around `heading` to infer magnetic north azimuth in darkness!
   */
  stepCryptochrome4(dt, heading, pos, world, lesionMagneto = false) {
    if (lesionMagneto || !world?.dome) {
      this.magAz = null;
      this.singletContrast = 0;
      this.spinCoherence = 0;
      return null;
    }
    const D = world.dome;
    // Check crystal monolith & Big-Tree sanctuary geomagnetic/storm shielding
    let shield = 0;
    if (world.sanctuaries) {
      for (let i = 0; i < world.sanctuaries.length; i++) {
        const sc = world.sanctuaries[i];
        if (Math.hypot(pos[0] - sc.x, pos[2] - sc.z) < sc.r) shield = Math.max(shield, 0.85);
      }
    }
    if (world.monoliths) {
      for (let i = 0; i < world.monoliths.length; i++) {
        const mn = world.monoliths[i];
        if (Math.hypot(pos[0] - mn.x, pos[2] - mn.z) < 3.2) shield = Math.max(shield, 0.92);
      }
    }

    // Effective geomagnetic field vector B_dome in uT (horizontal North +Z / Azimuth D.magDeclination, vertical dip D.inclination)
    const stormNoise = (D.auroraStorm || 0) * (1 - shield);
    const B0 = D.fieldUT || 48.5; // ~48.5 uT Earth-like biodome field
    const omegaL = 0.176 * B0;    // electron Larmor rad/us (gamma_e * B)
    const inc = D.inclination ?? 1.08;
    const decl = D.declination ?? 0.0;
    // Anisotropic axial 14N hyperfine coupling constants (rad/us scale) & spin-coherence lifetime tau_c (us)
    const Az = 9.4, Aperp = 1.15;
    const tauC = Math.max(0.35, 3.2 * (1 - 0.78 * stormNoise)); // storm RF noise collapses spin coherence time!
    const kR = 1 / tauC;

    // Evaluate Haberkorn singlet yield Phi_S(phi_k) across 16 circular retinal Cry4 outer-segment sectors
    // (Nyquist-clean angular sampling of the axial + dipolar-broadened 14N hyperfine radical-pair kernel)
    let cosSum = 0, sinSum = 0, yMin = 1, yMax = 0;
    const bxH = Math.cos(inc) * Math.cos(decl);
    const bzH = Math.cos(inc) * Math.sin(decl);
    const byV = -Math.sin(inc);
    const dipBroad2 = 14.5; // electron-electron dipolar + exchange homogeneous line broadening (rad^2/us^2)

    const NSEC = 16;
    for (let k = 0; k < NSEC; k++) {
      const relAng = (k * 2 * Math.PI) / NSEC;
      const worldAng = heading + relAng;
      // Cry4 trp-triad axis tilted 24 deg upward in retinal outer segment
      const ax = Math.cos(worldAng) * 0.9135, az = Math.sin(worldAng) * 0.9135, ay = 0.4067;
      const cosAlpha = clamp(ax * bxH + ay * byV + az * bzH, -1, 1);
      const sin2Alpha = Math.max(0, 1 - cosAlpha * cosAlpha);

      // Sum over m_I in {-1, 0, +1} nuclear spin projections of 14N (3 subspaces x singlet-triplet mixing)
      let phiS = 0;
      for (let mI = -1; mI <= 1; mI++) {
        const hPar = omegaL * cosAlpha + Az * mI;
        const hPerp2 = (omegaL * omegaL * sin2Alpha) + Aperp * Aperp * (mI === 0 ? 2 : 1);
        const deltaE2 = hPar * hPar + hPerp2;
        const effW2 = kR * kR + dipBroad2;
        // Coherent singlet-to-triplet quantum yield modulation (Ritz-Adem-Schulten / Hore analytical Haberkorn kernel)
        const mix = hPerp2 / (effW2 + deltaE2 + 1e-6);
        phiS += (1 / 3) * (0.25 + 0.375 * (1 - 0.55 * mix) * (effW2 / (effW2 + 0.35 * hPar * hPar)));
      }
      if (phiS < yMin) yMin = phiS;
      if (phiS > yMax) yMax = phiS;
      // Retinal opponent ring vector decoding of inclination yield modulation
      cosSum += phiS * Math.cos(relAng);
      sinSum += phiS * Math.sin(relAng);
    }

    this.singletContrast = yMax - yMin;
    this.spinCoherence = clamp((tauC / 3.2) * (this.singletContrast / 0.0102), 0, 1);

    // Correlated Ornstein-Uhlenbeck spin-decoherence noise (prevents unphysical 60-Hz finite-difference spikes in Nav VOR)
    const sigmaNoise = (1 - this.spinCoherence) * 0.55;
    this.magNoise = (this.magNoise || 0) * Math.exp(-dt * 4.0) + sigmaNoise * Math.sqrt(Math.max(0, 1 - Math.exp(-dt * 8.0))) * ((this.rng() - 0.5) * 2.4);
    // Inclination dip (byV = -sin(inc), ay = +0.4067) minimizes sin^2(alpha) -> maximizes singlet yield opposite North (-cosSum, -sinSum)
    const estRelNorth = Math.atan2(-sinSum, -cosSum) + this.magNoise;
    // Align with celestial SUN_AZ (0.8 rad) consolidated coordinate frame in Nav so day->night HD ring weights Wv transfer seamlessly
    const rawAz = 0.8 + estRelNorth;
    this.magAz = Math.atan2(Math.sin(rawAz), Math.cos(rawAz));
    return this.magAz;
  }

  /** Damage limb `l` (predator bite / hard rock crush): depolarizes V_mem -> -12 mV and drops structural integrity */
  inflictLimbTrauma(limbIdx, severity = 0.35) {
    const l = ((limbIdx % 10) + 10) % 10;
    this.vMem[l] = clamp(this.vMem[l] + 42 * severity, -65, -10);
    this.limbIntegrity[l] = clamp(this.limbIntegrity[l] - severity, 0.30, 1.0);
  }

  /** Step Michael Levin gap-junction bioelectric network & ATP-paid blastema limb regrowth */
  stepBioelectric(dt, metab, lesionBioelec = false) {
    let meanIntegrity = 0, regenCostATP = 0;
    const gGJ = lesionBioelec ? 0.0 : 1.35; // gap-junction conductance blocked under lesion.bioelec!
    const nextV = new Float64Array(10);
    for (let l = 0; l < 10; l++) {
      const vL = this.vMem[(l + 9) % 10], vR = this.vMem[(l + 1) % 10], v = this.vMem[l];
      const leak = lesionBioelec ? 0.04 : 0.65;
      nextV[l] = clamp(v + dt * (gGJ * (vL + vR - 2 * v) + leak * (this.vTarget[l] - v)), -72, -8);
    }
    for (let l = 0; l < 10; l++) {
      this.vMem[l] = nextV[l];
      const errV = Math.abs(this.vMem[l] - this.vTarget[l]);
      if (!lesionBioelec && metab.atp > 0.22 && this.limbIntegrity[l] < 0.999) {
        const rate = 0.045 * Math.exp(-errV / 12.0) * (1 - this.limbIntegrity[l]);
        const dI = Math.min(1 - this.limbIntegrity[l], dt * rate);
        this.limbIntegrity[l] += dI;
        regenCostATP += dI * 0.08;
      }
      meanIntegrity += this.limbIntegrity[l] * 0.1;
    }
    if (regenCostATP > 0) metab.atp = Math.max(0.05, metab.atp - regenCostATP);
    return { meanIntegrity, regenCostATP };
  }

  /**
   * 10 Hz Council Arbitration, Raider 6-Phase Cold Strike, NESTOR Precision Governor & BSS Loop.
   */
  step(dt, cr) {
    this.t += dt;
    const W = cr.world;
    const M = cr.metab;
    const com = cr.body.com();
    const lesion = !!cr.lesion?.heptarch;

    // 1) Detect Sanctuary Refuge & Quantum Monolith proximity
    this.inSanctuary = false;
    if (W?.sanctuaries) {
      for (let i = 0; i < W.sanctuaries.length; i++) {
        const s = W.sanctuaries[i];
        if (Math.hypot(com[0] - s.x, com[2] - s.z) < s.r) { this.inSanctuary = true; break; }
      }
    }
    this.nearMonolith = -1;
    if (W?.monoliths) {
      for (let i = 0; i < W.monoliths.length; i++) {
        const mn = W.monoliths[i];
        if (Math.hypot(com[0] - mn.x, com[2] - mn.z) < 2.8) { this.nearMonolith = i; break; }
      }
    }

    // Evaluate live quantum contextuality witnesses (modulated by aurora storm unless monolith-shielded)
    const depol = clamp((W?.dome?.auroraStorm || 0) * (this.nearMonolith >= 0 ? 0.08 : 0.65), 0, 0.9);
    const f3 = cr.body?.F?.[3]?.f;
    const bodyHdg = f3 ? Math.atan2(f3[2], f3[0]) : 0;
    this.ctxWitness = evalContextualitySuites(this.t * 0.35 + bodyHdg, depol);

    if (lesion) {
      this.seats.fill(1 / 7);
      this.dominantSeat = 'Lesioned';
      this.mode = 'Stillwater';
      this.csPhase = 0;
      this.deceive = 0;
      this.gatesFrozen = false;
      this.forceGain = 1.0;
      this.affectClamp = 1.0;
      this.curiosityGate = 1.0;
      this.zenkaiGain = 1.0;
      this.escapeImpulse = 0;
      return;
    }

    // 2) Ring-0 Keel Time-To-Critical (TTC) Survival Gate
    const atp = M.atp ?? 0.8;
    const hyd = M.hydration ?? (1 - (M.thirst ?? 0.1));
    const pain = cr.nociception ?? cr.pain ?? 0;
    const predThreat = clamp(cr.pherAlarm ?? 0, 0, 1);
    const minVital = Math.min(atp, hyd, M.o2 ?? 0.9);
    this.ttc = clamp((minVital - 0.12) * 95 * (1 - 0.55 * predThreat), 0, 120);
    this.curiosityGate = 1 / (1 + Math.exp(-(this.ttc - 18.0) / 4.5));

    // 3) Law 2: Order-3 PAD Affect Jet via Eshkol Taylor AD
    const prog = cr.progEMA ?? cr.progressEMA ?? 0;
    const valence = clamp((atp - 0.45) + 0.35 * prog - 0.8 * pain - 0.6 * predThreat, -1, 1);
    const arousal = clamp(0.35 + 0.5 * (cr.brain?.nm?.NE ?? 0.3) + 0.5 * predThreat + 0.3 * pain, 0, 1);
    const rawAffect = clamp(0.6 * arousal - 0.4 * valence, -1, 1) * this.affectClamp;
    this.affectHist.push(rawAffect);
    if (this.affectHist.length > 4) this.affectHist.shift();
    {
      const [a0, a1, a2, a3] = this.affectHist;
      const tj = T.Jet.vari(0.5, 3), t2 = T.mul(tj, tj), t3 = T.mul(t2, tj);
      const b0 = T.mul(0.5, T.add(T.add(T.neg(t3), T.mul(2, t2)), T.neg(tj)));
      const b1 = T.mul(0.5, T.add(T.sub(T.mul(3, t3), T.mul(5, t2)), 2));
      const b2 = T.mul(0.5, T.add(T.add(T.mul(-3, t3), T.mul(4, t2)), tj));
      const b3 = T.mul(0.5, T.sub(t3, t2));
      const ja = T.add(T.add(T.mul(b0, a0), T.mul(b1, a1)), T.add(T.mul(b2, a2), T.mul(b3, a3)));
      this.affect = rawAffect;
      this.affectD1 = ja.deriv(1) * this.affectClamp;
      this.affectD2 = ja.deriv(2) * this.affectClamp;
      this.affectD3 = ja.deriv(3) * this.affectClamp;
      this.rageTripwire = this.affectD2 > 0.42 && this.affectD3 > 0.05;
    }

    // 4) Law 5: Capped Level-k Rival Theory of Mind (throttled under low ATP)
    let nearDeceiver = false, nearPred = false, nearPeer = false;
    if (cr.eco) {
      for (const pr of cr.eco.predators || []) {
        if (Math.hypot(pr.x - com[0], pr.z - com[2]) < 7.5) nearPred = true;
      }
      for (const sh of cr.eco.shoggoths || []) {
        if (Math.hypot(sh.x - com[0], sh.z - com[2]) < 8.0) nearDeceiver = true;
      }
      for (const ti of cr.eco.titans || []) {
        if (Math.hypot(ti.x - com[0], ti.z - com[2]) < 9.0) nearDeceiver = true;
      }
      for (const pe of cr.eco.peers || []) {
        if (Math.hypot(pe.x - com[0], pe.z - com[2]) < 6.0) nearPeer = true;
      }
    }
    this.tomLevel = atp < 0.28 ? 0 : nearDeceiver ? 2 : (nearPred || nearPeer) ? 1 : 0;

    // 5) Compute 7 Seat Raw Logits
    const flawLoad = cr.flawActiveCount ? cr.flawActiveCount * 0.25 : pain;
    const wmUncert = cr.metacog?.calibErr ?? 0.2;
    const stall = clamp(0.16 - prog, 0, 0.4) * 2.5;
    const ctxBoost = this.ctxWitness.kcbsViolated ? 0.28 : 0.05;

    this.rawLogits[0] = 0.8 + 1.8 * flawLoad + 1.4 * this.zenkaiDebt + (nearPred ? 0.9 : 0); // Surge
    this.rawLogits[1] = 1.0 + 1.9 * wmUncert + 0.8 * (1 - (cr.light ?? 1));                  // Chronoscope
    this.rawLogits[2] = 1.1 + 2.4 * (1 - this.curiosityGate) + (this.rageTripwire ? 1.5 : 0); // Keel (Ring-0)
    this.rawLogits[3] = 0.9 + 1.6 * (this.inSanctuary ? 0.9 : 0.2) + 1.2 * this.capacitor;   // Capacitor
    this.rawLogits[4] = 0.7 + 1.5 * (nearPred ? 1 : 0.2) + 1.1 * ctxBoost + 0.4 * this.rng();// Wildcard (QRNG)
    this.rawLogits[5] = 0.9 + 1.4 * (nearPeer ? 0.8 : 0.2) + 0.7 * this.tomLevel;            // LongGame
    this.rawLogits[6] = 0.7 + 1.8 * stall + 1.4 * (nearDeceiver ? 1 : 0) + (this.nearMonolith >= 0 ? 0.7 : 0); // Jester

    // 6) Mode Automaton & Raider 6-Phase Cold Strike Execution
    this.csCooldown = Math.max(0, this.csCooldown - dt);
    this.modeHold += dt;

    // Trigger Raider Cold Strike when capacitor >= 0.52, target/threat or foraging opportunity exists, and ATP > 0.36
    const goalIsForage = cr.goal === 'forage' || cr.goal?.type === 'site' || cr.goal?.type === 'snack';
    const goalDist = cr.dist ?? cr.goalDist ?? 99;
    const wantColdStrike = this.csPhase === 0 && this.csCooldown <= 0 && this.capacitor >= 0.52 && atp > 0.36 &&
      (nearPred || nearDeceiver || (goalIsForage && goalDist < 5.5 && cr.metab?.hunger?.() > 0.35));

    if (wantColdStrike) {
      this.csPhase = 1; // Phase 1: Recon
      this.csTimer = 0.6;
      this.mode = 'ColdStrike';
      this.modeHold = 0;
    }

    if (this.csPhase > 0) {
      this.csTimer -= dt;
      this.mode = 'ColdStrike';
      if (this.csPhase === 1) {
        // Phase 1: Quiet Chronoscope Recon
        this.deceive = 0.35;
        this.affectClamp = 0.75;
        this.gatesFrozen = false;
        this.forceGain = 1.0;
        if (this.csTimer <= 0) { this.csPhase = 2; this.csTimer = 0.7; }
      } else if (this.csPhase === 2) {
        // Phase 2: Go Cold / Feign (Shoggoth emission suppression 1 - 0.6 * deceive)
        this.deceive = 0.95;
        this.affectClamp = 0.45;
        if (this.csTimer <= 0) { this.csPhase = 3; this.csTimer = 0.35; }
      } else if (this.csPhase === 3) {
        // Phase 3: Compile & Keel Pre-Clear + QRNG strike jitter
        if (atp < 0.22) {
          // Ring-0 Keel aborts unsafe strike!
          this.keelVetoes++;
          this.csPhase = 0;
          this.csCooldown = 6.0;
          this.deceive = 0;
          this.affectClamp = 1.0;
        } else if (this.csTimer <= 0) {
          this.csPhase = 4;
          this.csTimer = 0.25 + 0.25 * this.rng(); // Law 4 QRNG mixed-strategy timing!
        }
      } else if (this.csPhase === 4) {
        // Phase 4: Clamp Affect (kappa_a -> 0.04, zeroing affect derivatives)
        this.deceive = 1.0;
        this.affectClamp = 0.04;
        if (this.csTimer <= 0) { this.csPhase = 5; this.csTimer = 1.8; }
      } else if (this.csPhase === 5) {
        // Phase 5: Commit at g_max with frozen striatal gates (zero mid-strike hesitation!)
        this.deceive = 0.2;
        this.affectClamp = 0.04;
        this.gatesFrozen = true;
        const draw = Math.min(this.capacitor, dt * 0.26);
        this.capacitor -= draw;
        M.atp = Math.max(0.10, M.atp - draw * 0.09); // strictly paid from conserved energy!
        this.forceGain = 1.0 + 0.34 * (draw / Math.max(1e-4, dt * 0.26));
        this.zenkaiDebt = clamp(this.zenkaiDebt + draw * 0.65, 0, 1);
        if (this.csTimer <= 0 || this.capacitor <= 0.04) {
          this.csPhase = 6;
          this.csTimer = 0.6;
          this.gatesFrozen = false;
          this.forceGain = 1.0;
          this.coldStrikesCompleted++;
        }
      } else if (this.csPhase === 6) {
        // Phase 6: Disengage -> Zenkai supercompensation & DSD merge
        this.deceive = Math.max(0, this.deceive - dt * 1.5);
        this.affectClamp = Math.min(1.0, this.affectClamp + dt * 1.6);
        this.gatesFrozen = false;
        this.forceGain = 1.0;
        if (this.csTimer <= 0) {
          this.csPhase = 0;
          this.csCooldown = 9.0;
          this.mode = 'Zenkai';
          this.modeHold = 0;
          this.dsdMerges++;
        }
      }
    } else {
      this.deceive = Math.max(0, this.deceive - dt * 0.8);
      this.affectClamp = Math.min(1.0, this.affectClamp + dt * 1.2);
      this.gatesFrozen = false;
      this.forceGain = 1.0;

      if (this.modeHold > 1.2) {
        if (this.ttc < 16 || this.rageTripwire) this.mode = 'Crossroads';
        else if (this.zenkaiDebt > 0.28) this.mode = 'Zenkai';
        else if (nearPred && this.capacitor > 0.65) this.mode = 'Supernova';
        else if (nearPeer && (cr.eco?.peers?.length || 0) >= 3) this.mode = 'Raid';
        else if (this.inSanctuary || (cr.sleep?.stage > 0 || cr.sleep?.asleep)) this.mode = 'Stillwater';
        else this.mode = 'Gambit';
        this.modeHold = 0;
      }
    }

    // 7) Law 3: Capacitor Bank Charge / Zenkai Supercompensation Recovery
    const surplus = Math.max(0, atp - 0.52) * (this.inSanctuary || this.nearMonolith >= 0 ? 1.8 : 1.0);
    if (this.csPhase !== 5) {
      const charge = Math.min(1 - this.capacitor, dt * (0.045 * surplus + (this.nearMonolith >= 0 ? 0.035 : 0)));
      this.capacitor = clamp(this.capacitor + charge - dt * 0.004 * this.capacitor, 0, 1);
    }
    if (this.zenkaiDebt > 0) {
      const rep = Math.min(this.zenkaiDebt, dt * 0.06 * (this.inSanctuary ? 1.7 : 1.0));
      this.zenkaiDebt -= rep;
      this.zenkaiGain = 1.0 + 0.42 * this.zenkaiDebt; // post-stress plasticity supercompensation!
    } else {
      this.zenkaiGain = 1.0;
    }

    // 8) Law 1: Capped Softmax Council Arbitration (two-pass water-filling so sum = 1 and pi_m <= cap_m <= 0.46!)
    const caps = MODE_CAPS[this.mode] || MODE_CAPS.Gambit;
    let maxL = -1e9;
    for (let m = 0; m < 7; m++) if (this.rawLogits[m] > maxL) maxL = this.rawLogits[m];
    let sumExp = 0;
    for (let m = 0; m < 7; m++) {
      this.seats[m] = Math.exp(this.rawLogits[m] - maxL);
      sumExp += this.seats[m];
    }
    for (let m = 0; m < 7; m++) this.seats[m] /= sumExp || 1;
    // Enforce strict mode caps via projected simplex clipping
    for (let iter = 0; iter < 4; iter++) {
      let excess = 0, freeSum = 0;
      for (let m = 0; m < 7; m++) {
        if (this.seats[m] > caps[m]) {
          excess += this.seats[m] - caps[m];
          this.seats[m] = caps[m];
        } else {
          freeSum += this.seats[m];
        }
      }
      if (excess <= 1e-9 || freeSum <= 1e-9) break;
      for (let m = 0; m < 7; m++) {
        if (this.seats[m] < caps[m]) this.seats[m] += excess * (this.seats[m] / freeSum);
      }
    }
    let sNorm = 0, bestM = 0;
    for (let m = 0; m < 7; m++) {
      sNorm += this.seats[m];
      if (this.seats[m] > this.seats[bestM]) bestM = m;
    }
    for (let m = 0; m < 7; m++) this.seats[m] /= sNorm || 1;
    this.dominantSeat = SEAT_NAMES[bestM];
    this.rivalPredictEntropy = clamp(0.35 + 0.95 * this.seats[4] + 0.55 * this.deceive, 0, 1.58);

    // 9) NESTOR 23-Rung Dynamic Precision Ladder + BSS (Eq. 23: dN/dt = r_+ - r_-)
    // Shadow ternary b1.58 quantization divergence on current SSM latent cr.z[0..15]
    let qDiff2 = 0, qNorm2 = 1e-6;
    if (cr.z) {
      let meanAbs = 0;
      for (let i = 0; i < 16; i++) meanAbs += Math.abs(cr.z[i]) / 16;
      const scale = Math.max(0.05, meanAbs);
      for (let i = 0; i < 16; i++) {
        const v = cr.z[i];
        const tern = Math.abs(v) < 0.45 * scale ? 0 : (v > 0 ? scale : -scale); // b1.58 {-1, 0, +1}
        qDiff2 += (v - tern) * (v - tern);
        qNorm2 += v * v;
      }
    }
    this.shadowQuantDiv = Math.sqrt(qDiff2 / qNorm2);
    // Promote rungs under high surprise / divergence; demote in Stillwater/low-ATP for frugality
    this.rungs.spindleReflex = (this.shadowQuantDiv > 0.52 && atp > 0.4) ? 7 : 5;
    this.rungs.gangliaCfC = (nearPred || this.csPhase === 5) ? 11 : (atp < 0.3 ? 7 : 8);
    this.rungs.foveaFlowVAE = (wmUncert > 0.30 && atp > 0.35) ? 17 : 15;

    const util = clamp(1.15 - atp, 0.1, 0.98);
    const rPlus = 0.45 * Math.max(0, 0.4 * wmUncert + 0.5 * stall) * Math.max(0, 1 - util);
    const rMinus = 0.42 * Math.max(0, 0.35 * ((this.activeMotifs - 24) / 24) + 0.45 * util * util);
    const prevMotifs = Math.round(this.activeMotifs);
    this.activeMotifs = clamp(this.activeMotifs + dt * (rPlus - rMinus), 8, 64);
    if (Math.round(this.activeMotifs) > prevMotifs) this.rsrSplits++;
    else if (Math.round(this.activeMotifs) < prevMotifs) this.dsdMerges++;

    // 10) DSD-24 Limit-Cycle Detection & Exuvia Chitin Shedding Escape
    this.posRing.push([com[0], com[2]]);
    if (this.posRing.length > 50) this.posRing.shift(); // 5 seconds at 10 Hz
    this.escapeImpulse = Math.max(0, this.escapeImpulse - dt * 0.9);
    if (this.posRing.length === 50 && !(cr.sleep?.stage > 0 || cr.sleep?.asleep) && !this.inSanctuary) {
      const old = this.posRing[0];
      const disp = Math.hypot(com[0] - old[0], com[2] - old[2]);
      this.stuckScore = disp < 0.42 ? Math.min(1, this.stuckScore + dt * 0.22) : Math.max(0, this.stuckScore - dt * 0.45);
      if (this.stuckScore > 0.92) {
        this.stuckScore = 0;
        this.exuviaCount++;
        // Orthogonal Gram-Schmidt heading escape (+90 deg +/- QRNG sign) + shed physical Exuvia into Dome!
        this.escapeHeading = bodyHdg + (this.rng() < 0.5 ? 1 : -1) * (Math.PI * 0.58);
        this.escapeImpulse = 1.0;
        if (W?.spawnExuvia) W.spawnExuvia(com[0], com[2], cr.gen?.pigmentHue ?? 0.72);
      }
    }
  }
}
