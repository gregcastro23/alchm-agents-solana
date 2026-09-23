/**
 * The one way ASOL sends requests to WTEN (alchm.kitchen).
 *
 * Every outbound call carries a STABLE event ID derived from the source event
 * — never a fresh random one per attempt — as `Idempotency-Key`, and every
 * retry reuses it. The body is serialised once and the same bytes are sent on
 * every attempt (Phase 2 will sign exactly those bytes).
 *
 * Retry policy (shared by every endpoint):
 *   - retried: timeouts, network errors, 5xx, 429 (honouring Retry-After),
 *     and a 409 whose body says the first delivery is still in flight
 *     (WTEN's webhook core answers `409 {status:"in_flight"}` for that);
 *   - never retried: any other 4xx. A 409 without the in-flight marker means
 *     "already applied" on the endpoints that say so (sync-credit, sync-debit),
 *     which is success; 402 (insufficient funds) is final.
 *   - bounded exponential backoff with equal jitter, capped per wait, capped
 *     in attempts, and never past the caller's deadline.
 *
 * One deliberate narrowing: an endpoint that does NOT dedupe on the event ID
 * yet (`receiverDedupes: false`) only retries failures that provably never
 * reached its handler — 429, 503 and connect-phase network errors. Retrying a
 * timeout or a 500 there could apply the same event twice, which is exactly
 * the sync-event quest double-count WTEN reported. Flip the flag when WTEN
 * ships its dedupe.
 */
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'
import { recordDeliveryAttempt } from './delivery-log'

export type WtenEndpoint =
  | 'economy/sync-credit'
  | 'economy/sync-debit'
  | 'economy/sync-event'
  | 'internal/agent-sync'
  | 'internal/agent-recipes'
  | 'feed'

export interface EndpointPolicy {
  /** Per-attempt timeout (ms). `timeoutSource` says where the number comes from. */
  timeoutMs: number
  timeoutSource: string
  /** WTEN dedupes on the event ID today, so any failure is safe to retry. */
  receiverDedupes: boolean
  /** A 409 without an in-flight marker means the event was already applied. */
  conflictMeansApplied: boolean
}

export const WTEN_ENDPOINT_POLICY: Record<WtenEndpoint, EndpointPolicy> = {
  'economy/sync-debit': {
    timeoutMs: 10_000,
    timeoutSource: 'unchanged: lib/alchm-debit-sync.ts has used 10s since it shipped',
    receiverDedupes: true, // token_transactions.idempotency_key, `${key}:%` probe
    conflictMeansApplied: true,
  },
  'economy/sync-credit': {
    timeoutMs: 10_000,
    timeoutSource: 'matches sync-debit (same WTEN ledger write); previously unbounded',
    receiverDedupes: true, // token_transactions.idempotency_key + daily-yield guard
    conflictMeansApplied: true,
  },
  'economy/sync-event': {
    timeoutMs: 10_000,
    timeoutSource: 'matches the other economy routes; previously unbounded',
    receiverDedupes: false, // QuestService.reportEvent increments on every delivery
    conflictMeansApplied: true, // what WTEN's dedupe will answer once it exists
  },
  'internal/agent-sync': {
    timeoutMs: 10_000,
    timeoutSource: 'matches the economy routes; previously unbounded',
    receiverDedupes: true, // upsert by email
    conflictMeansApplied: false,
  },
  'internal/agent-recipes': {
    timeoutMs: 8_000,
    timeoutSource: 'unchanged: feed-activation-engine used AbortSignal.timeout(8000)',
    receiverDedupes: false, // inserts a recipe row per call
    conflictMeansApplied: false,
  },
  feed: {
    timeoutMs: 10_000,
    timeoutSource: 'matches the economy routes; previously unbounded',
    receiverDedupes: false, // WTEN /api/feed inserts; no idempotency handling today
    conflictMeansApplied: false,
  },
}

export type DeliveryOutcome = 'delivered' | 'already_applied' | 'rejected' | 'failed'

export interface DeliveryAttempt {
  endpoint: WtenEndpoint
  eventId: string
  attempt: number
  status: number | null
  latencyMs: number
  /** What this attempt concluded: a final outcome, or `retry` when another follows. */
  result: DeliveryOutcome | 'retry'
  error?: string
}

export interface DeliveryResult {
  outcome: DeliveryOutcome
  /** delivered or already_applied */
  ok: boolean
  status: number | null
  /** Parsed JSON body of the last response, or null. */
  body: any
  attempts: number
  eventId: string
  error?: string
}

export interface DeliveryRequest {
  endpoint: WtenEndpoint
  url: string
  method?: 'POST' | 'GET'
  /** Auth headers. Never logged. */
  headers: Record<string, string>
  /** Serialised once; the same bytes go out on every attempt. */
  body?: unknown
  /** Stable, source-derived ID. Reused by every attempt. */
  eventId: string
  /** Absolute epoch-ms deadline: no attempt starts after it, waits never cross it. */
  deadline?: number
  maxAttempts?: number
}

export interface DeliveryDeps {
  fetch: typeof fetch
  sleep: (ms: number) => Promise<void>
  random: () => number
  now: () => number
  /** Awaited, but never for longer than ATTEMPT_LOG_BUDGET_MS. */
  onAttempt: (attempt: DeliveryAttempt) => void | Promise<void>
}

export const RETRY = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  /** A Retry-After longer than this ends the delivery instead of stalling a cron. */
  maxRetryAfterMs: 10_000,
  /** Don't start an attempt with less than this left before the deadline. */
  minAttemptMs: 1_000,
  /**
   * After a delivery runs out of attempts without ever getting a response
   * (timeouts, network errors), later deliveries make ONE attempt for this long.
   * The agent tick delivers per agent, sequentially: without this, an unreachable
   * WTEN would cost ~3 timeouts per agent instead of one.
   */
  unreachableWindowMs: 60_000,
} as const

/** Per process. Set when WTEN stopped answering at all; cleared by any response. */
let unreachableUntil = 0

/** Test-only: forget a previous unreachable verdict. */
export function __resetWtenReachability(): void {
  unreachableUntil = 0
}

const defaultDeps: DeliveryDeps = {
  fetch: (input, init) => globalThis.fetch(input, init),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  random: Math.random,
  now: Date.now,
  onAttempt: attempt => {
    const line = JSON.stringify(attempt)
    if (attempt.result === 'delivered' || attempt.result === 'already_applied') {
      console.info(`[wten-delivery] ${line}`)
    } else {
      console.warn(`[wten-delivery] ${line}`)
    }
    return recordDeliveryAttempt(attempt)
  },
}

/** A slow delivery-log write must not stall the delivery it describes. */
const ATTEMPT_LOG_BUDGET_MS = 2_000

async function reportAttempt(deps: DeliveryDeps, attempt: DeliveryAttempt): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve(deps.onAttempt(attempt)),
      new Promise<void>(resolve => {
        timer = setTimeout(resolve, ATTEMPT_LOG_BUDGET_MS)
      }),
    ])
  } catch {
    // Observability must never fail a delivery.
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Stable short ID from arbitrary parts, for events that have no natural key. */
export function stableEventId(prefix: string, ...parts: unknown[]): string {
  const canonical = parts.map(p => (typeof p === 'string' ? p : canonicalJson(p))).join('|')
  return `${prefix}:${bytesToHex(sha256(utf8ToBytes(canonical))).slice(0, 24)}`
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .filter(k => obj[k] !== undefined)
    .sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`
}

/** Equal-jitter exponential backoff: a delay in [cap/2, cap], cap = min(max, base·2^(n-1)). */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RETRY.maxDelayMs, RETRY.baseDelayMs * 2 ** Math.max(0, attempt - 1))
  return Math.round(ceiling / 2 + random() * (ceiling / 2))
}

/** Retry-After as milliseconds (delta-seconds or HTTP-date), or null when absent/invalid. */
export function parseRetryAfterMs(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const at = Date.parse(trimmed)
  return Number.isFinite(at) ? Math.max(0, at - now) : null
}

function isInFlightBody(body: any): boolean {
  if (!body || typeof body !== 'object') return false
  return body.status === 'in_flight' || body.reason === 'in_flight'
}

/** Final outcome for a response, or `retry`. Exported for the contract tests. */
export function classifyResponse(
  status: number,
  body: unknown,
  policy: EndpointPolicy
): DeliveryOutcome | 'retry' {
  if (status >= 200 && status < 300) return 'delivered'
  if (status === 409) {
    if (isInFlightBody(body)) return 'retry'
    return policy.conflictMeansApplied ? 'already_applied' : 'rejected'
  }
  if (status === 429) return 'retry'
  if (status >= 500) {
    if (policy.receiverDedupes || status === 503) return 'retry'
    return 'failed'
  }
  return 'rejected'
}

const CONNECT_PHASE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
])

/** Network error before the request could have reached the handler. */
function isConnectPhaseError(err: unknown): boolean {
  const code = (err as any)?.cause?.code ?? (err as any)?.code
  return typeof code === 'string' && CONNECT_PHASE_CODES.has(code)
}

async function readBody(res: Response): Promise<any> {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 500) }
  }
}

export async function deliverToWten(
  req: DeliveryRequest,
  overrides: Partial<DeliveryDeps> = {}
): Promise<DeliveryResult> {
  const deps: DeliveryDeps = { ...defaultDeps, ...overrides }
  const policy = WTEN_ENDPOINT_POLICY[req.endpoint]
  // WTEN recently stopped answering at all: one attempt each until it answers again.
  const failFast = deps.now() < unreachableUntil
  const maxAttempts = failFast ? 1 : Math.max(1, req.maxAttempts ?? RETRY.maxAttempts)
  let sawResponse = false
  const payload = req.body === undefined ? undefined : JSON.stringify(req.body)
  const headers: Record<string, string> = {
    ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...req.headers,
    'Idempotency-Key': req.eventId,
  }

  let last: DeliveryResult = {
    outcome: 'failed',
    ok: false,
    status: null,
    body: null,
    attempts: 0,
    eventId: req.eventId,
    error: 'not attempted',
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remaining = req.deadline === undefined ? Infinity : req.deadline - deps.now()
    if (remaining < RETRY.minAttemptMs) {
      if (attempt === 1) last.error = 'deadline reached before first attempt'
      break
    }
    const timeoutMs = Math.min(policy.timeoutMs, remaining)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const started = deps.now()
    let status: number | null = null
    let body: any = null
    let result: DeliveryOutcome | 'retry'
    let error: string | undefined
    let retryAfterMs: number | null = null

    try {
      const res = await deps.fetch(req.url, {
        method: req.method ?? 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      })
      status = res.status
      sawResponse = true
      body = await readBody(res)
      result = classifyResponse(res.status, body, policy)
      if (result !== 'delivered' && result !== 'already_applied') {
        error =
          `HTTP ${res.status}: ${body?.message || body?.error || body?.reason || body?.raw || ''}`.trim()
      }
      retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'), deps.now())
    } catch (err) {
      const timedOut = controller.signal.aborted
      error = timedOut
        ? `timeout (${timeoutMs}ms)`
        : err instanceof Error
          ? err.message
          : String(err)
      result =
        policy.receiverDedupes || (!timedOut && isConnectPhaseError(err)) ? 'retry' : 'failed'
    } finally {
      clearTimeout(timer)
    }

    const isLast = attempt === maxAttempts
    const reported: DeliveryOutcome | 'retry' = result === 'retry' && isLast ? 'failed' : result
    await reportAttempt(deps, {
      endpoint: req.endpoint,
      eventId: req.eventId,
      attempt,
      status,
      latencyMs: deps.now() - started,
      result: reported,
      ...(error ? { error } : {}),
    })

    last = {
      outcome: reported === 'retry' ? 'failed' : reported,
      ok: reported === 'delivered' || reported === 'already_applied',
      status,
      body,
      attempts: attempt,
      eventId: req.eventId,
      ...(error ? { error } : {}),
    }
    if (reported !== 'retry') break

    let wait = backoffDelayMs(attempt, deps.random)
    if (retryAfterMs !== null) {
      if (retryAfterMs > RETRY.maxRetryAfterMs) {
        last.error =
          `${error ?? ''} (Retry-After ${Math.round(retryAfterMs / 1000)}s exceeds budget)`.trim()
        break
      }
      wait = Math.max(wait, retryAfterMs)
    }
    if (req.deadline !== undefined && deps.now() + wait + RETRY.minAttemptMs > req.deadline) {
      last.error = `${error ?? ''} (no time left to retry)`.trim()
      break
    }
    await deps.sleep(wait)
  }

  if (sawResponse) unreachableUntil = 0
  else if (last.attempts > 0 && !last.ok) unreachableUntil = deps.now() + RETRY.unreachableWindowMs

  return last
}
