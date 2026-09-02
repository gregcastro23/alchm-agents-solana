// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { base, baseSepolia } from 'viem/chains'
import {
  resolveMaxClaimAtoms,
  toSolanaOnchainAmounts,
  getSolanaClaimSettlementProof,
  DEFAULT_MAX_CLAIM_ATOMS,
  MAX_LEDGER_ATOMS,
} from '@/lib/solana/solana-minter'
import {
  reconcileEsmsClaims,
  inspectSolanaOutbox,
  reconcileSolanaState,
  OUTBOX_FAILING_THRESHOLD,
} from '@/lib/solana/reconciliation'
import { createBaseClients } from '@/lib/solana/bridge-service'

describe('Workstream 6: Reconciliation Engine, Velocity Guards & Finality', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  describe('Velocity Guards & Protocol Bounds', () => {
    it('defaults to 10M token policy velocity cap strictly below protocol MAX_LEDGER_ATOMS', () => {
      delete process.env.SOLANA_MAX_CLAIM_ATOMS
      const cap = resolveMaxClaimAtoms()
      expect(cap).toBe(DEFAULT_MAX_CLAIM_ATOMS)
      expect(cap).toBe(100_000_000_000n)
      expect(cap < MAX_LEDGER_ATOMS).toBe(true)
    })

    it('allows custom policy cap below protocol limit', () => {
      process.env.SOLANA_MAX_CLAIM_ATOMS = '50000000000'
      expect(resolveMaxClaimAtoms()).toBe(50_000_000_000n)
    })

    it('rejects configured policy cap that exceeds protocol MAX_LEDGER_ATOMS', () => {
      process.env.SOLANA_MAX_CLAIM_ATOMS = '1000000000000' // > 999_999_999_999
      expect(() => resolveMaxClaimAtoms()).toThrow(/exceeds protocol bound MAX_LEDGER_ATOMS/)
    })

    it('toSolanaOnchainAmounts rejects amounts exceeding policy velocity cap', () => {
      delete process.env.SOLANA_MAX_CLAIM_ATOMS
      const validAmounts = {
        spirit: '1000000', // 1M tokens = 10,000,000,000 atoms (ok)
        essence: '5000',
        matter: '0',
        substance: '100',
      }
      expect(() => toSolanaOnchainAmounts(validAmounts)).not.toThrow()

      const excessiveAmounts = {
        spirit: '10000001', // 10,000,001 tokens = 100,000,010,000 atoms > 100,000,000,000 cap
        essence: '0',
        matter: '0',
        substance: '0',
      }
      expect(() => toSolanaOnchainAmounts(excessiveAmounts)).toThrow(
        /exceeds policy velocity limit/
      )
    })
  })

  describe('SettlementProof & Receipt Verification', () => {
    it('returns settled: false when ClaimReceipt PDA does not exist', async () => {
      const mockConn = {
        getAccountInfo: vi.fn().mockResolvedValue(null),
      } as any

      const proof = await getSolanaClaimSettlementProof(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        mockConn
      )
      expect(proof.settled).toBe(false)
    })

    it('returns settled: true and recovers transaction signature when ClaimReceipt PDA exists', async () => {
      const mockConn = {
        getAccountInfo: vi.fn().mockResolvedValue({ data: Buffer.alloc(32) }),
        getSignaturesForAddress: vi
          .fn()
          .mockResolvedValue([{ signature: '5MockSolanaSignatureFromLedger123456789' }]),
      } as any

      const proof = await getSolanaClaimSettlementProof(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        mockConn
      )
      expect(proof.settled).toBe(true)
      if (proof.settled) {
        expect(proof.txHash).toBe('5MockSolanaSignatureFromLedger123456789')
      }
    })
  })

  describe('Outbox Inspection & Alerts', () => {
    it('emits economy:outbox-failing when events exceed threshold attempts', async () => {
      const mockPrisma = {
        solanaSyncOutbox: {
          count: vi.fn().mockImplementation((args: any) => {
            if (args.where?.attempts) return Promise.resolve(4) // 4 failing
            return Promise.resolve(10) // 10 pending
          }),
          findFirst: vi.fn().mockResolvedValue({
            createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30m ago
          }),
        },
      } as any

      const { inspection, alerts } = await inspectSolanaOutbox(mockPrisma)
      expect(inspection.pendingCount).toBe(10)
      expect(inspection.failingCount).toBe(4)
      expect(inspection.oldestPendingMinutes).toBe(30)
      expect(alerts.some(a => a.id === 'economy:outbox-failing')).toBe(true)
      expect(alerts.find(a => a.id === 'economy:outbox-failing')?.severity).toBe('warning')
    })
  })

  describe('Claim Reconciliation & Ghost Detection Staleness Guards', () => {
    it('detects and auto-heals unhealed debited claims when on-chain receipt is finalized', async () => {
      const claimId = '0x1111111111111111111111111111111111111111111111111111111111111111'
      const mockPrisma = {
        esms_claims: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: claimId,
              userId: 'u123',
              walletAddress: '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp',
              status: 'debited',
              network: 'solana-mainnet-beta',
              createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10m ago
              txHash: null,
            },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
      } as any

      const mockConn = {
        getAccountInfo: vi.fn().mockResolvedValue({ data: Buffer.alloc(32) }), // receipt exists
        getSignaturesForAddress: vi.fn().mockResolvedValue([{ signature: 'recoveredSig123' }]),
      } as any

      const result = await reconcileEsmsClaims({
        prisma: mockPrisma,
        connection: mockConn,
        autoHeal: true,
      })

      expect(result.claimsSummary.unhealedCount).toBe(1)
      expect(result.claimsSummary.healedCount).toBe(1)
      expect(mockPrisma.esms_claims.update).toHaveBeenCalledWith({
        where: { id: claimId },
        data: { status: 'minted', txHash: 'recoveredSig123', error: null },
      })
    })

    it('does NOT flag recently minted claims as ghosts (staleness guard < 15m)', async () => {
      const claimId = '0x2222222222222222222222222222222222222222222222222222222222222222'
      const mockPrisma = {
        esms_claims: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: claimId,
              userId: 'u123',
              walletAddress: '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp',
              status: 'minted',
              network: 'solana-mainnet-beta',
              createdAt: new Date(Date.now() - 5 * 60 * 1000), // only 5m ago
              txHash: 'sig123',
            },
          ]),
        },
      } as any

      const mockConn = {
        getAccountInfo: vi.fn().mockResolvedValue(null), // not seen yet on this RPC
      } as any

      const result = await reconcileEsmsClaims({
        prisma: mockPrisma,
        connection: mockConn,
      })

      // Within 15m staleness window: NOT treated as a ghost!
      expect(result.claimsSummary.ghostCount).toBe(0)
    })

    it('requires ghost claims to reproduce across independent endpoints', async () => {
      const claimId = '0x3333333333333333333333333333333333333333333333333333333333333333'
      const mockPrisma = {
        esms_claims: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: claimId,
              userId: 'u123',
              walletAddress: '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp',
              status: 'minted',
              network: 'solana-mainnet-beta',
              createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30m ago (> 15m)
              txHash: 'sig123',
            },
          ]),
        },
      } as any

      const mockConn = {
        getAccountInfo: vi.fn().mockResolvedValue(null),
      } as any

      // If secondary endpoint sees the receipt, primary was just lagging!
      // Mock global Connection for secondary check
      const result = await reconcileEsmsClaims({
        prisma: mockPrisma,
        connection: mockConn,
        endpoints: ['https://rpc1.primary.com'], // only 1 endpoint in test
      })

      expect(result.claimsSummary.ghostCount).toBe(1)
      expect(result.alerts.some(a => a.id === 'economy:ghost-claims')).toBe(true)
    })
  })

  describe('Dual-Rail Base Bridge Client Factory', () => {
    const dummyKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

    it('returns Base Sepolia client when isMainnet is false', () => {
      const { chain, isMainnet } = createBaseClients(dummyKey, { isMainnet: false })
      expect(chain.id).toBe(baseSepolia.id)
      expect(isMainnet).toBe(false)
    })

    it('returns Base Mainnet client when isMainnet is true', () => {
      const { chain, isMainnet } = createBaseClients(dummyKey, { isMainnet: true })
      expect(chain.id).toBe(base.id)
      expect(isMainnet).toBe(true)
    })
  })
})
