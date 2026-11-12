import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { resolveRectificationCoordinates } from '@/lib/rectification/location'
import {
  persistRectifiedChart,
  persistRectifiedProfile,
  RectificationEligibilityError,
  RectificationNotFoundError,
} from '@/lib/rectification/persistence'
import {
  RectificationUnavailableError,
  runRectifyScore,
  runRectifyWindows,
} from '@/lib/rectification/server-runner'
import { normalizeEvidenceList } from '@/lib/rectification/types'

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
  location: z.string().min(1).max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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

function hasLocationOrCoords(body: {
  location?: string
  latitude?: number
  longitude?: number
}): boolean {
  const hasCoords = typeof body.latitude === 'number' && typeof body.longitude === 'number'
  const hasLocation = typeof body.location === 'string' && body.location.trim().length > 0
  return hasCoords || hasLocation
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
      if (!hasLocationOrCoords(body)) {
        return NextResponse.json(
          { error: 'Either location or latitude and longitude are required' },
          { status: 400 }
        )
      }
      const coords = await resolveRectificationCoordinates(body)
      const result = await runRectifyWindows({
        year: body.year,
        month: body.month,
        day: body.day,
        latitude: coords.latitude,
        longitude: coords.longitude,
        calendar: body.calendar,
      })
      return NextResponse.json({ ok: true, action: 'windows', data: result })
    }

    if (body.action === 'score') {
      if (!hasLocationOrCoords(body)) {
        return NextResponse.json(
          { error: 'Either location or latitude and longitude are required' },
          { status: 400 }
        )
      }
      const coords = await resolveRectificationCoordinates(body)
      const evidence = normalizeEvidenceList(body.evidence)
      const result = await runRectifyScore({
        year: body.year,
        month: body.month,
        day: body.day,
        latitude: coords.latitude,
        longitude: coords.longitude,
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
      if (!hasLocationOrCoords(body)) {
        return NextResponse.json(
          { error: 'Either location or latitude and longitude are required' },
          { status: 400 }
        )
      }
      const coords = await resolveRectificationCoordinates(body)
      const result = await persistRectifiedProfile({
        userId,
        userName: session.user.name,
        year: body.year,
        month: body.month,
        day: body.day,
        latitude: coords.latitude,
        longitude: coords.longitude,
        calendar: body.calendar,
        locationName: body.locationName || coords.locationName,
        name: body.name,
        evidence: body.evidence,
        stepMinutes: body.step_minutes,
        allowUnconfirmed: body.allowUnconfirmed,
      })
      return NextResponse.json(result)
    }

    // action === 'apply_chart'
    const result = await persistRectifiedChart({
      userId,
      chartId: body.chartId,
      evidence: body.evidence,
      stepMinutes: body.step_minutes,
      allowUnconfirmed: body.allowUnconfirmed,
    })
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof RectificationEligibilityError) {
      return NextResponse.json(
        {
          error: err.message,
          isCalculationsEligible: false,
          score: err.score,
        },
        { status: 409 }
      )
    }
    if (err instanceof RectificationNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof RectificationUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    return NextResponse.json(
      { error: err?.message || 'Rectification request failed' },
      { status: 500 }
    )
  }
}
