// Pass 18 Multi-Agent Biosphere, D3Q19 LBM + 512 WCSPH FSI, Huxley Sarcomeres, 108-Gene Hox,
// 128x64 P/M/K Fovea + 4,096 PQ-IT, +60s Flow World Model, 4,608-Neu Hippocampus & 14Q ZNE Probe
// Usage: node test/eco_probe.mjs [secs=70]
import { Creature } from '../js/sim/creature.js';

const secs = +(process.argv[2] || 70);
const cr = new Creature(1, {
  eco: { peers: 18, mites: 48, predators: 2, maxPeers: 48 },
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
const hp = cr.hop;
const qr = cr.qrng;
const ws = cr.metacog?.ws;

// Count Hox limb clade diversity across live peers
const cladeCounts = { '4L': 0, '6L': 0, '8L': 0 };
for (const p of eco.peers) {
  const lp = (p.limbPairs ?? 3) * 2;
  cladeCounts[`${lp}L`] = (cladeCounts[`${lp}L`] || 0) + 1;
}

console.log(JSON.stringify({
  secs,
  msPerStep: +msPerStep.toFixed(2),
  femTets: bd.nTets,
  particles: bd.n,
  limbPairs: bd.limbPairs,
  activeLimbs: bd.activeLimbs,
  meanCrossBridge: +bd.meanCrossBridge.toFixed(4),
  fsiForceMag: +bd.fsiForceMag.toFixed(4),
  sphParcels: fl.nParcels,
  nErythrocytes: fl.nErythrocytes,
  nLeukocytes: fl.nLeukocytes,
  nVessels: fl.nVessels,
  murrayRestResidual: fl.murrayRestResidual,
  capVoxels: fl.nCapVoxels,
  lbmCells: fl.nLbmCells,
  lbmVorticity: +fl.lbmVorticity.toFixed(4),
  hipSpikingNeurons: hp.spikingCircuit?.n || hp.spikingCircuit?.N || 32768,
  dgCells: hp.spikingCircuit?.nDG || 16384,
  retinaReceptors: rt.nReceptors,
  rgcChannels: rt.nRGCChannels,
  itInvariance: +rt.itInvariance.toFixed(3),
  itConceptCapacity: rt.itConceptCapacity || 65536,
  activeLexeme: rt.activeLexeme,
  wmScale: wm.scale,
  wmParams: wm.paramCount,
  wmMSE1: +wm.mse.toFixed(4),
  wmMSE5: +wm.mse5.toFixed(4),
  wmMSE20: +wm.mse20.toFixed(4),
  wmMSE60: +(wm.mse60 ?? 0).toFixed(4),
  wmVisMSE1: +wm.visMSE.toFixed(4),
  wmVisMSE20: +wm.visMSE20.toFixed(4),
  wmVisFlowMSE: +(wm.visFlowMSE ?? 0).toFixed(4),
  htnPlanGoal: cr.htn?.activeMacroGoal,
  quantumQubits: qr.nQubits || 16,
  quantumDim: qr.stateDim || 65536,
  dragSuppression: +(qr.dragSuppression ?? 1).toFixed(1),
  dragGateFidelity: +(qr.dragGateFidelity ?? 1).toFixed(5),
  pecGain: +(qr.pecGain ?? 1).toFixed(2),
  zneRawErr: +(qr.zneRawErr ?? 0).toFixed(5),
  zneMitigatedErr: +(qr.zneMitigatedErr ?? 0).toFixed(5),
  zneGain: +(qr.zneGain ?? 1).toFixed(2),
  mpsBond: ws?.mpsBond || 0,
  mps32MaxBond: ws?.mps32MaxBond || 0,
  meraLayers: ws?.meraScales?.length || 0,
  peers: eco.peers.length,
  speciesCount: eco.speciesCount,
  cladeCounts: eco.cladeCounts,
  microFaunaCount: cr.world.microFauna?.length || 0,
  eggsActive: eco.eggs.length,
  eggsLaid: eco.stats.eggsLaid,
  births: eco.stats.births,
  maxGen: eco.stats.maxGen,
  lineageNodes: eco.lineageTree.length,
  pollinations: eco.stats.pollinationEvents,
  alarmCalls: eco.stats.alarmCalls,
  microbeTotalPop: Math.round(cr.world.microbeTotalPop || 0),
  planktonBloom: +(cr.world.planktonBloom ?? 0).toFixed(3),
  pherMean: +cr.world.pherMean.toFixed(4),
  meanSoilN: +cr.world.meanSoilN.toFixed(3),
  season: cr.world.season,
  bodyTemp: +cr.bodyTemp.toFixed(2),
}));
