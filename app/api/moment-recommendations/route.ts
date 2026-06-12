import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    const data = await backend.moment.recommendations(limit)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching moment recommendations:', error)
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentIds, alchmData, currentPlanets } = body

    if (!agentIds || !Array.isArray(agentIds)) {
      return NextResponse.json({ error: 'agentIds array is required' }, { status: 400 })
    }

    const data = await backend.moment.detailed(agentIds, alchmData || {}, currentPlanets || {})
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error calculating detailed moment scores:', error)
    return NextResponse.json({ error: 'Failed to calculate scores' }, { status: 500 })
  }
}
