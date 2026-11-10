# Glitchling handoff: Grok Bot → Gemini Argon 4 (Antigravity)

*Written Sun Nov 1 2026, ~21:30 PST (America/Los_Angeles) by Grok Bot, on the shared Linux box at `/workspace/glitchling-jam`.*
*For: a coding agent that has none of the chat history. Owner: Alex Donahue ("0thernes"). Alex is pausing Grok Bot compute and handing Glitchling and the related A-Life work to you for a while.*
*Companion doc: `HANDOFF_QUICKSTART.md` (1–2 pages). Read it first if you are in a hurry, then come back here.*

> **How to read this doc.** Everything below comes from files that were opened and read while writing it: NOTES.md, BLUEPRINT.md, BRAINS.md, WRITEUP.md, research/*.md, glitchling.ts, core/organism.ts, results/*.csv/json, artifact JSON metadata, site/index.html and `git status` of cqm-copy. If something could not be checked, it says **UNKNOWN** or **UNVERIFIED**. Don't upgrade those to facts.
> Glitchling is "our little baby" (Alex's words). Be gentle with it and strict with the numbers.

---

## Table of contents
1. Executive brief
2. Absolute rules & security fence
3. Directory map
4. Architecture
5. How to run
6. Results v2 + caveats
7. Real vs simulated inventory
8. Showcase / devops
9. Teammate bot roster
10. Pipeline & CI-ish workflow
11. Goals & agenda
12. Brain & neuro frontier
13. Open problems / known bugs / missing files
14. Ideas backlog (ranked)
15. Your first 90 minutes
16. Glossary
17. Appendix (self-contained tables and commands)

---

## 1. Executive brief

**What Glitchling is.** Glitchling is a deliberately broken baby clone of **Creature #1**, Alex's A-Life organism. Specifically:
- `core/` is a **copy** of Creature #1's organism code, taken from `Asmodensius-v40/creatures/001/organism`. The copied files are organism.ts, affect.ts, develop.ts, v40mods.ts, substrate.ts, tsotchke.ts and fp/. The only edits were rewriting absolute imports to relative ones and dropping the diag/trace files that needed the test suite.
- `glitchling.ts` (54 lines, about 8 KB, so the lines are very dense) subclasses `Organism` and adds **four switchable flaws**: `scramble`, `leaky`, `backwards` and `misfire`.
- The brain has **272 rate neurons in 14 regions**. It sits on a full metabolism (gut → blood → liver/fat → ATP), a layered affect system and a grown (developmental-genome) connectome.
- The world is a **16-site foraging ring**: 4 colours × 4 shapes, with reward p = 0.05 + 0.25·cv[c] + 0.25·sv[s] (from the `SITES` comment in core/organism.ts).
- 1 tick = 1 simulated minute, so 1440 ticks = 1 sim-day.

**Jam.** A one-day art/science jam on **Sun Nov 1 2026**. The lead brief, re-added to NOTES.md at 10:35 PST:
> "Flaws: senses rewired every 90 ticks; memory leaks 6%/tick; all 8 motor outputs reversed; misfiring mutations. Alex wants a real 3D creature (HDR, 4K, structural detail, nothing cosmetic). Box-only: no push, deploy, post, or email. Label real vs simulated."

**Status at handoff (Sun Nov 1 2026 ~21:30 PST):**
| Area | Status |
|---|---|
| Sim (v2 flaws, aligned with the brief) | ✅ Runs. Results v2 are in `results/` (2 sim-days × 2 seeds × 7 conditions; 14/14 creatures alive). |
| Results caveats | ⚠️ n=2 seeds. Seed noise is about ±0.1 in success rate. `bestSiteFrac` columns are broken (always 0). |
| Plot + cursed portrait | ✅ `results/glitchling.png`, `results/cursed_portrait.png` (made by `plot.py`). |
| Brain viz | ✅ `brain-viz/index.html` plays back the REAL activations (144 frames). Its embedded data.js has no events. |
| 3D renders | ✅ v2 and v3 4K heroes (REAL geometry and activations at tick 720). ⚠️ The v4 stills and clip are **SYNTHETIC**-driven. |
| Mini World integration | ⚠️ The hook exists in `cqm-copy/src/world.ts`, but the v2 real-brain creature has **never been seen running inside Mini World**: headless Chrome crashed while loading the full world. |
| Write-up | ✅ `WRITEUP.md` is aligned with Results v2. |
| Showcase site | ✅ `site/index.html` (v7), local only. Screenshots: `site/screenshot-v7.png` plus `site/live-demo-*.png`. |
| Design docs | ✅ `BLUEPRINT.md` (v2 spec: 100 areas × 5 attributes, Phase plan, 16 "gifts"), `BRAINS.md` (brain compendium), `research/NEURO_FRONTIER.md`, `research/IMAGE_DEEP_DIVE.md`. |
| `results/state_v2.jsonl` (real Phase-1 state export) | ❌ **Does not exist.** This is the main blocker for "nothing cosmetic" renders. |
| Phase 1 build (body/limbs/field/repro/gifts) | ⏸️ **ON HOLD until the Creature #1 runs finish. This is Alex's decision.** |
| Z-drive copy | ❓ Target `Z:\[Vibe Coded (AI)]\CLAUDECODE\glitchling-jam`. The copy may still be in progress, and its completeness is **UNKNOWN** from the box. |

**One-line pitch** (A-Life Marketing, Results v2): "Break every part of a creature and it can still find a way to eat." Hit rate drops from about 0.35 to 0.30, but it forages about 25% more (218.5 vs 174.5), eats slightly more often (66 vs 63 meals) and ends with slightly higher mean glucose (3.81 vs 3.73). This is n=2, so it's a fun hint, not a finding.

---

## 2. Absolute rules & security fence

> 🚨 **Read these before touching anything.** They are Alex's standing rules for this project and they carry over to you.

1. **Never modify Alex's real repos or sites.** This covers CQM / Cosmogonic Quantum Mechalogodrom, `Asmodensius*`, the 0thernes.art site source, the Creature #1 repo, and anything else of his on the Z: drive outside `glitchling-jam`.
2. **Never push, deploy, post, publish or email.** No `git push`, no Vercel/Netlify/Cloudflare deploys, no social posts, no newsletters, no PRs. Everything is local. Showcase pages are viewed through `python -m http.server` on localhost only.
3. **Work lives in `glitchling-jam/`.** On the shared box that is `/workspace/glitchling-jam`. On Alex's MSI it is `Z:\[Vibe Coded (AI)]\CLAUDECODE\glitchling-jam`, if the copy finished.
4. **`cqm-copy/` is a local, no-remote shallow clone of CQM** (HEAD `4ceed2d`, 2026-11-01; `git remote -v` is empty). Treat it as **read/reference only** for CQM originals. The Artificial Life bot already added files to it (listed in §3). Put new studio/render work in **new files**, ideally outside cqm-copy or in a clearly new file, and never edit the original CQM modules. Never add a remote.
5. **`core/` is frozen.** It is the faithful Creature #1 copy. BLUEPRINT's rule is "Keep `core/` untouched" and all new work goes in sibling files. If a core bug blocks you, fix it in the subclass (`glitchling.ts`) or in a new file, and log it.
6. **Be honest about REAL vs SIMULATED vs SYNTHETIC.** Every visual, number and export must say which it is (see §7). Psychic, wireless and remote-viewing mechanics are **SIMULATED in-sim game mechanics** with real in-sim costs, and they make **no claim about real phenomena**. "Emotions" are functional variables with no claim of experience.
7. **Never invent numbers or citations.** Re-run, or mark UNKNOWN. Treat the attributions for Alex's images in IMAGE_DEEP_DIVE.md as **UNVERIFIED leads**, not citations.
8. **Phase 1 build is ON HOLD until the Creature #1 runs finish (Alex's decision).** Until Alex says go, you may read, plan, fix small bugs in the jam harness (for example `bestSiteFrac`), run more seeds of the *existing* sim, and refresh the docs and site. You may **not** start body.ts, limbs.ts, field.ts, repro.ts or the gifts.
9. **Don't kill other agents' processes.** The box is shared by many bots. At handoff, CPU-heavy jobs were running that are not Glitchling's: `/tmp/scp/sc10.js tune C10|C16R|HOT3RM`, a `bun test`, Chrome, and `node out/server.js`. Which of them are "the Creature #1 runs" is **UNKNOWN**. Leave them all alone. Run your own jobs with `nice -n 19`.
10. **Times: Alex wants US Pacific (America/Los_Angeles).** Write log stamps like `2026-11-02 10:15 PST`. ⚠️ Some NOTES.md lines say "PHT" with a Nov 2 date. File mtimes show that at least one of them (the NEURO_FRONTIER stamp "2026-11-02 13:56 PHT") was really box-local **PST on Nov 1** (the file mtime is 14:05 PST Nov 1). When in doubt, trust file mtimes. The box clock is set to America/Los_Angeles.
11. **No secrets.** No API keys, tokens or cookies are needed for anything here. Don't add any.
12. **Every NOTES.md entry is append-only.** Add a dated line for each meaningful change (who, what, real/synthetic, "local only").

---

## 3. Directory map

Root: `/workspace/glitchling-jam/` (box) ≙ `Z:\[Vibe Coded (AI)]\CLAUDECODE\glitchling-jam\` (MSI, copy status UNKNOWN).

### Top-level docs
| Path | Size | What it is |
|---|---|---|
| `NOTES.md` | ~190 lines, 27 KB | **Jam coordination log, the source of truth.** Run commands, flaw table, Results v2, teammate sections, the Neuralese events format, AL v2/v3/v4 render notes, and the showcase changelog. |
| `BLUEPRINT.md` | 270 lines, 50 KB | **v2 design spec.** 100 areas × 5 attributes mapped to sim vars and CQM reuse paths; architecture; scaling tiers T0–T4; flaw generalisation; **Phase plan (Phase 1 items 1–18)**; the `state_v2.jsonl` schema; the "Gifts for the baby" table (16 ranked). |
| `BRAINS.md` | 337 lines, 41 KB | **Brain compendium** shared by CQM, Creature #1 and Glitchling. 19 sections (§0–§18), each item tagged E/S/O. Cost table, scaling ladder L0–L7, build order per brain, flaw × component matrix, open problems. |
| `WRITEUP.md` | 3 lines | A-Life Marketing's public-style blurb, aligned with Results v2 (n=2 caveat included). Not posted. |
| `HANDOFF_GEMINI_ARGON_ANTIGRAVITY.md` | this file | Handoff report. |
| `HANDOFF_QUICKSTART.md` | 1–2 pages | Short companion. |
| `index.html` | 1.5 KB | The sim's **original** results page. ⚠️ It still shows the **v1** table (for example ALL FLAWS 226.5/64.0/0.291). Superseded by `site/`. Keep it as a historical artefact and don't treat it as current. |

### Simulation
| Path | What it is |
|---|---|
| `glitchling.ts` | `Glitchling extends Organism`, `FLAW_PARAMS`, the 7 conditions (`CONDS`) and the CLI runner (`import.meta.main`). Writes `results/results.json`, `results/summary.csv` and `results/activations_allflaws_seed1.json`. |
| `core/organism.ts` | 676 dense lines. The Creature #1 organism: `REGIONS`, `NNEU=272`, `SITES=16`, metabolism, neuromodulators, `choose()` (striatal race), `step()`, and `mulberry` (seeded RNG). **Frozen.** |
| `core/affect.ts` (77), `core/develop.ts` (37), `core/v40mods.ts` (69), `core/substrate.ts` (34), `core/tsotchke.ts` (11) | Affect layers, developmental `grow()`, v4.0 modifier constants, substrate, and the Tsotchke QRNG adapter. The adapter is a **classical seeded simulation** of Born-rule measurement, *not* hardware quantum randomness, and it falls back to seeded RNG if `$TSOTCHKE_QRNG_DIR` is unset. |
| `core/fp/*.ts` | 30 "first-principles" modules (l4, ltc, aom, efm, rpt2, hot1/3, dmul, sgd_iso, cur, allo, eshkol_*, …) used by organism.ts. |
| `plot.py` | Makes `results/glitchling.png` (success and glucose per 6 h block) and `results/cursed_portrait.png` (mean neuron rates folded into a face with RGB shift and scanline tearing). |
| `.venv/` | **Linux** Python 3.13 venv with numpy 2.5.4 and matplotlib 3.11.2. It will not work on Windows; recreate it there (§5.6). |
| `results_run.log` | Per-run console lines and seconds from the v2 run. |

### Results
| Path | What it is |
|---|---|
| `results/summary.csv` | **v2**: 14 rows (7 conditions × seeds 1–2). Columns: condition, seed, alive, ticks, forages, rewards, successRate, glcMean, glcEnd, fatEnd, firstHalfSuccess, secondHalfSuccess, bestSiteFracFirst (broken), bestSiteFracSecond (broken), jolts. |
| `results/results.json` | v2 full results: `days`, `nSeeds`, `flawParams`, and `conditions[name][seed]` with per-6 h `blocks[]`. |
| `results/activations_allflaws_seed1.json` | **REAL** activations for condition `all`, seed 1, day 1. 144 frames (every 10 ticks), `nNeurons: 272`, and `events[]` (189 on day 1: 148 motor_reversal, 24 misfire, 16 sensor_shuffle, 1 motor_wiring). |
| `results/glitchling.png`, `results/cursed_portrait.png` | v2 plot and portrait. The plot matches the current results.json, which includes all_mild. |
| `results_v1/` | The v1 run (mild flaws: leak 0.02, one fixed permutation), kept for comparison. |
| `results/state_v2.jsonl` | ❌ **MISSING.** Planned real Phase-1 export. |

### Brain viz (Neuralese)
| Path | What it is |
|---|---|
| `brain-viz/index.html` + `brain.js` | Canvas viewer. Defaults to **REAL** playback, with a REAL/SIMULATED toggle top-right. `?mode=sim` and `?frame=N` work. |
| `brain-viz/data.js` | `window.GLITCHLING_REAL = {...}`, generated verbatim from the activations JSON. ⚠️ It was generated **before** `events[]` was added, so it contains no events (`grep -c '"events"'` → 0). |
| `brain-viz/screenshot.png` | Real playback, frame 61. |

### Art (Tsotchke)
| Path | What it is |
|---|---|
| `art/glitchling_1..6.png`, `art/glitchling_sheet.png` | 6 "cursed portraits" from Tsotchke's from-scratch chaos diffusion demo model (QRNG chaos-string blends, embeddings extrapolated 1.5–4× past normal, CFG 6, 100 steps, 64 px upscaled to 512). **GENERATIVE** art: the model was trained on only 11 images, so "expect texture soup". They are not sim readouts. |

### Artificial Life artefacts
| Path | What it is |
|---|---|
| `artifacts/artificial-life/glitchling-behavior.csv`, `glitchling-summary.json` | **REAL brain** headless log: 1440 ticks, 189 forages, 41 rewards, 2.95 ms/tick, alive, glcEnd 2.651. Fire counts: scramble 189, leaky 1381, backwards 189, misfire 24. |
| `artifacts/artificial-life/hdr/glitchling-hero-4k.png` (+ .json) | v2 hero, 3840×2160, tick 720, procedural PBR body, bloom off. Metadata records one 404 resource error during render (cause UNKNOWN; the image was produced). |
| `artifacts/artificial-life/hdr/glitchling-hero-v3-4k.png` (+ .json) | v3 hero (three.js r185 studio), native 4K, bloom/AO/DOF on, about 33 s per render. The JSON also logs one 404. |
| `artifacts/artificial-life/hdr/glitchling-v4-t720-4k.png`, `glitchling-v4-t800-4k.png`, `glitchling-v4-clip-1080p.mp4` (+ `glitchling-v4-still.json`, `glitchling-v4-clip.json` with `"real": false`) | v4 state-driven studio output, **driven by SYNTHETIC data**. The clip is 48 frames at 1920×1080, 4.8 s at 10 fps. |
| `artifacts/artificial-life/v4-clip-frames/` | 48 PNG frames for the clip. |
| `artifacts/artificial-life/v1-toy/` | v1 **toy brain** (an ~80-line model, not Creature #1). It has mini-world and close-up PNGs, browser-state JSON, CSV and summary. Historical. |
| `artifacts/artificial-life/render.mjs`, `render-hero.mjs`, `render-hero-v3.mjs`, `render-v4.mjs`, `shot.mjs` | Playwright render drivers. ⚠️ They **hardcode** `/workspace/cqw/node_modules/playwright/index.mjs` and `/workspace/glitchling-jam/...` paths, so they are box-only until they are made portable. |

### Synthetic
| Path | What it is |
|---|---|
| `synthetic/make_state_v2_synthetic.py` | Generator (hardcoded `/workspace/...` paths). It mixes the real activations, metab.glc, leak, perm and events with **invented** body, limbs, eyes, affect and field values. |
| `synthetic/state_v2.synthetic.jsonl` | 38 lines, t = 600–840, every record has `_synthetic: true`. The v4 renderer falls back to this file when `results/state_v2.jsonl` is missing. |

### Data
| Path | What it is |
|---|---|
| `data/areas.json` | `{version, note, areas}`: a machine-readable copy of the BLUEPRINT 100 × 5 table. |
| `data/build_areas.py` | Generator. It asserts 100 × 5 and that every cited file exists. |
| `data/areas_table.md` | Rendered table. |

### Research
| Path | What it is |
|---|---|
| `research/NEURO_FRONTIER.md` | 154 lines. 51 sourced findings from 2023–2026, each with a solidity tag; Top-10 surprising; 20 "missing ideas"; "Alex's finds"; and the "Worm and wiring batch". |
| `research/IMAGE_DEEP_DIVE.md` | 482 lines. All **43 images** were viewed (26 of Alex's + 17 from Wikimedia), grouped into themes A–F, with a cross-image synthesis. Attributions for Alex's images are **UNVERIFIED**. |
| `research/img/*.png/jpg` (17), `SOURCES.md`, `sources.tsv` | Wikimedia Commons images with licences. |
| `research/img/alex/` (26 files) | Alex's own research screenshots (sources not identified): neuropeptide connectome, NSM serotonin, neuron position variability, MICrONS, dendrites, bioluminescent voltage sensor, ant e-antennae, audiovisual V1, TeA escape, chimeras, Hesx1, etc. |

### Showcase site
| Path | What it is |
|---|---|
| `site/index.html` (97 lines, v7), `site/style.css` | Local showcase. Uses `../` relative paths, so **serve from the jam ROOT** (§8). |
| `site/screenshot.png`, `screenshot-v2..v7.png` | Full-page captures per version. v7 is current. |
| `site/live-demo-top.png`, `-art`, `-results`, `-brain`, `-hdr`, `-clip` | Live-served screenshots, Nov 1 ~20:57 PST. |

### cqm-copy (READ/REFERENCE ONLY)
| Path | What it is |
|---|---|
| `cqm-copy/` | Shallow CQM clone at HEAD `4ceed2d` ("perf(flora): split each flora family into 4x4 frustum tiles…"). No remote. |
| **Changes the AL bot made (per `git status`):** | |
| `cqm-copy/src/world.ts` (M, +4 lines) | Import, field, `if (IS_MINI_WORLD)` spawn, and `this.glitchling?.update(dt)`. Only active at `?world=mini`. |
| `cqm-copy/src/core/engine.ts` (M, 1 line) | Exports `buildCosmicEnvironment` (the "one-word change"). |
| `cqm-copy/alife-gallery.js` (M) | A rebuilt minified bundle. It looks like a side effect of `bun run build` (UNVERIFIED). |
| `cqm-copy/src/sim/glitchling/{glitchling,studio,studio-v3,studio-v4}.ts` (new) | Adapter and studios. `glitchling.ts` imports the jam's unmodified `../../../../glitchling` and `../../../../core/organism` through **relative** paths. |
| `cqm-copy/scripts/glitchling-headless.ts` (new) | Headless real-brain runner. |
| `cqm-copy/lab/glitchling-studio{,-v3,-v4}/` (new, built) | Browser bundles served by http.server on ports 3918 / 3919 / 3920. |
| `cqm-copy/node_modules/` | Installed on Linux by bun. Reinstall on Windows. |

### Sibling projects (do not modify)
| Where | What |
|---|---|
| `/workspace/creature-1/` (box) | Creature #1 v3 harness: README, PREREGISTRATION*.md, HARNESS_CHANGES.md, run.ts, run1–6.txt, results.json. This is the parent organism's science track. |
| `/workspace/Asmodensius-v40/creatures/001/organism` | Source of `core/`. |
| `/workspace/cqw/` | CQM working copy that the AL bot referenced (`docs/MINI-WORLD-AND-SANDBOX.md`, Playwright in node_modules). Not ours. |
| `Z:\[Vibe Coded (AI)]\CLAUDECODE\` (MSI) | Alex's vibe-coded root: CQM (Cosmogonic Quantum Mechalogodrom; its `scripts/launch-oppengrok.ps1` opens 4 Windows Terminal windows × 10 "OPPENGROK" tabs), the 0thernes.art site, the **ANTIGRAVITY** folder (your stack; contents UNKNOWN to me) and glitchling-jam. |

---

## 4. Architecture

### 4.1 Class structure
```
Organism (core/organism.ts, Creature #1, frozen)
  ├─ 272 rate neurons, REGIONS (14), syn {pre,post,w,plastic}, kind[], mask[]
  ├─ metabolism: gut, blood{glc,ffa,aa,ket,urea}, liverGly, fat, muscle, atp, heat, brainGlc
  ├─ neuromodulators nm.{DA,NE,5HT,ACh}, cortisol, ghrelin; Affect (core/affect.ts)
  ├─ develop.grow(): genome → wiring (default in v4.0 mind), pruning/sprouting
  ├─ learning: wSite[16], wAlt[16], Beta counts bA/bB, plastic STDP (DA-gated), LTC gates, e-prop hooks
  ├─ choose(da): striatal race over 16 sites → {k, sp}
  └─ step(): 1 tick = 1 sim-minute; SUB=6 substeps of spiking/rate dynamics; forage decision; metabolism; ATP
       ▲
Glitchling (glitchling.ts)
  ├─ constructor(seed, flaws): super({seed}); flaw RNG gr = mulberry(seed*9973+7); rewire(); wiring()
  ├─ choose(): wraps super.choose() with scramble (perm + noise) and backwards (mirror k→15−k)
  ├─ step(): rewire every 90 (unless mild) → super.step() → MOT reversal → leak → misfire every 60
  └─ events[] (if logEvents): motor_wiring, sensor_shuffle, motor_reversal, misfire
```
It is a drop-in `Organism`: same `step()` and same public fields (`blood.glc`, `fat`, `foraged`, `rewards`, `dead`, `rate`, `regionRate`, `wSite`). Pass `o.pool` for shared food.

### 4.2 REGIONS: 272 neurons
From `core/organism.ts` line 23: `REGIONS = [["SENS",16],["THAL",16],["CTX",CE+4*KI],["HIP",32],["STR",32],["HYP",16],["VTA",6],["RAPHE",6],["LC",6],["BF",6],["INS",8],["SCN",8],["MOT",8],["ENS",48]]`. CTX evaluates to 64, so NNEU = 272.

| # | Region | n | index range | role (functional) |
|---|---|---|---|---|
| 1 | SENS | 16 | 0–15 | sensory input |
| 2 | THAL | 16 | 16–31 | thalamic relay |
| 3 | CTX | 64 | 32–95 | cortex (4 modules; plastic CTX→CTX synapses) |
| 4 | HIP | 32 | 96–127 | hippocampus |
| 5 | STR | 32 | 128–159 | striatum (site-choice race) |
| 6 | HYP | 16 | 160–175 | hypothalamus (drives) |
| 7 | VTA | 6 | 176–181 | dopamine |
| 8 | RAPHE | 6 | 182–187 | serotonin |
| 9 | LC | 6 | 188–193 | noradrenaline |
| 10 | BF | 6 | 194–199 | acetylcholine (basal forebrain) |
| 11 | INS | 8 | 200–207 | insula / interoception |
| 12 | SCN | 8 | 208–215 | circadian clock |
| 13 | **MOT** | **8** | **216–223** | motor / motility / efference (**not** site choice) |
| 14 | ENS | 48 | 224–271 | enteric nervous system (gut) |

The ranges come from cumulative offsets. MOT = 216–223 is confirmed by NOTES and by the `motor_wiring` event. The role column is inferred from region names and BRAINS.md, so treat it as descriptive.

⚠️ **Layout mismatch:** this is not the Creature #1 *canvas* MLP layout (24→222→189→32 / 32→195→195→8). The brain viz says so on screen.

### 4.3 The four flaws (v2 defaults vs `mild`)
`FLAW_PARAMS = { senseNoise: 0.25, leakRate: 0.06, mildLeakRate: 0.02, rewireEvery: 90, misfireEvery: 60, misfireSD: 0.3, synJolts: 20 }`

| Flag | Mechanism (exact, from glitchling.ts) | v2 default | `mild: true` (= v1) | Events emitted |
|---|---|---|---|---|
| `scramble` | Inside `choose()`, wSite[k] and access[k] are temporarily replaced by `saved[perm[k]] + 0.25·N(0,1)` and `savedA[perm[k]]`. They are restored after `super.choose()`. Learning stays on the true arrays. | **new Fisher–Yates permutation every 90 ticks** (`t>0 && t%90==0`) | one fixed permutation for life | `sensor_shuffle {perm[16]}` at birth and every 90 ticks (16/day) |
| `leaky` | After `super.step()`, every tick: wSite[k] += L·(0.25−wSite[k]); same for wAlt; Beta counts bA, bB → 1 + (1−L)(b−1); plastic synapses w *= (1 − 0.05·L). | **L = 0.06/tick** (plastic syn ×0.997) | L = 0.02/tick | none (continuous; no events) |
| `backwards` | (a) After each step, the 8 MOT rates (216–223) are reversed in place (i → 7−i). (b) In `choose()`, the chosen site is mirrored, k → 15−k. Learning credits the site actually visited. | on | same | `motor_wiring` once at birth; `motor_reversal {intended, executed}` on every forage decision |
| `misfire` | Every 60 ticks: one random wSite[k] += 0.3·N, clamped to [0,1]; plus 20 random synapses w += 0.3·N·(|w|+0.1). | σ 0.3, 20 synapses, every 60 ticks | same | `misfire {site, synapses[20]{syn,pre,post,from,to}}` (24/day) |

**Motor-count nuance (important for science claims):** MOT really has exactly 8 neurons, so "all 8 motors reversed" is literally true. But in this model **MOT drives motility and efference/ATP cost, not which site gets foraged**. Site choice comes from the 16-way striatal race. So the behaviourally meaningful reversal is the **16-site mirror**, and the 8-neuron reversal is mostly an internal/efference effect. v1 → v2 `backwards` results are identical, which is consistent with this.

**RNG note:** Flaws use their own stream `gr = mulberry(seed*9973+7)`. Whether a run draws a birth permutation (scramble on or off) shifts that stream. That is why `misfire` alone moved from 0.316 (v1) to 0.419 (v2) with no change to the flaw. It is a direct measure of RNG/seed noise at n=2.

**Logging note:** For the logged episode (`all`, seed 1) the runner sets `logEvents=true` and then re-calls `wiring()` and `rewire()`, so the birth permutation is **redrawn**. That makes logged seed-1 `all` slightly different from an unlogged run.

### 4.4 Conditions (CONDS)
`baseline {}`, `scramble`, `leaky`, `backwards`, `misfire`, `all` (all four), `all_mild` (all four + mild).

### 4.5 Runner output logic
- Days default 2 and seeds default 2. `BLOCK = 360` ticks (6 h), so there are 8 blocks over 2 days.
- Per block it records forages, rewards, success, glc, fat and bestSiteFrac (broken, §13).
- firstHalf/secondHalf success = rewards/forages pooled over blocks [0..h) and [h..).
- Activations are logged only for `all` seed 1, every 10 ticks, for t ≤ 1440.

---

## 5. How to run

### 5.1 On the shared Linux box (verified tools: bun 1.4.2, node v24.22.1, python3, ffmpeg; 8 cores, 15 GB RAM, **no GPU**)
```bash
cd /workspace/glitchling-jam
nice -n 19 bun run glitchling.ts 2 2     # days=2, seeds=2
.venv/bin/python plot.py                 # results/glitchling.png + results/cursed_portrait.png
```
**Expected output:** 14 console lines (one per condition × seed) in the CSV format below, each followed by seconds. Files written: `results/results.json`, `results/summary.csv`, `results/activations_allflaws_seed1.json`.
```
baseline,1,true,2880,199,85,0.427,4.321,2.489,390.4,0.373,0.506,0,0,0 13.074s
...
all_mild,2,true,2880,140,44,0.314,3.157,2.448,342.3,0.31,0.317,0,0,48 3.842s
```
**Wall time:** about 3–170 s per run in `results_run.log` (≈ 7 min total) under box load. NOTES records about 11 min for one run at load average 40–97, and about 2–5 min under load ~20. Load at handoff was ~12.8. The AL headless measure was ~2.95 ms/tick, i.e. ~4.2 s per sim-day without contention. Budget **~15 s per run-day** under load.

⚠️ **Running the sim overwrites `results/`.** Before any re-run, copy the current v2 results to `results_v2/`, the same way `results_v1/` was kept:
```bash
mkdir -p results_v2 && cp -n results/* results_v2/
```

**Determinism:** seeded (`mulberry`). The same seed gives the same results, unless `TSOTCHKE_QRNG_DIR` is set (then the QRNG .bin bytes are used) or diagnostic `PROBE` env vars are set. Keep both unset for reproducibility. Bit-identical results across platforms or bun versions are **UNVERIFIED**.

**More seeds:** `nice -n 19 bun run glitchling.ts 2 8` (8 seeds). BLUEPRINT asks for 4; BRAINS §15 recommends ≥ 8 with 95% CIs.

### 5.2 In code
```ts
import { Glitchling, FLAW_PARAMS } from "./glitchling";
const g: any = new Glitchling(1, { scramble: true, leaky: true, backwards: true, misfire: true /*, mild: true */ });
g.logEvents = true; // optional
for (let t = 0; t < 1440 && !g.dead; t++) g.step();
console.log(g.foraged, g.rewards, g.blood.glc, g.fat, g.events.length);
```

### 5.3 Artificial Life real-brain headless (from cqm-copy, box)
```bash
cd /workspace/glitchling-jam/cqm-copy
bun install --frozen-lockfile        # only if node_modules is missing
bun scripts/glitchling-headless.ts /workspace/glitchling-jam/artifacts/artificial-life 1440
```
Expected: `glitchling-behavior.csv` and `glitchling-summary.json` (189 forages / 41 rewards / alive at 1440 ticks in the recorded run). ⚠️ This overwrites the existing artefacts in that directory, so point it at a new dir if you want to keep them.

### 5.4 Renders (box only, because the paths are hardcoded; SwiftShader headless Chrome)
v3 hero (REAL activations at tick 720):
```bash
cd /workspace/glitchling-jam/cqm-copy
bun build src/sim/glitchling/studio-v3.ts --target browser --outdir lab/glitchling-studio-v3
(cd lab/glitchling-studio-v3 && python3 -m http.server 3919 &)
CAM='[1.15,7.2,1.9]' node /workspace/glitchling-jam/artifacts/artificial-life/render-hero-v3.mjs   # ~33 s at 4K
```
v4 state-driven (uses `results/state_v2.jsonl` if it exists, otherwise **SYNTHETIC**):
```bash
cd /workspace/glitchling-jam
python3 synthetic/make_state_v2_synthetic.py
cd cqm-copy && bun build src/sim/glitchling/studio-v4.ts --target browser --outdir lab/glitchling-studio-v4
(cd lab/glitchling-studio-v4 && python3 -m http.server 3920 &)
cd .. && CAM='[1.0,7.8,1.7,0.2,0.6]' MODE=still W=3840 H=2160 TICKS=720,800 node artifacts/artificial-life/render-v4.mjs
MODE=clip W=1920 H=1080 SUB=2 node artifacts/artificial-life/render-v4.mjs
ffmpeg -framerate 10 -i artifacts/artificial-life/v4-clip-frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 artifacts/artificial-life/hdr/glitchling-v4-clip-1080p.mp4
```
(v2 hero: `bun build src/sim/glitchling/studio.ts --target browser --outdir lab/glitchling-studio`, serve on 3918, then `NB=1 node …/render-hero.mjs`.)
The command sequences are copied from NOTES.md. The relative `cd` steps were tidied for this doc and were not re-run during the handoff.

### 5.5 Showcase
```bash
cd /workspace/glitchling-jam          # the jam ROOT, not site/
python3 -m http.server 8765
# open http://localhost:8765/site/   and   http://localhost:8765/brain-viz/
```

### 5.6 On Alex's MSI (Windows, Antigravity): adapting the commands
- **Paths contain `[` `]` and spaces.** In PowerShell use `Set-Location -LiteralPath 'Z:\[Vibe Coded (AI)]\CLAUDECODE\glitchling-jam'`, and always quote paths. (PowerShell treats `[ ]` as wildcards unless you use `-LiteralPath`.)
- `nice` doesn't exist on Windows. Run `bun run glitchling.ts 2 2` directly, or use `start /low` from cmd.
- `.venv` is a Linux venv. Recreate it: `py -m venv .venv-win; .\.venv-win\Scripts\pip install numpy matplotlib; .\.venv-win\Scripts\python plot.py`.
- `cqm-copy/node_modules` was built on Linux. Run `bun install --frozen-lockfile` in cqm-copy before building studios.
- The render `.mjs` scripts and `synthetic/make_state_v2_synthetic.py` hardcode `/workspace/...`. Parameterise them (for example `process.env.JAM ?? path.resolve(import.meta.dirname, '../..')`) before using them on Windows, and point Playwright at a local install. This counts as a jam-folder change, which is allowed; log it in NOTES.md.
- If you have a real GPU on the MSI, drop the SwiftShader flags (`--use-angle=swiftshader --enable-unsafe-swiftshader`). Renders should be much faster, and the full `?world=mini` page might finally load (UNTESTED).

---

## 6. Results v2 (2 sim-days, seeds 1–2, means; v1 kept in `results_v1/`)

| condition | forages | rewards | success | mean glc | fat end | survived | success 1st→2nd half (s1, s2) |
|---|---|---|---|---|---|---|---|
| baseline | 174.5 | 63.0 | 0.350 | 3.73 | 364.7 | 2/2 | .37→.51, .27→.28 |
| scramble (rewire/90) | 172.5 | 59.5 | 0.346 | 3.38 | 358.8 | 2/2 | .33→.35, .46→.30 |
| leaky (0.06) | 188.5 | 63.0 | 0.346 | 3.48 | 363.2 | 2/2 | .25→.36, .51→.32 |
| backwards (8 MOT + mirror) | 189.0 | 57.0 | 0.301 | 3.35 | 355.8 | 2/2 | .33→.38, .29→.22 |
| misfire | 153.0 | 62.0 | 0.419 | 3.48 | 362.3 | 2/2 | .36→.36, .44→.52 |
| **all (v2)** | **218.5** | **66.0** | **0.302** | **3.81** | **367.1** | 2/2 | .29→.32, .25→.35 |
| all_mild (= v1 all) | 226.5 | 64.0 | 0.291 | 3.67 | 364.4 | 2/2 | .29→.25, .31→.32 |

Means were spot-checked against `results/summary.csv` while writing this (for example baseline forages (199+150)/2 = 174.5 and all (294+143)/2 = 218.5). Per-seed rows are in Appendix A.1.

**Caveats. Read these before you say anything public:**
1. **n = 2 seeds.** The `misfire` swing from 0.316 to 0.419 with an unchanged flaw shows about ±0.1 noise in success rate. Every between-condition difference above is within that noise band. No significance claims are possible.
2. **Seed 1 and seed 2 are very different worlds.** For example baseline seed 1 got 85 rewards and seed 2 got 41. Seed effects dominate condition effects, so use paired comparisons (same seed across conditions) when you add seeds.
3. **`bestSiteFrac` is broken** (always 0, in v1 and v2). The site omits it. Diagnosis and fix are in §13.1.
4. **MOT vs 16-site mirror:** "reversed all 8 motors" is literally true, but the behavioural effect comes from the **16-site action mirror**. The MOT readout reversal had no measurable effect over 2 days (backwards is identical in v1 and v2).
5. **Harsher ≠ worse:** v2 scramble (re-shuffle every 90 ticks) did *better* than v1's fixed permutation (0.302 → 0.346). The likely reason is that a constantly changing wrong map acts like random exploration, while a fixed wrong map is consistently misleading. A 6% leak keeps values near the prior anyway. This is a hypothesis, not a test.
6. **"All flaws forages more and eats more"** is the marketing story. Mechanistically it is consistent with success-rate loss being offset by more foraging attempts, but the driver (hunger loop? affect? exploration?) is **not yet measured**. Note that the forage gap is mostly seed 1 (294 vs 199); seed 2 is 143 vs 150.
7. **Within-life compensation:** in v2, all-flaws success rises from the first half to the second in both seeds (.29→.32, .25→.35). That is weak evidence. Baseline seed 1 also rises (.37→.51), so the rise may be general learning rather than flaw compensation.
8. **Logged seed-1 `all` differs slightly from an unlogged run** because of the birth-permutation redraw (§4.3).
9. **2 days is short.** Longer episodes are needed for the motor-adaptation question.

---

## 7. Real vs simulated inventory

| Artefact | Label | Why |
|---|---|---|
| `results/*.json/csv`, `results/glitchling.png` | **REAL** | Direct sim output from glitchling.ts + core. |
| `results/activations_allflaws_seed1.json` | **REAL** | Logged rate[]/regionRate/wSite/events. (The `motor_wiring` event in the file was added after the run; the current code emits it itself.) |
| `results/cursed_portrait.png` | **REAL data, artistic transform** | Mean neuron rates folded into a face shape, with an RGB-shift glitch. The eyes, mouth and tearing are decoration. |
| `brain-viz/` REAL mode | **REAL playback** | data.js is a verbatim copy of the activations JSON. Per-region means match all 144 frames. |
| `brain-viz/` flaw annotations | **ANNOTATION** | data.js has no events. Scramble and backwards are annotations taken from glitchling.ts, leak is shown as wSite drift toward 0.25, and sparks mark wSite jumps > 0.05. |
| `brain-viz/` SIMULATED mode | **SIMULATED** | Labelled toggle. |
| AL `glitchling-behavior.csv` / `summary.json` | **REAL brain** (headless, no rendering) | The real Glitchling via the cqm-copy adapter. The ring-of-16 body walk is adapter logic. |
| v2 hero `glitchling-hero-4k.png` | **REAL geometry + REAL state at tick 720** | Flaw glow from events at 718/720, region glow from frame t=720, position from replaying the real organism for 720 ticks in the browser. Body shape is procedural, the scene is a studio (not Mini World), the PNG is ACES-tonemapped (not .exr), and bloom is off. |
| v3 hero `glitchling-hero-v3-4k.png` | **REAL activations + REAL events at tick 720**; procedural body | 272 instanced neurons sized and lit by real `rate[]` at t=720, ~120 links between the most active. The neuron *positions* are a stylised layout, not anatomy. The leak droplets are a fixed **decoration** (leak has no events). The terrain, lights and camera are staging. |
| v4 stills (t720/t800) + 1080p clip | **SYNTHETIC** | Driven by `synthetic/state_v2.synthetic.jsonl`. The label is burned into every frame, and the metadata says `"real": false`. Fields taken from real data: brain.rate/regions, metab.glc, flaws.leak/perm/misfireAt, motIntended/Executed, events. Fields **invented**: body, limbs, eyes, atp/fat/heat, affect, field, and the offspring "g2" born at t=720. Clip frames are interpolated (lerpRec, 2 substeps). |
| Tsotchke `art/glitchling_1..6.png`, sheet | **GENERATIVE ART** | A chaos-diffusion demo model trained on 11 images. Not a sim readout. "QRNG" means a classical seeded simulation. |
| AL v1-toy Mini World PNGs/CSV | **REAL CQM renderer, TOY brain** | An ~80-line toy model, not Creature #1. Historical. |
| Field / wireless / psychic / remote viewing (BLUEPRINT) | **SIMULATED mechanic, PLANNED** | Not built. When built, it must be labelled SIMULATED in the UI and in exports. |
| `index.html` (root) | **REAL but STALE (v1 numbers)** | Superseded by site/. |
| `WRITEUP.md` | **REAL numbers (v2), marketing tone** | n=2 caveat is included. |

---

## 8. Showcase / devops

### 8.1 Local showcase `site/index.html` (v7)
Section headings (h2/h3 ids):
1. Header: "Glitchling, a one-day jam (Sun Nov 1, 2026)"
2. `#intro` About the jam (the lead brief, v2 flaw list, mild note)
3. `#art` Cursed portraits: Tsotchke (6 + sheet, with alt text)
4. `#sim` Simulation results: Alien Life 1-100. "Run it", **Results v2** table (7 rows, bestSiteFrac omitted), "Build vs brief: aligned" aside
5. `#writeup` Write-up: A-Life Marketing (verbatim WRITEUP.md Results v2 text, pulled through in v7)
6. `#brain` Brain viz (real data): Neuralese (screenshot + link)
7. `#mini` Mini World integration: Artificial Life (v1-toy notes and PNGs)
8. `#alv2` Artificial Life v2–v4: real brain, 3D body, studio renders
9. `#hdr` 3D HDR creature renders (v2 + v3 REAL; v4 stills + `<video>` SYNTHETIC)
10. Footer: Credits

**Serve from the jam ROOT**, because the page uses `../art/`, `../results/`, `../artifacts/` and so on:
```bash
cd /workspace/glitchling-jam && python3 -m http.server 8765   # → http://localhost:8765/site/
```
On Windows: `Set-Location -LiteralPath 'Z:\[Vibe Coded (AI)]\CLAUDECODE\glitchling-jam'; py -m http.server 8765`.
Opening `site/index.html` from `file://` mostly works for images, but the `<video>` and some browsers' file restrictions can break, so prefer http.server.

**Live screenshots** (Nov 1 ~20:57 PST, served): `site/live-demo-top.png`, `live-demo-art.png`, `live-demo-results.png`, `live-demo-brain.png`, `live-demo-hdr.png`, `live-demo-clip.png`. Full-page history: `site/screenshot.png`, `screenshot-v2..v7.png`.

**Known site staleness:** none known in v7 after the write-up pull-through. Re-check whenever results change. The site's "Run it" block hardcodes `cd /workspace/glitchling-jam`; consider adding the Z: path variant.

### 8.2 Z-drive target
- `Z:\[Vibe Coded (AI)]\CLAUDECODE\glitchling-jam`. Alex prefers keeping vibe-coded projects there. The copy from the box **may be in progress**, and it is **UNKNOWN** whether it is complete.
- **Verify on arrival:** compare file counts and sizes of the big binaries. Box sizes: `hdr/glitchling-hero-4k.png` 993,113 B; `hdr/glitchling-hero-v3-4k.png` 9,593,259 B; `hdr/glitchling-v4-t720-4k.png` 8,005,927 B; `hdr/glitchling-v4-t800-4k.png` 7,745,837 B; `hdr/glitchling-v4-clip-1080p.mp4` 7,207,105 B; `brain-viz/data.js` 216,336 B; `NOTES.md` 27,006 B (before the handoff line was appended); `BLUEPRINT.md` 50,199 B; `BRAINS.md` 41,386 B.
- `.venv/`, `cqm-copy/node_modules/` and `cqm-copy/lab/*` are platform- or build-specific. You can rebuild them.

### 8.3 Sibling projects on Z: (reference; never modify)
- **CQM / Cosmogonic Quantum Mechalogodrom**: the big three.js A-Life world (Mini World at `?world=mini`). It contains `scripts/launch-oppengrok.ps1`, the OppenGrok terminal-swarm launcher.
- **0thernes.art Site**: Alex's art site, owned by the 0thernes.art website bot. Glitchling is **not** deployed there. A merge would need Alex's explicit go-ahead, and the bot or Alex does it.
- **ANTIGRAVITY folder**: your home stack. Its contents are UNKNOWN to Grok Bot.

### 8.4 Environment facts (box, at handoff)
8 CPU cores, 15 GB RAM (~7 GB available), no GPU, load avg ~10–13 and spiking to 40–97 during the jam. Full `?world=mini` at 1280×720 crashed headless Chrome twice, probably from memory (unconfirmed). Ports used: 3917 (CQM server), 3918 (v2 studio), 3919 (v3), 3920 (v4).

---

## 9. Teammate bot roster

Ids were taken from teammate listings in box transcripts (`/workspace/agent-tools/*.txt`). "UNKNOWN" means the id was not found on disk.

| Bot | Id | Owns / did |
|---|---|---|
| **Glitchling lead** (jam lead) | UNKNOWN | Wrote the lead brief (flaws, 3D "nothing cosmetic", box-only, label real vs simulated). Mismatches with the brief are reported to the lead. |
| **Alien Life 1-100** | `d6eda5e9-5524-4100-b00b-0c32946634e9` | **The sim.** Copied `core/`, wrote `glitchling.ts`, `plot.py`, `results/`, `results_v1/`, the activations/events format and the root `index.html`. |
| **Artificial Life** | `ef2bc82b-83b2-4e6a-908f-75e2169856cb` | **CQM Mini World + 3D.** Built `cqm-copy/` (adapter, studios v2/v3/v4, headless script), `artifacts/artificial-life/*`, the 4K heroes, the v4 clip and `synthetic/`. |
| **Neuralese** | `1594e126-32a0-4199-b513-60cba06a0af0` | **Brain viz.** `brain-viz/` (REAL playback, REAL/SIM toggle), consumer of the activations JSON. |
| **Tsotchke** | `386b0ae7-5b04-49ac-9dcf-150b5df597a0` | **Generative art + QRNG.** `art/glitchling_1..6.png` and the sheet (chaos diffusion). `core/tsotchke.ts` is its QRNG/QGTL adapter in Creature #1. |
| **0thernes.art website** | `e2b0dc85-61c0-4477-a4ea-44555eac6815` | Alex's site. Possible future home for the showcase. **Not deployed.** |
| **A-Life Marketing** | UNKNOWN | `WRITEUP.md` (rewritten twice to match the real flaws and the v2 numbers). No posting. |
| **Chief of Staff** | `96602745-3987-40ac-bc08-4633b1ae587b` | Manages the other bots, does jam timekeeping (started 09:46 PST, results 09:51, docs ~09:55) and pulls Alex in for decisions. |
| **OppenGrok** | `115fed2e-98bd-4be5-a775-29632094e826` | Teammate bot tied to CQM's OppenGrok launcher (4 × 10 terminal tabs). Its exact Glitchling role is **UNKNOWN**; treat it as a CQM-side helper. |
| **Grok Bot** (outgoing) | (this bot) | Showcase site v3–v7, BLUEPRINT.md, BRAINS.md, NEURO_FRONTIER.md, IMAGE_DEEP_DIVE.md, these handoff docs. |

You probably can't message these bots from Antigravity. Coordinate through NOTES.md entries and Alex.

---

## 10. Pipeline & CI-ish workflow

There is **no remote CI**. Nothing is pushed and there are no GitHub Actions. The "pipeline" is manual and file-based:

```
glitchling.ts + core/   ──bun run──▶  results/{results.json, summary.csv, activations_allflaws_seed1.json}
                                             │
            plot.py ◀────────────────────────┤──▶ results/glitchling.png, cursed_portrait.png
                                             │
  brain-viz/data.js ◀── regenerate verbatim ─┤   (window.GLITCHLING_REAL = <json>)
                                             │
  synthetic/make_state_v2_synthetic.py ◀─────┤──▶ synthetic/state_v2.synthetic.jsonl (until real export exists)
                                             │
  cqm-copy studio-v3/v4 + render*.mjs ◀──────┘──▶ artifacts/artificial-life/hdr/*.png|mp4 (+ .json metadata)
                                             │
  site/index.html (hand-edited tables/text) ◀┘──▶ screenshot-vN.png, live-demo-*.png
                                             │
  NOTES.md  ◀── one dated line per change (PST), real/synthetic label, "local only"
```

### 10.1 Checklist: a new sim run
- [ ] Check that no Creature #1 / other-bot heavy job will be starved (`uptime`), and use `nice -n 19`.
- [ ] Archive the current results: `mkdir -p results_v2 && cp -n results/* results_v2/` (or `results_vN`).
- [ ] Record provenance (there is no git in the jam root): the FLAW_PARAMS in use, days, seeds, and any code change (diff into NOTES).
- [ ] `nice -n 19 bun run glitchling.ts <days> <seeds> | tee results_run.log`.
- [ ] Sanity: 7 × seeds rows, all `alive`, ticks = 1440·days, jolts = 24·days for misfire conditions.
- [ ] `plot.py` → check the PNGs visually.
- [ ] Compute means and **per-seed paired deltas** and **95% CIs** (≥ 8 seeds before claiming anything).
- [ ] Update NOTES.md (table + caveats), then the site table, then WRITEUP (only if the headline changes).

### 10.2 Checklist: regenerating brain-viz data
- [ ] Look at the current header first (`head -c 200 brain-viz/data.js`): line 1 is `// generated from results/activations_allflaws_seed1.json (verbatim)` and line 2 starts `window.GLITCHLING_REAL=`.
- [ ] Regenerate: `{ echo '// generated from results/activations_allflaws_seed1.json (verbatim)'; printf 'window.GLITCHLING_REAL='; cat results/activations_allflaws_seed1.json; echo ';'; } > brain-viz/data.js`. (The current file ends with `};`.)
- [ ] Open `brain-viz/index.html`. Confirm the banner says REAL, frames = 144, and region means match.
- [ ] Decide whether brain.js should now read `events[]` (it currently doesn't).

### 10.3 Checklist: a render
- [ ] Decide REAL vs SYNTHETIC input. The v4 renderer silently falls back to synthetic, so **check the output .json `"real"` flag**.
- [ ] Build the studio bundle → serve on its port → run the render script with CAM/MODE/W/H/TICKS.
- [ ] Save the metadata JSON next to the PNG/MP4 (source, tick, real flag, errs).
- [ ] Inspect `errs` (the v2/v3 runs logged one 404).
- [ ] Label it in NOTES and on the site. Never present synthetic frames as real.

### 10.4 Checklist: a site bump
- [ ] Edit `site/index.html` only (and style.css). Keep relative paths.
- [ ] Serve from the root and click every link. All `../` paths must resolve.
- [ ] Full-page screenshot → `site/screenshot-v8.png` (increment).
- [ ] NOTES.md line: "YYYY-MM-DD HH:MM PST Showcase (<you>): site v8 … Local only; nothing deployed or posted."

### 10.5 Suggested lightweight "local CI" (optional, jam folder only)
A `scripts/check.sh` (new file) that:
1. runs `bun run glitchling.ts 1 1` into a temp dir (needs an output-dir option, see §14);
2. asserts the row count and alive flags;
3. runs `python data/build_areas.py` (it asserts 100 × 5 and that cited files exist; it also **rewrites** `data/areas.json` and `data/areas_table.md`, so diff them afterwards);
4. greps site/index.html links and checks that each file exists;
5. checks that the v4 metadata `real` flags match the presence of `results/state_v2.jsonl`.

---

## 11. Goals & agenda

### 11.1 Near-term (allowed during the hold; harness, data and docs only)
1. **`results/state_v2.jsonl` export, real fields only.** Emit one JSON line per 10 ticks with the fields that exist today (`t`, `id`, `alive`, `brain.regions/rate/motIntended/motExecuted`, `metab.glc/atp/fat/heat`, `affect.*` where they exist in `core/affect.ts`, `flaws.perm/leak/misfireAt`, `events`). Leave body, limbs and field **absent** rather than invented. This lets v4 drop its synthetic fallback for the fields that exist. ⚠️ Adding body, limbs and field values is Phase 1 work and stays ON HOLD. Ask Alex whether even the real-fields exporter counts as Phase 1 (A.8 Q2).
2. **More seeds.** `bun run glitchling.ts 2 8` (after archiving v2), paired by seed, with CIs.
3. **Fix `bestSiteFrac`** (root cause in §13.1).
4. **Mini World live.** Get the real-brain Glitchling seen running inside `?world=mini`, maybe on the MSI GPU. Touch only the jam's adapter, not CQM originals. A screenshot labelled REAL is the deliverable.
5. **WRITEUP aligned: ✅ done** (Nov 1 20:06 PST). Keep it in sync if the numbers change.
6. **Site local: ✅ done** (v7). Bump it only when the content changes.
7. Regenerate `brain-viz/data.js` with events, and have the viz read the real flaw events.
8. Update or retire the stale root `index.html` (add a banner "v1 numbers, see site/"). Don't delete it.

### 11.2 Phase 1 (BLUEPRINT §4) ⏸️ ON HOLD until Creature #1 runs finish
Core items 1–8:
1. `body.ts`: segment spine (nSeg 5–9 from genome), hydrostat pressure, expand/contract/extend/shorten as 4 motor outputs costing ATP.
2. `limbs.ts`: N legs (odd allowed), each with a 32-neuron Izhikevich ganglion (copy `cqm-copy/src/math/izhikevich.ts`), CPG phase, pain reflex and MOT uplink. Per-leg `rev` = backwards.
3. `field.ts` (**SIMULATED**): 64×64 broadcast lattice with diffusion/decay, payload, and a costly `remoteView()` with fidelity < 1.
4. `repro.ts`: a fat/maturity-gated child Glitchling (mutated `devGenome`, `Affect.birth(parent)`), `nurture()`, 2–4 generations.
5. Flaw generalisation (scramble per nerve bundle, leak on bonds, per-limb reversal, misfire → germline).
6. `tests/coupling.test.ts`: the **"nothing cosmetic" gate**. Perturb each new variable and assert that ≥ 2 downstream areas change.
7. `results/state_v2.jsonl` export, driving a **new** studio file.
8. Re-run `bun run glitchling.ts 2 4` and compare with v2, with the noise caveat.

**Phase 1 gifts (top 10 of 16, BLUEPRINT items 9–18; rank = 2·Impact − Effort):**
| rank | gift | file | not-cosmetic test (summary) |
|---|---|---|---|
| 1 | Neuropeptide broadcast layer (~12 peptides; hub/motor/sensory cores; local/broadcasting/pervasive/integrative motifs) | `peptide.ts` | Zero all peptides → hunger→forage latency and fear persistence change ≥ 2σ. A constant broadcast must not equal no broadcast. |
| 2 | NSM-style serotonin "fed" neuron with a per-cell receptor sign | `serotonin.ts` | Fed vs starved speed ratio differs; flipping the MOT signs reverses the effect. |
| 3 | Spatial wiring + per-individual soma position noise | `develop-space.ts` | Same genome with different σpos → different behaviour fingerprint; σpos = 0 → identical. |
| 4 | Graph-stat targets (degree 4–14, modularity 0.5–0.6, path length 3–5, clustering ~0.2) | `graphstats.ts` | 4-seed unit test; a random-rewired graph must forage worse. |
| 5 | Poke test: functional vs structural connectome | `poke.ts` | corr(F,W) < 1, drops with peptides on, and changes after scramble. |
| 6 | Voltage-driven glow (bioluminescent sensor) | export `body.skin.glow[]` | Glow correlates with rate (r > 0.5); peers/predators reading glow change outcomes. |
| 7 | Audiovisual prediction error + multisensory gain | `xmodal.ts` | PE spikes rise after scramble; disabling PE slows re-adaptation. |
| 8 | Escape hub with per-sense latency (sound 2, touch 3, light 5 ticks) | `escape.ts` | Predator survival drops with the hub off; latency ordering visible in the event log. |
| 9 | SA/FA antennae + in-world magnetic field (**SIMULATED** field) | — | Homing on vs off; SA-only vs FA-only change wall-following. |
| 10 | Neuron morphology classes (uni/bi/multipolar → delay, fan-in) | — | Swapping limb classes slows reflexes and hurts locomotion. |

Gate: `tests/gifts.test.ts`. Each gift must move a behavioural or physiological number beyond seed noise (≥ 2σ over 4 seeds), or it is cut. Energy prices are in ATP units per tick (BLUEPRINT table).

### 11.3 Phase 2 (BLUEPRINT): days of work, after Phase 1
- 2-D patch world (`weather.ts`, `terrain-*`, `edible-resource.ts`), predators (`super-hunt.ts`), a population of 10–50 with `social-field.ts` + worker, emergent signalling (`emergent-language.ts`, *trained*), T1 brain (1e3–1e4 neurons).
- **Phase 2 gifts (11–16):** dendrite decay length λ; dendrite growth + r² ∝ L/D branch energy; barrel-like layered E/I columns (~10% inhibitory); gene barcode per class; chimera grafting + niche-vacancy regrowth; MICrONS edge errors as a 5th flaw-mode.
- Phase 3 (weeks): T2 brain (1e5) in workers, 100+ generations, evolved predators. Phase 4 (needs GPU): T3, 1e8 synapses on WebGPU (`core/wilderness-webgpu.ts` pattern; that file lives in CQM).

### 11.4 The hold
**Phase 1 stays on hold until the Creature #1 runs finish. This is Alex's decision.** Exactly which runs, and how to tell when they are done, is **UNKNOWN** to Grok Bot. Ask Alex for an explicit "go" before starting Phase 1. Planning docs, harness fixes, extra seeds of the existing sim and site/docs work are fine in the meantime.

---

## 12. Brain & neuro frontier

### 12.1 BRAINS.md: purpose
A shared **design reference, not a build log**, for three brains: **CQM** (many small per-entity controllers), **C1** (Creature #1, 272 rate neurons) and **GL** (C1 + flaws). Items are tagged E (established), S (speculative) or O (open), and nothing is implemented unless it is marked [HAVE]. Alex wants it used as *the* shared brain reference. The core lesson: *"the bottleneck is not neuron count. It is whether parameters are trained by a rule that is driven by consequences."* A 1e8-parameter brain with untrained weights is a random projection.

Key sections to use: §11 cost table, §12 scaling ladder, §13 build order, §14 flaw × component matrix, §15 measurement (lesions, ablations ≥ 8 seeds, compensation curves), §16 open problems (16.11 *robust learning under sensor remapping* is "a niche GL can actually probe").

### 12.2 The 100M-parameter ladder (honest version)
| tier | neurons | synapses | nearest biology | status |
|---|---|---|---|---|
| L0 | 272 | ~1e4 | between worm (302 / ~7k) and larval zebrafish | [HAVE] ~3 ms/tick |
| L1 | 1e3 | 1e5 | — | Phase 1 (rate + LTC limbs) |
| L2 | 1e4 | 1e6 | parts of insect ganglia | Phase 2 (LIF/Izh, STDP+DA) |
| L3 | 1.4e5 | 2e7–5e7 | fly (~140k / ~50M; FlyWire, Dorkenwald et al. 2024) | Phase 3 |
| **L4** | **5e5** | **1e8** | ~2× fly synapses | **seed target**: Izh/LIF, int8 + delays, ~200 MB procedural / ~600 MB CSR; CPU 20–60 ticks/s, GPU interactive |
| L5 | 1e6–1e7 | 1e9–1e10 | honeybee, small fish | aspirational |
| L6/L7 | mouse / human | — | — | out of scope |

Candid points (BLUEPRINT/BRAINS):
- "100M neurons + 100M synapses" means about one synapse per neuron, which is not brain-like. The meaningful target is **1e8 synapses ≈ 1e8 params on ~5e5–1e6 neurons**.
- Out-counting the fly ≠ out-performing it.
- Spiking needs ms-scale substeps inside each 1-minute tick, which multiplies compute by **10–100×**.
- Scale the brain *with* sensor richness and body DOF, or the extra capacity goes unused.
- The tier numbers are order-of-magnitude estimates, not benchmarks (BRAINS §11).

GL brain v2 path (BLUEPRINT "Brain v2"):
1. LTC limb brains with CPGs and reflexes.
2. A gated-delta fast memory whose decay *is* the leak flaw.
3. A cerebellum + efference-copy detector that learns the backwards mapping.
4. A volatility-driven learning rate against scramble.
5. Misfire as a structured mutation channel.
6. L4 at ~200 MB.

### 12.3 The wireless/neuropeptide layer as the "psychic" basis
- The real biological basis for Glitchling's "wireless" sense is the **C. elegans neuropeptide connectome**, from Alex's images (`celegans_neuropeptide_cores.jpg`, `neuropeptide_network_motifs.png`, `celegans_neuropeptide_connectome_overview.jpg`). It is a second chemical network of about 92 peptide–receptor pairs that splits into motor, hub and sensory cores, with local, broadcasting, pervasive and integrative motifs.
- Design consequence (IMAGE_DEEP_DIVE synthesis #1): **"There are two networks, not one."** Glitchling's wireless should be primarily *internal peptides* (real biology). Inter-creature broadcast is an extension and stays **SIMULATED**. The SIMULATED `field.ts` payload is read *through* peptide receptors (Gift 1).
- The magnetic sense (Gift 9) is the in-sim, SIMULATED-field replacement for "psychic navigation".
- BRAINS §16.16: there is no biological psychic channel; real collectives use chemistry, sound and light.

### 12.4 IMAGE_DEEP_DIVE takeaways (cross-image synthesis, condensed)
1. Two networks: wiring + a dense hub-centred chemical layer, so function ≠ wiring.
2. Variability is normal (neurons drift 4–16 µm; only about half are nameable per animal). Frame the flaws as *amplified biological variability*.
3. Geometry is computation (morphology, dendritic distance, branch scaling, layers). GL needs a spatial substrate before its flaws mean anything biologically.
4. Energy logistics shape everything, so every gift gets an ATP price.
5. Maps are wrong in structured ways (MICrONS proofreading, truncated border cells). This motivates an edge-error flaw and a poke tool.
6. Prediction is wired in. Scramble should show up as *surprise*, which is a route to the area-100 "glitch self-model".
7. Brains are replaceable (chimeras, regeneration, organoids, xenobots), so give GL a recovery path (graft/regrow).
8. Scale honesty: the fly CNS is ~166k neurons and MICrONS ~1e5 per mm³. 272 neurons is a sketch.

Corrections recorded there: sound mainly adds *gain*, and average tuning got slightly broader rather than sharper (D3). The receptor→sign link for serotonin is real but partial, with low R² (A4). The electrophys panel (C7) is unreadable at its resolution.

### 12.5 NEURO_FRONTIER highlights
- 51 sourced findings across 9 themes (connectomes, connectome→behaviour, cell atlases, glia/non-synaptic, memory beyond neurons, wetware, BCI, consciousness/quantum claims, neuromorphic). Links were found in web search during the sweep; solidity tags run established / promising / preliminary / fringe.
- **Top 10 surprising:** kidney cells show the spacing effect; astrocytes hold multi-day memory traces; box jellyfish learn without a brain; stressed plants click ultrasonically; a one-parameter LIF on FlyWire predicts behaviour; gut flagellin is "sensed" by the brain; inner speech decodable (with a password); human cortex glia 2:1 with rare 50-synapse connections; glymphatic clearance disputed; Physarum memory is tube width.
- **20 missing ideas** (not yet in BRAINS.md): see Appendix A.6.

### 12.6 Alex's research images: `research/img/alex/` (26 files)
Alex collects these screenshots and often doesn't know what they show. He wants them interpreted and turned into Glitchling features. They are already turned into "Alex's finds" (NEURO_FRONTIER) and Gifts 1–16 (BLUEPRINT). **Sources are not identified**, and the attributions in IMAGE_DEEP_DIVE are **UNVERIFIED leads**. A good low-risk task is confirming the attributions with web search, without inventing anything.

---

## 13. Open problems / known bugs / missing files

### 13.1 `bestSiteFrac` always 0 (likely root cause found from reading the code; fix UNTESTED)
In `glitchling.ts` the runner does `if (g.foraged > fb) ch.push(g.lastChoice)` **after** `g.step()`. But `Organism.step()` sets `this.lastChoice = k` at the forage decision (core/organism.ts ~line 540) and later in the **same** step resets `this.lastChoice = -1` (~line 597, in the ATP block). So `ch` fills with −1, never equals `best`, and the fraction is 0.

**Fix (harness only, core untouched):** push `g.choices[g.choices.length - 1]` instead (`choices` is appended at the decision), or capture it inside an overridden `choose()`.

**Subtleties:**
- With `backwards`, Glitchling's `choose()` returns the mirrored k, so `choices` records the **executed** site. Decide whether bestSiteFrac means "went to the best site" (executed) or "intended the best site" (`g.intended[]`), and report both.
- Under the v4.0 "veto" path, `choose()` can be called twice per decision. That means `g.intended` may hold more entries than there are forages; check this before using it.
- `best` is computed from `pTrue` at birth, and `pTrue` can change with depletion if `o.deplete` is on.

### 13.2 Other known issues
| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | `results/state_v2.jsonl` missing | High (blocks real v4 renders) | v4 uses the synthetic file. See §11.1 #1. |
| 2 | v2 real-brain Glitchling never seen inside the full Mini World | High (showcase) | Headless Chrome died twice loading `?world=mini` at 1280×720 on the box (memory suspected, ~5 GB free). Try on the MSI GPU. |
| 3 | n = 2 seeds | High (science) | ±0.1 noise. Need ≥ 8 seeds, paired, with CIs. |
| 4 | `brain-viz/data.js` lacks events | Medium | Regenerate it (§10.2). |
| 5 | Leak has no events, so v3 drips are decoration and v4 drip positions are random (only the rate is data) | Medium | Export a per-tick leak magnitude (mean \|ΔwSite\|) and use it. |
| 6 | `tsc` strict-index type errors in `cqm-copy/src/sim/glitchling/glitchling.ts` and the jam `glitchling.ts` | Low | `bun build` is unaffected. |
| 7 | Hardcoded `/workspace/...` paths in render .mjs and the synthetic generator | Medium (on Windows) | Parameterise them. |
| 8 | Root `index.html` shows v1 numbers | Low | Banner or retire. Don't delete. |
| 9 | Hero render metadata logs one 404 | Low | Unknown resource. Investigate in the studio's network panel. |
| 10 | v4 schema has no position, so creatures stay in fixed spots | Medium | Add `pos` to the export when Phase 1 resumes. |
| 11 | v4 gaps: calm, frustration, moodVal, stress, fat and skin.wounds have no visual; eye stalks loosely attached; clip frames interpolated | Medium | Gaps listed in NOTES v4. |
| 12 | v3 body is a single tube (no branching anatomy), legs fairly straight, gait not simulated, neuron positions stylised, PNG not .exr, RectAreaLights don't cast shadows, GTAO instead of N8AO | Medium (art) | Honest gaps from NOTES. |
| 13 | Logged seed-1 `all` ≠ unlogged run (permutation redraw) | Low | Fix by logging from birth without redrawing. |
| 14 | Timestamp labels in NOTES mix "PST" and "PHT"; some PHT stamps are really PST | Low | Use PST going forward. |
| 15 | `cqm-copy/alife-gallery.js` modified (rebuilt bundle) | Low | Probably a build side effect. Don't propagate it to real CQM. |
| 16 | `results_v1/results.json` flawParams lack `rewireEvery`/`mildLeakRate` | Info | v1 didn't have them. |
| 17 | Driver of "all-flaws forages more" unknown | Science | Instrument the hunger/drive and affect paths. |
| 18 | glitchling.ts uses `as any` heavily to reach Organism internals | Low | Brittle if `core/` is ever re-synced from Creature #1. |

### 13.3 Missing or never-created files
- `results/state_v2.jsonl` (planned).
- `tests/coupling.test.ts`, `tests/gifts.test.ts` (planned).
- `body.ts`, `limbs.ts`, `field.ts`, `repro.ts`, `peptide.ts`, `serotonin.ts`, `develop-space.ts`, `graphstats.ts`, `poke.ts`, `xmodal.ts`, `escape.ts` (planned, ON HOLD).
- No `package.json` / `tsconfig.json` at the jam root (bun runs the TS directly).
- No git repo at the jam root, so there is no history. Provenance lives in NOTES.md.
- No README for the jam root. NOTES.md plays that role, and these handoff docs help.
- No `.exr`/`.hdr` outputs. All "HDR" PNGs are ACES-tonemapped.

---

## 14. Ideas backlog (ranked by impact vs effort)

Impact (I) and Effort (E) are on 1–5. Score = 2I − E. ⏸️ = blocked by the Phase 1 hold. The scores are Grok Bot's judgement calls, not measurements.

### Engineering
| score | idea | I | E | notes |
|---|---|---|---|---|
| 9 | Fix `bestSiteFrac` (executed + intended variants) | 5 | 1 | §13.1 |
| 8 | Real-fields-only `results/state_v2.jsonl` exporter (`export.ts` sibling) | 5 | 2 | Unblocks honest v4. No invented fields. Confirm with Alex that it's allowed during the hold. |
| 7 | `--out <dir>` and `--conds` CLI args for glitchling.ts so runs don't clobber `results/` | 4 | 1 | Safer seed sweeps. |
| 7 | Portable paths in render scripts + synthetic generator (env `JAM`, relative resolve) | 4 | 1 | Needed on Windows. |
| 6 | Regenerate brain-viz data.js with events; render real flaw events | 4 | 2 | |
| 6 | `scripts/check.sh` local CI (§10.5) | 4 | 2 | |
| 6 | `git init` the jam folder locally (no remote, ever) for history | 3 | 0–1 | Ask Alex first. It's harmless but it is his folder. |
| 5 | Worker-parallel seed sweeps (bun workers, one per core, niced) | 4 | 3 | 8 cores. |
| 4 | Fix `tsc` strict-index errors | 2 | 1 | Hygiene. |
| 6 | Mini World live on the MSI GPU, adapter-only | 5 | 4 | Big showcase win; risk of crashes. |

### Science
| score | idea | I | E | notes |
|---|---|---|---|---|
| 8 | 8–16 seeds, paired, with 95% CIs; report the noise floor | 5 | 2 | BRAINS §15. |
| 7 | Time-to-recover after each `sensor_shuffle` (from events[]) | 4 | 1 | Compensation curve; ties to area 100. |
| 7 | Factorial flaw design (2⁴ = 16 conditions) for interactions | 4 | 1 | Cheap: ~15 s per run-day. |
| 6 | Longer episodes (7–14 sim-days) for motor adaptation | 4 | 2 | Does the backwards gap close? |
| 6 | Dose–response sweeps: rewireEvery ∈ {30, 90, 360, ∞}, leak ∈ {0, .02, .06, .12} | 4 | 2 | Tests "a changing wrong map beats a fixed wrong map". |
| 5 | Explain "forages more": log the hunger drive, affect forageMul, efm roll | 4 | 3 | |
| 5 | MOT-only vs mirror-only split of `backwards` | 3 | 1 | Confirms the motor-count nuance. |
| 4 ⏸️ | Sleep-as-counter-leak test (does GL need more sleep than C1?) | 4 | 4 | BRAINS §13 GL step 7. |
| 3 ⏸️ | Area-100 "glitch self-model": forward model predicting the mirror | 5 | 5+ | The payoff experiment. Phase 1+. |

### Art
| score | idea | I | E | notes |
|---|---|---|---|---|
| 7 | Re-render the v4 still/clip from the **real** export once it exists (keep labels honest) | 5 | 3 | |
| 6 | Real event-driven clip of day 1 (144 frames at 10 fps ≈ 14 s), v3 studio, GPU | 4 | 2 | REAL activations + events. |
| 5 | Leak drips driven by measured \|ΔwSite\| | 3 | 1 | Removes a decoration. |
| 4 | Gait/IK from a simple CPG phase (render-side, labelled staging until Phase 1) | 3 | 2 | |
| 3 | True HDR output (.exr) | 2 | 1 | |
| 3 | New Tsotchke-style portraits seeded from the real activations (labelled GENERATIVE) | 2 | 1 | |

### Product / showcase
| score | idea | I | E | notes |
|---|---|---|---|---|
| 7 | REAL/SYNTHETIC legend badge on every site figure | 4 | 1 | |
| 6 | "Reproduce this" box with both Linux and Windows commands | 3 | 0–1 | |
| 5 | Interactive flaw toggles in the browser (bundle glitchling.ts + core for the browser, run 1 day live) | 5 | 5 | Organism runs at ~3 ms/tick, so it is feasible. Label REAL. |
| 4 | Prepare (do **not** deploy) a 0thernes.art-ready static bundle | 3 | 2 | Alex decides. |

---

## 15. Your first 90 minutes (Gemini Argon 4 in Antigravity)

**0–10 min: orient, read-only**
- [ ] Open `HANDOFF_QUICKSTART.md`, then this file's §2 (rules) and §7 (real vs synthetic).
- [ ] Confirm where you are: the MSI Z: drive copy or the box. On Z:, verify the copy is complete (§8.2 byte sizes; `results/activations_allflaws_seed1.json`, `brain-viz/data.js`, `artifacts/artificial-life/hdr/*`).
- [ ] Skim `NOTES.md` end to end (it is the log) and `glitchling.ts` (54 lines).

**10–25 min: environment**
- [ ] Install or check `bun` (box: 1.4.2). Create a Python venv with numpy and matplotlib (Windows: `.venv-win`).
- [ ] Serve the root (`py -m http.server 8765`) and open `/site/` and `/brain-viz/`. Compare with `site/screenshot-v7.png`.

**25–45 min: reproduce safely**
- [ ] Archive: copy `results/` to `results_v2/` (don't overwrite `results_v1/`).
- [ ] Run `bun run glitchling.ts 2 2` and diff the new `summary.csv` against `results_v2/summary.csv`. They should be **identical** if the environment is equivalent (seeded). If not, write down why (QRNG env, platform or bun-version float differences) and log it. Don't "fix" the numbers.
- [ ] `python plot.py` and eyeball the PNGs.

**45–65 min: first fix**
- [ ] Fix `bestSiteFrac` in the jam harness only (§13.1), reporting executed and intended variants. Re-run 2 × 2 into a *separate* output dir if you added `--out`. Confirm non-zero values.
- [ ] Append to NOTES.md: `YYYY-MM-DD HH:MM PST Gemini Argon (Antigravity): …`.

**65–85 min: seeds + honest stats**
- [ ] Run 8 seeds (niced, and only if the box/MSI isn't busy with Creature #1 runs). Compute paired deltas vs baseline and 95% CIs. Write a "Results v3 (8 seeds)" section **in NOTES.md** with caveats. Don't touch WRITEUP or the site until the headline has been re-checked.

**85–90 min: plan + report**
- [ ] Draft (don't build) a `state_v2.jsonl` real-fields exporter spec. Check with Alex whether it counts as Phase 1 (hold) or harness (allowed).
- [ ] Leave a NOTES.md summary and a short list of questions for Alex (A.8).

---

## 16. Glossary
| Term | Meaning |
|---|---|
| **Glitchling** | Creature #1's deliberately broken baby clone ("our little baby"). |
| **Creature #1 (C1)** | Alex's main A-Life organism. Source of `core/`. Its science runs gate Phase 1. |
| **CQM** | Cosmogonic Quantum Mechalogodrom, Alex's three.js A-Life world. `cqm-copy/` is a no-remote clone. |
| **Mini World** | CQM's small world mode at `?world=mini`. |
| **tick** | 1 sim-minute. 1440 = 1 sim-day. |
| **SITES** | The 16 foraging sites (4 colours × 4 shapes). |
| **REGIONS / NNEU** | The 14 brain regions / 272 neurons. |
| **MOT** | The 8 motor neurons (216–223): motility/efference, not site choice. |
| **striatal race** | `choose()`: competition among STR units that picks a site. |
| **wSite / wAlt / bA,bB** | Learned site values / alternate map / Beta-Bernoulli counts. |
| **pTrue** | True reward probability per site. |
| **scramble / leaky / backwards / misfire** | The 4 flaws (§4.3). |
| **mild** | v1 flaw behaviour (fixed permutation, 0.02 leak). |
| **all / all_mild** | All four flaws at v2 / v1 strength. |
| **events[]** | Logged flaw events (motor_wiring, sensor_shuffle, motor_reversal, misfire). |
| **bestSiteFrac** | Intended metric: share of forages to the best site. Currently broken. |
| **state_v2.jsonl** | Planned per-10-tick state export that renders may read. |
| **REAL / SIMULATED / SYNTHETIC / PLANNED** | Respectively: from the sim, an in-sim fictional mechanic, invented data to fill a schema, and specified but not built. |
| **Gift** | BLUEPRINT feature derived from Alex's research images, gated by a not-cosmetic test. |
| **"nothing cosmetic" gate** | Every visible thing is a readout of sim state, and every variable drives ≥ 2 areas (coupling test). |
| **E / S / O** | BRAINS.md tags: established, speculative, open. |
| **L0–L7 / T0–T4** | BRAINS / BLUEPRINT scaling tiers. |
| **LTC** | Liquid time-constant network (`core/fp/ltc.ts`). |
| **CPG** | Central pattern generator (limb rhythm). |
| **NSM** | C. elegans serotonergic neuron used for the "fed" signal (Gift 2). |
| **TeA** | Temporal association cortex, the escape-hub inspiration (Gift 8). |
| **SA/FA** | Slow- and fast-adapting sensor channels (Gift 9). |
| **MICrONS** | The mm³ mouse visual cortex connectome dataset (edge-error flaw idea). |
| **QRNG (Tsotchke)** | Seeded classical simulation of quantum RNG. Not hardware quantum. |
| **ACES** | Filmic tone mapping used for the PNG "HDR" renders. |
| **SwiftShader** | Software GPU that headless Chrome uses on the box. Slow. |
| **Antigravity** | Alex's Gemini-based coding environment on the MSI. |
| **PST** | America/Los_Angeles standard time (UTC−8; DST ended Sun Nov 1 2026 at 02:00). Use it for all logs. |

---

## 17. Appendix: self-contained reference

### A.1 Per-seed Results v2 (`results/summary.csv`, verbatim)
```
condition,seed,alive,ticks,forages,rewards,successRate,glcMean,glcEnd,fatEnd,firstHalfSuccess,secondHalfSuccess,bestSiteFracFirst,bestSiteFracSecond,jolts
baseline,1,true,2880,199,85,0.427,4.321,2.489,390.4,0.373,0.506,0,0,0
baseline,2,true,2880,150,41,0.273,3.134,2.448,339,0.27,0.276,0,0,0
scramble,1,true,2880,201,68,0.338,3.505,2.315,366.7,0.326,0.349,0,0,0
scramble,2,true,2880,144,51,0.354,3.258,2.328,350.8,0.458,0.302,0,0,0
leaky,1,true,2880,239,72,0.301,3.664,2.333,371.4,0.25,0.357,0,0,0
leaky,2,true,2880,138,54,0.391,3.303,2.342,354.9,0.51,0.322,0,0,0
backwards,1,true,2880,190,68,0.358,3.518,2.302,367.1,0.333,0.381,0,0,0
backwards,2,true,2880,188,46,0.245,3.175,2.367,344.5,0.29,0.218,0,0,0
misfire,1,true,2880,189,68,0.36,3.552,2.287,366.9,0.357,0.362,0,0,48
misfire,2,true,2880,117,56,0.479,3.404,2.569,357.7,0.439,0.517,0,0,48
all,1,true,2880,294,89,0.303,4.446,2.534,392.8,0.291,0.315,0,0,48
all,2,true,2880,143,43,0.301,3.171,2.651,341.4,0.246,0.351,0,0,48
all_mild,1,true,2880,313,84,0.268,4.185,2.45,386.5,0.286,0.254,0,0,48
all_mild,2,true,2880,140,44,0.314,3.157,2.448,342.3,0.31,0.317,0,0,48
```
Run seconds (`results_run.log`): 13.1, 93.3, 169.8, 26.6, 53.7, 16.8, 10.7, 5.1, 5.1, 3.8, 6.4, 3.2, 4.3, 3.8.

### A.2 v1 vs v2 headline shifts (from NOTES)
| condition | v1 success | v2 success |
|---|---|---|
| scramble | 0.302 | 0.346 |
| leaky | 0.349 | 0.346 |
| backwards | 0.301 | 0.301 (identical) |
| misfire | 0.316 | 0.419 (RNG stream shift only) |
| all | 0.291 (v1 all = v2 all_mild) | 0.302 |

v1 root `index.html` table (forages/rewards/success/glc/fat): baseline 174.5/63.0/0.350/3.73/364.7; scramble 189.5/57.5/0.302/3.36/356.4; leaky 176.5/61.0/0.349/3.43/360.8; backwards 189.0/57.0/0.301/3.35/355.8; misfire 183.5/58.5/0.316/3.43/357.9; ALL 226.5/64.0/0.291/3.67/364.4.

### A.3 Activations / events format (Neuralese v2)
- Condition `all`, seed 1, ticks 1–1440. `nNeurons: 272`. `frames[]`: 144 entries `{t, glc, regions:{SENS..ENS: mean rate}, rate:[272] (MOT 216–223 stored after reversal), wSite:[16 true learned values]}`.
- `events[]` sorted by tick (189 on day 1):
  - `{tick:0,type:"motor_wiring",motNeurons:[216..223],map:[7..0],sites:"k -> 15-k"}`
  - `{tick,type:"sensor_shuffle",perm:[16]}`: perceived channel k reads true site perm[k]. Tick 0, then every 90 (16 per day).
  - `{tick,type:"motor_reversal",intended,executed}`: every forage decision, executed = 15 − intended (148 on day 1).
  - `{tick,type:"misfire",site,synapses:[{syn,pre,post,from,to}×20]}`: every 60 ticks (24 per day). `syn` indexes `syn.w`; `pre`/`post` line up with `rate[]`.

### A.4 `state_v2.jsonl` schema (BLUEPRINT Phase 1 export, one line per 10 ticks per creature)
```json
{"t":720,"id":"g1","parent":null,"gen":0,"alive":true,
 "body":{"nSeg":7,"seg":[{"r":0.42,"pressure":0.7}],"vol":1.1,"skin":{"rgb":[0.6,0.2,0.8],"wounds":[]}},
 "limbs":[{"j":0,"len":0.9,"phase":1.3,"contact":1,"rev":true,"ganglionRate":0.21,"fatigue":0.1}],
 "eyes":[{"pos":[0.1,0.3,0.0],"aperture":0.6,"stalk":0.2}],
 "brain":{"regions":{"CTX":0.12},"rate":"[272]","motIntended":4,"motExecuted":11},
 "metab":{"glc":3.6,"atp":1.8,"fat":362,"heat":0.4},
 "affect":{"fear":0.1,"delight":0.3,"frustration":0.05,"calm":0.5,"moodVal":0.1,"stress":0.2},
 "field":{"amp":0.4,"payload":[0.1,0.3],"rvActive":false,"label":"SIMULATED"},
 "flaws":{"perm":[],"leak":0.06,"misfireAt":720},
 "events":[{"type":"misfire","site":3}]}
```
These values are BLUEPRINT's illustrative example, not real output. Render rule: the renderer may ONLY read these fields. Skin colour is set by the sim and never by the renderer.

### A.5 v4 render mapping (studio-v4 `MAPPING`)
seg r/pressure → tube radius/wrinkle; nSeg → pinches; vol → scale; skin.rgb → colour/attenuation; heat → rim; glc → gut glow; rate → neuron size/glow + links; misfire → gold brain + chromatic aberration; atp → brain light; limb phase/contact/len/fatigue → IK step; rev → orange leg; ganglionRate → ganglion glow; eyes pos/stalk/aperture → placement/stalk/pupil; sensor_shuffle → magenta eyes; delight → photophores; fear → crouch; leak → drip spawn rate; field amp/payload → ring opacity/hue; rvActive → beam; birth → child appears.

### A.6 NEURO_FRONTIER "20 missing ideas"
1 cell-type layer under the 14 regions · 2 like-to-like synaptogenesis in develop.grow · 3 rare super-synapses as misfire targets · 4 astrocyte multiday slow memory · 5 ephaptic field term per region · 6 glymphatic clearance with a contested-parameter toggle · 7 non-neural cell memory (spacing effect) in metabolism · 8 sharp-wave-ripple tagging for replay · 9 Physarum tube-width memory mode · 10 brainless ring-net (jellyfish) minimal mode · 11 slow body-wide Ca²⁺/glutamate alarm channel · 12 emitted distress "ultrasound" readable by peers (simulated) · 13 segmented per-limb mini-controllers (octopus) · 14 bioelectric body-plan field that scramble corrupts · 15 gut microbiome → vagal → affect · 16 free-energy (DishBrain) training mode · 17 reservoir-readout mode for untrained brains · 18 decoded "voice"/"dream image" renderers (simulated) · 19 dual consciousness metrics (Φ-proxy + ignition), claim-free · 20 neuromorphic export (Lava/SpiNNaker2-style).

### A.7 BLUEPRINT quick facts
- 100 areas = 10 systems × 10 (morph 1–10, metab 11–20, sense 21–30, neural 31–40, affect 41–50, behav 51–60, social 61–70, repro 71–80, genome 81–90, life/env 91–100). SIMULATED areas: 29 (field sense), 30 (remote viewing), 61 (wireless field), 62 (psychic coupling).
- 76 areas map to existing code and 24 are new. 106 of the 500 attributes name an existing variable.
- Area 100 "Glitch self-model" is the payoff experiment: can the creature learn its own flaws (`glitch.aware`)?
- CQM modules whose self-audits say they are untrained or near-inert: `super-creature.ts`, `xenomimic-brain.ts` (`mimicBasin` ≡ 0.5), `theory-of-mind.ts`, `metacognition.ts`, `morphic-field.ts` (≤ 0.0012/beat), `topdown-perception.ts`. Solid modules: `math/izhikevich.ts`, `math/predictive-coding.ts`, `math/global-workspace.ts`, `sim/genome.ts`, `sim/lineage.ts`, `sim/mortality.ts`, `sim/weather.ts`, `sim/terrain-deformation.ts`, `sim/edible-resource.ts`, `sim/social-field.ts`, `sim/stigmergy.ts`, `math/spatial-hash.ts`, `core/wilderness-webgpu.ts` (all paths under `cqm-copy/src/`).
- **Reuse rule:** a CQM module enters Glitchling only with a live input from organism state AND an output another area consumes, plus a unit test showing the output changes when the input changes.

### A.8 Open questions for Alex
1. Which "Creature #1 runs" gate Phase 1, and how will we know they've finished?
2. Is a real-fields-only `state_v2.jsonl` exporter allowed during the hold, or is it Phase 1?
3. Did the Z: copy finish? Is the box or the MSI canonical from now on?
4. May the Mini World adapter in `cqm-copy` be edited further, or should new work go in a fresh jam-local copy?
5. Is the 0thernes.art showcase ever meant to go live (by the 0thernes.art website bot or Alex)? Until he says so, local only.
6. What are the Glitchling lead's and A-Life Marketing's bot ids (not found on disk)?
7. OK to `git init` the jam folder locally (no remote) for history?

### A.9 One-screen command card
```bash
# box
cd /workspace/glitchling-jam
mkdir -p results_v2 && cp -n results/* results_v2/          # archive before re-running
nice -n 19 bun run glitchling.ts 2 2                       # sim → results/
.venv/bin/python plot.py                                   # plots
python3 -m http.server 8765                                # → /site/ , /brain-viz/
cd cqm-copy && bun scripts/glitchling-headless.ts /tmp/al-run 1440   # AL real-brain headless (new dir keeps the old artefacts)
```
```powershell
# MSI / Antigravity
Set-Location -LiteralPath 'Z:\[Vibe Coded (AI)]\CLAUDECODE\glitchling-jam'
New-Item -ItemType Directory -Force results_v2 | Out-Null; Copy-Item results\* results_v2\ -Recurse
bun run glitchling.ts 2 2
py -m venv .venv-win; .\.venv-win\Scripts\pip install numpy matplotlib; .\.venv-win\Scripts\python plot.py
py -m http.server 8765
```
(The PowerShell lines are untested. Bun on Windows and `-LiteralPath` handling of the bracketed folder are the likely snags.)

*End of handoff. Look after the baby. 🐛⚡*
