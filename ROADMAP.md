# Roadmap

**Maintenance Status:** `active` (v2.4.0, Nov 26, 2026).

## Completed Milestones
- **v1.0.0 (2026-11-01):** One-day jam clone (`glitchling.ts`, `core/`), 2D browser port (`play/`), Tsotchke portraits (`art/`), brain-viz playback (`brain-viz/`), showcase (`site/`).
- **v2.0.0 (2026-11-12 – 2026-11-23):** Live 3D Bio-Observatory (`live/`), Passes 2–22 (3D FEM body, spiking brains `S..GIGA`, HEPTARCH v0.2, NESTOR 23-rung governor, Geodesic Biodome, 15-experiment multi-cohort lesion/emergent suite `T1–T15`).
- **v2.1.0 (2026-11-24):** 35-pass external hardening audit (`AUDIT/`), Cosmogonic License (`F04`), Results v3 30-seed repeatable run (`F31`), Fisher–Yates world shuffle (`F03`), nominal vs stored synapse labels (`F01`), `lesion_experiments.mjs` rename (`F02`).
- **v2.2.0 – v2.3.0 (2026-11-25 – 2026-11-26):** 3-cycle hardening audit, pure zero-Mathlib Lean 4.35.0 formal core (`lean/`, expanded to 72 audited declarations incl. 6 `NonVacuity` & 6 `AdversarialTests` + 9 isolated `Challenge`/`Solution` targets passing all 6 independent kernels + live negative tamper CI), independent exact Python Kronecker/rational oracle (`reference/glitchling_oracle.py`), 1,200+ property + 8/8 mutant JS verification ladder, live Crossref DOI audit (`18/18` verified, `F41` fix), DigiCert RFC 3161 TSA timestamp, SLSA provenance (`#72663345` / Rekor `4126405071`), Mega-Atlas cross-check (`0/1,900` solved), Build Standard v1.2.0 (`100%`), AMS-LaTeX preprint, and master archive registration (`0TH-BUILD-015`).
- **v2.4.0 (2026-11-26):** Playbook v1.3 & Build Standard v1.2.0 full deep hardening (`F42–F52`): 0-error `repo.yaml` Draft 2020-12 JSON Schema validation, Palomar `module` headers across all 11 `.lean` files + `formalization.yaml` + `lake check --paranoid`, interactive GitHub Pages Lean Blueprint (`/blueprint/` + `check_blueprint_decls.py`), `DEVIATIONS.md`, `DATASHEET.md`, `codemeta.json`, `.zenodo.json`, Bitcoin OpenTimestamps `.ots` + DigiCert `.tsr`, clickable `plainurl` DOIs in PDF, NeurIPS/Literature/10-Pass review logs, strict CSP meta headers on all HTML pages, seeded `evolve_gait.mjs`, and `FULL=1` 20/20 live Dome+HEPTARCH re-verification.

## Planned / Open Milestones
- **Phase 1 `core/` re-vendor (`F18/D8`, on hold):** Re-vendor `core/` from the frozen Creature #1 pin `bc6ad6a` once Asmodensius Phase 1 concludes.
- **Full post-F03 3-cohort (`SEEDS=1..36`) re-run of `T1–T15`:** Run full 3-cohort multi-hour sweep on the Fisher–Yates world (`F03`) and analytical `T5` binomial $Z$-gate (`F33`), archiving full JSON outputs alongside pre-F03 Pass 22 data.
- **Cross-engine Bun/Node reference bundle (`F31`):** Provide an optional esbuild Node bundle target for `glitchling.ts` mirroring Asmodensius `identity_gate.sh` to eliminate JSC JIT variance entirely.
- **State stream v2 exporter:** Emit real `results/state_v2.jsonl` directly from `glitchling.ts` so the v4 studio renders no longer rely on `synthetic/state_v2.synthetic.jsonl`.
