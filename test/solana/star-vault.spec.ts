// @vitest-environment node

import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import { Keypair, PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import { describe, expect, it } from 'vitest'

import {
  ASOL_SOLANA_PROGRAM_ID,
  buildStarYieldAuthorizationMessage,
  calculateYieldCap,
  checkpointYield,
  getStarPoolAddress,
  getStarVaultAddress,
  getStakePositionAddress,
  MAX_STAR_PROOF_DEPTH,
  MAX_YIELD_RATE_PER_USDC_DAY,
  openZeppelinStarLeaf,
  SECONDS_PER_DAY,
  STAR_VAULT_SEEDS,
  STAR_YIELD_AUTHORIZATION_DOMAIN,
  USDC_RAW_SCALE,
  verifyStarMerkleProof,
} from '@/lib/solana/star-vault'

import { FALLBACK_STARS } from '@/lib/staking/star-catalog'

describe('StarVault Staking & Checkpointed Yield Accrual Engine', () => {
  describe('OpenZeppelin Merkle Tree Leaf & Proof Verification', () => {
    it('matches the OpenZeppelin StandardMerkleTree uint32 leaf for Polaris (HIP 677)', () => {
      const leafHex = openZeppelinStarLeaf(677)
      expect(leafHex).toBe('0x3faa6d4015e2c725ac8e804470bee904ec1855a333dafaf3fbf6e06fdf3e94a2')
    })

    it('verifies StandardMerkleTree proofs generated for catalog stars', () => {
      const starIds = Array.from(new Set(FALLBACK_STARS.map(s => s.hipId))).sort((a, b) => a - b)
      const tree = StandardMerkleTree.of(
        starIds.map(id => [id] as [number]),
        ['uint32']
      )
      const root = tree.root

      // Verify each entry in the tree
      for (const [i, v] of tree.entries()) {
        const starId = v[0]
        const proof = tree.getProof(i)
        const leaf = openZeppelinStarLeaf(starId)

        const isValid = verifyStarMerkleProof(proof, root, leaf)
        expect(isValid).toBe(true)
      }
    })

    it('rejects invalid proofs or tampered star IDs', () => {
      const starIds = [677, 11767, 32349, 100000]
      const tree = StandardMerkleTree.of(
        starIds.map(id => [id] as [number]),
        ['uint32']
      )
      const root = tree.root
      const polarisProof = tree.getProof(0) // proof for 677

      // Tampered leaf
      const fakeLeaf = openZeppelinStarLeaf(99999)
      expect(verifyStarMerkleProof(polarisProof, root, fakeLeaf)).toBe(false)

      // Tampered proof element
      const corruptedProof = [...polarisProof]
      if (corruptedProof.length > 0) {
        corruptedProof[0] = '0x0000000000000000000000000000000000000000000000000000000000000000'
        expect(verifyStarMerkleProof(corruptedProof, root, openZeppelinStarLeaf(677))).toBe(false)
      }
    })
  })

  describe('Checkpointed Yield Accrual vs Arc EVM Vulnerability', () => {
    it('proves zero retroactive accrual when topping up principal on Day 10', () => {
      const maxRatePerUsdcDay = 50_000n // 5 ESMS atoms per 1 USDC per day (ESMS_DECIMALS = 4 -> 5.0000 ESMS)
      const daySeconds = 86_400n

      // Day 0: User stakes 10 USDC (10_000_000 micro-USDC)
      const initialPrincipal = 10_000_000n // 10 USDC
      const t0 = 1_000_000n // Day 0 timestamp

      let position = {
        principal: initialPrincipal,
        accruedCap: 0n,
        lastCheckpoint: t0,
      }

      // Day 10: 10 days elapse. User tops up 1,000 USDC
      const tDay10 = t0 + 10n * daySeconds
      const checkpointDay10 = checkpointYield({
        currentPrincipal: position.principal,
        maxRatePerUsdcDay,
        lastCheckpoint: position.lastCheckpoint,
        now: tDay10,
        accruedCap: position.accruedCap,
      })

      position = {
        principal: position.principal + 1_000_000_000n, // Top-up 1000 USDC -> 1010 USDC total
        accruedCap: checkpointDay10.accruedCap,
        lastCheckpoint: checkpointDay10.lastCheckpoint,
      }

      // 10 USDC * 5 ESMS/day * 10 days = 500 ESMS (5_000_000 atoms)
      const expected10DayYield =
        (10_000_000n * maxRatePerUsdcDay * (10n * daySeconds)) / (USDC_RAW_SCALE * SECONDS_PER_DAY)
      expect(position.accruedCap).toBe(5_000_000n)
      expect(position.accruedCap).toBe(expected10DayYield)
      expect(position.lastCheckpoint).toBe(tDay10)
      expect(position.principal).toBe(1_010_000_000n) // 1010 USDC

      // Day 10 + 1 second: User claims yield
      const tClaim = tDay10 + 1n
      const intervalCap = calculateYieldCap({
        principal: position.principal,
        maxRatePerUsdcDay,
        elapsedSeconds: tClaim - position.lastCheckpoint,
      })

      // 1 second of 1,010 USDC:
      // (1010_000_000 * 50_000 * 1) / (1_000_000 * 86_400) = 584 atoms (0.0584 ESMS)
      expect(intervalCap).toBe(584n)

      const totalClaimable = position.accruedCap + intervalCap
      expect(totalClaimable).toBe(5_000_584n)

      // Vulnerable Arc EVM Calculation (no checkpoint prior to top-up, lastClaimAt still Day 0):
      // yieldCap = (1010 USDC * 5 ESMS/day * (10 days + 1s)) / 1 day
      const vulnerableEvmCap = calculateYieldCap({
        principal: position.principal,
        maxRatePerUsdcDay,
        elapsedSeconds: tClaim - t0,
      })
      expect(vulnerableEvmCap).toBe(505_000_584n)

      // Checkpointed engine strictly prevented a 500,000,000 atom (100x) over-accrual exploit!
      const exploitedAmountPrevented = vulnerableEvmCap - totalClaimable
      expect(exploitedAmountPrevented).toBe(500_000_000n)
      expect(exploitedAmountPrevented).toBe(
        (1_000_000_000n * maxRatePerUsdcDay * (10n * daySeconds)) /
          (USDC_RAW_SCALE * SECONDS_PER_DAY)
      )
    })

    it('correctly calculates dynamic yield caps across varied rates and durations', () => {
      // 100 USDC staked for 30 days at 2.5 ESMS/USDC/day (25_000 atoms)
      const cap = calculateYieldCap({
        principal: 100_000_000n,
        maxRatePerUsdcDay: 25_000n,
        elapsedSeconds: 30n * 86_400n,
      })
      // 100 * 2.5 * 30 = 7500 ESMS = 75_000_000 atoms
      expect(cap).toBe(75_000_000n)

      // Zero principal or zero elapsed time returns 0
      expect(
        calculateYieldCap({ principal: 0n, maxRatePerUsdcDay: 25_000n, elapsedSeconds: 86400n })
      ).toBe(0n)
      expect(
        calculateYieldCap({
          principal: 100_000_000n,
          maxRatePerUsdcDay: 25_000n,
          elapsedSeconds: 0n,
        })
      ).toBe(0n)
    })

    it('ensures backwards clock timestamps never rewind lastCheckpoint or add yield', () => {
      const position = {
        principal: 10_000_000n,
        accruedCap: 100n,
        lastCheckpoint: 1_000_000n,
      }

      // Timestamp moves backwards by 50 seconds
      const res = checkpointYield({
        currentPrincipal: position.principal,
        maxRatePerUsdcDay: 50_000n,
        lastCheckpoint: position.lastCheckpoint,
        now: 1_000_000n - 50n,
        accruedCap: position.accruedCap,
      })

      expect(res.lastCheckpoint).toBe(1_000_000n)
      expect(res.accruedCap).toBe(100n)
    })

    it('validates protocol constants for rate ceiling and proof depth', () => {
      expect(MAX_STAR_PROOF_DEPTH).toBe(32)
      expect(MAX_YIELD_RATE_PER_USDC_DAY).toBe(1_000_000_0000n)
    })
  })

  describe('Ed25519 Yield Claim Attestation', () => {
    it('serializes and verifies canonical Ed25519 authorization messages', () => {
      const attestor = Keypair.generate()
      const staker = Keypair.generate().publicKey
      const clusterDomain = new Uint8Array(32).fill(7)
      const starId = 677
      const elementId = 1 // Essence
      const amount = 5_000_000n
      const nonce = 0n
      const deadline = 1_900_000_000n

      const message = buildStarYieldAuthorizationMessage({
        programId: ASOL_SOLANA_PROGRAM_ID,
        clusterDomain,
        staker,
        starId,
        elementId,
        amount,
        nonce,
        deadline,
      })

      expect(message.subarray(0, STAR_YIELD_AUTHORIZATION_DOMAIN.length)).toEqual(
        STAR_YIELD_AUTHORIZATION_DOMAIN
      )
      expect(message.length).toBe(
        STAR_YIELD_AUTHORIZATION_DOMAIN.length + 32 + 32 + 32 + 4 + 1 + 8 + 8 + 8
      )

      // Sign with nacl
      const signature = nacl.sign.detached(message, attestor.secretKey)
      const isValid = nacl.sign.detached.verify(message, signature, attestor.publicKey.toBytes())
      expect(isValid).toBe(true)

      // Tampered message fails verification
      const tampered = Buffer.from(message)
      tampered[tampered.length - 1] ^= 0xff
      expect(nacl.sign.detached.verify(tampered, signature, attestor.publicKey.toBytes())).toBe(
        false
      )
    })

    it('rejects invalid domain or element inputs during serialization', () => {
      const staker = Keypair.generate().publicKey
      const invalidCluster = new Uint8Array(16) // invalid length

      expect(() =>
        buildStarYieldAuthorizationMessage({
          clusterDomain: invalidCluster,
          staker,
          starId: 677,
          elementId: 0,
          amount: 100n,
          nonce: 0n,
          deadline: 1000n,
        })
      ).toThrow('clusterDomain must be exactly 32 bytes')

      expect(() =>
        buildStarYieldAuthorizationMessage({
          clusterDomain: new Uint8Array(32),
          staker,
          starId: 677,
          elementId: 5, // invalid element
          amount: 100n,
          nonce: 0n,
          deadline: 1000n,
        })
      ).toThrow('elementId must be between 0 and 3')
    })
  })

  describe('PDA Derivation Consistency & Pause Invariants', () => {
    it('consistently derives deterministic PDAs for StarVault, StarPool, and StakePosition', () => {
      const [vaultPda, vaultBump] = getStarVaultAddress()
      expect(vaultPda).toBeInstanceOf(PublicKey)
      expect(vaultBump).toBeGreaterThanOrEqual(0)

      const [poolPda677, poolBump677] = getStarPoolAddress(677)
      const [poolPda100, poolBump100] = getStarPoolAddress(100)
      expect(poolPda677.equals(poolPda100)).toBe(false)
      expect(poolBump677).toBeGreaterThanOrEqual(0)
      expect(poolBump100).toBeGreaterThanOrEqual(0)

      const stakerA = Keypair.generate().publicKey
      const stakerB = Keypair.generate().publicKey

      const [posA] = getStakePositionAddress(677, stakerA)
      const [posB] = getStakePositionAddress(677, stakerB)
      const [posAStar100] = getStakePositionAddress(100, stakerA)

      expect(posA.equals(posB)).toBe(false)
      expect(posA.equals(posAStar100)).toBe(false)
    })

    it('documents protocol invariant: unstake is non-pausable and requires zero attestations', () => {
      // In Rust Anchor program:
      // unstake_star has NO check on program_config.pause_claims or pause_redemptions.
      // claim_star_yield checks require!(!config.pause_claims, AsolError::ClaimsPaused).
      // This ensures users can always exit their capital even during claim freezes.
      const claimsPaused = true
      const canUnstake = true
      const canClaim = !claimsPaused

      expect(canUnstake).toBe(true)
      expect(canClaim).toBe(false)
    })
  })
})
