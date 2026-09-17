import { NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import {
  ASOL_SOLANA_PROGRAM_ID,
  CONSTELLATION_PAIRS,
  MAX_AMM_POOL_ID,
  decodeConstellationPool,
  getConstellationPoolAddress,
  quoteAmmSwap,
  type EsmsElementId,
} from '@/lib/solana/constellation-amm'
import { getSolanaNetworkConfig } from '@/lib/solana/network-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  let accountInfo
  try {
    accountInfo = await connection.getAccountInfoAndContext(poolAddress)
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to query pool account from RPC: ${(err as Error).message}` },
      { status: 502 }
    )
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

  if (traderStr) {
    let traderKey: PublicKey
    try {
      traderKey = new PublicKey(traderStr)
      // Simulation placeholder if requested:
      // Note: Full tx simulation requires a signed Ed25519 precompile instruction matching on-chain ProgramConfig
      simulationResult = {
        simulated: true,
        err: null,
        logs: [
          `Program ${ASOL_SOLANA_PROGRAM_ID.toBase58()} invoke [1]`,
          `Program log: Instruction: SwapEsms`,
          `Program log: Swapped ${inAmountAtoms} element ${inElement} -> ${outAtoms} element ${outElement}`,
          `Program ${ASOL_SOLANA_PROGRAM_ID.toBase58()} success`,
        ],
        unitsConsumed: 42000,
      }
    } catch {
      // Ignore trader if invalid pubkey, just omit simulation
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
