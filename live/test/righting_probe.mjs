// Flip the body onto its back (rotate all particles 180 deg about the body's long axis) and measure the time until it is upright again.
import { Creature } from '../js/sim/creature.js';
const mode = process.argv[2] || 'intact'; const res = [];
for (const seed of [1, 2, 3, 4, 5]) for (const trial of [0, 1]) { const c = new Creature(seed); c.world.rocks = []; c.world.springs = []; if (mode !== 'intact') c.lesion[mode] = true;
  for (let f = 0; f < 120 + trial * 200; f++) c.step();
  const B = c.body, com = B.com(); const f = B.F[3].f; const ax = [f[0], 0, f[2]]; const n = Math.hypot(ax[0], ax[2]); ax[0] /= n; ax[2] /= n;
  const rot = (X, Y, Z) => { const dx = X - com[0], dy = Y - com[1], dz = Z - com[2]; const along = dx * ax[0] + dz * ax[2]; const px = dx - along * ax[0], pz = dz - along * ax[2]; return [com[0] + along * ax[0] - px, com[1] - dy + 0.4, com[2] + along * ax[2] - pz]; };
  for (let i = 0; i < B.n; i++) { let [x, y, z] = rot(B.x[i], B.y[i], B.z[i]); B.x[i] = x; B.y[i] = y; B.z[i] = z; [x, y, z] = rot(B.ox[i], B.oy[i], B.oz[i]); B.ox[i] = x; B.oy[i] = y; B.oz[i] = z; }
  let tUp = null; for (let k = 0; k < 60 * 20; k++) { c.step(); if (tUp === null && k > 30 && B.F[3].u[1] > 0.6) { let ok = true; for (let j = 0; j < 20 && ok; j++) { c.step(); k++; if (B.F[3].u[1] < 0.5) ok = false; } if (ok) tUp = k / 60; } }
  res.push(tUp === null ? 20 : +tUp.toFixed(1)); }
const med = [...res].sort((a, b) => a - b)[Math.floor(res.length / 2)]; console.log(mode, 'time-to-upright s (20 = never):', JSON.stringify(res), 'median', med, 'righted', res.filter((x) => x < 20).length + '/' + res.length);
