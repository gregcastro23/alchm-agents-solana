import { NextResponse } from 'next/server'
import {
  MCP_V140_TOOL_CATALOG,
  buildX402PaymentPreview,
  getMcpToolDefinition,
  normalizeMcpBillingReceipt,
  prepareMcpArguments,
  rateMcpToolReadiness,
  type McpSettlementRail,
  type NormalizedMcpBillingReceipt,
} from '@/lib/mcp/playground-catalog'
import { buildAlchmToolManifest } from '@/lib/toolrouter/manifest'

interface CachedExecution {
  tool: string
  result: Record<string, unknown>
  receipt: NormalizedMcpBillingReceipt
  createdAt: string
}

const IDEMPOTENCY_CACHE = new Map<string, CachedExecution>()
const MAX_CACHE_ENTRIES = 250

const CULINARY_TOOLS = new Set([
  'alchemize_ingredients',
  'generate_cosmic_recipe',
  'submit_recipe_reflection',
  'get_user_allowance',
  'substitute_ingredient',
  'build_consolidated_grocery_list',
  'what_to_cook_now',
  'update_culinary_profile',
])

const KITCHEN_UPSTREAM = (
  process.env.ALCHM_KITCHEN_SYNC_URL ||
  process.env.ALCHM_KITCHEN_BASE_URL ||
  process.env.NEXT_PUBLIC_KITCHEN_URL ||
  process.env.ALCHM_KITCHEN_URL ||
  'https://alchm.kitchen'
).replace(/\/+$/, '')

async function proxyCulinaryToolToUpstream(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const upstreamUrl = `${KITCHEN_UPSTREAM}/api/mcp`
    const res = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(process.env.ALCHM_KITCHEN_SYNC_SECRET
          ? { Authorization: `Bearer ${process.env.ALCHM_KITCHEN_SYNC_SECRET}` }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `pa_${Date.now()}`,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? ''
      let json: any = null

      if (contentType.includes('text/event-stream')) {
        const rawText = await res.text()
        const lines = rawText.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data:')) {
            try {
              json = JSON.parse(trimmed.slice(5).trim())
              break
            } catch {
              // continue scanning lines
            }
          }
        }
        if (!json) {
          try {
            json = JSON.parse(rawText)
          } catch {
            // ignore fallback
          }
        }
      } else {
        json = await res.json()
      }

      const structured =
        json?.result?.structuredContent ??
        (json?.result?.content?.[0]?.text
          ? (() => {
              try {
                return JSON.parse(json.result.content[0].text)
              } catch {
                return null
              }
            })()
          : null) ??
        json?.result ??
        json
      return { ok: true, data: (structured ?? { ok: true }) as Record<string, unknown> }
    }
    return {
      ok: false,
      error: `Upstream alchm.kitchen responded with HTTP ${res.status}`,
    }
  } catch (err: any) {
    return {
      ok: false,
      error: `Upstream alchm.kitchen unreachable (${err?.message || 'Network error'})`,
    }
  }
}

function synthesizeToolResult(
  toolName: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  switch (toolName) {
    case 'get_live_sky_transits':
      return {
        timestamp: args.timestamp ?? new Date().toISOString(),
        zodiacSystem: args.zodiacSystem ?? 'tropical',
        lunarPhase: {
          phase: 'Waxing Gibbous',
          illuminationPct: 78.4,
          moonSign: 'Pisces',
          moonDegree: 18.6,
          alchemicalInfluence: 'Elevated Essence & Subconscious Synthesis',
        },
        dominantPlacements: [
          { planet: 'Sun', sign: 'Scorpio', degree: 12.4, dignity: 'Peregrine', element: 'Water' },
          { planet: 'Mars', sign: 'Aries', degree: 4.2, dignity: 'Domicile', element: 'Fire' },
          {
            planet: 'Jupiter',
            sign: 'Cancer',
            degree: 15.1,
            dignity: 'Exaltation',
            element: 'Water',
          },
          { planet: 'Saturn', sign: 'Libra', degree: 21.8, dignity: 'Exaltation', element: 'Air' },
        ],
        harmonicAspects: [
          { pair: 'Sun △ Jupiter', aspect: 'Trine', orbDeg: 2.7, resonanceGain: 1.24 },
          { pair: 'Mars ∗ Saturn', aspect: 'Sextile', orbDeg: 1.4, resonanceGain: 1.12 },
        ],
      }

    case 'compute_synastry_overlay':
      return {
        subjectA: args.subjectA ?? { id: 'johannes-kepler', sunSign: 'Capricorn' },
        subjectB: args.subjectB ?? { id: 'rumi', sunSign: 'Libra' },
        dyadicChordGain: 1.28,
        compositeHarmonyScore: 91,
        sharedPentacleZones: ['Crown of Solaris', 'Mercury Caduceus', 'Jovian Expansion'],
        alchemicalSealSynergy: 'Philosopher’s Triad (+1.18x ECR Multiplier)',
      }

    case 'get_transit_natal_overlay':
      return {
        agentId: args.agentId ?? 'johannes-kepler',
        natalDate: args.natalDate ?? '1571-12-27T14:30:00Z',
        transitTimestamp: args.transitTimestamp ?? new Date().toISOString(),
        resonanceSurge: {
          tier: 'Major Surge',
          deltaOvr: +8,
          triggerAspect: 'Transiting Jupiter △ Natal Mercury (0.6° orb)',
        },
        baselinePvr: 86,
        surgedPvr: 94,
      }

    case 'compute_triplicate_synastry': {
      const vessels = Array.isArray(args.vessels)
        ? (args.vessels as string[])
        : ['johannes-kepler', 'rumi', 'ibn-sina-avicenna']
      return {
        councilVessels: vessels,
        intent: args.intent ?? 'Alchemical Council Synthesis',
        triplicateResonanceOvr: 95,
        pentacleCoveragePct: 90.9,
        unlockedCouncilSeals: [
          'Seal of Solar Sovereignty',
          'Seal of Hermetic Synthesis',
          'Seal of Quintessence',
        ],
        recommendedLeadSpeaker: vessels[0] ?? 'johannes-kepler',
      }
    }

    case 'create_evidence_snapshot':
      return {
        agentId: args.agentId ?? 'johannes-kepler',
        epochNumber: args.epochNumber ?? 144,
        personaDriftBps: args.personaDriftBps ?? 42,
        walrusBlobId: `blob_walrus_${(args.idempotencyKey ?? '144').toString().slice(0, 12)}`,
        arcCommitmentHash: '0x9f84c2e17b09d4a6c1138a7c8b44e0a12f6d9e3c4b5a67890123456789abcdef',
        banachContractionVerified: true,
        tau: 0.99,
      }

    default:
      return { ok: true, echo: args }
  }
}

export async function GET() {
  const tools = MCP_V140_TOOL_CATALOG.map(tool => {
    const rating = rateMcpToolReadiness(tool)
    return {
      ...tool,
      pvr: rating.ovr,
      archetype: rating.archetype.title,
    }
  })

  return NextResponse.json({
    ok: true,
    package: '@alchm/mcp-server@1.5.0',
    protocolVersion: '2025-06-18',
    toolCount: tools.length,
    tools,
    toolRouterManifest: buildAlchmToolManifest(),
  })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tool?: string
      arguments?: Record<string, unknown>
      idempotencyKey?: string
      settlementRail?: McpSettlementRail
      seenIdempotencyKeys?: string[]
    }

    const toolName = String(body.tool ?? 'get_live_sky_transits')
    const toolDef = getMcpToolDefinition(toolName)
    if (!toolDef) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unknown MCP tool '${toolName}'. Must be one of the 13 canonical @alchm/mcp-server@1.5.0 tools.`,
        },
        { status: 400 }
      )
    }

    const rail: McpSettlementRail =
      body.settlementRail === 'solana-amm' ||
      body.settlementRail === 'base-x402' ||
      body.settlementRail === 'arc-eip3009'
        ? body.settlementRail
        : 'arc-eip3009'

    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
        ? body.idempotencyKey.trim()
        : `idem_${Date.now().toString(36)}`

    const rawArgs =
      typeof body.arguments === 'object' && body.arguments !== null
        ? body.arguments
        : toolDef.defaultArgs

    const preparedArgs = prepareMcpArguments(rawArgs, idempotencyKey)
    const cacheKey = `${toolDef.name}::${idempotencyKey}`
    const cached = IDEMPOTENCY_CACHE.get(cacheKey)

    // Stateless cold-start / multi-region Vercel Fluid replay fallback via client ledger or cookie
    const clientSeenKeys = Array.isArray(body.seenIdempotencyKeys)
      ? body.seenIdempotencyKeys.filter((k): k is string => typeof k === 'string')
      : []
    const cookieHeader = req.headers.get('cookie') ?? ''
    const cookieMatch = cookieHeader.match(/(?:^|;\s*)alchm_mcp_idem_keys=([^;]+)/)
    const cookieKeys = cookieMatch
      ? decodeURIComponent(cookieMatch[1]).split(',').filter(Boolean)
      : []
    const isColdStartReplay =
      !cached &&
      (clientSeenKeys.includes(cacheKey) ||
        clientSeenKeys.includes(idempotencyKey) ||
        cookieKeys.includes(cacheKey))

    const pvrRating = rateMcpToolReadiness(toolDef)
    const x402Preview = buildX402PaymentPreview(toolDef, rail, idempotencyKey)

    const txRefPrefix =
      rail === 'solana-amm' ? 'sol_sig_' : rail === 'arc-eip3009' ? '0xarc_' : '0xbase_'
    const deterministicTxReference = `${txRefPrefix}${Buffer.from(cacheKey).toString('hex').slice(0, 24)}`

    const nextCookieKeys = Array.from(new Set([cacheKey, ...cookieKeys])).slice(0, 24)
    const setCookieValue = `alchm_mcp_idem_keys=${encodeURIComponent(nextCookieKeys.join(','))}; Path=/api/mcp/playground; Max-Age=3600; SameSite=Lax`

    let resolvedResult: Record<string, unknown>
    if (cached) {
      resolvedResult = cached.result
    } else if (CULINARY_TOOLS.has(toolDef.name)) {
      const proxy = await proxyCulinaryToolToUpstream(toolDef.name, preparedArgs)
      if (!proxy.ok) {
        return NextResponse.json(
          {
            ok: false,
            package: '@alchm/mcp-server@1.5.0',
            tool: toolDef.name,
            error:
              'alchm.kitchen upstream connection required for culinary tool execution. Local synthesis is strictly disallowed.',
            code: 'UPSTREAM_KITCHEN_REQUIRED',
            status: 503,
            upstream: KITCHEN_UPSTREAM,
            details: proxy.error,
          },
          { status: 503 }
        )
      }
      resolvedResult = proxy.data ?? { ok: true }
    } else {
      resolvedResult = synthesizeToolResult(toolDef.name, {
        ...rawArgs,
        idempotencyKey,
      })
    }

    if (cached || isColdStartReplay) {
      const replayedReceipt = normalizeMcpBillingReceipt({
        status: 'replayed',
        amounts: toolDef.esmsCost,
        idempotencyKey,
        rail,
        x402AtomicUsdc: toolDef.x402AtomicUsdc,
        txReference: cached?.receipt.txReference ?? deterministicTxReference,
      })

      if (!cached) {
        IDEMPOTENCY_CACHE.set(cacheKey, {
          tool: toolDef.name,
          result: resolvedResult,
          receipt: replayedReceipt,
          createdAt: new Date().toISOString(),
        })
      }

      return NextResponse.json(
        {
          ok: true,
          package: '@alchm/mcp-server@1.5.0',
          tool: toolDef.name,
          pvr: pvrRating.ovr,
          archetype: pvrRating.archetype.title,
          jsonRpcRequest: {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: toolDef.name,
              arguments: preparedArgs,
            },
          },
          result: {
            ...resolvedResult,
            billing: replayedReceipt,
          },
          billing: replayedReceipt,
          x402Payment: x402Preview,
        },
        {
          headers: {
            'Set-Cookie': setCookieValue,
          },
        }
      )
    }

    const chargedReceipt = normalizeMcpBillingReceipt({
      status: 'charged',
      amounts: toolDef.esmsCost,
      idempotencyKey,
      rail,
      x402AtomicUsdc: toolDef.x402AtomicUsdc,
      txReference: deterministicTxReference,
    })

    if (IDEMPOTENCY_CACHE.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = IDEMPOTENCY_CACHE.keys().next().value
      if (oldestKey) IDEMPOTENCY_CACHE.delete(oldestKey)
    }

    IDEMPOTENCY_CACHE.set(cacheKey, {
      tool: toolDef.name,
      result: resolvedResult,
      receipt: chargedReceipt,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        ok: true,
        package: '@alchm/mcp-server@1.5.0',
        tool: toolDef.name,
        pvr: pvrRating.ovr,
        archetype: pvrRating.archetype.title,
        jsonRpcRequest: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: toolDef.name,
            arguments: preparedArgs,
          },
        },
        result: {
          ...resolvedResult,
          billing: chargedReceipt,
        },
        billing: chargedReceipt,
        x402Payment: x402Preview,
      },
      {
        headers: {
          'Set-Cookie': setCookieValue,
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Playground execution failed',
      },
      { status: 500 }
    )
  }
}
