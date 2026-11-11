// Coupled 1D incompressible Navier-Stokes vascular network + 63-voxel 3D Biot-Darcy poroelastic capillary continuum
// + two-way Fluid-Structure Interaction (FSI) + 256-parcel 3D WCSPH (Weakly Compressible SPH) hemodynamics.
//  1) 16-node compliant vascular graph (7 dorsal-aorta segments, 7 vena-cava segments, cerebral carotid bed, hepatic-portal bed)
//     and 26 directed vessels with cardiac/bicuspid venous valves, Frank-Starling preload, carotid baroreflex & orthostatic gravity.
//  2) 63-voxel (7 axial x 3 dorsoventral x 3 mediolateral) 3D Biot-Darcy poroelastic capillary-interstitial tissue continuum:
//       phi * dp_cap/dt = div((kappa / mu) * grad(p_cap)) + L_p * (P_vasc - p_cap - sigma * Pi_onc) - alpha_Biot * dJ_FEM/dt
//     coupled TWO-WAY (FSI) back onto the 85-particle / 336-tetrahedron 3D anisotropic FEM body via physical turgor forces
//     (body.fsiFx, body.fsiFy, body.fsiFz) on dermal & ring nodes!
//  3) 256 3D WCSPH blood parcels advected through the deforming 3D lumen with Tait equation-of-state pressure (gamma = 7),
//     Morris laminar shear viscosity, spatial-hashed O(N) neighborhood kernel, and per-parcel O2 + glucose transport.
import { clamp, mulberry } from './util.js';
import { NS } from './body.js';

export const N_NODES = 16; // 0..6 aorta(seg 0..6), 7..13 vena(seg 0..6), 14 cerebral(head), 15 portal(gut/liver)
export const N_PARCELS = 256;
export const NX_CAP = NS; // 7 axial segments
export const NY_CAP = 3;  // 0 = ventral, 1 = core, 2 = dorsal
export const NZ_CAP = 3;  // 0 = left,    1 = medial, 2 = right
export const N_CAP = NX_CAP * NY_CAP * NZ_CAP; // 63 3D poroelastic capillary voxels

const HASH_N = 512; // power-of-two spatial hash table for exact r < hSPH WCSPH neighbor lookup

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
    }
    this.P[14] = 68; this.comp[14] = 0.06;        // Cerebral microcirculation
    this.P[15] = 24; this.comp[15] = 0.18;        // Hepatic-portal splanchnic bed

    // Build closed-loop directed vascular edges: [u, v, radius0, length, valve (1 = one-way u->v)]
    const E = [];
    const addV = (u, v, rad, len, valve = 0) => E.push({ u, v, rad, len, area0: Math.PI * rad * rad, valve });
    // Axial dorsal aorta (heart at seg 4 pumps rostrally 4->5->6 and caudally 4->3->2->1->0)
    addV(4, 5, 0.052, 0.40, 1); addV(5, 6, 0.046, 0.40, 0);
    addV(4, 3, 0.054, 0.40, 1); addV(3, 2, 0.048, 0.40, 0); addV(2, 1, 0.042, 0.40, 0); addV(1, 0, 0.036, 0.40, 0);
    // Segmental muscular arteriole-capillary beds (aorta s -> vena s)
    for (let s = 0; s < NS; s++) addV(s, 7 + s, s === 1 || s === 3 || s === 5 ? 0.024 : 0.019, 0.32, 0);
    // Cerebral carotid loop (aorta 6 -> cerebral 14 -> vena 6)
    addV(6, 14, 0.028, 0.35, 0); addV(14, 13, 0.032, 0.35, 0);
    // Splanchnic / gut-liver portal loop (aorta 2,3 -> portal 15 -> vena 3)
    addV(3, 15, 0.030, 0.36, 0); addV(2, 15, 0.025, 0.38, 0); addV(15, 10, 0.036, 0.34, 1);
    // Venous return with one-way bicuspid valves toward right atrium (vena 11 = seg 4)
    addV(7, 8, 0.048, 0.40, 1); addV(8, 9, 0.052, 0.40, 1); addV(9, 10, 0.056, 0.40, 1); addV(10, 11, 0.062, 0.40, 1);
    addV(13, 12, 0.050, 0.40, 1); addV(12, 11, 0.058, 0.40, 1);
    // Cardiac atrioventricular + branchial/pulmonary oxygenation pump (vena 11 -> aorta 4)
    addV(11, 4, 0.065, 0.28, 1);

    this.edges = E;
    this.nE = E.length;
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

    // 256 3D WCSPH blood parcels inside the deforming vascular & capillary lumen
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
    this.pEdge = new Uint8Array(N_PARCELS);
    this.pS = new Float32Array(N_PARCELS);
    this.pRadOff = new Float32Array(N_PARCELS * 2);
    this._hHead = new Int16Array(HASH_N);
    this._hNext = new Int16Array(N_PARCELS);
    for (let i = 0; i < N_PARCELS; i++) {
      this.pEdge[i] = i % this.nE;
      this.pS[i] = r();
      const ang = r() * Math.PI * 2, rad = 0.02 + 0.05 * Math.sqrt(r());
      this.pRadOff[2 * i] = rad * Math.cos(ang);
      this.pRadOff[2 * i + 1] = rad * Math.sin(ang);
      this.pO2[i] = this.edges[this.pEdge[i]].u < 7 ? 0.96 : 0.72;
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

  /** Update 3D anatomical coordinates of all 16 vascular nodes from the live FEM body frames */
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
    }
    const hc = body.c[NS - 1], hf = F[NS - 1];
    NP[42] = X[hc] + hf.f[0] * 0.16 + hf.u[0] * 0.07;
    NP[43] = Y[hc] + hf.f[1] * 0.16 + hf.u[1] * 0.07;
    NP[44] = Z[hc] + hf.f[2] * 0.16 + hf.u[2] * 0.07;
    const lc = body.c[3], lf = F[3];
    NP[45] = X[lc] - lf.u[0] * 0.03 + lf.s[0] * 0.06;
    NP[46] = Y[lc] - lf.u[1] * 0.03 + lf.s[1] * 0.06;
    NP[47] = Z[lc] - lf.u[2] * 0.03 + lf.s[2] * 0.06;

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

        const fUp = clamp((pDor + pulse) * kTurgor, -0.04, 0.06);
        const fDn = clamp(pVen * kTurgor, -0.04, 0.06);
        const fRt = clamp(pR * kTurgor, -0.04, 0.06);
        const fLt = clamp(pL * kTurgor, -0.04, 0.06);

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
   * Advance coupled 1D Navier-Stokes vascular network + 63-voxel 3D Biot-Darcy FSI + 256 WCSPH blood parcels.
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
        const pTarget = i < 7 ? 20 : 5;
        if (P[i] < 1) P[i] += 0.25 * (1 - P[i]);
        P[i] = clamp(P[i] + 0.002 * h * (pTarget - P[i] + this.Pext[i]), 0.5, 220);
      }
    }
    this.reynoldsMax = maxRe;
    this.mapPressure = 0.92 * this.mapPressure + 0.08 * ((P[4] + P[5] + P[3]) / 3);
    this.cardiacOutput = 0.90 * this.cardiacOutput + 0.10 * Math.max(0, Q[pumpIdx] * 60);
    this.cerebralFlow = 0.90 * this.cerebralFlow + 0.10 * Math.max(0, Q[13] * 120);
    this.baroDrive = clamp((72 - 0.5 * (P[6] + P[14])) / 35, -0.8, 1.0);

    // Nodal O2 transport + metabolic extraction
    this.o2Node[4] = clamp(this.o2Node[4] + dt * (this.lesion ? 0.15 : 2.8) * (0.98 - this.o2Node[4]), 0.2, 0.99);
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

    // Solve 63-voxel 3D Biot-Darcy capillary filtration & two-way FSI turgor coupling
    this.stepBiotCapillaryFSI(dt, body, mu);

    // 256-parcel 3D WCSPH (Weakly Compressible SPH) with Tait EOS (gamma = 7) & spatial-hash O(N) neighborhood
    const px = this.px, py = this.py, pz = this.pz, vx = this.vx, vy = this.vy, vz = this.vz;
    const pRho = this.pRho, pPres = this.pPres;
    const hSPH = 0.15, h2 = hSPH * hSPH, invCell = 1 / hSPH;
    const head = this._hHead, next = this._hNext;
    head.fill(-1);
    for (let i = 0; i < N_PARCELS; i++) {
      pRho[i] = 1.0;
      const cx = Math.floor(px[i] * invCell), cy = Math.floor(py[i] * invCell), cz = Math.floor(pz[i] * invCell);
      const bk = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) & (HASH_N - 1);
      next[i] = head[bk];
      head[bk] = i;
    }

    // Pass 1: WCSPH Poly6 density accumulation across 27 neighbor cells
    for (let i = 0; i < N_PARCELS; i++) {
      const xi = px[i], yi = py[i], zi = pz[i];
      const bx = Math.floor(xi * invCell), by = Math.floor(yi * invCell), bz = Math.floor(zi * invCell);
      let rhoI = 1.0;
      for (let ox = -1; ox <= 1; ox++) {
        const hx = (bx + ox) * 73856093;
        for (let oy = -1; oy <= 1; oy++) {
          const hxy = hx ^ ((by + oy) * 19349663);
          for (let oz = -1; oz <= 1; oz++) {
            const bk = (hxy ^ ((bz + oz) * 83492791)) & (HASH_N - 1);
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
        const hx = (bx + ox) * 73856093;
        for (let oy = -1; oy <= 1; oy++) {
          const hxy = hx ^ ((by + oy) * 19349663);
          for (let oz = -1; oz <= 1; oz++) {
            const bk = (hxy ^ ((bz + oz) * 83492791)) & (HASH_N - 1);
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
    for (let i = 0; i < N_PARCELS; i++) {
      let ei = this.pEdge[i];
      let e = E[ei];
      const ds = (this.vel[ei] * 0.22 * dt) / Math.max(0.15, e.len);
      let s = this.pS[i] + ds;
      if (s >= 1) {
        s -= Math.floor(s);
        const outs = this.outEdges[e.v];
        if (outs.length === 1) ei = outs[0];
        else if (outs.length > 1) {
          let qTot = 0;
          for (const oe of outs) qTot += Math.max(0.001, Q[oe]);
          let pick = this.r() * qTot;
          ei = outs[0];
          for (const oe of outs) { pick -= Math.max(0.001, Q[oe]); if (pick <= 0) { ei = oe; break; } }
        }
        this.pEdge[i] = ei;
        e = E[ei];
      } else if (s < 0) {
        s = 0;
      }
      this.pS[i] = s;

      const u3 = 3 * e.u, v3 = 3 * e.v;
      const seg = e.u < 7 ? e.u : e.u < 14 ? e.u - 7 : e.u === 14 ? NS - 1 : 3;
      const fr = body.F[seg];
      const r0 = this.pRadOff[2 * i], r1 = this.pRadOff[2 * i + 1];
      const cx = NP[u3] + (NP[v3] - NP[u3]) * s + fr.u[0] * r0 + fr.s[0] * r1;
      const cy = NP[u3 + 1] + (NP[v3 + 1] - NP[u3 + 1]) * s + fr.u[1] * r0 + fr.s[1] * r1;
      const cz = NP[u3 + 2] + (NP[v3 + 2] - NP[u3 + 2]) * s + fr.u[2] * r0 + fr.s[2] * r1;

      vx[i] = vx[i] * 0.86 + (cx - px[i]) * 14 * dt;
      vy[i] = vy[i] * 0.86 + (cy - py[i]) * 14 * dt + gy * 0.015 * dt;
      vz[i] = vz[i] * 0.86 + (cz - pz[i]) * 14 * dt;
      px[i] += vx[i] * dt + (cx - px[i]) * 0.35;
      py[i] += vy[i] * dt + (cy - py[i]) * 0.35;
      pz[i] += vz[i] * dt + (cz - pz[i]) * 0.35;

      const o2Target = (1 - s) * this.o2Node[e.u] + s * this.o2Node[e.v];
      this.pO2[i] += 0.15 * (o2Target - this.pO2[i]);
      if (e.u === 15 || e.v === 15) this.pGlc[i] += 0.2 * (glcNorm - this.pGlc[i]);
      else this.pGlc[i] += 0.04 * (glcNorm - this.pGlc[i]);
    }
  }
}
