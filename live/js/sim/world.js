// The 3D world: a heightfield that slowly reshapes itself over time, climbable rocks, spring pads, 16 feeding plants
// (4 colours x 4 shapes, reward probability from the reference formula), user-dropped food, and a weather/current field.
import { fbm, mulberry, clamp } from './util.js';
export const SITES = 16, WORLD = 22; // half-extent of the square arena (world units; creature body ~2.4 long)
export class World {
  constructor(seed) {
    this.seed = seed; const r = (this.r = mulberry(seed * 31 + 5)); this.t = 0; this.morph = 0; this.gx = 0; this.gz = 0; this.g = 9.8;
    const cv = [0, 1, 2, 3].sort(() => r() - 0.5), sv = [0, 1, 2, 3].sort(() => r() - 0.5);
    this.plants = []; // site k: colour k&3, shape k>>2; reference: p = 0.05 + 0.25 cv/3 + 0.25 sv/3
    for (let k = 0; k < SITES; k++) { const gx = (k & 3) - 1.5, gz = (k >> 2) - 1.5; const x = gx * 9 + (r() - 0.5) * 3, z = gz * 9 + (r() - 0.5) * 3;
      const p = 0.05 + (0.25 * cv[k & 3]) / 3 + (0.25 * sv[k >> 2]) / 3; this.plants.push({ k, x, z, c: k & 3, s: k >> 2, p, fruit: 1, regrow: 0 }); }
    this.best = this.plants.reduce((b, q) => (q.p > b.p ? q : b)).k;
    this.rocks = []; for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = 5 + r() * 13; this.rocks.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, r: 0.9 + r() * 1.6 }); }
    this.springs = []; for (let i = 0; i < 3; i++) { const a = r() * Math.PI * 2, d = 4 + r() * 12; this.springs.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 1.3, comp: 0, v: 0 }); }
    { const rw = mulberry(seed * 97 + 3); this.pools = []; for (let i = 0; i < 3; i++) { const a = rw() * Math.PI * 2, d = 6 + rw() * 12; this.pools.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 2.2, level: 1 }); } } // water pools (separate RNG: plant/rock layout unchanged)
    this.snacks = []; this.waste = []; this.wind = { x: 0, z: 0, tx: 0, tz: 0, rain: 0 };
    this.fixY();
  }
  /** terrain height; the field drifts with this.morph so the ground itself changes during a run */
  height(x, z) { const m = this.morph; let h = 2.2 * (fbm(x * 0.06 + 0.13 * Math.sin(m * 0.7), z * 0.06 + 0.11 * Math.cos(m * 0.5), this.seed) - 0.5) + 0.6 * (fbm(x * 0.17, z * 0.17 + m * 0.05, this.seed + 3) - 0.5);
    const d = Math.hypot(x, z); if (d > WORLD - 3) h += 0.6 * (d - WORLD + 3) ** 1.5; return h; }
  normal(x, z) { const e = 0.05, hx = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e), hz = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e); const n = Math.hypot(hx, 1, hz); return [-hx / n, 1 / n, -hz / n]; }
  fixY() { for (const q of this.rocks) q.y = this.height(q.x, q.z) + q.r * 0.35; for (const q of this.plants) q.y = this.height(q.x, q.z); for (const s of this.springs) s.y = this.height(s.x, s.z); for (const s of this.snacks) if (!s.held) s.y = Math.max(s.y, this.height(s.x, s.z) + 0.15); }
  /** one environment step (dt seconds of sim time); tick = metabolic minute counter */
  step(dt, tick) {
    this.t += dt; this.morph += dt * 0.004; const W = this.wind, r = this.r;
    if (r() < dt * 0.05) { W.tx = (r() - 0.5) * 3; W.tz = (r() - 0.5) * 3; W.rainT = r() < 0.3 ? 1 : 0; }
    W.x += (W.tx - W.x) * dt * 0.2; W.z += (W.tz - W.z) * dt * 0.2; W.rain += ((W.rainT || 0) - W.rain) * dt * 0.1;
    for (const q of this.plants) if (q.fruit < 1) { q.fruit = Math.min(1, q.fruit + dt * (0.02 + 0.03 * W.rain)); }
    for (const s of this.springs) { s.v += (-40 * s.comp - 4 * s.v) * dt; s.comp += s.v * dt; s.comp = clamp(s.comp, -0.3, 0.6); }
    for (const s of this.snacks) { if (s.y > this.height(s.x, s.z) + 0.15) { s.vy = (s.vy || 0) - 9.8 * dt; s.y += s.vy * dt; } else { s.vy = 0; s.y = this.height(s.x, s.z) + 0.15; } }
    for (const w of this.waste) w.age += dt; this.waste = this.waste.filter((w) => w.age < 120);
    if (Math.floor(this.t / 2) !== Math.floor((this.t - dt) / 2)) this.fixY();
  }
  dropSnack(x, z, y) { if (this.snacks.length > 24) this.snacks.shift(); this.snacks.push({ x, z, y: y ?? this.height(x, z) + 4, vy: 0, kind: this.r() < 0.5 ? 'sugar' : 'fat', id: Math.floor(this.r() * 1e9) }); }
  addRock(x, z, rad = 1.2) { if (this.rocks.length > 20) this.rocks.shift(); this.rocks.push({ x, z, r: rad, y: this.height(x, z) + rad * 0.35 }); }
  addSpring(x, z) { if (this.springs.length > 10) this.springs.shift(); this.springs.push({ x, z, r: 1.3, comp: 0, v: 0, y: this.height(x, z) }); }
}
