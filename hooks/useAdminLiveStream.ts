'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { OverviewPulseSchema, type OverviewPulsePayload } from '@/lib/admin/overview-pulse-schema'

export type StreamConnectionState =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'polling'
  | 'paused'
  | 'error'

const STREAM_URL = '/api/admin/stream'
const FALLBACK_POLL_URL = '/api/admin/overview-pulse'
const BASE_POLL_MS = 15_000
const MAX_POLL_MS = 60_000

/**
 * Visibility-aware SSE hook for `/admin` Overview.
 *
 * Connects to `/api/admin/stream`, honors server `reconnect` rotation frames,
 * pauses background streams when `document.hidden` is true, and falls back to
 * bounded exponential-backoff polling on `/api/admin/overview-pulse` after two
 * consecutive EventSource failures.
 */
export function useAdminLiveStream(initialData: OverviewPulsePayload | null = null) {
  const [data, setData] = useState<OverviewPulsePayload | null>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(
    initialData ? Date.parse(initialData.generatedAt) || Date.now() : null
  )
  const [connectionState, setConnectionState] = useState<StreamConnectionState>(
    initialData ? 'connecting' : 'connecting'
  )

  const esRef = useRef<EventSource | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const consecutiveErrorsRef = useRef(0)
  const pollBackoffMsRef = useRef(BASE_POLL_MS)
  const mountedRef = useRef(true)

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const closeStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const applyPulse = useCallback((raw: unknown): boolean => {
    const parsed = OverviewPulseSchema.safeParse(raw)
    if (!parsed.success) {
      setError('Unexpected overview-pulse payload shape')
      return false
    }
    setData(parsed.data)
    setError(null)
    setUpdatedAt(Date.now())
    consecutiveErrorsRef.current = 0
    pollBackoffMsRef.current = BASE_POLL_MS
    return true
  }, [])

  const fetchSnapshot = useCallback(
    async (fresh = false): Promise<boolean> => {
      try {
        const url = fresh ? `${FALLBACK_POLL_URL}?fresh=1` : FALLBACK_POLL_URL
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Overview pulse returned HTTP ${res.status}`)
        }
        const json: unknown = await res.json()
        if (!mountedRef.current) return false
        return applyPulse(json)
      } catch (err) {
        if (!mountedRef.current) return false
        setError(err instanceof Error ? err.message : 'Failed to refresh overview pulse')
        return false
      }
    },
    [applyPulse]
  )

  const scheduleFallbackPoll = useCallback(() => {
    clearTimers()
    if (!mountedRef.current) return
    if (typeof document !== 'undefined' && document.hidden) {
      setConnectionState('paused')
      return
    }
    setConnectionState('polling')
    const waitMs = pollBackoffMsRef.current
    pollTimerRef.current = setTimeout(async () => {
      const ok = await fetchSnapshot(false)
      if (!mountedRef.current) return
      if (ok) {
        pollBackoffMsRef.current = BASE_POLL_MS
      } else {
        pollBackoffMsRef.current = Math.min(MAX_POLL_MS, pollBackoffMsRef.current * 2)
        setConnectionState('error')
      }
      scheduleFallbackPoll()
    }, waitMs)
  }, [clearTimers, fetchSnapshot])

  const openStream = useCallback(() => {
    clearTimers()
    closeStream()
    if (!mountedRef.current) return
    if (typeof document !== 'undefined' && document.hidden) {
      setConnectionState('paused')
      return
    }

    if (typeof EventSource === 'undefined') {
      void fetchSnapshot(false)
      scheduleFallbackPoll()
      return
    }

    setConnectionState(prev => (prev === 'live' ? 'reconnecting' : 'connecting'))
    const es = new EventSource(STREAM_URL)
    esRef.current = es

    es.addEventListener('pulse', event => {
      if (!mountedRef.current) return
      try {
        const payload: unknown = JSON.parse((event as MessageEvent<string>).data)
        if (applyPulse(payload)) {
          setConnectionState('live')
        }
      } catch {
        setError('Malformed SSE pulse payload')
      }
    })

    es.addEventListener('stream-error', event => {
      if (!mountedRef.current) return
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { message?: string }
        setError(payload.message ?? 'Stream reported an error')
      } catch {
        setError('Stream reported an error')
      }
    })

    es.addEventListener('reconnect', () => {
      if (!mountedRef.current) return
      closeStream()
      setConnectionState('reconnecting')
      reconnectTimerRef.current = setTimeout(() => {
        openStream()
      }, 250)
    })

    es.onerror = () => {
      if (!mountedRef.current) return
      consecutiveErrorsRef.current += 1
      if (consecutiveErrorsRef.current >= 2) {
        closeStream()
        void fetchSnapshot(false)
        scheduleFallbackPoll()
      } else {
        setConnectionState('reconnecting')
      }
    }
  }, [applyPulse, clearTimers, closeStream, fetchSnapshot, scheduleFallbackPoll])

  const refreshNow = useCallback(async () => {
    const ok = await fetchSnapshot(true)
    if (ok && (!esRef.current || esRef.current.readyState === EventSource.CLOSED)) {
      if (typeof EventSource !== 'undefined') {
        openStream()
      }
    }
  }, [fetchSnapshot, openStream])

  useEffect(() => {
    mountedRef.current = true
    openStream()

    const handleVisibility = () => {
      if (!mountedRef.current) return
      if (document.hidden) {
        clearTimers()
        closeStream()
        setConnectionState('paused')
      } else {
        consecutiveErrorsRef.current = 0
        pollBackoffMsRef.current = BASE_POLL_MS
        openStream()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }

    return () => {
      mountedRef.current = false
      clearTimers()
      closeStream()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
    }
  }, [clearTimers, closeStream, openStream])

  return {
    data,
    error,
    updatedAt,
    connectionState,
    refreshNow,
  }
}
