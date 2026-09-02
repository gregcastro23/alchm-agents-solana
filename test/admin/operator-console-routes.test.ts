import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'

/**
 * Operator-console subsystem routes.
 *
 * These cover the properties the console's correctness actually rests on, not
 * just that the handlers return 200:
 *
 *  - the admin gate holds on every new route;
 *  - Prisma `Decimal` and `BigInt` survive JSON serialisation (a `BigInt`
 *    throws outright, and a Solana slot must not round through `Number`);
 *  - a section that cannot be read degrades to `null` **and raises an alert**,
 *    rather than rendering the same as "nothing to report";
 *  - the alert rules fire on the states they claim to detect;
 *  - a user mutation reports whether its audit write actually landed.
 */

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

// auth() falls back to the alchm.kitchen cookie bridge with no native session;
// outside a request scope cookies() throws and every route would 500.
vi.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [] }) }))

// The factory is hoisted above every import, so it can reference nothing from
// module scope — the delegate builder has to live inside it.
vi.mock('@/lib/db', () => {
  const delegate = () => ({
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  })

  return {
    prisma: {
      $queryRaw: vi.fn(),
      users: delegate(),
      tokenBalance: delegate(),
      tokenTransaction: delegate(),
      esms_claims: delegate(),
      userSubscription: delegate(),
      solanaServiceHeartbeat: delegate(),
      solanaSyncOutbox: delegate(),
      solanaBridgeTransfer: delegate(),
      verifiedSolanaWallet: delegate(),
      user_profiles: delegate(),
      user_natal_charts: delegate(),
      user_provider_keys: delegate(),
      consciousness_interactions: delegate(),
      monica_user_settings: delegate(),
      monica_user_progress: delegate(),
      historical_agents: delegate(),
      agentConversation: delegate(),
      mcp_invocations: delegate(),
      admin_audit_log: delegate(),
    },
  }
})

const getServerSessionMock = vi.mocked(getServerSession)
const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>> & {
  $queryRaw: ReturnType<typeof vi.fn>
}

function request(path: string, init?: RequestInit) {
  return new NextRequest(`http://localhost${path}`, init as never)
}

function signInAs(role: string, email = 'ops@example.com', id = 'admin-1') {
  getServerSessionMock.mockResolvedValue({
    user: { id, email, name: 'Ops', role },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as never)
}

/** Minimal stand-in for a Prisma Decimal — what the driver actually hands back. */
function decimal(value: number) {
  return { toNumber: () => value }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('operator console — admin gate', () => {
  beforeEach(() => vi.clearAllMocks())

  const routes: Array<[string, string]> = [
    ['/api/admin/economy', '@/app/api/admin/economy/route'],
    ['/api/admin/planetary', '@/app/api/admin/planetary/route'],
    ['/api/admin/codebase-health', '@/app/api/admin/codebase-health/route'],
    ['/api/admin/onboarding', '@/app/api/admin/onboarding/route'],
    ['/api/admin/users', '@/app/api/admin/users/route'],
    ['/api/admin/alerts', '@/app/api/admin/alerts/route'],
  ]

  it.each(routes)('rejects unauthenticated access to %s', async (path, modulePath) => {
    getServerSessionMock.mockResolvedValue(null)
    const { GET } = await import(modulePath)

    const response = await GET(request(path))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
  })

  it.each(routes)('rejects non-admin access to %s', async (path, modulePath) => {
    signInAs('user', 'user@example.com', 'user-1')
    db.users.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Regular User',
      role: 'user',
    } as never)
    const { GET } = await import(modulePath)

    const response = await GET(request(path))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Admin privileges required' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('token economy route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInAs('admin')
  })

  function stubHealthyEconomy() {
    db.tokenBalance.count.mockResolvedValue(10)
    db.tokenBalance.aggregate.mockResolvedValue({
      _sum: {
        spirit: decimal(100.5),
        essence: decimal(80),
        matter: decimal(60),
        substance: decimal(40),
      },
      _avg: {
        spirit: decimal(10.05),
        essence: decimal(8),
        matter: decimal(6),
        substance: decimal(4),
      },
      _max: {
        spirit: decimal(50),
        essence: decimal(40),
        matter: decimal(30),
        substance: decimal(20),
      },
    } as never)
    db.$queryRaw.mockResolvedValue([{ band: '0–24', count: BigInt(7) }] as never)

    db.tokenTransaction.groupBy.mockResolvedValue([
      { sourceType: 'daily_claim', _sum: { amount: decimal(24) }, _count: { _all: 4 } },
      { sourceType: 'unified_chat', _sum: { amount: decimal(-9) }, _count: { _all: 12 } },
    ] as never)
    db.tokenTransaction.count.mockResolvedValue(16)
    db.tokenTransaction.findMany.mockResolvedValue([] as never)

    db.esms_claims.groupBy.mockResolvedValue([{ status: 'minted', _count: { _all: 3 } }] as never)
    db.esms_claims.findMany.mockResolvedValue([] as never)

    db.userSubscription.groupBy.mockResolvedValue([] as never)
    db.userSubscription.count.mockResolvedValue(0)

    db.solanaServiceHeartbeat.findMany.mockResolvedValue([] as never)
    db.solanaSyncOutbox.count.mockResolvedValue(0)
    db.solanaBridgeTransfer.groupBy.mockResolvedValue([] as never)
    db.verifiedSolanaWallet.count.mockResolvedValue(0)
  }

  it('converts Decimal balances to plain numbers and reports circulating supply', async () => {
    stubHealthyEconomy()
    const { GET } = await import('@/app/api/admin/economy/route')

    const body = await (await GET(request('/api/admin/economy'))).json()

    expect(body.success).toBe(true)
    expect(body.supply.circulating).toBe(280.5)
    expect(body.supply.perAxis).toContainEqual({
      axis: 'spirit',
      total: 100.5,
      average: 10.05,
      max: 50,
    })
    // The raw-query histogram returns BigInt counts; they must land as numbers.
    expect(body.supply.distribution).toContainEqual({ band: '0–24', count: 7 })
  })

  it('separates faucet from sink and reports the net', async () => {
    stubHealthyEconomy()
    const { GET } = await import('@/app/api/admin/economy/route')

    const body = await (await GET(request('/api/admin/economy'))).json()

    expect(body.flow.minted24h).toBe(24)
    expect(body.flow.burned24h).toBe(9)
    expect(body.flow.net24h).toBe(15)
  })

  it('serialises a Solana slot as a string so a u64 cannot round through Number', async () => {
    stubHealthyEconomy()
    const hugeSlot = BigInt('9007199254740995') // > Number.MAX_SAFE_INTEGER
    db.solanaServiceHeartbeat.findMany.mockResolvedValue([
      {
        service: 'sync',
        connectionStatus: 'connected',
        activeRpc: 'rpc',
        reconnectAttempts: 0,
        queueDepth: 0,
        lastProcessedSlot: hugeSlot,
        lastError: null,
        heartbeatAt: new Date(),
      },
    ] as never)
    const { GET } = await import('@/app/api/admin/economy/route')

    const body = await (await GET(request('/api/admin/economy'))).json()

    expect(body.solana.services[0].lastProcessedSlot).toBe('9007199254740995')
  })

  it('raises a critical alert for claims stranded between the two ledgers', async () => {
    stubHealthyEconomy()
    db.esms_claims.findMany
      .mockResolvedValueOnce([] as never) // recent
      .mockResolvedValueOnce([
        {
          id: 'claim-stuck-1',
          userId: 'user-1',
          status: 'debited',
          spirit: decimal(5),
          essence: decimal(5),
          matter: decimal(5),
          substance: decimal(5),
          error: null,
          updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
      ] as never)
    const { GET } = await import('@/app/api/admin/economy/route')

    const body = await (await GET(request('/api/admin/economy'))).json()

    const alert = body.alerts.find((a: { id: string }) => a.id === 'economy:claims-stuck')
    expect(alert).toBeDefined()
    expect(alert.severity).toBe('critical')
    expect(body.chain.stuck[0].amount).toBe(20)
  })

  it('reports an unreadable section as degraded rather than as empty', async () => {
    stubHealthyEconomy()
    db.tokenBalance.count.mockRejectedValue(new Error('relation "token_balances" does not exist'))
    const { GET } = await import('@/app/api/admin/economy/route')

    const body = await (await GET(request('/api/admin/economy'))).json()

    expect(body.supply).toBeNull()
    expect(body.degraded).toContainEqual({
      section: 'supply',
      error: 'relation "token_balances" does not exist',
    })
    expect(body.alerts.some((a: { id: string }) => a.id.includes('unreadable'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('onboarding funnel route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInAs('admin')
  })

  it('measures every step against the signup cohort, not against the previous step', async () => {
    db.users.count.mockResolvedValue(10)
    db.users.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        id: `u${index}`,
        email: `u${index}@example.com`,
        name: null,
        provider: 'email',
        verified: false,
        createdAt: new Date(),
        lastLogin: null,
        walletAddress: null,
      })) as never
    )
    db.user_profiles.count.mockResolvedValue(4)
    db.tokenBalance.count.mockResolvedValue(9)
    db.user_natal_charts.findMany.mockResolvedValue([{ userId: 'u0' }] as never)
    db.consciousness_interactions.findMany.mockResolvedValue([] as never)
    db.user_profiles.findMany.mockResolvedValue([] as never)
    db.monica_user_settings.count.mockResolvedValue(0)
    db.monica_user_progress.count.mockResolvedValue(0)
    db.monica_user_progress.aggregate.mockResolvedValue({
      _avg: { level: null, totalInteractions: null },
    } as never)

    const { GET } = await import('@/app/api/admin/onboarding/route')
    const body = await (await GET(request('/api/admin/onboarding'))).json()

    const weekly = body.funnels.find((f: { window: string }) => f.window === '7d')
    const byId = Object.fromEntries(
      weekly.steps.map((s: { id: string; count: number; pctOfSignups: number }) => [s.id, s])
    )

    // A balance without a profile stays visible: 9 funded against 4 profiled is
    // only representable because each step is counted absolutely.
    expect(byId.profile.count).toBe(4)
    expect(byId.tokens.count).toBe(9)
    expect(byId.tokens.pctOfSignups).toBe(90)
  })

  it('flags a cohort in which nobody was funded', async () => {
    db.users.count.mockResolvedValue(5)
    db.users.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        id: `u${index}`,
        email: `u${index}@example.com`,
        name: null,
        provider: 'email',
        verified: false,
        createdAt: new Date(),
        lastLogin: null,
        walletAddress: null,
      })) as never
    )
    db.user_profiles.count.mockResolvedValue(5)
    db.tokenBalance.count.mockResolvedValue(0)
    db.user_natal_charts.findMany.mockResolvedValue([] as never)
    db.consciousness_interactions.findMany.mockResolvedValue([] as never)
    db.user_profiles.findMany.mockResolvedValue([] as never)
    db.monica_user_settings.count.mockResolvedValue(0)
    db.monica_user_progress.count.mockResolvedValue(0)
    db.monica_user_progress.aggregate.mockResolvedValue({
      _avg: { level: null, totalInteractions: null },
    } as never)

    const { GET } = await import('@/app/api/admin/onboarding/route')
    const body = await (await GET(request('/api/admin/onboarding'))).json()

    const alert = body.alerts.find((a: { id: string }) => a.id === 'onboarding:no-funding')
    expect(alert).toBeDefined()
    expect(alert.severity).toBe('critical')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('codebase health route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInAs('admin')
    db.historical_agents.count.mockResolvedValue(72)
    db.agentConversation.count.mockResolvedValue(0)
    db.users.count.mockResolvedValue(0)
    db.user_profiles.count.mockResolvedValue(0)
  })

  it('states that a skipped TypeScript census is unknown rather than zero', async () => {
    const { GET } = await import('@/app/api/admin/codebase-health/route')
    const body = await (await GET(request('/api/admin/codebase-health'))).json()

    if (!body.manifest.typeErrors.ran) {
      const alert = body.alerts.find((a: { id: string }) => a.id === 'codebase:type-census-skipped')
      expect(alert).toBeDefined()
      expect(alert.detail).toContain('unknown rather than zero')
    } else {
      expect(body.manifest.typeErrors.total).toBeGreaterThanOrEqual(0)
    }
  })

  it('reports manifest provenance so a stale scan is never read as live', async () => {
    const { GET } = await import('@/app/api/admin/codebase-health/route')
    const body = await (await GET(request('/api/admin/codebase-health'))).json()

    expect(typeof body.manifest.generatedAt).toBe('string')
    expect(body.manifest).toHaveProperty('stale')
    expect(body.manifest).toHaveProperty('ageMinutes')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('user administration mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInAs('admin')
  })

  const params = (userId: string) => ({ params: Promise.resolve({ userId }) })

  function patch(userId: string, body: unknown) {
    return request(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost',
      },
    })
  }

  it('applies a role change and records it to the audit log', async () => {
    db.users.findUnique.mockResolvedValue({
      id: 'user-9',
      email: 'someone@example.com',
      name: 'Someone',
      role: 'user',
      verified: false,
      isAgentic: false,
    } as never)
    db.users.update.mockResolvedValue({
      id: 'user-9',
      email: 'someone@example.com',
      name: 'Someone',
      role: 'moderator',
      verified: false,
      isAgentic: false,
    } as never)
    db.admin_audit_log.create.mockResolvedValue({ id: 'audit-1' } as never)

    const { PATCH } = await import('@/app/api/admin/users/[userId]/route')
    const body = await (
      await PATCH(patch('user-9', { role: 'moderator' }), params('user-9'))
    ).json()

    expect(body.success).toBe(true)
    expect(body.changed).toEqual(['role'])
    expect(body.audit).toEqual({ recorded: true, id: 'audit-1' })
    expect(db.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'moderator' } })
    )
  })

  it('refuses the change when the mandatory audit write is unavailable', async () => {
    db.users.findUnique.mockResolvedValue({
      id: 'user-9',
      email: 'someone@example.com',
      name: 'Someone',
      role: 'user',
      verified: false,
      isAgentic: false,
    } as never)
    db.users.update.mockResolvedValue({
      id: 'user-9',
      email: 'someone@example.com',
      name: 'Someone',
      role: 'user',
      verified: true,
      isAgentic: false,
    } as never)
    db.admin_audit_log.create.mockRejectedValue(
      new Error('relation "admin_audit_log" does not exist')
    )

    const { PATCH } = await import('@/app/api/admin/users/[userId]/route')
    const response = await PATCH(patch('user-9', { verified: true }), params('user-9'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.success).toBe(false)
    expect(body.error).toContain('audit')
    expect(db.users.update).not.toHaveBeenCalled()
  })

  it('refuses to demote the last database-backed admin', async () => {
    db.users.findUnique.mockResolvedValue({
      id: 'owner-1',
      email: 'only-admin@example.com',
      name: 'Only Admin',
      role: 'admin',
      verified: true,
      isAgentic: false,
    } as never)
    db.users.count.mockResolvedValue(1)

    const { PATCH } = await import('@/app/api/admin/users/[userId]/route')
    const response = await PATCH(patch('owner-1', { role: 'user' }), params('owner-1'))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('last database admin')
    expect(db.users.update).not.toHaveBeenCalled()
  })

  it('rejects a field that is not writable from the console', async () => {
    const { PATCH } = await import('@/app/api/admin/users/[userId]/route')
    const response = await PATCH(patch('user-9', { spirit: 999 }), params('user-9'))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('No writable field')
    expect(db.users.update).not.toHaveBeenCalled()
  })

  it('rejects an unknown role', async () => {
    const { PATCH } = await import('@/app/api/admin/users/[userId]/route')
    const response = await PATCH(patch('user-9', { role: 'superuser' }), params('user-9'))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('role must be one of')
  })

  it('is a no-op when the supplied values already match', async () => {
    db.users.findUnique.mockResolvedValue({
      id: 'user-9',
      email: 'someone@example.com',
      name: 'Someone',
      role: 'user',
      verified: false,
      isAgentic: false,
    } as never)

    const { PATCH } = await import('@/app/api/admin/users/[userId]/route')
    const body = await (await PATCH(patch('user-9', { role: 'user' }), params('user-9'))).json()

    expect(body.unchanged).toBe(true)
    expect(db.users.update).not.toHaveBeenCalled()
    expect(db.admin_audit_log.create).not.toHaveBeenCalled()
  })
})
