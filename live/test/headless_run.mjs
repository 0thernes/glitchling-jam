import { Creature } from '../js/sim/creature.js';
const secs = +(process.argv[2] || 60), lesion = process.argv[3] || '';
const c = new Creature(+(process.argv[4] || 3)); for (const l of lesion.split(',').filter(Boolean)) c.lesion[l] = true;
const t0 = performance.now(); const c0 = c.body.com();
for (let f = 0; f < secs * 60; f++) { c.step(); if (f % 600 === 0) { const com = c.body.com(); console.log(`t=${(f / 60).toFixed(0)}s com=${com.map((v) => v.toFixed(1))} dist=${c.stats.dist.toFixed(1)} goal=${c.goal ? c.goal.type + (c.goal.k ?? '') : '-'} d=${(c.dist || 0).toFixed(1)} bear=${(c.bear || 0).toFixed(2)} mot=${[...c.motRate].map((v) => v.toFixed(2))} H=${c.entropy.toFixed(2)} stage=${c.sleep.stage} eats=${c.stats.eats} snacks=${c.stats.snacks} tries=${c.stats.tries} spk=${c.brain.spikes}`); } }
const ms = (performance.now() - t0) / (secs * 60); console.log('ms/frame', ms.toFixed(2), 'distance', c.stats.dist.toFixed(2), 'entropy', c.entropy.toFixed(2), JSON.stringify(c.stats));
