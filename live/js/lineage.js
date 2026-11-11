// In-page lineage evolution (upgraded in pass 16): supports BOTH
//  A) Local variance-reduced Mirrored Separable CMA-ES refinement ('refine', default 6 gens from current/starter genome), AND
//  B) True De-Novo Evolution From Pure Uniform Random [0, 1]^78 Weights ('denovo', 10 gens starting with a 12-member
//     Stratified Latin-Hypercube primordial random screen + Mirrored Separable CMA-ES with CSA & CRN elitist verification),
// over ALL 78 developmental genes (58 motor/CPG/synergy/gaze/roll-damping + 20 sense->MOT steering/obstacle/postural genes).
import { FULL_GENES } from './sim/genome.js';

const LAMBDA = 8, SECS = 5, LHS_POP = 12;

export class Lineage {
  constructor(start, onUpdate, refSeeds = [2, 5], opts = {}) {
    this.onUpdate = onUpdate;
    this.refSeeds = refSeeds;
    this.mode = opts.mode || (start === null ? 'denovo' : 'refine');
    this.evalFn = opts.evalFn || null;
    this.secs = opts.secs || SECS;
    this.r = ((opts.seed ?? (0x9e3779b9 ^ Date.now())) >>> 0) || 0x9e3779b9;

    const n = (this.n = FULL_GENES.length);
    if (this.mode === 'denovo') {
      // Pure uniform random [0.05, 0.95]^78 initialization — zero starter or hand-wired priors!
      this.m = Array.from({ length: n }, () => 0.05 + 0.9 * this.rnd());
    } else {
      this.m = FULL_GENES.map(([nm, lo, hi]) =>
        Math.min(0.97, Math.max(0.03, ((start[nm] ?? (lo + hi) / 2) - lo) / (hi - lo)))
      );
    }

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

    this.sigma = this.mode === 'denovo' ? 0.22 : 0.028;
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

  /** Stratified Latin-Hypercube sample of K uniform random points in [0.05, 0.95]^n (purely random marginals, space-filling) */
  latinHypercube(K) {
    const n = this.n;
    const pop = Array.from({ length: K }, () => new Array(n));
    const perm = Array.from({ length: K }, (_, k) => k);
    for (let i = 0; i < n; i++) {
      for (let k = K - 1; k > 0; k--) {
        const j = Math.floor(this.rnd() * (k + 1));
        const tmp = perm[k]; perm[k] = perm[j]; perm[j] = tmp;
      }
      for (let k = 0; k < K; k++) {
        pop[k][i] = 0.05 + 0.9 * ((perm[k] + this.rnd()) / K);
      }
    }
    return pop;
  }

  pool() {
    if (this.evalFn || this.workers.length) return;
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
    const genome = this.dec(u);
    const opts = { rough: true, steer: true };
    if (this.evalFn) {
      return Promise.resolve({ r: this.evalFn(genome, seeds, this.secs, opts) });
    }
    return new Promise((res) => {
      const id = this.nextId++;
      this.queue.push({
        id,
        res,
        msg: { id, genome, seeds, secs: this.secs, opts },
      });
      this.pump();
    });
  }

  async run(gens = this.mode === 'denovo' ? 10 : 6) {
    if (this.running) return;
    this.running = true;
    this.pool();
    const n = this.n;
    const minSigma = this.mode === 'denovo' ? 0.032 : 0.012;
    const maxSigma = this.mode === 'denovo' ? 0.28 : 0.22;

    try {
      if (!this.curRes) {
        const r0 = await this.score(this.m);
        if (r0.err) throw new Error(r0.err);
        this.evals++;
        this.curRes = r0.r;
        this.startFit = r0.r.fit;
      }

      for (let g = 0; g < gens && this.running; g++) {
        if (this.mode === 'denovo' && this.gen === 0) {
          // Generation 1 of de-novo mode: 12-member Stratified Latin-Hypercube primordial random population screen
          const Xc = this.latinHypercube(LHS_POP);
          const res = await Promise.all(Xc.map((u) => this.score(u)));
          const bad = res.find((r) => r.err);
          if (bad) throw new Error(bad.err);
          this.evals += res.length;

          const idx = res.map((_, k) => k).sort((a, b) => res[b].r.fit - res[a].r.fit);
          const mRecomb = new Array(n).fill(0);
          for (let r = 0; r < this.mu; r++) {
            const uk = Xc[idx[r]];
            for (let i = 0; i < n; i++) mRecomb[i] += this.w[r] * uk[i];
          }
          const rRec = await this.score(mRecomb);
          if (rRec.err) throw new Error(rRec.err);
          this.evals++;

          const bestRandomRes = res[idx[0]].r;
          if (rRec.r.fit >= bestRandomRes.fit && rRec.r.fit >= this.curRes.fit) {
            this.m = mRecomb;
            this.curRes = rRec.r;
          } else if (bestRandomRes.fit > this.curRes.fit) {
            this.m = Xc[idx[0]];
            this.curRes = bestRandomRes;
          }
          // Estimate initial coordinate spread across top mu random survivors
          for (let i = 0; i < n; i++) {
            let v2 = 0;
            for (let r = 0; r < this.mu; r++) v2 += this.w[r] * (Xc[idx[r]][i] - this.m[i]) ** 2;
            this.D2[i] = Math.min(2.2, Math.max(0.45, v2 / (this.sigma * this.sigma)));
          }
          this.gen++;
          const mr = this.curRes;
          this.hist.push({
            gen: this.gen,
            mode: this.mode,
            seeds: this.refSeeds.join(','),
            mean: mr.fit,
            delta: mr.fit - this.startFit,
            best: Math.max(mr.fit, bestRandomRes.fit),
            turn: (mr.yL + mr.yR) / 2,
            v: mr.v,
            up: mr.up,
            goal: mr.goal ?? 0,
          });
          this.onUpdate?.(this);
          continue;
        }

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
        if (rCand.r.fit >= fm - 1e-6 && rCand.r.fit >= bestChildRes.fit - 0.05) {
          this.m = mCand;
          this.curRes = rCand.r;
          accepted = true;
        } else if (bestChildRes.fit > fm) {
          const yBest = Xc[idx[0]].map((u, i) => (u - this.m[i]) / Math.max(1e-6, this.sigma));
          for (let i = 0; i < n; i++) yw[i] = yBest[i];
          this.m = Xc[idx[0]];
          this.curRes = bestChildRes;
          accepted = true;
        } else if (rCand.r.fit >= fm - 1e-6) {
          this.m = mCand;
          this.curRes = rCand.r;
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
            this.D2[i] = Math.min(3.0, Math.max(0.25, (1 - this.c1 - this.cmu) * this.D2[i] + this.c1 * this.pc[i] ** 2 + this.cmu * rmu));
          }
          this.sigma = Math.min(maxSigma, Math.max(minSigma, this.sigma * Math.exp((this.cs / this.ds) * (psn / this.chiN - 1))));
        } else {
          this.sigma = Math.max(minSigma, this.sigma * 0.82);
        }

        this.gen++;
        const mr = this.curRes;
        this.hist.push({
          gen: this.gen,
          mode: this.mode,
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
