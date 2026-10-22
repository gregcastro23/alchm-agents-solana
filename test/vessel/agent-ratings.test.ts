import { describe, expect, it, mock } from 'bun:test'
import path from 'path'

mock.module('server-only', () => ({}))

// Prevent any network fetch from stalling tests
const originalFetch = globalThis.fetch
globalThis.fetch = async () => {
  throw new Error('network disabled in test')
}

const mockPrisma = {
  historical_agents: {
    findUnique: async () => null,
    findMany: async () => [],
    findFirst: async () => null,
  },
  users: {
    findUnique: async () => null,
    findFirst: async () => null,
  },
  created_agents: {
    findFirst: async () => null,
  },
  tokenBalance: {
    findUnique: async () => null,
  },
  token_balances: {
    findUnique: async () => null,
  },
}

const dbResolved = require.resolve('../../lib/db')
mock.module('@/lib/db', () => ({ prisma: mockPrisma }))
mock.module(dbResolved, () => ({ prisma: mockPrisma }))

mock.module('@/lib/auth', () => ({
  auth: async () => null,
}))
mock.module(require.resolve('../../lib/auth'), () => ({ auth: async () => null }))

const liveSkyResolved = require.resolve('../../lib/agents/rating/live-sky')
mock.module('@/lib/agents/rating/live-sky', () => ({
  resolveLiveSky: async () => {
    throw new Error('live sky unavailable in test')
  },
  SkyUnavailableError: class SkyUnavailableError extends Error {},
}))
mock.module(liveSkyResolved, () => ({
  resolveLiveSky: async () => {
    throw new Error('live sky unavailable in test')
  },
  SkyUnavailableError: class SkyUnavailableError extends Error {},
}))

import { NextRequest } from 'next/server'
import { getHistoricalAgent } from '@/lib/agents/historical'

const request = async (slug: string) => {
  const { GET } = await import('@/app/api/agents/[slug]/ratings/route')
  return GET(new NextRequest(`http://localhost/api/agents/${slug}/ratings`), {
    params: Promise.resolve({ slug }),
  })
}

describe('agent rating progression boundary', () => {
  it('resolves pilot agents from their actual catalog with seeded conversation experience', async () => {
    const response = await request('isaac-newton')
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.key).toBe(getHistoricalAgent('isaac-newton')!.id)
    expect(payload.totalXp).toBe(19725) // 789 seeded conversations * 25 XP
    expect(payload.vesselLevel).toBe(15) // Level 15 earned growth
    expect(payload.currentOverall).toBeNull()
    expect(payload.progressionStatus).toBe('unavailable')
    expect(payload.ratings.power).toBeGreaterThanOrEqual(25)
    expect(payload.ovr).toBeGreaterThanOrEqual(25)
  })

  it('returns 404 for an unknown non-existent agent', async () => {
    expect((await request('unknown-celestial-agent')).status).toBe(404)
  })
})
