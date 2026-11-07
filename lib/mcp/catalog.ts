/**
 * @file lib/mcp/catalog.ts
 *
 * Canonical tool catalog, JSON schemas, ESMS / x402 cost matrix, and honest
 * MCP tool annotations for the Planetary Agents MCP Server (`agents.alchm.kitchen`).
 *
 * Strictly enforces the PR #98 domain boundary: culinary tools remain on
 * `https://alchm.kitchen/api/mcp` (`@alchm/mcp-server@1.5.0`).
 */

export const PA_MCP_SERVER_NAME = 'planetary-agents-mcp-server'
export const PA_MCP_SERVER_VERSION = '1.5.0'
export const PA_MCP_PROTOCOL_VERSION = '2026-07-28'

export interface JsonSchema {
  type?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: string[]
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  additionalProperties?: boolean | JsonSchema
}

export const PA_TOOL_NAMES = [
  'match_historical_mentor',
  'inspect_agent_pvr_telemetry',
  'simulate_agent_dialogue',
  'convene_agent_council',
  'get_caller_allowance',
  'list_planetary_agents',
  'chat_with_planetary_agent',
  'trigger_chart_specific_jing_duel',
] as const

export type PaToolName = (typeof PA_TOOL_NAMES)[number]

export function isPaToolName(name: unknown): name is PaToolName {
  return typeof name === 'string' && (PA_TOOL_NAMES as readonly string[]).includes(name)
}

export const DELEGATED_CULINARY_TOOL_NAMES = new Set([
  'alchemize_ingredients',
  'generate_cosmic_recipe',
  'submit_recipe_reflection',
  'substitute_ingredient',
  'build_consolidated_grocery_list',
  'what_to_cook_now',
  'update_culinary_profile',
  'plan_weekly_menu',
  'publish_weekly_menu',
])

export interface EsmsCost {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export const PA_TOOL_COSTS: Record<PaToolName, EsmsCost | null> = {
  match_historical_mentor: null,
  inspect_agent_pvr_telemetry: null,
  simulate_agent_dialogue: null,
  get_caller_allowance: null,
  list_planetary_agents: null,
  convene_agent_council: { spirit: 2, essence: 2, matter: 1, substance: 1 },
  chat_with_planetary_agent: { spirit: 1, essence: 1, matter: 0, substance: 1 },
  trigger_chart_specific_jing_duel: { spirit: 1, essence: 1, matter: 1, substance: 0 },
}

export interface ToolAnnotations {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
}

export interface PaToolDefinition {
  name: PaToolName
  title: string
  description: string
  inputSchema: JsonSchema & { type: 'object' }
  outputSchema: JsonSchema & { type: 'object' }
  annotations: ToolAnnotations
}

const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  destructiveHint: false,
  openWorldHint: false,
}

const PAID_OR_MUTATING_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  idempotentHint: false,
  destructiveHint: false,
  openWorldHint: false,
}

const META_SCHEMA: JsonSchema = {
  type: 'object',
  description: 'Optional caller authentication, idempotency, and correlation metadata.',
  properties: {
    apiKey: { type: 'string', description: 'Bearer or Desktop API key.' },
    idempotencyKey: {
      type: 'string',
      description: 'Unique key for safe retry replay within 24 hours.',
    },
    correlationId: { type: 'string', description: 'Client trace or correlation identifier.' },
    caller: { type: 'string', description: 'Client identifier (e.g. meta-muse, cursor).' },
  },
  additionalProperties: true,
}

export const PA_TOOL_DEFINITIONS: PaToolDefinition[] = [
  {
    name: 'match_historical_mentor',
    title: 'Match Historical Mentor (Natal-Sky Bi-Wheel & PVR)',
    description:
      'Single-round-trip mentor recommender matching user natal placements, active sky transits, elemental focus, or query domain against the 71+ historical agent roster. Returns ranked mentors with Pentacle Vessel Ratings (25–99 OVR), earned Alchemical Seals, and Natal-Sky Bi-Wheel resonance.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Optional dilemma, topic, or wisdom domain (e.g. "astronomy and harmonic geometry", "stoic resilience", "poetic mysticism").',
        },
        element: {
          type: 'string',
          enum: ['Fire', 'Water', 'Earth', 'Air'],
          description: 'Optional elemental filter or emphasis.',
        },
        archetype: {
          type: 'string',
          description:
            'Optional archetype or role filter (e.g. "Philosopher", "Astronomer", "Mystic", "Strategist").',
        },
        userNatal: {
          type: 'object',
          description:
            'Optional user natal placements mapping planet names (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Ascendant) to { sign, degree }.',
          additionalProperties: true,
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          description: 'Number of top mentor matches to return (default: 3).',
        },
        _meta: META_SCHEMA,
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        timestamp: { type: 'string' },
        dominantElement: { type: 'string' },
        overallResonanceScore: { type: 'number' },
        surgeState: { type: 'object', additionalProperties: true },
        mentors: { type: 'array', items: { type: 'object', additionalProperties: true } },
        biWheelSummary: { type: 'object', additionalProperties: true },
      },
      required: ['ok', 'mentors', 'overallResonanceScore'],
      additionalProperties: true,
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'inspect_agent_pvr_telemetry',
    title: 'Inspect Agent PVR Telemetry (25–99 OVR, Seals, ECR & ESMS Diamond)',
    description:
      'Returns the complete Pentacle Vessel Rating (25–99 OVR), Sacred 7 stat ratings, relative advantage, earned Alchemical Seals (Copper to Celestial), 11-zone Effective Contest Ratings (ECR), and 4D ESMS Alchemical Diamond breakdown for one or more historical agents.',
    inputSchema: {
      type: 'object',
      properties: {
        agentSlug: {
          type: 'string',
          description:
            'Single historical agent slug or alias (e.g. "johannes-kepler", "socrates", "carl-jung", "rumi").',
        },
        agentSlugs: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 10,
          description: 'Array of historical agent slugs to inspect and compare.',
        },
        contestZoneId: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description:
            'Optional Pentacle Zone ID (0–10) to simulate a head-to-head ECR zone contest when 2+ agents are provided.',
        },
        _meta: META_SCHEMA,
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        scale: { type: 'object', additionalProperties: true },
        count: { type: 'number' },
        vessels: { type: 'array', items: { type: 'object', additionalProperties: true } },
        zoneContest: { type: 'object', additionalProperties: true },
      },
      required: ['ok', 'count', 'vessels'],
      additionalProperties: true,
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'simulate_agent_dialogue',
    title: 'Simulate Transit-Modulated Agent Dialogue',
    description:
      'Synthesizes transit-modulated persona parameters, Sacred 7 communication style vectors, active Natal-Sky Bi-Wheel aspects, dyadic synastry chords, and in-character perspective stances for 1–4 historical agents on a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The question, thesis, or dilemma for the agent(s) to address.',
        },
        agentSlugs: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 4,
          description:
            'Historical agent slugs (e.g. ["socrates", "johannes-kepler", "rumi"]). Defaults to ["socrates", "johannes-kepler"] if omitted.',
        },
        agentSlug: {
          type: 'string',
          description: 'Optional single historical agent slug convenience parameter.',
        },
        _meta: META_SCHEMA,
      },
      required: ['topic'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        topic: { type: 'string' },
        skyContext: { type: 'object', additionalProperties: true },
        synastryChords: { type: 'array', items: { type: 'object', additionalProperties: true } },
        perspectives: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
      required: ['ok', 'topic', 'perspectives'],
      additionalProperties: true,
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'convene_agent_council',
    title: 'Convene Multi-Agent Planetary Council',
    description:
      'Convening orchestrator that assembles 2–6 historical personas into a formal Planetary Council symposium with composite Pentacle Zone coverage, unlocked Council Seals, transit-modulated perspective vectors, and dialectical synthesis. Supports idempotent settlement receipts via _meta.idempotencyKey.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The core inquiry, dilemma, or thesis for council deliberation.',
        },
        agentSlugs: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 6,
          description: '2 to 6 historical agent slugs (e.g. ["socrates", "hypatia", "carl-jung"]).',
        },
        councilPreset: {
          type: 'string',
          description:
            'Optional preset id (e.g. "ancient-philosophers", "renaissance-masters", "modern-visionaries", "spiritual-mystics").',
        },
        _meta: META_SCHEMA,
      },
      required: ['topic'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        topic: { type: 'string' },
        councilOvr: { type: 'number' },
        unlockedCouncilSeals: { type: 'array', items: { type: 'string' } },
        perspectives: { type: 'array', items: { type: 'object', additionalProperties: true } },
        synthesis: { type: 'string' },
        billing: { type: 'object', additionalProperties: true },
      },
      required: ['ok', 'topic', 'councilOvr', 'perspectives', 'synthesis'],
      additionalProperties: true,
    },
    annotations: PAID_OR_MUTATING_ANNOTATIONS,
  },
  {
    name: 'get_caller_allowance',
    title: 'Get Caller Allowance, ESMS Balances & x402 Rails',
    description:
      'Pre-flight check for caller authentication tier, rate-limit RPM, ESMS token balances, x402 settlement rails (Circle Arc EIP-3009, Solana Constellation AMM, Base Sepolia), and cross-domain culinary bridge coordinates. Free read-only tool.',
    inputSchema: {
      type: 'object',
      properties: {
        _meta: META_SCHEMA,
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        authenticated: { type: 'boolean' },
        userId: { type: 'string' },
        authTier: { type: 'string' },
        rateLimitRpm: { type: 'number' },
        balances: { type: 'object', additionalProperties: true },
        toolCosts: { type: 'object', additionalProperties: true },
        x402Rails: { type: 'array', items: { type: 'object', additionalProperties: true } },
        culinaryBridgeUrl: { type: 'string' },
      },
      required: ['ok', 'authenticated', 'authTier', 'rateLimitRpm', 'balances'],
      additionalProperties: true,
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'list_planetary_agents',
    title: 'List & Search Planetary Agents Roster',
    description:
      'Search and filter the canonical historical agents roster by keyword query, zodiac Sun sign, dominant element, ruling planet faction, or minimum PVR OVR score. Free read-only tool.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search keyword matching name, title, era, or specialization.',
        },
        sign: {
          type: 'string',
          description: 'Optional natal Sun zodiac sign filter (e.g. "Capricorn", "Aries").',
        },
        element: {
          type: 'string',
          enum: ['Fire', 'Water', 'Earth', 'Air'],
          description: 'Optional dominant element filter.',
        },
        archetype: {
          type: 'string',
          description: 'Optional archetype or role filter.',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description: 'Maximum number of agents to return (default: 25).',
        },
        _meta: META_SCHEMA,
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        count: { type: 'number' },
        agents: { type: 'array', items: { type: 'object', additionalProperties: true } },
        filters: { type: 'object', additionalProperties: true },
      },
      required: ['ok', 'count', 'agents'],
      additionalProperties: true,
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'chat_with_planetary_agent',
    title: 'Chat with Planetary Agent Persona',
    description:
      'Converse directly with a historical persona grounded in live sky transits, natal chart placements, and Sacred 7 communication syntax.',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'Agent slug or name (e.g. "socrates", "johannes-kepler", "rumi").',
        },
        message: {
          type: 'string',
          description: 'Message or question for the agent.',
        },
        sessionId: {
          type: 'string',
          description: 'Optional conversation session ID.',
        },
        _meta: META_SCHEMA,
      },
      required: ['agentName', 'message'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        agentId: { type: 'string' },
        agentName: { type: 'string' },
        text: { type: 'string' },
        pvrOvr: { type: 'number' },
        liveSkyState: { type: 'object', additionalProperties: true },
      },
      required: ['ok', 'agentId', 'agentName', 'text'],
      additionalProperties: true,
    },
    annotations: PAID_OR_MUTATING_ANNOTATIONS,
  },
  {
    name: 'trigger_chart_specific_jing_duel',
    title: 'Trigger Chart-Specific Jing Arena Duel',
    description:
      'Compute birthchart synastry aspects between two historical agents and trigger an elemental Jing Arena clash (Meltdown, Freeze, TectonicRoot, Vacuum, Erode) with in-character battle lines and Pentacle Zone contest resolution.',
    inputSchema: {
      type: 'object',
      properties: {
        casterName: {
          type: 'string',
          description: 'Initiating historical agent slug or name (e.g. "johannes-kepler").',
        },
        targetName: {
          type: 'string',
          description: 'Defending historical agent slug or name (e.g. "galileo-galilei").',
        },
        zoneId: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description:
            'Optional Pentacle Zone ID (0–10) contested in the duel (default: 10 Crown).',
        },
        _meta: META_SCHEMA,
      },
      required: ['casterName', 'targetName'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        triggered: { type: 'boolean' },
        caster: { type: 'string' },
        target: { type: 'string' },
        moveName: { type: 'string' },
        element: { type: 'string' },
        aspect: { type: 'object', additionalProperties: true },
        zoneContest: { type: 'object', additionalProperties: true },
        casterVoice: { type: 'string' },
        targetVoice: { type: 'string' },
      },
      required: ['ok', 'triggered'],
      additionalProperties: true,
    },
    annotations: PAID_OR_MUTATING_ANNOTATIONS,
  },
]
