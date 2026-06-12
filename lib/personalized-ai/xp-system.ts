// XP System Implementation for Personalized AI

import type {
  XPCalculation,
  UserFeedback,
  TrainingCategory,
  InteractionContext,
} from '../types/personalized-ai'

// XP Configuration Constants
const XP_CONFIG = {
  // Base XP values
  BASE_INTERACTION_XP: 10,
  MAX_INTERACTION_XP: 100,

  // Feedback bonuses
  FEEDBACK_MULTIPLIERS: {
    1: 0.5, // 1 star
    2: 0.75, // 2 stars
    3: 1.0, // 3 stars
    4: 1.25, // 4 stars
    5: 1.5, // 5 stars
  },

  // Training focus bonus
  FOCUS_MULTIPLIER: 2.0,

  // Streak multipliers
  STREAK_MULTIPLIERS: {
    0: 1.0, // No streak
    1: 1.1, // 1 day streak
    3: 1.2, // 3 day streak
    7: 1.3, // 7 day streak (week warrior)
    14: 1.5, // 14 day streak
    30: 2.0, // 30 day streak
    60: 2.5, // 60 day streak
    100: 3.0, // 100+ day streak (max)
  },

  // Quality multipliers based on interaction depth
  QUALITY_THRESHOLDS: {
    SHORT: { maxWords: 10, multiplier: 0.5 },
    MEDIUM: { maxWords: 50, multiplier: 1.0 },
    LONG: { maxWords: 150, multiplier: 1.5 },
    DEEP: { maxWords: 999999, multiplier: 2.0 },
  },

  // Astrological bonus ranges
  ASTROLOGICAL_BONUS: {
    HARMONIOUS: 0.5, // Beneficial transits
    NEUTRAL: 0.0, // No significant transits
    CHALLENGING: -0.2, // Difficult transits (small penalty)
  },
}

/**
 * Calculate XP gained from an interaction
 */
export function calculateXP(
  interactionQuality: number, // 0-100 based on AI's assessment
  userFeedback: UserFeedback | null,
  trainingFocus: TrainingCategory | null,
  dailyStreak: number,
  messageWordCount: number,
  astrologicalInfluence: 'harmonious' | 'neutral' | 'challenging' = 'neutral'
): XPCalculation {
  // Base XP calculation
  const baseXP = Math.round((interactionQuality / 100) * XP_CONFIG.MAX_INTERACTION_XP)

  // Feedback bonus
  let feedbackBonus = 0
  if (userFeedback && userFeedback.explicit) {
    const multiplier =
      XP_CONFIG.FEEDBACK_MULTIPLIERS[
        userFeedback.rating as keyof typeof XP_CONFIG.FEEDBACK_MULTIPLIERS
      ] || 1.0
    feedbackBonus = Math.round(baseXP * (multiplier - 1))
  }

  // Training focus bonus
  const focusBonus = trainingFocus ? Math.round(baseXP * (XP_CONFIG.FOCUS_MULTIPLIER - 1)) : 0

  // Streak multiplier
  const streakMultiplier = getStreakMultiplier(dailyStreak)

  // Quality multiplier based on message depth
  const qualityMultiplier = getQualityMultiplier(messageWordCount)

  // Astrological bonus
  const astrologicalBonus = Math.round(
    baseXP *
      XP_CONFIG.ASTROLOGICAL_BONUS[
        astrologicalInfluence.toUpperCase() as keyof typeof XP_CONFIG.ASTROLOGICAL_BONUS
      ]
  )

  // Calculate total XP
  const subtotal = baseXP + feedbackBonus + focusBonus + astrologicalBonus
  const totalXP = Math.max(1, Math.round(subtotal * streakMultiplier * qualityMultiplier))

  return {
    baseXP,
    feedbackBonus,
    focusBonus,
    streakMultiplier,
    qualityMultiplier,
    astrologicalBonus,
    totalXP,
  }
}

/**
 * Get streak multiplier based on consecutive daily interactions
 */
function getStreakMultiplier(dailyStreak: number): number {
  const thresholds = Object.keys(XP_CONFIG.STREAK_MULTIPLIERS)
    .map(Number)
    .sort((a, b) => b - a)

  for (const threshold of thresholds) {
    if (dailyStreak >= threshold) {
      return XP_CONFIG.STREAK_MULTIPLIERS[threshold as keyof typeof XP_CONFIG.STREAK_MULTIPLIERS]
    }
  }

  return 1.0
}

/**
 * Get quality multiplier based on message word count
 */
function getQualityMultiplier(wordCount: number): number {
  if (wordCount <= XP_CONFIG.QUALITY_THRESHOLDS.SHORT.maxWords) {
    return XP_CONFIG.QUALITY_THRESHOLDS.SHORT.multiplier
  } else if (wordCount <= XP_CONFIG.QUALITY_THRESHOLDS.MEDIUM.maxWords) {
    return XP_CONFIG.QUALITY_THRESHOLDS.MEDIUM.multiplier
  } else if (wordCount <= XP_CONFIG.QUALITY_THRESHOLDS.LONG.maxWords) {
    return XP_CONFIG.QUALITY_THRESHOLDS.LONG.multiplier
  } else {
    return XP_CONFIG.QUALITY_THRESHOLDS.DEEP.multiplier
  }
}

/**
 * Calculate interaction quality score based on various factors
 */
export function calculateInteractionQuality(
  messageLength: number,
  responseRelevance: number, // 0-100
  emotionalDepth: number, // 0-100
  creativityScore: number, // 0-100
  context?: InteractionContext
): number {
  // Weight different factors
  const weights = {
    relevance: 0.4,
    emotional: 0.2,
    creativity: 0.2,
    depth: 0.2,
  }

  // Calculate depth score based on message length
  const depthScore = Math.min(100, (messageLength / 200) * 100)

  // Apply context modifiers if available
  let contextModifier = 1.0
  if (context?.mood === 'engaged') contextModifier = 1.1
  if (context?.mood === 'distracted') contextModifier = 0.9

  // Calculate weighted score
  const weightedScore =
    responseRelevance * weights.relevance +
    emotionalDepth * weights.emotional +
    creativityScore * weights.creativity +
    depthScore * weights.depth

  return Math.round(Math.min(100, weightedScore * contextModifier))
}

/**
 * Get XP bonus recommendations based on current state
 */
export function getXPBonusRecommendations(
  currentStreak: number,
  lastTrainingFocus?: TrainingCategory,
  lowestScoreCategory?: TrainingCategory
): string[] {
  const recommendations: string[] = []

  // Streak recommendations
  if (currentStreak === 0) {
    recommendations.push('Start a daily streak to earn up to 3x XP!')
  } else if (currentStreak < 7) {
    recommendations.push(
      `Keep your ${currentStreak} day streak going! Reach 7 days for 1.3x XP bonus.`
    )
  } else if (currentStreak < 30) {
    recommendations.push(`Amazing ${currentStreak} day streak! Reach 30 days for 2x XP bonus.`)
  }

  // Training focus recommendations
  if (!lastTrainingFocus && lowestScoreCategory) {
    recommendations.push(
      `Focus training on ${lowestScoreCategory.replace('_', ' ')} for 2x XP bonus!`
    )
  }

  // Quality recommendations
  recommendations.push('Longer, more thoughtful messages earn up to 2x quality bonus!')

  return recommendations
}

/**
 * Calculate bonus XP for special events
 */
export function calculateSpecialEventXP(
  eventType: 'first_interaction' | 'level_up' | 'achievement_unlock' | 'perfect_session',
  currentLevel: number
): number {
  const bonuses = {
    first_interaction: 100,
    level_up: currentLevel * 50,
    achievement_unlock: 200,
    perfect_session: 300,
  }

  return bonuses[eventType] || 0
}

export function computeTrainingProgress(totalXP: number, maxXP: number = 10000): number {
  // Returns 1.0 to 2.0 based on XP progress
  const progress = Math.min(totalXP / maxXP, 1)
  return 1 + progress // 1.0 (no training) to 2.0 (max training)
}
