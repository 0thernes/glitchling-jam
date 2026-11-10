// Fitness of a motor genome (used by evolve_genome.mjs; also runnable alone: node test/genome_eval.mjs hand|starter [seeds]).
// Per seed: three 10-s trials with a forced MOT command (forward; forward+turn-left; forward+turn-right) on flat ground (rocks and
// springs removed, motor learning frozen), plus one righting trial (body flipped onto its back, up to 8 s).
// Measures forward speed (travel along the body's own heading, per 0.5 s; sideways travel is penalised), yaw rate in the commanded direction, upright fraction, time to right.
import { Creature } from '../js/sim/creature.js';
export function evalGenome(genome, seeds = [1, 2], secs = 10) { const out = { v: 0, side: 0, yL: 0, yR: 0, yF: 0, up: 0, rt: 0, n: 0 };
  for (const seed of seeds) { globalThis.TW = { genome, brain: globalThis.EVAL_BRAIN };
    for (const [name, mot] of [['F', [1, 0, 0, 0, 0, 0, 0, 0]], ['L', [1, 1, 0, 0, 0, 0, 0, 0]], ['R', [1, 0, 1, 0, 0, 0, 0, 0]]]) { const c = new Creature(seed); c.world.rocks = []; c.world.springs = []; c.lesion.learnMotor = true; c.forceMot = mot;
      let prev = null, un = 0, up = 0, c0 = null, fwd = 0, side = 0, pc = null; const N = secs * 60; for (let f = 0; f < N; f++) { c.goal = null; c.race = null; c.step(); const F = c.body.F[3]; up += F.u[1]; if (f === 60) c0 = c.body.com(); if (f >= 60) { const h = Math.atan2(F.f[2], F.f[0]); if (prev !== null) { let d = h - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; un += d; } prev = h;
        if (f % 30 === 0) { const p = c.body.com(); if (pc) { const dx = p[0] - pc[0], dz = p[2] - pc[2]; fwd += dx * F.f[0] + dz * F.f[2]; side += Math.abs(dx * F.s[0] + dz * F.s[2]); } pc = p; } /* travel along / across the body's own heading, per 0.5 s */ } }
      const c1 = c.body.com(); const T = secs - 1; const yaw = un / T; out.up += up / N; out.n++;
      if (name === 'F') { out.v += fwd / T; out.side += side / T; out.yF += Math.abs(yaw); } else if (name === 'L') out.yL += -yaw; else out.yR += yaw; }
    { const c = new Creature(seed); c.world.rocks = []; c.world.springs = []; c.lesion.learnMotor = true; for (let f = 0; f < 90; f++) c.step(); const B = c.body, com = B.com(); const f = B.F[3].f; const n = Math.hypot(f[0], f[2]); const ax = [f[0] / n, 0, f[2] / n];
      const rot = (X, Y, Z) => { const dx = X - com[0], dy = Y - com[1], dz = Z - com[2]; const al = dx * ax[0] + dz * ax[2]; const px = dx - al * ax[0], pz = dz - al * ax[2]; return [com[0] + al * ax[0] - px, com[1] - dy + 0.4, com[2] + al * ax[2] - pz]; };
      for (let i = 0; i < B.n; i++) { let p = rot(B.x[i], B.y[i], B.z[i]); B.x[i] = p[0]; B.y[i] = p[1]; B.z[i] = p[2]; p = rot(B.ox[i], B.oy[i], B.oz[i]); B.ox[i] = p[0]; B.oy[i] = p[1]; B.oz[i] = p[2]; }
      let t = 8; for (let k = 0; k < 480; k++) { c.step(); if (k > 30 && B.F[3].u[1] > 0.7) { t = k / 60; break; } } out.rt += t; } }
  const S = seeds.length; for (const k of ['v', 'side', 'yL', 'yR', 'yF', 'rt']) out[k] /= S; out.up /= out.n; delete out.n;
  out.fit = 2 * out.v - 1 * out.side + 0.25 * Math.min(4, out.yL + out.yR) + 0.7 * Math.min(1.8, out.yL, out.yR) + 0.6 * Math.min(out.up, 0.92) - 1.0 * Math.max(0, 0.85 - out.up) - 0.3 * out.yF - 0.04 * out.rt;
  return out; }
if (process.argv[1] && process.argv[1].endsWith('genome_eval.mjs')) { const { HAND } = await import('../js/sim/genome.js'); const { STARTER } = await import('../js/sim/starter_genome.js'); const which = process.argv[2] || 'hand';
  const g = which === 'hand' ? HAND : which === 'starter' ? STARTER : JSON.parse(which); const seeds = (process.argv[3] || '1,2').split(',').map(Number); const r = evalGenome(g, seeds);
  console.log(which.slice(0, 20), 'seeds', seeds.join(','), Object.entries(r).map(([k, v]) => `${k} ${v.toFixed(3)}`).join('  ')); }
