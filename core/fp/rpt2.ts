// FIRST-PRINCIPLES RPT-2 module (isolated): two modules, each with N rectified units driven by its own feature; cross-module synapses arrive on
// dendrites with a threshold nonlinearity (dendritic conjunction; Häusser & Mel 2003; Larkum 2013) one tick later (recurrence takes time;
// Lamme 2006). After T ticks a linear read-out of both modules can decode XOR(a,b) only if cross-module input mixed nonlinearly. Original code.
export class TwoModule { Wa: number[][]; Wx: number[][]; th: number[]; A: number[]; B: number[];
  constructor(readonly N: number, seed: number) { let s = seed >>> 0; const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.Wa = Array.from({ length: 2 * N }, () => [r() * 2 - 1, r() * 2 - 1]); this.Wx = Array.from({ length: 2 * N }, () => Array.from({ length: N }, () => (r() * 2 - 1) / Math.sqrt(N))); this.th = Array.from({ length: 2 * N }, () => r()); this.A = new Array(N).fill(0); this.B = new Array(N).fill(0); }
  /** one tick: unit i of module (i<N ? A : B) = relu(feedforward(own feature) + dendrite(relu(cross input - th))) ; lesion cuts cross input */
  step(a: number, b: number, lesion: boolean): number[] { const N = this.N, prevA = this.A, prevB = this.B; const u = (i: number) => { const own = i < N ? a : b, other = i < N ? prevB : prevA; const ff = this.Wa[i][0] * own + this.Wa[i][1] * 0.5; const x = lesion ? 0 : this.Wx[i].reduce((s, w, j) => s + w * other[j], 0); return Math.max(0, ff + 2 * Math.max(0, x - this.th[i] * 0.5)); };
    const nA = Array.from({ length: N }, (_, i) => u(i)), nB = Array.from({ length: N }, (_, i) => u(N + i)); this.A = nA; this.B = nB; return [...nA, ...nB]; }
  reset(): void { this.A.fill(0); this.B.fill(0); } }

/** v4.0 apical-gain variant (original code): cross-module input lands on an apical compartment whose sigmoid output MULTIPLIES the basal
 *  (feedforward) drive, so a unit bursts only for basal AND apical coincidence (BAC firing; Larkum, Zhu & Sakmann 1999; Larkum 2013). */
export class ApicalGain extends TwoModule { gain = 3;
  step(a: number, b: number, lesion: boolean): number[] { const N = this.N, pA = this.A, pB = this.B; const u = (i: number) => { const own = i < N ? a : b, other = i < N ? pB : pA; const ff = Math.max(0, this.Wa[i][0] * own + this.Wa[i][1] * 0.5);
      const ap = lesion ? 0 : this.Wx[i].reduce((s, w, j) => s + w * other[j], 0); const g = 1 / (1 + Math.exp(-(ap - (this.th[i] - 0.5) * 0.5) / 0.1)); return ff * (lesion ? 1 : 1 + this.gain * (g - 0.5)) ; };
    const nA = Array.from({ length: N }, (_, i) => u(i)), nB = Array.from({ length: N }, (_, i) => u(N + i)); this.A = nA; this.B = nB; return [...nA, ...nB]; } }

/** v4.0 learned selectivity (original code): cross-module apical weights start all-excitatory and unselective (like the creature's), then
 *  self-organise by Hebbian growth with per-cell synaptic normalisation (heterosynaptic competition; von der Malsburg 1973; Miller, Keller &
 *  Stryker 1989 ocular dominance; Oja 1982), so each apical tree comes to sample one feature group of the other module. */
export class LearnedApical extends ApicalGain {
  constructor(N: number, seed: number) { super(N, seed); for (const row of this.Wx) for (let j = 0; j < row.length; j++) row[j] = Math.abs(row[j]) + 0.05; this.norm(); }
  norm(): void { for (const row of this.Wx) { const s = row.reduce((a, b) => a + b, 0); for (let j = 0; j < row.length; j++) row[j] *= 1 / s; } }
  /** centre apical drive on the population mean (feedforward inhibition) so weights carry a sign-free but selective signal */
  learn(eta = 0.05): void { const N = this.N; for (let i = 0; i < 2 * N; i++) { const post = i < N ? this.A[i] : this.B[i - N], pre = i < N ? this.B : this.A; const pm = pre.reduce((a, b) => a + b, 0) / N;
      for (let j = 0; j < N; j++) this.Wx[i][j] = Math.max(0, this.Wx[i][j] + eta * post * (pre[j] - pm)); } this.norm(); }
  step(a: number, b: number, lesion: boolean): number[] { const N = this.N, pA = this.A, pB = this.B; const u = (i: number) => { const own = i < N ? a : b, other = i < N ? pB : pA; const ff = Math.max(0, this.Wa[i][0] * own + this.Wa[i][1] * 0.5);
      const om = other.reduce((x, y) => x + y, 0) / N; const ap = lesion ? 0 : this.Wx[i].reduce((s, w, j) => s + w * (other[j] - om), 0) * N; const g = 1 / (1 + Math.exp(-(ap - (this.th[i] - 0.5) * 0.2) / 0.1)); return ff * (lesion ? 1 : 1 + this.gain * (g - 0.5)); };
    const nA = Array.from({ length: N }, (_, i) => u(i)), nB = Array.from({ length: N }, (_, i) => u(N + i)); this.A = nA; this.B = nB; return [...nA, ...nB]; } }

/** v4.0 signed-selective variant (original code): cross weights are a zero-mean tuning kernel around one preferred source cell (selective
 *  excitation minus disynaptic inhibition; Pouille & Scanziani 2001; Ko et al. 2011), summed at the SOMA with a rectifying threshold — no
 *  dendritic nonlinearity. Tests whether selectivity + somatic threshold alone suffices for a×b mixing. */
export class SignedSelective extends TwoModule { constructor(N: number, seed: number) { super(N, seed); for (let i = 0; i < 2 * N; i++) { const p = Math.floor(((i * 7919 + seed) % 1000) / 1000 * N); const k = Array.from({ length: N }, (_, j) => Math.exp(-((j - p) ** 2) / 2)); const mu = k.reduce((x, y) => x + y, 0) / N; this.Wx[i] = k.map((x) => 2 * (x - mu)); } }
  step(a: number, b: number, lesion: boolean): number[] { const N = this.N, pA = this.A, pB = this.B; const u = (i: number) => { const own = i < N ? a : b, other = i < N ? pB : pA; const ff = this.Wa[i][0] * own + this.Wa[i][1] * 0.5; const x = lesion ? 0 : this.Wx[i].reduce((s, w, j) => s + w * other[j], 0); return Math.max(0, ff + x - 0.3 * this.th[i]); };
    const nA = Array.from({ length: N }, (_, i) => u(i)), nB = Array.from({ length: N }, (_, i) => u(N + i)); this.A = nA; this.B = nB; return [...nA, ...nB]; } }
