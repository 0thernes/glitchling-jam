// AOM: action-outcome model for site choice. Per-site base yield (Kalman, random-walk drift q) x shared learned consequence curve
// c(bin of ticks since own last success at that site). Information gain = 0.5 ln(1 + predictive variance / outcome noise).
export class AOM { m: Float64Array; P: Float64Array; last: Float64Array; c: Float64Array; nc: Float64Array; useCurve: boolean;
  constructor(public K: number, public NB = 9, public BW = 15, public q = 2e-5, useCurve = true) { this.m = new Float64Array(K).fill(0.3); this.P = new Float64Array(K).fill(0.04); this.last = new Float64Array(K).fill(-1e9); this.c = new Float64Array(NB).fill(1); this.nc = new Float64Array(NB); this.useCurve = useCurve; }
  bin(k: number, t: number): number { return this.useCurve ? Math.min(this.NB - 1, Math.floor((t - this.last[k]) / this.BW)) : this.NB - 1; }
  tick(): void { for (let k = 0; k < this.K; k++) this.P[k] = Math.min(0.25, this.P[k] + this.q); }
  pred(k: number, t: number): number { return Math.min(1, Math.max(0, this.m[k] * this.c[this.bin(k, t)])); }
  ig(k: number, t: number): number { const b = this.bin(k, t), c = this.c[b], m = this.m[k], p = this.pred(k, t); const vc = this.useCurve ? 0.25 / (this.nc[b] + 1) : 0; const V = c * c * this.P[k] + m * m * vc; return 0.5 * Math.log(1 + V / (p * (1 - p) + 0.02)); }
  observe(k: number, t: number, r: number): void { const b = this.bin(k, t), c = this.c[b], p = this.pred(k, t), R = p * (1 - p) + 0.02;
    const G = (this.P[k] * c) / (c * c * this.P[k] + R); this.m[k] += G * (r - p); this.P[k] *= 1 - G * c; this.m[k] = Math.min(1, Math.max(0.01, this.m[k]));
    if (this.useCurve && b < this.NB - 1) { this.c[b] += (0.3 / (this.nc[b] + 3)) * (r / Math.max(0.05, this.m[k]) - c); this.c[b] = Math.max(0, Math.min(1.5, this.c[b])); this.nc[b]++; }
    if (r > 0) this.last[k] = t; } }
