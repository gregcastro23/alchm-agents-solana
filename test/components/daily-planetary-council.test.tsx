import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DailyPlanetaryCouncil } from '@/components/landing/daily-planetary-council'
import { LivePlanetaryCouncilThread } from '@/components/landing/live-planetary-council-thread'
import {
  createDailyCouncilStore,
  useDailyPlanetaryCouncil,
  type DailyCouncilState,
} from '@/hooks/useDailyPlanetaryCouncil'
import {
  COUNCIL_PLANETS,
  type CouncilSpeakerKey,
  type DailyCouncilEdition,
  type DailyCouncilTurn,
} from '@/lib/agents/council/daily-council-types'

vi.mock('@/hooks/useDailyPlanetaryCouncil', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/useDailyPlanetaryCouncil')>()),
  useDailyPlanetaryCouncil: vi.fn(),
}))

const coverage = [
  'lunar-state',
  'motion-state',
  'sky-overview',
  'outer-context',
  ...COUNCIL_PLANETS.map(planet => `placement-${planet.toLowerCase()}`),
]
const timestamp = '2026-10-02T00:00:00.000Z'

function turn(index: number, speakerKey: CouncilSpeakerKey = 'gregory'): DailyCouncilTurn {
  return {
    id: `turn-${index}`,
    speakerKey,
    speakerName: speakerKey === 'gregory' ? 'Gregory Castro' : speakerKey,
    text:
      index === 0
        ? 'Welcome. Here is what connects the sky today.'
        : `Reading ${index} offers a distinct practical perspective.`,
    newClaim: `A fresh claim for turn ${index}.`,
    speechAct: 'synthesize',
    usedEvidenceIds: ['overview'],
    coverageIds: index === 0 ? coverage : [],
    provenance: { source: index === 1 ? 'grounded_briefing' : 'model' },
  }
}

function edition(): DailyCouncilEdition {
  return {
    schemaVersion: 1,
    id: 'edition-oct-2',
    date: '2026-10-02',
    timeZone: 'UTC',
    title: 'Make room for the conversation',
    summary: 'The lunar mood meets a changing relationship between patience and action.',
    brief: {
      id: 'sky-oct-2',
      date: '2026-10-02',
      timeZone: 'UTC',
      startAt: timestamp,
      endAt: '2026-10-03T00:00:00.000Z',
      asOf: timestamp,
      source: 'swiss-ephemeris',
      quality: 'verified',
      positions: Object.fromEntries(
        COUNCIL_PLANETS.map((planet, index) => [
          planet,
          {
            sign: 'Aries',
            degree: index + 1,
            longitude: index + 1,
            speed: planet === 'Saturn' ? -1 : 1,
            retrograde: planet === 'Saturn',
            dignity: 'peregrine',
            element: 'Fire',
            modality: 'Cardinal',
            source: 'swiss-ephemeris',
            asOf: timestamp,
          },
        ])
      ) as DailyCouncilEdition['brief']['positions'],
      aspects: [
        {
          bodyA: 'mars',
          bodyB: 'saturn',
          aspectName: 'Square',
          angle: 90,
          orb: 1.2,
          phase: 'applying',
          quality: 'dynamic',
          major: true,
        },
      ],
      lunar: { phase: 'Waning Gibbous', sign: 'Aries', illumination: 0.68, elongation: 245 },
      events: [
        {
          id: 'ingress-1',
          type: 'sign_ingress',
          at: '2026-10-02T18:00:00.000Z',
          bodies: ['moon'],
          description: 'The Moon enters Taurus.',
          evidenceId: 'overview',
        },
      ],
      evidence: [
        {
          id: 'overview',
          kind: 'overview',
          label: 'The whole sky.',
          bodyKeys: [],
          coverageIds: coverage,
        },
      ],
      requiredCoverage: coverage,
      warnings: [],
    },
    turns: ['gregory', 'sun', 'moon', 'mercury', 'venus', 'mars', 'saturn', 'gregory'].map(
      (key, index) => turn(index, key as CouncilSpeakerKey)
    ),
    coveredTopics: coverage,
    generatedAt: timestamp,
    generation: 'mixed',
    promptVersion: 'test-v1',
  }
}

const refresh = vi.fn(async () => {})
const mockHook = vi.mocked(useDailyPlanetaryCouncil)
const ready = (): DailyCouncilState => ({
  edition: edition(),
  status: 'published',
  loading: false,
  error: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockHook.mockReturnValue({ ...ready(), refresh })
  global.fetch = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('daily planetary council views', () => {
  it('renders the complete shared transcript, provenance, UTC basis and all ten facts', () => {
    render(<DailyPlanetaryCouncil />)
    expect(screen.getAllByText('Gregory Castro')).toHaveLength(2)
    expect(screen.getByText('Oct 2, 2026 · UTC day')).toBeInTheDocument()
    expect(screen.getByText(/Sky observed Oct 2, 12:00 AM UTC/)).toBeInTheDocument()
    expect(screen.getByText(/Swiss Ephemeris · verified positions/)).toBeInTheDocument()
    const transcript = screen.getByRole('list', { name: "Today's planetary conversation" })
    expect(within(transcript).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByText('Sky briefing')).toBeInTheDocument()
    expect(screen.getByText(/all 10 placements · 14\/14 topics covered/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Explore today's sky/))
    for (const planet of COUNCIL_PLANETS)
      expect(screen.getAllByText(planet, { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByText(/68% illuminated/)).toBeInTheDocument()
    expect(screen.getByText(/The Moon enters Taurus/)).toBeInTheDocument()
    expect(screen.getByText(/1.2° orb · applying/)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('keeps compact preview on the same edition and refreshes only the shared read', () => {
    render(
      <>
        <DailyPlanetaryCouncil />
        <LivePlanetaryCouncilThread positions={[]} onOpenCouncil={vi.fn()} />
      </>
    )
    const preview = screen.getByRole('region', { name: 'Daily council preview' })
    expect(within(preview).getByText('Make room for the conversation')).toBeInTheDocument()
    fireEvent.click(within(preview).getByRole('button', { name: 'Read the opening' }))
    expect(
      within(preview).getByText('Welcome. Here is what connects the sky today.')
    ).toBeInTheDocument()
    fireEvent.click(within(preview).getByRole('button', { name: 'Refresh council preview' }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(within(preview).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows accessible loading, unavailable and read-error states', () => {
    mockHook.mockReturnValue({
      edition: null,
      status: 'unavailable',
      loading: true,
      error: null,
      refresh,
    })
    const { rerender } = render(<DailyPlanetaryCouncil />)
    expect(screen.getByRole('status')).toHaveTextContent('Reading the daily planetary conversation')
    mockHook.mockReturnValue({
      edition: null,
      status: 'unavailable',
      loading: false,
      error: null,
      message: 'No reliable sky is available.',
      refresh,
    })
    rerender(<DailyPlanetaryCouncil />)
    expect(screen.getByRole('status')).toHaveTextContent('No reliable sky is available.')
    mockHook.mockReturnValue({
      edition: null,
      status: 'unavailable',
      loading: false,
      error: 'Could not load the edition.',
      refresh,
    })
    rerender(<DailyPlanetaryCouncil />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the edition.')
  })

  it('identifies stale and approximate editions rather than presenting them as current verified data', () => {
    const state = ready()
    state.status = 'stale'
    state.edition!.brief.source = 'vsop87-approximation'
    state.edition!.brief.quality = 'approximate'
    mockHook.mockReturnValue({ ...state, refresh })
    render(<DailyPlanetaryCouncil />)
    expect(screen.getByText(/Previous edition · Hosted/)).toBeInTheDocument()
    expect(screen.getByText(/Approximate ephemeris · approximate positions/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      "Today's conversation is not yet available"
    )
  })

  it('only sends a question on explicit submit and preserves it after an auth rejection', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })
    )
    render(<DailyPlanetaryCouncil />)
    const input = screen.getByRole('textbox', { name: "Ask about today's sky" })
    fireEvent.change(input, { target: { value: 'How does Mars affect this pattern?' } })
    expect(global.fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ask the council' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign in to ask the council a follow-up'
    )
    expect(input).toHaveValue('How does Mars affect this pattern?')
    const [url, options] = vi.mocked(global.fetch).mock.calls[0]
    expect(url).toBe('/api/agents/council-daily/question')
    expect(JSON.parse(options!.body as string)).toEqual({
      editionId: 'edition-oct-2',
      question: 'How does Mars affect this pattern?',
      recentTurns: [],
    })
  })

  it('keeps private follow-up answers out of the published transcript and passes their context forward', async () => {
    const answer = { ...turn(10), text: 'Gregory connects your question to the same sky.' }
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({ turns: [answer] })))
    render(<DailyPlanetaryCouncil />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'What should I focus on?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask the council' }))
    expect(await screen.findByText(answer.text)).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: "Today's planetary conversation" })).queryByText(
        answer.text
      )
    ).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'What comes next?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask the council' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(
      JSON.parse(vi.mocked(global.fetch).mock.calls[1][1]!.body as string).recentTurns
    ).toEqual([answer])
  })

  it('aborts an old private question when the displayed edition changes', async () => {
    let finish!: (value: Response) => void
    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const { rerender } = render(<DailyPlanetaryCouncil />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Explain this sky.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask the council' }))
    const signal = vi.mocked(global.fetch).mock.calls[0][1]!.signal as AbortSignal
    const state = ready()
    state.edition!.id = 'next-edition'
    mockHook.mockReturnValue({ ...state, refresh })
    rerender(<DailyPlanetaryCouncil />)
    expect(signal.aborted).toBe(true)
    await act(async () => {
      finish(
        new Response(JSON.stringify({ turns: [{ ...turn(12), text: 'Stale private answer.' }] }))
      )
    })
    expect(screen.queryByText('Stale private answer.')).not.toBeInTheDocument()
  })
})

describe('shared read-only council store', () => {
  it('deduplicates concurrent full/compact reads and serves their cached edition', async () => {
    let finish!: (value: Response) => void
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const store = createDailyCouncilStore(fetcher)
    const first = store.load()
    const second = store.load()
    expect(first).toBe(second)
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledOnce()
    finish(new Response(JSON.stringify({ edition: edition(), status: 'published' })))
    await first
    await store.load()
    expect(fetcher).toHaveBeenCalledOnce()
    expect(store.getSnapshot().edition?.id).toBe('edition-oct-2')
    expect(fetcher).toHaveBeenCalledWith('/api/agents/council-daily', {
      method: 'GET',
      cache: 'no-store',
    })
  })

  it('rejects malformed editions and keeps a valid prior edition after a failed refresh', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ edition: edition(), status: 'published' }))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ edition: { id: 'broken' }, status: 'published' }))
      )
    const store = createDailyCouncilStore(fetcher)
    await store.load()
    await store.refresh()
    expect(store.getSnapshot().edition?.id).toBe('edition-oct-2')
    expect(store.getSnapshot().error).toContain('unreadable edition')
    expect(store.getSnapshot().loading).toBe(false)
  })

  it('shares a five-minute read timer and stops polling after the last view unmounts', async () => {
    vi.useFakeTimers()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ edition: edition(), status: 'published' }))
      )
    const store = createDailyCouncilStore(fetcher)
    const removeFull = store.subscribe(() => {})
    const removeCompact = store.subscribe(() => {})
    await store.load()
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(fetcher).toHaveBeenCalledTimes(2)
    removeFull()
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(fetcher).toHaveBeenCalledTimes(3)
    removeCompact()
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true)
  })
})
