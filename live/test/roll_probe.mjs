// Body-only probe: lay the body on its side, hold a static/oscillating muscle pattern, measure final up-vector y.
import { World } from '../js/sim/world.js'; import { Body, CH, NS } from '../js/sim/body.js';
const groups = { dLeg: [], uLeg: [], dLong: [], uLong: [], top: [], bot: [], dSwing: [], uSwing: [] };
function run(side, pat, osc = 0) { const W = new World(1); W.rocks = []; W.springs = []; const B = new Body(W, 2, 2, 0.3); B.frames(); const com = B.com(); const f = B.F[3].f; const ax = [f[0], f[1], f[2]];
  const ang = side * Math.PI / 2, c = Math.cos(ang), s = Math.sin(ang);
  const rot = (x, y, z) => { const v = [x - com[0], y - com[1], z - com[2]]; const d = v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2]; const cr = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]];
    return [0, 1, 2].map((k) => com[k] + v[k] * c + cr[k] * s + ax[k] * d * (1 - c)); };
  for (let i = 0; i < B.n; i++) { const p = rot(B.x[i], B.y[i], B.z[i]); B.x[i] = B.ox[i] = p[0]; B.y[i] = B.oy[i] = p[1]; B.z[i] = B.oz[i] = p[2]; }
  for (let k = 0; k < 30; k++) { B.u.fill(0); B.step(1 / 120); } B.frames(); const sy = B.F[3].s[1]; // right vector y>0: lying on LEFT side
  const down = sy > 0 ? 1 : 3; // ring side index that is on the ground: 1 = left
  for (let k = 0; k < 120 * 5; k++) { B.u.fill(0); const ph = osc ? Math.sin(2 * Math.PI * 1.2 * k / 120) : 1;
    for (let sg = 0; sg < 6; sg++) { B.u[CH.long + sg * 4 + down] = pat.dLong * ph; B.u[CH.long + sg * 4 + (4 - down)] = pat.uLong * ph; B.u[CH.long + sg * 4] = pat.top * ph; B.u[CH.long + sg * 4 + 2] = pat.bot * ph; }
    for (const L of B.limbs) if (L.kind === 'leg' || true) { const dn = L.side === down; const sw = L.kind === 'arm' ? CH.arm + L.idx * 3 : CH.leg + L.idx * 2; B.u[sw + 1] = (dn ? pat.dLeg : pat.uLeg) * ph; B.u[sw] = (dn ? pat.dSwing : pat.uSwing) * ph; }
    B.step(1 / 120); }
  B.frames(); return { sy0: +sy.toFixed(2), up: +B.F[3].u[1].toFixed(2) }; }
const pats = { none: {}, dLegExt: { dLeg: 1 }, dLegFlex: { dLeg: -1 }, uLegExt: { uLeg: 1 }, dLongC: { dLong: 1 }, dLongR: { dLong: -1 }, uLongC: { uLong: 1 }, topC: { top: 1 }, botC: { bot: 1 }, dLeg_uLong: { dLeg: 1, uLong: 1 }, dLeg_dLongR: { dLeg: 1, dLong: -1 }, dLeg_top: { dLeg: 1, top: 1 }, dLeg_bot: { dLeg: 1, bot: 1 } };
for (const [n, p] of Object.entries(pats)) { const q = { dLeg: 0, uLeg: 0, dLong: 0, uLong: 0, top: 0, bot: 0, dSwing: 0, uSwing: 0, ...p }; const r = [run(1, q), run(-1, q), run(1, q, 1), run(-1, q, 1)]; console.log(n.padEnd(12), JSON.stringify(r.map((x) => x.up)), 'sy0', r[0].sy0, r[1].sy0); }
