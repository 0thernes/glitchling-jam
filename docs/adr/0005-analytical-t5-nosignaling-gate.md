# ADR-0005: Exact Analytical Bonferroni Binomial $Z$-Gate for `T5` No-Signaling

- **Date:** 2026-11-25
- **Status:** Accepted (`F33/D10`)

## Context
After fixing the biased world shuffle (`F03`), `live/test/lesion_experiments.mjs` Experiment `T5` failed its empirical soft gate `maxEmpNoSig < 0.11` (`0.1376` on Cohort A) even though the exact reduced-density marginal bias was identically `0.0`. Across $4N = 48$ finite-sample two-proportion contrasts with cell counts $n_{xy} \approx 260$, $\mathrm{SE} = \sqrt{0.25(1/n_1 + 1/n_2)} \approx 0.044$, so $\mathbb{P}(\max_{48} |\hat p_1 - \hat p_2| > 0.11) \approx 49\%$ even under exact no-signaling!

## Decision
Replace the miscalibrated ad-hoc `0.11` cutoff with the exact analytical Bonferroni $\alpha = 0.001$ two-proportion binomial $Z$-statistic bound:
$$Z_{\max} = \max_{1 \le i \le 4N} \frac{|\hat p_{i,1} - \hat p_{i,2}|}{\sqrt{\tfrac{1}{4}(n_{i,1}^{-1} + n_{i,2}^{-1})}} < \Phi^{-1}\!\left(1 - \frac{0.001}{2 \cdot 4N}\right) \approx 4.26,$$
while retaining the exact machine-precision reduced density-matrix gate `maxExactMargBias < 1e-15`. Disclose transparently in `ERRATA.md` and `docs/preregistration.md` that this methodological correction followed observing Cohort A post-`F03`.

## Consequences
Eliminates a 49% false-failure defect without threshold-gaming; passes cleanly on both Cohort A (`Z_max = 3.21 < 4.26`) and unseen Cohort B (`Z_max = 2.39 < 4.26`).
