// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    desktopApiKey: { findFirst: vi.fn(), update: vi.fn() },
    users: { findUnique: vi.fn() },
    agent_action_events: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/security/privileged-api-auth', () => ({ requireAdminRequest: vi.fn() }))
vi.mock('@/lib/agents/resolve-any-agent', () => ({ resolveAnyAgent: vi.fn() }))
vi.mock('@/lib/wtenClient', () => ({ postAgentWeeklyMenu: vi.fn(), getAgentWeeklyMenu: vi.fn() }))

import { prisma } from '@/lib/db'
import { requireAdminRequest } from '@/lib/security/privileged-api-auth'
import { resolveAnyAgent } from '@/lib/agents/resolve-any-agent'
import { postAgentWeeklyMenu } from '@/lib/wtenClient'
import { POST } from '@/app/api/menu-planner/publish/route'
import { POST as legacyPOST } from '@/app/api/menu-planner/weekly/route'

const menu = () => ({
  agentSlug: 'hildegard-of-bingen',
  agentDisplayName: 'Client-supplied name',
  weekStartDate: '2026-10-11T00:00:00.000Z',
  status: 'draft',
  shareToFeed: false,
  title: 'A week of spelt',
  summary: 'Twenty-eight meals.',
  meals: Array.from({ length: 28 }, (_, i) => ({
    id: `meal-${i}`,
    dayOfWeek: Math.floor(i / 4),
    mealType: ['breakfast', 'lunch', 'dinner', 'snack'][i % 4],
    servings: 1,
    recipe: { id: `recipe-${i}`, name: 'Spelt with herbs' },
  })),
})
const result = { success: true, menu: { id: 'published-menu' }, feedShared: true }
const records = new Map<string, any>()
function request(
  body: unknown = { menu: menu() },
  token: string | null = 'publisher-master',
  key: string | null = 'publication-one'
) {
  return new NextRequest('https://agents.test/api/menu-planner/publish', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-API-Key': token } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  records.clear()
  vi.stubEnv('PA_USER_API_KEY', 'publisher-master')
  vi.mocked(requireAdminRequest).mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
  })
  vi.mocked(prisma.desktopApiKey.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.desktopApiKey.update).mockResolvedValue({} as any)
  vi.mocked(prisma.users.findUnique).mockResolvedValue({ role: 'admin' } as any)
  vi.mocked(resolveAnyAgent).mockResolvedValue({
    id: 'hildegard-of-bingen',
    name: 'Hildegard of Bingen',
  } as any)
  vi.mocked(postAgentWeeklyMenu).mockResolvedValue(result as any)
  vi.mocked(prisma.agent_action_events.create).mockImplementation(async ({ data }: any) => {
    if (records.has(data.idempotencyKey))
      throw Object.assign(new Error('Duplicate'), { code: 'P2002' })
    const row = { ...data, id: data.idempotencyKey }
    records.set(data.idempotencyKey, row)
    return row
  })
  vi.mocked(prisma.agent_action_events.findUnique).mockImplementation(
    async ({ where }: any) => records.get(where.idempotencyKey) ?? null
  )
  vi.mocked(prisma.agent_action_events.update).mockImplementation(async ({ where, data }: any) => {
    const row = records.get(where.id)
    Object.assign(row, data)
    return row
  })
})
afterEach(() => vi.unstubAllEnvs())

describe('weekly menu publication authorization', () => {
  it.each([null, 'dev-desktop-token', 'unknown-key'])(
    'rejects unverified caller %s before a write',
    async token => {
      expect((await POST(request(undefined, token))).status).toBe(401)
      expect(postAgentWeeklyMenu).not.toHaveBeenCalled()
      expect(prisma.agent_action_events.create).not.toHaveBeenCalled()
    }
  )
  it('verifies desktop key expiry and refuses ordinary users even with spoofed role/tier fields', async () => {
    vi.mocked(prisma.desktopApiKey.findFirst).mockResolvedValue({
      id: 'key-1',
      userId: 'ordinary-user',
    } as any)
    vi.mocked(prisma.users.findUnique).mockResolvedValue({ role: 'user' } as any)
    const response = await POST(
      request({ menu: menu(), auth_tier: 'alchemist' }, 'verified-user-key')
    )
    expect(response.status).toBe(403)
    expect(prisma.desktopApiKey.findFirst).toHaveBeenCalledWith({
      where: {
        token: 'verified-user-key',
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
    })
    expect(postAgentWeeklyMenu).not.toHaveBeenCalled()
  })
  it.each(['admin', 'operator', 'alchemist'])(
    'permits a verified desktop publisher with role %s',
    async role => {
      vi.mocked(prisma.desktopApiKey.findFirst).mockResolvedValue({
        id: 'key-1',
        userId: 'publisher-1',
      } as any)
      vi.mocked(prisma.users.findUnique).mockResolvedValue({ role } as any)
      expect((await POST(request(undefined, 'linked-publisher'))).status).toBe(200)
      expect([...records.values()][0].metadataPayload.actorId).toBe('user:publisher-1')
    }
  )
  it('supports an origin-checked browser admin without a desktop key', async () => {
    vi.mocked(requireAdminRequest).mockResolvedValue({
      ok: true,
      admin: {
        ok: true,
        user: { id: 'admin-1', role: 'admin' },
        source: 'db-role',
      },
    })
    expect((await POST(request(undefined, null))).status).toBe(200)
    expect(requireAdminRequest).toHaveBeenCalled()
  })
  it('fails closed when identity or reservation persistence is unavailable', async () => {
    vi.mocked(prisma.agent_action_events.create).mockRejectedValue(new Error('DB unavailable'))
    expect((await POST(request())).status).toBe(503)
    expect(postAgentWeeklyMenu).not.toHaveBeenCalled()
  })
  it('does not allow the legacy POST to bypass authorization', async () => {
    expect((await legacyPOST(request(menu(), null))).status).toBe(401)
    expect(postAgentWeeklyMenu).not.toHaveBeenCalled()
  })
})

describe('weekly menu publication reservation', () => {
  it('requires an explicit idempotency key before publication', async () => {
    expect((await POST(request(undefined, undefined, null))).status).toBe(400)
    expect(postAgentWeeklyMenu).not.toHaveBeenCalled()
  })
  it('validates all 28 unique slots and refuses caller identity overrides', async () => {
    const incomplete = menu()
    incomplete.meals[1] = incomplete.meals[0]
    expect((await POST(request({ menu: incomplete }))).status).toBe(400)
    expect((await POST(request({ menu: menu(), userId: 'victim' }))).status).toBe(400)
    expect(postAgentWeeklyMenu).not.toHaveBeenCalled()
  })
  it('reserves before dispatch, forces explicit publication, and replays the exact result', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(result)
    expect(postAgentWeeklyMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        shareToFeed: true,
        agentDisplayName: 'Hildegard of Bingen',
      }),
      expect.stringMatching(/^weekly-menu-publication:/)
    )
    expect(vi.mocked(prisma.agent_action_events.create).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(postAgentWeeklyMenu).mock.invocationCallOrder[0]
    )
    const replay = await POST(request())
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true')
    expect(await replay.json()).toEqual(result)
    expect(postAgentWeeklyMenu).toHaveBeenCalledOnce()
  })
  it('rejects key reuse for different menu content', async () => {
    await POST(request())
    expect((await POST(request({ menu: { ...menu(), title: 'Changed menu' } }))).status).toBe(409)
    expect(postAgentWeeklyMenu).toHaveBeenCalledOnce()
  })
  it('binds reservations to the verified actor', async () => {
    await POST(request())
    vi.mocked(prisma.desktopApiKey.findFirst).mockResolvedValue({
      id: 'key-2',
      userId: 'publisher-2',
    } as any)
    expect((await POST(request(undefined, 'publisher-2-key'))).status).toBe(200)
    const rows = [...records.values()]
    expect(rows[0].idempotencyKey).not.toBe(rows[1].idempotencyKey)
    expect(rows[1].metadataPayload.actorId).toBe('user:publisher-2')
  })
  it('does not retry an uncertain write under the same key', async () => {
    vi.mocked(postAgentWeeklyMenu).mockRejectedValue(new Error('Connection closed after send'))
    expect((await POST(request())).status).toBe(502)
    expect((await POST(request())).status).toBe(409)
    expect(postAgentWeeklyMenu).toHaveBeenCalledOnce()
    expect([...records.values()][0].status).toBe('publication_uncertain')
  })
  it('blocks a second in-flight request', async () => {
    let finish!: (value: any) => void
    vi.mocked(postAgentWeeklyMenu).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const first = POST(request())
    await vi.waitFor(() => expect(postAgentWeeklyMenu).toHaveBeenCalledOnce())
    expect((await POST(request())).status).toBe(409)
    finish(result)
    expect((await first).status).toBe(200)
    expect(postAgentWeeklyMenu).toHaveBeenCalledOnce()
  })
})
