import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    users: { findUnique: vi.fn() },
    userSubscription: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/byok/store', () => ({
  listByokProviders: vi.fn(async () => []),
}))

import { getPaTier, getEntitlements } from '@/lib/premium/entitlements'
import { prisma } from '@/lib/db'

const mockUser = (u: any) => (prisma.users.findUnique as any).mockResolvedValue(u)
const mockSub = (s: any) => (prisma.userSubscription.findUnique as any).mockResolvedValue(s)

describe('getPaTier & getEntitlements (Token Economy)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns alchemist for authenticated account holders', async () => {
    mockUser({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      role: 'user',
      createdAt: new Date(),
    })
    mockSub(null)
    expect(await getPaTier('u1')).toBe('alchemist')
  })

  it('returns master for admin role', async () => {
    mockUser({
      id: 'u2',
      email: 'user@example.com',
      name: 'User',
      role: 'admin',
      createdAt: new Date(),
    })
    mockSub(null)
    expect(await getPaTier('u2')).toBe('master')
  })

  it('does not grant elevated entitlements from a hardcoded email identity', async () => {
    mockUser({
      id: 'u3',
      email: 'gregcastro23@gmail.com',
      name: 'Gregory Castro',
      role: 'user',
      createdAt: new Date(),
    })
    mockSub(null)
    expect(await getPaTier('u3')).toBe('alchemist')
  })

  it('returns free when user is not found (visitor / unauthenticated)', async () => {
    mockUser(null)
    mockSub(null)
    expect(await getPaTier('unknown-user')).toBe('free')
  })

  it('returns free on database error', async () => {
    ;(prisma.users.findUnique as any).mockRejectedValue(new Error('db down'))
    mockSub(null)
    expect(await getPaTier('u1')).toBe('free')
  })

  it('resolves full entitlements for account holder', async () => {
    mockUser({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      role: 'user',
      createdAt: new Date(),
    })
    mockSub({ status: 'active' })
    const entitlements = await getEntitlements('u1')
    expect(entitlements.tier).toBe('alchemist')
    expect(entitlements.hasActiveSub).toBe(true)
    expect(entitlements.byokProviders).toEqual([])
  })
})
