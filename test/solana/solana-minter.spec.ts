import { describe, expect, it } from 'vitest'
import {
  claimIdToBytes32,
  computeLedgerReferenceHash,
  toSolanaOnchainAmounts,
} from '@/lib/solana/solana-minter'

describe('Solana ESMS Minter Utilities', () => {
  it('converts hex claimId to 32-byte Uint8Array', () => {
    const claimIdHex = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const bytes = claimIdToBytes32(claimIdHex)
    expect(bytes.length).toBe(32)
    expect(bytes[0]).toBe(0x12)
    expect(bytes[31]).toBe(0xef)
  })

  it('scales 4-decimal ledger amounts to exact u64 bigint atoms', () => {
    const amounts = {
      spirit: '10.5000',
      essence: '5.2500',
      matter: '0.0000',
      substance: '100.0001',
    }
    const onchain = toSolanaOnchainAmounts(amounts)
    expect(onchain[0]).toBe(105000n)
    expect(onchain[1]).toBe(52500n)
    expect(onchain[2]).toBe(0n)
    expect(onchain[3]).toBe(1000001n)
  })

  it('computes deterministic SHA-256 ledger reference hash', () => {
    const claimId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const amounts = { spirit: '10', essence: '5', matter: '1', substance: '2' }
    const hash1 = computeLedgerReferenceHash(claimId, amounts)
    const hash2 = computeLedgerReferenceHash(claimId, amounts)
    expect(hash1.length).toBe(32)
    expect(Buffer.from(hash1).toString('hex')).toBe(Buffer.from(hash2).toString('hex'))
  })
})
