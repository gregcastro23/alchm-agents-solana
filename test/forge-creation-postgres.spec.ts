// @vitest-environment node
/**
 * Real PostgreSQL evidence for the production forge transaction. No database
 * query/transaction is mocked. Two independent Prisma clients race on the same
 * key, and database triggers inject failures after actual preceding writes.
 *
 * Run only against an explicitly configured disposable loopback database:
 * FORGE_TEST_DATABASE_URL=postgresql://.../forge_test bunx vitest run test/forge-creation-postgres.spec.ts
 * CI uses its ephemeral sql_prepare_gate service, after prisma db push.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import type { CreateHistoricalAgentInput } from '@/lib/historical-agents-db'

// Catch any accidentally unthreaded transaction client before it can consult
// a developer's normal DATABASE_URL. All database work below uses real clients.
vi.mock('@/lib/db', () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        throw new Error('Forge integration attempted to use the uninjected global database.')
      },
    }
  ),
}))

const databaseUrl = process.env.FORGE_TEST_DATABASE_URL
const suite = databaseUrl ? describe : describe.skip
const prefix = `forge-test-${randomUUID()}`
const hash = createHash('sha256').update('validated forge input').digest('hex')
const creators: string[] = []
let dbA: PrismaClient
let dbB: PrismaClient
let admin: Client
let forge: typeof import('@/lib/agents/forge-creation')

function agentData(agentId: string): CreateHistoricalAgentInput {
  return {
    agentId,
    name: 'PostgreSQL forge fixture',
    title: 'Integration fixture',
    birthDate: new Date('2000-01-01T12:00:00Z'),
    birthTime: '12:00',
    birthLocation: { lat: 0, lon: 0, name: 'Fixture' },
    consciousnessLevel: 'Active',
    kalchmConstant: 1,
    monicaConstant: 1.5,
    dominantElement: 'Air',
    dominantModality: 'Cardinal',
    signature: agentId,
    personalityCore: {},
    personalityShadows: [],
    personalityGifts: [],
    personalityChallenges: [],
    currentMood: 'Curious',
    evolutionStage: 0,
    specialty: 'Fixture',
    wisdomDomains: ['Fixture'],
    teachingStyle: 'Reflective',
    resonanceType: 'general',
    uniquePower: 'Fixture',
    avatar: '',
    color: '#64748b',
    symbol: 'Sun',
    aura: {},
    natalChart: { planets: { Sun: { sign: 'Aries', degree: 1 } } },
  }
}

function input(creatorId: string | undefined, clientRequestId?: string, suffix = randomUUID()) {
  const data = agentData(`${prefix}-${suffix}`)
  return {
    creatorId,
    request: clientRequestId ? { clientRequestId, requestHash: hash } : undefined,
    agentData: data,
    agent: { id: data.agentId, name: data.name, consciousness: { monicaConstant: 1.5 } },
    monicaMessage: 'Fixture consciousness created.',
  }
}

async function creator() {
  const id = `${prefix}-${randomUUID()}`
  await dbA.users.create({ data: { id, email: `${id}@example.invalid` } })
  await dbA.tokenBalance.create({
    data: {
      userId: id,
      spirit: 100,
      essence: 100,
      matter: 100,
      substance: 100,
      updatedAt: new Date(),
    },
  })
  creators.push(id)
  return id
}

async function balances(creatorId: string) {
  const row = await dbA.tokenBalance.findUniqueOrThrow({ where: { userId: creatorId } })
  return [Number(row.spirit), Number(row.essence), Number(row.matter), Number(row.substance)]
}

async function completeRows(agentId: string) {
  const email = `${agentId}@agentic.alchm.kitchen`
  const user = await dbA.users.findUnique({ where: { email } })
  return {
    historical: await dbA.historical_agents.count({ where: { agentId } }),
    user: user ? 1 : 0,
    profile: user ? await dbA.user_profiles.count({ where: { userId: user.id } }) : 0,
    balance: user ? await dbA.tokenBalance.count({ where: { userId: user.id } }) : 0,
    ownership: await dbA.created_agents.count({
      where: { blueprint: { path: ['agentId'], equals: agentId } },
    }),
  }
}

async function withTrigger(table: string, body: string, run: () => Promise<void>) {
  const name = `forge_test_${randomUUID().replaceAll('-', '')}`
  // table is supplied only by the fixed test cases, never by external input.
  await admin.query(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $test$
    BEGIN ${body} RETURN NEW; END $test$`)
  try {
    await admin.query(`CREATE TRIGGER "${name}" BEFORE INSERT ON "${table}"
      FOR EACH ROW EXECUTE FUNCTION "${name}"()`)
    await run()
  } finally {
    await admin.query(`DROP TRIGGER IF EXISTS "${name}" ON "${table}"`)
    await admin.query(`DROP FUNCTION IF EXISTS "${name}"()`)
  }
}

suite('forge creation against disposable PostgreSQL', () => {
  beforeAll(async () => {
    if (!databaseUrl) throw new Error('FORGE_TEST_DATABASE_URL is required.')
    const url = new URL(databaseUrl)
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/^\/(forge_test[a-z0-9_]*|sql_prepare_gate)$/.test(url.pathname)
    ) {
      throw new Error(
        'Forge tests require a disposable loopback forge_test* or sql_prepare_gate database.'
      )
    }
    url.searchParams.set('connection_limit', '1')
    dbA = new PrismaClient({ datasources: { db: { url: url.toString() } } })
    dbB = new PrismaClient({ datasources: { db: { url: url.toString() } } })
    admin = new Client({ connectionString: databaseUrl })
    await admin.connect()
    await Promise.all([dbA.$connect(), dbB.$connect()])
    forge = await import('@/lib/agents/forge-creation')
  }, 30_000)

  afterAll(async () => {
    if (!dbA) return
    try {
      const users = await dbA.users.findMany({
        where: { email: { startsWith: prefix } },
        select: { id: true },
      })
      const ids = users.map(user => user.id)
      await dbA.agentCreationRequest.deleteMany({ where: { creatorId: { in: creators } } })
      await dbA.created_agents.deleteMany({ where: { creatorId: { in: creators } } })
      await dbA.tokenTransaction.deleteMany({ where: { userId: { in: ids } } })
      await dbA.tokenBalance.deleteMany({ where: { userId: { in: ids } } })
      await dbA.user_profiles.deleteMany({ where: { userId: { in: ids } } })
      await dbA.users.deleteMany({ where: { id: { in: ids } } })
      await dbA.historical_agents.deleteMany({ where: { agentId: { startsWith: prefix } } })
    } finally {
      await Promise.allSettled([dbA.$disconnect(), dbB?.$disconnect(), admin?.end()])
    }
  }, 30_000)

  it('two overlapping transactions commit one complete agent and one tribute', async () => {
    const creatorId = await creator()
    const key = randomUUID()
    const first = input(creatorId, key)
    const second = input(creatorId, key)
    const [sessionA, sessionB] = await Promise.all([
      dbA.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`,
      dbB.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`,
    ])
    const pids = [sessionA[0].pid, sessionB[0].pid]
    expect(new Set(pids).size).toBe(2)
    const lock = Math.floor(Math.random() * 2_000_000_000)
    await admin.query('SELECT pg_advisory_lock($1)', [lock])
    await withTrigger(
      'agent_creation_requests',
      `IF NEW."creatorId" = '${creatorId}' THEN PERFORM pg_advisory_xact_lock(${lock}); END IF;`,
      async () => {
        const pending = Promise.all([
          forge.commitForgeCreation(first, dbA),
          forge.commitForgeCreation(second, dbB),
        ])
        // Attach a rejection handler while observing the blocked transactions.
        void pending.catch(() => {})
        try {
          const deadline = Date.now() + 3_000
          let blocked = 0
          do {
            const state = await admin.query<{ blocked: number }>(
              `SELECT count(*)::int AS blocked FROM pg_stat_activity
                WHERE pid = ANY($1::int[]) AND wait_event = 'advisory'`,
              [pids]
            )
            blocked = state.rows[0].blocked
            if (blocked === 2) break
            await new Promise(resolve => setTimeout(resolve, 20))
          } while (Date.now() < deadline)
          expect(blocked, 'Both distinct database sessions must overlap at the claim.').toBe(2)
        } finally {
          await admin.query('SELECT pg_advisory_unlock($1)', [lock])
        }
        const [a, b] = await pending
        expect(a.agent.id).toBe(b.agent.id)
        expect([a.deduplicated, b.deduplicated].filter(Boolean)).toHaveLength(1)
        expect(await completeRows(a.agent.id)).toEqual({
          historical: 1,
          user: 1,
          profile: 1,
          balance: 1,
          ownership: 1,
        })
        const loser =
          a.agent.id === first.agentData.agentId
            ? second.agentData.agentId
            : first.agentData.agentId
        expect(await completeRows(loser)).toEqual({
          historical: 0,
          user: 0,
          profile: 0,
          balance: 0,
          ownership: 0,
        })
        expect(
          await dbA.agentCreationRequest.count({ where: { creatorId, clientRequestId: key } })
        ).toBe(1)
        expect(await balances(creatorId)).toEqual([85, 90, 90, 90])
        expect(await dbA.tokenTransaction.count({ where: { userId: creatorId } })).toBe(4)

        // Simulate discarding the successful response, then retrying it later.
        const replay = await forge.commitForgeCreation(input(creatorId, key), dbB)
        expect(replay.agent.id).toBe(a.agent.id)
        expect(replay.deduplicated).toBe(true)
        expect(await balances(creatorId)).toEqual([85, 90, 90, 90])
      }
    )
  }, 20_000)

  it('the same request key belongs independently to each creator', async () => {
    const key = randomUUID()
    const first = await creator()
    const second = await creator()
    const [a, b] = await Promise.all([
      forge.commitForgeCreation(input(first, key), dbA),
      forge.commitForgeCreation(input(second, key), dbB),
    ])
    expect(a.agent.id).not.toBe(b.agent.id)
    expect(await dbA.agentCreationRequest.count({ where: { clientRequestId: key } })).toBe(2)
    expect(await balances(first)).toEqual([85, 90, 90, 90])
    expect(await balances(second)).toEqual([85, 90, 90, 90])
  })

  it('a changed input hash conflicts without another debit or agent', async () => {
    const creatorId = await creator()
    const key = randomUUID()
    await forge.commitForgeCreation(input(creatorId, key), dbA)
    const changed = input(creatorId, key)
    changed.request = {
      clientRequestId: key,
      requestHash: createHash('sha256').update('different input').digest('hex'),
    }
    await expect(forge.commitForgeCreation(changed, dbB)).rejects.toBeInstanceOf(
      forge.ForgeRequestConflict
    )
    expect(await completeRows(changed.agentData.agentId)).toEqual({
      historical: 0,
      user: 0,
      profile: 0,
      balance: 0,
      ownership: 0,
    })
    expect(await balances(creatorId)).toEqual([85, 90, 90, 90])
  })

  it.each(['users', 'user_profiles', 'token_balances', 'created_agents'])(
    'failure in %s rolls back the claim, agent, provisioning, ownership and tribute',
    async table => {
      const creatorId = await creator()
      const key = randomUUID()
      const attempt = input(creatorId, key)
      const email = `${attempt.agentData.agentId}@agentic.alchm.kitchen`
      const condition =
        table === 'users'
          ? `NEW.email = '${email}'`
          : table === 'user_profiles'
            ? `NEW."userId" IN (SELECT id FROM users WHERE email = '${email}')`
            : table === 'token_balances'
              ? `NEW.user_id IN (SELECT id FROM users WHERE email = '${email}')`
              : `NEW.blueprint->>'agentId' = '${attempt.agentData.agentId}'`
      await withTrigger(
        table,
        `IF ${condition} THEN RAISE EXCEPTION 'injected forge failure'; END IF;`,
        async () => {
          await expect(forge.commitForgeCreation(attempt, dbA)).rejects.toThrow(
            'injected forge failure'
          )
        }
      )
      expect(await completeRows(attempt.agentData.agentId)).toEqual({
        historical: 0,
        user: 0,
        profile: 0,
        balance: 0,
        ownership: 0,
      })
      expect(
        await dbA.agentCreationRequest.count({ where: { creatorId, clientRequestId: key } })
      ).toBe(0)
      expect(await balances(creatorId)).toEqual([100, 100, 100, 100])
      expect(await dbA.tokenTransaction.count({ where: { userId: creatorId } })).toBe(0)
      const retry = await forge.commitForgeCreation(attempt, dbB)
      expect(retry.agent.id).toBe(attempt.agentData.agentId)
      expect(await completeRows(retry.agent.id)).toEqual({
        historical: 1,
        user: 1,
        profile: 1,
        balance: 1,
        ownership: 1,
      })
    }
  )

  it('requests without a client ID create independent complete agents', async () => {
    const creatorId = await creator()
    const a = await forge.commitForgeCreation(input(creatorId), dbA)
    const b = await forge.commitForgeCreation(input(creatorId), dbB)
    expect(a.agent.id).not.toBe(b.agent.id)
    expect(await dbA.agentCreationRequest.count({ where: { creatorId } })).toBe(0)
    expect(await completeRows(a.agent.id)).toEqual({
      historical: 1,
      user: 1,
      profile: 1,
      balance: 1,
      ownership: 1,
    })
    expect(await balances(creatorId)).toEqual([70, 80, 80, 80])
  })
})
