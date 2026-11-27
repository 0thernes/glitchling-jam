# Honest Performance Benchmarks & Budgets (`docs/benchmarks.md`)

All timings below are measured live via `npm run bench` (`scripts/bench.mjs`) after explicit JIT warmup and stored verbatim in [`results/perf-benchmarks.json`](../results/perf-benchmarks.json) (`Build Standard A37, B26, B27`).

## Measurement Environment (`v2.4.0`)
- **CPU:** Intel Core Ultra 9 275HX (24 logical cores), 47.4 GB RAM
- **OS / Runtime:** Windows 11 x64 (`win32-x64`), Node.js `v25.8.2`
- **Timestamp (UTC):** `2026-11-26T23:52:10.634Z`

## Warmed Micro-Benchmark Results

| Kernel | Batch | Reps | Median (ms) | IQR (ms) | p95 (ms) | Min – Max (ms) | Budget Target |
|---|---:|---:|---:|---:|---:|---:|---|
| `live_creature_M_step` (`3,268` neurons, 1/60 s step) | 5 | 30 | `22.6761` | `5.3317` | `31.4635` | `12.60 – 37.26` | `< 33.3 ms` (30 Hz interactive; auto-Worker offloads UI) |
| `live_creature_S_headless_step` (`436` neurons) | 10 | 30 | `14.7781` | `3.0454` | `19.2485` | `11.12 – 25.51` | `< 25.0 ms` |
| `fmo_gksl_49x49_exact` (7-site GKSL linear solve) | 1 | 25 | `0.0770` | `0.0061` | `0.0851` | `0.069 – 0.182` | `< 1.0 ms` (cached in `getFMOTempTable`) |
| `fmo_forster_7x7_exact` (secular Pauli–Förster) | 50 | 30 | `0.0011` | `0.0002` | `0.0014` | `0.0009 – 0.0016` | `< 0.05 ms` |
| `cry4_haberkorn_64x64_exact` (8×8 radical-pair) | 1 | 20 | `0.2245` | `0.5534` | `1.1700` | `0.184 – 4.211` | `< 5.0 ms` (cached in `getCry4AxialCurve`) |
| `rs15_11_encode_corrupt2_decode` (`GF(16)` ECC) | 200 | 30 | `0.0026` | `0.0007` | `0.0045` | `0.0021 – 0.0080` | `< 0.05 ms` |
| `poincare_mobius_add` ($K=-1$ gyrovector sum) | 10000 | 30 | `< 0.0001` | `0.0000` | `0.0001` | `0.0000 – 0.0001` | `< 0.001 ms` |
| `c3_cospectral_cached` (Jordan twin readout) | 1000 | 20 | `0.0001` | `0.0000` | `0.0002` | `0.0000 – 0.0002` | `< 0.01 ms` |

## Honest Caveats & Scaling Ceilings (`B27`)
- **`live_creature_M_step` vs 60 Hz wall-clock:** Under heavy single-core Node load on Windows (`22.7 ms` median; `10.1–10.8 ms` on Linux Node 24 in `P19`), M-scale runs slightly slower than strict 16.67 ms (60 Hz) when run synchronously on the main thread; the browser UI automatically uses Web Worker offloading (`?backend=auto`) and adaptive brain-scale down-stepping.
- **`MEGA` & `GIGA` scales are NOT real-time on CPU (`F01`):** Measured in `P12`/`P19` at `~219 ms/step` (`MEGA`) and `~1,076 ms/step` (`GIGA`, `14.16M` neurons, `28,131` explicit + `113M` Int8 cluster weights).
- **Regression Tracking:** Re-run `npm run bench` after physics, solver, or brain-loop edits and compare medians/IQRs against `results/perf-benchmarks.json` (report-only, never blocking commits per Hard Rule `R1`).
