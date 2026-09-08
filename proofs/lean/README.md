# Planetary Agents — Lean 4 Formal Verification Suite

This package houses formal mathematical specifications and machine-checked theorem proofs for the Planetary Agents protocol.

## Target Systems

1. **`Proofs/Wavefunction.lean`**:
   - Elemental Potential Space: $\vec{v} = (v_{\text{Spirit}}, v_{\text{Essence}}, v_{\text{Matter}}, v_{\text{Substance}}) \in \mathbb{R}^4$.
   - Chart Dignity Wavefunction: $\Psi_a(\vec{v}) = \frac{v_a}{\frac{1}{2}\sum |v_i|}$.
   - Modulated Fee Function: $\text{Cost}_a = \text{Base}_a \cdot \max(0.3, 1.0 - 0.35 \cdot \Psi_a) \cdot M$.
   - **Theorems:** Boundedness of $\Psi_a$, strict economic positivity, lower pricing bound.

2. **`Proofs/ConstellationAMM.lean`**:
   - Constant-Product Virtual Reserves: $R_A \cdot R_B = k$.
   - Soulbound Mint/Burn Transitions without Token Custody.
   - **Theorems:** Monotonicity of $k$, no positive-cycle arbitrage.

3. **`Proofs/JEPAPersona.lean`**:
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
