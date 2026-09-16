import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { EconomyService } from '@/lib/services/economyService'
import { buildProfileYieldStateFromBalances } from '@/lib/profile-yield'
import {
  authenticateDesktopApiKey,
  extractDesktopApiKey,
  DEV_DESKTOP_API_KEY,
} from '@/lib/security/desktop-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEV_DESKTOP_USER_ID = process.env.DESKTOP_DEV_USER_ID || 'desktop-local'

/**
 * The local-dev session is a convenience for running the desktop shell against
 * a dev server without signing in. It reports balances of 150 that no ledger
 * backs, so production must never serve it: a client that cannot tell this
 * apart from a real session shows the user tokens they do not own.
 */
function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

function localDevSession() {
  const balances = { spirit: 150, essence: 150, matter: 150, substance: 150 }
  return {
    mode: 'local-dev',
    userId: DEV_DESKTOP_USER_ID,
    apiKey: DEV_DESKTOP_API_KEY,
    balances,
    accounts: [
      {
        site: 'agents',
        label: 'Alchm Agents',
        homeUrl: 'https://agents.alchm.kitchen',
        balances,
        canClaimDaily: false,
        streak: 0,
        lastDailyClaimAt: null,
        status: 'local-dev',
        message: 'Sign in to claim daily yield.',
      },
      {
        site: 'kitchen',
        label: 'Alchm Kitchen',
        homeUrl: 'https://alchm.kitchen',
        balances,
        canClaimDaily: false,
        streak: 0,
        lastDailyClaimAt: null,
        status: 'local-dev',
        message: 'Sign in to claim daily yield.',
      },
    ],
  }
}

export async function GET(req: Request) {
  let userId: string | undefined = undefined
  let token: string | undefined = undefined

  // 1. Try to authenticate via Authorization: Bearer <apiKey> or x-api-key header
  const desktopToken = extractDesktopApiKey(req)
  if (desktopToken) {
    const desktopAuth = await authenticateDesktopApiKey(desktopToken)
    if (desktopAuth.status === 'verified') {
      userId = desktopAuth.userId
      token = desktopAuth.token
    }
  }

  // 2. Fall back to the unified web session (native PA or kitchen bridge).
  if (!userId) {
    const session = await auth().catch(() => null)
    userId = session?.user.id
  }

  // 3. If still unauthenticated: in production this is simply an unauthenticated
  //    request. Only a non-production runtime may fall back to the fake session.
  if (!userId) {
    if (isProductionRuntime()) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json(localDevSession())
  }

  // 4. Retrieve live alchemical balances from Neon PostgreSQL
  const balances = await EconomyService.getBalances(userId)

  // 5. Retrieve daily claim history to calculate dynamic streaks and cooldowns.
  // A browser session never rotates desktop credentials here. Tokens are only
  // minted by the explicit, signed /api/desktop/session/link handshake.
  const wallet = buildProfileYieldStateFromBalances(balances)

  return NextResponse.json({
    mode: 'authenticated',
    userId,
    apiKey: token ?? null,
    balances: wallet.balances,
    accounts: wallet.accounts,
  })
}
