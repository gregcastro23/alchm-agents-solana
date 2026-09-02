import 'server-only'

import { timingSafeEqual } from 'node:crypto'

/**
 * Shared server-to-server authorization for internal API routes.
 *
 * Returns true iff the request carries the configured internal secret as either
 * an `Authorization: Bearer <secret>`, `X-Internal-Secret`, or
 * `X-Sync-Secret` header.
 *
 * Fail-closed: if NO secret is configured, this returns false (callers should
 * combine it with another gate, e.g. an admin session, or reject). Never
 * fail-open on a missing secret — that turns a misconfigured env into an open
 * privileged endpoint.
 */
function matchesSecret(request: Request, secret: string | undefined): boolean {
  if (!secret) return false
  const authToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const syncToken = request.headers.get('x-sync-secret') || ''
  const internalToken = request.headers.get('x-internal-secret') || ''

  return [authToken, syncToken, internalToken].some(candidate => {
    const actual = Buffer.from(candidate)
    const expected = Buffer.from(secret)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  })
}

/** The shared kitchen sync credential is intentionally separate from admin-adjacent service auth. */
export function hasInternalApiSecret(request: Request): boolean {
  return matchesSecret(
    request,
    process.env.INTERNAL_API_SECRET || process.env.ALCHM_KITCHEN_SYNC_SECRET
  )
}

/** Admin-adjacent routes accept only the dedicated internal service credential. */
export function hasPrivilegedInternalApiSecret(request: Request): boolean {
  return matchesSecret(request, process.env.INTERNAL_API_SECRET)
}
