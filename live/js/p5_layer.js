// p5.js Procedural Living Biomaterial Textures & Interactive A-Life Telemetry Studio (pass 18)
// Uses local bundled p5.js v1.11.3 (instance mode) to:
//   1) Paint a 512x512 Voronoi osteoderm scute / chromatophore / bioluminescent capillary texture -> THREE.CanvasTexture
//   2) Paint a 256x256 saprotrophic microbe + phytoplankton bloom + mycelial network + 64x64x3 pheromone ground overlay -> THREE.CanvasTexture
//   3) Drive the interactive 5-tab #p5-studio scientific canvas overlay (PiP Corner / Split Studio / Hidden).

import * as THREE from 'three';
import { clamp } from './sim/util.js';
import { WORLD } from './sim/world.js';

export const P5_VIEWS = [
  { id: 0, short: '8cHH+Hip', title: '8-Comp HH+NMDA+SK Arbour & 4,608-Neu Hippocampus–Subiculum' },
  { id: 1, short: 'Biosphere', title: '1.4M+ Microbe Continuum, 32-Peer Clades & 64×64×3 Plumes' },
  { id: 2, short: '108G Hox', title: '108-Gene Hox 4/6/8-Limb Morphospace & Live Cladogram' },
  { id: 3, short: 'Fovea+Flow', title: '128×64 P/M/K Fovea, 16×8 Flow WM & 4,096 PQ-IT Concepts' },
  { id: 4, short: '14Q+ZNE', title: '14-Qubit WASM (16,384-D), Richardson ZNE & 4-Layer χ=24 MERA' },
];

export class P5Layer {
  constructor(studioMount) {
    this.mount = studioMount;
    this.mode = 'pip'; // 'pip' | 'split' | 'off'
    this.viewIdx = 1;  // Default to live Biosphere & Microbial/Pheromone map in PiP!
    this.frame = 0;
    this.cr = null;

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

    // Precompute 136 organic polygonal osteoderm / chromatophore scute seeds on [0, 512)^2
    this.scutes = [];
    let s = 1337;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 136; i++) {
      this.scutes.push({
        x: rnd() * 512,
        y: rnd() * 512,
        r: 13 + rnd() * 19,
        ph: rnd() * Math.PI * 2,
        hueOff: (rnd() - 0.5) * 0.15,
        sides: 5 + Math.floor(rnd() * 3),
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

    // Rolling trace history for 8-compartment branched HH+NMDA+SK cable oscilloscope
    this.hhHist = {
      ais: new Float32Array(120),
      soma: new Float32Array(120),
      basalNMDA: new Float32Array(120),
      trunkHCN: new Float32Array(120),
      tuftCaSK: new Float32Array(120),
      ptr: 0,
    };

    this._paintDermalBase(0.72, 0, 0.3, 0, 0.45);
    this._initP5Studio();
  }

  setMode(mode) {
    this.mode = mode;
    if (!this.mount) return;
    this.mount.dataset.mode = mode;
    this.mount.style.display = mode === 'off' ? 'none' : 'flex';
    if (this.p5Inst) {
      const w = mode === 'split' ? 468 : 306;
      const h = mode === 'split' ? 344 : 220;
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
        <span class="p5-badge">p5.js STUDIO</span>
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
        const w = self.mode === 'split' ? 468 : 306;
        const h = self.mode === 'split' ? 344 : 220;
        const cnv = p.createCanvas(w, h);
        cnv.parent(wrap);
        p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        p.noLoop();
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

  _paintDermalBase(hue, camo, da, heartPh, osteo = 0.45) {
    const ctx = this.dermalCtx;
    const baseHue = hue;
    const grd = ctx.createLinearGradient(0, 0, 512, 512);
    const l0 = 0.22 - 0.09 * camo;
    grd.addColorStop(0, this._hsl(baseHue, 0.62 - 0.35 * camo, l0));
    grd.addColorStop(0.5, this._hsl(baseHue + 0.09, 0.68 - 0.35 * camo, l0 + 0.08));
    grd.addColorStop(1, this._hsl(baseHue - 0.05, 0.58 - 0.35 * camo, l0 + 0.03));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 512);

    const pulse = 0.5 + 0.5 * Math.sin(heartPh * Math.PI * 2);
    for (let i = 0; i < this.scutes.length; i++) {
      const sc = this.scutes[i];
      const locPulse = 0.5 + 0.5 * Math.sin(heartPh * Math.PI * 2 + sc.ph);
      const rad = sc.r * (0.86 + 0.16 * locPulse * (1 - 0.5 * camo));
      const h = baseHue + sc.hueOff + 0.06 * da;
      for (const ox of [0, -512, 512]) {
        for (const oy of [0, -512, 512]) {
          const cx = sc.x + ox, cy = sc.y + oy;
          if (cx < -40 || cx > 552 || cy < -40 || cy > 552) continue;
          const rg = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
          rg.addColorStop(0, this._hsl(h + 0.14, 0.88 - 0.4 * camo, 0.55 + 0.18 * pulse * (1 - camo), 0.90));
          rg.addColorStop(0.58, this._hsl(h + 0.03, 0.70 - 0.3 * camo, 0.31 + 0.08 * osteo, 0.62));
          rg.addColorStop(1, this._hsl(h - 0.06, 0.42, 0.10, 0.0));
          ctx.fillStyle = rg;
          ctx.beginPath();
          for (let k = 0; k < sc.sides; k++) {
            const a = (k / sc.sides) * Math.PI * 2 + sc.ph * 0.25;
            const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Branching bioluminescent vascular capillaries coupled to D3Q19 / WCSPH heartbeat
    ctx.strokeStyle = this._hsl(baseHue + 0.36, 0.92, 0.66, 0.24 + 0.24 * pulse * (1 - camo));
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 20; k++) {
      ctx.beginPath();
      const x = (k / 20) * 512;
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 28) {
        const dx = 16 * Math.sin(y * 0.025 + k * 1.3 + heartPh * Math.PI * 2);
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

    // 1) Blit 64x64x3 pheromones + 64x64 saprotrophic microbes & bioluminescent aquatic phytoplankton!
    const P = W.pher;
    const MG = W.microbeGrid;
    const PG = W.planktonGrid;
    const img = this._pherImg.data;
    for (let iz = 0; iz < 64; iz++) {
      for (let ix = 0; ix < 64; ix++) {
        const cIdx = iz * 64 + ix;
        const pOff = cIdx * 3;
        const food = P[pOff];
        const alarm = P[pOff + 1];
        const mate = P[pOff + 2];
        const mic = MG ? Math.max(0, MG[cIdx] - 0.26) : 0;
        const plk = PG ? PG[cIdx] * 0.45 : 0;
        const o = cIdx * 4;
        img[o] = Math.min(255, (alarm * 195 + mate * 165 + mic * 28) | 0);
        img[o + 1] = Math.min(255, (food * 185 + mic * 95 + plk * 165 + mate * 35) | 0);
        img[o + 2] = Math.min(255, (mate * 220 + plk * 215 + food * 90 + mic * 65) | 0);
        const alpha = Math.min(215, ((food + alarm + mate) * 105 + mic * 52 + plk * 92) | 0);
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
        const glow = clamp(0.16 + m.flux * 16 + 0.24 * (pa.stress + pb.stress), 0.14, 0.82);
        ctx.strokeStyle = pa.stress + pb.stress > 0.25
          ? `rgba(255, 145, 70, ${glow.toFixed(2)})`
          : `rgba(72, 238, 198, ${glow.toFixed(2)})`;
        ctx.lineWidth = 1.1 + 1.5 * m.cond;
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

    // Sample representative cortical L5 pyramidal neuron across 8-compartment branched arbour
    const br = cr.brain;
    if (br) {
      const p = this.hhHist.ptr;
      if (br.v && br.vAIS && br.vBasal && br.apical) {
        const g = Math.min(br.N - 1, Math.floor(br.N * 0.35));
        this.hhHist.ais[p] = br.vAIS[g] || 0;
        this.hhHist.soma[p] = br.v[g] || 0;
        this.hhHist.basalNMDA[p] = 0.5 * ((br.vBasal[g] || 0) + (br.vBasalR ? br.vBasalR[g] : br.vBasal[g]));
        this.hhHist.trunkHCN[p] = br.vTrunk ? br.vTrunk[g] : 0.5 * ((br.v[g] || 0) + (br.apical[g] || 0));
        this.hhHist.tuftCaSK[p] = 0.5 * ((br.apical[g] || 0) + (br.vTuftB ? br.vTuftB[g] : br.apical[g]));
      } else {
        // GIGA 14.16M quantized wave trace
        const ph = this.frame * 0.18;
        const r = br.regRate ? br.regRate[2] * 0.08 : 0.3;
        this.hhHist.ais[p] = 0.45 + 0.35 * Math.sin(ph) * r;
        this.hhHist.soma[p] = 0.38 + 0.30 * Math.sin(ph - 0.3) * r;
        this.hhHist.basalNMDA[p] = 0.32 + 0.28 * Math.cos(ph * 0.7) * r;
        this.hhHist.trunkHCN[p] = 0.28 + 0.22 * Math.sin(ph * 0.5);
        this.hhHist.tuftCaSK[p] = 0.35 + 0.30 * Math.cos(ph * 0.4);
      }
      this.hhHist.ptr = (p + 1) % this.hhHist.ais.length;
    }

    if (this.frame % 5 === 1) {
      this._paintDermalBase(
        cr.gen.pigmentHue ?? 0.72,
        cr.camoLevel ?? 0,
        cr.brain?.nm?.DA ?? 0.3,
        cr.fluid?.heartPhase ?? 0,
        cr.gen.hoxOsteoderm ?? 0.45
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
    p.background(7, 10, 18, 246);

    switch (this.viewIdx) {
      case 0: this._drawHHAndHippocampus(p, cr, w, h); break;
      case 1: this._drawBiosphereMap(p, cr, w, h); break;
      case 2: this._drawPhylogenyAndMorph(p, cr, w, h); break;
      case 3: this._drawFoveaAndIT(p, cr, w, h); break;
      case 4: this._drawQuantumMERA(p, cr, w, h); break;
    }
  }

  _drawHHAndHippocampus(p, cr, w, h) {
    const pad = 9, midY = h * 0.53;
    const br = cr.brain;
    p.noStroke();
    p.fill(150, 220, 255);
    p.textSize(9.2);
    p.text(`8-Comp Arbour · NMDA ${br.nmdaSpikes || 0} · BAC ${Math.round(br.plateauBursts || 0)} · SK ${(br.skMean || 0).toFixed(2)}`, pad, 13);

    const traces = [
      { arr: this.hhHist.ais, col: [255, 105, 130], lbl: 'AIS' },
      { arr: this.hhHist.soma, col: [95, 225, 255], lbl: 'Soma' },
      { arr: this.hhHist.basalNMDA, col: [95, 245, 165], lbl: 'Basal NMDA' },
      { arr: this.hhHist.trunkHCN, col: [195, 150, 255], lbl: 'Trunk Ih' },
      { arr: this.hhHist.tuftCaSK, col: [255, 195, 85], lbl: 'Tuft Ca/SK' },
    ];
    const n = this.hhHist.ais.length, ptr = this.hhHist.ptr;
    p.noFill();
    for (let t = 0; t < traces.length; t++) {
      const tr = traces[t];
      p.stroke(tr.col[0], tr.col[1], tr.col[2], 215);
      p.strokeWeight(1.25);
      p.beginShape();
      for (let i = 0; i < n; i++) {
        const v = tr.arr[(ptr + i) % n];
        const x = pad + (i / (n - 1)) * (w - 2 * pad);
        const y = 22 + (midY - 30) * (1 - clamp((v + 0.3) / 1.5, 0, 1));
        p.vertex(x, y);
      }
      p.endShape();
      p.noStroke();
      p.fill(tr.col[0], tr.col[1], tr.col[2]);
      p.textSize(8.2);
      p.text(tr.lbl, pad + t * ((w - 16) / 5), midY - 2);
    }

    // Bottom: 4,608-Neuron Histological Hippocampal–Subicular Re-Entrant Loop + 4 Interneuron Classes
    const cir = cr.hop?.spikingCircuit;
    p.fill(190, 180, 255);
    p.textSize(9.0);
    p.text(`4,608-Neu Hip–Sub (DG 2,048 + PV/Chnd/OLM/VIP) · SWRs ${cir?.swrEvents ?? 0}`, pad, midY + 13);
    const pops = [
      { name: 'EC II/III', val: cir ? clamp((cir.meanEC || 0.25) * 1.4, 0.08, 1) : 0.32, col: [95, 205, 255] },
      { name: 'DG 2k', val: clamp((cr.hop?.dgSparsity ?? 0.031) * 14, 0.08, 1), col: [85, 245, 175] },
      { name: 'CA3', val: clamp(1 - (cr.hop?.ca1Novelty ?? 0.3), 0.12, 1), col: [255, 195, 90] },
      { name: 'CA1', val: clamp(cr.hop?.ca1Novelty ?? 0.28, 0.1, 1), col: [255, 115, 175] },
      { name: 'Subic', val: cir ? clamp((cir.meanSub || 0.28) * 1.5, 0.1, 1) : 0.36, col: [185, 135, 255] },
      { name: 'GABA4', val: cir ? clamp((cir.meanInh || 0.30) * 1.4, 0.1, 1) : 0.38, col: [80, 245, 235] },
    ];
    const bw = (w - 2 * pad - 25) / 6;
    for (let i = 0; i < 6; i++) {
      const bx = pad + i * (bw + 5), by = midY + 21, bh = h - by - 16;
      p.fill(20, 28, 44);
      p.rect(bx, by, bw, bh, 3);
      const fh = bh * pops[i].val;
      p.fill(pops[i].col[0], pops[i].col[1], pops[i].col[2], 215);
      p.rect(bx, by + bh - fh, bw, fh, 3);
      p.fill(210, 224, 242);
      p.textSize(7.8);
      p.text(pops[i].name, bx + 1, h - 4);
    }
  }

  _drawBiosphereMap(p, cr, w, h) {
    const W = cr.world, eco = cr.eco;
    const sz = Math.min(w - 102, h - 16);
    const ox = 8, oy = 8;
    const mapX = (x) => ox + ((x / (2 * WORLD)) + 0.5) * sz;
    const mapZ = (z) => oy + ((z / (2 * WORLD)) + 0.5) * sz;

    p.stroke(55, 95, 135);
    p.fill(10, 16, 26);
    p.rect(ox, oy, sz, sz, 5);

    p.drawingContext.drawImage(this.bioCanvas, ox, oy, sz, sz);

    p.noStroke();
    for (const pl of W.pools) {
      p.fill(40, 195, 255, 155);
      p.circle(mapX(pl.x), mapZ(pl.z), (pl.r / WORLD) * sz);
    }
    for (const v of W.vents || []) {
      p.fill(255, 115, 45, 220);
      p.circle(mapX(v.x), mapZ(v.z), 6.5 + 2 * Math.sin(cr.t * 4));
    }
    for (const q of W.plants) {
      p.fill(85, 240, 135, 95 + 150 * q.fruit);
      p.circle(mapX(q.x), mapZ(q.z), 3.4 + 2.8 * q.fruit);
    }

    if (eco) {
      for (const eg of eco.eggs) {
        p.fill(255, 238, 135);
        p.circle(mapX(eg.x), mapZ(eg.z), 4.0);
      }
      for (const pr of eco.peers) {
        p.fill(180 + 70 * Math.cos(pr.gen.pigmentHue * 6.28), 150 + 80 * Math.sin(pr.gen.pigmentHue * 6.28), 245);
        p.circle(mapX(pr.x), mapZ(pr.z), 4.2 + 2.2 * pr.scale);
      }
      for (const lv of eco.predators) {
        p.stroke(255, 55, 85);
        p.fill(40, 10, 24, 235);
        p.circle(mapX(lv.x), mapZ(lv.z), 8.5);
        p.noStroke();
      }
    }

    const c = cr.body.com();
    p.stroke(255);
    p.strokeWeight(1.4);
    p.fill(56, 232, 255);
    p.circle(mapX(c[0]), mapZ(c[2]), 7.4);
    p.noStroke();

    const lx = ox + sz + 8;
    p.fill(210, 226, 245);
    p.textSize(8.8);
    const micM = ((W.microbeTotalPop || 1450000) / 1e6).toFixed(2);
    const lines = [
      `Microbes: ${micM}M`,
      `Plankton: ${((W.planktonBloom || 0.65) * 100).toFixed(0)}%`,
      `Peers: ${eco ? eco.peers.length : 0}/${eco ? eco.maxPeers : 32}`,
      `Focal: ${cr.body.activeLimbs}L Hox`,
      `Eggs: ${eco ? eco.eggs.length : 0} (B:${eco ? eco.stats.births : 0})`,
      `Mites: ${eco ? eco.mites.length : 0}`,
      `Soil N: ${(W.meanSoilN || 0.48).toFixed(2)}`,
      `Pher: ${(W.pherMean || 0).toFixed(3)}`,
      `Season: ${W.season}`,
      `Temp: ${cr.bodyTemp.toFixed(1)}°C`,
    ];
    lines.forEach((ln, i) => p.text(ln, lx, 17 + i * 16));
  }

  _drawPhylogenyAndMorph(p, cr, w, h) {
    const midX = w * 0.52;
    p.noStroke();
    p.fill(155, 225, 255);
    p.textSize(9.2);
    p.text(`108-Gene Hox (${cr.body.activeLimbs}L) Morphospace`, 8, 14);
    p.text(`Cladogram (${cr.eco?.lineageTree?.length ?? 1} nodes)`, midX + 4, 14);

    const keys = [
      ['bodyLen', 0.78, 1.28], ['bodyGirth', 0.78, 1.28], ['crestFin', 0, 1], ['tailFluke', 0, 1],
      ['foreLimb', 0.78, 1.32], ['hindLimb', 0.78, 1.32], ['osteoderm', 0.05, 1.25], ['gillFronds', 0.15, 1.45],
      ['limbTopo', 0, 1], ['sarcomereVmax', 0.65, 1.45], ['neuroHipAlloc', 0.75, 1.35], ['fiberStiff', 0.7, 1.35],
    ];
    const cx = midX * 0.48, cy = h * 0.56, rad = Math.min(cx - 16, h * 0.37);
    p.stroke(42, 66, 96);
    p.noFill();
    p.circle(cx, cy, rad * 2);
    p.circle(cx, cy, rad);

    p.fill(56, 232, 255, 72);
    p.stroke(56, 232, 255, 235);
    p.strokeWeight(1.5);
    p.beginShape();
    for (let i = 0; i < keys.length; i++) {
      const [k, lo, hi] = keys[i];
      const u = clamp(((cr.gen[k] ?? (lo + hi) * 0.5) - lo) / (hi - lo), 0.08, 1);
      const a = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
      p.vertex(cx + Math.cos(a) * rad * u, cy + Math.sin(a) * rad * u);
    }
    p.endShape(p.CLOSE);

    const tree = cr.eco?.lineageTree || [{ id: 0, gen: 0, hue: cr.gen.pigmentHue ?? 0.72, limbPairs: 3 }];
    const recent = tree.slice(-14);
    const tx0 = midX + 10, tw = w - tx0 - 12;
    p.strokeWeight(1.1);
    recent.forEach((nd, idx) => {
      const x = tx0 + Math.min(1, (nd.gen || 0) / 5) * (tw - 30);
      const y = 27 + (idx / Math.max(1, recent.length - 1)) * (h - 40);
      p.stroke(100, 165, 220, 135);
      p.line(tx0, y, x, y);
      p.noStroke();
      p.fill(150 + 95 * Math.cos((nd.hue || 0.7) * 6.28), 190, 248);
      p.circle(x, y, 5.8);
      p.fill(205, 220, 240);
      p.textSize(8.0);
      p.text(`G${nd.gen || 0}#${nd.id}(${(nd.limbPairs || 3) * 2}L)`, x + 5, y + 3);
    });
  }

  _drawFoveaAndIT(p, cr, w, h) {
    const rt = cr.retina, wm = cr.wm;
    p.noStroke();
    p.fill(155, 225, 255);
    p.textSize(9.0);
    p.text(`128×64 P/M/K Fovea (${rt.nReceptors.toLocaleString()} cones) · PQ-IT ${rt.itUniqueConceptsSeen || 1}/${rt.itConceptCapacity || 4096}`, 8, 13);

    // Downsampled 32x16 preview of 128x64 left retinal sheet
    const cellW = Math.max(2, Math.floor((w * 0.50) / 32));
    const cellH = Math.max(2, Math.floor((h * 0.44) / 16));
    const strideX = Math.max(1, Math.floor(128 / 32));
    const strideY = Math.max(1, Math.floor(64 / 16));
    for (let vy = 0; vy < 16; vy++) {
      for (let vx = 0; vx < 32; vx++) {
        const idx = ((vy * strideY) * 128 + (vx * strideX)) * 3;
        p.fill((rt.retL[idx] || 0) * 255, (rt.retL[idx + 1] || 0) * 255, (rt.retL[idx + 2] || 0) * 255);
        p.rect(8 + vx * cellW, 20 + vy * cellH, cellW, cellH);
      }
    }

    // Right: 16x8 Rectified Flow-Matching Generated RGB Patch + +2.0s Rollout Patch!
    const px0 = 14 + 32 * cellW;
    p.fill(210, 226, 245);
    p.textSize(8.0);
    p.text('16×8 Flow-Match / +2s', px0, 26);
    const pw = Math.max(2, Math.floor((w - px0 - 10) / 16));
    const flowBuf = wm.visFlowPred || wm.visPred;
    for (let py = 0; py < 8; py++) {
      for (let px = 0; px < 16; px++) {
        const o = (py * 16 + px) * 3;
        p.fill((flowBuf[o] || 0) * 255, (flowBuf[o + 1] || 0) * 255, (flowBuf[o + 2] || 0) * 255);
        p.rect(px0 + px * pw, 31 + py * pw, pw, pw);
        p.fill((wm.vis20Buf[o] || 0) * 255, (wm.vis20Buf[o + 1] || 0) * 255, (wm.vis20Buf[o + 2] || 0) * 255);
        p.rect(px0 + px * pw, 37 + 8 * pw + py * pw, pw, pw);
      }
    }

    // Bottom: 64 Shape + 64 Attr = 4,096 Compositional PQ-IT + +60s WM readout
    const by0 = h * 0.64, bh = h - by0 - 13;
    p.fill(185, 205, 255);
    p.textSize(8.4);
    p.text(`PQ-IT (64×64=4,096) #${rt.itActiveConcept || 0} · Flow ${wm.visFlowMSE?.toFixed(4) ?? '0.00'} · +60s ${(wm.mse60 ?? 0).toFixed(4)}`, 8, by0 - 3);
    const shapeAct = rt.itShapeAct || rt.itAct;
    const nBars = Math.min(32, shapeAct.length);
    const bw = (w - 18) / nBars;
    for (let i = 0; i < nBars; i++) {
      const a = clamp(shapeAct[i] || 0, 0, 1);
      p.fill(i === (rt.itTopShape ?? rt.itTopCat) ? 255 : 70, i === (rt.itTopShape ?? rt.itTopCat) ? 195 : 220, 255, 220);
      p.rect(9 + i * bw, by0 + bh * (1 - a), Math.max(1.8, bw - 1.2), bh * a);
    }
  }

  _drawQuantumMERA(p, cr, w, h) {
    const q = cr.qrng, mc = cr.metacog;
    p.noStroke();
    p.fill(170, 228, 255);
    p.textSize(8.8);
    const sVn = ((q.entropy ?? 0) * 14).toFixed(2);
    p.text(`14Q WASM (16,384-D) · S_vN ${sVn}/14b · ZNE ${(q.zneGain || 1).toFixed(1)}× bias cut`, 8, 13);

    // Left: 64-petal Hilbert amplitude/phase rose over 16,384-state register
    const cx = w * 0.25, cy = h * 0.56, rad = Math.min(cx - 12, h * 0.35);
    p.stroke(42, 66, 98);
    p.noFill();
    p.circle(cx, cy, rad * 2);
    const re = q.re, im = q.im;
    if (re && im) {
      const stride = Math.max(1, Math.floor(re.length / 64));
      for (let k = 0; k < 64; k++) {
        const idx = k * stride;
        const mag = clamp(Math.hypot(re[idx], im[idx]) * 96, 0.08, 1.0);
        const ph = Math.atan2(im[idx], re[idx]);
        const ang = (k / 64) * Math.PI * 2;
        p.stroke(110 + 135 * Math.cos(ph), 165 + 80 * Math.sin(ph), 255, 215);
        p.line(cx, cy, cx + Math.cos(ang) * rad * mag, cy + Math.sin(ang) * rad * mag);
      }
    }

    // Right: Richardson ZNE Error Mitigation + 4-Layer (8->4->2->1) χ=24 Binary MERA Tree
    const mx = w * 0.50, mw = w - mx - 10;
    const ms = mc?.ws?.meraScales || [];
    p.noStroke();
    p.fill(205, 195, 255);
    p.textSize(8.2);
    p.text(`ZNE |err|: raw ${(q.zneRawErr || 0).toFixed(4)} → mit ${(q.zneMitigatedErr || 0).toFixed(4)}`, mx, 27);
    p.text(`χ=24 MPS S ${(mc?.ws?.mpsEntropy ?? 0).toFixed(2)}b · 4-Layer MERA (256-D)`, mx, 39);

    const levels = [8, 4, 2, 1];
    for (let lv = 0; lv < levels.length; lv++) {
      const cnt = levels[lv];
      const y = h - 16 - lv * ((h - 66) / 3);
      for (let i = 0; i < cnt; i++) {
        const x = mx + ((i + 0.5) / cnt) * mw;
        if (lv < levels.length - 1) {
          const px = mx + ((Math.floor(i / 2) + 0.5) / levels[lv + 1]) * mw;
          const py = h - 16 - (lv + 1) * ((h - 66) / 3);
          p.stroke(110, 205, 255, 155);
          p.line(x, y, px, py);
        }
        p.noStroke();
        p.fill(lv === 3 ? 255 : 75, 225, 255);
        p.circle(x, y, 5.8);
      }
      if (ms[lv]) {
        p.fill(150, 190, 225);
        p.textSize(7.2);
        p.text(ms[lv].entropy.toFixed(1), mx - 16, y + 3);
      }
    }
  }
}
