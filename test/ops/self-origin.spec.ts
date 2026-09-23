// @vitest-environment node
/**
 * Server-to-self calls resolve to an origin that will actually answer them.
 *
 * Every *.vercel.app host sits behind Vercel Standard Protection and returns 401
 * to a server-side caller. The feed pusher used to fall through to VERCEL_URL in
 * production, so every System-B post to the council feed was rejected; a preview
 * must not write into production unless it was told to.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CANONICAL_AGENTS_ORIGIN, resolveSelfOrigin } from '@/lib/self-origin'

vi.mock('@/lib/agents/feed-activation-engine', () => ({
  feedActivationEngine: { evaluateActivations: vi.fn(async () => []) },
}))
vi.mock('@/lib/agents/planetary-degree-feed', () => ({
  planetaryDegreeFeedService: { evaluateDegreeChanges: vi.fn(async () => []) },
}))

// What Vercel injects into every deployment of this project.
const DEPLOYMENT = {
  VERCEL_URL: 'alchm-agents-solana-8f2k1q-alchm.vercel.app',
  VERCEL_BRANCH_URL: 'alchm-agents-solana-git-main-alchm.vercel.app',
  VERCEL_PROJECT_PRODUCTION_URL: 'agents.alchm.kitchen',
}
const PRODUCTION = { ...DEPLOYMENT, VERCEL_ENV: 'production' }
const PREVIEW = { ...DEPLOYMENT, VERCEL_ENV: 'preview' }

describe('resolveSelfOrigin', () => {
  it.each<[string, Record<string, string>, string | null]>([
    // Production
    [
      'production as configured today: the custom domain, not VERCEL_URL',
      PRODUCTION,
      'https://agents.alchm.kitchen',
    ],
    [
      'production whose production URL is the protected *.vercel.app fallback',
      { ...PRODUCTION, VERCEL_PROJECT_PRODUCTION_URL: 'alchm-agents-eth.vercel.app' },
      CANONICAL_AGENTS_ORIGIN,
    ],
    [
      'production with no VERCEL_PROJECT_PRODUCTION_URL',
      { ...PRODUCTION, VERCEL_PROJECT_PRODUCTION_URL: '' },
      CANONICAL_AGENTS_ORIGIN,
    ],
    [
      'production URL given with a scheme and trailing slash',
      { ...PRODUCTION, VERCEL_PROJECT_PRODUCTION_URL: 'https://agents.alchm.kitchen/' },
      'https://agents.alchm.kitchen',
    ],
    [
      'production with an explicit override',
      { ...PRODUCTION, NEXT_PUBLIC_APP_URL: 'https://ops.alchm.kitchen/' },
      'https://ops.alchm.kitchen',
    ],
    // Preview
    ['preview: nowhere, rather than its protected host or production', PREVIEW, null],
    [
      'preview that opts in with an explicit override',
      { ...PREVIEW, NEXT_PUBLIC_APP_URL: 'https://staging.alchm.kitchen' },
      'https://staging.alchm.kitchen',
    ],
    // Off Vercel
    ['local dev and scripts (no VERCEL_ENV): unchanged', {}, CANONICAL_AGENTS_ORIGIN],
    ['vercel dev (VERCEL_ENV=development)', { VERCEL_ENV: 'development' }, CANONICAL_AGENTS_ORIGIN],
    [
      'local dev with an override',
      { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' },
      'http://localhost:3000',
    ],
  ])('%s', (_, env, expected) => {
    expect(resolveSelfOrigin(env)).toBe(expected)
  })

  it.each<[string, Record<string, string>, string]>([
    [
      'NEXT_PUBLIC_APP_URL first',
      { NEXT_PUBLIC_APP_URL: 'https://a.test', NEXT_PUBLIC_BASE_URL: 'https://b.test' },
      'https://a.test',
    ],
    [
      'then NEXT_PUBLIC_BASE_URL',
      { NEXT_PUBLIC_BASE_URL: 'https://b.test', AGENTS_PUBLIC_URL: 'https://c.test' },
      'https://b.test',
    ],
    ['then AGENTS_PUBLIC_URL', { AGENTS_PUBLIC_URL: 'https://c.test' }, 'https://c.test'],
  ])('override precedence: %s', (_, env, expected) => {
    expect(resolveSelfOrigin({ ...PRODUCTION, ...env })).toBe(expected)
  })

  it('never derives a deployment hostname, in any Vercel environment', () => {
    for (const VERCEL_ENV of ['production', 'preview', 'development', undefined]) {
      for (const VERCEL_PROJECT_PRODUCTION_URL of [
        'agents.alchm.kitchen',
        'alchm-agents-eth.vercel.app',
        undefined,
      ]) {
        const origin = resolveSelfOrigin({
          ...DEPLOYMENT,
          VERCEL_ENV,
          VERCEL_PROJECT_PRODUCTION_URL,
        })
        expect(origin ?? '').not.toMatch(/vercel\.app/)
      }
    }
  })
})

describe('feed pusher → local /api/feed', () => {
  const fetchMock = vi.fn()
  const action = {
    agentEmail: 'socrates@agentic.alchm.kitchen',
    eventType: 'insight' as const,
    metadataPayload: {
      insightTitle: 'On the good',
      insightContent: 'Know thyself; the unexamined life is not worth living.',
    },
  }
  const localCalls = () =>
    fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter(url => !url.startsWith('https://alchm.kitchen/'))

  // LOCAL_API_URL is fixed at module load, so each case imports a fresh copy.
  async function pushWith(env: Record<string, string>) {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    vi.resetModules()
    const { feedPusherService } = await import('@/lib/agents/feed-pusher')
    return feedPusherService.pushActions([structuredClone(action)])
  }

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ event: { id: 'evt-1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('INTERNAL_API_SECRET', 'internal-secret')
    for (const key of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_BASE_URL', 'AGENTS_PUBLIC_URL']) {
      vi.stubEnv(key, '')
    }
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('production posts to the custom domain, not the protected deployment host', async () => {
    const result = await pushWith(PRODUCTION)
    expect(result.pushedCount).toBe(1)
    expect(localCalls()).toEqual(['https://agents.alchm.kitchen/api/feed'])
  })

  it('a preview makes no local call at all, and still pushes the action', async () => {
    const result = await pushWith(PREVIEW)
    expect(result.pushedCount).toBe(1)
    expect(localCalls()).toEqual([])
  })
})
