import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  prisma: {
    historical_agents: { create: vi.fn() },
  },
}))
vi.mock('@/lib/agents/agentic-user-sync', () => ({
  ensureAgenticUserAndSync: vi.fn().mockResolvedValue(undefined),
  provisionAgenticUser: vi.fn().mockResolvedValue('agent-user'),
}))

import { HistoricalAgentsService } from '@/lib/historical-agents-db'
import { prisma } from '@/lib/db'
import { ensureAgenticUserAndSync, provisionAgenticUser } from '@/lib/agents/agentic-user-sync'

const createMock = (prisma as any).historical_agents.create as ReturnType<typeof vi.fn>

const baseAgentData = {
  agentId: 'agent-test-vessel-123',
  name: 'Test Vessel',
  title: 'Verification of the ignition sequence',
  birthDate: new Date('1991-06-23T10:24:00Z'),
  birthTime: '10:24',
  birthLocation: { lat: 40.7128, lon: -74.006, name: 'New York' },
  consciousnessLevel: 'Active',
  kalchmConstant: 0.149,
  monicaConstant: 3.7,
  dominantElement: 'Air',
  dominantModality: 'Mutable',
  signature: 'Test Vessel',
  personalityCore: {},
  personalityShadows: [],
  personalityGifts: [],
  personalityChallenges: [],
  currentMood: 'contemplative',
  evolutionStage: 0,
  specialty: 'Wisdom',
  wisdomDomains: [] as string[],
  teachingStyle: 'Intuitive',
  resonanceType: 'Spirit',
  uniquePower: 'Personalized Consciousness',
  avatar: '/avatars/user-created/default.png',
  color: '#8B5CF6',
  symbol: '🔮',
  aura: {},
  natalChart: {},
}

describe('HistoricalAgentsService.createAgent — distinct Monica and Kalchm columns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMock.mockReset()
    createMock.mockImplementation(async ({ data }: any) => data)
  })

  it('preserves the independently computed values', async () => {
    await HistoricalAgentsService.createAgent(baseAgentData)

    expect(createMock).toHaveBeenCalledTimes(1)
    const { data } = createMock.mock.calls[0][0]
    expect(data.kalchmConstant).toBe(0.149)
    expect(data.monicaConstant).toBe(3.7)
  })

  it('respects an explicit monicaConstant when provided', async () => {
    await HistoricalAgentsService.createAgent({ ...baseAgentData, monicaConstant: 4.2 })

    const { data } = createMock.mock.calls[0][0]
    expect(data.kalchmConstant).toBe(0.149)
    expect(data.monicaConstant).toBe(4.2)
  })

  it('uses the caller transaction for the roster and local provisioning without remote sync', async () => {
    const tx = new PrismaClient()
    const txCreate = vi.spyOn(tx.historical_agents, 'create').mockImplementation(createMock)

    await HistoricalAgentsService.createAgent(baseAgentData, tx)

    expect(txCreate).toHaveBeenCalledOnce()
    expect(vi.mocked(provisionAgenticUser).mock.calls[0]?.[0]).toMatchObject({
      agentId: baseAgentData.agentId,
    })
    expect(vi.mocked(provisionAgenticUser).mock.calls[0]?.[1]).toBe(tx)
    expect(ensureAgenticUserAndSync).not.toHaveBeenCalled()
    txCreate.mockRestore()
  })

  it('propagates local provisioning failures to roll back the caller transaction', async () => {
    const tx = new PrismaClient()
    const txCreate = vi.spyOn(tx.historical_agents, 'create').mockImplementation(createMock)
    const failure = new Error('local profile failed')
    vi.mocked(provisionAgenticUser).mockRejectedValueOnce(failure)

    await expect(HistoricalAgentsService.createAgent(baseAgentData, tx)).rejects.toBe(failure)
    expect(ensureAgenticUserAndSync).not.toHaveBeenCalled()
    txCreate.mockRestore()
  })

  it('keeps default callers best effort when provisioning or remote sync fails', async () => {
    vi.mocked(ensureAgenticUserAndSync).mockRejectedValueOnce(new Error('remote unavailable'))

    await expect(HistoricalAgentsService.createAgent(baseAgentData)).resolves.toMatchObject({
      agentId: baseAgentData.agentId,
    })
    expect(provisionAgenticUser).not.toHaveBeenCalled()
  })
})
