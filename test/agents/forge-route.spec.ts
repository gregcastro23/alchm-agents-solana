import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  replay: vi.fn(),
  commit: vi.fn(),
  sync: vi.fn(),
  horoscope: vi.fn(),
  currentAlchemy: vi.fn(),
  synthesize: vi.fn(),
  generate: vi.fn(),
  blueprint: vi.fn(),
  generateId: vi.fn(),
  rateLimit: vi.fn(),
  db: {},
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ prisma: mocks.db }))
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: mocks.rateLimit,
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/utils', () => ({ generateId: mocks.generateId }))
vi.mock('@/lib/agents/agentic-user-sync', () => ({ syncAgenticUserToWten: mocks.sync }))
vi.mock('@/lib/agents/forge-creation', () => ({
  readForgeReplay: mocks.replay,
  commitForgeCreation: mocks.commit,
  ForgeRequestConflict: class ForgeRequestConflict extends Error {},
  InsufficientForgeFunds: class InsufficientForgeFunds extends Error {},
  ForgeUnavailable: class ForgeUnavailable extends Error {},
}))
vi.mock('@/lib/backend', () => ({ getAlchemicalQuantitiesLegacy: mocks.currentAlchemy }))
vi.mock('@/lib/monica/horoscope-generator', () => ({
  generateAccurateHoroscope: mocks.horoscope,
}))
vi.mock('@/lib/monica/monica-constant', () => ({ analyzePhiAxisIndex: vi.fn() }))
vi.mock('@/lib/monica/fetch-current-positions', () => ({
  fetchCurrentPlanetaryPositions: vi.fn(),
}))
vi.mock('@/lib/consciousness/chart-synthesizer', () => ({
  ChartSynthesizer: class ChartSynthesizer {
    synthesize = mocks.synthesize
  },
}))
vi.mock('@/lib/consciousness/agent-generator', () => ({
  AgentGenerator: class AgentGenerator {
    generateFromSynthesis = mocks.generate
  },
}))
vi.mock('@/lib/api-client/consciousness-client', () => ({
  ConsciousnessClient: class ConsciousnessClient {
    createAgentOfMoment = mocks.blueprint
  },
}))
vi.mock('@/lib/thermodynamics/kalchm', () => ({ calculateKalchm: () => 0.149 }))

import { POST } from '@/app/api/create-agent/route'
import {
  ForgeRequestConflict,
  ForgeUnavailable,
  InsufficientForgeFunds,
} from '@/lib/agents/forge-creation'
import { ForgeRequestSchema, forgeRequestHash } from '@/lib/agents/forge-request'

const clientRequestId = 'e4e576f3-d554-4f0f-92f7-44c98c63e6a5'
const input = {
  name: 'Ada',
  purpose: 'Explore',
  birthInfo: {
    year: 1990,
    month: 2,
    day: 15,
    hour: 10,
    minute: 24,
    latitude: 40.7128,
    longitude: -74.006,
  },
  clientRequestId,
}
const original = {
  success: true,
  agent: {
    id: 'agent-original',
    name: 'Ada',
    consciousness: { monicaConstant: 1.2 },
    personality: { storedOriginal: true },
  },
  balances: { spirit: 85, essence: 90, matter: 90, substance: 90 },
  monicaMessage: 'Original creation.',
  deduplicated: true,
}

function request(body: unknown) {
  return rawRequest(JSON.stringify(body))
}

function rawRequest(body: string) {
  return new NextRequest('http://localhost/api/create-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

function expectNoCreationWork() {
  expect(mocks.generateId).not.toHaveBeenCalled()
  expect(mocks.horoscope).not.toHaveBeenCalled()
  expect(mocks.currentAlchemy).not.toHaveBeenCalled()
  expect(mocks.synthesize).not.toHaveBeenCalled()
  expect(mocks.generate).not.toHaveBeenCalled()
  expect(mocks.blueprint).not.toHaveBeenCalled()
  expect(mocks.commit).not.toHaveBeenCalled()
  expect(mocks.sync).not.toHaveBeenCalled()
}

describe('POST /api/create-agent replay boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'creator-a' } })
    mocks.rateLimit.mockReturnValue({ ok: true })
    mocks.replay.mockResolvedValue(original)
    mocks.generateId.mockReturnValue('agent-new')
    mocks.horoscope.mockResolvedValue({ planets: {} })
    mocks.currentAlchemy.mockResolvedValue({})
    mocks.synthesize.mockReturnValue({
      baseChart: {},
      momentChart: {},
      sourceCharts: [],
      consciousness: { spirit: 1, essence: 2, matter: 3, substance: 4 },
    })
    mocks.blueprint.mockResolvedValue({
      identity: { name: 'Ada', title: 'Crafted Vessel' },
      consciousness: { monicaConstant: 1.2, level: 'Active' },
    })
    mocks.generate.mockReturnValue({
      consciousness: { monicaConstant: 1.2, dominantElement: 'Air' },
      personality: { core: { essence: 'Original' } },
      synthesis: {},
    })
    mocks.commit.mockResolvedValue({ ...original, deduplicated: undefined })
    mocks.sync.mockResolvedValue(undefined)
  })

  it.each(['{', '', '{"clientRequestId":'])(
    'rejects malformed JSON before replay: %j',
    async raw => {
      const response = await POST(rawRequest(raw))

      expect(response.status).toBe(400)
      expect(mocks.replay).not.toHaveBeenCalled()
      expectNoCreationWork()
    }
  )

  it.each([
    null,
    [],
    [input],
    true,
    42,
    'agent-original',
    { clientRequestId },
    { ...input, name: '' },
    { ...input, name: '   ' },
    { ...input, name: 42 },
    { ...input, name: 'a'.repeat(101) },
    { ...input, birthInfo: null },
    { ...input, birthInfo: [] },
    { ...input, birthInfo: { ...input.birthInfo, latitude: 91 } },
    { ...input, birthInfo: { ...input.birthInfo, longitude: -181 } },
    { ...input, birthInfo: { ...input.birthInfo, latitude: '40.7128' } },
    { ...input, birthInfo: { ...input.birthInfo, longitude: null } },
    { ...input, birthInfo: { ...input.birthInfo, year: 0 } },
    { ...input, birthInfo: { ...input.birthInfo, month: 13 } },
    { ...input, birthInfo: { ...input.birthInfo, day: 30 } },
    { ...input, birthInfo: { ...input.birthInfo, hour: 24 } },
    { ...input, birthInfo: { ...input.birthInfo, minute: 60 } },
    { ...input, clientRequestId: 'not-a-uuid' },
    { ...input, stats: { power: '50' } },
    { ...input, personalContext: { lifeStory: {} } },
  ])('rejects malformed payload %# before it can retrieve an earlier agent', async malformed => {
    const response = await POST(request(malformed))

    expect(response.status).toBe(400)
    expect(mocks.replay).not.toHaveBeenCalled()
    expectNoCreationWork()
  })

  it.each(['1990-02-30', '1990-02-15T12:00:00Z', 'February 15, 1990'])(
    'rejects malformed legacy date %s before replay',
    async birthDate => {
      const response = await POST(
        request({
          name: 'Ada',
          clientRequestId,
          birthDate,
          birthTime: '10:24',
          birthLocation: {
            name: 'New York',
            latitude: 40.7128,
            longitude: -74.006,
            timezone: 'America/New_York',
          },
        })
      )

      expect(response.status).toBe(400)
      expect(mocks.replay).not.toHaveBeenCalled()
      expectNoCreationWork()
    }
  )

  it('returns the original full response without invoking chart, debit, or provisioning work', async () => {
    const response = await POST(request(input))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(original)
    expect(mocks.replay).toHaveBeenCalledWith(mocks.db, {
      creatorId: 'creator-a',
      clientRequestId,
      requestHash: forgeRequestHash(ForgeRequestSchema.parse(input)),
    })
    expectNoCreationWork()
  })

  it('derives creator scope from each session even if the payload supplies another creator', async () => {
    mocks.replay.mockImplementation(async (_db, key) => ({
      ...original,
      agent: { ...original.agent, id: `agent-${key.creatorId}` },
    }))
    const first = await POST(request({ ...input, creatorId: 'attacker-chosen' }))
    mocks.auth.mockResolvedValue({ user: { id: 'creator-b' } })
    const second = await POST(request({ ...input, creatorId: 'creator-a' }))

    expect((await first.json()).agent.id).toBe('agent-creator-a')
    expect((await second.json()).agent.id).toBe('agent-creator-b')
    expect(mocks.replay.mock.calls.map(call => call[1].creatorId)).toEqual([
      'creator-a',
      'creator-b',
    ])
    expectNoCreationWork()
  })

  it('requires authentication for an idempotency key before reading replay state', async () => {
    mocks.auth.mockResolvedValue(null)
    const response = await POST(request(input))

    expect(response.status).toBe(401)
    expect(mocks.replay).not.toHaveBeenCalled()
    expectNoCreationWork()
  })

  it.each([
    { failure: new ForgeRequestConflict('Different input'), status: 409 },
    { failure: new ForgeUnavailable('Saved result unavailable'), status: 503 },
  ])(
    'returns $status for a replay conflict or unavailable saved result',
    async ({ failure, status }) => {
      mocks.replay.mockRejectedValue(failure)
      const response = await POST(request(input))

      expect(response.status).toBe(status)
      expectNoCreationWork()
    }
  )

  it('preserves anonymous requests without a client key', async () => {
    mocks.auth.mockResolvedValue(null)
    const { clientRequestId: _, ...anonymousInput } = input
    const response = await POST(request(anonymousInput))

    expect(response.status).toBe(200)
    expect(mocks.replay).not.toHaveBeenCalled()
    expect(mocks.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: undefined,
        request: undefined,
      })
    )
    expect(mocks.sync).toHaveBeenCalledOnce()
  })

  it('does not sync discarded generated data when a concurrent request wins', async () => {
    mocks.replay.mockResolvedValue(null)
    mocks.commit.mockResolvedValue(original)
    const response = await POST(request(input))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(original)
    expect(mocks.commit).toHaveBeenCalledOnce()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('returns committed success even when subsequent remote synchronization fails', async () => {
    mocks.replay.mockResolvedValue(null)
    mocks.sync.mockRejectedValue(new Error('WTEN unreachable'))
    const response = await POST(request(input))

    expect(response.status).toBe(200)
    expect((await response.json()).agent.id).toBe('agent-original')
    expect(mocks.commit).toHaveBeenCalledOnce()
    expect(mocks.sync).toHaveBeenCalledOnce()
  })

  it('maps an atomic commit rejection for insufficient funds to 402', async () => {
    mocks.replay.mockResolvedValue(null)
    mocks.commit.mockRejectedValue(new InsufficientForgeFunds('Insufficient reserves'))
    const response = await POST(request(input))

    expect(response.status).toBe(402)
    expect(mocks.sync).not.toHaveBeenCalled()
  })
})
