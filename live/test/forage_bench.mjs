globalThis.TW = JSON.parse(process.env.TW || '{}');
// Foraging competence: per seed, N simulated seconds; counts feeds, site arrivals, 45-s give-ups and mean time-to-arrival.
import { Creature } from '../js/sim/creature.js';
const secs = +(process.argv[2] || 240), seeds = (process.argv[3] || '1,2,3,4').split(',').map(Number); const rows = [];
const les = (process.argv[4] || '').split(',').filter(Boolean); /* optional lesions, e.g. protos */
for (const seed of seeds) { const c = new Creature(seed); for (const l of les) c.lesion[l] = true; let arr = 0, gu = 0, tt = 0, up = 0, last = 0, since = null;
  for (let f = 0; f < secs * 60; f++) { const g0 = c.goal; c.step(); up += c.body.F[3].u[1]; if (g0 && g0.type === 'site' && since === null) since = g0.since;
    while (last < c.events.length || (c.events.length === 80 && last > 80)) { if (last >= c.events.length) break; const e = c.events[last++]; if (e.type === 'reward' || e.type === 'miss') { arr++; if (since !== null) tt += c.t - since; since = null; } if (e.type === 'give-up') { gu++; since = null; } }
    if (c.events.length >= 80) last = Math.min(last, 79); }
  rows.push({ seed, fed: c.stats.eats + c.stats.snacks, arrivals: arr, giveups: gu, meanArrive: arr ? +(tt / arr).toFixed(1) : null, upright: +(up / (secs * 60)).toFixed(2), dist: +c.stats.dist.toFixed(1) }); }
const s = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0); console.log(JSON.stringify(rows)); console.log('TOTAL fed', s('fed'), 'arrivals', s('arrivals'), 'giveups', s('giveups'));
