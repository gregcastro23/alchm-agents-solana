import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userUpdate: vi.fn(),
  sync: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction, users: { update: mocks.userUpdate } },
}))
vi.mock('@/lib/wtenClient', () => ({ syncAgentToWten: mocks.sync }))
vi.mock('@/lib/enhanced-astronomical-calculator', () => ({
  signDegreeToLongitude: vi.fn(),
}))

import {
  ensureAgenticUserAndSync,
  provisionAgenticUser,
  syncAgenticUserToWten,
  type EnsureAgenticUserInput,
} from '@/lib/agents/agentic-user-sync'

const input: EnsureAgenticUserInput = {
  agentId: 'agent-forge-transaction',
  name: 'Transaction Vessel',
  birthDate: new Date('1991-06-23T10:24:00Z'),
  birthTime: '10:24',
  birthLocation: { lat: 40.7128, lon: -74.006, name: 'New York' },
  natalChart: { planets: { Sun: { sign: 'Aries', degree: 5, longitude: 5 } } },
  monicaConstant: 3.7,
  dominantElement: 'Air',
}

const tx = new PrismaClient()
const upsertUser = vi.spyOn(tx.users, 'upsert')
const upsertProfile = vi.spyOn(tx.user_profiles, 'upsert')
const upsertBalance = vi.spyOn(tx.tokenBalance, 'upsert')

describe('agentic user local provisioning and remote delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    upsertUser.mockImplementation(vi.fn().mockResolvedValue({ id: 'local-agent-user' }))
    upsertProfile.mockImplementation(vi.fn().mockResolvedValue({}))
    upsertBalance.mockImplementation(vi.fn().mockResolvedValue({}))
    mocks.transaction.mockImplementation(operation => operation(tx))
    mocks.sync.mockResolvedValue({ wtenUserId: 'wten-agent-user' })
    mocks.userUpdate.mockResolvedValue({})
  })

  it('provisions all local rows through the supplied transaction without a network call', async () => {
    await expect(provisionAgenticUser(input, tx)).resolves.toBe('local-agent-user')

    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'agent-forge-transaction@agentic.alchm.kitchen' },
      })
    )
    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'local-agent-user' } })
    )
    expect(upsertBalance).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'local-agent-user' } })
    )
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('propagates a local failure before the remaining writes and remote delivery', async () => {
    const failure = new Error('profile insert failed')
    upsertProfile.mockRejectedValueOnce(failure)

    await expect(provisionAgenticUser(input, tx)).rejects.toBe(failure)
    expect(upsertBalance).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('keeps the existing wrapper transaction before remote sync', async () => {
    await ensureAgenticUserAndSync(input)

    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(upsertBalance.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sync.mock.invocationCallOrder[0]
    )
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { email: 'agent-forge-transaction@agentic.alchm.kitchen' },
      data: { alchmKitchenUserId: 'wten-agent-user' },
    })
  })

  it('allows remote delivery to retry without repeating local provisioning', async () => {
    await syncAgenticUserToWten(input)

    expect(mocks.sync).toHaveBeenCalledOnce()
    expect(mocks.userUpdate).toHaveBeenCalledOnce()
    expect(upsertUser).not.toHaveBeenCalled()
    expect(upsertProfile).not.toHaveBeenCalled()
    expect(upsertBalance).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
