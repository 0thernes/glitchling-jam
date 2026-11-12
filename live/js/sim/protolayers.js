// Pass 15: layers of online prototypes learned by e-means (js/sim/emeans.js), all running at 10 Hz in streaming mode.
//  L1 percepts  : body senses (25 proprio/vestibular/contact/bearing values) + 10 exteroceptive features -> 24 prototypes.
//                 Soft assignment drives groups of thalamic neurons; distance to the nearest prototype (novelty) adds
//                 to the locus-coeruleus surprise signal.
//  L2 concepts  : the L1 soft assignment averaged over the last 1 s and the 3 s before it (a short sequence) + body state
//                 (hunger, thirst, blood glucose, sleep pressure, cortisol) -> 16 prototypes. Soft assignment drives
//                 groups of hippocampal neurons; each concept learns how often going for food / water paid off when it
//                 was active, which biases the hunger-vs-thirst choice.
//  L3 places    : the grid-cell phase code of the path-integration estimate (3 modules x 3 axes, cos/sin = 18 values)
//                 -> 32 place prototypes, each with a running mean position and learned water / food scores; thirst
//                 uses the best water place when no pool is sensed and the HDC water map recalls nothing.
//  (L4, Hopfield consolidation, lives in memory.js; it calls EMeans in batch mode.)
// Cost per 10-Hz tick (assignment + soft assignment, k*d multiply-adds): L1 24x35, L2 16x53, L3 32x18 = ~2.3k MACs,
// plus one EMA update on B rows drawn from a shuffle buffer per B new samples (~1 more assignment per sample amortised),
// so ~4.6k MACs per 10-Hz tick in total. Measured cost in test/emeans_cost.mjs (see CHANGELOG pass 15).
import { EMeans } from './emeans.js';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const K1 = 24, K2 = 16, K3 = 32, D1 = 35, D2 = 2 * K1 + 5, D3 = 18;
export class ProtoLayers {
  constructor(seed, opts = {}) { const H = opts.horizon ?? 3000; const mk = (k, d, n, s) => { const B = new EMeans({ k, d, n }).B; return new EMeans({ k, d, n, seed: seed * 31 + s, streaming: true, slow: 1, replay: 8 * B, every: B }); };
    /* all three layers use a shuffle buffer (8B rows) with one update per B new samples: measured in test/emeans_streams.mjs (4 seeds,
       600 s each), MSE of the final prototypes over the whole stream, plain streaming -> replay: percepts 0.848 -> 0.839,
       concepts 0.154 -> 0.143, places 2.85 -> 1.64 (MacQueen online k-means: 0.923 / 0.407 / 4.55). */
    this.L1 = mk(K1, D1, H, 1); this.L2 = mk(K2, D2, H, 2); this.L3 = mk(K3, D3, 2 * H, 3);
    this.x1 = new Float64Array(D1); this.x2 = new Float64Array(D2); this.x3 = new Float64Array(D3); this.s1 = new Float64Array(K1); this.s2 = new Float64Array(K2); this.s3 = new Float64Array(K3);
    this.ctxA = new Float64Array(K1); this.ctxB = new Float64Array(K1); this.loss1 = 1; this.loss2 = 1; this.loss3 = 1; this.novelty = 0; this.novMean = 0; this.id1 = -1; this.id2 = -1; this.id3 = -1;
    this.qEat = new Float64Array(K2).fill(0.5); this.qDrink = new Float64Array(K2).fill(0.5); this.water = new Float64Array(K3); this.food = new Float64Array(K3); this.visits = new Float64Array(K3); this.px = new Float64Array(K3); this.pz = new Float64Array(K3); this.pn = new Float64Array(K3);
    this.stable = [null, null, null]; this.ticks = 0; this.switches1 = 0; }
  /** one 10-Hz tick. c = creature */
  step(c) { this.ticks++; const y = c.y, P = c.phi, M = c.metab, N = c.nav;
    const x1 = this.x1; for (let i = 0; i < 25; i++) x1[i] = y[i]; for (let i = 0; i < 10; i++) x1[25 + i] = P[i];
    this.L1.push(x1); if (this.L1.ready) { const prev = this.id1; this.id1 = this.L1.assign(x1); if (prev !== this.id1) this.switches1++; const d2 = this.L1.lastD2; this.loss1 += 0.02 * (d2 - this.loss1); this.novelty = clamp(d2 / Math.max(1e-6, 2 * this.loss1) - 0.5); this.novMean += 0.01 * (this.novelty - this.novMean); this.L1.soft(x1, this.s1, Math.max(0.05, this.loss1)); } else this.s1.fill(0);
    for (let j = 0; j < K1; j++) { this.ctxA[j] += 0.1 * (this.s1[j] - this.ctxA[j]); this.ctxB[j] += 0.033 * (this.ctxA[j] - this.ctxB[j]); }
    const x2 = this.x2; x2.set(this.ctxA, 0); x2.set(this.ctxB, K1); x2[2 * K1] = M.hunger(); x2[2 * K1 + 1] = M.thirst; x2[2 * K1 + 2] = clamp(M.blood.glc / 6); x2[2 * K1 + 3] = clamp(c.sleep.S); x2[2 * K1 + 4] = clamp(M.cortisol);
    this.L2.push(x2); if (this.L2.ready) { this.id2 = this.L2.assign(x2); this.loss2 += 0.02 * (this.L2.lastD2 - this.loss2); this.L2.soft(x2, this.s2, Math.max(0.02, this.loss2)); } else this.s2.fill(0);
    const x3 = this.x3; let q = 0; for (const g of N.grid) for (let a = 0; a < 3; a++) { x3[q++] = Math.cos(g.ph[a]); x3[q++] = Math.sin(g.ph[a]); }
    this.L3.push(x3); if (this.L3.ready) { const j = this.id3 = this.L3.assign(x3); this.loss3 += 0.02 * (this.L3.lastD2 - this.loss3); this.visits[j] += 1; const w = 1 / Math.min(200, ++this.pn[j]); this.px[j] += w * (N.px - this.px[j]); this.pz[j] += w * (N.pz - this.pz[j]);
      for (let k = 0; k < K3; k++) { this.water[k] *= 0.9998; this.food[k] *= 0.9998; } }
    for (const [i, L] of [[0, this.L1], [1, this.L2], [2, this.L3]]) if (this.stable[i] === null && L.t > 5 && L.moved < 0.02) this.stable[i] = this.ticks; }
  /** current place's water / food score update (called on drinking / feeding) */
  rewardPlace(kind, r = 1) { if (this.id3 < 0) return; const a = kind === 'water' ? this.water : this.food; a[this.id3] += 0.3 * (r - a[this.id3]); }
  /** a decision (food / water trip) was taken in the current concept; remember it to credit the outcome */
  decide(kind) { this.pending = this.id2 >= 0 ? { kind, c: this.id2 } : null; }
  outcome(kind, ok) { const p = this.pending; if (!p || p.kind !== kind) return; const q = kind === 'water' ? this.qDrink : this.qEat; q[p.c] += 0.25 * ((ok ? 1 : 0) - q[p.c]); this.pending = null; }
  /** best remembered water place (score, x, z) */
  bestWater() { let b = -1, s = 0; for (let j = 0; j < K3; j++) if (this.pn[j] > 3 && this.water[j] > s) { s = this.water[j]; b = j; } return b < 0 ? null : { s, x: this.px[b], z: this.pz[b], j: b }; }
}
