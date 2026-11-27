# Datasheet for Glitchling Datasets & Verification Artifacts (`DATASHEET.md`)

Structured following Gebru et al. (2021), *Datasheets for Datasets*, and Playbook v1.3 Item 34.

## 1. Motivation
- **Purpose:** Provide reproducible, auditable empirical datasets and exact cryptographic verification receipts for the Glitchling artificial-life reference simulation (`Results v3`), single-seed neural activation trajectories, multi-cohort 3D Biodome lesion experiments, exact-oracle differential logs, warmed microbenchmarks, and 6-kernel Lean 4.35.0 axiom audits.
- **Creators:** Alexander Stephen Donahue (`Independent Researcher, Spokane, WA, USA`, ORCID `0009-0006-8168-9648`, `0_0@0thernes.art`).
- **Funding:** Unfunded independent research; zero external grants or commercial sponsors.

## 2. Composition
All tracked data files are small, human-inspectable UTF-8 CSV/JSON/text files verified by SHA-256 manifests (`CHECKSUMS.sha256` and `data/MANIFEST.sha256`):

| File | Records / Size | Description | Generation Command |
|---|---|---|---|
| `results/summary.csv` | `210` rows (`7` conditions × `30` dev seeds `500..529`) | Repeatable Bun reference-sim outcomes (`alive`, `forages`, `rewards`, `successRate`, `glucose`, half-life splits) | `BUN_JSC_useConcurrentJIT=0 bun run glitchling.ts 500` |
| `results/results.json` | `210` structured records | Machine-readable JSON mirror of `results/summary.csv` | `BUN_JSC_useConcurrentJIT=0 bun run glitchling.ts 500` |
| `results/activations_allflaws_seed1.json` | 1 trajectory (`2,880` ticks) | Real recorded spike/activation telemetry played by `brain-viz/` | `bun run glitchling.ts` (seed 1 dump) |
| `artifacts/artificial-life/glitchling-behavior.csv` & `glitchling-summary.json` | Structured A-Life archive snapshots | Canonical behavior summary linked to `site/` & `results/` | Generated during `Results v3` pipeline |
| `results/lean_axioms.txt` | `72` Lean 4.35.0 `#print axioms` lines | Verbatim kernel axiom audit for all 63 library theorems + 9 comparator targets | `cd lean && lake env lean VerifyAxioms.lean` |
| `results/citation-audit.json` | `21` bibliography entries (`18` DOIs, `3` non-DOI) | Live Crossref API HTTP 200, balanced-brace title match, and retraction audit | `python scripts/audit_citations.py` |
| `results/perf-benchmarks.json` | `7` warmed benchmark rows | Hardware-tagged median/IQR/p95 timings (100+ reps after warmup) | `npm run bench` |
| `data/timestamps/CHECKSUMS.sha256.tsr` & `.ots` | Binary cryptographic proofs | Independent DigiCert RFC 3161 TSA token and Bitcoin OpenTimestamps proof over `CHECKSUMS.sha256` | `python scripts/timestamp_checksums.py` |

- **Personal / Sensitive Data:** **None.** All data are 100% synthetic simulation trajectories, mathematical proofs, or bibliographic metadata. Zero human subjects, zero animal subjects, zero PII.
- **Missing Values / Errors:** `0` missing rows (`210/210` complete runs). Earlier `Results v2` (`n = 2`) findings that failed replication at `n = 30` are documented in [`ERRATA.md`](ERRATA.md) and [`DEVIATIONS.md`](DEVIATIONS.md).

## 3. Collection & Preprocessing
- **Determinism Controls:** Reference-sim runs pin `BUN_JSC_useConcurrentJIT=0` (mitigating `F31`). Browser/Node `live/` modules enforce seeded PRNGs (`0` `Math.random` calls across `live/js/{sim,tsotchke}` and `live/test/evolve_gait.mjs`).
- **Pre-processing:** Raw CSV rows are analyzed without outlier trimming or winsorization by `node tools/results_stats.mjs` (paired $t$-CIs, Cohen's $d_z$, and $200{,}000$-draw sign-flip permutation tests).

## 4. Uses & Out-of-Scope Uses
- **Intended Uses:** Replicating Glitchling statistical summaries, benchmarking neural/physics submodules, cross-checking Lean 4.35.0 proofs and independent Python oracles, and educational exploration of A-Life verification methodology.
- **Prohibited / Out-of-Scope Claims:** Must NOT be cited as evidence of artificial consciousness, sentience, AGI, physical quantum biology in living organisms, or resolution of any open problem in `0thernes/unsolved-problems-mega-atlas`.

## 5. Distribution & Maintenance
- **Distribution:** Public GitHub repository (`https://github.com/0thernes/glitchling-jam`), GitHub Releases with SLSA v4 build provenance attestations, and mirrored frozen copies in `0thernes/0thernes-research-archive` (`0TH-BUILD-015_glitchling-jam`).
- **License:** Frozen Cosmogonic Non-Commercial License ([`LICENSE`](LICENSE), byte-identical to `0thernes/CQM2`; see [`docs/adr/0001-cosmogonic-license.md`](docs/adr/0001-cosmogonic-license.md)).
- **Integrity Check:** Verify all files offline via `sha256sum -c CHECKSUMS.sha256 && sha256sum -c data/MANIFEST.sha256 && python scripts/timestamp_checksums.py --verify-only`.
