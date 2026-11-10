// v4.0 plan Parts VII–X, first causal implementations (Asmodensius-original designs; concepts cited in ORIGINS.md).
// Each module is causally wired into organism.ts, visible in the lab (state()), and lesionable via o.v40Lesion (comma list:
// bus, alien, substrate, self, sim, curv, neo). Promptless, tokenless; no designer reward or penalty anywhere.
import { SubstrateTap, type SubstrateMode } from "./substrate";
const cl = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x)); const fin = (x: number) => (Number.isFinite(x) ? x : 0);
type R = () => number;

/** Part VII §26–30: multisensory bus. Channels: classic (16 sense lines), intero (body), alien (magnetic-like heading field, electric-like
 *  danger field, quantum-click sense from the Q3 measurement), substrate (SubstrateTap in synthetic or replay mode; never live here).
 *  Sparse random expansion -> online linear predictive encoder (surprise = prediction error) -> learned fusion gains per channel
 *  (gain grows with how well the channel predicts reward, the brain decides usefulness) -> 16-line fused drive added to the sense lines. */
export const BUS_CH = ["classic", "intero", "alien", "substrate"] as const;
export class SensoryBus { readonly D = 32; W: Float32Array; P: Float32Array; prev: Float32Array; gain = [1, 0.5, 0.25, 0.25]; use = [0, 0, 0, 0]; surprise = 0; sMean = 1e-4; surpriseN = 1; rBar = 0; chSurprise = [0, 0, 0, 0]; out = new Float32Array(16); tap: SubstrateTap | null; lastIn: number[] = []; private chIdx: number[] = []; private R: Float32Array; ctl = new Set<string>(); outK = 0.3; private cr = 0x9e3779b9; private crand(): number { this.cr = (Math.imul(this.cr ^ (this.cr >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; return this.cr / 4294967296; }
  constructor(r: R, readonly off: Set<string>, mode: SubstrateMode | "off" = "synthetic", seed = 0, replay: any[] = []) { const nIn = 16 + 4 + 3 + 6; this.W = new Float32Array(this.D * nIn); for (let k = 0; k < this.W.length; k++) this.W[k] = r() < 0.15 ? (r() < 0.5 ? -1 : 1) : 0;
    this.P = new Float32Array(this.D * this.D); this.prev = new Float32Array(this.D); this.R = new Float32Array(16 * this.D); for (let k = 0; k < this.R.length; k++) this.R[k] = (r() - 0.5) * 0.3;
    this.tap = mode === "off" ? null : new SubstrateTap(mode === "live" ? "synthetic" : mode, seed, replay); // live is never used inside the creature (sandbox): downgrade to synthetic
    for (let i = 0; i < 16; i++) this.chIdx.push(0); for (let i = 0; i < 4; i++) this.chIdx.push(1); for (let i = 0; i < 3; i++) this.chIdx.push(2); for (let i = 0; i < 6; i++) this.chIdx.push(3); }
  step(t: number, classic: Float32Array, intero: number[], alien: number[], reward: number): Float32Array {
    const sub = this.tap && !this.off.has("substrate") ? this.tap.read(t).map((v) => cl(fin(v), -1, 2)) : [0, 0, 0, 0, 0, 0];
    if (this.ctl.has("glitchInj") && this.crand() < 0.02) sub[3] = 1; /* control: extra injected substrate glitches */ if (this.ctl.has("glitchNoise") && this.crand() < 0.02) for (let i = 0; i < 16; i++) classic[i] += this.crand() - 0.5; /* matched-rate noise bursts in the world senses instead */
    let x = [...Array.from(classic), ...intero, ...(this.off.has("alien") ? [0, 0, 0] : alien), ...sub]; this.lastIn = x; if (this.ctl.has("busShuffle")) { x = x.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(this.crand() * (i + 1)); const tmp = x[i]; x[i] = x[j]; x[j] = tmp; } } /* control: channel identity destroyed each tick */ const D = this.D, n = x.length; const f = new Float32Array(D); const fc = [new Float32Array(D), new Float32Array(D), new Float32Array(D), new Float32Array(D)];
    for (let d = 0; d < D; d++) for (let i = 0; i < n; i++) { const w = this.W[d * n + i]; if (w) { const c = this.chIdx[i]; const v = w * x[i] * this.gain[c]; f[d] += v; fc[c][d] += w * x[i]; } } for (let d = 0; d < D; d++) f[d] = Math.tanh(f[d]);
    let se = 0; const err = new Float32Array(D); for (let d = 0; d < D; d++) { let p = 0; for (let e = 0; e < D; e++) p += this.P[d * D + e] * this.prev[e]; err[d] = f[d] - p; se += err[d] * err[d]; }
    for (let d = 0; d < D; d++) for (let e = 0; e < D; e++) this.P[d * D + e] += 0.01 * err[d] * this.prev[e]; this.surprise += 0.05 * (se / D - this.surprise); this.sMean += 0.001 * (this.surprise - this.sMean); this.surpriseN = cl(this.surprise / (this.sMean + 1e-9), 0, 5); this.rBar += 0.002 * (reward - this.rBar);
    for (let c = 0; c < 4; c++) { let s = 0; for (let d = 0; d < D; d++) s += fc[c][d] * err[d]; this.chSurprise[c] += 0.05 * (Math.abs(s) / D - this.chSurprise[c]); let a = 0; for (let d = 0; d < D; d++) a += Math.abs(fc[c][d]); this.use[c] += 0.002 * ((reward - this.rBar) * Math.tanh(a / D) * 10 - this.use[c]); /* covariance of channel drive with reward vs its running mean */ this.gain[c] = cl(this.gain[c] + 0.01 * this.use[c], 0.05, 2); } // learned fusion
    this.prev = f; for (let i = 0; i < 16; i++) { let s = 0; for (let d = 0; d < D; d++) s += this.R[i * D + d] * f[d]; this.out[i] = this.off.has("bus") ? 0 : this.outK * Math.tanh(s); } return this.out; }
  state() { return { gain: [...this.gain], use: [...this.use], surprise: this.surprise, surpriseN: this.surpriseN, chSurprise: [...this.chSurprise], substrateMode: this.tap?.mode ?? "off" }; } }

/** Part VIII: SELF (32-unit slow recurrent state) predicts the next body state and next bus surprise; SIM is a two-cause latent model
 *  (world vs artefact): surprise that is unexplained by SELF's body prediction and co-occurs with substrate glitches raises P(artefact).
 *  Causal: SELF's predicted energy drop makes the creature risk/uncertainty averse; SIM down-weights value learning from artefacts. */
export class SelfModel { readonly N = 32; z: Float32Array; Win: Float32Array; Wout: Float32Array; pred = [0, 0, 0, 0, 0]; atpEMA = 0.5; err = 0; errBody = 0; sim = 0.1; mean: Float32Array; ctl = new Set<string>(); simK = 0.6; private lastX: number[] = [];
  constructor(r: R, readonly off: Set<string>) { this.z = new Float32Array(this.N); this.mean = new Float32Array(this.N); this.Win = new Float32Array(this.N * 12).map(() => (r() - 0.5) * 0.6); this.Wout = new Float32Array(5 * this.N); }
  step(x: number[], glitch: number): void { // x: [glc, atp, integrity, fatN, DA, 5HT, NE, ACh, mood, fear, surprise, kappa]
    const tgt = [x[0], x[1], x[2], x[3], x[10]]; let e = 0, eb = 0; for (let o = 0; o < 5; o++) { const d = tgt[o] - this.pred[o]; e += d * d; if (o < 4) eb += d * d; if (!this.off.has("self")) for (let i = 0; i < this.N; i++) this.Wout[o * this.N + i] += 0.01 * d * this.z[i]; }
    this.err += 0.05 * (e - this.err); this.atpEMA += 0.01 * (x[1] - this.atpEMA); this.errBody += 0.05 * (eb - this.errBody);
    for (let i = 0; i < this.N; i++) { let s = 0; for (let j = 0; j < (this.ctl.has("selfBody") ? 4 : 12); j++) s += this.Win[i * 12 + j] * fin(x[j]); /* control selfBody: SELF sees body state only */ this.z[i] = 0.95 * this.z[i] + 0.05 * Math.tanh(s); this.mean[i] += 0.001 * (this.z[i] - this.mean[i]); }
    const z = this.off.has("self") ? this.mean : this.z; for (let o = 0; o < 5; o++) { let s = 0; for (let i = 0; i < this.N; i++) s += this.Wout[o * this.N + i] * z[i]; this.pred[o] = s; }
    if (!this.off.has("sim")) { const unexpl = Math.max(0, 0.25 * x[10] - this.errBody); const lik = cl(2 * glitch + 4 * unexpl); this.sim = cl(0.98 * this.sim + 0.02 * lik); } else this.sim = 0.1; this.lastX = x; }
  /** predicted energy drop (next atp below now) -> caution */ caution(): number { return this.off.has("self") ? 0.25 : cl(0.25 + 5 * (this.atpEMA - this.pred[1]), 0, 1); } // 0.25 = neutral; >0.25 when SELF foresees an energy drop
  learnScale(): number { return 1 - this.simK * this.sim; }
  state() { return { err: this.err, errBody: this.errBody, sim: this.sim, pred: [...this.pred], caution: this.caution(), z: Array.from(this.z.slice(0, 8)) }; } }

/** Part IX: thought curvature. Cortical rates are projected onto a fixed 6-d manifold chart (seeded projection, slowly re-centred);
 *  discrete Frenet-like curvature kappa = turning angle per unit arc length. Felt: kappa drives an insula/LC input and SELF;
 *  metacognitive link: confidence = 1 - normalised kappa scales decision noise (twisted thought -> less committed choices). */
export class Curvature { readonly K = 6; Pm: Float32Array; buf: number[][] = []; kappa = 0; kMean = 0.5; kSD = 0.3; conf = 0.5; private mu: Float32Array;
  constructor(r: R, readonly nIn: number, readonly off: Set<string>) { this.Pm = new Float32Array(this.K * nIn).map(() => (r() - 0.5) * 2 / Math.sqrt(nIn)); this.mu = new Float32Array(nIn); }
  step(rates: ArrayLike<number>): void { const y = new Array(this.K).fill(0); for (let i = 0; i < this.nIn; i++) { const v = rates[i] - this.mu[i]; this.mu[i] += 0.001 * v; if (v) for (let k = 0; k < this.K; k++) y[k] += this.Pm[k * this.nIn + i] * v; }
    this.buf.push(y); if (this.buf.length > 3) this.buf.shift(); if (this.buf.length < 3) return; const [a, b, c] = this.buf; const d1 = b.map((v, i) => v - a[i]), d2 = c.map((v, i) => v - b[i]);
    const n1 = Math.hypot(...d1), n2 = Math.hypot(...d2); if (n1 < 1e-6 || n2 < 1e-6) return; const cos = cl(d1.reduce((s, v, i) => s + v * d2[i], 0) / (n1 * n2), -1, 1); const k = Math.acos(cos) / (0.5 * (n1 + n2) + 1e-3);
    this.kappa = 0.9 * this.kappa + 0.1 * Math.min(50, k); this.kMean += 0.002 * (this.kappa - this.kMean); this.kSD += 0.002 * (Math.abs(this.kappa - this.kMean) - this.kSD);
    this.conf = this.off.has("curv") ? 0.5 : cl(0.5 - 0.25 * (this.kappa - this.kMean) / (this.kSD + 1e-3)); }
  felt(): number { return this.off.has("curv") ? 0 : cl((this.kappa - this.kMean) / (this.kSD + 1e-3), -2, 2); }
  noiseMul(): number { return 0.7 + 0.6 * (1 - this.conf); }
  state() { return { kappa: this.kappa, kMean: this.kMean, conf: this.conf, felt: this.felt() }; } }

/** Part X: Neo rule hooks. The creature may emit requests through a fixed, legal hook set; a dome-side sandbox validates them and may only
 *  touch dome state (never host, files, network, energy ledger). Hooks are chosen by learned hook values (natural outcome: did the creature's
 *  sleep debt / food situation improve after use), driven by the anomaly signal SIM and the hidden-cause model. */
export const HOOKS = ["shade", "mark"] as const; export type HookReq = { t: number; hook: typeof HOOKS[number]; arg: number };
export class NeoHooks { val = [0, 0]; uses = [0, 0]; granted = [0, 0]; pending: HookReq[] = []; private lastUse: { k: number; t: number; base: number } | null = null; shadeUntil = 0; ctl = new Set<string>();
  constructor(readonly off: Set<string>) {}
  step(t: number, sim: number, sleepDebt: number, hunger: number, bestSite: number, r: R): void { if (this.off.has("neo")) return;
    if (this.lastUse && t - this.lastUse.t === 120) { const k = this.lastUse.k; const now = k === 0 ? -sleepDebt : -hunger; this.val[k] += 0.2 * ((now - this.lastUse.base) - this.val[k]); this.lastUse = null; } // learned from natural outcome
    if (this.lastUse || t % 30 !== 0) return; const drive = [sleepDebt * (0.3 + sim), hunger * (0.2 + sim)]; for (let k = 0; k < 2; k++) { const p = this.ctl.has("neoRandom") ? 0.06 : cl(0.02 + 0.3 * drive[k] + 2 * this.val[k], 0, 0.5); /* control neoRandom: hook use at a fixed rate, blind to drive and learned value */
      if (r() < p) { this.uses[k]++; this.pending.push({ t, hook: HOOKS[k], arg: k === 1 ? bestSite : 60 }); this.lastUse = { k, t, base: k === 0 ? -sleepDebt : -hunger }; break; } } }
  /** sandbox reply */ grant(req: HookReq, ok: boolean): void { if (ok) { this.granted[HOOKS.indexOf(req.hook)]++; if (req.hook === "shade") this.shadeUntil = req.t + req.arg; } }
  state() { return { val: [...this.val], uses: [...this.uses], granted: [...this.granted], pending: this.pending.length }; } }
