import { NextResponse } from 'next/server'
import {
  CanonicalPriceIndexError,
  loadCanonicalPriceIndex,
} from '@/lib/economy/canonical-price-index'

export type {
  CanonicalPriceIndexPayload,
  CanonicalTokenIndexQuote,
  EsmsTokenName,
} from '@/lib/economy/price-index-contract'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Agents-side adapter for the one cross-site price authority.
 *
 * This route deliberately contains no price formula and no last-known or
 * synthetic fallback. The response is the validated Kitchen snapshot unchanged,
 * so both flagship domains expose one contract and one set of token indices.
 */
export async function GET() {
  try {
    const snapshot = await loadCanonicalPriceIndex()
    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        'X-ESMS-Price-Authority': 'alchm.kitchen',
      },
    })
  } catch (error) {
    const status = error instanceof CanonicalPriceIndexError ? error.status : 503
    console.error('Canonical ESMS price index unavailable:', error)
    return NextResponse.json(
      {
        success: false,
        live: false,
        message: 'Canonical ESMS price oracle unavailable',
      },
      {
        status,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }
}
