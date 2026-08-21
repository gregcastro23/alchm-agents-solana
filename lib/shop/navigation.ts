import type { ShopItemKind } from '@/lib/shop/catalog'
import { isTokenBundleTotal } from '@/lib/shop/token-bundles'

export type ShopPurchaseStatus = 'success' | 'cancelled'
export type SearchParamValue = string | string[] | undefined

function firstSearchParam(value: SearchParamValue): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim()
}

export function normalizeShopTab(value: SearchParamValue): ShopItemKind {
  const candidate = firstSearchParam(value)
  return candidate === 'apothecary' || candidate === 'pentacles' ? candidate : 'tokens'
}

export function normalizePurchaseStatus(value: SearchParamValue): ShopPurchaseStatus | null {
  const candidate = firstSearchParam(value)
  return candidate === 'success' || candidate === 'cancelled' ? candidate : null
}

export function normalizeTokenCount(value: SearchParamValue): string | null {
  const candidate = firstSearchParam(value)
  return candidate && isTokenBundleTotal(candidate) ? candidate : null
}

export function buildTokenShopHref({
  purchase,
  tokens,
}: {
  purchase?: SearchParamValue
  tokens?: SearchParamValue
} = {}): string {
  const params = new URLSearchParams({ tab: 'tokens' })
  const normalizedPurchase = normalizePurchaseStatus(purchase)
  const normalizedTokens = normalizeTokenCount(tokens)

  if (normalizedPurchase) params.set('purchase', normalizedPurchase)
  if (normalizedPurchase === 'success' && normalizedTokens) params.set('tokens', normalizedTokens)

  return `/shop?${params.toString()}`
}
