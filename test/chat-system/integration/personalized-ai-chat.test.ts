import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/personalized-ai-chat/route'
import { createClaudeMessage } from '@/lib/anthropic-client'
import { prisma, StreakTracker } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    aIPersonality: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    trainingInteraction: {
      create: vi.fn(),
    },
    achievement: {
      create: vi.fn(),
    },
  },
  StreakTracker: {
    recordInteraction: vi.fn(),
  },
}))

vi.mock('@/lib/anthropic-client', () => ({
  anthropic: {},
  createClaudeMessage: vi.fn(),
}))

vi.mock('@/lib/personalized-ai/xp-system', () => ({
  calculateXP: vi.fn(() => ({
    totalXP: 15,
    streakMultiplier: 1.1,
    astrologicalBonus: 2,
  })),
  calculateInteractionQuality: vi.fn(() => 88),
}))

vi.mock('@/lib/personalized-ai/level-system', () => ({
  calculateLevel: vi.fn(() => 2),
  checkLevelUp: vi.fn(() => ({
    newLevel: 2,
    leveledUp: false,
  })),
}))

vi.mock('@/lib/personalized-ai/achievements', () => ({
  checkAchievements: vi.fn(() => []),
  ACHIEVEMENT_DEFINITIONS: {},
}))

vi.mock('@/lib/personalized-ai/dual-chart', () => ({
  generateCurrentMomentChart: vi.fn(async () => ({
    timestamp: new Date().toISOString(),
    planets: {},
    alchemicalData: {
      Spirit: 1,
      Essence: 1,
      Matter: 1,
      Substance: 1,
      ANumber: 4,
      DayEssence: 1,
      NightEssence: 1,
    },
    aspects: [],
  })),
  analyzeTransits: vi.fn(() => ({
    majorTransits: [{ influence: 'harmonious', themes: ['clarity'] }],
    currentMood: {
      energy: 72,
      emotion: 68,
      creativity: 74,
      communication: 70,
    },
    recommendations: [],
  })),
}))

vi.mock('@/lib/personalized-ai/tarot-training-gamification', () => ({
  generatePersonalizedChallenges: vi.fn(() => []),
  calculateTarotTrainingBonus: vi.fn(() => 0),
  getAIInteractionStyle: vi.fn(() => ({
    communication_style: 'balanced',
    response_approach: 'adaptive',
    motivation_method: 'encouraging',
    challenge_presentation: 'supportive',
  })),
}))

describe('Personalized AI Chat API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prisma.aIPersonality.findUnique.mockResolvedValue({
      personalityId: 'sage-1',
      level: 2,
      totalXp: 100,
      basePersonality: {
        archetype: 'Sage',
        communicationStyle: {
          directness: 60,
          formality: 55,
          emotiveness: 50,
        },
      },
      birthChartData: {},
      trainingScores: {
        communication_style: 40,
        emotional_intelligence: 45,
        creativity: 50,
        knowledge_depth: 55,
        memory_integration: 35,
        personality_alignment: 60,
      },
      ConsciousnessState: {
        unifiedArchetype: 'Sage',
      },
      Achievement: [],
      TrainingInteraction: [],
    })

    prisma.trainingInteraction.create.mockResolvedValue({ id: 'interaction-1' })
    prisma.aIPersonality.update.mockResolvedValue({})
    prisma.achievement.create.mockResolvedValue({})
    StreakTracker.recordInteraction.mockResolvedValue(3)

    vi.mocked(createClaudeMessage).mockResolvedValue({
      content: [{ type: 'text', text: 'A clear agent response.' }],
    } as any)
  })

  it('returns a non-empty personalized agent response', async () => {
    const request = new NextRequest('http://localhost/api/personalized-ai-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Help me reflect on today.',
        personalityId: 'sage-1',
        userId: 'user-1',
        trainingFocus: 'knowledge_depth',
        context: {
          timeOfDay: 'morning',
          mood: 'curious',
          previousInteractions: 4,
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.response).toBeTruthy()
    expect(typeof data.response).toBe('string')
    expect(data.response.length).toBeGreaterThan(0)
    expect(data.trainingUpdate.xpGained).toBeGreaterThan(0)
  })

  it('surfaces provider failures instead of returning a fallback response', async () => {
    vi.mocked(createClaudeMessage).mockRejectedValueOnce(new Error('Claude unavailable'))

    const request = new NextRequest('http://localhost/api/personalized-ai-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Are you still there?',
        personalityId: 'sage-1',
        userId: 'user-1',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.message).toContain('Claude unavailable')
  })
})
