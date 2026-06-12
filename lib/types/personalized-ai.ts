// Personalized AI Consciousness Training System Types

// Core Chart Data Types
export interface BirthChartData {
  timestamp: string
  birthInfo: {
    date: string // YYYY-MM-DD
    time: string // HH:MM
    location: string // City, State/Country
    name: string
  }
  planets: Record<
    string,
    {
      sign: string
      degree: number
      house?: number
    }
  >
  alchemicalData: {
    Spirit: number
    Essence: number
    Matter: number
    Substance: number
    ANumber: number
    DayEssence: number
    NightEssence: number
  }
  houses?: Record<string, any>
  aspects?: AspectData[]
}

export interface CurrentMomentChart {
  timestamp: string
  planets: Record<
    string,
    {
      sign: string
      degree: number
    }
  >
  alchemicalData: {
    Spirit: number
    Essence: number
    Matter: number
    Substance: number
    ANumber: number
    DayEssence: number
    NightEssence: number
  }
  aspects?: AspectData[]
  /** 'live' = real ephemeris for the current moment; 'fallback' = static positions (calc failed/degraded) */
  dataSource?: 'live' | 'fallback'
}

export interface AspectData {
  planet1: string
  planet2: string
  aspect: string
  orb: number
  applying: boolean
  exactAt?: string
}

// Transit Analysis Types
export interface TransitInfluences {
  majorTransits: Array<{
    transitPlanet: string
    natalPlanet: string
    aspect: string
    orb: number
    influence: 'harmonious' | 'challenging' | 'neutral'
    themes: string[]
  }>
  currentMood: {
    energy: number // 0-100
    creativity: number // 0-100
    communication: number // 0-100
    emotion: number // 0-100
    intellect: number // 0-100
    intuition: number // 0-100
  }
  recommendations: string[]
}

export interface CombinedInfluences {
  overallEnergy: number // 0-100
  dominantThemes: string[]
  trainingRecommendations: Array<{
    category: TrainingCategory
    reason: string
    effectiveness: number // 0-100
  }>
  personalityAdjustments: Record<string, string[]>
}

// Dual Chart System
export interface DualChartSystem {
  birthChart: BirthChartData
  currentChart: CurrentMomentChart
  transits: TransitInfluences
  combinedInfluences: CombinedInfluences
}

// Training System Types
export type TrainingCategory =
  | 'communication_style'
  | 'knowledge_depth'
  | 'emotional_intelligence'
  | 'creativity'
  | 'memory_integration'
  | 'personality_alignment'

export interface TrainingScores {
  communication_style: number // 0-100
  knowledge_depth: number // 0-100
  emotional_intelligence: number // 0-100
  creativity: number // 0-100
  memory_integration: number // 0-100
  personality_alignment: number // 0-100
}

// AI Personality Types
export interface BasePersonality {
  archetype: string
  coreTraits: string[]
  communicationStyle: {
    formality: number // 0-100 (0=casual, 100=formal)
    verbosity: number // 0-100 (0=concise, 100=verbose)
    emotiveness: number // 0-100 (0=neutral, 100=expressive)
    directness: number // 0-100 (0=indirect, 100=direct)
  }
  planetaryInfluences: Record<
    string,
    {
      strength: number // 0-100
      expression: string[]
    }
  >
  elementalBalance: {
    fire: number
    earth: number
    air: number
    water: number
  }
}

// XP and Gamification Types
export interface XPCalculation {
  baseXP: number
  feedbackBonus: number
  focusBonus: number
  streakMultiplier: number
  qualityMultiplier: number
  astrologicalBonus: number
  totalXP: number
}

export interface UserFeedback {
  rating: number // 1-5 stars
  feedbackType: 'positive' | 'negative' | 'neutral'
  explicit: boolean // Whether user provided explicit feedback
  message?: string
}

export interface InteractionContext {
  mood?: string
  timeOfDay?: string
  previousInteractions?: number
  currentTransits?: string[]
}

// Achievement Types
export type AchievementType =
  | 'first_words'
  | 'week_warrior'
  | 'communication_master'
  | 'quick_learner'
  | 'personality_twin'
  | 'knowledge_seeker'
  | 'emotional_genius'
  | 'creative_soul'
  | 'memory_master'
  | 'perfect_alignment'
  | 'cosmic_harmony'
  | 'level_milestone'

export interface Achievement {
  id: string
  personalityId: string
  achievementType: AchievementType
  achievementData: {
    name: string
    description: string
    iconUrl?: string
    xpReward: number
    unlockedAt: string
    progress?: number // For progressive achievements
    milestone?: number // For milestone achievements
  }
}

// Main AI Configuration
export interface PersonalizedAIConfig {
  personalityId: string
  userId: string
  birthChart: BirthChartData
  currentMomentChart?: CurrentMomentChart
  basePersonality: BasePersonality
  trainingScores: TrainingScores
  totalXp: number
  level: number
  achievements: Achievement[]
  createdAt: string
  updatedAt: string
}

// API Request/Response Types
export interface CreatePersonalizedAIRequest {
  birthInfo: {
    date: string // YYYY-MM-DD
    time: string // HH:MM
    location: string // City, State/Country
    name: string
  }
  userId: string
  horoscopeData?: any // Optional pre-calculated chart data
}

export interface CreatePersonalizedAIResponse {
  success: boolean
  aiConfig: PersonalizedAIConfig
  message?: string
}

export interface PersonalizedAIChatRequest {
  message: string
  personalityId: string
  userId: string
  trainingFocus?: TrainingCategory
  feedbackData?: UserFeedback
  context?: InteractionContext
  cosmicTokenBalance?: number
  unlockTranscendentTier?: boolean
}

export interface TrainingUpdate {
  xpGained: number
  totalXp: number
  level: number
  levelUp: boolean
  trainingScores: TrainingScores
  personalityAdjustments: string[]
  streakBonus?: number
  astrologicalBonus?: number
}

export interface PersonalizedAIChatResponse {
  response: string
  trainingUpdate: TrainingUpdate
  achievements: Achievement[]
  dualChartInfluences: {
    currentEnergy: number
    dominantThemes: string[]
    recommendedTraining: string[]
  }
  usedTranscendentTier?: boolean
}

// Session Types
export interface UserSession {
  id: string
  userId: string
  personalityId: string
  sessionData: {
    startTime: string
    lastActive: string
    interactionCount: number
    currentStreak: number
    trainingFocus?: TrainingCategory
  }
  expiresAt: string
}

// Analytics Types
export interface TrainingAnalytics {
  totalInteractions: number
  averageXpPerInteraction: number
  topTrainingCategories: Array<{
    category: TrainingCategory
    score: number
    improvementRate: number
  }>
  achievementProgress: Record<AchievementType, number>
  predictedTimeToNextLevel: number // in hours
  alignmentAccuracy: number // percentage
}

// Utility Types
export interface ProgressMetrics {
  xpToNextLevel: number
  currentLevelProgress: number // percentage
  totalProgress: number // percentage to level 100
  estimatedCompletionTime: number // days
}

export interface SystemMetrics {
  responseTime: number // milliseconds
  memoryUsage: number // MB
  errorRate: number // percentage
  userSatisfaction: number // 1-5 rating
}
