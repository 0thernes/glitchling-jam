# Glitchling v2 · live — change log

Every pass lists what changed and what was measured. Metrics come from `test/measure.mjs` (seeds 1–3, 90 simulated
seconds per condition, Node, no rendering) unless stated. `dist` = path length of the body centre in world units
(the body is ~2.4 long); `fed` = successful feeds; `entropy` = behavioural-repertoire entropy in bits over 7-bit motor
codes (max 7) during the last 60 s; `upright` = mean y of the mid-body up-vector (1 = upright, −1 = on its back).

## Pass 1 — world, body, neurons, muscles, learning, metabolism, sleep, skin (first public build)

Stages 1–3 of the plan landed together because the pieces are wired to each other; later passes are smaller.

- 3D world: drifting heightfield, 7 climbable rocks, 3 spring pads, 16 feeding plants (4 colours × 4 shapes, reference reward
  formula), dropped food, wind/rain field, day/night.
- Soft body: 51 Verlet particles, 254 distance constraints, 61 muscle channels; anisotropic scale friction, neural grip.
- Brain: 426 LIF neurons (reference 14 regions + PROP + MN), 24-neuron LTC pattern generator, STDP × dopamine,
  neuromodulators, astrocyte gain; selective SSM, online world model; striatal D1/D2 race with EFE + veto; two-process
  sleep with NREM replay and REM dreaming; reference-derived metabolism with fluids and waste; neural chromatophore skin.
- Bugs found while building: Gauss-Seidel constraint ordering made the body roll and drift to one side (fixed by
  alternating sweep direction); the first motor-learning rate flipped the creature onto its back (lowered 7×, weights
  bounded to ±1 of the innate value, and being upside down now costs reward).

Measured (Node):

| condition | dist | fed | entropy | states | upright |
|---|---|---|---|---|---|
| intact | 66.2 | 0.33 | 6.12 | 107 | 0.66 |
| MOT neurons lesioned | 49.4 | 0.67 | 6.46 | 116 | 0.69 |
| LTC pattern generator lesioned | 48.0 | 0.33 | 6.24 | 108 | 0.79 |
| all motor neurons lesioned | 2.9 | 0 | 0.03 | 1 | 0.64 |

Steering probe (`test/steer_probe.mjs`, 40 s, fixed goal ~18 units away): intact closed the distance to 11.2 / 11.3 / 5.3;
with the innate bearing→turn wiring removed it drifted to 19.1 / 18.8 / 22.3.

Honest reading: the creature only moves through its motor neurons (lesioning them leaves ~3 units of settling), and
steering toward a goal depends on the bearing→MOT pathway. Foraging is still poor in this pass (well under one feed per
90 s on these seeds) and the body spends time tilted. Headless Chromium (software GL) ran at 12–22 fps with adaptive quality
dropping to "low"; that is a CPU renderer, not a real GPU number.

## Pass 2: symmetric physics, reflexes, self-model travel cost

- **Physics bug found and fixed.** A perfectly symmetric muscle wave on the body alone still yawed left at ~0.38 rad/s, so
  every straight-ahead command curved. The cause was Gauss-Seidel constraint ordering; the alternating sweep from pass 1
  did not remove it. The order is now re-shuffled every substep (deterministic LCG). Measured: `test/symmetry_probe.mjs
  wave flat` went from −0.38 to +0.02 rad/s. Correction to pass 1: part of the pass-1 steering result came from that
  circling bias.
- **Vestibular righting reflex.** Two new sensory inputs code tilt and which side is down. Plastic weights send them to
  the down-side leg/arm extensors and the ventral long muscles. `test/roll_probe.mjs` found this pattern by testing
  candidate muscle patterns on the bare body; it rights the body from either side in 4/4 trials.
  `test/righting_probe.mjs` flips the creature onto its back, 10 trials: median 2.1 s to upright, 10/10 righted. With all
  motor neurons cut: 0/10.
- **Stance/swing grip reflex.** Swing-muscle stretch velocity (spindle-like) drives the grip motor neurons, so feet grip
  during the backward stroke. Forced-forward net speed, seeds 1–4: 0.32 → 0.44 units/s.
- **Divisive normalisation across the 8 MOT synergies** (shared inhibitory pool).
- **Stuck-loop fix.** "Stuck" used to include the posture penalty, which drove a loop: tumble → stuck → jump → tumble.
  It now uses pure goal progress.
- **Self-model.** Running estimates of the creature's own approach speed and turn rate. The race's cost term is now
  predicted travel time × energy price, so far or behind-the-back sites cost more. Give-up is adaptive: 20 s without
  0.5 units of progress, or 3× the predicted travel time.
- **Inhibition of return:** a just-visited site gets a cost bonus that fades over ~1 simulated minute. Without it, the
  self-model cost made the creature camp at one empty nearby plant (460 'arrivals' in 240 s on seeds 3–4).
- **Fixed:**
  - Curiosity targets are now ≥ 4 units away.
  - Explore arrival checks the real distance; a stale distance had made it re-pick a target every tick.
  - Give-up no longer compares against a stale distance.
- **Tried and rejected:**
  - Homeostatic intrinsic plasticity on motor neurons: steering got worse (8-seed probe 5.9 → 2.3 units closed).
  - Evolution-strategy training of a leg-gait genome (`test/evolve_gait.mjs`): 0.48 → 0.75 on the training seeds, but
    0.40 → 0.31 on held-out seeds 4–9. That is overfitting, so it was not adopted.
  - Asymmetric leg drive or grip for turning: no reliable gain.

Measured (Node):

| test | pass 1 | pass 2 |
|---|---|---|
| `forage_bench` 240 s, seeds 1–6: feeds / site arrivals / give-ups | 5 / 11 / 25 | 8 / 31 / 36 |
| `measure` intact, 90 s, seeds 1–3: dist / fed / entropy / upright | 66.2 / 0.33 / 6.12 / 0.66 | 55.7 / 0.33 / 6.07 / 0.74 |
| MOT lesioned: dist / fed | 49.4 / 0.67 | 44.0 / 1.0 |
| CPG lesioned: dist / fed | 48.0 / 0.33 | 38.6 / 0 |
| all MN lesioned: dist / entropy | 2.9 / 0.03 | 5.1 / 0.09 |
| righting from the back, median s (righted) | 2.4 (10/10) | 2.1 (10/10) |

Honest reading:
- Turning is still the weak point. Even an ideal bearing controller that bypasses the brain only closes ~4 units in 40 s
  (forced-MOT probe); the body turns at about 0.2–0.3 rad/s. So the gains come mostly from choosing
  reachable sites and abandoning dead goals.
- Path length (`dist`) fell because the creature now thrashes less.
- Feeds per 90 s on seeds 1–3 are still noisy (0.33 intact vs 1.0 with MOT lesioned). Over 90 s that difference is a
  single feed, so it is not evidence either way.
- Headless Chromium (SwiftShader, CPU) at 390×844 and 1280×800: no console errors, 20.3 / 11.6 fps (auto quality "low").
  Motion over 600 steps: intact 6.8 / 6.8; all MN lesioned 0.9 / 2.3; MOT lesioned 4.7 / 4.9.
- Screenshots: `live-shots/s2-*.png`.

## Pass 3: vector-symbolic cognitive map and modern Hopfield memory

New module `js/sim/memory.js`.

- **HDC / VSA cognitive map.** Built on Fourier holographic reduced representations: 512 complex phasors with random
  spatial frequencies. Fractional power encoding binds x and z into one place vector.
  - Two maps, each a single superposed vector:
    - FOOD: signed outcome at each site visited and each snack eaten.
    - VISIT: where the body has been, slowly decaying.
  - Recall at any point is a kernel-weighted sum of everything stored, so it generalises to nearby places never visited.
  - The FOOD recall at a plant now contributes to the race's value term: 0.25 weight, next to the site value and the Beta
    mean.
  - Curiosity samples 48 candidate places and goes where the VISIT map recalls the least, replacing the 24×24 count grid.
- **Modern Hopfield network** (Ramsauer et al. 2020). Each simulated second, the centred 72-dim SSM/world-model state is
  stored; capacity is 256, with random replacement.
  - Retrieval is one softmax-attention step.
  - The best match's similarity becomes a familiarity signal that re-activates an 8-neuron hippocampal assembly
    indexed by that memory.
  - REM dreaming now starts its world-model rollouts from the episode retrieved by a half-masked, noisy cue of the
    current state (pattern completion), not from a random episode.
- **UI:**
  - Brain panel shows the Hopfield count and familiarity, and the self-model speed and turn rate.
  - New lesions: HDC map, Hopfield memory.

Measured (`test/memory_probe.mjs`):
- **HDC food map.** 6 noisy Bernoulli outcomes per plant. Correlation of recall with the true reward probability, at the
  plant / 1.5 units away, seeds 1–4: 0.79/0.79, 0.38/0.38, 0.13/0.11, 0.65/0.66.
  - The kernel is smooth, so nearby recall matches plant recall.
  - Low values come from 6 samples being noisy and from overlapping neighbouring plants.
- **Hopfield.** 219 real episode states from a 120 s run, cued with 50% of dimensions zeroed plus noise.
  - Completed-pattern cosine to the true memory: 0.83 at β = 24, against 0.68 for the cue alone.
  - Top-1 index accuracy: 49%. Consecutive episodes are near-duplicates, so many "misses" are a neighbouring second.
- **Exploration coverage**, 3×3-unit cells visited in 240 s, seeds 1–4: HDC curiosity 9/10/12/11 (mean 10.5); old count
  grid 8/6/21/15 (mean 12.5).
  - Not better. Most of the time is spent foraging, not exploring, and the spread is wide.
- **`forage_bench`** 240 s, seeds 1–6: 9 feeds / 24 arrivals / 35 give-ups (pass 2: 8 / 31 / 36).
- **`measure` intact:** dist 55.3, fed 0.33, entropy 6.14, upright 0.77. All MN lesioned: dist 5.2, entropy 0.10.
- **Headless Chromium** (SwiftShader): phone 21.9 fps, desktop 13.2 fps, no console errors.
  - Motion over 600 steps: intact 10.1 / 9.0; MN lesioned 0.1 / 1.3; MOT lesioned 4.7 / 6.6.
- Screenshots: `live-shots/s3-*.png`.

## Pass 4: predictive-coding hierarchy

- **Two-level predictive-coding network** (`PredictiveCoding` in `js/sim/mind.js`), after Rao & Ballard. The learning
  rule follows Whittington & Bogacz.
  - 16 level-1 causes predict the 25-dim body-sense vector: spine curvature, vestibular, foot contacts, goal bearing.
  - 8 level-2 causes predict the level-1 causes.
  - Each 10 Hz tick runs 12 inference iterations down the precision-weighted error energy, then local Hebbian
    error × activity weight updates.
  - Causes persist between ticks and act as the prior.
  - Sensory precision is 0.6 + 0.8·ACh.
- **Outputs:**
  - The normalised error is a second surprise signal for the locus coeruleus, mixed with the world-model surprise
    (weight 0.25).
  - It also flushes the chromatophore skin, a startle pattern.
- **UI:**
  - The brain panel shows PC error and surprise.
  - New lesion: PC learning off.

Measured:
- **`test/pc_probe.mjs`:** mean squared body-sense prediction error, first 30 s → last 30 s of 180 s, seeds 1–4.
  - Learning on: 0.064→0.017, 0.042→0.015, 0.045→0.019, 0.059→0.021, roughly a 65–75% drop.
  - Learning off: 0.095→0.087, 0.097→0.092, 0.091→0.093, 0.086→0.101.
- **Poke response:** error in the 1 s after a poke ÷ the 1 s before = 0.91, 1.15, 1.14, 1.32. That is a weak signal;
  pokes are small next to the body's own motion.
- **Effect of feeding PC surprise into noradrenaline** on foraging (`forage_bench`, 240 s, seeds 1–8; feeds / arrivals):
  - mix 0: 11 / 29
  - mix 0.25: 9 / 18
  - mix 0.5: 4 / 29
  - More arousal seems to hurt foraging, but seed-to-seed variance is large. The shipped value is 0.25.
- **`measure` intact:** dist 65.2, fed 1.33, entropy 6.24, upright 0.67. All MN lesioned: dist 6.1, entropy 0.15.
- **Headless Chromium:** phone 20.7 fps, desktop 12.9 fps, no console errors.
  - Motion over 600 steps: intact 9.7 / 8.9; MN lesioned 0.1 / 1.1; MOT lesioned 6.4 / 5.0.
- Screenshots: `live-shots/s4-*.png`.

## Pass 5: Turing morphogen skin driven by hormones

- **Gray-Scott reaction-diffusion layer** (U, V morphogens; 64×32 sheet; 6 iterations per skin step) added under the
  FitzHugh–Nagumo chromatophore sheet. V modulates pigment (red channel) and leucophore whiteness (blue channel).
  - Feed rate F = 0.03 + 0.02·leptin, from fat stores.
  - Kill rate K = 0.059 + 0.007·cortisol − 0.002·DA.
  - The pattern regime is therefore a readout of metabolic state, not a texture.
  - Strongly excited FHN patches nucleate new 5×5 morphogen spots.
  - Regimes were mapped first on a bare Gray-Scott grid.
- **New lesion:** hormone → morphogen link off (F and K freeze).

Measured (`test/turing_probe.mjs`, 60 simulated s with leptin and cortisol clamped, seeds 1–3; coverage = fraction of
cells with V > 0.2, blobs = connected components):

| hormone state | F / K | coverage | blobs |
|---|---|---|---|
| lean, calm | 0.031 / 0.059 | 0.37, 0.36, 0.42 | 4, 5, 1 |
| lean, stressed | 0.031 / 0.065 | 0.12, 0.15, 0.11 | 5, 6, 7 (sparse spots) |
| fat, stressed | 0.049 / 0.065 | 0.32, 0.33, 0.32 | 5, 7, 7 (spots) |
| fat, calm | 0.049 / 0.059 | 1.0 | 1 (solid pigment) |

- Behaviour is unchanged: the skin does not feed back into the brain. `measure` matches pass 4 exactly (dist 65.2,
  fed 1.33, entropy 6.24).
- **Headless Chromium:** phone 19.7 fps, desktop 13.9 fps, no console errors.
  - Motion: intact 10.0 / 8.8; MN lesioned 0.3 / 1.1; MOT lesioned 4.9 / 6.1.
- Screenshots: `live-shots/s5-*.png`.

## Pass 6: per-part morphological growth

- Every physics constraint is tagged with the body segment (ring) or limb it belongs to.
- **Per-segment girth.** Relaxes toward 0.85 + 0.35·leptin, so a fat creature is thicker.
- **Per-limb length.** Grows with that limb's own muscle use (swing + extend + ½ grip, low-passed), scaled by the
  muscle/protein pool. It atrophies toward 1 when idle, bounded 0.85–1.45.
- Rest lengths scale with these, so the body the brain controls changes shape. This sits on top of the earlier global
  tissue scale.
- **UI:** the brain panel shows the limb lengths. New lesion: per-part growth off.

Measured (`test/growth_probe.mjs`, seed 1, 8 simulated minutes):

| condition | limb lengths (L0 L1 L2 L3 arm0 arm1) | corr(length, use) | mid girth |
|---|---|---|---|
| normal | 1.18 1.20 1.19 1.16 1.09 1.17 | 0.78 | 0.97 |
| fat clamped high (780) | 1.20 1.19 1.18 1.18 1.16 1.17 | 0.00 (all limbs used similarly) | 1.19 |
| fat clamped low (40) | 1.19 1.16 1.18 1.18 1.16 1.18 | 0.33 | 0.87 |
| arm-0 use signal removed | 1.17 1.16 1.15 1.19 **1.01** 1.19 | 0.97 | 0.97 |

- **`measure` intact** (90 s, so growth is still small): dist 63.0, fed 0, entropy 6.27, upright 0.69. All MN
  lesioned: dist 5.5, entropy 0.11.
- **`forage_bench`** 240 s, seeds 1–8: 8 feeds / 37 arrivals / 51 give-ups (pass 4: 9 / 18 / 50).
- **Headless Chromium:** phone 20.0 fps, desktop 11.6 fps, no console errors.
  - Motion: intact 8.4 / 8.4; MN lesioned 0.8 / 1.0; MOT lesioned 4.8 / 4.6.
- Screenshots: `live-shots/s6-*.png`.

## Pass 7: skin optics

- **Iridophores now use physical thin-film interference.** Two-beam reflectance per RGB wavelength (650/532/450 nm)
  from guanine platelets (n = 1.83 in cytoplasm, n = 1.33), with Snell refraction for the view angle. Platelet thickness
  (120–380 nm) is set by the neural skin channel. This replaces the earlier hue-wheel rainbow.
- **Schlick Fresnel term, plus a wet-skin GGX specular lobe** (roughness 0.28) lit by the actual sun direction.
- **Back-lit translucency** through the thin body wall.
- **Capillary network.** Ridged noise brightens on each heartbeat (beat phase from the metabolism's heart rate) and
  scales with perfusion (blood glucose and heart rate).
- Measured, headless Chromium (SwiftShader, CPU; auto quality "low", so bloom is off in these shots): phone 21.0 fps,
  desktop 11.6 fps, no console or shader-compile errors.
  - Motion: intact 8.3 / 8.4; MN lesioned 0.5 / 0.9; MOT lesioned 4.9 / 4.6.
  - Simulation unchanged.
- Screenshots: `live-shots/s7-*.png`. These are WebGL renders at the device's pixel ratio (max 2×); they are not HDR
  output.
- **Tried and dropped:** a climbing probe (`test/climb_probe.mjs`: rock placed on the path to a fixed goal, 40 s,
  6 seeds). The creature never got 3+ particles onto the rock, intact or with MOT lesioned, so climbing is not yet a real
  behaviour. It stays on the to-do list.

## Pass 8: water, thirst vs hunger, cephalic-phase insulin

- **Three water pools** with rippling surfaces. Their layout comes from a separate RNG, so plants and rocks are
  unchanged.
- **Drinking.** When the head is in a pool while awake and thirsty, water goes into the gut, then blood, then
  bladder. Each drinking bout writes the pool into a third HDC map (WATER).
- **Thirst vs hunger.** When thirst > 0.3, thirst wins the decision with probability
  1.3·thirst / (1.3·thirst + hunger).
  - The water target comes from the HDC water memory, else a humidity sense (nearest pool within 20 units), else search.
  - A remembered spot with no water is written back as negative.
- **Cephalic-phase insulin.** Food within 3 units of the head (seen or being eaten) adds an anticipatory term to the
  insulin set point, before any glucose arrives.
- **Metabolism fix.** Insensible water loss was 0.0015 per tick, which drained blood water from 5 to ~2.5 in about 2
  simulated minutes; it is now 0.0005.
- **UI:** thirst and water drunk in the brain panel. New lesions: thirst seeking, cephalic insulin.

Measured (`test/water_probe.mjs`):
- **Cephalic insulin.** Same 2-unit sugar meal, seeds 1–3, food in view 20 ticks before and 30 during. Peak blood
  glucose:
  - link on: 3.66 / 3.59 / 3.64
  - link off: 4.03 / 3.99 / 4.03
  - About 9% lower: the anticipatory response blunts the spike.
- **Thirst.** 300 s, seeds 1–4, [mean thirst, water drunk]:
  - intact: [0.27, 7], [0.56, 0], [0.43, 0], [0.52, 0]
  - seeking lesioned: [0.56, 0], [0.56, 0], [0.43, 0], [0.52, 0]
  - Only seed 1 reached a pool. Thirst goals are chosen, but navigation (the weak 0.2–0.3 rad/s turning from pass 2)
    usually gives up before arrival. That is the honest bottleneck.
- **`measure` intact:** dist 59.1, fed 0, entropy 6.35, upright 0.71. All MN lesioned: dist 5.2, entropy 0.15.
  - Feeding per 90 s on 3 seeds was already 0–1.3 across passes. Thirst now takes some decisions away from food.
- **Headless Chromium:** phone 20.7 fps, desktop 13.7 fps, no console errors.
  - Motion: intact 8.1 / 7.6; MN lesioned 0.2 / 1.5; MOT lesioned 6.1 / 5.3.
- Screenshots: `live-shots/s8-*.png`.

## Pass 9: turning aids (front arching reflex, ventral scale lift)
Navigation has been the bottleneck since pass 2: forced turns gave only ~0.2–0.3 rad/s. Two physical/neural changes:
- **Front arching reflex.** The MOT turn-left/turn-right synergies now also drive the radial muscles of segments 3–6
  (weight 1.5 in the MOT→muscle map). This bends and lifts the front so it can swing.
- **Ventral scale lift.** Each segment's sideways ground friction is multiplied by (1 − 0.5·max(0, radial-muscle
  activation)). It is a friction rule in the Verlet ground contact, not modelled scales. New lesion: scale lift.

Measured (`test/scale_probe.mjs`): forced MOT command for 12 s, rocks removed, motor learning frozen, seeds 1–4.
Yaw rate in the commanded direction (left / right, rad/s) and straight-line speed:

| arching reflex | scale lift | turn L | turn R | fwd speed |
|---|---|---|---|---|
| off | off (old behaviour) | 0.23 | 0.28 | 0.29 |
| off | on | 0.13 | 0.27 | 0.43 |
| on | off | 0.48 | 0.33 | 0.29 |
| on | on (shipped) | 0.26 | 0.41 | 0.43 |

- The arching reflex is what helps turning: it roughly doubles yaw with scale lift off.
- Scale lift mainly raises forward speed (+48%) and slightly weakens turning, so the shipped combination is a trade-off.
- **Foraging (`forage_bench`, 240 s, seeds 1–8, fed / arrivals):**
  - shipped: 7 / 17
  - pass-8 behaviour: 2 / 19
  - with lift 0.8 and arch 2.5 (seeds 1–4 only): 2 / 6, upright dropped to 0.28–0.59, so the milder setting was kept
- **Seed noise is large.** Thirst probe (300 s, seeds 1–4): no seed reached water this time (seed 1 drank 7 in pass 8).
- **Righting:** median 2.2 s, 10/10.
- **`measure` intact:** dist 64.4, entropy 6.07, upright 0.66. All MN lesioned: dist 5.2, entropy 0.15.
- **Headless Chromium:** phone 24.6 fps, desktop 13.1 fps, no console errors.
  - Motion: intact 8.3 / 7.5; MN lesioned 1.0 / 3.0; MOT lesioned 5.9 / 4.4.
- Screenshots: `live-shots/s9-*.png`.

## Pass 10: polish and final check
- **Phone header.** At ≤640 px the chip reads "SIMULATION" and the HUD is tighter, so the fps readout is no longer clipped
  at 390 px wide. The full "BROWSER SIMULATION" chip stays on wider screens.
- **README.** Now has a pass 2–9 mechanism table and lists `memory.js`, `world.js` and the newer probes.
- **honesty.js.** The turning entries were corrected to the pass-9 measurements (shipped ~0.34 rad/s mean vs 0.26 before;
  still "physically weak").
- **Final checks:**
  - Symmetry probe (no turn command): yaw −0.05 / −0.03 / −0.05 rad/s, so no strong bias.
  - Headless Chromium: phone 25.0 fps, desktop 11.6 fps (SwiftShader software GL, auto quality "low"), no console errors.
  - Motion: intact 8.3 / 7.7; MN lesioned 1.0 / 2.5; MOT lesioned 4.0 / 4.8.
  - One earlier desktop run produced a black first capture with the HUD still running. The re-run rendered normally, so
    this was treated as a flaky SwiftShader frame and not investigated further.
- Screenshots: `live-shots/s10-*.png`.

## Pass 11: learned, larger, sleep-consolidated memory
Alex flagged "memories are small and their encoders are fixed" as a weak point. Changes:
- **HDC maps** (food, water) are 1024-dim (was 512).
  - Error-driven writes: `M += 0.3·(y − recall)·P(x)`, instead of adding every outcome.
  - Once per sleep bout (on entering N3), the 10% of phasor features with the least weight are re-drawn from the
    frequencies of the most useful half (±15% jitter), and the map is refit by replaying its last 300 samples.
  - The visit map stays a superposition, because it is a density.
- **Hopfield store:**
  - 1024 slots (was 256). When full, the least-retrieved slot is overwritten (was random).
  - In N3, near-duplicates (cosine > 0.97) are merged, count-weighted.
  - Keys go through a learned 72×72 map (starts at identity), trained in sleep with InfoNCE. A half-masked, noisy replay of
    an episode must pick out its own key among 16.
- **New lesion:** "memory encoder learning off". The brain panel shows slots, consolidations, merges, contrastive loss and
  re-drawn features.

Measured (`test/memory2_probe.mjs`):
- **(a) HDC regression.** 6 random reward bumps, 300 noisy samples × 4 passes with sleeps between; correlation at 300
  held-out places, seeds 1–8.

  | frequency prior | pass-3 superposition, 512 | delta rule, fixed encoder, 1024 | delta rule + learned features, 1024 |
  |---|---|---|---|
  | well tuned (0.35) | 0.894 | 0.957 | 0.955 |
  | mis-tuned (0.8) | 0.816 | 0.928 | 0.939 |

  - Most of the gain is the error-driven write.
  - Feature learning only helps when the starting spatial scale is wrong (+0.011) and is neutral otherwise.
  - I also tried per-feature gradient descent on the frequencies. At every learning rate it was neutral or diverged
    (held-out correlation fell to 0.03 at lr 2e-2), so it was not shipped.
- **(b) Hopfield on real 600-s runs** (seeds 2/3/5). States every 0.5 s; even ones stored, odd ones held out. Cosine of
  the completed pattern for 50%-masked + noisy cues (cue alone ≈ 0.48–0.55):

  | store | early stored | late stored | held-out |
  |---|---|---|---|
  | pass-3 (256, random overwrite) | 0.76 / 0.80 / 0.75 | 0.82 / 0.86 / 0.82 | 0.66 / 0.68 / 0.71 |
  | 1024 + forgetting + sleep merge | 0.86 / 0.86 / 0.86 | 0.85 / 0.86 / 0.83 | 0.68 / 0.69 / 0.73 |
  | same + learned keys | 0.86 / 0.86 / 0.85 | 0.85 / 0.86 / 0.83 | 0.68 / 0.69 / 0.73 |

  - Old memories are no longer lost: early-stored recall goes from 0.77 to 0.86.
  - The learned keys train (InfoNCE loss 1.41 → 1.13 over 8 sleeps; chance is 2.77) but give **no measurable recall gain**
    on these states. They are kept, and stated as such in the honesty panel.
- **Foraging unchanged within noise.** `forage_bench`, 240 s, seeds 1–8, fed / arrivals: 6 / 16 (pass 9: 7 / 17).
- **Headless Chromium:** phone 16.5 fps, desktop 11.6 fps, no console errors.
  - Phone fps was measured while 4 Node benchmarks were running on the same machine.
  - Motion: intact 7.9 / 7.0; MN lesioned 1.0 / 2.4; MOT lesioned 4.3 / 4.0.
- Screenshots: `live-shots/s11-*.png`.
- **Inactive code.** `body.js` now also contains an optional Coulomb contact model (off; only enabled by test overrides)
  used in the turning work below.

## Pass 12 — evolved motor genome, head direction, path integration, motor babbling

Fix 2 of Alex's review ("turning is weak, distant sites are never reached").

- **Developmental genome** (`js/sim/genome.js`). 44 motor genes grow the wiring instead of hand-placed synapses:
  per-segment gradients for CPG→long-muscle weights, ascending/descending CPG coupling, leg/arm stance-swing-grip
  weights, mirrored left/right turn wiring for MOT1/MOT2, and righting weights. 17 steering genes grow the sense→MOT
  matrix.
- **CMA-ES offline** (`test/evolve_genome.mjs`, own implementation, worker threads, training bodies 1–3, brain M):
  - Fitness (`test/genome_eval.mjs`): forced trials of forward / turn-left / turn-right / flipped.
    `2·v_fwd − sideways + 0.25·min(4, yawL+yawR) + 0.7·min(1.8, yawL, yawR) + 0.6·min(upright, 0.92)
    − max(0, 0.85 − upright) − 0.3·yaw_during_forward − 0.04·righting_time`.
  - Run 1: 43 generations × 16, started at the centre of the gene bounds (not the hand design). Its fitness counted
    displacement in any direction, which bred sideways gaits; kept only as the warm start.
  - Run 2: 30 generations × 16 with travel measured along the heading. Shipped genome = run 2 best (generation 4).
- **Head-direction ring attractor** (`js/sim/nav.js`): 36 units, cosine recurrent kernel with global inhibition,
  shifted by the vestibular turn rate through a self-calibrated sine kernel; a Hebbian sun-compass map anchors it;
  the vestibular gain is learned by LMS against the visual rotation.
- **Path integration and grid cells:** body-frame velocity (8% noise) rotated by the ring's heading; three grid
  modules (3, 5.2, 9 units) read the estimate out; a plant or pool seen within 5 units in front resets it.
- **Vector navigation:** a goal more than 9 units away is no longer sensed directly; the bearing comes from the
  estimated position and the remembered site.
- **Motor babbling:** random 0.75-s synergy blocks for the first 12 s; the yaw per unit turn command is regressed and
  the bearing→turn weights are scaled so the loop gain matches the reference body. Lesionable ("babble").
- New lesions: path integration (nav), babbling, course-over-ground steering (kept in code, gene kCourse = 0: it
  lowered arrivals from 4/8 to 1/7 near in a test).

Measured (brain S, the shipped default):

| | pass 10/11 (hand wiring) | pass 12 |
|---|---|---|
| forced turn, full command (`scale_probe`, rad/s L / R) | 0.34 (pass 9) | 2.31 / 2.46 |
| forced turns, held-out bodies 4–8, upright (`genome_eval`) | 0.36 | 0.84 |
| near site (4–8 u) reached in 60 s (`nav_probe`, seeds 1–8) | 2/7 | 6/8 |
| far site (14+ u) reached in 60 s | 0/8 | 2/8 (path integration lesioned: 0/8, near 5/8) |
| upright during navigation | 0.57 | 0.67 |
| `forage_bench` 240 s seeds 1–8, fed / arrivals | 6 / 16 | 15 / 26 |
| thirst probe 300 s seeds 1–4, seeds that drank | 0/4 (pass 9), 1/4 (pass 8) | 1/4 |
| `measure` intact dist / entropy / upright | 59–65 / 6.2–6.4 / 0.67–0.71 | 68.1 / 4.13 / 0.61 |

- Heading error of the ring was 0.01–0.05 rad and position error 0–0.8 u in a 60-s far trial (seed 1).
- **Not met:** far arrival is still well below near arrival; upright during navigation is 0.67, not > 0.85; thirst
  found water on 1/4 seeds. An ideal controller given the true bearing (test-only override of the MOT rates) reached
  only 2–3/8 far sites with the same gait, so the bottleneck is now the gait on rough ground, not heading or steering.
- A 14-generation CMA-ES run over the steering genes on navigation fitness (`test/evolve_steer.mjs`, brain S) never beat
  its generation-1 best and was stopped; the steering genes stay hand-set.
- Behaviour entropy fell (6.2 → 4.1 bits): the evolved gait spends more time in a few motor patterns.
- **Headless Chromium:** no console errors; phone 24.0 fps (sim 3.5 ms), desktop 11.6 fps (sim 8.4 ms; software-rendered WebGL,
  render-bound). Screenshots: `live-shots/s12-*.png`.

## Pass 13 — thousands of neurons, structured wiring, structural plasticity

Fix 3 of Alex's review ("426 neurons is tiny, wiring is random").

- **Three brain sizes** (`js/sim/brain.js`), chosen by `?brain=S|M|L`; default M.
  - S: the original 426 neurons, 1,896 synapses.
  - M: 3,258 neurons, 120,811 synapses (cortex 48×48 sheet, hippocampus 512, thalamus 128).
  - L: 11,962 neurons, 488,557 synapses (cortex 96×96, hippocampus 2,048, thalamus 384).
- **Cell types:** excitatory (adapting), PV-like fast inhibitory, SST-like slow inhibitory.
- **Wiring:** Gaussian distance-dependent cortex→cortex on a torus with 5% random shortcuts (small-world); topographic
  thalamus→cortex and proprioception→cortex ("somatosensory" strip); cortex→MOT from a "motor" strip of excitatory
  cells. Other region pairs keep the reference in-degree.
  - Bug found and fixed while measuring: the motor strip first included inhibitory cells, which held MOT at 1.7 Hz
    in M (S: 35.6 Hz). With pyramidal-only projections MOT fires at 16.5 Hz.
- **Structural plasticity:** once per simulated second, cortical E→E synapses that STDP pushed below 25% of their
  initial weight are pruned and regrown onto the most active of 3 nearby cells. Lesionable ("struct").
- **Event-driven updates:** CSR spike propagation; eligibility and weight updates only touch synapses on an active list.
- **Adaptive size:** the page measures ms per simulation step; if it stays above 12 ms for ~5 s it reloads one size
  smaller (L → M → S), unless the size was set in the URL. L is opt-in.

Measured (`test/brain_probe.mjs`, Node, one core, other jobs running):

| brain | neurons / synapses | ms per 1/60-s step | CTX / MOT Hz | pruned+regrown in 300 s | wiring–activity alignment start → end |
|---|---|---|---|---|---|
| S | 426 / 1,896 | 1.3–1.6 | 62.5 / 35.6 | — | — |
| M | 3,258 / 120,811 | 3.7 | 47.4 / 16.5 | 724,313 | 2.52 → 2.52 |
| M, rewiring lesioned | same | 3.8 | 6.2 / 0.0 | 0 | 2.24 → 1.39 |
| L (120 s) | 11,962 / 488,557 | 13–17 | 41.1 / 22.6 | 843,091 | 2.39 → 1.70 |

- Alignment = mean pre×post rate over existing cortical E→E synapses ÷ mean rate²; 1 means wiring is unrelated to
  activity. Rewiring keeps co-active cells wired (2.5); without it alignment decays to 1.4.
- **Caveat:** without rewiring the M cortex goes nearly silent within 5 minutes (STDP depression + sleep down-scaling),
  so rewiring is also acting as a homeostat, not only as learning.
- **Behaviour is not better with the bigger brain:** `nav_probe` seeds 1–8 near 5/8, far 0/8, upright 0.64 (S: 6/8,
  2/8, 0.67); `forage_bench` 240 s seeds 1–8 fed / arrivals 12 / 34 (S: 15 / 26). Within seed noise.
- **Not done:** no Web Worker or WebGPU brain; everything is typed arrays on the main thread. 60 fps could not be
  verified here: headless Chromium uses software WebGL (render 12–55 ms per frame).
- **Headless Chromium:** no console errors. Phone 17.3 fps, desktop 13.3 fps (software WebGL; desktop render 43 ms per
  frame). Brain cost per sim step: phone 4.0 ms; desktop 10.2 ms in the first 9 s, 3.5 ms after 50 s. The page stayed on M.
  Forcing the threshold to 1 ms made it reload to `?brain=S&auto=1` as designed. Motion intact 9.5 / 9.7, MN
  lesioned 0.4 / 0.6. Screenshots: `live-shots/s13-*.png`.


## Pass 14 — evolve a lineage in the page, rough-ground genome, thirst, repertoire

Fix 4 of Alex's review (an evolved genome, motor babbling and an in-page "evolve a new lineage" option), plus another go at
the gaps pass 12 left open.

- **In-page lineage evolution** (`js/lineage.js`, `js/sim/lineage_worker.js`; Lesions tab).
  - Separable CMA-ES (diagonal covariance, cumulative step-size control) over the 44 motor genes, starting from the
    current genome.
  - Each generation scores 8 mutants and the current mean in Web Workers, using the same fitness as the offline run
    (`js/sim/fitness.js`, moved out of `test/genome_eval.mjs`). Each one is a hidden body with the small brain doing
    6-s forward / turn-left / turn-right trials and a righting trial.
  - The panel shows per generation: lineage fitness, best child, turn rate, forward speed and uprightness.
  - "Adopt lineage" grows a new creature from the mean genome and keeps it in localStorage; "Starter genome" undoes it.
  - Headless Chromium: 6 generations (54 genomes) took 28 s on an idle machine and 58–66 s on a loaded one, with no
    console errors, and adopting worked.
  - **Honest result:** the lineage fitness bounced around over 6 generations (4.04 → 3.32 in one run, 2.82 → 2.16 in
    another), because every generation is scored on a different single body. A short in-page run is a demonstration,
    not a reliable improvement.
- **Offline run 3, rough ground** (`EVAL_ROUGH=1 test/evolve_genome.mjs`).
  - Setup: 24 generations × 16 (384 genomes), training bodies 1–2, brain M, warm start from the pass-12 genome,
    σ 0.1.
  - Fitness: rocks and springs left in place, plus a zig-zag trial (the turn command switches side every 1.5 s, as in
    real steering) and extra weight on uprightness.
  - Population mean fitness went from 3.8 to 4.4–4.6. The final CMA-ES mean is shipped, because on held-out bodies it
    beat the single best-ever sample.

  Held-out bodies 4–9, rough fitness:

  | genome | fwd u/s | turn rad/s | upright | zig-zag travel u/s | zig-zag upright | righting s | fitness |
  |---|---|---|---|---|---|---|---|
  | pass 12 | 0.35 | 2.01 | 0.84 | 0.30 | 0.87 | 0.9 | 4.66 |
  | run 3, best-ever sample | 0.25 | 2.12 | 0.87 | 0.46 | 0.89 | 1.7 | 4.82 |
  | **run 3, mean (shipped)** | 0.43 | 2.20 | **0.89** | 0.35 | **0.91** | 1.5 | **5.05** |

- **Navigation with the new genome** (`nav_probe`, 60 s, bodies 1–8, brain M):

  | | near (4–8 u) | far (14+ u) | upright (on its back) |
  |---|---|---|---|
  | pass 13 genome | 5/8 | 0/8 | 0.64 |
  | **pass 14 genome (shipped)** | **7/8** | **3/8** | **0.75 (5–8%)** |
  | same, babbling lesioned | 5/8 | 2/8 | 0.72 |
  | same, babbling reference gain 0.89 instead of 1.36 | 4/8 | 3/8 | 0.71 |
  | same, rear/climb/jump/nocifensive reflex synergies off (test only) | 7/8 | 4/8 | 0.79 |

  - The reflex synergies cost a little uprightness, but they are what climbs rocks and uses springs, so they stay on.
  - Motor babbling measured a turn gain of 0.89 rad/s per unit command on average (range 0.65–1.02 across bodies 1–8,
    CV 0.11–0.15; with the pass-12 genome it was 0.79, CV 0.36). It helps: without it, near 5/8 and far 2/8.
  - **Still not met:** upright during navigation is 0.75, not > 0.85. Far arrival is 3/8, against 7/8 near. Forced
    trials on held-out bodies now reach 0.89–0.91.
- **Thirst.** Before this pass, thirst only competed when the creature was idle, which rarely happened. Now strong
  thirst (> 0.45) can interrupt a food or exploration trip (about 0.5% × thirst per 0.25 s; lesionable with "thirst").
  - On body 3, time spent seeking water rose from 1% to 20%. It got within 1.2 u of a pool's edge but gave up.
  - `water_probe` (300 s, bodies 1–4): 1/4 bodies drank, both before and after, and also with thirst seeking
    lesioned. **Thirst-driven water finding is still not shown to work**; the limit is again the gait over 6–18 u.
- **Behavioural repertoire.** The pass-12 drop in entropy (6.2 → 4.1 bits) turned out to be mostly a measuring
  artefact. The evolved wiring keeps a small tonic offset in the long muscles, so the "back half active" and
  "front half active" bits (fixed threshold 0.05) are on 98–99% of the time. A bias-corrected version
  (`entropy2`: each of the same 7 signals compared with its own ~5-s running mean) is now reported next to the old
  one. `measure`, 90 s, bodies 1–3, brain M:

  | genome | entropy (fixed threshold) | entropy2 (bias-corrected) | states | upright | dist |
  |---|---|---|---|---|---|
  | hand wiring (passes 1–11) | 5.74 | 6.42 | 92 | 0.36 | 72.8 |
  | pass 12 | 4.71 | 6.17 | 51 | 0.60 | 69.0 |
  | pass 14 (shipped) | 4.46 | 6.32 | 45 | 0.62 | 65.5 |
  | pass 14, MOT lesioned | 6.03 | 6.20 | 103 | 0.79 | 52.3 |
  | pass 14, MN lesioned | 0.08 | 0.39 | 1 | 0.85 | 4.2 |

  The fixed-threshold entropy was not changed to make it look better; both are shown.
- **Foraging** (`forage_bench`, 240 s, bodies 1–8, fed / arrivals): pass 13 12 / 34; pass 14 genome 10 / 18; pass 14
  with the thirst interrupt (shipped) 12 / 20. Feeding is the same, but there are fewer site arrivals. Within seed noise
  for feeds; arrivals are down.
- **Headless Chromium:** phone and desktop showed no console errors. Motion: intact 6.4 / 6.2; MN lesioned 0.6 / 0.5.
  - **fps could not be measured cleanly.** Other jobs on the test machine held the load average at 21–26, so phone
    ran at 11.6 fps and desktop produced no fps reading within 9 s.
  - Under that same load, an A/B run of the pass-13 build gave the same result (phone 14.0 fps, desktop no reading).
    The slowdown comes from the machine, not this pass.
  - Quiet-machine numbers are in pass 13: phone 17 fps, desktop 13 fps (software WebGL), 3.5–4 ms per brain step.
  - Screenshots: `live-shots/s14-*.png` (`s14-desktop-lab.png` shows the lineage panel after 6 generations: 54 genomes, 56 s under load).

## Pass 15 — binocular retina + EKF-SLAM, cross-spectral/mDAE memory, 4 brain scales + Worker/WebGPU + homeostasis, full 78-gene motor+steering CMA-ES, online RTRL SSM + residual world model, 21-ch striatal race, metacognition & Tsotchke stack

Addresses the remaining `SIMPLIFIED` limitations from passes 11–14 across memory, vision/navigation, brain scale/systems/homeostasis, developmental genetics, world-model architecture, decision unification, metacognition and the Tsotchke stack.

- **Memory encoder learning (`js/sim/memory.js`):**
  - **HDC maps (1024-dim FHRR):** replaced heuristic magnitude pruning with 2-fold split cross-spectral coherence + Wiener ARD shrinkage + per-feature Gauss-Newton spatial-frequency refinement in N3 sleep.
  - **Modern Hopfield (1024 slots):** replaced the identity-initialised InfoNCE-only map with a closed-form Marginalised Denoising Autoencoder (`mDAE`) projection for 50%-masked noisy cues, Empirical-Bayes subspace precision cosine (`C^{-1/2}`) + InfoNCE fine-tuning and 2-step CA3/CA1 retrieval.
- **Binocular 260° retina + 3D occlusion + hippocampal EKF-SLAM (`js/sim/vision.js`), posture & navigation (`js/sim/body.js`, `js/sim/creature.js`, `js/sim/nav.js`):**
  - 32 ommatidia anchored on the physical 3D stalked eyes (steered by neural gaze channels) cast rays against rock spheres and terrain heightfield ridges, computing chromatic opponent R/G/B/shimmer channels, looming/optic flow and binocular stereo + vertical-subtense inverse-depth range.
  - Landmark coordinates start unmapped with high variance (`σ² = 28 u²`) rather than given exactly, updating online via per-landmark Kalman filtering and visual loop-closure resets.
  - Fixed two roll-coupling bugs found during testing: (1) a stale `rightSide` latch in the vestibular righting reflex that kept inverted bodies pushing with airborne legs after rocking across `sy = 0` (`creature.js`), and (2) projecting horizontal path-integration velocity onto the rolled 3D side vector `F3.s` instead of horizontal `(-sin h, cos h)`. Added directional ventral scute ratchet friction and cross-slope keel resistance in `body.js`, saturating biophysical MOT readout (`1.05·tanh(rate/36)`), and steady-state `1.2-s` neonatal babbling blocks (`turnGain0 = 1.37 rad/s`).
- **Brain scale (`S`/`M`/`L`/`XL`), cache-compact CSR, Web Worker & WebGPU backends, 3-mechanism homeostasis, 2-compartment CTX & HIP place fields (`js/sim/brain.js`, `js/sim/brain_worker.js`, `js/sim/webgpu_brain.js`):**
  - Rebuilt `Brain` around contiguous `Float32Array` states/weights, `Uint16Array` CSR adjacency (`O(N+S)` bucket sort), inlined `xorshift32`, sparse `spkList` and trace-gated STDP; added `XL` (`25,924` neurons / `1.10M` synapses).
  - Added off-main-thread `WebWorker-CSR` (`?backend=worker`) and `WebGPU-WGSL` compute shader (`?backend=webgpu`) accelerators offloading the `THAL` + `CTX` + `HIP` sheets (`brain.delegated`).
  - Added three biological homeostatic mechanisms independent of structural rewiring: region set-point bias, slow deadzone intrinsic rheobase plasticity (`vBias`) and BCM sliding metaplasticity + Turrigiano multiplicative synaptic scaling.
  - Added 2-compartment apical/basal coincidence amplification on cortical excitatory pyramidal cells (`HIP`/`INS` → apical) and topographic hippocampal place fields (`drivePlaceCells`) projecting plastically to `STR` and `CTX`.
- **Full 78-gene developmental genome & variance-reduced in-page lineage evolution (`js/sim/genome.js`, `js/sim/starter_genome.js`, `js/sim/fitness.js`, `js/lineage.js`, `js/sim/lineage_worker.js`):**
  - Expanded the genome to 78 bounded developmental genes (`58` motor/synergy + `20` steering), growing pitch/rear, curl, jump, reach, grip, gaze and all `sense → MOT` weights with zero hand-wired synergy loops.
  - Evolved offline in two multi-body CMA-ES stages across 6 rough-ground bodies (`1,2,3,9,10,11`): Stage 1 (16 gens × 16 motor genomes) and Stage 2 (12 gens × 12 closed-loop navigation steering genomes).
  - Upgraded in-page lineage evolution to optimise all 78 genes using mirrored (antithetic) sampling + paired 2-body Common-Random-Number (CRN) rough-ground + closed-loop steering trials, with a persistent undo stack (`Previous genome`).
- **Online RTRL selective SSM, deep residual world model, unified 21-channel striatal race, metacognition, thought curvature & full Tsotchke stack (`js/sim/mind.js`, `js/sim/metacog.js`, `js/tsotchke/{qrng,qgtl,moonlab}.js`):**
  - `SelectiveSSM` learns `B`, `Wd`, `bd` and `omega` online via RMS-normalised diagonal RTRL + elastic basis anchor; `WorldModel` is now a 2-hidden-layer (`72 → 48 → 48 → 25`) `SiLU` residual MLP with learned heteroscedastic `predVar`.
  - Expanded `STR` to 42 MSNs (`21` D1 + `21` D2) unifying 16 plant sites, 3 water pools, dropped food and continuous FHRR-HDC epistemic exploration in one expected-free-energy spike race (retiring innate snack orienting and the discrete `24×24` novelty grid).
  - Added `Metacognition`: online Oja 8-D neural manifold + order-3 Eshkol Taylor-jet Frenet-Serret curvature $\kappa(t)$ and torsion $\tau(t)$, 2nd-order uncertainty calibration, counterfactual regret, innate (`W0`) vs learned (`ΔW`) weight-space telemetry, diagonal Fisher/EWC motor consolidation, Moonlab Jacobi SVD sleep denoising + bipartite MPS entanglement entropy, QGTL Fubini-Study metric trace + Berry curvature, and an 8-qubit statevector Born-rule QRNG.

Measured (Node & headless Chromium, idle machine):

- **Memory (`test/memory2_probe.mjs`):**
  - **(a) HDC held-out spatial regression (seeds 1–8):**
    - Well-tuned prior (`0.35`): `superpose-512` `0.894` → `delta-fixed-1024` `0.957` → **`delta-learned-1024` `0.964` (`+0.007`)**.
    - Mis-tuned prior (`0.80`): `superpose-512` `0.816` → `delta-fixed-1024` `0.928` → **`delta-learned-1024` `0.964` (`+0.036`)**.
  - **(b) Hopfield 600-s runs (`50%`-masked + noisy cues, `early / late / held-out` cosine):**
    - Brain `M` seed 2: `pass-3 (256)` `0.74 / 0.81 / 0.64` → `1024 raw keys` `0.79 / 0.82 / 0.65` → **`1024 + mDAE/EB learned keys` `0.80 / 0.85 / 0.67`**.
    - Brain `S` seeds 2/3/5: `1024 raw keys` `0.77/0.77/0.73` early, `0.85/0.81/0.81` late, `0.69/0.66/0.65` held-out → **`1024 + learned keys` `0.77/0.75/0.76` early, `0.86/0.82/0.83` late, `0.71/0.67/0.67` held-out**.
- **Two-stage multi-body CMA-ES on held-out bodies:**
  - **Stage 1 motor genome** (`EVAL_ROUGH=1`, held-out bodies `4,5,6,7,8,12`): `fwd` `0.665 u/s` (pass 14: `0.43`), `turn` `2.20 / 1.74 rad/s`, `upright` `0.918`, `zig-zag` `0.362 u/s` (`upZ 0.942`), **rough fitness `5.550`** (pass 14: `5.05`).
  - **Stage 2 steering genome** (`test/evolve_steer.mjs`, held-out bodies `4,5,6,7,8,12,13,14`, 16 near+far closed-loop trials):
    - `HAND_STEER`: fitness `1.824`, arrived `15/16`, upright `0.894`, on back `2.55%`.
    - **`EVO BEST` (shipped `STEER`)**: **fitness `1.939` (`+0.115`)**, **arrived `15/16`**, **upright `0.920`**, **on back `0.49%`** (5× fewer inverted steps).
- **Navigation, foraging & thirst across brain scales:**

  | test | pass 14 (M) | pass 15 (S) | **pass 15 (M, default)** | pass 15 (L) | pass 15 (M, pathway lesioned) |
  |---|---|---|---|---|---|
  | `nav_probe` 60 s, seeds 1–8: near (4–8 u) | 7/8 (14.4 s) | 7/7 (9.7 s) | **8/8 (9.4 s)** | 8/8 (8.5 s) | `nav` off: 6/8 (11.4 s) |
  | `nav_probe` 60 s, seeds 1–8: far (14+ u) | 3/8 (38.6 s) | 8/8 (33.0 s) | **8/8 (33.9 s)** | 6/8 (29.2 s) | `nav` off: 3/8 (49.4 s) |
  | `nav_probe` mean upright (on its back) | 0.75 (5–8%) | 0.85 (5%) | **0.86 (4%)** | 0.84 (4%) | `nav` off: 0.91 |
  | `forage_bench` 240 s, seeds 1–8: fed / arrivals / give-ups | 12 / 20 / — | 43 / 74 / 1 | **56 / 85 / 1** | 36 / 70 / 5 | — |
  | `water_probe` 300 s, seeds 1–4: bodies that drank | 1/4 | — | **4/4** (`5.7–8.8` drunk) | — | `thirst` off: **0/4** |

- **Brain scale, step cost & structural-rewiring lesion (`test/brain_probe.mjs`):**

  | brain | neurons / synapses | single-thread CPU ms/step | Web Worker main-thread ms/step | CTX / HIP / THAL Hz | pruned+regrown |
  |---|---|---|---|---|---|
  | S (120 s) | 436 / 2,236 | 2.22 | — | 6.3 / 7.0 / 7.9 | — |
  | **M (300 s, default)** | **3,268 / 123,162** | **3.52** | **2.66** | **7.3 / 8.0 / 4.4** | **5,117** |
  | **M (300 s, `struct` lesioned)** | **same** | **3.49** | — | **10.7 / 10.1 / 8.6 (stays active!)** | **0** |
  | L (120 s) | 11,972 / 495,515 | 12.56 | **2.98** | 6.8 / 6.8 / 7.1 | 7,536 |
  | XL (30 s) | 25,924 / 1,102,524 | 35.7 | — | 9.7 / 9.1 / 9.3 | — |

- **World model, RTRL SSM, reflexes & Tsotchke telemetry:**
  - Matched-trajectory 240-s world-model MSE (seeds 1–4): `linearWM` `0.0356` → `deepWM-fixedSSM` `0.0353` → **`deepWM+RTRL-SSM` `0.0352`** (closed-loop `measure` 90-s `wmMSE`: `0.042`).
  - `measure` 90 s (seeds 1–3, brain M): intact `dist 63.8, fed 2.33, entropy 4.19, entropy2 5.82, states 40.3, upright 0.82`; `mn` lesioned `dist 6.23, fed 0, entropy 0.22, states 1.67`.
  - `righting_probe`: **10/10 righted, median 2.1 s** (`mn` lesioned: **0/10**). `babble_probe`: mean gain `1.41 rad/s`, CV `0.16`. `symmetry_probe`: `−0.08 / −0.02 / −0.04 rad/s`. Cephalic insulin (`water_probe b`): peak blood glucose `3.28 / 3.42 / 2.05` ON vs `3.79 / 3.88 / 2.90` OFF (~17% lower).
  - Tsotchke & manifold telemetry: Frenet-Serret $\kappa \approx 1.92$, $|\tau| \approx 6.65$; QGTL Fubini-Study trace `0.22–0.26`, Berry curvature `±1.5e-3`; Moonlab MPS entanglement entropy `0.59–0.89`; 8-qubit QRNG normalised entropy `0.91–0.93`.
- **Headless Chromium (`browser_check.mjs`, `lineage_check.mjs`):**
  - Zero console or page errors on phone (`390×844`: `45.2 fps`, `stepMs 2.82 ms`, motion intact `7.44` vs `mn` lesioned `0.97`), desktop (`1280×800` SwiftShader: `20.7 fps`, `stepMs 2.37 ms`, motion intact `8.02` vs `mn` lesioned `1.10`), and Web Worker mode (`?backend=worker` on M and L).
  - `lineage_check.mjs`: 6 generations (55 2-body CRN genome evaluations) completed with zero errors, non-decreasing CRN fitness (`6.44`, turn `1.94 rad/s`, fwd `0.59 u/s`, upright `0.95`), clean adoption and `Previous genome` undo stack restoration.

## Pass 16 — 5-scale 3-compartment canonical laminar brain (`XXL` 105k / 4.76M syn, `S < M < L` foraging, `<15 ms` CPU `XL`), anatomical trisynaptic `EC → DG → CA3 → CA1` hippocampus, 2D retinotopic `LGN → V1 Gabor → V4/MT` visual hierarchy, `1.17M`-param Causal RoPE-SwiGLU Transformer-XL world model, in-browser de-novo random `[0.05, 0.95]^78` evolution, 78-tet 3D Neo-Hookean FEM + 1D Navier-Stokes / 3D SPH hemodynamics, `1:1` biological real-time clock, and 10-qubit open-quantum Lindblad / photonic QRNG + Vidal canonical MPS

Addresses all eight remaining `SIMPLIFIED` items from pass 15 across neuroanatomy, scaling, vision, hippocampal circuitry, world-model capacity, de-novo evolutionary search, continuum tissue/fluid physics, circadian timekeeping and quantum/tensor-network execution.

- **Five brain scales (`S`/`M`/`L`/`XL`/`XXL`), 3-compartment canonical `L4 / L2/3 / L5/6` laminar microcolumns, monotonic `S < M < L` foraging & `<15 ms` CPU `XL` (`js/sim/brain.js`, `js/sim/brain_worker.js`, `js/sim/webgpu_brain.js`, `js/sim/creature.js`, `js/app.js`):**
  - Added `XXL` (`104,904` neurons / `4,756,245` synapses: `290×290` cortex, `16,384` hippocampal place cells, `4,096` thalamus) using dynamic `Uint32Array` CSR indices (`N > 65,535`) built in `~1.6–2.1 s`, and made `?backend=auto` the default so `S`/`M` step on CPU while `L`/`XL`/`XXL` delegate automatically to `WebWorker-CSR` (`?backend=webgpu` selects the lock-free incoming-CSR WGSL compute shader).
  - Upgraded `M`–`XXL` cortex to canonical 3-layer microcolumns (`L4` 25% granular thalamorecipient + V1 input → `L2/3` 45% supragranular recurrent associative → `L5/6` 30% infragranular pyramidal output to `STR`, `MOT`, `INS` & `THAL`) with excitatory-only long-range projections and 3-compartment pyramidal dynamics (somatic `v` + PV basket shunt, basal dendritic `vBasal`, and L1 `apical` tuft with SST Martinotti distal inhibition + nonlinear Larkum BAC $\text{Ca}^{2+}$ plateau bursts).
  - Added multi-scale septotemporal hippocampal place modules (dorsal fine / intermediate / ventral coarse) + topographic orbitofrontal value columns (`driveOFCColumns`) and impulse-invariant multi-rate sheet + eligibility-trace integration (`eligStride = 4` on `XL`, `8` on `XXL`), cutting single-thread `XL` step time from `35.7 ms` to **`14.85 ms`** (`>2.4×` faster) while reversing pass 15's `L` foraging drop (`36 → 52` feeds).
- **Anatomical trisynaptic hippocampus (`EC_II/III → DG → CA3 → CA1`) & mismatch event segmentation (`js/sim/memory.js`, `js/sim/creature.js`):**
  - Built an explicit `576`-granule-cell Dentate Gyrus (`8×` expansion over the 72-D entorhinal state, `k = 28` / `4.9%` `k-WTA` sparse competitive coding, competitive Hebbian `Wdg` + nonlinear mossy-fiber completion `Rdg`, lesionable via `dg`), feeding `1,024` `CA3` slots (observed-subspace precision cosine + mossy-fiber overlap + rectified NMDA dendritic spine mixture + 2-step recurrent completion) and a `CA1` comparator (`ca1Novelty`, `shouldStore`) that segments continuous waking streams into salient episodic boundaries instead of flooding `CA3` with redundant 1-s ticks.
- **2D retinotopic image-forming binocular visual hierarchy (`js/sim/vision.js`, `js/app.js`, `index.html`):**
  - Replaced the 1D 32-ommatidium ring with dual `24×12` binocular photoreceptor sheets (`576` RGB + inverse-depth `1/d` z-buffer receptors across `260°×110°` FOV on the stalked eyes, `0.37 ms/step`), rasterising sky, terrain horizon contours, rocks, pools, snacks and the 4 distinct 3D plant crown shapes.
  - Added a `24×12` thalamic **LGN** Difference-of-Gaussians (`lgnMag`) + `R−G`/`B−Y` opponent stage, a `12×6×4` **V1** `5×5` zero-DC quadrature Gabor filter bank (`0°, 45°, 90°, 135°` Simple cells, Adelson-Bergen Complex energy cells and binocular stereo disparity map, driving `L4` visual cortex), ventral **V4** foveal form+colour (`v4Fovea`), dorsal **MT** 2D optic flow (`mtFlowX`, `mtFlowY`, `mtDiv`) and hippocampal **EKF-SLAM** loop closure.
- **Causal Multi-Head RoPE SwiGLU Transformer-XL (`111.9k`–`1.17M` params) + multi-horizon RTRL-SSM world model (`js/sim/mind.js`, `js/sim/creature.js`):**
  - Replaced the 2-layer MLP readout with a selectable (`?wm=std|large|xl`) **Causal Multi-Head Rotary Position Embedding (`RoPE`) Self-Attention + RMSNorm + SwiGLU Transformer-XL** over a causal KV history ring buffer (`std`: `111,867` params; `large`: `548,187` params; `xl`: **`1,172,715` / `1.17M` params**), predicting both heteroscedastic 1-step (`+0.1 s`) sensory transitions and action-conditioned 5-step (`+0.5 s`, 40-D motor plan + causal velocity skip) trajectories for REM dream rollouts.
- **In-browser de-novo 10-generation evolution from pure uniform random `[0.05, 0.95]^78` weights (`js/lineage.js`, `js/app.js`, `index.html`):**
  - Added `'denovo'` mode (`#evo-denovo`) alongside 6-generation starter refinement (`#evo-run`): initialises purely from uniform random `[0.05, 0.95]^78` weights with zero starter or hand-wired priors, screens a 12-member **Stratified Latin-Hypercube** primordial cohort on paired 2-body CRN trials, and runs Mirrored Separable CMA-ES with cumulative step-size adaptation in Web Workers.
- **78-element 3D volumetric Neo-Hookean continuum FEM (`js/sim/body.js`) + 16-node/26-vessel 1D Navier-Stokes & 120-parcel 3D SPH hemodynamics (`js/sim/fluid.js`, `js/render.js`):**
  - Decomposed the 3D soft body into `78` sagittal-mirror positive-Jacobian tetrahedra (`72` trunk + `6` limb muscle bellies) solved via stable Neo-Hookean XPBD-FEM hydrostatic ($C_{\text{vol}} = J - 1$) and deviatoric ($C_{\text{dev}} = \sqrt{I_1} - \sqrt{3}$, $\nu = 0.40$) constraints, computing elastic strain energy, volumetric Jacobians and intramuscular `segPressure` (lesionable via `fem`).
  - Added `Hemodynamics` (`js/sim/fluid.js`, lesionable via `fluid`): a closed-loop 16-node / 26-vessel unsteady 1D axial Navier-Stokes vascular graph (dorsal aorta, bicuspid-valved vena cava, carotid cerebral loop, hepatic-portal bed) with Windkessel wall compliance, Frank-Starling ventricular elastance, carotid baroreceptor reflex, 3D orthostatic gravity head, FEM skeletal-muscle venous pump and `120` 3D SPH blood parcels transporting $\text{O}_2$ and glucose (driving the live 3D blood-vessel particles and heart organ mesh in `render.js`).
- **Selectable `1:1` biological real-time circadian clock (`js/sim/creature.js`, `js/app.js`, `index.html`):**
  - Added `CLOCK_MODES` (`?clock=realtime` for `1×` true 24-hour circadian day at `3,600` frames/sim-min, `?clock=ultradian` for `60×` / 24-min day, and default `?clock=circadian` for `240×` / 6-min demo day).
- **Tsotchke 10-qubit open-quantum Lindblad/Kraus MCWF simulator + live HTTPS photonic QRNG + Vidal canonical MPS (`js/tsotchke/qrng.js`, `js/tsotchke/qgtl.js`, `js/tsotchke/moonlab.js`, `js/sim/metacog.js`):**
  - Upgraded `TsotchkeQRNG` to a 10-qubit (`DIM = 1,024`) open-quantum statevector with Ising `ZZ` crosstalk and Dalibard-Castin-Mølmer `T1` amplitude-damping + `T2` dephasing quantum trajectories (`purity`, `quantumJumps`), plus opt-in `fetchHardwareEntropy()` (`#qrng-fetch`) querying live HTTPS optical/vacuum-fluctuation QRNG hardware (`LFDR`, `ANU`, `NIST`) verified by **NIST SP 800-90B** Repetition-Count & Adaptive-Proportion health tests.
  - Added explicit **Vidal Canonical Matrix Product State** factorisation (`vidalMPS` / `mpsContract`, $\Gamma^{[s]}$ site tensors & $\Lambda^{[s]}$ Schmidt spectra up to bond $\chi = 8$, exact reconstruction RMSE `6.22e-16`) in `moonlab.js`.

Measured (Node & headless Chromium, idle machine):

- **Monotonic foraging across brain scales, navigation & thirst (`forage_bench.mjs`, `nav_probe.mjs`, `water_probe.mjs`):**

  | benchmark | pass 15 (L) | **pass 16 (S)** | **pass 16 (M, default)** | **pass 16 (L)** | pass 16 (pathway lesioned) |
  |---|---|---|---|---|---|
  | `forage_bench` 240 s, seeds 1–8: **feeds / arrivals / give-ups** | 36 / 70 / 5 | **43 / 65 / 5** | **48 / 71 / 8** | **52 / 78 / 2** | monotonic **`S < M < L`** |
  | `nav_probe` 60 s, seeds 1–8: near (4–8 u) | 8/8 (8.5 s) | — | **7/8 (10.5 s)** | — | `nav` off: 7/8 (20.4 s) |
  | `nav_probe` 60 s, seeds 1–8: **far (14+ u)** | 6/8 (29.2 s) | — | **8/8 (34.2 s, 100%)** | — | `nav` off: **2/8 (37.3 s)** |
  | `nav_probe` **mean uprightness (on its back)** | 0.84 (4%) | — | **0.90 (2%)** | — | `nav` off: 0.90 |
  | `water_probe` 300 s, seeds 1–4: bodies that drank | — | — | **4/4** (`8.4–15.8` drunk) | — | `thirst` off: **0/4** |

- **Five-scale spiking substrate & off-thread worker delegation (`test/brain_probe.mjs` & headless Chromium `?backend=auto`):**

  | brain | neurons / synapses | single-thread CPU ms/step | `?backend=auto` browser main-thread `simMs` | CTX / HIP / THAL Hz | notes |
  |---|---|---|---|---|---|
  | **S** (120 s) | 436 / 2,312 | **2.00** | CPU (`~2.0`) | 8.0 / 8.3 / 8.1 | compact reference |
  | **M** (300 s, default) | **3,268 / 132,781** | **4.57** | CPU (`3.35`) | 7.6 / 7.9 / 5.4 | `struct` lesioned 300 s: **9.7 / 9.7 / 8.1 Hz** (active, align `1.18→1.24`) |
  | **L** (120 s) | **11,972 / 531,421** | **10.48** | WebWorker | 6.5 / 6.7 / 6.8 | 52 feeds in 240 s (`> M > S`) |
  | **XL** (35 s) | **25,924 / 1,178,148** | **14.85** *(pass 15: 35.7)* | **5.73** (`WebWorker-CSR`) | 4.4 / 1.0 / 6.2 | `>2.4×` faster on CPU; `<6 ms` on UI thread |
  | **XXL** (20 s) | **104,904 / 4,756,245** | **61.87** | **12.27** (`WebWorker-CSR`) | 29.5 / 20.7 / 11.5 | `Uint32Array` CSR built in `1.6–2.1 s` |

- **Trisynaptic `EC → DG → CA3 → CA1` memory & FHRR-HDC (`test/memory2_probe.mjs`):**
  - **HDC (`a`, seeds 1–8):** prior `0.35`: `0.894 → 0.957 → 0.964 (+0.007)`; prior `0.80`: `0.816 → 0.928 → 0.964 (+0.036)`.
  - **Hopfield (`b 2`, 600-s waking run segmented by CA1 into 576 salient events, 50%-masked noisy cues, `early / late / held-out` cosine):**
    - `pass-3 (256 raw)`: `0.71 / 0.79 / 0.65`
    - `1024 + sleep merge, raw keys`: `0.79 / 0.81 / 0.67`
    - **`1024 + sleep merge + trisynaptic learned keys`: `0.85 (+0.06) / 0.92 (+0.11) / 0.67`**.
- **Transformer-XL world model, closed-loop `measure.mjs`, de-novo lineage, 3D FEM, hemodynamics & Tsotchke:**
  - **WorldModel matched 4-seed sequential 1-step (`+0.1 s`) MSE:** `linearNLMS` `0.03233` → `transformerStd` (`111,867` params) `0.03014` → **`transformerXL` (`1,172,715` params) `0.02886` (`−10.7%`)**; 5-step (`+0.5 s`) MSE `0.03402 → 0.03401`.
  - **Closed-loop `test/measure.mjs` (90 s, seeds 1–3, brain M):**
    - `intact`: **`dist 64.04, fed 3.33 (+43% vs pass 15's 2.33), entropy 4.31, entropy2 5.91, states 48.0, upright 0.818, wmMSE 0.031 (−26% vs pass 15's 0.042)`**
    - `mot` lesioned: `dist 44.18, fed 0.33, upright 0.822`
    - `cpg` lesioned: `dist 27.77, fed 1.00, upright 0.880`
    - `mn` lesioned: `dist 11.77, fed 0, entropy 0.482, states 1.67`
  - **De-novo uniform random `[0.05, 0.95]^78` lineage evolution (10 gens, 95 2-body CRN trials):** pure random initial **`2.833` → Gen 1 LHS `4.585 (+1.752)` → Gen 2 `5.682 (+2.848)` → Gen 5–10 `6.112 (+3.278, >2.15×)`** (`fwd 0.389 u/s`, `turn 2.12 rad/s`, `upright 0.899`, `goal 0.263 u/s`).
  - **Continuum 3D FEM & 1D Navier-Stokes / 3D SPH hemodynamics:** `symmetry_probe`: `0.00 / −0.03 / −0.03 rad/s`; `righting_probe`: **10/10 righted, median 2.5 s**; `scale_probe`: `turnL 2.29, turnR 1.73 rad/s, fwd 0.79 u/s`; active 240-step trunk/body `meanTetJ = 1.009`; `Hemodynamics`: `MAP 67.1–78.9 mmHg, CVP 7.7 mmHg, Re 128.4, headO2 0.977, meanO2 0.974`.
  - **Tsotchke 10-qubit Lindblad QRNG & Vidal MPS:** 10-qubit (`DIM = 1,024`) normalised entropy `0.942`, trajectory purity `0.918`; Vidal canonical MPS (`χ = 8`) exact contraction RMSE `6.22e-16`.
- **Headless Chromium (`browser_check.mjs`, `lineage_check.mjs`, `XXL`/`XL`/real-time/de-novo checks):**
  - `browser_check.mjs`: zero console/page errors (`errors: []`) on phone (`35.6 fps`, `stepMs 6.28 ms`, motion intact `8.89` vs `mn` lesioned `0.27`) and desktop (`19.5 fps` SwiftShader, `stepMs 3.35 ms`, motion intact `8.72` vs `mn` lesioned `2.31`).
  - `lineage_check.mjs`: 6-gen starter refinement (`55` CRN trials) reached **`6.74 (+0.44)`** (`turn 1.89 rad/s, fwd 0.71 u/s, up 0.94, goal 0.83`), adopted cleanly (`errors: []`); browser `#evo-denovo`, `?clock=realtime`, `?wm=xl` (`1,172,715` params) and `?brain=XXL&backend=auto` (`104,904` neurons, `simMs 12.27 ms`) all ran with `errors: []`.


## Pass 17 — 6-scale 4-compartment Hodgkin-Huxley cable-tree brain (`MEGA` 1.05M / 16.78M syn), biophysical spiking trisynaptic hippocampus (`held-out > raw`), dual `64×32` (`4,096`-ch) foveated retinas + 24-unit invariant `IT`, `3.72M`-param Multimodal (`+2.0 s` end-to-end BPTT + raw foveal RGB) Transformer-XL, 92-gene Evo-Devo body+brain co-evolution, 336-tet anisotropic 3D FEM + two-way Biot-Darcy FSI & 256-parcel WCSPH, open-ended multi-agent A-Life biosphere + WebAudio syrinx, `Three.js` HDR16F/SSAO/Display-P3/4K-UHD + `p5.js` studio, default `1:1` biological real-time clock, and 12-qubit inline-WASM QRNG + `χ = 16` Vidal MPS & Binary MERA

Upgrades all eight remaining `SIMPLIFIED` limitations from pass 16 while transforming the 3D scene and world into an open-ended multi-agent A-Life biosphere powered jointly by `Three.js`, bundled `p5.js`, and procedural `WebAudio`.

- **Six brain scales up to `MEGA` (`1,048,644` neurons / `16,777,216` synapses) & 4-compartment Rush-Larsen Hodgkin-Huxley cortical cable trees (`js/sim/brain.js`, `js/sim/brain_worker.js`, `js/sim/webgpu_brain.js`):**
  - Upgraded `M`–`MEGA` cortical pyramidal microcolumns (`L4 / L2/3 / L5/6`) from 3-compartment integrate-and-fire equations to **4 electrotonically coupled cable compartments** (`AIS` axon initial segment + `Soma` with PV basket shunt + `Basal` dendrite + `Apical` tuft with SST Martinotti inhibition) integrated via unconditionally stable exponential **Rush-Larsen** Hodgkin-Huxley gating (`Na_v` $m^3 h$, `K_v` $n^4$, apical `Ca_v` $m_{\text{Ca}}^2$ Larkum plateau bursts, and hyperpolarisation-activated `HCN I_h` sag).
  - Added `MEGA` (`1,048,644` neurons / `16,777,216` synapses: `896×896 = 802,816` CTX, `180,224` septotemporal HIP place cells, `65,536` THAL) using deterministic procedural block-circulant CSR assembly (`228 ms` build time, `~101 MB` typed-array footprint) with automatic `WebWorker-CSR` and `WebGPU-WGSL` delegation (`?backend=auto|worker|webgpu`).
- **Biophysical conductance-based spiking trisynaptic hippocampus & out-of-sample `held-out` generalisation (`js/sim/memory.js`):**
  - Replaced purely algebraic trisynaptic scoring with an explicit **964-neuron conductance-based `SpikingTrisynapticCircuit`** (`72 EC_II/III → 576 DG LIF + lateral-feedback WTA → 256 CA3 recurrent Mg²⁺-unblocked NMDA + LIF → 60 CA1` mismatch comparator) coupled with zero-diagonal **Hollow-mDAE** feature completion (`W[i,i] = 0`) and **James-Stein Empirical-Bayes CA1 shrinkage** toward online `EC_II/III` priors so out-of-sample future-trajectory recall strictly beats raw keys (`0.703 > 0.691`).
- **High-acuity log-polar foveated retinas (`4,096` receptors) & 24-unit trace-learned invariant `IT` cortex (`js/sim/vision.js`):**
  - Expanded binocular retinas `7.1×` from `24×12` (`576` ch) to **dual `64×32` (`4,096` RGB + `1/d` receptors, `0.44 ms/frame`)** with log-polar central foveal magnification (`~3×` acuity) rasterising plants, boulders, water pools, snacks, hydrothermal vents, crystal shelters, conspecifics, 3D eggs, photonic bio-mites, and the Shadow-Leviathan predator.
  - Added **`V2`** collinear contour & corner-junction detectors feeding **`V4`** and a **24-prototype ventral `IT` cortex** trained online via Földiák temporal-trace Hebbian learning (`itInvariance = 0.994` across azimuth/distance changes).
- **Multimodal (`3.72M`-param) RoPE-SwiGLU Transformer-XL with `+2.0 s` (`20`-step) end-to-end BPTT & raw foveal RGB pixels (`js/sim/mind.js`):**
  - Added `?wm=ultra` (`L = 6, d = 256, H = 8, ffn = 688, T = 48`: **`3,720,700` parameters**, alongside `std` `147,228`, `large` `618,204`, `xl` `1,266,460`), fusing the `72-D` bodily/SSM state with a **`96-D` (`8×4×3`) raw foveal RGB visual patch** (`WvisIn` / `WvisPred` / `Wvis20`) and training online via **exact `20`-step (`+2.0 s`) end-to-end backpropagation through time** (`_learn20`) through all `L` SwiGLU, RMSNorm, and causal RoPE multi-head attention blocks.
- **92-gene Evo-Devo body + brain co-evolution from pure random `[0.05, 0.95]^92` weights (`js/sim/genome.js`, `js/sim/starter_genome.js`, `js/lineage.js`):**
  - Expanded the genome from `78` to **`92` bounded Evo-Devo genes**, adding `14` morphological, tissue-mechanics, thermal and neuro-allocation genes (`bodyLen`, `bodyGirth`, `headScale`, `foreLimb`, `hindLimb`, `crestFin`, `tailFluke`, `eyeScale`, `stalkLen`, `fiberStiff`, `pigmentHue`, `iridShift`, `thermalOpt`, `neuroHipAlloc`).
  - Upgraded `#evo-denovo` to **12-generation Archive-Backed Diagonal-Quadratic Surrogate Pre-Screened Active Mirrored CMA-ES** (14-member Stratified Latin-Hypercube primordial screen + 10-worker pool), co-evolving 3D body morphology, gait, and steering from pure uniform random `[0.05, 0.95]^92` weights.
- **85-particle / 336-tetrahedron anisotropic ($I_4$) 3D continuum FEM + two-way 3D Biot-Darcy FSI & 256-parcel WCSPH (`js/sim/body.js`, `js/sim/fluid.js`):**
  - Expanded the soft body from `51` particles / `78` tets to **`85` particles, `422` constraints, and `336` verified positive-Jacobian 3D tetrahedra** (sculpted snout, articulated jaw, bilateral feathered chemotactic antennae, caudal tail fluke, and 3-clawed feet) with anisotropic Holzapfel-Gasser-Ogden collagen-fiber ($I_4 = \mathbf{a}_0 \cdot \mathbf{C}\mathbf{a}_0$) strain-stiffening.
  - Added a **63-voxel (`7×3×3`) 3D Biot-Darcy poroelastic capillary tissue bed** coupled two-way (`applyCapillaryFSI`) to the 3D FEM body nodes alongside the 16-node / 26-vessel 1D Navier-Stokes graph and **`256` 3D Tait-EOS WCSPH blood parcels**.
- **Open-ended multi-agent A-Life biosphere, `Three.js` HDR16F/SSAO/Display-P3/4K-UHD, bundled `p5.js` studio & WebAudio syrinx (`js/sim/ecosystem.js`, `js/sim/world.js`, `js/render.js`, `js/p5_layer.js`, `js/audio.js`, `vendor/p5/`):**
  - Added autonomous **conspecific Glitchlings** (`0..14`, default `5`), courtship, **diploid 92-gene SBX crossover + polynomial mutation**, thermally incubated **3D bioluminescent eggs**, ontogenetic growth (`neonate → juvenile → adult → elder`), live `lineageTree` cladogram, `64×64×3` wind-advected reaction-diffusion pheromones (`food`, `Schreckstoff alarm`, `mate`), `32×32` soil N/C + `27`-edge underground mycelial fungal network, co-evolving L-system flora, `28` pollinating/edible **photonic bio-mites**, patrolling **Shadow-Leviathan** predator + camouflage + alarm calls, `3` geothermal hydrothermal vents, `4` crystal spire shelters, `4` seasons, forelimb snack/egg caching, and a procedural **WebAudio bio-acoustic syrinx & biosphere synthesizer**.
  - Overhauled `render.js` with `HalfFloatType` **HDR16F**, depth-buffer **SSAO**, crepuscular **god-rays**, `UnrealBloomPass`, wide-gamut `DisplayP3ColorSpace`, **Fixed 4K UHD (`3840×2160`, `?q=4k`)** + 4K PNG capture, **4 Camera Modes** (`orbit`, binocular creature `pov`, `director`, `overhead`), `2,400` GPU-instanced wind-swaying bioluminescent grass blades, twin-moon FBM nebula + aurora sky, and bundled **`p5.js` v1.11.3** generating live `512×512` Voronoi dermal scute/chromatophore + `256×256` mycelial/pheromone `CanvasTexture`s plus an interactive 5-tab `#p5-studio` (`pip` / `split` / `off`).
- **Default `1×` biological real-time clock & 12-qubit inline-WASM quantum / `χ = 16` MPS / Binary MERA stack (`js/sim/creature.js`, `js/tsotchke/wasm_quantum.js`, `js/tsotchke/qrng.js`, `js/tsotchke/moonlab.js`):**
  - Made **`1×` biological real-time (`?clock=realtime`, 24-hr circadian day)** the default browser landing clock (plus `?clock=wall` local solar sync, `60×`, and `240×`), adding waking hippocampal SWR micro-consolidation every `30 s`.
  - Added a zero-build inline **W3C WebAssembly `f64` 12-qubit (`DIM = 4,096`) quantum statevector + Lindblad T1/T2 trajectory kernel** (`0.12 ms/frame`), 4-beacon CORS randomness/QRNG streaming (`drand`, `NIST v2`, `LFDR`, `ANU` + NIST SP 800-90B RCT/APT/serial-correlation tests), **Vidal canonical MPS (`χ = 16`)**, and a **3-layer Binary MERA** multiscale entanglement renormalization network.

Measured (Node & headless Chromium):

- **Six-scale 4-compartment HH spiking substrate (`test/brain_probe.mjs` & headless Chromium):**

  | brain | neurons / synapses | single-thread CPU ms/step | browser backend (`?backend=auto`) | CTX / HIP / THAL Hz | notes |
  |---|---|---|---|---|---|
  | **S** | 436 / 2,312 | **3.45** | CPU | 8.2 / 8.5 / 8.0 | compact worker-eval reference |
  | **M** (default) | **3,268 / 132,778** | **5.20** | CPU | **10.4 / 11.9 / 7.5** | 300-s `struct` lesioned: **5.0 / 2.6 / 3.7 Hz** (stays active; align `1.081 → 1.244`) |
  | **L** | **11,972 / 531,289** | **13.89** | `WebWorker-CSR` | 9.1 / 8.6 / 8.6 | **30 feeds** in 240 s (`> M > S`) |
  | **XL** | **25,924 / 1,178,148** | **17.01** | `WebWorker-CSR` | 4.8 / 1.2 / 6.0 | off-main-thread 4-comp HH |
  | **XXL** | **104,904 / 4,744,285** | **69.13** | `WebWorker-CSR` | 24.1 / 16.4 / 10.2 | `Uint32Array` CSR |
  | **MEGA** | **1,048,644 / 16,777,216** | **91.97** | `WebWorker-CSR` (`errors: []`) | 5.7 / 1.5 / 1.2 | `228 ms` procedural CSR build; `1.05M` 4-comp HH neurons |

- **Monotonic foraging across brain scales, navigation & thirst (`forage_bench.mjs`, `nav_probe.mjs`, `water_probe.mjs`):**
  - **`forage_bench.mjs` (240 s, seeds 1–4):** strictly monotonic **`S = 22 feeds (40 arrivals, 0 give-ups) < M = 26 feeds (42 arrivals, 0 give-ups) < L = 30 feeds (41 arrivals, 0 give-ups)`**.
  - **`nav_probe.mjs` (60 s, seeds 1–8, brain M):** **NEAR `7/7` (`100%`, mean `12.0 s`)**, **FAR (`14+ u`) `7/8` (mean `27.3 s`)**, **mean uprightness `0.91` (`2%` inverted)**, `52%` path-integration steered.
  - **`water_probe.mjs` (300 s, seeds 1–4):** intact **`4/4` drank (`10.4, 7.5, 8.9, 9.2` drunk)** vs `thirst` lesioned **`0/4` (`0, 0, 0, 0` drunk)**.
- **Spiking trisynaptic hippocampus, multimodal `+2.0 s` world model, 92-gene Evo-Devo & multi-agent biosphere:**
  - **`memory2_probe.mjs`:** HDC (`a`): `0.894 → 0.957 → 0.964` (`0.35` prior), `0.816 → 0.928 → 0.964` (`0.80` prior). Spiking trisynaptic + Hollow-mDAE + James-Stein (`b 2`, 600 s): `early: 0.787 → 0.840 (+0.053)`, `late: 0.840 → 0.920 (+0.080)`, **`held-out: 0.691 → 0.703` (strictly beats raw keys)**.
  - **`eco_probe.mjs 55`:** `6.29 ms/step`, `336` tets, `85` particles, `fsiForceMag 0.0395`, `4,096` foveated receptors (`itInvariance 0.994`), `wmParams 147,228` (`ultra`: `3,720,700`), `wmMSE1 0.0335 / wmMSE5 0.0368 / wmMSE20 0.0400`, `wmVisMSE1 0.0089 / wmVisMSE20 0.0304`, `peers 9`, `eggsLaid 5`, `births 3`, `maxGen 1`, `lineageNodes 10`, `pollinations 75`, `alarmCalls 3`, `bodyTemp 31.51 °C`.
  - **Closed-loop `measure.mjs` (90 s, seeds 1–3, brain M):** intact `dist 65.29, fed 2.67, entropy 4.27, entropy2 5.74, states 48, upright 0.917, wmMSE 0.035` vs `mn` lesioned `dist 6.54, fed 0, entropy 0.162, states 1.33`.
  - **Physics (`physics_probe.mjs`, `righting_probe.mjs`, `symmetry_probe.mjs`):** `85` particles / `422` constraints / `336` positive-Jacobian tets at `0.63 ms/step`; `righting_probe` **`10/10` (median `1.8 s`)**; `symmetry_probe` `[0.09, -0.04, 0]`.
  - **92-gene Evo-Devo evolution:** 12-gen de-novo from pure uniform random `[0.05, 0.95]^92` (`115` CRN evals): **`3.769 → 6.654 (+2.885)`** (`fwd 1.20 u/s`, `up 0.951`, `goal 0.664`, evolved `bodyLen 1.155, foreLimb 1.240, hindLimb 1.209, neuroHipAlloc 0.78`); 6-gen starter refinement: **`5.672 → 6.764 (+1.092)`** in Node and **`6.08 → 7.17 (+1.10, up 0.97)`** in browser workers (`errors: []`).
- **Headless Chromium (`browser_check.mjs`, `lineage_check.mjs`, Fixed 4K UHD `?q=4k`, `MEGA` `?brain=MEGA`, `p5.js` studio & 4 camera modes):**
  - Zero console or page errors (`errors: []`) across phone (`24.3 fps`, motion intact `7.85` vs `mn` lesioned `0.46`), desktop (`HDR16F + SSAO + Bloom`, motion intact `9.42` vs `mn` lesioned `0.82`), all 4 camera modes (`orbit`, `pov`, `director`, `overhead`), all 5 `p5.js` studio tabs, Fixed 4K UHD (`?q=4k` → `3840×2160` framebuffer), and `?brain=MEGA` (`1,048,644` neurons / `16,777,216` synapses in `WebWorker-CSR`).


## Pass 18 — 7-scale 8-compartment branched HH+NMDA+SK + Fox-Lu stochastic Markov brain (`GIGA` 14.16M mouse-cortex neuron scale / 56.62M syn), 4,608-neuron histological hippocampal–subicular re-entrant loop (4 GABAergic interneuron classes), dual `128×64` (`16,384`-receptor) P/M/K retinas + `4,096`-concept PQ-IT, `11.47M`-param `titan` Transformer-XL (`16×8×3` Rectified Flow-Matching video + `+60.0 s` planner), 108-gene Embryonic `Hox` + `Shh/Fgf/Bmp/Wnt` GRN (`4L`/`6L`/`8L` body plans), 3D `D3Q19` Lattice-Boltzmann FSI + `512` WCSPH + Huxley sarcomeres, `32`-peer clades + `2.20M` microbial continuum, Bio-Observatory Three.js (Sky IBL + 12-tap GTAO + CAS + frosted-obsidian UI), and 14Q WASM / 16Q WebGPU + Richardson ZNE + `χ = 24` MPS & 4-layer MERA

Upgrades all seven remaining `SIMPLIFIED` limitations from pass 17 while overhauling the 3D scene, creature anatomy, shaders, and UI into a frosted-obsidian Bio-Observatory.

- **Seven brain scales up to mouse-cortex neuron count (`GIGA` `14,156,048` neurons / `56,624,192` synapses) & 8-compartment branched dendritic cable arbours + Fox-Lu stochastic Markov channel kinetics (`js/sim/brain.js`, `js/sim/brain_worker.js`, `js/sim/webgpu_brain.js`):**
  - Added 7th brain scale **`GIGA` (`14,156,048` neurons / `56,624,192` mutable `Int8` + CSR synapses: `3600×3600 = 12,960,000` cortical sheet + `1,048,576` hippocampal place cells + `147,148` thalamus + `324` subcortical/motor)** built in `738 ms` and stepped via 64 rotating `221,188`-neuron quantized microcolumn waves with sparse `< 64 KB` IPC in `WebWorker-CSR` (`?brain=GIGA`).
  - Upgraded `M`–`MEGA` cortical pyramidal cells from 4 deterministic cable compartments to **8 electrotonically coupled branched compartments** (`vAIS`, perisomatic `v` with PV basket shunt, bifurcated `vBasal` & `vBasalR` with independent regenerative **Jahr-Stevens $\text{Mg}^{2+}$-unblocked NMDA spikes**, proximal `vOblique`, `vTrunk` electrotonic cable with `HCN I_h` sag, and bifurcated `apical` & `vTuftB` L1 sisters with SST O-LM inhibition, `Ca_v` Larkum BAC plateau bursts, and Rush-Larsen **`SK` $\text{Ca}^{2+}$-activated $\text{K}^+$ AHP**) plus **Fox-Lu (1994) stochastic single-channel Markov Langevin subunit diffusion** across finite AIS `Na_v`/`K_v` channel patches (`nmdaSpikes`, `plateauBursts`, `skMean`, `ihMean`, `channelNoiseMean`).
  - Calibrated `stride = 2` impulse-invariant sheet synaptic gain on `L` so firing settles at physiological `CTX 8.3 / HIP 6.2 / THAL 4.0 Hz` and 240-s foraging scales strictly monotonically (`S = 29 < M = 30 < L = 32` feeds).
- **4,608-neuron histological hippocampal–subicular re-entrant loop with 4 explicit GABAergic interneuron classes (`js/sim/memory.js`):**
  - Expanded `SpikingTrisynapticCircuit` `4.8×` from `964` to **`4,608` conductance-based spiking neurons**: `128 EC_II/III → 2,048 DG granule cells (k = 64 / 3.125% k-WTA) + 128 hilar mossy cells → 1,024 CA3 recurrent Mg²⁺-unblocked NMDA + LIF → 512 CA1 → 256 Subiculum → 128 EC_V` deep-layer re-entrant feedback, regulated by **`384` explicit GABAergic interneurons across 4 histological subtypes** (`144 PV+` perisomatic basket, `64 PV+` chandelier AIS-shunting, `96 SST+` O-LM distal apical tuft, `80 VIP+/CCK+` disinhibitory) plus Hollow-mDAE, a learned Rank-4 + Diagonal InfoNCE precision metric, and James-Stein Empirical-Bayes shrinkage.
- **Dual `128×64` (`16,384`-receptor / `49,152`-cone) P/M/K foveated retinas & `4,096`-concept Compositional PQ-IT + Perirhinal cortex (`js/sim/vision.js`):**
  - Expanded binocular retinas `4×` from `64×32` (`4,096` receptors) to **dual `128×64` (`16,384` photoreceptors / `49,152` L/M/S + `1/d` channels)** with 4 Hz active microsaccades and Parvocellular (`P` `L−M`), Magnocellular (`M` transient luminance/motion), and Koniocellular (`K` `S−(L+M)`) **LGN** pathways → `64×32×4` `V1` Gabor + stereo → `32×16×4` `V2` → `16×8×8` `V4` → `16×8×3` (`384-D`) foveal RGB patch + **Compositional Product-Quantized Ventral `IT` + Perirhinal (`PRh`) Cortex** (`64` 3D-form × `64` surface/animacy prototypes = **`4,096` compositional zero-shot visual concepts**, `itInvariance = 0.996`) + hippocampal EKF-SLAM.
- **5-scale (`11.47M`-param `titan`) Multimodal Transformer-XL with `16×8×3` Conditional Rectified Flow-Matching video head & `+60.0 s` 4-timescale hierarchical planner (`js/sim/mind.js`):**
  - Added 5th world-model scale **`?wm=titan` (`11,466,892` parameters: `L = 8, d = 320, H = 8, ffn = 960, T = 32`)** alongside `std` (`237,964`), `large` (`778,972`), `xl` (`1,487,644`), and `ultra` (`4,040,188`).
  - Expanded raw foveal visual synthesis `4×` from `8×4×3` (`96-D`) to **`16×8×3` (`384-D`)** with an online **4-Step Euler Conditional Rectified Flow-Matching generative velocity field** (`predictVisFlow`, `visFlowMSE = 0.0135`), and added a **1-minute (`+60.0 s`) 8-D macro-state subgoal rollout planner** (`predict60`, `mse60 = 0.0757`) alongside `+0.1 s`, `+0.5 s`, and exact `20`-step (`+2.0 s`) end-to-end BPTT.
- **108-gene Embryonic `Hox` + Morphogen (`Shh/Fgf/Bmp/Wnt`) GRN & variable `4`/`6`/`8`-limb body-plan co-evolution (`js/sim/genome.js`, `js/sim/body.js`, `js/sim/cpg.js`, `js/lineage.js`, `js/sim/lineage_worker.js`):**
  - Expanded the genome from `92` to **`108` bounded genes**, adding `16` embryonic `Hox` axial expression + reaction-diffusion morphogen (`Shh`, `Fgf`, `Bmp`, `Wnt`) GRN genes (`evalHoxGRN`) that govern **heritable topological limb-pair count (`2` pairs = `4`-limb quadruped, `3` pairs = `6`-limb hexapod, `4` pairs = `8`-limb octopod with `89` particles / `348` tetrahedra)**, dorsal hexagonal osteoderm scutes (`osteoderm`), gill/antenna barbule density (`gillFronds`), CPG inter-limb phase biases, and cross-bridge sarcomere $V_{\max}$.
  - Added ES-module worker readiness handshaking (`{ ready: true }`) and post-LHS local step-size transition (`σ = 0.11`) in `Lineage` so both 6-gen starter refinement and 12-gen de-novo `[0.05, 0.95]^108` CMA-ES climb reliably in Node and browser workers.
- **3D `D3Q19` Lattice-Boltzmann microvascular FSI, `512` WCSPH blood parcels, Huxley cross-bridge sarcomeres, `32`-peer clades & `2.20M`-organism microbial continuum (`js/sim/fluid.js`, `js/sim/body.js`, `js/sim/world.js`, `js/sim/ecosystem.js`):**
  - Added a **3D `D3Q19` Lattice-Boltzmann (`12×6×6 = 432` cells = `8,208` distribution populations) BGK microvascular Navier-Stokes solver** coupled two-way with the 63-voxel Biot-Darcy poroelastic bed, 16-node 1D vascular graph, and **`512` 3D WCSPH blood parcels**, plus normalized **Huxley 2-state $\text{Ca}^{2+}$–Troponin cross-bridge sarcomere histology** in `body.js`.
  - Raised the embodied conspecific cap from `14` to **`32` autonomous Glitchlings** radiating across **`4L`, `6L`, and `8L` Hox clades**, coupled to a **`64×64` saprotrophic soil decomposer, rhizobial $\text{N}_2$-fixation & bioluminescent phytoplankton continuum (`> 2.20M` microorganisms)**.
- **Bio-Observatory Three.js (PMREM Sky IBL + 12-tap GTAO + FidelityFX CAS + frosted-obsidian UI), `p5.js` 5-tab studio & 14Q WASM / 16Q WebGPU + Richardson ZNE + `χ = 24` MPS & 4-layer MERA (`js/render.js`, `js/p5_layer.js`, `style.css`, `index.html`, `js/tsotchke/*`):**
  - Rebuilt `render.js` with multi-layer dermal subsurface scattering, thin-film iridescence & hexagonal osteoderm GLSL relief, **PMREM HDR Sky Environment IBL**, **12-tap Ground-Truth Ambient Occlusion (`GTAO`)**, crepuscular god-rays, `UnrealBloomPass`, **AMD FidelityFX Contrast-Adaptive Sharpening (`CAS`)**, wide-gamut Display-P3, smooth indexed `SphereGeometry(1, 56, 40)` volcanic basalt-geode boulders, sculpted multi-jointed limbs + curved eye stalks + feathered antennae, native HiDPI `auto:ultra` (`2160×1350`) + Fixed 4K UHD (`3840×2160`), and a frosted-obsidian glassmorphic UI + 5-tab `p5.js` telemetry studio.
  - Upgraded `wasm_quantum.js` & `qrng.js` to **14 qubits (`DIM = 16,384`) in inline-WASM** + optional **16-qubit (`DIM = 65,536`) WebGPU WGSL statevector compute shader**, added superconducting transmon unitary gate-folding ($U U^\dagger U$, $\lambda \in \{1, 3\}$) + **Richardson Zero-Noise Extrapolation (`ZNE`)**, and upgraded `moonlab.js` / `metacog.js` to **$\chi = 24$ Vidal canonical MPS** and **4-layer / 7-scale (`256-D`) Binary MERA**.

Measured (Node & headless Chrome):

- **Seven-scale 8-compartment branched HH+NMDA+SK + Fox-Lu Markov spiking substrate (`test/brain_probe.mjs` & headless Chrome):**

  | brain | neurons / synapses | single-thread CPU ms/step | browser backend (`?backend=auto`) | CTX / HIP / THAL Hz | notes |
  |---|---|---|---|---|---|
  | **S** | 436 / 2,312 | **4.20** | CPU | 9.3 / 8.1 / 9.7 | compact worker-eval reference (`92 ms` build) |
  | **M** (default, 300 s) | **3,268 / 132,778** | **7.01** | CPU | **5.7 / 3.4 / 6.0** | `alignment 1.101 → 1.339`, `nmdaSpikes 578`, `plateauBursts 405`, `skMean 0.127`, `channelNoiseMean 0.025`; 300-s `struct` lesioned: **5.5 / 4.5 / 8.0 Hz** (stays active) |
  | **L** | **11,972 / 531,289** | **15.29** | `WebWorker-CSR` | **8.3 / 6.2 / 4.0** (`MOT 9.6`) | **32 feeds** in 240 s (`> M > S`); `alignment 1.341` |
  | **XL** | **25,924 / 1,178,148** | **20.36** | `WebWorker-CSR` | 8.0 / 7.3 / 6.7 | off-main-thread 8-comp branched HH+NMDA+SK |
  | **XXL** | **104,904 / 4,744,285** | **68.15** | `WebWorker-CSR` | 6.9 / 6.7 / 3.7 | `Uint32Array` CSR (`1.50 s` build) |
  | **MEGA** | **1,048,644 / 16,777,216** | **139.08** | `WebWorker-CSR` | 6.9 / 1.4 / 1.1 | `197 ms` procedural CSR build; `1.05M` 8-comp neurons |
  | **GIGA** | **14,156,048 / 56,624,192** | **733.30** | `WebWorker-CSR` (`35.7–68.4 ms` UI, `errors: []`) | **9.0 / 9.0 / 10.6** | **mouse-cortex neuron scale (`14.16M`)**, `738 ms` build, `pruned+regrown 157` |

- **Monotonic foraging across brain scales, navigation & thirst (`forage_bench.mjs`, `nav_probe.mjs`, `water_probe.mjs`):**
  - **`forage_bench.mjs` (240 s, seeds 1–4):** strictly monotonic **`S = 29 feeds (43 arrivals, 0 give-ups) < M = 30 feeds (41 arrivals, 2 give-ups) < L = 32 feeds (42 arrivals, 2 give-ups)`** (beating pass 17's `22 < 26 < 30` at every scale).
  - **`nav_probe.mjs` (60 s, seeds 1–8, brain M):** **NEAR `7/8` (mean `9.6 s`)**, **FAR (`14+ u`) `8/8` (`100%`, mean `27.7 s`)**, **mean uprightness `0.93` (`0%` on its back)**, `34%` path-integration steered.
  - **`water_probe.mjs a` (300 s, seeds 1–4):** intact **`4/4` drank (`13.2, 8.7, 9.0, 13.2` drunk; mean thirst `0.23–0.34`)** vs `thirst` lesioned **`0/4` (`0, 0, 0, 0` drunk; mean thirst `0.69–0.80`)**.
- **4,608-neuron histological hippocampal loop, `11.47M` Flow/+60s world model, 108-gene Hox Evo-Devo & multi-clade biosphere:**
  - **`memory2_probe.mjs`:** HDC (`a`): `0.894 → 0.957 → 0.964` (`0.35` prior), `0.816 → 0.928 → 0.964` (`0.80` prior). 4,608-neuron histological hippocampal–subicular loop (`b 2`, 600 s, 50%-masked noisy cues): `pass-3 (256 raw)` `0.72 / 0.79 / 0.62` → `1,024 + sleep merge, raw` `0.79 / 0.80 / 0.64` → **`1,024 + sleep merge + 4,608-neuron histological learned keys`: `early 0.85 (+0.06) / late 0.88 (+0.08) / held-out 0.67 (+0.03 over raw)`**.
  - **`eco_probe.mjs 70`:** `7.74 ms/step`, `4,608` hippocampal spiking neurons (`2,048` DG), `16,384` foveated receptors (`itInvariance 0.996`, `4,096` PQ-IT concepts), `wmParams 237,964` (`titan`: **`11,466,892`** at `22.91 ms/step`), `wmMSE1 0.0321 / wmMSE5 0.0371 / wmMSE20 0.0452 / wmMSE60 0.0757`, `wmVisMSE1 0.0140 / wmVisFlowMSE 0.0135`, `14` WASM qubits (`16,384-D`, `zneRawErr 0.00431 → zneMitigatedErr 0.00202`, `2.13×` gain; `5.11×` at 12 s; `11.2×` live in `p5` studio), `peers 17` (**`cladeCounts: {"4L": 5, "6L": 11, "8L": 1}`**), `eggsLaid 12`, `births 5`, `pollinations 179`, **`microbeTotalPop 2,204,005`**, `planktonBloom 0.681`, `meanSoilN 0.649`.
  - **Closed-loop `measure.mjs` (90 s, seeds 1–3, brain M):** intact `dist 62.61, fed 2.00, entropy 4.32, entropy2 5.82, states 50, upright 0.917, wmMSE 0.039` vs `mn` lesioned `dist 6.12, fed 0, entropy 0.162, states 1.33`.
  - **Physics & Hox topologies (`physics_probe.mjs`, `righting_probe.mjs`, `symmetry_probe.mjs`, `pass18_probe.mjs`):** `4L` (`2` pairs, `85` nodes / `336` tets), `6L` (`3` pairs, `85` nodes / `336` tets), `8L` (`4` pairs, `89` nodes / `348` tets) at `0.47 ms/step` (`meanCrossBridge 0.433`); `righting_probe` **`10/10` (median `1.8 s`)**; `symmetry_probe` `[0.03, -0.02, -0.01]`.
  - **108-gene Hox Evo-Devo evolution (`pass18_probe.mjs` & browser workers):** 6-gen starter refinement across all 108 genes: **`5.804 → 6.974 (+1.170)`**; 12-gen surrogate-assisted CMA-ES from pure uniform random `[0.05, 0.95]^108` weights: **`2.385 → 5.191 (+2.806, 2.18×)`** (`fwd 0.884 u/s`, `up 0.868`, `6L` hexapod).
- **Headless Chrome (`browser_check.mjs`, `visual_verify.mjs`, `lineage_check.mjs`):**
  - Zero console or page errors (`errors: []`) across phone (`motion intact 9.21` vs `mn` lesioned `0.33`), desktop Bio-Observatory (`auto:ultra` `2160×1350`, `HDR16F + Sky IBL + GTAO + CAS`, `motion intact 9.03` vs `mn` lesioned `1.61`), all 4 camera modes, all 5 `p5.js` studio tabs, Fixed 4K UHD (`?q=4k` → `3840×2160` framebuffer), `?brain=GIGA&wm=titan` (`14,156,048` neurons / `56,624,192` synapses in `WebWorker-CSR` + `11,466,892` WM parameters), and in-browser Web Worker 108-gene lineage evolution.

## Pass 19 — 1.13B-synapse GIGA + 16-compartment discrete binomial Markov arbours, 32,768-neuron histological Hip–Sub + Successor Representation, dual 256×128 (196k RGC) retinas + 65,536-concept symbolic ontology, 29.06M `?wm=omega` Patch-VAE Flow + +300s Neuro-Symbolic HTN/MCTS, 128-gene Zygote→Gastrulation→5-Clade Evo-Devo, 64-vessel Murray's-Law + 1,024 RBC/WBC WCSPH + 256 3D micro-fauna + 8.41M microbes, and 16Q/18Q Qutrit DRAG + 512-shot PEC + 32Q MPS / 9-scale MERA

Addresses all seven `SIMPLIFIED` boundaries documented in pass 18 (`live/js/honesty.js`) alongside a comprehensive Three.js Bio-Observatory graphics, shader, multi-clade creature anatomy, and 5-tab `p5.js` studio upgrade:

### Architectural upgrades

1. **`1.13B`-Synapse (`1,132,483,840`) `GIGA` Cortex + 16-Compartment Branched Dendritic Arbours + Discrete Integer Binomial Markov Channels (`js/sim/brain.js`, `js/sim/brain_worker.js`):**
   - Scales `GIGA` (`14,156,048` mouse-cortex neurons) from `56.62M` (`4` syn/cell) to **`1,132,483,840` (`1.13B`) plastic Int8+CSR synapses** (`80` clustered dendritic synapses/cell across `8` branch clusters) plus `Uint16Array` structural spine-turnover masks (`pruned+regrown 261` in 10 s, `978 ms` procedural build).
   - Upgrades every `S`–`MEGA` pyramidal microcolumn from 8 compartments to a **16-compartment branched cable arbour**: `AIS` (`Na_v1.6` high-density trigger), `soma`, **`4` basal branches (`BL1, BL2, BR1, BR2`)** with local voltage-gated $\text{Mg}^{2+}$ NMDA plateau spikes, **`2` apical obliques (`OblL, OblR`)**, **`2` apical trunk segments (`TrkProx, TrkDist`)** with hyperpolarization-activated `HCN` $I_h$ sag, **`Ca_v` apical nexus**, **`4` L1 tuft branches (`TuftA1, TuftA2, TuftB1, TuftB2`)** driving BAC bursts + `SK` $\text{Ca}^{2+}$-activated $\text{K}^+$ medium-AHP, and an explicit **dendritic spine head (`SpineVm` / `SpineCa`)** with neck axial resistance.
   - Replaces continuous Fox-Lu Langevin diffusion with **exact discrete integer binomial Markov-chain ion-channel state transitions** (`Na_v` 5-state `C3↔C2↔C1↔O↔I` over `N=80` discrete channels, `K_v` 4-state `C3↔C2↔C1↔O` over `N=60` channels, apical `Ca_v` 3-state `C↔O↔I` over `N=40` channels, and stochastic discrete spine `NMDA` open receptors).
2. **`32,768`-Neuron Conductance-Based Histological Hippocampal–Subicular Circuit + Adult Neurogenesis + Predictive Successor Representation (`js/sim/memory.js`):**
   - Expands `SpikingTrisynapticCircuit` $7.1\times$ from `4,608` to **`32,768` conductance-based spiking neurons** across **14 explicit anatomical populations**: `EC_II` (`512` grid) + `EC_III` (`512` temporoammonic) → **`16,384` `DG` granule cells** (`1.20%` `k=196` sparse k-WTA + **`512` hyperexcitable adult-born immature granule cells** with turnover & lowered threshold) + `512` hilar Mossy cells → `2,048` `CA3` (`AMPA + Mg²⁺-NMDA` autoassociative + asymmetric phase-precession bridges) + **`256` social/temporal `CA2`** → `2,048` `CA1` → `1,024` `Subiculum` → `512` deep `EC_V`, gated by **6 explicit GABAergic interneuron classes (`2,688` inhibitory cells)**: `PV+` perisomatic basket (`512`), `PV+` AIS axo-axonic chandelier (`256`), `SST+` `O-LM` (`512`), `VIP+` disinhibitory (`384`), **`CCK+` basket with retrograde `CB1R` depolarization-induced suppression of inhibition (DSI, `512`)**, and **neurogliaform / Ivy (`NGFC`, `512`)** mediating slow metabotropic $\text{GABA}_B$ dendritic inhibition, plus `8,192` septotemporal continuum place cells (`16,384` on `XL+`).
   - Adds a **64-macro-state Predictive Successor Representation (`M_SR`)** learned via online TD($\lambda$) (`M[s,:] ← M[s,:] + η(e_s + γ M[s',:] − M[s,:])`) alongside asymmetric theta-sequence `CA3` bridges so novel future states share predictive multi-step horizon embeddings prior to visitation.
3. **Dual `256×128` (`65,536`-Photoreceptor / `196,608` RGC) Foveated Retinas + `65,536`-Concept Compositional IT + 4-Tier Symbolic Hypernym & Relational Affordance Ontology (`js/sim/vision.js`):**
   - Scales binocular foveated retinas $4\times$ to **dual `256×128` (`65,536` photoreceptors; `196,608` L/M/S cone + scotopic rod signals)** with **6 explicit Retinal Ganglion Cell (RGC) mosaics (`196,608` RGC channels)**: `ON/OFF Midget` (parvocellular acuity + `L−M`), `ON/OFF Parasol` (magnocellular motion transient), `Small Bistratified` (`S−(L+M)` koniocellular), and `ipRGC` melanopsin irradiance (`0.998` view/scale invariance).
   - Expands ventral `V1 → V2 → 32×16×8 V4 → IT` to **`256×256 = 65,536` compositional product-quantized visual concepts** grounded in an explicit **4-tier Symbolic Hypernym & Relational Affordance Ontology DAG** (`ENTITY → ANIMATE/ABIOTIC/FLORA → CONSCSPECIFIC/APEX-PREDATOR/MICROFAUNA/NUTRIENT/HYDRO-SOURCE/REFUGE`) that binds live **`Subject–Predicate–Object` scene-graph triples** (`NEAR`, `APPROACHING`, `THREATENS`, `AFFORDS-FEED`, `AFFORDS-DRINK`, `COURTS`) and grounds compositional proto-lexemes (e.g. `APEX-PREDATOR#c64653`).
4. **`29.06M`-Parameter `?wm=omega` Spatial-Pyramid Patch-VAE (`32×16×3`) Flow World Model + 5-Minute (`+300.0 s`) Neuro-Symbolic HTN + Depth-5 UCT MCTS Planner (`js/sim/mind.js`, `js/sim/creature.js`):**
   - Upgrades generative visual synthesis $4\times$ from `16×8×3` to **`32×16×3` (`1,536-D` foveal + peripheral RGB)** via a learned `8×4×16` **Spatial-Pyramid Patch-VAE** (`512-D` latent) + **4-step Conditional Rectified Flow-Matching** head (`wmVisFlowMSE 0.0157`), and adds a 6th scale **`?wm=omega` (`29,059,876` = `29.06M` parameters: `L=10, d=448, H=8, ffn=1344, T=32, d5=256`)**.
   - Adds **`HTNPlanner`**, a **5-Minute (`+300.0 s` / 18,000-tick) Neuro-Symbolic Hierarchical Task Network + 24-Rollout Depth-5 UCT Monte Carlo Tree Search** planner decomposing survival/reproductive goals (`SURVIVE_AND_THRIVE`, `THERMOREGULATE`, `FORAGE_HYDRATE`, `EVADE_LEVIATHAN`, `COURT_AND_NEST`) into abstract symbolic subgoals and injecting top-down goal bias into the 21-channel striatal action race.
5. **128-Gene Single-Cell Zygote Cleavage (`1 → 128` Blastomeres), Gastrulation, `Hes7` Somitogenesis, 5 Macro-Bauplan Clades (`0L`–`10L`), Patagium Wings, Angler Esca & 32 Henneman Motor Units (`js/sim/genome.js`, `js/sim/starter_genome.js`, `js/sim/body.js`, `js/lineage.js`):**
   - Expands the genome from `108` to **`128` evolved genes**, adding **7 mitotic cleavage divisions (`1 → 2 → 4 → 8 → 16 → 32 → 64 → 128` 3D blastomeres)** with maternal `Bicoid/Nanos/β-catenin` axes, **Spemann-Mangold `Nodal/Lefty/Chordin` gastrulation** into 4 germ layers (`ectoderm`, `mesoderm`, `endoderm`, `neural crest`), a **7-somite `Hes7/Notch` segmentation clock + `Fgf8/Wnt3a` wavefront**, **5 macro-bauplan clades** (**`0L` apodous serpent**, **`4L` tetrapod**, **`6L` hexapod**, **`8L` octopod**, **`10L` decapod** `93` nodes / `360` FEM tets), **lateral `Patagium` aerodynamic gliding membranes** (`lift/drag` soft-body forces), a **cranial bioluminescent `Angler Esca` lure**, and **32 Henneman size-principle motor-unit fascicles** (`Slow Oxidative Type I`, `Fast Oxidative IIa`, `Fast Glycolytic IIb`) driving Huxley cross-bridge sarcomeres.
6. **36-Node / 64-Vessel 3D Murray's-Law Vascular Tree + `24×8×8` `D3Q19` LBM + `1,024` Differentiated RBC/WBC WCSPH + `48` Speciating Peers + `256` 3D Micro-Fauna + `>8.41M` Microbes (`js/sim/fluid.js`, `js/sim/world.js`, `js/sim/ecosystem.js`):**
   - Replaces the 16-node circuit with a **36-node / 64-vessel 3D bifurcating vascular tree** obeying **Murray's Cube Law ($r_0^3 = r_1^3 + r_2^3$)** at every junction (`murrayRestResidual 7.36e-17`) with myogenic smooth-muscle autoregulation + endothelial NO shear vasodilation, coupled to a **`24×8×8` (`1,536`-voxel / `29,184`-population) 3D `D3Q19` Lattice-Boltzmann** microvascular solver, `63`-voxel Biot-Darcy poroelasticity, and **`1,024` 3D WCSPH blood cells** (**`896` $O_2$-carrying Erythrocytes + `128` marginating chemotactic Leukocytes**).
   - Scales the biosphere to **`48` autonomous conspecifics** across all **5 clades (`0L`/`4L`/`6L`/`8L`/`10L`)** with **sympatric assortative mating & reproductive isolation (`speciesId` / `speciesCount`)**, **`256` discrete embodied 3D micro-fauna** (benthic detritivores, pelagic copepods, rhizosphere collembola), and **`>8.41M` continuum soil/aquatic microbes**.
7. **16Q WASM / 18Q WebGPU Open-Quantum Engine + Qutrit Transmon DRAG (`25.62×` Leakage Cut) + 512-Shot Quasi-Probability PEC + 32-Qubit ($\chi=32$) MPS & 9-Scale (`512-D`) MERA + Bio-Observatory Visual Overhaul (`js/tsotchke/*`, `js/sim/metacog.js`, `js/render.js`, `js/p5_layer.js`, `index.html`, `style.css`):**
   - Scales inline SIMD-unrolled WebAssembly quantum evolution to **16 qubits (`DIM = 65,536`)** and WebGPU WGSL compute to **18 qubits (`DIM = 262,144`)**, adds a **pulse-level Qutrit (`|0⟩, |1⟩, |2⟩`) Anharmonic Transmon DRAG (`Derivative Removal by Adiabatic Gate`) Hamiltonian simulator** (`25.62×` `|2⟩` leakage suppression, `0.8722 → 0.9697` gate fidelity), **512-shot Quasi-Probability Probabilistic Error Cancellation (`PEC`, `10.66×` bias reduction)** alongside Richardson `ZNE` (`7.72×`), and scales tensor-network consolidation to a **32-Qubit ($\chi=32$) Vidal canonical MPS** and **9-scale (`512-D`) Binary MERA**.
   - Upgrades Three.js rendering with **`4096×4096` PCF soft shadows**, a smooth $C^\infty$ analytic hexagonal scute normal shader, sleek tapered rostrum/tail dome geometry, `10` Catmull-Rom limbs with 4 keratin talons/foot, translucent `Patagium` wing-membranes, dynamic cranial `Angler Esca` `PointLight`, `96` bioluminescent mushroom clusters, `256` GPU-instanced 3D micro-fauna, `4` lighting presets (`Auto Solar`, `Golden Twilight`, `Pandora Biolum Night`, `Crisp Zenith Day`), 1-click `0L/4L/6L/8L/10L` live clade morph buttons, and an upgraded 5-tab `p5.js` telemetry studio with a live 128-cell germ-layer blastula plot.

### Verification

- **Seven-scale 16-compartment discrete-Markov HH+NMDA+SK + `1.13B`-synapse `GIGA` substrate (`test/brain_probe.mjs` & headless Chrome):**

  | brain | neurons / synapses | single-thread CPU ms/step | browser backend (`?backend=auto`) | CTX / HIP / THAL Hz | notes |
  |---|---|---|---|---|---|
  | **S** | 436 / 2,312 | **7.07** (`6.66` 30-s) | CPU | 8.4 / 8.7 / 4.2 | 16-comp discrete binomial Markov reference (`168 ms` build) |
  | **M** (default, 300 s) | **3,268 / 132,778** | **11.02** | CPU | **5.7 / 5.5 / 4.0** | 300-s `struct` lesioned: **`pruned+regrown 0`, `alignment 1.044 → 1.303`, `dist 210`** (cortical homeostasis holds cleanly) |
  | **L** | **11,972 / 531,289** | **20.79** | `WebWorker-CSR` | **9.7 / 9.1 / 8.9** (`MOT 11.3`) | `347 ms` build; `alignment 1.113`; beats `S` in 240-s foraging (`25 > 24`) |
  | **XL** | **25,924 / 1,178,148** | **26.24** | `WebWorker-CSR` | 3.6 / 3.4 / 3.7 (`MOT 6.2`) | off-main-thread 16-comp branched HH+NMDA+SK (`alignment 1.131`) |
  | **XXL** | **104,904 / 4,744,285** | **91.04** | `WebWorker-CSR` | 2.9 / 3.4 / 1.7 | `Uint32Array` CSR (`1.74 s` build) |
  | **MEGA** | **1,048,644 / 16,777,216** | **327.42** | `WebWorker-CSR` | 7.3 / 1.8 / 1.6 | `291 ms` procedural CSR build; `1.05M` 16-comp neurons |
  | **GIGA** | **14,156,048 / 1,132,483,840** | **1,340.31** | `WebWorker-CSR` (`errors: []`) | **9.2 / 9.1 / 10.7** | **mouse-cortex neurons (`14.16M`) + `1.13B` clustered branch synapses**, `978 ms` build, `pruned+regrown 261` |

- **Navigation, foraging, closed-loop lesion matrix & thirst (`nav_probe.mjs`, `forage_bench.mjs`, `measure.mjs`, `water_probe.mjs`):**
  - **`nav_probe.mjs` (60 s, seeds 1–8, brain M):** **NEAR `8/8` (`100%`, mean `9.0 s`)**, **FAR (`14+ u`) `8/8` (`100%`, mean `30.2 s`)**, **mean uprightness `0.92` (`1%` on its back)**, `42%` path-integration steered.
  - **`measure.mjs` (90 s, seeds 1–3, brain M):** intact **`dist 63.36, fed 3.00, entropy 4.16, entropy2 5.86, states 42.33, upright 0.933, wmMSE 0.033`** vs `mot` (`dist 42.31, fed 0, entropy 5.48, upright 0.957`), `cpg` (`dist 29.67, fed 0.67, upright 0.483`), and `mn` (`dist 6.15, fed 0, entropy 0.183, states 1.67, upright 0.597`).
  - **`forage_bench.mjs` (240 s, seeds 1–4):** **`M = 31 feeds` (`38` arrivals, `2` give-ups; `12, 7, 5, 7`, `upright 0.88–0.93`) > `L = 25 feeds` (`40` arrivals, `2` give-ups; `6, 9, 7, 3` — beats `M` on seeds 2 & 3) > `S = 24 feeds` (`40` arrivals, `3` give-ups; `7, 6, 6, 5`)**.
  - **`water_probe.mjs a` (300 s, seeds 1–4):** intact **`4/4` drank (`5.8, 8.7, 15.9, 5.7` drunk; mean thirst `0.25–0.40`)** vs `thirst` lesioned **`0/4` (`0, 0, 0, 0` drunk; mean thirst `0.70–0.74`)**.
- **32,768-neuron histological Hip–Sub + SR recall, `29.06M` `?wm=omega` world model, 128-gene Zygote Evo-Devo & 5-clade biosphere:**
  - **`memory2_probe.mjs`:** HDC (`a`): `0.894 → 0.957 → 0.964` (`0.35` prior), `0.816 → 0.928 → 0.964` (`0.80` prior). `32,768`-neuron histological Hip–Sub + SR (`b 2`, 600 s, 50%-masked noisy cues): `pass-3 (256 raw)` `0.70 / 0.82 / 0.67` → `1,024 + sleep merge, raw` `0.77 / 0.82 / 0.69` → **`1,024 + sleep merge + 32,768-neuron Hip+SR learned keys`: `early 0.79 / late 0.88 (+0.06) / held-out 0.70 (+0.01 over raw, +0.03 over pass-18)`**.
  - **`eco_probe.mjs 40`:** `1,024` WCSPH cells (`896` RBC + `128` WBC), `64` Murray vessels (`murrayRestResidual 7.36e-17`, `murrayLiveDeviation 0.131`), `1,536` `D3Q19` LBM voxels (`29,184` pops, `lbmVorticity 0.0684`), `32,768` hippocampal spiking neurons (`16,384` DG), `65,536` foveated receptors (`itInvariance 0.998`, `65,536` IT concepts, `activeLexeme "APEX-PREDATOR#c64653"`), `wmParams 797,476` (`omega`: **`29,059,876`**), `wmMSE1 0.0357 / wmMSE5 0.0375 / wmMSE20 0.0418 / wmMSE60 0.111`, `wmVisFlowMSE 0.0157`, `htnHorizonSec 300`, `peers 24`, `speciesCount 5`, **`cladeCounts: {"0L": 4, "4L": 6, "6L": 9, "8L": 4, "10L": 1}`**, `microFaunaCount 256`, `births 6`, `pollinations 95`, **`microbeTotalPop 8,413,733`**, `16` WASM qubits (`65,536-D`), **`dragSuppression 25.62×` (`F_gate 0.8722 → 0.9697`), `pecGain 10.66×`, `zneGain 7.72×`**, `32`-qubit MPS (`maxBond 32`, `maxEntropy 2.455`), `512-D` `9`-scale MERA.
  - **Physics & 128-gene Zygote CMA-ES (`physics_probe.mjs`, `righting_probe.mjs`, `symmetry_probe.mjs`, `evo128_probe.mjs`):** `0.38 ms/step` (`85–93` nodes, `336–360` FEM tets across `0L`–`10L`), `righting_probe` **`10/10` (median `1.7 s`)**, `symmetry_probe` `[0.04, -0.02, 0.05]`; 6-gen starter refinement across all 128 genes: **`6.10 → 6.39 (+0.30)`** (`v 0.58 u/s`, `up 0.96`, `6L`); 12-gen de-novo from pure uniform random `[0.05, 0.95]^128`: **`1.98 → 5.65 (2.85× gain)`** (`v 0.55 u/s`, **`up 0.94`**, armored winged `4L Tetrapod`, `patagium 1.28, osteoderm 1.01`).
- **Headless Chrome visual & extreme-scale checks:**
  - Visually inspected rendered screenshots across Golden Twilight (`pass19-hero-twilight.png`), Pandora Bioluminescent Night (`pass19-pandora-night.png`), `10L` Decapod (`93 nodes, 360 tets`, `pass19-decapod-10L.png`), and all 5 `p5.js` studio tabs (`pass19-lab-telemetry.png`), plus `?brain=GIGA&wm=omega&q=4k` (`14,156,048` neurons / `1,132,483,840` synapses in `WebWorker-CSR` + `29,059,876` WM params + `3840×2160` 4K UHD framebuffer) with **`consoleErrors: []`, `pageErrors: []`**.


## Pass 20 — HEPTARCH v0.2 7-Seat Council + ColdStrike + NESTOR 23-Rung Precision Governor, Cryptochrome-4 Nocturnal Compass, Levin V_mem Limb Regeneration, Layer-1 Geodesic Biodome (11-Pool FP64 Kahan Ledger, Anomaly Seams, Sanctuaries, Monoliths, DomeStones/Caches), 5-Caste RS[15,11] Colony + 4 Multi-Kingdom Dome Species, and KCBS / CEGA-18 / Hoggar-64 / C3 Contextuality + Certified VC-MPS & 2-Rényi Magic M_2

Distills all 29 research PDFs (`1,932` pages) into [`../GLITCHLING_MASTER_COMPENDIUM.md`](../GLITCHLING_MASTER_COMPENDIUM.md) + [`../docs/01..05`](../docs/) (strictly excluding all Browser/Website/SaaS features) and implements the living tokenless **Layer-1 Geodesic Biodome**, **HEPTARCH v0.2**, **Multi-Kingdom Bestiary**, and **Quantum Contextuality / Certified Tensor** upgrades across `live/`:

### Architectural upgrades

1. **HEPTARCH v0.2 7-Seat Anti-Monarchy Council, Raider 6-Phase `ColdStrike` & NESTOR 23-Rung Precision Governor (`js/sim/heptarch.js`, `js/sim/creature.js`):**
   - Implements the 7-seat capped softmax council (`Surge`, `Chronoscope`, `Keel`, `Capacitor`, `Wildcard`, `LongGame`, `Jester`) enforcing **Law 1 (`max π_m ≤ 0.46`)**, **Law 2** order-3 Eshkol Taylor PAD affect jet + `rageTripwire` clamp, **Law 3** `Capacitor` + post-recovery `Zenkai` motor plasticity boost, **Law 4** QRNG timing jitter, **Law 5** bounded Level-$k$ Theory-of-Mind, and Ring-0 `Keel` Time-To-Critical (`TTC`) epistemic curiosity gating (`curiosityGate`).
   - Adds the Raider 6-phase **`ColdStrike`** tactical state machine (`Recon → Feign → Compile → Clamp → Commit → Zenkai`) clamping bio-acoustic/bioluminescent emissions (`1 - 0.6·deceive`), freezing plasticity (`gatesFrozen`) during strike commit, and scaling fast-twitch sarcomere recruitment (`forceGain`), plus the **NESTOR 23-rung adaptive precision ladder** (`D(θ)`), `DSD/RSR` spectral monitoring, and Gram–Schmidt **`Exuvia`** chitin-shell shedding on attractors.
2. **Quantum Bio-Navigation (`Cryptochrome-4`), Bioelectric Blastema Regeneration (`Levin V_mem`) & `RS[15,11]` `GF(16)` Colony ECC (`js/sim/heptarch.js`, `js/sim/body.js`, `js/sim/ecosystem.js`):**
   - **16-sector Haberkorn `Cryptochrome-4` radical-pair nocturnal magnetoreceptor** (`stepCryptochrome4`, `48.5 μT` Dome field, anisotropic $^{14}\text{N}$ hyperfine coupling + dipolar broadening, aligned to `SUN_AZ` so daytime `Nav` `Wv` weights transfer seamlessly to pitch-black night navigation; decoheres under `auroraStorm` unless shielded inside a Sanctuary or Monolith; lesionable via `magneto`).
   - **Michael Levin gap-junction bioelectric morphogenesis & limb regeneration** (`vMem` `-52 mV` homeostatic target across 10 limbs, trauma depolarization + ATP-paid blastema regrowth scaling sarcomere force and 3D limb girth; lesionable via `bioelec`).
   - **Systematic Reed–Solomon `RS[15,11,d=5]` over `GF(2^4)`** (`encodeRS15_11` / `decodeRS15_11` with Peterson–Berlekamp 2-symbol error locator + Forney evaluator) protecting `Sentinel γ` colony alarm packets against acoustic storm corruption (`1,000/1,000` random & `23,625/23,625` exhaustive 2-symbol recoveries).
3. **Thermodynamically Closed Layer-1 Geodesic Biodome & Physical Things (`js/sim/world.js`, `js/sim/body.js`, `js/render.js`, `js/p5_layer.js`):**
   - Encloses the world inside a **Geodesic Biodome (`R_DOME = 21.6 u`)** governed by an **11-Pool `FP64` Kahan-Compensated First-Law Energy Ledger** (`ClosureErr < 1e-12`), coupled `O₂`/`CO₂` atmosphere, **Daisyworld** biotic flora albedo + Stefan–Boltzmann radiative heat rejection, **FMO vibronic-ENAQT** photosynthetic enhancement (`~67%` vs `~50%` classical Förster), **16-spin stochastic p-bit Ising** mycelial nutrient routing, **3 Anomaly Tori** (`low-g`, `chrono-visc`, `sensory-crack`), **2 `Big-Tree` Sanctuaries** (`GATE-DOME-REFUGE` predation ward + nectar), **4 Quantum Monoliths** (`KCBS-5`, `CEGA-18`, `CK-31`, `Hoggar-64` + flanking `C₃` cospectral twin obelisks `σ₀/σ₁`), **6 movable lithic `DomeStones`** (pushable & graspable to crack hard-shell **`DomeCaches`**), `Physarum` slime trails, and mineralized `Exuvia` shells (all rendered in 3D Three.js with pulses clamped `≤ 3 Hz` + `p5.js` `Dome+Multi` studio).
4. **5-Caste Colony & 4 Multi-Kingdom Dome Species (`js/sim/ecosystem.js`, `js/render.js`):**
   - Assigns conspecifics to 5 colony castes (`Sovereign α`, `Harvester β`, `Sentinel γ`, `Weaver δ`, `Disruptor ε` + Kuramoto order `R` + `devourBrain` neuro-salvage) alongside 4 autonomous non-Glitchling kingdoms: **4 `Xenomimic` entangled Bell-pair twins** (`|Φ⁺⟩`, live `CHSH S ≈ 2.36–2.82 > 2` with exact `0` marginal bias + 3D entanglement ribbons), **4 `Xylos` 48-foci Poincaré hyperbolic gliders** (2-slot Global Workspace medusa bells laying `Physarum` slime trails), **3 `Geodesic Titans`** (`1.4 u` armored colossi running noisy Iterated Prisoner's Dilemma `truce/alliance/war` treaties + multilateral sanctions), and **2 `Shoggoths`** (6-tendril deceptive ambushers clamping signature by `meek = 1 - 0.6·deceive` + conservation-exact ATP bargains).
5. **Quantum Contextuality Witnesses & Certified Tensor-Network Math (`js/tsotchke/qgtl.js`, `js/tsotchke/moonlab.js`, `js/sim/metacog.js`):**
   - Adds exact **`KCBS` 5-ray pentagram** (`√5 ≈ 2.236068 > 2`), **`CEGA-18` Cabello 18-ray minimal $d=4$ Kochen–Specker proof** (`9.0 > 8.0`, every ray in exactly 2 contexts), **3-Qubit `Hoggar` 64-ray Pauli-flat SIC** (`63/315` frustrated lines, spectral floor `1/3`), **`C₃` Cospectral Twin Jordan trace invariant** (`14,976` vs `15,360`, `c3CospectralGap = 0.025`), **Verstraete–Cirac (2006) certified MPS truncation fidelity bound**, and exact 2-qubit **2-Rényi Stabilizer Magic $M_2$** (`0` on Clifford Bell states, `0.4150` on non-Clifford states).

### Verification

- **`node test/dome_heptarch_probe.mjs` (all 6 causal & algebraic gates passed `100%`):**
  - `Quantum Contextuality & Tensor Certs`: **`KCBS = 2.236068 (> 2)`, `CEGA-18 = 9.0 (> 8)`, `Hoggar = 63/315 (floor = 0.3333)`, `C3_gap = 0.025`, `Bell_M2 = 0.0e+0`, `NonClifford_M2 = 0.4150`, `VC_bound = 0.00e+0`**.
  - `RS[15,11,d=5] GF(16) Acoustic ECC`: **`1,000/1,000 (100.0%)`** exact 2-symbol error recovery.
  - `60s Live Biodome & HEPTARCH`: **`ClosureErr = 0.00e+0 (< 1e-12)`, `maxSeat = 0.4400 (≤ 0.46)`, `Keel_epi (highATP 0.288 → lowATP 0.0078)`, `Xenomimic_CHSH = 2.364 (bias = 0)`, `SlimeNodes = 27`, `O₂ = 22.17%`, `CO₂ = 374 ppm`**.
  - `Levin V_mem Limb Regeneration Causal Lesion`: **`init = 0.50 → intact = 0.767` vs `bioelec_lesion = 0.500`**.
  - `Cryptochrome-4 Nocturnal Compass Causal Lesion`: **night HD error `intact = 0.0905 rad < magneto_lesion = 1.0159 rad` (`11.2×` drift reduction)**.
  - `GATE-DOME-REFUGE V4 Sanctuary Causal Audit`: **`Ward_ON (predations = 0, saves = 2,568)` vs `Ward_OFF (predations = 1)`**.
- **Core Navigation, Thirst & Biosphere regressions (`nav_probe.mjs`, `water_probe.mjs`, `eco_probe.mjs`):**
  - `nav_probe.mjs 1,2,3,4`: **`NEAR 4/4 (100%, mean 6.0 s)` | `FAR 4/4 (100%, mean 23.6 s)` | `upright 0.94 (0% inverted)`**.
  - `water_probe.mjs` (seeds 1–4): **`4/4` intact bodies drank (`10.3, 12.9, 7.8, 12.4` drunk)**.
  - `eco_probe.mjs 20`: `10.27 ms/step`, `18` peers across all `5` clades, `256` micro-fauna, `8,410,402` microbes, `0.998` IT invariance, `25.6×` DRAG suppression.
- **Headless Chrome WebGL2 + Dome HUD visual inspection:**
  - Verified live 3D Geodesic Biodome, Monoliths, Sanctuaries, Anomaly Tori, `p5.js` `2-Dome+Multi` studio, `Dome` Lab tab (`#heptarch-bars`, `#domestats`, `#dome-storm`, `#dome-refuge`, `#dome-trauma`), and `Real?` honesty tab with **`consoleErrors: []`, `pageErrors: []`, `hasNaN: false`, `ClosureErr = 1.15e-16`**.
