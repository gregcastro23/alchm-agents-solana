import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { resolveAuth } from '@/lib/auth'
import { hasPrivilegedInternalApiSecret } from '@/lib/security/internal-auth'
import { requireUserOrService, resolveScopedUserId } from '@/lib/security/privileged-api-auth'
import { authenticateDesktopApiKey, extractDesktopApiKey } from '@/lib/security/desktop-auth'

function getJingCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-internal-secret',
    Vary: 'Origin',
  }

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  } else {
    headers['Access-Control-Allow-Origin'] = '*'
  }

  return headers
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: getJingCorsHeaders(req) })
}

/**
 * POST /api/jing-duels
 *
 * Persists one Jing Arena duel for the personalization feed + admin
 * telemetry board. The desktop shell calls this fire-and-forget after
 * the cast resolves — failures must never block the UI, so this route
 * accepts partial payloads gracefully and just records what it has.
 *
 * Attribution binding:
 * - Service credential (x-internal-secret): trusted to attribute to named userId.
 * - Desktop key (x-api-key or Bearer): verified key binds to key's userId.
 * - Unlinked dev key (dev-desktop-token): accepted for telemetry, but forces userId: null
 *   and source: 'desktop-unlinked'.
 * - Web session: binds strictly to session.user.id. Mismatched userId rejected with 403.
 * - Anonymous caller: cannot claim a userId (401 if provided); records unlinked duel (userId: null).
 * - Invalid keys: rejected with 401.
 */
export async function POST(req: NextRequest) {
  const corsHeaders = getJingCorsHeaders(req)

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    )
  }

  const requiredString = (key: string): string | null => {
    const value = body[key]
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  const sessionId = requiredString('sessionId') || 'desktop-jing'
  const casterId = requiredString('casterId')
  const targetId = requiredString('targetId')
  const attackMoveId = requiredString('attackMoveId')
  const counterMoveId = requiredString('counterMoveId')
  const stance = requiredString('stance')

  if (!casterId || !targetId || !attackMoveId || !counterMoveId || !stance) {
    return NextResponse.json(
      {
        ok: false,
        error: 'casterId, targetId, attackMoveId, counterMoveId, and stance are required',
      },
      { status: 422, headers: corsHeaders }
    )
  }

  const validStances = new Set(['clash', 'absorb', 'mirror'])
  if (!validStances.has(stance)) {
    return NextResponse.json(
      { ok: false, error: `stance must be one of ${[...validStances].join(', ')}` },
      { status: 422, headers: corsHeaders }
    )
  }

  const optionalString = (key: string): string | null => {
    const value = body[key]
    return typeof value === 'string' && value.length > 0 ? value.trim() : null
  }
  const optionalJson = (key: string): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
    const value = body[key]
    if (value && typeof value === 'object') return value as Prisma.InputJsonValue
    return Prisma.JsonNull
  }
  const optionalNumber = (key: string): number | null => {
    const value = body[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const optionalBool = (key: string): boolean => Boolean(body[key])

  let boundUserId: string | null = null
  let boundSource: string = optionalString('source') || 'desktop'

  const internalSecretHeader = req.headers.get('x-internal-secret')
  const desktopToken = extractDesktopApiKey(req)

  if (internalSecretHeader !== null) {
    if (!hasPrivilegedInternalApiSecret(req)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      )
    }
    boundUserId = optionalString('userId')
    boundSource = optionalString('source') || 'service'
  } else if (desktopToken) {
    const desktopAuth = await authenticateDesktopApiKey(desktopToken)
    if (desktopAuth.status === 'verified') {
      const requestedUserId = optionalString('userId')
      if (requestedUserId && requestedUserId !== desktopAuth.userId) {
        return NextResponse.json(
          { ok: false, error: 'Forbidden' },
          { status: 403, headers: corsHeaders }
        )
      }
      boundUserId = desktopAuth.userId
      boundSource = optionalString('source') || 'desktop'
    } else if (desktopAuth.status === 'unlinked-dev') {
      // Option b: accept telemetry without dropping, but strictly strip user identity
      boundUserId = null
      boundSource = 'desktop-unlinked'
    } else {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      )
    }
  } else {
    // Web session or anonymous web request
    const { session } = await resolveAuth()
    if (session?.user?.id) {
      const requestedUserId = optionalString('userId')
      if (requestedUserId && requestedUserId !== session.user.id) {
        return NextResponse.json(
          { ok: false, error: 'Forbidden' },
          { status: 403, headers: corsHeaders }
        )
      }
      boundUserId = session.user.id
      boundSource = optionalString('source') || 'web'
    } else {
      const requestedUserId = optionalString('userId')
      if (requestedUserId) {
        return NextResponse.json(
          { ok: false, error: 'Authentication required' },
          { status: 401, headers: corsHeaders }
        )
      }
      boundUserId = null
      boundSource = optionalString('source') || 'web-anonymous'
    }
  }

  try {
    const duel = await prisma.agentJingDuel.create({
      data: {
        sessionId,
        userId: boundUserId,
        source: boundSource,
        casterId,
        targetId,
        attackMoveId,
        counterMoveId,
        stance,
        boostElement: optionalString('boostElement'),
        boostMagnitude: optionalNumber('boostMagnitude') ?? 0,
        cacheHit: optionalBool('cacheHit'),
        synastrySnapshot: optionalJson('synastrySnapshot'),
        casterTransitSnapshot: optionalJson('casterTransitSnapshot'),
        targetTransitSnapshot: optionalJson('targetTransitSnapshot'),
        casterPrompt: optionalString('casterPrompt'),
        casterResponse: optionalString('casterResponse'),
        targetPrompt: optionalString('targetPrompt'),
        targetResponse: optionalString('targetResponse'),
        latencyMs: optionalNumber('latencyMs'),
        modelUsed: optionalString('modelUsed'),
      },
    })

    return NextResponse.json({ ok: true, id: duel.id }, { headers: corsHeaders })
  } catch (error) {
    // Foreign key violation is the most likely cause when an agentId
    // doesn't exist in historical_agents (e.g. a synthetic Stone agent).
    // Don't 500 the desktop shell over telemetry — log + 200 with a
    // skipped flag so the UI flow stays uninterrupted.
    console.error('Failed to persist Jing duel:', error)
    return NextResponse.json(
      {
        ok: false,
        skipped: true,
        error: 'Failed to persist duel',
      },
      { status: 200, headers: corsHeaders }
    )
  }
}

/**
 * GET /api/jing-duels?limit=20&casterId=...&targetId=...&userId=...
 *
 * Public aggregate read for clients (e.g. app/page.tsx:355) when userId is omitted.
 * When userId is provided, requires authenticated scoping (web session, desktop key,
 * or service secret).
 */
export async function GET(req: NextRequest) {
  const corsHeaders = getJingCorsHeaders(req)
  const { searchParams } = req.nextUrl
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100)
  const where: Record<string, unknown> = {}
  const casterId = searchParams.get('casterId')
  const targetId = searchParams.get('targetId')
  const userIdParam = searchParams.get('userId')
  if (casterId) where.casterId = casterId
  if (targetId) where.targetId = targetId

  if (userIdParam) {
    const internalSecretHeader = req.headers.get('x-internal-secret')
    const desktopToken = extractDesktopApiKey(req)

    if (internalSecretHeader !== null) {
      if (!hasPrivilegedInternalApiSecret(req)) {
        return NextResponse.json(
          { ok: false, error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        )
      }
      where.userId = userIdParam
    } else if (desktopToken) {
      const desktopAuth = await authenticateDesktopApiKey(desktopToken)
      if (desktopAuth.status === 'verified') {
        if (desktopAuth.userId !== userIdParam) {
          return NextResponse.json(
            { ok: false, error: 'Forbidden' },
            { status: 403, headers: corsHeaders }
          )
        }
        where.userId = desktopAuth.userId
      } else {
        return NextResponse.json(
          { ok: false, error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        )
      }
    } else {
      const access = await requireUserOrService(req)
      if (!access.ok) {
        return new NextResponse(access.response.body, {
          status: access.response.status,
          headers: { ...Object.fromEntries(access.response.headers.entries()), ...corsHeaders },
        })
      }
      const scoped = resolveScopedUserId(access, userIdParam)
      if (!scoped.ok) {
        return new NextResponse(scoped.response.body, {
          status: scoped.response.status,
          headers: { ...Object.fromEntries(scoped.response.headers.entries()), ...corsHeaders },
        })
      }
      where.userId = scoped.userId
    }
  }

  // Omit userId projection on public unauthenticated reads so user identities
  // are never leaked to arbitrary clients.
  const select = userIdParam
    ? {
        id: true,
        sessionId: true,
        userId: true,
        source: true,
        casterId: true,
        targetId: true,
        attackMoveId: true,
        counterMoveId: true,
        stance: true,
        boostElement: true,
        boostMagnitude: true,
        latencyMs: true,
        createdAt: true,
      }
    : {
        id: true,
        sessionId: true,
        source: true,
        casterId: true,
        targetId: true,
        attackMoveId: true,
        counterMoveId: true,
        stance: true,
        boostElement: true,
        boostMagnitude: true,
        latencyMs: true,
        createdAt: true,
      }

  try {
    const duels = await prisma.agentJingDuel.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select,
    })
    return NextResponse.json({ ok: true, duels }, { headers: corsHeaders })
  } catch (error) {
    console.error('Failed to list Jing duels:', error)
    return NextResponse.json(
      { ok: false, duels: [], error: 'Failed to list duels' },
      { status: 500, headers: corsHeaders }
    )
  }
}
