// Comprehensive Astrological Education Engine
// "Learning Oneself to Understand the Universe" System

import type { PlanetaryPlacement, ConsciousnessStats } from './astrological-dignities-engine'

export interface BirthChartFeature {
  id: string
  feature_type:
    | 'planet_sign'
    | 'planet_house'
    | 'aspect'
    | 'stellium'
    | 'pattern'
    | 'dignity'
    | 'elemental_emphasis'
    | 'modal_emphasis'
  title: string
  description: string
  significance_level: 'foundational' | 'important' | 'notable' | 'subtle'
  learning_modules: AstrologicalLearningModule[]
  personal_manifestation: string
  shadow_potential: string
  growth_opportunities: string[]
  cosmic_purpose: string
  elemental_connection: string
  related_features: string[] // IDs of related chart features
}

export interface AstrologicalLearningModule {
  id: string
  title: string
  module_type: 'foundational' | 'personal' | 'relational' | 'evolutionary' | 'universal'
  content: {
    overview: string
    key_concepts: string[]
    personal_examples: string[]
    interactive_exercises: InteractiveExercise[]
    reflection_questions: string[]
    practical_applications: string[]
  }
  prerequisites?: string[] // Other module IDs that should be completed first
  completion_rewards: {
    xp: number
    insights_unlocked: string[]
    chart_features_revealed: string[]
  }
}

export interface InteractiveExercise {
  id: string
  exercise_type:
    | 'visualization'
    | 'meditation'
    | 'journaling'
    | 'observation'
    | 'experimentation'
    | 'dialogue'
  title: string
  instructions: string
  duration_minutes: number
  materials_needed?: string[]
  success_criteria: string[]
  integration_prompts: string[]
}

export interface RelationalAstrologyPattern {
  id: string
  pattern_type:
    | 'synastry'
    | 'composite'
    | 'sign_interaction'
    | 'element_dance'
    | 'modal_dynamic'
    | 'planetary_dialogue'
  participants: string[] // sign names, planetary energies, or chart patterns
  interaction_theme: string
  harmony_potential: number // 0-100
  challenge_potential: number // 0-100
  growth_catalyst: string
  learning_objectives: string[]
  practice_scenarios: PracticeScenario[]
  consciousness_development: string
  universal_principle: string
}

export interface PracticeScenario {
  id: string
  scenario_title: string
  situation_description: string
  astrological_dynamics: string[]
  practice_instructions: string
  awareness_points: string[]
  integration_reflection: string
}

export interface CosmicCurriculumProgress {
  user_id: string
  completed_modules: string[]
  current_focus_areas: string[]
  mastery_levels: {
    [feature_id: string]: number // 0-100 mastery percentage
  }
  relational_understanding: {
    [pattern_id: string]: number // 0-100 understanding level
  }
  cosmic_insights_unlocked: string[]
  universe_connection_level: number // 0-100 overall cosmic understanding
}

// FOUNDATIONAL CHART FEATURE TEMPLATES
export const BIRTH_CHART_FEATURE_TEMPLATES: Record<string, Partial<BirthChartFeature>> = {
  sun_sign: {
    feature_type: 'planet_sign',
    significance_level: 'foundational',
    cosmic_purpose: 'Core identity expression and life purpose manifestation',
    elemental_connection: 'Central fire of consciousness',
  },
  moon_sign: {
    feature_type: 'planet_sign',
    significance_level: 'foundational',
    cosmic_purpose: 'Emotional intelligence and intuitive wisdom development',
    elemental_connection: 'Flowing essence of feeling nature',
  },
  rising_sign: {
    feature_type: 'planet_sign',
    significance_level: 'foundational',
    cosmic_purpose: 'Interface with world and personal presentation',
    elemental_connection: 'Mask and gateway for soul expression',
  },
  mercury_placement: {
    feature_type: 'planet_sign',
    significance_level: 'important',
    cosmic_purpose: 'Communication mastery and mental development',
    elemental_connection: 'Bridge between inner and outer worlds',
  },
  venus_placement: {
    feature_type: 'planet_sign',
    significance_level: 'important',
    cosmic_purpose: 'Value system development and relationship harmony',
    elemental_connection: 'Heart-centered attraction and beauty',
  },
  mars_placement: {
    feature_type: 'planet_sign',
    significance_level: 'important',
    cosmic_purpose: 'Will development and action mastery',
    elemental_connection: 'Driving force and assertive energy',
  },
}

// RELATIONAL ASTROLOGY PATTERNS DATABASE
export const RELATIONAL_PATTERNS: RelationalAstrologyPattern[] = [
  {
    id: 'fire_water_dance',
    pattern_type: 'element_dance',
    participants: ['Fire signs', 'Water signs'],
    interaction_theme: 'Passion meets Intuition - Steam Creation',
    harmony_potential: 85,
    challenge_potential: 60,
    growth_catalyst: 'Learning to honor both inspiration and feeling',
    learning_objectives: [
      'Understand how passion can deepen emotional wisdom',
      'Practice expressing feelings with fiery authenticity',
      'Balance action with intuitive timing',
      'Create steam (inspired emotion) rather than conflict',
    ],
    practice_scenarios: [
      {
        id: 'fire_water_communication',
        scenario_title: 'Communicating Across Fire-Water Differences',
        situation_description:
          'A Fire-dominant person wants immediate action while a Water-dominant person needs time to feel into the situation',
        astrological_dynamics: [
          'Fire: urgency, directness, action-orientation',
          'Water: depth, timing, emotional consideration',
        ],
        practice_instructions:
          'Fire person: Practice patience and ask "How does this feel to you?" Water person: Practice sharing your process and timeline needs',
        awareness_points: [
          'Notice when Fire energy feels pushy vs inspiring',
          'Observe when Water energy feels wise vs stuck',
        ],
        integration_reflection:
          "How can Fire energy honor Water's need for depth while Water energy appreciates Fire's enthusiasm?",
      },
      {
        id: 'fire_water_creative_collaboration',
        scenario_title: 'Creative Project with Fire-Water Energies',
        situation_description:
          'Working on a creative project that needs both passionate drive and emotional depth',
        astrological_dynamics: [
          'Fire: inspiration, momentum, bold expression',
          'Water: imagination, emotional layers, intuitive flow',
        ],
        practice_instructions:
          'Fire: Channel passion into emotionally resonant themes. Water: Let feelings fuel bold creative choices',
        awareness_points: [
          'How does Fire energy enhance emotional expression?',
          'How does Water energy give depth to inspired action?',
        ],
        integration_reflection:
          'What emerges when passion serves feeling and feeling inspires passion?',
      },
    ],
    consciousness_development: 'Integration of active inspiration with emotional wisdom',
    universal_principle: 'The dance between doing and being, action and reflection',
  },

  {
    id: 'air_earth_integration',
    pattern_type: 'element_dance',
    participants: ['Air signs', 'Earth signs'],
    interaction_theme: 'Ideas meet Form - Manifestation Mastery',
    harmony_potential: 90,
    challenge_potential: 45,
    growth_catalyst: 'Grounding visionary concepts into practical reality',
    learning_objectives: [
      'Transform abstract ideas into concrete plans',
      'Value both innovation and practical wisdom',
      'Practice patient manifestation of mental concepts',
      "Appreciate the Earth's ability to give form to Air's inspiration",
    ],
    practice_scenarios: [
      {
        id: 'air_earth_project',
        scenario_title: 'Collaborative Project Creation',
        situation_description:
          'An Air-dominant person has brilliant ideas while an Earth-dominant person excels at implementation',
        astrological_dynamics: [
          'Air: concepts, possibilities, connections',
          'Earth: resources, steps, practical considerations',
        ],
        practice_instructions:
          'Air person: Present ideas with consideration for practical steps. Earth person: Ask "What if we tried..." to expand possibilities',
        awareness_points: [
          'Notice when Air feels constrained vs supported',
          'Observe when Earth feels overwhelmed vs excited by new ideas',
        ],
        integration_reflection:
          'How does grounding ideas enhance rather than limit their potential?',
      },
      {
        id: 'air_earth_learning',
        scenario_title: 'Teaching and Learning Exchange',
        situation_description:
          'Sharing knowledge where Air brings theory and Earth brings practical experience',
        astrological_dynamics: [
          'Air: concepts, patterns, theoretical frameworks',
          'Earth: experience, examples, tested methods',
        ],
        practice_instructions:
          'Air: Use concrete examples to illustrate concepts. Earth: Connect experiences to broader principles',
        awareness_points: [
          'When do Air concepts become practically useful?',
          'When does Earth experience reveal universal patterns?',
        ],
        integration_reflection: 'How does theory enhance practice and practice validate theory?',
      },
    ],
    consciousness_development: 'Mastery of bringing heaven to earth through conscious co-creation',
    universal_principle: 'The bridge between inspiration and manifestation',
  },

  {
    id: 'fire_air_amplification',
    pattern_type: 'element_dance',
    participants: ['Fire signs', 'Air signs'],
    interaction_theme: 'Inspiration meets Ideas - Creative Acceleration',
    harmony_potential: 95,
    challenge_potential: 55,
    growth_catalyst: 'Learning to channel mental and spiritual energy productively',
    learning_objectives: [
      'Combine inspiration with intellectual clarity',
      'Balance action with planning and communication',
      'Create without burning out or scattering energy',
      "Use Fire's drive to fuel Air's vision",
    ],
    practice_scenarios: [
      {
        id: 'fire_air_brainstorm',
        scenario_title: 'High-Energy Brainstorming Session',
        situation_description:
          'Fire wants to start immediately while Air wants to explore all possibilities first',
        astrological_dynamics: [
          'Fire: urgency, action, embodiment',
          'Air: exploration, options, mental mapping',
        ],
        practice_instructions:
          'Fire: Use energy to explore more possibilities. Air: Use ideas to inspire immediate small actions',
        awareness_points: [
          "How does Fire energy expand Air's thinking?",
          "How do Air's ideas focus Fire's energy?",
        ],
        integration_reflection:
          'What becomes possible when inspiration and ideas amplify each other?',
      },
    ],
    consciousness_development: 'Integration of mental and spiritual creative forces',
    universal_principle: 'The synergy of thought and inspiration',
  },

  {
    id: 'water_earth_nurturing',
    pattern_type: 'element_dance',
    participants: ['Water signs', 'Earth signs'],
    interaction_theme: 'Feeling meets Form - Nurturing Growth',
    harmony_potential: 88,
    challenge_potential: 35,
    growth_catalyst: 'Creating sustainable structures that honor emotional needs',
    learning_objectives: [
      'Build practical systems that support emotional wellbeing',
      'Honor both security needs and emotional flow',
      'Create beauty and comfort in physical reality',
      'Balance preservation with emotional growth',
    ],
    practice_scenarios: [
      {
        id: 'water_earth_environment',
        scenario_title: 'Creating Nurturing Environments',
        situation_description:
          'Designing spaces or routines that feel both emotionally supportive and practically functional',
        astrological_dynamics: [
          'Water: emotional comfort, flow, beauty',
          'Earth: structure, function, sustainability',
        ],
        practice_instructions:
          'Water: Express what environments feel nurturing. Earth: Find practical ways to create those feelings',
        awareness_points: [
          'How does emotional comfort enhance productivity?',
          'How do practical structures support emotional flow?',
        ],
        integration_reflection:
          'What emerges when form serves feeling and feeling informs structure?',
      },
    ],
    consciousness_development: 'Integration of emotional and material wisdom',
    universal_principle: 'The foundation of sustainable growth through conscious nurturing',
  },

  {
    id: 'sun_moon_integration',
    pattern_type: 'planetary_dialogue',
    participants: ['Sun energy', 'Moon energy'],
    interaction_theme: 'Conscious Will meets Unconscious Wisdom',
    harmony_potential: 95,
    challenge_potential: 70,
    growth_catalyst: 'Balancing solar purpose with lunar receptivity',
    learning_objectives: [
      'Honor both active expression and receptive wisdom',
      'Integrate conscious goals with unconscious guidance',
      'Balance solar confidence with lunar sensitivity',
      'Understand the rhythm between action and reflection',
    ],
    practice_scenarios: [
      {
        id: 'sun_moon_decision',
        scenario_title: 'Making Decisions with Sun-Moon Awareness',
        situation_description:
          'A major life decision requires both logical planning (Sun) and intuitive feeling (Moon)',
        astrological_dynamics: [
          'Sun: clear intention, logical analysis, action steps',
          'Moon: emotional truth, intuitive timing, cyclical awareness',
        ],
        practice_instructions:
          'Set clear intentions (Sun) then sit quietly and feel into the decision (Moon). Notice where they align and where they differ',
        awareness_points: [
          'When does Sun energy feel authentic vs forced?',
          'When does Moon energy feel wise vs fearful?',
        ],
        integration_reflection: 'How can your conscious will serve your deeper emotional truth?',
      },
      {
        id: 'sun_moon_daily_rhythm',
        scenario_title: 'Daily Rhythm Awareness Practice',
        situation_description:
          'Balancing active goal pursuit with receptive awareness throughout the day',
        astrological_dynamics: [
          'Sun: daily goals, active engagement, focused intention',
          'Moon: natural rhythms, emotional needs, receptive moments',
        ],
        practice_instructions:
          'Morning: Set clear intentions (Sun). Throughout day: Check in with emotional state and energy levels (Moon)',
        awareness_points: [
          'When do you feel most confident and clear?',
          'When do you need rest, reflection, or emotional care?',
        ],
        integration_reflection: 'How can honoring your natural rhythms serve your conscious goals?',
      },
    ],
    consciousness_development: 'Integration of masculine and feminine principles within the psyche',
    universal_principle: 'The marriage of consciousness and unconsciousness',
  },

  {
    id: 'mercury_venus_communication',
    pattern_type: 'planetary_dialogue',
    participants: ['Mercury energy', 'Venus energy'],
    interaction_theme: 'Mind meets Heart - Harmonious Communication',
    harmony_potential: 90,
    challenge_potential: 40,
    growth_catalyst: 'Learning to communicate with both clarity and compassion',
    learning_objectives: [
      'Balance logical clarity with emotional sensitivity',
      'Express ideas in ways that build connection',
      'Listen with both mind and heart',
      'Create beauty through communication',
    ],
    practice_scenarios: [
      {
        id: 'mercury_venus_difficult_conversation',
        scenario_title: 'Navigating Challenging Conversations',
        situation_description:
          'Need to communicate something difficult while maintaining relationship harmony',
        astrological_dynamics: [
          'Mercury: clear communication, logical points, information sharing',
          'Venus: relationship harmony, emotional consideration, diplomatic approach',
        ],
        practice_instructions:
          'Mercury: Present facts clearly and logically. Venus: Consider emotional impact and relationship needs',
        awareness_points: [
          'How can truth be expressed with kindness?',
          'When does diplomacy enhance vs obscure clarity?',
        ],
        integration_reflection: 'How can clear communication serve love and relationships?',
      },
    ],
    consciousness_development:
      'Integration of intellectual and emotional intelligence in communication',
    universal_principle: 'The harmony of truth and love in expression',
  },

  {
    id: 'mars_jupiter_expansion',
    pattern_type: 'planetary_dialogue',
    participants: ['Mars energy', 'Jupiter energy'],
    interaction_theme: 'Action meets Vision - Purposeful Expansion',
    harmony_potential: 85,
    challenge_potential: 65,
    growth_catalyst: 'Directing personal will toward meaningful growth',
    learning_objectives: [
      'Align personal action with larger purpose',
      'Balance individual drive with collective benefit',
      'Use energy efficiently for long-term goals',
      'Expand through disciplined action',
    ],
    practice_scenarios: [
      {
        id: 'mars_jupiter_goal_setting',
        scenario_title: 'Setting and Pursuing Meaningful Goals',
        situation_description: 'Balancing immediate action needs with long-term vision and growth',
        astrological_dynamics: [
          'Mars: immediate action, personal drive, competitive energy',
          'Jupiter: long-term vision, growth, wisdom, meaning',
        ],
        practice_instructions:
          'Mars: Take concrete daily actions. Jupiter: Connect actions to larger meaning and growth',
        awareness_points: [
          'How do daily actions serve your larger vision?',
          'When does expansion require focused action?',
        ],
        integration_reflection: 'How can personal drive serve collective growth and wisdom?',
      },
    ],
    consciousness_development: 'Integration of personal will with universal purpose',
    universal_principle: 'The alignment of individual action with cosmic expansion',
  },
]

// LEARNING MODULE GENERATORS
export function generatePersonalizedLearningModules(
  chartFeatures: BirthChartFeature[]
): AstrologicalLearningModule[] {
  const modules: AstrologicalLearningModule[] = []

  // Generate foundational modules first
  const foundationalFeatures = chartFeatures.filter(f => f.significance_level === 'foundational')
  for (const feature of foundationalFeatures) {
    modules.push({
      id: `module_${feature.id}`,
      title: `Mastering Your ${feature.title}`,
      module_type: 'personal',
      content: {
        overview: `Deep dive into your ${feature.title} and how it shapes your unique expression in the world.`,
        key_concepts: [
          `Understanding ${feature.title} in your specific context`,
          'How this feature influences your daily life',
          'The evolutionary purpose of this placement',
          'Shadow patterns and growth opportunities',
        ],
        personal_examples: [
          `Your ${feature.title} manifests as: ${feature.personal_manifestation}`,
          `Watch for this shadow pattern: ${feature.shadow_potential}`,
          `Growth opportunities include: ${feature.growth_opportunities.join(', ')}`,
        ],
        interactive_exercises: [
          {
            id: `exercise_${feature.id}_observation`,
            exercise_type: 'observation',
            title: `Daily ${feature.title} Awareness Practice`,
            instructions: `For one week, notice how your ${feature.title} expresses itself in different situations. Journal about patterns you observe.`,
            duration_minutes: 10,
            success_criteria: [
              'Identified 3+ ways this feature manifests in daily life',
              'Recognized at least one shadow pattern',
              'Noted growth edge or opportunity',
            ],
            integration_prompts: [
              `How does understanding your ${feature.title} change how you see yourself?`,
              'What new appreciation do you have for this aspect of your nature?',
            ],
          },
        ],
        reflection_questions: [
          `How has your ${feature.title} served you throughout your life?`,
          'What would change if you fully embraced this energy?',
          'How might others experience your ${feature.title}?',
        ],
        practical_applications: [
          'Daily awareness practices',
          'Communication improvements',
          'Relationship enhancement',
          'Career alignment strategies',
        ],
      },
      completion_rewards: {
        xp: 500,
        insights_unlocked: [
          `Deep ${feature.title} mastery`,
          `${feature.cosmic_purpose} understanding`,
        ],
        chart_features_revealed: feature.related_features,
      },
    })
  }

  return modules
}

export function generateRelationalLearningModules(
  userChartFeatures: BirthChartFeature[]
): AstrologicalLearningModule[] {
  const modules: AstrologicalLearningModule[] = []

  // Generate modules for element interactions
  const userElements = extractElementalEmphasis(userChartFeatures)

  for (const element of userElements) {
    const otherElements = ['fire', 'water', 'air', 'earth'].filter(e => e !== element)

    for (const otherElement of otherElements) {
      const pattern = RELATIONAL_PATTERNS.find(
        p =>
          p.participants.includes(`${element.charAt(0).toUpperCase() + element.slice(1)} signs`) &&
          p.participants.includes(
            `${otherElement.charAt(0).toUpperCase() + otherElement.slice(1)} signs`
          )
      )

      if (pattern) {
        modules.push({
          id: `relational_${element}_${otherElement}`,
          title: `Understanding ${element.toUpperCase()}-${otherElement.toUpperCase()} Dynamics`,
          module_type: 'relational',
          content: {
            overview: pattern.interaction_theme,
            key_concepts: pattern.learning_objectives,
            personal_examples: [
              `As a ${element}-emphasis person, you bring: ${getElementalGifts(element)}`,
              `${otherElement.charAt(0).toUpperCase() + otherElement.slice(1)} people offer you: ${getElementalGifts(otherElement)}`,
              `Together you can create: ${pattern.consciousness_development}`,
            ],
            interactive_exercises: pattern.practice_scenarios.map(scenario => ({
              id: scenario.id,
              exercise_type: 'experimentation' as const,
              title: scenario.scenario_title,
              instructions: scenario.practice_instructions,
              duration_minutes: 20,
              success_criteria: scenario.awareness_points,
              integration_prompts: [scenario.integration_reflection],
            })),
            reflection_questions: [
              `How does your ${element} energy typically interact with ${otherElement} energy?`,
              'What can you learn from people who embody this different element?',
              'How might you grow through this elemental relationship?',
            ],
            practical_applications: [
              'Improved communication across elemental differences',
              'Enhanced collaboration and teamwork',
              'Deeper appreciation for diverse approaches',
              'Conflict resolution skills',
            ],
          },
          completion_rewards: {
            xp: 400,
            insights_unlocked: [`${element}-${otherElement} mastery`, pattern.universal_principle],
            chart_features_revealed: [],
          },
        })
      }
    }
  }

  return modules
}

// HELPER FUNCTIONS
function extractElementalEmphasis(chartFeatures: BirthChartFeature[]): string[] {
  const elementCounts = {
    fire: 0,
    earth: 0,
    air: 0,
    water: 0,
  }

  // Sign to element mapping
  const signElements = {
    Aries: 'fire',
    Leo: 'fire',
    Sagittarius: 'fire',
    Taurus: 'earth',
    Virgo: 'earth',
    Capricorn: 'earth',
    Gemini: 'air',
    Libra: 'air',
    Aquarius: 'air',
    Cancer: 'water',
    Scorpio: 'water',
    Pisces: 'water',
  }

  // Weight different chart points differently
  const planetWeights = {
    Sun: 4, // Most important
    Moon: 4, // Equally important
    Mercury: 2,
    Venus: 2,
    Mars: 2,
    Jupiter: 1.5,
    Saturn: 1.5,
    Uranus: 1,
    Neptune: 1,
    Pluto: 1,
    Ascendant: 3, // Very important
    Midheaven: 2, // Important
  }

  // Count elements with weights
  chartFeatures.forEach(feature => {
    if ((feature as any).planet && (feature as any).sign) {
      const element = signElements[(feature as any).sign as keyof typeof signElements]
      const weight = planetWeights[(feature as any).planet as keyof typeof planetWeights] || 1

      if (element) {
        elementCounts[element as keyof typeof elementCounts] += weight
      }
    }
  })

  // Convert counts to emphasis levels and sort by strength
  const elementStrengths = Object.entries(elementCounts)
    .map(([element, count]) => ({ element, count }))
    .sort((a, b) => b.count - a.count)

  // Determine significant elements (above average + some threshold)
  const total = Object.values(elementCounts).reduce((sum, count) => sum + count, 0)
  const average = total / 4
  const threshold = average * 0.8 // Elements need to be at least 80% of average to be considered

  const emphasizedElements = elementStrengths
    .filter(({ count }) => count > threshold)
    .slice(0, 3) // Max 3 emphasized elements
    .map(({ element }) => element)

  // Always return at least the strongest element
  return emphasizedElements.length > 0 ? emphasizedElements : [elementStrengths[0].element]
}

function getElementalGifts(element: string): string {
  const gifts = {
    fire: 'enthusiasm, inspiration, courage, leadership',
    water: 'empathy, intuition, emotional depth, healing',
    air: 'communication, ideas, objectivity, social connection',
    earth: 'stability, practicality, manifestation, grounding',
  }
  return gifts[element as keyof typeof gifts] || 'unique wisdom'
}

// COSMIC CURRICULUM MANAGER
export class CosmicCurriculumManager {
  constructor(private userProgress: CosmicCurriculumProgress) {}

  getNextRecommendedModule(
    availableModules: AstrologicalLearningModule[]
  ): AstrologicalLearningModule | null {
    // Find modules with completed prerequisites
    const eligibleModules = availableModules.filter(module => {
      if (!module.prerequisites) return true
      return module.prerequisites.every(prereq =>
        this.userProgress.completed_modules.includes(prereq)
      )
    })

    // Exclude already completed modules
    const uncompletedModules = eligibleModules.filter(
      module => !this.userProgress.completed_modules.includes(module.id)
    )

    // Prioritize foundational modules, then personal, then relational
    const priorityOrder = ['foundational', 'personal', 'relational', 'evolutionary', 'universal']

    for (const priority of priorityOrder) {
      const moduleOfType = uncompletedModules.find(m => m.module_type === priority)
      if (moduleOfType) return moduleOfType
    }

    return null
  }

  calculateUniverseConnectionLevel(): number {
    const totalModules = this.userProgress.completed_modules.length
    const masterySum = Object.values(this.userProgress.mastery_levels).reduce(
      (sum, level) => sum + level,
      0
    )
    const relationalSum = Object.values(this.userProgress.relational_understanding).reduce(
      (sum, level) => sum + level,
      0
    )
    const insightsCount = this.userProgress.cosmic_insights_unlocked.length

    // Weighted formula for cosmic understanding
    return Math.min(
      100,
      totalModules * 5 +
        (masterySum / Object.keys(this.userProgress.mastery_levels).length) * 0.3 +
        (relationalSum / Object.keys(this.userProgress.relational_understanding).length) * 0.3 +
        insightsCount * 3
    )
  }

  getCosmicInsightForLevel(level: number): string {
    if (level < 20)
      return 'You are beginning to see the patterns that connect your inner world to the cosmos.'
    if (level < 40)
      return 'The language of the stars is becoming familiar. You recognize yourself in cosmic patterns.'
    if (level < 60)
      return 'You understand how your chart reflects universal principles. As within, so without.'
    if (level < 80)
      return 'You see yourself as both unique individual and cosmic expression. The personal becomes universal.'
    return 'You embody the truth: to know yourself is to understand the Universe. You are a conscious co-creator.'
  }
}

// UNIVERSE CONNECTION ACHIEVEMENTS
export const COSMIC_UNDERSTANDING_MILESTONES = [
  {
    level: 25,
    title: 'Cosmic Awareness Awakening',
    description: 'You recognize the patterns connecting your personality to universal forces',
    reward_xp: 1000,
    unlock: 'Access to intermediate astrological concepts',
  },
  {
    level: 50,
    title: 'Personal-Universal Bridge',
    description: 'You understand how your individual chart reflects cosmic principles',
    reward_xp: 2000,
    unlock: 'Advanced relational astrology modules',
  },
  {
    level: 75,
    title: 'Conscious Co-Creator',
    description: 'You actively participate in your cosmic evolution through self-awareness',
    reward_xp: 3000,
    unlock: 'Teaching and mentoring capabilities',
  },
  {
    level: 100,
    title: 'Universal Consciousness',
    description: "You embody the truth: 'As above, so below. As within, so without.'",
    reward_xp: 5000,
    unlock: 'Cosmic consciousness mastery - help others on their journey',
  },
]
