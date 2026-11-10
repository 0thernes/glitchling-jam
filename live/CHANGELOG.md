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
