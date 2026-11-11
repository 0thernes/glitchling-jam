// Navigation fitness of a full genome (used by evolve_steer.mjs). Per seed: a near goal (4-8 units) and a far goal (>= 14 units),
// each held for up to `secs` s after neonatal babbling (rocks and springs in place). Score per trial: 1 + (secs - t)/secs on
// arrival (head within 1.3 units), else 0.8 * fraction of the initial distance closed. Minus 1.0 * max(0, 0.85 - upright).
import { Creature } from '../js/sim/creature.js';
export function navEval(genome, seeds = [1, 2, 3], secs = 45) { let score = 0, n = 0, up = 0, upN = 0, flip = 0, arr = 0;
  for (const seed of seeds) for (const kind of ['near', 'far']) { globalThis.TW = { ...(globalThis.TWBASE || {}), genome }; const c = new Creature(seed); for (let f = 0; f < 60 * 13; f++) c.step();
    const hd = c.body.head(); const P = c.world.plants.map((p) => ({ k: p.k, d: Math.hypot(p.x - hd[0], p.z - hd[2]) })).filter((q) => (kind === 'near' ? q.d >= 4 && q.d <= 8 : q.d >= 14)).sort((a, b) => a.d - b.d); if (!P.length) continue;
    const k = P[0].k, pl = c.world.plants[k], d0 = P[0].d; let dmin = d0, t = null;
    for (let f = 0; f < secs * 60; f++) { if (!c.goal || c.goal.k !== k) { c.goal = { type: 'site', k, chosen: k, since: c.t }; c.race = null; } c.step(); const u1 = c.body.F[3].u[1]; up += u1; if (u1 < 0) flip++; upN++; const h = c.body.head(); const d = Math.hypot(pl.x - h[0], pl.z - h[2]); dmin = Math.min(dmin, d); if (d < 1.3) { t = f / 60; break; } }
    score += t !== null ? 1 + (secs - t) / secs : (0.8 * Math.max(0, d0 - dmin)) / d0; if (t !== null) arr++; n++; }
  const upr = up / Math.max(1, upN), flipF = flip / Math.max(1, upN);
  return { fit: score / Math.max(1, n) + 0.4 * Math.min(0.92, upr) - 3.5 * Math.max(0, 0.86 - upr) - 2.0 * flipF, arr, n, up: upr, flip: flipF }; }
