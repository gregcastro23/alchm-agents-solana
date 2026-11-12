import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/monica-test',
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt || ''} />
  ),
}))

vi.mock('@/lib/spacetime/hooks/useLiveOracleChat', () => ({
  useLiveOracleChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    isThinking: false,
    error: null,
    status: 'disconnected',
  }),
}))

import MonicaChatInterface from '@/components/misc/monica-chat-interface'
import { MonicaChatBubble } from '@/components/monica/monica-chat-bubble'
import { MonicaOmnipresent } from '@/components/monica/monica-omnipresent'

function createSseStream(events: Array<Record<string, any>>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const evt of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
      }
      controller.close()
    },
  })
}

describe('Monica UI Multi-Turn SessionId & History Propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('MonicaChatBubble maintains one sessionId and sends prior history across turns', async () => {
    const monicaCalls: Array<Record<string, any>> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/monica-agent') {
        const parsed = JSON.parse(String(init?.body || '{}'))
        monicaCalls.push(parsed)
        const turn = monicaCalls.length
        return {
          ok: true,
          status: 200,
          json: async () => ({
            text:
              turn === 1
                ? 'Were you born during dawn, morning, afternoon, or night?'
                : 'Virgo rising is at 87.6% around 09:15. Would you like me to save it?',
            sessionId: parsed.sessionId,
          }),
        } as any
      }
      return { ok: true, status: 200, json: async () => ({}) } as any
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<MonicaChatBubble pathname="/monica-test" />)

    fireEvent.click(screen.getByLabelText('Open Monica chat'))

    const input = await screen.findByPlaceholderText('Ask Monica anything...')
    fireEvent.change(input, {
      target: { value: 'Help me find my rising sign — born July 14, 1990 in Chicago, IL' },
    })
    fireEvent.click(screen.getByLabelText('Send message'))

    await screen.findByText(/Were you born during dawn, morning, afternoon, or night\?/i)

    fireEvent.change(input, {
      target: { value: 'Morning around 9:15 AM, and I married June 18, 2016.' },
    })
    fireEvent.click(screen.getByLabelText('Send message'))

    await screen.findByText(/Virgo rising is at 87\.6%/i)

    expect(monicaCalls).toHaveLength(2)
    expect(typeof monicaCalls[0].sessionId).toBe('string')
    expect(monicaCalls[0].sessionId.length).toBeGreaterThan(5)
    expect(monicaCalls[0].history).toEqual([])
    expect(monicaCalls[1].sessionId).toBe(monicaCalls[0].sessionId)
    expect(monicaCalls[1].history).toEqual([
      {
        role: 'user',
        content: 'Help me find my rising sign — born July 14, 1990 in Chicago, IL',
      },
      {
        role: 'assistant',
        content: 'Were you born during dawn, morning, afternoon, or night?',
      },
    ])
  })

  it('MonicaOmnipresent maintains one sessionId and forwards prior turns across messages', async () => {
    const monicaCalls: Array<Record<string, any>> = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/monica-agent') {
        const parsed = JSON.parse(String(init?.body || '{}'))
        monicaCalls.push(parsed)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            text:
              monicaCalls.length === 1
                ? 'Let us check your rising window. Were you born in the morning or evening?'
                : 'Saved your Virgo rising!',
            sessionId: parsed.sessionId,
          }),
        } as any
      }
      return { ok: true, status: 200, json: async () => ({}) } as any
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<MonicaOmnipresent />)

    // Expand widget from minimized -> expanded -> full-chat
    fireEvent.click(screen.getByAltText('Monica - Your Consciousness Guide'))
    const openFullChatBtn = await screen.findByRole('button', { name: /Open Full Chat/i })
    fireEvent.click(openFullChatBtn)

    const input = await screen.findByPlaceholderText(
      'Ask Monica anything about consciousness, astrology, or this page...'
    )
    fireEvent.change(input, { target: { value: "What's my rising sign?" } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await screen.findByText(/Were you born in the morning or evening\?/i)

    fireEvent.change(input, { target: { value: 'Morning, please save it!' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await screen.findByText(/Saved your Virgo rising!/i)

    expect(monicaCalls).toHaveLength(2)
    expect(typeof monicaCalls[0].sessionId).toBe('string')
    expect(monicaCalls[0].history).toEqual([])
    expect(monicaCalls[1].sessionId).toBe(monicaCalls[0].sessionId)
    expect(monicaCalls[1].history).toEqual([
      { role: 'user', content: "What's my rising sign?" },
      {
        role: 'assistant',
        content: 'Let us check your rising window. Were you born in the morning or evening?',
      },
    ])
  })

  it('MonicaChatInterface propagates sessionId and history in both stream and non-stream paths and reads data.text', async () => {
    const streamCalls: Array<Record<string, any>> = []
    const restCalls: Array<Record<string, any>> = []

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body || '{}'))
      if (url === '/api/monica-agent/stream') {
        streamCalls.push(parsed)
        return {
          ok: true,
          status: 200,
          body: createSseStream([
            { type: 'token', token: 'Streamed: ' },
            { type: 'token', token: 'What time of day were you born?' },
            {
              type: 'envelope',
              payload: { suggestedPractices: [], nextStep: 'Answer', followUps: [] },
            },
            { type: 'done' },
          ]),
        } as any
      }
      if (url === '/api/monica-agent') {
        restCalls.push(parsed)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            text: 'REST text reply: Virgo rising at 88% around 09:15.',
            sessionId: parsed.sessionId,
            metadata: {
              envelope: {
                suggestedPractices: ['Review natal houses'],
                nextStep: 'Confirm save',
                followUps: ['Save this as my rising sign?'],
              },
            },
          }),
        } as any
      }
      return { ok: true, status: 200, json: async () => ({}) } as any
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<MonicaChatInterface />)

    const input = screen.getByPlaceholderText(
      'Ask Monica about astrology, tarot, character vectors, A-Numbers, or anything cosmic...'
    )

    // Turn 1 via Send button -> streaming route (/api/monica-agent/stream)
    fireEvent.change(input, {
      target: { value: 'Help me find my rising sign — born July 14, 1990 in Chicago' },
    })
    fireEvent.click(screen.getByLabelText('Send message'))

    await screen.findByText('Streamed: What time of day were you born?')

    // Turn 2 via Enter key -> REST route (/api/monica-agent) verifying `data.text` handling
    fireEvent.change(input, { target: { value: 'Around 9:15 AM, married 2016-06-18' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await screen.findByText('REST text reply: Virgo rising at 88% around 09:15.')

    expect(streamCalls).toHaveLength(1)
    expect(restCalls).toHaveLength(1)
    expect(typeof streamCalls[0].sessionId).toBe('string')
    expect(streamCalls[0].history).toEqual([])
    expect(restCalls[0].sessionId).toBe(streamCalls[0].sessionId)
    expect(restCalls[0].history).toEqual([
      {
        role: 'user',
        content: 'Help me find my rising sign — born July 14, 1990 in Chicago',
      },
      {
        role: 'assistant',
        content: 'Streamed: What time of day were you born?',
      },
    ])
  })
})
