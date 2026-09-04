// @vitest-environment node

import { Connection } from '@solana/web3.js'
import { describe, it, expect, beforeAll } from 'vitest'

import {
  CONSTELLATION_PAIRS,
  getConstellationPoolAddress,
  decodeConstellationPool,
  ASOL_SOLANA_PROGRAM_ID,
} from '@/lib/solana/constellation-amm'
import { SOLANA_DEVNET_GENESIS_HASH } from '@/lib/solana/network-config'
import {
  initDevnetAmm,
  UNIFORM_BOOTSTRAP_RESERVE,
  UNIFORM_FEE_BPS,
} from '@/scripts/devnet/init-devnet-amm'

const hasDevnetProvider = Boolean(
  process.env.RUN_SOLANA_DEVNET_LIVE === '1' &&
  process.env.ANCHOR_PROVIDER_URL &&
  process.env.ANCHOR_WALLET
)

const describeDevnet = hasDevnetProvider
  ? describe
  : (name: string, _suite: () => void) =>
      describe.skip(name, () => {
        it('requires RUN_SOLANA_DEVNET_LIVE=1, ANCHOR_PROVIDER_URL, and ANCHOR_WALLET', () =>
          undefined)
      })

describeDevnet('Constellation AMM On-Chain Devnet Integration Suite', () => {
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'
  const connection = new Connection(rpcUrl, { commitment: 'confirmed' })
  const programId = ASOL_SOLANA_PROGRAM_ID

  beforeAll(async () => {
    const genesisHash = await connection.getGenesisHash()
    expect(genesisHash).toBe(SOLANA_DEVNET_GENESIS_HASH)
  }, 120_000)

  it('verifies all 6 canonical Constellation AMM pools are registered and bootstrapped on Devnet', async () => {
    for (let poolId = 0; poolId < CONSTELLATION_PAIRS.length; poolId++) {
      const [expectedA, expectedB] = CONSTELLATION_PAIRS[poolId]
      const poolPda = getConstellationPoolAddress(poolId, programId)
      const info = await connection.getAccountInfo(poolPda, 'confirmed')

      expect(info, `Pool ${poolId} account should exist on Devnet`).not.toBeNull()
      expect(info?.owner.equals(programId)).toBe(true)

      const pool = decodeConstellationPool(Buffer.from(info!.data))
      expect(pool.poolId).toBe(poolId)
      expect(pool.elementA).toBe(expectedA)
      expect(pool.elementB).toBe(expectedB)
      expect(pool.feeBps).toBe(UNIFORM_FEE_BPS)
      expect(pool.bootstrapped).toBe(true)
      expect(pool.totalShares).toBeGreaterThanOrEqual(UNIFORM_BOOTSTRAP_RESERVE)
      expect(pool.reserveA).toBeGreaterThan(0n)
      expect(pool.reserveB).toBeGreaterThan(0n)
      // Constant product k >= k_0
      const k = BigInt(pool.reserveA) * BigInt(pool.reserveB)
      const k0 = UNIFORM_BOOTSTRAP_RESERVE * UNIFORM_BOOTSTRAP_RESERVE
      expect(k).toBeGreaterThanOrEqual(k0)
    }
  }, 120_000)

  it('executes a live AMM trading drill with ephemeral trader, attestations, and invariant checks', async () => {
    // Executes full lifecycle: add liquidity, swap, replay check, withdrawal
    await initDevnetAmm({
      rpcUrl,
      skipDrill: false,
    })
  }, 180_000)
})
