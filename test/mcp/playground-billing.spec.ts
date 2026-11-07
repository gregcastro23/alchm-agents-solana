import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mcp/playground/route'
import {
  MCP_V140_TOOL_CATALOG,
  buildX402PaymentPreview,
  getMcpToolDefinition,
  normalizeMcpBillingReceipt,
  prepareMcpArguments,
  rateMcpToolReadiness,
} from '@/lib/mcp/playground-catalog'

describe('@alchm/mcp-server@1.5.0 playground catalog & billing normalization', () => {
  it('exposes the exact 13 canonical v1.5.0 tools with valid PVR (25–99) readiness scores', () => {
    expect(MCP_V140_TOOL_CATALOG).toHaveLength(13)
    const names = MCP_V140_TOOL_CATALOG.map(t => t.name)
    expect(names).toEqual([
      'get_live_sky_transits',
      'alchemize_ingredients',
      'generate_cosmic_recipe',
      'compute_synastry_overlay',
      'get_transit_natal_overlay',
      'compute_triplicate_synastry',
      'create_evidence_snapshot',
      'submit_recipe_reflection',
      'get_user_allowance',
      'substitute_ingredient',
      'build_consolidated_grocery_list',
      'what_to_cook_now',
      'update_culinary_profile',
    ])

    for (const tool of MCP_V140_TOOL_CATALOG) {
      const rated = rateMcpToolReadiness(tool)
      expect(rated.ovr).toBeGreaterThanOrEqual(25)
      expect(rated.ovr).toBeLessThanOrEqual(99)
      expect(rated.archetype.title.length).toBeGreaterThan(0)
      expect(getMcpToolDefinition(tool.name)?.name).toBe(tool.name)
    }
  })

  it('forwards _meta.idempotencyKey while preserving existing _meta fields', () => {
    const prepared = prepareMcpArguments(
      { agentId: 'johannes-kepler', _meta: { caller: 'web-playground' } },
      'idem_test_123'
    )
    expect(prepared).toEqual({
      agentId: 'johannes-kepler',
      _meta: {
        caller: 'web-playground',
        idempotencyKey: 'idem_test_123',
      },
    })
  })

  it('normalizes charged vs replayed billing receipts identically to backend/alchm_mcp.py', () => {
    const charged = normalizeMcpBillingReceipt({
      status: 'charged',
      amounts: { spirit: 3, essence: 3, matter: 2, substance: 2 },
      idempotencyKey: 'idem_recipe_1',
      rail: 'arc-eip3009',
      x402AtomicUsdc: '15000',
      txReference: '0xarc_1234',
      settledAt: '2026-11-04T18:00:00Z',
    })
    expect(charged.debited).toBe(true)
    expect(charged.replayed).toBe(false)
    expect(charged.cost).toEqual({ spirit: 3, essence: 3, matter: 2, substance: 2 })
    expect(charged.x402AtomicUsdc).toBe('15000')

    const replayed = normalizeMcpBillingReceipt({
      status: 'replayed',
      amounts: { spirit: 3, essence: 3, matter: 2, substance: 2 },
      idempotencyKey: 'idem_recipe_1',
      rail: 'arc-eip3009',
      x402AtomicUsdc: '15000',
      txReference: '0xarc_1234',
      settledAt: '2026-11-04T18:00:05Z',
    })
    expect(replayed.debited).toBe(false)
    expect(replayed.replayed).toBe(true)
    expect(replayed.cost).toEqual({ spirit: 0, essence: 0, matter: 0, substance: 0 })
    expect(replayed.x402AtomicUsdc).toBe('0')
  })

  it('builds x402 payment header previews across Arc, Solana AMM, and Base Sepolia rails', () => {
    const tool = MCP_V140_TOOL_CATALOG[0]
    const arcPreview = buildX402PaymentPreview(tool, 'arc-eip3009', 'idem_1')
    expect(arcPreview.network).toBe('eip155:5042002')
    expect(arcPreview.resource).toBe('mcp://alchm-agents/tools/get_live_sky_transits')

    const solPreview = buildX402PaymentPreview(tool, 'solana-amm', 'idem_1')
    expect(solPreview.network).toBe('solana:mainnet-beta')

    const basePreview = buildX402PaymentPreview(tool, 'base-x402', 'idem_1')
    expect(basePreview.network).toBe('eip155:84532')
  })

  it('survives serverless cold-start replays via seenIdempotencyKeys or alchm_mcp_idem_keys cookie', async () => {
    const req = new Request('http://localhost:3000/api/mcp/playground', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'alchm_mcp_idem_keys=get_live_sky_transits%3A%3Aidem_coldstart_cookie',
      },
      body: JSON.stringify({
        tool: 'get_live_sky_transits',
        idempotencyKey: 'idem_coldstart_cookie',
        settlementRail: 'arc-eip3009',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.billing.status).toBe('replayed')
    expect(json.billing.debited).toBe(false)
    expect(json.billing.replayed).toBe(true)
    expect(json.billing.cost).toEqual({ spirit: 0, essence: 0, matter: 0, substance: 0 })
    expect(res.headers.get('Set-Cookie')).toContain('alchm_mcp_idem_keys=')
  })

  it('proxies culinary tools to upstream alchm.kitchen with Accept: application/json, text/event-stream and handles JSON responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'upstream_1',
          result: {
            structuredContent: {
              ok: true,
              ingredient: 'buttermilk',
              substitutes: [{ name: 'soy milk + lemon juice', ratio: '1:1' }],
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )

    const req = new Request('http://localhost:3000/api/mcp/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'substitute_ingredient',
        arguments: { ingredient: 'buttermilk', dishContext: 'pancakes' },
        idempotencyKey: 'idem_sub_test',
        settlementRail: 'arc-eip3009',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.result.substitutes).toHaveLength(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/mcp')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Accept']).toBe(
      'application/json, text/event-stream'
    )
    fetchSpy.mockRestore()
  })

  it('unpacks SSE text/event-stream responses from upstream alchm.kitchen for culinary tools', async () => {
    const ssePayload =
      'event: message\ndata: {"jsonrpc":"2.0","id":"upstream_2","result":{"content":[{"type":"text","text":"{\\"solarReturnYear\\":2000,\\"recommendations\\":[{\\"title\\":\\"Solar Saffron Risotto\\"}]}"}]}}\n\n'

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(ssePayload, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const req = new Request('http://localhost:3000/api/mcp/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'what_to_cook_now',
        arguments: { solarReturnYear: 2000 },
        idempotencyKey: 'idem_what_cook_sse',
        settlementRail: 'arc-eip3009',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.result.solarReturnYear).toBe(2000)
    expect(json.result.recommendations[0].title).toBe('Solar Saffron Risotto')
    fetchSpy.mockRestore()
  })

  it('returns 503 UPSTREAM_KITCHEN_REQUIRED when upstream alchm.kitchen fails or is unreachable', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'))

    const req = new Request('http://localhost:3000/api/mcp/playground', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'what_to_cook_now',
        arguments: { solarReturnYear: 2000 },
        idempotencyKey: 'idem_what_cook_fail',
        settlementRail: 'arc-eip3009',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.code).toBe('UPSTREAM_KITCHEN_REQUIRED')
    fetchSpy.mockRestore()
  })
})
