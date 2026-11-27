module

/-
  GLITCHLING (v2.4.0) — Module 1: First-Law 11-Pool Energy Conservation,
  Closed N/C Mass Conservation, and Second-Law Clausius Entropy Production (`T1`).

  Zero Mathlib, zero `sorry`, zero `native_decide`, strict `autoImplicit = false`.
-/

public import GlitchlingProofs.Spec

namespace Glitchling

open Spec

-- =============================================================================
-- 1. 11-Pool Energy Ledger Conservation
-- =============================================================================

/-- Helper: adding `d` to a single coordinate `k` of `Fin 11 → Int` changes `sumFin11` by `+ d`. -/
public theorem sumFin11_add_at (f : Fin 11 → Int) (k : Fin 11) (d : Int) :
    sumFin11 (fun i => if i = k then f i + d else f i) = sumFin11 f + d := by
  unfold sumFin11
  rcases k with ⟨v, hv⟩
  match v, hv with
  | 0, _  => simp; omega
  | 1, _  => simp; omega
  | 2, _  => simp; omega
  | 3, _  => simp; omega
  | 4, _  => simp; omega
  | 5, _  => simp; omega
  | 6, _  => simp; omega
  | 7, _  => simp; omega
  | 8, _  => simp; omega
  | 9, _  => simp; omega
  | 10, _ => simp; omega

/-- Helper: subtracting `d` from a single coordinate `k` of `Fin 11 → Int` changes `sumFin11` by `- d`. -/
public theorem sumFin11_sub_at (f : Fin 11 → Int) (k : Fin 11) (d : Int) :
    sumFin11 (fun i => if i = k then f i - d else f i) = sumFin11 f - d := by
  have h := sumFin11_add_at f k (-d)
  have hfn : (fun i => if i = k then f i - d else f i) = (fun i => if i = k then f i + -d else f i) := by
    funext i; split <;> omega
  rw [hfn, h]; omega

/-- Theorem 1.1: Internal pool-to-pool transfer preserves total pool energy identically. -/
public theorem transferEnergy_preserves_sum (L : EnergyLedger) (src dst : Fin 11) (amt : Int) :
    sumFin11 (transferEnergy L src dst amt).pools = sumFin11 L.pools := by
  unfold transferEnergy
  split
  · rfl
  · rename_i hne
    have hrew :
        (fun i => if i = src then L.pools i - amt else if i = dst then L.pools i + amt else L.pools i) =
        (fun i => if i = src then (fun j => if j = dst then L.pools j + amt else L.pools j) i - amt
                  else (fun j => if j = dst then L.pools j + amt else L.pools j) i) := by
      funext i
      by_cases hs : i = src
      · subst hs
        simp [hne]
      · simp [hs]
    rw [hrew, sumFin11_sub_at, sumFin11_add_at]
    omega

/-- Theorem 1.2: Internal energy transfer preserves the First-Law boundary balance. -/
public theorem transferEnergy_preserves_firstLaw (L : EnergyLedger) (src dst : Fin 11) (amt : Int)
    (hbal : firstLawBalanced L) :
    firstLawBalanced (transferEnergy L src dst amt) := by
  have hsum := transferEnergy_preserves_sum L src dst amt
  unfold firstLawBalanced at *
  have hrad : (transferEnergy L src dst amt).radiatedOut = L.radiatedOut := by
    unfold transferEnergy; split <;> rfl
  have hinit : (transferEnergy L src dst amt).initialTotal = L.initialTotal := by
    unfold transferEnergy; split <;> rfl
  have hsol : (transferEnergy L src dst amt).solarIn = L.solarIn := by
    unfold transferEnergy; split <;> rfl
  have hgeo : (transferEnergy L src dst amt).geothermalIn = L.geothermalIn := by
    unfold transferEnergy; split <;> rfl
  rw [hsum, hrad, hinit, hsol, hgeo]
  exact hbal

/-- Theorem 1.3: Solar boundary influx preserves the First-Law boundary balance. -/
public theorem injectSolar_preserves_firstLaw (L : EnergyLedger) (dst : Fin 11) (amt : Int)
    (hbal : firstLawBalanced L) :
    firstLawBalanced (injectSolar L dst amt) := by
  unfold firstLawBalanced injectSolar at *
  simp only
  rw [sumFin11_add_at]
  omega

/-- Theorem 1.4: Hydrothermal mantle influx preserves the First-Law boundary balance. -/
public theorem injectGeothermal_preserves_firstLaw (L : EnergyLedger) (dst : Fin 11) (amt : Int)
    (hbal : firstLawBalanced L) :
    firstLawBalanced (injectGeothermal L dst amt) := by
  unfold firstLawBalanced injectGeothermal at *
  simp only
  rw [sumFin11_add_at]
  omega

/-- Theorem 1.5: Stefan-Boltzmann canopy radiative rejection preserves First-Law balance. -/
public theorem radiateHeat_preserves_firstLaw (L : EnergyLedger) (amt : Int)
    (hbal : firstLawBalanced L) :
    firstLawBalanced (radiateHeat L amt) := by
  unfold firstLawBalanced radiateHeat at *
  simp only
  rw [sumFin11_sub_at]
  omega

/-- Theorem 1.6 (Trace Induction): EVERY finite sequence of Dome energy operations preserves exact First-Law closure. -/
public theorem runEnergyOps_preserves_firstLaw (L : EnergyLedger) (ops : List EnergyOp)
    (hbal : firstLawBalanced L) :
    firstLawBalanced (runEnergyOps L ops) := by
  induction ops generalizing L with
  | nil => exact hbal
  | cons op rest ih =>
    apply ih
    cases op with
    | transfer s d a => exact transferEnergy_preserves_firstLaw L s d a hbal
    | solar d a      => exact injectSolar_preserves_firstLaw L d a hbal
    | geothermal d a => exact injectGeothermal_preserves_firstLaw L d a hbal
    | radiate a      => exact radiateHeat_preserves_firstLaw L a hbal

-- =============================================================================
-- 2. Closed-System Soil + Reservoir Mass Conservation (N & C)
-- =============================================================================

/-- Helper: adding `d` at valid index `idx < xs.length` changes `sumInt xs` by `+ d`. -/
public theorem sumInt_listAddAt (xs : List Int) (idx : Nat) (d : Int) (h : idx < xs.length) :
    sumInt (listAddAt xs idx d) = sumInt xs + d := by
  induction xs generalizing idx with
  | nil => simp at h
  | cons x rest ih =>
    cases idx with
    | zero =>
      simp [listAddAt, sumInt]; omega
    | succ k =>
      simp only [listAddAt, sumInt]
      have hk : k < rest.length := by simp at h; omega
      rw [ih k hk]
      omega

/-- Helper: `listAddAt` preserves list length. -/
public theorem length_listAddAt (xs : List Int) (idx : Nat) (d : Int) :
    (listAddAt xs idx d).length = xs.length := by
  induction xs generalizing idx with
  | nil => rfl
  | cons x rest ih =>
    cases idx with
    | zero => simp [listAddAt]
    | succ k => simp [listAddAt, ih]

/-- Helper: subtracting `d` from one of the 4 reservoirs changes `sumFin4` by `- d`. -/
public theorem sumFin4_sub_at (f : Fin 4 → Int) (r : Fin 4) (d : Int) :
    sumFin4 (fun j => if j = r then f j - d else f j) = sumFin4 f - d := by
  unfold sumFin4
  rcases r with ⟨v, hv⟩
  match v, hv with
  | 0, _ => simp; omega
  | 1, _ => simp; omega
  | 2, _ => simp; omega
  | 3, _ => simp; omega

/-- Theorem 1.7: Soil-to-reservoir N/C exchange preserves exact closed-system mass. -/
public theorem fluxSoil_preserves_mass (M : MassLedger) (idx : Nat) (r : Fin 4) (delta : Int)
    (hbal : massBalanced M) :
    massBalanced (fluxSoil M idx r delta) := by
  unfold massBalanced fluxSoil at *
  split
  · rename_i hlt
    simp only
    rw [sumInt_listAddAt M.soil idx delta hlt, sumFin4_sub_at]
    omega
  · exact hbal

/-- Theorem 1.8: Lateral mycelial soil-cell transfer preserves exact closed-system mass. -/
public theorem transferSoil_preserves_mass (M : MassLedger) (ia ib : Nat) (delta : Int)
    (hbal : massBalanced M) :
    massBalanced (transferSoil M ia ib delta) := by
  unfold massBalanced transferSoil at *
  split
  · rename_i hcond
    rcases hcond with ⟨ha, hb, _⟩
    simp only
    have hb' : ib < (listAddAt M.soil ia (-delta)).length := by
      rw [length_listAddAt]; exact hb
    rw [sumInt_listAddAt _ ib delta hb', sumInt_listAddAt M.soil ia (-delta) ha]
    omega
  · exact hbal

/-- Theorem 1.8b (Trace Induction): EVERY finite sequence of soil-reservoir fluxes and lateral
    mycelial transfers preserves exact N/C mass ledger balance. -/
public theorem runMassOps_preserves_mass (M : MassLedger) (ops : List MassOp)
    (hbal : massBalanced M) :
    massBalanced (runMassOps M ops) := by
  induction ops generalizing M with
  | nil => exact hbal
  | cons op rest ih =>
    apply ih
    cases op with
    | flux idx r d     => exact fluxSoil_preserves_mass M idx r d hbal
    | transfer ia ib d => exact transferSoil_preserves_mass M ia ib d hbal

-- =============================================================================
-- 3. Model Clausius Entropy Numerator Non-Negativity (Under Non-Negative Fluxes)
-- =============================================================================

/-- Theorem 1.9: Whenever BOTH temperature ordering (`0 < tSky <= tAmb <= tGeo`) AND
    non-negative fluxes (`qDiss, qGeo, qRad >= 0`) hold, the model's Clausius entropy numerator
    is non-negative (an algebraic sum of non-negative products, not a derivation of the Second Law). -/
public theorem clausius_entropy_nonneg (qDiss qGeo qRad tSky tAmb tGeo : Int)
    (hSky : 0 < tSky) (hAmb : tSky ≤ tAmb) (hGeo : tAmb ≤ tGeo)
    (hqD : 0 ≤ qDiss) (hqG : 0 ≤ qGeo) (hqR : 0 ≤ qRad) :
    0 ≤ clausiusEntropyNum qDiss qGeo qRad tSky tAmb tGeo := by
  unfold clausiusEntropyNum
  have htG : 0 ≤ tGeo := by omega
  have htS : 0 ≤ tSky := by omega
  have h1 : 0 ≤ qDiss * tGeo * tSky := Int.mul_nonneg (Int.mul_nonneg hqD htG) htS
  have h2 : 0 ≤ qGeo * (tGeo - tAmb) * tSky := Int.mul_nonneg (Int.mul_nonneg hqG (by omega)) htS
  have h3 : 0 ≤ qRad * (tAmb - tSky) * tGeo := Int.mul_nonneg (Int.mul_nonneg hqR (by omega)) htG
  omega

/-- Theorem 1.10: Strict irreversible dissipation (`qDiss > 0`) forces strictly positive entropy production. -/
public theorem clausius_entropy_strict_pos (qDiss qGeo qRad tSky tAmb tGeo : Int)
    (hSky : 0 < tSky) (hAmb : tSky ≤ tAmb) (hGeo : tAmb ≤ tGeo)
    (hqD : 0 < qDiss) (hqG : 0 ≤ qGeo) (hqR : 0 ≤ qRad) :
    0 < clausiusEntropyNum qDiss qGeo qRad tSky tAmb tGeo := by
  unfold clausiusEntropyNum
  have htG : 0 < tGeo := by omega
  have h1 : 0 < qDiss * tGeo * tSky := Int.mul_pos (Int.mul_pos hqD htG) hSky
  have h2 : 0 ≤ qGeo * (tGeo - tAmb) * tSky := Int.mul_nonneg (Int.mul_nonneg hqG (by omega)) (by omega)
  have h3 : 0 ≤ qRad * (tAmb - tSky) * tGeo := Int.mul_nonneg (Int.mul_nonneg hqR (by omega)) (by omega)
  omega

end Glitchling
