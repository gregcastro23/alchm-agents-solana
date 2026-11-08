import { buildMcpCorsHeaders, isAllowedMcpOrigin } from '@/lib/mcp/httpSecurity'
import { executePaRestToolCall } from '@/lib/mcp/openapiBridge'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  req: Request,
  context: { params: Promise<{ tool: string }> }
): Promise<Response> {
  const { tool } = await context.params
  return executePaRestToolCall(tool, req)
}

export async function OPTIONS(req: Request): Promise<Response> {
  const origin = req.headers.get('origin')
  if (origin && !isAllowedMcpOrigin(origin)) {
    return new Response(null, {
      status: 403,
      headers: {
        'Cache-Control': 'no-store',
        Vary: 'Origin',
      },
    })
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...buildMcpCorsHeaders(req),
      'Cache-Control': 'no-store',
    },
  })
}
