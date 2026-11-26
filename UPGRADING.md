# Upgrading Guide

## Upgrading from `v2.1.x` to `v2.2.0`

### Breaking / Tightened Behavioral Changes
1. **Explicit RNG Required (`F30`):**
   - `quantizeNestorRung(val, rung, rng, scale)` in `live/js/sim/heptarch.js` now throws `TypeError` when invoked on any stochastic rung (`r ∉ {0, 20, 22}`) without a seeded `rng` function (the silent `Math.random` fallback was removed).
   - `chooseSafeCospectralObelisk(leftA, rightA, useJordanCompletion, rngCoin)` in `live/js/tsotchke/qgtl.js` now throws `TypeError` when `useJordanCompletion === false` on cospectral twins without a seeded `rngCoin` function.
   - All existing callers inside `live/` already passed seeded PRNGs and require no change.
2. **T5 Finite-Sample No-Signaling Gate (`F33/D10`):**
   - `live/test/lesion_experiments.mjs` replaces the ad-hoc `maxEmpNoSig < 0.11` threshold (which had a ~49% false-rejection rate across 48 draws) with the exact analytical Bonferroni $\alpha = 0.001$ two-proportion binomial critical bound `maxNoSigZ < 4.26` ($\Phi^{-1}(1 - 0.001/96)$), while keeping exact density-matrix `maxExactMargBias < 1e-15`.
3. **Media Compression (`A24` Hygiene):**
   - Four >5 MB PNGs (`glitchling-hero-v3-4k.png`, `glitchling-v4-t720-4k.png`, `glitchling-v4-t800-4k.png` resized to 2560×1440; `11_purkinje_mouse_cerebellum.png` resized to 1440×1440) and `glitchling-v4-clip-1080p.mp4` (H.264 `yuv420p` 2.71 MB) were optimized below 5 MB while preserving all file paths and visual fidelity.

### Upgrading from `v2.0.x` to `v2.1.0`
- `live/test/nobel_rigor_suite.mjs` was renamed to `live/test/lesion_experiments.mjs` (`npm run lesion`).
- Results v2 (2 seeds, nondeterministic Bun JIT) was superseded by Results v3 (30 seeds 500–529, `BUN_JSC_useConcurrentJIT=0`).
- `play/sim.js` and `live/js/sim/world.js` switched from engine-dependent `Array.prototype.sort` to seeded Fisher–Yates shuffle, changing world layouts per seed across browsers uniformly.
