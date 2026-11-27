#!/usr/bin/env node
// Glitchling v2.4.0 — Honest Warmed Micro-Benchmark Harness (B26, B27)
// Measures median, IQR, p95, min, max across key simulation kernels and writes results/perf-benchmarks.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { Creature } from '../live/js/sim/creature.js';
import { solveFMOLindbladExact, solveFMOForsterExact } from '../live/js/sim/world.js';
import {
  encodeNeuraleseRS15_11,
  decodeNeuraleseRS15_11,
  solveCry4Haberkorn8x8,
} from '../live/js/sim/heptarch.js';
import { evalCospectralTwins, poincareMobiusAdd } from '../live/js/tsotchke/qgtl.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function stats(samplesMs) {
  const s = samplesMs.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return {
    n: s.length,
    median_ms: +q(0.5).toFixed(4),
    q25_ms: +q(0.25).toFixed(4),
    q75_ms: +q(0.75).toFixed(4),
    iqr_ms: +(q(0.75) - q(0.25)).toFixed(4),
    p95_ms: +q(0.95).toFixed(4),
    min_ms: +s[0].toFixed(4),
    max_ms: +s[s.length - 1].toFixed(4),
  };
}

function bench(name, warmup, reps, batch, fn) {
  for (let i = 0; i < warmup; i++) fn();
  const samples = [];
  for (let r = 0; r < reps; r++) {
    const t0 = performance.now();
    for (let b = 0; b < batch; b++) fn();
    samples.push((performance.now() - t0) / batch);
  }
  return { name, batch, ...stats(samples) };
}

const results = [];

// 1. Default M-scale Creature step (1/60 s sim step)
{
  const c = new Creature(1);
  results.push(bench('live_creature_M_step', 30, 30, 5, () => c.step()));
}

// 2. S-scale Creature step
{
  const c = new Creature(1, { brainScale: 'S', noVision: true });
  c.retina.skipSheet = true;
  c.noSkin = true;
  results.push(bench('live_creature_S_headless_step', 30, 30, 10, () => c.step()));
}

// 3. 7-Site FMO GKSL Lindblad exact solver (49x49)
results.push(bench('fmo_gksl_49x49_exact', 5, 25, 1, () => solveFMOLindbladExact(22.0)));

// 4. 7-Site FMO secular Pauli-Forster exact solver (7x7)
results.push(bench('fmo_forster_7x7_exact', 20, 30, 50, () => solveFMOForsterExact(22.0)));

// 5. 8x8 Cryptochrome-4 Liouville-Haberkorn exact solver (64x64)
results.push(bench('cry4_haberkorn_64x64_exact', 3, 20, 1, () => solveCry4Haberkorn8x8(0.6, 0.2, 0.7745966692)));

// 6. RS[15,11] GF(16) encode + 2-symbol burst decode
{
  const msg = Uint8Array.of(3, 14, 1, 5, 9, 2, 6, 5, 3, 5, 10);
  results.push(bench('rs15_11_encode_corrupt2_decode', 50, 30, 200, () => {
    const cw = encodeNeuraleseRS15_11(msg);
    cw[2] ^= 7; cw[12] ^= 9;
    decodeNeuraleseRS15_11(cw);
  }));
}

// 7. Poincare Mobius addition
results.push(bench('poincare_mobius_add', 100, 30, 10000, () => poincareMobiusAdd(0.3, -0.4, -0.2, 0.5)));

// 8. C3 cospectral twins cold/cached readout
results.push(bench('c3_cospectral_cached', 10, 20, 1000, () => evalCospectralTwins()));

const payload = {
  version: fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(),
  timestamp_utc: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    cpus: os.cpus().length,
    cpu_model: os.cpus()[0]?.model || 'unknown',
    mem_gb: +(os.totalmem() / (1024 ** 3)).toFixed(1),
  },
  benchmarks: results,
};

const outPath = path.join(ROOT, 'results', 'perf-benchmarks.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify(payload, null, 2));
