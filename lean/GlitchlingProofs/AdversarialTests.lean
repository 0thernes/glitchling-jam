/-
  GLITCHLING (v2.3.0) — Adversarial False-Variant Refutations (`GlitchlingProofs.AdversarialTests`).

  Machine-checks that corrupted / strengthened-beyond-truth variants of the core claims
  are provably `False`, preventing spec drift and demonstrating boundary sharpness.
  Pure Lean 4.35.0, zero Mathlib, zero `sorry`, zero `native_decide`.
-/

import GlitchlingProofs.Spec
import GlitchlingProofs.EnergyMassConservation
import GlitchlingProofs.QuantumContextuality
import GlitchlingProofs.CodingAndGovernance
import GlitchlingProofs.HyperbolicAndFlaws

namespace Glitchling

open Glitchling.Spec

/-- AT01: Injecting 1 unit of energy into pool 0 without logging solar/geothermal influx breaks First-Law balance. -/
theorem at01_refute_unlogged_energy_creation (L : EnergyLedger) (h : firstLawBalanced L) :
    ¬ firstLawBalanced
      { L with pools := fun i => if i = (0 : Fin 11) then L.pools i + 1 else L.pools i } := by
  intro hbad
  have hs := sumFin11_add_at L.pools (0 : Fin 11) 1
  unfold firstLawBalanced at h hbad
  dsimp at hbad
  rw [hs] at hbad
  omega

/-- AT02: No non-contextual {0,1}-coloring of CEGA-18 can satisfy all 9 contexts. -/
theorem at02_refute_cega18_noncontextual_nine :
    ¬ ∃ f : Fin 18 → Bool, isCEGAKSColoring f := by
  intro ⟨f, hf⟩
  exact cega18_kochen_specker_uncolorable f hf

/-- AT03: No deterministic +-1 local hidden-variable strategy can exceed the CHSH ceiling 2. -/
theorem at03_refute_chsh_local_exceeds_two :
    ¬ ∃ a0 a1 b0 b1 : Int,
      (a0 = 1 ∨ a0 = -1) ∧ (a1 = 1 ∨ a1 = -1) ∧ (b0 = 1 ∨ b0 = -1) ∧ (b1 = 1 ∨ b1 = -1) ∧
      chshExpr a0 a1 b0 b1 > 2 := by
  intro ⟨a0, a1, b0, b1, ha0, ha1, hb0, hb1, hgt⟩
  have hb := chsh_lhv_bound a0 a1 b0 b1 ha0 ha1 hb0 hb1
  omega

/-- AT04: No HEPTARCH 46%-capped simplex summing to 100 can have a >=50% monarch OR a 100% two-seat duopoly. -/
theorem at04_refute_heptarch_monopoly_or_duopoly :
    ¬ ∃ (w : Fin 7 → Nat),
      (w ⟨0, by omega⟩ + w ⟨1, by omega⟩ + w ⟨2, by omega⟩ + w ⟨3, by omega⟩ +
       w ⟨4, by omega⟩ + w ⟨5, by omega⟩ + w ⟨6, by omega⟩ = 100) ∧
      (∀ i : Fin 7, w i ≤ 46) ∧
      ((∃ i : Fin 7, w i ≥ 50) ∨ (∃ i j : Fin 7, w i + w j ≥ 100)) := by
  intro ⟨w, hsum, hcap, hbad⟩
  rcases hbad with ⟨i, hi⟩ | ⟨i, j, hij⟩
  · have hlt := heptarch_anti_monarchy w hsum hcap i
    omega
  · have hci := hcap i
    have hcj := hcap j
    omega

/-- AT05: No pair of points strictly inside the unit Poincare disk can escape or hit the boundary under Mobius addition. -/
theorem at05_refute_poincare_boundary_escape :
    ¬ ∃ ux uy vx vy S : Int,
      ux * ux + uy * uy < S * S ∧
      vx * vx + vy * vy < S * S ∧
      mobiusNumX ux uy vx vy S * mobiusNumX ux uy vx vy S +
      mobiusNumY ux uy vx vy S * mobiusNumY ux uy vx vy S ≥
      mobiusDen ux uy vx vy S * mobiusDen ux uy vx vy S := by
  intro ⟨ux, uy, vx, vy, S, hu, hv, hge⟩
  have hlt := poincare_mobius_preserves_disk ux uy vx vy S hu hv
  omega

/-- AT06: Glitchling `backwards` mirror map `k -> 15 - k` has zero fixed points on all 16 foraging sites. -/
theorem at06_refute_mirror_fixed_point :
    ¬ ∃ k : Nat, k < 16 ∧ mirrorSite k = k := by
  intro ⟨k, hk, heq⟩
  exact (mirrorSite_properties k hk).2.2 heq

end Glitchling
