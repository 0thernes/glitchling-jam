globalThis.TW = JSON.parse(process.env.TW || '{}');
// Pass 9: forced MOT turn command (fwd 1 + turnL or turnR = 1) for 12 s, seeds 1-4; mean yaw rate in the commanded direction (rad/s),
// with ventral-scale lift intact vs lesioned; also forward speed with no turn command.
import { Creature } from '../js/sim/creature.js';
function run(seed, mot, les) { const c = new Creature(seed); c.world.rocks = []; c.world.springs = []; c.lesion.learnMotor = true; c.lesion.scales = les; c.forceMot = mot;
  let prev = null, un = 0; const c0 = c.body.com(); for (let f = 0; f < 720; f++) { c.goal = null; c.race = null; c.step(); const F = c.body.F[3].f; const h = Math.atan2(F[2], F[0]); if (f > 120) { if (prev !== null) { let d = h - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; un += d; } prev = h; } }
  const c1 = c.body.com(); return { yaw: un / 10, v: Math.hypot(c1[0] - c0[0], c1[2] - c0[2]) / 12 }; }
for (const les of [false, true]) { const L = [], R = [], V = [];
  for (const s of [1, 2, 3, 4]) { L.push(run(s, [1, 1, 0, 0, 0, 0, 0, 0], les).yaw); R.push(run(s, [1, 0, 1, 0, 0, 0, 0, 0], les).yaw); V.push(run(s, [1, 0, 0, 0, 0, 0, 0, 0], les).v); }
  const m = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
  console.log(les ? 'scales LESIONED' : 'scales intact  ', 'turnL(sign-flipped)', m(L.map(x => -x)), 'turnR', m(R), 'fwd speed', m(V), JSON.stringify({ L: L.map(x => +(-x).toFixed(2)), R: R.map(x => +x.toFixed(2)) })); }
