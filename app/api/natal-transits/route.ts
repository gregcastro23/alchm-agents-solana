import { NextRequest, NextResponse } from 'next/server'
import {
  calculateNatalTransitSignificance,
  findSignificantTransitDates,
} from '@/lib/degree-agent-mapping'
import type {
  NatalPlacement,
  NatalPlacementTransit,
  DegreeTransitSignificance,
} from '@/lib/degree-agent-mapping'

/**
 * Natal Transit Analysis API
 * =========================
 * Personalized transit analysis based on natal chart placements.
 * Identifies significant dates when the Sun transits degrees that
 * correspond to user's planetary positions.
 */

interface NatalTransitRequest {
  natalChart: NatalPlacement[]
  year?: number // Year to analyze (defaults to current year)
  dateRange?: { start: Date; end: Date }
  location?: { latitude: number; longitude: number }
  includeRecommendations?: boolean
}

interface NatalTransitResponse {
  success: boolean
  data?: {
    significantTransits: NatalPlacementTransit[]
    transitSignificance: DegreeTransitSignificance[]
    recommendations?: {
      upcomingTransits: string[]
      preparationActions: string[]
      consciousnessThemes: string[]
    }
  }
  error?: string
  metadata: {
    executionTime: number
    natalPlacementsAnalyzed: number
    yearAnalyzed: number
    transitsFound: number
    significantDates: number
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const requestData: NatalTransitRequest = await request.json()

    // Validate request
    if (!requestData.natalChart || requestData.natalChart.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Natal chart is required with at least one planetary placement',
          metadata: {
            executionTime: Date.now() - startTime,
            natalPlacementsAnalyzed: 0,
            yearAnalyzed: new Date().getFullYear(),
            transitsFound: 0,
            significantDates: 0,
          },
        } as NatalTransitResponse,
        { status: 400 }
      )
    }

    const location = requestData.location || { latitude: 37.7749, longitude: -122.4194 } // San Francisco default
    const year = requestData.year || new Date().getFullYear()

    let significantTransits: NatalPlacementTransit[] = []
    let transitSignificance: DegreeTransitSignificance[] = []

    // If date range is provided, analyze each day
    if (requestData.dateRange) {
      const currentDate = new Date(requestData.dateRange.start)
      while (currentDate <= requestData.dateRange.end) {
        const dayTransits = calculateNatalTransitSignificance(
          requestData.natalChart,
          currentDate,
          location
        )
        significantTransits.push(...dayTransits)
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      // Otherwise, find significant transit dates for the year
      transitSignificance = findSignificantTransitDates(requestData.natalChart, year, location)

      // Also calculate daily transits for the next 30 days for immediate insights
      const today = new Date()
      const nextMonth = new Date(today)
      nextMonth.setDate(today.getDate() + 30)

      const currentDate = new Date(today)
      while (currentDate <= nextMonth) {
        const dayTransits = calculateNatalTransitSignificance(
          requestData.natalChart,
          currentDate,
          location
        )
        significantTransits.push(...dayTransits)
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Sort and limit results
    significantTransits = significantTransits
      .sort((a, b) => b.significanceScore - a.significanceScore)
      .slice(0, 50)

    transitSignificance = transitSignificance
      .sort((a, b) => b.significanceScore - a.significanceScore)
      .slice(0, 20)

    const response: NatalTransitResponse = {
      success: true,
      data: {
        significantTransits,
        transitSignificance,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        natalPlacementsAnalyzed: requestData.natalChart.length,
        yearAnalyzed: year,
        transitsFound: significantTransits.length,
        significantDates: transitSignificance.length,
      },
    }

    // Add recommendations if requested
    if (requestData.includeRecommendations) {
      response.data!.recommendations = generateTransitRecommendations(
        significantTransits,
        transitSignificance
      )
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in natal transit analysis:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          executionTime: Date.now() - startTime,
          natalPlacementsAnalyzed: 0,
          yearAnalyzed: new Date().getFullYear(),
          transitsFound: 0,
          significantDates: 0,
        },
      } as NatalTransitResponse,
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'example-chart':
        return handleExampleChart()

      case 'degree-info':
        return handleDegreeInfo(searchParams)

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Supported actions: example-chart, degree-info',
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in natal transits GET:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

// Helper functions

function generateTransitRecommendations(
  transits: NatalPlacementTransit[],
  significance: DegreeTransitSignificance[]
): {
  upcomingTransits: string[]
  preparationActions: string[]
  consciousnessThemes: string[]
} {
  const upcomingTransits: string[] = []
  const preparationActions: string[] = []
  const consciousnessThemes: string[] = []

  // Get next 5 significant transits
  const upcoming = transits
    .filter(t => t.transitDate >= new Date())
    .sort((a, b) => a.transitDate.getTime() - b.transitDate.getTime())
    .slice(0, 5)

  for (const transit of upcoming) {
    upcomingTransits.push(
      `${transit.natalPlanet} transit on ${transit.transitDate.toLocaleDateString()}: ${transit.recommendedActions[0]}`
    )
  }

  // Generate preparation actions
  const uniquePlanets = [...new Set(transits.map(t => t.natalPlanet))]
  for (const planet of uniquePlanets) {
    preparationActions.push(
      `Prepare for ${planet} transits by focusing on ${getPlanetPreparation(planet)}`
    )
  }

  // Extract consciousness themes
  const allThemes = transits.flatMap(t => t.consciousnessThemes)
  const uniqueThemes = [...new Set(allThemes)].slice(0, 5)
  consciousnessThemes.push(...uniqueThemes)

  return {
    upcomingTransits,
    preparationActions,
    consciousnessThemes,
  }
}

function getPlanetPreparation(planet: string): string {
  const preparations: Record<string, string> = {
    Sun: 'personal expression and creative projects',
    Moon: 'emotional awareness and intuitive development',
    Mercury: 'communication and learning activities',
    Venus: 'relationships and artistic pursuits',
    Mars: 'physical activities and assertive actions',
    Jupiter: 'expansion and philosophical exploration',
    Saturn: 'structure and long-term planning',
    Uranus: 'innovation and community involvement',
    Neptune: 'spiritual practices and creative imagination',
    Pluto: 'transformation and deep psychological work',
  }

  return preparations[planet] || 'consciousness development'
}

async function handleExampleChart() {
  // Provide example natal chart for testing
  const exampleChart: NatalPlacement[] = [
    { planet: 'Sun', degree: 135 },
    { planet: 'Moon', degree: 210 },
    { planet: 'Mercury', degree: 120 },
    { planet: 'Venus', degree: 150 },
    { planet: 'Mars', degree: 75 },
    { planet: 'Jupiter', degree: 300 },
    { planet: 'Saturn', degree: 270 },
  ]

  return NextResponse.json({
    success: true,
    data: {
      natalChart: exampleChart,
      description: 'Example natal chart for testing transit analysis',
      note: 'This is a fictional chart for demonstration purposes',
    },
  })
}

async function handleDegreeInfo(searchParams: URLSearchParams) {
  const degreeStr = searchParams.get('degree')
  if (!degreeStr) {
    return NextResponse.json(
      { success: false, error: 'Degree parameter is required' },
      { status: 400 }
    )
  }

  const degree = parseInt(degreeStr)
  if (isNaN(degree) || degree < 0 || degree > 359) {
    return NextResponse.json(
      { success: false, error: 'Degree must be between 0 and 359' },
      { status: 400 }
    )
  }

  // Import the degree agent mapping function
  const { getDegreeAgents } = await import('@/lib/degree-agent-mapping')
  const mapping = getDegreeAgents(degree)

  return NextResponse.json({
    success: true,
    data: {
      degree,
      mapping,
      zodiacSign: getZodiacSign(degree),
      element: getElementForDegree(degree),
      modality: getModalityForDegree(degree),
    },
  })
}

function getZodiacSign(degree: number): string {
  const signs = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ]
  return signs[Math.floor(degree / 30)]
}

function getElementForDegree(degree: number): string {
  const elements = ['Fire', 'Earth', 'Air', 'Water']
  return elements[Math.floor(degree / 90) % 4]
}

function getModalityForDegree(degree: number): string {
  const modalities = ['Cardinal', 'Fixed', 'Mutable']
  return modalities[Math.floor((degree % 30) / 10)]
}
