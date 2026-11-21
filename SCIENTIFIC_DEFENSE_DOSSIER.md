# Glitchling v2 · Scientific Defense Dossier (Pass 22)

This file lists every quantitative claim the `live/` simulation makes through Pass 22, the exact code that computes it,
the lesion, surrogate, or null model that could falsify it, and the verbatim numbers measured across **independent
replication cohorts** (up to $N = 36$ seeds). Nothing here is estimated by hand.

It also states plainly **what kind of claim each theorem supports** (`[M]` mathematical identity check, `[D]` designed
mechanism tested by causal lesion/surrogate, or `[E]` emergent adaptive / learning / ecological outcome not written into
any rule) and **every methodological bug found and fixed along the way**.

> **Epistemic & hardware boundary.** Glitchling is a classical IEEE-754 (FP64) simulation running on CPU (with optional
> WASM/WebGPU). It makes no claim of awareness, feelings, sentience, or consciousness. Every "quantum" module simulates
> classical linear algebra on density matrices or statevectors; it proves the *mathematics* is implemented correctly, not
> that physical entanglement or coherence occurs inside the creature or browser.

---

## 1. Statistical Protocol, Multi-Cohort Replication & Audits

| item | Pass 22 protocol | why it matters |
|---|---|---|
| sample design | **Two independent 12-seed cohorts** (`Cohort A: 1..12`, `Cohort B: 13..24`, combined $N = 24$), PLUS a **third completely untouched locked replication cohort (`Cohort C: 25..36`)** for all new/modified Pass 22 theorems (`T12`–`T15`) | separates development from locked out-of-sample replication (`13..24` locked on unmodified Pass 21 commit `48eb260` for `T1`–`T11`; `25..36` locked on final Pass 22 code for `T12`–`T15`) |
| per-cohort test | exact one-sided paired sign-flip permutation test over all $2^{12} = 4,096$ sign patterns (Fisher 1935; Pitman 1937) | zero normality assumption; exact finite-sample $p$-value (floor $2^{-12} = 0.000244$) |
| combined $N = 24$ test | exact Fisher combined test $\chi^2_4 = -2(\ln p_A + \ln p_B)$ over independent exact permutation $p$-values (`p_Fisher = (1 + x^2/2) exp(-x^2/2)`) | lowers the exact floor to $1.05 \times 10^{-6}$ ($3.55 \times 10^{-9}$ across 3 independent cohorts) |
| family-wise error rate | exact **Holm–Bonferroni** step-down, **full Bonferroni** ($M \cdot p$), and **Benjamini–Hochberg FDR** across **all 26 paired contrasts** printed explicitly | zero hidden contrasts: **26/26 pass Holm–Bonferroni AND 26/26 pass full Bonferroni ($\alpha = 0.05$) in Cohort A AND in Cohort B**, and **26/26 pass full Bonferroni at $p_{\text{Bonf,24}} \le 1.93 \times 10^{-4}$** combined |
| confidence intervals & effect sizes | 10,000-resample deterministic percentile bootstrap 95% CI + paired Cohen's $d_z = \bar d / s_d$ (`det(sd=0)` reported honestly whenever $s_d = 0$, replacing Pass 21's sentinel `999.00`) | deterministic, transparent, zero sentinel artifacts |
| NaN & determinism guards | `summarizePaired` and `exactPairedPermutationP` assert finiteness of every sample & output and $2^{-N} \le p \le 1$; zero `Math.random()` calls remain anywhere in `live/js/sim/` | catches Pass 21's found `NaN → p = 0` bug and makes full-skin simulations 100% bit-reproducible |

### Methodological defects audited and fixed in Pass 22
Four subtle vulnerabilities a hostile reviewer would have caught in Pass 21 (`48eb260`) were found by line-by-line code
audit and fixed:
1. **Unseen-seed replication (locked before any Pass 22 edits):** Running unmodified Pass 21 (`48eb260`) on unseen seeds
   `13..24` passed **12/12 theorems**, **18/18 Holm–Bonferroni**, and **18/18 full Bonferroni** ($\alpha = 0.05$),
   including `T11` Bedau–Packard activity (`24.06 vs 8.09`, $p = 0.000244$) and `T12b` ECE ($p = 0.000732$).
2. **`T12c` Transfer Entropy surrogate mismatch ([metacog.js](live/js/sim/metacog.js#L71)):** Pass 21 summed 3 directed
   TE channels (`Act→Env + Env→Sens + Brain→Act`) but compared them against only 1 lag-shuffled channel (`Act→Env`).
   Pass 22 computes exact `3×3×3` quantile-binned Schreiber (2000) TE across all 3 physical sensorimotor edges
   (`differential muscle torque → body yaw/forward velocity → proprioceptive/bearing afferents → torque`) against a
   **matched 3-edge circularly time-shifted surrogate** (30 random shifts $\tau \in [50, T-50]$ per edge; Theiler /
   Schreiber / Lizier standard preserving every marginal and autocorrelation).
3. **`T12b` Kuleshov ECE distribution mismatch ([metacog.js](live/js/sim/metacog.js#L160)):** Pass 21 applied 1-D
   Gaussian coverage quantiles to a 25-D RMS ($\chi_{25}/\sqrt{25}$), causing high variance and a Bonferroni miss on
   seeds `1..12` ($p = 0.0039$). Pass 22 evaluates exact per-dimension 1-D Gaussian coverage $|r_o| \le z_q\sqrt{v}$ on
   all 25 prequential residuals `wm.err[0..24]` before updating `varTemp` (hitting $p = 0.000244$, $d_z = 3.15$–$4.03$
   across all three cohorts!).
4. **FMO Förster baseline & Cry4 spin wording ([world.js](live/js/sim/world.js#L135), [heptarch.js](live/js/sim/heptarch.js#L271)):**
   - Replaced the extra `gammaReorgPs = 110 ps⁻¹` offset in `solveFMOForsterExact` with the **zero-free-parameter
     adiabatic secular Pauli–Förster elimination** ($\Gamma_{ij} = \gamma_\phi + k_{\text{loss}} + \frac12(k_{\text{trap},i}+k_{\text{trap},j})$)
     from the exact same GKSL equation. It preserves the realistic physiological room-temperature coherence gain
     (`0.8109 > 0.8056`, $+0.54\%$, matching Wu, Cao & Silbey 2010), the cryogenic advantage (`0.3577 > 0.2606`,
     $+37.3\%$ relative), and **exact quantum-to-classical correspondence at high dephasing** (`54 °C`: `0.638849` vs
     `0.638862`, gap $1.3 \times 10^{-5}$).
   - Corrected Pass 21's prose mislabeling of the $8 \times 8$ (`2×2×2`) Cry4 Hilbert space: it models **two spin-1/2
     electrons + one axial spin-1/2 hyperfine nucleus** (Ritz–Adem–Schulten 2000 minimal radical-pair model, e.g.
     $^{15}\text{N}$ / effective $I = 1/2$, not 12-D spin-1 $^{14}\text{N}$), with Larmor RF modeled as an effective
     rotating-wave Lorentzian transverse spin-flip channel (cf. Hore & Mouritsen 2016 *Annu. Rev. Biophys.* on bare
     lifetime RF scaling).
   - Replaced the last remaining `Math.random()` in `live/js/sim/` ([skin.js](live/js/sim/skin.js#L10)) with `mulberry32`.

---

## 2. Claim-Type Key

| tag | meaning | what a pass proves | what it does **not** prove |
|---|---|---|---|
| **[M] maths check** | reproduces an analytic identity or invariant to machine precision | implementation correctness | anything about biology or behaviour |
| **[D] designed mechanism + lesion** | mechanism coded intentionally, tested by causal lesion or surrogate | causal wiring into the closed loop with measurable effect | spontaneous emergence without design |
| **[E] emergent / adaptive** | outcome is not written into any rule; arises from multi-generation selection, unsupervised plasticity, or trophic interaction | genuine A-Life / learning / ecological result at the tested scale | open-endedness beyond the fixed genome / environment |

---

## 3. Master 15-Theorem, 26-Contrast Defense Matrix (`T1`–`T15`, $N = 24$ Combined + Locked `25..36`)

### Complete 26-Contrast FWER Table (Verbatim from `pass22_1_12.json` & `pass22_13_24.json`)

Every single contrast below passes **Holm–Bonferroni (26/26)** and **Full Bonferroni (26/26)** at $\alpha = 0.05$ in
Cohort A (`1..12`), in Cohort B (`13..24`), and at $p_{\text{Bonf,24}} \le 1.93 \times 10^{-4}$ combined ($N = 24$):

| contrast | type | +seeds / 24 | mean $\Delta_{24}$ [95% CI] | $p_A$ (`1..12`) | $p_B$ (`13..24`) | $p_{\text{Fisher,24}}$ | $p_{\text{Bonf,24}}$ | $d_{z,24}$ |
|---|---|---|---|---|---|---|---|---|
| **T1**: Solar PAR fixation (Intact $\text{N}_2$ vs $\text{N}_2 = 0$) | [M]+[D] | 24/24 | +1.1921 kJ [0.9686, 1.4574] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 1.90 |
| **T3a**: Cry4 night HD error (Lesion − Intact) | [M]+[D] | 24/24 | +0.6829 rad [0.5734, 0.7919] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 2.44 |
| **T3b**: Cry4 night HD error (Resonant $\omega_L$ − $7\omega_L$ RF) | [M]+[D] | 21/24 | +0.7565 rad [0.5180, 1.0134] | 0.000977 | 0.000488 | $7.42\times10^{-6}$ | $1.93\times10^{-4}$ | 1.19 |
| **T4**: Blind $C_3$ cospectral obelisk accuracy (QGT − Spectral) | [M] | 24/24 | +49.58% [45.92%, 53.67%] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 5.03 |
| **T5a**: CHSH win rate (Quantum $\rho_{AB}$ − Classical LHV) | [M]+[D] | 24/24 | +5.69% [5.04%, 6.31%] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 3.53 |
| **T5b**: Quantum CHSH win rate above 75% Bell ceiling | [M]+[D] | 24/24 | +5.51% [5.13%, 5.89%] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 5.62 |
| **T7a**: NESTOR world-model NLL (`fixedLow` − `adaptive`) | [M]+[D] | 24/24 | +0.2672 [0.2248, 0.3116] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 2.38 |
| **T7b**: NESTOR compute ATP (`fixedHigh` − `adaptive`, 17.6×) | [M]+[D] | 24/24 | +0.1855 [0.1855, 0.1855] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 15827.61 |
| **T8a**: Levin limb regeneration (Intact − Gap-Junction lesion) | [D] | 24/24 | +0.4114 [0.4114, 0.4114] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | det($s_d$=0) |
| **T8b**: Levin cryptic ectopic morph (−14 mV vs −56 mV, 0/128 genes) | [D] | 24/24 | +0.2710 [0.2710, 0.2710] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | det($s_d$=0) |
| **T9**: RS[15,11] burst-noise ECC predations prevented (OFF − ON) | [M]+[D] | 24/24 | +7.83 [7.08, 8.54] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 4.17 |
| **T10a**: Titan IPD payoff (GTFT/WSLS Cooperator − Defector) | [D] | 24/24 | +28.98 [26.08, 31.88] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 3.83 |
| **T10b**: Shoggoth net payoff (Level-2 Bayes − Level-0 Naive) | [D] | 24/24 | +9.98 [9.42, 10.56] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 6.79 |
| **T11**: Bedau–Packard evolutionary activity (Adaptive − Shadow) | **[E]** | 23/24 | +16.70 [12.32, 21.38] | 0.000488 | 0.000244 | $2.02\times10^{-6}$ | $5.25\times10^{-5}$ | 1.45 |
| **T12a**: Prequential proper Gaussian NLL reduction (Raw − Cal) | [D] | 24/24 | +0.2169 [0.1765, 0.2591] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 2.05 |
| **T12b**: Per-dim Kuleshov 10-bin ECE reduction (Raw − Cal) | [D] | 24/24 | +0.0922 [0.0818, 0.1021] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 3.54 |
| **T12c**: Matched 3-edge loop TE (Active − 3-edge circular null) | **[E]** | 24/24 | +0.1012 bits [0.0885, 0.1139] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 3.10 |
| **T12d**: Matched 3-edge loop TE (Active − Motor-lesioned) | **[E]** | 24/24 | +0.1418 bits [0.1259, 0.1572] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 3.51 |
| **T13a**: Divergent selection `thermOpt` (Warm − Cool biome) | **[E]** | 24/24 | +0.3172 [0.2976, 0.3350] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 6.71 |
| **T13b**: Divergent `thermOpt` shift (Adaptive − Neutral Shadow) | **[E]** | 24/24 | +0.2874 [0.2494, 0.3291] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 2.80 |
| **T14a**: Unsupervised Transformer-XL WM MSE cut (Frozen − Learn) | **[E]** | 24/24 | +0.0910 [0.0841, 0.0980] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 5.19 |
| **T14b**: Unsupervised Rao–Ballard PC error cut (Frozen − Learn) | **[E]** | 24/24 | +0.0552 [0.0523, 0.0582] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 7.26 |
| **T14c**: Wiener HDC held-out spatial corr (Wiener − DeltaFixed) | **[E]** | 24/24 | +0.0543 [0.0464, 0.0631] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 2.52 |
| **T14d**: DeltaFixed HDC held-out corr (Fixed − Superpose) | **[E]** | 24/24 | +0.0935 [0.0838, 0.1038] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 3.68 |
| **T15a**: Social alarm predations prevented (Silent − Social) | [D] | 24/24 | +13.42 [12.21, 14.58] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 4.48 |
| **T15b**: **3-trophic Ecology-of-Fear plant fruit cascade** (Social − Silent) | **[E]** | 24/24 | +0.1362 [0.1196, 0.1517] | 0.000244 | 0.000244 | $1.05\times10^{-6}$ | $2.73\times10^{-5}$ | 3.26 |

### Locked Zero-Leakage Third Replication Cohort (`Cohort C: SEEDS = 25..36`) on All New/Updated Pass 22 Theorems (`T12`–`T15`)
Because development probes touched seeds `1, 2, 3, 13, 14, 15` while designing `T12`–`T15`, we ran a **completely
untouched third 12-seed cohort (`SEEDS = 25..36`)** with zero code changes afterward:

- **12 / 12 contrasts hit the exact $2^{-12}$ floor (`p = 0.000244`, 12/12 seeds positive; `p_Holm = p_Bonf = 0.002930`)**:
  - `T12a` NLL: `−1.112 → −1.273` (`+0.1611 [0.1189, 0.2024]`, $d_z = 2.08$)
  - `T12b` Per-Dim ECE: `0.279 → 0.198` (`+0.0805 [0.0676, 0.0923]`, $d_z = 3.51$)
  - `T12c` Matched 3-Edge TE vs 3-Edge Circular Null: `0.193 > 0.079` (`+0.1145 [0.0951, 0.1362]`, $d_z = 2.98$)
  - `T12d` Matched 3-Edge TE vs Motor-Lesioned: `0.193 > 0.022` (`+0.1707 [0.1507, 0.1931]`, $d_z = 4.27$)
  - `T13a/b` `[E]` Divergent Natural Selection (`6.2` gens): `Warm 0.632 > Cool 0.331` (`Adap +0.301` vs `Shadow −0.009`, $d_z = 5.05 / 2.34$)
  - `T14a/b/c/d` `[E]` Ontogenetic Learning: `WM 0.1183 → 0.0296` ($d_z = 5.53$), `PC 0.0883 → 0.0323` ($d_z = 6.89$), `HDC r 0.848 < 0.927 < 0.969` ($d_z = 3.78 / 3.07$)
  - `T15a/b` `[E]` 3-Trophic Ecology-of-Fear Cascade: `predations 18.42 → 3.33` ($d_z = 8.23$), **`plant fruit 0.7954 → 0.9485` (`+0.1530 [0.1209, 0.1879]`, $d_z = 2.45$)**

### Exact Governing Equations, Code Links & Theorem Notes

- **T1 · First law, second law, closed N/C mass ledger (`[M]+[D]`):** [world.js `auditEnergyClosure`](live/js/sim/world.js#L847), [world.js `auditMassClosure`](live/js/sim/world.js#L686). Kahan 11-pool closure `E_err = 2.21e-16`, `M_err = 2.62e-16` (`2.67e-16` in Cohort B), `min Σ̇ = +8.09e-4 kW/K` (`+8.17e-4`), zero N fixed at $\text{N}_2 = 0$.
- **T2 · 7-site Adolphs–Renger FMO GKSL Lindblad vs zero-free-parameter adiabatic secular Pauli–Förster (`[M]`):** [world.js `solveFMOLindbladExact`](live/js/sim/world.js#L78), [world.js `solveFMOForsterExact`](live/js/sim/world.js#L135). Trace conservation `1.89e-15`. ENAQT bell curve: `Φ(−10 °C) = 0.3577 (F = 0.2606) < Φ(24 °C) = 0.8109 (F = 0.8056) > Φ(54 °C) = 0.6388 (F = 0.6389, correspondence gap 1.3e-5)`. Deterministic; demonstrates exact model physics (whether physiological FMO coherence is functionally relevant in vivo remains debated: Duan et al. 2017).
- **T3 · Minimal 8×8 (`2×2×2`) Cry4 Liouville–Haberkorn + Ritz Larmor RF (`[M]+[D]`):** [heptarch.js `solveCry4Haberkorn8x8`](live/js/sim/heptarch.js#L271). Two spin-1/2 electrons + one axial spin-1/2 hyperfine nucleus (Ritz–Adem–Schulten 2000). Inversion parity error `9.99e-16`; monotonic relaxation decay to `< 1e-3`; effective rotating-wave Lorentzian Larmor RF collapse (`dPhi = 0.037 vs 0.158`).
- **T4 · 4-qubit $C_3$ cospectral twins + KCBS / CEGA-18 / Hoggar / MPS $M_2$ (`[M]`):** [qgtl.js `evalCospectralTwins`](live/js/tsotchke/qgtl.js#L519), [qgtl.js `chooseSafeCospectralObelisk`](live/js/tsotchke/qgtl.js#L544). Exact cospectrality (`eigDiff = 3.55e-15`, $\operatorname{Tr}\Lambda^2 = 2240$), cubic Jordan split `14,976` vs `15,360`; `KCBS = √5`, `CEGA-18 = 9 > 8`, `Hoggar = 63/315` (floor 1/3), `M_2(Bell) = 0`, `M_2(Ry) = 0.4150`.
- **T5 · 4×4 density-matrix CHSH game & no-signalling (`[M]+[D]`):** [ecosystem.js `evalTwoQubitBellMetrics`](live/js/sim/ecosystem.js#L72). Cohort A/B quantum win rate `80.60% / 80.41%` (`S_emp = 2.447 / 2.430 > 2`) vs classical LHV `74.68% / 74.96%`; exact marginal bias `0.0e+0`; empirical finite-sample no-signalling max diff `0.0962 / 0.0949`. Classical CPU sampler; no physical non-locality.
- **T6 · Ungar $K = -1$ Poincaré-disk geometry on Xylos gliders (`[M]`):** [qgtl.js `poincareTriangleDefect`](live/js/tsotchke/qgtl.js#L599). Min Gauss–Bonnet angular defect `+0.0249 rad > 0`, Möbius automorphism isometry error `2.66e-15`, live `max |w| = 0.9400 < 1`.
- **T7 · NESTOR 23-rung unbiased stochastic rounding, nullspace escape & Pareto frugality (`[M]+[D]`):** [heptarch.js `quantizeNestorRung`](live/js/sim/heptarch.js#L426). Max bias `0.0049` (40k draws), strict variance monotonicity, nullspace orthogonality `0.0e+0`, `17.6×` accounted compute-ATP savings vs `fixedHigh` (model bit-operation accounting, not hardware wall-clock joules).
- **T8 · Target-free bistable Levin bioelectric syncytium & cryptic pattern memory (`[D]`):** [creature.js `stepBioelectric`](live/js/sim/creature.js#L1237). Regeneration `0.911` vs gap-junction lesion `0.500`; transient `−14 mV` clamp shifts regenerated morph `1.000 → 1.271` with **0/128 genomic loci altered**, reversed to `< 1.08` by `−56 mV` clamp on 24/24 seeds.
- **T9 · Spatial `RS[15,11,d=5]` `GF(16)` acoustic ECC in burst-noise storms (`[M]+[D]`):** [heptarch.js `encodeAcousticCallRS`](live/js/sim/heptarch.js#L158). Predations drop `8.92 → 1.00` (Cohort A) / `9.00 → 1.25` (Cohort B) with `4.50–5.00` early evasions.
- **T10 · Press–Dyson memory-1 IPD Titans & Level-2 Bayesian Shoggoths (`[D]`):** [ecosystem.js `ipdPayoff`](live/js/sim/ecosystem.js#L1130). Multilateral sanctions make GTFT/WSLS beat Defector (`+30.03 / +27.92`); Level-2 Bayesian screening beats Level-0 naive trust (`+9.47 / +10.49`).
- **T11 · Bedau–Packard (1998) excess evolutionary activity vs demographically matched neutral shadow (`[E]`):** [ecosystem.js `bedauNeutralActivity`](live/js/sim/ecosystem.js#L193), [ecosystem.js `_neutralShadowBirth`](live/js/sim/ecosystem.js#L259). $K = 8$ equal-measure octiles per locus, identical age/cooldown/Mendelian reflecting operator, fitness-blind shadow parents. Adaptive beats shadow on 23/24 seeds (`+16.70`, $p_{\text{Fisher,24}} = 2.02\times10^{-6}$). Demonstrates directional/stabilizing selection over drift, not unbounded open-endedness.
- **T12 · Prequential Gaussian NLL, per-dim Kuleshov 10-bin ECE & matched 3-edge Schreiber TE (`[D]+[E]`):** [metacog.js `ece10Bin`](live/js/sim/metacog.js#L160), [metacog.js `computeTE3CircNull`](live/js/sim/metacog.js#L71). Exact per-dimension residual ECE drops `0.287 → 0.201` (A), `0.300 → 0.201` (B), `0.279 → 0.198` (C). Exact 3-edge loop TE (`0.168 / 0.200 / 0.193` bits) beats both matched 3-edge circular-shift nulls (`0.083 / 0.083 / 0.079` bits) and motor-lesioned open-loop controls (`0.034 / 0.051 / 0.022` bits) on 36/36 seeds.
- **T13 · Emergent multi-generation divergent natural selection (`[E]`):** Starting from identical Generation-0 genomes in Warm (`seasonPhase = 0.25`) vs Cool (`seasonPhase = 0.75`) domes with **zero hardcoded target gene**, 6.0–6.2 diploid generations of pure physiological survival/reproduction diverge inherited `thermOpt` in opposite directions (`Warm 0.632–0.639` vs `Cool 0.314–0.331`, $\Delta \approx +0.31$, ~62% of the `[0.25, 0.75]` locus span), beating the matched Neutral Shadow (`-0.009` to `+0.045`) on **36/36 seeds**.
- **T14 · Emergent ontogenetic unsupervised learning & spatial memory generalization (`[E]`):** On live closed-loop 3D soft-body trajectories, unsupervised online learning cuts Transformer-XL 1-step MSE by ~75% (`0.119 → 0.029`) and Rao–Ballard predictive-coding error by ~63% (`0.087 → 0.032`) vs weight-frozen controls, while cross-spectral Wiener HDC strictly outperforms delta-fixed and Pass-3 superposition (`0.83 < 0.92 < 0.975`) on held-out spatial locations across **36/36 seeds**.
- **T15 · Unprogrammed 3-trophic-level Ecology-of-Fear cascade (`[E]`):** Zero lines of code connect alarm pheromones or `RS[15,11]` acoustic calls to plant growth. Yet enabling social alarm communication under predation cuts predations (`17.8 → 3.6` A / `17.7 → 5.1` B / `18.4 → 3.3` C) AND causes alarmed prey to shelter more, **increasing standing plant fruit biomass** (`0.780 → 0.936` A / `0.806 → 0.923` B / `0.795 → 0.949` C) on **36/36 seeds**—a textbook trait-mediated indirect interaction (TMII > DMII; Schmitz, Beckerman & O'Brien 1997 *Ecology* 78:1388; Brown, Laundré & Gurung 1999).

---

## 4. Regression & Browser Verification Gates (Final Pass 22 Code)

| gate | command (from `live/`) | measured on final Pass 22 code |
|---|---|---|
| Dome / HEPTARCH algebra + causal lesions | `node test/dome_heptarch_probe.mjs` | **6/6, `DOME_BIT_IDENTICAL=True` over two consecutive runs.** `KCBS 2.236068`, `CEGA-18 9.0`, `Hoggar 63/315`, `RS 1000/1000`, 60-s energy closure `0.00e+0`, `maxSeat 0.4400 ≤ 0.46`, `Xenomimic CHSH 2.109`, `Levin regen 0.867 vs 0.500`, `Cry4 night HD 0.0602 vs 0.6576 rad`, sanctuary ward `0 vs 1` predations |
| Navigation | `node test/nav_probe.mjs 1,2,3,4` | **NEAR 4/4 (mean 6.5 s), FAR 4/4 (mean 26.5 s), upright 0.94, 1% inverted**, 43% path-integration steered |
| Browser (headless Chrome, WebGL2) | `node test/dome_ui_check.mjs` | `consoleErrors: []`, `pageErrors: []`, `hasNaN: false`; HUD shows `ΔE 0.0e+0 · dΣ/dt 1.55e-3 kW/K · ΔM 0.0e+0`, `ENAQT 80.8% > Förster 80.5%`, `NMDA 641 · BAC 543`, `max π 0.360 ≤ 0.46` |
| Determinism audit | grep `Math.random` in `live/js/sim/` | **0 runtime calls** (`Skin(seed)` seeded via `mulberry32`; only an unused default fallback parameter on `quantizeNestorRung`) |

---

## 5. Reproduce Every Number

```bash
cd glitchling-jam/live
node test/nobel_rigor_suite.mjs                                         # Cohort A: seeds 1..12 (T1-T15, 26 contrasts)
SEEDS=13,14,15,16,17,18,19,20,21,22,23,24 node test/nobel_rigor_suite.mjs # Cohort B: seeds 13..24
FROM_T=12 SEEDS=25,26,27,28,29,30,31,32,33,34,35,36 node test/nobel_rigor_suite.mjs # Cohort C: locked T12-T15
node test/dome_heptarch_probe.mjs                                       # 6 Dome/HEPTARCH gates (bit-identical)
node test/nav_probe.mjs 1,2,3,4                                         # 3D navigation regression gate
node test/dome_ui_check.mjs                                             # Headless Chrome WebGL2 + HUD audit
```

Tested on Node v25.8.2 (Windows). All simulation RNGs are `mulberry32`-seeded.

---

## 6. Remaining Honest Scientific Boundaries

1. **Classical silicon vs physical quantum / wetware hardware:** All quantum solvers (`FMO` GKSL, `Cry4` Haberkorn,
   `4×4` CHSH, `16Q` WASM / `18Q` WebGPU, `32Q` MPS) execute in classical IEEE-754 arithmetic; no physical entanglement
   or spin chemistry occurs in the browser.
2. **Mesoscale biological abstraction:** FEM tissue, Murray's-law vessels, bistable $V_{\text{mem}}$ syncytia, and
   128-gene diploid population genetics are mesoscale mathematical models with hand-chosen physical constants, not
   molecular-scale reconstructions calibrated to wet-lab assays.
3. **Bounded genetic representation (no unbounded open-endedness):** `T11` and `T13` prove adaptive selection and
   divergent niche evolution over neutral drift within a fixed 128-locus genome; they do **not** claim unbounded
   major evolutionary transitions or open-ended novelty generation (cf. Taylor et al. 2016; Dolson et al. 2019).
4. **Effective Cry4 RF model:** `solveCry4Haberkorn8x8` models Ritz Larmor RF disruption via an effective rotating-wave
   Lorentzian spin-flip susceptibility (representing the long-lifetime sensitivity regime discussed by Hore & Mouritsen
   2016) rather than time-integrating a bare-lifetime Floquet Hamiltonian.
5. **Compute-ATP accounting (`T7b`):** The 17.6× NESTOR energy saving reflects the model's bit-width MAC ($b^2$) and
   Landauer accounting rather than measured wall-clock CPU/GPU joules.
6. **Zero consciousness / sentience claims:** Prequential NLL/ECE calibration and Schreiber Transfer Entropy are
   statistical properties of prediction residuals and time series, not subjective experience.

## References

Adolphs & Renger 2006 *Biophys J* 91:2778 · Rebentrost et al. 2009 *New J Phys* 11:033003 · Plenio & Huelga 2008
*New J Phys* 10:113019 · Wu, Liu, Shen, Cao & Silbey 2010 *New J Phys* 12:105012 · Duan et al. 2017 *PNAS* 114:8493 ·
Ritz, Adem & Schulten 2000 *Biophys J* 78:707 · Ritz et al. 2004 *Nature* 429:177 · Hore & Mouritsen 2016 *Annu Rev
Biophys* 45:299 · Haberkorn 1976 *Mol Phys* 32:1491 · Klyachko et al. 2008 *PRL* 101:020403 · Cabello et al. 1996
*Phys Lett A* 212:183 · Clauser, Horne, Shimony & Holt 1969 *PRL* 23:880 · Ungar 2008 *Analytic Hyperbolic Geometry* ·
Durant et al. 2017 *Biophys J* 112:2231 · Reed & Solomon 1960 *J SIAM* 8:300 · Press & Dyson 2012 *PNAS* 109:10409 ·
Bedau, Snyder & Packard 1998 *ALife VI* 228–237 · Dolson et al. 2019 *Artificial Life* 25:50 · Schmitz, Beckerman &
O'Brien 1997 *Ecology* 78:1388 · Lima & Dill 1990 *Can J Zool* 68:619 · Brown, Laundré & Gurung 1999 *J Mammal*
80:385 · Kuleshov, Fenner & Ermon 2018 *ICML* · Schreiber 2000 *PRL* 85:461 · Fisher 1935 *The Design of Experiments* ·
Pitman 1937 *JRSS Suppl* 4:119.
