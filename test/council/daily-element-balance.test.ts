/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'
import {
  createBriefingEdition,
  generateDailyEdition,
  getBeatFactualAssertions,
  planDailyEpisode,
  validateDailyTurn,
} from '@/lib/agents/council/daily-episode'
import { DailyCouncilEditionSchema } from '@/lib/agents/council/daily-edition-schema'
import { generateStructuredVoice } from '@/lib/agents/persona/voiced-generation'

vi.mock('@/lib/agents/persona/voiced-generation', () => ({ generateStructuredVoice: vi.fn() }))
const generator = vi.mocked(generateStructuredVoice)
beforeEach(() => generator.mockReset())

function fixture(longitudes = [190, 120, 215, 218, 124, 140, 11, 65, 3, 303]) {
  return buildDailySkyBrief({
    date: new Date('2026-10-05T00:00:00Z'),
    source: 'vsop87-approximation',
    positions: Object.fromEntries(
      COUNCIL_PLANETS.map((planet, index) => [planet, { longitude: longitudes[index], speed: 1 }])
    ),
  })
}

function bridgeCandidate(brief = fixture()) {
  const beats = planDailyEpisode(brief)
  const index = beats.findIndex(beat => beat.topic === 'bridge')
  return {
    brief,
    beat: beats[index],
    candidate: {
      ...createBriefingEdition(brief).turns[index],
      factualAssertions: getBeatFactualAssertions(brief, beats[index]),
    },
  }
}

describe('complete elemental balance', () => {
  it('includes the absent earth category in evidence, host context and the honest briefing', async () => {
    const brief = fixture()
    expect(brief.evidence.find(item => item.id === 'sky-overview')?.label).toContain(
      'Element distribution: fire 5, earth 0, air 3, water 2.'
    )
    generator.mockResolvedValue({ source: 'grounded_briefing', object: null })
    const edition = await generateDailyEdition(brief)
    const bridgePrompt = generator.mock.calls
      .map(([, options]) => options.prompt)
      .find(prompt => prompt.includes('Whole-day context:'))!
    const contextLine = bridgePrompt
      .split('\n')
      .find(line => line.startsWith('Whole-day context:'))!
    expect(JSON.parse(contextLine.slice('Whole-day context: '.length)).elementCounts).toEqual({
      fire: 5,
      earth: 0,
      air: 3,
      water: 2,
    })
    expect(bridgePrompt).toContain('including categories with zero placements')
    expect(
      edition.turns.find(turn => turn.text.includes('The elemental overview'))?.text
    ).toContain('No supplied planet occupies a sign associated with earth.')
    expect(DailyCouncilEditionSchema.safeParse(edition).success).toBe(true)
  })

  it('rejects incorrect least, dominant and absent descriptions in prose and claim metadata', () => {
    const { brief, beat, candidate } = bridgeCandidate()
    for (const claim of [
      'The sky tilts toward fire with a lighter presence of air and the least water.',
      'Water is the least represented element.',
      'Water has the fewest planets.',
      'Air is dominant in this snapshot.',
      'The dominant element is water.',
      'Water is absent from this sky.',
      'Water signs are missing.',
      'There are no water signs in the snapshot.',
      'Water is not represented in the sky.',
      'We cannot infer anyone’s mood, but air is dominant in this snapshot.',
    ]) {
      expect(
        validateDailyTurn(brief, beat, { ...candidate, text: `${candidate.text} ${claim}` }).reason
      ).toBe('Contradictory element balance')
      expect(validateDailyTurn(brief, beat, { ...candidate, newClaim: claim }).reason).toBe(
        'Contradictory element balance'
      )
    }
  })

  it('accepts truthful zero-count comparisons and direct denials without claiming a human deficit', () => {
    const { brief, beat, candidate } = bridgeCandidate()
    for (const claim of [
      'Fire is dominant in the snapshot.',
      'Earth is the least represented element.',
      'There are no earth signs among the supplied planets.',
      'Earth is not represented in the supplied sky.',
      'Water is not the least represented element.',
      'We cannot infer that air is dominant from this snapshot.',
      'Earth is absent from these placements, which does not establish a lack of practical ability.',
    ])
      expect(
        validateDailyTurn(brief, beat, { ...candidate, text: `${candidate.text} ${claim}` }).valid
      ).toBe(true)
  })

  it('allows tied highest and lowest elements rather than inventing a unique winner', () => {
    const { brief, beat, candidate } = bridgeCandidate(
      fixture([10, 11, 12, 13, 14, 70, 71, 72, 73, 74])
    )
    for (const claim of [
      'Fire is dominant in this snapshot.',
      'Air is dominant in this snapshot.',
      'Earth is least represented among the four elements.',
      'Water is least represented among the four elements.',
      'There are no water signs among the supplied planets.',
    ])
      expect(
        validateDailyTurn(brief, beat, { ...candidate, text: `${candidate.text} ${claim}` }).valid
      ).toBe(true)
    expect(
      validateDailyTurn(brief, beat, {
        ...candidate,
        text: `${candidate.text} Air has the fewest planets.`,
      }).reason
    ).toBe('Contradictory element balance')
  })
})
