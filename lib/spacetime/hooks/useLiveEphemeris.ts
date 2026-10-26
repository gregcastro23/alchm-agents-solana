'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AlchemicalQuantities } from '@/hooks/usePlanetaryPositions'
import { useSpacetime } from '@/lib/spacetime/SpacetimeContext'
import { tables } from '@/lib/spacetime/generated'
import type { Ephemeris } from '@/lib/spacetime/generated/types'
import { deriveLiveEphemeris } from '@/lib/spacetime/derive-live-ephemeris'

// The derivation lives in a server-safe module; re-exported so existing imports keep working.
export {
  deriveLiveEphemeris,
  raDecToEclipticLongitude,
} from '@/lib/spacetime/derive-live-ephemeris'

interface UseLiveEphemerisOptions {
  enabled?: boolean
}

const EMPTY_ALCHEMICAL_QUANTITIES: AlchemicalQuantities = {
  spirit: 0,
  essence: 0,
  matter: 0,
  substance: 0,
  Heat: 0,
  Entropy: 0,
  Reactivity: 0,
  Energy: 0,
}

export function useLiveEphemeris({ enabled = true }: UseLiveEphemerisOptions = {}) {
  const { connection, status } = useSpacetime()
  const [rows, setRows] = useState<Ephemeris[]>([])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !connection) {
      setRows([])
      setIsReady(!enabled)
      setError(null)
      return
    }

    const table = connection.db.ephemeris
    let disposed = false
    const syncRows = () => {
      if (disposed) return
      setRows(Array.from(table.iter()))
      setIsReady(true)
      setError(null)
    }
    const onChange = () => syncRows()

    setRows(Array.from(table.iter()))
    setIsReady(false)
    table.onInsert(onChange)
    table.onUpdate(onChange)
    table.onDelete(onChange)

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(syncRows)
      .onError(() => {
        if (disposed) return
        setIsReady(true)
        setError('Live ephemeris subscription failed')
      })
      .subscribe(tables.ephemeris)

    return () => {
      disposed = true
      table.removeOnInsert(onChange)
      table.removeOnUpdate(onChange)
      table.removeOnDelete(onChange)
      if (!subscription.isEnded()) subscription.unsubscribe()
    }
  }, [connection, enabled])

  const derived = useMemo(() => (rows.length > 0 ? deriveLiveEphemeris(rows) : null), [rows])
  const lastUpdated = useMemo(() => {
    if (rows.length === 0) return null
    return rows.reduce<Date | null>((latest, row) => {
      const tick = row.tick.toDate()
      return !latest || tick > latest ? tick : latest
    }, null)
  }, [rows])

  return {
    timestamp: lastUpdated?.toISOString() ?? new Date(0).toISOString(),
    planetaryPositions: derived?.planetaryPositions ?? [],
    alchmQuantities: derived?.alchmQuantities ?? EMPTY_ALCHEMICAL_QUANTITIES,
    monicaConstant: derived?.monicaConstant ?? null,
    loading: enabled && status !== 'disabled' && !isReady,
    error,
    lastUpdated,
    status,
  }
}

export default useLiveEphemeris
