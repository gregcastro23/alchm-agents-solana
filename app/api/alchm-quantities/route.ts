import { NextResponse } from 'next/server'
import { generateAlchmForCurrentMoment } from '@/lib/alchemizer'
import { logQuantitiesToGalileo, type AlchemicalMetrics } from '@/lib/galileo-logger'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
// CharacterVectorCalculator not used in this route
// import { CharacterVectorCalculator } from '@/lib/astrological-character-vectors'
import { generateRealTimeSignVectorRune } from '@/lib/runes/sign-vector-runes'
import { kinetics } from '@/lib/kinetics-integration'
import { calculateDynamicAspects } from '@/lib/dynamic-aspects-engine'
import type { PlanetPosition } from '@/lib/astrological-pattern-recognition'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    console.log('API: alchm-quantities endpoint called')

    // Create timeout promise (15 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Calculation timeout')), 15000)
    })

    // Generate alchemical data for the current moment with timeout
    const alchmData = (await Promise.race([
      generateAlchmForCurrentMoment(),
      timeoutPromise,
    ])) as Record<string, any>

    // Validate the response data
    if (!alchmData || typeof alchmData !== 'object') {
      console.error('API: Invalid alchm data format:', alchmData)
      return NextResponse.json(
        { error: 'Invalid data format returned from alchemizer' },
        { status: 500 }
      )
    }

    // Extract the specific Alchemy Effects that we want to return
    let quantities = {
      Spirit: alchmData?.['Alchemy Effects']?.['Total Spirit'] || 0,
      Essence: alchmData?.['Alchemy Effects']?.['Total Essence'] || 0,
      Matter: alchmData?.['Alchemy Effects']?.['Total Matter'] || 0,
      Substance: alchmData?.['Alchemy Effects']?.['Total Substance'] || 0,
      ANumber: alchmData?.['Alchemy Effects']?.['A #'] || 0,
      DayEssence: alchmData?.['Alchemy Effects']?.['Total Day Essence'] || 0,
      NightEssence: alchmData?.['Alchemy Effects']?.['Total Night Essence'] || 0,
    }

    // Get current planetary positions for additional context
    const planetaryPositions = getCurrentPlanetaryPositions()

    // Get kinetic modifiers from aspects
    let kineticModifiers = { velocityModifier: 1.0, powerModifier: 1.0 }
    let aspectAnalysis = null
    try {
      const location = { lat: 40.7128, lon: -74.006 } // Default location
      const enhanced = await kinetics.getEnhancedKinetics(location, {
        includeAgentOptimization: false,
        includePowerPrediction: false,
        includeResonanceMap: false,
      })

      // Build planet positions for aspect analysis
      const planets: PlanetPosition[] = Object.entries(planetaryPositions)
        .filter(([_, data]) => data && data.sign && typeof data.degree === 'number')
        .map(([planet, data]) => ({
          planet,
          sign: data.sign || 'Aries',
          degree: Math.max(0, Math.min(29.9999, data.degree || 0)),
          house: 0,
          date: new Date(),
        }))

      if (planets.length >= 2) {
        aspectAnalysis = await calculateDynamicAspects(planets, 7)

        // Apply kinetic modifiers to quantities
        // Spirit and Substance are more affected by velocity (Mercury principle)
        // Essence and Matter are more affected by power (Solar principle)
        const velocityMod = enhanced.velocity || 1.0
        const powerMod = enhanced.currentPower || 1.0

        quantities = {
          ...quantities,
          Spirit: quantities.Spirit * (0.5 + 0.5 * velocityMod),
          Substance: quantities.Substance * (0.5 + 0.5 * velocityMod),
          Essence: quantities.Essence * (0.5 + 0.5 * powerMod),
          Matter: quantities.Matter * (0.5 + 0.5 * powerMod),
          ANumber:
            quantities.Spirit + quantities.Essence + quantities.Matter + quantities.Substance,
        }
      }
    } catch (kineticError) {
      console.warn('Could not apply kinetic modifiers:', kineticError)
      // Continue without kinetic modifiers
    }

    // Generate real-time sign vector rune
    const realtimeRune = generateRealTimeSignVectorRune(planetaryPositions, { quantities })

    // Include some additional data that may be useful for the client
    const responseData = {
      quantities,
      dominantElement: alchmData?.['Dominant Element'] || '',
      heat: alchmData?.['Heat'] || 0,
      entropy: alchmData?.['Entropy'] || 0,
      reactivity: alchmData?.['Reactivity'] || 0,
      energy: alchmData?.['Energy'] || 0,
      sunSign: alchmData?.['Sun Sign'] || '',
      chartRuler: alchmData?.['Chart Ruler'] || '',
      realtimeRune,
      planetaryPositions: Object.keys(planetaryPositions).length,
      timestamp: new Date().toISOString(),
      kineticModifiers,
      aspectCount: aspectAnalysis?.currentAspects?.length || 0,
      applyingAspects: aspectAnalysis?.applyingAspects?.length || 0,
      separatingAspects: aspectAnalysis?.separatingAspects?.length || 0,
    }

    // Log quantities to Galileo for dashboard tracking (null-guarded)
    try {
      const metricsData: AlchemicalMetrics = {
        quantities,
        dominantElement: responseData.dominantElement || 'unknown',
        heat: responseData.heat || 0,
        entropy: responseData.entropy || 0,
        reactivity: responseData.reactivity || 0,
        energy: responseData.energy || 0,
        sunSign: responseData.sunSign || 'unknown',
        chartRuler: responseData.chartRuler || 'unknown',
        timestamp: responseData.timestamp,
        planetaryPositions,
      }

      await logQuantitiesToGalileo(metricsData, {
        api_endpoint: '/api/alchm-quantities',
        request_timestamp: new Date().toISOString(),
        calculation_method: 'real-time-planetary-positions',
      })
    } catch (galileoError) {
      console.warn('Failed to log quantities to Galileo:', galileoError)
      // Don't fail the API call if Galileo logging fails
    }

    console.log('API: Successfully generated alchm quantities')

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    console.error('API Error generating Alchm quantities:', error)

    // Calculate basic fallback data using simplified alchemical principles
    const now = new Date()
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    )
    const timeOfDay = now.getHours() + now.getMinutes() / 60

    // Basic elemental calculations based on time cycles
    const spirit = 3.0 + Math.sin((dayOfYear / 365) * 2 * Math.PI) * 2.0
    const essence = 3.0 + Math.cos((timeOfDay / 24) * 2 * Math.PI) * 2.0
    const matter = 3.0 + Math.sin(((dayOfYear + 91) / 365) * 2 * Math.PI) * 2.0 // 91 days offset for seasons
    const substance = 3.0 + Math.cos(((timeOfDay + 6) / 24) * 2 * Math.PI) * 2.0 // 6 hour offset

    // Calculate derived metrics
    const aNumber = spirit + essence + matter + substance
    const heat = (spirit * spirit + 1) / (essence + matter + substance + 1)
    const entropy = (spirit * spirit + substance * substance + 1) / (essence + matter + 1)
    const reactivity =
      (spirit * spirit + substance * substance + essence * essence + 1) / (matter + 1)
    const energy = heat - reactivity * entropy

    // Determine dominant element based on calculations
    const elements = { Fire: spirit, Water: essence, Air: matter, Earth: substance }
    const dominantElement = Object.entries(elements).reduce(
      (a: [string, number], b: [string, number]) =>
        elements[a[0] as keyof typeof elements] > elements[b[0] as keyof typeof elements] ? a : b
    )[0]

    const fallbackData = {
      quantities: {
        Spirit: Math.round(spirit * 100) / 100,
        Essence: Math.round(essence * 100) / 100,
        Matter: Math.round(matter * 100) / 100,
        Substance: Math.round(substance * 100) / 100,
        ANumber: Math.round(aNumber * 100) / 100,
        DayEssence: Math.round(essence * 0.6 * 100) / 100,
        NightEssence: Math.round(essence * 0.4 * 100) / 100,
      },
      dominantElement,
      heat: Math.round(heat * 1000) / 1000,
      entropy: Math.round(entropy * 1000) / 1000,
      reactivity: Math.round(reactivity * 1000) / 1000,
      energy: Math.round(energy * 1000) / 1000,
      sunSign:
        now.getMonth() < 3
          ? 'Pisces'
          : now.getMonth() < 6
            ? 'Gemini'
            : now.getMonth() < 9
              ? 'Virgo'
              : 'Sagittarius',
      chartRuler: 'Mercury',
      realtimeRune: {
        runeType: 'enhanced',
        element: dominantElement,
        description: 'Calculated using simplified alchemical principles',
      },
      planetaryPositions: 7,
      timestamp: now.toISOString(),
      fallback: true,
      error:
        error instanceof Error && error.message === 'Calculation timeout'
          ? 'timeout'
          : 'calculation_error',
    }

    console.log('API: Returning fallback alchm quantities due to error')

    return NextResponse.json(fallbackData, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    })
  }
}
