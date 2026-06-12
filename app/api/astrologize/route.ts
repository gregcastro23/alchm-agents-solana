import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseDate(value: unknown): Date {
  if (typeof value !== 'string' || value.trim() === '') return new Date()

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

async function buildResponse(params: { date?: unknown; latitude?: unknown; longitude?: unknown }) {
  const date = parseDate(params.date)
  const latitude = parseCoordinate(params.latitude)
  const longitude = parseCoordinate(params.longitude)
  const data = await backend.planetary.positions(date, latitude, longitude)

  return {
    ...data,
    success: true,
    timestamp: date.toISOString(),
    meta: {
      source: 'railway-backend',
      chartRendererAvailable: false,
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const payload = await buildResponse({
      date: searchParams.get('date'),
      latitude: searchParams.get('latitude') ?? searchParams.get('lat'),
      longitude: searchParams.get('longitude') ?? searchParams.get('lon'),
    })

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate astrologize data',
        message: error instanceof Error ? error.message : 'Unknown error',
        meta: { degraded: true, fallback: true },
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const payload = await buildResponse({
      date: body.date,
      latitude: body.latitude ?? body.lat,
      longitude: body.longitude ?? body.lon,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate astrologize data',
        message: error instanceof Error ? error.message : 'Unknown error',
        meta: { degraded: true, fallback: true },
      },
      { status: 500 }
    )
  }
}
