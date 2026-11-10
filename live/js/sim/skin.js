// Chromatophore skin: a 64 x 32 sheet of cells (u = along the body, v = around it) updated as an excitable medium
// (FitzHugh-Nagumo-style activator/recovery pair with diffusion). It is driven only by neural and bodily state:
// each skin patch receives the firing rate of the cortical neurons mapped to it, the activation of the underlying muscle
// channel, and global neuromodulator levels (NE -> darkening flash, DA -> warm pigment, 5-HT -> cool iridophores,
// ACh -> pattern contrast). "Passing cloud" waves emerge from the medium; they are not painted. Hand-set rule, not trained.
import { clamp } from './util.js';
import { CH, NS } from './body.js';
import { R0 } from './brain.js';
export const SW = 64, SH = 32;
export class Skin {
  constructor() { this.a = new Float32Array(SW * SH); this.b = new Float32Array(SW * SH); this.a2 = new Float32Array(SW * SH); this.rgba = new Uint8Array(SW * SH * 4); this.t = 0; }
  step(cr, dt = 1 / 15) { const brain = cr.brain, nm = brain.nm, body = cr.body, a = this.a, b = this.b, a2 = this.a2; this.t += dt; const ne = nm.NE, da = nm.DA, s5 = nm['5HT'], ach = nm.ACh;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const i = y * SW + x; const L = a[y * SW + ((x + SW - 1) % SW)], R = a[y * SW + ((x + 1) % SW)], U = a[((y + 1) % SH) * SW + x], D = a[((y + SH - 1) % SH) * SW + x];
      const seg = Math.min(NS - 2, Math.floor((x / SW) * (NS - 1))); const side = Math.floor((y / SH) * 4) & 3; const ctx = brain.rate[R0.CTX + ((x >> 1) + (y >> 3) * 16) % 64] / 40;
      const mus = Math.abs(body.u[CH.long + seg * 4 + side]); const drive = 0.6 * ctx + 0.35 * mus + 0.25 * cr.nociception + 0.5 * (cr.pc ? cr.pc.surprise : 0) * (0.5 + 0.5 * Math.sin(x * 0.9 + this.t * 3)) + /* prediction-error flush (startle) */ 0.05 * Math.sin(this.t * 0.7 + x * 0.3);
      const lap = L + R + U + D - 4 * a[i]; const ai = a[i], bi = b[i];
      a2[i] = clamp(ai + dt * (6 * (ai - (ai * ai * ai) / 3 - bi) + 2.5 * lap + 3 * drive * (0.6 + ach)) * 0.5, -2.2, 2.2); b[i] = bi + dt * 0.35 * (ai + 0.7 - 0.8 * bi); }
    a.set(a2);
    for (let i = 0; i < SW * SH; i++) { const e = clamp((a[i] + 1.5) / 3); const o = i * 4; // R: pigment expansion, G: iridophore phase, B: leucophore/pallor, A: activation
      this.rgba[o] = Math.round(255 * clamp(e * (0.5 + 0.6 * da) + 0.3 * ne * e)); this.rgba[o + 1] = Math.round(255 * clamp(0.5 + 0.5 * Math.sin(b[i] * 2 + s5 * 3))); this.rgba[o + 2] = Math.round(255 * clamp(0.2 + 0.6 * s5 - 0.4 * ne)); this.rgba[o + 3] = Math.round(255 * clamp(Math.abs(a[i]) / 2)); } }
}
