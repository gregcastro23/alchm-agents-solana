// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import * as leveling from '@/lib/admin/leveling'
import {
  buildLevelingReport,
  readLegacyLeveling,
  type LevelingCatalogAgent,
  type LevelingReportSources,
} from '@/lib/admin/leveling'
import { LevelingReportSchema, type LegacyLeveling } from '@/lib/admin/leveling-schema'
import { computeAgentProgression } from '@/lib/agents/leveling-service'
import { prisma } from '@/lib/db'
import { ALL_VESSEL_STAT_KEYS, type VesselStats } from '@/lib/vessel/progression'
import type { CurrentSkySnapshot } from '@/lib/vessel/sky-provider'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({
  prisma: {
    historical_agents: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
  },
}))
vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(),
  adminErrorResponse: (result: { status: number; error: string }) =>
    Response.json({ error: result.error }, { status: result.status }),
}))

const NOW = new Date('2026-10-20T12:00:00.000Z')
const PLANETS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
  'Chiron',
]
const positions = Object.fromEntries(PLANETS.map(planet => [planet, { longitude: 0 }]))
const sky: CurrentSkySnapshot = {
  asOf: NOW.toISOString(),
  source: 'swiss-ephemeris',
  positions,
}
const stats = Object.fromEntries(ALL_VESSEL_STAT_KEYS.map(key => [key, 60])) as VesselStats
function agent(id: string, conversations?: number): LevelingCatalogAgent {
  return {
    id,
    name: id,
    sacredStats: stats,
    ...(conversations === undefined ? {} : { stats: { conversations } }),
    consciousness: { natalChart: { provenance: 'computed', planets: positions } },
  }
}
const legacy: LegacyLeveling = {
  totals: {
    agents: 8,
    avgLevel: 100,
    maxedLevel100: 8,
    totalEvsTrained: 42,
    evTotalCap: 510,
    agentsWithEvs: 1,
  },
  inTraining: [],
}
function sources(catalog = [agent('recorded', 400), agent('pending')]): LevelingReportSources {
  return {
    readCatalog: vi.fn(async () => catalog),
    readLegacy: vi.fn(async () => legacy),
    getSky: vi.fn(() => sky),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('admin Vessel progression projection', () => {
  it('uses one sky and clock, includes max-level and unknown agents, and never substitutes legacy levels', async () => {
    const catalog = [
      agent('pending'),
      agent('zero', 0),
      agent('maxed', 40_000),
      agent('normal', 400),
    ]
    const source = sources(catalog)
    source.computeProgression = vi.fn(computeAgentProgression)
    const report = await buildLevelingReport(source, NOW)
    expect(source.getSky).toHaveBeenCalledExactlyOnceWith(NOW.getTime())
    expect(source.computeProgression).toHaveBeenCalledTimes(4)
    for (const call of vi.mocked(source.computeProgression).mock.calls) {
      expect(call[1]).toEqual({ now: NOW.getTime(), customSky: sky })
      expect(call[1].customSky).toBe(sky)
    }
    expect(report.progression.ok).toBe(true)
    if (!report.progression.ok) throw new Error(report.progression.reason)
    const value = report.progression.value
    expect(value.totals).toEqual({
      agents: 4,
      withExperience: 3,
      pendingExperience: 1,
      totalXp: 1_010_000,
      avgVesselLevel: 37.3,
      maxLevel: 100,
      live: 3,
      estimated: 0,
      unavailable: 1,
    })
    expect(value.agents.map(a => a.agentId)).toEqual(['maxed', 'normal', 'zero', 'pending'])
    expect(value.agents[0]).toMatchObject({
      vesselLevel: 100,
      totalXp: 1_000_000,
      xpToNextLevel: null,
    })
    expect(value.agents[2]).toMatchObject({ vesselLevel: 1, totalXp: 0 })
    expect(value.agents[3]).toMatchObject({
      vesselLevel: null,
      totalXp: null,
      currentOverall: null,
    })
    expect(value.distribution.reduce((sum, band) => sum + band.count, 0)).toBe(4)
    expect(value.distribution.find(b => b.band === 'Experience pending')?.count).toBe(1)
    expect(report.alerts).toEqual([])
    expect(LevelingReportSchema.parse(report)).toEqual(report)
  })

  it('keeps catalog experience and baseline visible during both database and sky outages', async () => {
    const source = sources()
    source.readLegacy = async () => {
      throw new Error('database unavailable')
    }
    source.getSky = vi.fn(() => {
      throw new Error('ephemeris unavailable')
    })
    const report = await buildLevelingReport(source, NOW)
    expect(report.legacy).toEqual({ ok: false, reason: 'database unavailable' })
    expect(report.alerts).toEqual([
      expect.objectContaining({
        id: 'agents:leveling:sky:unreadable',
        title: 'Current sky could not be read',
        detail: expect.stringContaining('ephemeris unavailable'),
      }),
      expect.objectContaining({
        source: 'agents',
        severity: 'warning',
        title: 'Legacy cosmic EV training could not be read',
        detail: 'database unavailable',
        href: '/admin/leveling',
      }),
    ])
    expect(report.progression.ok).toBe(true)
    if (!report.progression.ok) throw new Error(report.progression.reason)
    expect(report.progression.value.agents[0]).toMatchObject({
      totalXp: 10_000,
      vesselLevel: 11,
      progressionStatus: 'unavailable',
      currentOverall: null,
    })
    expect(report.progression.value.agents[0].trainedOverall).toBeGreaterThan(25)
    expect(report.progression.value.totals).toMatchObject({ withExperience: 1, unavailable: 2 })
    expect(LevelingReportSchema.safeParse(report).success).toBe(true)
  })

  it('alerts on a sky outage even when catalog and legacy sources are readable', async () => {
    const source = sources()
    source.getSky = () => {
      throw new Error('Sky source disconnected')
    }
    const report = await buildLevelingReport(source, NOW)
    expect(report.progression.ok).toBe(true)
    expect(report.legacy.ok).toBe(true)
    expect(report.alerts).toEqual([
      expect.objectContaining({
        id: 'agents:leveling:sky:unreadable',
        detail: expect.stringContaining('Sky source disconnected'),
        href: '/admin/leveling',
      }),
    ])
  })

  it('isolates per-agent calculation failures and preserves an independently readable legacy section', async () => {
    const source = sources([agent('broken', 30), agent('normal', 400)])
    source.computeProgression = (subject, options) => {
      if (subject.id === 'broken') throw new Error('Recorded experience is invalid.')
      return computeAgentProgression(subject, options)
    }
    const report = await buildLevelingReport(source, NOW)
    expect(report.legacy).toEqual({ ok: true, value: legacy })
    if (!report.progression.ok) throw new Error(report.progression.reason)
    expect(report.progression.value.agents.find(a => a.agentId === 'broken')).toMatchObject({
      progressionStatus: 'unavailable',
      totalXp: null,
      reasons: ['Recorded experience is invalid.'],
    })
    expect(report.progression.value.agents.find(a => a.agentId === 'normal')?.totalXp).toBe(10_000)
    source.readCatalog = async () => {
      throw new Error('catalog unavailable')
    }
    const failed = await buildLevelingReport(source, NOW)
    expect(failed.progression).toEqual({ ok: false, reason: 'catalog unavailable' })
    expect(failed.legacy.ok).toBe(true)
    expect(failed.alerts).toEqual([
      expect.objectContaining({
        title: 'Vessel progression could not be read',
        detail: 'catalog unavailable',
        severity: 'warning',
      }),
    ])
  })

  it('reports approximate sky honestly and leaves the empty known-level average null', async () => {
    const source = sources([agent('approximate', 40)])
    source.getSky = () => ({ ...sky, source: 'vsop87-approximation' })
    const report = await buildLevelingReport(source, NOW)
    if (!report.progression.ok) throw new Error(report.progression.reason)
    expect(report.progression.value.totals).toMatchObject({ estimated: 1, live: 0 })
    const empty = await buildLevelingReport(sources([agent('pending')]), NOW)
    if (!empty.progression.ok) throw new Error(empty.progression.reason)
    expect(empty.progression.value.totals).toMatchObject({
      avgVesselLevel: null,
      maxLevel: 0,
      pendingExperience: 1,
    })
  })

  it('validates nested profile evidence, all 19 stats, deltas and report section payloads', async () => {
    const report = await buildLevelingReport(sources(), NOW)
    if (!report.progression.ok) throw new Error(report.progression.reason)
    const profile = report.progression.value.agents[0]
    const invalidProfiles = [
      { ...profile, stats: { ...profile.stats, kineticAlignment: '60' } },
      { ...profile, statDeltas: { ...profile.statDeltas, power: Infinity } },
      { ...profile, expBreakdown: { ...profile.expBreakdown, training: -1 } },
      { ...profile, trainingEvidence: { status: 'unproven', importedConversations: 400 } },
      { ...profile, reasons: [42] },
    ]
    for (const invalid of invalidProfiles) {
      expect(
        LevelingReportSchema.safeParse({
          ...report,
          progression: { ok: true, value: { ...report.progression.value, agents: [invalid] } },
        }).success
      ).toBe(false)
    }
    expect(
      LevelingReportSchema.safeParse({ ...report, legacy: { ok: true, value: {} } }).success
    ).toBe(false)
    expect(LevelingReportSchema.safeParse({ ...report, alerts: undefined }).success).toBe(false)
  })
})

describe('legacy cosmic EV telemetry', () => {
  it('counts every agent with EVs separately from the limited training preview', async () => {
    const h = vi.mocked(prisma.historical_agents)
    h.count.mockResolvedValueOnce(40).mockResolvedValueOnce(5).mockResolvedValueOnce(23)
    h.aggregate.mockResolvedValue({ _avg: { level: 42.25 }, _sum: { evTotal: 3_456 } } as never)
    h.findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        agentId: `agent-${i}`,
        name: `Agent ${i}`,
        level: 20,
        evTotal: 50,
        lastTrainingPartner: null,
      })) as never
    )
    const value = await readLegacyLeveling()
    expect(value.totals.agentsWithEvs).toBe(23)
    expect(value.inTraining).toHaveLength(12)
    expect(h.count).toHaveBeenCalledWith({ where: { evTotal: { gt: 0 } } })
    expect(h.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 12 }))
    expect(value.totals).toMatchObject({ totalEvsTrained: 3_456, avgLevel: 42.3 })
  })
})

describe('leveling summary route', () => {
  it.each([401, 403] as const)(
    'guards %s before the catalog, sky or database report is read',
    async status => {
      const load = vi.spyOn(leveling, 'loadLevelingReport')
      vi.mocked(requireAdmin).mockResolvedValue({
        ok: false,
        status,
        error: status === 401 ? 'Authentication required' : 'Admin privileges required',
      })
      const { GET } = await import('@/app/api/admin/leveling-summary/route')
      const response = await GET(new NextRequest('http://localhost/api/admin/leveling-summary'))
      expect(response.status).toBe(status)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(load).not.toHaveBeenCalled()
      expect(prisma.historical_agents.count).not.toHaveBeenCalled()
    }
  )

  it('returns the independently degraded report with no-store and a node runtime', async () => {
    const report = await buildLevelingReport(sources(), NOW)
    vi.spyOn(leveling, 'loadLevelingReport').mockResolvedValue(report)
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: true,
      user: { id: 'admin' },
      source: 'db-role',
    })
    const { GET, runtime, dynamic } = await import('@/app/api/admin/leveling-summary/route')
    const response = await GET(new NextRequest('http://localhost/api/admin/leveling-summary'))
    expect(runtime).toBe('nodejs')
    expect(dynamic).toBe('force-dynamic')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(LevelingReportSchema.parse(await response.json())).toEqual(report)
  })
})
