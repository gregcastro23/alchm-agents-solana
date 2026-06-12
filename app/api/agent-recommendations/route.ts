import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DEMO_AGENTS } from '@/lib/demo-agents-data'

interface AgentRecommendation {
  agentId: string
  name: string
  compatibilityScore: number
  reasons: string[]
  evolutionPotential: number
  elementalAlignment: number
}

/**
 * Calculate agent compatibility based on birth chart data
 */
function calculateAgentCompatibility(birthChart: any, agent: any): AgentRecommendation {
  let compatibilityScore = 0.5 // Base score
  const reasons: string[] = []

  // Birth month elemental affinity
  const birthMonth = birthChart.month
  const elementByMonth = {
    1: 'Earth',
    2: 'Air',
    3: 'Water',
    4: 'Fire',
    5: 'Earth',
    6: 'Air',
    7: 'Water',
    8: 'Fire',
    9: 'Earth',
    10: 'Air',
    11: 'Water',
    12: 'Fire',
  }
  const userElement = elementByMonth[birthMonth as keyof typeof elementByMonth] || 'Air'

  // Agent elemental alignment
  if (agent.consciousness?.elements) {
    const agentElements = agent.consciousness.elements
    const dominantElement = Object.entries(agentElements).sort(
      ([, a], [, b]) => (b as number) - (a as number)
    )[0][0]

    if (dominantElement === userElement) {
      compatibilityScore += 0.3
      reasons.push(`Strong ${userElement} elemental alignment`)
    } else if (isComplementaryElement(userElement, dominantElement)) {
      compatibilityScore += 0.2
      reasons.push(`Complementary ${userElement}-${dominantElement} energy`)
    }
  }

  // Birth hour and agent preferences
  const birthHour = birthChart.hour || 12
  if (birthHour >= 6 && birthHour < 18) {
    // Diurnal birth - prefer solar/active agents
    if (
      agent.abilities?.specialty?.includes('wisdom') ||
      agent.abilities?.specialty?.includes('innovation')
    ) {
      compatibilityScore += 0.15
      reasons.push('Diurnal compatibility with active consciousness')
    }
  } else {
    // Nocturnal birth - prefer lunar/receptive agents
    if (
      agent.abilities?.specialty?.includes('intuition') ||
      agent.abilities?.specialty?.includes('mystical')
    ) {
      compatibilityScore += 0.15
      reasons.push('Nocturnal compatibility with receptive consciousness')
    }
  }

  // Geographic/cultural resonance
  if (birthChart.latitude && birthChart.longitude) {
    const userLatitude = Math.abs(birthChart.latitude)

    // Northern hemisphere preference for certain agents
    if (userLatitude > 23.5 && agent.id.includes('leonardo')) {
      compatibilityScore += 0.1
      reasons.push('Northern hemisphere Renaissance resonance')
    }

    // Tropical regions and mystical agents
    if (userLatitude < 23.5 && (agent.id.includes('cleopatra') || agent.id.includes('rumi'))) {
      compatibilityScore += 0.1
      reasons.push('Tropical mystical consciousness alignment')
    }
  }

  // Consciousness evolution potential
  const evolutionPotential = calculateEvolutionPotential(birthChart, agent)
  compatibilityScore += evolutionPotential * 0.2

  // Kinetic profile alignment
  const elementalAlignment = calculateElementalAlignment(birthChart, agent)

  // Cap at 1.0 and ensure minimum of 0.1
  compatibilityScore = Math.max(0.1, Math.min(1.0, compatibilityScore))

  return {
    agentId: agent.id,
    name: agent.name,
    compatibilityScore,
    reasons,
    evolutionPotential,
    elementalAlignment,
  }
}

function isComplementaryElement(element1: string, element2: string): boolean {
  const complementary = {
    Fire: ['Air'],
    Water: ['Earth'],
    Air: ['Fire'],
    Earth: ['Water'],
  }
  return complementary[element1 as keyof typeof complementary]?.includes(element2) || false
}

function calculateEvolutionPotential(_birthChart: any, agent: any): number {
  // Higher potential for agents with diverse elemental profiles
  if (agent.consciousness?.elements) {
    const elements = Object.values(agent.consciousness.elements) as number[]
    const variance = elements.reduce((sum, val) => sum + Math.pow(val - 0.25, 2), 0) / 4
    return Math.min(1.0, variance * 2) // Normalize to 0-1
  }
  return 0.5
}

function calculateElementalAlignment(birthChart: any, _agent: any): number {
  // Simplified alignment calculation
  const birthMonth = birthChart.month
  const seasonalBonus = [0.8, 0.9, 1.0, 1.0, 0.9, 0.8, 0.7, 0.8, 0.9, 1.0, 0.9, 0.8]
  return seasonalBonus[birthMonth - 1] || 0.8
}

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || 'anonymous'

    // Get user's birth chart data
    const userProfile = await prisma.profiles.findUnique({
      where: { userId },
    })

    if (!userProfile?.birthInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Birth chart data required for recommendations',
          message:
            'Please complete your birth chart information to get personalized agent recommendations',
        },
        { status: 400 }
      )
    }

    const birthChart =
      typeof userProfile.birthInfo === 'string'
        ? JSON.parse(userProfile.birthInfo)
        : userProfile.birthInfo

    // Calculate recommendations for all available agents
    const recommendations: AgentRecommendation[] = []

    for (const agent of DEMO_AGENTS) {
      const recommendation = calculateAgentCompatibility(birthChart, agent)
      recommendations.push(recommendation)
    }

    // Sort by compatibility score
    recommendations.sort((a, b) => b.compatibilityScore - a.compatibilityScore)

    // Get top 5 recommendations
    const topRecommendations = recommendations.slice(0, 5)

    // Get evolution states for recommended agents
    const evolutionStates = await prisma.agent_evolution_states.findMany({
      where: {
        userId,
        agentId: { in: topRecommendations.map(r => r.agentId) },
      },
    })

    // Enhance recommendations with evolution data
    const enhancedRecommendations = topRecommendations.map(rec => {
      const evolutionState = evolutionStates.find(state => state.agentId === rec.agentId)
      return {
        ...rec,
        currentLevel: evolutionState?.currentLevel || 'bronze',
        totalPower: evolutionState?.totalPower || 0,
        interactionCount: evolutionState?.interactionCount || 0,
        lastInteraction: evolutionState?.lastInteraction || null,
      }
    })

    return NextResponse.json({
      success: true,
      recommendations: enhancedRecommendations,
      userProfile: {
        birthChart,
        totalAgentsAvailable: DEMO_AGENTS.length,
        recommendationsGenerated: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Agent recommendations error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate agent recommendations',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || 'anonymous'
    const { action, agentId, feedback } = await req.json()

    if (action === 'feedback') {
      // Store user feedback on recommendations for ML improvement
      // For now, just log it
      console.log(`User ${userId} feedback on agent ${agentId}:`, feedback)

      return NextResponse.json({
        success: true,
        message: 'Feedback recorded for recommendation improvement',
      })
    }

    if (action === 'refresh') {
      // Force refresh recommendations (clear any caching)
      return await GET(req)
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Agent recommendations POST error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process recommendation request',
      },
      { status: 500 }
    )
  }
}
