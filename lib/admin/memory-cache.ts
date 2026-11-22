import 'server-only'

/**
 * Per-instance TTL cache with single-flight in-flight deduplication for admin
 * telemetry reads. Prevents concurrent `/admin` tabs, SSE frames, and polling
 * fallbacks from piling simultaneous query storms onto Postgres.
 *
 * Disabled automatically under Vitest unless `bypassTestSkip` is requested.
 */

interface CacheEntry<T> {
  expiresAt: number
  value: T
}

const entries = new Map<string, CacheEntry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()

export function memoizeAdmin<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options: { fresh?: boolean; bypassTestSkip?: boolean } = {}
): Promise<T> {
  const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
  if (isTest && !options.bypassTestSkip) {
    return loader()
  }

  const now = Date.now()
  if (!options.fresh) {
    const hit = entries.get(key)
    if (hit && hit.expiresAt > now) {
      return Promise.resolve(hit.value as T)
    }
  }

  const pending = inFlight.get(key)
  if (pending && !options.fresh) {
    return pending as Promise<T>
  }

  const promise = loader()
    .then(value => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    })
    .finally(() => {
      if (inFlight.get(key) === promise) {
        inFlight.delete(key)
      }
    })

  inFlight.set(key, promise)
  return promise
}

/** Run async items with bounded concurrency while preserving input order. */
export async function withConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let cursor = 0

  async function runWorker(): Promise<void> {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) return
      results[idx] = await worker(items[idx]!, idx)
    }
  }

  const count = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: count }, () => runWorker()))
  return results
}

export function __clearAdminCache(): void {
  entries.clear()
  inFlight.clear()
}
