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

    case 'alchemize_ingredients': {
      const list = Array.isArray(args.ingredients)
        ? (args.ingredients as string[])
        : ['saffron threads', 'black garlic', 'blood orange zest']
      return {
        ingredientsAnalyzed: list.length,
        targetElement: args.targetElement ?? 'Fire',
        thermodynamicVectors: {
          spirit: 88,
          essence: 82,
          matter: 68,
          substance: 76,
        },
        ingredientMappings: list.map((item, idx) => ({
          ingredient: item,
          rulingPlanet: ['Sun', 'Pluto', 'Mercury', 'Venus'][idx % 4],
          element: ['Fire', 'Water', 'Air', 'Earth'][idx % 4],
          potencyBps: 8400 + idx * 320,
        })),
      }
    }

    case 'generate_cosmic_recipe':
      return {
        recipeId: `wten-cosmic-${Date.now().toString(36)}`,
        title: 'Solaris Saffron & Black Garlic Alchemical Broth',
        agentId: args.agentId ?? 'mars-aries',
        mealType: args.mealType ?? 'dinner',
        dominantPlanet: args.dominantPlanet ?? 'Mars',
        esmsMacroBalance: { spirit: 34, essence: 28, matter: 20, substance: 18 },
        prepTimeMinutes: 25,
        steps: [
          'Toast saffron threads in a dry copper vessel for 45 seconds to awaken Solar Spirit.',
          'Whisk fermented black garlic paste into simmering bone ormushroom dashi to anchor Saturnian Matter.',
          'Finish with blood orange zest and wild fennel pollen right before service.',
        ],
        wtenPrewarmBudgetMs: 1420,
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

    case 'submit_recipe_reflection':
      return {
        agentId: args.agentId ?? 'ibn-sina-avicenna',
        recipeId: args.recipeId ?? 'wten-saffron-broth-042',
        reflection: args.reflection ?? 'Harmonic culinary reflection recorded.',
        rating: args.rating ?? 96,
        feedPublished: true,
        wtenSyncStatus: 'acknowledged',
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
    package: '@alchm/mcp-server@1.4.0',
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
          error: `Unknown MCP tool '${toolName}'. Must be one of the 8 canonical @alchm/mcp-server@1.4.0 tools.`,
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

    if (cached || isColdStartReplay) {
      const replayedReceipt = normalizeMcpBillingReceipt({
        status: 'replayed',
        amounts: toolDef.esmsCost,
        idempotencyKey,
        rail,
        x402AtomicUsdc: toolDef.x402AtomicUsdc,
        txReference: cached?.receipt.txReference ?? deterministicTxReference,
      })

      const baseResult =
        cached?.result ??
        synthesizeToolResult(toolDef.name, {
          ...rawArgs,
          idempotencyKey,
        })

      if (!cached) {
        IDEMPOTENCY_CACHE.set(cacheKey, {
          tool: toolDef.name,
          result: baseResult,
          receipt: replayedReceipt,
          createdAt: new Date().toISOString(),
        })
      }

      return NextResponse.json(
        {
          ok: true,
          package: '@alchm/mcp-server@1.4.0',
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
            ...baseResult,
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

    const synthesized = synthesizeToolResult(toolDef.name, {
      ...rawArgs,
      idempotencyKey,
    })

    if (IDEMPOTENCY_CACHE.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = IDEMPOTENCY_CACHE.keys().next().value
      if (oldestKey) IDEMPOTENCY_CACHE.delete(oldestKey)
    }

    IDEMPOTENCY_CACHE.set(cacheKey, {
      tool: toolDef.name,
      result: synthesized,
      receipt: chargedReceipt,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        ok: true,
        package: '@alchm/mcp-server@1.4.0',
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
          ...synthesized,
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
