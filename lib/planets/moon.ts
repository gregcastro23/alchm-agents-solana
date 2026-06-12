import { PlanetData, MoonSpecificData } from './types'
export type { MoonSpecificData }

const moonData: PlanetData = {
  'Dignity Effect': {
    cancer: 1,
    taurus: 2,
    capricorn: -1,
    Scorpio: -2,
  },
  Elements: ['Water', 'Water'],
  Alchemy: {
    Spirit: 0,
    Essence: 1,
    Matter: 1,
    Substance: 0,
  },
  'Diurnal Element': 'Water',
  'Nocturnal Element': 'Water',
  RetrogradeEffect: {
    Spirit: 0,
    Essence: -0.5,
    Matter: 0.5,
    Substance: 0,
  },
  FoodAssociations: [
    'dairy products',
    'leafy greens',
    'coconut',
    'cucumber',
    'melon',
    'mushrooms',
    'shellfish',
    'white sauces',
    'mild flavors',
    'comfort foods',
    'foods with high water content',
  ],
  FlavorProfiles: {
    Sweet: 0.7,
    Sour: 0.3,
    Salty: 0.5,
    Bitter: 0.2,
    Umami: 0.4,
    Spicy: 0.1,
  },
  CulinaryInfluences: [
    'Increases moisture retention in cooking',
    'Enhances flavors that absorb and hold water',
    'Promotes fermentation processes',
    'Strengthens emotional connections to food',
  ],
  ANumberModifiers: {
    Base: 0.8, // Moon adds moderate A-Number boost through Essence and Matter
    HighDignitiy: 0.4, // Extra boost in Cancer/Taurus
    LowDignity: -0.2, // Reduction in Capricorn/Scorpio
    AspectBonus: {
      conjunction: 0.2,
      trine: 0.15,
      square: -0.1,
      opposition: -0.15,
      sextile: 0.1,
    },
    SeasonalAdjustment: {
      summer: 0.1, // Mild boost in watery summer
      spring: 0.3, // Growth and new beginnings
      autumn: 0.2, // Harvest and preservation
      winter: 0.0, // Neutral in cold season
    },
  },
  AspectsEffect: {
    Sun: {
      Conjunction: 0.5,
      Opposition: -0.3,
      Trine: 0.4,
      Square: -0.2,
      Sextile: 0.3,
    },
    Venus: {
      Conjunction: 0.7,
      Opposition: 0.1,
      Trine: 0.5,
      Square: 0.0,
      Sextile: 0.4,
    },
    Mars: {
      Conjunction: -0.1,
      Opposition: -0.4,
      Trine: 0.2,
      Square: -0.5,
      Sextile: 0.1,
    },
    // Additional aspects can be added
  },
  PlanetSpecific: {
    Lunar: {
      Phases: {
        'New Moon': {
          Spirit: 0.1,
          Essence: 0.3,
          Matter: 0.1,
          Substance: 0.1,
          CulinaryEffect:
            'Best for starting new cooking projects, fermentations, or sprouting. Subtle flavors are enhanced.',
        },
        'Waxing Crescent': {
          Spirit: 0.2,
          Essence: 0.4,
          Matter: 0.2,
          Substance: 0.2,
          CulinaryEffect:
            'Good for adding ingredients that build flavor, marinades begin to work better.',
        },
        'First Quarter': {
          Spirit: 0.3,
          Essence: 0.5,
          Matter: 0.3,
          Substance: 0.2,
          CulinaryEffect:
            'Balanced cooking, good for most techniques. Flavors become more pronounced.',
        },
        'Waxing Gibbous': {
          Spirit: 0.4,
          Essence: 0.6,
          Matter: 0.4,
          Substance: 0.3,
          CulinaryEffect: 'Excellent for baking, roasting, and caramelization. Flavors intensify.',
        },
        'Full Moon': {
          Spirit: 0.5,
          Essence: 0.7,
          Matter: 0.5,
          Substance: 0.4,
          CulinaryEffect:
            'Peak flavor impact. Best for elaborate dishes, celebrations, and feasts. All flavors are amplified.',
        },
        'Waning Gibbous': {
          Spirit: 0.4,
          Essence: 0.6,
          Matter: 0.6,
          Substance: 0.5,
          CulinaryEffect:
            'Good for reduction techniques, concentrating flavors. Preserving and canning work well.',
        },
        'Last Quarter': {
          Spirit: 0.3,
          Essence: 0.5,
          Matter: 0.5,
          Substance: 0.4,
          CulinaryEffect:
            'Best for completing ongoing cooking projects. Fermented foods reach maturity.',
        },
        'Waning Crescent': {
          Spirit: 0.2,
          Essence: 0.4,
          Matter: 0.4,
          Substance: 0.3,
          CulinaryEffect:
            'Ideal for gentle cooking methods, stocks, and broths. Flavors become more subtle again.',
        },
      },
      Nodes: {
        North: {
          Element: 'Air',
          CulinaryEffect:
            'Enhances innovative cooking techniques and fusion cuisines. Encourages experimentation.',
        },
        South: {
          Element: 'Earth',
          CulinaryEffect:
            'Strengthens traditional cooking methods and comfort foods. Brings out nostalgic flavors.',
        },
      },
      Mansion: {
        // Lunar mansions could be added here for even more granular effects
      },
    },
    MoonCalculations: {
      calculateTransits(startDate: Date = new Date()) {
        const transits: Record<string, { Start: string; End: string }> = {}
        const signs = [
          'Aries',
          'Taurus',
          'Gemini',
          'Cancer',
          'Leo',
          'Virgo',
          'Libra',
          'Scorpio',
          'Sagittarius',
          'Capricorn',
          'Aquarius',
          'Pisces',
        ]

        // Starting sign - this should be determined from an ephemeris
        // For this example, we'll use a default that can be updated
        const moonInSign = {
          '2024-05-19': 'Sagittarius',
          '2024-05-21': 'Capricorn',
          '2024-05-23': 'Aquarius',
          '2024-05-25': 'Pisces',
          '2024-05-28': 'Aries',
          '2024-05-30': 'Taurus',
          '2024-06-01': 'Gemini',
          '2024-06-03': 'Cancer',
          '2024-06-06': 'Leo',
          '2024-06-08': 'Virgo',
          '2024-06-10': 'Libra',
          '2024-06-13': 'Scorpio',
          '2024-06-15': 'Sagittarius',
        }

        // Convert to proper transits with start/end dates
        const dates = Object.keys(moonInSign).sort()
        for (let i = 0; i < dates.length - 1; i++) {
          const sign = moonInSign[dates[i] as keyof typeof moonInSign]
          const start = dates[i]
          const end = dates[i + 1]

          transits[sign] = {
            Start: start,
            End: end,
          }
        }

        return transits
      },
    },
    TransitDateFunction() {
      return {
        requiresDynamicCalculation: true,
        cycleLength: 27.3, // days
      }
    },
  },
}

export default moonData
