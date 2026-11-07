import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { DELEGATED_CULINARY_TOOL_NAMES, PA_TOOL_COSTS, PA_TOOL_DEFINITIONS } from './catalog'
import { getPrompt, PA_MCP_PROMPTS } from './prompts'
import {
  getPersonaCompletionCandidates,
  getSanctumCompletionCandidates,
  PA_MCP_RESOURCES,
  PA_MCP_RESOURCE_TEMPLATES,
  readResource,
} from './resources'
import { invokePaTool } from './tools'

export interface CreateServerOptions {
  defaultApiKey?: string
  defaultSessionToken?: string
  serverName?: string
  serverVersion?: string
}

const ARCHETYPE_CANDIDATES = [
  'Philosopher',
  'Astronomer',
  'Mystic',
  'Strategist',
  'Polymath',
  'Poet',
  'The Sovereign Flame',
  'The Harmonic Weaver',
  'The Astral Sage',
  'The Radiant Envoy',
  'The Liminal Oracle',
  'The Mercurial Shifter',
  'The Earthbound Bastion',
] as const

const ELEMENT_CANDIDATES = ['Fire', 'Water', 'Earth', 'Air'] as const

/**
 * Shared Planetary Agents MCP Server Factory (`pa-mcp` v1.5.0).
 *
 * Powers both:
 * 1. The local stdio & Tauri sidecar binary (`pa-mcp` via `mcp/index.ts`)
 * 2. The stateless Next.js App Router Streamable HTTP gateway (`app/api/mcp/route.ts` on `agents.alchm.kitchen`)
 */
export function createPlanetaryAgentsMcpServer(options: CreateServerOptions = {}): Server {
  const server = new Server(
    {
      name: options.serverName ?? 'pa-mcp',
      version: options.serverVersion ?? '1.5.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
        completions: {},
      },
    }
  )

  // ── 1. TOOLS ──────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: PA_TOOL_DEFINITIONS.map(tool => {
        const cost = PA_TOOL_COSTS[tool.name]
        const costTotal = cost ? cost.spirit + cost.essence + cost.matter + cost.substance : 0
        const maxTier = costTotal > 0 ? 'standard' : 'free'
        return {
          name: tool.name,
          title: tool.title,
          description: `${tool.description} [Cost: ${costTotal} ESMS | Max Tier: ${maxTier}]`,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          annotations: tool.annotations,
        }
      }),
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const toolName = request.params.name
    const args = (request.params.arguments as Record<string, unknown>) ?? {}

    const isKnownTool = PA_TOOL_DEFINITIONS.some(t => t.name === toolName)
    const isDelegatedCulinary = DELEGATED_CULINARY_TOOL_NAMES.has(toolName)

    if (!isKnownTool && !isDelegatedCulinary) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown tool: ${toolName}. Call tools/list to inspect available Planetary Agents tools on agents.alchm.kitchen.`
      )
    }

    const result = await invokePaTool(toolName, args, {
      bearerToken: options.defaultApiKey || options.defaultSessionToken,
    })

    if (!result.ok) {
      return {
        isError: true,
        structuredContent: result.payload,
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.payload, null, 2),
          },
        ],
      }
    }

    return {
      structuredContent: result.payload,
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.payload, null, 2),
        },
      ],
    }
  })

  // ── 2. PROMPTS ────────────────────────────────────────────────────────
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: PA_MCP_PROMPTS,
    }
  })

  server.setRequestHandler(GetPromptRequestSchema, async request => {
    const promptResult = getPrompt(
      request.params.name,
      request.params.arguments as Record<string, string> | undefined
    )
    if (!promptResult) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown prompt: ${request.params.name}. Available prompts: ${PA_MCP_PROMPTS.map(p => p.name).join(', ')}.`
      )
    }
    return promptResult
  })

  // ── 3. RESOURCES & RFC 6570 RESOURCE TEMPLATES ────────────────────────
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: PA_MCP_RESOURCES,
    }
  })

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return {
      resourceTemplates: PA_MCP_RESOURCE_TEMPLATES,
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const resourceContent = await readResource(request.params.uri)
    if (!resourceContent) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown resource URI: ${request.params.uri}. Inspect resources/list or resources/templates/list for valid URIs.`
      )
    }
    return resourceContent
  })

  // ── 4. AUTOCOMPLETE (completion/complete) ─────────────────────────────
  server.setRequestHandler(CompleteRequestSchema, async request => {
    const { ref, argument } = request.params
    const query = (argument?.value ?? '').trim().toLowerCase()

    if (ref.type === 'ref/resource') {
      if (ref.uri.startsWith('agents://persona/')) {
        const values = getPersonaCompletionCandidates(query)
        return {
          completion: {
            values,
            total: values.length,
            hasMore: false,
          },
        }
      }
      if (ref.uri.startsWith('agents://sanctum/')) {
        const values = getSanctumCompletionCandidates(query)
        return {
          completion: {
            values,
            total: values.length,
            hasMore: false,
          },
        }
      }
    }

    if (ref.type === 'ref/prompt') {
      if (argument.name === 'agentSlug' || argument.name === 'agentSlugs') {
        const values = getPersonaCompletionCandidates(query)
        return {
          completion: {
            values,
            total: values.length,
            hasMore: false,
          },
        }
      }
      if (argument.name === 'element') {
        const values = ELEMENT_CANDIDATES.filter(e => e.toLowerCase().startsWith(query))
        return {
          completion: {
            values: [...values],
            total: values.length,
            hasMore: false,
          },
        }
      }
      if (argument.name === 'archetype') {
        const values = ARCHETYPE_CANDIDATES.filter(a => a.toLowerCase().includes(query))
        return {
          completion: {
            values: [...values],
            total: values.length,
            hasMore: false,
          },
        }
      }
    }

    return {
      completion: {
        values: [],
        total: 0,
        hasMore: false,
      },
    }
  })

  return server
}

export const createPaMcpServer = createPlanetaryAgentsMcpServer
