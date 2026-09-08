#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== Running Lean 4 Axiom & Sorry Audit Gate ==="

# 1. Check for any sorry keywords
if grep -rn "sorry" Proofs/; then
  echo "❌ FAIL: Found 'sorry' obligations in Proofs/"
  exit 1
fi

# 2. Check for any custom axiom declarations
if grep -rn "^axiom " Proofs/; then
  echo "❌ FAIL: Found custom 'axiom' declarations in Proofs/"
  exit 1
fi

echo "✅ PASS: Zero 'sorry' obligations and zero custom 'axiom' declarations found."
