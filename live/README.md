# Glitchling v2 · live

A 3D soft-bodied creature simulated in the browser. Every movement comes from spiking neurons, a liquid-time-constant
pattern generator and motor neurons pulling on muscles in a physics body. Nothing is keyframed.

**Open it:** https://0thernes.github.io/glitchling-jam/live/ (phone or desktop, touch or mouse).
The simpler 2D version is at [`../play/`](../play/).

This is a **browser simulation**. All numbers on the page are computed live by the code in `js/sim/`. It makes no
claim of awareness, feelings, sentience or consciousness.

## How it fits together

```
senses (bearing, colour, touch, light)  ─► SENS ─┐
proprioception (spine curvature via Taylor jets,  ├─► 426 spiking LIF neurons (14 reference regions + PROP + MN)
  contacts, tilt, speed)                ─► PROP ─┤      STDP eligibility × dopamine, NREM consolidation, astrocyte gain
interoception (glucose, ghrelin, bladder…) ► INS ─┘
                     STR D1/D2 spike race ── expected free energy (value + info gain − cost − harm) ─► veto ─► goal site
                     MOT (8) ─► LTC pattern generator (24) ─► motor neurons (122, liquid τ) ─► 61 muscle channels
                                                                                 └─► soft body (51 particles, 250+ constraints)
                     selective SSM (32 modes) ─► world model (online NLMS) ─► surprise → LC/NE; REM rollouts → synergy values
metabolism: gut → blood → liver glycogen → fat, ketones, gluconeogenesis, insulin/glucagon/cortisol/ghrelin/leptin, water, waste
sleep: adenosine S + circadian C, WAKE/N1/N2/N3/REM, atonia, NREM replay, REM dreaming
```

## Files

| file | what it does |
|---|---|
| `js/sim/brain.js` | spiking substrate, STDP + third factor, neuromodulators, astrocyte calcium |
| `js/sim/cpg.js` | 24 LTC neurons forming segmental, leg and arm half-centre oscillators |
| `js/sim/body.js` | Verlet soft body, muscles, friction, grip, collisions, Taylor-jet curvature |
| `js/sim/creature.js` | wiring, motor learning, striatal race, veto, eating, flaws, replay, dreams |
| `js/sim/mind.js` | selective SSM, world model, two-process sleep |
| `js/sim/metab.js` | metabolism, hormones, fluids, waste |
| `js/sim/skin.js` | excitable-medium chromatophore sheet |
| `js/render.js` | three.js view (reads the sim, never moves it) |
| `js/honesty.js` | the real-vs-simplified lists shown on the page |
| `js/tsotchke/taylor.js` | port of Eshkol's Taylor-mode AD recurrences (Tsotchke, MIT) |
| `test/*.mjs` | Node probes (physics, steering, lesions) and a headless-Chromium check |

## Tests

```
node test/headless_run.mjs 120          # 2 simulated minutes, prints distance, eats, behaviour entropy
node test/headless_run.mjs 60 mn        # same with every motor neuron lesioned
node test/steer_probe.mjs               # does it close the distance to a goal? (with and without the turn wiring)
node test/gait_probe.mjs                # what the body does mechanically under a test-only travelling wave
CHROME=/path/to/chrome PLAYWRIGHT=/path/to/playwright-core/index.mjs node test/browser_check.mjs http://127.0.0.1:8899/live/ ./shots tag
```

See [CHANGELOG.md](CHANGELOG.md) for each pass and its measured results. Third-party code: three.js r170 (MIT,
`vendor/three/LICENSE`), Taylor recurrences ported from tsotchke/eshkol (MIT, `js/tsotchke/LICENSE-eshkol`).
