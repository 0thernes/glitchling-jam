// EFM: forward model trained in sleep by exact BPTT (Werbos 1990) + Adam (Kingma & Ba 2015). The training math is a TS port; its gradient is
// verified against Eshkol's exact reverse-mode `gradient` (Tsotchke, MIT; credited) in efm_check.ts (the oracle pattern of ESHKOL-DEEP-DIVE.md §3-4).
// h_t = tanh(Wh h_{t-1} + Wx x_t + b); yhat_t = wo . h_t + bo predicts target y_t (glucose error K ticks ahead). Loss: mean squared error after a burn-in.
export class EFM {
  H: number; D: number; p: Float64Array; m: Float64Array; v: Float64Array; k = 0; h: Float64Array; trained = 0;
  constructor(D: number, r: () => number, H = 10) { this.H = H; this.D = D; const n = H * H + H * D + H + H + 1; this.p = new Float64Array(n).map(() => (r() * 2 - 1) * 0.3); this.m = new Float64Array(n); this.v = new Float64Array(n); this.h = new Float64Array(H); }
  get n() { return this.p.length; }
  // parameter layout: Wh [H*H] | Wx [H*D] | b [H] | wo [H] | bo [1]
  cell(p: ArrayLike<number>, h: ArrayLike<number>, x: ArrayLike<number>): Float64Array { const H = this.H, D = this.D, nh = new Float64Array(H), oX = H * H, oB = oX + H * D;
    for (let i = 0; i < H; i++) { let s = p[oB + i]; for (let j = 0; j < H; j++) s += p[i * H + j] * h[j]; for (let d = 0; d < D; d++) s += p[oX + i * D + d] * x[d]; nh[i] = Math.tanh(s); } return nh; }
  out(p: ArrayLike<number>, h: ArrayLike<number>): number { const H = this.H, oO = H * H + H * this.D + H; let s = p[oO + H]; for (let j = 0; j < H; j++) s += p[oO + j] * h[j]; return s; }
  loss(p: ArrayLike<number>, xs: number[][], ys: number[], B: number): number { let h: ArrayLike<number> = new Float64Array(this.H), L = 0; for (let t = 0; t < xs.length; t++) { h = this.cell(p, h, xs[t]); if (t >= B) L += (this.out(p, h) - ys[t]) ** 2; } return L / Math.max(1, xs.length - B); }
  grad(xs: number[][], ys: number[], B: number): Float64Array { const H = this.H, D = this.D, p = this.p, T = xs.length, g = new Float64Array(this.n), oX = H * H, oB = oX + H * D, oO = oB + H, oBo = oO + H; const hs: Float64Array[] = [new Float64Array(H)];
    for (let t = 0; t < T; t++) hs.push(this.cell(p, hs[t], xs[t])); const N = Math.max(1, T - B); let dh = new Float64Array(H);
    for (let t = T - 1; t >= 0; t--) { const h = hs[t + 1], hp = hs[t]; if (t >= B) { const e = (2 * (this.out(p, h) - ys[t])) / N; g[oBo] += e; for (let j = 0; j < H; j++) { g[oO + j] += e * h[j]; dh[j] += e * p[oO + j]; } }
      const da = new Float64Array(H); for (let i = 0; i < H; i++) da[i] = dh[i] * (1 - h[i] * h[i]); const ndh = new Float64Array(H);
      for (let i = 0; i < H; i++) { g[oB + i] += da[i]; for (let j = 0; j < H; j++) { g[i * H + j] += da[i] * hp[j]; ndh[j] += da[i] * p[i * H + j]; } for (let d = 0; d < D; d++) g[oX + i * D + d] += da[i] * xs[t][d]; } dh = ndh; }
    return g; }
  adam(g: Float64Array, lr = 0.01): void { this.k++; const b1 = 0.9, b2 = 0.999; for (let i = 0; i < this.n; i++) { const gi = Math.max(-5, Math.min(5, g[i])); this.m[i] = b1 * this.m[i] + (1 - b1) * gi; this.v[i] = b2 * this.v[i] + (1 - b2) * gi * gi; this.p[i] -= (lr * this.m[i] / (1 - b1 ** this.k)) / (Math.sqrt(this.v[i] / (1 - b2 ** this.k)) + 1e-8); } this.trained++; }
  // online inference: advance the live state; peek(x) returns the forecast if x were the input now (rollout of a hypothetical action) without advancing.
  advance(x: number[]): number { this.h = this.cell(this.p, this.h, x); return this.out(this.p, this.h); }
  peek(x: number[]): number { return this.out(this.p, this.cell(this.p, this.h, x)); }
}

// Vector-output variant (cortical forward model): yhat_t = Wo h_t + bo (Do outputs). Same cell; loss = mean over t>=B, d of squared error.
export class EFMV extends EFM {
  Do: number;
  constructor(D: number, Do: number, r: () => number, H = 16) { super(D, r, H); this.Do = Do; const n = H * H + H * D + H + Do * H + Do; this.p = new Float64Array(n).map(() => (r() * 2 - 1) * 0.3); this.m = new Float64Array(n); this.v = new Float64Array(n); }
  outV(p: ArrayLike<number>, h: ArrayLike<number>): Float64Array { const H = this.H, oO = H * H + H * this.D + H, y = new Float64Array(this.Do); for (let d = 0; d < this.Do; d++) { let s = p[oO + this.Do * H + d]; for (let j = 0; j < H; j++) s += p[oO + d * H + j] * h[j]; y[d] = s; } return y; }
  lossV(p: ArrayLike<number>, xs: number[][], ys: number[][], B: number): number { let h: ArrayLike<number> = new Float64Array(this.H), L = 0; for (let t = 0; t < xs.length; t++) { h = this.cell(p, h, xs[t]); if (t >= B) { const y = this.outV(p, h); for (let d = 0; d < this.Do; d++) L += (y[d] - ys[t][d]) ** 2; } } return L / (Math.max(1, xs.length - B) * this.Do); }
  gradV(xs: number[][], ys: number[][], B: number): Float64Array { const H = this.H, D = this.D, Do = this.Do, p = this.p, T = xs.length, g = new Float64Array(this.n), oX = H * H, oB = oX + H * D, oO = oB + H, oBo = oO + Do * H; const hs: Float64Array[] = [new Float64Array(H)];
    for (let t = 0; t < T; t++) hs.push(this.cell(p, hs[t], xs[t])); const N = Math.max(1, T - B) * Do; let dh = new Float64Array(H);
    for (let t = T - 1; t >= 0; t--) { const h = hs[t + 1], hp = hs[t]; if (t >= B) { const y = this.outV(p, h); for (let d = 0; d < Do; d++) { const e = (2 * (y[d] - ys[t][d])) / N; g[oBo + d] += e; for (let j = 0; j < H; j++) { g[oO + d * H + j] += e * h[j]; dh[j] += e * p[oO + d * H + j]; } } }
      const da = new Float64Array(H); for (let i = 0; i < H; i++) da[i] = dh[i] * (1 - h[i] * h[i]); const ndh = new Float64Array(H);
      for (let i = 0; i < H; i++) { g[oB + i] += da[i]; for (let j = 0; j < H; j++) { g[i * H + j] += da[i] * hp[j]; ndh[j] += da[i] * p[i * H + j]; } for (let d = 0; d < D; d++) g[oX + i * D + d] += da[i] * xs[t][d]; } dh = ndh; }
    return g; }
  advanceV(x: number[]): Float64Array { this.h = this.cell(this.p, this.h, x); return this.outV(this.p, this.h); }
}
