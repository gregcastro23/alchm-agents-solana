export interface CachedPoolAccount {
  accountInfo: {
    context: { slot: number }
    value: { data: Buffer | Uint8Array } | null
  }
  fetchedAt: number
}

const poolCache = new Map<number, CachedPoolAccount>()
export const AMM_POOL_CACHE_TTL_MS = 2000

export function getCachedPoolAccount(poolId: number): CachedPoolAccount | undefined {
  const cached = poolCache.get(poolId)
  if (cached && Date.now() - cached.fetchedAt < AMM_POOL_CACHE_TTL_MS) {
    return cached
  }
  return undefined
}

export function setCachedPoolAccount(
  poolId: number,
  accountInfo: CachedPoolAccount['accountInfo']
): void {
  poolCache.set(poolId, { accountInfo, fetchedAt: Date.now() })
}

export function clearAmmQuotePoolCache(): void {
  poolCache.clear()
}
