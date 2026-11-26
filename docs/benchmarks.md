# Honest Performance Benchmarks & Budgets (`docs/benchmarks.md`)

All timings below are measured live via `npm run bench` (`scripts/bench.mjs`) after explicit JIT warmup and stored verbatim in [`results/perf-benchmarks.json`](../results/perf-benchmarks.json) (`Build Standard A37, B26, B27`).

## Measurement Environment (v2.2.0 Baseline)
- **CPU:** Intel Core Ultra 9 275HX (24 logical cores), 47.4 GB RAM
- **OS / Runtime:** Windows 11 x64 (`win32-x64`), Node.js `v25.8.2`
- **Timestamp (UTC):** `2026-11-26T02:49:26.501Z`

## Warmed Micro-Benchmark Results

| Kernel | Batch | Reps | Median (ms) | IQR (ms) | p95 (ms) | Min – Max (ms) | Budget Target |
|---|---:|---:|---:|---:|---:|---:|---|
| `live_creature_M_step` (`3,268` neurons, 1/60 s step) | 5 | 30 | `18.6189` | `6.4254` | `27.7788` | `12.31 – 33.13` | `< 33.3 ms` (30 Hz interactive; auto-Worker offloads UI) |
| `live_creature_S_headless_step` (`436` neurons) | 10 | 30 | `16.2066` | `3.8875` | `21.2734` | `11.11 – 22.47` | `< 25.0 ms` |
| `fmo_gksl_49x49_exact` (7-site GKSL linear solve) | 1 | 25 | `0.1342` | `0.0528` | `0.2747` | `0.12 – 2.57` | `< 1.0 ms` (cached in `getFMOTempTable`) |
| `fmo_forster_7x7_exact` (secular Pauli–Förster) | 50 | 30 | `0.0011` | `0.0006` | `0.0047` | `0.0009 – 0.0068` | `< 0.05 ms` |
| `cry4_haberkorn_64x64_exact` (8×8 radical-pair) | 1 | 20 | `0.8558` | `0.9737` | `3.1750` | `0.34 – 3.42` | `< 5.0 ms` (cached in `getCry4AxialCurve`) |
| `rs15_11_encode_corrupt2_decode` (`GF(16)` ECC) | 200 | 30 | `0.0035` | `0.0012` | `0.0060` | `0.0026 – 0.0141` | `< 0.05 ms` |
| `poincare_mobius_add` ($K=-1$ gyrovector sum) | 10000 | 30 | `< 0.0001` | `0.0000` | `0.0001` | `0.0000 – 0.0002` | `< 0.001 ms` |
| `c3_cospectral_cached` (Jordan twin readout) | 1000 | 20 | `0.0001` | `0.0001` | `0.0002` | `0.0000 – 0.0003` | `< 0.01 ms` |

## Honest Caveats & Scaling Ceilings (`B27`)
- **`live_creature_M_step` vs 60 Hz wall-clock:** Under heavy single-core Node load on Windows (`18.6 ms` median; `10.1–10.8 ms` on Linux Node 24 in `P19`), M-scale runs slightly slower than strict 16.67 ms (60 Hz) when run synchronously on the main thread; the browser UI automatically uses Web Worker offloading (`?backend=auto`) and adaptive brain-scale down-stepping.
- **`MEGA` & `GIGA` scales are NOT real-time on CPU (`F01`):** Measured in `P12`/`P19` at `~219 ms/step` (`MEGA`) and `~1,076 ms/step` (`GIGA`, `14.16M` neurons, `28,131` explicit + `113M` Int8 cluster weights).
- **Regression Tracking:** Re-run `npm run bench` after physics, solver, or brain-loop edits and compare medians/IQRs against `results/perf-benchmarks.json` (report-only, never blocking commits per Hard Rule `R1`).
