// Achievement System Implementation for Personalized AI

import type {
  Achievement,
  AchievementType,
  TrainingScores,
  TrainingCategory,
} from '../types/personalized-ai'

// Achievement Definitions
export const ACHIEVEMENT_DEFINITIONS: Record<
  AchievementType,
  {
    name: string
    description: string
    xpReward: number
    icon: string
    checkCondition: (data: AchievementCheckData) => boolean
  }
> = {
  first_words: {
    name: 'First Words',
    description: 'Complete your first interaction with your AI',
    xpReward: 100,
    icon: '🗣️',
    checkCondition: data => data.totalInteractions === 1,
  },

  week_warrior: {
    name: 'Week Warrior',
    description: 'Maintain a 7-day interaction streak',
    xpReward: 500,
    icon: '🗓️',
    checkCondition: data => data.currentStreak >= 7,
  },

  communication_master: {
    name: 'Communication Master',
    description: 'Reach 90% in Communication Style training',
    xpReward: 1000,
    icon: '💬',
    checkCondition: data => data.trainingScores.communication_style >= 90,
  },

  quick_learner: {
    name: 'Quick Learner',
    description: 'Gain 1000 XP in a single day',
    xpReward: 750,
    icon: '⚡',
    checkCondition: data => data.dailyXPGained >= 1000,
  },

  personality_twin: {
    name: 'Personality Twin',
    description: 'Achieve 85% overall personality alignment',
    xpReward: 2000,
    icon: '👥',
    checkCondition: data => data.trainingScores.personality_alignment >= 85,
  },

  knowledge_seeker: {
    name: 'Knowledge Seeker',
    description: 'Reach 80% in Knowledge Depth training',
    xpReward: 800,
    icon: '📚',
    checkCondition: data => data.trainingScores.knowledge_depth >= 80,
  },

  emotional_genius: {
    name: 'Emotional Genius',
    description: 'Reach 85% in Emotional Intelligence training',
    xpReward: 900,
    icon: '❤️',
    checkCondition: data => data.trainingScores.emotional_intelligence >= 85,
  },

  creative_soul: {
    name: 'Creative Soul',
    description: 'Reach 80% in Creativity training',
    xpReward: 800,
    icon: '🎨',
    checkCondition: data => data.trainingScores.creativity >= 80,
  },

  memory_master: {
    name: 'Memory Master',
    description: 'Reach 85% in Memory Integration training',
    xpReward: 900,
    icon: '🧠',
    checkCondition: data => data.trainingScores.memory_integration >= 85,
  },

  perfect_alignment: {
    name: 'Perfect Alignment',
    description: 'Achieve 95% in Personality Alignment',
    xpReward: 3000,
    icon: '✨',
    checkCondition: data => data.trainingScores.personality_alignment >= 95,
  },

  cosmic_harmony: {
    name: 'Cosmic Harmony',
    description: 'Complete 100 interactions during harmonious transits',
    xpReward: 1500,
    icon: '🌟',
    checkCondition: data => data.harmoniousTransitInteractions >= 100,
  },

  level_milestone: {
    name: 'Level Milestone',
    description: 'Reach level milestones (10, 25, 50, 75, 100)',
    xpReward: 0, // Variable based on level
    icon: '🏆',
    checkCondition: data => [10, 25, 50, 75, 100].includes(data.currentLevel),
  },
}

// Data structure for checking achievements
export interface AchievementCheckData {
  totalInteractions: number
  currentStreak: number
  trainingScores: TrainingScores
  dailyXPGained: number
  currentLevel: number
  harmoniousTransitInteractions: number
  previousAchievements: string[] // IDs of already unlocked achievements
}

/**
 * Check for newly unlocked achievements
 */
export function checkAchievements(
  data: AchievementCheckData,
  personalityId: string
): Achievement[] {
  const newAchievements: Achievement[] = []

  for (const [type, definition] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
    const achievementType = type as AchievementType

    // Skip if already unlocked
    if (data.previousAchievements.includes(achievementType)) {
      continue
    }

    // Check if condition is met
    if (definition.checkCondition(data)) {
      // Special handling for level milestones
      let xpReward = definition.xpReward
      if (achievementType === 'level_milestone') {
        xpReward = data.currentLevel * 100 // 100 XP per level
      }

      newAchievements.push({
        id: `${personalityId}-${achievementType}-${Date.now()}`,
        personalityId,
        achievementType,
        achievementData: {
          name: definition.name,
          description: definition.description,
          iconUrl: definition.icon,
          xpReward,
          unlockedAt: new Date().toISOString(),
          milestone: achievementType === 'level_milestone' ? data.currentLevel : undefined,
        },
      })
    }
  }

  return newAchievements
}

/**
 * Get achievement progress for all achievements
 */
export function getAchievementProgress(
  data: AchievementCheckData
): Record<AchievementType, number> {
  const progress: Partial<Record<AchievementType, number>> = {}

  // Calculate progress for each achievement
  progress.first_words = data.totalInteractions > 0 ? 100 : 0
  progress.week_warrior = Math.min(100, (data.currentStreak / 7) * 100)
  progress.communication_master = Math.min(
    100,
    (data.trainingScores.communication_style / 90) * 100
  )
  progress.quick_learner = Math.min(100, (data.dailyXPGained / 1000) * 100)
  progress.personality_twin = Math.min(100, (data.trainingScores.personality_alignment / 85) * 100)
  progress.knowledge_seeker = Math.min(100, (data.trainingScores.knowledge_depth / 80) * 100)
  progress.emotional_genius = Math.min(100, (data.trainingScores.emotional_intelligence / 85) * 100)
  progress.creative_soul = Math.min(100, (data.trainingScores.creativity / 80) * 100)
  progress.memory_master = Math.min(100, (data.trainingScores.memory_integration / 85) * 100)
  progress.perfect_alignment = Math.min(100, (data.trainingScores.personality_alignment / 95) * 100)
  progress.cosmic_harmony = Math.min(100, (data.harmoniousTransitInteractions / 100) * 100)

  // Level milestone progress (to next milestone)
  const milestones = [10, 25, 50, 75, 100]
  const nextMilestone = milestones.find(m => m > data.currentLevel) || 100
  const prevMilestone = milestones.reverse().find(m => m <= data.currentLevel) || 1
  progress.level_milestone =
    ((data.currentLevel - prevMilestone) / (nextMilestone - prevMilestone)) * 100

  return progress as Record<AchievementType, number>
}

/**
 * Get achievements close to being unlocked
 */
export function getNearbyAchievements(
  data: AchievementCheckData,
  threshold: number = 80 // Show achievements that are 80% complete
): Array<{
  type: AchievementType
  name: string
  progress: number
  requirement: string
}> {
  const progress = getAchievementProgress(data)
  const nearby: Array<{
    type: AchievementType
    name: string
    progress: number
    requirement: string
  }> = []

  for (const [type, progressValue] of Object.entries(progress)) {
    const achievementType = type as AchievementType

    // Skip if already unlocked or not close enough
    if (data.previousAchievements.includes(achievementType) || progressValue < threshold) {
      continue
    }

    const definition = ACHIEVEMENT_DEFINITIONS[achievementType]
    nearby.push({
      type: achievementType,
      name: definition.name,
      progress: progressValue,
      requirement: getAchievementRequirement(achievementType),
    })
  }

  return nearby.sort((a, b) => b.progress - a.progress)
}

/**
 * Get human-readable requirement for an achievement
 */
function getAchievementRequirement(type: AchievementType): string {
  const requirements: Record<AchievementType, string> = {
    first_words: 'Complete your first interaction',
    week_warrior: 'Maintain a 7-day streak',
    communication_master: 'Reach 90% Communication Style',
    quick_learner: 'Gain 1000 XP in one day',
    personality_twin: 'Reach 85% Personality Alignment',
    knowledge_seeker: 'Reach 80% Knowledge Depth',
    emotional_genius: 'Reach 85% Emotional Intelligence',
    creative_soul: 'Reach 80% Creativity',
    memory_master: 'Reach 85% Memory Integration',
    perfect_alignment: 'Reach 95% Personality Alignment',
    cosmic_harmony: '100 interactions during good transits',
    level_milestone: 'Reach next level milestone',
  }

  return requirements[type] || 'Unknown requirement'
}

/**
 * Calculate total XP from achievements
 */
export function calculateAchievementXP(achievements: Achievement[]): number {
  return achievements.reduce((total, achievement) => {
    return total + (achievement.achievementData.xpReward || 0)
  }, 0)
}

/**
 * Get achievement statistics
 */
export function getAchievementStats(achievements: Achievement[]): {
  totalUnlocked: number
  totalPossible: number
  completionPercentage: number
  totalXPEarned: number
  rarest: Achievement | null
  mostRecent: Achievement | null
} {
  const totalPossible = Object.keys(ACHIEVEMENT_DEFINITIONS).length
  const totalUnlocked = achievements.length
  const completionPercentage = (totalUnlocked / totalPossible) * 100
  const totalXPEarned = calculateAchievementXP(achievements)

  // Find rarest achievement (lowest unlock rate globally - would need global stats)
  // For now, we'll use the one with highest XP reward as a proxy
  const rarest = achievements.reduce(
    (rare, current) => {
      if (!rare) return current
      return current.achievementData.xpReward > rare.achievementData.xpReward ? current : rare
    },
    null as Achievement | null
  )

  // Find most recent achievement
  const mostRecent = achievements.reduce(
    (recent, current) => {
      if (!recent) return current
      return new Date(current.achievementData.unlockedAt) >
        new Date(recent.achievementData.unlockedAt)
        ? current
        : recent
    },
    null as Achievement | null
  )

  return {
    totalUnlocked,
    totalPossible,
    completionPercentage,
    totalXPEarned,
    rarest,
    mostRecent,
  }
}
