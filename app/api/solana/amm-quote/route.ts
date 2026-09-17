import { NextResponse } from 'next/server'
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import {
  CONSTELLATION_PAIRS,
  MAX_AMM_POOL_ID,
  buildSwapEsmsInstruction,
  decodeConstellationPool,
  getConstellationPoolAddress,
  quoteAmmSwap,
  type EsmsElementId,
} from '@/lib/solana/constellation-amm'
import { getSolanaNetworkConfig } from '@/lib/solana/network-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// In-memory pool query cache (TTL ≈ 2s) to prevent RPC flooding on rapid polling (F11)
interface CachedPoolAccount {
  accountInfo: {
    context: { slot: number }
    value: { data: Buffer | Uint8Array } | null
  }
  fetchedAt: number
}
const poolCache = new Map<number, CachedPoolAccount>()
const CACHE_TTL_MS = 2000

export function clearAmmQuotePoolCache(): void {
  poolCache.clear()
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const poolIdStr = url.searchParams.get('poolId')
  const inElementStr = url.searchParams.get('inElement')
  const inAmountStr = url.searchParams.get('inAmountAtoms')
  const slippageBpsStr = url.searchParams.get('slippageBps') ?? '50'
  const traderStr = url.searchParams.get('trader')

  if (poolIdStr === null || inElementStr === null || inAmountStr === null) {
    return NextResponse.json(
      { error: 'Required query parameters: poolId, inElement, inAmountAtoms' },
      { status: 400 }
    )
  }

  const poolId = Number(poolIdStr)
  if (!Number.isInteger(poolId) || poolId < 0 || poolId > MAX_AMM_POOL_ID) {
    return NextResponse.json(
      { error: `poolId must be an integer 0..${MAX_AMM_POOL_ID}` },
      { status: 400 }
    )
  }

  const inElement = Number(inElementStr)
  if (!Number.isInteger(inElement) || inElement < 0 || inElement > 3) {
    return NextResponse.json(
      { error: 'inElement must be 0 (Spirit), 1 (Essence), 2 (Matter), or 3 (Substance)' },
      { status: 400 }
    )
  }

  let inAmountAtoms: bigint
  try {
    inAmountAtoms = BigInt(inAmountStr)
    if (inAmountAtoms <= 0n) throw new Error()
  } catch {
    return NextResponse.json(
      { error: 'inAmountAtoms must be a positive integer string' },
      { status: 400 }
    )
  }

  const slippageBps = Number(slippageBpsStr)
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10000) {
    return NextResponse.json({ error: 'slippageBps must be an integer 0..10000' }, { status: 400 })
  }

  const pair = CONSTELLATION_PAIRS[poolId]
  if (!pair || (inElement !== pair[0] && inElement !== pair[1])) {
    return NextResponse.json(
      { error: `inElement ${inElement} is not part of pool ${poolId} pair [${pair?.join(', ')}]` },
      { status: 400 }
    )
  }
  const outElement = (inElement === pair[0] ? pair[1] : pair[0]) as EsmsElementId

  const networkConfig = getSolanaNetworkConfig()
  const rpcUrl = networkConfig.rpcUrls[0] || 'https://api.devnet.solana.com'
  const connection = new Connection(rpcUrl, 'confirmed')

  const poolAddress = getConstellationPoolAddress(poolId)
  let accountInfo: {
    context: { slot: number }
    value: { data: Buffer | Uint8Array } | null
  } | null = null

  const now = Date.now()
  const cached = poolCache.get(poolId)
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    accountInfo = cached.accountInfo
  } else {
    try {
      const fetched = await connection.getAccountInfoAndContext(poolAddress)
      accountInfo = fetched
      if (fetched) {
        poolCache.set(poolId, { accountInfo: fetched, fetchedAt: now })
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to query pool account from RPC: ${(err as Error).message}` },
        { status: 502 }
      )
    }
  }

  if (!accountInfo?.value?.data) {
    return NextResponse.json(
      {
        error: `ConstellationPool ${poolId} account not found on-chain at ${poolAddress.toBase58()}`,
        poolAddress: poolAddress.toBase58(),
        code: 'pool_not_found',
      },
      { status: 404 }
    )
  }

  let pool
  try {
    pool = decodeConstellationPool(Buffer.from(accountInfo.value.data))
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to decode pool account: ${(err as Error).message}` },
      { status: 500 }
    )
  }

  // Guards (F11): check paused and bootstrapped; return 409 with no outAtoms
  if (pool.paused) {
    return NextResponse.json(
      {
        error: `ConstellationPool ${poolId} is currently paused`,
        code: 'pool_paused',
        poolId,
        paused: true,
        bootstrapped: pool.bootstrapped,
        slot: accountInfo.context.slot,
      },
      { status: 409 }
    )
  }

  if (!pool.bootstrapped) {
    return NextResponse.json(
      {
        error: `ConstellationPool ${poolId} is not bootstrapped`,
        code: 'pool_not_bootstrapped',
        poolId,
        paused: pool.paused,
        bootstrapped: false,
        slot: accountInfo.context.slot,
      },
      { status: 409 }
    )
  }

  const isA = inElement === pool.elementA
  const reserveIn = isA ? pool.reserveA : pool.reserveB
  const reserveOut = isA ? pool.reserveB : pool.reserveA

  const outAtoms = quoteAmmSwap({
    reserveIn,
    reserveOut,
    feeBps: pool.feeBps,
    inAmount: inAmountAtoms,
  })

  const minOutAtoms = (outAtoms * (10000n - BigInt(slippageBps))) / 10000n

  let simulationResult: {
    simulated: boolean
    err: any
    logs: string[] | null
    unitsConsumed: number | null
  } | null = null

  // Real RPC simulation via simulateTransaction when trader key is supplied (F2)
  if (traderStr) {
    let traderKey: PublicKey
    try {
      traderKey = new PublicKey(traderStr)

      const swapIx = buildSwapEsmsInstruction({
        poolId,
        elementA: pool.elementA,
        elementB: pool.elementB,
        inElement,
        inAmount: inAmountAtoms,
        minOut: minOutAtoms,
        trader: traderKey,
        attestation: {
          attestor: PublicKey.default,
          signature: new Uint8Array(64),
          regionCommit: new Uint8Array(32),
          visibleStars: 7,
          nonce: 0n,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
          clusterDomain: new Uint8Array(32),
        },
      })

      const messageV0 = new TransactionMessage({
        payerKey: traderKey,
        recentBlockhash: PublicKey.default.toBase58(),
        instructions: [swapIx],
      }).compileToV0Message()
      const tx = new VersionedTransaction(messageV0)

      const sim = await connection.simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      })

      simulationResult = {
        simulated: true,
        err: sim.value.err,
        logs: sim.value.logs,
        unitsConsumed: sim.value.unitsConsumed ?? null,
      }
    } catch (simErr) {
      simulationResult = {
        simulated: false,
        err: (simErr as Error).message,
        logs: null,
        unitsConsumed: null,
      }
    }
  }

  return NextResponse.json({
    poolId,
    inElement,
    outElement,
    inAmountAtoms: inAmountAtoms.toString(),
    outAtoms: outAtoms.toString(),
    minOutAtoms: minOutAtoms.toString(),
    feeBps: pool.feeBps,
    reserves: {
      in: reserveIn.toString(),
      out: reserveOut.toString(),
      reserveA: pool.reserveA.toString(),
      reserveB: pool.reserveB.toString(),
    },
    bootstrapped: pool.bootstrapped,
    paused: pool.paused,
    slot: accountInfo.context.slot,
    simulation: simulationResult,
  })
}
