/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest'
import { createDailyCouncilService } from '@/lib/agents/council/daily-council-service'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { createBriefingEdition } from '@/lib/agents/council/daily-episode'
import { DailyCouncilEditionSchema } from '@/lib/agents/council/daily-edition-schema'
import {
  COUNCIL_PLANETS,
  type DailyCouncilEdition,
  type DailySkyBrief,
} from '@/lib/agents/council/daily-council-types'
import type { DailyEditionStore } from '@/lib/agents/council/daily-edition-store'

vi.mock('@/lib/db', () => ({ prisma: {} }))
const now = new Date('2026-10-02T12:00:00.000Z')
function fixture(date = now) {
  return buildDailySkyBrief({
    date,
    source: 'vsop87-approximation',
    positions: Object.fromEntries(
      COUNCIL_PLANETS.map((body, index) => [
        body,
        { longitude: (15 + index * 33) % 360, speed: index > 6 ? -0.1 : 1 },
      ])
    ),
  })
}
function setup() {
  let saved: DailyCouncilEdition | null = null
  let leased = false
  const store: DailyEditionStore = {
    read: vi.fn(async () => saved),
    latest: vi.fn(async () => saved),
    find: vi.fn(async () => saved),
    claim: vi.fn(async () => {
      if (leased || saved) return null
      leased = true
      return 'lease'
    }),
    publish: vi.fn(async (_day, _token, edition) => {
      saved = edition
      return true
    }),
    release: vi.fn(async () => {
      leased = false
    }),
  }
  const loadBrief = vi.fn(async () => fixture())
  const generate = vi.fn(async (sky: DailySkyBrief): Promise<DailyCouncilEdition> => {
    const edition = createBriefingEdition(sky)
    return {
      ...edition,
      generation: 'model' as const,
      turns: edition.turns.map(turn => ({ ...turn, provenance: { source: 'model' as const } })),
    }
  })
  const service = createDailyCouncilService({
    store,
    loadBrief,
    generate,
    brief: createBriefingEdition,
    now: () => now,
  })
  return { service, store, loadBrief, generate }
}

describe('daily council service', () => {
  it('shares the public briefing across readers without models or writes, even without a database', async () => {
    const { service, store, loadBrief, generate } = setup()
    vi.mocked(store.read).mockRejectedValue(new Error('database unavailable'))
    const results = await Promise.all([service.read(), service.read(), service.read()])
    expect(results.every(result => result.status === 'briefing')).toBe(true)
    expect(new Set(results.map(result => result.edition?.id)).size).toBe(1)
    expect(loadBrief).toHaveBeenCalledTimes(1)
    expect(loadBrief).toHaveBeenCalledWith(now, { includeEvents: false })
    expect(generate).not.toHaveBeenCalled()
    expect(store.claim).not.toHaveBeenCalled()
    expect(store.publish).not.toHaveBeenCalled()
    expect(DailyCouncilEditionSchema.safeParse(results[0].edition).success).toBe(true)
  })

  it('allows only the lease owner to generate and publishes once across overlapping cron requests', async () => {
    const { service, store, generate, loadBrief } = setup()
    const results = await Promise.all([service.publish(), service.publish()])
    expect(results.map(result => result.status).sort()).toEqual(['not_claimed', 'published'])
    expect(generate).toHaveBeenCalledTimes(1)
    expect(store.publish).toHaveBeenCalledTimes(1)
    expect(loadBrief).toHaveBeenCalledWith(now, { includeEvents: true, deadlineMs: undefined })
    expect((await service.publish()).status).toBe('already_published')
    expect(generate).toHaveBeenCalledTimes(1)
    expect((await service.read()).status).toBe('published')
  })

  it('fails closed before spending model credits if persistence cannot acquire a lease', async () => {
    const { service, store, generate } = setup()
    vi.mocked(store.claim).mockRejectedValue(new Error('database unavailable'))
    await expect(service.publish()).rejects.toThrow('database unavailable')
    expect(generate).not.toHaveBeenCalled()
  })

  it('still serves a no-cost sky briefing when database reads never settle', async () => {
    vi.useFakeTimers()
    try {
      const { service, store, loadBrief, generate } = setup()
      vi.mocked(store.read).mockImplementation(() => new Promise(() => {}))
      vi.mocked(store.latest).mockImplementation(() => new Promise(() => {}))
      const pending = service.read()
      await vi.advanceTimersByTimeAsync(2_000)
      const result = await pending
      expect(result.status).toBe('briefing')
      expect(loadBrief).toHaveBeenCalledOnce()
      expect(generate).not.toHaveBeenCalled()
      expect(store.latest).not.toHaveBeenCalled()
      expect(store.claim).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects incomplete generated coverage and releases its lease for a bounded retry', async () => {
    const { service, store, generate } = setup()
    generate.mockImplementation(async sky => ({
      ...createBriefingEdition(sky),
      generation: 'model' as const,
      turns: [],
    }))
    await expect(service.publish()).rejects.toThrow('coverage validation')
    expect(store.publish).not.toHaveBeenCalled()
    expect(store.release).toHaveBeenCalledWith('2026-10-02', 'lease')
  })

  it('returns a dated stale edition or explicit unavailable state when complete sky data is absent', async () => {
    const { service, store, loadBrief } = setup()
    loadBrief.mockRejectedValue(new Error('missing Pluto'))
    const old = createBriefingEdition(fixture(new Date('2026-10-01T00:00:00Z')))
    vi.mocked(store.latest).mockResolvedValue(old)
    const stale = await service.read()
    expect(stale.status).toBe('stale')
    expect(stale.edition?.date).toBe('2026-10-01')
    vi.mocked(store.latest).mockResolvedValue(null)
    expect(await service.read()).toMatchObject({ status: 'unavailable', edition: null })
  })

  it('never silently substitutes a different snapshot for a question', async () => {
    const { service } = setup()
    const result = await service.read()
    expect(await service.find(result.edition!.id)).toEqual(result.edition)
    expect(await service.find('different-source-edition')).toBeNull()
  })

  it('preserves the previous hosted edition alongside current facts during an outage', async () => {
    const { service, store } = setup()
    const previous = {
      ...createBriefingEdition(fixture(new Date('2026-10-01T00:00:00Z'))),
      generation: 'model' as const,
    }
    vi.mocked(store.latest).mockResolvedValue(previous)
    const response = await service.read()
    expect(response.status).toBe('briefing')
    expect(response.edition?.date).toBe('2026-10-02')
    expect(response.previousEdition?.date).toBe('2026-10-01')
  })

  it('leaves an all-fallback generation eligible for a bounded later retry', async () => {
    const { service, store, generate } = setup()
    generate.mockImplementation(async sky => createBriefingEdition(sky))
    expect((await service.publish()).status).toBe('briefing_only')
    expect(store.publish).not.toHaveBeenCalled()
    expect(store.release).toHaveBeenCalledWith('2026-10-02', 'lease')
  })

  it('adds elapsed event updates to a published read without generating or modifying the edition', async () => {
    const { service, store, generate } = setup()
    const events = [11, 13].map(hour => ({
      id: `event-${hour}`,
      evidenceId: `evidence-${hour}`,
      type: 'sign_ingress' as const,
      bodies: ['moon' as const],
      at: `2026-10-02T${hour}:00:00.000Z`,
      description: 'A fixture ingress',
    }))
    const edition = createBriefingEdition(
      buildDailySkyBrief({
        date: now,
        positions: Object.fromEntries(
          COUNCIL_PLANETS.map((body, index) => [body, { longitude: index * 33, speed: 1 }])
        ),
        source: 'swiss-ephemeris',
        events,
        eventScanComplete: true,
      })
    )
    vi.mocked(store.read).mockResolvedValue(edition)
    const original = structuredClone(edition)
    const response = await service.read()
    expect(response.updates).toEqual({ asOf: now.toISOString(), events: [events[0]] })
    expect(response.edition).toEqual(original)
    expect(generate).not.toHaveBeenCalled()
    expect(store.publish).not.toHaveBeenCalled()
  })
})
