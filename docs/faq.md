# Frequently Asked Questions (`docs/faq.md`)

### 1. Does Glitchling claim consciousness, sentience, feelings, or AGI?
**No.** Neither Glitchling nor Creature #1 makes any claim of consciousness, sentience, awareness, feelings, or AGI. This boundary is stated in `README.md`, `LIMITATIONS.md`, `play/index.html`, `live/js/honesty.js`, and enforced automatically by the honesty guard in `tools/check.mjs`.

### 2. Did Glitchling solve any of the 1,900 open problems in `unsolved-problems-mega-atlas`?
**No — honestly `0 / 1,900`.** See [`docs/MEGA_ATLAS_CROSSCHECK.md`](MEGA_ATLAS_CROSSCHECK.md) for the full keyword sweep, scoped overlap mapping (`AI-045`, `BIO-022`, `BIO-026`, `BIO-044`, `QM-007`, `QM-011`, `STAT-060`), and explicit non-claims.

### 3. Why do the `MEGA` (`16.78M`) and `GIGA` (`1.13B`) synapse numbers say "nominal"?
Audit finding `F01` discovered that those totals are computed by formula (`2^24` and `80 × neurons`), whereas measured explicitly stored synapses on seed 1 are `30,554` (`MEGA`) and `28,131` (`GIGA`, plus `113,248,384` lazily allocated Int8 cluster weights). Every README, UI label, and stats readout now distinguishes nominal from stored counts explicitly.

### 4. Why must `glitchling.ts` be run with `BUN_JSC_useConcurrentJIT=0`?
Audit finding `F31` showed that default Bun/JavaScriptCore concurrent JIT compilation varies floating-point execution order under CPU load (6 distinct `summary.csv` outputs in 11 runs). Setting `BUN_JSC_useConcurrentJIT=0` yields byte-identical simultaneous runs on the same machine, and was used to generate the 30-seed Results v3 dataset.

### 5. Do the quantum modules (`FMO`, `Cry4`, `CHSH`, `CEGA-18`, `Hoggar`, `C3`) prove quantum biology or non-locality?
**No.** They are classical IEEE-754 / exact-rational matrix implementations on CPU (plus Lean 4.35.0 proofs of the finite mathematical theorems). They verify mathematical correctness of the models—not physical quantum coherence inside browsers or living brains.

### 6. Why are the Lean 4 proofs zero-Mathlib?
Zero-Mathlib Lean `v4.35.0` builds in under 30 seconds from a clean clone without downloading multi-gigabyte oleans, eliminates dependency drift, and makes every proof independently auditable by `leanchecker --fresh` and `lake comparator --paranoid`.

### 7. Why is `LICENSE` the Cosmogonic License instead of MIT/Apache?
By explicit owner decision (`F04/D4`, Nov 24, 2026), `LICENSE` is kept byte-identical to `0thernes/CQM2` (non-commercial research and play). Vendored libraries (`three.js` MIT, `p5.js` LGPL-2.1, `eshkol` MIT) retain their own licenses (`THIRD_PARTY_NOTICES.md`).
