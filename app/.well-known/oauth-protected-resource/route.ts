import {
  buildDiscoveryCorsHeaders,
  getTrustedOrigin,
  isAllowedMcpOrigin,
} from '@/lib/mcp/httpSecurity'

export const dynamic = 'force-dynamic'

/**
 * RFC 9728 OAuth 2.0 Protected Resource Metadata (`/.well-known/oauth-protected-resource`)
 *
 * Gated behind `ENABLE_MCP_OAUTH === "true"` in Phase 1 so MCP clients (Meta Muse,
 * Claude Desktop, Cursor) do not initiate OAuth 2.1 authorization flows against
 * non-existent `/api/oauth/*` endpoints and instead use anonymous / Bearer API key access.
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
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: [
      'mcp:tools:read',
      'mcp:tools:execute',
      'mcp:prompts:read',
      'mcp:resources:read',
    ],
    resource_documentation: `${origin}/integrations`,
    resource_policy_uri: `${origin}/privacy`,
    resource_tos_uri: `${origin}/terms`,
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
