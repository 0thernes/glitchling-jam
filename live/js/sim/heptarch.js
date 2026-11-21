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
// 1B. Exact 8x8 Spin-Density Matrix Liouville-Haberkorn Solver for Cryptochrome-4
//     (H_{e1} x H_{e2} x H_{I=1/2}, dim = 8 => 64 real Hermitian superoperator coords)
//     & Bit-Accurate 23-Rung NESTOR Stochastic-Rounding Quantizer (R0 .. R22)
// =============================================================================

const CRY4_SPIN8 = (() => {
  const S1x = new Float64Array(64), S1yI = new Float64Array(64), S1z = new Float64Array(64);
  const S2x = new Float64Array(64), S2yI = new Float64Array(64), S2z = new Float64Array(64);
  const Ix = new Float64Array(64), IyI = new Float64Array(64), Iz = new Float64Array(64);
  for (let n = 0; n < 8; n++) {
    const b1 = (n >> 2) & 1, b2 = (n >> 1) & 1, bI = n & 1;
    S1z[n * 8 + n] = b1 ? -0.5 : 0.5;
    S2z[n * 8 + n] = b2 ? -0.5 : 0.5;
    Iz[n * 8 + n] = bI ? -0.5 : 0.5;
    S1x[(n ^ 4) * 8 + n] = 0.5; S1yI[(n ^ 4) * 8 + n] = b1 ? -0.5 : 0.5;
    S2x[(n ^ 2) * 8 + n] = 0.5; S2yI[(n ^ 2) * 8 + n] = b2 ? -0.5 : 0.5;
    Ix[(n ^ 1) * 8 + n] = 0.5; IyI[(n ^ 1) * 8 + n] = bI ? -0.5 : 0.5;
  }
  // Exact two-electron singlet projector P_S = (1/4) I_8 - S_1 . S_2 (Tr(P_S) = 2)
  const PS = new Float64Array(64);
  for (let i = 0; i < 8; i++) PS[i * 8 + i] = 0.25;
  for (let i = 0; i < 8; i++) {
    for (let k = 0; k < 8; k++) {
      for (let j = 0; j < 8; j++) {
        PS[i * 8 + j] -= S1x[i * 8 + k] * S2x[k * 8 + j]
          - S1yI[i * 8 + k] * S2yI[k * 8 + j]
          + S1z[i * 8 + k] * S2z[k * 8 + j];
      }
    }
  }
  const pairI = new Int8Array(28), pairJ = new Int8Array(28);
  let p = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) { pairI[p] = i; pairJ[p] = j; p++; }
  }
  return { S1x, S1yI, S1z, S2x, S2yI, S2z, Ix, IyI, Iz, PS, pairI, pairJ };
})();

function solveLinear64(A, b, n) {
  for (let col = 0; col < n; col++) {
    let piv = col, maxV = Math.abs(A[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col]);
      if (v > maxV) { maxV = v; piv = r; }
    }
    if (piv !== col) {
      for (let c = col; c < n; c++) {
        const tmp = A[col * n + c]; A[col * n + c] = A[piv * n + c]; A[piv * n + c] = tmp;
      }
      const tb = b[col]; b[col] = b[piv]; b[piv] = tb;
    }
    const diag = A[col * n + col] || 1e-18;
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col] / diag;
      if (f === 0) continue;
      for (let c = col + 1; c < n; c++) A[r * n + c] -= f * A[col * n + c];
      b[r] -= f * b[col];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r * n + c] * x[c];
    x[r] = s / (A[r * n + r] || 1e-18);
  }
  return x;
}

/**
 * Exact infinite-time quantum yield solution of the minimal 8x8 (2x2x2: two spin-1/2 electrons + one axial spin-1/2
 * hyperfine nucleus, Ritz-Adem-Schulten 2000) Cryptochrome-4 Radical-Pair Liouville-Haberkorn Master Equation:
 *   d(rho)/dt = -i [H(B), rho] - (kS/2){P_S, rho} - (kT/2){I - P_S, rho} + D_{deph + RF}[rho],
 *   rho(0) = P_S / Tr(P_S) => L[R] = -rho(0), Phi_S = kS * Tr(P_S R), Phi_T = kT * Tr((I - P_S) R).
 * Resonant Larmor RF disruption (Ritz et al., Nature 2004) is modeled as an effective rotating-wave Lorentzian
 * transverse spin-flip channel peaking at omega_RF = omega_L = 0.176 * fieldUT (effective long-lifetime RF sensitivity
 * susceptibility; cf. Hore & Mouritsen 2016 Annu. Rev. Biophys. on bare-lifetime RF amplitude scaling).
 */
export function solveCry4Haberkorn8x8(bx, by, bz, opts = {}) {
  const fieldUT = opts.fieldUT ?? 48.5;
  const omegaL = 0.176 * fieldUT; // electron Larmor frequency gamma_e * B0 (rad/us; ~8.536 at 48.5 uT = 1.36 MHz)
  const kS = opts.kS ?? 1.0;      // singlet recombination rate (us^-1)
  const kT = opts.kT ?? 1.25;     // triplet product formation rate (us^-1)
  const Az = opts.Az ?? 14.0;     // axial hyperfine coupling on FAD.- radical (rad/us)
  const Aperp = opts.Aperp ?? 1.8;
  const gammaSpin = opts.gammaSpin ?? 0.0;
  // Resonant Larmor RF magnetic field disruption (rotating-wave Lorentzian spin-flip rate at omega_RF == omega_L)
  const rfAmpUT = opts.rfAmpUT ?? 0.0;
  const rfFreq = opts.rfFreqRadUs ?? omegaL;
  const omegaRabi = 0.176 * rfAmpUT * 28.0; // transverse oscillating-field spin-flip drive in radical-pair lifetime window
  const kLine = 0.5 * (kS + kT) + 0.35;
  const gammaRF = rfAmpUT > 0 ? (omegaRabi * omegaRabi * kLine) / (kLine * kLine + (rfFreq - omegaL) * (rfFreq - omegaL)) : 0;
  const gammaPerp = gammaSpin + gammaRF; // GKSL transverse jump channels S_{ax}, S_{ay} (a = 1, 2)
  const gammaZ = gammaSpin;              // GKSL longitudinal jump channels S_{az} (a = 1, 2)

  const nB = Math.hypot(bx, by, bz) || 1;
  const ox = omegaL * (bx / nB), oy = omegaL * (by / nB), oz = omegaL * (bz / nB);
  const SP = CRY4_SPIN8;
  const Hre = new Float64Array(64), Him = new Float64Array(64);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let hr = ox * (SP.S1x[i * 8 + j] + SP.S2x[i * 8 + j]) + oz * (SP.S1z[i * 8 + j] + SP.S2z[i * 8 + j]);
      const hi = oy * (SP.S1yI[i * 8 + j] + SP.S2yI[i * 8 + j]);
      for (let k = 0; k < 8; k++) {
        hr += Aperp * (SP.S1x[i * 8 + k] * SP.Ix[k * 8 + j] - SP.S1yI[i * 8 + k] * SP.IyI[k * 8 + j])
          + Az * (SP.S1z[i * 8 + k] * SP.Iz[k * 8 + j]);
      }
      Hre[i * 8 + j] = hr;
      Him[i * 8 + j] = hi;
    }
  }

  const L = new Float64Array(64 * 64);
  const rR = new Float64Array(64), rI = new Float64Array(64);
  const outR = new Float64Array(64), outI = new Float64Array(64);
  const dk = 0.5 * (kS - kT);

  for (let col = 0; col < 64; col++) {
    rR.fill(0); rI.fill(0);
    if (col < 8) {
      rR[col * 8 + col] = 1;
    } else {
      const pIdx = (col - 8) >> 1, isIm = (col - 8) & 1;
      const ii = SP.pairI[pIdx], jj = SP.pairJ[pIdx];
      if (!isIm) { rR[ii * 8 + jj] = 1; rR[jj * 8 + ii] = 1; }
      else { rI[ii * 8 + jj] = 1; rI[jj * 8 + ii] = -1; }
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        let cR = -kT * rR[i * 8 + j], cI = -kT * rI[i * 8 + j];
        for (let k = 0; k < 8; k++) {
          const h1r = Hre[i * 8 + k], h1i = Him[i * 8 + k], x2r = rR[k * 8 + j], x2i = rI[k * 8 + j];
          const x1r = rR[i * 8 + k], x1i = rI[i * 8 + k], h2r = Hre[k * 8 + j], h2i = Him[k * 8 + j];
          const commR = (h1r * x2r - h1i * x2i) - (x1r * h2r - x1i * h2i);
          const commI = (h1r * x2i + h1i * x2r) - (x1r * h2i + x1i * h2r);
          cR += commI;
          cI -= commR;
          if (dk !== 0) {
            cR -= dk * (SP.PS[i * 8 + k] * rR[k * 8 + j] + rR[i * 8 + k] * SP.PS[k * 8 + j]);
            cI -= dk * (SP.PS[i * 8 + k] * rI[k * 8 + j] + rI[i * 8 + k] * SP.PS[k * 8 + j]);
          }
        }
        // Exact CPTP GKSL Lindblad spin relaxation: sum_{a=1,2} [ gammaPerp*(S_ax rho S_ax + S_ay rho S_ay - rho/2) + gammaZ*(S_az rho S_az - rho/4) ]
        if (gammaPerp > 0 || gammaZ > 0) {
          const ij = i * 8 + j;
          if (((i ^ j) & 4) === 0) {
            const f1 = (i ^ 4) * 8 + (j ^ 4);
            cR += 0.5 * gammaPerp * (rR[f1] - rR[ij]);
            cI += 0.5 * gammaPerp * (rI[f1] - rI[ij]);
          } else {
            const dec1 = 0.5 * (gammaPerp + gammaZ);
            cR -= dec1 * rR[ij];
            cI -= dec1 * rI[ij];
          }
          if (((i ^ j) & 2) === 0) {
            const f2 = (i ^ 2) * 8 + (j ^ 2);
            cR += 0.5 * gammaPerp * (rR[f2] - rR[ij]);
            cI += 0.5 * gammaPerp * (rI[f2] - rI[ij]);
          } else {
            const dec2 = 0.5 * (gammaPerp + gammaZ);
            cR -= dec2 * rR[ij];
            cI -= dec2 * rI[ij];
          }
        }
        outR[i * 8 + j] = cR;
        outI[i * 8 + j] = cI;
      }
    }
    for (let i = 0; i < 8; i++) L[i * 64 + col] = outR[i * 8 + i];
    let row = 8;
    for (let p = 0; p < 28; p++) {
      const ii = SP.pairI[p], jj = SP.pairJ[p];
      L[row * 64 + col] = outR[ii * 8 + jj]; row++;
      L[row * 64 + col] = outI[ii * 8 + jj]; row++;
    }
  }

  const rhs = new Float64Array(64);
  for (let i = 0; i < 8; i++) rhs[i] = -0.5 * SP.PS[i * 8 + i];
  let row = 8;
  for (let p = 0; p < 28; p++) {
    rhs[row++] = -0.5 * SP.PS[SP.pairI[p] * 8 + SP.pairJ[p]];
    rhs[row++] = 0;
  }
  const sol = solveLinear64(L, rhs, 64);
  let trPSR = 0, trR = 0;
  for (let i = 0; i < 8; i++) {
    trR += sol[i];
    trPSR += SP.PS[i * 8 + i] * sol[i];
  }
  row = 8;
  for (let p = 0; p < 28; p++) {
    trPSR += 2 * SP.PS[SP.pairI[p] * 8 + SP.pairJ[p]] * sol[row];
    row += 2;
  }
  const phiS = kS * trPSR;
  const phiT = kT * (trR - trPSR);
  return { phiS, phiT, yieldSum: phiS + phiT, gammaRF, omegaL };
}

// Lie-symmetry axial cache: since [S1z+S2z+Iz, H_HF] = 0 and [S1z+S2z+Iz, P_S] = 0, Phi_S(B) is an exact smooth
// function of u = cos^2(alpha) in [0, 1], tabulated directly from solveCry4Haberkorn8x8 with 17 nodes.
const _cry4AxialCache = new Map();
function getCry4AxialCurve(fieldUT, gammaSpin, rfAmpUT = 0, rfFreqRadUs = null) {
  const bKey = `${Math.round(fieldUT * 2)}_${Math.round(gammaSpin * 16)}_${Math.round(rfAmpUT * 20)}_${rfFreqRadUs === null ? 'res' : Math.round(rfFreqRadUs * 4)}`;
  let curve = _cry4AxialCache.get(bKey);
  if (!curve) {
    const N = 17;
    curve = new Float64Array(N);
    for (let m = 0; m < N; m++) {
      const u = m / (N - 1); // u = cos^2(alpha)
      const cosA = Math.sqrt(u), sinA = Math.sqrt(Math.max(0, 1 - u));
      curve[m] = solveCry4Haberkorn8x8(sinA, 0, cosA, {
        fieldUT,
        gammaSpin,
        rfAmpUT,
        rfFreqRadUs: rfFreqRadUs ?? (0.176 * fieldUT),
      }).phiS;
    }
    if (_cry4AxialCache.size > 64) _cry4AxialCache.clear();
    _cry4AxialCache.set(bKey, curve);
  }
  return curve;
}

// NESTOR 23-Rung effective bit-widths (R0 = zero-gated .. R5 = b1.58 ternary .. R22 = IEEE FP64)
export const NESTOR_RUNG_BITS = Float64Array.of(
  0, 1, 1.25, 2, 3, 1.58496, 4, 4, 4, 6, 8, 8, 8, 12, 16, 16, 19, 16, 19, 24, 32, 48, 64
);

/**
 * Bit-accurate NESTOR 23-Rung Quantizer (R0..R22) with provably unbiased Stochastic Rounding (E[Q_r(x)] == x).
 */
export function quantizeNestorRung(val, rung = 22, rng = Math.random, scale = 1.0) {
  const r = clamp(Math.round(rung), 0, 22);
  if (r === 0 || !Number.isFinite(val)) return 0.0;
  if (r >= 22) return val;
  if (r === 20) return Math.fround(val);
  const sc = Math.max(1e-6, scale);

  // R1..R2: 1-bit binary {-sc, +sc} with unbiased stochastic rounding over [-sc, +sc]
  if (r <= 2) {
    const u = clamp(val / sc, -1, 1);
    const pPlus = 0.5 * (1 + u);
    return (rng() < pPlus ? 1 : -1) * sc;
  }
  // R5: BitNet ternary b1.58 {-sc, 0, +sc} with unbiased stochastic rounding
  if (r === 5) {
    const u = clamp(val / sc, -1, 1);
    if (u >= 0) return rng() < u ? sc : 0.0;
    return rng() < -u ? -sc : 0.0;
  }
  // Uniform integer rungs with unbiased stochastic rounding: R3(2b), R4(3b), R6-R7(INT4), R9(INT6), R10(INT8), R13(INT12), R17(INT16)
  const intBitsMap = { 3: 2, 4: 3, 6: 4, 7: 4, 9: 6, 10: 8, 13: 12, 17: 16 };
  if (intBitsMap[r] !== undefined) {
    const bits = intBitsMap[r];
    const levels = (1 << (bits - 1)) - 1;
    const step = sc / Math.max(1, levels);
    const clamped = clamp(val, -sc, sc);
    const qFloor = Math.floor(clamped / step);
    const frac = clamped / step - qFloor;
    return (qFloor + (rng() < frac ? 1 : 0)) * step;
  }
  // Floating-point mantissa rungs with unbiased stochastic rounding:
  // R8=FP4(E2M1,M=1), R11=FP8(E4M3,M=3), R12=FP8(E5M2,M=2), R14=FP16(M=10), R15=BF16(M=7), R16/R18=TF32(M=10), R19=FP24(M=15), R21=FP48(M=39)
  const mantMap = { 8: 1, 11: 3, 12: 2, 14: 10, 15: 7, 16: 10, 18: 10, 19: 15, 21: 39 };
  const expMaxMap = { 8: 2, 11: 8, 12: 15, 14: 15, 15: 127, 16: 127, 18: 127, 19: 127, 21: 1023 };
  const M = mantMap[r] ?? 10;
  const eMax = expMaxMap[r] ?? 127;
  if (val === 0) return 0.0;
  const sgn = val < 0 ? -1 : 1;
  const av = Math.abs(val);
  const exp = Math.floor(Math.log2(av));
  if (exp < -eMax - M) return 0.0;
  if (exp > eMax) return sgn * Math.pow(2, eMax) * (2 - Math.pow(2, -M));
  const twoPowE = Math.pow(2, exp);
  const mant = av / twoPowE; // in [1, 2)
  const stepM = Math.pow(2, -M);
  const qM = Math.floor((mant - 1) / stepM);
  const fracM = (mant - 1) / stepM - qM;
  const roundedMant = 1 + (qM + (rng() < fracM ? 1 : 0)) * stepM;
  return sgn * twoPowE * roundedMant;
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
    this.srRng = mulberry((seed * 65537 + 131) >>> 0); // dedicated NESTOR stochastic-rounding stream
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
    this.nestorMode = 'adaptive'; // 'adaptive' | 'fixedLow' | 'fixedHigh'
    this.rungs = {
      spindleReflex: 5,    // ternary b1.58
      gangliaCfC: 8,       // FP4 E2M1 / ChronoBlock-4
      cortexCSR: 10,       // INT8 + stochastic rounding
      foveaFlowVAE: 15,    // BF16
      femHemodynamics: 18, // TF32
      ring0Ledger: 22,     // IEEE FP64 + Kahan
    };
    this.meanActiveBits = 12.5;
    this.nestorComputeATP = 0;
    this.landauerBitsErased = 0;
    this.shadowQuantDiv = 0.02;
    this.activeMotifs = 24.0; // N(t) evolved by Eq. 23: dN/dt = r_+ - r_-
    this.dsdMerges = 0;
    this.rsrSplits = 0;

    // DSD-24 Stagnation / Limit-Cycle Detector & SVD Trajectory Nullspace Exuvia Escape
    this.posRing = [];
    this.stuckScore = 0;
    this.exuviaCount = 0;
    this.escapeImpulse = 0;
    this.escapeHeading = 0;
    this.lastNullspaceOrtho = 0; // |v_escape . v_principal| ~ 0 orthogonality certificate

    // Avian/Amphibian Cryptochrome-4 8x8 Radical-Pair Magnetoreception
    this.magAz = null;
    this.singletContrast = 0;
    this.spinCoherence = 0;
    this.cry4YieldSum = 1.0;
    this.inSanctuary = false;
    this.nearMonolith = -1;

    // Michael Levin Bistable Somatic Bioelectric Syncytium (Kir2.1 / Ca_v + Voltage-Gated Connexin Gap Junctions)
    // Two dynamical attractors WITHOUT any hardcoded vTarget array:
    //   V_pol = -56.0 mV (canonical hyperpolarized morphogenetic attractor -> morphScale = 1.00)
    //   V_dep = -14.0 mV (depolarized injury / cryptic ectopic attractor -> morphScale = 1.32)
    //   V_sep = -34.0 mV (unstable saddle separatrix)
    this.vMem = new Float64Array(10).fill(-56.0);
    this.limbIntegrity = new Float64Array(10).fill(1.0);
    this.limbMorphScale = new Float64Array(10).fill(1.0);
    this.bioelectricState = 'canonical'; // 'canonical' (-56mV) | 'cryptic-ectopic' (-14mV)

    // Live Quantum Contextuality Witness snapshot (KCBS / CEGA-18 / Hoggar / C3)
    this.ctxWitness = evalContextualitySuites(0, 0);

    // RS[15,11] Acoustic Telemetry counters
    this.rsFramesDecoded = 0;
    this.rsSymbolsRepaired = 0;
  }

  /**
   * 8-state (H_{e1} x H_{e2} x H_{I=1/2}) Avian/Amphibian Cryptochrome-4 radical-pair compass.
   * Evaluates exact 8x8 Hermitian density-matrix Liouville-Haberkorn singlet yields Phi_S(B) across 16
   * circular retinal Cry4 outer-segment sectors, including inclination parity symmetry Phi_S(-B) == Phi_S(+B)
   * and resonant Larmor RF disruption at omega_RF = gamma_e * B0 (Ritz et al., Nature 2004).
   */
  stepCryptochrome4(dt, heading, pos, world, lesionMagneto = false) {
    if (lesionMagneto || !world?.dome) {
      this.magAz = null;
      this.singletContrast = 0;
      this.spinCoherence = 0;
      return null;
    }
    const D = world.dome;
    // Crystal monolith & Big-Tree sanctuary geomagnetic/storm shielding
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

    const stormNoise = (D.auroraStorm || 0) * (1 - shield);
    const B0 = D.fieldUT || 48.5; // ~48.5 uT biodome geomagnetic intensity
    const inc = D.inclination ?? 1.08;
    const decl = D.declination ?? 0.0;
    const gammaSpin = 0.22 * stormNoise; // geomagnetic storm spin-relaxation rate (us^-1)
    const rfAmpUT = (D.rfAmpUT || 0) * (1 - shield);
    const rfFreqRadUs = D.rfFreqRadUs ?? (0.176 * B0);

    // Exact 8x8 Liouville-Haberkorn axial singlet yield curve in u = cos^2(alpha) in [0, 1]
    const curve = getCry4AxialCurve(B0, gammaSpin, rfAmpUT, rfFreqRadUs);
    const nGrid = curve.length - 1;

    let cosSum = 0, sinSum = 0, yMin = 1, yMax = 0;
    const bxH = Math.cos(inc) * Math.cos(decl);
    const bzH = Math.cos(inc) * Math.sin(decl);
    const byV = -Math.sin(inc);

    const NSEC = 16;
    for (let k = 0; k < NSEC; k++) {
      const relAng = (k * 2 * Math.PI) / NSEC;
      const worldAng = heading + relAng;
      // Cry4 trp-triad axis tilted 24 deg upward in retinal outer segment
      const ax = Math.cos(worldAng) * 0.9135, az = Math.sin(worldAng) * 0.9135, ay = 0.4067;
      const cosAlpha = clamp(ax * bxH + ay * byV + az * bzH, -1, 1);
      const u = cosAlpha * cosAlpha; // exact parity invariance: (-B) gives identical cos^2(alpha)!
      const posU = u * nGrid;
      const idx = Math.min(nGrid - 1, Math.floor(posU));
      const frac = posU - idx;
      const phiS = curve[idx] * (1 - frac) + curve[idx + 1] * frac;

      if (phiS < yMin) yMin = phiS;
      if (phiS > yMax) yMax = phiS;
      cosSum += phiS * Math.cos(relAng);
      sinSum += phiS * Math.sin(relAng);
    }

    this.singletContrast = yMax - yMin;
    // Reference clean 48.5 uT Quantum Needle contrast from 8x8 Haberkorn master equation is ~0.156
    this.spinCoherence = clamp(this.singletContrast / 0.145, 0, 1);

    // Retinal Cry4 phototransduction cascade filter (tau ~ 1.25 s) + Weber shot-noise disorientation when spinCoherence collapses
    const noiseDrive = Math.pow(1 - this.spinCoherence, 1.5) * 2.6;
    this.magNoise = (this.magNoise || 0) * Math.exp(-dt * 0.8)
      + noiseDrive * Math.sqrt(Math.max(0, 1 - Math.exp(-dt * 1.6))) * ((this.rng() - 0.5) * 2.4);
    // Hiscock-Hore Quantum Needle peak around u = cos^2(alpha) ~ 0.12 maximizes Phi_S in the poleward (North) sector (+sinSum, +cosSum)
    const estRelNorth = Math.atan2(sinSum, cosSum) + this.magNoise;
    const rawAz = 0.8 + estRelNorth;
    this.magAz = Math.atan2(Math.sin(rawAz), Math.cos(rawAz));
    return this.magAz;
  }

  /** Damage limb `l`: depolarizes local V_mem past the -34 mV saddle into the -14 mV injury basin and drops integrity */
  inflictLimbTrauma(limbIdx, severity = 0.35) {
    const l = ((limbIdx % 10) + 10) % 10;
    this.vMem[l] = clamp(this.vMem[l] + 84 * severity, -65, -12);
    this.limbIntegrity[l] = clamp(this.limbIntegrity[l] - severity, 0.30, 1.0);
  }

  /**
   * Transiently shift somatic syncytium V_mem (e.g. ionophore clamp to -14 mV or -56 mV) WITHOUT altering any gene!
   * Demonstrates Levin's cryptic bioelectric pattern memory across subsequent blastema regeneration cycles.
   */
  clampBioelectricPattern(targetmV = -14.0) {
    const v = clamp(targetmV, -68, -10);
    for (let l = 0; l < 10; l++) this.vMem[l] = v;
  }

  /**
   * Step Michael Levin bistable non-neural bioelectric PDE (Kir2.1 + injury Ca_v + voltage-gated Connexin G_GJ(dV))
   * & ATP-paid blastema limb regrowth. Zero hardcoded vTarget lookup array!
   */
  stepBioelectric(dt, metab, lesionBioelec = false) {
    const V_POL = -56.0, V_SEP = -34.0, V_DEP = -14.0;
    const kIon = 0.0022; // bistable cubic channel conductance scaling
    const gGJ0 = lesionBioelec ? 0.0 : 2.8; // Connexin gap junctions blocked under octanol / lesion.bioelec!
    const subSteps = 4;
    const h = dt / subSteps;
    const nextV = new Float64Array(10);

    for (let s = 0; s < subSteps; s++) {
      for (let l = 0; l < 10; l++) {
        const v = this.vMem[l];
        const vL = this.vMem[(l + 9) % 10], vR = this.vMem[(l + 1) % 10];
        // Bistable Kir2.1 / Ca_v current: stable wells at -56 mV and -14 mV, unstable saddle at -34 mV
        const iIon = kIon * (v - V_POL) * (v - V_SEP) * (v - V_DEP);
        // Bell-shaped voltage-gated Connexin gap-junction conductance G_GJ(Delta V) = g0 / (1 + (dV / 32)^2)
        const dVL = vL - v, dVR = vR - v;
        const gL = gGJ0 / (1 + (dVL * dVL) / 1024.0);
        const gR = gGJ0 / (1 + (dVR * dVR) / 1024.0);
        nextV[l] = clamp(v + h * (-iIon + gL * dVL + gR * dVR), -70, -8);
      }
      this.vMem.set(nextV);
    }

    let meanV = 0;
    for (let l = 0; l < 10; l++) meanV += this.vMem[l] * 0.1;
    // Detect collective syncytial attractor (canonical hyperpolarized -56 mV vs cryptic global depolarized -14 mV)
    const isGlobalCryptic = !lesionBioelec && meanV > -24.0;
    this.bioelectricState = isGlobalCryptic ? 'cryptic-ectopic' : 'canonical';

    let meanIntegrity = 0, regenCostATP = 0;
    for (let l = 0; l < 10; l++) {
      const v = this.vMem[l];
      // Canonical blastema regrowth requires syncytial repolarization below -42 mV; global cryptic memory regrows into ectopic 1.32x morph!
      const inRegenAttractor = v < -42.0 || isGlobalCryptic;
      if (!lesionBioelec && inRegenAttractor && metab.atp > 0.22 && this.limbIntegrity[l] < 0.999) {
        const wellDist = isGlobalCryptic ? Math.abs(v - V_DEP) : Math.abs(v - V_POL);
        const rate = 0.068 * Math.exp(-wellDist / 14.0) * (1 - this.limbIntegrity[l]);
        const dI = Math.min(1 - this.limbIntegrity[l], dt * rate);
        this.limbIntegrity[l] += dI;
        regenCostATP += dI * 0.08;
        const targetMorph = isGlobalCryptic ? 1.32 : 1.00;
        this.limbMorphScale[l] += Math.min(1, dI * 4.5) * (targetMorph - this.limbMorphScale[l]);
      } else if (!lesionBioelec && this.limbIntegrity[l] >= 0.995) {
        const targetMorph = isGlobalCryptic ? 1.32 : 1.00;
        this.limbMorphScale[l] += dt * 0.05 * (targetMorph - this.limbMorphScale[l]);
      }
      meanIntegrity += this.limbIntegrity[l] * 0.1;
    }
    if (regenCostATP > 0) metab.atp = Math.max(0.05, metab.atp - regenCostATP);
    return { meanIntegrity, regenCostATP, meanVMem: meanV, bioelectricState: this.bioelectricState };
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

    // 9) NESTOR 23-Rung Dynamic Precision Ladder + Bit-Accurate Stochastic-Rounding Quantizer + BSS (Eq. 23)
    let qDiff2 = 0, qNorm2 = 1e-6;
    if (cr.z) {
      let meanAbs = 0;
      for (let i = 0; i < 16; i++) meanAbs += Math.abs(cr.z[i]) / 16;
      const scale = Math.max(0.05, meanAbs * 1.8);
      for (let i = 0; i < 16; i++) {
        const v = cr.z[i];
        const tern = quantizeNestorRung(v, 5, this.rng, scale);
        qDiff2 += (v - tern) * (v - tern);
        qNorm2 += v * v;
      }
    }
    this.shadowQuantDiv = Math.sqrt(qDiff2 / qNorm2);

    if (this.nestorMode === 'fixedLow') {
      this.rungs.spindleReflex = 1;
      this.rungs.gangliaCfC = 2;
      this.rungs.cortexCSR = 3;
      this.rungs.foveaFlowVAE = 3;
      this.rungs.femHemodynamics = 6;
      this.rungs.ring0Ledger = 22;
    } else if (this.nestorMode === 'fixedHigh') {
      this.rungs.spindleReflex = 22;
      this.rungs.gangliaCfC = 22;
      this.rungs.cortexCSR = 22;
      this.rungs.foveaFlowVAE = 22;
      this.rungs.femHemodynamics = 22;
      this.rungs.ring0Ledger = 22;
    } else {
      // Adaptive governor: promote rungs under high surprise/threat; demote in Stillwater/low-ATP for frugality
      this.rungs.spindleReflex = (this.shadowQuantDiv > 0.52 && atp > 0.4) ? 8 : 5;
      this.rungs.gangliaCfC = (nearPred || this.csPhase === 5) ? 19 : (atp < 0.3 ? 14 : 18);
      this.rungs.cortexCSR = nearPred ? 14 : 10;
      this.rungs.foveaFlowVAE = (wmUncert > 0.30 && atp > 0.35) ? 18 : 15;
      this.rungs.femHemodynamics = 18;
      this.rungs.ring0Ledger = 22;
    }

    // Causally apply live bit-level NESTOR quantization across the entire 72-D SSM+synergy latent cr.z & charge quadratic bit-width ATP + Landauer heat
    if (cr.z) {
      const nZ = cr.z.length;
      let maxAbsZ = 0.25;
      for (let i = 0; i < nZ; i++) if (Math.abs(cr.z[i]) > maxAbsZ) maxAbsZ = Math.abs(cr.z[i]);
      const gRung = this.rungs.gangliaCfC;
      for (let i = 0; i < nZ; i++) {
        cr.z[i] = quantizeNestorRung(cr.z[i], gRung, this.srRng, maxAbsZ * 1.15);
      }
    }
    const rungKeys = ['spindleReflex', 'gangliaCfC', 'cortexCSR', 'foveaFlowVAE', 'femHemodynamics'];
    let bitSum = 0, bitSqSum = 0;
    for (let i = 0; i < rungKeys.length; i++) {
      const b = NESTOR_RUNG_BITS[this.rungs[rungKeys[i]]] || 8;
      bitSum += b;
      bitSqSum += b * b;
    }
    this.meanActiveBits = bitSum / rungKeys.length;
    // Quadratic MAC energy cost (~ b^2): fixedHigh (5 x 64^2 = 20,480) burns ~20x more compute ATP than adaptive (~1,020)!
    const computeCost = dt * 6.0e-7 * bitSqSum;
    this.nestorComputeATP += computeCost;
    M.atp = Math.max(0.05, (M.atp ?? 0.8) - computeCost);
    const erasedBits = dt * 640 * bitSum;
    this.landauerBitsErased += erasedBits;
    if (W?.recordLandauerBits) W.recordLandauerBits(erasedBits, computeCost * 0.5);

    const util = clamp(1.15 - atp, 0.1, 0.98);
    const rPlus = 0.45 * Math.max(0, 0.4 * wmUncert + 0.5 * stall) * Math.max(0, 1 - util);
    const rMinus = 0.42 * Math.max(0, 0.35 * ((this.activeMotifs - 24) / 24) + 0.45 * util * util);
    const prevMotifs = Math.round(this.activeMotifs);
    this.activeMotifs = clamp(this.activeMotifs + dt * (rPlus - rMinus), 8, 64);
    if (Math.round(this.activeMotifs) > prevMotifs) this.rsrSplits++;
    else if (Math.round(this.activeMotifs) < prevMotifs) this.dsdMerges++;

    // 10) DSD-24 Limit-Cycle Detection & Exact Trajectory-Covariance Nullspace Exuvia Escape
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
        // Compute 2x2 trajectory covariance C of posRing and project onto exact minor eigenvector (nullspace of stuck oscillation)!
        let mx = 0, mz = 0;
        for (let i = 0; i < 50; i++) { mx += this.posRing[i][0] * 0.02; mz += this.posRing[i][1] * 0.02; }
        let cxx = 0, czz = 0, cxz = 0;
        for (let i = 0; i < 50; i++) {
          const dx = this.posRing[i][0] - mx, dz = this.posRing[i][1] - mz;
          cxx += dx * dx; czz += dz * dz; cxz += dx * dz;
        }
        // Principal oscillation eigenvector vMax = [cos(theta), sin(theta)] via exact 2x2 Jacobi angle 2*theta = atan2(2*cxz, cxx - czz)
        const thetaPrin = 0.5 * Math.atan2(2 * cxz, cxx - czz);
        const vxPrin = Math.cos(thetaPrin), vzPrin = Math.sin(thetaPrin);
        // Orthogonal nullspace basis vector vNull = [-sin(theta), cos(theta)] (exact dot product == 0)
        const sgn = this.rng() < 0.5 ? 1 : -1;
        const vxNull = -sgn * vzPrin, vzNull = sgn * vxPrin;
        this.lastNullspaceOrtho = Math.abs(vxPrin * vxNull + vzPrin * vzNull);
        this.escapeHeading = Math.atan2(vzNull, vxNull);
        this.escapeImpulse = 1.0;
        if (W?.spawnExuvia) W.spawnExuvia(com[0], com[2], cr.gen?.pigmentHue ?? 0.72);
      }
    }
  }
}
