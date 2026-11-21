# Glitchling v2 · Scientific Defense Dossier (Pass 21)

This file lists every quantitative claim the `live/` simulation makes in Pass 21, the code that computes it, the
control or lesion that could falsify it, and the number measured. Every number here is copied from a run of the commands
in [§5](#5-reproduce-every-number). Nothing in this file is estimated by hand.

It also says plainly **what kind of claim each test supports**. Some tests check that the maths is coded correctly.
Some test mechanisms that were designed in. A few test behaviour that is not written down anywhere in the code. A
hostile reviewer should treat these three kinds differently, and so do we.

> **Scope.** Glitchling is a classical IEEE-754 (FP64) simulation that runs on a CPU, with optional WASM/WebGPU. It makes
> no claim of awareness, feelings, sentience or consciousness. "Quantum" modules are classical simulations of
> density matrices or state vectors. They demonstrate correct quantum *mathematics*, not physical quantum effects in
> the creature.

---

## 1. Statistical protocol (applies to T1, T3, T4, T5, T7–T12)

| item | choice | why |
|---|---|---|
| sample | $N = 12$ independent seeds (1…12), paired: both arms share the seed, so they share the initial world and body | removes between-seed variance from the contrast |
| test | exact one-sided paired sign-flip permutation test, all $2^{12} = 4096$ sign patterns (Fisher 1935; Pitman 1937) | no normality assumption; exact, not Monte-Carlo |
| p-value floor | $p_{\min} = 2^{-12} = 0.000244$ | **the smallest p this design can produce.** "p = 0.000244" means *all 12 seeds favoured the predicted direction and no sign flip did as well*. It does not mean $p \ll 10^{-4}$. |
| interval | 10,000-resample percentile bootstrap 95% CI on the mean paired difference (fixed RNG seed 20261112) | deterministic, reproducible |
| effect size | paired Cohen's $d_z = \bar d / s_d$ | standardised effect on the paired differences |
| NaN guard | `summarizePaired` and `exactPairedPermutationP` assert that every input and every output is finite, the two arms have equal length, and $2^{-N} \le p \le 1$ | added in Pass 21 after a **found bug**: with `obs = NaN`, every comparison `s >= obs` is false, so the old code returned $p = 0$ and a NaN run *passed*. That bug can no longer happen. |
| thresholds | fixed in the test file before the final run (`p < 0.001 … 0.01` depending on the test) | see each assertion in [nobel_rigor_suite.mjs](live/test/nobel_rigor_suite.mjs) |

**Multiple comparisons.** The suite runs 18 paired contrasts (T1 ×1, T3 ×2, T4 ×1, T5 ×2, T7 ×2, T8 ×2, T9 ×1,
T10 ×2, T11 ×1, T12 ×4). With a Bonferroni family-wise correction at α = 0.05, the per-test threshold is
0.05 / 18 = 0.0028.
- The suite prints exact p for 15 of the 18 contrasts. **14 of those 15 meet the Bonferroni threshold.**
- **T12b (ECE reduction) does not: p = 0.003906.** It passes its own pre-set threshold (p < 0.01), but it does not
  survive family-wise correction. Treat it as suggestive, not established.
- Three contrasts are only checked against their assertion and their exact p is not printed: T5b (quantum win rate
  above 0.75, asserted p < 0.001), T8a (regeneration vs. lesion, asserted p < 0.001) and T12c (transfer entropy vs.
  shuffled surrogate, asserted p < 0.005). T12c might therefore also fall above 0.0028.

**Degenerate effect size.** For T8 the suite prints `d_z = 999.00`. That is a sentinel value, not a measurement.
All 12 paired differences were identical (+0.271), so $s_d = 0$ and $d_z$ is undefined. The deterministic
bioelectric attractor reaches the same fixed point from every seed.

**Not pre-registered.** The thresholds were set by the authors, and several mechanisms were tuned during development
on the same seeds 1–12. A truly hostile replication should run on new seeds (for example `SEEDS_12 = 13…24`) without
changing the code. §6 lists this as open work.

---

## 2. Claim-type key

| tag | meaning | what a pass proves | what it does **not** prove |
|---|---|---|---|
| **[M] maths check** | the code reproduces a known identity or invariant to machine precision | the implementation is correct | anything about biology or behaviour |
| **[D] designed mechanism + lesion** | a mechanism is coded in on purpose; a lesion or surrogate removes it; the paired difference is measured | the mechanism is causally wired into the closed loop and has a measurable effect | that the effect would emerge without being designed |
| **[E] emergent / population** | the outcome is not written into any rule; it comes out of selection, learning or interaction | a real A-Life result, at the stated scale | generality beyond this world |

---

## 3. Hostile peer-review defense matrix (T1–T12)

All statistics: $N = 12$ seeds, exact $2^{12}$ permutation p, paired $d_z$. Command: `node test/nobel_rigor_suite.mjs`
(from `live/`).

### T1 · First law, second law, closed N/C mass ledger · **[M] + [D]**
- **Equations.** 11-pool energy ledger with Kahan-compensated sums: $\sum_i \Delta E_i = Q_{\text{solar}} - Q_{\text{rad}}$.
  Clausius entropy production rate $\dot\Sigma = \sum_k \dot Q_k / T_k \ge 0$. Closed nitrogen and carbon mass balances.
- **Code.** [world.js `auditEnergyClosure`](live/js/sim/world.js#L842), [world.js `auditMassClosure`](live/js/sim/world.js#L681).
- **Falsifier.** Remove all atmospheric N₂ (`setAtmosphericN2(0, true)`). The prediction: nitrogen fixation must
  read exactly 0, and photosynthetic solar uptake must fall because plants become N-limited.
- **Measured.** `E_err = 2.21e-16`, `M_err = 2.62e-16` (both < 1e-12), `min Σ̇ = +8.09e-4 kW/K` (> 0 at every step),
  N fixed at N₂ = 0 is exactly 0. Solar uptake intact − N₂-free = **+1.236 kJ, p = 0.000244, d_z = 1.84**.

### T2 · 7-site FMO complex: GKSL Lindblad equation vs. classical Förster hopping · **[M]**
- **Equations.** $\dot\rho = -i[H,\rho] + \sum_k \gamma(T)\,(L_k\rho L_k^\dagger - \tfrac12\{L_k^\dagger L_k,\rho\})$
  with sink and loss channels, using the 7-site Adolphs–Renger (2006) Hamiltonian. This is compared against a rate-equation
  Förster model on the same couplings.
- **Code.** [world.js `solveFMOLindbladExact`](live/js/sim/world.js#L78), [world.js `solveFMOForsterExact`](live/js/sim/world.js#L132).
- **Falsifier.** Environment-assisted quantum transport (ENAQT; Rebentrost et al. 2009; Plenio & Huelga 2008)
  predicts that efficiency is non-monotonic in dephasing rate: low at cryogenic temperatures (Anderson localisation),
  low again at high dephasing (quantum Zeno effect), and peaked in between.
- **Measured.** Trace error `1.89e-15`. Φ(−10 °C) = 0.3577 < **Φ(24 °C) = 0.8109** > Φ(54 °C) = 0.6388. Förster at 24 °C
  = 0.7775.
- **Caveat.** Deterministic, so no p-value. Whether coherence matters in real FMO at physiological temperature is
  still disputed (Duan et al. 2017). This test shows the model reproduces the ENAQT curve, not that biology does.

### T3 · Cryptochrome-4 radical pair: 8×8 Liouville–Haberkorn + Ritz RF resonance · **[M] + [D]**
- **Equations.** 8×8 spin density matrix (2 electrons + 1 spin-1 ¹⁴N nucleus) with Zeeman, anisotropic hyperfine
  and Haberkorn recombination: $\dot\rho = -i[H,\rho] - \tfrac{k}{2}\{P_S,\rho\} - \tfrac{k}{2}\{P_T,\rho\}$.
  The singlet yield $\Phi_S$ sets the compass signal.
- **Code.** [heptarch.js `solveCry4Haberkorn8x8`](live/js/sim/heptarch.js#L270).
- **Falsifiers.** (a) Inversion symmetry $\Phi_S(-\mathbf B) = \Phi_S(\mathbf B)$, which makes this an
  *inclination* compass, as in birds (Wiltschko). (b) Spin relaxation must erase the contrast monotonically. (c) Ritz
  et al. (2004): an RF field at the electron Larmor frequency ω_L disrupts the compass, while the same amplitude at 7 ω_L
  does not. (d) Lesioning magnetoreception at night must increase head-direction error.
- **Measured.** Parity error `9.99e-16`. Contrast decays monotonically to < 1e-3. In the closed loop, night heading
  error with the lesion − intact = **+0.715 rad, p = 0.000244**. Resonant RF − off-resonant RF = **+0.766 rad,
  p = 0.000977, d_z = 1.11**.

### T4 · 4-qubit C₃ cospectral twins + KCBS / CEGA-18 / Hoggar contextuality · **[M]**
- **Equations.** Two 16×16 carrier matrices with identical eigenvalues (`eigDiff = 3.55e-15`) and equal
  $\operatorname{Tr}L^2 = 2240$. They are told apart only by the cubic Jordan trace $\operatorname{Tr}L^3 = 14976$ vs
  $15360$. KCBS value $=\sqrt5$, CEGA-18 $= 9 > 8$, Hoggar 63/315 lines with floor 1/3.
- **Code.** [qgtl.js `evalCospectralTwins`](live/js/tsotchke/qgtl.js#L519), [qgtl.js `chooseSafeCospectralObelisk`](live/js/tsotchke/qgtl.js#L544).
- **Falsifier.** A classical spectral discriminator must be at chance, because the spectra are equal.
- **Measured.** Jordan/QGT 100.0% vs spectral 48.0%: **p = 0.000244, d_z = 4.07**.
- **Caveat.** The 100% is guaranteed by the maths once the invariant is computed. This shows the identity is coded
  correctly and the agent's choice uses it. It is not learned discrimination.

### T5 · Two-qubit density-matrix CHSH game and no-signalling · **[M] + [D]**
- **Equations.** $S = |E(a,b)+E(a,b')+E(a',b)-E(a',b')|$ on a 4×4 $\rho_{AB}$ with noise. The classical (LHV)
  surrogate uses shared randomness only, so its win rate is bounded by 0.75.
- **Code.** [ecosystem.js `evalTwoQubitBellMetrics`](live/js/sim/ecosystem.js#L72).
- **Falsifier.** The LHV surrogate must not beat 75% beyond binomial noise. The exact marginals must not depend on
  the other party's setting.
- **Measured.** Quantum win rate 80.60% (S_emp = 2.447) vs LHV 74.68%: **p = 0.000244, d_z = 3.66**. Exact marginal
  bias `0.0e+0`. Empirical no-signalling gap ≤ 0.0962 (finite-sample noise over ≥ 1000 rounds/seed).
- **Caveat.** This is a classical program sampling from a quantum distribution, so **no physical non-locality occurs**.
  Both "particles" share one CPU. The test checks that the sampler is correct (it beats the Bell bound, does not reach
  Tsirelson's 85.4% because of the coded noise, and does not signal).

### T6 · Poincaré disk (K = −1) geometry for Xylos gliders · **[M]**
- **Equations.** Ungar's Möbius addition $u \oplus v$, the distance $d(u,v) = 2\,\operatorname{artanh}|(-u)\oplus v|$,
  and the Gauss–Bonnet angular defect $\pi - (\alpha+\beta+\gamma) = \text{Area} > 0$.
- **Code.** [qgtl.js `poincareTriangleDefect`](live/js/tsotchke/qgtl.js#L599).
- **Measured.** Minimum defect `+0.0249 rad` (> 0 on all non-degenerate triangles). Möbius isometry error `2.66e-15`.
  Live Xylos positions stay in the disk, max |w| = 0.9400 < 1.

---

### Summary table (verbatim from the Pass 21 run)

| id | theorem | integrity metric | effect [95% CI] | p | d_z |
|---|---|---|---|---|---|
| T1 | 1st/2nd law + closed N/C mass | E_err 2.21e-16, M_err 2.62e-16, min Σ̇ +8.09e-4 | ΔSolar +1.236 kJ [0.910, 1.631] | 0.000244 | 1.84 |
| T2 | 7-site FMO GKSL | trace error 1.89e-15 | cryo 0.358 < 24 °C 0.811 > Zeno 0.639; Förster 0.778 | exact | — |
| T3 | Cry4 Haberkorn + Ritz RF | parity 9.99e-16, ΔΦ res/off 0.037/0.158 | lesion +0.715 rad; resonant RF +0.766 rad [0.423, 1.162] | 0.000977 | 1.11 |
| T4 | C₃ cospectral twins + contextuality | eigDiff 3.55e-15, Tr L³ 14976 vs 15360 | 100.0% vs 48.0% (+52.0%) | 0.000244 | 4.07 |
| T5 | density-matrix CHSH, no-signalling | exact bias 0, S_emp 2.447 > 2 | 80.60% vs 74.68% | 0.000244 | 3.66 |
| T6 | Poincaré disk K = −1 | isometry error 2.66e-15, max \|w\| 0.940 | min Gauss–Bonnet defect +0.0249 rad | exact | — |
| T7 | NESTOR rounding + nullspace + Pareto | bias 0.0049, orthogonality 0 | ΔNLL +0.279; 17.6× less compute | 0.000244 | 2.91 |
| T8 | bistable bioelectric memory | 0/128 genes changed; regen 0.911 vs 0.500 | shape 1.000 → 1.271 | 0.000244 | undefined (zero variance) |
| T9 | RS[15,11] acoustic ECC | 4.50 early evasions | predations 8.92 → 1.00 | 0.000244 | 7.31 |
| T10 | IPD Titans + Bayesian Shoggoths | Titan coop − defector +30.03 (p 0.000244) | Shoggoth Bayes 6.09 vs naive −3.38 | 0.000244 | 6.67 |
| T11 | Bedau–Packard activity | adaptive 27.87 vs neutral 10.45 | +17.42 [11.53, 22.81] | 0.000488 | 1.65 |
| T12 | NLL + ECE + transfer entropy | NLL −1.082 → −1.275, ECE 0.148 → 0.097 | TE 0.094 vs shuffled 0.054 / lesioned 0.012 bits | 0.000244 | 6.86 |

---

### T7 · NESTOR 23-rung stochastic rounding, nullspace escape, Pareto frugality · **[M] + [D]**
- **Equations.** Stochastic rounding: $\mathbb E[q(x)] = x$, and variance falls as bit width rises. Gram–Schmidt
  escape direction orthogonal to the trapped 2×2 trajectory covariance.
- **Code.** [heptarch.js `quantizeNestorRung`](live/js/sim/heptarch.js#L425).
- **Falsifiers.** Adaptive precision must give lower world-model NLL than fixed 1-bit precision, and must use less
  compute energy than fixed full precision.
- **Measured.** Maximum bias 0.0049 over 40,000 draws; variance strictly decreasing; rung 22 gives exactly 0.
  Nullspace orthogonality `0.0e+0`. NLL(fixedLow) − NLL(adaptive) = **+0.279, p = 0.000244**. Compute-ATP ratio
  fixedHigh / adaptive = **17.6×, p = 0.000244**.
- **Caveat.** "Compute ATP" is the model's own accounting of bit-operations. It is not a measured wall-clock or
  joule saving on hardware.

### T8 · Levin-style bistable bioelectric syncytium and cryptic pattern memory · **[D]**
- **Equations.** Gap-junction-coupled $V_{\text{mem}}$ with a bistable ion-channel nonlinearity (attractors near
  −56 mV and −14 mV). Regrowth paid in ATP, gated by $V_{\text{mem}}$. No target value is stored anywhere.
- **Code.** [creature.js `stepBioelectric` call](live/js/sim/creature.js#L1237) → [heptarch.js](live/js/sim/heptarch.js).
- **Falsifiers.** (a) A gap-junction lesion must block regeneration. (b) A transient voltage clamp must change the
  regrown shape **without changing any gene**, and a reverse clamp must undo it (cf. Durant et al. 2017, planarian
  two-headed phenotype).
- **Measured.** Regeneration intact 0.911 vs lesion 0.500. Ectopic shape scale 1.271 vs canonical 1.000. **0/128
  genes changed. p = 0.000244.** The reverse clamp returns the shape to < 1.08 for all 12 seeds.

### T9 · Reed–Solomon RS[15,11,d=5] over GF(16) for colony alarm calls · **[M] + [D]**
- **Equations.** Systematic RS encoding; Peterson–Berlekamp error locator + Forney evaluator; corrects
  t = 2 symbol errors per frame.
- **Code.** [heptarch.js `encodeAcousticCallRS`](live/js/sim/heptarch.js#L158).
- **Falsifier.** Turn ECC off during a burst-noise storm (the same storm in both arms).
- **Measured.** Predations without ECC 8.92 → with ECC 1.00 (difference 7.92, 4.50 early evasions):
  **p = 0.000244, d_z = 7.31**. Exhaustive check in `dome_heptarch_probe.mjs`: 1000/1000 random 2-symbol errors corrected.

### T10 · Press–Dyson memory-1 IPD Titans and Level-2 Bayesian Shoggoth screening · **[D]**
- **Equations.** Noisy iterated Prisoner's Dilemma (T, R, P, S) with memory-1 strategies (GTFT, WSLS) against a
  defector, with multilateral sanctions. Costly-signalling encounters: a Level-2 agent updates a Beta posterior on
  deception; the Level-0 control trusts naively.
- **Code.** [ecosystem.js IPD payoff](live/js/sim/ecosystem.js#L1130).
- **Measured.** Titans: cooperators 20.41 vs defector −9.61, **p = 0.000244**. Shoggoth encounters: Bayes 6.09 vs naive
  −3.38, **p = 0.000244, d_z = 6.67**.
- **Caveat.** Cooperation beating defection is expected when sanctions exist (Axelrod; Nowak). This test shows the
  sanctions are causally wired. It is not a discovery.

### T11 · Bedau–Packard evolutionary activity vs. a neutral shadow model · **[E]**
- **Method.** Bedau, Snyder & Packard (1998, *ALife VI*). Each of the heritable loci is binned into K = 8
  equal-measure octiles of its own `[lo, hi]` range. Excess concentration activity is
  $\Delta_{l,b}(t)=\max(0, c_{l,b}(t)-c_0)$ with $c_0 = 2/K$, accumulated over time. The **neutral shadow** runs the
  same population size, the same births and deaths (age ≥ 32, mating refractory period), and the same Mendelian
  crossover + reflecting mutation operator, but chooses parents **at random** instead of by survival and mating
  success.
- **Code.** [ecosystem.js `bedauNeutralActivity`](live/js/sim/ecosystem.js#L193), [ecosystem.js `_neutralShadowBirth`](live/js/sim/ecosystem.js#L259).
- **Falsifier.** If selection did nothing, adaptive activity would equal shadow activity.
- **Measured (320 s, 24 peers).** Adaptive 27.87 vs neutral 10.45: **+17.42 [95% CI 11.53, 22.81], p = 0.000488,
  d_z = 1.65.**
- **Caveat.** This is the most "A-Life" result in the suite, and the one a reviewer should probe hardest. It shows
  selection drives allele frequencies above drift over a few generations. It does **not** show open-ended evolution:
  there is no unbounded growth in diversity or complexity, and the genome length is fixed at 128 loci.

### T12 · Proper Gaussian NLL, 10-bin ECE and Schreiber transfer entropy · **[D] + [E]**
- **Equations.** Prequential (predict-then-update) Gaussian NLL with online temperature scaling. Kuleshov et al. (2018)
  10-bin calibration error. Schreiber (2000) transfer entropy motor → sensory, compared against a time-shuffled
  surrogate and a motor-neuron lesion.
- **Code.** [metacog.js ECE](live/js/sim/metacog.js#L100), [metacog.js transfer entropy](live/js/sim/metacog.js#L126).
- **Falsifiers.** Calibration must lower NLL and ECE on held-out (future) steps. A real sensorimotor loop must carry
  more information than a shuffled series, and more than a paralysed body.
- **Measured (35 s per seed).**
  - NLL raw −1.082 → calibrated −1.275, **p = 0.000244**.
  - ECE raw 0.148 → calibrated 0.097, **p = 0.003906** (does not survive Bonferroni; see §1).
  - Transfer entropy in the closed loop 0.094 bits vs. time-shuffled 0.054 bits vs. motor-lesioned 0.012 bits.
    Active vs. lesioned: **p = 0.000244, d_z = 6.86**.
- **Caveat.** Transfer entropy is computed on discretised low-dimensional signals over a short window. The shuffled
  surrogate keeps 0.054 bits because of finite-sample bias. The meaningful quantity is the gap above it, not the
  absolute value.

---

## 4. Additional regression gates

| gate | command (from `live/`) | measured |
|---|---|---|
| Dome / HEPTARCH algebra + causal lesions | `node test/dome_heptarch_probe.mjs` | **6/6, identical over two consecutive runs.** KCBS 2.236068, CEGA-18 9.0, Hoggar 63/315, RS 1000/1000, 60-s energy closure error 0.00e+0, max seat weight 0.44 ≤ 0.46, Xenomimic CHSH 2.109, Levin regen 0.867 vs 0.500 lesioned, Cry4 night heading error 0.0602 vs 0.6576 rad lesioned, sanctuary ward 0 vs 1 predations |
| Navigation | `node test/nav_probe.mjs 1,2,3,4` | **NEAR 4/4 (mean 6.5 s), FAR 4/4 (mean 26.5 s), upright 0.94, 1% of steps on its back**, 43% of steps steered by path integration |
| Browser (headless Chrome, WebGL2) | `node test/dome_ui_check.mjs` (serves the repo locally; `CHROME=` sets the browser path), final Pass 21 code | `consoleErrors: []`, `pageErrors: []`, no NaN or `undefined` in the Dome or Mind HUD. Live readouts: ΔE 0.0e+0, dΣ/dt 1.56e-3 kW/K, ΔM 0.0e+0, ENAQT 80.8% vs Förster 76.8%, max π 0.370 ≤ 0.46; brain M = 3,268 neurons |

The navigation probe here uses 4 seeds, not the 8 used in earlier passes, so "4/4" has wide uncertainty
(a one-sided 95% lower bound on the success rate is about 47%).

---

## 5. Reproduce every number

```bash
cd glitchling-jam/live
node test/nobel_rigor_suite.mjs          # T1–T12, N = 12 seeds; ~20 min on one CPU core
FROM_T=11 node test/nobel_rigor_suite.mjs # resume from a given theorem
node test/dome_heptarch_probe.mjs        # 6 Dome/HEPTARCH gates
node test/nav_probe.mjs 1,2,3,4          # navigation
node test/dome_ui_check.mjs              # headless Chrome: console/page errors + NaN in HUD
```

Everything in the simulation is seeded (`mulberry32`), with one known exception. The Gray-Scott skin's spot nucleation
in [skin.js](live/js/sim/skin.js) still calls `Math.random`. The rigor suite sets `noSkin = true` on every creature it
builds, and the dome probe gave identical output on two consecutive runs. Even so, a fully seeded skin RNG is open work.
The same Node version on the same code reproduces the numbers above. Pass 21 suite run: Node v25.8.2, Windows.

---

## 6. Honest limits and open work

1. **Hardware boundary.** Every quantum module (16-qubit WASM state vector, GKSL Lindblad, Haberkorn, 32-qubit MPS) is a
   classical FP64 simulation. No entanglement, coherence or non-locality exists physically in the creature or the
   browser.
2. **Biology boundary.** FEM tissue, Murray's-law vessels, bioelectric syncytia and population genetics are mesoscale
   models with hand-chosen parameters. They are not molecular, and they are not fitted to wet-lab data.
3. **Scale.** The default brain has 3,268 point/compartmental neurons. The large settings (up to 14.16M neurons) use
   procedural, quantised synapses and do not reproduce cortical connectomics.
4. **Designed vs. emergent.** Ten of the twelve tests check mathematics or designed mechanisms. Only T11 (and part of
   T12) test behaviour that is not written into the rules. A reviewer is right to weight them differently.
5. **Same-seed tuning.** Several parameters were adjusted during development while looking at seeds 1–12. A clean
   replication on unseen seeds 13–24 has not been run yet.
6. **Open-endedness.** No claim of open-ended evolution is made. The Bedau–Packard activity test shows adaptive
   selection over drift, not unbounded novelty.
7. **No consciousness claims.** Metacognitive calibration (T12) is a statistical property of predictions, not
   self-awareness.

## References

Adolphs & Renger 2006 *Biophys J* 91:2778 · Rebentrost et al. 2009 *New J Phys* 11:033003 · Plenio & Huelga 2008
*New J Phys* 10:113019 · Duan et al. 2017 *PNAS* 114:8493 · Ritz et al. 2004 *Nature* 429:177 · Haberkorn 1976 *Mol Phys*
32:1491 · Klyachko et al. 2008 *PRL* 101:020403 (KCBS) · Cabello et al. 1996 *Phys Lett A* 212:183 (18-vector KS) ·
Clauser, Horne, Shimony & Holt 1969 *PRL* 23:880 · Ungar 2008 *Analytic Hyperbolic Geometry* · Durant et al. 2017
*Biophys J* 112:2231 · Reed & Solomon 1960 *J SIAM* 8:300 · Press & Dyson 2012 *PNAS* 109:10409 · Bedau, Snyder & Packard
1998 *ALife VI* 228–237 · Kuleshov, Fenner & Ermon 2018 *ICML* · Schreiber 2000 *PRL* 85:461 · Fisher 1935 *The Design of
Experiments* · Pitman 1937 *JRSS Suppl* 4:119.
