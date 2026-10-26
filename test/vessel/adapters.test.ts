import { describe, expect, it } from 'vitest'
import { ALL_VESSEL_STAT_KEYS, type VesselStats } from '../../lib/vessel/progression'
import { createExperienceLedger, applyExperienceEvent } from '../../lib/vessel/experience'
import {
  placementToLongitude,
  resolve19Stats,
  resolveNatalLongitudes,
} from '../../lib/vessel/stat-resolver'
import { clearSkySnapshotCache, getCurrentSkySnapshot } from '../../lib/vessel/sky-provider'
import { computeAgentProgression } from '../../lib/agents/leveling-service'

const stats = Object.fromEntries(ALL_VESSEL_STAT_KEYS.map(key => [key, 60])) as VesselStats
const subject = { kind: 'agent' as const, id: 'test-agent' }
const ledger = applyExperienceEvent(createExperienceLedger(subject), {
  subject,
  origin: 'agents.alchm.kitchen',
  eventId: 'training:1',
  occurredAt: '2026-10-20T00:00:00.000Z',
  policyVersion: 1,
  kind: 'training.imported',
  manifest: {
    provenance: 'manifest:1',
    sha256: 'a'.repeat(64),
    conversationCount: 100,
    verification: 'verified',
    coverage: 'disjoint-from-live-and-other-imports',
  },
})

describe('Vessel source adapters', () => {
  it('preserves all 19 recorded stats, including fractional values', () => {
    expect(resolve19Stats({ sacredStats: { ...stats, wisdom: 60.123 } })).toEqual({
      ...stats,
      wisdom: 60.123,
    })
    expect(() => resolve19Stats()).toThrow('required')
    expect(() => resolve19Stats({ sacredStats: { power: 90 } })).toThrow('required')
  })
  it('refuses invented middle-of-sign degrees and inconsistent placements', () => {
    expect(placementToLongitude({ sign: 'Aries' })).toBeNull()
    expect(placementToLongitude({ sign: 'Pisces', degree: 30 })).toBeNull()
    expect(placementToLongitude({ sign: 'Aries', degree: 0, longitude: 20 })).toBeNull()
    expect(placementToLongitude({ sign: 'pisces', degree: 29.5 })).toBe(359.5)
    expect(placementToLongitude({ longitude: -0.5 })).toBe(359.5)
    expect(() => resolveNatalLongitudes({ Sun: { longitude: 0 }, sun: { longitude: 20 } })).toThrow(
      'Duplicate'
    )
  })
  it('preserves actual cache observation time and protects cached positions from mutation', () => {
    clearSkySnapshotCache()
    const now = Date.parse('2026-10-20T12:00:00Z')
    const first = getCurrentSkySnapshot(now)
    const longitude = first.positions.Sun.longitude
    first.positions.Sun.longitude = -999
    const second = getCurrentSkySnapshot(now + 10_000)
    expect(second.asOf).toBe(new Date(now).toISOString())
    expect(second.positions.Sun.longitude).toBe(longitude)
    expect(second.source).toBe('vsop87-approximation')
    expect(getCurrentSkySnapshot(now - 60_000).asOf).toBe(new Date(now - 60_000).toISOString())
  })
  it('never promotes missing experience to seeded starting levels', () => {
    const result = computeAgentProgression({ id: subject.id, sacredStats: stats })
    expect(result.totalXp).toBeNull()
    expect(result.vesselLevel).toBeNull()
    expect(result.currentOverall).toBeNull()
    expect(result.progressionStatus).toBe('unavailable')
  })
  it('credits seeded conversation counts as training experience when explicit ledger is omitted', () => {
    const result = computeAgentProgression({
      id: subject.id,
      sacredStats: stats,
      stats: { conversations: 40 },
    })
    expect(result.totalXp).toBe(1000)
    expect(result.vesselLevel).toBe(4)
    expect(result.trainingEvidence?.importedConversations).toBe(40)
  })
  it('keeps earned growth even when every rating input is missing', () => {
    const result = computeAgentProgression(
      { id: subject.id },
      { experience: ledger, customSky: null }
    )
    expect(result.totalXp).toBe(2500)
    expect(result.vesselLevel).toBe(6)
    expect(result.currentOverall).toBeNull()
    expect(result.trainingEvidence?.importedConversations).toBe(100)
  })
  it('does not upgrade placeholder provenance or fill unknown DNA', () => {
    const result = computeAgentProgression(
      {
        id: subject.id,
        sacredStats: stats,
        consciousness: {
          natalChart: { provenance: 'placeholder', planets: { Sun: { longitude: 0 } } },
        },
      },
      { experience: ledger, customSky: null }
    )
    expect(result.trainedOverall).toBeGreaterThan(result.baseOverall!)
    expect(result.currentOverall).toBeNull()
    expect(result.reasons.join(' ')).toContain('placeholder')
    expect(() => computeAgentProgression({ id: 'other' }, { experience: ledger })).toThrow(
      'another subject'
    )
  })

  it('keeps the trained baseline when natal placements are malformed', () => {
    const result = computeAgentProgression(
      {
        id: subject.id,
        sacredStats: stats,
        consciousness: {
          natalChart: { provenance: 'computed', planets: { Sun: { sign: 'Aries' } } },
        },
      },
      { experience: ledger, customSky: null }
    )
    expect(result.trainedOverall).toBeGreaterThan(result.baseOverall!)
    expect(result.totalXp).toBe(2500)
    expect(result.currentOverall).toBeNull()
    expect(result.reasons.join(' ')).toContain('Sun')
  })
})
