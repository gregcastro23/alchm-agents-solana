/**
 * The origin at which this app's server code may call ITS OWN API routes.
 *
 * Never a Vercel deployment hostname. The project runs Vercel Standard
 * Protection (`all_except_custom_domains`), so `VERCEL_URL`,
 * `VERCEL_BRANCH_URL` and every other `*.vercel.app` host answer a server-side
 * caller with 401. Until 2026-09 the feed pusher fell through to `VERCEL_URL`
 * in production, and every System-B post to the council feed
 * (`agent_action_events`) was rejected that way.
 *
 * | Runtime                            | Origin                                                                          |
 * | ---------------------------------- | ------------------------------------------------------------------------------- |
 * | any, with an explicit override     | `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_BASE_URL` → `AGENTS_PUBLIC_URL`, as given  |
 * | `VERCEL_ENV=production`            | `https://$VERCEL_PROJECT_PRODUCTION_URL`, or the canonical domain when that is unset or a `*.vercel.app` host |
 * | `VERCEL_ENV=preview`               | `null` — its own hostname is protected, and it must not write into production  |
 * | anything else (local dev, scripts) | the canonical domain (unchanged)                                                |
 *
 * An explicit override is operator intent and is used as-is, including on a
 * preview — that is how a preview opts in to writing somewhere.
 */
export const CANONICAL_AGENTS_ORIGIN = 'https://agents.alchm.kitchen'

type SelfOriginEnv = Readonly<Record<string, string | undefined>>

export function resolveSelfOrigin(env: SelfOriginEnv = process.env): string | null {
  const explicit = (
    env.NEXT_PUBLIC_APP_URL ||
    env.NEXT_PUBLIC_BASE_URL ||
    env.AGENTS_PUBLIC_URL ||
    ''
  ).trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  if (env.VERCEL_ENV === 'preview') return null

  if (env.VERCEL_ENV === 'production') {
    // Documented without a scheme ("my-site.com"); tolerate one anyway.
    const host = (env.VERCEL_PROJECT_PRODUCTION_URL || '')
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
    // Vercel falls back to the project's *.vercel.app domain when no custom
    // domain is attached — which is protected, so it is no better than VERCEL_URL.
    if (host && !isVercelAppHost(host)) return `https://${host}`
  }

  return CANONICAL_AGENTS_ORIGIN
}

function isVercelAppHost(host: string): boolean {
  const hostname = host.split(':')[0]!.toLowerCase()
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app')
}
