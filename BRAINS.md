# BRAINS.md: a shared brain-design compendium for CQM, A-Life Creature #1 and Glitchling

*Written Mon Nov 2 2026, ~05:50 PHT (UTC+8), by Grok Bot. Box-only document. `cqm-copy/` was read and not modified.*
*This is a design reference, not a build log. Nothing here is implemented unless it is marked **[HAVE]**.*

**Status tags:** **E** = established (solid experimental or engineering consensus) · **S** = speculative (plausible, partially supported, or works only at small scale) · **O** = open (unsolved in neuroscience and/or AI).
**Brain tags:** **CQM** = the CQM world's many-creature brains (`cqm-copy/src/sim/*`, `cqm-copy/src/math/*`) · **C1** = A-Life Creature #1 (`core/organism.ts`, `core/affect.ts`, `core/develop.ts`, `core/fp/*`) · **GL** = Glitchling (`glitchling.ts`, which is C1 plus four flaws: **scramble** = senses re-permuted every 90 ticks, **leak** = learned values decay 6% per tick, **backwards** = 8 MOT neurons reversed and actions mirrored, **misfire** = 20 random synapse jolts every 60 ticks).
**Citations** are author and year only. I included only works I'm confident exist. Where a claim has no citation, treat it as unreferenced, not as sourced.

---
## 0. Seed content (Alex's original brief, saved verbatim in substance)
- **Neuron types:** rate, LIF, Izhikevich, Hodgkin–Huxley, multi-compartment.
- **Parameter types:** weights, delays, plasticity traces, neuromodulators, per-neuron parameters.
- **Math:** delta rule and DeltaNet fast-weight layers, Hebbian/STDP, predictive coding, SSMs (S4/Mamba), liquid time-constant nets, hypernetworks, sparsity, MoE, low-rank and quantized weights.
- **Compute at 100M parameters:**
  - dense ≈ 1e8 multiply-adds per tick, which gives 10–50 ticks/s on CPU;
  - sparse spiking at 2% activity ≈ 2e6 synaptic events per tick;
  - STDP costs 2–3× that.
- **Proposed Glitchling mix:**
  - ~500k Izhikevich/LIF neurons with ~200 synapses each (≈1e8 synapses);
  - int8 weights plus delays;
  - delta-rule fast memory that the leak flaw erodes;
  - LTC limb brains;
  - dopamine and serotonin tied to emotions;
  - ≈200–300 MB total.
- **Real ratios:**
  - worm 302 neurons / ~7k synapses;
  - fly ~140k / ~50M;
  - mouse ~70M / ~1e11;
  - human ~86B / 1e14–1e15;
  - 20–10,000 synapses per neuron.

Corrections and caveats on the seed, discussed in the relevant sections:
1. **Memory budget.** 1e8 synapses × (1 B int8 weight + 1 B delay) = 200 MB *only if* the presynaptic index is implicit: procedurally generated from a seed, or stored as a compressed sparse format with 1–2 B deltas. With explicit 32-bit indices the total is ≈600 MB (§5).
2. **Worm synapse count.** The ~7k figure is chemical synapses. Gap junctions add roughly 900 more, per White et al. 1986 as reanalysed by Varshney et al. 2011.
3. **Human synapse count.** The 86B neuron figure is Herculano-Houzel's. For synapses, 1e14–1e15 is the usual range; treat it as order-of-magnitude.

---
## 1. What the three brains are today [HAVE]
| | CQM | Creature #1 (C1) | Glitchling (GL) |
|---|---|---|---|
| core neurons | Many small per-entity controllers. `sim/entity-brain.ts` is a "50–150 parameter" MLP per entity. `sim/super-mind.ts` and `sim/super-creature.ts` hold the apex creature. Real spiking lives in `math/izhikevich.ts`. | 272 rate neurons in 14 regions (`REGIONS`: SENS16 THAL16 CTX64 HIP32 STR32 HYP16 VTA6 RAPHE6 LC6 BF6 INS8 SCN8 MOT8 ENS48) | Same 272 neurons |
| learning | `sim/plastic-weights.ts` (fast weights), `sim/online-learning.ts`, `sim/learned-recurrence.ts`, `sim/successor-representation.ts`, `math/hopfield.ts`, `sim/reservoir.ts`, `math/predictive-coding.ts`, `sim/active-inference.ts` | Plastic synapse mask, Beta-Bernoulli site values (`bA/bB`), RLS (`rlsLam`), e-prop hooks (`epropLearn`), LTC gates (`core/fp/ltc.ts`, `LTC_LEARNED`), TD (`M35.td*`) | The same, then eroded (leak) and jolted (misfire) |
| modulators | `sim/neuromodulation.ts` (Doya-style meta-parameters), `sim/criticality.ts` | `nm.DA/NE/5HT/ACh` E-levels, cortisol, ghrelin. `core/affect.ts` feeds back into DA/5HT/sleep. | Same |
| workspace | `math/global-workspace.ts`, `sim/attention-controller.ts`, `sim/attention-schema.ts` | `Mind.amp/sal/conf` ignition (`MT` constants) | Same, with scrambled inputs |
| development | `sim/genome.ts`, `sim/connectome.ts` (an axon web rebuilt each update) | `core/develop.ts` `grow()`: genome → wiring, pruning/sprouting | Same, plus misfire acting as somatic mutation |
| honesty notes | Several modules carry self-audits saying their MLPs are untrained: `super-creature.ts`, `xenomimic-brain.ts`, `theory-of-mind.ts`, `metacognition.ts` | Measured; a 2-day run costs ~3 ms/tick | v2 results with n=2 seeds (NOTES.md) |

**Lesson for all three:** the bottleneck is not neuron count. It is whether parameters are *trained by a rule that is driven by consequences*. A 1e8-parameter brain with untrained weights is a random projection. That can be useful (reservoirs, §8.12), but it is not learning.

---
## 2. Neuron models (point neurons)
| # | Model | Core equation / idea | FLOPs per neuron-step | State bytes | Status | CQM | C1 | GL and flaw interaction |
|---|---|---|---|---|---|---|---|---|
|2.1|Rate (sigmoid/ReLU/tanh)|r = f(Σ w x + b)|~2 per synapse; neuron ~5|4|E|Most of `entity-brain.ts` and the MLPs|[HAVE] all 272|Baseline. Scramble permutes inputs; backwards reverses the MOT readout.|
|2.2|Leaky integrator / CTRNN|τ dv/dt = −v + Σ w r|~6|4|E|`learned-recurrence.ts`-style|The LTC substrate|Leak can be modelled literally as a shorter τ|
|2.3|LIF|τ dv/dt = −(v−v_rest) + RI; spike at v>θ, then reset|~5|8 (v, refractory)|E|Port to `math/izhikevich.ts` neighbours|Candidate for the T1 upgrade|Cheapest spiking choice for 500k neurons|
|2.4|Adaptive LIF (ALIF/AdEx)|LIF plus an adaptation current w; AdEx adds an exponential spike onset (Brette & Gerstner 2005)|~10|12|E|—|Required by e-prop's long memory (Bellec et al. 2020)|Leak could act on adaptation as well|
|2.5|Izhikevich|v' = 0.04v²+5v+140−u+I, u' = a(bv−u) (Izhikevich 2003)|~13|8 + 4 params|E|[HAVE] `math/izhikevich.ts`|Recommended spiking core|Per-neuron (a,b,c,d) gives 20+ firing classes. Misfire can mutate (a,b,c,d), not only weights.|
|2.6|Hodgkin–Huxley|4 ODEs with Na/K/leak conductances (Hodgkin & Huxley 1952)|~120–250 (needs small dt)|16+|E|Teaching or demo only|Too costly beyond ~1e3 neurons|Use for 1–8 "showcase" neurons such as giant escape neurons|
|2.7|Resonate-and-fire / theta neuron|Oscillatory subthreshold dynamics|~8|8|E|`sim/resonance.ts` area|Could implement SCN rhythmicity|Scramble on resonant frequency = sensory confusion|
|2.8|Stochastic / escape-noise neuron|p(spike) = g(v)|~6 + 1 RNG|8|E|`math/rng.ts`, QRNG modules|Matches C1's noise-as-exploration|Misfire is an extreme stochastic event|
|2.9|Binary / threshold (McCulloch–Pitts, Hopfield)|s = sign(Σws)|~1|1 bit|E|`math/hopfield.ts`|Attractor memory module|Leak = drift of attractor basins|
|2.10|Graded-potential (non-spiking)|Analog transmission, common in insects and the retina|~3|4|E|—|ENS, sensors|Limb-brain sensory front-ends|
|2.11|Single neuron as a deep net|A cortical L5 neuron's I/O needs a 5–8 layer TCN (Beniaguev et al. 2021)|~1e4–1e5|KB|S|—|—|An argument that "neuron count" undercounts compute|

## 3. Dendrites, compartments and single-cell computation
| # | Item | Status | Cost | CQM | C1 | GL |
|---|---|---|---|---|---|---|
|3.1|Two-layer neuron (dendritic subunits with nonlinearities summed at the soma) (Poirazi, Brannon & Mel 2003)|E|×(1+branches)|Can upgrade `entity-brain` nodes|CTX neurons get 4–8 branches, each receiving a different source (THAL vs HIP)|Scramble a *branch's* input map rather than the whole neuron. This is more realistic and more partial.|
|3.2|Apical/basal coincidence (BAC firing) (Larkum et al. 1999)|E|×2|—|Top-down (prediction) × bottom-up (sense) gating, a natural home for predictive coding|Backwards could swap apical and basal, so predictions get treated as sensations: a "hallucination" mode|
|3.3|Dendritic XOR via calcium spikes in human L2/3 (Gidon et al. 2020)|E (observed), S (role)|small|—|—|A single neuron can solve XOR, so very small limb brains can still be capable|
|3.4|Multi-compartment cable models (NEURON-style)|E|10–1000× a point neuron|No|No|Only for showcase cells|
|3.5|Dendritic plateau / NMDA spikes as local memory|E/S|small|—|`CX.nmdaK` already exists in core|Leak should act more slowly on plateau traces than on weights. That gives a two-timescale memory.|
|3.6|Axonal computation (branch-point failure, delays)|S|small|`connectome.ts` axon web|Delays (§5)|Misfire = branch-point failure events|

## 4. Cell types beyond the generic neuron
| # | Type | What it does | Status | CQM | C1 | GL |
|---|---|---|---|---|---|---|
|4.1|PV basket interneurons|Fast perisomatic inhibition, gamma generation, gain control|E|—|CTX E/I (`CX.eI`, `iE`)|If scramble hits inhibition targets, gamma collapses; that would be a measurable "seizure" marker|
|4.2|SST (Martinotti) interneurons|Dendritic inhibition, gating top-down input|E|—|Pairs with 3.2|They gate whether a prediction reaches the dendrite|
|4.3|VIP interneurons|Disinhibition (VIP→SST), recruited by attention and arousal|E|`attention-controller.ts`|ACh/NE → VIP → opens the cortex|Arousal-driven "glitch windows"|
|4.4|Chandelier cells|Axon-initial-segment control|E (anatomy), O (sign)|—|—|—|
|4.5|Astrocytes (tripartite synapse, Ca²⁺ waves, slow modulation)|Seconds-to-minutes integration, energy coupling (lactate shuttle, debated)|E/S|Could implement `chaos-field.ts`-style slow fields|One astrocyte per ~1e3 synapses holding slow plasticity gates linked to blood glucose|The **leak flaw's natural biological home**: astrocytes "forget" by clearing glutamate slowly or quickly|
|4.6|Microglia (synaptic pruning, inflammation)|Pruning during development; sickness behaviour|E|—|`affect.inflam`, `devPruned`|Inflammation raises pruning, so sickness erodes memory. That is a coupled, non-cosmetic leak.|
|4.7|Oligodendrocytes and myelin plasticity|Activity-dependent conduction speed, so delays are learnable|E/S|—|Delays per projection|A learned delay field can partly compensate for scramble timing|
|4.8|Neurosecretory and neuroendocrine cells|Hormone release (HPA, oxytocin-like)|E|`neuromodulation.ts`|HYP → cortisol/ghrelin [HAVE]|Bonds and nurture (BLUEPRINT areas 48, 77)|
|4.9|Gap-junction (electrical) coupling|Synchrony and fast propagation (inferior olive, worm, interneuron networks)|E|`connectome.ts` could add `kind`|`kind[]` could add an electrical type|Gap junctions spread misfire jolts to neighbours, giving "glitch contagion"|
|4.10|Neuromodulatory nuclei (VTA/SNc DA, raphe 5HT, LC NE, basal forebrain ACh)|Global or broad broadcast of value, patience, surprise, uncertainty|E|`neuromodulation.ts` (Doya 2002 framework)|[HAVE] VTA6 RAPHE6 LC6 BF6|Seed: DA ↔ delight/reward prediction error, 5HT ↔ calm/patience|
|4.11|Peptidergic signalling (≈100 neuropeptides, volume transmission)|Slow, wide, state-setting|E (existence), O (full roles)|—|New "peptide channels" P1..P8 diffusing in a 3-D grid|Peptides are the in-body analogue of the SIMULATED wireless field|
|4.12|Enteric nervous system|A "second brain" in the gut|E|—|[HAVE] ENS48|ENS-to-brain vagal line = interoception|

## 5. Synapses, parameters and storage of "what is learned"
| # | Parameter type | Notes | Bytes per synapse | Status | Use |
|---|---|---|---|---|---|
|5.1|Weight w|fp32 / fp16 / int8 / ternary|4/2/1/0.2|E|All brains|
|5.2|Delay d|Axonal and dendritic; enables polychronization (Izhikevich 2006)|1 (0–255 ticks)|E|GL: delays let a reversed motor still produce valid *sequences*|
|5.3|Eligibility trace e|For 3-factor learning (§7)|2–4|E|C1 e-prop; GL leak should leave e intact but decay w|
|5.4|Pre/post STDP traces|Per neuron, not per synapse (a cheap trick)|0 per synapse, 8 per neuron|E|Required for STDP at scale|
|5.5|Synaptic tag / PRP|Synaptic tagging and capture (Frey & Morris 1997)|1|E|Consolidation; misfire could tag the wrong synapses|
|5.6|Short-term plasticity (u, x per Tsodyks–Markram)|Facilitation and depression|4–8|E|Working memory "for free"; cheap to share per presynaptic neuron|
|5.7|Release probability / stochastic synapses|Noise as exploration|1|E|Matches C1's stochastic style|
|5.8|Per-neuron parameters (threshold, τ, Izhikevich a–d, gain)|1e5–1e6 extra parameters|4–16 per neuron|E|`th[]` [HAVE]; misfire targets|
|5.9|Neuromodulator receptor densities per region|Make DA mean different things per region|small|E|Region tables|
|5.10|Structural parameters (exists or not: sprouting and pruning)|Topology as memory|bit|E|`core/develop.ts` [HAVE]|
|5.11|Fast weights (outer-product memory) A ← λA + η v kᵀ|Seconds-to-minutes memory|d² per head|E (AI), S (brain)|§9.4|

**Storage formats** (for 1e8 synapses):

| format | bytes per synapse | total for 1e8 | notes |
|---|---|---|---|
| COO fp32 (pre, post, w) | 12 | 1.2 GB | simplest; worst |
| CSR fp32 + int32 col | 8 | 800 MB | standard |
| CSR int8 + int32 col + u8 delay | 6 | 600 MB | honest version of the seed mix |
| CSR int8 + u16 local col (block per region ≤65k) + u8 delay | 4 | 400 MB | good |
| procedural connectivity (indices regenerated from seed + hash) + int8 w + u8 d | 2 | **200 MB** | matches the seed. Used by GeNN-style procedural connectivity (Knight & Nowotny 2021). |
| ternary / 2-bit weights + procedural | ~0.3 | 30 MB | S: works for some ANNs (BitNet-style), not yet shown for plastic SNNs |

On disk: little-endian typed-array blobs plus a JSON manifest (region offsets, dtype, scale, seed). Store a snapshot every N ticks as a delta against the last one. `.npy`/`safetensors` are fine for interchange. The C1 `snapshot()/restore()` RNG state accessors already exist.

## 6. Circuits and motifs
| # | Circuit | Function | Status | CQM | C1 | GL |
|---|---|---|---|---|---|---|
|6.1|E/I balanced networks|Asynchronous irregular firing, fast response|E|`criticality.ts`|CTX [HAVE]|Misfire as E/I perturbation; measure recovery time|
|6.2|Winner-take-all / divisive normalization|Choice, gain control (Carandini & Heeger 2012)|E|—|The STR race over 16 sites [HAVE]|Backwards mirrors the winner *after* WTA|
|6.3|Basal ganglia (direct/indirect, D1/D2, action selection, RPE learning)|Choose and learn actions (Schultz, Dayan & Montague 1997 for RPE)|E|`behaviors.ts`|STR32 + VTA [HAVE]|Mirror means RPE credits the wrong action unless an efference copy reports the executed one. C1 credits the visited site [HAVE].|
|6.4|Cerebellum (granule expansion → Purkinje, climbing-fibre error) (Marr 1969; Albus 1971)|Forward models, timing, motor calibration|E|—|**Missing in C1**: add a CB region|**The ideal anti-backwards organ**: learns the motor reversal as an error and corrects it|
|6.5|Hippocampus (DG pattern separation, CA3 autoassociation, CA1 comparison) plus replay|Episodic memory, maps|E|`holographic-memory.ts`, `narrative-memory.ts`|HIP32 [HAVE]|Leak at 6%/tick wipes HIP within ~50 ticks (0.94⁵⁰≈0.045), so replay must outrun the leak|
|6.6|Place cells (O'Keefe & Dostrovsky 1971)|Location code|E|`spatial-hash.ts` for ground truth|Phase 2 2-D world|Scramble of position input → remapping|
|6.7|Grid cells (Hafting et al. 2005)|Metric path integration|E|—|Continuous attractor or oscillatory interference model|Backwards locomotion corrupts path integration in a measurable way|
|6.8|Head-direction cells (Taube et al. 1990); fly ring attractor in the ellipsoid body (Seelig & Jayaraman 2015)|Compass|E|—|8–32-neuron ring attractor|A ring attractor is cheap and robust: a good leak-resistant memory|
|6.9|Insect mushroom body (Kenyon-cell sparse expansion, MBON valence, DAN teaching)|One-shot associative learning|E|Template for `entity-brain` upgrade|An excellent fit for 16-site foraging: sparse KC code + DA-gated MBON|At ~2,000 KCs per fly MB side, cheap. Leak acts on KC→MBON only.|
|6.10|Insect central complex (navigation, steering, vector memory)|Path integration and goal steering|E|—|Pair with 6.8|Steering mirror = a "backwards" testbed|
|6.11|Central pattern generators (half-centre oscillators, Marder lab work)|Rhythmic gait without a brain|E|`super-body.ts` animation (cosmetic today)|—|**Limb brains** (BLUEPRINT): one CPG per leg, coupled by phase. Reversed legs = anti-phase drive.|
|6.12|Thalamocortical loops and the thalamic gate|Attention, sleep spindles|E|`global-workspace.ts`|THAL16 [HAVE]|Scramble at the thalamus = earliest possible corruption|
|6.13|Superior colliculus / tectum|Orienting, multisensory maps|E|`perceptual-priority.ts`|New|Eyes on legs means a remapping problem|
|6.14|Amygdala-like valence circuit|Fast threat learning|E|`valence-steering.ts`|`affect.emo.fear`|Fear conditioning that survives the leak would be an emergent "trauma" result|
|6.15|Spinal reflex arcs (stretch, withdrawal)|Millisecond safety|E|—|—|Limb-local; immune to central scramble|
|6.16|Reservoirs / random recurrent pools|Rich dynamics without training|E|`sim/reservoir.ts`, `quantum-reservoir.ts`|—|Untrained regions are acceptable only if a trained readout exists|

## 7. Oscillations and synchrony
- **Bands:** delta, theta, alpha, beta, gamma, and sharp-wave ripples (Buzsáki 2006, *Rhythms of the Brain*). **E** that they exist and correlate with function. **O** whether they are causal versus epiphenomenal in many cases.
- **Uses:**
  - theta phase coding and phase precession in the hippocampus;
  - gamma for binding/communication-through-coherence (Fries 2005; S);
  - SCN circadian rhythm (C1 SCN8 [HAVE]);
  - sleep slow oscillations and spindles;
  - CPG rhythms (gait).
- **C1:** `mind.plv` (phase-locking binding) [HAVE] measures binding. Grow it into a real oscillator layer.
- **GL:** rewiring every 90 ticks is itself a rhythm. Test whether the brain *entrains* to the 90-tick scramble cycle (an anticipatory remap). That would be a striking emergent result. **O**
- **CQM:** `resonance.ts`, `temporal-crystal.ts`, `strange-attractor.ts` produce rhythms. Couple them to real spikes, or label them decorative.

## 8. Learning rules
| # | Rule | Form | Extra cost vs inference | Status | CQM | C1 | GL and flaw interaction |
|---|---|---|---|---|---|---|---|
|8.1|Hebb (Hebb 1949)|Δw = η·pre·post|1×|E|`plastic-weights.ts`|Plastic mask [HAVE]|Leak counteracts runaway Hebb, so the flaw becomes a feature|
|8.2|Oja / normalised Hebb|Δw = η·y(x − y·w)|1.2×|E|—|PCA-like sensory features|Scramble destroys features every 90 ticks; measure how fast they re-learn|
|8.3|BCM (Bienenstock, Cooper & Munro 1982)|Sliding threshold θ_M ~ ⟨y²⟩|1.2×|E|—|Stabilises CTX selectivity|θ_M also leaks? It is a tunable flaw interaction|
|8.4|Pair / triplet STDP (Markram et al. 1997; Bi & Poo 1998; Pfister & Gerstner 2006)|Timing-dependent|2–3× (seed)|E|Pair with `izhikevich.ts`|Spiking T1+|Delays + STDP = sequence learning that can encode the reversal|
|8.5|Three-factor rules (eligibility × neuromodulator) (Izhikevich 2007; Frémaux & Gerstner 2016)|Δw = η·e·M|+trace|E|`neuromodulation.ts` should gate this|DA RPE [HAVE] × e-trace|**The core rule** for all three. Under backwards, M must use the executed action.|
|8.6|Homeostatic synaptic scaling (Turrigiano et al. 1998); intrinsic plasticity|Keep firing near a set point|small|E|`criticality.ts`|Missing; add|Misfire's jolts are absorbed by scaling. Measure recovery half-life.|
|8.7|Synaptic tagging and capture (Frey & Morris 1997)|Tag now, consolidate later|small|E|—|Use with sleep|Leak should hit untagged synapses first, giving selective forgetting|
|8.8|Metaplasticity (Abraham & Bear 1996)|The plasticity of plasticity|small|E|`neuromodulation.ts`|LR via ACh [HAVE]|After repeated scrambles, LR should rise (volatility learning). C1 has `lrVol`.|
|8.9|e-prop (Bellec et al. 2020)|Online approximation of BPTT using eligibility traces and learning signals|~2×|E (works), S (bio)|—|Hooks exist (`epropLearn`, `o.eprop`)|Train limb brains online|
|8.10|Forward-Forward (Hinton 2022)|Layer-local goodness on positive and negative data|~2× (two passes)|S|—|Sleep could produce the "negative data"|Glitchy inputs are free negative samples|
|8.11|Equilibrium propagation (Scellier & Bengio 2017)|Energy-based; free plus nudged phase|2–3×|S|`math/hopfield.ts` energy|Possible in HIP|—|
|8.12|Reservoir computing: ESN (Jaeger 2001), LSM (Maass, Natschläger & Markram 2002)|Train the readout only|~0|E|[HAVE] `sim/reservoir.ts`|A cheap way to use 1e8 random synapses honestly|Scramble = readout must re-learn; reservoir unchanged|
|8.13|Predictive coding (Rao & Ballard 1999)|Error units, top-down predictions|2×|E (as an algorithm), S (cortex-wide)|[HAVE] `math/predictive-coding.ts`|`pred.err`, NIS surprise [HAVE]|Scramble → error spike → raised LR (a good adaptive loop)|
|8.14|Active inference / free-energy principle (Friston 2010)|Minimise expected free energy|varies|S (as a unifying theory), E (as a modelling toolkit)|[HAVE] `sim/active-inference.ts`|`efeK`, `efeTau` in `M35` [HAVE]|The creature acts to *reduce* uncertainty caused by flaws, e.g. probing to detect a remap|
|8.15|Classical Hopfield (Hopfield 1982); modern/dense Hopfield ≈ attention (Ramsauer et al. 2020)|Associative memory with exponential capacity|attention cost|E|[HAVE] `math/hopfield.ts`|HIP CA3|Leak shrinks basins; misfire creates spurious attractors (false memories)|
|8.16|TD learning and successor representation (Dayan 1993)|Value and predictive maps|small|E|[HAVE] `successor-representation.ts`|TD [HAVE]|—|
|8.17|RLS / Kalman learning|Fast optimal linear learning|O(n²)|E|—|[HAVE] `rlsLam`, Kalman-style NIS|Leak = forgetting factor λ. This is mathematically the same as RLS forgetting.|
|8.18|Neuroevolution: NEAT (Stanley & Miikkulainen 2002), HyperNEAT (Stanley, D'Ambrosio & Gauci 2009)|Evolve topology / CPPN-encoded weights|population × eval|E|`super-evolution.ts`, `self-evolution-loop.ts`|Across generations (`devGenome`)|Misfire as a mutation operator|
|8.19|Neural cellular automata (Mordvintsev et al. 2020, "Growing NCA")|Local update rules grow and regenerate patterns|per-cell MLP|E (images), S (brains)|`reaction-diffusion.ts`|Grow body and wiring|Regeneration after misfire damage|
|8.20|Developmental and indirect encodings (genome → growth rules → connectome)|Compression: a small genome yields a big brain|—|E (principle), O (how biology does it)|`genome.ts`, `connectome.ts`|[HAVE] `core/develop.ts`|**The only realistic way to reach 1e8 synapses**: grow them, don't store them independently|
|8.21|Backprop through time / surrogate gradients for SNNs (Neftci, Mostafa & Zenke 2019)|Offline training|3–10×, memory heavy|E|—|Offline pretraining only|Not online-biological|
|8.22|Meta-learning (learning-to-learn plasticity rules)|Evolve or optimise the rule, not the weights|outer loop|S|—|Evolve `M35` constants|Evolve a rule that is *robust to the four flaws*|
|8.23|Sleep: synaptic homeostasis (Tononi & Cirelli 2006), replay (Wilson & McNaughton 1994), complementary learning systems (McClelland, McNaughton & O'Reilly 1995)|Offline consolidation|replay ticks|E/S|`memory-orchestra.ts`|`S`, `stage`, `remAll`/`remLr` [HAVE]|Replay is the main counter to the leak. Prediction: GL needs more sleep than C1. That is a testable hypothesis.|

## 9. AI architectures (and what transfers)
| # | Architecture | Compute per token/tick | Memory over time | Status | CQM | C1 | GL |
|---|---|---|---|---|---|---|---|
|9.1|Transformer (Vaswani et al. 2017)|O(L·d) per token with a KV cache, O(L²) to train|KV cache grows with L|E|Copilot/LLM side only|Unsuitable for a 1-minute tick life of 1e5+ steps|—|
|9.2|Linear attention (Katharopoulos et al. 2020)|O(d²) per step|Fixed d² state|E|—|A plausible "cortical fast memory"|—|
|9.3|Fast-weight programmers ≈ linear transformers (Schlag, Irie & Schmidhuber 2021)|O(d²)|d²|E|`plastic-weights.ts` is this family|—|—|
|9.4|DeltaNet (delta-rule fast weights: S ← S − β(S k − v)kᵀ); parallel training (Yang et al. 2024)|O(d²)|d²|E|—|HIP fast memory|**Seed**: leak = decay of S, so GL's flaw *is* a gated-delta forgetting gate stuck at 0.94|
|9.5|Gated DeltaNet (Yang, Kautz & Hatamizadeh, 2024 preprint)|O(d²)|d² with a learned decay α|E (recent)|—|α driven by ACh/novelty|GL: compare a learned α against the forced 0.94; the creature could learn to *counter* the leak with higher β|
|9.6|SSMs: S4 (Gu, Goel & Ré 2022), Mamba (Gu & Dao 2023)|O(d·N)|Fixed|E|—|Interoceptive and long-horizon traces|Scramble on input projection only|
|9.7|RWKV (Peng et al. 2023)|O(d)|Fixed|E|—|Same niche as SSMs|—|
|9.8|Liquid time-constant nets (Hasani et al. 2021); closed-form CfC|O(d²) with an ODE step|Fixed|E|—|[HAVE] `core/fp/ltc.ts`, `LTC_LEARNED`|Seed: **LTC limb brains**. Small, robust, interpretable; tens of neurons per leg|
|9.9|Neural ODEs (Chen et al. 2018)|Solver steps|Fixed|E|`eshkol-*` AD tools|Continuous-time body/brain coupling|—|
|9.10|Hypernetworks (Ha, Dai & Le 2016)|A net generates weights|Generator size|E|—|Genome → weights (ties to 8.20)|Misfire in the hypernet = a structured, not random, mutation|
|9.11|Mixture of experts (Shazeer et al. 2017; Switch: Fedus, Zoph & Shazeer 2021)|Only k of E experts active|Params ≫ FLOPs|E|Many creature brains are already "experts"|Per-context experts (forage, flee, nurture)|Scramble the router = a striking glitch. Leak on router = indecision.|
|9.12|Low-rank adapters (LoRA, Hu et al. 2021)|ΔW = BA|small|E|—|Per-life adaptation on top of an inherited W|Inherit W, learn LoRA within life; leak applies only to LoRA. A clean split.|
|9.13|Quantization (int8, LLM.int8() by Dettmers et al. 2022; 1-bit/ternary BitNet-style)|×2–8 memory saving|—|E (inference), S (plastic training)|`math/quantization.ts`|int8 for T3|int8 rounding means small leak steps vanish. Use stochastic rounding or the leak silently stops.|
|9.14|Sparsity: lottery tickets (Frankle & Carbin 2019), pruning, k-WTA|×10–100 FLOP saving|—|E|—|`devPruned` [HAVE]|—|
|9.15|KANs (Liu et al. 2024)|Learnable edge functions (splines)|Higher per-edge cost|S|—|Interpretable small modules (limb reflexes)|—|
|9.16|World models (Ha & Schmidhuber 2018); Dreamer (Hafner et al. 2020; DreamerV3 2023)|Learn latent dynamics and imagine rollouts|+model|E|`active-inference.ts`|`mind.Tm`, `plan` [HAVE]|Imagined rollouts let the creature rehearse the mirror mapping|
|9.17|JEPA (LeCun 2022 position paper; I-JEPA, Assran et al. 2023)|Predict in embedding space, not pixels|—|S (for agents)|—|A predictive-coding cousin|Robust to sensory scramble if the embedding is permutation-invariant|
|9.18|Continual learning: EWC (Kirkpatrick et al. 2017), generative replay|Avoid catastrophic forgetting|+Fisher or replay|E (partial), O (fully solved)|`online-learning.ts`|Needed|GL's leak is the opposite problem (forced forgetting). The pair makes a stability–plasticity experiment.|
|9.19|Spiking transformers / neuromorphic hardware (Loihi, SpiNNaker)|Event-driven|—|E (hardware exists), S (parity with ANNs)|—|—|Box has neither|
|9.20|Diffusion / energy-based generative models|Dreaming and imagination|heavy|E|Tsotchke art|Sleep "dreams" as generated replay|Glitch art = sampling from the misfire distribution (cosmetic unless coupled)|

## 10. Embodiment, reflexes, interoception and affect
| # | Item | Status | CQM | C1 | GL |
|---|---|---|---|---|---|
|10.1|Morphological computation (body dynamics do part of the computation) (Pfeifer & Bongard 2006)|E|`super-body.ts` (render)|Body plan in BLUEPRINT §2|Soft hydrostat body + CPG = gait with almost no brain|
|10.2|Reflex hierarchy (spinal → brainstem → cortex)|E|—|—|Limb brains handle reflexes. Central scramble cannot break reflexes, so the creature survives "brain glitch storms".|
|10.3|Efference copy and corollary discharge|E|`embodiment.ts` forward body model|`rate[MOT]` → prediction|**Key to detecting the backwards flaw**: predicted vs actual sensory consequence mismatch|
|10.4|Interoceptive inference (Seth 2013)|S|`nhsi-affect-binding.ts`|INS8 + `intero[]` [HAVE]|Leak on interoceptive priors gives anxiety-like volatility|
|10.5|Affect models: core affect valence×arousal (Russell 1980), constructed emotion (Barrett 2017), basic-emotion circuits (Panksepp 1998)|E (dimensional), contested (which theory)|`valence-steering.ts`|[HAVE] emotion→mood→attitude→persona layers|Seed: DA ↔ delight/RPE, 5HT ↔ calm/patience (Doya 2002 framing). NE ↔ fear/surprise, ACh ↔ uncertainty.|
|10.6|Homeostatic reinforcement learning (reward = drive reduction)|S|—|C1's "no designer reward" rule [HAVE]|—|
|10.7|Pain and nociception as a teaching signal|E|—|`integrity`, `damage()` [HAVE]|—|
|10.8|Sensor diversity (chemo, vision, mechanosense, thermal, electro, magneto)|E|`apex-field-organs.ts`|`sens` 4×4 + "alien" field senses [HAVE]|Scramble per modality|
|10.9|Distributed brains (octopus arms hold most neurons)|E|—|—|The **legs-with-brains** precedent: in the octopus, a large majority of neurons are in the arms|
|10.10|Wireless/psychic coupling (SIMULATED)|Not a biological claim|`social-field.ts`, `mind-field.ts`|—|A broadcast field as an extra modality. Real analogues: pheromones, electric-fish signalling, bioluminescence.|

## 11. Compute cost table (per tick, per brain, at stated size)
Assumptions:
- CPU: this box, 8 cores, no GPU; JS/WASM typed arrays; ~1–5 GFLOP/s effective per core for irregular sparse work; ~10–30 GFLOP/s for dense SIMD.
- GPU: one 24 GB consumer card, ~10–40 TFLOP/s dense, far less for scattered sparse access.
- Numbers are order-of-magnitude estimates, not benchmarks.

| config | ops per tick | bytes touched per tick | CPU ticks/s (8 cores) | GPU ticks/s | resident memory |
|---|---|---|---|---|---|
| C1 today, 272 rate neurons (~1e4 syn) | 1e4 | 40 KB | ~300 (measured ~3 ms/tick including metabolism and affect) | n/a | <1 MB |
| 1e4 LIF × 100 syn, 2% active | 2e4 events | 100 KB | 1e3+ | n/a | 4 MB |
| 1e5 Izh × 200 syn (fly-ish count) | 4e5 events + 1.3e6 neuron FLOPs | 2 MB | 100–300 | 1e3+ | 40–80 MB |
| **Seed GL: 5e5 Izh × 200 syn = 1e8 syn, 2% active** | 2e6 events + 6.5e6 neuron FLOPs | ~10 MB random access | **20–60** | 300–1000 | **200 MB** (procedural) – 600 MB (CSR) |
| + STDP / three-factor | ×2–3 | ×2 | 8–25 | 100–400 | +100–400 MB traces |
| 1e8 dense rate weights (MLP-like) | 1e8 MAC | 100–400 MB streamed | **10–50** (seed) | 1e3+ | 100–400 MB |
| 1e6 neurons × 1e3 syn = 1e9 syn | 2e7 events | 100 MB | 2–5 | 50–100 | 2–6 GB (exceeds free RAM with CSR) |
| 1e8 neurons × 100 syn = 1e10 | 2e8 events | GBs | <0.5 | 5–10 (multi-GPU) | 20–60 GB |
| HH, 1e3 neurons, dt 0.025 ms, 1 ms tick | 1e3·250·40 = 1e7 | small | ~100 | — | small |

**Latency per tick:** one tick is one sim-minute in C1/GL. Real-time is therefore not required for science runs. Interactive render wants ≥10–30 ticks/s; 1e8 synapses on CPU is on that edge. **Biological time per tick:** 1 tick = 1 minute is far too coarse for spikes. Use ms-scale substeps inside each tick (e.g. 10–100 substeps), which multiplies all costs above by 10–100. This is the most important caveat in this table. **Options:** spike only in limb brains and sensors (fast), keep the central brain rate-coded per tick (slow), or decouple clocks so each region gets its own dt.

## 12. Scaling ladder
| tier | neurons | synapses | syn/neuron | nearest biology | neuron model | learning | fits on | status for GL |
|---|---|---|---|---|---|---|---|---|
| L0 | 272 | ~1e4 | ~40 | between worm (302 / ~7k) and larval zebrafish front ends | rate | Beta, RLS, TD, e-prop hooks | anything | [HAVE] |
| L1 | 1e3 | 1e5 | 100 | — | rate + LTC limbs | +three-factor | CPU, 1 thread | Phase 1 |
| L2 | 1e4 | 1e6 | 100 | parts of insect ganglia | LIF/Izh | STDP + DA | CPU | Phase 2 |
| L3 | 1.4e5 | 2e7–5e7 | 150–350 | **fly** (~140k / ~50M; FlyWire, Dorkenwald et al. 2024) | Izh + mushroom body + central complex | 3-factor + homeostasis + replay | CPU workers / GPU | Phase 3 |
| L4 | **5e5** | **1e8** | 200 | ~2× fly synapses | Izh/LIF, int8 + delays | + fast weights, sleep | CPU 20–60 tps; GPU interactive | **seed target** |
| L5 | 1e6–1e7 | 1e9–1e10 | 1e3 | honeybee (~1e6 neurons), small fish | mixed | grown, not stored | GPU 24–80 GB | aspirational |
| L6 | 7e7 | 1e11 | ~1e3 | mouse | — | — | GPU cluster | out of scope |
| L7 | 8.6e10 | 1e14–1e15 | 1e3–1e4 | human | — | — | none today in biologically detailed form | out of scope |

Note: "100M parameters, 100M connectome nodes and 100M synapses" (BLUEPRINT) maps to **L4 by synapses/parameters**. 100M *neurons* at ~1 synapse per neuron is not brain-like. Real tissue has 20–10,000 synapses per neuron.

## 13. Recommended build order per brain
**Creature #1 (C1):** stays the clean reference. Change only behind flags so the existing measured results stay reproducible.
1. Add a cerebellum-like CB region (granule expansion → Purkinje, climbing-fibre error from efference mismatch) (§6.4).
2. Homeostatic scaling and intrinsic plasticity (8.6).
3. Promote the e-prop hooks to the default online learner for MOT/STR (8.9) with three-factor DA gating (8.5).
4. A mushroom-body module for site learning (6.9). Compare it against the current Beta-Bernoulli learner on the same seeds.
5. Sleep replay with tagging (8.7, 8.23).
6. L2 spiking substrate for CTX/HIP via `math/izhikevich.ts` (port by copy), keeping rate readouts so `regionRate` stays compatible with the brain viz.

**Glitchling (GL):** inherits C1. Every addition is run flaws-on and flaws-off.
1. LTC limb brains (9.8, reusing `core/fp/ltc.ts`) with CPGs (6.11) and local reflexes (10.2). BLUEPRINT Phase 1.
2. A gated-delta fast memory (9.5) whose decay is *set by* the leak flaw. Then let a learned β fight back.
3. Efference-copy mismatch detector plus cerebellum (10.3, 6.4) to detect and learn the backwards mapping. Metric: the success gap closes over life.
4. Volatility-tuned learning rate (8.8, 8.13): scramble → surprise → LR boost. Test entrainment to the 90-tick cycle (§7).
5. Misfire becomes structured: per-neuron parameter and hypernet mutations (5.8, 9.10), spread via gap junctions (4.9). Somatic jolts become separate from germline ones.
6. Scale to L3, then L4, with procedural connectivity + int8 + delays (§5 formats), event-driven, in workers. Target 200 MB; measure ticks/s and report it honestly.
7. Sleep as the counter-leak (8.23). Hypothesis to test: GL needs more sleep than C1.

**CQM:**
1. **Honesty pass first:** every module with an "untrained" self-audit gets either a real learning rule driven by consequences or a clear "decorative" label. Start with `xenomimic-brain.ts` (`mimicBasin` ≡ 0.5), `theory-of-mind.ts` and `super-creature.ts`.
2. Replace per-entity random MLPs (`entity-brain.ts`) with a shared small mushroom-body + basal-ganglia template trained by three-factor rules. Parameters stay ~1e2–1e3 per entity, so thousands of creatures still fit.
3. Make `neuromodulation.ts` gate the plasticity of those templates (8.5, 8.8).
4. Batch the population brains on GPU/WebGPU following `core/wilderness-webgpu.ts`. CQM's scaling axis is *many brains* (1e3–1e4 creatures × 1e3 synapses), not one huge brain.
5. Couple `social-field.ts`/`mind-field.ts` as a sensory modality with real costs (shared with GL's SIMULATED field).
6. Optionally host one GL instance at L3/L4 as the "apex" creature, with the rest kept small.

## 14. Flaw × brain-component interaction matrix (GL)
| component | scramble (perm/90) | leak (6%/tick) | backwards (MOT + mirror) | misfire (20 jolts/60) |
|---|---|---|---|---|
| rate core [HAVE] | Site values seen through a permutation | wSite → 0.25 | Mirror site | Weight jolts |
| spiking core | Afferent bundle permutation | Weight decay; traces spared | MOT readout order | Spike bursts / parameter jolts |
| fast weights (delta) | Wrong keys → wrong recalls | **Is** the decay gate | — | Spurious associations |
| LTC limbs | Uplink permuted | Gates relax to init (`LTC_INIT`) | Per-leg `rev` | τ jolts → tremor |
| mushroom body | KC code reshuffled | KC→MBON decay | — | False valence |
| cerebellum | — | Calibration drift | **Learns to undo** | Purkinje noise |
| hippocampus | Remapping | Erases in ~50 ticks unless replayed | Path-integration error | False memories (spurious attractors) |
| neuromodulators | Cue→DA mis-association | Expectation decays → inflated RPE | RPE credited to the wrong action unless the executed one is used | DA bursts → impulsive acts |
| affect | Surprise → fear/NE up | Mood priors volatile | Frustration from failures | Startle |
| genome / development | — | — | — | Germline mutation channel |

## 15. Measurement: how to know the brain is doing real work
- **Lesion tests:** turn a module off and the behaviour metric must change. C1 already supports lesions (`recLesion`, `affectLesion`, etc.).
- **Ablation vs flaw:** each flaw on/off × each module on/off, ≥8 seeds; report mean ± 95% CI. The current n=2 is too small (NOTES.md shows ±0.1 noise).
- **Compensation curves:** first half vs second half success, and time-to-recover after each scramble event (from `events[]`).
- **Information measures:** mutual information between region activity and site/action. Integrated information (`sim/integrated-information.ts`) is **S/O** as a consciousness measure; use it only as a descriptive statistic.
- **Coupling test:** the BLUEPRINT "nothing cosmetic" gate.

## 16. Open problems and gaps (neuroscience and AI)
| # | Problem | Why it matters here | Status |
|---|---|---|---|
|16.1|How credit assignment works in real brains (beyond three-factor rules)|Determines whether a 1e8-synapse GL can learn anything with local rules|O|
|16.2|How a genome of finite size specifies a brain (developmental compression)|Our only path to 1e8+ synapses|O|
|16.3|Role of dendritic computation in cognition at scale|Could multiply effective compute per neuron by 10–1000×|O|
|16.4|Astrocyte and glia computation|Possible slow-memory layer; contested|O|
|16.5|Continual learning without catastrophic forgetting, and *with* graceful forgetting|GL's leak is a forced-forgetting regime; nobody has a full theory of optimal forgetting|O|
|16.6|Whether oscillations are causal|Decides whether to model them|O|
|16.7|Neural basis of emotion and feeling, and whether affect models amount to feelings|C1/GL "emotions" are functional variables only. No claim of experience.|O|
|16.8|Consciousness measures (IIT, GWT, etc.)|CQM has many "consciousness" modules; all are speculative|O|
|16.9|Connectome → behaviour prediction|The fly connectome exists, but simulating it does not yet reproduce full behaviour|O (active)|
|16.10|Sample-efficient world models in open environments|Dreamer-class methods need many steps; C1 lives ~1e3–1e4 ticks/day|O|
|16.11|Robust learning under sensor remapping (scramble)|Few studies on permutation-invariant sensing in embodied agents|O, **a niche GL can actually probe**|
|16.12|Open-endedness: why evolution keeps innovating|`open-endedness.ts`; GL lineages|O|
|16.13|Efficient sparse plastic SNN training on commodity hardware|Our compute bottleneck|O (partial tools exist)|
|16.14|Quantized plastic synapses (int8 learning without bias)|Seed mix depends on it; needs stochastic rounding|S|
|16.15|Body–brain co-evolution|Legs-with-brains, morphing body|O|
|16.16|Collective / wireless cognition (SIMULATED here)|No biological psychic channel; real collectives use chemistry, sound, light|E (that it is fictional); O (how collective cognition scales)|
|16.17|Sleep's function|Our counter-leak hypothesis is testable in-sim|O|
|16.18|Interpretability of learned agents|Brain viz shows activity, not meaning|O|

## 17. Glossary of variables shared across the three brains (proposed)
`rate[]`, `regionRate{}`, `syn.{pre,post,w,plastic,delay}`, `trace.{pre,post,elig}`, `nm.{DA,NE,5HT,ACh}`, `peptide[8]`, `fast.S` (delta memory), `lb[j].{ltc,cpg,rev}`, `cb.{err,out}`, `mb.{kc,mbon}`, `osc.{theta,gamma,phase}`, `glia.{ca,gate}`, `sleep.{S,stage,replay}`, `flaw.{perm,leak,rev,jolts}`. Export names match BLUEPRINT's `state_v2.jsonl` schema so the render reads the same fields for all three brains.

## 18. What is real vs aspirational, in one paragraph
**Real now:**
- C1/GL's 272-neuron rate brain, with neuromodulators, layered affect, a grown connectome, e-prop/LTC hooks and four measurable flaws;
- CQM's working Izhikevich, predictive-coding, global-workspace, Hopfield and reservoir code;
- many CQM "mind" modules that self-report as untrained.

**Buildable on this box in days:** L1–L3 brains with limb LTC networks, cerebellar error correction, mushroom-body learning, and sleep replay.

**Buildable in weeks (CPU, slow) or interactively (GPU):** the seed's L4 ~1e8-synapse brain at ~200–600 MB.

**Aspirational:**
- anything "beyond the fly brain" in *capability*, as opposed to count;
- 1e8 neurons;
- the psychic/wireless features, which stay SIMULATED mechanics by definition.
