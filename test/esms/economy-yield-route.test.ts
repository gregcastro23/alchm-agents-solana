import { mock } from 'bun:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

mock.module('server-only', () => ({}))

const mockAuth = vi.fn()
const mockClaimProfileYield = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/profile-yield', () => ({ claimProfileYield: mockClaimProfileYield }))

const { POST } = await import('@/app/api/economy/yield/route')

describe('POST /api/economy/yield', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the same Agents yield service as the Yield Hub', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-123', kitchenPremium: true },
    })
    mockClaimProfileYield.mockResolvedValue({
      isPremium: false,
      distribution: { spirit: 3, essence: 3, matter: 3, substance: 3 },
      balances: { spirit: 10, essence: 10, matter: 10, substance: 10 },
    })

    const response = await POST()

    expect(response.status).toBe(200)
    expect(mockClaimProfileYield).toHaveBeenCalledWith('user-123', 'agents', {
      kitchenPremium: true,
    })
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      isPremium: false,
      balances: { spirit: 10, essence: 10, matter: 10, substance: 10 },
    })
  })

  it('returns the shared cooldown response for a repeated daily claim', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    mockClaimProfileYield.mockRejectedValue(new Error('Already claimed today'))

    const response = await POST()

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'Cooldown active' })
  })
})
