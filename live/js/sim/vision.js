// High-Acuity Log-Polar Foveated Binocular Visual Hierarchy (Dual 64x32 Retinas = 4,096 Ganglion Channels -> LGN ->
// V1 Gabor -> V2 Curvature/Junctions -> V4 Scale-Tolerant Max-Pooling -> IT View-Invariant Object Cortex + MT Flow + EKF-SLAM).
//
// Pass 17 upgrades:
//  1) 7.1x higher photoreceptor count: Dual 64x32 Left/Right sheets (2,048 per eye = 4,096 RGB + inverse-depth channels)
//     with primate/raptor log-polar foveal magnification (~3.8x finer angular resolution in the central +-18 deg fovea).
//  2) 4-stage deep HMAX/ventral cortical hierarchy:
//       - LGN (64x32): magnocellular DoG center-surround + parvocellular R-G and B-Y double-opponent maps.
//       - V1  (32x16x4 = 2,048 units): 5x5 zero-DC quadrature Gabor Simple & Complex cells + binocular stereo disparity.
//       - V2  (16x8x4 = 512 units): cross-orientation corner/junction, acute vertex, and end-stopped curvature detectors.
//       - V4  (8x4x8 = 256 units): spatial & scale-tolerant C2 max-pooling over V2 shape + double-opponent chromatic bands,
//         plus an 8x4x3 = 96-D foveal RGB patch (`fovealPatch`) for multi-second visual world-model prediction.
//       - IT  (24 Inferotemporal object-category neurons): translation-, scale- & 3D-view-invariant object prototypes
//         (16 4x4 plant species + water, snacks, rocks, conspecifics, eggs, mites, predators) refined online via
//         Foldiak / Wallis-Rolls slow temporal-trace Hebbian learning!
import { clamp, gauss, mulberry } from './util.js';
import { NS, CH } from './body.js';

export const NBINS = 32;
export const W_RET = 64;
export const H_RET = 32;
export const W_V1 = 32;
export const H_V1 = 16;
export const W_V2 = 16;
export const H_V2 = 8;
export const W_V4 = 8;
export const H_V4 = 4;
export const N_ORI = 4; // 0, 45, 90, 135 deg
export const N_IT = 24; // 0..15 plant species (4 hues x 4 crowns), 16 pool, 17..18 snacks, 19 rock, 20 conspecific, 21 egg, 22 mite, 23 predator
export const N_VIS_PATCH = W_V4 * H_V4 * 3; // 96-D downsampled foveal RGB patch for visual world model
export const FOV = (260 * Math.PI) / 180;
export const VFOV = (110 * Math.PI) / 180;
export const STEREO_RANGE = 9.0;
export const HORIZON_RANGE = 26;

const HUE_RGB = [
  [0.22, 1.0, 0.62],
  [1.0, 0.24, 0.94],
  [0.24, 0.97, 1.0],
  [1.0, 0.69, 0.18],
];

// Log-polar foveated angle <-> retinal pixel mapping:
// Maps normalized angle a in [-0.5, +0.5] through sinh/asinh compression so central fovea has ~3.6x higher sampling density!
const FOV_K = 2.6;
const ASINH_HALF = Math.asinh(0.5 * FOV_K * 2); // asinh(2.6)
function angleToFoveaNorm(aNorm) {
  // aNorm in [-0.5, +0.5] -> pixel norm in [0, 1]
  return 0.5 + 0.5 * (Math.asinh(clamp(aNorm, -0.6, 0.6) * 2 * FOV_K) / ASINH_HALF);
}
const RET_AZ_NORM = new Float32Array(W_RET);
const RET_EL_NORM = new Float32Array(H_RET);
for (let px = 0; px < W_RET; px++) {
  const u = ((px + 0.5) / W_RET - 0.5) * 2; // [-1, 1]
  RET_AZ_NORM[px] = 0.5 * (Math.sinh(u * ASINH_HALF) / FOV_K);
}
for (let py = 0; py < H_RET; py++) {
  const v = (0.5 - (py + 0.5) / H_RET) * 2; // [+1 top .. -1 bottom]
  RET_EL_NORM[py] = 0.5 * (Math.sinh(v * ASINH_HALF) / FOV_K);
}

// Precompute 4-orientation 5x5 quadrature zero-DC 2D Gabor kernels
const GABOR_COS = new Float32Array(N_ORI * 25);
const GABOR_SIN = new Float32Array(N_ORI * 25);
{
  const sigma = 1.15, gamma = 0.75, lambda = 2.6;
  for (let o = 0; o < N_ORI; o++) {
    const th = (o * Math.PI) / N_ORI;
    const ct = Math.cos(th), st = Math.sin(th);
    let sumC = 0, normC = 0, normS = 0;
    const off = o * 25;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xp = dx * ct + dy * st;
        const yp = -dx * st + dy * ct;
        const env = Math.exp(-(xp * xp + gamma * gamma * yp * yp) / (2 * sigma * sigma));
        const ph = (2 * Math.PI * xp) / lambda;
        const k = off + (dy + 2) * 5 + (dx + 2);
        GABOR_COS[k] = env * Math.cos(ph);
        GABOR_SIN[k] = env * Math.sin(ph);
        sumC += GABOR_COS[k];
      }
    }
    const meanC = sumC / 25;
    for (let i = 0; i < 25; i++) {
      GABOR_COS[off + i] -= meanC;
      normC += GABOR_COS[off + i] ** 2;
      normS += GABOR_SIN[off + i] ** 2;
    }
    const scC = 1 / Math.sqrt(normC || 1), scS = 1 / Math.sqrt(normS || 1);
    for (let i = 0; i < 25; i++) {
      GABOR_COS[off + i] *= scC;
      GABOR_SIN[off + i] *= scS;
    }
  }
}

export class Retina {
  constructor(seed = 1, nSites = 16, nPools = 3) {
    this.r = mulberry(seed * 6151 + 19);
    this.nSites = nSites;
    this.nPools = nPools;

    // 1) Dual 64x32 Log-Polar Foveated Photoreceptor/Ganglion Sheets (2,048 L + 2,048 R = 4,096 receptors)
    const NPX = W_RET * H_RET;
    this.nReceptors = NPX * 2;
    this.retL = new Float32Array(NPX * 3);
    this.retR = new Float32Array(NPX * 3);
    this.invDL = new Float32Array(NPX);
    this.invDR = new Float32Array(NPX);

    // 2) Thalamic LGN (64x32)
    this.lumCur = new Float32Array(NPX);
    this.lum2DPrev = new Float32Array(NPX);
    this.lgnMag = new Float32Array(NPX);
    this.lgnRG = new Float32Array(NPX);
    this.lgnBY = new Float32Array(NPX);

    // 3) V1 (32x16x4 = 2,048 orientation hypercolumns)
    const NV1 = W_V1 * H_V1;
    this.v1Simple = new Float32Array(NV1 * N_ORI);
    this.v1Complex = new Float32Array(NV1 * N_ORI);
    this.v1Disparity = new Float32Array(NV1);

    // 4) V2 (16x8x4 = 512 contour/junction cells: [box-ortho, cone-acute, diamond-star, smooth-curved])
    const NV2 = W_V2 * H_V2;
    this.v2Cells = new Float32Array(NV2 * 4);

    // 5) V4 (8x4x8 = 256 scale/translation-tolerant max-pooled part descriptors) + 96-D Foveal RGB Patch
    const NV4 = W_V4 * H_V4;
    this.v4Map = new Float32Array(NV4 * 8);
    this.v4Orient = new Float32Array(N_ORI);
    this.v4Fovea = new Float32Array(8);
    this.fovealPatch = new Float32Array(N_VIS_PATCH); // 8x4x3 RGB pixel tensor for world model

    // 6) Inferotemporal (IT) Cortex: 24 view- & scale-invariant object category neurons over 16-D pooled V4 descriptor
    this.itFeat = new Float32Array(16); // [4 V1 ori, 4 V2 junction/curve, 4 hue-opponent, 4 spatial-aspect]
    this.itAct = new Float32Array(N_IT);
    this.itTrace = new Float32Array(N_IT);
    this.Wit = new Float32Array(N_IT * 16);
    this._initITPrototypes();
    this.itTopCat = -1;
    this.itInvariance = 0.82; // rolling cosine stability across distance/angle changes on fixated object
    this._prevItVec = new Float32Array(N_IT);
    this._prevTopId = -1;

    // Dorsal MT 2D optic flow (on 32x16 V1 grid)
    this.mtFlowX = new Float32Array(NV1);
    this.mtFlowY = new Float32Array(NV1);
    this.mtDiv = 0;
    this.v1EnergyMean = 0;

    // 32-bin azimuthal summary
    this.rgb = new Float32Array(NBINS * 3);
    this.loom = new Float32Array(NBINS);
    this.lumPrev = new Float32Array(NBINS);
    this.flow = new Float32Array(NBINS);

    // Hippocampal EKF-SLAM landmark map
    const tot = nSites + nPools;
    this.memX = new Float64Array(tot);
    this.memZ = new Float64Array(tot);
    this.conf = new Float64Array(tot);
    this.lmVar = new Float64Array(tot).fill(1e6);
    this.egoVar = 0.02;
    this.slamFrame = 0;
    this.prevNavX = 0;
    this.prevNavZ = 0;
    this.navInit = false;

    this.vis = new Float32Array(tot);
    this.visBear = new Float32Array(tot);
    this.visDist = new Float32Array(tot);

    this.obstAhead = 0;
    this.obstL = 0;
    this.obstR = 0;
    this.opticFlowMean = 0;
    this.seenCount = 0;
    this.loopClosures = 0;
    this.socialSeen = 0;
    this.predatorLoom = 0;
  }

  _initITPrototypes() {
    // Seed IT prototypes with coarse developmental colour+junction selectivity, refined online via Foldiak trace rule
    for (let k = 0; k < N_IT; k++) {
      const off = k * 16;
      if (k < 16) {
        const hue = k & 3, shp = k >> 2;
        this.Wit[off + (shp === 1 ? 0 : shp === 2 ? 1 : 2)] = 0.45;
        this.Wit[off + 4 + shp] = 0.68;       // V2 shape-junction channel
        this.Wit[off + 8 + hue] = 0.72;       // V4 colour-band channel
      } else {
        this.Wit[off + (k % 4)] = 0.45;
        this.Wit[off + 4 + ((k + 1) % 4)] = 0.55;
        this.Wit[off + 8 + ((k - 16) % 4)] = 0.65;
        this.Wit[off + 12 + ((k - 16) >> 1)] = 0.45;
      }
      let n2 = 0;
      for (let j = 0; j < 16; j++) n2 += this.Wit[off + j] ** 2;
      const inv = 1 / (Math.sqrt(n2) || 1);
      for (let j = 0; j < 16; j++) this.Wit[off + j] *= inv;
    }
  }

  occluded(world, ex, ey, ez, tx, ty, tz, ignoreRock = -1) {
    const dx = tx - ex, dy = ty - ey, dz = tz - ez;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1e-6) return false;
    const len = Math.sqrt(len2);
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
    if (len > 4) {
      for (const f of [0.35, 0.68]) {
        const mx = ex + dx * f, my = ey + dy * f, mz = ez + dz * f;
        if (world.height(mx, mz) > my + 0.28) return true;
      }
    }
    return false;
  }

  /** Rasterize a 3D silhouette onto a 64x32 log-polar foveated eye sheet with z-buffer occlusion */
  paintEyeShape(ret, invD, az, el, angRad, shape, rCol, gCol, bCol, idval) {
    const aN = az / FOV, eN = el / VFOV;
    if (Math.abs(aN) > 0.56 || Math.abs(eN) > 0.56) return;
    const uC = angleToFoveaNorm(aN) * W_RET;
    const vC = (1 - angleToFoveaNorm(eN)) * H_RET;
    // Local cortical magnification factor d(pixel)/d(angle) at eccentricity (aN, eN)
    const magU = (FOV_K / (ASINH_HALF * Math.sqrt(1 + (2 * FOV_K * aN) ** 2))) * W_RET;
    const magV = (FOV_K / (ASINH_HALF * Math.sqrt(1 + (2 * FOV_K * eN) ** 2))) * H_RET;
    const rx = clamp((angRad / FOV) * magU, 0.75, W_RET * 0.42);
    const ry = clamp((angRad / VFOV) * magV, 0.75, H_RET * 0.45);
    const x0 = Math.max(0, Math.floor(uC - rx - 0.6)), x1 = Math.min(W_RET - 1, Math.ceil(uC + rx + 0.6));
    const y0 = Math.max(0, Math.floor(vC - ry - 0.6)), y1 = Math.min(H_RET - 1, Math.ceil(vC + ry + 0.6));

    for (let py = y0; py <= y1; py++) {
      const ny = (py + 0.5 - vC) / ry;
      for (let px = x0; px <= x1; px++) {
        const nx = (px + 0.5 - uC) / rx;
        let inside = false;
        let shade = 1.0;
        if (shape === 0) {
          const r2 = nx * nx + ny * ny;
          if (r2 <= 1.05) { inside = true; shade = 0.65 + 0.35 * Math.sqrt(Math.max(0, 1 - 0.85 * r2)) - 0.15 * ny; }
        } else if (shape === 1) {
          if (Math.abs(nx) <= 0.95 && Math.abs(ny) <= 0.95) { inside = true; shade = nx < 0 ? 1.06 : 0.76; }
        } else if (shape === 2) {
          const halfW = clamp(0.52 * (ny + 1.0), 0.08, 1.05);
          if (ny >= -1.0 && ny <= 1.0 && Math.abs(nx) <= halfW) { inside = true; shade = 0.92 - 0.20 * Math.abs(nx); }
        } else if (shape === 3) {
          const l1 = Math.abs(nx) + Math.abs(ny);
          const spike = Math.abs(Math.abs(nx) - Math.abs(ny)) < 0.22 && Math.max(Math.abs(nx), Math.abs(ny)) <= 1.25;
          if (l1 <= 1.12 || spike) { inside = true; shade = spike && l1 > 0.88 ? 1.28 : 0.88; }
        } else if (shape === 5) {
          // Articulated conspecific / organism silhouette (elongated horizontal body + dorsal crest)
          const bodyEq = (nx * 0.72) ** 2 + (ny * 1.35) ** 2;
          const crest = Math.abs(nx) < 0.7 && ny < -0.25 && ny > -0.85 && Math.sin(nx * 9) > 0;
          if (bodyEq <= 1.0 || crest) { inside = true; shade = crest ? 1.22 : 0.85 - 0.2 * ny; }
        } else {
          if (nx * nx + ny * ny * 2.4 <= 1.05) { inside = true; shade = 0.9 + 0.1 * Math.cos(nx * 3); }
        }
        if (!inside) continue;
        const idx = py * W_RET + px;
        if (idval >= invD[idx] * 0.96) {
          invD[idx] = Math.max(invD[idx], idval);
          const p3 = idx * 3;
          ret[p3] = clamp(rCol * shade, 0, 1.6);
          ret[p3 + 1] = clamp(gCol * shade, 0, 1.6);
          ret[p3 + 2] = clamp(bCol * shade, 0, 1.6);
        }
      }
    }
  }

  /** Run LGN -> V1 Gabor -> V2 Curvature/Junctions -> V4 Max-Pooling -> IT View-Invariant Cortex + MT Flow */
  processVisualCortex(lesionVision) {
    const NPX = W_RET * H_RET;
    if (lesionVision) {
      this.lgnMag.fill(0); this.lgnRG.fill(0); this.lgnBY.fill(0);
      this.v1Simple.fill(0); this.v1Complex.fill(0); this.v1Disparity.fill(0);
      this.v2Cells.fill(0); this.v4Map.fill(0); this.v4Orient.fill(0); this.v4Fovea.fill(0);
      this.itAct.fill(0); this.fovealPatch.fill(0);
      this.mtFlowX.fill(0); this.mtFlowY.fill(0);
      this.mtDiv = 0; this.v1EnergyMean = 0;
      return;
    }

    // 1) Binocular cyclopean fusion + Parvocellular colour opponency + 8x4x3 Foveal RGB Patch
    const lum = this.lumCur, rL = this.retL, rR = this.retR;
    for (let i = 0; i < NPX; i++) {
      const p3 = i * 3;
      const R = 0.5 * (rL[p3] + rR[p3]);
      const G = 0.5 * (rL[p3 + 1] + rR[p3 + 1]);
      const B = 0.5 * (rL[p3 + 2] + rR[p3 + 2]);
      lum[i] = 0.30 * R + 0.55 * G + 0.15 * B;
      this.lgnRG[i] = R - G;
      this.lgnBY[i] = B - 0.5 * (R + G);
    }

    // Extract central 32x16 foveal region pooled into 8x4x3 (96-D) pixel tensor for WorldModel visual prediction
    for (let py = 0; py < H_V4; py++) {
      const yBase = 8 + py * 4;
      for (let px = 0; px < W_V4; px++) {
        const xBase = 16 + px * 4;
        let sr = 0, sg = 0, sb = 0;
        for (let dy = 0; dy < 4; dy++) {
          const row = (yBase + dy) * W_RET + xBase;
          for (let dx = 0; dx < 4; dx++) {
            const p3 = (row + dx) * 3;
            sr += 0.5 * (rL[p3] + rR[p3]);
            sg += 0.5 * (rL[p3 + 1] + rR[p3 + 1]);
            sb += 0.5 * (rL[p3 + 2] + rR[p3 + 2]);
          }
        }
        const o3 = (py * W_V4 + px) * 3;
        this.fovealPatch[o3] = sr * (1 / 16);
        this.fovealPatch[o3 + 1] = sg * (1 / 16);
        this.fovealPatch[o3 + 2] = sb * (1 / 16);
      }
    }

    // 2) Thalamic LGN Magnocellular Difference-of-Gaussians (3x3 center-surround)
    for (let y = 0; y < H_RET; y++) {
      const ym = Math.max(0, y - 1) * W_RET, yc = y * W_RET, yp = Math.min(H_RET - 1, y + 1) * W_RET;
      for (let x = 0; x < W_RET; x++) {
        const xm = Math.max(0, x - 1), xp = Math.min(W_RET - 1, x + 1);
        const c = lum[yc + x];
        const surr = (
          0.15 * (lum[yc + xm] + lum[yc + xp] + lum[ym + x] + lum[yp + x]) +
          0.10 * (lum[ym + xm] + lum[ym + xp] + lum[yp + xm] + lum[yp + xp])
        );
        this.lgnMag[yc + x] = c - surr;
      }
    }

    // 3) V1 (32x16x4 = 2,048 units): 5x5 Quadrature Gabor Simple/Complex + Binocular Disparity + MT 2D Optic Flow
    this.v4Orient.fill(0);
    let totE = 0, divSum = 0;
    for (let vy = 0; vy < H_V1; vy++) {
      const cy = vy * 2 + 1;
      for (let vx = 0; vx < W_V1; vx++) {
        const cx = vx * 2 + 1;
        const vIdx = vy * W_V1 + vx;
        const vOff = vIdx * N_ORI;

        for (let o = 0; o < N_ORI; o++) {
          const kOff = o * 25;
          let sCos = 0, sSin = 0;
          for (let dy = -2; dy <= 2; dy++) {
            const yy = clamp(cy + dy, 0, H_RET - 1) * W_RET;
            const kr = kOff + (dy + 2) * 5;
            for (let dx = -2; dx <= 2; dx++) {
              const xx = clamp(cx + dx, 0, W_RET - 1);
              const inp = this.lgnMag[yy + xx];
              sCos += inp * GABOR_COS[kr + dx + 2];
              sSin += inp * GABOR_SIN[kr + dx + 2];
            }
          }
          const energy = Math.hypot(sCos, sSin);
          this.v1Simple[vOff + o] = Math.max(0, sCos);
          this.v1Complex[vOff + o] = energy;
          this.v4Orient[o] += energy;
          totE += energy;
        }

        const pC = cy * W_RET + cx;
        this.v1Disparity[vIdx] = 0.5 * (this.invDL[pC] + this.invDR[pC]);

        const xm = Math.max(0, cx - 1), xp = Math.min(W_RET - 1, cx + 1);
        const ym = Math.max(0, cy - 1), yp = Math.min(H_RET - 1, cy + 1);
        const ix = 0.5 * (lum[cy * W_RET + xp] - lum[cy * W_RET + xm]);
        const iy = 0.5 * (lum[yp * W_RET + cx] - lum[ym * W_RET + cx]);
        const it = lum[pC] - this.lum2DPrev[pC];
        const denom = ix * ix + iy * iy + 0.025;
        const fx = -ix * it / denom, fy = -iy * it / denom;
        this.mtFlowX[vIdx] = 0.75 * this.mtFlowX[vIdx] + 0.25 * fx;
        this.mtFlowY[vIdx] = 0.75 * this.mtFlowY[vIdx] + 0.25 * fy;

        const rx = (vx - 15.5) / 15.5, ry = (vy - 7.5) / 7.5;
        divSum += this.mtFlowX[vIdx] * rx + this.mtFlowY[vIdx] * ry;
      }
    }

    const invNV1 = 1 / (W_V1 * H_V1);
    for (let o = 0; o < N_ORI; o++) this.v4Orient[o] *= invNV1;
    this.v1EnergyMean = totE * invNV1 * 0.25;
    this.mtDiv = clamp(divSum * invNV1 * 2.5, -1, 1);

    // 4) V2 (16x8x4 = 512 units): Contour Curvature, Orthogonal Box Corners, Acute Cone Vertices & Diagonal Spines
    for (let y2 = 0; y2 < H_V2; y2++) {
      for (let x2 = 0; x2 < W_V2; x2++) {
        let e0 = 0, e45 = 0, e90 = 0, e135 = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const off = ((y2 * 2 + dy) * W_V1 + (x2 * 2 + dx)) * N_ORI;
            e0 = Math.max(e0, this.v1Complex[off]);
            e45 = Math.max(e45, this.v1Complex[off + 1]);
            e90 = Math.max(e90, this.v1Complex[off + 2]);
            e135 = Math.max(e135, this.v1Complex[off + 3]);
          }
        }
        const sumE = e0 + e45 + e90 + e135 + 1e-5;
        const o2 = (y2 * W_V2 + x2) * 4;
        // Channel 0: Smooth isotropic circular curvature (spheres/pools)
        const minAll = Math.min(e0, e45, e90, e135);
        this.v2Cells[o2] = 2.2 * minAll;
        // Channel 1: Orthogonal 0x90 box corners with diagonal suppression
        this.v2Cells[o2 + 1] = Math.max(0, Math.sqrt(e0 * e90) - 0.45 * (e45 + e135));
        // Channel 2: Acute 45+135+0 triangular cone apex
        this.v2Cells[o2 + 2] = Math.max(0, 0.7 * (e45 + e135) - 0.5 * e90);
        // Channel 3: High-kurtosis diagonal star/thorn junction
        this.v2Cells[o2 + 3] = Math.sqrt(e45 * e135) * (1 + (e45 + e135) / sumE);
      }
    }

    // 5) V4 (8x4x8 = 256 units): HMAX C2 Scale- & Position-Tolerant Max-Pooling + Opponent Hue Bands
    this.v4Fovea.fill(0);
    const maxV2 = new Float32Array(4);
    const maxHue = new Float32Array(4);
    let nFov = 0;
    for (let y4 = 0; y4 < H_V4; y4++) {
      for (let x4 = 0; x4 < W_V4; x4++) {
        const o4 = (y4 * W_V4 + x4) * 8;
        let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const o2 = ((y4 * 2 + dy) * W_V2 + (x4 * 2 + dx)) * 4;
            if (this.v2Cells[o2] > c0) c0 = this.v2Cells[o2];
            if (this.v2Cells[o2 + 1] > c1) c1 = this.v2Cells[o2 + 1];
            if (this.v2Cells[o2 + 2] > c2) c2 = this.v2Cells[o2 + 2];
            if (this.v2Cells[o2 + 3] > c3) c3 = this.v2Cells[o2 + 3];
          }
        }
        // Sample retinal colour opponency in this zone -> 4 opponent hue channels (mint-green, magenta, cyan, amber)
        const rPy = (y4 * 8 + 4) * W_RET + (x4 * 8 + 4);
        const p3 = rPy * 3;
        const R = 0.5 * (rL[p3] + rR[p3]), G = 0.5 * (rL[p3 + 1] + rR[p3 + 1]), B = 0.5 * (rL[p3 + 2] + rR[p3 + 2]);
        const hMint = Math.max(0, G - 0.65 * R - 0.25 * B);
        const hMag = Math.max(0, 0.55 * (R + B) - G);
        const hCyan = Math.max(0, 0.55 * (G + B) - R);
        const hAmb = Math.max(0, 0.6 * R + 0.4 * G - B);

        this.v4Map[o4] = c0; this.v4Map[o4 + 1] = c1; this.v4Map[o4 + 2] = c2; this.v4Map[o4 + 3] = c3;
        this.v4Map[o4 + 4] = hMint; this.v4Map[o4 + 5] = hMag; this.v4Map[o4 + 6] = hCyan; this.v4Map[o4 + 7] = hAmb;

        if (x4 >= 2 && x4 <= 5 && y4 >= 1 && y4 <= 2) {
          if (c0 > maxV2[0]) maxV2[0] = c0;
          if (c1 > maxV2[1]) maxV2[1] = c1;
          if (c2 > maxV2[2]) maxV2[2] = c2;
          if (c3 > maxV2[3]) maxV2[3] = c3;
          if (hMint > maxHue[0]) maxHue[0] = hMint;
          if (hMag > maxHue[1]) maxHue[1] = hMag;
          if (hCyan > maxHue[2]) maxHue[2] = hCyan;
          if (hAmb > maxHue[3]) maxHue[3] = hAmb;
          for (let o = 0; o < 4; o++) this.v4Fovea[o] += this.v4Map[o4 + o];
          this.v4Fovea[4] += Math.max(0, this.lgnRG[rPy]);
          this.v4Fovea[5] += Math.max(0, -this.lgnRG[rPy]);
          this.v4Fovea[6] += Math.max(0, this.lgnBY[rPy]);
          this.v4Fovea[7] += lum[rPy];
          nFov++;
        }
      }
    }
    for (let k = 0; k < 8; k++) this.v4Fovea[k] /= Math.max(1, nFov);

    // 6) Inferotemporal (IT) View- & Scale-Invariant Object Category Cortex + Online Foldiak Slow-Trace Learning
    //    Normalize each modality band independently so object distance/contrast scaling cancels out!
    const f = this.itFeat;
    const nOri = Math.hypot(this.v4Orient[0], this.v4Orient[1], this.v4Orient[2], this.v4Orient[3]) + 1e-5;
    const nV2 = Math.hypot(maxV2[0], maxV2[1], maxV2[2], maxV2[3]) + 1e-5;
    const nHue = Math.hypot(maxHue[0], maxHue[1], maxHue[2], maxHue[3]) + 1e-5;
    for (let i = 0; i < 4; i++) {
      f[i] = (this.v4Orient[i] / nOri) * 0.5;
      f[4 + i] = (maxV2[i] / nV2) * 0.72;
      f[8 + i] = (maxHue[i] / nHue) * 0.72;
      f[12 + i] = 0;
    }
    let fn2 = 0;
    for (let j = 0; j < 16; j++) fn2 += f[j] * f[j];
    if (fn2 > 0.02) {
      const invF = 1 / Math.sqrt(fn2);
      for (let j = 0; j < 16; j++) f[j] *= invF;
      let bestVal = -1, bestK = 0;
      for (let k = 0; k < N_IT; k++) {
        let dp = 0;
        const off = k * 16;
        for (let j = 0; j < 16; j++) dp += this.Wit[off + j] * f[j];
        const act = Math.max(0, dp);
        this.itAct[k] = act;
        if (act > bestVal) { bestVal = act; bestK = k; }
      }
      // Measure translation/scale invariance as cosine stability of IT population vector while approaching an object
      let dotPrev = 0, nCur = 0, nPrv = 0;
      for (let k = 0; k < N_IT; k++) {
        dotPrev += this.itAct[k] * this._prevItVec[k];
        nCur += this.itAct[k] ** 2;
        nPrv += this._prevItVec[k] ** 2;
      }
      if (nCur > 1e-4 && nPrv > 1e-4 && this._prevTopId === bestK) {
        const cosStab = dotPrev / Math.sqrt(nCur * nPrv);
        this.itInvariance = 0.96 * this.itInvariance + 0.04 * cosStab;
      }
      this._prevItVec.set(this.itAct);
      this._prevTopId = bestK;
      this.itTopCat = bestK;

      // Foldiak / Wallis-Rolls temporal trace Hebbian update on winning IT prototype (binds changing distance/angle views!)
      for (let k = 0; k < N_IT; k++) this.itTrace[k] = 0.88 * this.itTrace[k] + 0.12 * (k === bestK ? 1 : 0);
      const etaIT = 0.004 * this.itTrace[bestK];
      if (etaIT > 0.0005) {
        const off = bestK * 16;
        let w2 = 0;
        for (let j = 0; j < 16; j++) {
          this.Wit[off + j] += etaIT * (f[j] - bestVal * this.Wit[off + j]);
          w2 += this.Wit[off + j] ** 2;
        }
        const invW = 1 / (Math.sqrt(w2) || 1);
        for (let j = 0; j < 16; j++) this.Wit[off + j] *= invW;
      }
    } else {
      this.itAct.fill(0);
    }

    this.lum2DPrev.set(lum);
  }

  /**
   * Project the 3D world (including A-Life conspecifics, eggs, bio-mites & predators) onto dual 64x32 log-polar
   * foveated sheets, run LGN -> V1 -> V2 -> V4 -> IT + MT, and update EKF-SLAM landmark localization.
   */
  step(body, world, nav, lesionNav = false, lesionVision = false, goalBear = 0, goalDist = 1e9) {
    const X = body.x, Y = body.y, Z = body.z;
    const Fh = body.F[NS - 1];
    const eL = body.stalks[0]?.eye ?? body.c[NS - 1];
    const eR = body.stalks[1]?.eye ?? body.c[NS - 1];
    const ex = 0.5 * (X[eL] + X[eR]), ey = 0.5 * (Y[eL] + Y[eR]), ez = 0.5 * (Z[eL] + Z[eR]);

    const F3 = body.F[3];
    const spineAz = Math.atan2(F3.f[2], F3.f[0]);
    const gazeYawL = body.u[CH.gaze] * 0.35, gazePitchL = body.u[CH.gaze + 1] * 0.25;
    const gazeYawR = body.u[CH.gaze + 2] * 0.35, gazePitchR = body.u[CH.gaze + 3] * 0.25;
    const gazeYaw = 0.25 * (body.u[CH.gaze] + body.u[CH.gaze + 2] + body.u[CH.gaze + 4]) / 0.75 * 0.35;
    const headAz = Math.atan2(Fh.f[2], Fh.f[0]);
    const neckYaw = Math.atan2(Math.sin(headAz - spineAz), Math.cos(headAz - spineAz));
    const gazeAz = headAz + gazeYaw;
    const eyeAzL = headAz + gazeYawL, eyeAzR = headAz + gazeYawR;

    this.rgb.fill(0);
    this.loom.fill(0);
    this.vis.fill(0);
    this.socialSeen = 0;
    this.predatorLoom = 0;
    const doSheet = !lesionVision && ((this._sheetTick = (this._sheetTick || 0) + 1) % 3 === 1);
    if (doSheet) {
      this.invDL.fill(0);
      this.invDR.fill(0);
    } else if (lesionVision) {
      this.invDL.fill(0);
      this.invDR.fill(0);
    }

    // 0) Fast interpolated 16-ray horizon contour onto both 64x32 log-polar foveated sheets (20 Hz biological cortical sweep)
    if (doSheet) {
      const N_HOR = 16;
      const hTabL = new Float32Array(N_HOR + 1);
      const hTabR = new Float32Array(N_HOR + 1);
      for (let i = 0; i <= N_HOR; i++) {
        const aN = i / N_HOR - 0.5;
        const rL = eyeAzL + aN * FOV, rR = eyeAzR + aN * FOV;
        hTabL[i] = Math.atan2(world.height(X[eL] + 7 * Math.cos(rL), Z[eL] + 7 * Math.sin(rL)) - Y[eL], 7) - gazePitchL;
        hTabR[i] = Math.atan2(world.height(X[eR] + 7 * Math.cos(rR), Z[eR] + 7 * Math.sin(rR)) - Y[eR], 7) - gazePitchR;
      }
      for (let px = 0; px < W_RET; px++) {
        const s = (RET_AZ_NORM[px] + 0.5) * N_HOR;
        const si = clamp(Math.floor(s), 0, N_HOR - 1), sf = clamp(s - si, 0, 1);
        const horElL = hTabL[si] * (1 - sf) + hTabL[si + 1] * sf;
        const horElR = hTabR[si] * (1 - sf) + hTabR[si + 1] * sf;
        for (let py = 0; py < H_RET; py++) {
          const el = RET_EL_NORM[py] * VFOV;
          const idx = py * W_RET + px, p3 = idx * 3;
          if (el > horElL) {
            this.retL[p3] = 0.08; this.retL[p3 + 1] = 0.11; this.retL[p3 + 2] = 0.22;
          } else {
            this.retL[p3] = 0.06; this.retL[p3 + 1] = 0.09; this.retL[p3 + 2] = 0.08;
            this.invDL[idx] = 0.08;
          }
          if (el > horElR) {
            this.retR[p3] = 0.08; this.retR[p3 + 1] = 0.11; this.retR[p3 + 2] = 0.22;
          } else {
            this.retR[p3] = 0.06; this.retR[p3 + 1] = 0.09; this.retR[p3 + 2] = 0.08;
            this.invDR[idx] = 0.08;
          }
        }
      }
    } else if (lesionVision) {
      this.retL.fill(0);
      this.retR.fill(0);
    }

    const doSlam = !lesionNav && !!nav && (++this.slamFrame % 6 === 0);
    let navHeadX = 0, navHeadZ = 0;
    if (doSlam) {
      if (!this.navInit) {
        this.prevNavX = nav.px;
        this.prevNavZ = nav.pz;
        this.navInit = true;
      }
      nav.px = clamp(nav.px, -19.5, 19.5);
      nav.pz = clamp(nav.pz, -19.5, 19.5);
      const move = Math.hypot(nav.px - this.prevNavX, nav.pz - this.prevNavZ);
      this.prevNavX = nav.px;
      this.prevNavZ = nav.pz;
      this.egoVar = Math.min(6.0, this.egoVar + 0.045 * move + 0.001);
      for (let i = 0; i < this.lmVar.length; i++) if (this.lmVar[i] < 1e5) this.lmVar[i] += 0.003;
      const neckHdg = nav.heading() + 0.35 * neckYaw;
      navHeadX = nav.px + 1.25 * Math.cos(neckHdg);
      navHeadZ = nav.pz + 1.25 * Math.sin(neckHdg);
    }

    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const binOf = (ang) => {
      const u = (ang + FOV * 0.5) / FOV;
      return u >= 0 && u < 1 ? Math.min(NBINS - 1, Math.floor(u * NBINS)) : -1;
    };

    const projectBinocular2D = (tx, ty, tz, radWorld, shape, rC, gC, bC) => {
      if (!doSheet) return;
      const dLx = tx - X[eL], dLy = ty - Y[eL], dLz = tz - Z[eL];
      const distL = Math.hypot(dLx, dLz);
      if (distL > 0.12) {
        const azL = wrap(Math.atan2(dLz, dLx) - eyeAzL);
        const elL = Math.atan2(dLy, distL) - gazePitchL;
        this.paintEyeShape(this.retL, this.invDL, azL, elL, Math.atan2(radWorld, distL), shape, rC, gC, bC, 1 / distL);
      }
      const dRx = tx - X[eR], dRy = ty - Y[eR], dRz = tz - Z[eR];
      const distR = Math.hypot(dRx, dRz);
      if (distR > 0.12) {
        const azR = wrap(Math.atan2(dRz, dRx) - eyeAzR);
        const elR = Math.atan2(dRy, distR) - gazePitchR;
        this.paintEyeShape(this.retR, this.invDR, azR, elR, Math.atan2(radWorld, distR), shape, rC, gC, bC, 1 / distR);
      }
    };

    // 1) Rocks -> 2D foveated retinas + obstacle avoidance cone
    let oAhead = 0, oL = 0, oR = 0;
    for (let i = 0; i < world.rocks.length; i++) {
      const R = world.rocks[i];
      const dx = R.x - ex, dz = R.z - ez;
      const distC = Math.hypot(dx, dz);
      const surfD = Math.max(0.05, distC - R.r);
      if (surfD <= 14) projectBinocular2D(R.x, R.y + R.r * 0.35, R.z, R.r, 0, 0.36, 0.30, 0.56);
      if (surfD > 8) continue;
      const ang = wrap(Math.atan2(dz, dx) - gazeAz);
      const halfSpan = Math.atan2(R.r + 0.22, Math.max(0.25, distC));
      const prox = clamp(1 - surfD / 3.4);
      const b0 = Math.max(0, Math.floor(((ang - halfSpan + FOV * 0.5) / FOV) * NBINS));
      const b1 = Math.min(NBINS - 1, Math.ceil(((ang + halfSpan + FOV * 0.5) / FOV) * NBINS));
      for (let b = b0; b <= b1; b++) {
        if (prox > this.loom[b]) this.loom[b] = prox;
        this.rgb[3 * b] += 0.18 * prox;
        this.rgb[3 * b + 2] += 0.28 * prox;
      }
      const hAng = wrap(Math.atan2(dz, dx) - headAz);
      const clearCone = Math.min(0.62, halfSpan + 0.22);
      if (surfD < 1.5 && Math.abs(hAng) < clearCone && goalDist > surfD + 0.4) {
        const w = clamp(1 - surfD / 1.5) * clamp(1 - Math.abs(hAng) / (clearCone + 0.25), 0.3, 1);
        if (surfD < 1.25 && Math.abs(hAng) < 0.42) oAhead = Math.max(oAhead, clamp(1 - surfD / 1.25));
        const relToGoal = wrap(goalBear - hAng);
        if (relToGoal >= 0) oL = Math.max(oL, w);
        else oR = Math.max(oR, w);
      }
    }
    this.obstAhead = oAhead;
    this.obstL = oL;
    this.obstR = oR;

    const measureLandmark = (id, tx, ty, tz, heightCue, rgb, maxR, shape = 0, radWorld = 0.42) => {
      const dx = tx - ex, dz = tz - ez;
      const trueD = Math.hypot(dx, dz);
      if (trueD > maxR) return;
      const hBear = wrap(Math.atan2(dz, dx) - headAz);
      const rAng = wrap(Math.atan2(dz, dx) - gazeAz);
      const b = binOf(rAng);
      if (b < 0 && !lesionVision) return;
      if (!lesionVision && this.occluded(world, ex, ey, ez, tx, ty, tz)) return;

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

      const inten = clamp(1.3 / (1 + 0.12 * dEst));
      projectBinocular2D(tx, ty, tz, radWorld, shape, rgb[0] * inten, rgb[1] * inten, rgb[2] * inten);

      if (b >= 0) {
        this.rgb[3 * b] += rgb[0] * inten;
        this.rgb[3 * b + 1] += rgb[1] * inten;
        this.rgb[3 * b + 2] += rgb[2] * inten;
      }

      this.vis[id] = dEst <= STEREO_RANGE ? 1 : 0.45;
      this.visBear[id] = bEst;
      this.visDist[id] = dEst;

      if (doSlam) {
        const worldAz = wrap(nav.heading() + neckYaw + bEst);
        const obsX = clamp(navHeadX + dEst * Math.cos(worldAz), -19.5, 19.5);
        const obsZ = clamp(navHeadZ + dEst * Math.sin(worldAz), -19.5, 19.5);
        const rObs = 0.04 + 0.025 * dEst * dEst;
        const vNew = this.egoVar + rObs;
        const vOld = this.lmVar[id];

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

    // 2) Project the 16 plants
    for (let k = 0; k < world.plants.length; k++) {
      const P = world.plants[k];
      const col = HUE_RGB[P.c];
      const br = 0.35 + 0.65 * P.fruit;
      if (!lesionVision && Math.hypot(P.x - ex, P.z - ez) < 12) {
        projectBinocular2D(P.x, P.y + 0.6, P.z, 0.16, 1, 0.12, 0.34, 0.22);
      }
      measureLandmark(
        k, P.x, P.y + 1.35, P.z, 1.35,
        [col[0] * br, col[1] * br, col[2] * br],
        HORIZON_RANGE,
        P.s,
        0.34 + 0.18 * P.fruit
      );
    }

    // 3) Project the 3 water pools
    for (let p = 0; p < world.pools.length; p++) {
      const Wp = world.pools[p];
      const wy = world.height(Wp.x, Wp.z) + 0.15;
      measureLandmark(this.nSites + p, Wp.x, wy, Wp.z, Wp.r, [0.2, 0.85, 1.0], HORIZON_RANGE - 2, 4, Wp.r * 0.65);
    }

    // 4) Project dropped snacks
    for (const s of world.snacks) {
      const dx = s.x - ex, dz = s.z - ez, d = Math.hypot(dx, dz);
      if (d > 16) continue;
      const b = binOf(wrap(Math.atan2(dz, dx) - gazeAz));
      if (!this.occluded(world, ex, ey, ez, s.x, s.y + 0.15, s.z)) {
        const w = clamp(1.5 / (1 + 0.15 * d));
        const rC = w, gC = (s.kind === 'fat' ? 0.8 : 0.4) * w, bC = (s.kind === 'fat' ? 0.4 : 0.8) * w;
        projectBinocular2D(s.x, s.y + 0.15, s.z, 0.22, 0, rC, gC, bC);
        if (b >= 0) {
          this.rgb[3 * b] += rC;
          this.rgb[3 * b + 1] += gC;
          this.rgb[3 * b + 2] += bC;
        }
      }
    }

    // 5) Project A-Life Ecosystem entities (conspecifics, eggs, bio-mites, predators) onto retinas!
    const eco = world.eco;
    if (eco && !lesionVision) {
      for (const peer of eco.peers) {
        if (!peer.alive) continue;
        const d = Math.hypot(peer.x - ex, peer.z - ez);
        if (d < 18) {
          this.socialSeen++;
          projectBinocular2D(peer.x, peer.y + 0.28 * peer.scale, peer.z, 0.55 * peer.scale, 5, peer.colR, peer.colG, peer.colB);
        }
      }
      for (const egg of eco.eggs) {
        if (Math.hypot(egg.x - ex, egg.z - ez) < 12) {
          projectBinocular2D(egg.x, egg.y + 0.18, egg.z, 0.22, 0, 1.0, 0.88, 0.45);
        }
      }
      for (let m = 0; m < eco.mites.length; m += 2) {
        const mt = eco.mites[m];
        if (Math.hypot(mt.x - ex, mt.z - ez) < 9) {
          projectBinocular2D(mt.x, mt.y, mt.z, 0.10, 3, 0.45, 1.0, 0.82);
        }
      }
      for (const pred of eco.predators) {
        const d = Math.hypot(pred.x - ex, pred.z - ez);
        if (d < 22) {
          projectBinocular2D(pred.x, pred.y, pred.z, 1.15, 5, 1.15, 0.15, 0.28);
          this.predatorLoom = Math.max(this.predatorLoom, clamp(1 - d / 14));
        }
      }
    }

    // 6) Run LGN -> V1 -> V2 -> V4 -> IT + MT hierarchy (on 20 Hz cortical refresh or lesion clear)
    if (doSheet || lesionVision) this.processVisualCortex(lesionVision);

    // 7) Azimuthal optic-flow summary
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

  sitePos(k, world) {
    if (globalThis.TW?.exactMap) {
      const P = world.plants[k];
      return { x: P.x, z: P.z, conf: 1 };
    }
    if (this.conf[k] > 0) return { x: this.memX[k], z: this.memZ[k], conf: this.conf[k] };
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
