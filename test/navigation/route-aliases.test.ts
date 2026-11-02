import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPermanentRedirect = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({ permanentRedirect: mockPermanentRedirect }))

import AstrologicalAgentsPage from '@/app/(app)/astrological-agents/page'
import MePage from '@/app/(app)/me/page'
import SynastryIndexPage from '@/app/(app)/synastry/page'
import UpgradePage from '@/app/(app)/upgrade/page'
import VaultDirectoryRedirectPage from '@/app/(occult)/vault/page'
import DashboardRedirectPage from '@/app/(app)/dashboard/page'
import GalileoLegacyRedirectPage from '@/app/(app)/planetary-agents/galileo/page'
import ConsciousnessSurveyRedirectPage from '@/app/(app)/consciousness-survey/page'
import TrainAgentRedirectPage from '@/app/(app)/train/[id]/page'
import MonicaGuideRedirectPage from '@/app/(app)/monica-guide/page'
import RunesRedirectPage from '@/app/(app)/runes/page'
import LegacySettingsRedirectPage from '@/app/(admin)/settings/page'

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

  it('consolidates vault, dashboard, monica-guide, runes, settings, survey, and training aliases', async () => {
    VaultDirectoryRedirectPage()
    DashboardRedirectPage()
    GalileoLegacyRedirectPage()
    ConsciousnessSurveyRedirectPage()
    await TrainAgentRedirectPage({ params: Promise.resolve({ id: 'isaac-newton' }) })
    MonicaGuideRedirectPage()
    RunesRedirectPage()
    LegacySettingsRedirectPage()

    expect(mockPermanentRedirect.mock.calls).toEqual([
      ['/gallery'],
      ['/profile'],
      ['/agent/galileo-galilei'],
      ['/philosophers-stone'],
      ['/agent/isaac-newton'],
      ['/monica'],
      ['/rune-forge?tab=codex'],
      ['/account'],
    ])
  })
})
