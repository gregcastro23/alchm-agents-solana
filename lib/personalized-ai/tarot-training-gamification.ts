// Tarot-Based Training Gamification System
// Revolutionary adaptive training based on archetypal consciousness

import type { ConsciousnessProfile } from '../types/consciousness-survey'

export interface TarotTrainingChallenge {
  id: string
  archetype_alignment: string[]
  challenge_type: 'creative' | 'analytical' | 'emotional' | 'intuitive' | 'practical' | 'mystical'
  title: string
  description: string
  prompt: string
  completion_criteria: string
  xp_reward: number
  elemental_bonus: { element: string; multiplier: number }[]
  planetary_timing_bonus: { planet: string; multiplier: number }
  unlock_requirements?: {
    level?: number
    completed_challenges?: string[]
    archetype_match?: string
  }
}

export interface TarotQuestLine {
  id: string
  name: string
  description: string
  archetype_focus: string
  challenges: TarotTrainingChallenge[]
  completion_reward: {
    xp: number
    title: string
    special_abilities: string[]
  }
}

// ARCHETYPE-SPECIFIC QUEST LINES
export const TAROT_QUEST_LINES: TarotQuestLine[] = [
  {
    id: 'fool_journey',
    name: "The Fool's Infinite Journey",
    description: "Embrace beginner's mind and infinite possibility",
    archetype_focus: 'The Fool',
    challenges: [
      {
        id: 'leap_of_faith',
        archetype_alignment: ['The Fool', 'The Explorer'],
        challenge_type: 'creative',
        title: 'Leap of Faith Challenge',
        description: 'Take a creative risk that your rational mind might resist',
        prompt:
          'Describe something you\'ve always wanted to try but haven\'t due to fear or "logic." Write about taking the first step today, no matter how small.',
        completion_criteria:
          'Submit a creative response showing willingness to embrace uncertainty',
        xp_reward: 300,
        elemental_bonus: [
          { element: 'Air', multiplier: 1.5 },
          { element: 'Fire', multiplier: 1.3 },
        ],
        planetary_timing_bonus: { planet: 'Uranus', multiplier: 2.0 },
      },
      {
        id: 'divine_trust_exercise',
        archetype_alignment: ['The Fool', 'The Mystic'],
        challenge_type: 'intuitive',
        title: 'Divine Trust Exercise',
        description: 'Practice trusting your intuition over logic for one day',
        prompt:
          'For the next 24 hours, make decisions based on your first intuitive feeling rather than logical analysis. Document three decisions and their outcomes.',
        completion_criteria: 'Complete intuitive decision log with reflection',
        xp_reward: 400,
        elemental_bonus: [
          { element: 'Water', multiplier: 1.4 },
          { element: 'Air', multiplier: 1.2 },
        ],
        planetary_timing_bonus: { planet: 'Moon', multiplier: 1.8 },
      },
      {
        id: 'sacred_spontaneity',
        archetype_alignment: ['The Fool', 'The Creator'],
        challenge_type: 'creative',
        title: 'Sacred Spontaneity Practice',
        description: "Create something beautiful using only what's immediately available",
        prompt:
          "Look around you right now. Using only materials within arm's reach, create a piece of art, poetry, or expression that captures this moment. Document the process and result.",
        completion_criteria: 'Submit documentation of spontaneous creation',
        xp_reward: 350,
        elemental_bonus: [
          { element: 'Fire', multiplier: 1.6 },
          { element: 'Earth', multiplier: 1.2 },
        ],
        planetary_timing_bonus: { planet: 'Sun', multiplier: 1.5 },
      },
    ],
    completion_reward: {
      xp: 1000,
      title: 'Sacred Fool',
      special_abilities: ["Infinite Beginner's Mind", 'Divine Trust', 'Sacred Spontaneity'],
    },
  },

  {
    id: 'magician_mastery',
    name: "The Magician's Art of Manifestation",
    description: 'Master the tools of conscious creation',
    archetype_focus: 'The Magician',
    challenges: [
      {
        id: 'elemental_mastery',
        archetype_alignment: ['The Magician', 'The Creator'],
        challenge_type: 'practical',
        title: 'Four Elements Mastery',
        description: 'Demonstrate mastery over the four elements in daily life',
        prompt:
          'Choose one goal and approach it through all four elements: Fire (passion/action), Water (flow/emotion), Air (planning/communication), Earth (practical steps). Document your four-element approach.',
        completion_criteria: 'Complete four-element goal achievement plan with evidence',
        xp_reward: 500,
        elemental_bonus: [
          { element: 'Fire', multiplier: 1.25 },
          { element: 'Water', multiplier: 1.25 },
          { element: 'Air', multiplier: 1.25 },
          { element: 'Earth', multiplier: 1.25 },
        ],
        planetary_timing_bonus: { planet: 'Mercury', multiplier: 1.7 },
      },
      {
        id: 'manifestation_matrix',
        archetype_alignment: ['The Magician', 'The Sage'],
        challenge_type: 'analytical',
        title: 'Manifestation Matrix Creation',
        description: 'Design a personal system for turning ideas into reality',
        prompt:
          'Create your own "manifestation matrix" - a step-by-step system that works with your personality for bringing visions into physical reality. Test it on a small goal.',
        completion_criteria: 'Submit documented manifestation system with test results',
        xp_reward: 600,
        elemental_bonus: [
          { element: 'Air', multiplier: 1.4 },
          { element: 'Earth', multiplier: 1.3 },
        ],
        planetary_timing_bonus: { planet: 'Saturn', multiplier: 1.6 },
      },
    ],
    completion_reward: {
      xp: 1200,
      title: 'Conscious Creator',
      special_abilities: ['Elemental Mastery', 'Manifestation Wizard', 'Reality Architect'],
    },
  },

  {
    id: 'high_priestess_mysteries',
    name: 'The High Priestess Mysteries',
    description: 'Develop intuitive wisdom and inner knowing',
    archetype_focus: 'The High Priestess',
    challenges: [
      {
        id: 'intuitive_oracle',
        archetype_alignment: ['The High Priestess', 'The Mystic'],
        challenge_type: 'intuitive',
        title: 'Becoming Your Own Oracle',
        description: 'Develop a personal divination practice',
        prompt:
          'Create a personal method for accessing your inner wisdom (meditation, journaling, nature walks, etc.). Use it daily for one week to gain insights on important questions.',
        completion_criteria: 'Document one week of personal oracle practice with insights gained',
        xp_reward: 450,
        elemental_bonus: [
          { element: 'Water', multiplier: 1.5 },
          { element: 'Air', multiplier: 1.2 },
        ],
        planetary_timing_bonus: { planet: 'Moon', multiplier: 2.0 },
      },
      {
        id: 'shadow_wisdom_integration',
        archetype_alignment: ['The High Priestess', 'The Healer'],
        challenge_type: 'emotional',
        title: 'Shadow Wisdom Integration',
        description: 'Transform a challenging emotion into wisdom',
        prompt:
          'Identify a difficult emotion you\'ve been avoiding. Sit with it mindfully, asking "What wisdom does this feeling bring me?" Write about the insights that emerge.',
        completion_criteria: 'Submit reflection on shadow emotion transformed into wisdom',
        xp_reward: 400,
        elemental_bonus: [
          { element: 'Water', multiplier: 1.4 },
          { element: 'Earth', multiplier: 1.1 },
        ],
        planetary_timing_bonus: { planet: 'Pluto', multiplier: 1.8 },
      },
    ],
    completion_reward: {
      xp: 1000,
      title: 'Intuitive Oracle',
      special_abilities: ['Inner Knowing', 'Shadow Integration', 'Mystical Sight'],
    },
  },
]

// PLANETARY TIMING MULTIPLIERS
export const PLANETARY_TRAINING_BONUSES = {
  Mercury: {
    optimal_challenges: ['analytical', 'creative'],
    bonus_multiplier: 1.5,
    description: 'Enhanced communication and learning',
  },
  Venus: {
    optimal_challenges: ['creative', 'emotional'],
    bonus_multiplier: 1.4,
    description: 'Harmony and creative flow',
  },
  Mars: {
    optimal_challenges: ['practical', 'creative'],
    bonus_multiplier: 1.6,
    description: 'Action and manifestation power',
  },
  Jupiter: {
    optimal_challenges: ['creative', 'intuitive'],
    bonus_multiplier: 1.3,
    description: 'Expansion and wisdom',
  },
  Saturn: {
    optimal_challenges: ['analytical', 'practical'],
    bonus_multiplier: 1.5,
    description: 'Structure and mastery',
  },
  Moon: {
    optimal_challenges: ['intuitive', 'emotional'],
    bonus_multiplier: 1.7,
    description: 'Intuition and emotional depth',
  },
  Sun: {
    optimal_challenges: ['creative', 'practical'],
    bonus_multiplier: 1.4,
    description: 'Self-expression and vitality',
  },
}

// ELEMENTAL TRAINING ADAPTATIONS
export const ELEMENTAL_TRAINING_STYLES = {
  Fire: {
    preferred_challenge_types: ['creative', 'practical'],
    training_approach: 'Fast-paced, action-oriented, inspirational',
    bonus_activities: ['Rapid prototyping', 'Passion projects', 'Leadership challenges'],
    ai_interaction_style: 'Enthusiastic, motivating, direct',
  },
  Water: {
    preferred_challenge_types: ['emotional', 'intuitive'],
    training_approach: 'Flow-based, emotionally resonant, healing-focused',
    bonus_activities: ['Emotional exploration', 'Healing practices', 'Intuitive development'],
    ai_interaction_style: 'Empathetic, nurturing, supportive',
  },
  Air: {
    preferred_challenge_types: ['analytical', 'creative'],
    training_approach: 'Intellectual, communicative, idea-focused',
    bonus_activities: ['Concept exploration', 'Communication challenges', 'Learning new skills'],
    ai_interaction_style: 'Witty, informative, stimulating',
  },
  Earth: {
    preferred_challenge_types: ['practical', 'analytical'],
    training_approach: 'Structured, gradual, results-oriented',
    bonus_activities: ['Skill building', 'Practical application', 'Methodical practice'],
    ai_interaction_style: 'Grounded, reliable, practical',
  },
}

/**
 * Generate personalized training challenges based on tarot archetypal profile
 */
export function generatePersonalizedChallenges(
  profile: ConsciousnessProfile,
  currentLevel: number,
  completedChallenges: string[] = []
): TarotTrainingChallenge[] {
  const tarotProfile = profile.creativity.tarot_archetypal_profile
  const primaryElement = tarotProfile.elemental_ranking[0] || 'Air'
  const preferredChallengeTypes = ELEMENTAL_TRAINING_STYLES[
    primaryElement as keyof typeof ELEMENTAL_TRAINING_STYLES
  ]?.preferred_challenge_types || ['creative']

  // Find relevant quest lines
  const relevantQuests = TAROT_QUEST_LINES.filter(
    quest =>
      quest.archetype_focus === tarotProfile.primary_archetype ||
      quest.archetype_focus === tarotProfile.secondary_archetype
  )

  // If no exact match, use general challenges
  if (relevantQuests.length === 0) {
    relevantQuests.push(...TAROT_QUEST_LINES.slice(0, 2)) // Include first two as defaults
  }

  // Collect available challenges
  const availableChallenges: TarotTrainingChallenge[] = []

  for (const quest of relevantQuests) {
    for (const challenge of quest.challenges) {
      // Check if challenge is unlocked and not completed
      const isUnlocked =
        !challenge.unlock_requirements ||
        (currentLevel >= (challenge.unlock_requirements.level || 0) &&
          (!challenge.unlock_requirements.completed_challenges ||
            challenge.unlock_requirements.completed_challenges.every(req =>
              completedChallenges.includes(req)
            )))

      const isCompleted = completedChallenges.includes(challenge.id)

      if (isUnlocked && !isCompleted) {
        availableChallenges.push(challenge)
      }
    }
  }

  // Sort by archetype alignment and elemental preference
  return availableChallenges
    .sort((a, b) => {
      const aScore =
        (a.archetype_alignment.includes(tarotProfile.primary_archetype) ? 2 : 0) +
        (preferredChallengeTypes.includes(a.challenge_type) ? 1 : 0)
      const bScore =
        (b.archetype_alignment.includes(tarotProfile.primary_archetype) ? 2 : 0) +
        (preferredChallengeTypes.includes(b.challenge_type) ? 1 : 0)
      return bScore - aScore
    })
    .slice(0, 3) // Return top 3 most relevant challenges
}

/**
 * Calculate XP bonus based on planetary timing and elemental alignment
 */
export function calculateTarotTrainingBonus(
  challenge: TarotTrainingChallenge,
  profile: ConsciousnessProfile,
  currentPlanetaryInfluence?: string
): number {
  let bonus = 1.0
  const tarotProfile = profile.creativity.tarot_archetypal_profile

  // Elemental alignment bonus
  const primaryElement = tarotProfile.elemental_ranking[0]
  const elementalBonus = challenge.elemental_bonus.find(bonus =>
    primaryElement?.includes(bonus.element)
  )
  if (elementalBonus) {
    bonus *= elementalBonus.multiplier
  }

  // Planetary timing bonus
  if (currentPlanetaryInfluence === challenge.planetary_timing_bonus.planet) {
    bonus *= challenge.planetary_timing_bonus.multiplier
  }

  // Archetype alignment bonus
  if (challenge.archetype_alignment.includes(tarotProfile.primary_archetype)) {
    bonus *= 1.5
  } else if (challenge.archetype_alignment.includes(tarotProfile.secondary_archetype)) {
    bonus *= 1.2
  }

  return Math.round(challenge.xp_reward * bonus)
}

/**
 * Generate AI interaction style based on elemental preference
 */
export function getAIInteractionStyle(profile: ConsciousnessProfile): {
  communication_style: string
  response_approach: string
  motivation_method: string
  challenge_presentation: string
} {
  const tarotProfile = profile.creativity.tarot_archetypal_profile
  const primaryElement = tarotProfile.elemental_ranking[0] || 'Air'
  const elementKey = primaryElement.split(' ')[0] as keyof typeof ELEMENTAL_TRAINING_STYLES // Extract 'Fire' from '🔥 Fire (Wands)'

  const elementalStyle = ELEMENTAL_TRAINING_STYLES[elementKey] || ELEMENTAL_TRAINING_STYLES['Air']

  return {
    communication_style: elementalStyle.ai_interaction_style,
    response_approach: elementalStyle.training_approach,
    motivation_method: tarotProfile.energy_transmission,
    challenge_presentation: elementalStyle.training_approach,
  }
}
