import { describe, expect, it } from 'vitest'
import {
  scheduledDuelIntents,
  starBattleIntent,
  warTableIntents,
  type RosterAgent,
} from '../../backend/src/services/pentacles-agent-service'
import type { PentaclesWorldState } from '../../backend/src/services/pentacles-client'

const identity = (value: string) => ({ __identity__: value })
const variant = (tag: string) => tag

const roster: RosterAgent = {
  agentKey: 'agent-tesla',
  handle: 'Nikola Tesla',
  faction: 'Mars',
  chart: {
    birthUnix: 0,
    birthLat: 0,
    birthLon: 0,
    timeKnown: false,
    placements: [],
    ascendant: 0,
    midheaven: 0,
  },
}

function world(overrides: Partial<PentaclesWorldState> = {}): PentaclesWorldState {
  return {
    players: [],
    agentCharts: [],
    zones: [],
    stars: [],
    cards: [],
    deckSlots: [],
    battles: [],
    duelChallenges: [],
    wordDuels: [],
    jingDuels: [],
    meleeTables: [],
    meleeSeats: [],
    meleeHands: [],
    meleePlays: [],
    meleeTricks: [],
    meleeQueue: [],
    agentMeleeTurns: [],
    ...overrides,
  }
}

describe('Pentacles backend strategy', () => {
  it('uses the active loadout for an accessible raid and never borrows another owner card', () => {
    const state = world({
      zones: [{ zone_id: 0, owner: variant('Mars') }],
      stars: [{ hip_id: 42, magnitude: 1, region_hint: 5, held_by: variant('Venus') }],
      cards: [
        { card_id: 1, owner: identity('agent'), attack: 100, health: 1, armour: 1, level: 1 },
        { card_id: 2, owner: identity('agent'), attack: 10, health: 1, armour: 1, level: 1 },
        { card_id: 3, owner: identity('other'), attack: 999, health: 99, armour: 99, level: 99 },
      ],
      deckSlots: [{ owner: identity('agent'), card_id: 2, loadout: variant('Active') }],
    })

    expect(starBattleIntent(roster, 'agent', 'Mars', state)).toMatchObject({
      action: 'star_battle',
      hipId: 42,
      cardIds: ['2'],
    })
  })

  it('opens deterministic legal Word and Jing modes and suppresses pending duplicates', () => {
    const intents = scheduledDuelIntents(roster, 'agent', 'Mars', world(), '2026-09-01')
    expect(intents.map(intent => intent.action)).toEqual(['word_cast', 'jing_cast'])
    expect(intents.find(intent => intent.action === 'word_cast')).toMatchObject({
      opponent: 'Jupiter',
    })
    expect(['STAR', 'SPELL', 'TAROT']).toContain(
      intents.find(intent => intent.action === 'word_cast')?.word
    )
    expect(['Meltdown', 'Freeze', 'TectonicRoot', 'Vacuum', 'Erode']).toContain(
      intents.find(intent => intent.action === 'jing_cast')?.move
    )

    const blocked = scheduledDuelIntents(
      roster,
      'agent',
      'Mars',
      world({
        duelChallenges: [{ player: identity('agent'), answered: false }],
        jingDuels: [{ initiator: identity('agent'), state: variant('Open') }],
      }),
      '2026-09-01'
    )
    expect(blocked).toEqual([])
  })

  it('answers a handoff with only a card offered by Pentacles as legal', () => {
    const futureDeadline = Date.now() * 1_000 + 20_000_000
    const intents = warTableIntents(
      new Map([[roster.handle.toLowerCase(), roster]]),
      world({
        agentCharts: [{ identity: identity('agent'), handle: roster.handle }],
        meleeTables: [{ table_id: 7, trump_suit: variant('Wands') }],
        meleeHands: [
          {
            seat_id: 9,
            card_id: 10,
            rank: 21,
            suit: variant('Wands'),
            is_major: true,
            played: false,
          },
          {
            seat_id: 9,
            card_id: 11,
            rank: 2,
            suit: variant('Cups'),
            is_major: false,
            played: false,
          },
        ],
        agentMeleeTurns: [
          {
            turn_id: 5,
            table_id: 7,
            seat_id: 9,
            occupant: identity('agent'),
            trick_number: 3,
            legal_card_ids: [11],
            expires_at: futureDeadline,
            resolved_at: null,
          },
        ],
      })
    )

    expect(intents).toHaveLength(1)
    expect(intents[0]).toMatchObject({ action: 'war_table_card', turnId: '5', cardId: '11' })
  })

  it('does not answer expired or nearly expired War Table handoffs', () => {
    const intents = warTableIntents(
      new Map([[roster.handle.toLowerCase(), roster]]),
      world({
        agentCharts: [{ identity: identity('agent'), handle: roster.handle }],
        meleeTables: [{ table_id: 7, trump_suit: variant('Wands') }],
        meleeHands: [
          {
            seat_id: 9,
            card_id: 11,
            rank: 2,
            suit: variant('Cups'),
            is_major: false,
            played: false,
          },
        ],
        agentMeleeTurns: [
          {
            turn_id: 5,
            table_id: 7,
            seat_id: 9,
            occupant: identity('agent'),
            trick_number: 3,
            legal_card_ids: [11],
            expires_at: new Date(Date.now() + 7_000).toISOString(),
            resolved_at: null,
          },
        ],
      })
    )

    expect(intents).toEqual([])
  })
})
