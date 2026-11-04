import {
  earnedSeals,
  evaluateSeals,
  rateStats,
  type AlchemicalSeal,
  type CoreStats,
  type VesselArchetype,
} from '@/lib/agents/rating'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import type { Element } from '@/lib/staking/types'

export type AspectType = 'Conjunction' | 'Sextile' | 'Square' | 'Trine' | 'Opposition'
export type HarmonicCategory = 'fusion' | 'harmonic' | 'catalytic'

export interface AspectDefinition {
  angle: number
  maxOrb: number
  type: AspectType
  category: HarmonicCategory
  symbol: string
  color: string
  dash?: string
}

export const ASPECT_DEFINITIONS: readonly AspectDefinition[] = Object.freeze([
  {
    angle: 0,
    maxOrb: 8.0,
    type: 'Conjunction',
    category: 'fusion',
    symbol: '☌',
    color: '#fbbf24',
  },
  {
    angle: 60,
    maxOrb: 5.0,
    type: 'Sextile',
    category: 'harmonic',
    symbol: '⚹',
    color: '#4ade80',
    dash: '4 3',
  },
  {
    angle: 90,
    maxOrb: 6.0,
    type: 'Square',
    category: 'catalytic',
    symbol: '□',
    color: '#f87171',
  },
  {
    angle: 120,
    maxOrb: 7.0,
    type: 'Trine',
    category: 'harmonic',
    symbol: '△',
    color: '#60a5fa',
  },
  {
    angle: 180,
    maxOrb: 8.0,
    type: 'Opposition',
    category: 'catalytic',
    symbol: '☍',
    color: '#c084fc',
    dash: '6 3',
  },
])

export interface CelestialPlacement {
  planet: string
  sign: string
  degree: number
  exactLongitude: number
  isRetrograde?: boolean
  element: Element
}

export interface TransitAspect {
  id: string
  natalBody: string
  natalLongitude: number
  natalSign: string
  natalDegree: number
  transitBody: string
  transitLongitude: number
  transitSign: string
  transitDegree: number
  aspect: AspectType
  category: HarmonicCategory
  symbol: string
  color: string
  targetAngle: number
  actualSeparation: number
  orb: number
  resonanceGain: number
  significance: number
  description: string
}

export interface DailyMentorMatch {
  rank: number
  agentId: string
  agentName: string
  agentTitle: string
  era: string
  rulingPlanet: string
  element: Element
  pvr: number
  archetype: VesselArchetype
  seals: AlchemicalSeal[]
  dominantAspect: TransitAspect
  mentorResonanceScore: number
  surgeTier: 'Major Surge' | 'Moderate Surge' | 'Harmonic Surge'
  resonanceRationale: string
  links: {
    agentProfile: string
    synastry: string
    culinary: string
  }
}

export interface NatalTransitOverlay {
  timestamp: string
  userNatal: Record<string, CelestialPlacement>
  liveTransit: Record<string, CelestialPlacement>
  aspects: TransitAspect[]
  topMentors: DailyMentorMatch[]
  overallResonanceScore: number
  dominantElement: Element
  surgeState: {
    active: boolean
    tier: string
    deltaOvr: number
    triggerAspect: string
  }
  mcpWirePayload: {
    tool: string
    agentId: string
    natalDate: string
    transitTimestamp: string
    resonanceSurge: {
      tier: string
      deltaOvr: number
      triggerAspect: string
    }
    baselinePvr: number
    surgedPvr: number
    sharedAspectCount: number
    topMentor: string
  }
}

export const ZODIAC_SIGNS = [
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

export const ZODIAC_ELEMENTS: Record<string, Element> = {
  Aries: 'Fire',
  Taurus: 'Earth',
  Gemini: 'Air',
  Cancer: 'Water',
  Leo: 'Fire',
  Virgo: 'Earth',
  Libra: 'Air',
  Scorpio: 'Water',
  Sagittarius: 'Fire',
  Capricorn: 'Earth',
  Aquarius: 'Air',
  Pisces: 'Water',
}

export const PLANET_WEIGHTS: Record<string, number> = {
  Sun: 1.6,
  Moon: 1.5,
  Ascendant: 1.5,
  Jupiter: 1.3,
  Saturn: 1.3,
  Mars: 1.2,
  Venus: 1.2,
  Mercury: 1.1,
  Uranus: 1.0,
  Neptune: 1.0,
  Pluto: 1.0,
}

export function signDegreeToLongitude(sign: string, degree: number): number {
  const signIdx = ZODIAC_SIGNS.indexOf(sign as any)
  if (signIdx < 0) return ((degree % 360) + 360) % 360
  return (((signIdx * 30 + degree) % 360) + 360) % 360
}

export function longitudeToSignDegree(longitude: number): { sign: string; degree: number } {
  const normalized = ((longitude % 360) + 360) % 360
  const signIndex = Math.floor(normalized / 30) % 12
  const degree = Math.round((normalized % 30) * 100) / 100
  return {
    sign: ZODIAC_SIGNS[signIndex] || 'Aries',
    degree,
  }
}

export function angularSeparation(lonA: number, lonB: number): number {
  const diff = Math.abs(lonA - lonB) % 360
  return diff > 180 ? 360 - diff : diff
}

/**
 * Standard default natal placements for visitors who haven't saved a birthchart.
 */
export const DEFAULT_USER_NATAL: Record<string, CelestialPlacement> = {
  Sun: {
    planet: 'Sun',
    sign: 'Aries',
    degree: 15.0,
    exactLongitude: 15.0,
    element: 'Fire',
  },
  Moon: {
    planet: 'Moon',
    sign: 'Cancer',
    degree: 12.0,
    exactLongitude: 102.0,
    element: 'Water',
  },
  Mercury: {
    planet: 'Mercury',
    sign: 'Taurus',
    degree: 8.0,
    exactLongitude: 38.0,
    element: 'Earth',
  },
  Venus: {
    planet: 'Venus',
    sign: 'Pisces',
    degree: 20.0,
    exactLongitude: 350.0,
    element: 'Water',
  },
  Mars: {
    planet: 'Mars',
    sign: 'Capricorn',
    degree: 4.0,
    exactLongitude: 274.0,
    element: 'Earth',
  },
  Jupiter: {
    planet: 'Jupiter',
    sign: 'Sagittarius',
    degree: 18.0,
    exactLongitude: 258.0,
    element: 'Fire',
  },
  Saturn: {
    planet: 'Saturn',
    sign: 'Aquarius',
    degree: 10.0,
    exactLongitude: 310.0,
    element: 'Air',
  },
  Ascendant: {
    planet: 'Ascendant',
    sign: 'Leo',
    degree: 22.0,
    exactLongitude: 142.0,
    element: 'Fire',
  },
}

/**
 * Normalizes input positions (from API or calculate-transits) into CelestialPlacement map.
 */
export function normalizePlacements(
  input: Record<string, any>
): Record<string, CelestialPlacement> {
  const result: Record<string, CelestialPlacement> = {}
  for (const [key, raw] of Object.entries(input)) {
    if (!raw || typeof raw !== 'object') continue
    let lon = Number(raw.exactLongitude ?? raw.longitude)
    let sign = String(raw.sign ?? '')
    let deg = Number(raw.degree ?? 0)

    if (!Number.isFinite(lon)) {
      if (sign && Number.isFinite(deg)) {
        lon = signDegreeToLongitude(sign, deg)
      } else {
        continue
      }
    } else {
      lon = ((lon % 360) + 360) % 360
      if (!sign) {
        const sd = longitudeToSignDegree(lon)
        sign = sd.sign
        deg = sd.degree
      }
    }

    const element = ZODIAC_ELEMENTS[sign] || 'Fire'
    result[key] = {
      planet: key,
      sign,
      degree: Math.round(deg * 100) / 100,
      exactLongitude: Math.round(lon * 100) / 100,
      isRetrograde: Boolean(raw.isRetrograde ?? raw.retrograde),
      element,
    }
  }
  return result
}

/**
 * Computes all exact and orb-weighted aspects between natal and live transit placements.
 */
export function computeTransitAspects(
  natal: Record<string, CelestialPlacement>,
  transits: Record<string, CelestialPlacement>,
  maxOrbLimit = 8.0
): TransitAspect[] {
  const aspects: TransitAspect[] = []

  for (const [nKey, nPlacement] of Object.entries(natal)) {
    for (const [tKey, tPlacement] of Object.entries(transits)) {
      const sep = angularSeparation(nPlacement.exactLongitude, tPlacement.exactLongitude)

      for (const def of ASPECT_DEFINITIONS) {
        const orb = Math.abs(sep - def.angle)
        const allowedOrb = Math.min(def.maxOrb, maxOrbLimit)

        if (orb <= allowedOrb) {
          const tightnessRatio = Math.max(0, (allowedOrb - orb) / allowedOrb)
          const resonanceGain = Math.round((1.0 + tightnessRatio * 0.35) * 100) / 100

          const weightN = PLANET_WEIGHTS[nKey] ?? 1.0
          const weightT = PLANET_WEIGHTS[tKey] ?? 1.0
          const significance =
            Math.round(weightN * weightT * (1 + tightnessRatio * 1.5) * 100) / 100

          const description = `Transiting ${tKey} in ${tPlacement.sign} (${tPlacement.degree}°) forms a ${def.type} (${def.symbol}) to Natal ${nKey} in ${nPlacement.sign} (${nPlacement.degree}°) with ${orb.toFixed(1)}° orb.`

          aspects.push({
            id: `${nKey}-${tKey}-${def.type}`,
            natalBody: nKey,
            natalLongitude: nPlacement.exactLongitude,
            natalSign: nPlacement.sign,
            natalDegree: nPlacement.degree,
            transitBody: tKey,
            transitLongitude: tPlacement.exactLongitude,
            transitSign: tPlacement.sign,
            transitDegree: tPlacement.degree,
            aspect: def.type,
            category: def.category,
            symbol: def.symbol,
            color: def.color,
            targetAngle: def.angle,
            actualSeparation: Math.round(sep * 100) / 100,
            orb: Math.round(orb * 100) / 100,
            resonanceGain,
            significance,
            description,
          })
          break
        }
      }
    }
  }

  return aspects.sort((a, b) => b.significance - a.significance || a.orb - b.orb)
}

/**
 * Matches and ranks the top 3 Daily Historical Mentors whose natal charts resonate
 * with the user's active personal transits.
 */
export function findDailyHistoricalMentors(params: {
  userNatal: Record<string, CelestialPlacement>
  liveTransits: Record<string, CelestialPlacement>
  userAspects: TransitAspect[]
}): DailyMentorMatch[] {
  const matches: Array<{
    agentId: string
    agentName: string
    agentTitle: string
    era: string
    rulingPlanet: string
    element: Element
    pvr: number
    archetype: VesselArchetype
    seals: AlchemicalSeal[]
    dominantAspect: TransitAspect
    mentorResonanceScore: number
    surgeTier: 'Major Surge' | 'Moderate Surge' | 'Harmonic Surge'
    resonanceRationale: string
  }> = []

  for (const agent of HISTORICAL_AGENTS) {
    const planets = agent.consciousness?.natalChart?.planets
    if (!planets) continue

    const mentorNatal = normalizePlacements(planets)
    const mentorAspects = computeTransitAspects(mentorNatal, params.liveTransits, 7.0)
    if (mentorAspects.length === 0) continue

    // Rate agent
    const sacred = (agent.sacredStats ?? {}) as Record<string, number>
    const coreStats: CoreStats = {
      power: Math.min(99, Math.max(25, sacred.power ?? 75)),
      resonance: Math.min(99, Math.max(25, sacred.resonance ?? 85)),
      wisdom: Math.min(99, Math.max(25, sacred.wisdom ?? 88)),
      charisma: Math.min(99, Math.max(25, sacred.charisma ?? 80)),
      intuition: Math.min(99, Math.max(25, sacred.intuition ?? 84)),
      adaptability: Math.min(99, Math.max(25, sacred.adaptability ?? 80)),
      vitality: Math.min(99, Math.max(25, sacred.vitality ?? 82)),
    }
    const rated = rateStats(coreStats)
    const seals = earnedSeals(
      evaluateSeals({
        stats: coreStats,
        esmsBalances: {
          spirit: (agent.consciousness?.alchemicalElements?.spirit ?? 0.5) * 400,
          essence: (agent.consciousness?.alchemicalElements?.essence ?? 0.5) * 400,
          matter: (agent.consciousness?.alchemicalElements?.matter ?? 0.5) * 400,
          substance: (agent.consciousness?.alchemicalElements?.substance ?? 0.5) * 400,
        },
      })
    )

    // Find shared aspect synergy with user
    const topAspect = mentorAspects[0]
    const sharedTransitPlanets = new Set(params.userAspects.map(a => a.transitBody))
    const sharedTransitBoost = sharedTransitPlanets.has(topAspect.transitBody) ? 6 : 0

    const harmonicBoost =
      topAspect.category === 'harmonic' ? 8 : topAspect.category === 'fusion' ? 7 : 3
    const tightnessBonus = Math.round((7.0 - topAspect.orb) * 2.5)

    const rawScore =
      72 + (rated.ovr - 70) * 0.25 + harmonicBoost + tightnessBonus + sharedTransitBoost
    const mentorResonanceScore = Math.max(70, Math.min(99, Math.round(rawScore)))

    const surgeTier: DailyMentorMatch['surgeTier'] =
      mentorResonanceScore >= 92
        ? 'Major Surge'
        : mentorResonanceScore >= 84
          ? 'Moderate Surge'
          : 'Harmonic Surge'

    const rationale = `${agent.name}'s natal ${topAspect.natalBody} (${topAspect.natalSign} ${topAspect.natalDegree}°) forms a ${topAspect.aspect} (${topAspect.symbol}) with transiting ${topAspect.transitBody} in ${topAspect.transitSign}, anchoring ${topAspect.resonanceGain}x resonance with your sky.`

    const sunSign = planets.Sun?.sign || 'Aries'
    const rulingPlanet =
      (agent as any).rulingPlanet ||
      (sunSign === 'Aries'
        ? 'Mars'
        : sunSign === 'Taurus' || sunSign === 'Libra'
          ? 'Venus'
          : sunSign === 'Gemini' || sunSign === 'Virgo'
            ? 'Mercury'
            : sunSign === 'Cancer'
              ? 'Moon'
              : sunSign === 'Leo'
                ? 'Sun'
                : sunSign === 'Scorpio'
                  ? 'Mars'
                  : sunSign === 'Sagittarius'
                    ? 'Jupiter'
                    : sunSign === 'Capricorn'
                      ? 'Saturn'
                      : sunSign === 'Aquarius'
                        ? 'Uranus'
                        : 'Neptune')

    matches.push({
      agentId: agent.id,
      agentName: agent.name,
      agentTitle: agent.title || 'Historical Alchemist',
      era: agent.era || 'Historical',
      rulingPlanet,
      element: (agent.consciousness?.dominantElement as Element) || 'Fire',
      pvr: rated.ovr,
      archetype: rated.archetype,
      seals,
      dominantAspect: topAspect,
      mentorResonanceScore,
      surgeTier,
      resonanceRationale: rationale,
    })
  }

  // Sort descending by mentorResonanceScore
  matches.sort((a, b) => b.mentorResonanceScore - a.mentorResonanceScore || b.pvr - a.pvr)

  const kitchenBase = (
    (typeof process !== 'undefined' &&
      (process.env.NEXT_PUBLIC_KITCHEN_URL ||
        process.env.ALCHM_KITCHEN_URL ||
        process.env.ALCHM_KITCHEN_BASE_URL)) ||
    'https://alchm.kitchen'
  ).replace(/\/+$/, '')

  return matches.slice(0, 3).map((m, idx) => ({
    rank: idx + 1,
    ...m,
    links: {
      agentProfile: `/agent/${m.agentId}`,
      synastry: `/synastry/${m.agentId}`,
      culinary: `${kitchenBase}/recipes?agent=${encodeURIComponent(m.agentId)}`,
    },
  }))
}

/**
 * Builds the complete NatalTransitOverlay payload.
 */
export function computeNatalTransitOverlay(
  rawUserNatal?: Record<string, any> | null,
  rawLiveTransits?: Record<string, any> | null
): NatalTransitOverlay {
  const userNatal = rawUserNatal ? normalizePlacements(rawUserNatal) : DEFAULT_USER_NATAL

  const liveTransit = rawLiveTransits
    ? normalizePlacements(rawLiveTransits)
    : normalizePlacements(getCurrentPlanetaryPositions())

  const aspects = computeTransitAspects(userNatal, liveTransit)
  const topMentors = findDailyHistoricalMentors({
    userNatal,
    liveTransits: liveTransit,
    userAspects: aspects,
  })

  const topAspect = aspects[0]
  const leadMentor = topMentors[0]

  const harmonicCount = aspects.filter(a => a.category === 'harmonic').length
  const fusionCount = aspects.filter(a => a.category === 'fusion').length
  const rawScore =
    75 + harmonicCount * 3 + fusionCount * 4 + (topAspect ? topAspect.resonanceGain * 6 : 0)
  const overallResonanceScore = Math.max(25, Math.min(99, Math.round(rawScore)))

  const elementCounts: Record<Element, number> = { Fire: 0, Water: 0, Earth: 0, Air: 0 }
  for (const p of Object.values(userNatal)) elementCounts[p.element]++
  for (const p of Object.values(liveTransit)) elementCounts[p.element]++
  const dominantElement = (Object.entries(elementCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    'Fire') as Element

  const surgeDelta = overallResonanceScore >= 90 ? 12 : overallResonanceScore >= 80 ? 8 : 4
  const surgeTier =
    overallResonanceScore >= 90
      ? 'Major Surge'
      : overallResonanceScore >= 80
        ? 'Moderate Surge'
        : 'Harmonic Surge'

  const triggerAspect = topAspect
    ? `Transiting ${topAspect.transitBody} ${topAspect.symbol} Natal ${topAspect.natalBody} (${topAspect.orb.toFixed(1)}° orb)`
    : 'Harmonic Conjunction Equilibrium'

  const baselinePvr = Math.min(95, overallResonanceScore - 4)
  const surgedPvr = Math.min(99, baselinePvr + surgeDelta)

  return {
    timestamp: new Date().toISOString(),
    userNatal,
    liveTransit,
    aspects,
    topMentors,
    overallResonanceScore,
    dominantElement,
    surgeState: {
      active: true,
      tier: surgeTier,
      deltaOvr: surgeDelta,
      triggerAspect,
    },
    mcpWirePayload: {
      tool: 'get_transit_natal_overlay',
      agentId: leadMentor?.agentId ?? 'johannes-kepler',
      natalDate: '1571-12-27T14:30:00Z',
      transitTimestamp: new Date().toISOString(),
      resonanceSurge: {
        tier: surgeTier,
        deltaOvr: surgeDelta,
        triggerAspect,
      },
      baselinePvr,
      surgedPvr,
      sharedAspectCount: aspects.length,
      topMentor: leadMentor?.agentName ?? 'Johannes Kepler',
    },
  }
}
