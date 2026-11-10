// physics sanity: does a lateral travelling wave (hand-written, TEST ONLY - never used by the creature) propel the body?
import { World } from '../js/sim/world.js'; import { Body, CH, NS } from '../js/sim/body.js';
const W = new World(3); W.rocks = []; W.springs = []; const B = new Body(W, 0, 0, 0); const dt = 1 / 120;
const c0 = B.com(); let t0 = performance.now();
for (let s = 0; s < 120 * 10; s++) { const t = s * dt; for (let i = 0; i < 6; i++) { const ph = 2 * Math.PI * (1.2 * t) + i * 0.9; B.u[CH.long + i * 4 + 1] = Math.sin(ph); B.u[CH.long + i * 4 + 3] = -Math.sin(ph); }
  for (let l = 0; l < 4; l++) { B.u[CH.leg + l * 2] = Math.sin(2 * Math.PI * 1.2 * t + l); B.u[CH.legGrip + l] = Math.cos(2 * Math.PI * 1.2 * t + l); }
  B.step(dt); if (s % 240 === 0) { B.curvature(); console.log(s, B.com().map(v => v.toFixed(2)).join(','), 'curvL', [...B.curvL].map(v => v.toFixed(2)).join(' ')); } }
const c1 = B.com(); console.log('disp', (c1[0] - c0[0]).toFixed(2), (c1[2] - c0[2]).toFixed(2), 'y', c1[1].toFixed(2), 'ms', (performance.now() - t0).toFixed(0), 'n', B.n, 'cons', B.cons.length);
