// Closed-loop steering probe: fixed goal, does the creature close the distance? 'noturn' removes the innate bearing->turn wiring.
import { Creature } from '../js/sim/creature.js';
for (const v of ['normal', 'noturn', 'nolearn']) { const out = []; for (const seed of [1, 2, 3]) { const c = new Creature(seed); c.world.rocks = []; c.world.springs = [];
  if (v === 'noturn') { c.Wmot[1 * 14 + 0] = 0; c.Wmot[2 * 14 + 1] = 0; } if (v === 'nolearn') c.lesion.learnMotor = true;
  let up = 0, n = 0, d0 = null; for (let f = 0; f < 60 * 40; f++) { if (!c.goal || c.goal.type !== 'explore') { c.goal = { type: 'explore', x: 14, z: 10, since: c.t }; c.race = null; } c.goal.since = c.t; c.step(); if (d0 === null) d0 = c.dist; up += c.body.F[3].u[1]; n++; }
  out.push({ start: +d0.toFixed(1), end: +c.dist.toFixed(1), upright: +(up / n).toFixed(2) }); } console.log(v, JSON.stringify(out)); }
