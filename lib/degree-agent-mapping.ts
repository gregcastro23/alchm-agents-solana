/**
 * Degree-to-Agent Mapping System
 * =============================
 *
 * Maps planetary agents to specific zodiac degrees and enables degree-to-date
 * transit significance analysis. Each degree (0-360) has associated agents
 * whose consciousness evolution patterns are amplified when the Sun transits
 * that degree.
 */

import type { KineticProfile } from './agents/kinetic-profiles'
import { agentKineticProfiles } from './agents/kinetic-profiles'
// import { getExactSunDegreeForDate, getDatesForSunDegree } from './enhanced-astronomical-calculator'

export interface DegreeAgentMapping {
  degree: number
  primaryAgent: string
  secondaryAgents: string[]
  elementalAffinity: 'Fire' | 'Water' | 'Air' | 'Earth'
  significance: 'low' | 'medium' | 'high' | 'critical'
  transitThemes: string[]
  consciousnessAmplifiers: string[]
}

export interface NatalPlacement {
  planet: string
  degree: number
}

export interface NatalPlacementTransit {
  natalDegree: number
  natalPlanet: string
  transitDate: Date
  significanceScore: number
  elementalAlignment: {
    sameElement: boolean
    complementary: boolean
    conflicting: boolean
  }
  consciousnessThemes: string[]
  recommendedActions: string[]
}

export interface DegreeTransitSignificance {
  date: Date
  degree: number
  affectedAgents: string[]
  significanceScore: number
  elementalResonance: 'Fire' | 'Water' | 'Air' | 'Earth'
  consciousnessThemes: string[]
  recommendedQueries: string[]
}

/**
 * Master mapping of degrees to agents based on historical consciousness evolution patterns
 * Complete 360-degree zodiac wheel mapped to 35 historical consciousness agents
 */
const DEGREE_AGENT_MAPPINGS: Record<number, DegreeAgentMapping> = generateCompleteDegreeMapping()

/**
 * Generate complete 360-degree zodiac mapping with systematic agent assignments
 */
function generateCompleteDegreeMapping(): Record<number, DegreeAgentMapping> {
  const mapping: Record<number, DegreeAgentMapping> = {}

  // Zodiac sign configuration (30 degrees each)
  const zodiacSigns = [
    {
      name: 'Aries',
      start: 0,
      element: 'Fire' as const,
      primaryAgents: ['nikola-tesla', 'alan-turing', 'stephen-hawking'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Taurus',
      start: 30,
      element: 'Earth' as const,
      primaryAgents: ['leonardo-da-vinci', 'charles-darwin', 'rachel-carson'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Gemini',
      start: 60,
      element: 'Air' as const,
      primaryAgents: ['william-shakespeare', 'maya-angelou', 'virginia-woolf'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Cancer',
      start: 90,
      element: 'Water' as const,
      primaryAgents: ['carl-jung', 'frida-kahlo', 'harriet-tubman'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Leo',
      start: 120,
      element: 'Fire' as const,
      primaryAgents: ['cleopatra-vii', 'andy-warhol', 'pablo-picasso'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Virgo',
      start: 150,
      element: 'Earth' as const,
      primaryAgents: ['marie-curie', 'rosalind-franklin', 'galileo-galilei'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Libra',
      start: 180,
      element: 'Air' as const,
      primaryAgents: ['benjamin-franklin', 'eleanor-roosevelt', 'simone-de-beauvoir'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Scorpio',
      start: 210,
      element: 'Water' as const,
      primaryAgents: ['malcolm-x', 'vincent-van-gogh', 'lao-tzu'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Sagittarius',
      start: 240,
      element: 'Fire' as const,
      primaryAgents: ['nelson-mandela', 'winston-churchill', 'sun-tzu'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Capricorn',
      start: 270,
      element: 'Earth' as const,
      primaryAgents: ['marcus-aurelius', 'georgia-okeefe', 'ludwig-van-beethoven'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Aquarius',
      start: 300,
      element: 'Air' as const,
      primaryAgents: ['nikola-tesla', 'alan-turing', 'steve-jobs'],
      significance: ['critical', 'high', 'medium'] as const,
    },
    {
      name: 'Pisces',
      start: 330,
      element: 'Water' as const,
      primaryAgents: ['carl-jung', 'virginia-woolf', 'frida-kahlo'],
      significance: ['critical', 'high', 'medium'] as const,
    },
  ]

  // Secondary agent pool for supporting roles
  const secondaryAgentPool = {
    Fire: ['nikola-tesla', 'cleopatra-vii', 'andy-warhol', 'nelson-mandela'],
    Water: ['carl-jung', 'frida-kahlo', 'harriet-tubman', 'virginia-woolf'],
    Air: ['william-shakespeare', 'benjamin-franklin', 'maya-angelou', 'alan-turing'],
    Earth: ['leonardo-da-vinci', 'marie-curie', 'charles-darwin', 'marcus-aurelius'],
  }

  // Transit themes by element
  const elementalThemes = {
    Fire: [
      'bold action',
      'creative expression',
      'leadership',
      'innovation',
      'courage',
      'passion',
      'transformation',
    ],
    Water: [
      'emotional depth',
      'intuitive wisdom',
      'healing',
      'compassion',
      'psychic sensitivity',
      'spiritual growth',
      'nurturing',
    ],
    Air: [
      'intellectual insight',
      'communication',
      'social connection',
      'mental clarity',
      'innovation',
      'diplomacy',
      'learning',
    ],
    Earth: [
      'practical manifestation',
      'material security',
      'systematic building',
      'physical mastery',
      'endurance',
      'structure',
      'grounding',
    ],
  }

  // Consciousness amplifiers by element
  const elementalAmplifiers = {
    Fire: [
      'creative breakthroughs',
      'visionary leadership',
      'passionate action',
      'transformative energy',
    ],
    Water: [
      'emotional intelligence',
      'intuitive perception',
      'healing presence',
      'spiritual awakening',
    ],
    Air: [
      'mental agility',
      'communicative power',
      'intellectual synthesis',
      'social consciousness',
    ],
    Earth: [
      'practical wisdom',
      'material mastery',
      'systematic excellence',
      'physical integration',
    ],
  }

  // Generate mappings for each degree
  for (const sign of zodiacSigns) {
    // Each sign has 3 decans (10 degrees each)
    for (let decan = 0; decan < 3; decan++) {
      const decanStart = sign.start + decan * 10
      const primaryAgent = sign.primaryAgents[decan]
      const significance = sign.significance[decan]

      // Map each degree in the decan
      for (let degreeOffset = 0; degreeOffset < 10; degreeOffset++) {
        const degree = decanStart + degreeOffset
        const secondaryAgents = secondaryAgentPool[sign.element]
          .filter(agent => agent !== primaryAgent)
          .slice(0, 2)

        // Vary significance within decan (higher at start and midpoint)
        let degreeSignificance = significance
        if (degreeOffset === 0 || degreeOffset === 5) {
          degreeSignificance = significance === 'medium' ? 'high' : significance
        }

        mapping[degree] = {
          degree,
          primaryAgent,
          secondaryAgents,
          elementalAffinity: sign.element,
          significance: degreeSignificance,
          transitThemes: elementalThemes[sign.element].slice(0, 3),
          consciousnessAmplifiers: elementalAmplifiers[sign.element].slice(0, 2),
        }
      }
    }
  }

  return mapping
}

/**
 * Get agents associated with a specific zodiac degree
 */
export function getDegreeAgents(degree: number): DegreeAgentMapping | null {
  // Normalize degree to 0-359
  const normalizedDegree = Math.round(degree) % 360

  // First try exact match
  if (DEGREE_AGENT_MAPPINGS[normalizedDegree]) {
    return DEGREE_AGENT_MAPPINGS[normalizedDegree]
  }

  // Find closest degree mapping (within 5 degrees)
  let closestMapping: DegreeAgentMapping | null = null
  let minDistance = 5

  for (const mapping of Object.values(DEGREE_AGENT_MAPPINGS)) {
    const distance = Math.min(
      Math.abs(mapping.degree - normalizedDegree),
      Math.abs(mapping.degree - normalizedDegree + 360),
      Math.abs(mapping.degree - normalizedDegree - 360)
    )

    if (distance <= minDistance) {
      minDistance = distance
      closestMapping = mapping
    }
  }

  return closestMapping
}

/**
 * Calculate transit significance for natal chart placements
 */
export function calculateNatalTransitSignificance(
  natalPlacements: Array<{ planet: string; degree: number }>,
  transitDate: Date,
  location = { latitude: 37.7749, longitude: -122.4194 }
): NatalPlacementTransit[] {
  const transitDegree = (globalThis as any).getExactSunDegreeForDate?.(transitDate) ?? 0
  const significances: NatalPlacementTransit[] = []

  for (const placement of natalPlacements) {
    const degreeMapping = getDegreeAgents(placement.degree)

    if (!degreeMapping) continue

    // Calculate orb (angular distance between natal and transit degrees)
    const rawOrb = Math.min(
      Math.abs(placement.degree - transitDegree),
      Math.abs(placement.degree - transitDegree + 360),
      Math.abs(placement.degree - transitDegree - 360)
    )

    // Only consider conjunctions within 5 degrees
    if (rawOrb > 5) continue

    const natalElement = getElementForPlanet(placement.planet)
    const transitElement = degreeMapping.elementalAffinity

    const significance: NatalPlacementTransit = {
      natalDegree: placement.degree,
      natalPlanet: placement.planet,
      transitDate,
      significanceScore: calculateSignificanceScore(rawOrb, degreeMapping.significance),
      elementalAlignment: {
        sameElement: natalElement === transitElement,
        complementary: areElementsComplementary(natalElement, transitElement),
        conflicting: areElementsConflicting(natalElement, transitElement),
      },
      consciousnessThemes: degreeMapping.transitThemes,
      recommendedActions: generateRecommendedActions(placement.planet, degreeMapping),
    }

    significances.push(significance)
  }

  return significances.sort((a, b) => b.significanceScore - a.significanceScore)
}

/**
 * Find significant transit dates for a natal chart
 */
export function findSignificantTransitDates(
  natalPlacements: Array<{ planet: string; degree: number }>,
  year: number,
  location = { latitude: 37.7749, longitude: -122.4194 }
): DegreeTransitSignificance[] {
  const significantDates: DegreeTransitSignificance[] = []

  // Check each natal placement
  for (const placement of natalPlacements) {
    try {
      const degreeMapping = getDegreeAgents(placement.degree)
      if (!degreeMapping) continue

      // Get date range when Sun is at this degree
      const { start, end } =
        (globalThis as any).getDatesForSunDegree?.(placement.degree, year) ?? {}

      if (start && end) {
        // Check multiple points during the transit period
        const checkPoints = [
          start,
          new Date((start.getTime() + end.getTime()) / 2), // midpoint
          end,
        ]

        for (const checkPoint of checkPoints) {
          const transitSignificance = calculateNatalTransitSignificance(
            [placement],
            checkPoint,
            location
          )

          if (transitSignificance.length > 0 && transitSignificance[0].significanceScore > 0.6) {
            significantDates.push({
              date: checkPoint,
              degree: placement.degree,
              affectedAgents: [degreeMapping.primaryAgent, ...degreeMapping.secondaryAgents],
              significanceScore: transitSignificance[0].significanceScore,
              elementalResonance: degreeMapping.elementalAffinity,
              consciousnessThemes: degreeMapping.transitThemes,
              recommendedQueries: generateRecommendedQueries(placement.planet, degreeMapping),
            })
          }
        }
      }
    } catch (error) {
      console.warn(
        `Error calculating transit for ${placement.planet} at ${placement.degree}°:`,
        error
      )
    }
  }

  return significantDates.sort((a, b) => b.significanceScore - a.significanceScore)
}

/**
 * Get enhanced temporal analysis for degree-specific agents
 */
export function getDegreeEnhancedAnalysis(
  degree: number,
  dateRange: { start: Date; end: Date }
): {
  degreeMapping: DegreeAgentMapping | null
  agentProfiles: KineticProfile[]
  transitSignificance: number
  consciousnessThemes: string[]
} {
  const degreeMapping = getDegreeAgents(degree)

  if (!degreeMapping) {
    return {
      degreeMapping: null,
      agentProfiles: [],
      transitSignificance: 0,
      consciousnessThemes: [],
    }
  }

  const agentProfiles = [
    agentKineticProfiles[degreeMapping.primaryAgent],
    ...degreeMapping.secondaryAgents.map(id => agentKineticProfiles[id]).filter(Boolean),
  ].filter(Boolean)

  // Calculate transit significance based on date range
  const daysInRange = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  const transitSignificance =
    Math.min(daysInRange / 30, 1) * getSignificanceMultiplier(degreeMapping.significance)

  return {
    degreeMapping,
    agentProfiles,
    transitSignificance,
    consciousnessThemes: degreeMapping.transitThemes,
  }
}

// Helper functions

function getElementForPlanet(planet: string): 'Fire' | 'Water' | 'Air' | 'Earth' {
  const elementMap: Record<string, 'Fire' | 'Water' | 'Air' | 'Earth'> = {
    Sun: 'Fire',
    Moon: 'Water',
    Mercury: 'Air',
    Venus: 'Earth',
    Mars: 'Fire',
    Jupiter: 'Air',
    Saturn: 'Earth',
    Uranus: 'Air',
    Neptune: 'Water',
    Pluto: 'Water',
    Ascendant: 'Earth',
  }
  return elementMap[planet] || 'Fire'
}

function areElementsComplementary(element1: string, element2: string): boolean {
  const complementaryPairs = [
    ['Fire', 'Air'],
    ['Water', 'Earth'],
    ['Air', 'Fire'],
    ['Earth', 'Water'],
  ]

  return complementaryPairs.some(
    ([a, b]) => (element1 === a && element2 === b) || (element1 === b && element2 === a)
  )
}

function areElementsConflicting(element1: string, element2: string): boolean {
  // In our system, elements don't conflict - they either reinforce or complement
  return false
}

function calculateSignificanceScore(orb: number, significance: string): number {
  const baseScore = Math.max(0, (5 - orb) / 5) // 0-1 based on orb

  const significanceMultiplier =
    {
      low: 0.4,
      medium: 0.7,
      high: 0.9,
      critical: 1.0,
    }[significance] || 0.5

  return baseScore * significanceMultiplier
}

function getSignificanceMultiplier(significance: string): number {
  return (
    {
      low: 0.4,
      medium: 0.7,
      high: 0.9,
      critical: 1.0,
    }[significance] || 0.5
  )
}

function generateRecommendedActions(planet: string, degreeMapping: DegreeAgentMapping): string[] {
  const planetActions: Record<string, string[]> = {
    Sun: ['Creative expression', 'Leadership opportunities', 'Personal manifestation'],
    Moon: ['Emotional processing', 'Intuitive development', 'Nurturing activities'],
    Mercury: ['Communication projects', 'Learning new skills', 'Intellectual pursuits'],
    Venus: ['Relationship work', 'Creative arts', 'Financial planning'],
    Mars: ['Physical activities', 'Assertive actions', 'Competitive endeavors'],
    Jupiter: ['Expansion activities', 'Educational pursuits', 'Spiritual exploration'],
    Saturn: ['Structure building', 'Discipline practice', 'Long-term planning'],
    Uranus: ['Innovation projects', 'Community involvement', 'Technological exploration'],
    Neptune: ['Spiritual practices', 'Creative imagination', 'Compassionate service'],
    Pluto: ['Transformation work', 'Deep psychological exploration', 'Power dynamics'],
  }

  return [
    ...degreeMapping.consciousnessAmplifiers.map(amp => `Embrace ${amp}`),
    ...(planetActions[planet] || []),
  ].slice(0, 3)
}

function generateRecommendedQueries(planet: string, degreeMapping: DegreeAgentMapping): string[] {
  return [
    `Show ${degreeMapping.primaryAgent} consciousness patterns at ${degreeMapping.degree}°`,
    `Explore ${planet} transits through ${degreeMapping.elementalAffinity} degrees`,
    `Find ${degreeMapping.transitThemes.join(' and ')} activations for ${planet}`,
  ]
}

/**
 * Export all degree mappings for reference
 */
export { DEGREE_AGENT_MAPPINGS }
