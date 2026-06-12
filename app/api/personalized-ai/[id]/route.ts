// GET /api/personalized-ai/[id] - Retrieve AI configuration

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateLevel } from '@/lib/personalized-ai/level-system'
import type { PersonalizedAIConfig } from '@/lib/types/personalized-ai'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const personalityId = resolvedParams.id

    if (!personalityId) {
      return NextResponse.json(
        { success: false, message: 'Personality ID is required' },
        { status: 400 }
      )
    }

    // Fetch from database
    const aiPersonality = await prisma.aIPersonality.findUnique({
      where: { personalityId },
      include: {
        Achievement: true,
      },
    })

    if (!aiPersonality) {
      return NextResponse.json(
        { success: false, message: 'AI personality not found' },
        { status: 404 }
      )
    }

    // Prepare response
    const aiConfig: PersonalizedAIConfig = {
      personalityId: aiPersonality.personalityId,
      userId: aiPersonality.userId,
      birthChart: aiPersonality.birthChartData as any,
      currentMomentChart: aiPersonality.currentMomentChart as any,
      basePersonality: aiPersonality.basePersonality as any,
      trainingScores: aiPersonality.trainingScores as any,
      totalXp: aiPersonality.totalXp,
      level: calculateLevel(aiPersonality.totalXp),
      achievements: aiPersonality.Achievement.map((a: any) => ({
        id: a.id,
        personalityId: a.personalityId,
        achievementType: a.achievementType as any,
        achievementData: a.achievementData as any,
      })),
      createdAt: aiPersonality.createdAt.toISOString(),
      updatedAt: aiPersonality.updatedAt.toISOString(),
    }

    return NextResponse.json({
      success: true,
      aiConfig,
    })
  } catch (error) {
    console.error('Error fetching personalized AI:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch AI personality',
      },
      { status: 500 }
    )
  }
}

// PUT /api/personalized-ai/[id] - Update AI configuration
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const personalityId = resolvedParams.id
    const body = await request.json()

    // Update in database
    const updated = await prisma.aIPersonality.update({
      where: { personalityId },
      data: {
        ...(body.trainingScores && { trainingScores: body.trainingScores as any }),
        ...(body.totalXp !== undefined && {
          totalXp: body.totalXp,
          level: calculateLevel(body.totalXp),
        }),
        ...(body.currentMomentChart && { currentMomentChart: body.currentMomentChart as any }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'AI personality updated successfully',
    })
  } catch (error) {
    console.error('Error updating personalized AI:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update AI personality',
      },
      { status: 500 }
    )
  }
}
