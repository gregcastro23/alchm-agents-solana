/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { composeCouncilPersona } from '@/lib/agents/council/council-persona'
import { buildPlacementKnowledge } from '@/lib/agents/council/placement-knowledge'
import { buildServerCouncilContext } from '@/lib/agents/council/council-context'
import {
  directAutonomousTurn,
  directSeekerExchange,
} from '@/lib/agents/council/conversation-director'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'

function context() {
  return buildServerCouncilContext({
    date: new Date('2026-10-02T00:00:00Z'),
    positions: Object.fromEntries(
      COUNCIL_PLANETS.map((planet, index) => [
        planet,
        { longitude: 15 + index * 33, speed: 1, retrograde: false },
      ])
    ),
  })
}
describe('placement voices and Gregory host', () => {
  it('uses canonical personas, authored voice material and an educational hosting contract', () => {
    const greg = composeCouncilPersona('gregory', { theme: 'care creation time courage' })
    expect(greg).toContain('Gregory Castro')
    expect(greg).toContain('<reference_material>')
    expect(greg).toContain('Your hosting job')
    expect(greg).toContain('actual prior claims')
    expect(greg).toContain('Planet, sign and aspect names are welcome')
    const venus = composeCouncilPersona('venus', {
      placement: { sign: 'Scorpio', dignity: 'detriment' },
    })
    const mars = composeCouncilPersona('mars', { placement: { sign: 'Cancer', dignity: 'fall' } })
    expect(venus).toContain('knowledge-venus-scorpio')
    expect(mars).toContain('knowledge-mars-cancer')
    expect(venus).not.toEqual(mars)
  })
  it('teaches the planetary function through its actual sign, element, modality and dignity', () => {
    const knowledge = buildPlacementKnowledge({ planet: 'Mars', sign: 'Cancer', dignity: 'fall' })
    expect(knowledge.planetMeaning).toContain('initiative')
    expect(knowledge.signMeaning).toContain('care')
    expect(knowledge.element).toBe('Water')
    expect(knowledge.dignityMeaning).toContain('extra care')
    expect(knowledge.ruler).toBe('Moon')
  })
  it('preserves canonical placement knowledge and produces different practices for distinct functions in one sign', () => {
    const moon = buildPlacementKnowledge({ planet: 'Moon', sign: 'Leo', degree: 25 })
    const mercury = buildPlacementKnowledge({ planet: 'Mercury', sign: 'Leo', degree: 25 })
    const mars = buildPlacementKnowledge({ planet: 'Mars', sign: 'Leo', degree: 25 })
    expect(moon.signThemes).toContain('mastery')
    expect(moon.perspective.beliefs.join(' ')).toContain('Somatic feeling')
    expect(moon.practice).toContain('emotional need')
    expect(mercury.practice).toContain('unclear message')
    expect(mars.practice).toContain('concrete first action')
    expect(new Set([moon.practice, mercury.practice, mars.practice]).size).toBe(3)
    expect(mercury.motionMeaning).toContain('unmeasured')
    expect(
      buildPlacementKnowledge({ planet: 'Mercury', sign: 'Leo', speed: 1, retrograde: false })
        .motionMeaning
    ).toContain('Direct motion')
  })
  it('honors an explicit Greg question and always ends the three-turn exchange with his synthesis', () => {
    const directed = directSeekerExchange(context(), 'What connects all of this?', 'gregory')
    expect(directed).toHaveLength(3)
    expect(directed[0].speakerKey).toBe('gregory')
    expect(directed[2].speakerKey).toBe('gregory')
    expect(directed[2].speechAct).toBe('synthesize')
    expect(directed[0].evidence.some(item => item.id === 'host-sky-overview')).toBe(true)
    expect(directed[0].evidence.some(item => item.placement?.planet === 'Host Anchor')).toBe(false)
  })
  it('schedules Greg after three delegate turns so the host cannot disappear', () => {
    const ctx = context()
    ctx.recentTurns = ['sun', 'moon', 'mars'].map((key, index) => ({
      turnId: `t${index}`,
      speakerKey: key as 'sun' | 'moon' | 'mars',
      speakerName: key,
      text: 'A previous thought',
      claim: 'A specific prior claim',
    }))
    expect(directAutonomousTurn(ctx, 'mars').speakerKey).toBe('gregory')
  })
})
