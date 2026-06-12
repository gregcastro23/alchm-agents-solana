import { backend } from '@/lib/backend'
import { identifyPlanetaryThemes, findHistoricalPatterns } from '@/lib/transit-patterns'
import {
  findLastOccurrence,
  findNextOccurrence,
  getPlanetCycleLength,
} from '@/lib/historical-transits'
import { DegreeSpecificHistoryService } from '@/lib/degree-specific-history'
import DegreeAgentClient from './degree-agent-client'

const OUTER_PLANETS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
const SIGN_ORDER = [
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

export default async function DegreeAgentPage({
  params,
}: {
  params: Promise<{ planet: string; sign: string; degree: string }>
}) {
  const { planet: rawPlanet, sign: rawSign, degree: rawDegree } = await params
  const planet = decodeURIComponent(rawPlanet)
  const sign = decodeURIComponent(rawSign)
  const degree = parseInt(rawDegree)

  // ── Synchronous static computations ──────────────────────────────────────
  const planetaryThemes = identifyPlanetaryThemes(planet, sign)
  const patterns = findHistoricalPatterns(planet, sign)
  const lastOccurrenceRaw = findLastOccurrence(planet, sign, degree)
  const nextOccurrenceRaw = findNextOccurrence(planet, sign, degree)
  const cycleLength = getPlanetCycleLength(planet)
  const daysPerDegree = Math.round((cycleLength / 360) * 10) / 10
  const approxDaysInSign = Math.round(cycleLength / 12)

  // Serialize Date objects to ISO strings for RSC → client prop passing
  const historicalData = {
    lastOccurrence: lastOccurrenceRaw
      ? {
          date:
            lastOccurrenceRaw.date instanceof Date
              ? lastOccurrenceRaw.date.toISOString()
              : String(lastOccurrenceRaw.date ?? ''),
          historicalContext: lastOccurrenceRaw.historicalContext,
        }
      : null,
    nextOccurrence: nextOccurrenceRaw
      ? {
          date:
            nextOccurrenceRaw.date instanceof Date
              ? nextOccurrenceRaw.date.toISOString()
              : String(nextOccurrenceRaw.date ?? ''),
          historicalContext: nextOccurrenceRaw.historicalContext,
        }
      : null,
    patterns: patterns.slice(0, 3),
    cycleLength,
    daysPerDegree,
    approxDaysInSign,
  }

  // Degree-specific history for outer planets (synchronous)
  let degreeHistoricalData: any = null
  if (OUTER_PLANETS.includes(planet)) {
    try {
      const raw = DegreeSpecificHistoryService.generateHistoricalData(planet, sign, degree)
      // Serialize nextOccurrence Date if present
      degreeHistoricalData = raw
        ? {
            ...raw,
            nextOccurrence:
              raw.nextOccurrence instanceof Date
                ? raw.nextOccurrence.toISOString()
                : (raw.nextOccurrence ?? null),
          }
        : null
    } catch {
      // ignore — non-critical
    }
  }

  // Recent transits (synchronous — no backend needed)
  const now = new Date()
  const recentTransits = Array.from({ length: 5 }, (_, i) => {
    const daysAgo = cycleLength * (i + 1)
    const transitDate = new Date(now)
    transitDate.setDate(transitDate.getDate() - daysAgo)
    const year = transitDate.getFullYear()
    let historicalContext = 'Historical period'
    if (year >= 2020) historicalContext = 'Recent modern history'
    else if (year >= 2000) historicalContext = 'Early 21st century'
    else if (year >= 1980) historicalContext = 'Late 20th century'
    else if (year >= 1950) historicalContext = 'Mid 20th century'
    else if (year >= 1900) historicalContext = 'Early 20th century'
    return {
      dateStr: transitDate.toISOString(),
      year,
      cycleNumber: i + 1,
      yearsAgo: Math.round(
        (now.getTime() - transitDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      ),
      historicalContext,
    }
  })

  // ── Async: live transit data from Railway ─────────────────────────────────
  let currentTransitData: {
    currentSign: string
    currentDegree: number
    isAtRequestedPosition: boolean
    degreeDifference: number
    daysUntilReturn: number
  } | null = null

  try {
    const positions = await backend.planetary.positions()
    const planetPositions = (positions as any)?.planetary_positions || {}
    const current = planetPositions[planet]
    if (current) {
      const currentDegreeNum = typeof current.degree === 'number' ? current.degree : 0
      const degreeDifference = Math.abs(currentDegreeNum - degree)
      const isAtRequestedPosition = current.sign === sign && degreeDifference < 1

      // Days until return
      const currentSignIdx = SIGN_ORDER.indexOf(current.sign)
      const targetSignIdx = SIGN_ORDER.indexOf(sign)
      const currentAbsolute = currentSignIdx * 30 + currentDegreeNum
      const targetAbsolute = targetSignIdx * 30 + degree
      let degreesToTravel = targetAbsolute - currentAbsolute
      if (degreesToTravel <= 0) degreesToTravel += 360
      const daysUntilReturn = Math.round(degreesToTravel / (360 / cycleLength))

      currentTransitData = {
        currentSign: current.sign,
        currentDegree: currentDegreeNum,
        isAtRequestedPosition,
        degreeDifference,
        daysUntilReturn,
      }
    }
  } catch {
    // currentTransitData stays null — sidebar card is hidden
  }

  return (
    <DegreeAgentClient
      planet={planet}
      sign={sign}
      degree={degree}
      historicalData={historicalData}
      planetaryThemes={planetaryThemes}
      degreeHistoricalData={degreeHistoricalData}
      currentTransitData={currentTransitData}
      recentTransits={recentTransits}
    />
  )
}
