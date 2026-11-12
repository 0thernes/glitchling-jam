# Glitchling

A deliberately broken baby clone of Alex Donahue's A-Life **Creature #1**, built in a one-day jam (Nov 1, 2026). It has four engineered flaws you can switch on and off:

- **scramble**: senses read through a random permutation plus noise, re-shuffled every 90 ticks
- **leaky**: learned values decay toward their prior by 6% per tick
- **backwards**: the 8 MOT motor neurons read out reversed, and the chosen site is mirrored (k → 15−k)
- **misfire**: every 60 ticks, one site value and 20 random synapses get a jolt

## Live

- Landing page: https://0thernes.github.io/glitchling-jam/
- **Glitchling v2 (live 3D soft-body & spiking brain):** https://0thernes.github.io/glitchling-jam/live/
- **Play the 2D sim:** https://0thernes.github.io/glitchling-jam/play/
- Jam showcase: https://0thernes.github.io/glitchling-jam/site/
- Brain viz (real activation playback): https://0thernes.github.io/glitchling-jam/brain-viz/

The play page runs in any modern browser (phone or desktop), with no build step, no external libraries and no network calls. You can toggle each flaw, adjust its period or leak rate, change the seed, pause, step, speed up, and tap the world to drop food. It shows the creature foraging, a live 272-neuron brain view by region, and live glucose, reward and success charts. Settings are saved in the URL, e.g. `play/?seed=7&flaws=backwards,scramble`.

## Real vs simulated (please read)

- **`play/` is a simplified JavaScript port** written for exploring the flaws interactively. It is **not** the TypeScript reference run, and its numbers will not match the published results.
  - *Kept from the reference:* 16 sites (4 colours × 4 shapes) with the same reward formula, depletion and the days 1–3 half-access pattern; 1 tick = 1 sim-minute; the 272-neuron layout in the same 14 regions with the reference's region-to-region connection probabilities; the four flaws applied the way `glitchling.ts` applies them; seeded mulberry32 RNG with a separate flaw stream.
  - *Simplified or invented:* rate-unit neurons instead of the spiking substrate; a 3-pool toy metabolism; a noisy value race instead of the striatal spike race and expected-free-energy terms; the walking body, 2D map and click-to-drop food; MOT as an 8-way heading code.
- **The results tables, plots and brain-viz playback come from the TypeScript sim** (`glitchling.ts` subclassing `core/organism.ts`, a copy of the Creature #1 organism). n = 2 seeds per condition, so they are a toy, not a finding.
- Some renders in the showcase are driven by **synthetic** data; they are labelled SYNTHETIC on the page.
- No claims of consciousness, sentience or feelings are made for Glitchling or Creature #1.

## Run the reference sim locally

```bash
bun run glitchling.ts 2 2     # days=2, seeds=2 -> results/results.json, results/summary.csv
python plot.py                # -> results/glitchling.png, results/cursed_portrait.png
```

## Layout

| Path | What |
|---|---|
| [`GLITCHLING_MASTER_COMPENDIUM.md`](GLITCHLING_MASTER_COMPENDIUM.md), [`docs/`](docs/) | **Complete 6-File Architecture & Development Compendium of All 29 Research PDFs (`1,932` pages)**: [`01_NESTOR_HEPTARCH_WISHLIST_OMNIHARNESS.md`](docs/01_NESTOR_HEPTARCH_WISHLIST_OMNIHARNESS.md), [`02_FRONTIER_LINEAGE25_SUBSTRATES_GLITCHES.md`](docs/02_FRONTIER_LINEAGE25_SUBSTRATES_GLITCHES.md), [`03_ALIFE_V3_BLUEPRINT_CREATURE1_100PASSES.md`](docs/03_ALIFE_V3_BLUEPRINT_CREATURE1_100PASSES.md), [`04_QUANTUM_2050_HYPERION_CONTEXTUALITY_KS.md`](docs/04_QUANTUM_2050_HYPERION_CONTEXTUALITY_KS.md), and [`05_EMBODIED_CORTEX_CQM_DOME_VERIFICATION.md`](docs/05_EMBODIED_CORTEX_CQM_DOME_VERIFICATION.md) |
| `live/` | Glitchling v2 live 3D A-Life Bio-Observatory, **Layer-1 Geodesic Biodome & HEPTARCH v0.2 Organism** (`436`–`14,156,048` 16-compartment branched HH+NMDA+SK + discrete integer binomial Markov spiking neurons / up to **`1,132,483,840` (`1.13B`)** plastic Int8+CSR synapses & spine-turnover masks in mouse-cortex-scale `GIGA`, **HEPTARCH v0.2 7-seat capped council** (`max π_m ≤ 0.46`) + Raider 6-phase `ColdStrike` + **NESTOR 23-rung adaptive precision governor** + `DSD/RSR` + `Exuvia` escape + **`RS[15,11,d=5]` `GF(16)` acoustic ECC** + **`Cryptochrome-4` nocturnal compass** + **`Levin V_mem` blastema limb regeneration**, LTC CPG, 85–93-node / 336–360-tet anisotropic 3D FEM body + 32 Henneman motor-unit fascicles + Huxley sarcomeres + 36-node / 64-vessel 3D Murray's-Law vascular tree + `24×8×8` `D3Q19` LBM FSI & `1,024` WCSPH differentiated erythrocytes (`896`) + chemotactic leukocytes (`128`), dual `256×128` (`65,536`-receptor / `196,608`-RGC) foveated retinas → `V1→V2→V4→65,536-concept grounded semantic ontology DAG IT + Perirhinal` + EKF-SLAM, histological `32,768`-neuron spiking hippocampal–subicular loop (`16,384` DG with adult neurogenesis + `6` GABAergic interneuron classes + Predictive Successor Representation), `797k`–`29.06M` (`omega`) Multimodal RoPE-SwiGLU Transformer-XL world model (`32×16×3` Spatial-Pyramid Patch-VAE + 4-step Rectified Flow-Matching video head + `+300.0 s` Neuro-Symbolic HTN + Depth-5 UCT MCTS planner), 128-gene Single-Cell Zygote Cleavage (`1→128` blastomeres) + Gastrulation + `Hox` GRN (`0L`–`10L` clades + Patagium wings + Angler Esca), **Geodesic Biodome** (`R = 21.6 u`, **11-pool `FP64` Kahan First-Law energy ledger `< 1e-12` closure**, Daisyworld biotic albedo, FMO vibronic-ENAQT, 16-spin p-bit Ising mycelia, 3 physics-seam Anomaly Tori, 2 `Big-Tree` Sanctuaries, 4 Quantum Monoliths + `C3` cospectral twins, 6 lithic `DomeStones`, 4 `DomeCaches`), **5-Caste colony + 4 Multi-Kingdom Dome species** (`Xenomimics` Bell twins, `Xylos` 48-foci Poincaré gliders, `Titans` IPD colossi, `Shoggoths` deceptive ambushers), `Three.js` HDR16F + `4096×4096` PCF soft shadows + Sky PMREM IBL + 12-tap GTAO + FidelityFX CAS + Display-P3 + 4K UHD + `p5.js` 5-tab studio, and 16Q WASM / 18Q WebGPU + Qutrit DRAG (`25.6×`) + PEC (`10.7×`) + ZNE (`7.7×`) + **KCBS / CEGA-18 / Hoggar contextuality** + **32-Qubit ($\chi=32$) Vidal MPS with Verstraete–Cirac bound & 2-Rényi Magic $M_2$**; see [`live/README.md`](live/README.md)) |
| `play/` | Live playable 2D browser port (`sim.js` model, `app.js` UI, `style.css`) |
| `site/` | One-day jam showcase page |
| `brain-viz/` | Real activation playback viewer |
| `glitchling.ts`, `core/` | TypeScript reference sim |
| `results/`, `results_v1/` | Sim outputs |
| `art/`, `artifacts/`, `research/` | Art, renders, research notes and reference images |
| `NOTES.md`, `BLUEPRINT.md`, `BRAINS.md`, `WRITEUP.md` | Jam notes and design docs |
