// steering probe with optional lesions (env L=a+b): fixed goal 18 away, 40 s, 4 seeds; prints mean distance closed.
globalThis.TW = JSON.parse(process.env.TW || '{}');
import { Creature } from '../js/sim/creature.js';
const L = (process.env.L || '').split('+').filter(Boolean); const out = [];
for (const seed of (process.env.S || '1,2,3,4,5,6,7,8').split(',').map(Number)) { const c = new Creature(seed); c.world.rocks = []; c.world.springs = []; for (const l of L) c.lesion[l] = true;
  let up = 0, n = 0, d0 = null; for (let f = 0; f < 60 * 40; f++) { if (!c.goal || c.goal.type !== 'explore') { c.goal = { type: 'explore', x: 14, z: 10, since: c.t }; c.race = null; } c.goal.since = c.t; c.step(); if (d0 === null) d0 = c.dist; up += c.body.F[3].u[1]; n++; }
  out.push([+(d0 - c.dist).toFixed(1), +(up / n).toFixed(2)]); }
console.log((process.env.L || 'intact') + ' ' + JSON.stringify(process.env.TW || ''), JSON.stringify(out), 'mean closed', (out.reduce((a, r) => a + r[0], 0) / out.length).toFixed(1));
