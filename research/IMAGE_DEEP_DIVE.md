# IMAGE_DEEP_DIVE — every figure, read for Glitchling

Written 2026-11-02 (PHT). I viewed all **43 images**: 26 in `img/alex/` and 17 in `img/` (see `img/SOURCES.md`).
**Source rule.** Wikimedia items cite their Commons page, and real paper links are reused only where they were already verified in `NEURO_FRONTIER.md`. For Alex's images I give the **likely** paper as an *unverified attribution* (author or lab, plus the journal if I remember it), with no link. Treat these as leads to confirm, not citations. "Unsure" means I could not place the figure.
Feature notes use GL variables from BLUEPRINT.md ("Gifts" = §Gifts for the baby). The flaws are **scramble**, **leak**, **backwards** and **misfire**. Anything "wireless" or magnetic is **SIMULATED** in-sim physics.

---
## Theme A — Chemical "wireless" & neuromodulation

### A1 `alex/celegans_neuropeptide_connectome_overview.jpg`
- **Shows:** a graphical abstract. Top row: GPCR deorphanisation (51 GPCRs, 49 neuropeptide genes, 92 pairs), worm anatomy and scRNA-seq of 302 neurons. Middle: a dense network with nodes coloured by class (CAN, pharyngeal, motor, sensory, interneuron) and sized by connection count (up to about 400). Bottom: hub neurons (AVK, PVQ, RIG and others), with a plot of peptide degree against synaptic degree, three modules, autocrine loops (oxygen sensing, locomotion) and cascades (EGL-6, NLP-12, CKR-2, NPR-11, FLP-14, DMSR-5).
- **Likely source:** Ripoll-Sánchez et al., *Neuron* 2023, "The neuropeptidergic connectome of C. elegans" (Schafer/Vértes labs). Unverified.
- **Insight:** worms have a second, wireless network of peptide-receptor pairs layered over the wiring diagram. It is far denser than the synapse network, and its hubs are *not* the synaptic hubs.
- **Frontier:** we lack a timing model. We don't know how far each peptide diffuses, how long it lasts, or how cascades compose in real behaviour.
- **GL features:**
  - **peptide layer** (Gifts #1): `pep[k].conc`, `rcpt[n][k]`;
  - **peptide cascades:** peptide A excites the emitters of peptide B (`cascade[k]→k'`), and a misfire can trigger a cascade;
  - **autocrine loops:** `autoGain[n]`, where self-excitation makes a creature "stuck in a mood". Leak drains it.

### A2 `alex/celegans_neuropeptide_cores.jpg`
- **Shows:**
  - (A) a t-SNE and (B) a PCA of neurons by peptide connectivity. Neurons fall into a **motor core**, a **hubs core**, a **sensory core** and the **periphery**, with markers for pharynx, sensory, inter and motor neurons.
  - (C) the sender × receiver matrix, with edge weight = number of linking peptide-receptor pairs (1–20).
  - (D) in-degree by core. The hubs core is highest (about 270), then sensory (about 200), motor (about 140), and the periphery is lowest.
  - (E) a schematic: each core self-loops, hubs↔motor and hubs↔sensory are linked, and the periphery feeds weakly into all three.
- **Likely source:** the same Ripoll-Sánchez 2023 study. Unverified.
- **Insight:** the wireless network has a rich-club architecture. Motor and sensory cores talk to each other mainly *through* a hub core.
- **Frontier:** whether the cores are real functional modules or an artefact of expression data (receptor presence ≠ signal received).
- **GL features:**
  - assign `pepCore[n]` with these proportions;
  - a **hub-lesion test:** removing the hub core should decouple sensory mood from motor mood (`corr(sensoryPep, motorPep)` drops);
  - under **scramble**, re-map receptors in the periphery only, so the cores stay stable and the edges glitch.

### A3 `alex/neuropeptide_network_motifs.png`
- **Shows:** four example peptide→GPCR networks. **Local** (CAPA-1→NMUR-1: one sender, many receivers), **Pervasive** (FLP-18→NPR-5: many↔many), **Broadcasting** (FLP-1→FRPR-7: one sender to about 50 receivers) and **Integrative** (FLP-9→EGL-6: many senders converge on a few receivers). A scatter splits the categories by #neurons expressing the peptide (y) against #expressing the receptor (x), with thresholds near 50. Panel B shows that one receptor (DMSR-1) takes part in local, pervasive and broadcasting motifs through different peptides.
- **Likely source:** the Ripoll-Sánchez 2023 study (figure style matches). Unverified.
- **Insight:** "wireless" isn't one thing. The emitter:receiver ratio sets whether a signal is a whisper, a shout or a vote.
- **Frontier:** whether behaviour depends on the motif class. This is untested at scale.
- **GL features:**
  - `motif[k] = f(#emitters, #receivers)` computed rather than hand-set;
  - a misfire that mutates emitter counts can turn a local peptide into a broadcast one (a "rumour mutation");
  - the SIMULATED `field.ts` acts as a 5th motif ("inter-creature broadcast") with the same maths.

### A4 `alex/celegans_serotonin_NSM_correlation.png`
- **Shows:**
  - (A) a heat-map over about 100 neuron classes: pharyngeal/sensory/inter/motor type, expression of excitatory (red) or inhibitory (blue) 5-HT receptors (ser-1, ser-4, ser-5, ser-7, mod-1…) and their positive or negative correlation with NSM.
  - (B) pharyngeal neurons correlate positively with NSM; motor and interneurons correlate negatively.
  - (C) pumping-encoding neurons correlate positively and velocity-encoding neurons negatively.
  - (D–E) the fraction of neurons with each receptor type in each correlation class.
  - (F–G) only *weak* relationships with the fraction of synaptic inputs from 5-HT-expressing or NSM-correlated neurons (R² 0.08 and 0.03).
- **Likely source:** Dag, Flavell lab, *Cell* 2023 (serotonin brain-wide). Unverified.
- **Insight:** one serotonin neuron splits the brain into "eat more" (+) and "move less" (−), roughly following receptor type. The R² values are small, though, so receptors explain only part of it.
- **Frontier:** what explains the rest. Candidates are network effects, receptor kinetics and co-transmitters.
- **GL features:**
  - **NSM fed neuron** (Gifts #2): `rcpt5HT[n]`;
  - set the sign from receptor in only about 60% of cells and let the remainder come from network effects. This keeps the honest "partial explanation";
  - a **backwards** variant where the serotonin sign is flipped on MOT cells gives a creature that bolts when full.

---
## Theme B — Wiring rules, graphs & variability

### B1 `alex/celegans_neuron_position_variability.jpg`
- **Shows:**
  - (A) pairwise positional variability (0–20 µm heat-map) across head ganglia (anterior pharyngeal bulb, anterior, dorsal, lateral, ventral, retrovesicular, posterior pharyngeal bulb), plus the % of datasets in which each neuron was identified and its mean variability (4–16 µm).
  - (B) same-ganglion pairs against different-ganglion pairs. Significance stars appear for some.
  - (C) synaptic weight against mean nuclear distance, chemical and electrical. Weight falls with distance, with a dashed line at 40 µm.
  - (D) birth time of the last shared parent against adult distance. Lineage-close cells sit closer (8–15 µm).
- **Likely source:** unsure. Possibly a NeuroPAL-based multi-animal atlas paper. Unverified.
- **Insight:** "identical" worms aren't. Neurons wander about 4–16 µm, but connectivity still tracks proximity *and* lineage.
- **Frontier:** how wiring stays functional despite this jitter.
- **GL features:**
  - **spatial wiring + σpos** (Gifts #3);
  - **lineage-proximity rule:** cells born from the same parent cell in `develop.grow` start close (`lineageDist`);
  - **scramble as positional drift:** jitter `pos[n]` by σ instead of a random permutation, giving a biologically plausible glitch.

### B2 `alex/connectome_graph_stats_4species.jpg`
- **Shows:** a table and network drawings.

  | species | nodes | edges | density | modularity | clustering | path length | degree |
  |---|---|---|---|---|---|---|---|
  | *P. dumerilii* 3-day larva | 2,728 | 11,437 | 0.0015 | 0.62 | 0.10 | 5 | 4.1 |
  | *P. dumerilii* cell-type graph | 222 | — | 0.02 | 0.57 | 0.16 | 2.9 | 8.6 |
  | *C. elegans* | 357 | 3,701 | 0.02 | 0.51 | 0.22 | 2.9 | 10.3 |
  | *C. intestinalis* tadpole | 213 | 3,105 | 0.06 | 0.61 | 0.32 | 2.7 | 13.9 |

  Below the table are force-directed layouts coloured by module.
- **Likely source:** a Platynereis whole-body connectome paper from the Jékely lab (Verasztó et al.). Unverified.
- **Insight:** unrelated small brains converge on similar modularity (about 0.5–0.6) and short paths (about 3–5). This looks like a design rule.
- **Frontier:** whether the convergence comes from wiring cost, development or function.
- **GL features:**
  - **graph-stat gate** (Gifts #4);
  - **wiring-cost pressure:** `Σlen` penalty in `develop.grow`, to test whether modularity *emerges* (the real experiment);
  - a **misfire "sickness" score** = distance from the target stats.

### B3 `alex/celegans_whole_brain_stim_response.jpg`
- **Shows:**
  - (a) the rig: 2-photon targeted stimulation plus 1-photon calcium imaging on a spinning disk with tunable lenses;
  - (b) GCaMP6s plus other fluorophores, with GUR-3/PRDX-2 light-gating;
  - (c) a NeuroPAL-coloured head;
  - (d) about 2,500 s of traces from about 60 identified neurons, with stimulation times on top;
  - (e–g) example pairs: AVJR→AVDR responds strongly, AVER→AVAR responds, and SAADL→OLLR gives *no response* across trials.
- **Likely source:** Randi, Leifer lab, *Nature* 2023 ("neural signal propagation atlas"). Unverified.
- **Insight:** poke one neuron and you can see the whole brain answer. Functional influence often differs from wiring, partly because of extrasynaptic (peptide) signalling.
- **Frontier:** reconciling functional and structural maps across states such as fed vs starved.
- **GL features:**
  - **poke tool** (Gifts #5);
  - **state-dependent F:** run the poke in fed vs starved conditions and report `ΔF`;
  - **backwards check:** poke MOT 216–223 and confirm the reversal shows as negative F.

### B4 `alex/microns_proofreading.png`
- **Shows:**
  - (a) the MICrONS block (1.1 mm × 800 µm × 600 µm);
  - (b) excitatory and inhibitory neurons before and after proofreading. The axons are mostly *added* by proofreading;
  - (c) the fraction of synapses changed by proofreading. Input synapses are almost all correct, while output synapses are heavily removed or added;
  - (d) a schematic of truncated vs complete cells at the volume border;
  - (e) radial extent of the dendrites (about 100–200 µm) and the fraction of cells complete against distance from the border.
- **Likely source:** a MICrONS-consortium *Nature* 2025 companion paper. Possibly Schneider-Mizell et al. on inhibitory connectivity. Unverified. The consortium overview is https://www.nature.com/articles/s41586-025-08790-w (verified earlier).
- **Insight:** even flagship connectomes are reliable for inputs but wrong about outputs unless humans fix them, and edges truncate cells.
- **Frontier:** automated axon proofreading at scale.
- **GL features:**
  - **edge-error flaw** (Gifts #16): `pMiss` and `pPhantom` higher on *outputs*;
  - a **border zone** where `edgeZone` neurons lose a fraction of their dendrites;
  - a **"proofreading" behaviour** during sleep repairs phantom edges at an ATP cost. This is a new recovery pathway against misfire.

### B5 `alex/microns_cortex_render.webp`
- **Shows:** a rainbow-coloured 3-D render of thousands of reconstructed neurons in a cortical block. The dense tangle shows pyramidal apical dendrites running vertically.
- **Likely source:** MICrONS consortium imagery (https://www.nature.com/articles/s41586-025-08790-w, verified earlier). The exact render is unattributed.
- **Insight:** real cortex is a near-solid tangle in which every cell touches thousands of others.
- **Frontier:** turning this structure into function at scale.
- **GL features:**
  - a **render mode** that colours neurons by `cellId` hash, like Brainbow/MICrONS, but only from exported state;
  - a **density stat** `syn/neuron` exported to show scale honestly (ours is about 1e2, cortex is 1e3–1e4).

### B6 `alex/microns_V1_cell_type_classifier.jpg`
- **Shows:**
  - (A) a top view of the EM volume spanning V1, RL and AL;
  - (B) the neuron/fragment classifier (37,362 neurons);
  - (C) the E/I classifier (33,997 excitatory, 3,138 inhibitory, about 8.5% inhibitory);
  - (D) a layer classifier;
  - (E–F) a UMAP coloured by soma depth (14–738) and by layer;
  - (G) soma positions by layer across V1→HVA, with thickness labels (about 100–210 µm);
  - (H–I) expert types (2/3P, 4P, 5P-IT, 5P-ET, 5P-NP, 6P-CT, 6P-IT) with example morphologies.
- **Likely source:** Elabbady et al., *Nature* 2025, perisomatic-feature cell typing in MICrONS. Unverified.
- **Insight:** the shape of the soma and its immediate surroundings alone predicts cell type. About 9:1 E:I holds across a cubic millimetre.
- **Frontier:** whether morphology-based types match transcriptomic types one-to-one.
- **GL features:**
  - E:I 9:1 columns (Gifts #13);
  - **soma-feature typing:** GL's `morph[n]` can be inferred from its simulated shape, so types are readable from render state;
  - **misfire biased to inhibitory cells** gives runaway bursts. This is a measurable epilepsy-like failure.

### B7 `alex/cortex_layer_celltype_morphology.jpg`
- **Shows:**
  - (A) 3-D renders of a barrel column with somata of 10 excitatory types (L2py, L3py, L4sp, L4ss, L4py, L5st, L5tt, L6cc, L6ct, L6inv);
  - (B) dendrite (red) and axon (black) length density against cortical depth for each type;
  - (C) layer × type heat-maps of dendritic length (0–94% of total) and axonal length (0–55% of total).
- **Likely source:** Oberlaender lab, rat barrel cortex. Possibly Narayanan et al. *Cerebral Cortex* 2017. Unverified.
- **Insight:** each type has a layer "address book" for where it receives (dendrites) and where it sends (axons).
- **Frontier:** whether layer-specific axon/dendrite overlap (Peters' rule) predicts actual synapses. Partly, but not fully.
- **GL features:**
  - a `layerTarget[type] = {dendL, axonL}` table;
  - **Peters' rule wiring:** synapse probability ∝ axon × dendrite overlap per layer, plus a specificity factor that misfire can corrupt;
  - **backwards** can swap axon and dendrite layers for flagged types.

### B8 `alex/barrel_cortex_cell_density.jpg`
- **Shows:**
  - (A) mouse whiskers mapping to barrels;
  - (B) 3-D barrel columns (E1–E4, D2, C2, B2, A1–A4; scale 500 µm);
  - (C) a column slab from pia to white matter;
  - (D) NeuN and GAD67 staining (scale 50 µm);
  - (E) excitatory density heat-map and depth profile, peaking at about 120×10³/mm³ in L4;
  - (F) inhibitory density, peaking at about 25–30×10³/mm³;
  - (G) excitatory and inhibitory profiles for columns A2, C2 and E2.
- **Likely source:** Oberlaender lab or a Meyer et al. barrel-cortex counting study (rat). Unverified. *Note:* the drawing in (A) looks like a rat.
- **Insight:** one whisker gets one column, and the L4 input layer is the densest. Inhibition is roughly 10–20% and also peaks in L4.
- **Frontier:** how column-to-column variability affects perception.
- **GL features:**
  - **antenna columns:** one column per antenna segment, with density from E/F;
  - under **scramble**, the whisker→column map is permuted, which is literally a mis-wired barrel field;
  - **leak** thins L4 density with age (`colDensity` decay), which degrades touch acuity.

---
## Theme C — Single-neuron computation & growth

### C1 `alex/dendrite_bAP_receptive_field.jpg`
- **Shows:**
  - (a) a pyramidal neuron with synapses;
  - (b) backpropagating AP strength against distance from the soma, for length constants 25, 75 and 125 µm;
  - (c) somatic against distal/proximal accumulators;
  - (d) a schematic of receptive-field offset;
  - (e) a ferret dendrite with synapses coloured by orientation preference (0–90°), plus circular dispersion;
  - (f–i) dispersion rises with distance, matching adult ferret data. The receptive-field offset stays at chance.
- **Likely source:** Kirchner & Gjorgjieva lab (ferret dendritic orientation clustering model). Unverified.
- **Insight:** fading backprop alone explains why distant synapses are less tuned to the cell's preference. Local learning rules plus geometry are enough.
- **Frontier:** testing this causally in vivo.
- **GL features:**
  - **λ per dendrite** (Gifts #11): `plast(d) ∝ exp(−d/λ)`;
  - **leak scaled by distance** (`leak·(1+d/λ)`), so distal memories fade first;
  - a **λ mutation via misfire**, where a short λ gives a "narrow-minded" creature.

### C2 `alex/dendrite_branch_scaling_mito.jpg`
- **Shows:**
  - (A) sister-branch radius scaling r² ~ L/D;
  - (B) mitochondrial enrichment rising toward the tips;
  - (C–D) the L/D splitting rule against L-only and equal splitting, for distal mitochondrial enrichment and subtree asymmetry, plus parameter sweeps (α, β);
  - (E–F) real dendrites (scale 30 µm);
  - (G–J) data fits: α = 2.2 (R² 0.87), volume ~ length (R² 0.94), r² ~ L/D (R² 0.70).
- **Likely source:** Cuntz lab or a related group. Possibly fly dendrites. Unverified.
- **Insight:** branch thickness is set by how much tree it supplies, and that layout also delivers mitochondria (energy) to the tips.
- **Frontier:** whether the energy logistics *cause* the shape or just correlate with it.
- **GL features:**
  - **branch energy** (Gifts #12): `branchCost = Σ L/D`;
  - **distal mitochondria** (`mitoTip[n]`): if metab.atp is low, distal synapses go silent first (graceful degradation);
  - **leak** lowers `mitoTip` over time, giving aging.

### C3 `alex/dendrite_growth_sim_vs_real.jpg`
- **Shows:**
  - (A) simulated arbors at 24, 48, 72 and 120 h;
  - (B) a real neuron at 120 h (scale 50 µm; A-P and R-L axes);
  - (C–E) total length (to about 22 mm), number of branches (to about 3,000–4,000) and mean branch length, real vs simulated.
  - The simulation matches well except at 120 h, where real neurons have more branches and shorter mean branch length.
- **Likely source:** Drosophila class IV da-neuron growth model, plausibly the Cuntz lab (e.g. Ferreira Castro et al.). Unverified.
- **Insight:** a few local rules (grow, branch, avoid self) reproduce a complex arbor over development.
- **Frontier:** the late-stage mismatch at 120 h, i.e. what extra rule drives late branching.
- **GL features:**
  - **arbor growth** in `develop.grow`, with `arbor.len(t)` and `branches(t)`;
  - **misfire stunting:** a jolt during growth kills a growth cone, giving a visible lopsided arbor;
  - **self-avoidance** `avoid` parameter. With it off, arbors clump and coverage gaps make sensory blind spots.

### C4 `alex/neuron_shapes_soma_axon_dendrite.png`
- **Shows:** line drawings labelled A, B and C of neurons with soma, axon and dendrite. (A) pseudo-unipolar: soma off a stalk, with the axon continuous with the dendrite. (B) bipolar: soma mid-line. (C) multipolar: many dendrites, one axon.
- **Likely source:** a textbook-style diagram. Unsure.
- **Insight:** the soma's position along the line sets whether it is in the signal path at all. In unipolar cells the spike can bypass the soma.
- **Frontier:** not frontier. This is a classic.
- **GL features:** `morph[n]` (Gifts #10). Unipolar cells **bypass somatic integration**, so they are fast and immune to somatic leak. Multipolar cells get high fan-in.

### C5 `alex/neuron_types_uni_bi_multipolar.png`
- **Shows:** a simpler yellow textbook diagram titled "Types of Neurons" (unipolar, bipolar, multipolar).
- **Likely source:** generic educational graphic. Unsure.
- **Insight / GL:** same as C4. Use it for the in-game "neuron codex" art, but render from state.

### C6 `alex/bioluminescent_voltage_sensor.jpg`
- **Shows:**
  - (A) a cultured neuron expressing the sensor (scales 20 and 5 µm);
  - (B) ΔR/R₀ against voltage (about −2% to +6% from −120 to +80 mV; N = 4 cells);
  - (C) Venus, NLuc and ratio traces for a −70→+30 mV step, with τ_fast about 15–18 ms and τ_slow about 100–240 ms;
  - (D) a single-AP ΔR/R of about 3% against noise (N = 6).
- **Likely source:** a NanoLuc–Venus BRET voltage indicator. Possibly the "LOTUS-V" line (Inagaki/Nagai lab). Unverified.
- **Insight:** a cell can *emit its own light* in proportion to voltage, with no laser needed. This is noisy but catches single spikes.
- **Frontier:** brightness and SNR for in vivo, whole-animal readout.
- **GL features:**
  - **voltage glow** (Gifts #6), with the τ_fast/τ_slow filter taken from (C);
  - a **glow SNR** of 3% plus noise, so a predator must integrate. Hiding is real;
  - **backwards** flips the glow sign on reversed segments, which "lies" about state.

### C7 `alex/electrophys_panel.jpg`
- **Shows:** a very low-resolution (187×269) multi-panel electrophysiology figure. It seems to show a surgery/timeline schematic, a histology inset, waveform clustering, spike rasters, firing-rate bar plots with significance marks, and F–I curves at the bottom. The text is unreadable.
- **Likely source:** unsure. Not identifiable at this resolution.
- **Insight:** none safely extractable. This needs a higher-resolution original.
- **GL features:** a placeholder only. If it's an F–I curve comparison, use it as a template for a `fiCurve` unit test per morph class.

---
## Theme D — Senses, prediction & escape

### D1 `alex/ant_electronic_antennae_spike_coding.png`
- **Shows:**
  - (a) an ant with magneto-sensation and mechano-sensation;
  - (b) the ant antenna → sensory neurons, with SA spikes (sustained) against FA spikes (onset/offset);
  - (c) an electronic-antennae sensor → spike-coding circuit → artificial synaptic devices;
  - (d) sensor receptor potentials (two antennae) → encoded SA1/SA2/FA1/FA2 spikes → device synaptic currents that build up.
- **Likely source:** a bio-inspired neuromorphic sensing paper. Unsure which. Unverified.
- **Insight:** the same stimulus split into "how much" (SA) and "what changed" (FA) gives cheap, rich coding.
- **Frontier:** real magnetoreception mechanisms in insects are unresolved, and the device here is engineered, not biological.
- **GL features:**
  - **SA/FA antennae** (Gifts #9);
  - a **magnetic heading** from an in-world `B(x,y)` field (SIMULATED world physics);
  - **scramble** swaps SA↔FA, so the creature confuses "touching" with "just touched".

### D2 `alex/mouse_v1_audiovisual_prediction.png`
- **Shows:**
  - (a) a dome VR with a head-fixed mouse and speakers;
  - (b) a 5-day conditioning schedule: AaVa→water, AbVb→air puff, plus visual-only trials. On day 5, Ab paired with Va is the wrong cue;
  - (c) V1 ΔF/F. On day 1 the paired and unpaired responses match; by day 4 the expected stimulus is suppressed;
  - (d) a response-difference index rising over days;
  - (e–f) anticipatory licking grows;
  - (g–h) the wrong cue gives a large response.
- **Likely source:** Garner & Keller, *Nature Neuroscience* 2022. Unverified.
- **Insight:** V1 learns what a sound predicts it will see, cancels the predicted image and lights up on violations.
- **Frontier:** where the prediction is computed (auditory cortex → V1 projections?) and whether it is general.
- **GL features:** **AV prediction error** (Gifts #7), with `pred.v` learned over about 4 "days" of ticks. Scramble triggers wrong-cue PE, and PE magnitude can be a readout for `glitch.aware` (area 100).

### D3 `alex/audiovisual_orientation_tuning.jpg`
- **Shows:**
  - (A, C) scatters of visual against audiovisual orientation/direction selectivity (OSI/DSI) for single and multi units;
  - (B, D) example polar tuning curves with shuffles;
  - (E–F) OSI/DSI slightly *lower* with sound on average;
  - (G) ΔOSI/ΔDSI by depth to about 800 µm;
  - (H) shifts in preferred orientation;
  - (I) normalized firing against Δorientation at contrasts 0, 0.5 and 1. AV is higher than V, especially at low contrast.
- **Likely source:** a mouse V1 audiovisual integration study, possibly Ibrahim et al. *Neuron* 2016 or similar. Unsure. Unverified.
- **Insight:** the figure suggests sound mostly **adds gain**, especially for weak visual input, rather than sharpening tuning. On average tuning got *slightly broader*. That corrects Alex's "sharpens" note.
- **Frontier:** whether this is attention or arousal (locomotion) rather than true integration.
- **GL features:**
  - **multisensory gain** `gainXmod` that matters most at low contrast (inverse effectiveness);
  - an **arousal confound control:** a test that holds `affect.aro` fixed to show the gain survives;
  - **leak** decays `gainXmod`.

### D4 `alex/multisensory_escape_TeA.jpg`
- **Shows:**
  - (a) a mouse on a track with air puff (A), sound (S, 110 dB, 5 s) and light (L, 5 lux);
  - (b–i) speed heat-maps and traces. Sound gives the highest escape probability and shortest latency; peak speed is similar; duration is longest for air puff;
  - (j–q) head-fixed repeat on a rotary encoder;
  - (r–w) chemogenetic (hM4D/CNO) and optogenetic (eNpHR) silencing of temporal association cortex (TeA). Silencing cuts peak speed for all senses, with mCherry/EYFP controls unaffected.
- **Likely source:** a mouse TeA multisensory defensive-behaviour study. Unsure which. Unverified.
- **Insight:** one cortical hub sets *how hard* you flee from any sense. Each sense sets *how fast* you start.
- **Frontier:** what TeA computes (threat value? vigor?) and how it hands off to the midbrain.
- **GL features:**
  - **escape hub** (Gifts #8): `esc.lat = {S:2, A:3, L:5}`;
  - `esc.hub` scales **vigor, not latency**, matching the figure;
  - **backwards** limbs make the escape vector partially self-defeating, so the creature must learn to compensate.

---
## Theme E — Identity, development & chimeras

### E1 `alex/celegans_neuron_ID_atlas.jpg`
- **Shows:**
  - (A) a head schematic with tax-4-positive neurons in magenta (nerve ring, ventral ganglion), plus a fluorescence image of all neurons (red) and tax-4 neurons (cyan; scale 10 µm);
  - (B) the number of animals per reporter gene (tax-4p, gpc-1p, ins-1p…);
  - (C) identified against detected nuclei (about 190–230 detected, 20–110 identified);
  - (D) identification counts per neuron class (ASHL/ASKL highest, about 300).
- **Likely source:** a C. elegans multi-reporter neuron-ID atlas. Unsure (pre-NeuroPAL style). Unverified.
- **Insight:** identity is combinatorial gene expression. Even with many reporters, only about 40–50% of nuclei are reliably named per animal.
- **Frontier:** fully automatic whole-brain neuron ID across animals.
- **GL features:**
  - **gene barcode** (Gifts #14);
  - an **ID-confidence stat**, so the poke tool must *infer* identities with noise like a real lab;
  - **misfire** bit-flips cause identity drift.

### E2 `alex/rat_mouse_chimera_brain_atlas.jpg`
- **Shows:**
  - (A) rat PSCs (KsO red) injected into an E3.5 mouse blastocyst gives E18.5 rat-mouse chimeras;
  - (B) rat cells across OB, CP, SSCx, PCx, hippocampus and cerebellum (including Purkinje-like fans in CB);
  - (C) rat neurons (NeuN+), astrocytes and microglia;
  - (D) the % of rat cells that are neurons by region, about 60–80%;
  - (E) whole-brain sagittal and coronal fluorescence;
  - (F) rat signal by atlas region from pallium to hindbrain, rising toward the hindbrain (r1–r11 highest).
- **Likely source:** Throesch et al., Baldwin lab, *Cell* 2024 (rat-mouse chimeric circuits). Unverified.
- **Insight:** foreign-species cells integrate everywhere and take on local identities. Their contribution has a gradient.
- **Frontier:** whether the cells *function* in circuits. That is the companion question answered in E3.
- **GL features:**
  - **graft** (Gifts #15): `donorId`, `graftFrac` with a regional gradient;
  - **donor peptide/receptor genes** come along, so grafts can bring new wireless channels;
  - **misfire germline** occasionally inserts a donor lineage.

### E3 `alex/hesx1_rat_forebrain_mouse.jpg`
- **Shows:**
  - (A) Cas9 + gRNA in a mouse zygote gives an Hesx1⁻/⁻ blastocyst; rat ESCs added give a forebrain-reconstituted chimera;
  - (B) pups at P0 and adults at 20 months;
  - (C–E) tdTomato (rat) dominates cortex and hippocampus only in Hesx1⁻/⁻ (about 50–60% against near zero in WT); other regions are not significant;
  - (F–G) AAV tracing from ALM shows rat-derived cortex projects to thalamus, superior colliculus and medulla;
  - (H–N) patch-clamp at P14. Rat (tdTomato+) and mouse neurons have matching firing, F–I curves, input resistance (about 550–600 MΩ), resting potential (about −80 mV) and rheobase (about 200–240 pA), all "ns".
- **Likely source:** a Chinese group's *Cell* 2024/2025 interspecies forebrain complementation paper. Unsure of authors. Unverified.
- **Insight:** an empty developmental niche gets filled by another species' cells, which wire to the right targets and fire normally.
- **Frontier:** behaviour and cognition of these chimeras, plus ethics. Primate versions remain unsolved and contested.
- **GL features:**
  - **niche-vacancy regrowth** (Gifts #15): `region.vacant` triggers refill from `donorId` and costs ATP;
  - a **"same-firing" test:** grafted cells must pass the same F–I unit test as natives;
  - **projection check:** grafted ALM-equivalent cells must reach MOT targets, else the graft fails.

---
## Theme F — Wikimedia set (`img/`; licences in `img/SOURCES.md`)

**F1 `01_fly_male_cns_neuron_positions.png`**
- **Shows:** a chart of the MaleCNS v1.0 Drosophila male CNS in dorsal, lateral and front views. 17,937 sensory input neurons are shown in blue, 1,316 descending + 815 motor readout neurons in orange, and 146,632 others in grey. Scale bars are 200 µm. The caption says source MaleCNS v1.0 (HHMI Janelia, Cambridge, MRC LMB, Google Research), CC BY 4.0, released 8 Jun 2026, edges ≥5 synapses.
- **Insight:** about 11% of neurons are inputs and about 1.3% are outputs. Nearly 90% is "the fixed wiring between them".
- **Frontier:** brain + VNC emulation. Related links: FlyWire https://www.nature.com/articles/s41586-024-07558-y, BANC preprint in NEURO_FRONTIER.
- **GL features:**
  - an **I/O ratio budget** (`nIn:nOut:nHidden ≈ 11:1.3:88`), so GL's 272 neurons get about 30 sensory and about 4 readout neurons, plus more hidden;
  - the **backwards** flaw applies to descending neurons (gate) rather than motor neurons, for a more biological reversal.

**F2 `02_human_brain_organoid.jpg`**
- **Shows:** a confocal image of a spherical human brain organoid. Cyan nuclei are dense, with magenta cells clustered around rosette-like ring regions.
- **Insight:** stem cells self-organise into proto-cortical rosettes without a body.
- **Frontier:** vascularisation, maturity and organoid intelligence. Related: Brainoware, FinalSpark in NEURO_FRONTIER.
- **GL features:**
  - a **"jar mode"**: a Glitchling brain grown without a body (no sensors) to test the develop rules alone;
  - **rosette seeding** (`rosettes` count) as an origin of regions.

**F3 `03_physarum_blob.jpg`**
- **Shows:** a bright yellow *Physarum* fruiting mass on a mossy rock, with veined spreading margins.
- **GL features:** a **tube-width memory** (NEURO #26); **leak** = tube thinning.

**F4 `04_physarum_plasmodium.jpg`**
- **Shows:** a plasmodium network of branching yellow veins on a rotting log.
- **Insight:** the network *is* the memory and the computer. Veins thicken where flow is useful (Tokyo-rail result, NEURO #27).
- **GL features:**
  - **flow-reinforced wiring**: `w += η·|flow|`, decaying otherwise. This is an alternative to Hebbian;
  - a **scramble** analogue: cutting a vein forces rerouting.

**F5 `05_xenobot_quadruped.jpg`, F6 `06_xenobot_design_pairs.png`**
- **Shows:**
  - F5: a single frog-cell xenobot, C-shaped, in a dish;
  - F6: five voxel designs (red = muscle/contractile, cyan = passive skin) above the real organisms built from them. The shapes include a C-shape, a wedge, an arch and a ring with a hole.
- **Insight:** evolved-in-sim body plans can be built from real cells. Body shape is the program (PNAS self-replication, NEURO #34).
- **Frontier:** the sim→real gap, and whether brainless bodies can show learning.
- **GL features:**
  - a **voxel body genome** (`bodyVox[i]∈{muscle, skin}`) feeding `body.ts`;
  - **misfire** flips voxels.

**F7 `07_brainbow_lichtman2008.jpg`**
- **Shows:** three panels: (a) multicolour axon bundles, (b) dense brainstem/cerebellar fibres and somata, (c) a row of differently coloured neurons with processes.
- **Insight:** random combinatorial colour labels each cell uniquely, enabling tracing.
- **GL features:**
  - a **cell-ID colour** = hash(barcode) for the render;
  - the **scramble** render overlay shows colour-labelled axons crossing wrongly.

**F8 `08_planarian.jpg`**
- **Shows:** a flatworm on a light background with arrow-shaped head and eyespots.
- **Insight:** planarians regenerate whole bodies and heads. This connects to Levin's bioelectric patterning (NEURO #32).
- **GL features:** a **regeneration from fragments** stress test of niche-vacancy (E3) at whole-body scale.

**F9 `09_box_jellyfish_tripedalia.jpg`**
- **Shows:** a transparent box jellyfish with four corners of banded tentacles.
- **Insight:** associative learning without a brain, via rhopalia (NEURO #28).
- **GL features:** a **ring-net minimal mode** with `nCentral = 0`, to test whether flaws still cost.

**F10 `10_purkinje_cajal.png`**
- **Shows:** Cajal's ink drawing of a Purkinje cell with an enormous flat dendritic fan and one axon down (labels a–d).
- **Insight:** one cell, about 100k+ inputs, fanned in a plane.
- **GL features:** a **planar high-fan-in** `morph = "fan"` class for the cerebellum-like region; **leak** prunes the fan.

**F11 `11_purkinje_mouse_cerebellum.png`**
- **Shows:** a confocal image of a mouse cerebellar fold. Purkinje somata (red rings) line both edges of a densely packed granule layer (blue nuclei), with molecular layer (yellow-olive) outside.
- **Insight:** strict laminar order. One Purkinje row sits on millions of granule cells.
- **GL features:** **granule expansion**, a sparse expansion layer before the motor fan (`nGranule = 10×nMossy`). Misfire hits here are mostly harmless (redundancy). This makes a nice contrast test.

**F12 `12_dti_tractography.png`**
- **Shows:** a sagittal diffusion-tractography render of the human brain. Fibres are colour-coded by direction (green A-P, red L-R, blue S-I).
- **Insight:** macro-wiring is bundled long-range tracts. Note that this is MRI inference, not real axons.
- **GL features:** **nerve-bundle objects** (already in §3 scramble-per-bundle); export `bundle.dir` for a render colour that is real state.

**F13 `13_octopus_merculiano.jpg`**
- **Shows:** a 19th-century illustration of *Octopus vulgaris* (Merculiano) with curled arms and suckers.
- **Insight:** two-thirds of the octopus's neurons sit in its arms, with segmented nerve cords (NEURO #31).
- **GL features:** **limb brains** (already Phase 1 `limbs.ts`), plus an `armAutonomy` parameter. With **backwards**, an autonomous arm may ignore the central reversal.

**F14 `14_astrocyte_organoid_subtypes.jpg`**
- **Shows:** traced 3-D astrocytes in air-liquid-interface cortical organoids: protoplasmic (red, bushy), fibrous (blue), interlaminar-like ILA (black, long) and a pial/other (green). Morphometrics include branches, path, cable length, Sholl, fractal dimension, Horton–Strahler, roundness and skewness. Protoplasmic cells are the most branched.
- **Insight:** human organoids grow distinct astrocyte subtypes, including primate-typical interlaminar ones.
- **GL features:**
  - an **astrocyte layer** (NEURO #18–19) with `astro.type`;
  - the slow trace `astro.mem` is the leak's main target.

**F15 `15_hek293_fluo4_calcium.png`**
- **Shows:** HEK293 cells loaded with the Fluo-4 calcium dye: green fluorescence over brightfield.
- **Insight:** this is related to the non-neural "spacing effect" paper (NEURO #24, https://www.nature.com/articles/s41467-024-53922-x), which used non-neural human cell lines. I believe HEK293 was among them, but I haven't verified that.
- **GL features:** a **cellular memory in metabolism cells** (`metab.mem` with a spacing rule). This is a test that the spaced vs massed food pulses give different responses.

**F16 `16_celegans_can_neurons.png`**
- **Shows:** a C. elegans CAN neuron (green) with a long bipolar process along the body; the head is marked red and arrows point to the process.
- **Insight:** CAN is a bipolar cell spanning the body. It also appears as its own class in A1.
- **GL features:** a **body-length bipolar sentinel** (`morph = bipolar`) carrying a slow whole-body signal.

**F17 `17_stretchable_mea.png`**
- **Shows:** a radial stretchable microelectrode array (sMEA) in a culture well, before and during stretch.
- **Insight:** electrodes can record from tissue while it is being mechanically stretched (injury and mechanobiology studies).
- **GL features:** **stretch/pressure injury**, where hydrostat `pressure` overload causes misfire-like jolts in nearby neurons. This ties the body to the misfire flaw.

---
## Cross-image synthesis
1. **There are two networks, not one.** A1–A4 and B3 show that function ≠ wiring because of a dense, hub-centred wireless chemical layer. Glitchling's "wireless" should be primarily *internal peptides* (real biology), with inter-creature broadcast as an extension (SIMULATED).
2. **Variability is normal, and identity is fuzzy.** Neurons drift 4–16 µm (B1), only about half are nameable per animal (E1), and receptors explain only part of the serotonin effect (A4). Flaws should be framed as amplified versions of variability that is already biological, not as alien bugs.
3. **Geometry is computation.** Morphology (C4–C5, B7), dendritic distance (C1), branch scaling (C2) and layer addresses (B7–B8) each change *what* a neuron learns. GL needs a spatial substrate (`pos`, `morph`, `λ`, layers) before the flaws have biological meaning.
4. **Energy logistics shape everything.** Mitochondria pile up at the tips (C2), wiring cost drives convergent graph stats (B2) and light emission costs energy (C6). Every gift therefore gets an ATP price.
5. **Maps are wrong in structured ways.** MICrONS outputs are error-prone and border cells are truncated (B4), tractography is inferred (F12) and ID is partial (E1). This supports an *edge-error* flaw and a poke tool that measures rather than assumes.
6. **Prediction is wired in.** V1 cancels predicted images (D2), sound adds gain at low contrast (D3) and the escape hub sets vigor (D4). Scramble should show up as *surprise*, which gives GL a route to noticing its own flaws (area 100).
7. **Brains are replaceable.** Chimeras (E2–E3), regeneration (F8), organoids (F2) and xenobots (F5–F6) show that development fills niches. Give Glitchling a recovery path (graft/regrow), so the flaws stop being one-way decline.
8. **Scale honesty.** The fly CNS is about 166k neurons (F1) and MICrONS is about 1e5 per mm³ (B5–B6). GL's 272 neurons are a sketch, so export `syn/neuron` and the I/O ratio to keep claims calibrated.

**Corrections to the earlier notes:**
- D3 shows sound mainly adds *gain*. Average tuning got slightly *broader*, not sharper.
- A4's receptor→sign link is real but only partial (low R²).
- C7 can't be read at this resolution.
