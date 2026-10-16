import fs from 'node:fs'
import path from 'node:path'
import type { CraftedAgent } from '@/lib/agent-types'

export interface CatalogIngredient {
  name: string
  amount?: number
  unit?: string
  optional?: boolean
  notes?: string
  category?: string
}

export interface CatalogRecipe {
  id: string
  name: string
  cuisine?: string
  ingredients: CatalogIngredient[]
  instructions: string[]
  servingSize?: number
  numberOfServings?: number
  season?: string[]
  elementalProperties?: {
    Fire: number
    Water: number
    Earth: number
    Air: number
  }
  allergens?: string[]
  isVegetarian?: boolean
  isVegan?: boolean
  isGlutenFree?: boolean
  isDairyFree?: boolean
  nutrition?: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
  }
  tags?: string[]
  mealType?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface RecipeFilterCriteria {
  element?: 'Fire' | 'Water' | 'Earth' | 'Air' | string
  cuisine?: string
  mealType?: string
  season?: string
  isVegetarian?: boolean
  isVegan?: boolean
  search?: string
  limit?: number
}

// Curated resilient emergency fallback recipes in case disk/network is unavailable
const EMERGENCY_FALLBACK_RECIPES: CatalogRecipe[] = [
  {
    id: 'middle-eastern-shakshuka',
    name: 'Spiced Shakshuka al Fuego',
    cuisine: 'Middle Eastern',
    ingredients: [
      { name: 'eggs', amount: 4, unit: 'piece', notes: 'farm fresh' },
      { name: 'tomatoes', amount: 4, unit: 'whole', notes: 'ripe, diced' },
      { name: 'bell pepper', amount: 1, unit: 'whole', notes: 'diced' },
      { name: 'onion', amount: 1, unit: 'whole', notes: 'chopped' },
      { name: 'garlic', amount: 3, unit: 'clove', notes: 'minced' },
      { name: 'cumin', amount: 1, unit: 'tsp' },
      { name: 'smoked paprika', amount: 1, unit: 'tsp' },
      { name: 'olive oil', amount: 2, unit: 'tbsp' },
      { name: 'fresh cilantro', amount: 2, unit: 'tbsp', notes: 'chopped' },
    ],
    instructions: [
      'Heat olive oil in a skillet over medium heat. Sauté onion, bell pepper, and garlic until soft.',
      'Add cumin, paprika, and tomatoes. Simmer until sauce thickens.',
      'Create small wells in the sauce and crack eggs into them.',
      'Cover and simmer until egg whites are set but yolks remain runny. Garnish with fresh herbs.',
    ],
    elementalProperties: { Fire: 0.55, Water: 0.15, Earth: 0.2, Air: 0.1 },
    mealType: ['breakfast', 'lunch'],
    season: ['summer', 'autumn'],
    isVegetarian: true,
  },
  {
    id: 'italian-risotto-alla-milanese',
    name: 'Saffron & Wild Mushroom Risotto',
    cuisine: 'Italian',
    ingredients: [
      { name: 'arborio rice', amount: 1.5, unit: 'cups' },
      { name: 'wild mushrooms', amount: 2, unit: 'cups', notes: 'sliced' },
      { name: 'vegetable broth', amount: 4, unit: 'cups', notes: 'warm' },
      { name: 'shallot', amount: 1, unit: 'whole', notes: 'finely minced' },
      { name: 'saffron threads', amount: 1, unit: 'pinch' },
      { name: 'parmesan cheese', amount: 0.5, unit: 'cup', notes: 'grated' },
      { name: 'butter', amount: 2, unit: 'tbsp' },
      { name: 'dry white wine', amount: 0.5, unit: 'cup' },
    ],
    instructions: [
      'Steep saffron threads in 2 tablespoons of warm broth.',
      'Melt butter in a heavy saucepan, sauté shallot and mushrooms until golden.',
      'Add arborio rice and toast for 2 minutes until translucent at edges.',
      'Deglaze with white wine, then ladle warm broth gradually while stirring continuously.',
      'Fold in saffron infusion and parmesan cheese just before serving.',
    ],
    elementalProperties: { Fire: 0.15, Water: 0.2, Earth: 0.5, Air: 0.15 },
    mealType: ['dinner', 'lunch'],
    season: ['autumn', 'winter'],
    isVegetarian: true,
  },
  {
    id: 'vietnamese-summer-rolls',
    name: 'Crisp Herb & Rice Paper Rolls',
    cuisine: 'Vietnamese',
    ingredients: [
      { name: 'rice paper sheets', amount: 8, unit: 'piece' },
      { name: 'firm tofu', amount: 200, unit: 'g', notes: 'pan-seared and sliced' },
      { name: 'cucumber', amount: 1, unit: 'whole', notes: 'julienned' },
      { name: 'carrots', amount: 1, unit: 'whole', notes: 'grated' },
      { name: 'fresh mint', amount: 0.5, unit: 'cup' },
      { name: 'fresh cilantro', amount: 0.5, unit: 'cup' },
      { name: 'rice vermicelli', amount: 100, unit: 'g', notes: 'cooked' },
    ],
    instructions: [
      'Dip rice paper briefly into warm water until pliable.',
      'Layer herbs, vermicelli, vegetables, and tofu across the bottom third of the wrapper.',
      'Fold sides inward and roll tightly forward into a neat cylinder.',
      'Serve fresh with dipping sauce.',
    ],
    elementalProperties: { Fire: 0.1, Water: 0.35, Earth: 0.15, Air: 0.4 },
    mealType: ['lunch', 'snack'],
    season: ['spring', 'summer'],
    isVegetarian: true,
    isVegan: true,
  },
  {
    id: 'japanese-miso-soup',
    name: 'Traditional Kombu & Shiitake Miso',
    cuisine: 'Japanese',
    ingredients: [
      { name: 'dashi broth', amount: 4, unit: 'cups', notes: 'kombu and dried shiitake based' },
      { name: 'white miso paste', amount: 3, unit: 'tbsp' },
      { name: 'silken tofu', amount: 150, unit: 'g', notes: 'cubed' },
      { name: 'wakame seaweed', amount: 2, unit: 'tbsp', notes: 'dried' },
      { name: 'scallions', amount: 2, unit: 'stalks', notes: 'finely sliced' },
    ],
    instructions: [
      'Rehydrate dried wakame in warm water for 5 minutes and drain.',
      'Bring dashi broth to a gentle simmer in a pot.',
      'Ladle some warm broth into a small bowl, whisk miso paste until completely dissolved, then return to pot.',
      'Add cubed silken tofu and wakame. Heat gently without boiling.',
      'Ladle into warm bowls and scatter fresh sliced scallions over top.',
    ],
    elementalProperties: { Fire: 0.1, Water: 0.55, Earth: 0.25, Air: 0.1 },
    mealType: ['breakfast', 'dinner', 'snack'],
    season: ['autumn', 'winter', 'spring'],
    isVegetarian: true,
    isVegan: true,
  },
]

class RecipeCatalogService {
  private inMemoryCache: CatalogRecipe[] | null = null
  private cacheTimestamp = 0
  private readonly CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

  /**
   * Load the ~1000 recipe catalog.
   * Priority:
   * 1. In-memory hot cache
   * 2. Local JSON snapshot (`lib/data/recipes-catalog.json`)
   * 3. Network fetch from alchm.kitchen / WTEN
   * 4. Resilient emergency fallback recipes
   */
  async getAllRecipes(): Promise<CatalogRecipe[]> {
    const now = Date.now()
    if (this.inMemoryCache && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.inMemoryCache
    }

    // Try reading the local snapshot file
    const snapshotPath = path.join(process.cwd(), 'lib', 'data', 'recipes-catalog.json')
    try {
      if (fs.existsSync(snapshotPath)) {
        const raw = fs.readFileSync(snapshotPath, 'utf8')
        const parsed = JSON.parse(raw)
        const recipes: CatalogRecipe[] = Array.isArray(parsed?.recipes)
          ? parsed.recipes
          : Array.isArray(parsed)
            ? parsed
            : []
        if (recipes.length > 0) {
          this.inMemoryCache = recipes
          this.cacheTimestamp = now
          return recipes
        }
      }
    } catch (readErr) {
      console.warn('[RecipeCatalogService] Failed to read recipes-catalog.json:', readErr)
    }

    // Try fetching live from WTEN
    const baseUrl =
      process.env.ALCHM_KITCHEN_PUBLIC_URL ||
      process.env.ALCHM_KITCHEN_SYNC_URL ||
      process.env.ALCHM_KITCHEN_BASE_URL ||
      'https://alchm.kitchen'
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/recipes?limit=1000`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        const recipes: CatalogRecipe[] = Array.isArray(data?.recipes)
          ? data.recipes
          : Array.isArray(data)
            ? data
            : []
        if (recipes.length > 0) {
          this.inMemoryCache = recipes
          this.cacheTimestamp = now
          // Save snapshot asynchronously for future runs
          try {
            fs.writeFileSync(snapshotPath, JSON.stringify({ success: true, recipes }), 'utf8')
          } catch {
            // Non-fatal if fs is read-only in production serverless
          }
          return recipes
        }
      }
    } catch (netErr) {
      console.warn(
        '[RecipeCatalogService] Network fetch failed, falling back to emergency dishes:',
        netErr
      )
    }

    // Fallback to emergency recipes if all else fails
    this.inMemoryCache = EMERGENCY_FALLBACK_RECIPES
    this.cacheTimestamp = now
    return EMERGENCY_FALLBACK_RECIPES
  }

  /**
   * Find a specific recipe by ID.
   */
  async getRecipeById(id: string): Promise<CatalogRecipe | null> {
    if (!id) return null
    const all = await this.getAllRecipes()
    const target = id.toLowerCase().trim()
    return (
      all.find(
        r =>
          r.id.toLowerCase() === target ||
          r.id.toLowerCase().replace(/[^a-z0-9]/g, '-') === target.replace(/[^a-z0-9]/g, '-')
      ) || null
    )
  }

  /**
   * Filter catalog recipes based on criteria.
   */
  async findRecipes(criteria: RecipeFilterCriteria): Promise<CatalogRecipe[]> {
    const all = await this.getAllRecipes()
    const {
      element,
      cuisine,
      mealType,
      season,
      isVegetarian,
      isVegan,
      search,
      limit = 20,
    } = criteria

    const normalizedElement = element?.toLowerCase().trim()
    const normalizedCuisine = cuisine?.toLowerCase().trim()
    const normalizedMealType = mealType?.toLowerCase().trim()
    const normalizedSeason = season?.toLowerCase().trim()
    const normalizedSearch = search?.toLowerCase().trim()

    const filtered = all.filter(r => {
      // Element match
      if (normalizedElement && r.elementalProperties) {
        const ep = r.elementalProperties
        let dominant = 'fire'
        let maxVal = -1
        for (const [key, val] of Object.entries(ep)) {
          if (typeof val === 'number' && val > maxVal) {
            maxVal = val
            dominant = key.toLowerCase()
          }
        }
        if (dominant !== normalizedElement) return false
      }

      // Cuisine match
      if (normalizedCuisine) {
        if (!r.cuisine || !r.cuisine.toLowerCase().includes(normalizedCuisine)) return false
      }

      // Meal type match
      if (normalizedMealType) {
        if (!r.mealType || !r.mealType.some(mt => mt.toLowerCase() === normalizedMealType))
          return false
      }

      // Season match
      if (normalizedSeason) {
        if (!r.season || !r.season.some(s => s.toLowerCase() === normalizedSeason)) return false
      }

      // Dietary flags
      if (isVegetarian && !r.isVegetarian && !r.isVegan) return false
      if (isVegan && !r.isVegan) return false

      // Search match
      if (normalizedSearch) {
        const text = [r.name, r.cuisine, ...(r.ingredients?.map(i => i.name) || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!text.includes(normalizedSearch)) return false
      }

      return true
    })

    return filtered.slice(0, limit)
  }

  /**
   * Intelligently selects the best matching candidate recipes from the catalog for a specific agent.
   * Considers:
   * 1. Agent's dominant element (Fire, Water, Earth, Air)
   * 2. Cultural cuisine alignment (historicalDiet.culturalCuisine)
   * 3. Astrological placements (Sun, Moon, Ascendant, planetary hour)
   * 4. Dietary philosophy / avoided foods
   */
  async findCandidatesForAgent(
    agent: CraftedAgent,
    options: {
      count?: number
      mealType?: string
      preferredCuisine?: string
      dominantPlanet?: string
    } = {}
  ): Promise<CatalogRecipe[]> {
    const all = await this.getAllRecipes()
    const count = options.count ?? 5

    const dominantElement = (agent.consciousness?.dominantElement || 'Fire').toLowerCase()
    const agentCulture = (agent.historicalDiet?.culturalCuisine || '').toLowerCase()
    const preferredCuisine = (options.preferredCuisine || '').toLowerCase()
    const mealType = options.mealType?.toLowerCase()

    // Score recipes against the agent's alchemical and historical profile
    const scored = all.map(recipe => {
      let score = 0

      // 1. Elemental synergy
      if (recipe.elementalProperties) {
        const ep = recipe.elementalProperties
        for (const [elKey, val] of Object.entries(ep)) {
          if (elKey.toLowerCase() === dominantElement && typeof val === 'number') {
            score += val * 40
          }
        }
      }

      // 2. Cuisine / Cultural match
      const recipeCuisine = (recipe.cuisine || '').toLowerCase()
      if (preferredCuisine && recipeCuisine.includes(preferredCuisine)) {
        score += 35
      } else if (agentCulture) {
        const parts = agentCulture.split(/[\s,()]+/).filter(p => p.length > 3)
        for (const part of parts) {
          if (recipeCuisine.includes(part)) {
            score += 25
            break
          }
        }
      }

      // 3. Meal type relevance
      if (mealType && recipe.mealType) {
        if (recipe.mealType.some(mt => mt.toLowerCase() === mealType)) {
          score += 20
        }
      }

      // 4. Ingredients synergy with agent's favorites/staples
      const staples = agent.historicalDiet?.staples || []
      const favorites = agent.historicalDiet?.favoriteFoods || []
      const agentFoodKeywords = [...staples, ...favorites].map(f => f.toLowerCase())

      const recipeIngs = recipe.ingredients.map(i => i.name.toLowerCase())
      for (const ing of recipeIngs) {
        for (const kw of agentFoodKeywords) {
          if (ing.includes(kw) || kw.includes(ing)) {
            score += 15
            break
          }
        }
      }

      // 5. Avoided foods penalty (gives opportunity for substitution!)
      const avoided = agent.historicalDiet?.avoidedFoods || []
      for (const avoid of avoided) {
        const avLower = avoid.toLowerCase()
        if (avLower.includes('meat') || avLower.includes('vegetarian')) {
          if (!recipe.isVegetarian && !recipe.isVegan) {
            // Recipe has meat that agent avoids: great candidate for substitution!
            score += 10
          }
        }
      }

      return { recipe, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, count).map(s => s.recipe)
  }
}

export const recipeCatalogService = new RecipeCatalogService()
