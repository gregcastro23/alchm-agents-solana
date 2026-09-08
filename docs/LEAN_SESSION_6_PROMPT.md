# Session 6 Prompt — Verification Audit, LaTeX/Whitepaper Export & PR Finalization

> **Target Repository:** [`/Users/cookingwithcastro/Desktop/AlchmAgentsSolana`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana)  
> **Active Branch:** `feat/lean-formal-proofs-plan` (Tracking: `origin/feat/lean-formal-proofs-plan`)  
> **Active Pull Request:** [Draft PR #26: feat(proofs): Lean 4 Formal Verification Plan & Mathematical Specifications](https://github.com/gregcastro23/alchm-agents-solana/pull/26)  
> **Toolchain:** Lean 4 `v4.13.0` (`arm64-apple-darwin`) | Lake `5.0.0` | `~/.elan/bin/` on PATH  
> **All Modules 100% Machine-Checked:**
>
> - `proofs/lean/Proofs/Wavefunction.lean` (Theorems 1, 1b, 2, 2b, 3, 3b)
> - `proofs/lean/Proofs/Discretization.lean` (Theorems 3.1, 3.1b, 3.2a, 3.2b, 3.2c, 3.3, 3.3b)
> - `proofs/lean/Proofs/ConstellationAMM.lean` (Theorems 4, 5, 6, Ratio Lemma, Corollaries)
> - `proofs/lean/Proofs/JEPAPersona.lean` (Theorems 7, 7b, 7c, 8, 8b, 8d, 9, 9b, 9c, 9d, Drift)

---

## 🎯 Session 6 Objective

Your objective in this final session is to **execute the complete formal verification audit, synchronize whitepaper and protocol security cross-references, verify GitHub Actions CI readiness, and prepare Draft Pull Request #26 for final review and merge into main**.

---

## 📋 Deliverables & Tasks

1. **Verify Entire Suite Clean Build:**

   ```bash
   export PATH="$HOME/.elan/bin:$PATH"
   cd proofs/lean && lake clean && lake build
   grep -rn "sorry" Proofs/
   ```

   Confirm that all 4 modules compile cleanly in $< 2$ seconds with 0 warnings, 0 errors, and zero `sorry` obligations.

2. **Validate Documentation & Audit Report:**
   - Verify that [`docs/FORMAL_VERIFICATION_REPORT.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/FORMAL_VERIFICATION_REPORT.md) is comprehensive and up-to-date with all proved theorems and security invariant mappings.
   - Verify that [`docs/LEAN_PROOF_IMPROVEMENT_PLAN.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/LEAN_PROOF_IMPROVEMENT_PLAN.md) checklist is 100% complete.
   - Cross-reference verified theorems across [`GEMINI.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/GEMINI.md) and [`docs/README.md`](file:///Users/cookingwithcastro/Desktop/AlchmAgentsSolana/docs/README.md).

3. **CI Pipeline Readiness:**
   - Verify that `.github/workflows/lean-verify.yml` runs `lake build` against Lean 4 `v4.13.0` and passes on `ubuntu-latest`.

4. **Pull Request #26 Readiness:**
   - Stage all session deliverables and proof files cleanly on `feat/lean-formal-proofs-plan`.
   - Prepare PR title and description ready for maintainer signoff.
