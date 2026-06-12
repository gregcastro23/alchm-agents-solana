import { NextResponse } from 'next/server'
import { isGatewayEnabled, GATEWAY_BASE_URL } from '@/lib/models/gateway'
import { getAIGatewayStatus, validateAIGatewayConfig } from '@/lib/utils/ai-gateway'

/**
 * GET /api/ai-gateway/health
 *
 * Reports the live status of the Vercel AI Gateway integration.
 * Use this to verify configuration before deploying or debugging inference issues.
 */
export async function GET() {
  try {
    const status = getAIGatewayStatus()
    const validation = validateAIGatewayConfig()

    const providerStatus: Record<string, boolean> = {
      anthropic: !!process.env.ANTHROPIC_API_KEY || isGatewayEnabled,
      openai: !!process.env.OPENAI_API_KEY || isGatewayEnabled,
      google:
        !!process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        !!process.env.GEMINI_API_KEY ||
        isGatewayEnabled,
      groq: !!process.env.GROQ_API_KEY || isGatewayEnabled,
      openrouter: !!process.env.OPENROUTER_API_KEY || isGatewayEnabled,
    }

    const payload = {
      timestamp: new Date().toISOString(),
      gateway: {
        enabled: isGatewayEnabled,
        authMode: status.authMode,
        baseUrl: GATEWAY_BASE_URL,
        ready: status.ready,
      },
      providers: providerStatus,
      activeProviders: status.activeProviders,
      validation: {
        valid: validation.valid,
        errors: validation.errors,
      },
      recommendation: status.recommendation,
      docs: 'https://vercel.com/docs/ai-gateway',
    }

    return NextResponse.json(payload, {
      status: isGatewayEnabled ? 200 : 200, // always 200 — disabled is a config state, not an error
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[AI Gateway Health] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve AI Gateway status',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
