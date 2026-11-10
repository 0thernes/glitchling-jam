# Glitchling: handoff QUICKSTART (for Gemini Argon 4 in Antigravity)

*Sun Nov 1 2026, ~21:30 PST (America/Los_Angeles). From Grok Bot. The full report is `HANDOFF_GEMINI_ARGON_ANTIGRAVITY.md`.*

**What it is:** Glitchling ("our little baby") is a deliberately broken clone of Alex's Creature #1. `core/` is a frozen copy of the C1 organism: 272 rate neurons in 14 regions, plus metabolism, affect and a grown wiring. `glitchling.ts` adds four flaws:
- **scramble**: senses re-permuted every 90 ticks, plus σ 0.25 noise.
- **leaky**: learned values decay 6% per tick.
- **backwards**: the 8 MOT neurons are reversed and the 16-site choice is mirrored (k → 15−k).
- **misfire**: 20 synapse jolts every 60 ticks.

1 tick is 1 sim-minute. The jam was Sun Nov 1 2026.

## 🚨 Rules (non-negotiable)
- **Never modify Alex's real repos or sites** (CQM, Asmodensius, 0thernes.art, Creature #1). **Never push, deploy, post or email.**
- Work only inside `glitchling-jam/`. `cqm-copy/` is a no-remote clone: read and reference it only, and put new work in new files. `core/` is frozen.
- Label everything **REAL / SIMULATED / SYNTHETIC**. Never invent numbers or citations; write UNKNOWN instead.
- ⏸️ **Phase 1 build is ON HOLD until the Creature #1 runs finish (Alex's decision).** Harness fixes, more seeds, docs and site work are OK.
- Log in **US Pacific** (`YYYY-MM-DD HH:MM PST`), append-only, in `NOTES.md`. Don't kill other bots' jobs, and run yours with `nice`.

## How to open
- **Box:** `cd /workspace/glitchling-jam`
- **MSI:** `Set-Location -LiteralPath 'Z:\[Vibe Coded (AI)]\CLAUDECODE\glitchling-jam'`. The copy may still be in progress, so verify the file sizes listed in the full report §8.2.

Commands:
```bash
mkdir -p results_v2 && cp -n results/* results_v2/   # archive first: the run overwrites results/
nice -n 19 bun run glitchling.ts 2 2                # 2 sim-days × 2 seeds × 7 conditions → results/
.venv/bin/python plot.py                            # Windows: make a fresh venv with numpy + matplotlib
python3 -m http.server 8765                         # from the jam ROOT → http://localhost:8765/site/ and /brain-viz/
```

Read in this order: NOTES.md (the log), glitchling.ts (54 dense lines), BLUEPRINT.md (the v2 spec and phases), BRAINS.md (the brain reference), then research/*.md.

## Real vs synthetic (at a glance)
| REAL | SYNTHETIC / SIMULATED / GENERATIVE |
|---|---|
| `results/*` (v2 numbers, plot, activations + events) | v4 stills `hdr/glitchling-v4-t720/t800-4k.png` and the v4 clip: **SYNTHETIC** (from `synthetic/state_v2.synthetic.jsonl`; `results/state_v2.jsonl` doesn't exist) |
| brain-viz REAL playback (verbatim activations; its data.js has no events) | brain-viz SIMULATED toggle; the flaw overlays are annotations |
| v2 and v3 4K heroes: REAL geometry plus REAL activations/events at tick 720 (body procedural, studio scene, not Mini World) | Tsotchke `art/glitchling_1..6.png`: **GENERATIVE** (model trained on 11 images; "QRNG" is a seeded classical simulation) |
| AL headless real-brain log (1440 ticks, 189 forages, 41 rewards) | wireless / psychic / remote viewing: **SIMULATED** mechanics, PLANNED, not built |
| `WRITEUP.md` (v2 numbers, n=2 caveat) | root `index.html`: real but **stale v1** numbers |

**Results v2 headline:**
- All flaws vs baseline: success 0.302 vs 0.350, forages 218.5 vs 174.5, rewards 66 vs 63, mean glucose 3.81 vs 3.73. 14/14 creatures alive.
- **n = 2 seeds**, with about ±0.1 noise. `bestSiteFrac` is broken (always 0).
- The behavioural "backwards" effect is the 16-site mirror, not the MOT reversal.

## Top 10 next actions
1. Verify the Z: copy is complete (sizes and file counts against the full report §8.2), then archive `results/` to `results_v2/` before running anything.
2. Reproduce v2 (`bun run glitchling.ts 2 2`) and diff `summary.csv` against the archive. Log any mismatch honestly.
3. Fix `bestSiteFrac` in the harness only: `lastChoice` is reset to −1 inside `step()`, so use `g.choices[g.choices.length-1]`. Report both executed and intended variants.
4. Add `--out <dir>` / `--conds` CLI options to glitchling.ts so new runs never clobber `results/`.
5. Run ≥ 8 seeds (niced), paired by seed, with 95% CIs. Write "Results v3" into NOTES.md with caveats.
6. Ask Alex whether a **real-fields-only** `results/state_v2.jsonl` exporter is allowed during the hold. If yes, build it with no invented body, limb or field values.
7. Regenerate `brain-viz/data.js` with `events[]` and make the viz show the real flaw events.
8. Make the render scripts and the synthetic generator path-portable (they hardcode `/workspace/...`) so they run on the MSI.
9. Try Mini World live (`?world=mini`) on the MSI GPU, adapter-only. Deliverable: a REAL-labelled screenshot.
10. Bump the site only when the content changes: add REAL/SYNTHETIC badges and Windows run commands, save a screenshot-v8, and add a NOTES line ("local only").

**Don't start until Alex says go:** BLUEPRINT Phase 1 (body.ts, limbs.ts, field.ts, repro.ts, coupling tests) and the top-10 gifts (peptide layer, NSM serotonin, spatial wiring, graph stats, poke test, voltage glow, AV prediction error, escape hub, SA/FA + magnetic antennae, morphology classes).

**Open questions for Alex:**
- Which Creature #1 runs gate the hold?
- Did the Z: copy finish?
- May the cqm-copy adapter be edited further?
- What are the bot ids for the Glitchling lead and A-Life Marketing?
