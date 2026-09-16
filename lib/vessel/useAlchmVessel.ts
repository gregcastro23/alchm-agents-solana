'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { AlchmVesselState } from './contract'

export type VesselSyncState = 'idle' | 'loading' | 'live' | 'reconnecting' | 'signed-out' | 'error'

const CACHE_PREFIX = 'alchm:vessel:agents:v1:'
const REFRESH_MS = 30_000

// Snapshots are keyed per signed-in user so a shared browser never shows one
// person's treasury to another; storage failures just disable the fallback.
function readCache(userKey: string | null): AlchmVesselState | null {
  if (!userKey) return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userKey)
    return raw ? (JSON.parse(raw) as AlchmVesselState) : null
  } catch {
    return null
  }
}

function writeCache(userKey: string | null, value: AlchmVesselState | null) {
  if (!userKey) return
  try {
    if (value) localStorage.setItem(CACHE_PREFIX + userKey, JSON.stringify(value))
    else localStorage.removeItem(CACHE_PREFIX + userKey)
  } catch {
    // private mode / blocked storage
  }
}

/**
 * Live Alchm Vessel for the signed-in user. On a failed refresh the last good
 * snapshot is kept and `sync` becomes 'reconnecting' — values are never
 * estimated to fill the gap.
 */
export function useAlchmVessel({ enabled = true }: { enabled?: boolean } = {}) {
  const { data: session, status } = useSession()
  const userKey = session?.user?.id || session?.user?.email || null
  const [vessel, setVessel] = useState<AlchmVesselState | null>(null)
  const [sync, setSync] = useState<VesselSyncState>('idle')
  const vesselRef = useRef<AlchmVesselState | null>(null)

  const refresh = useCallback(async () => {
    setSync(current => (current === 'idle' ? 'loading' : current))
    try {
      const res = await fetch('/api/vessel/summary', { credentials: 'include', cache: 'no-store' })
      if (res.status === 401) {
        writeCache(userKey, null)
        vesselRef.current = null
        setVessel(null)
        setSync('signed-out')
        return
      }
      const body = await res.json()
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      vesselRef.current = body.vessel as AlchmVesselState
      setVessel(vesselRef.current)
      writeCache(userKey, vesselRef.current)
      setSync('live')
    } catch {
      const fallback = vesselRef.current ?? readCache(userKey)
      vesselRef.current = fallback
      setVessel(fallback)
      setSync(fallback ? 'reconnecting' : 'error')
    }
  }, [userKey])

  useEffect(() => {
    if (!enabled || status !== 'authenticated') {
      if (status === 'unauthenticated') setSync('signed-out')
      return
    }
    const cached = readCache(userKey)
    vesselRef.current = cached
    setVessel(cached)
    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(interval)
  }, [enabled, status, userKey, refresh])

  return { vessel, sync, refresh }
}
