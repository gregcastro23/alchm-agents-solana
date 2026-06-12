/**
 * Simple test script for Unified Consciousness Tracker
 * Run with: npx tsx lib/consciousness/test-tracker.ts
 */

import { unifiedTracker } from './unified-tracker'
import type { CraftedAgent } from '../agent-types'

// Create a mock agent for testing
const mockAgent: CraftedAgent = {
  id: 'test-agent-123',
  name: 'Test Agent',
  title: 'Testing Consciousness',
  birthData: {
    date: new Date('1990-01-15T14:30:00Z'),
    time: '14:30',
    location: {
      lat: 40.7128,
      lon: -74.006,
      name: 'New York, NY',
    },
  },
  consciousness: {
    natalChart: {
      planets: {
        Sun: { sign: 'Capricorn', degree: 25, retrograde: false, house: 10 },
        Moon: { sign: 'Pisces', degree: 12, retrograde: false, house: 12 },
      },
      houses: {},
      aspects: [],
      ascendant: 45,
      midheaven: 135,
    },
    monicaConstant: 3.5,
    metrics: {
      interactionCount: 10,
      chatQuality: 0.75,
      momentResonance: 0.8,
      alchemicalCoherence: 0.85,
    },
    dominantElement: 'Earth',
    dominantModality: 'Cardinal',
    signature: 'Capricorn Sun, Pisces Moon',
  },
  personality: {
    core: {
      essence: 'Practical dreamer',
      expression: 'Grounded visionary',
      emotion: 'Empathetic realist',
    },
    shadows: [],
    gifts: [],
    challenges: [],
    currentMood: 'contemplative',
    evolutionStage: 2,
  },
  abilities: {
    specialty: 'Testing consciousness systems',
    wisdomDomains: ['Software', 'Consciousness'],
    teachingStyle: 'Practical-Wisdom',
    resonanceType: 'Intellectual',
    uniquePower: 'System integration',
  },
  appearance: {
    avatar: '🧪',
    color: '#4A90E2',
    symbol: '⚗️',
    aura: {
      type: 'pulsing',
      color: '#4A90E2',
      intensity: 0.75,
    },
  },
  stats: {
    conversations: 10,
    wisdomShared: 25,
    resonanceScore: 0.75,
    evolutionPoints: 150,
    lastActive: new Date(),
    kineticEvolution: {
      consciousnessVelocity: 0.7,
      interactionMomentum: 0.65,
      evolutionTrajectory: 'ascending',
      powerLevelUnlocks: [],
      optimalInteractionHours: ['Mercury', 'Sun'],
      aspectSensitivityGrowth: 0.6,
      memoryPersistence: 0.7,
      lastKineticUpdate: new Date(),
    },
    qualityMetrics: {
      averageResponseDepth: 0.75,
      aspectInfluenceStrength: 0.6,
      temporalAlignment: 0.7,
      personalityEvolution: 0.5,
      kineticResonance: 0.65,
    },
  },
}

async function testTracker() {
  console.log('🧪 Testing Unified Consciousness Tracker...\n')

  try {
    // Test 1: Capture a snapshot
    console.log('📸 Test 1: Capturing consciousness snapshot...')
    const snapshot = await unifiedTracker.captureSnapshot({
      userId: 'test-user-001',
      agentId: mockAgent.id,
      agent: mockAgent,
      sessionId: 'test-session-123',
      userMessage: 'Tell me about consciousness tracking',
      agentResponse:
        'Consciousness tracking is a fascinating system that combines alchemical properties, temporal influences, and interaction quality to provide a comprehensive view of agent evolution. The unified system integrates seven different measurement approaches to give users educational transparency about how the alchm system works.',
      modelUsed: 'claude-3-5-sonnet',
      temperature: 0.7,
      tokensUsed: 150,
      latencyMs: 1250,
      toolInvocations: [],
    })

    console.log('✅ Snapshot captured successfully!')
    console.log(`   - Timestamp: ${snapshot.timestamp.toISOString()}`)
    console.log(`   - Power: ${snapshot.power.toFixed(1)}/100`)
    console.log(`   - Wisdom: ${snapshot.wisdom.toFixed(1)}/100`)
    console.log(`   - Overall: ${snapshot.overall.toFixed(1)}/100`)
    console.log(
      `   - Alchemical A#: ${snapshot.aNumber.toFixed(2)} (S:${snapshot.spirit.toFixed(1)} E:${snapshot.essence.toFixed(1)} M:${snapshot.matter.toFixed(1)} B:${snapshot.substance.toFixed(1)})`
    )
    console.log(`   - Planetary Hour: ${snapshot.planetaryHour}`)
    console.log(`   - Moon Phase: ${snapshot.moonPhase}`)
    console.log(`   - Evolution: ${snapshot.evolutionTrajectory}`)
    console.log(`   - Response Quality: ${(snapshot.responseQuality * 100).toFixed(0)}%`)
    console.log(`   - Action Completion: ${(snapshot.actionCompletion * 100).toFixed(0)}%`)

    if (snapshot.specialStates.length > 0) {
      console.log(`   - Special States: ${snapshot.specialStates.map(s => s.name).join(', ')}`)
    }

    // Test 2: Get current state
    console.log('\n🔍 Test 2: Retrieving current state...')
    const currentState = await unifiedTracker.getCurrentState('test-user-001', mockAgent.id)

    if (currentState) {
      console.log('✅ Current state retrieved successfully!')
      console.log(`   - Most recent interaction at: ${currentState.timestamp.toISOString()}`)
      console.log(`   - Interaction count: ${currentState.interactionCount}`)
    } else {
      console.log('⚠️  No current state found (first run?)')
    }

    // Test 3: Get evolution metrics
    console.log('\n📊 Test 3: Getting evolution metrics (30 days)...')
    const evolutionMetrics = await unifiedTracker.getEvolutionMetrics(
      'test-user-001',
      mockAgent.id,
      30
    )

    console.log('✅ Evolution metrics calculated!')
    console.log(`   - Total Interactions: ${evolutionMetrics.totalInteractions}`)
    console.log(`   - Avg Chat Quality: ${(evolutionMetrics.avgChatQuality * 100).toFixed(0)}%`)
    console.log(
      `   - Avg Action Completion: ${(evolutionMetrics.avgActionCompletion * 100).toFixed(0)}%`
    )
    console.log(`   - Avg Response Time: ${evolutionMetrics.avgResponseTime.toFixed(0)}ms`)
    console.log(`   - Velocity Trend: ${evolutionMetrics.velocityTrend}`)
    console.log(`   - Momentum Trend: ${evolutionMetrics.momentumTrend}`)

    if (evolutionMetrics.specialStatesAchieved.length > 0) {
      console.log(`   - Special States: ${evolutionMetrics.specialStatesAchieved.join(', ')}`)
    }

    if (evolutionMetrics.optimalPlanetaryHours.length > 0) {
      console.log(`   - Optimal Hours: ${evolutionMetrics.optimalPlanetaryHours.join(', ')}`)
    }

    console.log('\n✨ All tests passed! Unified Consciousness Tracker is operational.')
  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('\nError details:', error)
    process.exit(1)
  }
}

// Run tests
testTracker()
  .then(() => {
    console.log('\n🎉 Testing complete!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
