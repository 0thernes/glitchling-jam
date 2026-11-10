// Symmetric travelling wave on the body alone (no brain): net yaw rate should be ~0. Args: zero|wave|legs [flat]
import { World } from '../js/sim/world.js'; import { Body, CH } from '../js/sim/body.js';
const mode = process.argv[2]; const r = [];
for (const seed of [1, 2, 3]) { const W = new World(seed); W.rocks = []; W.springs = []; if (process.argv[3] === 'flat') { W.height = () => 0; W.normal = () => [0, 1, 0]; } const B = new Body(W, 0, 0, seed);
  let prev = null, un = 0; for (let k = 0; k < 120 * 12; k++) { B.u.fill(0); const t = k / 120;
    if (mode !== 'zero') for (let s = 0; s < 6; s++) { const v = 0.8 * Math.sin(2 * Math.PI * t - s * 0.9); B.u[CH.long + s * 4 + 1] = v; B.u[CH.long + s * 4 + 3] = -v; }
    if (mode === 'legs') for (let l = 0; l < 4; l++) B.u[CH.leg + l * 2] = 0.6 * Math.sin(2 * Math.PI * t + (l & 1 ? Math.PI : 0));
    B.step(1 / 120); B.frames(); const F = B.F[3].f; const h = Math.atan2(F[2], F[0]); if (prev !== null) { let d = h - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; un += d; } prev = h; }
  r.push(+(un / 12).toFixed(2)); } console.log(mode, process.argv[3] || '', JSON.stringify(r));
