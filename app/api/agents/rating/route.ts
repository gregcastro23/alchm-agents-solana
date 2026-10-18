import { NextRequest, NextResponse } from 'next/server'
import { HISTORICAL_AGENTS, getHistoricalAgent } from '@/lib/agents/historical'
import { resolveAgentEsmsBalances } from '@/lib/agents/rating/esms-balance-resolver'
import { SkyUnavailableError, resolveLiveSky } from '@/lib/agents/rating/live-sky'
import { ESMS_TOKENS, type EsmsHoldings } from '@/lib/agents/rating/seals-surge'
import {
  VESSEL_ALIASES,
  buildRatedAgentPayload,
  ratableFromForgedRow,
  ratableFromRoster,
  summarizeVessel,
  type RatableVessel,
} from '@/lib/agents/rating/vessel-payload'
import { getClientIp, rateLimit } from '@/lib/security/rate-limit'
import { bearerMatches } from '@/lib/security/secure-compare'

/**
 * Cross-repo rating API: `pentacles` (live-wallet-sync) and the Next.js UI read a rated
 * vessel here, and feeder workers push live ESMS holdings.
 *
 *   GET  /api/agents/rating?agentId=<id>   one rated vessel (Pentacle Vessel Rating Scale)
 *   GET  /api/agents/rating?roster=true    a light summary of every historical agent
 *   POST /api/agents/rating                internal: push an agent's ESMS holdings, get the
 *                                          recalculated payload back
 *
 * ASOL is the single source of truth for the Sacred 7 maths, the Alchemical Seals, the
 * Resonance Surge and the vessel's look; this route only assembles them
 * (`lib/agents/rating/vessel-payload.ts`).
 *
 * POST never writes the ledger. ESMS balances are ledger-backed (the authoritative off-chain
 * ledger is `token_balances`) and deliberately not editable from a request. A pushed holding
 * is live SpacetimeDB table state: it is validated, used for the recalculation, and kept for
 * a short TTL so a following GET sees it, with `esmsSource: "spacetimedb"`. The cache is per
 * serverless instance, so it is best-effort by design.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const READ_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: READ_CORS })
}

const AGENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const MAX_POST_BYTES = 4 * 1024
const MINUTE_MS = 60_000

/** Pushed holdings stay authoritative this long (a feeder pushes on change; a GET is a read). */
const PUSH_TTL_MS = 60_000
const MAX_PUSHED = 5_000
const pushed = new Map<string, { balances: EsmsHoldings; at: number }>()

function envLimit(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readPushed(agentId: string, now = Date.now()): EsmsHoldings | null {
  const entry = pushed.get(agentId)
  if (!entry) return null
  if (now - entry.at > PUSH_TTL_MS) {
    pushed.delete(agentId)
    return null
  }
  return entry.balances
}

function rememberPushed(agentId: string, balances: EsmsHoldings, now = Date.now()): void {
  if (pushed.size >= MAX_PUSHED) {
    for (const [key, value] of pushed) if (now - value.at > PUSH_TTL_MS) pushed.delete(key)
    if (pushed.size >= MAX_PUSHED) pushed.clear()
  }
  pushed.set(agentId, { balances, at: now })
}

function json(
  body: unknown,
  status: number,
  extra: Record<string, string> = {},
  readable = true
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE, ...(readable ? READ_CORS : {}), ...extra },
  })
}

class AgentLookupUnavailable extends Error {}

type Lookup =
  | { found: true; vessel: RatableVessel }
  | { found: false; reason: 'unknown' | 'unratable' }

/** Roster first (with the avatar alias), then a user-forged `historical_agents` row. */
async function resolveVessel(agentId: string): Promise<Lookup> {
  const canonical = VESSEL_ALIASES[agentId] ?? agentId
  const rostered = getHistoricalAgent(canonical)
  if (rostered) {
    const requested = VESSEL_ALIASES[agentId] ? agentId : rostered.id
    return { found: true, vessel: ratableFromRoster(rostered, requested) }
  }
  try {
    const { prisma } = await import('@/lib/db')
    const row = await prisma.historical_agents.findUnique({ where: { agentId } })
    if (!row) return { found: false, reason: 'unknown' }
    const vessel = ratableFromForgedRow(row)
    return vessel ? { found: true, vessel } : { found: false, reason: 'unratable' }
  } catch (error) {
    throw new AgentLookupUnavailable(error instanceof Error ? error.message : String(error))
  }
}

function notRated(agentId: string, reason: 'unknown' | 'unratable', readable: boolean) {
  return reason === 'unknown'
    ? json({ success: false, error: `No agent "${agentId}" to rate.` }, 404, {}, readable)
    : json(
        { success: false, error: `Agent "${agentId}" has no stats or natal chart to rate.` },
        422,
        {},
        readable
      )
}

async function ratedPayload(vessel: RatableVessel, spacetime: EsmsHoldings | null) {
  const ledgerAgentId = VESSEL_ALIASES[vessel.agentId] ?? vessel.agentId
  const [balances, skyResult] = await Promise.all([
    resolveAgentEsmsBalances(ledgerAgentId, { spacetime, strict: false }),
    resolveLiveSky().then(
      sky => ({ sky, error: undefined }),
      (error: unknown) => ({
        sky: null,
        error: error instanceof SkyUnavailableError ? error.message : 'live sky unavailable',
      })
    ),
  ])
  return buildRatedAgentPayload({
    vessel,
    balances,
    sky: skyResult.sky,
    skyError: skyResult.error,
  })
}

function badAgentId(raw: string | null, readable = true) {
  if (raw === null || !AGENT_ID.test(raw)) {
    return json(
      { success: false, error: 'Invalid or missing agentId. Use 1-100 letters, digits, . _ -' },
      400,
      {},
      readable
    )
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const caller = rateLimit(`rating:${getClientIp(request.headers)}`, {
      limit: envLimit('RATING_API_PER_CALLER_PER_MIN', 120),
      windowMs: MINUTE_MS,
    })
    const overall = caller.ok
      ? rateLimit('rating:global', {
          limit: envLimit('RATING_API_GLOBAL_PER_MIN', 1200),
          windowMs: MINUTE_MS,
        })
      : caller
    if (!caller.ok || !overall.ok) {
      return json({ success: false, error: 'Too Many Requests' }, 429, { 'Retry-After': '60' })
    }

    const params = request.nextUrl.searchParams
    if (params.get('roster') === 'true') {
      const entries = HISTORICAL_AGENTS.map(agent => summarizeVessel(ratableFromRoster(agent)))
      return json({ success: true, count: entries.length, agents: entries }, 200, {
        'Cache-Control': 'public, max-age=300',
      })
    }

    const agentId = params.get('agentId')
    const invalid = badAgentId(agentId)
    if (invalid) return invalid

    const lookup = await resolveVessel(agentId as string)
    if (!lookup.found) return notRated(agentId as string, lookup.reason, true)
    const { vessel } = lookup
    return json(await ratedPayload(vessel, readPushed(vessel.agentId)), 200)
  } catch (error) {
    if (error instanceof AgentLookupUnavailable) {
      console.error('[rating] agent lookup unavailable:', error.message)
      return json({ success: false, error: 'Agent lookup is temporarily unavailable.' }, 503)
    }
    console.error('[rating] GET failed:', error instanceof Error ? error.message : error)
    return json({ success: false, error: 'Internal server error.' }, 500)
  }
}

function parseHoldings(raw: unknown): EsmsHoldings | null {
  if (!raw || typeof raw !== 'object') return null
  const out = {} as EsmsHoldings
  for (const token of ESMS_TOKENS) {
    const value = (raw as Record<string, unknown>)[token]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
    out[token] = value
  }
  return out
}

export async function POST(request: NextRequest) {
  // Internal webhook: server-to-server, so no CORS headers and fail closed without a secret.
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    return json({ success: false, error: 'Rating sync is not configured.' }, 503, {}, false)
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return json({ success: false, error: 'Unauthorized' }, 401, {}, false)
  }

  try {
    const declared = Number(request.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > MAX_POST_BYTES) {
      return json({ success: false, error: 'Request body too large' }, 413, {}, false)
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const agentId = typeof body?.agentId === 'string' ? body.agentId : null
    const invalid = badAgentId(agentId, false)
    if (invalid) return invalid

    const balances = parseHoldings(body?.esmsBalances)
    if (!balances) {
      return json(
        {
          success: false,
          error: 'esmsBalances must hold finite, non-negative spirit, essence, matter, substance.',
        },
        400,
        {},
        false
      )
    }

    const lookup = await resolveVessel(agentId as string)
    if (!lookup.found) return notRated(agentId as string, lookup.reason, false)
    const { vessel } = lookup

    rememberPushed(vessel.agentId, balances)
    return json(await ratedPayload(vessel, balances), 200, {}, false)
  } catch (error) {
    if (error instanceof AgentLookupUnavailable) {
      console.error('[rating] agent lookup unavailable:', error.message)
      return json(
        { success: false, error: 'Agent lookup is temporarily unavailable.' },
        503,
        {},
        false
      )
    }
    console.error('[rating] POST failed:', error instanceof Error ? error.message : error)
    return json({ success: false, error: 'Internal server error.' }, 500, {}, false)
  }
}
