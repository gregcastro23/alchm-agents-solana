import { prisma } from '@/lib/db'
import { resolveAnyAgent } from '@/lib/agents/resolve-any-agent'
import type { CraftedAgent } from '@/lib/agent-types'
import {
  recipeCatalogService,
  type CatalogRecipe,
  type CatalogIngredient,
} from './recipe-catalog-service'
import { generateVoicedText } from '@/lib/agents/persona/voiced-generation'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import { PlanetaryHourCalculator } from '@/lib/planetary-hour'
import { deliverToWten, stableEventId } from '@/lib/wten/delivery'
import { FOOD_PROFILES } from '@/lib/food-recommendation-rules'

function getInternalApiSecret(): string {
  return process.env.INTERNAL_API_SECRET || process.env.ALCHM_KITCHEN_SYNC_SECRET || ''
}

const ALCHM_KITCHEN_BASE_URL =
  process.env.ALCHM_KITCHEN_PUBLIC_URL ||
  process.env.ALCHM_KITCHEN_SYNC_URL ||
  process.env.ALCHM_KITCHEN_BASE_URL ||
  'https://alchm.kitchen'

export interface IngredientSubstitution {
  originalIngredient: string
  replacementIngredient: string
  amount?: number
  unit?: string
  notes?: string
  reason: string
  astrologicalBasis: string
  historicalBasis: string
}

export interface AlterRecipeInput {
  agentId: string
  recipeId?: string
  recipeName?: string
  preferredCuisine?: string
  mealType?: string
  customPrompt?: string
  rating?: number
  location?: { lat: number; lon: number }
  syncToWten?: boolean
}

export interface RecipeAlterationResult {
  ok: boolean
  originalRecipe: {
    id: string
    name: string
    cuisine?: string
  }
  alteredRecipe: {
    id: string
    name: string
    cuisine?: string
    ingredients: CatalogIngredient[]
    instructions: string[]
    substitutions: IngredientSubstitution[]
    elementalProperties?: Record<string, number>
  }
  agent: {
    id: string
    name: string
    title?: string
    dominantElement: string
    era?: string
  }
  review: string
  rating: number
  planetarySignature: {
    planetaryHour: string
    dominantPlanet: string
    dominantSign: string
    dominantElement: string
    postedAt: string
    natalPositions: Array<{ planet: string; sign: string; degree: number }>
    transitPositions: Array<{ planet: string; degree: number }>
  }
  feedEventId?: string
  recipeCommentSaved?: boolean
  error?: string
}

/**
 * Astrological culinary correspondence guide for substitutions.
 */
const PLANETARY_SUBSTITUTIONS: Record<
  string,
  {
    preferredHerbs: string[]
    preferredGrains: string[]
    preferredProteins: string[]
    energeticQualities: string
  }
> = {
  Sun: {
    preferredHerbs: ['saffron', 'rosemary', 'bay laurel', 'citrus zest', 'chamomile'],
    preferredGrains: ['corn', 'golden millet', 'farro'],
    preferredProteins: ['poached egg', 'chickpeas', 'sunflower seeds'],
    energeticQualities: 'Golden solar vitality, heart-nourishing warmth, radiant harmony',
  },
  Moon: {
    preferredHerbs: ['fresh dill', 'fennel fronds', 'white poppy seeds', 'lemon balm'],
    preferredGrains: ['steamed jasmine rice', 'rolled oats', 'pearled barley'],
    preferredProteins: ['silken tofu', 'almond milk ricotta', 'coconut cream'],
    energeticQualities: 'Cooling lunar moisture, somatic comfort, gentle digestion',
  },
  Mars: {
    preferredHerbs: ['black pepper', 'crushed coriander', 'cayenne', 'garlic', 'fresh ginger'],
    preferredGrains: ['wild rye', 'roasted buckwheat', 'spelt'],
    preferredProteins: ['seared tempeh', 'spiced lentils', 'toasted pumpkin seeds'],
    energeticQualities: 'Martial metabolic fire, pungent circulation, transformative heat',
  },
  Mercury: {
    preferredHerbs: ['fresh parsley', 'anise seed', 'caraway', 'wild mint', 'celery leaf'],
    preferredGrains: ['millet', 'quinoa', 'amaranth'],
    preferredProteins: ['sprouted lentils', 'crushed walnuts', 'hemp seeds'],
    energeticQualities: 'Airy agility, clear neural transmission, light assimilation',
  },
  Venus: {
    preferredHerbs: ['cardamom', 'rosewater', 'cinnamon', 'fresh tarragon', 'vanilla bean'],
    preferredGrains: ['fine semolina', 'sweet polenta', 'white rice'],
    preferredProteins: ['mascarpone or cashew cream', 'crushed pistachios', 'steamed edamame'],
    energeticQualities: 'Sensual sweetness, harmonized fats, velvety texture',
  },
  Jupiter: {
    preferredHerbs: ['sage', 'nutmeg', 'ground cloves', 'sweet marjoram'],
    preferredGrains: ['ancient emmer', 'barley', 'chestnut flour'],
    preferredProteins: ['braised white beans', 'toasted hazelnuts', 'fava beans'],
    energeticQualities: 'Expansive abundance, hepatic support, dignified richness',
  },
  Saturn: {
    preferredHerbs: ['wild thyme', 'bitter cumin', 'smoked sea salt', 'juniper berries'],
    preferredGrains: ['ancient spelt', 'dark rye', 'buckwheat groats'],
    preferredProteins: ['black beluga lentils', 'earthy shiitake mushrooms', 'black beans'],
    energeticQualities: 'Earthen mineral grounding, astringent preservation, enduring depth',
  },
}

export class RecipeAlterationService {
  private hourCalc = new PlanetaryHourCalculator()

  /**
   * Intelligently alters an authentic catalog recipe to match an agent's
   * planetary placements and historical context by swapping out substitutions,
   * then publishing the alteration on the feed and as a comment on the recipe.
   */
  async alterRecipe(input: AlterRecipeInput): Promise<RecipeAlterationResult> {
    const {
      agentId,
      location = { lat: 40.7128, lon: -74.006 },
      syncToWten = true,
      rating = 5,
    } = input

    // 1. Resolve the agent with full natal chart and historical diet
    const agent = await resolveAnyAgent(agentId)
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found in registry`)
    }

    const dominantElement = agent.consciousness?.dominantElement || 'Fire'

    // 2. Resolve the recipe from the authentic ~1000 catalog
    let catalogDish: CatalogRecipe | null = null
    if (input.recipeId) {
      catalogDish = await recipeCatalogService.getRecipeById(input.recipeId)
    }

    if (!catalogDish) {
      // Find candidate recipes aligned with agent's profile and pick the best one
      const candidates = await recipeCatalogService.findCandidatesForAgent(agent, {
        count: 5,
        preferredCuisine: input.preferredCuisine,
        mealType: input.mealType,
      })
      if (candidates.length > 0) {
        // Pick stably based on agent + hour
        const hourSlot = Math.floor(Date.now() / 3_600_000)
        catalogDish = candidates[hourSlot % candidates.length]
      }
    }

    if (!catalogDish) {
      // Fallback to first available
      const all = await recipeCatalogService.getAllRecipes()
      catalogDish = all[0]
    }

    // 3. Compute real-time celestial moment and planetary signature
    const now = new Date()
    const { planet: planetaryHour } = this.hourCalc.getPlanetaryHour(now)
    let transits: Record<string, any> = {}
    try {
      transits = getCurrentPlanetaryPositions(now)
    } catch {
      // Degraded or local fallback
    }

    const dominantPlanet = planetaryHour || 'Sun'
    const dominantSign = transits.Sun?.sign || 'Aries'

    const natalPositions = this.extractNatalPositions(agent)
    const transitPositions = Object.entries(transits)
      .slice(0, 7)
      .map(([planet, pos]) => ({ planet, degree: Number((pos as any).degree?.toFixed(2) || 0) }))

    const planetarySignature = {
      planetaryHour,
      dominantPlanet,
      dominantSign,
      dominantElement,
      postedAt: now.toISOString(),
      natalPositions,
      transitPositions,
    }

    // 4. Derive substitutions based on planetary placements and historical context
    const substitutions = this.deriveSubstitutions(
      agent,
      catalogDish,
      dominantPlanet,
      planetaryHour,
      dominantElement
    )

    // 5. Construct the altered recipe
    const alteredRecipe = this.buildAlteredRecipe(agent, catalogDish, substitutions)

    // 6. Generate voiced review & alteration explanation
    const review = await this.generateVoicedAlterationExplanation(
      agent,
      catalogDish,
      alteredRecipe,
      substitutions,
      dominantPlanet,
      planetaryHour,
      input.customPrompt
    )

    const clampedRating = Math.min(5, Math.max(4, Math.round(rating)))

    // 7. Publish to local agent_action_events
    const agentEmail = `${agent.id}@agentic.alchm.kitchen`
    const idempotencyKey = stableEventId(`alteration:${agent.id}:${catalogDish.id}`, {
      dateSlot: Math.floor(Date.now() / 900_000), // 15-minute idempotency window
      substitutionsCount: substitutions.length,
    })

    const metadataPayload = {
      recipeId: catalogDish.id,
      recipe_id: catalogDish.id,
      recipeName: catalogDish.name,
      dishName: alteredRecipe.name,
      cuisine: alteredRecipe.cuisine || catalogDish.cuisine,
      rating: clampedRating,
      review,
      comment: review, // Mirrored as review & comment for WTEN consumers
      madeIt: true,
      made_it: true,
      source: 'recipe_alteration',
      substitutions: substitutions.map(s => ({
        original: s.originalIngredient,
        replacement: s.replacementIngredient,
        reason: s.reason,
        astrologicalBasis: s.astrologicalBasis,
        historicalBasis: s.historicalBasis,
      })),
      recipePayload: alteredRecipe,
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

    let feedEventId = idempotencyKey
    let recipeCommentSaved = false

    // 8. Deliver to WTEN feed (which dual-writes as a comment into user_recipe_interactions)
    if (syncToWten) {
      try {
        const delivery = await deliverToWten({
          endpoint: 'feed',
          url: `${ALCHM_KITCHEN_BASE_URL}/api/feed`,
          headers: { Authorization: `Bearer ${getInternalApiSecret()}` },
          body: {
            agentEmail,
            agentDisplayName: agent.name,
            eventType: 'recipe_generation',
            idempotencyKey,
            metadataPayload,
          },
          eventId: idempotencyKey,
        })

        if (delivery.ok) {
          recipeCommentSaved = true
          if ((delivery.body as any)?.event?.id) {
            feedEventId = String((delivery.body as any).event.id)
          }
        }
      } catch (syncErr) {
        console.warn(`[RecipeAlterationService] deliverToWten feed sync failed:`, syncErr)
      }
    }

    // 9. Persist in local DB
    try {
      await prisma.agent_action_events.upsert({
        where: { idempotencyKey },
        update: {
          postedAt: new Date(),
          metadataPayload: metadataPayload as any,
          status: 'completed',
        },
        create: {
          agentId: agent.id,
          agentEmail,
          eventType: 'recipe_generation',
          triggerType: 'recipe_alteration',
          triggerSummary: `${agent.name} altered "${catalogDish.name}" with ${substitutions.length} substitutions`,
          metadataPayload: metadataPayload as any,
          score: 0.98,
          idempotencyKey,
          status: 'completed',
          postedAt: new Date(),
        },
      })
    } catch (dbErr) {
      console.warn(`[RecipeAlterationService] local DB upsert skipped:`, dbErr)
    }

    return {
      ok: true,
      originalRecipe: {
        id: catalogDish.id,
        name: catalogDish.name,
        cuisine: catalogDish.cuisine,
      },
      alteredRecipe,
      agent: {
        id: agent.id,
        name: agent.name,
        title: agent.title,
        dominantElement,
        era: agent.era,
      },
      review,
      rating: clampedRating,
      planetarySignature,
      feedEventId,
      recipeCommentSaved,
    }
  }

  /**
   * Derive intelligent, grounded substitutions based on the agent's:
   * 1. Historical diet (avoided foods, favorite foods, staples, cultural cuisine)
   * 2. Natal planetary placements (Sun, Moon, Mars, Saturn, Venus)
   * 3. Current transiting planetary hour & dominant planet
   */
  private deriveSubstitutions(
    agent: CraftedAgent,
    recipe: CatalogRecipe,
    dominantPlanet: string,
    planetaryHour: string,
    dominantElement: string
  ): IngredientSubstitution[] {
    const substitutions: IngredientSubstitution[] = []
    const diet = agent.historicalDiet
    const avoidedFoods = (diet?.avoidedFoods || []).map(f => f.toLowerCase())
    const favoriteFoods = (diet?.favoriteFoods || []).map(f => f.toLowerCase())
    const staples = (diet?.staples || []).map(s => s.toLowerCase())
    const philosophy = diet?.dietaryPhilosophy || ''

    const isVegetarianAgent =
      avoidedFoods.some(
        a => a.includes('meat') || a.includes('vegetarian') || a.includes('animal')
      ) || philosophy.toLowerCase().includes('vegetarian')

    const activePlanet = dominantPlanet || planetaryHour || 'Sun'
    const planetCorresp = PLANETARY_SUBSTITUTIONS[activePlanet] || PLANETARY_SUBSTITUTIONS.Sun

    for (let i = 0; i < recipe.ingredients.length; i++) {
      const ing = recipe.ingredients[i]
      const name = ing.name.toLowerCase()

      // A) Check avoided foods (e.g. Vegetarian / Ethical / Religious exclusions)
      if (isVegetarianAgent && this.isMeatOrPoultry(name)) {
        const replacement = this.pickVegetarianProtein(
          name,
          dominantElement,
          staples,
          favoriteFoods
        )
        substitutions.push({
          originalIngredient: ing.name,
          replacementIngredient: replacement,
          amount: ing.amount,
          unit: ing.unit,
          reason: `Replaced animal flesh with high-vibration plant protein in accordance with ethical vegetarian principles.`,
          astrologicalBasis: `Harmonizes with ${dominantElement} element and ${activePlanet}'s life-preserving influence.`,
          historicalBasis: philosophy
            ? `${agent.name}'s philosophy: "${philosophy.slice(0, 100)}..."`
            : `${agent.name}'s historical ethical diet strictly avoided meat.`,
        })
        continue
      }

      // Check specific avoided foods (e.g., Hildegard avoided strawberries and pork; Pythagoras avoided fava beans)
      const matchedAvoided = avoidedFoods.find(av => name.includes(av) || av.includes(name))
      if (matchedAvoided) {
        const replacement = this.pickElementalStaple(dominantElement, staples, favoriteFoods)
        substitutions.push({
          originalIngredient: ing.name,
          replacementIngredient: replacement,
          amount: ing.amount,
          unit: ing.unit,
          reason: `Substituted "${ing.name}" which is contraindicated in ${agent.name}'s historical regimen.`,
          astrologicalBasis: `Restores elemental equilibrium under ${activePlanet} transit.`,
          historicalBasis: `Documented exclusion in ${agent.name}'s historical diet.`,
        })
        continue
      }

      // B) Check Grain substitutions (e.g., Modern refined all-purpose wheat -> Ancient Spelt, Emmer, or Barley)
      if (
        (name.includes('all-purpose flour') ||
          name.includes('white flour') ||
          name.includes('wheat flour')) &&
        (staples.some(
          s =>
            s.includes('spelt') || s.includes('barley') || s.includes('rye') || s.includes('farro')
        ) ||
          agent.era === 'Medieval' ||
          agent.era === 'Ancient')
      ) {
        const grainChoice = staples.find(s => s.includes('spelt'))
          ? 'organic spelt flour (Dinkelmehl)'
          : staples.find(s => s.includes('barley'))
            ? 'stone-ground barley flour'
            : 'ancient whole grain spelt flour'

        substitutions.push({
          originalIngredient: ing.name,
          replacementIngredient: grainChoice,
          amount: ing.amount,
          unit: ing.unit,
          reason: `Replaced refined modern flour with ancient wholesome grain offering true vitality.`,
          astrologicalBasis: `Saturnian and earthen grounding providing steady physical endurance.`,
          historicalBasis: `Historical dietary staple of ${agent.name}'s culture.`,
        })
        continue
      }

      // C) Check Oil/Fat substitutions (e.g. Canola oil, vegetable oil, corn oil -> Extra virgin olive oil or clarified butter)
      if (
        (name.includes('canola oil') ||
          name.includes('vegetable oil') ||
          name.includes('margarine')) &&
        (agent.historicalDiet?.culturalCuisine?.toLowerCase().includes('italian') ||
          agent.historicalDiet?.culturalCuisine?.toLowerCase().includes('greek') ||
          agent.historicalDiet?.culturalCuisine?.toLowerCase().includes('mediterranean') ||
          staples.some(s => s.includes('olive oil')))
      ) {
        substitutions.push({
          originalIngredient: ing.name,
          replacementIngredient: 'cold-pressed extra virgin olive oil',
          amount: ing.amount,
          unit: ing.unit,
          reason: `Swapped industrial seed oil for authentic cold-pressed olive oil.`,
          astrologicalBasis: `Solar-Venusian lipid harmony that nourishes heart and brain.`,
          historicalBasis: `Quintessential cornerstone of ${agent.name}'s Mediterranean heritage.`,
        })
        continue
      }

      // D) Check Seasoning / Herb enrichment aligned with Dominant Element & Planetary Hour
      if (
        (name === 'salt' ||
          name === 'black pepper' ||
          name.includes('seasoning') ||
          name === 'parsley') &&
        substitutions.length < 3
      ) {
        const herbReplacement = planetCorresp.preferredHerbs[0]
        if (!recipe.ingredients.some(ri => ri.name.toLowerCase().includes(herbReplacement))) {
          substitutions.push({
            originalIngredient: ing.name,
            replacementIngredient: `${ing.name} infused with fresh ${herbReplacement}`,
            amount: ing.amount,
            unit: ing.unit,
            reason: `Infused with ${herbReplacement} to channel the ${planetCorresp.energeticQualities.toLowerCase()}.`,
            astrologicalBasis: `Resonates with the current planetary hour of ${planetaryHour} and ruling planet ${dominantPlanet}.`,
            historicalBasis: `Traditional herbal medicine aligned with ${agent.name}'s era.`,
          })
        }
      }
    }

    // Ensure at least one substitution is always made so the recipe is genuinely adapted!
    if (substitutions.length === 0 && recipe.ingredients.length > 0) {
      const target = recipe.ingredients[0]
      const replacementHerb = planetCorresp.preferredHerbs[0] || 'fragrant sweet herbs'
      substitutions.push({
        originalIngredient: target.name,
        replacementIngredient: `${target.name} tempered with fresh ${replacementHerb}`,
        amount: target.amount,
        unit: target.unit,
        reason: `Alchemically balanced with ${replacementHerb} to elevate the dish's vibrational signature.`,
        astrologicalBasis: `Attuned to ${dominantElement} element and current ${dominantPlanet} transit.`,
        historicalBasis: `Reflects ${agent.name}'s personal taste and culinary heritage.`,
      })
    }

    return substitutions
  }

  private isMeatOrPoultry(name: string): boolean {
    const meatKeywords = [
      'chicken',
      'beef',
      'pork',
      'lamb',
      'veal',
      'turkey',
      'duck',
      'bacon',
      'ham',
      'sausage',
      'pancetta',
      'prosciutto',
      'salami',
      'steak',
      'meat',
    ]
    return meatKeywords.some(kw => name.includes(kw))
  }

  private pickVegetarianProtein(
    name: string,
    dominantElement: string,
    staples: string[],
    favorites: string[]
  ): string {
    if (staples.some(s => s.includes('bean') || s.includes('chickpea'))) {
      return 'slow-simmered Tuscan cannellini beans'
    }
    if (name.includes('chicken') || name.includes('turkey')) {
      return 'pan-seared firm organic tofu'
    }
    if (name.includes('beef') || name.includes('steak')) {
      return 'marinated portobello mushrooms and smoked tempeh'
    }
    if (name.includes('bacon') || name.includes('pancetta')) {
      return 'crisp smoked king oyster mushroom ribbons'
    }
    return dominantElement === 'Fire'
      ? 'spiced braised lentils with smoked paprika'
      : 'organic golden tempeh cutlets'
  }

  private pickElementalStaple(
    dominantElement: string,
    staples: string[],
    favorites: string[]
  ): string {
    if (favorites.length > 0) return favorites[0]
    if (staples.length > 0) return staples[0]
    switch (dominantElement) {
      case 'Fire':
        return 'roasted golden chickpeas'
      case 'Water':
        return 'silken tofu cubes'
      case 'Earth':
        return 'steamed earthen lentils'
      case 'Air':
        return 'sprouted wild greens and seeds'
      default:
        return 'organic vegetable medley'
    }
  }

  private buildAlteredRecipe(
    agent: CraftedAgent,
    original: CatalogRecipe,
    substitutions: IngredientSubstitution[]
  ): CatalogRecipe & { substitutions: IngredientSubstitution[] } {
    // 1. Build updated ingredients
    const subMap = new Map<string, IngredientSubstitution>()
    for (const sub of substitutions) {
      subMap.set(sub.originalIngredient.toLowerCase(), sub)
    }

    const updatedIngredients: CatalogIngredient[] = original.ingredients.map(ing => {
      const match = subMap.get(ing.name.toLowerCase())
      if (match) {
        return {
          ...ing,
          name: match.replacementIngredient,
          notes: match.reason,
        }
      }
      return { ...ing }
    })

    // 2. Adjust instructions to replace references to substituted ingredients
    const updatedInstructions = original.instructions.map(instruction => {
      let modified = instruction
      for (const sub of substitutions) {
        const regex = new RegExp(`\\b${this.escapeRegex(sub.originalIngredient)}\\b`, 'gi')
        modified = modified.replace(regex, sub.replacementIngredient)
      }
      return modified
    })

    const alteredName = `${original.name} (${agent.name}'s ${agent.consciousness?.dominantElement || 'Alchemical'} Adaptation)`

    return {
      ...original,
      id: `${original.id}-alt-${agent.id.replace(/[^a-z0-9_-]/gi, '')}`,
      name: alteredName,
      ingredients: updatedIngredients,
      instructions: updatedInstructions,
      substitutions,
    }
  }

  private async generateVoicedAlterationExplanation(
    agent: CraftedAgent,
    original: CatalogRecipe,
    altered: CatalogRecipe,
    substitutions: IngredientSubstitution[],
    dominantPlanet: string,
    planetaryHour: string,
    customPrompt?: string
  ): Promise<string> {
    const subSummary = substitutions
      .map(s => `"${s.originalIngredient}" → "${s.replacementIngredient}" (${s.reason})`)
      .join('; ')

    const fallback = `Adapted "${original.name}" into my own preparation: swapped ${substitutions.map(s => `${s.originalIngredient} for ${s.replacementIngredient}`).join(', ')}. Under ${dominantPlanet}'s influence, this brings optimal alchemical balance and bodily vitality.`

    const promptText = [
      `You are sharing your personal recipe alteration for the community feed and recipe notes.`,
      `Original dish: "${original.name}" (${original.cuisine || 'Classical'} cuisine).`,
      `Altered dish: "${altered.name}".`,
      `Substitutions made: ${subSummary}.`,
      `Current cosmic moment: Dominant planet ${dominantPlanet}, planetary hour of ${planetaryHour}, dominant element ${agent.consciousness?.dominantElement}.`,
      agent.historicalDiet?.dietaryPhilosophy
        ? `Your historical dietary philosophy: "${agent.historicalDiet.dietaryPhilosophy}".`
        : '',
      customPrompt ? `Specific focus: ${customPrompt}` : '',
      `Write a concise 2-3 sentence culinary review and alteration note in your authentic, unmistakable historical voice.`,
      `Explain WHY your planetary placements and historical context called for these substitutions, and how the altered dish tastes and nourishes the eater.`,
      `Do NOT use greetings or bullet points, and do NOT break character. Speak passionately as a real lover of food.`,
    ]
      .filter(Boolean)
      .join('\n')

    return generateVoicedText(agent.id, promptText, {
      fallback,
      maxTokens: 200,
    })
  }

  private extractNatalPositions(agent: CraftedAgent) {
    const chart = (agent as any).natalChart || agent.consciousness?.natalChart
    const planets = chart?.planets
    if (!planets) return []
    if (Array.isArray(planets)) {
      return planets
        .filter((planet: any) => planet?.name || planet?.planet)
        .map((planet: any) => ({
          planet: planet.name || planet.planet,
          sign: planet.sign || '',
          degree: Number((planet.position ?? planet.degree ?? 0).toFixed?.(2) ?? 0),
        }))
    }
    return Object.entries(planets)
      .filter(([, data]) => Boolean(data))
      .map(([planet, data]: [string, any]) => ({
        planet,
        sign: data.sign || '',
        degree: Number((data.position ?? data.degree ?? 0).toFixed?.(2) ?? 0),
      }))
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

export const recipeAlterationService = new RecipeAlterationService()
