import { describe, expect, it, vi } from 'vitest'
import { isAdminSession, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    users: {
      findFirst: vi.fn(),
    },
  },
}))

const users = vi.mocked(prisma.users)

describe('admin auth helpers', () => {
  it('recognizes only role-backed admin sessions', () => {
    expect(isAdminSession({ id: 'u1', email: 'user@example.com', role: 'admin' })).toBe(true)
    expect(isAdminSession({ id: 'u2', email: 'support@planetaryagents.com', role: 'user' })).toBe(
      false
    )
    expect(isAdminSession({ name: 'Greg Castro 23', role: 'user' })).toBe(false)
    expect(isAdminSession({ id: 'u3', email: 'user@example.com', role: 'user' })).toBe(false)
  })

  it('returns consistent auth failures and resolves admin authority from the database', async () => {
    await expect(requireAdmin(null)).resolves.toMatchObject({
      ok: false,
      status: 401,
      error: 'Authentication required',
    })

    users.findFirst.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'ops@example.com',
      name: 'Ops',
      role: 'admin',
    } as never)

    await expect(
      requireAdmin({ id: 'admin-1', email: 'ops@example.com', role: 'user' })
    ).resolves.toMatchObject({
      ok: true,
      source: 'db-role',
    })

    users.findFirst.mockResolvedValueOnce({
      id: 'owner-1',
      email: 'gregcastro23@gmail.com',
      name: 'Greg Castro 23',
      role: 'user',
    } as never)

    await expect(
      requireAdmin({ id: 'owner-1', email: 'gregcastro23@gmail.com', role: 'user' })
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
    })
  })

  it('does not trust a stale admin role embedded in the session token', async () => {
    users.findFirst.mockResolvedValueOnce({
      id: 'admin-1',
      email: 'ops@example.com',
      name: 'Ops',
      role: 'user',
    } as never)

    await expect(
      requireAdmin({ id: 'admin-1', email: 'ops@example.com', role: 'admin' })
    ).resolves.toMatchObject({ ok: false, status: 403 })
    expect(users.findFirst).toHaveBeenCalledOnce()
  })
})
