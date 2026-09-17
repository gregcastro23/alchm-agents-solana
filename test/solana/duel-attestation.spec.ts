import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicKey } from '@solana/web3.js'

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
}))

import { handleDuelAttestation } from '@/app/api/solana/duel-attestation/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractDesktopApiKey, authenticateDesktopApiKey } from '@/lib/security/desktop-auth'
import { mintEsmsClaimSolana, getSolanaClaimSettlementProof } from '@/lib/solana/solana-minter'
import {
  computeDuelReceiptId,
  computeDuelLedgerReference,
  DUEL_WIN_REWARD,
  DUEL_WIN_DAILY_CAP,
} from '@/lib/solana/duel-attestation'
import { poolUnitsToAtoms, atomsToPoolUnits, ESMS_ATOMS_PER_POOL_UNIT } from '@/lib/solana/esms'

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/solana/duel-attestation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

const CALLER_ID = 'user-123'
const CALLER_PUBKEY = '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp'
const INITIATOR_HEX = '1111111111111111111111111111111111111111111111111111111111111111'
const TARGET_HEX = '2222222222222222222222222222222222222222222222222222222222222222'

function mockResolvedDuel(overrides: Record<string, any> = {}) {
  return [
    {
      duel_id: '42',
      initiator: INITIATOR_HEX,
      target_player: TARGET_HEX,
      target_agent: null,
      sky: 'diurnal',
      opening_pillar: 1,
      opening_power_ratio: 1.25,
      state: 'Resolved',
      winner_is_initiator: true,
      created_at: 1710000000000000n,
      updated_at: 1710000005000000n,
      ...overrides,
    },
  ]
}

function mockTransport(rows: any[], status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (status === 200 ? '' : 'Error'),
    json: async () => [{ rows }],
  })) as any
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(auth as any).mockResolvedValue({ user: { id: CALLER_ID } })
  ;(extractDesktopApiKey as any).mockReturnValue(null)
  ;(prisma.users.findUnique as any).mockResolvedValue({ id: CALLER_ID })
  ;(prisma.verifiedSolanaWallet.findUnique as any).mockResolvedValue({
    solanaPubKey: CALLER_PUBKEY,
  })
  ;(prisma.tokenTransaction.count as any).mockResolvedValue(0)
  ;(prisma.tokenTransaction.create as any).mockResolvedValue({})
  ;(getSolanaClaimSettlementProof as any).mockResolvedValue({ settled: false })
  ;(mintEsmsClaimSolana as any).mockResolvedValue('5MockTxHashPillarDuelWin1111111111111111111')
})

describe('Unit Scale & Golden Table Parity (Workstream A / Phase 1 Option 1)', () => {
  it('converts pool units to atoms with explicit flooring and dust remainder', () => {
    expect(poolUnitsToAtoms(23.456)).toEqual({ atoms: 23456n, dustUnits: 0 })
    expect(poolUnitsToAtoms(80)).toEqual({ atoms: 80000n, dustUnits: 0 })
    expect(poolUnitsToAtoms(0.001)).toEqual({ atoms: 1n, dustUnits: 0 })
    expect(poolUnitsToAtoms(0.0005)).toEqual({ atoms: 0n, dustUnits: 0.0005 })
    expect(() => poolUnitsToAtoms(-1)).toThrow(RangeError)
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
    expect((await res.json()).code).toBe('agent_duel_not_rewarded')
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })

  it('403 when caller is not the verified winner of the duel', async () => {
    // Initiator won, but winner wallet is different from caller wallet
    let queryCount = 0
    const transport = vi.fn(async (url: string, opts: any) => {
      queryCount++
      const body = opts.body as string
      if (body.includes('FROM pillar_duel')) {
        return { ok: true, json: async () => [{ rows: mockResolvedDuel() }] }
      }
      // verified_solana_wallet returns different wallet
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

describe('POST /api/solana/duel-attestation Execution & Settlement (Section A3)', () => {
  it('mints ESMS reward on-chain for verified PvP duel win', async () => {
    const transport = vi.fn(async (url: string, opts: any) => {
      const body = opts.body as string
      if (body.includes('FROM pillar_duel')) {
        return { ok: true, json: async () => [{ rows: mockResolvedDuel() }] }
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
    expect(data.settled).toBe(true)
    expect(data.txHash).toBe('5MockTxHashPillarDuelWin1111111111111111111')
    expect(data.receiptId).toBeDefined()
    expect(data.receiptAddress).toBeDefined()
    expect(mintEsmsClaimSolana).toHaveBeenCalledTimes(1)
  })

  it('idempotently returns already-settled receipt without minting again', async () => {
    ;(getSolanaClaimSettlementProof as any).mockResolvedValue({
      settled: true,
      txHash: '5ExistingSettledTxHash1111111111111111111111',
    })

    const transport = vi.fn(async (url: string, opts: any) => {
      const body = opts.body as string
      if (body.includes('FROM pillar_duel')) {
        return { ok: true, json: async () => [{ rows: mockResolvedDuel() }] }
      }
      return {
        ok: true,
        json: async () => [{ rows: [{ solana_pubkey: CALLER_PUBKEY }] }],
      }
    }) as any

    const res = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.settled).toBe(true)
    expect(data.txHash).toBe('5ExistingSettledTxHash1111111111111111111111')
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })

  it('enforces daily cap: rejects (N+1)th win with 429', async () => {
    ;(prisma.tokenTransaction.count as any).mockResolvedValue(DUEL_WIN_DAILY_CAP)

    const transport = vi.fn(async (url: string, opts: any) => {
      const body = opts.body as string
      if (body.includes('FROM pillar_duel')) {
        return { ok: true, json: async () => [{ rows: mockResolvedDuel() }] }
      }
      return {
        ok: true,
        json: async () => [{ rows: [{ solana_pubkey: CALLER_PUBKEY }] }],
      }
    }) as any

    const res = await handleDuelAttestation(req({ duelId: '42' }), transport)
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.code).toBe('daily_cap_reached')
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })
})
