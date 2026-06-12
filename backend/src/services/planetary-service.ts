import { logger } from '../utils/logger.js'
import { getRealPlanetaryPositions } from './alchm-client.js'

export interface PlanetPosition {
  name: string
  sign: string
  degree: number
  retrograde: boolean
  house?: number
}
export interface PlanetaryPositions {
  sun: PlanetPosition
  moon: PlanetPosition
  mercury: PlanetPosition
  venus: PlanetPosition
  mars: PlanetPosition
  jupiter: PlanetPosition
  saturn: PlanetPosition
  uranus?: PlanetPosition
  neptune?: PlanetPosition
  pluto?: PlanetPosition
}

export async function getCurrentPlanetaryPositions(
  date: Date = new Date()
): Promise<PlanetaryPositions> {
  // Try real API first
  try {
    const lat = parseFloat(process.env.DEFAULT_LATITUDE || '0')
    const lon = parseFloat(process.env.DEFAULT_LONGITUDE || '0')
    const apiPositions = await getRealPlanetaryPositions({ lat, lon })
    return apiPositions as PlanetaryPositions
  } catch (apiError) {
    logger.warn('Falling back to simplified planetary positions due to API error')
    return getFallbackPositions(date)
  }
}

function getFallbackPositions(date: Date): PlanetaryPositions {
  try {
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    )
    const hour = date.getHours()
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
    const calculatePosition = (orbitalDays: number, offset: number = 0): PlanetPosition => {
      const progress = ((dayOfYear + offset) % orbitalDays) / orbitalDays
      const signIndex = Math.floor(progress * 12)
      const degree = (progress * 360) % 30
      return {
        name: '',
        sign: signs[signIndex],
        degree: Math.round(degree * 10) / 10,
        retrograde: Math.sin(progress * Math.PI * 2) < -0.8,
      }
    }
    const positions: PlanetaryPositions = {
      sun: { ...calculatePosition(365, 0), name: 'Sun', retrograde: false },
      moon: { ...calculatePosition(28, hour), name: 'Moon', retrograde: false },
      mercury: { ...calculatePosition(88, 10), name: 'Mercury' },
      venus: { ...calculatePosition(225, 20), name: 'Venus' },
      mars: { ...calculatePosition(687, 30), name: 'Mars' },
      jupiter: { ...calculatePosition(4333, 40), name: 'Jupiter' },
      saturn: { ...calculatePosition(10759, 50), name: 'Saturn' },
      uranus: { ...calculatePosition(30687, 60), name: 'Uranus' },
      neptune: { ...calculatePosition(60190, 70), name: 'Neptune' },
      pluto: { ...calculatePosition(90560, 80), name: 'Pluto' },
    }
    const houseOffset = Math.floor(hour / 2)
    Object.values(positions).forEach((planet, index) => {
      planet.house = ((index + houseOffset) % 12) + 1
    })
    return positions
  } catch (error) {
    logger.error('Error calculating planetary positions:', error)
    return {
      sun: { name: 'Sun', sign: 'Aries', degree: 0, retrograde: false, house: 1 },
      moon: { name: 'Moon', sign: 'Cancer', degree: 0, retrograde: false, house: 4 },
      mercury: { name: 'Mercury', sign: 'Gemini', degree: 0, retrograde: false, house: 3 },
      venus: { name: 'Venus', sign: 'Taurus', degree: 0, retrograde: false, house: 2 },
      mars: { name: 'Mars', sign: 'Aries', degree: 0, retrograde: false, house: 1 },
      jupiter: { name: 'Jupiter', sign: 'Sagittarius', degree: 0, retrograde: false, house: 9 },
      saturn: { name: 'Saturn', sign: 'Capricorn', degree: 0, retrograde: false, house: 10 },
    }
  }
}

export function getPlanetaryHour(date: Date, latitude: number): string {
  try {
    const dayPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']
    const hourSequence = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']
    const dayOfWeek = date.getDay()
    const dayPlanet = dayPlanets[dayOfWeek]
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    )
    const seasonalOffset = Math.sin(((dayOfYear - 80) * 2 * Math.PI) / 365) * 2
    const sunrise = 6 - seasonalOffset
    const sunset = 18 + seasonalOffset
    const currentHour = date.getHours() + date.getMinutes() / 60
    let planetaryHour: number
    if (currentHour >= sunrise && currentHour < sunset) {
      const dayLength = sunset - sunrise
      const hourLength = dayLength / 12
      planetaryHour = Math.floor((currentHour - sunrise) / hourLength)
    } else {
      const nightLength = 24 - (sunset - sunrise)
      const hourLength = nightLength / 12
      if (currentHour >= sunset) planetaryHour = Math.floor((currentHour - sunset) / hourLength)
      else planetaryHour = Math.floor((currentHour + 24 - sunset) / hourLength)
    }
    const dayPlanetIndex = hourSequence.indexOf(dayPlanet)
    const currentPlanetIndex = (dayPlanetIndex + planetaryHour) % 7
    return hourSequence[currentPlanetIndex]
  } catch (error) {
    logger.error('Error calculating planetary hour:', error)
    return 'Sun'
  }
}
