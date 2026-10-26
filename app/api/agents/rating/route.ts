import { NextRequest, NextResponse } from 'next/server'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import {
  AGENT_ID,
  AgentLookupUnavailable,
  creatorWalletPolicy,
  describeError,
  ledgerIdOf,
  ratedPayload,
  readPushed,
  rememberPushed,
  resolveVessel,
} from '@/lib/agents/rating/rating-resolver.server'
import { ESMS_TOKENS, type EsmsHoldings } from '@/lib/agents/rating/seals-surge'
import { ratableFromRoster, summarizeVessel } from '@/lib/agents/rating/vessel-payload'
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
 * The payload is the Pentacles rating contract's `RatedAgentPayload`
 * (`lib/agents/rating-contract.ts`: `key`, `handle`, `faction`, `ratings`, `ovr`, `archetype`,
 * `esms`, `seals`, `surge`, `appearance`) plus what only a live rating knows (`esmsSource`,
 * `sealProgress`, `sky`, `zoneSynergies`, `degraded`); this route only assembles it
 * (`lib/agents/rating/vessel-payload.ts`). POST takes `{ agentId, esms: { spirit, essence,
 * matter, substance } }`.
 *
 * ## Whose balances a GET may show
 *
 * A roster agent's wallet is an agentic user's and is public. A vessel a PERSON forged reads
 * that person's `token_balances` row, and a person's balance is private (the app's own
 * `/api/economy/balances` is session-gated) — while this route is unauthenticated with CORS `*`
 * and the gallery lists every forged vessel id. So a public GET never reads a creator's wallet:
 * it answers the baseline, `esmsSource: "fallback"`, `degraded.esms: "owner wallet is private"`,
 * and the Seals are computed from that baseline, so a tier cannot leak the balance either. The
 * wallet is read only for (a) a server caller presenting `Authorization: Bearer
 * INTERNAL_API_SECRET`, or (b) a signed-in session whose user IS the creator. A cross-origin
 * browser sends neither: `*` forbids credentialed requests, and the `Authorization` header
 * fails the preflight (`Access-Control-Allow-Headers` is `Content-Type`).
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
const RETRY = { 'Retry-After': '60' }
// A forged vessel's answer depends on who asks (its creator and the secret holder get the
// wallet), and vercel.json gives every /api/* response `s-maxage=60`. Function headers win over
// that, but the CDN is told directly too, as `GET /api/agents/[slug]/ratings` does: never shared.
const PER_VIEWER = {
  'CDN-Cache-Control': 'no-store',
  Vary: 'Authorization, Cookie, X-Internal-Secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: READ_CORS })
}

const MAX_POST_BYTES = 4 * 1024
const MINUTE_MS = 60_000

function envLimit(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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

/**
 * The request body as text, refusing more than `max` bytes however it arrives (a declared
 * `Content-Length` is only a hint, and a chunked body declares none). `null` means too large.
 */
async function readBoundedText(request: NextRequest, max: number): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(joined)
}

export async function GET(request: NextRequest) {
  try {
    // Charge the caller first; the shared bucket is charged only by a request that will do
    // real work (a ledger read, a sky fetch), never by a malformed id or the static roster.
    const caller = rateLimit(`rating:${getClientIp(request.headers)}`, {
      limit: envLimit('RATING_API_PER_CALLER_PER_MIN', 120),
      windowMs: MINUTE_MS,
    })
    if (!caller.ok) return json({ success: false, error: 'Too Many Requests' }, 429, RETRY)

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

    const overall = rateLimit('rating:global', {
      limit: envLimit('RATING_API_GLOBAL_PER_MIN', 1200),
      windowMs: MINUTE_MS,
    })
    if (!overall.ok) return json({ success: false, error: 'Too Many Requests' }, 429, RETRY)

    const lookup = await resolveVessel(agentId as string)
    if (!lookup.found) return notRated(agentId as string, lookup.reason, true)
    const { vessel } = lookup

    // Only a person's vessel has a private wallet; a roster agent's is public.
    const creatorWallet =
      vessel.origin === 'forged' ? await creatorWalletPolicy(request) : ('deny' as const)
    const live =
      vessel.origin === 'roster' || creatorWallet === 'allow'
        ? readPushed(ledgerIdOf(vessel))
        : null
    return json(
      await ratedPayload(vessel, live, creatorWallet),
      200,
      vessel.origin === 'forged' ? PER_VIEWER : {}
    )
  } catch (error) {
    if (error instanceof AgentLookupUnavailable) {
      console.error('[rating] agent lookup unavailable:', error.message)
      return json({ success: false, error: 'Agent lookup is temporarily unavailable.' }, 503)
    }
    console.error('[rating] GET failed:', describeError(error))
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
    const tooLarge = () => json({ success: false, error: 'Request body too large' }, 413, {}, false)
    const declared = Number(request.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > MAX_POST_BYTES) return tooLarge()
    const text = await readBoundedText(request, MAX_POST_BYTES)
    if (text === null) return tooLarge()

    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
    } catch {
      // An unparseable body fails validation below, with the same 400 as any other bad body.
    }
    const body = parsed as Record<string, unknown> | null
    const agentId = typeof body?.agentId === 'string' ? body.agentId : null
    const invalid = badAgentId(agentId, false)
    if (invalid) return invalid

    const balances = parseHoldings(body?.esms)
    if (!balances) {
      return json(
        {
          success: false,
          error: 'esms must hold finite, non-negative spirit, essence, matter, substance.',
        },
        400,
        {},
        false
      )
    }

    const lookup = await resolveVessel(agentId as string)
    if (!lookup.found) return notRated(agentId as string, lookup.reason, false)
    const { vessel } = lookup

    // The feeder holds the secret, so the creator wallet is its to read; the pushed holdings
    // win anyway. Remember them only once the recalculation has succeeded.
    const payload = await ratedPayload(vessel, balances, 'allow')
    rememberPushed(ledgerIdOf(vessel), balances)
    return json(payload, 200, {}, false)
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
    console.error('[rating] POST failed:', describeError(error))
    return json({ success: false, error: 'Internal server error.' }, 500, {}, false)
  }
}
