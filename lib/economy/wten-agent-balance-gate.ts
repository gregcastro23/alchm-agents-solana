/**
 * WTEN Authoritative Balance Snapshot & Post-402 Cooldown Gate
 * ============================================================
 *
 * Bridges the two-ledger gap between ASOL's local Prisma `token_balances` and
 * WTEN (`alchm.kitchen`), which is the canonical ESMS source of truth.
 *
 * Core invariants:
 *  1. WTEN `balances` returned on `sync-debit` (200 / 402), `sync-credit` (200),
 *     or bounded `GET /api/economy/balance?email=...` probes supersede stale
 *     local Prisma balances for agent activation pre-checks and action sizing.
 *  2. Underfunded `402` refusals (`reason === 'insufficient_funds'` without a
 *     transient auto-swap fault) pause the agent until EITHER:
 *       (a) ASOL observes a subsequent credit for that agent (`syncCreditToAlchm`,
 *           daily yield, planetary yield, `creditTokens`, or transit attunement), OR
 *       (b) the bounded cooldown expires — aligned to WTEN's `00:30Z`
 *           `agents-daily-yield` window (and capped at `DEFAULT_402_COOLDOWN_TTL_MS`)
 *           so external WTEN-originated credits are promptly picked up.
 *  3. Non-underfunding `402` reasons (e.g. `rates_unavailable`) and transient
 *     `5xx`/timeout/network errors NEVER mark an agent as underfunded.
 */

import { loadAlchmSyncConfig } from '@/lib/alchmSyncConfig'
import { pastBudget } from '@/lib/cron/registry'
import type { TokenBalances } from '@/lib/services/economyService'

export interface WtenBalancesSnapshot {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export interface WtenAutoSwapDetails {
  reason?: string
  shortfallValue?: number
  deficits?: Record<string, number>
  [key: string]: unknown
}

export interface WtenAgentGateState {
  /** Existing `agent_action_events.id` used to persist refreshed probe timestamps without adding rows. */
  eventId?: string
  balances: WtenBalancesSnapshot | null
  observedAtMs: number
  pausedBy402: boolean
  pauseUntilMs: number | null
  lastReason?: string
  autoSwap?: WtenAutoSwapDetails | null
  seq: number
}

export interface WtenCreditSignal {
  atMs: number
  seq: number
  balances: WtenBalancesSnapshot | null
}

/** WTEN's `agents-daily-yield` cron fires daily at 00:30 UTC. */
export const WTEN_DAILY_YIELD_HOUR_UTC = 0
export const WTEN_DAILY_YIELD_MINUTE_UTC = 30

/**
 * Maximum cooldown duration before an underfunded snapshot is re-evaluated,
 * even when the next 00:30Z WTEN daily yield is > 6h away (catches mid-day
 * external WTEN credits within a bounded window).
 */
export const DEFAULT_402_COOLDOWN_TTL_MS = 6 * 60 * 60 * 1000

/**
 * Hard cap on `GET /api/economy/balance` probes per hourly tick so an expired
 * cohort can never turn into an unbounded N+1 HTTP fan-out under cron deadlines.
 */
export const MAX_WTEN_BALANCE_PROBES_PER_TICK = 15

export const WTEN_BALANCE_PROBE_TIMEOUT_MS = 3_500

const TRANSIENT_AUTOSWAP_REASONS = new Set(['rates_unavailable', 'lost_race'])

let monotonicGateSeq = 0
const creditSignalsByEmail = new Map<string, WtenCreditSignal>()
const creditSignalsByUserId = new Map<string, WtenCreditSignal>()

export function nextWtenGateSeq(): number {
  monotonicGateSeq += 1
  return monotonicGateSeq
}

export function normalizeAgentEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Parse a WTEN `{ spirit, essence, matter, substance }` object into finite
 * non-negative numbers, returning `null` if absent or malformed.
 */
export function normalizeWtenBalances(raw: unknown): WtenBalancesSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>
  const spirit = Number(candidate.spirit)
  const essence = Number(candidate.essence)
  const matter = Number(candidate.matter)
  const substance = Number(candidate.substance)
  if (
    !Number.isFinite(spirit) ||
    !Number.isFinite(essence) ||
    !Number.isFinite(matter) ||
    !Number.isFinite(substance) ||
    spirit < 0 ||
    essence < 0 ||
    matter < 0 ||
    substance < 0
  ) {
    return null
  }
  return { spirit, essence, matter, substance }
}

export function wtenSnapshotToTokenBalances(snapshot: WtenBalancesSnapshot): TokenBalances {
  return {
    spirit: snapshot.spirit,
    essence: snapshot.essence,
    matter: snapshot.matter,
    substance: snapshot.substance,
    lastDailyClaimAt: null,
    lastDailyClaimAgentsAt: null,
  }
}

/**
 * Next 00:30:00.000Z boundary strictly after `fromMs`.
 *
 * If `fromMs` is 00:28Z on day D (just before WTEN's 00:30Z yield), this returns
 * 00:30Z on day D — so the 01:28Z tick immediately picks up day D's yield.
 * If `fromMs` is >= 00:30Z on day D, this returns 00:30Z on day D+1.
 */
export function nextWtenDailyYieldBoundaryMs(fromMs: number): number {
  const dt = new Date(fromMs)
  const year = dt.getUTCFullYear()
  const month = dt.getUTCMonth()
  const day = dt.getUTCDate()
  const todayBoundary = Date.UTC(
    year,
    month,
    day,
    WTEN_DAILY_YIELD_HOUR_UTC,
    WTEN_DAILY_YIELD_MINUTE_UTC,
    0,
    0
  )
  if (fromMs < todayBoundary) {
    return todayBoundary
  }
  return Date.UTC(
    year,
    month,
    day + 1,
    WTEN_DAILY_YIELD_HOUR_UTC,
    WTEN_DAILY_YIELD_MINUTE_UTC,
    0,
    0
  )
}

/**
 * Compute when an underfunded pause or WTEN balance snapshot expires:
 * whichever comes first between the next 00:30Z WTEN daily yield and `ttlMs`.
 */
export function computeWtenPauseUntilMs(
  observedAtMs: number,
  ttlMs: number = DEFAULT_402_COOLDOWN_TTL_MS
): number {
  return Math.min(nextWtenDailyYieldBoundaryMs(observedAtMs), observedAtMs + ttlMs)
}

export function isWtenSnapshotExpired(
  state: Pick<WtenAgentGateState, 'observedAtMs' | 'pauseUntilMs'>,
  nowMs: number,
  ttlMs: number = DEFAULT_402_COOLDOWN_TTL_MS
): boolean {
  const expiryMs = state.pauseUntilMs ?? computeWtenPauseUntilMs(state.observedAtMs, ttlMs)
  return nowMs >= expiryMs
}

/**
 * True ONLY when a failed `sync-debit` response represents genuine underfunding
 * (`reason === 'insufficient_funds'` and not a transient rate/race condition).
 */
export function isUnderfundedDebitRefusal(result: {
  ok: boolean
  reason?: string
  autoSwap?: WtenAutoSwapDetails | null
}): boolean {
  if (result.ok) return false
  if (result.reason !== 'insufficient_funds') return false
  const swapReason = result.autoSwap?.reason
  if (swapReason && TRANSIENT_AUTOSWAP_REASONS.has(swapReason)) {
    return false
  }
  return true
}

/**
 * Record an ASOL-observed credit for an agent so any in-process 402 pause or
 * pre-credit WTEN snapshot is immediately invalidated on the next evaluation.
 */
export function recordWtenCreditSignal(params: {
  userEmail?: string | null
  userId?: string | null
  balances?: unknown
  nowMs?: number
}): void {
  const atMs = params.nowMs ?? Date.now()
  const signal: WtenCreditSignal = {
    atMs,
    seq: nextWtenGateSeq(),
    balances: normalizeWtenBalances(params.balances),
  }
  const emailKey = normalizeAgentEmail(params.userEmail)
  if (emailKey) {
    creditSignalsByEmail.set(emailKey, signal)
  }
  const userId = params.userId?.trim()
  if (userId) {
    creditSignalsByUserId.set(userId, signal)
  }
}

export function getLatestWtenCreditSignal(params: {
  userEmail?: string | null
  userId?: string | null
}): WtenCreditSignal | null {
  const byEmail = params.userEmail
    ? creditSignalsByEmail.get(normalizeAgentEmail(params.userEmail))
    : undefined
  const byId = params.userId ? creditSignalsByUserId.get(params.userId.trim()) : undefined
  if (byEmail && byId) {
    return byEmail.seq >= byId.seq ? byEmail : byId
  }
  return byEmail ?? byId ?? null
}

/** Test helper: clear module-level credit signals. */
export function __resetWtenCreditSignalsForTests(): void {
  creditSignalsByEmail.clear()
  creditSignalsByUserId.clear()
}

export type WtenBalanceProbeResult =
  | { status: 'ok'; balances: WtenBalancesSnapshot }
  | { status: 'no_balance'; balances: WtenBalancesSnapshot }
  | { status: 'skipped' }
  | { status: 'unavailable' }

/**
 * Bounded read-only probe against WTEN's `GET /api/economy/balance?email=...`.
 *
 * Used only when a paused/cached agent's cooldown expires (e.g. after 00:30Z)
 * so unfunded agents refresh their snapshot with zero `sync-debit` 402s while
 * newly funded agents wake up immediately.
 */
export async function probeWtenBalanceByEmail(
  email: string,
  options: {
    deadlineMs?: number
    timeoutMs?: number
    fetchImpl?: typeof fetch
  } = {}
): Promise<WtenBalanceProbeResult> {
  const config = (() => {
    try {
      return loadAlchmSyncConfig()
    } catch {
      return null
    }
  })()
  if (!config) {
    return { status: 'skipped' }
  }

  const nowMs = Date.now()
  if (pastBudget(options.deadlineMs, undefined, nowMs)) {
    return { status: 'unavailable' }
  }

  const requestedTimeout = options.timeoutMs ?? WTEN_BALANCE_PROBE_TIMEOUT_MS
  const timeoutMs =
    options.deadlineMs !== undefined
      ? Math.max(500, Math.min(requestedTimeout, options.deadlineMs - nowMs))
      : requestedTimeout

  const fetchFn = options.fetchImpl ?? globalThis.fetch
  const url = `${config.baseUrl}/api/economy/balance?email=${encodeURIComponent(email)}`

  try {
    const res = await fetchFn(url, {
      method: 'GET',
      headers: { 'X-Sync-Secret': config.secret },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (res.status === 200) {
      const data = await res.json().catch(() => null)
      const balances = normalizeWtenBalances(data?.balances)
      if (!balances) return { status: 'unavailable' }
      return { status: 'ok', balances }
    }

    if (res.status === 404) {
      return {
        status: 'no_balance',
        balances: { spirit: 0, essence: 0, matter: 0, substance: 0 },
      }
    }

    return { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  }
}
