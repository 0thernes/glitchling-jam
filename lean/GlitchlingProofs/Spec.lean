/-
  GLITCHLING (v2.2.0) — Pure Statement-Only Specification Module (`GlitchlingProofs.Spec`).

  Contains ONLY definitions and data structures (ZERO proofs) so `Challenge.lean`
  can import `GlitchlingProofs.Spec` in full isolation from every proof module
  when audited via `lake comparator --config comparator.json --paranoid`.

  Every constant and structure here matches the literal JS/TS implementation in:
    - `live/js/sim/world.js` (11-pool energy ledger, closed N/C mass ledger, Clausius entropy)
    - `live/js/tsotchke/qgtl.js` (CEGA-18 18 rays & 9 contexts, C3 cubic trace, Poincaré Möbius addition)
    - `live/js/sim/ecosystem.js` (4×4 Bell-diagonal reduced density matrix, CHSH game, IPD sanctions)
    - `live/js/sim/heptarch.js` (GF(2^4) primitive 0x13, RS[15,11,d=5], HEPTARCH 7-seat caps, NESTOR SR)
    - `glitchling.ts` (16-site mirror involution `k -> 15 - k`, leaky memory decay)
-/

namespace Glitchling.Spec

-- =============================================================================
-- 1. Geodesic Biodome 11-Pool First-Law Energy Ledger, Mass Ledger & Clausius
-- =============================================================================

/-- Discrete exact-integer model of the 11-pool Dome energy ledger (`world.js:21-24`). -/
structure EnergyLedger where
  pools        : Fin 11 → Int
  initialTotal : Int
  solarIn      : Int
  geothermalIn : Int
  radiatedOut  : Int

/-- Exact sum of all 11 energy pools. -/
def sumFin11 (f : Fin 11 → Int) : Int :=
  f ⟨0, by omega⟩ + f ⟨1, by omega⟩ + f ⟨2, by omega⟩ + f ⟨3, by omega⟩ +
  f ⟨4, by omega⟩ + f ⟨5, by omega⟩ + f ⟨6, by omega⟩ + f ⟨7, by omega⟩ +
  f ⟨8, by omega⟩ + f ⟨9, by omega⟩ + f ⟨10, by omega⟩

/-- Exact First-Law boundary identity (`world.js:860-862`):
    sum(pools) + radiatedOut = initialTotal + solarIn + geothermalIn. -/
def firstLawBalanced (L : EnergyLedger) : Prop :=
  sumFin11 L.pools + L.radiatedOut = L.initialTotal + L.solarIn + L.geothermalIn

/-- Conservative internal energy transfer between pools `src` and `dst` (`world.js:812`). -/
def transferEnergy (L : EnergyLedger) (src dst : Fin 11) (amt : Int) : EnergyLedger :=
  if src = dst then L
  else
    { L with
      pools := fun i =>
        if i = src then L.pools i - amt
        else if i = dst then L.pools i + amt
        else L.pools i }

/-- External solar PAR/heat boundary influx (`world.js:825`). -/
def injectSolar (L : EnergyLedger) (dst : Fin 11) (amt : Int) : EnergyLedger :=
  { L with
    pools := fun i => if i = dst then L.pools i + amt else L.pools i
    solarIn := L.solarIn + amt }

/-- External hydrothermal mantle boundary influx (`world.js:825`). -/
def injectGeothermal (L : EnergyLedger) (dst : Fin 11) (amt : Int) : EnergyLedger :=
  { L with
    pools := fun i => if i = dst then L.pools i + amt else L.pools i
    geothermalIn := L.geothermalIn + amt }

/-- Stefan-Boltzmann radiative heat rejection from thermal pool 9 (`world.js:839`). -/
def radiateHeat (L : EnergyLedger) (amt : Int) : EnergyLedger :=
  { L with
    pools := fun i => if i = ⟨9, by omega⟩ then L.pools i - amt else L.pools i
    radiatedOut := L.radiatedOut + amt }

/-- Elementary energy ledger operations for arbitrary trace induction. -/
inductive EnergyOp where
  | transfer (src dst : Fin 11) (amt : Int)
  | solar (dst : Fin 11) (amt : Int)
  | geothermal (dst : Fin 11) (amt : Int)
  | radiate (amt : Int)

def applyEnergyOp (L : EnergyLedger) : EnergyOp → EnergyLedger
  | .transfer s d a => transferEnergy L s d a
  | .solar d a      => injectSolar L d a
  | .geothermal d a => injectGeothermal L d a
  | .radiate a      => radiateHeat L a

def runEnergyOps (L : EnergyLedger) : List EnergyOp → EnergyLedger
  | []      => L
  | o :: os => runEnergyOps (applyEnergyOp L o) os

/-- Exact integer numerator of Clausius entropy production rate:
    (T_amb * T_geo * T_sky) * (qDiss/T_amb + qGeo*(1/T_amb - 1/T_geo) + qRad*(1/T_sky - 1/T_amb)). -/
def clausiusEntropyNum (qDiss qGeo qRad tSky tAmb tGeo : Int) : Int :=
  qDiss * tGeo * tSky + qGeo * (tGeo - tAmb) * tSky + qRad * (tAmb - tSky) * tGeo

/-- Exact list sum over integers. -/
def sumInt : List Int → Int
  | []      => 0
  | x :: xs => x + sumInt xs

/-- Sum over 4 atmospheric/biomass/scrubber reservoirs (`world.js:775`). -/
def sumFin4 (f : Fin 4 → Int) : Int :=
  f ⟨0, by omega⟩ + f ⟨1, by omega⟩ + f ⟨2, by omega⟩ + f ⟨3, by omega⟩

/-- Closed-system N or C mass ledger across soil cells and 4 reservoirs. -/
structure MassLedger where
  soil         : List Int
  res          : Fin 4 → Int
  initialTotal : Int

def massBalanced (M : MassLedger) : Prop :=
  sumInt M.soil + sumFin4 M.res = M.initialTotal

/-- Update element `idx` of a list by adding `delta` (no-op if out of bounds). -/
def listAddAt : List Int → Nat → Int → List Int
  | [],      _,     _ => []
  | x :: xs, 0,     d => (x + d) :: xs
  | x :: xs, n + 1, d => x :: listAddAt xs n d

/-- Conservative exchange between soil cell `idx` and reservoir `r` (`world.js:693,721`). -/
def fluxSoil (M : MassLedger) (idx : Nat) (r : Fin 4) (delta : Int) : MassLedger :=
  if idx < M.soil.length then
    { M with
      soil := listAddAt M.soil idx delta
      res  := fun j => if j = r then M.res j - delta else M.res j }
  else M

/-- Conservative lateral mycelial transport from soil cell `ia` to `ib` (`world.js:748`). -/
def transferSoil (M : MassLedger) (ia ib : Nat) (delta : Int) : MassLedger :=
  if ia < M.soil.length ∧ ib < M.soil.length ∧ ia ≠ ib then
    { M with soil := listAddAt (listAddAt M.soil ia (-delta)) ib delta }
  else M

-- =============================================================================
-- 2. Quantum Contextuality: CEGA-18 Kochen-Specker, CHSH LHV & No-Signaling
-- =============================================================================

/-- Literal unnormalized integer ray coordinates of Cabello-Estebaranz-Garcia-Alcaine (1996)
    CEGA-18 in R^4, matching `live/js/tsotchke/qgtl.js:184-202`. -/
def cegaRay (i : Fin 18) : Int × Int × Int × Int :=
  match i.val with
  | 0  => ( 0,  0,  0,  1)
  | 1  => ( 0,  0,  1,  0)
  | 2  => ( 1,  1,  0,  0)
  | 3  => ( 1, -1,  0,  0)
  | 4  => ( 0,  1,  0,  0)
  | 5  => ( 1,  0,  1,  0)
  | 6  => ( 1,  0, -1,  0)
  | 7  => ( 1, -1,  1, -1)
  | 8  => ( 1, -1, -1,  1)
  | 9  => ( 0,  0,  1,  1)
  | 10 => ( 1,  1,  1,  1)
  | 11 => ( 0,  1,  0, -1)
  | 12 => ( 1,  0,  0,  1)
  | 13 => ( 1,  0,  0, -1)
  | 14 => ( 0,  1, -1,  0)
  | 15 => ( 1,  1, -1,  1)
  | 16 => ( 1,  1,  1, -1)
  | _  => (-1,  1,  1,  1)

/-- Literal 9 four-ray orthonormal contexts of CEGA-18 (`live/js/tsotchke/qgtl.js:208-218`). -/
def cegaContexts : List (List (Fin 18)) :=
  [ [⟨0, by omega⟩,  ⟨1, by omega⟩,  ⟨2, by omega⟩,  ⟨3, by omega⟩],
    [⟨0, by omega⟩,  ⟨4, by omega⟩,  ⟨5, by omega⟩,  ⟨6, by omega⟩],
    [⟨7, by omega⟩,  ⟨8, by omega⟩,  ⟨2, by omega⟩,  ⟨9, by omega⟩],
    [⟨7, by omega⟩,  ⟨10, by omega⟩, ⟨6, by omega⟩,  ⟨11, by omega⟩],
    [⟨1, by omega⟩,  ⟨4, by omega⟩,  ⟨12, by omega⟩, ⟨13, by omega⟩],
    [⟨8, by omega⟩,  ⟨10, by omega⟩, ⟨13, by omega⟩, ⟨14, by omega⟩],
    [⟨15, by omega⟩, ⟨16, by omega⟩, ⟨3, by omega⟩,  ⟨9, by omega⟩],
    [⟨15, by omega⟩, ⟨17, by omega⟩, ⟨5, by omega⟩,  ⟨11, by omega⟩],
    [⟨16, by omega⟩, ⟨17, by omega⟩, ⟨12, by omega⟩, ⟨14, by omega⟩] ]

/-- 4-vector inner product over Int. -/
def dot4 (u v : Int × Int × Int × Int) : Int :=
  u.1 * v.1 + u.2.1 * v.2.1 + u.2.2.1 * v.2.2.1 + u.2.2.2 * v.2.2.2

/-- Count of `true` assignments in a single context. -/
def ctxTrueCount (f : Fin 18 → Bool) (ctx : List (Fin 18)) : Nat :=
  ctx.foldr (fun r acc => (if f r then 1 else 0) + acc) 0

/-- A valid non-contextual KS {0,1}-coloring assigns exactly one `true` ray to every context. -/
def isCEGAKSColoring (f : Fin 18 → Bool) : Prop :=
  ∀ ctx ∈ cegaContexts, ctxTrueCount f ctx = 1

/-- CHSH deterministic local hidden-variable functional `a0*b0 + a0*b1 + a1*b0 - a1*b1`. -/
def chshExpr (a0 a1 b0 b1 : Int) : Int :=
  a0 * b0 + a0 * b1 + a1 * b0 - a1 * b1

/-- Scaled Bell-diagonal / Werner two-qubit 4×4 real symmetric state (`ecosystem.js:72-82`):
    diag = (a, b, b, a), anti-diag coherences (c, d, d, c), remaining entries 0. -/
structure BellDiagState where
  a : Int
  b : Int
  c : Int
  d : Int

/-- Scaled trace Tr(rho) = 2a + 2b. -/
def bellDiagTrace (s : BellDiagState) : Int := 2 * s.a + 2 * s.b

/-- Scaled Alice reduced diagonal entry rhoA_00 = rho_00 + rho_11 = a + b (`ecosystem.js:79`). -/
def bellDiagRhoA00 (s : BellDiagState) : Int := s.a + s.b

/-- Scaled Alice reduced off-diagonal entry rhoA_01 = rho_02 + rho_13 = 0 (`ecosystem.js:80`). -/
def bellDiagRhoA01 (_s : BellDiagState) : Int := 0

-- =============================================================================
-- 3. GF(2^4) Arithmetic, RS[15,11,d=5], HEPTARCH Anti-Monarchy & NESTOR SR
-- =============================================================================

/-- Addition in GF(2^4) is bitwise XOR on 4-bit integers. -/
def gf16Add (a b : Fin 16) : Fin 16 :=
  ⟨(a.val ^^^ b.val) % 16, Nat.mod_lt _ (by omega)⟩

/-- Carry-less multiplication modulo primitive polynomial x^4 + x + 1 (0x13, `heptarch.js:23`). -/
def gf16MulStep (a b acc : Nat) : Nat :=
  let acc' := if b % 2 = 1 then acc ^^^ a else acc
  let a2 := a * 2
  let a' := if a2 >= 16 then a2 ^^^ 19 else a2
  (a' * 16 + acc')

def gf16MulRaw (a b : Nat) : Nat :=
  let s0 := gf16MulStep a b 0
  let a1 := s0 / 16; let acc1 := s0 % 16
  let s1 := gf16MulStep a1 (b / 2) acc1
  let a2 := s1 / 16; let acc2 := s1 % 16
  let s2 := gf16MulStep a2 (b / 4) acc2
  let a3 := s2 / 16; let acc3 := s2 % 16
  let s3 := gf16MulStep a3 (b / 8) acc3
  s3 % 16

def gf16Mul (a b : Fin 16) : Fin 16 :=
  ⟨gf16MulRaw a.val b.val % 16, Nat.mod_lt _ (by omega)⟩

/-- Literal 7×7 HEPTARCH v0.2 mode cap matrix in percent (`heptarch.js:485-493`). -/
def heptarchModeCaps : List (List Nat) :=
  [ [22, 34, 42, 44, 20, 34, 20],  -- Stillwater
    [36, 38, 32, 30, 34, 38, 32],  -- Gambit
    [45, 24, 36, 44, 36, 22, 24],  -- Supernova
    [42, 36, 36, 42, 28, 36, 38],  -- ColdStrike
    [36, 34, 34, 30, 28, 44, 34],  -- Raid
    [45, 32, 42, 36, 22, 32, 24],  -- Zenkai
    [26, 38, 46, 26, 24, 38, 24] ] -- Crossroads

def listSumNat : List Nat → Nat
  | []      => 0
  | x :: xs => x + listSumNat xs

/-- Exact numerator of NESTOR stochastic-rounding expectation on grid cell [q, q + delta]
    with offset r in [0, delta]: P(q + delta) = r/delta, P(q) = (delta - r)/delta (`heptarch.js:453-455`). -/
def nestorSRExpectNum (q delta r : Int) : Int :=
  (delta - r) * q + r * (q + delta)

/-- Exact scaled variance numerator delta^2 * Var[Q] = r * (delta - r) * delta^2, or reduced r * (delta - r). -/
def nestorSRVarFactor (delta r : Int) : Int :=
  r * (delta - r)

-- =============================================================================
-- 4. Ungar Poincaré-Disk Möbius Addition & Glitchling Engineered Flaws
-- =============================================================================

/-- Scaled Poincaré Möbius addition denominator (scale S > 0, `qgtl.js:569`):
    D = S^4 + 2 S^2 (ux*vx + uy*vy) + (ux^2 + uy^2)(vx^2 + vy^2). -/
def mobiusDen (ux uy vx vy S : Int) : Int :=
  S * S * S * S + 2 * S * S * (ux * vx + uy * vy) + (ux * ux + uy * uy) * (vx * vx + vy * vy)

/-- Scaled numerator x-coordinate of u (+) v (`qgtl.js:572`). -/
def mobiusNumX (ux uy vx vy S : Int) : Int :=
  (S * S + 2 * (ux * vx + uy * vy) + (vx * vx + vy * vy)) * ux * S +
  (S * S - (ux * ux + uy * uy)) * vx * S

/-- Scaled numerator y-coordinate of u (+) v (`qgtl.js:573`). -/
def mobiusNumY (ux uy vx vy S : Int) : Int :=
  (S * S + 2 * (ux * vx + uy * vy) + (vx * vx + vy * vy)) * uy * S +
  (S * S - (ux * ux + uy * uy)) * vy * S

/-- Glitchling `backwards` flaw site-mirror map `k -> 15 - k` (`glitchling.ts:23`). -/
def mirrorSite (k : Nat) : Nat := 15 - k

/-- Glitchling `leaky` flaw update numerator (scale S > 0, leak rate lam in (0, S), `glitchling.ts:29`):
    S * v' = (S - lam) * v + lam * p. -/
def leakyNextNum (v p lam S : Int) : Int :=
  (S - lam) * v + lam * p

end Glitchling.Spec
