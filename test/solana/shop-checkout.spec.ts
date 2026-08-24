// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { Ed25519Program, PublicKey, TransactionInstruction } from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'

import {
  ASOL_SOLANA_PROGRAM_ID,
  buildRedeemAuthorizationMessage,
  REDEEM_AUTHORIZATION_DOMAIN,
} from '@/lib/solana/esms'
import { buildRedeemAuthorizationVector } from '@/lib/solana/vectors'
import { AsolSolanaClient, type AsolSolanaWallet } from '@/lib/solana/asol-solana-client'
import {
  canAffordSolana,
  costToSolanaAmounts,
  solanaShortfall,
  type EsmsCost,
} from '@/lib/shop/pricing'
import { injectComputeBudgetInstructions } from '@/lib/solana/priority-fee'

describe('Solana Storefront & Detached Ed25519 Checkout (Phase 3)', () => {
  const programId = new PublicKey('5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD')
  const clusterDomain = new Uint8Array(32).fill(2)
  const orderId = new Uint8Array(32).fill(4)
  const amounts = [10_000n, 20_000n, 30_000n, 40_000n] as const
  const deadline = 1_900_000_000n

  it('serializes authorization message matching the 187-byte Anchor protocol layout', () => {
    const keypair = nacl.sign.keyPair()
    const holder = new PublicKey(keypair.publicKey)

    const message = buildRedeemAuthorizationMessage({
      programId,
      clusterDomain,
      holder,
      orderId,
      amounts,
      deadline,
    })

    // Layout: Domain (19) + ProgramId (32) + Cluster (32) + Holder (32) + OrderId (32) + Amounts (32) + Deadline (8) = 187
    expect(message.length).toBe(19 + 32 * 4 + 8 * 5)
    expect(message.subarray(0, 19).toString('utf8')).toBe('ASOL_ESMS_REDEEM_V1')
    expect(message.subarray(19, 51)).toEqual(programId.toBuffer())
    expect(message.subarray(51, 83)).toEqual(Buffer.from(clusterDomain))
    expect(message.subarray(83, 115)).toEqual(holder.toBuffer())
    expect(message.subarray(115, 147)).toEqual(Buffer.from(orderId))

    // Amounts (LE u64)
    expect(message.readBigUInt64LE(147)).toBe(10_000n)
    expect(message.readBigUInt64LE(155)).toBe(20_000n)
    expect(message.readBigUInt64LE(163)).toBe(30_000n)
    expect(message.readBigUInt64LE(171)).toBe(40_000n)
    // Deadline (LE i64)
    expect(message.readBigInt64LE(179)).toBe(1_900_000_000n)
  })

  it('validates golden serialization vector against Rust Anchor vectors.rs', () => {
    const fixedProgramId = new Uint8Array(32).fill(1)
    const fixedCluster = new Uint8Array(32).fill(2)
    const fixedHolder = new Uint8Array(32).fill(3)
    const fixedOrder = new Uint8Array(32).fill(4)

    const vector = buildRedeemAuthorizationVector({
      programId: fixedProgramId,
      clusterDomain: fixedCluster,
      holder: fixedHolder,
      orderId: fixedOrder,
      amounts,
      deadline,
    })

    expect(vector).toBe(
      '41534f4c5f45534d535f52454445454d5f563101010101010101010101010101010101010101010101010101010101010101010202020202020202020202020202020202020202020202020202020202020202030303030303030303030303030303030303030303030303030303030303030304040404040404040404040404040404040404040404040404040404040404041027000000000000204e0000000000003075000000000000409c00000000000000b33f7100000000'
    )
  })

  it('signs and verifies detached Ed25519 authorization messages', () => {
    const keypair = nacl.sign.keyPair()
    const holder = new PublicKey(keypair.publicKey)

    const message = buildRedeemAuthorizationMessage({
      programId,
      clusterDomain,
      holder,
      orderId,
      amounts,
      deadline,
    })

    const signature = nacl.sign.detached(message, keypair.secretKey)
    expect(signature.length).toBe(64)

    // Detached verify
    const isValid = nacl.sign.detached.verify(message, signature, keypair.publicKey)
    expect(isValid).toBe(true)

    // Base58 roundtrip
    const bs58Sig = bs58.encode(signature)
    const decoded = bs58.decode(bs58Sig)
    expect(decoded).toEqual(signature)

    // Modified message fails verification
    const tampered = Buffer.from(message)
    tampered[179] = 0xff
    expect(nacl.sign.detached.verify(tampered, signature, keypair.publicKey)).toBe(false)
  })

  it('enforces 4-decimal Solana pricing and calculates accurate whole-unit shortfalls', () => {
    const itemCost: EsmsCost = {
      spirit: 5,
      essence: 2,
      matter: 0,
      substance: 1,
    }

    const solanaAmounts = costToSolanaAmounts(itemCost)
    expect(solanaAmounts).toEqual([50_000n, 20_000n, 0n, 10_000n])

    // Sufficient balances (e.g. 10 Spirit, 5 Essence, 0 Matter, 2 Substance)
    const sufficientBalances: readonly [bigint, bigint, bigint, bigint] = [
      100_000n,
      50_000n,
      0n,
      20_000n,
    ]
    expect(canAffordSolana(sufficientBalances, itemCost)).toBe(true)

    // Insufficient balances (e.g. 3 Spirit, 1 Essence, 0 Matter, 0 Substance)
    const insufficientBalances: readonly [bigint, bigint, bigint, bigint] = [
      30_000n,
      10_000n,
      0n,
      0n,
    ]
    expect(canAffordSolana(insufficientBalances, itemCost)).toBe(false)

    const shortfall = solanaShortfall(insufficientBalances, itemCost)
    expect(shortfall).toEqual({
      spirit: 2, // 5 - 3 = 2
      essence: 1, // 2 - 1 = 1
      matter: 0,
      substance: 1, // 1 - 0 = 1
    })
  })

  it('guarantees Ed25519 instruction sits at exactly current_index - 1 before RedeemForEsms', async () => {
    const keypair = nacl.sign.keyPair()
    const holder = new PublicKey(keypair.publicKey)
    const sponsorKeypair = nacl.sign.keyPair()
    const sponsor = new PublicKey(sponsorKeypair.publicKey)

    const dummyWallet: AsolSolanaWallet = {
      publicKey: sponsor,
      signTransaction: async tx => tx,
      signAllTransactions: async txs => txs,
    }

    const client = new AsolSolanaClient({
      wallet: dummyWallet,
    })

    const signature = nacl.sign.detached(
      buildRedeemAuthorizationMessage({
        programId: client.programId,
        clusterDomain,
        holder,
        orderId,
        amounts,
        deadline,
      }),
      keypair.secretKey
    )

    // 1. Build instruction pair [ed25519, redeem]
    const redeemPair = await client.buildRedeemForEsmsInstructions({
      orderId,
      amounts,
      holder,
      holderSignature: signature,
      clusterDomain,
      deadline,
      sponsor,
    })

    expect(redeemPair.length).toBe(2)
    expect(redeemPair[0].programId.equals(Ed25519Program.programId)).toBe(true)
    expect(redeemPair[1].programId.equals(client.programId)).toBe(true)

    // 2. Build ATA instructions
    const ataIxs = client.buildEnsureAtaInstructions(holder, sponsor)
    expect(ataIxs.length).toBe(4)

    // 3. Assemble full transaction payload
    const allInstructions = [...ataIxs, ...redeemPair]

    // 4. Inject compute budget instructions
    const budgetedInstructions = injectComputeBudgetInstructions(allInstructions, {
      units: 250_000,
      microLamports: 1_000n,
    })

    // Budget instructions prepended at index 0 and 1
    expect(budgetedInstructions.length).toBe(2 + 4 + 2) // 2 compute budget + 4 ATA + 1 ed25519 + 1 redeem = 8

    const ed25519Index = budgetedInstructions.findIndex(ix =>
      ix.programId.equals(Ed25519Program.programId)
    )
    const redeemIndex = budgetedInstructions.findIndex(ix => ix.programId.equals(client.programId))

    // Strict adjacency check for Anchor sysvar instruction loader:
    expect(ed25519Index).toBe(6)
    expect(redeemIndex).toBe(7)
    expect(ed25519Index).toBe(redeemIndex - 1)
  })
})
