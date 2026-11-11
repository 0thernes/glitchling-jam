// In-page 92-gene Evo-Devo body + brain co-evolution (upgraded in pass 17): supports BOTH
//  A) Local variance-reduced Active Mirrored Separable CMA-ES refinement ('refine', default 6 gens from current/starter genome), AND
//  B) True 92-Gene Evo-Devo De-Novo Co-Evolution From Pure Uniform Random [0.05, 0.95]^92 Weights ('denovo', default 12 gens:
//     14-member Stratified Latin-Hypercube primordial screen + Archive-Backed Diagonal-Quadratic Surrogate Pre-Screened
//     Active Mirrored Separable CMA-ES with CSA & CRN elitist verification),
// simultaneously co-evolving:
//   - 58 innate CPG / motor / posture / gaze / synergy weights
//   - 20 sense -> MOT closed-loop steering & boulder-avoidance weights
//   - 14 3D Evo-Devo body morphology, collagen fiber stiffness, dorsal crest/fluke, thermal & neural-allocation genes!
import { FULL_GENES } from './sim/genome.js';

const LAMBDA = 8, SECS = 5, LHS_POP = 14, SURR_PAIRS = 12;

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
      // Pure uniform random [0.05, 0.95]^92 initialization — zero starter or hand-wired priors!
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
    this.archive = []; // Evaluated { u, fit } history for local diagonal-quadratic surrogate pre-screening
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

  /** Stratified Latin-Hypercube sample of K uniform random points in [0.05, 0.95]^92 */
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

  /**
   * Fit a proximity-weighted ridge-regularized diagonal quadratic Taylor surrogate around `this.m`:
   *   f_hat(u) = f_m + sum_i [ g_i * (u_i - m_i) + 0.5 * q_i * (u_i - m_i)^2 ]
   * Exact O(M * n) closed-form 2x2 coordinate normal equations per gene over the K nearest archived evaluations.
   */
  fitQuadraticSurrogate() {
    const A = this.archive;
    if (A.length < 16) return null;
    const n = this.n, m = this.m, f0 = this.curRes ? this.curRes.fit : A[A.length - 1].fit;
    const recent = A.slice(-56);
    const wts = new Float64Array(recent.length);
    const df = new Float64Array(recent.length);
    const sigScale = Math.max(0.04, this.sigma * Math.sqrt(n) * 0.65);

    for (let k = 0; k < recent.length; k++) {
      const uk = recent[k].u;
      let d2 = 0;
      for (let i = 0; i < n; i++) { const d = uk[i] - m[i]; d2 += d * d; }
      wts[k] = Math.exp(-d2 / (2 * sigScale * sigScale));
      df[k] = recent[k].fit - f0;
    }

    const g = new Float64Array(n);
    const q = new Float64Array(n);
    const ridge1 = 0.08, ridge2 = 0.22;
    for (let i = 0; i < n; i++) {
      let s11 = ridge1, s12 = 0, s22 = ridge2, b1 = 0, b2 = 0;
      const mi = m[i];
      for (let k = 0; k < recent.length; k++) {
        const w = wts[k];
        if (w < 1e-4) continue;
        const dx = recent[k].u[i] - mi;
        const dx2 = 0.5 * dx * dx;
        s11 += w * dx * dx;
        s12 += w * dx * dx2;
        s22 += w * dx2 * dx2;
        b1 += w * dx * df[k];
        b2 += w * dx2 * df[k];
      }
      const det = s11 * s22 - s12 * s12;
      if (det > 1e-9) {
        g[i] = (s22 * b1 - s12 * b2) / det;
        q[i] = (-s12 * b1 + s11 * b2) / det;
      }
    }
    return {
      predict: (u) => {
        let s = f0;
        for (let i = 0; i < n; i++) {
          const dx = Math.min(1, Math.max(0, u[i])) - m[i];
          s += g[i] * dx + 0.5 * q[i] * dx * dx;
        }
        return s;
      },
    };
  }

  pool() {
    if (this.evalFn || this.workers.length) return;
    const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const k = Math.max(2, Math.min(10, hw - 1));
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
    const uClamped = u.map((v) => Math.min(1, Math.max(0, v)));
    const genome = this.dec(uClamped);
    const opts = { rough: true, steer: true };
    const record = (out) => {
      if (out && out.r && Number.isFinite(out.r.fit)) {
        this.archive.push({ u: uClamped, fit: out.r.fit });
        if (this.archive.length > 160) this.archive.shift();
      }
      return out;
    };
    if (this.evalFn) {
      return Promise.resolve(record({ r: this.evalFn(genome, seeds, this.secs, opts) }));
    }
    return new Promise((res) => {
      const id = this.nextId++;
      this.queue.push({
        id,
        res: (d) => res(record(d)),
        msg: { id, genome, seeds, secs: this.secs, opts },
      });
      this.pump();
    });
  }

  morphSummary() {
    const g = this.dec(this.m);
    return {
      bodyLen: g.bodyLen,
      foreLimb: g.foreLimb,
      hindLimb: g.hindLimb,
      crestFin: g.crestFin,
      tailFluke: g.tailFluke,
      neuroHipAlloc: g.neuroHipAlloc,
    };
  }

  async run(gens = this.mode === 'denovo' ? 12 : 6) {
    if (this.running) return;
    this.running = true;
    this.pool();
    const n = this.n;
    const minSigma = this.mode === 'denovo' ? 0.028 : 0.012;
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
          // Generation 1 of de-novo mode: 14-member Stratified Latin-Hypercube primordial random screen across 92 genes
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
            morph: this.morphSummary(),
          });
          this.onUpdate?.(this);
          continue;
        }

        // Quadratic-Surrogate Pre-Screened Mirrored Antithetic Sampling (+y, -y) across all 92 genes
        const surr = this.fitQuadraticSurrogate();
        const nPairsPool = surr ? SURR_PAIRS : LAMBDA / 2;
        const candPairs = [];
        for (let k = 0; k < nPairsPool; k++) {
          const y = Array.from({ length: n }, (_, i) => Math.sqrt(this.D2[i]) * this.gauss());
          const ym = y.map((v) => -v);
          const xp = this.m.map((mi, i) => mi + this.sigma * y[i]);
          const xm = this.m.map((mi, i) => mi + this.sigma * ym[i]);
          const sEst = surr ? Math.max(surr.predict(xp), surr.predict(xm)) : 0;
          candPairs.push({ y, ym, xp, xm, sEst });
        }

        let chosenPairs;
        if (surr) {
          // Keep top (LAMBDA/2 - 1) surrogate-ranked antithetic pairs + 1 pure unscreened exploratory pair
          const explorePair = candPairs.pop();
          candPairs.sort((a, b) => b.sEst - a.sEst);
          chosenPairs = [...candPairs.slice(0, LAMBDA / 2 - 1), explorePair];
        } else {
          chosenPairs = candPairs;
        }

        const Y = [], X = [];
        for (const p of chosenPairs) {
          Y.push(p.y, p.ym);
          X.push(p.xp, p.xm);
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
            // Active negative-weight covariance shrinkage along worst mirror directions
            let rNeg = 0;
            for (let r = 0; r < 2; r++) rNeg += 0.25 * this.w[r] * Y[idx[LAMBDA - 1 - r]][i] ** 2;
            const dNew = (1 - this.c1 - this.cmu) * this.D2[i] + this.c1 * this.pc[i] ** 2 + this.cmu * Math.max(0.15 * this.D2[i], rmu - rNeg);
            this.D2[i] = Math.min(3.2, Math.max(0.22, dNew));
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
          morph: this.morphSummary(),
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
