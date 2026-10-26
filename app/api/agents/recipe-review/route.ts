import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  generateHistoricalRecipeReview,
  getRecentHistoricalRecipeReviews,
} from '@/lib/agents/historical-recipe-review'
import { publicationActor } from '@/lib/menu-publication'
import { RecipeNotFoundError } from '@/lib/recipes/recipe-alteration-service'

export const dynamic = 'force-dynamic'

const reviewSchema = z
  .object({
    agentId: z.string().trim().min(1).max(200),
    recipeId: z.string().trim().min(1).max(200).optional(),
    recipeName: z.string().trim().min(1).max(500).optional(),
    rating: z.number().min(1).max(5).default(5),
    promptHint: z.string().trim().min(1).max(5000).optional(),
    location: z
      .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
      .strict()
      .optional(),
  })
  .strict()

export async function GET(req: NextRequest) {
  try {
    const rawLimit = req.nextUrl.searchParams.get('limit')
    const limit = rawLimit === null ? 20 : Number(rawLimit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { success: false, error: 'limit must be an integer from 1 to 50' },
        { status: 400 }
      )
    }
    const reviews = await getRecentHistoricalRecipeReviews(limit)
    return NextResponse.json({ success: true, reviews })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await publicationActor(req)
    if ('response' in actor) return actor.response

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body' },
        { status: 400 }
      )
    }
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid recipe review payload' },
        { status: 400 }
      )
    }

    const result = await generateHistoricalRecipeReview({
      ...parsed.data,
      syncToWten: true,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err: unknown) {
    if (err instanceof RecipeNotFoundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 })
    }
    console.error('[POST /api/agents/recipe-review] error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal error generating recipe review' },
      { status: 500 }
    )
  }
}
