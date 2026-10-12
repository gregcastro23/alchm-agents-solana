import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/agents/activations/route'

describe('GET /api/agents/activations', () => {
  it('returns active degree agents in the commensal alignment contract', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/agents/activations?date=2026-04-01T12:00:00Z')
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.activations.length).toBeGreaterThan(0)
    expect(data.activations.length).toBeLessThanOrEqual(12)
    expect(data.activations[0]).toMatchObject({
      agent: {
        id: expect.stringMatching(/^planetary-/),
        name: expect.any(String),
        description: expect.any(String),
      },
      dignity: expect.any(String),
      element: expect.any(String),
      planetaryRuler: expect.any(String),
    })
    expect(data.activations[0].strength).toBeGreaterThanOrEqual(0)
    expect(data.activations[0].strength).toBeLessThanOrEqual(1)
  })

  it('rejects invalid dates', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/agents/activations?date=not-a-date')
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid date parameter' })
  })
})
