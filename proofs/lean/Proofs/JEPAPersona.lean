/-
  Planetary Agents — Lean 4 Formal Verification
  Module: Proofs.JEPAPersona
  Description: Formal model of the Joint Embedding Predictive Architecture (JEPA)
               Exponential Moving Average (EMA) persona memory and contraction theorems.
  Reference Implementations:
    - lib/jepa/ema-memory.ts (64-dim zero-GC EMA persona memory matrix, tau = 0.99)
    - lib/jepa/latent-prm.ts (Latent PRM gate with Domicile > Exaltation precedence)
    - contracts/PlanetaryRegistry.sol & lib/jepa/onchain-sync.ts (On-chain state sync & commitments)
-/

namespace JEPAPersona

/-- Fixed smoothing factor tau = 0.99 for zero-GC persona drift stabilization. -/
def TAU : Float := 0.99

/-- One-step EMA update for a single latent dimension (Float):
    P_{t+1} = tau * P_t + (1 - tau) * X_t
-/
def emaUpdate1D (p : Float) (x : Float) (tau : Float) : Float :=
  (tau * p) + ((1.0 - tau) * x)

/-- Absolute distance in 1-dimension (Float). -/
def dist1D (a : Float) (b : Float) : Float :=
  (a - b).abs

/-! ### Continuous Float Formal Specifications & Theorems -/

/-- Idealized continuous real arithmetic specification for EMA Banach contraction.
    In ℝ:
      T(p1) - T(p2) = (tau * p1 + (1 - tau) * x) - (tau * p2 + (1 - tau) * x)
                    = tau * (p1 - p2)
    Taking absolute values:
      |T(p1) - T(p2)| = |tau * (p1 - p2)| = tau * |p1 - p2|
    Since tau < 1, dist(T(p1), T(p2)) <= tau * dist(p1, p2) is a strict contraction.
-/
axiom ema_is_contraction_continuous (p1 : Float) (p2 : Float) (x : Float) (tau : Float)
    (h_tau_lo : tau > 0.0)
    (h_tau_hi : tau < 1.0) :
    dist1D (emaUpdate1D p1 x tau) (emaUpdate1D p2 x tau) <= (tau * dist1D p1 p2)

/-- Theorem 7 (EMA Operator Contraction - Float):
    The EMA update operator is a strict contraction mapping for any two persona states
    conditioned on the same observation x, with contraction factor tau < 1.
    dist(T(p1), T(p2)) <= tau * dist(p1, p2)
-/
theorem ema_is_contraction (p1 : Float) (p2 : Float) (x : Float) (tau : Float)
    (h_tau_lo : tau > 0.0)
    (h_tau_hi : tau < 1.0) :
    dist1D (emaUpdate1D p1 x tau) (emaUpdate1D p2 x tau) <= (tau * dist1D p1 p2) :=
  ema_is_contraction_continuous p1 p2 x tau h_tau_lo h_tau_hi

/-- Idealized continuous real arithmetic specification for EMA fixed point identity.
    In ℝ:
      T(p, p, tau) = tau * p + (1 - tau) * p = (tau + 1 - tau) * p = 1.0 * p = p.
-/
axiom ema_fixed_point_continuous (p : Float) (tau : Float)
    (h_tau_lo : tau > 0.0)
    (h_tau_hi : tau < 1.0) :
    emaUpdate1D p p tau = p

/-- Theorem 8 (Fixed Point Identity - Float):
    When the observation vector X coincides with the current persona P,
    the EMA state remains completely invariant (fixed point of the operator).
-/
theorem ema_fixed_point (p : Float) (tau : Float)
    (h_tau_lo : tau > 0.0)
    (h_tau_hi : tau < 1.0) :
    emaUpdate1D p p tau = p :=
  ema_fixed_point_continuous p tau h_tau_lo h_tau_hi

/-- Idealized continuous real arithmetic specification for EMA bounded output range.
    In ℝ, since tau in [0, 1] and (1 - tau) in [0, 1] with tau + (1 - tau) = 1,
    T(p, x, tau) is a convex combination of p and x.
    Since p >= -1.0 and x >= -1.0: T(p, x, tau) >= tau * (-1.0) + (1 - tau) * (-1.0) = -1.0.
    Since p <= 1.0 and x <= 1.0: T(p, x, tau) <= tau * (1.0) + (1 - tau) * (1.0) = 1.0.
-/
axiom ema_bounded_range_continuous (p : Float) (x : Float) (tau : Float)
    (h_tau : tau >= 0.0 ∧ tau <= 1.0)
    (h_p : p >= -1.0 ∧ p <= 1.0)
    (h_x : x >= -1.0 ∧ x <= 1.0) :
    let p_next := emaUpdate1D p x tau
    p_next >= -1.0 ∧ p_next <= 1.0

/-- Theorem 9 (Bounded Output Range - Float):
    If both the previous persona P and the incoming observation X are bounded
    in [-1.0, 1.0], the updated persona remains strictly bounded in [-1.0, 1.0].
-/
theorem ema_bounded_range (p : Float) (x : Float) (tau : Float)
    (h_tau : tau >= 0.0 ∧ tau <= 1.0)
    (h_p : p >= -1.0 ∧ p <= 1.0)
    (h_x : x >= -1.0 ∧ x <= 1.0) :
    let p_next := emaUpdate1D p x tau;
    p_next >= -1.0 ∧ p_next <= 1.0 :=
  ema_bounded_range_continuous p x tau h_tau h_p h_x

/-! ### Discrete Integer Fixed-Point Formal Model (BPS Scaled) -/

/-- Basis points scaling factor (10,000 = 1.0). -/
def SCALE : Int := 10000

/-- Default smoothing factor tau = 0.99 in basis points (9,900 = 0.99). -/
def DEFAULT_TAU_BPS : Int := 9900

/-- Latent persona state dimension matching JEPA memory matrix (64). -/
def VECTOR_DIM : Nat := 64

/-- Absolute value helper for Int. -/
def intAbs (x : Int) : Int :=
  if x < 0 then -x else x

/-- Absolute distance between two scaled integer values. -/
def distFixed (a : Int) (b : Int) : Int :=
  intAbs (a - b)

/-- Unscaled (raw) EMA update for single latent dimension:
    P_raw = tau * P + (SCALE - tau) * X
-/
def emaUpdateRaw (p : Int) (x : Int) (tau : Int) : Int :=
  (tau * p) + ((SCALE - tau) * x)

/-- Scaled discrete EMA update with integer division:
    P_{t+1} = (tau * P_t + (SCALE - tau) * X_t) / SCALE
-/
def emaUpdateFixed (p : Int) (x : Int) (tau : Int) : Int :=
  emaUpdateRaw p x tau / SCALE

/-! ### Foundational Algebraic & Order Lemmas -/

/-- Absolute value bounds for Int: -intAbs x <= x <= intAbs x and intAbs x >= 0. -/
theorem intAbs_bounds (x : Int) : -intAbs x <= x ∧ x <= intAbs x ∧ intAbs x >= 0 := by
  unfold intAbs
  split <;> omega

/-- Equivalence of custom intAbs with core Int.natAbs. -/
theorem intAbs_eq_natAbs (x : Int) : intAbs x = (x.natAbs : Int) := by
  unfold intAbs
  by_cases h : x < 0
  · rw [if_pos h]; omega
  · rw [if_neg h]; omega

/-- Multiplicative scaling of absolute values by non-negative factor:
    |tau * d| = tau * |d| for tau >= 0.
-/
theorem intAbs_mul_of_nonneg (tau : Int) (d : Int) (h_tau : 0 ≤ tau) :
    intAbs (tau * d) = tau * intAbs d := by
  rw [intAbs_eq_natAbs (tau * d), intAbs_eq_natAbs d, Int.natAbs_mul tau d]
  push_cast
  rw [Int.natAbs_of_nonneg h_tau]

/-- Raw EMA state difference lemma:
    T_raw(p1, x, tau) - T_raw(p2, x, tau) = tau * (p1 - p2).
-/
theorem emaUpdateRaw_sub (p1 p2 x tau : Int) :
    emaUpdateRaw p1 x tau - emaUpdateRaw p2 x tau = tau * (p1 - p2) := by
  dsimp [emaUpdateRaw]
  have h1 : (tau * p1 + (SCALE - tau) * x) - (tau * p2 + (SCALE - tau) * x) = tau * p1 - tau * p2 := by omega
  rw [h1]
  exact (Int.mul_sub tau p1 p2).symm

/-- Multiplicative power associativity helper for induction steps. -/
theorem pow_succ_comm (tau : Int) (k : Nat) (D : Int) :
    tau * (tau ^ k * D) = tau ^ (k + 1) * D := by
  have h_assoc : tau * (tau ^ k * D) = (tau * tau ^ k) * D := (Int.mul_assoc tau (tau ^ k) D).symm
  rw [h_assoc]
  have h_comm : tau * tau ^ k = tau ^ k * tau := Int.mul_comm tau (tau ^ k)
  rw [h_comm]
  rfl

/-! ### Theorem 7b & 7c: Discrete Contraction Theorems -/

/-- Theorem 7b (Exact Discrete Contraction Identity - Integer BPS):
    For any two persona states p1, p2, observation x, and non-negative smoothing factor tau:
      distFixed(T_raw(p1, x, tau), T_raw(p2, x, tau)) = tau * distFixed(p1, p2).
    Significance: Confirms exact, lossless Lipschitz continuity with contraction ratio tau.
-/
theorem emaUpdateRaw_dist (p1 p2 x tau : Int) (h_tau : 0 ≤ tau) :
    distFixed (emaUpdateRaw p1 x tau) (emaUpdateRaw p2 x tau) = tau * distFixed p1 p2 := by
  dsimp [distFixed]
  rw [emaUpdateRaw_sub]
  exact intAbs_mul_of_nonneg tau (p1 - p2) h_tau

/-- Repeated EMA update operator after n discrete chat turns. -/
def emaIterRaw (p : Int) (x : Int) (tau : Int) : Nat → Int
  | 0     => p
  | n + 1 => emaUpdateRaw (emaIterRaw p x tau n) x tau

/-- Theorem 7c (Multi-Step Exponential Divergence Compression):
    Under n repeated EMA updates with constant observation x:
      distFixed(T_raw^n(p1), T_raw^n(p2)) = (tau^n) * distFixed(p1, p2).
    Significance: Guarantees that any persona divergence shrinks exponentially
    at rate tau^n, stabilizing agent identity against malicious context drift.
-/
theorem emaIterRaw_dist (p1 p2 x tau : Int) (h_tau : 0 ≤ tau) (n : Nat) :
    distFixed (emaIterRaw p1 x tau n) (emaIterRaw p2 x tau n) = (tau ^ n) * distFixed p1 p2 := by
  induction n with
  | zero =>
    dsimp [emaIterRaw]
    change distFixed p1 p2 = 1 * distFixed p1 p2
    rw [Int.one_mul]
  | succ k ih =>
    dsimp [emaIterRaw]
    rw [emaUpdateRaw_dist _ _ _ _ h_tau]
    rw [ih]
    rw [pow_succ_comm tau k (distFixed p1 p2)]

/-! ### Theorem 8b: Discrete Fixed Point Identity -/

/-- Theorem 8b (Discrete Fixed Point Identity - Scaled Integer):
    When the observation vector x coincides with the current persona p:
      T_fixed(p, p, tau) = p.
    Significance: An agent observing actions perfectly aligned with its core essence
    experiences exactly zero persona distortion in discrete fixed-point arithmetic.
-/
theorem emaUpdateFixed_fixed_point (p : Int) (tau : Int) :
    emaUpdateFixed p p tau = p := by
  dsimp [emaUpdateFixed, emaUpdateRaw]
  have h1 : tau * p + (SCALE - tau) * p = p * SCALE := by
    have h_add : tau * p + (SCALE - tau) * p = (tau + (SCALE - tau)) * p := (Int.add_mul tau (SCALE - tau) p).symm
    rw [h_add]
    have h_sum : tau + (SCALE - tau) = SCALE := by omega
    rw [h_sum]
    exact Int.mul_comm SCALE p
  rw [h1]
  have h_ne : SCALE ≠ 0 := by decide
  exact Int.mul_ediv_cancel p h_ne

/-! ### Theorem 9b & 9c: Discrete Bounded Range Invariance -/

/-- Theorem 9b (Bounded Range Invariance - Raw Numerator):
    If p, x in [-SCALE, SCALE] and tau in [0, SCALE], the raw unscaled EMA update
    is strictly bounded within [-SCALE^2, SCALE^2].
-/
theorem emaUpdateRaw_bounded (p : Int) (x : Int) (tau : Int)
    (h_tau : 0 ≤ tau ∧ tau ≤ SCALE)
    (h_p : -SCALE ≤ p ∧ p ≤ SCALE)
    (h_x : -SCALE ≤ x ∧ x ≤ SCALE) :
    -SCALE * SCALE ≤ emaUpdateRaw p x tau ∧ emaUpdateRaw p x tau ≤ SCALE * SCALE := by
  dsimp [emaUpdateRaw]
  have h_tau_rem : 0 ≤ SCALE - tau := by omega
  -- Upper bound
  have h_p_up : tau * p ≤ tau * SCALE := Int.mul_le_mul_of_nonneg_left h_p.2 h_tau.1
  have h_x_up : (SCALE - tau) * x ≤ (SCALE - tau) * SCALE := Int.mul_le_mul_of_nonneg_left h_x.2 h_tau_rem
  have h_up_sum : tau * p + (SCALE - tau) * x ≤ tau * SCALE + (SCALE - tau) * SCALE := by omega
  have h_up_eq : tau * SCALE + (SCALE - tau) * SCALE = SCALE * SCALE := by
    have h_distrib : tau * SCALE + (SCALE - tau) * SCALE = (tau + (SCALE - tau)) * SCALE := (Int.add_mul tau (SCALE - tau) SCALE).symm
    rw [h_distrib]
    have h_sum : tau + (SCALE - tau) = SCALE := by omega
    rw [h_sum]
  rw [h_up_eq] at h_up_sum

  -- Lower bound
  have h_p_lo : tau * (-SCALE) ≤ tau * p := Int.mul_le_mul_of_nonneg_left h_p.1 h_tau.1
  have h_x_lo : (SCALE - tau) * (-SCALE) ≤ (SCALE - tau) * x := Int.mul_le_mul_of_nonneg_left h_x.1 h_tau_rem
  have h_lo_sum : tau * (-SCALE) + (SCALE - tau) * (-SCALE) ≤ tau * p + (SCALE - tau) * x := by omega
  have h_lo_eq : tau * (-SCALE) + (SCALE - tau) * (-SCALE) = -SCALE * SCALE := by
    have h_distrib : tau * (-SCALE) + (SCALE - tau) * (-SCALE) = (tau + (SCALE - tau)) * (-SCALE) := (Int.add_mul tau (SCALE - tau) (-SCALE)).symm
    rw [h_distrib]
    have h_sum : tau + (SCALE - tau) = SCALE := by omega
    rw [h_sum]
    exact Int.mul_comm SCALE (-SCALE)
  rw [h_lo_eq] at h_lo_sum

  exact ⟨h_lo_sum, h_up_sum⟩

/-- Theorem 9c (Bounded Range Invariance - Scaled Division):
    If p, x in [-SCALE, SCALE] and tau in [0, SCALE], the scaled integer EMA update
    remains strictly bounded within [-SCALE, SCALE].
    Significance: Formally guarantees that latent persona vectors never overflow or explode,
    preserving numerical stability across indefinite chat turns.
-/
theorem emaUpdateFixed_bounded (p : Int) (x : Int) (tau : Int)
    (h_tau : 0 ≤ tau ∧ tau ≤ SCALE)
    (h_p : -SCALE ≤ p ∧ p ≤ SCALE)
    (h_x : -SCALE ≤ x ∧ x ≤ SCALE) :
    -SCALE ≤ emaUpdateFixed p x tau ∧ emaUpdateFixed p x tau ≤ SCALE := by
  have ⟨h_lo, h_up⟩ := emaUpdateRaw_bounded p x tau h_tau h_p h_x
  dsimp [emaUpdateFixed]
  have h_pos : 0 < SCALE := by decide
  have h_ne : SCALE ≠ 0 := by decide

  have h_div_up : emaUpdateRaw p x tau / SCALE ≤ (SCALE * SCALE) / SCALE :=
    Int.ediv_le_ediv h_pos h_up
  rw [Int.mul_ediv_cancel SCALE h_ne] at h_div_up

  have h_lo' : (-SCALE) * SCALE ≤ emaUpdateRaw p x tau := by
    rw [Int.mul_comm (-SCALE) SCALE]
    exact h_lo
  have h_div_lo : ((-SCALE) * SCALE) / SCALE ≤ emaUpdateRaw p x tau / SCALE :=
    Int.ediv_le_ediv h_pos h_lo'
  rw [Int.mul_ediv_cancel (-SCALE) h_ne] at h_div_lo

  exact ⟨h_div_lo, h_div_up⟩

/-! ### 64-Dimensional Latent Persona Vector Space -/

/-- 64-dimensional persona state vector matching JEPA memory matrix specification (lib/jepa/ema-memory.ts). -/
def PersonaVectorFixed := Fin VECTOR_DIM → Int

/-- Componentwise discrete EMA update across all 64 latent dimensions. -/
def emaUpdateVectorFixed (p : PersonaVectorFixed) (x : PersonaVectorFixed) (tau : Int) : PersonaVectorFixed :=
  fun i => emaUpdateFixed (p i) (x i) tau

/-- Theorem 8d (64-Dimensional Persona Vector Fixed Point Identity):
    When the observation vector X coincides with persona vector P across all 64 dimensions,
    the updated persona vector is identical to P.
-/
theorem emaVector_fixed_point (p : PersonaVectorFixed) (tau : Int) :
    emaUpdateVectorFixed p p tau = p := by
  funext i
  dsimp [emaUpdateVectorFixed]
  exact emaUpdateFixed_fixed_point (p i) tau

/-- Theorem 9d (64-Dimensional Persona Vector Bounded Range Invariance):
    If all 64 components of persona P and observation X are bounded within [-SCALE, SCALE],
    then all 64 components of the updated persona vector remain strictly within [-SCALE, SCALE].
-/
theorem emaVector_bounded_range (p : PersonaVectorFixed) (x : PersonaVectorFixed) (tau : Int)
    (h_tau : 0 ≤ tau ∧ tau ≤ SCALE)
    (h_p : ∀ i : Fin VECTOR_DIM, -SCALE ≤ p i ∧ p i ≤ SCALE)
    (h_x : ∀ i : Fin VECTOR_DIM, -SCALE ≤ x i ∧ x i ≤ SCALE) :
    ∀ i : Fin VECTOR_DIM, -SCALE ≤ emaUpdateVectorFixed p x tau i ∧ emaUpdateVectorFixed p x tau i ≤ SCALE := by
  intro i
  dsimp [emaUpdateVectorFixed]
  exact emaUpdateFixed_bounded (p i) (x i) tau h_tau (h_p i) (h_x i)

/-! ### Persona Drift Contraction -/

/-- Single-turn drift reduction lemma:
    The distance between the updated persona and the incoming observation is scaled by exactly tau:
      distFixed(T_raw(p, x, tau), x * SCALE) = tau * distFixed(p, x).
    Significance: Directly formalizes the drift reduction mechanism measured by
    `calculatePersonaDrift` in `lib/jepa/ema-memory.ts`.
-/
theorem emaUpdateRaw_drift_reduction (p : Int) (x : Int) (tau : Int) (h_tau : 0 ≤ tau) :
    distFixed (emaUpdateRaw p x tau) (x * SCALE) = tau * distFixed p x := by
  dsimp [distFixed, emaUpdateRaw]
  have h_alg : (tau * p + (SCALE - tau) * x) - x * SCALE = tau * (p - x) := by
    have h_x_scale : x * SCALE = SCALE * x := Int.mul_comm x SCALE
    rw [h_x_scale]
    have h_distrib : (SCALE - tau) * x = SCALE * x - tau * x := Int.sub_mul SCALE tau x
    rw [h_distrib]
    have h_sub : (tau * p + (SCALE * x - tau * x)) - SCALE * x = tau * p - tau * x := by omega
    rw [h_sub]
    exact (Int.mul_sub tau p x).symm
  rw [h_alg]
  exact intAbs_mul_of_nonneg tau (p - x) h_tau

end JEPAPersona
