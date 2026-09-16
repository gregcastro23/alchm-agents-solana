/**
 * Authorization and identity binding tests for /api/jing-duels.
 *
 * Requirements:
 * 1. User-scoped GET (?userId=...) requires verified identity (session, desktop key, or service).
 *    - Unauthenticated -> 401, DB findMany is NOT called.
 *    - Cross-user -> 403, DB findMany is NOT called.
 *    - Self -> 200, DB findMany called.
 * 2. Public aggregate GET (no userId) allows unauthenticated callers (e.g. app/page.tsx)
 *    - Sanitized: returned records do NOT expose userId.
 * 3. POST binds attribution strictly to verified credential:
 *    - Web session binds to session.user.id (mismatching body.userId -> 403).
 *    - Desktop key binds to key.userId (mismatching body.userId -> 403).
 *    - Wrong/invalid x-api-key -> 401 (not treated as anonymous).
 *    - Unlinked desktop (dev-desktop-token) -> writes userId: null, source: "desktop-unlinked".
 *    - Service credential -> honors supplied userId.
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { GET, POST } from '@/app/api/jing-duels/route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [] }) }))

vi.mock('@/lib/db', () => ({
  prisma: {
    agentJingDuel: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    desktopApiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

const OWNER = 'user-owner'
const VICTIM = 'user-victim'
const INTERNAL_SECRET = 'test-internal-api-secret'
const VALID_DESKTOP_KEY = 'alchm_desktop_valid_token_123'

const getServerSessionMock = vi.mocked(getServerSession)
const prismaMock = vi.mocked(prisma)

function signIn(userId: string) {
  getServerSessionMock.mockResolvedValue({
    user: { id: userId, email: `${userId}@example.com`, name: 'Test User' },
    expires: new Date(Date.now() + 86400000).toISOString(),
  } as never)
}

function req(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

const BASE_DUEL_BODY = {
  sessionId: 'test-session',
  casterId: 'caster-1',
  targetId: 'target-1',
  attackMoveId: 'attack-1',
  counterMoveId: 'counter-1',
  stance: 'clash',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.INTERNAL_API_SECRET = INTERNAL_SECRET
  delete process.env.TAURI_DEEP_LINK_SECRET
  delete process.env.DEEP_LINK_SHARED_SECRET

  getServerSessionMock.mockResolvedValue(null)
  prismaMock.agentJingDuel.findMany.mockResolvedValue([])
  prismaMock.agentJingDuel.create.mockResolvedValue({ id: 'duel-new' } as never)
  prismaMock.desktopApiKey.findFirst.mockResolvedValue(null)
  prismaMock.desktopApiKey.update.mockResolvedValue({} as never)
})

describe('GET /api/jing-duels security & scoping', () => {
  it('rejects unauthenticated user-scoped GET (?userId=victim) without touching DB', async () => {
    const response = await GET(req('/api/jing-duels?userId=' + VICTIM))

    expect(response.status).toBe(401)
    expect(prismaMock.agentJingDuel.findMany).not.toHaveBeenCalled()
  })

  it('rejects cross-user GET (?userId=victim for user owner) without touching DB', async () => {
    signIn(OWNER)

    const response = await GET(req('/api/jing-duels?userId=' + VICTIM))

    expect(response.status).toBe(403)
    expect(prismaMock.agentJingDuel.findMany).not.toHaveBeenCalled()
  })

  it('allows self GET (?userId=owner for user owner) and queries DB', async () => {
    signIn(OWNER)
    prismaMock.agentJingDuel.findMany.mockResolvedValue([
      { id: 'd-1', userId: OWNER, casterId: 'c1', targetId: 't1' } as never,
    ])

    const response = await GET(req('/api/jing-duels?userId=' + OWNER))

    expect(response.status).toBe(200)
    expect(prismaMock.agentJingDuel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: OWNER }),
      })
    )
  })

  it('allows unauthenticated public aggregate GET (no userId) without exposing user identities', async () => {
    prismaMock.agentJingDuel.findMany.mockResolvedValue([
      {
        id: 'd-pub',
        sessionId: 's1',
        source: 'desktop',
        casterId: 'c1',
        targetId: 't1',
        attackMoveId: 'a1',
        counterMoveId: 'm1',
        stance: 'clash',
        boostElement: 'fire',
        boostMagnitude: 1.5,
        createdAt: new Date(),
      } as never,
    ])

    const response = await GET(req('/api/jing-duels?limit=6'))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.duels)).toBe(true)
    expect(json.duels.length).toBe(1)
    // CRITICAL: userId must not be exposed to unauthenticated callers
    expect(json.duels[0].userId).toBeUndefined()
    expect(prismaMock.agentJingDuel.findMany).toHaveBeenCalled()
  })

  it('allows service credential GET with named userId', async () => {
    const response = await GET(
      req('/api/jing-duels?userId=' + VICTIM, {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
      })
    )

    expect(response.status).toBe(200)
    expect(prismaMock.agentJingDuel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: VICTIM }),
      })
    )
  })

  it('rejects wrong internal secret on user-scoped GET without touching DB', async () => {
    const response = await GET(
      req('/api/jing-duels?userId=' + VICTIM, {
        headers: { 'x-internal-secret': 'wrong-secret' },
      })
    )

    expect(response.status).toBe(401)
    expect(prismaMock.agentJingDuel.findMany).not.toHaveBeenCalled()
  })

  it('allows verified desktop API key on user-scoped GET', async () => {
    prismaMock.desktopApiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      userId: OWNER,
      token: VALID_DESKTOP_KEY,
      isActive: true,
      expiresAt: null,
    } as never)

    const response = await GET(
      req('/api/jing-duels?userId=' + OWNER, {
        headers: { 'x-api-key': VALID_DESKTOP_KEY },
      })
    )

    expect(response.status).toBe(200)
    expect(prismaMock.agentJingDuel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: OWNER }),
      })
    )
  })

  it('rejects desktop key requesting another user duel history without touching DB', async () => {
    prismaMock.desktopApiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      userId: OWNER,
      token: VALID_DESKTOP_KEY,
      isActive: true,
      expiresAt: null,
    } as never)

    const response = await GET(
      req('/api/jing-duels?userId=' + VICTIM, {
        headers: { 'x-api-key': VALID_DESKTOP_KEY },
      })
    )

    expect(response.status).toBe(403)
    expect(prismaMock.agentJingDuel.findMany).not.toHaveBeenCalled()
  })

  it('rejects wrong/invalid desktop key without touching DB', async () => {
    prismaMock.desktopApiKey.findFirst.mockResolvedValue(null)

    const response = await GET(
      req('/api/jing-duels?userId=' + OWNER, {
        headers: { 'x-api-key': 'fake-key' },
      })
    )

    expect(response.status).toBe(401)
    expect(prismaMock.agentJingDuel.findMany).not.toHaveBeenCalled()
  })

  it('rejects unlinked dev-desktop-token on user-scoped GET without touching DB', async () => {
    const response = await GET(
      req('/api/jing-duels?userId=' + OWNER, {
        headers: { 'x-api-key': 'dev-desktop-token' },
      })
    )

    expect(response.status).toBe(401)
    expect(prismaMock.agentJingDuel.findMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/jing-duels security & attribution binding', () => {
  it('binds POST to authenticated web session user id', async () => {
    signIn(OWNER)

    const response = await POST(
      req('/api/jing-duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...BASE_DUEL_BODY, userId: OWNER }),
      })
    )

    expect(response.status).toBe(200)
    expect(prismaMock.agentJingDuel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: OWNER }),
      })
    )
  })

  it('rejects authenticated POST claiming someone else userId with 403', async () => {
    signIn(OWNER)

    const response = await POST(
      req('/api/jing-duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...BASE_DUEL_BODY, userId: VICTIM }),
      })
    )

    expect(response.status).toBe(403)
    expect(prismaMock.agentJingDuel.create).not.toHaveBeenCalled()
  })

  it('binds POST to verified desktop API key user id', async () => {
    prismaMock.desktopApiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      userId: OWNER,
      token: VALID_DESKTOP_KEY,
      isActive: true,
      expiresAt: null,
    } as never)

    const response = await POST(
      req('/api/jing-duels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': VALID_DESKTOP_KEY,
        },
        body: JSON.stringify({ ...BASE_DUEL_BODY, userId: OWNER }),
      })
    )

    expect(response.status).toBe(200)
    expect(prismaMock.agentJingDuel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: OWNER }),
      })
    )
  })

  it('rejects desktop key POST claiming someone else userId with 403', async () => {
    prismaMock.desktopApiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      userId: OWNER,
      token: VALID_DESKTOP_KEY,
      isActive: true,
      expiresAt: null,
    } as never)

    const response = await POST(
      req('/api/jing-duels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': VALID_DESKTOP_KEY,
        },
        body: JSON.stringify({ ...BASE_DUEL_BODY, userId: VICTIM }),
      })
    )

    expect(response.status).toBe(403)
    expect(prismaMock.agentJingDuel.create).not.toHaveBeenCalled()
  })

  it('rejects POST with invalid x-api-key with 401 and does not create duel', async () => {
    prismaMock.desktopApiKey.findFirst.mockResolvedValue(null)

    const response = await POST(
      req('/api/jing-duels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'invalid-token',
        },
        body: JSON.stringify({ ...BASE_DUEL_BODY, userId: VICTIM }),
      })
    )

    expect(response.status).toBe(401)
    expect(prismaMock.agentJingDuel.create).not.toHaveBeenCalled()
  })

  it('accepts unlinked dev-desktop-token POST but strictly sets userId: null and source: desktop-unlinked', async () => {
    const response = await POST(
      req('/api/jing-duels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'dev-desktop-token',
        },
        // Even if the unlinked client sends a spoofed userId
        body: JSON.stringify({ ...BASE_DUEL_BODY, userId: VICTIM }),
      })
    )

    expect(response.status).toBe(200)
    expect(prismaMock.agentJingDuel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          source: 'desktop-unlinked',
        }),
      })
    )
  })

  it('honors supplied userId on service credential POST', async () => {
    const response = await POST(
      req('/api/jing-duels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({ ...BASE_DUEL_BODY, userId: VICTIM }),
      })
    )

    expect(response.status).toBe(200)
    expect(prismaMock.agentJingDuel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: VICTIM }),
      })
    )
  })
})
