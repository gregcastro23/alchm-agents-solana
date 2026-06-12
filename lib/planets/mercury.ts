import { PlanetData, MercurySpecificData } from './types'
export type { MercurySpecificData }

const mercuryData: PlanetData = {
  'Dignity Effect': {
    Gemini: 1,
    Virgo: 3,
    Sagittarius: 1,
    Pisces: -3,
  },
  Elements: ['Air', 'Earth'],
  Alchemy: {
    Spirit: 1,
    Essence: 0,
    Matter: 0,
    Substance: 1,
  },
  'Diurnal Element': 'Air',
  'Nocturnal Element': 'Earth',
  AstronomicalData: {
    DistanceFromSun: '36 million miles (58 million kilometers)',
    DistanceFromEarth: {
      Minimum: '48 million miles (77 million kilometers)',
      Maximum: '138 million miles (222 million kilometers)',
    },
    Diameter: '3,031 miles (4,879 kilometers)',
    SurfaceTemperature: '-290 to 800 degrees Fahrenheit (-180 to 427 Celsius)',
    AtmosphericComposition:
      'Minimal atmosphere with traces of oxygen, sodium, hydrogen, helium, and potassium',
    RotationPeriod: '58.6 Earth days',
    OrbitPeriod: '88 Earth days',
    'Axial Tilt': '0.03 degrees',
    PhaseCycle: '116 days',
    SunlightTravelTime: '3.2 minutes',
    ZodiacalRestriction: 'Never more than 1 sign away from the Sun',
    PhysicalCharacteristics: {
      Surface: "Heavily cratered, resembling Earth's moon",
      MagneticField: 'Weak global magnetic field',
      Composition: 'Large iron core, thin crust, silicate mantle',
      NotableFeatures:
        'Closest planet to the Sun, fastest orbit in solar system, extreme temperature variations',
    },
  },
  AstrologicalProperties: {
    AlchemicalName: 'Hermes',
    DualDomicile: {
      Spring: 'Gemini (yang)',
      Autumn: 'Virgo (yin)',
    },
    HouseJoy: 1,
    CyclePeriod: {
      Return: 'Yearly',
      Retrograde: '3 weeks, three to four times yearly',
    },
    Exaltation: 'Virgo',
    Fall: 'Pisces',
    Detriment: ['Sagittarius', 'Pisces'],
    Keywords: [
      'Communication',
      'Intelligence',
      'Technology',
      'Travel',
      'Education',
      'Commerce',
      'Adaptability',
      'Analysis',
    ],
    Colors: ['Yellow', 'Orange', 'Light Blue', 'Silver', 'Gray', 'Iridescent'],
    Day: 'Wednesday',
    Metal: 'Quicksilver (mercury)',
    BodyParts: ['Brain', 'Nervous system', 'Hands', 'Arms', 'Lungs', 'Respiratory system'],
    Animals: ['Fox', 'Monkey', 'Ibis', 'Magpie'],
    Stones: ['Agate', 'Aquamarine', 'Opal', 'Topaz'],
  },
  ElementalConnections: {
    DayEmission: 'Spirit - "that which animates"',
    NightEmission: 'Substance - "that which takes form"',
    ElementalBridges: [
      'Connects Air and Earth',
      'Facilitates transition between immaterial and material',
    ],
    SharedElements: {
      Air: ['Saturn', 'Jupiter'],
      Earth: ['Venus', 'Saturn'],
    },
    AssociatedQualities: [
      'Adaptable',
      'Quick',
      'Versatile',
      'Analytical',
      'Communicative',
      'Detail-oriented',
      'Precise',
      'Neutral',
    ],
  },
  HerbalAssociations: {
    Herbs: [
      'Lavender',
      'Marjoram',
      'Mint',
      'Parsley',
      'Dill',
      'Fennel',
      'Anise',
      'Caraway',
      'Fenugreek',
      'Savory',
      'Valerian',
      'Licorice',
      'Papaya',
      'Mandrake',
      'Majoram',
      'Almond',
      'Celery',
      'Clover',
    ],
    Flowers: [
      'Lily of the Valley',
      'Morning Glory',
      'Lavender',
      'Honeysuckle',
      'Sweet Pea',
      'Hyssop',
      'Yarrow',
      'Yellow Lily',
      'Aspen',
      'Vervain',
    ],
    Woods: ['Hazel', 'Almond', 'Aspen', 'Olive'],
    Scents: [
      'Peppermint',
      'Lemongrass',
      'Eucalyptus',
      'Basil',
      'Clove',
      'Bergamot',
      'Petitgrain',
      'Grapefruit',
      'Citronella',
      'Anise',
      'Light Spices',
    ],
  },
  RetrogradeEffect: {
    Spirit: -0.3,
    Essence: 0,
    Matter: 0.3,
    Substance: -0.2,
  },
  FoodAssociations: [
    'mixed foods',
    'small bites',
    'finger foods',
    'herb-infused dishes',
    'complex flavor combinations',
    'anise',
    'dill',
    'fennel',
    'light grains',
    'nuts',
    'seeds',
    'teas and infusions',
    'fermented foods',
    'foods that combine multiple ingredients',
    'dishes with intricate techniques',
    'small plates with variety',
    'foods requiring dexterity to eat',
    'fusion cuisine',
    'multi-textured dishes',
    'foods rich in mental stimulants',
    'fresh herbs',
    'citrus',
    'light broths',
    'refined dishes',
    'foods with many components',
    'dishes requiring precise timing',
    'raw foods',
  ],
  FlavorProfiles: {
    Sweet: 0.3,
    Sour: 0.5,
    Salty: 0.4,
    Bitter: 0.6,
    Umami: 0.3,
    Spicy: 0.3,
  },
  CulinaryInfluences: [
    'Enhances complexity in flavor combinations',
    'Improves aromatic quality of herbs and spices',
    'Supports quick cooking techniques',
    'Aids in the incorporation of multiple ingredients',
    'Promotes balanced flavor profiles',
    'Encourages experimental cooking approaches',
    'Facilitates precise cooking methods',
    'Enhances sensory experience through multiple textures',
    'Supports adaptability in food preparation',
    'Encourages mental engagement with food',
    'Promotes varied diets',
    'Facilitates learning new cooking techniques',
    'Enhances food presentation details',
  ],
  ANumberModifiers: {
    Base: 1.0, // Mercury adds balanced A-Number boost through Spirit and Substance
    HighDignitiy: 0.6, // Significant boost in Gemini/Virgo
    LowDignity: -0.4, // Notable reduction in Sagittarius/Pisces
    AspectBonus: {
      conjunction: 0.25,
      trine: 0.2,
      square: -0.15,
      opposition: -0.2,
      sextile: 0.15,
    },
    SeasonalAdjustment: {
      summer: 0.2, // Quick communication and movement
      spring: 0.3, // New ideas and learning
      autumn: 0.1, // Harvest of knowledge
      winter: -0.1, // Slower mental processes
    },
  },
  AspectsEffect: {
    Sun: {
      Conjunction: 0.2,
      Opposition: -0.1,
      Trine: 0.4,
      Square: 0.0,
      Sextile: 0.3,
    },
    Moon: {
      Conjunction: 0.3,
      Opposition: 0.1,
      Trine: 0.3,
      Square: -0.1,
      Sextile: 0.2,
    },
    Venus: {
      Conjunction: 0.4,
      Opposition: 0.0,
      Trine: 0.3,
      Square: -0.1,
      Sextile: 0.2,
    },
    Mars: {
      Conjunction: 0.3,
      Opposition: -0.2,
      Trine: 0.2,
      Square: -0.3,
      Sextile: 0.1,
    },
    Jupiter: {
      Conjunction: 0.5,
      Opposition: 0.1,
      Trine: 0.4,
      Square: 0.0,
      Sextile: 0.3,
    },
    Saturn: {
      Conjunction: -0.2,
      Opposition: -0.3,
      Trine: 0.2,
      Square: -0.3,
      Sextile: 0.1,
    },
  },
  PlanetSpecific: {
    Mercury: {
      RetrogradeIntensity: 0.7,
      CommunicationEffects: {
        Direct:
          'Enhances clarity of flavor and precision in cooking techniques. Good for following complex recipes and experimental cooking.',
        Retrograde:
          'Increases likelihood of cooking mishaps. Best to stick to familiar recipes and comfort foods. May cause unexpected flavor combinations that can be surprisingly good.',
      },
      FlavorModulation: {
        Direct: {
          Sweet: 0.3,
          Sour: 0.5,
          Salty: 0.4,
          Bitter: 0.6,
          Umami: 0.3,
          Spicy: 0.3,
        },
        Retrograde: {
          Sweet: 0.2,
          Sour: 0.6,
          Salty: 0.3,
          Bitter: 0.7,
          Umami: 0.2,
          Spicy: 0.4,
        },
      },
      ZodiacInfluence: {
        Gemini: {
          CulinaryEffect: 'Enhances versatility in cooking, good for fusion cuisine',
          RecommendedTechniques: [
            'stir-frying',
            'small plates',
            'appetizers',
            'varied tasting menus',
          ],
        },
        Virgo: {
          CulinaryEffect: 'Increases precision and attention to detail in cooking',
          RecommendedTechniques: [
            'detailed garnishing',
            'precise baking',
            'health-focused cooking',
            'fermentation',
          ],
        },
        Pisces: {
          CulinaryEffect: 'Can cause confusion in recipes, but increases intuitive cooking',
          RecommendedTechniques: [
            'infusions',
            'seafood preparation',
            'ethereal presentation',
            'subtle seasoning',
          ],
        },
      },
      RetrogradeCycle: {
        PreShadow: {
          Duration: '2 weeks',
          CulinaryEffect: 'Begin simplifying recipes, check ingredients carefully',
          Recommendation: 'Start preparing make-ahead meals and batch cooking',
        },
        Retrograde: {
          Duration: '3 weeks',
          CulinaryEffect: 'Communication breakdowns affect recipe following, unexpected results',
          Recommendation: 'Use tried and true recipes, avoid complex new techniques',
        },
        PostShadow: {
          Duration: '2 weeks',
          CulinaryEffect: 'Gradually return to normal cooking patterns, integrate lessons learned',
          Recommendation: 'Revisit and perfect recipes that had issues during retrograde',
        },
      },
    },
    ZodiacTransit: {
      Gemini: {
        FoodFocus: 'Diverse, light dishes with multiple flavor notes and interesting combinations',
        Elements: {
          Fire: 0.2,
          Earth: 0.1,
          Air: 0.9,
          Water: 0.1,
        },
        Ingredients: [
          'fresh herbs',
          'variety of spices',
          'finger foods',
          'fusion cuisine',
          'appetizer flights',
          'complex salads',
        ],
      },
      Cancer: {
        FoodFocus: 'Thoughtful comfort food with precise seasoning and nostalgic elements',
        Elements: {
          Fire: 0.1,
          Earth: 0.2,
          Air: 0.4,
          Water: 0.7,
        },
        Ingredients: [
          'herb-infused broths',
          'delicate seafood',
          'carefully seasoned rice dishes',
          'family recipes with modern twists',
        ],
      },
      Leo: {
        FoodFocus:
          'Bold presentation with technical finesse, showstopping dishes that stimulate conversation',
        Elements: {
          Fire: 0.7,
          Earth: 0.1,
          Air: 0.5,
          Water: 0.1,
        },
        Ingredients: [
          'dishes requiring technical skill',
          'visually impressive presentations',
          'foods that foster sharing',
          'aromatic herbs',
        ],
      },
      Virgo: {
        FoodFocus:
          'Precisely executed dishes with attention to health factors and detailed preparation',
        Elements: {
          Fire: 0.1,
          Earth: 0.9,
          Air: 0.3,
          Water: 0.1,
        },
        Ingredients: [
          'carefully measured spices',
          'meticulously prepared vegetables',
          'precise fermentations',
          'artfully arranged plates',
        ],
      },
      Libra: {
        FoodFocus:
          'Balanced flavor combinations that engage multiple senses, aesthetically pleasing presentation',
        Elements: {
          Fire: 0.1,
          Earth: 0.2,
          Air: 0.8,
          Water: 0.3,
        },
        Ingredients: [
          'harmonious ingredient pairings',
          'visually balanced plates',
          'social dining experiences',
          'contrasting textures',
        ],
      },
      Scorpio: {
        FoodFocus:
          'Complex, mysterious flavor profiles with hidden ingredients, intensely aromatic dishes',
        Elements: {
          Fire: 0.3,
          Earth: 0.1,
          Air: 0.2,
          Water: 0.8,
        },
        Ingredients: [
          'fermented foods',
          'umami-rich ingredients',
          'surprising flavor reveals',
          'intense herb infusions',
        ],
      },
    },
    TransitDates: {
      RetrogradePhases: {
        Retrograde2024Q2: {
          PreShadow: { Start: '2024-04-01', End: '2024-04-21' },
          Retrograde: { Start: '2024-04-21', End: '2024-05-14' },
          PostShadow: { Start: '2024-05-14', End: '2024-05-31' },
          Signs: ['Taurus', 'Aries'],
          CulinaryEffect:
            'Review food sourcing and preparation techniques, return to traditional cooking methods',
        },
        Retrograde2024Q3: {
          PreShadow: { Start: '2024-08-08', End: '2024-08-23' },
          Retrograde: { Start: '2024-08-23', End: '2024-09-15' },
          PostShadow: { Start: '2024-09-15', End: '2024-10-02' },
          Signs: ['Virgo', 'Leo'],
          CulinaryEffect:
            'Revisit precise cooking techniques, double-check measurements, simplify elaborate dishes',
        },
        Retrograde2024Q4: {
          PreShadow: { Start: '2024-12-01', End: '2024-12-13' },
          Retrograde: { Start: '2024-12-13', End: '2025-01-02' },
          PostShadow: { Start: '2025-01-02', End: '2025-01-21' },
          Signs: ['Capricorn', 'Sagittarius'],
          CulinaryEffect: 'Reassess traditional holiday recipes, reconnect with food heritage',
        },
        Retrograde2025Q1: {
          PreShadow: { Start: '2025-03-26', End: '2025-04-13' },
          Retrograde: { Start: '2025-04-13', End: '2025-05-07' },
          PostShadow: { Start: '2025-05-07', End: '2025-05-22' },
          Signs: ['Aries', 'Pisces'],
          CulinaryEffect: 'Balance impulsive cooking urges, revisit intuitive cooking approaches',
        },
      },
      DirectPhasesQ2_2024: {
        Aries: { Start: '2024-04-01', End: '2024-04-13' },
        Taurus: { Start: '2024-05-15', End: '2024-05-31' },
        Gemini: { Start: '2024-05-31', End: '2024-06-17' },
        Cancer: { Start: '2024-06-17', End: '2024-07-02' },
        Leo: { Start: '2024-07-02', End: '2024-07-21' },
        Virgo: { Start: '2024-07-21', End: '2024-08-08' },
      },
      DirectPhasesQ4_2024: {
        Libra: { Start: '2024-10-02', End: '2024-10-26' },
        Scorpio: { Start: '2024-10-26', End: '2024-11-15' },
        Sagittarius: { Start: '2024-11-15', End: '2024-12-01' },
        Capricorn: { Start: '2025-01-02', End: '2025-01-22' },
        Aquarius: { Start: '2025-01-22', End: '2025-02-10' },
        Pisces: { Start: '2025-02-10', End: '2025-02-27' },
      },
    },
  },
}

export default mercuryData
