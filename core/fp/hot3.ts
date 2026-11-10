// FIRST-PRINCIPLES HOT-3 module (isolated). Metacognitive opt-out: keep P(correct | confidence bin) by delta rule; opt out when it falls
// below the value of the safe option. Kiani & Shadlen 2009; Lau & Rosenthal 2011. Original code.
export class OptOut { pc: number[]; constructor(readonly bins = 10, init = 0.5) { this.pc = new Array(bins).fill(init); }
  bin(conf: number): number { return Math.max(0, Math.min(this.bins - 1, Math.floor(conf * this.bins))); }
  decide(conf: number, safe: number): boolean { return this.pc[this.bin(conf)] < safe; }
  learn(conf: number, correct: boolean): void { const b = this.bin(conf); this.pc[b] += 0.1 * ((correct ? 1 : 0) - this.pc[b]); } }
/** Confidence module reading the decision margin (first principles: in a race/accumulator model, the balance of evidence at commitment
 *  predicts accuracy; Vickers 1979; Kiani & Shadlen 2009). The raw margin is mapped to its running percentile (a rank code), so the opt-out
 *  table always spans the observed range; with absolute bins a compressed margin falls into one bin and cannot discriminate. Original code. */
export class MarginConf { hist: number[] = []; constructor(readonly n = 120) {}
  read(margin: number): number { const h = this.hist; const below = h.filter((v) => v < margin).length + 0.5 * h.filter((v) => v === margin).length; const q = h.length ? below / h.length : 0.5; h.push(margin); if (h.length > this.n) h.shift(); return Math.min(0.999, q); } }
