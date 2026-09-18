// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeGatesFromScores, resolveUserNatalGate } from '@/lib/pentacles/natal-gate'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user_natal_charts: {
      findFirst: vi.fn(),
    },
    user_profiles: {
      findUnique: vi.fn(),
    },
  },
}))

describe('Natal Gate Computation (PENTACLE_GATE_V1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes gate vector: strongest element converts at 1.0, weaker elements bounded at >= 0.85', () => {
    // Fire (Spirit) dominant chart
    const scores = {
      spirit: 40,
      essence: 20,
      matter: 30,
      substance: 10,
    }

    const res = computeGatesFromScores(scores)
    expect(res.dominantElement).toBe('spirit')
    // Spirit is strongest -> gate 1.0
    expect(res.gates.spirit).toBe(1.0)
    // Other gates bounded by G_MIN (0.85)
    expect(res.gates.essence).toBeGreaterThanOrEqual(0.85)
    expect(res.gates.essence).toBeLessThan(1.0)
    expect(res.gates.matter).toBeGreaterThanOrEqual(0.85)
    expect(res.gates.matter).toBeLessThan(1.0)
    expect(res.gates.substance).toBeGreaterThanOrEqual(0.85)
    expect(res.gates.substance).toBeLessThan(1.0)

    // Check specific proportional gate:
    // s_spirit = 40/100 = 0.4
    // s_essence = 20/100 = 0.2
    // gate_essence = 0.85 + 0.15 * (0.2 / 0.4) = 0.85 + 0.075 = 0.925
    expect(res.gates.essence).toBeCloseTo(0.925, 4)
  })

  it('computes equal gates at 1.0 when chart elements are perfectly balanced', () => {
    const scores = { spirit: 25, essence: 25, matter: 25, substance: 25 }
    const res = computeGatesFromScores(scores)
    expect(res.gates.spirit).toBe(1.0)
    expect(res.gates.essence).toBe(1.0)
    expect(res.gates.matter).toBe(1.0)
    expect(res.gates.substance).toBe(1.0)
  })

  it('hard gate: returns eligible: false with birth_chart_required if user has no chart', async () => {
    ;(prisma.user_natal_charts.findFirst as any).mockResolvedValue(null)
    ;(prisma.user_profiles.findUnique as any).mockResolvedValue(null)

    const res = await resolveUserNatalGate('user-no-chart')
    expect(res.eligible).toBe(false)
    expect(res.reason).toBe('birth_chart_required')
    expect(res.message).toContain('natal birth chart is required')
  })

  it('resolves gates successfully when user has primary active chart', async () => {
    ;(prisma.user_natal_charts.findFirst as any).mockResolvedValue({
      spiritScore: 50,
      essenceScore: 25,
      matterScore: 15,
      substanceScore: 10,
      dominantElement: 'Fire',
    })

    const res = await resolveUserNatalGate('user-with-chart')
    expect(res.eligible).toBe(true)
    expect(res.gates?.spirit).toBe(1.0)
    expect(res.gates?.essence).toBeGreaterThan(0.85)
  })
})
