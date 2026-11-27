module

/-
  GLITCHLING (v2.4.0) — Sorry-Free Solution Module Matched Against `Challenge.lean`.

  Proves all 9 targets in `Glitchling.ComparatorTarget` with ZERO `sorry`, ZERO `native_decide`,
  ZERO custom axioms, and ZERO Mathlib dependencies, auditable across independent Lean kernels via:
      lake comparator --config comparator.json --paranoid
-/

public import GlitchlingProofs.Spec
public import GlitchlingProofs

namespace Glitchling.ComparatorTarget

open Glitchling.Spec

public theorem target_thm1_energy_mass_clausius :
    (∀ L ops, firstLawBalanced L → firstLawBalanced (runEnergyOps L ops)) ∧
    (∀ M idx r d, massBalanced M → massBalanced (fluxSoil M idx r d)) ∧
    (∀ M ia ib d, massBalanced M → massBalanced (transferSoil M ia ib d)) ∧
    (∀ qD qG qR tS tA tG, 0 < tS → tS ≤ tA → tA ≤ tG → 0 ≤ qD → 0 ≤ qG → 0 ≤ qR →
      0 ≤ clausiusEntropyNum qD qG qR tS tA tG) :=
  ⟨Glitchling.runEnergyOps_preserves_firstLaw,
   Glitchling.fluxSoil_preserves_mass,
   Glitchling.transferSoil_preserves_mass,
   Glitchling.clausius_entropy_nonneg⟩

public theorem target_thm2_cega18_kochen_specker :
    (∀ r : Fin 18, dot4 (cegaRay r) (cegaRay r) > 0) ∧
    (cegaContexts.all (fun ctx =>
      ctx.all (fun a => ctx.all (fun b => a == b || dot4 (cegaRay a) (cegaRay b) == 0))) = true) ∧
    (∀ f : Fin 18 → Bool, ¬ isCEGAKSColoring f) :=
  ⟨Glitchling.cega18_rays_nonzero,
   Glitchling.cega18_contexts_orthogonal,
   Glitchling.cega18_kochen_specker_uncolorable⟩

public theorem target_thm3_chsh_and_nosignaling :
    (∀ a0 a1 b0 b1 : Int,
      (a0 = 1 ∨ a0 = -1) → (a1 = 1 ∨ a1 = -1) → (b0 = 1 ∨ b0 = -1) → (b1 = 1 ∨ b1 = -1) →
      -2 ≤ chshExpr a0 a1 b0 b1 ∧ chshExpr a0 a1 b0 b1 ≤ 2) ∧
    (∀ s S, bellDiagTrace s = S → 2 * bellDiagRhoA00 s = S ∧ bellDiagRhoA01 s = 0) ∧
    (15360 - 14976 = 384 ∧ 384 * 40 = 15360) :=
  ⟨Glitchling.chsh_lhv_bound,
   Glitchling.bell_diagonal_exact_no_signaling,
   Glitchling.c3_cubic_trace_gap⟩

public theorem target_thm4_gf16_and_rs15_11 :
    (∀ a b : Fin 16, gf16Mul a b = gf16Mul b a) ∧
    (∀ a b c : Fin 16, gf16Mul (gf16Mul a b) c = gf16Mul a (gf16Mul b c)) ∧
    (∀ a b c : Fin 16, gf16Mul a (gf16Add b c) = gf16Add (gf16Mul a b) (gf16Mul a c)) ∧
    (∀ a : Fin 16, a.val ≠ 0 → ∃ b : Fin 16, gf16Mul a b = ⟨1, by omega⟩) ∧
    (15 - 11 + 1 = 5 ∧ (5 - 1) / 2 = 2) :=
  ⟨Glitchling.gf16_mul_comm,
   Glitchling.gf16_mul_assoc,
   Glitchling.gf16_left_distrib,
   Glitchling.gf16_exists_inv,
   ⟨by omega, by omega⟩⟩

public theorem target_thm5_heptarch_anti_monarchy :
    (∀ w : Fin 7 → Nat,
      w ⟨0, by omega⟩ + w ⟨1, by omega⟩ + w ⟨2, by omega⟩ + w ⟨3, by omega⟩ +
      w ⟨4, by omega⟩ + w ⟨5, by omega⟩ + w ⟨6, by omega⟩ = 100 →
      (∀ i : Fin 7, w i ≤ 46) →
      (∀ i : Fin 7, w i < 50) ∧
      (∀ i j : Fin 7, ∃ k : Fin 7, k ≠ i ∧ k ≠ j ∧ w k > 0)) ∧
    (heptarchModeCaps.all (fun row => row.length == 7 && row.all (fun c => c <= 46) && listSumNat row >= 100) = true) := by
  refine ⟨?_, Glitchling.heptarch_all_modes_feasible.2⟩
  intro w hsum hcap
  exact ⟨Glitchling.heptarch_anti_monarchy w hsum hcap, (Glitchling.heptarch_anti_duopoly w hsum hcap).2.2⟩

public theorem target_thm6_nestor_stochastic_rounding :
    (∀ q delta r : Int, nestorSRExpectNum q delta r = delta * (q + r)) ∧
    (∀ delta r : Int, 4 * nestorSRVarFactor delta r ≤ delta * delta) :=
  ⟨Glitchling.nestor_sr_unbiased,
   fun d r => (Glitchling.nestor_sr_variance_bound d r).2⟩

public theorem target_thm7_poincare_mobius_containment :
    (∀ ux uy vx vy S : Int,
      mobiusDen ux uy vx vy S * mobiusDen ux uy vx vy S -
        (mobiusNumX ux uy vx vy S * mobiusNumX ux uy vx vy S +
         mobiusNumY ux uy vx vy S * mobiusNumY ux uy vx vy S) =
      (S * S - (ux * ux + uy * uy)) * (S * S - (vx * vx + vy * vy)) *
        mobiusDen ux uy vx vy S) ∧
    (∀ ux uy vx vy S : Int,
      ux * ux + uy * uy < S * S → vx * vx + vy * vy < S * S →
      mobiusNumX ux uy vx vy S * mobiusNumX ux uy vx vy S +
      mobiusNumY ux uy vx vy S * mobiusNumY ux uy vx vy S <
      mobiusDen ux uy vx vy S * mobiusDen ux uy vx vy S) :=
  ⟨Glitchling.poincare_mobius_norm_identity,
   Glitchling.poincare_mobius_preserves_disk⟩

public theorem target_thm8_flaws_and_nonvacuity :
    (∀ k : Nat, k < 16 → mirrorSite k < 16 ∧ mirrorSite (mirrorSite k) = k ∧ mirrorSite k ≠ k) ∧
    (∀ v p lam S : Int, leakyNextNum v p lam S - S * p = (S - lam) * (v - p)) ∧
    (gf16Mul ⟨3, by omega⟩ ⟨5, by omega⟩ = ⟨15, by omega⟩ ∧
     clausiusEntropyNum 10 5 2 280 300 350 = 1064000 ∧
     mobiusDen 3 4 1 2 10 = 12325 ∧
     mirrorSite 0 = 15) :=
  ⟨Glitchling.mirrorSite_properties,
   Glitchling.leaky_contraction_identity,
   by decide⟩

public theorem target_thm9_adversarial_and_nonvacuity :
    (¬ ∃ f : Fin 18 → Bool, isCEGAKSColoring f) ∧
    (¬ ∃ a0 a1 b0 b1 : Int,
      (a0 = 1 ∨ a0 = -1) ∧ (a1 = 1 ∨ a1 = -1) ∧ (b0 = 1 ∨ b0 = -1) ∧ (b1 = 1 ∨ b1 = -1) ∧
      chshExpr a0 a1 b0 b1 > 2) ∧
    (¬ ∃ k : Nat, k < 16 ∧ mirrorSite k = k) ∧
    (∃ f : Fin 18 → Bool, (cegaContexts.filter (fun ctx => ctxTrueCount f ctx == 1)).length = 8 ∧
      ¬ isCEGAKSColoring f) ∧
    (gf16Mul ⟨2, by omega⟩ ⟨9, by omega⟩ = ⟨1, by omega⟩ ∧
     gf16Mul ⟨3, by omega⟩ ⟨14, by omega⟩ = ⟨1, by omega⟩) :=
  ⟨Glitchling.at02_refute_cega18_noncontextual_nine,
   Glitchling.at03_refute_chsh_local_exceeds_two,
   Glitchling.at06_refute_mirror_fixed_point,
   Glitchling.nv03_cega18_eight_of_nine_witness,
   ⟨Glitchling.nv04_gf16_inverse_and_primitive_witness.1,
    Glitchling.nv04_gf16_inverse_and_primitive_witness.2.1⟩⟩

end Glitchling.ComparatorTarget
