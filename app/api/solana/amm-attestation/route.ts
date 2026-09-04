/**
 * POST /api/solana/amm-attestation
 *
 * The Solana counterpart of `/api/staking/pool-attestation`. Opens a Constellation
 * ESMS element-pair pool for a trader, but only while the pair's planetary aspect
 * is forming AND the sky is risen. The attestor's Ed25519 signature *is* the "pool
 * is open right now" gate: `add_liquidity` and `swap_esms` both verify it against
 * `ProgramConfig.attestor` through the Ed25519 precompile before touching state.
 *
 * Differences from the Arc route, all of which the caller must honour:
 *
 *  - The signature is **Ed25519 over a 170-byte preimage**, not EIP-712. It is
 *    returned base64 and must be submitted in an Ed25519 precompile instruction
 *    placed immediately before the AMM instruction (`buildAddLiquidityTransaction`
 *    and `buildSwapEsmsTransaction` do this).
 *  - The attestation is bound to **one operation**. `op` is part of the preimage,
 *    so an `add_liquidity` signature cannot be spent on a swap.
 *  - The nonce is read from the trader's on-chain `PoolTraderNonce` and is
 *    single-use: the program increments it, so a replayed attestation fails.
 *
 * Demo-grade trust, same as the Arc feeder: the attestor is the visibility
 * authority, and live planets are supplied by the client and only ever clamped. A
 * production feeder would recompute them from its own ephemeris.
 */

import { NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { createHash } from 'node:crypto'

import {
  AMM_OP_ADD_LIQUIDITY,
  AMM_OP_SWAP,
  ASOL_SOLANA_PROGRAM_ID,
  CONSTELLATION_PAIRS,
  MAX_AMM_POOL_ID,
  fetchPoolTraderNonce,
  getConstellationPoolAddress,
  getDeedPositionAddress,
  getPoolTraderNonceAddress,
} from '@/lib/solana/constellation-amm'
import { ammAttestorPublicKey, signAmmVisibilityAttestation } from '@/lib/solana/amm-attestor'
import * as aspects from '@/lib/staking/aspects'
import { eclipticToHorizontal } from '@/lib/staking/astro'
import { poolIdForPair } from '@/lib/solana/constellation-amm'
import type { EsmsId, LivePlanet } from '@/lib/staking/types'

import { getSolanaNetworkConfig } from '@/lib/solana/network-config'

export const runtime = 'nodejs'

/** Seconds an attestation stays spendable. */
const ATTESTATION_TTL_SECONDS = 600

interface AmmAttestationRequest {
  trader: string
  poolId: number
  op: 'add_liquidity' | 'swap'
  observer: { lat: number; lon: number }
}

import { checkAttestationRateLimit } from '@/lib/solana/amm-attestation-limiter'

function pairLabel(poolId: number): string {
  const names = ['Spirit', 'Essence', 'Matter', 'Substance']
  const pair = CONSTELLATION_PAIRS[poolId]
  return pair ? `${names[pair[0]]}–${names[pair[1]]}` : `pool ${poolId}`
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  // Security Gate: Reject client-supplied planets to prevent forging astronomical gates
  if ('planets' in body) {
    return NextResponse.json(
      {
        error:
          'Client-supplied planets are rejected for security. Planetary positions are calculated server-side via trusted astronomical ephemeris.',
      },
      { status: 400 }
    )
  }

  const { trader, poolId, op, observer } = body as unknown as AmmAttestationRequest

  let traderKey: PublicKey
  try {
    traderKey = new PublicKey(trader)
  } catch {
    return NextResponse.json({ error: 'valid base58 `trader` required' }, { status: 400 })
  }
  if (
    typeof poolId !== 'number' ||
    !Number.isInteger(poolId) ||
    poolId < 0 ||
    poolId > MAX_AMM_POOL_ID
  ) {
    return NextResponse.json(
      { error: `\`poolId\` must be an integer 0..${MAX_AMM_POOL_ID}` },
      { status: 400 }
    )
  }
  if (op !== 'add_liquidity' && op !== 'swap') {
    return NextResponse.json({ error: '`op` must be "add_liquidity" or "swap"' }, { status: 400 })
  }
  if (
    !observer ||
    typeof observer.lat !== 'number' ||
    !Number.isFinite(observer.lat) ||
    observer.lat < -90 ||
    observer.lat > 90 ||
    typeof observer.lon !== 'number' ||
    !Number.isFinite(observer.lon) ||
    observer.lon < -180 ||
    observer.lon > 180
  ) {
    return NextResponse.json(
      { error: 'Valid observer coordinates required: lat in [-90, 90], lon in [-180, 180]' },
      { status: 400 }
    )
  }

  // Abuse control: In-memory sliding rate limiter per trader
  const rateLimit = checkAttestationRateLimit(traderKey.toBase58())
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attestation requests. Rate limit exceeded, please retry shortly.' },
      { status: 429 }
    )
  }

  const attestor = ammAttestorPublicKey()
  if (!attestor) {
    return NextResponse.json(
      {
        error:
          'Solana attestor key not configured (set SOLANA_ATTESTOR_KEYPAIR or AWS_KMS_KEY_ID). ' +
          'ARC_ATTESTOR_PRIVATE_KEY is secp256k1 and cannot sign for this path.',
      },
      { status: 503 }
    )
  }

  // Gate 1: a favorable aspect must currently form this pair via server-side trusted ephemeris.
  const now = new Date()
  const pair = CONSTELLATION_PAIRS[poolId]
  const active = aspects
    .aspectPools(now)
    .some(pool => poolIdForPair(pool.ids[0] as EsmsId, pool.ids[1] as EsmsId) === poolId)
  if (!active) {
    return NextResponse.json(
      {
        error: `${pairLabel(poolId)} pool is closed — no favorable aspect forms this pair right now`,
        poolId,
        elements: pair,
      },
      { status: 409 }
    )
  }

  // Gate 2: the sky must be risen (computed server-side).
  const visibleStars = aspects
    .planetLongitudes(now)
    .filter(longitude => eclipticToHorizontal(longitude.longitude, observer, now).visible).length
  if (visibleStars === 0) {
    return NextResponse.json({ error: 'no bodies risen — sky is set' }, { status: 409 })
  }

  // The trader's single-use, per-(pool, trader) nonce, read from chain.
  const networkConfig = getSolanaNetworkConfig()
  const rpcUrl = networkConfig.rpcUrls[0]
  let nonce: bigint
  try {
    const connection = new Connection(rpcUrl, 'confirmed')
    const rawNonce = await fetchPoolTraderNonce(connection, poolId, traderKey)
    nonce = BigInt(rawNonce ?? 0n)
  } catch (error) {
    return NextResponse.json(
      { error: `failed to read PoolTraderNonce: ${(error as Error).message}` },
      { status: 502 }
    )
  }

  // `cluster_domain` is bound into the preimage, so a signature minted for devnet
  // cannot be spent on mainnet. It comes from `ProgramConfig`; the env var must
  // match what `initialize_config` was given for this deployment.
  const clusterDomainHex = process.env.SOLANA_CLUSTER_DOMAIN
  if (!clusterDomainHex || !/^(0x)?[0-9a-fA-F]{64}$/.test(clusterDomainHex)) {
    return NextResponse.json(
      {
        error:
          'SOLANA_CLUSTER_DOMAIN must be the 32-byte hex cluster domain recorded in ' +
          'ProgramConfig. A mismatch produces signatures the program will reject.',
      },
      { status: 503 }
    )
  }
  const clusterDomain = Uint8Array.from(Buffer.from(clusterDomainHex.replace(/^0x/, ''), 'hex'))

  // Not verifiable on chain -- carried so the emitted event can be audited against
  // the feeder's own sky model.
  const regionCommit = Uint8Array.from(
    createHash('sha256')
      .update(`pentacle-pair:${poolId}:${now.toISOString().slice(0, 13)}`)
      .digest()
  )

  const deadline = BigInt(Math.floor(now.getTime() / 1000) + ATTESTATION_TTL_SECONDS)
  const opCode = op === 'swap' ? AMM_OP_SWAP : AMM_OP_ADD_LIQUIDITY

  const signed = await signAmmVisibilityAttestation({
    clusterDomain,
    trader: traderKey,
    poolId,
    op: opCode,
    regionCommit,
    visibleStars: Math.min(255, visibleStars),
    nonce,
    deadline,
  })

  return NextResponse.json({
    pair: pairLabel(poolId),
    poolId,
    elements: pair,
    attestation: {
      trader: traderKey.toBase58(),
      poolId,
      op,
      opCode,
      regionCommit: Buffer.from(regionCommit).toString('hex'),
      visibleStars: Math.min(255, visibleStars),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      clusterDomain: Buffer.from(clusterDomain).toString('hex'),
    },
    // Ed25519 over the canonical 170-byte preimage. Submit inside an Ed25519
    // precompile instruction directly before the AMM instruction.
    signature: Buffer.from(signed.signature).toString('base64'),
    message: signed.message.toString('base64'),
    attestor: attestor.toBase58(),
    programId: ASOL_SOLANA_PROGRAM_ID.toBase58(),
    accounts: {
      pool: getConstellationPoolAddress(poolId).toBase58(),
      nonceAccount: getPoolTraderNonceAddress(poolId, traderKey).toBase58(),
      deedPosition: getDeedPositionAddress(poolId, traderKey).toBase58(),
    },
    sky: { visibleStars, observedAt: now.toISOString() },
  })
}
