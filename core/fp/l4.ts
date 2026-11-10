// FIRST-PRINCIPLES cue-encoding module (isolated): a cortical input layer (L4-like) that receives the module's own receptor channels through a
// fixed random positive expansion with rectification (a random-feature population code; Rigotti et al. 2013 mixed selectivity; Barak et al. 2013),
// so the stimulus is represented in a static, unadapted code that a linear read-out can decode (Fisher information preserved: an injective
// expansion of the input loses nothing). Original code.
export class InputLayer { W: number[][]; b: number[];
  constructor(readonly nIn: number, readonly K: number, seed: number) { let a = seed >>> 0; const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.W = Array.from({ length: K }, (_, k) => Array.from({ length: nIn }, (_, i) => (k < nIn ? (i === k ? 1 : 0) : r() * 2 - 0.5))); this.b = Array.from({ length: K }, (_, k) => (k < nIn ? 0 : -0.3 * r())); }
  /** the first nIn units are labelled-line copies (receptor -> L4 relay); the rest are random mixtures */
  out(x: ArrayLike<number>): number[] { return this.W.map((w, k) => Math.max(0, w.reduce((a, v, i) => a + v * x[i], 0) + this.b[k])); } }
