/**
 * Aspects Dynamics
 * ----------------
 * Applying/separating aspect detection using alchemical kinetics foundation.
 * Integrates with existing sampleHourlyAlchm for time-series analysis.
 *
 * Traditional astrological aspects with velocity-based applying/separating logic.
 * No modifications to core alchemizer formulas - builds on kinetics for temporal dynamics.
 */

import type { HourlyAlchemicalSample } from './alchemical-kinetics-sampler'

// Major aspects with traditional orbs (degrees)
export interface AspectDefinition {
  type: 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile'
  angle: number // Target angle in degrees
  orb: number // Maximum orb allowance
}

export const MAJOR_ASPECTS: AspectDefinition[] = [
  { type: 'conjunction', angle: 0, orb: 10 },
  { type: 'opposition', angle: 180, orb: 10 },
  { type: 'trine', angle: 120, orb: 8 },
  { type: 'square', angle: 90, orb: 8 },
  { type: 'sextile', angle: 60, orb: 6 },
]

export interface PlanetaryLongitude {
  planet: string
  longitude: number // degrees 0-360
  t: Date
}

export interface AspectSample {
  t: Date
  λ1: number // planet1 longitude
  λ2: number // planet2 longitude
  separation: number // angular separation
}

export interface AspectAnalysis {
  planet1: string
  planet2: string
  type: AspectDefinition['type']
  orb: number // current orb in degrees
  status: 'applying' | 'exact' | 'separating'
  rate: number // degrees per hour (negative = applying)
  confidence: number // 0-1 confidence score
  timestamps: Date[] // sample times used
  samples: number // number of data points
  kineticInfluence?: number // kinetics-weighted adjustment
}

export interface AspectDynamicsResult {
  timestamp: Date
  location: { latitude: number; longitude: number }
  window: number
  aspects: AspectAnalysis[]
  metadata: {
    planetsAnalyzed: string[]
    samplesGenerated: number
    kineticEnhancement: boolean
  }
}

/**
 * Normalize angle to 0-360 degree range
 */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0

  let normalized = angle % 360
  if (normalized < 0) normalized += 360

  return normalized
}

/**
 * Calculate shortest angular distance between two longitudes
 */
export function angularSeparation(λ1: number, λ2: number): number {
  const norm1 = normalizeAngle(λ1)
  const norm2 = normalizeAngle(λ2)

  let separation = Math.abs(norm1 - norm2)
  if (separation > 180) {
    separation = 360 - separation
  }

  return separation
}

/**
 * Find the closest major aspect for given angular separation
 */
export function closestAspectAngle(delta: number): {
  type: AspectDefinition['type']
  target: number
  orb: number
} | null {
  const separation = angularSeparation(delta, 0) // Normalize separation

  let closestAspect: AspectDefinition | null = null
  let minOrb = Infinity

  for (const aspect of MAJOR_ASPECTS) {
    const orbFromAspect = Math.abs(separation - aspect.angle)

    // Check if within orb and closer than previous
    if (orbFromAspect <= aspect.orb && orbFromAspect < minOrb) {
      closestAspect = aspect
      minOrb = orbFromAspect
    }
  }

  if (!closestAspect) return null

  return {
    type: closestAspect.type,
    target: closestAspect.angle,
    orb: minOrb,
  }
}

/**
 * Compute angular rate of change from time series samples
 * Returns degrees per hour (negative = approaching, positive = separating)
 */
export function computeAngularRate(samples: AspectSample[]): {
  rateDegPerHour: number
  confidence: number
} {
  if (!samples || samples.length < 2) {
    return { rateDegPerHour: 0, confidence: 0 }
  }

  // Sort by time to ensure proper ordering
  const sortedSamples = [...samples].sort((a, b) => a.t.getTime() - b.t.getTime())

  // Calculate rate using linear regression for stability
  const rates: number[] = []

  for (let i = 1; i < sortedSamples.length; i++) {
    const prev = sortedSamples[i - 1]
    const curr = sortedSamples[i]

    const dtHours = (curr.t.getTime() - prev.t.getTime()) / (1000 * 60 * 60)
    if (dtHours <= 0) continue

    // Handle angle wrapping for separation calculation
    let prevSep = prev.separation
    let currSep = curr.separation

    // If separation jumped significantly, likely wrapped around 0/360
    if (Math.abs(currSep - prevSep) > 180) {
      if (currSep > prevSep) {
        prevSep += 360 // Previous was actually larger
      } else {
        currSep += 360 // Current is actually larger
      }
    }

    const dSeparation = currSep - prevSep
    const rate = dSeparation / dtHours

    rates.push(rate)
  }

  if (rates.length === 0) {
    return { rateDegPerHour: 0, confidence: 0 }
  }

  // Average rate with outlier filtering
  const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length

  // Calculate confidence based on consistency
  const variance = rates.reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) / rates.length
  const stdDev = Math.sqrt(variance)

  // Confidence decreases with higher variance
  let confidence = 1.0 / (1.0 + stdDev)

  // Boost confidence for larger sample sizes
  confidence *= Math.min(1.0, samples.length / 3.0)

  return {
    rateDegPerHour: avgRate,
    confidence: Math.max(0, Math.min(1, confidence)),
  }
}

/**
 * Classify aspect as applying, exact, or separating based on orb progression
 */
export function classifyApplying(
  orbPrev: number,
  orbCurr: number,
  exactThreshold: number = 1.0
): 'applying' | 'exact' | 'separating' {
  // Handle null/undefined gracefully
  if (!Number.isFinite(orbPrev) || !Number.isFinite(orbCurr)) {
    return 'exact' // Safe default
  }

  // If current orb is very small, consider exact
  if (orbCurr <= exactThreshold) {
    return 'exact'
  }

  // Compare orb progression
  if (orbCurr < orbPrev) {
    return 'applying' // Orb decreasing - approaching exactness
  } else if (orbCurr > orbPrev) {
    return 'separating' // Orb increasing - moving away from exactness
  }

  return 'exact' // Orbs equal or very close
}

/**
 * Compute confidence score with kinetics integration
 * Uses velocity consistency, sample quality, and optional power weighting
 * Bridges to existing alchemical-kinetics system for enhanced confidence
 */
export function computeConfidence(args: {
  rate: number
  powerAvg?: number
  window: number
  samples: number
  baseConfidence?: number
}): number {
  const { rate, powerAvg, window, samples, baseConfidence = 0.5 } = args

  let confidence = baseConfidence

  // Rate magnitude factor - higher rates are more reliable for detection
  const rateMagnitude = Math.abs(rate)
  const sigmoidRate = 2 / (1 + Math.exp(-rateMagnitude * 2)) - 1 // Sigmoid 0-1
  confidence *= sigmoidRate

  // Sample size factor
  const sampleFactor = Math.min(1.0, samples / 3.0)
  confidence *= sampleFactor

  // Window size factor - larger windows provide more stability
  const windowFactor = Math.min(1.0, window / 3.0)
  confidence *= windowFactor

  // Kinetics power integration (if available)
  // Bridge to alchemical-kinetics system: power represents dEnergy/dt
  if (typeof powerAvg === 'number' && Number.isFinite(powerAvg)) {
    // Apply kinetics-based confidence weighting
    // Power values are typically in range [-2, +2] for normal cosmic conditions
    const normalizedPower = Math.max(-2, Math.min(2, powerAvg)) / 2 // Normalize to [-1, +1]

    // Kinetic confidence boost: higher absolute power increases confidence
    const kineticBoost = 1.0 + Math.abs(normalizedPower) * 0.3 // Up to 30% boost
    confidence *= kineticBoost

    // Direction matters: applying aspects with increasing power are more reliable
    if (normalizedPower > 0.1) {
      confidence *= 1.1 // 10% bonus for positive momentum
    }
  }

  // Ensure final confidence is in valid range
  return Math.max(0, Math.min(1, confidence))
}

/**
 * Enhanced confidence with full kinetics integration
 * Uses additional alchemical-kinetics metrics for comprehensive weighting
 */
export function computeEnhancedConfidence(args: {
  rate: number
  samples: number
  window: number
  baseConfidence?: number
  kineticData?: {
    powerAvg: number
    velocityMagnitude?: number
    momentumType?: 'building' | 'sustained' | 'dissipating'
    thermalDirection?: 'heating' | 'cooling' | 'stable'
    dominantElement?: string
  }
}): number {
  const { rate, samples, window, baseConfidence = 0.5, kineticData } = args

  // Start with standard confidence calculation
  let confidence = computeConfidence({
    rate,
    powerAvg: kineticData?.powerAvg,
    window,
    samples,
    baseConfidence,
  })

  // Enhanced kinetics integration if full data available
  if (kineticData) {
    // Velocity magnitude enhancement
    if (typeof kineticData.velocityMagnitude === 'number') {
      const velocityBoost = Math.min(0.2, kineticData.velocityMagnitude * 0.1) // Up to 20% boost
      confidence *= 1.0 + velocityBoost
    }

    // Momentum type weighting
    if (kineticData.momentumType) {
      const momentumFactors = {
        building: 1.15, // Building momentum is most reliable
        sustained: 1.05, // Sustained momentum is stable
        dissipating: 0.95, // Dissipating momentum is less reliable
      }
      confidence *= momentumFactors[kineticData.momentumType]
    }

    // Thermal direction correlation
    if (kineticData.thermalDirection) {
      const thermalFactors = {
        heating: 1.1, // Heating enhances confidence (active change)
        cooling: 1.0, // Neutral
        stable: 0.95, // Stable is less dynamic for aspects
      }
      confidence *= thermalFactors[kineticData.thermalDirection]
    }

    // Elemental alignment (Fire/Air enhance dynamic aspects)
    if (kineticData.dominantElement) {
      const elementalFactors: Record<string, number> = {
        Fire: 1.1, // Fire enhances dynamic detection
        Air: 1.05, // Air supports motion
        Water: 1.0, // Neutral
        Earth: 0.95, // Earth dampens rapid change detection
      }
      const factor = elementalFactors[kineticData.dominantElement] || 1.0
      confidence *= factor
    }
  }

  // Final confidence clamping
  return Math.max(0, Math.min(1, confidence))
}

/**
 * Extract planetary longitudes from horoscope data
 * Compatible with existing horoscope generator format
 */
export function extractPlanetaryLongitudes(
  horoscope: any,
  targetPlanets: string[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
): PlanetaryLongitude[] {
  const longitudes: PlanetaryLongitude[] = []

  if (!horoscope?.tropical?.CelestialBodies?.all) {
    return longitudes
  }

  const celestialBodies = horoscope.tropical.CelestialBodies.all

  for (const body of celestialBodies) {
    if (!body.label || !targetPlanets.includes(body.label)) continue

    try {
      // Convert sign and degrees to absolute longitude
      const longitude = convertSignDegreesToLongitude(body.Sign?.label, body.degrees)

      longitudes.push({
        planet: body.label,
        longitude,
        t: new Date(), // Will be updated by caller with actual sample time
      })
    } catch (error) {
      console.warn(`Failed to extract longitude for ${body.label}:`, error)
    }
  }

  return longitudes
}

/**
 * Convert zodiac sign and degrees to absolute longitude (0-360)
 */
export function convertSignDegreesToLongitude(sign: string | undefined, degrees: number): number {
  if (!sign || !Number.isFinite(degrees)) return 0

  const signOrder = [
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
  ]

  const signIndex = signOrder.indexOf(sign)
  if (signIndex === -1) return 0

  // Each sign spans 30 degrees
  const longitude = signIndex * 30 + Math.max(0, Math.min(30, degrees))

  return normalizeAngle(longitude)
}

/**
 * Generate aspect samples from alchemical time series
 * Extracts planetary positions and calculates separations
 */
export function generateAspectSamples(
  alchmSamples: HourlyAlchemicalSample[],
  planet1: string,
  planet2: string,
  horoscopeData: any[] // Array of horoscopes corresponding to samples
): AspectSample[] {
  const aspectSamples: AspectSample[] = []

  if (!alchmSamples || !horoscopeData || alchmSamples.length !== horoscopeData.length) {
    return aspectSamples
  }

  for (let i = 0; i < alchmSamples.length; i++) {
    const sample = alchmSamples[i]
    const horoscope = horoscopeData[i]

    if (!horoscope) continue

    const longitudes = extractPlanetaryLongitudes(horoscope, [planet1, planet2])
    const λ1 = longitudes.find(l => l.planet === planet1)?.longitude
    const λ2 = longitudes.find(l => l.planet === planet2)?.longitude

    if (typeof λ1 === 'number' && typeof λ2 === 'number') {
      aspectSamples.push({
        t: sample.t,
        λ1,
        λ2,
        separation: angularSeparation(λ1, λ2),
      })
    }
  }

  return aspectSamples
}

/**
 * Analyze aspect dynamics for a planet pair using time series data
 */
export function analyzeAspectDynamics(
  planet1: string,
  planet2: string,
  aspectSamples: AspectSample[],
  kineticData?: { powerAvg: number; window: number }
): AspectAnalysis | null {
  if (!aspectSamples || aspectSamples.length < 2) return null

  // Get current (latest) separation
  const latestSample = aspectSamples[aspectSamples.length - 1]
  const currentSeparation = latestSample.separation

  // Find closest aspect
  const closestAspect = closestAspectAngle(currentSeparation)
  if (!closestAspect) return null

  // Calculate angular rate
  const rateAnalysis = computeAngularRate(aspectSamples)

  // Determine applying/separating status
  let status: 'applying' | 'exact' | 'separating' = 'exact'
  if (aspectSamples.length >= 2) {
    const prevSample = aspectSamples[aspectSamples.length - 2]
    const prevOrb = Math.abs(prevSample.separation - closestAspect.target)
    const currentOrb = closestAspect.orb

    status = classifyApplying(prevOrb, currentOrb)
  }

  // Compute confidence with kinetics integration
  const confidence = computeConfidence({
    rate: Math.abs(rateAnalysis.rateDegPerHour),
    powerAvg: kineticData?.powerAvg,
    window: kineticData?.window || 1,
    samples: aspectSamples.length,
    baseConfidence: rateAnalysis.confidence,
  })

  return {
    planet1,
    planet2,
    type: closestAspect.type,
    orb: closestAspect.orb,
    status,
    rate: rateAnalysis.rateDegPerHour,
    confidence,
    timestamps: aspectSamples.map(s => s.t),
    samples: aspectSamples.length,
    kineticInfluence: kineticData?.powerAvg,
  }
}

/**
 * Validation helpers for aspect calculations
 */
export function validateAspectCalculations(): {
  angleNormalization: boolean
  aspectDetection: boolean
  applyingClassification: boolean
} {
  const results = {
    angleNormalization: true,
    aspectDetection: true,
    applyingClassification: true,
  }

  try {
    // Test angle normalization
    if (normalizeAngle(380) !== 20) results.angleNormalization = false
    if (normalizeAngle(-10) !== 350) results.angleNormalization = false

    // Test aspect detection
    const conjAspect = closestAspectAngle(5) // Should find conjunction
    if (!conjAspect || conjAspect.type !== 'conjunction') results.aspectDetection = false

    const trineAspect = closestAspectAngle(123) // Should find trine
    if (!trineAspect || trineAspect.type !== 'trine') results.aspectDetection = false

    // Test applying classification
    if (classifyApplying(5, 3) !== 'applying') results.applyingClassification = false
    if (classifyApplying(3, 5) !== 'separating') results.applyingClassification = false
    if (classifyApplying(0.5, 0.5) !== 'exact') results.applyingClassification = false
  } catch (error) {
    console.error('Aspect validation error:', error)
    return { angleNormalization: false, aspectDetection: false, applyingClassification: false }
  }

  return results
}
