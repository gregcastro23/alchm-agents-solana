import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const findFirstMock = vi.fn()
const authMock = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    users: {
      findFirst: findFirstMock,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}))

describe('requireAdmin DB-outage break-glass allowlist', () => {
  const originalAdminEmail = process.env.AUTH_ADMIN_EMAIL
  const originalAdminEmails = process.env.ADMIN_EMAILS

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ADMIN_EMAILS
    process.env.AUTH_ADMIN_EMAIL = 'ops-admin@alchm.kitchen'
  })

  afterEach(() => {
    if (originalAdminEmail === undefined) delete process.env.AUTH_ADMIN_EMAIL
    else process.env.AUTH_ADMIN_EMAIL = originalAdminEmail
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = originalAdminEmails
  })

  it('grants degraded break-glass admin access during PG 53000 outage when session is admin and allowlisted', async () => {
    findFirstMock.mockRejectedValue(
      Object.assign(new Error('Your account or project has exceeded the quota.'), { code: '53000' })
    )
    const { requireAdmin } = await import('@/lib/admin-auth')

    const res = await requireAdmin({
      id: 'u-1',
      email: 'ops-admin@alchm.kitchen',
      role: 'admin',
    })

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.source).toBe('db-outage-allowlist')
      expect(res.degradedAuth).toBe(true)
    }
  })

  it('denies break-glass during DB outage if session role is not admin even if allowlisted', async () => {
    findFirstMock.mockRejectedValue(
      Object.assign(new Error("Can't reach database server"), { code: 'P1001' })
    )
    const { requireAdmin } = await import('@/lib/admin-auth')

    const res = await requireAdmin({
      id: 'u-2',
      email: 'ops-admin@alchm.kitchen',
      role: 'member',
    })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
  })

  it('denies break-glass during DB outage if email is not in AUTH_ADMIN_EMAIL / ADMIN_EMAILS', async () => {
    findFirstMock.mockRejectedValue(Object.assign(new Error('quota exceeded'), { code: '53000' }))
    const { requireAdmin } = await import('@/lib/admin-auth')

    const res = await requireAdmin({
      id: 'u-3',
      email: 'someone-else@example.com',
      role: 'admin',
    })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
  })

  it('never overrides live DB role: denies allowlisted user when DB says role=user', async () => {
    findFirstMock.mockResolvedValue({
      id: 'u-4',
      email: 'ops-admin@alchm.kitchen',
      name: 'Demoted Admin',
      role: 'user',
    })
    const { requireAdmin } = await import('@/lib/admin-auth')

    const res = await requireAdmin({
      id: 'u-4',
      email: 'ops-admin@alchm.kitchen',
      role: 'admin',
    })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
  })

  it('does not trigger break-glass for non-availability DB errors like P2002', async () => {
    findFirstMock.mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    )
    const { requireAdmin } = await import('@/lib/admin-auth')

    const res = await requireAdmin({
      id: 'u-5',
      email: 'ops-admin@alchm.kitchen',
      role: 'admin',
    })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
  })
})
