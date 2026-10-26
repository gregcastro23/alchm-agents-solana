import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { resolveAnyAgent } from '@/lib/agents/resolve-any-agent'
import { getAgentWeeklyMenu } from '@/lib/wtenClient'
import { backend } from '@/lib/backend'
import { recipeCatalogService, type CatalogRecipe } from '@/lib/recipes/recipe-catalog-service'

export const dynamic = 'force-dynamic'

// Days of the week in order (JavaScript Date style: 0 = Sunday)
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

const menuAssignmentsSchema = z.object({
  meals: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        mealType: z.enum(MEAL_TYPES),
        recipe: z.object({ id: z.string() }),
      })
    )
    .length(28),
  featuredMeals: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        mealType: z.enum(MEAL_TYPES),
        recipeId: z.string(),
      })
    )
    .optional(),
})

function validateMenuAssignments(
  menu: z.infer<typeof menuAssignmentsSchema>,
  ctx: z.RefinementCtx,
  allowedRecipeIds?: Set<string>
) {
  const slots = new Map<string, string>()
  menu.meals.forEach((meal, index) => {
    const slot = `${meal.dayOfWeek}:${meal.mealType}`
    if (slots.has(slot)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each day and meal type must occur exactly once',
        path: ['meals', index],
      })
    }
    if (allowedRecipeIds && !allowedRecipeIds.has(meal.recipe.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Recipe must exist in the catalog',
        path: ['meals', index, 'recipe', 'id'],
      })
    }
    slots.set(slot, meal.recipe.id)
  })
  menu.featuredMeals?.forEach((meal, index) => {
    if (slots.get(`${meal.dayOfWeek}:${meal.mealType}`) !== meal.recipeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Featured meal must reference the recipe assigned to that slot',
        path: ['featuredMeals', index],
      })
    }
  })
}

// Classical planetary rulers for the days of the week
const PLANETARY_RULERS = {
  0: 'Sun', // Sunday
  1: 'Moon', // Monday
  2: 'Mars', // Tuesday
  3: 'Mercury', // Wednesday
  4: 'Jupiter', // Thursday
  5: 'Venus', // Friday
  6: 'Saturn', // Saturday
} as const

// Elemental mapping for planetary days
const PLANETARY_ELEMENTS = {
  Sun: 'Fire',
  Moon: 'Water',
  Mars: 'Fire',
  Mercury: 'Air',
  Jupiter: 'Air',
  Venus: 'Water',
  Saturn: 'Earth',
} as const

function getSundayOfWeek(date: Date = new Date()): Date {
  const result = new Date(date)
  const day = result.getUTCDay()
  result.setUTCDate(result.getUTCDate() - day)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

export async function POST(request: NextRequest) {
  try {
    const {
      agentId,
      weekStartDate: requestedDate,
      regenerate = false,
      status = 'draft',
      shareToFeed = false,
    } = await request.json()

    if (status !== 'draft' || shareToFeed !== false) {
      return NextResponse.json(
        {
          success: false,
          error: 'Generation returns drafts. Use the authorized publish endpoint.',
        },
        { status: 400 }
      )
    }

    if (!agentId) {
      return NextResponse.json({ success: false, error: 'agentId is required' }, { status: 400 })
    }

    const agent = await resolveAnyAgent(agentId)
    if (!agent) {
      return NextResponse.json(
        { success: false, error: `Agent ${agentId} not found` },
        { status: 404 }
      )
    }

    // Resolve Sunday date
    const dateObj = requestedDate ? new Date(requestedDate) : new Date()
    if (Number.isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { success: false, error: 'weekStartDate must be a valid date' },
        { status: 400 }
      )
    }
    const sundayDate = getSundayOfWeek(dateObj)
    const weekStartDateStr = sundayDate.toISOString()

    // 1. Check if a menu already exists (use it to avoid replacing drafts unless requested)
    if (!regenerate) {
      try {
        const existing = await getAgentWeeklyMenu(agent.id, weekStartDateStr)
        if (existing) {
          let catalog: CatalogRecipe[]
          try {
            catalog = await recipeCatalogService.getAllRecipes()
            if (catalog.length === 0) throw new Error('No catalog recipes available')
          } catch (error) {
            console.warn('[Generate Menu] Cannot validate saved menu against catalog:', error)
            return NextResponse.json(
              { success: false, error: 'Recipe catalog is unavailable. Try again later.' },
              { status: 503 }
            )
          }
          const catalogIds = new Set(catalog.map(recipe => recipe.id))
          const checked = menuAssignmentsSchema
            .superRefine((menu, ctx) => {
              validateMenuAssignments(menu, ctx, catalogIds)
            })
            .safeParse(existing)
          if (checked.success) {
            return NextResponse.json({
              success: true,
              menu: { ...existing, status: 'draft', shareToFeed: false },
              reused: true,
            })
          }
          console.warn('[Generate Menu] Saved menu is invalid; generating a new draft')
        }
      } catch (e) {
        console.warn(`[Generate Menu] Failed to check existing menu:`, e)
      }
    }

    // 2. Fetch alchemical quantities or live sky to enrich the snapshot
    const dominantElement = agent.consciousness?.dominantElement || 'Earth'
    let currentTransits = {}
    try {
      const live = await backend.planetary.current()
      currentTransits = live.planetary_positions || {}
    } catch (e) {
      console.warn(`[Generate Menu] Failed to fetch current transits:`, e)
    }

    // Calculate zodiac sign of the week (Sun sign)
    const sunPos = (currentTransits as any)?.Sun
    const currentZodiacSign =
      sunPos?.sign || agent.consciousness?.natalChart?.planets?.Sun?.sign || 'Gemini'

    // Formulate a robust prompt reflecting the agent's specific culinary style and specialties
    const agentStyle = {
      name: agent.name,
      title: agent.title,
      specialty: agent.abilities?.specialty || agent.specialization || 'Philosophical gastronomy',
      era: agent.era || 'Historical',
      dominantElement,
      dominantModality: agent.consciousness?.dominantModality || 'Fixed',
      traits: agent.personality?.traits || [],
      diet: agent.historicalDiet || {},
    }

    console.log(
      `[Generate Menu] Planning weekly menu for ${agent.name} for week of ${weekStartDateStr}`
    )

    // Fetch candidate recipes from the catalog for the agent
    let candidateRecipes: CatalogRecipe[]
    try {
      candidateRecipes = await recipeCatalogService.findCandidatesForAgent(agent, {
        count: 32,
      })
      if (candidateRecipes.length === 0) throw new Error('No catalog candidates available')
    } catch (e) {
      console.warn(`[Generate Menu] Failed to fetch catalog candidates:`, e)
      return NextResponse.json(
        { success: false, error: 'Recipe catalog is unavailable. Try again later.' },
        { status: 503 }
      )
    }

    const candidateIds = candidateRecipes.map(recipe => recipe.id)
    const catalogRecipeId = z.enum(candidateIds as [string, ...string[]])
    const catalogPromptSection = `\nAUTHORITATIVE RECIPE CATALOG CANDIDATES (You must choose from these real catalog options, adapting them to your era/style with substitutions):
${candidateRecipes
  .map(
    (r, i) =>
      `${i + 1}. [ID: "${r.id}"] "${r.name}" (${r.cuisine || 'Global'}, Meal: ${r.mealType?.join('/') || 'any'}) - Ings: ${r.ingredients
        ?.slice(0, 5)
        .map(ing => ing.name)
        .join(', ')}`
  )
  .join('\n')}`

    const systemPrompt = `You are the ${agentStyle.name} (${agentStyle.title}), a legendary historical figure.
Specialty: ${agentStyle.specialty}
Culture/Era: ${agentStyle.era}
Dominant Element: ${agentStyle.dominantElement} (${agentStyle.dominantModality})
Culinary Heritage: ${JSON.stringify(agentStyle.diet)}
Personality Traits: ${agentStyle.traits.join(', ')}

Your task is to plan a complete, alchemically-attuned Weekly Menu for the week of ${weekStartDateStr}.
You must create exactly 28 meal slots: Sunday through Saturday, with breakfast, lunch, dinner, and snack for each day.
Each slot should reflect the planetary day alignment (Sunday is ruled by the Sun, Monday by the Moon, etc.) and your unique historical and culinary style.

CRITICAL GROUNDING REQUIREMENT:
You do NOT invent recipes out of nowhere. We have an authoritative catalog of ~1,000 recipes.
You MUST choose every recipe from the provided catalog candidates.
When choosing a catalog recipe:
- Use the exact catalog recipe "id" without changing or appending to it.
- Adapt the recipe to your planetary day, historical era, and dietary philosophy by swapping in substitutions for modern or avoided ingredients (e.g. replacing refined grains with ancient spelt/barley/farro, substituting meat with mushrooms/pulses/tofu if vegetarian, applying planetary herbs).
- In the "notes", explain your substitutions, planetary resonance, and historical rationale in your authentic voice.
${catalogPromptSection}

Each meal slot must have:
1. dayOfWeek: index 0 (Sunday) to 6 (Saturday).
2. mealType: "breakfast", "lunch", "dinner", or "snack".
3. servings: typically 1 or 2.
4. recipe: a beautiful, practical recipe that you adapted. It should include:
   - id: exact catalog recipe id
   - name: clear name of the dish (can append your adaptation, e.g. "Spelt Sourdough Adaptation")
   - cuisine: your culture's cuisine or adapted style
   - ingredients: array of strings of ingredients reflecting your substitutions
   - nutrition: estimated calories, protein (g), carbs (g), fat (g)
   - elementalProperties: Fire, Water, Earth, Air scores summing up to 1.0
5. planetarySnapshot: the planet ruling that day, the zodiac sign "${currentZodiacSign}", the current lunar phase, and elemental states.
6. notes: 1-2 sentences written in your unique voice explaining why this dish is perfect for this specific planetary day and your alchemical substitutions.

Create a premium, theme-based menu title (e.g. "Hildegard's Verdant Fermentation Week") and a one-sentence summary. Also list a consolidated groceryList of up to 25 items needed for the week. Make sure 3 to 6 of the best meals are selected as featuredMeals.`

    const zodSchema = z.object({
      title: z.string(),
      summary: z.string(),
      planetaryFocus: z.string(),
      dietaryFocus: z.string(),
      meals: z
        .array(
          z.object({
            id: z.string().optional(),
            dayOfWeek: z.number().int().min(0).max(6),
            mealType: z.enum(MEAL_TYPES),
            servings: z.number().positive().default(1),
            recipe: z.object({
              id: catalogRecipeId,
              name: z.string(),
              cuisine: z.string().optional(),
              ingredients: z.array(z.string()).optional(),
              nutrition: z
                .object({
                  calories: z.number(),
                  protein: z.number(),
                  carbs: z.number(),
                  fat: z.number(),
                })
                .optional(),
              elementalProperties: z.object({
                Fire: z.number(),
                Water: z.number(),
                Earth: z.number(),
                Air: z.number(),
              }),
            }),
            planetarySnapshot: z.object({
              dominantPlanet: z.string(),
              zodiacSign: z.string(),
              lunarPhase: z.string(),
              elementalState: z.object({
                Fire: z.number(),
                Water: z.number(),
                Earth: z.number(),
                Air: z.number(),
              }),
              timestamp: z.string(),
            }),
            notes: z.string(),
          })
        )
        .length(28),
      nutritionalTotals: z.object({
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
      }),
      groceryList: z.array(
        z.object({
          name: z.string(),
          category: z.string().optional(),
          quantity: z.number().optional(),
          unit: z.string().optional(),
        })
      ),
      inventory: z.array(z.string()).optional(),
      featuredMeals: z.array(
        z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          mealType: z.enum(MEAL_TYPES),
          recipeId: catalogRecipeId,
          recipeName: z.string(),
        })
      ),
    })

    // Provider schema hints are not an API boundary: validate every returned object locally.
    const validatedMenuSchema = zodSchema.superRefine((menu, ctx) => {
      validateMenuAssignments(menu, ctx)
    })

    let menuData: z.infer<typeof zodSchema>
    try {
      try {
        const { object } = await generateObject({
          model: openai('gpt-4o-mini'),
          schema: zodSchema,
          system: systemPrompt,
          prompt: `Generate the complete alchemically-attuned Weekly Menu for the week of ${weekStartDateStr} for agent "${agent.name}". Ensure exactly 28 meals are populated (Sunday-Saturday x breakfast/lunch/dinner/snack).`,
          temperature: 0.35,
        })
        menuData = validatedMenuSchema.parse(object)
      } catch (err: any) {
        if (!process.env.OPENROUTER_API_KEY) throw err
        console.warn('[Generate Menu] OpenAI call failed, falling back to OpenRouter:', err)
        const openrouter = createOpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: process.env.OPENROUTER_API_KEY,
        })
        const { object } = await generateObject({
          model: openrouter('openai/gpt-4o-mini'),
          schema: zodSchema,
          system: systemPrompt,
          prompt: `Generate the complete alchemically-attuned Weekly Menu for the week of ${weekStartDateStr} for agent "${agent.name}". Ensure exactly 28 meals are populated (Sunday-Saturday x breakfast/lunch/dinner/snack).`,
          temperature: 0.35,
        })
        menuData = validatedMenuSchema.parse(object)
      }
    } catch (error) {
      console.error('[Generate Menu] No valid catalog-grounded menu generated:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to generate a complete catalog-grounded weekly menu' },
        { status: 502 }
      )
    }

    // Attune meals list to have correct ISO timestamps and planetary rulers strictly matched to javascript dayOfWeek
    const enrichedMeals = menuData.meals.map(
      (meal: { dayOfWeek: number; mealType: string; [key: string]: any }) => {
        const targetDate = new Date(sundayDate)
        targetDate.setUTCDate(targetDate.getUTCDate() + meal.dayOfWeek)
        // Estimate reasonable hour based on mealType
        const hours =
          meal.mealType === 'breakfast'
            ? 8
            : meal.mealType === 'lunch'
              ? 12
              : meal.mealType === 'dinner'
                ? 19
                : 15
        targetDate.setUTCHours(hours, 0, 0, 0)

        const ruler = PLANETARY_RULERS[meal.dayOfWeek as keyof typeof PLANETARY_RULERS] || 'Moon'
        // Set standard fields
        meal.planetarySnapshot.dominantPlanet = ruler
        meal.planetarySnapshot.timestamp = targetDate.toISOString()
        meal.planetarySnapshot.zodiacSign = currentZodiacSign
        meal.id = `${DAYS[meal.dayOfWeek]}-${meal.mealType}`
        return meal
      }
    )

    const weekRuler = PLANETARY_RULERS[0]
    const weekElement = PLANETARY_ELEMENTS[weekRuler] || 'Fire'

    const weeklyMenuPayload: any = {
      agentSlug: agent.id,
      agentDisplayName: agent.name,
      weekStartDate: weekStartDateStr,
      status: 'draft',
      shareToFeed: false,
      title: menuData.title,
      summary: menuData.summary,
      planetaryFocus: menuData.planetaryFocus,
      dietaryFocus: menuData.dietaryFocus,
      meals: enrichedMeals,
      nutritionalTotals: menuData.nutritionalTotals,
      groceryList: menuData.groceryList,
      inventory: menuData.inventory,
      weeklyBudget: null,
      featuredMeals: menuData.featuredMeals,
      planetarySignature: {
        planetaryHour: 'Sun',
        planetaryDay: 'Sun',
        dominantElement: weekElement,
      },
    }

    return NextResponse.json({
      success: true,
      menu: weeklyMenuPayload,
      reused: false,
    })
  } catch (error: any) {
    console.error('[API Weekly Menu Generate] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate weekly menu' },
      { status: 500 }
    )
  }
}
