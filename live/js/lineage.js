// In-page lineage evolution: separable CMA-ES (Ros & Hansen 2008: diagonal covariance, cumulative step-size adaptation)
// over the 44 motor genes, started from the current genome. Each generation, LAMBDA offspring plus the current mean are
// scored by js/sim/fitness.js (forced forward / turn-left / turn-right trials and a righting trial on one hidden body,
// SECS simulated seconds each) in Web Workers off the main thread. The mean is the lineage; "adopt" grows a new creature
// from it and keeps it in localStorage. Short and noisy (one body per generation), unlike the offline run.
import { GENES } from './sim/genome.js';
const LAMBDA = 8, SECS = 6;
export class Lineage {
  constructor(start, onUpdate) { this.onUpdate = onUpdate; const n = this.n = GENES.length; this.m = GENES.map(([nm, lo, hi]) => Math.min(0.97, Math.max(0.03, ((start[nm] ?? (lo + hi) / 2) - lo) / (hi - lo))));
    const mu = this.mu = LAMBDA / 2; let w = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1)); const sw = w.reduce((a, b) => a + b); this.w = w.map((x) => x / sw); const mueff = this.mueff = 1 / this.w.reduce((a, x) => a + x * x, 0);
    this.cs = (mueff + 2) / (n + mueff + 5); this.ds = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + this.cs; this.cc = 4 / (n + 4); const sep = (n + 2) / 3;
    this.c1 = Math.min(1, sep * 2 / ((n + 1.3) ** 2 + mueff)); this.cmu = Math.min(1 - this.c1, sep * 2 * (mueff - 2 + 1 / mueff) / ((n + 2) ** 2 + mueff)); this.chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
    this.sigma = 0.08; this.D2 = new Array(n).fill(1); this.pc = new Array(n).fill(0); this.ps = new Array(n).fill(0); this.gen = 0; this.evals = 0; this.hist = []; this.running = false; this.workers = []; this.jobs = new Map(); this.nextId = 0; this.queue = []; this.r = (0x9e3779b9 ^ Date.now()) >>> 0; }
  rnd() { this.r = (Math.imul(this.r, 1664525) + 1013904223) >>> 0; return this.r / 4294967296; }
  gauss() { return Math.sqrt(-2 * Math.log(this.rnd() + 1e-12)) * Math.cos(2 * Math.PI * this.rnd()); }
  dec(u) { return Object.fromEntries(GENES.map(([nm, lo, hi], i) => [nm, +(lo + Math.min(1, Math.max(0, u[i])) * (hi - lo)).toFixed(4)])); }
  pool() { if (this.workers.length) return; const k = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < k; i++) { const w = new Worker(new URL('./sim/lineage_worker.js?brain=S', import.meta.url), { type: 'module' }); w.onmessage = (e) => { const j = this.jobs.get(e.data.id); this.jobs.delete(e.data.id); w.busy = false; j(e.data); this.pump(); }; w.onerror = (e) => console.warn('lineage worker', e.message); this.workers.push(w); } }
  pump() { for (const w of this.workers) { if (w.busy || !this.queue.length) continue; const q = this.queue.shift(); w.busy = true; this.jobs.set(q.id, q.res); w.postMessage(q.msg); } }
  score(u, seed) { return new Promise((res) => { const id = this.nextId++; this.queue.push({ id, res, msg: { id, genome: this.dec(u), seeds: [seed], secs: SECS } }); this.pump(); }); }
  async run(gens = 6) { if (this.running) return; this.running = true; this.pool(); const n = this.n;
    try { for (let g = 0; g < gens && this.running; g++) { const seed = 1 + Math.floor(this.rnd() * 999); const Y = [], X = [];
        for (let k = 0; k < LAMBDA; k++) { const y = Array.from({ length: n }, (_, i) => Math.sqrt(this.D2[i]) * this.gauss()); Y.push(y); X.push(this.m.map((mi, i) => mi + this.sigma * y[i])); }
        const res = await Promise.all([this.m, ...X].map((u) => this.score(u, seed))); const bad = res.find((r) => r.err); if (bad) throw new Error(bad.err); this.evals += res.length;
        const fm = res[0].r.fit; const F = res.slice(1).map((r, k) => r.r.fit - 0.5 * X[k].reduce((a, u) => a + Math.max(0, -u) + Math.max(0, u - 1), 0)); const idx = F.map((_, k) => k).sort((a, b) => F[b] - F[a]);
        const yw = new Array(n).fill(0); for (let r = 0; r < this.mu; r++) Y[idx[r]].forEach((v, i) => { yw[i] += this.w[r] * v; });
        for (let i = 0; i < n; i++) { this.m[i] = Math.min(1, Math.max(0, this.m[i] + this.sigma * yw[i])); this.ps[i] = (1 - this.cs) * this.ps[i] + Math.sqrt(this.cs * (2 - this.cs) * this.mueff) * yw[i] / Math.sqrt(this.D2[i]); }
        const psn = Math.sqrt(this.ps.reduce((a, v) => a + v * v, 0)); const hs = psn / Math.sqrt(1 - (1 - this.cs) ** (2 * (this.gen + 1))) / this.chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
        for (let i = 0; i < n; i++) { this.pc[i] = (1 - this.cc) * this.pc[i] + hs * Math.sqrt(this.cc * (2 - this.cc) * this.mueff) * yw[i]; let rmu = 0; for (let r = 0; r < this.mu; r++) rmu += this.w[r] * Y[idx[r]][i] ** 2; this.D2[i] = (1 - this.c1 - this.cmu) * this.D2[i] + this.c1 * this.pc[i] ** 2 + this.cmu * rmu; }
        this.sigma = Math.min(0.3, this.sigma * Math.exp((this.cs / this.ds) * (psn / this.chiN - 1))); this.gen++;
        const b = res[1 + idx[0]].r, mr = res[0].r; this.hist.push({ gen: this.gen, seed, mean: fm, best: b.fit, turn: (mr.yL + mr.yR) / 2, v: mr.v, up: mr.up }); this.onUpdate?.(this); } }
    finally { this.running = false; this.onUpdate?.(this); } }
  stop() { this.running = false; }
  genome() { return this.dec(this.m); }
}
