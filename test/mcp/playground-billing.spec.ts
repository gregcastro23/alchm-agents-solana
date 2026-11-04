import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/mcp/playground/route'
import {
  MCP_V140_TOOL_CATALOG,
  buildX402PaymentPreview,
  getMcpToolDefinition,
  normalizeMcpBillingReceipt,
  prepareMcpArguments,
  rateMcpToolReadiness,
} from '@/lib/mcp/playground-catalog'

describe('@alchm/mcp-server@1.4.0 playground catalog & billing normalization', () => {
  it('exposes the exact 8 canonical v1.4.0 tools with valid PVR (25–99) readiness scores', () => {
    expect(MCP_V140_TOOL_CATALOG).toHaveLength(8)
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
})
