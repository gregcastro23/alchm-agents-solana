import { permanentRedirect } from 'next/navigation'

import { buildTokenShopHref, type SearchParamValue } from '@/lib/shop/navigation'

export const dynamic = 'force-dynamic'

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: SearchParamValue; tokens?: SearchParamValue }>
}) {
  const params = await searchParams
  return permanentRedirect(buildTokenShopHref(params))
}
