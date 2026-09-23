// @vitest-environment node
/**
 * What WTEN reads from this repo without asking.
 *
 * 1. deployments/*.json, fetched from raw.githubusercontent.com (main) and
 *    zod-validated by WTEN's src/services/admin/solanaManifests.ts. Renaming a
 *    file or dropping a field here silently blanks WTEN's /admin/chain.
 * 2. Two account layouts WTEN decodes byte by byte in
 *    src/services/admin/solanaDecode.ts (test vectors from real devnet bytes):
 *    ProgramConfig (140 bytes; admin 9–41, attestor 41–73, pauser 73–105,
 *    pause flags at 137 and 138) and ConstellationPool (42 bytes).
 * A failure here means: coordinate with WTEN before merging.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../..')
const manifest = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'deployments', name), 'utf8')) as Record<string, any>

const isBase58 = (v: unknown) => typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)

describe('deployments/*.json fields WTEN reads', () => {
  it('solana-devnet.json', () => {
    const m = manifest('solana-devnet.json')
    expect(typeof m.genesisHash).toBe('string')
    for (const key of ['programId', 'programConfigPda', 'programDataAddress', 'deployer']) {
      expect({ key, ok: isBase58(m[key]) }).toEqual({ key, ok: true })
    }
    expect(Array.isArray(m.mints) && m.mints.length).toBeGreaterThan(0)
    for (const mint of m.mints) {
      expect(typeof mint.symbol).toBe('string')
      expect(isBase58(mint.address)).toBe(true)
      expect(Number.isInteger(mint.decimals)).toBe(true)
    }
  })

  it('solana-devnet-governance.json', () => {
    const m = manifest('solana-devnet-governance.json')
    expect(isBase58(m.multisigPda)).toBe(true)
    expect(isBase58(m.vaultPda)).toBe(true)
    expect(Number.isInteger(m.threshold)).toBe(true)
    expect(m.members.length).toBeGreaterThan(0)
    for (const member of m.members) {
      expect(typeof member.role).toBe('string')
      expect(isBase58(member.address)).toBe(true)
    }
    if (m.lifecycleDrill !== undefined) expect(typeof m.lifecycleDrill.status).toBe('string')
  })

  it('solana-devnet-audit-receipt.json', () => {
    const m = manifest('solana-devnet-audit-receipt.json')
    expect(typeof m.timestamp).toBe('string')
    expect(typeof m.status).toBe('string')
    if (m.errors !== undefined) expect(Array.isArray(m.errors)).toBe(true)
    if (m.ammPools !== undefined) {
      for (const pool of m.ammPools) {
        expect(Number.isInteger(pool.poolId)).toBe(true)
        expect(isBase58(pool.pda)).toBe(true)
      }
    }
  })

  it('solana-mainnet.json', () => {
    const m = manifest('solana-mainnet.json')
    expect(typeof m.status).toBe('string')
    expect(isBase58(m.programId)).toBe(true)
    expect(m.mints && typeof m.mints === 'object' && !Array.isArray(m.mints)).toBe(true)
    for (const mint of Object.values<any>(m.mints)) {
      expect(isBase58(mint.address)).toBe(true)
      expect(typeof mint.symbol).toBe('string')
    }
    if (m.governance?.upgradeAuthorityTransferred !== undefined) {
      expect(typeof m.governance.upgradeAuthorityTransferred).toBe('boolean')
    }
  })
})

// ---------------------------------------------------------------------------
// Account layouts, computed from the committed IDL (what the app ships)
// ---------------------------------------------------------------------------

const idl = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/solana/idl/asol_program.json'), 'utf8'))
const SIZE: Record<string, number> = {
  u8: 1,
  bool: 1,
  u16: 2,
  i16: 2,
  u32: 4,
  i32: 4,
  u64: 8,
  i64: 8,
  pubkey: 32,
}

function fieldSize(type: any): number {
  if (typeof type === 'string') {
    const s = SIZE[type]
    if (s === undefined) throw new Error(`unsized type ${type}`)
    return s
  }
  if (type.array) return fieldSize(type.array[0]) * type.array[1]
  throw new Error(`unsized type ${JSON.stringify(type)}`)
}

/** Byte offset (after the 8-byte discriminator) and size of each field, in order. */
function layout(name: string) {
  const t = idl.types.find((x: any) => x.name === name)
  let offset = 8
  const fields: Record<string, { start: number; end: number }> = {}
  for (const f of t.type.fields) {
    const size = fieldSize(f.type)
    fields[f.name] = { start: offset, end: offset + size }
    offset += size
  }
  return { size: offset, fields }
}

describe('account layouts WTEN decodes (solanaDecode.ts)', () => {
  it('ProgramConfig is 140 bytes with keys and pause flags where WTEN reads them', () => {
    const { size, fields } = layout('ProgramConfig')
    expect(size).toBe(140)
    expect(fields.admin).toEqual({ start: 9, end: 41 })
    expect(fields.attestor).toEqual({ start: 41, end: 73 })
    expect(fields.pauser).toEqual({ start: 73, end: 105 })
    expect(fields.pause_claims!.start).toBe(137)
    expect(fields.pause_redemptions!.start).toBe(138)
  })

  it('ConstellationPool is 42 bytes', () => {
    expect(layout('ConstellationPool').size).toBe(42)
  })
})
