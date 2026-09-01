type Row = Record<string, unknown>

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

export interface PentaclesWorldState {
  players: Row[]
  agentCharts: Row[]
  zones: Row[]
  stars: Row[]
  cards: Row[]
  deckSlots: Row[]
  battles: Row[]
  duelChallenges: Row[]
  wordDuels: Row[]
  jingDuels: Row[]
  meleeTables: Row[]
  meleeSeats: Row[]
  meleeHands: Row[]
  meleePlays: Row[]
  meleeTricks: Row[]
  meleeQueue: Row[]
  agentMeleeTurns: Row[]
}

export type PentaclesWarTableState = Pick<
  PentaclesWorldState,
  'agentCharts' | 'meleeTables' | 'meleeHands' | 'agentMeleeTurns'
>

export interface PentaclesBackendClientOptions {
  uri?: string
  database?: string
  ownerToken?: string
  requestTimeoutMs?: number
}

const WRAPPER_FIELDS = new Set([
  '__identity__',
  '__connection_id__',
  '__timestamp_micros_since_unix_epoch__',
])

function nameOf(value: string | { some?: string } | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.some
}

function upperFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

function decodeSats(type: SchemaType | undefined, value: unknown): unknown {
  if (type?.Sum && Array.isArray(value)) {
    const [tag, payload] = value as [number, unknown]
    const variants = type.Sum.variants ?? []
    const variant = variants[tag]
    const variantName = nameOf(variant?.name) ?? String(tag)
    const option =
      variants.length === 2 && variants.some(candidate => nameOf(candidate.name) === 'none')
    if (option) return variantName === 'none' ? null : decodeSats(variant?.algebraic_type, payload)
    return upperFirst(variantName)
  }

  if (type?.Product && Array.isArray(value)) {
    const elements = type.Product.elements ?? []
    const first = nameOf(elements[0]?.name)
    if (elements.length === 1 && first && WRAPPER_FIELDS.has(first)) return value[0]
  }
  return value
}

export function pentaclesIdentity(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length === 1) return pentaclesIdentity(value[0])
  if (value && typeof value === 'object') {
    const identity = (value as Record<string, unknown>).__identity__
    if (typeof identity === 'string') return identity
  }
  return ''
}

export function pentaclesEnum(value: unknown): string {
  if (typeof value === 'string') return upperFirst(value)
  if (value && typeof value === 'object') {
    const key = Object.keys(value as Record<string, unknown>)[0]
    if (key) return upperFirst(key)
  }
  return ''
}

export function pentaclesNumber(value: unknown): number {
  if (Array.isArray(value) && value.length === 1) return pentaclesNumber(value[0])
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

export function pentaclesTimestampMicros(value: unknown): number {
  if (Array.isArray(value) && value.length === 1) return pentaclesTimestampMicros(value[0])
  if (value && typeof value === 'object') {
    return pentaclesTimestampMicros(
      (value as Record<string, unknown>).__timestamp_micros_since_unix_epoch__
    )
  }
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    const milliseconds = Date.parse(value)
    return Number.isFinite(milliseconds) ? milliseconds * 1_000 : 0
  }
  return pentaclesNumber(value)
}

function enumArg(value: string): Record<string, []> {
  return { [lowerFirst(value)]: [] }
}

function safeU64(value: unknown): number {
  const result = pentaclesNumber(value)
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`Unsafe u64 cannot be sent through reducer JSON: ${String(value)}`)
  }
  return result
}

export class PentaclesBackendClient {
  private readonly uri: string
  private readonly database: string
  private readonly ownerToken: string
  private readonly requestTimeoutMs: number

  constructor(options: PentaclesBackendClientOptions = {}) {
    this.uri = (
      options.uri ??
      process.env.PENTACLES_SPACETIME_URI ??
      process.env.SPACETIMEDB_URI ??
      'https://maincloud.spacetimedb.com'
    ).replace(/\/+$/, '')
    this.database =
      options.database ??
      process.env.PENTACLES_SPACETIME_DATABASE ??
      process.env.SPACETIMEDB_DB ??
      'cookingwithcastrollc'
    this.ownerToken = options.ownerToken ?? process.env.PENTACLES_SPACETIME_OWNER_TOKEN ?? ''
    this.requestTimeoutMs = options.requestTimeoutMs ?? 12_000
  }

  isWritable(): boolean {
    return Boolean(this.ownerToken)
  }

  async sql(query: string): Promise<Row[]> {
    const response = await fetch(`${this.uri}/v1/database/${this.database}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        ...(this.ownerToken ? { Authorization: `Bearer ${this.ownerToken}` } : {}),
      },
      body: query,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })
    if (!response.ok) throw new Error(`Pentacles SQL ${response.status}: ${await response.text()}`)

    const payload = (await response.json()) as unknown
    const statement = (Array.isArray(payload) ? payload[payload.length - 1] : payload) as
      | SqlStatement
      | undefined
    const elements = statement?.schema?.elements ?? []
    const columns = elements.map((element, index) => nameOf(element.name) ?? `col${index}`)
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

  async call(name: string, args: unknown[]): Promise<void> {
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
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    })
    if (!response.ok) throw new Error(`${name} ${response.status}: ${await response.text()}`)
  }

  async loadWorld(): Promise<PentaclesWorldState> {
    const tables = [
      'player',
      'agent_chart',
      'zone',
      'star_node',
      'card',
      'deck_slot',
      'battle',
      'duel_challenge',
      'word_duel',
      'jing_duel',
      'melee_table',
      'melee_seat',
      'melee_hand',
      'melee_play',
      'melee_trick',
      'melee_queue',
      'agent_melee_turn',
    ] as const
    const rows = await Promise.all(tables.map(table => this.sql(`SELECT * FROM ${table}`)))
    return {
      players: rows[0],
      agentCharts: rows[1],
      zones: rows[2],
      stars: rows[3],
      cards: rows[4],
      deckSlots: rows[5],
      battles: rows[6],
      duelChallenges: rows[7],
      wordDuels: rows[8],
      jingDuels: rows[9],
      meleeTables: rows[10],
      meleeSeats: rows[11],
      meleeHands: rows[12],
      meleePlays: rows[13],
      meleeTricks: rows[14],
      meleeQueue: rows[15],
      agentMeleeTurns: rows[16],
    }
  }

  async loadWarTableState(): Promise<PentaclesWarTableState> {
    const [agentCharts, meleeTables, meleeHands, agentMeleeTurns] = await Promise.all([
      this.sql('SELECT * FROM agent_chart'),
      this.sql('SELECT * FROM melee_table'),
      this.sql('SELECT * FROM melee_hand'),
      this.sql('SELECT * FROM agent_melee_turn'),
    ])
    return { agentCharts, meleeTables, meleeHands, agentMeleeTurns }
  }

  async seedAgent(input: {
    agentKey: string
    handle: string
    chart: Record<string, unknown>
    faction: string
  }): Promise<void> {
    await this.call('seed_agent_player', [
      input.agentKey,
      input.handle,
      input.chart,
      enumArg(input.faction),
    ])
  }

  async resolveStarBattle(agentKey: string, hipId: number, cardIds: unknown[]): Promise<void> {
    await this.call('admin_agent_resolve_star_battle', [
      agentKey,
      hipId,
      { model: { autoSiege: [] }, plays: cardIds.map(safeU64) },
    ])
  }

  async castWord(agentKey: string, word: string, opponent: string): Promise<void> {
    await this.call('admin_agent_cast_word', [agentKey, word, enumArg(opponent)])
  }

  async castJing(
    agentKey: string,
    move: string,
    targetIdentity: string | null,
    targetAgent: string | null
  ): Promise<void> {
    await this.call('admin_agent_cast_jing', [
      agentKey,
      enumArg(move),
      targetIdentity ? { some: { __identity__: targetIdentity } } : { none: [] },
      targetAgent ? { some: enumArg(targetAgent) } : { none: [] },
    ])
  }

  async counterJing(agentKey: string, duelId: unknown, move: string): Promise<void> {
    await this.call('admin_agent_counter_jing', [agentKey, safeU64(duelId), enumArg(move)])
  }

  async answerAgentMeleeTurn(turnId: unknown, cardId: unknown): Promise<void> {
    await this.call('answer_agent_melee_turn', [safeU64(turnId), safeU64(cardId)])
  }
}

export const pentaclesBackendClient = new PentaclesBackendClient()
