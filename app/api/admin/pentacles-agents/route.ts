import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'https://api.agents.alchm.kitchen'
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || ''

async function proxy(path: string, init?: RequestInit): Promise<NextResponse> {
  if (!INTERNAL_API_SECRET) {
    return NextResponse.json(
      { success: false, error: 'INTERNAL_API_SECRET is not configured' },
      { status: 503 }
    )
  }

  try {
    const response = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/api/pentacles-agents/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${INTERNAL_API_SECRET}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    })
    const text = await response.text()
    const payload = text ? JSON.parse(text) : null
    return NextResponse.json(payload, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    )
  }
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)
  return proxy('status')
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = body.action
  if (action !== 'control' && action !== 'evaluate' && action !== 'preview') {
    return NextResponse.json({ success: false, error: 'Invalid operator action' }, { status: 400 })
  }
  const { action: _action, ...payload } = body
  return proxy(action, { method: 'POST', body: JSON.stringify(payload) })
}
