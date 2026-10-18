import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  RecipeNotFoundError,
  recipeAlterationService,
} from '@/lib/recipes/recipe-alteration-service'
import { publicationActor } from '@/lib/menu-publication'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const alterationSchema = z
  .object({
    agentId: z.string().trim().min(1).max(200),
    recipeId: z.string().trim().min(1).max(200).optional(),
    preferredCuisine: z.string().trim().min(1).max(100).optional(),
    mealType: z.string().trim().min(1).max(50).optional(),
    customPrompt: z.string().trim().min(1).max(5000).optional(),
    rating: z.number().min(1).max(5).default(5),
    syncToWten: z.boolean().default(true),
  })
  .strict()

/**
 * POST /api/recipes/alter
 *
 * Requires the same verified publisher identity as weekly menu publication.
 * Even syncToWten=false persists an alteration in the local event ledger.
 *
 * An agent chooses a recipe from the ~1000 catalog (or accepts a target recipeId),
 * adjusts it to their planetary placements (natal chart, transits, ruling elements)
 * and historical context (dietary philosophy, staples, avoided foods) by swapping
 * out substitutions, and posts their recipe alteration to the feed and as a
 * comment on the recipe.
 *
 * Body:
 * {
 *   agentId: string (required, e.g. "leonardo-da-vinci", "hildegard-von-bingen")
 *   recipeId?: string (optional, if specified alters this recipe; otherwise picks best candidate)
 *   preferredCuisine?: string (optional)
 *   mealType?: string (optional, e.g. "dinner")
 *   customPrompt?: string (optional)
 *   rating?: number (optional, default 5)
 *   syncToWten?: boolean (optional, default true)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await publicationActor(req)
    if ('response' in actor) return actor.response

    const ip = getClientIp(req.headers)
    const limiter = rateLimit(`recipe-alter:${ip}`, { limit: 30, windowMs: 60 * 1000 })
    if (!limiter.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many recipe alteration requests. Slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.resetMs / 1000)) } }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body' },
        { status: 400 }
      )
    }
    const parsed = alterationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid recipe alteration payload' },
        { status: 400 }
      )
    }

    const result = await recipeAlterationService.alterRecipe(parsed.data)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: unknown) {
    if (error instanceof RecipeNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 })
    }
    console.error('[POST /api/recipes/alter] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to alter recipe',
      },
      { status: 500 }
    )
  }
}
