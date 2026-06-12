// Personality Generator for Personalized AI

import type { BirthChartData, BasePersonality, TrainingScores } from '../types/personalized-ai'

/**
 * Generate base personality from birth chart data
 */
export function generateBasePersonality(birthChart: BirthChartData): BasePersonality {
  // Calculate elemental balance
  const elementalBalance = calculateElementalBalance(birthChart)

  // Determine archetype based on dominant element and alchemical data
  const archetype = determineArchetype(elementalBalance, birthChart.alchemicalData)

  // Extract core traits from planetary positions
  const coreTraits = extractCoreTraits(birthChart)

  // Calculate communication style metrics
  const communicationStyle = calculateCommunicationStyle(birthChart)

  // Analyze planetary influences
  const planetaryInfluences = analyzePlanetaryInfluences(birthChart)

  return {
    archetype,
    coreTraits,
    communicationStyle,
    planetaryInfluences,
    elementalBalance,
  }
}

/**
 * Calculate elemental balance from chart
 */
function calculateElementalBalance(birthChart: BirthChartData): {
  fire: number
  earth: number
  air: number
  water: number
} {
  const elements = { fire: 0, earth: 0, air: 0, water: 0 }
  const elementMapping: Record<string, keyof typeof elements> = {
    Aries: 'fire',
    Leo: 'fire',
    Sagittarius: 'fire',
    Taurus: 'earth',
    Virgo: 'earth',
    Capricorn: 'earth',
    Gemini: 'air',
    Libra: 'air',
    Aquarius: 'air',
    Cancer: 'water',
    Scorpio: 'water',
    Pisces: 'water',
  }

  // Count planets in each element
  for (const [planet, data] of Object.entries(birthChart.planets)) {
    const element = elementMapping[data.sign]
    if (element) {
      // Weight based on planet importance
      const weight = getPlanetWeight(planet)
      elements[element] += weight
    }
  }

  // Normalize to percentages
  const total = Object.values(elements).reduce((sum, val) => sum + val, 0)

  return {
    fire: Math.round((elements.fire / total) * 100),
    earth: Math.round((elements.earth / total) * 100),
    air: Math.round((elements.air / total) * 100),
    water: Math.round((elements.water / total) * 100),
  }
}

/**
 * Get weight for planet importance
 */
function getPlanetWeight(planet: string): number {
  const weights: Record<string, number> = {
    Sun: 3,
    Moon: 3,
    Mercury: 2,
    Venus: 2,
    Mars: 2,
    Jupiter: 1.5,
    Saturn: 1.5,
    Uranus: 1,
    Neptune: 1,
    Pluto: 1,
  }

  return weights[planet] || 1
}

/**
 * Determine archetype based on elements and alchemical data
 */
function determineArchetype(
  elementalBalance: ReturnType<typeof calculateElementalBalance>,
  alchemicalData: BirthChartData['alchemicalData']
): string {
  // Find dominant element
  const dominantElement = Object.entries(elementalBalance).sort(([, a], [, b]) => b - a)[0][0]

  // Consider alchemical balance
  const spiritDominant = alchemicalData.Spirit > alchemicalData.Matter
  const essenceDominant = alchemicalData.Essence > alchemicalData.Substance

  // Map to archetypes
  if (dominantElement === 'fire' && spiritDominant) {
    return 'The Visionary Pioneer'
  } else if (dominantElement === 'earth' && !spiritDominant) {
    return 'The Practical Builder'
  } else if (dominantElement === 'air' && essenceDominant) {
    return 'The Intellectual Explorer'
  } else if (dominantElement === 'water' && !essenceDominant) {
    return 'The Intuitive Healer'
  } else if (elementalBalance.fire > 30 && elementalBalance.air > 30) {
    return 'The Creative Communicator'
  } else if (elementalBalance.earth > 30 && elementalBalance.water > 30) {
    return 'The Nurturing Guardian'
  } else {
    return 'The Balanced Seeker'
  }
}

/**
 * Extract core personality traits from chart
 */
function extractCoreTraits(birthChart: BirthChartData): string[] {
  const traits: string[] = []

  // Sun sign traits
  const sunSign = birthChart.planets.Sun?.sign
  if (sunSign) {
    traits.push(...getSunSignTraits(sunSign))
  }

  // Moon sign traits
  const moonSign = birthChart.planets.Moon?.sign
  if (moonSign) {
    traits.push(...getMoonSignTraits(moonSign))
  }

  // Rising sign traits (if available in houses)
  if (birthChart.houses?.ascendant) {
    traits.push(...getRisingSignTraits(birthChart.houses.ascendant))
  }

  // Alchemical traits
  if (birthChart.alchemicalData.Spirit > 60) {
    traits.push('Spiritually oriented', 'Idealistic')
  }
  if (birthChart.alchemicalData.Matter > 60) {
    traits.push('Practically minded', 'Grounded')
  }

  // Return unique traits
  return [...new Set(traits)].slice(0, 8) // Limit to 8 core traits
}

/**
 * Calculate communication style metrics
 */
function calculateCommunicationStyle(
  birthChart: BirthChartData
): BasePersonality['communicationStyle'] {
  let formality = 50
  let verbosity = 50
  let emotiveness = 50
  let directness = 50

  // Mercury position affects communication
  const mercurySign = birthChart.planets.Mercury?.sign
  if (mercurySign) {
    const mercuryTraits = getMercurySignTraits(mercurySign)
    formality += mercuryTraits.formality
    verbosity += mercuryTraits.verbosity
    directness += mercuryTraits.directness
  }

  // Moon affects emotiveness
  const moonSign = birthChart.planets.Moon?.sign
  if (moonSign) {
    const moonTraits = getMoonCommunicationTraits(moonSign)
    emotiveness += moonTraits.emotiveness
  }

  // Elemental balance affects style
  const elements = calculateElementalBalance(birthChart)
  formality += elements.earth * 0.3 - elements.fire * 0.2
  verbosity += elements.air * 0.3 - elements.earth * 0.2
  emotiveness += elements.water * 0.4 - elements.air * 0.2
  directness += elements.fire * 0.3 - elements.water * 0.2

  // Normalize to 0-100 range
  return {
    formality: Math.max(0, Math.min(100, formality)),
    verbosity: Math.max(0, Math.min(100, verbosity)),
    emotiveness: Math.max(0, Math.min(100, emotiveness)),
    directness: Math.max(0, Math.min(100, directness)),
  }
}

/**
 * Analyze planetary influences on personality
 */
function analyzePlanetaryInfluences(
  birthChart: BirthChartData
): BasePersonality['planetaryInfluences'] {
  const influences: BasePersonality['planetaryInfluences'] = {}

  for (const [planet, data] of Object.entries(birthChart.planets)) {
    const strength = calculatePlanetStrength(planet, data.sign, birthChart)
    const expression = getPlanetaryExpression(planet, data.sign)

    influences[planet] = {
      strength,
      expression,
    }
  }

  return influences
}

// Helper functions for traits

function getSunSignTraits(sign: string): string[] {
  const traits: Record<string, string[]> = {
    Aries: ['Bold', 'Pioneering', 'Independent', 'Direct'],
    Taurus: ['Reliable', 'Patient', 'Practical', 'Loyal'],
    Gemini: ['Curious', 'Adaptable', 'Communicative', 'Witty'],
    Cancer: ['Nurturing', 'Intuitive', 'Protective', 'Emotional'],
    Leo: ['Confident', 'Creative', 'Generous', 'Dramatic'],
    Virgo: ['Analytical', 'Helpful', 'Precise', 'Modest'],
    Libra: ['Diplomatic', 'Harmonious', 'Fair', 'Social'],
    Scorpio: ['Intense', 'Passionate', 'Mysterious', 'Transformative'],
    Sagittarius: ['Optimistic', 'Adventurous', 'Philosophical', 'Freedom-loving'],
    Capricorn: ['Ambitious', 'Disciplined', 'Responsible', 'Traditional'],
    Aquarius: ['Innovative', 'Humanitarian', 'Independent', 'Unconventional'],
    Pisces: ['Compassionate', 'Imaginative', 'Sensitive', 'Spiritual'],
  }

  return traits[sign] || ['Unique', 'Individual']
}

function getMoonSignTraits(sign: string): string[] {
  const traits: Record<string, string[]> = {
    Aries: ['Emotionally direct', 'Quick to react'],
    Taurus: ['Emotionally stable', 'Comfort-seeking'],
    Gemini: ['Emotionally curious', 'Mentally oriented'],
    Cancer: ['Deeply feeling', 'Protective of emotions'],
    Leo: ['Warm-hearted', 'Needs appreciation'],
    Virgo: ['Emotionally reserved', 'Service-oriented'],
    Libra: ['Seeks emotional balance', 'Partnership-focused'],
    Scorpio: ['Emotionally intense', 'Private'],
    Sagittarius: ['Emotionally free', 'Optimistic feelings'],
    Capricorn: ['Emotionally controlled', 'Responsible'],
    Aquarius: ['Emotionally detached', 'Friendly'],
    Pisces: ['Emotionally fluid', 'Empathetic'],
  }

  return traits[sign] || ['Emotionally complex']
}

function getRisingSignTraits(sign: string): string[] {
  // Similar to sun sign but affects outward behavior
  return [`${sign} demeanor`, `${sign} first impression`]
}

function getMercurySignTraits(sign: string): {
  formality: number
  verbosity: number
  directness: number
} {
  const traits: Record<string, { formality: number; verbosity: number; directness: number }> = {
    Aries: { formality: -20, verbosity: -10, directness: 30 },
    Taurus: { formality: 10, verbosity: -15, directness: 10 },
    Gemini: { formality: -10, verbosity: 30, directness: 0 },
    Cancer: { formality: 0, verbosity: 10, directness: -20 },
    Leo: { formality: 10, verbosity: 20, directness: 15 },
    Virgo: { formality: 20, verbosity: -10, directness: 20 },
    Libra: { formality: 15, verbosity: 15, directness: -15 },
    Scorpio: { formality: 5, verbosity: -20, directness: 25 },
    Sagittarius: { formality: -15, verbosity: 25, directness: 20 },
    Capricorn: { formality: 30, verbosity: -15, directness: 15 },
    Aquarius: { formality: -5, verbosity: 10, directness: 10 },
    Pisces: { formality: -10, verbosity: 20, directness: -25 },
  }

  return traits[sign] || { formality: 0, verbosity: 0, directness: 0 }
}

function getMoonCommunicationTraits(sign: string): { emotiveness: number } {
  const traits: Record<string, { emotiveness: number }> = {
    Aries: { emotiveness: 20 },
    Taurus: { emotiveness: -10 },
    Gemini: { emotiveness: -15 },
    Cancer: { emotiveness: 40 },
    Leo: { emotiveness: 25 },
    Virgo: { emotiveness: -20 },
    Libra: { emotiveness: 10 },
    Scorpio: { emotiveness: 35 },
    Sagittarius: { emotiveness: 15 },
    Capricorn: { emotiveness: -25 },
    Aquarius: { emotiveness: -20 },
    Pisces: { emotiveness: 45 },
  }

  return traits[sign] || { emotiveness: 0 }
}

function calculatePlanetStrength(planet: string, sign: string, birthChart: BirthChartData): number {
  // Base strength
  let strength = 50

  // Check for dignity (simplified)
  const dignities: Record<string, { domicile: string[]; exaltation: string[] }> = {
    Sun: { domicile: ['Leo'], exaltation: ['Aries'] },
    Moon: { domicile: ['Cancer'], exaltation: ['Taurus'] },
    Mercury: { domicile: ['Gemini', 'Virgo'], exaltation: ['Virgo'] },
    Venus: { domicile: ['Taurus', 'Libra'], exaltation: ['Pisces'] },
    Mars: { domicile: ['Aries', 'Scorpio'], exaltation: ['Capricorn'] },
    Jupiter: { domicile: ['Sagittarius', 'Pisces'], exaltation: ['Cancer'] },
    Saturn: { domicile: ['Capricorn', 'Aquarius'], exaltation: ['Libra'] },
  }

  const planetDignity = dignities[planet]
  if (planetDignity) {
    if (planetDignity.domicile.includes(sign)) strength += 30
    if (planetDignity.exaltation.includes(sign)) strength += 20
  }

  // Aspects would affect strength (simplified for now)
  const aspectCount =
    birthChart.aspects?.filter(a => a.planet1 === planet || a.planet2 === planet).length || 0

  strength += aspectCount * 5

  return Math.min(100, strength)
}

function getPlanetaryExpression(planet: string, sign: string): string[] {
  const baseExpression = {
    Sun: ['Identity', 'Vitality', 'Purpose'],
    Moon: ['Emotions', 'Instincts', 'Comfort'],
    Mercury: ['Communication', 'Thinking', 'Learning'],
    Venus: ['Love', 'Beauty', 'Values'],
    Mars: ['Action', 'Desire', 'Courage'],
    Jupiter: ['Growth', 'Optimism', 'Wisdom'],
    Saturn: ['Discipline', 'Structure', 'Responsibility'],
    Uranus: ['Innovation', 'Freedom', 'Rebellion'],
    Neptune: ['Imagination', 'Spirituality', 'Illusion'],
    Pluto: ['Transformation', 'Power', 'Regeneration'],
  }

  const expressions = baseExpression[planet as keyof typeof baseExpression] || ['Energy']

  // Modify based on sign
  return expressions.map((expr: string) => `${expr} through ${sign}`)
}

/**
 * Generate initial training scores based on birth chart
 */
export function generateInitialTrainingScores(birthChart: BirthChartData): TrainingScores {
  const baseScore = 50 // Start at 50% for all categories

  // Calculate modifiers based on chart
  const mercurySign = birthChart.planets.Mercury?.sign
  const moonSign = birthChart.planets.Moon?.sign
  const elements = calculateElementalBalance(birthChart)

  return {
    communication_style: Math.min(
      70,
      baseScore + elements.air * 0.2 + (mercurySign === 'Gemini' ? 10 : 0)
    ),
    knowledge_depth: Math.min(
      70,
      baseScore + elements.earth * 0.15 + birthChart.alchemicalData.Matter * 0.1
    ),
    emotional_intelligence: Math.min(
      70,
      baseScore + elements.water * 0.2 + (moonSign === 'Cancer' ? 10 : 0)
    ),
    creativity: Math.min(
      70,
      baseScore + elements.fire * 0.15 + birthChart.alchemicalData.Spirit * 0.1
    ),
    memory_integration: Math.min(
      70,
      baseScore + elements.earth * 0.1 + birthChart.alchemicalData.Substance * 0.1
    ),
    personality_alignment: baseScore, // Starts at 50%, grows with interaction
  }
}
