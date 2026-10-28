import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/agents/council-solar-return/route'

describe('Solar Return Council API Route', () => {
  it('handles GET request without date param and returns 200 with briefing edition', async () => {
    const req = new NextRequest('http://localhost:3000/api/agents/council-solar-return')
    const response = await GET(req)

    expect(response.status).toBe(200)
    const json = await response.json()

    expect(json.status).toBeDefined()
    expect(json.edition).not.toBeNull()
    expect(json.edition.schemaVersion).toBe(1)
    expect(json.edition.telemetry.solarAlignment).toBeDefined()
    expect(json.edition.turns.length).toBeGreaterThanOrEqual(8)
  })

  it('handles GET request with specific date param', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/agents/council-solar-return?date=2026-10-27T12:00:00.000Z'
    )
    const response = await GET(req)

    expect(response.status).toBe(200)
    const json = await response.json()

    expect(json.edition).not.toBeNull()
    expect(json.edition.date).toBe('2026-10-27')
    expect(json.edition.telemetry.solarAlignment.sign).toBe('Scorpio')
  })
})
