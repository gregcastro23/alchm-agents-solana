/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET } from '@/app/api/agents/council-daily/route'
import { POST } from '@/app/api/agents/council-daily/question/route'

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  find: vi.fn(),
  dispatch: vi.fn(),
  auth: vi.fn(),
  limit: vi.fn(),
}))
vi.mock('@/lib/agents/council/daily-council-service', () => ({
  dailyCouncilService: { read: mocks.read, find: mocks.find },
}))
vi.mock('@/lib/agents/council/council-chamber', () => ({ dispatchTurn: mocks.dispatch }))
vi.mock('@/lib/security/privileged-api-auth', () => ({ requireUserOrService: mocks.auth }))
vi.mock('@/lib/security/model-call-limiter', () => ({ checkModelCallRateLimit: mocks.limit }))

const request = (body: unknown) =>
  new NextRequest('https://example.test/api/agents/council-daily/question', {
    method: 'POST',
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.limit.mockReturnValue({ allowed: true })
  mocks.auth.mockResolvedValue({ ok: true, kind: 'user', user: { id: 'reader' } })
})

describe('daily council routes', () => {
  it('lets anonymous readers read without invoking authentication or a model', async () => {
    mocks.read.mockResolvedValue({ edition: { id: 'today' }, status: 'published' })
    expect((await GET()).status).toBe(200)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
  it('requires authentication for an explicit question and disables caching of private responses', async () => {
    mocks.auth.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const response = await POST(request({ editionId: 'today', question: 'What matters?' }))
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
  it('uses the server edition snapshot and its observation time for all three question turns', async () => {
    const positions = { Sun: { sign: 'Libra', degree: 8 } }
    mocks.find.mockResolvedValue({
      brief: { positions, asOf: '2026-10-02T00:00:00.000Z' },
      turns: [],
    })
    mocks.dispatch.mockImplementation(async ({ turnIndex }) => ({
      success: true,
      speakerKey: turnIndex === 2 ? 'gregory' : 'sun',
      speakerName: 'Sun',
      text: 'Answer',
      newClaim: 'New thought',
      speechAct: 'synthesize',
      usedEvidenceIds: ['placement'],
      provenance: { source: 'model' },
    }))
    const response = await POST(
      request({
        editionId: 'today',
        question: 'How do I apply this?',
        skyOverride: { Sun: { sign: 'Aries' } },
      })
    )
    expect(response.status).toBe(200)
    expect(mocks.dispatch).toHaveBeenCalledTimes(3)
    for (const [call] of mocks.dispatch.mock.calls) {
      expect(call.skyOverride).toEqual(positions)
      expect(call.observationTime).toBe('2026-10-02T00:00:00.000Z')
    }
    expect((await response.json()).turns.at(-1).speakerKey).toBe('gregory')
  })
  it('rejects stale unknown IDs, empty questions, and excessive private history before generation', async () => {
    mocks.find.mockResolvedValue(null)
    expect((await POST(request({ editionId: 'missing', question: 'What now?' }))).status).toBe(409)
    expect((await POST(request({ editionId: 'today', question: '  ' }))).status).toBe(400)
    expect(
      (
        await POST(
          request({ editionId: 'today', question: 'Why?', recentTurns: Array(7).fill({}) })
        )
      ).status
    ).toBe(400)
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
  it('limits repeated paid consultations before generation', async () => {
    mocks.limit.mockReturnValue({ allowed: false, retryAfterSeconds: 20 })
    const response = await POST(request({ editionId: 'today', question: 'Why?' }))
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('20')
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
})
