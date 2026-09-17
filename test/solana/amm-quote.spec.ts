import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PublicKey } from '@solana/web3.js'

const mockGetAccountInfoAndContext = vi.fn()

vi.mock('@solana/web3.js', async importOriginal => {
  const actual = await importOriginal<typeof import('@solana/web3.js')>()
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getAccountInfoAndContext: mockGetAccountInfoAndContext,
    })),
  }
})

vi.mock('@/lib/solana/constellation-amm', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/solana/constellation-amm')>()
  return {
    ...actual,
    decodeConstellationPool: vi.fn(() => ({
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
    })),
  }
})

import { GET } from '@/app/api/solana/amm-quote/route'

const req = (params: string) =>
  new Request(`http://localhost/api/solana/amm-quote?${params}`, { method: 'GET' })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAccountInfoAndContext.mockResolvedValue({
    context: { slot: 123456 },
    value: { data: Buffer.alloc(100) },
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

  it('provides simulation telemetry when valid trader key is supplied', async () => {
    const trader = '4AfRdxPh1RSo2299QFwutzQkMcL92KJNXAU1bzpNJcHp'
    const res = await GET(req(`poolId=0&inElement=0&inAmountAtoms=10000&trader=${trader}`))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.simulation).toMatchObject({
      simulated: true,
      unitsConsumed: expect.any(Number),
    })
  })
})
