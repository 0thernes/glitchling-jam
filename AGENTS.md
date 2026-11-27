# AGENTS.md — Glitchling Engineering & Scientific Verification Guide

> Canonical agent instruction entry point (`A32` of Build Standard `v1.2.0`). `CLAUDE.md`, `GEMINI.md`, and `.cursor/rules/build-standard.mdc` reference this file.

## 1. Project Identity & Scope
- **Project:** **Glitchling** (`0thernes/glitchling-jam`, `v2.4.0`) — a deliberately broken baby clone of A-Life Creature #1 (`glitchling.ts` + frozen `core/`), 2D browser port (`play/`), 3D soft-body & spiking-brain Geodesic Biodome (`live/`), pure 6-kernel Lean 4.35.0 formal core (`lean/`), interactive Blueprint (`blueprint/`), independent exact Python oracle (`reference/`), and AMS-LaTeX preprint (`paper/`, `dist/`).
- **Author & Affiliation:** Alexander Stephen Donahue (`Alexander S. Donahue`), ORCID [`0009-0006-8168-9648`](https://orcid.org/0009-0006-8168-9648), **Independent Researcher, Spokane, WA, USA** (`0_0@0thernes.art`, `https://0thernes.art`, `https://github.com/0thernes`). Do not assert an unformed LLC entity as a legal affiliation in manuscripts or active metadata.
- **License:** `COSMOGONIC LICENSE — NON-COMMERCIAL RESEARCH & PLAY` ([`LICENSE`](LICENSE)), byte-identical to `0thernes/CQM2`. Do not modify `LICENSE`.

## 2. Hard Rules (Non-Negotiable — Build Standard R1–R8 + Repo Boundaries)
- **Frozen `core/` (`F18/D8`):** NEVER modify any file inside `core/`. It is a frozen Creature #1 copy pending Phase 1 re-vendor from `bc6ad6a`.
- **R1 — Solo Dev Ergonomics:** Never install git hooks, branch protection, commit/tag signing, or blocking lint/SAST CI gates. Static linters & secret scans in CI remain **report-only** (`continue-on-error: true`).
- **R2 — Direct to `main`:** Commit and push straight to `main`. Zero PRs, zero feature branches, zero `.github/pull_request_template.md`.
- **R3 — Tests Block; Linters Report:** Functional checks (`npm test`, `npm run verify:ladder`, `verify_exact.py`, `pytest`, Lean 4 kernel/comparator, Tectonic PDF) catch broken invariants; style/static linters report without blocking.
- **R4 — No Banned Files:** Never add Dependabot, Renovate, PR templates, Copilot instructions, `FUNDING.yml`, or `CODEOWNERS`.
- **R5 — Ten-Class Finding Taxonomy:** Tag every audit finding with exactly one of: `bug`, `error`, `issue`, `problem`, `concern`, `dilemma`, `conflict`, `gap`, `hole`, `blindspot`.
- **R6 — Never Fabricate / Zero Hype:** Never claim consciousness, sentience, feelings, AGI, physical quantum effects, or solved Mega-Atlas problems (`0 / 1,900` solved). Always label `MEGA`/`GIGA` synapse totals as **nominal** alongside stored counts.
- **R7 — Lean 4 Kernel Integrity:** Zero `sorry`, `admit`, `axiom`, `native_decide`, `unsafe`, `implemented_by`, or `@[extern` in `lean/GlitchlingProofs*.lean` and `lean/Solution.lean` (`lean/Challenge.lean` intentionally holds specification `sorry`s matched by `lake comparator --paranoid`). All audited axioms strictly inside `[propext, Classical.choice, Quot.sound]`.
- **R8 — Preserve Author Identity & License:** Keep `VERSION` (`2.4.0`), `LICENSE`, and ORCID `0009-0006-8168-9648` synchronized everywhere (enforced by `scripts/check_versions.py`).

## 3. Repository Map

| Path | Responsibility |
|---|---|
| `glitchling.ts`, `core/` | TypeScript reference sim (frozen `core/` Creature #1 copy; run with `BUN_JSC_useConcurrentJIT=0`) |
| `live/` | Live 3D Bio-Observatory, spiking brains (`S..GIGA`), HEPTARCH v0.2, NESTOR, Biodome, & probes (`live/test/`) |
| `play/`, `site/`, `brain-viz/` | Zero-build static browser pages (2D port, jam showcase, real activation playback) |
| `lean/` | Pure Lean 4.35.0 formal core (0 Mathlib, 11 Palomar `module` files, 72 audited decls, 6-kernel `lake check` & `Challenge`/`Solution` comparator) |
| `blueprint/` | Interactive Lean 4 Proof Blueprint & dependency graph deployed on GitHub Pages (`/blueprint/`, verified by `scripts/check_blueprint_decls.py`) |
| `reference/`, `tests/` | Independent exact-arithmetic / Kronecker Python oracle (`glitchling_oracle.py`) + `pytest`/`hypothesis` suite |
| `scripts/`, `tools/` | `tools/check.mjs`, `tools/results_stats.mjs`, `scripts/{verify_exact.py,bench.mjs,generate_figures.py,package_dist.py,check_readme_axioms.py,Audit-Repo.ps1,audit-repo.sh}` |
| `paper/`, `dist/` | AMS-LaTeX white paper (`main.tex`, `refs.bib`, `WHITE_PAPER.md`), vector figures, frozen PDF & arXiv tarball |
| `AUDIT/`, `docs/` | 35-pass audit (`AUDIT/`), 3-cycle hardening review (`docs/reviews/`), Mega-Atlas cross-check, ADRs, preregistration, benchmarks, threat model |

## 4. Exact Verification Commands

```bash
npm test                                               # 9/9 repo health, determinism & Bun ref-sim check
npm run verify:ladder                                  # 1,200 props + negative + regression + 8/8 killed mutants
npm run examples                                       # 3 runnable Node examples
npm run bench                                          # warmed micro-benchmarks -> results/perf-benchmarks.json
python scripts/verify_exact.py                         # exact oracle + JS differential + Lean static + CSV audit
python -m pytest tests/test_oracle.py -v               # Hypothesis property & metamorphic tests
cd lean && lake build GlitchlingProofs Challenge Solution && lake env lean VerifyAxioms.lean
pwsh -NoProfile -File scripts/Audit-Repo.ps1 -Path .   # Build Standard v1.2.0 90-item repo audit
```

## 5. Known Technical Traps
1. **PowerShell Bracket Paths:** On Windows paths containing `[Vibe Coded (AI)]`, always use `-LiteralPath` with PowerShell file cmdlets.
2. **Bun Concurrent JIT (`F31`):** Always pass `BUN_JSC_useConcurrentJIT=0` when running `glitchling.ts`.
3. **Seeded RNG Required (`F30`):** Never invoke `quantizeNestorRung` on stochastic rungs or `chooseSafeCospectralObelisk` fallback without an explicit seeded PRNG.
4. **LF Line Endings & Checksums:** Keep Unix `LF` (`\n`) on text files so `CHECKSUMS.sha256` and `data/MANIFEST.sha256` remain byte-exact cross-platform.
