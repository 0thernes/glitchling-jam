// v4.0 layered affect + dysregulation (one original design; DELARP-PLAN Part XI).
// Layers: fast emotions (ticks) -> moods (hours, days) -> learned attitudes (lasting, per object) -> personality (lifetime drift, heritable with mutation).
// Dysregulation: HPA lock-in with hysteresis, sleep debt, incentive sensitisation (addiction-like), sickness/inflammation, neuromodulator drift, mood swings.
// No designer-imposed reward or penalty: every input is a body/brain state or a natural consequence (outcome, pain, energy, social contact).
export type Persona = { bold: number; curious: number; reactive: number; vuln: number; hedge?: number; riskScar?: number };
// Adaptive imbalance strategies (heritable genes, no designer reward): hedge = diversified bet-hedging (how widely offspring temperaments scatter around the parent's),
// riskScar = risk-seeking under scarcity (when energy is low, prefer options whose outcomes vary more; the expected-energy logic of risk-sensitive foraging).
export type DysEvent = { t: number; type: string; v: number };
export const AFFECT_LAYERS = ["emotion", "mood", "attitude", "personality", "dysreg", "risk"] as const;
const cl = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
/** body/brain readings the affect system needs (read-only view of the organism) */
export type AffectIn = { t: number; DA: number; NE: number; S5: number; cortisol: number; ghrelin: number; atp: number; integrity: number; sleepS: number; awake: boolean; r: () => number };
export class Affect {
  emo = { fear: 0, delight: 0, frustration: 0, calm: 0.5 }; mood = { val: 0, aro: 0.3, valSlow: 0, aroSlow: 0.3 };
  att: Float32Array; others: Record<string, number> = {}; want: Float32Array; tol: Float32Array; lastVisit: Float32Array;
  persona: Persona; persona0: Persona; stress = 0; hpaLocked = false; sleepDebt = 0; inflam = 0; sick = false; nmBias = { DA: 0, S5: 0 }; events: DysEvent[] = [];
  rMean: Float32Array; rVar: Float32Array; scarcity = 0; private failStreak = 0; private swingSign = 1;
  constructor(nOpt: number, persona: Persona, readonly off: Set<string>) { this.att = new Float32Array(nOpt); this.want = new Float32Array(nOpt); this.tol = new Float32Array(nOpt); this.lastVisit = new Float32Array(nOpt); this.rMean = new Float32Array(nOpt).fill(0.5); this.rVar = new Float32Array(nOpt).fill(0.25); this.persona = { ...persona }; this.persona0 = this.off.has("personality") ? { bold: 0.5, curious: 1, reactive: 0.5, vuln: 0.3, hedge: 0.3, riskScar: 0.5 } : { ...persona }; } /* personality lesion = population-mean temperament (no individual differences, no drift) */
  /** seeded or inherited personality; vulnerability is heritable */
  static birth(rand: () => number, parent?: Persona, mut = 0.1): Persona { const g = () => { const u1 = Math.max(1e-12, rand()), u2 = rand(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
    if (parent) { const h = parent.hedge ?? 0.3, m = mut * (0.3 + 2.5 * h); // bet-hedging: a high-hedge parent spreads its offspring across temperaments
      return { bold: cl(parent.bold + m * g(), 0.05, 1), curious: Math.max(0.2, parent.curious * Math.exp(m * g())), reactive: cl(parent.reactive + m * g(), 0.05, 1), vuln: cl(parent.vuln + m * g(), 0, 1), hedge: cl(h + mut * g()), riskScar: cl((parent.riskScar ?? 0.5) + mut * g(), 0, 2) }; }
    return { bold: cl(0.5 + 0.2 * g(), 0.05, 1), curious: Math.exp(0.25 * g()), reactive: cl(0.5 + 0.2 * g(), 0.05, 1), vuln: cl(0.3 + 0.2 * g(), 0, 1), hedge: cl(0.3 + 0.15 * g()), riskScar: cl(0.5 + 0.3 * g(), 0, 2) }; }
  private ev(t: number, type: string, v: number) { this.events.push({ t, type, v: +v.toFixed(3) }); if (this.events.length > 500) this.events.shift(); }
  /** per-tick update; returns hormone/neuromodulator/sleep feedback for the body (natural coupling, not a penalty) */
  step(x: AffectIn): { cortisol: number; DA: number; S5: number; sleep: number } {
    const P = this.off.has("personality") ? this.persona0 : this.persona, on = (l: string) => !this.off.has(l); const fb = { cortisol: 0, DA: 0, S5: 0, sleep: 0 }; this.scarcity = cl(0.6 * (1 - x.atp) + 0.6 * x.ghrelin - 0.3);
    if (on("emotion")) { const k = 1 / 15, re = 0.5 + P.reactive; // fast emotions from neuromodulators and body
      this.emo.fear += k * (cl(re * (1.5 * Math.max(0, x.NE - 0.35) + 0.8 * Math.max(0, x.cortisol - 0.45) + (1 - x.integrity))) - this.emo.fear);
      this.emo.calm += k * (cl(x.S5 * (1 - x.ghrelin) * 1.5) - this.emo.calm); this.emo.delight *= 1 - k; this.emo.frustration *= 1 - k * 0.7; }
    else this.emo = { fear: 0, delight: 0, frustration: 0, calm: 0.5 };
    if (on("mood")) { const inst = this.emo.delight + 0.5 * this.emo.calm - this.emo.fear - 0.7 * this.emo.frustration - 0.5 * (this.sick ? 1 : 0);
      const rum = 0.6 * P.vuln; // rumination: mood partly feeds on its own deviation from the slow baseline -> overshoot and swings in vulnerable individuals
      const prev = this.mood.val; this.mood.val = cl(this.mood.val + (inst - this.mood.val) / 360 + rum * (this.mood.val - this.mood.valSlow) / 360, -1, 1);
      this.mood.aro += (this.emo.fear + this.emo.delight + this.emo.frustration - this.mood.aro) / 360; this.mood.valSlow += (this.mood.val - this.mood.valSlow) / 4320; this.mood.aroSlow += (this.mood.aro - this.mood.aroSlow) / 4320;
      const sg = Math.sign(this.mood.val - this.mood.valSlow); if (Math.abs(this.mood.val - this.mood.valSlow) > 0.35 && sg !== this.swingSign) { this.swingSign = sg; this.ev(x.t, "moodSwing", this.mood.val); } void prev; }
    if (on("personality") && x.t % 60 === 0) { const d = 2e-4; P.bold = cl(P.bold + d * this.mood.valSlow, 0.05, 1); P.reactive = cl(P.reactive + d * (this.mood.aroSlow - 0.3), 0.05, 1); } // lifetime drift: lived experience reshapes temperament
    if (on("dysreg")) {
      // HPA axis: stress load integrates fear and cortisol; above a vulnerability-lowered threshold it locks in (cortisol keeps itself high), with hysteresis; recovery when load falls
      this.stress += (this.emo.fear + Math.max(0, x.cortisol - 0.4) + 0.5 * this.inflam - this.stress) / 240; const hi = 0.55 - 0.25 * P.vuln, lo = hi * 0.5;
      if (!this.hpaLocked && this.stress > hi) { this.hpaLocked = true; this.ev(x.t, "hpaLockIn", this.stress); } else if (this.hpaLocked && this.stress < lo) { this.hpaLocked = false; this.ev(x.t, "hpaRecover", this.stress); }
      if (this.hpaLocked) fb.cortisol += 0.004;
      // sleep debt: high sleep pressure while awake accumulates; repaid in sleep
      this.sleepDebt = Math.max(0, this.sleepDebt + (x.awake ? Math.max(0, x.sleepS - 0.7) * 0.01 : -0.004)); if (this.sleepDebt > 1 && x.t % 720 === 0) this.ev(x.t, "sleepDebt", this.sleepDebt); this.emo.frustration = cl(this.emo.frustration + 0.002 * this.sleepDebt);
      // sickness: inflammation from chronic stress, energy crisis, tissue damage and rare chance infections; sickness behaviour = anhedonia, lethargy, more sleep
      const inf = x.r() < 2e-4 * (0.5 + P.vuln) ? 0.6 : 0; this.inflam = cl(this.inflam + inf + 0.002 * (this.stress + Math.max(0, 0.6 - x.atp) + (1 - x.integrity)) - this.inflam / 600);
      if (!this.sick && this.inflam > 0.4) { this.sick = true; this.ev(x.t, inf ? "infection" : "sickness", this.inflam); } else if (this.sick && this.inflam < 0.2) { this.sick = false; this.ev(x.t, "recovered", this.inflam); }
      if (this.sick) { fb.sleep += 0.0006; this.emo.delight *= 0.9; }
      // neuromodulator imbalance: slow mean-reverting random drift whose size scales with vulnerability; can oscillate against the homeostatic pull
      for (const m of ["DA", "S5"] as const) this.nmBias[m] += -this.nmBias[m] / 1440 + 0.002 * P.vuln * (x.r() - 0.5); fb.DA += this.nmBias.DA * 0.01; fb.S5 += this.nmBias.S5 * 0.01;
      // withdrawal: wanting that is not satisfied turns into frustration
      for (let k = 0; k < this.want.length; k++) if (this.want[k] > 0.3 && x.t - this.lastVisit[k] > 480) { this.emo.frustration = cl(this.emo.frustration + 0.0015 * this.want[k]); if (x.t % 240 === 0) this.ev(x.t, "craving", this.want[k]); } }
    return fb; }
  /** natural outcome of an approach to option k: reward (food), pain (damage), or nothing */
  outcome(t: number, k: number, reward: number, pain: number, da: number, rpe = reward - 0.5): void { const phasic = Math.abs(rpe); /* phasic dopamine prediction error (0 when the RPE system is lesioned) */ const on = (l: string) => !this.off.has(l); this.lastVisit[k] = t; const P = this.persona; { const d = reward - this.rMean[k]; this.rMean[k] += 0.1 * d; this.rVar[k] += 0.1 * (d * d - this.rVar[k]); } /* outcome statistics per option (for risk sensitivity) */
    if (on("emotion")) { if (reward > 0) { this.emo.delight = cl(this.emo.delight + 0.6 * reward * (0.5 + da) * (1 - this.tol[k]) * (this.sick ? 0.3 : 1)); this.failStreak = 0; } else { this.failStreak++; this.emo.frustration = cl(this.emo.frustration + 0.08 * Math.min(5, this.failStreak)); } if (pain > 0) this.emo.fear = cl(this.emo.fear + pain * (0.5 + P.reactive)); }
    if (on("attitude")) this.att[k] += 0.08 * Math.min(1, 2 * phasic) * (this.emo.delight - this.emo.fear - 0.5 * this.emo.frustration - this.att[k]); /* attitude learning is gated by the phasic DA prediction error (affective value is learned from surprise, not mere repetition) */ // lasting valenced disposition toward this object/place
    if (on("dysreg") && reward > 0) { // incentive sensitisation: repeated DA-paired reward at one option grows 'wanting' (sensitised by vulnerability) while 'liking' gets tolerance
      this.want[k] = cl(this.want[k] + 0.02 * (0.5 + P.vuln) * (0.5 + da) * Math.min(1, 2 * Math.max(0, rpe))); /* incentive salience is attributed by phasic DA (Berridge & Robinson 1998) */ this.tol[k] = cl(this.tol[k] + 0.01 * P.vuln, 0, 0.8); if (this.want[k] > 0.6 && this.want[k] - 0.02 < 0.6) this.ev(t, "sensitised", this.want[k]); }
    for (let j = 0; j < this.tol.length; j++) { this.tol[j] *= 0.999; this.want[j] *= 0.9995; } }
  /** social contact with another creature (dome); valence is a natural consequence (shared food, fight damage, grooming) */
  meet(id: string, valence: number): void { if (this.off.has("attitude")) return; this.others[id] = (this.others[id] ?? 0) + 0.1 * (valence - (this.others[id] ?? 0)); }
  /** decision bias for option k: attitude + wanting (no designer penalty; both are learned from consequences) */
  bias(k: number): number { return (this.off.has("attitude") ? 0 : 0.3 * this.att[k]) + (this.off.has("dysreg") ? 0 : 0.4 * this.want[k]) + (this.off.has("risk") ? 0 : 0.5 * (this.persona.riskScar ?? 0) * (this.scarcity - 0.3) * (Math.sqrt(this.rVar[k]) - 0.35)); } // risk: averse when fed, seeking when starving (variance-sensitive)
  /** social stance toward another creature: >0 approach, <0 avoid */
  stance(id: string): number { return this.off.has("attitude") ? 0 : this.others[id] ?? 0; }
  /** what contact with others feels like right now (associative: attitudes toward others are learned from how being near them felt) */
  feltValence(): number { return this.emo.delight + 0.5 * this.emo.calm - this.emo.fear - 0.5 * this.emo.frustration; }
  /** multiplier on the uncertainty (curiosity) term: good mood and boldness open exploration, fear and sickness close it */
  uMul(): number { const P = this.off.has("personality") ? this.persona0 : this.persona; return cl(P.curious * (1 + 0.6 * this.mood.val - 0.8 * this.emo.fear * (1 - P.bold)) * (this.sick ? 0.5 : 1), 0.1, 3); }
  /** multiplier on the forage probability: sickness lethargy, fear freezing, frustration restlessness */
  forageMul(): number { return cl((this.sick ? 0.5 : 1) * (1 - 0.4 * this.emo.fear * (1 - this.persona.bold)) * (1 + 0.3 * this.emo.frustration), 0.2, 1.6); }
  /** decision-noise multiplier: frustration and arousal make choices more erratic */
  noiseMul(): number { return 1 + 0.5 * this.emo.frustration + 0.3 * Math.max(0, this.mood.aro - 0.5); }
  /** lab view */
  state() { return { emo: { ...this.emo }, mood: { ...this.mood }, att: Array.from(this.att), want: Array.from(this.want), rMean: Array.from(this.rMean), rSD: Array.from(this.rVar, Math.sqrt), scarcity: this.scarcity, others: { ...this.others }, persona: { ...this.persona }, stress: this.stress, hpaLocked: this.hpaLocked, sleepDebt: this.sleepDebt, inflam: this.inflam, sick: this.sick, nmBias: { ...this.nmBias }, events: this.events.slice(-50) }; }
}
