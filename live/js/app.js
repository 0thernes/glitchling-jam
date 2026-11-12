import { Creature, DEFAULT_FLAWS, MOT_NAMES, CLOCK_MODES } from './sim/creature.js';
import { STARTER } from './sim/starter_genome.js';
import { REGIONS, R0, RN, NNEU, BRAIN_SCALE, NSTR_OPT } from './sim/brain.js';
import { STAGES } from './sim/mind.js';
import { NBINS, W_RET, H_RET, W_V1, H_V1, N_ORI } from './sim/vision.js';
import { REAL, SIMPLIFIED } from './honesty.js';
import { BioAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let seed = +(Q.get('seed') || 1) || 1;
$('seed').value = seed;
let clockMode = CLOCK_MODES[Q.get('clock')] ? Q.get('clock') : 'realtime';
let wmScale = ['std', 'large', 'xl', 'ultra', 'titan', 'omega'].includes(Q.get('wm')) ? Q.get('wm') : 'std';
let cameraMode = ['orbit', 'pov', 'director', 'overhead'].includes(Q.get('cam')) ? Q.get('cam') : 'orbit';
let lightingMode = ['auto', 'twilight', 'pandora', 'day'].includes(Q.get('light')) ? Q.get('light') : 'auto';

const CLADE_PRESETS = {
  '0L': { limbTopo: 0.05, decapodBud: 0.30, undulWave: 1.55, patagiumSpan: 0.08, anglerLure: 0.45, pigmentHue: 0.44, osteoderm: 0.62 },
  '4L': { limbTopo: 0.24, decapodBud: 0.50, undulWave: 0.92, patagiumSpan: 0.14, anglerLure: 0.28, pigmentHue: 0.10, osteoderm: 0.52 },
  '6L': { limbTopo: 0.50, decapodBud: 0.50, undulWave: 1.00, patagiumSpan: 1.25, anglerLure: 1.25, pigmentHue: 0.56, osteoderm: 0.45 },
  '8L': { limbTopo: 0.76, decapodBud: 0.50, undulWave: 1.05, patagiumSpan: 0.34, anglerLure: 0.78, pigmentHue: 0.78, osteoderm: 0.68 },
  '10L': { limbTopo: 0.94, decapodBud: 0.92, undulWave: 1.12, patagiumSpan: 0.58, anglerLure: 0.98, pigmentHue: 0.88, osteoderm: 0.74 },
};
let activeCladeOverride = CLADE_PRESETS[Q.get('clade')] ? Q.get('clade') : null;

const flaws = JSON.parse(JSON.stringify(DEFAULT_FLAWS));
for (const k of (Q.get('flaws') || '').split(',').filter(Boolean)) if (flaws[k]) flaws[k].on = true;

const LIN_KEY = 'glv2.genome';
const LIN_STACK_KEY = 'glv2.genomeStack';
let lineageInfo = null;
let lineageStack = [];
try {
  const sv = JSON.parse(localStorage.getItem(LIN_KEY) || 'null');
  if (sv && sv.genome) {
    globalThis.TW = { ...(globalThis.TW || {}), genome: sv.genome };
    lineageInfo = sv;
  }
  lineageStack = JSON.parse(localStorage.getItem(LIN_STACK_KEY) || '[]') || [];
} catch (e) { /* storage blocked */ }
if (activeCladeOverride) {
  globalThis.TW = { ...(globalThis.TW || {}), genome: { ...STARTER, ...(globalThis.TW?.genome || {}), ...CLADE_PRESETS[activeCladeOverride] } };
}

function currentEcoOpts() {
  if (Q.get('eco') === '0') return null;
  const peers = $('eco-peers') ? +$('eco-peers').value : +(Q.get('peers') ?? 10);
  const mites = $('eco-mites') ? +$('eco-mites').value : 36;
  const predators = $('eco-preds') ? +$('eco-preds').value : 1;
  return { peers, mites, predators, maxPeers: 48 };
}

let cr = new Creature(seed, { flaws, clockMode, wmScale, eco: currentEcoOpts() });
cr.qrng.initWebGPU18Q?.().catch(() => {});

let view = null;
let p5Layer = null;
let View, P5Layer;
const audio = new BioAudio();
const coarse = matchMedia('(pointer: coarse)').matches;
const rawQ = Q.get('q') || 'auto';
let qMode = rawQ === '4k' || rawQ === 'uhd' ? '4' : rawQ;
const initQuality = qMode === 'auto' ? (coarse ? 1 : 3) : +qMode;

try {
  [{ View }, { P5Layer }] = await Promise.all([
    import('./render.js'),
    import('./p5_layer.js'),
  ]);
  p5Layer = new P5Layer($('p5-studio'));
  const initP5Mode = Q.get('p5') || (innerWidth < 720 ? 'off' : 'pip');
  p5Layer.setMode(['pip', 'split', 'off'].includes(initP5Mode) ? initP5Mode : 'pip');
  if (Q.get('p5tab') !== null) p5Layer.setView(+Q.get('p5tab') || 0);
  view = new View($('gl'), cr, { reduced, quality: initQuality, p5Layer, cameraMode, lightingMode });
  view.setCameraMode(cameraMode);
  view.setLightingMode(lightingMode);
} catch (e) {
  console.error(e);
  $('glfail').hidden = false;
}

window.glitch = {
  get cr() { return cr; },
  get view() { return view; },
  get p5() { return p5Layer; },
  get audio() { return audio; },
  stats: { fps: 0, frames: 0, quality: initQuality, simMs: 0, renderMs: 0, uptime: 0 },
};

let speed = +(Q.get('speed') || 1);
$('speed').value = String(speed);
let paused = false, tool = 'orbit';
$('quality').value = ['auto', '0', '1', '2', '3', '4'].includes(qMode) ? qMode : 'auto';
if ($('brain-scale')) $('brain-scale').value = BRAIN_SCALE;
if ($('clock-mode')) $('clock-mode').value = clockMode;
if ($('wm-scale')) $('wm-scale').value = wmScale;
if ($('cam-mode')) $('cam-mode').value = cameraMode;
if ($('light-mode')) $('light-mode').value = lightingMode;

const CAM_LABELS = { orbit: 'Orbit', pov: 'POV', director: 'Cinema', overhead: 'Map' };
const CAM_ORDER = ['orbit', 'pov', 'director', 'overhead'];
function applyCameraMode(mode) {
  cameraMode = CAM_ORDER.includes(mode) ? mode : 'orbit';
  if (view) {
    view.setCameraMode(cameraMode);
    if (tool !== 'orbit' && (cameraMode === 'orbit' || cameraMode === 'overhead')) {
      view.controls.enabled = false;
    }
  }
  if ($('cam-mode')) $('cam-mode').value = cameraMode;
  if ($('cam-lbl')) $('cam-lbl').textContent = CAM_LABELS[cameraMode] || 'Orbit';
}
applyCameraMode(cameraMode);

const LIGHT_LABELS = { auto: 'Auto', twilight: 'Dusk', pandora: 'Night', day: 'Day' };
const LIGHT_ORDER = ['auto', 'twilight', 'pandora', 'day'];
function applyLightingMode(mode) {
  lightingMode = LIGHT_ORDER.includes(mode) ? mode : 'auto';
  if (view) view.setLightingMode(lightingMode);
  if ($('light-mode')) $('light-mode').value = lightingMode;
  if ($('light-lbl')) $('light-lbl').textContent = LIGHT_LABELS[lightingMode] || 'Auto';
  if ($('light-btn')) $('light-btn').classList.toggle('on', lightingMode !== 'auto');
}
applyLightingMode(lightingMode);

function syncCladeButtons() {
  const cur = `${cr.body.activeLimbs}L`;
  document.querySelectorAll('[data-clade]').forEach((b) => {
    b.classList.toggle('on', b.dataset.clade === cur);
  });
}
syncCladeButtons();

const qMax = coarse ? 2 : 3;
const qAutoFloor = coarse ? 0 : 2;
if (view) {
  view.setQuality(initQuality);
  addEventListener('resize', () => view.resize());
}

// ---------------------------------------------------------------- O(1) region lookup & overflow-safe raster bucketing (up to 14.16M GIGA)
const raster = $('raster'), rctx = raster.getContext('2d');
const regionColors = REGIONS.map((_, ri) => `hsl(${(ri / REGIONS.length) * 360},90%,62%)`);
const rasterRowBucket = new Int8Array(raster.height);
rasterRowBucket.fill(-1);

function regionIndexOf(ni) {
  for (let r = REGIONS.length - 1; r >= 0; r--) {
    if (ni >= R0[REGIONS[r][0]]) return r;
  }
  return 0;
}

function markNeuronSpikeOnRaster(ni) {
  const row = Math.min(raster.height - 1, Math.max(0, Math.floor((ni * raster.height) / NNEU)));
  rasterRowBucket[row] = regionIndexOf(ni);
}

function accumulateStepSpikes(b) {
  if (NNEU <= 120000 && !b.delegated) {
    for (let i = 0; i < NNEU; i++) {
      if (b.spk[i]) markNeuronSpikeOnRaster(i);
    }
    return;
  }
  // Subcortical populations always step locally (< 350 neurons)
  for (let i = 0; i < R0.THAL; i++) if (b.spk[i]) markNeuronSpikeOnRaster(i);
  for (let i = R0.STR; i < NNEU; i++) if (b.spk[i]) markNeuronSpikeOnRaster(i);
  if (!b.delegated) {
    if (b.gigaMode && b.prevSheetSpk) {
      const nSpk = b.prevSheetSpkCount || 0;
      for (let k = 0; k < nSpk; k++) markNeuronSpikeOnRaster(R0.THAL + b.prevSheetSpk[k]);
    } else {
      const stride = Math.max(1, Math.floor((R0.STR - R0.THAL) / 8192));
      for (let i = R0.THAL; i < R0.STR; i += stride) {
        if (b.spk[i]) markNeuronSpikeOnRaster(i);
      }
    }
  }
}

// ---------------------------------------------------------------- optional Web Worker / WebGPU brain accelerators
let backendMode = Q.get('backend') || 'auto';
let brainWorker = null, workerPending = false, lastWorkerT = 0, gpuBrain = null;
if ($('brain-backend')) $('brain-backend').value = backendMode;

async function setupBackend(mode) {
  backendMode = mode;
  const effMode = mode === 'auto' ? (BRAIN_SCALE === 'S' || BRAIN_SCALE === 'M' ? 'cpu' : 'worker') : mode;
  if (brainWorker) { brainWorker.terminate(); brainWorker = null; workerPending = false; }
  if (gpuBrain) { gpuBrain.destroy(); gpuBrain = null; }
  cr.brain.backend = 'CPU-TypedCSR';
  cr.brain.delegated = false;
  const st = $('backend-status');
  if (effMode === 'cpu') {
    if (st) st.textContent = mode === 'auto' ? 'auto -> CPU' : 'active';
    return;
  }
  if (effMode === 'worker') {
    try {
      const w = new Worker(new URL('./sim/brain_worker.js', import.meta.url), { type: 'module' });
      await new Promise((res, rej) => {
        const onMsg = (e) => {
          if (e.data?.op === 'ready') { w.removeEventListener('message', onMsg); res(e.data); }
        };
        w.addEventListener('message', onMsg);
        w.onerror = (err) => rej(err);
        w.postMessage({ op: 'init', seed, scale: BRAIN_SCALE, gen: cr.gen });
      });
      w.onerror = (err) => console.error('brainWorker error:', err.message || err);
      w.onmessage = (e) => {
        if (e.data?.op === 'stepped') {
          workerPending = false;
          const d = e.data;
          if (d.rate && d.spk) {
            const sh0 = R0.THAL, sh1 = R0.STR;
            const stride = Math.max(1, Math.floor((sh1 - sh0) / 8192));
            for (let i = sh0; i < sh1 && i < d.rate.length; i++) {
              cr.brain.rate[i] = d.rate[i];
              cr.brain.spk[i] = d.spk[i];
            }
            for (let i = sh0; i < sh1 && i < d.spk.length; i += stride) {
              if (d.spk[i]) markNeuronSpikeOnRaster(i);
            }
          }
          if (d.subRateL) cr.brain.rate.set(d.subRateL, 0);
          if (d.subRateR) cr.brain.rate.set(d.subRateR, R0.STR);
          if (d.spkIdx) {
            const nS = Math.min(d.spkIdx.length, cr.brain.prevSheetSpk ? cr.brain.prevSheetSpk.length : 0);
            if (nS > 0) {
              cr.brain.prevSheetSpk.set(d.spkIdx.subarray(0, nS));
              cr.brain.prevSheetSpkCount = nS;
            }
            for (let k = 0; k < d.spkIdx.length; k++) {
              markNeuronSpikeOnRaster(R0.THAL + d.spkIdx[k]);
            }
          }
          if (d.regRate) for (let k = 1; k <= 3; k++) { cr.brain.regRate[k] = d.regRate[k]; cr.brain.astro[k] = d.astro[k]; }
          cr.brain.spikes = d.spikes;
          cr.brain.stdpEvents = d.stdpEvents;
          cr.brain.grown = d.grown;
          cr.brain.pruned = d.pruned;
          cr.brain.plateauBursts = d.plateauBursts ?? cr.brain.plateauBursts;
          cr.brain.nmdaSpikes = d.nmdaSpikes ?? cr.brain.nmdaSpikes;
          cr.brain.ihMean = d.ihMean ?? cr.brain.ihMean;
          cr.brain.skMean = d.skMean ?? cr.brain.skMean;
          cr.brain.channelNoiseMean = d.channelNoiseMean ?? cr.brain.channelNoiseMean;
          cr.brain.dwLast = d.dwLast;
        }
      };
      workerPending = false;
      lastWorkerT = cr.t;
      brainWorker = w;
      cr.brain.delegated = true;
      cr.brain.backend = 'WebWorker-CSR';
      if (st) st.textContent = mode === 'auto' ? 'auto -> Web Worker' : 'Web Worker active';
    } catch (err) {
      brainWorker = null;
      cr.brain.delegated = false;
      cr.brain.backend = 'CPU-TypedCSR (worker fallback)';
      if (st) st.textContent = 'fallback to CPU';
    }
    return;
  }
  if (effMode === 'webgpu') {
    try {
      const { WebGPUBrain } = await import('./sim/webgpu_brain.js');
      gpuBrain = await WebGPUBrain.create(cr.brain);
      if (gpuBrain) {
        cr.brain.delegated = true;
        cr.brain.backend = 'WebGPU-WGSL';
        if (st) st.textContent = 'WebGPU WGSL active';
      } else {
        cr.brain.delegated = false;
        cr.brain.backend = 'CPU-TypedCSR (no WebGPU adapter)';
        if (st) st.textContent = 'no WebGPU adapter -> CPU';
      }
    } catch (err) {
      gpuBrain = null;
      cr.brain.delegated = false;
      cr.brain.backend = 'CPU-TypedCSR (WebGPU fallback)';
      if (st) st.textContent = 'WebGPU fallback -> CPU';
    }
  }
}
setupBackend(backendMode);

if ($('brain-scale')) {
  $('brain-scale').onchange = () => {
    const u = new URL(location.href);
    u.searchParams.set('brain', $('brain-scale').value);
    u.searchParams.delete('auto');
    location.href = u.href;
  };
}
if ($('brain-backend')) {
  $('brain-backend').onchange = () => {
    const m = $('brain-backend').value;
    setupBackend(m);
    urlSync();
  };
}

// ---------------------------------------------------------------- honesty lists
$('real-list').innerHTML = REAL.map((x) => `<li>${x}</li>`).join('');
$('simp-list').innerHTML = SIMPLIFIED.map((x) => `<li>${x}</li>`).join('');

// ---------------------------------------------------------------- tools & studio / camera / 4K / audio buttons
document.querySelectorAll('.tools [data-tool]').forEach((b) =>
  b.addEventListener('click', () => {
    tool = b.dataset.tool;
    document.querySelectorAll('.tools [data-tool]').forEach((x) => x.classList.toggle('on', x === b));
    if (view) view.controls.enabled = tool === 'orbit' && (cameraMode === 'orbit' || cameraMode === 'overhead');
  })
);
if ($('cam-btn')) {
  $('cam-btn').addEventListener('click', () => {
    const nxt = CAM_ORDER[(CAM_ORDER.indexOf(cameraMode) + 1) % CAM_ORDER.length];
    applyCameraMode(nxt);
    urlSync();
  });
}
if ($('cam-mode')) {
  $('cam-mode').onchange = () => {
    applyCameraMode($('cam-mode').value);
    urlSync();
  };
}
if ($('light-btn')) {
  $('light-btn').addEventListener('click', () => {
    const nxt = LIGHT_ORDER[(LIGHT_ORDER.indexOf(lightingMode) + 1) % LIGHT_ORDER.length];
    applyLightingMode(nxt);
    urlSync();
  });
}
if ($('light-mode')) {
  $('light-mode').onchange = () => {
    applyLightingMode($('light-mode').value);
    urlSync();
  };
}
document.querySelectorAll('[data-clade]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const clade = btn.dataset.clade;
    const preset = CLADE_PRESETS[clade];
    if (!preset) return;
    activeCladeOverride = clade;
    globalThis.TW = { ...(globalThis.TW || {}), genome: { ...STARTER, ...preset } };
    restart();
    cr.ev('evo-devo', `morphed focal 128-gene zygote into ${clade} (${cr.body.hox?.cladeName || clade}, ${cr.body.n} nodes, ${cr.body.nTets} tets)`);
  });
});
if ($('p5-btn')) {
  $('p5-btn').classList.toggle('on', p5Layer?.mode !== 'off');
  $('p5-btn').addEventListener('click', () => {
    if (!p5Layer) return;
    const m = p5Layer.cycleMode();
    $('p5-btn').classList.toggle('on', m !== 'off');
  });
}
if ($('audio-btn')) {
  $('audio-btn').addEventListener('click', () => {
    const on = audio.toggle();
    $('audio-btn').firstChild.textContent = on ? '🔊' : '🔇';
    $('audio-btn').classList.toggle('on', on);
  });
}
if ($('snap4k-btn')) {
  $('snap4k-btn').addEventListener('click', () => {
    if (view) view.capture4KPNG();
  });
}
$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').firstChild.textContent = paused ? '▶' : '⏸';
});
addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); $('pause').click(); }
  else if (e.code === 'KeyC') $('cam-btn')?.click();
  else if (e.code === 'KeyL') $('light-btn')?.click();
  else if (e.code === 'KeyP') $('p5-btn')?.click();
  else if (e.code === 'KeyM') $('audio-btn')?.click();
  else if (p5Layer && p5Layer.mode !== 'off' && /^Digit[1-5]$/.test(e.code)) {
    p5Layer.setView(+e.code.slice(5) - 1);
  }
});
$('panel-btn').addEventListener('click', () => {
  const p = $('panel');
  p.hidden = !p.hidden;
  $('panel-btn').setAttribute('aria-expanded', String(!p.hidden));
});
document.querySelectorAll('.tabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
  })
);
$('gl').addEventListener('pointerdown', (e) => {
  if (!view || tool === 'orbit') return;
  const r = $('gl').getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
  const hit = view.pick(nx, ny);
  if (tool === 'poke') {
    if (hit.particle >= 0) {
      cr.poke(hit.particle, [hit.dir.x, Math.abs(hit.dir.y) + 0.3, hit.dir.z]);
      view.skinU.glitch.value = 1;
    }
    return;
  }
  if (!hit.point) return;
  const { x, z } = hit.point;
  if (tool === 'food') cr.world.dropSnack(x, z);
  else if (tool === 'rock') cr.world.addRock(x, z, 0.8 + Math.random() * 1.2);
  else if (tool === 'spring') cr.world.addSpring(x, z);
  else if (tool === 'vent') cr.world.addVent(x, z);
});

// ---------------------------------------------------------------- Ecology tab controls
function syncEcoSliders() {
  if (!cr.eco) return;
  const peers = +($('eco-peers')?.value ?? 10);
  const mites = +($('eco-mites')?.value ?? 36);
  const predators = +($('eco-preds')?.value ?? 1);
  if ($('eco-peers-val')) $('eco-peers-val').textContent = String(peers);
  if ($('eco-mites-val')) $('eco-mites-val').textContent = String(mites);
  if ($('eco-preds-val')) $('eco-preds-val').textContent = String(predators);
  cr.eco.setPopulationTargets({ peers, mites, predators });
}
['eco-peers', 'eco-mites', 'eco-preds'].forEach((id) => {
  if ($(id)) $(id).addEventListener('input', syncEcoSliders);
});
if ($('eco-season')) {
  $('eco-season').onchange = () => {
    cr.world.seasonMode = $('eco-season').value;
  };
}
if ($('eco-spawn-peer')) {
  $('eco-spawn-peer').onclick = () => {
    if (!cr.eco) return;
    cr.eco.maxPeers = Math.min(48, Math.max(cr.eco.maxPeers, cr.eco.peers.length + 2));
    const p = cr.eco.spawnPeer(null, null, true);
    if ($('eco-peers')) {
      $('eco-peers').value = String(Math.min(48, cr.eco.peers.length));
      if ($('eco-peers-val')) $('eco-peers-val').textContent = String(cr.eco.peers.length);
    }
    if (p) cr.ev('biosphere', `spawned conspecific #${p.id} (${p.cladeName || (p.limbPairs * 2 + 'L')} 128-gene variant)`);
  };
}
if ($('eco-lay-egg')) {
  $('eco-lay-egg').onclick = () => {
    if (!cr.eco) return;
    const com = cr.body.com();
    const mateGen = cr.eco.peers[0]?.gen || cr.gen;
    const mateId = cr.eco.peers[0]?.id ?? 0;
    const genNum = (cr.generation || 0) + 1;
    const eg = cr.eco.layEgg(com[0] + 0.45, com[2] + 0.35, cr.gen, mateGen, 0, mateId, genNum, true);
    if (eg) cr.ev('egg', `laid fertilized diploid 128-gene Zygote egg #${eg.id} (gen ${genNum})`);
  };
}
if ($('eco-pred-btn')) {
  $('eco-pred-btn').onclick = () => {
    if (!cr.eco) return;
    if (cr.eco.predators.length === 0) {
      cr.eco.spawnPredator();
      cr.ev('leviathan', 'Shadow-Leviathan entered the biosphere perimeter');
    } else {
      cr.eco.predators.length = 0;
      cr.ev('leviathan', 'Shadow-Leviathans dispersed');
    }
    if ($('eco-preds')) $('eco-preds').value = String(cr.eco.predators.length);
    if ($('eco-preds-val')) $('eco-preds-val').textContent = String(cr.eco.predators.length);
  };
}

// ---------------------------------------------------------------- flaws
const syncFlawUI = () => { for (const k of ['scramble', 'leaky', 'backwards', 'misfire']) $('f-' + k).checked = cr.flaws[k].on; };
const readFlaws = () => {
  const f = JSON.parse(JSON.stringify(cr.flaws));
  for (const k of ['scramble', 'leaky', 'backwards', 'misfire']) f[k].on = $('f-' + k).checked;
  f.scramble.period = +$('f-scramble-p').value || 90;
  f.leaky.rate = +$('f-leaky-r').value;
  f.misfire.period = +$('f-misfire-p').value || 60;
  cr.setFlaws(f);
  urlSync();
};
document.querySelectorAll('[id^=f-]').forEach((el) => el.tagName === 'INPUT' && el.addEventListener('change', readFlaws));
$('f-none').onclick = () => { for (const k of ['scramble', 'leaky', 'backwards', 'misfire']) $('f-' + k).checked = false; readFlaws(); };
$('f-all').onclick = () => { for (const k of ['scramble', 'leaky', 'backwards', 'misfire']) $('f-' + k).checked = true; readFlaws(); };
syncFlawUI();

function urlSync() {
  const on = Object.keys(cr.flaws).filter((k) => cr.flaws[k].on);
  const u = new URL(location.href);
  u.searchParams.set('seed', seed);
  on.length ? u.searchParams.set('flaws', on.join(',')) : u.searchParams.delete('flaws');
  backendMode !== 'auto' ? u.searchParams.set('backend', backendMode) : u.searchParams.delete('backend');
  clockMode !== 'realtime' ? u.searchParams.set('clock', clockMode) : u.searchParams.delete('clock');
  wmScale !== 'std' ? u.searchParams.set('wm', wmScale) : u.searchParams.delete('wm');
  cameraMode !== 'orbit' ? u.searchParams.set('cam', cameraMode) : u.searchParams.delete('cam');
  lightingMode !== 'auto' ? u.searchParams.set('light', lightingMode) : u.searchParams.delete('light');
  activeCladeOverride ? u.searchParams.set('clade', activeCladeOverride) : u.searchParams.delete('clade');
  qMode === '4' ? u.searchParams.set('q', '4k') : qMode !== 'auto' ? u.searchParams.set('q', qMode) : u.searchParams.delete('q');
  history.replaceState(null, '', u);
}

// ---------------------------------------------------------------- world controls
$('gx').oninput = () => (cr.world.gx = +$('gx').value);
$('gz').oninput = () => (cr.world.gz = +$('gz').value);
$('gs').oninput = () => (cr.world.g = +$('gs').value);
$('speed').onchange = () => (speed = +$('speed').value);
if ($('clock-mode')) {
  $('clock-mode').onchange = () => {
    clockMode = $('clock-mode').value;
    cr.setClockMode(clockMode);
    urlSync();
  };
}
if ($('wm-scale')) {
  $('wm-scale').onchange = () => {
    wmScale = $('wm-scale').value;
    restart();
  };
}
if ($('qrng-fetch')) {
  $('qrng-fetch').onclick = async () => {
    const st = $('qrng-status');
    $('qrng-fetch').disabled = true;
    if (st) st.textContent = 'contacting 4 photonic QRNG beacons…';
    const r = await cr.qrng.fetchHardwareEntropy();
    $('qrng-fetch').disabled = false;
    if (st) {
      st.textContent = r.ok
        ? `${r.source}: ${r.bytes * 8} bits (SP 800-90B pass)`
        : `offline/CORS (${r.reason || '16Q WASM + DRAG/PEC/ZNE active'})`;
    }
  };
}
$('quality').onchange = () => {
  qMode = $('quality').value;
  if (view && qMode !== 'auto') view.setQuality(+qMode);
  urlSync();
};
$('rain').onclick = () => { cr.world.wind.rainT = cr.world.wind.rainT ? 0 : 1; };
$('gust').onclick = () => { cr.world.wind.tx = (Math.random() - 0.5) * 10; cr.world.wind.tz = (Math.random() - 0.5) * 10; };
$('sleepy').onclick = () => { cr.sleep.S = 1; };
$('wake').onclick = () => { cr.sleep.forceWake = 30; cr.sleep.S = Math.min(cr.sleep.S, 0.3); };
$('follow').onclick = () => { if (!view) return; view.follow = !view.follow; $('follow').textContent = 'Camera: ' + (view.follow ? 'follow' : 'free'); };
$('reset').onclick = () => { seed = Math.floor(Math.random() * 99999) + 1; $('seed').value = seed; restart(); };
$('seed').onchange = () => { seed = +$('seed').value || 1; restart(); };

if ($('dome-storm')) {
  $('dome-storm').onclick = () => {
    if (cr.world.dome) {
      cr.world.dome.auroraStorm = 0.92;
      cr.world.dome.auroraPhase = Math.PI * 0.45;
      cr.ev('dome', 'geomagnetic aurora storm surged across Geodesic Biodome');
    }
  };
}
if ($('dome-refuge')) {
  $('dome-refuge').onclick = () => {
    if (cr.eco) {
      cr.eco.refugeImmunityEnabled = !cr.eco.refugeImmunityEnabled;
      $('dome-refuge').textContent = `🛡 Refuge: ${cr.eco.refugeImmunityEnabled ? 'ON' : 'OFF'}`;
      cr.ev('dome', `GATE-DOME-REFUGE Big-Tree sanctuary ward ${cr.eco.refugeImmunityEnabled ? 'ENABLED' : 'DISABLED'}`);
    }
  };
}
if ($('dome-trauma')) {
  $('dome-trauma').onclick = () => {
    if (cr.heptarch) {
      cr.heptarch.inflictLimbTrauma(0, 0.48);
      cr.ev('bioelec', 'limb 0 traumatized (V_mem depolarized) -> Levin blastema regrowth engaged');
    }
  };
}

function restart() {
  const f = cr.flaws;
  cr = new Creature(seed, { flaws: f, clockMode, wmScale, eco: currentEcoOpts() });
  cr.qrng.initWebGPU18Q?.().catch(() => {});
  if ($('eco-season')) cr.world.seasonMode = $('eco-season').value;
  setupBackend(backendMode);
  if (view) {
    const prevQ = view.quality;
    const c = $('gl');
    view.dispose?.();
    view.renderer.dispose();
    const nc = c.cloneNode();
    c.replaceWith(nc);
    nc.addEventListener('pointerdown', onCanvasPointerDown);
    view = new View(nc, cr, { reduced, quality: prevQ, p5Layer, cameraMode, lightingMode });
    applyCameraMode(cameraMode);
    applyLightingMode(lightingMode);
  }
  syncCladeButtons();
  urlSync();
  buildLesions();
}

function onCanvasPointerDown(e) {
  if (!view || tool === 'orbit') return;
  const r = e.currentTarget.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
  const hit = view.pick(nx, ny);
  if (tool === 'poke') {
    if (hit.particle >= 0) {
      cr.poke(hit.particle, [hit.dir.x, Math.abs(hit.dir.y) + 0.3, hit.dir.z]);
      view.skinU.glitch.value = 1;
    }
    return;
  }
  if (!hit.point) return;
  const { x, z } = hit.point;
  if (tool === 'food') cr.world.dropSnack(x, z);
  else if (tool === 'rock') cr.world.addRock(x, z, 0.8 + Math.random() * 1.2);
  else if (tool === 'spring') cr.world.addSpring(x, z);
  else if (tool === 'vent') cr.world.addVent(x, z);
}

// ---------------------------------------------------------------- lesions
const LES = [
  ['mot', 'MOT neurons silenced'],
  ['cpg', 'LTC pattern generator off'],
  ['mn', 'all motor neurons off (paralysis)'],
  ['fem', 'anisotropic Neo-Hookean + 32-fascicle Huxley FEM off'],
  ['fluid', '64-vessel Murray + 24×8×8 D3Q19 LBM + 1,024 RBC/WBC off'],
  ['learnMotor', 'motor learning off'],
  ['stdp', 'STDP / plasticity off'],
  ['wm', '32×16 Flow-VAE + +300s HTN-MCTS World Model off'],
  ['ssmLearn', 'online RTRL SSM learning off'],
  ['metacog', 'metacognition, 32Q χ=32 MPS & 512-D MERA off'],
  ['vision', '256×128 / 196k-RGC fovea & 65,536 Ontology IT off'],
  ['dg', '32,768-neu hippocampal DG (1.2% + neurogenesis) off'],
  ['homeo', 'intrinsic & Turrigiano homeostasis off'],
  ['struct', 'cortical structural rewiring off'],
  ['qrng', '16Q WASM + Transmon DRAG / PEC / ZNE off'],
  ['astro', 'astrocyte modulation off'],
  ['veto', 'veto off'],
  ['efe', 'epistemic (EFE) term off'],
  ['dream', 'REM dreaming off'],
  ['gripReflex', 'stance/grip reflex off'],
  ['motNorm', 'MOT normalisation off'],
  ['selfModel', 'self-model travel cost off'],
  ['hdc', 'HDC cognitive map off'],
  ['hopfield', 'Hopfield / 32,768-neu Hip-Sub + SR memory off'],
  ['pc', 'predictive-coding learning off'],
  ['turing', 'hormone -> skin morphogen link off'],
  ['growth', 'per-part growth off'],
  ['thirst', 'thirst-driven water seeking off'],
  ['cephalic', 'cephalic-phase insulin off'],
  ['scales', 'ventral scale lift (turning aid) off'],
  ['memLearn', 'memory encoder learning off (fixed keys/features)'],
  ['nav', 'head-direction / path integration off (unseen goals have no direction)'],
  ['babble', 'neonatal motor babbling off (needs reset)'],
  ['course', 'course-over-ground drift term off'],
  ['heptarch', 'HEPTARCH 7-seat council & Raider ColdStrike off'],
  ['magneto', 'Cryptochrome-4 radical-pair nocturnal compass off'],
  ['bioelec', 'Levin gap-junction V_mem limb regeneration off'],
];

function buildLesions() {
  const box = $('lesions');
  box.innerHTML = '';
  for (const [k, label] of LES) {
    const on = k === 'struct' ? !!cr.brain.lesion.struct : !!cr.lesion[k];
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', on);
    b.onclick = () => {
      if (k === 'struct') cr.brain.lesion.struct = !cr.brain.lesion.struct;
      else cr.lesion[k] = !cr.lesion[k];
      if (k === 'wm') cr.wm.lesion = cr.lesion[k];
      const nowOn = k === 'struct' ? cr.brain.lesion.struct : cr.lesion[k];
      b.classList.toggle('on', nowOn);
      lesionMark(k, nowOn);
    };
    box.appendChild(b);
  }
}
let lesionRef = null;
function lesionMark(k, on) { lesionRef = { k, t: cr.t, dist: cr.stats.dist, on }; }
buildLesions();

// ---------------------------------------------------------------- legends
$('regions').innerHTML = REGIONS.map(([n], i) => `<span><i style="background:hsl(${(i / REGIONS.length) * 360},90%,60%)"></i>${n}</span>`).join('');
$('spk-label').textContent = `${NNEU.toLocaleString()} ${BRAIN_SCALE === 'GIGA' ? 'quantized 1.13B-syn mouse-cortex' : '16-comp Discrete-Markov'} neurons (brain ${BRAIN_SCALE})`;

const surpHist = [], mseHist = [], mse5Hist = [], mse20Hist = [], mse60Hist = [], varHist = [];
const kapHist = [], tauHist = [], calHist = [];

function bars(el, rows) {
  el.innerHTML = rows
    .map(([n, v]) => `<div class="bar-row"><span>${n}</span><div><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(0)}%"></i></div></div>`)
    .join('');
}
function stats(el, rows) {
  if (!el) return;
  el.innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
}

function isGoalChannel(g, k) {
  if (!g) return false;
  if (k < 16) return g.type === 'site' && g.k === k;
  if (k < 19) return g.type === 'water' && g.pool === k - 16;
  if (k === 19) return g.type === 'snack';
  return g.type === 'explore';
}

function drawPanel() {
  const p = $('panel');
  if (p.hidden) return;
  const b = cr.brain;

  // 1) Spike raster scroll (213 row buckets — constant cost even on 14,156,048-neuron GIGA!)
  rctx.drawImage(raster, -2, 0);
  rctx.fillStyle = '#03060d';
  rctx.fillRect(raster.width - 2, 0, 2, raster.height);
  const rH = raster.height;
  for (let y = 0; y < rH; y++) {
    const ri = rasterRowBucket[y];
    if (ri >= 0) {
      rctx.fillStyle = regionColors[ri];
      rctx.fillRect(raster.width - 2, y, 2, 1);
    }
  }
  rasterRowBucket.fill(-1);

  bars($('nm'), [['DA', b.nm.DA], ['NE', b.nm.NE], ['5-HT', b.nm['5HT']], ['ACh', b.nm.ACh], ['cortisol', b.nm.cortisol]]);
  bars($('mot'), MOT_NAMES.map((n, m) => [n, cr.motRate[m] / 1.5]));

  // 2) Dual 128x64 P/M/K foveated retinas (16,384 photoreceptors) + 64x32 V1 Gabor columns + 19 EKF-SLAM cells
  if ($('retina')) {
    const ret = cr.retina, rx = $('retina').getContext('2d');
    rx.fillStyle = '#03060d';
    rx.fillRect(0, 0, 360, 58);
    const stepR = Math.max(1, Math.floor(W_RET / 64));
    const colsR = Math.floor(W_RET / stepR), rowsR = Math.floor(H_RET / stepR);
    const pw = 120 / colsR, ph = 48 / rowsR;
    const drawSheet = (sheet, x0) => {
      for (let py = 0; py < rowsR; py++) {
        const sy = (rowsR - 1 - py) * stepR;
        for (let px = 0; px < colsR; px++) {
          const idx = (sy * W_RET + px * stepR) * 3;
          const rr = Math.min(255, Math.round(sheet[idx] * 245));
          const gg = Math.min(255, Math.round(sheet[idx + 1] * 245));
          const bb = Math.min(255, Math.round(sheet[idx + 2] * 245));
          rx.fillStyle = `rgb(${rr},${gg},${bb})`;
          rx.fillRect(x0 + px * pw, py * ph, Math.ceil(pw), Math.ceil(ph));
        }
      }
    };
    drawSheet(ret.retL, 0);
    drawSheet(ret.retR, 122);
    const v1 = ret.v1Complex;
    const stepV = Math.max(1, Math.floor(W_V1 / 32));
    const colsV = Math.floor(W_V1 / stepV), rowsV = Math.floor(H_V1 / stepV);
    const vw = 116 / colsV, vh = 48 / rowsV;
    for (let vy = 0; vy < rowsV; vy++) {
      const sy = (rowsV - 1 - vy) * stepV;
      for (let vx = 0; vx < colsV; vx++) {
        const base = (sy * W_V1 + vx * stepV) * N_ORI;
        let bestO = 0, bestE = -1, eTot = 0;
        for (let o = 0; o < N_ORI; o++) {
          const e = v1[base + o];
          eTot += e;
          if (e > bestE) { bestE = e; bestO = o; }
        }
        const lum = Math.min(72, Math.round(8 + eTot * 240));
        rx.fillStyle = `hsl(${bestO * 85 + 15},95%,${lum}%)`;
        rx.fillRect(244 + vx * vw, vy * vh, Math.ceil(vw), Math.ceil(vh));
      }
    }
    rx.fillStyle = '#ffffff33';
    rx.fillRect(120, 0, 2, 48);
    rx.fillRect(242, 0, 2, 48);
    const totLm = ret.conf.length, lw = 360 / totLm;
    for (let i = 0; i < totLm; i++) {
      const cf = ret.conf[i];
      rx.fillStyle = i < 16 ? `rgba(52,245,166,${(0.14 + 0.86 * cf).toFixed(2)})` : `rgba(56,232,255,${(0.14 + 0.86 * cf).toFixed(2)})`;
      rx.fillRect(i * lw + 1, 50, Math.max(2, lw - 2), 7);
    }
  }

  // 3) Unified 21-channel Striatal D1/D2 race
  const rc = $('race').getContext('2d');
  rc.fillStyle = '#03060d';
  rc.fillRect(0, 0, 360, 70);
  const cw = 360 / NSTR_OPT;
  for (let k = 0; k < NSTR_OPT; k++) {
    const d1 = cr.raceLog[k], d2 = cr.raceLog[NSTR_OPT + k];
    const baseCol = k < 16 ? '#34f5a6' : k < 19 ? '#38e8ff' : k === 19 ? '#ffb84d' : '#c688ff';
    rc.fillStyle = isGoalChannel(cr.goal, k) ? '#fff066' : baseCol;
    const h1 = Math.min(33, d1 * 2.5), h2 = Math.min(33, d2 * 2.5);
    rc.fillRect(k * cw + 1, 35 - h1, Math.max(3, cw * 0.52), h1);
    rc.fillStyle = '#ff4477';
    rc.fillRect(k * cw + 1 + cw * 0.52, 35, Math.max(2, cw * 0.36), h2);
  }

  // 4) LTC CPG scroll
  const cc = $('cpg').getContext('2d');
  cc.drawImage(cc.canvas, -2, 0);
  cc.fillStyle = '#03060d';
  cc.fillRect(358, 0, 2, 60);
  for (let k = 0; k < 24; k++) {
    const v = cr.cpg.x[k];
    cc.fillStyle = `hsla(${k * 15},90%,${20 + 50 * v}%,1)`;
    cc.fillRect(358, k * 2.5, 2, 2.5);
  }

  // 5) Online RTRL Selective SSM
  const sc = $('ssm').getContext('2d');
  sc.fillStyle = '#03060d';
  sc.fillRect(0, 0, 360, 40);
  for (let k = 0; k < 32; k++) {
    const m = Math.hypot(cr.ssm.re[k], cr.ssm.im[k]);
    sc.fillStyle = '#38e8ff';
    sc.fillRect(k * 11 + 2, 38 - Math.min(36, m * 30), 5, Math.min(36, m * 30));
    sc.fillStyle = '#c688ff';
    sc.fillRect(k * 11 + 7, 38 - Math.min(36, cr.ssm.delta[k] * 12), 3, Math.min(36, cr.ssm.delta[k] * 12));
  }

  // 6) Hierarchical +0.1s / +0.5s / +2.0s BPTT / +60.0s Macro + 16x8 Rectified Flow-Matching World Model
  surpHist.push(cr.wm.surprise);
  mseHist.push(cr.wm.mse);
  mse5Hist.push(cr.wm.mse5 ?? cr.wm.mse);
  mse20Hist.push(cr.wm.mse20 ?? cr.wm.mse);
  mse60Hist.push(cr.wm.mse60 ?? cr.wm.mse);
  varHist.push(cr.wm.visFlowMSE ?? cr.wm.visMSE ?? 0);
  if (surpHist.length > 180) { surpHist.shift(); mseHist.shift(); mse5Hist.shift(); mse20Hist.shift(); mse60Hist.shift(); varHist.shift(); }
  const wc = $('wm').getContext('2d');
  wc.fillStyle = '#03060d';
  wc.fillRect(0, 0, 360, 50);
  const drawLine = (ctx, h, col, sc2, hMax = 48) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    h.forEach((v, i) => {
      const y = hMax - Math.min(hMax - 2, v * sc2);
      i ? ctx.lineTo(i * 2, y) : ctx.moveTo(0, y);
    });
    ctx.stroke();
  };
  drawLine(wc, surpHist, '#ffe066', 36, 48);
  drawLine(wc, mseHist, '#38e8ff', 60, 48);
  drawLine(wc, mse20Hist, '#34f5a6', 60, 48);
  drawLine(wc, mse60Hist, '#ffb84d', 55, 48);
  drawLine(wc, varHist, '#d488ff', 65, 48);

  // 7) Metacognition, Frenet-Serret Thought Curvature κ(t), τ(t), χ=24 MPS & 4-Layer Binary MERA
  const MC = cr.metacog;
  if ($('metacog') && MC) {
    kapHist.push(MC.kappa);
    tauHist.push(Math.abs(MC.torsion));
    calHist.push(MC.confidence);
    if (kapHist.length > 180) { kapHist.shift(); tauHist.shift(); calHist.shift(); }
    const mctx = $('metacog').getContext('2d');
    mctx.fillStyle = '#03060d';
    mctx.fillRect(0, 0, 360, 44);
    drawLine(mctx, kapHist, '#d488ff', 4, 42);
    drawLine(mctx, tauHist, '#38e8ff', 4, 42);
    drawLine(mctx, calHist, '#34f5a6', 38, 42);
  }

  const ws = MC?.ws || {};
  const qSrc = cr.qrng.hwSource || (cr.qrng.wasmActive ? '16Q WASM+DRAG+PEC' : '16Q JS+DRAG+PEC');
  const stCircuit = cr.hop.spikingCircuit;
  const htn = cr.htn;
  stats($('mindstats'), [
    ['sleep stage / clock', `${STAGES[cr.sleep.stage]} · ${cr.timeCompression}× (${CLOCK_MODES[cr.clockMode]?.label || cr.clockMode})`],
    ['brain scale / backend', `${BRAIN_SCALE} (${b.backend}): ${b.N.toLocaleString()} neu, ${b.S.toLocaleString()} syn, ${(window.glitch.stats.stepMs ?? 0).toFixed(1)} ms/step`],
    ['16-comp Discrete Binomial Markov', `NMDA ${b.nmdaSpikes || 0} · BAC ${Math.round(b.plateauBursts || 0)} · SK ${(b.skMean || 0).toFixed(3)} · σ_ch ${(b.channelNoiseMean || 0).toFixed(3)}`],
    ['256×128 (196k RGC) & 65,536 Ontology IT', `${cr.retina.activeLexeme || 'ENTITY'} · inv ${(cr.retina.itInvariance || 0).toFixed(3)} · seen ${cr.retina.itUniqueConceptsSeen || 1}/65,536 · SLAM ${cr.retina.seenCount}/19`],
    ['32,768-neu Hip–Sub (14 pop + SR + 6 GABA)', `DG 16,384 (1.2% + 512 neurogen) · Subic 1,024 · GABA 2,688 · SWRs ${stCircuit?.swrEvents || 0}`],
    ['WM (32×16 Flow-VAE + +0.1s/+2s/+60s)', `${cr.wm.scaleName} (${(cr.wm.paramCount || 0).toLocaleString()}): ${cr.wm.mse.toFixed(4)} / ${(cr.wm.mse20 || 0).toFixed(4)} / ${(cr.wm.mse60 || 0).toFixed(4)} · flow ${(cr.wm.visFlowMSE || 0).toFixed(4)}`],
    ['+300s (5-min) HTN + Depth-5 UCT MCTS', htn ? `${htn.activeTask || 'FORAGE'} -> ${htn.activeStep || 'NAV'} (${htn.rollouts || 24} rollouts, V ${(htn.bestValue ?? 0).toFixed(2)})` : 'standby'],
    ['RTRL SSM |∇| / heteroscedastic σ²', `${(cr.ssm.gradNorm ?? 0).toExponential(1)} / ${(cr.wm.predVar ?? 0).toFixed(3)}`],
    ['thought curvature κ(t) / torsion τ(t)', `${(MC?.kappa ?? 0).toFixed(2)} / ${(MC?.torsion ?? 0).toFixed(2)} (||z′|| ${(MC?.speed ?? 0).toFixed(2)})`],
    ['metacog confidence / regret / temp', `${(MC?.confidence ?? 0).toFixed(2)} / ${(MC?.regret ?? 0).toFixed(2)} / ${(MC?.exploreTemp ?? 1).toFixed(2)}×`],
    ['weight space learned (motor / steer / ctx)', `${((ws.motorLearnedFrac ?? 0) * 100).toFixed(1)}% / ${((ws.steerLearnedFrac ?? 0) * 100).toFixed(1)}% / ${((ws.brainLearnedFrac ?? 0) * 100).toFixed(1)}%`],
    ['16Q WASM / 18Q GPU + DRAG + PEC + ZNE', `DRAG ${(cr.qrng.dragSuppression ?? 25.6).toFixed(1)}× · PEC ${(cr.qrng.pecGain ?? 10.7).toFixed(1)}× · ZNE ${(cr.qrng.zneGain ?? 7.7).toFixed(1)}× · ${qSrc}`],
    ['32-Qubit (χ=32) Vidal MPS & 512-D MERA', `32Q S ${(ws.mps32MaxEntropy ?? ws.mpsEntropy ?? 0).toFixed(2)} (χ=${ws.mps32MaxBond ?? 32}) · VC≤${(ws.vcTruncBound ?? 0).toExponential(1)} · M2 ${(ws.stabilizerMagicM2 ?? 0).toFixed(2)}`],
    ['KS Contextuality (KCBS / CEGA-18 / Hoggar)', `KCBS ${(ws.kcbsValue ?? 2.236).toFixed(3)} · CEGA ${(ws.cegaValue ?? 9.0).toFixed(1)} · Hog ${(ws.hoggarFloor ?? 0.333).toFixed(3)} · C3 Δ${(ws.c3CospectralGap ?? 0.025).toFixed(3)}`],
    ['HEPTARCH 7-Seat Council & ColdStrike', cr.heptarch ? `${cr.heptarch.mode} · ${cr.heptarch.dominantSeat} · CS#${cr.heptarch.csPhase} · Cap ${(cr.heptarch.capacitor ?? 0).toFixed(2)} · ToM k=${cr.heptarch.tomLevel}` : '—'],
    ['predictive-coding error / surprise', `${cr.pc.err.toFixed(3)} / ${cr.pc.surprise.toFixed(2)}`],
    ['thirst / water drunk', `${cr.metab.thirst.toFixed(2)} / ${(cr.stats.drinks || 0).toFixed(1)}`],
    ['5-Clade Zygote (' + (cr.body.hox?.cladeName || (cr.body.activeLimbs + 'L')) + ')', cr.body.activeLimbs > 0 ? Array.from(cr.body.limbLen).slice(0, cr.body.activeLimbs).map((x) => x.toFixed(2)).join(' ') : 'limbless undulatory serpent'],
    ['sleep consolidations / merged / InfoNCE', `${cr.memStats.consolidations || 0} / ${cr.memStats.merged || 0} / ${cr.hop.conLoss.toFixed(2)}`],
    ['HDC features re-drawn (Wiener coherence)', `${cr.hdcFood.resampled + cr.hdcWater.resampled}`],
    ['synapses pruned+regrown / alignment', `${b.grown} / ${(alignC.v ?? 0).toFixed(2)}`],
    ['heading / position error (nav mode)', `${cr.navErr.hd.toFixed(2)} rad / ${cr.navErr.pos.toFixed(1)} u (${cr.navMode})`],
    ['self-model speed / turn', `${cr.selfV.toFixed(2)} u/s / ${cr.selfW.toFixed(2)} rad/s`],
    ['sleep pressure S / goal', `${cr.sleep.S.toFixed(2)} · ${cr.goal ? cr.goal.type + (cr.goal.k !== undefined ? ' ' + cr.goal.k : cr.goal.pool !== undefined ? ' pool ' + cr.goal.pool : '') : cr.race ? 'racing…' : '—'}`],
    ['races / vetoes / fed / tries', `${cr.stats.races} / ${cr.stats.vetoes} · ${cr.stats.eats} / ${cr.stats.tries}`],
    ['NREM replays / REM dreams (+300s HTN)', `${cr.stats.replays} / ${cr.stats.dreams}`],
    ['STDP events / |Δw|', `${b.stdpEvents} / ${(b.dwLast || 0).toExponential(1)}`],
    ['behaviour entropy (fixed / bias-corr)', `${cr.entropy.toFixed(2)} / ${(cr.entropy2 ?? 0).toFixed(2)} bits (${cr.states || 0}/128)`],
  ]);

  const M = cr.metab, F = cr.fluid, B = cr.body, Z = B.hox?.zygote;
  stats($('bodystats'), [
    ['hour / season / microclimate', `${cr.hour.toFixed(2)} · ${cr.world.season} · amb ${(cr.ambientTemp ?? 22).toFixed(1)} °C -> core ${(cr.bodyTemp ?? 24).toFixed(1)} °C`],
    ['128-Cell Zygote Blastula & Gastrulation', Z ? `128 cells (ecto ${Z.ectoderm} · meso ${Z.mesoCount ?? Z.mesoderm} · endo ${Z.endoderm} · crest ${Z.neuralCrest})` : '128 blastomeres'],
    ['3D anisotropic FEM (' + B.nTets + ' tets, ' + B.n + ' nodes)', `J_mean ${(B.meanTetJ ?? 1).toFixed(3)} · J_min ${(B.minTetJ ?? 1).toFixed(3)} · I₄_max ${(B.maxFiberStretch ?? 1).toFixed(2)} · U ${(B.femEnergy ?? 0).toFixed(3)}`],
    ['32 Henneman Fascicles + Huxley Ca²⁺-TnC', `Ca-TnC ${(B.meanCaTroponin ?? 0).toFixed(3)} · X-bridge ${(B.meanCrossBridge ?? 0).toFixed(3)} · ${B.hox?.cladeName || (B.activeLimbs + 'L')}`],
    ['64-Vessel 3D Murray Tree + 24×8×8 LBM', `Murray Δ ${(F?.murrayLiveDeviation ?? 0).toFixed(3)} · ω_LBM ${(F?.lbmVorticity ?? 0).toFixed(4)} · ${(F?.mapPressure ?? 70).toFixed(1)} mmHg`],
    ['1,024 WCSPH (896 RBC + 128 Chemotactic WBC)', `O₂ ${(F?.meanO2 ?? 0.97).toFixed(3)} · brain ${(F?.o2Node?.[14] ?? 0.97).toFixed(3)} · WBC act ${(F?.wbcMeanActivation ?? 0).toFixed(3)}`],
    ['128-Gene Bauplan (Patagium / Esca / Osteo)', `${B.activeLimbs}L · wing ${(B.hox?.patagium ?? 0.18).toFixed(2)} · esca ${(B.hox?.anglerLure ?? 0.24).toFixed(2)} · osteo ${(cr.gen.osteoderm ?? 0.45).toFixed(2)}`],
    ['render pipeline / gamut / buffer', `${view?.hdrPipeline || 'HDR16F + 4096 Shadows + Sky IBL + GTAO + CAS'} · ${view?.colorGamut || 'sRGB'} · ${view?.bufferWidth || 0}×${view?.bufferHeight || 0}`],
    ['gut glc/fat/prot', `${M.gut.glc.toFixed(2)} / ${M.gut.fat.toFixed(2)} / ${M.gut.prot.toFixed(2)}`],
    ['blood glc / FFA / AA / ketones', `${M.blood.glc.toFixed(2)} / ${M.blood.ffa.toFixed(2)} / ${M.blood.aa.toFixed(2)} / ${M.blood.ket.toFixed(2)}`],
    ['liver glycogen / fat / muscle', `${M.liverGly.toFixed(1)} / ${M.fat.toFixed(0)} / ${M.muscle.toFixed(1)}`],
    ['insulin / glucagon / ghrelin / leptin', `${M.insulin.toFixed(2)} / ${M.glucagon.toFixed(2)} / ${M.ghrelin.toFixed(2)} / ${M.leptin.toFixed(2)}`],
    ['ATP / heart rate (baroreflex)', `${M.atp.toFixed(2)} · ${M.hr.toFixed(0)} bpm`],
    ['water gut / blood · bladder / colon', `${M.gut.water.toFixed(2)}/${M.blood.water.toFixed(2)} · ${M.bladder.toFixed(2)}/${M.colon.toFixed(2)}`],
    ['hunger / thirst / distance', `${M.hunger().toFixed(2)} / ${M.thirst.toFixed(2)} · ${cr.stats.dist.toFixed(1)} u`],
    ['Cryptochrome-4 compass / Levin V_mem', cr.heptarch ? `coh ${(cr.heptarch.spinCoherence ?? 0).toFixed(2)} · limb0 ${((cr.heptarch.limbIntegrity[0] ?? 1) * 100).toFixed(0)}% (${(cr.heptarch.vMem[0] ?? -50.5).toFixed(1)} mV)` : '—'],
  ]);

  if ($('heptarch-bars') && cr.heptarch) {
    const H = cr.heptarch;
    const seatNames = ['Surge', 'Chrono', 'Keel', 'Capacitor', 'Wildcard', 'LongGame', 'Jester'];
    const csNames = ['Idle', 'Recon', 'Feign', 'Compile', 'Clamp', 'Commit', 'Zenkai'];
    if ($('heptarch-mode')) {
      $('heptarch-mode').textContent = `${H.mode} · ${H.dominantSeat} · CS:${csNames[H.csPhase] || 'Idle'}`;
    }
    bars($('heptarch-bars'), seatNames.map((nm, i) => [`${nm} ${((H.seats[i] || 0) * 100).toFixed(0)}%`, (H.seats[i] || 0) / 0.46]));
  }

  if ($('domestats')) {
    const W = cr.world, D = W.dome || {}, L = W.ledger || {}, H = cr.heptarch, E = cr.eco;
    const r = H?.rungs || {};
    const castes = E?.casteCounts || {};
    let maxSeat = 0;
    if (H?.seats) for (let i = 0; i < 7; i++) if (H.seats[i] > maxSeat) maxSeat = H.seats[i];
    stats($('domestats'), [
      ['First-Law 11-pool FP64 Kahan closure', `err ${(L.closureErr ?? 0).toExponential(2)} (< 1e-12) · rad ${(D.stefanBoltzmannKW ?? 0).toFixed(2)} kW`],
      ['Dome atmosphere & Daisyworld albedo', `O₂ ${(D.o2 ?? 20.95).toFixed(2)}% · CO₂ ${Math.round(D.co2 ?? 412)} ppm · alb ${(D.albedo ?? 0.42).toFixed(3)} · ΔT ${(D.greenhouseDeltaC >= 0 ? '+' : '') + (D.greenhouseDeltaC ?? 0).toFixed(2)}°C`],
      ['Geomagnetic field & FMO vibronic-ENAQT', `${(D.fieldUT ?? 48.5).toFixed(1)} μT · storm ${(D.auroraStorm ?? 0).toFixed(2)} · ENAQT ${((D.meanEnaqt ?? 0.72) * 100).toFixed(1)}% vs Förster ${((W.plants?.[0]?.forsterEff ?? 0.56) * 100).toFixed(1)}%`],
      ['NESTOR 23-rung precision & BSS motifs', `spindle R${r.spindleReflex ?? 5} · CfC R${r.gangliaCfC ?? 8} · CTX R${r.cortexCSR ?? 10} · VAE R${r.foveaFlowVAE ?? 15} · N=${(H?.activeMotifs ?? 24).toFixed(1)} (Exuvia ${H?.exuviaCount ?? 0})`],
      ['HEPTARCH anti-monarchy & ColdStrike', `max π ${(maxSeat).toFixed(3)} ≤ 0.46 · Cap ${(H?.capacitor ?? 0).toFixed(2)} · TTC ${(H?.ttc ?? 60).toFixed(0)}s · strikes ${H?.coldStrikesCompleted ?? 0}`],
      ['5-Caste Colony + RS[15,11] acoustic ECC', E ? `α:${castes['Sovereign α'] || 0} β:${castes['Harvester β'] || 0} γ:${castes['Sentinel γ'] || 0} δ:${castes['Weaver δ'] || 0} ε:${castes['Disruptor ε'] || 0} · R=${(E.colonyOrderR ?? 0).toFixed(2)} · RS repaired ${E.stats.rsSymbolsRepaired ?? 0}` : '—'],
      ['Xenomimics (Bell twins) & Xylos (2-GW)', E ? `CHSH S=${(E.xenomimics?.[0]?.chshS ?? 2.65).toFixed(2)} (bias ${(E.xenomimics?.[0]?.marginalBias ?? 0).toFixed(2)}) · Xylos ${E.xylos?.length || 0} · slime ${W.slimeTrails?.length || 0}` : '—'],
      ['Titans (IPD treaties) & Shoggoths (meek)', E ? `alliances ${E.stats.titanAlliances ?? 0} · wars ${E.stats.titanWars ?? 0} · bargains ${E.stats.shoggothBargains ?? 0} · meek ${(E.shoggoths?.[0]?.meek ?? 0.8).toFixed(2)}` : '—'],
      ['Sanctuaries, Monoliths & Lithic Tools', `refuge saves ${E?.stats?.sanctuarySaves ?? 0} · nectar ${cr.stats.sanctuaryFeeds || 0} · monoliths ${cr.stats.monolithResonances || 0} · caches ${cr.stats.cachesOpened || 0} · stones ${cr.stats.stonesMoved || 0}`],
    ]);
  }

  if ($('ecostats')) {
    const E = cr.eco, W = cr.world;
    const cc = E?.stats?.cladeCounts || {};
    stats($('ecostats'), [
      ['>8.4M microbe + plankton continuum', `${(W.microbeTotalPop || 0).toLocaleString()} organisms · pool bloom ${((W.planktonBloom || 0) * 100).toFixed(0)}%`],
      ['embodied 3D conspecifics (up to 48)', E ? `${E.peers.length} active (cap ${E.maxPeers}) · ${E.stats.speciesCount || 1} species · max gen ${E.stats.maxGen}` : 'disabled (?eco=0)'],
      ['5-clade radiation (0L / 4L / 6L / 8L / 10L)', E ? `0L:${cc['0L'] || 0} · 4L:${cc['4L'] || 0} · 6L:${cc['6L'] || 0} · 8L:${cc['8L'] || 0} · 10L:${cc['10L'] || 0}` : '—'],
      ['256 discrete 3D benthic/pelagic micro-fauna', E ? `${E.microFauna?.length || 0} embodied detritivores/copepods · ${E.stats.microFaunaForaged || 0} grazed` : '0'],
      ['3D bioluminescent eggs / hatched births', E ? `${E.eggs.length} incubating · ${E.stats.eggsLaid} laid · ${E.stats.births} hatched` : '0'],
      ['photonic bio-mites / pollinations', E ? `${E.mites.length} mites · ${E.stats.pollinationEvents} pollinations · ${E.stats.mitesEaten} eaten` : '0'],
      ['Shadow-Leviathans / Schreckstoff alarms', E ? `${E.predators.length} patrolling · ${E.stats.alarmCalls} alarms` : '0'],
      ['64×64×3 pheromone + 32×32 mycelia', `pher ${(W.pherMean || 0).toFixed(4)} · soil N ${(W.meanSoilN || 0.5).toFixed(3)} · ${W.mycelia.length} hyphae (Ising ${(W.dome?.isingOrder ?? 0).toFixed(2)})`],
      ['Multi-Kingdom Dome Bestiary', E ? `Xenomimics ${E.xenomimics?.length || 0} · Xylos ${E.xylos?.length || 0} · Titans ${E.titans?.length || 0} · Shoggoths ${E.shoggoths?.length || 0}` : '—'],
    ]);
  }

  if (lesionRef) {
    const dt = cr.t - lesionRef.t;
    stats($('lesionlog'), [
      ['last change', `${lesionRef.k} ${lesionRef.on ? 'cut' : 'restored'}`],
      ['seconds since', dt.toFixed(0)],
      ['speed since (units/s)', dt > 0 ? ((cr.stats.dist - lesionRef.dist) / dt).toFixed(2) : '—'],
    ]);
  }

  const mc = $('meta').getContext('2d');
  mc.drawImage(mc.canvas, -1, 0);
  mc.fillStyle = '#03060d';
  mc.fillRect(359, 0, 1, 90);
  const dot = (v, col) => { mc.fillStyle = col; mc.fillRect(359, 88 - Math.max(0, Math.min(86, v * 86)), 1, 2); };
  dot(M.blood.glc / 6, '#ff4477');
  dot(M.insulin, '#38e8ff');
  dot(M.glucagon, '#ffe066');
  dot(M.liverGly / 60, '#b678ff');
  dot(M.ghrelin, '#34f5a6');
  dot(M.cortisol, '#ffb84d');
}

const alignC = { v: 0, t: 0 };

function drawEvents() {
  const ev = cr.events;
  const el = $('events');
  const last = ev.slice(innerWidth < 640 ? -3 : -5);
  el.innerHTML = last.map((e) => `<div><b>${e.type}</b> ${e.msg}</div>`).join('');
}

// ---------------------------------------------------------------- main loop with warmup-protected adaptive quality & compact worker IPC
let slowT2 = 0, slowQ = 0, last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, panelT = 0, goodT = 0;
const S = window.glitch.stats;
const Q_NAMES = ['low', 'med', 'high', 'ultra', '4K-UHD'];

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.1, Math.max(0, rawDt));
  S.uptime = (S.uptime || 0) + dt;
  // Ignore tab-switch / shader-compile stalls (rawDt > 0.2s) so auto quality never falsely downgrades!
  if (rawDt < 0.2) {
    fpsT += dt;
    fpsN++;
  }
  const t0 = performance.now();
  if (!paused) {
    acc += dt * 60 * speed;
    let n = 0;
    while (acc >= 1 && n < 64) {
      cr.step();
      acc -= 1;
      n++;
      S.stepN = (S.stepN || 0) + 1;
      accumulateStepSpikes(cr.brain);
      if (performance.now() - t0 > 14) { acc = 0; break; }
    }
    if (n > 0 && brainWorker && !workerPending) {
      const dtSim = Math.max(n / 60, Math.min(0.25, cr.t - lastWorkerT));
      lastWorkerT = cr.t;
      workerPending = true;
      const effSteps = Math.max(1, Math.min(12, Math.round(dtSim * 60)));
      const msg = {
        op: 'stepBatch',
        substeps: 8 * effSteps,
        dt: 0.002,
        runSlow: true,
        slowDt: dtSim,
        stage: cr.sleep.stage,
        nm: cr.brain.nm,
        atonia: cr.brain.atonia,
        achGain: cr.lesion.metacog ? 1 : (cr.metacog?.achGain ?? 1),
        place: !cr.lesion.nav && cr.sleep.stage === 0 ? [cr.nav.px, cr.nav.pz, 1.15] : null,
        v1Complex: !cr.lesion.vision && cr.sleep.stage === 0 ? cr.retina.v1Complex : null,
        itAct: !cr.lesion.vision && cr.sleep.stage === 0 ? cr.retina.itAct : null,
        ofcApp: cr.race ? cr.ofcApp : null,
        ofcAv: cr.race ? cr.ofcAv : null,
        lesion: cr.brain.lesion,
      };
      const transfer = [];
      if (cr.brain.sparseSheetExt) {
        // Zero-bloat < 1.6 KB IPC for 1.05M MEGA & 14.16M GIGA!
        const extSubL = cr.brain.ext.slice(0, R0.THAL);
        const extSubR = cr.brain.ext.slice(R0.STR);
        const sheetBaseExt = Float32Array.from(cr.brain.sheetBaseExt);
        msg.extSubL = extSubL;
        msg.extSubR = extSubR;
        msg.sheetBaseExt = sheetBaseExt;
        transfer.push(extSubL.buffer, extSubR.buffer, sheetBaseExt.buffer);
      } else {
        const extCopy = new Float32Array(cr.brain.ext);
        msg.extBuf = extCopy.buffer;
        transfer.push(extCopy.buffer);
      }
      brainWorker.postMessage(msg, transfer);
    } else if (n > 0 && gpuBrain && !gpuBrain.busy) {
      gpuBrain.stepBatch(cr.brain, 8, 0.002);
    }
  }
  cr.speed = speed;
  if (p5Layer && !paused) p5Layer.update(cr);
  if (audio.enabled && !paused) audio.update(cr, view?.camera?.position);
  const t1 = performance.now();
  if (view) view.update(paused ? 0 : dt);
  const t2 = performance.now();
  S.simMs = S.simMs * 0.95 + (t1 - t0) * 0.05;
  {
    const ns = (S.stepN || 0) - (S.stepN0 || 0);
    S.stepN0 = S.stepN || 0;
    if (ns > 0) S.stepMs = (S.stepMs ?? (t1 - t0) / ns) * 0.95 + ((t1 - t0) / ns) * 0.05;
  }
  S.renderMs = S.renderMs * 0.95 + (t2 - t1) * 0.05;
  S.frames++;

  if (fpsT > 1) {
    const fps = fpsN / fpsT;
    S.fps = fps;
    $('hud-fps').textContent = fps.toFixed(0) + ' fps';
    fpsT = 0;
    fpsN = 0;
    if (view && qMode === 'auto' && S.uptime > 4.0) {
      const minAllow = fps < 18 ? 0 : qAutoFloor;
      if (fps < 32 && view.quality > minAllow) {
        slowQ++;
        goodT = 0;
        if (slowQ >= 6) {
          view.setQuality(view.quality - 1);
          slowQ = 0;
        }
      } else if (fps > 55) {
        slowQ = 0;
        goodT++;
        if (goodT >= 4 && view.quality < qMax) {
          view.setQuality(view.quality + 1);
          goodT = 0;
        }
      } else {
        slowQ = 0;
        goodT = 0;
      }
    }
    if (cr.t - alignC.t > 2) { alignC.t = cr.t; alignC.v = cr.brain.alignment(); }
    if (!Q.get('brain') && !cr.brain.delegated && BRAIN_SCALE !== 'S' && S.frames > 300 && (S.stepMs ?? 0) > 16.5) {
      slowT2 = (slowT2 || 0) + 1;
      if (slowT2 > 5) {
        const nextScale = BRAIN_SCALE === 'GIGA' ? 'MEGA' : BRAIN_SCALE === 'MEGA' ? 'XXL' : BRAIN_SCALE === 'XXL' ? 'XL' : BRAIN_SCALE === 'XL' ? 'L' : BRAIN_SCALE === 'L' ? 'M' : 'S';
        const u = new URL(location.href);
        u.searchParams.set('brain', nextScale);
        u.searchParams.set('auto', '1');
        location.replace(u.href);
      }
    } else slowT2 = 0;
    S.quality = view ? view.quality : -1;
    $('hud-q').textContent = (qMode === 'auto' ? 'auto:' : '') + (Q_NAMES[S.quality] || 'ultra');
  }

  panelT += dt;
  if (panelT > 1 / 15) {
    panelT = 0;
    drawPanel();
    drawEvents();
    $('hud-stage').textContent = STAGES[cr.sleep.stage];
    const h = cr.hour;
    $('hud-clock').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    if (view) $('hud-q').textContent = (qMode === 'auto' ? 'auto:' : '') + (Q_NAMES[view.quality] || 'ultra');
  }
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- lineage evolution (108-gene Hox + Morphogen Refine + De-Novo CMA-ES)
{
  let lin = null;
  const log = $('evo-log');
  const saveLineage = () => {
    try {
      if (lineageInfo) localStorage.setItem(LIN_KEY, JSON.stringify(lineageInfo));
      else localStorage.removeItem(LIN_KEY);
      localStorage.setItem(LIN_STACK_KEY, JSON.stringify(lineageStack.slice(-8)));
    } catch (e) { /* storage blocked */ }
  };
  const show = () => {
    const rows = [
      ['genome (128 Zygote + Hox Evo-Devo genes)', lineageInfo ? `evolved in browser (${lineageInfo.mode === 'denovo' ? 'de-novo random, ' : ''}${lineageInfo.gens} gens, CRN fitness ${lineageInfo.fit.toFixed(2)}, stack ${lineageStack.length})` : `starter (128-gene ${cr.body.hox?.cladeName || (cr.body.activeLimbs + 'L')} body + brain, pass 19)`],
    ];
    if (lin) {
      const mStr = lin.mode === 'denovo' ? 'de-novo random [0.05,0.95]^128' : 'refine starter';
      const ms = lin.morphSummary?.();
      rows.push(['mode / gen / σ', `${mStr} · gen ${lin.gen} / ${lin.sigma.toFixed(3)}${lin.running ? ' (running in workers…)' : ''}`]);
      rows.push(['genomes scored (2-body CRN)', `${lin.evals}${lin.startFit !== null ? ` · initial ${lin.startFit.toFixed(2)}` : ''}`]);
      if (ms) {
        rows.push(['evolved 5-clade 3D topology', `${ms.limbs} limbs (${ms.clade || ''}) · wing ${ms.patagium ?? '—'} · esca ${ms.anglerLure ?? '—'} · osteo ${ms.osteoderm}`]);
      }
      for (const h of lin.hist.slice(-8)) {
        const dStr = (h.delta >= 0 ? '+' : '') + h.delta.toFixed(2);
        rows.push([
          `gen ${h.gen} (bodies ${h.seeds})`,
          `fitness ${h.mean.toFixed(2)} (${dStr}) · ${h.morph?.limbs || 6}L · turn ${h.turn.toFixed(2)} · fwd ${h.v.toFixed(2)} u/s · up ${h.up.toFixed(2)}`,
        ]);
      }
    }
    stats(log, rows);
    $('evo-adopt').disabled = !lin || !lin.gen || lin.running;
    if ($('evo-undo')) $('evo-undo').disabled = !lineageStack.length || !!lin?.running;
    $('evo-run').disabled = !!lin?.running;
    if ($('evo-denovo')) $('evo-denovo').disabled = !!lin?.running;
  };
  $('evo-run').onclick = async () => {
    if (!lin || lin.mode !== 'refine') {
      const { Lineage } = await import('./lineage.js');
      lin = new Lineage(cr.gen, show, [2, 5], { mode: 'refine' });
    }
    lin.run(6).catch((e) => {
      console.warn(e);
      stats(log, [['lineage', 'evolution failed: ' + e.message]]);
    });
    show();
  };
  if ($('evo-denovo')) {
    $('evo-denovo').onclick = async () => {
      const { Lineage } = await import('./lineage.js');
      lin = new Lineage(null, show, [2, 5], { mode: 'denovo' });
      lin.run(12).catch((e) => {
        console.warn(e);
        stats(log, [['lineage', 'de-novo evolution failed: ' + e.message]]);
      });
      show();
    };
  }
  $('evo-adopt').onclick = () => {
    if (!lin) return;
    const g = lin.genome();
    const fit = lin.hist[lin.hist.length - 1].mean;
    const mode = lin.mode;
    lineageStack.push(lineageInfo ? JSON.parse(JSON.stringify(lineageInfo)) : { starter: true });
    lineageInfo = { genome: g, gens: mode === 'denovo' ? lin.gen : (lineageInfo?.gens || 0) + lin.gen, fit, mode };
    saveLineage();
    activeCladeOverride = null;
    globalThis.TW = { ...(globalThis.TW || {}), genome: g };
    lin = null;
    restart();
    show();
  };
  if ($('evo-undo')) {
    $('evo-undo').onclick = () => {
      if (!lineageStack.length) return;
      activeCladeOverride = null;
      const prev = lineageStack.pop();
      if (!prev || prev.starter) {
        lineageInfo = null;
        if (globalThis.TW) delete globalThis.TW.genome;
      } else {
        lineageInfo = prev;
        globalThis.TW = { ...(globalThis.TW || {}), genome: prev.genome };
      }
      saveLineage();
      lin = null;
      restart();
      show();
    };
  }
  $('evo-reset').onclick = () => {
    activeCladeOverride = null;
    lineageInfo = null;
    lineageStack = [];
    saveLineage();
    if (globalThis.TW) delete globalThis.TW.genome;
    lin = null;
    restart();
    show();
  };
  show();
}
