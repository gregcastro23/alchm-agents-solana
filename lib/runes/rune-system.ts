/**
 * Planetary Agents Runes System
 *
 * Runes are powerful consciousness tools that can be crafted by spending
 * alchemical resources (Spirit, Essence, Matter, Substance). The cost varies
 * based on current astrological conditions, planetary dignities, and cosmic timing.
 */

export interface AlchemicalCost {
  spirit: number
  essence: number
  matter: number
  substance: number
  totalCost: number
}

export interface RuneEffect {
  type:
    | 'consciousness'
    | 'protection'
    | 'enhancement'
    | 'manifestation'
    | 'divination'
    | 'passive'
    | 'active'
  name?: string // Optional name for sign-vector rune effects
  power: number // 1-100
  duration: 'instant' | 'hours' | 'days' | 'permanent'
  description: string
}

export interface Rune {
  id: string
  name: string
  symbol: string
  element: 'fire' | 'earth' | 'air' | 'water' | 'spirit'
  runeType: 'offensive' | 'defensive' | 'utility' | 'cosmic' | 'temporal'
  baseCost: AlchemicalCost
  currentCost: AlchemicalCost
  effects: RuneEffect[]
  requirements: {
    minANumber?: number
    planetaryHour?: string
    moonPhase?: string
    consciousness_level?: number
  }
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'cosmic'
  description: string
  craftingTime: number // in minutes
  cooldown?: number // in hours
  powerLevel?: number // Optional power level for enhanced runes
  type?: string // Optional type alias for compatibility
  cost?: AlchemicalCost // Optional cost alias for compatibility
  metadata?: any // Optional metadata for dynamic runes
}

// Base Rune Catalog
export const RUNE_CATALOG: Rune[] = [
  // CONSCIOUSNESS RUNES
  {
    id: 'awareness_awakening',
    name: 'Rune of Awareness Awakening',
    symbol: '◉',
    element: 'spirit',
    runeType: 'cosmic',
    baseCost: { spirit: 8, essence: 4, matter: 2, substance: 1, totalCost: 15 },
    currentCost: { spirit: 8, essence: 4, matter: 2, substance: 1, totalCost: 15 },
    effects: [
      {
        type: 'consciousness',
        power: 85,
        duration: 'days',
        description: 'Amplifies consciousness perception by 85% for 3 days',
      },
    ],
    requirements: { minANumber: 20 },
    rarity: 'epic',
    description: 'Opens the third eye of cosmic awareness, revealing hidden patterns in reality',
    craftingTime: 45,
  },

  {
    id: 'temporal_anchor',
    name: 'Temporal Anchor Rune',
    symbol: '⧖',
    element: 'spirit',
    runeType: 'temporal',
    baseCost: { spirit: 12, essence: 8, matter: 4, substance: 2, totalCost: 26 },
    currentCost: { spirit: 12, essence: 8, matter: 4, substance: 2, totalCost: 26 },
    effects: [
      {
        type: 'manifestation',
        power: 90,
        duration: 'permanent',
        description: 'Creates a stable anchor point in time-space consciousness',
      },
    ],
    requirements: { minANumber: 35, consciousness_level: 6 },
    rarity: 'legendary',
    description: 'Establishes a permanent consciousness anchor for temporal navigation',
    craftingTime: 120,
    cooldown: 168, // 1 week
  },

  // PROTECTION RUNES
  {
    id: 'astral_shield',
    name: 'Astral Shield Rune',
    symbol: '🛡',
    element: 'earth',
    runeType: 'defensive',
    baseCost: { spirit: 3, essence: 2, matter: 8, substance: 4, totalCost: 17 },
    currentCost: { spirit: 3, essence: 2, matter: 8, substance: 4, totalCost: 17 },
    effects: [
      {
        type: 'protection',
        power: 75,
        duration: 'hours',
        description: 'Creates protective barrier against negative energies for 12 hours',
      },
    ],
    requirements: { minANumber: 15 },
    rarity: 'uncommon',
    description: 'Forms a shimmering barrier of crystallized matter around your energy field',
    craftingTime: 20,
  },

  {
    id: 'mind_fortress',
    name: 'Mind Fortress Rune',
    symbol: '🏰',
    element: 'air',
    runeType: 'defensive',
    baseCost: { spirit: 6, essence: 3, matter: 2, substance: 9, totalCost: 20 },
    currentCost: { spirit: 6, essence: 3, matter: 2, substance: 9, totalCost: 20 },
    effects: [
      {
        type: 'protection',
        power: 80,
        duration: 'days',
        description: 'Fortifies mental defenses against psychic intrusion for 2 days',
      },
    ],
    requirements: { minANumber: 18 },
    rarity: 'rare',
    description: 'Constructs an impenetrable fortress of crystallized thought around your mind',
    craftingTime: 35,
  },

  // ENHANCEMENT RUNES
  {
    id: 'elemental_harmony',
    name: 'Elemental Harmony Rune',
    symbol: '⚛',
    element: 'water',
    runeType: 'utility',
    baseCost: { spirit: 4, essence: 6, matter: 4, substance: 3, totalCost: 17 },
    currentCost: { spirit: 4, essence: 6, matter: 4, substance: 3, totalCost: 17 },
    effects: [
      {
        type: 'enhancement',
        power: 70,
        duration: 'hours',
        description: 'Balances all elemental energies, increasing compatibility by 70% for 8 hours',
      },
    ],
    requirements: { minANumber: 12 },
    rarity: 'common',
    description:
      'Creates perfect elemental balance, harmonizing fire, earth, air, and water within',
    craftingTime: 15,
  },

  {
    id: 'cosmic_attunement',
    name: 'Cosmic Attunement Rune',
    symbol: '🌌',
    element: 'spirit',
    runeType: 'cosmic',
    baseCost: { spirit: 10, essence: 7, matter: 5, substance: 8, totalCost: 30 },
    currentCost: { spirit: 10, essence: 7, matter: 5, substance: 8, totalCost: 30 },
    effects: [
      {
        type: 'enhancement',
        power: 95,
        duration: 'hours',
        description: 'Perfectly aligns consciousness with cosmic frequencies for 6 hours',
      },
    ],
    requirements: { minANumber: 25, planetaryHour: 'any' },
    rarity: 'epic',
    description: 'Synchronizes your consciousness with the cosmic web of universal energy',
    craftingTime: 60,
  },

  // DIVINATION RUNES
  {
    id: 'oracle_sight',
    name: 'Oracle Sight Rune',
    symbol: '👁',
    element: 'air',
    runeType: 'utility',
    baseCost: { spirit: 7, essence: 9, matter: 1, substance: 3, totalCost: 20 },
    currentCost: { spirit: 7, essence: 9, matter: 1, substance: 3, totalCost: 20 },
    effects: [
      {
        type: 'divination',
        power: 85,
        duration: 'instant',
        description: 'Provides clear vision of potential futures and hidden truths',
      },
    ],
    requirements: { minANumber: 16, moonPhase: 'full' },
    rarity: 'rare',
    description: 'Opens the inner eye to see beyond the veil of time and possibility',
    craftingTime: 30,
  },

  // MANIFESTATION RUNES
  {
    id: 'reality_weaver',
    name: 'Reality Weaver Rune',
    symbol: '🕸',
    element: 'fire',
    runeType: 'offensive',
    baseCost: { spirit: 15, essence: 12, matter: 8, substance: 5, totalCost: 40 },
    currentCost: { spirit: 15, essence: 12, matter: 8, substance: 5, totalCost: 40 },
    effects: [
      {
        type: 'manifestation',
        power: 100,
        duration: 'permanent',
        description: 'Weaves new patterns into the fabric of reality itself',
      },
    ],
    requirements: { minANumber: 40, consciousness_level: 7, planetaryHour: 'sun' },
    rarity: 'cosmic',
    description: 'The ultimate rune - reshapes reality according to pure will and intention',
    craftingTime: 240,
    cooldown: 720, // 30 days
  },
]

// Astrological pricing modifiers
export interface AstrologicalModifier {
  condition: string
  multiplier: number
  description: string
}

export const ASTROLOGICAL_MODIFIERS: AstrologicalModifier[] = [
  // Planetary Hours
  { condition: 'sun_hour', multiplier: 0.8, description: 'Solar hour reduces Spirit costs' },
  { condition: 'moon_hour', multiplier: 0.7, description: 'Lunar hour reduces Essence costs' },
  {
    condition: 'mercury_hour',
    multiplier: 0.9,
    description: 'Mercury hour reduces all costs slightly',
  },
  { condition: 'venus_hour', multiplier: 0.85, description: 'Venus hour reduces Matter costs' },
  { condition: 'mars_hour', multiplier: 1.1, description: 'Mars hour increases all costs' },
  {
    condition: 'jupiter_hour',
    multiplier: 0.6,
    description: 'Jupiter hour greatly reduces all costs',
  },
  {
    condition: 'saturn_hour',
    multiplier: 1.3,
    description: 'Saturn hour significantly increases costs',
  },

  // Moon Phases
  {
    condition: 'new_moon',
    multiplier: 1.2,
    description: 'New moon increases manifestation rune costs',
  },
  {
    condition: 'full_moon',
    multiplier: 0.5,
    description: 'Full moon dramatically reduces divination costs',
  },
  {
    condition: 'waxing_moon',
    multiplier: 0.9,
    description: 'Waxing moon reduces enhancement rune costs',
  },
  {
    condition: 'waning_moon',
    multiplier: 0.8,
    description: 'Waning moon reduces protection rune costs',
  },

  // Planetary Dignities
  {
    condition: 'planet_exalted',
    multiplier: 0.6,
    description: 'Exalted planet reduces related element costs',
  },
  {
    condition: 'planet_domicile',
    multiplier: 0.8,
    description: 'Planet in domicile reduces costs',
  },
  {
    condition: 'planet_detriment',
    multiplier: 1.4,
    description: 'Planet in detriment increases costs',
  },
  {
    condition: 'planet_fall',
    multiplier: 1.6,
    description: 'Planet in fall significantly increases costs',
  },

  // Special Conditions
  {
    condition: 'retrograde_mercury',
    multiplier: 1.8,
    description: 'Mercury retrograde increases communication rune costs',
  },
  {
    condition: 'eclipse',
    multiplier: 0.3,
    description: 'Eclipse dramatically reduces cosmic rune costs',
  },
  {
    condition: 'grand_trine',
    multiplier: 0.4,
    description: 'Grand trine creates harmonious pricing',
  },
  { condition: 'grand_cross', multiplier: 2.0, description: 'Grand cross doubles all rune costs' },
]

/**
 * Calculate current rune costs based on astrological conditions
 */
export function calculateRuneCosts(rune: Rune, currentConditions: any): AlchemicalCost {
  let spiritMultiplier = 1.0
  let essenceMultiplier = 1.0
  let matterMultiplier = 1.0
  let substanceMultiplier = 1.0

  // Apply astrological modifiers
  ASTROLOGICAL_MODIFIERS.forEach(modifier => {
    if (currentConditions[modifier.condition]) {
      switch (rune.element) {
        case 'fire':
          spiritMultiplier *= modifier.multiplier
          break
        case 'water':
          essenceMultiplier *= modifier.multiplier
          break
        case 'earth':
          matterMultiplier *= modifier.multiplier
          break
        case 'air':
          substanceMultiplier *= modifier.multiplier
          break
        case 'spirit':
          // Spirit runes affected by all modifiers equally
          spiritMultiplier *= modifier.multiplier * 0.8
          essenceMultiplier *= modifier.multiplier * 0.8
          matterMultiplier *= modifier.multiplier * 0.8
          substanceMultiplier *= modifier.multiplier * 0.8
          break
      }
    }
  })

  return {
    spirit: Math.ceil(rune.baseCost.spirit * spiritMultiplier),
    essence: Math.ceil(rune.baseCost.essence * essenceMultiplier),
    matter: Math.ceil(rune.baseCost.matter * matterMultiplier),
    substance: Math.ceil(rune.baseCost.substance * substanceMultiplier),
    totalCost: Math.ceil(
      rune.baseCost.spirit * spiritMultiplier +
        rune.baseCost.essence * essenceMultiplier +
        rune.baseCost.matter * matterMultiplier +
        rune.baseCost.substance * substanceMultiplier
    ),
  }
}

/**
 * Check if user can afford a rune
 */
export function canAffordRune(
  rune: Rune,
  userResources: AlchemicalCost,
  currentConditions: any
): boolean {
  const cost = calculateRuneCosts(rune, currentConditions)

  return (
    userResources.spirit >= cost.spirit &&
    userResources.essence >= cost.essence &&
    userResources.matter >= cost.matter &&
    userResources.substance >= cost.substance
  )
}

/**
 * Get recommended runes based on current conditions and user resources
 */
export function getRecommendedRunes(
  userResources: AlchemicalCost,
  currentConditions: any,
  userGoal?: 'consciousness' | 'protection' | 'enhancement' | 'manifestation' | 'divination'
): Rune[] {
  const affordable = RUNE_CATALOG.filter(rune =>
    canAffordRune(rune, userResources, currentConditions)
  )

  if (userGoal) {
    return affordable
      .filter(rune => rune.effects.some(effect => effect.type === userGoal))
      .sort(
        (a, b) =>
          calculateRuneCosts(a, currentConditions).totalCost -
          calculateRuneCosts(b, currentConditions).totalCost
      )
  }

  return affordable.sort(
    (a, b) =>
      calculateRuneCosts(a, currentConditions).totalCost -
      calculateRuneCosts(b, currentConditions).totalCost
  )
}
