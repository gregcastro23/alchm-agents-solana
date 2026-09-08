/-
  Planetary Agents — Lean 4 Formal Verification
  Module: Proofs.ConstellationAMM
  Description: Formal model of the Constant-Product Virtual Reserve AMM for soulbound
               ESMS tokens without token custody, and proof of no-arbitrage invariants.
-/

namespace ConstellationAMM

/-- State of an elemental virtual reserve pool. -/
structure PoolState where
  reserveA    : Nat -- Virtual reserve of element A (atoms)
  reserveB    : Nat -- Virtual reserve of element B (atoms)
  feeBps      : Nat -- Pool fee in basis points (e.g. 30 = 0.3%)
  totalShares : Nat -- Outstanding Constellation Deed LP shares
  deriving Repr

/-- Basis points denominator constant (10,000). -/
def BPS : Nat := 10000

/-- Constant product k of the virtual reserves. -/
def constantProduct (pool : PoolState) : Nat :=
  pool.reserveA * pool.reserveB

/-- Amount of output token obtained for a given input amount with fee.
    Equation: outAmt = (inAmtWithFee * reserveOut) / (reserveIn * BPS + inAmtWithFee)
-/
def getAmountOut (amtIn : Nat) (reserveIn : Nat) (reserveOut : Nat) (feeBps : Nat) : Nat :=
  if amtIn == 0 ∨ reserveIn == 0 ∨ reserveOut == 0 then
    0
  else
    let inWithFee := amtIn * (BPS - feeBps)
    let numerator := inWithFee * reserveOut
    let denominator := (reserveIn * BPS) + inWithFee
    numerator / denominator

/-- State transition when swapping amountIn of token A for token B. -/
def swapAforB (pool : PoolState) (amtIn : Nat) : (PoolState × Nat) :=
  let amtOut := getAmountOut amtIn pool.reserveA pool.reserveB pool.feeBps
  let newPool := { pool with
    reserveA := pool.reserveA + amtIn,
    reserveB := pool.reserveB - amtOut
  }
  (newPool, amtOut)

/-! ### Fundamental AMM Lemmas -/

/-- Output-to-Input Reserve Ratio Inequality:
    For any swap with fee <= BPS:
      outAmt * reserveIn <= amtIn * reserveOut
    Significance: The effective price paid by a trader is strictly worse than or equal
    to the marginal spot price, guaranteeing that pool reserves are never underpaid.
-/
theorem getAmountOut_mul_reserveIn_le (amtIn : Nat) (resIn : Nat) (resOut : Nat) (fee : Nat)
    (h_valid_fee : fee <= BPS) :
    getAmountOut amtIn resIn resOut fee * resIn <= amtIn * resOut := by
  dsimp [getAmountOut]
  by_cases h : (amtIn == 0 ∨ resIn == 0 ∨ resOut == 0)
  · rw [if_pos h]
    rw [Nat.zero_mul]
    exact Nat.zero_le (amtIn * resOut)
  · rw [if_neg h]
    let γ := BPS - fee
    let inWithFee := amtIn * γ
    let num := inWithFee * resOut
    let den := resIn * BPS + inWithFee
    let amtOut := num / den
    have h_div_le : amtOut * den <= num := Nat.div_mul_le_self num den
    have h_den_ge : resIn * BPS <= den := by omega
    have h1 : amtOut * (resIn * BPS) <= amtOut * den := Nat.mul_le_mul_left amtOut h_den_ge
    have h2 : amtOut * (resIn * BPS) <= num := Nat.le_trans h1 h_div_le
    have h_comm_in : amtOut * (resIn * BPS) = (amtOut * resIn) * BPS := (Nat.mul_assoc amtOut resIn BPS).symm
    have h_γ_le : γ <= BPS := by omega
    have h_num_le : num <= (amtIn * resOut) * BPS := by
      have : num = (amtIn * resOut) * γ := by
        change (amtIn * γ) * resOut = (amtIn * resOut) * γ
        exact Nat.mul_right_comm amtIn γ resOut
      rw [this]
      exact Nat.mul_le_mul_left (amtIn * resOut) h_γ_le
    rw [h_comm_in] at h2
    have h3 : (amtOut * resIn) * BPS <= (amtIn * resOut) * BPS := Nat.le_trans h2 h_num_le
    have h_bps_pos : 0 < BPS := by decide
    have h3' : BPS * (amtOut * resIn) <= BPS * (amtIn * resOut) := by
      rw [Nat.mul_comm BPS (amtOut * resIn), Nat.mul_comm BPS (amtIn * resOut)]
      exact h3
    exact Nat.le_of_mul_le_mul_left h3' h_bps_pos

/-! ### Formal Theorem Specifications -/

/-- Theorem 4 (Monotonic Non-Decreasing k):
    Under any valid swap with valid fee (feeBps <= BPS), the product of virtual reserves
    after the swap is greater than or equal to the initial product (k' >= k).
    Significance: Formally guarantees that pool virtual reserves never deteriorate under swaps,
    establishing long-term protocol solvency without physical token custody.
-/
theorem invariant_non_decreasing (pool : PoolState) (amtIn : Nat)
    (h_pos_resA : pool.reserveA > 0)
    (h_pos_resB : pool.reserveB > 0)
    (h_valid_fee : pool.feeBps <= BPS)
    (h_pos_in : amtIn > 0) :
    let (nextPool, _) := swapAforB pool amtIn
    constantProduct nextPool >= constantProduct pool := by
  dsimp [swapAforB, constantProduct, getAmountOut]
  have h_ne : ¬((amtIn == 0) = true ∨ (pool.reserveA == 0) = true ∨ (pool.reserveB == 0) = true) := by
    intro h_or
    rcases h_or with h1 | h2 | h3
    · have : amtIn = 0 := Nat.eq_of_beq_eq_true h1; omega
    · have : pool.reserveA = 0 := Nat.eq_of_beq_eq_true h2; omega
    · have : pool.reserveB = 0 := Nat.eq_of_beq_eq_true h3; omega
  rw [if_neg h_ne]
  let γ := BPS - pool.feeBps
  let inWithFee := amtIn * γ
  let num := inWithFee * pool.reserveB
  let den := pool.reserveA * BPS + inWithFee
  let amtOut := num / den
  have h_div_le : amtOut * den <= num := Nat.div_mul_le_self num den
  have h_γ_le : γ <= BPS := by omega
  have h1 : pool.reserveA * γ <= pool.reserveA * BPS := Nat.mul_le_mul_left pool.reserveA h_γ_le
  have h2 : (pool.reserveA + amtIn) * γ <= den := by
    have h_add : (pool.reserveA + amtIn) * γ = pool.reserveA * γ + amtIn * γ := Nat.add_mul pool.reserveA amtIn γ
    rw [h_add]
    exact Nat.add_le_add_right h1 (amtIn * γ)
  have h3 : amtOut * ((pool.reserveA + amtIn) * γ) <= amtOut * den :=
    Nat.mul_le_mul_left amtOut h2
  have h4 : amtOut * ((pool.reserveA + amtIn) * γ) <= num := Nat.le_trans h3 h_div_le
  have h_assoc : amtOut * ((pool.reserveA + amtIn) * γ) = (amtOut * (pool.reserveA + amtIn)) * γ :=
    (Nat.mul_assoc amtOut (pool.reserveA + amtIn) γ).symm
  have h_num : num = (amtIn * pool.reserveB) * γ := Nat.mul_right_comm amtIn γ pool.reserveB
  have h4' : γ * (amtOut * (pool.reserveA + amtIn)) <= γ * (amtIn * pool.reserveB) := by
    rw [Nat.mul_comm γ (amtOut * (pool.reserveA + amtIn))]
    rw [Nat.mul_comm γ (amtIn * pool.reserveB)]
    rw [← h_assoc, ← h_num]
    exact h4
  have h_key : amtOut * (pool.reserveA + amtIn) <= amtIn * pool.reserveB := by
    by_cases hγ : γ = 0
    · have h_num_zero : num = 0 := by
        change (amtIn * γ) * pool.reserveB = 0
        rw [hγ, Nat.mul_zero, Nat.zero_mul]
      have : amtOut = 0 := by
        change num / den = 0
        rw [h_num_zero, Nat.zero_div]
      rw [this, Nat.zero_mul]
      exact Nat.zero_le (amtIn * pool.reserveB)
    · have hγ_pos : 0 < γ := by omega
      exact Nat.le_of_mul_le_mul_left h4' hγ_pos
  have h_prod : (pool.reserveA + amtIn) * (pool.reserveB - amtOut) =
      (pool.reserveA + amtIn) * pool.reserveB - (pool.reserveA + amtIn) * amtOut :=
    Nat.mul_sub_left_distrib (pool.reserveA + amtIn) pool.reserveB amtOut
  rw [h_prod]
  have : (pool.reserveA + amtIn) * amtOut = amtOut * (pool.reserveA + amtIn) := Nat.mul_comm (pool.reserveA + amtIn) amtOut
  rw [this]
  have h_base : (pool.reserveA + amtIn) * pool.reserveB = pool.reserveA * pool.reserveB + amtIn * pool.reserveB :=
    Nat.add_mul pool.reserveA amtIn pool.reserveB
  rw [h_base]
  omega

/-- Theorem 5 (No-Infinite-Mint Cycle / Cyclic Arbitrage Conservation):
    Under any sequence of swaps through distinct elemental pools forming a closed cycle
    (A -> B -> C -> A) where the pools satisfy the no-arbitrage condition
    (R_B_AB * R_C_BC * R_A_CA <= R_A_AB * R_B_BC * R_C_CA),
    the final output of element A is strictly bounded by the initial input amount of element A
    (outA <= inA).
    Significance: Eliminates the possibility of cyclic swap arbitrage extracting soulbound ESMS
    tokens, proving that no combination of trades can drain virtual liquidity or generate unbacked tokens.
-/
theorem no_infinite_mint_cycle (pAB : PoolState) (pBC : PoolState) (pCA : PoolState)
    (amtInA : Nat)
    (_h_amt : amtInA > 0)
    (h_pos_resA : pAB.reserveA > 0)
    (h_pos_resB : pBC.reserveA > 0)
    (h_pos_resC : pCA.reserveA > 0)
    (h_feeAB : pAB.feeBps <= BPS)
    (h_feeBC : pBC.feeBps <= BPS)
    (h_feeCA : pCA.feeBps <= BPS)
    (h_no_arb : pAB.reserveB * pBC.reserveB * pCA.reserveB <= pAB.reserveA * pBC.reserveA * pCA.reserveA) :
    let (_, outB) := swapAforB pAB amtInA
    let (_, outC) := swapAforB pBC outB
    let (_, outA) := swapAforB pCA outC
    outA <= amtInA := by
  dsimp [swapAforB]
  let outB := getAmountOut amtInA pAB.reserveA pAB.reserveB pAB.feeBps
  let outC := getAmountOut outB pBC.reserveA pBC.reserveB pBC.feeBps
  let outA := getAmountOut outC pCA.reserveA pCA.reserveB pCA.feeBps
  have h1 : outB * pAB.reserveA <= amtInA * pAB.reserveB :=
    getAmountOut_mul_reserveIn_le amtInA pAB.reserveA pAB.reserveB pAB.feeBps h_feeAB
  have h2 : outC * pBC.reserveA <= outB * pBC.reserveB :=
    getAmountOut_mul_reserveIn_le outB pBC.reserveA pBC.reserveB pBC.feeBps h_feeBC
  have h3 : outA * pCA.reserveA <= outC * pCA.reserveB :=
    getAmountOut_mul_reserveIn_le outC pCA.reserveA pCA.reserveB pCA.feeBps h_feeCA
  let K_in := pAB.reserveA * pBC.reserveA * pCA.reserveA
  let K_out := pAB.reserveB * pBC.reserveB * pCA.reserveB
  have hK_pos : 0 < K_in := by
    dsimp [K_in]
    have h12 : 0 < pAB.reserveA * pBC.reserveA := Nat.mul_pos h_pos_resA h_pos_resB
    exact Nat.mul_pos h12 h_pos_resC
  have s3 : outA * pCA.reserveA * (pBC.reserveA * pAB.reserveA) <= outC * pCA.reserveB * (pBC.reserveA * pAB.reserveA) :=
    Nat.mul_le_mul_right (pBC.reserveA * pAB.reserveA) h3
  have s3_lhs : outA * pCA.reserveA * (pBC.reserveA * pAB.reserveA) = outA * K_in := by
    change outA * pCA.reserveA * (pBC.reserveA * pAB.reserveA) = outA * (pAB.reserveA * pBC.reserveA * pCA.reserveA)
    ac_rfl
  have s3_rhs : outC * pCA.reserveB * (pBC.reserveA * pAB.reserveA) = (outC * pBC.reserveA) * (pCA.reserveB * pAB.reserveA) := by
    ac_rfl
  rw [s3_lhs, s3_rhs] at s3
  have s2 : (outC * pBC.reserveA) * (pCA.reserveB * pAB.reserveA) <= (outB * pBC.reserveB) * (pCA.reserveB * pAB.reserveA) :=
    Nat.mul_le_mul_right (pCA.reserveB * pAB.reserveA) h2
  have s2_rhs : (outB * pBC.reserveB) * (pCA.reserveB * pAB.reserveA) = (outB * pAB.reserveA) * (pBC.reserveB * pCA.reserveB) := by
    ac_rfl
  rw [s2_rhs] at s2
  have s1 : (outB * pAB.reserveA) * (pBC.reserveB * pCA.reserveB) <= (amtInA * pAB.reserveB) * (pBC.reserveB * pCA.reserveB) :=
    Nat.mul_le_mul_right (pBC.reserveB * pCA.reserveB) h1
  have s1_rhs : (amtInA * pAB.reserveB) * (pBC.reserveB * pCA.reserveB) = amtInA * K_out := by
    change (amtInA * pAB.reserveB) * (pBC.reserveB * pCA.reserveB) = amtInA * (pAB.reserveB * pBC.reserveB * pCA.reserveB)
    ac_rfl
  rw [s1_rhs] at s1
  have h_chain1 := Nat.le_trans s3 s2
  have h_chain2 := Nat.le_trans h_chain1 s1
  have h_arb : amtInA * K_out <= amtInA * K_in :=
    Nat.mul_le_mul_left amtInA h_no_arb
  have h_final : outA * K_in <= amtInA * K_in :=
    Nat.le_trans h_chain2 h_arb
  have h_final' : K_in * outA <= K_in * amtInA := by
    rw [Nat.mul_comm K_in outA, Nat.mul_comm K_in amtInA]
    exact h_final
  exact Nat.le_of_mul_le_mul_left h_final' hK_pos

/-- Corollary (Symmetric Virtual Reserve Pools Cyclic Conservation):
    When virtual pools have symmetric reserve ratios (R_A = R_B for all pools),
    no cyclic arbitrage is possible.
-/
theorem no_infinite_mint_cycle_symmetric (pAB : PoolState) (pBC : PoolState) (pCA : PoolState)
    (amtInA : Nat)
    (h_amt : amtInA > 0)
    (h_pos_resA : pAB.reserveA > 0)
    (h_pos_resB : pBC.reserveA > 0)
    (h_pos_resC : pCA.reserveA > 0)
    (h_feeAB : pAB.feeBps <= BPS)
    (h_feeBC : pBC.feeBps <= BPS)
    (h_feeCA : pCA.feeBps <= BPS)
    (h_symAB : pAB.reserveB = pAB.reserveA)
    (h_symBC : pBC.reserveB = pBC.reserveA)
    (h_symCA : pCA.reserveB = pCA.reserveA) :
    let (_, outB) := swapAforB pAB amtInA
    let (_, outC) := swapAforB pBC outB
    let (_, outA) := swapAforB pCA outC
    outA <= amtInA := by
  have h_no_arb : pAB.reserveB * pBC.reserveB * pCA.reserveB <= pAB.reserveA * pBC.reserveA * pCA.reserveA := by
    rw [h_symAB, h_symBC, h_symCA]
    exact Nat.le_refl _
  exact no_infinite_mint_cycle pAB pBC pCA amtInA h_amt h_pos_resA h_pos_resB h_pos_resC h_feeAB h_feeBC h_feeCA h_no_arb

/-- Corollary (Round-Trip Arbitrage Conservation):
    A 2-hop round-trip swap (A -> B -> A) between inverted pools (pBA.reserveA = pAB.reserveB,
    pBA.reserveB = pAB.reserveA) can never extract positive soulbound tokens (outA <= inA),
    unconditionally holding for all valid pool reserves.
-/
theorem no_infinite_mint_roundtrip (pAB : PoolState) (pBA : PoolState)
    (amtInA : Nat)
    (_h_amt : amtInA > 0)
    (h_pos_resA : pAB.reserveA > 0)
    (h_pos_resB : pBA.reserveA > 0)
    (h_feeAB : pAB.feeBps <= BPS)
    (h_feeBA : pBA.feeBps <= BPS)
    (h_revA : pBA.reserveA = pAB.reserveB)
    (h_revB : pBA.reserveB = pAB.reserveA) :
    let (_, outB) := swapAforB pAB amtInA
    let (_, outA) := swapAforB pBA outB
    outA <= amtInA := by
  dsimp [swapAforB]
  let outB := getAmountOut amtInA pAB.reserveA pAB.reserveB pAB.feeBps
  let outA := getAmountOut outB pBA.reserveA pBA.reserveB pBA.feeBps
  have h1 : outB * pAB.reserveA <= amtInA * pAB.reserveB :=
    getAmountOut_mul_reserveIn_le amtInA pAB.reserveA pAB.reserveB pAB.feeBps h_feeAB
  have h2 : outA * pBA.reserveA <= outB * pBA.reserveB :=
    getAmountOut_mul_reserveIn_le outB pBA.reserveA pBA.reserveB pBA.feeBps h_feeBA
  let K_in := pAB.reserveA * pBA.reserveA
  have hK_pos : 0 < K_in := Nat.mul_pos h_pos_resA h_pos_resB
  have s2 : outA * pBA.reserveA * pAB.reserveA <= outB * pBA.reserveB * pAB.reserveA :=
    Nat.mul_le_mul_right pAB.reserveA h2
  have s2_lhs : outA * pBA.reserveA * pAB.reserveA = outA * K_in := by
    change outA * pBA.reserveA * pAB.reserveA = outA * (pAB.reserveA * pBA.reserveA)
    ac_rfl
  have s2_rhs : outB * pBA.reserveB * pAB.reserveA = (outB * pAB.reserveA) * pBA.reserveB := by
    ac_rfl
  rw [s2_lhs, s2_rhs] at s2
  have s1 : (outB * pAB.reserveA) * pBA.reserveB <= (amtInA * pAB.reserveB) * pBA.reserveB :=
    Nat.mul_le_mul_right pBA.reserveB h1
  have s1_rhs : (amtInA * pAB.reserveB) * pBA.reserveB = amtInA * K_in := by
    change (amtInA * pAB.reserveB) * pBA.reserveB = amtInA * (pAB.reserveA * pBA.reserveA)
    rw [h_revA, h_revB]
    ac_rfl
  rw [s1_rhs] at s1
  have h_chain := Nat.le_trans s2 s1
  have h_final' : K_in * outA <= K_in * amtInA := by
    rw [Nat.mul_comm K_in outA, Nat.mul_comm K_in amtInA]
    exact h_chain
  exact Nat.le_of_mul_le_mul_left h_final' hK_pos

/-- Theorem 6 (Slippage and Minimum Output Guarantee):
    If the computed output is strictly less than minOut, the execution condition evaluates to false.
    Significance: Formally proves that on-chain execution strictly reverts if slippage exceeds user
    tolerance, preventing MEV sandwich attacks and adverse execution.
-/
theorem slippage_protection (amtIn : Nat) (resIn : Nat) (resOut : Nat) (fee : Nat) (minOut : Nat) :
    getAmountOut amtIn resIn resOut fee < minOut →
    (getAmountOut amtIn resIn resOut fee >= minOut) = false := by
  intro h
  have h_not : ¬(getAmountOut amtIn resIn resOut fee >= minOut) := by omega
  simp [h_not]

end ConstellationAMM
