# Submission & Archival Readiness Ledger — Glitchling (`v2.3.0`)

**Author:** Alexander Stephen Donahue (`Independent Researcher`, Spokane, WA, USA)  
**ORCID:** [`0009-0006-8168-9648`](https://orcid.org/0009-0006-8168-9648)  
**Contact:** `0_0@0thernes.art` · [`https://github.com/0thernes/glitchling-jam`](https://github.com/0thernes/glitchling-jam)  
**Status:** Independent computational-science & formal-verification preprint (**not peer-reviewed**; zero external DOIs claimed; AI-assisted under direct human direction and independently certified by 6 Lean kernels + cross-platform CI).

## Verification Gates Summary

| Gate | Requirement | Artifact / Command | Status |
|---|---|---|---|
| **Formal Proofs (6 Kernels)** | Pure zero-Mathlib Lean 4.35.0, `autoImplicit = false`, 0 `sorry`, 0 `native_decide`, standard axioms `[propext, Classical.choice, Quot.sound]` | `lean/` (`72` decls incl. 6 `NonVacuity`, 6 `AdversarialTests`, 9 `Challenge`/`Solution` targets), `lake comparator --config comparator.json --paranoid` (`Lean paranoid`, `lean4lean`, `nanoda`, `con-leche`, `con-ron`, `Lean default`), `results/lean_axioms.txt` | **PASS** |
| **Live Negative Tamper CI** | Injecting `sorry` into `Solution.lean` is rejected by `VerifyAxioms.lean` and `lake comparator --paranoid` | `scripts/test_lean_negative.py --with-comparator` | **PASS** |
| **Independent Exact Oracle** | Zero shared JS code; exact `Fraction` / Gaussian-int / complex Kronecker vs. `live/js/` | `reference/glitchling_oracle.py`, `scripts/verify_exact.py` (`3.44e-15` FMO, `9.99e-16` Cry4, `9.71e-17` Möbius), `pytest tests/test_oracle.py` (`9/9`) | **PASS** |
| **JS Verification Ladder** | Property checks, boundary guards, regressions, metamorphic symmetries, mutation testing | `live/test/verification_ladder.mjs` (`1,200` props, `7` negative, `7` regressions, `4` metamorphic, `8/8` mutants killed) | **PASS** |
| **Multi-OS CI & Repo Health** | Ubuntu, Windows, macOS syntax, links, secrets, honesty guard, determinism, Bun ref-sim | `tools/check.mjs` (`9/9`), `.github/workflows/ci.yml` | **PASS** |
| **Citation Integrity** | Live Crossref HTTP 200, balanced-brace title match, zero retractions | `scripts/audit_citations.py` -> `results/citation-audit.json` (`18/18` DOIs verified, `3` non-DOI, `0` retractions; caught & fixed `F41`) | **PASS** |
| **AMS-LaTeX Preprint & arXiv Bundle** | Zero warnings, zero overfull/underfull hboxes, standalone clean-room tarball compile | `paper/main.tex`, `dist/Donahue_2026_glitchling_alife_verification.pdf`, `dist/arxiv_submission.tar.gz`, `scripts/package_dist.py` | **PASS** |
| **Cryptographic Provenance** | LF-canonical SHA-256 manifests, DigiCert RFC 3161 TSA timestamp, SLSA v4 attestation | `CHECKSUMS.sha256`, `data/MANIFEST.sha256`, `data/timestamps/CHECKSUMS.sha256.tsr`, `.github/workflows/release.yml` | **PASS** |
| **Build Standard v1.2.0** | Automated 90-item repo compliance audit | `scripts/Audit-Repo.ps1` / `scripts/audit-repo.sh` (`100.0%`, `77/77` applicable, `33/33` core) | **PASS** |
| **Mega-Atlas Honesty Check** | Explicit 1,900-problem cross-check, zero hype, no consciousness/AGI claims | `docs/MEGA_ATLAS_CROSSCHECK.md` (`0 / 1,900` open problems solved), `CLAIMS.md`, `LIMITATIONS.md` | **PASS** |

## External Archival Notes
- **GitHub Release & SLSA Provenance:** Automated on every `v*` tag via `.github/workflows/release.yml` (`actions/attest-build-provenance@v2` -> GitHub Attestations + Sigstore Rekor transparency log).
- **Master Research Archive:** Registered as `0TH-BUILD-013_glitchling-jam` in `https://github.com/0thernes/0thernes-research-archive`.
- **Software Heritage:** The public unauthenticated `archive.softwareheritage.org` endpoint is protected by an Anubis proof-of-work gate and is submitted manually via browser at `https://archive.softwareheritage.org/save/` rather than automated scraping.
