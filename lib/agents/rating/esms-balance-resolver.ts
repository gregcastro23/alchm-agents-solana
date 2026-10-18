/**
 * Live ESMS balance resolver for the Pentacle Vessel Rating Scale.
 *
 * `evaluateSeals` (./seals-surge) turns an agent's ESMS holdings into Alchemical Seals but
 * takes the holdings as an argument. This module answers "what does this agent hold right
 * now, and how do we know?" in WHOLE TOKENS (`EsmsHoldings`), together with the provenance of
 * the answer, so a Seal can never silently rest on a number nobody read.
 *
 * ## Fallback hierarchy — first success wins
 *
 *   1. `options.spacetime`  — holdings the CALLER already read from live SpacetimeDB table
 *      state (or a cached copy of it). This module does not subscribe to SpacetimeDB, open a
 *      socket or know the module's schema: the client that owns the subscription passes the
 *      row in. Values are validated and used as-is; a non-number, non-finite or negative value
 *      rejects the whole override — nothing is coerced. `esmsSource: 'spacetimedb'`.
 *   2. the Prisma ledger    — `token_balances` (spirit/essence/matter/substance, Decimal(12,4))
 *      is the authoritative off-chain ESMS ledger. A historical or sprite agent is provisioned
 *      as an 'agentic' user (`<agentId>@agentic.alchm.kitchen`) and owns that user's row; a
 *      created / user-avatar vessel has no wallet of its own and reads its CREATOR's row.
 *      `esmsSource: 'database'`.
 *   3. a deterministic baseline — the agent's own `consciousness.alchemicalElements` when it is
 *      in `HISTORICAL_AGENTS` (0.25–0.98 whole tokens, so Copper at most by design), else
 *      zeros. `esmsSource: 'fallback'`, always with `degraded.reason`.
 *
 * ## A failed read is never a healthy zero
 *
 * A ledger that THROWS is not an empty ledger. With `strict: true` (admin surfaces) it throws
 * `EsmsLedgerUnavailableError`; otherwise the result is the baseline, marked
 * `esmsSource: 'fallback'` and `degraded: { reason }`. A ledger that answers with no row is
 * the same fallback with reason `'no ledger row'`. A row that answers is reported as
 * `'database'` even when every balance is genuinely 0. A ledger value that is NaN, infinite or
 * negative is a corrupt row, handled like a failed read — never clamped to 0.
 *
 * ## Isomorphism
 *
 * Nothing here imports `@/lib/db`, `@prisma/client`, `pg`, `server-only` or a `node:` module
 * at the top level, so client code can import the types and pure helpers
 * (`parseEsmsHoldings`, `decimalToWholeTokens`, `holdingsFromAlchemicalElements`). The default
 * ledger store reaches Prisma through a dynamic `import('@/lib/db')` inside a
 * `typeof window === 'undefined'` branch, which bundlers drop from client builds; in a browser
 * the default loader fails with an ordinary error and the non-strict path degrades. The ledger
 * is injectable (`options.loadLedger`, or `createLedgerLoader(store)`), and so is every test.
 *
 * ## Authorization is the caller's job
 *
 * Resolving a user vessel reads its creator's wallet. This module performs no access check;
 * a route that exposes the result must decide who may see which agent's balances.
 *
 * Nothing here derives thermodynamics or hashes, reads the wall clock, or uses randomness.
 */
import { ESMS_TOKENS, type EsmsHoldings } from './seals-surge'

// ─── Types ───────────────────────────────────────────────────────────────────

/** Where the holdings came from: live SpacetimeDB state, the Prisma ledger, or the baseline. */
export type EsmsSource = 'spacetimedb' | 'database' | 'fallback'

export interface ResolvedEsmsBalances {
  agentId: string
  /** Whole tokens (UI units). Always four finite, non-negative numbers. */
  balances: EsmsHoldings
  esmsSource: EsmsSource
  /**
   * Present whenever the result is not the first-choice source cleanly: a baseline
   * (`'fallback'`), or a ledger answer that was reached only because the live override was
   * rejected. Absent for a clean `'spacetimedb'` or `'database'` read.
   */
  degraded?: { reason: string }
}

export interface ResolveEsmsOptions {
  /**
   * Holdings the caller already read from SpacetimeDB table state. Validated, never
   * coerced; an invalid value is rejected (see `strict`). `null`/`undefined` skips the step.
   */
  spacetime?: Readonly<EsmsHoldings> | null
  /**
   * Replaces the default Prisma ledger loader. Resolve `null` for "no ledger row"; throw for
   * "could not read". Values may be numbers or Decimal-likes and are validated either way.
   */
  loadLedger?: (agentId: string) => Promise<EsmsHoldings | null>
  /**
   * `true` for admin surfaces: a ledger read that throws (or returns a corrupt row) throws
   * `EsmsLedgerUnavailableError`, and an invalid `spacetime` override throws `RangeError`,
   * instead of degrading to the baseline. Default `false`.
   */
  strict?: boolean
}

export interface ResolveRosterEsmsOptions extends Omit<ResolveEsmsOptions, 'spacetime'> {
  /** Per-agent SpacetimeDB holdings, keyed by agentId (own keys only). */
  spacetime?: Readonly<Record<string, Readonly<EsmsHoldings> | null | undefined>>
  /** Maximum concurrent ledger reads; a positive integer. Default `ESMS_ROSTER_CONCURRENCY`. */
  concurrency?: number
}

/** Thrown in strict mode when the Prisma ledger could not be read. `cause` is the original error. */
export class EsmsLedgerUnavailableError extends Error {
  readonly agentId: string
  override readonly cause: unknown

  constructor(agentId: string, cause: unknown) {
    super(`ESMS ledger unavailable for agent "${agentId}"`)
    this.name = 'EsmsLedgerUnavailableError'
    this.agentId = agentId
    this.cause = cause
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default bound on concurrent ledger reads in `resolveRosterEsmsBalances`. */
export const ESMS_ROSTER_CONCURRENCY = 8

/** Mirrors `AGENTIC_DOMAIN` in `lib/agents/agentic-user-sync.ts` (a spec pins the parity). */
export const AGENTIC_EMAIL_DOMAIN = '@agentic.alchm.kitchen'

/** Ids with this prefix are user vessels: they hold no wallet and read their creator's. */
export const USER_AVATAR_ID_PREFIX = 'user-avatar-'

/** The email under which `ensureAgenticUserAndSync` provisions an agent's ledger user. */
export function agenticEmailForAgent(agentId: string): string {
  return `${agentId}${AGENTIC_EMAIL_DOMAIN}`
}

export function isUserAvatarId(agentId: string): boolean {
  return agentId.startsWith(USER_AVATAR_ID_PREFIX)
}

// ─── Pure value handling ─────────────────────────────────────────────────────

function describeValue(value: unknown): string {
  try {
    const text = typeof value === 'string' ? JSON.stringify(value) : String(value)
    return text.length > 40 ? `${text.slice(0, 37)}...` : text
  } catch {
    return '<unprintable>'
  }
}

const NUMERIC_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

function numberFromText(text: string): number | undefined {
  const trimmed = text.trim()
  return NUMERIC_TEXT.test(trimmed) ? Number(trimmed) : undefined
}

/** The number a value claims to be, or `undefined` when it claims nothing numeric. */
function claimedNumber(value: unknown): number | undefined {
  switch (typeof value) {
    case 'number':
      return value
    case 'bigint': {
      const asNumber = Number(value)
      return Number.isSafeInteger(asNumber) ? asNumber : undefined
    }
    case 'string':
      return numberFromText(value)
    case 'object': {
      if (value === null || Array.isArray(value)) return undefined
      const candidate = value as { toNumber?: unknown; toString?: unknown }
      // Prisma `Decimal` (decimal.js) and anything shaped like it.
      if (typeof candidate.toNumber === 'function') {
        try {
          return Number(candidate.toNumber())
        } catch {
          return undefined
        }
      }
      if (
        typeof candidate.toString === 'function' &&
        candidate.toString !== Object.prototype.toString
      ) {
        return numberFromText(String(value))
      }
      return undefined
    }
    default:
      return undefined
  }
}

/**
 * A ledger amount → a finite, non-negative whole-token `number`. Accepts numbers, bigints,
 * numeric strings and Decimal-likes (an object with `toNumber()` or a numeric `toString()`).
 * Throws `RangeError` for NaN, ±Infinity, a negative, or anything that is not numeric —
 * a negative is a corrupt ledger, and clamping it to 0 would hide that. `-0` becomes `0`.
 */
export function decimalToWholeTokens(value: unknown, label = 'amount'): number {
  const amount = claimedNumber(value)
  if (amount === undefined || !Number.isFinite(amount)) {
    throw new RangeError(`Invalid ${label}: ${describeValue(value)} is not a finite number`)
  }
  if (amount < 0) {
    throw new RangeError(`Invalid ${label}: ${describeValue(value)} is negative`)
  }
  return amount === 0 ? 0 : amount
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function zeroHoldings(): EsmsHoldings {
  return { spirit: 0, essence: 0, matter: 0, substance: 0 }
}

/**
 * A raw ledger row (or anything holding the four ESMS fields, extras ignored) →
 * `EsmsHoldings`. Every token must be present and valid; throws `RangeError` naming the first
 * that is not.
 */
export function parseEsmsHoldings(raw: unknown): EsmsHoldings {
  if (!isRecord(raw)) {
    throw new RangeError(`Invalid ESMS holdings: ${describeValue(raw)} is not an object`)
  }
  const holdings = zeroHoldings()
  for (const token of ESMS_TOKENS) {
    holdings[token] = decimalToWholeTokens(raw[token], `${token} balance`)
  }
  return holdings
}

/** The caller-supplied live override: stricter than a ledger row — real numbers only. */
function parseLiveHoldings(raw: unknown): EsmsHoldings {
  if (!isRecord(raw)) {
    throw new RangeError(`Invalid spacetimedb holdings: ${describeValue(raw)} is not an object`)
  }
  const holdings = zeroHoldings()
  for (const token of ESMS_TOKENS) {
    const value = raw[token]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new RangeError(
        `Invalid spacetimedb ${token} balance: ${describeValue(value)} is not a finite non-negative number`
      )
    }
    holdings[token] = value === 0 ? 0 : value
  }
  return holdings
}

/** An `alchemicalElements` block → holdings; anything missing or invalid → all zeros. */
export function holdingsFromAlchemicalElements(elements: unknown): EsmsHoldings {
  try {
    return parseEsmsHoldings(elements)
  } catch {
    return zeroHoldings()
  }
}

/** Sanitised failure text: validation messages are ours; anything else is name + code only. */
function describeFailure(cause: unknown): string {
  if (cause instanceof RangeError) return cause.message
  const name = cause instanceof Error ? cause.name : typeof cause
  const code = isRecord(cause) && typeof cause.code === 'string' ? ` (${cause.code})` : ''
  return `${name}${code}`
}

// ─── The roster baseline ─────────────────────────────────────────────────────

let rosterElements: Promise<ReadonlyMap<string, unknown>> | null = null

/** `id → consciousness.alchemicalElements` for `HISTORICAL_AGENTS`, imported once and lazily. */
function loadRosterElements(): Promise<ReadonlyMap<string, unknown>> {
  if (rosterElements === null) {
    rosterElements = import('@/lib/agents/historical').then(
      ({ HISTORICAL_AGENTS }) =>
        new Map<string, unknown>(
          HISTORICAL_AGENTS.map(agent => [agent.id, agent.consciousness.alchemicalElements])
        ),
      error => {
        rosterElements = null // do not cache a failed import
        throw error
      }
    )
  }
  return rosterElements
}

async function isRosterAgent(agentId: string): Promise<boolean> {
  return (await loadRosterElements()).has(agentId)
}

/**
 * The offline baseline: the agent's own `consciousness.alchemicalElements` if it is in
 * `HISTORICAL_AGENTS` (exact id match), else zeros. A fresh object every call.
 */
export async function baselineEsmsHoldings(agentId: string): Promise<EsmsHoldings> {
  return holdingsFromAlchemicalElements((await loadRosterElements()).get(agentId))
}

// ─── The Prisma ledger ───────────────────────────────────────────────────────

/** The three reads the ledger needs; the default talks to Prisma, a test supplies fakes. */
export interface EsmsLedgerStore {
  /** `users.id` of the agentic user with this email, or `null`. */
  findAgenticUserId(email: string): Promise<string | null>
  /** `created_agents.creatorId` for a created / user-avatar vessel id, or `null`. */
  findCreatorUserId(agentId: string): Promise<string | null>
  /** The raw `token_balances` row (Decimal columns) for a user, or `null`. */
  findBalanceRow(userId: string): Promise<Record<string, unknown> | null>
}

/**
 * Prisma, loaded on first use. Inside the `typeof window` branch so a client bundle drops the
 * import (and `@/lib/db`, which is `server-only`) entirely.
 */
async function loadPrisma() {
  if (typeof window === 'undefined') {
    const { prisma } = await import('@/lib/db')
    return prisma
  }
  throw new Error('The ESMS ledger can only be read on the server')
}

export const defaultLedgerStore: EsmsLedgerStore = {
  async findAgenticUserId(email) {
    const prisma = await loadPrisma()
    const user = await prisma.users.findFirst({
      where: { email, isAgentic: true },
      select: { id: true },
    })
    return user?.id ?? null
  },

  async findCreatorUserId(agentId) {
    const prisma = await loadPrisma()
    // A forged vessel's public id lives in the blueprint JSON (`app/api/create-agent`); the
    // row's own cuid is matched too. Oldest first, so a re-forged id keeps its original creator.
    const vessel = await prisma.created_agents.findFirst({
      where: {
        creatorId: { not: null },
        OR: [{ id: agentId }, { blueprint: { path: ['agentId'], equals: agentId } }],
      },
      orderBy: { createdAt: 'asc' },
      select: { creatorId: true },
    })
    return vessel?.creatorId ?? null
  },

  async findBalanceRow(userId) {
    const prisma = await loadPrisma()
    return prisma.tokenBalance.findUnique({
      where: { userId },
      select: { spirit: true, essence: true, matter: true, substance: true },
    })
  },
}

/**
 * Build a ledger loader over a store. Which user's row an id reads:
 *
 *   • a roster (historical) agent → its agentic user;
 *   • a `user-avatar-*` id        → its creator (never an agentic user);
 *   • any other id (a forged vessel, a sprite) → its creator if `created_agents` knows it,
 *     else the agentic user.
 *
 * Resolves `null` when no user, or no `token_balances` row, is found; throws when the store
 * throws or the row is corrupt (negative / non-finite / non-numeric).
 */
export function createLedgerLoader(
  store: EsmsLedgerStore = defaultLedgerStore,
  isRoster: (agentId: string) => Promise<boolean> = isRosterAgent
): (agentId: string) => Promise<EsmsHoldings | null> {
  const agentic = (agentId: string) => store.findAgenticUserId(agenticEmailForAgent(agentId))

  async function ledgerUserId(agentId: string): Promise<string | null> {
    if (isUserAvatarId(agentId)) return store.findCreatorUserId(agentId)
    if (await isRoster(agentId)) return agentic(agentId)
    return (await store.findCreatorUserId(agentId)) ?? agentic(agentId)
  }

  return async agentId => {
    const userId = await ledgerUserId(agentId)
    if (userId === null) return null
    const row = await store.findBalanceRow(userId)
    return row === null ? null : parseEsmsHoldings(row)
  }
}

let defaultLoader: ((agentId: string) => Promise<EsmsHoldings | null>) | null = null

// ─── Resolving ───────────────────────────────────────────────────────────────

function assertAgentId(agentId: unknown): asserts agentId is string {
  if (typeof agentId !== 'string' || agentId.trim() === '') {
    throw new TypeError('agentId must be a non-empty string')
  }
}

function resultOf(
  agentId: string,
  balances: EsmsHoldings,
  esmsSource: EsmsSource,
  reasons: readonly string[]
): ResolvedEsmsBalances {
  const result: ResolvedEsmsBalances = { agentId, balances, esmsSource }
  if (reasons.length > 0) result.degraded = { reason: reasons.join('; ') }
  return result
}

/**
 * Resolve one agent's ESMS holdings in whole tokens, with provenance. See the module header
 * for the hierarchy and failure semantics. Rejects only for a malformed `agentId`
 * (`TypeError`) or, with `strict: true`, an unreadable ledger (`EsmsLedgerUnavailableError`)
 * or an invalid `spacetime` override (`RangeError`).
 */
export async function resolveAgentEsmsBalances(
  agentId: string,
  options: ResolveEsmsOptions = {}
): Promise<ResolvedEsmsBalances> {
  assertAgentId(agentId)
  const strict = options.strict === true
  const reasons: string[] = []

  // 1. Live SpacetimeDB holdings the caller already read.
  if (options.spacetime !== undefined && options.spacetime !== null) {
    try {
      return resultOf(agentId, parseLiveHoldings(options.spacetime), 'spacetimedb', [])
    } catch (error) {
      if (strict) throw error
      reasons.push(`spacetimedb holdings rejected: ${describeFailure(error)}`)
    }
  }

  // 2. The Prisma ledger.
  try {
    const loadLedger = options.loadLedger ?? (defaultLoader ??= createLedgerLoader())
    const ledger = await loadLedger(agentId)
    if (ledger !== null && ledger !== undefined) {
      return resultOf(agentId, parseEsmsHoldings(ledger), 'database', reasons)
    }
    reasons.push('no ledger row')
  } catch (cause) {
    if (strict) throw new EsmsLedgerUnavailableError(agentId, cause)
    reasons.push(
      cause instanceof RangeError
        ? `ledger row invalid: ${cause.message}`
        : `ledger unavailable: ${describeFailure(cause)}`
    )
  }

  // 3. The deterministic baseline.
  try {
    return resultOf(agentId, await baselineEsmsHoldings(agentId), 'fallback', reasons)
  } catch (error) {
    if (strict) throw error
    reasons.push(`baseline unavailable: ${describeFailure(error)}`)
    return resultOf(agentId, zeroHoldings(), 'fallback', reasons)
  }
}

/** Run `task` over `items` with at most `limit` in flight; results keep input order. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  const state: { next: number; failed: boolean; error?: unknown } = { next: 0, failed: false }

  async function worker(): Promise<void> {
    while (!state.failed) {
      const index = state.next++
      if (index >= items.length) return
      try {
        results[index] = await task(items[index], index)
      } catch (error) {
        if (!state.failed) Object.assign(state, { failed: true, error })
        return
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  if (state.failed) throw state.error
  return results
}

/**
 * Resolve many agents, at most `concurrency` (default 8) ledger reads at a time, results in the
 * input order. In non-strict mode no single agent's failure can reject the batch; in strict
 * mode the first failure rejects it (after the in-flight reads settle) and no new reads start.
 * A malformed id anywhere in the list rejects before any read begins.
 */
export async function resolveRosterEsmsBalances(
  agentIds: readonly string[],
  options: ResolveRosterEsmsOptions = {}
): Promise<ResolvedEsmsBalances[]> {
  for (const agentId of agentIds) assertAgentId(agentId)
  const { spacetime, concurrency = ESMS_ROSTER_CONCURRENCY, ...rest } = options
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(
      `concurrency must be a positive integer, got ${describeValue(concurrency)}`
    )
  }

  return mapWithConcurrency(agentIds, concurrency, async agentId => {
    try {
      const live =
        spacetime !== undefined && Object.prototype.hasOwnProperty.call(spacetime, agentId)
          ? spacetime[agentId]
          : undefined
      return await resolveAgentEsmsBalances(agentId, { ...rest, spacetime: live })
    } catch (error) {
      if (rest.strict === true) throw error
      return resultOf(agentId, zeroHoldings(), 'fallback', [
        `resolution failed: ${describeFailure(error)}`,
      ])
    }
  })
}
