/**
 * Alchemical Kinetics Service
 *
 * Implements the complete Alchemical Kinetics formulas:
 * - Elemental Velocity (Celeritas) - Mercury Principle
 * - Elemental Momentum (Impetus) - Mars + Saturn Synthesis
 * - Elemental Force (Vis) - Classical Force Principle
 * - Flow States - Jupiter Principle (Expansion) and Saturn Principle (Contraction)
 * - Resonance Fields - Venus + Neptune Principle
 * - Temporal Pressure - Sun + Moon Synthesis
 *
 * Based on KINETICS_FORMULAS_EXPLAINED.md
 */

import { logger } from '../utils/logger.js'
import { getPlanetaryHour, getCurrentPlanetaryPositions } from './planetary-service.js'
import { cacheService } from './cache.js'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ElementalValues {
  Fire: number
  Water: number
  Air: number
  Earth: number
}

export interface AlchemicalState {
  spirit: number
  essence: number
  matter: number
  substance: number
  elementals: ElementalValues
  timestamp: string
}

export interface ElementalVelocity {
  Fire: number
  Water: number
  Air: number
  Earth: number
  magnitude: number
}

export interface ElementalMomentum {
  Fire: number
  Water: number
  Air: number
  Earth: number
  magnitude: number
}

export interface ElementalForce {
  Fire: number
  Water: number
  Air: number
  Earth: number
  magnitude: number
  type: 'accelerating' | 'decelerating' | 'sustained'
}

export interface FlowState {
  expansion: number
  contraction: number
  balance: number
  type: 'expanding' | 'contracting' | 'balanced'
  description: string
}

export interface ResonanceField {
  harmonic: number
  discord: number
  purity: number
  quality: 'pure' | 'mixed' | 'chaotic'
}

export interface TemporalPressure {
  solarity: number // Sun influence
  lunarity: number // Moon influence
  pressure: number
  rhythm: 'diurnal' | 'nocturnal' | 'balanced'
}

export interface AlchemicalKinetics {
  velocity: ElementalVelocity
  momentum: ElementalMomentum
  force: ElementalForce
  flowState: FlowState
  resonance: ResonanceField
  temporalPressure: TemporalPressure
  metadata: {
    timestamp: string
    previousTimestamp: string | null
    timeInterval: number
    planetaryHour: string
  }
}

// ============================================================================
// PLANETARY MODIFIERS
// ============================================================================

/**
 * Get planetary velocity modifier based on current planetary hour and element
 */
function getPlanetaryVelocityModifier(
  planetaryHour: string,
  element: keyof ElementalValues
): number {
  let modifier = 1.0

  // Mercury hours: +10% global velocity boost
  if (planetaryHour === 'Mercury') {
    modifier *= 1.1
  }

  // Element-specific planetary boosts
  const boosts: Record<string, Record<string, number>> = {
    Fire: { Sun: 1.2, Mars: 1.2 },
    Water: { Moon: 1.15, Venus: 1.15 },
    Air: { Mercury: 1.15 },
    Earth: { Saturn: 1.1 },
  }

  if (boosts[element] && boosts[element][planetaryHour]) {
    modifier *= boosts[element][planetaryHour]
  }

  return modifier
}

/**
 * Get planetary momentum modifier
 */
function getPlanetaryMomentumModifier(planetaryHour: string): number {
  // Mars/Saturn hours: +15% momentum boost
  if (planetaryHour === 'Mars' || planetaryHour === 'Saturn') {
    return 1.15
  }
  return 1.0
}

/**
 * Get planetary force modifier
 */
function getPlanetaryForceModifier(planetaryHour: string): number {
  // Jupiter hours: +10% force amplification
  if (planetaryHour === 'Jupiter') {
    return 1.1
  }
  // Saturn hours: -5% force dampening
  if (planetaryHour === 'Saturn') {
    return 0.95
  }
  return 1.0
}

// ============================================================================
// CORE KINETICS CALCULATIONS
// ============================================================================

/**
 * Calculate Elemental Velocity (Celeritas)
 * Formula: velocity[element] = (current[element] - previous[element]) / timeInterval
 */
function calculateElementalVelocity(
  current: ElementalValues,
  previous: ElementalValues,
  timeInterval: number,
  planetaryHour: string
): ElementalVelocity {
  const elements: Array<keyof ElementalValues> = ['Fire', 'Water', 'Air', 'Earth']
  const velocity: Partial<ElementalVelocity> = {}

  elements.forEach(element => {
    const rawVelocity = (current[element] - previous[element]) / timeInterval
    const modifier = getPlanetaryVelocityModifier(planetaryHour, element)
    velocity[element] = rawVelocity * modifier
  })

  const magnitude = Math.sqrt(
    velocity.Fire! ** 2 + velocity.Water! ** 2 + velocity.Air! ** 2 + velocity.Earth! ** 2
  )

  return {
    Fire: velocity.Fire!,
    Water: velocity.Water!,
    Air: velocity.Air!,
    Earth: velocity.Earth!,
    magnitude,
  }
}

/**
 * Calculate Elemental Momentum (Impetus)
 * Formula: momentum[element] = current[element] * velocity[element]
 */
function calculateElementalMomentum(
  current: ElementalValues,
  velocity: ElementalVelocity,
  planetaryHour: string
): ElementalMomentum {
  const modifier = getPlanetaryMomentumModifier(planetaryHour)
  const elements: Array<keyof ElementalValues> = ['Fire', 'Water', 'Air', 'Earth']
  const momentum: Partial<ElementalMomentum> = {}

  elements.forEach(element => {
    momentum[element] = current[element] * velocity[element] * modifier
  })

  const magnitude = Math.sqrt(
    momentum.Fire! ** 2 + momentum.Water! ** 2 + momentum.Air! ** 2 + momentum.Earth! ** 2
  )

  return {
    Fire: momentum.Fire!,
    Water: momentum.Water!,
    Air: momentum.Air!,
    Earth: momentum.Earth!,
    magnitude,
  }
}

/**
 * Calculate Elemental Force (Vis)
 * Formula: force[element] = (currentMomentum[element] - previousMomentum[element]) / timeInterval
 */
function calculateElementalForce(
  currentMomentum: ElementalMomentum,
  previousMomentum: ElementalMomentum | null,
  timeInterval: number,
  planetaryHour: string
): ElementalForce {
  const modifier = getPlanetaryForceModifier(planetaryHour)
  const elements: Array<keyof ElementalValues> = ['Fire', 'Water', 'Air', 'Earth']
  const force: Partial<ElementalForce> = {}

  if (!previousMomentum) {
    // First calculation - no previous momentum
    elements.forEach(element => {
      force[element] = 0
    })
  } else {
    elements.forEach(element => {
      const rawForce = (currentMomentum[element] - previousMomentum[element]) / timeInterval
      force[element] = rawForce * modifier
    })
  }

  const magnitude = Math.sqrt(
    force.Fire! ** 2 + force.Water! ** 2 + force.Air! ** 2 + force.Earth! ** 2
  )

  // Determine force type
  let type: 'accelerating' | 'decelerating' | 'sustained'
  if (magnitude > 0.1) type = 'accelerating'
  else if (magnitude < -0.1) type = 'decelerating'
  else type = 'sustained'

  return {
    Fire: force.Fire!,
    Water: force.Water!,
    Air: force.Air!,
    Earth: force.Earth!,
    magnitude,
    type,
  }
}

/**
 * Calculate Flow State
 * Expansion (Jupiter): ΔE_total/Δt > 0.05
 * Contraction (Saturn): ΔE_total/Δt < -0.05
 */
function calculateFlowState(
  current: ElementalValues,
  previous: ElementalValues,
  timeInterval: number
): FlowState {
  const currentTotal = current.Fire + current.Water + current.Air + current.Earth
  const previousTotal = previous.Fire + previous.Water + previous.Air + previous.Earth

  const totalChange = (currentTotal - previousTotal) / timeInterval

  // Calculate expansion and contraction magnitudes
  const expansion = Math.max(0, totalChange)
  const contraction = Math.max(0, -totalChange)

  // Balance calculation
  const balance = 1 - Math.abs(expansion - contraction)

  // Determine type
  let type: 'expanding' | 'contracting' | 'balanced'
  let description: string

  if (totalChange > 0.05) {
    type = 'expanding'
    description = 'Jupiter-dominated expansion - consciousness growing and diversifying'
  } else if (totalChange < -0.05) {
    type = 'contracting'
    description = 'Saturn-dominated contraction - consciousness crystallizing and consolidating'
  } else {
    type = 'balanced'
    description = 'Balanced flow state - harmonious transformation'
  }

  return {
    expansion,
    contraction,
    balance,
    type,
    description,
  }
}

/**
 * Calculate Resonance Field
 * Harmonic resonance when elements align
 * Discord when elements conflict
 */
function calculateResonanceField(
  velocity: ElementalVelocity,
  momentum: ElementalMomentum
): ResonanceField {
  // Calculate alignment between velocity and momentum directions
  const velocityMag = velocity.magnitude
  const momentumMag = momentum.magnitude

  if (velocityMag === 0 || momentumMag === 0) {
    return {
      harmonic: 0,
      discord: 0,
      purity: 0,
      quality: 'chaotic',
    }
  }

  // Dot product of normalized vectors
  const dotProduct =
    (velocity.Fire * momentum.Fire +
      velocity.Water * momentum.Water +
      velocity.Air * momentum.Air +
      velocity.Earth * momentum.Earth) /
    (velocityMag * momentumMag)

  // Harmonic: positive alignment
  const harmonic = Math.max(0, dotProduct)
  // Discord: negative alignment
  const discord = Math.max(0, -dotProduct)

  // Purity: how strongly aligned (either direction)
  const purity = Math.abs(dotProduct)

  let quality: 'pure' | 'mixed' | 'chaotic'
  if (purity > 0.7) quality = 'pure'
  else if (purity > 0.3) quality = 'mixed'
  else quality = 'chaotic'

  return {
    harmonic,
    discord,
    purity,
    quality,
  }
}

/**
 * Calculate Temporal Pressure
 * Sun (diurnal) vs Moon (nocturnal) influence
 */
async function calculateTemporalPressure(
  current: AlchemicalState,
  timestamp: Date
): Promise<TemporalPressure> {
  const hour = timestamp.getHours()
  const planetaryHour = getPlanetaryHour(timestamp, 0) // Default latitude

  // Solarity: day strength (6am-6pm peak)
  const solarPeak = 12
  const solarDistance = Math.abs(hour - solarPeak)
  const solarity = Math.max(0, 1 - solarDistance / 12)

  // Lunarity: night strength (6pm-6am peak)
  const lunarPeak = 0 // midnight
  const lunarDistance = Math.min(Math.abs(hour - lunarPeak), Math.abs(hour - 24 - lunarPeak))
  const lunarity = Math.max(0, 1 - lunarDistance / 12)

  // Overall temporal pressure
  const pressure = Math.abs(solarity - lunarity)

  let rhythm: 'diurnal' | 'nocturnal' | 'balanced'
  if (solarity > lunarity + 0.2) rhythm = 'diurnal'
  else if (lunarity > solarity + 0.2) rhythm = 'nocturnal'
  else rhythm = 'balanced'

  return {
    solarity,
    lunarity,
    pressure,
    rhythm,
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Calculate complete alchemical kinetics
 */
export async function calculateAlchemicalKinetics(
  current: AlchemicalState,
  previous: AlchemicalState | null,
  location: { lat: number; lon: number }
): Promise<AlchemicalKinetics> {
  try {
    const currentTime = new Date(current.timestamp)
    const planetaryHour = getPlanetaryHour(currentTime, location.lat)

    // Calculate time interval in hours
    const timeInterval = previous
      ? (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) /
        (1000 * 60 * 60)
      : 1 // Default 1 hour for first calculation

    // Use previous state or current state for first calculation
    const prevState = previous || current

    // Calculate velocity
    const velocity = calculateElementalVelocity(
      current.elementals,
      prevState.elementals,
      timeInterval,
      planetaryHour
    )

    // Calculate momentum
    const momentum = calculateElementalMomentum(current.elementals, velocity, planetaryHour)

    // Calculate previous momentum if we have previous state
    let previousMomentum: ElementalMomentum | null = null
    if (previous) {
      const prevVelocity = calculateElementalVelocity(
        previous.elementals,
        current.elementals, // Use current as reference for direction
        timeInterval,
        planetaryHour
      )
      previousMomentum = calculateElementalMomentum(
        previous.elementals,
        prevVelocity,
        planetaryHour
      )
    }

    // Calculate force
    const force = calculateElementalForce(momentum, previousMomentum, timeInterval, planetaryHour)

    // Calculate flow state
    const flowState = calculateFlowState(current.elementals, prevState.elementals, timeInterval)

    // Calculate resonance
    const resonance = calculateResonanceField(velocity, momentum)

    // Calculate temporal pressure
    const temporalPressure = await calculateTemporalPressure(current, currentTime)

    return {
      velocity,
      momentum,
      force,
      flowState,
      resonance,
      temporalPressure,
      metadata: {
        timestamp: current.timestamp,
        previousTimestamp: previous?.timestamp || null,
        timeInterval,
        planetaryHour,
      },
    }
  } catch (error) {
    logger.error('Error calculating alchemical kinetics:', error)
    throw error
  }
}

/**
 * Calculate kinetics timeline for a date range
 */
export async function calculateKineticsTimeline(
  startDate: Date,
  endDate: Date,
  location: { lat: number; lon: number },
  intervalHours: number = 1
): Promise<AlchemicalKinetics[]> {
  try {
    const timeline: AlchemicalKinetics[] = []
    let currentDate = new Date(startDate)
    let previousState: AlchemicalState | null = null

    while (currentDate <= endDate) {
      // Generate alchemical state for this moment
      // This is a simplified version - in production you'd calculate actual planetary positions
      const hour = currentDate.getHours()
      const dayOfYear = Math.floor(
        (currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 0).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      const seasonalModifier = 0.1 * Math.sin((dayOfYear * 2 * Math.PI) / 365)
      const currentState: AlchemicalState = {
        spirit: 0.5 + seasonalModifier,
        essence: 0.5 + 0.1 * Math.sin((hour * Math.PI) / 12),
        matter: 0.5 - seasonalModifier * 0.3,
        substance: 0.5 + seasonalModifier * 0.2,
        elementals: {
          Fire: 5 + 2 * Math.sin((hour * Math.PI) / 12),
          Water: 5 + 2 * Math.cos((hour * Math.PI) / 12),
          Air: 5 + Math.sin((dayOfYear * 2 * Math.PI) / 365),
          Earth: 5 - Math.sin((dayOfYear * 2 * Math.PI) / 365),
        },
        timestamp: currentDate.toISOString(),
      }

      const kinetics = await calculateAlchemicalKinetics(currentState, previousState, location)
      timeline.push(kinetics)

      previousState = currentState
      currentDate = new Date(currentDate.getTime() + intervalHours * 60 * 60 * 1000)
    }

    return timeline
  } catch (error) {
    logger.error('Error calculating kinetics timeline:', error)
    throw error
  }
}

/**
 * Get cached or calculate kinetics
 */
export async function getCachedKinetics(
  current: AlchemicalState,
  previous: AlchemicalState | null,
  location: { lat: number; lon: number }
): Promise<AlchemicalKinetics> {
  const cacheKey = `kinetics:${current.timestamp}:${location.lat}:${location.lon}`
  const cacheTTL = 120 // 2 minutes

  try {
    const cached = await cacheService.get(cacheKey)
    if (cached) {
      logger.debug('Returning cached alchemical kinetics')
      return cached
    }

    const kinetics = await calculateAlchemicalKinetics(current, previous, location)
    await cacheService.set(cacheKey, kinetics, cacheTTL)

    return kinetics
  } catch (error) {
    logger.error('Error getting cached kinetics:', error)
    // Fallback to direct calculation
    return calculateAlchemicalKinetics(current, previous, location)
  }
}
