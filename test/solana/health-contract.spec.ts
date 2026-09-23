// @vitest-environment node
/**
 * GET /api/solana/health, as WTEN's /admin/chain consumes it
 * (src/services/admin/solanaProgressService.ts): Bearer INTERNAL_API_SECRET,
 * 401 when the secret is not accepted, 200 healthy / 503 otherwise — both with
 * a JSON body carrying `schemaVersion`. Changing any of this needs WTEN told.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ collect: vi.fn() }))
// The route imports lib/security/internal-auth, which imports `server-only`.
// test/setup.ts stubs it for the default config; vitest.solana.config.ts has no setup file.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/solana/health', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/solana/health')>()
  return { ...real, collectSolanaOperationalHealth: mocks.collect }
})

import { GET } from '@/app/api/solana/health/route'
import {
  SOLANA_HEALTH_SCHEMA_VERSION,
  SolanaHealthBodySchema,
  SolanaHealthFailureSchema,
  SolanaHealthResponseSchema,
} from '@/lib/solana/health-contract'

const SECRET = 'internal-s3cret'
const req = (headers: Record<string, string> = {}) =>
  new Request('https://agents.alchm.kitchen/api/solana/health', { headers })

/** Build a body with the REAL collector over a fake store and fake RPC. */
async function realBody(opts: { rpcUp: boolean; heartbeatAgeMs: number }) {
  const { collectSolanaOperationalHealth } =
    await vi.importActual<typeof import('@/lib/solana/health')>('@/lib/solana/health')
  const beat = (service: string) => ({
    service,
    connectionStatus: 'connected',
    activeRpc: 'helius',
    reconnectAttempts: 0,
    queueDepth: 0,
    lastProcessedSlot: 412_345_678n,
    lastError: null,
    heartbeatAt: new Date(Date.now() - opts.heartbeatAgeMs),
  })
  const store = {
    solanaSyncOutbox: { count: async () => 3 },
    solanaProcessedTx: { findFirst: async () => ({ slot: 412_345_600n }) },
    solanaBridgeTransfer: {
      count: async () => 0,
      findFirst: async () => ({ sourceSlot: 412_000_000n }),
    },
    solanaServiceHeartbeat: { findUnique: async ({ where }: any) => beat(where.service) },
  }
  return collectSolanaOperationalHealth(store as any, {
    rpcUrls: ['https://rpc.example/one'],
    connectionFactory: () => ({
      getSlot: async () => {
        if (!opts.rpcUp) throw new Error('rpc down')
        return 412_345_999
      },
    }),
  })
}

beforeEach(() => {
  vi.stubEnv('INTERNAL_API_SECRET', SECRET)
  vi.stubEnv('ALCHM_KITCHEN_SYNC_SECRET', 'a-different-sync-secret')
})
afterEach(() => {
  vi.unstubAllEnvs()
  mocks.collect.mockReset()
})

describe('/api/solana/health contract', () => {
  it('200 with a schema-valid body when healthy', async () => {
    mocks.collect.mockResolvedValue(await realBody({ rpcUp: true, heartbeatAgeMs: 1_000 }))
    const res = await GET(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(SolanaHealthBodySchema.safeParse(body).success).toBe(true)
    expect(body).toMatchObject({ schemaVersion: SOLANA_HEALTH_SCHEMA_VERSION, status: 'healthy' })
    // u64 slots travel as strings: a Number would lose precision past 2^53.
    expect(body.rpc.observedSlot).toBe('412345999')
    expect(body.sync.lastProcessedSlot).toBe('412345678')
  })

  it('503 with a schema-valid body when degraded (RPC down, stale worker)', async () => {
    mocks.collect.mockResolvedValue(await realBody({ rpcUp: false, heartbeatAgeMs: 10 * 60_000 }))
    const res = await GET(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(SolanaHealthBodySchema.safeParse(body).success).toBe(true)
    expect(body.status).toBe('degraded')
    expect(body.sync.connectionStatus).toBe('stopped')
  })

  it('503 with the failure shape when collecting health throws', async () => {
    mocks.collect.mockRejectedValue(new Error('db unreachable'))
    const res = await GET(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(SolanaHealthFailureSchema.safeParse(body).success).toBe(true)
    expect(body).toMatchObject({ schemaVersion: 1, status: 'unhealthy', error: 'db unreachable' })
  })

  it('401 for a wrong or missing secret — what WTEN reads as "the apps do not share it"', async () => {
    const cases: Array<Record<string, string>> = [{ authorization: 'Bearer nope' }, {}]
    for (const headers of cases) {
      const res = await GET(req(headers))
      expect(res.status).toBe(401)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
    expect(mocks.collect).not.toHaveBeenCalled()
  })

  it('accepts only INTERNAL_API_SECRET while it is set (the sync secret is a fallback for when it is not)', async () => {
    mocks.collect.mockResolvedValue(await realBody({ rpcUp: true, heartbeatAgeMs: 1_000 }))
    expect((await GET(req({ authorization: 'Bearer a-different-sync-secret' }))).status).toBe(401)
    vi.stubEnv('INTERNAL_API_SECRET', '')
    expect((await GET(req({ authorization: 'Bearer a-different-sync-secret' }))).status).toBe(200)
  })

  it('every documented body parses with the published union', async () => {
    const bodies = [
      { schemaVersion: 1, ...(await realBody({ rpcUp: true, heartbeatAgeMs: 0 })) },
      {
        schemaVersion: 1,
        status: 'unhealthy',
        cluster: 'devnet',
        checkedAt: new Date().toISOString(),
        error: 'x',
      },
    ]
    for (const b of bodies) expect(SolanaHealthResponseSchema.safeParse(b).success).toBe(true)
    expect(SolanaHealthResponseSchema.safeParse({ status: 'healthy' }).success).toBe(false)
  })
})
