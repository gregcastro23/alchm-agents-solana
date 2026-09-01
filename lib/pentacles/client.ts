import 'server-only'

import type {
  AgentProvisioningInput,
  NatalChartInput,
  PentaclesAgent,
  PentaclesAgentMeleeTurn,
  PentaclesBattle,
  PentaclesCard,
  PentaclesDeckSlot,
  PentaclesJingMove,
  PentaclesMeleeHandCard,
  PentaclesMeleePlay,
  PentaclesMeleeSeat,
  PentaclesMeleeTable,
  PentaclesMeleeTrick,
  PentaclesPlayer,
  PentaclesSnapshot,
  PentaclesStar,
  PentaclesSuit,
  PentaclesZone,
  PlanetFaction,
} from './types'

interface SchemaVariant {
  name?: string | { some?: string }
  algebraic_type?: SchemaType
}

interface SchemaElement {
  name?: string | { some?: string }
  algebraic_type?: SchemaType
}

interface SchemaType {
  Sum?: { variants?: SchemaVariant[] }
  Product?: { elements?: SchemaElement[] }
}

interface SqlStatement {
  schema?: { elements?: SchemaElement[] }
  rows?: unknown[][]
}

export interface PentaclesClientConfig {
  uri: string
  database: string
  ownerToken?: string
  requestTimeoutMs?: number
}

const WRAPPER_FIELDS = new Set([
  '__identity__',
  '__connection_id__',
  '__timestamp_micros_since_unix_epoch__',
])

function named(value: string | { some?: string } | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.some
}

function upperFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function decodeSats(type: SchemaType | undefined, value: unknown): unknown {
  if (type?.Sum && Array.isArray(value)) {
    const [tag, payload] = value as [number, unknown]
    const variants = type.Sum.variants ?? []
    const variant = variants[tag]
    const variantName = named(variant?.name) ?? String(tag)
    const isOption =
      variants.length === 2 && variants.some(candidate => named(candidate.name) === 'none')
    if (isOption) {
      return variantName === 'none' ? null : decodeSats(variant?.algebraic_type, payload)
    }
    return upperFirst(variantName)
  }

  if (type?.Product && Array.isArray(value)) {
    const elements = type.Product.elements ?? []
    const firstName = named(elements[0]?.name)
    if (elements.length === 1 && firstName && WRAPPER_FIELDS.has(firstName)) return value[0]
  }

  if (
    !type &&
    Array.isArray(value) &&
    value.length === 1 &&
    typeof value[0] === 'string' &&
    /^0x[0-9a-f]+$/i.test(value[0])
  ) {
    return value[0]
  }

  return value
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'bigint' || typeof value === 'number') return String(value)
  if (Array.isArray(value) && value.length === 1) return stringValue(value[0])
  const record = asRecord(value)
  if (typeof record.__identity__ === 'string') return record.__identity__
  return ''
}

function numberValue(value: unknown): number {
  const parsed = Number(stringValue(value) || value)
  return Number.isFinite(parsed) ? parsed : 0
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === 'true'
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const values = value.length === 1 && Array.isArray(value[0]) ? value[0] : value
  return values.map(stringValue)
}

function enumValue<T extends string>(value: unknown, fallback: T): T {
  if (typeof value === 'string') return upperFirst(value) as T
  const key = Object.keys(asRecord(value))[0]
  return key ? (upperFirst(key) as T) : fallback
}

function timestampValue(value: unknown): string {
  const raw = numberValue(value)
  if (raw > 0) {
    const millis = raw > 10_000_000_000_000 ? Math.floor(raw / 1_000) : raw
    return new Date(millis).toISOString()
  }
  return typeof value === 'string' ? value : new Date(0).toISOString()
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

function enumArg(value: string): Record<string, []> {
  return { [lowerFirst(value)]: [] }
}

function safeU64(value: string): number {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Unsafe u64 value cannot be sent through the JSON reducer API: ${value}`)
  }
  return number
}

function reducerChart(chart: NatalChartInput): Record<string, unknown> {
  return {
    identity: { __identity__: `0x${'0'.repeat(64)}` },
    birth_unix: chart.birthUnix,
    birth_lat: chart.birthLat,
    birth_lon: chart.birthLon,
    time_known: chart.timeKnown,
    placements: chart.placements.map(placement => ({
      body: enumArg(placement.body),
      sign: placement.sign,
      arc_minutes: placement.arcMinutes,
      retrograde: placement.retrograde,
      dignity: placement.dignity,
    })),
    ascendant: chart.ascendant,
    midheaven: chart.midheaven,
    house_cusps: chart.houseCusps ? { some: chart.houseCusps } : { none: [] },
    house_system: enumArg(chart.houseSystem),
    intercepted_signs: chart.interceptedSigns ? { some: chart.interceptedSigns } : { none: [] },
  }
}

export class PentaclesClient {
  readonly uri: string
  readonly database: string
  private readonly ownerToken?: string
  private readonly requestTimeoutMs: number

  constructor(config: PentaclesClientConfig) {
    this.uri = config.uri.replace(/\/+$/, '')
    this.database = config.database
    this.ownerToken = config.ownerToken
    this.requestTimeoutMs = config.requestTimeoutMs ?? 12_000
  }

  static fromEnv(): PentaclesClient {
    return new PentaclesClient({
      uri:
        process.env.PENTACLES_SPACETIME_URI ??
        process.env.SPACETIMEDB_URI ??
        'https://maincloud.spacetimedb.com',
      database:
        process.env.PENTACLES_SPACETIME_DATABASE ??
        process.env.SPACETIMEDB_DB ??
        'cookingwithcastrollc',
      ownerToken: process.env.PENTACLES_SPACETIME_OWNER_TOKEN,
    })
  }

  async sql(query: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${this.uri}/v1/database/${this.database}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        ...(this.ownerToken ? { Authorization: `Bearer ${this.ownerToken}` } : {}),
      },
      body: query,
      cache: 'no-store',
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Pentacles SQL failed (${response.status}): ${await response.text()}`)
    }

    const json = (await response.json()) as unknown
    const statement = (Array.isArray(json) ? json.at(-1) : json) as SqlStatement | undefined
    const elements = statement?.schema?.elements ?? []
    const columns = elements.map((element, index) => named(element.name) ?? `col${index}`)
    const types = elements.map(element => element.algebraic_type)

    return (statement?.rows ?? []).map(row =>
      Object.fromEntries(
        row.map((value, index) => [
          columns[index] ?? `col${index}`,
          decodeSats(types[index], value),
        ])
      )
    )
  }

  async callReducer(name: string, args: unknown[]): Promise<void> {
    if (!this.ownerToken) {
      throw new Error('PENTACLES_SPACETIME_OWNER_TOKEN is required for privileged reducer calls')
    }

    const response = await fetch(`${this.uri}/v1/database/${this.database}/call/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      cache: 'no-store',
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })

    if (!response.ok) {
      throw new Error(`${name} failed (${response.status}): ${await response.text()}`)
    }
  }

  async seedAgent(input: AgentProvisioningInput, faction: PlanetFaction): Promise<void> {
    await this.callReducer('seed_agent_player', [
      input.agentKey,
      input.handle,
      reducerChart(input.chart),
      enumArg(faction),
    ])
  }

  async resolveAgentStarBattle(agentKey: string, hipId: number, cardIds: string[]): Promise<void> {
    await this.callReducer('admin_agent_resolve_star_battle', [
      agentKey,
      hipId,
      { model: { autoSiege: [] }, plays: cardIds.map(safeU64) },
    ])
  }

  async castAgentWord(agentKey: string, word: string, opponent: PlanetFaction): Promise<void> {
    await this.callReducer('admin_agent_cast_word', [agentKey, word, enumArg(opponent)])
  }

  async castAgentJing(
    agentKey: string,
    move: PentaclesJingMove,
    targetIdentity: string | null,
    targetAgent: PlanetFaction | null
  ): Promise<void> {
    await this.callReducer('admin_agent_cast_jing', [
      agentKey,
      enumArg(move),
      targetIdentity ? { some: { __identity__: targetIdentity } } : { none: [] },
      targetAgent ? { some: enumArg(targetAgent) } : { none: [] },
    ])
  }

  async counterAgentJing(agentKey: string, duelId: string, move: PentaclesJingMove): Promise<void> {
    await this.callReducer('admin_agent_counter_jing', [agentKey, safeU64(duelId), enumArg(move)])
  }

  async answerAgentMeleeTurn(turnId: string, cardId: string): Promise<void> {
    await this.callReducer('answer_agent_melee_turn', [safeU64(turnId), safeU64(cardId)])
  }

  async loadSnapshot(): Promise<PentaclesSnapshot> {
    const [
      playerRows,
      agentRows,
      cardRows,
      slotRows,
      zoneRows,
      starRows,
      battleRows,
      wordRows,
      jingRows,
      tableRows,
      seatRows,
      handRows,
      playRows,
      trickRows,
      queueRows,
      agentTurnRows,
    ] = await Promise.all([
      this.sql('SELECT * FROM player'),
      this.sql('SELECT * FROM agent_chart'),
      this.sql('SELECT * FROM card'),
      this.sql('SELECT * FROM deck_slot'),
      this.sql('SELECT * FROM zone'),
      this.sql('SELECT * FROM star_node'),
      this.sql('SELECT * FROM battle'),
      this.sql('SELECT * FROM word_duel'),
      this.sql('SELECT * FROM jing_duel'),
      this.sql('SELECT * FROM melee_table'),
      this.sql('SELECT * FROM melee_seat'),
      this.sql('SELECT * FROM melee_hand'),
      this.sql('SELECT * FROM melee_play'),
      this.sql('SELECT * FROM melee_trick'),
      this.sql('SELECT * FROM melee_queue'),
      this.sql('SELECT * FROM agent_melee_turn'),
    ])

    const players: PentaclesPlayer[] = playerRows.map(row => ({
      identity: stringValue(row.identity),
      handle: stringValue(row.handle),
      faction: enumValue(row.faction, 'Sun'),
      tokens: stringValue(row.tokens),
      wordWins: numberValue(row.word_wins),
    }))

    const playerByIdentity = new Map(players.map(player => [player.identity, player]))
    const agents: PentaclesAgent[] = agentRows.map(row => {
      const identity = stringValue(row.identity)
      const handle = stringValue(row.handle)
      return {
        agentKey: handle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        handle,
        identity,
        faction: playerByIdentity.get(identity)?.faction ?? 'Sun',
      }
    })

    const cards: PentaclesCard[] = cardRows.map(row => ({
      cardId: stringValue(row.card_id),
      ownerIdentity: stringValue(row.owner),
      suit: enumValue<PentaclesSuit>(row.suit, 'Wands'),
      rank: numberValue(row.rank),
      health: numberValue(row.health),
      attack: numberValue(row.attack),
      armour: numberValue(row.armour),
      cooldownMs: numberValue(row.cooldown_ms),
      sourceBody: enumValue(row.source_body, 'Sun'),
      inverted: booleanValue(row.inverted),
      isMajor: booleanValue(row.is_major),
      level: numberValue(row.level),
      letter: numberValue(row.letter),
    }))

    const deckSlots: PentaclesDeckSlot[] = slotRows.map(row => ({
      slotId: stringValue(row.slot_id),
      ownerIdentity: stringValue(row.owner),
      cardId: stringValue(row.card_id),
      loadout: enumValue(row.loadout, 'Active'),
    }))

    const zones: PentaclesZone[] = zoneRows.map(row => ({
      zoneId: numberValue(row.zone_id),
      kind: enumValue(row.kind, 'House'),
      owner: row.owner == null ? null : enumValue(row.owner, 'Sun'),
      control: numberValue(row.control),
      inFlux: booleanValue(row.in_flux),
      fluxLevel: numberValue(row.flux_level),
    }))

    const stars: PentaclesStar[] = starRows.map(row => ({
      hipId: numberValue(row.hip_id),
      name: stringValue(row.name),
      magnitude: numberValue(row.magnitude),
      heldBy: row.held_by == null ? null : enumValue(row.held_by, 'Sun'),
      regionHint: numberValue(row.region_hint),
    }))

    const battles: PentaclesBattle[] = battleRows.map(row => ({
      battleId: stringValue(row.battle_id),
      starId: numberValue(row.star_id),
      attackerIdentity: stringValue(row.attacker),
      won: booleanValue(row.won),
      attackerScore: numberValue(row.attacker_score),
      defenseRating: numberValue(row.defense_rating),
      createdAt: timestampValue(row.created_at),
    }))

    const meleeTables: PentaclesMeleeTable[] = tableRows.map(row => ({
      tableId: stringValue(row.table_id),
      zoneId: numberValue(row.zone_id),
      roundIndex: stringValue(row.round_index),
      trumpSuit: enumValue<PentaclesSuit>(row.trump_suit, 'Wands'),
      state: enumValue(row.state, 'Mustering'),
      seatCount: numberValue(row.seat_count),
      openedAt: timestampValue(row.opened_at),
      resolvedAt: row.resolved_at == null ? null : timestampValue(row.resolved_at),
    }))

    const meleeSeats: PentaclesMeleeSeat[] = seatRows.map(row => ({
      seatId: stringValue(row.seat_id),
      tableId: stringValue(row.table_id),
      occupantIdentity: stringValue(row.occupant),
      faction: enumValue(row.faction, 'Sun'),
      isHuman: booleanValue(row.is_human),
      claim: numberValue(row.claim),
      counters: numberValue(row.counters),
      meldsValue: numberValue(row.melds_value),
      score: numberValue(row.score),
    }))

    const meleeHands: PentaclesMeleeHandCard[] = handRows.map(row => ({
      handId: stringValue(row.hand_id),
      tableId: stringValue(row.table_id),
      seatId: stringValue(row.seat_id),
      cardId: stringValue(row.card_id),
      suit: enumValue<PentaclesSuit>(row.suit, 'Wands'),
      rank: numberValue(row.rank),
      isMajor: booleanValue(row.is_major),
      inverted: booleanValue(row.inverted),
      played: booleanValue(row.played),
    }))

    const meleePlays: PentaclesMeleePlay[] = playRows.map(row => ({
      playId: stringValue(row.play_id),
      tableId: stringValue(row.table_id),
      trickNumber: numberValue(row.trick_number),
      seatId: stringValue(row.seat_id),
      cardId: stringValue(row.card_id),
      suit: enumValue<PentaclesSuit>(row.suit, 'Wands'),
      rank: numberValue(row.rank),
      isMajor: booleanValue(row.is_major),
      playedAt: timestampValue(row.played_at),
    }))

    const meleeTricks: PentaclesMeleeTrick[] = trickRows.map(row => ({
      trickId: stringValue(row.trick_id),
      tableId: stringValue(row.table_id),
      trickNumber: numberValue(row.trick_number),
      leaderSeat: stringValue(row.leader_seat),
      ledSuit: row.led_suit == null ? null : enumValue<PentaclesSuit>(row.led_suit, 'Wands'),
      winnerSeat: stringValue(row.winner_seat),
      counters: numberValue(row.counters),
      resolvedAt: timestampValue(row.resolved_at),
    }))

    const agentMeleeTurns: PentaclesAgentMeleeTurn[] = agentTurnRows.map(row => ({
      turnId: stringValue(row.turn_id),
      tableId: stringValue(row.table_id),
      seatId: stringValue(row.seat_id),
      occupantIdentity: stringValue(row.occupant),
      trickNumber: numberValue(row.trick_number),
      legalCardIds: stringList(row.legal_card_ids),
      requestedAt: timestampValue(row.requested_at),
      expiresAt: timestampValue(row.expires_at),
      selectedCardId: row.selected_card_id == null ? null : stringValue(row.selected_card_id),
      answeredAt: row.answered_at == null ? null : timestampValue(row.answered_at),
      resolvedAt: row.resolved_at == null ? null : timestampValue(row.resolved_at),
      fallbackUsed: booleanValue(row.fallback_used),
    }))

    return {
      capturedAt: new Date().toISOString(),
      players,
      agents,
      cards,
      deckSlots,
      zones,
      stars,
      battles,
      wordDuels: wordRows,
      jingDuels: jingRows,
      meleeTables,
      meleeSeats,
      meleeHands,
      meleePlays,
      meleeTricks,
      meleeQueue: queueRows,
      agentMeleeTurns,
    }
  }

  watchSnapshot(
    listener: (snapshot: PentaclesSnapshot) => void | Promise<void>,
    intervalMs = 10_000
  ): () => void {
    let disposed = false
    let running = false
    const tick = async () => {
      if (disposed || running) return
      running = true
      try {
        await listener(await this.loadSnapshot())
      } finally {
        running = false
      }
    }
    void tick()
    const timer = setInterval(() => void tick(), intervalMs)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }
}
