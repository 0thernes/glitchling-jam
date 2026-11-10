// B27 diagnostic: is v6.0 over-eating? Fraction of minutes with glucose above / below the C10 band, ATP < 1.5, S > 0.9; dev seeds 3881-3884, days 1-3.
import { Organism } from "../organism";
const D = 1440; const SB = Number(process.env.SB ?? 3881); const out: any[] = [];
for (let s = SB; s < SB + 4; s++) { const g: any = new Organism({ seed: s } as any); while (g.t < D) g.step(); let n = 0, hi = 0, lo = 0, atp = 0, sl = 0, gs = 0, f0 = g.foraged ?? 0; while (g.t < 3 * D) { g.step(); n++; const c = g.blood.glc; gs += c; hi += +(c >= 4.5); lo += +(c <= 2.0); atp += +(g.atp <= 1.5); sl += +(g.S >= 0.9); } out.push({ s, glcMean: +(gs / n).toFixed(2), high: +(hi / n).toFixed(3), low: +(lo / n).toFixed(3), atpLow: +(atp / n).toFixed(3), sleepy: +(sl / n).toFixed(3) }); }
console.log(JSON.stringify(out));
