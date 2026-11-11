// Closed-loop 1D incompressible Navier-Stokes vascular network + 3D SPH/Lagrangian blood-parcel fluid dynamics.
// Replaces purely decorative blood-phase rendering with physical hemodynamics coupled bidirectionally to the 3D FEM body and metabolism:
//  1) 16-node compliant vascular graph (7 dorsal-aorta segments, 7 vena-cava segments, cerebral carotid bed, hepatic-splanchnic portal bed)
//     and 26 directed vessels with cardiac/venous valves.
//  2) Unsteady 1D axial Navier-Stokes momentum on each vessel:
//       dQ/dt + d(Q^2 / A)/ds = -(A / rho) * dP/ds - (8 * pi * mu / (rho * A)) * Q + A * (g . tangent)
//     coupled to compliant Windkessel/elastic wall continuity C_i * dP_i/dt = sum(Q_in) - sum(Q_out), time-varying left-ventricular
//     elastance E_LV(t) (Frank-Starling preload), gravitational hydrostatic pooling from true 3D body elevation, and skeletal-muscle
//     pump compression from 3D FEM tetrahedral tissue pressure!
//  3) 120 3D SPH (Smoothed Particle Hydrodynamics) blood parcels advected through the deforming 3D body lumen with local density/pressure
//     repulsion, viscous smoothing, lumen wall confinement, and dissolved O2 + glucose transport from gut/thorax to brain & muscles.
import { clamp, mulberry } from './util.js';
import { NS } from './body.js';

export const N_NODES = 16; // 0..6 aorta(seg 0..6), 7..13 vena(seg 0..6), 14 cerebral(head), 15 portal(gut/liver)
export const N_PARCELS = 120;

export class Hemodynamics {
  constructor(seed = 1) {
    const r = mulberry(seed * 4099 + 29);
    this.r = r;
    // Nodal pressures (mmHg-scaled physiological units; resting mean ~85 arterial, ~8 venous) and volumes
    this.P = new Float64Array(N_NODES);
    this.Pext = new Float64Array(N_NODES); // external FEM intramuscular tissue pressure
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
    // Cardiac atrioventricular + pulmonary-equivalent oxygenation pump (vena 11 -> aorta 4)
    addV(11, 4, 0.065, 0.28, 1);

    this.edges = E;
    this.nE = E.length;
    this.Q = new Float64Array(this.nE);      // Volumetric flow rate per vessel
    this.area = Float64Array.from(E, (e) => e.area0);
    this.vel = new Float64Array(this.nE);    // Axial fluid velocity u = Q / A

    // Outgoing edge adjacency per node for Lagrangian parcel routing at bifurcations
    this.outEdges = Array.from({ length: N_NODES }, () => []);
    E.forEach((e, idx) => this.outEdges[e.u].push(idx));

    // 120 3D SPH / Lagrangian blood parcels inside the vascular lumen
    this.px = new Float32Array(N_PARCELS);
    this.py = new Float32Array(N_PARCELS);
    this.pz = new Float32Array(N_PARCELS);
    this.vx = new Float32Array(N_PARCELS);
    this.vy = new Float32Array(N_PARCELS);
    this.vz = new Float32Array(N_PARCELS);
    this.pRho = new Float32Array(N_PARCELS).fill(1);
    this.pO2 = new Float32Array(N_PARCELS).fill(0.95);
    this.pGlc = new Float32Array(N_PARCELS).fill(1.0);
    this.pEdge = new Uint8Array(N_PARCELS);
    this.pS = new Float32Array(N_PARCELS); // axial progress s in [0, 1] along vessel
    this.pRadOff = new Float32Array(N_PARCELS * 2);
    for (let i = 0; i < N_PARCELS; i++) {
      this.pEdge[i] = i % this.nE;
      this.pS[i] = r();
      const ang = r() * Math.PI * 2, rad = 0.025 + 0.045 * Math.sqrt(r());
      this.pRadOff[2 * i] = rad * Math.cos(ang);
      this.pRadOff[2 * i + 1] = rad * Math.sin(ang);
      this.pO2[i] = this.edges[this.pEdge[i]].u < 7 ? 0.96 : 0.72;
    }

    this.heartPhase = 0;
    this.cardiacOutput = 1.0;
    this.mapPressure = 85;      // Mean Arterial Pressure
    this.cerebralFlow = 1.0;    // Carotid perfusion (drives baroreceptor & brain O2)
    this.baroDrive = 0;         // Baroreceptor reflex signal (-1..+1) -> modulates HR
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
      // Dorsal aorta runs slightly dorsal (+0.04 u) and left (-0.02 s) of spine core
      NP[3 * s] = X[c] + fr.u[0] * 0.04 - fr.s[0] * 0.02;
      NP[3 * s + 1] = Y[c] + fr.u[1] * 0.04 - fr.s[1] * 0.02;
      NP[3 * s + 2] = Z[c] + fr.u[2] * 0.04 - fr.s[2] * 0.02;
      // Vena cava runs slightly ventral (-0.04 u) and right (+0.025 s)
      const v = 7 + s;
      NP[3 * v] = X[c] - fr.u[0] * 0.04 + fr.s[0] * 0.025;
      NP[3 * v + 1] = Y[c] - fr.u[1] * 0.04 + fr.s[1] * 0.025;
      NP[3 * v + 2] = Z[c] - fr.u[2] * 0.04 + fr.s[2] * 0.025;
    }
    // Node 14: Cerebral microcirculation inside anterior cranium
    const hc = body.c[NS - 1], hf = F[NS - 1];
    NP[42] = X[hc] + hf.f[0] * 0.16 + hf.u[0] * 0.07;
    NP[43] = Y[hc] + hf.f[1] * 0.16 + hf.u[1] * 0.07;
    NP[44] = Z[hc] + hf.f[2] * 0.16 + hf.u[2] * 0.07;
    // Node 15: Hepatic-portal bed at segment 3 ventral-right
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
   * Advance coupled 1D Navier-Stokes vascular network + 3D SPH blood parcels by `dt` seconds (typically 1/60 s).
   */
  step(dt, body, metab, world, spikes = 0) {
    this.updateNodeGeometry(body);
    const NP = this.nodePos, P = this.P, Q = this.Q, E = this.edges, nE = this.nE;

    // External FEM intramuscular tissue pressure compresses segmental veins (skeletal muscle pump!)
    for (let s = 0; s < NS; s++) {
      const femP = (body.segPressure ? body.segPressure[s] : 0) * 18;
      this.Pext[s] = 0.2 * femP;
      this.Pext[7 + s] = femP;
    }

    // Gravity vector in world frame (drives real orthostatic pooling when rearing/climbing/inverted!)
    const gMag = world.g || 9.8;
    const gx = world.gx * gMag, gz = world.gz * gMag;
    const gy = -gMag * Math.sqrt(Math.max(0, 1 - world.gx * world.gx - world.gz * world.gz));

    // Cardiac cycle & time-varying ventricular elastance + Frank-Starling preload
    const hr = clamp((metab.hr || 72) + 14 * this.baroDrive, 38, 195);
    this.heartPhase = (this.heartPhase + dt * (hr / 60)) % 1;
    const systole = this.heartPhase < 0.36 ? Math.sin((Math.PI * this.heartPhase) / 0.36) ** 2 : 0;
    const preload = clamp((P[11] + 2) / 9, 0.35, 1.8);
    const pumpHead = this.lesion ? 6.0 : (115 + 38 * (metab.symp || 0.3)) * systole * preload;

    // Sub-step unsteady 1D Navier-Stokes momentum & compliant mass conservation (4 substeps for CFL stability)
    const sub = 4, h = dt / sub;
    const rho = 1.06;               // blood density (g/cm^3 scaled)
    const mu = 0.035 * (1 + 0.08 * clamp((metab.blood.glc - 3) / 4, -0.5, 2)); // glucose-dependent blood viscosity!
    const pumpIdx = nE - 1;         // cardiac edge 11 -> 4

    let maxRe = 0;
    for (let st = 0; st < sub; st++) {
      for (let idx = 0; idx < nE; idx++) {
        const e = E[idx];
        const u3 = 3 * e.u, v3 = 3 * e.v;
        const dx = NP[v3] - NP[u3], dy = NP[v3 + 1] - NP[u3 + 1], dz = NP[v3 + 2] - NP[u3 + 2];
        const len = Math.max(0.12, Math.hypot(dx, dy, dz));
        const gAxial = (gx * dx + gy * dy + gz * dz) / len; // gravitational head along vessel tangent

        // Pressure-area tube law: A = A0 * (1 + beta * (P_tm - P0))
        const pMid = 0.5 * (P[e.u] + P[e.v]) - 0.5 * (this.Pext[e.u] + this.Pext[e.v]);
        const area = clamp(e.area0 * (1 + 0.003 * (pMid - 25)), e.area0 * 0.35, e.area0 * 1.85);
        this.area[idx] = area;

        // Pressure difference + cardiac active pump head on the heart valve edge
        const dP = (P[e.u] - P[e.v]) + (idx === pumpIdx ? pumpHead : 0);

        // 1D Navier-Stokes momentum:
        //   dQ/dt = -convective_flux_grad + (A / (rho * L)) * dP - (8 * pi * mu / (rho * A)) * Q + 0.35 * A * gAxial
        const q = Q[idx];
        const uVel = q / area;
        const conv = -0.15 * (q * Math.abs(uVel)) / len; // convective inertia stabilizer
        const presTerm = (area / (rho * len)) * dP * 18.0;
        const viscDrag = ((8 * Math.PI * mu) / (rho * area)) * q * 0.045;
        const gravTerm = area * gAxial * 1.35;

        let qNext = q + h * (conv + presTerm - viscDrag + gravTerm);
        if (e.valve && qNext < 0) qNext *= 0.02; // one-way valve closure (trace physiological regurgitation only)
        qNext = clamp(qNext, -0.8, 1.6);
        Q[idx] = qNext;
        this.vel[idx] = qNext / area;

        const re = (rho * Math.abs(this.vel[idx]) * (2 * Math.sqrt(area / Math.PI))) / Math.max(1e-4, mu);
        if (re > maxRe) maxRe = re;
      }

      // Compliant nodal continuity: C_i * dP_i/dt = sum(Q_in) - sum(Q_out) + dP_ext/dt coupling
      for (let idx = 0; idx < nE; idx++) {
        const e = E[idx], dq = h * Q[idx];
        P[e.u] -= dq / this.comp[e.u];
        P[e.v] += dq / this.comp[e.v];
      }
      for (let i = 0; i < N_NODES; i++) {
        // Soft interstitial Starling fluid exchange prevents unphysical negative vacuum collapse
        const pTarget = i < 7 ? 20 : 5;
        if (P[i] < 1) P[i] += 0.25 * (1 - P[i]);
        P[i] = clamp(P[i] + 0.002 * h * (pTarget - P[i] + this.Pext[i]), 0.5, 220);
      }
    }
    this.reynoldsMax = maxRe;
    this.mapPressure = 0.92 * this.mapPressure + 0.08 * ((P[4] + P[5] + P[3]) / 3);
    this.cardiacOutput = 0.90 * this.cardiacOutput + 0.10 * Math.max(0, Q[pumpIdx] * 60);
    this.cerebralFlow = 0.90 * this.cerebralFlow + 0.10 * Math.max(0, Q[13] * 120);
    // Carotid sinus baroreceptor reflex: responds to cerebral arterial pressure P[6]/P[14] relative to 72 mmHg set-point
    this.baroDrive = clamp((72 - 0.5 * (P[6] + P[14])) / 35, -0.8, 1.0);

    // Nodal O2 transport + metabolic extraction (branchial/pulmonary re-oxygenation at cardiac transition 11->4)
    this.o2Node[4] = clamp(this.o2Node[4] + dt * (this.lesion ? 0.15 : 2.8) * (0.98 - this.o2Node[4]), 0.2, 0.99);
    for (let idx = 0; idx < nE; idx++) {
      const e = E[idx], q = Q[idx];
      if (q > 0) {
        const mix = clamp((q * dt * 18) / Math.max(0.02, this.comp[e.v]), 0, 0.65);
        this.o2Node[e.v] += mix * (this.o2Node[e.u] - this.o2Node[e.v]);
      }
    }
    // Tissue O2 consumption from local muscle activation + brain spiking
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

    // 3D SPH / Lagrangian blood-parcel advection + pairwise SPH pressure/viscosity kernel inside deforming lumen
    const px = this.px, py = this.py, pz = this.pz, vx = this.vx, vy = this.vy, vz = this.vz;
    const hSPH = 0.16, h2 = hSPH * hSPH;
    // Compute local SPH density & pairwise repulsive pressure + laminar viscous coupling among nearby parcels
    for (let i = 0; i < N_PARCELS; i++) this.pRho[i] = 1.0;
    for (let i = 0; i < N_PARCELS; i++) {
      const xi = px[i], yi = py[i], zi = pz[i];
      for (let j = i + 1; j < N_PARCELS; j++) {
        const dx = xi - px[j], dy = yi - py[j], dz = zi - pz[j];
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 >= h2 || r2 < 1e-9) continue;
        const rLen = Math.sqrt(r2), qk = 1 - rLen / hSPH;
        const w = qk * qk;
        this.pRho[i] += w;
        this.pRho[j] += w;
        // Spiky pressure repulsion + viscosity smoothing
        const fP = (0.45 * qk * qk) / rLen;
        const dvx = vx[j] - vx[i], dvy = vy[j] - vy[i], dvz = vz[j] - vz[i];
        const visc = 0.08 * qk;
        const ix = fP * dx + visc * dvx, iy = fP * dy + visc * dvy, iz = fP * dz + visc * dvz;
        vx[i] += ix * dt; vy[i] += iy * dt; vz[i] += iz * dt;
        vx[j] -= ix * dt; vy[j] -= iy * dt; vz[j] -= iz * dt;
      }
    }

    const glcNorm = clamp((metab.blood.glc || 3) / 3.5, 0.2, 1.8);
    for (let i = 0; i < N_PARCELS; i++) {
      let ei = this.pEdge[i];
      let e = E[ei];
      // Advance axial coordinate s along vessel using true Navier-Stokes velocity u = Q / A
      const ds = (this.vel[ei] * 0.22 * dt) / Math.max(0.15, e.len);
      let s = this.pS[i] + ds;
      if (s >= 1) {
        s -= Math.floor(s);
        const outs = this.outEdges[e.v];
        if (outs.length === 1) ei = outs[0];
        else if (outs.length > 1) {
          // Flow-weighted bifurcation routing (proportional to positive Q_out!)
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

      // Target lumen centerline + radial offset in body segment frame, coupled with SPH velocity + wall confinement
      const u3 = 3 * e.u, v3 = 3 * e.v;
      const seg = e.u < 7 ? e.u : e.u < 14 ? e.u - 7 : e.u === 14 ? NS - 1 : 3;
      const fr = body.F[seg];
      const r0 = this.pRadOff[2 * i], r1 = this.pRadOff[2 * i + 1];
      const cx = NP[u3] + (NP[v3] - NP[u3]) * s + fr.u[0] * r0 + fr.s[0] * r1;
      const cy = NP[u3 + 1] + (NP[v3 + 1] - NP[u3 + 1]) * s + fr.u[1] * r0 + fr.s[1] * r1;
      const cz = NP[u3 + 2] + (NP[v3 + 2] - NP[u3 + 2]) * s + fr.u[2] * r0 + fr.s[2] * r1;

      // Wall confinement + axial Navier-Stokes advection force
      vx[i] = vx[i] * 0.86 + (cx - px[i]) * 14 * dt;
      vy[i] = vy[i] * 0.86 + (cy - py[i]) * 14 * dt + gy * 0.015 * dt;
      vz[i] = vz[i] * 0.86 + (cz - pz[i]) * 14 * dt;
      px[i] += vx[i] * dt + (cx - px[i]) * 0.35;
      py[i] += vy[i] * dt + (cy - py[i]) * 0.35;
      pz[i] += vz[i] * dt + (cz - pz[i]) * 0.35;

      // Parcel O2 & glucose equilibrate with current vessel compartment
      const o2Target = (1 - s) * this.o2Node[e.u] + s * this.o2Node[e.v];
      this.pO2[i] += 0.15 * (o2Target - this.pO2[i]);
      if (e.u === 15 || e.v === 15) this.pGlc[i] += 0.2 * (glcNorm - this.pGlc[i]);
      else this.pGlc[i] += 0.04 * (glcNorm - this.pGlc[i]);
    }
  }
}
