# NEURO_FRONTIER — neuroscience frontier sweep, 2023–2026 (plus a few older anchors)

Compiled 2026-11-02 (PHT). Every link below came up in web search results during this sweep. Nothing is invented. Solidity scale:
**established** (replicated or a flagship peer-reviewed dataset) · **promising** (strong single peer-reviewed result) · **preliminary** (preprint, company claim, or small n) · **fringe** (minority or contested framing).
Targets: **GL** = Glitchling, **C1** = Creature #1, **CQM** = the cqm-copy core. Every idea here is a *simulation* proposal (simulated). None of it claims real biology runs in our code.
Images: `research/img/` (see `img/SOURCES.md`).

## 1. Whole-brain connectomes
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 1 | FlyWire: complete adult fly brain, 139,255 neurons, 54.5M synapses | https://www.nature.com/articles/s41586-024-07558-y | 2024 | established | CQM: import FlyWire region-level adjacency as a prior for our 14-region wiring |
| 2 | 8,453 cell types annotated across the fly brain | https://www.nature.com/articles/s41586-024-07686-5 | 2024 | established | CQM: add a `cell_type` field. Type-level rules scale better than per-neuron rules |
| 3 | MICrONS: 1 mm³ of mouse visual cortex, >200k cells, 523M synapses, 75k neurons functionally imaged | https://www.nature.com/articles/s41586-025-08790-w | 2025 | established | C1: a function-plus-wiring benchmark for our visual areas |
| 4 | "Like-to-like": neurons with similar tuning preferentially connect | https://www.nature.com/articles/s41586-025-08840-3 | 2025 | established | CQM: a develop.grow rule that biases synapse formation by tuning correlation |
| 5 | H01: 1 mm³ of human cortex, ~57k cells, 150M synapses, 1.4 PB; glia outnumber neurons ~2:1; rare axon inputs with up to 50 synapses | https://www.science.org/doi/10.1126/science.adk4858 | 2024 | established | GL: rare "super-synapses" as a misfire target, so one jolt there has outsized effect |
| 6 | Zebrafish larva whole-brain EM (Fish1): 187k cells, 30M synapses | https://www.biorxiv.org/content/10.1101/2025.06.10.658982v1 | 2025 | preliminary | C1: a vertebrate-scale target (~1e5) for the scaling roadmap |
| 7 | Fish-X: zebrafish connectome with multiplexed molecular labels | https://www.biorxiv.org/content/10.1101/2025.06.12.659365v3 | 2025 | preliminary | CQM: attach neurotransmitter identity per neuron, not per region |
| 8 | MANC (fly ventral nerve cord) / BANC (brain + nerve cord together) | https://doi.org/10.7554/elife.97766 · https://www.biorxiv.org/content/10.1101/2025.07.31.667571v2.full.pdf | 2024/25 | established / preliminary | GL: model the "backwards" flaw in a spinal-cord-like MOT relay layer instead of directly on the output neurons |

## 2. Connectome → behaviour emulation
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 9 | LIF model of the whole fly brain with essentially one free parameter predicts feeding/grooming circuits | https://www.nature.com/articles/s41586-024-07763-9 | 2024 | promising | CQM: proof that a cheap LIF on a good wiring diagram does useful work. Supports our CPU-only path |
| 10 | Connectome-constrained deep nets predict fly motion-vision responses | https://www.nature.com/articles/s41586-024-07939-3 | 2024 | promising | CQM: train only time constants and gains on a fixed wiring |
| 11 | NeuroMechFly v2: fly body + vision + olfaction in physics sim | https://www.nature.com/articles/s41592-024-02497-y | 2024 | established | C1: template for closing the brain–body–world loop |
| 12 | Janelia/DeepMind whole-body fly model (MuJoCo, flight + walking) | https://www.nature.com/articles/s41586-025-09029-4 | 2025 | promising | C1: borrow its body-control abstraction |
| 13 | Eon Systems: FlyWire-based brain driving an embodied fly | https://eon.systems/updates/embodied-brain-emulation | 2026 | preliminary (company blog) | GL: demo ref — "a whole emulated brain glitching in a body" |
| 14 | BAAIWorm: 136 multicompartment C. elegans neurons in a closed body–environment loop | https://www.nature.com/articles/s43588-024-00738-w | 2024 | promising | C1: smallest closed-loop baseline. Test the GL flaws on it first |
| 15 | Mouse visual cortex "foundation model" / digital twin generalizes to new stimuli | https://www.nature.com/articles/s41586-025-08829-y | 2025 | promising | CQM: a learned surrogate for expensive areas |

## 3. Cell atlases
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 16 | Whole mouse brain atlas: 5,322 transcriptomic clusters | https://www.nature.com/articles/s41586-023-06812-z | 2023 | established | CQM: our 14 regions are coarse; add subtypes per region as needed |
| 17 | Human brain atlas: 3,313 subclusters | https://www.science.org/doi/10.1126/science.add7046 | 2023 | established | same |

## 4. Glia & non-synaptic signalling (the weird middle)
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 18 | Astrocyte ensembles are tagged during learning and their reactivation drives recall | https://www.nature.com/articles/s41586-024-08170-w | 2024 | promising | CQM: an astrocyte layer storing a slow memory trace |
| 19 | Astrocytes carry a multiday memory trace | https://www.nature.com/articles/s41586-025-09619-2 | 2025 | promising | GL: "leak" could drain the astrocyte trace too, giving slow forgetting |
| 20 | Ephaptic coupling: electric fields may steer neural ensembles ("cytoelectric coupling") | https://academic.oup.com/cercor/article/33/17/9877/7220593 | 2023 | fringe-to-preliminary | GL: a field term added to all neurons in a region. Our scramble noise could be field-shaped |
| 21 | Ephaptic coupling between neurons, eLife | https://doi.org/10.7554/elife.88335 | 2023 | promising | same, as a mechanism-grounded version |
| 22 | Glymphatic clearance *reduced* during sleep/anaesthesia (Franks lab) | https://doi.org/10.1038/s41593-024-01638-y | 2024 | contested | CQM: model "waste" clearance as a tunable, not settled, parameter |
| 23 | Norepinephrine-driven vasomotion drives glymphatic clearance in sleep (Nedergaard) | https://www.cell.com/cell/fulltext/S0092-8674(24)01343-6 | 2025 | contested | same. These two results disagree, so present both |

## 5. Memory & learning beyond neurons
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 24 | Kidney (non-neural) cells show the massed-spaced learning effect | https://www.nature.com/articles/s41467-024-53922-x | 2024 | promising | GL: give metabolism cells a spacing-sensitive memory variable |
| 25 | Awake sharp-wave ripples tag which experiences get consolidated | https://www.science.org/doi/10.1126/science.adk8261 | 2024 | promising | CQM: a ripple-tag flag gating sleep replay |
| 26 | Physarum stores memory in its tube diameters | https://www.pnas.org/doi/abs/10.1073/pnas.2007815118 | 2021 | promising | GL: a "tube-width" memory in which leak thins the tubes |
| 27 | Physarum reproduces the Tokyo rail network | https://www.science.org/doi/10.1126/science.1177894 | 2010 | established | C1: navigation without neurons as a baseline |
| 28 | Box jellyfish (Tripedalia) learn associatively with no central brain | https://www.cell.com/current-biology/fulltext/S0960-9822(23)01136-3 | 2023 | promising | GL: a minimal ring-net mode |
| 29 | Plants: glutamate triggers long-distance Ca²⁺ wound signalling | https://www.science.org/doi/full/10.1126/science.aat7744 | 2018 | established | C1: a slow body-wide alarm channel |
| 30 | Stressed plants emit airborne ultrasonic clicks | https://www.cell.com/cell/fulltext/S0092-8674(23)00262-3 | 2023 | promising | GL: emit "distress clicks" that other creatures can hear (simulated) |
| 31 | Octopus arm nerve cord is segmented, giving modular arm control | https://www.nature.com/articles/s41467-024-55475-5 | 2025 | promising | C1: per-limb semi-autonomous mini-brains |
| 32 | Bioelectric patterning and basal cognition (Levin review) | https://link.springer.com/article/10.1007/s10071-023-01780-3 | 2023 | promising (theory-heavy) | GL: a voltage-pattern body plan that scramble can corrupt |
| 33 | Anthrobots: human-tracheal-cell bots that help heal neuron scratches | https://pmc.ncbi.nlm.nih.gov/articles/PMC10811512/ | 2023 | promising | C1: spawn helper "bots" in the world |
| 34 | Xenobots self-replicate kinematically | https://www.pnas.org/doi/full/10.1073/pnas.2112672118 | 2021 | promising | GL: breeding by pushing debris together (simulated) |
| 35 | Gut "neurobiotic sense": bacterial flagellin → TLR5 → vagal satiety signal | https://www.nature.com/articles/s41586-025-09301-7 | 2025 | promising | CQM: microbiome input to the metabolism/affect layer |

## 6. Wetware & biocomputing
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 36 | DishBrain: cultured neurons learn Pong | https://www.cell.com/neuron/fulltext/S0896-6273(22)00806-6 | 2022 | promising (interpretation debated) | GL: a "free-energy" training mode with predictable reward and noise punishment |
| 37 | Cortical Labs CL1 commercial neuron computer | https://www.abc.net.au/news/science/2025-03-05/cortical-labs-neuron-brain-chip/104996484 | 2025 | preliminary (product news) | jam narrative only |
| 38 | FinalSpark Neuroplatform: remote-access organoid computing | https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2024.1376042/full | 2024 | preliminary | same |
| 39 | Brainoware: organoid reservoir computing, vowel task ~51%→78% | https://www.nature.com/articles/s41928-023-01069-w | 2023 | promising | CQM: a reservoir-readout mode for an untrained GL |

## 7. Brain–computer interfaces & decoding
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 40 | Speech BCI at 97.5% word accuracy (ALS) | https://www.nejm.org/doi/full/10.1056/NEJMoa2314132 | 2024 | established | C1: a "voice" decoded from MOT/language areas |
| 41 | Instantaneous brain-to-voice synthesis | https://www.nature.com/articles/s41586-025-09127-3 | 2025 | promising | same |
| 42 | Inner-speech decoding, gated by a mental password | https://www.cell.com/cell/fulltext/s0092-8674(25)00681-6 | 2025 | promising | GL: "thought leak" gated by a password-like state (simulated) |
| 43 | Neuralink "A Year of Telepathy" (cursor control) | https://archive.ph/i0GEg | 2025 | preliminary (company) | narrative |
| 44 | Synchron COMMAND: endovascular BCI safety endpoint met | https://www.businesswire.com/news/home/20240930433219/en/Synchron-Announces-Positive-Results-from-U.S.-COMMAND-Study-of-Endovascular-Brain-Computer-Interface | 2024 | preliminary (press release) | narrative |
| 45 | MindEye2: fMRI→image with ~1 h of subject data | https://proceedings.mlr.press/v235/scotti24a.html | 2024 | promising | GL: render "what it sees" from VIS activations; scramble makes the dreams visibly glitchy |
| 46 | fMRI→image via latent diffusion (Takagi & Nishimoto) | https://openaccess.thecvf.com/content/CVPR2023/html/Takagi_High-Resolution_Image_Reconstruction_With_Latent_Diffusion_Models_From_Human_Brain_CVPR_2023_paper.html | 2023 | promising | same |

## 8. Consciousness & quantum-brain claims
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 47 | COGITATE adversarial test: neither IIT nor GNWT fully validated | https://www.nature.com/articles/s41586-025-08888-1 | 2025 | established (as a null-ish result) | CQM: expose both Φ-proxy and ignition metrics; claim neither |
| 48 | Microtubule-stabilising drug delays anaesthetic unconsciousness in rats (framed as quantum support) | https://www.eneuro.org/content/11/8/ENEURO.0291-24.2024 | 2024 | fringe (data real, interpretation fringe) | GL: a "microtubule coherence" stat, explicitly SIMULATED flavour |
| 49 | Tryptophan superradiance in microtubule networks | https://pubs.acs.org/doi/10.1021/acs.jpcb.3c07936 | 2024 | preliminary (physics real, cognitive role fringe) | same |

## 9. Neuromorphic hardware
| # | Claim | Source | Yr | Solidity | Idea |
|---|---|---|---|---|---|
| 50 | Intel Hala Point: 1.15B neurons, 128B synapses | https://www.intel.com/content/www/us/en/newsroom/news/intel-builds-worlds-largest-neuromorphic-system.html | 2024 | established (hardware) | scaling note: 1e9 is achievable on dedicated hardware but not on our 8-core box |
| 51 | SpiNNaker2 architecture | https://arxiv.org/html/2401.04491 | 2024 | established | export-schema target |

## Top 10 most surprising
1. Kidney cells show the spacing effect (#24)
2. Astrocytes hold memory traces lasting days (#18, #19)
3. Box jellyfish learn without a brain (#28)
4. Stressed plants click ultrasonically (#30)
5. A one-parameter LIF on FlyWire predicts behaviour (#9)
6. Gut bacteria flagellin is "sensed" by the brain (#35)
7. Inner speech decodable, with a password (#42)
8. Human cortex: glia 2:1, rare 50-synapse connections (#5)
9. Glymphatic sleep-clearance now actively disputed (#22/#23)
10. Physarum memory is literally tube width (#26)

## What we're missing (20 ideas not yet in BRAINS.md)
1. Cell-type layer (FlyWire/atlas style) under the 14 regions
2. Like-to-like synaptogenesis rule in develop.grow
3. Rare super-synapses as high-leverage misfire targets
4. Astrocyte slow-memory layer (multiday)
5. Ephaptic field term per region
6. Glymphatic/waste clearance with a contested-parameter toggle
7. Non-neural cell memory (spacing effect) in metabolism
8. Sharp-wave-ripple tagging gating replay
9. Physarum tube-width memory mode
10. Brainless ring-net (jellyfish) minimal mode
11. Slow body-wide Ca²⁺/glutamate alarm channel
12. Emitted distress "ultrasound" readable by peers (simulated)
13. Segmented per-limb mini-controllers (octopus)
14. Bioelectric body-plan field that scramble corrupts
15. Gut microbiome → vagal → affect input
16. Free-energy (DishBrain) training mode
17. Reservoir-readout mode for untrained brains
18. Decoded "voice" and "dream image" renderers (simulated readouts)
19. Dual consciousness metrics (Φ-proxy and ignition), claim-free
20. Neuromorphic export (Lava/SpiNNaker2-style) in the export schema

## Alex's finds (added 2026-11-02, images in research/img/alex/, sources not yet identified)
- **Rat-mouse brain chimeras** (rat_mouse_chimera_brain_atlas.jpg): rat stem cells injected into mouse blastocysts become working neurons, astrocytes and microglia all over the mouse brain, including cortex, hippocampus and cerebellar Purkinje cells, at about 60-80% neuronal identity. Rat cells are densest in the hindbrain. *Idea:* "graft" one Glitchling's brain tissue into another's genome. Foreign neurons wire in and work, so Glitchling's misfire mutations could import whole cell lineages from another creature.
- **Mouse with a rat forebrain** (hesx1_rat_forebrain_mouse.jpg): Hesx1-knockout mouse embryos lack their own forebrain, so the rat cells rebuild cortex and hippocampus. Patch-clamp recordings show the rat neurons fire like the native ones (same firing curves, input resistance and rheobase). The mice lived to about 20 months. *Idea:* niche-vacancy development. If a brain region fails (a leak or misfire knocks it out), donor or offspring cells fill the gap, and regeneration becomes a flaw-recovery path.
- **Neuron shapes: unipolar, bipolar, multipolar** (two diagrams): *Idea:* Glitchling neurons get a morphology gene. Unipolar cells are fast relays for leg reflexes, bipolar cells are sensory (eyes and antennae), and multipolar cells integrate in the central brain. Shape sets the delay and fan-in, so morphology becomes computation instead of decoration.
- **Electronic ant antennae** (ant_electronic_antennae_spike_coding.png): antennae that sense magnetic fields and touch encode slow-adapting (SA) and fast-adapting (FA) spike trains that drive artificial synapses. *Idea:* Glitchling's antennae get SA and FA channels and a magnetic sense. The "wireless" sense becomes a real in-sim magnetic field.
- **MICrONS cubic millimeter of mouse cortex** (microns_cortex_render.webp, microns_proofreading.png): about 1.1×0.8×0.6 mm. Proofreading shows that automatic reconstruction badly mangles output (axon) synapses, and cells near the volume edge get cut off. *Idea:* treat connectome edge errors as a Glitchling flaw, with missing and phantom synapses at the brain's "border."
- **Dendrite computation** (dendrite_bAP_receptive_field.jpg): backpropagating spikes fade with distance from the soma, so distal synapses learn different receptive fields. *Idea:* each dendrite gets a decay length, so near synapses learn sharp features and far ones learn loose ones.
- **Dendrite growth model** (dendrite_growth_sim_vs_real.jpg): a simple growth rule reproduces real arbor length and branch counts over 24–120 h. *Idea:* grow Glitchling's neurons by that rule during development, so stunting from misfires becomes visible.
- **Branch scaling and mitochondria** (dendrite_branch_scaling_mito.jpg): daughter branches scale as r²∝L/D, and mitochondria build up at the distal tips. *Idea:* an energy budget per branch, so the far branches burn metabolism.
- **Bioluminescent voltage sensor** (bioluminescent_voltage_sensor.jpg): NanoLuc plus Venus give ΔR/R ≈4–6% and pick up single spikes. *Idea:* Glitchling glows with its own voltage, so its light is real state, not cosmetic.
- **V1 learns audiovisual predictions** (mouse_v1_audiovisual_prediction.png): over 5 days, the visual cortex suppresses an expected sound-to-image pairing and fires on a wrong cue. *Idea:* cross-modal prediction error. Each sensor scramble shows up as a "wrong cue" spike.
- **Sound sharpens visual tuning** (audiovisual_orientation_tuning.jpg). *Idea:* multisensory gain, so one sense boosts another.
- **Multisensory escape via the TeA** (multisensory_escape_TeA.jpg): air puffs, sound and light trigger running. Sound gets the fastest latency and silencing TeA cuts speed. *Idea:* an escape reflex gated by a cortex-like hub, with a different latency for each sense.
- **Electrophysiology panel** (electrophys_panel.jpg): source unknown.
- **Barrel cortex cell density** (barrel_cortex_cell_density.jpg): excitatory and inhibitory density by layer per whisker column (L4 peak about 120k/mm³). *Idea:* give Glitchling's whisker or antenna columns a real layered E/I density profile as the template for its sensory cortex.

### Worm and wiring batch (C. elegans and cross-species)
- **Serotonin NSM brain-wide correlation** (celegans_serotonin_NSM_correlation.png): one serotonergic neuron's activity correlates positively with pharyngeal neurons and negatively with motor neurons, depending on which excitatory or inhibitory 5-HT receptors each cell expresses. *Idea:* Glitchling's "fed" mood is a single modulator neuron whose sign per cell is set by its receptor genes, so a mutation can flip how mood affects movement.
- **Neuron positions vary across worms** (celegans_neuron_position_variability.jpg): the same neuron sits 4–16 µm away in different individuals, and synaptic weight falls with distance (a cutoff of about 40 µm). *Idea:* wire Glitchling's brain by space with positional noise per individual, so no two hatch identical.
- **Whole-brain stimulate-and-record** (celegans_whole_brain_stim_response.jpg): optogenetically stimulate one neuron and image every neuron's response. This gives a functional map, which differs from the wiring diagram. *Idea:* a "poke test" tool in the sim that measures Glitchling's functional connectome against its structural one.
- **Neuron identity atlas** (celegans_neuron_ID_atlas.jpg): each named neuron has a gene-expression barcode (tax-4 etc.). *Idea:* give each neuron class a gene barcode, so misfires mutate those barcodes.
- **Neuropeptide connectome** (celegans_neuropeptide_cores.jpg, neuropeptide_network_motifs.png, celegans_neuropeptide_connectome_overview.jpg): a second, wireless chemical network (about 92 peptide-receptor pairs) splits into motor, hub and sensory cores, with local, broadcasting, pervasive and integrative motifs. **This is the strongest real basis for Glitchling's "wireless" sense.** *Idea:* a peptide broadcast layer on top of the synapse network, with hub neurons and per-peptide reach.
- **Connectome stats across 4 species** (connectome_graph_stats_4species.jpg): Platynereis larva (2,728 nodes, avg. degree 4.1), C. elegans (357 nodes, degree 10.3, clustering 0.22), Ciona tadpole (213 nodes, degree 13.9); modularity 0.5–0.6 and path length about 3–5. *Idea:* use these as target graph statistics so Glitchling's grown connectome falls in a biological range.
- **MICrONS V1 classifiers** (microns_V1_cell_type_classifier.jpg): about 34k neurons labelled excitatory or inhibitory (about 10% inhibitory) by layer, with expert types (2/3P, 4P, 5P-IT/ET/NP, 6P-CT/IT). *Idea:* a template for Glitchling's cell-type mix and E:I ratio.
- **Cortical cell-type dendrite and axon layer maps** (cortex_layer_celltype_morphology.jpg): each type sends its dendrites and axons to its own set of layers. *Idea:* layer-targeting rules for each type in the grown connectome.
- (The barrel cortex density images in this batch are duplicates of ones already saved.)
