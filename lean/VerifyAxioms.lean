/-
  GLITCHLING (v2.2.0) — Standalone Kernel Axiom Audit (`Lean 4.35.0`).
  Audits ALL exported theorems in `GlitchlingProofs` and `Solution` via `#print axioms`.
  Every theorem must depend strictly on a subset of `[propext, Classical.choice, Quot.sound]`
  (or no axioms at all) with zero `sorryAx`, zero `native_decide`, and zero custom axioms.
-/

import GlitchlingProofs
import Solution

-- Module 1: First-Law 11-Pool Energy Conservation, Closed N/C Mass Ledger & Clausius (14 theorems)
#print axioms Glitchling.sumFin11_add_at
#print axioms Glitchling.sumFin11_sub_at
#print axioms Glitchling.transferEnergy_preserves_sum
#print axioms Glitchling.transferEnergy_preserves_firstLaw
#print axioms Glitchling.injectSolar_preserves_firstLaw
#print axioms Glitchling.injectGeothermal_preserves_firstLaw
#print axioms Glitchling.radiateHeat_preserves_firstLaw
#print axioms Glitchling.runEnergyOps_preserves_firstLaw
#print axioms Glitchling.sumInt_listAddAt
#print axioms Glitchling.length_listAddAt
#print axioms Glitchling.sumFin4_sub_at
#print axioms Glitchling.fluxSoil_preserves_mass
#print axioms Glitchling.transferSoil_preserves_mass
#print axioms Glitchling.clausius_entropy_nonneg
#print axioms Glitchling.clausius_entropy_strict_pos

-- Module 2: CEGA-18 Kochen-Specker Uncolorability, CHSH LHV & No-Signaling (11 theorems)
#print axioms Glitchling.cega18_rays_nonzero
#print axioms Glitchling.cega18_contexts_orthogonal
#print axioms Glitchling.cega18_every_ray_in_two_contexts
#print axioms Glitchling.cega18_double_counting
#print axioms Glitchling.cega18_valid_sum_eq_nine
#print axioms Glitchling.cega18_kochen_specker_uncolorable
#print axioms Glitchling.cega18_classical_max_eight
#print axioms Glitchling.cega18_classical_eight_achievable
#print axioms Glitchling.chsh_lhv_bound
#print axioms Glitchling.chsh_game_classical_max_three
#print axioms Glitchling.bell_diagonal_exact_no_signaling
#print axioms Glitchling.c3_cubic_trace_gap

-- Module 3: GF(2^4) Finite Field, RS[15,11], HEPTARCH Anti-Monarchy & NESTOR SR (15 theorems)
#print axioms Glitchling.gf16_add_self
#print axioms Glitchling.gf16_add_comm
#print axioms Glitchling.gf16_mul_comm
#print axioms Glitchling.gf16_mul_assoc
#print axioms Glitchling.gf16_left_distrib
#print axioms Glitchling.gf16_mul_one
#print axioms Glitchling.gf16_exists_inv
#print axioms Glitchling.gf16_alpha_primitive_order_15
#print axioms Glitchling.rs15_11_mds_radius
#print axioms Glitchling.heptarch_anti_monarchy
#print axioms Glitchling.heptarch_anti_duopoly
#print axioms Glitchling.heptarch_all_modes_feasible
#print axioms Glitchling.nestor_sr_unbiased
#print axioms Glitchling.nestor_sr_variance_bound
#print axioms Glitchling.ipd_sanctioned_cooperation_dominates

-- Module 4: Ungar K = -1 Poincaré-Disk Möbius Containment & Glitchling Flaws (9 theorems)
#print axioms Glitchling.poincare_mobius_den_sum_of_squares
#print axioms Glitchling.cauchy_schwarz_dot_lower
#print axioms Glitchling.poincare_mobius_den_pos
#print axioms Glitchling.poincare_mobius_norm_identity
#print axioms Glitchling.poincare_mobius_preserves_disk
#print axioms Glitchling.mirrorSite_properties
#print axioms Glitchling.leaky_contraction_identity
#print axioms Glitchling.leaky_preserves_prior
#print axioms Glitchling.leaky_strict_contraction_above

-- Module 5: Constructive Non-Vacuity Witnesses (`NonVacuity.lean`, 6 theorems)
#print axioms Glitchling.nv01_energy_mass_balanced_witness
#print axioms Glitchling.nv02_clausius_strict_pos_witness
#print axioms Glitchling.nv03_cega18_eight_of_nine_witness
#print axioms Glitchling.nv04_gf16_inverse_and_primitive_witness
#print axioms Glitchling.nv05_heptarch_valid_simplex_witness
#print axioms Glitchling.nv06_poincare_interior_witness

-- Module 6: Adversarial False-Variant Refutations (`AdversarialTests.lean`, 6 theorems)
#print axioms Glitchling.at01_refute_unlogged_energy_creation
#print axioms Glitchling.at02_refute_cega18_noncontextual_nine
#print axioms Glitchling.at03_refute_chsh_local_exceeds_two
#print axioms Glitchling.at04_refute_heptarch_monopoly_or_duopoly
#print axioms Glitchling.at05_refute_poincare_boundary_escape
#print axioms Glitchling.at06_refute_mirror_fixed_point

-- Isolated Comparator Targets (`Solution.lean` vs `Challenge.lean`, 9 targets)
#print axioms Glitchling.ComparatorTarget.target_thm1_energy_mass_clausius
#print axioms Glitchling.ComparatorTarget.target_thm2_cega18_kochen_specker
#print axioms Glitchling.ComparatorTarget.target_thm3_chsh_and_nosignaling
#print axioms Glitchling.ComparatorTarget.target_thm4_gf16_and_rs15_11
#print axioms Glitchling.ComparatorTarget.target_thm5_heptarch_anti_monarchy
#print axioms Glitchling.ComparatorTarget.target_thm6_nestor_stochastic_rounding
#print axioms Glitchling.ComparatorTarget.target_thm7_poincare_mobius_containment
#print axioms Glitchling.ComparatorTarget.target_thm8_flaws_and_nonvacuity
#print axioms Glitchling.ComparatorTarget.target_thm9_adversarial_and_nonvacuity
