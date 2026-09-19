// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST as quoteHandler } from '@/app/api/vessel/convert/quote/route'
import { POST as executeHandler } from '@/app/api/vessel/convert/execute/route'

describe('Vessel Convert Routes Feature Kill-Switch', () => {
  const originalEnv = process.env.FEATURE_PENTACLE_CONVERT

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.FEATURE_PENTACLE_CONVERT = originalEnv
    } else {
      delete process.env.FEATURE_PENTACLE_CONVERT
    }
  })

  it('quote route returns 503 pentacle_conversion_disabled when FEATURE_PENTACLE_CONVERT is not true', async () => {
    delete process.env.FEATURE_PENTACLE_CONVERT

    const req = new Request('http://localhost:3000/api/vessel/convert/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: 'pentacles_to_esms',
        element: 'spirit',
        amountAtoms: '10000',
      }),
    })

    const res = await quoteHandler(req)
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.code).toBe('pentacle_conversion_disabled')
  })

  it('execute route returns 503 pentacle_conversion_disabled when FEATURE_PENTACLE_CONVERT is not true', async () => {
    delete process.env.FEATURE_PENTACLE_CONVERT

    const req = new Request('http://localhost:3000/api/vessel/convert/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteToken: 'some-token' }),
    })

    const res = await executeHandler(req)
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.code).toBe('pentacle_conversion_disabled')
  })
})
