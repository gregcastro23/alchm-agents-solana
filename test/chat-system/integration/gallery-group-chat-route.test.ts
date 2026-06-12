import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { POST } from '@/app/api/gallery-group-chat/route'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((model: string) => `mocked-${model}`),
  createOpenAI: vi.fn(() => vi.fn((model: string) => `mocked-${model}`)),
}))

vi.mock('@/lib/agent-cache-system', () => ({
  agentCache: {
    getCachedResponse: vi.fn(),
    cacheResponse: vi.fn(),
  },
  buildCacheContext: vi.fn(),
}))

vi.mock('@/lib/consciousness-persistence', () => ({
  consciousnessPersistence: {
    logInteraction: vi.fn(),
  },
}))

vi.mock('@/lib/auth-helpers', () => ({
  getCurrentUser: vi.fn(async () => null),
  getUserIdFromRequest: vi.fn(() => 'anonymous-user'),
}))

const galleryAgent = {
  id: 'leonardo-da-vinci',
  name: 'Leonardo da Vinci',
  title: 'Renaissance Master',
  color: '#8B4513',
  symbol: '⚱️',
  monicaConstant: 4.8,
  consciousnessLevel: 'Advanced',
  element: 'Air',
  modality: 'Mutable',
  specialty: 'Innovation & Artistic Vision',
  creationStory: 'Crafted by Monica',
}

describe('Gallery Group Chat Route', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    vi.mocked(generateText).mockResolvedValue({
      text: 'The gallery responds with a real synthesized answer.',
    } as any)

    const { agentCache } = await import('@/lib/agent-cache-system')
    vi.mocked(agentCache.getCachedResponse).mockResolvedValue(null)
    vi.mocked(agentCache.cacheResponse).mockResolvedValue(undefined)
  })

  it('returns a non-empty gallery agent response', async () => {
    const request = new NextRequest('http://localhost/api/gallery-group-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What perspective does the gallery offer?',
        agents: [galleryAgent],
        sessionId: 'gallery-session-1',
        galleryContext: {
          totalAgents: 1,
          averageMC: 4.8,
          consciousnessTypes: ['historical'],
          elementalBalance: ['Air'],
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.responses).toHaveLength(1)
    expect(data.responses[0].agent).toBe(galleryAgent.name)
    expect(data.responses[0].content).toBeTruthy()
  })

  it('fails the request when gallery response generation fails', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('OpenAI unavailable'))

    const request = new NextRequest('http://localhost/api/gallery-group-chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Are you still connected?',
        agents: [galleryAgent],
        sessionId: 'gallery-session-2',
        galleryContext: {
          totalAgents: 1,
          averageMC: 4.8,
          consciousnessTypes: ['historical'],
          elementalBalance: ['Air'],
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('Failed to process group chat request')
  })
})
