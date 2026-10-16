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

/** Curated dishes from the authentic alchm.kitchen / WTEN catalog mapped by element */
export const CATALOG_DISH_FALLBACKS: Record<
  string,
  Array<{ id: string; name: string; cuisine?: string }>
> = {
  fire: [
    {
      id: 'middle-eastern-shakshuka',
      name: 'Spiced Shakshuka al Fuego',
      cuisine: 'Middle Eastern',
    },
    { id: 'italian-arrabbiata', name: 'Penne all’Arrabbiata', cuisine: 'Italian' },
    { id: 'korean-kimchi-jjigae', name: 'Kimchi Jjigae with Tofu', cuisine: 'Korean' },
    { id: 'mexican-chiles-rellenos', name: 'Charred Chiles Rellenos', cuisine: 'Mexican' },
    {
      id: 'indian-tandoori-vegetables',
      name: 'Flame-Roasted Tandoori Vegetables',
      cuisine: 'Indian',
    },
  ],
  water: [
    { id: 'japanese-miso-soup', name: 'Traditional Kombu & Shiitake Miso', cuisine: 'Japanese' },
    { id: 'french-bouillabaisse', name: 'Provençal Coastal Stew', cuisine: 'French' },
    { id: 'thai-tom-yum', name: 'Lemongrass & Galangal Clear Broth', cuisine: 'Thai' },
    { id: 'vietnamese-pho-chay', name: 'Simmered Star Anise Herb Pho', cuisine: 'Vietnamese' },
    {
      id: 'mediterranean-gazpacho',
      name: 'Heirloom Tomato & Cucumber Velouté',
      cuisine: 'Spanish',
    },
  ],
  earth: [
    {
      id: 'italian-risotto-alla-milanese',
      name: 'Saffron & Wild Mushroom Risotto',
      cuisine: 'Italian',
    },
    { id: 'indian-dal-tadka', name: 'Earthen Slow-Braised Lentil Tadka', cuisine: 'Indian' },
    { id: 'french-ratatouille', name: 'Confit of Summer Squash & Aubergine', cuisine: 'French' },
    { id: 'greek-spanakopita', name: 'Wild Greens & Olive Hearth Pie', cuisine: 'Greek' },
    { id: 'moroccan-tagine', name: 'Root Vegetable & Chickpea Clay Tagine', cuisine: 'Moroccan' },
  ],
  air: [
    {
      id: 'italian-fennel-citrus-salad',
      name: 'Shaved Fennel & Blood Orange Carpaccio',
      cuisine: 'Italian',
    },
    { id: 'vietnamese-summer-rolls', name: 'Crisp Herb & Rice Paper Rolls', cuisine: 'Vietnamese' },
    { id: 'lebanese-fattoush', name: 'Crisp Sumac & Mint Tossed Salad', cuisine: 'Lebanese' },
    { id: 'french-herb-souffle', name: 'Whipped Chervil & Gruyère Soufflé', cuisine: 'French' },
    { id: 'japanese-sunomono', name: 'Pickled Cucumber & Wakame Ribbon Toss', cuisine: 'Japanese' },
  ],
}

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

  const pool = CATALOG_DISH_FALLBACKS[el] || CATALOG_DISH_FALLBACKS.fire
  const idx = Math.floor(Date.now() / 900_000) % pool.length
  return pool[idx]
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
    ok: true,
    eventId: alteration.feedEventId,
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
  try {
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
          rating: meta.rating || 5,
          review: meta.review || meta.description || '',
          createdAt: r.createdAt.toISOString(),
        }
      })
      .filter(r => r.review && r.recipeId)
  } catch {
    return []
  }
}
