/** @vitest-environment node */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { agenticEmailFor } from '@/lib/agents/agentic-user-sync'
import * as resolverModule from '@/lib/agents/rating/esms-balance-resolver'
import {
  AGENTIC_EMAIL_DOMAIN,
  CreatorWalletPrivateError,
  ESMS_ROSTER_CONCURRENCY,
  EsmsLedgerUnavailableError,
  EsmsValueError,
  USER_AVATAR_ID_PREFIX,
  agenticEmailForAgent,
  baselineEsmsHoldings,
  createLedgerLoader,
  decimalToWholeTokens,
  holdingsFromAlchemicalElements,
  isUserAvatarId,
  parseEsmsHoldings,
  resolveAgentEsmsBalances,
  resolveRosterEsmsBalances,
  type CreatorWalletPolicy,
  type EsmsLedgerStore,
  type LedgerContext,
} from '@/lib/agents/rating/esms-balance-resolver'
import {
  ESMS_TOKENS,
  SEAL_TIER_REQUIREMENTS,
  evaluateSeals,
  type EsmsHoldings,
} from '@/lib/agents/rating/seals-surge'
import { CORE_STAT_KEYS, type CoreStats } from '@/lib/agents/rating/ovr-archetype'

// `agentic-user-sync` is imported only to pin email parity; its WTEN client is irrelevant here.
// No test in this file talks to a database: the resolver is isomorphic and is handed its ledger.
vi.mock('@/lib/wtenClient', () => ({ syncAgentToWten: vi.fn() }))

const EINSTEIN = 'albert-einstein'
const CARROLL = 'lewis-carroll'
const MODULE_PATH = fileURLToPath(
  new URL('../../lib/agents/rating/esms-balance-resolver.ts', import.meta.url)
)

const holdings = (spirit: number, essence: number, matter: number, substance: number) =>
  ({ spirit, essence, matter, substance }) as EsmsHoldings

/** What Prisma returns for a `Decimal` column: an object, not a number. */
const decimal = (text: string) => ({ toNumber: () => Number(text), toString: () => text })
const decimalRow = (spirit: string, essence: string, matter: string, substance: string) => ({
  spirit: decimal(spirit),
  essence: decimal(essence),
  matter: decimal(matter),
  substance: decimal(substance),
})

/** Let every pending promise continuation (and a macrotask) run. */
const tick = () => new Promise<void>(resolve => setImmediate(resolve))

/** Deterministic PRNG so the property tests are reproducible. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Spies that keep the real loader signature, so `mock.calls` is typed `[agentId, context]`. */
const loaderReturning = (value: EsmsHoldings | null) =>
  vi.fn(
    async (...args: [agentId: string, context: LedgerContext]): Promise<EsmsHoldings | null> => {
      void args
      return value
    }
  )
const loaderThrowing = (error: unknown) =>
  vi.fn(
    async (...args: [agentId: string, context: LedgerContext]): Promise<EsmsHoldings | null> => {
      void args
      throw error
    }
  )

/** An `onDegraded` hook that records exactly the arguments it was called with. */
function recordingHook() {
  const calls: unknown[][] = []
  const hook = (...args: unknown[]) => {
    calls.push(args)
  }
  return { hook, calls }
}

/** An in-memory `EsmsLedgerStore` over plain maps; every read is a spy. */
function fakeStore(config: {
  agentic?: Record<string, string>
  creators?: Record<string, string>
  rows?: Record<string, Record<string, unknown>>
}) {
  const own = (map: Record<string, unknown> | undefined, key: string) =>
    map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined
  return {
    findAgenticUserId: vi.fn(
      async (email: string) => (own(config.agentic, email) as string) ?? null
    ),
    findCreatorUserId: vi.fn(async (id: string) => (own(config.creators, id) as string) ?? null),
    findBalanceRow: vi.fn(
      async (userId: string) =>
        (own(config.rows, userId) as Record<string, unknown> | undefined) ?? null
    ),
  } satisfies EsmsLedgerStore
}

const notRoster = async () => false
const isRoster = async () => true

/** A Prisma-ish failure whose message carries a connection string nobody may ever see. */
class PrismaClientInitializationError extends Error {
  readonly code = 'P1001'
  constructor() {
    super("Can't reach database server at `postgres://svc:hunter2@db.internal:5432/alchm`")
    this.name = 'PrismaClientInitializationError'
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── Precedence of the three sources ─────────────────────────────────────────

describe('source precedence', () => {
  const live = holdings(120, 30, 4.5, 0)
  const ledger = holdings(1, 2, 3, 4)

  it('a valid SpacetimeDB override wins and the ledger is never read', async () => {
    const loadLedger = loaderReturning(ledger)
    const result = await resolveAgentEsmsBalances(EINSTEIN, { spacetime: live, loadLedger })
    expect(result).toStrictEqual({ agentId: EINSTEIN, balances: live, esmsSource: 'spacetimedb' })
    expect(loadLedger).not.toHaveBeenCalled()
  })

  it('returns a copy of the override, ignoring extra fields', async () => {
    const withExtras = { ...live, lamports: 5, owner: 'x' } as unknown as EsmsHoldings
    const result = await resolveAgentEsmsBalances(EINSTEIN, { spacetime: withExtras })
    expect(result.balances).toStrictEqual(live)
    expect(result.balances).not.toBe(withExtras)
    expect(Object.keys(result.balances)).toEqual([...ESMS_TOKENS])
  })

  it('with no override, a ledger row is reported as database with no degraded flag', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderReturning(ledger),
    })
    expect(result).toStrictEqual({ agentId: EINSTEIN, balances: ledger, esmsSource: 'database' })
    expect('degraded' in result).toBe(false)
  })

  it('treats a null override as absent: not rejected, not logged, no degraded flag', async () => {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: null,
      loadLedger: loaderReturning(ledger),
      onDegraded: hook,
    })
    expect(result).toStrictEqual({ agentId: EINSTEIN, balances: ledger, esmsSource: 'database' })
    expect(calls).toEqual([])
    // …and strict mode does not throw for it either.
    await expect(
      resolveAgentEsmsBalances(EINSTEIN, {
        spacetime: null,
        strict: true,
        loadLedger: loaderReturning(ledger),
      })
    ).resolves.toMatchObject({ esmsSource: 'database' })
  })

  it('treats an undefined override as absent, too', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: undefined,
      loadLedger: loaderReturning(ledger),
    })
    expect(result).toStrictEqual({ agentId: EINSTEIN, balances: ledger, esmsSource: 'database' })
  })

  it('an override beats a ledger that would have thrown', async () => {
    const loadLedger = loaderThrowing(new Error('connection refused'))
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: live,
      strict: true,
      loadLedger,
    })
    expect(result.esmsSource).toBe('spacetimedb')
    expect(loadLedger).not.toHaveBeenCalled()
  })

  it('a ledger row of genuine zeros is a database read, not a fallback', async () => {
    const result = await resolveAgentEsmsBalances('some-new-agent', {
      loadLedger: loaderReturning(holdings(0, 0, 0, 0)),
    })
    expect(result.esmsSource).toBe('database')
    expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
    expect(result.degraded).toBeUndefined()
  })

  it('falls through to the baseline only when there is no override and no row', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, { loadLedger: loaderReturning(null) })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'no ledger row' })
  })

  it('treats a sloppy undefined from the loader as no row', async () => {
    const loadLedger = vi.fn(async () => undefined) as unknown as () => Promise<null>
    const result = await resolveAgentEsmsBalances(EINSTEIN, { loadLedger })
    expect(result.degraded).toStrictEqual({ reason: 'no ledger row' })
  })

  it('rejects an empty or non-string agent id up front, in both modes', async () => {
    const loadLedger = loaderReturning(ledger)
    for (const bad of ['', '   ', undefined, null, 42] as unknown[]) {
      await expect(resolveAgentEsmsBalances(bad as string, { loadLedger })).rejects.toThrow(
        TypeError
      )
      await expect(
        resolveAgentEsmsBalances(bad as string, { loadLedger, strict: true })
      ).rejects.toThrow(TypeError)
    }
    expect(loadLedger).not.toHaveBeenCalled()
  })

  it('hands the ledger loader the agent id it was asked about, untrimmed', async () => {
    const loadLedger = loaderReturning(ledger)
    await resolveAgentEsmsBalances(' padded-id ', { loadLedger })
    expect(loadLedger).toHaveBeenCalledTimes(1)
    expect(loadLedger.mock.calls[0][0]).toBe(' padded-id ')
  })
})

// ─── Override validation ─────────────────────────────────────────────────────

describe('SpacetimeDB override validation', () => {
  const ledger = holdings(7, 8, 9, 10)
  const good = holdings(1, 2, 3, 4)

  const invalid: Array<[string, unknown, string]> = [
    ['NaN', { ...good, spirit: Number.NaN }, 'spirit'],
    ['Infinity', { ...good, essence: Number.POSITIVE_INFINITY }, 'essence'],
    ['-Infinity', { ...good, matter: Number.NEGATIVE_INFINITY }, 'matter'],
    ['a negative', { ...good, substance: -0.0001 }, 'substance'],
    ['a numeric string', { ...good, spirit: '5' }, 'spirit'],
    ['a Decimal-like object', { ...good, essence: decimal('3') }, 'essence'],
    ['null', { ...good, matter: null }, 'matter'],
    ['a boolean', { ...good, substance: true }, 'substance'],
    ['a missing token', { spirit: 1, essence: 2, matter: 3 }, 'substance'],
    ['an array', [1, 2, 3, 4], 'not an object'],
    ['a string', '1,2,3,4', 'not an object'],
  ]

  it.each(invalid)('rejects %s without coercing it', async (_name, bad, mention) => {
    const loadLedger = loaderReturning(ledger)
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: bad as EsmsHoldings,
      loadLedger,
      onDegraded: hook,
    })
    // Rejected, not used and not clamped: the next source answered, and the reason is the
    // fixed phrase alone — which token was wrong goes to the caller's own log.
    expect(result).toStrictEqual({
      agentId: EINSTEIN,
      balances: ledger,
      esmsSource: 'database',
      degraded: { reason: 'spacetimedb holdings rejected' },
    })
    expect(loadLedger).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveLength(2)
    expect(calls[0][0]).toBe('spacetimedb')
    expect(calls[0][1]).toContain(mention)
  })

  it.each(invalid)('strict mode throws a RangeError for %s', async (_name, bad) => {
    const loadLedger = loaderReturning(ledger)
    const { hook, calls } = recordingHook()
    const error = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: bad as EsmsHoldings,
      loadLedger,
      strict: true,
      onDegraded: hook,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RangeError)
    expect(error).toBeInstanceOf(EsmsValueError)
    expect(loadLedger).not.toHaveBeenCalled()
    // Strict mode throws instead of degrading, so there is nothing to log as degraded.
    expect(calls).toEqual([])
  })

  it('names the exact failure to the log for two representative rejections', async () => {
    const nan = recordingHook()
    await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: { ...good, spirit: Number.NaN },
      loadLedger: loaderReturning(ledger),
      onDegraded: nan.hook,
    })
    expect(nan.calls).toStrictEqual([
      [
        'spacetimedb',
        'Invalid spacetimedb spirit balance: NaN is not a finite non-negative number',
      ],
    ])
    const text = recordingHook()
    await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: '1,2,3,4' as unknown as EsmsHoldings,
      loadLedger: loaderReturning(ledger),
      onDegraded: text.hook,
    })
    expect(text.calls).toStrictEqual([
      ['spacetimedb', 'Invalid spacetimedb holdings: "1,2,3,4" is not an object'],
    ])
  })

  it('a rejected override with no ledger row keeps both reasons, in order', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: { ...good, spirit: -1 },
      loadLedger: loaderReturning(null),
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({
      reason: 'spacetimedb holdings rejected; no ledger row',
    })
  })

  it('a rejected override with a failing ledger keeps both reasons, in order', async () => {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: { ...good, spirit: Number.NaN },
      loadLedger: loaderThrowing(new Error('down')),
      onDegraded: hook,
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({
      reason: 'spacetimedb holdings rejected; ledger unavailable',
    })
    expect(calls.map(call => call[0])).toEqual(['spacetimedb', 'ledger'])
  })

  it('a rejected override with a corrupt ledger row keeps both reasons, in order', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: { ...good, spirit: -1 },
      loadLedger: loaderReturning({ ...good, matter: -2 }),
    })
    expect(result.degraded).toStrictEqual({
      reason: 'spacetimedb holdings rejected; ledger row invalid',
    })
  })

  it('accepts zeros and fractional values, and normalises -0', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: holdings(-0, 0.0001, 99999999.9999, 0),
    })
    expect(result.esmsSource).toBe('spacetimedb')
    expect(Object.is(result.balances.spirit, 0)).toBe(true)
    expect(result.balances.essence).toBe(0.0001)
    expect(result.balances.matter).toBe(99999999.9999)
  })

  it('does not mutate the caller object', async () => {
    const input = holdings(1, 2, 3, 4)
    const snapshot = { ...input }
    const result = await resolveAgentEsmsBalances(EINSTEIN, { spacetime: input })
    result.balances.spirit = 999
    expect(input).toStrictEqual(snapshot)
  })

  it('needs no ledger at all when the override is valid', async () => {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: good,
      strict: true,
      onDegraded: hook,
    })
    expect(result.esmsSource).toBe('spacetimedb')
    expect(calls).toEqual([])
  })
})

// ─── Failure semantics ───────────────────────────────────────────────────────

describe('failed ledger reads', () => {
  it('non-strict: a throwing loader yields the baseline, marked fallback + degraded', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderThrowing(new PrismaClientInitializationError()),
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
    expect(result.balances).toStrictEqual(await baselineEsmsHoldings(EINSTEIN))
    expect(Object.values(result.balances).some(value => value > 0)).toBe(true)
  })

  it('the driver error, its code and its connection string never reach the result', async () => {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderThrowing(new PrismaClientInitializationError()),
      onDegraded: hook,
    })
    expect(JSON.stringify(result)).not.toMatch(
      /hunter2|postgres|db\.internal|PrismaClient|P1001|Error/
    )
    // The sanitised detail — class and code, never the message — goes to the caller's log.
    expect(calls).toStrictEqual([['ledger', 'PrismaClientInitializationError (P1001)']])
    expect(JSON.stringify(calls)).not.toMatch(/hunter2|postgres|db\.internal|Can't reach/)
  })

  it.each<[string, unknown, string]>([
    ['a plain Error', new Error('password=hunter2'), 'Error'],
    ['a TypeError', new TypeError('cannot read hunter2'), 'TypeError'],
    ['a string', 'boom hunter2', 'string'],
    ['a number', 503, 'number'],
    ['undefined', undefined, 'undefined'],
    ['null', null, 'object'],
    [
      'a code on a non-Error object',
      { code: 'ECONNREFUSED', message: 'hunter2' },
      'object (ECONNREFUSED)',
    ],
    ['a numeric code', Object.assign(new Error('hunter2'), { code: 1234 }), 'Error'],
    [
      'a non-Error object that names itself after a secret',
      { name: 'hunter2-secret', message: 'hunter2' },
      'object',
    ],
    [
      'a non-Error object with a name and a code',
      { name: 'hunter2-secret', code: 'E_DRIVER' },
      'object (E_DRIVER)',
    ],
    ['a code on an Error', Object.assign(new Error('hunter2'), { code: 'P2024' }), 'Error (P2024)'],
  ])(
    'whatever the loader throws (%s), the reason is the fixed phrase and the log gets class + code',
    async (_name, thrown, detail) => {
      const { hook, calls } = recordingHook()
      const result = await resolveAgentEsmsBalances('unknown-agent', {
        loadLedger: loaderThrowing(thrown),
        onDegraded: hook,
      })
      expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
      expect(calls).toStrictEqual([['ledger', detail]])
      expect(JSON.stringify([result, calls])).not.toContain('hunter2')
    }
  )

  it('non-strict: a failed read for an unknown agent is NOT a healthy zero', async () => {
    const failed = await resolveAgentEsmsBalances('unknown-agent', {
      loadLedger: loaderThrowing(new Error('boom')),
    })
    const healthyZero = await resolveAgentEsmsBalances('unknown-agent', {
      loadLedger: loaderReturning(holdings(0, 0, 0, 0)),
    })
    expect(failed.balances).toStrictEqual(healthyZero.balances)
    expect(failed.esmsSource).toBe('fallback')
    expect(failed.degraded).toBeDefined()
    expect(healthyZero.esmsSource).toBe('database')
    expect(healthyZero.degraded).toBeUndefined()
  })

  it('strict: throws EsmsLedgerUnavailableError carrying the original cause', async () => {
    const cause = new PrismaClientInitializationError()
    const { hook, calls } = recordingHook()
    const error = await resolveAgentEsmsBalances(EINSTEIN, {
      strict: true,
      loadLedger: loaderThrowing(cause),
      onDegraded: hook,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
    expect(error).toBeInstanceOf(Error)
    const unavailable = error as EsmsLedgerUnavailableError
    expect(unavailable.cause).toBe(cause)
    expect(unavailable.agentId).toBe(EINSTEIN)
    expect(unavailable.name).toBe('EsmsLedgerUnavailableError')
    expect(unavailable.message).toBe(`ESMS ledger unavailable for agent "${EINSTEIN}"`)
    expect(unavailable.message).not.toContain('hunter2')
    expect(calls).toEqual([])
  })

  it('strict: keeps a non-Error throw as the cause', async () => {
    const error = await resolveAgentEsmsBalances(EINSTEIN, {
      strict: true,
      loadLedger: loaderThrowing('boom'),
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
    expect((error as EsmsLedgerUnavailableError).cause).toBe('boom')
  })

  it('non-strict: a non-Error throw degrades without crashing', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, { loadLedger: loaderThrowing('boom') })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
  })

  it('strict: a missing row is not an error — it is the baseline with "no ledger row"', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      strict: true,
      loadLedger: loaderReturning(null),
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'no ledger row' })
  })

  it('strict defaults to false', async () => {
    await expect(
      resolveAgentEsmsBalances(EINSTEIN, { loadLedger: loaderThrowing(new Error('x')) })
    ).resolves.toMatchObject({ esmsSource: 'fallback' })
    await expect(
      resolveAgentEsmsBalances(EINSTEIN, {
        strict: false,
        loadLedger: loaderThrowing(new Error('x')),
      })
    ).resolves.toMatchObject({ esmsSource: 'fallback' })
  })

  it('only the boolean true turns strict on', async () => {
    const options = { loadLedger: loaderThrowing(new Error('x')) }
    for (const notTrue of [1, 'true', {}, undefined, null]) {
      await expect(
        resolveAgentEsmsBalances(EINSTEIN, { ...options, strict: notTrue as unknown as boolean })
      ).resolves.toMatchObject({ esmsSource: 'fallback' })
    }
  })

  const corrupt: Array<[string, unknown, string]> = [
    ['a negative', { ...holdings(1, 2, 3, 4), matter: -3 }, 'matter'],
    ['NaN', { ...holdings(1, 2, 3, 4), spirit: Number.NaN }, 'spirit'],
    ['Infinity', { ...holdings(1, 2, 3, 4), essence: Number.POSITIVE_INFINITY }, 'essence'],
    ['a missing token', { spirit: 1, essence: 2, matter: 3 }, 'substance'],
    ['a non-numeric string', { ...holdings(1, 2, 3, 4), substance: 'lots' }, 'substance'],
  ]

  it.each(corrupt)(
    'non-strict: a ledger row with %s is a failed read, never clamped',
    async (_name, row, token) => {
      const { hook, calls } = recordingHook()
      const result = await resolveAgentEsmsBalances('unknown-agent', {
        loadLedger: loaderReturning(row as EsmsHoldings),
        onDegraded: hook,
      })
      expect(result.esmsSource).toBe('fallback')
      expect(result.degraded).toStrictEqual({ reason: 'ledger row invalid' })
      expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
      // Which token was corrupt is the log's business, not the reason's.
      expect(calls).toHaveLength(1)
      expect(calls[0][0]).toBe('ledger')
      expect(calls[0][1]).toContain(token)
    }
  )

  it.each(corrupt)(
    'strict: a ledger row with %s throws, caused by an EsmsValueError',
    async (_n, row) => {
      const error = await resolveAgentEsmsBalances(EINSTEIN, {
        strict: true,
        loadLedger: loaderReturning(row as EsmsHoldings),
      }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
      expect((error as EsmsLedgerUnavailableError).cause).toBeInstanceOf(EsmsValueError)
      expect((error as EsmsLedgerUnavailableError).cause).toBeInstanceOf(RangeError)
    }
  )

  it('the log gets the exact validator message for a corrupt row', async () => {
    const { hook, calls } = recordingHook()
    await resolveAgentEsmsBalances('unknown-agent', {
      loadLedger: loaderReturning({ ...holdings(1, 2, 3, 4), matter: -3 }),
      onDegraded: hook,
    })
    expect(calls).toStrictEqual([['ledger', 'Invalid matter balance: -3 is negative']])
  })

  it('a loader that throws our own EsmsValueError is a corrupt row, not an outage', async () => {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances('unknown-agent', {
      loadLedger: loaderThrowing(new EsmsValueError('Invalid spirit balance: -1 is negative')),
      onDegraded: hook,
    })
    expect(result.degraded).toStrictEqual({ reason: 'ledger row invalid' })
    expect(calls).toStrictEqual([['ledger', 'Invalid spirit balance: -1 is negative']])
  })

  describe('a RangeError that is not ours', () => {
    const foreign = () => new RangeError('Invalid string length while contacting ep-x.neon.tech')

    it('is an unavailable ledger, not an invalid row, and its text goes nowhere', async () => {
      const { hook, calls } = recordingHook()
      const result = await resolveAgentEsmsBalances('unknown-agent', {
        loadLedger: loaderThrowing(foreign()),
        onDegraded: hook,
      })
      expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
      expect(calls).toStrictEqual([['ledger', 'RangeError']])
      expect(JSON.stringify([result, calls])).not.toMatch(/neon|ep-x|string length/)
    })

    it('strict: still an EsmsLedgerUnavailableError, whose cause is the foreign error', async () => {
      const cause = foreign()
      const error = await resolveAgentEsmsBalances(EINSTEIN, {
        strict: true,
        loadLedger: loaderThrowing(cause),
      }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
      expect((error as EsmsLedgerUnavailableError).cause).toBe(cause)
      expect(cause).not.toBeInstanceOf(EsmsValueError)
    })

    it('is told apart by class, not by name: a RangeError named EsmsValueError is foreign', async () => {
      const spoof = Object.assign(new RangeError('Invalid string length at ep-x.neon.tech'), {
        name: 'EsmsValueError',
      })
      const { hook, calls } = recordingHook()
      const result = await resolveAgentEsmsBalances('unknown-agent', {
        loadLedger: loaderThrowing(spoof),
        onDegraded: hook,
      })
      expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
      // describeFailure trusts the class too, so the spoofed name is all the log learns.
      expect(calls).toStrictEqual([['ledger', 'EsmsValueError']])
    })
  })

  it('a hostile error object cannot change the answer or the reason', async () => {
    const hostile = new Error('boom')
    Object.defineProperty(hostile, 'name', {
      get() {
        throw new Error('hostile getter')
      },
    })
    const { hook } = recordingHook()
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderThrowing(hostile),
      onDegraded: hook,
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
  })
})

// ─── The onDegraded hook ─────────────────────────────────────────────────────

describe('onDegraded', () => {
  const ledger = holdings(1, 2, 3, 4)

  it('is not called when the live override answers', async () => {
    const { hook, calls } = recordingHook()
    await resolveAgentEsmsBalances(EINSTEIN, { spacetime: ledger, onDegraded: hook })
    expect(calls).toEqual([])
  })

  it('is not called when the ledger answers', async () => {
    const { hook, calls } = recordingHook()
    await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderReturning(ledger),
      onDegraded: hook,
    })
    expect(calls).toEqual([])
  })

  it('is not called for a clean "no ledger row" — nothing threw', async () => {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderReturning(null),
      onDegraded: hook,
    })
    expect(result.degraded).toStrictEqual({ reason: 'no ledger row' })
    expect(calls).toEqual([])
  })

  it('is called with the stage and the sanitised detail, as exactly two arguments', async () => {
    const { hook, calls } = recordingHook()
    await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderThrowing(new PrismaClientInitializationError()),
      onDegraded: hook,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toStrictEqual(['ledger', 'PrismaClientInitializationError (P1001)'])
  })

  describe('a wallet the policy keeps private is a decision, not a failure', () => {
    const einsteinElements = HISTORICAL_AGENTS.find(agent => agent.id === EINSTEIN)!.consciousness
      .alchemicalElements!

    it.each(['user-avatar-1', 'forged-vessel-1', 'agent-lumen-123'])(
      'is NOT called for %s: the reason, the baseline and the fallback label are unchanged',
      async vessel => {
        const { hook, calls } = recordingHook()
        const result = await resolveAgentEsmsBalances(vessel, {
          loadLedger: loaderThrowing(new CreatorWalletPrivateError(vessel)),
          onDegraded: hook,
        })
        expect(result).toStrictEqual({
          agentId: vessel,
          balances: holdings(0, 0, 0, 0),
          esmsSource: 'fallback',
          degraded: { reason: 'owner wallet is private' },
        })
        expect(calls).toEqual([])
      }
    )

    it('is NOT called for a denied vessel whose id is on the roster, which keeps its own baseline', async () => {
      const { hook, calls } = recordingHook()
      const result = await resolveAgentEsmsBalances(EINSTEIN, {
        loadLedger: loaderThrowing(new CreatorWalletPrivateError(EINSTEIN)),
        onDegraded: hook,
      })
      expect(result.esmsSource).toBe('fallback')
      expect(result.degraded).toStrictEqual({ reason: 'owner wallet is private' })
      expect(result.balances).toStrictEqual(
        holdings(
          einsteinElements.spirit,
          einsteinElements.essence,
          einsteinElements.matter,
          einsteinElements.substance
        )
      )
      expect(calls).toEqual([])
    })

    it('is told about every real failure at the same stage — one call each, detail intact', async () => {
      // The matrix: the same loader seat, one thrown value per row. Only the denial is silent.
      const rows: Array<[string, unknown, string, string]> = [
        [
          'a driver error',
          new PrismaClientInitializationError(),
          'ledger unavailable',
          'PrismaClientInitializationError (P1001)',
        ],
        ['a plain Error', new Error('boom'), 'ledger unavailable', 'Error'],
        ['a thrown string', 'boom', 'ledger unavailable', 'string'],
        [
          'our own validation error',
          new EsmsValueError('Invalid spirit balance: -1 is negative'),
          'ledger row invalid',
          'Invalid spirit balance: -1 is negative',
        ],
        [
          'a RangeError that is not ours',
          new RangeError('Invalid string length at ep-x.neon.tech'),
          'ledger unavailable',
          'RangeError',
        ],
      ]
      for (const [label, thrown, reason, detail] of rows) {
        const { hook, calls } = recordingHook()
        const result = await resolveAgentEsmsBalances('forged-vessel-1', {
          loadLedger: loaderThrowing(thrown),
          onDegraded: hook,
        })
        expect(result.degraded, label).toStrictEqual({ reason })
        expect(calls, label).toStrictEqual([['ledger', detail]])
      }
      const denied = recordingHook()
      const refused = await resolveAgentEsmsBalances('forged-vessel-1', {
        loadLedger: loaderThrowing(new CreatorWalletPrivateError('forged-vessel-1')),
        onDegraded: denied.hook,
      })
      expect(refused.degraded).toStrictEqual({ reason: 'owner wallet is private' })
      expect(denied.calls).toEqual([])
    })

    it('a corrupt row under a policy that DOES cover the wallet is still logged as invalid', async () => {
      const store = fakeStore({
        creators: { 'forged-vessel-1': 'creator-1' },
        rows: { 'creator-1': decimalRow('1', '-2', '3', '4') },
      })
      const loadLedger = createLedgerLoader(store, notRoster)
      const covered = recordingHook()
      const coveredResult = await resolveAgentEsmsBalances('forged-vessel-1', {
        loadLedger,
        creatorWallet: 'allow',
        onDegraded: covered.hook,
      })
      expect(coveredResult.degraded).toStrictEqual({ reason: 'ledger row invalid' })
      expect(covered.calls).toStrictEqual([['ledger', 'Invalid essence balance: -2 is negative']])
      // The very same row, under the default policy, is never read: so it is never judged.
      const refused = recordingHook()
      const refusedResult = await resolveAgentEsmsBalances('forged-vessel-1', {
        loadLedger,
        onDegraded: refused.hook,
      })
      expect(refusedResult.degraded).toStrictEqual({ reason: 'owner wallet is private' })
      expect(refused.calls).toEqual([])
    })

    it('is told by class, not by name: an Error merely NAMED CreatorWalletPrivateError is a failure', async () => {
      const spoof = Object.assign(new Error('boom'), { name: 'CreatorWalletPrivateError' })
      const { hook, calls } = recordingHook()
      const result = await resolveAgentEsmsBalances('forged-vessel-1', {
        loadLedger: loaderThrowing(spoof),
        onDegraded: hook,
      })
      expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
      expect(calls).toStrictEqual([['ledger', 'CreatorWalletPrivateError']])
    })

    it('a subclass of the denial is still a denial', async () => {
      class Narrower extends CreatorWalletPrivateError {}
      const { hook, calls } = recordingHook()
      const result = await resolveAgentEsmsBalances('forged-vessel-1', {
        loadLedger: loaderThrowing(new Narrower('forged-vessel-1')),
        onDegraded: hook,
      })
      expect(result.degraded).toStrictEqual({ reason: 'owner wallet is private' })
      expect(calls).toEqual([])
    })

    it('the denial wins over the invalid-row classification when an error would satisfy both', async () => {
      // Today the two classes are disjoint (pinned under "error classes"), so no real error is
      // both. If a refactor ever made them overlap, the policy decision must still take
      // precedence: a refusal reported as a corrupt row would be logged on every anonymous request.
      // Simulate the overlap with a temporary Symbol.hasInstance on EsmsValueError.
      const ordinary = Function.prototype[Symbol.hasInstance]
      Object.defineProperty(EsmsValueError, Symbol.hasInstance, {
        configurable: true,
        value(this: Function, candidate: unknown) {
          return ordinary.call(this, candidate) || candidate instanceof CreatorWalletPrivateError
        },
      })
      try {
        const denial = new CreatorWalletPrivateError('forged-vessel-1')
        expect(denial instanceof EsmsValueError).toBe(true) // the overlap is real
        const { hook, calls } = recordingHook()
        const result = await resolveAgentEsmsBalances('forged-vessel-1', {
          loadLedger: loaderThrowing(denial),
          onDegraded: hook,
        })
        expect(result.degraded).toStrictEqual({ reason: 'owner wallet is private' })
        expect(calls).toEqual([])
      } finally {
        Reflect.deleteProperty(EsmsValueError, Symbol.hasInstance)
      }
      expect(new CreatorWalletPrivateError('x') instanceof EsmsValueError).toBe(false)
    })

    it('the stages around a denial are still logged, and the reasons keep their order', async () => {
      const { hook, calls } = recordingHook()
      const result = await resolveAgentEsmsBalances('forged-vessel-1', {
        spacetime: holdings(Number.NaN, 0, 0, 0),
        loadLedger: loaderThrowing(new CreatorWalletPrivateError('forged-vessel-1')),
        onDegraded: hook,
      })
      expect(result.degraded).toStrictEqual({
        reason: 'spacetimedb holdings rejected; owner wallet is private',
      })
      expect(calls).toStrictEqual([
        [
          'spacetimedb',
          'Invalid spacetimedb spirit balance: NaN is not a finite non-negative number',
        ],
      ])
    })

    it('is not called in strict mode for a denial, which throws instead', async () => {
      const { hook, calls } = recordingHook()
      const error = await resolveAgentEsmsBalances('forged-vessel-1', {
        strict: true,
        loadLedger: loaderThrowing(new CreatorWalletPrivateError('forged-vessel-1')),
        onDegraded: hook,
      }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
      expect((error as EsmsLedgerUnavailableError).cause).toBeInstanceOf(CreatorWalletPrivateError)
      expect(calls).toEqual([])
    })
  })

  it('a hook that throws does not change the answer, at any stage', async () => {
    const exploding = () => {
      throw new Error('log sink down')
    }
    const plain = {
      spacetime: { ...ledger, spirit: -1 },
      loadLedger: loaderThrowing(new Error('x')),
    }
    const quiet = await resolveAgentEsmsBalances(EINSTEIN, plain)
    const loud = await resolveAgentEsmsBalances(EINSTEIN, { ...plain, onDegraded: exploding })
    expect(loud).toStrictEqual(quiet)
    expect(loud.degraded?.reason).toBe('spacetimedb holdings rejected; ledger unavailable')
    // The ledger stage alone, too.
    await expect(
      resolveAgentEsmsBalances(EINSTEIN, { loadLedger: loaderThrowing('x'), onDegraded: exploding })
    ).resolves.toMatchObject({ esmsSource: 'fallback', degraded: { reason: 'ledger unavailable' } })
  })

  it('a rejecting-by-throw hook returning a rejected promise is ignored (never awaited)', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderThrowing(new Error('x')),
      onDegraded: () => undefined,
    })
    expect(result.esmsSource).toBe('fallback')
  })

  it('is not called in strict mode, which throws instead of degrading', async () => {
    const { hook, calls } = recordingHook()
    await expect(
      resolveAgentEsmsBalances(EINSTEIN, {
        strict: true,
        loadLedger: loaderThrowing(new Error('x')),
        onDegraded: hook,
      })
    ).rejects.toBeInstanceOf(EsmsLedgerUnavailableError)
    expect(calls).toEqual([])
  })

  it('no ledger loader: the step fails like an unreadable ledger and says so to the log', async () => {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances(EINSTEIN, { onDegraded: hook })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
    expect(result.balances).toStrictEqual(await baselineEsmsHoldings(EINSTEIN))
    expect(calls).toStrictEqual([['ledger', 'Error']])
  })
})

// ─── What a corrupt value costs the log ──────────────────────────────────────

describe('the corrupt-value detail handed to onDegraded', () => {
  const MAX_RENDERED = 40
  const SECRET_TAIL = 'TAIL-SECRET-0123456789'
  const NOT_FINITE = ' is not a finite number'

  /** Resolve a vessel whose ledger row has `spirit = value`; return the one log call and the result. */
  async function logFor(value: unknown) {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances('unknown-agent', {
      loadLedger: loaderReturning({ ...holdings(1, 2, 3, 4), spirit: value } as EsmsHoldings),
      onDegraded: hook,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveLength(2)
    expect(calls[0][0]).toBe('ledger')
    return { detail: calls[0][1] as string, result }
  }

  it('prints a value of up to 40 characters whole — a string counts its two quotes', async () => {
    const fits = 'a'.repeat(38) // 38 + 2 quotes = 40
    const { detail, result } = await logFor(fits)
    expect(detail).toBe(`Invalid spirit balance: "${fits}"${NOT_FINITE}`)
    expect(result.degraded).toStrictEqual({ reason: 'ledger row invalid' })
  })

  it('cuts a 41st character: 37 characters of the value, then an ellipsis of three dots', async () => {
    const { detail } = await logFor('a'.repeat(39)) // 39 + 2 quotes = 41
    expect(detail).toBe(`Invalid spirit balance: "${'a'.repeat(36)}...${NOT_FINITE}`)
  })

  it('renders only the head of a very long value and none of its tail', async () => {
    const hostile = `${'a'.repeat(5000)}${SECRET_TAIL}`
    const { detail, result } = await logFor(hostile)
    expect(detail).toBe(`Invalid spirit balance: "${'a'.repeat(36)}...${NOT_FINITE}`)
    expect(detail).not.toContain(SECRET_TAIL)
    // The reason (the only thing an anonymous caller sees) carries no part of the value at all.
    expect(JSON.stringify(result)).not.toMatch(/aaa|TAIL|SECRET/)
    expect(result.degraded).toStrictEqual({ reason: 'ledger row invalid' })
  })

  it('never renders more than 40 characters of the value, for any length', async () => {
    for (let length = 0; length <= 120; length++) {
      const text = 'z'.repeat(length)
      const { detail } = await logFor(text)
      const rendered = /^Invalid spirit balance: (.*) is not a finite number$/s.exec(detail)?.[1]
      expect(rendered, `length ${length}`).toBeDefined()
      expect(rendered!.length, `length ${length}`).toBeLessThanOrEqual(MAX_RENDERED)
      const quoted = JSON.stringify(text)
      expect(rendered, `length ${length}`).toBe(
        quoted.length > MAX_RENDERED ? `${quoted.slice(0, 37)}...` : quoted
      )
    }
  })

  it('applies the same cut to the "is negative" message', async () => {
    const { detail } = await logFor(`-${'9'.repeat(60)}`) // a numeric string, negative
    expect(detail).toBe(`Invalid spirit balance: "-${'9'.repeat(35)}... is negative`)
  })

  it('cuts a non-string the same way, with no quotes to count', async () => {
    // An object whose text is long and not numeric.
    const long = { toString: () => 'n'.repeat(60) }
    expect((await logFor(long)).detail).toBe(
      `Invalid spirit balance: ${'n'.repeat(37)}...${NOT_FINITE}`
    )
    // Exactly 40 characters is printed whole; 41 is cut.
    expect((await logFor({ toString: () => 'n'.repeat(40) })).detail).toBe(
      `Invalid spirit balance: ${'n'.repeat(40)}${NOT_FINITE}`
    )
    expect((await logFor({ toString: () => 'n'.repeat(41) })).detail).toBe(
      `Invalid spirit balance: ${'n'.repeat(37)}...${NOT_FINITE}`
    )
    // A bigint too large to be a safe integer: 51 digits, cut to 37 + the ellipsis.
    const huge = BigInt(`1${'0'.repeat(50)}`)
    expect((await logFor(huge)).detail).toBe(
      `Invalid spirit balance: 1${'0'.repeat(36)}...${NOT_FINITE}`
    )
  })

  it('escapes what a string carries, so a value cannot add a line to the log', async () => {
    const forged = await logFor('first\nFORGED: ledger ok')
    expect(forged.detail).not.toMatch(/[\r\n]/)
    expect(forged.detail).toBe(`Invalid spirit balance: "first\\nFORGED: ledger ok"${NOT_FINITE}`)
    const quoted = await logFor('a\r"b"')
    expect(quoted.detail).not.toMatch(/[\r\n]/)
    expect(quoted.detail).toBe(`Invalid spirit balance: "a\\r\\"b\\""${NOT_FINITE}`)
  })

  it('prints what it cannot print as a placeholder, not an error', async () => {
    const { detail, result } = await logFor(Object.create(null))
    expect(detail).toBe(`Invalid spirit balance: <unprintable>${NOT_FINITE}`)
    expect(result.degraded).toStrictEqual({ reason: 'ledger row invalid' })
  })

  it('names the token and says what is wrong, for every token', async () => {
    for (const token of ESMS_TOKENS) {
      const { hook, calls } = recordingHook()
      await resolveAgentEsmsBalances('unknown-agent', {
        loadLedger: loaderReturning({
          ...holdings(1, 2, 3, 4),
          [token]: 'q'.repeat(80),
        } as unknown as EsmsHoldings),
        onDegraded: hook,
      })
      expect(calls).toStrictEqual([
        ['ledger', `Invalid ${token} balance: "${'q'.repeat(36)}...${NOT_FINITE}`],
      ])
    }
  })

  it('cuts a row that is not an object at the same place', async () => {
    const { hook, calls } = recordingHook()
    const result = await resolveAgentEsmsBalances('unknown-agent', {
      loadLedger: loaderReturning(`${'r'.repeat(100)}${SECRET_TAIL}` as unknown as EsmsHoldings),
      onDegraded: hook,
    })
    expect(result.degraded).toStrictEqual({ reason: 'ledger row invalid' })
    expect(calls).toStrictEqual([
      ['ledger', `Invalid ESMS holdings: "${'r'.repeat(36)}... is not an object`],
    ])
    expect(JSON.stringify([result, calls])).not.toContain(SECRET_TAIL)
  })

  it('cuts a live override the same way, at its own stage', async () => {
    const tail = `${'s'.repeat(100)}${SECRET_TAIL}`
    const field = recordingHook()
    await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: { ...holdings(1, 2, 3, 4), matter: tail as unknown as number },
      loadLedger: loaderReturning(holdings(5, 6, 7, 8)),
      onDegraded: field.hook,
    })
    expect(field.calls).toStrictEqual([
      [
        'spacetimedb',
        `Invalid spacetimedb matter balance: "${'s'.repeat(36)}... is not a finite non-negative number`,
      ],
    ])
    const whole = recordingHook()
    await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: tail as unknown as EsmsHoldings,
      loadLedger: loaderReturning(holdings(5, 6, 7, 8)),
      onDegraded: whole.hook,
    })
    expect(whole.calls).toStrictEqual([
      ['spacetimedb', `Invalid spacetimedb holdings: "${'s'.repeat(36)}... is not an object`],
    ])
    expect(JSON.stringify([field.calls, whole.calls])).not.toContain(SECRET_TAIL)
  })

  it('an EsmsValueError thrown by a loader is forwarded as its own message, whole', async () => {
    // The 40-character cut happens where a value is rendered; a message built elsewhere is the
    // thrower's to size, and describeFailure passes it through untouched.
    const message = `Invalid spirit balance: ${'m'.repeat(200)} is negative`
    const { hook, calls } = recordingHook()
    await resolveAgentEsmsBalances('unknown-agent', {
      loadLedger: loaderThrowing(new EsmsValueError(message)),
      onDegraded: hook,
    })
    expect(calls).toStrictEqual([['ledger', message]])
  })
})

// ─── No ledger configured ────────────────────────────────────────────────────

describe('no loadLedger', () => {
  it('non-strict: the baseline, marked fallback, reason "ledger unavailable"', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN)
    expect(result).toStrictEqual({
      agentId: EINSTEIN,
      balances: await baselineEsmsHoldings(EINSTEIN),
      esmsSource: 'fallback',
      degraded: { reason: 'ledger unavailable' },
    })
  })

  it('non-strict: an unknown id gets zeros, still labelled a fallback and never a database read', async () => {
    const result = await resolveAgentEsmsBalances('user-avatar-1')
    expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
  })

  it('strict: throws EsmsLedgerUnavailableError', async () => {
    const error = await resolveAgentEsmsBalances(EINSTEIN, { strict: true }).catch(
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
    expect((error as EsmsLedgerUnavailableError).agentId).toBe(EINSTEIN)
    expect((error as EsmsLedgerUnavailableError).cause).toBeInstanceOf(Error)
  })

  it('a valid live override still answers without one', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, { spacetime: holdings(1, 2, 3, 4) })
    expect(result.esmsSource).toBe('spacetimedb')
  })

  it('a rejected override plus no ledger keeps both reasons', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: holdings(Number.NaN, 0, 0, 0),
    })
    expect(result.degraded).toStrictEqual({
      reason: 'spacetimedb holdings rejected; ledger unavailable',
    })
  })

  it('the roster batch degrades each agent the same way, without a "resolution failed"', async () => {
    const results = await resolveRosterEsmsBalances([EINSTEIN, 'x'])
    expect(results.map(r => r.degraded)).toStrictEqual([
      { reason: 'ledger unavailable' },
      { reason: 'ledger unavailable' },
    ])
    await expect(resolveRosterEsmsBalances([EINSTEIN], { strict: true })).rejects.toBeInstanceOf(
      EsmsLedgerUnavailableError
    )
  })
})

// ─── Decimal handling ────────────────────────────────────────────────────────

describe('decimalToWholeTokens', () => {
  it('converts every supported shape to a number', () => {
    expect(decimalToWholeTokens(12.5)).toBe(12.5)
    expect(decimalToWholeTokens(decimal('3.1416'))).toBe(3.1416)
    expect(decimalToWholeTokens({ toNumber: () => 7 })).toBe(7)
    expect(decimalToWholeTokens({ toString: () => '2.5' })).toBe(2.5)
    expect(decimalToWholeTokens('0.0001')).toBe(0.0001)
    expect(decimalToWholeTokens(' 42 ')).toBe(42)
    expect(decimalToWholeTokens('1e3')).toBe(1000)
    expect(decimalToWholeTokens(BigInt(250))).toBe(250)
    expect(decimalToWholeTokens(new Number(8))).toBe(8)
  })

  it('reads the numeric text forms a ledger can print, and nothing else', () => {
    expect(decimalToWholeTokens('.5')).toBe(0.5)
    expect(decimalToWholeTokens('5.')).toBe(5)
    expect(decimalToWholeTokens('+7')).toBe(7)
    expect(decimalToWholeTokens('1E2')).toBe(100)
    expect(decimalToWholeTokens('2e+2')).toBe(200)
    expect(decimalToWholeTokens('0')).toBe(0)
    for (const text of ['1e', '--1', '1 2', '1,5', '1_000', '.', '+', 'e5', '5e5e5', '1.2.3']) {
      expect(() => decimalToWholeTokens(text), text).toThrow(EsmsValueError)
    }
  })

  it('normalises negative zero to zero', () => {
    expect(Object.is(decimalToWholeTokens(-0), 0)).toBe(true)
    expect(Object.is(decimalToWholeTokens(decimal('-0')), 0)).toBe(true)
  })

  const rejected: Array<[string, unknown]> = [
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['a negative number', -1],
    ['a tiny negative', -0.0001],
    ['a negative string', '-0.0001'],
    ['an empty string', ''],
    ['a blank string', '   '],
    ['a word', 'abc'],
    ['a hex string', '0x10'],
    ['the string Infinity', 'Infinity'],
    ['null', null],
    ['undefined', undefined],
    ['a boolean', true],
    ['a plain object', {}],
    ['an array', []],
    ['a one-element array', [5]],
    ['a Date', new Date(0)],
    ['a symbol', Symbol('x')],
    ['a decimal whose toNumber is NaN', { toNumber: () => Number.NaN }],
    ['a decimal whose toNumber is Infinity', { toNumber: () => Number.POSITIVE_INFINITY }],
    ['a decimal whose toNumber is negative', { toNumber: () => -2 }],
    [
      'a decimal whose toNumber throws',
      {
        toNumber: () => {
          throw new Error('x')
        },
      },
    ],
    ['a decimal-like with a non-numeric toString', { toString: () => 'NaN' }],
    ['a bigint beyond safe integers', BigInt(Number.MAX_SAFE_INTEGER) + BigInt(2)],
    ['a negative bigint', BigInt(-1)],
  ]

  it.each(rejected)('rejects %s with a RangeError', (_name, value) => {
    expect(() => decimalToWholeTokens(value)).toThrow(RangeError)
  })

  it.each(rejected)('rejects %s with our own EsmsValueError', (_name, value) => {
    expect(() => decimalToWholeTokens(value)).toThrow(EsmsValueError)
  })

  it('names the offending field in the message', () => {
    expect(() => decimalToWholeTokens(-1, 'matter balance')).toThrow(/matter balance/)
  })

  it('says why: not finite versus negative, and prints the value', () => {
    expect(() => decimalToWholeTokens(Number.NaN)).toThrow(
      'Invalid amount: NaN is not a finite number'
    )
    expect(() => decimalToWholeTokens(-5, 'spirit balance')).toThrow(
      'Invalid spirit balance: -5 is negative'
    )
    expect(() => decimalToWholeTokens('abc')).toThrow(
      'Invalid amount: "abc" is not a finite number'
    )
  })

  it('shortens long values in the message at 40 characters, and prints what it cannot print', () => {
    // 38 characters + two quotes = 40: printed whole.
    const fits = 'a'.repeat(38)
    expect(() => decimalToWholeTokens(fits)).toThrow(
      `Invalid amount: "${fits}" is not a finite number`
    )
    // One more character: cut to 37 characters + an ellipsis.
    const tooLong = 'a'.repeat(39)
    expect(() => decimalToWholeTokens(tooLong)).toThrow(
      `Invalid amount: "${'a'.repeat(36)}... is not a finite number`
    )
    // The cut is by code point: an astral character is never split into a lone surrogate.
    const astral = `a${'\u{1F600}'.repeat(60)}`
    let message = ''
    try {
      decimalToWholeTokens(astral, 'spirit balance')
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/\.\.\. is not a finite number$/)
    expect(message.isWellFormed()).toBe(true)
    expect(message).toBe(
      `Invalid spirit balance: "a${'\u{1F600}'.repeat(35)}... is not a finite number`
    )
    // A value whose string conversion itself throws.
    expect(() => decimalToWholeTokens(Object.create(null))).toThrow(
      'Invalid amount: <unprintable> is not a finite number'
    )
  })

  it('round-trips random 4-decimal-place amounts exactly (Decimal(12,4) range)', () => {
    const random = mulberry32(0xa1c4)
    for (let i = 0; i < 400; i++) {
      const whole = Math.floor(random() * 10 ** (1 + Math.floor(random() * 8)))
      const fraction = String(Math.floor(random() * 10000)).padStart(4, '0')
      const text = `${whole}.${fraction}`
      expect(decimalToWholeTokens(decimal(text))).toBe(Number(text))
      expect(decimalToWholeTokens(text)).toBe(Number(text))
    }
  })

  it('never returns anything but a finite, non-negative number or throws', () => {
    const random = mulberry32(7)
    const pool: unknown[] = [
      0,
      -0,
      1,
      -1,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '3',
      '-3',
      'x',
      null,
      undefined,
      {},
      decimal('1'),
      decimal('-1'),
      { toNumber: () => Number.NaN },
    ]
    for (let i = 0; i < 300; i++) {
      const value = pool[Math.floor(random() * pool.length)]
      try {
        const amount = decimalToWholeTokens(value)
        expect(Number.isFinite(amount)).toBe(true)
        expect(amount).toBeGreaterThanOrEqual(0)
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError)
      }
    }
  })
})

describe('error classes', () => {
  it('EsmsValueError is a RangeError with its own name and the message it was given', () => {
    const error = new EsmsValueError('Invalid spirit balance: -1 is negative')
    expect(error).toBeInstanceOf(RangeError)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('EsmsValueError')
    expect(error.message).toBe('Invalid spirit balance: -1 is negative')
  })

  it('a plain RangeError is not an EsmsValueError', () => {
    expect(new RangeError('x')).not.toBeInstanceOf(EsmsValueError)
  })

  it('CreatorWalletPrivateError is an Error (not a RangeError) naming the vessel and no owner', () => {
    const error = new CreatorWalletPrivateError('user-avatar-42')
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(RangeError)
    expect(error).not.toBeInstanceOf(EsmsValueError)
    expect(error.name).toBe('CreatorWalletPrivateError')
    expect(error.message).toBe('The wallet behind "user-avatar-42" is private')
  })

  it('EsmsLedgerUnavailableError is neither of those and keeps agent id and cause', () => {
    const cause = new CreatorWalletPrivateError('v')
    const error = new EsmsLedgerUnavailableError('v', cause)
    expect(error).not.toBeInstanceOf(CreatorWalletPrivateError)
    expect(error).not.toBeInstanceOf(RangeError)
    expect(error.agentId).toBe('v')
    expect(error.cause).toBe(cause)
  })
})

describe('parseEsmsHoldings', () => {
  it('converts a Prisma-shaped row of Decimals', () => {
    const parsed = parseEsmsHoldings(decimalRow('1.5000', '0.2500', '100', '0'))
    expect(parsed).toStrictEqual(holdings(1.5, 0.25, 100, 0))
    expect(Object.keys(parsed)).toEqual([...ESMS_TOKENS])
  })

  it('ignores extra fields and does not return the input', () => {
    const row = { ...holdings(1, 2, 3, 4), userId: 'u1', updatedAt: new Date(0) }
    const parsed = parseEsmsHoldings(row)
    expect(parsed).toStrictEqual(holdings(1, 2, 3, 4))
    expect(parsed).not.toBe(row)
  })

  it('names the first bad token', () => {
    expect(() => parseEsmsHoldings({ ...holdings(1, 2, 3, 4), essence: -1 })).toThrow(/essence/)
    expect(() => parseEsmsHoldings({ spirit: 1 })).toThrow(/essence/)
  })

  it('names the token as "<token> balance" and reports a missing one as undefined', () => {
    expect(() => parseEsmsHoldings({ spirit: 1, essence: 2, matter: 3 })).toThrow(
      'Invalid substance balance: undefined is not a finite number'
    )
    expect(() => parseEsmsHoldings(null)).toThrow('Invalid ESMS holdings: null is not an object')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 5],
    ['a string', 'x'],
    ['an empty array', []],
    ['an array of four numbers', [1, 2, 3, 4]],
  ])('rejects %s as a non-object', (_name, value) => {
    expect(() => parseEsmsHoldings(value)).toThrow(RangeError)
    expect(() => parseEsmsHoldings(value)).toThrow(EsmsValueError)
  })

  it('accepts Decimal-likes handed back by an injected loader', async () => {
    const loadLedger = vi.fn(async () => decimalRow('2.0001', '3', '0', '9.9999')) as unknown as (
      id: string
    ) => Promise<EsmsHoldings>
    const result = await resolveAgentEsmsBalances(EINSTEIN, { loadLedger })
    expect(result.esmsSource).toBe('database')
    expect(result.balances).toStrictEqual(holdings(2.0001, 3, 0, 9.9999))
    for (const token of ESMS_TOKENS) expect(typeof result.balances[token]).toBe('number')
  })
})

// ─── The baseline ────────────────────────────────────────────────────────────

describe('deterministic baseline', () => {
  const einstein = HISTORICAL_AGENTS.find(agent => agent.id === EINSTEIN)!
  const elements = einstein.consciousness.alchemicalElements!

  it('equals the roster agent’s own alchemicalElements, token by token', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, { loadLedger: loaderReturning(null) })
    expect(result.esmsSource).toBe('fallback')
    expect(result.balances.spirit).toBe(elements.spirit)
    expect(result.balances.essence).toBe(elements.essence)
    expect(result.balances.matter).toBe(elements.matter)
    expect(result.balances.substance).toBe(elements.substance)
    expect(Object.values(result.balances).some(value => value > 0)).toBe(true)
  })

  it('is identical for a throwing ledger and an empty one (same baseline, different reason)', async () => {
    const empty = await resolveAgentEsmsBalances(CARROLL, { loadLedger: loaderReturning(null) })
    const failed = await resolveAgentEsmsBalances(CARROLL, {
      loadLedger: loaderThrowing(new Error('x')),
    })
    expect(failed.balances).toStrictEqual(empty.balances)
    expect(failed.degraded?.reason).not.toBe(empty.degraded?.reason)
  })

  it('is all zeros for an unknown id, a user vessel and a prototype-chain name', async () => {
    for (const id of [
      'definitely-not-an-agent',
      'user-avatar-abc123',
      'constructor',
      '__proto__',
    ]) {
      const result = await resolveAgentEsmsBalances(id, { loadLedger: loaderReturning(null) })
      expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
      expect(result.esmsSource).toBe('fallback')
    }
  })

  it('matches the roster by exact id only', async () => {
    expect(await baselineEsmsHoldings('Albert-Einstein')).toStrictEqual(holdings(0, 0, 0, 0))
    expect(await baselineEsmsHoldings(` ${EINSTEIN}`)).toStrictEqual(holdings(0, 0, 0, 0))
  })

  it('returns a fresh object each call, so callers cannot corrupt the roster', async () => {
    const first = await baselineEsmsHoldings(EINSTEIN)
    first.spirit = 12345
    const second = await baselineEsmsHoldings(EINSTEIN)
    expect(second.spirit).toBe(elements.spirit)
    expect(einstein.consciousness.alchemicalElements!.spirit).toBe(elements.spirit)
  })

  it('is valid for every roster agent and caps every Seal at Copper by design', async () => {
    const maxedStats = Object.fromEntries(CORE_STAT_KEYS.map(key => [key, 100])) as CoreStats
    let nonZero = 0
    for (const agent of HISTORICAL_AGENTS) {
      const baseline = await baselineEsmsHoldings(agent.id)
      const expected = agent.consciousness.alchemicalElements
      for (const token of ESMS_TOKENS) {
        expect(Number.isFinite(baseline[token])).toBe(true)
        expect(baseline[token]).toBeGreaterThanOrEqual(0)
        // Strictly below the Silver balance gate: the baseline can never buy more than Copper.
        expect(baseline[token]).toBeLessThan(SEAL_TIER_REQUIREMENTS.Silver.minBalance)
        expect(baseline[token]).toBe(expected?.[token] ?? 0)
      }
      if (Object.values(baseline).some(value => value > 0)) nonZero++
      const seals = evaluateSeals({ stats: maxedStats, esmsBalances: baseline })
      for (const seal of seals) expect([null, 'Copper']).toContain(seal.tier)
    }
    expect(nonZero).toBe(HISTORICAL_AGENTS.length)
  })

  it('holdingsFromAlchemicalElements zeroes anything missing or invalid, all-or-nothing', () => {
    expect(
      holdingsFromAlchemicalElements({ spirit: 0.5, essence: 0.6, matter: 0.7, substance: 0.8 })
    ).toStrictEqual(holdings(0.5, 0.6, 0.7, 0.8))
    const zeros = holdings(0, 0, 0, 0)
    expect(holdingsFromAlchemicalElements(undefined)).toStrictEqual(zeros)
    expect(holdingsFromAlchemicalElements(null)).toStrictEqual(zeros)
    expect(
      holdingsFromAlchemicalElements({ spirit: 0.5, essence: 0.6, matter: 0.7 })
    ).toStrictEqual(zeros)
    expect(
      holdingsFromAlchemicalElements({ spirit: 0.5, essence: -1, matter: 0.7, substance: 0.8 })
    ).toStrictEqual(zeros)
  })

  it('feeds evaluateSeals without throwing for every source', async () => {
    const stats = Object.fromEntries(CORE_STAT_KEYS.map(key => [key, 80])) as CoreStats
    for (const options of [
      { spacetime: holdings(1, 2, 3, 4) },
      { loadLedger: loaderReturning(holdings(5, 6, 7, 8)) },
      { loadLedger: loaderReturning(null) },
      { loadLedger: loaderThrowing(new Error('x')) },
    ]) {
      const { balances } = await resolveAgentEsmsBalances(EINSTEIN, options)
      expect(() => evaluateSeals({ stats, esmsBalances: balances })).not.toThrow()
    }
  })

  describe('when the roster itself cannot be imported', () => {
    const tinyRoster = {
      HISTORICAL_AGENTS: [
        {
          id: 'tiny-roster-agent',
          consciousness: {
            alchemicalElements: { spirit: 0.5, essence: 0.6, matter: 0.7, substance: 0.8 },
          },
        },
      ],
    }

    it('degrades with "baseline unavailable", logs the stage, and retries on the next call', async () => {
      let attempts = 0
      vi.resetModules()
      vi.doMock('@/lib/agents/historical', () => {
        attempts++
        if (attempts === 1) throw new Error('roster boom')
        return tinyRoster
      })
      try {
        const fresh = await import('@/lib/agents/rating/esms-balance-resolver')
        const loadLedger = loaderReturning(null)
        const { hook, calls } = recordingHook()
        const first = await fresh.resolveAgentEsmsBalances('tiny-roster-agent', {
          loadLedger,
          onDegraded: hook,
        })
        expect(first.esmsSource).toBe('fallback')
        expect(first.balances).toStrictEqual(holdings(0, 0, 0, 0))
        expect(first.degraded).toStrictEqual({ reason: 'no ledger row; baseline unavailable' })
        expect(calls).toStrictEqual([['baseline', 'Error']])
        // A failed import is not cached: the second call imports again and succeeds.
        await expect(
          fresh.resolveAgentEsmsBalances('tiny-roster-agent', { loadLedger, strict: true })
        ).resolves.toMatchObject({ balances: holdings(0.5, 0.6, 0.7, 0.8) })
        expect(attempts).toBe(2)
      } finally {
        vi.doUnmock('@/lib/agents/historical')
        vi.resetModules()
      }
    })

    it('strict: the roster failure itself is thrown, not wrapped and not swallowed', async () => {
      vi.resetModules()
      vi.doMock('@/lib/agents/historical', () => {
        throw new Error('roster boom')
      })
      try {
        const fresh = await import('@/lib/agents/rating/esms-balance-resolver')
        const error = await fresh
          .resolveAgentEsmsBalances('tiny-roster-agent', {
            loadLedger: loaderReturning(null),
            strict: true,
          })
          .catch((e: unknown) => e)
        // Vitest rewraps a throwing mock factory, so the message is not ours to assert on;
        // what matters is that a real Error escaped, and that it is not the ledger's wrapper.
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(fresh.EsmsLedgerUnavailableError)
        expect(error).not.toHaveProperty('balances')
      } finally {
        vi.doUnmock('@/lib/agents/historical')
        vi.resetModules()
      }
    })

    it('every failed step keeps its own fixed reason, joined in order with "; "', async () => {
      vi.resetModules()
      vi.doMock('@/lib/agents/historical', () => {
        throw new Error('roster boom')
      })
      try {
        const fresh = await import('@/lib/agents/rating/esms-balance-resolver')
        const { hook, calls } = recordingHook()
        const result = await fresh.resolveAgentEsmsBalances('tiny-roster-agent', {
          spacetime: holdings(Number.NaN, 0, 0, 0),
          loadLedger: loaderThrowing(new Error('x')),
          onDegraded: hook,
        })
        expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
        expect(result.esmsSource).toBe('fallback')
        expect(result.degraded).toStrictEqual({
          reason: 'spacetimedb holdings rejected; ledger unavailable; baseline unavailable',
        })
        expect(calls.map(call => call[0])).toEqual(['spacetimedb', 'ledger', 'baseline'])
        expect(calls[2]).toStrictEqual(['baseline', 'Error'])
        // A throwing hook changes nothing here either.
        const loud = await fresh.resolveAgentEsmsBalances('tiny-roster-agent', {
          spacetime: holdings(Number.NaN, 0, 0, 0),
          loadLedger: loaderThrowing(new Error('x')),
          onDegraded: () => {
            throw new Error('log sink down')
          },
        })
        expect(loud).toStrictEqual(result)
      } finally {
        vi.doUnmock('@/lib/agents/historical')
        vi.resetModules()
      }
    })

    it('the default loader fails like an unreadable ledger when the roster cannot say who is on it', async () => {
      vi.resetModules()
      vi.doMock('@/lib/agents/historical', () => {
        throw new Error('roster boom')
      })
      try {
        const fresh = await import('@/lib/agents/rating/esms-balance-resolver')
        const store = fakeStore({
          agentic: { 'some-agent@agentic.alchm.kitchen': 'u1' },
          rows: { u1: decimalRow('1', '1', '1', '1') },
        })
        const result = await fresh.resolveAgentEsmsBalances('some-agent', {
          loadLedger: fresh.createLedgerLoader(store),
        })
        expect(result.esmsSource).toBe('fallback')
        expect(result.degraded).toStrictEqual({
          reason: 'ledger unavailable; baseline unavailable',
        })
        expect(store.findBalanceRow).not.toHaveBeenCalled()
      } finally {
        vi.doUnmock('@/lib/agents/historical')
        vi.resetModules()
      }
    })
  })

  describe('the roster load is cached only once it has produced a roster', () => {
    const GOOD_ID = 'tiny-roster-agent'
    const goodRoster = () => ({
      HISTORICAL_AGENTS: [
        {
          id: GOOD_ID,
          consciousness: {
            alchemicalElements: { spirit: 0.5, essence: 0.6, matter: 0.7, substance: 0.8 },
          },
        },
      ],
    })
    const GOOD_BASELINE = holdings(0.5, 0.6, 0.7, 0.8)
    type Fresh = typeof resolverModule

    /**
     * Re-import the resolver against a roster module, counting how often the roster is imported.
     * `factory(attempt)` builds the module for the Nth import. Vitest caches a RESOLVED mock (and
     * `vi.resetModules()` keeps its mock cache), so `again()` registers the mock afresh, which
     * evicts the cached module: the next `import()` runs the factory again. The resolver's own
     * state (`rosterElements`) is untouched by it, which is the point.
     */
    async function withRoster(
      factory: (attempt: number) => unknown,
      body: (fresh: Fresh, imports: () => number, again: () => void) => Promise<void>
    ) {
      let attempts = 0
      const register = () => vi.doMock('@/lib/agents/historical', async () => factory(++attempts))
      vi.resetModules()
      register()
      try {
        const fresh = await import('@/lib/agents/rating/esms-balance-resolver')
        expect(attempts).toBe(0) // lazily: nothing imports the roster until a baseline is asked for
        await body(fresh, () => attempts, register)
      } finally {
        vi.doUnmock('@/lib/agents/historical')
        vi.resetModules()
      }
    }

    it('imports the roster lazily, once, and serves every later call from the one load', async () => {
      await withRoster(goodRoster, async (fresh, imports) => {
        for (let call = 0; call < 5; call++) {
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).resolves.toStrictEqual(GOOD_BASELINE)
        }
        await expect(fresh.baselineEsmsHoldings('someone-else')).resolves.toStrictEqual(
          holdings(0, 0, 0, 0)
        )
        await fresh.resolveAgentEsmsBalances(GOOD_ID, { loadLedger: async () => null })
        await fresh.resolveRosterEsmsBalances([GOOD_ID, 'x', GOOD_ID], {
          loadLedger: async () => null,
        })
        const store = fakeStore({
          agentic: { [`${GOOD_ID}@agentic.alchm.kitchen`]: 'u1' },
          rows: { u1: decimalRow('1', '2', '3', '4') },
        })
        // The default loader asks the same roster who is on it: the same single load.
        await expect(fresh.createLedgerLoader(store)(GOOD_ID)).resolves.toStrictEqual(
          holdings(1, 2, 3, 4)
        )
        expect(imports()).toBe(1)
      })
    })

    it('callers racing the first load share it instead of starting their own', async () => {
      await withRoster(goodRoster, async (fresh, imports) => {
        const balances = await Promise.all(
          Array.from({ length: 6 }, () => fresh.baselineEsmsHoldings(GOOD_ID))
        )
        for (const balance of balances) expect(balance).toStrictEqual(GOOD_BASELINE)
        // …and each caller still gets its own object back.
        expect(new Set(balances).size).toBe(6)
        expect(imports()).toBe(1)
      })
    })

    it('retries after a roster module that RESOLVED but is malformed — baselineEsmsHoldings', async () => {
      await withRoster(
        attempt => (attempt === 1 ? { HISTORICAL_AGENTS: undefined } : goodRoster()),
        async (fresh, imports, again) => {
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).rejects.toThrow(TypeError)
          expect(imports()).toBe(1)
          again()
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).resolves.toStrictEqual(GOOD_BASELINE)
          expect(imports()).toBe(2)
          // Now it IS a roster, so it is cached for good.
          again()
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).resolves.toStrictEqual(GOOD_BASELINE)
          await expect(fresh.baselineEsmsHoldings('nobody')).resolves.toStrictEqual(
            holdings(0, 0, 0, 0)
          )
          expect(imports()).toBe(2)
        }
      )
    })

    it('retries after a roster with a malformed agent entry, too (the throw is inside the map)', async () => {
      await withRoster(
        attempt =>
          attempt === 1 ? { HISTORICAL_AGENTS: [{ id: 'no-consciousness-block' }] } : goodRoster(),
        async (fresh, imports, again) => {
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).rejects.toThrow(TypeError)
          again()
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).resolves.toStrictEqual(GOOD_BASELINE)
          expect(imports()).toBe(2)
        }
      )
    })

    it('a malformed roster is never served as an empty one: no zeros, no cached emptiness', async () => {
      await withRoster(
        attempt => (attempt === 1 ? { HISTORICAL_AGENTS: null } : goodRoster()),
        async (fresh, imports, again) => {
          // The first call must reject rather than answer "nobody is on the roster": a roster agent
          // would then be mistaken for a forged vessel and its baseline read as zeros.
          const first = await fresh.baselineEsmsHoldings(GOOD_ID).then(
            value => ({ value }),
            (error: unknown) => ({ error })
          )
          expect(first).toHaveProperty('error')
          again()
          const second = await fresh.baselineEsmsHoldings(GOOD_ID)
          expect(second).toStrictEqual(GOOD_BASELINE)
          expect(imports()).toBe(2)
        }
      )
    })

    it('retries after a rejected import, too', async () => {
      await withRoster(
        attempt => {
          if (attempt === 1) throw new Error('roster boom')
          return goodRoster()
        },
        async (fresh, imports) => {
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).rejects.toThrow()
          expect(imports()).toBe(1)
          // A throwing factory is not cached by the registry: no `again()` needed.
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).resolves.toStrictEqual(GOOD_BASELINE)
          expect(imports()).toBe(2)
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).resolves.toStrictEqual(GOOD_BASELINE)
          expect(imports()).toBe(2)
        }
      )
    })

    it('keeps retrying for as long as the roster stays unusable, one fresh load per call', async () => {
      await withRoster(
        attempt => (attempt <= 3 ? { HISTORICAL_AGENTS: undefined } : goodRoster()),
        async (fresh, imports, again) => {
          for (let call = 1; call <= 3; call++) {
            await expect(fresh.baselineEsmsHoldings(GOOD_ID)).rejects.toThrow(TypeError)
            expect(imports()).toBe(call)
            again()
          }
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).resolves.toStrictEqual(GOOD_BASELINE)
          expect(imports()).toBe(4)
        }
      )
    })

    it('callers racing a malformed load all fail together, and the next call starts a new one', async () => {
      await withRoster(
        attempt => (attempt === 1 ? { HISTORICAL_AGENTS: undefined } : goodRoster()),
        async (fresh, imports, again) => {
          const settled = await Promise.allSettled(
            Array.from({ length: 4 }, () => fresh.baselineEsmsHoldings(GOOD_ID))
          )
          expect(settled.map(entry => entry.status)).toEqual(Array(4).fill('rejected'))
          expect(imports()).toBe(1)
          again()
          await expect(fresh.baselineEsmsHoldings(GOOD_ID)).resolves.toStrictEqual(GOOD_BASELINE)
          expect(imports()).toBe(2)
        }
      )
    })

    it('resolveAgentEsmsBalances: a malformed roster is "baseline unavailable" once, then it recovers', async () => {
      await withRoster(
        attempt => (attempt === 1 ? { HISTORICAL_AGENTS: undefined } : goodRoster()),
        async (fresh, imports, again) => {
          const loadLedger = loaderReturning(null)
          const { hook, calls } = recordingHook()
          const first = await fresh.resolveAgentEsmsBalances(GOOD_ID, {
            loadLedger,
            onDegraded: hook,
          })
          expect(first).toStrictEqual({
            agentId: GOOD_ID,
            balances: holdings(0, 0, 0, 0),
            esmsSource: 'fallback',
            degraded: { reason: 'no ledger row; baseline unavailable' },
          })
          expect(calls).toStrictEqual([['baseline', 'TypeError']])
          again()
          const second = await fresh.resolveAgentEsmsBalances(GOOD_ID, { loadLedger })
          expect(second).toStrictEqual({
            agentId: GOOD_ID,
            balances: GOOD_BASELINE,
            esmsSource: 'fallback',
            degraded: { reason: 'no ledger row' },
          })
          expect(imports()).toBe(2)
        }
      )
    })

    it('strict: a malformed roster rejects with its own TypeError, then the next call recovers', async () => {
      await withRoster(
        attempt => (attempt === 1 ? { HISTORICAL_AGENTS: undefined } : goodRoster()),
        async (fresh, imports, again) => {
          const loadLedger = loaderReturning(null)
          const error = await fresh
            .resolveAgentEsmsBalances(GOOD_ID, { loadLedger, strict: true })
            .catch((e: unknown) => e)
          expect(error).toBeInstanceOf(TypeError)
          expect(error).not.toBeInstanceOf(fresh.EsmsLedgerUnavailableError)
          again()
          await expect(
            fresh.resolveAgentEsmsBalances(GOOD_ID, { loadLedger, strict: true })
          ).resolves.toMatchObject({ balances: GOOD_BASELINE })
          expect(imports()).toBe(2)
        }
      )
    })

    it('the default loader shares the retry: a malformed roster fails the read, the next one succeeds', async () => {
      await withRoster(
        attempt => (attempt === 1 ? { HISTORICAL_AGENTS: undefined } : goodRoster()),
        async (fresh, imports, again) => {
          const store = fakeStore({
            agentic: { [`${GOOD_ID}@agentic.alchm.kitchen`]: 'u1' },
            rows: { u1: decimalRow('9', '8', '7', '6') },
          })
          const loader = fresh.createLedgerLoader(store)
          await expect(loader(GOOD_ID)).rejects.toThrow(TypeError)
          expect(store.findBalanceRow).not.toHaveBeenCalled()
          again()
          await expect(loader(GOOD_ID)).resolves.toStrictEqual(holdings(9, 8, 7, 6))
          expect(imports()).toBe(2)
        }
      )
    })

    it('a denial and a malformed roster: the denial stays silent, the roster failure is logged', async () => {
      await withRoster(
        attempt => (attempt === 1 ? { HISTORICAL_AGENTS: undefined } : goodRoster()),
        async (fresh, _imports, again) => {
          const denied = () => loaderThrowing(new fresh.CreatorWalletPrivateError('user-avatar-1'))
          const { hook, calls } = recordingHook()
          const first = await fresh.resolveAgentEsmsBalances('user-avatar-1', {
            loadLedger: denied(),
            onDegraded: hook,
          })
          expect(first.degraded).toStrictEqual({
            reason: 'owner wallet is private; baseline unavailable',
          })
          expect(calls).toStrictEqual([['baseline', 'TypeError']])
          again()
          const quiet = recordingHook()
          const second = await fresh.resolveAgentEsmsBalances('user-avatar-1', {
            loadLedger: denied(),
            onDegraded: quiet.hook,
          })
          expect(second).toStrictEqual({
            agentId: 'user-avatar-1',
            balances: holdings(0, 0, 0, 0),
            esmsSource: 'fallback',
            degraded: { reason: 'owner wallet is private' },
          })
          expect(quiet.calls).toEqual([])
        }
      )
    })
  })
})

// ─── Roster batch ────────────────────────────────────────────────────────────

describe('resolveRosterEsmsBalances', () => {
  /** A loader whose reads stay in flight until the test releases them. */
  function gatedLoader() {
    let inFlight = 0
    let maxInFlight = 0
    const started: string[] = []
    const pending: Array<() => void> = []
    const loadLedger = (agentId: string) =>
      new Promise<EsmsHoldings | null>(resolve => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        started.push(agentId)
        const marker = Number(agentId.replace(/\D/g, ''))
        pending.push(() => {
          inFlight--
          resolve(holdings(marker, 0, 0, 0))
        })
      })
    return {
      loadLedger,
      started,
      get inFlight() {
        return inFlight
      },
      get maxInFlight() {
        return maxInFlight
      },
      get pending() {
        return pending.length
      },
      /** Release the most recently started read first, to scramble completion order. */
      releaseNewest() {
        pending.pop()?.()
      },
    }
  }

  const ids = (count: number) => Array.from({ length: count }, (_, i) => `agent-${i}`)

  /** A `spacetime` map whose every property access throws: preparing any agent fails. */
  const hostileMap = () =>
    new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('hostile map')
        },
        has() {
          throw new Error('hostile map')
        },
      }
    )

  it('preserves input order when reads finish in a different order', async () => {
    const gate = gatedLoader()
    const batch = resolveRosterEsmsBalances(ids(6), { loadLedger: gate.loadLedger, concurrency: 3 })
    await tick()
    while (gate.pending > 0 || gate.started.length < 6) {
      gate.releaseNewest()
      await tick()
    }
    const results = await batch
    expect(results.map(r => r.agentId)).toEqual(ids(6))
    expect(results.map(r => r.balances.spirit)).toEqual([0, 1, 2, 3, 4, 5])
    expect(results.every(r => r.esmsSource === 'database')).toBe(true)
  })

  it('never exceeds the requested concurrency, and uses all of it', async () => {
    const gate = gatedLoader()
    const batch = resolveRosterEsmsBalances(ids(10), {
      loadLedger: gate.loadLedger,
      concurrency: 3,
    })
    await tick()
    expect(gate.inFlight).toBe(3)
    expect(gate.started).toEqual(['agent-0', 'agent-1', 'agent-2'])
    gate.releaseNewest()
    await tick()
    expect(gate.inFlight).toBe(3)
    expect(gate.started).toHaveLength(4)
    while (gate.pending > 0 || gate.started.length < 10) {
      gate.releaseNewest()
      await tick()
    }
    await batch
    expect(gate.maxInFlight).toBe(3)
    expect(gate.started).toHaveLength(10)
  })

  it(`defaults to ${ESMS_ROSTER_CONCURRENCY} concurrent reads`, async () => {
    expect(ESMS_ROSTER_CONCURRENCY).toBe(8)
    const gate = gatedLoader()
    const batch = resolveRosterEsmsBalances(ids(30), { loadLedger: gate.loadLedger })
    await tick()
    expect(gate.inFlight).toBe(8)
    while (gate.pending > 0 || gate.started.length < 30) {
      gate.releaseNewest()
      await tick()
    }
    await batch
    expect(gate.maxInFlight).toBe(8)
  })

  it('runs serially at concurrency 1', async () => {
    const gate = gatedLoader()
    const batch = resolveRosterEsmsBalances(ids(4), { loadLedger: gate.loadLedger, concurrency: 1 })
    await tick()
    expect(gate.inFlight).toBe(1)
    while (gate.pending > 0 || gate.started.length < 4) {
      gate.releaseNewest()
      await tick()
    }
    await batch
    expect(gate.maxInFlight).toBe(1)
  })

  it('returns an empty list for no ids without touching the ledger', async () => {
    const loadLedger = loaderReturning(holdings(1, 1, 1, 1))
    await expect(resolveRosterEsmsBalances([], { loadLedger })).resolves.toEqual([])
    expect(loadLedger).not.toHaveBeenCalled()
  })

  it('non-strict: one failing agent degrades alone and never rejects the batch', async () => {
    const loadLedger = vi.fn(async (agentId: string) => {
      if (agentId === 'agent-1') throw new Error('timeout')
      if (agentId === 'agent-3') return null
      return holdings(1, 2, 3, 4)
    })
    const results = await resolveRosterEsmsBalances(ids(5), { loadLedger, concurrency: 2 })
    expect(results.map(r => r.esmsSource)).toEqual([
      'database',
      'fallback',
      'database',
      'fallback',
      'database',
    ])
    expect(results[1].degraded).toStrictEqual({ reason: 'ledger unavailable' })
    expect(results[3].degraded).toStrictEqual({ reason: 'no ledger row' })
    expect(results[0].degraded).toBeUndefined()
  })

  it('non-strict: survives an unexpected throw while preparing one agent', async () => {
    const results = await resolveRosterEsmsBalances(['a', 'b'], {
      spacetime: hostileMap(),
      loadLedger: loaderReturning(holdings(1, 1, 1, 1)),
    })
    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(result.esmsSource).toBe('fallback')
      expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
      expect(result.degraded).toStrictEqual({ reason: 'resolution failed' })
    }
    expect(results.map(r => r.agentId)).toEqual(['a', 'b'])
  })

  it('"resolution failed" logs the stage and class only, and a throwing hook changes nothing', async () => {
    const { hook, calls } = recordingHook()
    const quiet = await resolveRosterEsmsBalances(['a', 'b'], {
      spacetime: hostileMap(),
      loadLedger: loaderReturning(holdings(1, 1, 1, 1)),
      onDegraded: hook,
    })
    expect(calls).toStrictEqual([
      ['ledger', 'Error'],
      ['ledger', 'Error'],
    ])
    expect(JSON.stringify([quiet, calls])).not.toContain('hostile map')
    const loud = await resolveRosterEsmsBalances(['a', 'b'], {
      spacetime: hostileMap(),
      loadLedger: loaderReturning(holdings(1, 1, 1, 1)),
      onDegraded: () => {
        throw new Error('log sink down')
      },
    })
    expect(loud).toStrictEqual(quiet)
  })

  it('strict: a failure while preparing an agent rejects with that failure, unwrapped', async () => {
    const { hook, calls } = recordingHook()
    const error = await resolveRosterEsmsBalances(['a', 'b'], {
      spacetime: hostileMap(),
      loadLedger: loaderReturning(holdings(1, 1, 1, 1)),
      strict: true,
      onDegraded: hook,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('hostile map')
    expect(calls).toEqual([])
  })

  it('strict: rejects with the first failure and starts no further reads', async () => {
    const calls: string[] = []
    const loadLedger = vi.fn(async (agentId: string) => {
      calls.push(agentId)
      if (agentId === 'b') throw new Error('down')
      return holdings(1, 1, 1, 1)
    })
    const error = await resolveRosterEsmsBalances(['a', 'b', 'c', 'd', 'e'], {
      loadLedger,
      concurrency: 1,
      strict: true,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
    expect((error as EsmsLedgerUnavailableError).agentId).toBe('b')
    expect(calls).toEqual(['a', 'b'])
  })

  it('strict: lets in-flight reads settle before rejecting (no dangling work)', async () => {
    let finished = 0
    const loadLedger = async (agentId: string) => {
      if (agentId === 'a') throw new Error('first')
      await tick()
      finished++
      return holdings(1, 1, 1, 1)
    }
    await expect(
      resolveRosterEsmsBalances(['a', 'b', 'c'], { loadLedger, concurrency: 3, strict: true })
    ).rejects.toBeInstanceOf(EsmsLedgerUnavailableError)
    expect(finished).toBe(2)
  })

  it('strict: once any read has failed, no worker starts another, even a worker that was still busy', async () => {
    const started: string[] = []
    const loadLedger = vi.fn(async (agentId: string) => {
      started.push(agentId)
      if (agentId === 'a') throw new Error('fast failure')
      // 'b' is still in flight when 'a' fails; when it finishes it must not pick up 'c' or 'd'.
      await tick()
      await tick()
      return holdings(1, 1, 1, 1)
    })
    await expect(
      resolveRosterEsmsBalances(['a', 'b', 'c', 'd'], { loadLedger, concurrency: 2, strict: true })
    ).rejects.toBeInstanceOf(EsmsLedgerUnavailableError)
    expect(started).toEqual(['a', 'b'])
  })

  it('non-strict: a failure on one worker does not stop another from finishing the list', async () => {
    const started: string[] = []
    const loadLedger = vi.fn(async (agentId: string) => {
      started.push(agentId)
      if (agentId === 'a') throw new Error('fast failure')
      await tick()
      return holdings(1, 1, 1, 1)
    })
    const results = await resolveRosterEsmsBalances(['a', 'b', 'c', 'd'], {
      loadLedger,
      concurrency: 2,
    })
    expect(started.sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(results.map(r => r.esmsSource)).toEqual(['fallback', 'database', 'database', 'database'])
  })

  it('strict: the first failure wins even when several reads fail', async () => {
    const loadLedger = vi.fn(async (agentId: string) => {
      await tick()
      throw new Error(`down ${agentId}`)
    })
    const error = await resolveRosterEsmsBalances(['a', 'b', 'c'], {
      loadLedger,
      concurrency: 3,
      strict: true,
    }).catch((e: unknown) => e)
    expect((error as EsmsLedgerUnavailableError).agentId).toBe('a')
  })

  it('takes per-agent SpacetimeDB holdings by own key only', async () => {
    const loadLedger = loaderReturning(holdings(9, 9, 9, 9))
    const results = await resolveRosterEsmsBalances(['a', 'constructor', 'toString', 'b'], {
      spacetime: { a: holdings(1, 1, 1, 1), b: null },
      loadLedger,
    })
    expect(results.map(r => r.esmsSource)).toEqual([
      'spacetimedb',
      'database',
      'database',
      'database',
    ])
    // 'constructor' / 'toString' are prototype names, not map entries: nothing was rejected.
    expect(results[1].degraded).toBeUndefined()
    expect(results[2].degraded).toBeUndefined()
    expect(loadLedger).toHaveBeenCalledTimes(3)
  })

  it('a rejected override for one agent degrades only that agent', async () => {
    const results = await resolveRosterEsmsBalances(['a', 'b'], {
      spacetime: { a: holdings(1, 1, 1, Number.NaN) },
      loadLedger: loaderReturning(holdings(5, 5, 5, 5)),
    })
    expect(results[0].esmsSource).toBe('database')
    expect(results[0].degraded).toStrictEqual({ reason: 'spacetimedb holdings rejected' })
    expect(results[1].degraded).toBeUndefined()
  })

  it('validates concurrency', async () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        resolveRosterEsmsBalances(['a'], { loadLedger: loaderReturning(null), concurrency: bad })
      ).rejects.toThrow(RangeError)
    }
  })

  it('rejects a malformed id before any read starts', async () => {
    const loadLedger = loaderReturning(holdings(1, 1, 1, 1))
    await expect(resolveRosterEsmsBalances(['a', ''], { loadLedger })).rejects.toThrow(TypeError)
    await expect(
      resolveRosterEsmsBalances(['a', ' '], { loadLedger, strict: true })
    ).rejects.toThrow(TypeError)
    expect(loadLedger).not.toHaveBeenCalled()
  })

  it('resolves duplicates independently, each with its own object', async () => {
    const results = await resolveRosterEsmsBalances(['a', 'a'], {
      loadLedger: loaderReturning(holdings(1, 2, 3, 4)),
    })
    expect(results).toHaveLength(2)
    expect(results[0]).not.toBe(results[1])
    expect(results[0].balances).not.toBe(results[1].balances)
  })

  it('works over the real roster with a ledger holding nothing', async () => {
    const results = await resolveRosterEsmsBalances(
      HISTORICAL_AGENTS.map(agent => agent.id),
      { loadLedger: loaderReturning(null) }
    )
    expect(results).toHaveLength(HISTORICAL_AGENTS.length)
    for (const [index, result] of results.entries()) {
      expect(result.agentId).toBe(HISTORICAL_AGENTS[index].id)
      expect(result.esmsSource).toBe('fallback')
      expect(result.degraded).toStrictEqual({ reason: 'no ledger row' })
    }
  })

  it('hands every agent the batch policy, the loader and the log hook', async () => {
    const seen: Array<[string, LedgerContext]> = []
    const loadLedger = vi.fn(async (agentId: string, context: LedgerContext) => {
      seen.push([agentId, context])
      if (agentId === 'b') throw new Error('x')
      return holdings(1, 1, 1, 1)
    })
    const { hook, calls } = recordingHook()
    await resolveRosterEsmsBalances(['a', 'b', 'c'], {
      loadLedger,
      creatorWallet: { userId: 'u-7' },
      onDegraded: hook,
      concurrency: 1,
    })
    expect(seen).toStrictEqual([
      ['a', { creatorWallet: { userId: 'u-7' } }],
      ['b', { creatorWallet: { userId: 'u-7' } }],
      ['c', { creatorWallet: { userId: 'u-7' } }],
    ])
    expect(calls).toStrictEqual([['ledger', 'Error']])
  })

  it('defaults the batch policy to deny', async () => {
    const loadLedger = vi.fn(async () => holdings(1, 1, 1, 1))
    await resolveRosterEsmsBalances(['a', 'b'], { loadLedger })
    expect(loadLedger.mock.calls.map(call => (call as unknown[])[1])).toStrictEqual([
      { creatorWallet: 'deny' },
      { creatorWallet: 'deny' },
    ])
  })

  it('a denied creator wallet degrades only that agent, as a fallback with the private reason', async () => {
    const loadLedger = vi.fn(async (agentId: string) => {
      if (agentId === 'user-avatar-2') throw new CreatorWalletPrivateError(agentId)
      return holdings(4, 3, 2, 1)
    })
    const results = await resolveRosterEsmsBalances(['user-avatar-1', 'user-avatar-2', 'x'], {
      loadLedger,
    })
    expect(results.map(r => r.esmsSource)).toEqual(['database', 'fallback', 'database'])
    expect(results[1].degraded).toStrictEqual({ reason: 'owner wallet is private' })
    expect(results[1].balances).toStrictEqual(holdings(0, 0, 0, 0))
  })

  it('a denied creator wallet gives each such agent the private reason and never calls the hook', async () => {
    const loadLedger = vi.fn(async (agentId: string) => {
      if (agentId.startsWith('user-avatar-')) throw new CreatorWalletPrivateError(agentId)
      return holdings(4, 3, 2, 1)
    })
    const { hook, calls } = recordingHook()
    const results = await resolveRosterEsmsBalances(['user-avatar-1', 'user-avatar-2'], {
      loadLedger,
      onDegraded: hook,
    })
    for (const [index, result] of results.entries()) {
      expect(result).toStrictEqual({
        agentId: `user-avatar-${index + 1}`,
        balances: holdings(0, 0, 0, 0),
        esmsSource: 'fallback',
        degraded: { reason: 'owner wallet is private' },
      })
    }
    expect(calls).toEqual([])
  })

  it('in a mixed batch the hook hears the real failure and not the denial, whatever the order', async () => {
    const loadLedger = vi.fn(async (agentId: string) => {
      if (agentId === 'user-avatar-2') throw new CreatorWalletPrivateError(agentId)
      if (agentId === 'agent-4') throw new Error('timeout')
      return holdings(4, 3, 2, 1)
    })
    for (const order of [
      ['user-avatar-1', 'user-avatar-2', 'x', 'agent-4'],
      ['agent-4', 'x', 'user-avatar-2', 'user-avatar-1'],
    ]) {
      const { hook, calls } = recordingHook()
      const results = await resolveRosterEsmsBalances(order, {
        loadLedger,
        onDegraded: hook,
        concurrency: 1,
      })
      expect(results.map(r => r.degraded?.reason)).toEqual(
        order.map(id =>
          id === 'user-avatar-2'
            ? 'owner wallet is private'
            : id === 'agent-4'
              ? 'ledger unavailable'
              : undefined
        )
      )
      expect(calls).toStrictEqual([['ledger', 'Error']])
    }
  })

  it('strict: a denied creator wallet rejects the batch', async () => {
    const loadLedger = vi.fn(async (agentId: string) => {
      throw new CreatorWalletPrivateError(agentId)
    })
    const error = await resolveRosterEsmsBalances(['user-avatar-1'], {
      loadLedger,
      strict: true,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
    expect((error as EsmsLedgerUnavailableError).cause).toBeInstanceOf(CreatorWalletPrivateError)
  })
})

// ─── Which user's ledger row an id reads ─────────────────────────────────────

describe('ledger user mapping (injected store)', () => {
  const allow: LedgerContext = { creatorWallet: 'allow' }

  it('a roster agent reads its agentic user, found by the provisioned email', async () => {
    const store = fakeStore({
      agentic: { [`${EINSTEIN}@agentic.alchm.kitchen`]: 'user-einstein' },
      creators: { [EINSTEIN]: 'wrong-user' },
      rows: { 'user-einstein': decimalRow('3', '2', '1', '0.5') },
    })
    const loader = createLedgerLoader(store)
    expect(await loader(EINSTEIN)).toStrictEqual(holdings(3, 2, 1, 0.5))
    expect(store.findAgenticUserId).toHaveBeenCalledWith('albert-einstein@agentic.alchm.kitchen')
    expect(store.findCreatorUserId).not.toHaveBeenCalled()
    expect(store.findBalanceRow).toHaveBeenCalledWith('user-einstein')
  })

  it('a user-avatar id reads its creator and never an agentic user', async () => {
    const store = fakeStore({
      agentic: { 'user-avatar-9@agentic.alchm.kitchen': 'imposter' },
      creators: { 'user-avatar-9': 'creator-1' },
      rows: {
        'creator-1': decimalRow('10', '20', '30', '40'),
        imposter: decimalRow('1', '1', '1', '1'),
      },
    })
    const loader = createLedgerLoader(store, notRoster)
    expect(await loader('user-avatar-9', allow)).toStrictEqual(holdings(10, 20, 30, 40))
    expect(store.findCreatorUserId).toHaveBeenCalledWith('user-avatar-9')
    expect(store.findAgenticUserId).not.toHaveBeenCalled()
    expect(store.findBalanceRow).toHaveBeenCalledTimes(1)
    expect(store.findBalanceRow).toHaveBeenCalledWith('creator-1')
  })

  it('a user-avatar id with no creator resolves to no row, not to someone else’s wallet', async () => {
    const store = fakeStore({ agentic: { 'user-avatar-9@agentic.alchm.kitchen': 'imposter' } })
    const loader = createLedgerLoader(store, notRoster)
    for (const context of [undefined, allow, { creatorWallet: 'deny' as const }]) {
      expect(await loader('user-avatar-9', context)).toBeNull()
    }
    expect(store.findAgenticUserId).not.toHaveBeenCalled()
    expect(store.findBalanceRow).not.toHaveBeenCalled()
  })

  it('a created agent reads its creator’s row', async () => {
    const store = fakeStore({
      creators: { 'agent-lumen-123': 'creator-7' },
      rows: { 'creator-7': decimalRow('0', '0', '12.3456', '0') },
    })
    const loader = createLedgerLoader(store, notRoster)
    expect(await loader('agent-lumen-123', allow)).toStrictEqual(holdings(0, 0, 12.3456, 0))
    expect(store.findAgenticUserId).not.toHaveBeenCalled()
  })

  it('a non-roster id with no creator falls back to its agentic user (a sprite)', async () => {
    const store = fakeStore({
      agentic: { 'mars-aries-12@agentic.alchm.kitchen': 'sprite-user' },
      rows: { 'sprite-user': decimalRow('1', '2', '3', '4') },
    })
    const loader = createLedgerLoader(store, notRoster)
    expect(await loader('mars-aries-12')).toStrictEqual(holdings(1, 2, 3, 4))
    expect(store.findCreatorUserId).toHaveBeenCalledWith('mars-aries-12')
    expect(store.findAgenticUserId).toHaveBeenCalledWith('mars-aries-12@agentic.alchm.kitchen')
  })

  it('a roster id is never mapped through created_agents', async () => {
    const store = fakeStore({ creators: { 'some-roster-id': 'creator-1' } })
    const loader = createLedgerLoader(store, isRoster)
    expect(await loader('some-roster-id')).toBeNull()
    expect(store.findCreatorUserId).not.toHaveBeenCalled()
  })

  it('a user-avatar id never asks the roster who is on it', async () => {
    const roster = vi.fn(async () => true)
    const store = fakeStore({
      creators: { 'user-avatar-3': 'c' },
      rows: { c: decimalRow('1', '1', '1', '1') },
    })
    await createLedgerLoader(store, roster)('user-avatar-3', allow)
    expect(roster).not.toHaveBeenCalled()
  })

  it('a roster that cannot answer fails the read before any wallet is touched', async () => {
    const store = fakeStore({
      agentic: { 'a@agentic.alchm.kitchen': 'u1' },
      rows: { u1: decimalRow('1', '1', '1', '1') },
    })
    const broken = async (): Promise<boolean> => {
      throw new Error('roster down')
    }
    await expect(createLedgerLoader(store, broken)('a')).rejects.toThrow('roster down')
    expect(store.findCreatorUserId).not.toHaveBeenCalled()
    expect(store.findAgenticUserId).not.toHaveBeenCalled()
    expect(store.findBalanceRow).not.toHaveBeenCalled()
  })

  it('uses the real roster by default to choose the agentic path', async () => {
    const store = fakeStore({
      agentic: { [`${CARROLL}@agentic.alchm.kitchen`]: 'carroll-user' },
      creators: { [CARROLL]: 'someone-else' },
      rows: { 'carroll-user': decimalRow('1', '1', '1', '1') },
    })
    expect(await createLedgerLoader(store)(CARROLL)).toStrictEqual(holdings(1, 1, 1, 1))
    expect(store.findCreatorUserId).not.toHaveBeenCalled()
  })

  it('uses the real roster by default to let a forged id through to its creator', async () => {
    const store = fakeStore({
      creators: { 'forged-by-a-person': 'creator-3' },
      rows: { 'creator-3': decimalRow('2', '2', '2', '2') },
    })
    expect(await createLedgerLoader(store)('forged-by-a-person', allow)).toStrictEqual(
      holdings(2, 2, 2, 2)
    )
  })

  it('roster membership is by exact id: a differently-cased roster name is just another vessel', async () => {
    const store = fakeStore({
      creators: { 'Albert-Einstein': 'c1' },
      agentic: { 'Albert-Einstein@agentic.alchm.kitchen': 'u-wrong' },
      rows: { c1: decimalRow('1', '2', '3', '4'), 'u-wrong': decimalRow('9', '9', '9', '9') },
    })
    const loader = createLedgerLoader(store)
    expect(await loader('Albert-Einstein', allow)).toStrictEqual(holdings(1, 2, 3, 4))
    // Under the default policy that person's wallet is private, as for any forged vessel.
    await expect(loader('Albert-Einstein')).rejects.toBeInstanceOf(CreatorWalletPrivateError)
  })

  it('roster membership is by exact id: a padded roster name is another vessel, not the figure', async () => {
    const padded = ` ${EINSTEIN} `
    const store = fakeStore({
      creators: { [padded]: 'c1' },
      agentic: { [`${padded}@agentic.alchm.kitchen`]: 'u-wrong' },
      rows: { c1: decimalRow('1', '2', '3', '4'), 'u-wrong': decimalRow('9', '9', '9', '9') },
    })
    const loader = createLedgerLoader(store)
    expect(await loader(padded, allow)).toStrictEqual(holdings(1, 2, 3, 4))
    expect(store.findCreatorUserId).toHaveBeenCalledWith(padded)
    await expect(loader(padded)).rejects.toBeInstanceOf(CreatorWalletPrivateError)
  })

  it('hands ids to the store exactly as given — case and padding intact', async () => {
    const store = fakeStore({
      agentic: { 'Mars-Aries-12@agentic.alchm.kitchen': 'u-sprite' },
      creators: { ' Mixed-Case Vessel ': 'c1' },
      rows: {
        c1: decimalRow('1', '2', '3', '4'),
        'u-sprite': decimalRow('5', '6', '7', '8'),
      },
    })
    const loader = createLedgerLoader(store, notRoster)
    expect(await loader(' Mixed-Case Vessel ', allow)).toStrictEqual(holdings(1, 2, 3, 4))
    expect(store.findCreatorUserId).toHaveBeenLastCalledWith(' Mixed-Case Vessel ')
    expect(await loader('Mars-Aries-12')).toStrictEqual(holdings(5, 6, 7, 8))
    expect(store.findCreatorUserId).toHaveBeenLastCalledWith('Mars-Aries-12')
    expect(store.findAgenticUserId).toHaveBeenCalledWith('Mars-Aries-12@agentic.alchm.kitchen')
    // A differently-cased spelling is a different id: nothing is found for it.
    expect(await loader('mars-aries-12')).toBeNull()
  })

  it('requires a store and builds the loader without touching it', () => {
    expect(createLedgerLoader.length).toBe(1)
    const store = fakeStore({})
    createLedgerLoader(store)
    expect(store.findAgenticUserId).not.toHaveBeenCalled()
    expect(store.findCreatorUserId).not.toHaveBeenCalled()
    expect(store.findBalanceRow).not.toHaveBeenCalled()
  })

  it('resolves null for no user, and for a user without a row', async () => {
    const noUser = createLedgerLoader(fakeStore({}), isRoster)
    expect(await noUser('ghost')).toBeNull()
    const noRow = fakeStore({ agentic: { 'ghost@agentic.alchm.kitchen': 'u1' } })
    expect(await createLedgerLoader(noRow, isRoster)('ghost')).toBeNull()
    expect(noRow.findBalanceRow).toHaveBeenCalledWith('u1')
  })

  it('throws our own EsmsValueError on a corrupt row instead of clamping it', async () => {
    const store = fakeStore({
      agentic: { 'a@agentic.alchm.kitchen': 'u1' },
      rows: { u1: decimalRow('1', '-2', '3', '4') },
    })
    const error = await createLedgerLoader(store, isRoster)('a').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EsmsValueError)
    expect((error as Error).message).toContain('essence')
  })

  it('propagates a store failure as the very same error', async () => {
    const failure = new Error('db down')
    const store = fakeStore({})
    store.findAgenticUserId.mockRejectedValueOnce(failure)
    await expect(createLedgerLoader(store, isRoster)('a')).rejects.toBe(failure)
  })

  it('propagates a creator-lookup failure and never falls back to the agentic user', async () => {
    const store = fakeStore({
      agentic: { 'v@agentic.alchm.kitchen': 'u1' },
      rows: { u1: decimalRow('9', '9', '9', '9') },
    })
    const failure = new Error('created_agents down')
    store.findCreatorUserId.mockRejectedValueOnce(failure)
    await expect(createLedgerLoader(store, notRoster)('v', allow)).rejects.toBe(failure)
    expect(store.findAgenticUserId).not.toHaveBeenCalled()
  })

  it('drives resolveAgentEsmsBalances end to end for a user vessel the policy covers', async () => {
    const store = fakeStore({
      creators: { 'user-avatar-5': 'creator-5' },
      rows: { 'creator-5': decimalRow('300', '0', '0', '0') },
    })
    const result = await resolveAgentEsmsBalances('user-avatar-5', {
      loadLedger: createLedgerLoader(store),
      creatorWallet: 'allow',
    })
    expect(result).toStrictEqual({
      agentId: 'user-avatar-5',
      balances: holdings(300, 0, 0, 0),
      esmsSource: 'database',
    })
  })

  it('agentic email construction matches agentic-user-sync', () => {
    expect(AGENTIC_EMAIL_DOMAIN).toBe('@agentic.alchm.kitchen')
    for (const id of [EINSTEIN, CARROLL, 'mars-aries-12', 'x']) {
      expect(agenticEmailForAgent(id)).toBe(agenticEmailFor(id))
    }
  })

  it('recognises user vessels by prefix only', () => {
    expect(USER_AVATAR_ID_PREFIX).toBe('user-avatar-')
    expect(isUserAvatarId('user-avatar-1')).toBe(true)
    expect(isUserAvatarId('user-avatar-')).toBe(true)
    expect(isUserAvatarId('user-avatar')).toBe(false)
    expect(isUserAvatarId('my-user-avatar-1')).toBe(false)
    expect(isUserAvatarId('User-Avatar-1')).toBe(false)
    expect(isUserAvatarId(EINSTEIN)).toBe(false)
  })
})

// ─── Whose wallet: the creatorWallet policy ──────────────────────────────────

describe('creatorWallet policy', () => {
  const CREATOR = 'creator-1'
  const OTHER_USER = 'someone-else'
  const OWNED = ['user-avatar-42', 'forged-vessel-7'] as const
  const CREATOR_BALANCES = holdings(10, 20, 30, 40)

  /** Two person-owned vessels, plus a roster agent and a sprite that no person owns. */
  const world = () =>
    fakeStore({
      agentic: {
        // A look-alike agentic user for the forged id: a denied read must NOT fall back to it.
        'forged-vessel-7@agentic.alchm.kitchen': 'agentic-lookalike',
        'user-avatar-42@agentic.alchm.kitchen': 'agentic-lookalike',
        [`${EINSTEIN}@agentic.alchm.kitchen`]: 'u-einstein',
        'mars-aries-12@agentic.alchm.kitchen': 'u-sprite',
      },
      creators: { 'user-avatar-42': CREATOR, 'forged-vessel-7': CREATOR },
      rows: {
        [CREATOR]: decimalRow('10', '20', '30', '40'),
        'agentic-lookalike': decimalRow('1', '1', '1', '1'),
        'u-einstein': decimalRow('3', '2', '1', '0.5'),
        'u-sprite': decimalRow('5', '6', '7', '8'),
      },
    })

  /** Every way a caller can fail to be covered by the policy. */
  const denying: Array<[string, LedgerContext | undefined]> = [
    ['no context at all', undefined],
    ['a context with no policy', {} as LedgerContext],
    ['an undefined policy', { creatorWallet: undefined } as unknown as LedgerContext],
    ['a null policy', { creatorWallet: null } as unknown as LedgerContext],
    ['deny', { creatorWallet: 'deny' }],
    ['{ userId } of someone else', { creatorWallet: { userId: OTHER_USER } }],
    ['{ userId } that is the empty string', { creatorWallet: { userId: '' } }],
    ['{ userId } with a trailing space', { creatorWallet: { userId: `${CREATOR} ` } }],
    ['{ userId } that differs only by case', { creatorWallet: { userId: 'Creator-1' } }],
    [
      '{ userId } that is undefined',
      { creatorWallet: { userId: undefined } } as unknown as LedgerContext,
    ],
    ['an empty object', { creatorWallet: {} } as unknown as LedgerContext],
    ['an array', { creatorWallet: [] } as unknown as LedgerContext],
    // Loose equality would read this as the string "allow".
    ['an array holding "allow"', { creatorWallet: ['allow'] } as unknown as LedgerContext],
    ['a number', { creatorWallet: 1 } as unknown as LedgerContext],
    ['true', { creatorWallet: true } as unknown as LedgerContext],
    ['the string ALLOW (case matters)', { creatorWallet: 'ALLOW' } as unknown as LedgerContext],
    ['the string "allow " (no trimming)', { creatorWallet: 'allow ' } as unknown as LedgerContext],
    ['the string everyone', { creatorWallet: 'everyone' } as unknown as LedgerContext],
  ]

  /** Every way a caller is covered. */
  const covering: Array<[string, LedgerContext]> = [
    ['allow', { creatorWallet: 'allow' }],
    ['{ userId } equal to the creator', { creatorWallet: { userId: CREATOR } }],
  ]

  describe.each(OWNED)('the creator-owned vessel %s', vessel => {
    it.each(denying)(
      'is private under %s: it throws, and no balance is ever read',
      async (_n, context) => {
        const store = world()
        const loader = createLedgerLoader(store, notRoster)
        const error = await loader(vessel, context).catch((e: unknown) => e)
        expect(error).toBeInstanceOf(CreatorWalletPrivateError)
        expect((error as Error).name).toBe('CreatorWalletPrivateError')
        // The message names the vessel, never its owner.
        expect((error as Error).message).toContain(vessel)
        expect((error as Error).message).not.toContain(CREATOR)
        // The loader asked for the creator id — and stopped there.
        expect(store.findCreatorUserId).toHaveBeenCalledTimes(1)
        expect(store.findCreatorUserId).toHaveBeenCalledWith(vessel)
        expect(store.findBalanceRow).not.toHaveBeenCalled()
        // …and a refusal never degrades into reading the look-alike agentic wallet.
        expect(store.findAgenticUserId).not.toHaveBeenCalled()
      }
    )

    it.each(covering)('is read under %s: the creator’s row, nobody else’s', async (_n, context) => {
      const store = world()
      const loader = createLedgerLoader(store, notRoster)
      expect(await loader(vessel, context)).toStrictEqual(CREATOR_BALANCES)
      expect(store.findBalanceRow).toHaveBeenCalledTimes(1)
      expect(store.findBalanceRow).toHaveBeenCalledWith(CREATOR)
      expect(store.findAgenticUserId).not.toHaveBeenCalled()
    })

    it('asks who made it before it reads any balance', async () => {
      const store = world()
      await createLedgerLoader(store, notRoster)(vessel, { creatorWallet: 'allow' })
      const [creatorOrder] = store.findCreatorUserId.mock.invocationCallOrder
      const [balanceOrder] = store.findBalanceRow.mock.invocationCallOrder
      expect(creatorOrder).toBeLessThan(balanceOrder)
    })
  })

  describe('vessels no person owns are unaffected by the policy', () => {
    const everyPolicy = [...denying, ...covering]

    it.each(everyPolicy)('a roster agent reads its agentic user under %s', async (_n, context) => {
      const store = world()
      const loader = createLedgerLoader(store)
      expect(await loader(EINSTEIN, context)).toStrictEqual(holdings(3, 2, 1, 0.5))
      expect(store.findCreatorUserId).not.toHaveBeenCalled()
    })

    it.each(everyPolicy)(
      'a roster agent that created_agents also knows is still agentic under %s',
      async (_n, context) => {
        const store = world()
        // created_agents "owns" a roster id: the roster wins, and the policy never applies.
        const loader = createLedgerLoader(store, isRoster)
        expect(await loader('forged-vessel-7', context)).toStrictEqual(holdings(1, 1, 1, 1))
        expect(store.findCreatorUserId).not.toHaveBeenCalled()
      }
    )

    it.each(everyPolicy)(
      'an unknown non-creator id reads its agentic user under %s',
      async (_n, context) => {
        const store = world()
        const loader = createLedgerLoader(store, notRoster)
        expect(await loader('mars-aries-12', context)).toStrictEqual(holdings(5, 6, 7, 8))
        // It was checked against created_agents (no creator found), then fell to the agentic user.
        expect(store.findCreatorUserId).toHaveBeenCalledWith('mars-aries-12')
        expect(store.findBalanceRow).toHaveBeenCalledWith('u-sprite')
      }
    )

    it.each(everyPolicy)(
      'a user-avatar id nobody created is "no row", not a refusal, under %s',
      async (_n, context) => {
        const store = world()
        const loader = createLedgerLoader(store, notRoster)
        expect(await loader('user-avatar-ghost', context)).toBeNull()
        expect(store.findBalanceRow).not.toHaveBeenCalled()
        expect(store.findAgenticUserId).not.toHaveBeenCalled()
      }
    )
  })

  describe('through resolveAgentEsmsBalances', () => {
    const run = (vessel: string, creatorWallet?: CreatorWalletPolicy, store = world()) => {
      const { hook, calls } = recordingHook()
      const promise = resolveAgentEsmsBalances(vessel, {
        loadLedger: createLedgerLoader(store, notRoster),
        ...(creatorWallet === undefined ? {} : { creatorWallet }),
        onDegraded: hook,
      })
      return { promise, calls, store }
    }

    it.each(OWNED)(
      '%s: the default policy is deny — the baseline, a fallback, the private reason, no log line',
      async vessel => {
        const { promise, calls, store } = run(vessel)
        const result = await promise
        expect(result).toStrictEqual({
          agentId: vessel,
          balances: holdings(0, 0, 0, 0),
          esmsSource: 'fallback',
          degraded: { reason: 'owner wallet is private' },
        })
        expect(store.findBalanceRow).not.toHaveBeenCalled()
        // A policy decision, not a failure: nothing for the caller's log on every anonymous request.
        expect(calls).toEqual([])
        // Neither the owner's id nor a single balance figure is anywhere in the answer.
        expect(JSON.stringify(result)).not.toMatch(/creator-1|"10"|"20"|"30"|"40"/)
      }
    )

    it.each(OWNED)('%s: an explicit deny is the same refusal, equally silent', async vessel => {
      const { promise, calls } = run(vessel, 'deny')
      await expect(promise).resolves.toMatchObject({
        esmsSource: 'fallback',
        degraded: { reason: 'owner wallet is private' },
      })
      expect(calls).toEqual([])
    })

    it.each(OWNED)(
      '%s: allow reads the creator’s wallet as a clean database answer',
      async vessel => {
        const { promise, calls } = run(vessel, 'allow')
        expect(await promise).toStrictEqual({
          agentId: vessel,
          balances: CREATOR_BALANCES,
          esmsSource: 'database',
        })
        expect(calls).toEqual([])
      }
    )

    it.each(OWNED)('%s: { userId } equal to the creator reads it', async vessel => {
      const { promise } = run(vessel, { userId: CREATOR })
      expect(await promise).toMatchObject({ esmsSource: 'database', balances: CREATOR_BALANCES })
    })

    it.each(OWNED)('%s: { userId } of someone else is refused, silently', async vessel => {
      const { promise, store, calls } = run(vessel, { userId: OTHER_USER })
      expect(await promise).toMatchObject({
        esmsSource: 'fallback',
        balances: holdings(0, 0, 0, 0),
        degraded: { reason: 'owner wallet is private' },
      })
      expect(store.findBalanceRow).not.toHaveBeenCalled()
      expect(calls).toEqual([])
    })

    it.each(OWNED)('%s: { userId: "" } is refused', async vessel => {
      const { promise } = run(vessel, { userId: '' })
      expect(await promise).toMatchObject({ degraded: { reason: 'owner wallet is private' } })
    })

    it('a refused wallet still reports the vessel’s own baseline, not zeros', async () => {
      // A person "owns" the id of a roster figure here (isRoster is false for the loader):
      // the refusal falls to the baseline, which for that id is its own alchemicalElements.
      const store = fakeStore({ creators: { [EINSTEIN]: CREATOR } })
      const result = await resolveAgentEsmsBalances(EINSTEIN, {
        loadLedger: createLedgerLoader(store, notRoster),
      })
      expect(result.esmsSource).toBe('fallback')
      expect(result.degraded).toStrictEqual({ reason: 'owner wallet is private' })
      expect(result.balances).toStrictEqual(await baselineEsmsHoldings(EINSTEIN))
      expect(Object.values(result.balances).some(value => value > 0)).toBe(true)
    })

    it('strict: a refused wallet throws EsmsLedgerUnavailableError caused by CreatorWalletPrivateError', async () => {
      const store = world()
      const error = await resolveAgentEsmsBalances('user-avatar-42', {
        loadLedger: createLedgerLoader(store, notRoster),
        strict: true,
      }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
      const unavailable = error as EsmsLedgerUnavailableError
      expect(unavailable.cause).toBeInstanceOf(CreatorWalletPrivateError)
      expect(unavailable.agentId).toBe('user-avatar-42')
      expect(unavailable.message).not.toContain(CREATOR)
      expect(store.findBalanceRow).not.toHaveBeenCalled()
    })

    it('strict with allow reads the wallet normally', async () => {
      const result = await resolveAgentEsmsBalances('user-avatar-42', {
        loadLedger: createLedgerLoader(world(), notRoster),
        strict: true,
        creatorWallet: 'allow',
      })
      expect(result.esmsSource).toBe('database')
    })

    it.each<[string, CreatorWalletPolicy | undefined]>([
      ['the default', undefined],
      ['deny', 'deny'],
      ['allow', 'allow'],
      ['{ userId } of someone else', { userId: OTHER_USER }],
    ])('roster and unknown ids are unaffected under %s', async (_n, creatorWallet) => {
      const einstein = await resolveAgentEsmsBalances(EINSTEIN, {
        loadLedger: createLedgerLoader(world()),
        ...(creatorWallet === undefined ? {} : { creatorWallet }),
      })
      expect(einstein).toStrictEqual({
        agentId: EINSTEIN,
        balances: holdings(3, 2, 1, 0.5),
        esmsSource: 'database',
      })
      const sprite = await resolveAgentEsmsBalances('mars-aries-12', {
        loadLedger: createLedgerLoader(world(), notRoster),
        ...(creatorWallet === undefined ? {} : { creatorWallet }),
      })
      expect(sprite.balances).toStrictEqual(holdings(5, 6, 7, 8))
      expect(sprite.degraded).toBeUndefined()
    })

    it('a live override is the caller’s own data and needs no policy', async () => {
      const store = world()
      const result = await resolveAgentEsmsBalances('user-avatar-42', {
        spacetime: holdings(1, 1, 1, 1),
        loadLedger: createLedgerLoader(store, notRoster),
      })
      expect(result.esmsSource).toBe('spacetimedb')
      expect(store.findCreatorUserId).not.toHaveBeenCalled()
    })
  })

  describe('through resolveRosterEsmsBalances', () => {
    const batch = [...OWNED, EINSTEIN, 'mars-aries-12']

    it('refuses each person-owned vessel by default and says nothing to the log about it', async () => {
      const store = world()
      const { hook, calls } = recordingHook()
      const results = await resolveRosterEsmsBalances(batch, {
        loadLedger: createLedgerLoader(store),
        onDegraded: hook,
      })
      expect(results.map(r => [r.agentId, r.esmsSource, r.degraded])).toStrictEqual([
        ['user-avatar-42', 'fallback', { reason: 'owner wallet is private' }],
        ['forged-vessel-7', 'fallback', { reason: 'owner wallet is private' }],
        [EINSTEIN, 'database', undefined],
        ['mars-aries-12', 'database', undefined],
      ])
      expect(results[0].balances).toStrictEqual(holdings(0, 0, 0, 0))
      expect(results[1].balances).toStrictEqual(holdings(0, 0, 0, 0))
      // The creator's row is never even fetched.
      expect(store.findBalanceRow).not.toHaveBeenCalledWith(CREATOR)
      expect(calls).toEqual([])
    })

    it.each(covering)('reads every vessel under %s, equally silently', async (_n, context) => {
      const { hook, calls } = recordingHook()
      const results = await resolveRosterEsmsBalances(batch, {
        loadLedger: createLedgerLoader(world()),
        creatorWallet: context.creatorWallet,
        onDegraded: hook,
      })
      expect(results.map(r => r.esmsSource)).toEqual([
        'database',
        'database',
        'database',
        'database',
      ])
      expect(results[0].balances).toStrictEqual(CREATOR_BALANCES)
      expect(calls).toEqual([])
    })
  })

  describe('what the resolver tells the loader', () => {
    const ask = async (options: Partial<Parameters<typeof resolveAgentEsmsBalances>[1]>) => {
      const loadLedger = vi.fn(async (_id: string, _context: LedgerContext) => holdings(1, 1, 1, 1))
      await resolveAgentEsmsBalances('some-vessel', { ...options, loadLedger })
      expect(loadLedger).toHaveBeenCalledTimes(1)
      return loadLedger.mock.calls[0]
    }

    it('the agent id and a context holding only the policy, deny by default', async () => {
      const call = await ask({})
      expect(call).toStrictEqual(['some-vessel', { creatorWallet: 'deny' }])
    })

    it('an explicit undefined or null policy is deny, too', async () => {
      expect(await ask({ creatorWallet: undefined })).toStrictEqual([
        'some-vessel',
        { creatorWallet: 'deny' },
      ])
      expect(await ask({ creatorWallet: null as unknown as CreatorWalletPolicy })).toStrictEqual([
        'some-vessel',
        { creatorWallet: 'deny' },
      ])
    })

    it('allow and { userId } pass through untouched', async () => {
      expect(await ask({ creatorWallet: 'allow' })).toStrictEqual([
        'some-vessel',
        { creatorWallet: 'allow' },
      ])
      const owner = { userId: 'u-9' }
      const call = await ask({ creatorWallet: owner })
      expect(call[1]).toStrictEqual({ creatorWallet: { userId: 'u-9' } })
    })

    it('is not asked at all when a valid override answers', async () => {
      const loadLedger = vi.fn(async () => holdings(1, 1, 1, 1))
      await resolveAgentEsmsBalances('some-vessel', { spacetime: holdings(2, 2, 2, 2), loadLedger })
      expect(loadLedger).not.toHaveBeenCalled()
    })
  })
})

// ─── Isomorphism: the module's source and behaviour ──────────────────────────

describe('module hygiene (static analysis of the source)', () => {
  const source = readFileSync(MODULE_PATH, 'utf8')
  const file = ts.createSourceFile(MODULE_PATH, source, ts.ScriptTarget.ES2022, true)

  const staticImports: Array<{ specifier: string; typeOnly: boolean }> = []
  const dynamicImports: Array<{ specifier: string; node: ts.Node }> = []
  const stringLiterals: string[] = []
  const identifiers = new Set<string>()
  const memberAccesses = new Set<string>()
  const bareDateConstructions: string[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      staticImports.push({
        specifier: node.moduleSpecifier.text,
        typeOnly: node.importClause?.isTypeOnly === true,
      })
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      staticImports.push({ specifier: node.moduleSpecifier.text, typeOnly: node.isTypeOnly })
    } else if (ts.isImportEqualsDeclaration(node)) {
      staticImports.push({ specifier: node.getText(file), typeOnly: false })
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const [argument] = node.arguments
      dynamicImports.push({
        specifier: ts.isStringLiteralLike(argument)
          ? argument.text
          : `<computed ${argument.getText(file)}>`,
        node,
      })
    } else if (ts.isIdentifier(node)) {
      identifiers.add(node.text)
    } else if (ts.isPropertyAccessExpression(node)) {
      memberAccesses.add(node.getText(file))
    } else if (
      ts.isNewExpression(node) &&
      node.expression.getText(file) === 'Date' &&
      (node.arguments?.length ?? 0) === 0
    ) {
      bareDateConstructions.push(node.getText(file))
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node)) {
      stringLiterals.push(node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)

  const runtimeImports = staticImports.filter(entry => !entry.typeOnly).map(e => e.specifier)
  const forbiddenFragments = ['@/lib/db', 'lib/db', 'server-only', '@prisma', 'node:', 'prisma']

  it('statically imports only the rating contract', () => {
    expect(runtimeImports).toEqual(['./seals-surge'])
  })

  it('has no static import of a database, server-only or node module', () => {
    const forbidden = [
      '@/lib/db',
      '@prisma/client',
      '@prisma/extension-accelerate',
      'pg',
      'server-only',
      'ioredis',
      'fs',
      'os',
      'path',
      'crypto',
      'module',
      'buffer',
      '@/lib/agents/agentic-user-sync',
      '@/lib/admin/serialize',
      '@/lib/wtenClient',
    ]
    for (const { specifier } of staticImports) {
      expect(forbidden).not.toContain(specifier)
      expect(specifier.startsWith('node:')).toBe(false)
      expect(specifier).not.toMatch(/^@prisma\//)
    }
  })

  it('reaches only the roster by a dynamic import — a literal one, and nothing else', () => {
    expect(dynamicImports.map(entry => entry.specifier)).toEqual(['@/lib/agents/historical'])
  })

  it('names no database, server-only, Prisma or node: module anywhere in code — static, dynamic or computed', () => {
    for (const specifier of [...staticImports, ...dynamicImports].map(entry => entry.specifier)) {
      for (const fragment of forbiddenFragments) {
        expect(specifier.toLowerCase(), `${specifier} contains ${fragment}`).not.toContain(fragment)
      }
    }
    for (const text of stringLiterals) {
      for (const fragment of forbiddenFragments) {
        expect(text.toLowerCase(), `string "${text}" contains ${fragment}`).not.toContain(fragment)
      }
    }
  })

  it('has no browser-versus-server branch and no Prisma accessor or default store', () => {
    for (const name of [
      'window',
      'document',
      'globalThis',
      'navigator',
      'prisma',
      'PrismaClient',
      'loadPrisma',
      'defaultLedgerStore',
      'defaultLoader',
      'prismaLedgerStore',
      'prismaLedgerLoader',
    ]) {
      expect(identifiers.has(name), name).toBe(false)
    }
    expect(source).not.toMatch(/typeof\s+window/)
  })

  it('uses no node globals, require, randomness or wall clock', () => {
    for (const name of ['require', 'process', 'Buffer', '__dirname', '__filename', 'global']) {
      expect(identifiers.has(name), name).toBe(false)
    }
    for (const access of ['Math.random', 'Date.now', 'performance.now']) {
      expect(memberAccesses.has(access), access).toBe(false)
    }
    expect(bareDateConstructions).toEqual([])
    expect(identifiers.has('setTimeout')).toBe(false)
  })

  it('does not restate a thermodynamic formula', () => {
    for (const name of ['calculateThermodynamics', 'calculateKalchm', 'calculateMonica']) {
      expect(identifiers.has(name), name).toBe(false)
    }
  })

  it('exports no database-facing name', () => {
    for (const name of [
      'prismaLedgerStore',
      'prismaLedgerLoader',
      'defaultLedgerStore',
      'defaultLoader',
      'loadPrisma',
    ]) {
      expect(name in resolverModule, name).toBe(false)
    }
  })
})

describe('module behaviour: it never loads @/lib/db', () => {
  it('no path through the resolver, even with no ledger configured, ever imports the database module', async () => {
    const loaded = vi.fn()
    vi.resetModules()
    vi.doMock('@/lib/db', () => {
      loaded()
      return { prisma: {} }
    })
    try {
      const fresh = await import('@/lib/agents/rating/esms-balance-resolver')
      expect(loaded).not.toHaveBeenCalled()
      fresh.parseEsmsHoldings(holdings(1, 2, 3, 4))
      await fresh.baselineEsmsHoldings(EINSTEIN)
      await fresh.resolveAgentEsmsBalances(EINSTEIN, { spacetime: holdings(1, 1, 1, 1) })
      await fresh.resolveAgentEsmsBalances(EINSTEIN, { loadLedger: loaderReturning(null) })
      await fresh.resolveAgentEsmsBalances('user-avatar-1')
      await fresh.resolveAgentEsmsBalances('user-avatar-1', { creatorWallet: 'allow' })
      await expect(
        fresh.resolveAgentEsmsBalances('user-avatar-1', { strict: true })
      ).rejects.toBeInstanceOf(fresh.EsmsLedgerUnavailableError)
      await fresh.resolveRosterEsmsBalances([EINSTEIN, 'user-avatar-1'])
      await fresh.createLedgerLoader(fakeStore({}))('user-avatar-1', { creatorWallet: 'allow' })
      expect(loaded).not.toHaveBeenCalled()
    } finally {
      vi.doUnmock('@/lib/db')
      vi.resetModules()
    }
  })

  it('does not even look for a window: the answer is the same with one stubbed in', async () => {
    const before = await resolveAgentEsmsBalances('user-avatar-1')
    vi.stubGlobal('window', {})
    try {
      const during = await resolveAgentEsmsBalances('user-avatar-1')
      expect(during).toStrictEqual(before)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
