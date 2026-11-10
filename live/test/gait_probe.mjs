// Physics-only probe (TEST ONLY - the creature never uses this): drives the muscles with a hand-written travelling wave
// to measure what the body does mechanically (forward speed, uprightness, yaw for a left/right bias).
import { World } from '../js/sim/world.js'; import { Body, CH } from '../js/sim/body.js';
export function run(phi, bias, amp = 1, freq = 1.4, seed = 3) { const W = new World(seed); W.rocks = []; W.springs = []; const B = new Body(W, 0, 0, 0); const dt = 1 / 120; let vfs = 0, ups = 0, yaw = 0, prev = null, n = 0;
 for (let s = 0; s < 120 * 12; s++) { const t = s * dt; for (let i = 0; i < 6; i++) { const ph = 2 * Math.PI * freq * t + i * phi; B.u[CH.long + i * 4 + 1] = amp * Math.sin(ph) + bias; B.u[CH.long + i * 4 + 3] = -amp * Math.sin(ph) - bias; }
  for (let l = 0; l < 4; l++) { const side = l % 2 ? Math.PI : 0; const seg = l < 2 ? 1 : 3; const ph = 2 * Math.PI * freq * t + seg * phi + side; B.u[CH.leg + l * 2] = Math.sin(ph); B.u[CH.legGrip + l] = -Math.cos(ph); B.u[CH.leg + l * 2 + 1] = 0.6 * Math.cos(ph); }
  const pc = B.com(); B.step(dt); const nc = B.com(); if (s > 240) { const F = B.F[3].f; vfs += ((nc[0] - pc[0]) * F[0] + (nc[2] - pc[2]) * F[2]) * 120; ups += B.F[3].u[1]; const a = Math.atan2(F[2], F[0]); if (prev !== null) { let d = a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; yaw += d; } prev = a; n++; } }
 return { vf: +(vfs / n).toFixed(3), up: +(ups / n).toFixed(2), yaw: +((yaw / n) * 120).toFixed(2) }; }
for (const b of [0, 0.4, -0.4]) console.log('bias', b, JSON.stringify([1, 2, 3].map((sd) => run(-1.05, b, 0.5, 1.4, sd))));
