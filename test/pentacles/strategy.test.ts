import { describe, expect, it } from 'vitest'
import {
  accessibleZoneIds,
  chooseJingCounter,
  chooseStarBattle,
  chooseWarTableCard,
  isFactionEligible,
  isWordCandidate,
  topFactionChoices,
} from '@/lib/pentacles/strategy'
import type { NatalChartInput, PentaclesCard, PentaclesZone } from '@/lib/pentacles/types'

const chart: NatalChartInput = {
  birthUnix: 0,
  birthLat: 0,
  birthLon: 0,
  timeKnown: false,
  ascendant: 0,
  midheaven: 0,
  houseCusps: null,
  houseSystem: 'WholeSign',
  interceptedSigns: null,
  placements: [
    { body: 'Sun', sign: 4, arcMinutes: 600, retrograde: false, dignity: 5 },
    { body: 'Moon', sign: 3, arcMinutes: 600, retrograde: false, dignity: 4 },
    { body: 'Mars', sign: 0, arcMinutes: 600, retrograde: false, dignity: 3 },
    { body: 'Mercury', sign: 2, arcMinutes: 600, retrograde: false, dignity: 0 },
    { body: 'Venus', sign: 1, arcMinutes: 600, retrograde: false, dignity: 0 },
    { body: 'Jupiter', sign: 8, arcMinutes: 600, retrograde: false, dignity: 0 },
    { body: 'Saturn', sign: 9, arcMinutes: 600, retrograde: false, dignity: 0 },
    { body: 'Uranus', sign: 10, arcMinutes: 600, retrograde: false, dignity: 0 },
    { body: 'Neptune', sign: 11, arcMinutes: 600, retrograde: false, dignity: 0 },
    { body: 'Pluto', sign: 7, arcMinutes: 600, retrograde: false, dignity: 0 },
  ],
}

const zone = (zoneId: number, owner: PentaclesZone['owner'] = null): PentaclesZone => ({
  zoneId,
  kind: zoneId < 5 ? 'House' : zoneId < 10 ? 'Spire' : 'Crown',
  owner,
  control: 0,
  inFlux: false,
  fluxLevel: 0,
})

const card = (overrides: Partial<PentaclesCard>): PentaclesCard => ({
  cardId: '1',
  ownerIdentity: 'agent-identity',
  suit: 'Wands',
  rank: 2,
  health: 10,
  attack: 10,
  armour: 10,
  cooldownMs: 1000,
  sourceBody: 'Mars',
  inverted: false,
  isMajor: false,
  level: 1,
  letter: 65,
  ...overrides,
})

describe('Pentacles deterministic strategy', () => {
  it('only provisions a seeded agent into one of Pentacles top-three dignity factions', () => {
    expect(topFactionChoices(chart)).toEqual(['Sun', 'Moon', 'Mars'])
    expect(isFactionEligible(chart, 'Moon')).toBe(true)
    expect(isFactionEligible(chart, 'Saturn')).toBe(false)
  })

  it('only exposes houses, adjacent spires, and an earned Crown', () => {
    const houseControlled = Array.from({ length: 11 }, (_, id) =>
      zone(id, id === 0 ? 'Mars' : null)
    )
    expect(accessibleZoneIds('Mars', houseControlled)).toEqual([0, 1, 2, 3, 4, 5, 6])

    const crownControlled = houseControlled.map(current =>
      current.zoneId === 5 || current.zoneId === 8
        ? { ...current, owner: 'Mars' as const }
        : current
    )
    expect(accessibleZoneIds('Mars', crownControlled)).toContain(10)
  })

  it('submits an accessible enemy star with cards owned by that agent', () => {
    const zones = Array.from({ length: 11 }, (_, id) => zone(id, id === 0 ? 'Mars' : null))
    const decision = chooseStarBattle({
      agent: {
        agentKey: 'tesla',
        handle: 'Nikola Tesla',
        identity: 'agent-identity',
        faction: 'Mars',
      },
      zones,
      stars: [
        { hipId: 100, name: 'Friendly', magnitude: -2, heldBy: 'Mars', regionHint: 0 },
        { hipId: 101, name: 'Reachable', magnitude: 1, heldBy: 'Venus', regionHint: 5 },
        { hipId: 102, name: 'Inaccessible', magnitude: -5, heldBy: 'Venus', regionHint: 8 },
      ],
      cards: [
        card({ cardId: '10', attack: 15 }),
        card({ cardId: '11', attack: 30 }),
        card({ cardId: '999', ownerIdentity: 'someone-else', attack: 999 }),
      ],
    })

    expect(decision).toMatchObject({
      action: 'star_battle',
      agentKey: 'tesla',
      targetId: '101',
      cardIds: ['11', '10'],
    })
  })

  it('keeps Word Duel and Jing choices inside Pentacles legal candidates', () => {
    expect(
      isWordCandidate('ASTRA', [
        { word: 'ASTRA', score: 7 },
        { word: 'STAR', score: 6 },
      ])
    ).toBe(true)
    expect(isWordCandidate('ORBIT', [{ word: 'ASTRA', score: 7 }])).toBe(false)
    expect(chooseJingCounter('Meltdown')).toBe('Vacuum')
    expect(chooseJingCounter('TectonicRoot')).toBe('Erode')
  })

  it('prioritizes only cards Pentacles marks legal for a War Table turn', () => {
    const selected = chooseWarTableCard({
      faction: 'Mars',
      trumpSuit: 'Wands',
      trickNumber: 7,
      legalCardIds: ['1', '3'],
      hand: [
        card({ cardId: '1', suit: 'Cups', rank: 10 }),
        card({ cardId: '2', suit: 'Wands', rank: 21, isMajor: true }),
        card({ cardId: '3', suit: 'Wands', rank: 4 }),
      ],
    })

    expect(selected).toBe('3')
  })
})
