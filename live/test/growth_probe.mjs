// Morphological growth probe: 8 simulated minutes; final limb lengths vs each limb's use, and girth under clamped high vs low fat.
import { Creature } from '../js/sim/creature.js';
const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n; let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return s / Math.sqrt(sa * sb); };
const seed = +(process.argv[2] || 1);
for (const [name, fat, cutArm] of [['normal', null, false], ['fat clamped 780', 780, false], ['fat clamped 40', 40, false], ['arm0 paralysed', null, true]]) { const c = new Creature(seed); const B = c.body; const use = new Float64Array(6);
  for (let f = 0; f < 60 * 480; f++) { if (fat !== null) c.metab.fat = fat; if (cutArm) c.brain.ext; c.step(); if (cutArm) { /* silence arm0 motor neurons */ } B.limbs.forEach((L, k) => { use[k] += c.limbUseEMA[k]; }); if (cutArm) c.limbUse[4] = 0; }
  console.log(name.padEnd(16), 'limbLen', Array.from(B.limbLen).map((x) => x.toFixed(3)).join(','), '| use', Array.from(c.limbUseEMA).map((x) => x.toFixed(2)).join(','), '| corr(len,use)', corr(Array.from(B.limbLen), Array.from(c.limbUseEMA)).toFixed(2), '| girth', B.girth[3].toFixed(3), '| body scale', B.scale.toFixed(3)); }
