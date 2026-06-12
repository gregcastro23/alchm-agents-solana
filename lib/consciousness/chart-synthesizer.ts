import { synthesizeCharts, type SynthesizedChart, type ChartSynthesisInput } from '@/lib/utils'

type ChartInput = {
  birthChart: any | null
  momentChart: any
  additionalCharts?: any[]
}

export class ChartSynthesizer {
  /**
   * Main synthesis method for full chart blending
   */
  synthesize({ birthChart, momentChart, additionalCharts = [] }: ChartInput): SynthesizedChart {
    return synthesizeCharts({ birthChart, momentChart, additionalCharts })
  }

  /**
   * Partial synthesis method for moment-only charts
   */
  synthesizeMomentOnly(momentChart: any): SynthesizedChart {
    if (!momentChart) {
      throw new Error('Moment chart is required for moment-only synthesis')
    }
    return synthesizeCharts({ birthChart: null, momentChart, additionalCharts: [] })
  }

  /**
   * Synthesis method for birth chart + moment chart only
   */
  synthesizeBirthMoment(birthChart: any, momentChart: any): SynthesizedChart {
    if (!birthChart || !momentChart) {
      throw new Error('Both birth chart and moment chart are required for birth-moment synthesis')
    }
    return synthesizeCharts({ birthChart, momentChart, additionalCharts: [] })
  }

  /**
   * Multi-chart synthesis with validation
   */
  synthesizeMultiChart(input: ChartSynthesisInput): SynthesizedChart {
    const { birthChart, momentChart, additionalCharts = [] } = input

    if (!momentChart) {
      throw new Error('Moment chart is required for multi-chart synthesis')
    }

    if (additionalCharts.length === 0) {
      throw new Error('At least one additional chart is required for multi-chart synthesis')
    }

    // Validate that all charts have required alchemy effects
    const allCharts = [momentChart, ...(birthChart ? [birthChart] : []), ...additionalCharts]
    for (let i = 0; i < allCharts.length; i++) {
      if (!allCharts[i]?.['Alchemy Effects']) {
        throw new Error(`Chart at index ${i} is missing required Alchemy Effects`)
      }
    }

    return synthesizeCharts(input)
  }

  /**
   * Validate chart data structure
   */
  validateChart(chart: any): boolean {
    if (!chart) return false

    // Check for required alchemy effects structure
    const alchemyEffects = chart['Alchemy Effects']
    if (!alchemyEffects) return false

    const requiredFields = ['Total Spirit', 'Total Essence', 'Total Matter', 'Total Substance']
    for (const field of requiredFields) {
      if (typeof alchemyEffects[field] !== 'number') {
        return false
      }
    }

    return true
  }

  /**
   * Get synthesis statistics for analysis
   */
  getSynthesisStats(synthesizedChart: SynthesizedChart): {
    chartCount: number
    dominantElement: string
    synthesisEfficiency: number
    monicaConstantRange: { min: number; max: number; avg: number }
  } {
    const chartCount = synthesizedChart.sourceCharts.length

    // Calculate monica constants from source charts
    const monicaConstants = synthesizedChart.sourceCharts
      .map(chart => {
        if (!chart?.['Alchemy Effects']) return 0
        return (
          (chart['Alchemy Effects']['Total Spirit'] || 0) +
          (chart['Alchemy Effects']['Total Essence'] || 0) +
          (chart['Alchemy Effects']['Total Matter'] || 0) +
          (chart['Alchemy Effects']['Total Substance'] || 0)
        )
      })
      .filter(val => val > 0)

    const min = Math.min(...monicaConstants)
    const max = Math.max(...monicaConstants)
    const avg = monicaConstants.reduce((a, b) => a + b, 0) / monicaConstants.length

    // Determine dominant element from consciousness values
    const { spirit, essence, matter, substance } = synthesizedChart.consciousness
    const elements = [
      { name: 'spirit', value: spirit },
      { name: 'essence', value: essence },
      { name: 'matter', value: matter },
      { name: 'substance', value: substance },
    ]
    const dominant = elements.reduce((prev, current) =>
      current.value > prev.value ? current : prev
    )

    // Calculate synthesis efficiency (how well the synthesis preserved total energy)
    const totalInputEnergy = monicaConstants.reduce((sum, val) => sum + val, 0)
    const synthesisEfficiency =
      totalInputEnergy > 0 ? synthesizedChart.monicaConstant / totalInputEnergy : 0

    return {
      chartCount,
      dominantElement: dominant.name,
      synthesisEfficiency,
      monicaConstantRange: { min, max, avg },
    }
  }
}
