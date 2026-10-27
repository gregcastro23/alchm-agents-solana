/** Representative validated admin progression data, also usable for visual inspection. */
import { LevelingReportSchema, type LevelingReport } from '@/lib/admin/leveling-schema'
import { ALL_VESSEL_STAT_KEYS } from '@/lib/vessel/progression'

const OBSERVED_AT = '2026-10-20T16:00:00.000Z'
const stats = Object.fromEntries(ALL_VESSEL_STAT_KEYS.map((key, index) => [key, 60 + index]))
const statDeltas = Object.fromEntries(ALL_VESSEL_STAT_KEYS.map(key => [key, 0]))

export function levelingFixture(options: { legacyFails?: boolean } = {}): LevelingReport {
  return LevelingReportSchema.parse({
    success: true,
    alerts: [],
    generatedAt: OBSERVED_AT,
    progression: {
      ok: true,
      value: {
        totals: {
          agents: 4,
          withExperience: 3,
          pendingExperience: 1,
          totalXp: 1_019_725,
          avgVesselLevel: 38.7,
          maxLevel: 100,
          live: 2,
          estimated: 1,
          unavailable: 1,
        },
        distribution: [
          { band: 'Maxed (100)', count: 1 },
          { band: 'Legends (90–99)', count: 0 },
          { band: 'Adepts (50–89)', count: 0 },
          { band: 'Apprentices (2–49)', count: 1 },
          { band: 'New Vessels (1)', count: 1 },
          { band: 'Experience pending', count: 1 },
        ],
        // Deliberately unordered: the UI must apply the chosen sort.
        agents: [
          {
            agentId: 'rumi',
            name: 'Rumi',
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
            reasons: ['No recorded experience is connected.'],
          },
          {
            agentId: 'ada-lovelace',
            name: 'Ada Lovelace',
            vesselLevel: 15,
            totalXp: 19_725,
            xpToNextLevel: 2_775,
            levelBoost: 1.6969,
            baseOverall: 78.4,
            trainedOverall: 80.1,
            currentOverall: 82.3,
            transitDelta: 2.2,
            progressionStatus: 'live',
            asOf: OBSERVED_AT,
            expBreakdown: { chat: 0, training: 19_725, actions: 0, achievements: 0, pentacles: 0 },
            trainingEvidence: { status: 'verified-manifests', importedConversations: 789 },
            stats,
            statDeltas: { ...statDeltas, power: 1.5, solarAgency: -0.5 },
            reasons: [],
          },
          {
            agentId: 'zeno-of-citium',
            name: 'Zeno of Citium',
            vesselLevel: 1,
            totalXp: 0,
            xpToNextLevel: 100,
            levelBoost: 0,
            baseOverall: 62,
            trainedOverall: 62,
            currentOverall: 62,
            transitDelta: 0,
            progressionStatus: 'live',
            asOf: OBSERVED_AT,
            expBreakdown: { chat: 0, training: 0, actions: 0, achievements: 0, pentacles: 0 },
            trainingEvidence: { status: 'verified-manifests', importedConversations: 0 },
            stats,
            statDeltas,
            reasons: [],
          },
          {
            agentId: 'isaac-newton',
            name: 'Isaac Newton',
            vesselLevel: 100,
            totalXp: 1_000_000,
            xpToNextLevel: null,
            levelBoost: 12,
            baseOverall: 70,
            trainedOverall: 82,
            currentOverall: 79.5,
            transitDelta: -2.5,
            progressionStatus: 'estimated',
            asOf: OBSERVED_AT,
            expBreakdown: {
              chat: 0,
              training: 1_000_000,
              actions: 0,
              achievements: 0,
              pentacles: 0,
            },
            trainingEvidence: { status: 'verified-manifests', importedConversations: 40_000 },
            stats,
            statDeltas: { ...statDeltas, power: -1.5 },
            reasons: ['Sky positions use the VSOP87 approximation.'],
          },
        ],
      },
    },
    legacy: options.legacyFails
      ? { ok: false, reason: 'Legacy EV database is unavailable.' }
      : {
          ok: true,
          value: {
            totals: {
              agents: 4,
              avgLevel: 100,
              maxedLevel100: 4,
              totalEvsTrained: 75,
              evTotalCap: 510,
              agentsWithEvs: 1,
            },
            inTraining: [
              {
                agentId: 'rumi',
                name: 'Rumi',
                level: 100,
                evTotal: 75,
                lastTrainingPartner: 'Ada Lovelace',
              },
            ],
          },
        },
  })
}
