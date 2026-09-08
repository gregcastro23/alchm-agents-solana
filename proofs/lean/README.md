# Planetary Agents — Lean 4 Formal Verification Suite

This package houses formal mathematical specifications and machine-checked theorem proofs for the Planetary Agents protocol.

## Verification Status Matrix

| Module                             | Subject                                  | Theorems                                           | Status                   | Warnings                 |
| :--------------------------------- | :--------------------------------------- | :------------------------------------------------- | :----------------------- | :----------------------- |
| **`Proofs/Wavefunction.lean`**     | Celestial Wavefunction & Pricing Bounds  | Thm 1, 1b, 2, 2b, 3, 3b + Lower Bound + Non-neg    | **100% Machine-Checked** | **0 sorry / 0 warnings** |
| **`Proofs/Discretization.lean`**   | Discretization Error & Truncation Bounds | Thm 3.1, 3.1b, 3.2a, 3.2b, 3.2c, 3.3, 3.3b, Bounds | **100% Machine-Checked** | **0 sorry / 0 warnings** |
| **`Proofs/ConstellationAMM.lean`** | Constant-Product Virtual Reserves        | Thm 4, 5, 6 + Ratio Lemma + Corollaries            | **100% Machine-Checked** | **0 sorry / 0 warnings** |
| **`Proofs/JEPAPersona.lean`**      | 64-dim EMA Memory & Stability            | Thm 7, 7b, 7c, 8, 8b, 8d, 9, 9b, 9c, 9d + Drift    | **100% Machine-Checked** | **0 sorry / 0 warnings** |

## Target Systems & Specifications

1. **`Proofs/Wavefunction.lean`** (✅ Fully Verified):
   - **Elemental Potential Space:** $\vec{v} = (v_{\text{Spirit}}, v_{\text{Essence}}, v_{\text{Matter}}, v_{\text{Substance}}) \in \mathbb{R}^4$ (Float) and $\mathbb{Z}^4$ (Fixed-Point BPS, $\text{SCALE} = 10,000$).
   - **Chart Dignity Wavefunction:** $\Psi_a(\vec{v}) = \frac{v_a}{\frac{1}{2}\sum |v_i|}$.
   - **Modulated Fee Function:** $\text{Cost}_a = \text{Base}_a \cdot \max(0.3, 1.0 - 0.35 \cdot \Psi_a) \cdot M$.
   - **Proven Theorems:**
     - **Thm 1 & 1b (`dignityWaveFixed_bounded`):** Strict bound invariance $\Psi_{\text{fixed}} \in [-20000, 20000]$ (i.e. $[-2 \cdot \text{SCALE}, 2 \cdot \text{SCALE}]$) for all $E > 0$.
     - **Thm 2 & 2b (`calculateCostFixed_positive`):** Economic cost positivity $\text{Cost}_{\text{fixed}} \ge \frac{3000 \cdot \text{Base} \cdot M}{\text{SCALE}^2} > 0$ for $\text{Base} \ge 4$ and $M \ge \text{SCALE}$.
     - **Lower Bound (`calculateCostFixed_lower_bound`):** $\text{Cost}_{\text{fixed}} \ge \frac{3000 \cdot \text{Base} \cdot M}{\text{SCALE}^2}$ for all $\text{Base} > 0$.
     - **Protocol Safety (`calculateCostFixed_nonneg`):** $\text{Cost}_{\text{fixed}} \ge 0$ for all non-negative inputs, mathematically eliminating negative-fee prompt exploits.
     - **Thm 3 & 3b (`zero_energy_degeneracy`, `zero_energy_degeneracy_fixed`):** Degeneracy collapse to $0$ when transit energy collapses to $0$.

2. **`Proofs/Discretization.lean`** (✅ Fully Verified):
   - **Discretization Epsilon Bound (Thm 3.1 & 3.1b):** Formal bounds proving UI simulation divergence from on-chain scaled integers is $< 10^{-4}$ ($< 1$ BPS), with exact integer Euclidean remainder $0 \le R < E$.
   - **Truncation Solvency (Thm 3.2a, 3.2b, 3.2c):** Proves integer truncation floors chat pricing downwards ($\text{Cost}_{\text{fixed}} \cdot \text{SCALE}^2 \le \text{Base} \cdot \text{factor} \cdot M$) and AMM swap output downwards, guaranteeing sub-atom drain immunity ($\text{outAmt} = 0$ for micro-swaps).
   - **Sub-Threshold Non-Negativity (Thm 3.3 & 3.3b):** Proves discount factor bounds $[3000, 17000]$ and non-negativity $\text{Cost}_{\text{fixed}} \ge 0$ for all $\text{Base} \ge 0$ and live transits $\Psi \in [-20000, 20000]$.

3. **`Proofs/ConstellationAMM.lean`** (✅ Fully Verified):
   - **Constant-Product Virtual Reserves:** $R_A \cdot R_B = k$.
   - **Soulbound Mint/Burn Transitions without Token Custody.**
   - **Proven Theorems:**
     - **Ratio Lemma (`getAmountOut_mul_reserveIn_le`):** Universal invariant $\text{outAmt} \cdot R_{\text{in}} \le \Delta x \cdot R_{\text{out}}$ under any fee $\le \text{BPS}$.
     - **Thm 4 (`invariant_non_decreasing`):** Monotonic virtual reserve growth $k' = (R_A + \Delta x)(R_B - \Delta y) \ge R_A \cdot R_B = k$.
     - **Thm 5 (`no_infinite_mint_cycle`):** Multi-hop closed cyclic swap arbitrage conservation ($\text{out}_{A,\text{final}} \le \text{in}_{A,\text{initial}}$) under no-arbitrage price product condition ($R_B^{AB} R_C^{BC} R_A^{CA} \le R_A^{AB} R_B^{BC} R_C^{CA}$).
     - **Symmetric Corollary (`no_infinite_mint_cycle_symmetric`):** Zero-arbitrage cycle conservation for symmetric pools ($R_A = R_B$).
     - **Round-Trip Corollary (`no_infinite_mint_roundtrip`):** 2-hop round-trip swap conservation ($A \to B \to A$) unconditionally holding for all pool reserves.
     - **Thm 6 (`slippage_protection`):** Strict execution rejection $(\text{outAmt} \ge \text{minOut}) = \text{false}$ whenever $\text{outAmt} < \text{minOut}$.

4. **`Proofs/JEPAPersona.lean`** (✅ Fully Verified):
   - **64-Dimensional Latent Persona Memory:** Zero-GC EMA persona tracking matrix (`lib/jepa/ema-memory.ts`, $\tau = 0.99 = 9,900$ BPS).
   - **Proven Theorems:**
     - **Thm 7 (`ema_is_contraction`):** Banach Contraction Mapping $\text{dist}(T(p_1), T(p_2)) \le \tau \cdot \text{dist}(p_1, p_2)$ for $\tau \in (0, 1)$.
     - **Thm 7b (`emaUpdateRaw_dist`):** Exact discrete Lipschitz contraction identity $\text{distFixed}(T_{\text{raw}}(p_1), T_{\text{raw}}(p_2)) = \tau \cdot \text{distFixed}(p_1, p_2)$ for $\tau \ge 0$.
     - **Thm 7c (`emaIterRaw_dist`):** Multi-step exponential divergence compression $\text{distFixed}(T_{\text{raw}}^n(p_1), T_{\text{raw}}^n(p_2)) = \tau^n \cdot \text{distFixed}(p_1, p_2)$, proving persona drift vanishes at rate $\tau^n$.
     - **Thm 8 (`ema_fixed_point`) & Thm 8b (`emaUpdateFixed_fixed_point`):** Fixed point invariance $T(p, p, \tau) = p$, proving aligned observations cause zero persona drift.
     - **Thm 8d (`emaVector_fixed_point`):** Full 64-dimensional vector fixed point identity across all latent dimensions.
     - **Thm 9 (`ema_bounded_range`) & Thm 9b, 9c (`emaUpdateRaw_bounded`, `emaUpdateFixed_bounded`):** Bounded range invariance guaranteeing latent persona vectors remain within $[-1.0, 1.0]$ (and $[-10000, 10000]$ BPS) without numerical overflow.
     - **Thm 9d (`emaVector_bounded_range`):** 64-dimensional latent vector range invariance.
     - **Drift Reduction Lemma (`emaUpdateRaw_drift_reduction`):** Single-turn context drift reduction $\text{distFixed}(T(p, x), x \cdot \text{SCALE}) = \tau \cdot \text{distFixed}(p, x)$ matching `calculatePersonaDrift`.

## Prerequisites & Installation

To install Lean 4 and Lake:

```bash
# Install elan (Lean toolchain manager)
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh

# Configure environment
source ~/.elan/env

# Verify installation
lean --version
lake --version
```

## Building the Proofs

```bash
cd proofs/lean
lake build
```

## Project Structure

```
proofs/lean/
├── lakefile.lean             # Package and build definition
├── lean-toolchain            # Lean 4 version pinning (v4.13.0)
├── README.md                 # This file
└── Proofs/
    ├── Wavefunction.lean     # Pricing & waveharmonics formalization
    ├── Discretization.lean   # Discretization bounds & truncation solvency
    ├── ConstellationAMM.lean # AMM virtual reserve conservation
    └── JEPAPersona.lean      # JEPA persona memory contraction
```

## Documentation & Audit Reports

- **Complete Formal Verification Report:** [`../../docs/FORMAL_VERIFICATION_REPORT.md`](../../docs/FORMAL_VERIFICATION_REPORT.md)
- **Lean 4 Master Roadmap:** [`../../docs/LEAN_PROOF_IMPROVEMENT_PLAN.md`](../../docs/LEAN_PROOF_IMPROVEMENT_PLAN.md)
- **LaTeX Whitepaper Export:** [`../../docs/WHITEPAPER_FORMAL_VERIFICATION.tex`](../../docs/WHITEPAPER_FORMAL_VERIFICATION.tex)
