// B23 diagnostic: AINF protocol (deplete, 480 + 2 days) reward and forage count under probes; dev seeds 3445-3460 only.
import { Organism } from "../organism";
const D = 1440, S = Array.from({ length: 16 }, (_, i) => 3445 + i); const o: any = process.env.PROBE === "noSatiety" ? { fixedDrive: true } : {}; if (process.env.LES) o[process.env.LES] = true;
const R: number[] = [], F: number[] = []; for (const s of S) { const g: any = new Organism({ seed: s, deplete: true, ...o } as any); while (g.t < 480) g.step(); const r0 = g.rewards, v0 = g.visits.reduce((p: number, q: number) => p + q, 0); while (g.t < 480 + 2 * D) g.step(); R.push(g.rewards - r0); F.push(g.visits.reduce((p: number, q: number) => p + q, 0) - v0); }
const m = (x: number[]) => x.reduce((p, q) => p + q, 0) / x.length, sd = (x: number[]) => Math.sqrt(x.reduce((p, q) => p + (q - m(x)) ** 2, 0) / (x.length - 1));
console.log(JSON.stringify({ probe: process.env.PROBE ?? "none", les: process.env.LES ?? "", reward: +m(R).toFixed(1), rewardSD: +sd(R).toFixed(1), forages: +m(F).toFixed(1), hitRate: +(m(R) / m(F)).toFixed(3), R }));
