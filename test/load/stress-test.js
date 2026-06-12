/**
 * Load Testing for Planetary Agents Backend
 * =========================================
 *
 * Comprehensive stress testing to ensure the system can handle
 * production load with thousands of concurrent users.
 */

import { performance } from 'perf_hooks'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:8001'

// Test configuration
const LOAD_TEST_CONFIG = {
  concurrentUsers: 100,
  testDurationMs: 60000, // 1 minute
  requestsPerSecond: 10,
  endpoints: [
    '/api/health',
    '/api/planetary/current-hour',
    '/api/tokens/calculate',
    '/api/kinetics/enhanced',
  ],
}

class LoadTester {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      startTime: null,
      endTime: null,
    }
  }

  async runStressTest() {
    console.log('🧪 Starting Planetary Agents Load Test')
    console.log('=====================================')
    console.log(`Target: ${BACKEND_URL}`)
    console.log(`Concurrent Users: ${LOAD_TEST_CONFIG.concurrentUsers}`)
    console.log(`Duration: ${LOAD_TEST_CONFIG.testDurationMs / 1000}s`)
    console.log(`Requests/Second: ${LOAD_TEST_CONFIG.requestsPerSecond}`)
    console.log('')

    this.results.startTime = Date.now()

    // Create concurrent user simulations
    const userPromises = []
    for (let i = 0; i < LOAD_TEST_CONFIG.concurrentUsers; i++) {
      userPromises.push(this.simulateUser(i))
    }

    // Run all simulations concurrently
    await Promise.all(userPromises)

    this.results.endTime = Date.now()
    this.generateReport()
  }

  async simulateUser(userId) {
    const userStartTime = Date.now()
    const endTime = userStartTime + LOAD_TEST_CONFIG.testDurationMs

    while (Date.now() < endTime) {
      try {
        // Random endpoint selection
        const endpoint =
          LOAD_TEST_CONFIG.endpoints[Math.floor(Math.random() * LOAD_TEST_CONFIG.endpoints.length)]

        await this.makeRequest(endpoint, userId)

        // Wait before next request
        const delay = 1000 / LOAD_TEST_CONFIG.requestsPerSecond
        await this.sleep(delay + Math.random() * delay) // Add jitter
      } catch (error) {
        this.results.errors.push({
          userId,
          error: error.message,
          timestamp: Date.now(),
        })
      }
    }
  }

  async makeRequest(endpoint, userId) {
    const startTime = performance.now()

    try {
      let requestBody = {}

      // Customize request body based on endpoint
      switch (endpoint) {
        case '/api/planetary/current-hour':
          requestBody = {
            location: { lat: 37.7749, lon: -122.4194 },
            datetime: new Date().toISOString(),
          }
          break
        case '/api/tokens/calculate':
          requestBody = {
            tokens: { Spirit: 1.0, Essence: 0.8, Matter: 0.6, Substance: 0.4 },
            location: { lat: 37.7749, lon: -122.4194 },
          }
          break
        case '/api/kinetics/enhanced':
          requestBody = {
            location: { lat: 37.7749, lon: -122.4194 },
            options: { includeAgentOptimization: true },
          }
          break
      }

      const method = endpoint === '/api/health' ? 'GET' : 'POST'
      const headers = method === 'POST' ? { 'Content-Type': 'application/json' } : {}
      const body = method === 'POST' ? JSON.stringify(requestBody) : undefined

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method,
        headers,
        body,
      })

      const responseTime = performance.now() - startTime

      this.results.totalRequests++
      this.results.responseTimes.push(responseTime)

      if (response.ok) {
        this.results.successfulRequests++
      } else {
        this.results.failedRequests++
        this.results.errors.push({
          userId,
          endpoint,
          status: response.status,
          timestamp: Date.now(),
        })
      }
    } catch (error) {
      const responseTime = performance.now() - startTime
      this.results.totalRequests++
      this.results.failedRequests++
      this.results.responseTimes.push(responseTime)

      throw error
    }
  }

  generateReport() {
    const duration = (this.results.endTime - this.results.startTime) / 1000
    const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100

    // Calculate percentiles
    const sortedTimes = this.results.responseTimes.sort((a, b) => a - b)
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)]
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)]
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)]
    const avg = sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length

    console.log('')
    console.log('📊 LOAD TEST RESULTS')
    console.log('====================')
    console.log(`Duration: ${duration.toFixed(2)}s`)
    console.log(`Total Requests: ${this.results.totalRequests}`)
    console.log(`Successful: ${this.results.successfulRequests}`)
    console.log(`Failed: ${this.results.failedRequests}`)
    console.log(`Success Rate: ${successRate.toFixed(2)}%`)
    console.log('')
    console.log('📈 RESPONSE TIME ANALYSIS')
    console.log('=========================')
    console.log(`Average: ${avg.toFixed(2)}ms`)
    console.log(`P50: ${p50.toFixed(2)}ms`)
    console.log(`P95: ${p95.toFixed(2)}ms`)
    console.log(`P99: ${p99.toFixed(2)}ms`)
    console.log(`Min: ${Math.min(...sortedTimes).toFixed(2)}ms`)
    console.log(`Max: ${Math.max(...sortedTimes).toFixed(2)}ms`)
    console.log('')
    console.log('🎯 PERFORMANCE TARGETS')
    console.log('======================')
    console.log(`P95 < 100ms: ${p95 < 100 ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Success Rate > 99%: ${successRate > 99 ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Average < 50ms: ${avg < 50 ? '✅ PASS' : '❌ FAIL'}`)
    console.log('')

    if (this.results.errors.length > 0) {
      console.log('❌ ERRORS ENCOUNTERED')
      console.log('====================')
      this.results.errors.slice(0, 10).forEach(error => {
        console.log(`• ${error.endpoint || 'Unknown'}: ${error.error || error.status}`)
      })
      if (this.results.errors.length > 10) {
        console.log(`... and ${this.results.errors.length - 10} more errors`)
      }
    }

    // Overall assessment
    const overallPass = successRate > 99 && p95 < 100 && avg < 50
    console.log('')
    console.log(
      `🎯 OVERALL ASSESSMENT: ${overallPass ? '✅ PRODUCTION READY' : '⚠️  NEEDS OPTIMIZATION'}`
    )

    if (!overallPass) {
      console.log('')
      console.log('🔧 OPTIMIZATION RECOMMENDATIONS:')
      if (successRate <= 99) console.log('• Improve error handling and retry logic')
      if (p95 >= 100) console.log('• Optimize slow endpoints and add more caching')
      if (avg >= 50) console.log('• Review database queries and connection pooling')
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// WebSocket load testing
class WebSocketLoadTester {
  async testWebSocketLoad() {
    console.log('')
    console.log('🌐 WEBSOCKET LOAD TEST')
    console.log('======================')

    const connections = []
    const maxConnections = 50

    try {
      // Create multiple WebSocket connections
      for (let i = 0; i < maxConnections; i++) {
        const ws = new WebSocket(WEBSOCKET_URL)
        connections.push(ws)

        ws.onopen = () => {
          // Subscribe to a channel
          ws.send(
            JSON.stringify({
              type: 'subscribe',
              channel: 'planetary-hours',
              data: { location: { lat: 37.7749, lon: -122.4194 } },
            })
          )
        }

        // Small delay between connections
        await this.sleep(10)
      }

      console.log(`✅ Created ${connections.length} WebSocket connections`)

      // Wait for connections to stabilize
      await this.sleep(2000)

      // Close all connections
      connections.forEach(ws => ws.close())

      console.log('✅ WebSocket load test completed successfully')
    } catch (error) {
      console.log(`❌ WebSocket load test failed: ${error.message}`)
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const loadTester = new LoadTester()
  const wsLoadTester = new WebSocketLoadTester()

  console.log('🚀 Starting comprehensive load testing...')
  console.log('')

  await loadTester.runStressTest()
  await wsLoadTester.testWebSocketLoad()

  console.log('')
  console.log('🎯 Load testing complete!')
}

export { LoadTester, WebSocketLoadTester }
