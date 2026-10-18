/** @vitest-environment node */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { agenticEmailFor } from '@/lib/agents/agentic-user-sync'
import {
  AGENTIC_EMAIL_DOMAIN,
  ESMS_ROSTER_CONCURRENCY,
  EsmsLedgerUnavailableError,
  agenticEmailForAgent,
  baselineEsmsHoldings,
  createLedgerLoader,
  decimalToWholeTokens,
  holdingsFromAlchemicalElements,
  isUserAvatarId,
  parseEsmsHoldings,
  resolveAgentEsmsBalances,
  resolveRosterEsmsBalances,
  type EsmsLedgerStore,
} from '@/lib/agents/rating/esms-balance-resolver'
import {
  ESMS_TOKENS,
  SEAL_TIER_REQUIREMENTS,
  evaluateSeals,
  type EsmsHoldings,
} from '@/lib/agents/rating/seals-surge'
import { CORE_STAT_KEYS, type CoreStats } from '@/lib/agents/rating/ovr-archetype'

// The default ledger store reaches Prisma through `import('@/lib/db')`. No test here talks to a
// database: this fake stands in for the module, and most tests never reach it at all.
const db = vi.hoisted(() => ({
  users: { findFirst: vi.fn() },
  created_agents: { findFirst: vi.fn() },
  tokenBalance: { findUnique: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma: db }))

// `agentic-user-sync` is imported only to pin email parity; its WTEN client is irrelevant here.
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

const loaderReturning = (value: EsmsHoldings | null) => vi.fn(async () => value)
const loaderThrowing = (error: unknown) =>
  vi.fn(async (): Promise<EsmsHoldings | null> => {
    throw error
  })

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

  it('treats a null override as absent', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: null,
      loadLedger: loaderReturning(ledger),
    })
    expect(result.esmsSource).toBe('database')
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
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: bad as EsmsHoldings,
      loadLedger,
    })
    // Rejected, not used and not clamped: the next source answered.
    expect(result.esmsSource).toBe('database')
    expect(result.balances).toStrictEqual(ledger)
    expect(result.degraded?.reason).toContain('spacetimedb holdings rejected')
    expect(result.degraded?.reason).toContain(mention)
    expect(loadLedger).toHaveBeenCalledTimes(1)
  })

  it.each(invalid)('strict mode throws a RangeError for %s', async (_name, bad) => {
    const loadLedger = loaderReturning(ledger)
    await expect(
      resolveAgentEsmsBalances(EINSTEIN, {
        spacetime: bad as EsmsHoldings,
        loadLedger,
        strict: true,
      })
    ).rejects.toThrow(RangeError)
    expect(loadLedger).not.toHaveBeenCalled()
  })

  it('a rejected override with no ledger row keeps both reasons', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: { ...good, spirit: -1 },
      loadLedger: loaderReturning(null),
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded?.reason).toContain('spacetimedb holdings rejected')
    expect(result.degraded?.reason).toMatch(/; no ledger row$/)
  })

  it('a rejected override with a failing ledger keeps both reasons', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      spacetime: { ...good, spirit: Number.NaN },
      loadLedger: loaderThrowing(new Error('down')),
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded?.reason).toContain('spacetimedb holdings rejected')
    expect(result.degraded?.reason).toContain('ledger unavailable')
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
})

// ─── Failure semantics ───────────────────────────────────────────────────────

describe('failed ledger reads', () => {
  class PrismaClientInitializationError extends Error {
    readonly code = 'P1001'
    constructor() {
      super("Can't reach database server at `postgres://svc:hunter2@db.internal:5432/alchm`")
      this.name = 'PrismaClientInitializationError'
    }
  }

  it('non-strict: a throwing loader yields the baseline, marked fallback + degraded', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderThrowing(new PrismaClientInitializationError()),
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded?.reason).toBe(
      'ledger unavailable: PrismaClientInitializationError (P1001)'
    )
    expect(result.balances).toStrictEqual(await baselineEsmsHoldings(EINSTEIN))
  })

  it('does not leak the error message (connection strings) into the reason', async () => {
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: loaderThrowing(new PrismaClientInitializationError()),
    })
    expect(result.degraded?.reason).not.toMatch(/hunter2|postgres|db\.internal/)
  })

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
    const error = await resolveAgentEsmsBalances(EINSTEIN, {
      strict: true,
      loadLedger: loaderThrowing(cause),
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
    expect(error).toBeInstanceOf(Error)
    const unavailable = error as EsmsLedgerUnavailableError
    expect(unavailable.cause).toBe(cause)
    expect(unavailable.agentId).toBe(EINSTEIN)
    expect(unavailable.name).toBe('EsmsLedgerUnavailableError')
    expect(unavailable.message).toContain(EINSTEIN)
    expect(unavailable.message).not.toContain('hunter2')
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
    expect(result.degraded?.reason).toBe('ledger unavailable: string')
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
      const result = await resolveAgentEsmsBalances('unknown-agent', {
        loadLedger: loaderReturning(row as EsmsHoldings),
      })
      expect(result.esmsSource).toBe('fallback')
      expect(result.degraded?.reason).toContain('ledger row invalid')
      expect(result.degraded?.reason).toContain(token)
      expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
    }
  )

  it.each(corrupt)(
    'strict: a ledger row with %s throws, caused by a RangeError',
    async (_n, row) => {
      const error = await resolveAgentEsmsBalances(EINSTEIN, {
        strict: true,
        loadLedger: loaderReturning(row as EsmsHoldings),
      }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
      expect((error as EsmsLedgerUnavailableError).cause).toBeInstanceOf(RangeError)
    }
  )
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

  it('names the offending field in the message', () => {
    expect(() => decimalToWholeTokens(-1, 'matter balance')).toThrow(/matter balance/)
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

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 5],
    ['a string', 'x'],
    ['an empty array', []],
    ['an array of four numbers', [1, 2, 3, 4]],
  ])('rejects %s as a non-object', (_name, value) => {
    expect(() => parseEsmsHoldings(value)).toThrow(RangeError)
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
    expect(results[1].degraded?.reason).toBe('ledger unavailable: Error')
    expect(results[3].degraded?.reason).toBe('no ledger row')
    expect(results[0].degraded).toBeUndefined()
  })

  it('non-strict: survives an unexpected throw while preparing one agent', async () => {
    const hostile = new Proxy(
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
    const results = await resolveRosterEsmsBalances(['a', 'b'], {
      spacetime: hostile,
      loadLedger: loaderReturning(holdings(1, 1, 1, 1)),
    })
    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(result.esmsSource).toBe('fallback')
      expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
      expect(result.degraded?.reason).toBe('resolution failed: Error')
    }
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
    expect(results[0].degraded?.reason).toContain('spacetimedb holdings rejected')
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
      expect(result.degraded?.reason).toBe('no ledger row')
    }
  })
})

// ─── Which user's ledger row an id reads ─────────────────────────────────────

describe('ledger user mapping (injected store)', () => {
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
    expect(await loader('user-avatar-9')).toStrictEqual(holdings(10, 20, 30, 40))
    expect(store.findCreatorUserId).toHaveBeenCalledWith('user-avatar-9')
    expect(store.findAgenticUserId).not.toHaveBeenCalled()
    expect(store.findBalanceRow).toHaveBeenCalledTimes(1)
    expect(store.findBalanceRow).toHaveBeenCalledWith('creator-1')
  })

  it('a user-avatar id with no creator resolves to no row, not to someone else’s wallet', async () => {
    const store = fakeStore({ agentic: { 'user-avatar-9@agentic.alchm.kitchen': 'imposter' } })
    const loader = createLedgerLoader(store, notRoster)
    expect(await loader('user-avatar-9')).toBeNull()
    expect(store.findAgenticUserId).not.toHaveBeenCalled()
    expect(store.findBalanceRow).not.toHaveBeenCalled()
  })

  it('a created agent reads its creator’s row', async () => {
    const store = fakeStore({
      creators: { 'agent-lumen-123': 'creator-7' },
      rows: { 'creator-7': decimalRow('0', '0', '12.3456', '0') },
    })
    const loader = createLedgerLoader(store, notRoster)
    expect(await loader('agent-lumen-123')).toStrictEqual(holdings(0, 0, 12.3456, 0))
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

  it('uses the real roster by default to choose the agentic path', async () => {
    const store = fakeStore({
      agentic: { [`${CARROLL}@agentic.alchm.kitchen`]: 'carroll-user' },
      creators: { [CARROLL]: 'someone-else' },
      rows: { 'carroll-user': decimalRow('1', '1', '1', '1') },
    })
    expect(await createLedgerLoader(store)(CARROLL)).toStrictEqual(holdings(1, 1, 1, 1))
    expect(store.findCreatorUserId).not.toHaveBeenCalled()
  })

  it('resolves null for no user, and for a user without a row', async () => {
    const noUser = createLedgerLoader(fakeStore({}), isRoster)
    expect(await noUser('ghost')).toBeNull()
    const noRow = fakeStore({ agentic: { 'ghost@agentic.alchm.kitchen': 'u1' } })
    expect(await createLedgerLoader(noRow, isRoster)('ghost')).toBeNull()
    expect(noRow.findBalanceRow).toHaveBeenCalledWith('u1')
  })

  it('throws on a corrupt row instead of clamping it', async () => {
    const store = fakeStore({
      agentic: { 'a@agentic.alchm.kitchen': 'u1' },
      rows: { u1: decimalRow('1', '-2', '3', '4') },
    })
    await expect(createLedgerLoader(store, isRoster)('a')).rejects.toThrow(/essence/)
  })

  it('propagates a store failure', async () => {
    const store = fakeStore({})
    store.findAgenticUserId.mockRejectedValueOnce(new Error('db down'))
    await expect(createLedgerLoader(store, isRoster)('a')).rejects.toThrow('db down')
  })

  it('drives resolveAgentEsmsBalances end to end for a user vessel', async () => {
    const store = fakeStore({
      creators: { 'user-avatar-5': 'creator-5' },
      rows: { 'creator-5': decimalRow('300', '0', '0', '0') },
    })
    const result = await resolveAgentEsmsBalances('user-avatar-5', {
      loadLedger: createLedgerLoader(store),
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
    expect(isUserAvatarId('user-avatar-1')).toBe(true)
    expect(isUserAvatarId('user-avatar-')).toBe(true)
    expect(isUserAvatarId('my-user-avatar-1')).toBe(false)
    expect(isUserAvatarId('User-Avatar-1')).toBe(false)
    expect(isUserAvatarId(EINSTEIN)).toBe(false)
  })
})

// ─── The default store (Prisma faked at the module boundary) ─────────────────

describe('default Prisma ledger store', () => {
  it('reads a roster agent through users → token_balances', async () => {
    db.users.findFirst.mockResolvedValue({ id: 'u-einstein' })
    db.tokenBalance.findUnique.mockResolvedValue(decimalRow('4.5', '3', '2', '1.0001'))
    const result = await resolveAgentEsmsBalances(EINSTEIN)
    expect(result).toStrictEqual({
      agentId: EINSTEIN,
      balances: holdings(4.5, 3, 2, 1.0001),
      esmsSource: 'database',
    })
    expect(db.users.findFirst).toHaveBeenCalledWith({
      where: { email: 'albert-einstein@agentic.alchm.kitchen', isAgentic: true },
      select: { id: true },
    })
    expect(db.tokenBalance.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u-einstein' },
      select: { spirit: true, essence: true, matter: true, substance: true },
    })
    expect(db.created_agents.findFirst).not.toHaveBeenCalled()
  })

  it('maps a forged vessel through created_agents by id or blueprint agentId', async () => {
    db.created_agents.findFirst.mockResolvedValue({ creatorId: 'u-creator' })
    db.tokenBalance.findUnique.mockResolvedValue(decimalRow('0', '25', '0', '0'))
    const result = await resolveAgentEsmsBalances('agent-lumen-123')
    expect(result.esmsSource).toBe('database')
    expect(result.balances).toStrictEqual(holdings(0, 25, 0, 0))
    expect(db.created_agents.findFirst).toHaveBeenCalledWith({
      where: {
        creatorId: { not: null },
        OR: [
          { id: 'agent-lumen-123' },
          { blueprint: { path: ['agentId'], equals: 'agent-lumen-123' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { creatorId: true },
    })
    expect(db.tokenBalance.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u-creator' } })
    )
    expect(db.users.findFirst).not.toHaveBeenCalled()
  })

  it('a user-avatar id with no created_agents row never queries users', async () => {
    db.created_agents.findFirst.mockResolvedValue(null)
    const result = await resolveAgentEsmsBalances('user-avatar-77')
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'no ledger row' })
    expect(db.users.findFirst).not.toHaveBeenCalled()
    expect(db.tokenBalance.findUnique).not.toHaveBeenCalled()
  })

  it('a missing token_balances row is "no ledger row", not zeros', async () => {
    db.users.findFirst.mockResolvedValue({ id: 'u1' })
    db.tokenBalance.findUnique.mockResolvedValue(null)
    const result = await resolveAgentEsmsBalances(EINSTEIN)
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'no ledger row' })
  })

  it('a rejecting Prisma call degrades (non-strict) or throws with its cause (strict)', async () => {
    const failure = Object.assign(new Error('P1001 detail with host db.internal'), {
      name: 'PrismaClientInitializationError',
      code: 'P1001',
    })
    db.users.findFirst.mockRejectedValue(failure)
    const degraded = await resolveAgentEsmsBalances(EINSTEIN)
    expect(degraded.esmsSource).toBe('fallback')
    expect(degraded.degraded?.reason).toBe(
      'ledger unavailable: PrismaClientInitializationError (P1001)'
    )
    const error = await resolveAgentEsmsBalances(EINSTEIN, { strict: true }).catch(
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
    expect((error as EsmsLedgerUnavailableError).cause).toBe(failure)
  })

  it('a corrupt Decimal column fails the read instead of surfacing a number', async () => {
    db.users.findFirst.mockResolvedValue({ id: 'u1' })
    db.tokenBalance.findUnique.mockResolvedValue(decimalRow('1', '1', '-5', '1'))
    const result = await resolveAgentEsmsBalances(EINSTEIN)
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded?.reason).toContain('matter')
  })

  it('does not load @/lib/db until a ledger read happens', async () => {
    const loaded = vi.fn()
    vi.resetModules()
    vi.doMock('@/lib/db', () => {
      loaded()
      return { prisma: db }
    })
    try {
      const fresh = await import('@/lib/agents/rating/esms-balance-resolver')
      expect(loaded).not.toHaveBeenCalled()
      fresh.parseEsmsHoldings(holdings(1, 2, 3, 4))
      await fresh.baselineEsmsHoldings(EINSTEIN)
      await fresh.resolveAgentEsmsBalances(EINSTEIN, { spacetime: holdings(1, 1, 1, 1) })
      await fresh.resolveAgentEsmsBalances(EINSTEIN, { loadLedger: loaderReturning(null) })
      expect(loaded).not.toHaveBeenCalled()
      await fresh.resolveAgentEsmsBalances('user-avatar-1')
      expect(loaded).toHaveBeenCalledTimes(1)
    } finally {
      vi.doMock('@/lib/db', () => ({ prisma: db }))
      vi.resetModules()
    }
  })

  it('degrades, and retries later, when the roster itself cannot be imported', async () => {
    let attempts = 0
    vi.resetModules()
    vi.doMock('@/lib/agents/historical', () => {
      attempts++
      if (attempts === 1) throw new Error('roster boom')
      return {
        HISTORICAL_AGENTS: [
          {
            id: 'tiny-roster-agent',
            consciousness: {
              alchemicalElements: { spirit: 0.5, essence: 0.6, matter: 0.7, substance: 0.8 },
            },
          },
        ],
      }
    })
    try {
      const fresh = await import('@/lib/agents/rating/esms-balance-resolver')
      const loadLedger = loaderReturning(null)
      const first = await fresh.resolveAgentEsmsBalances('tiny-roster-agent', { loadLedger })
      expect(first.esmsSource).toBe('fallback')
      expect(first.balances).toStrictEqual(holdings(0, 0, 0, 0))
      expect(first.degraded?.reason).toBe('no ledger row; baseline unavailable: Error')
      await expect(
        fresh.resolveAgentEsmsBalances('tiny-roster-agent', { loadLedger, strict: true })
      ).resolves.toMatchObject({ balances: holdings(0.5, 0.6, 0.7, 0.8) })
      expect(attempts).toBe(2)
    } finally {
      vi.doUnmock('@/lib/agents/historical')
      vi.resetModules()
    }
  })

  describe('in a browser', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('never reaches Prisma; the read fails and the non-strict path degrades', async () => {
      vi.stubGlobal('window', {})
      const result = await resolveAgentEsmsBalances('user-avatar-1')
      expect(result.esmsSource).toBe('fallback')
      expect(result.degraded?.reason).toBe('ledger unavailable: Error')
      expect(db.created_agents.findFirst).not.toHaveBeenCalled()
      expect(db.users.findFirst).not.toHaveBeenCalled()
      await expect(resolveAgentEsmsBalances('user-avatar-1', { strict: true })).rejects.toThrow(
        EsmsLedgerUnavailableError
      )
    })
  })
})

// ─── Isomorphism: the module's source ────────────────────────────────────────

describe('module hygiene (static analysis of the source)', () => {
  const source = readFileSync(MODULE_PATH, 'utf8')
  const file = ts.createSourceFile(MODULE_PATH, source, ts.ScriptTarget.ES2022, true)

  const staticImports: Array<{ specifier: string; typeOnly: boolean }> = []
  const dynamicImports: Array<{ specifier: string; node: ts.Node }> = []
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
    ts.forEachChild(node, visit)
  }
  visit(file)

  const runtimeImports = staticImports.filter(entry => !entry.typeOnly).map(e => e.specifier)

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

  it('reaches the database and the roster only by literal dynamic imports', () => {
    expect(dynamicImports.map(entry => entry.specifier).sort()).toEqual([
      '@/lib/agents/historical',
      '@/lib/db',
    ])
  })

  it('imports @/lib/db only inside a typeof-window-is-undefined branch', () => {
    const dbImport = dynamicImports.find(entry => entry.specifier === '@/lib/db')!
    let guarded = false
    for (let node: ts.Node | undefined = dbImport.node; node; node = node.parent) {
      const parent: ts.Node | undefined = node.parent
      if (
        parent &&
        ts.isIfStatement(parent) &&
        parent.thenStatement === node &&
        parent.expression.getText(file).replace(/\s+/g, ' ') === "typeof window === 'undefined'"
      ) {
        guarded = true
      }
    }
    expect(guarded).toBe(true)
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
})
