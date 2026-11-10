// FIRST-PRINCIPLES curiosity (original code). Idea inspired by Alex Donahue's SUPER CREATURE online next-beat sense predictors (cq5, user's own work):
// each site has a tiny online reward predictor; curiosity = learning progress = slow error EMA minus fast error EMA (prediction getting better),
// after Schmidhuber 1991 and Oudeyer, Kaplan & Hafner 2007 (IEEE TEC 11:265). Neuro: LC-NE / ACh uncertainty signals (Yu & Dayan 2005).
export class LearningProgress { p: Float64Array; eF: Float64Array; eS: Float64Array;
  constructor(n: number) { this.p = new Float64Array(n).fill(0.3); this.eF = new Float64Array(n).fill(0.3); this.eS = new Float64Array(n).fill(0.3); }
  observe(k: number, r: number): void { const e = Math.abs(r - this.p[k]); this.eF[k] += 0.3 * (e - this.eF[k]); this.eS[k] += 0.05 * (e - this.eS[k]); this.p[k] += 0.2 * (r - this.p[k]); }
  bonus(k: number): number { return Math.max(0, this.eS[k] - this.eF[k]); } }
