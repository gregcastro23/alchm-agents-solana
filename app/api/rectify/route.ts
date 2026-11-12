import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateAccurateHoroscope } from '@/lib/monica/horoscope-generator'
import { utcDateFromParts } from '@/lib/enhanced-astronomical-calculator'
import { getAlchemicalQuantitiesLegacy } from '@/lib/backend'
import { analyzePhiAxisIndex } from '@/lib/monica/monica-constant'
import { applyRectifiedBirthTimeToChart, getNatalChart } from '@/lib/services/natal-chart-storage'
import {
  RectificationUnavailableError,
  runRectifyScore,
  runRectifyWindows,
} from '@/lib/rectification/server-runner'
import { buildAscendantEstimateFromScore, normalizeEvidenceList } from '@/lib/rectification/types'

export const revalidate = 0

const EvidenceItemSchema = z.object({
  type: z.enum([
    'time_clue',
    'recorded_time',
    'moon_sign',
    'life_event',
    'angular_transits',
    'secondary_progressions',
    'annual_profections',
    'primary_directions',
    'physical_temperament',
  ]),
  description: z.string().max(400).optional(),
  citation: z.string().max(500).optional(),
  start_minute: z.number().min(0).max(1439).optional(),
  end_minute: z.number().min(0).max(1439).optional(),
  margin_minutes: z.number().min(5).max(240).optional(),
  window: z.enum(['dawn', 'morning', 'afternoon', 'dusk', 'night']).optional(),
  reported_minute: z.number().min(0).max(1439).optional(),
  time: z.string().max(16).optional(),
  rodden_rating: z.enum(['AA', 'A', 'B', 'C', 'DD']).optional(),
  moon_sign: z.string().max(32).optional(),
  expected_sign: z.string().max(32).optional(),
  category: z.string().max(40).optional(),
  event_date: z.string().max(40).optional(),
  date: z.string().max(40).optional(),
  affinity: z.record(z.number().min(0.5).max(2.0)).optional(),
})

const CoordsSchema = {
  year: z.number().int().min(1).max(2200),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  calendar: z.enum(['gregorian', 'julian']).optional().default('gregorian'),
}

const WindowsActionSchema = z.object({
  action: z.literal('windows'),
  ...CoordsSchema,
})

const ScoreActionSchema = z.object({
  action: z.literal('score'),
  ...CoordsSchema,
  evidence: z.array(EvidenceItemSchema).max(30).default([]),
  step_minutes: z.number().int().min(1).max(10).optional().default(5),
})

const ApplyProfileActionSchema = z.object({
  action: z.literal('apply_profile'),
  ...CoordsSchema,
  year: z.number().int().min(1900).max(2100),
  locationName: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(120).optional(),
  evidence: z.array(EvidenceItemSchema).min(1).max(30),
  step_minutes: z.number().int().min(1).max(10).optional().default(3),
  allowUnconfirmed: z.boolean().optional().default(false),
})

const ApplyChartActionSchema = z.object({
  action: z.literal('apply_chart'),
  chartId: z.string().min(1),
  evidence: z.array(EvidenceItemSchema).min(1).max(30),
  step_minutes: z.number().int().min(1).max(10).optional().default(3),
  allowUnconfirmed: z.boolean().optional().default(false),
})

const RectifyRequestSchema = z.discriminatedUnion('action', [
  WindowsActionSchema,
  ScoreActionSchema,
  ApplyProfileActionSchema,
  ApplyChartActionSchema,
])

function parseWorkingHourMinute(timeStr: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim())
  if (!m) return { hour: 12, minute: 0 }
  return {
    hour: Math.min(23, Math.max(0, parseInt(m[1], 10))),
    minute: Math.min(59, Math.max(0, parseInt(m[2], 10))),
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null)
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    const parsed = RectifyRequestSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const body = parsed.data

    if (body.action === 'windows') {
      const result = await runRectifyWindows({
        year: body.year,
        month: body.month,
        day: body.day,
        latitude: body.latitude,
        longitude: body.longitude,
        calendar: body.calendar,
      })
      return NextResponse.json({ ok: true, action: 'windows', data: result })
    }

    if (body.action === 'score') {
      const evidence = normalizeEvidenceList(body.evidence)
      const result = await runRectifyScore({
        year: body.year,
        month: body.month,
        day: body.day,
        latitude: body.latitude,
        longitude: body.longitude,
        calendar: body.calendar,
        evidence,
        step_minutes: body.step_minutes,
      })
      return NextResponse.json({ ok: true, action: 'score', data: result })
    }

    // Mutating actions require an authenticated session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    if (body.action === 'apply_profile') {
      const evidence = normalizeEvidenceList(body.evidence)
      const score = await runRectifyScore({
        year: body.year,
        month: body.month,
        day: body.day,
        latitude: body.latitude,
        longitude: body.longitude,
        calendar: body.calendar,
        evidence,
        step_minutes: body.step_minutes,
      })

      if (!score.is_calculations_eligible && !body.allowUnconfirmed) {
        return NextResponse.json(
          {
            error:
              'Rectification posterior has not reached calculation eligibility (>= 70% top sign and <= 180m window). Answer more questions or pass allowUnconfirmed=true to save a tentative working chart.',
            isCalculationsEligible: false,
            score,
          },
          { status: 409 }
        )
      }

      const estimate = buildAscendantEstimateFromScore(score, evidence)
      const { hour, minute } = parseWorkingHourMinute(score.working_time)
      const birthDate = utcDateFromParts(body.year, body.month, body.day, hour, minute)

      const horoscope = generateAccurateHoroscope({
        year: body.year,
        month: body.month,
        day: body.day,
        hour,
        minute,
        latitude: body.latitude,
        longitude: body.longitude,
      }) as Record<string, any>

      horoscope.ascendant = score.working_longitude
      horoscope.ascendantProvenance = 'rectified'
      horoscope.ascendantEstimate = estimate

      const alchm = await getAlchemicalQuantitiesLegacy(birthDate, body.latitude, body.longitude)
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

      const zeroBasedMonth = body.month - 1
      const profile = await prisma.user_profiles.upsert({
        where: { userId },
        update: {
          birthDate,
          birthTime: score.working_time,
          birthLocation: {
            name: body.locationName || 'Unknown',
            latitude: body.latitude,
            longitude: body.longitude,
          },
          natalChart: horoscope as any,
          monicaConstant: phiAxis.value,
          dominantElement: (alchm as any)?.['Dominant Element'] || 'Fire',
        },
        create: {
          userId,
          birthDate,
          birthTime: score.working_time,
          birthLocation: {
            name: body.locationName || 'Unknown',
            latitude: body.latitude,
            longitude: body.longitude,
          },
          natalChart: horoscope as any,
          monicaConstant: phiAxis.value,
          dominantElement: (alchm as any)?.['Dominant Element'] || 'Fire',
        },
      })

      await prisma.profiles.upsert({
        where: { userId },
        update: {
          ...(body.name ? { name: body.name } : {}),
          birthInfo: {
            year: body.year,
            month: zeroBasedMonth,
            day: body.day,
            hour,
            minute,
            latitude: body.latitude,
            longitude: body.longitude,
          },
        },
        create: {
          userId,
          name: body.name || session.user.name || 'Explorer',
          avatarUrl: null,
          birthInfo: {
            year: body.year,
            month: zeroBasedMonth,
            day: body.day,
            hour,
            minute,
            latitude: body.latitude,
            longitude: body.longitude,
          },
        },
      })

      return NextResponse.json({
        ok: true,
        action: 'apply_profile',
        isCalculationsEligible: score.is_calculations_eligible,
        workingTime: score.working_time,
        estimate,
        score,
        profile,
      })
    }

    // action === 'apply_chart'
    const existingChart = await getNatalChart(body.chartId, userId)
    if (!existingChart) {
      return NextResponse.json({ error: 'Natal chart not found' }, { status: 404 })
    }

    const loc = (existingChart.birthLocation || {}) as { lat?: number; lon?: number }
    const bd = new Date(existingChart.birthDate)
    const evidence = normalizeEvidenceList(body.evidence)

    const score = await runRectifyScore({
      year: bd.getUTCFullYear(),
      month: bd.getUTCMonth() + 1,
      day: bd.getUTCDate(),
      latitude: typeof loc.lat === 'number' ? loc.lat : 0,
      longitude: typeof loc.lon === 'number' ? loc.lon : 0,
      calendar: 'gregorian',
      evidence,
      step_minutes: body.step_minutes,
    })

    if (!score.is_calculations_eligible && !body.allowUnconfirmed) {
      return NextResponse.json(
        {
          error:
            'Rectification posterior has not reached calculation eligibility (>= 70% top sign and <= 180m window). Answer more questions or pass allowUnconfirmed=true to save a tentative working chart.',
          isCalculationsEligible: false,
          score,
        },
        { status: 409 }
      )
    }

    const estimate = buildAscendantEstimateFromScore(score, evidence)
    const updatedChart = await applyRectifiedBirthTimeToChart(
      body.chartId,
      userId,
      score.working_time,
      estimate
    )

    return NextResponse.json({
      ok: true,
      action: 'apply_chart',
      isCalculationsEligible: score.is_calculations_eligible,
      workingTime: score.working_time,
      estimate,
      score,
      chart: updatedChart,
    })
  } catch (err: any) {
    if (err instanceof RectificationUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: err?.message || 'Rectification request failed' },
      { status: 500 }
    )
  }
}
