// Quantum Geometric Tensor Library (QGTL) — JavaScript port of core metric/fidelity primitives from
// tsotchke/quantum_geometric_tensor (MIT, © Tsotchke; see core/tsotchke.ts).
// Provides:
//  1) Full Quantum Geometric Tensor Q_{ab} = <d_a psi | d_b psi> - <d_a psi | psi><psi | d_b psi> on complex phasor /
//     statevector manifolds, splitting into the Fubini-Study Riemannian metric g_{ab} = Re(Q_{ab}) and Berry curvature
//     Omega_{ab} = -2 Im(Q_{ab}).
//  2) Natural-gradient linear solver (g + ridge * I)^{-1} grad via Cholesky / Gauss-Jordan for curved parameter spaces.
//  3) Bhattacharyya / pure-state quantum fidelity F(p, q) = (sum_i sqrt(p_i q_i))^2 on non-negative activity/energy spectra.
//  4) Weight-space decomposition (innate/unlearned W0 vs learned plastic displacement dW = W - W0, intrinsic biases, Fisher EWC).

/** Bhattacharyya / quantum state fidelity F(p, q) in [0, 1] for non-negative distributions p, q */
export function fidelity(p, q) {
  let sp = 0, sq = 0;
  const n = Math.min(p.length, q.length);
  for (let i = 0; i < n; i++) { sp += Math.max(0, p[i]); sq += Math.max(0, q[i]); }
  if (sp <= 1e-15 || sq <= 1e-15) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.sqrt((Math.max(0, p[i]) / sp) * (Math.max(0, q[i]) / sq));
  return Math.min(1, s * s);
}

/**
 * Compute the 2x2 Fubini-Study metric g and scalar Berry curvature omega_xy for a D-dim Fourier phasor state
 * |psi(x, z)>_j = (1/sqrt(D)) exp(i (ax_j x + az_j z + ph_j)), weighted by feature amplitudes w_j >= 0.
 * Here d_x |psi>_j = i ax_j |psi>_j, so Q_{ab} = Cov_w(a_a, a_b) is real on uniform phases and acquires non-zero
 * Berry curvature when complex memory weights M_j = re_j + i im_j twist across spatial derivatives!
 */
export function phasorQGT(ax, az, re, im) {
  const D = ax.length;
  let Z = 0;
  for (let j = 0; j < D; j++) Z += re[j] * re[j] + im[j] * im[j] + 1e-9;
  const inv = 1 / Z;
  // Normalized state psi_j = (re_j + i im_j) / sqrt(Z), d_x psi_j = i ax_j (re_j + i im_j) / sqrt(Z) + finite-diff amplitude
  let ex = 0, ez = 0, exx = 0, ezz = 0, exz = 0;
  let berry = 0;
  for (let j = 0; j < D; j++) {
    const p = (re[j] * re[j] + im[j] * im[j] + 1e-9) * inv;
    ex += p * ax[j];
    ez += p * az[j];
    exx += p * ax[j] * ax[j];
    ezz += p * az[j] * az[j];
    exz += p * ax[j] * az[j];
    if (j > 0) {
      // Discrete plaquette Berry phase around adjacent spectral modes
      const cross = (re[j - 1] * im[j] - im[j - 1] * re[j]) * inv;
      berry += cross * (ax[j - 1] * az[j] - az[j - 1] * ax[j]);
    }
  }
  const gxx = Math.max(1e-6, exx - ex * ex);
  const gzz = Math.max(1e-6, ezz - ez * ez);
  const gxz = exz - ex * ez;
  const det = Math.max(1e-12, gxx * gzz - gxz * gxz);
  const trace = gxx + gzz;
  const cond = (trace + Math.sqrt(Math.max(0, trace * trace - 4 * det))) /
    Math.max(1e-6, trace - Math.sqrt(Math.max(0, trace * trace - 4 * det)));
  return { gxx, gzz, gxz, det, trace, cond: Math.min(999, cond), berry };
}

/**
 * Full Quantum Geometric Tensor on a normalized statevector psi = (re, im) given tangent vectors dPsi[k] = (dre_k, dim_k).
 * Returns { g: Float64Array(P*P), omega: Float64Array(P*P), trace: number, berryNorm: number }.
 */
export function stateQGT(re, im, tangents) {
  const P = tangents.length, N = re.length;
  const g = new Float64Array(P * P), omega = new Float64Array(P * P);
  // Overlap <psi | d_a psi> = sum_n (re_n - i im_n)(dre_{a,n} + i dim_{a,n})
  const ovRe = new Float64Array(P), ovIm = new Float64Array(P);
  for (let a = 0; a < P; a++) {
    const [ dr, di ] = tangents[a];
    let sr = 0, si = 0;
    for (let n = 0; n < N; n++) {
      sr += re[n] * dr[n] + im[n] * di[n];
      si += re[n] * di[n] - im[n] * dr[n];
    }
    ovRe[a] = sr; ovIm[a] = si;
  }
  let tr = 0, b2 = 0;
  for (let a = 0; a < P; a++) {
    const [ dra, dia ] = tangents[a];
    for (let b = a; b < P; b++) {
      const [ drb, dib ] = tangents[b];
      let qr = 0, qi = 0;
      for (let n = 0; n < N; n++) {
        qr += dra[n] * drb[n] + dia[n] * dib[n];
        qi += dra[n] * dib[n] - dia[n] * drb[n];
      }
      // Subtract <d_a psi | psi><psi | d_b psi> = conj(ov_a) * ov_b
      qr -= ovRe[a] * ovRe[b] + ovIm[a] * ovIm[b];
      qi -= ovRe[a] * ovIm[b] - ovIm[a] * ovRe[b];
      g[a * P + b] = g[b * P + a] = qr;
      omega[a * P + b] = -2 * qi;
      omega[b * P + a] = 2 * qi;
      if (a === b) tr += qr; else b2 += 4 * qi * qi;
    }
  }
  return { g, omega, trace: tr, berryNorm: Math.sqrt(b2) };
}

/** Solve (g + ridge * I) x = rhs for small symmetric positive-definite metric g (P x P) via Gauss-Jordan */
export function naturalGradient(g, rhs, P, ridge = 1e-2) {
  const A = new Float64Array(P * (P + 1));
  for (let i = 0; i < P; i++) {
    for (let j = 0; j < P; j++) A[i * (P + 1) + j] = g[i * P + j] + (i === j ? ridge : 0);
    A[i * (P + 1) + P] = rhs[i];
  }
  for (let col = 0; col < P; col++) {
    let piv = col, best = Math.abs(A[col * (P + 1) + col]);
    for (let r = col + 1; r < P; r++) {
      const v = Math.abs(A[r * (P + 1) + col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-12) continue;
    if (piv !== col) {
      for (let k = col; k <= P; k++) {
        const t = A[col * (P + 1) + k]; A[col * (P + 1) + k] = A[piv * (P + 1) + k]; A[piv * (P + 1) + k] = t;
      }
    }
    const d = A[col * (P + 1) + col];
    for (let k = col; k <= P; k++) A[col * (P + 1) + k] /= d;
    for (let r = 0; r < P; r++) {
      if (r === col) continue;
      const f = A[r * (P + 1) + col];
      if (f === 0) continue;
      for (let k = col; k <= P; k++) A[r * (P + 1) + k] -= f * A[col * (P + 1) + k];
    }
  }
  const out = new Float64Array(P);
  for (let i = 0; i < P; i++) out[i] = A[i * (P + 1) + P];
  return out;
}

/**
 * Decompose weight space into Innate ("unlearned" prior W0) and Plastic ("learned" displacement dW = W - W0),
 * plus neuronal bias norm and QGTL distribution fidelity between innate and current weight magnitudes.
 */
export function weightSpaceDecomp(W, W0, bias = null, mask = null) {
  const n = W.length;
  let n0 = 0, ndw = 0, nw = 0, dot = 0, b2 = 0, fSum = 0;
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    const w = W[i], w0 = W0[i], dw = w - w0;
    n0 += w0 * w0;
    ndw += dw * dw;
    nw += w * w;
    dot += w * w0;
    fSum += Math.sqrt(Math.abs(w * w0));
  }
  if (bias) for (let i = 0; i < bias.length; i++) b2 += bias[i] * bias[i];
  const innateNorm = Math.sqrt(n0), learnedNorm = Math.sqrt(ndw), totalNorm = Math.sqrt(nw);
  const cosInnate = (totalNorm > 1e-9 && innateNorm > 1e-9) ? dot / (totalNorm * innateNorm) : 1;
  // Energy-normalized Bhattacharyya fidelity between |W| and |W0|
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { if (mask && !mask[i]) continue; sa += Math.abs(W[i]); sb += Math.abs(W0[i]); }
  const qgtFid = (sa > 1e-9 && sb > 1e-9) ? Math.min(1, (fSum * fSum) / (sa * sb)) : 1;
  return {
    innateNorm,
    learnedNorm,
    learnedFrac: learnedNorm / (innateNorm + learnedNorm + 1e-9),
    cosInnate,
    biasNorm: Math.sqrt(b2),
    qgtFid,
  };
}
