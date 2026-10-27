import { afterEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { adminHref } from '@/lib/admin/nav'

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: async () => ({ ok: true, user: { id: 'ops' } }),
  adminErrorResponse: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: async () => [{ value: 1 }],
    mcp_invocations: { count: async () => 0 },
    agentConversation: { aggregate: async () => ({ _max: { createdAt: null } }) },
  },
}))
afterEach(() => vi.unstubAllGlobals())

it('collects progression and recipe publishing alerts in the overview digest', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    expect(init?.headers).toEqual({ cookie: 'admin-session=fixture' })
    const path = new URL(url).pathname
    const alerts = ['/api/admin/leveling-summary', '/api/admin/recipe-activity'].includes(path)
      ? [
          {
            id: `fixture:${path}`,
            severity: 'warning',
            source: 'agents',
            title: path,
            detail: 'Source unavailable',
            href: path.includes('leveling') ? '/admin/leveling' : '/admin/recipes',
          },
        ]
      : []
    return Response.json({ alerts })
  })
  vi.stubGlobal('fetch', fetch)
  const { GET } = await import('@/app/api/admin/alerts/route')
  const response = await GET(
    new NextRequest('http://localhost/api/admin/alerts', {
      headers: { cookie: 'admin-session=fixture' },
    })
  )
  const report = await response.json()
  for (const path of ['/api/admin/leveling-summary', '/api/admin/recipe-activity']) {
    expect(report.alerts).toContainEqual(expect.objectContaining({ id: `fixture:${path}` }))
  }
  expect(report.subsystems).toContainEqual(
    expect.objectContaining({ id: 'leveling', ok: true, alertCount: 1 })
  )
  expect(report.subsystems).toContainEqual(
    expect.objectContaining({ id: 'recipe-activity', ok: true, alertCount: 1 })
  )
  expect(adminHref('tab:recipe-activity')).toBe('/admin/recipes')
})
