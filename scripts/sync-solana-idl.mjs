#!/usr/bin/env node
/**
 * Copies the freshly built IDL and types from `target/` into `lib/solana/idl/`,
 * which is what the app and scripts actually import.
 *
 * They are separate on purpose -- Vercel ships a bundle, not the repo, so the IDL
 * has to be a committed source file -- but nothing kept them in sync, and the
 * committed copy had drifted several phases behind: it was missing every StarVault
 * (Phase 5) and Constellation AMM (Phase 6) instruction while `target/idl` had all
 * of them. Run this after `bun run solana:build`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const IDL_SRC = 'target/idl/asol_program.json'
const TYPES_SRC = 'target/types/asol_program.ts'
const IDL_DEST = 'lib/solana/idl/asol_program.json'
const TYPES_DEST = 'lib/solana/idl/asol_program.ts'

/** `lib/solana/idl/index.ts` re-exports this legacy alias; the generator does not emit it. */
const LEGACY_ALIAS = '\nexport type AaeSolana = AsolProgram\n'

const idl = JSON.parse(readFileSync(IDL_SRC, 'utf8'))
writeFileSync(IDL_DEST, `${JSON.stringify(idl, null, 2)}\n`)

let types = readFileSync(TYPES_SRC, 'utf8')
if (!types.includes('export type AaeSolana')) {
  types = `${types.trimEnd()}\n${LEGACY_ALIAS}`
}
writeFileSync(TYPES_DEST, types)

execSync(`bunx prettier --write ${IDL_DEST} ${TYPES_DEST}`, { stdio: 'inherit' })

const names = idl.instructions.map(i => i.name)
console.log(`Synced ${names.length} instructions to ${IDL_DEST}`)
console.log(`  ${names.join(', ')}`)
