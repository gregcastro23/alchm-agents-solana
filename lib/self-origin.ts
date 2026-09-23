/**
 * This app's own origin, resolved per Vercel environment.
 *
 * On production it is never a Vercel deployment hostname. The project runs
 * Vercel Standard Protection (`all_except_custom_domains`), so `VERCEL_URL`,
 * `VERCEL_BRANCH_URL` and every other `*.vercel.app` host answer anyone without
 * a Vercel session (a server-side caller, a crawler) with 401. Two things
 * fell through to `VERCEL_URL` in production until 2026-09: the feed pusher's
 * self-call, so every System-B post to the council feed (`agent_action_events`)
 * was rejected, and the root layout's `metadataBase`, so canonical links
 * pointed crawlers at a login wall.
 *
 * Both resolvers take an explicit override first — `NEXT_PUBLIC_APP_URL` →
 * `NEXT_PUBLIC_BASE_URL` → `AGENTS_PUBLIC_URL`, used as given. That is operator
 * intent, and on a preview it is how a deployment opts in to a different origin.
 */
export const CANONICAL_AGENTS_ORIGIN = 'https://agents.alchm.kitchen'

type OriginEnv = Readonly<Record<string, string | undefined>>

/**
 * Where server code may call ITS OWN API routes, or `null` when it should not.
 *
 * | Runtime                            | Origin                                                                           |
 * | ---------------------------------- | -------------------------------------------------------------------------------- |
 * | `VERCEL_ENV=production`            | `https://$VERCEL_PROJECT_PRODUCTION_URL`, or the canonical domain when that is unset or a `*.vercel.app` host |
 * | `VERCEL_ENV=preview`               | `null` — its own hostname is protected, and it must not write into production   |
 * | anything else (local dev, scripts) | the canonical domain (unchanged)                                                 |
 */
export function resolveSelfOrigin(env: OriginEnv = process.env): string | null {
  const explicit = explicitOrigin(env)
  if (explicit) return explicit

  if (env.VERCEL_ENV === 'preview') return null
  if (env.VERCEL_ENV === 'production') return productionOrigin(env)
  return CANONICAL_AGENTS_ORIGIN
}

/**
 * The origin a browser or crawler sees, for absolute URLs in rendered output —
 * the root layout's `metadataBase`, against which relative canonical, Open
 * Graph and Twitter URLs resolve. Never `null`.
 *
 * | Runtime                            | Origin                                                                           |
 * | ---------------------------------- | -------------------------------------------------------------------------------- |
 * | `VERCEL_ENV=production`            | as `resolveSelfOrigin` — the custom domain, never a `*.vercel.app` host          |
 * | `VERCEL_ENV=preview`               | `https://$VERCEL_URL`, the deployment that rendered the page                     |
 * | anything else (local dev, scripts) | `http://localhost:$PORT` (default 3000)                                          |
 *
 * A preview keeps its own deployment URL rather than production's. A crawler
 * cannot index a preview at all (it gets the same 401), so a preview canonical
 * has no SEO effect, and pointing it at production would send a reviewer's
 * relative assets — an Open Graph image under change — to the production build.
 * `VERCEL_URL` rather than Next's default `VERCEL_BRANCH_URL`: the deployment URL
 * is immutable, so assets stay on the build that rendered the page, where the
 * branch URL would follow newer pushes to that branch.
 */
export function resolvePublicOrigin(env: OriginEnv = process.env): string {
  const explicit = explicitOrigin(env)
  if (explicit) return explicit

  if (env.VERCEL_ENV === 'production') return productionOrigin(env)
  if (env.VERCEL_ENV === 'preview') {
    const host = bareHost(env.VERCEL_URL)
    return host ? `https://${host}` : productionOrigin(env)
  }
  return `http://localhost:${env.PORT || 3000}`
}

function explicitOrigin(env: OriginEnv): string | null {
  const explicit = (
    env.NEXT_PUBLIC_APP_URL ||
    env.NEXT_PUBLIC_BASE_URL ||
    env.AGENTS_PUBLIC_URL ||
    ''
  ).trim()
  return explicit ? explicit.replace(/\/+$/, '') : null
}

function productionOrigin(env: OriginEnv): string {
  const host = bareHost(env.VERCEL_PROJECT_PRODUCTION_URL)
  // Vercel falls back to the project's *.vercel.app domain when no custom
  // domain is attached — which is protected, so it is no better than VERCEL_URL.
  return host && !isVercelAppHost(host) ? `https://${host}` : CANONICAL_AGENTS_ORIGIN
}

/** Vercel's host variables are documented without a scheme ("my-site.com"); tolerate one anyway. */
function bareHost(value: string | undefined): string {
  return (value || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
}

function isVercelAppHost(host: string): boolean {
  const hostname = host.split(':')[0]!.toLowerCase()
  return hostname === 'vercel.app' || hostname.endsWith('.vercel.app')
}
