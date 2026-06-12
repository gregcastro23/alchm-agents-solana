/**
 * Personalized Planetary Transits API (CORRECTED)
 * ================================================
 *
 * Calculate personalized transit significances using PLANETARY AGENTS
 * (Mars in Aries, Venus in Libra, etc.) based on actual astrological principles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import {
  calculatePlanetaryTransitSignificance,
  calculatePlanetaryTransitsForDateRange,
  type DetailedPlanetaryTransitSignificance,
  type NatalPlacement,
  type UserConsciousnessProfile,
} from '@/lib/services/planetary-transit-significance-scorer'
import { getNatalChart, incrementAnalysisCount } from '@/lib/services/natal-chart-storage'

const prisma = new PrismaClient()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/personalized-planetary-transits
 * Calculate planetary agent transit significances for a date range
 */
export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    // Validate required fields
    if (!body.userId || !body.chartId) {
      return NextResponse.json({ error: 'userId and chartId are required' }, { status: 400 })
    }

    // Validate input parameters before database lookup
    if (body.significanceThreshold !== undefined) {
      const sigThreshold = Number(body.significanceThreshold)
      if (isNaN(sigThreshold) || sigThreshold < 0 || sigThreshold > 1) {
        return NextResponse.json(
          { error: 'significanceThreshold must be a number between 0 and 1' },
          { status: 400 }
        )
      }
    }

    if (body.orbTolerance !== undefined) {
      const orb = Number(body.orbTolerance)
      if (isNaN(orb) || orb < 0.1 || orb > 15) {
        return NextResponse.json(
          { error: 'orbTolerance must be a number between 0.1 and 15 degrees' },
          { status: 400 }
        )
      }
    }

    if (body.transitingPlanet !== undefined) {
      const validPlanets = [
        'Sun',
        'Moon',
        'Mercury',
        'Venus',
        'Mars',
        'Jupiter',
        'Saturn',
        'Uranus',
        'Neptune',
        'Pluto',
      ]
      if (!validPlanets.includes(body.transitingPlanet)) {
        return NextResponse.json(
          { error: `transitingPlanet must be one of: ${validPlanets.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate date range before database lookup
    if (body.startDate !== undefined) {
      const startDate = new Date(body.startDate)
      if (isNaN(startDate.getTime())) {
        return NextResponse.json({ error: 'startDate must be a valid date' }, { status: 400 })
      }
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      if (startDate < oneDayAgo) {
        return NextResponse.json(
          { error: 'Start date cannot be more than 1 day in the past' },
          { status: 400 }
        )
      }
    }

    if (body.endDate !== undefined) {
      const endDate = new Date(body.endDate)
      if (isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'endDate must be a valid date' }, { status: 400 })
      }
      const startDate = body.startDate ? new Date(body.startDate) : new Date()
      const maxRange = 365 * 24 * 60 * 60 * 1000 // 1 year
      if (endDate.getTime() - startDate.getTime() > maxRange) {
        return NextResponse.json({ error: 'Date range cannot exceed 1 year' }, { status: 400 })
      }
    }

    // Get natal chart
    const chart = await getNatalChart(body.chartId, body.userId)

    if (!chart) {
      return NextResponse.json({ error: 'Natal chart not found' }, { status: 404 })
    }

    // Parse and validate date range (default to next 30 days)
    let startDate: Date
    let endDate: Date

    try {
      startDate = body.startDate ? new Date(body.startDate) : new Date()
      endDate = body.endDate
        ? new Date(body.endDate)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)

      // Validate dates are not invalid
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format provided' }, { status: 400 })
      }

      // Validate date range is reasonable (not more than 1 year)
      const maxRange = 365 * 24 * 60 * 60 * 1000 // 1 year
      if (endDate.getTime() - startDate.getTime() > maxRange) {
        return NextResponse.json({ error: 'Date range cannot exceed 1 year' }, { status: 400 })
      }

      // Validate start date is not in the past (more than 1 day ago)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      if (startDate < oneDayAgo) {
        return NextResponse.json(
          { error: 'Start date cannot be more than 1 day in the past' },
          { status: 400 }
        )
      }
    } catch (dateError) {
      return NextResponse.json({ error: 'Error parsing dates' }, { status: 400 })
    }

    // Validate significance threshold
    const significanceThreshold =
      body.significanceThreshold !== undefined
        ? Number(body.significanceThreshold)
        : chart.preferences?.notificationThreshold || 0.5

    if (isNaN(significanceThreshold) || significanceThreshold < 0 || significanceThreshold > 1) {
      return NextResponse.json(
        { error: 'significanceThreshold must be a number between 0 and 1' },
        { status: 400 }
      )
    }

    // Validate transiting planet
    const validPlanets = [
      'Sun',
      'Moon',
      'Mercury',
      'Venus',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
      'Pluto',
    ]
    const transitingPlanet = body.transitingPlanet || 'Sun'

    if (!validPlanets.includes(transitingPlanet)) {
      return NextResponse.json(
        { error: `transitingPlanet must be one of: ${validPlanets.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate orb tolerance
    const orbTolerance = body.orbTolerance !== undefined ? Number(body.orbTolerance) : 5

    if (isNaN(orbTolerance) || orbTolerance < 0.1 || orbTolerance > 15) {
      return NextResponse.json(
        { error: 'orbTolerance must be a number between 0.1 and 15 degrees' },
        { status: 400 }
      )
    }

    // Build user consciousness profile
    const userProfile: UserConsciousnessProfile = {
      dominantElement: chart.dominantElement,
      monicaConstant: chart.monicaConstant,
      spiritScore: chart.spiritScore,
      essenceScore: chart.essenceScore,
      matterScore: chart.matterScore,
      substanceScore: chart.substanceScore,
    }

    // Convert natal chart planets to NatalPlacement format with validation
    let natalPlacements: NatalPlacement[]
    try {
      if (!Array.isArray(chart.planets)) {
        return NextResponse.json(
          { error: 'Invalid natal chart data: planets must be an array' },
          { status: 500 }
        )
      }

      natalPlacements = chart.planets.map((p: any) => {
        if (!p.sign) {
          throw new Error('Planet missing sign information')
        }
        return {
          planet: p.name || p.label || p.planet,
          degree: Number(p.degree) || Number(p.longitude) || 0,
          sign: p.sign,
          house: p.house || p.House?.label,
          element: getElementForSign(p.sign),
        }
      })

      if (natalPlacements.length === 0) {
        return NextResponse.json(
          { error: 'No valid planetary positions found in natal chart' },
          { status: 500 }
        )
      }
    } catch (conversionError) {
      console.error('Error converting natal chart data:', conversionError)
      return NextResponse.json({ error: 'Error processing natal chart data' }, { status: 500 })
    }

    // Calculate transits for date range with error handling
    let allSignificances
    try {
      allSignificances = calculatePlanetaryTransitsForDateRange(
        natalPlacements,
        startDate,
        endDate,
        userProfile,
        {
          transitingPlanet,
          significanceThreshold,
          orbTolerance,
        }
      )

      if (!Array.isArray(allSignificances)) {
        throw new Error('Transit calculation returned invalid data')
      }
    } catch (calculationError) {
      console.error('Error calculating planetary transits:', calculationError)
      return NextResponse.json(
        {
          error: 'Error calculating planetary transits',
          details:
            calculationError instanceof Error
              ? calculationError.message
              : 'Unknown calculation error',
        },
        { status: 500 }
      )
    }

    // Increment chart analysis count
    await incrementAnalysisCount(body.chartId)

    // Group significances by priority
    const criticalTransits = allSignificances.filter(s => s.overallScore >= 0.8)
    const highTransits = allSignificances.filter(s => s.overallScore >= 0.6 && s.overallScore < 0.8)
    const mediumTransits = allSignificances.filter(
      s => s.overallScore >= 0.5 && s.overallScore < 0.6
    )

    // Calculate insights
    const insights = calculateTransitInsights(allSignificances, natalPlacements)

    return NextResponse.json({
      success: true,
      chart: {
        id: chart.id,
        name: chart.chartName,
        dominantElement: chart.dominantElement,
        monicaConstant: chart.monicaConstant,
      },
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        daysAnalyzed: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      transitingPlanet,
      summary: {
        totalSignificantTransits: allSignificances.length,
        criticalTransits: criticalTransits.length,
        highTransits: highTransits.length,
        mediumTransits: mediumTransits.length,
        threshold: significanceThreshold,
        orbTolerance,
      },
      transits: {
        critical: formatTransitsForResponse(criticalTransits),
        high: formatTransitsForResponse(highTransits.slice(0, 20)), // Top 20
        medium: formatTransitsForResponse(mediumTransits.slice(0, 10)), // Top 10
        all: body.includeAllTransits ? formatTransitsForResponse(allSignificances) : undefined,
      },
      insights,
    })
  } catch (error) {
    console.error('Error calculating personalized planetary transits:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate personalized planetary transits',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/personalized-planetary-transits
 * Get upcoming significant transits for user's primary chart
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    // Get user's primary chart
    const chart = await prisma.user_natal_charts.findFirst({
      where: {
        userId,
        isPrimary: true,
        isActive: true,
      },
    })

    if (!chart) {
      return NextResponse.json(
        { error: 'No primary natal chart found for this user' },
        { status: 404 }
      )
    }

    // Use POST logic with default parameters
    return POST(
      new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          chartId: chart.id,
        }),
      })
    )
  } catch (error) {
    console.error('Error fetching personalized planetary transits:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch personalized planetary transits',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Helper functions

function getElementForSign(sign: string): string {
  const elementMap: Record<string, string> = {
    Aries: 'Fire',
    Taurus: 'Earth',
    Gemini: 'Air',
    Cancer: 'Water',
    Leo: 'Fire',
    Virgo: 'Earth',
    Libra: 'Air',
    Scorpio: 'Water',
    Sagittarius: 'Fire',
    Capricorn: 'Earth',
    Aquarius: 'Air',
    Pisces: 'Water',
  }
  return elementMap[sign] || 'Fire'
}

function formatTransitsForResponse(transits: DetailedPlanetaryTransitSignificance[]) {
  return transits.map(t => ({
    transitDate: t.transitDate,
    transitDegree: t.transitDegree,
    transitingPlanet: t.transitingPlanet,
    natalPlanet: t.natalPlanet,
    natalDegree: t.natalDegree,
    natalSign: t.natalSign,
    natalHouse: t.natalHouse,
    aspectType: t.aspectType,
    aspectOrb: t.aspectOrb,

    // Planetary agent information (THE KEY DIFFERENCE)
    planetaryAgent: {
      ruler: t.planetaryAgent.ruler,
      sign: t.planetaryAgent.sign,
      dignity: t.planetaryAgent.dignity,
      element: t.planetaryAgent.element,
      modality: t.planetaryAgent.modality,
      consciousnessLevel: t.planetaryAgent.consciousnessLevel,
      powerLevel: t.planetaryAgent.powerLevel,
    },

    // Scores
    overallScore: t.overallScore,
    scores: {
      dignityScore: t.scores.dignityScore,
      elementalHarmonyScore: t.scores.elementalHarmonyScore,
      aspectQualityScore: t.scores.aspectQualityScore,
      personalRelevanceScore: t.scores.personalRelevanceScore,
    },

    // Elemental harmony
    elementalHarmony: t.elementalHarmony,

    // Interpretation (astrological)
    interpretation: {
      transitThemes: t.interpretation.transitThemes,
      dignityInterpretation: t.interpretation.dignityInterpretation,
      elementalInterpretation: t.interpretation.elementalInterpretation,
      consciousnessThemes: t.interpretation.consciousnessThemes,
    },

    // Recommendations
    recommendedActions: t.recommendedActions,
    recommendedQueries: t.recommendedQueries,
    consciousnessWork: t.consciousnessWork,

    // Activation strength
    activationStrength: t.activatedAgent.activationStrength,
  }))
}

function calculateTransitInsights(
  significances: DetailedPlanetaryTransitSignificance[],
  natalPlacements: NatalPlacement[]
) {
  // Most activated placements
  const placementCounts: Record<string, number> = {}
  significances.forEach(s => {
    const key = `${s.natalPlanet} ${s.natalSign}`
    placementCounts[key] = (placementCounts[key] || 0) + 1
  })
  const mostActivePlacements = Object.entries(placementCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([placement, count]) => ({ placement, count }))

  // Dominant planetary rulers activated
  const rulerCounts: Record<string, number> = {}
  significances.forEach(s => {
    const ruler = s.planetaryAgent.ruler
    rulerCounts[ruler] = (rulerCounts[ruler] || 0) + 1
  })
  const dominantPlanetaryRulers = Object.entries(rulerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ruler, count]) => ({ ruler, count, description: getPlanetDescription(ruler) }))

  // Peak transit dates
  const dateCounts: Record<string, number> = {}
  significances.forEach(s => {
    const dateKey = s.transitDate.toISOString().split('T')[0]
    dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1
  })
  const peakTransitDates = Object.entries(dateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([date, transitCount]) => ({ date, transitCount }))

  // Elemental breakdown
  const elementCounts = { Fire: 0, Water: 0, Air: 0, Earth: 0 }
  significances.forEach(s => {
    const element = s.planetaryAgent.element as 'Fire' | 'Water' | 'Air' | 'Earth'
    elementCounts[element]++
  })
  const total = significances.length
  const elementalBreakdown = {
    counts: elementCounts,
    percentages: {
      Fire: total > 0 ? (elementCounts.Fire / total) * 100 : 0,
      Water: total > 0 ? (elementCounts.Water / total) * 100 : 0,
      Air: total > 0 ? (elementCounts.Air / total) * 100 : 0,
      Earth: total > 0 ? (elementCounts.Earth / total) * 100 : 0,
    },
  }

  // Dignity distribution
  const dignityCount: Record<string, number> = {}
  significances.forEach(s => {
    const dignity = s.planetaryAgent.dignity
    dignityCount[dignity] = (dignityCount[dignity] || 0) + 1
  })

  // Consciousness levels activated
  const consciousnessLevels: Record<string, number> = {}
  significances.forEach(s => {
    const level = s.planetaryAgent.consciousnessLevel
    consciousnessLevels[level] = (consciousnessLevels[level] || 0) + 1
  })

  return {
    mostActivePlacements,
    dominantPlanetaryRulers,
    peakTransitDates,
    elementalBreakdown,
    dignityDistribution: dignityCount,
    consciousnessLevelsActivated: consciousnessLevels,
    averageSignificance:
      total > 0 ? significances.reduce((sum, s) => sum + s.overallScore, 0) / total : 0,
    highestSignificanceTransit: significances[0]
      ? {
          date: significances[0].transitDate,
          ruler: significances[0].planetaryAgent.ruler,
          sign: significances[0].planetaryAgent.sign,
          natalPlanet: significances[0].natalPlanet,
          score: significances[0].overallScore,
        }
      : null,
  }
}

function getPlanetDescription(planet: string): string {
  const descriptions: Record<string, string> = {
    Sun: 'Core identity, vitality, life purpose',
    Moon: 'Emotions, instincts, nurturing, home',
    Mercury: 'Communication, intellect, learning, connection',
    Venus: 'Love, beauty, values, harmony, pleasure',
    Mars: 'Action, desire, courage, assertion, energy',
    Jupiter: 'Expansion, growth, wisdom, opportunity',
    Saturn: 'Structure, discipline, responsibility, mastery',
    Uranus: 'Innovation, revolution, breakthrough, freedom',
    Neptune: 'Spirituality, dreams, compassion, transcendence',
    Pluto: 'Transformation, power, regeneration, depth',
  }
  return descriptions[planet] || planet
}
