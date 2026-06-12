import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the trainer so the route test stays fast and deterministic —
// the real trainOnAlchemicalValues runs astronomical calculations
// across many random samples, which is too heavy (and slightly
// non-deterministic) for a route-wiring unit test.
vi.mock('@/lib/monica/alchemical-trainer', () => {
  const fakeResult = {
    samples: [
      {
        birthInfo: {
          year: 1990,
          month: 1,
          day: 1,
          hour: 12,
          minute: 0,
          latitude: 40,
          longitude: -74,
        },
        alchmData: {
          spirit: 1,
          essence: 2,
          matter: 3,
          substance: 4,
          Heat: 0.1,
          Entropy: 0.2,
          Reactivity: 0.3,
          Energy: 0.4,
        },
        planetaryHour: { planet: 'Sun', hourNumber: 1, isDaytime: true },
        timestamp: new Date('2026-01-01T00:00:00Z'),
      },
    ],
    statistics: {
      averages: { spirit: 1 },
      stdDeviation: { spirit: 0 },
      correlations: {},
      quartiles: {},
    },
  }
  return {
    trainOnAlchemicalValues: vi.fn(async () => fakeResult),
    trainWithRetrogrades: vi.fn(async () => ({ ...fakeResult, retrograde: true })),
    todayHourlyAlchemize: vi.fn(async () => ({ hours: [] })),
  }
})

import { GET, POST } from '@/app/api/monica-agent/train-alchemical/route'
import {
  trainOnAlchemicalValues,
  trainWithRetrogrades,
  todayHourlyAlchemize,
} from '@/lib/monica/alchemical-trainer'

describe('Monica Train Alchemical Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs standard training and returns 200 with a result', async () => {
    const request = new NextRequest('http://localhost/api/monica-agent/train-alchemical', {
      method: 'POST',
      body: JSON.stringify({ mode: 'standard', numSamples: 5 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.mode).toBe('standard')
    expect(trainOnAlchemicalValues).toHaveBeenCalledWith(5)
    expect(data.result.samples).toHaveLength(1)
  })

  it('routes retrograde mode to trainWithRetrogrades', async () => {
    const request = new NextRequest('http://localhost/api/monica-agent/train-alchemical', {
      method: 'POST',
      body: JSON.stringify({ mode: 'retrograde', numSamples: 7 }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(trainWithRetrogrades).toHaveBeenCalledWith(7)
    expect(data.result.retrograde).toBe(true)
  })

  it('routes hourly mode to todayHourlyAlchemize', async () => {
    const request = new NextRequest('http://localhost/api/monica-agent/train-alchemical', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'hourly',
        location: { latitude: 51.5, longitude: -0.1 },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(todayHourlyAlchemize).toHaveBeenCalledWith({ latitude: 51.5, longitude: -0.1 })
    expect(data.mode).toBe('hourly')
  })

  it('returns CSV when exportFormat=csv', async () => {
    const request = new NextRequest('http://localhost/api/monica-agent/train-alchemical', {
      method: 'POST',
      body: JSON.stringify({ mode: 'standard', numSamples: 1, exportFormat: 'csv' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    const text = await response.text()
    expect(text.split('\n')[0]).toContain('spirit,essence,matter')
  })

  it('omits samples array when exportFormat=summary', async () => {
    const request = new NextRequest('http://localhost/api/monica-agent/train-alchemical', {
      method: 'POST',
      body: JSON.stringify({ mode: 'standard', exportFormat: 'summary' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.result.samples).toBeUndefined()
    expect(data.result.sampleCount).toBe(1)
    expect(data.result.statistics).toBeDefined()
  })

  it('rejects an unknown mode with 400', async () => {
    const request = new NextRequest('http://localhost/api/monica-agent/train-alchemical', {
      method: 'POST',
      body: JSON.stringify({ mode: 'nonsense' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  it('reports status: available on GET info', async () => {
    const request = new NextRequest(
      'http://localhost/api/monica-agent/train-alchemical?mode=info',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.info.status).toBe('available')
  })

  it('runs a small sample on GET sample', async () => {
    const request = new NextRequest(
      'http://localhost/api/monica-agent/train-alchemical?mode=sample',
      { method: 'GET' }
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(trainOnAlchemicalValues).toHaveBeenCalledWith(3)
  })
})
