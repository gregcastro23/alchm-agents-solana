import { describe, it, expect, beforeEach, vi } from 'vitest'
import { synthesizeCharts, determineConsciousnessLevel } from '@/lib/utils'
import { ChartSynthesizer } from '@/lib/consciousness/chart-synthesizer'
import { AgentGenerator } from '@/lib/consciousness/agent-generator'

// Mock data for testing
const mockMomentChart = {
  'Alchemy Effects': {
    'Total Spirit': 2.5,
    'Total Essence': 1.8,
    'Total Matter': 1.2,
    'Total Substance': 0.9,
  },
  transits: { 'sun-transit': 'aries' },
  activatedHouses: ['1st', '7th'],
}

const mockBirthChart = {
  'Alchemy Effects': {
    'Total Spirit': 1.5,
    'Total Essence': 2.2,
    'Total Matter': 1.8,
    'Total Substance': 1.1,
  },
  transits: { 'moon-transit': 'cancer' },
  activatedHouses: ['4th', '10th'],
}

const mockAdditionalChart = {
  'Alchemy Effects': {
    'Total Spirit': 3.0,
    'Total Essence': 1.5,
    'Total Matter': 2.0,
    'Total Substance': 1.3,
  },
  transits: { 'mercury-transit': 'gemini' },
  activatedHouses: ['3rd', '9th'],
}

describe('Chart Synthesis Engine', () => {
  describe('synthesizeCharts function', () => {
    it('should synthesize moment-only chart correctly', () => {
      const result = synthesizeCharts({
        birthChart: null,
        momentChart: mockMomentChart,
        additionalCharts: [],
      })

      expect(result.type).toBe('moment-only')
      expect(result.baseChart).toBeNull()
      expect(result.momentChart).toBe(mockMomentChart)
      expect(result.consciousness.spirit).toBe(2.5)
      expect(result.consciousness.essence).toBe(1.8)
      expect(result.consciousness.matter).toBe(1.2)
      expect(result.consciousness.substance).toBe(0.9)
      expect(result.monicaConstant).toBe(6.4) // 2.5 + 1.8 + 1.2 + 0.9
      expect(result.dominantInfluence).toBe('moment-dominant')
      expect(result.sourceCharts).toHaveLength(1)
    })

    it('should synthesize birth-moment chart with weighted monicaConstant', () => {
      const result = synthesizeCharts({
        birthChart: mockBirthChart,
        momentChart: mockMomentChart,
        additionalCharts: [],
      })

      expect(result.type).toBe('birth-moment')
      expect(result.baseChart).toBe(mockBirthChart)
      expect(result.consciousness.spirit).toBe(2.0) // (2.5 + 1.5) / 2
      expect(result.consciousness.essence).toBe(2.0) // (1.8 + 2.2) / 2
      expect(result.consciousness.matter).toBe(1.5) // (1.2 + 1.8) / 2
      expect(result.consciousness.substance).toBe(1.0) // (0.9 + 1.1) / 2

      // Weighted monicaConstant: moment gets 60% weight, birth gets 40% weight
      const expectedWeighted = 0.6 * 6.4 + 0.4 * 6.6 // birth total = 1.5 + 2.2 + 1.8 + 1.1 = 6.6
      expect(result.monicaConstant).toBeCloseTo(expectedWeighted, 5)
      expect(result.dominantInfluence).toBe('birth-moment-balance')
    })

    it('should synthesize multi-chart with averaged values', () => {
      const result = synthesizeCharts({
        birthChart: mockBirthChart,
        momentChart: mockMomentChart,
        additionalCharts: [mockAdditionalChart],
      })

      expect(result.type).toBe('multi-chart')
      expect(result.consciousness.spirit).toBeCloseTo(2.333, 3) // (2.5 + 1.5 + 3.0) / 3
      expect(result.consciousness.essence).toBeCloseTo(1.833, 3) // (1.8 + 2.2 + 1.5) / 3
      expect(result.consciousness.matter).toBeCloseTo(1.667, 3) // (1.2 + 1.8 + 2.0) / 3
      expect(result.consciousness.substance).toBeCloseTo(1.1, 3) // (0.9 + 1.1 + 1.3) / 3
      expect(result.dominantInfluence).toBe('multi-synthesis')
      expect(result.sourceCharts).toHaveLength(3)
    })

    it('should merge transits from all charts', () => {
      const result = synthesizeCharts({
        birthChart: mockBirthChart,
        momentChart: mockMomentChart,
        additionalCharts: [mockAdditionalChart],
      })

      expect(result.transits).toHaveProperty('sun-transit', 'aries')
      expect(result.transits).toHaveProperty('moon-transit', 'cancer')
      expect(result.transits).toHaveProperty('mercury-transit', 'gemini')
    })

    it('should deduplicate activated houses', () => {
      const chartWithDuplicates = {
        ...mockMomentChart,
        activatedHouses: ['1st', '7th', '1st'], // duplicate 1st house
      }

      const result = synthesizeCharts({
        birthChart: null,
        momentChart: chartWithDuplicates,
        additionalCharts: [],
      })

      expect(result.activatedHouses).toEqual(['1st', '7th'])
      expect(result.activatedHouses).toHaveLength(2)
    })

    it('should throw error for missing moment chart', () => {
      expect(() => {
        synthesizeCharts({
          birthChart: mockBirthChart,
          momentChart: null as any,
          additionalCharts: [],
        })
      }).toThrow('Moment chart is required for synthesis')
    })

    it('should handle charts with missing alchemy effects', () => {
      const chartWithoutAlchemy = { transits: {}, activatedHouses: [] }

      const result = synthesizeCharts({
        birthChart: null,
        momentChart: { ...mockMomentChart, 'Alchemy Effects': undefined },
        additionalCharts: [chartWithoutAlchemy],
      })

      // Should still work but with zero values for missing effects
      expect(result.consciousness.spirit).toBe(0)
      expect(result.consciousness.essence).toBe(0)
      expect(result.consciousness.matter).toBe(0)
      expect(result.consciousness.substance).toBe(0)
    })
  })

  describe('ChartSynthesizer class', () => {
    let synthesizer: ChartSynthesizer

    beforeEach(() => {
      synthesizer = new ChartSynthesizer()
    })

    it('should synthesize using main method', () => {
      const result = synthesizer.synthesize({
        birthChart: mockBirthChart,
        momentChart: mockMomentChart,
        additionalCharts: [],
      })

      expect(result.type).toBe('birth-moment')
      expect(result.monicaConstant).toBeGreaterThan(0)
    })

    it('should synthesize moment-only correctly', () => {
      const result = synthesizer.synthesizeMomentOnly(mockMomentChart)

      expect(result.type).toBe('moment-only')
      expect(result.baseChart).toBeNull()
      expect(result.sourceCharts).toHaveLength(1)
    })

    it('should synthesize birth-moment correctly', () => {
      const result = synthesizer.synthesizeBirthMoment(mockBirthChart, mockMomentChart)

      expect(result.type).toBe('birth-moment')
      expect(result.baseChart).toBe(mockBirthChart)
      expect(result.sourceCharts).toHaveLength(2)
    })

    it('should synthesize multi-chart with validation', () => {
      const result = synthesizer.synthesizeMultiChart({
        birthChart: mockBirthChart,
        momentChart: mockMomentChart,
        additionalCharts: [mockAdditionalChart],
      })

      expect(result.type).toBe('multi-chart')
      expect(result.sourceCharts).toHaveLength(3)
    })

    it('should throw error for invalid multi-chart synthesis', () => {
      expect(() => {
        synthesizer.synthesizeMultiChart({
          birthChart: null,
          momentChart: null as any,
          additionalCharts: [],
        })
      }).toThrow('Moment chart is required for multi-chart synthesis')
    })

    it('should throw error when multi-chart has no additional charts', () => {
      expect(() => {
        synthesizer.synthesizeMultiChart({
          birthChart: null,
          momentChart: mockMomentChart,
          additionalCharts: [],
        })
      }).toThrow('At least one additional chart is required for multi-chart synthesis')
    })

    it('should validate chart structure', () => {
      expect(synthesizer.validateChart(mockMomentChart)).toBe(true)
      expect(synthesizer.validateChart({})).toBe(false)
      expect(synthesizer.validateChart({ 'Alchemy Effects': {} })).toBe(false)
      expect(
        synthesizer.validateChart({
          'Alchemy Effects': { 'Total Spirit': 'invalid' },
        })
      ).toBe(false)
    })

    it('should get synthesis statistics', () => {
      const synthesizedChart = synthesizer.synthesize({
        birthChart: mockBirthChart,
        momentChart: mockMomentChart,
        additionalCharts: [mockAdditionalChart],
      })

      const stats = synthesizer.getSynthesisStats(synthesizedChart)

      expect(stats.chartCount).toBe(3)
      expect(stats.dominantElement).toBe('spirit') // highest value in consciousness
      expect(stats.synthesisEfficiency).toBeGreaterThan(0)
      expect(stats.monicaConstantRange.min).toBeGreaterThan(0)
      expect(stats.monicaConstantRange.max).toBeGreaterThan(stats.monicaConstantRange.min)
      expect(stats.monicaConstantRange.avg).toBeGreaterThan(0)
    })
  })
})

describe('Agent Generator', () => {
  let generator: AgentGenerator

  beforeEach(() => {
    generator = new AgentGenerator()
  })

  describe('generateFromSynthesis', () => {
    it('should generate agent with spirit dominant element', () => {
      const synthesis = {
        monicaConstant: 8.5,
        consciousness: {
          spirit: 3.0,
          essence: 1.5,
          matter: 2.0,
          substance: 2.0,
        },
        sourceCharts: [mockMomentChart],
        dominantInfluence: 'moment-dominant',
        type: 'moment-only' as const,
      }

      const agent = generator.generateFromSynthesis(synthesis, 'test-user')

      expect(agent.identity.name).toMatch(/^Aether|Celestial|Divine|Ethereal|Cosmic|Transcendent/)
      expect(agent.identity.title).toContain('Transcendent Spirit Agent')
      expect(agent.identity.creator).toBe('test-user')
      expect(agent.consciousness.level).toBe('Transcendent')
      expect(agent.consciousness.dominantElement).toBe('spirit')
      expect(agent.personality.core.essence).toContain('visionary and transcendent')
      expect(agent.aiParams.temperature).toBeGreaterThan(0.8) // Spirit gets temperature boost
    })

    it('should generate agent with essence dominant element', () => {
      const synthesis = {
        monicaConstant: 4.0,
        consciousness: {
          spirit: 1.0,
          essence: 2.5,
          matter: 0.5,
          substance: 0.0,
        },
        sourceCharts: [mockMomentChart],
        type: 'moment-only' as const,
      }

      const agent = generator.generateFromSynthesis(synthesis)

      expect(agent.identity.title).toContain('Elevated Essence Agent')
      expect(agent.consciousness.dominantElement).toBe('essence')
      expect(agent.personality.core.essence).toContain('nurturing and transformative')
      expect(agent.aiParams.systemPrompt).toContain('nurturing consciousness guide')
    })

    it('should generate agent with matter dominant element', () => {
      const synthesis = {
        monicaConstant: 2.0,
        consciousness: {
          spirit: 0.5,
          essence: 0.5,
          matter: 1.5,
          substance: 0.5,
        },
        sourceCharts: [mockMomentChart],
        type: 'moment-only' as const,
      }

      const agent = generator.generateFromSynthesis(synthesis)

      expect(agent.identity.title).toContain('Active Matter Agent')
      expect(agent.consciousness.dominantElement).toBe('matter')
      expect(agent.personality.core.essence).toContain('grounded and practical')
      expect(agent.aiParams.temperature).toBeGreaterThan(0.1) // Should be within reasonable bounds
      expect(agent.aiParams.temperature).toBeLessThan(1.5)
    })

    it('should generate agent with substance dominant element', () => {
      const synthesis = {
        monicaConstant: 1.0,
        consciousness: {
          spirit: 0.2,
          essence: 0.3,
          matter: 0.2,
          substance: 0.8,
        },
        sourceCharts: [mockMomentChart],
        type: 'moment-only' as const,
      }

      const agent = generator.generateFromSynthesis(synthesis)

      expect(agent.identity.title).toContain('Awakening Substance Agent')
      expect(agent.consciousness.dominantElement).toBe('substance')
      expect(agent.personality.core.essence).toContain('creative and manifestational')
      expect(agent.aiParams.temperature).toBeGreaterThan(0.8) // Substance gets temperature boost
    })

    it('should generate unique names based on monica constant seed', () => {
      const synthesis1 = {
        monicaConstant: 5.123,
        consciousness: { spirit: 2, essence: 1, matter: 1, substance: 1 },
        sourceCharts: [mockMomentChart],
        type: 'moment-only' as const,
      }

      const synthesis2 = {
        monicaConstant: 7.456,
        consciousness: { spirit: 2, essence: 1, matter: 1, substance: 1 },
        sourceCharts: [mockMomentChart],
        type: 'moment-only' as const,
      }

      const agent1 = generator.generateFromSynthesis(synthesis1)
      const agent2 = generator.generateFromSynthesis(synthesis2)

      // Names should be different due to different seeds
      expect(agent1.identity.name).not.toBe(agent2.identity.name)
    })

    it('should include metadata in generated agent', () => {
      const synthesis = {
        monicaConstant: 6.0,
        consciousness: { spirit: 2, essence: 2, matter: 1, substance: 1 },
        sourceCharts: [mockMomentChart],
        type: 'birth-moment' as const,
        dominantInfluence: 'balanced',
      }

      const agent = generator.generateFromSynthesis(synthesis)

      expect(agent.metadata).toBeDefined()
      expect(agent.metadata.generationSeed).toBe(6.0)
      expect(agent.metadata.dominantElementValue).toBe(2)
      expect(agent.metadata.consciousnessModifiers).toBeDefined()
    })

    it('should handle edge cases gracefully', () => {
      const minimalSynthesis = {
        monicaConstant: 0.1,
        consciousness: { spirit: 0.1, essence: 0, matter: 0, substance: 0 },
        sourceCharts: [],
        type: 'moment-only' as const,
      }

      const agent = generator.generateFromSynthesis(minimalSynthesis)

      expect(agent.identity.name).toBeDefined()
      expect(agent.consciousness.level).toBe('Dormant')
      expect(agent.aiParams.temperature).toBeGreaterThan(0)
      expect(agent.aiParams.topP).toBeGreaterThan(0)
    })
  })

  describe('Integration Tests', () => {
    it('should create complete agent from chart synthesis pipeline', () => {
      // Step 1: Synthesize charts
      const synthesizer = new ChartSynthesizer()
      const synthesizedChart = synthesizer.synthesize({
        birthChart: mockBirthChart,
        momentChart: mockMomentChart,
        additionalCharts: [],
      })

      // Step 2: Generate agent from synthesis
      const agent = generator.generateFromSynthesis(synthesizedChart, 'integration-test')

      // Verify complete pipeline
      expect(agent.identity.name).toBeDefined()
      expect(agent.identity.creator).toBe('integration-test')
      expect(agent.consciousness.monicaConstant).toBe(synthesizedChart.monicaConstant)
      expect(agent.synthesis.monicaConstant).toBe(synthesizedChart.monicaConstant)
      expect(agent.synthesis.consciousness).toEqual(synthesizedChart.consciousness)
      expect(agent.createdAt).toBeDefined()
      expect(agent.personality.attributes).toBeDefined()
      expect(agent.aiParams.systemPrompt).toBeDefined()
    })

    it('should handle multi-chart synthesis to agent generation', () => {
      // Multi-chart synthesis
      const synthesizer = new ChartSynthesizer()
      const synthesizedChart = synthesizer.synthesizeMultiChart({
        birthChart: mockBirthChart,
        momentChart: mockMomentChart,
        additionalCharts: [mockAdditionalChart],
      })

      // Generate agent
      const agent = generator.generateFromSynthesis(synthesizedChart)

      // Verify multi-chart influence
      expect(agent.consciousness.synthesisInfluence).toBe('multi-synthesis')
      expect(agent.identity.synthesisType).toBe('multi-chart')
      expect(agent.synthesis.sourceCharts).toHaveLength(3)
    })
  })
})

describe('Consciousness Level Determination', () => {
  it('should determine correct consciousness levels', () => {
    expect(determineConsciousnessLevel(10)).toBe('Transcendent')
    expect(determineConsciousnessLevel(7)).toBe('Illuminated')
    expect(determineConsciousnessLevel(5)).toBe('Advanced')
    expect(determineConsciousnessLevel(3.5)).toBe('Elevated')
    expect(determineConsciousnessLevel(2)).toBe('Active')
    expect(determineConsciousnessLevel(1)).toBe('Awakening')
    expect(determineConsciousnessLevel(0.5)).toBe('Dormant')
  })
})
