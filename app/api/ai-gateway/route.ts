import { NextResponse } from 'next/server'
import { isGatewayEnabled, GATEWAY_BASE_URL } from '@/lib/models/gateway'
import { MODEL_TIERS, CLAUDE, OPENAI, GEMINI, GROQ } from '@/lib/models/registry'

/**
 * GET /api/ai-gateway
 *
 * Returns the active model routing table for this deployment.
 * Useful for dashboards, debugging, and confirming which models are live.
 */
export async function GET() {
  const routingTable = {
    powerful: {
      anthropic: isGatewayEnabled
        ? `anthropic/${MODEL_TIERS.POWERFUL.claude}`
        : MODEL_TIERS.POWERFUL.claude,
      openai: isGatewayEnabled
        ? `openai/${MODEL_TIERS.POWERFUL.openai}`
        : MODEL_TIERS.POWERFUL.openai,
      google: isGatewayEnabled
        ? `google/${MODEL_TIERS.POWERFUL.google}`
        : MODEL_TIERS.POWERFUL.google,
      groq: isGatewayEnabled ? `groq/${MODEL_TIERS.POWERFUL.groq}` : MODEL_TIERS.POWERFUL.groq,
    },
    default: {
      anthropic: isGatewayEnabled
        ? `anthropic/${MODEL_TIERS.DEFAULT.claude}`
        : MODEL_TIERS.DEFAULT.claude,
      openai: isGatewayEnabled
        ? `openai/${MODEL_TIERS.DEFAULT.openai}`
        : MODEL_TIERS.DEFAULT.openai,
      google: isGatewayEnabled
        ? `google/${MODEL_TIERS.DEFAULT.google}`
        : MODEL_TIERS.DEFAULT.google,
      groq: isGatewayEnabled ? `groq/${MODEL_TIERS.DEFAULT.groq}` : MODEL_TIERS.DEFAULT.groq,
    },
    fast: {
      anthropic: isGatewayEnabled
        ? `anthropic/${MODEL_TIERS.FAST.claude}`
        : MODEL_TIERS.FAST.claude,
      openai: isGatewayEnabled ? `openai/${MODEL_TIERS.FAST.openai}` : MODEL_TIERS.FAST.openai,
      google: isGatewayEnabled ? `google/${MODEL_TIERS.FAST.google}` : MODEL_TIERS.FAST.google,
      groq: isGatewayEnabled ? `groq/${MODEL_TIERS.FAST.groq}` : MODEL_TIERS.FAST.groq,
    },
  }

  const activeProvider = process.env.DEFAULT_AI_PROVIDER || 'google'

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      gateway: {
        enabled: isGatewayEnabled,
        baseUrl: isGatewayEnabled ? GATEWAY_BASE_URL : 'direct (no gateway)',
      },
      activeProvider,
      routingTable,
      models: {
        claude: CLAUDE,
        openai: OPENAI,
        gemini: GEMINI,
        groq: GROQ,
      },
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
