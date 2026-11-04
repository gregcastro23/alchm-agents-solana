import {
  earnedSeals,
  evaluateSeals,
  rateStats,
  type CoreStats,
  type EsmsToken,
  type VesselArchetype,
} from '@/lib/agents/rating'
import type { AlchemicalSeal } from '@/lib/agents/rating-contract'
import type { Element } from '@/lib/staking/types'

export type CulinarySurgeMode = 'Inferno' | 'Tempest' | 'Equilibrium'

export type CulinarySortMode = 'sky-resonance' | 'vessel-pvr' | 'esms-potency'

export interface CulinarySubstitution {
  originalIngredient: string
  replacementIngredient: string
  astrologicalBasis: string
}

export interface SanctumRecipeEntry {
  id: string
  wtenRecipeId: string
  originalTitle: string
  alchemizedTitle: string
  cuisine: string
  mealService:
    | '05:00 AM Dawn Service'
    | 'Solar Zenith Lunch'
    | 'Twilight Banquet'
    | 'Nocturnal Elixir'
  agentId: string
  agentName: string
  agentTitle: string
  agentEra: string
  rulingPlanet: string
  element: Element
  dominantEsms: EsmsToken
  esmsRatio: Record<EsmsToken, number>
  stats: CoreStats
  vesselPvr: number
  vesselArchetype: VesselArchetype
  vesselSeals: AlchemicalSeal[]
  surgeMode: CulinarySurgeMode
  surgeDelta: number
  skyToPlateScore: number
  transitAlignmentNote: string
  voicedReflection: string
  substitutions: CulinarySubstitution[]
  keyIngredients: string[]
  prepTimeMinutes: number
  alchmKitchenUrl: string
}

export interface SkyTransitContext {
  dominantPlanet: string
  dominantSign: string
  transitElement: Element
  lunarPhase: string
  activeHourPlanet: string
}

export const DEFAULT_SKY_TRANSIT_CONTEXT: SkyTransitContext = {
  dominantPlanet: 'Mars',
  dominantSign: 'Scorpio',
  transitElement: 'Water',
  lunarPhase: 'Waxing Gibbous',
  activeHourPlanet: 'Sun',
}

const ELEMENT_TO_ESMS_TOKEN: Record<Element, EsmsToken> = {
  Fire: 'spirit',
  Water: 'essence',
  Earth: 'matter',
  Air: 'substance',
}

/**
 * Compute deterministic Sky-to-Plate Resonance (25–99) and Surge Mode
 * ('Inferno' | 'Tempest' | 'Equilibrium') from vessel PVR, dish ESMS ratio, and active sky transits.
 */
export function computeSkyToPlateResonance(params: {
  vesselPvr: number
  dishElement: Element
  esmsRatio: Record<EsmsToken, number>
  rulingPlanet: string
  sky?: SkyTransitContext
}): {
  skyToPlateScore: number
  surgeMode: CulinarySurgeMode
  surgeDelta: number
} {
  const sky = params.sky ?? DEFAULT_SKY_TRANSIT_CONTEXT
  const totalEsms =
    params.esmsRatio.spirit +
      params.esmsRatio.essence +
      params.esmsRatio.matter +
      params.esmsRatio.substance || 100

  const spiritShare = params.esmsRatio.spirit / totalEsms
  const essenceShare = params.esmsRatio.essence / totalEsms
  const matterShare = params.esmsRatio.matter / totalEsms
  const substanceShare = params.esmsRatio.substance / totalEsms

  let surgeMode: CulinarySurgeMode = 'Equilibrium'
  let surgeDelta = 5

  if (
    params.dishElement === 'Fire' ||
    spiritShare >= 0.34 ||
    params.rulingPlanet === 'Mars' ||
    params.rulingPlanet === 'Sun'
  ) {
    surgeMode = 'Inferno'
    surgeDelta = sky.activeHourPlanet === 'Sun' || sky.dominantPlanet === 'Mars' ? 10 : 7
  } else if (
    params.dishElement === 'Water' ||
    params.dishElement === 'Air' ||
    essenceShare + substanceShare >= 0.58
  ) {
    surgeMode = 'Tempest'
    surgeDelta = sky.transitElement === params.dishElement ? 9 : 6
  } else {
    surgeMode = 'Equilibrium'
    surgeDelta = matterShare >= 0.32 ? 7 : 5
  }

  const rawScore = Math.round(params.vesselPvr * 0.88 + surgeDelta + spiritShare * 6)
  const skyToPlateScore = Math.max(25, Math.min(99, rawScore))

  return {
    skyToPlateScore,
    surgeMode,
    surgeDelta,
  }
}

function buildSanctumEntry(spec: {
  id: string
  wtenRecipeId: string
  originalTitle: string
  alchemizedTitle: string
  cuisine: string
  mealService: SanctumRecipeEntry['mealService']
  agentId: string
  agentName: string
  agentTitle: string
  agentEra: string
  rulingPlanet: string
  element: Element
  esmsRatio: Record<EsmsToken, number>
  stats: CoreStats
  transitAlignmentNote: string
  voicedReflection: string
  substitutions: CulinarySubstitution[]
  keyIngredients: string[]
  prepTimeMinutes: number
}): SanctumRecipeEntry {
  const rated = rateStats(spec.stats)
  const seals = earnedSeals(
    evaluateSeals({
      stats: spec.stats,
      esmsBalances: {
        spirit: spec.esmsRatio.spirit * 8,
        essence: spec.esmsRatio.essence * 8,
        matter: spec.esmsRatio.matter * 8,
        substance: spec.esmsRatio.substance * 8,
      },
    })
  )
  const dominantEsms = ELEMENT_TO_ESMS_TOKEN[spec.element]
  const resonance = computeSkyToPlateResonance({
    vesselPvr: rated.ovr,
    dishElement: spec.element,
    esmsRatio: spec.esmsRatio,
    rulingPlanet: spec.rulingPlanet,
  })

  return {
    ...spec,
    dominantEsms,
    vesselPvr: rated.ovr,
    vesselArchetype: rated.archetype,
    vesselSeals: seals,
    surgeMode: resonance.surgeMode,
    surgeDelta: resonance.surgeDelta,
    skyToPlateScore: resonance.skyToPlateScore,
    alchmKitchenUrl: `https://alchm.kitchen/recipes/${encodeURIComponent(spec.wtenRecipeId)}?agent=${encodeURIComponent(spec.agentId)}&esms=${dominantEsms}`,
  }
}

export const WTEN_SANCTUM_CATALOG: readonly SanctumRecipeEntry[] = Object.freeze([
  buildSanctumEntry({
    id: 'sanctum-shakshuka-mars',
    wtenRecipeId: 'middle-eastern-shakshuka',
    originalTitle: 'Spiced Shakshuka al Fuego',
    alchemizedTitle: 'Solaris Saffron & Harissa Crucible Shakshuka',
    cuisine: 'Middle Eastern · Hermetic Fire',
    mealService: '05:00 AM Dawn Service',
    agentId: 'paracelsus',
    agentName: 'Paracelsus',
    agentTitle: 'Father of Spagyric Alchemy',
    agentEra: 'Renaissance (1493–1541)',
    rulingPlanet: 'Mars',
    element: 'Fire',
    esmsRatio: { spirit: 42, essence: 22, matter: 18, substance: 18 },
    stats: {
      power: 94,
      resonance: 85,
      wisdom: 91,
      charisma: 84,
      intuition: 89,
      adaptability: 86,
      vitality: 92,
    },
    transitAlignmentNote:
      'Mars Domicile heat amplifies Spirit extraction during 05:00 AM Dawn Service.',
    voicedReflection:
      'Let the sulfur of crushed coriander and saffron awaken the dormant solar fire before the eggs are poached in the spiced reduction.',
    substitutions: [
      {
        originalIngredient: 'Sweet paprika',
        replacementIngredient: 'Smoked Aleppo pepper & toasted saffron threads',
        astrologicalBasis: 'Elevates Martial Spirit and Solar heart conductivity.',
      },
      {
        originalIngredient: 'Standardparsley',
        replacementIngredient: 'Wild cilantro & preserved lemon zest',
        astrologicalBasis: 'Cuts dense Matter with bright Mercurial Substance.',
      },
    ],
    keyIngredients: [
      'saffron threads',
      'smoked Aleppo pepper',
      'heirloom tomatoes',
      'pasture eggs',
    ],
    prepTimeMinutes: 25,
  }),
  buildSanctumEntry({
    id: 'sanctum-risotto-kepler',
    wtenRecipeId: 'italian-risotto-alla-milanese',
    originalTitle: 'Saffron & Wild Mushroom Risotto',
    alchemizedTitle: 'Harmonia Mundi Porcini & Black Garlic Risotto',
    cuisine: 'Northern Italian · Geometric Earth',
    mealService: 'Twilight Banquet',
    agentId: 'johannes-kepler',
    agentName: 'Johannes Kepler',
    agentTitle: 'Imperial Mathematician & Celestial Harmonist',
    agentEra: 'Scientific Revolution (1571–1630)',
    rulingPlanet: 'Saturn',
    element: 'Earth',
    esmsRatio: { spirit: 22, essence: 20, matter: 38, substance: 20 },
    stats: {
      power: 82,
      resonance: 90,
      wisdom: 97,
      charisma: 80,
      intuition: 94,
      adaptability: 85,
      vitality: 84,
    },
    transitAlignmentNote:
      'Saturnian Matter stabilizes slow starch emulsion in exact 3:4 harmonic proportion.',
    voicedReflection:
      'Each ladle of hot mushroom broth must enter the Carnaroli grain in measured orbital intervals—never rushed, never stagnant.',
    substitutions: [
      {
        originalIngredient: 'White button mushrooms',
        replacementIngredient: 'Dried porcini & fermented black garlic paste',
        astrologicalBasis: 'Anchors Saturnian Matter and deep umami longevity.',
      },
      {
        originalIngredient: 'Heavy cream',
        replacementIngredient: 'Aged Parmigiano-Reggiano & cold-pressed hazelnut oil',
        astrologicalBasis: 'Jovian richness balanced by clean geometric clarity.',
      },
    ],
    keyIngredients: ['carnaroli rice', 'dried porcini', 'fermented black garlic', 'saffron'],
    prepTimeMinutes: 35,
  }),
  buildSanctumEntry({
    id: 'sanctum-miso-avicenna',
    wtenRecipeId: 'japanese-miso-soup',
    originalTitle: 'Traditional Kombu & Shiitake Miso',
    alchemizedTitle: 'Canon of Medicine Astragalus & Red Miso Elixir',
    cuisine: 'Japanese · Unani Restorative',
    mealService: '05:00 AM Dawn Service',
    agentId: 'ibn-sina-avicenna',
    agentName: 'Ibn Sina (Avicenna)',
    agentTitle: 'Prince of Physicians & Humoral Master',
    agentEra: 'Islamic Golden Age (980–1037)',
    rulingPlanet: 'Jupiter',
    element: 'Water',
    esmsRatio: { spirit: 20, essence: 40, matter: 22, substance: 18 },
    stats: {
      power: 84,
      resonance: 92,
      wisdom: 98,
      charisma: 88,
      intuition: 93,
      adaptability: 89,
      vitality: 94,
    },
    transitAlignmentNote:
      'Waxing Gibbous lunar tide elevates Essence absorption and humoral equilibrium.',
    voicedReflection:
      'Never boil the living miso ferment; fold it as the vessel cools below 75°C so the subtle Essence preserves the vital pneuma.',
    substitutions: [
      {
        originalIngredient: 'Instant dashi granules',
        replacementIngredient: 'Cold-steeped Rishiri kombu, shiitake caps & sliced ginger root',
        astrologicalBasis: 'Balances phlegmatic moisture with gentle digestive warmth.',
      },
      {
        originalIngredient: 'Scallions only',
        replacementIngredient: 'Charred scallion whites, wakame & toasted sesame oil',
        astrologicalBasis: 'Seals restorative Essence within the broth.',
      },
    ],
    keyIngredients: ['red akadashi miso', 'rishiri kombu', 'shiitake caps', 'fresh ginger'],
    prepTimeMinutes: 20,
  }),
  buildSanctumEntry({
    id: 'sanctum-fennel-hildegard',
    wtenRecipeId: 'italian-fennel-citrus-salad',
    originalTitle: 'Shaved Fennel & Blood Orange Carpaccio',
    alchemizedTitle: 'Viriditas Shaved Fennel, Blood Orange & Galangal Carpaccio',
    cuisine: 'Mediterranean · Monastic Viriditas',
    mealService: 'Solar Zenith Lunch',
    agentId: 'hildegard-von-bingen',
    agentName: 'Hildegard von Bingen',
    agentTitle: 'Sibyl of the Rhine & Viriditas Mystic',
    agentEra: 'High Middle Ages (1098–1179)',
    rulingPlanet: 'Venus',
    element: 'Air',
    esmsRatio: { spirit: 22, essence: 24, matter: 16, substance: 38 },
    stats: {
      power: 80,
      resonance: 96,
      wisdom: 93,
      charisma: 91,
      intuition: 97,
      adaptability: 88,
      vitality: 90,
    },
    transitAlignmentNote:
      'High-Substance Air botanicals clear mental fog and awaken greening Viriditas.',
    voicedReflection:
      'Fennel brings joyful warmth to the eye and clarity to the chest; paired with blood orange, it tempers melancholy.',
    substitutions: [
      {
        originalIngredient: 'Distilled white vinegar',
        replacementIngredient: 'Crushed blood orange juice, raw honey & grated galangal',
        astrologicalBasis: 'Infuses Solar-Venusian Viriditas and pneumatic Substance.',
      },
      {
        originalIngredient: 'Croutons',
        replacementIngredient: 'Toasted spelt kernels & crushed pistachio',
        astrologicalBasis: 'Hildegardian sacred grain for blood vitality.',
      },
    ],
    keyIngredients: ['wild fennel bulb', 'blood orange', 'galangal root', 'toasted spelt'],
    prepTimeMinutes: 15,
  }),
  buildSanctumEntry({
    id: 'sanctum-tagine-rumi',
    wtenRecipeId: 'moroccan-tagine',
    originalTitle: 'Root Vegetable & Chickpea Clay Tagine',
    alchemizedTitle: 'Mevlevi Rosewater, Apricot & Saffron Clay Tagine',
    cuisine: 'Levantine-Maghrebi · Sufi Devotional',
    mealService: 'Twilight Banquet',
    agentId: 'rumi',
    agentName: 'Jalāl al-Dīn Rūmī',
    agentTitle: 'Ecstatic Poet of Divine Union',
    agentEra: '13th Century Anatolia (1207–1273)',
    rulingPlanet: 'Venus',
    element: 'Fire',
    esmsRatio: { spirit: 36, essence: 30, matter: 18, substance: 16 },
    stats: {
      power: 83,
      resonance: 98,
      wisdom: 94,
      charisma: 97,
      intuition: 96,
      adaptability: 88,
      vitality: 85,
    },
    transitAlignmentNote:
      'Venus-Sun harmonic chord blends ecstatic Spirit with compassionate Essence.',
    voicedReflection:
      'In the conical clay dome, steam rises like a prayer and condenses back into the chickpea stew—every drop returning to the Beloved.',
    substitutions: [
      {
        originalIngredient: 'Plain vegetable stock',
        replacementIngredient: 'Saffron-infused broth with Damascus rosewater & cinnamon bark',
        astrologicalBasis: 'Opens the cardiac lotus through Venusian-Solar aroma.',
      },
      {
        originalIngredient: 'Raisins',
        replacementIngredient: 'Sun-dried Malatya apricots & toasted almonds',
        astrologicalBasis: 'Balances pungent spice with golden sweetness.',
      },
    ],
    keyIngredients: ['heirloom chickpeas', 'damascus rosewater', 'dried apricots', 'ras el hanout'],
    prepTimeMinutes: 45,
  }),
  buildSanctumEntry({
    id: 'sanctum-bouillabaisse-cleopatra',
    wtenRecipeId: 'french-bouillabaisse',
    originalTitle: 'Provençal Coastal Stew',
    alchemizedTitle: 'Alexandrian Lotus, Fennel & Saffron Pearl Bouillabaisse',
    cuisine: 'Mediterranean · Ptolemaic Royal',
    mealService: 'Nocturnal Elixir',
    agentId: 'cleopatra-vii',
    agentName: 'Cleopatra VII Philopator',
    agentTitle: 'Sovereign Alchemist of Alexandria',
    agentEra: 'Hellenistic Egypt (69–30 BCE)',
    rulingPlanet: 'Moon',
    element: 'Water',
    esmsRatio: { spirit: 26, essence: 38, matter: 16, substance: 20 },
    stats: {
      power: 91,
      resonance: 94,
      wisdom: 90,
      charisma: 99,
      intuition: 92,
      adaptability: 93,
      vitality: 87,
    },
    transitAlignmentNote:
      'Lunar Essence magnifies aromatic saffron-fennel emulsion for royal evening banquets.',
    voicedReflection:
      'A sovereign banquet must intoxicate the senses before the spoon touches the lip; saffron and orange blossom turn broth into liquid gold.',
    substitutions: [
      {
        originalIngredient: 'Standard tomato base',
        replacementIngredient: 'Charred plum tomatoes, saffron threads & bitter orange peel',
        astrologicalBasis: 'Unites Lunar tide with Solar sovereignty.',
      },
      {
        originalIngredient: 'Plain garlic aioli',
        replacementIngredient: 'Roasted garlic, saffron & cold-pressed olive oil rouille',
        astrologicalBasis: 'Heightens Charisma and sensual Essence.',
      },
    ],
    keyIngredients: [
      'saffron threads',
      'fennel fronds',
      'bitter orange peel',
      'roasted garlic rouille',
    ],
    prepTimeMinutes: 40,
  }),
])

export function filterAndSortSanctumDishes(params: {
  dishes?: readonly SanctumRecipeEntry[]
  esmsFilter?: EsmsToken | 'ALL'
  surgeFilter?: CulinarySurgeMode | 'ALL'
  agentFilter?: string | null
  searchQuery?: string
  sortBy?: CulinarySortMode
}): SanctumRecipeEntry[] {
  const source = params.dishes ?? WTEN_SANCTUM_CATALOG
  const esmsFilter = params.esmsFilter ?? 'ALL'
  const surgeFilter = params.surgeFilter ?? 'ALL'
  const agentFilter = params.agentFilter?.trim().toLowerCase() || null
  const query = params.searchQuery?.trim().toLowerCase() || ''
  const sortBy = params.sortBy ?? 'sky-resonance'

  const filtered = source.filter(dish => {
    if (esmsFilter !== 'ALL' && dish.dominantEsms !== esmsFilter) return false
    if (surgeFilter !== 'ALL' && dish.surgeMode !== surgeFilter) return false
    if (
      agentFilter &&
      !dish.agentId.toLowerCase().includes(agentFilter) &&
      !dish.agentName.toLowerCase().includes(agentFilter)
    ) {
      return false
    }
    if (query) {
      const haystack = [
        dish.alchemizedTitle,
        dish.originalTitle,
        dish.agentName,
        dish.cuisine,
        dish.rulingPlanet,
        ...dish.keyIngredients,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })

  return [...filtered].sort((a, b) => {
    if (sortBy === 'vessel-pvr') {
      return b.vesselPvr - a.vesselPvr || b.skyToPlateScore - a.skyToPlateScore
    }
    if (sortBy === 'esms-potency') {
      const aDom = a.esmsRatio[a.dominantEsms]
      const bDom = b.esmsRatio[b.dominantEsms]
      return bDom - aDom || b.skyToPlateScore - a.skyToPlateScore
    }
    return b.skyToPlateScore - a.skyToPlateScore || b.vesselPvr - a.vesselPvr
  })
}
