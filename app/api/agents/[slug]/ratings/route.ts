import { type NextRequest, NextResponse } from 'next/server'
import { feedStreamBus } from '@/lib/agents/feed-stream-bus'
import {
  AGENT_ID,
  AgentLookupUnavailable,
  describeError,
  readRatedVessel,
  resolveVessel,
  streamableRating,
  withinCallerBudget,
  withinSharedBudget,
} from '@/lib/agents/rating/rating-resolver.server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache, no-transform',
}

const RATE_LIMITED = { ...CORS_HEADERS, 'Retry-After': '60' }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    // The same budgets as GET /api/agents/rating (one bucket per caller, one shared): this route
    // is anonymous, CORS `*`, and writes the live stream, so it may not be the unmetered door.
    // The caller pays first; the shared bucket only for a request that will do real work.
    if (!withinCallerBudget(request)) {
      return NextResponse.json(
        { error: 'Too Many Requests' },
        { status: 429, headers: RATE_LIMITED }
      )
    }

    const { slug } = await params
    const raw = typeof slug === 'string' ? slug.trim() : ''
    if (!raw || !AGENT_ID.test(raw)) {
      return NextResponse.json(
        { error: 'Invalid or missing agent slug' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!withinSharedBudget()) {
      return NextResponse.json(
        { error: 'Too Many Requests' },
        { status: 429, headers: RATE_LIMITED }
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
    const { payload, creatorWallet } = await readRatedVessel(request, vessel)

    // The two-level progression (vesselLevel, totalXp, currentOverall, ...) is part of the payload
    // `ratedPayload` builds, so this route and GET /api/agents/rating serve the same fields.

    // `streamableRating` decides what the anonymous feed stream may carry (a roster vessel with a
    // real sky and no degraded read, never a forged vessel or an entitled caller's payload).
    const streamable = streamableRating(vessel, creatorWallet, payload)
    if (streamable) {
      feedStreamBus.recordAgentRating(streamable)
      if (streamable.surge.active) {
        feedStreamBus.recordResonanceSurge({
          agentId: streamable.key,
          surge: streamable.surge,
          esms: streamable.esms,
          appearance: streamable.appearance,
        })
      }
    }

    // A forged vessel's answer depends on who asks (the creator and the secret holder get the
    // wallet), and vercel.json gives every /api/* response `s-maxage=60`: it must not be shared.
    const headers =
      vessel.origin === 'forged'
        ? {
            ...CORS_HEADERS,
            'Cache-Control': 'private, no-store',
            'CDN-Cache-Control': 'no-store',
            Vary: 'Authorization, Cookie, X-Internal-Secret',
          }
        : CORS_HEADERS

    return NextResponse.json(payload, { headers })
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
