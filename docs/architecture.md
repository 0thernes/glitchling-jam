# Architecture (`docs/architecture.md`)

`glitchling-jam` (`v2.2.0`) combines four execution layers under one unified, five-tier verification discipline (`Build Standard A20`):

```mermaid
flowchart TD
  A["Reference Sim (glitchling.ts + frozen core/)"] -->|BUN_JSC_useConcurrentJIT=0| B["Results v3 (30 seeds 500-529)"]
  B --> C["tools/results_stats.mjs & plot.py"]
  D["Interactive 2D Port (play/)"] -->|Fisher-Yates + clamped URL| E["Zero-build Browser UI"]
  F["Live 3D Bio-Observatory (live/)"] --> G["Spiking Brains (S..GIGA) + FEM + Vascular/LBM"]
  F --> H["HEPTARCH v0.2 + NESTOR 23-Rung + RS[15,11] + Cry4 + Levin"]
  F --> I["Geodesic Biodome (11-pool Ledger, FMO ENAQT, Contextuality, 4 Kingdoms)"]
  J["Lean 4.35.0 Formal Core (lean/)"] -->|59 decls + Challenge/Solution| K["leanchecker + lake comparator"]
  L["Independent Python Oracle (reference/)"] -->|Kronecker + Fraction| M["Differential JS vs Python (<1e-15)"]
  N["JS Verification Ladder (live/test/verification_ladder.mjs)"] -->|1200 props + 8/8 mutants| O["CI & AMS-LaTeX White Paper (paper/, dist/)"]
```

## Module Boundaries
1. **Frozen Core (`core/`):** Read-only copy of Creature #1 (`Asmodensius-v40/creatures/001/organism`). Never modified in this repository (`F18/D8`).
2. **Reference Subclass (`glitchling.ts`):** Adds four toggleable flaws (`scramble`, `leaky`, `backwards`, `misfire`) and repeatable CSV/JSON output (`results/summary.csv`, `results/results.json`).
3. **2D Browser Port (`play/`):** Self-contained HTML/JS/CSS educational explorer with Fisher–Yates world generation (`F03`) and clamped URL parameters (`F15`).
4. **3D Bio-Observatory (`live/`):** Modular zero-build ES modules (`live/js/sim/*.js`, `live/js/tsotchke/*.js`) rendered via vendored Three.js r170 and p5.js v1.11.3, verified by `live/test/{verification_ladder,lesion_experiments,dome_heptarch_probe,dome_ui_check}.mjs`.
5. **Formal & Oracle Verification (`lean/`, `reference/`, `scripts/`, `tests/`):** Pure Lean `v4.35.0` proofs (zero Mathlib), exact `Fraction`/Kronecker Python oracle, and cross-platform CI.
6. **Publication Pipeline (`paper/`, `dist/`):** Vector matplotlib figures (`scripts/generate_figures.py`), zero-warning AMS-LaTeX manuscript (`paper/main.tex`), frozen PDF, and standalone-verified arXiv tarball (`scripts/package_dist.py`).
