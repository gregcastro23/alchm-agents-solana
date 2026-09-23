/**
 * Shared authorization for `app/api/cron/*` routes.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. That is checked in
 * constant time (see `secure-compare.ts`), and a missing or wrong secret is a
 * 401 everywhere the code is deployed.
 *
 * The one exception is a deliberate, named local-development bypass: running
 * `next dev` on a laptop with no CRON_SECRET set lets a developer hit a cron
 * route by hand. It can never fire in a deployed environment:
 *   - Next.js builds (production AND Vercel preview) run with NODE_ENV=production,
 *     so the bypass requires NODE_ENV === 'development' exactly — `test` does
 *     not qualify either;
 *   - it also refuses when any deployment marker is present (Vercel runtime
 *     region, a production/preview VERCEL_ENV, any Railway environment);
 *   - and it only applies when CRON_SECRET is unset. A developer who sets one
 *     locally gets the real check, not a warning.
 *
 * Previously each route warned and carried on when a WRONG secret was sent
 * outside production.
 */
import { NextResponse } from 'next/server'
import { bearerToken, safeEqualAny } from './secure-compare'

export type CronAuthResult =
  | { ok: true; via: 'cron-secret' | 'local-dev-bypass' }
  | { ok: false; response: NextResponse }

const DEPLOYMENT_MARKERS = [
  'VERCEL_REGION',
  'RAILWAY_ENVIRONMENT',
  'RAILWAY_ENVIRONMENT_NAME',
  'RAILWAY_PROJECT_ID',
] as const

/** True only for a developer's own `next dev` process — never for anything deployed. */
export function isLocalDevelopment(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== 'development') return false
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return false
  return DEPLOYMENT_MARKERS.every(name => !env[name])
}

function unauthorized(route: string, reason: string): CronAuthResult {
  console.error(`[${route}] Unauthorized cron request: ${reason}`)
  return { ok: false, response: new NextResponse('Unauthorized', { status: 401 }) }
}

/**
 * Authorize a cron invocation. `extraSecrets` lets a route also accept its own
 * legacy secret (e.g. PA_CRON_SECRET); every candidate is compared in constant time.
 */
export function authorizeCron(
  request: Request,
  route: string,
  options: { extraSecrets?: ReadonlyArray<string | undefined>; headerNames?: string[] } = {}
): CronAuthResult {
  const secrets = [process.env.CRON_SECRET, ...(options.extraSecrets ?? [])].filter(
    (s): s is string => Boolean(s)
  )

  if (secrets.length === 0) {
    if (isLocalDevelopment()) {
      console.warn(`[${route}] LOCAL DEV BYPASS: CRON_SECRET is unset; running unauthenticated.`)
      return { ok: true, via: 'local-dev-bypass' }
    }
    return unauthorized(route, 'CRON_SECRET is not configured')
  }

  const presented = [
    bearerToken(request.headers.get('authorization')),
    ...(options.headerNames ?? []).map(name => request.headers.get(name)),
  ]
  // Check every presented credential so timing does not reveal which slot matched.
  let matched = false
  for (const candidate of presented) {
    if (candidate && safeEqualAny(candidate, secrets)) matched = true
  }
  if (!matched) return unauthorized(route, 'missing or wrong secret')
  return { ok: true, via: 'cron-secret' }
}
