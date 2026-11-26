# Verification Architecture (`VERIFICATION.md`)

`glitchling-jam` (`v2.2.0`) implements a five-tier verification pyramid separating kernel-checked mathematics from differential numerical checks and multi-cohort statistical tests:

1. **Tier 1 — Kernel-Checked Formal Proofs (`lean/`, Lean `v4.35.0`, zero Mathlib):**
   - `GlitchlingProofs/{Spec,EnergyMassConservation,QuantumContextuality,CodingAndGovernance,HyperbolicAndFlaws}.lean`
   - 59 exported theorems audited via `lean/VerifyAxioms.lean` (`results/lean_axioms.txt`) + independent `leanchecker --fresh` + isolated `Challenge.lean` / `Solution.lean` (`lake comparator --config comparator.json --paranoid`).
   - Enforces `autoImplicit = false`, `relaxedAutoImplicit = false`, zero `sorry`, zero `admit`, zero `native_decide`, zero custom axioms (`[propext, Classical.choice, Quot.sound]` only).
2. **Tier 2 — Independent Exact-Arithmetic & Complex-Kronecker Reference Oracle (`reference/glitchling_oracle.py`, `scripts/verify_exact.py`, `tests/test_oracle.py`):**
   - Zero shared code with `live/js/`; verifies `GF(16)`/`RS[15,11]`, `CEGA-18`, `Hoggar 63/315`, `C3` (`14976` vs `15360`), `FMO` (`49×49` complex Kronecker vs JS real-basis, diff `3.44e-15`), `Cry4` (`64×64` complex Kronecker vs JS real-basis, diff `9.99e-16`), and `Poincaré` exact `Fraction` Möbius law (diff `9.71e-17`).
   - Backed by `pytest` + `hypothesis` (`tests/test_oracle.py`), `ruff`, and strict `mypy`.
3. **Tier 3 — JS Property, Negative, Regression, Metamorphic & Semantic Mutation Ladder (`live/test/verification_ladder.mjs`):**
   - 1,200 seeded property tests, 7 negative/boundary guards, 7 audit bug regressions (`F03, F15, F16, F27, F30, F33, F34`), 4 metamorphic invariants, and `8/8` killed semantic mutants.
4. **Tier 4 — Repository Health, Determinism & Honesty Guard (`tools/check.mjs`, `npm test`):**
   - Syntax check across all first-party JS/MJS, JSON/JSONL parse, local Markdown/HTML link resolution, secret & `eval` scans, user-facing honesty guard, 20-s `live/` finite-state smoke test, 10-s exact bit-determinism test, and dual repeatable Bun reference-sim run (`BUN_JSC_useConcurrentJIT=0`).
5. **Tier 5 — Statistical Falsification & Multi-Cohort Replication (`tools/results_stats.mjs`, `live/test/lesion_experiments.mjs`):**
   - Results v3 (`n = 30` seeds `500–529`, paired $t$-intervals, Cohen's $d_z$, 200k-draw sign-flip permutation $p$).
   - 15-experiment `live/` lesion/emergent suite (`T1–T15`, 26 contrasts, exact $2^{12}$ sign-flip permutations, 10k bootstrap CIs, Holm–Bonferroni & full Bonferroni FWER; `T5` re-verified post-`F03` with analytical binomial $Z < 4.26$).

See [`CLAIMS.md`](CLAIMS.md), [`REPLICATION.md`](REPLICATION.md), and [`docs/statement-fidelity.md`](docs/statement-fidelity.md) for the complete 1-to-1 audit map.
