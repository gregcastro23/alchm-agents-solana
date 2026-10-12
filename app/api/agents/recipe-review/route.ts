import { type NextRequest, NextResponse } from 'next/server'
import {
  generateHistoricalRecipeReview,
  getRecentHistoricalRecipeReviews,
} from '@/lib/agents/historical-recipe-review'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 50)
    const reviews = await getRecentHistoricalRecipeReviews(limit)
    return NextResponse.json({ success: true, reviews })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentId, recipeId, recipeName, rating, promptHint, location } = body

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ success: false, error: 'agentId is required' }, { status: 400 })
    }

    const result = await generateHistoricalRecipeReview({
      agentId,
      recipeId,
      recipeName,
      rating,
      promptHint,
      location,
      syncToWten: true,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error('[POST /api/agents/recipe-review] error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error generating recipe review' },
      { status: 500 }
    )
  }
}
