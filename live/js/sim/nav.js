// Navigation circuit (pass 13): head-direction ring attractor + path integration with grid-like phase codes.
// - HD ring: 36 rate neurons on a ring with cosine recurrent excitation and uniform inhibition (a continuous attractor that
//   holds one activity bump). Angular head velocity from the vestibular sense enters through an odd (sine-shaped) kernel
//   that pushes the bump around the ring (Skaggs et al. 1995; Zhang 1996). The shift gain is calibrated once at birth by
//   driving the ring with a known velocity. A visual compass (36 cells tuned to the sun's egocentric bearing, daytime only)
//   learns Hebbian connections onto the ring, so after some experience the sun pins the bump and corrects drift.
// - Path integration: the decoded heading plus proprioceptive body velocity (forward and sideways components, 8%
//   multiplicative noise) is integrated into a position estimate. The same velocity advances three grid modules (spatial
//   periods 3, 5.2, 9 units; three axes 60 deg apart) whose phases give grid-cell-like firing; they are shown in the brain
//   panel but navigation reads the integrated position directly.
// - Landmark reset: when a feeding plant or pool is within view (9 units, in front), the estimate is pulled toward the
//   position implied by that landmark (place-cell-like reset), so drift only grows while nothing is in view.
// Steering to a goal beyond view range uses this estimate (vector navigation) instead of direct sight.
import { mulberry, gauss, clamp } from './util.js';
const N = 36, TH = Array.from({ length: N }, (_, i) => (2 * Math.PI * i) / N);
export const VIEW = 9;
export class Nav {
  constructor(seed, heading0) { this.r = mulberry(seed * 4099 + 11); this.h = new Float64Array(N); this.Wv = new Float64Array(N * N); this.vis = new Float64Array(N); this.shiftGain = 1; this.vestGain = 1; this.eta = 0.1; this.visK = 0.1; this.tauS = 60; this.sunExp = 0; /* seconds of sun experience: Hebbian rate decays as the compass consolidates */
    for (let i = 0; i < N; i++) { const d = Math.cos(TH[i] - heading0); this.h[i] = Math.max(0, d) ** 4; } this.px = 0; this.pz = 0; this.grid = [3, 5.2, 9].map((lam) => ({ lam, ph: [0, 0, 0] })); this.err = 0; this.resets = 0; this.sunLearn = true; this.calibrate(); }
  rec(h, out, omega) { // one Euler step of the ring; omega = commanded angular velocity (rad/s) scaled by the shift gain
    for (let i = 0; i < N; i++) { let s = 0, sh = 0; for (let j = 0; j < N; j++) { const d = TH[i] - TH[j]; s += Math.cos(d) * h[j]; sh += -Math.sin(d) * h[j]; } out[i] = 0.32 * s - 0.24 * this.sum(h) + 0.01 * omega * sh + this.Iext[i]; } }
  sum(h) { let s = 0; for (let i = 0; i < N; i++) s += h[i]; return s / N * 6; }
  step(dt, omegaVest, visAz) { // visAz: egocentric sun azimuth (rad) or null at night
    if (!this.Iext) this.Iext = new Float64Array(N); const I = this.Iext; I.fill(0); this.vis.fill(0);
    if (visAz !== null) { for (let k = 0; k < N; k++) { let d = Math.abs(TH[k] - ((visAz % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)); if (d > Math.PI) d = 2 * Math.PI - d; this.vis[k] = Math.exp(-(d * d) / 0.08); }
      for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < N; k++) s += this.Wv[i * N + k] * this.vis[k]; I[i] = this.visK * s; } }
    const sub = 4, h = this.h, tmp = new Float64Array(N), om = this.shiftGain * this.vestGain * omegaVest;
    for (let q = 0; q < sub; q++) { this.rec(h, tmp, om); let mx = 0; for (let i = 0; i < N; i++) { const v = Math.max(0, tmp[i]); h[i] += (dt / sub / 0.02) * (v - h[i]); if (h[i] > mx) mx = h[i]; } if (mx > 0) for (let i = 0; i < N; i++) h[i] /= mx; /* gain control keeps the bump amplitude at 1 */ }
    { const hd = this.heading(); if (visAz !== null && this.prevAz != null && this.prevHd != null && this.sunLearn) { const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x)); const wVis = -wrap(visAz - this.prevAz) / dt, wHd = wrap(hd - this.prevHd) / dt;
        /* visual-vestibular gain adaptation (VOR-like, cerebellar): LMS on the mismatch between how fast the sun swept and how fast the bump turned */ this.vestGain = clamp(this.vestGain + 0.004 * (wVis - wHd) * omegaVest * dt * 60, 0.3, 3); }
      this.prevAz = visAz; this.prevHd = hd; }
    if (visAz !== null && this.sunLearn) this.sunExp += dt; if (visAz !== null && this.sunLearn) for (let k = 0; k < N; k++) { if (this.vis[k] < 0.05) continue; let tot = 0; for (let i = 0; i < N; i++) { const j = i * N + k; this.Wv[j] += (this.eta / (1 + this.sunExp / (this.tauS ?? 20))) * dt * this.vis[k] * h[i] ** 4; tot += this.Wv[j]; } if (tot > 1) for (let i = 0; i < N; i++) this.Wv[i * N + k] /= tot; } /* Hebbian, competitively normalised per sun cell: each sun cell wires to the HD cells active when it fires */
  }
  heading() { let c = 0, s = 0; for (let i = 0; i < N; i++) { c += this.h[i] * Math.cos(TH[i]); s += this.h[i] * Math.sin(TH[i]); } return Math.atan2(s, c); }
  calibrate() { // measure bump speed per unit omega input, set shiftGain so the bump turns at the commanded rate
    const save = Float64Array.from(this.h); const h0 = this.heading(); let tot = 0; for (let k = 0; k < 60; k++) { this.step(1 / 60, 0.5, null); } let d = this.heading() - h0; while (d < -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI; this.shiftGain = 0.5 / (Math.abs(d) < 0.02 ? 0.02 : d); this.h.set(save); }
  integrate(dt, vf, vl) { const th = this.heading(), n1 = 1 + 0.08 * gauss(this.r), n2 = 1 + 0.08 * gauss(this.r); const vx = (vf * Math.cos(th) - vl * Math.sin(th)) * n1, vz = (vf * Math.sin(th) + vl * Math.cos(th)) * n2;
    this.px += vx * dt; this.pz += vz * dt; for (const g of this.grid) for (let a = 0; a < 3; a++) { const ang = (a * Math.PI) / 3; g.ph[a] += ((2 * Math.PI) / g.lam) * (vx * Math.cos(ang) + vz * Math.sin(ang)) * dt; } }
  gridRate(m) { const g = this.grid[m]; return (Math.cos(g.ph[0]) + Math.cos(g.ph[1]) + Math.cos(g.ph[2]) + 1.5) / 4.5; }
  reset(x, z, k = 0.3) { this.px += k * (x - this.px); this.pz += k * (z - this.pz); this.resets++; }
}
