import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_EMAILS,
  ADMIN_HANDLES,
  isAdminSession,
  isGregIdentity,
  normalizeHandle,
  requireAdmin,
} from '@/lib/admin-auth'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

describe('admin auth helpers', () => {
  it('normalizes handles for legacy identity matching', () => {
    expect(normalizeHandle(' Greg_Castro-23 ')).toBe('gregcastro23')
  })

  it('keeps Greg access available by email and handle', () => {
    expect(isGregIdentity({ email: 'gregcastro23@gmail.com' })).toBe(true)
    expect(isGregIdentity({ name: 'Greg Castro 23' })).toBe(true)
    expect(ADMIN_EMAILS).toContain('gregcastro23@gmail.com')
    expect(ADMIN_HANDLES).toContain('gregcastro23')
  })

  it('recognizes role and configured email admin sessions', () => {
    expect(isAdminSession({ id: 'u1', email: 'user@example.com', role: 'admin' })).toBe(true)
    expect(isAdminSession({ id: 'u2', email: 'support@planetaryagents.com', role: 'user' })).toBe(
      true
    )
    expect(isAdminSession({ id: 'u3', email: 'user@example.com', role: 'user' })).toBe(false)
  })

  it('returns consistent auth failures and Greg success', async () => {
    await expect(requireAdmin(null)).resolves.toMatchObject({
      ok: false,
      status: 401,
      error: 'Authentication required',
    })

    await expect(requireAdmin({ email: 'gregcastro23@gmail.com' })).resolves.toMatchObject({
      ok: true,
      source: 'greg-identity',
    })
  })
})
