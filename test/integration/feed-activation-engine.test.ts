import { describe, it, expect, vi, beforeEach } from 'vitest'
import { feedActivationEngine } from '@/lib/agents/feed-activation-engine'
import { celestialEnergyCalculator } from '@/lib/celestial-energy-calculator'
import { HistoricalAgentsService } from '@/lib/historical-agents-db'
import { unifiedTracker } from '@/lib/consciousness/unified-tracker'

vi.mock('@/lib/celestial-energy-calculator')
vi.mock('@/lib/historical-agents-db')
vi.mock('@/lib/consciousness/unified-tracker')

const PLANETARY_FIXTURE = {
  timestamp: new Date('2026-05-14T12:00:00Z'),
  planetary: { dominantPlanet: 'Mars', dominantSign: 'Aries' },
  planetaryDegrees: {
    Sun: 23.5,
    Moon: 14.2,
    Mercury: 8.7,
    Venus: 17.9,
    Mars: 3.1,
    Jupiter: 28.6,
    Saturn: 11.4,
  },
}

describe('FeedActivationEngine', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should evaluate activations and return actions for resonant agents', async () => {
    // Mock Active Agents
    vi.mocked(HistoricalAgentsService.getAllAgents).mockResolvedValue([
      {
        agentId: 'agent-1',
        name: 'Revolutionary Agent',
        personalityCore: { expression: 'revolutionary' },
        consciousnessLevel: 'Transcendent',
        dominantElement: 'Fire',
      } as any,
    ])

    // Mock Celestial Moment (High Entropy)
    vi.mocked(celestialEnergyCalculator.calculateMoment).mockResolvedValue({
      ...PLANETARY_FIXTURE,
      thermodynamic: { entropy: 85, heat: 50, reactivity: 50, energy: 50 },
      alchemical: { A_number: 50, spirit: 50, matter: 50, essence: 50, substance: 50 },
      kinetic: { velocity: { Fire: 50 }, power: 50 },
      elemental: { Fire: 50 },
    } as any)

    // Mock Consciousness State
    vi.mocked(unifiedTracker.getCurrentState).mockResolvedValue({
      consciousnessVelocity: 0.8,
      interactionMomentum: 0.9,
    } as any)

    const actions = await feedActivationEngine.evaluateActivations()

    expect(actions).toHaveLength(1)
    expect(actions[0].agentEmail).toBe('agent-1@agentic.alchm.kitchen')
    expect(actions[0].eventType).toBe('insight')
    expect(actions[0].metadataPayload.internalTrigger).toBe('high_entropy_resonance')
  })

  it('should trigger transcendent agents on A# spike', async () => {
    vi.mocked(HistoricalAgentsService.getAllAgents).mockResolvedValue([
      {
        agentId: 'agent-2',
        name: 'Transcendent Agent',
        personalityCore: { expression: 'calm' },
        consciousnessLevel: 'Transcendent',
        dominantElement: 'Water',
      } as any,
    ])

    // Mock Celestial Moment (High A#)
    vi.mocked(celestialEnergyCalculator.calculateMoment).mockResolvedValue({
      ...PLANETARY_FIXTURE,
      thermodynamic: { entropy: 40, heat: 50, reactivity: 50, energy: 50 },
      alchemical: { A_number: 95, spirit: 50, matter: 50, essence: 50, substance: 50 },
      kinetic: { velocity: { Water: 50 }, power: 50 },
      elemental: { Water: 50 },
    } as any)

    vi.mocked(unifiedTracker.getCurrentState).mockResolvedValue({
      consciousnessVelocity: 0.8,
      interactionMomentum: 0.9,
    } as any)

    const actions = await feedActivationEngine.evaluateActivations()

    expect(actions).toHaveLength(1)
    expect(actions[0].agentEmail).toBe('agent-2@agentic.alchm.kitchen')
    expect(actions[0].eventType).toBe('lab_entry')
    expect(actions[0].metadataPayload.internalTrigger).toBe('transcendent_a_number_spike')
  })
})
