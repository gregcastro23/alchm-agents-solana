// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { chartKeyPaths, forgeVessel, type ForgedVessel } from './support/forge'

// GET /api/feed is public and shared (a CDN may hold it), and it echoed `natalChart` whole as
// `events[].agent.birthchart` for any historical_agents row that has a `.planets` chart and a
// posted event. A person's vessel must get what every stranger gets: the Sun sign.

const CHART = {
  planets: {
    Sun: { sign: 'Cancer', degree: 1.351261816891565 },
    Moon: { sign: 'Taurus', degree: 2.641436017496744 },
    Mercury: { sign: 'Taurus', degree: 5.692132359006791 },
  },
  ascendant: 98.508824787050344,
  houses: { 1: 98.5, 2: 128.5 },
  aspects: [{ planet1: 'Sun', planet2: 'Moon', type: 'Sextile', orb: 1.2 }],
}

describe('GET /api/feed: events[].agent.birthchart', () => {
  let vessel: ForgedVessel

  beforeAll(async () => {
    vessel = await forgeVessel()
  })
  beforeEach(() => {
    vi.resetModules()
  })

  async function feed(rows: Array<Record<string, unknown>>) {
    const events = rows.map((row, i) => ({
      id: `event-${i}`,
      agentId: row.agentId,
      eventType: 'recipe',
      status: 'posted',
      metadataPayload: { recipeName: `Dish ${i}` },
      evaluatedAt: new Date(`2026-10-2${i}T10:00:00.000Z`),
      idempotencyKey: `k-${i}`,
    }))
    vi.doMock('@/lib/db', () => ({
      prisma: {
        historical_agents: { findMany: vi.fn().mockResolvedValue(rows) },
        agent_action_events: {
          findMany: vi.fn(async ({ where }: any) =>
            events.filter(e => (where.agentId.in as string[]).includes(e.agentId as string))
          ),
        },
      },
    }))
    const { GET } = await import('@/app/api/feed/route')
    const res = await GET(new Request('http://localhost:3000/api/feed') as unknown as NextRequest)
    return { res, json: (await res.json()) as any }
  }

  const person = (overrides: Record<string, unknown> = {}) => ({
    agentId: vessel.agentId,
    name: 'Verdant Wren',
    dominantElement: 'Earth',
    historicalEra: 'user_created',
    craftedBy: 'philosopher-stone-user',
    natalChart: CHART,
    ...overrides,
  })

  it("a person's vessel gets the Sun sign and nothing else", async () => {
    const { json } = await feed([person()])
    expect(json.events).toHaveLength(1)
    const birthchart = json.events[0].agent.birthchart
    expect(birthchart).toEqual({ planets: { Sun: { sign: 'Cancer' } } })
    expect(chartKeyPaths(json.events[0])).toEqual([])
    expect(JSON.stringify(json.events[0])).not.toContain('1.3512')
    expect(JSON.stringify(json.events[0])).not.toContain('98.5')
  })

  it('so does a MONICA_SPECIAL vessel and one flagged isUserCreated', async () => {
    for (const marker of [
      { historicalEra: 'MONICA_SPECIAL', craftedBy: null },
      { historicalEra: null, craftedBy: null, isUserCreated: true },
    ]) {
      vi.resetModules()
      const { json } = await feed([person(marker)])
      expect(json.events[0].agent.birthchart).toEqual({ planets: { Sun: { sign: 'Cancer' } } })
    }
  })

  it('a row that is not a public figure is a person until proven otherwise, whatever era it is stamped with', async () => {
    const { json } = await feed([
      person({
        agentId: 'agent-created-through-python-post',
        historicalEra: 'modern_pre1950',
        craftedBy: null,
      }),
    ])
    expect(json.events[0].agent.birthchart).toEqual({ planets: { Sun: { sign: 'Cancer' } } })
  })

  it('a person whose chart has no readable Sun sign gets an empty birthchart, not the chart', async () => {
    const { json } = await feed([
      person({ natalChart: { planets: { Moon: { sign: 'Aries', degree: 9.9 } } } }),
    ])
    expect(json.events[0].agent.birthchart).toEqual({})
  })

  it('a canonical figure and a sky-generated agent keep the full chart', async () => {
    const canonicalId = HISTORICAL_AGENTS[0].id
    const { json } = await feed([
      {
        agentId: canonicalId,
        name: 'A canonical figure',
        dominantElement: 'Fire',
        historicalEra: 'Antiquity',
        craftedBy: 'philosopher-stone',
        natalChart: CHART,
      },
      {
        agentId: 'moon-agent-0001',
        name: 'Moon at 1 degree',
        dominantElement: 'Water',
        historicalEra: 'planetary',
        craftedBy: 'planetary-seed',
        natalChart: CHART,
      },
    ])
    expect(json.events).toHaveLength(2)
    for (const event of json.events) expect(event.agent.birthchart).toEqual(CHART)
  })

  it('a vessel written by the real forge (a tropical chart, no .planets) never enters the feed at all', async () => {
    const { json } = await feed([{ ...vessel.row }])
    expect(json.events).toEqual([])
  })

  it('mixed feed: each event gets its own projection', async () => {
    const canonicalId = HISTORICAL_AGENTS[0].id
    const { json } = await feed([
      person(),
      {
        agentId: canonicalId,
        name: 'Canon',
        dominantElement: 'Fire',
        historicalEra: 'Antiquity',
        craftedBy: null,
        natalChart: CHART,
      },
    ])
    const byId = Object.fromEntries(json.events.map((e: any) => [e.agent.id, e.agent.birthchart]))
    expect(byId[vessel.agentId]).toEqual({ planets: { Sun: { sign: 'Cancer' } } })
    expect(byId[canonicalId]).toEqual(CHART)
  })
})
