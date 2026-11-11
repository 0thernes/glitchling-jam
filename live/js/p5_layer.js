// p5.js Procedural Living Biomaterial Textures & Interactive A-Life Telemetry Studio (pass 17)
// Uses local bundled p5.js v1.11.3 (instance mode) to:
//   1) Paint a 512x512 Voronoi dermal scute / chromatophore / bioluminescent capillary texture -> THREE.CanvasTexture
//   2) Paint a 256x256 mycelial fungal network + 64x64x3 pheromone plume ground overlay -> THREE.CanvasTexture
//   3) Drive the interactive 5-tab #p5-studio scientific canvas overlay (PiP Corner / Split Studio / Hidden).

import * as THREE from 'three';
import { clamp } from './sim/util.js';
import { WORLD } from './sim/world.js';

export const P5_VIEWS = [
  { id: 0, short: 'HH + Hip', title: '4-Comp HH Pyramidal & Spiking Trisynaptic Hippocampus' },
  { id: 1, short: 'Biosphere', title: '64×64×3 Pheromones, Mycelia & Multi-Agent Biosphere' },
  { id: 2, short: 'Phylogeny', title: 'Live Cladogram & 92-Gene Evo-Devo Morphospace' },
  { id: 3, short: 'Fovea + IT', title: '64×32 Log-Polar Fovea, +2.0s Pixel WM & 24-Unit IT' },
  { id: 4, short: '12Q + MERA', title: '12-Qubit WASM Lindblad Rose & Binary MERA Tree' },
];

export class P5Layer {
  constructor(studioMount) {
    this.mount = studioMount;
    this.mode = 'pip'; // 'pip' | 'split' | 'off'
    this.viewIdx = 1;  // Default to live Biosphere & Pheromone map in PiP!
    this.frame = 0;
    this.cr = null;

    // Offscreen 2D canvases backed by p5 instance graphics (with pure Canvas2D fallback if p5 not yet ready)
    this.dermalCanvas = document.createElement('canvas');
    this.dermalCanvas.width = 512;
    this.dermalCanvas.height = 512;
    this.dermalCtx = this.dermalCanvas.getContext('2d');

    this.bioCanvas = document.createElement('canvas');
    this.bioCanvas.width = 256;
    this.bioCanvas.height = 256;
    this.bioCtx = this.bioCanvas.getContext('2d');
    this._pherImg = this.bioCtx.createImageData(64, 64);
    this._pherTmpCanvas = document.createElement('canvas');
    this._pherTmpCanvas.width = 64;
    this._pherTmpCanvas.height = 64;
    this._pherTmpCtx = this._pherTmpCanvas.getContext('2d');

    // Precompute 110 Voronoi scute cell seeds on [0, 512)^2 for organic reptilian-amphibian dermal tiling
    this.scutes = [];
    let s = 1337;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 110; i++) {
      this.scutes.push({
        x: rnd() * 512,
        y: rnd() * 512,
        r: 16 + rnd() * 20,
        ph: rnd() * Math.PI * 2,
        hueOff: (rnd() - 0.5) * 0.14,
      });
    }

    this.dermalTex = new THREE.CanvasTexture(this.dermalCanvas);
    this.dermalTex.wrapS = THREE.RepeatWrapping;
    this.dermalTex.wrapT = THREE.RepeatWrapping;
    this.dermalTex.colorSpace = THREE.SRGBColorSpace;

    this.bioTex = new THREE.CanvasTexture(this.bioCanvas);
    this.bioTex.wrapS = THREE.ClampToEdgeWrapping;
    this.bioTex.wrapT = THREE.ClampToEdgeWrapping;
    this.bioTex.colorSpace = THREE.SRGBColorSpace;

    // Rolling trace history for 4-compartment HH oscilloscope
    this.hhHist = {
      ais: new Float32Array(120),
      soma: new Float32Array(120),
      basal: new Float32Array(120),
      apical: new Float32Array(120),
      ptr: 0,
    };

    this._paintDermalBase(0.72, 0, 0.3, 0);
    this._initP5Studio();
  }

  setMode(mode) {
    this.mode = mode;
    if (!this.mount) return;
    this.mount.dataset.mode = mode;
    this.mount.style.display = mode === 'off' ? 'none' : 'flex';
    if (this.p5Inst) {
      const w = mode === 'split' ? 460 : 300;
      const h = mode === 'split' ? 340 : 216;
      this.p5Inst.resizeCanvas(w, h);
    }
  }

  cycleMode() {
    const next = this.mode === 'pip' ? 'split' : this.mode === 'split' ? 'off' : 'pip';
    this.setMode(next);
    return next;
  }

  setView(idx) {
    this.viewIdx = ((idx % P5_VIEWS.length) + P5_VIEWS.length) % P5_VIEWS.length;
    if (this.mount) {
      this.mount.querySelectorAll('[data-p5tab]').forEach((b) => {
        b.classList.toggle('on', +b.dataset.p5tab === this.viewIdx);
      });
      const titleEl = this.mount.querySelector('.p5-title');
      if (titleEl) titleEl.textContent = P5_VIEWS[this.viewIdx].title;
    }
  }

  _initP5Studio() {
    if (!this.mount) return;
    this.mount.innerHTML = `
      <div class="p5-hdr">
        <span class="p5-badge">p5.js LIVE</span>
        <span class="p5-title">${P5_VIEWS[this.viewIdx].title}</span>
        <div class="p5-actions">
          <button type="button" class="p5-sz" title="Expand / Shrink p5 Studio">⤢</button>
          <button type="button" class="p5-x" title="Hide p5 Studio (P)">✕</button>
        </div>
      </div>
      <div class="p5-tabs">
        ${P5_VIEWS.map((v) => `<button type="button" data-p5tab="${v.id}" class="${v.id === this.viewIdx ? 'on' : ''}">${v.id + 1}·${v.short}</button>`).join('')}
      </div>
      <div class="p5-canvas-wrap"></div>
    `;
    this.mount.querySelectorAll('[data-p5tab]').forEach((btn) => {
      btn.addEventListener('click', () => this.setView(+btn.dataset.p5tab));
    });
    this.mount.querySelector('.p5-sz')?.addEventListener('click', () => {
      this.setMode(this.mode === 'pip' ? 'split' : 'pip');
    });
    this.mount.querySelector('.p5-x')?.addEventListener('click', () => {
      this.setMode('off');
    });

    const wrap = this.mount.querySelector('.p5-canvas-wrap');
    const P5Ctor = window.p5;
    if (!P5Ctor || !wrap) {
      this.setMode(this.mode);
      return;
    }
    P5Ctor.disableFriendlyErrors = true;

    const self = this;
    this.p5Inst = new P5Ctor((p) => {
      p.setup = () => {
        const w = self.mode === 'split' ? 460 : 300;
        const h = self.mode === 'split' ? 340 : 216;
        const cnv = p.createCanvas(w, h);
        cnv.parent(wrap);
        p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        p.noLoop(); // Stepped deterministically from main RAF loop so zero wasted background ticks!
      };
      p.draw = () => {
        if (!self.cr || self.mode === 'off') return;
        self._drawStudio(p, self.cr);
      };
    });
    this.setMode(this.mode);
  }

  _hsl(h, s, l, a = 1) {
    const hh = ((h % 1) + 1) % 1;
    return `hsla(${(hh * 360).toFixed(1)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%, ${a.toFixed(3)})`;
  }

  _paintDermalBase(hue, camo, da, heartPh) {
    const ctx = this.dermalCtx;
    const baseHue = hue;
    // Deep dermal melanin/iridescent ground
    const grd = ctx.createLinearGradient(0, 0, 512, 512);
    const l0 = 0.24 - 0.1 * camo;
    grd.addColorStop(0, this._hsl(baseHue, 0.58 - 0.35 * camo, l0));
    grd.addColorStop(0.5, this._hsl(baseHue + 0.08, 0.64 - 0.35 * camo, l0 + 0.08));
    grd.addColorStop(1, this._hsl(baseHue - 0.06, 0.55 - 0.35 * camo, l0 + 0.02));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 512);

    // Organic hexagonal/Voronoi-like dermal scutes + pulsing bioluminescent chromatophore rings
    const pulse = 0.5 + 0.5 * Math.sin(heartPh * Math.PI * 2);
    for (let i = 0; i < this.scutes.length; i++) {
      const sc = this.scutes[i];
      const locPulse = 0.5 + 0.5 * Math.sin(heartPh * Math.PI * 2 + sc.ph);
      const rad = sc.r * (0.88 + 0.14 * locPulse * (1 - 0.5 * camo));
      const h = baseHue + sc.hueOff + 0.06 * da;
      for (const ox of [0, -512, 512]) {
        for (const oy of [0, -512, 512]) {
          const cx = sc.x + ox, cy = sc.y + oy;
          if (cx < -40 || cx > 552 || cy < -40 || cy > 552) continue;
          const rg = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
          rg.addColorStop(0, this._hsl(h + 0.12, 0.85 - 0.4 * camo, 0.52 + 0.18 * pulse * (1 - camo), 0.88));
          rg.addColorStop(0.62, this._hsl(h, 0.65 - 0.3 * camo, 0.30, 0.55));
          rg.addColorStop(1, this._hsl(h - 0.05, 0.4, 0.12, 0.0));
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Fine branching bioluminescent dermal capillaries
    ctx.strokeStyle = this._hsl(baseHue + 0.38, 0.9, 0.64, 0.22 + 0.22 * pulse * (1 - camo));
    ctx.lineWidth = 1.35;
    for (let k = 0; k < 18; k++) {
      ctx.beginPath();
      let x = (k / 18) * 512;
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 32) {
        const dx = 18 * Math.sin(y * 0.024 + k * 1.3 + heartPh * Math.PI * 2);
        ctx.lineTo(x + dx, y);
      }
      ctx.stroke();
    }
    this.dermalTex.needsUpdate = true;
  }

  _paintBiosphereOverlay(cr) {
    const W = cr.world;
    const ctx = this.bioCtx;
    ctx.clearRect(0, 0, 256, 256);

    // 1) Blit 64x64x3 reaction-diffusion pheromone plumes (R=alarm, G=food, B=mate) + soil N fertility
    const P = W.pher;
    const sN = W.soilN;
    const img = this._pherImg.data;
    for (let iz = 0; iz < 64; iz++) {
      const sz = iz >> 1;
      for (let ix = 0; ix < 64; ix++) {
        const sx = ix >> 1;
        const pOff = (iz * 64 + ix) * 3;
        const food = P[pOff];
        const alarm = P[pOff + 1];
        const mate = P[pOff + 2];
        const fert = Math.max(0, (sN[sz * 32 + sx] || 0.45) - 0.42);
        const o = (iz * 64 + ix) * 4;
        img[o] = Math.min(255, (alarm * 195 + mate * 165) | 0);
        img[o + 1] = Math.min(255, (food * 185 + fert * 65 + mate * 35) | 0);
        img[o + 2] = Math.min(255, (mate * 220 + food * 95 + fert * 85) | 0);
        const alpha = Math.min(210, ((food + alarm + mate) * 105 + fert * 55) | 0);
        img[o + 3] = alpha;
      }
    }
    this._pherTmpCtx.putImageData(this._pherImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this._pherTmpCanvas, 0, 0, 256, 256);

    // 2) Glowing underground mycelial fungal hyphae connecting flora
    if (W.mycelia) {
      const toPx = (v) => ((v / (2 * WORLD)) + 0.5) * 256;
      for (let i = 0; i < W.mycelia.length; i++) {
        const m = W.mycelia[i];
        const pa = W.plants[m.a], pb = W.plants[m.b];
        if (!pa || !pb) continue;
        const x1 = toPx(pa.x), y1 = toPx(pa.z), x2 = toPx(pb.x), y2 = toPx(pb.z);
        const glow = clamp(0.18 + m.flux * 18 + 0.25 * (pa.stress + pb.stress), 0.16, 0.85);
        ctx.strokeStyle = pa.stress + pb.stress > 0.25
          ? `rgba(255, 145, 70, ${glow.toFixed(2)})`
          : `rgba(90, 235, 195, ${glow.toFixed(2)})`;
        ctx.lineWidth = 1.2 + 1.6 * m.cond;
        ctx.beginPath();
        const mx = 0.5 * (x1 + x2) + 8 * Math.sin(i * 2.1 + cr.t * 0.8);
        const my = 0.5 * (y1 + y2) + 8 * Math.cos(i * 1.7 + cr.t * 0.8);
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();
      }
    }
    this.bioTex.needsUpdate = true;
  }

  update(cr) {
    this.cr = cr;
    this.frame++;

    // Sample representative cortical L5 pyramidal neuron into HH 4-compartment trace history
    const br = cr.brain;
    if (br && br.v && br.vAIS && br.vBasal && br.apical) {
      const g = Math.min(br.N - 1, Math.floor(br.N * 0.35));
      const p = this.hhHist.ptr;
      this.hhHist.ais[p] = br.vAIS[g] || 0;
      this.hhHist.soma[p] = br.v[g] || 0;
      this.hhHist.basal[p] = br.vBasal[g] || 0;
      this.hhHist.apical[p] = br.apical[g] || 0;
      this.hhHist.ptr = (p + 1) % this.hhHist.ais.length;
    }

    // Refresh living p5/Canvas dermal texture at 12 Hz & biosphere overlay at 10 Hz
    if (this.frame % 5 === 1) {
      this._paintDermalBase(
        cr.gen.pigmentHue ?? 0.72,
        cr.camoLevel ?? 0,
        cr.brain?.nm?.DA ?? 0.3,
        cr.fluid?.heartPhase ?? 0
      );
    }
    if (this.frame % 6 === 2) {
      this._paintBiosphereOverlay(cr);
    }
    if (this.mode !== 'off' && this.p5Inst && this.frame % 2 === 0) {
      this.p5Inst.redraw();
    }
  }

  _drawStudio(p, cr) {
    const w = p.width, h = p.height;
    p.background(9, 12, 18, 245);

    switch (this.viewIdx) {
      case 0: this._drawHHAndHippocampus(p, cr, w, h); break;
      case 1: this._drawBiosphereMap(p, cr, w, h); break;
      case 2: this._drawPhylogenyAndMorph(p, cr, w, h); break;
      case 3: this._drawFoveaAndIT(p, cr, w, h); break;
      case 4: this._drawQuantumMERA(p, cr, w, h); break;
    }
  }

  _drawHHAndHippocampus(p, cr, w, h) {
    const pad = 10, midY = h * 0.54;
    p.noStroke();
    p.fill(155, 210, 255);
    p.textSize(10);
    p.text(`4-Comp HH Cable (AIS·Soma·Basal·Apical) · BAC ${Math.round(cr.brain.plateauBursts || 0)} · I_h ${(cr.brain.ihMean || cr.brain.ihSagMean || 0.24).toFixed(2)}`, pad, 14);

    const traces = [
      { arr: this.hhHist.ais, col: [255, 115, 135], lbl: 'AIS Na_v' },
      { arr: this.hhHist.soma, col: [110, 225, 255], lbl: 'Soma' },
      { arr: this.hhHist.basal, col: [130, 240, 165], lbl: 'Basal' },
      { arr: this.hhHist.apical, col: [255, 195, 95], lbl: 'Apical Ca/HCN' },
    ];
    const n = this.hhHist.ais.length, ptr = this.hhHist.ptr;
    p.noFill();
    for (let t = 0; t < traces.length; t++) {
      const tr = traces[t];
      p.stroke(tr.col[0], tr.col[1], tr.col[2], 215);
      p.strokeWeight(1.3);
      p.beginShape();
      for (let i = 0; i < n; i++) {
        const v = tr.arr[(ptr + i) % n];
        const x = pad + (i / (n - 1)) * (w - 2 * pad);
        const y = 24 + (midY - 32) * (1 - clamp((v + 0.3) / 1.5, 0, 1));
        p.vertex(x, y);
      }
      p.endShape();
      p.noStroke();
      p.fill(tr.col[0], tr.col[1], tr.col[2]);
      p.text(tr.lbl, pad + t * ((w - 20) / 4), midY - 2);
    }

    // Bottom half: Biophysical Spiking Trisynaptic Hippocampus (EC -> DG -> CA3 -> CA1 + SWRs)
    const cir = cr.hop?.spikingCircuit;
    p.fill(185, 175, 255);
    p.text(`Spiking Trisynaptic (964 LIF+NMDA) · SWRs ${cr.hop?.swrRipples ?? 0} · DG active ${((cr.hop?.dgSparsity ?? 0.05) * 100).toFixed(1)}%`, pad, midY + 14);
    const pops = [
      { name: 'EC II/III', val: cir ? cir.meanEC || 0.32 : 0.32, col: [110, 200, 255] },
      { name: 'DG (576)', val: clamp((cr.hop?.dgSparsity ?? 0.05) * 8, 0.05, 1), col: [110, 245, 175] },
      { name: 'CA3 NMDA', val: clamp(1 - (cr.hop?.ca1Novelty ?? 0.3), 0.1, 1), col: [255, 195, 100] },
      { name: 'CA1 Mis.', val: clamp(cr.hop?.ca1Novelty ?? 0.25, 0.05, 1), col: [255, 120, 175] },
    ];
    const bw = (w - 2 * pad - 24) / 4;
    for (let i = 0; i < 4; i++) {
      const bx = pad + i * (bw + 8), by = midY + 24, bh = h - by - 18;
      p.fill(24, 30, 44);
      p.rect(bx, by, bw, bh, 3);
      const fh = bh * pops[i].val;
      p.fill(pops[i].col[0], pops[i].col[1], pops[i].col[2], 210);
      p.rect(bx, by + bh - fh, bw, fh, 3);
      p.fill(210, 220, 235);
      p.textSize(9);
      p.text(pops[i].name, bx + 2, h - 5);
    }
  }

  _drawBiosphereMap(p, cr, w, h) {
    const W = cr.world, eco = cr.eco;
    const sz = Math.min(w - 92, h - 16);
    const ox = 8, oy = 8;
    const mapX = (x) => ox + ((x / (2 * WORLD)) + 0.5) * sz;
    const mapZ = (z) => oy + ((z / (2 * WORLD)) + 0.5) * sz;

    p.stroke(55, 75, 105);
    p.fill(14, 20, 28);
    p.rect(ox, oy, sz, sz, 4);

    // Draw p5 biosphere pheromone/mycelial canvas directly into the map!
    p.drawingContext.drawImage(this.bioCanvas, ox, oy, sz, sz);

    // Pools, vents, shelters & plants
    p.noStroke();
    for (const pl of W.pools) {
      p.fill(55, 155, 245, 150);
      p.circle(mapX(pl.x), mapZ(pl.z), (pl.r / WORLD) * sz);
    }
    for (const v of W.vents || []) {
      p.fill(255, 115, 45, 210);
      p.circle(mapX(v.x), mapZ(v.z), 7 + 2 * Math.sin(cr.t * 4));
    }
    for (const q of W.plants) {
      p.fill(90, 235, 130, 90 + 155 * q.fruit);
      p.circle(mapX(q.x), mapZ(q.z), 3.5 + 3 * q.fruit);
    }

    if (eco) {
      // Eggs
      for (const eg of eco.eggs) {
        p.fill(255, 240, 150);
        p.circle(mapX(eg.x), mapZ(eg.z), 4.2);
      }
      // Conspecifics
      for (const pr of eco.peers) {
        p.fill(180 + 70 * Math.cos(pr.gen.pigmentHue * 6.28), 150 + 80 * Math.sin(pr.gen.pigmentHue * 6.28), 245);
        p.circle(mapX(pr.x), mapZ(pr.z), 4.5 + 2.5 * pr.scale);
      }
      // Predators
      for (const lv of eco.predators) {
        p.stroke(255, 55, 80);
        p.fill(40, 10, 22, 230);
        p.circle(mapX(lv.x), mapZ(lv.z), 8.5);
        p.noStroke();
      }
    }

    // Focal creature
    const c = cr.body.com();
    p.stroke(255);
    p.strokeWeight(1.4);
    p.fill(90, 245, 255);
    p.circle(mapX(c[0]), mapZ(c[2]), 7.5);
    p.noStroke();

    // Right legend column
    const lx = ox + sz + 8;
    p.fill(205, 220, 240);
    p.textSize(9.5);
    const lines = [
      `Season: ${W.season}`,
      `Temp: ${cr.bodyTemp.toFixed(1)}°C`,
      `Peers: ${eco ? eco.peers.length : 0}`,
      `Eggs: ${eco ? eco.eggs.length : 0}`,
      `Births: ${eco ? eco.stats.births : 0}`,
      `MaxGen: ${eco ? eco.stats.maxGen : 0}`,
      `Mites: ${eco ? eco.mites.length : 0}`,
      `Soil N: ${(W.meanSoilN || 0.45).toFixed(2)}`,
      `Pher: ${(W.pherMean || 0).toFixed(3)}`,
      `Camo: ${(cr.camoLevel * 100).toFixed(0)}%`,
    ];
    lines.forEach((ln, i) => p.text(ln, lx, 18 + i * 16));
  }

  _drawPhylogenyAndMorph(p, cr, w, h) {
    const midX = w * 0.52;
    p.noStroke();
    p.fill(165, 225, 255);
    p.textSize(9.5);
    p.text('92-Gene Evo-Devo Morphospace', 8, 14);
    p.text(`Phylogeny (${cr.eco?.lineageTree?.length ?? 1} nodes)`, midX + 4, 14);

    // Left: 10-spoke radar plot of focal 3D morphological & neuro-developmental genes
    const keys = [
      ['bodyLen', 0.78, 1.28], ['bodyGirth', 0.78, 1.28], ['crestFin', 0, 1], ['tailFluke', 0, 1],
      ['foreLimb', 0.78, 1.32], ['hindLimb', 0.78, 1.32], ['eyeSize', 0.75, 1.4], ['stalkLen', 0.75, 1.4],
      ['neuroHipAlloc', 0.75, 1.35], ['neuroCtxPlastic', 0.7, 1.35],
    ];
    const cx = midX * 0.48, cy = h * 0.56, rad = Math.min(cx - 16, h * 0.37);
    p.stroke(45, 62, 88);
    p.noFill();
    p.circle(cx, cy, rad * 2);
    p.circle(cx, cy, rad);

    p.fill(95, 225, 255, 75);
    p.stroke(95, 225, 255, 230);
    p.strokeWeight(1.5);
    p.beginShape();
    for (let i = 0; i < keys.length; i++) {
      const [k, lo, hi] = keys[i];
      const u = clamp(((cr.gen[k] ?? (lo + hi) * 0.5) - lo) / (hi - lo), 0.08, 1);
      const a = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
      p.vertex(cx + Math.cos(a) * rad * u, cy + Math.sin(a) * rad * u);
    }
    p.endShape(p.CLOSE);

    // Right: Live multi-generational phylogeny cladogram
    const tree = cr.eco?.lineageTree || [{ id: 0, gen: 0, hue: cr.gen.pigmentHue ?? 0.72 }];
    const recent = tree.slice(-14);
    const tx0 = midX + 12, tw = w - tx0 - 12;
    p.strokeWeight(1.1);
    recent.forEach((nd, idx) => {
      const x = tx0 + Math.min(1, (nd.gen || 0) / 5) * (tw - 20);
      const y = 28 + (idx / Math.max(1, recent.length - 1)) * (h - 42);
      p.stroke(110, 160, 210, 130);
      p.line(tx0, y, x, y);
      p.noStroke();
      p.fill(150 + 95 * Math.cos((nd.hue || 0.7) * 6.28), 185, 245);
      p.circle(x, y, 6);
      p.fill(195, 210, 230);
      p.textSize(8.5);
      p.text(`G${nd.gen || 0}#${nd.id}`, x + 6, y + 3);
    });
  }

  _drawFoveaAndIT(p, cr, w, h) {
    const rt = cr.retina, wm = cr.wm;
    p.noStroke();
    p.fill(165, 225, 255);
    p.textSize(9.5);
    p.text(`64×32 Log-Polar Fovea (${rt.nReceptors} ch) · IT Invar ${(rt.itInvariance * 100).toFixed(0)}%`, 8, 14);

    // Sample downsampled 32x16 binocular L sheet preview
    const cellW = Math.max(2, Math.floor((w * 0.54) / 32));
    const cellH = Math.max(2, Math.floor((h * 0.44) / 16));
    for (let vy = 0; vy < 16; vy++) {
      for (let vx = 0; vx < 32; vx++) {
        const idx = ((vy * 2) * 64 + (vx * 2)) * 3;
        p.fill(rt.retL[idx] * 255, rt.retL[idx + 1] * 255, rt.retL[idx + 2] * 255);
        p.rect(8 + vx * cellW, 22 + vy * cellH, cellW, cellH);
      }
    }

    // Right: Transformer-XL +0.1s & +2.0s predicted 8x4 RGB foveal patch!
    const px0 = 16 + 32 * cellW;
    p.fill(210, 225, 245);
    p.textSize(8.5);
    p.text('WM +0.1s / +2.0s px', px0, 28);
    const pw = Math.max(4, Math.floor((w - px0 - 10) / 8));
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 8; px++) {
        const o = (py * 8 + px) * 3;
        p.fill((wm.visPred[o] || 0) * 255, (wm.visPred[o + 1] || 0) * 255, (wm.visPred[o + 2] || 0) * 255);
        p.rect(px0 + px * pw, 34 + py * pw, pw, pw);
        p.fill((wm.vis20Buf[o] || 0) * 255, (wm.vis20Buf[o + 1] || 0) * 255, (wm.vis20Buf[o + 2] || 0) * 255);
        p.rect(px0 + px * pw, 42 + 4 * pw + py * pw, pw, pw);
      }
    }

    // Bottom: 24 IT invariant object-category bars
    const by0 = h * 0.62, bh = h - by0 - 14;
    p.fill(185, 200, 255);
    p.text(`Ventral IT 24 Invariant Prototypes · WM visMSE ${wm.visMSE.toFixed(4)} / +2s ${wm.visMSE20.toFixed(4)}`, 8, by0 - 3);
    const bw = (w - 20) / 24;
    for (let i = 0; i < 24; i++) {
      const a = clamp(rt.itAct[i] || 0, 0, 1);
      p.fill(i === rt.itTopCat ? 255 : 95, i === rt.itTopCat ? 195 : 210, 255, 215);
      p.rect(10 + i * bw, by0 + bh * (1 - a), Math.max(2, bw - 1.5), bh * a);
    }
  }

  _drawQuantumMERA(p, cr, w, h) {
    const q = cr.qrng, mc = cr.metacog;
    p.noStroke();
    p.fill(180, 225, 255);
    p.textSize(9.5);
    const sVn = ((q.entropy ?? 0) * (q.nQubits || 12)).toFixed(2);
    p.text(`12-Qubit WASM (${q.nQubits || 12}q · 4,096 dim · ${q.wasmActive ? 'SIMD/WASM' : 'JS'}) · S_vN ${sVn}b · ${q.hwSource || q.beaconSource || 'Lindblad'}`, 8, 14);

    // Left: 64-petal Hilbert amplitude/phase rose over 4,096-state register
    const cx = w * 0.28, cy = h * 0.56, rad = Math.min(cx - 14, h * 0.36);
    p.stroke(45, 65, 95);
    p.noFill();
    p.circle(cx, cy, rad * 2);
    const re = q.re || q.psiRe, im = q.im || q.psiIm;
    if (re && im) {
      for (let k = 0; k < 64; k++) {
        const idx = k * 64;
        const mag = clamp(Math.hypot(re[idx], im[idx]) * 48, 0.06, 1.0);
        const ph = Math.atan2(im[idx], re[idx]);
        const ang = (k / 64) * Math.PI * 2;
        p.stroke(130 + 115 * Math.cos(ph), 165 + 80 * Math.sin(ph), 255, 210);
        p.line(cx, cy, cx + Math.cos(ang) * rad * mag, cy + Math.sin(ang) * rad * mag);
      }
    }

    // Right: 3-Scale Binary MERA Entanglement Renormalization Tree + chi=16 MPS
    const mx = w * 0.56, mw = w - mx - 12;
    const ms = mc.ws?.meraScales || mc.meraScaleS || [0, 0, 0];
    p.noStroke();
    p.fill(210, 195, 255);
    p.text(`Binary MERA S=[${(ms[0] ?? 0).toFixed(2)}, ${(ms[1] ?? 0).toFixed(2)}, ${(ms[2] ?? 0).toFixed(2)}]`, mx, 30);
    p.text(`Vidal MPS χ=16 S_mean ${(mc.ws?.mpsEntropy ?? 0).toFixed(2)}b`, mx, 44);

    const levels = [8, 4, 2, 1];
    for (let lv = 0; lv < levels.length; lv++) {
      const cnt = levels[lv];
      const y = h - 18 - lv * ((h - 72) / 3);
      for (let i = 0; i < cnt; i++) {
        const x = mx + ((i + 0.5) / cnt) * mw;
        if (lv < levels.length - 1) {
          const px = mx + ((Math.floor(i / 2) + 0.5) / levels[lv + 1]) * mw;
          const py = h - 18 - (lv + 1) * ((h - 72) / 3);
          p.stroke(135, 195, 255, 150);
          p.line(x, y, px, py);
        }
        p.noStroke();
        p.fill(lv === 3 ? 255 : 110, 215, 255);
        p.circle(x, y, 6.5);
      }
    }
  }
}
