// Binocular ommatidial retina + hippocampal place-landmark associative map.
// Replaces the earlier omniscient site coordinates and simple 9-unit range cutoff with:
//  1) Retina: 32 ommatidial photoreceptors spanning a 260-deg field of view anchored to the physical 3D eye stalks and
//     neural gaze channels, with ray-rock and terrain-ridge occlusion, chromatic channels, optic flow and left/right looming.
//  2) Binocular + elevation depth estimation from the two physical eye-stalk particles (baseline ~0.48 u) and object height,
//     with realistic range-dependent disparity noise.
//  3) Hippocampal LandmarkMap: site and pool positions start UNLEARNED and are discovered and refined from visual sightings
//     paired with the creature's own head-direction ring and path-integrator state (visual SLAM loop closure without reading
//     ground-truth body coordinates).
import { clamp, gauss, mulberry } from './util.js';
import { NS, CH } from './body.js';

export const NBINS = 32;
export const FOV = (260 * Math.PI) / 180; // wide-field stalked-eye coverage (-130..+130 deg)
export const STEREO_RANGE = 9.0; // high-acuity binocular tracking range
export const HORIZON_RANGE = 26; // coarse tall-landmark horizon visibility when unoccluded

const HUE_RGB = [
  [0.22, 1.0, 0.62],
  [1.0, 0.24, 0.94],
  [0.24, 0.97, 1.0],
  [1.0, 0.69, 0.18],
];

export class Retina {
  constructor(seed = 1, nSites = 16, nPools = 3) {
    this.r = mulberry(seed * 6151 + 19);
    this.nSites = nSites;
    this.nPools = nPools;
    // Per-bin channels: R, G, B, looming (obstacle proximity 0..1), opticFlow
    this.rgb = new Float32Array(NBINS * 3);
    this.loom = new Float32Array(NBINS);
    this.lumPrev = new Float32Array(NBINS);
    this.flow = new Float32Array(NBINS);
    // Learned hippocampal landmark map (sites 0..15, pools 16..18) with EKF-SLAM variances
    const tot = nSites + nPools;
    this.memX = new Float64Array(tot);
    this.memZ = new Float64Array(tot);
    this.conf = new Float64Array(tot); // 0 = never seen, -> 1 = high-precision stereo fix
    this.lmVar = new Float64Array(tot).fill(1e6);
    this.egoVar = 0.02;
    this.slamFrame = 0;
    this.prevNavX = 0;
    this.prevNavZ = 0;
    this.navInit = false;
    // Live visual perceptions in the current frame (indexed by landmark id; vis = 0 if occluded / out of FOV)
    this.vis = new Float32Array(tot);
    this.visBear = new Float64Array(tot);
    this.visDist = new Float64Array(tot);
    // Obstacle lateral looming summary: left hemifield vs right hemifield vs central ahead
    this.obstAhead = 0;
    this.obstL = 0;
    this.obstR = 0;
    this.opticFlowMean = 0;
    this.seenCount = 0;
    this.loopClosures = 0;
  }

  /** Check whether a 3D ray from eye E to target T is blocked by any rock sphere or a terrain ridge */
  occluded(world, ex, ey, ez, tx, ty, tz, ignoreRock = -1) {
    const dx = tx - ex, dy = ty - ey, dz = tz - ez;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1e-6) return false;
    const len = Math.sqrt(len2);
    // Ray vs rock spheres
    const rocks = world.rocks;
    for (let i = 0; i < rocks.length; i++) {
      if (i === ignoreRock) continue;
      const R = rocks[i];
      const rx = R.x - ex, ry = R.y - ey, rz = R.z - ez;
      const proj = (rx * dx + ry * dy + rz * dz) / len;
      if (proj <= 0.05 || proj >= len - R.r * 0.4) continue;
      const perp2 = rx * rx + ry * ry + rz * rz - proj * proj;
      const rad = R.r * 0.92;
      if (perp2 < rad * rad) return true;
    }
    // Midpoint terrain-ridge check for medium/long rays
    if (len > 4) {
      for (const f of [0.35, 0.68]) {
        const mx = ex + dx * f, my = ey + dy * f, mz = ez + dz * f;
        if (world.height(mx, mz) > my + 0.28) return true;
      }
    }
    return false;
  }

  /**
   * Project the 3D world onto the binocular ommatidial retina from physical stalked-eye positions,
   * estimate stereo + elevation depth, and update the hippocampal landmark map & SLAM loop closure.
   */
  step(body, world, nav, lesionNav = false, lesionVision = false, goalBear = 0, goalDist = 1e9) {
    const X = body.x, Y = body.y, Z = body.z;
    const Fh = body.F[NS - 1];
    // Physical 3D eye positions on the two stalks (fallback to head core if stalks absent)
    const eL = body.stalks[0]?.eye ?? body.c[NS - 1];
    const eR = body.stalks[1]?.eye ?? body.c[NS - 1];
    const ex = 0.5 * (X[eL] + X[eR]), ey = 0.5 * (Y[eL] + Y[eR]), ez = 0.5 * (Z[eL] + Z[eR]);

    // Vestibulo-ocular horizon-stabilised head azimuth + proprioceptive spine-to-head neck angle
    const F3 = body.F[3];
    const spineAz = Math.atan2(F3.f[2], F3.f[0]);
    const gazeYaw = 0.25 * (body.u[CH.gaze] + body.u[CH.gaze + 2] + body.u[CH.gaze + 4]) / 0.75 * 0.35;
    const headAz = Math.atan2(Fh.f[2], Fh.f[0]);
    const neckYaw = Math.atan2(Math.sin(headAz - spineAz), Math.cos(headAz - spineAz));
    const gazeAz = headAz + gazeYaw;
    const gf0 = Math.cos(gazeAz), gf2 = Math.sin(gazeAz);
    const gs0 = -gf2, gs2 = gf0; // horizontal right-hand lateral axis (roll-invariant via vestibular horizon reflex)

    this.rgb.fill(0);
    this.loom.fill(0);
    this.vis.fill(0);

    const doSlam = !lesionNav && !!nav && (++this.slamFrame % 6 === 0);
    let navHeadX = 0, navHeadZ = 0;
    if (doSlam) {
      if (!this.navInit) {
        this.prevNavX = nav.px;
        this.prevNavZ = nav.pz;
        this.navInit = true;
      }
      // Entorhinal border-cell bound (arena walls sit around +-20 u)
      nav.px = clamp(nav.px, -19.5, 19.5);
      nav.pz = clamp(nav.pz, -19.5, 19.5);
      const move = Math.hypot(nav.px - this.prevNavX, nav.pz - this.prevNavZ);
      this.prevNavX = nav.px;
      this.prevNavZ = nav.pz;
      this.egoVar = Math.min(6.0, this.egoVar + 0.045 * move + 0.001);
      for (let i = 0; i < this.lmVar.length; i++) if (this.lmVar[i] < 1e5) this.lmVar[i] += 0.003;
      // Proprioceptive body-schema offset from COM (nav.px, nav.pz) to the anterior stalked eyes (~1.25 u forward)
      const neckHdg = nav.heading() + 0.35 * neckYaw;
      navHeadX = nav.px + 1.25 * Math.cos(neckHdg);
      navHeadZ = nav.pz + 1.25 * Math.sin(neckHdg);
    }

    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const binOf = (ang) => {
      const u = (ang + FOV * 0.5) / FOV;
      return u >= 0 && u < 1 ? Math.min(NBINS - 1, Math.floor(u * NBINS)) : -1;
    };

    // 1) Rocks -> retinal looming / obstacle map (horizon-stabilised + consistent goal-tangent bypass)
    let oAhead = 0, oL = 0, oR = 0;
    for (let i = 0; i < world.rocks.length; i++) {
      const R = world.rocks[i];
      const dx = R.x - ex, dz = R.z - ez;
      const distC = Math.hypot(dx, dz);
      const surfD = Math.max(0.05, distC - R.r);
      if (surfD > 8) continue;
      const ang = wrap(Math.atan2(dz, dx) - gazeAz);
      const halfSpan = Math.atan2(R.r + 0.22, Math.max(0.25, distC));
      const prox = clamp(1 - surfD / 3.4);
      // Paint spanned retinal bins
      const b0 = Math.max(0, Math.floor(((ang - halfSpan + FOV * 0.5) / FOV) * NBINS));
      const b1 = Math.min(NBINS - 1, Math.ceil(((ang + halfSpan + FOV * 0.5) / FOV) * NBINS));
      for (let b = b0; b <= b1; b++) {
        if (prox > this.loom[b]) this.loom[b] = prox;
        this.rgb[3 * b] += 0.18 * prox;
        this.rgb[3 * b + 2] += 0.28 * prox;
      }
      // Horizon-stabilised head-relative bearing of boulder vs tight collision cone
      const hAng = wrap(Math.atan2(dz, dx) - headAz);
      const clearCone = Math.min(0.62, halfSpan + 0.22);
      if (surfD < 1.5 && Math.abs(hAng) < clearCone && goalDist > surfD + 0.4) {
        const w = clamp(1 - surfD / 1.5) * clamp(1 - Math.abs(hAng) / (clearCone + 0.25), 0.3, 1);
        if (surfD < 1.25 && Math.abs(hAng) < 0.42) oAhead = Math.max(oAhead, clamp(1 - surfD / 1.25));
        // Pass on the side of the boulder closer to the goal bearing
        const relToGoal = wrap(goalBear - hAng);
        if (relToGoal >= 0) oL = Math.max(oL, w);
        else oR = Math.max(oR, w);
      }
    }
    this.obstAhead = oAhead;
    this.obstL = oL;
    this.obstR = oR;

    // Helper: binocular + angular-size depth measurement from the two physical eye stalks
    const measureLandmark = (id, tx, ty, tz, heightCue, rgb, maxR) => {
      const dx = tx - ex, dz = tz - ez;
      const trueD = Math.hypot(dx, dz);
      if (trueD > maxR) return;
      // Vestibulo-ocular horizon-stabilised horizontal azimuth relative to head heading (immune to body roll!)
      const hBear = wrap(Math.atan2(dz, dx) - headAz);
      const rAng = wrap(Math.atan2(dz, dx) - gazeAz);
      const b = binOf(rAng);
      if (b < 0 && !lesionVision) return; // outside the 260-deg visual field
      if (!lesionVision && this.occluded(world, ex, ey, ez, tx, ty, tz)) return;

      // Unbiased inverse-depth fusion: binocular stereopsis in the frontal overlap zone (|hBear| < 62 deg, bPerp > 0.22) + monocular vertical subtense
      const aL = Math.atan2(tz - Z[eL], tx - X[eL]);
      const aR = Math.atan2(tz - Z[eR], tx - X[eR]);
      const dispTrue = Math.abs(wrap(aL - aR));
      const dispObs = dispTrue + (lesionVision ? 0 : 0.0035 * gauss(this.r));
      const bPerp = Math.abs((X[eR] - X[eL]) * (-dz / Math.max(0.1, trueD)) + (Z[eR] - Z[eL]) * (dx / Math.max(0.1, trueD)));
      const rhoStereo = dispObs / Math.max(0.12, bPerp);
      const subtense = Math.atan2(heightCue, Math.max(0.25, trueD));
      const subObs = clamp(subtense + (lesionVision ? 0 : 0.006 * gauss(this.r)), 0.012, 1.45);
      const rhoSub = Math.tan(subObs) / heightCue;
      const inBinoc = Math.abs(hBear) < 1.08 && bPerp > 0.22;
      const wSt = inBinoc ? 1 / (1 + (trueD / 9) ** 2) : 0;
      const rhoEst = clamp(wSt * rhoStereo + (1 - wSt) * rhoSub, 1 / 28, 4.5);
      const dEst = 1 / rhoEst;
      const bEst = hBear + (lesionVision ? 0 : 0.01 * gauss(this.r));

      if (b >= 0) {
        const inten = clamp(1.3 / (1 + 0.12 * dEst));
        this.rgb[3 * b] += rgb[0] * inten;
        this.rgb[3 * b + 1] += rgb[1] * inten;
        this.rgb[3 * b + 2] += rgb[2] * inten;
      }

      this.vis[id] = dEst <= STEREO_RANGE ? 1 : 0.45;
      this.visBear[id] = bEst;
      this.visDist[id] = dEst;

      // Gauge-anchored 10 Hz hippocampal EKF-SLAM update (allocentric head-pos + HD ring + proprioceptive neck angle + visual vector)
      if (doSlam) {
        const worldAz = wrap(nav.heading() + neckYaw + bEst);
        const obsX = clamp(navHeadX + dEst * Math.cos(worldAz), -19.5, 19.5);
        const obsZ = clamp(navHeadZ + dEst * Math.sin(worldAz), -19.5, 19.5);
        const rObs = 0.04 + 0.025 * dEst * dEst;
        const vNew = this.egoVar + rObs;
        const vOld = this.lmVar[id];

        // 1) Localize ego-position against anchored landmarks seen within stereo range (accounting for 1.25 u head-to-COM offset!)
        if (vOld < 1.2 && dEst < 7.5 && this.egoVar > 0.05) {
          const neckHdg = nav.heading() + 0.35 * neckYaw;
          const impX = this.memX[id] - dEst * Math.cos(worldAz) - 1.25 * Math.cos(neckHdg);
          const impZ = this.memZ[id] - dEst * Math.sin(worldAz) - 1.25 * Math.sin(neckHdg);
          const kEgo = clamp(0.45 * (this.egoVar / (this.egoVar + vOld + rObs)), 0, 0.32);
          nav.reset(impX, impZ, kEgo);
          this.prevNavX = nav.px;
          this.prevNavZ = nav.pz;
          navHeadX = nav.px + 1.25 * Math.cos(neckHdg);
          navHeadZ = nav.pz + 1.25 * Math.sin(neckHdg);
          this.egoVar *= 1 - kEgo;
          this.loopClosures++;
        }

        // 2) Map/refine landmark coordinates via inverse-variance Kalman fusion
        if (vOld > 1e5) {
          this.memX[id] = obsX;
          this.memZ[id] = obsZ;
          this.lmVar[id] = vNew;
          this.seenCount++;
        } else if (vNew < vOld * 2.2 || dEst < 6.0) {
          const kLm = clamp(vOld / (vOld + vNew), 0.05, 0.85);
          this.memX[id] = clamp(this.memX[id] + kLm * (obsX - this.memX[id]), -19.5, 19.5);
          this.memZ[id] = clamp(this.memZ[id] + kLm * (obsZ - this.memZ[id]), -19.5, 19.5);
          this.lmVar[id] = Math.max(0.05, (1 - kLm) * vOld);
        }
        this.conf[id] = clamp(1 / (1 + Math.sqrt(this.lmVar[id]) * 0.55), 0.05, 0.99);
      }
    };

    // 2) Project the 16 plants (stem + glowing fruit at y + 1.35)
    for (let k = 0; k < world.plants.length; k++) {
      const P = world.plants[k];
      const col = HUE_RGB[P.c];
      const br = 0.35 + 0.65 * P.fruit;
      measureLandmark(k, P.x, P.y + 1.35, P.z, 1.35, [col[0] * br, col[1] * br, col[2] * br], HORIZON_RANGE);
    }

    // 3) Project the 3 water pools (shimmering surface specular reflection, radius 2.2)
    for (let p = 0; p < world.pools.length; p++) {
      const Wp = world.pools[p];
      const wy = world.height(Wp.x, Wp.z) + 0.15;
      measureLandmark(this.nSites + p, Wp.x, wy, Wp.z, Wp.r, [0.2, 0.85, 1.0], HORIZON_RANGE - 2);
    }

    // 4) Project dropped snacks onto the retina
    for (const s of world.snacks) {
      const dx = s.x - ex, dz = s.z - ez, d = Math.hypot(dx, dz);
      if (d > 16) continue;
      const b = binOf(wrap(Math.atan2(dz, dx) - gazeAz));
      if (b >= 0 && !this.occluded(world, ex, ey, ez, s.x, s.y + 0.15, s.z)) {
        const w = clamp(1.5 / (1 + 0.15 * d));
        this.rgb[3 * b] += w;
        this.rgb[3 * b + 1] += (s.kind === 'fat' ? 0.8 : 0.4) * w;
        this.rgb[3 * b + 2] += (s.kind === 'fat' ? 0.4 : 0.8) * w;
      }
    }

    // 5) Retinal optic flow (temporal contrast change per ommatidium)
    let flowSum = 0;
    for (let b = 0; b < NBINS; b++) {
      const lum = 0.33 * (this.rgb[3 * b] + this.rgb[3 * b + 1] + this.rgb[3 * b + 2]) + 0.5 * this.loom[b];
      const df = Math.abs(lum - this.lumPrev[b]);
      this.lumPrev[b] = lum;
      this.flow[b] = 0.8 * this.flow[b] + 0.2 * df;
      flowSum += this.flow[b];
    }
    this.opticFlowMean = flowSum / NBINS;
  }

  /** Known or hypothesised world coordinates of site k (or exploratory prior if not yet sighted) */
  sitePos(k, world) {
    if (globalThis.TW?.exactMap) {
      const P = world.plants[k];
      return { x: P.x, z: P.z, conf: 1 };
    }
    if (this.conf[k] > 0) return { x: this.memX[k], z: this.memZ[k], conf: this.conf[k] };
    // Never glimpsed yet: coarse prior direction from arena sector so curiosity/search can discover it visually
    const gx = ((k & 3) - 1.5) * 8.5, gz = ((k >> 2) - 1.5) * 8.5;
    return { x: gx, z: gz, conf: 0 };
  }

  poolPos(p, world) {
    const id = this.nSites + p;
    if (globalThis.TW?.exactMap) {
      const Wp = world.pools[p];
      return { x: Wp.x, z: Wp.z, conf: 1 };
    }
    if (this.conf[id] > 0) return { x: this.memX[id], z: this.memZ[id], conf: this.conf[id] };
    return null;
  }
}
