// Pass 8 probe. (a) thirst/drinking, 300 s (argv[5]), seeds 1-4 (argv[4]), intact vs thirst behaviour lesioned: mean thirst, water drunk.
// (b) cephalic-phase insulin: same sugar meal, food in view for 20 ticks before and 30 during; peak blood glucose, link on vs off.
import { Creature } from '../js/sim/creature.js';
const part = process.argv[2] || 'a';
if (part === 'a') for (const les of (process.argv[3] || 'none,thirst').split(',')) { const rows = []; for (const seed of (process.argv[4] || '1,2,3,4').split(',').map(Number)) { const c = new Creature(seed); if (les !== 'none') c.lesion[les] = true; let th = 0, n = 0, bouts = 0, was = 0;
  for (let f = 0; f < 60 * +(process.argv[5] || 300); f++) { c.step(); if (c.drinking && !was) bouts++; was = c.drinking; if (f % 60 === 0) { th += c.metab.thirst; n++; } } rows.push([+(th / n).toFixed(2), +(c.stats.drinks || 0).toFixed(1), bouts]); }
  console.log(les.padEnd(8), 'per seed [mean thirst, water drunk, drink bouts]:', JSON.stringify(rows)); }
if (part === 'b') for (const ceph of [true, false]) { const peaks = []; for (const seed of [1, 2, 3]) { const c = new Creature(seed); c.lesion.cephalic = !ceph; for (let f = 0; f < 600; f++) c.step(); c.world.snacks.length = 0;
  const hd = c.body.head(); c.world.snacks.push({ id: 999, x: hd[0] + 1.5, y: hd[1] + 5, z: hd[2], kind: 'sugar' }); for (let k = 0; k < 20; k++) c.minute(); c.metab.eat('sugar', 2); /* the food stays in view while it is eaten (taste/smell) */
  let pk = 0; for (let k = 0; k < 120; k++) { c.minute(); if (k === 30) c.world.snacks.length = 0; pk = Math.max(pk, c.metab.blood.glc); } peaks.push(+pk.toFixed(2)); }
  console.log('cephalic insulin ' + (ceph ? 'ON ' : 'OFF') + ': peak blood glucose after the meal', JSON.stringify(peaks)); }
