// Pass metrics: per seed, 90 simulated seconds per condition. distance = path length of the body centre; fed = successful
// feeds; entropy = behavioural repertoire entropy (bits over 7-bit motor codes, last 60 s); upright = mean body up-vector y.
import { Creature } from '../js/sim/creature.js';
const secs = +(process.argv[2] || 90), seeds = [1, 2, 3]; const conds = (process.argv[3] || 'intact,mot,cpg,mn').split(',');
const out = {}; for (const cond of conds) { const rows = []; for (const seed of seeds) { const c = new Creature(seed); if (cond !== 'intact') for (const l of cond.split('+')) { c.lesion[l] = true; if (l === 'wm') c.wm.lesion = true; }
    let up = 0; for (let f = 0; f < secs * 60; f++) { c.step(); up += c.body.F[3].u[1]; }
    rows.push({ dist: c.stats.dist, fed: c.stats.eats + c.stats.snacks, entropy: c.entropy, states: c.states, upright: up / (secs * 60), surprise: c.wm.mse }); }
  const m = (k) => +(rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(3); out[cond] = { dist: m('dist'), fed: m('fed'), entropy: m('entropy'), states: m('states'), upright: m('upright'), wmMSE: m('surprise') }; }
console.log(JSON.stringify(out));
