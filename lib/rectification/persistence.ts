import { auth } from '@/lib/auth'
import { getAlchemicalQuantitiesLegacy } from '@/lib/backend'
import { prisma } from '@/lib/db'
import { utcDateFromParts } from '@/lib/enhanced-astronomical-calculator'
import { generateAccurateHoroscope } from '@/lib/monica/horoscope-generator'
import { analyzePhiAxisIndex } from '@/lib/monica/monica-constant'
import { resolveRectificationCoordinates } from '@/lib/rectification/location'
import { runRectifyScore } from '@/lib/rectification/server-runner'
import {
  buildAscendantEstimateFromScore,
  normalizeEvidenceList,
  type RectifyEvidenceItem,
  type RectifyScoreResult,
} from '@/lib/rectification/types'
import {
  applyRectifiedBirthTimeToChart,
  getNatalChart,
  getPrimaryNatalChart,
  getUserNatalCharts,
  type NatalChartWithTransits,
} from '@/lib/services/natal-chart-storage'

export class RectificationEligibilityError extends Error {
  readonly score: RectifyScoreResult

  constructor(score: RectifyScoreResult, message?: string) {
    super(
      message ||
        'Rectification posterior has not reached calculation eligibility (>= 70% top sign and <= 180m window). Answer more questions or pass allowUnconfirmed=true to save a tentative working chart.'
    )
    this.name = 'RectificationEligibilityError'
    this.score = score
  }
}

export class RectificationNotFoundError extends Error {
  constructor(message = 'Natal chart not found') {
    super(message)
    this.name = 'RectificationNotFoundError'
  }
}

export function parseWorkingHourMinute(timeStr: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim())
  if (!m) return { hour: 12, minute: 0 }
  return {
    hour: Math.min(23, Math.max(0, parseInt(m[1], 10))),
    minute: Math.min(59, Math.max(0, parseInt(m[2], 10))),
  }
}

async function scoreAndValidateEligibility(params: {
  year: number
  month: number
  day: number
  latitude: number
  longitude: number
  calendar?: 'gregorian' | 'julian'
  evidence: RectifyEvidenceItem[]
  stepMinutes?: number
  allowUnconfirmed?: boolean
}) {
  const evidence = normalizeEvidenceList(params.evidence)
  const score = await runRectifyScore({
    year: params.year,
    month: params.month,
    day: params.day,
    latitude: params.latitude,
    longitude: params.longitude,
    calendar: params.calendar || 'gregorian',
    evidence,
    step_minutes: params.stepMinutes ?? 3,
  })

  if (!score.is_calculations_eligible && !params.allowUnconfirmed) {
    throw new RectificationEligibilityError(score)
  }

  const estimate = buildAscendantEstimateFromScore(score, evidence)
  return { evidence, score, estimate }
}

export interface PersistRectifiedProfileInput {
  userId: string
  userName?: string | null
  year: number
  month: number
  day: number
  latitude: number
  longitude: number
  calendar?: 'gregorian' | 'julian'
  locationName?: string
  name?: string
  evidence: RectifyEvidenceItem[]
  stepMinutes?: number
  allowUnconfirmed?: boolean
}

export async function persistRectifiedProfile(input: PersistRectifiedProfileInput) {
  const { score, estimate } = await scoreAndValidateEligibility({
    year: input.year,
    month: input.month,
    day: input.day,
    latitude: input.latitude,
    longitude: input.longitude,
    calendar: input.calendar,
    evidence: input.evidence,
    stepMinutes: input.stepMinutes ?? 3,
    allowUnconfirmed: input.allowUnconfirmed,
  })

  const { hour, minute } = parseWorkingHourMinute(score.working_time)
  const birthDate = utcDateFromParts(input.year, input.month, input.day, hour, minute)

  const horoscope = generateAccurateHoroscope({
    year: input.year,
    month: input.month,
    day: input.day,
    hour,
    minute,
    latitude: input.latitude,
    longitude: input.longitude,
  }) as Record<string, any>

  horoscope.ascendant = score.working_longitude
  horoscope.ascendantProvenance = 'rectified'
  horoscope.ascendantEstimate = estimate

  const alchm = await getAlchemicalQuantitiesLegacy(birthDate, input.latitude, input.longitude)
  const spirit = alchm?.['Alchemy Effects']?.['Total Spirit'] || 0
  const essence = alchm?.['Alchemy Effects']?.['Total Essence'] || 0
  const matter = alchm?.['Alchemy Effects']?.['Total Matter'] || 0
  const substance = alchm?.['Alchemy Effects']?.['Total Substance'] || 0

  const phiAxis = analyzePhiAxisIndex({
    spirit,
    essence,
    matter,
    substance,
    Heat: alchm?.Heat || 0,
    Entropy: alchm?.Entropy || 0,
    Reactivity: alchm?.Reactivity || 0,
    Energy: alchm?.Energy || 0,
  })

  const zeroBasedMonth = input.month - 1
  const profile = await prisma.user_profiles.upsert({
    where: { userId: input.userId },
    update: {
      birthDate,
      birthTime: score.working_time,
      birthLocation: {
        name: input.locationName || 'Unknown',
        latitude: input.latitude,
        longitude: input.longitude,
      },
      natalChart: horoscope as any,
      monicaConstant: phiAxis.value,
      dominantElement: (alchm as any)?.['Dominant Element'] || 'Fire',
    },
    create: {
      userId: input.userId,
      birthDate,
      birthTime: score.working_time,
      birthLocation: {
        name: input.locationName || 'Unknown',
        latitude: input.latitude,
        longitude: input.longitude,
      },
      natalChart: horoscope as any,
      monicaConstant: phiAxis.value,
      dominantElement: (alchm as any)?.['Dominant Element'] || 'Fire',
    },
  })

  await prisma.profiles.upsert({
    where: { userId: input.userId },
    update: {
      ...(input.name ? { name: input.name } : {}),
      birthInfo: {
        year: input.year,
        month: zeroBasedMonth,
        day: input.day,
        hour,
        minute,
        latitude: input.latitude,
        longitude: input.longitude,
      },
    },
    create: {
      userId: input.userId,
      name: input.name || input.userName || 'Explorer',
      avatarUrl: null,
      birthInfo: {
        year: input.year,
        month: zeroBasedMonth,
        day: input.day,
        hour,
        minute,
        latitude: input.latitude,
        longitude: input.longitude,
      },
    },
  })

  return {
    ok: true as const,
    action: 'apply_profile' as const,
    isCalculationsEligible: score.is_calculations_eligible,
    workingTime: score.working_time,
    estimate,
    score,
    profile,
  }
}

export interface PersistRectifiedChartInput {
  userId: string
  chartId?: string
  evidence: RectifyEvidenceItem[]
  stepMinutes?: number
  allowUnconfirmed?: boolean
}

async function resolveUserChartForUser(
  userId: string,
  chartId?: string
): Promise<NatalChartWithTransits | null> {
  if (chartId) {
    return await getNatalChart(chartId, userId)
  }
  if (typeof getPrimaryNatalChart === 'function') {
    const primary = await getPrimaryNatalChart(userId)
    if (primary) return primary
  }
  if (typeof getUserNatalCharts === 'function') {
    const charts = await getUserNatalCharts(userId, true)
    if (Array.isArray(charts) && charts.length > 0) {
      return charts[0]
    }
  }
  return null
}

function extractChartCoordinates(chart: NatalChartWithTransits): {
  latitude: number
  longitude: number
  name?: string
} {
  const loc = (chart.birthLocation || {}) as {
    lat?: number
    lon?: number
    latitude?: number
    longitude?: number
    name?: string
  }
  const latitude =
    typeof loc.lat === 'number' ? loc.lat : typeof loc.latitude === 'number' ? loc.latitude : 0
  const longitude =
    typeof loc.lon === 'number' ? loc.lon : typeof loc.longitude === 'number' ? loc.longitude : 0
  return {
    latitude,
    longitude,
    ...(typeof loc.name === 'string' && loc.name ? { name: loc.name } : {}),
  }
}

export async function persistRectifiedChart(input: PersistRectifiedChartInput) {
  const existingChart = await resolveUserChartForUser(input.userId, input.chartId)
  if (!existingChart) {
    throw new RectificationNotFoundError('Natal chart not found')
  }

  const coords = extractChartCoordinates(existingChart)
  const bd = new Date(existingChart.birthDate)

  const { score, estimate } = await scoreAndValidateEligibility({
    year: bd.getUTCFullYear(),
    month: bd.getUTCMonth() + 1,
    day: bd.getUTCDate(),
    latitude: coords.latitude,
    longitude: coords.longitude,
    calendar: 'gregorian',
    evidence: input.evidence,
    stepMinutes: input.stepMinutes ?? 3,
    allowUnconfirmed: input.allowUnconfirmed,
  })

  const updatedChart = await applyRectifiedBirthTimeToChart(
    existingChart.id,
    input.userId,
    score.working_time,
    estimate
  )

  return {
    ok: true as const,
    action: 'apply_chart' as const,
    isCalculationsEligible: score.is_calculations_eligible,
    workingTime: score.working_time,
    estimate,
    score,
    chart: updatedChart,
  }
}

export interface PersistRectifiedAscendantInput {
  userId: string
  userName?: string | null
  target?: 'auto' | 'profile' | 'chart' | 'both'
  chartId?: string
  year?: number
  month?: number
  day?: number
  location?: string
  locationName?: string
  latitude?: number
  longitude?: number
  calendar?: 'gregorian' | 'julian'
  name?: string
  evidence: RectifyEvidenceItem[]
  stepMinutes?: number
  allowUnconfirmed?: boolean
}

/**
 * Shared entrypoint for conversational rectification persistence (`rectify_apply`).
 * Resolves city strings, falls back to the authenticated user's saved profile or primary
 * chart birth metadata when omitted, enforces eligibility unless `allowUnconfirmed` is true,
 * and saves to `user_profiles`, `profiles`, and/or `UserNatalChart`.
 */
export async function persistRectifiedAscendant(input: PersistRectifiedAscendantInput) {
  const target = input.target ?? (input.chartId ? 'chart' : 'auto')

  if (target === 'chart') {
    return await persistRectifiedChart({
      userId: input.userId,
      chartId: input.chartId,
      evidence: input.evidence,
      stepMinutes: input.stepMinutes,
      allowUnconfirmed: input.allowUnconfirmed,
    })
  }

  let year = input.year
  let month = input.month
  let day = input.day
  let latitude = input.latitude
  let longitude = input.longitude
  let locationName = input.locationName || input.location
  let existingChart: NatalChartWithTransits | null = null

  const needsDate = typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number'
  const needsCoords = typeof latitude !== 'number' || typeof longitude !== 'number'

  if (needsDate || (needsCoords && !locationName) || target === 'both' || target === 'auto') {
    try {
      existingChart = await resolveUserChartForUser(input.userId, input.chartId)
    } catch {
      existingChart = null
    }
  }

  if (existingChart) {
    if (needsDate && existingChart.birthDate) {
      const bd = new Date(existingChart.birthDate)
      if (!Number.isNaN(bd.getTime())) {
        year = bd.getUTCFullYear()
        month = bd.getUTCMonth() + 1
        day = bd.getUTCDate()
      }
    }
    if (needsCoords && !locationName) {
      const chartCoords = extractChartCoordinates(existingChart)
      if (chartCoords.latitude !== 0 || chartCoords.longitude !== 0) {
        latitude = chartCoords.latitude
        longitude = chartCoords.longitude
        locationName = locationName || chartCoords.name
      }
    }
  }

  if (
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    typeof day !== 'number' ||
    (typeof latitude !== 'number' && !locationName)
  ) {
    const userProfile =
      typeof prisma.user_profiles?.findUnique === 'function'
        ? await prisma.user_profiles
            .findUnique({ where: { userId: input.userId } })
            .catch(() => null)
        : null
    if (userProfile) {
      if (
        (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') &&
        userProfile.birthDate
      ) {
        const bd = new Date(userProfile.birthDate)
        if (!Number.isNaN(bd.getTime())) {
          year = bd.getUTCFullYear()
          month = bd.getUTCMonth() + 1
          day = bd.getUTCDate()
        }
      }
      const loc = (userProfile.birthLocation || {}) as {
        name?: string
        latitude?: number
        longitude?: number
      }
      if (
        typeof latitude !== 'number' &&
        typeof longitude !== 'number' &&
        !locationName &&
        typeof loc.latitude === 'number' &&
        typeof loc.longitude === 'number'
      ) {
        latitude = loc.latitude
        longitude = loc.longitude
        locationName = loc.name
      }
    }
  }

  if (
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    typeof day !== 'number' ||
    (typeof latitude !== 'number' && !locationName)
  ) {
    const profileMeta =
      typeof prisma.profiles?.findUnique === 'function'
        ? await prisma.profiles.findUnique({ where: { userId: input.userId } }).catch(() => null)
        : null
    const info = (profileMeta?.birthInfo || {}) as {
      year?: number
      month?: number
      day?: number
      latitude?: number
      longitude?: number
    }
    if (
      typeof year !== 'number' &&
      typeof info.year === 'number' &&
      typeof info.month === 'number' &&
      typeof info.day === 'number'
    ) {
      year = info.year
      // prisma.profiles.birthInfo stores month 0-based (0..11)
      month = info.month + 1
      day = info.day
    }
    if (
      typeof latitude !== 'number' &&
      typeof longitude !== 'number' &&
      !locationName &&
      typeof info.latitude === 'number' &&
      typeof info.longitude === 'number'
    ) {
      latitude = info.latitude
      longitude = info.longitude
    }
  }

  if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') {
    throw new Error('Birth date (year, month, day) is required to save your rectified ascendant.')
  }

  const resolvedCoords = await resolveRectificationCoordinates({
    year,
    month,
    day,
    location: locationName,
    latitude,
    longitude,
  })

  const resolvedLocationName =
    input.locationName || resolvedCoords.locationName || locationName || 'Unknown'

  const profileResult = await persistRectifiedProfile({
    userId: input.userId,
    userName: input.userName,
    year,
    month,
    day,
    latitude: resolvedCoords.latitude,
    longitude: resolvedCoords.longitude,
    calendar: input.calendar,
    locationName: resolvedLocationName,
    name: input.name,
    evidence: input.evidence,
    stepMinutes: input.stepMinutes,
    allowUnconfirmed: input.allowUnconfirmed,
  })

  let updatedChart: NatalChartWithTransits | null = null
  if ((target === 'both' || target === 'auto') && existingChart) {
    updatedChart = await applyRectifiedBirthTimeToChart(
      existingChart.id,
      input.userId,
      profileResult.workingTime,
      profileResult.estimate
    )
  }

  return {
    ...profileResult,
    resolvedCoordinates: resolvedCoords,
    ...(updatedChart ? { chart: updatedChart } : {}),
  }
}

export async function getAuthenticatedRectificationUser(): Promise<{
  id: string
  name?: string | null
  email?: string | null
} | null> {
  try {
    const session = await auth()
    if (!session?.user?.id) return null
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }
  } catch {
    return null
  }
}
