// Middleware disabled for local development
// Authentication is optional - all routes are accessible without auth
// Re-enable when NextAuth is fully configured with proper environment variables

export const config = {
  matcher: [], // Empty matcher = middleware doesn't run on any routes
}
