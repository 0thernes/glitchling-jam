// Moonlab Tensor-Network, Vidal Canonical MPS & One-Sided Jacobi SVD — upgraded in pass 16 from
// tsotchke/moonlab (src/algorithms/tensor_network/tensor.c, MIT, © Tsotchke).
// Provides:
//  1) Deterministic Hestenes one-sided Jacobi SVD (exact orthogonal Givens sweeps, zero RNG).
//  2) Spectral entanglement consolidation `spectralConsolidate` for motor/world-model synaptic matrices.
//  3) Full Vidal Canonical Matrix Product State (`vidalMPS`, explicit site tensors Gamma^[s] and Schmidt singular-value
//     vectors Lambda^[s] up to bond dimension chi = 8) + exact statevector contraction `mpsContract` + bond-chi denoising!

export function jacobiSVD(data, rows, cols, maxSweeps = 35) {
  if (rows < cols) {
    const AT = new Float64Array(cols * rows);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) AT[j * rows + i] = data[i * cols + j];
    const { U: Ut, S, V: Vt, r } = jacobiSVD(AT, cols, rows, maxSweeps);
    return { U: Vt, S, V: Ut, r };
  }
  const m = rows, n = cols;
  const W = Float64Array.from(data);
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;

  for (let sw = 0; sw < maxSweeps; sw++) {
    let maxOff = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        let app = 0, aqq = 0, apq = 0;
        for (let i = 0; i < m; i++) {
          const wp = W[i * n + p], wq = W[i * n + q];
          app += wp * wp; aqq += wq * wq; apq += wp * wq;
        }
        const scale = Math.sqrt(app * aqq);
        if (scale < 1e-24) continue;
        const rel = Math.abs(apq) / scale;
        if (rel > maxOff) maxOff = rel;
        if (rel < 1e-13) continue;
        const zeta = (aqq - app) / (2 * apq);
        const t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t), s = c * t;
        for (let i = 0; i < m; i++) {
          const wp = W[i * n + p], wq = W[i * n + q];
          W[i * n + p] = c * wp - s * wq;
          W[i * n + q] = s * wp + c * wq;
        }
        for (let i = 0; i < n; i++) {
          const vp = V[i * n + p], vq = V[i * n + q];
          V[i * n + p] = c * vp - s * vq;
          V[i * n + q] = s * vp + c * vq;
        }
      }
    }
    if (maxOff < 1e-12) break;
  }

  const rawS = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += W[i * n + j] ** 2;
    rawS[j] = Math.sqrt(s);
  }
  const ord = Array.from({ length: n }, (_, j) => j).sort((a, b) => rawS[b] - rawS[a]);
  const S = new Float64Array(n), U = new Float64Array(m * n), Vs = new Float64Array(n * n);
  for (let k = 0; k < n; k++) {
    const j = ord[k], sv = rawS[j];
    S[k] = sv;
    if (sv > 1e-14) {
      let sgn = 1;
      for (let i = 0; i < m; i++) { const v = W[i * n + j] / sv; if (Math.abs(v) > 1e-9) { sgn = v < 0 ? -1 : 1; break; } }
      for (let i = 0; i < m; i++) U[i * n + k] = (sgn * W[i * n + j]) / sv;
      for (let i = 0; i < n; i++) Vs[i * n + k] = sgn * V[i * n + j];
    } else {
      if (k < m) U[k * n + k] = 1;
      Vs[j * n + k] = 1;
    }
  }
  return { U, S, V: Vs, r: n };
}

export function spectralConsolidate(W, W0, rows, cols, chi, blend = 0.5) {
  const N = rows * cols;
  const dW = new Float64Array(N);
  let totE = 0;
  for (let i = 0; i < N; i++) { const d = W[i] - W0[i]; dW[i] = d; totE += d * d; }
  if (totE < 1e-14) return { entropy: 0, effRank: 1, keptFrac: 1, err: 0 };
  const { U, S, V, r } = jacobiSVD(dW, rows, cols, 25);
  let sum2 = 0;
  for (let k = 0; k < r; k++) sum2 += S[k] * S[k];
  let H = 0, kept2 = 0;
  const kMax = Math.min(r, Math.max(1, chi));
  for (let k = 0; k < r; k++) {
    const p = (S[k] * S[k]) / (sum2 + 1e-18);
    if (p > 1e-15) H -= p * Math.log(p);
    if (k < kMax) kept2 += S[k] * S[k];
  }
  let err2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let rec = 0;
      for (let k = 0; k < kMax; k++) rec += U[i * r + k] * S[k] * V[j * r + k];
      const idx = i * cols + j;
      const diff = dW[idx] - rec;
      err2 += diff * diff;
      W[idx] = W0[idx] + (1 - blend) * dW[idx] + blend * rec;
    }
  }
  return {
    entropy: H,
    effRank: Math.exp(H),
    keptFrac: kept2 / (sum2 + 1e-18),
    err: Math.sqrt(err2 / (sum2 + 1e-18)),
  };
}

/**
 * Construct an explicit Vidal Canonical Matrix Product State (Gamma^[0..L-1], Lambda^[0..L-2]) of a 2^L vector:
 *   psi_{i_0 ... i_{L-1}} = norm * sum_{a_0..a_{L-2}} Gamma^[0]_{0, i_0, a_0} Lambda^[0]_{a_0} Gamma^[1]_{a_0, i_1, a_1} ... Gamma^[L-1]_{a_{L-2}, i_{L-1}, 0}
 */
export function vidalMPS(vec, L = 6, chiMax = 8) {
  const N = 1 << L;
  let psi = new Float64Array(N);
  let n2 = 0;
  for (let i = 0; i < Math.min(N, vec.length); i++) { psi[i] = vec[i]; n2 += vec[i] * vec[i]; }
  const norm = Math.sqrt(n2);
  if (norm < 1e-15) {
    return {
      L, norm: 0, meanS: 0, maxS: 0, keptFidelity: 1, maxBond: 1,
      gammas: Array.from({ length: L }, () => ({ data: new Float64Array(2), lDim: 1, rDim: 1 })),
      lambdas: Array.from({ length: L - 1 }, () => Float64Array.of(1)),
    };
  }
  const inv = 1 / norm;
  for (let i = 0; i < N; i++) psi[i] *= inv;

  const gammas = [];
  const lambdas = [];
  let prevLambda = Float64Array.of(1);
  let leftBond = 1, rightDim = N, meanS = 0, maxS = 0, fid = 1, maxBond = 1;

  for (let site = 0; site < L - 1; site++) {
    const rows = leftBond * 2, cols = rightDim >> 1;
    const { U, S, V, r } = jacobiSVD(psi, rows, cols, 22);
    let s2 = 0;
    for (let k = 0; k < r; k++) s2 += S[k] * S[k];
    const chi = Math.min(r, chiMax);
    if (chi > maxBond) maxBond = chi;

    let H = 0, k2 = 0;
    const lam = new Float64Array(chi);
    for (let k = 0; k < r; k++) {
      const p = (S[k] * S[k]) / (s2 + 1e-18);
      if (p > 1e-15) H -= p * Math.log(p);
      if (k < chi) {
        k2 += S[k] * S[k];
        lam[k] = S[k];
      }
    }
    // Re-normalise truncated Schmidt values to preserve state norm
    const keepNorm = Math.sqrt(k2) || 1;
    for (let k = 0; k < chi; k++) lam[k] /= keepNorm;

    // Vidal Gamma^[site]_{alpha_{s-1}, i_s, alpha_s} = U_{(alpha_{s-1}, i_s), alpha_s} / Lambda^[s-1]_{alpha_{s-1}}
    const gam = new Float64Array(leftBond * 2 * chi);
    for (let aL = 0; aL < leftBond; aL++) {
      const invPrev = prevLambda[aL] > 1e-7 ? 1 / prevLambda[aL] : 0;
      for (let phys = 0; phys < 2; phys++) {
        const row = aL * 2 + phys;
        for (let aR = 0; aR < chi; aR++) {
          gam[(aL * 2 + phys) * chi + aR] = U[row * r + aR] * invPrev;
        }
      }
    }
    gammas.push({ data: gam, lDim: leftBond, rDim: chi });
    lambdas.push(lam);

    meanS += H / (L - 1);
    if (H > maxS) maxS = H;
    fid *= k2 / (s2 + 1e-18);

    const next = new Float64Array(chi * cols);
    for (let k = 0; k < chi; k++) {
      const sk = lam[k];
      for (let j = 0; j < cols; j++) next[k * cols + j] = sk * V[j * r + k];
    }
    psi = next;
    prevLambda = lam;
    leftBond = chi;
    rightDim = cols;
  }

  // Final site L-1: psi has shape (leftBond x 2); divide out Lambda^[L-2] to get Gamma^[L-1]
  const lastGam = new Float64Array(leftBond * 2);
  for (let aL = 0; aL < leftBond; aL++) {
    const invPrev = prevLambda[aL] > 1e-7 ? 1 / prevLambda[aL] : 0;
    lastGam[aL * 2] = psi[aL * 2] * invPrev;
    lastGam[aL * 2 + 1] = psi[aL * 2 + 1] * invPrev;
  }
  gammas.push({ data: lastGam, lDim: leftBond, rDim: 1 });

  return { L, norm, meanS, maxS, keptFidelity: Math.min(1, fid), maxBond, gammas, lambdas };
}

/** Contract a Vidal Canonical MPS back into a full 2^L vector in R^{2^L} */
export function mpsContract(mps) {
  const { L, norm, gammas, lambdas } = mps;
  if (norm === 0) return new Float64Array(1 << L);
  // Left-to-right tensor contraction: cur has shape (physPrefix x rDim)
  let cur = Float64Array.from(gammas[0].data); // 1 * 2 * r0 -> (2 x r0)
  let pDim = 2, bond = gammas[0].rDim;
  for (let s = 1; s < L; s++) {
    const lam = lambdas[s - 1];
    const { data: G, rDim } = gammas[s]; // (bond x 2 x rDim)
    const next = new Float64Array(pDim * 2 * rDim);
    for (let pref = 0; pref < pDim; pref++) {
      for (let aL = 0; aL < bond; aL++) {
        const w = cur[pref * bond + aL] * lam[aL];
        if (Math.abs(w) < 1e-18) continue;
        for (let phys = 0; phys < 2; phys++) {
          const dstBase = (pref * 2 + phys) * rDim;
          const gBase = (aL * 2 + phys) * rDim;
          for (let aR = 0; aR < rDim; aR++) next[dstBase + aR] += w * G[gBase + aR];
        }
      }
    }
    cur = next;
    pDim <<= 1;
    bond = rDim;
  }
  for (let i = 0; i < cur.length; i++) cur[i] *= norm;
  return cur;
}

/** Sequential Vidal MPS entanglement analysis (chiMax = 8 default in pass 16) */
export function mpsEntanglement(vec, L = 6, chiMax = 8) {
  const mps = vidalMPS(vec, L, chiMax);
  return { meanS: mps.meanS, maxS: mps.maxS, keptFidelity: mps.keptFidelity, maxBond: mps.maxBond };
}
