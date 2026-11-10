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
