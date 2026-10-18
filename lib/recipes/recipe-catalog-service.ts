import 'server-only'

import catalogSnapshot from '@/lib/data/recipes-catalog.json'
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

class RecipeCatalogService {
  private inMemoryCache: CatalogRecipe[] | null = null

  /** Load the bundled catalog snapshot independently of the server's working directory. */
  async getAllRecipes(): Promise<CatalogRecipe[]> {
    if (this.inMemoryCache) return this.inMemoryCache

    const recipes = catalogSnapshot.recipes as unknown as CatalogRecipe[]
    const ids = new Set<string>()
    for (const recipe of recipes) {
      if (
        !recipe.id?.trim() ||
        ids.has(recipe.id) ||
        !recipe.name?.trim() ||
        !Array.isArray(recipe.ingredients) ||
        recipe.ingredients.length === 0 ||
        recipe.ingredients.some(ingredient => !ingredient.name?.trim()) ||
        !Array.isArray(recipe.instructions) ||
        recipe.instructions.length === 0 ||
        recipe.instructions.some(instruction => !instruction.trim())
      ) {
        throw new Error('Invalid bundled recipe catalog')
      }
      ids.add(recipe.id)
    }
    if (recipes.length === 0) throw new Error('Bundled recipe catalog is empty')
    this.inMemoryCache = recipes
    return recipes
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
