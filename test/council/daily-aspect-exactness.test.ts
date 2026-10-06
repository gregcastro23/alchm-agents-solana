/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'
import {
  createBriefingEdition,
  findSnapshotContradiction,
  getBeatFactualAssertions,
  planDailyEpisode,
  validateDailyTurn,
} from '@/lib/agents/council/daily-episode'

const longitudes = [190, 120, 215, 218, 124, 140, 11, 65, 3, 303]
const brief = buildDailySkyBrief({
  date: new Date('2026-10-05T00:00:00Z'),
  source: 'vsop87-approximation',
  positions: Object.fromEntries(
    COUNCIL_PLANETS.map((planet, index) => [
      planet,
      { longitude: longitudes[index], speed: planet === 'Moon' ? 14 : 0.5 },
    ])
  ),
})

describe('an applying conjunction already exists before exact alignment', () => {
  it('rejects a denial of the supplied conjunction for the matching named pair', () => {
    expect(
      brief.aspects.find(aspect => aspect.bodyA === 'moon' && aspect.bodyB === 'mars')
    ).toMatchObject({ aspectName: 'Conjunction', phase: 'applying', orb: 4 })
    for (const claim of [
      'The Moon in Leo and Mars in Leo are not yet conjunct, but they are approaching.',
      'Mars and the Moon are not yet in conjunction.',
      'Moon in Leo is not yet conjunct with Mars in Leo.',
      'Mars is not yet in conjunction with the Moon.',
    ])
      expect(findSnapshotContradiction(claim, brief.positions, brief.aspects)).toBe(
        'Contradictory aspect exactness'
      )
  })

  it('allows an existing conjunction to be described as not yet exact', () => {
    for (const claim of [
      'Moon in Leo and Mars in Leo are not yet exactly conjunct.',
      'The conjunction between Moon and Mars is not yet exact.',
      'Moon and Mars form an applying conjunction that is approaching exact alignment.',
    ])
      expect(findSnapshotContradiction(claim, brief.positions, brief.aspects)).toBeUndefined()
    expect(
      findSnapshotContradiction(
        'Moon and Saturn are not yet conjunct.',
        brief.positions,
        brief.aspects
      )
    ).toBeUndefined()
  })

  it('checks raw daily prose and claim metadata before denial filtering can hide the error', () => {
    const beats = planDailyEpisode(brief)
    const index = beats.findIndex(beat => beat.topic === 'aspect')
    const beat = beats[index]
    const candidate = {
      ...createBriefingEdition(brief).turns[index],
      factualAssertions: getBeatFactualAssertions(brief, beat),
    }
    const denial = 'The Moon in Leo and Mars in Leo are not yet conjunct.'
    expect(
      validateDailyTurn(brief, beat, { ...candidate, text: `${candidate.text} ${denial}` }).reason
    ).toBe('Contradictory aspect exactness')
    expect(validateDailyTurn(brief, beat, { ...candidate, newClaim: denial }).reason).toBe(
      'Contradictory aspect exactness'
    )
    expect(
      validateDailyTurn(brief, beat, {
        ...candidate,
        text: `${candidate.text} The conjunction is not yet exact.`,
      }).valid
    ).toBe(true)
    expect(beat.instruction).toContain('approaching exact alignment')
  })
})
