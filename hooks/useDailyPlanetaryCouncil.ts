'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { DailyCouncilResponse } from '@/lib/agents/council/daily-council-types'
import { DailyCouncilResponseSchema } from '@/lib/agents/council/daily-edition-schema'

export interface DailyCouncilState extends DailyCouncilResponse {
  loading: boolean
  error: string | null
}

const INITIAL_STATE: DailyCouncilState = {
  edition: null,
  status: 'unavailable',
  loading: true,
  error: null,
}

const READ_INTERVAL_MS = 5 * 60 * 1000
const CACHE_WINDOW_MS = 60 * 1000

/** One read-only store serves both homepage views, including concurrent mounts. */
export function createDailyCouncilStore(fetcher: typeof fetch = (...args) => fetch(...args)) {
  let state = INITIAL_STATE
  let loadedAt = 0
  let inFlight: Promise<void> | null = null
  let polling: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<() => void>()

  const update = (next: DailyCouncilState) => {
    state = next
    listeners.forEach(listener => listener())
  }

  const read = (force = false): Promise<void> => {
    if (inFlight) return inFlight
    if (!force && loadedAt && Date.now() - loadedAt < CACHE_WINDOW_MS) {
      return Promise.resolve()
    }

    update({ ...state, loading: true, error: null })
    inFlight = Promise.resolve().then(async () => {
      try {
        const response = await fetcher('/api/agents/council-daily', {
          method: 'GET',
          cache: 'no-store',
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(
            payload.message || payload.error || 'The daily council could not be loaded.'
          )
        }
        const parsed = DailyCouncilResponseSchema.safeParse(payload)
        if (!parsed.success) {
          throw new Error('The daily council returned an unreadable edition. Please refresh.')
        }
        loadedAt = Date.now()
        update({ ...(parsed.data as DailyCouncilResponse), loading: false, error: null })
      } catch (error) {
        update({
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : 'The daily council could not be loaded.',
        })
      } finally {
        inFlight = null
      }
    })
    return inFlight
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => INITIAL_STATE,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      if (!polling) polling = setInterval(() => void read(true), READ_INTERVAL_MS)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && polling) {
          clearInterval(polling)
          polling = null
        }
      }
    },
    load: () => read(),
    refresh: () => read(true),
  }
}

export const dailyCouncilStore = createDailyCouncilStore()

export function useDailyPlanetaryCouncil() {
  const state = useSyncExternalStore(
    dailyCouncilStore.subscribe,
    dailyCouncilStore.getSnapshot,
    dailyCouncilStore.getServerSnapshot
  )

  useEffect(() => {
    void dailyCouncilStore.load()
  }, [])

  return { ...state, refresh: dailyCouncilStore.refresh }
}
