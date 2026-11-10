// Motor babbling probe: per seed, the turn gain measured during the first 12 s (rad/s per unit turn command), the scale
// applied to the bearing->turn weights, and (optional) the same body's turn gain with the steering scale applied.
// Usage: node test/babble_probe.mjs [seeds]
const seeds = (process.argv[2] || '1,2,3,4,5,6,7,8').split(',').map(Number); const { Creature } = await import('../js/sim/creature.js');
const rows = []; for (const seed of seeds) { const c = new Creature(seed); for (let f = 0; f < 60 * 13; f++) c.step(); rows.push({ seed, gain: +(c.turnGain ?? NaN).toFixed(2), scale: +(c.babbleScale ?? NaN).toFixed(2) }); }
const g = rows.map((r) => r.gain); const m = g.reduce((a, b) => a + b, 0) / g.length; console.log('babble', JSON.stringify(rows), 'mean gain', m.toFixed(2), 'cv', (Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length) / m).toFixed(2));
