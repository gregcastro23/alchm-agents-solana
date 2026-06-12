import { NextResponse } from 'next/server'
import {
  MULTI_CHART_RUNE_CATALOG,
  getAvailableRunesForCharts,
  calculateMultiChartRuneCosts,
  calculateRunePower,
  type ChartCombination,
  type AlchemicalCost,
  type MultiChartRune,
} from '@/lib/runes/multi-chart-runes'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RuneMintingRequest {
  runeId: string
  chartCombination: ChartCombination
  userResources: AlchemicalCost
  currentConditions?: Record<string, boolean>
}

interface MintedRune {
  id: string
  originalRune: MultiChartRune
  mintingSignature: {
    chartCombinationId: string
    participantNames: string[]
    mintingTimestamp: string
    cosmicConditions: Record<string, boolean>
  }
  enhancedProperties: {
    actualPower: number
    actualCosts: AlchemicalCost
    synergyBonus: number
    craftingTime: number
    cooldownRemaining?: number
  }
  activeEffects: {
    effect: string
    power: number
    duration: string
    expiresAt?: string
  }[]
  collectiveParticipants?: {
    name: string
    chartId: string
    contributionPercentage: number
  }[]
}

export async function POST(req: Request) {
  try {
    const {
      runeId,
      chartCombination,
      userResources,
      currentConditions = {},
    }: RuneMintingRequest = await req.json()

    // Validate request
    if (!runeId || !chartCombination || !userResources) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Find the requested rune
    const targetRune = MULTI_CHART_RUNE_CATALOG.find(rune => rune.id === runeId)
    if (!targetRune) {
      return NextResponse.json({ success: false, error: 'Rune not found' }, { status: 404 })
    }

    // Check if rune is available for this chart combination
    const availableRunes = getAvailableRunesForCharts(chartCombination, userResources)
    const isAvailable = availableRunes.some(rune => rune.id === runeId)

    if (!isAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rune not available for this chart combination',
          details: {
            complexity: chartCombination.complexity,
            synergy: chartCombination.synergy,
            requiredSynergy: targetRune.chartRequirements.synergyThreshold || 0,
            chartCount: chartCombination.charts.length,
            requiredChartRange: [
              targetRune.chartRequirements.minCharts,
              targetRune.chartRequirements.maxCharts,
            ],
          },
        },
        { status: 400 }
      )
    }

    // Calculate actual costs and check affordability
    const actualCosts = calculateMultiChartRuneCosts(
      targetRune,
      chartCombination,
      currentConditions
    )

    const canAfford =
      userResources.spirit >= actualCosts.spirit &&
      userResources.essence >= actualCosts.essence &&
      userResources.matter >= actualCosts.matter &&
      userResources.substance >= actualCosts.substance

    if (!canAfford) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient resources',
          required: actualCosts,
          available: userResources,
          shortfall: {
            spirit: Math.max(0, actualCosts.spirit - userResources.spirit),
            essence: Math.max(0, actualCosts.essence - userResources.essence),
            matter: Math.max(0, actualCosts.matter - userResources.matter),
            substance: Math.max(0, actualCosts.substance - userResources.substance),
          },
        },
        { status: 400 }
      )
    }

    // Calculate enhanced properties
    const actualPower = calculateRunePower(targetRune, chartCombination)
    const synergyBonus = chartCombination.synergy / 100
    const craftingTime = Math.round(targetRune.craftingTime * (2 - synergyBonus)) // High synergy reduces time

    // Create minted rune
    const mintedRune: MintedRune = {
      id: `minted_${runeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalRune: targetRune,
      mintingSignature: {
        chartCombinationId: chartCombination.id,
        participantNames: chartCombination.charts.map(c => c.name),
        mintingTimestamp: new Date().toISOString(),
        cosmicConditions: currentConditions,
      },
      enhancedProperties: {
        actualPower,
        actualCosts,
        synergyBonus,
        craftingTime,
        cooldownRemaining: targetRune.cooldown,
      },
      activeEffects: [
        ...targetRune.effects.map(effect => ({
          effect: effect.description,
          power: Math.round(effect.power * (actualPower / 100)),
          duration: effect.duration,
          expiresAt:
            effect.duration !== 'permanent' && effect.duration !== 'instant'
              ? calculateExpirationTime(effect.duration, craftingTime).toISOString()
              : undefined,
        })),
        ...(targetRune.collectiveEffects || []).map(effect => ({
          effect: `[Collective] ${effect.description}`,
          power: Math.round(effect.power * (actualPower / 100)),
          duration: effect.duration,
          expiresAt:
            effect.duration !== 'permanent' && effect.duration !== 'instant'
              ? calculateExpirationTime(effect.duration, craftingTime).toISOString()
              : undefined,
        })),
      ],
      collectiveParticipants:
        chartCombination.charts.length > 1
          ? generateParticipantContributions(chartCombination)
          : undefined,
    }

    return NextResponse.json({
      success: true,
      mintedRune,
      transaction: {
        timestamp: new Date().toISOString(),
        resourcesSpent: actualCosts,
        remainingResources: {
          spirit: userResources.spirit - actualCosts.spirit,
          essence: userResources.essence - actualCosts.essence,
          matter: userResources.matter - actualCosts.matter,
          substance: userResources.substance - actualCosts.substance,
          totalCost: userResources.totalCost - actualCosts.totalCost,
        },
        cosmicConditions: currentConditions,
        discountsApplied: Object.keys(currentConditions).filter(k => currentConditions[k]),
      },
      monicaInsight: generateMonicaInsight(mintedRune, chartCombination),
      nextSteps: {
        activationTime: `${craftingTime} minutes`,
        coolingDown: targetRune.cooldown ? `${targetRune.cooldown} hours` : false,
        recommendedActions: generateRecommendations(mintedRune, chartCombination),
      },
    })
  } catch (error) {
    console.error('Error in rune minting API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to mint rune',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate when an effect expires based on duration
 */
function calculateExpirationTime(duration: string, craftingTimeMinutes: number): Date {
  const now = new Date()
  const craftingComplete = new Date(now.getTime() + craftingTimeMinutes * 60 * 1000)

  switch (duration) {
    case 'hours':
      return new Date(craftingComplete.getTime() + 8 * 60 * 60 * 1000) // 8 hours
    case 'days':
      return new Date(craftingComplete.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    default:
      return craftingComplete
  }
}

/**
 * Calculate participant contributions for collective runes
 */
function generateParticipantContributions(chartCombination: ChartCombination) {
  const totalANumber = chartCombination.combinedSignature.totalANumber

  return chartCombination.charts.map(chart => ({
    name: chart.name,
    chartId: chart.id,
    contributionPercentage: Math.round(((chart.alchmSignature?.aNumber || 0) / totalANumber) * 100),
  }))
}

/**
 * Generate Monica's insight about the minted rune
 */
function generateMonicaInsight(mintedRune: MintedRune, chartCombination: ChartCombination): string {
  const rune = mintedRune.originalRune
  const power = mintedRune.enhancedProperties.actualPower
  const synergy = chartCombination.synergy
  const complexity = chartCombination.complexity

  const insights = [
    `This ${rune.name} has been successfully minted with ${power}% power enhancement!`,
    `Your ${complexity} chart combination achieved ${synergy}% synergy.`,
    `The ${chartCombination.dominantElement} element dominance amplifies the rune's natural resonance.`,
  ]

  if (synergy > 80) {
    insights.push(
      'Exceptional harmony between charts has created a truly powerful consciousness tool.'
    )
  } else if (synergy > 60) {
    insights.push(
      "Good compatibility has enhanced this rune's effectiveness beyond its base power."
    )
  }

  if (mintedRune.collectiveParticipants) {
    insights.push(
      `All ${mintedRune.collectiveParticipants.length} participants will benefit from the collective effects.`
    )
  }

  return insights.join(' ')
}

/**
 * Generate recommendations for rune usage
 */
function generateRecommendations(
  mintedRune: MintedRune,
  chartCombination: ChartCombination
): string[] {
  const recommendations: string[] = []
  const rune = mintedRune.originalRune

  recommendations.push(
    `Allow ${mintedRune.enhancedProperties.craftingTime} minutes for the rune to fully activate`
  )

  if (rune.runeType === 'cosmic') {
    recommendations.push('Use during meditation or spiritual practice for maximum effect')
  }

  if (rune.runeType === 'utility' && chartCombination.complexity === 'collective') {
    recommendations.push('Coordinate with all participants for synchronized activation')
  }

  if (mintedRune.enhancedProperties.cooldownRemaining) {
    recommendations.push(
      `Wait ${mintedRune.enhancedProperties.cooldownRemaining} hours before minting another ${rune.rarity} rune`
    )
  }

  return recommendations
}
