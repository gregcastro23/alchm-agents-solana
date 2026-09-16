import 'server-only'

import { NextResponse } from 'next/server'
import { resolveAuth, type SessionUser } from '@/lib/auth'
import { adminErrorResponse, requireAdmin, type AdminAuthSuccess } from '@/lib/admin-auth'
import { hasPrivilegedInternalApiSecret } from '@/lib/security/internal-auth'
import type { AdminAuditActor } from '@/lib/admin/audit'

type AccessFailure = {
  ok: false
  response: NextResponse
}

export type AdminOrServiceAccess =
  | { ok: true; kind: 'admin'; admin: AdminAuthSuccess }
  | { ok: true; kind: 'service'; source: 'internal-secret' }
  | AccessFailure

export type UserOrServiceAccess =
  | { ok: true; kind: 'user'; user: SessionUser }
  | { ok: true; kind: 'service'; source: 'internal-secret' }
  | { ok: true; kind: 'anonymous' }
  | AccessFailure

export type AdminRequestAccess = { ok: true; admin: AdminAuthSuccess } | AccessFailure

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function configuredOrigins(request: Request): Set<string> {
  const origins = new Set<string>()
  for (const candidate of [
    new URL(request.url).origin,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    if (!candidate) continue
    try {
      origins.add(new URL(candidate).origin)
    } catch {
      // A malformed optional URL must not broaden the accepted origin set.
    }
  }
  return origins
}

function hasValidMutationOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true

  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    return configuredOrigins(request).has(new URL(origin).origin)
  } catch {
    return false
  }
}

function invalidOrigin(): AccessFailure {
  return {
    ok: false,
    response: NextResponse.json({ error: 'Invalid request origin' }, { status: 403 }),
  }
}

/** Authorize an operator session or a server-to-server credential. */
export async function requireAdminOrService(request: Request): Promise<AdminOrServiceAccess> {
  if (hasPrivilegedInternalApiSecret(request)) {
    return { ok: true, kind: 'service', source: 'internal-secret' }
  }

  const admin = await requireAdmin()
  if (!admin.ok) return { ok: false, response: adminErrorResponse(admin) }
  if (!hasValidMutationOrigin(request)) return invalidOrigin()

  return { ok: true, kind: 'admin', admin }
}

export function toAdminAuditActor(
  access:
    | { kind: 'admin'; admin: AdminAuthSuccess }
    | { kind: 'service'; source: 'internal-secret' }
): AdminAuditActor {
  if (access.kind === 'admin') return access.admin

  return {
    user: { id: null, email: null },
    source: access.source,
  }
}

/** Authorize a browser admin request without granting service credentials access. */
export async function requireAdminRequest(request: Request): Promise<AdminRequestAccess> {
  const admin = await requireAdmin()
  if (!admin.ok) return { ok: false, response: adminErrorResponse(admin) }
  if (!hasValidMutationOrigin(request)) return invalidOrigin()

  return { ok: true, admin }
}

/**
 * Authorize a signed-in product user or a server-to-server credential.
 *
 * `failClosed` is for money routes — anything that spends or credits tokens,
 * calls the kitchen's economy endpoints, touches Stripe or wallets, or runs a
 * paid model call on the platform's key. When identity cannot be established
 * because the kitchen bridge errored or timed out, such a route must refuse
 * (503) rather than proceed as an anonymous-but-allowed caller. Ordinary read
 * paths keep degrading to 401.
 */
export async function requireUserOrService(
  request: Request,
  options: { allowAnonymous?: boolean; failClosed?: boolean } = {}
): Promise<UserOrServiceAccess> {
  if (hasPrivilegedInternalApiSecret(request)) {
    return { ok: true, kind: 'service', source: 'internal-secret' }
  }

  const { session, identityUnavailable } = await resolveAuth()
  if (!session?.user?.id) {
    if (options.failClosed && identityUnavailable) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Identity verification unavailable' },
          { status: 503, headers: { 'Retry-After': '30' } }
        ),
      }
    }
    if (options.allowAnonymous) {
      if (!hasValidMutationOrigin(request)) return invalidOrigin()
      return { ok: true, kind: 'anonymous' }
    }
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    }
  }
  if (!hasValidMutationOrigin(request)) return invalidOrigin()

  return { ok: true, kind: 'user', user: session.user }
}

export type ScopedUserId = { ok: true; userId: string } | { ok: false; response: NextResponse }

/**
 * Resolve the user id a user-scoped route may act on.
 *
 * Identity comes from the session. A caller-supplied `userId` is honoured only
 * on the service-credential path; for a signed-in user it must match their own
 * id, and a mismatch is a 403 rather than a silent read of someone else's row.
 *
 * Pass the result of `requireUserOrService(request)` — called WITHOUT
 * `allowAnonymous`, since an anonymous caller has no scope to resolve.
 */
export function resolveScopedUserId(
  access: Extract<UserOrServiceAccess, { ok: true }>,
  requestedUserId: string | null | undefined
): ScopedUserId {
  const requested = typeof requestedUserId === 'string' ? requestedUserId.trim() : ''

  if (access.kind === 'service') {
    // A service credential acts on behalf of a named user; it must name one.
    if (!requested) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'userId is required for service requests' },
          { status: 400 }
        ),
      }
    }
    return { ok: true, userId: requested }
  }

  if (access.kind === 'anonymous') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    }
  }

  if (requested && requested !== access.user.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, userId: access.user.id }
}
