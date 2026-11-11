// Moonlab Tensor-Network & One-Sided Jacobi SVD — JavaScript port of the tensor truncation core from
// tsotchke/moonlab (src/algorithms/tensor_network/tensor.c, MIT, © Tsotchke).
// Deterministic Hestenes one-sided Jacobi SVD (no RNG, exact orthogonal Givens sweeps), bond-dimension chi truncation,
// von Neumann entanglement entropy S_vN = -sum p_i log(p_i) (p_i = sigma_i^2 / sum sigma_j^2), Roy-Vetterli effective rank,
// and sequential Matrix Product State (MPS) bond compression.

/**
 * Deterministic thin SVD of an m x n row-major matrix A (Float64Array of length m*n).
 * Returns { U (m x r), S (r), V (n x r), r = min(m, n) } with S sorted descending.
 */
export function jacobiSVD(data, rows, cols, maxSweeps = 35) {
  if (rows < cols) {
    // Transpose to tall (cols x rows), decompose A^T = U_t S V_t^T => A = V_t S U_t^T
    const AT = new Float64Array(cols * rows);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) AT[j * rows + i] = data[i * cols + j];
    const { U: Ut, S, V: Vt, r } = jacobiSVD(AT, cols, rows, maxSweeps);
    return { U: Vt, S, V: Ut, r };
  }
  const m = rows, n = cols;
  const W = Float64Array.from(data); // working copy (m x n), columns orthogonalised into U * S
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
      // Fixed deterministic sign convention: first non-negligible entry of U[:, k] >= 0
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

/**
 * Spectral entanglement entropy & bond-chi low-rank compression of a weight-delta matrix dW = W - W0.
 * Used in sleep consolidation to denoise noisy rank-1 motor/world-model perturbations while preserving
 * coherent high-singular-value learned synergies!
 */
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
  // Reconstruct rank-chi denoised delta and blend into W
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
 * Sequential MPS (Tensor Train) bond-chi decomposition of a length-2^L state vector (e.g. 64-dim SSM feature state, L=6).
 * Returns bond entanglement entropies across all L-1 cuts and total compression fidelity.
 */
export function mpsEntanglement(vec, L = 6, chiMax = 4) {
  const N = 1 << L;
  let psi = new Float64Array(N);
  let n2 = 0;
  for (let i = 0; i < Math.min(N, vec.length); i++) { psi[i] = vec[i]; n2 += vec[i] * vec[i]; }
  if (n2 < 1e-16) return { meanS: 0, maxS: 0, keptFidelity: 1 };
  const inv = 1 / Math.sqrt(n2);
  for (let i = 0; i < N; i++) psi[i] *= inv;

  let leftBond = 1, rightDim = N, meanS = 0, maxS = 0, fid = 1;
  for (let site = 0; site < L - 1; site++) {
    const rows = leftBond * 2, cols = rightDim >> 1;
    const { S, V, r } = jacobiSVD(psi, rows, cols, 20);
    let s2 = 0;
    for (let k = 0; k < r; k++) s2 += S[k] * S[k];
    let H = 0, k2 = 0;
    const chi = Math.min(r, chiMax);
    for (let k = 0; k < r; k++) {
      const p = (S[k] * S[k]) / (s2 + 1e-18);
      if (p > 1e-15) H -= p * Math.log(p);
      if (k < chi) k2 += S[k] * S[k];
    }
    meanS += H / (L - 1);
    if (H > maxS) maxS = H;
    fid *= k2 / (s2 + 1e-18);
    // Remaining state for next site: diag(S[0..chi-1]) * V[:, 0..chi-1]^T  (shape chi x cols)
    const next = new Float64Array(chi * cols);
    for (let k = 0; k < chi; k++) {
      const sk = S[k];
      for (let j = 0; j < cols; j++) next[k * cols + j] = sk * V[j * r + k];
    }
    psi = next;
    leftBond = chi;
    rightDim = cols;
  }
  return { meanS, maxS, keptFidelity: Math.min(1, fid) };
}
