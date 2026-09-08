/-
  Planetary Agents — Lean 4 Formal Verification
  Kernel-Level Environment-Walking Axiom Audit Gate
-/

import Lean
import Proofs

open Lean

def main : IO UInt32 := do
  initSearchPath (← findSysroot)
  let env ← importModules #[{ module := `Proofs }] {}

  let targetModules : List Name := [
    `Proofs,
    `Proofs.Wavefunction,
    `Proofs.Discretization,
    `Proofs.ConstellationAMM,
    `Proofs.JEPAPersona
  ]

  let allowedAxioms : NameSet :=
    RBTree.ofList [`propext, `Quot.sound, `Classical.choice]

  let mut totalDecls := 0
  let mut badAxioms : List (Name × Array Name) := []

  for (name, _) in env.constants do
    if let some modIdx := env.getModuleIdxFor? name then
      let modName := env.header.moduleNames[modIdx.toNat]!
      if targetModules.contains modName then
        if !name.isInternal then
          totalDecls := totalDecls + 1
          let act : CoreM (Array Name) := collectAxioms name
          let (axioms, _) ← act.toIO { fileName := "", fileMap := default } { env := env }
          let nonStandard := axioms.filter (!allowedAxioms.contains ·)
          if !nonStandard.isEmpty then
            badAxioms := (name, nonStandard) :: badAxioms

  IO.println s!"=== Lean 4 Kernel Axiom Independence Audit ==="
  IO.println s!"Audited {totalDecls} declarations across {targetModules}."

  if badAxioms.isEmpty then
    IO.println "✅ PASS: 100% of declarations depend strictly on standard Lean 4 core axioms."
    return 0
  else
    IO.println s!"❌ FAIL: Found {badAxioms.length} declaration(s) with non-standard or unproven axioms:"
    for (name, nonStd) in badAxioms do
      IO.println s!"  {name} :: {nonStd}"
    return 1
