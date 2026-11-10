// CMA-ES (Hansen 2016, standard (mu/mu_w, lambda) with rank-one + rank-mu updates) over the motor genome in js/sim/genome.js.
// Search space: every gene normalised to [0,1] between its bounds; start mean 0.5 (centre of the bounds, i.e. NOT the hand
// design), sigma 0.3. Fitness: test/genome_eval.mjs on training seeds; parallel evaluation in worker threads.
// Usage: node test/evolve_genome.mjs GENERATIONS LAMBDA WORKERS TRAINSEEDS OUTFILE
import { Worker, isMainThread, parentPort } from 'worker_threads'; import { writeFileSync, appendFileSync } from 'fs';
import { GENES, NG, toObj } from '../js/sim/genome.js';
const dec = (x) => toObj(x.map((u, i) => GENES[i][1] + Math.min(1, Math.max(0, u)) * (GENES[i][2] - GENES[i][1])));
if (!isMainThread) { globalThis.EVAL_BRAIN = process.env.EVAL_BRAIN || undefined; globalThis.BRAIN_SCALE = globalThis.EVAL_BRAIN; const { evalGenome } = await import('./genome_eval.mjs'); parentPort.on('message', ({ id, x, seeds }) => { const r = evalGenome(dec(x), seeds); parentPort.postMessage({ id, r }); }); }
else {
  const GEN = +(process.argv[2] || 100), LAM = +(process.argv[3] || 16), NW = +(process.argv[4] || 8), SEEDS = (process.argv[5] || '1,2').split(',').map(Number), OUT = process.argv[6] || '/tmp/evo.json';
  const pool = Array.from({ length: NW }, () => new Worker(new URL(import.meta.url))); let nextId = 0; const pend = new Map(); pool.forEach((w) => w.on('message', ({ id, r }) => { pend.get(id)(r); pend.delete(id); }));
  const queue = []; let free = [...pool]; const pump = () => { while (free.length && queue.length) { const w = free.pop(), job = queue.shift(); job.w = w; pend.set(job.id, (r) => { free.push(w); job.res(r); pump(); }); w.postMessage({ id: job.id, x: job.x, seeds: SEEDS }); } };
  const evalX = (x) => new Promise((res) => { queue.push({ id: nextId++, x, res }); pump(); });
  // CMA-ES state
  const n = NG, lam = LAM, mu = Math.floor(lam / 2); let wts = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1)); const ws = wts.reduce((a, b) => a + b); wts = wts.map((w) => w / ws); const mueff = 1 / wts.reduce((a, w) => a + w * w, 0);
  const cc = (4 + mueff / n) / (n + 4 + 2 * mueff / n), cs = (mueff + 2) / (n + mueff + 5), c1 = 2 / ((n + 1.3) ** 2 + mueff), cmu = Math.min(1 - c1, 2 * (mueff - 2 + 1 / mueff) / ((n + 2) ** 2 + mueff)), damps = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + cs, chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
  let m = new Array(n).fill(0.5), sigma = +(process.env.SIGMA0 || 0.3); const pc = new Array(n).fill(0), ps = new Array(n).fill(0); let C = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))); let B = C.map((r) => [...r]), D = new Array(n).fill(1);
  let seedR = 12345; const rnd = () => { seedR = (Math.imul(seedR, 1664525) + 1013904223) >>> 0; return seedR / 4294967296; }; const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  function eig() { // Jacobi eigen-decomposition of C -> B (columns eigenvectors), D (sqrt eigenvalues)
    const A = C.map((r) => [...r]); const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 30; sweep++) { let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2; if (off < 1e-18) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) { if (Math.abs(A[p][q]) < 1e-15) continue; const th = (A[q][q] - A[p][p]) / (2 * A[p][q]); const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)); const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; } for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; } } }
    B = V; D = A.map((r, i) => Math.sqrt(Math.max(1e-20, r[i]))); }
  if (process.env.INIT) { m = JSON.parse((await import('fs')).readFileSync(process.env.INIT)).meanX.map((u) => Math.min(0.95, Math.max(0.05, u))); } // optional warm start from a previous run's mean
  let best = { fit: -1e9 }; writeFileSync(OUT.replace('.json', '.log'), '');
  for (let g = 0; g < GEN; g++) { const Z = [], Y = [], X = []; for (let k = 0; k < lam; k++) { const z = Array.from({ length: n }, gauss); const y = B.map((row) => row.reduce((a, bij, j) => a + bij * D[j] * z[j], 0)); Z.push(z); Y.push(y); X.push(m.map((mi, i) => mi + sigma * y[i])); }
    const R = await Promise.all(X.map((x) => evalX(x.map((u) => Math.min(1, Math.max(0, u)))))); // fitness uses the clamped point; a small penalty keeps the mean inside the box
    const F = R.map((r, k) => r.fit - 0.5 * X[k].reduce((a, u) => a + Math.max(0, -u) + Math.max(0, u - 1), 0)); const idx = F.map((f, k) => k).sort((a, b) => F[b] - F[a]);
    if (R[idx[0]].fit > best.fit) best = { ...R[idx[0]], x: X[idx[0]].map((u) => Math.min(1, Math.max(0, u))), gen: g };
    const old = [...m]; m = m.map((_, i) => idx.slice(0, mu).reduce((a, k, r) => a + wts[r] * X[k][i], 0)); const yw = m.map((mi, i) => (mi - old[i]) / sigma);
    // C^{-1/2} yw = B D^-1 B^T yw
    const bt = B[0].map((_, j) => B.reduce((a, row, i) => a + row[j] * yw[i], 0)); const inv = B.map((row) => row.reduce((a, bij, j) => a + bij * bt[j] / D[j], 0));
    for (let i = 0; i < n; i++) ps[i] = (1 - cs) * ps[i] + Math.sqrt(cs * (2 - cs) * mueff) * inv[i]; const psn = Math.sqrt(ps.reduce((a, v) => a + v * v, 0)); const hs = psn / Math.sqrt(1 - (1 - cs) ** (2 * (g + 1))) / chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
    for (let i = 0; i < n; i++) pc[i] = (1 - cc) * pc[i] + hs * Math.sqrt(cc * (2 - cc) * mueff) * yw[i];
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let rmu = 0; for (let r = 0; r < mu; r++) rmu += wts[r] * Y[idx[r]][i] * Y[idx[r]][j]; const v = (1 - c1 - cmu) * C[i][j] + c1 * (pc[i] * pc[j] + (1 - hs) * cc * (2 - cc) * C[i][j]) + cmu * rmu; C[i][j] = C[j][i] = v; }
    sigma *= Math.exp((cs / damps) * (psn / chiN - 1)); sigma = Math.min(sigma, 0.6); eig();
    const top = R[idx[0]]; const mean = F.reduce((a, b) => a + b) / lam; const line = `gen ${g} best ${top.fit.toFixed(3)} (v ${top.v.toFixed(2)} side ${top.side.toFixed(2)} yL ${top.yL.toFixed(2)} yR ${top.yR.toFixed(2)} up ${top.up.toFixed(2)} rt ${top.rt.toFixed(1)}) mean ${mean.toFixed(3)} sigma ${sigma.toFixed(3)} | best-ever ${best.fit.toFixed(3)} @${best.gen}`;
    console.log(line); appendFileSync(OUT.replace('.json', '.log'), line + '\n'); writeFileSync(OUT, JSON.stringify({ best: { ...best, genome: dec(best.x) }, mean: dec(m), meanX: m, sigma, gen: g, seeds: SEEDS, lambda: lam }, null, 1)); }
  pool.forEach((w) => w.terminate()); }
