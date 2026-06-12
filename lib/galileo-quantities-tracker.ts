// Dynamic import of Galileo to avoid build issues
let galileoModule: any = null

// Environment variables for Galileo configuration
const GALILEO_API_KEY = process.env.GALILEO_API_KEY
const GALILEO_PROJECT = process.env.GALILEO_PROJECT || 'AlchmPlanetaryAgents'
const QUANTITIES_STREAM = process.env.GALILEO_QUANTITIES_STREAM || 'alchm-quantities'

// Initialize Galileo client dynamically when needed
let galileoClient: any = null

async function initializeGalileoClient() {
  if (galileoClient || !GALILEO_API_KEY) {
    return galileoClient
  }

  try {
    if (!galileoModule) {
      // Dynamic import to avoid build issues
      galileoModule = await import('galileo')
    }

    galileoClient = galileoModule.galileo({
      apiKey: GALILEO_API_KEY,
      project: GALILEO_PROJECT,
    })

    return galileoClient
  } catch (error) {
    console.error('Failed to initialize Galileo client:', error)
    return null
  }
}

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
 * Log alchemical quantities to Galileo dashboard
 */
export async function logQuantitiesToGalileo(
  metrics: AlchemicalMetrics,
  context: Record<string, any> = {}
): Promise<boolean> {
  const client = await initializeGalileoClient()

  if (!client) {
    console.warn('Galileo client not initialized - logging to console instead')
    console.log('====== ALCHM QUANTITIES LOG ======')
    console.log('Stream:', QUANTITIES_STREAM)
    console.log('Metrics:', JSON.stringify(metrics, null, 2))
    console.log('Context:', JSON.stringify(context, null, 2))
    console.log('===================================')
    return false
  }

  try {
    // Structure the log entry for Galileo
    const logEntry = {
      stream: QUANTITIES_STREAM,
      timestamp: metrics.timestamp,
      level: 'info',
      message: 'Alchemical quantities calculated',
      data: {
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
          planetary_positions: metrics.planetaryPositions,
        },
        application_context: {
          source: 'planetary-agents',
          component: 'alchm-quantities',
          ...context,
        },
        // Add individual quantities as top-level metrics for easy dashboard visualization
        spirit_quantity: metrics.quantities.Spirit,
        essence_quantity: metrics.quantities.Essence,
        matter_quantity: metrics.quantities.Matter,
        substance_quantity: metrics.quantities.Substance,
        day_essence: metrics.quantities.DayEssence,
        night_essence: metrics.quantities.NightEssence,
      },
    }

    // Send to Galileo
    await client.log(logEntry)

    console.log(`Successfully logged quantities to Galileo stream: ${QUANTITIES_STREAM}`)
    return true
  } catch (error) {
    console.error('Error logging quantities to Galileo:', error)

    // Fallback: log to console
    console.log('====== ALCHM QUANTITIES LOG (FALLBACK) ======')
    console.log('Stream:', QUANTITIES_STREAM)
    console.log('Metrics:', JSON.stringify(metrics, null, 2))
    console.log('Context:', JSON.stringify(context, null, 2))
    console.log('Error:', error instanceof Error ? error.message : String(error))
    console.log('=============================================')

    return false
  }
}

/**
 * Log quantity changes/trends to Galileo
 */
export async function logQuantityTrends(
  currentQuantities: QuantitiesData,
  previousQuantities: QuantitiesData,
  context: Record<string, any> = {}
): Promise<boolean> {
  const client = await initializeGalileoClient()

  if (!client) {
    console.warn('Galileo client not initialized for trends logging')
    return false
  }

  try {
    // Calculate changes
    const changes = {
      spirit_change: currentQuantities.Spirit - previousQuantities.Spirit,
      essence_change: currentQuantities.Essence - previousQuantities.Essence,
      matter_change: currentQuantities.Matter - previousQuantities.Matter,
      substance_change: currentQuantities.Substance - previousQuantities.Substance,
      day_essence_change: currentQuantities.DayEssence - previousQuantities.DayEssence,
      night_essence_change: currentQuantities.NightEssence - previousQuantities.NightEssence,
    }

    const logEntry = {
      stream: `${QUANTITIES_STREAM}-trends`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Alchemical quantities trend analysis',
      data: {
        current_quantities: currentQuantities,
        previous_quantities: previousQuantities,
        changes,
        application_context: {
          source: 'planetary-agents',
          component: 'quantity-trends',
          ...context,
        },
      },
    }

    await client.log(logEntry)
    return true
  } catch (error) {
    console.error('Error logging quantity trends to Galileo:', error)
    return false
  }
}

/**
 * Check if Galileo is properly configured for quantities tracking
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
    clientInitialized: !!galileoClient,
  }
}
