# Lean 4 Formal Verification — Session 1 Objectives & Execution Runbook

> **Target Repository:** [`AlchmAgentsSolana`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana)  
> **Status:** ✅ Session 1 Completed & Verified  
> **Sprint Milestone:** Session 1: Toolchain Bootstrapping, Module Topology & CI Pipeline  
> **Toolchain Target:** Lean 4 `v4.13.0` (`arm64-apple-darwin23.6.0`) | Lake `5.0.0`

---

## 1. Session 1 Deliverables Summary

1. **Toolchain Provisioning (`elan` & Lean 4):**
   - Provisioned `elan 4.2.4` and toolchain `leanprover/lean4:v4.13.0` on Apple Silicon.
   - Pinned `v4.13.0` via [`proofs/lean/lean-toolchain`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/proofs/lean/lean-toolchain).
2. **Library Topology & Root Module:**
   - Created root module [`proofs/lean/Proofs.lean`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/proofs/lean/Proofs.lean) re-exporting all mathematical submodules (`Proofs.Wavefunction`, `Proofs.ConstellationAMM`, `Proofs.JEPAPersona`).
3. **Memory-Aware Mathematical Modeling (16GB RAM / M5 Strategy):**
   - Preserved lightweight build times (< 2 seconds) by relying on Lean 4 core without pulling monolithic external dependencies (e.g. Mathlib4).
   - In [`Proofs/Wavefunction.lean`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/proofs/lean/Proofs/Wavefunction.lean), added dual modeling:
     - **Continuous Model (`Float`):** Direct parity with TypeScript runtime (`chat-pricing.ts`).
     - **Discrete Fixed-Point Model (`Int` / BPS):** Strict algebraic modeling matching on-chain Solana and EVM smart contracts (`SCALE = 10000`), enabling clean inductive and arithmetic proofs without IEEE-754 float nuances.
4. **Build Verification (`lake build`):**
   - Executed `lake build` successfully with zero errors across all modules.
5. **Continuous Integration (CI):**
   - Created [`.github/workflows/lean-verify.yml`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/.github/workflows/lean-verify.yml) ensuring automated `lake build` verification on PRs modifying proof files.
6. **Pull Request Tracking:**
   - Opened [Draft PR #26](https://github.com/gregcastro23/alchm-agents-solana/pull/26) on branch `feat/lean-formal-proofs-plan`.

---

## 2. Environment Verification Commands

To verify the setup locally in any terminal:

```bash
# Add elan to PATH if not already sourced
export PATH="$HOME/.elan/bin:$PATH"

# Check versions
lean --version # Lean (version 4.13.0, arm64-apple-darwin23.6.0, commit 6d22e0e5cc5a, Release)
lake --version # Lake version 5.0.0-6d22e0e (Lean version 4.13.0)

# Build the proof suite
cd proofs/lean
lake build
```

---

## 3. Package Structure

```
proofs/lean/
├── lakefile.lean             # Package & lean_lib definition
├── lean-toolchain            # Pinned Lean version (v4.13.0)
├── Proofs.lean               # Umbrella root module
├── README.md                 # Setup & quickstart guide
├── .gitignore                # Lake build cache exclusions
├── lake-manifest.json        # Pinned package dependency manifest
└── Proofs/
    ├── Wavefunction.lean     # Elemental potentials, \Psi_a(t), and pricing bounds
    ├── ConstellationAMM.lean # Virtual reserves, constant-product, and cycle conservation
    └── JEPAPersona.lean      # 64-dim EMA persona matrix & contraction mapping
```

---

## 4. Transition to Session 2: Wavefunction & Pricing Bounds

With Session 1 toolchain setup and build verification 100% complete, Session 2 focuses on closing the proof obligations in [`Wavefunction.lean`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/proofs/lean/Proofs/Wavefunction.lean):

- **Theorem 1 & 1b (Bound Invariance):** Prove that $\Psi_a \in [-2, 2]$ for both continuous and discrete fixed-point formulations given positive total transit energy.
- **Theorem 2 & 2b (Economic Positivity & Lower Bound):** Prove that chat cost is strictly positive and bounded from below by $0.3 \times \text{Base} \times \text{Multiplier}$, guaranteeing no negative-cost prompt exploits.
- **Theorem 3 & 3b (Zero Energy Degeneracy):** Prove that when total transit energy is zero, the dignity wave collapses to 0.
