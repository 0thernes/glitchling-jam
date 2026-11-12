// Pass 15 cost budget: ms per 60 Hz creature step with the e-means layers on vs lesioned, and the time of one
// ProtoLayers.step (10 Hz) on its own. Usage: node test/emeans_cost.mjs [seed]
const seed = +(process.argv[2] || 1); const { Creature } = await import('../js/sim/creature.js');
const run = (les) => { const c = new Creature(seed); if (les) c.lesion.protos = true; for (let f = 0; f < 60 * 30; f++) c.step(); const t0 = performance.now(); for (let f = 0; f < 60 * 60; f++) c.step(); return [(performance.now() - t0) / 3600, c]; };
const out = {}; for (let rep = 0; rep < 2; rep++) for (const les of [false, true]) { const [ms] = run(les); (out[les ? 'lesioned' : 'intact'] ||= []).push(+ms.toFixed(3)); }
const [, c] = run(false); const N = 2000, t0 = performance.now(); for (let i = 0; i < N; i++) c.protos.step(c); const per = (performance.now() - t0) / N;
console.log(JSON.stringify({ seed, msPerStep: out, protosStepMs: +per.toFixed(4), protosMsPerSimSecond: +(per * 10).toFixed(3) }));
