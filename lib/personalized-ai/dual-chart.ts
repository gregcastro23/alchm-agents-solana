// Dual Chart System Implementation for Personalized AI

import type {
  BirthChartData,
  CurrentMomentChart,
  TransitInfluences,
  CombinedInfluences,
  DualChartSystem,
  AspectData,
  TrainingCategory,
} from '../types/personalized-ai'

import { alchemize } from '../alchemizer'
import {
  dateToJulianDay,
  calculateEnhancedPlanetPosition,
} from '../enhanced-astronomical-calculator'

// Aspect configurations
const ASPECT_ORBS = {
  conjunction: 8,
  sextile: 6,
  square: 8,
  trine: 8,
  opposition: 8,
  quincunx: 3,
}

const ASPECT_ANGLES = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  quincunx: 150,
  opposition: 180,
}

/**
 * Generate birth chart data using the alchemizer
 */
export async function generateBirthChart(
  birthInfo: {
    date: string
    time: string
    location: string
    name: string
  },
  horoscopeData?: any
): Promise<BirthChartData> {
  // Use the alchemizer to generate chart data
  const alchemicalData = await alchemize(birthInfo, horoscopeData)

  // Transform to our format
  const birthChart: BirthChartData = {
    timestamp: new Date().toISOString(),
    birthInfo,
    planets: transformPlanetData(horoscopeData),
    alchemicalData: {
      Spirit: alchemicalData.Spirit || 0,
      Essence: alchemicalData.Essence || 0,
      Matter: alchemicalData.Matter || 0,
      Substance: alchemicalData.Substance || 0,
      ANumber: alchemicalData.ANumber || 0,
      DayEssence: alchemicalData.DayEssence || 0,
      NightEssence: alchemicalData.NightEssence || 0,
    },
    houses: horoscopeData?.houses,
    aspects: calculateAspects(horoscopeData),
  }

  return birthChart
}

/**
 * Generate current moment chart
 */
export async function generateCurrentMomentChart(): Promise<CurrentMomentChart> {
  const now = new Date()
  const currentMomentInfo = {
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0].substring(0, 5),
    location: 'Current Location',
    name: 'Current Moment',
  }

  // Real geocentric positions for the current moment. Falls back to static
  // positions only if the ephemeris calc throws — and flags the chart as
  // degraded (dataSource) rather than silently substituting mock data.
  const { planets: currentPlanets, source } = await generateCurrentMomentHoroscope()
  const horoscopeData = { planets: currentPlanets }

  const alchemicalData = await alchemize(currentMomentInfo, horoscopeData)

  return {
    timestamp: now.toISOString(),
    planets: transformPlanetData(horoscopeData),
    alchemicalData: {
      Spirit: alchemicalData.Spirit || 0,
      Essence: alchemicalData.Essence || 0,
      Matter: alchemicalData.Matter || 0,
      Substance: alchemicalData.Substance || 0,
      ANumber: alchemicalData.ANumber || 0,
      DayEssence: alchemicalData.DayEssence || 0,
      NightEssence: alchemicalData.NightEssence || 0,
    },
    aspects: calculateAspects(horoscopeData),
    dataSource: source,
  }
}

const CURRENT_MOMENT_PLANETS = [
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

/**
 * Compute real geocentric planet positions for "now" via the VSOP87 calculator.
 * Planet ecliptic longitudes are location-independent (only the ascendant needs
 * coordinates, which the current-moment chart doesn't use), so no location is
 * required. On calc failure we fall back to static positions but say so loudly
 * and mark the result `fallback`, instead of silently returning mock data.
 */
async function generateCurrentMomentHoroscope(): Promise<{
  planets: Record<string, { sign: string; degree: number }>
  source: 'live' | 'fallback'
}> {
  try {
    const jd = dateToJulianDay(new Date())
    const planets: Record<string, { sign: string; degree: number }> = {}
    for (const name of CURRENT_MOMENT_PLANETS) {
      const pos = calculateEnhancedPlanetPosition(name, jd)
      planets[name] = { sign: pos.sign, degree: pos.signDegree }
    }
    return { planets, source: 'live' }
  } catch (err) {
    console.warn(
      '[dual-chart] live planetary calculation failed; using static fallback positions (chart marked degraded)',
      err
    )
    const mock = await generateMockHoroscopeData()
    return { planets: mock.planets, source: 'fallback' }
  }
}

/**
 * Analyze transits between birth and current charts
 */
export function analyzeTransits(
  birthChart: BirthChartData,
  currentChart: CurrentMomentChart
): TransitInfluences {
  const majorTransits: TransitInfluences['majorTransits'] = []

  // Calculate aspects between current and natal planets
  for (const [currentPlanet, currentData] of Object.entries(currentChart.planets)) {
    for (const [natalPlanet, natalData] of Object.entries(birthChart.planets)) {
      const aspect = calculateAspect(currentData.degree, natalData.degree)

      if (aspect) {
        majorTransits.push({
          transitPlanet: currentPlanet,
          natalPlanet,
          aspect: aspect.type,
          orb: aspect.orb,
          influence: getAspectInfluence(aspect.type),
          themes: getTransitThemes(currentPlanet, natalPlanet, aspect.type),
        })
      }
    }
  }

  // Calculate current mood based on transits
  const currentMood = calculateCurrentMood(majorTransits, currentChart)

  // Generate recommendations
  const recommendations = generateTransitRecommendations(majorTransits, currentMood)

  return {
    majorTransits,
    currentMood,
    recommendations,
  }
}

/**
 * Synthesize personality based on both charts
 */
export function synthesizePersonality(
  birthChart: BirthChartData,
  currentChart: CurrentMomentChart,
  transits: TransitInfluences
): CombinedInfluences {
  // Calculate overall energy
  const overallEnergy = calculateOverallEnergy(
    birthChart.alchemicalData,
    currentChart.alchemicalData,
    transits
  )

  // Determine dominant themes
  const dominantThemes = extractDominantThemes(transits, birthChart, currentChart)

  // Generate training recommendations
  const trainingRecommendations = generateTrainingRecommendations(
    transits,
    dominantThemes,
    currentChart
  )

  // Calculate personality adjustments
  const personalityAdjustments = calculatePersonalityAdjustments(transits, dominantThemes)

  return {
    overallEnergy,
    dominantThemes,
    trainingRecommendations,
    personalityAdjustments,
  }
}

/**
 * Create complete dual chart system
 */
export async function createDualChartSystem(
  birthInfo: {
    date: string
    time: string
    location: string
    name: string
  },
  horoscopeData?: any
): Promise<DualChartSystem> {
  const birthChart = await generateBirthChart(birthInfo, horoscopeData)
  const currentChart = await generateCurrentMomentChart()
  const transits = analyzeTransits(birthChart, currentChart)
  const combinedInfluences = synthesizePersonality(birthChart, currentChart, transits)

  return {
    birthChart,
    currentChart,
    transits,
    combinedInfluences,
  }
}

// Helper Functions

function transformPlanetData(horoscopeData: any): Record<string, { sign: string; degree: number }> {
  const planets: Record<string, { sign: string; degree: number }> = {}

  if (horoscopeData?.planets) {
    for (const [planet, data] of Object.entries(horoscopeData.planets)) {
      if (typeof data === 'object' && data !== null) {
        planets[planet] = {
          sign: (data as any).sign || 'Aries',
          degree: (data as any).degree || 0,
        }
      }
    }
  }

  return planets
}

function calculateAspects(horoscopeData: any): AspectData[] {
  const aspects: AspectData[] = []
  const planets = horoscopeData?.planets || {}
  const planetNames = Object.keys(planets)

  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const planet1 = planetNames[i]
      const planet2 = planetNames[j]
      const degree1 = planets[planet1]?.degree || 0
      const degree2 = planets[planet2]?.degree || 0

      const aspect = calculateAspect(degree1, degree2)
      if (aspect) {
        aspects.push({
          planet1,
          planet2,
          aspect: aspect.type,
          orb: aspect.orb,
          applying: aspect.applying,
        })
      }
    }
  }

  return aspects
}

function calculateAspect(
  degree1: number,
  degree2: number
): { type: string; orb: number; applying: boolean } | null {
  let diff = Math.abs(degree1 - degree2)
  if (diff > 180) diff = 360 - diff

  for (const [aspectName, angle] of Object.entries(ASPECT_ANGLES)) {
    const orb = Math.abs(diff - angle)
    if (orb <= ASPECT_ORBS[aspectName as keyof typeof ASPECT_ORBS]) {
      return {
        type: aspectName,
        orb: Math.round(orb * 10) / 10,
        applying: degree1 < degree2,
      }
    }
  }

  return null
}

function getAspectInfluence(aspectType: string): 'harmonious' | 'challenging' | 'neutral' {
  const harmonious = ['trine', 'sextile']
  const challenging = ['square', 'opposition']

  if (harmonious.includes(aspectType)) return 'harmonious'
  if (challenging.includes(aspectType)) return 'challenging'
  return 'neutral'
}

function getTransitThemes(
  transitPlanet: string,
  natalPlanet: string,
  aspectType: string
): string[] {
  const themes: string[] = []

  // Add themes based on planets involved
  if (transitPlanet === 'Jupiter') themes.push('expansion', 'growth', 'opportunity')
  if (transitPlanet === 'Saturn') themes.push('discipline', 'structure', 'responsibility')
  if (natalPlanet === 'Sun') themes.push('identity', 'self-expression', 'vitality')
  if (natalPlanet === 'Moon') themes.push('emotions', 'intuition', 'comfort')

  // Add themes based on aspect type
  if (aspectType === 'conjunction') themes.push('new beginnings', 'intensity')
  if (aspectType === 'trine') themes.push('flow', 'ease', 'harmony')
  if (aspectType === 'square') themes.push('challenge', 'growth through tension')

  return themes
}

function calculateCurrentMood(
  transits: TransitInfluences['majorTransits'],
  currentChart: CurrentMomentChart
): TransitInfluences['currentMood'] {
  let energy = 50
  let creativity = 50
  let communication = 50
  let emotion = 50
  let intellect = 50
  let intuition = 50

  // Adjust based on transits
  for (const transit of transits) {
    const influence = transit.influence === 'harmonious' ? 10 : -5

    if (transit.transitPlanet === 'Mars') energy += influence
    if (transit.transitPlanet === 'Venus') creativity += influence
    if (transit.transitPlanet === 'Mercury') communication += influence
    if (transit.natalPlanet === 'Moon') emotion += influence
    if (transit.transitPlanet === 'Mercury') intellect += influence
    if (transit.natalPlanet === 'Neptune') intuition += influence
  }

  // Normalize to 0-100 range
  return {
    energy: Math.max(0, Math.min(100, energy)),
    creativity: Math.max(0, Math.min(100, creativity)),
    communication: Math.max(0, Math.min(100, communication)),
    emotion: Math.max(0, Math.min(100, emotion)),
    intellect: Math.max(0, Math.min(100, intellect)),
    intuition: Math.max(0, Math.min(100, intuition)),
  }
}

function generateTransitRecommendations(
  transits: TransitInfluences['majorTransits'],
  mood: TransitInfluences['currentMood']
): string[] {
  const recommendations: string[] = []

  if (mood.energy > 70) {
    recommendations.push('High energy period - great for tackling challenging topics')
  }
  if (mood.creativity > 70) {
    recommendations.push('Enhanced creativity - explore imaginative conversations')
  }
  if (mood.communication > 70) {
    recommendations.push('Excellent communication flow - perfect for deep discussions')
  }

  // Add specific transit recommendations
  const hasJupiterTransit = transits.some(t => t.transitPlanet === 'Jupiter')
  if (hasJupiterTransit) {
    recommendations.push('Jupiter transit brings expansion - think big!')
  }

  return recommendations
}

function calculateOverallEnergy(
  birthAlchemical: BirthChartData['alchemicalData'],
  currentAlchemical: CurrentMomentChart['alchemicalData'],
  transits: TransitInfluences
): number {
  // Base energy from birth chart
  let energy = (birthAlchemical.Spirit + birthAlchemical.ANumber) / 2

  // Modify based on current chart
  const currentModifier = (currentAlchemical.Spirit + currentAlchemical.ANumber) / 200
  energy = energy * (1 + currentModifier)

  // Adjust for transits
  const harmoniousCount = transits.majorTransits.filter(t => t.influence === 'harmonious').length
  const challengingCount = transits.majorTransits.filter(t => t.influence === 'challenging').length

  energy += harmoniousCount * 5 - challengingCount * 2

  return Math.max(0, Math.min(100, energy))
}

function extractDominantThemes(
  transits: TransitInfluences,
  birthChart: BirthChartData,
  currentChart: CurrentMomentChart
): string[] {
  const themeCount: Record<string, number> = {}

  // Count themes from transits
  for (const transit of transits.majorTransits) {
    for (const theme of transit.themes) {
      themeCount[theme] = (themeCount[theme] || 0) + 1
    }
  }

  // Sort by frequency and take top themes
  return Object.entries(themeCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([theme]) => theme)
}

function generateTrainingRecommendations(
  transits: TransitInfluences,
  themes: string[],
  currentChart: CurrentMomentChart
): CombinedInfluences['trainingRecommendations'] {
  const recommendations: CombinedInfluences['trainingRecommendations'] = []

  // Map themes to training categories
  if (themes.includes('communication') || transits.currentMood.communication > 70) {
    recommendations.push({
      category: 'communication_style',
      reason: 'Current energies favor communication development',
      effectiveness: transits.currentMood.communication,
    })
  }

  if (themes.includes('emotions') || transits.currentMood.emotion > 70) {
    recommendations.push({
      category: 'emotional_intelligence',
      reason: 'Heightened emotional awareness period',
      effectiveness: transits.currentMood.emotion,
    })
  }

  if (themes.includes('creativity') || transits.currentMood.creativity > 70) {
    recommendations.push({
      category: 'creativity',
      reason: 'Creative energies are amplified',
      effectiveness: transits.currentMood.creativity,
    })
  }

  return recommendations
}

function calculatePersonalityAdjustments(
  transits: TransitInfluences,
  themes: string[]
): Record<string, string[]> {
  const adjustments: Record<string, string[]> = {}

  // Communication adjustments
  if (transits.currentMood.communication > 70) {
    adjustments.communication = [
      'More articulate expression',
      'Enhanced vocabulary usage',
      'Clearer explanations',
    ]
  }

  // Emotional adjustments
  if (transits.currentMood.emotion > 70) {
    adjustments.emotional = [
      'Increased empathy',
      'Deeper emotional understanding',
      'More nuanced responses',
    ]
  }

  // Energy adjustments
  if (transits.currentMood.energy > 70) {
    adjustments.energy = ['More enthusiastic tone', 'Proactive suggestions', 'Dynamic engagement']
  }

  return adjustments
}

// Static fallback positions — used only when the live ephemeris calc fails
// (see generateCurrentMomentHoroscope, which flags such charts as `fallback`).
async function generateMockHoroscopeData(): Promise<any> {
  return {
    planets: {
      Sun: { sign: 'Aries', degree: 15 },
      Moon: { sign: 'Cancer', degree: 22 },
      Mercury: { sign: 'Pisces', degree: 28 },
      Venus: { sign: 'Taurus', degree: 10 },
      Mars: { sign: 'Gemini', degree: 5 },
      Jupiter: { sign: 'Leo', degree: 18 },
      Saturn: { sign: 'Capricorn', degree: 25 },
      Uranus: { sign: 'Aquarius', degree: 12 },
      Neptune: { sign: 'Pisces', degree: 20 },
      Pluto: { sign: 'Scorpio', degree: 8 },
    },
  }
}
