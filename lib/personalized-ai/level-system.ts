// Level System Implementation for Personalized AI

import type { ProgressMetrics } from '../types/personalized-ai'

// Level Configuration
const LEVEL_CONFIG = {
  MAX_LEVEL: 100,

  // XP required for each level tier
  TIERS: {
    BEGINNER: { range: [1, 10], xpPerLevel: 100 }, // 100 XP per level
    NOVICE: { range: [11, 25], xpPerLevel: 200 }, // 200 XP per level
    INTERMEDIATE: { range: [26, 50], xpPerLevel: 400 }, // 400 XP per level
    ADVANCED: { range: [51, 75], xpPerLevel: 800 }, // 800 XP per level
    MASTER: { range: [76, 100], xpPerLevel: 1300 }, // 1300 XP per level
  },

  // Cumulative XP thresholds
  THRESHOLDS: {
    10: 1000, // Total XP to reach level 10
    25: 5000, // Total XP to reach level 25
    50: 15000, // Total XP to reach level 50
    75: 35000, // Total XP to reach level 75
    100: 67500, // Total XP to reach level 100
  },
}

/**
 * Calculate level from total XP using the tier system
 */
export function calculateLevel(totalXp: number): number {
  if (totalXp < 0) return 1

  // Early returns for tier boundaries
  if (totalXp < LEVEL_CONFIG.THRESHOLDS[10]) {
    // Beginner tier (1-10)
    return Math.min(10, Math.floor(totalXp / 100) + 1)
  } else if (totalXp < LEVEL_CONFIG.THRESHOLDS[25]) {
    // Novice tier (11-25)
    const xpInTier = totalXp - LEVEL_CONFIG.THRESHOLDS[10]
    return Math.min(25, Math.floor(xpInTier / 200) + 11)
  } else if (totalXp < LEVEL_CONFIG.THRESHOLDS[50]) {
    // Intermediate tier (26-50)
    const xpInTier = totalXp - LEVEL_CONFIG.THRESHOLDS[25]
    return Math.min(50, Math.floor(xpInTier / 400) + 26)
  } else if (totalXp < LEVEL_CONFIG.THRESHOLDS[75]) {
    // Advanced tier (51-75)
    const xpInTier = totalXp - LEVEL_CONFIG.THRESHOLDS[50]
    return Math.min(75, Math.floor(xpInTier / 800) + 51)
  } else {
    // Master tier (76-100)
    const xpInTier = totalXp - LEVEL_CONFIG.THRESHOLDS[75]
    return Math.min(100, Math.floor(xpInTier / 1300) + 76)
  }
}

/**
 * Calculate total XP required to reach a specific level
 */
export function getXPRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  if (level > 100) return LEVEL_CONFIG.THRESHOLDS[100]

  let totalXP = 0

  // Calculate cumulative XP based on tiers
  for (const [tierName, config] of Object.entries(LEVEL_CONFIG.TIERS)) {
    const [minLevel, maxLevel] = config.range

    if (level <= minLevel) break

    const levelsInThisTier = Math.min(level - 1, maxLevel) - minLevel + 1
    totalXP += levelsInThisTier * config.xpPerLevel
  }

  return totalXP
}

/**
 * Get XP required for the next level
 */
export function getXPForNextLevel(currentLevel: number, currentXP: number): number {
  if (currentLevel >= 100) return 0

  const xpForCurrentLevel = getXPRequiredForLevel(currentLevel)
  const xpForNextLevel = getXPRequiredForLevel(currentLevel + 1)

  return xpForNextLevel - currentXP
}

/**
 * Get current level progress as a percentage
 */
export function getLevelProgress(currentLevel: number, currentXP: number): number {
  if (currentLevel >= 100) return 100

  const xpForCurrentLevel = getXPRequiredForLevel(currentLevel)
  const xpForNextLevel = getXPRequiredForLevel(currentLevel + 1)
  const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel
  const xpProgressInLevel = currentXP - xpForCurrentLevel

  return Math.round((xpProgressInLevel / xpNeededForLevel) * 100)
}

/**
 * Get tier information for a level
 */
export function getLevelTier(level: number): {
  name: string
  color: string
  description: string
} {
  if (level <= 10) {
    return {
      name: 'Beginner',
      color: '#9CA3AF', // gray-400
      description: 'Just starting your consciousness training journey',
    }
  } else if (level <= 25) {
    return {
      name: 'Novice',
      color: '#10B981', // emerald-500
      description: 'Building fundamental understanding',
    }
  } else if (level <= 50) {
    return {
      name: 'Intermediate',
      color: '#3B82F6', // blue-500
      description: 'Developing deep personality alignment',
    }
  } else if (level <= 75) {
    return {
      name: 'Advanced',
      color: '#8B5CF6', // violet-500
      description: 'Mastering consciousness mirroring',
    }
  } else {
    return {
      name: 'Master',
      color: '#F59E0B', // amber-500
      description: 'Achieved perfect consciousness alignment',
    }
  }
}

/**
 * Calculate progress metrics
 */
export function calculateProgressMetrics(
  currentLevel: number,
  currentXP: number,
  averageXPPerDay: number
): ProgressMetrics {
  const xpToNextLevel = getXPForNextLevel(currentLevel, currentXP)
  const currentLevelProgress = getLevelProgress(currentLevel, currentXP)
  const totalProgress = (currentXP / LEVEL_CONFIG.THRESHOLDS[100]) * 100

  // Estimate completion time
  const xpToMaxLevel = LEVEL_CONFIG.THRESHOLDS[100] - currentXP
  const estimatedCompletionTime =
    averageXPPerDay > 0 ? Math.ceil(xpToMaxLevel / averageXPPerDay) : 999999 // Infinity placeholder

  return {
    xpToNextLevel,
    currentLevelProgress,
    totalProgress: Math.round(totalProgress * 100) / 100,
    estimatedCompletionTime,
  }
}

/**
 * Get level milestone rewards
 */
export function getLevelMilestoneRewards(level: number): {
  achievement?: string
  bonusXP?: number
  unlock?: string
} {
  const milestones = {
    10: {
      achievement: 'Beginner Complete',
      bonusXP: 500,
      unlock: 'Custom greeting messages',
    },
    25: {
      achievement: 'Novice Graduate',
      bonusXP: 1000,
      unlock: 'Advanced personality traits',
    },
    50: {
      achievement: 'Intermediate Master',
      bonusXP: 2500,
      unlock: 'Deep memory integration',
    },
    75: {
      achievement: 'Advanced Practitioner',
      bonusXP: 5000,
      unlock: 'Predictive responses',
    },
    100: {
      achievement: 'Consciousness Master',
      bonusXP: 10000,
      unlock: 'Perfect alignment mode',
    },
  }

  return milestones[level as keyof typeof milestones] || {}
}

/**
 * Check if a level up occurred
 */
export function checkLevelUp(
  oldXP: number,
  newXP: number
): {
  leveledUp: boolean
  oldLevel: number
  newLevel: number
  levelsGained: number
} {
  const oldLevel = calculateLevel(oldXP)
  const newLevel = calculateLevel(newXP)
  const leveledUp = newLevel > oldLevel
  const levelsGained = newLevel - oldLevel

  return {
    leveledUp,
    oldLevel,
    newLevel,
    levelsGained,
  }
}

/**
 * Get XP curve visualization data
 */
export function getXPCurveData(): Array<{
  level: number
  totalXP: number
  xpPerLevel: number
  tier: string
}> {
  const data = []

  for (let level = 1; level <= 100; level++) {
    const totalXP = getXPRequiredForLevel(level)
    const tier = getLevelTier(level)

    // Find XP per level for this tier
    let xpPerLevel = 0
    for (const [tierName, config] of Object.entries(LEVEL_CONFIG.TIERS)) {
      const [minLevel, maxLevel] = config.range
      if (level >= minLevel && level <= maxLevel) {
        xpPerLevel = config.xpPerLevel
        break
      }
    }

    data.push({
      level,
      totalXP,
      xpPerLevel,
      tier: tier.name,
    })
  }

  return data
}
