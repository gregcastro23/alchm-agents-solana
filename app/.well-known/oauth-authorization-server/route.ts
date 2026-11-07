import {
  buildDiscoveryCorsHeaders,
  getTrustedOrigin,
  isAllowedMcpOrigin,
} from '@/lib/mcp/httpSecurity'

export const dynamic = 'force-dynamic'

/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata (`/.well-known/oauth-authorization-server`)
 *
 * Gated behind `ENABLE_MCP_OAUTH === "true"` in Phase 1 so MCP clients do not
 * attempt OAuth 2.1 interactive authorization against unimplemented `/api/oauth/*`
 * routes. Returns 404 in Phase 1 so clients cleanly fall back to anonymous or Bearer token auth.
 */
export async function GET(req: Request): Promise<Response> {
  if (process.env.ENABLE_MCP_OAUTH !== 'true') {
    return new Response(
      JSON.stringify({
        error: 'oauth_not_enabled',
        error_description:
          'OAuth 2.1 interactive flow is disabled in Phase 1. Connect anonymously for Free tier read-only tools or pass Authorization: Bearer <alchm_api_key>.',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          ...buildDiscoveryCorsHeaders(req),
        },
      }
    )
  }

  const origin = getTrustedOrigin(req)

  const metadata = {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    scopes_supported: [
      'mcp:tools:read',
      'mcp:tools:execute',
      'mcp:prompts:read',
      'mcp:resources:read',
    ],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
    service_documentation: `${origin}/integrations`,
  }

  return new Response(JSON.stringify(metadata, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...buildDiscoveryCorsHeaders(req),
    },
  })
}

export async function OPTIONS(req: Request): Promise<Response> {
  const origin = req.headers.get('origin')
  if (origin && !isAllowedMcpOrigin(origin)) {
    return new Response(null, { status: 403, headers: { Vary: 'Origin' } })
  }
  return new Response(null, {
    status: 204,
    headers: buildDiscoveryCorsHeaders(req),
  })
}
