/**
 * @file lib/mcp/openapiBridge.ts
 *
 * OpenAPI 3.1.0 specification generator and REST tool execution bridge
 * for Custom GPT Actions, Google Vertex AI Extensions, Gemini Function Calling,
 * and webhook-based autonomous agents calling `agents.alchm.kitchen`.
 */

import {
  DELEGATED_CULINARY_TOOL_NAMES,
  PA_MCP_SERVER_VERSION,
  PA_TOOL_COSTS,
  PA_TOOL_DEFINITIONS,
  isPaToolName,
  type PaToolDefinition,
} from './catalog'
import {
  MAX_BODY_BYTES,
  buildDiscoveryCorsHeaders,
  buildMcpCorsHeaders,
  getTrustedOrigin,
  isAllowedMcpOrigin,
  redactSensitiveString,
  sanitizeHeaderInput,
} from './httpSecurity'
import { invokePaTool } from './tools'

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function totalEsmsForPaTool(name: PaToolDefinition['name']): number {
  const cost = PA_TOOL_COSTS[name]
  if (!cost) return 0
  return cost.spirit + cost.essence + cost.matter + cost.substance
}

function buildOperationForPaTool(tool: PaToolDefinition): Record<string, unknown> {
  const totalEsms = totalEsmsForPaTool(tool.name)
  const isReadOnlyFree = tool.annotations.readOnlyHint && totalEsms === 0
  const costBadge =
    totalEsms > 0
      ? `[Cost: ${totalEsms} ESMS — Requires Authorization: Bearer sk_alchm_...]`
      : '[Cost: 0 ESMS — Free Tier, API key optional]'

  return {
    operationId: tool.name,
    summary: tool.title,
    description: `${tool.description} ${costBadge}`,
    'x-esms-cost': totalEsms,
    'x-read-only': tool.annotations.readOnlyHint,
    security: isReadOnlyFree ? [{}, { BearerAuth: [] }] : [{ BearerAuth: [] }],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: tool.inputSchema,
        },
      },
    },
    responses: {
      '200': {
        description: `${tool.title} structured response`,
        content: {
          'application/json': {
            schema: tool.outputSchema,
          },
        },
      },
      '400': { description: 'Invalid arguments or domain boundary violation' },
      '401': { description: 'Missing or invalid Bearer API key' },
      '402': { description: 'Insufficient ESMS balance' },
      '404': { description: 'Unknown tool or historical persona slug' },
      '429': { description: 'Rate limit exceeded' },
    },
  }
}

export function buildPaMcpOpenApiSpec(req: Request): Record<string, unknown> {
  const origin = getTrustedOrigin(req)
  const paths: Record<string, unknown> = {}

  for (const tool of PA_TOOL_DEFINITIONS) {
    paths[`/api/mcp/rest/${tool.name}`] = {
      post: buildOperationForPaTool(tool),
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Planetary Agents (agents.alchm.kitchen) REST Tool Bridge',
      version: PA_MCP_SERVER_VERSION,
      description:
        'OpenAPI 3.1.0 REST bridge exposing the 8 Planetary Agents MCP tools (72 historical mentors, Natal-Sky Bi-Wheel resonance, Pentacle Vessel Ratings 25–99 OVR, 7 Seals, 11-zone ECR, 4D ESMS diamond, and multi-agent council deliberation). 5 read-only tools are Free (0 ESMS, no API key required); metered/stateful tools (convene_agent_council, chat_with_planetary_agent, trigger_chart_specific_jing_duel) require Authorization: Bearer sk_alchm_... Culinary tools live at https://alchm.kitchen/api/mcp/openapi.json.',
    },
    servers: [
      {
        url: origin,
        description: 'Planetary Agents Production MCP & REST Gateway',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'sk_alchm_*',
          description:
            'Optional on 0-ESMS readOnlyHint: true tools; required on metered ESMS / x402 tools.',
        },
      },
    },
    paths,
  }
}

export function mapPaErrorCodeToHttpStatus(errorCode?: string, errorMessage?: string): number {
  switch (errorCode) {
    case 'MISSING_AGENT_SLUG':
    case 'MISSING_TOPIC':
    case 'MISSING_ARGUMENTS':
    case 'INVALID_ARGS':
    case 'CULINARY_DOMAIN_BOUNDARY':
      return 400
    case 'AUTH_CONFLICT_OR_INVALID':
      return errorMessage?.includes('Conflicting') ? 409 : 401
    case 'UNAUTHORIZED':
      return 401
    case 'QUOTA':
      return 402
    case 'PERSONA_NOT_FOUND':
    case 'UNKNOWN_TOOL':
    case 'NOT_FOUND':
      return 404
    case 'CONFLICT':
      return 409
    case 'RATE_LIMIT':
      return 429
    default:
      return 500
  }
}

function extractBearer(req: Request): string | undefined {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return undefined
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const rawToken = match?.[1]?.trim()
  if (!rawToken) return undefined
  return sanitizeHeaderInput(rawToken, 256)
}

function restJsonResponse(
  req: Request,
  status: number,
  payload: Record<string, unknown>,
  isDiscovery = false
): Response {
  const cors = isDiscovery ? buildDiscoveryCorsHeaders(req) : buildMcpCorsHeaders(req)
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': isDiscovery ? 'public, max-age=300' : 'no-store',
      ...cors,
    },
  })
}

export async function executePaRestToolCall(toolName: string, req: Request): Promise<Response> {
  const origin = req.headers.get('origin')
  if (origin && !isAllowedMcpOrigin(origin)) {
    return restJsonResponse(req, 403, {
      errorCode: 'FORBIDDEN_ORIGIN',
      message: 'Forbidden: Untrusted Origin header.',
      remediation:
        'Call from a trusted web agent origin or invoke server-to-server without a browser Origin header.',
    })
  }

  if (!isPaToolName(toolName) && !DELEGATED_CULINARY_TOOL_NAMES.has(toolName)) {
    return restJsonResponse(req, 404, {
      errorCode: 'UNKNOWN_TOOL',
      message: `Unknown Planetary Agents tool: '${toolName}'.`,
      remediation:
        'Fetch GET /api/mcp/openapi.json to inspect valid Planetary Agents operationIds.',
    })
  }

  try {
    const rawText = await req.text()
    if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
      return restJsonResponse(req, 413, {
        errorCode: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds 256 KB limit.',
        remediation: 'Reduce the JSON payload size below 256 KB.',
      })
    }

    const parsed: unknown = rawText.trim() ? JSON.parse(rawText) : {}
    if (!isRecord(parsed)) {
      return restJsonResponse(req, 400, {
        errorCode: 'INVALID_ARGS',
        message: 'Request body must be a JSON object.',
        remediation: "Send a JSON object matching the tool's inputSchema.",
      })
    }

    const args: Record<string, unknown> = { ...parsed }
    const meta: Record<string, unknown> = isRecord(args._meta) ? { ...args._meta } : {}

    const idempotencyHeader = sanitizeHeaderInput(req.headers.get('idempotency-key'), 128)
    if (idempotencyHeader && !meta.idempotencyKey) {
      meta.idempotencyKey = idempotencyHeader
    }
    const correlationId = sanitizeHeaderInput(req.headers.get('x-correlation-id'), 128)
    if (correlationId && !meta.correlationId) {
      meta.correlationId = correlationId
    }
    if (Object.keys(meta).length > 0) {
      args._meta = meta
    }

    const bearerToken = extractBearer(req)
    const result = await invokePaTool(toolName, args, {
      bearerToken,
      correlationId: correlationId || undefined,
    })

    if (result.ok) {
      return restJsonResponse(req, 200, result.payload)
    }

    const errCode =
      typeof result.payload.errorCode === 'string' ? result.payload.errorCode : 'INTERNAL'
    const errMsg =
      typeof result.payload.error === 'string' ? result.payload.error : 'Tool execution failed.'
    const status = mapPaErrorCodeToHttpStatus(errCode, errMsg)

    return restJsonResponse(req, status, {
      ...result.payload,
      message: errMsg,
    })
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Malformed JSON request body'
    return restJsonResponse(req, 400, {
      errorCode: 'INVALID_ARGS',
      message: redactSensitiveString(rawMsg),
      remediation: "Ensure the POST body is valid JSON matching the tool's inputSchema.",
    })
  }
}
