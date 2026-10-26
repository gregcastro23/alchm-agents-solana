import { NextRequest, NextResponse } from 'next/server'
import { getAgentWeeklyMenu } from '@/lib/wtenClient'
import { publishWeeklyMenu } from '@/lib/menu-publication'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const agentSlug = searchParams.get('agentSlug')
    const weekStartDate = searchParams.get('weekStartDate')

    if (!agentSlug) {
      return NextResponse.json({ success: false, error: 'agentSlug is required' }, { status: 400 })
    }
    if (!weekStartDate) {
      return NextResponse.json(
        { success: false, error: 'weekStartDate is required' },
        { status: 400 }
      )
    }

    const menu = await getAgentWeeklyMenu(agentSlug, weekStartDate)

    return NextResponse.json({
      success: true,
      menu,
    })
  } catch (error: any) {
    console.error('[API Weekly Menu GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch weekly menu' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return publishWeeklyMenu(request, true)
}
