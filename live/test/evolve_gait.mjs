// Offline training of the leg-gait genome (CPG->motor-neuron wiring, CPG leg coupling, adaptation time constant, grip reflex gain)
// with a (1+lambda) evolution strategy. Fitness = net speed of the full creature (spiking MN, LTC CPG, soft body, real terrain)
// under a constant forward MOT command, minus a tilt penalty, averaged over 3 terrain seeds. Output: the best genome (copied into GAIT).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
const KEYS = { sF: [-3, 4], sB: [-3, 3], gF: [-3, 3], gB: [-3, 3], eF: [-3, 3], eB: [-3, 3], eB2: [-3, 3], cS: [-1, 3], cO: [-1, 3], rS: [-1, 3], rO: [-1, 3], wv: [0, 1.5], tauA: [0.12, 0.6], gk: [-8, 12], cf: [0.5, 3] };
if (!isMainThread) { globalThis.TW = { gait: workerData.g }; const { Creature } = await import('../js/sim/creature.js');
  let sc = 0; for (const seed of workerData.seeds) { const c = new Creature(seed); c.world.rocks = []; c.world.springs = []; c.lesion.learnMotor = true; c.forceMot = [1, 0, 0, 0, 0, 0, 0, 0];
    for (let f = 0; f < 120; f++) { c.goal = null; c.step(); } const a = c.body.com(); let up = 0; const T = 60 * 8; for (let f = 0; f < T; f++) { c.goal = null; c.race = null; c.step(); up += c.body.F[3].u[1]; } const b = c.body.com();
    sc += Math.hypot(b[0] - a[0], b[2] - a[2]) / 8 - 0.6 * Math.max(0, 0.75 - up / T); }
  parentPort.postMessage(sc / workerData.seeds.length); }
else { const { GAIT } = await import('../js/sim/creature.js'); const gens = +(process.argv[2] || 40), lam = 8, seeds = [1, 2, 3];
  const evalG = (g) => new Promise((res) => { const w = new Worker(new URL(import.meta.url), { workerData: { g, seeds } }); w.on('message', (v) => { res(v); w.terminate(); }); w.on('error', (e) => { console.error(e); res(-9); }); });
  let best = { ...GAIT }, bf = await evalG(best); let sigma = 0.35; console.log('start', bf.toFixed(3));
  for (let gen = 0; gen < gens; gen++) { const kids = []; for (let k = 0; k < lam; k++) { const g = { ...best }; for (const [key, [lo, hi]] of Object.entries(KEYS)) if (Math.random() < 0.4) g[key] = Math.min(hi, Math.max(lo, g[key] + sigma * (hi - lo) * 0.25 * (Math.random() * 2 - 1) * 1.7)); kids.push(g); }
    const fs = await Promise.all(kids.map(evalG)); let bi = -1; fs.forEach((f, i) => { if (f > bf) { bf = f; bi = i; } }); if (bi >= 0) { best = kids[bi]; sigma = Math.min(0.6, sigma * 1.15); } else sigma = Math.max(0.08, sigma * 0.9);
    console.log('gen', gen, 'best', bf.toFixed(3), 'sigma', sigma.toFixed(2), bi >= 0 ? JSON.stringify(best, (k, x) => typeof x === 'number' ? +x.toFixed(2) : x) : ''); } }
