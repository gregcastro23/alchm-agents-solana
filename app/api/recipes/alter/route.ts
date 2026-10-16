import { NextRequest, NextResponse } from 'next/server'
import { recipeAlterationService } from '@/lib/recipes/recipe-alteration-service'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/recipes/alter
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
  const ip = getClientIp(req.headers)
  const limiter = rateLimit(`recipe-alter:${ip}`, { limit: 30, windowMs: 60 * 1000 })
  if (!limiter.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many recipe alteration requests. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.resetMs / 1000)) } }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { agentId, recipeId, preferredCuisine, mealType, customPrompt, rating, syncToWten } = body

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ success: false, error: 'agentId is required' }, { status: 400 })
    }

    const result = await recipeAlterationService.alterRecipe({
      agentId: agentId.trim(),
      recipeId: typeof recipeId === 'string' ? recipeId.trim() : undefined,
      preferredCuisine: typeof preferredCuisine === 'string' ? preferredCuisine.trim() : undefined,
      mealType: typeof mealType === 'string' ? mealType.trim() : undefined,
      customPrompt: typeof customPrompt === 'string' ? customPrompt.trim() : undefined,
      rating: typeof rating === 'number' ? rating : 5,
      syncToWten: syncToWten !== false,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('[POST /api/recipes/alter] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to alter recipe',
      },
      { status: 500 }
    )
  }
}
