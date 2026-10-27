// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/wten/delivery', () => ({ deliverToWten: vi.fn(), stableEventId: vi.fn() }))
import { deliverToWten } from '@/lib/wten/delivery'
import { postAgentWeeklyMenu, type WeeklyMenu } from '@/lib/wtenClient'

const menu = {
  agentSlug: 'hildegard-of-bingen',
  status: 'completed',
  shareToFeed: true,
} as WeeklyMenu

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('INTERNAL_API_SECRET', 'publication-service-secret')
  vi.stubEnv('ALCHM_KITCHEN_SYNC_URL', 'https://kitchen.test')
})
afterEach(() => vi.unstubAllEnvs())

describe('WTEN weekly menu delivery', () => {
  it('uses a stable source event ID and one bounded attempt', async () => {
    const result = { success: true, menu: { id: 'menu-1' }, feedShared: true }
    vi.mocked(deliverToWten).mockResolvedValue({ ok: true, body: result } as any)
    expect(await postAgentWeeklyMenu(menu, 'weekly-menu-publication:source')).toEqual(result)
    expect(deliverToWten).toHaveBeenCalledWith({
      endpoint: 'menu-planner/agent-weekly-menu',
      url: 'https://kitchen.test/api/menu-planner/agent-weekly-menu',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer publication-service-secret',
        'X-Sync-Secret': 'publication-service-secret',
      },
      body: menu,
      eventId: 'weekly-menu-publication:source',
      maxAttempts: 1,
    })
  })
  it.each([{ success: false }, { success: true }, null])(
    'rejects a malformed success response %o',
    async body => {
      vi.mocked(deliverToWten).mockResolvedValue({ ok: true, body } as any)
      await expect(postAgentWeeklyMenu(menu, 'source')).rejects.toThrow('invalid response')
    }
  )
  it('rejects an unconfirmed attempt without exposing downstream details', async () => {
    vi.mocked(deliverToWten).mockResolvedValue({
      ok: false,
      body: { privateError: 'provider detail' },
    } as any)
    await expect(postAgentWeeklyMenu(menu, 'source')).rejects.toThrow('could not be confirmed')
    expect(deliverToWten).toHaveBeenCalledOnce()
  })
})
