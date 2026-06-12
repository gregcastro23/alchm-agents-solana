import { PrismaClient } from '@prisma/client'

export interface HistoricalTransit {
  planet: string
  sign: string
  startDate: Date
  endDate: Date
  degreeStart: number
  degreeEnd: number
  retrograde?: boolean
  historicalNote?: string
}

export interface TransitOccurrence {
  date: Date
  planet: string
  sign: string
  degree: number
  retrograde: boolean
  historicalContext?: string
  notableEvents?: string[]
}

export interface PlanetaryReturn {
  planet: string
  cycleLength: number // in days
  lastReturn: Date
  nextReturn: Date
  totalReturns: number
  significance: string
}

// Calculate when a specific planetary configuration last occurred
export function findLastOccurrence(
  planet: string,
  sign: string,
  degree: number,
  currentDate: Date = new Date()
): TransitOccurrence | null {
  const transitHistory = getTransitHistory(planet, sign)

  // Find the most recent occurrence before current date
  for (let i = transitHistory.length - 1; i >= 0; i--) {
    const transit = transitHistory[i]
    if (transit.date < currentDate && Math.abs(transit.degree - degree) < 1) {
      return transit
    }
  }

  return null
}

// Calculate when a specific planetary configuration will next occur
export function findNextOccurrence(
  planet: string,
  sign: string,
  degree: number,
  currentDate: Date = new Date()
): TransitOccurrence | null {
  const cycleLength = getPlanetCycleLength(planet)
  const lastOccurrence = findLastOccurrence(planet, sign, degree, currentDate)

  if (!lastOccurrence || !cycleLength) return null

  // Calculate approximate next occurrence based on cycle
  const nextDate = new Date(lastOccurrence.date)
  nextDate.setDate(nextDate.getDate() + cycleLength)

  return {
    date: nextDate,
    planet,
    sign,
    degree,
    retrograde: false,
    historicalContext: `Projected based on ${cycleLength}-day cycle`,
  }
}

// Get historical events that occurred during similar transits
export function getHistoricalEvents(
  planet: string,
  sign: string,
  startDate?: Date,
  endDate?: Date
): string[] {
  // This will be populated with actual historical data
  const events = historicalEventDatabase[`${planet}_${sign}`] || []

  if (startDate && endDate) {
    return events
      .filter(event => {
        const eventDate = new Date(event.date)
        return eventDate >= startDate && eventDate <= endDate
      })
      .map(e => e.description)
  }

  return events.map(e => e.description)
}

// Get the cycle length for a planet (in days)
export function getPlanetCycleLength(planet: string): number {
  const cycles: Record<string, number> = {
    Sun: 365.25,
    Moon: 29.53,
    Mercury: 87.97,
    Venus: 224.7,
    Mars: 687,
    Jupiter: 4332.59,
    Saturn: 10759.22,
    Uranus: 30688.5,
    Neptune: 60182,
    Pluto: 90560,
  }

  return cycles[planet] || 0
}

// Get historical transit data for a planet-sign combination
export function getTransitHistory(planet: string, sign: string): TransitOccurrence[] {
  // This will be populated with comprehensive historical data
  // For now, returning calculated approximations
  const history: TransitOccurrence[] = []
  const cycleLength = getPlanetCycleLength(planet)
  const currentDate = new Date()

  // Calculate historical occurrences based on cycles
  for (let i = 1; i <= 10; i++) {
    const historicalDate = new Date(currentDate)
    historicalDate.setDate(historicalDate.getDate() - cycleLength * i)

    history.push({
      date: historicalDate,
      planet,
      sign,
      degree: 15, // Middle of sign as approximation
      retrograde: false,
      historicalContext: `Historical occurrence #${i}`,
    })
  }

  return history
}

// Calculate planetary returns
export function calculatePlanetaryReturn(
  planet: string,
  birthDate: Date,
  currentDate: Date = new Date()
): PlanetaryReturn {
  const cycleLength = getPlanetCycleLength(planet)
  const daysSinceBirth = Math.floor(
    (currentDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  const totalReturns = Math.floor(daysSinceBirth / cycleLength)

  const lastReturnDays = totalReturns * cycleLength
  const lastReturn = new Date(birthDate)
  lastReturn.setDate(lastReturn.getDate() + lastReturnDays)

  const nextReturnDays = (totalReturns + 1) * cycleLength
  const nextReturn = new Date(birthDate)
  nextReturn.setDate(nextReturn.getDate() + nextReturnDays)

  return {
    planet,
    cycleLength,
    lastReturn,
    nextReturn,
    totalReturns,
    significance: getReturnSignificance(planet, totalReturns),
  }
}

// Get significance of a planetary return
function getReturnSignificance(planet: string, returnNumber: number): string {
  const significances: Record<string, Record<number, string>> = {
    Jupiter: {
      1: 'First Jupiter Return - Age 12: Expansion of consciousness, first taste of independence',
      2: 'Second Jupiter Return - Age 24: Career beginnings, higher education completion',
      3: 'Third Jupiter Return - Age 36: Professional mastery, family expansion',
      4: 'Fourth Jupiter Return - Age 48: Wisdom teaching phase, mentorship',
      5: 'Fifth Jupiter Return - Age 60: Elder wisdom, philosophical maturity',
      6: 'Sixth Jupiter Return - Age 72: Sage advisor, legacy building',
      7: 'Seventh Jupiter Return - Age 84: Master teacher, spiritual completion',
    },
    Saturn: {
      1: 'First Saturn Return - Age 29-30: Major life restructuring, maturity milestone',
      2: 'Second Saturn Return - Age 58-60: Wisdom crystallization, elder transition',
      3: 'Third Saturn Return - Age 87-90: Life review, legacy completion',
    },
    Uranus: {
      1: 'Uranus Return - Age 84: Complete life revolution, freedom from convention',
    },
  }

  const planetSignificance = significances[planet]
  if (planetSignificance && planetSignificance[returnNumber]) {
    return planetSignificance[returnNumber]
  }

  return `${planet} Return #${returnNumber}: ${planet} completes another cycle`
}

// Temporary historical event database (to be replaced with actual database)
const historicalEventDatabase: Record<string, Array<{ date: string; description: string }>> = {
  Jupiter_Aries: [
    { date: '2011-01-22', description: 'Arab Spring begins - expansion of revolutionary energy' },
    { date: '2023-05-16', description: 'AI revolution accelerates - ChatGPT and new frontiers' },
  ],
  Jupiter_Taurus: [
    { date: '2000-02-14', description: 'Dot-com bubble peak - material expansion excess' },
    { date: '2012-06-11', description: 'European debt crisis - financial stability focus' },
  ],
  Saturn_Aquarius: [
    { date: '1991-02-06', description: 'End of Cold War - restructuring of global order' },
    { date: '2020-03-21', description: 'COVID-19 pandemic - social restructuring begins' },
  ],
  Pluto_Aquarius: [
    { date: '1778-01-01', description: 'American Revolution era - transformation of power' },
    { date: '2024-01-20', description: 'AI transformation era begins - digital revolution' },
  ],
}

// Get all transits for a specific date
export async function getTransitsForDate(
  date: Date,
  prisma?: PrismaClient
): Promise<HistoricalTransit[]> {
  if (prisma) {
    const transits = await prisma.planetaryTransit.findMany({
      where: {
        dateStart: { lte: date },
        dateEnd: { gte: date },
      },
      orderBy: { planet: 'asc' },
    })

    return transits.map(t => ({
      planet: t.planet,
      sign: t.sign,
      startDate: t.dateStart,
      endDate: t.dateEnd,
      degreeStart: t.degreeStart,
      degreeEnd: t.degreeEnd,
      retrograde: t.retrograde,
      historicalNote: t.historicalNote || undefined,
    }))
  }

  // Fallback calculation if no database
  return []
}

// Find similar historical configurations
export function findSimilarConfigurations(
  planetPositions: Record<string, { sign: string; degree: number }>,
  tolerance: number = 5 // degrees of tolerance
): Array<{ date: Date; similarity: number; description: string }> {
  // This will search historical database for similar planetary configurations
  // For now, returning example data
  return [
    {
      date: new Date('1969-07-20'),
      similarity: 0.92,
      description: 'Moon Landing - Similar Jupiter-Uranus configuration',
    },
    {
      date: new Date('1989-11-09'),
      similarity: 0.87,
      description: 'Berlin Wall Falls - Similar Saturn-Neptune aspect',
    },
  ]
}
