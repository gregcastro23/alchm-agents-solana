import { NextResponse } from 'next/server'
import { generateAlchmForCurrentMoment } from '@/lib/alchemizer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AstrologicalCondition {
  condition: string
  active: boolean
  effect: string
  multiplier: number
}

/**
 * Simulate current astrological conditions affecting rune pricing
 */
async function getCurrentAstrologicalConditions(): Promise<AstrologicalCondition[]> {
  try {
    // Get current alchemical data
    const alchmData = await generateAlchmForCurrentMoment()
    const currentHour = new Date().getHours()
    const currentDay = new Date().getDay()

    // Simulate planetary hours (simplified)
    const planetaryHours = ['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars']
    const currentPlanetaryHour = planetaryHours[currentHour % 7]

    // Simulate moon phase (simplified - would use real lunar calculations)
    const dayOfMonth = new Date().getDate()
    let moonPhase = 'new_moon'
    if (dayOfMonth >= 7 && dayOfMonth < 14) moonPhase = 'waxing_moon'
    else if (dayOfMonth >= 14 && dayOfMonth < 21) moonPhase = 'full_moon'
    else if (dayOfMonth >= 21 && dayOfMonth < 28) moonPhase = 'waning_moon'

    // Extract A-Number for consciousness level
    const spirit = alchmData?.['Alchemy Effects']?.['Total Spirit'] || 0
    const essence = alchmData?.['Alchemy Effects']?.['Total Essence'] || 0
    const matter = alchmData?.['Alchemy Effects']?.['Total Matter'] || 0
    const substance = alchmData?.['Alchemy Effects']?.['Total Substance'] || 0
    const aNumber = spirit + essence + matter + substance

    const conditions: AstrologicalCondition[] = [
      // Planetary Hours
      {
        condition: 'jupiter_hour',
        active: currentPlanetaryHour === 'jupiter',
        effect: 'Greatly reduces all rune costs',
        multiplier: 0.6,
      },
      {
        condition: 'saturn_hour',
        active: currentPlanetaryHour === 'saturn',
        effect: 'Significantly increases all costs',
        multiplier: 1.3,
      },
      {
        condition: 'venus_hour',
        active: currentPlanetaryHour === 'venus',
        effect: 'Reduces Matter-based rune costs',
        multiplier: 0.85,
      },
      {
        condition: 'mars_hour',
        active: currentPlanetaryHour === 'mars',
        effect: 'Increases all rune costs',
        multiplier: 1.1,
      },
      {
        condition: 'sun_hour',
        active: currentPlanetaryHour === 'sun',
        effect: 'Reduces Spirit-based rune costs',
        multiplier: 0.8,
      },
      {
        condition: 'moon_hour',
        active: currentPlanetaryHour === 'moon',
        effect: 'Reduces Essence-based rune costs',
        multiplier: 0.7,
      },
      {
        condition: 'mercury_hour',
        active: currentPlanetaryHour === 'mercury',
        effect: 'Slightly reduces all costs',
        multiplier: 0.9,
      },

      // Moon Phases
      {
        condition: 'full_moon',
        active: moonPhase === 'full_moon',
        effect: 'Dramatically reduces divination rune costs',
        multiplier: 0.5,
      },
      {
        condition: 'new_moon',
        active: moonPhase === 'new_moon',
        effect: 'Increases manifestation rune costs',
        multiplier: 1.2,
      },
      {
        condition: 'waxing_moon',
        active: moonPhase === 'waxing_moon',
        effect: 'Reduces enhancement rune costs',
        multiplier: 0.9,
      },
      {
        condition: 'waning_moon',
        active: moonPhase === 'waning_moon',
        effect: 'Reduces protection rune costs',
        multiplier: 0.8,
      },

      // Special Conditions (simulated)
      {
        condition: 'high_consciousness',
        active: aNumber > 20,
        effect: 'Unlocks access to advanced cosmic runes',
        multiplier: 1.0,
      },
      {
        condition: 'peak_consciousness',
        active: aNumber > 35,
        effect: 'Enables legendary rune crafting',
        multiplier: 0.9,
      },
      {
        condition: 'harmonic_convergence',
        active: Math.abs(spirit - essence) < 2 && Math.abs(matter - substance) < 2,
        effect: 'Perfect elemental balance reduces all costs',
        multiplier: 0.7,
      },
    ]

    return conditions
  } catch (error) {
    console.error('Error calculating astrological conditions:', error)

    // Fallback conditions
    return [
      {
        condition: 'neutral_conditions',
        active: true,
        effect: 'Standard pricing in effect',
        multiplier: 1.0,
      },
    ]
  }
}

export async function GET() {
  try {
    const conditions = await getCurrentAstrologicalConditions()
    const activeConditions = conditions.filter(c => c.active)

    // Calculate overall pricing multiplier
    let overallMultiplier = 1.0
    activeConditions.forEach(condition => {
      overallMultiplier *= condition.multiplier
    })

    return NextResponse.json({
      success: true,
      conditions: activeConditions,
      allConditions: conditions,
      overallMultiplier: Math.round(overallMultiplier * 100) / 100,
      priceChange:
        overallMultiplier < 1 ? 'decreased' : overallMultiplier > 1 ? 'increased' : 'stable',
      timestamp: new Date().toISOString(),
      summary: {
        activeCount: activeConditions.length,
        favorableCount: activeConditions.filter(c => c.multiplier < 1).length,
        unfavorableCount: activeConditions.filter(c => c.multiplier > 1).length,
      },
    })
  } catch (error) {
    console.error('Error in runes conditions API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate astrological conditions',
        conditions: [
          {
            condition: 'error_fallback',
            active: true,
            effect: 'Using default pricing due to calculation error',
            multiplier: 1.0,
          },
        ],
      },
      { status: 500 }
    )
  }
}
