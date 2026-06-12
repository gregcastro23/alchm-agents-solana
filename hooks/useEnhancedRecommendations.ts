/**
 * useEnhancedRecommendations Hook
 * Complete recommendation system with rune/agent influence and backend integration
 */

import { useState, useCallback, useEffect } from 'react'
import {
  EnhancedRecommendationService,
  RecommendationRequest,
  EnhancedRecommendationResult,
  CuisineRecommendation,
  IngredientRecommendation,
  RecipeRecommendation,
} from '@/lib/services/enhanced-recommendation-service'

interface UseEnhancedRecommendationsOptions {
  autoGenerate?: boolean
  defaultLocation?: { latitude: number; longitude: number }
  refreshInterval?: number // in milliseconds
  filterOptions?: {
    minCuisineScore?: number
    minIngredientScore?: number
    minRecipeScore?: number
    maxRecommendations?: {
      cuisines?: number
      ingredients?: number
      recipes?: number
    }
  }
}

interface UseEnhancedRecommendationsReturn {
  // Individual recommendation types
  cuisines: CuisineRecommendation[]
  ingredients: IngredientRecommendation[]
  recipes: RecipeRecommendation[]

  // Context and metadata
  context: EnhancedRecommendationResult['context'] | null
  metadata: EnhancedRecommendationResult['metadata'] | null

  // State management
  loading: boolean
  error: string | null

  // Actions
  getAllRecommendations: (request?: Partial<RecommendationRequest>) => Promise<void>
  getCuisineRecommendations: (
    request?: Partial<RecommendationRequest>
  ) => Promise<CuisineRecommendation[]>
  getIngredientRecommendations: (
    request?: Partial<RecommendationRequest>
  ) => Promise<IngredientRecommendation[]>
  getRecipeRecommendations: (
    request?: Partial<RecommendationRequest>
  ) => Promise<RecipeRecommendation[]>
  refresh: () => Promise<void>

  // Filtering and sorting
  filterByScore: (minScore: number, type?: 'cuisines' | 'ingredients' | 'recipes') => void
  sortBy: (
    criteria: 'score' | 'name' | 'seasonal',
    type?: 'cuisines' | 'ingredients' | 'recipes'
  ) => void

  // Analytics
  getRecommendationStats: () => {
    totalRecommendations: number
    averageScore: number
    sourceBreakdown: { backend: number; local: number }
    confidenceLevel: 'high' | 'medium' | 'low'
  }
}

export function useEnhancedRecommendations(
  options: UseEnhancedRecommendationsOptions = {}
): UseEnhancedRecommendationsReturn {
  const {
    autoGenerate = false,
    defaultLocation = { latitude: 37.7749, longitude: -122.4194 },
    refreshInterval,
    filterOptions = {},
  } = options

  // State
  const [cuisines, setCuisines] = useState<CuisineRecommendation[]>([])
  const [ingredients, setIngredients] = useState<IngredientRecommendation[]>([])
  const [recipes, setRecipes] = useState<RecipeRecommendation[]>([])
  const [context, setContext] = useState<EnhancedRecommendationResult['context'] | null>(null)
  const [metadata, setMetadata] = useState<EnhancedRecommendationResult['metadata'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRequest, setLastRequest] = useState<RecommendationRequest | null>(null)

  // Core recommendation generation
  const getAllRecommendations = useCallback(
    async (partialRequest?: Partial<RecommendationRequest>) => {
      setLoading(true)
      setError(null)

      try {
        const request: RecommendationRequest = {
          datetime: new Date(),
          location: defaultLocation,
          preferences: {
            intensity: 'moderate',
          },
          ...partialRequest,
        }

        setLastRequest(request)

        const result = await EnhancedRecommendationService.generateRecommendations(request)

        // Apply filters if specified
        let filteredCuisines = result.cuisines
        let filteredIngredients = result.ingredients
        let filteredRecipes = result.recipes

        if (filterOptions.minCuisineScore) {
          filteredCuisines = filteredCuisines.filter(c => c.score >= filterOptions.minCuisineScore!)
        }
        if (filterOptions.minIngredientScore) {
          filteredIngredients = filteredIngredients.filter(
            i => i.score >= filterOptions.minIngredientScore!
          )
        }
        if (filterOptions.minRecipeScore) {
          filteredRecipes = filteredRecipes.filter(r => r.score >= filterOptions.minRecipeScore!)
        }

        // Apply max recommendations limit
        if (filterOptions.maxRecommendations?.cuisines) {
          filteredCuisines = filteredCuisines.slice(0, filterOptions.maxRecommendations.cuisines)
        }
        if (filterOptions.maxRecommendations?.ingredients) {
          filteredIngredients = filteredIngredients.slice(
            0,
            filterOptions.maxRecommendations.ingredients
          )
        }
        if (filterOptions.maxRecommendations?.recipes) {
          filteredRecipes = filteredRecipes.slice(0, filterOptions.maxRecommendations.recipes)
        }

        setCuisines(filteredCuisines)
        setIngredients(filteredIngredients)
        setRecipes(filteredRecipes)
        setContext(result.context)
        setMetadata(result.metadata)

        console.log(
          `Enhanced recommendations generated: ${filteredCuisines.length} cuisines, ${filteredIngredients.length} ingredients, ${filteredRecipes.length} recipes (${result.metadata.generationTime}ms)`
        )
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Recommendation generation failed'
        setError(errorMessage)
        console.error('Enhanced recommendations error:', err)
      } finally {
        setLoading(false)
      }
    },
    [defaultLocation, filterOptions]
  )

  // Individual recommendation type generators
  const getCuisineRecommendations = useCallback(
    async (partialRequest?: Partial<RecommendationRequest>): Promise<CuisineRecommendation[]> => {
      const request: RecommendationRequest = {
        datetime: new Date(),
        location: defaultLocation,
        ...partialRequest,
      }

      try {
        const result = await EnhancedRecommendationService.generateRecommendations(request)
        return result.cuisines
      } catch (error) {
        console.error('Cuisine recommendations failed:', error)
        return []
      }
    },
    [defaultLocation]
  )

  const getIngredientRecommendations = useCallback(
    async (
      partialRequest?: Partial<RecommendationRequest>
    ): Promise<IngredientRecommendation[]> => {
      const request: RecommendationRequest = {
        datetime: new Date(),
        location: defaultLocation,
        ...partialRequest,
      }

      try {
        const result = await EnhancedRecommendationService.generateRecommendations(request)
        return result.ingredients
      } catch (error) {
        console.error('Ingredient recommendations failed:', error)
        return []
      }
    },
    [defaultLocation]
  )

  const getRecipeRecommendations = useCallback(
    async (partialRequest?: Partial<RecommendationRequest>): Promise<RecipeRecommendation[]> => {
      const request: RecommendationRequest = {
        datetime: new Date(),
        location: defaultLocation,
        ...partialRequest,
      }

      try {
        const result = await EnhancedRecommendationService.generateRecommendations(request)
        return result.recipes
      } catch (error) {
        console.error('Recipe recommendations failed:', error)
        return []
      }
    },
    [defaultLocation]
  )

  // Refresh with last request
  const refresh = useCallback(async () => {
    if (lastRequest) {
      await getAllRecommendations(lastRequest)
    } else {
      await getAllRecommendations()
    }
  }, [lastRequest, getAllRecommendations])

  // Filtering and sorting utilities
  const filterByScore = useCallback(
    (minScore: number, type?: 'cuisines' | 'ingredients' | 'recipes') => {
      if (!type || type === 'cuisines') {
        setCuisines(prev => prev.filter(c => c.score >= minScore))
      }
      if (!type || type === 'ingredients') {
        setIngredients(prev => prev.filter(i => i.score >= minScore))
      }
      if (!type || type === 'recipes') {
        setRecipes(prev => prev.filter(r => r.score >= minScore))
      }
    },
    []
  )

  const sortBy = useCallback(
    (criteria: 'score' | 'name' | 'seasonal', type?: 'cuisines' | 'ingredients' | 'recipes') => {
      const getSortValue = (item: any) => {
        switch (criteria) {
          case 'score':
            return item.score
          case 'name':
            return item.name
          case 'seasonal':
            return item.seasonalRelevance || 0
          default:
            return item.score
        }
      }

      const sortFunction = (a: any, b: any) => {
        if (criteria === 'name') {
          return getSortValue(a).localeCompare(getSortValue(b))
        }
        return getSortValue(b) - getSortValue(a) // Descending for numbers
      }

      if (!type || type === 'cuisines') {
        setCuisines(prev => [...prev].sort(sortFunction))
      }
      if (!type || type === 'ingredients') {
        setIngredients(prev => [...prev].sort(sortFunction))
      }
      if (!type || type === 'recipes') {
        setRecipes(prev => [...prev].sort(sortFunction))
      }
    },
    []
  )

  // Analytics helper
  const getRecommendationStats = useCallback(() => {
    const totalRecommendations = cuisines.length + ingredients.length + recipes.length
    const allScores = [
      ...cuisines.map(c => c.score),
      ...ingredients.map(i => i.score),
      ...recipes.map(r => r.score),
    ]
    const averageScore =
      allScores.length > 0 ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 0

    // Determine source breakdown from context
    const backendSources = [
      context?.tokens.metadata.source === 'backend' ? 1 : 0,
      context?.rune && (metadata as any)?.source?.includes('backend') ? 1 : 0,
    ].reduce((sum, val) => sum + val, 0)

    const sourceBreakdown = {
      backend: Math.round((backendSources / 2) * 100),
      local: Math.round(((2 - backendSources) / 2) * 100),
    }

    const confidenceLevel: 'high' | 'medium' | 'low' =
      (metadata?.confidenceScore || 0) > 80
        ? 'high'
        : (metadata?.confidenceScore || 0) > 60
          ? 'medium'
          : 'low'

    return {
      totalRecommendations,
      averageScore,
      sourceBreakdown,
      confidenceLevel,
    }
  }, [cuisines, ingredients, recipes, context, metadata])

  // Auto-generate on mount
  useEffect(() => {
    if (autoGenerate) {
      getAllRecommendations()
    }
  }, [autoGenerate, getAllRecommendations])

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        refresh()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
    return undefined
  }, [refreshInterval, refresh])

  return {
    // Data
    cuisines,
    ingredients,
    recipes,
    context,
    metadata,

    // State
    loading,
    error,

    // Actions
    getAllRecommendations,
    getCuisineRecommendations,
    getIngredientRecommendations,
    getRecipeRecommendations,
    refresh,

    // Utilities
    filterByScore,
    sortBy,
    getRecommendationStats,
  }
}

// Convenience hook for specific use cases
export function useQuickCuisineRecommendations(preferences?: RecommendationRequest['preferences']) {
  return useEnhancedRecommendations({
    autoGenerate: true,
    filterOptions: {
      minCuisineScore: 0.5,
      maxRecommendations: {
        cuisines: 3,
        ingredients: 0,
        recipes: 0,
      },
    },
  })
}

export function useCompleteRecommendations(preferences?: RecommendationRequest['preferences']) {
  return useEnhancedRecommendations({
    autoGenerate: true,
    filterOptions: {
      minCuisineScore: 0.4,
      minIngredientScore: 0.5,
      minRecipeScore: 0.6,
      maxRecommendations: {
        cuisines: 6,
        ingredients: 12,
        recipes: 8,
      },
    },
  })
}
