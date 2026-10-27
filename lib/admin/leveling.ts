import 'server-only'

import type { AdminAlert } from '@/lib/admin/alerts'
import {
  AgentProgressionProfileSchema,
  LegacyLevelingSchema,
  type LegacyLeveling,
  type LevelingReport,
} from '@/lib/admin/leveling-schema'
import { readSection } from '@/lib/admin/section'
import {
  computeAgentProgression,
  type AgentProgressionProfile,
} from '@/lib/agents/leveling-service'
import { EV_TOTAL_CAP } from '@/lib/consciousness-engine'
import { prisma } from '@/lib/db'
import { getCurrentSkySnapshot, type CurrentSkySnapshot } from '@/lib/vessel/sky-provider'
import type { AgentStatSource } from '@/lib/vessel/stat-resolver'

export type { LevelingReport } from '@/lib/admin/leveling-schema'

export type LevelingCatalogAgent = AgentStatSource & { id: string; name: string }
export interface LevelingReportSources {
  readCatalog(): Promise<LevelingCatalogAgent[]>
  readLegacy(): Promise<LegacyLeveling>
  getSky?(now: number): CurrentSkySnapshot | null
  computeProgression?(
    agent: LevelingCatalogAgent,
    options: { now: number; customSky: CurrentSkySnapshot | null }
  ): AgentProgressionProfile
}

function unavailableProfile(agentId: string, error: unknown): AgentProgressionProfile {
  return {
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
    reasons: [error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300)],
  }
}

/** A read-only projection: catalog experience and legacy Prisma EVs never substitute for each other. */
export async function buildLevelingReport(
  sources: LevelingReportSources,
  now: Date = new Date()
): Promise<LevelingReport> {
  let skyFailure: string | null = null
  const [progression, legacy] = await Promise.all([
    readSection(async () => {
      const catalog = await sources.readCatalog()
      // A single observed sky and clock are shared by the entire roster. An outage
      // still permits permanent EXP and baseline calculations for every agent.
      let sky: CurrentSkySnapshot | null = null
      try {
        sky = (sources.getSky ?? getCurrentSkySnapshot)(now.getTime())
        if (!sky) skyFailure = 'Current sky snapshot is unavailable.'
      } catch (error) {
        skyFailure = error instanceof Error ? error.message : String(error)
        sky = null
      }
      const compute = sources.computeProgression ?? computeAgentProgression
      const agents = catalog
        .map(agent => {
          let profile: AgentProgressionProfile
          try {
            profile = AgentProgressionProfileSchema.parse(
              compute(agent, {
                now: now.getTime(),
                customSky: sky,
              })
            )
            if (profile.agentId !== agent.id)
              throw new Error('Progression belongs to another agent.')
          } catch (error) {
            profile = unavailableProfile(agent.id, error)
          }
          return { ...profile, name: agent.name }
        })
        .sort(
          (a, b) =>
            (b.vesselLevel ?? -1) - (a.vesselLevel ?? -1) ||
            (b.totalXp ?? -1) - (a.totalXp ?? -1) ||
            a.name.localeCompare(b.name)
        )
      const known = agents.filter(a => a.vesselLevel !== null && a.totalXp !== null)
      const bands = [
        { band: 'Maxed (100)', minimum: 100, maximum: 100 },
        { band: 'Legends (90–99)', minimum: 90, maximum: 99 },
        { band: 'Adepts (50–89)', minimum: 50, maximum: 89 },
        { band: 'Apprentices (2–49)', minimum: 2, maximum: 49 },
        { band: 'New Vessels (1)', minimum: 1, maximum: 1 },
      ]
      return {
        totals: {
          agents: agents.length,
          withExperience: known.length,
          pendingExperience: agents.length - known.length,
          totalXp: known.reduce((sum, agent) => sum + agent.totalXp!, 0),
          avgVesselLevel: known.length
            ? Math.round(
                (known.reduce((sum, agent) => sum + agent.vesselLevel!, 0) / known.length) * 10
              ) / 10
            : null,
          maxLevel: known.reduce((max, agent) => Math.max(max, agent.vesselLevel!), 0),
          live: agents.filter(a => a.progressionStatus === 'live').length,
          estimated: agents.filter(a => a.progressionStatus === 'estimated').length,
          unavailable: agents.filter(a => a.progressionStatus === 'unavailable').length,
        },
        distribution: [
          ...bands.map(({ band, minimum, maximum }) => ({
            band,
            count: known.filter(a => a.vesselLevel! >= minimum && a.vesselLevel! <= maximum).length,
          })),
          { band: 'Experience pending', count: agents.length - known.length },
        ],
        agents,
      }
    }),
    readSection(async () => LegacyLevelingSchema.parse(await sources.readLegacy())),
  ])
  const alerts: AdminAlert[] = []
  if (skyFailure) {
    alerts.push({
      id: 'agents:leveling:sky:unreadable',
      severity: 'warning',
      source: 'agents',
      title: 'Current sky could not be read',
      detail: `${skyFailure} Known permanent EXP and baseline capability are preserved.`,
      href: '/admin/leveling',
    })
  }
  for (const [key, label, section] of [
    ['progression', 'Vessel progression', progression],
    ['legacy', 'Legacy cosmic EV training', legacy],
  ] as const) {
    if (!section.ok) {
      alerts.push({
        id: `agents:leveling:${key}:unreadable`,
        severity: 'warning',
        source: 'agents',
        title: `${label} could not be read`,
        detail: section.reason,
        href: '/admin/leveling',
      })
    }
  }
  return { success: true, generatedAt: now.toISOString(), progression, legacy, alerts }
}

/** Existing cosmic EV/cubic-level telemetry; it is not the permanent Vessel EXP ledger. */
export async function readLegacyLeveling(): Promise<LegacyLeveling> {
  const h = prisma.historical_agents
  const [agents, maxedLevel100, agentsWithEvs, aggregate, inTraining] = await Promise.all([
    h.count(),
    h.count({ where: { level: 100 } }),
    h.count({ where: { evTotal: { gt: 0 } } }),
    h.aggregate({ _avg: { level: true }, _sum: { evTotal: true } }),
    h.findMany({
      where: { evTotal: { gt: 0 } },
      orderBy: [{ evTotal: 'desc' }, { agentId: 'asc' }],
      take: 12,
      select: { agentId: true, name: true, level: true, evTotal: true, lastTrainingPartner: true },
    }),
  ])
  return {
    totals: {
      agents,
      avgLevel: aggregate._avg.level === null ? null : Math.round(aggregate._avg.level * 10) / 10,
      maxedLevel100,
      totalEvsTrained: aggregate._sum.evTotal ?? 0,
      evTotalCap: EV_TOTAL_CAP,
      agentsWithEvs,
    },
    inTraining,
  }
}

export async function loadLevelingReport(now: Date = new Date()): Promise<LevelingReport> {
  return buildLevelingReport(
    {
      async readCatalog() {
        const { HISTORICAL_AGENTS } = await import('@/lib/agents/historical')
        return HISTORICAL_AGENTS
      },
      readLegacy: readLegacyLeveling,
    },
    now
  )
}
