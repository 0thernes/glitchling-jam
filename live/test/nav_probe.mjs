// Pass 13 navigation probe. Per seed: one NEAR goal (a feeding site 4-8 units from the head) and one FAR goal (>= 14 units),
// each held as the current goal for up to 60 s (rocks and springs left in place). Counts arrivals (head within 1.3 units),
// time to arrive, upright fraction, and how much of the trip was steered by path integration (goal beyond view range).
// Usage: node test/nav_probe.mjs [seeds] [lesion|omni]
const seeds = (process.argv[2] || '1,2,3,4,5,6,7,8').split(',').map(Number), mode = process.argv[3] || '';
globalThis.TW = { ...(JSON.parse(process.env.TW || '{}')), ...(mode === 'omni' ? { omni: true } : {}) };
const { Creature } = await import('../js/sim/creature.js'); const res = { near: [], far: [] }; let up = 0, upN = 0, pi = 0, piN = 0;
for (const seed of seeds) for (const kind of ['near', 'far']) { const c = new Creature(seed); if (mode && mode !== 'omni') c.lesion[mode] = true; for (let f = 0; f < 60 * 13; f++) c.step();
  const hd = c.body.head(); const P = c.world.plants.map((p) => ({ k: p.k, d: Math.hypot(p.x - hd[0], p.z - hd[2]) })).filter((q) => (kind === 'near' ? q.d >= 4 && q.d <= 8 : q.d >= 14)).sort((a, b) => a.d - b.d);
  if (!P.length) continue; const k = P[0].k, pl = c.world.plants[k]; let t = null;
  for (let f = 0; f < 60 * 60; f++) { if (!c.goal || c.goal.k !== k) { c.goal = { type: 'site', k, chosen: k, since: c.t }; c.race = null; } c.step(); up += c.body.F[3].u[1]; upN++; if (c.navMode === 'path-integration') pi++; piN++;
    const h = c.body.head(); if (Math.hypot(pl.x - h[0], pl.z - h[2]) < 1.3) { t = f / 60; break; } }
  res[kind].push({ seed, d: +P[0].d.toFixed(1), t: t === null ? null : +t.toFixed(1) }); }
const sum = (a) => `${a.filter((x) => x.t !== null).length}/${a.length} arrived, mean time ${(a.filter((x) => x.t !== null).reduce((s, x) => s + x.t, 0) / Math.max(1, a.filter((x) => x.t !== null).length)).toFixed(1)} s`;
console.log(`nav ${mode || 'intact'} seeds ${seeds.join(',')}: NEAR ${sum(res.near)} | FAR ${sum(res.far)} | upright ${(up / upN).toFixed(2)} | steps steered by path integration ${(100 * pi / piN).toFixed(0)}%`);
console.log(JSON.stringify(res));
