# Glitchling: Engineered Flaw Resilience, Multi-Cohort Artificial-Life Falsification, Independent Exact Oracles, and Pure Lean 4 Verification

**Author:** Alexander Stephen Donahue (`Independent Researcher, Spokane, WA, USA`)  
**ORCID:** [`0009-0006-8168-9648`](https://orcid.org/0009-0006-8168-9648) · **Email:** `0_0@0thernes.art`  
**Version:** `2.2.0` · **Date:** November 25, 2026 *(Independent Preprint — Not Peer-Reviewed)*  
**Compiled PDF:** [`dist/Donahue_2026_glitchling_alife_verification.pdf`](../dist/Donahue_2026_glitchling_alife_verification.pdf) · **LaTeX Source:** [`paper/main.tex`](main.tex) · **arXiv Bundle:** [`dist/arxiv_submission.tar.gz`](../dist/arxiv_submission.tar.gz)

---

## Abstract

**Glitchling (`v2.2.0`)** is a multi-layer artificial-life (A-Life) testbed and five-tier formal verification pipeline combining a deliberately perturbed baby clone of Creature #1 (`glitchling.ts` subclassing frozen `core/organism.ts`) with a 3D soft-body, spiking-network Geodesic Biodome (`live/`). Across a 35-pass external audit (`F01–F33`) and three deep hardening cycles (`F24/F30/F33–F40`), we establish:

1. **Repeatable Reference-Sim Flaw Resilience (`Results v3`, `n = 30`, `BUN_JSC_useConcurrentJIT=0`):** `210/210` survival across all 7 conditions; enabling all four flaws (`scramble`, `leaky`, `backwards`, `misfire`) raises foraging volume by `+22%` (`255.0 ± 59.7` vs `209.3 ± 60.9`, paired `Δ = +45.8 [34.5, 57.1]`, $d_z = 1.51$, $p = 5.0\times 10^{-6}$) while reducing hit rate (`0.299` vs `0.365`, `Δ = -0.066`, $d_z = -1.01$), keeping total rewards comparable (`76.3` vs `74.5`). Crucially, `n = 30` **refutes** the earlier `n = 2` (`Results v2`) hint of within-life hit-rate compensation (`-0.016 [-0.042, +0.009]`) and spurious `misfire` jump (`p = 0.477`).
2. **Pure Zero-Mathlib Lean 4.35.0 Formal Core (`lean/`):** `59` exported kernel-checked declarations (`51` library theorems + `8` isolated `Challenge`/`Solution` comparator targets; zero Mathlib, zero `sorry`, zero `native_decide`, `autoImplicit = false`, passing `leanchecker --fresh` strictly within `[propext, Classical.choice, Quot.sound]`): inductive 11-pool First-Law energy & N/C mass conservation, Clausius $\dot\Sigma \ge 0$, constructive `CEGA-18` Kochen–Specker uncolorability (`8 < 9`), CHSH LHV ceiling (`|S| <= 2`, `<= 75%`), Bell-diagonal exact no-signaling, complete $\mathbb{F}_{16}$ finite-field axioms (`0x13`) & `RS[15,11,d=5]` radius `t = 2`, `HEPTARCH` 7-seat anti-monarchy (`<50%`) & anti-duopoly (`>= 3` seats), `NESTOR` unbiased stochastic rounding & Popoviciu variance bound $\Delta^2/4$, universal Ungar $K=-1$ Poincaré-disk Möbius containment $D^2 - |N|^2 = (S^2 - |u|^2)(S^2 - |v|^2)D > 0$, and Glitchling's `backwards` involution & `leaky` contraction.
3. **Independent Exact Python Reference Oracles (`reference/glitchling_oracle.py`):** Zero-shared-code exact `Fraction`, Gaussian-integer, and complex Kronecker-product solvers match `live/js/` to `3.44e-15` (7-site FMO GKSL + zero-parameter adiabatic Pauli–Förster), `9.99e-16` (`8×8` Cry4 Haberkorn parity & Larmor RF collapse), and `9.71e-17` (Poincaré Möbius addition), alongside exact `Hoggar` (`63/315` frustrated lines, $\beta_{\text{NCHV}} = 189$) and 4-qubit $C_3$ cospectral twins ($\operatorname{Tr}\Lambda^3 = 14,976$ vs `15,360`).
4. **Multi-Cohort Lesion/Emergent Experiments (`T1–T15`) & Verification Ladder:** `26/26` contrasts separated honestly into `[M]` mathematical, `[D]` designed lesion, and `[E]` emergent A-Life tiers (`T11` Bedau–Packard activity, `T12c/d` 3-edge TE, `T13` divergent natural selection, `T14` ontogenetic learning, `T15b` 3-trophic Ecology-of-Fear fruit cascade); post-`F03` `T5` no-signaling resolved via analytical Bonferroni $\alpha = 0.001$ two-proportion binomial $Z < 4.26$ (`Z_max = 3.21` Cohort A, `2.39` Cohort B); `1,200` JS property tests, `9/9` `pytest`/`hypothesis` tests, and `8/8` killed semantic mutants.
5. **Honest Epistemic Verdict:** Cross-checking all `1,900` open problems in `0thernes/unsolved-problems-mega-atlas` (`docs/MEGA_ATLAS_CROSSCHECK.md`) establishes honestly **`0 / 1,900` open problems solved**. No claims of consciousness, sentience, feelings, AGI, or physical quantum biology are made.

---

## Companion Navigation
- Full mathematical proofs, tables, figures, and citations: [`paper/main.tex`](main.tex) / [`dist/Donahue_2026_glitchling_alife_verification.pdf`](../dist/Donahue_2026_glitchling_alife_verification.pdf)
- Claims & falsification criteria (`C1–C10`): [`CLAIMS.md`](../CLAIMS.md)
- Statement-to-Lean fidelity map: [`docs/statement-fidelity.md`](../docs/statement-fidelity.md)
- Mega-Atlas 1,900-problem cross-check: [`docs/MEGA_ATLAS_CROSSCHECK.md`](../docs/MEGA_ATLAS_CROSSCHECK.md)
- Clean-clone replication protocol: [`REPLICATION.md`](../REPLICATION.md)
- 3-cycle hardening review (`F24/F30/F33–F40`): [`docs/reviews/2026-11-25-3cycle-hardening-audit.md`](../docs/reviews/2026-11-25-3cycle-hardening-audit.md)
