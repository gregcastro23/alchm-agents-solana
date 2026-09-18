import { prisma } from '@/lib/db'
import { G_MIN, type EsmsElement } from './rate'

export interface ElementalScores {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export interface NatalGateResult {
  eligible: boolean
  reason?: 'birth_chart_required' | 'invalid_scores'
  message?: string
  gates?: Record<EsmsElement, number>
  dominantElement?: EsmsElement
  normalizedWeights?: Record<EsmsElement, number>
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
 */
export async function resolveUserNatalGate(userId: string): Promise<NatalGateResult> {
  // Query active primary natal chart
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
    }
  }

  return {
    eligible: false,
    reason: 'birth_chart_required',
    message:
      'A natal birth chart is required to calibrate your personal pentacle conversion rate. Complete your birth chart in settings to unlock conversion.',
  }
}
