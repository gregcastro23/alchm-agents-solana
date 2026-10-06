/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { createBriefingEdition } from '@/lib/agents/council/daily-episode'
import { dailyCouncilUpdates } from '@/lib/agents/council/daily-updates'
import {
  DailyCouncilEditionSchema,
  DailyCouncilResponseSchema,
} from '@/lib/agents/council/daily-edition-schema'
import { COUNCIL_PLANETS, type DailySkyBrief } from '@/lib/agents/council/daily-council-types'

function fixture(source: DailySkyBrief['source'] = 'swiss-ephemeris') {
  return createBriefingEdition(
    buildDailySkyBrief({
      source,
      date: new Date('2026-10-02T00:00:00Z'),
      positions: Object.fromEntries(
        COUNCIL_PLANETS.map((body, index) => [body, { longitude: 12 + index * 33, speed: 1 }])
      ),
      events: [
        {
          id: 'moon-ingress',
          evidenceId: 'event-moon-ingress',
          type: 'sign_ingress',
          bodies: ['moon'],
          at: '2026-10-02T18:00:00.000Z',
          description: 'Moon enters Gemini',
        },
      ],
      eventScanComplete: true,
    })
  )
}

describe('persisted daily sky integrity', () => {
  it('accepts a complete measured edition', () => {
    expect(DailyCouncilEditionSchema.safeParse(fixture()).success).toBe(true)
  })

  it.each(['phase', 'elongation', 'illumination', 'sign'] as const)(
    'rejects lunar %s that disagrees with the positions',
    field => {
      const edition = fixture()
      Object.assign(edition.brief.lunar, {
        [field]: typeof edition.brief.lunar[field] === 'number' ? 0 : 'incorrect',
      })
      expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(false)
    }
  )

  it.each(['orb', 'angle', 'phase', 'aspectName', 'quality', 'major'] as const)(
    'rejects aspect %s that disagrees with the positions',
    field => {
      const edition = fixture()
      const aspect = edition.brief.aspects[0]
      Object.assign(aspect, {
        [field]:
          typeof aspect[field] === 'number'
            ? 179
            : typeof aspect[field] === 'boolean'
              ? !aspect[field]
              : 'incorrect',
      })
      expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(false)
    }
  )

  it('rejects duplicate relationships and events without matching evidence', () => {
    const edition = fixture()
    edition.brief.aspects.push({ ...edition.brief.aspects[0] })
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(false)
    const missing = fixture()
    missing.brief.events[0].evidenceId = 'placement-moon'
    expect(DailyCouncilEditionSchema.safeParse(missing).success).toBe(false)
  })
})

describe('elapsed daily event updates', () => {
  it('reveals an event only when its calculated time arrives, preserving the edition', () => {
    const edition = fixture()
    const original = structuredClone(edition)
    expect(dailyCouncilUpdates(edition.brief, new Date('2026-10-02T17:59:59Z'))?.events).toEqual([])
    const updates = dailyCouncilUpdates(edition.brief, new Date('2026-10-02T18:00:00Z'))
    expect(updates?.events).toEqual(edition.brief.events)
    expect(
      DailyCouncilResponseSchema.safeParse({ edition, updates, status: 'published' }).success
    ).toBe(true)
    expect(edition).toEqual(original)
  })

  it('does not produce verified updates for approximate positions', () => {
    expect(
      dailyCouncilUpdates(fixture('vsop87-approximation').brief, new Date('2026-10-02T20:00:00Z'))
    ).toBeUndefined()
  })

  it('rejects future, duplicated or altered updates at the public boundary', () => {
    const edition = fixture()
    const events = edition.brief.events
    const response = {
      edition,
      status: 'published',
      updates: { asOf: '2026-10-02T17:00:00.000Z', events },
    }
    expect(DailyCouncilResponseSchema.safeParse(response).success).toBe(false)
    response.updates.asOf = '2026-10-02T19:00:00.000Z'
    response.updates.events = [...events, ...events]
    expect(DailyCouncilResponseSchema.safeParse(response).success).toBe(false)
    response.updates.events = [{ ...events[0], description: 'Moon enters a different sign' }]
    expect(DailyCouncilResponseSchema.safeParse(response).success).toBe(false)
  })
})
