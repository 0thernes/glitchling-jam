// Coupled 1D Murray's-Law Branching Navier-Stokes Vascular Tree (36 nodes / 64 vessels)
// + 3D D3Q19 Lattice-Boltzmann (24x8x8 = 1,536-cell / 29,184-population) Microvascular Sinus Navier-Stokes Solver
// + 63-voxel 3D Biot-Darcy Poroelastic Capillary Continuum + Two-Way Fluid-Structure Interaction (FSI)
// + 1,024-cell 3D WCSPH Hemodynamics (896 O2-carrying Erythrocytes + 128 Chemotactic Marginating Leukocytes).
import { clamp, mulberry } from './util.js';
import { NS } from './body.js';

// 36 anatomical 3D nodes:
//  0..6   Dorsal Aorta (seg 0..6)
//  7..13  Vena Cava (seg 0..6)
//  14     Cerebral Circle of Willis (head)
//  15     Hepatic-Portal Splanchnic Bed (gut/liver, seg 3)
//  16..22 Left Segmental Murray Arteriolar Bifurcation Nodes (seg 0..6)
//  23..29 Right Segmental Murray Arteriolar Bifurcation Nodes (seg 0..6)
//  30, 31 Left & Right Branchial Gill-Arch Respiratory Plexus (seg 5)
//  32     Coronary Myocardial Capillary Bed (heart, seg 4)
//  33, 34 Left & Right Renal-Nephridial Glomerular Plexus (seg 2)
//  35     Caudal Tail Venous Sinus (seg 0)
export const N_NODES = 36;
export const N_ERYTHROCYTES = 896;
export const N_LEUKOCYTES = 128;
export const N_PARCELS = N_ERYTHROCYTES + N_LEUKOCYTES; // 1,024 discrete 3D blood cells
export const NX_CAP = NS; // 7 axial segments
export const NY_CAP = 3;  // 0 = ventral, 1 = core, 2 = dorsal
export const NZ_CAP = 3;  // 0 = left,    1 = medial, 2 = right
export const N_CAP = NX_CAP * NY_CAP * NZ_CAP; // 63 3D poroelastic capillary voxels

// 3D D3Q19 Lattice-Boltzmann vascular lumen grid: 24 axial x 8 dorsoventral x 8 mediolateral = 1,536 3D cells (29,184 f_q populations)
export const NX_LBM = 24;
export const NY_LBM = 8;
export const NZ_LBM = 8;
export const N_LBM = NX_LBM * NY_LBM * NZ_LBM;
const LBM_Q = 19;
const LBM_EX = new Int8Array([0,  1, -1,  0,  0,  0,  0,  1, -1,  1, -1,  1, -1,  1, -1,  0,  0,  0,  0]);
const LBM_EY = new Int8Array([0,  0,  0,  1, -1,  0,  0,  1, -1, -1,  1,  0,  0,  0,  0,  1, -1,  1, -1]);
const LBM_EZ = new Int8Array([0,  0,  0,  0,  0,  1, -1,  0,  0,  0,  0,  1, -1, -1,  1,  1, -1, -1,  1]);
const LBM_OPP = new Uint8Array([0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17]);
const LBM_W = new Float32Array([
  1 / 3,
  1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18, 1 / 18,
  1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36, 1 / 36,
]);

const HASH_N = 2048; // power-of-two spatial hash table for exact r < hSPH WCSPH neighbor lookup
const CBRT_HALF = Math.pow(0.5, 1 / 3); // Murray's-Law symmetric daughter ratio 2^(-1/3) so r1^3 + r2^3 = r0^3

export class Hemodynamics {
  constructor(seed = 1) {
    const r = mulberry(seed * 4099 + 29);
    this.r = r;
    // Nodal pressures (mmHg-scaled physiological units; resting mean ~78-85 arterial, ~7-9 venous)
    this.P = new Float64Array(N_NODES);
    this.Pext = new Float64Array(N_NODES); // external FEM + Biot interstitial tissue pressure
    this.comp = new Float64Array(N_NODES); // vessel compliance C_i
    this.o2Node = new Float64Array(N_NODES).fill(0.94);
    this.nodePos = new Float64Array(N_NODES * 3);

    for (let s = 0; s < NS; s++) {
      this.P[s] = 82 - Math.abs(s - 4) * 1.5;     // Dorsal aorta
      this.comp[s] = 0.045;
      this.P[7 + s] = 7 + Math.abs(s - 4) * 0.4;  // Vena cava
      this.comp[7 + s] = 0.38;                    // Veins are ~8x more compliant than arteries
      this.P[16 + s] = 46 - Math.abs(s - 4) * 1.0;// Left segmental Murray arterioles
      this.comp[16 + s] = 0.085;
      this.P[23 + s] = 46 - Math.abs(s - 4) * 1.0;// Right segmental Murray arterioles
      this.comp[23 + s] = 0.085;
    }
    this.P[14] = 68; this.comp[14] = 0.06;        // Cerebral Circle of Willis
    this.P[15] = 24; this.comp[15] = 0.18;        // Hepatic-portal splanchnic bed
    this.P[30] = 79; this.comp[30] = 0.07;        // Left branchial gill arch
    this.P[31] = 79; this.comp[31] = 0.07;        // Right branchial gill arch
    this.P[32] = 52; this.comp[32] = 0.08;        // Coronary myocardial bed
    this.P[33] = 44; this.comp[33] = 0.11;        // Left renal-nephridial glomerulus
    this.P[34] = 44; this.comp[34] = 0.11;        // Right renal-nephridial glomerulus
    this.P[35] = 16; this.comp[35] = 0.24;        // Caudal tail venous sinus

    // Build closed-loop 64-vessel directed 3D vascular tree obeying Murray's cube law (r0^3 = r1^3 + r2^3) at bifurcations
    const E = [];
    this.murrayJunctions = [];
    const addV = (u, v, rad, len, valve = 0) => {
      const idx = E.length;
      E.push({ u, v, rad, len, area0: Math.PI * rad * rad, valve });
      return idx;
    };
    const addMurraySplit = (u, v1, v2, rParent, len1, len2, alpha = 0.5) => {
      const r1 = rParent * Math.pow(alpha, 1 / 3);
      const r2 = rParent * Math.pow(1 - alpha, 1 / 3);
      const i1 = addV(u, v1, r1, len1, 0);
      const i2 = addV(u, v2, r2, len2, 0);
      this.murrayJunctions.push({ rParent, i1, i2 });
    };

    // 1) Axial dorsal aorta trunk (6 vessels: heart at seg 4 pumps rostrally 4->5->6 and caudally 4->3->2->1->0)
    addV(4, 5, 0.052, 0.40, 1); addV(5, 6, 0.046, 0.40, 0);
    addV(4, 3, 0.054, 0.40, 1); addV(3, 2, 0.048, 0.40, 0); addV(2, 1, 0.042, 0.40, 0); addV(1, 0, 0.036, 0.40, 0);

    // 2) Segmental Murray-Law bifurcating arteriolar-capillary trees (28 vessels across s = 0..6)
    for (let s = 0; s < NS; s++) {
      const rFeeder = s === 1 || s === 3 || s === 5 ? 0.024 : 0.019;
      addMurraySplit(s, 16 + s, 23 + s, rFeeder, 0.20, 0.20, 0.5);
      const rVen = rFeeder * CBRT_HALF * 1.12;
      addV(16 + s, 7 + s, rVen, 0.22, 0);
      addV(23 + s, 7 + s, rVen, 0.22, 0);
    }

    // 3) Limb-girdle longitudinal collateral anastomotic arcades (4 vessels)
    addV(17, 18, 0.012, 0.36, 0); addV(24, 25, 0.012, 0.36, 0);
    addV(19, 20, 0.012, 0.36, 0); addV(26, 27, 0.012, 0.36, 0);

    // 4) Cerebral Circle of Willis & bilateral internal carotid loop (4 vessels)
    addV(6, 14, 0.024, 0.34, 0);
    addV(22, 14, 0.015, 0.28, 0);
    addV(29, 14, 0.015, 0.28, 0);
    this.cerebralEdgeIdx = addV(14, 13, 0.032, 0.35, 0);

    // 5) Splanchnic / gut-liver hepatic-portal loop (3 vessels)
    addV(3, 15, 0.028, 0.36, 0); addV(2, 15, 0.023, 0.38, 0); addV(15, 10, 0.035, 0.34, 1);

    // 6) Bilateral Branchial Gill-Arch Respiratory Plexus (4 vessels, Murray split from cardiac bulbus 4 -> 30,31 -> 5)
    addMurraySplit(4, 30, 31, 0.034, 0.26, 0.26, 0.5);
    addV(30, 5, 0.027, 0.26, 0); addV(31, 5, 0.027, 0.26, 0);

    // 7) Coronary myocardial loop (2 vessels: 4 -> 32 -> 11)
    addV(4, 32, 0.018, 0.22, 0); addV(32, 11, 0.021, 0.24, 1);

    // 8) Bilateral Renal-Nephridial Glomerular Filtration Beds (4 vessels, Murray split 2 -> 33,34 -> 9)
    addMurraySplit(2, 33, 34, 0.024, 0.25, 0.25, 0.5);
    addV(33, 9, 0.020, 0.25, 0); addV(34, 9, 0.020, 0.25, 0);

    // 9) Caudal tail venous sinus loop (2 vessels: 0 -> 35 -> 7)
    addV(0, 35, 0.018, 0.28, 0); addV(35, 7, 0.022, 0.28, 1);

    // 10) Venous return with one-way bicuspid valves toward right atrium (6 vessels -> vena 11 = seg 4)
    addV(7, 8, 0.048, 0.40, 1); addV(8, 9, 0.052, 0.40, 1); addV(9, 10, 0.056, 0.40, 1); addV(10, 11, 0.062, 0.40, 1);
    addV(13, 12, 0.050, 0.40, 1); addV(12, 11, 0.058, 0.40, 1);

    // 11) Cardiac atrioventricular + conus arteriosus pump (1 vessel, index 63 = nE - 1: vena 11 -> aorta 4)
    addV(11, 4, 0.065, 0.28, 1);

    this.edges = E;
    this.nE = E.length;
    this.nVessels = E.length; // 64 vessels
    this.nParcels = N_PARCELS; // 1,024 3D WCSPH blood cells
    this.nCapVoxels = N_CAP;   // 63 3D poroelastic capillary voxels
    this.nLbmCells = N_LBM;    // 1,536 3D D3Q19 LBM cells (29,184 populations)
    let murrayErr = 0;
    for (const mj of this.murrayJunctions) {
      const r03 = mj.rParent ** 3;
      const rSum3 = E[mj.i1].rad ** 3 + E[mj.i2].rad ** 3;
      murrayErr += Math.abs(r03 - rSum3) / Math.max(1e-12, r03);
    }
    this.murrayRestResidual = murrayErr / Math.max(1, this.murrayJunctions.length);
    this.murrayLiveDeviation = 0;

    this.Q = new Float64Array(this.nE);
    this.area = Float64Array.from(E, (e) => e.area0);
    this.vel = new Float64Array(this.nE);

    this.outEdges = Array.from({ length: N_NODES }, () => []);
    E.forEach((e, idx) => this.outEdges[e.u].push(idx));

    // 63-voxel 3D Biot-Darcy poroelastic capillary-interstitial continuum (mmHg pore pressure & tissue O2)
    this.capP = new Float32Array(N_CAP).fill(2.5);
    this.capNext = new Float32Array(N_CAP).fill(2.5);
    this.capO2 = new Float32Array(N_CAP).fill(0.92);
    this.prevSegJ = new Float64Array(NS).fill(1.0);
    this.darcyFlux = 0;
    this.meanCapP = 2.5;
    this.fsiForceMag = 0;

    // 3D D3Q19 Lattice-Boltzmann (24x8x8 = 1,536 voxels x 19 = 29,184 populations) microvascular Navier-Stokes solver
    this.lbmF = new Float32Array(N_LBM * LBM_Q);
    this.lbmFNext = new Float32Array(N_LBM * LBM_Q);
    this.lbmRho = new Float32Array(N_LBM).fill(1.0);
    this.lbmUx = new Float32Array(N_LBM);
    this.lbmUy = new Float32Array(N_LBM);
    this.lbmUz = new Float32Array(N_LBM);
    this.lbmWall = new Uint8Array(N_LBM);
    for (let ix = 0; ix < NX_LBM; ix++) {
      for (let iy = 0; iy < NY_LBM; iy++) {
        for (let iz = 0; iz < NZ_LBM; iz++) {
          const c = (ix * NY_LBM + iy) * NZ_LBM + iz;
          // Cylindrical-lumen corner mask: outer edge corners act as no-slip bounce-back endothelial walls
          const ry = iy - 3.5, rz = iz - 3.5;
          if (ry * ry + rz * rz > 16.5) this.lbmWall[c] = 1;
          for (let q = 0; q < LBM_Q; q++) this.lbmF[c * LBM_Q + q] = LBM_W[q];
        }
      }
    }
    // Precompute exact 3D D3Q19 streaming + endothelial bounce-back destination table (29,184 indices -> zero branch/modulo in inner loop!)
    this._lbmStreamDst = new Int32Array(N_LBM * LBM_Q);
    for (let ix = 0; ix < NX_LBM; ix++) {
      for (let iy = 0; iy < NY_LBM; iy++) {
        for (let iz = 0; iz < NZ_LBM; iz++) {
          const c = (ix * NY_LBM + iy) * NZ_LBM + iz;
          const off = c * LBM_Q;
          for (let q = 0; q < LBM_Q; q++) {
            if (this.lbmWall[c]) {
              this._lbmStreamDst[off + q] = off + (q === 0 ? 0 : LBM_OPP[q]);
              continue;
            }
            const nx = (ix + LBM_EX[q] + NX_LBM) % NX_LBM;
            const ny = iy + LBM_EY[q], nz = iz + LBM_EZ[q];
            if (ny < 0 || ny >= NY_LBM || nz < 0 || nz >= NZ_LBM) {
              this._lbmStreamDst[off + q] = off + LBM_OPP[q];
            } else {
              const nc = (nx * NY_LBM + ny) * NZ_LBM + nz;
              this._lbmStreamDst[off + q] = this.lbmWall[nc] ? (off + LBM_OPP[q]) : (nc * LBM_Q + q);
            }
          }
        }
      }
    }
    this._lbmTick = 0;
    this.lbmVorticity = 0;
    this.lbmMaxSpeed = 0;

    // 1,024 3D WCSPH discrete blood cells: 896 O2-carrying Erythrocytes (pType=0) + 128 Chemotactic Leukocytes (pType=1)
    this.px = new Float32Array(N_PARCELS);
    this.py = new Float32Array(N_PARCELS);
    this.pz = new Float32Array(N_PARCELS);
    this.vx = new Float32Array(N_PARCELS);
    this.vy = new Float32Array(N_PARCELS);
    this.vz = new Float32Array(N_PARCELS);
    this.pRho = new Float32Array(N_PARCELS).fill(1);
    this.pPres = new Float32Array(N_PARCELS);
    this.pO2 = new Float32Array(N_PARCELS).fill(0.95);
    this.pGlc = new Float32Array(N_PARCELS).fill(1.0);
    this.pType = new Uint8Array(N_PARCELS);         // 0 = Erythrocyte (RBC), 1 = Chemotactic Leukocyte (WBC)
    this.pActivation = new Float32Array(N_PARCELS); // Leukocyte integrin/selectin endothelial margination state [0..1]
    this.nErythrocytes = N_ERYTHROCYTES;
    this.nLeukocytes = N_LEUKOCYTES;
    this.immuneMargination = 0;
    this.pEdge = new Uint8Array(N_PARCELS);
    this.pS = new Float32Array(N_PARCELS);
    this.pRadOff = new Float32Array(N_PARCELS * 2);
    this._hHead = new Int16Array(HASH_N);
    this._hNext = new Int16Array(N_PARCELS);
    for (let i = 0; i < N_PARCELS; i++) {
      this.pType[i] = i >= N_ERYTHROCYTES ? 1 : 0;
      this.pEdge[i] = i % this.nE;
      this.pS[i] = r();
      const ang = r() * Math.PI * 2, rad = 0.02 + 0.05 * Math.sqrt(r());
      this.pRadOff[2 * i] = rad * Math.cos(ang);
      this.pRadOff[2 * i + 1] = rad * Math.sin(ang);
      const uNode = this.edges[this.pEdge[i]].u;
      this.pO2[i] = (uNode < 7 || (uNode >= 16 && uNode < 32)) ? 0.96 : 0.72;
    }

    this.heartPhase = 0;
    this.cardiacOutput = 1.0;
    this.mapPressure = 85;
    this.cerebralFlow = 1.0;
    this.baroDrive = 0;
    this.meanO2 = 0.94;
    this.segO2 = new Float64Array(NS).fill(0.94);
    this.reynoldsMax = 0;
    this.lesion = false;
    this.initedPos = false;
  }

  /** Map any of the 36 vascular nodes to its host axial segment [0..6] */
  nodeSeg(u) {
    if (u < 7) return u;
    if (u < 14) return u - 7;
    if (u === 14) return NS - 1;
    if (u === 15) return 3;
    if (u < 23) return u - 16;
    if (u < 30) return u - 23;
    if (u === 30 || u === 31) return 5;
    if (u === 32) return 4;
    if (u === 33 || u === 34) return 2;
    return 0;
  }

  /** Update 3D anatomical coordinates of all 36 vascular nodes from the live FEM body frames */
  updateNodeGeometry(body) {
    const X = body.x, Y = body.y, Z = body.z, F = body.F, NP = this.nodePos;
    for (let s = 0; s < NS; s++) {
      const c = body.c[s], fr = F[s];
      NP[3 * s] = X[c] + fr.u[0] * 0.04 - fr.s[0] * 0.02;
      NP[3 * s + 1] = Y[c] + fr.u[1] * 0.04 - fr.s[1] * 0.02;
      NP[3 * s + 2] = Z[c] + fr.u[2] * 0.04 - fr.s[2] * 0.02;
      const v = 7 + s;
      NP[3 * v] = X[c] - fr.u[0] * 0.04 + fr.s[0] * 0.025;
      NP[3 * v + 1] = Y[c] - fr.u[1] * 0.04 + fr.s[1] * 0.025;
      NP[3 * v + 2] = Z[c] - fr.u[2] * 0.04 + fr.s[2] * 0.025;
      const lArt = 16 + s;
      NP[3 * lArt] = X[c] + fr.u[0] * 0.015 - fr.s[0] * 0.11;
      NP[3 * lArt + 1] = Y[c] + fr.u[1] * 0.015 - fr.s[1] * 0.11;
      NP[3 * lArt + 2] = Z[c] + fr.u[2] * 0.015 - fr.s[2] * 0.11;
      const rArt = 23 + s;
      NP[3 * rArt] = X[c] + fr.u[0] * 0.015 + fr.s[0] * 0.11;
      NP[3 * rArt + 1] = Y[c] + fr.u[1] * 0.015 + fr.s[1] * 0.11;
      NP[3 * rArt + 2] = Z[c] + fr.u[2] * 0.015 + fr.s[2] * 0.11;
    }
    const hc = body.c[NS - 1], hf = F[NS - 1];
    NP[42] = X[hc] + hf.f[0] * 0.16 + hf.u[0] * 0.07;
    NP[43] = Y[hc] + hf.f[1] * 0.16 + hf.u[1] * 0.07;
    NP[44] = Z[hc] + hf.f[2] * 0.16 + hf.u[2] * 0.07;
    const lc = body.c[3], lf = F[3];
    NP[45] = X[lc] - lf.u[0] * 0.03 + lf.s[0] * 0.06;
    NP[46] = Y[lc] - lf.u[1] * 0.03 + lf.s[1] * 0.06;
    NP[47] = Z[lc] - lf.u[2] * 0.03 + lf.s[2] * 0.06;
    // Branchial gill arches (30, 31 at seg 5), coronary (32 at seg 4), renal (33, 34 at seg 2), caudal sinus (35 at seg 0)
    const gc = body.c[5], gf = F[5];
    NP[90] = X[gc] + gf.u[0] * 0.05 - gf.s[0] * 0.18;
    NP[91] = Y[gc] + gf.u[1] * 0.05 - gf.s[1] * 0.18;
    NP[92] = Z[gc] + gf.u[2] * 0.05 - gf.s[2] * 0.18;
    NP[93] = X[gc] + gf.u[0] * 0.05 + gf.s[0] * 0.18;
    NP[94] = Y[gc] + gf.u[1] * 0.05 + gf.s[1] * 0.18;
    NP[95] = Z[gc] + gf.u[2] * 0.05 + gf.s[2] * 0.18;
    const cc = body.c[4], cf = F[4];
    NP[96] = X[cc] - cf.u[0] * 0.025;
    NP[97] = Y[cc] - cf.u[1] * 0.025;
    NP[98] = Z[cc] - cf.u[2] * 0.025;
    const rc = body.c[2], rf = F[2];
    NP[99] = X[rc] - rf.u[0] * 0.02 - rf.s[0] * 0.09;
    NP[100] = Y[rc] - rf.u[1] * 0.02 - rf.s[1] * 0.09;
    NP[101] = Z[rc] - rf.u[2] * 0.02 - rf.s[2] * 0.09;
    NP[102] = X[rc] - rf.u[0] * 0.02 + rf.s[0] * 0.09;
    NP[103] = Y[rc] - rf.u[1] * 0.02 + rf.s[1] * 0.09;
    NP[104] = Z[rc] - rf.u[2] * 0.02 + rf.s[2] * 0.09;
    const tc = body.c[0], tf = F[0];
    NP[105] = X[tc] - tf.f[0] * 0.16;
    NP[106] = Y[tc] - tf.f[1] * 0.16;
    NP[107] = Z[tc] - tf.f[2] * 0.16;

    if (!this.initedPos) {
      this.initedPos = true;
      for (let i = 0; i < N_PARCELS; i++) {
        const e = this.edges[this.pEdge[i]], s = this.pS[i];
        const u3 = 3 * e.u, v3 = 3 * e.v;
        this.px[i] = NP[u3] + (NP[v3] - NP[u3]) * s;
        this.py[i] = NP[u3 + 1] + (NP[v3 + 1] - NP[u3 + 1]) * s;
        this.pz[i] = NP[u3 + 2] + (NP[v3 + 2] - NP[u3 + 2]) * s;
      }
    }
  }

  /**
   * Solve 3D Biot-Darcy poroelastic capillary filtration & write two-way hydrostatic turgor forces onto FEM body!
   */
  stepBiotCapillaryFSI(dt, body, mu) {
    const capP = this.capP, capNext = this.capNext, capO2 = this.capO2, P = this.P;
    const perm = 0.085 / Math.max(0.015, mu); // Darcy hydraulic conductivity kappa / mu
    const oncotic = 24.5;                     // Plasma colloid oncotic pressure (Starling sigma * Pi_c)
    const alphaBiot = 22.0;                   // Biot poroelastic coupling modulus (mmHg per unit volumetric compression)
    let fluxAcc = 0, pSum = 0;

    for (let s = 0; s < NX_CAP; s++) {
      const curJ = body.segJ ? body.segJ[s] : 1.0;
      const dJdt = clamp((curJ - this.prevSegJ[s]) / Math.max(1e-4, dt), -6, 6);
      this.prevSegJ[s] = curJ;
      const biotSource = -alphaBiot * dJdt; // compression (dJ/dt < 0) raises pore pressure!
      const muscSink = 0.014 + 0.042 * Math.abs(body.u[24 + s] || 0);

      for (let iy = 0; iy < NY_CAP; iy++) {
        const pVasc = iy === 2
          ? 0.52 * P[s] + (s === 6 ? 0.15 * P[14] : 0)
          : iy === 0
            ? P[7 + s] * 1.35 + ((s === 2 || s === 3) ? 0.22 * P[15] : 0)
            : 0.30 * P[s] + 0.70 * P[7 + s];
        const o2Src = iy === 2 ? this.o2Node[s] : iy === 0 ? this.o2Node[7 + s] : 0.5 * (this.o2Node[s] + this.o2Node[7 + s]);

        for (let iz = 0; iz < NZ_CAP; iz++) {
          const idx = (s * NY_CAP + iy) * NZ_CAP + iz;
          const pc = capP[idx];
          // 6-neighbor 3D Darcy Laplacian div((kappa/mu) grad(p_cap))
          let lap = 0;
          if (s > 0) { const d = capP[((s - 1) * NY_CAP + iy) * NZ_CAP + iz] - pc; lap += d; fluxAcc += Math.abs(d); }
          if (s + 1 < NX_CAP) { const d = capP[((s + 1) * NY_CAP + iy) * NZ_CAP + iz] - pc; lap += d; fluxAcc += Math.abs(d); }
          if (iy > 0) { const d = capP[(s * NY_CAP + (iy - 1)) * NZ_CAP + iz] - pc; lap += d * 1.6; fluxAcc += Math.abs(d); }
          if (iy + 1 < NY_CAP) { const d = capP[(s * NY_CAP + (iy + 1)) * NZ_CAP + iz] - pc; lap += d * 1.6; }
          if (iz > 0) { const d = capP[(s * NY_CAP + iy) * NZ_CAP + (iz - 1)] - pc; lap += d * 1.6; }
          if (iz + 1 < NZ_CAP) { const d = capP[(s * NY_CAP + iy) * NZ_CAP + (iz + 1)] - pc; lap += d * 1.6; }

          // Starling transcapillary filtration + lymphatic drainage + Biot volumetric compression
          const starling = 0.85 * (pVasc - pc - oncotic * 0.72);
          const lymph = pc > 2.2 ? -0.55 * (pc - 2.2) : 0;
          const pn = clamp(pc + dt * (perm * lap + starling + lymph + biotSource), -4.0, 42.0);
          capNext[idx] = pn;
          pSum += pn;
          capO2[idx] = clamp(capO2[idx] + dt * (2.4 * (o2Src - capO2[idx]) - muscSink), 0.18, 0.99);
        }
      }
    }
    capP.set(capNext);
    this.meanCapP = pSum / N_CAP;
    this.darcyFlux = perm * (fluxAcc / N_CAP);

    // Two-Way FSI: apply 3D interstitial pore-pressure turgor + pulsatile arterial recoil forces onto FEM soft-body mesh!
    if (body.fsiFx && !this.lesion && !globalThis.TW?.noFSI) {
      const fx = body.fsiFx, fy = body.fsiFy, fz = body.fsiFz;
      fx.fill(0); fy.fill(0); fz.fill(0);
      // Calibrated physical Biot turgor gain (subtle hydro-skeleton support without overpowering limb stride)
      const kTurgor = 0.0022;
      let fMagSq = 0;
      for (let s = 0; s < NS; s++) {
        const fr = body.F[s], rg = body.ring[s];
        const pDor = capP[(s * NY_CAP + 2) * NZ_CAP + 1] - 2.5;
        const pVen = capP[(s * NY_CAP + 0) * NZ_CAP + 1] - 2.5;
        const pR = capP[(s * NY_CAP + 1) * NZ_CAP + 2] - 2.5;
        const pL = capP[(s * NY_CAP + 1) * NZ_CAP + 0] - 2.5;
        const pulse = Math.max(0, (P[s] - 76) * 0.06);
        const lbmIx = Math.min(NX_LBM - 1, Math.round((s / (NS - 1)) * (NX_LBM - 1)));
        const lbmDynDor = (this.lbmRho[(lbmIx * NY_LBM + 6) * NZ_LBM + 4] - 1.0) * 18.0;
        const lbmDynVen = (this.lbmRho[(lbmIx * NY_LBM + 1) * NZ_LBM + 4] - 1.0) * 18.0;
        const lbmDynR = (this.lbmRho[(lbmIx * NY_LBM + 4) * NZ_LBM + 6] - 1.0) * 18.0;
        const lbmDynL = (this.lbmRho[(lbmIx * NY_LBM + 4) * NZ_LBM + 1] - 1.0) * 18.0;

        const fUp = clamp((pDor + pulse + lbmDynDor) * kTurgor, -0.04, 0.06);
        const fDn = clamp((pVen + lbmDynVen) * kTurgor, -0.04, 0.06);
        const fRt = clamp((pR + lbmDynR) * kTurgor, -0.04, 0.06);
        const fLt = clamp((pL + lbmDynL) * kTurgor, -0.04, 0.06);

        // Cardinal ring nodes: [up, right, down, left]
        const iU = rg[0], iR = rg[1], iD = rg[2], iL = rg[3];
        fx[iU] += fr.u[0] * fUp; fy[iU] += fr.u[1] * fUp; fz[iU] += fr.u[2] * fUp;
        fx[iD] -= fr.u[0] * fDn; fy[iD] -= fr.u[1] * fDn; fz[iD] -= fr.u[2] * fDn;
        fx[iR] += fr.s[0] * fRt; fy[iR] += fr.s[1] * fRt; fz[iR] += fr.s[2] * fRt;
        fx[iL] -= fr.s[0] * fLt; fy[iL] -= fr.s[1] * fLt; fz[iL] -= fr.s[2] * fLt;

        // Octagonal dermal scute nodes receive 45-deg interpolated Biot turgor
        if (body.ringDiag) {
          const dg = body.ringDiag[s], inv = 0.5 * Math.SQRT1_2;
          const pairs = [
            [dg[0], fUp + fRt, 1, 1],
            [dg[1], fDn + fRt, -1, 1],
            [dg[2], fDn + fLt, -1, -1],
            [dg[3], fUp + fLt, 1, -1],
          ];
          for (let q = 0; q < 4; q++) {
            const nd = pairs[q][0], amp = pairs[q][1] * inv, su = pairs[q][2], ss = pairs[q][3];
            fx[nd] += (fr.u[0] * su + fr.s[0] * ss) * amp;
            fy[nd] += (fr.u[1] * su + fr.s[1] * ss) * amp;
            fz[nd] += (fr.u[2] * su + fr.s[2] * ss) * amp;
          }
        }
        fMagSq += fUp * fUp + fDn * fDn + fRt * fRt + fLt * fLt;
      }
      this.fsiForceMag = Math.sqrt(fMagSq);
      body.fsiForceMag = this.fsiForceMag;
    }
  }

  /**
   * 3D D3Q19 Lattice-Boltzmann (24x8x8 = 1,536 cells = 29,184 populations) Microvascular Sinus Navier-Stokes Solver:
   *  - BGK collision f_q <- f_q - omega * (f_q - f_q^eq(rho, u)) + Guo body-force S_q
   *  - Driven by pulsatile systolic heart jet (ix = 14,15) + segmental FEM wall pumping + orthostatic gravity
   *  - Exact endothelial bounce-back no-slip boundary on outer corner walls + periodic closed vascular loop
   */
  stepLatticeBoltzmann3D(body, mu, systole, gx, gy, gz) {
    const f = this.lbmF, fn = this.lbmFNext, wall = this.lbmWall;
    const rhoA = this.lbmRho, uxA = this.lbmUx, uyA = this.lbmUy, uzA = this.lbmUz;
    // Kinematic blood viscosity nu_LB = (tau - 0.5) / 3 -> omega = 1 / tau
    const tau = clamp(0.58 + 3.0 * mu, 0.56, 1.35);
    const omega = 1 / tau;
    const forceCoeff = 1 - 0.5 * omega;
    const sysJet = this.lesion ? 0.002 : (0.012 + 0.058 * systole);
    const gScale = 0.00035;

    let maxSpd = 0;
    // Pass 1: Macroscopic moments + BGK collision + Guo body forcing + 3D D3Q19 streaming
    for (let ix = 0; ix < NX_LBM; ix++) {
      const seg = Math.min(NS - 1, Math.floor((ix / NX_LBM) * NS));
      const femSqueeze = body.segPressure ? body.segPressure[seg] * 0.006 : 0;
      const isHeart = ix === 14 || ix === 15;
      for (let iy = 0; iy < NY_LBM; iy++) {
        const yWallSqueeze = (3.5 - iy) * femSqueeze * 0.30;
        for (let iz = 0; iz < NZ_LBM; iz++) {
          const c = (ix * NY_LBM + iy) * NZ_LBM + iz;
          const off = c * LBM_Q;
          if (wall[c]) {
            rhoA[c] = 1.0;
            uxA[c] = uyA[c] = uzA[c] = 0;
            // Bounce-back at endothelial wall nodes
            fn[off] = f[off];
            for (let q = 1; q < LBM_Q; q++) fn[off + LBM_OPP[q]] = f[off + q];
            continue;
          }

          let rho = 0, mx = 0, my = 0, mz = 0;
          for (let q = 0; q < LBM_Q; q++) {
            const fq = f[off + q];
            rho += fq;
            mx += fq * LBM_EX[q];
            my += fq * LBM_EY[q];
            mz += fq * LBM_EZ[q];
          }
          rho = clamp(rho, 0.82, 1.22);
          // Pulsatile aortic jet along dorsal core + venous return along ventral lumen + helical secondary swirl
          const swirl = isHeart ? 0.004 * systole : 0.0012;
          const Fx = (iy >= 4 ? sysJet * (isHeart ? 1.45 : 0.32) : -sysJet * 0.28) + gx * gScale;
          const Fy = yWallSqueeze - swirl * (iz - 3.5) + gy * gScale;
          const Fz = (3.5 - iz) * femSqueeze * 0.30 + swirl * (iy - 3.5) + gz * gScale;

          let ux = clamp((mx + 0.5 * Fx) / rho, -0.18, 0.18);
          let uy = clamp((my + 0.5 * Fy) / rho, -0.14, 0.14);
          let uz = clamp((mz + 0.5 * Fz) / rho, -0.14, 0.14);
          const u2 = ux * ux + uy * uy + uz * uz;
          const spd = Math.sqrt(u2);
          if (spd > maxSpd) maxSpd = spd;

          rhoA[c] = rho;
          uxA[c] = ux;
          uyA[c] = uy;
          uzA[c] = uz;

          const dst = this._lbmStreamDst;
          for (let q = 0; q < LBM_Q; q++) {
            const ex = LBM_EX[q], ey = LBM_EY[q], ez = LBM_EZ[q], wq = LBM_W[q];
            const eu = ex * ux + ey * uy + ez * uz;
            const feq = wq * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * u2);
            const forceTerm = forceCoeff * wq * (
              3 * ((ex - ux) * Fx + (ey - uy) * Fy + (ez - uz) * Fz) +
              9 * eu * (ex * Fx + ey * Fy + ez * Fz)
            );
            fn[dst[off + q]] = Math.max(1e-5, f[off + q] - omega * (f[off + q] - feq) + forceTerm);
          }
        }
      }
    }
    f.set(fn);
    this.lbmMaxSpeed = maxSpd;

    // Pass 2: Central-difference 3D vorticity |curl u| across interior vascular lumen
    let vortSq = 0, vortCnt = 0;
    for (let ix = 0; ix < NX_LBM; ix++) {
      const ixP = (ix + 1) % NX_LBM, ixM = (ix + NX_LBM - 1) % NX_LBM;
      for (let iy = 1; iy < NY_LBM - 1; iy++) {
        for (let iz = 1; iz < NZ_LBM - 1; iz++) {
          const c = (ix * NY_LBM + iy) * NZ_LBM + iz;
          if (wall[c]) continue;
          const dw_dy = 0.5 * (uzA[(ix * NY_LBM + (iy + 1)) * NZ_LBM + iz] - uzA[(ix * NY_LBM + (iy - 1)) * NZ_LBM + iz]);
          const dv_dz = 0.5 * (uyA[(ix * NY_LBM + iy) * NZ_LBM + (iz + 1)] - uyA[(ix * NY_LBM + iy) * NZ_LBM + (iz - 1)]);
          const du_dz = 0.5 * (uxA[(ix * NY_LBM + iy) * NZ_LBM + (iz + 1)] - uxA[(ix * NY_LBM + iy) * NZ_LBM + (iz - 1)]);
          const dw_dx = 0.5 * (uzA[(ixP * NY_LBM + iy) * NZ_LBM + iz] - uzA[(ixM * NY_LBM + iy) * NZ_LBM + iz]);
          const dv_dx = 0.5 * (uyA[(ixP * NY_LBM + iy) * NZ_LBM + iz] - uyA[(ixM * NY_LBM + iy) * NZ_LBM + iz]);
          const du_dy = 0.5 * (uxA[(ix * NY_LBM + (iy + 1)) * NZ_LBM + iz] - uxA[(ix * NY_LBM + (iy - 1)) * NZ_LBM + iz]);
          const ox = dw_dy - dv_dz, oy = du_dz - dw_dx, oz = dv_dx - du_dy;
          vortSq += ox * ox + oy * oy + oz * oz;
          vortCnt++;
        }
      }
    }
    this.lbmVorticity = vortCnt > 0 ? Math.sqrt(vortSq / vortCnt) : 0;
  }

  /**
   * Advance coupled 1D Navier-Stokes vascular network + 3D D3Q19 LBM + 63-voxel 3D Biot-Darcy FSI + 512 WCSPH blood parcels.
   */
  step(dt, body, metab, world, spikes = 0) {
    this.updateNodeGeometry(body);
    const NP = this.nodePos, P = this.P, Q = this.Q, E = this.edges, nE = this.nE;

    // External FEM intramuscular + 3D Biot interstitial pore pressure compresses segmental veins (skeletal muscle pump!)
    for (let s = 0; s < NS; s++) {
      const femP = (body.segPressure ? body.segPressure[s] : 0) * 18;
      const capCore = Math.max(0, this.capP[(s * NY_CAP + 1) * NZ_CAP + 1] - 2.5) * 0.45;
      this.Pext[s] = 0.2 * femP + 0.15 * capCore;
      this.Pext[7 + s] = femP + capCore;
      this.Pext[16 + s] = 0.45 * femP + 0.35 * capCore;
      this.Pext[23 + s] = 0.45 * femP + 0.35 * capCore;
    }

    const gMag = world.g || 9.8;
    const gx = world.gx * gMag, gz = world.gz * gMag;
    const gy = -gMag * Math.sqrt(Math.max(0, 1 - world.gx * world.gx - world.gz * world.gz));

    const hr = clamp((metab.hr || 72) + 14 * this.baroDrive, 38, 195);
    this.heartPhase = (this.heartPhase + dt * (hr / 60)) % 1;
    const systole = this.heartPhase < 0.36 ? Math.sin((Math.PI * this.heartPhase) / 0.36) ** 2 : 0;
    const preload = clamp((P[11] + 2) / 9, 0.35, 1.8);
    const pumpHead = this.lesion ? 6.0 : (115 + 38 * (metab.symp || 0.3)) * systole * preload;

    const sub = 4, h = dt / sub;
    const rho = 1.06;
    const mu = 0.035 * (1 + 0.08 * clamp((metab.blood.glc - 3) / 4, -0.5, 2));
    const pumpIdx = nE - 1;

    let maxRe = 0;
    for (let st = 0; st < sub; st++) {
      for (let idx = 0; idx < nE; idx++) {
        const e = E[idx];
        const u3 = 3 * e.u, v3 = 3 * e.v;
        const dx = NP[v3] - NP[u3], dy = NP[v3 + 1] - NP[u3 + 1], dz = NP[v3 + 2] - NP[u3 + 2];
        const len = Math.max(0.12, Math.hypot(dx, dy, dz));
        const gAxial = (gx * dx + gy * dy + gz * dz) / len;

        const pMid = 0.5 * (P[e.u] + P[e.v]) - 0.5 * (this.Pext[e.u] + this.Pext[e.v]);
        const area = clamp(e.area0 * (1 + 0.003 * (pMid - 25)), e.area0 * 0.35, e.area0 * 1.85);
        this.area[idx] = area;

        const dP = (P[e.u] - P[e.v]) + (idx === pumpIdx ? pumpHead : 0);
        const q = Q[idx];
        const uVel = q / area;
        const conv = -0.15 * (q * Math.abs(uVel)) / len;
        const presTerm = (area / (rho * len)) * dP * 18.0;
        const viscDrag = ((8 * Math.PI * mu) / (rho * area)) * q * 0.045;
        const gravTerm = area * gAxial * 1.35;

        let qNext = q + h * (conv + presTerm - viscDrag + gravTerm);
        if (e.valve && qNext < 0) qNext *= 0.02;
        qNext = clamp(qNext, -0.8, 1.6);
        Q[idx] = qNext;
        this.vel[idx] = qNext / area;

        const re = (rho * Math.abs(this.vel[idx]) * (2 * Math.sqrt(area / Math.PI))) / Math.max(1e-4, mu);
        if (re > maxRe) maxRe = re;
      }

      for (let idx = 0; idx < nE; idx++) {
        const e = E[idx], dq = h * Q[idx];
        P[e.u] -= dq / this.comp[e.u];
        P[e.v] += dq / this.comp[e.v];
      }
      for (let i = 0; i < N_NODES; i++) {
        const pTarget = (i < 7 || i === 30 || i === 31) ? 20 : (i >= 16 && i < 30) ? 14 : 5;
        if (P[i] < 1) P[i] += 0.25 * (1 - P[i]);
        P[i] = clamp(P[i] + 0.002 * h * (pTarget - P[i] + this.Pext[i]), 0.5, 220);
      }
    }
    this.reynoldsMax = maxRe;
    this.mapPressure = 0.92 * this.mapPressure + 0.08 * ((P[4] + P[5] + P[3]) / 3);
    this.cardiacOutput = 0.90 * this.cardiacOutput + 0.10 * Math.max(0, Q[pumpIdx] * 60);
    this.cerebralFlow = 0.90 * this.cerebralFlow + 0.10 * Math.max(0, Q[this.cerebralEdgeIdx] * 120);
    this.baroDrive = clamp((72 - 0.5 * (P[6] + P[14])) / 35, -0.8, 1.0);

    // Live pulsatile Murray's-Law deviation across dynamically distended arteriole bifurcations
    let liveMur = 0;
    for (let j = 0; j < this.murrayJunctions.length; j++) {
      const mj = this.murrayJunctions[j];
      const r1L = Math.sqrt(this.area[mj.i1] / Math.PI);
      const r2L = Math.sqrt(this.area[mj.i2] / Math.PI);
      const r03 = mj.rParent ** 3;
      liveMur += Math.abs(r03 - (r1L ** 3 + r2L ** 3)) / Math.max(1e-12, r03);
    }
    this.murrayLiveDeviation = liveMur / Math.max(1, this.murrayJunctions.length);

    // Nodal O2 transport + branchial gill-arch oxygenation + metabolic extraction
    const oxyRate = this.lesion ? 0.15 : 2.8;
    this.o2Node[4] = clamp(this.o2Node[4] + dt * oxyRate * (0.98 - this.o2Node[4]), 0.2, 0.99);
    this.o2Node[30] = clamp(this.o2Node[30] + dt * (oxyRate * 1.15) * (0.99 - this.o2Node[30]), 0.2, 0.995);
    this.o2Node[31] = clamp(this.o2Node[31] + dt * (oxyRate * 1.15) * (0.99 - this.o2Node[31]), 0.2, 0.995);
    for (let idx = 0; idx < nE; idx++) {
      const e = E[idx], q = Q[idx];
      if (q > 0) {
        const mix = clamp((q * dt * 18) / Math.max(0.02, this.comp[e.v]), 0, 0.65);
        this.o2Node[e.v] += mix * (this.o2Node[e.u] - this.o2Node[e.v]);
      }
    }
    let o2Sum = 0;
    for (let s = 0; s < NS; s++) {
      const muscDemand = 0.012 + 0.045 * Math.abs(body.u[24 + s] || 0);
      this.o2Node[7 + s] = clamp(this.o2Node[7 + s] - dt * muscDemand, 0.18, 0.98);
      this.segO2[s] = 0.5 * (this.o2Node[s] + this.o2Node[7 + s]);
      o2Sum += this.segO2[s];
    }
    const brainDemand = 0.018 + 0.0004 * spikes;
    this.o2Node[14] = clamp(this.o2Node[14] - dt * brainDemand, 0.18, 0.98);
    this.meanO2 = o2Sum / NS;

    // Solve 3D D3Q19 Lattice-Boltzmann microvascular Navier-Stokes (30 Hz) + 63-voxel 3D Biot-Darcy FSI turgor coupling
    if ((this._lbmTick = (this._lbmTick + 1) & 1) === 1) {
      this.stepLatticeBoltzmann3D(body, mu, systole, gx, gy, gz);
    }
    this.stepBiotCapillaryFSI(dt, body, mu);

    // 1,024-cell 3D WCSPH (896 Erythrocytes + 128 Leukocytes) with Tait EOS (gamma = 7) & O(N) microvascular spatial hash
    const px = this.px, py = this.py, pz = this.pz, vx = this.vx, vy = this.vy, vz = this.vz;
    const pRho = this.pRho, pPres = this.pPres;
    const hSPH = 0.045, h2 = hSPH * hSPH, invCell = 1 / hSPH;
    const head = this._hHead, next = this._hNext;
    head.fill(-1);
    for (let i = 0; i < N_PARCELS; i++) {
      pRho[i] = 1.0;
      const cx = Math.floor(px[i] * invCell), cy = Math.floor(py[i] * invCell), cz = Math.floor(pz[i] * invCell);
      const bk = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(cz, 83492791)) & (HASH_N - 1);
      next[i] = head[bk];
      head[bk] = i;
    }

    // Pass 1: WCSPH Poly6 density accumulation across 27 neighbor cells
    for (let i = 0; i < N_PARCELS; i++) {
      const xi = px[i], yi = py[i], zi = pz[i];
      const bx = Math.floor(xi * invCell), by = Math.floor(yi * invCell), bz = Math.floor(zi * invCell);
      let rhoI = 1.0;
      for (let ox = -1; ox <= 1; ox++) {
        const hx = Math.imul(bx + ox, 73856093);
        for (let oy = -1; oy <= 1; oy++) {
          const hxy = hx ^ Math.imul(by + oy, 19349663);
          for (let oz = -1; oz <= 1; oz++) {
            const bk = (hxy ^ Math.imul(bz + oz, 83492791)) & (HASH_N - 1);
            for (let j = head[bk]; j >= 0; j = next[j]) {
              if (j === i) continue;
              const dx = xi - px[j], dy = yi - py[j], dz = zi - pz[j];
              const r2 = dx * dx + dy * dy + dz * dz;
              if (r2 < h2) {
                const qk = 1 - r2 / h2;
                rhoI += 0.35 * qk * qk * qk;
              }
            }
          }
        }
      }
      pRho[i] = rhoI;
      // Tait Equation of State: P = B * ((rho / rho0)^7 - 1), clamped for CFL stability
      const ratio = Math.min(1.32, rhoI);
      const r2p = ratio * ratio, r4p = r2p * r2p;
      pPres[i] = 0.22 * (r4p * r2p * ratio - 1);
    }

    // Pass 2: Symmetric WCSPH Spiky pressure gradient + Morris laminar shear viscosity
    for (let i = 0; i < N_PARCELS; i++) {
      const xi = px[i], yi = py[i], zi = pz[i];
      const piOvRho2 = pPres[i] / (pRho[i] * pRho[i]);
      const bx = Math.floor(xi * invCell), by = Math.floor(yi * invCell), bz = Math.floor(zi * invCell);
      let ax = 0, ay = 0, az = 0;
      for (let ox = -1; ox <= 1; ox++) {
        const hx = Math.imul(bx + ox, 73856093);
        for (let oy = -1; oy <= 1; oy++) {
          const hxy = hx ^ Math.imul(by + oy, 19349663);
          for (let oz = -1; oz <= 1; oz++) {
            const bk = (hxy ^ Math.imul(bz + oz, 83492791)) & (HASH_N - 1);
            for (let j = head[bk]; j >= 0; j = next[j]) {
              if (j <= i) continue;
              const dx = xi - px[j], dy = yi - py[j], dz = zi - pz[j];
              const r2 = dx * dx + dy * dy + dz * dz;
              if (r2 >= h2 || r2 < 1e-9) continue;
              const rLen = Math.sqrt(r2), qk = 1 - rLen / hSPH;
              const fP = (piOvRho2 + pPres[j] / (pRho[j] * pRho[j])) * (qk * qk) / rLen;
              const visc = (1.8 * mu * qk) / (pRho[i] * pRho[j]);
              const ix = fP * dx + visc * (vx[j] - vx[i]);
              const iy = fP * dy + visc * (vy[j] - vy[i]);
              const iz = fP * dz + visc * (vz[j] - vz[i]);
              ax += ix; ay += iy; az += iz;
              vx[j] -= ix * dt; vy[j] -= iy * dt; vz[j] -= iz * dt;
            }
          }
        }
      }
      vx[i] += ax * dt; vy[i] += ay * dt; vz[i] += az * dt;
    }

    const glcNorm = clamp((metab.blood.glc || 3) / 3.5, 0.2, 1.8);
    let leukMarginAcc = 0;
    for (let i = 0; i < N_PARCELS; i++) {
      const isWBC = this.pType[i] === 1;
      let ei = this.pEdge[i];
      let e = E[ei];
      // Rolling selectin drag slows activated leukocytes near microvascular endothelium
      const wbcSlow = isWBC ? (1 - 0.35 * this.pActivation[i]) : 1.0;
      const ds = (this.vel[ei] * 0.22 * wbcSlow * dt) / Math.max(0.15, e.len);
      let s = this.pS[i] + ds;
      if (s >= 1) {
        s -= Math.floor(s);
        const outs = this.outEdges[e.v];
        if (outs.length === 1) ei = outs[0];
        else if (outs.length > 1) {
          let qTot = 0;
          for (const oe of outs) {
            const dstU = E[oe].v;
            const segDst = this.nodeSeg(dstU);
            const hypoxiaBias = isWBC && dstU >= 16 && dstU < 30
              ? 1 + 2.8 * Math.max(0, 0.92 - this.segO2[segDst])
              : 1.0;
            qTot += Math.max(0.001, Q[oe]) * hypoxiaBias;
          }
          let pick = this.r() * qTot;
          ei = outs[0];
          for (const oe of outs) {
            const dstU = E[oe].v;
            const segDst = this.nodeSeg(dstU);
            const hypoxiaBias = isWBC && dstU >= 16 && dstU < 30
              ? 1 + 2.8 * Math.max(0, 0.92 - this.segO2[segDst])
              : 1.0;
            pick -= Math.max(0.001, Q[oe]) * hypoxiaBias;
            if (pick <= 0) { ei = oe; break; }
          }
        }
        this.pEdge[i] = ei;
        e = E[ei];
      } else if (s < 0) {
        s = 0;
      }
      this.pS[i] = s;

      const u3 = 3 * e.u, v3 = 3 * e.v;
      const seg = this.nodeSeg(e.u);
      const fr = body.F[seg];
      let radScale = 0.88; // Fahraeus-Lindqvist axial core concentration for Erythrocytes
      if (isWBC) {
        const segHypox = clamp((0.92 - this.segO2[seg]) * 4.5, 0, 1);
        const segStrain = clamp((body.segPressure ? body.segPressure[seg] : 0) * 1.4, 0, 1);
        const actTarget = clamp(0.12 + 0.65 * segHypox + 0.45 * segStrain, 0, 1);
        this.pActivation[i] += (actTarget - this.pActivation[i]) * Math.min(1, dt * 3.0);
        radScale = 1.05 + 0.65 * this.pActivation[i]; // Leukocyte endothelial margination!
        leukMarginAcc += this.pActivation[i];
      }
      const r0 = this.pRadOff[2 * i] * radScale, r1 = this.pRadOff[2 * i + 1] * radScale;
      const cx = NP[u3] + (NP[v3] - NP[u3]) * s + fr.u[0] * r0 + fr.s[0] * r1;
      const cy = NP[u3 + 1] + (NP[v3 + 1] - NP[u3 + 1]) * s + fr.u[1] * r0 + fr.s[1] * r1;
      const cz = NP[u3 + 2] + (NP[v3 + 2] - NP[u3 + 2]) * s + fr.u[2] * r0 + fr.s[2] * r1;

      const lbmIx = Math.min(NX_LBM - 1, Math.floor((seg / NS) * NX_LBM));
      const isArt = e.u < 7 || (e.u >= 16 && e.u < 32);
      const lbmCell = (lbmIx * NY_LBM + (isArt ? 6 : 1)) * NZ_LBM + 4;
      const swirlY = this.lbmUy[lbmCell] * 0.9, swirlZ = this.lbmUz[lbmCell] * 0.9;
      vx[i] = vx[i] * 0.86 + (cx - px[i]) * 14 * dt + fr.f[0] * this.lbmUx[lbmCell] * 0.6 * dt;
      vy[i] = vy[i] * 0.86 + (cy - py[i]) * 14 * dt + (gy * 0.015 + fr.u[1] * swirlY + fr.s[1] * swirlZ) * dt;
      vz[i] = vz[i] * 0.86 + (cz - pz[i]) * 14 * dt + (fr.u[2] * swirlY + fr.s[2] * swirlZ) * dt;
      px[i] += vx[i] * dt + (cx - px[i]) * 0.35;
      py[i] += vy[i] * dt + (cy - py[i]) * 0.35;
      pz[i] += vz[i] * dt + (cz - pz[i]) * 0.35;

      const o2Target = (1 - s) * this.o2Node[e.u] + s * this.o2Node[e.v];
      this.pO2[i] += 0.15 * (o2Target - this.pO2[i]);
      if (e.u === 15 || e.v === 15) this.pGlc[i] += 0.2 * (glcNorm - this.pGlc[i]);
      else this.pGlc[i] += 0.04 * (glcNorm - this.pGlc[i]);
    }
    this.immuneMargination = leukMarginAcc / N_LEUKOCYTES;
  }
}
