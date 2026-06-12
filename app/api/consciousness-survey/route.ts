// POST /api/consciousness-survey - Process consciousness survey and create enhanced AI

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { processSurveyResponses } from '@/lib/consciousness-survey/survey-processor'
import { initializeConsciousnessState } from '@/lib/consciousness-survey/consciousness-initializer'
import { createDualChartSystem } from '@/lib/personalized-ai/dual-chart'
import { calculateLevel } from '@/lib/personalized-ai/level-system'
import type {
  CreatePersonalizedAIRequest,
  CreatePersonalizedAIResponse,
  PersonalizedAIConfig,
} from '@/lib/types/personalized-ai'
import type { ConsciousnessSurvey, SurveyResponse } from '@/lib/types/consciousness-survey'

interface ConsciousnessSurveyRequest {
  userId: string
  birthInfo: {
    date: string
    time: string
    location: string
    name: string
  }
  surveyResponses: SurveyResponse[]
  timeSpent: number // seconds
  horoscopeData?: any
}

export async function POST(request: NextRequest) {
  try {
    const body: ConsciousnessSurveyRequest = await request.json()

    // Validate required fields
    if (!body.userId || !body.birthInfo || !body.surveyResponses) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: userId, birthInfo, and surveyResponses',
        },
        { status: 400 }
      )
    }

    const { userId, birthInfo, surveyResponses, timeSpent, horoscopeData } = body

    console.log('Processing consciousness survey for user:', userId)

    try {
      // 1. Save survey responses to database
      const survey = await prisma.consciousnessSurvey.create({
        data: {
          userId,
          responses: surveyResponses as any,
          timeSpent: timeSpent || 0,
          version: '1.0.0',
        },
      })

      console.log('Survey saved with ID:', survey.id)

      // 2. Process survey responses into consciousness profile
      const surveyData: ConsciousnessSurvey = {
        userId,
        responses: surveyResponses,
        completedAt: survey.completedAt.toISOString(),
        timeSpent: survey.timeSpent,
        version: survey.version,
      }

      const surveyAnalysis = await processSurveyResponses(surveyData)
      console.log('Survey analysis completed, archetype:', surveyAnalysis.insights.archetype)

      // 3. Save consciousness profile
      const consciousnessProfile = await prisma.consciousnessProfile.create({
        data: {
          userId,
          surveyId: survey.id,
          profileData: surveyAnalysis.profile as any,
          insights: surveyAnalysis.insights as any,
          compatibilityScore: surveyAnalysis.compatibility_score,
          trainingFocus: surveyAnalysis.recommended_training_focus as any,
          conversationStarters: surveyAnalysis.initial_conversation_starters as any,
          personalitySummary: surveyAnalysis.personality_summary,
          updatedAt: new Date(),
        },
      })

      console.log('Consciousness profile saved with ID:', consciousnessProfile.id)

      // 4. Create dual chart system
      console.log('Creating dual chart system...')
      const dualChartSystem = await createDualChartSystem(birthInfo, horoscopeData)

      // 5. Initialize consciousness state (enhanced personality)
      console.log('Initializing consciousness state...')
      const consciousnessState = await initializeConsciousnessState(
        surveyAnalysis,
        dualChartSystem,
        birthInfo
      )

      // 6. Generate unique personality ID
      const personalityId = `conscious-ai-${userId}-${Date.now()}`

      // 7. Create enhanced AI personality in database
      console.log('Creating enhanced AI personality...')
      const aiPersonality = await prisma.aIPersonality.create({
        data: {
          userId,
          personalityId,
          birthChartData: dualChartSystem.birthChart as any,
          currentMomentChart: dualChartSystem.currentChart as any,
          basePersonality: consciousnessState.enhanced_personality as any,
          trainingScores: generateEnhancedTrainingScores(
            surveyAnalysis,
            dualChartSystem.birthChart
          ) as any,
          totalXp: 0,
          level: 1,
          surveyId: survey.id,
          consciousnessProfileId: consciousnessProfile.id,
          updatedAt: new Date(),
        },
      })

      // 8. Save consciousness state
      await prisma.consciousnessState.create({
        data: {
          personalityId: aiPersonality.personalityId,
          unifiedArchetype: consciousnessState.unified_archetype,
          consciousnessSignature: consciousnessState.consciousness_signature,
          enhancedPersonality: consciousnessState.enhanced_personality as any,
          trainingPlan: consciousnessState.personalized_training_plan as any,
          behavioralMatrix: consciousnessState.ai_behavioral_matrix as any,
          growthTrajectory: consciousnessState.growth_trajectory as any,
          updatedAt: new Date(),
        },
      })

      console.log('Consciousness-enhanced AI created successfully!')

      // 9. Prepare response
      const aiConfig: PersonalizedAIConfig = {
        personalityId: aiPersonality.personalityId,
        userId: aiPersonality.userId,
        birthChart: aiPersonality.birthChartData as any,
        currentMomentChart: aiPersonality.currentMomentChart as any,
        basePersonality: aiPersonality.basePersonality as any,
        trainingScores: aiPersonality.trainingScores as any,
        totalXp: aiPersonality.totalXp,
        level: aiPersonality.level,
        achievements: [],
        createdAt: aiPersonality.createdAt.toISOString(),
        updatedAt: aiPersonality.updatedAt.toISOString(),
      }

      const response: CreatePersonalizedAIResponse = {
        success: true,
        aiConfig,
        message: `Successfully created consciousness-enhanced AI: ${consciousnessState.unified_archetype}`,
      }

      return NextResponse.json(
        {
          ...response,
          consciousnessInsights: {
            archetype: consciousnessState.unified_archetype,
            signature: consciousnessState.consciousness_signature,
            compatibilityScore: surveyAnalysis.compatibility_score,
            personalitySummary: surveyAnalysis.personality_summary,
            conversationStarters: surveyAnalysis.initial_conversation_starters,
            trainingFocus: surveyAnalysis.recommended_training_focus,
          },
        },
        { status: 201 }
      )
    } catch (dbError) {
      console.error('Database error:', dbError)

      if ((dbError as any).code === 'P2002') {
        return NextResponse.json(
          { success: false, message: 'A consciousness profile already exists for this user' },
          { status: 409 }
        )
      }

      throw dbError
    }
  } catch (error) {
    console.error('Error processing consciousness survey:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process consciousness survey',
      },
      { status: 500 }
    )
  }
}

/**
 * Generate enhanced training scores that incorporate both survey and astrological data
 */
function generateEnhancedTrainingScores(surveyAnalysis: any, birthChart: any): any {
  const surveyProfile = surveyAnalysis.profile

  // Start with consciousness-based scores
  const enhancedScores = {
    communication_style: Math.min(75, 30 + surveyProfile.communication.directness * 0.45),
    knowledge_depth: Math.min(
      75,
      25 +
        (surveyProfile.learning.depth_breadth < 40 ? 35 : 15) +
        surveyProfile.meta_cognition.self_awareness * 0.15
    ),
    emotional_intelligence: Math.min(
      75,
      20 + surveyProfile.meta_cognition.emotional_intelligence * 0.55
    ),
    creativity: Math.min(75, 25 + surveyProfile.creativity.artistic_logical * 0.5),
    memory_integration: Math.min(75, 30 + surveyProfile.meta_cognition.reflection_tendency * 0.45),
    personality_alignment: 50, // Always starts at 50%, grows with interaction
  }

  // Apply astrological modifiers (small but meaningful adjustments)
  const mercurySign = birthChart.planets?.Mercury?.sign
  const moonSign = birthChart.planets?.Moon?.sign

  if (mercurySign === 'Gemini' || mercurySign === 'Virgo') {
    enhancedScores.communication_style = Math.min(80, enhancedScores.communication_style + 5)
  }

  if (moonSign === 'Cancer' || moonSign === 'Pisces') {
    enhancedScores.emotional_intelligence = Math.min(80, enhancedScores.emotional_intelligence + 5)
  }

  return enhancedScores
}

// GET /api/consciousness-survey/[userId] - Retrieve user's consciousness data
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userId = url.pathname.split('/').pop()

    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 })
    }

    // Fetch user's consciousness data
    const consciousnessProfile = await prisma.consciousnessProfile.findFirst({
      where: { userId },
      include: {
        ConsciousnessSurvey: true,
        AIPersonality: {
          include: {
            ConsciousnessState: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!consciousnessProfile) {
      return NextResponse.json(
        { success: false, message: 'No consciousness profile found for this user' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      consciousnessProfile: {
        id: consciousnessProfile.id,
        profileData: consciousnessProfile.profileData,
        insights: consciousnessProfile.insights,
        compatibilityScore: consciousnessProfile.compatibilityScore,
        personalitySummary: consciousnessProfile.personalitySummary,
        conversationStarters: consciousnessProfile.conversationStarters,
        trainingFocus: consciousnessProfile.trainingFocus,
        survey: consciousnessProfile.ConsciousnessSurvey,
        aiPersonalities: consciousnessProfile.AIPersonality,
      },
    })
  } catch (error) {
    console.error('Error fetching consciousness data:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch consciousness data',
      },
      { status: 500 }
    )
  }
}
