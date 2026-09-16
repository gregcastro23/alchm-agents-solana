/**
 * Cross-site session bridge: let agents.alchm.kitchen (PA) recognize a user who
 * signed in on alchm.kitchen (WTEN).
 *
 * Why this exists: PA runs NextAuth v4 (cookie `next-auth.session-token`) while
 * WTEN runs Auth.js v5 (cookie `authjs.session-token`). Both cookies are scoped
 * to the shared parent domain `.alchm.kitchen`, so WTEN's session cookie is
 * already delivered to PA on every request — PA just never read it. Rather than
 * migrate PA's whole auth stack to v5, we let WTEN decode its own cookie: PA
 * calls WTEN's default `/api/auth/session` endpoint server-to-server, forwarding
 * the incoming cookies, and trusts the resulting identity.
 *
 * Once we know the kitchen user's email, we JIT-provision a local PA `users` row
 * (so FK relations like conversations/agents have a stable PA id to hang off)
 * and store the WTEN id in `users.alchmKitchenUserId` as the cross-site link.
 *
 * Safety: every failure path returns `null` — kitchen being slow or down must
 * never block PA auth. The network call is memoized per request via React
 * `cache()` so a render tree with many `auth()` calls makes at most one hop.
 */

import * as React from 'react'
import { prisma } from '@/lib/db'
import { provisionPaUser } from '@/lib/user-provisioning'

// React's `cache` is an RSC-only API (provided by Next's server React build);
// the bare `react` package on 18.x doesn't export it, and route handlers/tests
// have no React request scope. Use it when it's genuinely available (dedupes the
// kitchen call across multiple auth() calls in one server-component render),
// otherwise fall back to the plain function (correct, just un-memoized).
const perRequestCache: <T extends (...args: any[]) => any>(fn: T) => T =
  typeof (React as { cache?: unknown }).cache === 'function'
    ? (React as unknown as { cache: <T extends (...a: any[]) => any>(fn: T) => T }).cache
    : fn => fn

export type BridgeUser = {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string | null
  tier: string | null
  /**
   * Whether alchm.kitchen considers this user premium (its session reports
   * tier==='premium' or an admin role). Unifies the premium role: a kitchen
   * subscription grants premium on PA too.
   */
  kitchenPremium: boolean
}

const KITCHEN_BASE_URL = (
  process.env.ALCHM_KITCHEN_SYNC_URL ||
  process.env.NEXT_PUBLIC_ALCHM_KITCHEN_URL ||
  'https://alchm.kitchen'
).replace(/\/$/, '')

const SESSION_FETCH_TIMEOUT_MS = 2500

/**
 * Only alchm.kitchen's own session cookie is forwarded. Sending this app's whole
 * cookie jar hands the kitchen credentials it has no business seeing, including
 * this app's session token.
 */
const KITCHEN_SESSION_COOKIE = 'authjs.session-token'

function isKitchenSessionCookie(name: string): boolean {
  const bare = name.startsWith('__Secure-') ? name.slice('__Secure-'.length) : name
  // Auth.js chunks an oversized cookie as `<name>.0`, `<name>.1`, ...
  return bare === KITCHEN_SESSION_COOKIE || bare.startsWith(`${KITCHEN_SESSION_COOKIE}.`)
}

/** Narrow a raw Cookie header down to the kitchen's session cookie and its chunks. */
export function filterKitchenCookies(cookieHeader: string): string {
  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(part => {
      const eq = part.indexOf('=')
      return eq > 0 && isKitchenSessionCookie(part.slice(0, eq).trim())
    })
    .join('; ')
}

/** Distinguishes "the kitchen says nobody" from "we could not ask". */
export type BridgeOutcome =
  | { status: 'user'; user: BridgeUser }
  | { status: 'anonymous' }
  | { status: 'unavailable' }

type KitchenSession = {
  user?: {
    id?: string | null
    email?: string | null
    name?: string | null
    image?: string | null
    // alchm.kitchen exposes these on its session (see WTEN auth.config.ts).
    tier?: string | null
    role?: string | null
  } | null
}

/**
 * Ask alchm.kitchen who the forwarded cookies belong to. Returns the kitchen
 * session user, or null if not signed in / unreachable. Never throws.
 */
async function fetchKitchenSession(
  cookieHeader: string
): Promise<
  | { status: 'user'; user: NonNullable<KitchenSession['user']> }
  | { status: 'anonymous' }
  | { status: 'unavailable' }
> {
  const kitchenCookies = filterKitchenCookies(cookieHeader)
  if (!kitchenCookies) return { status: 'anonymous' }
  try {
    const res = await fetch(`${KITCHEN_BASE_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        cookie: kitchenCookies,
        accept: 'application/json',
        // A hint so the kitchen can tell this server-to-server probe apart from
        // the user's own browser. It is never proof of identity.
        'x-alchm-bridge': 'agents',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(SESSION_FETCH_TIMEOUT_MS),
    })
    // 5xx means the kitchen could not answer; 4xx means it answered "no".
    if (res.status >= 500) return { status: 'unavailable' }
    if (!res.ok) return { status: 'anonymous' }
    const data = (await res.json()) as KitchenSession
    const user = data?.user
    if (!user?.email) return { status: 'anonymous' }
    return { status: 'user', user }
  } catch {
    // Timeout, network error, or malformed JSON — we do not know who this is.
    return { status: 'unavailable' }
  }
}

/**
 * Resolve the PA user for the given forwarded cookie header by validating the
 * alchm.kitchen session and JIT-provisioning a local PA user. Memoized per
 * request. Returns null when there is no kitchen session.
 */
export const resolveBridgeOutcome = perRequestCache(
  async (cookieHeader: string): Promise<BridgeOutcome> => {
    const result = await fetchKitchenSession(cookieHeader)
    if (result.status !== 'user') return result
    const kitchenUser = result.user
    if (!kitchenUser.email) return { status: 'anonymous' }

    const email = kitchenUser.email.trim().toLowerCase()
    const kitchenPremium =
      (kitchenUser.tier ?? '').toLowerCase() === 'premium' ||
      (kitchenUser.role ?? '').toLowerCase() === 'admin'
    try {
      const { id } = await prisma.$transaction(tx =>
        provisionPaUser(tx, {
          email,
          name: kitchenUser.name ?? null,
          provider: 'alchm-kitchen-bridge',
          alchmKitchenUserId: kitchenUser.id ?? null,
        })
      )
      return {
        status: 'user',
        user: {
          id,
          email,
          name: kitchenUser.name ?? null,
          image: kitchenUser.image ?? null,
          role: kitchenUser.role ?? null,
          tier: kitchenUser.tier ?? null,
          kitchenPremium,
        },
      }
    } catch (err) {
      // We know who they are but cannot record it — that is an outage on our
      // side, not an anonymous visitor.
      console.warn('[auth-bridge] failed to provision bridged user', err)
      return { status: 'unavailable' }
    }
  }
)

/**
 * Back-compatible shape for callers that only need "who is this, if anyone".
 * Callers that must distinguish an outage from a signed-out visitor — anything
 * that spends money — should use `resolveBridgeOutcome` and fail closed.
 */
export async function resolveBridgeUser(cookieHeader: string): Promise<BridgeUser | null> {
  const outcome = await resolveBridgeOutcome(cookieHeader)
  return outcome.status === 'user' ? outcome.user : null
}
