/** @vitest-environment node */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CreatorWalletPrivateError,
  EsmsLedgerUnavailableError,
  EsmsValueError,
  resolveAgentEsmsBalances,
  type CreatorWalletPolicy,
  type EsmsLedgerStore,
  type LedgerContext,
} from '@/lib/agents/rating/esms-balance-resolver'
import { prismaLedgerLoader, prismaLedgerStore } from '@/lib/agents/rating/esms-ledger-store.server'
import type { EsmsHoldings } from '@/lib/agents/rating/seals-surge'

// Prisma is faked at the module boundary: the store reaches it through `await import('@/lib/db')`.
// No test here talks to a database, and none needs a DATABASE_URL.
const db = vi.hoisted(() => ({
  users: { findFirst: vi.fn() },
  created_agents: { findFirst: vi.fn() },
  tokenBalance: { findUnique: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma: db }))

const STORE_PATH = fileURLToPath(
  new URL('../../lib/agents/rating/esms-ledger-store.server.ts', import.meta.url)
)
const BARREL_PATH = fileURLToPath(new URL('../../lib/agents/rating/index.ts', import.meta.url))

const EINSTEIN = 'albert-einstein'

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

/** A Prisma-ish failure whose message carries a connection string nobody may ever see. */
function prismaFailure() {
  return Object.assign(
    new Error('P1001 cannot reach postgres://svc:hunter2@ep-x.neon.tech:5432/alchm'),
    { name: 'PrismaClientInitializationError', code: 'P1001' }
  )
}

/** Parse a production file for its imports, exports and identifiers. */
function analyse(path: string) {
  const source = readFileSync(path, 'utf8')
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true)
  const staticImports: Array<{ specifier: string; bare: boolean; position: number }> = []
  const reExports: string[] = []
  const dynamicImports: string[] = []
  const exportedNames: string[] = []
  const stringLiterals: string[] = []
  const identifiers = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      staticImports.push({
        specifier: node.moduleSpecifier.text,
        bare: node.importClause === undefined,
        position: staticImports.length,
      })
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        reExports.push(node.moduleSpecifier.text)
      }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) exportedNames.push(element.name.text)
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const [argument] = node.arguments
      dynamicImports.push(
        ts.isStringLiteralLike(argument) ? argument.text : `<computed ${argument.getText(file)}>`
      )
    } else if (ts.isVariableStatement(node)) {
      if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) exportedNames.push(declaration.name.text)
        }
      }
    } else if (ts.isIdentifier(node)) {
      identifiers.add(node.text)
    }
    if (ts.isStringLiteralLike(node)) stringLiterals.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return {
    source,
    staticImports,
    reExports,
    dynamicImports,
    exportedNames,
    stringLiterals,
    identifiers,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── The three Prisma reads, call by call ────────────────────────────────────

describe('prismaLedgerStore.findAgenticUserId', () => {
  it('asks users for the agentic user with this email, selecting only its id', async () => {
    db.users.findFirst.mockResolvedValue({ id: 'u-einstein' })
    await expect(
      prismaLedgerStore.findAgenticUserId('albert-einstein@agentic.alchm.kitchen')
    ).resolves.toBe('u-einstein')
    expect(db.users.findFirst).toHaveBeenCalledTimes(1)
    expect(db.users.findFirst.mock.calls[0]).toStrictEqual([
      {
        where: { email: 'albert-einstein@agentic.alchm.kitchen', isAgentic: true },
        select: { id: true },
      },
    ])
  })

  it('touches no other table', async () => {
    db.users.findFirst.mockResolvedValue({ id: 'u1' })
    await prismaLedgerStore.findAgenticUserId('x@agentic.alchm.kitchen')
    expect(db.created_agents.findFirst).not.toHaveBeenCalled()
    expect(db.tokenBalance.findUnique).not.toHaveBeenCalled()
  })

  it('resolves null when there is no such user', async () => {
    db.users.findFirst.mockResolvedValue(null)
    await expect(
      prismaLedgerStore.findAgenticUserId('ghost@agentic.alchm.kitchen')
    ).resolves.toBeNull()
  })

  it('passes the email through exactly, without trimming or lower-casing it', async () => {
    db.users.findFirst.mockResolvedValue(null)
    await prismaLedgerStore.findAgenticUserId(' Mixed.Case@agentic.alchm.kitchen ')
    const [[query]] = db.users.findFirst.mock.calls
    expect(query.where.email).toBe(' Mixed.Case@agentic.alchm.kitchen ')
  })

  it('lets a Prisma failure through as the very same rejection', async () => {
    const failure = prismaFailure()
    db.users.findFirst.mockRejectedValue(failure)
    await expect(prismaLedgerStore.findAgenticUserId('x@agentic.alchm.kitchen')).rejects.toBe(
      failure
    )
  })
})

describe('prismaLedgerStore.findCreatorUserId', () => {
  it('matches a forged vessel by its row id or the agentId in its blueprint, oldest first', async () => {
    db.created_agents.findFirst.mockResolvedValue({ creatorId: 'u-creator' })
    await expect(prismaLedgerStore.findCreatorUserId('agent-lumen-123')).resolves.toBe('u-creator')
    expect(db.created_agents.findFirst).toHaveBeenCalledTimes(1)
    expect(db.created_agents.findFirst.mock.calls[0]).toStrictEqual([
      {
        where: {
          creatorId: { not: null },
          OR: [
            { id: 'agent-lumen-123' },
            { blueprint: { path: ['agentId'], equals: 'agent-lumen-123' } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        select: { creatorId: true },
      },
    ])
  })

  it('never reads a vessel without a creator, and a re-forged id keeps its original creator', async () => {
    db.created_agents.findFirst.mockResolvedValue(null)
    await prismaLedgerStore.findCreatorUserId('x')
    const [[query]] = db.created_agents.findFirst.mock.calls
    // creatorId must be non-null, or the creator-less rows would match with a null owner.
    expect(query.where.creatorId).toStrictEqual({ not: null })
    // ASCENDING createdAt: the first forger wins.
    expect(query.orderBy).toStrictEqual({ createdAt: 'asc' })
    // Both spellings of the id are ORed, not ANDed.
    expect(Object.keys(query.where).sort()).toEqual(['OR', 'creatorId'])
    expect(query.where.OR).toHaveLength(2)
  })

  it('selects only the creator id, never the blueprint or the vessel', async () => {
    db.created_agents.findFirst.mockResolvedValue(null)
    await prismaLedgerStore.findCreatorUserId('x')
    expect(db.created_agents.findFirst.mock.calls[0][0].select).toStrictEqual({ creatorId: true })
  })

  it('looks the id up verbatim, in both places', async () => {
    db.created_agents.findFirst.mockResolvedValue(null)
    await prismaLedgerStore.findCreatorUserId(' Odd-Id ')
    const [[query]] = db.created_agents.findFirst.mock.calls
    expect(query.where.OR[0]).toStrictEqual({ id: ' Odd-Id ' })
    expect(query.where.OR[1].blueprint.equals).toBe(' Odd-Id ')
    expect(query.where.OR[1].blueprint.path).toStrictEqual(['agentId'])
  })

  it('resolves null when no vessel matches', async () => {
    db.created_agents.findFirst.mockResolvedValue(null)
    await expect(prismaLedgerStore.findCreatorUserId('nobody')).resolves.toBeNull()
  })

  it('resolves null for a row whose creator is somehow null, not undefined or a string', async () => {
    db.created_agents.findFirst.mockResolvedValue({ creatorId: null })
    await expect(prismaLedgerStore.findCreatorUserId('odd')).resolves.toBeNull()
  })

  it('touches no other table', async () => {
    db.created_agents.findFirst.mockResolvedValue({ creatorId: 'u1' })
    await prismaLedgerStore.findCreatorUserId('x')
    expect(db.users.findFirst).not.toHaveBeenCalled()
    expect(db.tokenBalance.findUnique).not.toHaveBeenCalled()
  })

  it('lets a Prisma failure through as the very same rejection', async () => {
    const failure = prismaFailure()
    db.created_agents.findFirst.mockRejectedValue(failure)
    await expect(prismaLedgerStore.findCreatorUserId('x')).rejects.toBe(failure)
  })
})

describe('prismaLedgerStore.findBalanceRow', () => {
  it('reads one token_balances row by user id, selecting only the four balances', async () => {
    const row = decimalRow('4.5', '3', '2', '1.0001')
    db.tokenBalance.findUnique.mockResolvedValue(row)
    const result = await prismaLedgerStore.findBalanceRow('u-einstein')
    // The raw row comes back as is (Decimals included): validating it is the resolver's job.
    expect(result).toBe(row)
    expect(db.tokenBalance.findUnique).toHaveBeenCalledTimes(1)
    expect(db.tokenBalance.findUnique.mock.calls[0]).toStrictEqual([
      {
        where: { userId: 'u-einstein' },
        select: { spirit: true, essence: true, matter: true, substance: true },
      },
    ])
  })

  it('resolves null when the user has no row', async () => {
    db.tokenBalance.findUnique.mockResolvedValue(null)
    await expect(prismaLedgerStore.findBalanceRow('u-new')).resolves.toBeNull()
  })

  it('touches no other table', async () => {
    db.tokenBalance.findUnique.mockResolvedValue(null)
    await prismaLedgerStore.findBalanceRow('u1')
    expect(db.users.findFirst).not.toHaveBeenCalled()
    expect(db.created_agents.findFirst).not.toHaveBeenCalled()
  })

  it('lets a Prisma failure through as the very same rejection', async () => {
    const failure = prismaFailure()
    db.tokenBalance.findUnique.mockRejectedValue(failure)
    await expect(prismaLedgerStore.findBalanceRow('u1')).rejects.toBe(failure)
  })

  it('is exactly the three reads the resolver declares, and nothing more', () => {
    const store: EsmsLedgerStore = prismaLedgerStore
    expect(Object.keys(store).sort()).toEqual([
      'findAgenticUserId',
      'findBalanceRow',
      'findCreatorUserId',
    ])
    expect(typeof prismaLedgerLoader).toBe('function')
  })
})

// ─── prismaLedgerLoader: the policy, end to end over the faked Prisma ────────

describe('prismaLedgerLoader', () => {
  const CREATOR = 'u-creator'
  const OTHER = 'u-somebody-else'

  /** Route the three faked tables to a small in-memory world. */
  function seed(world: {
    agentic?: Record<string, string>
    creators?: Record<string, string>
    rows?: Record<string, ReturnType<typeof decimalRow>>
  }) {
    db.users.findFirst.mockImplementation(async (query: { where: { email: string } }) => {
      const id = world.agentic?.[query.where.email]
      return id === undefined ? null : { id }
    })
    db.created_agents.findFirst.mockImplementation(
      async (query: { where: { OR: Array<{ id?: string }> } }) => {
        const wanted = query.where.OR[0].id as string
        const creatorId = world.creators?.[wanted]
        return creatorId === undefined ? null : { creatorId }
      }
    )
    db.tokenBalance.findUnique.mockImplementation(async (query: { where: { userId: string } }) => {
      return world.rows?.[query.where.userId] ?? null
    })
  }

  const ownedWorld = () => ({
    agentic: {
      'forged-vessel-7@agentic.alchm.kitchen': 'agentic-lookalike',
      [`${EINSTEIN}@agentic.alchm.kitchen`]: 'u-einstein',
      'mars-aries-12@agentic.alchm.kitchen': 'u-sprite',
    },
    creators: { 'forged-vessel-7': CREATOR, 'user-avatar-42': CREATOR },
    rows: {
      [CREATOR]: decimalRow('10', '20', '30', '40'),
      'agentic-lookalike': decimalRow('1', '1', '1', '1'),
      'u-einstein': decimalRow('4.5', '3', '2', '1.0001'),
      'u-sprite': decimalRow('5', '6', '7', '8'),
    },
  })

  it('reads a roster agent through users → token_balances, never through created_agents', async () => {
    seed(ownedWorld())
    const result = await prismaLedgerLoader(EINSTEIN)
    expect(result).toStrictEqual(holdings(4.5, 3, 2, 1.0001))
    expect(db.users.findFirst.mock.calls[0][0].where).toStrictEqual({
      email: 'albert-einstein@agentic.alchm.kitchen',
      isAgentic: true,
    })
    expect(db.tokenBalance.findUnique.mock.calls[0][0].where).toStrictEqual({
      userId: 'u-einstein',
    })
    expect(db.created_agents.findFirst).not.toHaveBeenCalled()
  })

  it('reads an unknown non-creator id (a sprite) through its agentic user', async () => {
    seed(ownedWorld())
    expect(await prismaLedgerLoader('mars-aries-12')).toStrictEqual(holdings(5, 6, 7, 8))
    // created_agents was asked first and knew nothing of it.
    expect(db.created_agents.findFirst).toHaveBeenCalledTimes(1)
    expect(db.users.findFirst).toHaveBeenCalledTimes(1)
  })

  const denying: Array<[string, LedgerContext | undefined]> = [
    ['no context', undefined],
    ['an empty context', {} as LedgerContext],
    ['deny', { creatorWallet: 'deny' }],
    ['{ userId } of another user', { creatorWallet: { userId: OTHER } }],
    ['{ userId } that is empty', { creatorWallet: { userId: '' } }],
  ]

  it.each(['forged-vessel-7', 'user-avatar-42'])(
    'a person’s vessel %s: refused by default and for anybody else, before any balance is read',
    async vessel => {
      for (const [, context] of denying) {
        vi.clearAllMocks()
        seed(ownedWorld())
        const error = await prismaLedgerLoader(vessel, context).catch((e: unknown) => e)
        expect(error).toBeInstanceOf(CreatorWalletPrivateError)
        expect(db.tokenBalance.findUnique).not.toHaveBeenCalled()
        // The "agentic look-alike" of the same id is not a fallback for a refusal.
        expect(db.users.findFirst).not.toHaveBeenCalled()
      }
    }
  )

  it.each<[string, CreatorWalletPolicy]>([
    ['allow', 'allow'],
    ['{ userId } equal to the creator', { userId: CREATOR }],
  ])('a person’s vessel is read under %s: the creator’s row only', async (_name, creatorWallet) => {
    seed(ownedWorld())
    const result = await prismaLedgerLoader('forged-vessel-7', { creatorWallet })
    expect(result).toStrictEqual(holdings(10, 20, 30, 40))
    expect(db.tokenBalance.findUnique).toHaveBeenCalledTimes(1)
    expect(db.tokenBalance.findUnique.mock.calls[0][0].where).toStrictEqual({ userId: CREATOR })
    expect(db.users.findFirst).not.toHaveBeenCalled()
  })

  it('a user-avatar id with no created_agents row is "no row" and never queries users or balances', async () => {
    seed(ownedWorld())
    expect(await prismaLedgerLoader('user-avatar-77')).toBeNull()
    expect(await prismaLedgerLoader('user-avatar-77', { creatorWallet: 'allow' })).toBeNull()
    expect(db.users.findFirst).not.toHaveBeenCalled()
    expect(db.tokenBalance.findUnique).not.toHaveBeenCalled()
  })

  it('a missing token_balances row is null, not zeros', async () => {
    seed({ agentic: { [`${EINSTEIN}@agentic.alchm.kitchen`]: 'u1' } })
    expect(await prismaLedgerLoader(EINSTEIN)).toBeNull()
  })

  it('a corrupt Decimal column fails the read with our validation error instead of surfacing a number', async () => {
    seed({
      agentic: { [`${EINSTEIN}@agentic.alchm.kitchen`]: 'u1' },
      rows: { u1: decimalRow('1', '1', '-5', '1') },
    })
    const error = await prismaLedgerLoader(EINSTEIN).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EsmsValueError)
    expect((error as Error).message).toContain('matter')
  })

  describe('through resolveAgentEsmsBalances', () => {
    it('a person’s vessel with the default policy: the baseline, a fallback, the private reason', async () => {
      seed(ownedWorld())
      const result = await resolveAgentEsmsBalances('forged-vessel-7', {
        loadLedger: prismaLedgerLoader,
      })
      expect(result).toStrictEqual({
        agentId: 'forged-vessel-7',
        balances: holdings(0, 0, 0, 0),
        esmsSource: 'fallback',
        degraded: { reason: 'owner wallet is private' },
      })
      expect(db.tokenBalance.findUnique).not.toHaveBeenCalled()
    })

    it('the same vessel under allow is a clean database read of the creator’s row', async () => {
      seed(ownedWorld())
      const result = await resolveAgentEsmsBalances('forged-vessel-7', {
        loadLedger: prismaLedgerLoader,
        creatorWallet: 'allow',
      })
      expect(result).toStrictEqual({
        agentId: 'forged-vessel-7',
        balances: holdings(10, 20, 30, 40),
        esmsSource: 'database',
      })
    })

    it('and for its signed-in owner, but not for anyone else', async () => {
      seed(ownedWorld())
      const owner = await resolveAgentEsmsBalances('user-avatar-42', {
        loadLedger: prismaLedgerLoader,
        creatorWallet: { userId: CREATOR },
      })
      expect(owner.esmsSource).toBe('database')
      const stranger = await resolveAgentEsmsBalances('user-avatar-42', {
        loadLedger: prismaLedgerLoader,
        creatorWallet: { userId: OTHER },
      })
      expect(stranger.esmsSource).toBe('fallback')
      expect(stranger.degraded).toStrictEqual({ reason: 'owner wallet is private' })
    })

    it('a roster agent is unaffected by the policy', async () => {
      seed(ownedWorld())
      for (const creatorWallet of [undefined, 'deny', 'allow', { userId: OTHER }] as const) {
        const result = await resolveAgentEsmsBalances(EINSTEIN, {
          loadLedger: prismaLedgerLoader,
          ...(creatorWallet === undefined ? {} : { creatorWallet }),
        })
        expect(result).toStrictEqual({
          agentId: EINSTEIN,
          balances: holdings(4.5, 3, 2, 1.0001),
          esmsSource: 'database',
        })
      }
    })

    it('strict: a refused wallet is an EsmsLedgerUnavailableError caused by the refusal', async () => {
      seed(ownedWorld())
      const error = await resolveAgentEsmsBalances('forged-vessel-7', {
        loadLedger: prismaLedgerLoader,
        strict: true,
      }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
      expect((error as EsmsLedgerUnavailableError).cause).toBeInstanceOf(CreatorWalletPrivateError)
    })
  })
})

// ─── A database that is down degrades; it does not crash ─────────────────────

describe('a database that cannot be reached', () => {
  it('a rejecting Prisma call degrades (non-strict) with a fixed reason and a sanitised log line', async () => {
    const failure = prismaFailure()
    db.users.findFirst.mockRejectedValue(failure)
    const calls: unknown[][] = []
    const result = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: prismaLedgerLoader,
      onDegraded: (...args: unknown[]) => {
        calls.push(args)
      },
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
    expect(calls).toStrictEqual([['ledger', 'PrismaClientInitializationError (P1001)']])
    expect(JSON.stringify([result, calls])).not.toMatch(/hunter2|neon|postgres/)
  })

  it('and throws, with its cause, in strict mode', async () => {
    const failure = prismaFailure()
    db.users.findFirst.mockRejectedValue(failure)
    const error = await resolveAgentEsmsBalances(EINSTEIN, {
      loadLedger: prismaLedgerLoader,
      strict: true,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EsmsLedgerUnavailableError)
    expect((error as EsmsLedgerUnavailableError).cause).toBe(failure)
  })

  it('a creator lookup failure is an outage too — never a silent fall back to the agentic user', async () => {
    db.created_agents.findFirst.mockRejectedValue(prismaFailure())
    db.users.findFirst.mockResolvedValue({ id: 'u-agentic' })
    db.tokenBalance.findUnique.mockResolvedValue(decimalRow('9', '9', '9', '9'))
    const result = await resolveAgentEsmsBalances('forged-vessel-7', {
      loadLedger: prismaLedgerLoader,
      creatorWallet: 'allow',
    })
    expect(result.esmsSource).toBe('fallback')
    expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
    expect(db.users.findFirst).not.toHaveBeenCalled()
    expect(db.tokenBalance.findUnique).not.toHaveBeenCalled()
  })

  it('a balance read failure is an outage', async () => {
    db.users.findFirst.mockResolvedValue({ id: 'u1' })
    db.tokenBalance.findUnique.mockRejectedValue(prismaFailure())
    const result = await resolveAgentEsmsBalances(EINSTEIN, { loadLedger: prismaLedgerLoader })
    expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
  })

  describe('when importing @/lib/db itself fails (no DATABASE_URL, a broken client)', () => {
    /** Load fresh copies of the store and the resolver over a `@/lib/db` that cannot load. */
    async function withBrokenDatabase<T>(
      run: (modules: {
        store: typeof import('@/lib/agents/rating/esms-ledger-store.server')
        resolver: typeof import('@/lib/agents/rating/esms-balance-resolver')
        factoryRuns: () => number
      }) => Promise<T>
    ): Promise<T> {
      let factoryRuns = 0
      vi.resetModules()
      vi.doMock('@/lib/db', () => {
        factoryRuns++
        throw new Error('DATABASE_URL is not set')
      })
      try {
        const resolver = await import('@/lib/agents/rating/esms-balance-resolver')
        const store = await import('@/lib/agents/rating/esms-ledger-store.server')
        return await run({ store, resolver, factoryRuns: () => factoryRuns })
      } finally {
        vi.doMock('@/lib/db', () => ({ prisma: db }))
        vi.resetModules()
      }
    }

    it('loading the store module does not load Prisma: the failure waits for the first read', async () => {
      await withBrokenDatabase(async ({ store, factoryRuns }) => {
        expect(typeof store.prismaLedgerLoader).toBe('function')
        expect(factoryRuns()).toBe(0)
        await expect(store.prismaLedgerStore.findBalanceRow('u1')).rejects.toBeInstanceOf(Error)
        expect(factoryRuns()).toBeGreaterThan(0)
      })
    })

    it.each([
      ['findAgenticUserId', 'x@agentic.alchm.kitchen'],
      ['findCreatorUserId', 'forged-vessel-7'],
      ['findBalanceRow', 'u1'],
    ] as const)('%s surfaces it as an ordinary rejection', async (method, argument) => {
      await withBrokenDatabase(async ({ store }) => {
        await expect(store.prismaLedgerStore[method](argument)).rejects.toBeInstanceOf(Error)
      })
    })

    it('the resolver then degrades to the labelled fallback — and strict mode throws', async () => {
      await withBrokenDatabase(async ({ store, resolver }) => {
        const result = await resolver.resolveAgentEsmsBalances(EINSTEIN, {
          loadLedger: store.prismaLedgerLoader,
        })
        expect(result.esmsSource).toBe('fallback')
        expect(result.degraded).toStrictEqual({ reason: 'ledger unavailable' })
        expect(result.balances.spirit).toBeGreaterThan(0)
        await expect(
          resolver.resolveAgentEsmsBalances(EINSTEIN, {
            loadLedger: store.prismaLedgerLoader,
            strict: true,
          })
        ).rejects.toBeInstanceOf(resolver.EsmsLedgerUnavailableError)
      })
    })

    it('a creator-owned vessel is still refused before the database is ever touched', async () => {
      // With the database down the creator lookup itself fails, so the answer is an outage —
      // but never a balance. The wallet stays private either way.
      await withBrokenDatabase(async ({ store, resolver }) => {
        const result = await resolver.resolveAgentEsmsBalances('user-avatar-42', {
          loadLedger: store.prismaLedgerLoader,
        })
        expect(result.esmsSource).toBe('fallback')
        expect(result.balances).toStrictEqual(holdings(0, 0, 0, 0))
      })
    })
  })
})

// ─── Laziness and what "server-only" means here ──────────────────────────────

describe('lazy database access', () => {
  it('does not load @/lib/db until a store method is called', async () => {
    const loaded = vi.fn()
    vi.resetModules()
    vi.doMock('@/lib/db', () => {
      loaded()
      return { prisma: db }
    })
    try {
      const fresh = await import('@/lib/agents/rating/esms-ledger-store.server')
      expect(loaded).not.toHaveBeenCalled()
      db.users.findFirst.mockResolvedValue({ id: 'u1' })
      await fresh.prismaLedgerStore.findAgenticUserId('x@agentic.alchm.kitchen')
      expect(loaded).toHaveBeenCalledTimes(1)
    } finally {
      vi.doMock('@/lib/db', () => ({ prisma: db }))
      vi.resetModules()
    }
  })

  it('a loader built over the roster alone (unknown ids, deny) reads only what it needs', async () => {
    db.created_agents.findFirst.mockResolvedValue(null)
    db.users.findFirst.mockResolvedValue(null)
    expect(await prismaLedgerLoader('some-id')).toBeNull()
    expect(db.tokenBalance.findUnique).not.toHaveBeenCalled()
  })
})

describe('the module is server-only', () => {
  const store = analyse(STORE_PATH)
  const barrel = analyse(BARREL_PATH)

  it('imports server-only as a bare side-effect import, before anything else', () => {
    expect(store.staticImports[0]).toMatchObject({ specifier: 'server-only', bare: true })
    expect(store.staticImports.map(entry => entry.specifier)).toEqual([
      'server-only',
      './esms-balance-resolver',
    ])
  })

  it('reaches Prisma only through one literal dynamic import of @/lib/db', () => {
    expect(store.dynamicImports).toEqual(['@/lib/db'])
    expect(store.staticImports.map(entry => entry.specifier)).not.toContain('@/lib/db')
    expect(store.source).not.toMatch(/from\s+['"]@prisma/)
  })

  it('exports exactly the store and the loader', () => {
    expect([...store.exportedNames].sort()).toEqual(['prismaLedgerLoader', 'prismaLedgerStore'])
  })

  it('fails to load wherever server-only throws — a client bundle would break loudly', async () => {
    vi.resetModules()
    vi.doMock('server-only', () => {
      throw new Error('This module cannot be imported from a Client Component module.')
    })
    try {
      await expect(import('@/lib/agents/rating/esms-ledger-store.server')).rejects.toBeInstanceOf(
        Error
      )
    } finally {
      vi.doMock('server-only', () => ({}))
      vi.resetModules()
    }
  })

  it('loads normally once server-only is the harmless no-op the test setup installs', async () => {
    vi.resetModules()
    try {
      const fresh = await import('@/lib/agents/rating/esms-ledger-store.server')
      expect(typeof fresh.prismaLedgerLoader).toBe('function')
    } finally {
      vi.resetModules()
    }
  })

  it('is not re-exported from the barrel, which every client module may import', () => {
    for (const specifier of barrel.reExports) {
      expect(specifier).not.toMatch(/ledger-store|\.server/)
    }
    for (const name of ['prismaLedgerStore', 'prismaLedgerLoader']) {
      expect(barrel.exportedNames).not.toContain(name)
      expect(barrel.identifiers.has(name), name).toBe(false)
    }
    expect(barrel.reExports).toContain('./esms-balance-resolver')
  })

  it('is not in the barrel at run time either', async () => {
    const rating = await import('@/lib/agents/rating')
    expect('prismaLedgerStore' in rating).toBe(false)
    expect('prismaLedgerLoader' in rating).toBe(false)
    // …while the isomorphic resolver it feeds is.
    expect(typeof rating.resolveAgentEsmsBalances).toBe('function')
    expect(typeof rating.createLedgerLoader).toBe('function')
  })

  it('is not imported by the resolver, so the isomorphic module cannot reach it', () => {
    const resolver = analyse(
      fileURLToPath(new URL('../../lib/agents/rating/esms-balance-resolver.ts', import.meta.url))
    )
    const everything = [...resolver.staticImports.map(e => e.specifier), ...resolver.dynamicImports]
    for (const specifier of everything) expect(specifier).not.toMatch(/ledger-store|\.server/)
  })
})
