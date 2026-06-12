import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string' || value.trim() === '') return fallback

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date format')
  }

  return date
}

function parseCoordinate(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeSamples(raw: Awaited<ReturnType<typeof backend.planetary.bulk>>) {
  return raw.samples.map(sample => ({
    timestamp: sample.timestamp,
    planetary_positions: sample.positions.planetary_positions,
    planets: sample.positions.planetary_positions,
  }))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const endDate = parseDate(body.endDate, new Date())
    const startDate = parseDate(body.startDate, new Date(endDate.getTime() - 3 * 60 * 60 * 1000))
    const intervalHours = Number.isFinite(Number(body.intervalHours))
      ? Number(body.intervalHours)
      : 1
    const latitude = parseCoordinate(body.latitude ?? body.lat)
    const longitude = parseCoordinate(body.longitude ?? body.lon)

    const raw = await backend.planetary.bulk(startDate, endDate, intervalHours, latitude, longitude)
    const samples = normalizeSamples(raw)

    return NextResponse.json({
      success: true,
      samples,
      count: samples.length,
      degraded: raw.degraded,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate bulk astrologize data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
