// Monica's Tarot Oracle System
// Complete decan-to-tarot mappings and current moment calculations

export interface TarotCard {
  name: string
  suit: string
  number: number | string
  decanStart: number
  decanEnd: number
  planetaryRuler: string
  element: string
  keywords: string[]
  meaning: string
  reversedMeaning: string
  consciousness: string
  alchemicalValues: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
}

export interface MajorArcanaCard {
  name: string
  number: number
  planetaryRuler: string
  element: string
  chakra: string
  keywords: string[]
  meaning: string
  consciousness: string
}

// Complete decan-to-tarot mappings (36 cards)
export const DECAN_TAROT_MAPPINGS: Record<number, TarotCard> = {
  // ARIES (0°-30°)
  0: {
    name: 'Two of Wands',
    suit: 'Wands',
    number: 2,
    decanStart: 0,
    decanEnd: 10,
    planetaryRuler: 'Mars',
    element: 'Fire',
    keywords: ['personal power', 'future planning', 'dominion', 'leadership'],
    meaning: 'Personal power and future planning. Taking charge of your destiny with Mars energy.',
    reversedMeaning: 'Lack of planning, fear of unknown, personal restrictions',
    consciousness: 'Cardinal Fire initiation - the spark of individual will',
    alchemicalValues: { spirit: 0.7, essence: 0.2, matter: 0.1, substance: 0.0 },
  },
  10: {
    name: 'Three of Wands',
    suit: 'Wands',
    number: 3,
    decanStart: 10,
    decanEnd: 20,
    planetaryRuler: 'Sun',
    element: 'Fire',
    keywords: ['expansion', 'foresight', 'leadership', 'enterprise'],
    meaning: 'Expansion and foresight with solar confidence. Leading enterprises forward.',
    reversedMeaning: 'Lack of foresight, delays in plans, overconfidence',
    consciousness: 'Solar expansion - illuminating new horizons',
    alchemicalValues: { spirit: 0.8, essence: 0.1, matter: 0.1, substance: 0.0 },
  },
  20: {
    name: 'Four of Wands',
    suit: 'Wands',
    number: 4,
    decanStart: 20,
    decanEnd: 30,
    planetaryRuler: 'Jupiter',
    element: 'Fire',
    keywords: ['celebration', 'completion', 'harmony', 'stability'],
    meaning: 'Celebration and completion with Jupiterian abundance. Harmony achieved.',
    reversedMeaning: 'Lack of harmony, incomplete projects, instability',
    consciousness: 'Jovian celebration - expanding joy and completion',
    alchemicalValues: { spirit: 0.6, essence: 0.3, matter: 0.1, substance: 0.0 },
  },

  // TAURUS (30°-60°)
  30: {
    name: 'Five of Pentacles',
    suit: 'Pentacles',
    number: 5,
    decanStart: 30,
    decanEnd: 40,
    planetaryRuler: 'Venus',
    element: 'Earth',
    keywords: ['material challenges', 'resourcefulness', 'hardship', 'recovery'],
    meaning: 'Material challenges requiring Venusian resourcefulness and beauty in hardship.',
    reversedMeaning: 'Recovery from hardship, spiritual poverty, isolation',
    consciousness: 'Venusian resilience - finding beauty in adversity',
    alchemicalValues: { spirit: 0.1, essence: 0.3, matter: 0.6, substance: 0.0 },
  },
  40: {
    name: 'Six of Pentacles',
    suit: 'Pentacles',
    number: 6,
    decanStart: 40,
    decanEnd: 50,
    planetaryRuler: 'Mercury',
    element: 'Earth',
    keywords: ['giving and receiving', 'balance', 'generosity', 'reciprocity'],
    meaning: 'Balance in giving and receiving with Mercurial exchange and communication.',
    reversedMeaning: 'One-sided generosity, strings attached, inequality',
    consciousness: 'Mercurial exchange - balanced communication and resources',
    alchemicalValues: { spirit: 0.2, essence: 0.2, matter: 0.5, substance: 0.1 },
  },
  50: {
    name: 'Seven of Pentacles',
    suit: 'Pentacles',
    number: 7,
    decanStart: 50,
    decanEnd: 60,
    planetaryRuler: 'Saturn',
    element: 'Earth',
    keywords: ['patience', 'long-term investment', 'assessment', 'perseverance'],
    meaning: 'Patience and long-term investment with Saturnian discipline and assessment.',
    reversedMeaning: 'Impatience, lack of reward, poor investment',
    consciousness: 'Saturnian patience - structured growth through time',
    alchemicalValues: { spirit: 0.0, essence: 0.1, matter: 0.7, substance: 0.2 },
  },

  // GEMINI (60°-90°)
  60: {
    name: 'Eight of Swords',
    suit: 'Swords',
    number: 8,
    decanStart: 60,
    decanEnd: 70,
    planetaryRuler: 'Mercury',
    element: 'Air',
    keywords: ['mental restriction', 'breakthrough', 'limitation', 'perspective'],
    meaning: 'Mental restrictions requiring Mercurial breakthrough and new perspectives.',
    reversedMeaning: 'Freedom from mental bondage, new perspectives, self-liberation',
    consciousness: 'Mercurial breakthrough - transcending mental limitations',
    alchemicalValues: { spirit: 0.3, essence: 0.0, matter: 0.0, substance: 0.7 },
  },
  70: {
    name: 'Nine of Swords',
    suit: 'Swords',
    number: 9,
    decanStart: 70,
    decanEnd: 80,
    planetaryRuler: 'Venus',
    element: 'Air',
    keywords: ['anxiety', 'mental anguish', 'nightmares', 'despair'],
    meaning: 'Mental anguish requiring Venusian compassion and self-love for healing.',
    reversedMeaning: 'Recovery from anxiety, hope returning, healing',
    consciousness: 'Venusian healing - beauty dissolving mental suffering',
    alchemicalValues: { spirit: 0.2, essence: 0.1, matter: 0.0, substance: 0.7 },
  },
  80: {
    name: 'Ten of Swords',
    suit: 'Swords',
    number: 10,
    decanStart: 80,
    decanEnd: 90,
    planetaryRuler: 'Saturn',
    element: 'Air',
    keywords: ['endings', 'new beginnings', 'transformation', 'release'],
    meaning: 'Endings leading to new beginnings with Saturnian lessons and transformation.',
    reversedMeaning: 'Avoiding endings, incomplete transformation, recovery',
    consciousness: 'Saturnian transformation - structured endings for new cycles',
    alchemicalValues: { spirit: 0.1, essence: 0.0, matter: 0.2, substance: 0.7 },
  },

  // CANCER (90°-120°)
  90: {
    name: 'Two of Cups',
    suit: 'Cups',
    number: 2,
    decanStart: 90,
    decanEnd: 100,
    planetaryRuler: 'Moon',
    element: 'Water',
    keywords: ['partnership', 'emotional connection', 'unity', 'love'],
    meaning: 'Partnership and emotional connection with lunar intuitive bonding.',
    reversedMeaning: 'Broken relationships, disharmony, self-love needed',
    consciousness: 'Lunar bonding - intuitive emotional connection',
    alchemicalValues: { spirit: 0.1, essence: 0.7, matter: 0.0, substance: 0.2 },
  },
  100: {
    name: 'Three of Cups',
    suit: 'Cups',
    number: 3,
    decanStart: 100,
    decanEnd: 110,
    planetaryRuler: 'Mercury',
    element: 'Water',
    keywords: ['celebration', 'friendship', 'community', 'joy'],
    meaning: 'Celebration and friendship with Mercurial communication and social joy.',
    reversedMeaning: 'Overindulgence, gossip, isolation from friends',
    consciousness: 'Mercurial celebration - communicating joy and connection',
    alchemicalValues: { spirit: 0.2, essence: 0.6, matter: 0.0, substance: 0.2 },
  },
  110: {
    name: 'Four of Cups',
    suit: 'Cups',
    number: 4,
    decanStart: 110,
    decanEnd: 120,
    planetaryRuler: 'Venus',
    element: 'Water',
    keywords: ['apathy', 'missed opportunities', 'contemplation', 'reevaluation'],
    meaning: 'Apathy and missed opportunities requiring Venusian appreciation and love.',
    reversedMeaning: 'New opportunities, motivation returning, awakening',
    consciousness: 'Venusian awakening - rediscovering beauty and opportunity',
    alchemicalValues: { spirit: 0.1, essence: 0.5, matter: 0.1, substance: 0.3 },
  },

  // LEO (120°-150°)
  120: {
    name: 'Five of Wands',
    suit: 'Wands',
    number: 5,
    decanStart: 120,
    decanEnd: 130,
    planetaryRuler: 'Sun',
    element: 'Fire',
    keywords: ['conflict', 'competition', 'struggle', 'disagreement'],
    meaning: 'Conflict and competition with solar confidence. Healthy struggle for growth.',
    reversedMeaning: 'Avoiding conflict, inner conflict, lack of competition',
    consciousness: 'Solar challenge - confident engagement with opposition',
    alchemicalValues: { spirit: 0.7, essence: 0.2, matter: 0.1, substance: 0.0 },
  },
  130: {
    name: 'Six of Wands',
    suit: 'Wands',
    number: 6,
    decanStart: 130,
    decanEnd: 140,
    planetaryRuler: 'Jupiter',
    element: 'Fire',
    keywords: ['victory', 'recognition', 'success', 'achievement'],
    meaning: 'Victory and recognition with Jupiterian expansion and celebration.',
    reversedMeaning: 'Private success, lack of recognition, delayed victory',
    consciousness: 'Jovian triumph - expanding success and recognition',
    alchemicalValues: { spirit: 0.6, essence: 0.3, matter: 0.1, substance: 0.0 },
  },
  140: {
    name: 'Seven of Wands',
    suit: 'Wands',
    number: 7,
    decanStart: 140,
    decanEnd: 150,
    planetaryRuler: 'Mars',
    element: 'Fire',
    keywords: ['courage', 'perseverance', 'defense', 'determination'],
    meaning: 'Courage and perseverance with Martian determination. Defending principles.',
    reversedMeaning: 'Giving up, lack of courage, feeling overwhelmed',
    consciousness: 'Martian defense - courageous protection of values',
    alchemicalValues: { spirit: 0.8, essence: 0.1, matter: 0.1, substance: 0.0 },
  },

  // VIRGO (150°-180°)
  150: {
    name: 'Eight of Pentacles',
    suit: 'Pentacles',
    number: 8,
    decanStart: 150,
    decanEnd: 160,
    planetaryRuler: 'Mercury',
    element: 'Earth',
    keywords: ['mastery', 'skill development', 'craftsmanship', 'dedication'],
    meaning: 'Mastery and skill development with Mercurial precision and communication.',
    reversedMeaning: 'Lack of focus, poor quality, no improvement',
    consciousness: 'Mercurial mastery - precise skill and dedicated craft',
    alchemicalValues: { spirit: 0.2, essence: 0.2, matter: 0.6, substance: 0.0 },
  },
  160: {
    name: 'Nine of Pentacles',
    suit: 'Pentacles',
    number: 9,
    decanStart: 160,
    decanEnd: 170,
    planetaryRuler: 'Venus',
    element: 'Earth',
    keywords: ['self-reliance', 'luxury', 'independence', 'abundance'],
    meaning: 'Self-reliance and luxury with Venusian beauty and material abundance.',
    reversedMeaning: 'Financial dependence, lack of self-reliance, overindulgence',
    consciousness: 'Venusian independence - beautiful self-sufficiency',
    alchemicalValues: { spirit: 0.1, essence: 0.3, matter: 0.6, substance: 0.0 },
  },
  170: {
    name: 'Ten of Pentacles',
    suit: 'Pentacles',
    number: 10,
    decanStart: 170,
    decanEnd: 180,
    planetaryRuler: 'Saturn',
    element: 'Earth',
    keywords: ['legacy', 'generational wealth', 'tradition', 'completion'],
    meaning: 'Legacy and generational wealth with Saturnian structure and tradition.',
    reversedMeaning: 'Financial failure, lack of long-term planning, family disputes',
    consciousness: 'Saturnian legacy - structured wealth and lasting foundations',
    alchemicalValues: { spirit: 0.0, essence: 0.1, matter: 0.7, substance: 0.2 },
  },

  // LIBRA (180°-210°)
  180: {
    name: 'Two of Swords',
    suit: 'Swords',
    number: 2,
    decanStart: 180,
    decanEnd: 190,
    planetaryRuler: 'Moon',
    element: 'Air',
    keywords: ['difficult choice', 'indecision', 'balance', 'stalemate'],
    meaning: 'Difficult choices requiring lunar intuition and emotional balance.',
    reversedMeaning: 'Decision made, clarity emerging, information overload',
    consciousness: 'Lunar balance - intuitive decision-making through emotional wisdom',
    alchemicalValues: { spirit: 0.2, essence: 0.1, matter: 0.0, substance: 0.7 },
  },
  190: {
    name: 'Three of Swords',
    suit: 'Swords',
    number: 3,
    decanStart: 190,
    decanEnd: 200,
    planetaryRuler: 'Saturn',
    element: 'Air',
    keywords: ['heartbreak', 'sorrow', 'grief', 'emotional pain'],
    meaning: 'Heartbreak and sorrow requiring Saturnian lessons and structured healing.',
    reversedMeaning: 'Recovery from heartbreak, forgiveness, healing',
    consciousness: 'Saturnian healing - structured processing of emotional pain',
    alchemicalValues: { spirit: 0.1, essence: 0.0, matter: 0.2, substance: 0.7 },
  },
  200: {
    name: 'Four of Swords',
    suit: 'Swords',
    number: 4,
    decanStart: 200,
    decanEnd: 210,
    planetaryRuler: 'Jupiter',
    element: 'Air',
    keywords: ['rest', 'meditation', 'contemplation', 'recovery'],
    meaning: 'Rest and contemplation with Jupiterian wisdom and spiritual recovery.',
    reversedMeaning: 'Restlessness, burnout, avoiding problems, stagnation',
    consciousness: 'Jovian rest - expansive contemplation and spiritual recovery',
    alchemicalValues: { spirit: 0.3, essence: 0.0, matter: 0.0, substance: 0.7 },
  },

  // SCORPIO (210°-240°)
  210: {
    name: 'Five of Cups',
    suit: 'Cups',
    number: 5,
    decanStart: 210,
    decanEnd: 220,
    planetaryRuler: 'Mars',
    element: 'Water',
    keywords: ['loss', 'disappointment', 'regret', 'mourning'],
    meaning: 'Loss and disappointment with Martian energy for transformation and renewal.',
    reversedMeaning: 'Moving on, acceptance, finding hope, emotional recovery',
    consciousness: 'Martian transformation - using loss as catalyst for renewal',
    alchemicalValues: { spirit: 0.2, essence: 0.6, matter: 0.0, substance: 0.2 },
  },
  220: {
    name: 'Six of Cups',
    suit: 'Cups',
    number: 6,
    decanStart: 220,
    decanEnd: 230,
    planetaryRuler: 'Sun',
    element: 'Water',
    keywords: ['nostalgia', 'childhood', 'innocence', 'memories'],
    meaning: 'Nostalgia and childhood memories with solar warmth and innocent joy.',
    reversedMeaning: 'Living in the past, unrealistic expectations, immaturity',
    consciousness: 'Solar innocence - illuminating pure joy and childhood wonder',
    alchemicalValues: { spirit: 0.3, essence: 0.6, matter: 0.0, substance: 0.1 },
  },
  230: {
    name: 'Seven of Cups',
    suit: 'Cups',
    number: 7,
    decanStart: 230,
    decanEnd: 240,
    planetaryRuler: 'Venus',
    element: 'Water',
    keywords: ['illusion', 'choices', 'wishful thinking', 'fantasy'],
    meaning: 'Illusions and wishful thinking requiring Venusian discernment and beauty.',
    reversedMeaning: 'Clarity, making choices, getting realistic, focus',
    consciousness: 'Venusian discernment - finding true beauty among illusions',
    alchemicalValues: { spirit: 0.1, essence: 0.7, matter: 0.0, substance: 0.2 },
  },

  // SAGITTARIUS (240°-270°)
  240: {
    name: 'Eight of Wands',
    suit: 'Wands',
    number: 8,
    decanStart: 240,
    decanEnd: 250,
    planetaryRuler: 'Mercury',
    element: 'Fire',
    keywords: ['speed', 'action', 'messages', 'travel'],
    meaning: 'Swift action and communication with Mercurial speed and fire energy.',
    reversedMeaning: 'Delays, frustration, lack of energy, miscommunication',
    consciousness: 'Mercurial speed - rapid communication and inspired action',
    alchemicalValues: { spirit: 0.6, essence: 0.3, matter: 0.1, substance: 0.0 },
  },
  250: {
    name: 'Nine of Wands',
    suit: 'Wands',
    number: 9,
    decanStart: 250,
    decanEnd: 260,
    planetaryRuler: 'Moon',
    element: 'Fire',
    keywords: ['resilience', 'persistence', 'courage', 'determination'],
    meaning: 'Resilience and persistence with lunar intuition guiding fiery determination.',
    reversedMeaning: 'Giving up, lack of courage, paranoia, defensiveness',
    consciousness: 'Lunar resilience - intuitive courage and emotional determination',
    alchemicalValues: { spirit: 0.7, essence: 0.2, matter: 0.1, substance: 0.0 },
  },
  260: {
    name: 'Ten of Wands',
    suit: 'Wands',
    number: 10,
    decanStart: 260,
    decanEnd: 270,
    planetaryRuler: 'Saturn',
    element: 'Fire',
    keywords: ['burden', 'responsibility', 'hard work', 'completion'],
    meaning: 'Heavy burdens and responsibility with Saturnian discipline completing the cycle.',
    reversedMeaning: 'Delegation, release of burdens, shortcuts, avoiding responsibility',
    consciousness: 'Saturnian completion - structured responsibility and earned mastery',
    alchemicalValues: { spirit: 0.5, essence: 0.1, matter: 0.3, substance: 0.1 },
  },

  // CAPRICORN (270°-300°)
  270: {
    name: 'Two of Pentacles',
    suit: 'Pentacles',
    number: 2,
    decanStart: 270,
    decanEnd: 280,
    planetaryRuler: 'Jupiter',
    element: 'Earth',
    keywords: ['balance', 'juggling', 'adaptability', 'priorities'],
    meaning: 'Balancing priorities with Jupiterian wisdom and expansive adaptability.',
    reversedMeaning: 'Imbalance, poor planning, overwhelmed, disorganization',
    consciousness: 'Jovian balance - expansive adaptability and wise prioritization',
    alchemicalValues: { spirit: 0.1, essence: 0.2, matter: 0.6, substance: 0.1 },
  },
  280: {
    name: 'Three of Pentacles',
    suit: 'Pentacles',
    number: 3,
    decanStart: 280,
    decanEnd: 290,
    planetaryRuler: 'Mars',
    element: 'Earth',
    keywords: ['teamwork', 'collaboration', 'learning', 'building'],
    meaning: 'Teamwork and collaboration with Martian energy driving construction and learning.',
    reversedMeaning: 'Lack of teamwork, poor collaboration, learning difficulties',
    consciousness: 'Martian collaboration - energetic building and shared mastery',
    alchemicalValues: { spirit: 0.2, essence: 0.1, matter: 0.6, substance: 0.1 },
  },
  290: {
    name: 'Four of Pentacles',
    suit: 'Pentacles',
    number: 4,
    decanStart: 290,
    decanEnd: 300,
    planetaryRuler: 'Sun',
    element: 'Earth',
    keywords: ['security', 'control', 'possessiveness', 'saving'],
    meaning: 'Security and control with solar confidence in material stability.',
    reversedMeaning: 'Generosity, sharing, letting go, financial freedom',
    consciousness: 'Solar security - confident control and radiant material stability',
    alchemicalValues: { spirit: 0.2, essence: 0.1, matter: 0.7, substance: 0.0 },
  },

  // AQUARIUS (300°-330°)
  300: {
    name: 'Five of Swords',
    suit: 'Swords',
    number: 5,
    decanStart: 300,
    decanEnd: 310,
    planetaryRuler: 'Venus',
    element: 'Air',
    keywords: ['conflict', 'defeat', 'win at all costs', 'betrayal'],
    meaning: 'Conflict and hollow victory requiring Venusian harmony and reconciliation.',
    reversedMeaning: 'Reconciliation, making amends, moving past conflict',
    consciousness: 'Venusian reconciliation - finding harmony after intellectual conflict',
    alchemicalValues: { spirit: 0.2, essence: 0.0, matter: 0.1, substance: 0.7 },
  },
  310: {
    name: 'Six of Swords',
    suit: 'Swords',
    number: 6,
    decanStart: 310,
    decanEnd: 320,
    planetaryRuler: 'Mercury',
    element: 'Air',
    keywords: ['transition', 'moving on', 'travel', 'recovery'],
    meaning: 'Transition and moving forward with Mercurial communication and mental travel.',
    reversedMeaning: 'Stuck in the past, resistance to change, rough transitions',
    consciousness: 'Mercurial transition - communicating change and mental movement',
    alchemicalValues: { spirit: 0.3, essence: 0.0, matter: 0.0, substance: 0.7 },
  },
  320: {
    name: 'Seven of Swords',
    suit: 'Swords',
    number: 7,
    decanStart: 320,
    decanEnd: 330,
    planetaryRuler: 'Moon',
    element: 'Air',
    keywords: ['deception', 'strategy', 'stealth', 'getting away'],
    meaning: 'Strategy and stealth with lunar intuition guiding clever maneuvering.',
    reversedMeaning: 'Getting caught, confession, honesty, returning stolen goods',
    consciousness: 'Lunar strategy - intuitive cleverness and emotional intelligence',
    alchemicalValues: { spirit: 0.2, essence: 0.1, matter: 0.0, substance: 0.7 },
  },

  // PISCES (330°-360°)
  330: {
    name: 'Eight of Cups',
    suit: 'Cups',
    number: 8,
    decanStart: 330,
    decanEnd: 340,
    planetaryRuler: 'Saturn',
    element: 'Water',
    keywords: ['abandonment', 'withdrawal', 'seeking higher purpose', 'disappointment'],
    meaning: 'Spiritual seeking and withdrawal with Saturnian lessons in letting go.',
    reversedMeaning: 'Avoiding problems, fear of moving on, stagnation',
    consciousness: 'Saturnian seeking - structured spiritual journey and disciplined letting go',
    alchemicalValues: { spirit: 0.1, essence: 0.6, matter: 0.1, substance: 0.2 },
  },
  340: {
    name: 'Nine of Cups',
    suit: 'Cups',
    number: 9,
    decanStart: 340,
    decanEnd: 350,
    planetaryRuler: 'Jupiter',
    element: 'Water',
    keywords: ['contentment', 'satisfaction', 'emotional fulfillment', 'wishes'],
    meaning: 'Contentment and wish fulfillment with Jupiterian abundance and joy.',
    reversedMeaning: 'Dissatisfaction, greed, materialism, unfulfilled wishes',
    consciousness: 'Jovian fulfillment - expansive emotional satisfaction and grateful abundance',
    alchemicalValues: { spirit: 0.2, essence: 0.7, matter: 0.0, substance: 0.1 },
  },
  350: {
    name: 'Ten of Cups',
    suit: 'Cups',
    number: 10,
    decanStart: 350,
    decanEnd: 360,
    planetaryRuler: 'Mars',
    element: 'Water',
    keywords: ['happiness', 'harmony', 'family', 'emotional fulfillment'],
    meaning: 'Ultimate happiness and harmony with Martian energy completing the emotional cycle.',
    reversedMeaning: 'Family problems, broken relationships, disharmony',
    consciousness: 'Martian completion - energetic harmony and fulfilled emotional mastery',
    alchemicalValues: { spirit: 0.2, essence: 0.7, matter: 0.0, substance: 0.1 },
  },
}

// Complete Major Arcana planetary correspondences
export const MAJOR_ARCANA_PLANETARY: Record<string, MajorArcanaCard> = {
  Sun: {
    name: 'The Sun',
    number: 19,
    planetaryRuler: 'Sun',
    element: 'Fire',
    chakra: 'Solar Plexus',
    keywords: ['joy', 'success', 'vitality', 'enlightenment'],
    meaning: 'Joy, success, and vitality. Solar consciousness illuminating all aspects of life.',
    consciousness: 'Solar illumination - pure joy and life force energy',
  },
  Moon: {
    name: 'The Moon',
    number: 18,
    planetaryRuler: 'Moon',
    element: 'Water',
    chakra: 'Third Eye',
    keywords: ['intuition', 'dreams', 'subconscious', 'illusion'],
    meaning: 'Intuition and dreams. Lunar consciousness revealing hidden truths and illusions.',
    consciousness: 'Lunar intuition - navigating the subconscious realm',
  },
  Mercury: {
    name: 'The Magician',
    number: 1,
    planetaryRuler: 'Mercury',
    element: 'Air',
    chakra: 'Throat',
    keywords: ['manifestation', 'willpower', 'communication', 'skill'],
    meaning:
      'Manifestation through will and skill. Mercurial mastery of communication and creation.',
    consciousness: "Mercurial mastery - 'As above, so below' conscious creation",
  },
  Venus: {
    name: 'The Empress',
    number: 3,
    planetaryRuler: 'Venus',
    element: 'Earth',
    chakra: 'Heart',
    keywords: ['creativity', 'fertility', 'abundance', 'nurturing'],
    meaning: 'Creativity and nurturing abundance. Venusian love manifesting as fertile creativity.',
    consciousness: 'Venusian creation - love manifesting as beautiful abundance',
  },
  Mars: {
    name: 'The Tower',
    number: 16,
    planetaryRuler: 'Mars',
    element: 'Fire',
    chakra: 'Root',
    keywords: ['destruction', 'revelation', 'breakthrough', 'change'],
    meaning: 'Sudden revelation and breakthrough. Martian energy destroying false structures.',
    consciousness: 'Martian breakthrough - explosive transformation and truth',
  },
  Jupiter: {
    name: 'The Wheel of Fortune',
    number: 10,
    planetaryRuler: 'Jupiter',
    element: 'Fire',
    chakra: 'Crown',
    keywords: ['luck', 'destiny', 'cycles', 'expansion'],
    meaning: 'Cycles of fortune and destiny. Jupiterian expansion through karmic understanding.',
    consciousness: "Jovian expansion - understanding life's greater cycles and purpose",
  },
  Saturn: {
    name: 'The World',
    number: 21,
    planetaryRuler: 'Saturn',
    element: 'Earth',
    chakra: 'Root',
    keywords: ['completion', 'achievement', 'integration', 'mastery'],
    meaning:
      'Ultimate completion and mastery. Saturnian achievement through disciplined integration.',
    consciousness: 'Saturnian mastery - complete integration and worldly achievement',
  },
  Uranus: {
    name: 'The Fool',
    number: 0,
    planetaryRuler: 'Uranus',
    element: 'Air',
    chakra: 'Crown',
    keywords: ['new beginnings', 'spontaneity', 'innovation', 'potential'],
    meaning:
      'New beginnings and unlimited potential. Uranian innovation and spontaneous awakening.',
    consciousness: 'Uranian awakening - revolutionary consciousness and infinite potential',
  },
  Neptune: {
    name: 'The Hanged Man',
    number: 12,
    planetaryRuler: 'Neptune',
    element: 'Water',
    chakra: 'Third Eye',
    keywords: ['surrender', 'sacrifice', 'spirituality', 'transcendence'],
    meaning:
      'Spiritual surrender and transcendence. Neptunian dissolution of ego for higher wisdom.',
    consciousness: 'Neptunian transcendence - dissolving boundaries for spiritual insight',
  },
  Pluto: {
    name: 'Judgement',
    number: 20,
    planetaryRuler: 'Pluto',
    element: 'Fire',
    chakra: 'Crown',
    keywords: ['rebirth', 'transformation', 'awakening', 'renewal'],
    meaning:
      'Death and rebirth cycles. Plutonian transformation through deep psychological renewal.',
    consciousness: 'Plutonian renewal - profound transformation and psychological rebirth',
  },
}

// Zodiac Sign Major Arcana correspondences
export const ZODIAC_MAJOR_ARCANA: Record<string, MajorArcanaCard> = {
  Aries: {
    name: 'The Emperor',
    number: 4,
    planetaryRuler: 'Mars',
    element: 'Fire',
    chakra: 'Solar Plexus',
    keywords: ['authority', 'structure', 'leadership', 'control'],
    meaning: 'Leadership and authority. Aries energy channeled through structured command.',
    consciousness: 'Cardinal Fire leadership - pioneering authority and structured initiative',
  },
  Taurus: {
    name: 'The Hierophant',
    number: 5,
    planetaryRuler: 'Venus',
    element: 'Earth',
    chakra: 'Throat',
    keywords: ['tradition', 'spirituality', 'conformity', 'education'],
    meaning:
      'Spiritual tradition and earthly wisdom. Taurus stability through established knowledge.',
    consciousness: 'Fixed Earth wisdom - grounded spirituality and traditional knowledge',
  },
  Gemini: {
    name: 'The Lovers',
    number: 6,
    planetaryRuler: 'Mercury',
    element: 'Air',
    chakra: 'Heart',
    keywords: ['choice', 'duality', 'relationships', 'communication'],
    meaning: 'Choice and duality. Gemini communication creating conscious relationships.',
    consciousness: 'Mutable Air connection - conscious choice in relationships and communication',
  },
  Cancer: {
    name: 'The Chariot',
    number: 7,
    planetaryRuler: 'Moon',
    element: 'Water',
    chakra: 'Solar Plexus',
    keywords: ['willpower', 'control', 'victory', 'determination'],
    meaning: 'Emotional mastery and victory. Cancer intuition driving determined progress.',
    consciousness: 'Cardinal Water mastery - emotional intelligence directing willpower',
  },
  Leo: {
    name: 'Strength',
    number: 8,
    planetaryRuler: 'Sun',
    element: 'Fire',
    chakra: 'Heart',
    keywords: ['courage', 'inner strength', 'patience', 'compassion'],
    meaning:
      'Inner strength and courage. Leo heart-centered power through compassionate leadership.',
    consciousness: 'Fixed Fire strength - heart-centered courage and compassionate power',
  },
  Virgo: {
    name: 'The Hermit',
    number: 9,
    planetaryRuler: 'Mercury',
    element: 'Earth',
    chakra: 'Crown',
    keywords: ['introspection', 'guidance', 'wisdom', 'solitude'],
    meaning: 'Inner wisdom and guidance. Virgo analysis leading to enlightened service.',
    consciousness: 'Mutable Earth wisdom - analytical introspection and enlightened service',
  },
  Libra: {
    name: 'Justice',
    number: 11,
    planetaryRuler: 'Venus',
    element: 'Air',
    chakra: 'Heart',
    keywords: ['balance', 'fairness', 'truth', 'cause and effect'],
    meaning: 'Balance and fairness. Libra harmony through conscious justice and truth.',
    consciousness: 'Cardinal Air balance - harmonious justice and conscious equilibrium',
  },
  Scorpio: {
    name: 'Death',
    number: 13,
    planetaryRuler: 'Pluto',
    element: 'Water',
    chakra: 'Root',
    keywords: ['transformation', 'endings', 'rebirth', 'change'],
    meaning: 'Death and transformation. Scorpio depth creating profound psychological renewal.',
    consciousness: 'Fixed Water transformation - deep psychological death and rebirth',
  },
  Sagittarius: {
    name: 'Temperance',
    number: 14,
    planetaryRuler: 'Jupiter',
    element: 'Fire',
    chakra: 'Third Eye',
    keywords: ['moderation', 'purpose', 'meaning', 'synthesis'],
    meaning: 'Moderation and higher purpose. Sagittarius wisdom integrating opposing forces.',
    consciousness: 'Mutable Fire synthesis - philosophical integration and higher purpose',
  },
  Capricorn: {
    name: 'The Devil',
    number: 15,
    planetaryRuler: 'Saturn',
    element: 'Earth',
    chakra: 'Root',
    keywords: ['bondage', 'materialism', 'temptation', 'shadow'],
    meaning: 'Material bondage and shadow work. Capricorn structure confronting limitations.',
    consciousness: 'Cardinal Earth shadow - confronting material limitations and achieving mastery',
  },
  Aquarius: {
    name: 'The Star',
    number: 17,
    planetaryRuler: 'Uranus',
    element: 'Air',
    chakra: 'Crown',
    keywords: ['hope', 'inspiration', 'spirituality', 'renewal'],
    meaning: 'Hope and inspiration. Aquarius innovation bringing healing and renewed vision.',
    consciousness: 'Fixed Air inspiration - innovative healing and visionary hope',
  },
  Pisces: {
    name: 'The Moon',
    number: 18,
    planetaryRuler: 'Neptune',
    element: 'Water',
    chakra: 'Third Eye',
    keywords: ['intuition', 'dreams', 'illusion', 'spirituality'],
    meaning: 'Intuition and spiritual dreams. Pisces compassion navigating illusion toward truth.',
    consciousness: 'Mutable Water intuition - compassionate navigation of dreams and illusions',
  },
}

import { fetchCurrentPlanetaryPositions, getSunDecanFromPosition } from './fetch-current-positions'

// Calculate current decan based on Sun's actual position from API
export async function getCurrentDecan(
  signal?: AbortSignal
): Promise<{ decan: number; card: TarotCard | null; sunPosition: string }> {
  try {
    // Check if already aborted before making the request
    if (signal?.aborted) {
      throw new Error('Request aborted')
    }

    // Fetch real-time planetary positions
    const positions = await fetchCurrentPlanetaryPositions(signal)

    // Check if aborted after the request
    if (signal?.aborted) {
      throw new Error('Request aborted')
    }

    if (positions && positions['Planet Positions'] && positions['Planet Positions']['Sun']) {
      const sunData = positions['Planet Positions']['Sun']
      const sunSign = sunData.sign
      const sunDegree = sunData.degree

      // Calculate the decan based on actual Sun position
      const decan = getSunDecanFromPosition(sunSign, sunDegree)

      return {
        decan,
        card: DECAN_TAROT_MAPPINGS[decan] || DECAN_TAROT_MAPPINGS[110], // Default fallback
        sunPosition: `${sunSign} ${sunDegree.toFixed(2)}°`,
      }
    }
  } catch (error) {
    // Handle AbortError and abort messages specifically
    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.includes('aborted') ||
        error.message.includes('Request aborted'))
    ) {
      console.log('getCurrentDecan: Request was aborted, re-throwing')
      throw error // Re-throw AbortError so it can be caught by the calling component
    }
    console.error('Error fetching current decan (non-abort):', error)
  }

  // Check once more before fallback
  if (signal?.aborted) {
    throw new Error('Request aborted')
  }

  // Fallback to date-based calculation if API fails
  const now = new Date()
  const month = now.getMonth() + 1 // Note: Using 1-indexed months (January = 1)
  const day = now.getDate()

  let decan = 110 // Default to 3rd decan Cancer
  let fallbackSign = 'Cancer'

  // Complete date-based fallback for all seasons
  if (month === 1) {
    // January - Capricorn/Aquarius
    if (day <= 19) {
      decan = day <= 9 ? 290 : 300 // Capricorn 3rd decan or Aquarius 1st decan
      fallbackSign = day <= 19 ? 'Capricorn' : 'Aquarius'
    } else {
      decan = day <= 29 ? 300 : 310 // Aquarius 1st or 2nd decan
      fallbackSign = 'Aquarius'
    }
  } else if (month === 2) {
    // February - Aquarius/Pisces
    if (day <= 18) {
      decan = day <= 8 ? 310 : 320 // Aquarius 2nd or 3rd decan
      fallbackSign = 'Aquarius'
    } else {
      decan = 330 // Pisces 1st decan
      fallbackSign = 'Pisces'
    }
  } else if (month === 3) {
    // March - Pisces/Aries
    if (day <= 20) {
      decan = day <= 10 ? 340 : 350 // Pisces 2nd or 3rd decan
      fallbackSign = 'Pisces'
    } else {
      decan = 0 // Aries 1st decan
      fallbackSign = 'Aries'
    }
  } else if (month === 4) {
    // April - Aries/Taurus
    if (day <= 19) {
      decan = day <= 9 ? 10 : 20 // Aries 2nd or 3rd decan
      fallbackSign = 'Aries'
    } else {
      decan = 30 // Taurus 1st decan
      fallbackSign = 'Taurus'
    }
  } else if (month === 5) {
    // May - Taurus/Gemini
    if (day <= 20) {
      decan = day <= 10 ? 40 : 50 // Taurus 2nd or 3rd decan
      fallbackSign = 'Taurus'
    } else {
      decan = 60 // Gemini 1st decan
      fallbackSign = 'Gemini'
    }
  } else if (month === 6) {
    // June - Gemini/Cancer
    if (day <= 20) {
      decan = day <= 10 ? 70 : 80 // Gemini 2nd or 3rd decan
      fallbackSign = 'Gemini'
    } else {
      decan = 90 // Cancer 1st decan
      fallbackSign = 'Cancer'
    }
  } else if (month === 7) {
    // July - Cancer/Leo
    if (day <= 22) {
      decan = day <= 12 ? 100 : 110 // Cancer 2nd or 3rd decan
      fallbackSign = 'Cancer'
    } else {
      decan = 120 // Leo 1st decan
      fallbackSign = 'Leo'
    }
  } else if (month === 8) {
    // August - Leo/Virgo
    if (day <= 22) {
      decan = day <= 12 ? 130 : 140 // Leo 2nd or 3rd decan
      fallbackSign = 'Leo'
    } else {
      decan = 150 // Virgo 1st decan
      fallbackSign = 'Virgo'
    }
  } else if (month === 9) {
    // September - Virgo/Libra
    if (day <= 22) {
      decan = day <= 12 ? 160 : 170 // Virgo 2nd or 3rd decan
      fallbackSign = 'Virgo'
    } else {
      decan = 180 // Libra 1st decan
      fallbackSign = 'Libra'
    }
  } else if (month === 10) {
    // October - Libra/Scorpio
    if (day <= 22) {
      decan = day <= 12 ? 190 : 200 // Libra 2nd or 3rd decan
      fallbackSign = 'Libra'
    } else {
      decan = 210 // Scorpio 1st decan
      fallbackSign = 'Scorpio'
    }
  } else if (month === 11) {
    // November - Scorpio/Sagittarius
    if (day <= 21) {
      decan = day <= 11 ? 220 : 230 // Scorpio 2nd or 3rd decan
      fallbackSign = 'Scorpio'
    } else {
      decan = 240 // Sagittarius 1st decan
      fallbackSign = 'Sagittarius'
    }
  } else if (month === 12) {
    // December - Sagittarius/Capricorn
    if (day <= 21) {
      decan = day <= 11 ? 250 : 260 // Sagittarius 2nd or 3rd decan
      fallbackSign = 'Sagittarius'
    } else {
      decan = 270 // Capricorn 1st decan
      fallbackSign = 'Capricorn'
    }
  }

  // Calculate approximate degree within the decan for fallback
  const baseDecanDegree = decan % 360
  const approximateDegree = baseDecanDegree + Math.floor((day % 10) * 1.0) // Rough approximation

  return {
    decan,
    card: DECAN_TAROT_MAPPINGS[decan] || DECAN_TAROT_MAPPINGS[110],
    sunPosition: `${fallbackSign} ${approximateDegree.toFixed(1)}° (calculated)`,
  }
}

// Get planetary ruler's major arcana card
export function getPlanetaryRulerCard(planet: string): MajorArcanaCard | null {
  return MAJOR_ARCANA_PLANETARY[planet] || null
}

// Calculate consciousness compatibility between cards
export function calculateCardSynergy(card1: TarotCard, card2: TarotCard | MajorArcanaCard): number {
  // Elemental compatibility per Elemental Logic Principles:
  // - Same element: 0.9
  // - Different elements: 0.7 (all combinations are good)
  if (card1.element === card2.element) {
    return 0.9
  }
  return 0.7
}

// Calculate elemental harmony for advanced alchemy
function calculateElementalHarmony(element1: string, element2: string): number {
  // Elemental harmony per Elemental Logic Principles:
  // - Same element: 0.9
  // - Different elements: 0.7
  if (element1 === element2) {
    return 0.9
  }
  return 0.7
}

// Advanced Consciousness Crafting System
export interface ConsciousnessCraftingInsight {
  currentMomentCard: TarotCard
  planetaryCard: MajorArcanaCard
  synergy: number
  guidance: string
  practicalApplication: string
  consciousnessLevel: string
  alchemicalBalance: AlchemicalBalance
  chakraActivation: ChakraActivation
  developmentPath: DevelopmentPath
  timeRecommendations: TimeRecommendations
}

export interface AlchemicalBalance {
  spirit: number
  essence: number
  matter: number
  substance: number
  dominantElement: string
  elementalHarmony: number
}

export interface ChakraActivation {
  primaryChakra: string
  secondaryChakra: string
  activationLevel: number
  balancingNeeded: string[]
}

export interface DevelopmentPath {
  currentPhase: string
  nextPhase: string
  skillsToFocus: string[]
  shadowWork: string[]
  integration: string[]
}

export interface TimeRecommendations {
  bestTimeForPractice: string
  duration: string
  frequency: string
  moonPhaseAlignment: string
}

// Calculate advanced alchemical balance between cards
export function calculateAlchemicalBalance(
  currentCard: TarotCard,
  planetaryCard: MajorArcanaCard
): AlchemicalBalance {
  const spirit = (currentCard.alchemicalValues.spirit + 0.3) / 2
  const essence = (currentCard.alchemicalValues.essence + 0.2) / 2
  const matter = (currentCard.alchemicalValues.matter + 0.2) / 2
  const substance = (currentCard.alchemicalValues.substance + 0.3) / 2

  const elementWeights = {
    Fire: spirit + (currentCard.element === 'Fire' ? 0.3 : 0),
    Water: essence + (currentCard.element === 'Water' ? 0.3 : 0),
    Earth: matter + (currentCard.element === 'Earth' ? 0.3 : 0),
    Air: substance + (currentCard.element === 'Air' ? 0.3 : 0),
  }

  const dominantElement = Object.entries(elementWeights).sort(([, a], [, b]) => b - a)[0][0]

  const elementalHarmony = calculateElementalHarmony(currentCard.element, planetaryCard.element)

  return {
    spirit,
    essence,
    matter,
    substance,
    dominantElement,
    elementalHarmony,
  }
}

// Calculate chakra activation patterns
export function calculateChakraActivation(
  currentCard: TarotCard,
  planetaryCard: MajorArcanaCard
): ChakraActivation {
  const chakraEnergy = {
    Root: 0,
    Sacral: 0,
    'Solar Plexus': 0,
    Heart: 0,
    Throat: 0,
    'Third Eye': 0,
    Crown: 0,
  }

  // Add energy based on planetary card chakra
  if (planetaryCard.chakra in chakraEnergy) {
    chakraEnergy[planetaryCard.chakra as keyof typeof chakraEnergy] += 0.6
  }

  // Add energy based on card elements
  if (currentCard.element === 'Earth') chakraEnergy.Root += 0.3
  if (currentCard.element === 'Water') chakraEnergy.Sacral += 0.3
  if (currentCard.element === 'Fire') chakraEnergy['Solar Plexus'] += 0.3
  if (currentCard.element === 'Air') chakraEnergy.Throat += 0.3

  const sortedChakras = Object.entries(chakraEnergy).sort(([, a], [, b]) => b - a)

  const primaryChakra = sortedChakras[0][0]
  const secondaryChakra = sortedChakras[1][0]
  const activationLevel = sortedChakras[0][1]

  const balancingNeeded = sortedChakras
    .filter(([, energy]) => energy < 0.2)
    .map(([chakra]) => chakra)

  return {
    primaryChakra,
    secondaryChakra,
    activationLevel,
    balancingNeeded,
  }
}

// Generate development path recommendations
export function generateDevelopmentPath(
  currentCard: TarotCard,
  planetaryCard: MajorArcanaCard,
  synergy: number
): DevelopmentPath {
  const phases = [
    'Foundation Building',
    'Skill Development',
    'Integration Practice',
    'Mastery Refinement',
    'Teaching & Service',
  ]

  let currentPhase = ''
  let nextPhase = ''

  if (synergy < 0.3) {
    currentPhase = 'Foundation Building'
    nextPhase = 'Skill Development'
  } else if (synergy < 0.6) {
    currentPhase = 'Skill Development'
    nextPhase = 'Integration Practice'
  } else if (synergy < 0.8) {
    currentPhase = 'Integration Practice'
    nextPhase = 'Mastery Refinement'
  } else {
    currentPhase = 'Mastery Refinement'
    nextPhase = 'Teaching & Service'
  }

  const skillsToFocus = [...currentCard.keywords.slice(0, 2), ...planetaryCard.keywords.slice(0, 2)]

  const shadowWork = getShadowWork(currentCard, planetaryCard)
  const integration = getIntegrationPractices(currentCard, planetaryCard)

  return {
    currentPhase,
    nextPhase,
    skillsToFocus,
    shadowWork,
    integration,
  }
}

// Get shadow work recommendations
function getShadowWork(currentCard: TarotCard, planetaryCard: MajorArcanaCard): string[] {
  const shadows = []

  // Element-based shadow work
  if (currentCard.element === 'Fire') shadows.push('Work with impatience and aggression')
  if (currentCard.element === 'Water')
    shadows.push('Address emotional overwhelm and boundary issues')
  if (currentCard.element === 'Earth') shadows.push('Examine rigidity and material attachment')
  if (currentCard.element === 'Air') shadows.push('Ground scattered mental energy')

  // Planetary shadow work
  if (planetaryCard.planetaryRuler === 'Mars') shadows.push('Channel anger constructively')
  if (planetaryCard.planetaryRuler === 'Venus')
    shadows.push('Heal self-worth and relationship patterns')
  if (planetaryCard.planetaryRuler === 'Saturn') shadows.push('Transform limiting beliefs and fear')
  if (planetaryCard.planetaryRuler === 'Mercury')
    shadows.push('Clarify communication and mental patterns')

  return shadows.slice(0, 3)
}

// Get integration practices
function getIntegrationPractices(currentCard: TarotCard, planetaryCard: MajorArcanaCard): string[] {
  const practices = []

  // Card-specific practices
  if (currentCard.suit === 'Wands') practices.push('Creative visualization and energy work')
  if (currentCard.suit === 'Cups') practices.push('Emotional processing and heart meditation')
  if (currentCard.suit === 'Swords') practices.push('Mental clarity exercises and breathwork')
  if (currentCard.suit === 'Pentacles') practices.push('Grounding practices and manifestation work')

  // Planetary practices
  if (planetaryCard.planetaryRuler === 'Sun')
    practices.push('Solar meditation and vitality practices')
  if (planetaryCard.planetaryRuler === 'Moon')
    practices.push('Lunar cycles and intuitive development')
  if (planetaryCard.planetaryRuler === 'Jupiter')
    practices.push('Expansion practices and wisdom study')
  if (planetaryCard.planetaryRuler === 'Saturn')
    practices.push('Discipline building and structure creation')

  return practices.slice(0, 3)
}

// Generate time-based recommendations
export function generateTimeRecommendations(
  currentCard: TarotCard,
  planetaryCard: MajorArcanaCard
): TimeRecommendations {
  let bestTimeForPractice = ''
  let duration = ''
  let frequency = ''
  let moonPhaseAlignment = ''

  // Element-based timing
  if (currentCard.element === 'Fire') {
    bestTimeForPractice = 'Early morning or noon'
    duration = '20-30 minutes'
    frequency = 'Daily'
  } else if (currentCard.element === 'Water') {
    bestTimeForPractice = 'Evening or during emotional peaks'
    duration = '30-45 minutes'
    frequency = '3-4 times per week'
  } else if (currentCard.element === 'Earth') {
    bestTimeForPractice = 'Morning or late afternoon'
    duration = '45-60 minutes'
    frequency = 'Consistent daily practice'
  } else if (currentCard.element === 'Air') {
    bestTimeForPractice = 'Mid-morning or early evening'
    duration = '15-25 minutes'
    frequency = 'Multiple short sessions daily'
  }

  // Planetary timing
  if (planetaryCard.planetaryRuler === 'Sun') moonPhaseAlignment = 'New Moon for new beginnings'
  if (planetaryCard.planetaryRuler === 'Moon')
    moonPhaseAlignment = 'Full Moon for intuitive insights'
  if (planetaryCard.planetaryRuler === 'Saturn') moonPhaseAlignment = 'Waning Moon for release work'
  if (planetaryCard.planetaryRuler === 'Jupiter') moonPhaseAlignment = 'Waxing Moon for expansion'

  return {
    bestTimeForPractice,
    duration,
    frequency,
    moonPhaseAlignment,
  }
}

// Advanced consciousness crafting insight generator
export function generateConsciousnessCraftingInsight(
  currentCard: TarotCard,
  planetaryCard: MajorArcanaCard
): ConsciousnessCraftingInsight {
  const synergy = calculateCardSynergy(currentCard, planetaryCard)
  const alchemicalBalance = calculateAlchemicalBalance(currentCard, planetaryCard)
  const chakraActivation = calculateChakraActivation(currentCard, planetaryCard)
  const developmentPath = generateDevelopmentPath(currentCard, planetaryCard, synergy)
  const timeRecommendations = generateTimeRecommendations(currentCard, planetaryCard)

  let guidance = ''
  let practicalApplication = ''
  let consciousnessLevel = ''

  if (synergy > 0.7) {
    guidance = `The ${currentCard.name} and ${planetaryCard.name} create powerful ${alchemicalBalance.dominantElement} harmony, activating your ${chakraActivation.primaryChakra} chakra for advanced consciousness expansion.`
    practicalApplication = `Focus on ${currentCard.keywords[0]} while channeling ${planetaryCard.keywords[0]} energy during ${timeRecommendations.bestTimeForPractice}.`
    consciousnessLevel = 'High Synergy - Optimal for advanced consciousness work'
  } else if (synergy > 0.4) {
    guidance = `The ${currentCard.name} and ${planetaryCard.name} offer balanced ${alchemicalBalance.dominantElement} learning opportunities, with ${chakraActivation.primaryChakra} chakra activation guiding your development.`
    practicalApplication = `Work with the contrast between ${currentCard.element} and ${planetaryCard.element} elements through ${developmentPath.skillsToFocus[0]} practice.`
    consciousnessLevel = 'Moderate Synergy - Perfect for steady consciousness development'
  } else {
    guidance = `The ${currentCard.name} and ${planetaryCard.name} present dynamic ${alchemicalBalance.dominantElement} challenges that can accelerate breakthrough growth through ${chakraActivation.primaryChakra} chakra activation.`
    practicalApplication = `Use the creative tension between ${currentCard.keywords[0]} and ${planetaryCard.keywords[0]} as a catalyst for ${developmentPath.currentPhase} work.`
    consciousnessLevel = 'Dynamic Tension - Powerful for breakthrough consciousness work'
  }

  return {
    currentMomentCard: currentCard,
    planetaryCard,
    synergy,
    guidance,
    practicalApplication,
    consciousnessLevel,
    alchemicalBalance,
    chakraActivation,
    developmentPath,
    timeRecommendations,
  }
}
