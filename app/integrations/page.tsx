import Link from 'next/link'

export const metadata = {
  title: 'Connect Your Agent — MCP & OpenAPI Hub | Planetary Agents',
  description:
    'Connect Google Gemini, Claude Desktop, OpenAI Responses API, Custom GPTs, Cursor, or Meta Muse to Planetary Agents (agents.alchm.kitchen) via Streamable HTTP MCP and OpenAPI 3.1.0.',
}

const GEMINI_CLI_SNIPPET = `{
  "mcpServers": {
    "planetary-agents": {
      "httpUrl": "https://agents.alchm.kitchen/api/mcp",
      "headers": {
        "Authorization": "Bearer sk_alchm_live_…"
      }
    },
    "alchm-kitchen": {
      "httpUrl": "https://alchm.kitchen/api/mcp",
      "headers": {
        "Authorization": "Bearer sk_alchm_live_…"
      }
    }
  }
}`

const GEMINI_PYTHON_SNIPPET = `from google import genai
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

# 5 read-only tools & all resources work with zero API key on the Free tier
async with streamablehttp_client("https://agents.alchm.kitchen/api/mcp") as (r, w, _):
    async with ClientSession(r, w) as session:
        await session.initialize()
        client = genai.Client()
        res = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents="Match me with an Earth-element historical mentor for geometric astronomy and inspect their PVR 25-99 OVR.",
            config=genai.types.GenerateContentConfig(tools=[session]),
        )
        print(res.text)`

const ANTHROPIC_SNIPPET = `curl https://api.anthropic.com/v1/messages \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "anthropic-beta: mcp-client-2025-04-04" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "mcp_servers": [
      {
        "type": "url",
        "url": "https://agents.alchm.kitchen/api/mcp",
        "name": "planetary-agents",
        "authorization_token": "sk_alchm_live_..."
      },
      {
        "type": "url",
        "url": "https://alchm.kitchen/api/mcp",
        "name": "alchm-kitchen",
        "authorization_token": "sk_alchm_live_..."
      }
    ],
    "messages": [{"role": "user", "content": "Compare Johannes Kepler and Socrates across Pentacle Zone 1 and simulate a dialogue."}]
  }'`

const OPENAI_SNIPPET = `import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4.1",
  tools: [
    {
      type: "mcp",
      server_label: "planetary_agents",
      server_url: "https://agents.alchm.kitchen/api/mcp",
      require_approval: "never",
    },
    {
      type: "mcp",
      server_label: "alchm_kitchen",
      server_url: "https://alchm.kitchen/api/mcp",
      headers: { Authorization: "Bearer sk_alchm_live_..." },
      require_approval: "never",
    },
  ],
  input: "Find my top historical mentor for today's transits and inspect their Alchemical Seals.",
});`

const MUSE_SNIPPET = `{
  "mcp_servers": {
    "planetary-agents": {
      "url": "https://agents.alchm.kitchen/api/mcp",
      "headers": {
        "Authorization": "Bearer sk_alchm_live_…"
      }
    },
    "alchm-kitchen": {
      "url": "https://alchm.kitchen/api/mcp",
      "headers": {
        "Authorization": "Bearer sk_alchm_live_…"
      }
    }
  }
}`

const TOOLS = [
  {
    name: 'match_historical_mentor',
    tier: 'Free (0 ESMS)',
    readOnly: true,
    desc: 'Single-round-trip mentor recommender matching user natal placements, active sky transits, or query domain against 72 historical vessels.',
  },
  {
    name: 'inspect_agent_pvr_telemetry',
    tier: 'Free (0 ESMS)',
    readOnly: true,
    desc: 'Full 25–99 OVR, Sacred 7 stats, 7 Alchemical Seals, 11-zone Effective Contest Ratings (ECR), 4D ESMS diamond, and head-to-head zone contests.',
  },
  {
    name: 'simulate_agent_dialogue',
    tier: 'Free (0 ESMS)',
    readOnly: true,
    desc: 'Synthesizes transit-modulated persona syntax and inter-chart synastry chords for 1–4 historical thinkers.',
  },
  {
    name: 'get_caller_allowance',
    tier: 'Free (0 ESMS)',
    readOnly: true,
    desc: 'Pre-flight check returning caller authentication tier, RPM rate limit, ESMS token balances, and tool cost schedule.',
  },
  {
    name: 'list_planetary_agents',
    tier: 'Free (0 ESMS)',
    readOnly: true,
    desc: 'Filterable catalog of 72 historical vessels with ruling planet faction, dominant element, and PVR OVR summary.',
  },
  {
    name: 'convene_agent_council',
    tier: 'Metered (6 ESMS)',
    readOnly: false,
    desc: 'Multi-agent council deliberation with dialectical synthesis, Pentacle Zone ECR ranking, and 24h idempotency replay.',
  },
  {
    name: 'chat_with_planetary_agent',
    tier: 'Metered (3 ESMS)',
    readOnly: false,
    desc: 'Direct transit-aware consultation with any historical or planetary agent.',
  },
  {
    name: 'trigger_chart_specific_jing_duel',
    tier: 'Metered (3 ESMS)',
    readOnly: false,
    desc: 'Triggers an astrological Jing Arena duel between two vessels with deterministic Pentacle Zone contest resolution.',
  },
]

export default function IntegrationsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-14 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="space-y-4 border-b border-slate-800 pb-8">
          <div className="text-xs uppercase tracking-widest text-amber-400 font-mono">
            MCP v1.5.0 Streamable HTTP + OpenAPI 3.1.0 REST Bridge
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Connect Gemini, Claude, OpenAI &amp; Meta Muse
          </h1>
          <p className="text-slate-300 text-base leading-relaxed">
            Ground your AI agents in live celestial transits, 72 historical mentor personas,
            Natal-Sky Bi-Wheel resonance, and Pentacle Vessel Ratings (25–99 OVR). Five read-only
            tools and all static &amp; RFC 6570 resources work with{' '}
            <strong className="text-white">zero authentication on the Free Tier</strong>; pass{' '}
            <code className="text-amber-300">Authorization: Bearer sk_alchm_...</code> for metered
            multi-agent council synthesis or higher rate limits (up to 300 RPM).
          </p>
          <div className="flex flex-wrap gap-3 pt-2 text-xs font-mono">
            <a
              href="/api/mcp/openapi.json"
              className="px-3 py-1.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-300 hover:bg-amber-500/25"
            >
              GET /api/mcp/openapi.json
            </a>
            <a
              href="/.well-known/muse/connector.json"
              className="px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 hover:border-slate-500"
            >
              GET /.well-known/muse/connector.json
            </a>
            <Link
              href="/desktop"
              className="px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 hover:border-slate-500"
            >
              Tauri Desktop Sidecar (pa-mcp) →
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            Tool Catalog: Free Read-Only vs. Metered ESMS Tiers
          </h2>
          <p className="text-sm text-slate-400">
            Culinary execution tools (<code>what_to_cook_now</code> — 10 ESMS,{' '}
            <code>generate_cosmic_recipe</code> — 10 ESMS, and 8 free culinary/ingredient tools) are
            hosted on our sibling gateway at{' '}
            <a
              href="https://alchm.kitchen/docs/mcp"
              className="text-amber-400 underline"
              target="_blank"
              rel="noreferrer"
            >
              https://alchm.kitchen/api/mcp
            </a>
            .
          </p>
          <div className="grid gap-3">
            {TOOLS.map(t => (
              <div
                key={t.name}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-lg bg-slate-900/70 border border-slate-800"
              >
                <div>
                  <div className="font-mono text-sm text-amber-300">{t.name}</div>
                  <div className="text-xs text-slate-300 mt-1">{t.desc}</div>
                </div>
                <span
                  className={`text-xs font-mono px-2.5 py-1 rounded border whitespace-nowrap ${
                    t.readOnly
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                  }`}
                >
                  {t.tier}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            1. Google Gemini CLI / Antigravity &amp; Google ADK (google-genai)
          </h2>
          <p className="text-sm text-slate-300">
            Add to <code>~/.gemini/settings.json</code> or invoke directly from Python with{' '}
            <code>google-genai</code>:
          </p>
          <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono overflow-x-auto">
            <code>{GEMINI_CLI_SNIPPET}</code>
          </pre>
          <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono overflow-x-auto">
            <code>{GEMINI_PYTHON_SNIPPET}</code>
          </pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            2. Claude Desktop &amp; Anthropic Messages API (mcp_servers)
          </h2>
          <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono overflow-x-auto">
            <code>{ANTHROPIC_SNIPPET}</code>
          </pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            3. OpenAI Responses API &amp; Custom GPT Actions (OpenAPI 3.1.0)
          </h2>
          <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono overflow-x-auto">
            <code>{OPENAI_SNIPPET}</code>
          </pre>
          <p className="text-sm text-slate-300">
            For <strong>Custom GPT Actions</strong> or <strong>Google Vertex AI Extensions</strong>,
            import <code>https://agents.alchm.kitchen/api/mcp/openapi.json</code> (and{' '}
            <code>https://alchm.kitchen/api/mcp/openapi.json</code> for culinary tools). Each tool
            executes via <code>POST /api/mcp/rest/[toolName]</code> and returns unwrapped JSON.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            4. Meta Muse (~/.config/muse/settings.json)
          </h2>
          <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono overflow-x-auto">
            <code>{MUSE_SNIPPET}</code>
          </pre>
        </section>
      </div>
    </main>
  )
}
