import { NextResponse } from 'next/server'

/**
 * Unified sign-out funnel for the Alchm ecosystem.
 *
 * Both agents.alchm.kitchen (PA) and alchm.kitchen (WTEN) set their session
 * cookie on the shared parent domain `.alchm.kitchen`. Because a page on a
 * subdomain may clear a cookie scoped to the parent domain, PA can sign the
 * user out of BOTH sites in one step by expiring every relevant session cookie
 * on `.alchm.kitchen` — no bounce through the kitchen's signout page required.
 * Both stacks use stateless JWT sessions, so clearing the cookie IS the logout.
 *
 * If WTEN later enables server-side session revocation, this should instead
 * redirect through `${alchm.kitchen}/api/auth/signout` (see WTEN_CHANGES.md).
 */

// Session cookies for both stacks, in both prod (__Secure-) and dev forms.
const SESSION_COOKIE_NAMES = [
  'next-auth.session-token', // PA (NextAuth v4)
  '__Secure-next-auth.session-token',
  'authjs.session-token', // WTEN (Auth.js v5)
  '__Secure-authjs.session-token',
]

// Legacy host-only cookies from the manual login flow.
const LEGACY_COOKIE_NAMES = ['userId', 'userName', 'userAvatar']

// NextAuth/Auth.js split an oversized session cookie into `<name>.0`, `<name>.1`,
// ... Clearing only the base name leaves a chunked session intact, so expire a
// generous range of chunk indices alongside it.
const MAX_COOKIE_CHUNKS = 8

function sessionCookieNamesWithChunks(): string[] {
  const names: string[] = []
  for (const base of SESSION_COOKIE_NAMES) {
    names.push(base)
    for (let i = 0; i < MAX_COOKIE_CHUNKS; i += 1) names.push(`${base}.${i}`)
  }
  return names
}

function configuredOrigins(request: Request): Set<string> {
  const origins = new Set<string>()
  for (const candidate of [
    safeOrigin(request.url),
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    if (!candidate) continue
    const origin = safeOrigin(candidate)
    if (origin) origins.add(origin)
  }
  return origins
}

function safeOrigin(value: string | undefined | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Sign-out is a state change, so it must be same-origin: a request another site
 * can cause is not a request the user made.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (origin) {
    const parsed = safeOrigin(origin)
    return parsed !== null && configuredOrigins(request).has(parsed)
  }

  // No Origin header: accept only a same-site form post, which carries Sec-Fetch-Site.
  const fetchSite = request.headers.get('sec-fetch-site')
  return fetchSite === 'same-origin' || fetchSite === 'same-site'
}

function clearAndRedirect(request: Request): NextResponse {
  let origin: string | null = null
  try {
    origin = new URL(request.url).origin
  } catch {
    origin = null
  }
  const base = process.env.NEXTAUTH_URL || origin || 'http://localhost:3000'
  const res = NextResponse.redirect(new URL('/', base))

  const isProd = process.env.NODE_ENV === 'production'
  // Shared session cookies are domain-scoped only on the production apex.
  const sharedDomain = process.env.VERCEL_ENV === 'production' ? '.alchm.kitchen' : undefined

  for (const name of sessionCookieNamesWithChunks()) {
    const isSecurePrefixed = name.startsWith('__Secure-')
    res.cookies.set(name, '', {
      domain: sharedDomain,
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecurePrefixed || isProd,
    })
  }

  for (const name of LEGACY_COOKIE_NAMES) {
    res.cookies.set(name, '', { path: '/', maxAge: 0 })
  }

  return res
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  return clearAndRedirect(request)
}

/**
 * Deliberately no GET handler: sign-out is a state change and belongs on POST.
 * Sign out with a same-origin POST (see `signOutViaApi` in lib/auth-signout.ts).
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    {
      status: 405,
      headers: { Allow: 'POST' },
    }
  )
}
