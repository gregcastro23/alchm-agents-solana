import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    users: { findUnique: vi.fn() },
    esms_claims: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/alchm-debit-sync', () => ({ syncDebitToAlchm: vi.fn() }))
vi.mock('@/lib/esms-chain/minter', () => ({ mintEsmsClaim: vi.fn() }))
vi.mock('@/lib/esms-chain/contract', () => ({ readEsmsClaimed: vi.fn() }))
vi.mock('@/lib/solana/solana-minter', () => ({
  mintEsmsClaimSolana: vi.fn(),
  getSolanaClaimSettlementProof: vi.fn(async () => ({ settled: false })),
  toSolanaOnchainAmounts: vi.fn((amounts: any) => [
    BigInt(Math.floor(Number(amounts.spirit || 0) * 10000)),
    BigInt(Math.floor(Number(amounts.essence || 0) * 10000)),
    BigInt(Math.floor(Number(amounts.matter || 0) * 10000)),
    BigInt(Math.floor(Number(amounts.substance || 0) * 10000)),
  ]),
  isSolanaConfigured: vi.fn(() => true),
}))

import { POST } from '@/app/api/esms/claim/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { syncDebitToAlchm } from '@/lib/alchm-debit-sync'
import { mintEsmsClaim } from '@/lib/esms-chain/minter'
import { mintEsmsClaimSolana, getSolanaClaimSettlementProof } from '@/lib/solana/solana-minter'
import { readEsmsClaimed } from '@/lib/esms-chain/contract'

const req = (body: unknown) =>
  new Request('http://localhost/api/esms/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any

const authed = () => (auth as any).mockResolvedValue({ user: { id: 'u1', email: 'a@b.com' } })

beforeEach(() => {
  vi.clearAllMocks()
  ;(prisma.esms_claims.create as any).mockResolvedValue({})
  ;(prisma.esms_claims.update as any).mockResolvedValue({})
  ;(prisma.esms_claims.findUnique as any).mockResolvedValue(null)
  ;(readEsmsClaimed as any).mockResolvedValue(false)
  ;(mintEsmsClaim as any).mockResolvedValue('0xhash')
  ;(mintEsmsClaimSolana as any).mockResolvedValue('0xhash')
})

describe('POST /api/esms/claim', () => {
  it('401 when unauthenticated', async () => {
    ;(auth as any).mockResolvedValue(null)
    expect((await POST(req({ amounts: { spirit: 1 } }))).status).toBe(401)
  })

  it('400 when no wallet linked', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: null })
    expect((await POST(req({ amounts: { spirit: 1 } }))).status).toBe(400)
    expect(syncDebitToAlchm).not.toHaveBeenCalled()
  })

  it('400 when nothing to claim', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: '0xabc' })
    expect((await POST(req({ amounts: { spirit: 0 } }))).status).toBe(400)
    expect(syncDebitToAlchm).not.toHaveBeenCalled()
  })

  it('402 on insufficient funds; mint NOT called', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: '0xabc' })
    ;(syncDebitToAlchm as any).mockResolvedValue({ ok: false, reason: 'insufficient_funds' })
    expect((await POST(req({ amounts: { spirit: 5 } }))).status).toBe(402)
    expect(mintEsmsClaimSolana).not.toHaveBeenCalled()
  })

  it('debits BEFORE minting and returns txHash on success', async () => {
    const order: string[] = []
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: '0xabc' })
    ;(syncDebitToAlchm as any).mockImplementation(async () => {
      order.push('debit')
      return { ok: true }
    })
    ;(mintEsmsClaimSolana as any).mockImplementation(async () => {
      order.push('mint')
      return '0xhash'
    })
    const res = await POST(req({ amounts: { spirit: 2, essence: 1 } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, txHash: '0xhash' })
    expect(order).toEqual(['debit', 'mint'])
  })

  it('502 retryable when mint fails after a successful debit', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: '0xabc' })
    ;(syncDebitToAlchm as any).mockResolvedValue({ ok: true })
    ;(mintEsmsClaimSolana as any).mockRejectedValue(new Error('rpc down'))
    const res = await POST(req({ amounts: { spirit: 2 } }))
    expect(res.status).toBe(502)
    expect((await res.json()).retryable).toBe(true)
  })

  it('treats already_applied (idempotent debit) as success and proceeds to mint', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: '0xabc' })
    ;(syncDebitToAlchm as any).mockResolvedValue({ ok: true, reason: 'already_applied' })
    ;(mintEsmsClaimSolana as any).mockResolvedValue('0xhash')
    expect((await POST(req({ amounts: { spirit: 2 } }))).status).toBe(200)
    expect(mintEsmsClaimSolana).toHaveBeenCalledTimes(1)
  })

  it('retries a debited claim without debiting again', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: '0xabc' })
    ;(prisma.esms_claims.findUnique as any).mockResolvedValue({
      id: `0x${'a'.repeat(64)}`,
      userId: 'u1',
      walletAddress: '0xabc',
      spirit: 2,
      essence: 1,
      matter: 0,
      substance: 0,
      status: 'debited',
      network: 'base-sepolia',
      txHash: null,
    })
    ;(mintEsmsClaim as any).mockResolvedValue('0xretry')

    const res = await POST(req({ claimId: `0x${'a'.repeat(64)}` }))

    expect(res.status).toBe(200)
    expect(syncDebitToAlchm).not.toHaveBeenCalled()
    expect(mintEsmsClaim).toHaveBeenCalledTimes(1)
    expect(await res.json()).toMatchObject({ txHash: '0xretry' })
  })

  it('returns an already minted claim idempotently', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: '0xabc' })
    ;(prisma.esms_claims.findUnique as any).mockResolvedValue({
      id: `0x${'b'.repeat(64)}`,
      userId: 'u1',
      status: 'minted',
      txHash: '0xexisting',
    })

    const res = await POST(req({ claimId: `0x${'b'.repeat(64)}` }))

    expect(res.status).toBe(200)
    expect(syncDebitToAlchm).not.toHaveBeenCalled()
    expect(mintEsmsClaim).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({ txHash: '0xexisting' })
  })

  it('reconciles a claim that minted before the database status update failed', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({ walletAddress: '0xabc' })
    ;(syncDebitToAlchm as any).mockResolvedValue({ ok: true })
    ;(mintEsmsClaimSolana as any).mockRejectedValue(new Error('already processed'))
    ;(getSolanaClaimSettlementProof as any).mockResolvedValue({
      settled: true,
      txHash: '0xreconciledHash',
    })

    const res = await POST(req({ amounts: { spirit: 2 } }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, txHash: '0xreconciledHash' })
  })

  it('reconciles a Solana claim with recovered signature from SettlementProof', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({
      walletAddress: '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp',
    })
    ;(syncDebitToAlchm as any).mockResolvedValue({ ok: true })
    ;(mintEsmsClaimSolana as any).mockRejectedValue(new Error('timeout'))
    ;(getSolanaClaimSettlementProof as any).mockResolvedValue({
      settled: true,
      txHash: '5K2bMhZMockSignatureRecovered',
    })

    const res = await POST(req({ amounts: { spirit: 2 } }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, txHash: '5K2bMhZMockSignatureRecovered' })
    expect(prisma.esms_claims.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'minted',
          txHash: '5K2bMhZMockSignatureRecovered',
        }),
      })
    )
  })

  it('400 when Solana amounts round down to zero atoms (dust guard)', async () => {
    authed()
    ;(prisma.users.findUnique as any).mockResolvedValue({
      walletAddress: '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp',
    })
    const res = await POST(req({ amounts: { spirit: 0.00001 } }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'zero_onchain_atoms' })
    expect(syncDebitToAlchm).not.toHaveBeenCalled()
  })
})
