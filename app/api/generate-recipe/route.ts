import { createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend'
import { requireUserOrService } from '@/lib/security/privileged-api-auth'
import { getClientIp, rateLimit } from '@/lib/security/rate-limit'

const DEFAULT_AI_DISCLAIMER =
  'Planetary Agent responses and cosmic recipes are synthesized using Large Language Models (LLMs) and real-time astrological transit algorithms. They are provided for culinary inspiration and entertainment only, and do not constitute human medical, nutritional, or professional advice.'

const ROUTE_PATH = '/api/generate-recipe'
const MINUTE_MS = 60_000
const USER_LIMIT_PER_MIN = 20
const ANON_LIMIT_PER_MIN = 10

/** Keyed hash of the caller IP: enough to correlate abuse in logs, not to recover the IP. */
function callerIpHash(request: NextRequest): string {
  const key = process.env.LOG_HASH_SALT || process.env.INTERNAL_API_SECRET || 'asol'
  return createHmac('sha256', key).update(getClientIp(request.headers)).digest('hex').slice(0, 16)
}

/**
 * Caller auth, step 1 of 2 (log-only).
 *
 * Recipe generation runs a paid model, and this route accepted anyone. It now
 * recognises a signed-in user or a service bearer (`Authorization: Bearer
 * $INTERNAL_API_SECRET`, constant-time via requireUserOrService) and STILL
 * accepts anonymous calls — WTEN's hourly prewarm does not send the bearer yet —
 * but logs each one with a hashed caller IP and rate-limits it. Step 2 sets
 * RECIPE_AUTH_ENFORCE=true once WTEN sends the bearer, and anonymous calls get 401.
 *
 * `allowAnonymous` is deliberately NOT passed: its anonymous path demands a
 * same-origin `Origin` header, which a server-to-server caller never sends.
 */
async function authorizeCaller(
  request: NextRequest
): Promise<
  { ok: true; caller: 'user' | 'service' | 'anonymous' } | { ok: false; response: NextResponse }
> {
  const access = await requireUserOrService(request)
  if (access.ok && access.kind !== 'anonymous') {
    if (access.kind === 'user') {
      const limited = rateLimit(`recipe:user:${access.user.id}`, {
        limit: USER_LIMIT_PER_MIN,
        windowMs: MINUTE_MS,
      })
      if (!limited.ok) return { ok: false, response: tooManyRequests(limited.resetMs) }
    }
    return { ok: true, caller: access.kind }
  }
  // Anything other than "no identity" (a bad Origin, identity service down) is final.
  if (!access.ok && access.response.status !== 401) return { ok: false, response: access.response }

  const ipHash = callerIpHash(request)
  const enforce = process.env.RECIPE_AUTH_ENFORCE === 'true'
  console.warn(
    `[generate-recipe] recipe_auth_unauthenticated path=${ROUTE_PATH} ip_hash=${ipHash} enforced=${enforce}`
  )
  if (enforce) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    }
  }
  const limited = rateLimit(`recipe:anon:${ipHash}`, {
    limit: ANON_LIMIT_PER_MIN,
    windowMs: MINUTE_MS,
  })
  if (!limited.ok) {
    console.warn(`[generate-recipe] recipe_auth_rate_limited path=${ROUTE_PATH} ip_hash=${ipHash}`)
    return { ok: false, response: tooManyRequests(limited.resetMs) }
  }
  return { ok: true, caller: 'anonymous' }
}

function tooManyRequests(resetMs: number): NextResponse {
  return NextResponse.json(
    { error: 'Too Many Requests' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(resetMs / 1000))) } }
  )
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCaller(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const recipeData = await backend.request('/api/generate-recipe', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return NextResponse.json({
      success: true,
      recipe: recipeData,
      ai_generated: true,
      disclaimer: DEFAULT_AI_DISCLAIMER,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error generating cosmic recipe:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to generate cosmic recipe',
        ai_generated: true,
        disclaimer: DEFAULT_AI_DISCLAIMER,
      },
      { status: 500 }
    )
  }
}
