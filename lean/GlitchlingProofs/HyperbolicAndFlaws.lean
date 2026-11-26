/-
  GLITCHLING (v2.2.0) — Module 4: Ungar K = -1 Poincaré-Disk Möbius Addition
  Containment Theorem (`T6`), Glitchling `backwards` Mirror Involution, and
  Glitchling `leaky` Memory Geometric Contraction (`glitchling.ts`).

  Zero Mathlib, zero `sorry`, zero `native_decide`, strict `autoImplicit = false`.
-/

import GlitchlingProofs.Spec

namespace Glitchling

open Spec

-- =============================================================================
-- 1. Universal Ungar Poincaré-Disk Möbius Norm Containment Identity (`T6`)
-- =============================================================================

private theorem sq_nonneg (x : Int) : 0 ≤ x * x := by
  by_cases h : 0 ≤ x
  · exact Int.mul_nonneg h h
  · have hn : 0 ≤ -x := by omega
    have heq : x * x = (-x) * (-x) := by rw [Int.neg_mul, Int.mul_neg, Int.neg_neg]
    rw [heq]
    exact Int.mul_nonneg hn hn

/-- Theorem 4.1 (Exact Sum-of-Squares Identity for Poincaré Möbius Denominator):
    S^4 + 2 S^2 (ux*vx + uy*vy) + (ux^2 + uy^2)(vx^2 + vy^2)
      = (S^2 + ux*vx + uy*vy)^2 + (ux*vy - uy*vx)^2 >= 0. -/
theorem poincare_mobius_den_sum_of_squares (ux uy vx vy S : Int) :
    mobiusDen ux uy vx vy S =
      (S * S + ux * vx + uy * vy) * (S * S + ux * vx + uy * vy) +
      (ux * vy - uy * vx) * (ux * vy - uy * vx) := by
  unfold mobiusDen
  have hA : (S * S + ux * vx + uy * vy) * (S * S + ux * vx + uy * vy) =
      S * S * S * S + 2 * S * S * (ux * vx + uy * vy) +
      (ux * vx) * (ux * vx) + 2 * (ux * vx) * (uy * vy) + (uy * vy) * (uy * vy) := by
    simp only [Int.add_mul, Int.mul_add]
    have c1 : ux * vx * (S * S) = S * S * (ux * vx) := Int.mul_comm _ _
    have c2 : uy * vy * (S * S) = S * S * (uy * vy) := Int.mul_comm _ _
    have c3 : uy * vy * (ux * vx) = ux * vx * (uy * vy) := Int.mul_comm _ _
    have c4 : S * S * (S * S) = S * S * S * S := (Int.mul_assoc (S * S) S S).symm
    have c5 : 2 * S * S * (ux * vx) = S * S * (ux * vx) + S * S * (ux * vx) := by
      have : 2 * S * S = S * S + S * S := by rw [Int.mul_assoc]; omega
      rw [this, Int.add_mul]
    have c6 : 2 * S * S * (uy * vy) = S * S * (uy * vy) + S * S * (uy * vy) := by
      have : 2 * S * S = S * S + S * S := by rw [Int.mul_assoc]; omega
      rw [this, Int.add_mul]
    have c7 : 2 * (ux * vx) * (uy * vy) = ux * vx * (uy * vy) + ux * vx * (uy * vy) := by
      rw [Int.mul_assoc]; omega
    omega
  have hB : (ux * vy - uy * vx) * (ux * vy - uy * vx) =
      (ux * vy) * (ux * vy) - 2 * (ux * vx) * (uy * vy) + (uy * vx) * (uy * vx) := by
    simp only [Int.sub_mul, Int.mul_sub]
    have hxy : ux * vy * (uy * vx) = ux * vx * (uy * vy) := by
      calc ux * vy * (uy * vx) = ux * (vy * (uy * vx)) := Int.mul_assoc _ _ _
        _ = ux * (vx * (uy * vy)) := by
            congr 1
            calc vy * (uy * vx) = (vy * uy) * vx := (Int.mul_assoc _ _ _).symm
              _ = vx * (vy * uy) := Int.mul_comm _ _
              _ = vx * (uy * vy) := by rw [Int.mul_comm vy uy]
        _ = ux * vx * (uy * vy) := (Int.mul_assoc _ _ _).symm
    have hyx : uy * vx * (ux * vy) = ux * vx * (uy * vy) := by
      rw [Int.mul_comm (uy * vx) (ux * vy), hxy]
    have h2 : 2 * (ux * vx) * (uy * vy) = ux * vx * (uy * vy) + ux * vx * (uy * vy) := by
      rw [Int.mul_assoc]; omega
    omega
  have hC : (ux * ux + uy * uy) * (vx * vx + vy * vy) =
      (ux * vx) * (ux * vx) + (ux * vy) * (ux * vy) + (uy * vx) * (uy * vx) + (uy * vy) * (uy * vy) := by
    have sqMul : ∀ x y : Int, (x * x) * (y * y) = (x * y) * (x * y) := by
      intro x y
      calc (x * x) * (y * y) = x * (x * (y * y)) := Int.mul_assoc _ _ _
        _ = x * ((x * y) * y) := by rw [← Int.mul_assoc x y y]
        _ = x * (y * (x * y)) := by rw [Int.mul_comm (x * y) y]
        _ = (x * y) * (x * y) := (Int.mul_assoc _ _ _).symm
    simp only [Int.add_mul, Int.mul_add]
    rw [sqMul ux vx, sqMul ux vy, sqMul uy vx, sqMul uy vy]
    omega
  omega

/-- Helper: Cauchy-Schwarz `2*(ux*vx + uy*vy) >= -(ux^2 + uy^2 + vx^2 + vy^2)`. -/
theorem cauchy_schwarz_dot_lower (ux uy vx vy : Int) :
    -(ux * ux + uy * uy + vx * vx + vy * vy) ≤ 2 * (ux * vx + uy * vy) := by
  have hx : 0 ≤ (ux + vx) * (ux + vx) := sq_nonneg (ux + vx)
  have hy : 0 ≤ (uy + vy) * (uy + vy) := sq_nonneg (uy + vy)
  have ex : (ux + vx) * (ux + vx) = ux * ux + 2 * (ux * vx) + vx * vx := by
    simp only [Int.add_mul, Int.mul_add]
    have : vx * ux = ux * vx := Int.mul_comm _ _
    omega
  have ey : (uy + vy) * (uy + vy) = uy * uy + 2 * (uy * vy) + vy * vy := by
    simp only [Int.add_mul, Int.mul_add]
    have : vy * uy = uy * vy := Int.mul_comm _ _
    omega
  omega

/-- Theorem 4.2 (Strict Positivity of Möbius Denominator Inside Open Unit Disk):
    Whenever `ux^2 + uy^2 < S^2` and `vx^2 + vy^2 < S^2`, the denominator `mobiusDen > 0` strictly. -/
theorem poincare_mobius_den_pos (ux uy vx vy S : Int)
    (hu : ux * ux + uy * uy < S * S) (hv : vx * vx + vy * vy < S * S) :
    0 < mobiusDen ux uy vx vy S := by
  rw [poincare_mobius_den_sum_of_squares]
  have hcs := cauchy_schwarz_dot_lower ux uy vx vy
  have h1 : 0 < S * S + ux * vx + uy * vy := by omega
  have hsq1 : 0 < (S * S + ux * vx + uy * vy) * (S * S + ux * vx + uy * vy) := Int.mul_pos h1 h1
  have hsq2 : 0 ≤ (ux * vy - uy * vx) * (ux * vy - uy * vx) := sq_nonneg _
  omega

/-- Core 4-variable polynomial identity for Ungar's Möbius norm containment. -/
private theorem mobius_poly_core (s a b c : Int) :
    let D := s * s + 2 * s * c + a * b
    let p := s + 2 * c + b
    let q := s - a
    D * D - s * (p * p * a + 2 * p * q * c + q * q * b) = (s - a) * (s - b) * D := by
  intro D p q
  have hDiff : D - s * (a + 2 * c + b) = (s - a) * (s - b) := by
    dsimp only [D]
    have hsb : (s - a) * (s - b) = s * s - s * b - a * s + a * b := by
      simp only [Int.sub_mul, Int.mul_sub]; omega
    have hmul : s * (a + 2 * c + b) = s * a + 2 * s * c + s * b := by
      simp only [Int.mul_add]
      have : s * (2 * c) = 2 * s * c := by
        rw [← Int.mul_assoc, Int.mul_comm s 2, Int.mul_assoc]
      omega
    have has : a * s = s * a := Int.mul_comm a s
    omega
  have hPoly : p * p * a + 2 * p * q * c + q * q * b = D * (a + 2 * c + b) := by
    have h_pa : p * p * a = s * s * a + 4 * s * c * a + 2 * s * b * a + 4 * c * c * a + 4 * b * c * a + b * b * a := by
      have hp2 : p * p = s * s + 4 * s * c + 2 * s * b + 4 * c * c + 4 * b * c + b * b := by
        dsimp only [p]
        simp only [Int.add_mul, Int.mul_add]
        have h1 : 2 * c * s = 2 * s * c := by rw [Int.mul_assoc, Int.mul_comm c s, ← Int.mul_assoc]
        have h2 : s * (2 * c) = 2 * s * c := by rw [← Int.mul_assoc, Int.mul_comm s 2, Int.mul_assoc]
        have h3 : 4 * s * c = 2 * s * c + 2 * s * c := by
          have : (4 : Int) * s = 2 * s + 2 * s := by omega
          rw [this, Int.add_mul]
        have h4 : b * s = s * b := Int.mul_comm b s
        have h5 : 2 * s * b = s * b + s * b := by
          have : (2 : Int) * s = s + s := by omega
          rw [this, Int.add_mul]
        have h6 : 2 * c * (2 * c) = 4 * c * c := by
          calc 2 * c * (2 * c) = 2 * (c * (2 * c)) := Int.mul_assoc _ _ _
            _ = 2 * (2 * (c * c)) := by congr 1; rw [← Int.mul_assoc, Int.mul_comm c 2, Int.mul_assoc]
            _ = (2 * 2) * (c * c) := (Int.mul_assoc _ _ _).symm
            _ = 4 * c * c := (Int.mul_assoc 4 c c).symm
        have h7 : 2 * c * b = 2 * b * c := by rw [Int.mul_assoc, Int.mul_comm c b, ← Int.mul_assoc]
        have h8 : b * (2 * c) = 2 * b * c := by rw [← Int.mul_assoc, Int.mul_comm b 2, Int.mul_assoc]
        have h9 : 4 * b * c = 2 * b * c + 2 * b * c := by
          have : (4 : Int) * b = 2 * b + 2 * b := by omega
          rw [this, Int.add_mul]
        omega
      rw [hp2]
      simp only [Int.add_mul]
    have h_2pqc : 2 * p * q * c =
        2 * s * s * c + 4 * s * c * c + 2 * s * b * c -
        2 * s * c * a - 4 * c * c * a - 2 * b * c * a := by
      dsimp only [p, q]
      simp only [Int.add_mul, Int.mul_add, Int.sub_mul, Int.mul_sub]
      have r2 : 2 * (2 * c) * s * c = 4 * s * c * c := by
        calc 2 * (2 * c) * s * c = ((2 * 2) * c) * s * c := by rw [Int.mul_assoc 2 2 c]
          _ = (4 * c) * s * c := rfl
          _ = (4 * s) * c * c := by rw [Int.mul_assoc 4 c s, Int.mul_comm c s, ← Int.mul_assoc 4 s c]
      have r3 : 2 * b * s * c = 2 * s * b * c := by
        rw [Int.mul_assoc 2 b s, Int.mul_comm b s, ← Int.mul_assoc 2 s b]
      have r4 : 2 * s * a * c = 2 * s * c * a := by
        rw [Int.mul_assoc (2 * s) a c, Int.mul_comm a c, ← Int.mul_assoc (2 * s) c a]
      have r5 : 2 * (2 * c) * a * c = 4 * c * c * a := by
        calc 2 * (2 * c) * a * c = (4 * c) * a * c := by rw [← Int.mul_assoc 2 2 c]; rfl
          _ = (4 * c) * (a * c) := Int.mul_assoc _ _ _
          _ = (4 * c) * (c * a) := by rw [Int.mul_comm a c]
          _ = 4 * c * c * a := (Int.mul_assoc (4 * c) c a).symm
      have r6 : 2 * b * a * c = 2 * b * c * a := by
        rw [Int.mul_assoc (2 * b) a c, Int.mul_comm a c, ← Int.mul_assoc (2 * b) c a]
      omega
    have h_qb : q * q * b = s * s * b - 2 * s * b * a + a * a * b := by
      have hq2 : q * q = s * s - 2 * s * a + a * a := by
        dsimp only [q]
        simp only [Int.sub_mul, Int.mul_sub]
        have : a * s = s * a := Int.mul_comm a s
        have h2 : 2 * s * a = s * a + s * a := by
          have : (2 : Int) * s = s + s := by omega
          rw [this, Int.add_mul]
        omega
      rw [hq2]
      simp only [Int.add_mul, Int.sub_mul]
      have : 2 * s * a * b = 2 * s * b * a := by
        rw [Int.mul_assoc (2 * s) a b, Int.mul_comm a b, ← Int.mul_assoc (2 * s) b a]
      omega
    have h_rhs : D * (a + 2 * c + b) =
        s * s * a + 2 * s * s * c + s * s * b +
        2 * s * c * a + 4 * s * c * c + 2 * s * b * c +
        a * a * b + 2 * b * c * a + b * b * a := by
      dsimp only [D]
      simp only [Int.add_mul, Int.mul_add]
      have k1 : s * s * (2 * c) = 2 * s * s * c := by
        calc s * s * (2 * c) = 2 * c * (s * s) := Int.mul_comm _ _
          _ = 2 * (c * (s * s)) := Int.mul_assoc _ _ _
          _ = 2 * ((s * s) * c) := by rw [Int.mul_comm c (s * s)]
          _ = 2 * s * s * c := by rw [← Int.mul_assoc 2 (s * s) c, ← Int.mul_assoc 2 s s]
      have k2 : 2 * s * c * (2 * c) = 4 * s * c * c := by
        calc 2 * s * c * (2 * c) = (2 * s) * (c * (2 * c)) := Int.mul_assoc _ _ _
          _ = (2 * s) * (2 * (c * c)) := by congr 1; rw [← Int.mul_assoc, Int.mul_comm c 2, Int.mul_assoc]
          _ = ((2 * s) * 2) * (c * c) := (Int.mul_assoc _ _ _).symm
          _ = (4 * s) * (c * c) := by congr 1; omega
          _ = 4 * s * c * c := (Int.mul_assoc (4 * s) c c).symm
      have k3 : 2 * s * c * b = 2 * s * b * c := by
        rw [Int.mul_assoc (2 * s) c b, Int.mul_comm c b, ← Int.mul_assoc (2 * s) b c]
      have k4 : a * b * a = a * a * b := by
        rw [Int.mul_assoc, Int.mul_comm b a, ← Int.mul_assoc]
      have k5 : a * b * (2 * c) = 2 * b * c * a := by
        calc a * b * (2 * c) = 2 * c * (a * b) := Int.mul_comm _ _
          _ = 2 * (c * (b * a)) := by rw [Int.mul_assoc, Int.mul_comm a b]
          _ = 2 * (b * (c * a)) := by congr 1; rw [← Int.mul_assoc, Int.mul_comm c b, Int.mul_assoc]
          _ = 2 * b * c * a := by rw [← Int.mul_assoc 2 b (c * a), ← Int.mul_assoc (2 * b) c a]
      have k6 : a * b * b = b * b * a := by
        rw [Int.mul_assoc, Int.mul_comm a (b * b)]
      omega
    have h4m2 : 4 * s * c * a - 2 * s * c * a = 2 * s * c * a := by
      have : (4 : Int) * s = 2 * s + 2 * s := by omega
      rw [this, Int.add_mul, Int.add_mul]; omega
    have h4b2 : 4 * b * c * a - 2 * b * c * a = 2 * b * c * a := by
      have : (4 : Int) * b = 2 * b + 2 * b := by omega
      rw [this, Int.add_mul, Int.add_mul]; omega
    omega
  rw [hPoly]
  calc D * D - s * (D * (a + 2 * c + b))
      = D * D - D * (s * (a + 2 * c + b)) := by
          rw [← Int.mul_assoc s D, Int.mul_comm s D, Int.mul_assoc D s]
    _ = D * (D - s * (a + 2 * c + b)) := (Int.mul_sub D D (s * (a + 2 * c + b))).symm
    _ = D * ((s - a) * (s - b)) := by rw [hDiff]
    _ = (s - a) * (s - b) * D := Int.mul_comm D ((s - a) * (s - b))

/-- Theorem 4.3 (Exact Algebraic Norm-Gap Identity for Ungar's Möbius Addition):
    For ALL integers ux, uy, vx, vy, S (representing u = (ux,uy)/S, v = (vx,vy)/S):
      D^2 - (Nx^2 + Ny^2) = (S^2 - |u|^2) * (S^2 - |v|^2) * D.
    Dividing by `D^2 > 0` yields the exact hyperbolic containment law:
      1 - |u (+) v|^2 = (1 - |u|^2)(1 - |v|^2) / (1 + 2<u,v> + |u|^2|v|^2). -/
theorem poincare_mobius_norm_identity (ux uy vx vy S : Int) :
    mobiusDen ux uy vx vy S * mobiusDen ux uy vx vy S -
      (mobiusNumX ux uy vx vy S * mobiusNumX ux uy vx vy S +
       mobiusNumY ux uy vx vy S * mobiusNumY ux uy vx vy S) =
    (S * S - (ux * ux + uy * uy)) * (S * S - (vx * vx + vy * vy)) *
      mobiusDen ux uy vx vy S := by
  let s := S * S
  let a := ux * ux + uy * uy
  let b := vx * vx + vy * vy
  let c := ux * vx + uy * vy
  let D := s * s + 2 * s * c + a * b
  let p := s + 2 * c + b
  let q := s - a
  have hDen : mobiusDen ux uy vx vy S = D := by
    unfold mobiusDen
    dsimp only [D, s, a, b, c]
    have h1 : S * S * S * S = (S * S) * (S * S) := Int.mul_assoc (S * S) S S
    have h2 : 2 * S * S * (ux * vx + uy * vy) = 2 * (S * S) * (ux * vx + uy * vy) := by
      rw [Int.mul_assoc 2 S S]
    omega
  have hNumSq :
      mobiusNumX ux uy vx vy S * mobiusNumX ux uy vx vy S +
      mobiusNumY ux uy vx vy S * mobiusNumY ux uy vx vy S =
      s * (p * p * a + 2 * p * q * c + q * q * b) := by
    unfold mobiusNumX mobiusNumY
    change (p * ux * S + q * vx * S) * (p * ux * S + q * vx * S) +
           (p * uy * S + q * vy * S) * (p * uy * S + q * vy * S) =
           s * (p * p * a + 2 * p * q * c + q * q * b)
    have hnx : p * ux * S + q * vx * S = S * (p * ux + q * vx) := by
      rw [Int.mul_add, Int.mul_comm S (p * ux), Int.mul_comm S (q * vx)]
    have hny : p * uy * S + q * vy * S = S * (p * uy + q * vy) := by
      rw [Int.mul_add, Int.mul_comm S (p * uy), Int.mul_comm S (q * vy)]
    rw [hnx, hny]
    have hpull : ∀ X Y : Int, (S * X) * (S * X) + (S * Y) * (S * Y) = s * (X * X + Y * Y) := by
      intro X Y
      have hx : (S * X) * (S * X) = s * (X * X) := by
        calc (S * X) * (S * X) = S * (X * (S * X)) := Int.mul_assoc _ _ _
          _ = S * (S * (X * X)) := by congr 1; rw [← Int.mul_assoc, Int.mul_comm X S, Int.mul_assoc]
          _ = s * (X * X) := (Int.mul_assoc S S (X * X)).symm
      have hy : (S * Y) * (S * Y) = s * (Y * Y) := by
        calc (S * Y) * (S * Y) = S * (Y * (S * Y)) := Int.mul_assoc _ _ _
          _ = S * (S * (Y * Y)) := by congr 1; rw [← Int.mul_assoc, Int.mul_comm Y S, Int.mul_assoc]
          _ = s * (Y * Y) := (Int.mul_assoc S S (Y * Y)).symm
      rw [hx, hy, ← Int.mul_add]
    rw [hpull]
    congr 1
    have expand : ∀ x y : Int, (p * x + q * y) * (p * x + q * y) =
        p * p * (x * x) + 2 * p * q * (x * y) + q * q * (y * y) := by
      intro x y
      simp only [Int.add_mul, Int.mul_add]
      have t1 : p * x * (p * x) = p * p * (x * x) := by
        calc p * x * (p * x) = p * (x * (p * x)) := Int.mul_assoc _ _ _
          _ = p * (p * (x * x)) := by congr 1; rw [← Int.mul_assoc, Int.mul_comm x p, Int.mul_assoc]
          _ = p * p * (x * x) := (Int.mul_assoc _ _ _).symm
      have t2 : q * y * (q * y) = q * q * (y * y) := by
        calc q * y * (q * y) = q * (y * (q * y)) := Int.mul_assoc _ _ _
          _ = q * (q * (y * y)) := by congr 1; rw [← Int.mul_assoc, Int.mul_comm y q, Int.mul_assoc]
          _ = q * q * (y * y) := (Int.mul_assoc _ _ _).symm
      have t3 : p * x * (q * y) = p * q * (x * y) := by
        calc p * x * (q * y) = p * (x * (q * y)) := Int.mul_assoc _ _ _
          _ = p * (q * (x * y)) := by congr 1; rw [← Int.mul_assoc, Int.mul_comm x q, Int.mul_assoc]
          _ = p * q * (x * y) := (Int.mul_assoc _ _ _).symm
      have t4 : q * y * (p * x) = p * q * (x * y) := by
        rw [Int.mul_comm (q * y) (p * x), t3]
      have t5 : 2 * p * q * (x * y) = p * q * (x * y) + p * q * (x * y) := by
        rw [Int.mul_assoc 2 p q, Int.mul_assoc 2 (p * q) (x * y)]; omega
      omega
    rw [expand ux vx, expand uy vy]
    have ha : p * p * a = p * p * (ux * ux) + p * p * (uy * uy) := Int.mul_add _ _ _
    have hb : q * q * b = q * q * (vx * vx) + q * q * (vy * vy) := Int.mul_add _ _ _
    have hc : 2 * p * q * c = 2 * p * q * (ux * vx) + 2 * p * q * (uy * vy) := Int.mul_add _ _ _
    omega
  rw [hDen, hNumSq]
  exact mobius_poly_core s a b c

/-- Theorem 4.4 (Strict Open Unit-Disk Containment of Ungar's Möbius Addition):
    For ALL points u, v strictly inside the unit Poincaré disk (`|u|^2 < S^2`, `|v|^2 < S^2`),
    the Möbius sum u (+) v strictly remains inside the unit disk (`Nx^2 + Ny^2 < D^2`)! -/
theorem poincare_mobius_preserves_disk (ux uy vx vy S : Int)
    (hu : ux * ux + uy * uy < S * S) (hv : vx * vx + vy * vy < S * S) :
    mobiusNumX ux uy vx vy S * mobiusNumX ux uy vx vy S +
    mobiusNumY ux uy vx vy S * mobiusNumY ux uy vx vy S <
    mobiusDen ux uy vx vy S * mobiusDen ux uy vx vy S := by
  have hden : 0 < mobiusDen ux uy vx vy S := poincare_mobius_den_pos ux uy vx vy S hu hv
  have hid := poincare_mobius_norm_identity ux uy vx vy S
  have hgap : 0 < (S * S - (ux * ux + uy * uy)) * (S * S - (vx * vx + vy * vy)) * mobiusDen ux uy vx vy S :=
    Int.mul_pos (Int.mul_pos (by omega) (by omega)) hden
  omega

-- =============================================================================
-- 2. Glitchling Engineered Flaws (`glitchling.ts`): Backwards & Leaky Invariants
-- =============================================================================

/-- Theorem 4.5 (`backwards` Site Mirror Involution, `glitchling.ts:23`):
    `k ↦ 15 - k` maps `[0, 15]` into `[0, 15]`, is an exact involution, and has NO fixed point! -/
theorem mirrorSite_properties (k : Nat) (hk : k < 16) :
    mirrorSite k < 16 ∧ mirrorSite (mirrorSite k) = k ∧ mirrorSite k ≠ k := by
  unfold mirrorSite
  omega

/-- Theorem 4.6 (`leaky` Memory Geometric Contraction Toward Prior, `glitchling.ts:29`):
    Exact scaled identity `S * v' - S * p = (S - lam) * (v - p)` and strict contraction
    toward prior `p` whenever `0 < lam < S` and `v ≠ p`. -/
theorem leaky_contraction_identity (v p lam S : Int) :
    leakyNextNum v p lam S - S * p = (S - lam) * (v - p) := by
  unfold leakyNextNum
  have h1 : (S - lam) * (v - p) = (S - lam) * v - (S - lam) * p := Int.mul_sub (S - lam) v p
  have h2 : (S - lam) * p = S * p - lam * p := Int.sub_mul S lam p
  omega

theorem leaky_preserves_prior (p lam S : Int) :
    leakyNextNum p p lam S = S * p := by
  have h := leaky_contraction_identity p p lam S
  have hz : p - p = 0 := by omega
  rw [hz, Int.mul_zero] at h
  omega

theorem leaky_strict_contraction_above (v p lam S : Int)
    (hlam0 : 0 < lam) (hlamS : lam < S) (hgt : p < v) :
    S * p < leakyNextNum v p lam S ∧ leakyNextNum v p lam S < S * v := by
  have hid := leaky_contraction_identity v p lam S
  have hpos : 0 < (S - lam) * (v - p) := Int.mul_pos (by omega) (by omega)
  have hdiff : S * v - leakyNextNum v p lam S = lam * (v - p) := by
    have h1 : S * v - S * p = S * (v - p) := (Int.mul_sub S v p).symm
    have h2 : S * (v - p) - (S - lam) * (v - p) = lam * (v - p) := by
      have : (S - (S - lam)) * (v - p) = S * (v - p) - (S - lam) * (v - p) := Int.sub_mul S (S - lam) (v - p)
      have hss : S - (S - lam) = lam := by omega
      rw [hss] at this
      exact this.symm
    omega
  have hpos2 : 0 < lam * (v - p) := Int.mul_pos hlam0 (by omega)
  omega

end Glitchling
