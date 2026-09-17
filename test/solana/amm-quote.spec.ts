import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicKey } from '@solana/web3.js'

const mockGetAccountInfoAndContext = vi.fn()
const mockSimulateTransaction = vi.fn()

vi.mock('@solana/web3.js', async importOriginal => {
  const actual = await importOriginal<typeof import('@solana/web3.js')>()
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getAccountInfoAndContext: mockGetAccountInfoAndContext,
      simulateTransaction: mockSimulateTransaction,
    })),
  }
})

let mockPoolState = {
  version: 1,
  poolId: 0,
  elementA: 0,
  elementB: 1,
  feeBps: 30,
  reserveA: 1_000_000n,
  reserveB: 2_000_000n,
  totalShares: 1_414_213n,
  bootstrapped: true,
  paused: false,
  bump: 255,
}

vi.mock('@/lib/solana/constellation-amm', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/solana/constellation-amm')>()
  return {
    ...actual,
    decodeConstellationPool: vi.fn(() => mockPoolState),
  }
})

import { GET, clearAmmQuotePoolCache } from '@/app/api/solana/amm-quote/route'

const req = (params: string) =>
  new Request(`http://localhost/api/solana/amm-quote?${params}`, { method: 'GET' })

beforeEach(() => {
  vi.clearAllMocks()
  clearAmmQuotePoolCache()
  mockPoolState = {
    version: 1,
    poolId: 0,
    elementA: 0,
    elementB: 1,
    feeBps: 30,
    reserveA: 1_000_000n,
    reserveB: 2_000_000n,
    totalShares: 1_414_213n,
    bootstrapped: true,
    paused: false,
    bump: 255,
  }
  mockGetAccountInfoAndContext.mockResolvedValue({
    context: { slot: 123456 },
    value: { data: Buffer.alloc(100) },
  })
  mockSimulateTransaction.mockResolvedValue({
    context: { slot: 123456 },
    value: {
      err: null,
      logs: [
        'Program 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD invoke [1]',
        'Program log: Instruction: SwapEsms',
        'Program 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD success',
      ],
      unitsConsumed: 38450,
    },
  })
})

describe('GET /api/solana/amm-quote', () => {
  it('400 when missing required query parameters', async () => {
    expect((await GET(req(''))).status).toBe(400)
    expect((await GET(req('poolId=0&inElement=0'))).status).toBe(400)
  })

  it('400 on out-of-range poolId or invalid inElement', async () => {
    expect((await GET(req('poolId=9&inElement=0&inAmountAtoms=1000'))).status).toBe(400)
    expect((await GET(req('poolId=0&inElement=9&inAmountAtoms=1000'))).status).toBe(400)
    expect((await GET(req('poolId=0&inElement=0&inAmountAtoms=-5'))).status).toBe(400)
  })

  it('400 when inElement is not part of the pool pair', async () => {
    // Pool 0 is Spirit(0) - Essence(1). Matter(2) is not part of pool 0.
    const res = await GET(req('poolId=0&inElement=2&inAmountAtoms=10000'))
    expect(res.status).toBe(400)
  })

  it('404 when pool account not found on-chain', async () => {
    mockGetAccountInfoAndContext.mockResolvedValue({ context: { slot: 100 }, value: null })
    const res = await GET(req('poolId=0&inElement=0&inAmountAtoms=10000'))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('pool_not_found')
  })

  it('409 when pool is paused (F11)', async () => {
    mockPoolState.paused = true
    const res = await GET(req('poolId=0&inElement=0&inAmountAtoms=10000'))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe('pool_paused')
    expect(data.outAtoms).toBeUndefined()
  })

  it('409 when pool is not bootstrapped (F11)', async () => {
    mockPoolState.bootstrapped = false
    const res = await GET(req('poolId=0&inElement=0&inAmountAtoms=10000'))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe('pool_not_bootstrapped')
    expect(data.outAtoms).toBeUndefined()
  })

  it('caches pool account for ~2s avoiding repeated RPC queries (F11)', async () => {
    await GET(req('poolId=0&inElement=0&inAmountAtoms=10000'))
    expect(mockGetAccountInfoAndContext).toHaveBeenCalledTimes(1)

    // Second request within cache window uses memory cache
    await GET(req('poolId=0&inElement=0&inAmountAtoms=20000'))
    expect(mockGetAccountInfoAndContext).toHaveBeenCalledTimes(1)
  })

  it('quotes from on-chain reserves and returns slot without price index dependency', async () => {
    const res = await GET(req('poolId=0&inElement=0&inAmountAtoms=10000&slippageBps=50'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.poolId).toBe(0)
    expect(data.inElement).toBe(0)
    expect(data.outElement).toBe(1)
    expect(data.slot).toBe(123456)
    expect(data.reserves.reserveA).toBe('1000000')
    expect(data.reserves.reserveB).toBe('2000000')
    expect(data.outAtoms).toBeDefined()
    expect(data.minOutAtoms).toBeDefined()
    expect(data.simulation).toBeNull()
  })

  it('returns simulated: false with attestation_required when trader key is supplied without attestation (F2)', async () => {
    const trader = '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp'
    const res = await GET(req(`poolId=0&inElement=0&inAmountAtoms=10000&trader=${trader}`))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.simulation).toEqual({
      simulated: false,
      reason: 'attestation_required',
      err: null,
      logs: null,
      unitsConsumed: null,
    })
  })
})
