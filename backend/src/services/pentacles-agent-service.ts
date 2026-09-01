import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { cacheService } from './cache.js'
import {
  PentaclesBackendClient,
  pentaclesBackendClient,
  pentaclesEnum,
  pentaclesIdentity,
  pentaclesNumber,
  pentaclesTimestampMicros,
  type PentaclesWorldState,
} from './pentacles-client.js'

const PLANETS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const
type Planet = (typeof PLANETS)[number]

const SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const

const SIGN_RULERS: Planet[] = [
  'Mars',
  'Venus',
  'Mercury',
  'Moon',
  'Sun',
  'Mercury',
  'Venus',
  'Pluto',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
]
const DOMICILES = [[4], [3], [2, 5], [1, 6], [0, 7], [8, 11], [9, 10], [10], [11], [7]]
const EXALTATIONS = [0, 1, 5, 11, 9, 3, 6, 7, 3, 4]
const JING_COUNTERS: Record<string, string> = {
  Meltdown: 'Vacuum',
  Freeze: 'Meltdown',
  TectonicRoot: 'Erode',
  Vacuum: 'Freeze',
  Erode: 'Vacuum',
}
const JING_MOVES = Object.keys(JING_COUNTERS)
const SAFE_CODEX_WORDS = ['STAR', 'SPELL', 'TAROT'] as const
const WAR_TURN_MIN_REMAINING_MICROS = 8_000_000

interface Placement {
  body: Planet
  sign: number
  arcMinutes: number
  retrograde: boolean
  dignity: number
}

export interface RosterAgent {
  agentKey: string
  handle: string
  chart: {
    birthUnix: number
    birthLat: number
    birthLon: number
    timeKnown: boolean
    placements: Placement[]
    ascendant: number
    midheaven: number
  }
  faction: Planet
}

interface PentaclesAgentIntentBase {
  intentId: string
  agentKey: string
  rationale: string
  score: number
}

export type PentaclesAgentIntent = PentaclesAgentIntentBase &
  (
    | { action: 'provision_agent'; faction: Planet }
    | { action: 'star_battle'; hipId: number; cardIds: string[] }
    | { action: 'word_cast'; word: string; opponent: Planet }
    | { action: 'jing_cast'; move: string; targetAgent: Planet }
    | { action: 'jing_counter'; duelId: string; move: string }
    | { action: 'war_table_card'; turnId: string; cardId: string }
  )

export interface PentaclesAgentRunResult {
  runId: string
  startedAt: string
  finishedAt: string
  dryRun: boolean
  rosterSeen: number
  intents: PentaclesAgentIntent[]
  executed: number
  skipped: number
  failed: number
  errors: string[]
}

export interface PentaclesAgentRunOptions {
  dryRun?: boolean
  maxAgents?: number
  maxActions?: number
}

interface HistoricalAgentRow {
  agentId: string
  name: string
  birthDate: Date
  birthTime: string
  birthLocation: unknown
  natalChart: unknown
}

let prisma: PrismaClient | null = null

function rosterDatabase(): PrismaClient {
  prisma ??= new PrismaClient()
  return prisma
}

function object(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {}
}

function signIndex(value: unknown): number {
  if (typeof value === 'number') return ((Math.floor(value) % 12) + 12) % 12
  const index = SIGNS.findIndex(sign => sign.toLowerCase() === String(value).toLowerCase())
  return index >= 0 ? index : 0
}

function dignity(body: number, sign: number): number {
  if (DOMICILES[body]?.includes(sign)) return 5
  if (EXALTATIONS[body] === sign) return 3
  if (DOMICILES[body]?.some(home => (home + 6) % 12 === sign)) return -3
  if ((EXALTATIONS[body] + 6) % 12 === sign) return -5
  return 0
}

function circularDistance(a: number, b: number): number {
  const delta = Math.abs(a - b)
  return Math.min(delta, 21_600 - delta)
}

function topFaction(chart: RosterAgent['chart']): Planet {
  const scores = new Array<number>(10).fill(0)
  if (chart.timeKnown) {
    const ascSign = Math.floor(chart.ascendant / 1_800) % 12
    scores[PLANETS.indexOf(SIGN_RULERS[ascSign] ?? 'Mars')] += 3
  }

  for (const placement of chart.placements) {
    const body = PLANETS.indexOf(placement.body)
    scores[body] += 1 + placement.dignity * 0.4
    const absolute = placement.sign * 1_800 + placement.arcMinutes
    if (
      chart.timeKnown &&
      (circularDistance(absolute, chart.ascendant) < 600 ||
        circularDistance(absolute, chart.midheaven) < 600)
    ) {
      scores[body] += 1.5
    }
    if (placement.body === 'Sun' || placement.body === 'Moon') {
      scores[PLANETS.indexOf(SIGN_RULERS[placement.sign] ?? 'Mars')] += 2
    }
    if (SIGN_RULERS[placement.sign] !== placement.body) scores[body] += 0.5
  }

  for (let left = 0; left < chart.placements.length; left += 1) {
    for (let right = left + 1; right < chart.placements.length; right += 1) {
      const a = chart.placements[left]
      const b = chart.placements[right]
      if (!a || !b) continue
      if (SIGN_RULERS[a.sign] === b.body && SIGN_RULERS[b.sign] === a.body) {
        scores[PLANETS.indexOf(a.body)] += 1.5
        scores[PLANETS.indexOf(b.body)] += 1.5
      }
    }
  }

  let best = 0
  for (let index = 1; index < scores.length; index += 1) {
    if ((scores[index] ?? 0) > (scores[best] ?? 0)) best = index
  }
  return PLANETS[best] ?? 'Sun'
}

function normalizeRosterAgent(row: HistoricalAgentRow): RosterAgent | null {
  const natal = object(row.natalChart)
  const planets = object(natal.planets)
  const placements = PLANETS.map((body, bodyIndex): Placement | null => {
    const raw = object(planets[body] ?? planets[body.toLowerCase()])
    if (!raw.sign || !Number.isFinite(Number(raw.degree))) return null
    const sign = signIndex(raw.sign)
    const arcMinutes = Math.max(0, Math.min(1_799, Math.round(Number(raw.degree) * 60)))
    return {
      body,
      sign,
      arcMinutes,
      retrograde: Boolean(raw.retrograde),
      dignity: dignity(bodyIndex, sign),
    }
  })

  if (placements.some(placement => !placement)) return null
  const location = object(row.birthLocation)
  const ascendantDegrees = Number(natal.ascendant ?? object(natal.houses).ASC ?? 0)
  const midheavenDegrees = Number(natal.midheaven ?? object(natal.houses).MC ?? 0)
  const timeKnown =
    Boolean(row.birthTime) &&
    row.birthTime.toLowerCase() !== 'unknown' &&
    natal.ascendantProvenance !== 'placeholder'
  const chart: RosterAgent['chart'] = {
    birthUnix: Math.floor(row.birthDate.getTime() / 1_000),
    birthLat: Number(location.lat ?? location.latitude ?? 0),
    birthLon: Number(location.lon ?? location.longitude ?? 0),
    timeKnown,
    placements: placements as Placement[],
    ascendant: timeKnown ? Math.round(ascendantDegrees * 60) : 0,
    midheaven: timeKnown ? Math.round(midheavenDegrees * 60) : 0,
  }
  return { agentKey: row.agentId, handle: row.name, chart, faction: topFaction(chart) }
}

function reducerChart(chart: RosterAgent['chart']): Record<string, unknown> {
  const enumArg = (value: string) => ({ [value.charAt(0).toLowerCase() + value.slice(1)]: [] })
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
    house_cusps: { none: [] },
    house_system: { placidus: [] },
    intercepted_signs: { none: [] },
  }
}

export function accessibleZones(faction: string, world: PentaclesWorldState): Set<number> {
  const owned = new Set(
    world.zones
      .filter(zone => pentaclesEnum(zone.owner) === faction)
      .map(zone => pentaclesNumber(zone.zone_id))
  )
  const accessible = new Set<number>([0, 1, 2, 3, 4])
  for (let spire = 5; spire < 10; spire += 1) {
    const index = spire - 5
    if (owned.has(index) || owned.has((index + 4) % 5)) accessible.add(spire)
  }
  if ([5, 6, 7, 8, 9].filter(zone => owned.has(zone)).length >= 2) accessible.add(10)
  return accessible
}

export function cardPower(card: Record<string, unknown>): number {
  const base =
    pentaclesNumber(card.attack) +
    pentaclesNumber(card.health) * 0.5 +
    pentaclesNumber(card.armour) * 0.4 +
    pentaclesNumber(card.level) * 2
  return base * (card.inverted === true ? 0.92 : 1) * (card.is_major === true ? 1.25 : 1)
}

export function starBattleIntent(
  roster: RosterAgent,
  identity: string,
  faction: string,
  world: PentaclesWorldState
): PentaclesAgentIntent | null {
  const accessible = accessibleZones(faction, world)
  const target = [...world.stars]
    .filter(star => accessible.has(pentaclesNumber(star.region_hint)))
    .filter(star => pentaclesEnum(star.held_by) !== faction)
    .sort((left, right) => {
      const leftScore = 5 - pentaclesNumber(left.magnitude)
      const rightScore = 5 - pentaclesNumber(right.magnitude)
      return rightScore - leftScore || pentaclesNumber(left.hip_id) - pentaclesNumber(right.hip_id)
    })[0]
  const ownedCards = world.cards.filter(card => pentaclesIdentity(card.owner) === identity)
  const activeCardIds = new Set(
    world.deckSlots
      .filter(slot => pentaclesIdentity(slot.owner) === identity)
      .filter(slot => pentaclesEnum(slot.loadout) === 'Active')
      .map(slot => String(pentaclesNumber(slot.card_id)))
  )
  const activeCards = ownedCards.filter(card =>
    activeCardIds.has(String(pentaclesNumber(card.card_id)))
  )
  const cards = (activeCards.length > 0 ? activeCards : ownedCards)
    .sort(
      (left, right) =>
        cardPower(right) - cardPower(left) ||
        pentaclesNumber(left.card_id) - pentaclesNumber(right.card_id)
    )
    .slice(0, 3)
  if (!target || cards.length === 0) return null
  const targetId = String(pentaclesNumber(target.hip_id))
  const cardIds = cards.map(card => String(pentaclesNumber(card.card_id)))
  return {
    intentId: `${roster.agentKey}:star_battle:${targetId}:${cardIds.join('-')}`,
    action: 'star_battle',
    agentKey: roster.agentKey,
    hipId: Number(targetId),
    cardIds,
    rationale: `Accessible enemy star in zone ${pentaclesNumber(target.region_hint)}`,
    score: cards.reduce((total, card) => total + cardPower(card), 0),
  }
}

function jingCounterIntents(
  roster: RosterAgent,
  identity: string,
  world: PentaclesWorldState
): PentaclesAgentIntent[] {
  return world.jingDuels
    .filter(duel => pentaclesEnum(duel.state) === 'Open')
    .filter(duel => pentaclesIdentity(duel.target_player) === identity)
    .flatMap(duel => {
      const opening = pentaclesEnum(duel.opening_move)
      const counter = JING_COUNTERS[opening]
      if (!counter) return []
      const duelId = String(pentaclesNumber(duel.duel_id))
      return [
        {
          intentId: `${roster.agentKey}:jing_counter:${duelId}:${counter}`,
          action: 'jing_counter' as const,
          agentKey: roster.agentKey,
          duelId,
          move: counter,
          rationale: `${counter} is the fixed legal counter to ${opening}`,
          score: 100,
        },
      ]
    })
}

function stableIndex(value: string, size: number): number {
  let total = 0
  for (const character of value) total = (total * 31 + character.charCodeAt(0)) >>> 0
  return total % size
}

export function scheduledDuelIntents(
  roster: RosterAgent,
  identity: string,
  faction: Planet,
  world: PentaclesWorldState,
  day: string
): PentaclesAgentIntent[] {
  const opponent = PLANETS[(PLANETS.indexOf(faction) + 1) % PLANETS.length] ?? 'Moon'
  const intents: PentaclesAgentIntent[] = []
  const hasPendingWord = world.duelChallenges.some(
    challenge => pentaclesIdentity(challenge.player) === identity && challenge.answered !== true
  )
  if (!hasPendingWord) {
    const word = SAFE_CODEX_WORDS[stableIndex(roster.agentKey, SAFE_CODEX_WORDS.length)] ?? 'STAR'
    intents.push({
      intentId: `${roster.agentKey}:word_cast:${day}`,
      action: 'word_cast',
      agentKey: roster.agentKey,
      word,
      opponent,
      rationale: `${word} is a deterministic Pentacles Codex word; ${opponent} receives the challenge`,
      score: 25,
    })
  }

  const hasOpenJing = world.jingDuels.some(
    duel => pentaclesIdentity(duel.initiator) === identity && pentaclesEnum(duel.state) === 'Open'
  )
  if (!hasOpenJing) {
    const move = JING_MOVES[stableIndex(`${roster.agentKey}:jing`, JING_MOVES.length)] ?? 'Meltdown'
    intents.push({
      intentId: `${roster.agentKey}:jing_cast:${day}`,
      action: 'jing_cast',
      agentKey: roster.agentKey,
      move,
      targetAgent: opponent,
      rationale: `${move} is a legal opening in Pentacles' fixed five-move Jing graph`,
      score: 24,
    })
  }
  return intents
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const values = value.length === 1 && Array.isArray(value[0]) ? value[0] : value
  return values.map(id => String(pentaclesNumber(id)))
}

export function warTableIntents(
  rosterByHandle: Map<string, RosterAgent>,
  world: PentaclesWorldState
): PentaclesAgentIntent[] {
  // Leave enough time for the reducer call after loading and scoring the live state.
  const minimumDeadlineMicros = Date.now() * 1_000 + WAR_TURN_MIN_REMAINING_MICROS
  const handleByIdentity = new Map(
    world.agentCharts.map(agent => [
      pentaclesIdentity(agent.identity),
      String(agent.handle).toLowerCase(),
    ])
  )
  const tableById = new Map(
    world.meleeTables.map(table => [String(pentaclesNumber(table.table_id)), table])
  )

  return world.agentMeleeTurns
    .filter(turn => turn.resolved_at == null)
    .filter(turn => pentaclesTimestampMicros(turn.expires_at) > minimumDeadlineMicros)
    .flatMap(turn => {
      const turnId = String(pentaclesNumber(turn.turn_id))
      const seatId = String(pentaclesNumber(turn.seat_id))
      const tableId = String(pentaclesNumber(turn.table_id))
      const handle = handleByIdentity.get(pentaclesIdentity(turn.occupant))
      const roster = handle ? rosterByHandle.get(handle) : undefined
      const table = tableById.get(tableId)
      if (!roster || !table) return []

      const legal = new Set(idList(turn.legal_card_ids))
      const trump = pentaclesEnum(table.trump_suit)
      const trick = pentaclesNumber(turn.trick_number)
      const card = world.meleeHands
        .filter(hand => String(pentaclesNumber(hand.seat_id)) === seatId)
        .filter(hand => hand.played !== true)
        .filter(hand => legal.has(String(pentaclesNumber(hand.card_id))))
        .sort((left, right) => {
          const score = (candidate: Record<string, unknown>) =>
            pentaclesNumber(candidate.rank) +
            (pentaclesEnum(candidate.suit) === trump ? 16 : 0) +
            (candidate.is_major === true ? 12 : 0)
          return (
            score(right) - score(left) ||
            String(pentaclesNumber(left.card_id)).localeCompare(
              String(pentaclesNumber(right.card_id))
            )
          )
        })[0]
      if (!card) return []

      const cardId = String(pentaclesNumber(card.card_id))
      return [
        {
          intentId: `${roster.agentKey}:war_table_card:${turnId}:${cardId}`,
          action: 'war_table_card' as const,
          agentKey: roster.agentKey,
          turnId,
          cardId,
          rationale: `Pentacles offered ${legal.size} legal cards for table ${tableId}, trick ${trick}`,
          score: 1_000 + trick,
        },
      ]
    })
}

export class PentaclesAgentService {
  constructor(private readonly client: PentaclesBackendClient = pentaclesBackendClient) {}

  private async loadRoster(limit: number): Promise<{ roster: RosterAgent[]; invalid: string[] }> {
    const rows = (await (rosterDatabase() as any).historical_agents.findMany({
      where: { isActive: true },
      select: {
        agentId: true,
        name: true,
        birthDate: true,
        birthTime: true,
        birthLocation: true,
        natalChart: true,
      },
      orderBy: { agentId: 'asc' },
      take: limit,
    })) as HistoricalAgentRow[]
    const invalid: string[] = []
    const roster = rows.flatMap(row => {
      const normalized = normalizeRosterAgent(row)
      if (!normalized) {
        invalid.push(`${row.agentId}: natal chart lacks all ten Pentacles placements`)
        return []
      }
      return [normalized]
    })
    return { roster, invalid }
  }

  private async alreadyHandled(intent: PentaclesAgentIntent): Promise<boolean> {
    return cacheService.exists(`pentacles:intent:${intent.intentId}`)
  }

  private async markHandled(intent: PentaclesAgentIntent): Promise<void> {
    const ttl =
      intent.action === 'jing_counter' || intent.action === 'war_table_card'
        ? 86_400
        : intent.action === 'word_cast' || intent.action === 'jing_cast'
          ? 172_800
          : intent.action === 'provision_agent'
            ? 300
            : 60
    await cacheService.set(`pentacles:intent:${intent.intentId}`, true, ttl)
  }

  private async withRetry(
    operation: () => Promise<void>,
    shouldRetry: (error: unknown) => boolean = () => true
  ): Promise<void> {
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await operation()
        return
      } catch (error) {
        lastError = error
        if (!shouldRetry(error)) break
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * 2 ** attempt))
      }
    }
    throw lastError
  }

  private isSettledWarTurnError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    return message.includes('turn deadline passed') || message.includes('turn already resolved')
  }

  private async execute(
    intent: PentaclesAgentIntent,
    rosterByKey: Map<string, RosterAgent>
  ): Promise<void> {
    if (intent.action === 'provision_agent') {
      const roster = rosterByKey.get(intent.agentKey)
      if (!roster) throw new Error(`Roster entry disappeared: ${intent.agentKey}`)
      await this.client.seedAgent({
        agentKey: roster.agentKey,
        handle: roster.handle,
        chart: reducerChart(roster.chart),
        faction: roster.faction,
      })
      return
    }
    if (intent.action === 'star_battle') {
      await this.client.resolveStarBattle(intent.agentKey, intent.hipId, intent.cardIds)
      return
    }
    if (intent.action === 'word_cast') {
      await this.client.castWord(intent.agentKey, intent.word, intent.opponent)
      return
    }
    if (intent.action === 'jing_cast') {
      await this.client.castJing(intent.agentKey, intent.move, null, intent.targetAgent)
      return
    }
    if (intent.action === 'jing_counter') {
      await this.client.counterJing(intent.agentKey, intent.duelId, intent.move)
      return
    }
    if (intent.action === 'war_table_card') {
      await this.client.answerAgentMeleeTurn(intent.turnId, intent.cardId)
    }
  }

  async evaluate(options: PentaclesAgentRunOptions = {}): Promise<PentaclesAgentRunResult> {
    const started = new Date()
    const dryRun = options.dryRun ?? process.env.PENTACLES_AGENT_DRY_RUN !== 'false'
    const maxAgents = options.maxAgents ?? Number(process.env.PENTACLES_AGENT_MAX_AGENTS || 100)
    const maxActions = options.maxActions ?? Number(process.env.PENTACLES_AGENT_MAX_ACTIONS || 25)
    const result: PentaclesAgentRunResult = {
      runId: crypto.randomUUID(),
      startedAt: started.toISOString(),
      finishedAt: started.toISOString(),
      dryRun,
      rosterSeen: 0,
      intents: [],
      executed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }

    try {
      const [{ roster, invalid }, world] = await Promise.all([
        this.loadRoster(maxAgents),
        this.client.loadWorld(),
      ])
      result.rosterSeen = roster.length
      result.errors.push(...invalid)
      const rosterByKey = new Map(roster.map(agent => [agent.agentKey, agent]))
      const rosterByHandle = new Map(roster.map(agent => [agent.handle.toLowerCase(), agent]))
      const playerByIdentity = new Map(
        world.players.map(player => [pentaclesIdentity(player.identity), player])
      )
      const agentByHandle = new Map(
        world.agentCharts.map(agent => [String(agent.handle).toLowerCase(), agent])
      )
      const strategicIntents: PentaclesAgentIntent[] = []
      const pendingWarIntents = warTableIntents(rosterByHandle, world)
      const duelActionsEnabled = process.env.PENTACLES_AGENT_DUELS_ENABLED !== 'false'
      const day = started.toISOString().slice(0, 10)

      for (const agent of roster) {
        const publicAgent = agentByHandle.get(agent.handle.toLowerCase())
        if (!publicAgent) {
          strategicIntents.push({
            intentId: `${agent.agentKey}:provision`,
            action: 'provision_agent',
            agentKey: agent.agentKey,
            faction: agent.faction,
            rationale: `${agent.faction} is the chart's highest dignity faction`,
            score: 100,
          })
          continue
        }

        const identity = pentaclesIdentity(publicAgent.identity)
        const player = playerByIdentity.get(identity)
        if (!player) continue
        const faction = pentaclesEnum(player.faction)
        if (faction !== agent.faction) {
          strategicIntents.push({
            intentId: `${agent.agentKey}:provision:${agent.faction}`,
            action: 'provision_agent',
            agentKey: agent.agentKey,
            faction: agent.faction,
            rationale: `Synchronize roster faction from ${faction || 'Unknown'} to ${agent.faction}`,
            score: 100,
          })
          continue
        }
        strategicIntents.push(...jingCounterIntents(agent, identity, world))
        const battle = starBattleIntent(agent, identity, faction, world)
        if (battle) strategicIntents.push(battle)
        if (duelActionsEnabled) {
          strategicIntents.push(...scheduledDuelIntents(agent, identity, agent.faction, world, day))
        }
      }

      const seen = new Set<string>()
      const applyIntent = async (intent: PentaclesAgentIntent): Promise<boolean> => {
        if (seen.has(intent.intentId) || result.intents.length >= maxActions) return false
        seen.add(intent.intentId)
        result.intents.push(intent)
        if (await this.alreadyHandled(intent)) {
          result.skipped += 1
          return true
        }
        if (dryRun) {
          result.skipped += 1
          return true
        }
        try {
          await this.withRetry(
            () => this.execute(intent, rosterByKey),
            error => intent.action !== 'war_table_card' || !this.isSettledWarTurnError(error)
          )
          await this.markHandled(intent)
          result.executed += 1
        } catch (error) {
          if (intent.action === 'war_table_card' && this.isSettledWarTurnError(error)) {
            await this.markHandled(intent)
            result.skipped += 1
            return true
          }
          result.failed += 1
          result.errors.push(
            `${intent.intentId}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
        return true
      }

      const sorted = (intents: PentaclesAgentIntent[]) =>
        intents.sort(
          (left, right) => right.score - left.score || left.intentId.localeCompare(right.intentId)
        )
      const initial =
        dryRun || pendingWarIntents.length === 0
          ? [...pendingWarIntents, ...strategicIntents]
          : pendingWarIntents
      const applyBatch = async (intents: PentaclesAgentIntent[]): Promise<boolean> => {
        const available = Math.max(0, maxActions - result.intents.length)
        const outcomes = await Promise.all(intents.slice(0, available).map(applyIntent))
        return outcomes.some(Boolean)
      }
      if (!dryRun && pendingWarIntents.length === 0) {
        for (const intent of sorted(initial).slice(0, maxActions)) await applyIntent(intent)
      } else {
        await applyBatch(sorted(initial))
      }

      // An accepted answer immediately exposes the next NPC turn. Drain those
      // handoffs in the same sweep (within maxActions) so a 12-trick table does
      // not take one ten-second scheduler interval per card.
      while (!dryRun && result.intents.length < maxActions) {
        const warState = await this.client.loadWarTableState()
        const next = sorted(warTableIntents(rosterByHandle, { ...world, ...warState })).filter(
          intent => !seen.has(intent.intentId)
        )
        if (next.length === 0) break
        const progressed = await applyBatch(next)
        if (!progressed) break
      }
    } catch (error) {
      result.failed += 1
      result.errors.push(error instanceof Error ? error.message : String(error))
    }

    result.finishedAt = new Date().toISOString()
    await cacheService.set('pentacles:controller:last-run', result, 86_400)
    return result
  }

  async castLegalWord(input: {
    agentKey: string
    opponent: Planet
    word: string
    candidates: Array<{ word: string; score: number }>
    dryRun?: boolean
  }): Promise<{ dryRun: boolean; word: string }> {
    const normalized = input.word.trim().toUpperCase()
    if (!input.candidates.some(candidate => candidate.word.trim().toUpperCase() === normalized)) {
      throw new Error('Word is not present in Pentacles legal candidates')
    }
    const dryRun = input.dryRun ?? process.env.PENTACLES_AGENT_DRY_RUN !== 'false'
    if (!dryRun)
      await this.withRetry(() => this.client.castWord(input.agentKey, normalized, input.opponent))
    return { dryRun, word: normalized }
  }

  async castJing(input: {
    agentKey: string
    move: string
    targetIdentity?: string | null
    targetAgent?: Planet | null
    dryRun?: boolean
  }): Promise<{ dryRun: boolean; move: string }> {
    if (!Object.keys(JING_COUNTERS).includes(input.move)) throw new Error('Invalid Jing move')
    const dryRun = input.dryRun ?? process.env.PENTACLES_AGENT_DRY_RUN !== 'false'
    if (!dryRun) {
      await this.withRetry(() =>
        this.client.castJing(
          input.agentKey,
          input.move,
          input.targetIdentity ?? null,
          input.targetAgent ?? null
        )
      )
    }
    return { dryRun, move: input.move }
  }

  async lastRun(): Promise<PentaclesAgentRunResult | null> {
    return cacheService.get<PentaclesAgentRunResult>('pentacles:controller:last-run')
  }

  isWritable(): boolean {
    return this.client.isWritable()
  }
}

export const pentaclesAgentService = new PentaclesAgentService()
