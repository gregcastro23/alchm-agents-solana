import { z } from 'zod'
import { logger } from '@/lib/structured-logger'
import { getToolExecutionContext } from '@/lib/langchain/tool-context'
import { resolveRectificationCoordinates } from '@/lib/rectification/location'
import {
  getAuthenticatedRectificationUser,
  persistRectifiedAscendant,
  RectificationEligibilityError,
  RectificationNotFoundError,
} from '@/lib/rectification/persistence'
import { runRectifyScore, runRectifyWindows } from '@/lib/rectification/server-runner'
import { normalizeEvidenceList } from '@/lib/rectification/types'

export const RectificationEvidenceItemSchema = z.object({
  type: z
    .enum([
      'life_event',
      'recorded_time',
      'time_clue',
      'moon_sign',
      'angular_transits',
      'secondary_progressions',
      'annual_profections',
      'primary_directions',
      'physical_temperament',
    ])
    .describe('Type of evidence'),
  description: z.string().optional().describe('Biographical description or event title'),
  category: z
    .enum(['career', 'marriage', 'relocation', 'illness', 'general'])
    .optional()
    .describe('Domain category for life_event cusp routing (MC/DSC/IC/ASC)'),
  date: z.string().optional().describe('ISO date of event (YYYY-MM-DD)'),
  event_date: z.string().optional().describe('ISO date of event (YYYY-MM-DD)'),
  time: z.string().optional().describe('Recorded birth time (HH:MM) if type is recorded_time'),
  reported_minute: z
    .number()
    .min(0)
    .max(1439)
    .optional()
    .describe('Reported LMT minute (0-1439) if type is recorded_time'),
  rodden_rating: z
    .enum(['AA', 'A', 'B', 'C', 'DD'])
    .optional()
    .describe('Rodden rating reliability'),
  start_minute: z
    .number()
    .min(0)
    .max(1439)
    .optional()
    .describe('Window start minute LMT (0-1439) for time_clue'),
  end_minute: z
    .number()
    .min(0)
    .max(1439)
    .optional()
    .describe('Window end minute LMT (0-1439) for time_clue'),
  margin_minutes: z
    .number()
    .min(5)
    .max(240)
    .optional()
    .describe('Soft Gaussian margin in minutes for time_clue'),
  window: z
    .enum(['dawn', 'morning', 'afternoon', 'dusk', 'night'])
    .optional()
    .describe('Solar diurnal window shorthand if start_minute/end_minute omitted'),
  moon_sign: z.string().optional().describe('Moon sign if type is moon_sign'),
  expected_sign: z.string().optional().describe('Alias for moon_sign if type is moon_sign'),
  affinity: z
    .record(z.number())
    .optional()
    .describe('Capped sign affinity weights [0.67..1.50] for physical_temperament'),
})

export const geocodeLocationInputSchema = z.object({
  location: z
    .string()
    .min(2)
    .describe(
      'City, state/province, and/or country name (e.g. "Chicago, IL", "Bangkok, Thailand")'
    ),
  year: z
    .number()
    .int()
    .min(1)
    .max(2200)
    .optional()
    .describe('Optional reference year for historical timezone offset'),
  month: z.number().int().min(1).max(12).optional().describe('Optional reference month (1-12)'),
  day: z.number().int().min(1).max(31).optional().describe('Optional reference day (1-31)'),
})

export const rectifyWindowsInputSchema = z.object({
  year: z.number().describe('Birth year (e.g. 1990 or 1879)'),
  month: z.number().min(1).max(12).describe('Birth month (1-12)'),
  day: z.number().min(1).max(31).describe('Birth day (1-31)'),
  location: z
    .string()
    .optional()
    .describe(
      'Birth city/country string (e.g. "Chicago, IL") when latitude/longitude are not explicitly provided'
    ),
  latitude: z.number().min(-90).max(90).optional().describe('Geographic latitude of birth place'),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe('Geographic longitude of birth place'),
  calendar: z
    .enum(['gregorian', 'julian'])
    .optional()
    .default('gregorian')
    .describe('Calendar system (default: gregorian)'),
})

export const rectifyScoreInputSchema = z.object({
  year: z.number().describe('Birth year'),
  month: z.number().min(1).max(12).describe('Birth month (1-12)'),
  day: z.number().min(1).max(31).describe('Birth day (1-31)'),
  location: z
    .string()
    .optional()
    .describe(
      'Birth city/country string (e.g. "Chicago, IL") when latitude/longitude are not explicitly provided'
    ),
  latitude: z.number().min(-90).max(90).optional().describe('Geographic latitude of birth place'),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe('Geographic longitude of birth place'),
  calendar: z.enum(['gregorian', 'julian']).optional().default('gregorian'),
  evidence: z
    .array(RectificationEvidenceItemSchema)
    .describe('List of biographical evidence items, dated milestones, or recorded time clues'),
  step_minutes: z
    .number()
    .optional()
    .default(5)
    .describe('Sampling resolution in minutes (1 to 10, default: 5)'),
})

export const rectifyApplyInputSchema = z.object({
  target: z
    .enum(['auto', 'profile', 'chart', 'both'])
    .optional()
    .default('auto')
    .describe('Persistence target: auto saves user profile and updates primary chart if present'),
  chartId: z.string().optional().describe('Optional explicit saved natal chart ID'),
  year: z
    .number()
    .int()
    .min(1900)
    .max(2100)
    .optional()
    .describe('Birth year (required if user does not already have a saved profile/chart)'),
  month: z.number().int().min(1).max(12).optional().describe('Birth month (1-12)'),
  day: z.number().int().min(1).max(31).optional().describe('Birth day (1-31)'),
  location: z.string().optional().describe('Birth city/country string (e.g. "Chicago, IL")'),
  locationName: z.string().optional().describe('Display name of birth location'),
  latitude: z.number().min(-90).max(90).optional().describe('Geographic latitude'),
  longitude: z.number().min(-180).max(180).optional().describe('Geographic longitude'),
  calendar: z.enum(['gregorian', 'julian']).optional().default('gregorian'),
  name: z.string().optional().describe('Optional profile display name'),
  evidence: z
    .array(RectificationEvidenceItemSchema)
    .min(1)
    .max(30)
    .describe('Cumulative evidence items supporting the rectified ascendant'),
  step_minutes: z.number().int().min(1).max(10).optional().default(3),
  allowUnconfirmed: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Only set true if posterior has not met >=70% / <=180m gate and the user explicitly requested saving a tentative working estimate'
    ),
})

export async function executeGeocodeLocationTool(
  input: z.infer<typeof geocodeLocationInputSchema>
) {
  logger.info('Tool call: geocode_location', {
    system: 'langchain-tools',
    operation: 'geocode_location',
    metadata: { location: input.location, year: input.year, month: input.month, day: input.day },
  })

  const resolved = await resolveRectificationCoordinates({
    location: input.location,
    year: input.year,
    month: input.month,
    day: input.day,
  })

  return {
    success: true,
    location: resolved.locationName || input.location,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    timezone: resolved.timezone ?? null,
    utcOffsetHours: resolved.utcOffsetHours,
    lmtOffsetHours: resolved.lmtOffsetHours,
    clockToLmtMinutes: resolved.clockToLmtMinutes,
  }
}

export async function executeRectifyWindowsTool(input: z.infer<typeof rectifyWindowsInputSchema>) {
  const coords = await resolveRectificationCoordinates({
    year: input.year,
    month: input.month,
    day: input.day,
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
  })

  logger.info('Tool call: rectify_windows', {
    system: 'langchain-tools',
    operation: 'rectify_windows',
    metadata: {
      year: input.year,
      month: input.month,
      day: input.day,
      latitude: coords.latitude,
      longitude: coords.longitude,
      calendar: input.calendar || 'gregorian',
      locationName: coords.locationName,
    },
  })

  const res = await runRectifyWindows({
    year: input.year,
    month: input.month,
    day: input.day,
    latitude: coords.latitude,
    longitude: coords.longitude,
    calendar: input.calendar || 'gregorian',
  })

  return {
    success: true,
    resolvedLocation: coords,
    entropyBits: res.entropy_bits,
    recommendedNextQuestion: res.next_best_questions?.[0] ?? null,
    data: res || {},
  }
}

export async function executeRectifyScoreTool(input: z.infer<typeof rectifyScoreInputSchema>) {
  const coords = await resolveRectificationCoordinates({
    year: input.year,
    month: input.month,
    day: input.day,
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
  })

  const normalizedEvidence = normalizeEvidenceList(input.evidence)
  const clampedStep = Math.min(10, Math.max(1, Math.round(input.step_minutes ?? 5)))

  logger.info('Tool call: rectify_score', {
    system: 'langchain-tools',
    operation: 'rectify_score',
    metadata: {
      year: input.year,
      month: input.month,
      day: input.day,
      latitude: coords.latitude,
      longitude: coords.longitude,
      step_minutes: clampedStep,
      evidenceCount: normalizedEvidence.length,
    },
  })

  const res = await runRectifyScore({
    year: input.year,
    month: input.month,
    day: input.day,
    latitude: coords.latitude,
    longitude: coords.longitude,
    calendar: input.calendar || 'gregorian',
    evidence: normalizedEvidence,
    step_minutes: clampedStep,
  })

  return {
    success: true,
    topSign: res.top_sign,
    topSignProbability: res.top_sign_probability,
    workingTime: res.working_time,
    workingLongitude: res.working_longitude,
    window80Minutes: res.window_80_minutes,
    entropyBits: res.entropy_bits,
    calculationEligible: res.is_calculations_eligible,
    recommendedNextQuestion: res.next_best_questions?.[0] ?? null,
    resolvedLocation: coords,
    data: res || {},
  }
}

export async function executeRectifyApplyTool(input: z.infer<typeof rectifyApplyInputSchema>) {
  const ctx = getToolExecutionContext()
  let userId = ctx?.userId
  let userName = ctx?.userName

  if (!userId) {
    const sessionUser = await getAuthenticatedRectificationUser()
    userId = sessionUser?.id
    userName = sessionUser?.name
  }

  if (!userId) {
    return {
      success: false,
      requiresAuth: true,
      rectifyUrl: '/rectify',
      message:
        'You need to be signed in before I can save your rectified Ascendant to your profile or natal chart. Please sign in and ask again, or visit /rectify to complete and save your rectification.',
    }
  }

  logger.info('Tool call: rectify_apply', {
    system: 'langchain-tools',
    operation: 'rectify_apply',
    metadata: {
      userId,
      target: input.target || 'auto',
      chartId: input.chartId || ctx?.chartId,
      evidenceCount: input.evidence.length,
      allowUnconfirmed: Boolean(input.allowUnconfirmed),
    },
  })

  try {
    const result = await persistRectifiedAscendant({
      userId,
      userName,
      target: input.target || 'auto',
      chartId: input.chartId || ctx?.chartId,
      year: input.year,
      month: input.month,
      day: input.day,
      location: input.location,
      locationName: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      calendar: input.calendar || 'gregorian',
      name: input.name,
      evidence: input.evidence,
      stepMinutes: input.step_minutes ?? 3,
      allowUnconfirmed: input.allowUnconfirmed,
    })

    return {
      success: true,
      action: result.action,
      isCalculationsEligible: result.isCalculationsEligible,
      workingTime: result.workingTime,
      workingLongitude: result.score.working_longitude,
      topSign: result.score.top_sign,
      topSignProbability: result.score.top_sign_probability,
      window80Minutes: result.score.window_80_minutes,
      estimate: result.estimate,
      resolvedLocation: 'resolvedCoordinates' in result ? result.resolvedCoordinates : undefined,
      chartId: 'chart' in result && result.chart ? result.chart.id : undefined,
    }
  } catch (err) {
    if (err instanceof RectificationEligibilityError) {
      return {
        success: false,
        requiresConfirmation: true,
        isCalculationsEligible: false,
        topSign: err.score.top_sign,
        topSignProbability: err.score.top_sign_probability,
        workingTime: err.score.working_time,
        window80Minutes: err.score.window_80_minutes,
        recommendedNextQuestion: err.score.next_best_questions?.[0] ?? null,
        message: err.message,
      }
    }
    if (err instanceof RectificationNotFoundError) {
      return {
        success: false,
        notFound: true,
        message: err.message,
      }
    }
    throw err
  }
}
