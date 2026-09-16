import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { authenticateDesktopApiKey, extractDesktopApiKey } from '@/lib/security/desktop-auth'
import { loadVesselForUser } from '@/lib/vessel/summary'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/vessel/summary[?wallet=<base58>]
 *
 * The cross-app Alchm Vessel: ESMS balances, per-stream inflows, arena stats
 * and recent ledger for exactly one caller. Two ways in:
 *
 *   1. Session — the signed-in user (also reached cross-origin from Pentacles
 *      with the shared `.alchm.kitchen` cookie; see VESSEL_ORIGINS).
 *   2. Desktop API key — `x-api-key` or `Authorization: Bearer` (the
 *      HackStation cockpit). The key is bound to one user; unlinked dev
 *      tokens have no user and are refused.
 *
 * `wallet` is an assertion, not a selector: when present it must equal the
 * caller's verified Solana wallet or the request is refused. There is no way
 * to name another user.
 */

const DEFAULT_ORIGINS = [
  'https://agents.alchm.kitchen',
  'https://alchm.kitchen',
  'https://www.alchm.kitchen',
  'https://pentacles.alchm.kitchen',
]

function allowedOrigins(): Set<string> {
  const extra = (process.env.VESSEL_ORIGINS || '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return new Set([...DEFAULT_ORIGINS, ...extra])
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = { Vary: 'Origin', 'Cache-Control': 'no-store' }
  if (origin && allowedOrigins().has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
  }
  return headers
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req)
  const fail = (status: number, error: string) =>
    NextResponse.json({ ok: false, error }, { status, headers })

  const { searchParams } = req.nextUrl
  if (searchParams.has('userId')) return fail(400, 'userId is not accepted')

  let userId: string
  let email: string | null
  let cookie: string | null = null

  // A presented desktop key is the only credential considered — an invalid
  // key never falls back to whatever cookie rides along.
  const desktopKey = extractDesktopApiKey(req)
  if (desktopKey) {
    const desktop = await authenticateDesktopApiKey(desktopKey)
    if (desktop.status !== 'verified') return fail(401, 'Unauthorized')
    const user = await prisma.users.findUnique({
      where: { id: desktop.userId },
      select: { id: true, email: true },
    })
    if (!user) return fail(401, 'Unauthorized')
    userId = user.id
    email = user.email
  } else {
    const session = await auth()
    if (!session?.user?.id) return fail(401, 'Unauthorized')
    userId = session.user.id
    email = session.user.email ?? null
    cookie = req.headers.get('cookie')
  }

  try {
    const verified = await prisma.verifiedSolanaWallet.findUnique({
      where: { userId },
      select: { solanaPubKey: true },
    })
    const walletAddress = verified?.solanaPubKey ?? null

    const assertedWallet = searchParams.get('wallet')
    if (assertedWallet && assertedWallet !== walletAddress) {
      return fail(403, 'wallet does not match the caller’s verified Solana wallet')
    }

    const vessel = await loadVesselForUser({ userId, email, cookie, walletAddress })
    return NextResponse.json({ ok: true, vessel }, { headers })
  } catch (error) {
    console.error('[vessel/summary] failed to assemble vessel:', error)
    return fail(500, 'Failed to assemble the Alchm Vessel')
  }
}
