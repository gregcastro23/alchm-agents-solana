import { type NextRequest, NextResponse } from 'next/server'
import { getHistoricalAgent } from '@/lib/agents/historical'
import {
  type RatedAgentPayload,
  type SacredStatKey,
  computeOvr,
  computeRelativeAdvantage,
  resolveArchetype,
  evaluateSurgeState,
  evaluateSealTier,
  buildCanonicalSeal,
  clampStat,
  SACRED_STAT_KEYS,
} from '@/lib/agents/rating-contract'
import { resolveAgentAppearance } from '@/lib/agents/vessel-appearance-manifest'
import { feedStreamBus } from '@/lib/agents/feed-stream-bus'
import { computeAgentProgression } from '@/lib/agents/leveling-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-cache, no-transform',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agentId = slug.trim().toLowerCase()

  // 2. Resolve agent from historical catalog
  const agent = getHistoricalAgent(agentId)
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404, headers: CORS_HEADERS })
  }

  // 3. Extract or derive Sacred 7 stats on [25, 99]
  const rawRatings: Record<SacredStatKey, number> = {
    power: clampStat(
      agent.sacredStats?.power ??
        agent.consciousness.monicaConstant * 8 +
          (agent.consciousness.alchemicalElements?.spirit ?? 5) * 5 +
          40
    ),
    resonance: clampStat(
      agent.sacredStats?.resonance ??
        (agent.consciousness.alchemicalElements?.essence ?? 5) * 6 +
          (agent.stats?.resonanceScore ?? 50) * 0.2 +
          35
    ),
    wisdom: clampStat(
      agent.sacredStats?.wisdom ??
        (agent.consciousness.alchemicalElements?.substance ?? 5) * 5 +
          agent.consciousness.monicaConstant * 4 +
          40
    ),
    charisma: clampStat(
      agent.sacredStats?.charisma ??
        (agent.consciousness.alchemicalElements?.spirit ?? 5) * 5 +
          (agent.consciousness.alchemicalElements?.essence ?? 5) * 4 +
          30
    ),
    intuition: clampStat(
      agent.sacredStats?.intuition ??
        (agent.consciousness.alchemicalElements?.essence ?? 5) * 7 +
          (agent.consciousness.alchemicalElements?.substance ?? 5) * 3 +
          35
    ),
    adaptability: clampStat(
      agent.sacredStats?.adaptability ??
        (agent.consciousness.alchemicalElements?.substance ?? 5) * 6 + 45
    ),
    vitality: clampStat(
      agent.sacredStats?.vitality ?? (agent.consciousness.alchemicalElements?.matter ?? 5) * 6 + 45
    ),
  }

  const relativeAdvantage = computeRelativeAdvantage(rawRatings)
  const ovr = computeOvr(rawRatings)
  const archetype = resolveArchetype(relativeAdvantage)

  // 4. ESMS holdings
  const esms = {
    spirit: Math.round((agent.consciousness.alchemicalElements?.spirit ?? 10) * 4.5 * 10) / 10,
    essence: Math.round((agent.consciousness.alchemicalElements?.essence ?? 10) * 4.5 * 10) / 10,
    matter: Math.round((agent.consciousness.alchemicalElements?.matter ?? 10) * 4.5 * 10) / 10,
    substance:
      Math.round((agent.consciousness.alchemicalElements?.substance ?? 10) * 4.5 * 10) / 10,
  }

  // 5. Evaluate Alchemical Seals
  const seals = []
  for (const statKey of SACRED_STAT_KEYS) {
    const esmsKey =
      statKey === 'power'
        ? 'substance'
        : statKey === 'intuition' || statKey === 'adaptability'
          ? 'spirit'
          : statKey === 'vitality' || statKey === 'wisdom'
            ? 'matter'
            : 'essence'
    const tier = evaluateSealTier(statKey, rawRatings[statKey], esms[esmsKey], false)
    if (tier) {
      seals.push(buildCanonicalSeal(statKey, tier))
    }
  }

  // 6. Resonance Surge state
  const heat = 0.5 + (rawRatings.power - 60) * 0.01
  const reactivity = 0.5 + (rawRatings.adaptability - 60) * 0.01
  const meter = Math.min(100, Math.max(0, Math.round(rawRatings.resonance * 0.6 + heat * 30)))
  const surge = evaluateSurgeState(
    meter,
    heat,
    reactivity,
    archetype.primary,
    archetype.secondary,
    agent.consciousness.monicaConstant
  )

  const appearance = resolveAgentAppearance(agent.id, undefined, archetype)
  const progression = computeAgentProgression(agent)

  const payload: RatedAgentPayload = {
    key: agent.id,
    handle: agent.name,
    faction: 0,
    factionName: 'Solaris',
    isPlaceholder: false,
    provenance: 'historical',
    appearance,
    avatarModelUrl: agent.avatarModelUrl ?? appearance.avatarModelUrl,
    headMeshUrl: agent.headMeshUrl ?? appearance.headMeshUrl,
    ratings: rawRatings,
    relativeAdvantage,
    ovr,
    archetype,
    esms,
    seals,
    surge,
    vesselLevel: progression.vesselLevel,
    totalXp: progression.totalXp,
    xpToNextLevel: progression.xpToNextLevel,
    levelBoost: progression.levelBoost,
    baseOverall: progression.baseOverall,
    trainedOverall: progression.trainedOverall,
    currentOverall: progression.currentOverall,
    transitDelta: progression.transitDelta,
    progressionStatus: progression.progressionStatus,
    expBreakdown: progression.expBreakdown,
    trainingEvidence: progression.trainingEvidence,
    planetaryStats: progression.stats
      ? {
          solarAgency: progression.stats.solarAgency,
          lunarReceptivity: progression.stats.lunarReceptivity,
          mercurialVelocity: progression.stats.mercurialVelocity,
          venusianCoherence: progression.stats.venusianCoherence,
          martialImpetus: progression.stats.martialImpetus,
          jovianExpansion: progression.stats.jovianExpansion,
          saturnianStructure: progression.stats.saturnianStructure,
          chironicAdaptation: progression.stats.chironicAdaptation,
          uranianSurprisal: progression.stats.uranianSurprisal,
          neptunianResonance: progression.stats.neptunianResonance,
          plutonicIntegration: progression.stats.plutonicIntegration,
          kineticAlignment: progression.stats.kineticAlignment,
        }
      : null,
    ratingAsOf: progression.asOf,
    progressionReasons: progression.reasons,
    statDeltas: progression.statDeltas,
  }

  feedStreamBus.recordAgentRating(payload)
  if (surge.active) {
    feedStreamBus.recordResonanceSurge({
      agentId: agent.id,
      surge,
      esms,
      appearance,
    })
  }

  return NextResponse.json(payload, { headers: CORS_HEADERS })
}
