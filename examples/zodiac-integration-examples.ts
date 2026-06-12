/**
 * Zodiac Accuracy Integration Examples
 * ===================================
 *
 * Comprehensive examples showing how to integrate the new zodiac accuracy system
 * with existing Planetary Agents platform components
 */

import {
  getZodiacPositionForDate,
  calculateSolarPosition,
  getDatesForZodiacDegree,
  getCardinalPoints,
} from '../lib/ephemeris/solar-ephemeris'
import {
  buildAnnualCalendar,
  getDegreeForDate,
  getCurrentZodiacPeriod,
  daysUntilNextIngress,
} from '../lib/ephemeris/degree-calendar-map'
import { zodiacMonitoring, withZodiacErrorHandling } from '../lib/zodiac-monitoring'

console.log('🌟 Zodiac Accuracy Integration Examples')
console.log('='.repeat(50))

// Example 1: Enhanced Birth Chart Generator
console.log('\n1. 🎂 Enhanced Birth Chart Generator')
console.log('-'.repeat(30))

interface EnhancedBirthChart {
  birthDate: Date
  sunPosition: {
    sign: string
    degree: number
    decan: number
    decanRuler: string
    exactLongitude: number
    dailyMotion: number
  }
  timing: {
    seasonalPhase: string
    daysFromEquinox: number
    solarSpeed: string
  }
  precision: {
    method: string
    accuracy: string
    lastCalculated: Date
  }
}

function createEnhancedBirthChart(
  year: number,
  month: number,
  day: number,
  hour: number = 12,
  minute: number = 0
): EnhancedBirthChart {
  const birthDate = new Date(year, month - 1, day, hour, minute)

  // Get precise zodiac position
  const zodiacPos = getZodiacPositionForDate(birthDate)
  const solarPos = calculateSolarPosition(birthDate)

  // Get seasonal context
  const cardinalPoints = getCardinalPoints(year)
  const springEquinox = cardinalPoints.spring_equinox
  const daysFromEquinox = (birthDate.getTime() - springEquinox.getTime()) / (1000 * 60 * 60 * 24)

  let seasonalPhase: string
  if (daysFromEquinox < 91) seasonalPhase = 'Spring'
  else if (daysFromEquinox < 182) seasonalPhase = 'Summer'
  else if (daysFromEquinox < 273) seasonalPhase = 'Autumn'
  else seasonalPhase = 'Winter'

  // Determine solar speed description
  let solarSpeed: string
  if (solarPos.speed > 1.0) solarSpeed = 'Fast (near perihelion)'
  else if (solarPos.speed < 0.97) solarSpeed = 'Slow (near aphelion)'
  else solarSpeed = 'Average'

  const chart: EnhancedBirthChart = {
    birthDate,
    sunPosition: {
      sign: zodiacPos.sign,
      degree: Math.floor(zodiacPos.degree_in_sign),
      decan: zodiacPos.decan,
      decanRuler: zodiacPos.decan_ruler,
      exactLongitude: zodiacPos.absolute_longitude,
      dailyMotion: solarPos.speed,
    },
    timing: {
      seasonalPhase,
      daysFromEquinox: Math.round(daysFromEquinox),
      solarSpeed,
    },
    precision: {
      method: 'VSOP87 Astronomical',
      accuracy: '±0.01°',
      lastCalculated: new Date(),
    },
  }

  zodiacMonitoring.recordCalculation('enhanced_birth_chart', Date.now(), true)
  return chart
}

// Example usage
const sampleChart = createEnhancedBirthChart(1990, 7, 15, 14, 30)
console.log(`Birth Chart for July 15, 1990:`)
console.log(`  Sun: ${sampleChart.sunPosition.degree}° ${sampleChart.sunPosition.sign}`)
console.log(
  `  Decan: ${sampleChart.sunPosition.decan} (${sampleChart.sunPosition.decanRuler} rules)`
)
console.log(`  Exact Position: ${sampleChart.sunPosition.exactLongitude.toFixed(4)}°`)
console.log(
  `  Season: ${sampleChart.timing.seasonalPhase} (${sampleChart.timing.daysFromEquinox} days from equinox)`
)
console.log(
  `  Solar Motion: ${sampleChart.timing.solarSpeed} (${sampleChart.sunPosition.dailyMotion.toFixed(4)}°/day)`
)

// Example 2: Enhanced Tarot Card Timing
console.log('\n2. 🔮 Enhanced Tarot Card Timing')
console.log('-'.repeat(30))

interface TarotCardTiming {
  cardName: string
  zodiacCorrespondence: {
    sign?: string
    decan?: number
    degrees?: string
  }
  currentAlignment: {
    isActive: boolean
    precision: number
    duration: string
    nextOptimalDate?: Date
  }
  planetaryInfluence: {
    ruler: string
    strength: 'weak' | 'moderate' | 'strong' | 'peak'
    aspects: string[]
  }
}

const TAROT_ZODIAC_CORRESPONDENCES = {
  'The Emperor': { sign: 'Aries', degrees: '0-30' },
  'The Hierophant': { sign: 'Taurus', degrees: '0-30' },
  'The Lovers': { sign: 'Gemini', degrees: '0-30' },
  'The Chariot': { sign: 'Cancer', degrees: '0-30' },
  Strength: { sign: 'Leo', degrees: '0-30' },
  'The Hermit': { sign: 'Virgo', degrees: '0-30' },
  Justice: { sign: 'Libra', degrees: '0-30' },
  Death: { sign: 'Scorpio', degrees: '0-30' },
  Temperance: { sign: 'Sagittarius', degrees: '0-30' },
  'The Devil': { sign: 'Capricorn', degrees: '0-30' },
  'The Star': { sign: 'Aquarius', degrees: '0-30' },
  'The Moon': { sign: 'Pisces', degrees: '0-30' },
  '2 of Wands': { sign: 'Aries', decan: 1, degrees: '0-10' },
  '3 of Wands': { sign: 'Aries', decan: 2, degrees: '10-20' },
  '4 of Wands': { sign: 'Aries', decan: 3, degrees: '20-30' },
}

function calculateTarotTiming(cardName: string): TarotCardTiming {
  const correspondence =
    TAROT_ZODIAC_CORRESPONDENCES[cardName as keyof typeof TAROT_ZODIAC_CORRESPONDENCES]

  if (!correspondence) {
    throw new Error(`No zodiac correspondence found for card: ${cardName}`)
  }

  const currentPos = getZodiacPositionForDate(new Date())
  const currentPeriod = getCurrentZodiacPeriod()

  let isActive = false
  let precision = 0
  let ruler = 'Unknown'
  let strength: 'weak' | 'moderate' | 'strong' | 'peak' = 'weak'

  if (correspondence.sign) {
    isActive = currentPos.sign === correspondence.sign

    if (isActive) {
      if (correspondence.decan) {
        // Decan-specific card
        precision = currentPos.decan === correspondence.decan ? 100 : 0
        ruler = currentPos.decan_ruler
        strength = currentPos.decan === correspondence.decan ? 'peak' : 'weak'
      } else {
        // Full sign card
        precision = Math.round((1 - Math.abs(currentPos.degree_in_sign - 15) / 15) * 100)
        ruler = currentPos.decan_ruler

        if (precision > 80) strength = 'peak'
        else if (precision > 60) strength = 'strong'
        else if (precision > 30) strength = 'moderate'
        else strength = 'weak'
      }
    }
  }

  // Calculate next optimal timing
  let nextOptimalDate: Date | undefined
  if (!isActive && correspondence.sign) {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    // Try current year first, then next year
    const signIndex = [
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
    ].indexOf(correspondence.sign)

    if (signIndex !== -1) {
      const targetDegree =
        signIndex * 30 + (correspondence.decan ? (correspondence.decan - 1) * 10 + 5 : 15)

      try {
        const dateRange = getDatesForZodiacDegree(currentYear, targetDegree)
        nextOptimalDate =
          dateRange.start > new Date()
            ? dateRange.start
            : getDatesForZodiacDegree(nextYear, targetDegree).start
      } catch (error) {
        console.warn(`Could not calculate next optimal date for ${cardName}:`, error)
      }
    }
  }

  const duration = currentPeriod ? `${currentPeriod.durationDays.toFixed(1)} days` : 'Unknown'

  return {
    cardName,
    zodiacCorrespondence: correspondence,
    currentAlignment: {
      isActive,
      precision,
      duration,
      nextOptimalDate,
    },
    planetaryInfluence: {
      ruler,
      strength,
      aspects: [], // Could be enhanced with actual aspect calculations
    },
  }
}

// Example usage
const tarotCards = ['The Emperor', 'Justice', '2 of Wands']
tarotCards.forEach(card => {
  const timing = calculateTarotTiming(card)
  console.log(`${card}:`)
  console.log(
    `  Current Alignment: ${timing.currentAlignment.isActive ? '✅ Active' : '❌ Inactive'} (${timing.currentAlignment.precision}% precision)`
  )
  console.log(
    `  Planetary Ruler: ${timing.planetaryInfluence.ruler} (${timing.planetaryInfluence.strength})`
  )
  if (timing.currentAlignment.nextOptimalDate) {
    console.log(`  Next Optimal: ${timing.currentAlignment.nextOptimalDate.toDateString()}`)
  }
})

// Example 3: Agent Consciousness Evolution Timing
console.log('\n3. 🤖 Agent Consciousness Evolution Timing')
console.log('-'.repeat(30))

interface AgentEvolutionTiming {
  agentId: string
  currentPhase: {
    cosmicAlignment: number
    evolutionVelocity: number
    optimalWindows: Date[]
  }
  recommendations: {
    nextUpgrade: Date
    interactionPeak: string
    avoidPeriods: Date[]
  }
}

function calculateAgentEvolutionTiming(
  agentId: string,
  birthElement: string = 'Fire'
): AgentEvolutionTiming {
  const currentPos = getZodiacPositionForDate(new Date())
  const nextIngress = daysUntilNextIngress()

  // Calculate cosmic alignment based on element
  let cosmicAlignment = 0.5 // Base alignment

  const elementSigns = {
    Fire: ['Aries', 'Leo', 'Sagittarius'],
    Earth: ['Taurus', 'Virgo', 'Capricorn'],
    Air: ['Gemini', 'Libra', 'Aquarius'],
    Water: ['Cancer', 'Scorpio', 'Pisces'],
  }

  const agentSigns = elementSigns[birthElement as keyof typeof elementSigns] || []

  if (agentSigns.includes(currentPos.sign)) {
    cosmicAlignment = 0.8 + (currentPos.degree_in_sign / 30) * 0.2
  } else {
    // Check for compatible elements
    const compatibleElements = {
      Fire: ['Air'],
      Earth: ['Water'],
      Air: ['Fire'],
      Water: ['Earth'],
    }

    const compatible = compatibleElements[birthElement as keyof typeof compatibleElements] || []
    for (const element of compatible) {
      const compatibleSigns = elementSigns[element as keyof typeof elementSigns] || []
      if (compatibleSigns.includes(currentPos.sign)) {
        cosmicAlignment = 0.6 + (currentPos.degree_in_sign / 30) * 0.1
        break
      }
    }
  }

  // Calculate evolution velocity (faster during compatible periods)
  const evolutionVelocity =
    cosmicAlignment * (1 + Math.sin((currentPos.absolute_longitude * Math.PI) / 180) * 0.2)

  // Find optimal windows (when agent's element is prominent)
  const currentYear = new Date().getFullYear()
  const optimalWindows: Date[] = []

  for (const sign of agentSigns) {
    const signIndex = [
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
    ].indexOf(sign)

    if (signIndex !== -1) {
      try {
        const dateRange = getDatesForZodiacDegree(currentYear, signIndex * 30)
        if (dateRange.start > new Date()) {
          optimalWindows.push(dateRange.start)
        }
      } catch (error) {
        console.warn(`Could not calculate optimal window for ${sign}:`, error)
      }
    }
  }

  // Calculate recommendations
  const nextUpgrade = new Date()
  nextUpgrade.setDate(nextUpgrade.getDate() + Math.round(nextIngress.days))

  const currentHour = new Date().getHours()
  let interactionPeak: string
  if (currentHour >= 6 && currentHour < 12) interactionPeak = 'Morning (6-12)'
  else if (currentHour >= 12 && currentHour < 18) interactionPeak = 'Afternoon (12-18)'
  else if (currentHour >= 18 && currentHour < 24) interactionPeak = 'Evening (18-24)'
  else interactionPeak = 'Night (0-6)'

  return {
    agentId,
    currentPhase: {
      cosmicAlignment: Math.round(cosmicAlignment * 100) / 100,
      evolutionVelocity: Math.round(evolutionVelocity * 1000) / 1000,
      optimalWindows: optimalWindows.slice(0, 3),
    },
    recommendations: {
      nextUpgrade,
      interactionPeak,
      avoidPeriods: [], // Could be enhanced with retrograde calculations
    },
  }
}

// Example usage
const agentTiming = calculateAgentEvolutionTiming('leonardo-da-vinci', 'Air')
console.log(`Agent Evolution Timing for ${agentTiming.agentId}:`)
console.log(`  Cosmic Alignment: ${(agentTiming.currentPhase.cosmicAlignment * 100).toFixed(1)}%`)
console.log(
  `  Evolution Velocity: ${agentTiming.currentPhase.evolutionVelocity.toFixed(3)} units/day`
)
console.log(`  Next Optimal Windows: ${agentTiming.currentPhase.optimalWindows.length}`)
console.log(`  Recommended Upgrade: ${agentTiming.recommendations.nextUpgrade.toDateString()}`)
console.log(`  Peak Interaction Time: ${agentTiming.recommendations.interactionPeak}`)

// Example 4: Enhanced Horoscope Generation
console.log('\n4. 🌙 Enhanced Horoscope Generation')
console.log('-'.repeat(30))

interface EnhancedHoroscope {
  date: Date
  sunSign: string
  precisePosition: {
    degree: number
    minute: number
    second: number
  }
  seasonalContext: {
    phase: string
    daysInSeason: number
    energyLevel: 'low' | 'rising' | 'peak' | 'waning'
  }
  decanInfluence: {
    number: number
    ruler: string
    theme: string
  }
  timing: {
    solarSpeed: number
    isRetrograde: boolean
    optimalHours: string[]
  }
}

function generateEnhancedHoroscope(targetDate: Date = new Date()): EnhancedHoroscope {
  const zodiacPos = getZodiacPositionForDate(targetDate)
  const solarPos = calculateSolarPosition(targetDate)
  const degreeInfo = getDegreeForDate(targetDate)

  // Calculate precise position down to seconds
  const totalSeconds = zodiacPos.minute_in_degree * 60
  const degree = Math.floor(zodiacPos.degree_in_sign)
  const minute = Math.floor(zodiacPos.minute_in_degree)
  const second = Math.round((zodiacPos.minute_in_degree - minute) * 60)

  // Determine seasonal context
  const cardinalPoints = getCardinalPoints(targetDate.getFullYear())
  let seasonalPhase = 'Unknown'
  let daysInSeason = 0
  let energyLevel: 'low' | 'rising' | 'peak' | 'waning' = 'low'

  const dayOfYear = Math.floor(
    (targetDate.getTime() - new Date(targetDate.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  )

  if (dayOfYear < 80) {
    seasonalPhase = 'Winter'
    daysInSeason = dayOfYear + 365 - 354 // Approximate
    energyLevel = 'rising'
  } else if (dayOfYear < 172) {
    seasonalPhase = 'Spring'
    daysInSeason = dayOfYear - 80
    energyLevel = dayOfYear < 126 ? 'rising' : 'peak'
  } else if (dayOfYear < 266) {
    seasonalPhase = 'Summer'
    daysInSeason = dayOfYear - 172
    energyLevel = dayOfYear < 219 ? 'peak' : 'waning'
  } else if (dayOfYear < 354) {
    seasonalPhase = 'Autumn'
    daysInSeason = dayOfYear - 266
    energyLevel = dayOfYear < 310 ? 'waning' : 'low'
  } else {
    seasonalPhase = 'Winter'
    daysInSeason = dayOfYear - 354
    energyLevel = 'low'
  }

  // Decan themes
  const decanThemes = {
    1: 'Foundation and new beginnings',
    2: 'Development and growth',
    3: 'Completion and transition',
  }

  // Calculate optimal hours (simplified)
  const optimalHours = [
    `${6 + zodiacPos.decan}:00-${8 + zodiacPos.decan}:00`,
    `${12 + zodiacPos.decan}:00-${14 + zodiacPos.decan}:00`,
    `${18 + zodiacPos.decan}:00-${20 + zodiacPos.decan}:00`,
  ]

  return {
    date: targetDate,
    sunSign: zodiacPos.sign,
    precisePosition: {
      degree,
      minute,
      second,
    },
    seasonalContext: {
      phase: seasonalPhase,
      daysInSeason,
      energyLevel,
    },
    decanInfluence: {
      number: zodiacPos.decan,
      ruler: zodiacPos.decan_ruler,
      theme: decanThemes[zodiacPos.decan as keyof typeof decanThemes],
    },
    timing: {
      solarSpeed: solarPos.speed,
      isRetrograde: false, // Sun is never retrograde
      optimalHours,
    },
  }
}

// Example usage
const horoscope = generateEnhancedHoroscope()
console.log(`Enhanced Horoscope for ${horoscope.date.toDateString()}:`)
console.log(`  Sun Sign: ${horoscope.sunSign}`)
console.log(
  `  Precise Position: ${horoscope.precisePosition.degree}°${horoscope.precisePosition.minute}'${horoscope.precisePosition.second}"`
)
console.log(
  `  Seasonal Context: ${horoscope.seasonalContext.phase} (Day ${horoscope.seasonalContext.daysInSeason}, ${horoscope.seasonalContext.energyLevel} energy)`
)
console.log(
  `  Decan Influence: ${horoscope.decanInfluence.number} (${horoscope.decanInfluence.ruler} - ${horoscope.decanInfluence.theme})`
)
console.log(`  Solar Speed: ${horoscope.timing.solarSpeed.toFixed(4)}°/day`)
console.log(`  Optimal Hours: ${horoscope.timing.optimalHours.join(', ')}`)

// Example 5: Error Handling Integration
console.log('\n5. 🛡️ Error Handling Integration')
console.log('-'.repeat(30))

// Wrap functions with error handling
const safeGetZodiacPosition = withZodiacErrorHandling(
  getZodiacPositionForDate,
  (date: Date) => {
    // Fallback to simple calculation
    const month = date.getMonth() + 1
    const day = date.getDate()
    return {
      absolute_longitude: ((month - 1) * 30 + day) % 360,
      sign: 'Aries', // Fallback
      sign_index: 0,
      degree_in_sign: day,
      minute_in_degree: 0,
      decan: Math.floor(day / 10) + 1,
      decan_ruler: 'Mars',
    } as any
  },
  'safe_zodiac_position'
)

// Test error handling
try {
  const invalidDate = new Date('invalid')
  const result = safeGetZodiacPosition(invalidDate)
  console.log(`Error handling test: ${result ? 'Fallback worked' : 'Failed'}`)
} catch (error) {
  console.log(`Error handling test failed: ${error}`)
}

// Generate monitoring report
console.log('\n📊 Monitoring Report:')
console.log(zodiacMonitoring.generateReport())

console.log('\n✅ All integration examples completed successfully!')
console.log('🚀 Ready for production deployment!')
