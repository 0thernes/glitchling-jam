# Glitchling

A deliberately broken baby clone of Alex Donahue's A-Life **Creature #1**, built in a one-day jam (Nov 1, 2026). It has four engineered flaws you can switch on and off:

- **scramble**: senses read through a random permutation plus noise, re-shuffled every 90 ticks
- **leaky**: learned values decay toward their prior by 6% per tick
- **backwards**: the 8 MOT motor neurons read out reversed, and the chosen site is mirrored (k → 15−k)
- **misfire**: every 60 ticks, one site value and 20 random synapses get a jolt

## Live

- Landing page: https://0thernes.github.io/glitchling-jam/
- **Glitchling v2 (live 3D soft-body & spiking brain):** https://0thernes.github.io/glitchling-jam/live/
- **Play the 2D sim:** https://0thernes.github.io/glitchling-jam/play/
- Jam showcase: https://0thernes.github.io/glitchling-jam/site/
- Brain viz (real activation playback): https://0thernes.github.io/glitchling-jam/brain-viz/

The play page runs in any modern browser (phone or desktop), with no build step, no external libraries and no network calls. You can toggle each flaw, adjust its period or leak rate, change the seed, pause, step, speed up, and tap the world to drop food. It shows the creature foraging, a live 272-neuron brain view by region, and live glucose, reward and success charts. Settings are saved in the URL, e.g. `play/?seed=7&flaws=backwards,scramble`.

## Real vs simulated (please read)

- **`play/` is a simplified JavaScript port** written for exploring the flaws interactively. It is **not** the TypeScript reference run, and its numbers will not match the published results.
  - *Kept from the reference:* 16 sites (4 colours × 4 shapes) with the same reward formula, depletion and the days 1–3 half-access pattern; 1 tick = 1 sim-minute; the 272-neuron layout in the same 14 regions with the reference's region-to-region connection probabilities; the four flaws applied the way `glitchling.ts` applies them; seeded mulberry32 RNG with a separate flaw stream.
  - *Simplified or invented:* rate-unit neurons instead of the spiking substrate; a 3-pool toy metabolism; a noisy value race instead of the striatal spike race and expected-free-energy terms; the walking body, 2D map and click-to-drop food; MOT as an 8-way heading code.
- **The results tables, plots and brain-viz playback come from the TypeScript sim** (`glitchling.ts` subclassing `core/organism.ts`, a copy of the Creature #1 organism). n = 2 seeds per condition, so they are a toy, not a finding.
- Some renders in the showcase are driven by **synthetic** data; they are labelled SYNTHETIC on the page.
- No claims of consciousness, sentience or feelings are made for Glitchling or Creature #1.

## Run the reference sim locally

```bash
bun run glitchling.ts 2 2     # days=2, seeds=2 -> results/results.json, results/summary.csv
python plot.py                # -> results/glitchling.png, results/cursed_portrait.png
```

## Layout

| Path | What |
|---|---|
| `live/` | Glitchling v2 live 3D A-Life Bio-Observatory & organism (`436`–`14,156,048` 8-compartment branched HH+NMDA+SK + Fox-Lu stochastic Markov spiking neurons / up to `56.62M` plastic Int8+CSR synapses in mouse-cortex-scale `GIGA`, LTC CPG, 85–89-node / 336–348-tet anisotropic 3D FEM body + Huxley cross-bridge sarcomere muscles + 3D `D3Q19` Lattice-Boltzmann + 63-voxel Biot-Darcy FSI & 512-parcel WCSPH hemodynamics, dual `128×64` (`16,384`-receptor) P/M/K foveated retinas → `V1→V2→V4→4,096-concept compositional PQ-IT + Perirhinal` + EKF-SLAM, histological `4,608`-neuron spiking hippocampal–subicular loop (`2,048` DG + `4` GABAergic interneuron classes), `238k`–`11.47M` (`titan`) Multimodal RoPE-SwiGLU Transformer-XL world model (`16×8×3` Rectified Flow-Matching video head + `+0.1s/+0.5s/+2.0s` BPTT / `+60.0s` planner), 108-gene Embryonic `Hox` + `Shh/Fgf/Bmp/Wnt` GRN (`4L`/`6L`/`8L` body-plan co-evolution), up to 32 conspecifics + diploid SBX crossover + 3D eggs + `>2.20M` soil/planktonic microbial continuum + WebAudio syrinx, `Three.js` HDR16F + Sky PMREM IBL + 12-tap GTAO + FidelityFX CAS + Display-P3 + 4K UHD + `p5.js` 5-tab studio, default `1×` biological real-time clock, and 14Q WASM / 16Q WebGPU Lindblad + Richardson ZNE + $\chi=24$ Vidal MPS & 4-layer Binary MERA; see [`live/README.md`](live/README.md)) |
| `play/` | Live playable 2D browser port (`sim.js` model, `app.js` UI, `style.css`) |
| `site/` | One-day jam showcase page |
| `brain-viz/` | Real activation playback viewer |
| `glitchling.ts`, `core/` | TypeScript reference sim |
| `results/`, `results_v1/` | Sim outputs |
| `art/`, `artifacts/`, `research/` | Art, renders, research notes and reference images |
| `NOTES.md`, `BLUEPRINT.md`, `BRAINS.md`, `WRITEUP.md` | Jam notes and design docs |
