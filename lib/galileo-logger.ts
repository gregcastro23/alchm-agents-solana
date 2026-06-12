// Comprehensive Galileo Logger implementation
// Follows proper spans, traces, and sessions structure

import { ANumberCalculator } from './core-energy-rules'

// Environment variables for Galileo configuration
const GALILEO_API_KEY = process.env.GALILEO_API_KEY
const GALILEO_PROJECT = process.env.GALILEO_PROJECT || 'AlchmPlanetaryAgents'
const QUANTITIES_STREAM = process.env.GALILEO_QUANTITIES_STREAM || 'alchm-quantities'
const GALILEO_BASE_URL = process.env.GALILEO_BASE_URL || 'https://api.galileo.ai'
const GALILEO_FAIL_SILENTLY = (process.env.GALILEO_FAIL_SILENTLY ?? 'true') !== 'false'
const GALILEO_VERBOSE_FALLBACK = (process.env.GALILEO_VERBOSE_FALLBACK ?? 'true') !== 'false'

export interface QuantitiesData {
  Spirit: number
  Essence: number
  Matter: number
  Substance: number
  ANumber: number
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

export interface GalileoSpan {
  id: string
  trace_id: string
  parent_id?: string
  name: string
  type: 'llm' | 'retriever' | 'tool' | 'workflow' | 'agent' | 'chain'
  input: string
  output: string
  start_time_ns: number
  end_time_ns: number
  duration_ns: number
  metadata: Record<string, string>
  status: 'success' | 'error' | 'pending'
}

export interface GalileoTrace {
  id: string
  session_id?: string
  name: string
  spans: GalileoSpan[]
  start_time_ns: number
  end_time_ns: number
  duration_ns: number
  metadata: Record<string, string>
}

export interface GalileoSession {
  id: string
  name: string
  traces: GalileoTrace[]
  start_time_ns: number
  end_time_ns: number
  metadata: Record<string, string>
}

class GalileoLogger {
  private currentSession: GalileoSession | null = null
  private currentTrace: GalileoTrace | null = null
  private spans: Map<string, GalileoSpan> = new Map()

  /**
   * Start a new session for grouping related traces
   */
  startSession(sessionName: string, metadata: Record<string, any> = {}): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.currentSession = {
      id: sessionId,
      name: sessionName,
      traces: [],
      start_time_ns: Date.now() * 1000000,
      end_time_ns: 0,
      metadata: Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, String(value)])
      ),
    }

    console.log(`Started Galileo session: ${sessionName} (${sessionId})`)
    return sessionId
  }

  /**
   * Start a new trace within the current session
   */
  startTrace(traceName: string, metadata: Record<string, any> = {}): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.currentTrace = {
      id: traceId,
      session_id: this.currentSession?.id,
      name: traceName,
      spans: [],
      start_time_ns: Date.now() * 1000000,
      end_time_ns: 0,
      duration_ns: 0,
      metadata: Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, String(value)])
      ),
    }

    console.log(`Started Galileo trace: ${traceName} (${traceId})`)
    return traceId
  }

  /**
   * Start a new span within the current trace
   */
  startSpan(
    spanName: string,
    type: GalileoSpan['type'],
    input: any = {},
    parentId?: string,
    metadata: Record<string, any> = {}
  ): string {
    const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const span: GalileoSpan = {
      id: spanId,
      trace_id: this.currentTrace?.id || 'no_trace',
      parent_id: parentId,
      name: spanName,
      type,
      input: typeof input === 'string' ? input : JSON.stringify(input),
      output: '', // Will be set when span ends
      start_time_ns: Date.now() * 1000000,
      end_time_ns: 0,
      duration_ns: 0,
      metadata: Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, String(value)])
      ),
      status: 'pending',
    }

    this.spans.set(spanId, span)
    console.log(`Started span: ${spanName} (${spanId}) of type ${type}`)
    return spanId
  }

  /**
   * End a span with output and status
   */
  endSpan(spanId: string, output: any = {}, status: 'success' | 'error' = 'success'): void {
    const span = this.spans.get(spanId)
    if (!span) {
      console.warn(`Span ${spanId} not found`)
      return
    }

    const endTime = Date.now() * 1000000
    span.end_time_ns = endTime
    span.duration_ns = endTime - span.start_time_ns
    span.output = typeof output === 'string' ? output : JSON.stringify(output)
    span.status = status

    // Add span to current trace
    if (this.currentTrace) {
      this.currentTrace.spans.push({ ...span })
    }

    console.log(`Ended span: ${span.name} (${spanId}) - ${status}`)
  }

  /**
   * End the current trace
   */
  endTrace(): void {
    if (!this.currentTrace) {
      console.warn('No active trace to end')
      return
    }

    const endTime = Date.now() * 1000000
    this.currentTrace.end_time_ns = endTime
    this.currentTrace.duration_ns = endTime - this.currentTrace.start_time_ns

    // Add trace to current session
    if (this.currentSession) {
      this.currentSession.traces.push({ ...this.currentTrace })
    }

    console.log(`Ended trace: ${this.currentTrace.name} (${this.currentTrace.id})`)
    this.currentTrace = null
  }

  /**
   * End the current session and send all data to Galileo
   */
  async endSession(): Promise<boolean> {
    if (!this.currentSession) {
      console.warn('No active session to end')
      return false
    }

    const endTime = Date.now() * 1000000
    this.currentSession.end_time_ns = endTime

    // Send session data to Galileo
    const success = await this.sendToGalileo(this.currentSession)

    console.log(`Ended session: ${this.currentSession.name} (${this.currentSession.id})`)
    this.currentSession = null
    this.spans.clear()

    return success
  }

  /**
   * Send session data to Galileo using proper workflow format
   */
  private async sendToGalileo(session: GalileoSession): Promise<boolean> {
    if (!GALILEO_API_KEY) {
      console.warn('Galileo API key not configured - logging session to console instead')
      console.log('====== GALILEO SESSION LOG ======')
      console.log('Session:', JSON.stringify(session, null, 2))
      console.log('===================================')
      return false
    }

    try {
      // Convert session to workflows format expected by Galileo
      const workflows = session.traces.map(trace => ({
        created_at_ns: trace.start_time_ns,
        duration_ns: trace.duration_ns,
        input: JSON.stringify({
          session_id: session.id,
          session_name: session.name,
          trace_name: trace.name,
          spans_count: trace.spans.length,
        }),
        output: JSON.stringify({
          spans: trace.spans.map(span => ({
            name: span.name,
            type: span.type,
            status: span.status,
            duration_ms: Math.round(span.duration_ns / 1000000),
            metadata: span.metadata,
          })),
          trace_metadata: trace.metadata,
          session_metadata: session.metadata,
        }),
        name: `${trace.name}`,
        type: 'workflow' as const,
        metadata: {
          ...trace.metadata,
          session_id: session.id,
          session_name: session.name,
          trace_id: trace.id,
          spans_count: String(trace.spans.length),
          duration_ms: String(Math.round(trace.duration_ns / 1000000)),
          // Include span details in metadata for dashboard visibility
          ...this.extractSpanMetadata(trace.spans),
        },
      }))

      const logData = {
        project_name: GALILEO_PROJECT,
        workflows,
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
        // Provide a helpful hint for project type mismatches (422)
        if (response.status === 422 && errorText.includes('not of type Observe')) {
          const hint =
            'Hint: Configure GALILEO_PROJECT as an Observe project or set GALILEO_FAIL_SILENTLY=true'
          const message = `Galileo API error: ${response.status} ${response.statusText} - ${errorText}\n${hint}`
          if (GALILEO_VERBOSE_FALLBACK) console.warn(message)
          // fall through to fallback logging below
          if (!GALILEO_FAIL_SILENTLY) {
            throw new Error(message)
          }
          // Return early for silent failure
          return false
        }
        const message = `Galileo API error: ${response.status} ${response.statusText} - ${errorText}`
        if (GALILEO_VERBOSE_FALLBACK) console.warn(message)
        if (!GALILEO_FAIL_SILENTLY) {
          throw new Error(message)
        }
        // Return early for silent failure
        return false
      }

      const result = await response.json()
      console.log(`Successfully logged session to Galileo: ${session.name}`, result)
      return true
    } catch (error) {
      if (GALILEO_VERBOSE_FALLBACK) console.error('Error logging session to Galileo:', error)

      // Fallback: log to console with structured format (non-fatal)
      console.log('====== GALILEO SESSION LOG (FALLBACK) ======')
      console.log('Project:', GALILEO_PROJECT)
      console.log('Stream:', QUANTITIES_STREAM)
      console.log('Session:', session.name)
      console.log('Traces:', session.traces.length)
      console.log(
        'Total Spans:',
        session.traces.reduce((acc, trace) => acc + trace.spans.length, 0)
      )
      console.log('Session Data:', JSON.stringify(session, null, 2))
      console.log('Error:', error instanceof Error ? error.message : String(error))
      console.log('=============================================')

      // Never throw; optionally signal success to avoid UX degradation
      return GALILEO_FAIL_SILENTLY ? true : false
    }
  }

  /**
   * Extract key metadata from spans for dashboard visibility
   */
  private extractSpanMetadata(spans: GalileoSpan[]): Record<string, string> {
    const metadata: Record<string, string> = {}

    spans.forEach((span, index) => {
      metadata[`span_${index}_name`] = span.name
      metadata[`span_${index}_type`] = span.type
      metadata[`span_${index}_status`] = span.status
      metadata[`span_${index}_duration_ms`] = String(Math.round(span.duration_ns / 1000000))

      // Include key metadata from each span
      Object.entries(span.metadata).forEach(([key, value]) => {
        if (
          key.includes('quantity') ||
          key.includes('element') ||
          key.includes('sign') ||
          key.includes('a_number')
        ) {
          metadata[`span_${index}_${key}`] = value
        }
      })
    })

    return metadata
  }
}

// Create singleton instance
const galileoLogger = new GalileoLogger()
export default galileoLogger

/**
 * High-level function to log alchemical quantities using proper Galileo structure
 */
export async function logQuantitiesToGalileo(
  metrics: AlchemicalMetrics,
  context: Record<string, any> = {}
): Promise<boolean> {
  if (!GALILEO_API_KEY) return false

  try {
    // Start a session for this calculation
    const sessionId = galileoLogger.startSession('alchemical-quantities-calculation', {
      timestamp: metrics.timestamp,
      sun_sign: metrics.sunSign,
      chart_ruler: metrics.chartRuler,
      ...context,
    })

    // Start a trace for the complete calculation workflow
    const traceId = galileoLogger.startTrace('calculate-alchemical-quantities', {
      dominant_element: metrics.dominantElement,
      api_endpoint: context.api_endpoint || 'unknown',
    })

    // Span 1: Retrieve planetary positions (retriever type)
    const retrieverSpanId = galileoLogger.startSpan(
      'get-planetary-positions',
      'retriever',
      {
        request: 'Get current planetary positions for calculations',
        timestamp: metrics.timestamp,
      },
      undefined,
      {
        sun_sign: metrics.sunSign,
        chart_ruler: metrics.chartRuler,
      }
    )

    galileoLogger.endSpan(
      retrieverSpanId,
      {
        planetary_positions: metrics.planetaryPositions,
        sun_sign: metrics.sunSign,
        chart_ruler: metrics.chartRuler,
      },
      'success'
    )

    // Span 2: Calculate base quantities (tool type)
    const calculationSpanId = galileoLogger.startSpan(
      'calculate-base-quantities',
      'tool',
      {
        planetary_data: metrics.planetaryPositions,
        calculation_method: 'alchemical-transformation',
      },
      retrieverSpanId,
      {
        spirit_quantity: String(metrics.quantities.Spirit),
        essence_quantity: String(metrics.quantities.Essence),
        matter_quantity: String(metrics.quantities.Matter),
        substance_quantity: String(metrics.quantities.Substance),
        a_number: String(metrics.quantities.ANumber),
        a_number_category: ANumberCalculator.categorizeANumber(metrics.quantities.ANumber),
      }
    )

    galileoLogger.endSpan(
      calculationSpanId,
      {
        quantities: metrics.quantities,
        dominant_element: metrics.dominantElement,
      },
      'success'
    )

    // Span 3: Calculate alchemical metrics (tool type)
    const metricsSpanId = galileoLogger.startSpan(
      'calculate-alchemical-metrics',
      'tool',
      {
        base_quantities: metrics.quantities,
        dominant_element: metrics.dominantElement,
      },
      calculationSpanId,
      {
        heat: String(metrics.heat),
        entropy: String(metrics.entropy),
        reactivity: String(metrics.reactivity),
        energy: String(metrics.energy),
      }
    )

    galileoLogger.endSpan(
      metricsSpanId,
      {
        heat: metrics.heat,
        entropy: metrics.entropy,
        reactivity: metrics.reactivity,
        energy: metrics.energy,
      },
      'success'
    )

    // End trace and session
    galileoLogger.endTrace()
    const success = await galileoLogger.endSession()

    return success
  } catch (error) {
    console.error('Error in logQuantitiesToGalileo:', error)
    return false
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
    baseUrl: GALILEO_BASE_URL,
    loggerInitialized: true,
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
