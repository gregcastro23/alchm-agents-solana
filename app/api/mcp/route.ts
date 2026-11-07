import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
  buildMcpCorsHeaders,
  isAllowedMcpOrigin,
  MAX_BODY_BYTES,
  redactSensitiveString,
  sanitizeHeaderInput,
} from '@/lib/mcp/httpSecurity'
import { createPlanetaryAgentsMcpServer } from '@/lib/mcp/serverFactory'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Extract Bearer token from Authorization header if present.
 */
function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return undefined
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const rawToken = match?.[1]?.trim()
  if (!rawToken) return undefined
  return sanitizeHeaderInput(rawToken, 256)
}

/**
 * Append CORS headers to a Web Standard Response if Origin is trusted.
 */
function withCorsHeaders(req: Request, response: Response): Response {
  const corsHeaders = buildMcpCorsHeaders(req)
  if (Object.keys(corsHeaders).length === 0) {
    return response
  }

  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Inject HTTP transport headers (Authorization Bearer, Idempotency-Key,
 * X-Correlation-ID, User-Agent) into `tools/call` arguments when not explicitly provided.
 */
function bridgeHeadersIntoJsonRpcBody(
  parsedBody: unknown,
  req: Request,
  bearerToken?: string
): unknown {
  if (!parsedBody || typeof parsedBody !== 'object') {
    return parsedBody
  }

  if (Array.isArray(parsedBody)) {
    return parsedBody.map(item => bridgeHeadersIntoJsonRpcBody(item, req, bearerToken))
  }

  const msg = parsedBody as Record<string, unknown>
  if (msg.method !== 'tools/call' || !msg.params || typeof msg.params !== 'object') {
    return parsedBody
  }

  const params = { ...(msg.params as Record<string, unknown>) }
  const args =
    params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
      ? { ...(params.arguments as Record<string, unknown>) }
      : {}

  if (bearerToken && !args.apiKey && !args.sessionToken) {
    args.apiKey = bearerToken
  }

  const idempotencyHeader = sanitizeHeaderInput(req.headers.get('idempotency-key'), 128)
  if (idempotencyHeader && !args.idempotencyKey) {
    args.idempotencyKey = idempotencyHeader
  }

  const correlationId = sanitizeHeaderInput(req.headers.get('x-correlation-id'), 128)
  const userAgent = sanitizeHeaderInput(req.headers.get('user-agent'), 256)
  if (correlationId || userAgent) {
    const existingMeta =
      args._meta && typeof args._meta === 'object' && !Array.isArray(args._meta)
        ? (args._meta as Record<string, unknown>)
        : {}
    args._meta = {
      ...existingMeta,
      ...(correlationId ? { correlationId } : {}),
      ...(userAgent ? { clientUserAgent: userAgent } : {}),
    }
  }

  params.arguments = args
  return {
    ...msg,
    params,
  }
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

export async function POST(req: Request): Promise<Response> {
  try {
    const contentLengthHeader = req.headers.get('content-length')
    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10)
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        return withCorsHeaders(
          req,
          new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32600,
                message: 'Payload Too Large: Request body exceeds 256 KB limit.',
                data: {
                  errorCode: 'PAYLOAD_TOO_LARGE',
                  remediation:
                    'Reduce the JSON-RPC request body size below 256 KB or split batch requests into smaller calls.',
                },
              },
              id: null,
            }),
            {
              status: 413,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
              },
            }
          )
        )
      }
    }

    const bearerToken = extractBearerToken(req)

    const server = createPlanetaryAgentsMcpServer({
      defaultApiKey: bearerToken || process.env.ALCHM_MCP_API_KEY,
      defaultSessionToken: process.env.ALCHM_MCP_SESSION_TOKEN,
    })

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    await server.connect(transport)

    let parsedBody: unknown = undefined
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        const rawText = await req.text()
        if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
          await server.close()
          return withCorsHeaders(
            req,
            new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32600,
                  message: 'Payload Too Large: Request body exceeds 256 KB limit.',
                  data: {
                    errorCode: 'PAYLOAD_TOO_LARGE',
                    remediation:
                      'Reduce the JSON-RPC request body size below 256 KB or split batch requests into smaller calls.',
                  },
                },
                id: null,
              }),
              {
                status: 413,
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-store',
                },
              }
            )
          )
        }
        if (rawText.trim().length > 0) {
          const rawJson = JSON.parse(rawText)
          parsedBody = bridgeHeadersIntoJsonRpcBody(rawJson, req, bearerToken)
        }
      } catch {
        // Let transport handle malformed JSON with standard JSON-RPC parse error
      }
    }

    const acceptHeader = req.headers.get('accept') || ''
    let normalizedReq = req
    if (!acceptHeader.includes('application/json') || !acceptHeader.includes('text/event-stream')) {
      const headers = new Headers(req.headers)
      headers.set('accept', 'application/json, text/event-stream')
      normalizedReq = new Request(req.url, {
        method: req.method,
        headers,
      })
    }

    const response = await transport.handleRequest(normalizedReq, { parsedBody })
    return withCorsHeaders(req, response)
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : 'Internal MCP gateway error'
    const safeMsg = redactSensitiveString(rawMsg)
    console.error('[/api/mcp POST] Unhandled error:', safeMsg)
    return withCorsHeaders(
      req,
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: safeMsg,
            data: {
              errorCode: 'INTERNAL_GATEWAY_ERROR',
              remediation:
                'Retry the request with a valid JSON-RPC 2.0 body or verify header formatting.',
            },
          },
          id: null,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      )
    )
  }
}

export async function GET(req: Request): Promise<Response> {
  return withCorsHeaders(
    req,
    new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message:
            'Method Not Allowed: Stateless Streamable HTTP MCP endpoint only accepts POST requests.',
          data: {
            errorCode: 'METHOD_NOT_ALLOWED',
            remediation:
              'Send JSON-RPC 2.0 requests via HTTP POST to https://agents.alchm.kitchen/api/mcp.',
          },
        },
        id: null,
      }),
      {
        status: 405,
        headers: {
          Allow: 'POST, OPTIONS',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    )
  )
}

export async function DELETE(req: Request): Promise<Response> {
  return withCorsHeaders(
    req,
    new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message:
            'Method Not Allowed: Stateless Streamable HTTP MCP endpoint does not maintain server-side sessions to delete.',
          data: {
            errorCode: 'METHOD_NOT_ALLOWED',
            remediation:
              'Stateless Streamable HTTP does not create server-side sessions; no DELETE teardown is needed.',
          },
        },
        id: null,
      }),
      {
        status: 405,
        headers: {
          Allow: 'POST, OPTIONS',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    )
  )
}
