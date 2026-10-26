import { type NextRequest, NextResponse } from 'next/server'
import { feedStreamBus } from '@/lib/agents/feed-stream-bus'
import {
  AGENT_ID,
  AgentLookupUnavailable,
  creatorWalletPolicy,
  describeError,
  ledgerIdOf,
  ratedPayload,
  readPushed,
  resolveVessel,
} from '@/lib/agents/rating/rating-resolver.server'
import { asContractPayload } from '@/lib/agents/rating/vessel-payload'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache, no-transform',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const raw = typeof slug === 'string' ? slug.trim() : ''
    if (!raw || !AGENT_ID.test(raw)) {
      return NextResponse.json(
        { error: 'Invalid or missing agent slug' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const agentId = raw.toLowerCase()
    let lookup = await resolveVessel(agentId)
    if (!lookup.found && raw !== agentId) {
      lookup = await resolveVessel(raw)
    }

    if (!lookup.found) {
      return lookup.reason === 'unknown'
        ? NextResponse.json({ error: 'Agent not found' }, { status: 404, headers: CORS_HEADERS })
        : NextResponse.json(
            { error: 'Agent has no stats or natal chart to rate' },
            { status: 422, headers: CORS_HEADERS }
          )
    }

    const { vessel } = lookup
    const creatorWallet =
      vessel.origin === 'forged' ? await creatorWalletPolicy(request) : ('deny' as const)
    const live =
      vessel.origin === 'roster' || creatorWallet === 'allow'
        ? readPushed(ledgerIdOf(vessel))
        : null

    const payload = await ratedPayload(vessel, live, creatorWallet)

    // The two-level progression (vesselLevel, totalXp, currentOverall, ...) is part of the payload
    // `ratedPayload` builds, so this route and GET /api/agents/rating serve the same fields.

    const contract = asContractPayload(payload)

    if (contract) {
      feedStreamBus.recordAgentRating(contract)
      if (contract.surge.active) {
        feedStreamBus.recordResonanceSurge({
          agentId: contract.key,
          surge: contract.surge,
          esms: contract.esms,
          appearance: contract.appearance,
        })
      }
    }

    return NextResponse.json(contract ?? payload, { headers: CORS_HEADERS })
  } catch (error) {
    if (error instanceof AgentLookupUnavailable) {
      console.error('[slug-ratings] agent lookup unavailable:', error.message)
      return NextResponse.json(
        { error: 'Agent lookup is temporarily unavailable' },
        { status: 503, headers: CORS_HEADERS }
      )
    }
    console.error('[slug-ratings] GET failed:', describeError(error))
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
