# Replication Protocol (`REPLICATION.md`)

This document specifies exact clean-clone reproduction commands, toolchain versions, expected runtimes, acceptance tolerances, and a dated independent replication log (`Build Standard B43, B44`).

## 1. Environment & Toolchain Requirements
- **Node.js:** `>= 22.0` (verified on `v22.x`, `v24.22`, `v25.8.2`)
- **Bun:** `>= 1.1` (optional for `glitchling.ts`; verified on `1.4.4`)
- **Python:** `>= 3.11` (verified on `3.13.12`) with `numpy`, `matplotlib`, `pytest`, `hypothesis`, `ruff`, `mypy`
- **Lean 4:** `leanprover/lean4:v4.35.0` via `elan` (zero Mathlib downloads required)
- **Tectonic (LaTeX):** `>= 0.15` (for compiling `paper/main.tex` to PDF)

## 2. Clean-Clone Verification Steps

```bash
git clone https://github.com/0thernes/glitchling-jam.git
cd glitchling-jam

# Step 1: Core repo health check (syntax, JSON, links, secrets, honesty guard, live/ determinism, Bun ref sim) (~1-2 min)
npm test

# Step 2: JS Verification Ladder (1,200 property checks, 7 negative, 7 regressions, 4 metamorphic, 8/8 mutants) (~2 s)
npm run verify:ladder

# Step 3: Runnable examples (~1 s)
npm run examples

# Step 4: Independent Python exact-rational / Kronecker oracle + JS differential check + Lean static audit (~3 s)
python scripts/verify_exact.py
python -m pytest tests/test_oracle.py -v

# Step 5: Warmed micro-benchmarks (~15 s)
npm run bench

# Step 6: Pure Lean 4.35.0 formal build, 59-declaration axiom audit, and leanchecker (~45 s)
cd lean
lake build GlitchlingProofs Challenge Solution
lake env lean VerifyAxioms.lean
lake env leanchecker --fresh GlitchlingProofs
lake env leanchecker --fresh Solution
# On Linux with bubblewrap installed:
lake comparator --config comparator.json --paranoid
cd ..

# Step 7: Results v3 summary statistics (exact recomputation from results/summary.csv, ~1 s)
npm run stats

# Step 8: Post-F03 T5 CHSH & analytical binomial no-signaling check on Cohorts A & B (~20 s)
FROM_T=5 TO_T=5 SEEDS=1,2,3,4,5,6,7,8,9,10,11,12 node live/test/lesion_experiments.mjs
FROM_T=5 TO_T=5 SEEDS=13,14,15,16,17,18,19,20,21,22,23,24 node live/test/lesion_experiments.mjs

# Step 9: Regenerate Results v3 from scratch (optional, ~15-25 min)
BUN_JSC_useConcurrentJIT=0 bun run glitchling.ts 2 30 500
```

## 3. Acceptance Tolerances
- **Lean 4.35.0:** Exit code `0`; 0 `sorry` outside `Challenge.lean`; all 59 audited axioms strictly inside `[propext, Classical.choice, Quot.sound]`; `leanchecker --fresh` exit `0`.
- **Differential JS vs Python Oracle:** `max_fmo_err < 1e-12` (observed `3.44e-15`), `max_cry4_err < 1e-12` (observed `9.99e-16`), `max_poincare_err < 1e-14` (observed `9.71e-17`), exact integer match on `RS[15,11]`, `CEGA-18`, `Hoggar`, and `C3`.
- **Determinism:** Identical `live/` 10-second trajectories across fresh processes; byte-identical `summary.csv` across simultaneous Bun runs with `BUN_JSC_useConcurrentJIT=0`.
- **T5 No-Signaling:** Exact `maxExactMargBias < 1e-15` (observed `0.0e+0`) and `maxNoSigZ < 4.26` (analytical Bonferroni $\alpha=0.001$ bound).

## 4. Dated Replication Log (`B44`)

| Date (UTC) | Commit / Version | Environment | Replicated Scope | Result |
|---|---|---|---|---|
| 2026-11-24 | `f6487f0` / `v2.1.0` | Linux x64, Node 24.22, Bun 1.4.4, GitHub Actions `ubuntu-latest` | `npm test` (9/9), headless Chromium 5-page audit, Results v3 (`n=30`) byte-identical simultaneous runs | PASS (`9/9`, 0 console errors, byte-identical `summary.csv`) |
| 2026-11-25 | `v2.2.0` (local Windows) | Windows 11 x64 (Intel Core Ultra 9 275HX), Node `25.8.2`, Python `3.13.12`, Lean `4.35.0` | `npm test` (9/9), `verification_ladder.mjs` (1,200 props + 8/8 mutants), `verify_exact.py` (`3.44e-15` / `9.99e-16` / `9.71e-17`), `pytest` (9/9), `ruff`, `mypy`, `T5` Cohorts A & B (`Z_max = 3.21, 2.39 < 4.26`), `lean` 59/59 decls + `leanchecker` | PASS (100% green) |
| 2026-11-25 | `v2.2.0` (GitHub Actions CI) | `ubuntu-24.04`, `windows-latest`, `macos-latest` | Cross-platform tests, Python oracle, Lean 4.35.0 + `lake comparator --paranoid`, Tectonic zero-warning PDF + standalone arXiv check | Verified on push to `main` (see Actions tab) |
