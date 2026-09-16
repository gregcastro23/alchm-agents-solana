import { getServerSession } from 'next-auth'
import { authOptions } from './auth-options'
import { cookies } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { resolveBridgeOutcome, type BridgeOutcome } from './auth-bridge'

export type SessionUser = {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
  role?: string | null
  tier?: string | null
  /**
   * Set when the user was resolved via the alchm.kitchen bridge and the kitchen
   * reports them as premium. Used to unify the premium role across both sites.
   * Undefined for native PA sessions (premium then comes from PA's own sub).
   */
  kitchenPremium?: boolean
}

export type Session = {
  user: SessionUser
}

/**
 * Resolve identity, reporting how confident we are.
 *
 * `identityUnavailable` means we could not establish who the caller is — the
 * kitchen bridge errored or timed out. That is NOT the same as "signed out",
 * and a route that spends money must refuse rather than serve an anonymous
 * best-effort. Ordinary read paths may keep degrading to null.
 */
export type AuthResolution = {
  session: Session | null
  identityUnavailable: boolean
}

export async function resolveAuth(): Promise<AuthResolution> {
  let nativeUser: SessionUser | null = null

  // 1. Native PA session first (PA's own Google OAuth flow).
  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      const u = session.user as any
      if (u.id) {
        nativeUser = {
          id: u.id,
          email: u.email ?? null,
          name: u.name ?? null,
          image: u.image ?? null,
          role: u.role ?? null,
          tier: u.tier ?? null,
        }
      }
    }
  } catch (err) {
    unstable_rethrow(err)
    // A NextAuth provider/config error should not block the shared kitchen
    // session bridge, but surface it so a misconfiguration is visible.
    console.warn('[auth] getServerSession failed; falling back to the kitchen bridge', err)
  }

  // 2. Cross-site bridge: the user may be signed in on alchm.kitchen, whose
  //    session cookie is shared on `.alchm.kitchen`. See lib/auth-bridge.ts.
  let outcome: BridgeOutcome = { status: 'anonymous' }
  try {
    const c = await cookies()
    const cookieHeader = c
      .getAll()
      .map(ck => `${ck.name}=${ck.value}`)
      .join('; ')
    if (cookieHeader) {
      outcome = await resolveBridgeOutcome(cookieHeader)
    }
  } catch (err) {
    unstable_rethrow(err)
    console.warn('[auth] bridge resolution failed', err)
    outcome = { status: 'unavailable' }
  }

  if (outcome.status === 'user') {
    const bridged = outcome.user

    // The two sites disagree about who is signed in. The kitchen is the shared
    // sign-in of record, so prefer it — otherwise signing out there leaves this
    // app acting as the previous account.
    if (nativeUser && nativeUser.email && bridged.email !== nativeUser.email) {
      console.warn(
        '[auth] native and bridged identities disagree; preferring the kitchen identity',
        { nativeUserId: nativeUser.id, bridgedUserId: bridged.id }
      )
    }

    return {
      session: {
        user: {
          id: bridged.id,
          email: bridged.email,
          name: bridged.name,
          image: bridged.image,
          role: bridged.role,
          tier: bridged.tier,
          kitchenPremium: bridged.kitchenPremium,
        },
      },
      identityUnavailable: false,
    }
  }

  if (nativeUser) return { session: { user: nativeUser }, identityUnavailable: false }

  return { session: null, identityUnavailable: outcome.status === 'unavailable' }
}

export async function auth(): Promise<Session | null> {
  const { session } = await resolveAuth()
  return session
}

export async function requireAuthOrRedirect(): Promise<SessionUser | null> {
  const session = await auth()
  return session?.user ?? null
}
