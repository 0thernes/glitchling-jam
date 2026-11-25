// Summary statistics for results/summary.csv (audit F31/D9). No dependencies.
// usage: node tools/results_stats.mjs [results/summary.csv] [--md] [--json out.json]
// Per condition: mean, SD, 95% t-interval. Paired vs baseline (same seed): mean difference, 95% t-interval,
// Cohen's d_z (mean diff / SD of diffs), and a two-sided sign-flip permutation p (exact if n <= 20, else 200,000 seeded draws).
import fs from 'node:fs';
const args = process.argv.slice(2), file = args.find((a) => !a.startsWith('--') && !a.endsWith('.json')) || 'results/summary.csv';
const lines = fs.readFileSync(file, 'utf8').trim().split('\n'), head = lines[0].split(','), rows = lines.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [head[i], v])));
const conds = [...new Set(rows.map((r) => r.condition))], METRICS = ['forages', 'successRate', 'glcMean'];
const by = (c) => rows.filter((r) => r.condition === c).sort((a, b) => a.seed - b.seed);
// Student t quantile via regularized incomplete beta + bisection.
const lgamma = (x) => { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); };
const betacf = (a, b, x) => { let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2)); d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; h *= d * c; aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1)); d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; } return h; };
const ibeta = (a, b, x) => { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
const tcdf = (t, v) => { const p = 0.5 * ibeta(v / 2, 0.5, v / (v + t * t)); return t > 0 ? 1 - p : p; };
const tq = (p, v) => { let lo = 0, hi = 100; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; tcdf(m, v) < p ? (lo = m) : (hi = m); } return (lo + hi) / 2; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length, sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const ci = (a) => { const h = tq(0.975, a.length - 1) * sd(a) / Math.sqrt(a.length), m = mean(a); return [m - h, m + h]; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const signflip = (d) => { const n = d.length, obs = Math.abs(d.reduce((s, x) => s + x, 0)) - 1e-12; let hit = 0, tot = 0;
  if (n <= 20) { for (let m = 0; m < 1 << n; m++) { let s = 0; for (let i = 0; i < n; i++) s += (m >> i) & 1 ? -d[i] : d[i]; if (Math.abs(s) >= obs) hit++; tot++; } return { p: hit / tot, exact: true }; }
  const r = mulberry(12345); tot = 200000; for (let k = 0; k < tot; k++) { let s = 0; for (let i = 0; i < n; i++) s += r() < 0.5 ? -d[i] : d[i]; if (Math.abs(s) >= obs) hit++; } return { p: (hit + 1) / (tot + 1), exact: false }; };
const out = { file, seeds: [...new Set(rows.map((r) => +r.seed))].sort((a, b) => a - b), conditions: {} };
const base = by('baseline');
for (const c of conds) { const R = by(c), o = { n: R.length, alive: R.filter((r) => r.alive === 'true').length };
  for (const k of METRICS) { const a = R.map((r) => +r[k]); o[k] = { mean: mean(a), sd: sd(a), ci95: ci(a) };
    if (c !== 'baseline') { if (R.some((r, i) => r.seed !== base[i].seed)) throw new Error('seed mismatch'); const d = R.map((r, i) => +r[k] - +base[i][k]), sf = signflip(d), bm = mean(base.map((r) => +r[k]));
      o[k].vsBaseline = { diff: mean(d), ci95: ci(d), pct: 100 * mean(d) / bm, dz: mean(d) / sd(d), p: sf.p, exact: sf.exact, wins: d.filter((x) => x > 0).length, losses: d.filter((x) => x < 0).length }; } }
  out.conditions[c] = o; }
if (args.includes('--json')) fs.writeFileSync(args[args.indexOf('--json') + 1], JSON.stringify(out, null, 1));
const f = (x, d = 1) => x.toFixed(d), ciS = (c, d = 1) => `[${f(c[0], d)}, ${f(c[1], d)}]`, pS = (p) => (p < 0.001 ? p.toExponential(1) : p.toFixed(3));
console.log(`n = ${base.length} seeds per condition (seeds ${out.seeds[0]}–${out.seeds.at(-1)}); mean ± SD [95% CI]; Δ = paired difference vs baseline [95% CI], d_z, sign-flip p\n`);
console.log('| condition | alive | forages | Δ forages vs baseline | success rate | Δ success vs baseline | mean glucose |');
console.log('|---|---|---|---|---|---|---|');
for (const c of conds) { const o = out.conditions[c], F = o.forages, S = o.successRate, G = o.glcMean;
  const dF = F.vsBaseline ? `${F.vsBaseline.diff >= 0 ? '+' : ''}${f(F.vsBaseline.diff)} (${F.vsBaseline.pct >= 0 ? '+' : ''}${f(F.vsBaseline.pct, 0)}%) ${ciS(F.vsBaseline.ci95)}, d_z ${f(F.vsBaseline.dz, 2)}, p ${pS(F.vsBaseline.p)}` : '—';
  const dS = S.vsBaseline ? `${S.vsBaseline.diff >= 0 ? '+' : ''}${f(S.vsBaseline.diff, 3)} ${ciS(S.vsBaseline.ci95, 3)}, d_z ${f(S.vsBaseline.dz, 2)}, p ${pS(S.vsBaseline.p)}` : '—';
  console.log(`| ${c} | ${o.alive}/${o.n} | ${f(F.mean)} ± ${f(F.sd)} ${ciS(F.ci95)} | ${dF} | ${f(S.mean, 3)} ± ${f(S.sd, 3)} ${ciS(S.ci95, 3)} | ${dS} | ${f(G.mean, 2)} ± ${f(G.sd, 2)} |`); }
