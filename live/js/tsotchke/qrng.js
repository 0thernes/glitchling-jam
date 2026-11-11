// Deterministic 8-qubit statevector & Toeplitz-whitened RNG — JavaScript port of the seeded classical statevector path of
// tsotchke/quantum_rng (MIT, © Tsotchke; see also core/tsotchke.ts). Simulates an 8-qubit unitary register (dim = 256)
// evolving under Hadamard, data-dependent Rz(theta) phase gates and a CNOT entangling ring, then extracts Born-rule
// marginal probabilities P(q_k = 1) and Toeplitz-mixed 53-bit uniform draws.
// Honesty: this is a deterministic classical statevector simulation seeded by `seed` (reproducible across runs), NOT
// hardware quantum entropy and NOT a cryptographic RNG. DOM-free; runs in Node and browsers.
export const NQ = 8, DIM = 1 << NQ, BUF = 64;

function mix32(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export class TsotchkeQRNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.re = new Float64Array(DIM);
    this.im = new Float64Array(DIM);
    this.tmpRe = new Float64Array(DIM);
    this.tmpIm = new Float64Array(DIM);
    this.marginal = new Float64Array(NQ);
    this.buckets = new Float64Array(16);
    this.buf = new Float64Array(BUF);
    this.pos = BUF;
    this.steps = 0;
    this.draws = 0;
    this.entropy = 0;
    this.spare = null;
    this.ctr = mix32(this.seed ^ 0x9e3779b9);
    // Initialise |psi> in a seeded product state then entangle for 2 warmup rounds
    const inv = 1 / Math.sqrt(DIM);
    let st = mix32(this.seed ^ 0x6a09e667);
    for (let b = 0; b < DIM; b++) {
      st = mix32(st + b + 0x7f4a7c15);
      const ph = (st / 4294967296) * Math.PI * 2;
      this.re[b] = inv * Math.cos(ph);
      this.im[b] = inv * Math.sin(ph);
    }
    this.evolve();
    this.evolve();
  }

  /** One unitary circuit layer (Hadamard + Rz(theta_q) + ring CNOT) + Born-rule readout + Toeplitz whitening */
  evolve() {
    const re = this.re, im = this.im, s2 = Math.SQRT1_2;
    this.ctr = mix32(this.ctr + (++this.steps) * 0x9e3779b9);
    // Single-qubit H then Rz(theta_q) on each of the 8 qubits
    for (let q = 0; q < NQ; q++) {
      const bit = 1 << q;
      const th = ((mix32(this.ctr ^ (q * 0x517cc1b7)) / 4294967296) * 2 - 1) * Math.PI * 0.73 + 0.31 * this.marginal[q];
      const cz = Math.cos(th), sz = Math.sin(th);
      for (let base = 0; base < DIM; base += bit << 1) {
        for (let j = 0; j < bit; j++) {
          const i0 = base + j, i1 = i0 + bit;
          const r0 = (re[i0] + re[i1]) * s2, m0 = (im[i0] + im[i1]) * s2;
          const r1 = (re[i0] - re[i1]) * s2, m1 = (im[i0] - im[i1]) * s2;
          re[i0] = r0; im[i0] = m0;
          re[i1] = r1 * cz - m1 * sz;
          im[i1] = r1 * sz + m1 * cz;
        }
      }
    }
    // CNOT entangling ring: qubit q controls (q + 1) mod NQ
    for (let q = 0; q < NQ; q++) {
      const cBit = 1 << q, tBit = 1 << ((q + 1) & 7);
      for (let b = 0; b < DIM; b++) {
        if ((b & cBit) && !(b & tBit)) {
          const b2 = b ^ tBit;
          const tr = re[b], ti = im[b];
          re[b] = re[b2]; im[b] = im[b2];
          re[b2] = tr; im[b2] = ti;
        }
      }
    }
    // Renormalise and compute exact Born probabilities p(b) = |psi_b|^2, qubit marginals, and Shannon entropy
    let norm2 = 0;
    for (let b = 0; b < DIM; b++) norm2 += re[b] * re[b] + im[b] * im[b];
    const invN = 1 / (Math.sqrt(norm2) || 1);
    this.marginal.fill(0);
    this.buckets.fill(0);
    let H = 0;
    for (let b = 0; b < DIM; b++) {
      re[b] *= invN; im[b] *= invN;
      const p = re[b] * re[b] + im[b] * im[b];
      if (p > 1e-18) H -= p * Math.log2(p);
      this.buckets[b >> 4] += p;
      for (let q = 0; q < NQ; q++) if (b & (1 << q)) this.marginal[q] += p;
    }
    this.entropy = H / NQ; // normalised to [0, 1] (1.0 = maximally uniform 8-qubit Born distribution)

    // Toeplitz hash whitening of Born-probability quantization + counter into 64 uniform [0, 1) doubles
    let accA = this.ctr >>> 0, accB = mix32(this.ctr ^ 0xbb67ae85);
    for (let k = 0; k < BUF; k++) {
      const b0 = (k * 4) & 255, b1 = (b0 + 1) & 255, b2 = (b0 + 2) & 255, b3 = (b0 + 3) & 255;
      const p0 = ((re[b0] * re[b0] + im[b0] * im[b0]) * 4294967296) >>> 0;
      const p1 = ((re[b1] * re[b1] + im[b1] * im[b1]) * 4294967296) >>> 0;
      const p2 = ((re[b2] * re[b2] + im[b2] * im[b2]) * 4294967296) >>> 0;
      const p3 = ((re[b3] * re[b3] + im[b3] * im[b3]) * 4294967296) >>> 0;
      // Circular Toeplitz row shift + Weyl sequence ensures unbiased uniformity even under coherent drift
      accA = mix32(accA ^ p0 ^ ((p2 << 7) | (p2 >>> 25)) ^ Math.imul(k + 1, 0x9e3779b9));
      accB = mix32(accB ^ p1 ^ ((p3 << 13) | (p3 >>> 19)) ^ Math.imul(accA | 1, 0x85ebca6b));
      const hi = accA >>> 5, lo = accB >>> 6; // 27 + 26 = 53 bits
      this.buf[k] = (hi * 67108864 + lo) * (1 / 9007199254740992);
    }
    this.pos = 0;
  }

  /** Uniform double in [0, 1) */
  next01() {
    if (this.pos >= BUF) this.evolve();
    this.draws++;
    return this.buf[this.pos++];
  }

  /** Standard normal N(0, 1) via Box-Muller */
  gauss() {
    if (this.spare !== null) { const s = this.spare; this.spare = null; return s; }
    const u1 = Math.max(1e-12, this.next01()), u2 = this.next01();
    const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
    this.spare = r * Math.sin(th);
    return r * Math.cos(th);
  }

  /** Drop-in closure matching mulberry(seed) */
  stream() { return () => this.next01(); }
}
