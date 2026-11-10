// Central pattern generator built from liquid time-constant (LTC) neurons (Hasani et al. 2021), integrated with the fused
// semi-implicit LTC solver: x <- (x + dt*f*A) / (1 + dt*(1/tau + f)), f = sigmoid(W*y + b + input - g*adapt).
// Rhythm is NOT a scripted sine: it emerges from mutual inhibition between half-centres plus slow spike-frequency-like
// adaptation (a classic half-centre oscillator), and its frequency/phase change with drive and proprioceptive feedback
// because each neuron's effective time constant 1/(1/tau + f) depends on its input (the "liquid" part).
// 24 neurons: 6 segment oscillators (L,R), 4 leg oscillators (F,B), 2 arm oscillators (F,B).
import { sig, mulberry } from './util.js';
export const NCPG = 24;
export class CPG {
  constructor(seed) { const r = mulberry(seed * 77 + 1), N = NCPG; this.N = N; this.x = new Float64Array(N); this.a = new Float64Array(N); this.f = new Float64Array(N); this.W = new Float64Array(N * N); this.b = new Float64Array(N).fill(-0.4);
    this.tau = new Float64Array(N).fill(0.06); this.tauA = new Float64Array(N).fill(0.35); this.g = new Float64Array(N).fill(4.5); this.in = new Float64Array(N);
    const w = (i, j, v) => { this.W[i * N + j] += v; }; // j -> i
    for (let o = 0; o < 12; o++) { const L = 2 * o, R = 2 * o + 1; w(L, R, -6); w(R, L, -6); }
    for (let s = 0; s < 5; s++) { // asymmetric intersegmental coupling: segment s excites segment s+1 (towards the head) on the same side -> a phase lag
      // travels along the body; on this body (anisotropic scale friction) that wave direction propels it forward (measured in test/gait_probe.mjs)
      w(2 * (s + 1), 2 * s, 1.6); w(2 * (s + 1) + 1, 2 * s + 1, 1.6); w(2 * s, 2 * (s + 1), 0.4); w(2 * s + 1, 2 * (s + 1) + 1, 0.4); }
    const legSeg = [1, 1, 3, 3]; for (let l = 0; l < 4; l++) { const F = 12 + 2 * l, B = F + 1, s = legSeg[l]; const same = l % 2 === 0; w(F, 2 * s + (same ? 0 : 1), 1.2); w(B, 2 * s + (same ? 1 : 0), 1.2); }
    for (let a = 0; a < 2; a++) { const F = 20 + 2 * a, B = F + 1; w(F, 10 + a, 1.0); w(B, 11 - a, 1.0); }
    for (let i = 0; i < N; i++) { this.x[i] = r() * 0.5; this.a[i] = r() * 0.5; for (let j = 0; j < N; j++) this.W[i * N + j] += (r() - 0.5) * 0.2; }
  }
  step(dt, ext) { const N = this.N, x = this.x, W = this.W;
    for (let i = 0; i < N; i++) { let s = this.b[i] + ext[i] - this.g[i] * this.a[i]; for (let j = 0; j < N; j++) s += W[i * N + j] * x[j]; this.f[i] = 40 * sig(3 * s); }
    for (let i = 0; i < N; i++) { const f = this.f[i]; x[i] = (x[i] + dt * f * 1) / (1 + dt * (1 / this.tau[i] + f)); this.a[i] += (dt * (x[i] - this.a[i])) / this.tauA[i]; } }
  effTau(i) { return 1 / (1 / this.tau[i] + this.f[i]); }
}
