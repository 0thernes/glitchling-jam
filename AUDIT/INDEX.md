# AUDIT/INDEX.md: table of contents of every tracked file

Generated from `git ls-tree -r -l HEAD` by `AUDIT/tools/index.py`. 299 tracked files, 189.9 MB.

Test coverage key: **direct** = imported by a `live/test/*.mjs` probe; **indirect** = imported (transitively) by a directly covered module; **page** = exercised by the headless page check (`AUDIT/tools/pages_check.mjs`); **none** = no automated check.

## Contents

- [.github](#github) (1 files)
- [(root)](#root) (17 files)
- [art](#art) (7 files)
- [artifacts](#artifacts) (69 files)
- [brain-viz](#brain-viz) (4 files)
- [core](#core) (33 files)
- [data](#data) (3 files)
- [docs](#docs) (5 files)
- [live/](#live) (5 files)
- [live/js](#live-js) (34 files)
- [live/test](#live-test) (32 files)
- [live/vendor](#live-vendor) (15 files)
- [play](#play) (4 files)
- [research](#research) (47 files)
- [results](#results) (5 files)
- [site](#site) (15 files)
- [synthetic](#synthetic) (2 files)
- [tools](#tools) (1 files)

## .github

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `.github/workflows/ci.yml` | 621 | .yml |  | n/a (data/asset/doc) |

## (root)

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `.gitignore` | 115 | - |  | n/a (data/asset/doc) |
| `.nojekyll` | 0 | - |  | n/a (data/asset/doc) |
| `BLUEPRINT.md` | 50,199 | Markdown | Glitchling v2 — BLUEPRINT | n/a (data/asset/doc) |
| `BRAINS.md` | 41,386 | Markdown | BRAINS.md: a shared brain-design compendium for CQM, A-Life Creature #1 and Glitchling | n/a (data/asset/doc) |
| `CONTRIBUTING.md` | 2,142 | Markdown | Contributing to glitchling-jam | n/a (data/asset/doc) |
| `GLITCHLING_MASTER_COMPENDIUM.md` | 16,595 | Markdown | GLITCHLING MASTER COMPENDIUM — Complete 29-PDF Synthesis (`1,932` Pages) for Glitchling, Creatures/Entities/Be | n/a (data/asset/doc) |
| `HANDOFF_GEMINI_ARGON_ANTIGRAVITY.md` | 78,908 | Markdown | Glitchling handoff: Grok Bot → Gemini Argon 4 (Antigravity) | n/a (data/asset/doc) |
| `HANDOFF_QUICKSTART.md` | 5,450 | Markdown | Glitchling: handoff QUICKSTART (for Gemini Argon 4 in Antigravity) | n/a (data/asset/doc) |
| `NOTES.md` | 27,006 | Markdown | Glitchling: one-day jam coordination doc | n/a (data/asset/doc) |
| `README.md` | 8,486 | Markdown | Glitchling | n/a (data/asset/doc) |
| `SCIENTIFIC_DEFENSE_DOSSIER.md` | 25,343 | Markdown | Glitchling v2 · Scientific Defense Dossier (Pass 22) | n/a (data/asset/doc) |
| `SECURITY.md` | 829 | Markdown | Security policy | n/a (data/asset/doc) |
| `WRITEUP.md` | 992 | Markdown | Glitchling | n/a (data/asset/doc) |
| `glitchling.ts` | 8,216 | TypeScript (Bun) | Glitchling: a deliberately broken baby clone of Creature #1 (copied core in ./core, unmodified except import p | none |
| `index.html` | 5,311 | HTML | Page: Glitchling | page |
| `package.json` | 468 | JSON |  | n/a (data/asset/doc) |
| `plot.py` | 2,108 | Python 3 | cursed portrait: neuron activations of the all-flaws episode folded into a face-ish heatmap, with channel-shif | none |

## art

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `art/glitchling_1.png` | 19,591 | PNG image |  | n/a (data/asset/doc) |
| `art/glitchling_2.png` | 19,908 | PNG image |  | n/a (data/asset/doc) |
| `art/glitchling_3.png` | 19,767 | PNG image |  | n/a (data/asset/doc) |
| `art/glitchling_4.png` | 20,582 | PNG image |  | n/a (data/asset/doc) |
| `art/glitchling_5.png` | 20,407 | PNG image |  | n/a (data/asset/doc) |
| `art/glitchling_6.png` | 20,874 | PNG image |  | n/a (data/asset/doc) |
| `art/glitchling_sheet.png` | 111,780 | PNG image |  | n/a (data/asset/doc) |

## artifacts

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `artifacts/artificial-life/glitchling-behavior.csv` | 73,659 | CSV |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/glitchling-summary.json` | 548 | JSON |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-hero-4k.json` | 995 | JSON |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-hero-4k.png` | 993,113 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-hero-v3-4k.json` | 1,016 | JSON |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-hero-v3-4k.png` | 9,593,259 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-v4-clip-1080p.mp4` | 7,207,105 | MP4 video |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-v4-clip.json` | 169 | JSON |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-v4-still.json` | 154 | JSON |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-v4-t720-4k.png` | 8,005,927 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/hdr/glitchling-v4-t800-4k.png` | 7,745,837 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/render-hero-v3.mjs` | 2,254 | JavaScript (ESM, Node) |  | none |
| `artifacts/artificial-life/render-hero.mjs` | 1,801 | JavaScript (ESM, Node) |  | none |
| `artifacts/artificial-life/render-v4.mjs` | 3,580 | JavaScript (ESM, Node) |  | none |
| `artifacts/artificial-life/render.mjs` | 3,423 | JavaScript (ESM, Node) |  | none |
| `artifacts/artificial-life/shot.mjs` | 1,847 | JavaScript (ESM, Node) |  | none |
| `artifacts/artificial-life/v1-toy/glitchling-behavior.csv` | 17,259 | CSV |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v1-toy/glitchling-browser-state.json` | 365 | JSON |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v1-toy/glitchling-closeup.png` | 448,049 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v1-toy/glitchling-mini-world.png` | 582,947 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v1-toy/glitchling-summary.json` | 537 | JSON |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0000.png` | 2,231,059 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0001.png` | 2,146,275 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0002.png` | 2,128,118 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0003.png` | 2,107,949 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0004.png` | 2,102,755 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0005.png` | 2,176,251 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0006.png` | 2,178,947 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0007.png` | 2,053,018 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0008.png` | 2,039,901 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0009.png` | 2,164,553 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0010.png` | 2,169,700 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0011.png` | 2,155,469 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0012.png` | 2,151,612 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0013.png` | 2,083,156 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0014.png` | 2,101,462 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0015.png` | 2,175,556 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0016.png` | 2,200,121 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0017.png` | 2,124,057 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0018.png` | 2,135,137 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0019.png` | 2,199,176 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0020.png` | 2,204,633 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0021.png` | 2,139,255 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0022.png` | 2,127,489 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0023.png` | 2,221,465 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0024.png` | 2,356,639 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0025.png` | 2,324,375 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0026.png` | 2,336,178 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0027.png` | 2,260,795 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0028.png` | 2,255,309 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0029.png` | 2,194,331 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0030.png` | 2,160,694 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0031.png` | 2,194,374 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0032.png` | 2,168,759 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0033.png` | 2,127,301 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0034.png` | 2,125,925 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0035.png` | 2,149,981 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0036.png` | 2,175,491 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0037.png` | 2,223,779 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0038.png` | 2,255,333 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0039.png` | 2,249,847 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0040.png` | 2,270,613 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0041.png` | 2,310,034 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0042.png` | 2,346,874 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0043.png` | 2,218,850 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0044.png` | 2,218,145 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0045.png` | 2,244,438 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0046.png` | 2,246,981 | PNG image |  | n/a (data/asset/doc) |
| `artifacts/artificial-life/v4-clip-frames/f0047.png` | 2,273,045 | PNG image |  | n/a (data/asset/doc) |

## brain-viz

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `brain-viz/brain.js` | 9,803 | JavaScript (ESM) | Glitchling brain viz — SIMULATED. Real MLP forward passes on seeded random weights. | page |
| `brain-viz/data.js` | 216,336 | JavaScript (ESM) | generated from results/activations_allflaws_seed1.json (verbatim) | page |
| `brain-viz/index.html` | 1,788 | HTML | Page: Glitchling · Brain Viz (real playback + labelled simulated mode) | page |
| `brain-viz/screenshot.png` | 90,461 | PNG image |  | n/a (data/asset/doc) |

## core

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `core/affect.ts` | 12,424 | TypeScript (Bun) | v4.0 layered affect + dysregulation (one original design; DELARP-PLAN Part XI). | none |
| `core/develop.ts` | 6,104 | TypeScript (Bun) | v4.0 developmental wiring (Asmodensius-original rules; concepts: chemoaffinity, Sperry 1963 PNAS 50:703; grade | none |
| `core/fp/allo.ts` | 1,212 | TypeScript (Bun) | Isolated CQM10 module (original code): one-compartment glucose with an insulin controller (own basal 0.3) and  | none |
| `core/fp/aom.ts` | 1,845 | TypeScript (Bun) | AOM: action-outcome model for site choice. Per-site base yield (Kalman, random-walk drift q) x shared learned  | none |
| `core/fp/aom_iso.ts` | 2,513 | TypeScript (Bun) | Isolation: depleting 16-site bandit with the creature's statistics (p = 0.05 + 0.25 cv/3 + 0.25 sv/3; success  | none |
| `core/fp/cur.ts` | 939 | TypeScript (Bun) | FIRST-PRINCIPLES curiosity (original code). Idea inspired by Alex Donahue's SUPER CREATURE online next-beat se | none |
| `core/fp/dev_hot1.ts` | 1,866 | TypeScript (Bun) | Isolated dev test for the HOT-1 module on the HOT1 stream (noisy one-hot, sd 0.4; 200 trials; MSE on trials 14 | none |
| `core/fp/dev_hot3.ts` | 2,199 | TypeScript (Bun) | Isolated dev test for HOT-3R. Stream: 4-way noisy cue (amplitude 0.5-1.2, noise sd 0.3); first-order choice =  | none |
| `core/fp/dev_l4.ts` | 1,834 | TypeScript (Bun) | Isolated dev test: percept accuracy from the input layer (online normalised LMS read-out, as the creature's re | none |
| `core/fp/dev_rpt2.ts` | 1,604 | TypeScript (Bun) | Isolated dev test: XOR(a,b) read-out accuracy (logistic LMS, trained trials 0-159, scored 160-219) after T=3 t | none |
| `core/fp/dev_tpc.ts` | 2,794 | TypeScript (Bun) | Isolated TPC checks. A: delayed match (cue 4 ticks, blank delay, cue recurs as probe): decode cue from h at de | none |
| `core/fp/dmul.ts` | 395 | TypeScript (Bun) | DMUL: two-compartment dendritic coincidence (Larkum 1999; Larkum 2013). y = relu(basal) * sigmoid(gA*(apical - | none |
| `core/fp/dmul_iso.ts` | 2,571 | TypeScript (Bun) | Isolation: modules A,B each with 13 cells coding a (or b) with noise. 26 DMUL cells: basal from own module, ap | none |
| `core/fp/efm.ts` | 5,862 | TypeScript (Bun) | EFM: forward model trained in sleep by exact BPTT (Werbos 1990) + Adam (Kingma & Ba 2015). The training math i | none |
| `core/fp/efm_check.ts` | 2,567 | TypeScript (Bun) | Oracle check: TS BPTT gradient of EFM vs Eshkol exact reverse-mode `gradient` on random windows. | none |
| `core/fp/efmv_check.ts` | 777 | TypeScript (Bun) | Finite-difference check of EFMV.gradV (the scalar EFM path is Eshkol-verified; same cell code). | none |
| `core/fp/eshkol_meal.ts` | 5,089 | TypeScript (Bun) | Isolation (1): dream-trained forward model, meal 3 ticks ahead on a jittered schedule. A = TS TPC (NLMS on res | none |
| `core/fp/eshkol_roll.ts` | 4,818 | TypeScript (Bun) | Isolation (2) rollout action choice and (3) error-predicting confidence; Eshkol exact gradients. | none |
| `core/fp/glc_probe.ts` | 812 | TypeScript (Bun) | B27 diagnostic: is v6.0 over-eating? Fraction of minutes with glucose above / below the C10 band, ATP < 1.5, S | none |
| `core/fp/hot1.ts` | 1,666 | TypeScript (Bun) | FIRST-PRINCIPLES HOT-1 module (isolated). Percept = posterior mean E[clean / x] under a learned generative mod | none |
| `core/fp/hot3.ts` | 1,462 | TypeScript (Bun) | FIRST-PRINCIPLES HOT-3 module (isolated). Metacognitive opt-out: keep P(correct / confidence bin) by delta rul | none |
| `core/fp/l4.ts` | 1,279 | TypeScript (Bun) | FIRST-PRINCIPLES cue-encoding module (isolated): a cortical input layer (L4-like) that receives the module's o | none |
| `core/fp/l5.ts` | 1,979 | TypeScript (Bun) | L5 conjunctive output pool: y = softplus(basal) * sigmoid(gA * apical). Graded, unsaturated (Larkum 2013 apica | none |
| `core/fp/l5_iso.ts` | 2,235 | TypeScript (Bun) | Isolation: modules A,B (13 noisy tuned cells each, centred). Readout = 26 raw rates + two 8-unit L5 pools (A b | none |
| `core/fp/ltc.ts` | 1,553 | TypeScript (Bun) | Isolated LTC module (original code). Claim (Hasani et al. 2021): an input-dependent time constant beats any fi | none |
| `core/fp/probe_ainf.ts` | 1,104 | TypeScript (Bun) | B23 diagnostic: AINF protocol (deplete, 480 + 2 days) reward and forage count under probes; dev seeds 3445-346 | none |
| `core/fp/rpt2.ts` | 5,980 | TypeScript (Bun) | FIRST-PRINCIPLES RPT-2 module (isolated): two modules, each with N rectified units driven by its own feature;  | none |
| `core/fp/sgd_iso.ts` | 3,423 | TypeScript (Bun) | B23 isolation: surprise-gated dendritic covariance learning (phasic LC-NE at stimulus change gates Oja plastic | none |
| `core/fp/tpc.ts` | 3,096 | TypeScript (Bun) | Temporal predictive core (TPC). One general mechanism: a recurrent state h driven by input x and by its OWN le | none |
| `core/organism.ts` | 152,111 | TypeScript (Bun) | ===== Creature 001 organism v3.2 (v3.0 core + v3.1 Mind layer + v3.2 decision/replay fixes): one coupled, dete | none |
| `core/substrate.ts` | 3,336 | TypeScript (Bun) | v4.0 substrate senses: the creature feels the machine it runs on. Sandboxed, read-only. | none |
| `core/tsotchke.ts` | 1,704 | TypeScript (Bun) | Tsotchke adapter (v5.1). Engine-agnostic: the brain calls ent(); this file decides where the bits come from. | none |
| `core/v40mods.ts` | 11,840 | TypeScript (Bun) | v4.0 plan Parts VII–X, first causal implementations (Asmodensius-original designs; concepts cited in ORIGINS.m | none |

## data

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `data/areas.json` | 95,024 | JSON |  | n/a (data/asset/doc) |
| `data/areas_table.md` | 24,088 | Markdown |  | n/a (data/asset/doc) |
| `data/build_areas.py` | 22,982 | Python 3 | Generates data/areas.json + BLUEPRINT table rows. Spec: id/area/system/attr=var>couples;...  '*' prefix on var | none |

## docs

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `docs/01_NESTOR_HEPTARCH_WISHLIST_OMNIHARNESS.md` | 17,534 | Markdown | Volume 1 — NESTOR v0.1, Future Wishlist v0.2, Embodied Omni-Harness & HEPTARCH v0.2 | n/a (data/asset/doc) |
| `docs/02_FRONTIER_LINEAGE25_SUBSTRATES_GLITCHES.md` | 13,672 | Markdown | Volume 2 — 2026 Frontier Sweep, 25-Species Lineage Ledger, Post-Quantum Substrates & Reality-Glitch Dome Laws | n/a (data/asset/doc) |
| `docs/03_ALIFE_V3_BLUEPRINT_CREATURE1_100PASSES.md` | 13,963 | Markdown | Volume 3 — Clean-Slate A-Life v3.0, Creature Blueprint & Asmodensius 100-Pass Dossier | n/a (data/asset/doc) |
| `docs/04_QUANTUM_2050_HYPERION_CONTEXTUALITY_KS.md` | 13,677 | Markdown | Volume 4 — Quantum 2050, HYPERION-OMEGA, Quantum Biology & Kochen–Specker / Hoggar Contextuality | n/a (data/asset/doc) |
| `docs/05_EMBODIED_CORTEX_CQM_DOME_VERIFICATION.md` | 18,264 | Markdown | Volume 5 — Embodied Cortex, Colony, CQM Biodome & Simulation Verification | n/a (data/asset/doc) |

## live/

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `live/CHANGELOG.md` | 121,737 | Markdown | Glitchling v2 · live — change log | n/a (data/asset/doc) |
| `live/README.md` | 29,446 | Markdown | Glitchling v2 · live | n/a (data/asset/doc) |
| `live/index.html` | 18,326 | HTML | Page: Glitchling v2 · Live 3D A-Life Bio-Observatory | page |
| `live/package.json` | 33 | JSON |  | n/a (data/asset/doc) |
| `live/style.css` | 13,710 | CSS |  | n/a (data/asset/doc) |

## live/js

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `live/js/app.js` | 59,332 | JavaScript (ESM) | ---------------------------------------------------------------- O(1) region lookup & overflow-safe raster buc | page |
| `live/js/audio.js` | 9,108 | JavaScript (ESM) | Procedural WebAudio Bio-Acoustic Syrinx & Biosphere Soundscape (pass 17) | page |
| `live/js/honesty.js` | 20,251 | JavaScript (ESM) | The real-vs-simplified lists shown on the page and in the README. Keep these accurate when the code changes. | page |
| `live/js/lineage.js` | 16,057 | JavaScript (ESM) | In-page 128-gene Zygote-Cleavage + Gastrulation + Hox-GRN Evo-Devo body + brain co-evolution (upgraded in pass | page |
| `live/js/p5_layer.js` | 28,465 | JavaScript (ESM) | p5.js Procedural Living Biomaterial Textures & Interactive A-Life Telemetry Studio (pass 18) | page |
| `live/js/render.js` | 151,605 | JavaScript (ESM) | Next-Gen Three.js + p5.js HDR16F / PMREM Sky IBL / 4K UHD Bio-Observatory Renderer (Pass 19) | page |
| `live/js/sim/body.js` | 41,993 | JavaScript (ESM) | Soft body (Pass 19): 336–360-Element Anisotropic Fiber-Reinforced (I4) 3D Volumetric Neo-Hookean Finite-Elemen | direct (gait_probe.mjs, physics_probe.mjs, roll_probe.mjs, symmetry_) |
| `live/js/sim/brain.js` | 83,554 | JavaScript (ESM) | Spiking substrate (pass 19: 16-compartment branched dendritic cable arbours + exact discrete integer Gillespie | indirect |
| `live/js/sim/brain_worker.js` | 6,518 | JavaScript (ESM) | Off-main-thread Web Worker host for the spiking Brain (S / M / L / XL / XXL / MEGA / GIGA up to 14,156,048 neu | page |
| `live/js/sim/cpg.js` | 3,040 | JavaScript (ESM) | Central pattern generator built from liquid time-constant (LTC) neurons (Hasani et al. 2021), integrated with  | indirect |
| `live/js/sim/creature.js` | 85,986 | JavaScript (ESM) | Glitchling v2 "live" (pass 19 architecture): | direct (babble_probe.mjs, brain_probe.mjs, climb_probe.mjs, dome_hep) |
| `live/js/sim/ecosystem.js` | 72,748 | JavaScript (ESM) | Open-Ended Multi-Agent & Multi-Species A-Life Biosphere (pass 19): | direct (nobel_rigor_suite.mjs) |
| `live/js/sim/fitness.js` | 6,695 | JavaScript (ESM) | Full motor + synergy + steering genome fitness, shared by offline CMA-ES (test/evolve_genome.mjs) and in-page  | direct (genome_eval.mjs) |
| `live/js/sim/fluid.js` | 40,107 | JavaScript (ESM) | Coupled 1D Murray's-Law Branching Navier-Stokes Vascular Tree (36 nodes / 64 vessels) | indirect |
| `live/js/sim/genome.js` | 28,736 | JavaScript (ESM) | Full developmental genome (pass 12 -> pass 15 unified innate-to-plastic connectome). | direct (evolve_genome.mjs, evolve_steer.mjs, genome_eval.mjs) |
| `live/js/sim/heptarch.js` | 48,664 | JavaScript (ESM) | NESTOR v0.1 + HEPTARCH v0.2 Composite Sub-Brain Council, Raider 6-Phase Cold-Strike Automaton, | direct (dome_heptarch_probe.mjs, nobel_rigor_suite.mjs) |
| `live/js/sim/lineage_worker.js` | 544 | JavaScript (ESM) | Web Worker for the in-page lineage evolution: scores a full 108-gene Hox Evo-Devo genome on paired Common-Rand | page |
| `live/js/sim/memory.js` | 65,388 | JavaScript (ESM) | Memory systems (pass 19 histological 32,768-neuron 14-population hippocampal-subicular loop + 6 GABAergic clas | direct (memory2_probe.mjs, memory_probe.mjs, nobel_rigor_suite.mjs) |
| `live/js/sim/metab.js` | 7,131 | JavaScript (ESM) | Metabolism, hormones, fluids and waste. One tick = one simulated minute. The pool structure and most rate laws | indirect |
| `live/js/sim/metacog.js` | 23,046 | JavaScript (ESM) | Metacognition, Exact Taylor-Jet Frenet-Serret Thought Curvature & Torsion, and Weight-Space Geometry. | indirect |
| `live/js/sim/mind.js` | 79,716 | JavaScript (ESM) | Learning & Symbolic-Neural Planning machinery beside the spiking substrate (upgraded in pass 19): | indirect |
| `live/js/sim/nav.js` | 6,025 | JavaScript (ESM) | Navigation circuit (pass 13): head-direction ring attractor + path integration with grid-like phase codes. | indirect |
| `live/js/sim/skin.js` | 4,461 | JavaScript (ESM) | Chromatophore skin: a 64 x 32 sheet of cells (u = along the body, v = around it) updated as an excitable mediu | direct (turing_probe.mjs) |
| `live/js/sim/starter_genome.js` | 3,473 | JavaScript (ESM) | Shipped full 78-gene developmental starter genome (58 motor/CPG/turning/righting/synergy/gaze + 20 sense->MOT  | direct (evolve_genome.mjs, evolve_steer.mjs, genome_eval.mjs, nobel_) |
| `live/js/sim/util.js` | 2,132 | JavaScript (ESM) | Small math helpers shared by the simulation (DOM-free so Node tests can import it). | direct (memory2_probe.mjs, memory_probe.mjs, nobel_rigor_suite.mjs) |
| `live/js/sim/vision.js` | 54,409 | JavaScript (ESM) | Primate-Acuity Log-Polar Foveated Binocular Visual Hierarchy (Dual 256x128 Retinas = 65,536 Photoreceptors / 1 | indirect |
| `live/js/sim/webgpu_brain.js` | 9,942 | JavaScript (ESM) | WebGPU WGSL compute shader accelerator for large spiking sheets (L / XL / XXL / MEGA up to 1,048,576 neurons & | page |
| `live/js/sim/world.js` | 64,548 | JavaScript (ESM) | The 3D A-Life Biosphere & Abiotic World (upgraded in pass 18): | direct (gait_probe.mjs, memory_probe.mjs, nobel_rigor_suite.mjs, phy) |
| `live/js/tsotchke/LICENSE-eshkol` | 1,065 | - |  | n/a (data/asset/doc) |
| `live/js/tsotchke/moonlab.js` | 23,979 | JavaScript (ESM) | Moonlab Tensor-Network, 32-Qubit (chi = 32) Vidal Canonical MPS Simulator, 5-Layer (512-D) Binary MERA & Jacob | direct (dome_heptarch_probe.mjs, nobel_rigor_suite.mjs) |
| `live/js/tsotchke/qgtl.js` | 28,032 | JavaScript (ESM) | Quantum Geometric Tensor Library (QGTL) — JavaScript port of core metric/fidelity primitives from | direct (dome_heptarch_probe.mjs, nobel_rigor_suite.mjs) |
| `live/js/tsotchke/qrng.js` | 34,580 | JavaScript (ESM) | 16-Qubit (DIM = 65,536) WebAssembly-Accelerated Open-Quantum Lindblad / Kraus MCWF Simulator + Optional 18-Qub | indirect |
| `live/js/tsotchke/taylor.js` | 9,880 | JavaScript (ESM) | Univariate truncated-Taylor ("jet") arithmetic to order K — a faithful JavaScript port of the recurrence table | indirect |
| `live/js/tsotchke/wasm_quantum.js` | 15,248 | JavaScript (ESM) | Zero-build inline W3C WebAssembly f64 quantum statevector kernel (up to 16 qubits, DIM = 65,536) + | indirect |

## live/test

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `live/test/babble_probe.mjs` | 886 | JavaScript (ESM, Node) | Motor babbling probe: per seed, the turn gain measured during the first 12 s (rad/s per unit turn command), th | is a test/probe |
| `live/test/brain_probe.mjs` | 1,620 | JavaScript (ESM, Node) | Pass 14 brain probe. Usage: node test/brain_probe.mjs SCALE [secs] [lesion] | is a test/probe |
| `live/test/browser_check.mjs` | 2,347 | JavaScript (ESM, Node) | Headless Chromium check: console errors, fps, motion via neurons (MN lesion), screenshots at phone and desktop | is a test/probe |
| `live/test/climb_probe.mjs` | 1,568 | JavaScript (ESM, Node) | Climbing probe: a rock (radius 0.9) is placed 3 units ahead on the line to a fixed goal 9 units away. 40 s. | is a test/probe |
| `live/test/dome_heptarch_probe.mjs` | 9,613 | JavaScript (ESM, Node) | Pass 20 Comprehensive Verification Suite: | is a test/probe |
| `live/test/dome_ui_check.mjs` | 7,458 | JavaScript (ESM, Node) | Headless-Chrome check of the live page (Three.js Dome + p5.js + HEPTARCH HUD) over the DevTools protocol. | is a test/probe |
| `live/test/eco_probe.mjs` | 3,619 | JavaScript (ESM, Node) | Pass 18 Multi-Agent Biosphere, D3Q19 LBM + 512 WCSPH FSI, Huxley Sarcomeres, 108-Gene Hox, | is a test/probe |
| `live/test/evolve_gait.mjs` | 2,590 | JavaScript (ESM, Node) | Offline training of the leg-gait genome (CPG->motor-neuron wiring, CPG leg coupling, adaptation time constant, | is a test/probe |
| `live/test/evolve_genome.mjs` | 7,227 | JavaScript (ESM, Node) | CMA-ES (Hansen 2016, standard (mu/mu_w, lambda) with rank-one + rank-mu updates) over the motor genome in js/s | is a test/probe |
| `live/test/evolve_steer.mjs` | 7,502 | JavaScript (ESM, Node) | Stage 2: CMA-ES over the sense->MOT genes (STEER_GENES) with the evolved motor genome fixed; fitness = test/na | is a test/probe |
| `live/test/forage_bench.mjs` | 1,382 | JavaScript (ESM, Node) | Foraging competence: per seed, N simulated seconds; counts feeds, site arrivals, 45-s give-ups and mean time-t | is a test/probe |
| `live/test/gait_probe.mjs` | 1,624 | JavaScript (ESM, Node) | Physics-only probe (TEST ONLY - the creature never uses this): drives the muscles with a hand-written travelli | is a test/probe |
| `live/test/genome_eval.mjs` | 750 | JavaScript (ESM, Node) | Fitness of a motor genome (used by evolve_genome.mjs; also runnable alone: node test/genome_eval.mjs hand/star | is a test/probe |
| `live/test/growth_probe.mjs` | 1,329 | JavaScript (ESM, Node) | Morphological growth probe: 8 simulated minutes; final limb lengths vs each limb's use, and girth under clampe | is a test/probe |
| `live/test/headless_run.mjs` | 995 | JavaScript (ESM, Node) |  | is a test/probe |
| `live/test/lineage_check.mjs` | 2,232 | JavaScript (ESM, Node) | Headless check of the in-page lineage evolution: opens the lab tab, runs the evolution, waits for generations, | is a test/probe |
| `live/test/measure.mjs` | 1,306 | JavaScript (ESM, Node) | Pass metrics: per seed, 90 simulated seconds per condition. distance = path length of the body centre; fed = s | is a test/probe |
| `live/test/memory2_probe.mjs` | 4,154 | JavaScript (ESM, Node) | Pass 11 memory probe: learned/grown memories vs the pass-3 fixed ones. | is a test/probe |
| `live/test/memory_probe.mjs` | 3,391 | JavaScript (ESM, Node) | Pass 3 memory probes. (a) HDC food map: store noisy outcomes at the 16 plants, check recall vs true reward pro | is a test/probe |
| `live/test/nav_eval.mjs` | 1,769 | JavaScript (ESM, Node) | Navigation fitness of a full genome (used by evolve_steer.mjs). Per seed: a near goal (4-8 units) and a far go | is a test/probe |
| `live/test/nav_probe.mjs` | 2,254 | JavaScript (ESM, Node) | Pass 13 navigation probe. Per seed: one NEAR goal (a feeding site 4-8 units from the head) and one FAR goal (> | is a test/probe |
| `live/test/nobel_rigor_suite.mjs` | 52,335 | JavaScript (ESM, Node) | Pass 21 Hostile-Scrutiny Scientific Falsification & Statistical Rigor Suite (`nobel_rigor_suite.mjs`) | is a test/probe |
| `live/test/pc_probe.mjs` | 1,227 | JavaScript (ESM, Node) | Predictive-coding probe: mean squared body-sense prediction error in the first vs last 30 s of a 180 s run, le | is a test/probe |
| `live/test/physics_probe.mjs` | 1,102 | JavaScript (ESM, Node) | physics sanity: does a lateral travelling wave (hand-written, TEST ONLY - never used by the creature) propel t | is a test/probe |
| `live/test/righting_probe.mjs` | 1,620 | JavaScript (ESM, Node) | Flip the body onto its back (rotate all particles 180 deg about the body's long axis) and measure the time unt | is a test/probe |
| `live/test/roll_probe.mjs` | 2,599 | JavaScript (ESM, Node) | Body-only probe: lay the body on its side, hold a static/oscillating muscle pattern, measure final up-vector y | is a test/probe |
| `live/test/scale_probe.mjs` | 1,480 | JavaScript (ESM, Node) | Pass 9: forced MOT turn command (fwd 1 + turnL or turnR = 1) for 12 s, seeds 1-4; mean yaw rate in the command | is a test/probe |
| `live/test/steer2.mjs` | 1,013 | JavaScript (ESM, Node) | steering probe with optional lesions (env L=a+b): fixed goal 18 away, 40 s, 4 seeds; prints mean distance clos | is a test/probe |
| `live/test/steer_probe.mjs` | 887 | JavaScript (ESM, Node) | Closed-loop steering probe: fixed goal, does the creature close the distance? 'noturn' removes the innate bear | is a test/probe |
| `live/test/symmetry_probe.mjs` | 1,181 | JavaScript (ESM, Node) | Symmetric travelling wave on the body alone (no brain): net yaw rate should be ~0. Args: zero/wave/legs [flat] | is a test/probe |
| `live/test/turing_probe.mjs` | 1,234 | JavaScript (ESM, Node) | Gray-Scott skin layer: pattern statistics under two hormone states (lean+calm vs fat+stressed), same neural dr | is a test/probe |
| `live/test/water_probe.mjs` | 1,599 | JavaScript (ESM, Node) | Pass 8 probe. (a) thirst/drinking, 300 s, seeds 1-4, intact vs thirst behaviour lesioned: mean thirst, water d | is a test/probe |

## live/vendor

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `live/vendor/p5/LICENSE` | 24,480 | - |  | vendored third-party |
| `live/vendor/p5/p5.min.js` | 1,056,654 | JavaScript (ESM) | ! p5.js v1.11.3 January 22, 2025 */ | vendored third-party |
| `live/vendor/three/LICENSE` | 1,081 | - |  | vendored third-party |
| `live/vendor/three/addons/controls/OrbitControls.js` | 32,134 | JavaScript (ESM) | OrbitControls performs orbiting, dollying (zooming), and panning. | vendored third-party |
| `live/vendor/three/addons/postprocessing/EffectComposer.js` | 4,651 | JavaScript (ESM) | deltaTime value is in seconds | vendored third-party |
| `live/vendor/three/addons/postprocessing/MaskPass.js` | 2,231 | JavaScript (ESM) | don't update color or depth | vendored third-party |
| `live/vendor/three/addons/postprocessing/OutputPass.js` | 2,524 | JavaScript (ESM) | internal cache | vendored third-party |
| `live/vendor/three/addons/postprocessing/Pass.js` | 1,706 | JavaScript (ESM) | if set to true, the pass is processed by the composer | vendored third-party |
| `live/vendor/three/addons/postprocessing/RenderPass.js` | 1,941 | JavaScript (ESM) | TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-4656696 | vendored third-party |
| `live/vendor/three/addons/postprocessing/ShaderPass.js` | 1,576 | JavaScript (ESM) | TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-4656696 | vendored third-party |
| `live/vendor/three/addons/postprocessing/UnrealBloomPass.js` | 12,410 | JavaScript (ESM) | UnrealBloomPass is inspired by the bloom pass of Unreal Engine. It creates a | vendored third-party |
| `live/vendor/three/addons/shaders/CopyShader.js` | 571 | JavaScript (ESM) | Full-screen textured quad shader | vendored third-party |
| `live/vendor/three/addons/shaders/LuminosityHighPassShader.js` | 1,147 | JavaScript (ESM) | Luminosity | vendored third-party |
| `live/vendor/three/addons/shaders/OutputShader.js` | 1,490 | JavaScript (ESM) | include <tonemapping_pars_fragment> | vendored third-party |
| `live/vendor/three/three.module.min.js` | 691,648 | JavaScript (ESM) | @license | vendored third-party |

## play

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `play/app.js` | 25,236 | JavaScript (ESM) | Glitchling play UI. Model lives in sim.js (window.GL). No dependencies, no network. */ | page |
| `play/index.html` | 9,687 | HTML | Page: Play Glitchling: live browser sim | page |
| `play/sim.js` | 16,862 | JavaScript (ESM) | Glitchling browser port (SIMPLIFIED). Not the TypeScript reference (glitchling.ts + core/organism.ts). | page |
| `play/style.css` | 7,677 | CSS |  | n/a (data/asset/doc) |

## research

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `research/IMAGE_DEEP_DIVE.md` | 39,404 | Markdown | IMAGE_DEEP_DIVE — every figure, read for Glitchling | n/a (data/asset/doc) |
| `research/NEURO_FRONTIER.md` | 21,182 | Markdown | NEURO_FRONTIER — neuroscience frontier sweep, 2023–2026 (plus a few older anchors) | n/a (data/asset/doc) |
| `research/img/01_fly_male_cns_neuron_positions.png` | 867,730 | PNG image |  | n/a (data/asset/doc) |
| `research/img/02_human_brain_organoid.jpg` | 470,935 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/03_physarum_blob.jpg` | 607,224 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/04_physarum_plasmodium.jpg` | 563,357 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/05_xenobot_quadruped.jpg` | 205,513 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/06_xenobot_design_pairs.png` | 735,765 | PNG image |  | n/a (data/asset/doc) |
| `research/img/07_brainbow_lichtman2008.jpg` | 48,493 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/08_planarian.jpg` | 97,223 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/09_box_jellyfish_tripedalia.jpg` | 235,811 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/10_purkinje_cajal.png` | 51,869 | PNG image |  | n/a (data/asset/doc) |
| `research/img/11_purkinje_mouse_cerebellum.png` | 7,610,619 | PNG image |  | n/a (data/asset/doc) |
| `research/img/12_dti_tractography.png` | 671,848 | PNG image |  | n/a (data/asset/doc) |
| `research/img/13_octopus_merculiano.jpg` | 2,010,748 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/14_astrocyte_organoid_subtypes.jpg` | 127,672 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/15_hek293_fluo4_calcium.png` | 1,895,191 | PNG image |  | n/a (data/asset/doc) |
| `research/img/16_celegans_can_neurons.png` | 475,561 | PNG image |  | n/a (data/asset/doc) |
| `research/img/17_stretchable_mea.png` | 1,869,927 | PNG image |  | n/a (data/asset/doc) |
| `research/img/SOURCES.md` | 2,952 | Markdown | Image sources (all from Wikimedia Commons, downloaded 2026-11-02 PHT) | n/a (data/asset/doc) |
| `research/img/alex/ant_electronic_antennae_spike_coding.png` | 580,478 | PNG image |  | n/a (data/asset/doc) |
| `research/img/alex/audiovisual_orientation_tuning.jpg` | 58,563 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/barrel_cortex_cell_density.jpg` | 75,929 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/bioluminescent_voltage_sensor.jpg` | 40,891 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/celegans_neuron_ID_atlas.jpg` | 57,056 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/celegans_neuron_position_variability.jpg` | 44,456 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/celegans_neuropeptide_connectome_overview.jpg` | 39,309 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/celegans_neuropeptide_cores.jpg` | 2,226,505 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/celegans_serotonin_NSM_correlation.png` | 44,894 | PNG image |  | n/a (data/asset/doc) |
| `research/img/alex/celegans_whole_brain_stim_response.jpg` | 66,801 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/connectome_graph_stats_4species.jpg` | 44,827 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/cortex_layer_celltype_morphology.jpg` | 42,863 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/dendrite_bAP_receptive_field.jpg` | 40,833 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/dendrite_branch_scaling_mito.jpg` | 50,890 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/dendrite_growth_sim_vs_real.jpg` | 81,482 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/electrophys_panel.jpg` | 11,315 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/hesx1_rat_forebrain_mouse.jpg` | 251,139 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/microns_V1_cell_type_classifier.jpg` | 34,404 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/microns_cortex_render.webp` | 283,680 | WebP image |  | n/a (data/asset/doc) |
| `research/img/alex/microns_proofreading.png` | 823,394 | PNG image |  | n/a (data/asset/doc) |
| `research/img/alex/mouse_v1_audiovisual_prediction.png` | 122,049 | PNG image |  | n/a (data/asset/doc) |
| `research/img/alex/multisensory_escape_TeA.jpg` | 49,438 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/alex/neuron_shapes_soma_axon_dendrite.png` | 102,309 | PNG image |  | n/a (data/asset/doc) |
| `research/img/alex/neuron_types_uni_bi_multipolar.png` | 5,331 | PNG image |  | n/a (data/asset/doc) |
| `research/img/alex/neuropeptide_network_motifs.png` | 46,530 | PNG image |  | n/a (data/asset/doc) |
| `research/img/alex/rat_mouse_chimera_brain_atlas.jpg` | 2,357,716 | JPEG image |  | n/a (data/asset/doc) |
| `research/img/sources.tsv` | 2,682 | TSV |  | n/a (data/asset/doc) |

## results

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `results/activations_allflaws_seed1.json` | 309,217 | JSON |  | n/a (data/asset/doc) |
| `results/cursed_portrait.png` | 34,085 | PNG image |  | n/a (data/asset/doc) |
| `results/glitchling.png` | 149,767 | PNG image |  | n/a (data/asset/doc) |
| `results/results.json` | 25,929 | JSON |  | n/a (data/asset/doc) |
| `results/summary.csv` | 1,116 | CSV |  | n/a (data/asset/doc) |

## site

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `site/index.html` | 21,478 | HTML | Page: Glitchling: one-day art jam showcase | page |
| `site/live-demo-art.png` | 390,136 | PNG image |  | n/a (data/asset/doc) |
| `site/live-demo-brain.png` | 153,399 | PNG image |  | n/a (data/asset/doc) |
| `site/live-demo-clip.png` | 685,845 | PNG image |  | n/a (data/asset/doc) |
| `site/live-demo-hdr.png` | 355,244 | PNG image |  | n/a (data/asset/doc) |
| `site/live-demo-results.png` | 190,905 | PNG image |  | n/a (data/asset/doc) |
| `site/live-demo-top.png` | 245,601 | PNG image |  | n/a (data/asset/doc) |
| `site/screenshot-v2.png` | 929,032 | PNG image |  | n/a (data/asset/doc) |
| `site/screenshot-v3.png` | 2,131,518 | PNG image |  | n/a (data/asset/doc) |
| `site/screenshot-v4.png` | 2,167,123 | PNG image |  | n/a (data/asset/doc) |
| `site/screenshot-v5.png` | 3,628,997 | PNG image |  | n/a (data/asset/doc) |
| `site/screenshot-v6.png` | 3,687,424 | PNG image |  | n/a (data/asset/doc) |
| `site/screenshot-v7.png` | 3,687,432 | PNG image |  | n/a (data/asset/doc) |
| `site/screenshot.png` | 182,128 | PNG image |  | n/a (data/asset/doc) |
| `site/style.css` | 2,020 | CSS |  | n/a (data/asset/doc) |

## synthetic

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `synthetic/make_state_v2_synthetic.py` | 4,765 | Python 3 | SYNTHETIC prototype of results/state_v2.jsonl (BLUEPRINT.md Phase 1 export schema). | none |
| `synthetic/state_v2.synthetic.jsonl` | 140,242 | JSON Lines |  | n/a (data/asset/doc) |

## tools

| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |
|---|---:|---|---|---|
| `tools/check.mjs` | 8,092 | JavaScript (ESM, Node) | Repository health check, run by `npm test` and by CI (.github/workflows/ci.yml). | none |
