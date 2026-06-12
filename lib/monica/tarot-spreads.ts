import {
  TarotCard,
  MajorArcanaCard,
  DECAN_TAROT_MAPPINGS,
  MAJOR_ARCANA_PLANETARY,
  ZODIAC_MAJOR_ARCANA,
} from './tarot-oracle'

export interface SpreadPosition {
  position: number
  name: string
  meaning: string
  card?: TarotCard | MajorArcanaCard
  interpretation?: string
}

export interface TarotSpread {
  id: string
  name: string
  description: string
  positions: SpreadPosition[]
  overallInterpretation?: string
  guidance?: string
  timing?: string
  outcome?: string
}

export interface SpreadReading {
  spread: TarotSpread
  timestamp: Date
  questioner?: string
  question?: string
  consciousnessLevel: string
  astrologicalContext: {
    currentDecan: string
    dominantPlanet: string
    moonPhase: string
  }
}

// Celtic Cross Spread (10 cards)
export const CELTIC_CROSS_POSITIONS: SpreadPosition[] = [
  {
    position: 1,
    name: 'Present Situation',
    meaning: 'The heart of the matter, your current circumstances',
  },
  {
    position: 2,
    name: 'Challenge/Cross',
    meaning: 'What challenges or supports your current situation',
  },
  {
    position: 3,
    name: 'Distant Past/Foundation',
    meaning: 'Root causes, distant past influences',
  },
  {
    position: 4,
    name: 'Recent Past',
    meaning: 'Recent events that led to the current situation',
  },
  {
    position: 5,
    name: 'Possible Outcome',
    meaning: 'Potential future if current path continues',
  },
  {
    position: 6,
    name: 'Immediate Future',
    meaning: "What's coming in the near future",
  },
  {
    position: 7,
    name: 'Your Approach',
    meaning: 'Your approach to the situation, internal influences',
  },
  {
    position: 8,
    name: 'External Influences',
    meaning: "Environmental factors, other people's influence",
  },
  {
    position: 9,
    name: 'Hopes and Fears',
    meaning: 'Your inner hopes and fears about the situation',
  },
  {
    position: 10,
    name: 'Final Outcome',
    meaning: 'Ultimate outcome, synthesis of all influences',
  },
]

// Three-Card Spreads
export const THREE_CARD_SPREADS = {
  pastPresentFuture: [
    { position: 1, name: 'Past', meaning: 'Past influences and foundations' },
    { position: 2, name: 'Present', meaning: 'Current situation and energies' },
    { position: 3, name: 'Future', meaning: 'Potential outcomes and directions' },
  ],
  mindBodySpirit: [
    { position: 1, name: 'Mind', meaning: 'Mental state, thoughts, beliefs' },
    { position: 2, name: 'Body', meaning: 'Physical manifestation, material world' },
    { position: 3, name: 'Spirit', meaning: 'Spiritual guidance, higher purpose' },
  ],
  situationActionOutcome: [
    { position: 1, name: 'Situation', meaning: 'Current circumstances' },
    { position: 2, name: 'Action', meaning: 'What action to take' },
    { position: 3, name: 'Outcome', meaning: 'Result of taking that action' },
  ],
}

// Astrological Tarot Spread (12 cards - Houses)
export const ASTROLOGICAL_SPREAD_POSITIONS: SpreadPosition[] = [
  { position: 1, name: '1st House - Self', meaning: 'Identity, appearance, first impressions' },
  { position: 2, name: '2nd House - Resources', meaning: 'Money, possessions, self-worth' },
  {
    position: 3,
    name: '3rd House - Communication',
    meaning: 'Communication, siblings, short trips',
  },
  { position: 4, name: '4th House - Home', meaning: 'Home, family, emotional foundation' },
  { position: 5, name: '5th House - Creativity', meaning: 'Romance, creativity, children, fun' },
  { position: 6, name: '6th House - Service', meaning: 'Work, health, daily routines' },
  {
    position: 7,
    name: '7th House - Partnerships',
    meaning: 'Marriage, partnerships, open enemies',
  },
  {
    position: 8,
    name: '8th House - Transformation',
    meaning: 'Death/rebirth, shared resources, mysteries',
  },
  { position: 9, name: '9th House - Philosophy', meaning: 'Higher learning, travel, philosophy' },
  { position: 10, name: '10th House - Career', meaning: 'Career, reputation, public image' },
  { position: 11, name: '11th House - Community', meaning: 'Friends, groups, hopes and dreams' },
  {
    position: 12,
    name: '12th House - Subconscious',
    meaning: 'Hidden things, spirituality, self-undoing',
  },
]

// Consciousness Evolution Spread (7 cards - Chakras)
export const CONSCIOUSNESS_SPREAD_POSITIONS: SpreadPosition[] = [
  { position: 1, name: 'Root Chakra', meaning: 'Grounding, survival, foundation' },
  { position: 2, name: 'Sacral Chakra', meaning: 'Creativity, sexuality, emotions' },
  { position: 3, name: 'Solar Plexus', meaning: 'Personal power, confidence, will' },
  { position: 4, name: 'Heart Chakra', meaning: 'Love, compassion, connection' },
  { position: 5, name: 'Throat Chakra', meaning: 'Communication, truth, expression' },
  { position: 6, name: 'Third Eye', meaning: 'Intuition, vision, psychic abilities' },
  { position: 7, name: 'Crown Chakra', meaning: 'Spiritual connection, enlightenment' },
]

/**
 * Get a random card from the full tarot deck
 */
export function getRandomTarotCard(): TarotCard | MajorArcanaCard {
  const allMinorCards = Object.values(DECAN_TAROT_MAPPINGS)
  const allMajorCards = Object.values(MAJOR_ARCANA_PLANETARY)

  const allCards = [...allMinorCards, ...allMajorCards]
  const randomIndex = Math.floor(Math.random() * allCards.length)

  return allCards[randomIndex]
}

/**
 * Generate a Celtic Cross reading
 */
export function generateCelticCrossReading(question?: string): TarotSpread {
  const positions = CELTIC_CROSS_POSITIONS.map(pos => ({
    ...pos,
    card: getRandomTarotCard(),
  }))

  // Add interpretations for each position
  positions.forEach(pos => {
    if (pos.card) {
      pos.interpretation = generatePositionInterpretation(pos.card, pos.name, pos.meaning)
    }
  })

  const spread: TarotSpread = {
    id: `celtic-cross-${Date.now()}`,
    name: 'Celtic Cross',
    description: 'The most comprehensive tarot spread for deep insight into any situation',
    positions,
    overallInterpretation: generateCelticCrossInterpretation(positions),
    guidance: generateCelticCrossGuidance(positions),
    timing: generateTimingGuidance(positions),
    outcome: generateOutcomeGuidance(positions),
  }

  return spread
}

/**
 * Generate a Three-Card reading
 */
export function generateThreeCardReading(
  spreadType: keyof typeof THREE_CARD_SPREADS = 'pastPresentFuture',
  question?: string
): TarotSpread {
  const spreadTemplate = THREE_CARD_SPREADS[spreadType]

  const positions: SpreadPosition[] = spreadTemplate.map(pos => ({
    ...pos,
    card: getRandomTarotCard(),
  }))

  positions.forEach(pos => {
    if (pos.card) {
      pos.interpretation = generatePositionInterpretation(pos.card, pos.name, pos.meaning)
    }
  })

  const spread: TarotSpread = {
    id: `three-card-${spreadType}-${Date.now()}`,
    name: `Three-Card: ${spreadType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`,
    description: `Simple yet powerful three-card reading focusing on ${spreadType}`,
    positions,
    overallInterpretation: generateThreeCardInterpretation(positions, spreadType),
    guidance: generateThreeCardGuidance(positions, spreadType),
  }

  return spread
}

/**
 * Generate an Astrological Houses reading
 */
export function generateAstrologicalReading(question?: string): TarotSpread {
  const positions = ASTROLOGICAL_SPREAD_POSITIONS.map(pos => ({
    ...pos,
    card: getRandomTarotCard(),
  }))

  positions.forEach(pos => {
    if (pos.card) {
      pos.interpretation = generatePositionInterpretation(pos.card, pos.name, pos.meaning)
    }
  })

  const spread: TarotSpread = {
    id: `astrological-${Date.now()}`,
    name: 'Astrological Houses',
    description: '12-card spread exploring all areas of life through astrological houses',
    positions,
    overallInterpretation: generateAstrologicalInterpretation(positions),
    guidance: generateAstrologicalGuidance(positions),
  }

  return spread
}

/**
 * Generate a Consciousness Evolution reading
 */
export function generateConsciousnessReading(question?: string): TarotSpread {
  const positions = CONSCIOUSNESS_SPREAD_POSITIONS.map(pos => ({
    ...pos,
    card: getRandomTarotCard(),
  }))

  positions.forEach(pos => {
    if (pos.card) {
      pos.interpretation = generatePositionInterpretation(pos.card, pos.name, pos.meaning)
    }
  })

  const spread: TarotSpread = {
    id: `consciousness-${Date.now()}`,
    name: 'Consciousness Evolution',
    description: '7-card chakra spread for spiritual development and consciousness expansion',
    positions,
    overallInterpretation: generateConsciousnessInterpretation(positions),
    guidance: generateConsciousnessGuidance(positions),
  }

  return spread
}

/**
 * Generate interpretation for a specific position
 */
function generatePositionInterpretation(
  card: TarotCard | MajorArcanaCard,
  positionName: string,
  positionMeaning: string
): string {
  const cardType = 'suit' in card ? 'minor' : 'major'
  const cardContext =
    cardType === 'minor'
      ? `This ${(card as TarotCard).suit} card of ${card.element} energy`
      : `This Major Arcana card of ${card.element} energy`

  return `${cardContext} in the ${positionName} position suggests ${card.meaning.toLowerCase()}. ${positionMeaning} is influenced by ${card.keywords.slice(0, 2).join(' and ')} energies. Focus on: ${card.consciousness.toLowerCase()}.`
}

/**
 * Generate Celtic Cross overall interpretation
 */
function generateCelticCrossInterpretation(positions: SpreadPosition[]): string {
  const presentCard = positions[0].card
  const outcomeCard = positions[9].card

  if (!presentCard || !outcomeCard)
    return 'The cards reveal a complex situation requiring careful consideration.'

  const presentElement = presentCard.element
  const outcomeElement = outcomeCard.element

  let interpretation = `Your current situation is strongly influenced by ${presentElement} energy, manifesting as ${presentCard.meaning.toLowerCase()}. `

  if (presentElement === outcomeElement) {
    interpretation += `The ultimate outcome resonates with the same ${outcomeElement} energy, suggesting a natural progression and alignment with your current path.`
  } else {
    interpretation += `However, your final outcome moves into ${outcomeElement} energy with ${outcomeCard.meaning.toLowerCase()}, indicating significant transformation ahead.`
  }

  return interpretation
}

/**
 * Generate Celtic Cross guidance
 */
function generateCelticCrossGuidance(positions: SpreadPosition[]): string {
  const approachCard = positions[6].card
  const externalCard = positions[7].card

  if (!approachCard || !externalCard) return 'Trust your intuition and remain open to guidance.'

  return `Your best approach involves embodying ${approachCard.keywords[0].toLowerCase()} while being aware that external influences bring ${externalCard.keywords[0].toLowerCase()} energy. Focus on ${approachCard.consciousness.toLowerCase()} to navigate challenges effectively.`
}

/**
 * Generate timing guidance from Celtic Cross
 */
function generateTimingGuidance(positions: SpreadPosition[]): string {
  const immediateCard = positions[5].card

  if (!immediateCard) return 'Trust divine timing.'

  const element = immediateCard.element
  const timingMap = {
    Fire: 'Days to weeks - act quickly with passion',
    Water: 'Weeks to months - allow emotions to flow naturally',
    Air: 'Days to weeks - communicate and gather information',
    Earth: 'Months to seasons - patient, steady progress',
  }

  return timingMap[element as keyof typeof timingMap] || 'Trust divine timing.'
}

/**
 * Generate outcome guidance
 */
function generateOutcomeGuidance(positions: SpreadPosition[]): string {
  const outcomeCard = positions[9].card
  const hopesFearCard = positions[8].card

  if (!outcomeCard) return 'The outcome remains fluid - your choices shape the future.'

  let guidance = `The final outcome suggests ${outcomeCard.meaning.toLowerCase()}, achieved through ${outcomeCard.consciousness.toLowerCase()}. `

  if (hopesFearCard) {
    guidance += `Your hopes and fears center around ${hopesFearCard.keywords[0].toLowerCase()}, which will play a significant role in manifestation.`
  }

  return guidance
}

/**
 * Generate Three-Card interpretation
 */
function generateThreeCardInterpretation(positions: SpreadPosition[], spreadType: string): string {
  if (positions.length !== 3) return 'The cards reveal a simple yet profound message.'

  const [first, second, third] = positions

  if (!first.card || !second.card || !third.card)
    return 'The message requires deeper contemplation.'

  if (spreadType === 'pastPresentFuture') {
    return `Your journey moves from ${first.card.element} energy of the past (${first.card.meaning.toLowerCase()}) through current ${second.card.element} experiences (${second.card.meaning.toLowerCase()}) toward a future of ${third.card.element} manifestation (${third.card.meaning.toLowerCase()}).`
  } else if (spreadType === 'mindBodySpirit') {
    return `Your mind resonates with ${first.card.element} energy (${first.card.consciousness.toLowerCase()}), your body manifests ${second.card.element} reality (${second.card.meaning.toLowerCase()}), while your spirit seeks ${third.card.element} expression (${third.card.consciousness.toLowerCase()}).`
  } else {
    return `The situation calls for understanding ${first.card.element} influences, taking ${second.card.element}-based action, leading to ${third.card.element} outcomes.`
  }
}

/**
 * Generate Three-Card guidance
 */
function generateThreeCardGuidance(positions: SpreadPosition[], spreadType: string): string {
  const middleCard = positions[1].card

  if (!middleCard) return 'Focus on balance and integration.'

  return `Focus primarily on ${middleCard.consciousness.toLowerCase()} while integrating the lessons of all three cards. The key is balancing ${middleCard.element} energy with practical action.`
}

/**
 * Generate Astrological interpretation
 */
function generateAstrologicalInterpretation(positions: SpreadPosition[]): string {
  const selfCard = positions[0].card // 1st House
  const partnerCard = positions[6].card // 7th House
  const careerCard = positions[9].card // 10th House

  let interpretation = 'Your astrological profile reveals: '

  if (selfCard) {
    interpretation += `Your identity is shaped by ${selfCard.element} energy, manifesting as ${selfCard.meaning.toLowerCase()}. `
  }

  if (partnerCard) {
    interpretation += `Relationships bring ${partnerCard.element} influences with themes of ${partnerCard.keywords[0].toLowerCase()}. `
  }

  if (careerCard) {
    interpretation += `Your career path aligns with ${careerCard.element} expression through ${careerCard.consciousness.toLowerCase()}.`
  }

  return interpretation
}

/**
 * Generate Astrological guidance
 */
function generateAstrologicalGuidance(positions: SpreadPosition[]): string {
  const careerCard = positions[9].card // 10th House
  const spiritualCard = positions[11].card // 12th House

  if (!careerCard || !spiritualCard) return 'Integrate all life areas for holistic growth.'

  return `Balance your public expression (${careerCard.keywords[0].toLowerCase()}) with inner spiritual work (${spiritualCard.consciousness.toLowerCase()}). This integration creates authentic success.`
}

/**
 * Generate Consciousness interpretation
 */
function generateConsciousnessInterpretation(positions: SpreadPosition[]): string {
  const heartCard = positions[3].card // Heart Chakra
  const crownCard = positions[6].card // Crown Chakra

  let interpretation = 'Your consciousness evolution reveals: '

  if (heartCard) {
    interpretation += `Your heart center resonates with ${heartCard.element} energy, expressing through ${heartCard.consciousness.toLowerCase()}. `
  }

  if (crownCard) {
    interpretation += `Your spiritual connection manifests ${crownCard.element} wisdom through ${crownCard.meaning.toLowerCase()}.`
  }

  return interpretation
}

/**
 * Generate Consciousness guidance
 */
function generateConsciousnessGuidance(positions: SpreadPosition[]): string {
  const thirdEyeCard = positions[5].card // Third Eye

  if (!thirdEyeCard) return 'Trust your inner wisdom and spiritual guidance.'

  return `Develop your intuitive abilities through ${thirdEyeCard.consciousness.toLowerCase()}. Your third eye reveals truth through ${thirdEyeCard.element} perception - trust these insights.`
}

/**
 * Create a complete spread reading with astrological context
 */
export function createSpreadReading(
  spread: TarotSpread,
  questioner?: string,
  question?: string
): SpreadReading {
  return {
    spread,
    timestamp: new Date(),
    questioner,
    question,
    consciousnessLevel: determineDominantConsciousnessLevel(spread.positions),
    astrologicalContext: {
      currentDecan: getCurrentDecanName(),
      dominantPlanet: getDominantPlanet(spread.positions),
      moonPhase: getCurrentMoonPhase(),
    },
  }
}

function determineDominantConsciousnessLevel(positions: SpreadPosition[]): string {
  const consciousnessLevels = positions
    .map(pos => pos.card?.consciousness)
    .filter(Boolean) as string[]

  // Find most common consciousness level
  const levelCounts = consciousnessLevels.reduce(
    (acc, level) => {
      acc[level] = (acc[level] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const dominantLevel = Object.entries(levelCounts).sort(([, a], [, b]) => b - a)[0]?.[0]

  return dominantLevel || 'Balanced consciousness exploration'
}

function getCurrentDecanName(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  // Simplified decan calculation (each sign has 3 decans of ~10 days)
  const zodiacSigns = [
    'Capricorn',
    'Aquarius',
    'Pisces',
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
  ]

  // Approximate calculation
  const dayOfYear = Math.floor((month - 1) * 30.4 + day)
  const decanIndex = Math.floor(dayOfYear / 10) % 36
  const signIndex = Math.floor(decanIndex / 3) % 12
  const decanNum = (decanIndex % 3) + 1

  return `${zodiacSigns[signIndex]} ${decanNum}`
}

function getDominantPlanet(positions: SpreadPosition[]): string {
  const planets = positions.map(pos => pos.card?.planetaryRuler).filter(Boolean) as string[]

  const planetCounts = planets.reduce(
    (acc, planet) => {
      acc[planet] = (acc[planet] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const dominantPlanet = Object.entries(planetCounts).sort(([, a], [, b]) => b - a)[0]?.[0]

  return dominantPlanet || 'Sun'
}

function getCurrentMoonPhase(): string {
  // Simplified moon phase calculation
  const now = new Date()
  const dayOfMonth = now.getDate()

  if (dayOfMonth <= 7) return 'New Moon - New Beginnings'
  if (dayOfMonth <= 14) return 'Waxing Moon - Building Energy'
  if (dayOfMonth <= 21) return 'Full Moon - Peak Manifestation'
  return 'Waning Moon - Release and Reflection'
}
