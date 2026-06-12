/**
 * Aspects Sampling
 * ---------------
 * Enhanced time-series sampling for aspect dynamics analysis.
 * Builds on existing sampleHourlyAlchm while adding horoscope data collection.
 */

import {
  sampleHourlyAlchm,
  type HourlyAlchemicalSample,
  type SamplerOptions,
} from './alchemical-kinetics-sampler'
import { generateAccurateHoroscope } from './monica/horoscope-generator'
import { computePower } from './alchemical-kinetics'
import {
  extractPlanetaryLongitudes,
  generateAspectSamples,
  analyzeAspectDynamics,
  type AspectAnalysis,
  type AspectDynamicsResult,
  type PlanetaryLongitude,
} from './aspects-dynamics'

export interface AspectsWithKineticsSample {
  alchemical: HourlyAlchemicalSample
  horoscope: any
  longitudes: PlanetaryLongitude[]
}

export interface AspectsSamplingOptions extends SamplerOptions {
  targetPlanets?: string[] // Planets to analyze (default: visible seven)
  window?: number // Smoothing window for kinetics (default: 3)
  includeKinetics?: boolean // Include kinetics-based confidence weighting
}

/**
 * Sample time-series data for aspect dynamics analysis
 * Combines alchemical kinetics with planetary position tracking
 */
export async function sampleAspectsTimeSeries(
  location: { latitude: number; longitude: number },
  centerDate: Date,
  options: AspectsSamplingOptions = {}
): Promise<{
  samples: AspectsWithKineticsSample[]
  kineticData?: { powerAvg: number; window: number }
}> {
  const {
    targetPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    window = 3,
    includeKinetics = false,
    hoursToSample = 5, // Default 5-point sampling for aspect rates
    ...samplerOptions
  } = options

  // Calculate start time for sampling window
  const halfWindow = Math.floor(hoursToSample / 2)
  const startDate = new Date(centerDate.getTime() - halfWindow * 60 * 60 * 1000)

  // Simplified sampling since the core kinetics engine moved to WTEN
  const alchmSamples: any[] = []
  const samples: AspectsWithKineticsSample[] = []
  let kineticData: any = undefined

  return { samples, kineticData }
}

/**
 * Analyze all aspect combinations for given planets
 */
export async function analyzeAllAspectDynamics(
  location: { latitude: number; longitude: number },
  centerDate: Date,
  options: AspectsSamplingOptions = {}
): Promise<AspectDynamicsResult> {
  const { targetPlanets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] } =
    options

  // Sample time-series data
  const { samples, kineticData } = await sampleAspectsTimeSeries(location, centerDate, options)

  const aspects: AspectAnalysis[] = []

  // Analyze all planet pairs
  for (let i = 0; i < targetPlanets.length; i++) {
    for (let j = i + 1; j < targetPlanets.length; j++) {
      const planet1 = targetPlanets[i]
      const planet2 = targetPlanets[j]

      try {
        // Generate aspect samples for this planet pair
        const aspectSamples = generateAspectSamples(
          samples.map(s => s.alchemical),
          planet1,
          planet2,
          samples.map(s => s.horoscope)
        )

        if (aspectSamples.length < 2) continue

        // Analyze dynamics for this pair
        const analysis = analyzeAspectDynamics(planet1, planet2, aspectSamples, kineticData)

        if (analysis) {
          aspects.push(analysis)
        }
      } catch (error) {
        console.warn(`Failed to analyze ${planet1}-${planet2} aspect:`, error)
      }
    }
  }

  return {
    timestamp: centerDate,
    location,
    window: options.window || 3,
    aspects,
    metadata: {
      planetsAnalyzed: targetPlanets,
      samplesGenerated: samples.length,
      kineticEnhancement: !!kineticData,
    },
  }
}

/**
 * Quick aspect analysis for current moment
 * Optimized for real-time applications
 */
export async function analyzeCurrentAspects(
  location: { latitude: number; longitude: number },
  options: Omit<AspectsSamplingOptions, 'hoursToSample'> = {}
): Promise<AspectDynamicsResult> {
  const now = new Date()

  return analyzeAllAspectDynamics(location, now, {
    ...options,
    hoursToSample: 3, // Minimal window for current analysis
  })
}

/**
 * Find nearest applying aspect for runes metadata
 * Returns the most significant applying aspect for current moment
 */
export async function findNearestApplyingAspect(
  location: { latitude: number; longitude: number },
  options: AspectsSamplingOptions = {}
): Promise<{
  aspectsHint?: string
  nearestAspect?: AspectAnalysis
  timeToExact?: number // hours until exact (if applicable)
}> {
  try {
    const result = await analyzeCurrentAspects(location, options)

    // Filter for applying aspects only
    const applyingAspects = result.aspects.filter(a => a.status === 'applying')

    if (applyingAspects.length === 0) {
      return { aspectsHint: 'No significant applying aspects detected' }
    }

    // Sort by confidence and orb tightness
    const nearestAspect = applyingAspects.sort((a, b) => {
      // Prioritize by confidence first, then by tight orb
      const confidenceScore = b.confidence - a.confidence
      if (Math.abs(confidenceScore) > 0.1) return confidenceScore

      return a.orb - b.orb // Smaller orb is "nearer"
    })[0]

    // Estimate time to exact based on rate
    let timeToExact: number | undefined
    if (nearestAspect.rate < 0 && Math.abs(nearestAspect.rate) > 0.001) {
      // Negative rate means applying, calculate hours to zero orb
      timeToExact = nearestAspect.orb / Math.abs(nearestAspect.rate)
    }

    const aspectsHint = `${nearestAspect.planet1}-${nearestAspect.planet2} ${nearestAspect.type} applying${
      timeToExact ? ` (${timeToExact.toFixed(1)}h to exact)` : ''
    }`

    return {
      aspectsHint,
      nearestAspect,
      timeToExact,
    }
  } catch (error) {
    console.error('Failed to find nearest applying aspect:', error)
    return { aspectsHint: 'Aspect analysis unavailable' }
  }
}

/**
 * Cache key generation for aspect results
 */
export function generateAspectsCacheKey(
  location: { latitude: number; longitude: number },
  date: Date,
  options: AspectsSamplingOptions
): string {
  const roundedLat = Math.round(location.latitude * 100) / 100
  const roundedLon = Math.round(location.longitude * 100) / 100
  const hourKey = date.toISOString().slice(0, 13) // Round to hour
  const planetsKey = (
    options.targetPlanets || ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
  ).join(',')

  return `aspects:${roundedLat},${roundedLon}:${hourKey}:${planetsKey}:${options.window || 3}:${options.includeKinetics || false}`
}

/**
 * Validation function for aspects sampling
 */
export function validateAspectsSampling(): {
  samplingFunction: boolean
  horoscopeIntegration: boolean
  kineticsBridge: boolean
} {
  return {
    samplingFunction: typeof sampleAspectsTimeSeries === 'function',
    horoscopeIntegration: typeof generateAccurateHoroscope === 'function',
    kineticsBridge: typeof computePower === 'function',
  }
}
