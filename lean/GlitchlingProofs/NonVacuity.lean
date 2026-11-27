module

/-
  GLITCHLING (v2.4.0) — Constructive Non-Vacuity Witnesses (`GlitchlingProofs.NonVacuity`).

  Proves that the hypotheses of all six theorem families are simultaneously satisfiable
  by concrete, non-trivial inhabitants, ruling out vacuous truth (`False -> P`).
  Pure Lean 4.35.0 Palomar module, zero Mathlib, zero `sorry`, zero `native_decide`.
-/

public import GlitchlingProofs.Spec
public import GlitchlingProofs.EnergyMassConservation
public import GlitchlingProofs.QuantumContextuality
public import GlitchlingProofs.CodingAndGovernance
public import GlitchlingProofs.HyperbolicAndFlaws

namespace Glitchling

open Glitchling.Spec

/-- NV01: Non-trivial balanced 11-pool energy ledger and 3-cell mass ledger survive multi-step traces. -/
public theorem nv01_energy_mass_balanced_witness :
    ∃ (L : EnergyLedger) (ops : List EnergyOp) (M : MassLedger),
      firstLawBalanced L ∧
      firstLawBalanced (runEnergyOps L ops) ∧
      massBalanced M ∧
      massBalanced (transferSoil (fluxSoil M 0 ⟨0, by omega⟩ 7) 0 1 3) := by
  let L0 : EnergyLedger :=
    { pools := fun _ => 100
      initialTotal := 1100
      solarIn := 0
      geothermalIn := 0
      radiatedOut := 0 }
  let ops : List EnergyOp :=
    [ .solar ⟨0, by omega⟩ 40,
      .geothermal ⟨9, by omega⟩ 15,
      .transfer ⟨0, by omega⟩ ⟨4, by omega⟩ 25,
      .radiate 12 ]
  let M0 : MassLedger :=
    { soil := [50, 30, 20]
      res := fun _ => 25
      initialTotal := 200 }
  have hL0 : firstLawBalanced L0 := by
    unfold firstLawBalanced sumFin11
    rfl
  have hM0 : massBalanced M0 := by
    unfold massBalanced sumInt sumFin4
    rfl
  exact ⟨L0, ops, M0, hL0, runEnergyOps_preserves_firstLaw L0 ops hL0, hM0,
    transferSoil_preserves_mass _ 0 1 3 (fluxSoil_preserves_mass M0 0 ⟨0, by omega⟩ 7 hM0)⟩

/-- NV02: Concrete Dome thermal state satisfies all Clausius hypotheses with strictly positive production. -/
public theorem nv02_clausius_strict_pos_witness :
    ∃ qD qG qR tS tA tG : Int,
      0 < tS ∧ tS ≤ tA ∧ tA ≤ tG ∧ 0 ≤ qD ∧ 0 ≤ qG ∧ 0 ≤ qR ∧
      clausiusEntropyNum qD qG qR tS tA tG = 1064000 ∧
      0 < clausiusEntropyNum qD qG qR tS tA tG := by
  refine ⟨10, 5, 2, 280, 300, 350, ?_⟩
  decide

/-- NV03: Concrete CEGA-18 classical {0,1}-assignment saturating 8 of 9 contexts (proving tightness of <= 8). -/
public theorem nv03_cega18_eight_of_nine_witness :
    ∃ f : Fin 18 → Bool,
      (cegaContexts.filter (fun ctx => ctxTrueCount f ctx == 1)).length = 8 ∧
      ¬ isCEGAKSColoring f := by
  let f : Fin 18 → Bool := fun i =>
    i.val == 0 || i.val == 7 || i.val == 12 || i.val == 14 || i.val == 15
  refine ⟨f, by decide, cega18_kochen_specker_uncolorable f⟩

/-- NV04: Explicit GF(2^4) multiplicative inverse pairs (`2 * 9 = 1`, `3 * 14 = 1`) and primitive generator. -/
public theorem nv04_gf16_inverse_and_primitive_witness :
    gf16Mul ⟨2, by omega⟩ ⟨9, by omega⟩ = ⟨1, by omega⟩ ∧
    gf16Mul ⟨3, by omega⟩ ⟨14, by omega⟩ = ⟨1, by omega⟩ ∧
    gf16Mul ⟨3, by omega⟩ ⟨5, by omega⟩ = ⟨15, by omega⟩ := by
  decide

/-- NV05: Explicit feasible HEPTARCH 7-seat simplex obeying sum = 100, every seat <= 46, and >= 3 active seats. -/
public theorem nv05_heptarch_valid_simplex_witness :
    ∃ w : Fin 7 → Nat,
      w ⟨0, by omega⟩ + w ⟨1, by omega⟩ + w ⟨2, by omega⟩ + w ⟨3, by omega⟩ +
      w ⟨4, by omega⟩ + w ⟨5, by omega⟩ + w ⟨6, by omega⟩ = 100 ∧
      (∀ i : Fin 7, w i ≤ 46) ∧
      (∀ i : Fin 7, w i > 0) := by
  let w : Fin 7 → Nat := fun i => if i.val < 6 then 15 else 10
  refine ⟨w, by decide, ?_, ?_⟩
  · intro i
    have hi := i.isLt
    dsimp [w]
    split <;> omega
  · intro i
    have hi := i.isLt
    dsimp [w]
    split <;> omega

/-- NV06: Concrete interior unit-disk witness confirming strict positivity of Mobius denominator & norm gap. -/
public theorem nv06_poincare_interior_witness :
    ∃ ux uy vx vy S : Int,
      ux * ux + uy * uy < S * S ∧
      vx * vx + vy * vy < S * S ∧
      mobiusDen ux uy vx vy S = 12325 ∧
      mobiusNumX ux uy vx vy S * mobiusNumX ux uy vx vy S +
      mobiusNumY ux uy vx vy S * mobiusNumY ux uy vx vy S <
      mobiusDen ux uy vx vy S * mobiusDen ux uy vx vy S := by
  refine ⟨3, 4, 1, 2, 10, ?_⟩
  decide

end Glitchling
