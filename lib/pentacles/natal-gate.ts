import { prisma } from '@/lib/db'
import { G_MIN, type EsmsElement } from './rate'
import { queryPentaclesSql } from './client'
import type { Transport } from '@/lib/vessel/spacetime-stats'

export interface ElementalScores {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export interface NatalGateResult {
  eligible: boolean
  reason?: 'birth_chart_required' | 'invalid_scores' | 'unsupported'
  message?: string
  gates?: Record<EsmsElement, number>
  dominantElement?: EsmsElement
  normalizedWeights?: Record<EsmsElement, number>
  source?: 'spacetimedb_pentacle_gate' | 'user_natal_charts'
  isImmutable?: boolean
}

/**
 * Computes the 4-element gate vector according to PENTACLE_GATE_V1:
 *   s_k = natalEsms_k / sum_j(natalEsms_j)
 *   gate_k = G_MIN + (1 - G_MIN) * (s_k / max_j(s_j))
 *
 * Enforces strict hard gate: user without a committed birth chart receives
 * eligible: false with 'birth_chart_required'.
 */
export function computeGatesFromScores(scores: ElementalScores): {
  gates: Record<EsmsElement, number>
  normalizedWeights: Record<EsmsElement, number>
  dominantElement: EsmsElement
} {
  const sum = scores.spirit + scores.essence + scores.matter + scores.substance
  if (!Number.isFinite(sum) || sum <= 0) {
    throw new Error('Total elemental score must be positive and finite')
  }

  const s: Record<EsmsElement, number> = {
    spirit: scores.spirit / sum,
    essence: scores.essence / sum,
    matter: scores.matter / sum,
    substance: scores.substance / sum,
  }

  let maxS = 0
  let dominant: EsmsElement = 'spirit'
  for (const el of ['spirit', 'essence', 'matter', 'substance'] as const) {
    if (s[el] > maxS) {
      maxS = s[el]
      dominant = el
    }
  }

  if (maxS <= 0) {
    throw new Error('Maximum elemental weight must be positive')
  }

  const gates: Record<EsmsElement, number> = {
    spirit: G_MIN + (1 - G_MIN) * (s.spirit / maxS),
    essence: G_MIN + (1 - G_MIN) * (s.essence / maxS),
    matter: G_MIN + (1 - G_MIN) * (s.matter / maxS),
    substance: G_MIN + (1 - G_MIN) * (s.substance / maxS),
  }

  return {
    gates,
    normalizedWeights: s,
    dominantElement: dominant,
  }
}

/**
 * Resolves the natal chart for a user and computes their personalized conversion gates.
 * Prioritizes committed immutable pentacle_gate in SpacetimeDB when an identity is available.
 */
export async function resolveUserNatalGate(
  userId: string,
  identity?: string,
  transport?: Transport
): Promise<NatalGateResult> {
  // 1. If identity is known, check SpacetimeDB committed pentacle_gate first
  if (identity) {
    try {
      const rows = await queryPentaclesSql(
        `SELECT spirit_gate, essence_gate, matter_gate, substance_gate, dominant_element, is_immutable FROM pentacle_gate WHERE identity = '${identity}'`,
        transport
      )
      if (rows && rows.length > 0) {
        const row = rows[0]
        return {
          eligible: true,
          gates: {
            spirit: Number(row.spirit_gate),
            essence: Number(row.essence_gate),
            matter: Number(row.matter_gate),
            substance: Number(row.substance_gate),
          },
          dominantElement: (row.dominant_element as EsmsElement) || 'spirit',
          source: 'spacetimedb_pentacle_gate',
          isImmutable: Boolean(row.is_immutable ?? true),
        }
      }
    } catch {
      // Table may not exist yet in SpacetimeDB prior to Phase 4 migration; fallback to local
    }
  }

  // 2. Query active primary natal chart in local DB
  const chart = await prisma.user_natal_charts.findFirst({
    where: {
      userId,
      isActive: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
    select: {
      spiritScore: true,
      essenceScore: true,
      matterScore: true,
      substanceScore: true,
      dominantElement: true,
    },
  })

  if (!chart) {
    // Check fallback user_profiles if chart was seeded there
    const profile = await prisma.user_profiles.findUnique({
      where: { userId },
      select: {
        natalPositions: true,
        dominantElement: true,
      },
    })

    if (!profile?.natalPositions) {
      return {
        eligible: false,
        reason: 'birth_chart_required',
        message:
          'A natal birth chart is required to calibrate your personal pentacle conversion rate. Complete your birth chart in settings to unlock conversion.',
      }
    }
  }

  if (
    chart &&
    Number.isFinite(chart.spiritScore) &&
    Number.isFinite(chart.essenceScore) &&
    Number.isFinite(chart.matterScore) &&
    Number.isFinite(chart.substanceScore) &&
    chart.spiritScore + chart.essenceScore + chart.matterScore + chart.substanceScore > 0
  ) {
    const { gates, normalizedWeights, dominantElement } = computeGatesFromScores({
      spirit: chart.spiritScore,
      essence: chart.essenceScore,
      matter: chart.matterScore,
      substance: chart.substanceScore,
    })

    return {
      eligible: true,
      gates,
      dominantElement,
      normalizedWeights,
      source: 'user_natal_charts',
      isImmutable: false,
    }
  }

  return {
    eligible: false,
    reason: 'birth_chart_required',
    message:
      'A natal birth chart is required to calibrate your personal pentacle conversion rate. Complete your birth chart in settings to unlock conversion.',
  }
}
