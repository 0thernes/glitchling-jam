// Fitness of a motor genome (used by evolve_genome.mjs; also runnable alone: node test/genome_eval.mjs hand|starter [seeds]).
import { evalGenome } from '../js/sim/fitness.js';
export { evalGenome };
if (process.argv[1] && process.argv[1].endsWith('genome_eval.mjs')) { const { HAND } = await import('../js/sim/genome.js'); const { STARTER } = await import('../js/sim/starter_genome.js'); const which = process.argv[2] || 'hand';
  const g = which === 'hand' ? HAND : which === 'starter' ? STARTER : JSON.parse(which); const seeds = (process.argv[3] || '1,2').split(',').map(Number); const r = evalGenome(g, seeds);
  console.log(which.slice(0, 20), 'seeds', seeds.join(','), Object.entries(r).map(([k, v]) => `${k} ${v.toFixed(3)}`).join('  ')); }
