// Pass 14 brain probe. Usage: node test/brain_probe.mjs SCALE [secs] [lesion]
// Reports neuron/synapse counts, build time, ms per simulated step, region rates, and for M/L the structural-plasticity
// statistics: synapses pruned/regrown and the co-activity alignment of cortical E->E wiring (mean pre*post rate over
// existing synapses / mean rate^2; 1 = no relation between wiring and activity), measured at 30 s and at the end.
const [scale = 'M', secs = '300', les = ''] = process.argv.slice(2); globalThis.TW = { brain: scale };
const { Creature } = await import('../js/sim/creature.js'); const t0 = performance.now(); const c = new Creature(+(process.env.SEED || 1)); const tb = performance.now() - t0; if (les) c.brain.lesion[les] = true;
const B = c.brain; const al = []; let tsim = 0; const avg = (k) => { let s = 0; for (const x of k) s += x; return s / k.length; }; const win = [];
for (let f = 0; f < +secs * 60; f++) { const a = performance.now(); c.step(); tsim += performance.now() - a; if (f > 600 && f % 60 === 0) win.push(B.alignment()); if (f === 30 * 60 || f === +secs * 60 - 1) al.push(avg(win.splice(0))); }
console.log(`scale ${scale}${les ? ' lesion ' + les : ''}: neurons ${B.N} synapses ${B.S} build ${tb.toFixed(0)} ms, ${(tsim / (+secs * 60)).toFixed(2)} ms per 1/60-s step | rates CTX ${B.regionRate('CTX').toFixed(1)} HIP ${B.regionRate('HIP').toFixed(1)} THAL ${B.regionRate('THAL').toFixed(1)} MOT ${B.regionRate('MOT').toFixed(1)} | pruned+regrown ${B.grown} | alignment (10-30 s) ${al[0]?.toFixed(3)} -> (last ${secs - 30} s) ${al[1]?.toFixed(3)} | dist ${c.stats.dist.toFixed(0)}`);
