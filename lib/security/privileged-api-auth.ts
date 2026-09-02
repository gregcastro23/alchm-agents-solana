import 'server-only'

import { NextResponse } from 'next/server'
import { auth, type SessionUser } from '@/lib/auth'
import { adminErrorResponse, requireAdmin, type AdminAuthSuccess } from '@/lib/admin-auth'
import { hasInternalApiSecret } from '@/lib/security/internal-auth'
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
  if (hasInternalApiSecret(request)) {
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

/** Authorize a signed-in product user or a server-to-server credential. */
export async function requireUserOrService(request: Request): Promise<UserOrServiceAccess> {
  if (hasInternalApiSecret(request)) {
    return { ok: true, kind: 'service', source: 'internal-secret' }
  }

  const session = await auth()
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    }
  }
  if (!hasValidMutationOrigin(request)) return invalidOrigin()

  return { ok: true, kind: 'user', user: session.user }
}
