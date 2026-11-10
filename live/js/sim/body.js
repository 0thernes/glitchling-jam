// Soft body: verlet point masses + position-based distance constraints. Every muscle is a group of constraints whose rest
// length is set each substep from a motor channel u in [-1, 1] (u = agonist minus antagonist motor-neuron activation).
// There is no keyframed animation: the body only moves because muscle rest lengths change and physics resolves them
// against gravity, friction (anisotropic body scales, neurally controlled grip on feet/hands), terrain, rocks and spring pads.
import * as T from '../tsotchke/taylor.js';
import { clamp } from './util.js';
export const NS = 7; // body segments, 0 = tail ... 6 = head
const SEG = 0.4;
export const RAD = Array.from({ length: NS }, (_, i) => 0.17 + 0.11 * Math.sin((Math.PI * (i + 0.6)) / (NS + 0.4)) + (i === NS - 1 ? 0.06 : 0));
// muscle channel layout
export const CH = { long: 0, /* 6 inter-segment gaps x 4 sides */ radial: 24 /* 7 */, leg: 31 /* 4 legs x [swing, extend] */, legGrip: 39 /* 4 */, arm: 43 /* 2 arms x [swing, extend, raise] */, armGrip: 49 /* 2 */, stalk: 51 /* 2 stalks x [yaw, pitch] */, gaze: 55 /* 3 eyes x [yaw, pitch] */, N: 61 };
export const CH_NAMES = (() => { const n = []; for (let i = 0; i < 6; i++) for (const s of ['top', 'left', 'bot', 'right']) n.push(`long${i}${s}`); for (let i = 0; i < 7; i++) n.push('radial' + i); for (let l = 0; l < 4; l++) n.push(`leg${l}swing`, `leg${l}ext`); for (let l = 0; l < 4; l++) n.push(`leg${l}grip`); for (let a = 0; a < 2; a++) n.push(`arm${a}swing`, `arm${a}ext`, `arm${a}raise`); n.push('arm0grip', 'arm1grip'); for (let s = 0; s < 2; s++) n.push(`stalk${s}yaw`, `stalk${s}pitch`); for (let e = 0; e < 3; e++) n.push(`eye${e}yaw`, `eye${e}pitch`); return n; })();
export class Body {
  constructor(world, x0 = 0, z0 = 0, heading = 0) {
    this.world = world; const P = []; const add = (x, y, z, m, r, kind) => { P.push({ x, y, z, m, r, kind }); return P.length - 1; };
    const ch = Math.cos(heading), sh = Math.sin(heading); const base = world.height(x0, z0) + 0.6;
    const W = (fx, fy, fz) => [x0 + fx * ch - fz * sh, base + fy, z0 + fx * sh + fz * ch]; // body frame (fx forward, fz right) -> world
    this.c = []; this.ring = []; // ring j: 0 top, 1 left(-z), 2 bottom, 3 right(+z)
    const off = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // (z, y) unit offsets
    for (let i = 0; i < NS; i++) { const fx = (i - (NS - 1) / 2) * SEG; this.c.push(add(...W(fx, 0, 0), 1, RAD[i] * 0.8, 'core')); const rr = [];
      for (let j = 0; j < 4; j++) rr.push(add(...W(fx, off[j][1] * RAD[i], off[j][0] * RAD[i]), j === 2 ? 2.4 : j === 0 ? 0.2 : 0.6, 0.09, 'skin')); /* heavy belly, light back: passive righting */ this.ring.push(rr); }
    const cons = []; let tagSeg = -1, tagLimb = -1; const con = (a, b, k, m = -1, g = 0) => { const pa = P[a], pb = P[b]; cons.push({ a, b, rest: Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z), k, m, g, seg: tagSeg, limb: tagLimb }); };
    for (let i = 0; i < NS; i++) { const R = this.ring[i], c = this.c[i], mr = CH.radial + i;
      tagSeg = i; for (let j = 0; j < 4; j++) { con(c, R[j], 0.9, mr, 0.45); con(R[j], R[(j + 1) & 3], 0.8, mr, 0.45); } con(R[0], R[2], 0.6, mr, 0.45); con(R[1], R[3], 0.6, mr, 0.45); tagSeg = -1;
      if (i < NS - 1) { const R2 = this.ring[i + 1], c2 = this.c[i + 1]; con(c, c2, 0.35);
        for (let j = 0; j < 4; j++) { con(R[j], R2[j], 0.9, CH.long + i * 4 + j, -0.3); con(R[j], R2[(j + 1) & 3], 0.5); con(R[j], R2[(j + 3) & 3], 0.5); con(c, R2[j], 0.4); con(R[j], c2, 0.4); } } }
    // limbs: legs on segments 1 and 3 (left/right), arms on segment 5, eye stalks on the head top
    this.limbs = []; const limb = (s, side, kind, idx) => { const sz = side === 1 ? -1 : 1; const fx = (s - (NS - 1) / 2) * SEG; const isArm = kind === 'arm'; const L1 = isArm ? 0.38 : 0.34, L2 = isArm ? 0.36 : 0.36;
      tagLimb = this.limbs.length; const hip = this.ring[s][side]; const knee = add(...W(fx + (isArm ? 0.1 : 0), isArm ? 0.05 : -0.05, sz * (RAD[s] + L1)), 0.35, 0.07, 'knee'); const foot = add(...W(fx + (isArm ? 0.25 : 0), isArm ? -0.15 : -0.4, sz * (RAD[s] + L1 + 0.1)), 0.3, 0.08, isArm ? 'hand' : 'foot');
      con(hip, knee, 1); con(knee, this.c[s], 0.9); con(knee, foot, 1); con(foot, this.c[s], 0.15);
      const sw = isArm ? CH.arm + idx * 3 : CH.leg + idx * 2; con(knee, this.ring[s + 1][side], 0.8, sw, -0.45); con(knee, this.ring[s - 1][side], 0.8, sw, 0.45);
      con(foot, hip, 0.8, sw + 1, 0.5); if (isArm) con(knee, this.ring[s][2], 0.7, sw + 2, 0.45);
      this.limbs.push({ kind, s, side, hip, knee, foot, grip: isArm ? CH.armGrip + idx : CH.legGrip + idx, idx }); tagLimb = -1; };
    limb(1, 1, 'leg', 0); limb(1, 3, 'leg', 1); limb(3, 1, 'leg', 2); limb(3, 3, 'leg', 3); limb(5, 1, 'arm', 0); limb(5, 3, 'arm', 1);
    this.stalks = []; for (let s = 0; s < 2; s++) { const sz = s ? 1 : -1, fx = ((NS - 1) / 2) * SEG; const top = this.ring[NS - 1][0];
      const m1 = add(...W(fx + 0.05, RAD[NS - 1] + 0.3, sz * 0.14), 0.12, 0.05, 'stalk'), eye = add(...W(fx + 0.15, RAD[NS - 1] + 0.55, sz * 0.24), 0.1, 0.09, 'eye');
      con(top, m1, 1); con(m1, eye, 1); con(eye, top, 0.3); con(m1, this.ring[NS - 1][1], 0.6, CH.stalk + s * 2, sz * 0.4); con(m1, this.ring[NS - 1][3], 0.6, CH.stalk + s * 2, -sz * 0.4);
      con(eye, this.c[NS - 2], 0.5, CH.stalk + s * 2 + 1, 0.3); con(eye, this.c[NS - 1], 0.4); this.stalks.push({ base: top, mid: m1, eye }); }
    const n = P.length; this.n = n; this.x = new Float64Array(n); this.y = new Float64Array(n); this.z = new Float64Array(n); this.ox = new Float64Array(n); this.oy = new Float64Array(n); this.oz = new Float64Array(n);
    this.im = new Float64Array(n); this.r = new Float64Array(n); this.kind = P.map((p) => p.kind); this.contact = new Uint8Array(n); this.gripP = new Float64Array(n); this.fwdP = new Float64Array(n * 3);
    P.forEach((p, i) => { this.x[i] = this.ox[i] = p.x; this.y[i] = this.oy[i] = p.y; this.z[i] = this.oz[i] = p.z; this.im[i] = 1 / p.m; this.r[i] = p.r; });
    this.cons = cons; this.u = new Float64Array(CH.N); this.stretch = new Float64Array(CH.N); this.ext = []; this.scale = 1; this.girth = new Float64Array(NS).fill(1); this.limbLen = new Float64Array(6).fill(1); this.energy = 0; this.grabbing = 0;
    for (const L of this.limbs) this.gripP[L.foot] = 0;
    this.curvL = new Float64Array(NS - 1); this.curvU = new Float64Array(NS - 1); this.frames();
  }
  frames() { // per-segment orthonormal frames (fwd, up, right) from particle positions
    const F = (this.F = this.F || Array.from({ length: NS }, () => ({ f: [1, 0, 0], u: [0, 1, 0], s: [0, 0, 1] }))); const X = this.x, Y = this.y, Z = this.z;
    for (let i = 0; i < NS; i++) { const a = this.c[Math.max(0, i - 1)], b = this.c[Math.min(NS - 1, i + 1)]; let f = [X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]]; let l = Math.hypot(...f) || 1; f = f.map((v) => v / l);
      const t = this.ring[i][0], c = this.c[i]; let u = [X[t] - X[c], Y[t] - Y[c], Z[t] - Z[c]]; const d = u[0] * f[0] + u[1] * f[1] + u[2] * f[2]; u = u.map((v, k) => v - d * f[k]); l = Math.hypot(...u) || 1; u = u.map((v) => v / l);
      const s = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]]; F[i].f = f; F[i].u = u; F[i].s = s; }
    return F; }
  /** spine curvature from exact Taylor-mode derivatives (Tsotchke/Eshkol jet recurrences) of a Catmull-Rom spline through the segment centres */
  curvature() { const X = this.x, Y = this.y, Z = this.z, C = this.c; const F = this.F;
    for (let i = 0; i < NS - 1; i++) { const p = [C[Math.max(0, i - 1)], C[i], C[i + 1], C[Math.min(NS - 1, i + 2)]]; const t = T.Jet.vari(0.5, 2); const t2 = T.mul(t, t), t3 = T.mul(t2, t);
      // Catmull-Rom basis as jets in t, so r(t), r'(t), r''(t) come out exactly from the jet coefficients
      const b0 = T.mul(0.5, T.add(T.add(T.neg(t3), T.mul(2, t2)), T.neg(t))), b1 = T.mul(0.5, T.add(T.sub(T.mul(3, t3), T.mul(5, t2)), 2)), b2 = T.mul(0.5, T.add(T.add(T.mul(-3, t3), T.mul(4, t2)), t)), b3 = T.mul(0.5, T.sub(t3, t2));
      const comp = (A) => T.add(T.add(T.mul(b0, A[p[0]]), T.mul(b1, A[p[1]])), T.add(T.mul(b2, A[p[2]]), T.mul(b3, A[p[3]])));
      const rx = comp(X), ry = comp(Y), rz = comp(Z); const d1 = [rx.deriv(1), ry.deriv(1), rz.deriv(1)], d2 = [rx.deriv(2), ry.deriv(2), rz.deriv(2)];
      const n1 = Math.hypot(...d1) || 1e-6; const k = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]].map((v) => v / n1 ** 3);
      // k is the curvature (binormal) vector; its component along the segment's up axis = lateral bend, along its side axis = dorsal bend
      const fr = F[i]; this.curvL[i] = k[0] * fr.u[0] + k[1] * fr.u[1] + k[2] * fr.u[2]; this.curvU[i] = k[0] * fr.s[0] + k[1] * fr.s[1] + k[2] * fr.s[2]; } }
  com() { let x = 0, y = 0, z = 0; for (let i = 0; i < NS; i++) { const c = this.c[i]; x += this.x[c]; y += this.y[c]; z += this.z[c]; } return [x / NS, y / NS, z / NS]; }
  head() { const c = this.c[NS - 1]; return [this.x[c], this.y[c], this.z[c]]; }
  poke(i, fx, fy, fz) { this.x[i] += fx; this.y[i] += fy; this.z[i] += fz; }
  step(dt, iters = 6, lesionMuscles = false) {
    const W = this.world, n = this.n, X = this.x, Y = this.y, Z = this.z, OX = this.ox, OY = this.oy, OZ = this.oz; const g = W.g, gx = W.gx * g, gz = W.gz * g, gy = -g * Math.sqrt(Math.max(0, 1 - W.gx * W.gx - W.gz * W.gz));
    const F = this.frames(); const wx = W.wind.x, wz = W.wind.z; const damp = 0.995;
    for (let i = 0; i < n; i++) { const vx = (X[i] - OX[i]) * damp, vy = (Y[i] - OY[i]) * damp, vz = (Z[i] - OZ[i]) * damp; OX[i] = X[i]; OY[i] = Y[i]; OZ[i] = Z[i];
      const drag = this.kind[i] === 'stalk' || this.kind[i] === 'eye' ? 0.6 : 0.15; X[i] += vx + (gx + drag * (wx - vx / dt)) * dt * dt; Y[i] += vy + gy * dt * dt; Z[i] += vz + (gz + drag * (wz - vz / dt)) * dt * dt; }
    const u = this.u; let e = 0; for (let k = 0; k < CH.N; k++) { u[k] = lesionMuscles ? 0 : clamp(u[k], -1, 1); e += Math.abs(u[k]); } this.energy = e;
    const cons = this.cons, sc = this.scale;
    // Gauss-Seidel order is re-randomised every substep (deterministic LCG). A fixed order - even with alternating sweeps - left a
    // measured left-yaw bias of ~0.38 rad/s under a perfectly symmetric muscle wave (test/symmetry_probe.mjs); a random order removes it.
    const ord = this.ord || (this.ord = Uint16Array.from(cons.keys())); let rs = this.rs ?? (this.rs = 12345);
    for (let i = ord.length - 1; i > 0; i--) { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; const j = rs % (i + 1); const t = ord[i]; ord[i] = ord[j]; ord[j] = t; } this.rs = rs;
    for (let it = 0; it < iters; it++) { const fw = it % 2 === 0; for (let qq = 0; qq < cons.length; qq++) { const C = cons[ord[fw ? qq : cons.length - 1 - qq]]; const a = C.a, b = C.b; let rest = C.rest * sc * (C.seg >= 0 ? this.girth[C.seg] : C.limb >= 0 ? this.limbLen[C.limb] : 1); /* morphological growth: per-segment girth, per-limb length */ if (C.m >= 0) rest *= Math.max(0.35, 1 + C.g * u[C.m]);
        const dx = X[b] - X[a], dy = Y[b] - Y[a], dz = Z[b] - Z[a]; const d = Math.hypot(dx, dy, dz) || 1e-9; const w = this.im[a] + this.im[b]; const corr = (C.k * (d - rest)) / (d * w);
        X[a] += dx * corr * this.im[a]; Y[a] += dy * corr * this.im[a]; Z[a] += dz * corr * this.im[a]; X[b] -= dx * corr * this.im[b]; Y[b] -= dy * corr * this.im[b]; Z[b] -= dz * corr * this.im[b]; }
      this.collide(it === iters - 1, dt, F); }
    // stretch receptors: mean length/rest of each muscle's constraints (muscle spindles)
    this.stretch.fill(0); const cnt = new Float64Array(CH.N); for (const C of cons) if (C.m >= 0) { const d = Math.hypot(X[C.b] - X[C.a], Y[C.b] - Y[C.a], Z[C.b] - Z[C.a]); this.stretch[C.m] += d / (C.rest * sc) - 1; cnt[C.m]++; } for (let k = 0; k < CH.N; k++) if (cnt[k]) this.stretch[k] /= cnt[k];
  }
  collide(friction, dt, F) {
    const W = this.world, X = this.x, Y = this.y, Z = this.z, OX = this.ox, OY = this.oy, OZ = this.oz; const u = this.u; this.grabbing = 0;
    for (let i = 0; i < this.n; i++) { const r = this.r[i]; let hit = 0, nx = 0, ny = 1, nz = 0; const h = W.height(X[i], Z[i]);
      let pen = 0; if (Y[i] < h + r) { const N = W.normal(X[i], Z[i]); nx = N[0]; ny = N[1]; nz = N[2]; pen = (h + r - Y[i]) * ny; X[i] += nx * pen; Y[i] += ny * pen; Z[i] += nz * pen; hit = 1; }
      for (const R of W.rocks) { const dx = X[i] - R.x, dy = Y[i] - R.y, dz = Z[i] - R.z, d = Math.hypot(dx, dy, dz), m = R.r + r; if (d < m && d > 1e-6) { const p = (m - d) / d; pen = Math.max(pen, m - d); X[i] += dx * p; Y[i] += dy * p; Z[i] += dz * p; nx = dx / d; ny = dy / d; nz = dz / d; hit = 2; } }
      for (const S of W.springs) { const dx = X[i] - S.x, dz = Z[i] - S.z; if (dx * dx + dz * dz < S.r * S.r) { const top = S.y + 0.3 - S.comp * 0.4; if (Y[i] < top + r) { Y[i] = top + r; if (Y[i] - OY[i] < 0) { S.v -= 0.4; OY[i] = Y[i] - 9 * dt * (0.5 + Math.max(0, S.comp)); } hit = 3; } } }
      this.contact[i] = hit; if (!hit || !friction) continue;
      // friction: remove part of the tangential displacement this step. Body scales are anisotropic (slide forward easily); feet/hands use neural grip
      let dx = X[i] - OX[i], dy = Y[i] - OY[i], dz = Z[i] - OZ[i]; const dn = dx * nx + dy * ny + dz * nz; dx -= dn * nx; dy -= dn * ny; dz -= dn * nz;
      const k = this.kind[i]; let mu;
      if (k === 'foot' || k === 'hand') { const L = this.limbs.find((l) => l.foot === i); const gp = clamp(0.5 + 0.5 * u[L.grip]); this.gripP[i] = gp; mu = 0.15 + 0.83 * gp; if (hit === 2 && gp > 0.6) this.grabbing++; }
      else { const seg = this.segOf(i); const f = F[seg].f; const along = dx * f[0] + dy * f[1] + dz * f[2]; const mAlong = along > 0 ? 0.08 : 0.55, mLat = (this.mLat ?? 0.6) * (1 - (this.scaleLift ?? 0) * Math.max(0, u[CH.radial + seg])); /* ventral scale erection: radial-muscle contraction lowers lateral grip (pass 9) */
        const ax = along * f[0], ay = along * f[1], az = along * f[2];
        if (this.coulomb) { /* Coulomb contact (pass 12): friction can remove at most mu * (normal correction) of tangential motion, per direction (position-based friction, Macklin et al. 2014). Load-bearing particles grip; barely touching ones slide. */ const C = this.coulomb, lx = dx - ax, ly = dy - ay, lz = dz - az, la = Math.abs(along), ll = Math.hypot(lx, ly, lz);
          const fa = la > 1e-12 ? Math.min(1, (along > 0 ? C.fwd : C.back) * pen / la) : 0, fl = ll > 1e-12 ? Math.min(1, C.lat * (1 - (this.scaleLift ?? 0) * Math.max(0, u[CH.radial + seg])) * pen / ll) : 0;
          X[i] -= ax * fa + lx * fl; Y[i] -= ay * fa + ly * fl; Z[i] -= az * fa + lz * fl; continue; }
        X[i] -= ax * mAlong + (dx - ax) * mLat; Y[i] -= ay * mAlong + (dy - ay) * mLat; Z[i] -= az * mAlong + (dz - az) * mLat; continue; }
      X[i] -= dx * mu; Y[i] -= dy * mu; Z[i] -= dz * mu; }
  }
  segOf(i) { if (this._seg) return this._seg[i]; this._seg = new Int8Array(this.n); for (let s = 0; s < NS; s++) { this._seg[this.c[s]] = s; for (const j of this.ring[s]) this._seg[j] = s; } for (const L of this.limbs) { this._seg[L.knee] = L.s; this._seg[L.foot] = L.s; } for (const S of this.stalks) { this._seg[S.mid] = NS - 1; this._seg[S.eye] = NS - 1; } return this._seg[i]; }
}
