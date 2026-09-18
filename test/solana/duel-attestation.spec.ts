import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import realSatsFixture from './fixtures/spacetimedb-pillar-duel.json'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/security/desktop-auth', () => ({
  extractDesktopApiKey: vi.fn(),
  authenticateDesktopApiKey: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    users: { findUnique: vi.fn() },
    verifiedSolanaWallet: { findUnique: vi.fn() },
    tokenTransaction: { count: vi.fn(), create: vi.fn() },
    duelRewardClaim: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('@/lib/spacetime', () => ({
  getSpacetimeConfig: vi.fn(() => ({
    uri: 'http://localhost:3000',
    moduleName: 'cookingwithcastrollc',
  })),
}))
vi.mock('@/lib/solana/solana-minter', () => ({
  mintEsmsClaimSolana: vi.fn(),
  getSolanaClaimSettlementProof: vi.fn(async () => ({ settled: false })),
  toSolanaOnchainAmounts: vi.fn((amounts: any) => [1000n, 1000n, 1000n, 1000n]),
}))

import { handleDuelAttestation } from '@/lib/solana/duel-attestation-handler'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractDesktopApiKey, authenticateDesktopApiKey } from '@/lib/security/desktop-auth'
import {
  mintEsmsClaimSolana,
  getSolanaClaimSettlementProof,
  toSolanaOnchainAmounts,
} from '@/lib/solana/solana-minter'
import {
  computeDuelReceiptId,
  computeDuelLedgerReference,
  resolvePillarId,
} from '@/lib/solana/duel-attestation'
import { poolUnitsToAtoms, atomsToPoolUnits, ESMS_ATOMS_PER_POOL_UNIT } from '@/lib/solana/esms'
import { decodeSqlResult } from '@/lib/vessel/spacetime-stats'

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/solana/duel-attestation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const CALLER_PUBKEY = '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp'
const INITIATOR_HEX = '0'.repeat(63) + '1'
const TARGET_HEX = '0'.repeat(63) + '2'

function mockResolvedDuel(overrides: Record<string, any> = {}) {
  return [
    {
      duel_id: 42,
      initiator: INITIATOR_HEX,
      target_player: TARGET_HEX,
      target_agent: null,
      sky: 'Diurnal',
      opening_pillar: 1,
      opening_power_ratio: 1.0,
      state: 'Resolved',
      winner_is_initiator: true,
      created_at: 1710000000000000,
      updated_at: 1710000005000000,
      ...overrides,
    },
  ]
}

function mockTransport(duelRows: any[], wallet = CALLER_PUBKEY) {
  return vi.fn(async (url: string, opts: any) => {
    const body = opts?.body as string
    if (body.includes('FROM pillar_duel')) {
      return { ok: true, json: async () => [{ rows: duelRows }] }
    }
    if (body.includes('FROM verified_solana_wallet')) {
      return { ok: true, json: async () => [{ rows: [{ solana_pubkey: wallet }] }] }
    }
    throw new Error(`Unexpected query: ${body}`)
  }) as any
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SPACETIMEDB_IDENTITY = 'a'.repeat(64)
  ;(auth as any).mockResolvedValue({ user: { id: 'user-123' } })
  ;(extractDesktopApiKey as any).mockReturnValue(null)
  ;(prisma.verifiedSolanaWallet.findUnique as any).mockResolvedValue({
    solanaPubKey: CALLER_PUBKEY,
  })
  ;(prisma.tokenTransaction.count as any).mockResolvedValue(0)
  ;(prisma.duelRewardClaim.count as any).mockResolvedValue(0)
  ;(prisma.duelRewardClaim.create as any).mockResolvedValue({ id: 'claim-1', state: 'pending' })
  ;(prisma.duelRewardClaim.update as any).mockResolvedValue({ id: 'claim-1', state: 'settled' })
  ;(prisma.duelRewardClaim.findUnique as any).mockResolvedValue(null)
  ;(mintEsmsClaimSolana as any).mockResolvedValue('5MockTxHashPillarDuelWin1111111111111111111')
  ;(getSolanaClaimSettlementProof as any).mockResolvedValue({ settled: false })
})

describe('14-Pillars Pool Unit Conversion Math (Section A1 & F1)', () => {
  it('converts pool units to Token-2022 atoms (1 unit = 1000 atoms)', () => {
    expect(poolUnitsToAtoms(0)).toEqual({ atoms: 0n, dustUnits: 0 })
    expect(poolUnitsToAtoms(1)).toEqual({ atoms: 1000n, dustUnits: 0 })
    expect(poolUnitsToAtoms(1.5)).toEqual({ atoms: 1500n, dustUnits: 0 })
    expect(poolUnitsToAtoms(23.45)).toEqual({ atoms: 23450n, dustUnits: 0 })
    expect(poolUnitsToAtoms(1.2345)).toEqual({ atoms: 1234n, dustUnits: 0.0005 })
  })

  it('converts Token-2022 atoms to integer pool units according to golden table', () => {
    expect(atomsToPoolUnits(0n)).toBe(0)
    expect(atomsToPoolUnits(1n)).toBe(0)
    expect(atomsToPoolUnits(999n)).toBe(0)
    expect(atomsToPoolUnits(1000n)).toBe(1)
    expect(atomsToPoolUnits(10000n)).toBe(10)
    expect(atomsToPoolUnits(23456n)).toBe(23)
    expect(ESMS_ATOMS_PER_POOL_UNIT).toBe(1000n)
  })
})

describe('Duel Receipt Idempotency & Stability (Section A2)', () => {
  it('produces deterministic 32-byte receipt id for identical inputs', () => {
    const id1 = computeDuelReceiptId('0'.repeat(64), 42n, 1710000000000000n)
    const id2 = computeDuelReceiptId('0'.repeat(64), 42n, 1710000000000000n)
    expect(id1).toEqual(id2)
    expect(id1.length).toBe(32)
  })

  it('republish stability: changes receipt id when created_at changes', () => {
    const id1 = computeDuelReceiptId('0'.repeat(64), 42n, 1710000000000000n)
    const id2 = computeDuelReceiptId('0'.repeat(64), 42n, 1710000099999999n)
    expect(id1).not.toEqual(id2)
  })

  it('computes 32-byte ledgerReferenceHash covering duel parameters', () => {
    const receiptId = computeDuelReceiptId('0'.repeat(64), 42n, 1710000000000000n)
    const hash = computeDuelLedgerReference({
      receiptId,
      winnerWallet: CALLER_PUBKEY,
      opponentIdentity: TARGET_HEX,
      openingPillar: 1,
      powerRatioBps: 12500,
      resolvedAtMicros: 1710000005000000n,
    })
    expect(hash.length).toBe(32)
  })
})

describe('POST /api/solana/duel-attestation Rejection Gates (Section A5)', () => {
  it('401 when anonymous / unauthenticated', async () => {
    ;(auth as any).mockResolvedValue(null)
    const res = await handleDuelAttestation(req({ duelId: '42' }))
    expect(res.status).toBe(401)
  })

  it('401 on unlinked desktop API token', async () => {
    ;(extractDesktopApiKey as any).mockReturnValue('unlinked-token')
    ;(authenticateDesktopApiKey as any).mockResolvedValue({ status: 'invalid' })
    const res = await handleDuelAttestation(req({ duelId: '42' }))
    expect(res.status).toBe(401)
  })

  it('400 when extra body fields are present (prevents signing oracle)', async () => {
    const res = await handleDuelAttestation(
      req({ duelId: '42', winner: 'a', transferredUnits: 100 })
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Extra body fields rejected/)
  })

  it('400 when duelId is missing or non-decimal', async () => {
    expect((await handleDuelAttestation(req({}))).status).toBe(400)
    expect((await handleDuelAttestation(req({ duelId: 'abc' }))).status).toBe(400)
    expect((await handleDuelAttestation(req({ duelId: -5 }))).status).toBe(400)
  })

  it('403 when caller has no verified Solana wallet linked', async () => {
    ;(prisma.verifiedSolanaWallet.findUnique as any).mockResolvedValue(null)
    const res = await handleDuelAttestation(req({ duelId: '42' }))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('no_wallet')
  })

  it('503 when SpacetimeDB is unreachable or paused', async () => {
    const failingTransport = vi.fn(async () => {
      throw new Error('HTTP 503 database is paused')
    })
    const res = await handleDuelAttestation(req({ duelId: '42' }), failingTransport)
    expect(res.status).toBe(503)
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })

  it('503 when SPACETIMEDB_IDENTITY is missing or invalid hex (F3)', async () => {
    delete process.env.SPACETIMEDB_IDENTITY
    const transport = mockTransport(mockResolvedDuel())
    const res1 = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res1.status).toBe(503)
    expect((await res1.json()).code).toBe('arena_misconfigured')

    process.env.SPACETIMEDB_IDENTITY = 'not-a-hex-string'
    const res2 = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res2.status).toBe(503)
    expect((await res2.json()).code).toBe('arena_misconfigured')
  })

  it('409 when duel is not yet resolved (even if winner flag set)', async () => {
    const transport = mockTransport(mockResolvedDuel({ state: 'Open', winner_is_initiator: true }))
    const res = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res.status).toBe(409)
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })

  it('409 when winner is not yet determined', async () => {
    const transport = mockTransport(
      mockResolvedDuel({ state: 'Resolved', winner_is_initiator: null })
    )
    const res = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res.status).toBe(409)
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })

  it('422 when duel was against an autonomous agent (target_agent set)', async () => {
    const transport = mockTransport(mockResolvedDuel({ target_agent: 'Mars', target_player: null }))
    const res = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('agent_duel_not_eligible')
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })

  it('403 when caller is not the verified winner of the duel', async () => {
    // Initiator won, but winner wallet is different from caller wallet
    const transport = vi.fn(async (url: string, opts: any) => {
      const body = opts.body as string
      if (body.includes('FROM pillar_duel')) {
        return { ok: true, json: async () => [{ rows: mockResolvedDuel() }] }
      }
      return {
        ok: true,
        json: async () => [
          { rows: [{ solana_pubkey: 'DifferentWalletPubkey11111111111111111111' }] },
        ],
      }
    }) as any

    const res = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('caller_not_winner')
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })
})

describe('POST /api/solana/duel-attestation Verification & Receipt Derivation', () => {
  it('verifies PvP duel win and returns canonical receipt without minting on-chain ESMS', async () => {
    const transport = mockTransport(mockResolvedDuel())
    const res = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.verified).toBe(true)
    expect(data.receiptId).toBeDefined()
    expect(data.receiptAddress).toBeDefined()
    expect(data.ledgerReferenceHash).toBeDefined()
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })

  it('real-SATS fixture decodes pillar/state/options/timestamps and maps opening_pillar variant Distillation to 4 (F7)', async () => {
    const decoded = decodeSqlResult(realSatsFixture)
    expect(decoded.length).toBe(1)
    const row = decoded[0]

    expect(row.duel_id).toBe(42)
    expect(row.sky).toBe('Diurnal')
    expect(row.state).toBe('Resolved')
    expect(row.winner_is_initiator).toBe(true)
    expect(row.target_agent).toBeNull()
    expect(typeof row.target_player).toBe('string')
    expect(row.opening_pillar).toBe('Distillation')

    // resolvePillarId correctly maps variant name 'Distillation' to 4
    expect(resolvePillarId(row.opening_pillar)).toBe(4)

    // Execute route against the decoded fixture
    const transport = vi.fn(async (url: string, opts: any) => {
      const body = opts.body as string
      if (body.includes('FROM pillar_duel')) {
        return { ok: true, json: async () => realSatsFixture }
      }
      return {
        ok: true,
        json: async () => [{ rows: [{ solana_pubkey: CALLER_PUBKEY }] }],
      }
    }) as any

    const res = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    const duelReceiptId = computeDuelReceiptId('a'.repeat(64), 42n, 1710000000000000n)
    const expectedLedgerRef = computeDuelLedgerReference({
      receiptId: duelReceiptId,
      winnerWallet: CALLER_PUBKEY,
      opponentIdentity: '202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f',
      openingPillar: 4,
      powerRatioBps: 12500,
      resolvedAtMicros: 1710000005000000n,
    })
    expect(data.ledgerReferenceHash).toBe(Buffer.from(expectedLedgerRef).toString('hex'))
  })
})
