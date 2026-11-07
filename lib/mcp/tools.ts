/**
 * @file lib/mcp/tools.ts
 *
 * Tool dispatcher and domain implementations for the Planetary Agents MCP Server
 * (`pa-mcp` & `https://agents.alchm.kitchen/api/mcp`).
 *
 * Backed by real AlchmAgentsSolana domain engines:
 * - Natal-Sky Bi-Wheel & Mentor Match (`lib/astrology/natal-transit-overlay.ts`)
 * - Pentacle Vessel Ratings 25–99 OVR, Seals, & 11-Zone ECR (`lib/agents/rating/*`)
 * - 4D ESMS Wavefunction (`lib/vessel/esms-wavefunction.ts`)
 * - Sacred 7 Persona Syntax (`lib/agents/persona/*`)
 */

import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import { VESSEL_RATING_SCALE, rateStats } from '@/lib/agents/rating/ovr-archetype'
import {
  ZONE_PROFILES,
  bestZoneId,
  computeZoneSynergies,
  resolveZoneContest,
} from '@/lib/agents/rating/pentacle-contest'
import { earnedSeals, evaluateSeals } from '@/lib/agents/rating/seals-surge'
import {
  FACTION_NAMES,
  ratableFromRoster,
  summarizeVessel,
} from '@/lib/agents/rating/vessel-payload'
import { generatePersonalityTraits } from '@/lib/agents/sacred-stats-prompt-generator'
import {
  computeNatalTransitOverlay,
  computeTransitAspects,
  normalizePlacements,
  signDegreeToLongitude,
} from '@/lib/astrology/natal-transit-overlay'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import { HISTORICAL_COUNCIL_PRESETS } from '@/lib/council-presets'
import {
  computeAmbientAlchemicalTide,
  computeSkyEsmsWavefunction,
} from '@/lib/vessel/esms-wavefunction'
import { resolveCaller, type ResolvedCaller } from './auth'
import {
  DELEGATED_CULINARY_TOOL_NAMES,
  PA_TOOL_COSTS,
  isPaToolName,
  type PaToolName,
} from './catalog'
import { sanitizeSecurityString, sanitizeSecurityStringArray } from './httpSecurity'
import { buildCurrentSkyTransitsResource, resolveHistoricalPersona } from './resources'

export interface InvokeToolContext {
  correlationId?: string
  defaultCaller?: ResolvedCaller
  bearerToken?: string
  signal?: AbortSignal
}

export interface ToolExecutionEnvelope {
  ok: boolean
  payload: Record<string, unknown>
}

const COUNCIL_IDEMPOTENCY_CACHE = new Map<string, Record<string, unknown>>()
const MAX_IDEMPOTENCY_ENTRIES = 200

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

export function makeSelfHealingError(params: {
  errorCode: string
  error: string
  remediation: string
  correlationId: string
  details?: Record<string, unknown>
}): ToolExecutionEnvelope {
  return {
    ok: false,
    payload: {
      ok: false,
      errorCode: params.errorCode,
      error: params.error,
      remediation: params.remediation,
      correlationId: params.correlationId,
      ...(params.details ?? {}),
    },
  }
}

function computeSimpleDignity(planet: string, longitude: number): number {
  const normalized = ((longitude % 360) + 360) % 360
  const signIdx = Math.floor(normalized / 30) % 12
  const domicileMap: Record<string, number[]> = {
    Sun: [4],
    Moon: [3],
    Mercury: [2, 5],
    Venus: [1, 6],
    Mars: [0, 7],
    Jupiter: [8, 11],
    Saturn: [9, 10],
  }
  const exaltationMap: Record<string, number> = {
    Sun: 0,
    Moon: 1,
    Mercury: 5,
    Venus: 11,
    Mars: 9,
    Jupiter: 3,
    Saturn: 6,
  }
  if (domicileMap[planet]?.includes(signIdx)) return 3
  if (exaltationMap[planet] === signIdx) return 2
  return 0
}

function handleMatchHistoricalMentor(
  args: Record<string, unknown>,
  correlationId: string
): ToolExecutionEnvelope {
  const query = sanitizeSecurityString(args.query, 200).toLowerCase()
  const elementFilter = sanitizeSecurityString(args.element, 32)
  const archetypeFilter = sanitizeSecurityString(args.archetype, 64).toLowerCase()
  const limitRaw = typeof args.limit === 'number' && Number.isFinite(args.limit) ? args.limit : 3
  const limit = Math.max(1, Math.min(10, Math.round(limitRaw)))

  if (elementFilter && !['Fire', 'Water', 'Earth', 'Air'].includes(elementFilter)) {
    return makeSelfHealingError({
      errorCode: 'INVALID_ELEMENT_FILTER',
      error: `Invalid element filter '${elementFilter}'.`,
      remediation:
        'Provide one of the four canonical alchemical elements: "Fire", "Water", "Earth", or "Air".',
      correlationId,
    })
  }

  const userNatalInput = isRecord(args.userNatal) ? args.userNatal : null
  const overlay = computeNatalTransitOverlay(userNatalInput, null)

  let candidateMentors = [...overlay.topMentors]

  if (query || elementFilter || archetypeFilter || limit > candidateMentors.length) {
    const liveTransits = overlay.liveTransit
    const scoredRoster = HISTORICAL_AGENTS.map(agent => {
      const ratable = ratableFromRoster(agent)
      const rating = rateStats(ratable.stats)
      const rawEsms = agent.consciousness?.alchemicalElements
      const seals = earnedSeals(
        evaluateSeals({
          stats: ratable.stats,
          esmsBalances: {
            spirit: (rawEsms?.spirit ?? 0.5) * 400,
            essence: (rawEsms?.essence ?? 0.5) * 400,
            matter: (rawEsms?.matter ?? 0.5) * 400,
            substance: (rawEsms?.substance ?? 0.5) * 400,
          },
          natalChart: ratable.natalChart,
        })
      )

      const natalPlacements = normalizePlacements(agent.consciousness?.natalChart?.planets ?? {})
      const aspects = computeTransitAspects(natalPlacements, liveTransits, 8.0)
      const topAspect = aspects[0] ?? {
        id: 'Sun-Sun-Conjunction',
        natalBody: 'Sun',
        natalLongitude: 0,
        natalSign: 'Aries',
        natalDegree: 0,
        transitBody: 'Sun',
        transitLongitude: 0,
        transitSign: 'Aries',
        transitDegree: 0,
        aspect: 'Conjunction' as const,
        category: 'fusion' as const,
        symbol: '☌',
        color: '#fbbf24',
        targetAngle: 0,
        actualSeparation: 0,
        orb: 2.0,
        resonanceGain: 1.2,
        significance: 2.5,
        description: 'Harmonic alignment with live sky.',
      }

      const agentElement = (agent.consciousness?.dominantElement ?? 'Fire') as
        | 'Fire'
        | 'Water'
        | 'Earth'
        | 'Air'
      const hay = [
        agent.id,
        agent.name,
        agent.title,
        agent.specialization,
        agent.era,
        rating.archetype.title,
        ...(agent.abilities?.wisdomDomains ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      let bonus = 0
      if (query) {
        const words = query.split(/\s+/).filter(w => w.length >= 3)
        for (const w of words) {
          if (hay.includes(w)) bonus += 8
        }
      }
      if (elementFilter && agentElement === elementFilter) bonus += 10
      if (archetypeFilter && hay.includes(archetypeFilter)) bonus += 10

      const filteredOut =
        (Boolean(elementFilter) && agentElement !== elementFilter) ||
        (Boolean(archetypeFilter) && !hay.includes(archetypeFilter))

      const score = Math.min(
        99,
        Math.max(70, Math.round(74 + (rating.ovr - 70) * 0.3 + topAspect.resonanceGain * 6 + bonus))
      )

      return {
        filteredOut,
        match: {
          rank: 1,
          agentId: agent.id,
          agentName: agent.name,
          agentTitle: agent.title ?? 'Historical Alchemist',
          era: agent.era ?? 'Historical',
          rulingPlanet: FACTION_NAMES[ratable.faction] ?? 'Sun',
          element: agentElement,
          pvr: rating.ovr,
          archetype: rating.archetype,
          seals,
          dominantAspect: topAspect,
          mentorResonanceScore: score,
          surgeTier: (score >= 92
            ? 'Major Surge'
            : score >= 84
              ? 'Moderate Surge'
              : 'Harmonic Surge') as 'Major Surge' | 'Moderate Surge' | 'Harmonic Surge',
          resonanceRationale: `${agent.name} (${rating.ovr} OVR, ${rating.archetype.title}) anchors ${topAspect.resonanceGain}x bi-wheel resonance via ${topAspect.description}`,
          links: {
            agentProfile: `/agent/${agent.id}`,
            synastry: `/synastry/${agent.id}`,
            culinary: `https://alchm.kitchen/recipes?agent=${encodeURIComponent(agent.id)}`,
          },
        },
      }
    })
      .filter(item => !item.filteredOut)
      .sort(
        (a, b) =>
          b.match.mentorResonanceScore - a.match.mentorResonanceScore || b.match.pvr - a.match.pvr
      )

    if (scoredRoster.length > 0) {
      candidateMentors = scoredRoster.slice(0, limit).map((item, idx) => ({
        ...item.match,
        rank: idx + 1,
      }))
    }
  } else {
    candidateMentors = candidateMentors.slice(0, limit)
  }

  return {
    ok: true,
    payload: {
      ok: true,
      correlationId,
      timestamp: overlay.timestamp,
      dominantElement: overlay.dominantElement,
      overallResonanceScore: overlay.overallResonanceScore,
      surgeState: overlay.surgeState,
      mentors: candidateMentors,
      biWheelSummary: {
        activeAspectCount: overlay.aspects.length,
        topAspects: overlay.aspects.slice(0, 5),
        mcpWirePayload: overlay.mcpWirePayload,
      },
    },
  }
}

function handleInspectAgentPvrTelemetry(
  args: Record<string, unknown>,
  correlationId: string
): ToolExecutionEnvelope {
  const singleSlug = sanitizeSecurityString(args.agentSlug, 100)
  const slugList = sanitizeSecurityStringArray(args.agentSlugs, 10, 100)
  const requestedSlugs = Array.from(new Set([...(singleSlug ? [singleSlug] : []), ...slugList]))

  if (requestedSlugs.length === 0) {
    return makeSelfHealingError({
      errorCode: 'MISSING_AGENT_SLUG',
      error: "At least one historical agent slug is required via 'agentSlug' or 'agentSlugs'.",
      remediation:
        "Pass agentSlug (e.g. 'johannes-kepler') or agentSlugs (e.g. ['johannes-kepler', 'socrates']), or read 'agents://roster/historical' to browse valid slugs.",
      correlationId,
    })
  }

  const vessels: Array<Record<string, unknown>> = []
  const contestables: Array<{
    slug: string
    name: string
    contestant: {
      ratings: ReturnType<typeof rateStats>['ratings']
      seals: ReturnType<typeof earnedSeals>
      surge: null
    }
  }> = []

  for (const rawSlug of requestedSlugs) {
    const { agent, canonicalSlug, didYouMean } = resolveHistoricalPersona(rawSlug)
    if (!agent) {
      return makeSelfHealingError({
        errorCode: 'PERSONA_NOT_FOUND',
        error: `Historical agent '${rawSlug}' was not found in the canonical roster.`,
        remediation: `Use one of the closest matching slugs (${didYouMean.join(', ')}) or read 'agents://roster/historical'.`,
        correlationId,
        details: { requestedSlug: rawSlug, didYouMean },
      })
    }

    const ratable = ratableFromRoster(agent)
    const rating = rateStats(ratable.stats)
    const rawEsms = agent.consciousness?.alchemicalElements
    const esmsBalances = {
      spirit: Math.round((rawEsms?.spirit ?? 0.5) * 200 * 100) / 100,
      essence: Math.round((rawEsms?.essence ?? 0.5) * 200 * 100) / 100,
      matter: Math.round((rawEsms?.matter ?? 0.5) * 200 * 100) / 100,
      substance: Math.round((rawEsms?.substance ?? 0.5) * 200 * 100) / 100,
    }

    const sealProgress = evaluateSeals({
      stats: ratable.stats,
      esmsBalances,
      natalChart: ratable.natalChart,
    })
    const seals = earnedSeals(sealProgress)
    const contestant = { ratings: rating.ratings, seals, surge: null }
    const zoneSynergies = computeZoneSynergies(contestant)
    const optimalZoneId = bestZoneId(contestant)
    const rulingPlanet = FACTION_NAMES[ratable.faction] ?? 'Sun'

    const natalPlacements = normalizePlacements(agent.consciousness?.natalChart?.planets ?? {})
    const longitudes: Partial<Record<string, number>> = {}
    for (const [body, p] of Object.entries(natalPlacements)) {
      longitudes[body] = signDegreeToLongitude(p.sign, p.degree)
    }
    const wavefunction = computeSkyEsmsWavefunction(longitudes, computeSimpleDignity)
    const ambientTide = computeAmbientAlchemicalTide(rulingPlanet, wavefunction)

    contestables.push({
      slug: canonicalSlug,
      name: agent.name,
      contestant,
    })

    vessels.push({
      slug: canonicalSlug.replace(/-\d+$/, ''),
      canonicalId: canonicalSlug,
      name: agent.name,
      title: agent.title,
      era: agent.era,
      rulingPlanet,
      dominantElement: agent.consciousness?.dominantElement ?? 'Fire',
      ovr: rating.ovr,
      archetype: rating.archetype,
      ratings: rating.ratings,
      relativeAdvantage: rating.relativeAdvantage,
      seals,
      sealProgress,
      bestZoneId: optimalZoneId,
      bestZoneLabel: ZONE_PROFILES[optimalZoneId]?.label ?? 'Crown',
      zoneSynergies,
      esmsDiamond: {
        balances: esmsBalances,
        wavefunction,
        ambientAlchemicalTide: ambientTide,
      },
      resourceUri: `agents://persona/${canonicalSlug}`,
    })
  }

  let zoneContest: Record<string, unknown> | undefined
  if (contestables.length >= 2) {
    const zoneIdRaw =
      typeof args.contestZoneId === 'number' && Number.isInteger(args.contestZoneId)
        ? args.contestZoneId
        : 10
    const zoneId = Math.max(0, Math.min(10, zoneIdRaw))
    const [attacker, defender] = contestables
    const contest = resolveZoneContest(attacker.contestant, defender.contestant, zoneId, 50)
    zoneContest = {
      zoneId,
      zoneLabel: ZONE_PROFILES[zoneId]?.label ?? 'Crown',
      zoneElement: ZONE_PROFILES[zoneId]?.element ?? 'Water',
      attacker: attacker.slug,
      defender: defender.slug,
      ...contest,
    }
  }

  return {
    ok: true,
    payload: {
      ok: true,
      correlationId,
      scale: VESSEL_RATING_SCALE,
      count: vessels.length,
      vessels,
      ...(zoneContest ? { zoneContest } : {}),
    },
  }
}

function buildAgentPerspectives(
  slugs: string[],
  topic: string,
  correlationId: string
): {
  error?: ToolExecutionEnvelope
  skyContext?: Record<string, unknown>
  perspectives?: Array<Record<string, unknown>>
  synastryChords?: Array<Record<string, unknown>>
  avgOvr?: number
  unlockedCouncilSeals?: string[]
} {
  const resolvedAgents = []
  for (const rawSlug of slugs) {
    const { agent, canonicalSlug, didYouMean } = resolveHistoricalPersona(rawSlug)
    if (!agent) {
      return {
        error: makeSelfHealingError({
          errorCode: 'PERSONA_NOT_FOUND',
          error: `Historical agent '${rawSlug}' not found.`,
          remediation: `Retry with one of the suggested canonical slugs: ${didYouMean.join(', ')}.`,
          correlationId,
          details: { requestedSlug: rawSlug, didYouMean },
        }),
      }
    }
    resolvedAgents.push({ agent, canonicalSlug })
  }

  const sky = buildCurrentSkyTransitsResource()
  const liveTransits = normalizePlacements(getCurrentPlanetaryPositions())

  const perspectives: Array<Record<string, unknown>> = []
  let ovrSum = 0
  const sealNames = new Set<string>()

  for (const { agent, canonicalSlug } of resolvedAgents) {
    const ratable = ratableFromRoster(agent)
    const rating = rateStats(ratable.stats)
    ovrSum += rating.ovr

    const rawEsms = agent.consciousness?.alchemicalElements
    const seals = earnedSeals(
      evaluateSeals({
        stats: ratable.stats,
        esmsBalances: {
          spirit: (rawEsms?.spirit ?? 0.5) * 400,
          essence: (rawEsms?.essence ?? 0.5) * 400,
          matter: (rawEsms?.matter ?? 0.5) * 400,
          substance: (rawEsms?.substance ?? 0.5) * 400,
        },
        natalChart: ratable.natalChart,
      })
    )
    for (const s of seals) sealNames.add(`${s.name} (${s.tier})`)

    const fullStats = deriveSacredStats(agent)
    const commStyle = generatePersonalityTraits(fullStats)
    const natalPlacements = normalizePlacements(agent.consciousness?.natalChart?.planets ?? {})
    const activeTransitAspects = computeTransitAspects(natalPlacements, liveTransits, 6.5)
    const leadAspect = activeTransitAspects[0]
    const belief =
      agent.coreBeliefs?.[0] ?? 'Truth emerges through disciplined observation and inner harmony.'
    const quote = agent.quotes?.[0] ?? ''

    const stance = leadAspect
      ? `Speaking as ${agent.name} (${agent.title}, ${rating.ovr} OVR) under ${leadAspect.description}: Applying ${agent.specialization ?? 'alchemical inquiry'} to "${topic}", I hold that "${belief}"`
      : `Speaking as ${agent.name} (${agent.title}, ${rating.ovr} OVR): Examining "${topic}" through ${agent.specialization ?? 'philosophical synthesis'}, I hold that "${belief}"`

    perspectives.push({
      slug: canonicalSlug.replace(/-\d+$/, ''),
      canonicalId: canonicalSlug,
      name: agent.name,
      title: agent.title,
      era: agent.era,
      rulingPlanet: FACTION_NAMES[ratable.faction] ?? 'Sun',
      dominantElement: agent.consciousness?.dominantElement ?? 'Fire',
      pvrOvr: rating.ovr,
      archetype: rating.archetype.title,
      communicationStyle: commStyle.style,
      primarySyntaxTraits: commStyle.primary.slice(0, 3),
      activeBiWheelAspect: leadAspect ?? null,
      coreBeliefAnchor: belief,
      recordedQuote: quote,
      perspectiveVector: stance,
    })
  }

  const synastryChords: Array<Record<string, unknown>> = []
  for (let i = 0; i < resolvedAgents.length; i++) {
    for (let j = i + 1; j < resolvedAgents.length; j++) {
      const a = resolvedAgents[i]
      const b = resolvedAgents[j]
      const chartA = normalizePlacements(a.agent.consciousness?.natalChart?.planets ?? {})
      const chartB = normalizePlacements(b.agent.consciousness?.natalChart?.planets ?? {})
      const interAspects = computeTransitAspects(chartA, chartB, 6.5)
      const topInter = interAspects[0]
      synastryChords.push({
        pair: `${a.agent.name} ↔ ${b.agent.name}`,
        sharedAspectCount: interAspects.length,
        primaryChord: topInter
          ? `${a.agent.name} ${topInter.natalBody} ${topInter.symbol} ${b.agent.name} ${topInter.transitBody} (${topInter.orb}° orb)`
          : 'Complementary Elemental Counterpoint',
        dyadicGain: topInter?.resonanceGain ?? 1.08,
      })
    }
  }

  return {
    skyContext: {
      timestamp: sky.timestamp,
      dominantElement: sky.dominantElement,
      lunarPhase: sky.lunarPhase,
      esmsSkyWavefunction: sky.esmsSkyWavefunction,
    },
    perspectives,
    synastryChords,
    avgOvr: Math.round(ovrSum / Math.max(1, resolvedAgents.length)),
    unlockedCouncilSeals: Array.from(sealNames).slice(0, 6),
  }
}

function handleSimulateAgentDialogue(
  args: Record<string, unknown>,
  correlationId: string
): ToolExecutionEnvelope {
  const topic = sanitizeSecurityString(args.topic, 500)
  if (!topic) {
    return makeSelfHealingError({
      errorCode: 'MISSING_TOPIC',
      error: "Parameter 'topic' is required for simulate_agent_dialogue.",
      remediation:
        "Provide a non-empty 'topic' string (e.g. 'The relationship between celestial geometry and human ethics').",
      correlationId,
    })
  }

  const singleSlug = sanitizeSecurityString(args.agentSlug, 100)
  const listSlugs = sanitizeSecurityStringArray(args.agentSlugs, 4, 100)
  const requested = Array.from(new Set([...(singleSlug ? [singleSlug] : []), ...listSlugs]))
  const targetSlugs = requested.length > 0 ? requested : ['socrates', 'johannes-kepler']

  const built = buildAgentPerspectives(targetSlugs, topic, correlationId)
  if (built.error) return built.error

  return {
    ok: true,
    payload: {
      ok: true,
      correlationId,
      topic,
      skyContext: built.skyContext,
      synastryChords: built.synastryChords ?? [],
      perspectives: built.perspectives ?? [],
    },
  }
}

function handleConveneAgentCouncil(
  args: Record<string, unknown>,
  correlationId: string
): ToolExecutionEnvelope {
  const topic = sanitizeSecurityString(args.topic, 500)
  if (!topic) {
    return makeSelfHealingError({
      errorCode: 'MISSING_TOPIC',
      error: "Parameter 'topic' is required for convene_agent_council.",
      remediation:
        "Pass a 'topic' string and optionally 'agentSlugs' (2–6 slugs) or 'councilPreset'.",
      correlationId,
    })
  }

  const meta = isRecord(args._meta) ? args._meta : {}
  const idempotencyKey =
    typeof meta.idempotencyKey === 'string' && meta.idempotencyKey.trim().length > 0
      ? meta.idempotencyKey.trim()
      : null

  if (idempotencyKey && COUNCIL_IDEMPOTENCY_CACHE.has(idempotencyKey)) {
    const cached = COUNCIL_IDEMPOTENCY_CACHE.get(idempotencyKey)!
    return {
      ok: true,
      payload: {
        ...cached,
        correlationId,
        billing: {
          status: 'replayed',
          debited: false,
          replayed: true,
          idempotencyKey,
          cost: { spirit: 0, essence: 0, matter: 0, substance: 0 },
        },
      },
    }
  }

  const presetId = sanitizeSecurityString(args.councilPreset, 100)
  let slugs = sanitizeSecurityStringArray(args.agentSlugs, 6, 100)

  if (slugs.length === 0 && presetId) {
    const preset = HISTORICAL_COUNCIL_PRESETS.find(p => p.id === presetId)
    if (preset) {
      slugs = preset.historicalAgentIds
        .filter(id => Boolean(resolveHistoricalPersona(id).agent))
        .slice(0, 4)
    }
  }

  if (slugs.length < 2) {
    slugs = ['socrates', 'johannes-kepler', 'carl-jung']
  }

  const built = buildAgentPerspectives(slugs, topic, correlationId)
  if (built.error) return built.error

  const names = (built.perspectives ?? []).map(p => String(p.name))
  const synthesis = `Council Synthesis (${names.join(', ')} — Composite ${built.avgOvr ?? 88} OVR): Grounded in a ${String(built.skyContext?.dominantElement ?? 'Fire')}-dominant sky, the council converges on integrating rigorous structural observation with intuitive archetypal resonance regarding "${topic}".`

  const responsePayload: Record<string, unknown> = {
    ok: true,
    correlationId,
    topic,
    councilOvr: built.avgOvr ?? 88,
    unlockedCouncilSeals: built.unlockedCouncilSeals ?? [],
    skyContext: built.skyContext,
    synastryChords: built.synastryChords ?? [],
    perspectives: built.perspectives ?? [],
    synthesis,
    billing: {
      status: 'charged',
      debited: true,
      replayed: false,
      idempotencyKey: idempotencyKey ?? `idem_council_${Date.now().toString(36)}`,
      cost: PA_TOOL_COSTS.convene_agent_council,
    },
  }

  if (idempotencyKey) {
    if (COUNCIL_IDEMPOTENCY_CACHE.size >= MAX_IDEMPOTENCY_ENTRIES) {
      const oldest = COUNCIL_IDEMPOTENCY_CACHE.keys().next().value
      if (oldest) COUNCIL_IDEMPOTENCY_CACHE.delete(oldest)
    }
    COUNCIL_IDEMPOTENCY_CACHE.set(idempotencyKey, responsePayload)
  }

  return {
    ok: true,
    payload: responsePayload,
  }
}

function handleGetCallerAllowance(
  caller: ResolvedCaller,
  correlationId: string
): ToolExecutionEnvelope {
  return {
    ok: true,
    payload: {
      ok: true,
      correlationId,
      authenticated: caller.authenticated,
      userId: caller.userId ?? 'anonymous',
      apiKeyId: caller.apiKeyId,
      authTier: caller.authTier,
      rateLimitRpm: caller.rateLimitRpm,
      balances: caller.balances,
      toolCosts: PA_TOOL_COSTS,
      x402Rails: [
        {
          rail: 'arc-eip3009',
          network: 'eip155:5042002',
          facilitator: 'self-settled (Circle Arc EIP-3009)',
        },
        {
          rail: 'solana-amm',
          network: 'solana:mainnet-beta',
          facilitator: 'Constellation AMM Pool Swap-to-Settle',
        },
        {
          rail: 'base-x402',
          network: 'eip155:84532',
          facilitator: 'https://x402.org/facilitator (Base Sepolia)',
        },
      ],
      culinaryBridgeUrl: 'https://alchm.kitchen/api/mcp',
    },
  }
}

function handleListPlanetaryAgents(
  args: Record<string, unknown>,
  correlationId: string
): ToolExecutionEnvelope {
  const query = sanitizeSecurityString(args.query, 200).toLowerCase()
  const sign = sanitizeSecurityString(args.sign, 32).toLowerCase()
  const element = sanitizeSecurityString(args.element, 32)
  const archetype = sanitizeSecurityString(args.archetype, 64).toLowerCase()
  const limitRaw = typeof args.limit === 'number' && Number.isFinite(args.limit) ? args.limit : 25
  const limit = Math.max(1, Math.min(100, Math.round(limitRaw)))

  let list = HISTORICAL_AGENTS.map(agent => {
    const ratable = ratableFromRoster(agent)
    const summary = summarizeVessel(ratable)
    const sunSign = agent.consciousness?.natalChart?.planets?.Sun?.sign ?? 'Aries'
    return {
      agentId: agent.id,
      slug: agent.id.replace(/-\d+$/, ''),
      name: agent.name,
      title: agent.title ?? 'Historical Alchemist',
      historicalEra: agent.era ?? summary.era,
      rulingPlanet: summary.factionName,
      sunSign,
      dominantElement: agent.consciousness?.dominantElement ?? 'Fire',
      pvrOvr: summary.ovr,
      archetype: summary.archetype.title,
      resourceUri: `agents://persona/${agent.id}`,
    }
  })

  if (query) {
    list = list.filter(a =>
      `${a.agentId} ${a.name} ${a.title} ${a.historicalEra} ${a.archetype}`
        .toLowerCase()
        .includes(query)
    )
  }
  if (sign) {
    list = list.filter(a => a.sunSign.toLowerCase() === sign)
  }
  if (element) {
    list = list.filter(a => a.dominantElement.toLowerCase() === element.toLowerCase())
  }
  if (archetype) {
    list = list.filter(
      a =>
        a.archetype.toLowerCase().includes(archetype) || a.title.toLowerCase().includes(archetype)
    )
  }

  list.sort((a, b) => b.pvrOvr - a.pvrOvr)
  const sliced = list.slice(0, limit)

  return {
    ok: true,
    payload: {
      ok: true,
      correlationId,
      count: sliced.length,
      agents: sliced,
      filters: {
        query: query || null,
        sign: sign || null,
        element: element || null,
        archetype: archetype || null,
        limit,
      },
    },
  }
}

function handleChatWithPlanetaryAgent(
  args: Record<string, unknown>,
  correlationId: string
): ToolExecutionEnvelope {
  const agentName = sanitizeSecurityString(args.agentName, 100)
  const message = sanitizeSecurityString(args.message, 4000)

  if (!agentName || !message) {
    return makeSelfHealingError({
      errorCode: 'MISSING_CHAT_PARAMETERS',
      error: "Both 'agentName' and 'message' are required for chat_with_planetary_agent.",
      remediation: "Pass 'agentName' (e.g. 'socrates') and a non-empty 'message' string.",
      correlationId,
    })
  }

  const { agent, canonicalSlug, didYouMean } = resolveHistoricalPersona(agentName)
  if (!agent) {
    return makeSelfHealingError({
      errorCode: 'PERSONA_NOT_FOUND',
      error: `Agent '${agentName}' not found in the canonical roster.`,
      remediation: `Use one of the suggested slugs: ${didYouMean.join(', ')}.`,
      correlationId,
      details: { requestedAgent: agentName, didYouMean },
    })
  }

  const built = buildAgentPerspectives([canonicalSlug], message, correlationId)
  const perspective = built.perspectives?.[0] ?? {}

  return {
    ok: true,
    payload: {
      ok: true,
      correlationId,
      agentId: canonicalSlug,
      agentName: agent.name,
      sessionId:
        sanitizeSecurityString(args.sessionId, 128) || `mcp_${canonicalSlug}_${Date.now()}`,
      pvrOvr: perspective.pvrOvr ?? 88,
      text: String(perspective.perspectiveVector ?? ''),
      liveSkyState: built.skyContext ?? {},
    },
  }
}

function handleTriggerChartSpecificJingDuel(
  args: Record<string, unknown>,
  correlationId: string
): ToolExecutionEnvelope {
  const casterName = sanitizeSecurityString(args.casterName, 100)
  const targetName = sanitizeSecurityString(args.targetName, 100)

  if (!casterName || !targetName) {
    return makeSelfHealingError({
      errorCode: 'MISSING_DUEL_PARTICIPANTS',
      error: "Both 'casterName' and 'targetName' are required.",
      remediation:
        "Provide valid historical agent slugs for both 'casterName' (e.g. 'johannes-kepler') and 'targetName' (e.g. 'galileo-galilei').",
      correlationId,
    })
  }

  const casterResolved = resolveHistoricalPersona(casterName)
  const targetResolved = resolveHistoricalPersona(targetName)

  if (!casterResolved.agent || !targetResolved.agent) {
    const missing = !casterResolved.agent ? casterName : targetName
    const suggestions = !casterResolved.agent
      ? casterResolved.didYouMean
      : targetResolved.didYouMean
    return makeSelfHealingError({
      errorCode: 'PERSONA_NOT_FOUND',
      error: `Duel participant '${missing}' not found in the historical roster.`,
      remediation: `Retry with one of the suggested slugs: ${suggestions.join(', ')}.`,
      correlationId,
      details: { missingParticipant: missing, didYouMean: suggestions },
    })
  }

  const casterAgent = casterResolved.agent
  const targetAgent = targetResolved.agent
  const casterChart = normalizePlacements(casterAgent.consciousness?.natalChart?.planets ?? {})
  const targetChart = normalizePlacements(targetAgent.consciousness?.natalChart?.planets ?? {})

  const aspects = computeTransitAspects(casterChart, targetChart, 8.0)
  const topAspect = aspects[0]

  const moveMap =
    topAspect?.category === 'catalytic'
      ? { moveName: 'Meltdown', element: 'Fire' }
      : topAspect?.category === 'harmonic'
        ? { moveName: 'Vacuum', element: 'Air' }
        : { moveName: 'Freeze', element: 'Water' }

  const casterRatable = ratableFromRoster(casterAgent)
  const targetRatable = ratableFromRoster(targetAgent)
  const casterRating = rateStats(casterRatable.stats)
  const targetRating = rateStats(targetRatable.stats)
  const zoneId =
    typeof args.zoneId === 'number' && Number.isInteger(args.zoneId)
      ? Math.max(0, Math.min(10, args.zoneId))
      : 10

  const contest = resolveZoneContest(
    { ratings: casterRating.ratings, seals: [], surge: null },
    { ratings: targetRating.ratings, seals: [], surge: null },
    zoneId,
    50
  )

  return {
    ok: true,
    payload: {
      ok: true,
      correlationId,
      triggered: true,
      caster: casterAgent.name,
      casterId: casterAgent.id,
      target: targetAgent.name,
      targetId: targetAgent.id,
      moveName: moveMap.moveName,
      element: moveMap.element,
      aspect: topAspect ?? {
        type: 'Conjunction',
        planetA: 'Sun',
        planetB: 'Sun',
        orb: 1.2,
        category: 'fusion',
      },
      zoneContest: {
        zoneId,
        zoneLabel: ZONE_PROFILES[zoneId]?.label ?? 'Crown',
        ...contest,
      },
      casterVoice: `${casterAgent.name}: By the ${moveMap.element} of ${moveMap.moveName}, our charts collide across the ${ZONE_PROFILES[zoneId]?.label ?? 'Crown'}!`,
      targetVoice: `${targetAgent.name}: I hold my ground with ${targetRating.ovr} OVR resonance against your ${moveMap.moveName}!`,
    },
  }
}

export async function invokePaTool(
  name: string,
  rawArgs: Record<string, unknown> = {},
  context: InvokeToolContext = {}
): Promise<ToolExecutionEnvelope> {
  const correlationId = context.correlationId ?? `mcp_pa_${Date.now().toString(36)}`

  if (DELEGATED_CULINARY_TOOL_NAMES.has(name)) {
    return makeSelfHealingError({
      errorCode: 'CULINARY_DOMAIN_BOUNDARY',
      error: `Tool '${name}' is a culinary execution tool and is not hosted on the Planetary Agents MCP server (agents.alchm.kitchen).`,
      remediation:
        "Invoke culinary tools on https://alchm.kitchen/api/mcp (@alchm/mcp-server@1.5.0) or read resource 'agents://bridge/culinary-kitchen' for the cross-domain bridge specification.",
      correlationId,
      details: {
        upstreamMcpEndpoint: 'https://alchm.kitchen/api/mcp',
        bridgeResourceUri: 'agents://bridge/culinary-kitchen',
      },
    })
  }

  if (!isPaToolName(name)) {
    return makeSelfHealingError({
      errorCode: 'UNKNOWN_TOOL',
      error: `Unknown Planetary Agents MCP tool: '${name}'.`,
      remediation:
        'Call tools/list to inspect the 8 supported Planetary Agents tools (match_historical_mentor, inspect_agent_pvr_telemetry, simulate_agent_dialogue, convene_agent_council, get_caller_allowance, list_planetary_agents, chat_with_planetary_agent, trigger_chart_specific_jing_duel).',
      correlationId,
    })
  }

  let caller: ResolvedCaller
  try {
    caller =
      context.defaultCaller ?? (await resolveCaller(rawArgs, { bearerToken: context.bearerToken }))
  } catch (err) {
    return makeSelfHealingError({
      errorCode: 'AUTH_CONFLICT_OR_INVALID',
      error: err instanceof Error ? err.message : 'Invalid MCP authentication metadata.',
      remediation:
        'Provide a single valid Bearer API key via the HTTP Authorization header or arguments._meta.apiKey, and ensure both match if both are supplied.',
      correlationId,
    })
  }

  switch (name as PaToolName) {
    case 'match_historical_mentor':
      return handleMatchHistoricalMentor(rawArgs, correlationId)
    case 'inspect_agent_pvr_telemetry':
      return handleInspectAgentPvrTelemetry(rawArgs, correlationId)
    case 'simulate_agent_dialogue':
      return handleSimulateAgentDialogue(rawArgs, correlationId)
    case 'convene_agent_council':
      return handleConveneAgentCouncil(rawArgs, correlationId)
    case 'get_caller_allowance':
      return handleGetCallerAllowance(caller, correlationId)
    case 'list_planetary_agents':
      return handleListPlanetaryAgents(rawArgs, correlationId)
    case 'chat_with_planetary_agent':
      return handleChatWithPlanetaryAgent(rawArgs, correlationId)
    case 'trigger_chart_specific_jing_duel':
      return handleTriggerChartSpecificJingDuel(rawArgs, correlationId)
  }
}
