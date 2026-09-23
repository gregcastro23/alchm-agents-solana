import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { EconomyService } from '@/lib/services/economyService'
import { isLocalDevelopment } from '@/lib/security/cron-auth'
import { bearerToken, safeEqualAny } from '@/lib/security/secure-compare'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/economy/claim-yield
 *
 * Request body:
 *   {
 *     "historicalAgentId": "socrates",
 *     "planetaryAgentId": "planetary-mars-gemini-22"
 *   }
 *
 * Returns: { success, amount, balances }
 *
 * Moves real token balances, so production requires either a signed-in
 * session or a service secret (CRON_SECRET / INTERNAL_API_SECRET) — the
 * same fail-closed pattern as app/api/cron/agents/claim-yield.
 */
async function isAuthorized(req: Request): Promise<boolean> {
  const token = bearerToken(req.headers.get('authorization'))
  if (safeEqualAny(token, [process.env.CRON_SECRET, process.env.INTERNAL_API_SECRET])) return true

  // Mirror the cron routes: only a developer's own `next dev` skips the check.
  if (isLocalDevelopment()) return true

  try {
    const session = await auth()
    return Boolean(session?.user)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { historicalAgentId, planetaryAgentId } = await req.json()

    if (!historicalAgentId || !planetaryAgentId) {
      return NextResponse.json(
        { error: 'Missing historicalAgentId or planetaryAgentId' },
        { status: 400 }
      )
    }

    const result = await EconomyService.claimPlanetaryYield(historicalAgentId, planetaryAgentId)

    if ('alreadyClaimed' in result && result.alreadyClaimed) {
      return NextResponse.json(result, { status: 409 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error claiming planetary yield:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
