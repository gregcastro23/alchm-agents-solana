/-
  Planetary Agents — Lean 4 Formal Verification
  Module: Proofs.Wavefunction
  Description: Formal model of the Continuous Chart Dignity Wavefunction \Psi_a(t)
               and proof of economic positivity and pricing lower bounds.
-/

-- The four foundational alchemical elements
inductive Element where
  | spirit    : Element
  | essence   : Element
  | matter    : Element
  | substance : Element
  deriving DecidableEq, Repr

-- Elemental potentials representing live sky transits (Float continuous model)
structure ElementalPotentials where
  spirit    : Float
  essence   : Float
  matter    : Float
  substance : Float
  deriving Repr

-- Elemental potentials in scaled integer fixed-point arithmetic (Int discrete model matching contracts)
-- Scaling factor: 10,000 = 1.0 (BPS precision)
structure ElementalPotentialsFixed where
  spirit    : Int
  essence   : Int
  matter    : Int
  substance : Int
  deriving Repr

namespace Wavefunction

def SCALE : Int := 10000

/-- Retrieve the potential value associated with a specific element (Float). -/
def getPotential (p : ElementalPotentials) (e : Element) : Float :=
  match e with
  | Element.spirit    => p.spirit
  | Element.essence   => p.essence
  | Element.matter    => p.matter
  | Element.substance => p.substance

/-- Retrieve the potential value associated with a specific element (Fixed-point Int). -/
def getPotentialFixed (p : ElementalPotentialsFixed) (e : Element) : Int :=
  match e with
  | Element.spirit    => p.spirit
  | Element.essence   => p.essence
  | Element.matter    => p.matter
  | Element.substance => p.substance

/-- Absolute value helper for Int. -/
def intAbs (x : Int) : Int :=
  if x < 0 then -x else x

/-- Total energy (L1-norm) of the elemental transit vector (Float). -/
def totalEnergy (p : ElementalPotentials) : Float :=
  (p.spirit).abs + (p.essence).abs + (p.matter).abs + (p.substance).abs

/-- Total energy (L1-norm) of the elemental transit vector (Fixed-point Int). -/
def totalEnergyFixed (p : ElementalPotentialsFixed) : Int :=
  intAbs p.spirit + intAbs p.essence + intAbs p.matter + intAbs p.substance

/-- Continuous Chart Dignity Wavefunction \Psi_a(t) normalized to [-2, 2] harmonic range (Float). -/
def dignityWave (p : ElementalPotentials) (e : Element) : Float :=
  let total := totalEnergy p
  if total == 0.0 then
    0.0
  else
    (getPotential p e) / (total / 2.0)

/-- Discrete Chart Dignity Wavefunction \Psi_a(t) in scaled basis points (Int).
    Psi_fixed = (val * 2 * SCALE) / total
    Returns value in [-2 * SCALE, 2 * SCALE] (i.e. [-20000, 20000] bps).
-/
def dignityWaveFixed (p : ElementalPotentialsFixed) (e : Element) : Int :=
  let total := totalEnergyFixed p
  if total == 0 then
    0
  else
    (getPotentialFixed p e * 2 * SCALE) / total

/-- Modulated per-axis chat pricing function (Float).
    Formula: Cost_a = Base_a * max(0.3, 1.0 - 0.35 * \Psi_a) * Multiplier
-/
def calculateCost (baseCost : Float) (psi : Float) (multiplier : Float) : Float :=
  let discountFactor := 1.0 - (0.35 * psi)
  let boundedFactor := if discountFactor < 0.3 then 0.3 else discountFactor
  baseCost * boundedFactor * multiplier

/-- Modulated per-axis chat pricing function in fixed-point arithmetic (Int).
    Formula: Cost_fixed = (Base * boundedFactor * Multiplier) / (SCALE * SCALE)
    boundedFactor = max(3000, 10000 - (3500 * psiFixed) / (10000))
-/
def calculateCostFixed (baseCost : Int) (psiFixed : Int) (multiplierFixed : Int) : Int :=
  let discountFactor := SCALE - ((3500 * psiFixed) / SCALE)
  let boundedFactor := if discountFactor < 3000 then 3000 else discountFactor
  (baseCost * boundedFactor * multiplierFixed) / (SCALE * SCALE)

/-- Absolute value bounds for Int: -|x| <= x <= |x| and |x| >= 0. -/
theorem intAbs_bounds (x : Int) : -intAbs x <= x ∧ x <= intAbs x ∧ intAbs x >= 0 := by
  unfold intAbs
  split <;> omega

/-- Individual elemental potential is bounded by total transit energy: -E <= v_e <= E. -/
theorem getPotential_bounds (p : ElementalPotentialsFixed) (e : Element) :
    -totalEnergyFixed p <= getPotentialFixed p e ∧ getPotentialFixed p e <= totalEnergyFixed p := by
  have _hs := intAbs_bounds p.spirit
  have _he := intAbs_bounds p.essence
  have _hm := intAbs_bounds p.matter
  have _hu := intAbs_bounds p.substance
  unfold totalEnergyFixed
  cases e <;> (dsimp [getPotentialFixed]; omega)

/-! ### Formal Theorem Specifications -/

/-- Theorem 1 (Bound Invariance - Fixed Point Basis Points):
    For any non-zero energy potentials in fixed point, the dignity wave is strictly bounded in [-20000, 20000].
    Significance: Formally guarantees that no celestial transit alignment can cause overflow or exceed [-2.0, 2.0].
-/
theorem dignityWaveFixed_bounded (p : ElementalPotentialsFixed) (e : Element)
    (h_pos : totalEnergyFixed p > 0) :
    dignityWaveFixed p e >= -2 * SCALE ∧ dignityWaveFixed p e <= 2 * SCALE := by
  have hE_ne : totalEnergyFixed p ≠ 0 := by omega
  have h_bounds := getPotential_bounds p e
  dsimp [dignityWaveFixed]
  have h_cond : (totalEnergyFixed p == 0) = false := by
    apply beq_false_of_ne
    exact hE_ne
  rw [h_cond]
  dsimp
  have h1 : getPotentialFixed p e * 2 * SCALE <= (2 * SCALE) * totalEnergyFixed p := by
    change getPotentialFixed p e * 2 * 10000 <= (2 * 10000) * totalEnergyFixed p
    omega
  have h_div_le : (getPotentialFixed p e * 2 * SCALE) / totalEnergyFixed p <= ((2 * SCALE) * totalEnergyFixed p) / totalEnergyFixed p :=
    Int.ediv_le_ediv h_pos h1
  rw [Int.mul_ediv_cancel (2 * SCALE) hE_ne] at h_div_le

  have h2 : (-2 * SCALE) * totalEnergyFixed p <= getPotentialFixed p e * 2 * SCALE := by
    change (-2 * 10000) * totalEnergyFixed p <= getPotentialFixed p e * 2 * 10000
    omega
  have h_div_ge : ((-2 * SCALE) * totalEnergyFixed p) / totalEnergyFixed p <= (getPotentialFixed p e * 2 * SCALE) / totalEnergyFixed p :=
    Int.ediv_le_ediv h_pos h2
  rw [Int.mul_ediv_cancel (-2 * SCALE) hE_ne] at h_div_ge

  exact ⟨h_div_ge, h_div_le⟩

/-- Theorem 2 (Economic Positivity & Lower Bound - Neutral/Markup):
    For any base cost >= 4 (the precision threshold ensuring 0.3x discount does not
    discretize to zero in 10,000 BPS scaling) and multiplier >= SCALE (1.0 in fixed-point),
    the calculated cost is bounded from below by (3000 * baseCost * mult) / (SCALE^2)
    and strictly greater than zero.
-/
theorem calculateCostFixed_positive (baseCost : Int) (psiFixed : Int) (multFixed : Int)
    (h_base : baseCost >= 4)
    (h_mult : multFixed >= SCALE)
    (_h_psi_lo : psiFixed >= -2 * SCALE)
    (_h_psi_hi : psiFixed <= 2 * SCALE) :
    calculateCostFixed baseCost psiFixed multFixed >= (3000 * baseCost * multFixed) / (SCALE * SCALE) ∧
    calculateCostFixed baseCost psiFixed multFixed > 0 := by

  dsimp [calculateCostFixed]
  generalize hB_def : (if SCALE - 3500 * psiFixed / SCALE < 3000 then 3000 else SCALE - 3500 * psiFixed / SCALE) = B
  have hB : 3000 <= B := by
    subst hB_def
    split <;> omega
  have h_base_nonneg : 0 <= baseCost := by omega
  have h_mult_nonneg : 0 <= multFixed := by
    have : SCALE = 10000 := rfl
    omega
  have h1 : baseCost * 3000 <= baseCost * B :=
    Int.mul_le_mul_of_nonneg_left hB h_base_nonneg
  have h2 : (baseCost * 3000) * multFixed <= (baseCost * B) * multFixed :=
    Int.mul_le_mul_of_nonneg_right h1 h_mult_nonneg
  rw [Int.mul_comm baseCost 3000] at h2
  have h_pos_denom : 0 < SCALE * SCALE := by decide
  have h_lower := Int.ediv_le_ediv h_pos_denom h2

  -- Show that 3000 * baseCost * multFixed >= SCALE * SCALE (100,000,000)
  have h_m : multFixed >= 10000 := by
    have : SCALE = 10000 := rfl
    omega
  have _h_mult_bound : 120000000 <= 3000 * baseCost * multFixed := by
    have h_bc : 12000 <= 3000 * baseCost := by omega
    have _h_step1 : 12000 * multFixed <= (3000 * baseCost) * multFixed :=
      Int.mul_le_mul_of_nonneg_right h_bc h_mult_nonneg
    omega
  have h_denom_val : SCALE * SCALE = 100000000 := by decide
  have h_num_ge_denom : SCALE * SCALE <= 3000 * baseCost * multFixed := by
    rw [h_denom_val]
    omega
  have h_div_ge_one : (SCALE * SCALE) / (SCALE * SCALE) <= (3000 * baseCost * multFixed) / (SCALE * SCALE) :=
    Int.ediv_le_ediv h_pos_denom h_num_ge_denom
  have h_one : (SCALE * SCALE) / (SCALE * SCALE) = 1 := by
    apply Int.ediv_self
    decide
  rw [h_one] at h_div_ge_one
  have h_pos_goal : baseCost * B * multFixed / (SCALE * SCALE) > 0 := by
    omega
  exact ⟨h_lower, h_pos_goal⟩

/-- Theorem 2b (Economic Positivity & Lower Bound - Resonance Discount Regime):
    In chat-pricing.ts, CHAT_RESONANCE_DISCOUNT = 0.5 (i.e. multFixed = 5000 bps).
    For any base cost >= 7 and multiplier >= 5000, 3000 * 7 * 5000 = 105,000,000 > SCALE^2,
    guaranteeing that resonance-discounted messages strictly produce positive fees (> 0).
-/
theorem calculateCostFixed_positive_resonance (baseCost : Int) (psiFixed : Int) (multFixed : Int)
    (h_base : baseCost >= 7)
    (h_mult : multFixed >= 5000)
    (_h_psi_lo : psiFixed >= -2 * SCALE)
    (_h_psi_hi : psiFixed <= 2 * SCALE) :
    calculateCostFixed baseCost psiFixed multFixed >= (3000 * baseCost * multFixed) / (SCALE * SCALE) ∧
    calculateCostFixed baseCost psiFixed multFixed > 0 := by
  dsimp [calculateCostFixed]
  generalize hB_def : (if SCALE - 3500 * psiFixed / SCALE < 3000 then 3000 else SCALE - 3500 * psiFixed / SCALE) = B
  have hB : 3000 <= B := by
    subst hB_def
    split <;> omega
  have h_base_nonneg : 0 <= baseCost := by omega
  have h_mult_nonneg : 0 <= multFixed := by omega
  have h1 : baseCost * 3000 <= baseCost * B :=
    Int.mul_le_mul_of_nonneg_left hB h_base_nonneg
  have h2 : (baseCost * 3000) * multFixed <= (baseCost * B) * multFixed :=
    Int.mul_le_mul_of_nonneg_right h1 h_mult_nonneg
  rw [Int.mul_comm baseCost 3000] at h2
  have h_pos_denom : 0 < SCALE * SCALE := by decide
  have h_lower := Int.ediv_le_ediv h_pos_denom h2

  have h_denom_val : SCALE * SCALE = 100000000 := by decide
  have h_bc : 21000 <= 3000 * baseCost := by omega
  have _h_step1 : 21000 * multFixed <= (3000 * baseCost) * multFixed :=
    Int.mul_le_mul_of_nonneg_right h_bc h_mult_nonneg
  have h_pos21 : 0 <= (21000 : Int) := by decide
  have _h_step2 : 21000 * 5000 <= 21000 * multFixed :=
    Int.mul_le_mul_of_nonneg_left h_mult h_pos21
  have h_num_ge_denom : SCALE * SCALE <= 3000 * baseCost * multFixed := by
    rw [h_denom_val]
    omega
  have h_div_ge_one : (SCALE * SCALE) / (SCALE * SCALE) <= (3000 * baseCost * multFixed) / (SCALE * SCALE) :=
    Int.ediv_le_ediv h_pos_denom h_num_ge_denom
  have h_one : (SCALE * SCALE) / (SCALE * SCALE) = 1 := by
    apply Int.ediv_self
    decide
  rw [h_one] at h_div_ge_one
  have h_pos_goal : baseCost * B * multFixed / (SCALE * SCALE) > 0 := by
    omega
  exact ⟨h_lower, h_pos_goal⟩

/-- Lower bound invariant for arbitrary positive base cost (baseCost > 0):
    Even when baseCost < 4, the calculated fee is bounded from below by
    the theoretical floor (3000 * baseCost * multFixed) / (SCALE * SCALE).
    Holds across all operating regimes, including resonance discount (multFixed >= 0).
-/
theorem calculateCostFixed_lower_bound (baseCost : Int) (psiFixed : Int) (multFixed : Int)
    (h_base : baseCost > 0)
    (h_mult : multFixed >= 0) :
    calculateCostFixed baseCost psiFixed multFixed >= (3000 * baseCost * multFixed) / (SCALE * SCALE) := by

  dsimp [calculateCostFixed]
  generalize hB_def : (if SCALE - 3500 * psiFixed / SCALE < 3000 then 3000 else SCALE - 3500 * psiFixed / SCALE) = B
  have hB : 3000 <= B := by
    subst hB_def
    split <;> omega
  have h_base_nonneg : 0 <= baseCost := by omega
  have h_mult_nonneg : 0 <= multFixed := by
    have : SCALE = 10000 := rfl
    omega
  have h1 : baseCost * 3000 <= baseCost * B :=
    Int.mul_le_mul_of_nonneg_left hB h_base_nonneg
  have h2 : (baseCost * 3000) * multFixed <= (baseCost * B) * multFixed :=
    Int.mul_le_mul_of_nonneg_right h1 h_mult_nonneg
  rw [Int.mul_comm baseCost 3000] at h2
  have h_pos_denom : 0 < SCALE * SCALE := by decide
  exact Int.ediv_le_ediv h_pos_denom h2

/-- Non-negativity protocol safety guarantee:
    Formally guarantees that no live astrological transit, resonance, or prompt length
    can ever manipulate the fixed-point fee into a negative value (preventing drain exploits).
-/
theorem calculateCostFixed_nonneg (baseCost : Int) (psiFixed : Int) (multFixed : Int)
    (h_base : baseCost >= 0)
    (h_mult : multFixed >= 0) :
    calculateCostFixed baseCost psiFixed multFixed >= 0 := by
  dsimp [calculateCostFixed]
  generalize hB_def : (if SCALE - 3500 * psiFixed / SCALE < 3000 then 3000 else SCALE - 3500 * psiFixed / SCALE) = B
  have hB : 0 <= B := by
    subst hB_def
    split <;> omega
  have h1 : 0 <= baseCost * B := Int.mul_nonneg h_base hB
  have h2 : 0 <= (baseCost * B) * multFixed := Int.mul_nonneg h1 h_mult
  have h_denom : 0 <= SCALE * SCALE := by decide
  exact Int.ediv_nonneg h2 h_denom

/-- Theorem 3 (Zero Energy Degeneracy):
    When the total transit energy is zero, the dignity wave collapses to 0.
-/
theorem zero_energy_degeneracy (p : ElementalPotentials) (e : Element)
    (h_zero : totalEnergy p == 0.0) :
    dignityWave p e = 0.0 := by
  dsimp [dignityWave]
  have h' : (totalEnergy p == 0.0) = true := h_zero
  rw [h']
  rfl

/-- Theorem 3b (Zero Energy Degeneracy - Fixed Point):
    When the total transit energy is zero, the discrete dignity wave collapses to 0.
-/
theorem zero_energy_degeneracy_fixed (p : ElementalPotentialsFixed) (e : Element)
    (h_zero : totalEnergyFixed p = 0) :
    dignityWaveFixed p e = 0 := by
  dsimp [dignityWaveFixed]
  rw [h_zero]
  rfl

end Wavefunction

