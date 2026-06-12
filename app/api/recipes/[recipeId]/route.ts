import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// PA has no recipe store of its own — recipe generation + reads live on
// alchm.kitchen (WTEN). The agent profile's "Created by this Agent" grid
// expands recipes via fetch('/api/recipes/<id>'); this route proxies that read
// to alchm.kitchen so the profile works without exposing the cross-service URL
// to the browser. Mirrors the base-url resolution in lib/agents/activity-surfaces.ts.
const ALCHM_KITCHEN_BASE_URL =
  process.env.ALCHM_KITCHEN_PUBLIC_URL ||
  process.env.ALCHM_KITCHEN_SYNC_URL ||
  process.env.ALCHM_KITCHEN_BASE_URL ||
  'https://alchm.kitchen'

export async function GET(_req: Request, { params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params
  if (!recipeId) {
    return NextResponse.json({ success: false, error: 'recipeId is required' }, { status: 400 })
  }

  const url = `${ALCHM_KITCHEN_BASE_URL.replace(/\/$/, '')}/api/recipes/${encodeURIComponent(recipeId)}`
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Recipe service is unavailable' },
      { status: 502 }
    )
  }
}
