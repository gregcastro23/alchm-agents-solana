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
  authorType: 'agent' | 'user' | 'community'
  agentId?: string
  rating?: number
  comment: string
  substitutions?: Array<{
    original: string
    replacement: string
    reason: string
  }>
  planetarySignature?: any
  postedAt?: string
}

const LOCAL_COMMENT_LIMIT = 50
const COMMUNITY_TIP_LIMIT = 10

function firstText(...values: unknown[]): string | undefined {
  return values.find(value => typeof value === 'string' && value.trim()) as string | undefined
}

/**
 * GET /api/recipes/[recipeId]/comments
 *
 * Returns a bounded selection of recent local recipe comments and WTEN's
 * top-rated community tips. Source statuses distinguish an empty result from
 * an unavailable source; WTEN does not expose its complete comment history.
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
  const sources = {
    local: { success: false, limit: LOCAL_COMMENT_LIMIT },
    wten: { success: false, limit: COMMUNITY_TIP_LIMIT, coverage: 'top-rated-tips' },
  }

  // 1. Fetch agent alterations and comments from local DB
  try {
    const agentEvents = await prisma.agent_action_events.findMany({
      where: {
        eventType: { in: ['recipe_generation', 'made_it', 'recipe_adapted', 'recipe_review'] },
        OR: [
          { metadataPayload: { path: ['recipeId'], equals: recipeId } },
          { metadataPayload: { path: ['recipe_id'], equals: recipeId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: LOCAL_COMMENT_LIMIT,
    })
    sources.local.success = true

    for (const evt of agentEvents) {
      const metadata = (evt.metadataPayload || {}) as Record<string, any>
      if (metadata.recipeId === recipeId || metadata.recipe_id === recipeId) {
        const text = firstText(metadata.review, metadata.comment, metadata.summary)
        if (text) {
          comments.push({
            id: evt.id || evt.idempotencyKey,
            author: metadata.agentProfile?.name || metadata.agentDisplayName || evt.agentId,
            authorType: 'agent',
            agentId: evt.agentId,
            rating: typeof metadata.rating === 'number' ? metadata.rating : undefined,
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
      if (!Array.isArray(data?.tips) || data.success === false) {
        throw new Error('Invalid community tips response')
      }
      sources.wten.success = true
      const tips: any[] = data.tips.slice(0, COMMUNITY_TIP_LIMIT)
      for (const [index, tip] of tips.entries()) {
        if (!tip || typeof tip !== 'object') continue
        // Dedup against agent alterations already listed
        const tipText = firstText(tip.tip, tip.review, tip.comment)
        if (tipText && !comments.some(c => c.comment.trim() === tipText.trim())) {
          comments.push({
            id: firstText(tip.id) || `wten-tip-${recipeId}-${index}`,
            author: firstText(tip.author) || 'Community contributor',
            authorType:
              tip.authorType === 'agent' || tip.authorType === 'user'
                ? tip.authorType
                : 'community',
            rating: typeof tip.rating === 'number' ? tip.rating : undefined,
            comment: tipText,
            postedAt: firstText(tip.postedAt),
          })
        }
      }
    }
  } catch {
    // Non-fatal if WTEN is unreachable
  }

  // Sort newest first
  const timestamp = (value?: string) => (value ? Date.parse(value) || 0 : 0)
  comments.sort((a, b) => timestamp(b.postedAt) - timestamp(a.postedAt))

  const success = sources.local.success || sources.wten.success
  return NextResponse.json(
    {
      success,
      degraded: !sources.local.success || !sources.wten.success,
      bounded: true,
      sources,
      recipeId,
      count: comments.length,
      comments,
      ...(!success ? { error: 'Recipe comment sources are unavailable' } : {}),
    },
    { status: success ? 200 : 503 }
  )
}
