import { Creature, DEFAULT_FLAWS, MOT_NAMES, CLOCK_MODES } from './sim/creature.js';
import { REGIONS, R0, RN, NNEU, BRAIN_SCALE, NSTR_OPT } from './sim/brain.js';
import { STAGES } from './sim/mind.js';
import { NBINS, W_RET, H_RET, W_V1, H_V1, N_ORI } from './sim/vision.js';
import { REAL, SIMPLIFIED } from './honesty.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let seed = +(Q.get('seed') || 1) || 1;
$('seed').value = seed;
let clockMode = CLOCK_MODES[Q.get('clock')] ? Q.get('clock') : 'circadian';
let wmScale = ['std', 'large', 'xl'].includes(Q.get('wm')) ? Q.get('wm') : 'std';

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

let cr = new Creature(seed, { flaws, clockMode, wmScale });
let view = null;
let View;
try {
  ({ View } = await import('./render.js'));
  view = new View($('gl'), cr, { reduced, quality: 1 });
} catch (e) {
  console.error(e);
  $('glfail').hidden = false;
}

window.glitch = {
  get cr() { return cr; },
  get view() { return view; },
  stats: { fps: 0, frames: 0, quality: 1, simMs: 0, renderMs: 0 },
};

let speed = +(Q.get('speed') || 1);
$('speed').value = String(speed);
let paused = false, tool = 'orbit', qMode = Q.get('q') || 'auto';
$('quality').value = qMode;
if ($('brain-scale')) $('brain-scale').value = BRAIN_SCALE;
if ($('clock-mode')) $('clock-mode').value = clockMode;
if ($('wm-scale')) $('wm-scale').value = wmScale;

const coarse = matchMedia('(pointer: coarse)').matches;
const qMax = coarse ? 2 : 3;
if (view) {
  view.setQuality(qMode === 'auto' ? (coarse ? 1 : 2) : +qMode);
  addEventListener('resize', () => view.resize());
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
        w.postMessage({ op: 'init', seed, scale: BRAIN_SCALE });
      });
      w.onerror = (err) => console.error('brainWorker error:', err.message || err);
      w.onmessage = (e) => {
        if (e.data?.op === 'stepped') {
          workerPending = false;
          const d = e.data;
          // Receive off-main-thread THAL + CTX + HIP sheet rates, spikes & plasticity telemetry
          const sh0 = R0.THAL, sh1 = R0.STR;
          for (let i = sh0; i < sh1 && i < d.rate.length; i++) {
            cr.brain.rate[i] = d.rate[i];
            cr.brain.spk[i] = d.spk[i];
            spikeAcc[i] |= d.spk[i];
          }
          if (d.regRate) for (let k = 1; k <= 3; k++) { cr.brain.regRate[k] = d.regRate[k]; cr.brain.astro[k] = d.astro[k]; }
          cr.brain.spikes = d.spikes;
          cr.brain.stdpEvents = d.stdpEvents;
          cr.brain.grown = d.grown;
          cr.brain.pruned = d.pruned;
          cr.brain.plateauBursts = d.plateauBursts ?? cr.brain.plateauBursts;
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

// ---------------------------------------------------------------- tools
document.querySelectorAll('.tools [data-tool]').forEach((b) =>
  b.addEventListener('click', () => {
    tool = b.dataset.tool;
    document.querySelectorAll('.tools [data-tool]').forEach((x) => x.classList.toggle('on', x === b));
    if (view) view.controls.enabled = tool === 'orbit';
  })
);
$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').firstChild.textContent = paused ? '▶' : '⏸';
});
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); $('pause').click(); }
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
});

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
  clockMode !== 'circadian' ? u.searchParams.set('clock', clockMode) : u.searchParams.delete('clock');
  wmScale !== 'std' ? u.searchParams.set('wm', wmScale) : u.searchParams.delete('wm');
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
    if (st) st.textContent = 'contacting photonic QRNG…';
    const r = await cr.qrng.fetchHardwareEntropy();
    $('qrng-fetch').disabled = false;
    if (st) {
      st.textContent = r.ok
        ? `${r.source}: ${r.bits} bits (SP 800-90B pass)`
        : `offline/CORS (${r.reason || 'local Lindblad MCWF active'})`;
    }
  };
}
$('quality').onchange = () => { qMode = $('quality').value; if (view && qMode !== 'auto') view.setQuality(+qMode); };
$('rain').onclick = () => { cr.world.wind.rainT = cr.world.wind.rainT ? 0 : 1; };
$('gust').onclick = () => { cr.world.wind.tx = (Math.random() - 0.5) * 10; cr.world.wind.tz = (Math.random() - 0.5) * 10; };
$('sleepy').onclick = () => { cr.sleep.S = 1; };
$('wake').onclick = () => { cr.sleep.forceWake = 30; cr.sleep.S = Math.min(cr.sleep.S, 0.3); };
$('follow').onclick = () => { if (!view) return; view.follow = !view.follow; $('follow').textContent = 'Camera: ' + (view.follow ? 'follow' : 'free'); };
$('reset').onclick = () => { seed = Math.floor(Math.random() * 99999) + 1; $('seed').value = seed; restart(); };
$('seed').onchange = () => { seed = +$('seed').value || 1; restart(); };

function restart() {
  const f = cr.flaws;
  cr = new Creature(seed, { flaws: f, clockMode, wmScale });
  setupBackend(backendMode);
  if (view) {
    const c = $('gl');
    view.renderer.dispose();
    const nc = c.cloneNode();
    c.replaceWith(nc);
    view = new View(nc, cr, { reduced, quality: view.quality });
  }
  urlSync();
  buildLesions();
}

// ---------------------------------------------------------------- lesions
const LES = [
  ['mot', 'MOT neurons silenced'],
  ['cpg', 'LTC pattern generator off'],
  ['mn', 'all motor neurons off (paralysis)'],
  ['fem', '3D Neo-Hookean FEM continuum tissue off'],
  ['fluid', '1D Navier-Stokes cardiac pump off'],
  ['learnMotor', 'motor learning off'],
  ['stdp', 'STDP / plasticity off'],
  ['wm', 'Transformer-XL world model off'],
  ['ssmLearn', 'online RTRL SSM learning off'],
  ['metacog', 'metacognition & thought curvature off'],
  ['vision', '2D binocular retina / V1 Gabor columns off'],
  ['dg', 'Dentate Gyrus 5% k-WTA separation off'],
  ['homeo', 'intrinsic & Turrigiano homeostasis off'],
  ['struct', 'cortical structural rewiring off'],
  ['qrng', 'Tsotchke 10-qubit Lindblad QRNG off'],
  ['astro', 'astrocyte modulation off'],
  ['veto', 'veto off'],
  ['efe', 'epistemic (EFE) term off'],
  ['dream', 'REM dreaming off'],
  ['gripReflex', 'stance/grip reflex off'],
  ['motNorm', 'MOT normalisation off'],
  ['selfModel', 'self-model travel cost off'],
  ['hdc', 'HDC cognitive map off'],
  ['hopfield', 'Hopfield memory off'],
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

// ---------------------------------------------------------------- panel drawing
const raster = $('raster'), rctx = raster.getContext('2d');
const rowRegion = new Uint8Array(NNEU);
REGIONS.forEach(([n, c], ri) => { for (let k = 0; k < c; k++) rowRegion[R0[n] + k] = ri; });
const regionColors = REGIONS.map((_, ri) => `hsl(${(ri / REGIONS.length) * 360},90%,60%)`);
const rasterRowBucket = new Int8Array(raster.height);
$('spk-label').textContent = `${NNEU.toLocaleString()} neurons (brain ${BRAIN_SCALE}), rows coloured by region, newest on the right`;
const spikeAcc = new Uint8Array(NNEU);
const surpHist = [], mseHist = [], mse5Hist = [], varHist = [];
const kapHist = [], tauHist = [], calHist = [];

function bars(el, rows) {
  el.innerHTML = rows
    .map(([n, v]) => `<div class="bar-row"><span>${n}</span><div><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(0)}%"></i></div></div>`)
    .join('');
}
function stats(el, rows) {
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

  // 1) Spike raster scroll (row-bucketed so even 104,904-neuron XXL issues <= 213 fillRect calls)
  rctx.drawImage(raster, -2, 0);
  rctx.fillStyle = '#000';
  rctx.fillRect(raster.width - 2, 0, 2, raster.height);
  rasterRowBucket.fill(-1);
  const rH = raster.height;
  for (let i = 0; i < NNEU; i++) {
    if (spikeAcc[i]) rasterRowBucket[((i * rH) / NNEU) | 0] = rowRegion[i];
  }
  for (let y = 0; y < rH; y++) {
    const ri = rasterRowBucket[y];
    if (ri >= 0) {
      rctx.fillStyle = regionColors[ri];
      rctx.fillRect(raster.width - 2, y, 2, 1);
    }
  }
  spikeAcc.fill(0);

  bars($('nm'), [['DA', b.nm.DA], ['NE', b.nm.NE], ['5-HT', b.nm['5HT']], ['ACh', b.nm.ACh], ['cortisol', b.nm.cortisol]]);
  bars($('mot'), MOT_NAMES.map((n, m) => [n, cr.motRate[m] / 1.5]));

  // 2) Dual 24x12 2D binocular retinotopic sheets (L/R) + 12x6 V1 quadrature Gabor orientation columns + 19 EKF-SLAM cells
  if ($('retina')) {
    const ret = cr.retina, rx = $('retina').getContext('2d');
    rx.fillStyle = '#05030a';
    rx.fillRect(0, 0, 360, 58);
    // Left eye (x: 0..119) & Right eye (x: 122..241), each 24x12 @ 5x4 px (top row = sky, bottom row = ground)
    const drawSheet = (sheet, x0) => {
      for (let py = 0; py < H_RET; py++) {
        const sy = H_RET - 1 - py; // invert elevation so sky is on top
        for (let px = 0; px < W_RET; px++) {
          const idx = (sy * W_RET + px) * 3;
          const rr = Math.min(255, Math.round(sheet[idx] * 245));
          const gg = Math.min(255, Math.round(sheet[idx + 1] * 245));
          const bb = Math.min(255, Math.round(sheet[idx + 2] * 245));
          rx.fillStyle = `rgb(${rr},${gg},${bb})`;
          rx.fillRect(x0 + px * 5, py * 4, 5, 4);
        }
      }
    };
    drawSheet(ret.retL, 0);
    drawSheet(ret.retR, 122);
    // V1 Complex orientation columns 12x6 (x: 244..359, y: 0..47) coloured by dominant Gabor angle (0/45/90/135 deg)
    const v1 = ret.v1Complex;
    for (let vy = 0; vy < H_V1; vy++) {
      const sy = H_V1 - 1 - vy;
      for (let vx = 0; vx < W_V1; vx++) {
        const base = (sy * W_V1 + vx) * N_ORI;
        let bestO = 0, bestE = -1, eTot = 0;
        for (let o = 0; o < N_ORI; o++) {
          const e = v1[base + o];
          eTot += e;
          if (e > bestE) { bestE = e; bestO = o; }
        }
        const lum = Math.min(68, Math.round(8 + eTot * 240));
        rx.fillStyle = `hsl(${bestO * 85 + 15},95%,${lum}%)`;
        rx.fillRect(244 + Math.floor(vx * 9.66), vy * 8, 10, 8);
      }
    }
    // Dividers
    rx.fillStyle = '#ffffff33';
    rx.fillRect(120, 0, 2, 48);
    rx.fillRect(242, 0, 2, 48);
    // Hippocampal EKF-SLAM landmark confidence cells (16 plants + 3 pools)
    const totLm = ret.conf.length, lw = 360 / totLm;
    for (let i = 0; i < totLm; i++) {
      const cf = ret.conf[i];
      rx.fillStyle = i < 16 ? `rgba(60,255,160,${(0.12 + 0.88 * cf).toFixed(2)})` : `rgba(40,210,255,${(0.12 + 0.88 * cf).toFixed(2)})`;
      rx.fillRect(i * lw + 1, 50, Math.max(2, lw - 2), 7);
    }
  }

  // 3) Unified 21-channel Striatal D1/D2 race
  const rc = $('race').getContext('2d');
  rc.fillStyle = '#000';
  rc.fillRect(0, 0, 360, 70);
  const cw = 360 / NSTR_OPT;
  for (let k = 0; k < NSTR_OPT; k++) {
    const d1 = cr.raceLog[k], d2 = cr.raceLog[NSTR_OPT + k];
    const baseCol = k < 16 ? '#0f6' : k < 19 ? '#0cf' : k === 19 ? '#fa0' : '#c6f';
    rc.fillStyle = isGoalChannel(cr.goal, k) ? '#ff0' : baseCol;
    const h1 = Math.min(33, d1 * 2.5), h2 = Math.min(33, d2 * 2.5);
    rc.fillRect(k * cw + 1, 35 - h1, Math.max(3, cw * 0.52), h1);
    rc.fillStyle = '#f36';
    rc.fillRect(k * cw + 1 + cw * 0.52, 35, Math.max(2, cw * 0.36), h2);
  }

  // 4) LTC CPG scroll
  const cc = $('cpg').getContext('2d');
  cc.drawImage(cc.canvas, -2, 0);
  cc.fillStyle = '#000';
  cc.fillRect(358, 0, 2, 60);
  for (let k = 0; k < 24; k++) {
    const v = cr.cpg.x[k];
    cc.fillStyle = `hsla(${k * 15},90%,${20 + 50 * v}%,1)`;
    cc.fillRect(358, k * 2.5, 2, 2.5);
  }

  // 5) Online RTRL Selective SSM
  const sc = $('ssm').getContext('2d');
  sc.fillStyle = '#000';
  sc.fillRect(0, 0, 360, 40);
  for (let k = 0; k < 32; k++) {
    const m = Math.hypot(cr.ssm.re[k], cr.ssm.im[k]);
    sc.fillStyle = '#0ff';
    sc.fillRect(k * 11 + 2, 38 - Math.min(36, m * 30), 5, Math.min(36, m * 30));
    sc.fillStyle = '#f0f';
    sc.fillRect(k * 11 + 7, 38 - Math.min(36, cr.ssm.delta[k] * 12), 3, Math.min(36, cr.ssm.delta[k] * 12));
  }

  // 6) Causal RoPE-SwiGLU Transformer-XL World Model surprise, 1-step MSE, 5-step MSE & σ²
  surpHist.push(cr.wm.surprise);
  mseHist.push(cr.wm.mse);
  mse5Hist.push(cr.wm.mse5 ?? cr.wm.mse);
  varHist.push(cr.wm.predVar ?? 0);
  if (surpHist.length > 180) { surpHist.shift(); mseHist.shift(); mse5Hist.shift(); varHist.shift(); }
  const wc = $('wm').getContext('2d');
  wc.fillStyle = '#000';
  wc.fillRect(0, 0, 360, 50);
  const drawLine = (ctx, h, col, sc2, hMax = 48) => {
    ctx.strokeStyle = col;
    ctx.beginPath();
    h.forEach((v, i) => {
      const y = hMax - Math.min(hMax - 2, v * sc2);
      i ? ctx.lineTo(i * 2, y) : ctx.moveTo(0, y);
    });
    ctx.stroke();
  };
  drawLine(wc, surpHist, '#ff0', 36, 48);
  drawLine(wc, mseHist, '#0ff', 60, 48);
  drawLine(wc, mse5Hist, '#fa0', 60, 48);
  drawLine(wc, varHist, '#f6f', 55, 48);

  // 7) Metacognition & Frenet-Serret Thought Curvature κ(t), τ(t)
  const MC = cr.metacog;
  if ($('metacog') && MC) {
    kapHist.push(MC.kappa);
    tauHist.push(Math.abs(MC.torsion));
    calHist.push(MC.confidence);
    if (kapHist.length > 180) { kapHist.shift(); tauHist.shift(); calHist.shift(); }
    const mctx = $('metacog').getContext('2d');
    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, 360, 44);
    drawLine(mctx, kapHist, '#f0f', 4, 42);
    drawLine(mctx, tauHist, '#0ff', 4, 42);
    drawLine(mctx, calHist, '#0f6', 38, 42);
  }

  const ws = MC?.ws || {};
  const qSrc = cr.qrng.hwHealthy ? `${cr.qrng.hwSource} (${cr.qrng.hwBitsRemaining} hw bits)` : 'local Lindblad MCWF';
  stats($('mindstats'), [
    ['sleep stage / clock', `${STAGES[cr.sleep.stage]} · ${cr.timeCompression}× (${CLOCK_MODES[cr.clockMode]?.label || cr.clockMode})`],
    ['brain scale / backend', `${BRAIN_SCALE} (${b.backend}): ${b.N.toLocaleString()} neu, ${b.S.toLocaleString()} syn, ${(window.glitch.stats.stepMs ?? 0).toFixed(1)} ms/step`],
    ['3-comp laminar CTX / BAC bursts', `L4/L2-3/L5-6 microcolumns · ${b.plateauBursts || 0} apical Ca²⁺ bursts`],
    ['2D retina / V1 Gabor / MT / SLAM', `V1 ${(cr.retina.v1EnergyMean || 0).toFixed(3)} · MT div ${(cr.retina.mtDiv || 0).toFixed(2)} · ${cr.retina.seenCount}/19 (${cr.retina.loopClosures} fixes)`],
    ['trisynaptic EC->DG(5% k-WTA)->CA3->CA1', `CA3 ${cr.hop.X.length}/1024 · CA1 nov ${(cr.hop.ca1Novelty || 0).toFixed(2)} · skipped ${cr.hop.eventsSkipped || 0}`],
    ['Transformer-XL WM (params / 1s / 5s MSE)', `${cr.wm.scaleName} (${(cr.wm.paramCount || 0).toLocaleString()}): ${cr.wm.mse.toFixed(4)} / ${(cr.wm.mse5 || 0).toFixed(4)} (H_attn ${(cr.wm.attnEntropy || 0).toFixed(2)})`],
    ['RTRL SSM |∇| / heteroscedastic σ²', `${(cr.ssm.gradNorm ?? 0).toExponential(1)} / ${(cr.wm.predVar ?? 0).toFixed(3)}`],
    ['thought curvature κ(t) / torsion τ(t)', `${(MC?.kappa ?? 0).toFixed(2)} / ${(MC?.torsion ?? 0).toFixed(2)} (||z′|| ${(MC?.speed ?? 0).toFixed(2)})`],
    ['metacog confidence / regret / temp', `${(MC?.confidence ?? 0).toFixed(2)} / ${(MC?.regret ?? 0).toFixed(2)} / ${(MC?.exploreTemp ?? 1).toFixed(2)}×`],
    ['weight space learned (motor / steer / ctx)', `${((ws.motorLearnedFrac ?? 0) * 100).toFixed(1)}% / ${((ws.steerLearnedFrac ?? 0) * 100).toFixed(1)}% / ${((ws.brainLearnedFrac ?? 0) * 100).toFixed(1)}%`],
    ['EWC Fisher energy / SVD eff-rank', `${(cr.ewcEnergy ?? 0).toExponential(1)} / ${(ws.svdRank ?? 1).toFixed(1)} (bias ${(ws.biasNorm ?? 0).toFixed(2)})`],
    ['Tsotchke 10-qubit Lindblad QRNG', `${((cr.qrng.entropy ?? 0) * 10).toFixed(2)} / 10.00 bits · purity ${(cr.qrng.purity ?? 1).toFixed(3)} · ${cr.qrng.quantumJumps || 0} jumps · ${qSrc}`],
    ['Tsotchke QGTL / Vidal MPS (χ=8)', `Fubini ${(ws.fubiniTrace ?? 0).toFixed(2)} · Berry ${(ws.berryCurv ?? 0).toExponential(1)} · MPS S ${(ws.mpsEntropy ?? 0).toFixed(2)}`],
    ['predictive-coding error / surprise', `${cr.pc.err.toFixed(3)} / ${cr.pc.surprise.toFixed(2)}`],
    ['thirst / water drunk', `${cr.metab.thirst.toFixed(2)} / ${(cr.stats.drinks || 0).toFixed(1)}`],
    ['limb lengths (use-grown)', Array.from(cr.body.limbLen).map((x) => x.toFixed(2)).join(' ')],
    ['sleep consolidations / merged / key loss', `${cr.memStats.consolidations || 0} / ${cr.memStats.merged || 0} / ${cr.hop.conLoss.toFixed(2)}`],
    ['HDC features re-drawn (Wiener coherence)', `${cr.hdcFood.resampled + cr.hdcWater.resampled}`],
    ['synapses pruned+regrown / alignment', `${b.grown} / ${(alignC.v ?? 0).toFixed(2)}`],
    ['heading / position error (nav mode)', `${cr.navErr.hd.toFixed(2)} rad / ${cr.navErr.pos.toFixed(1)} u (${cr.navMode})`],
    ['vestibular gain / grid cells', `${cr.nav.vestGain.toFixed(2)} / ${[0, 1, 2].map((m) => cr.nav.gridRate(m).toFixed(2)).join(' ')}`],
    ['self-model speed / turn', `${cr.selfV.toFixed(2)} u/s / ${cr.selfW.toFixed(2)} rad/s`],
    ['sleep pressure S', cr.sleep.S.toFixed(2)],
    ['goal', cr.goal ? cr.goal.type + (cr.goal.k !== undefined ? ' ' + cr.goal.k : cr.goal.pool !== undefined ? ' pool ' + cr.goal.pool : '') : cr.race ? 'racing…' : '—'],
    ['races / vetoes', `${cr.stats.races} / ${cr.stats.vetoes}`],
    ['fed / tries', `${cr.stats.eats} / ${cr.stats.tries}`],
    ['NREM replays / REM dreams', `${cr.stats.replays} / ${cr.stats.dreams}`],
    ['imagined synergy value', [...cr.Vimg].map((v) => v.toFixed(2)).join(' ')],
    ['STDP events / |Δw|', `${b.stdpEvents} / ${(b.dwLast || 0).toExponential(1)}`],
    ['astrocyte Ca (CTX) / motor RPE δ', `${b.astro[2].toFixed(2)} / ${(cr.motorDelta || 0).toFixed(3)}`],
    ['behaviour entropy (fixed / bias-corr)', `${cr.entropy.toFixed(2)} / ${(cr.entropy2 ?? 0).toFixed(2)} bits (${cr.states || 0}/128)`],
    ['world-model updates', cr.wm.n],
  ]);

  const M = cr.metab, F = cr.fluid, B = cr.body;
  stats($('bodystats'), [
    ['hour', cr.hour.toFixed(2)],
    ['3D Neo-Hookean FEM (78 tets)', `J_mean ${(B.meanTetJ ?? 1).toFixed(3)} · J_min ${(B.minTetJ ?? 1).toFixed(3)} · U_strain ${(B.femEnergy ?? 0).toFixed(3)}`],
    ['1D Navier-Stokes vascular MAP / CVP', `${(F?.mapPressure ?? 70).toFixed(1)} / ${(F?.P?.[11] ?? 7).toFixed(1)} mmHg (CO ${(F?.cardiacOutput ?? 28).toFixed(1)}, Re ${(F?.reynoldsMax ?? 100).toFixed(0)})`],
    ['3D SPH blood / cerebral O₂', `mean ${(F?.meanO2 ?? 0.97).toFixed(3)} · brain ${(F?.o2Node?.[14] ?? 0.97).toFixed(3)} (120 SPH parcels)`],
    ['gut glc/fat/prot', `${M.gut.glc.toFixed(2)} / ${M.gut.fat.toFixed(2)} / ${M.gut.prot.toFixed(2)}`],
    ['blood glucose', M.blood.glc.toFixed(2)],
    ['blood FFA / AA / ketones', `${M.blood.ffa.toFixed(2)} / ${M.blood.aa.toFixed(2)} / ${M.blood.ket.toFixed(2)}`],
    ['liver glycogen', M.liverGly.toFixed(1)],
    ['fat store', M.fat.toFixed(0)],
    ['muscle', M.muscle.toFixed(1)],
    ['insulin / glucagon', `${M.insulin.toFixed(2)} / ${M.glucagon.toFixed(2)}`],
    ['ghrelin / leptin', `${M.ghrelin.toFixed(2)} / ${M.leptin.toFixed(2)}`],
    ['cortisol', M.cortisol.toFixed(2)],
    ['ATP', M.atp.toFixed(2)],
    ['heart rate (baroreflex)', M.hr.toFixed(0)],
    ['water gut / blood', `${M.gut.water.toFixed(2)} / ${M.blood.water.toFixed(2)}`],
    ['bladder / colon', `${M.bladder.toFixed(2)} / ${M.colon.toFixed(2)}`],
    ['urinations / defecations', `${cr.stats.urine} / ${cr.stats.feces}`],
    ['hunger / thirst', `${M.hunger().toFixed(2)} / ${M.thirst.toFixed(2)}`],
    ['body scale (growth)', cr.body.scale.toFixed(3)],
    ['distance travelled', cr.stats.dist.toFixed(1)],
    ['muscle effort Σ|u|', cr.body.energy.toFixed(1)],
  ]);

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
  mc.fillStyle = '#000';
  mc.fillRect(359, 0, 1, 90);
  const dot = (v, col) => { mc.fillStyle = col; mc.fillRect(359, 88 - Math.max(0, Math.min(86, v * 86)), 1, 2); };
  dot(M.blood.glc / 6, '#f36');
  dot(M.insulin, '#0ff');
  dot(M.glucagon, '#ff0');
  dot(M.liverGly / 60, '#a6f');
  dot(M.ghrelin, '#0f6');
  dot(M.cortisol, '#f80');
}

const alignC = { v: 0, t: 0 };

// ---------------------------------------------------------------- events overlay
function drawEvents() {
  const ev = cr.events;
  const el = $('events');
  const last = ev.slice(innerWidth < 640 ? -3 : -5);
  el.innerHTML = last.map((e) => `<div><b>${e.type}</b> ${e.msg}</div>`).join('');
}

// ---------------------------------------------------------------- main loop with adaptive quality & backend sync
let slowT2 = 0, last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, panelT = 0, goodT = 0;
const S = window.glitch.stats;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fpsT += dt;
  fpsN++;
  const t0 = performance.now();
  if (!paused) {
    acc += dt * 60 * speed;
    let n = 0;
    while (acc >= 1 && n < 64) {
      cr.step();
      acc -= 1;
      n++;
      S.stepN = (S.stepN || 0) + 1;
      if (cr.brain.delegated) {
        for (let i = 0; i < R0.THAL; i++) spikeAcc[i] |= cr.brain.spk[i];
        for (let i = R0.STR; i < NNEU; i++) spikeAcc[i] |= cr.brain.spk[i];
      } else {
        for (let i = 0; i < NNEU; i++) spikeAcc[i] |= cr.brain.spk[i];
      }
      if (performance.now() - t0 > 14) { acc = 0; break; }
    }
    if (n > 0 && brainWorker && !workerPending) {
      const dtSim = Math.max(n / 60, Math.min(0.25, cr.t - lastWorkerT));
      lastWorkerT = cr.t;
      workerPending = true;
      const extCopy = new Float32Array(cr.brain.ext);
      const effSteps = Math.max(1, Math.min(12, Math.round(dtSim * 60)));
      brainWorker.postMessage(
        {
          op: 'stepBatch',
          substeps: 8 * effSteps,
          dt: 0.002,
          runSlow: true,
          slowDt: dtSim,
          extBuf: extCopy.buffer,
          stage: cr.sleep.stage,
          nm: cr.brain.nm,
          atonia: cr.brain.atonia,
          achGain: cr.lesion.metacog ? 1 : (cr.metacog?.achGain ?? 1),
          place: !cr.lesion.nav && cr.sleep.stage === 0 ? [cr.nav.px, cr.nav.pz, 1.15] : null,
          v1Complex: !cr.lesion.vision && cr.sleep.stage === 0 ? cr.retina.v1Complex : null,
          ofcApp: cr.race ? cr.ofcApp : null,
          ofcAv: cr.race ? cr.ofcAv : null,
          lesion: cr.brain.lesion,
        },
        [extCopy.buffer]
      );
    } else if (n > 0 && gpuBrain && !gpuBrain.busy) {
      gpuBrain.stepBatch(cr.brain, 8, 0.002);
    }
  }
  cr.speed = speed;
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
    if (view && qMode === 'auto') {
      if (fps < 38 && view.quality > 0) { view.setQuality(view.quality - 1); goodT = 0; }
      else if (fps > 57) { goodT++; if (goodT > 5 && view.quality < qMax) { view.setQuality(view.quality + 1); goodT = 0; } }
      else goodT = 0;
    }
    if (cr.t - alignC.t > 2) { alignC.t = cr.t; alignC.v = cr.brain.alignment(); }
    if (!Q.get('brain') && !cr.brain.delegated && BRAIN_SCALE !== 'S' && S.frames > 300 && (S.stepMs ?? 0) > 12) {
      slowT2 = (slowT2 || 0) + 1;
      if (slowT2 > 5) {
        const nextScale = BRAIN_SCALE === 'XXL' ? 'XL' : BRAIN_SCALE === 'XL' ? 'L' : BRAIN_SCALE === 'L' ? 'M' : 'S';
        const u = new URL(location.href);
        u.searchParams.set('brain', nextScale);
        u.searchParams.set('auto', '1');
        location.replace(u.href);
      }
    } else slowT2 = 0;
    S.quality = view ? view.quality : -1;
    $('hud-q').textContent = (qMode === 'auto' ? 'auto:' : '') + ['low', 'med', 'high', 'ultra'][S.quality];
  }

  panelT += dt;
  if (panelT > 1 / 15) {
    panelT = 0;
    drawPanel();
    drawEvents();
    $('hud-stage').textContent = STAGES[cr.sleep.stage];
    const h = cr.hour;
    $('hud-clock').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- lineage evolution (78-gene Refine + De-Novo Random sep-CMA-ES in Web Workers)
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
      ['genome (78 genes)', lineageInfo ? `evolved in browser (${lineageInfo.mode === 'denovo' ? 'de-novo random, ' : ''}${lineageInfo.gens} gens, CRN fitness ${lineageInfo.fit.toFixed(2)}, stack ${lineageStack.length})` : 'starter (78-gene multi-body CMA-ES, see CHANGELOG pass 16)'],
    ];
    if (lin) {
      const mStr = lin.mode === 'denovo' ? 'de-novo random [0.05,0.95]^78' : 'refine starter';
      rows.push([`mode / gen / σ`, `${mStr} · gen ${lin.gen} / ${lin.sigma.toFixed(3)}${lin.running ? ' (running in workers…)' : ''}`]);
      rows.push(['genomes scored (2-body CRN)', `${lin.evals}${lin.startFit !== null ? ` · initial ${lin.startFit.toFixed(2)}` : ''}`]);
      for (const h of lin.hist.slice(-8)) {
        const dStr = (h.delta >= 0 ? '+' : '') + h.delta.toFixed(2);
        rows.push([
          `gen ${h.gen} (bodies ${h.seeds})`,
          `fitness ${h.mean.toFixed(2)} (${dStr}) · turn ${h.turn.toFixed(2)} rad/s · fwd ${h.v.toFixed(2)} u/s · up ${h.up.toFixed(2)} · goal ${h.goal.toFixed(2)}`,
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
      lin.run(10).catch((e) => {
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
    globalThis.TW = { ...(globalThis.TW || {}), genome: g };
    lin = null;
    restart();
    show();
  };
  if ($('evo-undo')) {
    $('evo-undo').onclick = () => {
      if (!lineageStack.length) return;
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
