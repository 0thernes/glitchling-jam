/* Glitchling browser port (SIMPLIFIED). Not the TypeScript reference (glitchling.ts + core/organism.ts).
   What is kept from the reference: 16 sites = 4 colours x 4 shapes with p(reward) = 0.05 + 0.25*cv[c]/3 + 0.25*sv[s]/3,
   the Latin half-access pattern on days 1-3, 1 tick = 1 sim-minute (1440/day), the 14 brain regions and their sizes (272 neurons),
   the region->region connection probabilities (CP), mulberry32 seeding, a separate flaw RNG stream (seed*9973+7),
   and the four flaws exactly as glitchling.ts applies them to the learned site values (wSite), access, MOT rates and synapses.
   What is simplified or invented: the neuron model (rate units, not the spiking substrate), the metabolism (3-pool toy, not the
   full gut/blood/liver/fat/hormone model), the decision (noisy softmax-like race over values, not the striatal spike race + EFE),
   the body walking on a 2D field, and click-to-drop food ("snacks"). No claims of sentience or consciousness are made or implied. */
(function (root) {
  "use strict";
  function mulberry(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const SITES = 16, DAY = 1440;
  const REGIONS = [["SENS", 16], ["THAL", 16], ["CTX", 64], ["HIP", 32], ["STR", 32], ["HYP", 16], ["VTA", 6], ["RAPHE", 6], ["LC", 6], ["BF", 6], ["INS", 8], ["SCN", 8], ["MOT", 8], ["ENS", 48]];
  const R0 = {}, RN = {}; let NNEU = 0; for (const [n, k] of REGIONS) { R0[n] = NNEU; RN[n] = k; NNEU += k; }
  const CP = [["SENS", "THAL", 0.25], ["THAL", "CTX", 0.12], ["CTX", "THAL", 0.06], ["CTX", "CTX", 0.1], ["CTX", "HIP", 0.06], ["HIP", "CTX", 0.06], ["HIP", "HIP", 0.05],
    ["CTX", "STR", 0.08], ["STR", "MOT", 0.15], ["CTX", "MOT", 0.05], ["HYP", "VTA", 0.2], ["HYP", "LC", 0.15], ["HYP", "HYP", 0.1], ["INS", "LC", 0.25], ["INS", "CTX", 0.06], ["INS", "HYP", 0.15],
    ["VTA", "STR", 0.1], ["LC", "CTX", 0.08], ["RAPHE", "CTX", 0.05], ["BF", "CTX", 0.06], ["BF", "HIP", 0.1], ["SCN", "HYP", 0.25], ["SCN", "RAPHE", 0.15], ["CTX", "INS", 0.06], ["ENS", "ENS", 0.12], ["ENS", "HYP", 0.05]];
  const INHIB = (i) => (i >= R0.CTX + 52 && i < R0.CTX + 64) || (i >= R0.STR && i < R0.STR + 32) || (i >= R0.ENS + 36 && i < R0.ENS + 48);
  const DEFAULT_FLAWS = { scramble: { on: false, period: 90, noise: 0.25 }, leaky: { on: false, rate: 0.06 }, backwards: { on: false }, misfire: { on: false, period: 60, sd: 0.3, jolts: 20 } };
  // site positions on a 4x4 grid in unit space; column = colour c (k&3), row = shape s (k>>2); mirror k -> 15-k is a point reflection through the centre
  const SITE_POS = Array.from({ length: SITES }, (_, k) => ({ x: 0.14 + 0.24 * (k & 3), y: 0.16 + 0.23 * (k >> 2) }));

  class Glitchling {
    constructor(seed, flaws) {
      this.seed = seed >>> 0; this.flaws = JSON.parse(JSON.stringify(flaws || DEFAULT_FLAWS));
      const r = (this.r = mulberry(this.seed)); this.gr = mulberry(this.seed * 9973 + 7); this.rw = mulberry(this.seed * 5167 + 23);
      this.t = 0; this.dead = false;
      // world
      const cv = [0, 1, 2, 3].sort(() => r() - 0.5), sv = [0, 1, 2, 3].sort(() => r() - 0.5);
      this.pBase = new Float32Array(SITES); this.pTrue = new Float32Array(SITES); this.depl = new Float32Array(SITES); this.access = new Uint8Array(SITES); this.snack = new Float32Array(SITES);
      for (let k = 0; k < SITES; k++) this.pBase[k] = this.pTrue[k] = 0.05 + (0.25 * cv[k & 3]) / 3 + (0.25 * sv[k >> 2]) / 3;
      this.best = [...this.pBase].indexOf(Math.max(...this.pBase));
      // learned values (same names as the reference so the flaw code reads the same)
      this.wSite = new Float32Array(SITES).fill(0.25); this.featC = new Float32Array(4).fill(0.15); this.featS = new Float32Array(4).fill(0.15);
      this.visits = new Float32Array(SITES); this.lastVisit = new Float32Array(SITES);
      this.perm = [...Array(SITES).keys()]; this.sensed = new Float32Array(SITES); this.sensedAccess = new Uint8Array(SITES);
      // body + metabolism (toy)
      this.pos = { x: 0.5, y: 0.93 }; this.prev = { x: 0.5, y: 0.93 }; this.home = { x: 0.5, y: 0.93 }; this.trip = null; this.heading = 0;
      this.gut = 3; this.glc = 3; this.fat = 400; this.atp = 2; this.insulin = 0.3;
      // brain: rate units over the reference's 272-neuron region layout and CP wiring
      const pre = [], post = [], w = [];
      for (const [a, b, p] of CP) for (let i = R0[a]; i < R0[a] + RN[a]; i++) for (let j = R0[b]; j < R0[b] + RN[b]; j++) if (i !== j && this.rw() < p) { pre.push(i); post.push(j); w.push((INHIB(i) ? -1.4 : 1) * (0.25 + 0.5 * this.rw()) / Math.sqrt(RN[a] * p + 1)); }
      for (let i = 0; i < 16; i++) { pre.push(R0.SENS + i); post.push(R0.THAL + i); w.push(0.9); } // topographic SENS i -> THAL i
      this.syn = { pre: Int32Array.from(pre), post: Int32Array.from(post), w: Float32Array.from(w), w0: Float32Array.from(w) };
      this.rate = new Float32Array(NNEU); this.ext = new Float32Array(NNEU); this.inp = new Float32Array(NNEU); this.th = new Float32Array(NNEU);
      for (let i = 0; i < NNEU; i++) this.th[i] = 0.6 + 0.2 * r();
      this.regionRate = {}; for (const [n] of REGIONS) this.regionRate[n] = 0;
      this.da = 0.2; this.brainUse = 0; this.lastOutcome = null; this.surprise = 0; this.misfireFlash = 0; this.rewireFlash = 0; this.hitSyn = [];
      // stats
      this.foraged = 0; this.rewards = 0; this.choices = []; this.outcomes = []; this.jolts = 0; this.rewires = 0; this.mirrored = 0; this.snacksEaten = 0;
      this.events = []; this.intended = -1; this.executed = -1;
      this.applyMask(); this.rewire(true);
    }
    get day() { return Math.floor(this.t / DAY) + 1; }
    get minuteOfDay() { return this.t % DAY; }
    get awake() { const m = this.minuteOfDay; return m >= 360 && m < 1320; } // awake 06:00-22:00
    get light() { const m = this.minuteOfDay; return clamp(0.5 - 0.5 * Math.cos((2 * Math.PI * (m - 120)) / DAY) ); }
    get hunger() { return clamp(1.25 - this.glc / 3 + 0.15 * clamp(1 - this.gut / 2)); }
    ev(type, msg, extra) { this.evId = (this.evId || 0) + 1; this.events.push(Object.assign({ id: this.evId, t: this.t, type, msg }, extra || {})); if (this.events.length > 200) this.events.shift(); }
    applyMask() { for (let k = 0; k < SITES; k++) this.access[k] = this.day > 3 || (((k & 3) + (k >> 2)) & 1) === 0 || this.snack[k] > 0 ? 1 : 0; }
    setFlaws(f) { const was = this.flaws.scramble.on; this.flaws = JSON.parse(JSON.stringify(f)); if (this.flaws.scramble.on && !was) this.rewire(); if (!this.flaws.scramble.on) this.perm = [...Array(SITES).keys()]; }
    rewire(silent) { if (!this.flaws.scramble.on) { this.perm = [...Array(SITES).keys()]; return; } const p = [...Array(SITES).keys()]; for (let i = SITES - 1; i > 0; i--) { const j = Math.floor(this.gr() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } this.perm = p; this.rewires++; this.rewireFlash = 1; if (!silent) this.ev("scramble", "senses rewired (new permutation)"); }
    gs() { return Math.sqrt(-2 * Math.log(this.gr() + 1e-12)) * Math.cos(6.283185 * this.gr()); }
    dropFood(x, y) { let bk = 0, bd = 1e9; for (let k = 0; k < SITES; k++) { const d = (SITE_POS[k].x - x) ** 2 + (SITE_POS[k].y - y) ** 2; if (d < bd) { bd = d; bk = k; } } this.snack[bk] = 240; this.applyMask(); this.ev("food", `you dropped food at site ${bk}`, { site: bk }); return bk; }
    value(k) { return this.wSite[k] + 0.5 * (this.featC[k & 3] + this.featS[k >> 2] - 0.3); }
    // senses: what the creature perceives about each site. Scramble reads every channel through the permutation plus noise (as glitchling.ts does).
    sense() { const sc = this.flaws.scramble;
      for (let k = 0; k < SITES; k++) { const src = sc.on ? this.perm[k] : k; this.sensed[k] = this.value(src) + (this.snack[src] > 0 ? 1.2 : 0) + (sc.on ? sc.noise * this.gs() : 0); this.sensedAccess[k] = this.access[src]; } }
    choose() { // noisy race over perceived value + a novelty bonus; the winner is the INTENDED site
      const noise = 0.35 * (0.2 + 2 * clamp(this.da)); let bk = -1, bv = -1e9;
      for (let k = 0; k < SITES; k++) { if (!this.sensedAccess[k]) continue; const nov = 0.12 * (1 - Math.exp(-(this.t - this.lastVisit[k]) / 200)) / Math.sqrt(1 + this.visits[k]); const v = 3 * this.sensed[k] + nov + noise * this.gs01(); if (v > bv) { bv = v; bk = k; } }
      return bk; }
    gs01() { const r = this.r; return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(6.283185 * r()); }
    startTrip() { const ki = this.choose(); if (ki < 0) return; let ke = ki; this.intended = ki;
      if (this.flaws.backwards.on) { ke = SITES - 1 - ki; this.mirrored++; this.ev("backwards", `wanted site ${ki}, legs went to ${ke}`, { intended: ki, executed: ke }); }
      this.executed = ke; const P = SITE_POS[ke]; const d = Math.hypot(P.x - this.pos.x, P.y - this.pos.y); this.trip = { k: ke, ki, from: { x: this.pos.x, y: this.pos.y }, to: P, t0: this.t, dur: Math.max(2, Math.round(d * 14)), phase: "out" };
      this.heading = Math.atan2(P.y - this.pos.y, P.x - this.pos.x); }
    arrive() { const k = this.trip.k; this.foraged++; this.choices.push(k); this.visits[k]++; this.lastVisit[k] = this.t;
      let got = false, snack = false;
      if (this.access[k]) { if (this.snack[k] > 0) { got = true; snack = true; this.snack[k] = 0; this.snacksEaten++; this.applyMask(); } else got = this.r() < this.pTrue[k]; }
      if (got) { this.rewards++; this.gut += snack ? 0.8 : 0.4; this.depl[k] = 1; }
      const rpe = (got ? 1 : 0) - this.wSite[k]; this.da = clamp(0.2 + 0.8 * rpe, 0, 1.2); this.surprise = Math.abs(rpe);
      this.wSite[k] += 0.15 * rpe; this.featC[k & 3] += 0.05 * ((got ? 1 : 0) - this.featC[k & 3]); this.featS[k >> 2] += 0.05 * ((got ? 1 : 0) - this.featS[k >> 2]);
      this.outcomes.push(got ? 1 : 0); if (this.outcomes.length > 5000) { this.outcomes.shift(); this.choices.shift(); }
      this.lastOutcome = { k, got, snack, t: this.t };
      this.trip.phase = "back"; this.trip.from = { x: this.pos.x, y: this.pos.y }; this.trip.to = this.home; this.trip.t0 = this.t; this.trip.dur = Math.max(2, Math.round(Math.hypot(this.home.x - this.pos.x, this.home.y - this.pos.y) * 10)); }
    brain() { // one rate-unit update over the 272-neuron layout
      const ext = this.ext.fill(0), add = (n, v) => { for (let i = R0[n]; i < R0[n] + RN[n]; i++) ext[i] += v; };
      const wake = this.awake ? 1 : 0.15;
      for (let k = 0; k < SITES; k++) ext[R0.SENS + k] += wake * (0.4 + 1.2 * clamp(this.sensed[k] * 1.6));
      add("THAL", 0.15 * wake); add("CTX", 0.1 + 0.15 * wake); add("HYP", 0.9 * this.hunger); add("INS", 0.3 + 0.6 * clamp(1 - this.glc / 3));
      for (let i = 0; i < RN.VTA; i++) ext[R0.VTA + i] += this.da; add("LC", 0.2 + 1.5 * this.surprise + 2 * this.misfireFlash); add("BF", 0.4 * wake); add("RAPHE", 0.3 + 0.2 * (1 - wake));
      for (let i = 0; i < RN.SCN; i++) ext[R0.SCN + i] += 0.5 + 0.5 * Math.sin((2 * Math.PI * this.t) / DAY + i * 0.8);
      for (let i = 0; i < RN.ENS; i++) ext[R0.ENS + i] += clamp(this.gut / 4) * (0.5 + 0.5 * Math.sin(this.t * 0.3 + i * 0.4));
      for (let i = 0; i < RN.HIP; i++) ext[R0.HIP + i] += 0.8 * this.wSite[i % SITES];
      for (let k = 0; k < SITES; k++) { ext[R0.STR + 2 * k] += this.trip && this.trip.ki === k && this.trip.phase === "out" ? 1.2 : 0.1 * this.sensed[k]; }
      if (this.trip) for (let i = 0; i < RN.MOT; i++) { const a = (i * Math.PI) / 4, d = Math.cos(this.heading - a); ext[R0.MOT + i] += 1.4 * clamp(d); } // MOT: 8-way heading code (port-only interpretation)
      const inp = this.inp.fill(0), s = this.syn; for (let q = 0; q < s.pre.length; q++) inp[s.post[q]] += s.w[q] * this.rate[s.pre[q]];
      let tot = 0; const keys = REGIONS; for (const [n] of keys) this.regionRate[n] = 0;
      for (let ri = 0, i = 0; ri < keys.length; ri++) { const [n, c] = keys[ri]; let sum = 0; for (let j = 0; j < c; j++, i++) { const x = ext[i] + inp[i] - this.th[i] + 0.15 * this.gs01(); const target = 1 / (1 + Math.exp(-5 * x)); this.rate[i] += 0.5 * (target - this.rate[i]); sum += this.rate[i]; } this.regionRate[n] = sum / c; tot += sum; }
      this.brainUse = tot / NNEU;
      // Hebbian-ish plasticity on SENS->THAL->CTX->STR is skipped; synapses only drift back toward their initial weight (so leak/misfire are visible and recoverable)
      for (let q = 0; q < s.w.length; q++) s.w[q] += 0.003 * (s.w0[q] - s.w[q]);
    }
    step() {
      if (this.dead) return; this.t++; const F = this.flaws;
      if (this.t % DAY === 0 || this.t === 3 * DAY + 1) this.applyMask();
      if (F.scramble.on && this.t > 0 && this.t % Math.max(1, Math.round(F.scramble.period)) === 0) this.rewire();
      for (let k = 0; k < SITES; k++) { if (this.depl[k] > 0) this.depl[k] = Math.max(0, this.depl[k] - 1 / 120); this.pTrue[k] = this.pBase[k] * (1 - 0.9 * this.depl[k]); if (this.snack[k] > 0) { this.snack[k]--; if (this.snack[k] <= 0) this.applyMask(); } }
      this.sense();
      // metabolism (toy): gut -> blood glucose; brain+body burn glucose; insulin stores surplus as fat; fat is mobilised when glucose is low
      const absorb = Math.min(this.gut, 0.03 * this.gut + 0.004); this.gut -= absorb; this.glc += absorb;
      const burn = 0.0032 + 0.0015 * this.brainUse + (this.trip ? 0.0015 : 0); this.glc -= burn;
      this.insulin += 0.05 * (clamp(this.glc / 3 - 0.8, 0, 2) * 0.5 - this.insulin); const store = Math.max(0, 0.01 * this.insulin * (this.glc - 3)); this.glc -= store; this.fat += 0.8 * store;
      if (this.glc < 2.6 && this.fat > 0) { const m = Math.min(this.fat, 0.004 * (2.6 - this.glc) * 10); this.fat -= m; this.glc += 0.25 * m; }
      if (this.glc <= 0.05 && this.fat <= 0) { this.dead = true; this.ev("dead", "starved"); }
      this.da += 0.08 * (0.2 - this.da); this.surprise *= 0.9; this.misfireFlash *= 0.85; this.rewireFlash *= 0.9;
      // body: start / continue a trip
      this.prev = { x: this.pos.x, y: this.pos.y };
      const snackAny = this.snack.some((v) => v > 0);
      if (!this.trip) { const drive = this.awake ? clamp(3 * this.hunger - 0.1) * 0.3 : 0; const lure = snackAny ? 0.35 : 0; if (this.r() < Math.max(drive, lure)) this.startTrip(); }
      if (this.trip) { const tr = this.trip, u = clamp((this.t - tr.t0) / tr.dur); const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); this.pos.x = tr.from.x + (tr.to.x - tr.from.x) * e; this.pos.y = tr.from.y + (tr.to.y - tr.from.y) * e; this.heading = Math.atan2(tr.to.y - tr.from.y, tr.to.x - tr.from.x);
        if (u >= 1) { if (tr.phase === "out") this.arrive(); else this.trip = null; } }
      this.brain();
      // backwards motors: all 8 MOT rates read out in reversed order (glitchling.ts)
      if (F.backwards.on) { const m = this.rate.slice(R0.MOT, R0.MOT + 8).reverse(); this.rate.set(m, R0.MOT); }
      // leaky memory: learned values decay toward the 0.25 prior every tick, plastic synapses shrink slightly
      if (F.leaky.on) { const L = F.leaky.rate; for (let k = 0; k < SITES; k++) this.wSite[k] += L * (0.25 - this.wSite[k]); for (let c = 0; c < 4; c++) { this.featC[c] += L * 0.2 * (0.15 - this.featC[c]); this.featS[c] += L * 0.2 * (0.15 - this.featS[c]); } const w = this.syn.w; for (let i = 0; i < w.length; i++) w[i] *= 1 - L * 0.05; }
      // misfiring mutations: one site value + N random synapses jolted every P ticks
      if (F.misfire.on && this.t % Math.max(1, Math.round(F.misfire.period)) === 0) { const k = Math.floor(this.gr() * SITES); this.wSite[k] = clamp(this.wSite[k] + F.misfire.sd * this.gs()); const w = this.syn.w; this.hitSyn = []; for (let j = 0; j < F.misfire.jolts; j++) { const i = Math.floor(this.gr() * w.length); w[i] += F.misfire.sd * this.gs() * (Math.abs(w[i]) + 0.1); this.hitSyn.push(i); } this.jolts++; this.misfireFlash = 1; this.ev("misfire", `misfire: site ${k} value jolted + ${F.misfire.jolts} synapses`, { site: k }); }
    }
    successRecent(n = 30) { const o = this.outcomes; if (!o.length) return 0; const s = o.slice(-n); return s.reduce((a, b) => a + b, 0) / s.length; }
    bestSiteFrac(n = 30) { const c = this.choices.slice(-n); return c.length ? c.filter((k) => k === this.best).length / c.length : 0; }
  }
  root.GL = { Glitchling, mulberry, SITES, DAY, REGIONS, R0, RN, NNEU, SITE_POS, DEFAULT_FLAWS, CP };
})(typeof window !== "undefined" ? window : globalThis);
