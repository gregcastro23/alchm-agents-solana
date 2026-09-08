# Planetary Agents — Lean 4 Formal Verification Suite

This package houses formal mathematical specifications and machine-checked theorem proofs for the Planetary Agents protocol.

## Verification Status Matrix

| Module                             | Subject                                 | Theorems                                           | Status                     | Warnings                 |
| :--------------------------------- | :-------------------------------------- | :------------------------------------------------- | :------------------------- | :----------------------- |
| **`Proofs/Wavefunction.lean`**     | Celestial Wavefunction & Pricing Bounds | Thm 1, 1b, 2, 2b, 3, 3b + Lower Bound + Non-neg    | **100% Machine-Checked**   | **0 sorry / 0 warnings** |
| **`Proofs/ConstellationAMM.lean`** | Constant-Product Virtual Reserves       | Thm 4, 5, 6 (Monotonicity, No-Arbitrage, Slippage) | Formalized (Axioms active) | Milestone: Session 4     |
| **`Proofs/JEPAPersona.lean`**      | 64-dim EMA Memory & Stability           | Thm 7, 8, 9 (Banach Contraction, Invariance)       | Formalized (Axioms active) | Milestone: Session 5     |

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

2. **`Proofs/ConstellationAMM.lean`** (Session 4):
   - Constant-Product Virtual Reserves: $R_A \cdot R_B = k$.
   - Soulbound Mint/Burn Transitions without Token Custody.
   - **Theorems:** Monotonicity of $k$, no positive-cycle arbitrage.

3. **`Proofs/JEPAPersona.lean`** (Session 5):
   - 64-dimensional latent persona vector space.
   - Exponential Moving Average (EMA) matrix with smoothing parameter $\tau = 0.99$.
   - **Theorems:** Banach contraction mapping, bounded variance, persona stability.

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
    ├── ConstellationAMM.lean # AMM virtual reserve conservation
    └── JEPAPersona.lean      # JEPA persona memory contraction
```
