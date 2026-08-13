import { describe, expect, it } from 'vitest'
import { SHOP_CATALOG, getShopItem, catalogByKind } from '@/lib/shop/catalog'
import { totalEsms } from '@/lib/shop/pricing'

describe('shop/catalog', () => {
  it('has unique item ids', () => {
    const ids = SHOP_CATALOG.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every item carries a title, blurb, icon and accent', () => {
    for (const item of SHOP_CATALOG) {
      expect(item.title.length).toBeGreaterThan(0)
      expect(item.blurb.length).toBeGreaterThan(0)
      expect(item.icon.length).toBeGreaterThan(0)
      expect(['spirit', 'essence', 'matter', 'substance']).toContain(item.accent)
      expect(item.usdCents).toBeGreaterThan(0)
    }
  })

  it('digital and pentacles items are priced in ESMS; token items specify stripe tier', () => {
    for (const item of SHOP_CATALOG) {
      if (item.kind === 'tokens') {
        expect(item.stripeTier).toBeTruthy()
      } else {
        expect(totalEsms(item.esms)).toBeGreaterThan(0)
      }
    }
  })

  it('getShopItem resolves by id and returns undefined for unknown', () => {
    expect(getShopItem('unlock-philosophers-stone')?.kind).toBe('pentacles')
    expect(getShopItem('does-not-exist')).toBeUndefined()
  })

  it('catalogByKind groups every item exactly once', () => {
    const grouped = catalogByKind()
    const count = grouped.tokens.length + grouped.apothecary.length + grouped.pentacles.length
    expect(count).toBe(SHOP_CATALOG.length)
    expect(grouped.tokens.every(i => i.kind === 'tokens')).toBe(true)
    expect(grouped.apothecary.every(i => i.kind === 'apothecary')).toBe(true)
    expect(grouped.pentacles.every(i => i.kind === 'pentacles')).toBe(true)
  })
})
