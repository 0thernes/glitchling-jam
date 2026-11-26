# Pre-Registration & Protocol Discipline (`docs/preregistration.md`)

`Build Standard B32` requires honest separation between **exploratory/post-hoc calibrations** and **pre-registered confirmatory hypotheses**.

## 1. Historical Pre-Registration Status (Honest Record)
1. **Pass 22 Locked Replication Cohorts (`SEEDS = 13..24` and `25..36`, recorded 2026-11-23):**
   - Cohort B (`13..24`) was evaluated on unmodified Pass 21 commit `48eb260` before Pass 22 edits (`12/12` experiments, `18/18` full Bonferroni).
   - Cohort C (`25..36`) was locked with zero subsequent code edits for all new/modified Pass 22 experiments (`T12–T15`), hitting `12/12` at the exact $2^{-12} = 0.000244$ permutation floor.
2. **Results v3 (`SEEDS = 500..529`, recorded 2026-11-24, `F31/D9`):**
   - `n = 30` dev seeds were chosen explicitly to resolve the `n = 2` Bun JIT nondeterminism defect (`F31`), cleanly **refuting** the earlier v2 claim of within-life hit-rate compensation (`-0.016 [-0.042, +0.009]`) and the v2 `misfire` jump (`p = 0.477`).
3. **Post-`F03` `T5` Analytical No-Signaling Gate (`F33/D10`, recorded 2026-11-25):**
   - Replacing the miscalibrated ad-hoc `maxEmpNoSig < 0.11` gate with the analytical Bonferroni $\alpha = 0.001$ two-proportion binomial critical value `maxNoSigZ < 4.26` ($\Phi^{-1}(1 - 0.001/96)$) occurred **after** observing `0.1376` on Cohort A following the `F03` Fisher–Yates shuffle fix. We disclose this transparently as a post-hoc analytical correction (not a pre-registered threshold); it was subsequently confirmed on unseen Cohort B (`SEEDS = 13..24`, `Z_max = 2.39 < 4.26`).

## 2. Pre-Registered Protocol for Future Held-Out Confirmation (`v2.3+`, Locked Prior to Execution)
Before running any future confirmatory sweeps on post-`F03` `live/` worlds or new Creature #1 `core/` pins (`F18`), the following exact protocol is fixed in advance:
- **Held-Out Seed Range:** `SEEDS = 1001..1030` (`n = 30` paired seeds, completely disjoint from all prior seeds `1..36` and `500..529`).
- **Reference-Sim Hypotheses (`glitchling.ts`, `BUN_JSC_useConcurrentJIT=0`):**
  - `H1`: `all` vs `baseline` paired `Δ forages > 0` (two-sided sign-flip permutation, 200,000 draws, $\alpha_{\text{Holm}} = 0.05$).
  - `H2`: `all` vs `baseline` paired `Δ success < 0`.
  - `H3`: `backwards` vs `baseline` produces the largest negative `Δ success` among single-flaw arms.
  - `H4`: `misfire` vs `baseline` equivalence check (two-sided 95% CI spanning zero or $|\Delta\text{success}| < 0.03$).
  - `H5`: Within-life hit-rate slope (`secondHalf - firstHalf`) under `all` flaws shows no significant positive compensation (confirming v3 null).
- **`live/` T5 No-Signaling Gate:** Analytical Bonferroni $\alpha = 0.001$ bound adjusted for $4N = 120$ contrasts: $Z_{\max} < \Phi^{-1}(1 - 0.001 / 240) \approx 4.465$, with exact `maxExactMargBias < 1e-15`.
- **Failure Policy:** Any hypothesis failing Holm–Bonferroni correction on `1001..1030` will be reported verbatim as falsified in `ERRATA.md` and `CLAIMS.md`.
