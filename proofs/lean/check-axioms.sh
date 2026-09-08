#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== Running Lean 4 Axiom & Sorry Audit Gate ==="

# 1. Fast text check for any sorry keywords
if grep -rn "sorry" Proofs/; then
  echo "❌ FAIL: Found 'sorry' obligations in Proofs/"
  exit 1
fi

# 2. Kernel-level environment walk checking all 134+ declarations for non-standard axioms
echo "--- Running Kernel Environment-Walking Axiom Gate ---"
lake env lean --run AxiomGate.lean

echo "✅ PASS: Verified zero 'sorry' obligations and zero non-standard axioms via kernel reflection."
