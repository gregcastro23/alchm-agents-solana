import { PlanetData } from './types'

const ascendantData: PlanetData = {
  'Dignity Effect': {},
  Elements: ['Earth', 'Earth'],
  Alchemy: {
    Spirit: 0,
    Essence: 0,
    Matter: 0,
    Substance: 0,
  },
  'Diurnal Element': 'Earth',
  'Nocturnal Element': 'Earth',
  FoodAssociations: [
    'foods that represent personal taste',
    'dietary preferences',
    'childhood favorites',
    'comfort foods',
    'foods that reflect physical constitution',
    'foods aligned with body type',
    'foods that support individual health needs',
    'dishes that represent cultural identity',
    'family recipes',
    'foods that align with personal appearance',
    'seasonally appropriate foods',
  ],
  FlavorProfiles: {
    Sweet: 0.5,
    Sour: 0.5,
    Salty: 0.5,
    Bitter: 0.5,
    Umami: 0.5,
    Spicy: 0.5,
  },
  CulinaryInfluences: [
    'Shapes overall food preferences',
    'Determines physical response to different foods',
    'Influences presentation and aesthetic preferences',
    'Affects appetite and eating patterns',
    'Connects food choices to personal identity',
  ],
  AspectsEffect: {
    Sun: {
      Conjunction: 0.7,
      Opposition: 0.1,
      Trine: 0.5,
      Square: 0.0,
      Sextile: 0.3,
    },
    Moon: {
      Conjunction: 0.8,
      Opposition: 0.2,
      Trine: 0.6,
      Square: 0.1,
      Sextile: 0.4,
    },
    Venus: {
      Conjunction: 0.6,
      Opposition: 0.1,
      Trine: 0.5,
      Square: 0.0,
      Sextile: 0.3,
    },
    Mars: {
      Conjunction: 0.5,
      Opposition: 0.0,
      Trine: 0.4,
      Square: -0.1,
      Sextile: 0.2,
    },
  },
  PlanetSpecific: {
    SignInfluence: {
      Aries: {
        FoodFocus:
          'Quick, energetic dining style, preference for bold flavors and simple preparations',
        Elements: {
          Fire: 0.8,
          Earth: 0.2,
          Air: 0.3,
          Water: 0.1,
        },
      },
      Taurus: {
        FoodFocus: 'Sensual eating experiences, rich foods, appreciation for quality ingredients',
        Elements: {
          Fire: 0.2,
          Earth: 0.8,
          Air: 0.1,
          Water: 0.3,
        },
      },
      Gemini: {
        FoodFocus: 'Variety in meals, interest in food knowledge, enjoyment of food conversation',
        Elements: {
          Fire: 0.3,
          Earth: 0.1,
          Air: 0.8,
          Water: 0.2,
        },
      },
      Cancer: {
        FoodFocus: 'Emotional connection to food, nurturing meals, traditional family recipes',
        Elements: {
          Fire: 0.1,
          Earth: 0.3,
          Air: 0.1,
          Water: 0.8,
        },
      },
      Leo: {
        FoodFocus: 'Dramatic presentations, generous portions, celebratory dining experiences',
        Elements: {
          Fire: 0.8,
          Earth: 0.2,
          Air: 0.3,
          Water: 0.1,
        },
      },
      Virgo: {
        FoodFocus:
          'Healthy and precise preparations, attention to nutritional details, clean eating',
        Elements: {
          Fire: 0.2,
          Earth: 0.8,
          Air: 0.3,
          Water: 0.1,
        },
      },
      Libra: {
        FoodFocus: 'Beautiful presentation, balanced flavors, social dining experiences',
        Elements: {
          Fire: 0.2,
          Earth: 0.2,
          Air: 0.8,
          Water: 0.2,
        },
      },
      Scorpio: {
        FoodFocus: 'Intense flavors, mysterious ingredients, transformative cooking methods',
        Elements: {
          Fire: 0.3,
          Earth: 0.2,
          Air: 0.1,
          Water: 0.8,
        },
      },
      Sagittarius: {
        FoodFocus: 'International cuisines, adventurous eating, philosophical approach to food',
        Elements: {
          Fire: 0.8,
          Earth: 0.1,
          Air: 0.4,
          Water: 0.1,
        },
      },
      Capricorn: {
        FoodFocus: 'Traditional recipes, disciplined approach to meals, quality over quantity',
        Elements: {
          Fire: 0.1,
          Earth: 0.8,
          Air: 0.2,
          Water: 0.3,
        },
      },
      Aquarius: {
        FoodFocus:
          'Innovative food concepts, unusual combinations, intellectual approach to eating',
        Elements: {
          Fire: 0.2,
          Earth: 0.2,
          Air: 0.8,
          Water: 0.2,
        },
      },
      Pisces: {
        FoodFocus: 'Intuitive cooking, creative presentations, ethereal flavors and experiences',
        Elements: {
          Fire: 0.1,
          Earth: 0.1,
          Air: 0.2,
          Water: 0.9,
        },
      },
    },
  },
}

export default ascendantData
