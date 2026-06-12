import { NextResponse } from 'next/server'
import { CharacterVectorCalculator } from '@/lib/astrological-character-vectors'
import { generateSignVectorRune, generateAgentCharacterRune } from '@/lib/runes/sign-vector-runes'
import { DEMO_AGENTS } from '@/lib/demo-agents-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ChartInput {
  name?: string
  birthDate?: string
  birthTime?: string
  birthLocation?: string
  natalChart?: any
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { charts, action = 'calculate', agentId } = body

    switch (action) {
      case 'calculate':
        return calculateSignVectors(charts)

      case 'generate-rune':
        return generateRuneFromCharts(charts)

      case 'agent-rune':
        return generateAgentRune(agentId)

      case 'collective-rune':
        return generateCollectiveRune(charts)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Sign vectors API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process sign vectors',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const action = searchParams.get('action') || 'agent-vectors'

    if (action === 'agent-vectors' && agentId) {
      return getAgentSignVectors(agentId)
    }

    if (action === 'all-agents') {
      return getAllAgentSignVectors()
    }

    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 })
  } catch (error) {
    console.error('Sign vectors GET API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get sign vectors',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate sign vectors from chart data
 */
async function calculateSignVectors(charts: ChartInput[]) {
  const results = []

  for (const chart of charts) {
    try {
      const placements = extractPlacements(chart)

      if (placements.length === 0) {
        results.push({
          name: chart.name || 'Unknown',
          error: 'No valid planetary placements found',
          signVector: null,
          chartProfile: null,
        })
        continue
      }

      const signVector = CharacterVectorCalculator.calculateSignVectors(placements)
      const chartProfile = CharacterVectorCalculator.generateChartCharacterProfile(placements)

      results.push({
        name: chart.name || 'Unknown',
        signVector,
        chartProfile,
        placements: placements.length,
      })
    } catch (error) {
      results.push({
        name: chart.name || 'Unknown',
        error: error instanceof Error ? error.message : 'Calculation failed',
        signVector: null,
        chartProfile: null,
      })
    }
  }

  return NextResponse.json({
    success: true,
    results,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Generate sign vector rune from chart data
 */
async function generateRuneFromCharts(charts: ChartInput[]) {
  if (!charts || charts.length === 0) {
    return NextResponse.json({ error: 'No charts provided' }, { status: 400 })
  }

  try {
    const chart = charts[0] // Use first chart for single rune generation
    const placements = extractPlacements(chart)

    if (placements.length === 0) {
      return NextResponse.json({ error: 'No valid planetary placements found' }, { status: 400 })
    }

    const chartProfile = CharacterVectorCalculator.generateChartCharacterProfile(placements)
    const rune = generateSignVectorRune(chartProfile, 'character')

    return NextResponse.json({
      success: true,
      rune,
      chartProfile,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate rune',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Generate agent character rune
 */
async function generateAgentRune(agentId: string) {
  try {
    const agent = DEMO_AGENTS.find(a => a.id === agentId)

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const rune = generateAgentCharacterRune(agent)

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        title: agent.title,
      },
      rune,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate agent rune',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Generate collective rune from multiple agents
 */
async function generateCollectiveRune(charts: any[]) {
  try {
    if (!charts || charts.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 charts required for collective rune' },
        { status: 400 }
      )
    }

    // If charts contain agent IDs, fetch agent data
    const agents = []
    for (const chart of charts) {
      if (chart.agentId) {
        const agent = DEMO_AGENTS.find(a => a.id === chart.agentId)
        if (agent) agents.push(agent)
      }
    }

    if (agents.length === 0) {
      return NextResponse.json({ error: 'No valid agents found' }, { status: 400 })
    }

    const { generateCollectiveAgentRune } = await import('@/lib/runes/sign-vector-runes')
    const rune = generateCollectiveAgentRune(agents)

    return NextResponse.json({
      success: true,
      agents: agents.map(a => ({ id: a.id, name: a.name, title: a.title })),
      rune,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate collective rune',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Get sign vectors for a specific agent
 */
async function getAgentSignVectors(agentId: string) {
  try {
    const agent = DEMO_AGENTS.find(a => a.id === agentId)

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const placements = extractPlacements({ natalChart: agent.consciousness?.natalChart })

    if (placements.length === 0) {
      return NextResponse.json(
        { error: 'No valid natal chart data found for agent' },
        { status: 400 }
      )
    }

    const signVector = CharacterVectorCalculator.calculateSignVectors(placements)
    const chartProfile = CharacterVectorCalculator.generateChartCharacterProfile(placements)

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        title: agent.title,
        monicaConstant: agent.consciousness?.monicaConstant,
      },
      signVector,
      chartProfile,
      placements: placements.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get agent sign vectors',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Get sign vectors for all agents (cached/optimized)
 */
async function getAllAgentSignVectors() {
  try {
    const results = []

    for (const agent of DEMO_AGENTS) {
      try {
        const placements = extractPlacements({ natalChart: agent.consciousness?.natalChart })

        if (placements.length === 0) {
          results.push({
            agent: { id: agent.id, name: agent.name, title: agent.title },
            error: 'No valid natal chart data',
            signVector: null,
            dominantSigns: [],
          })
          continue
        }

        const signVector = CharacterVectorCalculator.calculateSignVectors(placements)
        const chartProfile = CharacterVectorCalculator.generateChartCharacterProfile(placements)

        results.push({
          agent: {
            id: agent.id,
            name: agent.name,
            title: agent.title,
            monicaConstant: agent.consciousness?.monicaConstant,
          },
          signVector,
          dominantSigns: chartProfile.dominant_signs,
          elementalDistribution: chartProfile.elemental_distribution,
          placements: placements.length,
        })
      } catch (error) {
        results.push({
          agent: { id: agent.id, name: agent.name, title: agent.title },
          error: error instanceof Error ? error.message : 'Calculation failed',
          signVector: null,
          dominantSigns: [],
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalAgents: DEMO_AGENTS.length,
      successfulCalculations: results.filter(r => r.signVector !== null).length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to calculate all agent sign vectors',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * Extract planetary placements from various chart formats
 */
function extractPlacements(
  chart: ChartInput
): Array<{ planet: string; sign: string; dignity?: string }> {
  const placements = []

  // Handle direct natal chart data
  if (chart.natalChart) {
    const natalChart = chart.natalChart

    // Handle both formats: planets object and direct properties
    const planets = natalChart.planets || natalChart

    const planetList = [
      'sun',
      'moon',
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
    ]

    for (const planet of planetList) {
      const planetData =
        planets[planet] || planets[planet.charAt(0).toUpperCase() + planet.slice(1)]

      if (planetData && planetData.sign) {
        placements.push({
          planet,
          sign: planetData.sign,
          dignity: planetData.dignity,
        })
      }
    }

    // Handle ascendant
    if (planets.ascendant && planets.ascendant.sign) {
      placements.push({
        planet: 'ascendant',
        sign: planets.ascendant.sign,
      })
    }
  }

  // Handle other chart formats (birth data -> ephemeris calculation)
  // This could be extended to calculate positions from birth data

  return placements
}
