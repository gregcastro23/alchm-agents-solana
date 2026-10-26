/** @vitest-environment node */
import { expect, it } from 'vitest'
import {
  createBriefingEdition,
  findEditionFactContradiction,
  planDailyEpisode,
  validateDailyTurn,
} from '@/lib/agents/council/daily-episode'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'

const brief = buildDailySkyBrief({
  date: new Date('2026-10-05T00:00:00Z'),
  source: 'vsop87-approximation',
  positions: Object.fromEntries(
    COUNCIL_PLANETS.map((planet, index) => [planet, { longitude: 15 + index * 33, speed: 1 }])
  ),
})

it('allows an explicit unavailable-timing caveat without treating it as an event claim', () => {
  for (const text of [
    'Exact timing of any celestial station or ingress is unavailable from this approximate source.',
    'Verified times for planetary stations and ingresses are unknown.',
    'Event timing is not calculated for this snapshot.',
  ])
    expect(findEditionFactContradiction(brief, text, ['sky-overview'])).toBeUndefined()
})

it('retains unsupported event assertions beside an unavailable-timing caveat', () => {
  for (const text of [
    'Mercury stations today, but exact timing of any station or ingress is unavailable.',
    'Exact timing of any station or ingress is unavailable, and Mercury stations today.',
    'Mercury stations retrograde while the event timing is unknown.',
    'The timing of Mercury stations retrograde is unknown.',
  ])
    expect(findEditionFactContradiction(brief, text, ['sky-overview'])).toBe(
      'Unverified event claim'
    )
})

it('requires verified ingress evidence for moving into a sign', () => {
  for (const text of [
    'Sun has moved into Libra.',
    'Moon moves into Gemini.',
    'Mercury will move into Aries.',
    'Moon is moving into Taurus.',
  ])
    expect(findEditionFactContradiction(brief, text, ['sky-overview'])).toBe(
      'Unverified event claim'
    )
  expect(
    findEditionFactContradiction(brief, 'Sun moves through Aries.', ['sky-overview'])
  ).toBeUndefined()
})

it('checks the destination and time of a moving-into ingress claim', () => {
  const sky = {
    ...brief,
    events: [
      {
        id: 'ingress',
        evidenceId: 'event-ingress',
        type: 'sign_ingress' as const,
        at: '2026-10-05T10:00:00Z',
        bodies: ['moon' as const],
        description: 'Moon enters Gemini',
      },
    ],
  }
  expect(
    findEditionFactContradiction(sky, 'Moon will move into Gemini at 10:00 UTC.', ['event-ingress'])
  ).toBeUndefined()
  expect(findEditionFactContradiction(sky, 'Moon will move into Taurus.', ['event-ingress'])).toBe(
    'Contradictory ingress destination'
  )
  expect(
    findEditionFactContradiction(sky, 'Moon will move into Gemini at 11:00 UTC.', ['event-ingress'])
  ).toBe('Contradictory event time')
})

it('requires a closing caveat when event timing is unavailable', () => {
  const closing = createBriefingEdition(brief).turns.at(-1)!
  const beat = planDailyEpisode(brief).at(-1)!
  expect(validateDailyTurn(brief, beat, closing).valid).toBe(true)
  expect(
    validateDailyTurn(brief, beat, {
      ...closing,
      text: closing.text.replace('Exact event timing is unavailable in this snapshot.', ''),
    })
  ).toMatchObject({ valid: false, reason: 'Missing event timing limitation' })
})

it('distinguishes a complete event scan with no events from unavailable timing', () => {
  const sky = buildDailySkyBrief({
    date: new Date('2026-10-05T00:00:00Z'),
    source: 'swiss-ephemeris',
    positions: Object.fromEntries(
      COUNCIL_PLANETS.map((planet, index) => [planet, { longitude: 15 + index * 33, speed: 1 }])
    ),
    eventScanComplete: true,
  })
  const closing = createBriefingEdition(sky).turns.at(-1)!
  expect(closing.text).not.toContain('Exact event timing is unavailable')
  expect(validateDailyTurn(sky, planDailyEpisode(sky).at(-1)!, closing).valid).toBe(true)
})
