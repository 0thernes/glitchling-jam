# Changelog (repository level)

The detailed per-pass history of the live 3D sim is in [`live/CHANGELOG.md`](live/CHANGELOG.md). This file records repository-wide changes. Dates are US Pacific.

## [2.2.0] - 2026-11-25: 3-Cycle Hardening, Lean 4.35.0 Formal Core, Python Oracle, Build Standard v1.2.0 & AMS-LaTeX Preprint

### Added
- **Pure Lean 4.35.0 formal core (`lean/`):** 59 exported kernel-checked declarations (`51` library theorems + `8` isolated `Challenge`/`Solution` comparator targets) across `EnergyMassConservation`, `QuantumContextuality`, `CodingAndGovernance`, and `HyperbolicAndFlaws` (zero Mathlib, zero `sorry`, zero `native_decide`, `autoImplicit = false`, strictly `[propext, Classical.choice, Quot.sound]`, passing `leanchecker --fresh`). Verbatim output saved in `results/lean_axioms.txt` and guarded by `scripts/check_readme_axioms.py`.
- **Independent Python reference oracle (`reference/glitchling_oracle.py`, `scripts/verify_exact.py`, `tests/test_oracle.py`):** Exact `Fraction` / Gaussian-integer / complex-Kronecker solvers differentially verifying `live/js/` to `3.44e-15` (FMO), `9.99e-16` (Cry4), and `9.71e-17` (Poincaré), plus `pytest`/`hypothesis`, `ruff`, and strict `mypy`.
- **JS Verification Ladder (`live/test/verification_ladder.mjs`):** 1,200 seeded property tests, 7 negative/boundary guards, 7 bug regressions (`F03, F15, F16, F27, F30, F33, F34`), 4 metamorphic invariants, and `8/8` killed semantic mutants.
- **Warmed Benchmarks (`scripts/bench.mjs`):** Hardware-tagged median/IQR/p95 timings saved to `results/perf-benchmarks.json` and `docs/benchmarks.md`.
- **Mega-Atlas 1,900-Problem Cross-Check (`docs/MEGA_ATLAS_CROSSCHECK.md`):** Honest verdict **`0 / 1,900` solved**, with scoped overlap table and explicit non-claims.
- **Build Standard v1.2.0 Full Compliance (`repo.yaml`, `VERSION`, `CLAIMS.md`, `LIMITATIONS.md`, `REPLICATION.md`, `VERIFICATION.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `CITATION.cff`, `justfile`, `examples/`, `docs/adr/0001..0005`, `docs/reviews/2026-11-25-3cycle-hardening-audit.md`, cross-platform CI + Pages + Release workflows, `docs/media/social-preview.png`).**
- **Publication-Grade AMS-LaTeX Preprint (`paper/main.tex`, `paper/refs.bib`, `paper/WHITE_PAPER.md`, `dist/Donahue_2026_glitchling_alife_verification.pdf`, `dist/arxiv_submission.tar.gz`).**

### Fixed
- **F34 (Windows CI/CLI bug):** Fixed `tools/check.mjs` Windows `ENOENT` crash (`fileURLToPath`), backslash link normalization, and `~/.bun/bin/bun.exe` detection (`9/9 PASS` on Windows).
- **F33/D10 (T5 no-signaling gate):** Replaced miscalibrated ad-hoc `maxEmpNoSig < 0.11` with exact analytical Bonferroni $\alpha = 0.001$ two-proportion binomial critical bound `maxNoSigZ < 4.26` (verified PASS on Cohort A `Z_max = 3.21` and Cohort B `Z_max = 2.39`).
- **F30 (RNG fallback hole):** Removed unused `Math.random` default fallbacks in `live/js/sim/heptarch.js` and `live/js/tsotchke/qgtl.js` (now throw `TypeError` without a seeded PRNG; `0` `Math.random` occurrences across `live/js/{sim,tsotchke}`).
- **F24/D7 (Beacon label):** Reworded opt-in button in `live/index.html` to *"Fetch public randomness beacons"*.
- **F35 (Doc conflict):** Updated stale `Results v2` mentions in `README.md` and `site/index.html` to `Results v3`.
- **F36 (Media hygiene `A24`):** Optimized five >5 MB media assets below 5 MB (`2560×1440` PNGs / `1440×1440` Purkinje / `2.71 MB` H.264 MP4) and updated `site/index.html` dimensions/captions honestly.

## 2026-11-24 (evening): Alex's decisions D1–D5, D9 and D3

- **Licence, F04/D4:** added `LICENSE`, a byte-identical copy of the Cosmogonic License from `0thernes/CQM2` (non-commercial research and play). The README and `package.json` point to it.
- **Images, F05/D5:** removed the 26 unsourced figures in `research/img/alex/`. The text notes that described them are kept and marked "(image removed)". The files are still in git history.
- **Names, F02/D1:** `live/test/nobel_rigor_suite.mjs` is now `live/test/lesion_experiments.mjs` (`npm run lesion`), and "theorem" is now "experiment" in the suite, READMEs, dossier and `live/CHANGELOG.md`.
- **Synapse headlines, F01/D2:** the README, live README, brain-scale dropdown, spike-panel label and stats panel say "nominal" for the MEGA/GIGA synapse totals and show the stored count (GIGA: 28,131 stored plus 113M Int8 cluster weights, against 1.13B nominal).
- **Results v3, F31/D9:** the reference sim was re-run with 30 dev seeds (500–529) in repeatable mode (`BUN_JSC_useConcurrentJIT=0`). Two simultaneous runs were byte-identical. New `tools/results_stats.mjs` reports mean, SD, 95% CI and paired d_z. With all flaws on: forages +22% [16%, 27%], success 0.299 vs 0.365, rewards about the same, 210/210 runs alive. The v2 hint of within-life compensation did not replicate and was withdrawn. `glitchling.ts` takes an optional first-seed argument. The CI check now compares seeds 500–501 with the committed rows.
- **live/ world shuffle, F03/D3:** `live/js/sim/world.js` now uses a seeded Fisher–Yates shuffle, so Chrome and Safari build the same world. Every seeded world changed. The `live/` numbers were re-measured before and after the fix (`live/CHANGELOG.md`, last entry). nav, the dome probe and all 15 lesion-experiment summaries still pass, but one soft gate (T5 finite-sample no-signaling, 0.138 against 0.11) now fails. It was not retuned, and the decision is left to Alex (F33/D10).
- **F31 scope:** corrected the audit text that said Creature #1 runs were "probably affected". Per Alien Life 1-100, the scored Asmodensius runs use node bundles and pass an identity gate. The risk is to bun runs on `organism.ts`. A warning note for Argon was written on Alex's laptop (outside this repo).

## 2026-11-24: hardening audit

Findings are in [`AUDIT/FINDINGS.md`](AUDIT/FINDINGS.md) and the method is in [`AUDIT/PASSES.md`](AUDIT/PASSES.md).

### Added
- `AUDIT/INDEX.md`: table of contents of all tracked files, with size, language, purpose and test coverage. It is generated by `AUDIT/tools/index.py`.
- `tools/check.mjs` with `npm test`: 9 automated checks. One of them re-runs the TypeScript reference sim; see F31 for why it pins `BUN_JSC_useConcurrentJIT=0`.
- `.github/workflows/ci.yml`: runs the checks on every push and pull request.
- `CONTRIBUTING.md` (fetch-before-push rule, honesty rules), `SECURITY.md`, root `package.json`, README badges.
- `AUDIT/tools/pages_check.mjs`: loads every page headless at phone and desktop sizes.

### Fixed
- **Reproducibility, F31:** CI showed that the reference sim is not deterministic under Bun (it depends on JIT timing). `npm test` now checks it is deterministic with `BUN_JSC_useConcurrentJIT=0` and that its output is sane. README and site state that the committed results are one realization, with the measured spread across 11 re-runs.
- **Honesty, F01:** the MEGA and GIGA synapse totals (16.78M, "1.13B") are now labelled nominal (set by formula) everywhere they are shown. Measured explicit synapses: 30,554 and 28,131.
- **Honesty, F02:** added a plain-language note that the rigor-suite "theorems" are statistical tests on designed contrasts inside the simulation.
- **play/, F03:** the world shuffle no longer depends on the browser's sort algorithm. Chrome and Safari used to build different worlds for 186 of 200 seeds.
- **play/ and live/, F15 and F16:** URL and seed inputs are clamped, so `?leak=10000` can no longer push the sim into NaN.
- **site/, F11:** no sideways scroll on phones.
- **brain-viz/, F12 and F26:** viewport, `lang`, description, canvas label, and a title that no longer says "SIMULATED" while it plays real data.
- **Accessibility, F13 and F14:** labels for the 3 flaw-parameter inputs and the 8 panel canvases on `/live/`.
- **Docs, F09, F10 and F27:** removed references to an unpublished `results_v1/`, replaced a private box path in the public run instructions, and corrected stale 14-qubit comments.
- **Attribution, F06:** `research/img/SOURCES.md` now credits the author of each of the 17 Commons images. All licences were re-checked against Commons.
- **Verification records:** CI is green (9/9). The rigor suite T1–T13 passes on re-run. `nav_probe` arrival counts reproduce, but its times do not (F28). No NaN in 4 × 120-s runs. The 8 owner decisions are listed in `AUDIT/FINDINGS.md` (D1–D8).
- **Probe, F17:** `live/test/symmetry_probe.mjs` defaults to `wave` instead of printing `undefined`.
