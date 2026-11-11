# Glitchling v2 · live

A 3D soft-bodied creature and multi-clade A-Life biosphere simulated in the browser. Every movement comes from spiking neurons, a liquid-time-constant pattern generator and motor neurons pulling on cross-bridge sarcomere muscles in a 3D continuum FEM physics body. Nothing is keyframed.

**Open it:** https://0thernes.github.io/glitchling-jam/live/ (phone or desktop, touch or mouse).
The simpler 2D version is at [`../play/`](../play/).

This is a **browser simulation**. All numbers on the page are computed live by the code in `js/sim/`. It makes no
claim of awareness, feelings, sentience or consciousness.

## How it fits together

```
dual 128×64 P/M/K foveated retinas (16,384 receptors / 49,152 cone ch, 4 Hz microsaccades) → V1 → V2 → V4 → 4,096-concept PQ-IT + PRh + SLAM ─► SENS ─┐
proprioception, chemotaxis (64×64×3 food/alarm/mate pheromones), thermoreception, spine Taylor jets                                          ─► PROP ─┼─► 3,268 spiking neurons by default (S=436 .. MEGA=1.05M .. GIGA=14,156,048 / 56.62M syn)
interoception (glucose, ghrelin, thirst, bladder, cortisol, baroreflex, bodyTemp…)                                                           ─► INS  ─┘     8-comp branched HH+NMDA+SK + Fox-Lu stochastic Markov L4/L2-3/L5-6 CTX + septotemporal HIP
                     histological 4,608-neuron spiking loop: EC_II/III → 2,048 DG (3.125% k-WTA) + 128 Mossy → 1,024 CA3 → 512 CA1 → 256 Subiculum → 128 EC_V + 4 GABAergic interneuron classes + 1,024-dim FHRR phasors
                     unified 21-ch STR D1/D2 spike race (16 sites + 3 pools + snack + explore) ─► metacog veto ─► goal + forelimb snack/egg caching
                     108-gene Embryonic Hox + Shh/Fgf/Bmp/Wnt GRN genome (variable 4/6/8-limb quadruped/hexapod/octopod plans; 6-gen refine + 12-gen surrogate de-novo CMA-ES) ─► MOT (8) ─► LTC CPG (24) ─► sLTC MNs (122) ─► Huxley sarcomere muscles
                                                                                                                  └─► 85–89-node / 336–348-tet anisotropic (I4) 3D FEM + 3D D3Q19 Lattice-Boltzmann + 63-voxel Biot-Darcy FSI & 512 WCSPH blood parcels
                     online RTRL selective SSM (32 modes) ─► Multimodal (72-D + 384-D 16×8×3 foveal RGB) RoPE-SwiGLU Transformer-XL (238k std .. 11.47M titan; 4-step Rectified Flow-Matching video + +0.1s/+0.5s/+2.0s BPTT/+60.0s planner)
                     multi-clade A-Life biosphere: up to 32 conspecifics (4L/6L/8L clades), diploid 108-gene SBX crossover, 3D eggs, 64×64 microbial/planktonic continuum (>2.20M organisms), 27 mycelia, 36 bio-mites, Shadow-Leviathan, vents, shelters, 4 seasons
                     Bio-Observatory graphics & audio: Three.js HDR16F + Sky PMREM IBL + 12-tap GTAO + God-Rays + Bloom + FidelityFX CAS + Display-P3 + Fixed 4K UHD (3840×2160) + 4 Cameras + p5.js 5-tab Studio + WebAudio syrinx
                     Tsotchke stack: Eshkol Taylor AD + 14Q inline-WASM / 16Q WebGPU Lindblad + Richardson ZNE error mitigation + 4-beacon CORS QRNG + QGTL Fubini-Study/Berry + Moonlab Vidal MPS (χ=24) & 4-layer (256-D) Binary MERA
                     compute backends: auto (CPU TypedCSR on S/M · Web Worker on L–GIGA) | WebGPU WGSL · clock: default 1× biological real-time (24h + waking SWRs) | 1× wall solar | 60× | 240×
metabolism: gut → blood → liver glycogen → fat, ketones, gluconeogenesis, insulin/glucagon/cortisol/ghrelin/leptin, water, waste, endothermy
sleep: adenosine S + circadian C, WAKE/N1/N2/N3/REM (+ 30-s waking SWR micro-consolidation in 1× real-time), atonia, SVD/MPS/MERA/Hollow-mDAE/Wiener/ZNE consolidation, REM dreaming
```

## Mechanisms added in passes 2–18

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
| 16 | 5 brain scales (`XXL` 104,904 / 4.76M syn, `<15 ms` CPU `XL`, auto-Worker) + 3-comp `L4/L2-3/L5-6` laminar microcolumns (`S < M < L` foraging), anatomical `EC→DG(576, 4.9% k-WTA)→CA3→CA1` trisynaptic hippocampus, dual `24×12` 2D retinotopic `LGN→V1 Gabor→V4/MT` hierarchy, `112k–1.17M`-param Causal RoPE-SwiGLU Transformer-XL (`+0.1s`/`+0.5s`) world model, 10-gen in-browser de-novo uniform random `[0.05,0.95]^78` evolution, 78-tet 3D Neo-Hookean FEM + 16-node/26-vessel 1D Navier-Stokes & 120-parcel 3D SPH hemodynamics, `1:1` real-time biological clock, 10-qubit open-quantum Lindblad/photonic QRNG + Vidal canonical MPS | monotonic 240-s foraging (`S 43 < M 48 < L 52` feeds; `65 < 71 < 78` arrivals), `XL` `14.85 ms` CPU / `5.73 ms` UI thread, `XXL` `12.27 ms` UI thread, far nav `8/8` (`0.90` upright, `2%` inverted), `0.85/0.92/0.67` trisynaptic Hopfield recall, `−10.7%` Transformer-XL MSE (`measure` `3.33` feeds, `0.031` `wmMSE`), de-novo random `2.83 → 6.11` |
| 17 | 6 brain scales (`MEGA` `1,048,644` 4-comp Rush-Larsen HH cable-tree neurons / `16.78M` synapses), biophysical `964`-neuron `SpikingTrisynapticCircuit` + Hollow-mDAE + James-Stein CA1 (`held-out 0.703 > 0.691 raw`), dual `64×32` (`4,096`-ch) foveated retinas + `V2 → 24-unit invariant IT` (`0.994` invariance), `147k–3.72M`-param Multimodal (`72-D + 96-D foveal RGB`) Transformer-XL with `+2.0 s` (`20`-step) end-to-end BPTT, 92-gene Evo-Devo body+brain co-evolution (`3.77 → 6.65` de-novo), 85-node / 336-tet anisotropic ($I_4$) 3D FEM + 63-voxel 3D Biot-Darcy two-way FSI & 256-parcel WCSPH, open-ended multi-agent A-Life biosphere, `Three.js` HDR16F/SSAO/Bloom/Display-P3/4K-UHD + `p5.js` studio, default `1×` biological real-time clock, 12-qubit inline-WASM QRNG + $\chi=16$ Vidal MPS & Binary MERA | monotonic 240-s foraging (`S 22 < M 26 < L 30` feeds), `NEAR 7/7`, `FAR 7/8`, `upright 0.91`, `4/4` thirst water-finding (`0/4` lesioned), `held-out` episodic recall beats raw (`0.703 > 0.691`), 4K `3840×2160` & `MEGA` `1.05M`-neuron browser runs with `errors: []` |
| 18 | 7 brain scales up to mouse-cortex neuron count (`GIGA` `14,156,048` neurons / `56.62M` plastic Int8+CSR synapses) + **8-compartment branched dendritic cable arbours** (`AIS`, `soma`, `basal L/R` NMDA spikes, `oblique`, `trunk` HCN $I_h$, `tuft A/B` $Ca_v$ BAC + `SK` AHP) + **Fox-Lu stochastic Markov channel kinetics**, **`4,608`-neuron histological hippocampal–subicular loop** (`2,048` DG + `4` PV/chandelier/O-LM/VIP interneuron classes), **dual `128×64` (`16,384`-receptor) P/M/K retinas + `4,096`-concept PQ-IT + Perirhinal cortex**, **`11.47M`-param `titan` Transformer-XL** with `16×8×3` Rectified Flow-Matching video head & `+60.0 s` 4-timescale planner, **108-gene Embryonic `Hox` + `Shh/Fgf/Bmp/Wnt` GRN** (`4L`/`6L`/`8L` body plans), **3D `D3Q19` Lattice-Boltzmann FSI + `512` WCSPH + Huxley sarcomeres**, **`32`-peer clades + `2.20M` microbial continuum**, **14Q WASM / 16Q WebGPU + Richardson ZNE + $\chi=24$ MPS & 4-layer MERA**, and **Bio-Observatory Three.js (Sky IBL + 12-tap GTAO + CAS + frosted-obsidian UI)** | monotonic 240-s foraging (**`S 29 < M 30 < L 32` feeds**), **`FAR 8/8` (`100%`) & `upright 0.93` (`0%` inverted)**, `4/4` thirst (`0/4` lesioned), `held-out` episodic recall `0.67 > 0.64` raw, `cladeCounts {"4L":5,"6L":11,"8L":1}` + `2.20M` microbes + `5` births in 70 s, `2.1×–11.2×` ZNE bias cut, 108-gene de-novo `2.39 → 5.19` (`2.18×`), `GIGA` + `titan` + `4K` browser verified (`errors: []`) |

## Files

| file | what it does |
|---|---|
| `js/sim/brain.js` | cache-compact TypedArray CSR spiking substrate (`S`/`M`/`L`/`XL`/`XXL`/`MEGA`/`GIGA` up to `14,156,048` neurons / `56.62M` syn), 8-comp branched HH + NMDA + HCN + $Ca_v$ + SK + Fox-Lu stochastic Markov laminar CTX, septotemporal HIP, 3-mech homeostasis |
| `js/sim/brain_worker.js`, `js/sim/webgpu_brain.js` | off-main-thread Web Worker (`?backend=auto` on `L`–`GIGA` or `?backend=worker`) and lock-free WebGPU WGSL compute shader (`?backend=webgpu`) brain accelerators |
| `js/sim/cpg.js` | 24 LTC neurons forming segmental, leg and arm half-centre oscillators with Hox phase biases |
| `js/sim/body.js` | 85–89-particle / 336–348-tetrahedron anisotropic ($I_4$) 3D Neo-Hookean continuum XPBD-FEM soft body (`4L` quadruped / `6L` hexapod / `8L` octopod Hox plans), Huxley 2-state cross-bridge sarcomere muscles, ventral scute ratchet, Taylor-jet curvature |
| `js/sim/fluid.js` | closed-loop 16-node / 26-vessel unsteady 1D Navier-Stokes graph + 3D `D3Q19` Lattice-Boltzmann (`12×6×6`) microvascular Navier-Stokes solver + 63-voxel 3D Biot-Darcy poroelastic bed (two-way FSI) + 512 3D WCSPH blood parcels (`O2`, glucose) |
| `js/sim/vision.js` | dual `128×64` (`16,384`-receptor / `49,152`-cone) log-polar foveated retinas (4 Hz microsaccades), P/M/K LGN pathways, V1 Gabor + stereo, V2, V4, `64×64 = 4,096`-concept Compositional PQ-IT + Perirhinal cortex, EKF-SLAM |
| `js/sim/creature.js` | wiring, motor learning + Fisher/EWC, unified 21-channel striatal race, metacognitive veto, thermoregulation, camouflage, forelimb snack/egg caching, default `1×` real-time / wall-clock solar sync + waking SWRs |
| `js/sim/ecosystem.js` | open-ended multi-clade biosphere: up to 32 conspecific Glitchlings (`4L`/`6L`/`8L` clades), courtship, diploid 108-gene SBX crossover + mutation, thermally incubated 3D eggs, ontogeny, live `lineageTree` cladogram, 36 bio-mites, Shadow-Leviathan predator |
| `js/sim/mind.js` | online diagonal RTRL selective SSM, Multimodal (`72-D + 384-D 16×8×3 foveal RGB`) RoPE-SwiGLU Transformer-XL (`238k` `std` .. `11.47M` `titan`, 4-step Conditional Rectified Flow-Matching video head + `+0.1s/+0.5s/+2.0s` 20-step BPTT / `+60.0s` planner), predictive coding, two-process sleep |
| `js/sim/metacog.js` | Oja 8-D neural manifold, Eshkol order-3 Taylor-jet Frenet-Serret curvature $\kappa(t)$ & torsion $\tau(t)$, uncertainty calibration, regret, innate vs learned weight-space audit, $\chi=24$ Vidal MPS & 4-layer (`256-D`) Binary MERA consolidation |
| `js/sim/genome.js`, `js/sim/starter_genome.js` | 108-gene Evo-Devo genome (58 motor/synergy + 20 steering + 14 3D morpho/collagen/thermal/neural + 16 Embryonic `Hox` + `Shh/Fgf/Bmp/Wnt` GRN genes) and shipped starter |
| `js/sim/fitness.js`, `js/lineage.js`, `js/sim/lineage_worker.js` | 6-gen starter refinement + 12-gen quadratic-surrogate pre-screened Active Mirrored CMA-ES de-novo co-evolution from `[0.05, 0.95]^108` in Web Workers |
| `js/sim/nav.js` | head-direction ring attractor, sun compass, roll-invariant path integration, grid-cell readout |
| `js/sim/memory.js` | histological `4,608`-neuron `SpikingTrisynapticCircuit` (`EC_II/III → 2,048 DG + Mossy → CA3 → CA1 → Subiculum → EC_V` + 4 GABAergic interneuron classes) + Hollow-mDAE + Rank-4 InfoNCE metric + James-Stein shrinkage + 1,024-dim FHRR phasors |
| `js/sim/metab.js`, `js/sim/skin.js` | gut/liver/adipose/hormone metabolism + FitzHugh-Nagumo chromatophore & hormone-tuned Gray-Scott skin |
| `js/sim/world.js` | FBM terrain, 16 co-evolving L-system plants, `64×64` saprotrophic microbe / rhizobial / phytoplankton continuum (`>2.20M` organisms), `64×64×3` wind-advected pheromones, `32×32` soil N/C + 27 mycelial edges, 3 hydrothermal vents, 4 crystal shelters, pools, 4 seasons |
| `js/render.js` | Three.js Bio-Observatory: custom GLSL dermal subsurface/iridescence/osteoderms + PMREM HDR Sky IBL + 12-tap GTAO + God-Rays + UnrealBloom + FidelityFX CAS + Display-P3 + Fixed 4K UHD (`3840×2160`) + 4 Camera Modes |
| `js/p5_layer.js` | local `p5.js` generative Voronoi dermal scute & mycelial/microbial `CanvasTexture` synthesizer + interactive 5-tab `#p5-studio` |
| `js/audio.js` | procedural WebAudio bio-acoustic syrinx FM vocalizations, heartbeat sub-bass, hydrothermal vent rumble, wind & predator drone |
| `js/honesty.js` | the real-vs-simplified lists shown on the page |
| `js/tsotchke/taylor.js`, `wasm_quantum.js`, `qrng.js`, `qgtl.js`, `moonlab.js` | Tsotchke stack: Eshkol Taylor AD jets, 14-qubit (`DIM = 16,384`) inline-WASM + 16-qubit (`DIM = 65,536`) WebGPU Lindblad statevector, gate-folding Richardson ZNE, 4-beacon CORS QRNG (SP 800-90B), QGTL Fubini-Study/Berry, Moonlab Jacobi SVD, $\chi=24$ Vidal MPS & 4-layer (`256-D`) Binary MERA |
| `test/*.mjs` | Node probes (physics, biosphere `eco_probe`, steering, memory, brain scale up to `GIGA`, water, CMA-ES) and headless-Chromium checks |

## Tests

```
node test/headless_run.mjs 120          # 2 simulated minutes, prints distance, eats, behaviour entropy
node test/headless_run.mjs 60 mn        # same with every motor neuron lesioned
node test/eco_probe.mjs 70              # 32-peer clades, >2.2M microbes, D3Q19 LBM, 16,384-ch PQ-IT, Flow/+60s WM & 14Q ZNE
node test/steer_probe.mjs               # does it close the distance to a goal? (with and without the turn wiring)
node test/gait_probe.mjs                # what the body does mechanically under a test-only travelling wave
node test/forage_bench.mjs 240 1,2,3,4  # feeds, site arrivals, give-ups per seed (set TW='{"brain":"S|M|L"}' to compare scales)
node test/measure.mjs                   # distance, behaviour entropy, intact vs MOT/CPG/MN lesions
node test/memory2_probe.mjs a           # HDC held-out regression: superposition vs delta rule vs delta rule + learned features
node test/memory2_probe.mjs b 2         # 4,608-neuron histological hippocampal loop recall on a real 600-s run
node test/scale_probe.mjs               # forced-turn yaw rates; see also righting/symmetry/pc/turing/growth/water probes
node test/brain_probe.mjs GIGA 10       # neurons, synapses, ms/step & rates across S/M/L/XL/XXL/MEGA/GIGA (optional 'struct' lesion)
node test/nav_probe.mjs 1,2,3,4 [nav]   # near (4-8 u) vs far (14+ u) site arrival in 60 s; 'nav' lesions path integration
node test/evolve_genome.mjs 30 16 8 1,2,3 out.json   # CMA-ES over the genome (fitness: js/sim/fitness.js; EVAL_ROUGH=1 for rough ground)
node test/babble_probe.mjs              # turn gain measured by motor babbling per body
CHROME=... PLAYWRIGHT=... node test/lineage_check.mjs http://127.0.0.1:8899/live/ ./shots tag   # runs and adopts an in-page lineage
CHROME=/path/to/chrome PLAYWRIGHT=/path/to/playwright-core/index.mjs node test/browser_check.mjs http://127.0.0.1:8899/live/ ./shots tag
```

See [CHANGELOG.md](CHANGELOG.md) for each pass and its measured results. Third-party code: three.js r170 (MIT,
`vendor/three/LICENSE`), p5.js v1.11.3 (LGPL-2.1, `vendor/p5/LICENSE`), Taylor recurrences ported from tsotchke/eshkol (MIT, `js/tsotchke/LICENSE-eshkol`).
