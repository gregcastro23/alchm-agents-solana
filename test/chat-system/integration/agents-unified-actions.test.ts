// Tests for the CRUD/analytics actions on /api/agents/unified that
// were previously 501 stubs (B2 in the PA completion punch list).
// Each action proxies to the @/lib/backend client, which is mocked
// here so we exercise the route's switch wiring without a live
// Railway backend.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted so the mock object exists before vi.mock's hoisted
// factory references it (otherwise: "Cannot access before
// initialization").
const backendMock = vi.hoisted(() => ({
  agents: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    stats: vi.fn(),
    search: vi.fn(),
    chat: vi.fn(),
  },
}))

vi.mock('@/lib/backend', () => ({ backend: backendMock }))

// The chat path pulls in auth + economy; the CRUD actions under test
// don't touch them, but the module-level imports must still resolve.
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn(async () => null) }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))
vi.mock('@/lib/agents/persona/build-agent-context', () => ({
  buildAgentContext: vi.fn(() => null),
}))
vi.mock('@/lib/consciousness-persistence', () => ({
  consciousnessPersistence: { logInteraction: vi.fn() },
}))

import { POST } from '@/app/api/agents/unified/route'

function postWith(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/agents/unified', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('agents/unified actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('update proxies to backend.agents.update with the patch', async () => {
    backendMock.agents.update.mockResolvedValue({ agentId: 'socrates', name: 'Sócrates' })
    const res = await POST(
      postWith({ action: 'update', parameters: { agentId: 'socrates', name: 'Sócrates' } })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(backendMock.agents.update).toHaveBeenCalledWith('socrates', { name: 'Sócrates' })
  })

  it('update without agentId returns 500 (thrown error)', async () => {
    const res = await POST(postWith({ action: 'update', parameters: { name: 'x' } }))
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(backendMock.agents.update).not.toHaveBeenCalled()
  })

  it('delete proxies to backend.agents.delete', async () => {
    backendMock.agents.delete.mockResolvedValue({ success: true, agentId: 'rumi' })
    const res = await POST(postWith({ action: 'delete', parameters: { agentId: 'rumi' } }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(backendMock.agents.delete).toHaveBeenCalledWith('rumi')
    expect(data.data.success).toBe(true)
  })

  it('stats proxies to backend.agents.stats', async () => {
    backendMock.agents.stats.mockResolvedValue({ total: 52, byEra: {}, byConsciousnessLevel: {} })
    const res = await POST(postWith({ action: 'stats' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(backendMock.agents.stats).toHaveBeenCalledOnce()
    expect(data.data.total).toBe(52)
  })

  it('search proxies query + limit to backend.agents.search', async () => {
    backendMock.agents.search.mockResolvedValue({ query: 'plato', count: 1, agents: [] })
    const res = await POST(
      postWith({ action: 'search', parameters: { query: 'plato', limit: 10 } })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(backendMock.agents.search).toHaveBeenCalledWith('plato', 10)
    expect(data.data.query).toBe('plato')
  })

  it('search without a query returns 500', async () => {
    const res = await POST(postWith({ action: 'search', parameters: {} }))
    expect(res.status).toBe(500)
    expect(backendMock.agents.search).not.toHaveBeenCalled()
  })

  it('dashboard composes stats + recent agents', async () => {
    backendMock.agents.stats.mockResolvedValue({ total: 3, byEra: {}, byConsciousnessLevel: {} })
    backendMock.agents.list.mockResolvedValue([{ agentId: 'a' }, { agentId: 'b' }])
    const res = await POST(postWith({ action: 'dashboard' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(backendMock.agents.stats).toHaveBeenCalledOnce()
    expect(backendMock.agents.list).toHaveBeenCalledWith({ skip: 0, limit: 12 })
    expect(data.data.stats.total).toBe(3)
    expect(data.data.recentAgents).toHaveLength(2)
  })

  it('evolve still returns 501 directing to the consciousness route', async () => {
    const res = await POST(postWith({ action: 'evolve', parameters: { agentId: 'x' } }))
    const data = await res.json()

    expect(res.status).toBe(501)
    expect(data.success).toBe(false)
    expect(data.error).toContain('/api/consciousness/evolve')
  })
})
