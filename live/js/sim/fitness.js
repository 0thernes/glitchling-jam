// Full motor + synergy + steering genome fitness, shared by offline CMA-ES (test/evolve_genome.mjs) and in-page lineage evolution (js/sim/lineage_worker.js).
// Per seed: forced MOT trials (forward; forward+turn-left; forward+turn-right; plus rough-ground alternating zigzag when ROUGH),
// one flipped-body righting trial (up to 8 s), and — when opts.steer is enabled — an autonomous closed-loop rough-ground goal-homing trial
// that scores all 20 sense->MOT steering, boulder-avoidance and postural-gating genes alongside the 58 motor/synergy genes.
import { Creature } from './creature.js';

export function evalGenome(genome, seeds = [1, 2], secs = 10, opts = {}) {
  const ROUGH = opts.rough ?? !!globalThis.EVAL_ROUGH;
  const STEER = opts.steer ?? false;
  const out = { v: 0, side: 0, yL: 0, yR: 0, yF: 0, up: 0, rt: 0, n: 0, z: 0, upZ: 0, goal: 0, upG: 0 };

  for (const seed of seeds) {
    globalThis.TW = { genome, brain: globalThis.EVAL_BRAIN, noBabble: STEER ? true : undefined };
    const trials = [
      ['F', [1, 0, 0, 0, 0, 0, 0, 0]],
      ['L', [1, 1, 0, 0, 0, 0, 0, 0]],
      ['R', [1, 0, 1, 0, 0, 0, 0, 0]],
      ...(ROUGH ? [['Z', [1, 0, 0, 0, 0, 0, 0, 0]]] : []),
    ];
    for (const [name, mot] of trials) {
      const c = new Creature(seed);
      if (!ROUGH) { c.world.rocks = []; c.world.springs = []; }
      c.lesion.learnMotor = true;
      c.forceMot = mot;
      let prev = null, un = 0, up = 0, c0 = null, fwd = 0, side = 0, pc = null;
      const N = secs * 60;
      for (let f = 0; f < N; f++) {
        c.goal = null; c.race = null;
        if (name === 'Z') {
          const L = Math.floor(f / 90) % 2 === 0;
          c.forceMot = [1, L ? 0.7 : 0, L ? 0 : 0.7, 0, 0, 0, 0, 0];
        }
        c.step();
        const F = c.body.F[3];
        up += F.u[1];
        if (f === 60) c0 = c.body.com();
        if (f >= 60) {
          const h = Math.atan2(F.f[2], F.f[0]);
          if (prev !== null) {
            let d = h - prev;
            if (d > Math.PI) d -= 2 * Math.PI;
            if (d < -Math.PI) d += 2 * Math.PI;
            un += d;
          }
          prev = h;
          if (f % 30 === 0) {
            const p = c.body.com();
            if (pc) {
              const dx = p[0] - pc[0], dz = p[2] - pc[2];
              fwd += dx * F.f[0] + dz * F.f[2];
              side += Math.abs(dx * F.s[0] + dz * F.s[2]);
            }
            pc = p;
          }
        }
      }
      const c1 = c.body.com();
      const T = Math.max(1, secs - 1);
      const yaw = un / T;
      out.up += up / N;
      out.n++;
      if (name === 'F') { out.v += fwd / T; out.side += side / T; out.yF += Math.abs(yaw); }
      else if (name === 'Z') { out.z += Math.hypot(c1[0] - c0[0], c1[2] - c0[2]) / T; out.upZ += up / N; }
      else if (name === 'L') out.yL += -yaw;
      else out.yR += yaw;
    }

    // Flipped-body vestibular righting trial
    {
      const c = new Creature(seed);
      if (!ROUGH) { c.world.rocks = []; c.world.springs = []; }
      c.lesion.learnMotor = true;
      for (let f = 0; f < 90; f++) c.step();
      const B = c.body, com = B.com();
      const f = B.F[3].f, n = Math.hypot(f[0], f[2]) || 1, ax = [f[0] / n, 0, f[2] / n];
      const rot = (X, Y, Z) => {
        const dx = X - com[0], dy = Y - com[1], dz = Z - com[2];
        const al = dx * ax[0] + dz * ax[2], px = dx - al * ax[0], pz = dz - al * ax[2];
        return [com[0] + al * ax[0] - px, com[1] - dy + 0.4, com[2] + al * ax[2] - pz];
      };
      for (let i = 0; i < B.n; i++) {
        let p = rot(B.x[i], B.y[i], B.z[i]); B.x[i] = p[0]; B.y[i] = p[1]; B.z[i] = p[2];
        p = rot(B.ox[i], B.oy[i], B.oz[i]); B.ox[i] = p[0]; B.oy[i] = p[1]; B.oz[i] = p[2];
      }
      let t = 8;
      for (let k = 0; k < 480; k++) {
        c.step();
        if (k > 30 && B.F[3].u[1] > 0.7) { t = k / 60; break; }
      }
      out.rt += t;
    }

    // Closed-loop autonomous goal-homing trial (scores STEER_GENES + rough-terrain posture)
    if (STEER) {
      const c = new Creature(seed);
      c.lesion.learnMotor = true;
      for (let f = 0; f < 30; f++) c.step();
      const hd = c.body.head();
      const cand = c.world.plants
        .map((p) => ({ k: p.k, d: Math.hypot(p.x - hd[0], p.z - hd[2]) }))
        .filter((q) => q.d >= 4.0 && q.d <= 9.0)
        .sort((a, b) => a.d - b.d);
      if (cand.length) {
        const k = cand[0].k, pl = c.world.plants[k], d0 = cand[0].d;
        let dmin = d0, tArr = null, upG = 0;
        const NG = Math.max(360, secs * 75);
        for (let f = 0; f < NG; f++) {
          if (!c.goal || c.goal.k !== k) { c.goal = { type: 'site', k, chosen: k, since: c.t }; c.race = null; }
          c.step();
          upG += c.body.F[3].u[1];
          const h = c.body.head(), d = Math.hypot(pl.x - h[0], pl.z - h[2]);
          if (d < dmin) dmin = d;
          if (d < 1.3) { tArr = f / 60; break; }
        }
        const stepsDone = tArr !== null ? Math.max(1, Math.round(tArr * 60)) : NG;
        out.goal += tArr !== null ? 1.0 + 0.5 * (NG / 60 - tArr) / (NG / 60) : 0.85 * Math.max(0, (d0 - dmin) / d0);
        out.upG += upG / stepsDone;
      } else {
        out.upG += 0.85;
      }
    }
  }

  const S = seeds.length;
  for (const k of ['v', 'side', 'yL', 'yR', 'yF', 'rt', 'z', 'upZ', 'goal', 'upG']) out[k] /= S;
  out.up /= out.n;
  delete out.n;

  out.fit =
    2 * out.v -
    1 * out.side +
    0.25 * Math.min(4, out.yL + out.yR) +
    0.7 * Math.min(1.8, out.yL, out.yR) +
    0.6 * Math.min(out.up, 0.92) -
    1.0 * Math.max(0, 0.85 - out.up) -
    0.3 * out.yF -
    0.04 * out.rt;
  if (ROUGH) {
    out.fit +=
      1.5 * out.z +
      1.5 * Math.min(out.up, 0.95) -
      3.0 * Math.max(0, 0.85 - out.up) -
      2.0 * Math.max(0, 0.85 - out.upZ);
  }
  if (STEER) {
    out.fit += 1.4 * out.goal - 2.0 * Math.max(0, 0.85 - out.upG);
  }
  if (!STEER) { delete out.goal; delete out.upG; }
  return out;
}
