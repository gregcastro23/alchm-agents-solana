/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDailyCouncilStore } from '@/hooks/useDailyPlanetaryCouncil'
import { buildDailySkyBrief } from '@/lib/agents/council/daily-sky'
import { createBriefingEdition } from '@/lib/agents/council/daily-episode'
import { COUNCIL_PLANETS } from '@/lib/agents/council/daily-council-types'

const edition = () =>
  createBriefingEdition(
    buildDailySkyBrief({
      date: new Date('2026-10-02T00:00:00Z'),
      source: 'vsop87-approximation',
      positions: Object.fromEntries(
        COUNCIL_PLANETS.map((planet, index) => [planet, { longitude: 15 + index * 33 }])
      ),
    })
  )
const response = (message: string) =>
  new Response(JSON.stringify({ edition: null, status: 'unavailable', message }))

afterEach(() => vi.useRealTimers())

describe('shared council read deadlines', () => {
  it('aborts a stalled shared read, exposes an error, and permits an independent retry', async () => {
    vi.useFakeTimers()
    let lateResponse!: (value: Response) => void
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            lateResponse = resolve
          })
      )
      .mockResolvedValueOnce(response('Retry succeeded'))
    const store = createDailyCouncilStore(fetcher)
    const original = store.load()
    expect(store.refresh()).toBe(original)
    await vi.advanceTimersByTimeAsync(20_000)
    await original
    const signal = fetcher.mock.calls[0][1]!.signal as AbortSignal
    expect(signal.aborted).toBe(true)
    expect(store.getSnapshot()).toMatchObject({
      loading: false,
      error: expect.stringContaining('too long'),
    })
    await store.refresh()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot()).toMatchObject({
      loading: false,
      error: null,
      message: 'Retry succeeded',
    })
    lateResponse(response('Expired response'))
    await Promise.resolve()
    await Promise.resolve()
    expect(store.getSnapshot().message).toBe('Retry succeeded')
  })

  it('bounds a stalled JSON body and preserves the existing edition', async () => {
    vi.useFakeTimers()
    const previous = edition()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ edition: previous, status: 'briefing' }))
      )
      .mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) } as Response)
    const store = createDailyCouncilStore(fetcher)
    await store.load()
    const pending = store.refresh()
    await vi.advanceTimersByTimeAsync(20_000)
    await pending
    expect(store.getSnapshot().edition?.id).toBe(previous.id)
    expect(store.getSnapshot().loading).toBe(false)
    expect(store.getSnapshot().error).toContain('too long')
    expect((fetcher.mock.calls[1][1]!.signal as AbortSignal).aborted).toBe(true)
  })
})
