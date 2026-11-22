/**
 * Pure, browser-safe classification for WTEN debit-path liveness.
 *
 * Flags INCIDENT when agent feed traffic is active (`feed` delivery attempts > 0)
 * in the inspection window while ZERO `economy/sync-debit` calls landed (2xx/409).
 */

export type DebitPathVerdict = 'OK' | 'IDLE' | 'INCIDENT' | 'UNKNOWN'

export interface DebitEndpointShape {
  endpoint: string
  attempts: number
  split: {
    ok2xx: number
    alreadyApplied409: number
  }
  lastError: { message: string } | null
}

export interface DebitSourceStatusShape {
  status: string
  reason?: string
}

export interface DebitPathSummary {
  verdict: DebitPathVerdict
  summary: string
  feedAttempts: number
  debitAttempts: number
  debitsLanded: number
  lastDebitError: string | null
}

export function classifyDebitPathFromDeliveries(
  deliveries: DebitSourceStatusShape,
  endpoints: DebitEndpointShape[] | null
): DebitPathSummary {
  if (deliveries.status !== 'live' || endpoints === null) {
    return {
      verdict: 'UNKNOWN',
      summary: `Delivery log ${deliveries.status.replace('_', ' ')}: ${deliveries.reason ?? 'unavailable'}`,
      feedAttempts: 0,
      debitAttempts: 0,
      debitsLanded: 0,
      lastDebitError: null,
    }
  }

  const feed = endpoints.find(e => e.endpoint === 'feed')
  const debit = endpoints.find(e => e.endpoint === 'economy/sync-debit')
  const feedAttempts = feed?.attempts ?? 0
  const debitAttempts = debit?.attempts ?? 0
  const debitsLanded = debit ? debit.split.ok2xx + debit.split.alreadyApplied409 : 0
  const lastDebitError = debit?.lastError?.message ?? null

  if (feedAttempts === 0 && debitAttempts === 0) {
    return {
      verdict: 'IDLE',
      summary: 'No agent feed or sync-debit deliveries in window.',
      feedAttempts,
      debitAttempts,
      debitsLanded,
      lastDebitError,
    }
  }

  if (feedAttempts > 0 && debitsLanded === 0) {
    return {
      verdict: 'INCIDENT',
      summary:
        `${feedAttempts} feed delivery attempt(s) in window but ZERO sync-debit calls landed ` +
        `(${debitAttempts} debit attempt(s)) — check agents/tick & DB connectivity.`,
      feedAttempts,
      debitAttempts,
      debitsLanded,
      lastDebitError,
    }
  }

  return {
    verdict: 'OK',
    summary: `${debitsLanded} debit(s) landed · ${feedAttempts} feed attempt(s)`,
    feedAttempts,
    debitAttempts,
    debitsLanded,
    lastDebitError,
  }
}
