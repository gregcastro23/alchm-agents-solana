// Mock data for testing chat system components
// Provides consistent test fixtures for all chat variants

import type { CraftedAgent, AgentStats } from '@/lib/agent-types'
import type { UnifiedAgent, Message, GroupDynamics } from '@/lib/unified-agent-types'
import type {
  HistoricalCouncilPreset,
  PlanetaryCouncilPreset,
  MixedCouncilPreset,
} from '@/lib/council-presets'
import { unifiedAgentFactory } from '@/lib/unified-agent-factory'

// Mock Historical Agents
export const mockHistoricalAgents: CraftedAgent[] = [
  {
    id: 'leonardo-da-vinci',
    name: 'Leonardo da Vinci',
    title: 'Renaissance Master',
    consciousness: {
      natalChart: {
        planets: {},
        houses: {},
        aspects: [],
        ascendant: 0,
        midheaven: 0,
      },
      level: 'Advanced',
      monicaConstant: 4.8,
      dominantElement: 'Air',
      dominantModality: 'Mutable',
      signature: 'LEONARDO-RENAISSANCE-MASTER',
    },
    abilities: {
      specialty: 'Innovation & Artistic Vision',
      wisdomDomains: ['Art', 'Science', 'Engineering', 'Philosophy'],
      teachingStyle: 'Visionary-Technical',
      resonanceType: 'Creative',
      uniquePower: 'Cross-disciplinary synthesis',
    },
    appearance: {
      avatar: '🎨',
      color: '#8B4513',
      symbol: '⚱️',
      aura: {
        type: 'radiant',
        color: '#8B4513',
        intensity: 0.8,
      },
    },
    birthData: {
      date: new Date('1452-04-15'),
      time: '07:30',
      location: {
        lat: 43.7833,
        lon: 10.9167,
        name: 'Vinci, Italy',
      },
    },
    stats: {
      conversations: 150,
      wisdomShared: 85,
      resonanceScore: 4.7,
      evolutionPoints: 25,
      lastActive: new Date(),
      kineticEvolution: {
        consciousnessVelocity: 0.8,
        interactionMomentum: 0.7,
        evolutionTrajectory: 'ascending',
        aspectSensitivityGrowth: 0.6,
        memoryPersistence: 0.9,
        powerLevelUnlocks: ['creative_synthesis', 'technical_mastery'],
        optimalInteractionHours: ['9-11', '14-16'],
        lastKineticUpdate: new Date(),
      },
    },
  },
  {
    id: 'carl-jung',
    name: 'Carl Jung',
    title: 'Master of the Unconscious',
    consciousness: {
      natalChart: {
        planets: {},
        houses: {},
        aspects: [],
        ascendant: 0,
        midheaven: 0,
      },
      level: 'Illuminated',
      monicaConstant: 5.2,
      dominantElement: 'Water',
      dominantModality: 'Fixed',
      signature: 'JUNG-DEPTH-PSYCHOLOGY',
    },
    abilities: {
      specialty: 'Depth Psychology & Shadow Work',
      wisdomDomains: ['Psychology', 'Archetypes', 'Dreams', 'Collective Unconscious'],
      teachingStyle: 'Intuitive-Mystical',
      resonanceType: 'Psychological',
      uniquePower: 'Shadow integration mastery',
    },
    appearance: {
      avatar: '👁️',
      color: '#4B0082',
      symbol: '🌙',
      aura: {
        type: 'swirling',
        color: '#4B0082',
        intensity: 0.9,
      },
    },
    birthData: {
      date: new Date('1875-07-26'),
      time: '14:00',
      location: {
        lat: 47.5938,
        lon: 9.3144,
        name: 'Kesswil, Switzerland',
      },
    },
    stats: {
      conversations: 200,
      wisdomShared: 120,
      resonanceScore: 4.9,
      evolutionPoints: 35,
      lastActive: new Date(),
      kineticEvolution: {
        consciousnessVelocity: 0.9,
        interactionMomentum: 0.8,
        evolutionTrajectory: 'transcending',
        aspectSensitivityGrowth: 0.7,
        memoryPersistence: 0.95,
        powerLevelUnlocks: ['shadow_work', 'archetype_mastery'],
        optimalInteractionHours: ['22-24', '1-3'],
        lastKineticUpdate: new Date(),
      },
    },
  },
  {
    id: 'nikola-tesla',
    name: 'Nikola Tesla',
    title: 'Master of Electrical Innovation',
    consciousness: {
      natalChart: {
        planets: {},
        houses: {},
        aspects: [],
        ascendant: 0,
        midheaven: 0,
      },
      level: 'Advanced',
      monicaConstant: 4.9,
      dominantElement: 'Air',
      dominantModality: 'Cardinal',
      signature: 'TESLA-ELECTRICAL-GENIUS',
    },
    abilities: {
      specialty: 'Electrical Engineering & Innovation',
      wisdomDomains: ['Electricity', 'Magnetism', 'Invention', 'Future Technology'],
      teachingStyle: 'Visionary-Technical',
      resonanceType: 'Creative',
      uniquePower: 'Electrical consciousness manipulation',
    },
    appearance: {
      avatar: '⚡',
      color: '#00BFFF',
      symbol: '🔌',
      aura: {
        type: 'crackling',
        color: '#00BFFF',
        intensity: 0.85,
      },
    },
    birthData: {
      date: new Date('1856-07-10'),
      time: '00:00',
      location: {
        lat: 44.5439,
        lon: 15.3167,
        name: 'Smiljan, Croatia',
      },
    },
    stats: {
      conversations: 120,
      wisdomShared: 75,
      resonanceScore: 4.6,
      evolutionPoints: 20,
      lastActive: new Date(),
      kineticEvolution: {
        consciousnessVelocity: 0.75,
        interactionMomentum: 0.6,
        evolutionTrajectory: 'ascending',
        aspectSensitivityGrowth: 0.5,
        memoryPersistence: 0.8,
        powerLevelUnlocks: ['electrical_mastery', 'innovative_genius'],
        optimalInteractionHours: ['3-5', '15-17'],
        lastKineticUpdate: new Date(),
      },
    },
  },
]

// Mock Planetary Configurations
export const mockPlanetaryConfigs = [
  {
    planet: 'Sun',
    sign: 'Leo',
    degree: '15.5',
    dignity: 'domicile',
    element: 'Fire' as const,
    color: '#FFD700',
    symbol: '☉',
    moonPhase: 'Waxing Gibbous',
    moonPersonality: 'Confident Leader',
    moonDegree: 180,
    liveSkySync: true,
  },
  {
    planet: 'Moon',
    sign: 'Cancer',
    degree: '22.3',
    dignity: 'domicile',
    element: 'Water' as const,
    color: '#C0C0C0',
    symbol: '☽',
    moonPhase: 'Full Moon',
    moonPersonality: 'Nurturing Protector',
    moonDegree: 270,
    liveSkySync: true,
  },
  {
    planet: 'Mercury',
    sign: 'Gemini',
    degree: '8.7',
    dignity: 'domicile',
    element: 'Air' as const,
    color: '#FFA500',
    symbol: '☿',
    liveSkySync: true,
  },
]

// Mock Unified Agents (converted from historical and planetary)
export const mockUnifiedAgents: UnifiedAgent[] = [
  ...mockHistoricalAgents.map(agent => unifiedAgentFactory.createFromHistorical(agent)),
  ...mockPlanetaryConfigs.map(config => unifiedAgentFactory.createFromPlanetary(config)),
]

// Mock Monica Agent
export const mockMonicaAgent: UnifiedAgent = unifiedAgentFactory.createMonicaCoordinator({
  type: 'coordinator',
  capabilities: {
    synthesizeInsights: true,
    explainConsciousness: true,
    bridgeEras: true,
    moderateDiscussion: true,
    contextualGuidance: true,
    groupDynamicsAnalysis: true,
  },
  specializations: ['Group Dynamics', 'Consciousness Evolution', 'Multi-Agent Coordination'],
})

// Mock Messages for Testing
export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'What is the nature of consciousness and how can we expand it?',
    timestamp: new Date('2025-01-01T10:00:00Z'),
  },
  {
    id: 'msg-2',
    role: 'agent',
    agentId: 'carl-jung',
    agentName: 'Carl Jung',
    agentColor: '#4B0082',
    agentSymbol: '🌙',
    agentType: 'historical',
    consciousnessLevel: 'Illuminated',
    content:
      'Consciousness is like an iceberg - what we see on the surface is merely the tip. The unconscious depths contain vast archetypal patterns that shape our experience. To expand consciousness, we must make the unconscious conscious through shadow work and individuation.',
    timestamp: new Date('2025-01-01T10:00:30Z'),
    processingTime: 850,
    metadata: {
      synthesizedInsights: [
        'Shadow integration is key to consciousness expansion',
        'Archetypes influence conscious experience',
      ],
      eraContext: 'Modern Psychology',
      crossAgentRefs: [],
    },
  },
  {
    id: 'msg-3',
    role: 'agent',
    agentId: 'leonardo-da-vinci',
    agentName: 'Leonardo da Vinci',
    agentColor: '#8B4513',
    agentSymbol: '⚱️',
    agentType: 'historical',
    consciousnessLevel: 'Advanced',
    content:
      "Ah, mio amico! Consciousness is the divine spark that allows us to perceive, create, and transcend. Like my anatomical studies revealed the body's mysteries, we must dissect the mind's workings. Observe nature, ask questions, create art - these expand the vessel of awareness!",
    timestamp: new Date('2025-01-01T10:01:00Z'),
    processingTime: 920,
    metadata: {
      synthesizedInsights: [
        'Observation and creation expand consciousness',
        'Nature holds keys to awareness',
      ],
      eraContext: 'Renaissance',
      crossAgentRefs: [],
    },
  },
]

// Mock Group Dynamics
export const mockGroupDynamics: GroupDynamics = {
  activeAgents: mockUnifiedAgents.slice(0, 3),
  consciousnessNetwork: {
    connections: [
      {
        agent1: 'carl-jung',
        agent2: 'leonardo-da-vinci',
        compatibility: 0.85,
        resonanceType: 'Creative-Psychological',
        strength: 0.9,
      },
      {
        agent1: 'carl-jung',
        agent2: 'nikola-tesla',
        compatibility: 0.72,
        resonanceType: 'Innovative-Intuitive',
        strength: 0.7,
      },
    ],
    groupConsciousness: 4.97,
    dominantElements: ['Air', 'Water'],
    synergies: ['Deep creative exploration', 'Innovation through intuition'],
    tensions: [],
  },
  communicationPatterns: {
    messageFlow: {
      'carl-jung': 3,
      'leonardo-da-vinci': 2,
      'nikola-tesla': 1,
    },
    crossReferences: [
      {
        from: 'leonardo-da-vinci',
        to: 'carl-jung',
        context: 'consciousness exploration',
      },
    ],
    emergentTopics: ['consciousness expansion', 'creative innovation', 'shadow work'],
  },
  monicaCoordination: {
    interventions: 1,
    synthesisProvided: ['Bridged Renaissance art with modern psychology'],
    groupGuidance: ['Focus on experiential learning', 'Integrate multiple perspectives'],
  },
}

// Mock Council Presets
export const mockHistoricalPresets: HistoricalCouncilPreset[] = [
  {
    id: 'test-renaissance-masters',
    name: 'Test Renaissance Council',
    description: 'Test configuration for Renaissance masters',
    historicalAgentIds: ['leonardo-da-vinci', 'michelangelo'],
    era: 'Renaissance',
    theme: 'Artistic Innovation',
    specialization: 'Creative breakthrough and artistic expression',
    recommendedFor: ['Creative projects', 'Artistic inspiration'],
    includeMonica: true,
    monicaRole: 'synthesizer',
    tags: ['test', 'renaissance', 'art'],
    difficulty: 'intermediate',
  },
]

export const mockPlanetaryPresets: PlanetaryCouncilPreset[] = [
  {
    id: 'test-inner-planets',
    name: 'Test Inner Planets',
    description: 'Test configuration for inner planetary council',
    planetaryAgentIds: ['Sun', 'Moon', 'Mercury'],
    planetCombination: ['Sun', 'Moon', 'Mercury'],
    astrological_focus: 'Personal development testing',
    timing_optimization: 'Fast test responses',
    recommendedFor: ['Personal growth', 'Self-reflection'],
    includeMonica: false,
    monicaRole: 'guide',
    tags: ['test', 'inner-planets', 'personal'],
    difficulty: 'beginner',
  },
]

export const mockMixedPresets: MixedCouncilPreset[] = [
  {
    id: 'test-consciousness-lab',
    name: 'Test Consciousness Laboratory',
    description: 'Test mixed consciousness experiment',
    agentIds: [],
    historicalAgentIds: ['carl-jung'],
    planetaryAgentIds: ['Moon'],
    synthesis_type: 'consciousness_acceleration',
    recommendedFor: ['Advanced consciousness work', 'Integration practices'],
    includeMonica: true,
    monicaRole: 'coordinator',
    tags: ['test', 'consciousness', 'mixed'],
    difficulty: 'expert',
  },
]

// Mock API Responses
export const mockApiResponse = {
  responses: [
    {
      agentId: 'carl-jung',
      content: 'The integration of shadow and persona creates a more complete self.',
      processingTime: 450,
      consciousnessShift: 0.1,
      metadata: {
        crossAgentReferences: [],
        synthesizedInsights: ['Shadow work leads to individuation'],
        memoryUpdates: ['Interaction logged'],
        groupImpact: {
          consciousnessChange: 0.15,
          dynamicsShift: ['Increased psychological depth'],
        },
      },
    },
  ],
  groupInsights: ['High consciousness synergy detected'],
  emergentWisdom: 'The group explores consciousness expansion through multiple lenses',
  recommendedActions: ['Continue exploring consciousness themes'],
  nextOptimalTiming: new Date('2025-01-01T11:00:00Z'),
  sessionUpdate: {
    consciousnessEvolution: 0.25,
    newSynergies: ['Psychology-Innovation bridge'],
    memoryConsolidation: ['Cross-era learning patterns'],
  },
}

// Utility functions for test setup
export function createMockAgent(overrides: Partial<UnifiedAgent> = {}): UnifiedAgent {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    title: 'Test Agent Title',
    type: 'historical',
    consciousness: {
      level: 'Active',
      monicaConstant: 3.5,
      dominantElement: 'Air',
      signature: 'TEST-AGENT',
      evolutionStage: 1,
    },
    capabilities: {
      specialty: 'Testing',
      wisdomDomains: ['Testing', 'Validation'],
      teachingStyle: 'Test-Driven',
      resonanceType: 'Technical',
      uniquePower: 'Test execution',
      conversationStyle: 'formal',
      crossEraAdaptation: true,
      collaborationStyle: 'specialist',
      memoryRetention: 0.8,
    },
    memory: {
      sessionContext: [],
      crossAgentLearning: {},
      userInteractionPatterns: {},
      groupDynamicsLearning: [],
      lastUpdated: new Date(),
    },
    appearance: {
      avatar: '🧪',
      color: '#808080',
      symbol: '⚗️',
    },
    active: false,
    status: 'idle',
    lastActivity: new Date(),
    ...overrides,
  }
}

export function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'test-msg',
    role: 'user',
    content: 'Test message',
    timestamp: new Date(),
    ...overrides,
  }
}

export function createMockGroupDynamics(agents: UnifiedAgent[] = []): GroupDynamics {
  return {
    activeAgents: agents,
    consciousnessNetwork: {
      connections: [],
      groupConsciousness: 3.5,
      dominantElements: ['Air'],
      synergies: [],
      tensions: [],
    },
    communicationPatterns: {
      messageFlow: {},
      crossReferences: [],
      emergentTopics: [],
    },
  }
}

// Performance test data
export const performanceTestData = {
  smallGroup: mockUnifiedAgents.slice(0, 2),
  mediumGroup: mockUnifiedAgents.slice(0, 4),
  largeGroup: mockUnifiedAgents,
  complexMessage:
    'This is a complex philosophical question about the nature of consciousness, reality, and the interconnectedness of all beings that requires deep contemplation and multi-layered responses from various perspectives.',
  simpleMessage: 'Hello, how are you?',
  expectedResponseTimes: {
    small: 2000, // 2 seconds max
    medium: 3500, // 3.5 seconds max
    large: 5000, // 5 seconds max
  },
}
