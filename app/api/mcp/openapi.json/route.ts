import { buildDiscoveryCorsHeaders, isAllowedMcpOrigin } from '@/lib/mcp/httpSecurity'
import { buildPaMcpOpenApiSpec } from '@/lib/mcp/openapiBridge'

export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  const origin = req.headers.get('origin')
  if (origin && !isAllowedMcpOrigin(origin)) {
    return new Response(
      JSON.stringify({
        errorCode: 'FORBIDDEN_ORIGIN',
        message: 'Forbidden: Untrusted Origin header.',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Vary: 'Origin, Host',
        },
      }
    )
  }

  const spec = buildPaMcpOpenApiSpec(req)
  return new Response(JSON.stringify(spec, null, 2), {
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
