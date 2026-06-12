import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

function getBackendUrl(path: string) {
  return `${BACKEND_URL.replace(/\/$/, '')}${path}`
}

async function proxyConsciousnessRequest(path: string, body: unknown) {
  try {
    const response = await fetch(getBackendUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })

    // Backend doesn't implement this route → signal client to use its local fallback
    if (response.status === 404) {
      return NextResponse.json(
        {
          error: 'Backend consciousness endpoint not available',
          code: 'BACKEND_DISABLED',
        },
        { status: 503 }
      )
    }

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return NextResponse.json(
        payload || {
          error: 'Backend consciousness calculation failed',
          code: 'BACKEND_ERROR',
        },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      data: payload,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Backend consciousness service unavailable',
        code: 'BACKEND_DISABLED',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 503 }
    )
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyConsciousnessRequest('/api/consciousness/live', body)
}

export async function GET(request: NextRequest) {
  try {
    const defaultBody = {
      name: 'Current Moment',
      birthDate: new Date().toISOString().slice(0, 10),
      birthTime: '12:00',
      birthLocation: { name: 'Greenwich, UK', lat: 51.4779, lon: 0.0 },
    }
    return proxyConsciousnessRequest('/api/consciousness/live', defaultBody)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Backend consciousness service unavailable',
        code: 'BACKEND_DISABLED',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 503 }
    )
  }
}
