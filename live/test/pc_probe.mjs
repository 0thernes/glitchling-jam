// Predictive-coding probe: mean squared body-sense prediction error in the first vs last 30 s of a 180 s run, learning on vs
// off; and the error response to a poke (mean error 1 s after vs 1 s before), seeds 1-4.
import { Creature } from '../js/sim/creature.js';
for (const frozen of [false, true]) { const rows = []; for (const seed of [1, 2, 3, 4]) { const c = new Creature(seed); if (frozen) c.lesion.pc = true; let a = 0, b = 0, na = 0, nb = 0; const pre = [], post = [];
  for (let f = 0; f < 60 * 180; f++) { c.step(); if (f % 6 === 0) { if (f < 1800) { a += c.pc.err; na++; } if (f >= 60 * 150) { b += c.pc.err; nb++; } }
    if (f > 60 * 60 && f % (60 * 20) === 0) { const ebefore = c.pc.errSlow; let s0 = 0; for (let k = 0; k < 60; k++) { c.step(); if (k % 6 === 0) s0 += c.pc.err; } c.poke(c.body.c[3], [0, 3, 2]); let s1 = 0; for (let k = 0; k < 60; k++) { c.step(); if (k % 6 === 0) s1 += c.pc.err; } pre.push(s0 / 10); post.push(s1 / 10); f += 120; } }
  rows.push({ seed, first30: +(a / na).toFixed(3), last30: +(b / nb).toFixed(3), pokeRatio: +(post.reduce((x, y) => x + y) / pre.reduce((x, y) => x + y)).toFixed(2) }); }
  console.log(frozen ? 'PC learning OFF' : 'PC learning ON ', JSON.stringify(rows)); }
