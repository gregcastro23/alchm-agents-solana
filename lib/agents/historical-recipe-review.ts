import { prisma } from '@/lib/db'
import { getHistoricalAgent, HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { buildAgentContext } from '@/lib/agents/persona/build-agent-context'
import { generateVoicedText } from '@/lib/agents/persona/voiced-generation'
import { celestialEnergyCalculator } from '@/lib/celestial-energy-calculator'
import { PlanetaryHourCalculator } from '@/lib/planetary-hour'
import { deliverToWten, stableEventId } from '@/lib/wten/delivery'

function getInternalApiSecret(): string {
  return process.env.INTERNAL_API_SECRET || process.env.ALCHM_KITCHEN_SYNC_SECRET || ''
}

const ALCHM_KITCHEN_BASE_URL =
  process.env.ALCHM_KITCHEN_PUBLIC_URL ||
  process.env.ALCHM_KITCHEN_SYNC_URL ||
  process.env.ALCHM_KITCHEN_BASE_URL ||
  'https://alchm.kitchen'

export interface ReviewRecipeInput {
  agentId: string
  recipeId?: string
  recipeName?: string
  rating?: number
  cuisine?: string
  ingredients?: string[]
  promptHint?: string
  location?: { lat: number; lon: number }
  syncToWten?: boolean
}

export interface HistoricalRecipeReviewResult {
  ok: boolean
  eventId?: string
  deliveryId?: string
  feedPublished?: boolean
  localCommentSaved?: boolean
  recipeCommentSaved?: boolean
  agent: {
    id: string
    name: string
    title: string
    era: string
    dominantElement: string
  }
  recipe: {
    id: string
    name: string
    cuisine?: string
  }
  alteredRecipe?: any
  substitutions?: any[]
  review: string
  rating: number
  planetarySignature: {
    planetaryHour: string
    dominantPlanet: string
    dominantSign: string
    dominantElement: string
    postedAt: string
  }
  error?: string
}

/**
 * Fetch an authentic catalog recipe from WTEN or the curated catalog pool
 */
export async function fetchCatalogDish(
  element = 'fire'
): Promise<{ id: string; name: string; cuisine?: string }> {
  const el = element.toLowerCase().trim()
  try {
    const res = await fetch(
      `${ALCHM_KITCHEN_BASE_URL}/api/recipes?element=${encodeURIComponent(el)}&limit=20`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      }
    )
    if (res.ok) {
      const data: any = await res.json().catch(() => null)
      const list: any[] = Array.isArray(data?.recipes)
        ? data.recipes
        : Array.isArray(data)
          ? data
          : []
      const candidates = list
        .map(r => ({
          id: String(r?.id ?? r?.recipeId ?? r?.recipe_id ?? ''),
          name: String(r?.name ?? r?.title ?? ''),
          cuisine: typeof r?.cuisine === 'string' ? r.cuisine : undefined,
        }))
        .filter(r => r.id && r.name)

      if (candidates.length > 0) {
        const idx = Math.floor(Date.now() / 900_000) % candidates.length
        return candidates[idx]
      }
    }
  } catch {
    // Network or cold service fallback
  }

  // Zero fabricated recipes: query the synced WTEN database snapshot
  try {
    const { recipeCatalogService } = await import('@/lib/recipes/recipe-catalog-service')
    const syncedCandidates = await recipeCatalogService.findRecipes({ element: el, limit: 20 })
    if (syncedCandidates.length > 0) {
      const idx = Math.floor(Date.now() / 900_000) % syncedCandidates.length
      const match = syncedCandidates[idx]
      return {
        id: match.id,
        name: match.name,
        cuisine: match.cuisine,
      }
    }
  } catch {
    // Synced DB unavailable
  }

  throw new Error(
    `Upstream alchm.kitchen catalog unreachable and no synced recipes found for element "${el}"`
  )
}

/**
 * Generate a voiced culinary review & cooking tips on an existing recipe
 * from an authentic historical figure.
 */
export async function generateHistoricalRecipeReview(
  input: ReviewRecipeInput
): Promise<HistoricalRecipeReviewResult> {
  const {
    agentId,
    rating = 5,
    promptHint,
    location = { lat: 40.7128, lon: -74.006 },
    syncToWten = true,
  } = input

  // Use the comprehensive recipe alteration engine to perform authentic substitutions
  // based on the agent's planetary placements and historical context.
  const { recipeAlterationService } = await import('@/lib/recipes/recipe-alteration-service')
  const alteration = await recipeAlterationService.alterRecipe({
    agentId,
    recipeId: input.recipeId,
    recipeName: input.recipeName,
    preferredCuisine: input.cuisine,
    customPrompt: promptHint,
    rating,
    location,
    syncToWten,
  })

  return {
    ok: alteration.ok,
    eventId: alteration.feedEventId,
    deliveryId: alteration.deliveryId,
    feedPublished: alteration.feedPublished,
    localCommentSaved: alteration.localCommentSaved,
    recipeCommentSaved: alteration.recipeCommentSaved,
    agent: {
      id: alteration.agent.id,
      name: alteration.agent.name,
      title: alteration.agent.title || 'Historical Alchemist',
      era: alteration.agent.era || 'Historical',
      dominantElement: alteration.agent.dominantElement,
    },
    recipe: {
      id: alteration.originalRecipe.id,
      name: alteration.originalRecipe.name,
      cuisine: alteration.originalRecipe.cuisine,
    },
    alteredRecipe: alteration.alteredRecipe,
    substitutions: alteration.alteredRecipe.substitutions,
    review: alteration.review,
    rating: alteration.rating,
    planetarySignature: alteration.planetarySignature,
  }
}

/**
 * Returns recent recipe reviews by historical agents
 */
export async function getRecentHistoricalRecipeReviews(limit = 20) {
  const rows = await prisma.agent_action_events.findMany({
    where: {
      eventType: { in: ['made_it', 'recipe_generation'] },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return rows
    .map(r => {
      const meta = (r.metadataPayload || {}) as Record<string, any>
      return {
        id: r.id,
        agentId: r.agentId,
        agentName: meta.agentProfile?.name || r.agentId,
        recipeId: meta.recipeId || meta.recipe_id,
        recipeName: meta.recipeName || meta.dishName || 'Kitchen Recipe',
        rating: typeof meta.rating === 'number' ? meta.rating : undefined,
        review: meta.review || meta.description || '',
        createdAt: r.createdAt.toISOString(),
      }
    })
    .filter(r => r.review && r.recipeId)
}
