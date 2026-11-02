'use client'

import { useEffect, useState } from 'react'
import type {
  SolarReturnCouncilEdition,
  SolarReturnCouncilResponse,
} from '@/lib/agents/council/solar-return-types'
import { SolarReturnCouncilResponseSchema } from '@/lib/agents/council/solar-return-edition-schema'

export interface SolarReturnCouncilState {
  edition: SolarReturnCouncilEdition | null
  status: 'published' | 'briefing' | 'stale' | 'unavailable'
  loading: boolean
  error: string | null
  message?: string
}

const INITIAL_STATE: SolarReturnCouncilState = {
  edition: null,
  status: 'unavailable',
  loading: true,
  error: null,
}

export interface UseSolarReturnCouncilOptions {
  date?: string
  yearsAgo?: number
}

export function useSolarReturnCouncil(optionsOrDate?: string | UseSolarReturnCouncilOptions): {
  state: SolarReturnCouncilState
  refresh: () => Promise<void>
} {
  const dateParam = typeof optionsOrDate === 'string' ? optionsOrDate : optionsOrDate?.date
  const yearsAgo =
    typeof optionsOrDate === 'object' && optionsOrDate?.yearsAgo
      ? Math.max(1, Math.min(100, Math.round(optionsOrDate.yearsAgo)))
      : 1

  const [state, setState] = useState<SolarReturnCouncilState>(INITIAL_STATE)

  const fetchEdition = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    try {
      const qs = new URLSearchParams()
      if (dateParam) qs.set('date', dateParam)
      if (yearsAgo > 1) qs.set('yearsAgo', String(yearsAgo))
      const query = qs.toString()
      const url = query
        ? `/api/agents/council-solar-return?${query}`
        : '/api/agents/council-solar-return'

      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok && response.status !== 503) {
        throw new Error(`Failed to load solar return council: HTTP ${response.status}`)
      }

      const json = await response.json()
      const parsed = SolarReturnCouncilResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new Error('Malformed solar return council payload')
      }

      setState({
        edition: parsed.data.edition,
        status: parsed.data.status,
        loading: false,
        error: null,
        message: parsed.data.message,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load solar return council'
      setState(prev => ({
        ...prev,
        loading: false,
        error: message,
      }))
    } finally {
      clearTimeout(timer)
    }
  }

  useEffect(() => {
    void fetchEdition()
  }, [dateParam, yearsAgo])

  return { state, refresh: fetchEdition }
}
