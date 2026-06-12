// Enhanced Monica Constant validator with comprehensive edge case handling
// Implements the sacred formula: MC = (Spirit × φ + Essence) / (Matter + Substance + 1)

export interface MonicaConstantClassification {
  level: number
  name: string
  description: string
  threshold: number
}

export interface MonicaConstantInput {
  spirit: number
  essence: number
  matter: number
  substance: number
  fire?: number
  water?: number
  air?: number
  earth?: number
}

// Golden ratio constant
const PHI = 1.618033988749895

// Classification thresholds based on consciousness levels
const MC_CLASSIFICATIONS: MonicaConstantClassification[] = [
  {
    level: 1,
    name: 'Dormant',
    description: 'Initial consciousness state requiring foundation building',
    threshold: 0,
  },
  {
    level: 2,
    name: 'Awakening',
    description: 'Emerging consciousness with expanding awareness',
    threshold: 0.5,
  },
  {
    level: 3,
    name: 'Active',
    description: 'Engaged consciousness with balanced expression',
    threshold: 1.0,
  },
  {
    level: 4,
    name: 'Elevated',
    description: 'Advanced consciousness with harmonic resonance',
    threshold: 1.618,
  },
  {
    level: 5,
    name: 'Advanced',
    description: 'Integrated wisdom with significant growth capacity',
    threshold: 2.618,
  },
  {
    level: 6,
    name: 'Illuminated',
    description: 'Cosmic awareness with unlimited expansion potential',
    threshold: 4.236,
  },
  {
    level: 7,
    name: 'Transcendent',
    description: 'Unity consciousness with complete integration',
    threshold: 6.854,
  },
]

/**
 * Safe division helper to prevent division by zero
 */
function safeDivision(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || !isFinite(denominator)) {
    return fallback
  }
  const result = numerator / denominator
  return isFinite(result) ? result : fallback
}

/**
 * Validate and sanitize numeric input
 */
function validateNumericInput(
  value: number,
  defaultValue: number = 0,
  min: number = 0,
  max: number = 100
): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return defaultValue
  }
  return Math.max(min, Math.min(max, value))
}

/**
 * Calculate Monica Constant using the sacred formula
 * MC = (Spirit × φ + Essence) / (Matter + Substance + 1)
 */
export function calculateMC(
  spirit: number,
  essence: number,
  matter: number,
  substance: number,
  fire?: number,
  water?: number,
  air?: number,
  earth?: number
): number {
  // Validate and sanitize inputs
  const validSpirit = validateNumericInput(spirit)
  const validEssence = validateNumericInput(essence)
  const validMatter = validateNumericInput(matter)
  const validSubstance = validateNumericInput(substance)

  // Elemental bonuses (additive, no opposition)
  let elementalBonus = 0
  if (typeof fire === 'number' && isFinite(fire)) {
    elementalBonus += Math.max(0, fire) * 0.1 // Fire reinforces Spirit
  }
  if (typeof water === 'number' && isFinite(water)) {
    elementalBonus += Math.max(0, water) * 0.1 // Water reinforces Essence
  }
  if (typeof air === 'number' && isFinite(air)) {
    elementalBonus += Math.max(0, air) * 0.1 // Air reinforces Substance
  }
  if (typeof earth === 'number' && isFinite(earth)) {
    elementalBonus += Math.max(0, earth) * 0.1 // Earth reinforces Matter
  }

  // Core Monica Constant calculation
  const numerator = validSpirit * PHI + validEssence + elementalBonus
  const denominator = validMatter + validSubstance + 1 // +1 prevents division by zero

  const mc = safeDivision(numerator, denominator, 0)

  // Return bounded result with 3 decimal precision
  return Math.round(Math.max(0, Math.min(20, mc)) * 1000) / 1000
}

/**
 * Classify Monica Constant value into consciousness level
 */
export function classifyMC(mc: number): MonicaConstantClassification {
  const validMC = validateNumericInput(mc, 0, 0, 20)

  // Find the appropriate classification
  for (let i = MC_CLASSIFICATIONS.length - 1; i >= 0; i--) {
    if (validMC >= MC_CLASSIFICATIONS[i].threshold) {
      return MC_CLASSIFICATIONS[i]
    }
  }

  // Fallback to dormant state
  return MC_CLASSIFICATIONS[0]
}

/**
 * Batch calculate Monica Constants for multiple inputs
 */
export function batchCalculateMC(
  inputs: MonicaConstantInput[]
): Array<{ input: MonicaConstantInput; mc: number; classification: MonicaConstantClassification }> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return []
  }

  return inputs.map(input => {
    const mc = calculateMC(
      input.spirit,
      input.essence,
      input.matter,
      input.substance,
      input.fire,
      input.water,
      input.air,
      input.earth
    )

    return {
      input,
      mc,
      classification: classifyMC(mc),
    }
  })
}

/**
 * Calculate statistical summary of Monica Constants
 */
export function calculateMCStatistics(values: number[]): {
  average: number
  min: number
  max: number
  stdDev: number
  median: number
  count: number
} {
  if (!Array.isArray(values) || values.length === 0) {
    return { average: 0, min: 0, max: 0, stdDev: 0, median: 0, count: 0 }
  }

  const validValues = values.filter(v => typeof v === 'number' && isFinite(v))
  if (validValues.length === 0) {
    return { average: 0, min: 0, max: 0, stdDev: 0, median: 0, count: 0 }
  }

  const sorted = [...validValues].sort((a, b) => a - b)
  const sum = validValues.reduce((acc, v) => acc + v, 0)
  const average = sum / validValues.length

  // Calculate standard deviation
  const squaredDiffs = validValues.map(v => Math.pow(v - average, 2))
  const avgSquaredDiff = squaredDiffs.reduce((acc, v) => acc + v, 0) / validValues.length
  const stdDev = Math.sqrt(avgSquaredDiff)

  // Calculate median
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

  return {
    average: Math.round(average * 1000) / 1000,
    min: Math.round(sorted[0] * 1000) / 1000,
    max: Math.round(sorted[sorted.length - 1] * 1000) / 1000,
    stdDev: Math.round(stdDev * 1000) / 1000,
    median: Math.round(median * 1000) / 1000,
    count: validValues.length,
  }
}

/**
 * Get consciousness progression recommendations based on MC level
 */
export function getProgressionRecommendations(mc: number): string[] {
  const classification = classifyMC(mc)

  const recommendations: Record<string, string[]> = {
    Dormant: [
      'Focus on spiritual practices to elevate consciousness',
      'Engage in creative activities to stimulate Spirit element',
      'Establish daily meditation routine for stability',
    ],
    Awakening: [
      'Continue spiritual development with consistency',
      'Explore emotional expression to enhance Essence',
      'Begin integrative practices combining elements',
    ],
    Active: [
      'Maintain balance through diverse practices',
      'Develop teaching or sharing abilities',
      'Focus on practical manifestation of insights',
    ],
    Elevated: [
      'Share wisdom and guide others in their journey',
      'Explore advanced consciousness techniques',
      'Integrate cosmic awareness into daily life',
    ],
    Advanced: [
      'Become a bridge between worlds',
      'Develop mastery in chosen domains',
      'Guide others through transformation',
    ],
    Illuminated: [
      'Embody cosmic consciousness in service',
      'Transcend individual limitations',
      'Become a beacon for collective evolution',
    ],
    Transcendent: [
      'Maintain unity consciousness',
      'Serve as a pillar of universal wisdom',
      'Guide collective consciousness evolution',
    ],
  }

  return recommendations[classification.name] || recommendations['Dormant']
}
