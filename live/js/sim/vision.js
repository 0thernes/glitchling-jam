// 2D Binocular Retinotopic Visual Pathway (Retina -> LGN -> V1 Gabor Simple/Complex Columns -> V4 Ventral & MT Dorsal) + EKF-SLAM.
// Upgrades the 1D 32-ommatidium ring into a full image-forming retinotopic hierarchy:
//  1) Dual 24x12 2D binocular photoreceptor sheets (left & right stalked eyes = 576 RGB + inverse-depth receptors, 260x110 deg FOV)
//     forming true 2D (azimuth x elevation) retinal images of sky, terrain horizon contours, 3D rocks, pools, snacks, and the 4
//     distinct 3D plant crown shapes (sphere, cube, cone, thorny octahedron) with per-pixel depth buffering and 3D ray occlusion.
//  2) Thalamic LGN layer (24x12): magnocellular Difference-of-Gaussians (DoG) on-center/off-surround contrast and parvocellular
//     R-G and B-Y double-opponent chromatic maps.
//  3) Primary Visual Cortex V1 (12x6x4 hypercolumns): 5x5 quadrature (cos/sin) 2D Gabor filter bank at 0, 45, 90, 135 deg driving
//     phase-sensitive V1 Simple cells, phase-invariant Adelson-Bergen V1 Complex energy cells, and binocular disparity cells.
//  4) Ventral V4 form+color descriptor (foveal orientation + chromatic opponent vector) & Dorsal MT 2D spatio-temporal optic flow
//     (vx, vy, radial expansion divergence) + Hippocampal EKF-SLAM landmark localization and loop closure.
import { clamp, gauss, mulberry } from './util.js';
import { NS, CH } from './body.js';

export const NBINS = 32;
export const W_RET = 24;
export const H_RET = 12;
export const W_V1 = 12;
export const H_V1 = 6;
export const N_ORI = 4; // 0, 45, 90, 135 deg
export const FOV = (260 * Math.PI) / 180;      // horizontal binocular field (-130..+130 deg)
export const VFOV = (110 * Math.PI) / 180;     // vertical elevation field (-55..+55 deg)
export const STEREO_RANGE = 9.0;               // high-acuity binocular tracking range
export const HORIZON_RANGE = 26;               // coarse tall-landmark horizon visibility when unoccluded

const HUE_RGB = [
  [0.22, 1.0, 0.62],
  [1.0, 0.24, 0.94],
  [0.24, 0.97, 1.0],
  [1.0, 0.69, 0.18],
];

// Precompute 4-orientation 5x5 quadrature (even cos / odd sin) zero-DC 2D Gabor kernels once at module load
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
      GABOR_COS[off + i] -= meanC; // strict zero-DC so uniform sky/ground elicits zero V1 edge response
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

    // 2D Binocular Retinotopic Photoreceptor Sheets (24 x 12 per eye = 576 total receptors)
    const NPX = W_RET * H_RET;
    this.retL = new Float32Array(NPX * 3);
    this.retR = new Float32Array(NPX * 3);
    this.invDL = new Float32Array(NPX); // z-buffer inverse depth 1/d for Left eye
    this.invDR = new Float32Array(NPX); // z-buffer inverse depth 1/d for Right eye

    // Thalamic LGN Center-Surround (DoG) & Parvocellular Color-Opponent Maps (24 x 12 cyclopean/fused)
    this.lumCur = new Float32Array(NPX);
    this.lum2DPrev = new Float32Array(NPX);
    this.lgnMag = new Float32Array(NPX); // Magnocellular on-center / off-surround DoG
    this.lgnRG = new Float32Array(NPX);  // Parvocellular R - G opponent
    this.lgnBY = new Float32Array(NPX);  // Parvocellular B - (R+G)/2 opponent

    // Primary Visual Cortex V1 (12 x 6 x 4 orientation hypercolumns)
    const NV1 = W_V1 * H_V1;
    this.v1Simple = new Float32Array(NV1 * N_ORI);  // Phase-sensitive even Gabor simple cells
    this.v1Complex = new Float32Array(NV1 * N_ORI); // Phase-invariant quadrature Gabor energy complex cells
    this.v1Disparity = new Float32Array(NV1);       // Binocular stereo disparity map across 12x6 field

    // Ventral V4 shape/color representation & Dorsal MT 2D optic flow
    this.v4Orient = new Float32Array(N_ORI);        // Global pooled orientation spectrum [0, 45, 90, 135 deg]
    this.v4Fovea = new Float32Array(8);             // Foveal 4-orientation + 4-color form vector
    this.mtFlowX = new Float32Array(NV1);           // Horizontal optic flow vx
    this.mtFlowY = new Float32Array(NV1);           // Vertical optic flow vy
    this.mtDiv = 0;                                 // Dorsal radial expansion divergence (2D looming)
    this.v1EnergyMean = 0;

    // Backward-compatible 32-bin azimuthal summary for downstream motor/HUD consumers
    this.rgb = new Float32Array(NBINS * 3);
    this.loom = new Float32Array(NBINS);
    this.lumPrev = new Float32Array(NBINS);
    this.flow = new Float32Array(NBINS);

    // Learned hippocampal landmark map (sites 0..15, pools 16..18) with EKF-SLAM variances
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
  }

  /** Check whether a 3D ray from eye E to target T is blocked by any rock sphere or a terrain ridge */
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

  /** Rasterize a 3D object silhouette onto a single 24x12 2D eye sheet with z-buffer occlusion */
  paintEyeShape(ret, invD, az, el, angRad, shape, rCol, gCol, bCol, idval) {
    const uC = ((az + FOV * 0.5) / FOV) * W_RET;
    const vC = ((0.5 * VFOV - el) / VFOV) * H_RET; // v=0 top (+el), v=H_RET-1 bottom (-el)
    if (uC < -3 || uC >= W_RET + 3 || vC < -3 || vC >= H_RET + 3) return;
    const rx = Math.max(0.55, (angRad / FOV) * W_RET);
    const ry = Math.max(0.55, (angRad / VFOV) * H_RET);
    const x0 = Math.max(0, Math.floor(uC - rx - 0.6)), x1 = Math.min(W_RET - 1, Math.ceil(uC + rx + 0.6));
    const y0 = Math.max(0, Math.floor(vC - ry - 0.6)), y1 = Math.min(H_RET - 1, Math.ceil(vC + ry + 0.6));

    for (let py = y0; py <= y1; py++) {
      const ny = (py + 0.5 - vC) / ry; // [-1..+1], negative = upper half
      for (let px = x0; px <= x1; px++) {
        const nx = (px + 0.5 - uC) / rx;
        let inside = false;
        let shade = 1.0;
        if (shape === 0) {
          // Sphere: smooth circular disc with 3D Lambertian normal shading
          const r2 = nx * nx + ny * ny;
          if (r2 <= 1.05) { inside = true; shade = 0.65 + 0.35 * Math.sqrt(Math.max(0, 1 - 0.85 * r2)) - 0.15 * ny; }
        } else if (shape === 1) {
          // Box / Cube: crisp horizontal & vertical edges (excites 0 & 90 deg V1 Gabor columns!)
          if (Math.abs(nx) <= 0.95 && Math.abs(ny) <= 0.95) { inside = true; shade = nx < 0 ? 1.05 : 0.78; }
        } else if (shape === 2) {
          // Cone: upward-pointing triangular silhouette (excites 45 & 135 deg V1 Gabor columns!)
          const halfW = clamp(0.52 * (ny + 1.0), 0.08, 1.05);
          if (ny >= -1.0 && ny <= 1.0 && Math.abs(nx) <= halfW) { inside = true; shade = 0.9 - 0.18 * Math.abs(nx); }
        } else if (shape === 3) {
          // Thorny Octahedron: diamond + diagonal spine cross (strong high-spatial-frequency diagonal energy!)
          const l1 = Math.abs(nx) + Math.abs(ny);
          const spike = Math.abs(Math.abs(nx) - Math.abs(ny)) < 0.24 && Math.max(Math.abs(nx), Math.abs(ny)) <= 1.25;
          if (l1 <= 1.12 || spike) { inside = true; shade = spike && l1 > 0.9 ? 1.25 : 0.88; }
        } else {
          // Flat horizontal pool ellipse
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

  /** Run LGN center-surround + V1 2D Gabor filter bank + V4 form + MT 2D optic flow on the binocular retinal images */
  processVisualCortex(lesionVision) {
    const NPX = W_RET * H_RET;
    if (lesionVision) {
      this.lgnMag.fill(0); this.lgnRG.fill(0); this.lgnBY.fill(0);
      this.v1Simple.fill(0); this.v1Complex.fill(0); this.v1Disparity.fill(0);
      this.v4Orient.fill(0); this.v4Fovea.fill(0);
      this.mtFlowX.fill(0); this.mtFlowY.fill(0);
      this.mtDiv = 0; this.v1EnergyMean = 0;
      return;
    }

    // 1) Binocular cyclopean fusion & Parvocellular chromatic opponency (R-G, B-Y)
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

    // 3) Cortical V1 5x5 Quadrature Gabor Orientation Columns (stride 2 -> 12x6 hypercolumns x 4 orientations)
    //    + Binocular stereo disparity + Dorsal MT 2D Lucas-Kanade / Reichardt optic flow
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

        // Binocular disparity cell: local Left vs Right inverse-depth / horizontal shift contrast
        const pC = cy * W_RET + cx;
        this.v1Disparity[vIdx] = 0.5 * (this.invDL[pC] + this.invDR[pC]);

        // MT 2D spatio-temporal gradient optic flow: Ix*vx + Iy*vy + It = 0 (regularized per hypercolumn)
        const xm = Math.max(0, cx - 1), xp = Math.min(W_RET - 1, cx + 1);
        const ym = Math.max(0, cy - 1), yp = Math.min(H_RET - 1, cy + 1);
        const ix = 0.5 * (lum[cy * W_RET + xp] - lum[cy * W_RET + xm]);
        const iy = 0.5 * (lum[yp * W_RET + cx] - lum[ym * W_RET + cx]);
        const it = lum[pC] - this.lum2DPrev[pC];
        const denom = ix * ix + iy * iy + 0.025;
        const fx = -ix * it / denom, fy = -iy * it / denom;
        this.mtFlowX[vIdx] = 0.75 * this.mtFlowX[vIdx] + 0.25 * fx;
        this.mtFlowY[vIdx] = 0.75 * this.mtFlowY[vIdx] + 0.25 * fy;

        // Radial expansion divergence from foveal center (5.5, 2.5) -> true 2D dorsal looming signal
        const rx = (vx - 5.5) / 5.5, ry = (vy - 2.5) / 2.5;
        divSum += this.mtFlowX[vIdx] * rx + this.mtFlowY[vIdx] * ry;
      }
    }

    const invNV1 = 1 / (W_V1 * H_V1);
    for (let o = 0; o < N_ORI; o++) this.v4Orient[o] *= invNV1;
    this.v1EnergyMean = totE * invNV1 * 0.25;
    this.mtDiv = clamp(divSum * invNV1 * 2.5, -1, 1);

    // 4) Ventral V4 Foveal Shape + Color Descriptor (central 4x4 V1 hypercolumns: vx in 4..7, vy in 1..4)
    this.v4Fovea.fill(0);
    let nFov = 0;
    for (let vy = 1; vy <= 4; vy++) {
      for (let vx = 4; vx <= 7; vx++) {
        const vIdx = vy * W_V1 + vx;
        for (let o = 0; o < N_ORI; o++) this.v4Fovea[o] += this.v1Complex[vIdx * N_ORI + o];
        const pC = (vy * 2 + 1) * W_RET + (vx * 2 + 1);
        this.v4Fovea[4] += Math.max(0, this.lgnRG[pC]);
        this.v4Fovea[5] += Math.max(0, -this.lgnRG[pC]);
        this.v4Fovea[6] += Math.max(0, this.lgnBY[pC]);
        this.v4Fovea[7] += lum[pC];
        nFov++;
      }
    }
    for (let k = 0; k < 8; k++) this.v4Fovea[k] /= Math.max(1, nFov);
    this.lum2DPrev.set(lum);
  }

  /**
   * Project the 3D world onto the dual 24x12 binocular retinotopic sheets, run LGN -> V1 Gabor -> V4/MT processing,
   * estimate stereo + elevation depth, and update the hippocampal EKF-SLAM landmark map & loop closure.
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
    this.invDL.fill(0);
    this.invDR.fill(0);

    // 0) Render 2D sky + terrain horizon silhouette onto both 24x12 photoreceptor sheets
    if (!lesionVision) {
      for (let px = 0; px < W_RET; px++) {
        const uNorm = (px + 0.5) / W_RET - 0.5;
        const rayAzL = eyeAzL + uNorm * FOV, rayAzR = eyeAzR + uNorm * FOV;
        // Sample terrain ridge elevation at 7 u ahead along each column's ray to form a true 2D horizon contour
        const hL = world.height(X[eL] + 7 * Math.cos(rayAzL), Z[eL] + 7 * Math.sin(rayAzL));
        const hR = world.height(X[eR] + 7 * Math.cos(rayAzR), Z[eR] + 7 * Math.sin(rayAzR));
        const horElL = Math.atan2(hL - Y[eL], 7) - gazePitchL;
        const horElR = Math.atan2(hR - Y[eR], 7) - gazePitchR;
        for (let py = 0; py < H_RET; py++) {
          const el = (0.5 - (py + 0.5) / H_RET) * VFOV;
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
    } else {
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

    // Helper: project a 3D world object onto both Left & Right 24x12 2D retinas from their true 3D eye coordinates
    const projectBinocular2D = (tx, ty, tz, radWorld, shape, rC, gC, bC) => {
      if (lesionVision) return;
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

    // 1) Rocks -> 2D binocular retinal spheres + looming / obstacle map (horizon-stabilised + goal-tangent bypass)
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

    // Helper: binocular + angular-size depth measurement + 2D retinal projection + EKF-SLAM update
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

    // 2) Project the 16 plants with their 3D stem + distinct geometric crown shape (P.s = 0..3)
    for (let k = 0; k < world.plants.length; k++) {
      const P = world.plants[k];
      const col = HUE_RGB[P.c];
      const br = 0.35 + 0.65 * P.fruit;
      // Paint vertical green stem on 2D retinas when within 12 u (drives 90-deg vertical V1 orientation columns)
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

    // 3) Project the 3 water pools (shimmering horizontal ellipse, shape = 4)
    for (let p = 0; p < world.pools.length; p++) {
      const Wp = world.pools[p];
      const wy = world.height(Wp.x, Wp.z) + 0.15;
      measureLandmark(this.nSites + p, Wp.x, wy, Wp.z, Wp.r, [0.2, 0.85, 1.0], HORIZON_RANGE - 2, 4, Wp.r * 0.65);
    }

    // 4) Project dropped snacks onto both 2D retinas and azimuthal summary
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

    // 5) Run LGN -> V1 Gabor Simple/Complex Columns -> V4 form -> MT 2D optic flow
    this.processVisualCortex(lesionVision);

    // 6) Azimuthal optic-flow summary combined with dorsal MT flow magnitude
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
