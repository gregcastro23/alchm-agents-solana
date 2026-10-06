/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'
import {
  createBriefingEdition,
  findSnapshotContradiction,
  generateDailyEdition,
  getBeatFactualAssertions,
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
afterEach(() => vi.useRealTimers())

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
    expect(prose).toContain('These velocities are estimated by the local approximation')
    expect(prose).toContain('The estimated velocities suggest')
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
          ? {
              ...fallback.turns[1],
              factualAssertions: getBeatFactualAssertions(sky, planDailyEpisode(sky)[1]),
            }
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
    for (const text of [
      '17° Virgo',
      '50% today',
      '17 degrees',
      'Monica Constant',
      'still three degrees of arc away',
      'twenty-three degrees closing',
      'fifty percent illuminated',
    ])
      expect(containsForbiddenTelemetry(text)).toBe(true)
  })

  it('distinguishes unknown or denied facts from assertions and catches common factual paraphrases', () => {
    const sky = brief(),
      beat = planDailyEpisode(sky)[1],
      honest = createBriefingEdition(sky).turns[1]
    for (const caveat of [
      'We cannot infer an ingress from one snapshot.',
      'An individual natal chart is required for personal claims.',
      'This is not a verified eclipse prediction.',
    ])
      expect(
        validateDailyTurn(sky, beat, { ...honest, text: `${honest.text} ${caveat}` }).valid
      ).toBe(true)
    expect(
      validateDailyTurn(sky, beat, {
        ...honest,
        text: `Moon in ${sky.positions.Moon.sign} during the ${sky.lunar.phase} invites a question about feeling secure: what would make an ordinary evening more nourishing? Try naming what you need before expecting someone else to know.`,
      }).valid
    ).toBe(true)
    for (const invented of [
      'It is also the full moon today.',
      'Mercury stops and turns backward today.',
      'Mercury’s position in Pisces makes dialogue gentler.',
      'A trine between the Sun and Moon provides harmony.',
      'Everyone will find emotional balance and money today.',
      'Moon is in Pisces without resistance.',
      'Moon is in Pisces, while the timing is unknown.',
      'We cannot infer an ingress, and Moon is in Pisces.',
      'Moon is in Pisces but its precise event time is unavailable.',
    ])
      expect(
        validateDailyTurn(sky, beat, { ...honest, text: `${honest.text} ${invented}` }).valid
      ).toBe(false)
    sky.positions.Moon.speed = undefined
    expect(
      findSnapshotContradiction('I am direct.', sky.positions, sky.aspects, 'moon')
    ).toBeTruthy()
  })

  it('checks the destination and direction of a cited verified event', () => {
    const sky = buildDailySkyBrief({
      date: new Date('2026-10-02T00:00:00Z'),
      source: 'swiss-ephemeris',
      positions: Object.fromEntries(
        COUNCIL_PLANETS.map((planet, index) => [planet, { longitude: 15 + index * 33, speed: 1 }])
      ),
      events: [
        {
          id: 'ingress',
          evidenceId: 'event-ingress',
          type: 'sign_ingress',
          at: '2026-10-02T10:00:00Z',
          bodies: ['moon'],
          description: 'Moon enters Gemini',
        },
        {
          id: 'station',
          evidenceId: 'event-station',
          type: 'station',
          at: '2026-10-02T11:00:00Z',
          bodies: ['mercury'],
          description: 'Mercury stations retrograde',
        },
      ],
      eventScanComplete: true,
    })
    const index = planDailyEpisode(sky).findIndex(beat => beat.topic === 'events')
    const beat = planDailyEpisode(sky)[index]
    const honest = createBriefingEdition(sky).turns[index]
    expect(validateDailyTurn(sky, beat, honest).valid).toBe(true)
    expect(
      validateDailyTurn(sky, beat, {
        ...honest,
        text: honest.text.replace('enters Gemini', 'enters Pisces'),
      }).reason
    ).toBe('Contradictory ingress destination')
    expect(
      validateDailyTurn(sky, beat, {
        ...honest,
        text: honest.text.replace('stations retrograde', 'stations direct'),
      }).reason
    ).toBe('Contradictory station direction')
    expect(
      validateDailyTurn(sky, beat, {
        ...honest,
        text: 'Moon enters Gemini at 11:00 UTC. Mercury stations retrograde at 10:00 UTC. These verified changes can guide reflection while leaving room for personal circumstances and choices.',
        factualAssertions: getBeatFactualAssertions(sky, beat),
      }).reason
    ).toBe('Contradictory event time')
  })

  it('aborts unresponsive generation within the absolute deadline without losing coverage', async () => {
    vi.useFakeTimers()
    const started = Date.now()
    generator.mockImplementation(() => new Promise(() => {}))
    const pending = generateDailyEdition(brief(), { deadlineMs: started + 5000 })
    await vi.advanceTimersByTimeAsync(5000)
    const edition = await pending
    expect(edition.generation).toBe('grounded_briefing')
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(true)
    expect(generator.mock.calls.length).toBeGreaterThan(0)
    expect(generator.mock.calls.every(([, options]) => options.abortSignal?.aborted)).toBe(true)
  })

  it('gives a slower host and delegate time without spending the editorial review budget', async () => {
    vi.useFakeTimers()
    const sky = brief(),
      beats = planDailyEpisode(sky),
      fallback = createBriefingEdition(sky)
    let call = 0
    generator.mockImplementation(async (_schema, options) => {
      if (options.systemPrompt.startsWith('You are the internal editor'))
        return { source: 'model', object: { acceptable: true, issues: [] } }
      const index = call++
      if (index === 0) await new Promise(resolve => setTimeout(resolve, 13_000))
      if (index === 1) await new Promise(resolve => setTimeout(resolve, 6_500))
      return {
        source: 'model',
        object: {
          ...fallback.turns[index],
          newClaim: fallback.turns[index].newClaim.slice(0, 300),
          factualAssertions: getBeatFactualAssertions(sky, beats[index]),
        },
      }
    })
    const started = Date.now()
    const pending = generateDailyEdition(sky, { deadlineMs: started + 150_000 })
    await vi.advanceTimersByTimeAsync(19_500)
    const edition = await pending
    expect(edition.turns[0].provenance.source).toBe('model')
    expect(edition.generation).toBe('model')
    expect(generator.mock.calls.at(-1)?.[1].systemPrompt).toContain('internal editor')
    expect(Date.now() - started).toBe(19_500)
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(true)
  })

  it('requires exact server-authored factual assertions when supplied, not invented interpretations as facts', () => {
    const sky = brief(),
      beat = planDailyEpisode(sky)[1],
      honest = createBriefingEdition(sky).turns[1]
    const assertions = getBeatFactualAssertions(sky, beat)
    expect(validateDailyTurn(sky, beat, { ...honest, factualAssertions: assertions }).valid).toBe(
      true
    )
    expect(
      validateDailyTurn(sky, beat, {
        ...honest,
        factualAssertions: [{ ...assertions[0], statement: 'Moon in Pisces' }],
      }).reason
    ).toBe('Unsupported factual assertion')
    expect(
      validateDailyTurn(sky, beat, { ...honest, factualAssertions: assertions.slice(1) }).valid
    ).toBe(false)
    expect(
      validateDailyTurn(sky, beat, {
        ...honest,
        text: `Moon in ${sky.positions.Moon.sign}. ${sky.lunar.phase}. This is a rich and wonderful moment full of purpose, hope, curiosity and human possibility.`,
      }).reason
    ).toBe('Planetary function absent from prose')
  })

  it('repairs an identified defect and closes against the corrected prior claims before final review', async () => {
    const sky = brief(),
      beats = planDailyEpisode(sky),
      fallback = createBriefingEdition(sky)
    let turnCall = 0,
      reviewCall = 0
    generator.mockImplementation(async (_schema, options) => {
      if (options.systemPrompt.startsWith('You are the internal editor'))
        return {
          source: 'model',
          object:
            ++reviewCall === 1
              ? {
                  acceptable: false,
                  issues: [
                    {
                      kind: 'conversation',
                      turnId: 'turn-6',
                      reason: 'Add a concrete communication example.',
                    },
                  ],
                }
              : { acceptable: true, issues: [] },
        }
      const index =
        turnCall < beats.length
          ? turnCall++
          : options.prompt.includes('Add a concrete communication example')
            ? 5
            : beats.length - 1
      return {
        source: 'model',
        object: {
          ...fallback.turns[index],
          newClaim: fallback.turns[index].newClaim.slice(0, 300),
          factualAssertions: getBeatFactualAssertions(sky, beats[index]),
          ...(turnCall >= beats.length && index === 5
            ? { newClaim: 'A revised message makes the competing priorities answerable.' }
            : {}),
        },
      }
    })
    const edition = await generateDailyEdition(sky, { deadlineMs: Date.now() + 90_000 })
    expect(reviewCall).toBe(2)
    expect(edition.turns.every(turn => turn.provenance.source === 'model')).toBe(true)
    const closingCall = generator.mock.calls.findLast(
      ([, options]) =>
        options.prompt.includes('EDITORIAL REPAIR') && options.prompt.includes('closing synthesis')
    )
    expect(closingCall?.[1].prompt).toContain(
      'A revised message makes the competing priorities answerable.'
    )
  })

  it('keeps the reviewed coherent prefix and recomputes a rejected suffix rather than discarding everything', async () => {
    const sky = brief(),
      beats = planDailyEpisode(sky),
      fallback = createBriefingEdition(sky)
    let index = 0
    generator.mockImplementation(async (_schema, options) =>
      options.systemPrompt.startsWith('You are the internal editor')
        ? {
            source: 'model',
            object: {
              acceptable: false,
              issues: [
                {
                  kind: 'conversation',
                  turnId: 'turn-6',
                  reason: 'Repeats the earlier point without an application.',
                },
              ],
            },
          }
        : {
            source: 'model',
            object: {
              ...fallback.turns[index < beats.length ? index : 5],
              factualAssertions: getBeatFactualAssertions(
                sky,
                beats[index < beats.length ? index++ : 5]
              ),
            },
          }
    )
    const diagnostics: string[] = []
    const edition = await generateDailyEdition(sky, {
      deadlineMs: Date.now() + 90_000,
      onDiagnostic: event => diagnostics.push(`${event.phase}:${event.outcome}`),
    })
    expect(edition.turns.slice(0, 5).every(turn => turn.provenance.source === 'model')).toBe(true)
    expect(
      edition.turns.slice(5).every(turn => turn.provenance.source === 'grounded_briefing')
    ).toBe(true)
    expect(edition.generation).toBe('mixed')
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(true)
    expect(diagnostics).toContain('final_review:rejected')
  })
})
