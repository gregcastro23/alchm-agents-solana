import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALCHM_KITCHEN_BASE_URL =
  process.env.ALCHM_KITCHEN_PUBLIC_URL ||
  process.env.ALCHM_KITCHEN_SYNC_URL ||
  process.env.ALCHM_KITCHEN_BASE_URL ||
  'https://alchm.kitchen'

export interface RecipeCommentItem {
  id: string
  author: string
  authorType: 'agent' | 'user'
  agentId?: string
  rating?: number
  comment: string
  substitutions?: Array<{
    original: string
    replacement: string
    reason: string
  }>
  planetarySignature?: any
  postedAt: string
}

/**
 * GET /api/recipes/[recipeId]/comments
 *
 * Returns all comments, reviews, and agent recipe alterations for this recipe.
 * Combines:
 * 1. Agent alterations from local `agent_action_events` (where agents posted their alterations)
 * 2. Community tips & reviews from WTEN
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const { recipeId } = await params
  if (!recipeId) {
    return NextResponse.json({ success: false, error: 'recipeId is required' }, { status: 400 })
  }

  const comments: RecipeCommentItem[] = []

  // 1. Fetch agent alterations and comments from local DB
  try {
    const agentEvents = await prisma.agent_action_events.findMany({
      where: {
        eventType: { in: ['recipe_generation', 'made_it', 'recipe_adapted', 'recipe_review'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    for (const evt of agentEvents) {
      const metadata = (evt.metadataPayload || {}) as Record<string, any>
      const evtRecipeId = String(metadata.recipeId || metadata.recipe_id || '')
      if (
        evtRecipeId.toLowerCase() === recipeId.toLowerCase() ||
        evtRecipeId.toLowerCase().replace(/[^a-z0-9]/g, '-') ===
          recipeId.toLowerCase().replace(/[^a-z0-9]/g, '-')
      ) {
        const text = String(
          metadata.review || metadata.comment || metadata.summary || metadata.dishName || ''
        )
        if (text) {
          comments.push({
            id: evt.id || evt.idempotencyKey,
            author: metadata.agentProfile?.name || metadata.agentDisplayName || evt.agentId,
            authorType: 'agent',
            agentId: evt.agentId,
            rating: typeof metadata.rating === 'number' ? metadata.rating : 5,
            comment: text,
            substitutions: Array.isArray(metadata.substitutions)
              ? metadata.substitutions
              : undefined,
            planetarySignature: metadata.planetarySignature,
            postedAt: (evt.postedAt || evt.createdAt).toISOString(),
          })
        }
      }
    }
  } catch (err) {
    console.warn(`[GET /api/recipes/${recipeId}/comments] Local DB lookup skipped:`, err)
  }

  // 2. Fetch community tips & reviews from WTEN
  try {
    const wtenUrl = `${ALCHM_KITCHEN_BASE_URL.replace(/\/$/, '')}/api/recipes/${encodeURIComponent(recipeId)}/community-tips`
    const res = await fetch(wtenUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 60 },
    })

    if (res.ok) {
      const data = await res.json()
      const tips: any[] = Array.isArray(data?.tips) ? data.tips : []
      for (const tip of tips) {
        // Dedup against agent alterations already listed
        const tipText = String(tip.tip || tip.review || '')
        if (!comments.some(c => c.comment.trim() === tipText.trim())) {
          comments.push({
            id: `wten-tip-${comments.length}`,
            author: String(tip.author || 'Alchm Cook'),
            authorType: 'user',
            rating: typeof tip.rating === 'number' ? tip.rating : undefined,
            comment: tipText,
            postedAt: tip.postedAt || new Date().toISOString(),
          })
        }
      }
    }
  } catch {
    // Non-fatal if WTEN is unreachable
  }

  // Sort newest first
  comments.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())

  return NextResponse.json({
    success: true,
    recipeId,
    count: comments.length,
    comments,
  })
}
