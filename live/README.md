# Glitchling v2 · live

A 3D soft-bodied creature simulated in the browser. Every movement comes from spiking neurons, a liquid-time-constant
pattern generator and motor neurons pulling on muscles in a physics body. Nothing is keyframed.

**Open it:** https://0thernes.github.io/glitchling-jam/live/ (phone or desktop, touch or mouse).
The simpler 2D version is at [`../play/`](../play/).

This is a **browser simulation**. All numbers on the page are computed live by the code in `js/sim/`. It makes no
claim of awareness, feelings, sentience or consciousness.

## How it fits together

```
32-ommatidium 260° binocular retina (ray occlusion + stereo) + EKF-SLAM map ─► SENS ─┐
proprioception (spine curvature via Taylor jets, contacts, tilt, speed)     ─► PROP ─┼─► 3,268 spiking LIF neurons by default (S=436, M=3.3k, L=12k, XL=25.9k)
interoception (glucose, ghrelin, thirst, bladder, cortisol…)                ─► INS  ─┘     2-comp apical CTX + HIP place sheet, 3-mech homeostasis, STDP × DA,
                     unified 21-ch STR D1/D2 spike race (16 sites + 3 pools + snack + explore) ─► metacog veto ─► goal
                     78-gene developmental genome ─► MOT (8) ─► LTC CPG (24) ─► sLTC motor neurons (122) ─► 61 muscles
                                                                                                  └─► soft body (51 particles, 250+ constraints)
                     online RTRL selective SSM (32 modes) ─► 2-layer SiLU residual world model (predVar) ─► surprise → LC/NE; REM rollouts
                     Oja 8-D manifold + Eshkol order-3 Taylor jets ─► Frenet-Serret curvature κ(t) & torsion τ(t) + Fisher/EWC + Moonlab SVD
                     Tsotchke stack: Eshkol Taylor AD + 8-qubit Born-rule QRNG + QGTL Fubini-Study/Berry geometry + Moonlab MPS entanglement
                     compute backends: CPU cache-compact TypedArray CSR (default) | off-main-thread Web Worker | WebGPU WGSL compute shader
metabolism: gut → blood → liver glycogen → fat, ketones, gluconeogenesis, insulin/glucagon/cortisol/ghrelin/leptin, water, waste
sleep: adenosine S + circadian C, WAKE/N1/N2/N3/REM, atonia, NREM replay + SVD/mDAE/Wiener consolidation, REM dreaming
```

## Mechanisms added in passes 2–15

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
| 11 | learned / consolidated memory | delta-rule HDC maps (1024-dim) with sleep-time feature resampling; 1024-slot Hopfield store with usage-based forgetting, sleep merging and a contrastively learned key map |
| 12 | evolved motor genome, head-direction ring, path integration, grid cells, motor babbling | CMA-ES-evolved developmental genome grows the CPG/MOT→muscle wiring (turning 0.3 → 2.3 rad/s); a 36-unit ring attractor tracks heading, dead reckoning tracks position, sight of a known site resets it; goals beyond 9 units are steered to by vector; 12 s of random synergy babbling calibrates the steering gain |
| 13 | brain scale, structured wiring, structural plasticity | default 3,258 neurons / 121k synapses (`?brain=L`: 11,962 / 489k; `?brain=S`: 426): E/PV/SST cell types on 2D sheets, distance-dependent small-world cortex, topographic thalamus/proprioception input, motor strip; weak cortical synapses pruned and regrown onto active neighbours each second; adaptive size drop if a step costs > 12 ms |
| 14 | in-page lineage evolution, rough-ground genome, thirst interrupt, bias-corrected repertoire | the Lesions tab runs a separable CMA-ES on the 44 motor genes in Web Workers (8 mutants per generation, fitness shown per generation) and can adopt the result; shipped genome re-evolved offline with rocks, springs and a zig-zag steering trial; strong thirst can interrupt a food trip |
| 15 | 260° binocular retina + EKF-SLAM, cross-spectral Wiener HDC + mDAE/EB Hopfield, 4 brain scales + Web Worker / WebGPU + 3-mechanism homeostasis + 2-comp CTX/HIP place sheet, full 78-gene motor+steering CMA-ES & mirrored CRN lineage, online RTRL SSM + 2-layer SiLU residual world model, unified 21-ch striatal race, Oja + Taylor-jet Frenet-Serret thought curvature & metacognition, Fisher/EWC + Tsotchke QRNG/QGTL/Moonlab | near 8/8 & far 8/8 in 60 s (`upright` 0.86), 4/4 thirst water-finding, 56 feeds in 240 s (`M` > `S`'s 43), cortical homeostasis survives `struct` lesion, HDC/Hopfield encoders measurably improve held-out recall, evolved steering beats hand steering on 8 held-out bodies |

## Files

| file | what it does |
|---|---|
| `js/sim/brain.js` | cache-compact TypedArray CSR spiking substrate (`S`/`M`/`L`/`XL`), 2-comp apical CTX, HIP place cells, 3-mechanism homeostasis, STDP × DA, neuromodulators |
| `js/sim/brain_worker.js`, `js/sim/webgpu_brain.js` | off-main-thread Web Worker (`?backend=worker`) and WebGPU WGSL compute shader (`?backend=webgpu`) brain accelerators |
| `js/sim/cpg.js` | 24 LTC neurons forming segmental, leg and arm half-centre oscillators |
| `js/sim/body.js` | Verlet soft body, muscles, directional ventral scute ratchet & cross-slope keel, grip, collisions, Taylor-jet curvature |
| `js/sim/vision.js` | 32-ommatidium 260° binocular retina on stalked eyes, 3D ray-rock/terrain occlusion, stereo + subtense depth, hippocampal EKF-SLAM landmark map |
| `js/sim/creature.js` | wiring, motor learning + Fisher/EWC, unified 21-channel striatal race, metacognitive veto, eating, drinking, flaws, replay, dreams |
| `js/sim/mind.js` | online diagonal RTRL selective SSM, 2-layer SiLU residual world model (`predVar`), two-level predictive coding, two-process sleep |
| `js/sim/metacog.js` | Oja 8-D neural manifold, Eshkol order-3 Taylor-jet Frenet-Serret curvature $\kappa(t)$ & torsion $\tau(t)$, uncertainty calibration, regret, innate vs learned weight-space audit |
| `js/sim/genome.js` | full 78-gene developmental genome (58 motor/synergy + 20 steering genes) growing all innate CPG/MOT/sense wiring |
| `js/sim/starter_genome.js` | the shipped two-stage multi-body CMA-ES motor + steering genome and how it was found |
| `js/sim/fitness.js` | rough-ground motor + closed-loop steering fitness shared by offline CMA-ES and in-page lineage evolution |
| `js/lineage.js`, `js/sim/lineage_worker.js` | variance-reduced mirrored 2-body CRN separable CMA-ES over all 78 genes in Web Workers, with genome undo stack |
| `js/sim/nav.js` | head-direction ring attractor, sun compass, roll-invariant path integration, grid-cell readout |
| `js/sim/memory.js` | 1024-dim FHRR maps with cross-spectral Wiener coherence + Gauss-Newton frequency refinement; 1024-slot modern Hopfield with closed-form mDAE + Empirical-Bayes precision cosine + InfoNCE |
| `js/sim/metab.js` | metabolism, hormones, fluids, waste |
| `js/sim/skin.js` | excitable-medium chromatophore sheet plus a Gray-Scott pattern layer tuned by hormones |
| `js/sim/world.js` | terrain, plants, snacks, rocks, springs, water pools |
| `js/render.js` | three.js view (reads the sim, never moves it) |
| `js/honesty.js` | the real-vs-simplified lists shown on the page |
| `js/tsotchke/taylor.js`, `qrng.js`, `qgtl.js`, `moonlab.js` | Tsotchke stack: Eshkol Taylor-mode AD jets, 8-qubit statevector Born-rule QRNG, QGTL Fubini-Study metric & Berry curvature, Moonlab Jacobi SVD & bipartite MPS entanglement |
| `test/*.mjs` | Node probes (physics, steering, memory, brain scale, water, CMA-ES) and headless-Chromium checks |

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
node test/brain_probe.mjs M 300 [struct] # neurons, synapses, ms per step, rates, rewiring and wiring-activity alignment
node test/nav_probe.mjs 1,2,3,4 [nav]   # near (4-8 u) vs far (14+ u) site arrival in 60 s; 'nav' lesions path integration
node test/evolve_genome.mjs 30 16 8 1,2,3 out.json   # CMA-ES over the motor genome (fitness: js/sim/fitness.js; EVAL_ROUGH=1 for the rough-ground version)
node test/babble_probe.mjs              # turn gain measured by motor babbling per body
CHROME=... PLAYWRIGHT=... node test/lineage_check.mjs http://127.0.0.1:8899/live/ ./shots tag   # runs and adopts an in-page lineage
CHROME=/path/to/chrome PLAYWRIGHT=/path/to/playwright-core/index.mjs node test/browser_check.mjs http://127.0.0.1:8899/live/ ./shots tag
```

See [CHANGELOG.md](CHANGELOG.md) for each pass and its measured results. Third-party code: three.js r170 (MIT,
`vendor/three/LICENSE`), Taylor recurrences ported from tsotchke/eshkol (MIT, `js/tsotchke/LICENSE-eshkol`).
