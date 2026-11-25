# AUDIT/FINDINGS.md

Every finding from the hardening passes in [`PASSES.md`](PASSES.md). Each has exactly one class:
bug, error, issue, problem, concern, dilemma, conflict, gap, hole or blindspot.

Class meanings used here:
- **bug**: code does the wrong thing.
- **error**: a statement or reference that is factually wrong.
- **issue**: works, but degraded (layout, UX, accessibility).
- **problem**: a structural defect that blocks a goal, such as reproducibility.
- **concern**: a risk (legal, privacy, credibility), not a defect yet.
- **dilemma**: the fix trades one good against another, so the owner must choose.
- **conflict**: two parts of the repo disagree with each other.
- **gap**: something expected is missing.
- **hole**: an input or path that is not guarded.
- **blindspot**: something reported as measured or real that nobody had checked.

Severity runs high, medium, low. Status is **fixed** (commit in [`../CHANGELOG.md`](../CHANGELOG.md)), **deferred** (with a reason), or **needs Alex** (his judgment, not mine).
Line numbers refer to the tree before the audit commits (origin/main `fe9cb19`).

| ID | Class | File:line | Severity | Finding | Status |
|---|---|---|---|---|---|
| F01 | blindspot | `live/js/sim/brain.js:683-688`, `live/js/honesty.js:3`, `live/index.html:6`, `live/README.md:53,63` | high | The synapse totals for MEGA (16,777,216) and GIGA (1,132,483,840, "1.13B") are set by formula (`16777216 - explicitS`, `80 * N - explicitS`), not counted, yet the honesty panel listed them under **Real**. Measured on seed 1: 30,554 (MEGA) and 28,131 (GIGA) explicit synapses. GIGA adds 113,248,384 Int8 cluster weights (8 per neuron, lazily allocated) and steps at about 1,076 ms per 1/60-s step in Node. | **fixed** (docs/panel). The honesty panel, live README and page meta now say "nominal", with the measured numbers. The code still reports `B.S` the same way so the probes stay comparable. Whether to rename the headline is **needs Alex** (D2). |
| F02 | concern | `live/test/nobel_rigor_suite.mjs`, `README.md`, `live/README.md`, `SCIENTIFIC_DEFENSE_DOSSIER.md` | high | The suite calls its checks "theorems" and the file is named "nobel". They are pre-specified statistical tests on designed lesion or surrogate contrasts inside the simulation, plus numerical identity checks. They are not mathematical theorems, and the "Nobel" name reads as promotional, which costs academic credibility. | **partly fixed**: a plain-language note was added to `live/README.md`. Renaming the file and its 35 "theorem" labels would rewrite the other agent's pass 21–22 work, so that is **needs Alex** (D1). |
| F03 | bug | `play/sim.js:30` (also `live/js/sim/world.js:196`, `core/organism.ts:390`) | medium | The world uses `[0,1,2,3].sort(() => r() - 0.5)` to shuffle colour and shape values. The result depends on the engine's sort algorithm: in 186 of 200 seeds, V8 (Chrome, Node) and JavaScriptCore (Safari, Bun) build a different world from the same seed, and V8's output is heavily biased (one permutation came up 41 times in 200; uniform would be about 8). | **fixed in `play/`** (seeded Fisher–Yates). In `live/` and `core/` it is **needs Alex** (D3): fixing it changes every seeded world, so all the measured numbers in `live/CHANGELOG.md` and the rigor suite would need re-running, and `core/` is the Creature #1 copy. |
| F04 | gap | repo root | high | There is no `LICENSE`, so legally all rights are reserved and nobody can reuse the code, although the repo is public. Vendored three.js (MIT), p5.js (LGPL-2.1) and Eshkol keep their own licence files. | **needs Alex** (D4): choosing a licence is the owner's call. |
| F05 | concern | `research/img/alex/` (26 files) | high | 26 figures, many apparently from journal papers (MICrONS, *C. elegans* atlases and others), are published with no source or licence record. Unlike `research/img/SOURCES.md`, nothing covers them. Republishing journal figures in a public repo can infringe copyright. | **needs Alex** (D5): remove, make private, or add sources and licences. |
| F06 | gap | `research/img/SOURCES.md` | low | The CC BY / CC BY-SA images list the licence and source page but not the author. CC BY requires author attribution. | deferred: needs an author lookup on each Commons page. Logged for a later pass. |
| F07 | gap | repo root | high | There was no CI, no `npm test` and no single command to check the repo. Of 30 probes, only `nobel_rigor_suite.mjs` and `dome_heptarch_probe.mjs` assert anything; the rest print numbers. | **fixed**: `tools/check.mjs` (9 checks), `package.json` scripts, `.github/workflows/ci.yml`. |
| F08 | gap | repo root | medium | `CHANGELOG.md`, `CONTRIBUTING.md` and `SECURITY.md` were missing at the root, and the README had no badges. | **fixed** |
| F09 | error | `README.md:46`, `site/index.html:39` | low | The README and site say v1 data is "kept in `results_v1/`", but that folder was never committed. | **fixed** (wording now says it is not published; v1 settings appear as `all_mild`) |
| F10 | error | `site/index.html:33-35` | low | The public "Run it" block used a private box path (`cd /workspace/glitchling-jam`) and a local `.venv/bin/python`. | **fixed** (`git clone …`, `python3 plot.py`, notes that matplotlib is needed) |
| F11 | issue | `site/style.css` | medium | At 390 px wide the showcase page scrolled sideways (document width 417 px) because long unbroken strings did not wrap. | **fixed** (`overflow-wrap:anywhere` on text blocks; verified 390 = 390) |
| F12 | issue | `brain-viz/index.html:1` | medium | No viewport meta, no `lang`, no description and no accessible name on the canvas. Trying `width=device-width` showed the canvas layout is fixed-width: at 390 px the HUD text overlaps the drawn labels. | **fixed** (explicit `width=1000` viewport so phones scale the whole layout cleanly, plus `lang`, description and canvas label). A truly responsive canvas layout is deferred. |
| F13 | issue | `live/index.html:88-91` | low | The three flaw-parameter number inputs had no accessible name (they sit inside a label that belongs to the checkbox). | **fixed** (`aria-label`) |
| F14 | issue | `live/index.html:40-62` | low | Eight data-panel canvases had no role or accessible name. | **fixed** (`role="img"` + `aria-label`) |
| F15 | hole | `play/app.js:13-18` | medium | The `leak`, `scramble`, `misfire` and `seed` URL parameters were not clamped. For example `?leak=10000` sets the leak rate to 100 per tick, which drives the learned values into overflow, NaN. | **fixed** (clamped to the slider ranges) |
| F16 | hole | `live/js/app.js:12,552` | low | The seed from the URL or the input box accepted negative, fractional and huge values. | **fixed** (integer 1…2³¹−1) |
| F17 | bug | `live/test/symmetry_probe.mjs:3` | low | Run with no argument, the probe printed `undefined` as its mode label. | **fixed** (defaults to `wave`) |
| F18 | concern | `core/organism.ts` | medium | `core/` is an older 152 KB copy of Creature #1's organism. Alien Life 1-100 says to re-vendor it from the frozen pin `bc6ad6a`. Phase 1 is on hold until the Creature #1 runs finish. | **deferred** (on hold by agreement; touches Creature #1) |
| F19 | gap | `core/*.ts` | low | `tsc --strict` reports 8 possible-null errors (TS2531/TS2532), all inside `core/`. Without strict mode the TypeScript is type-clean. (The 6 TS2451 "redeclare" errors are an artefact of compiling standalone `core/fp/*` scripts together.) | deferred: `core/` is the Creature #1 copy and must not be edited here |
| F20 | concern | `HANDOFF_GEMINI_ARGON_ANTIGRAVITY.md` (34 hits), `NOTES.md` (7), `HANDOFF_QUICKSTART.md` (3), `artifacts/*.mjs` | low | The public repo exposes internal machine paths (`C:\Users\…`, `Z:\…`, `/workspace/…`) and internal agent UUIDs. No secrets were found. | **needs Alex** (D6): keep (it is a jam log) or scrub |
| F21 | gap | `artifacts/artificial-life/glitchling-*.{csv,json}`, `NOTES.md:72-109` | low | The "REAL brain" headless artefacts were made by `scripts/glitchling-headless.ts` in a `cqm-copy/` tree that is not in this repo, so they can't be reproduced from here. | deferred: documented here |
| F22 | gap | `live/test/nobel_rigor_suite.mjs` | medium | The full 15-test suite is very slow: on this box T1–T2 finished in about 1 minute and then T3 ran past 25 minutes. That is too long for CI, so its headline numbers were not re-checked end to end in this audit (see P09). | deferred: CI runs the fast checks. `npm run rigor` runs the full suite by hand. |
| F23 | conflict | `live/README.md:52` vs `:53` and `live/js/honesty.js` | low | The pass-18 row says GIGA has 56.62M synapses and the pass-19 row says 1.13B. Neither is a counted figure. | **fixed** by F01 (both are now explained as nominal) |
| F24 | concern | `live/index.html:106`, `live/js/tsotchke/qrng.js` | low | The "Fetch live photonic QRNG" button calls 4 external beacons. It is opt-in (click only) and nothing else on the page uses the network, but drand and the NIST beacon are not photonic sources. | **needs Alex** (D7): reword the label to "public randomness beacons" |
| F25 | gap | `live/js/**` | low | The 25 first-party `live/` JS modules have no type checking or lint config. | deferred: adding JSDoc/`checkJs` across 1 MB of code from another agent is out of scope for a hardening pass |
| F26 | conflict | `brain-viz/index.html:1` | low | The page title said "(SIMULATED)" but the page opens in REAL DATA mode, playing back `results/activations_allflaws_seed1.json`. | **fixed** (title now says "real playback + labelled simulated mode") |
| F27 | error | `live/js/tsotchke/qrng.js:621,636` | low | Two stale comments describe a 14-qubit, 16,384-amplitude circuit, but the code runs `NQ = 16` (`DIM = 65,536`, line 20). | **fixed** (comments now match the code) |
