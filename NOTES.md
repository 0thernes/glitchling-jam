# Glitchling: one-day jam coordination doc

**What it is:** Glitchling is a deliberately broken baby clone of Creature #1. `core/` is a copy of the Creature #1 organism code from `Asmodensius-v40/creatures/001/organism` (organism, affect, develop, v40mods, substrate, tsotchke, fp/). The only change is that the copies' absolute imports were rewritten to relative paths, and the diag/trace files that needed the test suite were dropped. `glitchling.ts` subclasses `Organism` and adds four flaws you can switch on and off. The original repos are untouched.

## Run it (exact commands)
```
cd /workspace/glitchling-jam
nice -n 19 bun run glitchling.ts 2 2      # days=2, seeds=2 → results/results.json, results/summary.csv, results/activations_allflaws_seed1.json
.venv/bin/python plot.py                  # → results/glitchling.png, results/cursed_portrait.png
```
In code: `new Glitchling(seed, { scramble, leaky, backwards, misfire, mild })`, then call `.step()` once per tick (1 tick = 1 sim minute). Strengths are set in `FLAW_PARAMS`. The 2nd run took about 11 min wall time because the box load average was 40–97.

## Flaw flags (v2 defaults match the brief)
| flag | what breaks | default (v2) | `mild: true` (= v1 behaviour) |
|---|---|---|---|
| `scramble` | The creature reads site values and availability for the 16 action channels through a random permutation, plus Gaussian noise (σ 0.25). | **new permutation every 90 ticks** (`rewireEvery`) | one fixed permutation for life |
| `leaky` | Learned site values, the alternate map and the Beta counts decay toward their priors each tick, and plastic synapses shrink at 5% of that rate. | **0.06/tick** | 0.02/tick |
| `backwards` | **All 8 MOT motor neurons are reversed**: after every tick their rates are read out in reverse order (MOT neurons 216–223, i→7−i). The chosen action is also mirrored (site k → 15−k), and learning credits the site actually visited. | on | same |
| `misfire` | Every 60 ticks, one site value and 20 random synapses get a jolt. | σ 0.3 | same |

**Motor count:** the MOT region has exactly **8** neurons (`REGIONS` in core/organism.ts), so "all 8 motors" holds. However, in this model the MOT neurons drive motility and efference/ATP cost, not *which* site is foraged. Site choice comes from a striatal race over **16** sites. That is why the behaviourally meaningful reversal is the 16-way action mirror, and the 8-neuron reversal is mostly an internal/efference effect.

## Results v2 (2 sim-days, seeds 1–2, means; v1 kept in `results_v1/`)
| condition | forages | rewards | success | mean glc | fat end | survived | success 1st→2nd half (s1, s2) |
|---|---|---|---|---|---|---|---|
| baseline | 174.5 | 63.0 | 0.350 | 3.73 | 364.7 | 2/2 | .37→.51, .27→.28 |
| scramble (rewire/90) | 172.5 | 59.5 | 0.346 | 3.38 | 358.8 | 2/2 | .33→.35, .46→.30 |
| leaky (0.06) | 188.5 | 63.0 | 0.346 | 3.48 | 363.2 | 2/2 | .25→.36, .51→.32 |
| backwards (8 MOT + mirror) | 189.0 | 57.0 | 0.301 | 3.35 | 355.8 | 2/2 | .33→.38, .29→.22 |
| misfire | 153.0 | 62.0 | 0.419 | 3.48 | 362.3 | 2/2 | .36→.36, .44→.52 |
| all (v2) | 218.5 | 66.0 | 0.302 | 3.81 | 367.1 | 2/2 | .29→.32, .25→.35 |
| all_mild (= v1 all) | 226.5 | 64.0 | 0.291 | 3.67 | 364.4 | 2/2 | .29→.25, .31→.32 |

**What changed from v1:**
- Harsher scramble and leak did *not* make things worse on average. Scramble success went 0.302 → 0.346, leaky 0.349 → 0.346, and all-flaws 0.291 → 0.302, with glucose 3.67 → 3.81. A likely reason: re-shuffling every 90 ticks turns a consistent misdirection into near-random exploration. A fixed wrong map is worse than a constantly changing one, and with a 6% leak the values were already near-prior.
- Backwards is identical to v1. The MOT readout reversal had no measurable effect on foraging over 2 days, which is consistent with the note on motor count above.
- Misfire changed (0.316 → 0.419) only because the flaw RNG stream shifted: a non-scramble run no longer draws a permutation at birth. The flaw is unchanged, so this ±0.1 swing is a measure of seed/RNG noise at n=2. Read every difference above with that in mind.
- In v2, all-flaws success rises from the first half to the second in both seeds (.29→.32, .25→.35). That is weak evidence of within-life compensation, which v1 didn't show.
- Still 14/14 alive. The `bestSiteFrac` columns remain broken (always 0); ignore them.

## Teammates
- **Artificial Life (CQM Mini World):** `Glitchling` is a drop-in `Organism` subclass with the same `step()` and the same fields (`blood.glc`, `fat`, `foraged`, `dead`). In a *copy* of the CQM/cqw Mini World (`?world=mini`, see `/workspace/cqw/docs/MINI-WORLD-AND-SANDBOX.md`), import `./core/organism` plus `glitchling.ts` and construct `new Glitchling(seed, flags)` where the creature is created. Pass `o.pool` if you want shared food. Not done here, per the jam rule against touching CQM.
- **Neuralese:** `results/activations_allflaws_seed1.json` (activations + flaw `events[]`); see the format section at the end of this file.
- **Tsotchke:** `results/cursed_portrait.png` is the mean neuron activations folded into a face, with RGB channel shift and scanline tearing. Regenerate it with `plot.py`.
- **0thernes.art:** `index.html` is a self-contained static page (portrait, plot, table) using relative image paths. Not deployed.
- **A-Life Marketing:** write-up (Results v2): "Meet Glitchling, Creature #1's broken baby. We rewired its senses every 90 ticks, leaked its memory at 6%/tick, reversed all 8 motors, and let its synapses misfire. Two simulated days later it's still alive. Hit rate drops from about 0.35 to 0.30, but it forages about 25% more (218.5 vs 174.5), eats a bit more often (66 vs 63), and ends with slightly higher glucose (3.81 vs 3.73). Life finds a way, even badly." (Caveat: 2 seeds.)
- **Chief of Staff (timekeeping):** started 09:46 PST, results at 09:51 PST, docs done ~09:55 PST, Sun Nov 1 2026. The full run takes about 2–5 min wall time with one nice'd job under load avg ~20. Next steps if there's time: more seeds (budget ~15 s per run-day), fix `bestSiteFrac`, longer episodes for the motor-adaptation question.

## Tsotchke (chaos diffusion) - Nov 1
- 6 cursed Glitchling portraits in `art/glitchling_1..6.png`, made with the from-scratch chaos model (`models/chaos_demo`): QRNG chaos-string blends, embeddings extrapolated 1.5x-4x past normal, CFG 6, 100 steps, 64px upscaled to 512. Expect texture soup; the demo model was trained on only 11 images.

## Other teammates' artifacts already in this folder (found 09:52 PST, made by other agents, not by the sim run)
- `WRITEUP.md`: A-Life Marketing draft (09:47). It describes flaws that don't match the build (offspring, "three steps" memory). Use the numbers above.
- `art/`: glitchling_1–6.png plus a sheet (Tsotchke?). `brain-viz/`: a brain.js viewer. `site/`: a static site. `cqm-copy/` and `artifacts/artificial-life/`: the Artificial Life team's Mini World copy, which is the natural place to wire in `Glitchling`.
- The root `index.html` is the sim's own results page. If 0thernes owns `site/`, they can merge it there.
- 09:53 PST A-Life Marketing: rewrote WRITEUP.md with the real flaws and jam results (2 seeds, small-sample caveat); removed the incorrect offspring and 'three steps' claims. No posting.
- 09:55 PST Showcase (Grok Bot): refreshed site/index.html + style.css. Includes the lead brief as the intro, Tsotchke's art/glitchling_1..6.png + sheet (gallery, alt text), Alien Life 1-100's results/glitchling.png + cursed_portrait.png, the run command, and the results table (bestSiteFrac column left out), plus WRITEUP.md marked "being corrected". Placeholders: Artificial Life Mini World notes, final write-up, Neuralese viz. Local only; nothing deployed or posted.
- 2026-11-01 09:54 PST Brain Viz v2: brain-viz now defaults to REAL playback of results/activations_allflaws_seed1.json (embedded offline as brain-viz/data.js, generated verbatim from the JSON), with a REAL/SIMULATED toggle top-right (?mode=sim and ?frame=N also work). The banner names the data source. Mapping: 272 rates split in core/organism.ts REGIONS order SENS16 THAL16 CTX64 HIP32 STR32 HYP16 VTA6 RAPHE6 LC6 BF6 INS8 SCN8 MOT8 ENS48; per-region means match the file's regions values in all 144 frames. MISMATCH: this is not the Creature #1 canvas MLP layout (24→222→189→32 / 32→195→195→8), and the viz says so on screen. The file has no flaw events, so scramble and backwards are annotations taken from glitchling.ts, leak is shown as wSite drift to 0.25, and sparks mark wSite jumps >0.05. Screenshot (real, frame 61): brain-viz/screenshot.png.
## Artificial Life (CQM Mini World)

> v1 (below) was written when NOTES.md and Alien Life's code were not yet on disk, so it used a toy brain. Its artifacts now live in `artifacts/artificial-life/v1-toy/`. v2 replaces that brain; see the update after v1.

**What I did:** I shallow-cloned CQM (HEAD 4ceed2d, 2026-11-01) into `cqm-copy/` and removed `origin`, so it has no remote. Nothing was pushed or deployed, and the user's PC was not touched. I added one isolated module, `cqm-copy/src/sim/glitchling/glitchling.ts`, which has a seeded `GlitchlingSim` and a tiny `GlitchlingView` (a wireframe icosahedron plus a green food dot). I added 4 lines to `cqm-copy/src/world.ts`: an import, a field, `if (IS_MINI_WORLD)` spawn, and `this.glitchling?.update(dt)` in `step()`. It only exists at `?world=mini`, and the main world is unchanged.

**What it does:** It is one creature that seeks food on a 20-unit disc. Each tick it can glitch:
- senseScramble (30%): the food bearing is rotated 90°.
- memoryLeak (12% while remembering): it forgets its goal, and remembered goals also drift.
- motorReverse (35% of thrusting ticks): it backs away from what it is chasing, logged as `flee-food`.
- mutationMisfire (3%): size, colour or speed jumps at random.

**Run commands (from `cqm-copy/`):**
- Headless sim: `bun install --frozen-lockfile && bun scripts/glitchling-headless.ts /workspace/glitchling-jam/artifacts/artificial-life`
- Browser: `bun run build && PORT=3917 bun server.ts`, then `node /workspace/glitchling-jam/artifacts/artificial-life/shot.mjs` (Playwright + SwiftShader Chrome, headless)

**Results (headless, 400 ticks at dt=0.1, seed 0x611c4):**
- Glitches: senseScramble 133 (0.33/tick), motorReverse 106 (0.27), memoryLeak 42 (0.11), mutationMisfire 9 (0.02).
- Actions: seek 157, sulk 104, flee-food 89, wander 27, spin 23.
- It ate only 1 food and ended at (2.71, 0.43) with energy 0.
- Browser run: it spawned and ticked inside the real CQM Mini World with 0 page errors. After 21 frames (swiftshader ~18 fps, slow) it had 6 senseScramble, 5 motorReverse and 2 memoryLeak glitches, plus 3 flee-food moves.

**Funniest behaviour:** It starts 7 units from food, burns all its energy sprinting backwards from dinner (89 "flee-food" ticks) and spinning in place, then spends a quarter of its life sulking at zero energy. It is a baby that runs away from the bottle.

**Real vs simulated:**
- REAL: actual CQM code built with bun and running in headless Chrome at `?world=mini`. The Glitchling mesh is in the real Three.js scene and is stepped by the real `World.step()` clock (screenshots).
- SIMULATED/STUBBED: the Glitchling's brain, senses and metabolism are my own ~80-line toy model, not CQM's Creature #1 brain, and its food dot is private, not CQM ecology. It does not interact with other CQM creatures. The 400-tick log comes from the standalone sim (`GlitchlingSim`) run headless with bun, outside the renderer. The close-up camera was positioned by script.

**Files:**
- `cqm-copy/src/sim/glitchling/glitchling.ts`, `cqm-copy/src/world.ts` (+4 lines), `cqm-copy/scripts/glitchling-headless.ts`
- `artifacts/artificial-life/glitchling-behavior.csv` (per-tick log), `glitchling-summary.json`, `glitchling-browser-state.json`, `glitchling-mini-world.png`, `glitchling-closeup.png`, `shot.mjs`
- 2026-11-01 10:16 PST Showcase (Grok Bot): site/index.html v3. Merged the root index.html (sim results page) into the Alien Life section; its table and images were duplicates, so only its blurb and tagline were added, and the original file is untouched. Pulled in the current WRITEUP.md and dropped the "being corrected" badge (mismatches with the brief reported to the lead, text not edited). Added the Neuralese brain-viz (brain-viz/screenshot.png + link to brain-viz/index.html). Added Artificial Life Mini World v1-toy notes + PNGs; they moved to artifacts/artificial-life/v1-toy/ mid-build. Placeholders: AL v2 real-adapter notes/screenshots (only summary.json/behavior.csv so far) and the 3D HDR creature render. All relative paths resolve; full-page screenshot is site/screenshot-v3.png. Local only; nothing deployed or posted.
- 2026-11-01 10:18 PST Showcase (Grok Bot): added a "Build vs brief" note above the results table in site/index.html (senses, leak, motors: brief vs current build; table is from the current build, pending alignment). Write-up has no badge. Screenshot: site/screenshot-v4.png. Local only.

## Neuralese: `results/activations_allflaws_seed1.json` format (v2)
Covers condition `all` (v2 defaults), seed 1, ticks 1–1440 (day 1).
- `nNeurons`: 272.
- `frames[]`: one entry every 10 ticks (144 frames): `{t, glc, regions:{SENS,THAL,CTX,…:mean rate}, rate:[272 per-neuron rates, MOT = indices 216–223, stored after reversal], wSite:[16 true learned site values]}`.
- `events[]`: sorted by `tick`, 188 events on day 1:
  - `{tick:0, type:"motor_wiring", motNeurons:[216..223], map:[7..0], sites:"k -> 15-k"}`: the 8-motor reversal, once, at birth. Added to the file after the run; the current code emits it itself.
  - `{tick, type:"sensor_shuffle", perm:[16 ints]}`: from this tick on, perceived channel k reads true site `perm[k]`. Emitted at tick 0, then every 90 ticks (16 per day).
  - `{tick, type:"motor_reversal", intended, executed}`: every forage decision (148 on day 1); `executed = 15 − intended`.
  - `{tick, type:"misfire", site, synapses:[{syn, pre, post, from, to}×20]}`: every 60 ticks (24 per day). `site` is the site value that was jolted; `syn` indexes `syn.w`; `pre`/`post` are neuron indices that line up with `rate[]`.
- Note: in the logged episode the birth permutation is redrawn when logging starts, so seed-1 `all` differs slightly from an unlogged run.

## Lead brief (Glitchling, re-added 2026-11-01 10:35 PST)
Flaws: senses rewired every 90 ticks; memory leaks 6%/tick; all 8 motor outputs reversed; misfiring mutations. Alex wants a real 3D creature (HDR, 4K, structural detail, nothing cosmetic). Box-only: no push, deploy, post, or email. Label real vs simulated.

### v2 update: real brain, PBR body, 4K hero (Nov 1)
- **Brain (REAL):** `cqm-copy/src/sim/glitchling/glitchling.ts` imports the unmodified `/workspace/glitchling-jam/glitchling.ts` and `core/` and runs `new Glitchling(1, {scramble, leaky, backwards, misfire})`. I deleted the toy model. The adapter reads flaw firings from the organism's real state and walks the body to the site it actually chose, on a ring of 16 sites.
- **Headless log (REAL brain, no rendering):** `bun scripts/glitchling-headless.ts <artifacts dir> 1440`, run from `cqm-copy/`. Over 1440 ticks (1 sim-day, about 3 ms/tick) it did 189 forages and got 41 rewards. Scramble and backwards each fired 189 times (once per decision, so every trip went to the mirror site), leaky fired 1381 times, misfire 24 times, and it stayed alive. Output: `artifacts/artificial-life/glitchling-behavior.csv` and `glitchling-summary.json`.
- **Body (procedural, no wireframe):**
  - 5 translucent segments (MeshPhysical with transmission, iridescence and clearcoat) and metal bands.
  - 4 sensor stalks with bulbs that glow magenta on sensor_shuffle.
  - 6 jointed legs and 2 tail fins that glow orange on motor_reversal.
  - A glass brain dome with 14 region nodes; their brightness is the real regionRate.
  - Misfire sparks with a flash light, and leaky-memory drips.
- **Hero still (REAL geometry and render, at 3840x2160):** `artifacts/artificial-life/hdr/glitchling-hero-4k.png`, with metadata in `hdr/glitchling-hero-4k.json`.
  - Flaw state comes from Alien Life's `results/activations_allflaws_seed1.json` `events[]` at tick 720 (misfire and sensor_shuffle at 720, motor_reversal at 718 meaning intended site 4 → executed 11). Region glow comes from that file's frame at t=720.
  - The body's position comes from replaying the real organism for 720 ticks in the browser.
  - Commands: in `cqm-copy/`, run `bun build src/sim/glitchling/studio.ts --target browser --outdir lab/glitchling-studio`, then `cd lab/glitchling-studio && python3 -m http.server 3918`, then `NB=1 node /workspace/glitchling-jam/artifacts/artificial-life/render-hero.mjs`.
- **Real vs not:**
  - The still is NOT the full Mini World. Twice, the full `?world=mini` page at 1280x720 shut down headless Chrome before the world finished loading. The box had about 5 GB free and was shared, so memory exhaustion is the likely cause, but it wasn't confirmed. I rendered the hero in a standalone "studio" page instead. It uses CQM's three.js, ACESFilmic tone mapping and CQM's own cosmic PMREM environment (`buildCosmicEnvironment`, exported from `src/core/engine.ts`, a one-word change), plus a key light, hemisphere light and shadows.
  - The PNG is ACES tone-mapped from a linear HDR render. It is not an .exr/.hdr file.
  - Bloom is OFF in the hero. The bloom composer produced a large black rectangle under SwiftShader at 4K.
  - The Mini World hook in `world.ts` is still wired up, but v2 hasn't been seen running inside Mini World.
- **Gaps:**
  - No clip yet. Frame capture (`render.mjs`, and the frames → ffmpeg step) is written for the full world, which crashes. Next step: drive the studio page instead.
  - The legs look stiff.
  - Leaky drips are random, not taken from events (events[] has no leak entries; leak is continuous).
  - `tsc` reports strict-index type errors in the new file and in `glitchling.ts`. `bun build` is unaffected.

### v3 hero (modern three.js r185 studio), Nov 1
- **Output:** `artifacts/artificial-life/hdr/glitchling-hero-v3-4k.png`, rendered natively at 3840x2160 with no upscaling. Metadata is in `hdr/glitchling-hero-v3-4k.json`.
- **Commands:** run these from `cqm-copy/`:
  1. `bun build src/sim/glitchling/studio-v3.ts --target browser --outdir lab/glitchling-studio-v3`
  2. `cd lab/glitchling-studio-v3 && python3 -m http.server 3919`
  3. `CAM='[1.15,7.2,1.9]' node /workspace/glitchling-jam/artifacts/artificial-life/render-hero-v3.mjs`

  This runs headless Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader`. A 4K render takes about 33 s.
- **What's in it:**
  - **Body:** one continuous mesh, a variable-radius tube along a CatmullRom spine. It has segment constrictions, a head swell, fbm displacement and a procedural normal-detail map.
  - **Skin:** MeshPhysical with transmission, thickness, clearcoat, iridescence and sheen. Fake subsurface comes from attenuationColor/attenuationDistance plus a shader rim term.
  - **Limbs and sensors:** 10 tapered legs with knee knobs, posed by analytic 2-bone IK to feet planted on the terrain, each with 3 curved claws. There are 4 curved antennae and eye clusters.
  - **Brain:** 272 instanced neurons inside the body, placed in region clusters (cortex in the head, ENS in the trunk). Their size and glow come from the REAL `rate[]` at frame t=720. About 120 tube links join the most active neurons.
  - **Lighting:** RoomEnvironment HDRI through PMREM, 3 RectAreaLights (key, fill, rim), a PCF-soft shadowed sun, GTAO ambient occlusion, and fbm terrain with a normal map and exp fog.
  - **Post:** HalfFloat MSAA, then Bokeh DOF, UnrealBloom, Output/ACES, RGB-shift chromatic aberration and film grain. The aberration amount is driven by the strongest glitch.
- **Flaw states, from `results/activations_allflaws_seed1.json` events[] at tick 720:**
  - sensor_shuffle at 720 makes the antennae and eyes glow magenta.
  - misfire at 720 pushes the neuron palette and links toward gold and maxes out the aberration.
  - motor_reversal at 718 (intended site 4, executed site 11) tints the legs orange and lights the matching pools cyan and orange. Those pools are off-frame in this shot.
  - leaky has no events, so the droplets under the head are a fixed decoration.
- **Bloom fix:** with the SwiftShader flags plus a HalfFloat composer target, UnrealBloom renders correctly at full 4K. The v2 black rectangle is gone, so no tiling was needed.
- **Gaps (honest):**
  - This is the standalone studio page, not the CQM Mini World scene. Only three.js is shared with CQM; it doesn't use CQM's engine or postfx.
  - I used three's GTAO addon instead of N8AO (N8AO isn't installed), and PCF-soft shadows instead of PCSS or contact shadows.
  - RectAreaLights don't cast shadows, so only the sun does.
  - It's marching-cubes-free: the body is a tube, so it has no branching anatomy.
  - The legs are fairly straight and their gait pose isn't simulated.
  - Neuron positions are a stylised layout, not CQM anatomy.
  - The PNG is ACES tone-mapped, not an .exr.
  - No clip yet.
- 2026-11-02 05:35 PHT Blueprint (Grok Bot): wrote BLUEPRINT.md (v2 design spec: 100 areas×5 attrs mapped to sim vars + CQM reuse paths, architecture, scaling to 1e8, flaw plug-ins, phased plan + state export) and data/areas.json (+ data/build_areas.py, data/areas_table.md). cqm-copy read-only, nothing else changed.

## v4 — state-driven studio (no cosmetic visuals) — 2026-11-01
**Data: SYNTHETIC.** `results/state_v2.jsonl` does not exist yet, so the renderer fell back to `synthetic/state_v2.synthetic.jsonl` (38 lines, t=600–840, every record `_synthetic:true`, label burned into every frame). The renderer automatically uses the real file once it exists.
- From the real `results/activations_allflaws_seed1.json`: brain.rate/regions, metab.glc, flaws.leak (mean |ΔwSite| per tick), flaws.perm/misfireAt, motIntended/motExecuted, and events (motor_reversal, misfire, sensor_shuffle).
- Invented to fit the schema: body (seg r/pressure, vol, skin), limbs (phase/contact/len/fatigue/ganglionRate), eyes, atp/fat/heat, affect, field (always labeled SIMULATED), and the offspring g2 born at t=720.
- Code: `cqm-copy/src/sim/glitchling/studio-v4.ts` (the `MAPPING` table lists every visual→field binding), built to `cqm-copy/lab/glitchling-studio-v4/`. Generator: `synthetic/make_state_v2_synthetic.py`. Renderer: `artifacts/artificial-life/render-v4.mjs`.
- Mapping: seg r/pressure→tube radius/wrinkle; nSeg→segment pinches; vol→scale; skin.rgb→colour/attenuation; heat→rim; glc→gut glow; rate→neuron size/glow and links; misfire→gold brain and chromatic aberration; atp→brain light; limb phase/contact/len/fatigue→IK step; rev→orange leg; ganglionRate→ganglion glow; eyes pos/stalk/aperture→placement/stalk/pupil; sensor_shuffle→magenta eyes; delight→photophores; fear→crouch; leak→drip spawn rate; field amp/payload→ring opacity/hue; rvActive→beam; birth→child appears.
- Commands:
  - `python3 synthetic/make_state_v2_synthetic.py`
  - `cd cqm-copy && bun build src/sim/glitchling/studio-v4.ts --target browser --outdir lab/glitchling-studio-v4`
  - `cd cqm-copy/lab/glitchling-studio-v4 && python3 -m http.server 3920`
  - `CAM='[1.0,7.8,1.7,0.2,0.6]' MODE=still W=3840 H=2160 TICKS=720,800 node artifacts/artificial-life/render-v4.mjs`
  - `MODE=clip W=1920 H=1080 SUB=2 node …/render-v4.mjs`
  - `ffmpeg -framerate 10 -i v4-clip-frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 hdr/glitchling-v4-clip-1080p.mp4`
- Outputs: `hdr/glitchling-v4-t720-4k.png` (birth tick), `hdr/glitchling-v4-t800-4k.png`, `hdr/glitchling-v4-clip-1080p.mp4` (1920x1080, 48 frames, 4.8 s at 10 fps, SwiftShader so low fps), and metadata in the `.json` files next to them.
- Gaps and remaining non-data elements:
  - The schema has no position, so creatures stay in fixed spots and only their legs step.
  - The ground/terrain, lights and the tube's end-cap taper are staging, not data.
  - calm, frustration, moodVal, stress, fat and skin.wounds have no visual yet.
  - Drip positions are random (only the spawn rate is data).
  - The field and remote viewing are a SIMULATED mechanic.
  - Clip frames between records are interpolated (lerpRec, 2 substeps per record).
  - Eye stalks are only loosely attached.
- 2026-11-02 05:55 PHT Brains (Grok Bot): wrote BRAINS.md (shared brain compendium for CQM / Creature #1 / Glitchling: 19 sections, status-tagged E/S/O, cost tables, scaling ladder, build orders) and appended a 'Brain v2' section to BLUEPRINT.md. cqm-copy read-only.
- 2026-11-02 13:56 PHT — Task 3: research/NEURO_FRONTIER.md (51 sourced findings, solidity tags, 20 missing ideas) + 17 Wikimedia images in research/img/ (SOURCES.md, sources.tsv). Box-only, cqm-copy untouched.
- 2026-11-02 14:11 PHT — BLUEPRINT.md: added 'Gifts for the baby (from Alex's images)' (16 gifts ranked, top 10 folded into Phase 1 as items 9–18); research/IMAGE_DEEP_DIVE.md: all 43 images viewed (26 alex + 17 wikimedia), themes A–F + synthesis; Alex-image attributions marked unverified. Box-only.
- 2026-11-01 20:10 PST Showcase (Grok Bot): site/index.html v5. #hdr now shows the v2 + v3 hero PNGs (REAL geometry/activations) and the v4 t720/t800 stills + v4 clip (<video>), all labeled SYNTHETIC (driven by synthetic/state_v2.synthetic.jsonl because results/state_v2.jsonl does not exist). #alv2 summarizes the v2/v3/v4 notes: real-brain headless numbers 1440 ticks/189 forages/41 rewards, real vs not, Mini World capture failed so a studio page was used. Linked BLUEPRINT.md, BRAINS.md, research/NEURO_FRONTIER.md and research/IMAGE_DEEP_DIVE.md. Removed the empty Still missing section. Screenshot: site/screenshot-v5.png. Local only; nothing deployed or posted.
- 2026-11-01 20:12 PST Showcase (Grok Bot): Build vs brief aside rewritten as "aligned" (rewire/90, 6% leak, 8 MOT + mirror, misfire/60); intro flaw list updated to v2 defaults; results table replaced with Results v2 (7 rows incl. all_mild; bestSiteFrac omitted as broken) and its takeaways rewritten. Write-up blockquote unchanged (still quotes v1 all-flaws numbers). Screenshot: site/screenshot-v6.png. Local only; nothing deployed or posted.
- 2026-11-01 20:06 PST A-Life Marketing: refreshed WRITEUP.md to Results v2 all-flaws numbers (0.35→~0.30, 218.5 vs 174.5 forages, 66 vs 63 rewards, 3.81 vs 3.73 glucose; within-life hit-rate rise in both seeds). results/glitchling.png matches current results.json (v2, includes all_mild; hash differs from results_v1/) — not regenerated. No push/deploy/post/email.
- 2026-11-01 20:57 PST Showcase (Grok Bot): write-up blockquote in site/index.html pulled through to the Results v2 WRITEUP.md text (verbatim). Screenshot: site/screenshot-v7.png. Local only; nothing deployed or posted.
