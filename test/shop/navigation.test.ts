import { describe, expect, it } from 'vitest'

import {
  buildTokenShopHref,
  normalizePurchaseStatus,
  normalizeShopTab,
  normalizeTokenCount,
} from '@/lib/shop/navigation'

describe('shop/navigation', () => {
  it('normalizes known tabs and falls back to token bundles', () => {
    expect(normalizeShopTab('apothecary')).toBe('apothecary')
    expect(normalizeShopTab(['pentacles', 'tokens'])).toBe('pentacles')
    expect(normalizeShopTab('unknown')).toBe('tokens')
    expect(normalizeShopTab(undefined)).toBe('tokens')
  })

  it('only accepts known checkout statuses and package totals', () => {
    expect(normalizePurchaseStatus('success')).toBe('success')
    expect(normalizePurchaseStatus('cancelled')).toBe('cancelled')
    expect(normalizePurchaseStatus('failed')).toBeNull()
    expect(normalizeTokenCount('700')).toBe('700')
    expect(normalizeTokenCount('701')).toBeNull()
  })

  it('builds canonical token-store return links', () => {
    expect(buildTokenShopHref()).toBe('/shop?tab=tokens')
    expect(buildTokenShopHref({ purchase: 'success', tokens: '1600' })).toBe(
      '/shop?tab=tokens&purchase=success&tokens=1600'
    )
    expect(buildTokenShopHref({ purchase: 'cancelled' })).toBe(
      '/shop?tab=tokens&purchase=cancelled'
    )
  })
})
