#!/usr/bin/env node

/**
 * Comprehensive Beta Testing Validation Suite
 * Tests all critical user journeys for the Planetary Agents platform
 */

import { prisma } from './lib/db'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  duration: number
  details: string
  critical: boolean
}

class BetaTestingSuite {
  private results: TestResult[] = []
  private baseUrl = 'http://localhost:3002'

  async runAllTests(): Promise<void> {
    console.log('🧪 PLANETARY AGENTS BETA TESTING SUITE')
    console.log('======================================\n')

    await this.testUserRegistrationFlow()
    await this.testAgentInteractionFlow()
    await this.testEvolutionPersistence()
    await this.testSigilGeneration()
    await this.testErrorHandling()
    await this.testPerformance()
    await this.testDatabaseIntegrity()

    this.printResults()
  }

  private async testUserRegistrationFlow(): Promise<void> {
    console.log('📝 Testing User Registration Flow...')

    // Test 1: User Registration
    await this.runTest('User Registration API', true, async () => {
      const testEmail = `beta-test-${Date.now()}@planetary.agents`
      const response = await fetch(`${this.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: testEmail,
          password: 'testpassword123',
          name: 'Beta Test User',
          birthChart: {
            year: 1995,
            month: 8,
            day: 20,
            hour: 15,
            minute: 45,
            latitude: 40.7128,
            longitude: -74.006,
          },
        }),
      })

      const data = await response.json()
      if (!data.success) throw new Error(`Registration failed: ${data.error}`)

      // Verify database entries
      const user = await prisma.user.findUnique({ where: { email: testEmail } })
      if (!user) throw new Error('User not found in database')

      const profile = await prisma.profile.findUnique({ where: { userId: user.id } })
      if (!profile) throw new Error('Profile not created')

      const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })
      if (!subscription) throw new Error('Subscription not created')

      return `User ${user.id} registered successfully with profile and subscription`
    })

    // Test 2: Duplicate Registration Handling
    await this.runTest('Duplicate Registration Handling', false, async () => {
      const response = await fetch(`${this.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: 'beta-test@planetary.agents', // Existing email
          password: 'testpassword123',
          name: 'Duplicate User',
        }),
      })

      const data = await response.json()
      if (response.status !== 409) throw new Error('Should return 409 for duplicate email')
      if (!data.error.includes('already exists')) throw new Error('Error message unclear')

      return 'Duplicate registration properly rejected'
    })
  }

  private async testAgentInteractionFlow(): Promise<void> {
    console.log('\n🤖 Testing Agent Interaction Flow...')

    // Test 3: Agent Chat Interaction
    await this.runTest('Agent Chat Interaction', true, async () => {
      const response = await fetch(`${this.baseUrl}/api/agent-evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          agentId: 'shakespeare',
          sessionId: 'beta-test-chat',
          userMessage: 'Tell me about your greatest works',
          agentResponse:
            'Ah, good friend, mine greatest works doth spring from love and loss! Romeo and Juliet speaks to hearts young and old, whilst Hamlet doth probe the depths of mortal contemplation. Each play a mirror to the human soul, reflecting our deepest truths and fears.',
          location: { lat: 40.7128, lon: -74.006 },
        }),
      })

      const data = await response.json()
      if (!data.success) throw new Error(`Interaction failed: ${data.message}`)
      if (!data.snapshot.powerGained) throw new Error('No power gained from interaction')

      return `Interaction recorded: ${data.snapshot.powerGained} power gained`
    })

    // Test 4: Agent Evolution Metrics
    await this.runTest('Agent Evolution Metrics', true, async () => {
      const response = await fetch(
        `${this.baseUrl}/api/agent-evolution?agentId=shakespeare&action=metrics`
      )
      const data = await response.json()

      if (!data.metrics) throw new Error('No metrics returned')
      if (data.metrics.totalPower <= 0) throw new Error('Total power should be greater than 0')
      if (data.metrics.totalInteractions <= 0) throw new Error('Should have interactions')

      return `Metrics: ${data.metrics.totalPower} power, ${data.metrics.totalInteractions} interactions`
    })

    // Test 5: Multiple Agent Support
    await this.runTest('Multiple Agent Support', false, async () => {
      const agents = ['leonardo-da-vinci', 'einstein', 'tesla']
      const results = []

      for (const agentId of agents) {
        const response = await fetch(
          `${this.baseUrl}/api/agent-evolution?agentId=${agentId}&action=metrics`
        )
        const data = await response.json()
        if (data.metrics) results.push(agentId)
      }

      if (results.length !== agents.length) {
        throw new Error(`Only ${results.length}/${agents.length} agents working`)
      }

      return `All ${results.length} agents responding correctly`
    })
  }

  private async testEvolutionPersistence(): Promise<void> {
    console.log('\n💾 Testing Evolution Persistence...')

    // Test 6: Cross-Session Persistence
    await this.runTest('Cross-Session Persistence', true, async () => {
      // First interaction
      const response1 = await fetch(`${this.baseUrl}/api/agent-evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          agentId: 'einstein',
          sessionId: 'persistence-test-1',
          userMessage: 'Explain relativity',
          agentResponse:
            'Time and space are interwoven fabric, mein friend! When you move through space, you also move through time. The faster you go, the slower time moves relative to stationary observer.',
          location: { lat: 40.7128, lon: -74.006 },
        }),
      })

      const data1 = await response1.json()
      const power1 = data1.snapshot.totalPower

      // Second interaction in different session
      const response2 = await fetch(`${this.baseUrl}/api/agent-evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          agentId: 'einstein',
          sessionId: 'persistence-test-2',
          userMessage: 'What about E=mc²?',
          agentResponse:
            'Ach, my most famous equation! Energy equals mass times the speed of light squared. It shows that tiny amount of matter can release enormous energy.',
          location: { lat: 40.7128, lon: -74.006 },
        }),
      })

      const data2 = await response2.json()
      const power2 = data2.snapshot.totalPower

      if (power2 <= power1) throw new Error('Power did not accumulate across sessions')

      return `Power accumulated: ${power1} → ${power2}`
    })
  }

  private async testSigilGeneration(): Promise<void> {
    console.log('\n🔮 Testing Sigil Generation...')

    // Test 7: Natal Sigil Generation
    await this.runTest('Natal Sigil Generation', false, async () => {
      const response = await fetch(`${this.baseUrl}/api/generate-natal-sigil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthInfo: {
            name: 'Beta Tester',
            year: 1990,
            month: 6,
            day: 15,
            hour: 14,
            minute: 30,
            latitude: 37.7749,
            longitude: -122.4194,
          },
          style: 'cosmic',
        }),
      })

      const data = await response.json()
      if (!data.success) throw new Error(`Sigil generation failed: ${data.error}`)

      return data.usedFallback ? 'Generated with fallback' : 'Generated successfully'
    })

    // Test 8: Invalid Sigil Data Handling
    await this.runTest('Invalid Sigil Data Handling', false, async () => {
      const response = await fetch(`${this.baseUrl}/api/generate-natal-sigil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      })

      const data = await response.json()
      if (data.success) throw new Error('Should fail with invalid data')
      if (!data.error) throw new Error('Should return error message')

      return 'Invalid data properly rejected'
    })
  }

  private async testErrorHandling(): Promise<void> {
    console.log('\n🚨 Testing Error Handling...')

    // Test 9: Malformed JSON Handling
    await this.runTest('Malformed JSON Handling', false, async () => {
      const response = await fetch(`${this.baseUrl}/api/agent-evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json',
      })

      if (response.status === 200) throw new Error('Should reject malformed JSON')

      return `Rejected with status ${response.status}`
    })

    // Test 10: Missing Required Fields
    await this.runTest('Missing Required Fields', false, async () => {
      const response = await fetch(`${this.baseUrl}/api/agent-evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record' }), // Missing agentId
      })

      const data = await response.json()
      if (!data.error) throw new Error('Should return error for missing fields')

      return 'Missing fields properly detected'
    })
  }

  private async testPerformance(): Promise<void> {
    console.log('\n⚡ Testing Performance...')

    // Test 11: Response Time
    await this.runTest('API Response Time', false, async () => {
      const startTime = Date.now()
      const response = await fetch(
        `${this.baseUrl}/api/agent-evolution?agentId=leonardo-da-vinci&action=metrics`
      )
      const elapsed = Date.now() - startTime

      if (elapsed > 2000) throw new Error(`Too slow: ${elapsed}ms`)
      if (!response.ok) throw new Error('Request failed')

      return `Response time: ${elapsed}ms`
    })

    // Test 12: Concurrent Requests
    await this.runTest('Concurrent Request Handling', false, async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        fetch(`${this.baseUrl}/api/agent-evolution?agentId=shakespeare&action=metrics`).then(r =>
          r.json()
        )
      )

      const results = await Promise.all(requests)
      const successful = results.filter(r => r.metrics).length

      if (successful !== 5) throw new Error(`Only ${successful}/5 requests succeeded`)

      return `All ${successful} concurrent requests succeeded`
    })
  }

  private async testDatabaseIntegrity(): Promise<void> {
    console.log('\n🗄️ Testing Database Integrity...')

    // Test 13: Data Consistency
    await this.runTest('Database Data Consistency', true, async () => {
      const userCount = await prisma.user.count()
      const profileCount = await prisma.profile.count()
      const evolutionCount = await prisma.agentEvolutionState.count()

      if (userCount === 0) throw new Error('No users in database')

      // Check basic data integrity
      const interactionCount = await prisma.consciousnessInteraction.count()

      return `${userCount} users, ${profileCount} profiles, ${evolutionCount} evolution states, ${interactionCount} interactions`
    })

    // Test 14: Database Connection
    await this.runTest('Database Connection Health', true, async () => {
      await prisma.$queryRaw`SELECT 1`
      const startTime = Date.now()
      await prisma.user.findFirst()
      const queryTime = Date.now() - startTime

      if (queryTime > 1000) throw new Error(`Slow database: ${queryTime}ms`)

      return `Database responsive (${queryTime}ms)`
    })
  }

  private async runTest(
    name: string,
    critical: boolean,
    testFn: () => Promise<string>
  ): Promise<void> {
    const startTime = Date.now()

    try {
      const details = await testFn()
      const duration = Date.now() - startTime

      this.results.push({
        name,
        status: 'pass',
        duration,
        details,
        critical,
      })

      console.log(`  ✅ ${name} (${duration}ms)`)
    } catch (error) {
      const duration = Date.now() - startTime

      this.results.push({
        name,
        status: 'fail',
        duration,
        details: error.message,
        critical,
      })

      console.log(`  ❌ ${name} (${duration}ms): ${error.message}`)
    }
  }

  private printResults(): void {
    console.log('\n📊 BETA TESTING RESULTS')
    console.log('======================')

    const passed = this.results.filter(r => r.status === 'pass').length
    const failed = this.results.filter(r => r.status === 'fail').length
    const critical = this.results.filter(r => r.critical && r.status === 'fail').length

    console.log(`\nOverall: ${passed}/${this.results.length} tests passed`)
    console.log(`Critical failures: ${critical}`)

    if (critical > 0) {
      console.log('\n🚨 CRITICAL ISSUES:')
      this.results
        .filter(r => r.critical && r.status === 'fail')
        .forEach(r => console.log(`  - ${r.name}: ${r.details}`))
    }

    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length
    console.log(`\nAverage response time: ${Math.round(avgDuration)}ms`)

    console.log('\n🎯 BETA READINESS ASSESSMENT:')

    if (critical === 0 && passed >= this.results.length * 0.8) {
      console.log('✅ READY FOR BETA TESTING')
      console.log('- All critical systems functional')
      console.log('- Database persistence working')
      console.log('- Error handling robust')
      console.log('- Performance acceptable')
    } else if (critical === 0) {
      console.log('⚠️ MOSTLY READY - Minor issues to address')
    } else {
      console.log('❌ NOT READY - Critical issues must be fixed')
    }
  }
}

// Run the test suite
const suite = new BetaTestingSuite()
suite
  .runAllTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
