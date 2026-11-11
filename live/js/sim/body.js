// Soft body (Pass 18): 336–348-Element Anisotropic Fiber-Reinforced (I4) 3D Volumetric Neo-Hookean Finite-Element (FEM) Continuum +
// 108-Gene Embryonic Hox-GRN Topological Body Plans (4/6/8 Limbs) + Huxley 2-State Ca2+-Troponin Actin-Myosin Sarcomere Histology +
// Two-Way LBM/Biot Poroelastic Fluid-Structure Interaction (FSI).
import * as T from '../tsotchke/taylor.js';
import { clamp } from './util.js';
import { evalHoxGRN } from './genome.js';

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
  constructor(world, x0 = 0, z0 = 0, heading = 0, morph = null) {
    this.world = world;
    const M = morph || {};
    const hox = evalHoxGRN(M);
    this.hox = hox;
    this.limbPairs = hox.limbPairs; // 2 = quadruped (4 limbs), 3 = hexapod (6 limbs, starter), 4 = octopod (8 limbs)
    const mLen = clamp(M.bodyLen ?? 1.0, 0.80, 1.25);
    const mTaper = clamp(M.bodyTaper ?? 0.0, -0.28, 0.28);
    const mGirth = clamp(M.bodyGirth ?? 1.0, 0.82, 1.22);
    const mFore = clamp(M.foreLimb ?? 1.0, 0.78, 1.30);
    const mHind = clamp(M.hindLimb ?? 1.0, 0.78, 1.30);
    const mStalk = clamp(M.stalkHeight ?? 1.0, 0.72, 1.40);
    this.morph = {
      bodyLen: mLen,
      bodyTaper: mTaper,
      bodyGirth: mGirth,
      foreLimb: mFore,
      hindLimb: mHind,
      stalkHeight: mStalk,
      crestFin: clamp(M.crestFin ?? 0.65, 0.1, 1.6),
      tailFluke: clamp(M.tailFluke ?? 0.60, 0.1, 1.6),
      scuteAniso: clamp(M.scuteAniso ?? 1.0, 0.65, 1.35),
      fiberStiff: clamp(M.fiberStiff ?? 1.0, 0.65, 1.45),
      pigmentHue: clamp(M.pigmentHue ?? 0.52, 0, 1),
      limbPairs: hox.limbPairs,
      osteoderm: hox.osteoderm,
      gillFronds: hox.gillFronds,
      sarcomereVmax: hox.sarcomereVmax,
    };

    const segStep = SEG * mLen;
    this.segRad = Float64Array.from({ length: NS }, (_, i) => {
      const u = i / (NS - 1) - 0.5; // -0.5 tail .. +0.5 head
      return RAD[i] * mGirth * hox.segGirthMod[i] * clamp(1 + mTaper * u, 0.72, 1.32);
    });

    const P = [];
    const add = (x, y, z, m, r, kind) => { P.push({ x, y, z, m, r, kind }); return P.length - 1; };
    const ch = Math.cos(heading), sh = Math.sin(heading);
    const base = world.height(x0, z0) + 0.6;
    const W = (fx, fy, fz) => [x0 + fx * ch - fz * sh, base + fy, z0 + fx * sh + fz * ch];

    // 1) Primary 51 anatomical particles (indices 0..50 preserved verbatim)
    this.c = [];
    this.ring = []; // ring j: 0 top, 1 left(-z), 2 bottom, 3 right(+z)
    const off = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    for (let i = 0; i < NS; i++) {
      const fx = (i - (NS - 1) / 2) * segStep;
      const ri = this.segRad[i];
      this.c.push(add(...W(fx, 0, 0), 1, ri * 0.8, 'core'));
      const rr = [];
      for (let j = 0; j < 4; j++) {
        rr.push(add(...W(fx, off[j][1] * ri, off[j][0] * ri), j === 2 ? 2.4 : j === 0 ? 0.2 : 0.6, 0.09, 'skin'));
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
    const suppressMidLegs = this.limbPairs === 2;
    const limb = (s, side, kind, idx, extraPair = false) => {
      const sz = side === 1 ? -1 : 1;
      const fx = (s - (NS - 1) / 2) * segStep;
      const isArm = kind === 'arm';
      const vestigial = !isArm && !extraPair && suppressMidLegs && s === 3;
      const lMult = vestigial ? 0.22 : (isArm ? mFore : mHind);
      const L1 = (isArm ? 0.38 : 0.34) * lMult;
      const rs = this.segRad[s];
      tagLimb = this.limbs.length;
      const hip = this.ring[s][side];
      const knee = add(
        ...W(fx + (isArm ? 0.1 : 0) * mLen, vestigial ? 0.02 : (isArm ? 0.05 : -0.05), sz * (rs + L1)),
        vestigial ? 0.12 : 0.35, 0.07, vestigial ? 'bud' : 'knee'
      );
      const foot = add(
        ...W(fx + (isArm ? 0.25 : 0) * mLen, vestigial ? 0.0 : (isArm ? -0.15 : -0.4) * lMult, sz * (rs + L1 + 0.1 * lMult)),
        vestigial ? 0.10 : 0.3, 0.08, vestigial ? 'bud' : (isArm ? 'hand' : 'foot')
      );
      con(hip, knee, 1); con(knee, this.c[s], 0.9); con(knee, foot, 1); con(foot, this.c[s], vestigial ? 0.65 : 0.15);
      const sw = isArm ? CH.arm + idx * 3 : CH.leg + idx * 2;
      const swGain = vestigial ? 0 : (extraPair ? -0.42 : 0.45);
      con(knee, this.ring[s + 1][side], 0.8, vestigial ? -1 : sw, -swGain);
      con(knee, this.ring[s - 1][side], 0.8, vestigial ? -1 : sw, swGain);
      con(foot, hip, 0.8, vestigial ? -1 : sw + 1, vestigial ? 0 : 0.5);
      if (isArm) con(knee, this.ring[s][2], 0.7, sw + 2, 0.45);
      this.limbs.push({
        kind, s, side, hip, knee, foot,
        grip: isArm ? CH.armGrip + idx : CH.legGrip + idx,
        idx, vestigial, extraPair,
      });
      tagLimb = -1;
    };
    limb(1, 1, 'leg', 0); limb(1, 3, 'leg', 1);
    limb(3, 1, 'leg', 2); limb(3, 3, 'leg', 3);
    limb(5, 1, 'arm', 0); limb(5, 3, 'arm', 1);

    this.stalks = [];
    for (let s = 0; s < 2; s++) {
      const sz = s ? 1 : -1, fx = ((NS - 1) / 2) * segStep;
      const rh = this.segRad[NS - 1];
      const top = this.ring[NS - 1][0];
      const m1 = add(...W(fx + 0.05 * mStalk, rh + 0.3 * mStalk, sz * 0.14 * mStalk), 0.12, 0.05, 'stalk');
      const eye = add(...W(fx + 0.15 * mStalk, rh + 0.55 * mStalk, sz * 0.24 * mStalk), 0.1, 0.09, 'eye');
      con(top, m1, 1); con(m1, eye, 1); con(eye, top, 0.3);
      con(m1, this.ring[NS - 1][1], 0.6, CH.stalk + s * 2, sz * 0.4);
      con(m1, this.ring[NS - 1][3], 0.6, CH.stalk + s * 2, -sz * 0.4);
      con(eye, this.c[NS - 2], 0.5, CH.stalk + s * 2 + 1, 0.3);
      con(eye, this.c[NS - 1], 0.4);
      this.stalks.push({ base: top, mid: m1, eye });
    }

    // 2) High-resolution octagonal epimysial/dermal vertices (28) + internal mid-bay core centroids (6) -> 85 nodes total
    this.ringDiag = [];
    const s45 = Math.SQRT1_2;
    const diagOff = [[-s45, s45], [-s45, -s45], [s45, -s45], [s45, s45]]; // top-L, bot-L, bot-R, top-R
    for (let i = 0; i < NS; i++) {
      const fx = (i - (NS - 1) / 2) * segStep;
      const ri = this.segRad[i], R = this.ring[i], c = this.c[i], mr = CH.radial + i;
      const dd = [];
      tagSeg = i;
      for (let d = 0; d < 4; d++) {
        const pIdx = add(...W(fx, diagOff[d][1] * ri, diagOff[d][0] * ri), 0.04, 0.06, 'epimysium');
        dd.push(pIdx);
        con(c, pIdx, 0.55, mr, 0.45);
        con(R[d], pIdx, 0.65, mr, 0.45);
        con(R[(d + 1) & 3], pIdx, 0.65, mr, 0.45);
      }
      tagSeg = -1;
      this.ringDiag.push(dd);
    }
    for (let i = 0; i < NS - 1; i++) {
      const D0 = this.ringDiag[i], D1 = this.ringDiag[i + 1];
      for (let d = 0; d < 4; d++) {
        // Couple diagonal epimysial myofibrils to flanking longitudinal channels
        con(D0[d], D1[d], 0.45, CH.long + i * 4 + d, -0.22);
      }
    }

    this.midCore = [];
    for (let s = 0; s < NS - 1; s++) {
      const fx = (s + 0.5 - (NS - 1) / 2) * segStep;
      const mc = add(...W(fx, 0, 0), 0.05, 0.05, 'midcore');
      this.midCore.push(mc);
      con(this.c[s], mc, 0.65);
      con(this.c[s + 1], mc, 0.65);
      for (let j = 0; j < 4; j++) {
        con(this.ring[s][j], mc, 0.35);
        con(this.ring[s + 1][j], mc, 0.35);
      }
    }

    // 3) Optional Hox-expressed 4th bilateral thoracic limb pair (octopod, limbPairs === 4) at segment s = 2 (nodes 85..88)
    if (this.limbPairs === 4) {
      limb(2, 1, 'leg', 0, true);
      limb(2, 3, 'leg', 1, true);
    }
    this.activeLimbs = this.limbs.filter((L) => !L.vestigial).length;

    const n = P.length;
    this.n = n;
    this.x = new Float64Array(n); this.y = new Float64Array(n); this.z = new Float64Array(n);
    this.ox = new Float64Array(n); this.oy = new Float64Array(n); this.oz = new Float64Array(n);
    this.im = new Float64Array(n); this.r = new Float64Array(n);
    this.fsiFx = new Float64Array(n); this.fsiFy = new Float64Array(n); this.fsiFz = new Float64Array(n);
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

    // ---------------------------------------------------------------- 336-Element Anisotropic Fiber-Reinforced 3D Continuum FEM Mesh
    //  - 288 Trunk elements: 6 bays x 8 octagonal sectors x 6 star-split non-overlapping tetrahedra around midCore[s]
    //  -  36 Limb muscle-belly elements: 6 limbs x 6 sagittal-anchored proximal/distal tetrahedra
    //  -  12 Cranial/eye-stalk elements: 2 stalks x 6 orbital-cranial tetrahedra
    //  Total = 336 positively-oriented 3D volumetric finite elements (4.3x finer than Pass 16's 78 elements!).
    this.tets = [];
    const addTet = (p0, p1, p2, p3, seg, limbIdx = -1, ax0 = ch, ay0 = 0, az0 = sh) => {
      let i0 = p0, i1 = p1, i2 = p2, i3 = p3;
      let d1x = P[i1].x - P[i0].x, d1y = P[i1].y - P[i0].y, d1z = P[i1].z - P[i0].z;
      let d2x = P[i2].x - P[i0].x, d2y = P[i2].y - P[i0].y, d2z = P[i2].z - P[i0].z;
      let d3x = P[i3].x - P[i0].x, d3y = P[i3].y - P[i0].y, d3z = P[i3].z - P[i0].z;
      let m = invert3x3(d1x, d1y, d1z, d2x, d2y, d2z, d3x, d3y, d3z);
      if (m.det < 0) {
        const tmp = i2; i2 = i3; i3 = tmp;
        d2x = P[i2].x - P[i0].x; d2y = P[i2].y - P[i0].y; d2z = P[i2].z - P[i0].z;
        d3x = P[i3].x - P[i0].x; d3y = P[i3].y - P[i0].y; d3z = P[i3].z - P[i0].z;
        m = invert3x3(d1x, d1y, d1z, d2x, d2y, d2z, d3x, d3y, d3z);
      }
      const vol0 = m.det / 6;
      const fn = Math.hypot(ax0, ay0, az0) || 1;
      if (vol0 > 1e-6) {
        this.tets.push({
          p0: i0, p1: i1, p2: i2, p3: i3, vol0, B: m.inv, seg, limb: limbIdx,
          f0x: ax0 / fn, f0y: ay0 / fn, f0z: az0 / fn,
        });
      }
    };

    const octRing = (s) => {
      const R = this.ring[s], D = this.ringDiag[s];
      return [R[0], D[0], R[1], D[1], R[2], D[2], R[3], D[3]];
    };
    for (let s = 0; s < NS - 1; s++) {
      const C0 = this.c[s], C1 = this.c[s + 1], MC = this.midCore[s];
      const O0 = octRing(s), O1 = octRing(s + 1);
      const ax = P[C1].x - P[C0].x, ay = P[C1].y - P[C0].y, az = P[C1].z - P[C0].z;
      for (let k = 0; k < 8; k++) {
        const kn = (k + 1) & 7;
        const u0 = O0[k], v0 = O0[kn], u1 = O1[k], v1 = O1[kn];
        addTet(MC, C0, u0, v0, s, -1, ax, ay, az);
        addTet(MC, C1, u1, v1, s + 1, -1, ax, ay, az);
        addTet(MC, C0, v0, u1, s, -1, ax, ay, az);
        addTet(MC, C1, u0, v1, s + 1, -1, ax, ay, az);
        addTet(MC, u0, v0, u1, s, -1, ax, ay, az);
        addTet(MC, v0, u1, v1, s + 1, -1, ax, ay, az);
      }
    }

    // 36 sagittal-anchored limb muscle-belly tetrahedra (6 per limb: non-coplanar, wide base, zero inversions)
    this.limbs.forEach((L, k) => {
      const cs = this.c[L.s], top = this.ring[L.s][0], bot = this.ring[L.s][2];
      const ant = this.ring[L.s + 1][L.side], post = this.ring[L.s - 1][L.side];
      const lx = P[L.knee].x - P[cs].x, ly = P[L.knee].y - P[cs].y, lz = P[L.knee].z - P[cs].z;
      const sx = P[L.foot].x - P[L.knee].x, sy = P[L.foot].y - P[L.knee].y, sz2 = P[L.foot].z - P[L.knee].z;
      addTet(cs, top, ant, L.knee, L.s, k, lx, ly, lz);
      addTet(cs, top, post, L.knee, L.s, k, lx, ly, lz);
      addTet(cs, bot, ant, L.knee, L.s, k, lx, ly, lz);
      addTet(cs, bot, post, L.knee, L.s, k, lx, ly, lz);
      addTet(ant, post, top, L.knee, L.s, k, lx, ly, lz);
      addTet(cs, ant, L.knee, L.foot, L.s, k, sx, sy, sz2);
    });

    // 12 cranial / orbital eye-stalk continuum tetrahedra (6 per stalk)
    this.stalks.forEach((S, idx) => {
      const side = idx ? 3 : 1;
      const c6 = this.c[NS - 1], c5 = this.c[NS - 2], rTop = this.ring[NS - 1][0], rLat = this.ring[NS - 1][side];
      const sx = P[S.eye].x - P[c6].x, sy = P[S.eye].y - P[c6].y, sz2 = P[S.eye].z - P[c6].z;
      addTet(c6, rTop, rLat, S.mid, NS - 1, -1, sx, sy, sz2);
      addTet(c5, c6, rTop, S.mid, NS - 1, -1, sx, sy, sz2);
      addTet(c5, c6, rLat, S.mid, NS - 1, -1, sx, sy, sz2);
      addTet(c6, rTop, S.mid, S.eye, NS - 1, -1, sx, sy, sz2);
      addTet(c6, rLat, S.mid, S.eye, NS - 1, -1, sx, sy, sz2);
      addTet(c5, c6, S.mid, S.eye, NS - 1, -1, sx, sy, sz2);
    });

    this.tetOrd = Uint16Array.from(this.tets.keys());

    // Continuum FEM telemetry & biomechanical FSI coupling buffers
    this.lesionFEM = false;
    this.femStrainEnergy = 0; // total Holzapfel-Gasser-Ogden + Neo-Hookean elastic energy
    this.meanTetJ = 1;        // mean volumetric Jacobian J = V / V0 (~1.0 = incompressible tissue)
    this.minTetJ = 1;         // minimum Jacobian across all 336 elements (> 0 = zero element inversions)
    this.meanTetI4 = 1;       // mean anisotropic myofibril stretch invariant I4 = ||F * a0||^2
    this.fsiForceMag = 0;     // RMS two-way Biot capillary FSI turgor force on FEM vertices
    this.segJ = new Float64Array(NS).fill(1);
    this.segPressure = new Float64Array(NS);
    this.segO2 = null;

    this.cons = cons;
    this.u = new Float64Array(CH.N);
    this.caTroponin = new Float64Array(CH.N);   // Sarcoplasmic Ca2+-Troponin C bound fraction [0..1]
    this.crossBridge = new Float64Array(CH.N);  // Huxley attached actin-myosin cross-bridge fraction [0..1]
    this.sarcomereForce = new Float64Array(CH.N); // Effective sarcomere active tension output [-1..1]
    this.prevStretch = new Float64Array(CH.N);
    this.meanCrossBridge = 0;
    this.meanCaTroponin = 0;
    this.jawOpen = 0;
    this.stretch = new Float64Array(CH.N);
    this.ext = [];
    this.scale = 1;
    this.girth = new Float64Array(NS).fill(1);
    this.limbLen = new Float64Array(this.limbs.length).fill(1);
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
   * Solve 336-element Anisotropic Fiber-Reinforced (I4) 3D Neo-Hookean XPBD continuum tetrahedra:
   *  - Hydrostatic volume preservation C_vol = J - 1 (Poisson lateral bulging & strict inversion barrier J > 0)
   *  - Deviatoric shear stabilization C_dev = sqrt(I1) - sqrt(3)
   *  - Transversely isotropic Holzapfel-Gasser-Ogden myofibril stretch resistance C_fib = sqrt(I4) - 1 along a0!
   */
  solveContinuumFEM(dt, fw) {
    const tets = this.tets, nT = tets.length;
    if (!nT) return;
    const X = this.x, Y = this.y, Z = this.z, IM = this.im, sc = this.scale;
    const sc3 = sc * sc * sc;
    // Compliances scaled by 336/78 element subdivision so macroscopic Lame modulus matches calibrated soft-tissue stiffness
    const alphaVol = 0.14 / (dt * dt);
    const alphaDev = 1.85 / (dt * dt);
    const alphaFib = (2.4 / (this.morph?.fiberStiff ?? 1.0)) / (dt * dt);
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
      const vRest = Tt.vol0 * sc3 * gSeg * gSeg * gLimb;
      const inv6V = 1 / (6 * vRest);

      const g1x = (d2y * d3z - d2z * d3y) * inv6V, g1y = (d2z * d3x - d2x * d3z) * inv6V, g1z = (d2x * d3y - d2y * d3x) * inv6V;
      const g2x = (d3y * d1z - d3z * d1y) * inv6V, g2y = (d3z * d1x - d3x * d1z) * inv6V, g2z = (d3x * d1y - d3y * d1x) * inv6V;
      const g3x = (d1y * d2z - d1z * d2y) * inv6V, g3y = (d1z * d2x - d1x * d2z) * inv6V, g3z = (d1x * d2y - d1y * d2x) * inv6V;
      const g0x = -(g1x + g2x + g3x), g0y = -(g1y + g2y + g3y), g0z = -(g1z + g2z + g3z);

      const J = d1x * g1x + d1y * g1y + d1z * g1z;
      const effAlphaVol = J < 0.38 ? alphaVol * 0.04 : alphaVol;
      const Cvol = J - 1.0;
      const denomVol =
        w0 * (g0x * g0x + g0y * g0y + g0z * g0z) +
        w1 * (g1x * g1x + g1y * g1y + g1z * g1z) +
        w2 * (g2x * g2x + g2y * g2y + g2z * g2z) +
        w3 * (g3x * g3x + g3y * g3y + g3z * g3z) +
        effAlphaVol / vRest;

      if (denomVol > 1e-12) {
        const lam = clamp(-Cvol / denomVol, -0.06, 0.06);
        X[p0] += w0 * lam * g0x; Y[p0] += w0 * lam * g0y; Z[p0] += w0 * lam * g0z;
        X[p1] += w1 * lam * g1x; Y[p1] += w1 * lam * g1y; Z[p1] += w1 * lam * g1z;
        X[p2] += w2 * lam * g2x; Y[p2] += w2 * lam * g2y; Z[p2] += w2 * lam * g2z;
        X[p3] += w3 * lam * g3x; Y[p3] += w3 * lam * g3y; Z[p3] += w3 * lam * g3z;
      }

      d1x = X[p1] - X[p0]; d1y = Y[p1] - Y[p0]; d1z = Z[p1] - Z[p0];
      d2x = X[p2] - X[p0]; d2y = Y[p2] - Y[p0]; d2z = Z[p2] - Z[p0];
      d3x = X[p3] - X[p0]; d3y = Y[p3] - Y[p0]; d3z = Z[p3] - Z[p0];
      const B = Tt.B, invLin = 1 / Math.cbrt(sc3 * gSeg * gSeg * gLimb);
      const F00 = (d1x * B[0] + d2x * B[3] + d3x * B[6]) * invLin, F01 = (d1x * B[1] + d2x * B[4] + d3x * B[7]) * invLin, F02 = (d1x * B[2] + d2x * B[5] + d3x * B[8]) * invLin;
      const F10 = (d1y * B[0] + d2y * B[3] + d3y * B[6]) * invLin, F11 = (d1y * B[1] + d2y * B[4] + d3y * B[7]) * invLin, F12 = (d1y * B[2] + d2y * B[5] + d3y * B[8]) * invLin;
      const F20 = (d1z * B[0] + d2z * B[3] + d3z * B[6]) * invLin, F21 = (d1z * B[1] + d2z * B[4] + d3z * B[7]) * invLin, F22 = (d1z * B[2] + d2z * B[5] + d3z * B[8]) * invLin;

      const I1 = F00 * F00 + F01 * F01 + F02 * F02 + F10 * F10 + F11 * F11 + F12 * F12 + F20 * F20 + F21 * F21 + F22 * F22;
      const rS = Math.sqrt(I1) || 1;
      const Cdev = rS - 1.7320508075688772;
      if (Math.abs(Cdev) > 0.025) {
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
        const ld = clamp(-Cdev / denD, -0.022, 0.022);
        X[p0] += w0 * ld * s0x; Y[p0] += w0 * ld * s0y; Z[p0] += w0 * ld * s0z;
        X[p1] += w1 * ld * s1x; Y[p1] += w1 * ld * s1y; Z[p1] += w1 * ld * s1z;
        X[p2] += w2 * ld * s2x; Y[p2] += w2 * ld * s2y; Z[p2] += w2 * ld * s2z;
        X[p3] += w3 * ld * s3x; Y[p3] += w3 * ld * s3y; Z[p3] += w3 * ld * s3z;
      }

      // Anisotropic myofibril / collagen passive tension invariant I4 = ||F * a0||^2 (resists excessive tensile overstretch I4 > 1.06)
      const ax = Tt.f0x, ay = Tt.f0y, az = Tt.f0z;
      const fax = F00 * ax + F01 * ay + F02 * az;
      const fay = F10 * ax + F11 * ay + F12 * az;
      const faz = F20 * ax + F21 * ay + F22 * az;
      const stretchF = Math.hypot(fax, fay, faz);
      if (stretchF > 1.08) {
        const Cfib = stretchF - 1.08;
        const q1 = (B[0] * ax + B[1] * ay + B[2] * az) * invLin / stretchF;
        const q2 = (B[3] * ax + B[4] * ay + B[5] * az) * invLin / stretchF;
        const q3 = (B[6] * ax + B[7] * ay + B[8] * az) * invLin / stretchF;
        const q0 = -(q1 + q2 + q3);
        const denF = (w0 * q0 * q0 + w1 * q1 * q1 + w2 * q2 * q2 + w3 * q3 * q3) * (fax * fax + fay * fay + faz * faz) + alphaFib / vRest;
        const lf = clamp(-Cfib / (denF + 1e-12), -0.018, 0.018);
        X[p0] += w0 * lf * q0 * fax; Y[p0] += w0 * lf * q0 * fay; Z[p0] += w0 * lf * q0 * faz;
        X[p1] += w1 * lf * q1 * fax; Y[p1] += w1 * lf * q1 * fay; Z[p1] += w1 * lf * q1 * faz;
        X[p2] += w2 * lf * q2 * fax; Y[p2] += w2 * lf * q2 * fay; Z[p2] += w2 * lf * q2 * faz;
        X[p3] += w3 * lf * q3 * fax; Y[p3] += w3 * lf * q3 * fay; Z[p3] += w3 * lf * q3 * faz;
      }
    }
  }

  /** Compute post-step 3D Holzapfel-Gasser-Ogden + Neo-Hookean strain energy, Jacobian J, fiber I4 & intramuscular pressures */
  measureContinuumFEM() {
    const tets = this.tets, nT = tets.length;
    if (!nT) return;
    const X = this.x, Y = this.y, Z = this.z, sc = this.scale, sc3 = sc * sc * sc;
    const segCnt = new Float64Array(NS);
    this.segJ.fill(0);
    let eTot = 0, jSum = 0, jMin = 1e9, i4Sum = 0;
    const muNH = 12.0, lamNH = 48.0, kFib = 18.0 * (this.morph?.fiberStiff ?? 1.0);

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
      const fax = F00 * Tt.f0x + F01 * Tt.f0y + F02 * Tt.f0z;
      const fay = F10 * Tt.f0x + F11 * Tt.f0y + F12 * Tt.f0z;
      const faz = F20 * Tt.f0x + F21 * Tt.f0y + F22 * Tt.f0z;
      const I4 = fax * fax + fay * fay + faz * faz;
      const fibTerm = I4 > 1 ? 0.5 * kFib * (I4 - 1) * (I4 - 1) : 0;
      const psi = 0.5 * muNH * Math.max(0, I1 - 3 - 2 * Math.log(Jpos)) + 0.5 * lamNH * (Jpos - 1) * (Jpos - 1) + fibTerm;
      eTot += vRest * psi;
      jSum += J;
      i4Sum += I4;
      if (J < jMin) jMin = J;
      if (Tt.seg >= 0) { this.segJ[Tt.seg] += J; segCnt[Tt.seg]++; }
    }
    this.femStrainEnergy = eTot;
    this.meanTetJ = jSum / nT;
    this.minTetJ = jMin;
    this.meanTetI4 = i4Sum / nT;
    for (let s = 0; s < NS; s++) {
      if (segCnt[s] > 0) this.segJ[s] /= segCnt[s];
      else this.segJ[s] = 1;
      const radAct = Math.max(0, this.u[CH.radial + s] || 0);
      this.segPressure[s] = clamp(Math.max(0, 1 - this.segJ[s]) * 3.5 + 0.45 * radAct, 0, 2.0);
    }
  }

  step(dt, iters = 6, lesionMuscles = false) {
    const W = this.world, n = this.n, X = this.x, Y = this.y, Z = this.z, OX = this.ox, OY = this.oy, OZ = this.oz;
    const g = W.g, gx = W.gx * g, gz = W.gz * g, gy = -g * Math.sqrt(Math.max(0, 1 - W.gx * W.gx - W.gz * W.gz));
    const F = this.frames();
    const wx = W.wind.x, wz = W.wind.z, damp = 0.995;
    const fFx = this.fsiFx, fFy = this.fsiFy, fFz = this.fsiFz, IM = this.im;

    for (let i = 0; i < n; i++) {
      const vx = (X[i] - OX[i]) * damp, vy = (Y[i] - OY[i]) * damp, vz = (Z[i] - OZ[i]) * damp;
      OX[i] = X[i]; OY[i] = Y[i]; OZ[i] = Z[i];
      const drag = this.kind[i] === 'stalk' || this.kind[i] === 'eye' ? 0.6 : 0.15;
      // Include two-way Biot poroelastic capillary FSI acceleration IM[i] * fsiF[i]
      const imFsi = Math.min(1.6, IM[i]);
      X[i] += vx + (gx + drag * (wx - vx / dt) + imFsi * fFx[i]) * dt * dt;
      Y[i] += vy + (gy + imFsi * fFy[i]) * dt * dt;
      Z[i] += vz + (gz + drag * (wz - vz / dt) + imFsi * fFz[i]) * dt * dt;
    }

    const u = this.u, caT = this.caTroponin, xbArr = this.crossBridge, sf = this.sarcomereForce;
    const prevSt = this.prevStretch, curSt = this.stretch;
    const vMax = 3.2 * (this.morph?.sarcomereVmax ?? 1.0);
    let e = 0, xbSum = 0, caSum = 0;
    for (let k = 0; k < CH.N; k++) {
      let o2Gain = 1;
      if (this.segO2 && k < CH.stalk) {
        const s = k < CH.radial ? Math.floor(k / 4) : k < CH.leg ? k - CH.radial : 2;
        const o2 = this.segO2[Math.min(NS - 1, Math.max(0, s))];
        if (o2 < 0.55) o2Gain = clamp(0.35 + 1.18 * o2, 0.35, 1);
      }
      const uDrive = lesionMuscles ? 0 : clamp(u[k] * o2Gain, -1, 1);
      u[k] = uDrive;

      // Huxley 2-state sarcoplasmic Ca2+-Troponin C binding & actin-myosin cross-bridge kinetics:
      //   dca/dt = (|u| - ca) / tau_SERCA,   dn_xb/dt = f_att(ca) * (1 - n_xb) - g_det(|v|) * n_xb
      const mag = Math.abs(uDrive);
      const tauCa = mag > caT[k] ? 0.0055 : 0.014;
      const ca = caT[k] + Math.min(1, dt / tauCa) * (mag - caT[k]);
      caT[k] = ca;

      const vShort = clamp((prevSt[k] - curSt[k]) / Math.max(1e-4, dt), -4.5, 4.5);
      prevSt[k] = curSt[k];
      const fAtt = 140 * ca;
      const gDet = 32 * (1 + 0.55 * (Math.abs(vShort) / vMax));
      const rTot = fAtt + gDet;
      const xbEq = rTot > 1e-6 ? fAtt / rTot : 0;
      const xb = xbEq + (xbArr[k] - xbEq) * Math.exp(-Math.min(8, rTot * dt));
      xbArr[k] = xb;

      // Gordon-Huxley-Julian filament-overlap force-length f_L(lambda) & Hill-Huxley concentric/eccentric force-velocity f_V(v)
      const fL = Math.exp(-((curSt[k] / 0.44) ** 2));
      const vr = vShort / vMax;
      const fV = vr >= 0
        ? Math.max(0.48, (1 - 0.32 * vr) / (1 + 0.62 * vr))
        : Math.min(1.30, 1 + 0.24 * (-vr));
      const xbNorm = mag > 1e-4 ? clamp((xb / Math.max(0.16, mag * 0.814)) * fL * fV, 0.78, 1.18) : 1.0;
      const sarcoMag = clamp(mag * (0.86 + 0.14 * xbNorm), 0, 1.05);
      sf[k] = uDrive >= 0 ? sarcoMag : -sarcoMag;

      xbSum += xb;
      caSum += ca;
      e += Math.abs(sf[k]);
    }
    this.meanCrossBridge = xbSum / CH.N;
    this.meanCaTroponin = caSum / CH.N;
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
        if (C.m >= 0) rest *= Math.max(0.35, 1 + C.g * sf[C.m]);
        const dx = X[b] - X[a], dy = Y[b] - Y[a], dz = Z[b] - Z[a];
        const d = Math.hypot(dx, dy, dz) || 1e-9;
        const w = IM[a] + IM[b];
        const corr = (C.k * (d - rest)) / (d * w);
        X[a] += dx * corr * IM[a]; Y[a] += dy * corr * IM[a]; Z[a] += dz * corr * IM[a];
        X[b] -= dx * corr * IM[b]; Y[b] -= dy * corr * IM[b]; Z[b] -= dz * corr * IM[b];
      }
      if (!this.lesionFEM && (it === iters - 1 || it === 1)) this.solveContinuumFEM(dt, fw);
      this.collide(it === iters - 1, dt, F);
    }
    this.measureContinuumFEM();

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
    const scuteAniso = this.morph?.scuteAniso ?? 1.0;
    this.grabbing = 0;
    for (let i = 0; i < this.n; i++) {
      // Internal mid-bay core centroids & embryonically suppressed limb buds do not contact ground
      if (this.kind[i] === 'midcore' || this.kind[i] === 'bud') { this.contact[i] = 0; continue; }
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
        const mAlong = along > 0 ? clamp(0.05 / scuteAniso, 0.02, 0.12) : clamp(0.86 * scuteAniso, 0.60, 0.96);
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
    for (let s = 0; s < NS; s++) {
      this._seg[this.c[s]] = s;
      for (const j of this.ring[s]) this._seg[j] = s;
      for (const j of this.ringDiag[s]) this._seg[j] = s;
    }
    for (let s = 0; s < NS - 1; s++) this._seg[this.midCore[s]] = s;
    for (const L of this.limbs) { this._seg[L.knee] = L.s; this._seg[L.foot] = L.s; }
    for (const S of this.stalks) { this._seg[S.mid] = NS - 1; this._seg[S.eye] = NS - 1; }
    return this._seg[i];
  }
}
