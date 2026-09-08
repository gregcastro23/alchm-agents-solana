# Session 4 Prompt — Constellation AMM Invariants & Virtual Reserve Conservation in Lean 4

> **Target Repository:** [`/Users/cookingwithcastro/Desktop/AlchmAgentsSolana`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana)  
> **Active Branch:** `feat/lean-formal-proofs-plan` (Tracking: `origin/feat/lean-formal-proofs-plan`)  
> **Active Pull Request:** [Draft PR #26: feat(proofs): Lean 4 Formal Verification Plan & Mathematical Specifications](https://github.com/gregcastro23/alchm-agents-solana/pull/26)  
> **Toolchain:** Lean 4 `v4.13.0` (`arm64-apple-darwin`) | Lake `5.0.0` | `~/.elan/bin/` on PATH  
> **Target Module:** `proofs/lean/Proofs/ConstellationAMM.lean`  
> **Reference Implementations:**
>
> - `contracts/src/ConstellationAMM.sol` (EVM constant-product virtual reserves DEX)
> - `programs/asol_program/src/state/amm.rs` & `programs/asol_program/src/instructions/amm/mod.rs` (Solana Anchor AMM)
> - `proofs/lean/Proofs/Discretization.lean` (Integer truncation & sub-atom drain immunity)

---

## 🎯 Session 4 Objective

Your sole objective in this session is to **formalize and close all remaining proof obligations in `proofs/lean/Proofs/ConstellationAMM.lean`**, proving that virtual reserves under the constant-product invariant ($x \cdot y = k$) are strictly non-decreasing ($k' \ge k$), that no cyclic swap path across elemental pools can mint soulbound tokens from thin air (no-arbitrage conservation), and that slippage bounds strictly revert underpriced execution.

---

## 📋 Theoretical Foundations & Theorems to Prove

### 1. Theorem 4: Virtual Reserve Monotonicity ($k' \ge k$)

- **Mathematical Statement:** For any swap of input amount $\Delta x > 0$ into a pool with reserves $R_A > 0, R_B > 0$ and fee factor $\gamma = \frac{\text{BPS} - \text{feeBps}}{\text{BPS}}$:
  $$k' = (R_A + \Delta x) \cdot (R_B - \Delta y) \ge R_A \cdot R_B = k$$
  where discrete output $\Delta y = \left\lfloor \frac{\Delta x \cdot (\text{BPS} - \text{feeBps}) \cdot R_B}{R_A \cdot \text{BPS} + \Delta x \cdot (\text{BPS} - \text{feeBps})} \right\rfloor$.
- **Significance:** Formally guarantees that pool virtual reserves never deteriorate under swaps, establishing long-term solvency without physical token custody.

### 2. Theorem 5: No-Infinite-Mint Cycle (Cyclic Arbitrage Conservation)

- **Mathematical Statement:** For any sequence of swaps through distinct elemental pools forming a closed cycle (e.g. $A \to B \to C \to A$):
  $$\text{out}_{A,\text{final}} \le \text{in}_{A,\text{initial}}$$
- **Significance:** Eliminates the possibility of cyclic swap arbitrage extracting soulbound ESMS tokens, proving that no combination of trades can drain virtual liquidity or generate unbacked tokens.

### 3. Theorem 6: Slippage Enforcement & Minimum Output Protection

- **Mathematical Statement:** For any user-specified minimum output bound $\text{minOut}$:
  $$\text{outAmt} < \text{minOut} \implies (\text{outAmt} \ge \text{minOut}) = \text{false}$$
- **Significance:** Formally proves that on-chain execution strictly reverts if slippage exceeds user tolerance, preventing MEV sandwich attacks and adverse execution.

---

## 🛠️ Execution Runbook

1. **Verify Environment & Prior Modules:**

   ```bash
   export PATH="$HOME/.elan/bin:$PATH"
   lean --version && lake --version
   cd proofs/lean && lake build
   ```

   Confirm that `Proofs.Wavefunction` and `Proofs.Discretization` compile with zero warnings and zero `sorry`s.

2. **Inspect & Close Proofs in `ConstellationAMM.lean`:**
   - Eliminate all 3 `sorry` declarations in [`proofs/lean/Proofs/ConstellationAMM.lean`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/proofs/lean/Proofs/ConstellationAMM.lean):
     - `invariant_non_decreasing` (Theorem 4)
     - `no_infinite_mint_cycle` (Theorem 5)
     - `slippage_protection` (Theorem 6)
   - Utilize helper lemmas from `Proofs.Discretization` (e.g., `amm_getAmountOut_truncation_le`, `Nat.div_mul_le_self`, and `omega`).

3. **Verify Clean Compilation:**

   ```bash
   lake clean && lake build
   ```

   Confirm `Proofs.ConstellationAMM` builds with **0 errors, 0 warnings, and 0 `sorry`s**.

4. **Update Verification Documentation:**
   - Update `proofs/lean/README.md` and `docs/LEAN_PROOF_IMPROVEMENT_PLAN.md` to reflect Session 4 completion.
   - Record deliverables in `docs/LEAN_SESSION_4_OBJECTIVES.md`.
