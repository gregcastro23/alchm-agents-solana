// POST /api/personalized-ai - Create a new AI consciousness mirror

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createDualChartSystem } from '@/lib/personalized-ai/dual-chart'
import {
  generateBasePersonality,
  generateInitialTrainingScores,
} from '@/lib/personalized-ai/personality-generator'
import { calculateLevel } from '@/lib/personalized-ai/level-system'
import type {
  CreatePersonalizedAIRequest,
  CreatePersonalizedAIResponse,
  PersonalizedAIConfig,
} from '@/lib/types/personalized-ai'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}) as any)
    // New lightweight builder path: if answers/styleCards provided, return config skeleton quickly
    if (body.answers && body.styleCards && !body.birthInfo) {
      const config = {
        personality: {
          tone: body.answers.tone,
          depth: body.answers.depth,
          interests: body.answers.interests || [],
        },
        tone: body.answers.tone,
        tools: ['tarot', 'alchm'],
        safety: { piiRedaction: true, injectionGuards: true },
        trainingNotes: ['progressive profiling', 'micro-questions<=1'],
        promptVersion: 'v7',
      }
      return NextResponse.json({
        config,
        previewSessionId: `preview-${Date.now()}`,
        shareLink: `/personalized-ai/${randomUUID()}`,
      })
    }

    // Legacy full creation path preserved
    const bodyFull: CreatePersonalizedAIRequest = body
    if (!bodyFull.birthInfo || !bodyFull.userId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: birthInfo and userId' },
        { status: 400 }
      )
    }
    const { birthInfo, userId, horoscopeData } = bodyFull
    if (!birthInfo.date || !birthInfo.time || !birthInfo.location || !birthInfo.name) {
      return NextResponse.json(
        { success: false, message: 'Birth info must include date, time, location, and name' },
        { status: 400 }
      )
    }

    // Generate unique personality ID
    const personalityId = `ai-${userId}-${Date.now()}`

    try {
      // Create dual chart system
      console.log('Creating dual chart system...')
      const dualChartSystem = await createDualChartSystem(birthInfo, horoscopeData)

      // Generate base personality
      console.log('Generating base personality...')
      const basePersonality = generateBasePersonality(dualChartSystem.birthChart)

      // Generate initial training scores
      console.log('Generating initial training scores...')
      const trainingScores = generateInitialTrainingScores(dualChartSystem.birthChart)

      // Create AI personality in database
      console.log('Saving to database...')
      const aiPersonality = await prisma.aIPersonality.create({
        data: {
          userId,
          personalityId,
          birthChartData: dualChartSystem.birthChart as any,
          currentMomentChart: dualChartSystem.currentChart as any,
          basePersonality: basePersonality as any,
          trainingScores: trainingScores as any,
          totalXp: 0,
          level: 1,
        },
      })

      // Prepare response config
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

      // Log success
      console.log(`Created AI personality: ${personalityId}`)

      // Return success response
      const response: CreatePersonalizedAIResponse = {
        success: true,
        aiConfig,
        message: `Successfully created AI consciousness mirror: ${basePersonality.archetype}`,
      }

      return NextResponse.json(response, { status: 201 })
    } catch (dbError) {
      console.error('Database error:', dbError)

      // Check if it's a unique constraint error
      if ((dbError as any).code === 'P2002') {
        return NextResponse.json(
          { success: false, message: 'An AI personality already exists for this user' },
          { status: 409 }
        )
      }

      throw dbError
    }
  } catch (error) {
    console.error('Error creating personalized AI:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create AI personality',
      },
      { status: 500 }
    )
  }
}
