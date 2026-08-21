// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/economy/price-index/route'

const CANONICAL_PAYLOAD = {
  success: true,
  live: true,
  generatedAt: '2026-08-21T20:37:49.409Z',
  bucketStartUtc: '2026-08-21T20:37:00.000Z',
  aNumber: 5.6568,
  multiplier: 0.97,
  dominantElement: 'Fire',
  sunSign: 'leo',
  isDiurnal: true,
  tokens: [
    {
      token: 'Spirit',
      index: 0.9025,
      change24hPct: -2.47,
      weight: 0.5281,
      sparkline: [0.9254, 0.9025],
    },
    {
      token: 'Essence',
      index: 0.934,
      change24hPct: -2.7,
      weight: 0.3981,
      sparkline: [0.9599, 0.934],
    },
    {
      token: 'Matter',
      index: 1.0135,
      change24hPct: -2.19,
      weight: 0.0705,
      sparkline: [1.0362, 1.0135],
    },
    {
      token: 'Substance',
      index: 1.0298,
      change24hPct: -2.15,
      weight: 0.0033,
      sparkline: [1.0524, 1.0298],
    },
  ],
  compositeIndex: 0.97,
  composite24hPct: -2.37,
  degraded: null,
  basis: {
    model: 'ADR-011 elemental-exchange-index v1',
    engine: 'astronomy-engine (local)',
    constants: 'imported from src/lib/economy/livePricing.ts',
  },
  railsUsd: {
    mintPerTokenUsd: 0.025,
    mintSource: 'mcp_top_up_5',
    redeemPerTokenUsd: 0.01,
    redeemSource: 'NEXT_PUBLIC_ESMS_RESTAURANT_CENTS_PER_TOKEN',
  },
  supply: {
    live: true,
    spirit: 12526.1519,
    essence: 15820.0185,
    matter: 25380.4355,
    substance: 19952.9073,
  },
} as const

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('canonical ESMS price-index adapter', () => {
  it('serves the Kitchen oracle payload unchanged so both sites quote one index', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(CANONICAL_PAYLOAD), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(CANONICAL_PAYLOAD)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://alchm.kitchen/api/economy/price-index'
    )
  })

  it('fails closed without quotes when the canonical oracle is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: false, live: false }), { status: 503 })
        )
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.success).toBe(false)
    expect(body.live).toBe(false)
    expect(body.tokens).toBeUndefined()
  })
})
