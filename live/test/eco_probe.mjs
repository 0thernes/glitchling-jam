// Pass 17 Multi-Agent Biosphere, Two-Way FSI, Multimodal +2.0s World Model & MEGA Brain Probe
// Usage: node test/eco_probe.mjs [secs=70]
import { Creature } from '../js/sim/creature.js';

const secs = +(process.argv[2] || 70);
const cr = new Creature(1, {
  eco: { peers: 6, mites: 28, predators: 1, maxPeers: 14 },
  wmScale: process.env.WM_SCALE || 'std',
});

// Lay an initial fertilized egg near a hydrothermal vent to verify thermal incubation & hatching
const v0 = cr.world.vents[0];
if (v0 && cr.eco.peers.length >= 2) {
  cr.eco.layEgg(v0.x + 0.6, v0.z + 0.6, cr.gen, cr.eco.peers[0].gen, 0, cr.eco.peers[0].id, 1, true);
}

const t0 = performance.now();
for (let f = 0; f < secs * 60; f++) {
  cr.step();
}
const msPerStep = (performance.now() - t0) / (secs * 60);

const eco = cr.eco;
const wm = cr.wm;
const fl = cr.fluid;
const bd = cr.body;
const rt = cr.retina;

console.log(JSON.stringify({
  secs,
  msPerStep: +msPerStep.toFixed(2),
  femTets: bd.nTets,
  particles: bd.n,
  fsiForceMag: +bd.fsiForceMag.toFixed(4),
  sphParcels: fl.nParcels,
  capVoxels: fl.nCapVoxels,
  retinaReceptors: rt.nReceptors,
  itInvariance: +rt.itInvariance.toFixed(3),
  wmParams: wm.paramCount,
  wmMSE1: +wm.mse.toFixed(4),
  wmMSE5: +wm.mse5.toFixed(4),
  wmMSE20: +wm.mse20.toFixed(4),
  wmVisMSE1: +wm.visMSE.toFixed(4),
  wmVisMSE20: +wm.visMSE20.toFixed(4),
  peers: eco.peers.length,
  eggsActive: eco.eggs.length,
  eggsLaid: eco.stats.eggsLaid,
  births: eco.stats.births,
  maxGen: eco.stats.maxGen,
  lineageNodes: eco.lineageTree.length,
  pollinations: eco.stats.pollinationEvents,
  alarmCalls: eco.stats.alarmCalls,
  pherMean: +cr.world.pherMean.toFixed(4),
  meanSoilN: +cr.world.meanSoilN.toFixed(3),
  season: cr.world.season,
  bodyTemp: +cr.bodyTemp.toFixed(2),
}));
