# Operations, Backups, Archival Mirror & Rollback Runbook (`docs/operations.md`)

`glitchling-jam` is a static site + local computational research suite (`service: false`, `personal_data: false`) archived across multiple independent layers (`Build Standard A35, A36`).

## 1. Archival & Offsite Mirror Strategy
1. **Canonical Git Remote:** `https://github.com/0thernes/glitchling-jam` (`main` branch, linear history per Hard Rule `R2`).
2. **Master Research Archive Registration:** Frozen manuscript PDFs, pinned commit SHAs, SHA-256 digests, and CI run links are registered in `https://github.com/0thernes/0thernes-research-archive` (local: `0thernes-research-archive`).
3. **Software Heritage Offsite Mirror:** Public commits and release tags are submitted to Software Heritage (`https://archive.softwareheritage.org/save/`) for persistent content-addressed `SWHID` preservation.
4. **Offline Git Bundle Backup:** Create a full self-contained portable mirror bundle at any time:
   ```bash
   git bundle create ../glitchling-jam-v2.2.0.bundle --all
   git bundle verify ../glitchling-jam-v2.2.0.bundle
   ```

## 2. Cryptographic Integrity Checksums
- `CHECKSUMS.sha256` covers frozen publication artifacts (`dist/*.pdf`, `dist/arxiv_submission.tar.gz`, `results/lean_axioms.txt`, `results/perf-benchmarks.json`).
- `data/MANIFEST.sha256` covers committed experimental datasets (`results/summary.csv`, `results/results.json`, `results/activations_allflaws_seed1.json`, `artifacts/artificial-life/glitchling-summary.json`).
- Verify both manifests on Linux/macOS with `sha256sum -c CHECKSUMS.sha256 && sha256sum -c data/MANIFEST.sha256` (or via `scripts/verify_exact.py`).

## 3. Safe Rollback Procedure (`A36`)
Because `main` preserves linear non-rewritten history (never force-pushing public releases):
```bash
just rollback v2.1.0
# Or manually create a clean forward revert commit:
git revert --no-commit v2.1.0..HEAD
git commit -m "revert: restore v2.1.0 verified state"
git push origin main
```
