# Submission & Archival Readiness Ledger — Glitchling (`v2.4.0`)

**Author:** Alexander Stephen Donahue (`Independent Researcher`, Spokane, WA, USA)  
**ORCID:** [`0009-0006-8168-9648`](https://orcid.org/0009-0006-8168-9648)  
**Contact:** `0_0@0thernes.art` · [`https://github.com/0thernes/glitchling-jam`](https://github.com/0thernes/glitchling-jam)  
**Status:** Independent computational-science & formal-verification preprint (**not peer-reviewed**; zero external DOIs claimed; AI-assisted under direct human direction and independently certified by 6 Lean kernels + cross-platform CI).

## Verification Gates Summary

| Gate | Requirement | Artifact / Command | Status |
|---|---|---|---|
| **Formal Proofs (6 Kernels + Palomar Modules)** | Pure zero-Mathlib Lean 4.35.0 with Palomar `module` headers across all 11 `.lean` files, `autoImplicit = false`, strict unused/deprecated linters, 0 `sorry`, 0 `native_decide`, standard axioms `[propext, Classical.choice, Quot.sound]` | `lean/` (`72` decls incl. 6 `NonVacuity`, 6 `AdversarialTests`, 9 `Challenge`/`Solution` targets), `formalization.yaml`, `lake check --paranoid` + `lake comparator --config comparator.json --paranoid` (`Lean paranoid`, `lean4lean`, `nanoda`, `con-leche`, `con-ron`, `Lean default`), `results/lean_axioms.txt` | **PASS** |
| **Live Negative Kernel & Tamper CI** | Rejects BOTH a deliberately false theorem AND a `sorry`-tampered `Solution.lean` via `VerifyAxioms.lean` and `lake comparator --paranoid` | `scripts/test_lean_negative.py --with-comparator` | **PASS** |
| **Interactive Lean Blueprint & `checkdecls`** | Zero-CDN interactive dependency DAG + 1-to-1 declaration fidelity check against `lean/` and `results/lean_axioms.txt` | `blueprint/index.html`, `blueprint/blueprint.json`, `scripts/check_blueprint_decls.py` (`17` nodes, `93` declaration links) | **PASS** |
| **Independent Exact Oracle** | Zero shared JS code; exact `Fraction` / Gaussian-int / complex Kronecker vs. `live/js/` | `reference/glitchling_oracle.py`, `scripts/verify_exact.py` (`3.44e-15` FMO, `9.99e-16` Cry4, `9.71e-17` Möbius), `pytest tests/test_oracle.py` (`9/9`) | **PASS** |
| **JS Verification Ladder & Full Probe** | Property checks, boundary guards, regressions, metamorphic symmetries, mutation testing, 20 Dome+HEPTARCH gates | `live/test/verification_ladder.mjs` (`1,200` props, `7` negative, `7` regressions, `4` metamorphic, `8/8` mutants killed), `FULL=1 node tools/check.mjs` (`20/20` gates) | **PASS** |
| **Schema, Version & Identity Parity** | `repo.yaml` Draft 2020-12 JSON Schema (`0` errors), 13-file single-version parity (`2.4.0`), active identity hygiene | `scripts/check_versions.py`, `repo-standard.schema.json`, `codemeta.json`, `.zenodo.json`, `CITATION.cff`, `CITATION.bib` | **PASS** |
| **Citation Integrity & Clickable DOIs** | Live Crossref HTTP 200, balanced-brace title match, zero retractions, clickable DOIs in compiled PDF (`plainurl`) | `scripts/audit_citations.py` -> `results/citation-audit.json` (`18/18` DOIs verified, `3` non-DOI, `0` retractions; caught & fixed `F41`), `docs/LITERATURE_SEARCH.md` | **PASS** |
| **AMS-LaTeX Preprint & arXiv Bundle** | Zero warnings, zero overfull/underfull hboxes, standalone clean-room tarball compile, Threats to Validity, Export-Control (`15 CFR 734.8`), CRediT & Withdrawal statements | `paper/main.tex`, `dist/Donahue_2026_glitchling_alife_verification.pdf`, `dist/arxiv_submission.tar.gz`, `scripts/package_dist.py` | **PASS** |
| **Dual Cryptographic Timestamps & Provenance** | LF-canonical SHA-256 manifests, DigiCert RFC 3161 TSA (`.tsr`), Bitcoin OpenTimestamps (`.ots`), SLSA v4 attestation | `CHECKSUMS.sha256`, `data/MANIFEST.sha256`, `data/timestamps/CHECKSUMS.sha256.{tsr,ots}`, `scripts/timestamp_checksums.py`, `.github/workflows/release.yml` | **PASS** |
| **Playbook v1.3 & Build Standard v1.2.0** | Automated 90-item repo compliance audit + Playbook v1.3 governance artifacts (`DEVIATIONS.md`, `DATASHEET.md`, `NEURIPS_CHECKLIST.md`, strict HTML CSP) | `scripts/Audit-Repo.ps1` / `scripts/audit-repo.sh` (`100.0%`, `77/77` applicable, `33/33` core), `docs/reviews/2026-11-26-10-pass-playbook-review.md` | **PASS** |
| **Mega-Atlas Honesty Check** | Explicit 1,900-problem cross-check, zero hype, no consciousness/AGI claims | `docs/MEGA_ATLAS_CROSSCHECK.md` (`0 / 1,900` open problems solved), `CLAIMS.md`, `LIMITATIONS.md` | **PASS** |

## External Archival Notes
- **GitHub Release & SLSA Provenance:** Automated on every `v*` tag via `.github/workflows/release.yml` (`actions/attest-build-provenance@v2` -> GitHub Attestations + Sigstore Rekor transparency log), attaching PDF, arXiv tarball, `lean_axioms.txt`, `citation-audit.json`, `perf-benchmarks.json`, `CHECKSUMS.sha256`, `.tsr`, `.ots`, `formalization.yaml`, and `codemeta.json`.
- **Master Research Archive:** Registered as `0TH-BUILD-015_glitchling-jam` in `https://github.com/0thernes/0thernes-research-archive`.
- **Software Heritage:** The public unauthenticated `archive.softwareheritage.org` endpoint is protected by an Anubis proof-of-work gate and is submitted manually via browser at `https://archive.softwareheritage.org/save/` rather than automated scraping.
