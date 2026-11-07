import { PA_TOOL_COSTS, PA_TOOL_DEFINITIONS } from '@/lib/mcp/catalog'
import {
  buildDiscoveryCorsHeaders,
  getTrustedOrigin,
  isAllowedMcpOrigin,
} from '@/lib/mcp/httpSecurity'
import { PA_MCP_PROMPTS } from '@/lib/mcp/prompts'
import { PA_MCP_RESOURCES, PA_MCP_RESOURCE_TEMPLATES } from '@/lib/mcp/resources'

export const dynamic = 'force-dynamic'

/**
 * Meta Muse Connector Discovery Manifest (`/.well-known/muse/connector.json`)
 *
 * Exposes Planetary Agents (`agents.alchm.kitchen`) remote Streamable HTTP MCP
 * endpoint, capabilities, authentication schemes, and tool/prompt/resource catalog
 * for one-click agent onboarding.
 */
export async function GET(req: Request): Promise<Response> {
  const origin = getTrustedOrigin(req)

  const manifest = {
    schema_version: '1.0',
    id: 'io.github.gregcastro23.planetary-agents',
    name: 'Planetary Agents (Alchm Kitchen)',
    short_description:
      '72 historical mentor agents, Natal-Sky Bi-Wheel resonance, Pentacle Vessel Ratings (25-99 OVR, Seals, ECR, ESMS diamond), and multi-agent council deliberation.',
    description:
      'Connect Meta Muse or any MCP client to Planetary Agents (agents.alchm.kitchen). Match natal charts and live celestial transits against 72 crafted historical personas, inspect Pentacle Vessel Ratings (25-99 OVR, 7 Seals, Elemental-Celestial Resonance, ESMS diamond telemetry), and convene multi-agent council deliberations. Culinary recipe execution is strictly separated onto https://alchm.kitchen/api/mcp (@alchm/mcp-server@1.5.0).',
    version: '1.5.0',
    homepage_url: origin,
    documentation_url: `${origin}/integrations`,
    privacy_policy_url: `${origin}/privacy`,
    terms_of_service_url: `${origin}/terms`,
    logo_url: `${origin}/favicon.ico`,
    contact_email: 'support@alchm.kitchen',
    mcp: {
      transport: 'streamable-http',
      endpoint: `${origin}/api/mcp`,
      protocol_version: '2025-03-26',
      stateless: true,
      capabilities: {
        tools: true,
        prompts: true,
        resources: true,
        resource_templates: true,
        completions: true,
      },
    },
    sibling_connectors: [
      {
        id: 'io.github.gregcastro23.alchm-kitchen',
        name: 'Alchm.kitchen Culinary Engine (@alchm/mcp-server)',
        endpoint: 'https://alchm.kitchen/api/mcp',
        npm_package: '@alchm/mcp-server@1.5.0',
        domain: 'Culinary recipes, ESMS nutrition telemetry, and ingredient-to-recipe synthesis',
      },
    ],
    authentication: {
      supported_types: ['none', 'bearer'],
      default_type: 'none',
      free_tier_available: true,
      bearer: {
        header: 'Authorization',
        scheme: 'Bearer',
        token_prefix: 'alchm_',
        registration_url: `${origin}/settings/api-keys`,
        instructions:
          'Read-only tools (list_planetary_agents, match_historical_mentor, inspect_agent_pvr_telemetry, simulate_agent_dialogue, get_caller_allowance), prompts, and resources work immediately with zero authentication on the Free tier. For higher RPM or paid x402 / ESMS tools (convene_agent_council, chat_with_planetary_agent, trigger_chart_specific_jing_duel), pass an Alchm API key via Authorization: Bearer <api_key>.',
      },
    },
    tools: PA_TOOL_DEFINITIONS.map(t => {
      const cost = PA_TOOL_COSTS[t.name]
      const costTotal = cost ? cost.spirit + cost.essence + cost.matter + cost.substance : 0
      return {
        name: t.name,
        title: t.title,
        description: t.description,
        esms_cost: costTotal,
        max_tier: costTotal > 0 ? 'standard' : 'free',
        read_only: Boolean(t.annotations.readOnlyHint),
        idempotent: Boolean(t.annotations.idempotentHint),
      }
    }),
    prompts: PA_MCP_PROMPTS.map(p => ({
      name: p.name,
      description: p.description,
    })),
    resources: PA_MCP_RESOURCES.map(r => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
    })),
    resource_templates: PA_MCP_RESOURCE_TEMPLATES.map(rt => ({
      uri_template: rt.uriTemplate,
      name: rt.name,
      description: rt.description,
    })),
  }

  return new Response(JSON.stringify(manifest, null, 2), {
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
