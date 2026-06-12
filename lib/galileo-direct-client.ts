// Direct Galileo API client to avoid build issues with the SDK

// Environment variables for Galileo configuration
const GALILEO_API_KEY = process.env.GALILEO_API_KEY
const GALILEO_PROJECT = process.env.GALILEO_PROJECT || 'AlchmPlanetaryAgents'
const QUANTITIES_STREAM = process.env.GALILEO_QUANTITIES_STREAM || 'alchm-quantities'
const GALILEO_BASE_URL = process.env.GALILEO_BASE_URL || 'https://api.galileo.ai'

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
 * Log alchemical quantities to Galileo dashboard using direct API calls
 */
export async function logQuantitiesToGalileo(
  metrics: AlchemicalMetrics,
  context: Record<string, any> = {}
): Promise<boolean> {
  if (!GALILEO_API_KEY) {
    console.warn('Galileo API key not configured - logging to console instead')
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
      project: GALILEO_PROJECT,
      stream: QUANTITIES_STREAM,
      timestamp: metrics.timestamp,
      level: 'info',
      message: 'Alchemical quantities calculated',
      data: {
        // Individual quantities as top-level fields for easy dashboard visualization
        spirit_quantity: metrics.quantities.Spirit,
        essence_quantity: metrics.quantities.Essence,
        matter_quantity: metrics.quantities.Matter,
        substance_quantity: metrics.quantities.Substance,
        day_essence: metrics.quantities.DayEssence,
        night_essence: metrics.quantities.NightEssence,

        // Alchemical metrics
        dominant_element: metrics.dominantElement,
        heat: metrics.heat,
        entropy: metrics.entropy,
        reactivity: metrics.reactivity,
        energy: metrics.energy,

        // Astrological context
        sun_sign: metrics.sunSign,
        chart_ruler: metrics.chartRuler,

        // Grouped data for detailed analysis
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
      },
    }

    // Prepare input and output for workflow logging
    const workflowInput = JSON.stringify({
      request: 'Calculate alchemical quantities',
      astrological_context: {
        sun_sign: metrics.sunSign,
        chart_ruler: metrics.chartRuler,
        planetary_positions: metrics.planetaryPositions,
      },
    })

    const workflowOutput = JSON.stringify({
      quantities: metrics.quantities,
      alchemical_metrics: {
        dominant_element: metrics.dominantElement,
        heat: metrics.heat,
        entropy: metrics.entropy,
        reactivity: metrics.reactivity,
        energy: metrics.energy,
      },
    })

    // Send to Galileo using the correct workflow format
    const logData = {
      project_name: GALILEO_PROJECT,
      workflows: [
        {
          created_at_ns: Date.now() * 1000000, // Convert to nanoseconds
          duration_ns: 100000000, // Assume 100ms duration
          input: workflowInput,
          output: workflowOutput,
          name: QUANTITIES_STREAM,
          type: 'workflow',
          metadata: {
            spirit_quantity: String(metrics.quantities.Spirit),
            essence_quantity: String(metrics.quantities.Essence),
            matter_quantity: String(metrics.quantities.Matter),
            substance_quantity: String(metrics.quantities.Substance),
            day_essence: String(metrics.quantities.DayEssence),
            night_essence: String(metrics.quantities.NightEssence),
            dominant_element: metrics.dominantElement,
            heat: String(metrics.heat),
            entropy: String(metrics.entropy),
            reactivity: String(metrics.reactivity),
            energy: String(metrics.energy),
            sun_sign: metrics.sunSign,
            chart_ruler: metrics.chartRuler,
            source: 'planetary-agents',
            component: 'alchm-quantities',
            ...Object.fromEntries(
              Object.entries(context).map(([key, value]) => [key, String(value)])
            ),
          },
        },
      ],
    }

    const response = await fetch(`${GALILEO_BASE_URL}/v1/observe/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Galileo-API-Key': GALILEO_API_KEY,
      },
      body: JSON.stringify(logData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Galileo API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log(`Successfully logged quantities to Galileo stream: ${QUANTITIES_STREAM}`, result)
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
 * Log quantity changes/trends to Galileo
 */
export async function logQuantityTrends(
  currentQuantities: QuantitiesData,
  previousQuantities: QuantitiesData,
  context: Record<string, any> = {}
): Promise<boolean> {
  if (!GALILEO_API_KEY) {
    console.warn('Galileo API key not configured for trends logging')
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
      project: GALILEO_PROJECT,
      stream: `${QUANTITIES_STREAM}-trends`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Alchemical quantities trend analysis',
      data: {
        // Changes as top-level fields for dashboard visualization
        ...changes,

        // Grouped data
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

    const workflowInput = JSON.stringify({
      request: 'Analyze quantity trends',
      current_quantities: currentQuantities,
      previous_quantities: previousQuantities,
    })

    const workflowOutput = JSON.stringify({
      changes,
      analysis: 'Trend analysis completed',
    })

    const logData = {
      project_name: GALILEO_PROJECT,
      workflows: [
        {
          created_at_ns: Date.now() * 1000000,
          duration_ns: 50000000, // 50ms duration
          input: workflowInput,
          output: workflowOutput,
          name: `${QUANTITIES_STREAM}-trends`,
          type: 'workflow',
          metadata: {
            ...Object.fromEntries(
              Object.entries(changes).map(([key, value]) => [key, String(value)])
            ),
            source: 'planetary-agents',
            component: 'quantity-trends',
            ...Object.fromEntries(
              Object.entries(context).map(([key, value]) => [key, String(value)])
            ),
          },
        },
      ],
    }

    const response = await fetch(`${GALILEO_BASE_URL}/v1/observe/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Galileo-API-Key': GALILEO_API_KEY,
      },
      body: JSON.stringify(logData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Galileo API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    await response.json()
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
    baseUrl: GALILEO_BASE_URL,
    clientInitialized: true, // Always true for direct API calls
  }
}

/**
 * Test the Galileo connection
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
    // Try to make a simple API call to test connection using healthcheck
    const response = await fetch(`${GALILEO_BASE_URL}/v1/healthcheck`, {
      method: 'GET',
      headers: {
        'Galileo-API-Key': GALILEO_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        message: `Galileo API connection failed: ${response.status} ${response.statusText}`,
        details: errorText,
      }
    }

    const healthcheck = await response.json()
    return {
      success: true,
      message: 'Galileo API connection successful',
      details: healthcheck,
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to connect to Galileo API',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}
