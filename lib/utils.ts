import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`
}

export interface ChartSynthesisInput {
  birthChart: any | null
  momentChart: any
  additionalCharts?: any[]
}

export interface SynthesizedChart {
  type: 'moment-only' | 'birth-moment' | 'multi-chart'
  baseChart: any | null
  momentChart: any
  transits: Record<string, any>
  activatedHouses: string[]
  consciousness: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
  monicaConstant: number
  dominantInfluence: string
  sourceCharts: any[]
}

export function synthesizeCharts({
  birthChart,
  momentChart,
  additionalCharts = [],
}: ChartSynthesisInput): SynthesizedChart {
  // Validate input charts
  if (!momentChart) {
    throw new Error('Moment chart is required for synthesis')
  }

  // Handle moment-only synthesis first (before any averaging)
  if (!birthChart && additionalCharts.length === 0) {
    const alchemyEffects = momentChart?.['Alchemy Effects'] || {}
    const spirit = alchemyEffects['Total Spirit'] || 0
    const essence = alchemyEffects['Total Essence'] || 0
    const matter = alchemyEffects['Total Matter'] || 0
    const substance = alchemyEffects['Total Substance'] || 0
    const monicaConstant = spirit + essence + matter + substance

    return {
      type: 'moment-only',
      baseChart: null,
      momentChart,
      transits: momentChart?.transits || {},
      activatedHouses: Array.from(new Set(momentChart?.activatedHouses || [])) as string[],
      consciousness: { spirit, essence, matter, substance },
      monicaConstant,
      dominantInfluence: 'moment-dominant',
      sourceCharts: [momentChart],
    }
  }

  // Collect all valid charts for averaging
  const allCharts = [momentChart]
  if (birthChart) allCharts.push(birthChart)
  allCharts.push(...additionalCharts.filter(chart => chart != null))

  // Average alchemical values across all charts
  const totalCharts = allCharts.length
  let totalSpirit = 0
  let totalEssence = 0
  let totalMatter = 0
  let totalSubstance = 0

  const transits: Record<string, any> = {}
  const activatedHouses: string[] = []

  for (const chart of allCharts) {
    if (chart?.['Alchemy Effects']) {
      totalSpirit += chart['Alchemy Effects']['Total Spirit'] || 0
      totalEssence += chart['Alchemy Effects']['Total Essence'] || 0
      totalMatter += chart['Alchemy Effects']['Total Matter'] || 0
      totalSubstance += chart['Alchemy Effects']['Total Substance'] || 0
    }

    // Merge transits from all charts
    if (chart?.transits) {
      Object.assign(transits, chart.transits)
    }

    // Collect activated houses from all charts
    if (chart?.activatedHouses && Array.isArray(chart.activatedHouses)) {
      activatedHouses.push(...chart.activatedHouses)
    }
  }

  // Calculate averaged alchemical values
  const spirit = totalSpirit / totalCharts
  const essence = totalEssence / totalCharts
  const matter = totalMatter / totalCharts
  const substance = totalSubstance / totalCharts

  // For multi-chart synthesis, use weighted calculation
  const momentWeight = 0.6
  const otherWeight = 0.4 / (totalCharts - 1) // Distribute remaining weight among other charts

  let weightedMonicaConstant = 0
  if (momentChart?.['Alchemy Effects']) {
    weightedMonicaConstant +=
      momentWeight *
      ((momentChart['Alchemy Effects']['Total Spirit'] || 0) +
        (momentChart['Alchemy Effects']['Total Essence'] || 0) +
        (momentChart['Alchemy Effects']['Total Matter'] || 0) +
        (momentChart['Alchemy Effects']['Total Substance'] || 0))
  }

  // Add contributions from other charts
  for (const chart of allCharts.slice(1)) {
    if (chart?.['Alchemy Effects']) {
      weightedMonicaConstant +=
        otherWeight *
        ((chart['Alchemy Effects']['Total Spirit'] || 0) +
          (chart['Alchemy Effects']['Total Essence'] || 0) +
          (chart['Alchemy Effects']['Total Matter'] || 0) +
          (chart['Alchemy Effects']['Total Substance'] || 0))
    }
  }

  // Determine dominant influence
  const determineDominantInfluence = (): string => {
    if (additionalCharts.length > 0) return 'multi-synthesis'
    if (birthChart) return 'birth-moment-balance'
    return 'moment-dominant'
  }

  // Remove duplicate activated houses
  const uniqueActivatedHouses = [...new Set(activatedHouses)]

  return {
    type: birthChart
      ? additionalCharts.length > 0
        ? 'multi-chart'
        : 'birth-moment'
      : 'moment-only',
    baseChart: birthChart,
    momentChart,
    transits,
    activatedHouses: uniqueActivatedHouses,
    consciousness: { spirit, essence, matter, substance },
    monicaConstant: weightedMonicaConstant,
    dominantInfluence: determineDominantInfluence(),
    sourceCharts: allCharts,
  }
}

export function determineConsciousnessLevel(monicaConstant: number): string {
  if (monicaConstant >= 8) return 'Transcendent'
  if (monicaConstant >= 6) return 'Illuminated'
  if (monicaConstant >= 4.5) return 'Advanced'
  if (monicaConstant >= 3) return 'Elevated'
  if (monicaConstant >= 1.5) return 'Active'
  if (monicaConstant >= 0.8) return 'Awakening'
  return 'Dormant'
}
