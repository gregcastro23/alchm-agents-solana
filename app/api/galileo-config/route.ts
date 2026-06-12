import { NextResponse } from 'next/server'
import {
  getGalileoConfig,
  isQuantitiesTrackingConfigured,
  logQuantitiesToGalileo,
} from '@/lib/galileo-logger'
import {
  getAgentLoggingConfig,
  isAgentLoggingConfigured,
  testAgentLogging,
  logAgentConversation,
  createConversationContext,
  getRecentFailedLogs,
  clearFailedLogs,
  getFailureStats,
  type AgentInteractionData,
} from '@/lib/galileo-agent-logger'

// Test function for tarot agent logging
async function testTarotAgentLogging(): Promise<{
  success: boolean
  message: string
  details?: any
}> {
  try {
    const testContext = createConversationContext('The Fool', 'Major Arcana', '0')

    const testInteraction: AgentInteractionData = {
      sessionId: testContext.sessionId,
      userMessage: 'Test tarot reading request',
      agentResponse:
        'Test response from The Fool tarot agent representing new beginnings and spiritual journey',
      planet: 'The Fool',
      sign: 'Major Arcana',
      degree: '0',
      dignity: 'neutral',
      elementalInfo: {
        signElement: 'Air',
        planetElement: 'Air',
        elementalAffinity: 1.0,
        isDiurnal: true,
      },
      aNumberInfo: {
        aNumber: 1.0,
        category: 'Tarot Reading',
        components: {
          spirit: 0.3,
          essence: 0.0,
          matter: 0.0,
          substance: 0.7,
        },
      },
      processingTimeMs: 180,
      agentType: 'tarot',
    }

    testContext.conversationCount = 1

    const success = await logAgentConversation(testInteraction, testContext)

    return {
      success,
      message: success
        ? 'Tarot agent logging test completed successfully'
        : 'Tarot agent logging test completed with fallback',
      details: {
        sessionId: testContext.sessionId,
        cardName: 'The Fool',
        agentType: 'tarot',
      },
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to test tarot agent logging',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    // Handle recent failures action
    if (action === 'recentFailures') {
      const failures = getRecentFailedLogs()
      const stats = getFailureStats()

      return NextResponse.json({
        failures,
        stats,
        message: `Found ${failures.length} recent failed logging attempts`,
      })
    }

    // Handle clear failures action
    if (action === 'clearFailures') {
      clearFailedLogs()
      return NextResponse.json({
        success: true,
        message: 'Failed logs buffer cleared successfully',
      })
    }

    // Default: return configuration info
    const quantitiesConfig = getGalileoConfig()
    const agentConfig = getAgentLoggingConfig()
    const failureStats = getFailureStats()

    return NextResponse.json({
      configured: isQuantitiesTrackingConfigured() && isAgentLoggingConfigured(),
      quantitiesConfig,
      agentConfig,
      failureStats,
      recommendations: {
        nextSteps:
          isQuantitiesTrackingConfigured() && isAgentLoggingConfigured()
            ? [
                'Galileo is configured! Quantities and agent conversations are being tracked in your dashboard.',
                'Visit your chart-of-the-moment page and chat with planetary agents to see logging in action.',
                'Use the new tarot agent chat feature to test tarot card readings with logging.',
              ]
            : [
                'Set GALILEO_API_KEY in your environment variables',
                'Optionally set GALILEO_PROJECT (default: AlchmPlanetaryAgents)',
                'Optionally set GALILEO_LOG_STREAM (default: test) for agent conversations',
                'Restart your application after setting environment variables',
              ],
      },
    })
  } catch (error) {
    console.error('Error checking Galileo config:', error)
    return NextResponse.json(
      {
        error: 'Failed to check Galileo configuration',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const { testData, testType = 'quantities' } = await req.json()

    if (!isQuantitiesTrackingConfigured() || !isAgentLoggingConfigured()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Galileo is not properly configured. Please check your environment variables.',
        },
        { status: 400 }
      )
    }

    if (testType === 'agent') {
      // Test agent conversation logging
      const agentTestResult = await testAgentLogging()

      return NextResponse.json({
        success: agentTestResult.success,
        message: agentTestResult.message,
        details: agentTestResult.details,
        testType: 'agent',
      })
    }

    if (testType === 'tarot') {
      // Test tarot agent conversation logging
      const tarotTestResult = await testTarotAgentLogging()

      return NextResponse.json({
        success: tarotTestResult.success,
        message: tarotTestResult.message,
        details: tarotTestResult.details,
        testType: 'tarot',
      })
    }

    // Test quantities logging (default)
    const testMetrics = testData || {
      quantities: {
        Spirit: 42.5,
        Essence: 33.7,
        Matter: 18.9,
        Substance: 27.3,
        DayEssence: 15.2,
        NightEssence: 18.5,
      },
      dominantElement: 'Fire',
      heat: 0.85,
      entropy: 0.62,
      reactivity: 0.73,
      energy: 0.91,
      sunSign: 'Leo',
      chartRuler: 'Sun',
      timestamp: new Date().toISOString(),
      planetaryPositions: {
        Sun: { sign: 'Leo', degree: '15.42' },
        Moon: { sign: 'Cancer', degree: '8.93' },
      },
    }

    const success = await logQuantitiesToGalileo(testMetrics, {
      test_mode: true,
      api_endpoint: '/api/galileo-config',
      description: 'Test log entry for Galileo configuration validation',
    })

    return NextResponse.json({
      success,
      message: success
        ? 'Test data successfully logged to Galileo! Check your dashboard.'
        : 'Failed to log test data. Check console logs for details.',
      testData: testMetrics,
      testType: 'quantities',
    })
  } catch (error) {
    console.error('Error testing Galileo logging:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test Galileo logging',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
