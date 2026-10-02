/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'
import {
  createBriefingEdition,
  findSnapshotContradiction,
  generateDailyEdition,
  planDailyEpisode,
  validateDailyTurn,
} from '@/lib/agents/council/daily-episode'
import { DailyCouncilEditionSchema } from '@/lib/agents/council/daily-edition-schema'
import { generateStructuredVoice } from '@/lib/agents/persona/voiced-generation'
import { containsForbiddenTelemetry } from '@/lib/agents/council/council-schema'

vi.mock('@/lib/agents/persona/voiced-generation', () => ({ generateStructuredVoice: vi.fn() }))
const generator = vi.mocked(generateStructuredVoice)
const brief = () =>
  buildDailySkyBrief({
    date: new Date('2026-10-02T00:00:00Z'),
    source: 'vsop87-approximation',
    positions: Object.fromEntries(
      COUNCIL_PLANETS.map((planet, index) => [
        planet,
        { longitude: 15 + index * 33, speed: index > 6 ? -0.1 : 1 },
      ])
    ),
  })
beforeEach(() => {
  generator.mockReset()
})

describe('complete daily episode', () => {
  it('covers the ten placements, lunar rhythm, motion and ranked aspects through a Greg-led reading', () => {
    const sky = brief(),
      edition = createBriefingEdition(sky)
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(true)
    expect(edition.turns[0].speakerKey).toBe('gregory')
    expect(edition.turns.at(-1)?.speakerKey).toBe('gregory')
    expect(
      edition.turns.filter(turn => turn.speakerKey === 'gregory').length
    ).toBeGreaterThanOrEqual(3)
    const prose = edition.turns.map(turn => turn.text).join(' ')
    for (const planet of COUNCIL_PLANETS) {
      expect(prose).toContain(`${planet} in ${sky.positions[planet].sign}`)
      expect(edition.coveredTopics).toContain(`placement-${planet.toLowerCase()}`)
    }
    expect(prose).toContain(sky.lunar.phase.toLowerCase())
    expect(new Set(edition.turns.map(turn => turn.text)).size).toBe(edition.turns.length)
    expect(prose.split(/\s+/).length).toBeLessThan(1300)
    expect(containsForbiddenTelemetry(prose)).toBe(false)
  })

  it('rejects invented evidence and wrong facts even when the model reports complete coverage', () => {
    const sky = brief(),
      beat = planDailyEpisode(sky)[1]
    const honest = createBriefingEdition(sky).turns[1]
    expect(validateDailyTurn(sky, beat, honest).valid).toBe(true)
    expect(validateDailyTurn(sky, beat, { ...honest, usedEvidenceIds: ['invented'] }).valid).toBe(
      false
    )
    expect(
      validateDailyTurn(sky, beat, { ...honest, text: honest.text + ' Sun is in Pisces.' }).valid
    ).toBe(false)
    expect(
      validateDailyTurn(sky, beat, { ...honest, text: honest.text + ' Mercury stations today.' })
        .valid
    ).toBe(false)
    expect(validateDailyTurn(sky, beat, { ...honest, coverageIds: [] }).valid).toBe(false)
  })

  it('rejects unknown motion and unsupported aspects rather than inferring certainty', () => {
    const sky = brief()
    sky.positions.Mercury.speed = undefined
    expect(findSnapshotContradiction('Mercury is direct.', sky.positions, sky.aspects)).toBeTruthy()
    expect(
      findSnapshotContradiction('Retrograde Mercury invites review.', sky.positions, sky.aspects)
    ).toBeTruthy()
    expect(findSnapshotContradiction('Sun squares Moon.', sky.positions, [])).toBe(
      'Unsupported aspect'
    )
    expect(
      findSnapshotContradiction('Sun sextile Pluto is applying.', sky.positions, [
        { bodyA: 'sun', bodyB: 'pluto', aspectName: 'Sextile', phase: 'separating' },
      ])
    ).toBe('Contradictory aspect phase')
    const fallback = createBriefingEdition(sky).turns.find(
      turn => turn.speakerKey === 'gregory' && turn.text.includes('Retrograde is')
    )!
    expect(fallback.text).toContain('Motion is unmeasured for Mercury')
  })

  it('does not invoke providers after an absolute deadline and retains full coverage', async () => {
    const edition = await generateDailyEdition(brief(), { deadlineMs: Date.now() - 1 })
    expect(generator).not.toHaveBeenCalled()
    expect(edition.generation).toBe('grounded_briefing')
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(true)
  })

  it('accepts a valid model contribution and fills invalid contributions with truthful readings', async () => {
    const sky = brief(),
      fallback = createBriefingEdition(sky)
    let call = 0
    generator.mockImplementation(async (_schema, options) => ({
      source: 'model',
      modelFamily: 'substantive',
      object: options.systemPrompt.startsWith('You are the internal editor')
        ? { acceptable: true, issues: [] }
        : call++ === 1
          ? fallback.turns[1]
          : { ...fallback.turns[0], usedEvidenceIds: ['fabricated'] },
    }))
    const edition = await generateDailyEdition(sky, { deadlineMs: Date.now() + 30_000 })
    expect(edition.generation).toBe('mixed')
    expect(edition.turns[1].provenance.source).toBe('model')
    expect(edition.turns[0].provenance.source).toBe('grounded_briefing')
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(true)
    expect(generator.mock.calls[2][1].prompt).toContain(edition.turns[1].newClaim)
  })

  it('allows ordinary fall while preventing coordinates, percentages and private telemetry', () => {
    expect(containsForbiddenTelemetry('Let certainty fall away.')).toBe(false)
    for (const text of ['17° Virgo', '50% today', '17 degrees', 'Monica Constant'])
      expect(containsForbiddenTelemetry(text)).toBe(true)
  })
})
