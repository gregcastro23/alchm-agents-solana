import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthResolution } from '@/lib/auth'

const { resolveAuth } = vi.hoisted(() => ({ resolveAuth: vi.fn<() => Promise<AuthResolution>>() }))
vi.mock('@/lib/auth', () => ({ resolveAuth }))
vi.mock('@/components/alchemy/ForgeWizard', () => ({ ForgeWizard: () => null }))
vi.mock('@/app/(app)/philosophers-stone/modern-page-v2', () => ({ default: () => null }))

import ForgePage from '@/app/(occult)/forge/page'
import PhilosophersStone from '@/app/(app)/philosophers-stone/page'

afterEach(() => vi.clearAllMocks())

describe.each([
  { name: '/forge', page: ForgePage },
  { name: '/philosophers-stone', page: PhilosophersStone },
])('$name resolves identity before enabling creation', ({ page }) => {
  it.each([
    {
      identity: 'native',
      resolution: { session: { user: { id: 'native-user' } }, identityUnavailable: false },
      creatorId: 'native-user',
    },
    {
      identity: 'kitchen bridge',
      resolution: {
        session: { user: { id: 'pa-bridged-user', kitchenPremium: true } },
        identityUnavailable: false,
      },
      creatorId: 'pa-bridged-user',
    },
    {
      identity: 'anonymous',
      resolution: { session: null, identityUnavailable: false },
      creatorId: undefined,
    },
    {
      identity: 'unavailable',
      resolution: { session: null, identityUnavailable: true },
      creatorId: undefined,
    },
  ] satisfies Array<{
    identity: string
    resolution: AuthResolution
    creatorId: string | undefined
  }>)('passes the authoritative $identity resolution', async ({ resolution, creatorId }) => {
    resolveAuth.mockResolvedValueOnce(resolution)
    const result = await page()
    expect(resolveAuth).toHaveBeenCalledOnce()
    expect(result.props).toEqual({
      creatorId,
      identityUnavailable: resolution.identityUnavailable,
    })
  })

  it('waits for identity instead of rendering an interactive anonymous forge while auth loads', async () => {
    let finish: ((value: AuthResolution) => void) | undefined
    resolveAuth.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    let rendered = false
    const pending = page().then(result => {
      rendered = true
      return result
    })
    await Promise.resolve()
    expect(rendered).toBe(false)
    expect(finish).toBeDefined()
    finish?.({ session: { user: { id: 'pa-bridged-user' } }, identityUnavailable: false })
    expect((await pending).props.creatorId).toBe('pa-bridged-user')
  })
})
