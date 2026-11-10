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

## Mechanisms added in passes 2–12

Each one can be switched off from the brain panel ("lesions"). The effect of each, as measured, is in CHANGELOG.md.

| pass | mechanism | what it really does |
|---|---|---|
| 2 | vestibular righting, stance/grip reflex, MOT divisive normalisation, self-model travel cost, inhibition of return | tilt neurons drive the down-side extensors; swing-muscle stretch boosts grip; MOT rates share an inhibitory pool; the race prices sites by learned speed/turn rate; recently visited sites are discounted |
| 3 | HDC/FHRR cognitive maps, modern Hopfield memory | 512-dim phasor maps of where food was found and which places were visited; a 256-slot attractor memory that completes partial cues and seeds REM dreams |
| 4 | two-level predictive coding | 16→8 latent causes learned online; prediction error (ACh-weighted precision) is mixed into the surprise signal that drives locus coeruleus / NE |
| 5 | hormone-tuned Turing skin | Gray-Scott reaction-diffusion whose feed/kill rates follow leptin, cortisol and dopamine; neural activity nucleates spots |
| 6 | use-dependent growth | girth follows leptin; each limb lengthens with its own muscle use and shrinks back without it (bounded 0.85–1.45) |
| 7 | physical skin optics | thin-film (guanine) interference, Fresnel, GGX highlights, translucency and heartbeat capillaries in the shader |
| 8 | thirst vs hunger, cephalic insulin | pools, drinking, probabilistic drive competition, humidity sense + HDC water map; seeing food raises the insulin set point early |
| 9 | front arching reflex, ventral scale lift | turn commands contract front radial muscles; radial activation lowers sideways friction |
| 12 | evolved motor genome, head-direction ring, path integration, grid cells, motor babbling | CMA-ES-evolved developmental genome grows the CPG/MOT→muscle wiring (turning 0.3 → 2.3 rad/s); a 36-unit ring attractor tracks heading, dead reckoning tracks position, sight of a known site resets it; goals beyond 9 units are steered to by vector; 12 s of random synergy babbling calibrates the steering gain |
| 11 | learned / consolidated memory | delta-rule HDC maps (1024-dim) with sleep-time feature resampling; 1024-slot Hopfield store with usage-based forgetting, sleep merging and a contrastively learned key map |

## Files

| file | what it does |
|---|---|
| `js/sim/brain.js` | spiking substrate, STDP + third factor, neuromodulators, astrocyte calcium |
| `js/sim/cpg.js` | 24 LTC neurons forming segmental, leg and arm half-centre oscillators |
| `js/sim/body.js` | Verlet soft body, muscles, friction, grip, collisions, Taylor-jet curvature |
| `js/sim/creature.js` | wiring, motor learning, striatal race, veto, eating, flaws, replay, dreams |
| `js/sim/mind.js` | selective SSM, world model, two-level predictive coding, two-process sleep |
| `js/sim/genome.js` | 44 motor + 17 steering genes and the developmental rules that grow synapses from them |
| `js/sim/starter_genome.js` | the shipped (evolved) genome and how it was found |
| `js/sim/nav.js` | head-direction ring attractor, sun compass, path integration, grid-cell readout |
| `js/sim/memory.js` | hyperdimensional (FHRR) place maps and a modern Hopfield episodic memory |
| `js/sim/metab.js` | metabolism, hormones, fluids, waste |
| `js/sim/skin.js` | excitable-medium chromatophore sheet plus a Gray-Scott pattern layer tuned by hormones |
| `js/sim/world.js` | terrain, plants, snacks, rocks, springs, water pools |
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
node test/forage_bench.mjs 240 1,2,3,4  # feeds, site arrivals, give-ups per seed
node test/measure.mjs                   # distance, behaviour entropy, intact vs MOT/CPG/MN lesions
node test/memory2_probe.mjs a           # HDC held-out regression: superposition vs delta rule vs delta rule + learned features
node test/memory2_probe.mjs b 2         # Hopfield: pass-3 store vs 1024 slots + sleep vs + learned keys, on a real 600-s run
node test/scale_probe.mjs               # forced-turn yaw rates (pass 9); see also righting/memory/pc/turing/growth/water probes
node test/nav_probe.mjs 1,2,3,4 [nav]   # near (4-8 u) vs far (14+ u) site arrival in 60 s; 'nav' lesions path integration
node test/evolve_genome.mjs 30 16 8 1,2,3 out.json   # CMA-ES over the motor genome (fitness: test/genome_eval.mjs)
CHROME=/path/to/chrome PLAYWRIGHT=/path/to/playwright-core/index.mjs node test/browser_check.mjs http://127.0.0.1:8899/live/ ./shots tag
```

See [CHANGELOG.md](CHANGELOG.md) for each pass and its measured results. Third-party code: three.js r170 (MIT,
`vendor/three/LICENSE`), Taylor recurrences ported from tsotchke/eshkol (MIT, `js/tsotchke/LICENSE-eshkol`).
