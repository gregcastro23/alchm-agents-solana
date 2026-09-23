'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { adminHref } from '@/lib/admin/nav'
import { DashboardReportSchema, LegacyEnvelopeSchema } from '@/lib/admin/page-schemas'
import { formatAgo, useValidatedPoll } from './primitives'

/** Alerts and subsystem links name a tab id; route them to the page that owns it. */
export function useAdminNavigate() {
  const router = useRouter()
  return useCallback((target: string) => router.push(adminHref(target)), [router])
}

/**
 * Adapts a validated poll to the props the older panels take
 * (`data | loading | error | onRetry`).
 */
export function useEnvelopePanel<T>(url: string, intervalMs = 120_000) {
  const { loaded, refresh } = useValidatedPoll(url, LegacyEnvelopeSchema, intervalMs)
  return {
    data: (loaded.state === 'ok' ? loaded.data : null) as T | null,
    loading: loaded.state === 'loading',
    error: loaded.state === 'error' ? loaded.reason : null,
    onRetry: refresh,
    generatedAt: loaded.state === 'ok' ? loaded.data.generatedAt : null,
  }
}

/** The shared sectioned read; see lib/admin/dashboard.ts. */
export function useDashboard() {
  const poll = useValidatedPoll('/api/admin/dashboard', DashboardReportSchema, 60_000)
  const { loaded } = poll
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return { ...poll, data }
}

export function readAt(generatedAt: string | null | undefined) {
  return generatedAt ? `Read ${formatAgo(generatedAt)}` : undefined
}
