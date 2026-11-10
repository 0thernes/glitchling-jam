// Climbing probe: a rock (radius 0.9) is placed 3 units ahead on the line to a fixed goal 9 units away. 40 s.
// Reports: max COM height above local terrain, fraction of frames with >=3 particles touching the rock, distance closed.
globalThis.TW = JSON.parse(process.env.TW || '{}');
import { Creature } from '../js/sim/creature.js';
const L = (process.env.L || '').split('+').filter(Boolean); const rows = [];
for (const seed of [1, 2, 3, 4, 5, 6]) { const c = new Creature(seed); c.world.rocks = []; c.world.springs = []; for (const l of L) c.lesion[l] = true; for (let f = 0; f < 60; f++) c.step();
  const B = c.body, F = B.F[3].f, com = B.com(); const n = Math.hypot(F[0], F[2]); const fx = F[0] / n, fz = F[2] / n; const rx = com[0] + 3 * fx, rz = com[2] + 3 * fz, gx = com[0] + 9 * fx, gz = com[2] + 9 * fz;
  c.world.addRock(rx, rz, 0.9); let maxH = 0, onRock = 0, d0 = null;
  for (let f = 0; f < 60 * 40; f++) { if (!c.goal || c.goal.type !== 'explore') { c.goal = { type: 'explore', x: gx, z: gz, since: c.t }; c.race = null; } c.goal.since = c.t; c.step(); if (d0 === null) d0 = c.dist; const m = B.com(); maxH = Math.max(maxH, m[1] - c.world.height(m[0], m[2])); let k = 0; for (let i = 0; i < B.n; i++) if (B.contact[i] === 2) k++; if (k >= 3) onRock++; }
  rows.push([+maxH.toFixed(2), +(onRock / 2400).toFixed(2), +(d0 - c.dist).toFixed(1)]); }
const m = (j) => (rows.reduce((a, r) => a + r[j], 0) / rows.length).toFixed(2); console.log((process.env.L || 'intact').padEnd(10), JSON.stringify(rows), 'mean maxH', m(0), 'onRock', m(1), 'closed', m(2));
