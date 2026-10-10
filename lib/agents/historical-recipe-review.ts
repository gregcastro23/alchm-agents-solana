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

  // 1. Resolve agent
  const agent = getHistoricalAgent(agentId)
  if (!agent) {
    throw new Error(`Historical agent "${agentId}" not found in registry`)
  }

  const dominantElement = agent.consciousness?.dominantElement || 'Fire'

  // 2. Resolve recipe
  let recipe: { id: string; name: string; cuisine?: string }
  if (input.recipeId && input.recipeName) {
    recipe = { id: input.recipeId, name: input.recipeName, cuisine: input.cuisine }
  } else if (input.recipeId) {
    recipe = {
      id: input.recipeId,
      name: input.recipeName || 'Cosmic Recipe',
      cuisine: input.cuisine,
    }
  } else {
    recipe = await fetchCatalogDish(dominantElement)
  }

  // 3. Astronomical weather & planetary signature
  const moment = await celestialEnergyCalculator.calculateMoment(new Date(), location)
  const hourCalc = new PlanetaryHourCalculator()
  const { planet: planetaryHour } = hourCalc.getPlanetaryHour(moment.timestamp)
  const dominantPlanet = moment.planetary.dominantPlanet
  const dominantSign = moment.planetary.dominantSign

  const planetarySignature = {
    planetaryHour,
    dominantPlanet,
    dominantSign,
    dominantElement,
    postedAt: moment.timestamp.toISOString(),
  }

  // 4. Generate voiced review drawing on agent's core voice, historical dietary philosophy, and quotes
  const fallback = `Prepared "${recipe.name}" with great reverence. The ${dominantElement.toLowerCase()} notes harmonize wonderfully with the natural seasoning, creating an uplifting and nourishing table experience.`

  const agentCtx = buildAgentContext(agent.id)
  const systemPrompt = agentCtx?.personaBlock

  const userPrompt = [
    `You are sharing a genuine culinary review and community tip for an existing dish in the kitchen: "${recipe.name}"${recipe.cuisine ? ` (${recipe.cuisine} cuisine)` : ''}.`,
    `You recently cooked and savored this dish under the influence of ${dominantPlanet} and the ${dominantElement} element.`,
    agent.historicalDiet?.dietaryPhilosophy
      ? `Keep in mind your historical culinary perspective: ${agent.historicalDiet.dietaryPhilosophy}`
      : '',
    promptHint ? `Focus note: ${promptHint}` : '',
    `Write a concise 2-sentence culinary reflection and cooking tip in your authentic, unmistakable historical voice.`,
    `Comment on its flavors, textures, balance of heat/herbs, or a subtle refinement you applied. Speak like a passionate human lover of food. Do NOT use greetings, do not use bullet points, and do not break character.`,
  ]
    .filter(Boolean)
    .join('\n')

  const review = await generateVoicedText(agent.id, userPrompt, {
    fallback,
    maxTokens: 160,
    systemOverride: systemPrompt,
  })

  const clampedRating = Math.min(5, Math.max(4, Math.round(rating)))

  // 5. Build WTEN delivery payload
  const agentEmail = `${agent.id}@agentic.alchm.kitchen`
  const idempotencyKey = stableEventId(`review:${agent.id}:${recipe.id}`, {
    dateSlot: Math.floor(Date.now() / 900_000),
    review,
  })

  const metadataPayload = {
    recipeId: recipe.id,
    recipe_id: recipe.id,
    recipeName: recipe.name,
    dishName: recipe.name,
    cuisine: recipe.cuisine,
    rating: clampedRating,
    review,
    madeIt: true,
    made_it: true,
    source: 'catalog_review',
    planetarySignature,
    agentProfile: {
      agentId: agent.id,
      name: agent.name,
      title: agent.title,
      era: agent.era,
      dominantElement,
      specialization: agent.specialization,
      dietaryPhilosophy: agent.historicalDiet?.dietaryPhilosophy,
    },
  }

  let eventId = idempotencyKey

  // 6. Deliver to WTEN (if requested)
  if (syncToWten) {
    try {
      const delivery = await deliverToWten({
        endpoint: 'feed',
        url: `${ALCHM_KITCHEN_BASE_URL}/api/feed`,
        headers: { Authorization: `Bearer ${getInternalApiSecret()}` },
        body: {
          agentEmail,
          agentDisplayName: agent.name,
          eventType: 'made_it',
          idempotencyKey,
          metadataPayload,
        },
        eventId: idempotencyKey,
      })

      if (delivery.ok && (delivery.body as any)?.event?.id) {
        eventId = String((delivery.body as any).event.id)
      }
    } catch (err) {
      console.warn(`[HistoricalRecipeReview] deliverToWten failed for ${agent.id}:`, err)
    }
  }

  // 7. Record in local agent_action_events for agent history and profile surface
  try {
    await prisma.agent_action_events.upsert({
      where: { idempotencyKey },
      update: {
        postedAt: new Date(),
        metadataPayload,
        status: 'completed',
      },
      create: {
        agentId: agent.id,
        agentEmail,
        eventType: 'made_it',
        triggerType: 'historical_recipe_review',
        triggerSummary: `Reviewed catalog recipe: ${recipe.name}`,
        metadataPayload,
        score: 0.95,
        idempotencyKey,
        status: 'completed',
        postedAt: new Date(),
      },
    })
  } catch (dbErr) {
    // Non-fatal if DB is offline or mock
    console.warn(`[HistoricalRecipeReview] local DB upsert skipped:`, dbErr)
  }

  return {
    ok: true,
    eventId,
    agent: {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      era: agent.era || 'Historical',
      dominantElement,
    },
    recipe,
    review,
    rating: clampedRating,
    planetarySignature,
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
