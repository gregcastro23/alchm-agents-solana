import { describe, expect, it, mock } from 'bun:test'
mock.module('server-only', () => ({}))
mock.module('@/lib/db', () => ({
  prisma: {
    historical_agents: {
      findUnique: async () => null,
    },
    users: {
      findUnique: async () => null,
    },
  },
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
