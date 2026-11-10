// Isolated LTC module (original code). Claim (Hasani et al. 2021): an input-dependent time constant beats any fixed one when the input mixes
// timescales. Mechanism: conductance-based (shunting) synapse, tau = tau0 / (1 + g|e|) where e = input - state (Koch, Rapp & Segev 1996):
// a large prediction error opens conductance -> fast tracking of jumps; small error -> long tau averages noise.
// Task: piecewise-constant signal with rare jumps + white noise; score = tracking error (−MSE). Controls: fixed tau equal to tau0 and the
// ORACLE best fixed tau chosen per seed in hindsight (matched-capacity, strictly harder).
const B = Number(process.env.SEEDBASE ?? 0), N = 16; if (B < 2000) throw new Error("dev seeds only");
const sim = (s: number, tauF: (e: number) => number) => { let q = s * 389 + 11; const r = () => { q = (q * 1103515245 + 12345) >>> 0; return q / 4294967296; }; const gs = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(6.283 * r());
  let sig = 0, x = 0, se = 0; for (let t = 0; t < 4000; t++) { if (r() < 0.01) sig = 4 * (r() - 0.5) * 2; const u = sig + 0.6 * gs(); const e = u - x; x += e / tauF(Math.abs(e)); if (t >= 200) se += (x - sig) ** 2; } return -se / 3800; };
const T0 = 20, G = 3; const S = Array.from({ length: N }, (_, i) => B + i);
console.log(JSON.stringify({ arms: { LTC: S.map((s) => sim(s, (e) => 1 + T0 / (1 + G * e * e))), "fixed tau = tau0": S.map((s) => sim(s, () => 1 + T0)), "oracle best fixed tau": S.map((s) => Math.max(...[1, 2, 3, 5, 8, 12, 20, 30].map((tf) => sim(s, () => tf)))) } }));
