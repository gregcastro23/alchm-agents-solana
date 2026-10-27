import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadAlchmSyncConfig, __resetAlchmSyncConfig } from '@/lib/alchmSyncConfig'

describe('loadAlchmSyncConfig defaults and fallbacks', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    __resetAlchmSyncConfig()
    delete process.env.ALCHM_KITCHEN_SYNC_URL
    delete process.env.ALCHM_KITCHEN_API_BASE_URL
    delete process.env.NEXT_PUBLIC_ALCHM_KITCHEN_URL
    delete process.env.ALCHM_KITCHEN_SYNC_SECRET
    delete process.env.INTERNAL_API_SECRET
    delete process.env.WHATTOEATNEXT_API_KEY
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    __resetAlchmSyncConfig()
  })

  it('defaults baseUrl to https://alchm.kitchen when no URL env vars are present', () => {
    process.env.ALCHM_KITCHEN_SYNC_SECRET = 'secret-123'
    const config = loadAlchmSyncConfig()
    expect(config.baseUrl).toBe('https://alchm.kitchen')
    expect(config.secret).toBe('secret-123')
  })

  it('falls back secret to INTERNAL_API_SECRET if ALCHM_KITCHEN_SYNC_SECRET is unset', () => {
    process.env.INTERNAL_API_SECRET = 'internal-secret-456'
    const config = loadAlchmSyncConfig()
    expect(config.baseUrl).toBe('https://alchm.kitchen')
    expect(config.secret).toBe('internal-secret-456')
  })

  it('falls back secret to WHATTOEATNEXT_API_KEY if others are unset', () => {
    process.env.WHATTOEATNEXT_API_KEY = 'wten-api-key-789'
    const config = loadAlchmSyncConfig()
    expect(config.baseUrl).toBe('https://alchm.kitchen')
    expect(config.secret).toBe('wten-api-key-789')
  })

  it('throws an error if no secret is configured anywhere', () => {
    expect(() => loadAlchmSyncConfig()).toThrow(
      'ALCHM_KITCHEN_SYNC_SECRET (or INTERNAL_API_SECRET / WHATTOEATNEXT_API_KEY) is required.'
    )
  })
})
