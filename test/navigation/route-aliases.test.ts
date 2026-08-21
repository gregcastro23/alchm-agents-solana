import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPermanentRedirect = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ permanentRedirect: mockPermanentRedirect }))

import AstrologicalAgentsPage from '@/app/(app)/astrological-agents/page'
import MePage from '@/app/(app)/me/page'
import SynastryIndexPage from '@/app/(app)/synastry/page'
import UpgradePage from '@/app/(app)/upgrade/page'

describe('legacy route aliases', () => {
  beforeEach(() => {
    mockPermanentRedirect.mockClear()
  })

  it('consolidates redundant top-level destinations', async () => {
    AstrologicalAgentsPage()
    MePage()
    await SynastryIndexPage({ searchParams: Promise.resolve({}) })
    await UpgradePage({ searchParams: Promise.resolve({}) })

    expect(mockPermanentRedirect.mock.calls).toEqual([
      ['/planetary-agents'],
      ['/profile'],
      ['/arena'],
      ['/shop?tab=tokens'],
    ])
  })

  it('preserves synastry deep links and valid Stripe return state', async () => {
    await SynastryIndexPage({ searchParams: Promise.resolve({ agent: 'Ada Lovelace' }) })
    await UpgradePage({
      searchParams: Promise.resolve({ purchase: 'success', tokens: '700' }),
    })

    expect(mockPermanentRedirect.mock.calls).toEqual([
      ['/synastry/Ada%20Lovelace'],
      ['/shop?tab=tokens&purchase=success&tokens=700'],
    ])
  })
})
