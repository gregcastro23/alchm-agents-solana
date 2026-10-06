/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'
import {
  createBriefingEdition,
  planDailyEpisode,
  validateDailyTurn,
} from '@/lib/agents/council/daily-episode'

const brief = buildDailySkyBrief({
  date: new Date('2026-10-02T00:00:00Z'),
  source: 'vsop87-approximation',
  positions: Object.fromEntries(
    COUNCIL_PLANETS.map((planet, index) => [
      planet,
      { longitude: 15 + index * 33, speed: index > 6 ? -0.1 : 1 },
    ])
  ),
})
const beat = planDailyEpisode(brief)[0]
const turn = createBriefingEdition(brief).turns[0]
const readingWith = (prose: string) =>
  validateDailyTurn(brief, beat, { ...turn, text: `${turn.text} ${prose}` })

describe('daily personal prediction guard', () => {
  it('allows a host question introduced after addressing the reader', () => {
    expect(
      readingWith('It is asking you right now: will you treat a disagreement as a useful question?')
        .valid
    ).toBe(true)
    expect(
      readingWith('Consider what matters to you; will you ask a clearer question?').valid
    ).toBe(true)
  })

  it('rejects direct personal forecasts and claims of inevitable action', () => {
    for (const prose of [
      'Everyone will find emotional balance today.',
      'When Mars meets the Moon’s emotional clarity, the action becomes inevitable.',
      'This pattern inevitably determines the decision.',
      'Pluto in Aquarius ensures that whatever you declare today ripples into who holds authority tomorrow.',
      'Saturn guarantees that our choices will succeed.',
    ])
      expect(readingWith(prose).reason).toBe('Guaranteed personal prediction')
  })

  it('allows an explicit denial of inevitability', () => {
    for (const prose of [
      'The action is not inevitable.',
      'These patterns do not make action inevitable.',
      'This relationship does not make personal outcomes inevitable.',
      'A symbolic reading does not inevitably determine a decision.',
      'No planet guarantees how you will respond.',
      'Pluto does not guarantee what you will experience.',
    ])
      expect(readingWith(prose).valid).toBe(true)
  })

  it('retains an affirmative prediction following a separate denial', () => {
    expect(
      readingWith('The action is not inevitable, but this next decision becomes inevitable.').reason
    ).toBe('Guaranteed personal prediction')
    expect(
      readingWith('These patterns do not make action inevitable, but everyone will succeed.').reason
    ).toBe('Guaranteed personal prediction')
    expect(readingWith('No planet guarantees an outcome, and everyone will succeed.').reason).toBe(
      'Guaranteed personal prediction'
    )
  })
})
