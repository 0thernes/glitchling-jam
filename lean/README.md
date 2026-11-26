# `lean/` — Pure Lean 4.35.0 Formal Verification Core (`GlitchlingProofs`)

Zero-Mathlib, zero-`sorry`, zero-`native_decide`, `autoImplicit = false` formal proofs of the exact discrete algebraic, combinatorial, coding-theoretic, geometric, and thermodynamic invariants underlying the Glitchling simulation and Geodesic Biodome (`v2.2.0`).

## Scope & Honest Verification Boundary

What this formal library **does** prove (kernel-checked in Lean `v4.35.0` strictly within `[propext, Classical.choice, Quot.sound]`):
1. **First-Law 11-Pool Energy Conservation, Closed N/C Mass Ledger & Clausius Entropy (`EnergyMassConservation.lean`)** — Inductive conservation over arbitrary finite sequences of internal pool transfers, solar/geothermal boundary influxes, and canopy radiation; soil-reservoir and lateral mass exchanges; and unconditional non-negativity of Clausius entropy production for $0 < T_{\text{sky}} \le T_{\text{amb}} \le T_{\text{geo}}$.
2. **Unconditional CEGA-18 Kochen–Specker Uncolorability, CHSH LHV Ceiling & Bell-Diagonal No-Signaling (`QuantumContextuality.lean`)** — Exact orthogonality of all 9 four-ray contexts matching `live/js/tsotchke/qgtl.js`, constructive double-counting parity impossibility ($\forall f : \text{Fin } 18 \to \text{Bool}, \neg\text{isCEGAKSColoring } f$), tight classical ceiling $8 < 9$ with witness achieving $8$, exact CHSH deterministic LHV bound $|S| \le 2$ and $75\%$ game ceiling, exact Bell-diagonal reduced-density no-signaling ($\operatorname{Tr}_B \rho_{AB} = \frac{1}{2}I_2$), and exact $C_3$ cubic trace split $15360 - 14976 = 384$.
3. **$\mathbb{F}_{16}$ Finite Field, `RS[15,11,d=5]` Radius, HEPTARCH Anti-Monarchy & NESTOR Stochastic Rounding (`CodingAndGovernance.lean`)** — Exhaustive kernel verification of commutativity, associativity, distributivity, multiplicative inverses, and primitive element order $15$ for $\mathbb{F}_2[x]/(x^4 + x + 1)$ (`0x13`), MDS distance $d=5$ / radius $t=2$, strict anti-monarchy ($<50\%$) and anti-duopoly ($\ge 3$ active seats) bounds across all 7 literal `MODE_CAPS` rows in `heptarch.js`, exact stochastic-rounding unbiasedness $\mathbb{E}[Q(x)] = x$ and Popoviciu variance ceiling $\operatorname{Var}[Q] \le \Delta^2/4$, and sanctioned IPD cooperation dominance.
4. **Ungar $K=-1$ Poincaré-Disk Möbius Containment & Engineered Flaw Invariants (`HyperbolicAndFlaws.lean`)** — Universal sum-of-squares denominator positivity and exact polynomial norm-gap identity $D^2 - (N_x^2 + N_y^2) = (S^2 - |u|^2)(S^2 - |v|^2)D$, proving $|u \oplus v| < 1$ unconditionally inside the open unit disk; fixed-point-free mirror involution $k \mapsto 15 - k$ on `0..15`; and strict geometric contraction of `leaky` memory decay toward its prior.

What this library **does NOT** prove:
- It does not prove IEEE-754 floating-point roundoff bounds of the JavaScript runtime, nor does it prove biological claims about living animals or empirical A-Life outcomes (which are verified statistically via `tools/results_stats.mjs` and `live/test/lesion_experiments.mjs`).

## Build & Audit Commands

```bash
cd lean
lake build
lake env lean VerifyAxioms.lean
```

Isolated statement-vs-proof verification (`Challenge.lean` imports ONLY `GlitchlingProofs.Spec` with zero proof modules):

```bash
lake comparator --config comparator.json --paranoid
```
