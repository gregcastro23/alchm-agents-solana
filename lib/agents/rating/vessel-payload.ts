/**
 * Assembles the `RatedAgentPayload` the rating API serves and `pentacles` consumes.
 *
 * Pure: every input (the agent, its ESMS holdings, the live sky) is passed in, so the same
 * assembly serves the GET and POST routes and is testable without a database or a network.
 *
 *   stats ──► rateStats ──► ovr, ratings, relativeAdvantage, archetype
 *   stats + ESMS holdings + natal chart ──► evaluateSeals ──► seals
 *   live sky (+ Monica, + natal chart) ──► calculateResonanceSurge ──► surge
 *   stats + seals + surge ──► computeZoneSynergies ──► zoneSynergies
 *
 * Nothing is derived twice: stats come from `deriveSacredStats` (or the persisted Sacred 7
 * columns of a forged vessel), thermodynamics from `lib/thermodynamics/kalchm.ts` via the
 * live-sky module, ESMS holdings from the resolver.
 *
 * ## Degraded reads announce themselves
 *
 * If the live sky cannot be computed, `surge` is `null` and `degraded.sky` says why; if the
 * ESMS ledger could not be read, `esmsSource` is `'fallback'` and `degraded.esms` says why.
 * A degraded answer is never shaped like a healthy one.
 */
import type { CraftedAgent } from '@/lib/agent-types'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import type { ResolvedEsmsBalances } from './esms-balance-resolver'
import type { LiveSky } from './live-sky'
import {
  CORE_STAT_KEYS,
  VESSEL_RATING_SCALE,
  rateStats,
  type CoreStats,
  type VesselArchetype,
} from './ovr-archetype'
import { bestZoneId, computeZoneSynergies, type ZoneSynergy } from './pentacle-contest'
import {
  calculateResonanceSurge,
  evaluateSeals,
  type AlchemicalSeal,
  type EsmsHoldings,
  type NatalChartInput,
  type ResonanceSurgeState,
} from './seals-surge'
import {
  VESSEL_APPEARANCE_REGISTRY,
  appearanceFromSeed,
  deriveVesselAppearance,
  type VesselAppearanceProfile,
} from './vessel-appearance'

/**
 * Pentacles' default avatar id and the roster agent it is rated from. The game knows
 * Gregory's vessel as `user-avatar-neo`; ASOL knows the person as `greg-castro-1991`. The
 * look is hand-authored under the avatar id; the stats and natal chart are his roster agent's.
 */
export const VESSEL_ALIASES: Readonly<Record<string, string>> = {
  'user-avatar-neo': 'greg-castro-1991',
}

/** Something that can be rated: stats, an optional natal chart, a look. */
export interface RatableVessel {
  agentId: string
  name: string
  origin: 'roster' | 'forged'
  stats: CoreStats
  natalChart: NatalChartInput | null
  appearance: VesselAppearanceProfile
}

function pickCoreStats(stats: Record<string, number>): CoreStats {
  const out = {} as CoreStats
  for (const key of CORE_STAT_KEYS) out[key] = stats[key]
  return out
}

/** A roster agent under `agentId` (which may be an alias such as `user-avatar-neo`). */
export function ratableFromRoster(agent: CraftedAgent, agentId = agent.id): RatableVessel {
  const appearance = VESSEL_APPEARANCE_REGISTRY[agentId] ?? deriveVesselAppearance(agent)
  return {
    agentId,
    name: agent.name,
    origin: 'roster',
    stats: pickCoreStats(deriveSacredStats(agent) as unknown as Record<string, number>),
    natalChart: agent.consciousness?.natalChart ?? null,
    appearance,
  }
}

/** The columns of a forged `historical_agents` row that rating reads. */
export interface ForgedAgentRow {
  agentId: string
  name: string
  natalChart?: unknown
  monicaConstant?: number | null
  birthYear?: number | null
  powerScore?: number | null
  resonanceScore7?: number | null
  wisdomScore?: number | null
  charismaScore?: number | null
  intuitionScore?: number | null
  adaptabilityScore?: number | null
  vitalityScore?: number | null
}

function asPlanets(natalChart: unknown): Record<string, { sign: string; degree: number }> | null {
  if (!natalChart || typeof natalChart !== 'object') return null
  const planets = (natalChart as { planets?: unknown }).planets
  if (!planets || typeof planets !== 'object') return null
  const out: Record<string, { sign: string; degree: number }> = {}
  for (const [body, value] of Object.entries(planets as Record<string, unknown>)) {
    const sign = (value as { sign?: unknown } | null)?.sign
    const degree = (value as { degree?: unknown } | null)?.degree
    if (typeof sign === 'string')
      out[body] = { sign, degree: typeof degree === 'number' ? degree : 0 }
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * A user-forged vessel (a `historical_agents` row written by the Philosopher's Stone forge).
 * Persisted Sacred 7 scores are used when present (any non-zero, all finite, 0–100);
 * otherwise the stats are derived from the stored natal chart exactly as for a roster agent.
 * Returns `null` when there is neither, rather than rating an invented chart.
 *
 * The stored chart carries no provenance. Forged charts come from the owner's own birth data
 * through the app's calculator, so they are allowed to count toward Celestial.
 */
export function ratableFromForgedRow(row: ForgedAgentRow): RatableVessel | null {
  const planets = asPlanets(row.natalChart)
  const natalChart: NatalChartInput | null = planets ? { planets } : null

  const persisted = [
    row.powerScore,
    row.resonanceScore7,
    row.wisdomScore,
    row.charismaScore,
    row.intuitionScore,
    row.adaptabilityScore,
    row.vitalityScore,
  ]
  const usable =
    persisted.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) &&
    persisted.some(v => (v as number) > 0)

  let stats: CoreStats
  if (usable) {
    const [power, resonance, wisdom, charisma, intuition, adaptability, vitality] =
      persisted as number[]
    stats = { power, resonance, wisdom, charisma, intuition, adaptability, vitality }
  } else if (planets) {
    const minimal = {
      consciousness: {
        natalChart: { planets },
        monicaConstant: Number.isFinite(row.monicaConstant) ? (row.monicaConstant as number) : 0,
      },
    } as unknown as CraftedAgent
    stats = pickCoreStats(deriveSacredStats(minimal) as unknown as Record<string, number>)
  } else {
    return null
  }

  const archetype = rateStats(stats).archetype
  return {
    agentId: row.agentId,
    name: row.name,
    origin: 'forged',
    stats,
    natalChart,
    appearance:
      VESSEL_APPEARANCE_REGISTRY[row.agentId] ??
      appearanceFromSeed(row.agentId, archetype.primary, 'astral'),
  }
}

// ─── The payload ─────────────────────────────────────────────────────────────

export interface RatedAgentPayload {
  agentId: string
  name: string
  scale: typeof VESSEL_RATING_SCALE
  ovr: number
  ratings: ReturnType<typeof rateStats>['ratings']
  spread: number
  relativeAdvantage: ReturnType<typeof rateStats>['relativeAdvantage']
  archetype: VesselArchetype
  esmsBalances: EsmsHoldings
  esmsSource: ResolvedEsmsBalances['esmsSource']
  seals: AlchemicalSeal[]
  /** `null` when the live sky could not be computed (see `degraded.sky`). */
  surge: ResonanceSurgeState | null
  appearance: VesselAppearanceProfile
  zoneSynergies: ZoneSynergy[]
  bestZoneId: number
  /** Which sky the surge was read from, and its inputs; `null` with `surge`. */
  sky: {
    source: LiveSky['source']
    at: string
    heat: number
    reactivity: number
    monica: number | null
  } | null
  /** Present only when something was read in a degraded way. */
  degraded?: { esms?: string; sky?: string }
}

export interface BuildPayloadInput {
  vessel: RatableVessel
  balances: ResolvedEsmsBalances
  /** The live sky, or `null` when it could not be computed. */
  sky: LiveSky | null
  /** Why `sky` is `null`. */
  skyError?: string
}

export function buildRatedAgentPayload({
  vessel,
  balances,
  sky,
  skyError,
}: BuildPayloadInput): RatedAgentPayload {
  const rating = rateStats(vessel.stats)
  const seals = evaluateSeals({
    stats: vessel.stats,
    esmsBalances: balances.balances,
    natalChart: vessel.natalChart,
  })
  const surge = sky
    ? calculateResonanceSurge({
        thermodynamics: sky.thermodynamics,
        monica: sky.monica,
        natalChart: vessel.natalChart,
        sky: sky.bodies,
      })
    : null
  const contestant = { stats: vessel.stats, seals, surge }

  const degraded: NonNullable<RatedAgentPayload['degraded']> = {}
  if (balances.degraded) degraded.esms = balances.degraded.reason
  if (!sky) degraded.sky = skyError ?? 'live sky unavailable'

  return {
    agentId: vessel.agentId,
    name: vessel.name,
    scale: VESSEL_RATING_SCALE,
    ovr: rating.ovr,
    ratings: rating.ratings,
    spread: rating.spread,
    relativeAdvantage: rating.relativeAdvantage,
    archetype: rating.archetype,
    esmsBalances: balances.balances,
    esmsSource: balances.esmsSource,
    seals,
    surge,
    appearance: vessel.appearance,
    zoneSynergies: computeZoneSynergies(contestant),
    bestZoneId: bestZoneId(contestant),
    sky: sky
      ? {
          source: sky.source,
          at: sky.at,
          heat: sky.thermodynamics.heat,
          reactivity: sky.thermodynamics.reactivity,
          monica: sky.monica,
        }
      : null,
    ...(Object.keys(degraded).length > 0 ? { degraded } : {}),
  }
}

// ─── Roster summary (no ledger, no sky) ──────────────────────────────────────

export interface RosterSummaryEntry {
  agentId: string
  name: string
  ovr: number
  archetype: VesselArchetype
  era: VesselAppearanceProfile['era']
  crownStyle: VesselAppearanceProfile['headSilhouette']['crownStyle']
  signatureRelic: VesselAppearanceProfile['signatureRelic']
}

/** One light row per vessel for the roster listing; reads neither the ledger nor the sky. */
export function summarizeVessel(vessel: RatableVessel): RosterSummaryEntry {
  const rating = rateStats(vessel.stats)
  return {
    agentId: vessel.agentId,
    name: vessel.name,
    ovr: rating.ovr,
    archetype: rating.archetype,
    era: vessel.appearance.era,
    crownStyle: vessel.appearance.headSilhouette.crownStyle,
    signatureRelic: vessel.appearance.signatureRelic,
  }
}
