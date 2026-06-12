// Thermodynamics to Tarot mapping system
// Maps thermodynamic consciousness metrics to tarot suit emphases and card recommendations

export interface ThermodynamicMetrics {
  heat: number
  entropy: number
  reactivity: number
  energy: number
}

export interface TarotSuitEmphasis {
  suit: 'wands' | 'cups' | 'swords' | 'pentacles'
  element: 'fire' | 'water' | 'air' | 'earth'
  weight: number // 0-1 probability weight
  reason: string
}

export interface TarotCardRecommendation {
  name: string
  suit: string
  number?: number
  court?: 'page' | 'knight' | 'queen' | 'king'
  majorArcana?: boolean
  reason: string
  relevance: number // 0-1 relevance score
}

export interface TarotRecommendationResult {
  suitEmphases: TarotSuitEmphasis[]
  cardRecommendations: TarotCardRecommendation[]
  dominantElement: string
  secondaryElement: string
  modalityEmphasis: 'cardinal' | 'fixed' | 'mutable'
}

// Base card data for recommendations
const TAROT_CARDS = {
  wands: [
    { name: 'Ace of Wands', number: 1, meaning: 'New creative energy, inspiration, potential' },
    { name: 'Two of Wands', number: 2, meaning: 'Planning, making decisions, personal power' },
    { name: 'Three of Wands', number: 3, meaning: 'Expansion, foresight, overseas opportunities' },
    { name: 'Four of Wands', number: 4, meaning: 'Celebration, harmony, home, community' },
    { name: 'Five of Wands', number: 5, meaning: 'Conflict, competition, disagreement' },
    { name: 'Six of Wands', number: 6, meaning: 'Victory, success, public recognition' },
    { name: 'Seven of Wands', number: 7, meaning: 'Challenge, competition, perseverance' },
    { name: 'Eight of Wands', number: 8, meaning: 'Speed, action, air travel, movement' },
    {
      name: 'Nine of Wands',
      number: 9,
      meaning: 'Resilience, courage, persistence, test of faith',
    },
    { name: 'Ten of Wands', number: 10, meaning: 'Burden, extra responsibility, hard work' },
    { name: 'Page of Wands', court: 'page', meaning: 'Exploration, excitement, freedom' },
    {
      name: 'Knight of Wands',
      court: 'knight',
      meaning: 'Energy, passion, adventure, impulsiveness',
    },
    { name: 'Queen of Wands', court: 'queen', meaning: 'Courage, confidence, independence' },
    { name: 'King of Wands', court: 'king', meaning: 'Leadership, vision, honor, determination' },
  ],
  cups: [
    { name: 'Ace of Cups', number: 1, meaning: 'New love, emotional awakening, intuition' },
    { name: 'Two of Cups', number: 2, meaning: 'Partnership, unity, mutual attraction' },
    { name: 'Three of Cups', number: 3, meaning: 'Friendship, community, celebration' },
    { name: 'Four of Cups', number: 4, meaning: 'Meditation, contemplation, apathy' },
    { name: 'Five of Cups', number: 5, meaning: 'Loss, grief, disappointment' },
    { name: 'Six of Cups', number: 6, meaning: 'Nostalgia, childhood memories, innocence' },
    { name: 'Seven of Cups', number: 7, meaning: 'Options, wishful thinking, illusion' },
    { name: 'Eight of Cups', number: 8, meaning: 'Departure, withdrawal, escapism' },
    { name: 'Nine of Cups', number: 9, meaning: 'Contentment, satisfaction, gratitude' },
    { name: 'Ten of Cups', number: 10, meaning: 'Emotional fulfillment, happiness, alignment' },
    { name: 'Page of Cups', court: 'page', meaning: 'Creative opportunities, intuitive messages' },
    { name: 'Knight of Cups', court: 'knight', meaning: 'Romance, charm, imagination' },
    {
      name: 'Queen of Cups',
      court: 'queen',
      meaning: 'Emotional security, intuitive, compassionate',
    },
    { name: 'King of Cups', court: 'king', meaning: 'Emotional balance, generosity, diplomatic' },
  ],
  swords: [
    { name: 'Ace of Swords', number: 1, meaning: 'New ideas, mental clarity, breakthrough' },
    { name: 'Two of Swords', number: 2, meaning: 'Difficult decisions, weighing options' },
    { name: 'Three of Swords', number: 3, meaning: 'Heartbreak, emotional pain, grief' },
    { name: 'Four of Swords', number: 4, meaning: 'Rest, relaxation, meditation' },
    { name: 'Five of Swords', number: 5, meaning: 'Conflict, disagreement, defeat' },
    { name: 'Six of Swords', number: 6, meaning: 'Transition, change, rite of passage' },
    {
      name: 'Seven of Swords',
      number: 7,
      meaning: 'Betrayal, deception, getting away with something',
    },
    {
      name: 'Eight of Swords',
      number: 8,
      meaning: 'Imprisonment, restriction, self-limiting beliefs',
    },
    { name: 'Nine of Swords', number: 9, meaning: 'Anxiety, worry, fear, depression' },
    { name: 'Ten of Swords', number: 10, meaning: 'Painful endings, deep wounds, betrayal' },
    { name: 'Page of Swords', court: 'page', meaning: 'New ideas, curiosity, restlessness' },
    { name: 'Knight of Swords', court: 'knight', meaning: 'Action, impulsiveness, impatience' },
    {
      name: 'Queen of Swords',
      court: 'queen',
      meaning: 'Independence, unbiased judgement, clear boundaries',
    },
    {
      name: 'King of Swords',
      court: 'king',
      meaning: 'Mental clarity, intellectual power, authority',
    },
  ],
  pentacles: [
    { name: 'Ace of Pentacles', number: 1, meaning: 'New financial opportunity, manifestation' },
    { name: 'Two of Pentacles', number: 2, meaning: 'Multiple priorities, time management' },
    { name: 'Three of Pentacles', number: 3, meaning: 'Collaboration, learning, implementation' },
    { name: 'Four of Pentacles', number: 4, meaning: 'Saving money, security, conservatism' },
    { name: 'Five of Pentacles', number: 5, meaning: 'Financial loss, poverty, lack mindset' },
    { name: 'Six of Pentacles', number: 6, meaning: 'Giving, receiving, sharing wealth' },
    { name: 'Seven of Pentacles', number: 7, meaning: 'Assessment, reward, investment' },
    { name: 'Eight of Pentacles', number: 8, meaning: 'Skill development, quality, mastery' },
    { name: 'Nine of Pentacles', number: 9, meaning: 'Abundance, luxury, self-reliance' },
    { name: 'Ten of Pentacles', number: 10, meaning: 'Wealth, financial security, family' },
    { name: 'Page of Pentacles', court: 'page', meaning: 'Manifestation, financial opportunity' },
    { name: 'Knight of Pentacles', court: 'knight', meaning: 'Hard work, productivity, routine' },
    { name: 'Queen of Pentacles', court: 'queen', meaning: 'Nurturing, practical, providing' },
    {
      name: 'King of Pentacles',
      court: 'king',
      meaning: 'Financial success, security, leadership',
    },
  ],
}

// Major Arcana cards for high-energy states
const MAJOR_ARCANA_CARDS = [
  { name: 'The Fool', number: 0, meaning: 'New beginnings, innocence, spontaneity' },
  { name: 'The Magician', number: 1, meaning: 'Manifestation, resourcefulness, power' },
  {
    name: 'The High Priestess',
    number: 2,
    meaning: 'Intuition, sacred knowledge, divine feminine',
  },
  { name: 'The Empress', number: 3, meaning: 'Femininity, beauty, nature, abundance' },
  { name: 'The Emperor', number: 4, meaning: 'Authority, establishment, structure, fatherhood' },
  { name: 'The Hierophant', number: 5, meaning: 'Spiritual wisdom, religious beliefs, conformity' },
  { name: 'The Lovers', number: 6, meaning: 'Love, harmony, relationships, values alignment' },
  { name: 'The Chariot', number: 7, meaning: 'Control, willpower, success, determination' },
  { name: 'Strength', number: 8, meaning: 'Inner strength, bravery, compassion, focus' },
  { name: 'The Hermit', number: 9, meaning: 'Soul searching, introspection, inner guidance' },
  { name: 'Wheel of Fortune', number: 10, meaning: 'Good luck, karma, life cycles, destiny' },
  { name: 'Justice', number: 11, meaning: 'Justice, fairness, truth, cause and effect' },
  { name: 'The Hanged Man', number: 12, meaning: 'Perspective, lethargy, suspension, restriction' },
  { name: 'Death', number: 13, meaning: 'Endings, beginnings, change, transformation' },
  { name: 'Temperance', number: 14, meaning: 'Balance, moderation, patience, purpose' },
  { name: 'The Devil', number: 15, meaning: 'Shadow self, attachment, addiction, restriction' },
  { name: 'The Tower', number: 16, meaning: 'Sudden change, upheaval, chaos, revelation' },
  { name: 'The Star', number: 17, meaning: 'Hope, faith, purpose, renewal, spirituality' },
  { name: 'The Moon', number: 18, meaning: 'Illusion, fear, anxiety, subconscious, intuition' },
  { name: 'The Sun', number: 19, meaning: 'Positivity, fun, warmth, success, vitality' },
  { name: 'Judgement', number: 20, meaning: 'Judgement, rebirth, inner calling, absolution' },
  { name: 'The World', number: 21, meaning: 'Completion, accomplishment, travel, integration' },
]

/**
 * Validate and sanitize thermodynamic input
 */
function validateThermodynamicInput(metrics: ThermodynamicMetrics): ThermodynamicMetrics {
  return {
    heat: Math.max(0, Math.min(100, typeof metrics.heat === 'number' ? metrics.heat : 0)),
    entropy: Math.max(0, Math.min(100, typeof metrics.entropy === 'number' ? metrics.entropy : 0)),
    reactivity: Math.max(
      0,
      Math.min(100, typeof metrics.reactivity === 'number' ? metrics.reactivity : 0)
    ),
    energy: Math.max(0, Math.min(100, typeof metrics.energy === 'number' ? metrics.energy : 0)),
  }
}

/**
 * Calculate suit emphases based on thermodynamic metrics
 */
function calculateSuitEmphases(metrics: ThermodynamicMetrics): TarotSuitEmphasis[] {
  const { heat, entropy, reactivity, energy } = metrics

  // Base weights for each suit (all positive, no opposition)
  const baseWeight = 0.25 // Equal baseline

  const emphases: TarotSuitEmphasis[] = [
    {
      suit: 'wands',
      element: 'fire',
      weight: baseWeight + (heat / 100) * 0.4 + (energy / 100) * 0.2,
      reason: `Fire element amplified by heat (${heat}%) and energy (${energy}%)`,
    },
    {
      suit: 'cups',
      element: 'water',
      weight: baseWeight + ((100 - entropy) / 100) * 0.3 + (energy / 100) * 0.2,
      reason: `Water element enhanced by stability (${100 - entropy}% order) and flowing energy`,
    },
    {
      suit: 'swords',
      element: 'air',
      weight: baseWeight + (entropy / 100) * 0.4 + (reactivity / 100) * 0.2,
      reason: `Air element strengthened by entropy (${entropy}%) and mental reactivity (${reactivity}%)`,
    },
    {
      suit: 'pentacles',
      element: 'earth',
      weight: baseWeight + ((100 - reactivity) / 100) * 0.3 + (heat / 100) * 0.1,
      reason: `Earth element supported by stability (${100 - reactivity}% groundedness) and warmth`,
    },
  ]

  // Normalize weights to ensure they sum to reasonable values
  const totalWeight = emphases.reduce((sum, emp) => sum + emp.weight, 0)
  const normalized = emphases.map(emp => ({
    ...emp,
    weight: Math.min(1, (emp.weight / totalWeight) * emphases.length * 0.7), // Scale to max 0.7 per suit
  }))

  return normalized.sort((a, b) => b.weight - a.weight)
}

/**
 * Determine modality emphasis based on reactivity
 */
function getModalityEmphasis(reactivity: number): 'cardinal' | 'fixed' | 'mutable' {
  if (reactivity >= 70) return 'cardinal' // High reactivity = initiation
  if (reactivity <= 30) return 'fixed' // Low reactivity = stability
  return 'mutable' // Medium reactivity = adaptability
}

/**
 * Select card recommendations based on suit emphases and metrics
 */
function selectCardRecommendations(
  emphases: TarotSuitEmphasis[],
  metrics: ThermodynamicMetrics,
  modalityEmphasis: 'cardinal' | 'fixed' | 'mutable'
): TarotCardRecommendation[] {
  const recommendations: TarotCardRecommendation[] = []
  const { heat, entropy, reactivity, energy } = metrics

  // Get top 2 emphasized suits
  const topSuits = emphases.slice(0, 2)

  // For each top suit, select most relevant card
  topSuits.forEach((suitEmphasis, index) => {
    const suitCards = TAROT_CARDS[suitEmphasis.suit]
    let selectedCard
    let relevance = 0.7 + suitEmphasis.weight * 0.3 // Base relevance from suit weight

    // Selection logic based on metrics and modality
    if (modalityEmphasis === 'cardinal' && (reactivity > 60 || energy > 60)) {
      // High action energy - prefer Aces, Pages, or action cards
      const actionCards = suitCards.filter(
        card =>
          card.number === 1 ||
          card.court === 'page' ||
          card.court === 'knight' ||
          [2, 3, 8].includes(card.number || 0)
      )
      selectedCard = actionCards[Math.floor(actionCards.length * (energy / 100))] || actionCards[0]
      relevance += 0.1
    } else if (modalityEmphasis === 'fixed' && entropy < 40) {
      // Stable energy - prefer middle numbers and court cards
      const stableCards = suitCards.filter(
        card =>
          [4, 6, 7, 9, 10].includes(card.number || 0) ||
          card.court === 'queen' ||
          card.court === 'king'
      )
      selectedCard =
        stableCards[Math.floor(stableCards.length * ((100 - entropy) / 100))] || stableCards[0]
      relevance += 0.1
    } else {
      // Mutable or mixed - prefer adaptable cards
      const adaptableCards = suitCards.filter(
        card =>
          [2, 3, 5, 6, 7].includes(card.number || 0) ||
          card.court === 'page' ||
          card.court === 'knight'
      )
      selectedCard =
        adaptableCards[Math.floor(adaptableCards.length * (entropy / 100))] || adaptableCards[0]
    }

    if (selectedCard) {
      recommendations.push({
        name: selectedCard.name,
        suit: suitEmphasis.suit,
        number: selectedCard.number,
        court: selectedCard.court as 'page' | 'knight' | 'queen' | 'king' | undefined,
        majorArcana: false,
        reason: `${suitEmphasis.reason} - Selected for ${modalityEmphasis} emphasis`,
        relevance: Math.min(1, relevance),
      })
    }
  })

  // Add one Major Arcana card for high-energy states
  const totalEnergy = heat + energy + reactivity
  if (totalEnergy > 150) {
    const highEnergyCards = MAJOR_ARCANA_CARDS.filter(
      card => [1, 7, 8, 10, 13, 16, 19, 20].includes(card.number || 0) // High-action major arcana
    )
    const selectedMajor = highEnergyCards[Math.floor(highEnergyCards.length * (totalEnergy / 300))]

    if (selectedMajor) {
      recommendations.push({
        name: selectedMajor.name,
        suit: 'major_arcana',
        majorArcana: true,
        reason: `High thermodynamic energy (${totalEnergy.toFixed(0)}) calls for major transformation`,
        relevance: Math.min(1, 0.6 + (totalEnergy / 300) * 0.4),
      })
    }
  }

  return recommendations.sort((a, b) => b.relevance - a.relevance).slice(0, 3)
}

/**
 * Main function to get tarot recommendations from thermodynamic metrics
 */
export function getTarotRecommendations(metrics: ThermodynamicMetrics): TarotRecommendationResult {
  // Validate input
  const validMetrics = validateThermodynamicInput(metrics)

  // Calculate suit emphases
  const suitEmphases = calculateSuitEmphases(validMetrics)

  // Determine modality emphasis
  const modalityEmphasis = getModalityEmphasis(validMetrics.reactivity)

  // Select card recommendations
  const cardRecommendations = selectCardRecommendations(
    suitEmphases,
    validMetrics,
    modalityEmphasis
  )

  // Determine dominant and secondary elements
  const dominantElement = suitEmphases[0]?.element || 'fire'
  const secondaryElement = suitEmphases[1]?.element || 'water'

  return {
    suitEmphases,
    cardRecommendations,
    dominantElement,
    secondaryElement,
    modalityEmphasis,
  }
}

/**
 * Get deterministic tarot recommendation for testing
 */
export function getDeterministicTarotRecommendation(
  heat: number,
  entropy: number,
  reactivity: number,
  energy: number
): TarotRecommendationResult {
  return getTarotRecommendations({ heat, entropy, reactivity, energy })
}
