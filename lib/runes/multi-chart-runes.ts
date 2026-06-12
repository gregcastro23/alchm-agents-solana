/**
 * Multi-Chart Runes System
 *
 * Advanced rune minting system where rune power and complexity scales
 * with the number of astrological charts involved in the minting process.
 */

import { AlchemicalCost, RuneEffect, Rune } from './rune-system'

export type { AlchemicalCost } from './rune-system'

export type ChartComplexity = 'solo' | 'dual' | 'trinity' | 'collective'

export interface BirthChart {
  id: string
  name: string
  birthDate: string
  birthTime?: string
  birthLocation?: string
  alchmSignature?: {
    spirit: number
    essence: number
    matter: number
    substance: number
    aNumber: number
  }
  elementalBalance?: {
    fire: number
    earth: number
    air: number
    water: number
  }
}

export interface ChartCombination {
  id: string
  charts: BirthChart[]
  complexity: ChartComplexity
  synergy: number // 0-100 compatibility score
  combinedSignature: {
    spirit: number
    essence: number
    matter: number
    substance: number
    totalANumber: number
    averageANumber: number
  }
  dominantElement: 'fire' | 'earth' | 'air' | 'water' | 'spirit'
  harmonicResonance: number // 1.0 to 3.0 multiplier
  relationship?: {
    type: 'romantic' | 'friendship' | 'family' | 'business' | 'spiritual'
    dynamics: string[]
  }
}

export interface MultiChartRune extends Rune {
  chartRequirements: {
    complexity: ChartComplexity
    minCharts: number
    maxCharts: number
    synergyThreshold?: number
    relationshipTypes?: string[]
  }
  powerScaling: {
    baseMultiplier: number
    chartMultiplier: number // Additional power per extra chart
    synergyBonus: number // Bonus based on chart compatibility
  }
  collectiveEffects?: RuneEffect[] // Additional effects for multi-chart runes
}

// Enhanced Rune Catalog with Multi-Chart Support
export const MULTI_CHART_RUNE_CATALOG: MultiChartRune[] = [
  // SOLO RUNES (Current chart only)
  {
    id: 'personal_awareness',
    name: 'Personal Awareness Rune',
    symbol: '●',
    element: 'spirit',
    runeType: 'utility',
    baseCost: { spirit: 5, essence: 3, matter: 2, substance: 1, totalCost: 11 },
    currentCost: { spirit: 5, essence: 3, matter: 2, substance: 1, totalCost: 11 },
    effects: [
      {
        type: 'consciousness',
        power: 40,
        duration: 'hours',
        description: 'Enhances personal awareness and self-reflection for 6 hours',
      },
    ],
    requirements: { minANumber: 10 },
    rarity: 'common',
    description: 'A foundational rune crafted from your current cosmic moment',
    craftingTime: 10,
    chartRequirements: {
      complexity: 'solo',
      minCharts: 0,
      maxCharts: 0,
    },
    powerScaling: {
      baseMultiplier: 1.0,
      chartMultiplier: 0,
      synergyBonus: 0,
    },
  },

  // DUAL RUNES (Current + Birth chart)
  {
    id: 'soul_resonance',
    name: 'Soul Resonance Rune',
    symbol: '◐',
    element: 'spirit',
    runeType: 'cosmic',
    baseCost: { spirit: 8, essence: 6, matter: 4, substance: 3, totalCost: 21 },
    currentCost: { spirit: 8, essence: 6, matter: 4, substance: 3, totalCost: 21 },
    effects: [
      {
        type: 'consciousness',
        power: 70,
        duration: 'days',
        description: 'Aligns current moment with birth potential for 3 days',
      },
    ],
    requirements: { minANumber: 15 },
    rarity: 'uncommon',
    description: 'Harmonizes your birth chart with the current cosmic moment',
    craftingTime: 25,
    chartRequirements: {
      complexity: 'dual',
      minCharts: 1,
      maxCharts: 1,
    },
    powerScaling: {
      baseMultiplier: 1.5,
      chartMultiplier: 0.5,
      synergyBonus: 0.3,
    },
  },

  {
    id: 'destiny_anchor',
    name: 'Destiny Anchor Rune',
    symbol: '⚓',
    element: 'earth',
    runeType: 'temporal',
    baseCost: { spirit: 12, essence: 8, matter: 10, substance: 5, totalCost: 35 },
    currentCost: { spirit: 12, essence: 8, matter: 10, substance: 5, totalCost: 35 },
    effects: [
      {
        type: 'manifestation',
        power: 85,
        duration: 'permanent',
        description: 'Creates permanent anchor point between birth potential and current reality',
      },
    ],
    requirements: { minANumber: 25 },
    rarity: 'rare',
    description: 'Establishes unbreakable connection between your birth blueprint and current path',
    craftingTime: 45,
    chartRequirements: {
      complexity: 'dual',
      minCharts: 1,
      maxCharts: 1,
      synergyThreshold: 60,
    },
    powerScaling: {
      baseMultiplier: 2.0,
      chartMultiplier: 0.8,
      synergyBonus: 0.5,
    },
  },

  // TRINITY RUNES (Current + Your + Another person)
  {
    id: 'relationship_harmony',
    name: 'Relationship Harmony Rune',
    symbol: '♾',
    element: 'water',
    runeType: 'utility',
    baseCost: { spirit: 10, essence: 12, matter: 6, substance: 8, totalCost: 36 },
    currentCost: { spirit: 10, essence: 12, matter: 6, substance: 8, totalCost: 36 },
    effects: [
      {
        type: 'enhancement',
        power: 80,
        duration: 'days',
        description: 'Enhances understanding and harmony between connected individuals for 7 days',
      },
    ],
    collectiveEffects: [
      {
        type: 'consciousness',
        power: 60,
        duration: 'days',
        description: 'Both parties experience increased empathy and communication clarity',
      },
    ],
    requirements: { minANumber: 20 },
    rarity: 'rare',
    description: 'Weaves three charts into a harmony-generating consciousness tool',
    craftingTime: 60,
    chartRequirements: {
      complexity: 'trinity',
      minCharts: 2,
      maxCharts: 2,
      synergyThreshold: 50,
      relationshipTypes: ['romantic', 'friendship', 'family'],
    },
    powerScaling: {
      baseMultiplier: 2.5,
      chartMultiplier: 1.0,
      synergyBonus: 0.8,
    },
  },

  {
    id: 'synergy_amplifier',
    name: 'Synergy Amplifier Rune',
    symbol: '⚡',
    element: 'fire',
    runeType: 'offensive',
    baseCost: { spirit: 15, essence: 10, matter: 8, substance: 12, totalCost: 45 },
    currentCost: { spirit: 15, essence: 10, matter: 8, substance: 12, totalCost: 45 },
    effects: [
      {
        type: 'enhancement',
        power: 95,
        duration: 'hours',
        description: 'Dramatically amplifies shared abilities and mutual strengths for 12 hours',
      },
    ],
    collectiveEffects: [
      {
        type: 'manifestation',
        power: 75,
        duration: 'hours',
        description: 'Shared goals manifest 3x faster when working together',
      },
    ],
    requirements: { minANumber: 30 },
    rarity: 'epic',
    description: 'Supercharges the combined potential of three aligned consciousness signatures',
    craftingTime: 90,
    chartRequirements: {
      complexity: 'trinity',
      minCharts: 2,
      maxCharts: 2,
      synergyThreshold: 70,
    },
    powerScaling: {
      baseMultiplier: 3.0,
      chartMultiplier: 1.2,
      synergyBonus: 1.0,
    },
  },

  // COLLECTIVE RUNES (Current + Your + Multiple charts)
  {
    id: 'collective_consciousness',
    name: 'Collective Consciousness Rune',
    symbol: '🌐',
    element: 'spirit',
    runeType: 'cosmic',
    baseCost: { spirit: 20, essence: 18, matter: 15, substance: 12, totalCost: 65 },
    currentCost: { spirit: 20, essence: 18, matter: 15, substance: 12, totalCost: 65 },
    effects: [
      {
        type: 'consciousness',
        power: 100,
        duration: 'days',
        description: 'Creates shared consciousness field among all participants for 14 days',
      },
    ],
    collectiveEffects: [
      {
        type: 'divination',
        power: 90,
        duration: 'days',
        description: 'Group gains collective intuition and shared insights',
      },
      {
        type: 'enhancement',
        power: 85,
        duration: 'days',
        description: 'All participants benefit from combined strengths and abilities',
      },
    ],
    requirements: { minANumber: 35, consciousness_level: 6 },
    rarity: 'legendary',
    description: 'Weaves multiple consciousness signatures into a unified field of awareness',
    craftingTime: 120,
    cooldown: 168, // 1 week
    chartRequirements: {
      complexity: 'collective',
      minCharts: 3,
      maxCharts: 8,
      synergyThreshold: 60,
      relationshipTypes: ['spiritual', 'business', 'family'],
    },
    powerScaling: {
      baseMultiplier: 4.0,
      chartMultiplier: 1.5,
      synergyBonus: 1.5,
    },
  },

  {
    id: 'reality_council',
    name: 'Reality Council Rune',
    symbol: '👑',
    element: 'spirit',
    runeType: 'cosmic',
    baseCost: { spirit: 30, essence: 25, matter: 20, substance: 15, totalCost: 90 },
    currentCost: { spirit: 30, essence: 25, matter: 20, substance: 15, totalCost: 90 },
    effects: [
      {
        type: 'manifestation',
        power: 100,
        duration: 'permanent',
        description: 'Enables collective reality alteration through unified intention',
      },
    ],
    collectiveEffects: [
      {
        type: 'manifestation',
        power: 100,
        duration: 'permanent',
        description: 'Group can permanently alter reality through unanimous focused intent',
      },
    ],
    requirements: {
      minANumber: 40,
      consciousness_level: 7,
      planetaryHour: 'jupiter',
    },
    rarity: 'cosmic',
    description: 'The ultimate collective rune - enables group reality manipulation',
    craftingTime: 240,
    cooldown: 720, // 30 days
    chartRequirements: {
      complexity: 'collective',
      minCharts: 5,
      maxCharts: 12,
      synergyThreshold: 80,
      relationshipTypes: ['spiritual'],
    },
    powerScaling: {
      baseMultiplier: 5.0,
      chartMultiplier: 2.0,
      synergyBonus: 2.0,
    },
  },

  // SPECIAL BUSINESS/TEAM RUNES
  {
    id: 'team_synergy',
    name: 'Team Synergy Rune',
    symbol: '🤝',
    element: 'air',
    runeType: 'utility',
    baseCost: { spirit: 12, essence: 8, matter: 10, substance: 15, totalCost: 45 },
    currentCost: { spirit: 12, essence: 8, matter: 10, substance: 15, totalCost: 45 },
    effects: [
      {
        type: 'enhancement',
        power: 75,
        duration: 'days',
        description: 'Optimizes team communication and collaboration for 10 days',
      },
    ],
    collectiveEffects: [
      {
        type: 'enhancement',
        power: 80,
        duration: 'days',
        description: 'Team productivity increases by chart synergy percentage',
      },
    ],
    requirements: { minANumber: 25 },
    rarity: 'epic',
    description: 'Harmonizes professional team dynamics through astrological alignment',
    craftingTime: 75,
    chartRequirements: {
      complexity: 'collective',
      minCharts: 3,
      maxCharts: 6,
      synergyThreshold: 55,
      relationshipTypes: ['business'],
    },
    powerScaling: {
      baseMultiplier: 3.0,
      chartMultiplier: 1.3,
      synergyBonus: 1.2,
    },
  },
]

// Chart Complexity Multipliers
export const COMPLEXITY_MULTIPLIERS = {
  solo: { power: 1.0, cost: 1.0, time: 1.0 },
  dual: { power: 1.8, cost: 1.5, time: 1.3 },
  trinity: { power: 2.8, cost: 2.2, time: 1.8 },
  collective: { power: 4.5, cost: 3.5, time: 2.5 },
}

/**
 * Get available runes for a given chart combination
 */
export function getAvailableRunesForCharts(
  chartCombination: ChartCombination,
  userResources: AlchemicalCost
): MultiChartRune[] {
  const complexity = chartCombination.complexity
  const chartCount = chartCombination.charts.length

  return MULTI_CHART_RUNE_CATALOG.filter(rune => {
    // Check complexity requirement
    if (rune.chartRequirements.complexity !== complexity) return false

    // Check chart count
    if (
      chartCount < rune.chartRequirements.minCharts ||
      chartCount > rune.chartRequirements.maxCharts
    )
      return false

    // Check synergy threshold
    if (
      rune.chartRequirements.synergyThreshold &&
      chartCombination.synergy < rune.chartRequirements.synergyThreshold
    )
      return false

    // Check A-Number requirement
    if (
      rune.requirements.minANumber &&
      chartCombination.combinedSignature.averageANumber < rune.requirements.minANumber
    )
      return false

    return true
  })
}

/**
 * Calculate enhanced rune power based on chart combination
 */
export function calculateRunePower(
  rune: MultiChartRune,
  chartCombination: ChartCombination
): number {
  const baseMultiplier = rune.powerScaling.baseMultiplier
  const chartBonus = rune.powerScaling.chartMultiplier * chartCombination.charts.length
  const synergyBonus = rune.powerScaling.synergyBonus * (chartCombination.synergy / 100)
  const resonanceBonus = chartCombination.harmonicResonance - 1.0

  let totalPower = 100 // Base rune power

  // Apply all multipliers
  totalPower *= baseMultiplier + chartBonus + synergyBonus + resonanceBonus

  // Add complexity multiplier
  totalPower *= COMPLEXITY_MULTIPLIERS[chartCombination.complexity].power

  return Math.min(Math.round(totalPower), 500) // Cap at 500% power
}

/**
 * Calculate enhanced rune costs based on chart combination
 */
export function calculateMultiChartRuneCosts(
  rune: MultiChartRune,
  chartCombination: ChartCombination,
  currentConditions: any
): AlchemicalCost {
  const baseCost = rune.baseCost
  const complexityMult = COMPLEXITY_MULTIPLIERS[chartCombination.complexity].cost
  const synergyDiscount = 1 - (chartCombination.synergy / 100) * 0.2 // Up to 20% discount for high synergy

  // Apply astrological modifiers (from existing system)
  let spiritMult = complexityMult * synergyDiscount
  let essenceMult = complexityMult * synergyDiscount
  let matterMult = complexityMult * synergyDiscount
  let substanceMult = complexityMult * synergyDiscount

  // Apply current astrological conditions
  Object.keys(currentConditions || {}).forEach(condition => {
    if (currentConditions[condition]) {
      const reduction = getConditionMultiplier(condition)
      spiritMult *= reduction
      essenceMult *= reduction
      matterMult *= reduction
      substanceMult *= reduction
    }
  })

  return {
    spirit: Math.ceil(baseCost.spirit * spiritMult),
    essence: Math.ceil(baseCost.essence * essenceMult),
    matter: Math.ceil(baseCost.matter * matterMult),
    substance: Math.ceil(baseCost.substance * substanceMult),
    totalCost: Math.ceil(
      baseCost.spirit * spiritMult +
        baseCost.essence * essenceMult +
        baseCost.matter * matterMult +
        baseCost.substance * substanceMult
    ),
  }
}

function getConditionMultiplier(condition: string): number {
  const multipliers: Record<string, number> = {
    jupiter_hour: 0.6,
    saturn_hour: 1.3,
    full_moon: 0.5,
    new_moon: 1.2,
    waxing_moon: 0.9,
    waning_moon: 0.8,
    harmonic_convergence: 0.7,
  }
  return multipliers[condition] || 1.0
}
