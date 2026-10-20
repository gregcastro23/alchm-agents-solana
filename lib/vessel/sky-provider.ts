/** Labelled local approximation for previews. Verified sky can be supplied by the Swiss adapter. */
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import { normalizeSkyPositions } from '@/lib/agents/council/sky-snapshot'
import type { VesselProgressionInput } from './progression'

export type CurrentSkySnapshot = NonNullable<VesselProgressionInput['sky']>
let cachedSnapshot: CurrentSkySnapshot | null = null
let cacheTimestamp = 0
const SKY_CACHE_TTL_MS = 30_000

export function getCurrentSkySnapshot(now = Date.now()): CurrentSkySnapshot {
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime()))
    throw new RangeError('Invalid sky time')
  if (cachedSnapshot && now >= cacheTimestamp && now - cacheTimestamp < SKY_CACHE_TTL_MS) {
    // Keep the observation timestamp; reading the cache is not a new calculation.
    return structuredClone(cachedSnapshot)
  }
  const date = new Date(now)
  const current = normalizeSkyPositions(
    getCurrentPlanetaryPositions(date, { requireComplete: true })
  )
  cachedSnapshot = {
    asOf: date.toISOString(),
    source: 'vsop87-approximation',
    positions: Object.fromEntries(
      Object.entries(current).map(([planet, position]) => [
        planet,
        { longitude: position.longitude },
      ])
    ),
  }
  cacheTimestamp = now
  return structuredClone(cachedSnapshot)
}

export function clearSkySnapshotCache(): void {
  cachedSnapshot = null
  cacheTimestamp = 0
}
