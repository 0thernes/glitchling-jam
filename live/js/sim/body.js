// Soft body: coupled 3D Volumetric Neo-Hookean Finite-Element (FEM) continuum tetrahedra + active Hill/XPBD contractile muscle
// fibers + Verlet dynamics.
//  - 78 mirror-symmetric 3D volumetric finite elements (72 trunk prism tetrahedra + 6 limb-belly tetrahedra) carry precomputed
//    reference inverse shape matrices Dm^-1 = [X1-X0, X2-X0, X3-X0]^-1 and rest volumes V0 > 0.
//  - Each substep evaluates exact 3x3 deformation gradients F = Ds * Dm^-1, Jacobian determinants J = det(F), Cauchy-Green trace
//    I1 = tr(F^T F), Neo-Hookean strain-energy density Psi = (mu/2)(I1 - 3 - 2 ln J) + (lambda/2)(J - 1)^2, and XPBD hydrostatic
//    incompressibility + deviatoric shear projections (producing physical Poisson lateral muscle bulging & preventing element
//    inversion, while outputting segmental intramuscular tissue pressure segPressure[s] to the Navier-Stokes venous pump).
//  - Active muscle channels u in [-1, 1] (agonist minus antagonist sLTC motor-neuron activation) drive contractile fiber rest
//    lengths against gravity, directional ventral scute friction, neural foot/hand grip, terrain, rocks and spring pads.
import * as T from '../tsotchke/taylor.js';
import { clamp } from './util.js';

export const NS = 7; // body segments, 0 = tail ... 6 = head
const SEG = 0.4;
export const RAD = Array.from({ length: NS }, (_, i) =>
  0.17 + 0.11 * Math.sin((Math.PI * (i + 0.6)) / (NS + 0.4)) + (i === NS - 1 ? 0.06 : 0)
);

// muscle channel layout
export const CH = {
  long: 0,      // 6 inter-segment gaps x 4 sides
  radial: 24,   // 7 rings
  leg: 31,      // 4 legs x [swing, extend]
  legGrip: 39,  // 4
  arm: 43,      // 2 arms x [swing, extend, raise]
  armGrip: 49,  // 2
  stalk: 51,    // 2 stalks x [yaw, pitch]
  gaze: 55,     // 3 eyes x [yaw, pitch]
  N: 61,
};

export const CH_NAMES = (() => {
  const n = [];
  for (let i = 0; i < 6; i++) for (const s of ['top', 'left', 'bot', 'right']) n.push(`long${i}${s}`);
  for (let i = 0; i < 7; i++) n.push('radial' + i);
  for (let l = 0; l < 4; l++) n.push(`leg${l}swing`, `leg${l}ext`);
  for (let l = 0; l < 4; l++) n.push(`leg${l}grip`);
  for (let a = 0; a < 2; a++) n.push(`arm${a}swing`, `arm${a}ext`, `arm${a}raise`);
  n.push('arm0grip', 'arm1grip');
  for (let s = 0; s < 2; s++) n.push(`stalk${s}yaw`, `stalk${s}pitch`);
  for (let e = 0; e < 3; e++) n.push(`eye${e}yaw`, `eye${e}pitch`);
  return n;
})();

/** Invert a 3x3 column-major edge matrix [d1 | d2 | d3]; returns { det, inv: Float64Array(9) } */
function invert3x3(d1x, d1y, d1z, d2x, d2y, d2z, d3x, d3y, d3z) {
  const c00 = d2y * d3z - d2z * d3y, c01 = d2z * d3x - d2x * d3z, c02 = d2x * d3y - d2y * d3x;
  const c10 = d3y * d1z - d3z * d1y, c11 = d3z * d1x - d3x * d1z, c12 = d3x * d1y - d3y * d1x;
  const c20 = d1y * d2z - d1z * d2y, c21 = d1z * d2x - d1x * d2z, c22 = d1x * d2y - d1y * d2x;
  const det = d1x * c00 + d1y * c01 + d1z * c02;
  const invDet = Math.abs(det) > 1e-12 ? 1 / det : 0;
  // Row-major Dm^-1 where row 0 = c0 * invDet, row 1 = c1 * invDet, row 2 = c2 * invDet
  return {
    det,
    inv: new Float64Array([
      c00 * invDet, c01 * invDet, c02 * invDet,
      c10 * invDet, c11 * invDet, c12 * invDet,
      c20 * invDet, c21 * invDet, c22 * invDet,
    ]),
  };
}

export class Body {
  constructor(world, x0 = 0, z0 = 0, heading = 0) {
    this.world = world;
    const P = [];
    const add = (x, y, z, m, r, kind) => { P.push({ x, y, z, m, r, kind }); return P.length - 1; };
    const ch = Math.cos(heading), sh = Math.sin(heading);
    const base = world.height(x0, z0) + 0.6;
    const W = (fx, fy, fz) => [x0 + fx * ch - fz * sh, base + fy, z0 + fx * sh + fz * ch];

    this.c = [];
    this.ring = []; // ring j: 0 top, 1 left(-z), 2 bottom, 3 right(+z)
    const off = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    for (let i = 0; i < NS; i++) {
      const fx = (i - (NS - 1) / 2) * SEG;
      this.c.push(add(...W(fx, 0, 0), 1, RAD[i] * 0.8, 'core'));
      const rr = [];
      for (let j = 0; j < 4; j++) {
        rr.push(add(...W(fx, off[j][1] * RAD[i], off[j][0] * RAD[i]), j === 2 ? 2.4 : j === 0 ? 0.2 : 0.6, 0.09, 'skin'));
      }
      this.ring.push(rr);
    }

    const cons = [];
    let tagSeg = -1, tagLimb = -1;
    const con = (a, b, k, m = -1, g = 0) => {
      const pa = P[a], pb = P[b];
      cons.push({ a, b, rest: Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z), k, m, g, seg: tagSeg, limb: tagLimb });
    };
    for (let i = 0; i < NS; i++) {
      const R = this.ring[i], c = this.c[i], mr = CH.radial + i;
      tagSeg = i;
      for (let j = 0; j < 4; j++) { con(c, R[j], 0.9, mr, 0.45); con(R[j], R[(j + 1) & 3], 0.8, mr, 0.45); }
      con(R[0], R[2], 0.6, mr, 0.45);
      con(R[1], R[3], 0.6, mr, 0.45);
      tagSeg = -1;
      if (i < NS - 1) {
        const R2 = this.ring[i + 1], c2 = this.c[i + 1];
        con(c, c2, 0.35);
        for (let j = 0; j < 4; j++) {
          con(R[j], R2[j], 0.9, CH.long + i * 4 + j, -0.3);
          con(R[j], R2[(j + 1) & 3], 0.5);
          con(R[j], R2[(j + 3) & 3], 0.5);
          con(c, R2[j], 0.4);
          con(R[j], c2, 0.4);
        }
      }
    }

    this.limbs = [];
    const limb = (s, side, kind, idx) => {
      const sz = side === 1 ? -1 : 1;
      const fx = (s - (NS - 1) / 2) * SEG;
      const isArm = kind === 'arm';
      const L1 = isArm ? 0.38 : 0.34;
      tagLimb = this.limbs.length;
      const hip = this.ring[s][side];
      const knee = add(...W(fx + (isArm ? 0.1 : 0), isArm ? 0.05 : -0.05, sz * (RAD[s] + L1)), 0.35, 0.07, 'knee');
      const foot = add(...W(fx + (isArm ? 0.25 : 0), isArm ? -0.15 : -0.4, sz * (RAD[s] + L1 + 0.1)), 0.3, 0.08, isArm ? 'hand' : 'foot');
      con(hip, knee, 1); con(knee, this.c[s], 0.9); con(knee, foot, 1); con(foot, this.c[s], 0.15);
      const sw = isArm ? CH.arm + idx * 3 : CH.leg + idx * 2;
      con(knee, this.ring[s + 1][side], 0.8, sw, -0.45);
      con(knee, this.ring[s - 1][side], 0.8, sw, 0.45);
      con(foot, hip, 0.8, sw + 1, 0.5);
      if (isArm) con(knee, this.ring[s][2], 0.7, sw + 2, 0.45);
      this.limbs.push({ kind, s, side, hip, knee, foot, grip: isArm ? CH.armGrip + idx : CH.legGrip + idx, idx });
      tagLimb = -1;
    };
    limb(1, 1, 'leg', 0); limb(1, 3, 'leg', 1);
    limb(3, 1, 'leg', 2); limb(3, 3, 'leg', 3);
    limb(5, 1, 'arm', 0); limb(5, 3, 'arm', 1);

    this.stalks = [];
    for (let s = 0; s < 2; s++) {
      const sz = s ? 1 : -1, fx = ((NS - 1) / 2) * SEG;
      const top = this.ring[NS - 1][0];
      const m1 = add(...W(fx + 0.05, RAD[NS - 1] + 0.3, sz * 0.14), 0.12, 0.05, 'stalk');
      const eye = add(...W(fx + 0.15, RAD[NS - 1] + 0.55, sz * 0.24), 0.1, 0.09, 'eye');
      con(top, m1, 1); con(m1, eye, 1); con(eye, top, 0.3);
      con(m1, this.ring[NS - 1][1], 0.6, CH.stalk + s * 2, sz * 0.4);
      con(m1, this.ring[NS - 1][3], 0.6, CH.stalk + s * 2, -sz * 0.4);
      con(eye, this.c[NS - 2], 0.5, CH.stalk + s * 2 + 1, 0.3);
      con(eye, this.c[NS - 1], 0.4);
      this.stalks.push({ base: top, mid: m1, eye });
    }

    const n = P.length;
    this.n = n;
    this.x = new Float64Array(n); this.y = new Float64Array(n); this.z = new Float64Array(n);
    this.ox = new Float64Array(n); this.oy = new Float64Array(n); this.oz = new Float64Array(n);
    this.im = new Float64Array(n); this.r = new Float64Array(n);
    this.kind = P.map((p) => p.kind);
    this.contact = new Uint8Array(n);
    this.gripP = new Float64Array(n);
    this.fwdP = new Float64Array(n * 3);
    P.forEach((p, i) => {
      this.x[i] = this.ox[i] = p.x;
      this.y[i] = this.oy[i] = p.y;
      this.z[i] = this.oz[i] = p.z;
      this.im[i] = 1 / p.m;
      this.r[i] = p.r;
    });

    // ---------------------------------------------------------------- 3D Volumetric Tetrahedral Continuum FEM Mesh
    // Mirror-symmetric decomposition of each inter-segment wedge prism (A = core, B = dorsal/ventral midline, C = left/right lateral)
    // into 3 non-overlapping positively-oriented tetrahedra (72 trunk tets + 6 limb-belly tets = 78 continuum elements).
    this.tets = [];
    const addTet = (p0, p1, p2, p3, seg, limbIdx = -1) => {
      let i0 = p0, i1 = p1, i2 = p2, i3 = p3;
      let d1x = P[i1].x - P[i0].x, d1y = P[i1].y - P[i0].y, d1z = P[i1].z - P[i0].z;
      let d2x = P[i2].x - P[i0].x, d2y = P[i2].y - P[i0].y, d2z = P[i2].z - P[i0].z;
      let d3x = P[i3].x - P[i0].x, d3y = P[i3].y - P[i0].y, d3z = P[i3].z - P[i0].z;
      let m = invert3x3(d1x, d1y, d1z, d2x, d2y, d2z, d3x, d3y, d3z);
      if (m.det < 0) {
        // Swap i2 <-> i3 so rest volume V0 > 0 without altering the 4-vertex geometric simplex!
        const tmp = i2; i2 = i3; i3 = tmp;
        d2x = P[i2].x - P[i0].x; d2y = P[i2].y - P[i0].y; d2z = P[i2].z - P[i0].z;
        d3x = P[i3].x - P[i0].x; d3y = P[i3].y - P[i0].y; d3z = P[i3].z - P[i0].z;
        m = invert3x3(d1x, d1y, d1z, d2x, d2y, d2z, d3x, d3y, d3z);
      }
      const vol0 = m.det / 6;
      if (vol0 > 1e-6) this.tets.push({ p0: i0, p1: i1, p2: i2, p3: i3, vol0, B: m.inv, seg, limb: limbIdx });
    };
    for (let s = 0; s < NS - 1; s++) {
      const A0 = this.c[s], A1 = this.c[s + 1];
      const R0 = this.ring[s], R1 = this.ring[s + 1];
      // 4 exact sagittal-mirror quadrant prisms: (midline dorsal/ventral, lateral left/right)
      for (const [mid, lat] of [[0, 1], [0, 3], [2, 1], [2, 3]]) {
        const B0 = R0[mid], B1 = R1[mid], C0 = R0[lat], C1 = R1[lat];
        addTet(A0, B0, C0, A1, s);
        addTet(B0, C0, A1, B1, s);
        addTet(C0, A1, B1, C1, s + 1);
      }
    }
    this.limbs.forEach((L, k) => addTet(this.ring[L.s - 1][L.side], this.ring[L.s + 1][L.side], this.ring[L.s][0], L.knee, L.s, k));
    this.tetOrd = Uint16Array.from(this.tets.keys());

    // Continuum FEM telemetry & biomechanical coupling buffers
    this.lesionFEM = false;
    this.femStrainEnergy = 0; // total Neo-Hookean elastic energy (Joules-scaled)
    this.meanTetJ = 1;        // mean volumetric Jacobian J = V / V0 (~1.0 = incompressible tissue)
    this.minTetJ = 1;         // minimum Jacobian across all 78 elements (> 0 = zero element inversions)
    this.segJ = new Float64Array(NS).fill(1);
    this.segPressure = new Float64Array(NS); // hydrostatic tissue compression -> drives Navier-Stokes venous pump
    this.segO2 = null;        // optional pointer from Hemodynamics for extreme hypoxic fatigue coupling

    this.cons = cons;
    this.u = new Float64Array(CH.N);
    this.stretch = new Float64Array(CH.N);
    this.ext = [];
    this.scale = 1;
    this.girth = new Float64Array(NS).fill(1);
    this.limbLen = new Float64Array(6).fill(1);
    this.energy = 0;
    this.grabbing = 0;
    for (const L of this.limbs) this.gripP[L.foot] = 0;
    this.curvL = new Float64Array(NS - 1);
    this.curvU = new Float64Array(NS - 1);
    this.frames();
  }

  frames() {
    const F = (this.F = this.F || Array.from({ length: NS }, () => ({ f: [1, 0, 0], u: [0, 1, 0], s: [0, 0, 1] })));
    const X = this.x, Y = this.y, Z = this.z;
    for (let i = 0; i < NS; i++) {
      const a = this.c[Math.max(0, i - 1)], b = this.c[Math.min(NS - 1, i + 1)];
      let f = [X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]];
      let l = Math.hypot(...f) || 1;
      f = f.map((v) => v / l);
      const t = this.ring[i][0], c = this.c[i];
      let u = [X[t] - X[c], Y[t] - Y[c], Z[t] - Z[c]];
      const d = u[0] * f[0] + u[1] * f[1] + u[2] * f[2];
      u = u.map((v, k) => v - d * f[k]);
      l = Math.hypot(...u) || 1;
      u = u.map((v) => v / l);
      const s = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
      F[i].f = f; F[i].u = u; F[i].s = s;
    }
    return F;
  }

  /** Spine curvature from exact Taylor-mode derivatives (Tsotchke/Eshkol jet recurrences) of a Catmull-Rom spline */
  curvature() {
    const X = this.x, Y = this.y, Z = this.z, C = this.c, F = this.F;
    for (let i = 0; i < NS - 1; i++) {
      const p = [C[Math.max(0, i - 1)], C[i], C[i + 1], C[Math.min(NS - 1, i + 2)]];
      const t = T.Jet.vari(0.5, 2), t2 = T.mul(t, t), t3 = T.mul(t2, t);
      const b0 = T.mul(0.5, T.add(T.add(T.neg(t3), T.mul(2, t2)), T.neg(t)));
      const b1 = T.mul(0.5, T.add(T.sub(T.mul(3, t3), T.mul(5, t2)), 2));
      const b2 = T.mul(0.5, T.add(T.add(T.mul(-3, t3), T.mul(4, t2)), t));
      const b3 = T.mul(0.5, T.sub(t3, t2));
      const comp = (A) => T.add(T.add(T.mul(b0, A[p[0]]), T.mul(b1, A[p[1]])), T.add(T.mul(b2, A[p[2]]), T.mul(b3, A[p[3]])));
      const rx = comp(X), ry = comp(Y), rz = comp(Z);
      const d1 = [rx.deriv(1), ry.deriv(1), rz.deriv(1)], d2 = [rx.deriv(2), ry.deriv(2), rz.deriv(2)];
      const n1 = Math.hypot(...d1) || 1e-6;
      const k = [
        d1[1] * d2[2] - d1[2] * d2[1],
        d1[2] * d2[0] - d1[0] * d2[2],
        d1[0] * d2[1] - d1[1] * d2[0],
      ].map((v) => v / n1 ** 3);
      const fr = F[i];
      this.curvL[i] = k[0] * fr.u[0] + k[1] * fr.u[1] + k[2] * fr.u[2];
      this.curvU[i] = k[0] * fr.s[0] + k[1] * fr.s[1] + k[2] * fr.s[2];
    }
  }

  com() {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < NS; i++) { const c = this.c[i]; x += this.x[c]; y += this.y[c]; z += this.z[c]; }
    return [x / NS, y / NS, z / NS];
  }

  head() { const c = this.c[NS - 1]; return [this.x[c], this.y[c], this.z[c]]; }
  poke(i, fx, fy, fz) { this.x[i] += fx; this.y[i] += fy; this.z[i] += fz; }

  /**
   * Solve 3D Neo-Hookean XPBD continuum tetrahedra:
   *  - Evaluates exact 3x3 deformation gradient F = Ds * Dm^-1 and volumetric Jacobian J = det(F) / volGrowth.
   *  - Applies analytical hydrostatic volume-preservation projection C_vol = J - 1 (producing Poisson lateral bulging under axial
   *    contraction and strictly preventing element inversion J <= 0) + Neo-Hookean deviatoric shear stabilization.
   */
  solveContinuumFEM(dt, fw) {
    const tets = this.tets, nT = tets.length;
    if (!nT) return;
    const X = this.x, Y = this.y, Z = this.z, IM = this.im, sc = this.scale;
    const sc3 = sc * sc * sc;
    // XPBD compliances tuned so continuum Poisson incompressibility & inversion recovery act cleanly without over-damping gait
    const alphaVol = 0.035 / (dt * dt);
    const alphaDev = 0.45 / (dt * dt);
    const ord = this.tetOrd;

    for (let qq = 0; qq < nT; qq++) {
      const Tt = tets[ord[fw ? qq : nT - 1 - qq]];
      const p0 = Tt.p0, p1 = Tt.p1, p2 = Tt.p2, p3 = Tt.p3;
      const w0 = IM[p0], w1 = IM[p1], w2 = IM[p2], w3 = IM[p3];

      let d1x = X[p1] - X[p0], d1y = Y[p1] - Y[p0], d1z = Z[p1] - Z[p0];
      let d2x = X[p2] - X[p0], d2y = Y[p2] - Y[p0], d2z = Z[p2] - Z[p0];
      let d3x = X[p3] - X[p0], d3y = Y[p3] - Y[p0], d3z = Z[p3] - Z[p0];

      const gSeg = Tt.seg >= 0 ? this.girth[Tt.seg] : 1;
      const gLimb = Tt.limb >= 0 ? this.limbLen[Tt.limb] : 1;
      // Target rest volume scales with tissue growth: radial girth^2 * axial scale^3 * limbLen
      const vRest = Tt.vol0 * sc3 * gSeg * gSeg * gLimb;
      const inv6V = 1 / (6 * vRest);

      // Analytical cofactor gradients grad_p1(J), grad_p2(J), grad_p3(J), grad_p0(J)
      const g1x = (d2y * d3z - d2z * d3y) * inv6V, g1y = (d2z * d3x - d2x * d3z) * inv6V, g1z = (d2x * d3y - d2y * d3x) * inv6V;
      const g2x = (d3y * d1z - d3z * d1y) * inv6V, g2y = (d3z * d1x - d3x * d1z) * inv6V, g2z = (d3x * d1y - d3y * d1x) * inv6V;
      const g3x = (d1y * d2z - d1z * d2y) * inv6V, g3y = (d1z * d2x - d1x * d2z) * inv6V, g3z = (d1x * d2y - d1y * d2x) * inv6V;
      const g0x = -(g1x + g2x + g3x), g0y = -(g1y + g2y + g3y), g0z = -(g1z + g2z + g3z);

      const J = d1x * g1x + d1y * g1y + d1z * g1z; // exact V / vRest
      // Stronger compliance if an element approaches inversion (J < 0.35)
      const effAlphaVol = J < 0.35 ? alphaVol * 0.08 : alphaVol;
      const Cvol = J - 1.0;
      const denomVol =
        w0 * (g0x * g0x + g0y * g0y + g0z * g0z) +
        w1 * (g1x * g1x + g1y * g1y + g1z * g1z) +
        w2 * (g2x * g2x + g2y * g2y + g2z * g2z) +
        w3 * (g3x * g3x + g3y * g3y + g3z * g3z) +
        effAlphaVol / vRest;

      if (denomVol > 1e-12) {
        const lam = clamp(-Cvol / denomVol, -0.08, 0.08);
        X[p0] += w0 * lam * g0x; Y[p0] += w0 * lam * g0y; Z[p0] += w0 * lam * g0z;
        X[p1] += w1 * lam * g1x; Y[p1] += w1 * lam * g1y; Z[p1] += w1 * lam * g1z;
        X[p2] += w2 * lam * g2x; Y[p2] += w2 * lam * g2y; Z[p2] += w2 * lam * g2z;
        X[p3] += w3 * lam * g3x; Y[p3] += w3 * lam * g3y; Z[p3] += w3 * lam * g3z;
      }

      // Neo-Hookean deviatoric shear projection from 3x3 deformation gradient F = Ds * B / linScale
      d1x = X[p1] - X[p0]; d1y = Y[p1] - Y[p0]; d1z = Z[p1] - Z[p0];
      d2x = X[p2] - X[p0]; d2y = Y[p2] - Y[p0]; d2z = Z[p2] - Z[p0];
      d3x = X[p3] - X[p0]; d3y = Y[p3] - Y[p0]; d3z = Z[p3] - Z[p0];
      const B = Tt.B, invLin = 1 / Math.cbrt(sc3 * gSeg * gSeg * gLimb);
      const F00 = (d1x * B[0] + d2x * B[3] + d3x * B[6]) * invLin, F01 = (d1x * B[1] + d2x * B[4] + d3x * B[7]) * invLin, F02 = (d1x * B[2] + d2x * B[5] + d3x * B[8]) * invLin;
      const F10 = (d1y * B[0] + d2y * B[3] + d3y * B[6]) * invLin, F11 = (d1y * B[1] + d2y * B[4] + d3y * B[7]) * invLin, F12 = (d1y * B[2] + d2y * B[5] + d3y * B[8]) * invLin;
      const F20 = (d1z * B[0] + d2z * B[3] + d3z * B[6]) * invLin, F21 = (d1z * B[1] + d2z * B[4] + d3z * B[7]) * invLin, F22 = (d1z * B[2] + d2z * B[5] + d3z * B[8]) * invLin;
      const I1 = F00 * F00 + F01 * F01 + F02 * F02 + F10 * F10 + F11 * F11 + F12 * F12 + F20 * F20 + F21 * F21 + F22 * F22;
      const rS = Math.sqrt(I1) || 1;
      const Cdev = rS - 1.7320508075688772; // sqrt(3)
      if (Math.abs(Cdev) > 0.02) {
        const sInv = invLin / rS;
        const s1x = (F00 * B[0] + F01 * B[1] + F02 * B[2]) * sInv, s1y = (F10 * B[0] + F11 * B[1] + F12 * B[2]) * sInv, s1z = (F20 * B[0] + F21 * B[1] + F22 * B[2]) * sInv;
        const s2x = (F00 * B[3] + F01 * B[4] + F02 * B[5]) * sInv, s2y = (F10 * B[3] + F11 * B[4] + F12 * B[5]) * sInv, s2z = (F20 * B[3] + F21 * B[4] + F22 * B[5]) * sInv;
        const s3x = (F00 * B[6] + F01 * B[7] + F02 * B[8]) * sInv, s3y = (F10 * B[6] + F11 * B[7] + F12 * B[8]) * sInv, s3z = (F20 * B[6] + F21 * B[7] + F22 * B[8]) * sInv;
        const s0x = -(s1x + s2x + s3x), s0y = -(s1y + s2y + s3y), s0z = -(s1z + s2z + s3z);
        const denD =
          w0 * (s0x * s0x + s0y * s0y + s0z * s0z) +
          w1 * (s1x * s1x + s1y * s1y + s1z * s1z) +
          w2 * (s2x * s2x + s2y * s2y + s2z * s2z) +
          w3 * (s3x * s3x + s3y * s3y + s3z * s3z) +
          alphaDev / vRest;
        const ld = clamp(-Cdev / denD, -0.03, 0.03);
        X[p0] += w0 * ld * s0x; Y[p0] += w0 * ld * s0y; Z[p0] += w0 * ld * s0z;
        X[p1] += w1 * ld * s1x; Y[p1] += w1 * ld * s1y; Z[p1] += w1 * ld * s1z;
        X[p2] += w2 * ld * s2x; Y[p2] += w2 * ld * s2y; Z[p2] += w2 * ld * s2z;
        X[p3] += w3 * ld * s3x; Y[p3] += w3 * ld * s3y; Z[p3] += w3 * ld * s3z;
      }
    }
  }

  /** Compute post-step 3D Neo-Hookean strain energy, Jacobian incompressibility, and segmental intramuscular pressures */
  measureContinuumFEM() {
    const tets = this.tets, nT = tets.length;
    if (!nT) return;
    const X = this.x, Y = this.y, Z = this.z, sc = this.scale, sc3 = sc * sc * sc;
    const segCnt = new Float64Array(NS);
    this.segJ.fill(0);
    let eTot = 0, jSum = 0, jMin = 1e9;
    const muNH = 12.0, lamNH = 48.0; // Neo-Hookean Lame constants (Poisson ratio nu = lam/(2*(lam+mu)) = 0.40)

    for (let k = 0; k < nT; k++) {
      const Tt = tets[k];
      const p0 = Tt.p0, p1 = Tt.p1, p2 = Tt.p2, p3 = Tt.p3, B = Tt.B;
      const d1x = X[p1] - X[p0], d1y = Y[p1] - Y[p0], d1z = Z[p1] - Z[p0];
      const d2x = X[p2] - X[p0], d2y = Y[p2] - Y[p0], d2z = Z[p2] - Z[p0];
      const d3x = X[p3] - X[p0], d3y = Y[p3] - Y[p0], d3z = Z[p3] - Z[p0];
      const gSeg = Tt.seg >= 0 ? this.girth[Tt.seg] : 1;
      const gLimb = Tt.limb >= 0 ? this.limbLen[Tt.limb] : 1;
      const vRest = Tt.vol0 * sc3 * gSeg * gSeg * gLimb;
      const invLin = 1 / Math.cbrt(sc3 * gSeg * gSeg * gLimb);

      const detDs =
        d1x * (d2y * d3z - d2z * d3y) +
        d1y * (d2z * d3x - d2x * d3z) +
        d1z * (d2x * d3y - d2y * d3x);
      const J = detDs / (6 * vRest);
      const Jpos = Math.max(0.05, J);
      const F00 = (d1x * B[0] + d2x * B[3] + d3x * B[6]) * invLin, F01 = (d1x * B[1] + d2x * B[4] + d3x * B[7]) * invLin, F02 = (d1x * B[2] + d2x * B[5] + d3x * B[8]) * invLin;
      const F10 = (d1y * B[0] + d2y * B[3] + d3y * B[6]) * invLin, F11 = (d1y * B[1] + d2y * B[4] + d3y * B[7]) * invLin, F12 = (d1y * B[2] + d2y * B[5] + d3y * B[8]) * invLin;
      const F20 = (d1z * B[0] + d2z * B[3] + d3z * B[6]) * invLin, F21 = (d1z * B[1] + d2z * B[4] + d3z * B[7]) * invLin, F22 = (d1z * B[2] + d2z * B[5] + d3z * B[8]) * invLin;
      const I1 = F00 * F00 + F01 * F01 + F02 * F02 + F10 * F10 + F11 * F11 + F12 * F12 + F20 * F20 + F21 * F21 + F22 * F22;
      const psi = 0.5 * muNH * Math.max(0, I1 - 3 - 2 * Math.log(Jpos)) + 0.5 * lamNH * (Jpos - 1) * (Jpos - 1);
      eTot += vRest * psi;
      jSum += J;
      if (J < jMin) jMin = J;
      if (Tt.seg >= 0) { this.segJ[Tt.seg] += J; segCnt[Tt.seg]++; }
    }
    this.femStrainEnergy = eTot;
    this.meanTetJ = jSum / nT;
    this.minTetJ = jMin;
    for (let s = 0; s < NS; s++) {
      if (segCnt[s] > 0) this.segJ[s] /= segCnt[s];
      else this.segJ[s] = 1;
      // Positive intramuscular pressure when segment tissue is compressed or radially contracted (skeletal-muscle venous pump)
      const radAct = Math.max(0, this.u[CH.radial + s] || 0);
      this.segPressure[s] = clamp(Math.max(0, 1 - this.segJ[s]) * 3.5 + 0.45 * radAct, 0, 2.0);
    }
  }

  step(dt, iters = 6, lesionMuscles = false) {
    const W = this.world, n = this.n, X = this.x, Y = this.y, Z = this.z, OX = this.ox, OY = this.oy, OZ = this.oz;
    const g = W.g, gx = W.gx * g, gz = W.gz * g, gy = -g * Math.sqrt(Math.max(0, 1 - W.gx * W.gx - W.gz * W.gz));
    const F = this.frames();
    const wx = W.wind.x, wz = W.wind.z, damp = 0.995;

    for (let i = 0; i < n; i++) {
      const vx = (X[i] - OX[i]) * damp, vy = (Y[i] - OY[i]) * damp, vz = (Z[i] - OZ[i]) * damp;
      OX[i] = X[i]; OY[i] = Y[i]; OZ[i] = Z[i];
      const drag = this.kind[i] === 'stalk' || this.kind[i] === 'eye' ? 0.6 : 0.15;
      X[i] += vx + (gx + drag * (wx - vx / dt)) * dt * dt;
      Y[i] += vy + gy * dt * dt;
      Z[i] += vz + (gz + drag * (wz - vz / dt)) * dt * dt;
    }

    const u = this.u;
    let e = 0;
    for (let k = 0; k < CH.N; k++) {
      // Optional local capillary O2 modulation when hemodynamics is severely hypoxic (< 0.55)
      let o2Gain = 1;
      if (this.segO2 && k < CH.stalk) {
        const s = k < CH.radial ? Math.floor(k / 4) : k < CH.leg ? k - CH.radial : 2;
        const o2 = this.segO2[Math.min(NS - 1, Math.max(0, s))];
        if (o2 < 0.55) o2Gain = clamp(0.35 + 1.18 * o2, 0.35, 1);
      }
      u[k] = lesionMuscles ? 0 : clamp(u[k] * o2Gain, -1, 1);
      e += Math.abs(u[k]);
    }
    this.energy = e;

    const cons = this.cons, sc = this.scale;
    const ord = this.ord || (this.ord = Uint16Array.from(cons.keys()));
    let rs = this.rs ?? (this.rs = 12345);
    for (let i = ord.length - 1; i > 0; i--) {
      rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0;
      const j = rs % (i + 1);
      const t = ord[i]; ord[i] = ord[j]; ord[j] = t;
    }
    if (!this.lesionFEM) {
      const tord = this.tetOrd;
      for (let i = tord.length - 1; i > 0; i--) {
        rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0;
        const j = rs % (i + 1);
        const t = tord[i]; tord[i] = tord[j]; tord[j] = t;
      }
    }
    this.rs = rs;

    for (let it = 0; it < iters; it++) {
      const fw = it % 2 === 0;
      for (let qq = 0; qq < cons.length; qq++) {
        const C = cons[ord[fw ? qq : cons.length - 1 - qq]];
        const a = C.a, b = C.b;
        let rest = C.rest * sc * (C.seg >= 0 ? this.girth[C.seg] : C.limb >= 0 ? this.limbLen[C.limb] : 1);
        if (C.m >= 0) rest *= Math.max(0.35, 1 + C.g * u[C.m]);
        const dx = X[b] - X[a], dy = Y[b] - Y[a], dz = Z[b] - Z[a];
        const d = Math.hypot(dx, dy, dz) || 1e-9;
        const w = this.im[a] + this.im[b];
        const corr = (C.k * (d - rest)) / (d * w);
        X[a] += dx * corr * this.im[a]; Y[a] += dy * corr * this.im[a]; Z[a] += dz * corr * this.im[a];
        X[b] -= dx * corr * this.im[b]; Y[b] -= dy * corr * this.im[b]; Z[b] -= dz * corr * this.im[b];
      }
      // Project 3D volumetric Neo-Hookean continuum tetrahedra on odd & final sweeps
      if (!this.lesionFEM && (it & 1)) this.solveContinuumFEM(dt, fw);
      this.collide(it === iters - 1, dt, F);
    }
    this.measureContinuumFEM();

    // Stretch receptors: mean length/rest of each muscle's constraints (muscle spindles)
    this.stretch.fill(0);
    const cnt = new Float64Array(CH.N);
    for (const C of cons) {
      if (C.m >= 0) {
        const d = Math.hypot(X[C.b] - X[C.a], Y[C.b] - Y[C.a], Z[C.b] - Z[C.a]);
        this.stretch[C.m] += d / (C.rest * sc) - 1;
        cnt[C.m]++;
      }
    }
    for (let k = 0; k < CH.N; k++) if (cnt[k]) this.stretch[k] /= cnt[k];
  }

  collide(friction, dt, F) {
    const W = this.world, X = this.x, Y = this.y, Z = this.z, OX = this.ox, OY = this.oy, OZ = this.oz;
    const u = this.u;
    this.grabbing = 0;
    for (let i = 0; i < this.n; i++) {
      const r = this.r[i];
      let hit = 0, nx = 0, ny = 1, nz = 0;
      const h = W.height(X[i], Z[i]);
      let pen = 0;
      if (Y[i] < h + r) {
        const N = W.normal(X[i], Z[i]);
        nx = N[0]; ny = N[1]; nz = N[2];
        pen = (h + r - Y[i]) * ny;
        X[i] += nx * pen; Y[i] += ny * pen; Z[i] += nz * pen;
        hit = 1;
      }
      for (const R of W.rocks) {
        const dx = X[i] - R.x, dy = Y[i] - R.y, dz = Z[i] - R.z, d = Math.hypot(dx, dy, dz), m = R.r + r;
        if (d < m && d > 1e-6) {
          const p = (m - d) / d;
          pen = Math.max(pen, m - d);
          X[i] += dx * p; Y[i] += dy * p; Z[i] += dz * p;
          nx = dx / d; ny = dy / d; nz = dz / d;
          hit = 2;
        }
      }
      for (const S of W.springs) {
        const dx = X[i] - S.x, dz = Z[i] - S.z;
        if (dx * dx + dz * dz < S.r * S.r) {
          const top = S.y + 0.3 - S.comp * 0.4;
          if (Y[i] < top + r) {
            Y[i] = top + r;
            if (Y[i] - OY[i] < 0) {
              S.v -= 0.4;
              OY[i] = Y[i] - 9 * dt * (0.5 + Math.max(0, S.comp));
            }
            hit = 3;
          }
        }
      }
      this.contact[i] = hit;
      if (!hit || !friction) continue;

      let dx = X[i] - OX[i], dy = Y[i] - OY[i], dz = Z[i] - OZ[i];
      const dn = dx * nx + dy * ny + dz * nz;
      dx -= dn * nx; dy -= dn * ny; dz -= dn * nz;
      const k = this.kind[i];
      let mu;
      if (k === 'foot' || k === 'hand') {
        const L = this.limbs.find((l) => l.foot === i);
        const gp = clamp(0.5 + 0.5 * u[L.grip]);
        this.gripP[i] = gp;
        mu = 0.15 + 0.83 * gp;
        if (hit === 2 && gp > 0.6) this.grabbing++;
      } else {
        const seg = this.segOf(i);
        const f = F[seg].f;
        const along = dx * f[0] + dy * f[1] + dz * f[2];
        const mAlong = along > 0 ? 0.05 : 0.86;
        const mLat = Math.max(0.28, (this.mLat ?? 0.65) * (1 - (this.scaleLift ?? 0) * Math.max(0, u[CH.radial + seg])));
        const ax = along * f[0], ay = along * f[1], az = along * f[2];
        if (this.coulomb) {
          const C = this.coulomb, lx = dx - ax, ly = dy - ay, lz = dz - az, la = Math.abs(along), ll = Math.hypot(lx, ly, lz);
          const fa = la > 1e-12 ? Math.min(1, ((along > 0 ? C.fwd : C.back) * pen) / la) : 0;
          const fl = ll > 1e-12 ? Math.min(1, (C.lat * (1 - (this.scaleLift ?? 0) * Math.max(0, u[CH.radial + seg])) * pen) / ll) : 0;
          X[i] -= ax * fa + lx * fl; Y[i] -= ay * fa + ly * fl; Z[i] -= az * fa + lz * fl;
          continue;
        }
        X[i] -= ax * mAlong + (dx - ax) * mLat;
        Y[i] -= ay * mAlong + (dy - ay) * mLat;
        Z[i] -= az * mAlong + (dz - az) * mLat;
        continue;
      }
      X[i] -= dx * mu; Y[i] -= dy * mu; Z[i] -= dz * mu;
    }
  }

  segOf(i) {
    if (this._seg) return this._seg[i];
    this._seg = new Int8Array(this.n);
    for (let s = 0; s < NS; s++) { this._seg[this.c[s]] = s; for (const j of this.ring[s]) this._seg[j] = s; }
    for (const L of this.limbs) { this._seg[L.knee] = L.s; this._seg[L.foot] = L.s; }
    for (const S of this.stalks) { this._seg[S.mid] = NS - 1; this._seg[S.eye] = NS - 1; }
    return this._seg[i];
  }
}
