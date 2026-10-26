/**
 * The Prisma side of the ESMS resolver: the three `token_balances` / `created_agents` /
 * `users` reads, behind `EsmsLedgerStore`.
 *
 * Kept apart from `esms-balance-resolver.ts` on purpose. That module is isomorphic and must
 * not mention `@/lib/db` at all: `lib/db.ts` is `server-only`, and Next compiles every client
 * component twice (browser and SSR layers). A `typeof window` guard folds away in the browser
 * layer but not in the SSR one, so even a guarded dynamic `import('@/lib/db')` inside a module a
 * client component imports fails `next build` with a `server-only` error. Importing THIS file
 * from a client component fails the same way, loudly, which is the point.
 *
 * Prisma is reached through a dynamic import so a database that is down, or an environment with
 * no `DATABASE_URL`, surfaces as an ordinary rejection the resolver turns into a labelled
 * fallback, never as a module that fails to load.
 */
import 'server-only'
import { createLedgerLoader, type EsmsLedgerStore } from './esms-balance-resolver'

async function loadPrisma() {
  const { prisma } = await import('@/lib/db')
  return prisma
}

export const prismaLedgerStore: EsmsLedgerStore = {
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

/** The ledger loader for `resolveAgentEsmsBalances({ loadLedger })`, over Prisma. */
export const prismaLedgerLoader = createLedgerLoader(prismaLedgerStore)
