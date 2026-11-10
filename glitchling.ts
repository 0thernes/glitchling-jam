// Glitchling: a deliberately broken baby clone of Creature #1 (copied core in ./core, unmodified except import paths).
// usage: nice bun run glitchling.ts [days=2] [seeds=2]   -> results/*.json, results/summary.csv, results/activations_allflaws_seed1.json
import { Organism, mulberry, SITES, REGIONS } from "./core/organism";
const MOT0 = (() => { let o = 0; for (const [n, c] of REGIONS as any) { if (n === "MOT") return o; o += c; } return -1; })(); export const N_MOT = (REGIONS as any).find((r: any) => r[0] === "MOT")[1];
import * as fs from "fs";
export type Flaws = { scramble?: boolean; leaky?: boolean; backwards?: boolean; misfire?: boolean; mild?: boolean };
export const FLAW_PARAMS = { senseNoise: 0.25, leakRate: 0.06, mildLeakRate: 0.02, rewireEvery: 90, misfireEvery: 60, misfireSD: 0.3, synJolts: 20 };
export class Glitchling extends (Organism as any) {
  fl: Flaws; gr: () => number; perm: number[] = []; intended: number[] = []; jolts = 0; events: any[] = []; logEvents = false;
  constructor(seed: number, fl: Flaws) { super({ seed } as any); this.fl = fl; this.gr = mulberry(seed * 9973 + 7);
    this.rewire(); this.wiring(); }
  wiring(): void { if (this.fl.backwards) this.ev({ type: "motor_wiring", motNeurons: Array.from({ length: N_MOT }, (_, i) => MOT0 + i), map: Array.from({ length: N_MOT }, (_, i) => N_MOT - 1 - i), sites: "k -> " + (SITES - 1) + "-k" }); }
  ev(e: any): void { if (this.logEvents) this.events.push({ tick: (this as any).t, ...e }); }
  rewire(): void { if (!this.fl.scramble) return; const p = [...Array(SITES).keys()]; for (let i = SITES - 1; i > 0; i--) { const j = Math.floor(this.gr() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } this.perm = p; this.ev({ type: "sensor_shuffle", perm: p }); }
  gs(): number { return Math.sqrt(-2 * Math.log(this.gr() + 1e-12)) * Math.cos(6.283185 * this.gr()); }
  choose(da: number): { k: number; sp: number } {
    const self: any = this; let saved: Float32Array | null = null, savedA: Uint8Array | null = null;
    if (this.fl.scramble) { // scrambled senses: site-value and site-availability channels are read through a fixed permutation plus noise
      saved = self.wSite.slice(); savedA = self.access.slice();
      for (let k = 0; k < SITES; k++) { self.wSite[k] = saved![this.perm[k]] + FLAW_PARAMS.senseNoise * this.gs(); self.access[k] = savedA![this.perm[k]]; } }
    const r = super.choose(da); if (saved) { self.wSite.set(saved); self.access.set(savedA!); }
    this.intended.push(r.k);
    if (this.fl.backwards) { const k0 = r.k; r.k = SITES - 1 - r.k; this.ev({ type: "motor_reversal", intended: k0, executed: r.k }); } // backwards motor wiring: the body goes to the mirror site of the one chosen
    return r;
  }
  step(): void { const self: any = this; if (this.fl.scramble && !this.fl.mild && self.t > 0 && self.t % FLAW_PARAMS.rewireEvery === 0) this.rewire(); super.step();
    if (this.fl.backwards) { const m = self.rate.slice(MOT0, MOT0 + N_MOT).reverse(); self.rate.set(m, MOT0); } // all 8 MOT motor neurons read out in reversed order
    if (this.fl.leaky) { const L = this.fl.mild ? FLAW_PARAMS.mildLeakRate : FLAW_PARAMS.leakRate; // leaky memory: learned values decay to prior every tick
      for (let k = 0; k < SITES; k++) { self.wSite[k] += L * (0.25 - self.wSite[k]); if (self.wAlt) self.wAlt[k] += L * (0.25 - self.wAlt[k]);
        if (self.bA) { self.bA[k] = 1 + (1 - L) * (self.bA[k] - 1); self.bB[k] = 1 + (1 - L) * (self.bB[k] - 1); } }
      const w = self.syn.w, pl = self.syn.plastic; for (let i = 0; i < w.length; i++) if (pl[i]) w[i] *= 1 - L * 0.05; }
    if (this.fl.misfire && self.t % FLAW_PARAMS.misfireEvery === 0) { // misfiring mutations: random weight jolts
      const k = Math.floor(this.gr() * SITES); self.wSite[k] = Math.min(1, Math.max(0, self.wSite[k] + FLAW_PARAMS.misfireSD * this.gs()));
      const w = self.syn.w, hit: any[] = []; for (let j = 0; j < FLAW_PARAMS.synJolts; j++) { const i = Math.floor(this.gr() * w.length); const old = w[i]; w[i] += FLAW_PARAMS.misfireSD * this.gs() * (Math.abs(w[i]) + 0.1); hit.push({ syn: i, pre: self.syn.pre[i], post: self.syn.post[i], from: +old.toFixed(4), to: +w[i].toFixed(4) }); } this.jolts++; this.ev({ type: "misfire", site: k, synapses: hit }); }
  }
}
const CONDS: Record<string, Flaws> = { baseline: {}, scramble: { scramble: true }, leaky: { leaky: true }, backwards: { backwards: true }, misfire: { misfire: true }, all: { scramble: true, leaky: true, backwards: true, misfire: true }, all_mild: { scramble: true, leaky: true, backwards: true, misfire: true, mild: true } };
if (import.meta.main) {
  const days = +(process.argv[2] ?? 2), nSeeds = +(process.argv[3] ?? 2), BLOCK = 360; fs.mkdirSync("results", { recursive: true });
  const rows: string[] = ["condition,seed,alive,ticks,forages,rewards,successRate,glcMean,glcEnd,fatEnd,firstHalfSuccess,secondHalfSuccess,bestSiteFracFirst,bestSiteFracSecond,jolts"]; const all: any = {};
  for (const [name, fl] of Object.entries(CONDS)) { all[name] = [];
    for (let s = 1; s <= nSeeds; s++) { const g: any = new Glitchling(s, fl); const LOG = name === "all" && s === 1; if (LOG) { g.logEvents = true; g.events = []; g.wiring(); g.rewire(); } const best = [...g.pTrue].indexOf(Math.max(...g.pTrue)); const blocks: any[] = []; let f0 = 0, r0 = 0, glcSum = 0, n = 0, bi = 0; const acts: any[] = []; const ch: number[] = [];
      const t0 = Date.now();
      for (let t = 1; t <= 1440 * days && !g.dead; t++) { if (LOG && t === 1441) g.logEvents = false; const fb = g.foraged; g.step(); if (g.foraged > fb) ch.push(g.lastChoice); glcSum += g.blood.glc; n++;
        if (name === "all" && s === 1 && t % 10 === 0 && t <= 1440) acts.push({ t, glc: +g.blood.glc.toFixed(3), regions: Object.fromEntries(Object.entries(g.regionRate).map(([k, v]: any) => [k, +v.toFixed(4)])), rate: Array.from(g.rate as Float32Array, (x: number) => +x.toFixed(3)), wSite: Array.from(g.wSite as Float32Array, (x: number) => +x.toFixed(3)) });
        if (t % BLOCK === 0) { const df = g.foraged - f0, dr = g.rewards - r0; const sub = ch.slice(bi); blocks.push({ hour: t / 60, forages: df, rewards: dr, success: df ? +(dr / df).toFixed(3) : null, glc: +g.blood.glc.toFixed(3), fat: +g.fat.toFixed(1), bestSiteFrac: sub.length ? +(sub.filter((k) => k === best).length / sub.length).toFixed(3) : null }); f0 = g.foraged; r0 = g.rewards; bi = ch.length; } }
      const h = Math.floor(blocks.length / 2), agg = (b: any[], key: string) => { const F = b.reduce((a, x) => a + x.forages, 0); return key === "s" ? (F ? b.reduce((a, x) => a + x.rewards, 0) / F : 0) : (F ? b.reduce((a, x) => a + (x.bestSiteFrac ?? 0) * x.forages, 0) / F : 0); };
      const res = { condition: name, flaws: fl, seed: s, alive: !g.dead, ticks: g.t, forages: g.foraged, rewards: g.rewards, sensorShuffles: Math.floor(g.t / 90) * +(!!fl.scramble && !fl.mild), successRate: +(g.rewards / Math.max(1, g.foraged)).toFixed(3), glcMean: +(glcSum / n).toFixed(3), glcEnd: +g.blood.glc.toFixed(3), fatEnd: +g.fat.toFixed(1), bestSite: best, firstHalf: { success: +agg(blocks.slice(0, h), "s").toFixed(3), bestSiteFrac: +agg(blocks.slice(0, h), "b").toFixed(3) }, secondHalf: { success: +agg(blocks.slice(h), "s").toFixed(3), bestSiteFrac: +agg(blocks.slice(h), "b").toFixed(3) }, jolts: g.jolts, blocks, secs: (Date.now() - t0) / 1000 };
      all[name].push(res); rows.push([name, s, res.alive, res.ticks, res.forages, res.rewards, res.successRate, res.glcMean, res.glcEnd, res.fatEnd, res.firstHalf.success, res.secondHalf.success, res.firstHalf.bestSiteFrac, res.secondHalf.bestSiteFrac, res.jolts].join(","));
      console.log(rows[rows.length - 1], res.secs + "s");
      if (acts.length) fs.writeFileSync("results/activations_allflaws_seed1.json", JSON.stringify({ events: g.events.filter((e: any) => e.tick <= 1440), note: "Glitchling all-flaws seed 1, day 1, every 10 ticks: regionRate per region, rate per neuron (NNEU), perceived site values wSite", nNeurons: acts[0].rate.length, frames: acts }));
    } }
  fs.writeFileSync("results/results.json", JSON.stringify({ days, nSeeds, flawParams: FLAW_PARAMS, conditions: all }, null, 1)); fs.writeFileSync("results/summary.csv", rows.join("\n") + "\n");
}
