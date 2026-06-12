// Council Presets System for Specialized Chat Experiences
// Curated agent groups optimized for different consultation types

import type { CouncilPreset } from './unified-agent-types'

export interface HistoricalCouncilPreset extends Omit<CouncilPreset, 'agentIds'> {
  historicalAgentIds: string[]
  era?: string
  theme: string
  specialization: string
  recommendedFor: string[]
}

export interface PlanetaryCouncilPreset extends Omit<CouncilPreset, 'agentIds'> {
  planetaryAgentIds: string[]
  planetCombination: string[]
  astrological_focus: string
  timing_optimization: string
}

export interface MixedCouncilPreset extends CouncilPreset {
  historicalAgentIds: string[]
  planetaryAgentIds: string[]
  synthesis_type: 'temporal_bridge' | 'elemental_balance' | 'consciousness_acceleration'
}

// Historical Council Presets
export const HISTORICAL_COUNCIL_PRESETS: HistoricalCouncilPreset[] = [
  {
    id: 'ancient-philosophers',
    name: 'Ancient Philosophers Circle',
    description: 'Timeless wisdom from the foundational thinkers of human consciousness',
    historicalAgentIds: ['socrates', 'aristotle', 'plato', 'marcus-aurelius', 'lao-tzu'],
    era: 'Ancient',
    theme: 'Philosophical inquiry and foundational wisdom',
    specialization: 'Existential questions, ethics, logic, and the nature of reality',
    recommendedFor: ['Life direction', 'Ethical dilemmas', 'Philosophical exploration'],
    includeMonica: true,
    monicaRole: 'guide',
    tags: ['wisdom', 'philosophy', 'ancient', 'ethics'],
    difficulty: 'intermediate',
  },
  {
    id: 'renaissance-masters',
    name: 'Renaissance Masters Council',
    description: 'Innovation and artistry from the golden age of human creativity',
    historicalAgentIds: [
      'leonardo-da-vinci',
      'michelangelo',
      'galileo-galilei',
      'shakespeare',
      'dante-alighieri',
    ],
    era: 'Renaissance',
    theme: 'Innovation, artistic vision, and scientific breakthrough',
    specialization: 'Creative projects, innovative thinking, artistic expression',
    recommendedFor: ['Creative projects', 'Innovation challenges', 'Artistic inspiration'],
    includeMonica: true,
    monicaRole: 'synthesizer',
    tags: ['creativity', 'innovation', 'art', 'science'],
    difficulty: 'advanced',
  },
  {
    id: 'modern-visionaries',
    name: 'Modern Visionaries Assembly',
    description: 'Revolutionary thinkers who shaped our contemporary understanding',
    historicalAgentIds: [
      'albert-einstein',
      'nikola-tesla',
      'marie-curie',
      'carl-jung',
      'steve-jobs',
    ],
    era: 'Modern',
    theme: 'Scientific revolution and psychological insight',
    specialization: 'Innovation, technology, consciousness exploration',
    recommendedFor: ['Technology projects', 'Scientific inquiry', 'Personal transformation'],
    includeMonica: true,
    monicaRole: 'coordinator',
    tags: ['science', 'technology', 'psychology', 'innovation'],
    difficulty: 'expert',
  },
  {
    id: 'warrior-leaders',
    name: 'Strategic Leaders Council',
    description: "Command wisdom from history's greatest leaders and strategists",
    historicalAgentIds: ['napoleon-bonaparte', 'cleopatra', 'sun-tzu', 'joan-of-arc', 'hannibal'],
    era: 'Mixed',
    theme: 'Leadership, strategy, and decisive action',
    specialization: 'Leadership challenges, strategic planning, conflict resolution',
    recommendedFor: ['Leadership development', 'Strategic planning', 'Crisis management'],
    includeMonica: true,
    monicaRole: 'moderator',
    tags: ['leadership', 'strategy', 'warfare', 'politics'],
    difficulty: 'advanced',
  },
  {
    id: 'spiritual-mystics',
    name: 'Mystics & Spiritual Guides',
    description: 'Divine wisdom from enlightened souls across traditions',
    historicalAgentIds: [
      'rumi',
      'buddha',
      'jesus-christ',
      'hildegard-of-bingen',
      'ramana-maharshi',
    ],
    era: 'Timeless',
    theme: 'Spiritual awakening and divine connection',
    specialization: 'Spiritual guidance, mystical insight, transcendent wisdom',
    recommendedFor: ['Spiritual growth', 'Meditation guidance', 'Life purpose'],
    includeMonica: true,
    monicaRole: 'guide',
    tags: ['spirituality', 'mysticism', 'enlightenment', 'divine'],
    difficulty: 'expert',
  },
  {
    id: 'rapid-consultation',
    name: 'Quick Wisdom Council',
    description: 'Fast insights from three complementary perspectives',
    historicalAgentIds: ['confucius', 'ben-franklin', 'marie-curie'],
    era: 'Mixed',
    theme: 'Practical wisdom for everyday decisions',
    specialization: 'Quick guidance, practical advice, balanced perspectives',
    recommendedFor: ['Quick decisions', 'Practical advice', 'Daily guidance'],
    includeMonica: false,
    tags: ['practical', 'quick', 'wisdom', 'daily'],
    difficulty: 'beginner',
  },
]

// Planetary Council Presets
export const PLANETARY_COUNCIL_PRESETS: PlanetaryCouncilPreset[] = [
  {
    id: 'inner-planets-council',
    name: 'Inner Planets Council',
    description: 'Personal guidance from the planets of individual expression',
    planetaryAgentIds: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'],
    planetCombination: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'],
    astrological_focus: 'Personal development and individual expression',
    timing_optimization: 'Fast response for personal matters',
    includeMonica: false,
    monicaRole: 'guide',
    recommendedFor: ['Personal development', 'Self-expression', 'Daily guidance'],
    tags: ['personal', 'fast', 'individual', 'expression'],
    difficulty: 'beginner',
  },
  {
    id: 'classical-seven',
    name: 'Classical Seven Planets',
    description: 'Traditional planetary wisdom with Monica as celestial guide',
    planetaryAgentIds: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    planetCombination: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'],
    astrological_focus: 'Complete traditional astrological perspective',
    timing_optimization: 'Balanced depth and accessibility',
    includeMonica: true,
    monicaRole: 'guide',
    recommendedFor: ['Astrological consultation', 'Balanced guidance', 'Traditional astrology'],
    tags: ['traditional', 'complete', 'classical', 'balanced'],
    difficulty: 'intermediate',
  },
  {
    id: 'outer-mysteries',
    name: 'Outer Planet Mysteries',
    description: 'Generational and transcendent wisdom from the outer planets',
    planetaryAgentIds: ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
    planetCombination: ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
    astrological_focus: 'Transformation, transcendence, and generational change',
    timing_optimization: 'Deep, contemplative responses',
    includeMonica: true,
    monicaRole: 'synthesizer',
    recommendedFor: ['Transformation work', 'Life transitions', 'Generational patterns'],
    tags: ['transformation', 'transcendent', 'generational', 'deep'],
    difficulty: 'expert',
  },
  {
    id: 'elemental-balance',
    name: 'Elemental Balance Council',
    description: 'Four planetary energies representing the classical elements',
    planetaryAgentIds: ['Mars', 'Saturn', 'Mercury', 'Moon'],
    planetCombination: ['Mars', 'Saturn', 'Mercury', 'Moon'], // Fire, Earth, Air, Water
    astrological_focus: 'Elemental balance and holistic perspective',
    timing_optimization: 'Balanced energetic response',
    includeMonica: false,
    monicaRole: 'moderator',
    recommendedFor: ['Elemental balance', 'Holistic perspective', 'Energy work'],
    tags: ['elements', 'balance', 'holistic', 'energy'],
    difficulty: 'intermediate',
  },
  {
    id: 'love-and-war',
    name: 'Venus & Mars Council',
    description: 'The eternal dance of love, passion, and creative tension',
    planetaryAgentIds: ['Venus', 'Mars'],
    planetCombination: ['Venus', 'Mars'],
    astrological_focus: 'Relationships, passion, creative energy, and harmony',
    timing_optimization: 'Dynamic, passionate responses',
    includeMonica: true,
    monicaRole: 'moderator',
    recommendedFor: ['Relationship guidance', 'Creative tension', 'Passion and harmony'],
    tags: ['relationships', 'passion', 'harmony', 'creative'],
    difficulty: 'beginner',
  },
  {
    id: 'solar-lunar',
    name: 'Solar-Lunar Wisdom',
    description: 'The fundamental polarity of conscious will and unconscious flow',
    planetaryAgentIds: ['Sun', 'Moon'],
    planetCombination: ['Sun', 'Moon'],
    astrological_focus: 'Conscious/unconscious balance, will and intuition',
    timing_optimization: 'Clear, fundamental guidance',
    includeMonica: false,
    monicaRole: 'guide',
    recommendedFor: ['Core polarity work', 'Will vs intuition', 'Inner balance'],
    tags: ['fundamental', 'polarity', 'intuition', 'will'],
    difficulty: 'beginner',
  },
]

// Mixed Council Presets (Historical + Planetary + Monica)
export const MIXED_COUNCIL_PRESETS: MixedCouncilPreset[] = [
  {
    id: 'consciousness-accelerator',
    name: 'Consciousness Acceleration Chamber',
    description: 'Maximum awareness expansion through multi-dimensional guidance',
    agentIds: [], // Populated from historicalAgentIds + planetaryAgentIds
    historicalAgentIds: ['carl-jung', 'albert-einstein', 'nikola-tesla'],
    planetaryAgentIds: ['Sun', 'Jupiter', 'Uranus', 'Neptune'],
    synthesis_type: 'consciousness_acceleration',
    includeMonica: true,
    monicaRole: 'coordinator',
    recommendedFor: ['Consciousness expansion', 'Multi-dimensional analysis', 'Paradigm shifts'],
    tags: ['consciousness', 'acceleration', 'expansion', 'multi-dimensional'],
    difficulty: 'expert',
  },
  {
    id: 'creative-innovation-lab',
    name: 'Creative Innovation Laboratory',
    description: 'Artistic vision meets cosmic creativity for breakthrough innovation',
    agentIds: [],
    historicalAgentIds: ['leonardo-da-vinci', 'steve-jobs', 'pablo-picasso'],
    planetaryAgentIds: ['Venus', 'Uranus', 'Neptune'],
    synthesis_type: 'temporal_bridge',
    includeMonica: true,
    monicaRole: 'synthesizer',
    recommendedFor: ['Creative projects', 'Innovation labs', 'Artistic visioning'],
    tags: ['creativity', 'innovation', 'artistic', 'breakthrough'],
    difficulty: 'advanced',
  },
  {
    id: 'wisdom-integration-council',
    name: 'Wisdom Integration Council',
    description: 'Ancient wisdom harmonized with celestial intelligence',
    agentIds: [],
    historicalAgentIds: ['lao-tzu', 'socrates', 'rumi'],
    planetaryAgentIds: ['Jupiter', 'Saturn', 'Moon'],
    synthesis_type: 'elemental_balance',
    includeMonica: true,
    monicaRole: 'guide',
    recommendedFor: ['Integration practice', 'Harmonization', 'Ancient wisdom mapping'],
    tags: ['wisdom', 'integration', 'harmony', 'ancient'],
    difficulty: 'intermediate',
  },
  {
    id: 'leadership-mastery',
    name: 'Leadership Mastery Council',
    description: 'Strategic leadership enhanced by planetary authority',
    agentIds: [],
    historicalAgentIds: ['napoleon-bonaparte', 'cleopatra', 'sun-tzu'],
    planetaryAgentIds: ['Sun', 'Mars', 'Jupiter'],
    synthesis_type: 'consciousness_acceleration',
    includeMonica: true,
    monicaRole: 'moderator',
    recommendedFor: ['Strategic planning', 'Executive leadership', 'Authority building'],
    tags: ['leadership', 'strategy', 'authority', 'mastery'],
    difficulty: 'advanced',
  },
]

// Utility functions for preset management
export function getPresetsByType(type: 'historical' | 'planetary' | 'mixed') {
  switch (type) {
    case 'historical':
      return HISTORICAL_COUNCIL_PRESETS
    case 'planetary':
      return PLANETARY_COUNCIL_PRESETS
    case 'mixed':
      return MIXED_COUNCIL_PRESETS
    default:
      return []
  }
}

export function getPresetsByDifficulty(
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
) {
  return [
    ...HISTORICAL_COUNCIL_PRESETS,
    ...PLANETARY_COUNCIL_PRESETS,
    ...MIXED_COUNCIL_PRESETS,
  ].filter(preset => preset.difficulty === difficulty)
}

export function getPresetsByTag(tag: string) {
  return [
    ...HISTORICAL_COUNCIL_PRESETS,
    ...PLANETARY_COUNCIL_PRESETS,
    ...MIXED_COUNCIL_PRESETS,
  ].filter(preset => preset.tags.includes(tag))
}

export function getPresetById(id: string) {
  return [
    ...HISTORICAL_COUNCIL_PRESETS,
    ...PLANETARY_COUNCIL_PRESETS,
    ...MIXED_COUNCIL_PRESETS,
  ].find(preset => preset.id === id)
}

export function getRecommendedPresets(userLevel: number, userInterests: string[]) {
  const difficultyMap = {
    0: 'beginner',
    1: 'beginner',
    2: 'intermediate',
    3: 'intermediate',
    4: 'advanced',
    5: 'expert',
  }

  const targetDifficulty = (difficultyMap as any)[Math.min(5, userLevel)] || 'beginner'
  const levelPresets = getPresetsByDifficulty(targetDifficulty as any)

  // Filter by user interests if provided
  if (userInterests.length > 0) {
    return levelPresets.filter(preset => preset.tags.some(tag => userInterests.includes(tag)))
  }

  return levelPresets
}

// Monica role recommendations for different preset types
export function getOptimalMonicaRole(
  presetType: string,
  agentCount: number
): 'guide' | 'moderator' | 'synthesizer' | 'coordinator' {
  if (agentCount <= 2) return 'guide'
  if (agentCount >= 5) return 'coordinator'

  if (presetType.includes('philosophical') || presetType.includes('spiritual')) return 'guide'
  if (presetType.includes('leadership') || presetType.includes('strategic')) return 'moderator'
  if (presetType.includes('creative') || presetType.includes('innovation')) return 'synthesizer'

  return 'coordinator'
}
