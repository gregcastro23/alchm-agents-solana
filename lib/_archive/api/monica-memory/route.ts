import { NextRequest, NextResponse } from 'next/server'

// In-memory store as a minimal default; can be swapped to Redis later
const store = new Map<string, any>()

function keyFrom(req: NextRequest): string | null {
  const { searchParams } = new URL(req.url)
  return searchParams.get('userId') || searchParams.get('sessionId')
}

export async function GET(req: NextRequest) {
  const key = keyFrom(req)
  if (!key)
    return NextResponse.json(
      { success: false, message: 'Missing userId or sessionId' },
      { status: 400 }
    )
  const data = store.get(key) || null
  return NextResponse.json({ success: true, preferences: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const key = body.userId || body.sessionId
  if (!key)
    return NextResponse.json(
      { success: false, message: 'Missing userId or sessionId' },
      { status: 400 }
    )
  const prev = store.get(key) || {}
  const next = { ...prev, ...(body.preferencesPatch || {}) }
  store.set(key, next)
  return NextResponse.json({ success: true, preferences: next })
}

export async function DELETE(req: NextRequest) {
  const key = keyFrom(req)
  if (!key)
    return NextResponse.json(
      { success: false, message: 'Missing userId or sessionId' },
      { status: 400 }
    )
  store.delete(key)
  return NextResponse.json({ success: true })
}
