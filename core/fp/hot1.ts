// FIRST-PRINCIPLES HOT-1 module (isolated). Percept = posterior mean E[clean | x] under a learned generative model:
// K prototypes mu_k (running means of taught clean patterns), shared isotropic noise variance s2 (running mean of squared residuals),
// learned class prior pi_k. Bayes: p(k|x) ∝ pi_k N(x; mu_k, s2 I); percept = Σ p(k|x) mu_k. (Rao & Ballard 1999; Lau 2008.) Original code.
export class ProtoPosterior {
  mu: number[][]; pi: number[]; s2 = 0.25; n: number[];
  constructor(readonly K: number, readonly D: number) { this.mu = Array.from({ length: K }, () => new Array(D).fill(1 / D)); this.pi = new Array(K).fill(1 / K); this.n = new Array(K).fill(0); }
  post(x: number[]): number[] { const lp = this.mu.map((m, k) => Math.log(this.pi[k]) - m.reduce((a, v, j) => a + (x[j] - v) ** 2, 0) / (2 * this.s2)); const mx = Math.max(...lp); const w = lp.map((l) => Math.exp(l - mx)); const z = w.reduce((a, b) => a + b, 0); return w.map((v) => v / z); }
  percept(x: number[]): number[] { const p = this.post(x); const out = new Array(this.D).fill(0); for (let k = 0; k < this.K; k++) for (let j = 0; j < this.D; j++) out[j] += p[k] * this.mu[k][j]; return out; }
  /** teach with the noisy observation x of class k and its clean target */
  teach(x: number[], k: number, clean: number[]): void { this.n[k]++; const lr = Math.max(0.05, 1 / this.n[k]); for (let j = 0; j < this.D; j++) this.mu[k][j] += lr * (clean[j] - this.mu[k][j]);
    const r2 = x.reduce((a, v, j) => a + (v - clean[j]) ** 2, 0) / this.D; this.s2 += 0.05 * (Math.max(1e-3, r2) - this.s2); for (let i = 0; i < this.K; i++) this.pi[i] += 0.02 * ((i === k ? 1 : 0) - this.pi[i]); }
}
