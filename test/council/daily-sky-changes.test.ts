/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { COUNCIL_PLANETS, type DailySkyBrief } from '@/lib/agents/council/daily-council-types'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { withPreviousSkyChanges } from '@/lib/agents/council/daily-sky-changes'
import {
  createBriefingEdition,
  planDailyEpisode,
  validateDailyTurn,
} from '@/lib/agents/council/daily-episode'
import { DailyCouncilEditionSchema } from '@/lib/agents/council/daily-edition-schema'

function sky(
  date = '2026-10-02',
  overrides: Record<string, { longitude: number; speed?: number }> = {},
  source: DailySkyBrief['source'] = 'vsop87-approximation'
) {
  return buildDailySkyBrief({
    date: new Date(`${date}T00:00:00Z`),
    source,
    positions: Object.fromEntries(
      COUNCIL_PLANETS.map((planet, index) => [
        planet,
        overrides[planet] || { longitude: 15 + index * 33, speed: index > 6 ? -0.1 : 1 },
      ])
    ),
  })
}

describe('consecutive daily sky comparisons', () => {
  it('explains sign, known motion and lunar snapshot differences without inventing timed events', () => {
    const previous = sky('2026-10-01')
    const current = sky('2026-10-02', {
      Moon: { longitude: 95, speed: 13 },
      Mercury: { longitude: 81, speed: -0.25 },
    })
    const before = JSON.stringify({ previous, current })
    const enriched = withPreviousSkyChanges(current, previous)
    expect(enriched.changes?.previousDate).toBe('2026-10-01')
    const prose = enriched.changes!.items.join(' ')
    expect(prose).toContain("Moon's sign differs")
    expect(prose).toContain("Mercury's supplied apparent movement differs")
    expect(prose).toContain('The lunar phase label differs')
    expect(prose).toContain('does not establish the time')
    expect(prose).toContain('precise turning time is not inferred')
    expect(prose).not.toMatch(/stations? (?:at|today)|enters? \w+ (?:at|today)/i)
    expect(enriched.events).toEqual(current.events)
    expect(JSON.stringify({ previous, current })).toBe(before)
    const evidence = enriched.evidence.find(item => item.id === 'sky-changes')!
    expect(evidence.kind).toBe('overview')
    expect(evidence.bodyKeys).toEqual(expect.arrayContaining(['moon', 'mercury', 'sun']))
    expect(evidence.coverageIds).toEqual(['sky-changes'])
    expect(enriched.requiredCoverage).toContain('sky-changes')
  })

  it('does not compare across missing days, source/quality changes, or non-opening instants', () => {
    const current = sky()
    expect(withPreviousSkyChanges(current)).toBe(current)
    expect(withPreviousSkyChanges(current, sky('2026-09-30'))).toBe(current)
    expect(withPreviousSkyChanges(current, sky('2026-10-01', {}, 'swiss-ephemeris'))).toBe(current)
    expect(withPreviousSkyChanges(current, { ...sky('2026-10-01'), quality: 'verified' })).toBe(
      current
    )
    expect(
      withPreviousSkyChanges(current, { ...sky('2026-10-01'), asOf: '2026-10-01T06:00:00.000Z' })
    ).toBe(current)
    expect(current.changes).toBeUndefined()
  })

  it('leaves unknown speed unknown instead of treating a Boolean retrograde flag as a measured change', () => {
    const enriched = withPreviousSkyChanges(
      sky('2026-10-02', { Mercury: { longitude: 81 } }),
      sky('2026-10-01')
    )
    expect(enriched.changes!.items.join(' ')).not.toContain(
      "Mercury's supplied apparent movement differs"
    )
  })

  it('identifies a newly ranked relationship without claiming that the aspect began today', () => {
    const dense = Object.fromEntries(
      COUNCIL_PLANETS.map((planet, index) => [planet, { longitude: 10 + index * 30, speed: 1 }])
    )
    const previous = sky('2026-10-01', dense)
    const current = sky('2026-10-02', dense)
    const majors = current.aspects.filter(aspect => aspect.major)
    expect(majors.length).toBeGreaterThan(3)
    current.aspects = [majors[3], ...current.aspects.filter(aspect => aspect !== majors[3])]
    const enriched = withPreviousSkyChanges(current, previous)
    const ranking = enriched.changes!.items.find(item => item.startsWith('New among'))!
    expect(ranking).toContain(majors[3].aspectName.toLowerCase())
    expect(ranking).toContain(
      'ranking difference between snapshots, not proof the aspect began today'
    )
  })

  it('records continuity, yields stable immutable identity, and is idempotent', () => {
    const previous = sky('2026-10-01'),
      current = sky()
    const enriched = withPreviousSkyChanges(current, previous)
    expect(enriched.changes!.items).toHaveLength(1)
    expect(enriched.changes!.items[0]).toContain('No significant changes')
    expect(enriched.id).not.toBe(current.id)
    expect(withPreviousSkyChanges(current, previous).id).toBe(enriched.id)
    expect(withPreviousSkyChanges(enriched, previous).id).toBe(enriched.id)
    expect(
      withPreviousSkyChanges(current, { ...previous, id: `${previous.id}:different` }).id
    ).not.toBe(enriched.id)
    expect(
      withPreviousSkyChanges(enriched, previous).evidence.filter(item => item.id === 'sky-changes')
    ).toHaveLength(1)
  })

  it('gives Gregory a covered comparison in a complete schema-valid edition', () => {
    const enriched = withPreviousSkyChanges(
      sky('2026-10-02', { Moon: { longitude: 80, speed: 13 } }),
      sky('2026-10-01')
    )
    const edition = createBriefingEdition(enriched)
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(true)
    expect(edition.turns.length).toBeLessThanOrEqual(16)
    expect(edition.coveredTopics).toContain('sky-changes')
    const bridgeIndex = planDailyEpisode(enriched).findIndex(beat => beat.topic === 'bridge')
    const bridge = edition.turns[bridgeIndex]
    expect(bridge.speakerKey).toBe('gregory')
    expect(bridge.usedEvidenceIds).toContain('sky-changes')
    expect(bridge.coverageIds).toContain('sky-changes')
    for (const item of enriched.changes!.items) expect(bridge.text).toContain(item)
    expect(validateDailyTurn(enriched, planDailyEpisode(enriched)[bridgeIndex], bridge).valid).toBe(
      true
    )
    const wrongPrevious = {
      ...edition,
      brief: { ...enriched, changes: { ...enriched.changes!, previousDate: '2026-09-30' } },
    }
    expect(DailyCouncilEditionSchema.safeParse(wrongPrevious).success).toBe(false)
  })
})
