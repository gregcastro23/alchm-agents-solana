'use server'

import {
  backend,
  getAlchemicalQuantitiesLegacy,
  getLegacyPlanetaryPositions,
  type LegacyPlanetaryPosition,
} from '@/lib/backend'

/**
 * Server Action for planetary positions - replaces /api/astrologize proxy
 */
export async function getPlanetaryPositionsAction(
  date?: string,
  latitude?: number,
  longitude?: number
) {
  try {
    const d = date ? new Date(date) : new Date()
    return await backend.planetary.positions(d, latitude, longitude)
  } catch (error: any) {
    console.warn('[Action] getPlanetaryPositionsAction:', error?.message || 'Backend unavailable')
    return { error: error.message || 'Failed to fetch planetary positions' }
  }
}

/**
 * Server Action for bulk positions - replaces /api/astrologize/bulk proxy
 */
export async function getBulkPositionsAction(
  startDate: string,
  endDate: string,
  intervalHours: number,
  latitude?: number,
  longitude?: number
) {
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return await backend.planetary.bulk(start, end, intervalHours, latitude, longitude)
  } catch (error: any) {
    console.warn('[Action] getBulkPositionsAction:', error?.message || 'Backend unavailable')
    return { error: error.message || 'Failed to fetch bulk planetary positions' }
  }
}

/**
 * Server Action returning planetary positions in the legacy flat-array shape
 * that older client components expect. Replaces direct fetches to a (broken)
 * /api/planetary-positions endpoint with a typed Server Action.
 */
export async function getLegacyPlanetaryPositionsAction(
  date?: string,
  latitude?: number,
  longitude?: number
): Promise<{ planetaryPositions: LegacyPlanetaryPosition[] } | { error: string }> {
  try {
    const d = date ? new Date(date) : new Date()
    const planetaryPositions = await getLegacyPlanetaryPositions(d, latitude, longitude)
    return { planetaryPositions }
  } catch (error: any) {
    console.warn(
      '[Action] getLegacyPlanetaryPositionsAction:',
      error?.message || 'Backend unavailable'
    )
    return { error: error.message || 'Failed to fetch planetary positions' }
  }
}

/**
 * Server Action for alchemical quantities - replaces /api/alchemize proxy
 */
export async function getAlchemicalQuantitiesAction(
  legacy: boolean = false,
  date?: string,
  latitude?: number,
  longitude?: number
) {
  try {
    const d = date ? new Date(date) : new Date()
    if (legacy) {
      return await getAlchemicalQuantitiesLegacy(d, latitude, longitude)
    }
    return await backend.alchemy.alchemize(d, latitude, longitude)
  } catch (error: any) {
    console.warn('[Action] getAlchemicalQuantitiesAction:', error?.message || 'Backend unavailable')
    return { error: error.message || 'Failed to fetch alchemical quantities' }
  }
}
