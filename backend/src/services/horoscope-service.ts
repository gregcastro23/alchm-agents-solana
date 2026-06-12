import { logger } from '../utils/logger.js'

export interface HoroscopeData {
  sign: string
  ascendant?: string
  houses?: Record<number, string>
  aspects?: string[]
  summary?: string
}

/**
 * Generates accurate horoscope based on birth data
 * Simplified backend implementation
 */
export function generateAccurateHoroscope(birthData: any): HoroscopeData {
  try {
    // Extract birth date for zodiac calculation
    const birthDate = birthData.birthDate ? new Date(birthData.birthDate) : new Date()
    const month = birthDate.getMonth() + 1
    const day = birthDate.getDate()

    // Determine zodiac sign
    let sign = 'Aries'

    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) sign = 'Aries'
    else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) sign = 'Taurus'
    else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) sign = 'Gemini'
    else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) sign = 'Cancer'
    else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) sign = 'Leo'
    else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) sign = 'Virgo'
    else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) sign = 'Libra'
    else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) sign = 'Scorpio'
    else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) sign = 'Sagittarius'
    else if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) sign = 'Capricorn'
    else if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) sign = 'Aquarius'
    else if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) sign = 'Pisces'

    // Calculate ascendant based on birth time if available
    let ascendant = sign
    if (birthData.birthTime) {
      const birthHour = parseInt(birthData.birthTime.split(':')[0])
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
      const ascIndex = (signs.indexOf(sign) + Math.floor(birthHour / 2)) % 12
      ascendant = signs[ascIndex]
    }

    // Generate simplified house positions
    const houses: Record<number, string> = {}
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
    const startIndex = signs.indexOf(ascendant)

    for (let i = 1; i <= 12; i++) {
      houses[i] = signs[(startIndex + i - 1) % 12]
    }

    // Generate major aspects based on sun sign
    const aspects = generateAspects(sign)

    // Create summary
    const summary = `Sun in ${sign}, Ascendant in ${ascendant}. ${getSignDescription(sign)}`

    return {
      sign,
      ascendant,
      houses,
      aspects,
      summary,
    }
  } catch (error) {
    logger.error('Error generating horoscope:', error)
    return {
      sign: 'Aries',
      summary: 'Unable to calculate precise horoscope at this time.',
    }
  }
}

function generateAspects(sign: string): string[] {
  const aspects = []
  const signElements: Record<string, string> = {
    Aries: 'Fire',
    Leo: 'Fire',
    Sagittarius: 'Fire',
    Taurus: 'Earth',
    Virgo: 'Earth',
    Capricorn: 'Earth',
    Gemini: 'Air',
    Libra: 'Air',
    Aquarius: 'Air',
    Cancer: 'Water',
    Scorpio: 'Water',
    Pisces: 'Water',
  }

  const element = signElements[sign] || 'Fire'

  // Generate harmonious aspects with same element signs
  const sameElement = Object.entries(signElements)
    .filter(([s, e]) => e === element && s !== sign)
    .map(([s]) => s)

  sameElement.forEach(s => {
    aspects.push(`Sun trine ${s}`)
  })

  // Add some common aspects
  aspects.push('Moon sextile Mercury')
  aspects.push('Venus conjunct Mars')

  return aspects
}

function getSignDescription(sign: string): string {
  const descriptions: Record<string, string> = {
    Aries: 'Pioneer spirit with natural leadership qualities.',
    Taurus: 'Grounded and practical with appreciation for beauty.',
    Gemini: 'Curious and communicative with versatile talents.',
    Cancer: 'Intuitive and nurturing with deep emotional wisdom.',
    Leo: 'Creative and confident with natural charisma.',
    Virgo: 'Analytical and detail-oriented with healing abilities.',
    Libra: 'Diplomatic and artistic with strong sense of justice.',
    Scorpio: 'Intense and transformative with penetrating insight.',
    Sagittarius: 'Adventurous and philosophical with expansive vision.',
    Capricorn: 'Ambitious and disciplined with mastery orientation.',
    Aquarius: 'Innovative and humanitarian with unique perspective.',
    Pisces: 'Compassionate and mystical with artistic sensitivity.',
  }

  return descriptions[sign] || 'A unique individual on a consciousness journey.'
}
