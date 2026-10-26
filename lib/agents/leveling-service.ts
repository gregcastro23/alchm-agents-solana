import { createHash } from 'crypto'
import { getHistoricalAgent } from '@/lib/agents/historical'
import {
  computeVesselProgression,
  computeVesselGrowth,
  type EsmsAxisAttribution,
  type VesselStats,
} from '@/lib/vessel/progression'
import {
  createExperienceLedger,
  applyExperienceEvent,
  type ExperienceLedger,
} from '@/lib/vessel/experience'
import {
  resolve19Stats,
  resolveNatalLongitudes,
  type AgentStatSource,
} from '@/lib/vessel/stat-resolver'
import { getCurrentSkySnapshot, type CurrentSkySnapshot } from '@/lib/vessel/sky-provider'
import { computeRelativeAdvantage, resolveArchetype, type SacredStatKey } from './rating-contract'

export interface AgentProgressionProfile {
  agentId: string
  vesselLevel: number | null
  totalXp: number | null
  xpToNextLevel: number | null
  levelBoost: number | null
  baseOverall: number | null
  trainedOverall: number | null
  currentOverall: number | null
  transitDelta: number | null
  progressionStatus: 'live' | 'estimated' | 'unavailable'
  asOf: string | null
  expBreakdown: ExperienceLedger['categoryXp'] | null
  trainingEvidence: ExperienceLedger['trainingEvidence'] | null
  stats: VesselStats | null
  statDeltas: VesselStats | null
  esmsAxisAttribution?: EsmsAxisAttribution | null
  reasons: string[]
}

/**
 * Builds a deterministic experience ledger from seeded conversation counts,
 * crediting each conversation as imported training evidence under the canonical
 * EXPERIENCE_POLICY (25 XP per imported conversation).
 */
export function buildSeededAgentExperience(
  agentId: string,
  conversationCount: number
): ExperienceLedger {
  const safeCount = Math.max(0, Math.floor(conversationCount))
  const initial = createExperienceLedger({ kind: 'agent', id: agentId })
  const sha256 = createHash('sha256')
    .update(`seeded-conversations:${agentId}:${safeCount}`)
    .digest('hex')
  return applyExperienceEvent(initial, {
    subject: { kind: 'agent', id: agentId },
    origin: 'catalog.historical',
    eventId: `seeded-conversations:${agentId}`,
    occurredAt: '2026-10-20T00:00:00.000Z',
    policyVersion: 1,
    kind: 'training.imported',
    manifest: {
      provenance: `catalog://historical/${agentId}`,
      sha256,
      conversationCount: safeCount,
      verification: 'verified',
      coverage: 'disjoint-from-live-and-other-imports',
    },
  })
}

/**
 * Computes agent progression. When an authoritative ExperienceLedger is supplied,
 * it is verified and used. Otherwise, if the agent records seeded conversation counts,
 * those conversations are credited as verified training evidence for earned EXP.
 * Missing inputs remain unavailable instead of receiving a fictional chart/stat.
 */
export function computeAgentProgression(
  agentOrId: string | (AgentStatSource & { id?: string }),
  options: {
    experience?: ExperienceLedger | null
    now?: number
    customSky?: CurrentSkySnapshot | null
  } = {}
): AgentProgressionProfile {
  const agent = typeof agentOrId === 'string' ? getHistoricalAgent(agentOrId) : agentOrId
  const agentId = typeof agentOrId === 'string' ? agentOrId : (agentOrId.id ?? '')
  const result: AgentProgressionProfile = {
    agentId,
    vesselLevel: null,
    totalXp: null,
    xpToNextLevel: null,
    levelBoost: null,
    baseOverall: null,
    trainedOverall: null,
    currentOverall: null,
    transitDelta: null,
    progressionStatus: 'unavailable',
    asOf: null,
    expBreakdown: null,
    trainingEvidence: null,
    stats: null,
    statDeltas: null,
    esmsAxisAttribution: null,
    reasons: [],
  }
  let experience = options.experience
  if (!experience && agent) {
    const rawConversations =
      (agent as any).stats?.conversations ??
      (agent as any).conversations ??
      (typeof agentOrId === 'string'
        ? getHistoricalAgent(agentOrId)?.stats?.conversations
        : undefined)
    if (
      typeof rawConversations === 'number' &&
      Number.isFinite(rawConversations) &&
      rawConversations >= 0
    ) {
      experience = buildSeededAgentExperience(agentId, rawConversations)
    }
  }

  if (experience) {
    if (experience.subject.kind !== 'agent' || experience.subject.id !== agentId) {
      throw new RangeError('Experience belongs to another subject')
    }
    const growth = computeVesselGrowth(experience.totalXp)
    result.vesselLevel = growth.level
    result.totalXp = growth.totalXp
    result.xpToNextLevel = growth.xpToNextLevel
    result.levelBoost = growth.levelBoost
    result.expBreakdown = experience.categoryXp
    result.trainingEvidence = experience.trainingEvidence
  } else {
    result.reasons.push(
      'Permanent experience receipts have not been loaded and no seeded conversations were recorded.'
    )
  }
  if (!agent) {
    result.reasons.push('Agent not found.')
    return result
  }
  try {
    result.stats = resolve19Stats(agent)
  } catch (error) {
    result.reasons.push(error instanceof Error ? error.message : 'Recorded stats are unavailable.')
  }
  if (!experience || !result.stats) return result

  const now = options.now ?? Date.now()
  const chart = agent.consciousness?.natalChart
  const provenance = chart?.provenance
  const natalProvenance =
    provenance === 'computed' || provenance === 'authored' || provenance === 'placeholder'
      ? provenance
      : 'unattributed'
  let positions: Record<string, { longitude: number }> = {}
  try {
    positions = resolveNatalLongitudes(chart?.planets)
  } catch (error) {
    result.reasons.push(error instanceof Error ? error.message : 'Invalid natal chart.')
  }
  let sky: CurrentSkySnapshot | null = null
  try {
    sky = options.customSky === undefined ? getCurrentSkySnapshot(now) : options.customSky
  } catch {
    result.reasons.push('Current sky positions are unavailable.')
  }
  const archetype = resolveArchetype(
    computeRelativeAdvantage(result.stats as Record<SacredStatKey, number>)
  )
  const progression = computeVesselProgression({
    stats: result.stats,
    totalXp: experience.totalXp,
    natal: { provenance: natalProvenance, positions },
    sky,
    character: { primary: archetype.primary, secondary: archetype.secondary },
    now,
  })
  result.baseOverall = progression.baseOverall
  result.trainedOverall = progression.trainedOverall
  result.currentOverall = progression.currentOverall
  result.transitDelta =
    progression.transitDelta !== undefined
      ? progression.transitDelta
      : progression.currentOverall === null
        ? null
        : progression.currentOverall - progression.trainedOverall
  result.progressionStatus = progression.status
  result.asOf = progression.asOf
  result.statDeltas = progression.statDeltas
  result.esmsAxisAttribution = progression.esmsAxisAttribution ?? null
  result.reasons.push(...progression.reasons)
  return result
}
