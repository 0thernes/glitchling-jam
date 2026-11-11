// In-page lineage evolution: variance-reduced Mirrored Separable CMA-ES (Ros & Hansen 2008; Brockhoff et al. 2010)
// over ALL 78 developmental genes (58 motor/CPG/synergy/gaze/roll-damping + 20 sense->MOT steering/obstacle/postural genes).
// Fixes the pass-14 single-body noise problem via three mechanisms:
//  1) Paired Multi-Body Common Random Numbers (CRN): every candidate in the lineage is evaluated on the same paired cohort of
//     2 diverse rough-terrain bodies (with rocks, springs, forced locomotion/righting AND closed-loop goal steering).
//  2) Antithetic (mirrored) sampling (+y_k, -y_k pairs), halving gradient estimation variance in 78D.
//  3) Elitist CRN mean verification: the updated CMA-ES mean (and top mutant fallback) is verified on the CRN body pair before
//     acceptance, guaranteeing non-decreasing multi-body lineage fitness across generations.
import { FULL_GENES } from './sim/genome.js';

const LAMBDA = 8, SECS = 5;

export class Lineage {
  constructor(start, onUpdate, refSeeds = [2, 5]) {
    this.onUpdate = onUpdate;
    this.refSeeds = refSeeds;
    const n = (this.n = FULL_GENES.length);
    this.m = FULL_GENES.map(([nm, lo, hi]) =>
      Math.min(0.97, Math.max(0.03, ((start[nm] ?? (lo + hi) / 2) - lo) / (hi - lo)))
    );
    const mu = (this.mu = LAMBDA / 2);
    const w = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
    const sw = w.reduce((a, b) => a + b);
    this.w = w.map((x) => x / sw);
    const mueff = (this.mueff = 1 / this.w.reduce((a, x) => a + x * x, 0));

    this.cs = (mueff + 2) / (n + mueff + 5);
    this.ds = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + this.cs;
    this.cc = 4 / (n + 4);
    const sep = (n + 2) / 3;
    this.c1 = Math.min(1, (sep * 2) / ((n + 1.3) ** 2 + mueff));
    this.cmu = Math.min(1 - this.c1, (sep * 2 * (mueff - 2 + 1 / mueff)) / ((n + 2) ** 2 + mueff));
    this.chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));

    this.sigma = 0.028;
    this.D2 = new Array(n).fill(1);
    this.pc = new Array(n).fill(0);
    this.ps = new Array(n).fill(0);
    this.gen = 0;
    this.evals = 0;
    this.startFit = null;
    this.curRes = null;
    this.hist = [];
    this.running = false;
    this.workers = [];
    this.jobs = new Map();
    this.nextId = 0;
    this.queue = [];
    this.r = (0x9e3779b9 ^ Date.now()) >>> 0;
  }

  rnd() {
    this.r = (Math.imul(this.r, 1664525) + 1013904223) >>> 0;
    return this.r / 4294967296;
  }
  gauss() {
    return Math.sqrt(-2 * Math.log(this.rnd() + 1e-12)) * Math.cos(2 * Math.PI * this.rnd());
  }
  dec(u) {
    return Object.fromEntries(
      FULL_GENES.map(([nm, lo, hi], i) => [nm, +(lo + Math.min(1, Math.max(0, u[i])) * (hi - lo)).toFixed(4)])
    );
  }

  pool() {
    if (this.workers.length) return;
    const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const k = Math.max(2, Math.min(6, hw - 1));
    for (let i = 0; i < k; i++) {
      const w = new Worker(new URL('./sim/lineage_worker.js?brain=S', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        const j = this.jobs.get(e.data.id);
        this.jobs.delete(e.data.id);
        w.busy = false;
        j(e.data);
        this.pump();
      };
      w.onerror = (e) => console.warn('lineage worker', e.message);
      this.workers.push(w);
    }
  }

  pump() {
    for (const w of this.workers) {
      if (w.busy || !this.queue.length) continue;
      const q = this.queue.shift();
      w.busy = true;
      this.jobs.set(q.id, q.res);
      w.postMessage(q.msg);
    }
  }

  score(u, seeds = this.refSeeds) {
    return new Promise((res) => {
      const id = this.nextId++;
      this.queue.push({
        id,
        res,
        msg: { id, genome: this.dec(u), seeds, secs: SECS, opts: { rough: true, steer: true } },
      });
      this.pump();
    });
  }

  async run(gens = 6) {
    if (this.running) return;
    this.running = true;
    this.pool();
    const n = this.n;
    try {
      if (!this.curRes) {
        const r0 = await this.score(this.m);
        if (r0.err) throw new Error(r0.err);
        this.evals++;
        this.curRes = r0.r;
        this.startFit = r0.r.fit;
      }

      for (let g = 0; g < gens && this.running; g++) {
        // Mirrored (antithetic) perturbation pairs (+y, -y) across all 78 genes
        const Y = [], X = [];
        for (let k = 0; k < LAMBDA / 2; k++) {
          const y = Array.from({ length: n }, (_, i) => Math.sqrt(this.D2[i]) * this.gauss());
          const ym = y.map((v) => -v);
          Y.push(y, ym);
          X.push(
            this.m.map((mi, i) => mi + this.sigma * y[i]),
            this.m.map((mi, i) => mi + this.sigma * ym[i])
          );
        }
        const Xc = X.map((x) => x.map((u) => Math.min(1, Math.max(0, u))));
        const res = await Promise.all(Xc.map((u) => this.score(u)));
        const bad = res.find((r) => r.err);
        if (bad) throw new Error(bad.err);
        this.evals += res.length;

        const fm = this.curRes.fit;
        const F = res.map((r, k) => r.r.fit - 0.5 * X[k].reduce((a, u) => a + Math.max(0, -u) + Math.max(0, u - 1), 0));
        const idx = F.map((_, k) => k).sort((a, b) => F[b] - F[a]);

        const yw = new Array(n).fill(0);
        for (let r = 0; r < this.mu; r++) Y[idx[r]].forEach((v, i) => { yw[i] += this.w[r] * v; });
        const mCand = this.m.map((mi, i) => Math.min(1, Math.max(0, mi + this.sigma * yw[i])));

        // Verify candidate mean on the exact same CRN body cohort
        const rCand = await this.score(mCand);
        if (rCand.err) throw new Error(rCand.err);
        this.evals++;

        const bestChildRes = res[idx[0]].r;
        let accepted = false;
        if (rCand.r.fit >= fm - 1e-6) {
          this.m = mCand;
          this.curRes = rCand.r;
          accepted = true;
        } else if (bestChildRes.fit > fm) {
          // Elitist fallback: adopt the strictly superior verified mutant on the CRN cohort
          const yBest = Xc[idx[0]].map((u, i) => (u - this.m[i]) / Math.max(1e-6, this.sigma));
          for (let i = 0; i < n; i++) yw[i] = yBest[i];
          this.m = Xc[idx[0]];
          this.curRes = bestChildRes;
          accepted = true;
        }

        if (accepted) {
          for (let i = 0; i < n; i++) {
            this.ps[i] = (1 - this.cs) * this.ps[i] + Math.sqrt(this.cs * (2 - this.cs) * this.mueff) * (yw[i] / Math.sqrt(this.D2[i]));
          }
          const psn = Math.sqrt(this.ps.reduce((a, v) => a + v * v, 0));
          const hs = psn / Math.sqrt(1 - (1 - this.cs) ** (2 * (this.gen + 1))) / this.chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
          for (let i = 0; i < n; i++) {
            this.pc[i] = (1 - this.cc) * this.pc[i] + hs * Math.sqrt(this.cc * (2 - this.cc) * this.mueff) * yw[i];
            let rmu = 0;
            for (let r = 0; r < this.mu; r++) rmu += this.w[r] * Y[idx[r]][i] ** 2;
            this.D2[i] = (1 - this.c1 - this.cmu) * this.D2[i] + this.c1 * this.pc[i] ** 2 + this.cmu * rmu;
          }
          this.sigma = Math.min(0.22, Math.max(0.012, this.sigma * Math.exp((this.cs / this.ds) * (psn / this.chiN - 1))));
        } else {
          // Step overshot on CRN cohort: hold elite mean and contract step size
          this.sigma = Math.max(0.012, this.sigma * 0.8);
        }

        this.gen++;
        const mr = this.curRes;
        this.hist.push({
          gen: this.gen,
          seeds: this.refSeeds.join(','),
          mean: mr.fit,
          delta: mr.fit - this.startFit,
          best: Math.max(mr.fit, bestChildRes.fit),
          turn: (mr.yL + mr.yR) / 2,
          v: mr.v,
          up: mr.up,
          goal: mr.goal ?? 0,
        });
        this.onUpdate?.(this);
      }
    } finally {
      this.running = false;
      this.onUpdate?.(this);
    }
  }

  stop() { this.running = false; }
  genome() { return this.dec(this.m); }
}
