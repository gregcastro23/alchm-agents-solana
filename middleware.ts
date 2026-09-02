import { NextResponse } from 'next/server'

/**
 * Global Edge Security Middleware (OWASP API5 / NIST Protect / ASVS V2 & V14)
 * Enforces security response headers.
 *
 * Authentication belongs at the route/layout boundary where cookie sessions
 * and service credentials can be evaluated deliberately. Requiring a service
 * secret here would reject normal browser navigation before the admin layout's
 * cookie-backed `requireAdmin()` check can run.
 */
export function middleware() {
  const response = NextResponse.next()

  // Apply Security Headers to all responses
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
