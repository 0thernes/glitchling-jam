# Literature Search & Prior-Art Attribution Log (`docs/LITERATURE_SEARCH.md`)

Structured audit log of primary literature consulted and verified across Glitchling's mathematical, physical, coding-theoretic, ecological, and formal-verification subsystems (Playbook v1.3 Item 25). Every DOI in `paper/refs.bib` is machine-verified against the live Crossref REST API by `scripts/audit_citations.py` -> [`results/citation-audit.json`](../results/citation-audit.json) (`18/18` live Crossref DOIs HTTP 200 with balanced-brace title match, `3` non-DOI classics, `0` retractions).

## 1. Search Scope & Databases Queried
- **Sources:** Crossref REST API (`api.crossref.org/works/<doi>`), arXiv/APS/World Scientific/MIT Press/Nature/PNAS bibliographic indices, and `0thernes/unsolved-problems-mega-atlas` (`1,900` indexed open problems across 20 STEM domains, audited in [`docs/MEGA_ATLAS_CROSSCHECK.md`](MEGA_ATLAS_CROSSCHECK.md)).
- **Attribution Rule:** Glitchling claims **zero** original discovery of the classical theorems below; our contribution is their integrated, differentially tested, pure zero-Mathlib Lean 4.35.0 formalization and honest empirical A-Life falsification.

## 2. Prior-Art Mapping by Domain

| Domain | Foundational Prior Art (`paper/refs.bib`) | Role in Glitchling | Verification Status |
|---|---|---|---|
| **Kochen–Specker Contextuality** | Cabello, Estebaranz & García-Alcaine (1996), *Phys. Lett. A* (`10.1016/0375-9601(96)00134-X`) | Literal 18 rays & 9 contexts (`CEGA-18`) in `qgtl.js` and `Spec.lean` | Proved constructively in Lean 4.35.0 (`8 < 9`) + exhaustive $2^{18}$ Python oracle |
| **Bell / CHSH Nonlocality** | Clauser, Horne, Shimony & Holt (1969), *Phys. Rev. Lett.* (`10.1103/PhysRevLett.23.880`) | Exact LHV ceiling $|S|\le 2$ (`75%` game cap) and Bell-diagonal no-signaling (`T5`) | Proved in Lean 4.35.0 + Bonferroni binomial $Z < 4.26$ (`F33/D10`) |
| **Open Quantum Systems (FMO)** | Adolphs & Renger (2006), Plenio & Huelga (2008), Wu, Liu, Shen, Cao & Silbey (2010), Duan et al. (2017) | 7-site FMO GKSL Lindblad vs. zero-parameter adiabatic Pauli–Förster (`world.js`) | Differential JS vs. $49\times 49$ Python Kronecker oracle (`3.44e-15`) |
| **Radical-Pair Magnetoreception (Cry4)** | Ritz, Adem & Schulten (2000), Ritz et al. (2004), Hore & Mouritsen (2016) | $8\times 8$ Liouville–Haberkorn model with inversion symmetry & Larmor RF collapse (`heptarch.js`) | Differential JS vs. $64\times 64$ Python Kronecker oracle (`9.99e-16`) |
| **Algebraic Error-Correcting Codes** | Reed & Solomon (1960), *J. SIAM* (`10.1137/0108018`) | Systematic `RS[15,11,d=5]` over $\mathbb{F}_{16}$ (`0x13`), error radius $t = 2$ | Complete $\mathbb{F}_{16}$ axioms proved in Lean 4.35.0 + $300/300$ burst recovery |
| **Hyperbolic Gyrovector Geometry** | Ungar (2008), *Analytic Hyperbolic Geometry and Albert Einstein's Special Theory of Relativity* (`10.1142/6625`; `F41` DOI error fixed) | Exact $K = -1$ Poincaré-disk Möbius addition (`qgtl.js`) | Universal polynomial norm-gap identity proved over $\mathbb{Z}$ in Lean 4.35.0 + exact `Fraction` oracle (`9.71e-17`) |
| **Artificial Life & Evolutionary Activity** | Bedau, Snyder & Packard (1998), *ALIFE VI* | Neutral-shadow evolutionary activity (`T11`) | Paired $N=24$ cohort test ($d_z = 1.45$, $p_{\text{Bonf}} = 5.25\times 10^{-5}$) |
| **Information Flow & Predictive Coding** | Schreiber (2000), Rao & Ballard (1999), Kuleshov, Fenner & Ermon (2018) | 3-edge sensorimotor Transfer Entropy (`T12c/d`), predictive-coding error (`T14`), ECE calibration (`T12b`) | Multi-cohort $N=36$ causal lesion & surrogate tests |
| **Evolutionary Game Theory & Trophic Ecology** | Press & Dyson (2012), Schmitz, Beckerman & O'Brien (1997), Brown, Laundré & Gurung (1999) | Sanctioned IPD Titans (`T10a`) & unprogrammed 3-trophic Ecology-of-Fear cascade (`T15b`) | Lean 4.35.0 payoff dominance + $N=36$ emergent fruit biomass cascade ($d_z=3.26$) |
| **Numerical Stability, Statistics & Formal Verification** | Kahan (1965), Holm (1979), de Moura & Ullrich (2021) | Compensated summation, Holm–Bonferroni multiple-testing control, Lean 4 kernel | Enforced across `live/`, `tools/results_stats.mjs`, and `lean/` (6 kernels) |

## 3. Automated Citation Audit Catch (`F41`)
During `v2.3.0`, live Crossref verification (`scripts/audit_citations.py`) caught a subtle DOI mismatch on `Ungar2008` (`10.1142/6768` resolved to a different World Scientific monograph). Replacing it with `10.1142/6625` achieved `18/18` verified live Crossref DOI matches with `0` retractions.
