/**
 * Assembles the rated-vessel payload the rating API serves and `pentacles` consumes.
 *
 * The payload IS the Pentacles rating contract's `RatedAgentPayload`
 * (`lib/agents/rating-contract.ts`, ratified in #65) — `key`, `handle`, `faction`, `ratings`,
 * `relativeAdvantage`, `ovr`, `archetype`, `esms`, `seals`, `surge`, `appearance` — plus the
 * fields only a live, server-side rating can know (`esmsSource`, `sealProgress`, `sky`,
 * `zoneSynergies`, `bestZoneId`, `degraded`). One deliberate difference: `surge` is `null`
 * (with `degraded.sky`) when the live sky could not be computed, because a calm-looking surge
 * built from no sky would impersonate a real one.
 *
 * Pure: every input (the agent, its ESMS holdings, the live sky) is passed in, so the same
 * assembly serves the GET and POST routes and is testable without a database or a network.
 *
 *   stats ──► rateStats ──► ovr, ratings, relativeAdvantage, archetype        (the contract's)
 *   stats + ESMS holdings + natal chart ──► evaluateSeals ──► seals, sealProgress
 *   live sky (+ Monica, + natal chart, + archetype) ──► calculateResonanceSurge ──► surge
 *   ratings + seals + surge ──► computeZoneSynergies ──► zoneSynergies
 *   agent id (+ faction, archetype) ──► resolveAgentAppearance ──► appearance (the manifest's)
 *
 * Nothing is derived twice: stats come from `deriveSacredStats` (or the persisted Sacred 7
 * columns of a forged vessel), thermodynamics from `lib/thermodynamics/kalchm.ts` via the
 * live-sky module, ESMS holdings from the resolver, the look from the contract's manifest.
 *
 * ## Degraded reads announce themselves
 *
 * If the live sky cannot be computed, `surge` is `null` and `degraded.sky` says why; if the
 * ESMS ledger could not be read, `esmsSource` is `'fallback'` and `degraded.esms` says why.
 * A degraded answer is never shaped like a healthy one.
 */
import type { CraftedAgent } from '@/lib/agent-types'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import { getRulingPlanet } from '@/lib/astrological-data'
import { ZODIAC_SIGNS } from '@/lib/staking/elements'
import type { AgentProgressionProfile } from '../leveling-service'
import { FIXTURE_AGENTS, type RatedAgentPayload } from '../rating-contract'
import {
  CANONICAL_ROSTER_71,
  resolveAgentAppearance,
  type VesselAppearanceProfile,
} from '../vessel-appearance-manifest'
import type { ResolvedEsmsBalances } from './esms-balance-resolver'
import type { LiveSky } from './live-sky'
import { CORE_STAT_KEYS, VESSEL_RATING_SCALE, rateStats, type CoreStats } from './ovr-archetype'
import { bestZoneId, computeZoneSynergies, type ZoneSynergy } from './pentacle-contest'
import {
  calculateResonanceSurge,
  earnedSeals,
  evaluateSeals,
  type NatalChartInput,
  type ResonanceSurgeReading,
  type SealProgress,
} from './seals-surge'

/**
 * Pentacles' default avatar id and the roster agent it is rated from. The game knows
 * Gregory's vessel as `user-avatar-neo`; ASOL knows the person as `greg-castro-1991`. The
 * look is hand-authored under the avatar id; the stats and natal chart are his roster agent's.
 */
export const VESSEL_ALIASES: Readonly<Record<string, string>> = {
  'user-avatar-neo': 'greg-castro-1991',
}

/**
 * The roster agent an alias stands for, or `undefined`. An own-property lookup: a request id
 * such as `constructor` or `toString` reaches `Object.prototype` through a bare index.
 */
export function resolveVesselAlias(agentId: string): string | undefined {
  return Object.hasOwn(VESSEL_ALIASES, agentId) ? VESSEL_ALIASES[agentId] : undefined
}

/** The ten classical bodies in the contract's faction order (a planet index, 0 = Sun). */
export const FACTION_NAMES = [
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

type Provenance = NonNullable<RatedAgentPayload['provenance']>

/** Something that can be rated: stats, an optional natal chart, a faction, a look. */
export interface RatableVessel {
  agentId: string
  name: string
  origin: 'roster' | 'forged'
  stats: CoreStats
  natalChart: NatalChartInput | null
  /** The contract's `faction`: a planet index 0–9 (see `FACTION_NAMES`). */
  faction: number
  /** The natal chart is a stacked placeholder; such a chart never earns Celestial. */
  isPlaceholder: boolean
  provenance: Provenance
  appearance: VesselAppearanceProfile
  avatarModelUrl?: string
  headMeshUrl?: string
}

/** The manifest strips a trailing `-<digits>` (a birth-year suffix) when it looks an id up. */
const baseKey = (id: string): string => id.trim().toLowerCase().replace(/-\d+$/, '')

const ROSTER_FACTIONS: ReadonlyMap<string, number> = new Map(
  CANONICAL_ROSTER_71.map(entry => [baseKey(entry.key), entry.faction])
)

/** The contract's own pilots carry hand-authored factions (e.g. `user-avatar-neo` is the Sun's). */
const FIXTURE_FACTIONS: ReadonlyMap<string, number> = new Map(
  FIXTURE_AGENTS.map(fixture => [baseKey(fixture.key), fixture.faction])
)

/**
 * The contract's pilots also carry their own display `handle` and `provenance` (the avatar is
 * "Adept Neo", provenance `user`, not the roster agent's real name and `historical`); a pilot's
 * identity fields come from the contract, so the same key reads the same on every endpoint.
 */
const FIXTURE_IDENTITY: ReadonlyMap<string, { handle: string; provenance?: Provenance }> = new Map(
  FIXTURE_AGENTS.map(fixture => [
    baseKey(fixture.key),
    { handle: fixture.handle, provenance: fixture.provenance },
  ])
)

/** The ruling planet of a sign as a faction index; `undefined` when the sign has none. */
function factionOfSign(sign: string | undefined): number | undefined {
  // `getRulingPlanet` reads any unknown sign as Aries (Mars), so only a real sign gets a ruler.
  if (sign === undefined) return undefined
  const wanted = sign.trim().toLowerCase()
  if (!ZODIAC_SIGNS.some(known => known.toLowerCase() === wanted)) return undefined
  const index = (FACTION_NAMES as readonly string[]).indexOf(getRulingPlanet(sign))
  return index >= 0 ? index : undefined
}

/**
 * A vessel's faction: a contract pilot's own, else the roster's canonical one
 * (`CANONICAL_ROSTER_71`), else the ruler of its natal Sun sign, else 0 (the manifest's default).
 */
function factionOf(agentId: string, natalChart: NatalChartInput | null): number {
  const key = baseKey(agentId)
  return (
    FIXTURE_FACTIONS.get(key) ??
    ROSTER_FACTIONS.get(key) ??
    factionOfSign(natalChart?.planets.Sun?.sign) ??
    0
  )
}

/** A roster agent under `agentId` (which may be an alias such as `user-avatar-neo`). */
export function ratableFromRoster(agent: CraftedAgent, agentId = agent.id): RatableVessel {
  const natalChart = agent.consciousness?.natalChart ?? null
  const isPlaceholder = natalChart?.provenance === 'placeholder'
  const key = baseKey(agentId)
  const faction = factionOf(agentId, natalChart)
  const pilot = FIXTURE_IDENTITY.get(key)
  // The manifest's own look for a vessel it knows; for the one roster agent it does not list
  // (the faction then comes from the natal Sun sign), a look drawn in that faction's colours.
  const known = FIXTURE_FACTIONS.has(key) || ROSTER_FACTIONS.has(key)
  const appearance = known
    ? resolveAgentAppearance(agentId)
    : resolveAgentAppearance(agentId, faction)
  return {
    agentId,
    name: pilot?.handle ?? agent.name,
    origin: 'roster',
    stats: pickCoreStats(deriveSacredStats(agent) as unknown as Record<string, number>),
    natalChart,
    faction,
    isPlaceholder,
    provenance: isPlaceholder ? 'placeholder' : (pilot?.provenance ?? 'historical'),
    appearance,
    ...((agent.avatarModelUrl ?? appearance.avatarModelUrl)
      ? { avatarModelUrl: agent.avatarModelUrl ?? appearance.avatarModelUrl }
      : {}),
    ...((agent.headMeshUrl ?? appearance.headMeshUrl)
      ? { headMeshUrl: agent.headMeshUrl ?? appearance.headMeshUrl }
      : {}),
  }
}

function pickCoreStats(stats: Record<string, number>): CoreStats {
  const out = {} as CoreStats
  for (const key of CORE_STAT_KEYS) out[key] = stats[key]
  return out
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

type StoredPlanets = Record<string, { sign: string; degree: number }>

/** Longitude within a sign, and a whole-zodiac ascendant: anything else is not a chart. */
const DEGREES_IN_SIGN = 30
const DEGREES_IN_ZODIAC = 360
/** `monicaConstant` enters the Sacred 7 formulas as `/ 10`; the roster peaks at 7.77. */
const MONICA_RATING_MAX = 10

const inRange = (value: unknown, max: number): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * The bodies of a stored natal chart, in either shape the app writes:
 *
 *   • `{ planets: { Sun: { sign, degree } } }` — the roster / seeded shape;
 *   • `{ tropical: { CelestialBodies: { all: [{ label, Sign: { label }, degrees }] } } }` — what
 *     `generateAccurateHoroscope` returns and the forge persists (`app/api/create-agent`).
 *
 * `null` when neither yields a body, so a chart that says nothing is never rated — and `null`
 * when ANY body carries a degree that is not within its sign (0–30): the writers store a
 * client-supplied chart (`philosophers-stone/create` takes `z.any()`), and a degree of 1e9
 * would drive every Sacred 7 stat to 100. A chart that is wrong is not rated at all.
 */
function asPlanets(natalChart: unknown): StoredPlanets | null {
  if (!isRecord(natalChart)) return null
  const out: StoredPlanets = {}

  if (isRecord(natalChart.planets)) {
    for (const [body, value] of Object.entries(natalChart.planets)) {
      const sign = isRecord(value) ? value.sign : undefined
      const degree = isRecord(value) ? value.degree : undefined
      if (typeof sign !== 'string') continue
      if (typeof degree === 'number' && !inRange(degree, DEGREES_IN_SIGN)) return null
      out[body] = { sign, degree: typeof degree === 'number' ? degree : 0 }
    }
  } else if (isRecord(natalChart.tropical)) {
    const bodies = isRecord(natalChart.tropical.CelestialBodies)
      ? natalChart.tropical.CelestialBodies.all
      : undefined
    if (Array.isArray(bodies)) {
      for (const entry of bodies) {
        if (!isRecord(entry) || typeof entry.label !== 'string') continue
        const sign = isRecord(entry.Sign) ? entry.Sign.label : undefined
        if (typeof sign !== 'string') continue
        if (typeof entry.degrees === 'number' && !inRange(entry.degrees, DEGREES_IN_SIGN)) {
          return null
        }
        out[entry.label] = {
          sign,
          degree: typeof entry.degrees === 'number' ? entry.degrees : 0,
        }
      }
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * The ascendant as an ecliptic longitude, in the form `deriveSacredStats` reads: a bare finite
 * number (0–360), or the forge's `tropical.Ascendant` (`{ Sign: { label }, degrees }`, degrees
 * within the sign, 0–30). `undefined` when the chart carries none (a non-finite or non-numeric
 * value counts as none); `null` when it carries one that cannot be a position — the chart is
 * then not rated, like an out-of-range body.
 */
function asAscendant(natalChart: unknown): number | undefined | null {
  if (!isRecord(natalChart)) return undefined
  const bare = natalChart.ascendant
  if (typeof bare === 'number' && Number.isFinite(bare)) {
    return inRange(bare, DEGREES_IN_ZODIAC) ? bare : null
  }
  const stored = isRecord(natalChart.tropical) ? natalChart.tropical.Ascendant : undefined
  if (!isRecord(stored) || !isRecord(stored.Sign) || typeof stored.Sign.label !== 'string') {
    return undefined
  }
  const index = (ZODIAC_SIGNS as readonly string[]).indexOf(stored.Sign.label)
  const degrees = stored.degrees
  if (index < 0 || typeof degrees !== 'number' || !Number.isFinite(degrees)) return undefined
  return inRange(degrees, DEGREES_IN_SIGN) ? index * 30 + degrees : null
}

/**
 * A user-forged vessel (a `historical_agents` row written by the Philosopher's Stone forge).
 * Persisted Sacred 7 scores are used when present (any non-zero, all finite, 0–100);
 * otherwise the stats are derived from the stored natal chart exactly as for a roster agent.
 * Returns `null` when there is neither, rather than rating an invented chart — and when the
 * chart it would derive from is not a chart (a degree outside its sign, an ascendant outside
 * the zodiac; see `asPlanets`), so a client-supplied number cannot mint a perfect vessel.
 * `monicaConstant` is clamped to 0–10, the domain the Sacred 7 formulas divide it by.
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
    const ascendant = asAscendant(row.natalChart)
    if (ascendant === null) return null
    const monica = Number.isFinite(row.monicaConstant) ? (row.monicaConstant as number) : 0
    const minimal = {
      consciousness: {
        natalChart: { planets, ...(ascendant === undefined ? {} : { ascendant }) },
        monicaConstant: Math.min(Math.max(monica, 0), MONICA_RATING_MAX),
      },
    } as unknown as CraftedAgent
    stats = pickCoreStats(deriveSacredStats(minimal) as unknown as Record<string, number>)
  } else {
    return null
  }

  const archetype = rateStats(stats).archetype
  const faction = factionOf(row.agentId, natalChart)
  const appearance = resolveAgentAppearance(row.agentId, faction, archetype)
  return {
    agentId: row.agentId,
    name: row.name,
    origin: 'forged',
    stats,
    natalChart,
    faction,
    isPlaceholder: false,
    provenance: 'user',
    appearance,
    ...(appearance.avatarModelUrl ? { avatarModelUrl: appearance.avatarModelUrl } : {}),
    ...(appearance.headMeshUrl ? { headMeshUrl: appearance.headMeshUrl } : {}),
  }
}

// ─── The payload ─────────────────────────────────────────────────────────────

/**
 * The contract's `RatedAgentPayload` plus what only a live rating knows. `surge` is the one
 * field whose type differs: `null` when the sky could not be computed (see `degraded.sky`), and
 * otherwise the contract's `ResonanceSurgeState` with how its meter was reached.
 */
export interface RatedVesselPayload extends Omit<RatedAgentPayload, 'surge' | 'appearance'> {
  /** Always present, unlike the contract's optional field. */
  appearance: VesselAppearanceProfile
  surge: ResonanceSurgeReading | null
  scale: typeof VESSEL_RATING_SCALE
  /** Every Seal's standing, including those not earned: `nextTier`, `blockedBy`, `maxTier`. */
  sealProgress: SealProgress[]
  esmsSource: ResolvedEsmsBalances['esmsSource']
  zoneSynergies: ZoneSynergy[]
  bestZoneId: number
  /** Which sky the surge was read from, and its raw inputs; `null` with `surge`. */
  sky: {
    source: LiveSky['source']
    at: string
    /** The engine's raw heat and reactivity; `surge.heat`/`surge.reactivity` are their ramp positions. */
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
  /**
   * The vessel's two-level progression (`computeAgentProgression`). When given, the contract's
   * progression fields (`vesselLevel`, `totalXp`, `currentOverall`, ...) ride in the payload; a
   * profile that could not be computed carries `progressionStatus: 'unavailable'` and null
   * numbers, so an unread level is never shown as a level of 1.
   */
  progression?: AgentProgressionProfile | null
}

/** The twelve planetary stats the contract's `planetaryStats` carries, in its order. */
const PLANETARY_STAT_KEYS = [
  'solarAgency',
  'lunarReceptivity',
  'mercurialVelocity',
  'venusianCoherence',
  'martialImpetus',
  'jovianExpansion',
  'saturnianStructure',
  'chironicAdaptation',
  'uranianSurprisal',
  'neptunianResonance',
  'plutonicIntegration',
  'kineticAlignment',
] as const

/**
 * The contract's optional progression fields (`RatedAgentPayload.vesselLevel` ... `esmsAxisAttribution`)
 * from a progression profile. Pure; `ratingAsOf` and `progressionReasons` are the profile's
 * `asOf` and `reasons`.
 */
export function progressionFields(
  progression: AgentProgressionProfile
): Pick<
  RatedAgentPayload,
  | 'vesselLevel'
  | 'totalXp'
  | 'xpToNextLevel'
  | 'levelBoost'
  | 'baseOverall'
  | 'trainedOverall'
  | 'currentOverall'
  | 'transitDelta'
  | 'progressionStatus'
  | 'ratingAsOf'
  | 'progressionReasons'
  | 'expBreakdown'
  | 'trainingEvidence'
  | 'planetaryStats'
  | 'statDeltas'
  | 'esmsAxisAttribution'
> {
  const stats = progression.stats as Record<string, number> | null
  const planetaryStats = stats
    ? (Object.fromEntries(PLANETARY_STAT_KEYS.map(key => [key, stats[key]])) as Record<
        string,
        number
      >)
    : null
  return {
    vesselLevel: progression.vesselLevel,
    totalXp: progression.totalXp,
    xpToNextLevel: progression.xpToNextLevel,
    levelBoost: progression.levelBoost,
    baseOverall: progression.baseOverall,
    trainedOverall: progression.trainedOverall,
    currentOverall: progression.currentOverall,
    transitDelta: progression.transitDelta,
    progressionStatus: progression.progressionStatus,
    ratingAsOf: progression.asOf,
    progressionReasons: progression.reasons,
    expBreakdown: progression.expBreakdown as Record<string, number> | null,
    // The contract still types this as { status: 'verified' | ..., verifiedItems } while the
    // experience ledger (#69) emits { status: 'verified-manifests' | 'unknown', importedConversations }.
    // The ledger's own shape is what the API has served since #69, so it is passed through as-is
    // rather than re-labelled; `rating-contract.ts` is where the type should catch up.
    trainingEvidence:
      progression.trainingEvidence as unknown as RatedAgentPayload['trainingEvidence'],
    planetaryStats,
    statDeltas: progression.statDeltas as Record<string, number> | null,
    esmsAxisAttribution: progression.esmsAxisAttribution ?? null,
  }
}

export function buildRatedAgentPayload({
  vessel,
  balances,
  sky,
  skyError,
  progression,
}: BuildPayloadInput): RatedVesselPayload {
  const rating = rateStats(vessel.stats)
  const sealProgress = evaluateSeals({
    stats: vessel.stats,
    esmsBalances: balances.balances,
    natalChart: vessel.natalChart,
  })
  const seals = earnedSeals(sealProgress)
  const surge = sky
    ? calculateResonanceSurge({
        thermodynamics: sky.thermodynamics,
        monica: sky.monica,
        archetype: rating.archetype,
        natalChart: vessel.natalChart,
        sky: sky.bodies,
      })
    : null
  const contestant = { ratings: rating.ratings, seals, surge }

  const degraded: NonNullable<RatedVesselPayload['degraded']> = {}
  if (balances.degraded) degraded.esms = balances.degraded.reason
  if (!sky) degraded.sky = skyError ?? 'live sky unavailable'

  return {
    key: vessel.agentId,
    handle: vessel.name,
    faction: vessel.faction,
    factionName: FACTION_NAMES[vessel.faction] ?? FACTION_NAMES[0],
    isPlaceholder: vessel.isPlaceholder,
    provenance: vessel.provenance,
    appearance: vessel.appearance,
    ...(vessel.avatarModelUrl ? { avatarModelUrl: vessel.avatarModelUrl } : {}),
    ...(vessel.headMeshUrl ? { headMeshUrl: vessel.headMeshUrl } : {}),
    ratings: rating.ratings,
    relativeAdvantage: rating.relativeAdvantage,
    ovr: rating.ovr,
    archetype: rating.archetype,
    esms: balances.balances,
    seals,
    surge,
    scale: VESSEL_RATING_SCALE,
    sealProgress,
    esmsSource: balances.esmsSource,
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
    ...(progression ? progressionFields(progression) : {}),
    ...(Object.keys(degraded).length > 0 ? { degraded } : {}),
  }
}

/**
 * The payload as the contract's own `RatedAgentPayload` (what `feedStreamBus.recordAgentRating`
 * takes), or `null` when there is no surge to put in it — a payload built from no sky is never
 * published as if it had one. Extension fields ride along. The `[slug]/ratings` route uses it to
 * publish to the feed; `GET /api/agents/rating` does not (a public GET must not write to a live
 * stream).
 */
export function asContractPayload(payload: RatedVesselPayload): RatedAgentPayload | null {
  return payload.surge === null ? null : { ...payload, surge: payload.surge }
}

// ─── Roster summary (no ledger, no sky) ──────────────────────────────────────

export interface RosterSummaryEntry {
  key: string
  handle: string
  faction: number
  factionName: string
  ovr: number
  archetype: RatedVesselPayload['archetype']
  era: VesselAppearanceProfile['era']
  crownStyle: VesselAppearanceProfile['headSilhouette']['crownStyle']
  signatureRelic: VesselAppearanceProfile['signatureRelic']
}

/** One light row per vessel for the roster listing; reads neither the ledger nor the sky. */
export function summarizeVessel(vessel: RatableVessel): RosterSummaryEntry {
  const rating = rateStats(vessel.stats)
  return {
    key: vessel.agentId,
    handle: vessel.name,
    faction: vessel.faction,
    factionName: FACTION_NAMES[vessel.faction] ?? FACTION_NAMES[0],
    ovr: rating.ovr,
    archetype: rating.archetype,
    era: vessel.appearance.era,
    crownStyle: vessel.appearance.headSilhouette.crownStyle,
    signatureRelic: vessel.appearance.signatureRelic,
  }
}
