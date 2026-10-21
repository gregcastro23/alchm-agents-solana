/** Browser-safe, complete validation of the admin Vessel and legacy EV report. */
import { z } from 'zod'
import { AdminAlertSchema } from '@/lib/admin/page-schemas'
import type { AgentProgressionProfile } from '@/lib/agents/leveling-service'

const count = z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const overall = z.number().finite().min(25).max(99)
const level = z.number().int().min(1).max(100)
const stat = z.number().finite()
const stats = z.object({
  power: stat,
  resonance: stat,
  wisdom: stat,
  charisma: stat,
  intuition: stat,
  adaptability: stat,
  vitality: stat,
  solarAgency: stat,
  lunarReceptivity: stat,
  mercurialVelocity: stat,
  venusianCoherence: stat,
  martialImpetus: stat,
  jovianExpansion: stat,
  saturnianStructure: stat,
  chironicAdaptation: stat,
  uranianSurprisal: stat,
  neptunianResonance: stat,
  plutonicIntegration: stat,
  kineticAlignment: stat,
})

export const AgentProgressionProfileSchema = z.object({
  agentId: z.string(),
  vesselLevel: level.nullable(),
  totalXp: count.nullable(),
  xpToNextLevel: count.nullable(),
  levelBoost: z.number().finite().min(0).max(12).nullable(),
  baseOverall: overall.nullable(),
  trainedOverall: overall.nullable(),
  currentOverall: overall.nullable(),
  transitDelta: z.number().finite().min(-8).max(8).nullable(),
  progressionStatus: z.enum(['live', 'estimated', 'unavailable']),
  asOf: z.string().datetime().nullable(),
  expBreakdown: z
    .object({
      chat: count,
      training: count,
      actions: count,
      achievements: count,
      pentacles: count,
    })
    .nullable(),
  trainingEvidence: z
    .object({
      status: z.enum(['unknown', 'verified-manifests']),
      importedConversations: count.nullable(),
    })
    .nullable(),
  stats: stats.nullable(),
  statDeltas: stats.nullable(),
  reasons: z.array(z.string()),
}) satisfies z.ZodType<AgentProgressionProfile>

function section<T extends z.ZodTypeAny>(value: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value }),
    z.object({ ok: z.literal(false), reason: z.string() }),
  ])
}

export const LegacyLevelingSchema = z.object({
  totals: z.object({
    agents: count,
    avgLevel: z.number().finite().min(1).max(100).nullable(),
    maxedLevel100: count,
    totalEvsTrained: count,
    evTotalCap: count,
    agentsWithEvs: count,
  }),
  inTraining: z.array(
    z.object({
      agentId: z.string(),
      name: z.string(),
      level,
      evTotal: count,
      lastTrainingPartner: z.string().nullable(),
    })
  ),
})

export const LevelingReportSchema = z.object({
  success: z.literal(true),
  generatedAt: z.string().datetime(),
  progression: section(
    z.object({
      totals: z.object({
        agents: count,
        withExperience: count,
        pendingExperience: count,
        totalXp: count,
        avgVesselLevel: z.number().finite().min(1).max(100).nullable(),
        /** Highest recorded Vessel Level; zero when no agent has experience evidence. */
        maxLevel: z.number().int().min(0).max(100),
        live: count,
        estimated: count,
        unavailable: count,
      }),
      distribution: z.array(z.object({ band: z.string(), count })),
      agents: z.array(AgentProgressionProfileSchema.extend({ name: z.string() })),
    })
  ),
  legacy: section(LegacyLevelingSchema),
  alerts: z.array(AdminAlertSchema),
})

export type LevelingReport = z.infer<typeof LevelingReportSchema>
export type LegacyLeveling = z.infer<typeof LegacyLevelingSchema>
