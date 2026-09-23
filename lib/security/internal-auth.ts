import 'server-only'

import { bearerToken, safeEqual } from './secure-compare'

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
  // The scheme is optional here (unchanged from the pre-constant-time version):
  // `Authorization: Bearer <secret>` and a bare `Authorization: <secret>` both count.
  const authorization = request.headers.get('authorization')
  const candidates = [
    authorization ? (bearerToken(authorization) ?? authorization.trim()) : null,
    request.headers.get('x-sync-secret'),
    request.headers.get('x-internal-secret'),
  ]
  // Compare every candidate (constant time, length hidden) so timing does not
  // reveal which header carried the match.
  let matched = false
  for (const candidate of candidates) {
    if (safeEqual(candidate, secret)) matched = true
  }
  return matched
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
