/**
 * ============================================================================
 * Pentacles — Vessel Rating, Archetype, Alchemical Seals & Resonance Surge
 * Synchronized with Pentacles 3D Rating Contract (`rating-contract.ts`)
 * ============================================================================
 *
 * Strict TypeScript contract and calculation engine for the Pentacle Vessel
 * Rating Scale (25–99), Ordered Weighted Averaging (OWA) OVR calculation,
 * relative advantage archetypes, ESMS Alchemical Seals, and live ephemeris
 * Resonance Surge ignition.
 */

import { type VesselAppearanceProfile, resolveAgentAppearance } from './vessel-appearance-manifest'
import { SACRED_STAT_KEYS, type SacredStatKey } from './sacred-stat-keys'
export { SACRED_STAT_KEYS, type SacredStatKey } from './sacred-stat-keys'
/** Compatibility alias for rendering consumers; the seven canonical keys remain authoritative. */
export type SacredStat = SacredStatKey

export const ESMS_KEYS = ['spirit', 'essence', 'matter', 'substance'] as const
export type EsmsKey = (typeof ESMS_KEYS)[number]

export const SEAL_TIERS = ['Copper', 'Silver', 'Gold', 'Astral', 'Celestial'] as const

export type SealTier = (typeof SEAL_TIERS)[number]

export type SurgeType = 'inferno' | 'tempest' | 'equilibrium'
export type MonicaState = 'absent' | 'divergent' | 'convergent' | 'equilibrium'

export interface EsmsBalances {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export interface VesselArchetype {
  title: string
  primary: SacredStatKey
  secondary: SacredStatKey
}

export interface AlchemicalSeal {
  id: string
  name: string
  category: EsmsKey | 'general'
  tier: SealTier
  description: string
  statKey?: SacredStatKey
  multiplier: number
}

export interface ResonanceSurgeState {
  meter: number // 0..100 linear p5-to-p95 ramp of normalized heat & reactivity
  active: boolean // triggers at meter >= 70 (~6% of real sky epochs)
  surgeType: SurgeType
  monica: number | null
  monicaState: MonicaState
  heat: number
  reactivity: number
  statBoosts: Partial<Record<SacredStatKey, number>>
}

export interface RatedAgentPayload {
  key: string
  handle: string
  faction: number // 0..9 planet index
  factionName: string
  isPlaceholder?: boolean
  provenance?: 'historical' | 'user' | 'placeholder'
  appearance?: VesselAppearanceProfile
  /** Same-origin `/avatars/<file>` portrait path, when the vessel has a painted portrait. */
  portraitUrl?: string
  avatarModelUrl?: string
  headMeshUrl?: string
  ratings: Record<SacredStatKey, number> // [25, 99] raw scale
  relativeAdvantage: Record<SacredStatKey, number> // delta against pinned roster baseline
  ovr: number // [25, 99] via OWA (1.6 top, 1.3 second, 1.0 rest)
  archetype: VesselArchetype
  esms: EsmsBalances
  seals: AlchemicalSeal[]
  surge: ResonanceSurgeState
  portraitUrl?: string
  // Enhanced Dynamic Leveling System (Vessel Level & Dynamic Current Overall)
  vesselLevel?: number | null // [1, 100] Permanent earned growth (never falls)
  totalXp?: number | null // Total accumulated Alchm EXP
  xpToNextLevel?: number | null // EXP needed for next Vessel Level (null at level 100)
  levelBoost?: number | null // Permanent additive boost to base overall
  baseOverall?: number | null // [25, 99] 19-stat composite before level boost
  trainedOverall?: number | null // [25, 99] Permanent baseline capability
  currentOverall?: number | null // [25, 99] Dynamic celestial OVR (rises/falls with sky)
  transitDelta?: number | null // Celestial transit adjustment [-8, +8]
  progressionStatus?: 'live' | 'estimated' | 'unavailable'
  ratingAsOf?: string | null
  progressionReasons?: string[]
  expBreakdown?: Record<string, number> | null // Category EXP: chat, training, actions, achievements, pentacles
  trainingEvidence?: { status: 'verified' | 'unverified' | 'unknown'; verifiedItems: number } | null
  planetaryStats?: Record<string, number> | null // [0, 100] Planetary 12
  statDeltas?: Record<string, number> | null // Active sky deltas
}

/** Pinned 71-agent roster baseline ratings and means */
export const ROSTER_BASELINE_RATINGS: Record<SacredStatKey, { mean: number; baseline: number }> =
  Object.freeze({
    power: { mean: 76.5, baseline: 63 },
    resonance: { mean: 67.0, baseline: 62 },
    wisdom: { mean: 68.5, baseline: 64 },
    charisma: { mean: 64.5, baseline: 61 },
    intuition: { mean: 66.0, baseline: 62 },
    adaptability: { mean: 67.5, baseline: 63 },
    vitality: { mean: 66.0, baseline: 62 },
  })

export const GLOBAL_ROSTER_MEAN = 68.0

/** Seal stat gating thresholds */
export const SEAL_STAT_GATES: Record<SealTier, number> = Object.freeze({
  Copper: 74,
  Silver: 80,
  Gold: 86,
  Astral: 91,
  Celestial: 96,
})

/** Exact planetary-agents ESMS balance gates (0.5 – 250.0 ESMS) */
export const SEAL_ESMS_GATES: Record<SealTier, number> = Object.freeze({
  Copper: 0.5,
  Silver: 2.0,
  Gold: 10.0,
  Astral: 50.0,
  Celestial: 250.0,
})

/** Multipliers applied to contested duel/tile interactions per seal tier */
export const SEAL_TIER_MULTIPLIERS: Record<SealTier, number> = Object.freeze({
  Copper: 1.05,
  Silver: 1.1,
  Gold: 1.18,
  Astral: 1.28,
  Celestial: 1.4,
})

/** Canonical 7 Alchemical Seals mapped to Sacred Stats */
export const CANONICAL_SEAL_CATALOG: Record<
  SacredStatKey,
  { name: string; category: EsmsKey; description: string }
> = Object.freeze({
  power: {
    name: 'Crucible Finisher',
    category: 'substance',
    description: 'Channels raw material pressure into irresistible decisive force.',
  },
  intuition: {
    name: 'Astral Vision',
    category: 'spirit',
    description: 'Pierces through veil illusions with sovereign foresight.',
  },
  vitality: {
    name: 'Immovable Foundation',
    category: 'matter',
    description: 'Anchors vessel integrity against territorial disruption.',
  },
  charisma: {
    name: 'Harmonic Sovereign',
    category: 'essence',
    description: 'Commands celestial resonance to align allied forces.',
  },
  resonance: {
    name: 'Tidal Chorus',
    category: 'essence',
    description: 'Attunes with the ambient frequencies of celestial transits.',
  },
  adaptability: {
    name: 'Quicksilver Pivot',
    category: 'spirit',
    description: 'Transmutes tactical posture across shifting court elements.',
  },
  wisdom: {
    name: "Philosopher's Stone",
    category: 'matter',
    description: 'Transforms accumulated experience into strategic mastery.',
  },
})

/** Canonical Vessel Archetype titles mapped by primary + secondary signature stats */
const ARCHETYPE_TITLE_MATRIX: Record<string, string> = {
  'power:vitality': 'Juggernaut Anchor',
  'power:resonance': 'Kinetic Resonator',
  'power:wisdom': 'Celestial Mechanist',
  'power:charisma': 'Dominant Commander',
  'power:intuition': 'Instinctive Striker',
  'power:adaptability': 'Dynamic Breaker',

  'resonance:intuition': 'Harmonic Seer',
  'resonance:wisdom': 'Synthesizing Sage',
  'resonance:power': 'Astral Striker',
  'resonance:charisma': 'Symphonic Virtuoso',
  'resonance:adaptability': 'Fluid Harmonizer',
  'resonance:vitality': 'Resilient Prism',

  'wisdom:power': 'Celestial Mechanist',
  'wisdom:adaptability': 'Polymath Craftsman',
  'wisdom:resonance': 'Universal Theorist',
  'wisdom:intuition': 'Illuminated Sage',
  'wisdom:charisma': 'Enlightened Statesman',
  'wisdom:vitality': 'Ancient Pillar',

  'charisma:power': 'Apex Sovereign',
  'charisma:wisdom': 'Inspiring Luminary',
  'charisma:intuition': 'Magnetic Visionary',
  'charisma:resonance': 'Resonant Herald',
  'charisma:adaptability': 'Charismatic Catalyst',
  'charisma:vitality': 'Indomitable Leader',

  'intuition:resonance': 'Reclusive Visionary',
  'intuition:wisdom': 'Mystic Oracle',
  'intuition:power': 'Prescient Ingressor',
  'intuition:charisma': 'Prophetic Guide',
  'intuition:adaptability': 'Intuitive Shifter',
  'intuition:vitality': 'Eternal Vigilant',

  'adaptability:wisdom': 'Polymath Craftsman',
  'adaptability:intuition': 'Quicksilver Weaver',
  'adaptability:power': 'Tactical Marauder',
  'adaptability:resonance': 'Harmonic Pivot',
  'adaptability:charisma': 'Diplomatic Emissary',
  'adaptability:vitality': 'Unshakable Survivor',

  'vitality:power': 'Ironbound Guardian',
  'vitality:wisdom': 'Enduring Sentinel',
  'vitality:resonance': 'Stalwart Conduit',
  'vitality:intuition': 'Steadfast Bastion',
  'vitality:charisma': 'Tenacious Champion',
  'vitality:adaptability': 'Adaptive Fortress',
}

/**
 * Clamp a stat value onto integer scale [25, 99].
 */
export function clampStat(val: number): number {
  if (Number.isNaN(val) || !Number.isFinite(val)) return 25
  return Math.max(25, Math.min(99, Math.round(val)))
}

/**
 * Compute Overall (OVR) via Ordered Weighted Averaging (OWA).
 * Pentacles client formula: weights 1.6 for top stat, 1.3 for second stat,
 * and 1.0 for the remaining five stats (mean of rest * 1.0).
 * Normalized by divisor 3.9 (1.6 + 1.3 + 1.0 = 3.9).
 */
export function computeOvr(
  ratings: Record<SacredStatKey, number>,
  options?: { divisor?: number }
): number {
  const sorted = SACRED_STAT_KEYS.map(k => clampStat(ratings[k] ?? 25)).sort((a, b) => b - a)

  const top1 = sorted[0]
  const top2 = sorted[1]
  const restAvg = sorted.slice(2).reduce((sum, v) => sum + v, 0) / 5

  const weightedSum = top1 * 1.6 + top2 * 1.3 + restAvg * 1.0
  const totalWeight = options?.divisor ?? 3.9

  return clampStat(Math.round(weightedSum / totalWeight))
}

/**
 * Compute relative advantage delta against pinned roster baseline.
 */
export function computeRelativeAdvantage(
  ratings: Record<SacredStatKey, number>
): Record<SacredStatKey, number> {
  const res: Partial<Record<SacredStatKey, number>> = {}
  for (const key of SACRED_STAT_KEYS) {
    const raw = clampStat(ratings[key] ?? 25)
    const base = ROSTER_BASELINE_RATINGS[key]?.baseline ?? 62
    res[key] = Math.round((raw - base) * 10) / 10
  }
  return res as Record<SacredStatKey, number>
}

/**
 * Resolve Archetype title and signature primary/secondary stats based on
 * relative advantage over baseline.
 */
export function resolveArchetype(
  relativeAdvantage: Record<SacredStatKey, number>
): VesselArchetype {
  const sorted = [...SACRED_STAT_KEYS].sort((a, b) => {
    const delta = (relativeAdvantage[b] ?? 0) - (relativeAdvantage[a] ?? 0)
    if (delta !== 0) return delta
    return SACRED_STAT_KEYS.indexOf(a) - SACRED_STAT_KEYS.indexOf(b)
  })

  const primary = sorted[0]
  const secondary = sorted[1]
  const key = `${primary}:${secondary}`
  const title =
    ARCHETYPE_TITLE_MATRIX[key] || `${capitalize(primary)}-${capitalize(secondary)} Specialist`

  return { title, primary, secondary }
}

/**
 * Compute mean-aligned rating for a specific stat to prevent high-mean stats (like power)
 * from unlocking seals disproportionately.
 */
export function computeMeanAlignedRating(statKey: SacredStatKey, rawRating: number): number {
  const statMean = ROSTER_BASELINE_RATINGS[statKey]?.mean ?? GLOBAL_ROSTER_MEAN
  return rawRating - statMean + GLOBAL_ROSTER_MEAN
}

/**
 * Evaluate seal tier given raw stat level, total ESMS holding, and provenance.
 * Uses mean-aligned stat evaluation.
 * Placeholder charts are strictly barred from Celestial.
 */
export function evaluateSealTier(
  statKey: SacredStatKey,
  rawStatScore: number,
  esmsBalance: number,
  isPlaceholder = false
): SealTier | null {
  const alignedScore = computeMeanAlignedRating(statKey, rawStatScore)

  const tiers: SealTier[] = ['Celestial', 'Astral', 'Gold', 'Silver', 'Copper']
  for (const tier of tiers) {
    if (tier === 'Celestial' && isPlaceholder) continue
    if (alignedScore >= SEAL_STAT_GATES[tier] && esmsBalance >= SEAL_ESMS_GATES[tier]) {
      return tier
    }
  }
  return null
}

/**
 * Determine monica state from telemetry monica value.
 */
export function determineMonicaState(monica: number | null | undefined): MonicaState {
  if (monica === null || monica === undefined) return 'absent'
  if (Math.abs(monica - 1.618) < 0.001) return 'equilibrium'
  if (monica > 0) return 'convergent'
  return 'divergent'
}

/**
 * Compute live resonance surge state from pre-computed telemetry inputs.
 * Never re-derives raw Kalchm thermodynamics; consumes meter, heat, reactivity, monica.
 */
export function evaluateSurgeState(
  meter: number,
  heat: number,
  reactivity: number,
  primaryStat: SacredStatKey,
  secondaryStat: SacredStatKey,
  monica: number | null = null
): ResonanceSurgeState {
  const clampedMeter = Math.max(0, Math.min(100, Math.round(meter)))
  const active = clampedMeter >= 70
  const monicaState = determineMonicaState(monica)

  let surgeType: SurgeType
  if (active && monicaState === 'equilibrium') {
    surgeType = 'equilibrium'
  } else if (heat >= reactivity) {
    surgeType = 'inferno'
  } else {
    surgeType = 'tempest'
  }

  const statBoosts: Partial<Record<SacredStatKey, number>> = {}
  if (active) {
    if (surgeType === 'equilibrium') {
      // Equilibrium applies both inferno and tempest boosts in harmony (+16 primary, +12 secondary, +8 all)
      for (const key of SACRED_STAT_KEYS) {
        if (key === primaryStat) {
          statBoosts[key] = 16
        } else if (key === secondaryStat) {
          statBoosts[key] = 12
        } else {
          statBoosts[key] = 8
        }
      }
    } else {
      // Inferno or Tempest: primary receives +12, secondary receives +8, others receive +4
      for (const key of SACRED_STAT_KEYS) {
        if (key === primaryStat) {
          statBoosts[key] = 12
        } else if (key === secondaryStat) {
          statBoosts[key] = 8
        } else {
          statBoosts[key] = 4
        }
      }
    }
  }

  return {
    meter: clampedMeter,
    active,
    surgeType,
    monica,
    monicaState,
    heat,
    reactivity,
    statBoosts,
  }
}

/**
 * Generate canonical seal object for an agent based on stat key and tier.
 */
export function buildCanonicalSeal(statKey: SacredStatKey, tier: SealTier): AlchemicalSeal {
  const catalog = CANONICAL_SEAL_CATALOG[statKey]
  return {
    id: `seal-${statKey}`,
    name: catalog.name,
    category: catalog.category,
    tier,
    description: catalog.description,
    statKey,
    multiplier: SEAL_TIER_MULTIPLIERS[tier],
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ============================================================================
// Deterministic Fixture Data (3 Historical Vessels + 1 Custom User Vessel)
// ============================================================================

export const FIXTURE_AGENTS: RatedAgentPayload[] = [
  {
    key: 'isaac-newton',
    handle: 'Sir Isaac Newton',
    faction: 6, // Saturn
    factionName: 'Saturn',
    isPlaceholder: false,
    provenance: 'historical',
    ratings: {
      power: 84,
      resonance: 82,
      wisdom: 98,
      charisma: 72,
      intuition: 89,
      adaptability: 76,
      vitality: 88,
    },
    relativeAdvantage: {
      power: 21.0,
      resonance: 20.0,
      wisdom: 34.0,
      charisma: 11.0,
      intuition: 27.0,
      adaptability: 13.0,
      vitality: 26.0,
    },
    ovr: 90,
    archetype: {
      title: 'Celestial Mechanist',
      primary: 'wisdom',
      secondary: 'intuition',
    },
    esms: {
      spirit: 45.2,
      essence: 38.1,
      matter: 92.5,
      substance: 64.8,
    },
    seals: [
      {
        id: 'seal-wisdom',
        name: "Philosopher's Stone",
        category: 'matter',
        tier: 'Celestial',
        description: 'Transforms accumulated experience into strategic mastery.',
        statKey: 'wisdom',
        multiplier: 1.4,
      },
      {
        id: 'seal-intuition',
        name: 'Astral Vision',
        category: 'spirit',
        tier: 'Gold',
        description: 'Pierces through veil illusions with sovereign foresight.',
        statKey: 'intuition',
        multiplier: 1.18,
      },
    ],
    surge: {
      meter: 82,
      active: true,
      surgeType: 'inferno',
      monica: 1.414,
      monicaState: 'convergent',
      heat: 0.88,
      reactivity: 0.62,
      statBoosts: {
        power: 4,
        resonance: 4,
        wisdom: 12,
        charisma: 4,
        intuition: 8,
        adaptability: 4,
        vitality: 4,
      },
    },
    appearance: resolveAgentAppearance('isaac-newton'),
    portraitUrl: '/avatars/newton.png',
    vesselLevel: 92,
    totalXp: 856700,
    trainedOverall: 90,
    currentOverall: 92,
    transitDelta: 2.0,
    progressionStatus: 'estimated',
  },
  {
    key: 'leonardo-da-vinci',
    handle: 'Leonardo da Vinci',
    faction: 9, // Pluto
    factionName: 'Pluto',
    isPlaceholder: false,
    provenance: 'historical',
    ratings: {
      power: 78,
      resonance: 88,
      wisdom: 96,
      charisma: 85,
      intuition: 94,
      adaptability: 97,
      vitality: 79,
    },
    relativeAdvantage: {
      power: 15.0,
      resonance: 26.0,
      wisdom: 32.0,
      charisma: 24.0,
      intuition: 32.0,
      adaptability: 34.0,
      vitality: 17.0,
    },
    ovr: 94,
    archetype: {
      title: 'Polymath Craftsman',
      primary: 'adaptability',
      secondary: 'wisdom',
    },
    esms: {
      spirit: 78.4,
      essence: 85.0,
      matter: 52.3,
      substance: 96.1,
    },
    seals: [
      {
        id: 'seal-adaptability',
        name: 'Quicksilver Pivot',
        category: 'spirit',
        tier: 'Celestial',
        description: 'Transmutes tactical posture across shifting court elements.',
        statKey: 'adaptability',
        multiplier: 1.4,
      },
      {
        id: 'seal-wisdom',
        name: "Philosopher's Stone",
        category: 'matter',
        tier: 'Celestial',
        description: 'Transforms accumulated experience into strategic mastery.',
        statKey: 'wisdom',
        multiplier: 1.4,
      },
    ],
    surge: {
      meter: 45,
      active: false,
      surgeType: 'tempest',
      monica: 0.85,
      monicaState: 'convergent',
      heat: 0.42,
      reactivity: 0.74,
      statBoosts: {},
    },
    appearance: resolveAgentAppearance('leonardo-da-vinci'),
    portraitUrl: '/avatars/leonardo-da-vinci.png',
    vesselLevel: 94,
    totalXp: 890000,
    trainedOverall: 94,
    currentOverall: 94,
    transitDelta: 0.0,
    progressionStatus: 'estimated',
  },
  {
    key: 'emily-dickinson',
    handle: 'Emily Dickinson',
    faction: 3, // Venus
    factionName: 'Venus',
    isPlaceholder: false,
    provenance: 'historical',
    ratings: {
      power: 65,
      resonance: 92,
      wisdom: 86,
      charisma: 78,
      intuition: 99,
      adaptability: 74,
      vitality: 68,
    },
    relativeAdvantage: {
      power: 2.0,
      resonance: 30.0,
      wisdom: 22.0,
      charisma: 17.0,
      intuition: 37.0,
      adaptability: 11.0,
      vitality: 6.0,
    },
    ovr: 90,
    archetype: {
      title: 'Reclusive Visionary',
      primary: 'intuition',
      secondary: 'resonance',
    },
    esms: {
      spirit: 91.2,
      essence: 88.6,
      matter: 24.0,
      substance: 55.4,
    },
    seals: [
      {
        id: 'seal-intuition',
        name: 'Astral Vision',
        category: 'spirit',
        tier: 'Celestial',
        description: 'Pierces through veil illusions with sovereign foresight.',
        statKey: 'intuition',
        multiplier: 1.4,
      },
      {
        id: 'seal-resonance',
        name: 'Tidal Chorus',
        category: 'essence',
        tier: 'Celestial',
        description: 'Attunes with the ambient frequencies of celestial transits.',
        statKey: 'resonance',
        multiplier: 1.4,
      },
    ],
    surge: {
      meter: 94,
      active: true,
      surgeType: 'equilibrium',
      monica: 1.618,
      monicaState: 'equilibrium',
      heat: 0.82,
      reactivity: 0.84,
      statBoosts: {
        power: 8,
        resonance: 12,
        wisdom: 8,
        charisma: 8,
        intuition: 16,
        adaptability: 8,
        vitality: 8,
      },
    },
    appearance: resolveAgentAppearance('emily-dickinson'),
    portraitUrl: '/avatars/emily-dickinson.png',
    vesselLevel: 88,
    totalXp: 780000,
    trainedOverall: 90,
    currentOverall: 92,
    transitDelta: 2.0,
    progressionStatus: 'estimated',
  },
  {
    key: 'user-avatar-neo',
    handle: 'Adept Neo',
    faction: 0, // Sun
    factionName: 'Sun',
    isPlaceholder: false,
    provenance: 'user',
    ratings: {
      power: 82,
      resonance: 80,
      wisdom: 79,
      charisma: 84,
      intuition: 81,
      adaptability: 83,
      vitality: 85,
    },
    relativeAdvantage: {
      power: 19.0,
      resonance: 18.0,
      wisdom: 15.0,
      charisma: 23.0,
      intuition: 19.0,
      adaptability: 20.0,
      vitality: 23.0,
    },
    ovr: 84,
    archetype: {
      title: 'Apex Sovereign',
      primary: 'charisma',
      secondary: 'vitality',
    },
    esms: {
      spirit: 62.0,
      essence: 58.0,
      matter: 71.0,
      substance: 64.0,
    },
    seals: [
      {
        id: 'seal-charisma',
        name: 'Harmonic Sovereign',
        category: 'essence',
        tier: 'Gold',
        description: 'Commands celestial resonance to align allied forces.',
        statKey: 'charisma',
        multiplier: 1.18,
      },
      {
        id: 'seal-vitality',
        name: 'Immovable Foundation',
        category: 'matter',
        tier: 'Silver',
        description: 'Anchors vessel integrity against territorial disruption.',
        statKey: 'vitality',
        multiplier: 1.1,
      },
    ],
    surge: {
      meter: 71,
      active: true,
      surgeType: 'inferno',
      monica: 1.25,
      monicaState: 'convergent',
      heat: 0.78,
      reactivity: 0.55,
      statBoosts: {
        power: 4,
        resonance: 4,
        wisdom: 4,
        charisma: 12,
        intuition: 4,
        adaptability: 4,
        vitality: 8,
      },
    },
    appearance: resolveAgentAppearance('user-avatar-neo'),
    vesselLevel: 35,
    totalXp: 120000,
    trainedOverall: 84,
    currentOverall: 85,
    transitDelta: 1.0,
    progressionStatus: 'estimated',
  },
]
