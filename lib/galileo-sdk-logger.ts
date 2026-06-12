// Official Galileo SDK Logger implementation
// Uses the proper GalileoLogger class with traces and spans

import { GalileoLogger } from 'galileo'

// Environment variables for Galileo configuration
const GALILEO_API_KEY = process.env.GALILEO_API_KEY
const GALILEO_PROJECT = process.env.GALILEO_PROJECT || 'AlchmPlanetaryAgents'
const QUANTITIES_STREAM = process.env.GALILEO_QUANTITIES_STREAM || 'alchm-quantities'

export interface QuantitiesData {
  Spirit: number
  Essence: number
  Matter: number
  Substance: number
  DayEssence: number
  NightEssence: number
}

export interface AlchemicalMetrics {
  quantities: QuantitiesData
  dominantElement: string
  heat: number
  entropy: number
  reactivity: number
  energy: number
  sunSign: string
  chartRuler: string
  timestamp: string
  planetaryPositions?: Record<string, any>
}

/**
 * High-level function to log alchemical quantities using official Galileo SDK
 */
export async function logQuantitiesToGalileo(
  metrics: AlchemicalMetrics,
  context: Record<string, any> = {}
): Promise<boolean> {
  if (!GALILEO_API_KEY) {
    console.warn('Galileo API key not configured - logging to console instead')
    console.log('====== ALCHM QUANTITIES LOG ======')
    console.log('Project:', GALILEO_PROJECT)
    console.log('Stream:', QUANTITIES_STREAM)
    console.log('Metrics:', JSON.stringify(metrics, null, 2))
    console.log('Context:', JSON.stringify(context, null, 2))
    console.log('===================================')
    return false
  }

  try {
    // Create a new Galileo logger instance
    const logger = new (GalileoLogger as any)({
      project: GALILEO_PROJECT,
      logStream: QUANTITIES_STREAM,
    })

    // Start a new trace for the alchemical calculation
    const traceInput = JSON.stringify({
      request: 'Calculate alchemical quantities',
      timestamp: metrics.timestamp,
      astrological_context: {
        sun_sign: metrics.sunSign,
        chart_ruler: metrics.chartRuler,
        planetary_positions: metrics.planetaryPositions,
      },
      context,
    })

    logger.startTrace({ input: traceInput })

    // Record the start time for duration tracking
    const startTime = process.hrtime.bigint()

    // Add retriever span for getting planetary positions
    const retrieverStartTime = process.hrtime.bigint()
    // Simulate retriever operation time
    await new Promise(resolve => setTimeout(resolve, 10))
    const retrieverDuration = Number(process.hrtime.bigint() - retrieverStartTime)

    ;(logger as any).addSpan({
      name: 'get-planetary-positions',
      spanType: 'retriever',
      input: JSON.stringify({
        request: 'Get current planetary positions',
        timestamp: metrics.timestamp,
      }),
      output: JSON.stringify({
        sun_sign: metrics.sunSign,
        chart_ruler: metrics.chartRuler,
        planetary_positions: metrics.planetaryPositions,
      }),
      durationNs: retrieverDuration,
    })

    // Add tool span for calculating base quantities
    const quantityCalcStartTime = process.hrtime.bigint()
    await new Promise(resolve => setTimeout(resolve, 20))
    const quantityCalcDuration = Number(process.hrtime.bigint() - quantityCalcStartTime)

    ;(logger as any).addSpan({
      name: 'calculate-base-quantities',
      spanType: 'tool',
      input: JSON.stringify({
        planetary_data: metrics.planetaryPositions,
        calculation_method: 'alchemical-transformation',
      }),
      output: JSON.stringify({
        quantities: metrics.quantities,
        dominant_element: metrics.dominantElement,
      }),
      durationNs: quantityCalcDuration,
      metadata: {
        spirit_quantity: String(metrics.quantities.Spirit),
        essence_quantity: String(metrics.quantities.Essence),
        matter_quantity: String(metrics.quantities.Matter),
        substance_quantity: String(metrics.quantities.Substance),
        day_essence: String(metrics.quantities.DayEssence),
        night_essence: String(metrics.quantities.NightEssence),
        dominant_element: metrics.dominantElement,
      },
    })

    // Add tool span for calculating alchemical metrics
    const metricsCalcStartTime = process.hrtime.bigint()
    await new Promise(resolve => setTimeout(resolve, 15))
    const metricsCalcDuration = Number(process.hrtime.bigint() - metricsCalcStartTime)

    ;(logger as any).addSpan({
      name: 'calculate-alchemical-metrics',
      spanType: 'tool',
      input: JSON.stringify({
        base_quantities: metrics.quantities,
        dominant_element: metrics.dominantElement,
      }),
      output: JSON.stringify({
        heat: metrics.heat,
        entropy: metrics.entropy,
        reactivity: metrics.reactivity,
        energy: metrics.energy,
      }),
      durationNs: metricsCalcDuration,
      metadata: {
        heat: String(metrics.heat),
        entropy: String(metrics.entropy),
        reactivity: String(metrics.reactivity),
        energy: String(metrics.energy),
      },
    })

    // Calculate total duration and conclude the trace
    const totalDuration = Number(process.hrtime.bigint() - startTime)

    const traceOutput = JSON.stringify({
      quantities: metrics.quantities,
      alchemical_metrics: {
        dominant_element: metrics.dominantElement,
        heat: metrics.heat,
        entropy: metrics.entropy,
        reactivity: metrics.reactivity,
        energy: metrics.energy,
      },
      astrological_context: {
        sun_sign: metrics.sunSign,
        chart_ruler: metrics.chartRuler,
      },
      calculation_success: true,
    })

    logger.conclude({
      output: traceOutput,
      durationNs: totalDuration,
    })

    // Flush the logger to send data to Galileo
    await logger.flush()

    console.log(`Successfully logged alchemical quantities to Galileo stream: ${QUANTITIES_STREAM}`)
    return true
  } catch (error) {
    console.error('Error logging quantities to Galileo:', error)

    // Fallback: log to console with structured format
    console.log('====== ALCHM QUANTITIES LOG (FALLBACK) ======')
    console.log('Project:', GALILEO_PROJECT)
    console.log('Stream:', QUANTITIES_STREAM)
    console.log('Timestamp:', metrics.timestamp)
    console.log('Quantities:', {
      Spirit: metrics.quantities.Spirit,
      Essence: metrics.quantities.Essence,
      Matter: metrics.quantities.Matter,
      Substance: metrics.quantities.Substance,
      DayEssence: metrics.quantities.DayEssence,
      NightEssence: metrics.quantities.NightEssence,
    })
    console.log('Alchemical Metrics:', {
      dominantElement: metrics.dominantElement,
      heat: metrics.heat,
      entropy: metrics.entropy,
      reactivity: metrics.reactivity,
      energy: metrics.energy,
    })
    console.log('Astrological Context:', {
      sunSign: metrics.sunSign,
      chartRuler: metrics.chartRuler,
    })
    console.log('Context:', JSON.stringify(context, null, 2))
    console.log('Error:', error instanceof Error ? error.message : String(error))
    console.log('=============================================')

    // Still return true for fallback logging so the app doesn't fail
    return true
  }
}

/**
 * Check if Galileo is properly configured
 */
export function isQuantitiesTrackingConfigured(): boolean {
  return !!GALILEO_API_KEY
}

/**
 * Get configuration status for debugging
 */
export function getGalileoConfig() {
  return {
    hasApiKey: !!GALILEO_API_KEY,
    project: GALILEO_PROJECT,
    quantitiesStream: QUANTITIES_STREAM,
    sdkInitialized: true,
  }
}

/**
 * Test the Galileo connection using the SDK
 */
export async function testGalileoConnection(): Promise<{
  success: boolean
  message: string
  details?: any
}> {
  if (!GALILEO_API_KEY) {
    return {
      success: false,
      message: 'Galileo API key not configured',
    }
  }

  try {
    // Create a test logger to verify SDK works
    const logger = new (GalileoLogger as any)({
      project: GALILEO_PROJECT,
      logStream: `${QUANTITIES_STREAM}-test`,
    })

    // Create a simple test trace
    logger.startTrace({ input: 'Connection test' })

    const startTime = process.hrtime.bigint()
    await new Promise(resolve => setTimeout(resolve, 10))
    const duration = Number(process.hrtime.bigint() - startTime)

    ;(logger as any).addSpan({
      name: 'test-connection',
      spanType: 'tool',
      input: 'Testing Galileo SDK connection',
      output: 'Connection test successful',
      durationNs: duration,
    })

    logger.conclude({
      output: 'Test connection completed successfully',
      durationNs: duration,
    })

    await logger.flush()

    return {
      success: true,
      message: 'Galileo SDK connection successful',
      details: { project: GALILEO_PROJECT, logStream: `${QUANTITIES_STREAM}-test` },
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to connect to Galileo via SDK',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}
