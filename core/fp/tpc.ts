// Temporal predictive core (TPC). One general mechanism: a recurrent state h driven by input x and by its OWN learned K-step
// forecast (reentry). Readouts V1 (next step) and VK (K steps ahead) are learned online by normalized LMS on the model's own
// prediction error. Because the forecast is fed back, the closed-loop dynamics (W + U*VK) are learned, not designed.
// Sources: echo-state reservoir (Jaeger 2001 GMD Rep 148); NLMS (Widrow & Hoff 1960); forward models (Wolpert, Ghahramani & Jordan 1995
// Science 269:1880); predictive coding (Rao & Ballard 1999 Nat Neurosci 2:79); reentry (Edelman 1987; Lamme 2006 TICS 10:494); allostasis
// (Sterling 2012 Physiol Behav 106:5). Original code.
export class TPC {
  N: number; D: number; K: number; h: Float64Array; W: Float64Array; U: Float64Array; V1: Float64Array; VK: Float64Array; buf: Float64Array[] = []; x1: Float64Array; xK: Float64Array; err = 0; errK = 0;
  constructor(D: number, r: () => number, o: { N?: number; K?: number; leak?: number; rho?: number; lam?: number; lr?: number; learn?: boolean } = {}) {
    this.D = D; this.N = o.N ?? 64; this.K = o.K ?? 10; this.o = { leak: o.leak ?? 0.3, rho: o.rho ?? 0.9, lam: o.lam ?? 0.8, lr: o.lr ?? 0.05, learn: o.learn ?? true };
    const N = this.N, g = () => (r() + r() + r() - 1.5) * 2; this.h = new Float64Array(N); this.W = new Float64Array(N * N).map(() => (g() * this.o.rho) / Math.sqrt(N)); this.U = new Float64Array(N * D).map(() => g());
    this.V1 = new Float64Array(D * N); this.VK = new Float64Array(D * N); this.x1 = new Float64Array(D); this.xK = new Float64Array(D);
  }
  o: { leak: number; rho: number; lam: number; lr: number; learn: boolean };
  private read(V: Float64Array, h: Float64Array, out: Float64Array) { for (let d = 0; d < this.D; d++) { let s = 0; for (let j = 0; j < this.N; j++) s += V[d * this.N + j] * h[j]; out[d] = s; } }
  private learn(V: Float64Array, h: Float64Array, x: ArrayLike<number>) { let hh = 1e-3; for (let j = 0; j < this.N; j++) hh += h[j] * h[j]; let e2 = 0;
    for (let d = 0; d < this.D; d++) { let p = 0; for (let j = 0; j < this.N; j++) p += V[d * this.N + j] * h[j]; const e = x[d] - p; e2 += e * e; if (this.o.learn) for (let j = 0; j < this.N; j++) V[d * this.N + j] += (this.o.lr * e * h[j]) / hh; } return e2 / this.D; }
  // x: current observation. Returns K-step forecast.
  step(x: ArrayLike<number>): Float64Array { const N = this.N, D = this.D;
    if (this.buf.length >= 1) this.err = this.learn(this.V1, this.buf[this.buf.length - 1], x); if (this.buf.length >= this.K) this.errK = this.learn(this.VK, this.buf[this.buf.length - this.K], x);
    const a = this.o.leak, nh = new Float64Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += this.W[i * N + j] * this.h[j]; for (let d = 0; d < D; d++) s += this.U[i * D + d] * (x[d] + this.o.lam * this.xK[d]); nh[i] = (1 - a) * this.h[i] + a * Math.tanh(s); }
    this.h = nh; this.buf.push(nh); if (this.buf.length > this.K) this.buf.shift(); this.read(this.V1, nh, this.x1); this.read(this.VK, nh, this.xK); return this.xK; }
}
