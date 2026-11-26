# Glitchling (v2.2.0) — Canonical Task Runner (`justfile`, Build Standard A31/A36/B01)
set shell := ["bash", "-euo", "pipefail", "-c"]
set windows-shell := ["pwsh", "-NoProfile", "-Command"]

default:
    @just --list

# Verify toolchain versions
setup:
    node --version
    python3 --version || python --version

# Core repository health check (9/9 checks including determinism & repeatable Bun ref sim)
test:
    npm test

# JS Verification Ladder (1,200 properties + negative + regressions + metamorphic + 8/8 killed mutants)
ladder:
    npm run verify:ladder

# Run all 3 runnable examples
examples:
    npm run examples

# Run warmed micro-benchmarks -> results/perf-benchmarks.json
bench:
    npm run bench

# Independent textbook Python oracle + JS differential check + Lean static audit + pytest
oracle:
    python3 scripts/verify_exact.py || python scripts/verify_exact.py
    python3 -m pytest tests/test_oracle.py -v || python -m pytest tests/test_oracle.py -v

# Recompute Results v3 paired statistics
stats:
    npm run stats

# Build & audit pure Lean 4.35.0 formal core (59 decls + leanchecker)
lean:
    cd lean && lake build GlitchlingProofs Challenge Solution && lake env lean VerifyAxioms.lean && lake env leanchecker --fresh GlitchlingProofs && lake env leanchecker --fresh Solution

# Rebuild vector figures, zero-warning AMS-LaTeX PDF, and standalone-verified arXiv tarball
paper:
    python3 scripts/generate_figures.py || python scripts/generate_figures.py
    python3 scripts/package_dist.py || python scripts/package_dist.py

# One-command full deterministic reproduction (Build Standard B01)
reproduce: test ladder examples oracle bench stats lean paper
    python3 scripts/check_readme_axioms.py || python scripts/check_readme_axioms.py

# Serve static site locally on port 8000
serve:
    npm run serve

# Run Build Standard v1.2.0 90-item repo audit
audit:
    bash scripts/audit-repo.sh .

# Rollback release/deployment safely to a prior verified tag (Build Standard A36)
rollback tag="v2.1.0":
    @echo "Inspecting target tag {{tag}} before rollback..."
    git show --stat {{tag}}
    @echo "To roll back main cleanly while preserving history, run: git revert --no-commit {{tag}}..HEAD && git commit -m 'revert: rollback to {{tag}}' && git push origin main"

# Remove temporary build caches (never deletes tracked dist/ or results/)
clean:
    rm -rf paper/build .pytest_cache .mypy_cache .ruff_cache
