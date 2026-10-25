/**
 * Forged-vessel privacy: which agents are a person's private data, who may see it, and what
 * everybody else is given instead.
 *
 * A "forged vessel" is an agent a person made from their own birth data: a `historical_agents`
 * row written by `/api/create-agent` (`craftedBy: 'philosopher-stone-user'`) or by
 * `/api/philosophers-stone/create` (`historicalEra: 'MONICA_SPECIAL'`). Its birth date, time and
 * coordinates, its natal chart (every body's sign AND degree, the ascendant, the houses), and the
 * free text the owner typed about themselves are the owner's private data. Canonical historical
 * figures and the seeded sky sprites are public.
 *
 * What stays public for a vessel, by design, is exactly two facts: the birth-place NAME and the
 * Sun SIGN (the gallery filters on it). Everything else a stranger receives is built by the
 * allow-lists below, which name the fields that survive rather than the fields that go. A field
 * added to the row tomorrow is therefore withheld until somebody decides it is public.
 *
 * Pure module: no database, no session, no `server-only`, so specs can import it directly. The
 * session and `created_agents` reads live in `forged-privacy.server.ts`.
 *
 * ## Derived numbers are the chart in disguise
 *
 * `deriveStatsFromChart` (lib/sacred-7-stats.ts) is linear in the natal longitudes, then rounded
 * to whole numbers: `lunarReceptivity = round(50 + moon/360*30)`, `saturnianStructure =
 * round(50 + ascendant/360*30)`, and the Sacred 7 are blends of the same six longitudes. One unit
 * of a planetary stat is therefore a 12 degree bin of one body: the Moon's sign, the Mercury,
 * Venus and Mars signs, and the RISING sign (a 12 degree bin of the ascendant is under an hour of
 * birth time) all fall out of the twelve planetary stats printed on the profile, which is exactly
 * what a Sun-sign-only projection exists to withhold. So for a stranger the planetary stats are
 * not carried at all, the Sacred 7 are rounded again (a stored column can be a float even though
 * the derivation is not) and the chart-derived progression (`statDeltas`, `transitDelta`,
 * `currentOverall`, which depend on the exact degrees) is not given.
 *
 * The Sacred 7 themselves stay: they are what `/api/agents/rating` and the gallery serve for a
 * vessel (the game's public face), each is a blend of several longitudes at once, and withholding
 * them would empty the page. They are an owner decision, listed as such in the change notes.
 *
 * ## One definition of "forged" and of the public projection
 *
 * The predicate (`isUserCreatedAgentRow`), the Sun-sign and place-name extraction, and the public
 * birth/chart projections live in `forged-privacy.ts`, which `GET /api/agents`, `GET /api/feed` and
 * the unified-agents proxy use too, so the gallery API and this profile page cannot project differently.
 * This module adds only what a PAGE needs on top: who is looking, the wider "restricted profile
 * row" check, and the projection of a whole agent and of its progression.
 */
import type { CraftedAgent } from '@/lib/agent-types'
import type { AgentProgressionProfile } from '@/lib/agents/leveling-service'
import { classifyAgent } from '@/lib/agents/agent-type-model'
import { SACRED_STAT_KEYS } from '@/lib/agents/sacred-stat-keys'
import {
  extractSunSign,
  isUserCreatedAgentRow,
  projectPublicBirthData,
  projectPublicNatalChart,
} from './forged-privacy'

// ── What the row says about itself ───────────────────────────────────────────

/**
 * The columns of a `historical_agents` row that decide whether the row is a person's private data.
 * Deliberately small: callers pass this, never the whole row, so the chart and birth data cannot
 * travel along with the verdict.
 */
export interface AgentRowFacts {
  agentId: string
  historicalEra?: string | null
  craftedBy?: string | null
  agentCategory?: string | null
  /** Set by the Python API's rows and by the route's formatter; absent on Prisma rows. */
  isUserCreated?: boolean | null
  /** Absent on Prisma rows (no creator column); present on some Railway rows. */
  creatorId?: string | null
}

/** Picks the {@link AgentRowFacts} out of a row-shaped object. */
export function agentRowFacts(row: Record<string, unknown>): AgentRowFacts {
  const text = (value: unknown) => (typeof value === 'string' ? value : null)
  return {
    agentId: String(row.agentId ?? ''),
    historicalEra: text(row.historicalEra),
    craftedBy: text(row.craftedBy),
    agentCategory: text(row.agentCategory),
    isUserCreated: row.isUserCreated === true ? true : null,
    creatorId: text(row.creatorId),
  }
}

/** The PR #67 predicate (`isUserCreatedAgentRow`, shared with the API routes): a row a person made. */
export function isForgedVesselRow(row: AgentRowFacts): boolean {
  return isUserCreatedAgentRow(row)
}

/**
 * Whether a database-resolved profile subject must be projected for a viewer who is not entitled.
 *
 * Wider than {@link isForgedVesselRow} on purpose. The canonical figures never reach this check
 * (they resolve from code), and the seeded planetary / moon rows are the only other rows that are
 * public by construction, and they are recognisable by id. Every other database row is somebody's
 * creation: the Python API's `POST /api/agents` is anonymous and its rows carry neither marker the
 * predicate above looks for, so a deny-list of eras would call them public. The profile page
 * fails closed instead.
 */
export function isRestrictedProfileRow(row: AgentRowFacts): boolean {
  if (isForgedVesselRow(row)) return true
  return !classifyAgent(row.agentId).isSprite
}

// ── Who may see it ───────────────────────────────────────────────────────────

/**
 * Who is looking, as far as the privacy decision cares. Built server-side from the session and
 * `created_agents`; never from anything the browser sent.
 */
export interface ForgedViewer {
  /** DB-verified admin (`requireAdmin`), not the session's role claim. */
  isAdmin: boolean
  userId: string | null
  /** `historical_agents.agentId`s this viewer forged. */
  creatorAgentIds: ReadonlySet<string>
  /** True when who-is-looking could not be established (a lookup threw). Fail-closed, but say so. */
  degraded: boolean
}

export const ANONYMOUS_VIEWER: ForgedViewer = Object.freeze({
  isAdmin: false,
  userId: null,
  creatorAgentIds: new Set<string>(),
  degraded: false,
})

/** Admin, or the signed-in person who forged this vessel. Nobody else. */
export function isEntitledToForgedVessel(row: AgentRowFacts, viewer: ForgedViewer): boolean {
  if (viewer.isAdmin) return true
  if (row.agentId && viewer.creatorAgentIds.has(row.agentId)) return true
  if (viewer.userId && row.creatorId && row.creatorId === viewer.userId) return true
  return false
}

// ── The projection of a whole agent ──────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined

/** Keeps the named string fields of each record, drops the rest. */
function pickRecords<K extends string>(value: unknown, keys: readonly K[]): Record<K, string>[] {
  if (!Array.isArray(value)) return []
  const out: Record<K, string>[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const picked = {} as Record<K, string>
    for (const key of keys) {
      const v = str(item[key])
      if (v !== undefined) picked[key] = v
    }
    if (Object.keys(picked).length > 0) out.push(picked)
  }
  return out
}

/**
 * The Sacred 7, rounded to the whole numbers the page prints. See the module note: the twelve
 * planetary stats are each a single longitude and are not carried at all.
 */
function publicSacredStats(stats: unknown): CraftedAgent['sacredStats'] {
  if (!isRecord(stats)) return undefined
  const out: Record<string, number> = {}
  for (const key of SACRED_STAT_KEYS) {
    const value = num(stats[key])
    if (value === undefined) return undefined
    out[key] = Math.round(value)
  }
  return out as unknown as CraftedAgent['sacredStats']
}

/**
 * The stranger's view of a forged vessel, built field by field from an allow-list. Not a clone
 * with some keys deleted: a key that is not named here does not exist on the result.
 *
 * Dropped, among others: birth date, time and coordinates; every natal body but the Sun sign (and
 * its degree); ascendant, midheaven, houses, aspects; `personality.core` (where the owner's
 * about-yourself, life story, poetry and values land); `appearance.aura` (the forge stores its
 * source charts there); the planetary stats; the creation story and synthesis.
 */
export function projectForgedAgentForPublic(agent: CraftedAgent): CraftedAgent {
  const source = agent as unknown as Record<string, any>
  const consciousness = isRecord(source.consciousness) ? source.consciousness : {}
  const personality = isRecord(source.personality) ? source.personality : {}
  const abilities = isRecord(source.abilities) ? source.abilities : {}
  const appearance = isRecord(source.appearance) ? source.appearance : {}
  const stats = isRecord(source.stats) ? source.stats : {}
  const birthData = isRecord(source.birthData) ? source.birthData : {}

  const natalChart = projectPublicNatalChart(consciousness.natalChart)
  const projected = {
    id: String(source.id ?? ''),
    name: String(source.name ?? ''),
    title: String(source.title ?? ''),
    birthData: projectPublicBirthData(birthData.location),
    consciousness: {
      ...(natalChart ? { natalChart } : {}),
      monicaConstant: num(consciousness.monicaConstant) ?? null,
      level: str(consciousness.level),
      dominantElement: str(consciousness.dominantElement),
      dominantModality: str(consciousness.dominantModality),
      signature: str(consciousness.signature),
    },
    personality: {
      traits: strings(personality.traits),
      shadows: pickRecords(personality.shadows, ['type', 'description', 'transformationPath']),
      gifts: pickRecords(personality.gifts, ['type', 'description', 'expression']),
      challenges: pickRecords(personality.challenges, ['type', 'description', 'growthOpportunity']),
      currentMood: str(personality.currentMood),
      evolutionStage: num(personality.evolutionStage) ?? 0,
    },
    abilities: {
      specialty: str(abilities.specialty),
      wisdomDomains: strings(abilities.wisdomDomains),
      teachingStyle: str(abilities.teachingStyle),
      resonanceType: str(abilities.resonanceType),
      uniquePower: str(abilities.uniquePower),
    },
    appearance: {
      avatar: str(appearance.avatar),
      color: str(appearance.color),
      symbol: str(appearance.symbol),
    },
    stats: {
      conversations: num(stats.conversations),
      wisdomShared: num(stats.wisdomShared),
      resonanceScore: num(stats.resonanceScore),
      evolutionPoints: num(stats.evolutionPoints),
      lastActive: stats.lastActive,
    },
    sacredStats: publicSacredStats(source.sacredStats),
  }
  return projected as unknown as CraftedAgent
}

/** What the progression panel says in place of the chart-derived numbers it does not get. */
export const PRIVATE_PROGRESSION_REASON =
  'Chart-derived ratings are private to the creator of this vessel.'

/**
 * The stranger's progression: the permanent level and experience (earned from conversations, not
 * from the chart), and nothing computed from the natal degrees. `stats`, `statDeltas`,
 * `esmsAxisAttribution`, `transitDelta` and the overalls are all functions of the exact
 * longitudes; see the module note.
 */
export function projectProgressionForPublic(
  progression: AgentProgressionProfile
): AgentProgressionProfile {
  return {
    agentId: progression.agentId,
    vesselLevel: progression.vesselLevel,
    totalXp: progression.totalXp,
    xpToNextLevel: progression.xpToNextLevel,
    levelBoost: progression.levelBoost,
    baseOverall: null,
    trainedOverall: null,
    currentOverall: null,
    transitDelta: null,
    progressionStatus: 'unavailable',
    asOf: null,
    expBreakdown: progression.expBreakdown,
    trainingEvidence: progression.trainingEvidence,
    stats: null,
    statDeltas: null,
    esmsAxisAttribution: null,
    reasons: [PRIVATE_PROGRESSION_REASON],
  }
}
