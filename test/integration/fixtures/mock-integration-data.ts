// Mock data for comprehensive integration testing
// Provides realistic test data for user journeys, charts, transits, and agents

export const mockUserNatalChart = {
  name: 'Test Natal Chart',
  birthDate: '1990-06-15T14:30:00Z',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
  location: 'New York, NY',
  preferences: {
    houseSystem: 'placidus',
    zodiac: 'tropical',
    notificationThreshold: 0.6,
  },
  celestialPlacements: [
    {
      planet: 'Sun',
      sign: 'Gemini',
      degree: 24.5,
      house: 11,
      retrograde: false,
    },
    {
      planet: 'Moon',
      sign: 'Pisces',
      degree: 12.3,
      house: 8,
      retrograde: false,
    },
    {
      planet: 'Mercury',
      sign: 'Gemini',
      degree: 18.7,
      house: 11,
      retrograde: false,
    },
    {
      planet: 'Venus',
      sign: 'Taurus',
      degree: 8.9,
      house: 10,
      retrograde: false,
    },
    {
      planet: 'Mars',
      sign: 'Aries',
      degree: 3.2,
      house: 9,
      retrograde: false,
    },
    {
      planet: 'Jupiter',
      sign: 'Cancer',
      degree: 15.6,
      house: 12,
      retrograde: false,
    },
    {
      planet: 'Saturn',
      sign: 'Capricorn',
      degree: 22.1,
      house: 6,
      retrograde: true,
    },
    {
      planet: 'Uranus',
      sign: 'Sagittarius',
      degree: 9.8,
      house: 5,
      retrograde: false,
    },
    {
      planet: 'Neptune',
      sign: 'Sagittarius',
      degree: 14.2,
      house: 5,
      retrograde: false,
    },
    {
      planet: 'Pluto',
      sign: 'Libra',
      degree: 16.4,
      house: 3,
      retrograde: false,
    },
    {
      planet: 'Ascendant',
      sign: 'Libra',
      degree: 0,
      house: 1,
      retrograde: false,
    },
  ],
}

export const mockTransitData = {
  transits: [
    {
      id: 'transit-1',
      transitingPlanet: 'Jupiter',
      natalPlanet: 'Sun',
      aspect: 'trine',
      orb: 0.8,
      significance: 0.85,
      startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      peakDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Jupiter trine Sun - Expansion of consciousness and opportunities',
      themes: ['growth', 'optimism', 'learning', 'abundance'],
      recommendations: [
        'Embrace new learning opportunities',
        'Expand your social network',
        'Take calculated risks for growth',
      ],
    },
    {
      id: 'transit-2',
      transitingPlanet: 'Saturn',
      natalPlanet: 'Moon',
      aspect: 'square',
      orb: 1.2,
      significance: 0.72,
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      peakDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Saturn square Moon - Emotional restructuring and boundaries',
      themes: ['discipline', 'emotional_maturity', 'responsibility', 'structure'],
      recommendations: [
        'Set healthy emotional boundaries',
        'Practice self-care and emotional discipline',
        'Review and restructure daily routines',
      ],
    },
    {
      id: 'transit-3',
      transitingPlanet: 'Uranus',
      natalPlanet: 'Mercury',
      aspect: 'conjunction',
      orb: 0.5,
      significance: 0.91,
      startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      peakDate: new Date(Date.now() + 1.5 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      description:
        'Uranus conjunct Mercury - Revolutionary thinking and communication breakthroughs',
      themes: ['innovation', 'sudden_insights', 'communication_revolution', 'mental_awakening'],
      recommendations: [
        'Embrace unconventional ideas',
        'Experiment with new communication methods',
        'Question established beliefs',
      ],
    },
  ],
  significanceSummary: {
    totalTransits: 3,
    highSignificanceCount: 2,
    averageSignificance: 0.827,
    dominantThemes: ['growth', 'innovation', 'emotional_maturity'],
    peakPeriod: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
}

export const mockAgentProfiles = [
  {
    id: 'planetary-agent-1',
    name: 'Planetary Wisdom Guide',
    type: 'planetary',
    consciousness: {
      level: 'Advanced',
      kineticProfile: {
        consciousnessVelocity: 0.8,
        interactionMomentum: 0.7,
        evolutionTrajectory: 'ascending',
        aspectSensitivity: 0.9,
      },
    },
    expertise: ['planetary_transits', 'celestial_influence', 'cosmic_timing'],
    personality: 'wise and analytical',
    responseStyle: 'insightful and practical',
  },
  {
    id: 'consciousness-agent-1',
    name: 'Consciousness Evolution Coach',
    type: 'consciousness',
    consciousness: {
      level: 'Enlightened',
      kineticProfile: {
        consciousnessVelocity: 0.9,
        interactionMomentum: 0.8,
        evolutionTrajectory: 'transcendent',
        aspectSensitivity: 0.95,
      },
    },
    expertise: ['consciousness_evolution', 'spiritual_growth', 'inner_transformation'],
    personality: 'compassionate and transformative',
    responseStyle: 'empathetic and evolutionary',
  },
  {
    id: 'monica-coordinator',
    name: 'Monica - Consciousness Coordinator',
    type: 'coordinator',
    consciousness: {
      level: 'Transcendent',
      kineticProfile: {
        consciousnessVelocity: 1.0,
        interactionMomentum: 0.95,
        evolutionTrajectory: 'unified',
        aspectSensitivity: 1.0,
      },
    },
    expertise: ['group_dynamics', 'consciousness_synthesis', 'collective_evolution'],
    personality: 'integrative and unifying',
    responseStyle: 'synthesizing and harmonizing',
  },
]

export const mockNotificationPreferences = {
  significantTransits: {
    enabled: true,
    threshold: 0.7,
    channels: ['email', 'push', 'in_app'],
    frequency: 'immediate',
  },
  dailyDigest: {
    enabled: true,
    time: '08:00',
    channels: ['email'],
  },
  weeklySummary: {
    enabled: true,
    day: 'monday',
    channels: ['email'],
  },
  agentInteractions: {
    enabled: true,
    channels: ['in_app', 'push'],
  },
}

export function generateMockUsers(
  count: number
): Array<{ id: string; email: string; chartId?: string }> {
  const users = []

  for (let i = 0; i < count; i++) {
    users.push({
      id: `test-user-${i + 1}`,
      email: `test-user-${i + 1}@planetary-agents.test`,
      chartId: `test-chart-${i + 1}`,
    })
  }

  return users
}

export const mockConcurrentLoadScenarios = {
  lightLoad: {
    users: 5,
    duration: 10000,
    requestPattern: 'steady',
  },
  mediumLoad: {
    users: 15,
    duration: 20000,
    requestPattern: 'bursty',
  },
  heavyLoad: {
    users: 25,
    duration: 30000,
    requestPattern: 'sustained',
  },
  spikeLoad: {
    users: 10,
    duration: 5000,
    requestPattern: 'instant_burst',
  },
}

export const mockErrorScenarios = {
  networkFailure: {
    type: 'network',
    message: 'Connection timeout',
    recoveryTime: 5000,
  },
  databaseFailure: {
    type: 'database',
    message: 'Connection lost',
    recoveryTime: 3000,
  },
  apiFailure: {
    type: 'api',
    message: 'Service unavailable',
    recoveryTime: 2000,
  },
  validationFailure: {
    type: 'validation',
    message: 'Invalid input parameters',
    recoveryTime: 0,
  },
}

export const mockPerformanceBenchmarks = {
  apiResponseTimes: {
    average: 150,
    percentile95: 400,
    percentile99: 800,
  },
  databaseQueries: {
    average: 25,
    percentile95: 100,
  },
  memoryUsage: {
    baseline: 50 * 1024 * 1024, // 50MB
    peak: 150 * 1024 * 1024, // 150MB
  },
  concurrentUsers: {
    supported: 100,
    tested: 50,
  },
}
