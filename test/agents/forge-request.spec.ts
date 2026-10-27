import { describe, expect, it } from 'vitest'
import { ForgeRequestSchema, forgeRequestHash } from '@/lib/agents/forge-request'

const input = {
  clientRequestId: 'e4e576f3-d554-4f0f-92f7-44c98c63e6a5',
  name: 'Ada',
  purpose: 'Explore',
  birthInfo: {
    year: 1990,
    month: 2,
    day: 15,
    hour: 10,
    minute: 24,
    latitude: 40.7128,
    longitude: -74.006,
  },
  personalContext: { aboutYourself: 'Curious', values: 'Evidence' },
  stats: {
    power: 50,
    resonance: 50,
    wisdom: 50,
    charisma: 50,
    intuition: 50,
    adaptability: 50,
    vitality: 50,
  },
}

function hash(value: unknown) {
  return forgeRequestHash(ForgeRequestSchema.parse(value))
}

function reversed(value: object) {
  return Object.fromEntries(Object.entries(value).reverse())
}

describe('forge consumed request fingerprint', () => {
  it('normalizes root and nested field order through the request contract', () => {
    const reordered = reversed({
      ...input,
      birthInfo: reversed(input.birthInfo),
      personalContext: reversed(input.personalContext),
      stats: reversed(input.stats),
    })

    expect(hash(reordered)).toBe(hash(input))
  })

  it('does not include the retry key or unrecognized fields in the input hash', () => {
    expect(hash({ ...input, clientRequestId: '32c7bbfd-d347-4e2c-8553-a78b86abe1c4' })).toBe(
      hash(input)
    )
    expect(hash({ ...input, ignored: { anything: 'not consumed' } })).toBe(hash(input))
    expect(hash({ ...input, birthInfo: { ...input.birthInfo, ignored: true } })).toBe(hash(input))
  })

  it.each([
    { ...input, name: 'Grace' },
    { ...input, purpose: 'Teach' },
    { ...input, birthInfo: { ...input.birthInfo, latitude: 30 } },
    { ...input, personalContext: { ...input.personalContext, values: 'Care' } },
    { ...input, stats: { ...input.stats, wisdom: 75 } },
  ])('changes when a consumed field changes %#', changed => {
    expect(hash(changed)).not.toBe(hash(input))
  })

  it('refuses malformed inputs instead of producing a usable replay fingerprint', () => {
    expect(() => hash({ ...input, name: null })).toThrow()
    expect(() => hash({ ...input, birthInfo: { ...input.birthInfo, day: 30 } })).toThrow()
  })
})
