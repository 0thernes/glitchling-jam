# Volume 1 — NESTOR v0.1, Future Wishlist v0.2, Embodied Omni-Harness & HEPTARCH v0.2

> **Source PDFs Distilled in This Volume:**
> - **PDF 01:** `Nested-Precision-Brain-Framework.pdf` (38 pp. · **NESTOR v0.1**: 3-level nested brains-in-brains, 23-rung precision ladder, Tokenless S2S `Eq. 4`, Decursive Self Deduplication `DSD` + Bicursive Self Sync `BSS`, `CHIMERA` / `ChronoBlock-4` / `Spindle` / `Frankenstein Prime`, 14-operator Weight-Space DSL, Recipes `R1–R10`)
> - **PDF 02:** `Future-Wishlist.pdf` (68 pp. · **Future Wishlist v0.2**: 143 clean-slate capabilities across 11 domains, 10 Grail wishes, dependency spine, and "install the meter before the capability")
> - **PDF 03:** `Omni-Harness-Catalog.pdf` (40 pp. · **Omni-Harness Capability Catalog**: 43 `qwm.cap.*` canonical heads, 52 sensor adapters [48 embodied kept / 4 GUI-SaaS excluded], 16 target platforms, and the strict Layer-1 vs Layer-2/3 tokenless boundary)
> - **PDF 04:** `Apex-Composite-Creature-Report.pdf` (41 pp. · **HEPTARCH v0.2**: 7-seat composite council, 7+1 operational modes including 6-phase Raider `Cold Strike`, Laws `1–5`, Two-Layer Geodesic Biodome, and the Apex Scorecard)

---

## 1. NESTOR v0.1 — Nested, Elastic-Precision, State-Sharing, Tokenless Organism Reference (PDF 01)

### 1.1 Three Structural Levels & Uniform Cell Contract
Every neural module at **Micro** (compartment / neuron / synapse), **Meso** (microcircuit / ganglionic organ / column), and **Macro** (sub-brain / council seat / whole organism) obeys one tokenless tuple contract:
- **State:** $(x_t, s_t, q_t, e_t)$ — fast dynamical state $x_t$, slow physiological/plastic state $s_t$, active precision rung $q_t \in \{1..23\}$, and metabolic ATP/heat ledger $e_t$.
- **Nothing Cosmetic (`Principle P1`):** Every variable in `live/js/sim/` must sit on a closed causal path coupling $\ge 2$ subsystems and be exportable to host telemetry. Any decorative visual-only field must be explicitly tagged as visual-only.

### 1.2 The 23-Rung Precision Ladder & Adaptive Precision Policy
Precision is budgeted like ATP and wiring volume: spending `FP32` on a binary sign reflex wastes bandwidth, whereas putting a circadian/allostatic integrator in ternary `b1.58` causes catastrophic drift.

| Rung | Format / Representation | Canonical Organ Allocation in Glitchling + Dome |
|---|---|---|
| **`1–3`** | **(1) Analog conductance · (2) Spike-timing event code · (3) Stochastic bitstream** | Sparse CSR axonal spike events, `Cryptochrome-4` spin yield, `Thermocore` p-bit Ising flips |
| **`4–6`** | **(4) Binary `{-1,+1}` · (5) Ternary `{-1,0,+1}` (`b1.58`) · (6) `INT2/INT3` post-DSD** | Fast reflex `Spindle` shadow weights, collateral inhibition, post-DSD deduplicated micro-motifs |
| **`7–9`** | **(7) `INT4 / NF4` · (8) `FP4 E2M1 / MXFP4 / NVFP4` · (9) `MXFP6`** | Segmental `CfC/sLTC` limb ganglia, `ChronoBlock-4` quantized tensor blocks (`FP8` scale/16 + `FP32` scale) |
| **`10–13`** | **(10) `INT8 / Q8` · (11) `FP8 E4M3` · (12) `FP8 E5M2` · (13) `posit8 / LNS8`** | `GIGA` `14.16M`-neuron `1.13B`-synapse CSR wave sheets, S2S activation transport, log-gain neuromodulators |
| **`14–17`** | **(14) `FP16` · (15) `BF16` · (16) `posit16 / LNS16` · (17) `TF32`** | `256×128` foveal `V1–V4` maps, `32×16` Flow-VAE world model, `HEPTARCH` council workspace |
| **`18–19`** | **(18) `FP32` · (19) `posit32`** | 3D anisotropic Neo-Hookean FEM kinematics, `D3Q19` LBM hemodynamics, `RTRL` selective SSM master states |
| **`20–21`** | **(20) `FP64` · (21) `FP128` (reference/chaos)** | `Ring-0` allostatic set-points, circadian phase, and the **11-Pool Kahan-Compensated Dome First-Law Ledger** |
| **`22–23`** | **(22) Keyed Stochastic Rounding + Kahan summation · (23) Per-grade Clifford `Cl_{3,0}`** | Unbiased `INT8/ternary` plasticity updates + separate scalar/vector/bivector precision on 3D `SE(3)` poses |

**Precision Demand Score (`Eq. 2`):**
$$D(\theta) = \mathbb{E}\!\left[\|\nabla_\theta \mathcal{L}\|\right] \cdot \sigma_q(\theta) \cdot \frac{T_{\text{life}}(\theta)}{\tau_{\text{wash}}(\theta)}$$
A tensor promotes up the ladder when shadow-quantization divergence $\|\Phi_{\text{hi}} - \Phi_{\text{lo}}\|$ or sensory surprise spikes above threshold, and demotes during NREM/Zenkai consolidation under an ATP knapsack constraint.

### 1.3 Tokenless State-to-State (`S2S`) Residual Bus (`Eq. 4`)
Sub-brains never serialize internal thought into discrete text tokens. Source state $s$ (at rung $q_s$) couples into target state $t$ (at rung $q_t$) via a guarded zero-initialized adapter:
$$t' = t + g(s, t) \odot \Big(\Phi\big(A(Q^{-1}(s))\big) - \Pi(t)\Big)$$
When gate $g(s,t) = 0$, $t' = t$ identically (safe hot-plugging and zero-ablation `Collar` path). Gates open proportionally to measured reduction in downstream prediction error.

### 1.4 Decursive Self Deduplication (`DSD`), `RSR` & Bicursive Self Sync (`BSS`, `Eqs. 22–23`)
- **Six Formalisms of `DSD` (`F1–F6`):** (F1) Quotient-graph isomorphism merging, (F2) Centered Kernel Alignment (`CKA`) / activation-covariance clustering, (F3) Minimum Description Length (`MDL`) motif dictionary compression, (F4) Renormalization-group coarse-graining across Micro $\to$ Meso $\to$ Macro, (F5) Hopfield/attractor basin coalescing during NREM sleep, and (F6) Behavioral policy equivalence pruning (Marine Recon *"the fewer, the prouder"*).
- **Bicursive Self Sync (`BSS`):** Couples **Recursive Self Replication (`RSR`)** (splitting/forking sub-circuits when novel surprise is high) with **`DSD`** (merging redundant clones) under a host-governed population ODE for active motif count $N$:
$$\dot{N} = r_+ - r_-, \quad r_+ = k_+\big[\alpha(D^* - D) + \beta S - \gamma \dot{C}\big]_+\!\left(1 - \frac{U}{U_{\max}}\right)_+, \quad r_- = k_-\!\left[\alpha'(\rho - \rho^*) + \gamma'\!\left(\frac{U}{U_{\max}}\right)^2\right]_+$$
where $D$ is behavioural diversity, $S$ is world-model surprise, $\dot{C}$ is instability cost, $\rho$ is pairwise motif redundancy, and $U/U_{\max}$ is metabolic/compute budget utilization.

### 1.5 Fused "Frankenstein" Primitives, Weight-Space DSL & Hybrid Brain Recipes
1. **`CHIMERA` Neuron:** Multi-branch active dendrites + local Hopfield associative memory $\Xi$ + shared liquid/Mamba step $\Delta = \text{softplus}(w_\Delta^\top[d; m] + b_\Delta)$ + event-driven `sLTC` spike emitter.
2. **`ChronoBlock-4` Number Format:** 16-weight micro-blocks storing `4-bit`/`ternary` values + shared exponent + plasticity eligibility trace + age/uncertainty tag.
3. **`Spindle` Synapse:** Fast Hebbian/VDSP trace + slow structural consolidator + viscoelastic fatigue state $z$ + write-endurance budget.
4. **`Frankenstein Prime`:** Single-unit fusion of `CHIMERA` + `ChronoBlock-4` + `Spindle`.
5. **14-Operator Tokenless Weight-Space DSL:** `rotate`, `scale`, `project`, `graft`, `prune`, `merge`, `split`, `rank1`, `patch`, `taskvec`, `requant`, `place`, `bind/unbind`, `solve` — every self-edit requires spectral norm check ($\|W\|_2 \le 0.99$) and held-out rollback versioning.
6. **10 Candidate Brain Recipes (`R1–R10`):** From `R1` Minimal Insectoid Reflex (`sLTC + b1.58`) and `R4` Mammalian Forager (`Laminar SNN + Trisynaptic Hippocampus + JEPA`) up to `R9` Colony Castes and `R10` Full `HEPTARCH` Council Organism.

---

## 2. Future Wishlist v0.2 — 143 Capabilities & 10 Grails (PDF 02)

PDF 02 maps **143 clean-slate research targets** across **11 Domains** so creature development attacks genuine unsolved capabilities rather than surface theatrics:

| Domain | Count | Core Focus for Glitchling & The Dome |
|---|---|---|
| **1. Learning & Memory** | 16 | Continual plasticity without catastrophic forgetting, 1-shot episodic binding, NREM/REM active consolidation |
| **2. World Models, Causality & Time** | 15 | Interventional `do(x)` counterfactuals, multi-decade/multi-scale clocks, regime-shift tipping-point radar |
| **3. Agency & Long Horizons** | 13 | Allostatic self-maintenance, subgoal invention, tool chains (`DomeStones`, `DomeCaches`), commitment vs abort |
| **4. Senses, Bodies, Energy & Harness** | 15 | Non-anthropomorphic senses (magnetoreception, electroreception, mycelial/chemical), soft morphing, ~20 W frugality |
| **5. Language, Communication & Other Minds** | 12 | Emergent grounded bio-acoustics (`RS[15,11]` Neuralese),Zahavi honest costly signals, Level-$k$ Theory of Mind |
| **6. Invention, Math, Art, Play & Dreams** | 14 | Play-driven skill discovery, physics-seam/glitch exploitation, open-ended morphogenesis & abiogenesis |
| **7. Affect, Values, Ethics & Self-Knowledge** | 13 | Calibrated epistemic humility (`ECE <= 0.08`), visceral pain/fatigue honesty, `Ring-0` value stability |
| **8. Collectives, Cultures & Institutions** | 12 | 5-caste division of labour, cultural dialect drift, `Titan` treaties/sanctions, `Big-Tree` sanctuary norms |
| **9. Biology, Medicine & Materials** | 11 | Blastema regeneration, immune chemotaxis (`WBC`), ketogenesis, parasite pharmacognosy, metamorphosis |
| **10. Physics, Cosmology & Simulation** | 11 | First-Law energy closure, quantum-contextual organs (`KS`/`Hoggar`/`ENAQT`), inferring Dome laws from inside |
| **11. Continuity, Endings & Second-Order Grails** | 11 | Graceful senescence, `Exuvia` molt/rebirth, `devourBrain` lineage inheritance, open-ended Red Queen evolution |

**The 10 Second-Order Grails & Dependency Spine Rule:**
`1.1.1.1` Lifelong learning without forgetting · `2.1.1.1` Identifiable causal world models · `2.1.1.2` One-shot WM construction · `3.1.1.1` Long-horizon autonomous agency · `4.3.1.1` ~20 W thermodynamic cognition · `6.1.1.1` Non-collapsing self-improvement (`BSS`) · `6.1.2.2` Discovering new physical laws inside the world · `6.1.3.1` In-dome artificial abiogenesis · `7.2.1.1` Constitutional corrigibility (`Ring 0`) surviving self-rewrites · `10.2.1.1` Quantum-native / contextual latent dynamics.
> **Spine Rule:** *"Install the meter before the capability"* — `FP64` energy closure, seed firewall, and lesion/surrogate harness (`Layer 2`) must precede self-rewriting or arms-race scaling.

---

## 3. Embodied Omni-Harness Filtering & Strict Non-SaaS Scope (PDF 03)

PDF 03 deduplicates 240 raw AI tasks into **43 canonical `qwm.cap.*` heads**, **52 sensor adapters**, and **16 platforms**. Under our strict **Glitchling + Creatures/Entities/Beings/Things + Dome** charter:

- **Layer-1 Organism Rule (Strict Tokenless Purity):** Inside the Dome, Glitchling and all ecosystem species run **zero LLMs, zero text tokens, zero prompts, zero MCP/API calls**. Perception and action are 100% numeric fields, spikes, forces, pheromones, acoustics, and metabolic fluxes.
- **Kept Embodied Sensors (`48 / 52`):** Binocular log-polar fovea, dorsal ocelli, stereo cochlear hair-cells, vibrissae/touch tets, proprioceptive golgi/spindle strain, vestibular gravity/tilt, olfaction/gustation plumes, `Cryptochrome-4` geomagnetic radical-pair compass, weakly-electric dipole & lateral-line wake sense, baroreceptor/blood-gas interoception, nociception, and `Thermocore` / `QRNG` physical entropy beacons.
- **Explicitly Excluded Browser / Website / SaaS Adapters (`4 / 52` + Cloud SaaS Platforms):** DOM accessibility trees, headless browser tab/cookie controllers, GUI click/screenshot RPA agents, PDF/OCR invoice pipelines, and Stripe/auth/multi-tenant web SaaS shells are **permanently banned** from `glitchling-jam`.
- **Kept Runtime Targets:** Local self-contained WebGL2 / WebGPU / WASM 3D Bio-Observatory (`glitchling-jam/live/`) + headless Node/Chromium deterministic causal verification probes (`live/tools/`).

---

## 4. HEPTARCH v0.2 — The 7-Seat Composite Council & Raider Cold Strike (PDF 04)

**HEPTARCH** (*Hierarchical Ensemble of Persona Threads, Arbitrated by a Recursive Council Hub*) fuses 3 "power-with-restraint" archetypes, 4 harnessed "shadow" archetypes, and 9 real-world tactical/strategic methods (with asymmetric-terror threat models entering **solely** as Dome defense tests, never creature traits) into **7 tokenless sub-brain seats**:

### 4.1 The 7 Council Seats

| Seat | Archetype Lineage (Method Only) | NESTOR Mechanism & Causal Role in Glitchling | Primary Metric & Lesions |
|---|---|---|---|
| **1. `Surge`** | Broly · Khabib Nurmagomedov (relentless chain-pressure) | Load-driven gain amplification + post-stress **Zenkai** plastic supercompensation under `RSR` | Within-life compensation slope under stress/flaws |
| **2. `Chronoscope`** | Dr. Manhattan · Nimitz · Marine Recon | Multi-horizon world model (`+0.1s..+300s` Flow-VAE + `F10` Local-JEPA) + quiet `Recon` scout forks | Multi-step latent MSE + bifurcation lead time |
| **3. `Keel`** | Starkiller · MARSOC Creed · Yamamoto | **`Ring-0` Constitutional Anchor**: visceral homeostatic set-points, $\sigma(\text{TTC})$ survival gate, metacognitive veto | Zero wireheading; survival rate at low `ATP` |
| **4. `Capacitor`** | Dark Phoenix · Mike Tyson · Manstein | **`F7` Physarum Flux Bank**: slow metabolic/elastic charge accumulation $E \in [0,1]$ in `Stillwater`, explosive release in `Supernova`/`ColdStrike` | Payoff per kJ; Zenkai debt recovery time |
| **5. `Wildcard`** | Homelander · Tyson peek-a-boo evasion | **QRNG / `F3` Thermocore Mixed Strategy** + 4-order **PAD Affect Jet** $(a, \dot{a}, \ddot{a}, a^{(3)})$ making evasion unreadable to predators | Opponent prediction entropy (replayable by host) |
| **6. `LongGame`** | Omni-Man · Magnus Carlsen · Khabib constriction | **300s HTN-MCTS + `F8` Combo Chain** + staggered iterated-game trust/defection memory (`Titans` kernel) + Level-$k$ ToM | Delayed cache/alliance payoff over 5+ min |
| **7. `Jester`** | The Joker · Glitchling's 4 Flaws | **In-Dome Deception, Feints & Red-Team Glitch Kit**: emission suppression $1 - k_f\cdot\text{deceive}$, physics-anomaly probing, flaw inoculation | Feint evasion success + Reality-Glitch discoveries |

### 4.2 Five Governing Equations (`Laws 1–5`)
1. **Law 1 — Capped Softmax Council Arbitration (No Monarchy):**
$$\pi_m(t) = \frac{\min\!\big(\tilde{\pi}_m(t),\, \pi_m^{\max}(\sigma_t)\big)}{\sum_{m'=1}^{7} \min\!\big(\tilde{\pi}_{m'}(t),\, \pi_{m'}^{\max}(\sigma_t)\big)}, \qquad u(t) = \sum_{m=1}^{7} \pi_m(t)\, u_m(t)$$
No single seat can exceed its mode-dependent cap $\pi_m^{\max}(\sigma_t) \le 0.48$, preventing permanent persona lock-in.
2. **Law 2 — PAD Affect Jet & Rage Tripwire:** Tracks valence-arousal-dominance jet $(a, \dot{a}, \ddot{a}, a^{(3)})$; runaway positive $\ddot{a}, a^{(3)}$ trips `Keel` damping or diverts into bounded `Supernova`.
3. **Law 3 — Organism-Scale `sLTC` Integrate-and-Fire Capacitor:** Banks surplus `ATP`/compute in `Stillwater` ($\dot{E} = \eta_{\text{charge}} P_{\text{surplus}} - \lambda_{\text{leak}} E$) and discharges above threshold with refractory debt $Z_{\text{debt}}$.
4. **Law 4 — Asymmetric Predictability:** `Wildcard` draws mixed-strategy timing/evasion pivots from checkpointed `QRNG` streams — unpredictable to in-dome `Leviathans`/`Shoggoths`, yet 100% deterministic under host seed replay.
5. **Law 5 — Capped Level-$k$ Cognitive Hierarchy (`k <= 2`):** Models rival creatures at $k=0$ (reactive), $k=1$ (greedy predictor), or $k=2$ (deceptive `Shoggoth`/`Titan`), bounded by an `ATP` compute cap.

### 4.3 Seven Operational States + Six-Phase Raider `Cold Strike`
- **States (`F6` Port-Hamiltonian Multi-Well Automaton):** `Stillwater` (low-burn charge & refuge), `Gambit` (tactical hunt/forage), `Supernova` (hot high-entropy emergency burst), **`ColdStrike`** (cold zero-hesitation Raider drill), `Raid` (5-caste colony coordination), `Zenkai` (post-damage/post-overdraw supercompensation + `DSD` prune), and `Crossroads` (`Keel` value-conflict arbitration), plus optional host-only zero-ablation dial `Collar`.
- **The 6 Phases of `Cold Strike` (PDF 04 §13):**
  1. **`Recon`:** `Chronoscope` runs quiet `sLTC` scout rollouts, `DSD`-pruned to a minimal elite, yielding target estimate $\hat{x}$ with confidence $c \ge \theta_c$.
  2. **`Go Cold / Feign`:** `Jester` scales bioluminescent/acoustic/motion emissions by $1 - k_f \cdot \text{deceive}$ (`Shoggoth` posture) so predators/rivals underrate salience.
  3. **`Compile & Pre-Clear`:** `LongGame` + `Keel` pre-clear motor drill $d^*$ once upfront; `Wildcard` draws exact strike instant from seeded `QRNG`.
  4. **`Clamp Affect`:** $a(t) \leftarrow \kappa_a a_{\text{raw}}(t)$ with $\kappa_a \to 0$, zeroing $\dot{a}, \ddot{a}, a^{(3)}$ and clamping policy entropy to $H_{\min}$.
  5. **`Commit`:** `Surge` + `Capacitor` execute $d^*$ at maximum muscle gain $g_{\max}$ with **frozen striatal gates** for $T_{\text{cs}}$ (**zero mid-strike hesitation**), paid strictly from conserved `ATP`/`Capacitor` pools.
  6. **`Disengage -> Zenkai`:** Hard exit at drill completion or $T_{\text{cs}}$; unclamp affect smoothly, repay overdraw as `Zenkai` plasticity debt, and merge `Recon` findings via `DSD`.

### 4.4 The Two-Layer Geodesic Biodome ("The One Hard Line")
- **Layer 1 (Inside the Geodesic Dome):** Maximum physical, ecological, and strategic freedom. Deception, camouflage, `DomeStone` tool use, alliance/betrayal, and discovering/exploiting **Reality-Glitch Anomaly Zones** are **first-class rewarded behaviours**.
- **Layer 2 (Read-Only Host Observatory):** Immutable `FP64` First-Law energy auditor, `BSS` stability governor, lesion switches, and `honesty.js` verification probes. Layer 1 has **zero write access** to Layer 2.
