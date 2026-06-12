/**
 * Degree-to-Planetary-Agent Mapping System
 * =========================================
 *
 * Maps each of the 360 zodiac degrees to their planetary agent configurations.
 * Uses actual astrological principles: planetary rulership, dignity, and elemental characteristics.
 *
 * CORRECT IMPLEMENTATION: Maps to planetary agents (e.g., "Mars in Aries at 15°")
 * NOT historical agents (like Tesla, Jung, etc.)
 */

export interface PlanetaryAgentConfig {
  degree: number // 0-359
  zodiacDegree: number // Degree within sign (0-29)
  sign: string // Aries, Taurus, etc.
  ruler: string // Planet that rules this sign
  exaltedPlanet?: string // Planet exalted in this sign
  element: 'Fire' | 'Water' | 'Air' | 'Earth'
  modality: 'Cardinal' | 'Fixed' | 'Mutable'

  // Dignity information for the ruler
  rulerDignity: 'domicile' | 'exaltation' | 'detriment' | 'fall' | 'peregrine'

  // Consciousness characteristics
  consciousnessLevel:
    | 'dormant'
    | 'awakening'
    | 'active'
    | 'elevated'
    | 'advanced'
    | 'illuminated'
    | 'transcendent'
  powerLevel: number // 0-1

  // Degree-specific themes
  themes: string[]
  qualities: string[]

  // Special degrees
  isCardinalDegree: boolean // 0° of cardinal signs
  isCriticalDegree: boolean // 0°, 13°, 26° of cardinal signs, etc.
  isAnaretic: boolean // 29° (degree of fate)
}

/**
 * Zodiac sign rulerships and characteristics
 */
const ZODIAC_SIGNS = {
  Aries: {
    start: 0,
    ruler: 'Mars',
    exalted: 'Sun',
    detriment: 'Venus',
    fall: 'Saturn',
    element: 'Fire' as const,
    modality: 'Cardinal' as const,
    themes: ['initiation', 'courage', 'action', 'independence', 'pioneering'],
    qualities: ['assertive', 'energetic', 'direct', 'spontaneous'],
  },
  Taurus: {
    start: 30,
    ruler: 'Venus',
    exalted: 'Moon',
    detriment: 'Mars',
    fall: 'Uranus',
    element: 'Earth' as const,
    modality: 'Fixed' as const,
    themes: ['stability', 'sensuality', 'manifestation', 'values', 'persistence'],
    qualities: ['reliable', 'patient', 'practical', 'grounded'],
  },
  Gemini: {
    start: 60,
    ruler: 'Mercury',
    exalted: undefined,
    detriment: 'Jupiter',
    fall: undefined,
    element: 'Air' as const,
    modality: 'Mutable' as const,
    themes: ['communication', 'curiosity', 'versatility', 'connection', 'learning'],
    qualities: ['adaptable', 'intellectual', 'social', 'quick-witted'],
  },
  Cancer: {
    start: 90,
    ruler: 'Moon',
    exalted: 'Jupiter',
    detriment: 'Saturn',
    fall: 'Mars',
    element: 'Water' as const,
    modality: 'Cardinal' as const,
    themes: ['nurturing', 'emotion', 'protection', 'home', 'intuition'],
    qualities: ['sensitive', 'caring', 'intuitive', 'protective'],
  },
  Leo: {
    start: 120,
    ruler: 'Sun',
    exalted: undefined,
    detriment: 'Saturn',
    fall: undefined,
    element: 'Fire' as const,
    modality: 'Fixed' as const,
    themes: ['creativity', 'self-expression', 'leadership', 'confidence', 'generosity'],
    qualities: ['radiant', 'proud', 'creative', 'loyal'],
  },
  Virgo: {
    start: 150,
    ruler: 'Mercury',
    exalted: 'Mercury',
    detriment: 'Jupiter',
    fall: 'Venus',
    element: 'Earth' as const,
    modality: 'Mutable' as const,
    themes: ['analysis', 'service', 'refinement', 'health', 'precision'],
    qualities: ['analytical', 'helpful', 'perfectionist', 'discerning'],
  },
  Libra: {
    start: 180,
    ruler: 'Venus',
    exalted: 'Saturn',
    detriment: 'Mars',
    fall: 'Sun',
    element: 'Air' as const,
    modality: 'Cardinal' as const,
    themes: ['balance', 'harmony', 'partnership', 'justice', 'diplomacy'],
    qualities: ['fair', 'charming', 'cooperative', 'aesthetic'],
  },
  Scorpio: {
    start: 210,
    ruler: 'Pluto',
    coRuler: 'Mars',
    exalted: undefined,
    detriment: 'Venus',
    fall: 'Moon',
    element: 'Water' as const,
    modality: 'Fixed' as const,
    themes: ['transformation', 'depth', 'power', 'regeneration', 'mystery'],
    qualities: ['intense', 'passionate', 'perceptive', 'transformative'],
  },
  Sagittarius: {
    start: 240,
    ruler: 'Jupiter',
    exalted: undefined,
    detriment: 'Mercury',
    fall: undefined,
    element: 'Fire' as const,
    modality: 'Mutable' as const,
    themes: ['expansion', 'wisdom', 'adventure', 'philosophy', 'freedom'],
    qualities: ['optimistic', 'philosophical', 'adventurous', 'honest'],
  },
  Capricorn: {
    start: 270,
    ruler: 'Saturn',
    exalted: 'Mars',
    detriment: 'Moon',
    fall: 'Jupiter',
    element: 'Earth' as const,
    modality: 'Cardinal' as const,
    themes: ['structure', 'ambition', 'mastery', 'discipline', 'achievement'],
    qualities: ['disciplined', 'ambitious', 'responsible', 'strategic'],
  },
  Aquarius: {
    start: 300,
    ruler: 'Uranus',
    coRuler: 'Saturn',
    exalted: undefined,
    detriment: 'Sun',
    fall: undefined,
    element: 'Air' as const,
    modality: 'Fixed' as const,
    themes: ['innovation', 'community', 'individuality', 'progress', 'humanitarianism'],
    qualities: ['original', 'independent', 'intellectual', 'progressive'],
  },
  Pisces: {
    start: 330,
    ruler: 'Neptune',
    coRuler: 'Jupiter',
    exalted: 'Venus',
    detriment: 'Mercury',
    fall: 'Mercury',
    element: 'Water' as const,
    modality: 'Mutable' as const,
    themes: ['spirituality', 'compassion', 'imagination', 'transcendence', 'unity'],
    qualities: ['empathic', 'artistic', 'mystical', 'compassionate'],
  },
}

/**
 * Critical degrees by modality (degrees known for intensity/crisis/manifestation)
 */
const CRITICAL_DEGREES = {
  Cardinal: [0, 13, 26], // Aries, Cancer, Libra, Capricorn
  Fixed: [8, 9, 21, 22], // Taurus, Leo, Scorpio, Aquarius
  Mutable: [4, 17], // Gemini, Virgo, Sagittarius, Pisces
}

/**
 * Generate complete 360-degree planetary agent mapping
 */
export function generateDegreePlanetaryAgentMapping(): Record<number, PlanetaryAgentConfig> {
  const mapping: Record<number, PlanetaryAgentConfig> = {}

  for (let absoluteDegree = 0; absoluteDegree < 360; absoluteDegree++) {
    // Determine which sign this degree is in
    const signEntry = Object.entries(ZODIAC_SIGNS).find(
      ([_, config]) => absoluteDegree >= config.start && absoluteDegree < config.start + 30
    )

    if (!signEntry) continue

    const [signName, signConfig] = signEntry
    const zodiacDegree = absoluteDegree - signConfig.start // 0-29 within sign

    // Check if this is a special degree
    const isAnaretic = zodiacDegree === 29
    const isCardinalDegree = zodiacDegree === 0 && signConfig.modality === 'Cardinal'
    const isCriticalDegree = CRITICAL_DEGREES[signConfig.modality].includes(zodiacDegree)

    // Determine ruler's dignity at this degree
    const rulerDignity = getRulerDignity(signConfig.ruler, signName, zodiacDegree)

    // Calculate consciousness level based on degree position and dignity
    const consciousnessLevel = calculateConsciousnessLevel(
      zodiacDegree,
      rulerDignity,
      isCardinalDegree,
      isCriticalDegree,
      isAnaretic
    )

    // Calculate power level
    const powerLevel = calculatePowerLevel(
      zodiacDegree,
      rulerDignity,
      signConfig.modality,
      isCriticalDegree
    )

    mapping[absoluteDegree] = {
      degree: absoluteDegree,
      zodiacDegree,
      sign: signName,
      ruler: signConfig.ruler,
      exaltedPlanet: signConfig.exalted,
      element: signConfig.element,
      modality: signConfig.modality,
      rulerDignity,
      consciousnessLevel,
      powerLevel,
      themes: getDegreeThemes(signConfig.themes, zodiacDegree),
      qualities: signConfig.qualities,
      isCardinalDegree,
      isCriticalDegree,
      isAnaretic,
    }
  }

  return mapping
}

/**
 * Get planetary agent configuration for a specific degree
 */
export function getPlanetaryAgentForDegree(degree: number): PlanetaryAgentConfig | null {
  const normalizedDegree = Math.round(degree) % 360
  const mapping = generateDegreePlanetaryAgentMapping()
  return mapping[normalizedDegree] || null
}

/**
 * Get all planetary agents activated in a natal chart
 */
export function getNatalPlanetaryAgents(
  natalPlacements: Array<{ planet: string; degree: number }>
): Array<{
  natalPlanet: string
  degree: number
  agentConfig: PlanetaryAgentConfig
}> {
  return natalPlacements
    .map(placement => ({
      natalPlanet: placement.planet,
      degree: placement.degree,
      agentConfig: getPlanetaryAgentForDegree(placement.degree),
    }))
    .filter(item => item.agentConfig !== null) as Array<{
    natalPlanet: string
    degree: number
    agentConfig: PlanetaryAgentConfig
  }>
}

// Helper functions

function getRulerDignity(
  ruler: string,
  sign: string,
  zodiacDegree: number
): 'domicile' | 'exaltation' | 'detriment' | 'fall' | 'peregrine' {
  const signConfig = ZODIAC_SIGNS[sign as keyof typeof ZODIAC_SIGNS]

  // Ruler is in its home sign (domicile)
  if (ruler === signConfig.ruler) {
    return 'domicile'
  }

  // Check if ruler is exalted in this sign
  if (ruler === signConfig.exalted) {
    return 'exaltation'
  }

  // Check if ruler is in detriment (opposite of domicile)
  if (ruler === signConfig.detriment) {
    return 'detriment'
  }

  // Check if ruler is in fall (opposite of exaltation)
  if (ruler === signConfig.fall) {
    return 'fall'
  }

  return 'peregrine'
}

function calculateConsciousnessLevel(
  zodiacDegree: number,
  dignity: string,
  isCardinal: boolean,
  isCritical: boolean,
  isAnaretic: boolean
): 'dormant' | 'awakening' | 'active' | 'elevated' | 'advanced' | 'illuminated' | 'transcendent' {
  let level = 3 // Base: active

  // Dignity affects consciousness
  if (dignity === 'domicile') level += 2
  else if (dignity === 'exaltation') level += 3
  else if (dignity === 'detriment') level -= 1
  else if (dignity === 'fall') level -= 2

  // Special degrees boost consciousness
  if (isAnaretic) level += 2 // Anaretic = culmination/crisis
  if (isCardinal) level += 1 // Cardinal = initiation
  if (isCritical) level += 1 // Critical = intensity

  // First and last degrees of sign
  if (zodiacDegree === 0) level += 1 // Beginning energy
  if (zodiacDegree === 29) level += 1 // Completion energy

  // Map to consciousness level
  if (level >= 7) return 'transcendent'
  if (level >= 6) return 'illuminated'
  if (level >= 5) return 'advanced'
  if (level >= 4) return 'elevated'
  if (level >= 3) return 'active'
  if (level >= 2) return 'awakening'
  return 'dormant'
}

function calculatePowerLevel(
  zodiacDegree: number,
  dignity: string,
  modality: string,
  isCritical: boolean
): number {
  let power = 0.5 // Base

  // Dignity strongly affects power
  if (dignity === 'domicile') power += 0.3
  else if (dignity === 'exaltation') power += 0.4
  else if (dignity === 'detriment') power -= 0.2
  else if (dignity === 'fall') power -= 0.3

  // Critical degrees have more power
  if (isCritical) power += 0.15

  // Degree position affects power (0° and 29° are stronger)
  if (zodiacDegree === 0) power += 0.1
  if (zodiacDegree === 29) power += 0.15 // Anaretic most powerful

  // Fixed signs have more sustained power
  if (modality === 'Fixed') power += 0.05

  return Math.max(0, Math.min(1, power))
}

function getDegreeThemes(signThemes: string[], zodiacDegree: number): string[] {
  // Each decan (10-degree segment) has slightly different themes
  const decan = Math.floor(zodiacDegree / 10) // 0, 1, or 2

  // Base themes from sign
  const themes = [...signThemes]

  // Add decan-specific themes
  if (decan === 0) {
    themes.push('initiation', 'pure expression')
  } else if (decan === 1) {
    themes.push('development', 'refinement')
  } else {
    themes.push('mastery', 'culmination')
  }

  return themes
}

/**
 * Export the complete mapping for reference
 */
export const DEGREE_PLANETARY_AGENT_MAPPING = generateDegreePlanetaryAgentMapping()
