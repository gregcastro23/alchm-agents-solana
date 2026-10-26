import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { loadLevelingReport } from '@/lib/admin/leveling'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Catalog Vessel progression and independent, explicitly legacy cosmic EV data. */
export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      const response = adminErrorResponse(admin)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
    const report = await loadLevelingReport()
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('leveling-summary error:', error)
    return NextResponse.json(
      { success: false, error: 'Could not load the leveling report.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
