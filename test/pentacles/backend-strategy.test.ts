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

describe('PentaclesBackendClient idle pre-gate', () => {
  const satsSqlResult = (
    cols: Array<{ name: string; algebraic_type: Record<string, unknown> }>,
    rows: unknown[][]
  ) => [
    {
      schema: {
        elements: cols.map(col => ({
          name: { some: col.name },
          algebraic_type: col.algebraic_type,
        })),
      },
      rows,
    },
  ]

  const optionTimestampType = {
    Sum: {
      variants: [
        {
          name: { some: 'some' },
          algebraic_type: {
            Product: {
              elements: [
                {
                  name: { some: '__timestamp_micros_since_unix_epoch__' },
                  algebraic_type: { I64: [] },
                },
              ],
            },
          },
        },
        { name: { some: 'none' }, algebraic_type: { Product: { elements: [] } } },
      ],
    },
  }

  it('skips 17-table loadWorld when 0 agent_melee_turn rows exist and runs on 300_000ms heartbeat', async () => {
    const { vi } = await import('vitest')
    const { DEFAULT_IDLE_HEARTBEAT_MS, PentaclesBackendClient } =
      await import('../../backend/src/services/pentacles-client.js')

    const sqlQueries: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        const sqlText = String(init?.body ?? '')
        sqlQueries.push(sqlText)
        const payload = sqlText.includes('count(*)')
          ? satsSqlResult([{ name: 'cnt', algebraic_type: { U64: [] } }], [[0]])
          : [{ schema: { elements: [] }, rows: [] }]
        return {
          ok: true,
          status: 200,
          json: async () => payload,
          text: async () => '',
        }
      })
    )

    try {
      const client = new PentaclesBackendClient({
        uri: 'https://pentacles.test',
        database: 'asol',
        ownerToken: 'token',
      })

      // First tick triggers initial full loadWorld (17 table SELECT * queries).
      const initial = await client.loadWorldIfActive({ nowMs: 1_000 })
      expect(initial).not.toBeNull()
      expect(sqlQueries).toHaveLength(17)

      // Subsequent tick inside 300_000ms window runs only 1 SQL query and skips 17-table scan.
      sqlQueries.length = 0
      const idle = await client.loadWorldIfActive({ nowMs: 1_000 + 15_000 })
      expect(idle).toBeNull()
      expect(sqlQueries).toEqual(['SELECT count(*) AS cnt FROM agent_melee_turn'])

      // At >= 300_000ms heartbeat, runs full 17-table scan again.
      sqlQueries.length = 0
      const heartbeat = await client.loadWorldIfActive({
        nowMs: 1_000 + DEFAULT_IDLE_HEARTBEAT_MS,
      })
      expect(heartbeat).not.toBeNull()
      expect(sqlQueries).toHaveLength(17)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('distinguishes unresolved active turns from resolved-only turns', async () => {
    const { vi } = await import('vitest')
    const { PentaclesBackendClient } =
      await import('../../backend/src/services/pentacles-client.js')

    const nowMs = 1_700_000_000_000
    const futureMicros = (nowMs + 60_000) * 1_000
    const pastMicros = (nowMs - 30_000) * 1_000
    let turnMode: 'resolved_only' | 'pending' = 'resolved_only'
    const sqlQueries: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        const sqlText = String(init?.body ?? '')
        sqlQueries.push(sqlText)
        let payload: unknown[]
        if (sqlText.includes('count(*)')) {
          payload = satsSqlResult([{ name: 'cnt', algebraic_type: { U64: [] } }], [[2]])
        } else if (sqlText.startsWith('SELECT turn_id, resolved_at, expires_at')) {
          const rows =
            turnMode === 'resolved_only'
              ? [
                  [1, [0, [nowMs * 1_000]], [futureMicros]],
                  [2, [1, []], [pastMicros]],
                ]
              : [
                  [1, [0, [nowMs * 1_000]], [futureMicros]],
                  [2, [1, []], [futureMicros]],
                ]
          payload = satsSqlResult(
            [
              { name: 'turn_id', algebraic_type: { U64: [] } },
              { name: 'resolved_at', algebraic_type: optionTimestampType },
              {
                name: 'expires_at',
                algebraic_type: {
                  Product: {
                    elements: [
                      {
                        name: { some: '__timestamp_micros_since_unix_epoch__' },
                        algebraic_type: { I64: [] },
                      },
                    ],
                  },
                },
              },
            ],
            rows
          )
        } else {
          payload = [{ schema: { elements: [] }, rows: [] }]
        }
        return {
          ok: true,
          status: 200,
          json: async () => payload,
          text: async () => '',
        }
      })
    )

    try {
      const client = new PentaclesBackendClient({
        uri: 'https://pentacles.test',
        database: 'asol',
        ownerToken: 'token',
      })

      await client.loadWorldIfActive({ nowMs })

      // Resolved/expired rows only: 2 lightweight queries, skips 17-table scan.
      sqlQueries.length = 0
      turnMode = 'resolved_only'
      expect(await client.loadWorldIfActive({ nowMs: nowMs + 15_000 })).toBeNull()
      expect(sqlQueries).toEqual([
        'SELECT count(*) AS cnt FROM agent_melee_turn',
        'SELECT turn_id, resolved_at, expires_at FROM agent_melee_turn',
      ])

      // Pending unresolved unexpired turn: triggers full 17-table loadWorld().
      sqlQueries.length = 0
      turnMode = 'pending'
      const activeWorld = await client.loadWorldIfActive({ nowMs: nowMs + 30_000 })
      expect(activeWorld).not.toBeNull()
      expect(sqlQueries).toHaveLength(19)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('PentaclesAgentService.evaluate skips loadWorld and loadRoster when idle', async () => {
    const { vi } = await import('vitest')
    const { PentaclesAgentService } =
      await import('../../backend/src/services/pentacles-agent-service.js')

    const loadWorld = vi.fn()
    const loadWorldIfActive = vi.fn().mockResolvedValue(null)
    const service = new PentaclesAgentService({ loadWorld, loadWorldIfActive } as any)
    const loadRosterSpy = vi.spyOn(service as any, 'loadRoster')

    const result = await service.evaluate({ dryRun: true })
    expect(result.skippedIdle).toBe(true)
    expect(result.rosterSeen).toBe(0)
    expect(result.intents).toEqual([])
    expect(loadWorldIfActive).toHaveBeenCalledTimes(1)
    expect(loadWorld).not.toHaveBeenCalled()
    expect(loadRosterSpy).not.toHaveBeenCalled()
  })
})
