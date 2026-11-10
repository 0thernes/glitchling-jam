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

