import 'server-only'
import { prisma } from '@/lib/db'
import {
  SOLAR_RETURN_COUNCIL_VERSION,
  type SolarReturnCouncilEdition,
  type SolarReturnCouncilResponse,
} from './solar-return-types'
import { parseSolarReturnCouncilEdition } from './solar-return-edition-schema'
import { fetchSolarReturnSky } from './solar-return-sky'
import { createSolarReturnBriefingEdition } from './solar-return-episode'

const STORE_READ_BUDGET_MS = 2_000
const IN_MEMORY_CACHE_LIMIT = 8
const IN_MEMORY_CACHE_TTL_MS = 600_000 // 10 minutes

interface CacheEntry {
  edition: SolarReturnCouncilEdition
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry>()

export function solarReturnEditionKey(dateStr: string): string {
  return `${SOLAR_RETURN_COUNCIL_VERSION}:${dateStr}`
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Store read timeout')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function readFromStore(key: string): Promise<SolarReturnCouncilEdition | null> {
  try {
    const row = await withTimeout(
      prisma.council_daily_editions.findUnique({
        where: { id: key },
      }),
      STORE_READ_BUDGET_MS
    )
    if (!row || row.status !== 'published' || !row.payload) {
      return null
    }
    const edition = parseSolarReturnCouncilEdition(row.payload)
    if (!edition || edition.promptVersion !== SOLAR_RETURN_COUNCIL_VERSION) {
      return null
    }
    return edition
  } catch {
    return null
  }
}

async function saveToStore(key: string, edition: SolarReturnCouncilEdition): Promise<void> {
  try {
    const payload = JSON.parse(JSON.stringify(edition))
    await prisma.council_daily_editions.upsert({
      where: { id: key },
      create: {
        id: key,
        editionId: edition.id,
        day: edition.date,
        promptVersion: edition.promptVersion,
        status: 'published',
        payload,
        publishedAt: new Date(),
      },
      update: {
        payload,
        status: 'published',
        publishedAt: new Date(),
      },
    })
  } catch {
    // Non-fatal if DB is unreachable
  }
}

export function getCachedSolarReturnEdition(key: string): SolarReturnCouncilEdition | null {
  const cached = memoryCache.get(key)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(key)
    return null
  }
  return cached.edition
}

export function setCachedSolarReturnEdition(key: string, edition: SolarReturnCouncilEdition): void {
  if (memoryCache.size >= IN_MEMORY_CACHE_LIMIT) {
    const oldestKey = memoryCache.keys().next().value
    if (oldestKey) {
      memoryCache.delete(oldestKey)
    }
  }
  memoryCache.set(key, {
    edition,
    expiresAt: Date.now() + IN_MEMORY_CACHE_TTL_MS,
  })
}

/**
 * Loads or computes a Solar Return Historical Council edition.
 * Ensures a 2-second store budget before returning a deterministic fallback briefing.
 */
export async function getSolarReturnCouncilEdition(
  targetDate?: Date
): Promise<SolarReturnCouncilResponse> {
  const refDate = targetDate && !isNaN(targetDate.getTime()) ? targetDate : new Date()
  const dateStr = refDate.toISOString().slice(0, 10)
  const key = solarReturnEditionKey(dateStr)

  // 1. Check in-memory cache
  const memoryHit = getCachedSolarReturnEdition(key)
  if (memoryHit) {
    return {
      status: 'published',
      edition: memoryHit,
    }
  }

  // 2. Check database store within budget
  const storeHit = await readFromStore(key)
  if (storeHit) {
    setCachedSolarReturnEdition(key, storeHit)
    return {
      status: 'published',
      edition: storeHit,
    }
  }

  // 3. Compute deterministic fallback briefing
  try {
    const telemetry = await fetchSolarReturnSky(refDate)
    const edition = createSolarReturnBriefingEdition(telemetry, dateStr)

    setCachedSolarReturnEdition(key, edition)
    // Persist in background
    void saveToStore(key, edition)

    return {
      status: 'briefing',
      edition,
    }
  } catch (error) {
    return {
      status: 'unavailable',
      edition: null,
      message: 'Solar return ephemeris calculation currently unavailable.',
    }
  }
}
