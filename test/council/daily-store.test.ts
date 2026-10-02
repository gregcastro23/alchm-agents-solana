/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dailyEditionStore } from '@/lib/agents/council/daily-edition-store'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { createBriefingEdition } from '@/lib/agents/council/daily-episode'
import { DailyCouncilEditionSchema } from '@/lib/agents/council/daily-edition-schema'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'

const table = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ prisma: { council_daily_editions: table } }))
const now = new Date('2026-10-02T12:00:00.000Z')
function edition() {
  return createBriefingEdition(
    buildDailySkyBrief({
      date: now,
      source: 'vsop87-approximation',
      positions: Object.fromEntries(
        COUNCIL_PLANETS.map((planet, index) => [planet, { longitude: 15 + index * 33, speed: 1 }])
      ),
    })
  )
}
beforeEach(() => {
  vi.resetAllMocks()
})
describe('durable daily edition boundary', () => {
  it('reclaims only failed/expired leases under the attempt limit, never a published or live edition', async () => {
    table.create.mockRejectedValue({ code: 'P2002' })
    table.updateMany.mockResolvedValue({ count: 0 })
    expect(await dailyEditionStore.claim('2026-10-02', now)).toBeNull()
    expect(table.updateMany.mock.calls[0][0].where).toMatchObject({
      status: { not: 'published' },
      attempts: { lt: 3 },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    })
    table.create.mockRejectedValue(new Error('database offline'))
    await expect(dailyEditionStore.claim('2026-10-02', now)).rejects.toThrow('database offline')
    expect(table.updateMany).toHaveBeenCalledTimes(1)
  })
  it('publishes only under the exact owner token and an unexpired lease', async () => {
    table.updateMany.mockResolvedValue({ count: 0 })
    expect(await dailyEditionStore.publish('2026-10-02', 'owner-token', edition(), now)).toBe(false)
    expect(table.updateMany.mock.calls[0][0].where).toMatchObject({
      leaseToken: 'owner-token',
      leaseUntil: { gt: now },
      status: 'generating',
    })
    await expect(
      dailyEditionStore.publish('2026-10-03', 'owner-token', edition(), now)
    ).rejects.toThrow('invalid daily council')
  })
  it('never returns malformed persisted content or contradictory provenance', async () => {
    const valid = edition()
    expect(DailyCouncilEditionSchema.safeParse(valid).success).toBe(true)
    table.findUnique.mockResolvedValue({ status: 'published', payload: { ...valid, turns: [] } })
    expect(await dailyEditionStore.read('2026-10-02')).toBeNull()
    const mismatched = structuredClone(valid)
    mismatched.brief.positions.Sun.source = 'swiss-ephemeris'
    expect(DailyCouncilEditionSchema.safeParse(mismatched).success).toBe(false)
    const missing = structuredClone(valid) as any
    delete missing.brief.positions.Sun.source
    expect(DailyCouncilEditionSchema.safeParse(missing).success).toBe(false)
    const forged = structuredClone(valid)
    forged.turns[0].usedEvidenceIds = ['invented']
    expect(DailyCouncilEditionSchema.safeParse(forged).success).toBe(false)
  })
})
