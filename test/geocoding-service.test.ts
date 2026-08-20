import { describe, it, expect } from 'vitest'
import {
  searchGeocodeLocations,
  geocodeLocation,
  geocodeLocationSingle,
  formatLocationName,
} from '@/lib/services/geocoding-service'
import { GET as geocodingHandler } from '@/app/api/geocoding/route'
import { NextRequest } from 'next/server'

describe('Geocoding Service & Birth Location Autocomplete', () => {
  it('formats raw location strings into clean primary and secondary labels', () => {
    const raw = 'Chicago, Cook County, Illinois, United States'
    const { primary, secondary } = formatLocationName(raw)
    expect(primary).toBe('Chicago')
    expect(secondary).toBe('Cook County, United States')
  })

  it('resolves curated fallback locations accurately and instantly', async () => {
    const result = await geocodeLocation('chicago')
    expect(result).not.toBeNull()
    expect(result?.latitude).toBeCloseTo(41.8781, 1)
    expect(result?.longitude).toBeCloseTo(-87.6298, 1)
    expect(result?.city).toBe('Chicago')
  })

  it('searches and returns multiple location items with coordinate metadata', async () => {
    const results = await searchGeocodeLocations('New York', 3)
    expect(results.length).toBeGreaterThan(0)
    const first = results[0]
    expect(first.latitude).toBeCloseTo(40.7128, 1)
    expect(first.longitude).toBeCloseTo(-74.006, 1)
  })

  it('returns empty array for empty or single-character query', async () => {
    const results = await searchGeocodeLocations('a')
    expect(results).toEqual([])
  })

  it('API route GET /api/geocoding returns 400 for short queries', async () => {
    const req = new NextRequest('http://localhost:3000/api/geocoding?q=x')
    const res = await geocodingHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('API route GET /api/geocoding returns structured results for valid queries', async () => {
    const req = new NextRequest('http://localhost:3000/api/geocoding?q=Miami')
    const res = await geocodingHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results[0].latitude).toBeCloseTo(25.7617, 1)
  })
})
