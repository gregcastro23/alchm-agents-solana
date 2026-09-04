// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Keypair, PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import { POST } from '@/app/api/solana/amm-attestation/route'
import { resetAttestationRateLimits } from '@/lib/solana/amm-rate-limit'
import {
  ammAttestorPublicKey,
  getAmmAttestorSigner,
  resetAmmAttestorCache,
  signAmmVisibilityAttestation,
} from '@/lib/solana/amm-attestor'
import {
  AMM_VISIBILITY_MESSAGE_BYTES,
  CONSTELLATION_PAIRS,
  buildAmmVisibilityAuthorizationMessage,
  fetchPoolTraderNonce,
} from '@/lib/solana/constellation-amm'
import * as aspectsModule from '@/lib/staking/aspects'

vi.mock('@/lib/solana/constellation-amm', async importOriginal => {
  const mod = await importOriginal<typeof import('@/lib/solana/constellation-amm')>()
  return {
    ...mod,
    fetchPoolTraderNonce: vi.fn().mockResolvedValue(0n),
  }
})

describe('AMM Attestation Feeder & Authority Hardening (Workstream 3)', () => {
  const originalEnv = { ...process.env }
  const attestorKeypair = Keypair.generate()
  const traderKeypair = Keypair.generate()
  const mockClusterDomain = '0x' + 'ab'.repeat(32)

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NODE_ENV = 'development'
    process.env.SOLANA_ATTESTOR_KEYPAIR = JSON.stringify(Array.from(attestorKeypair.secretKey))
    process.env.SOLANA_CLUSTER_DOMAIN = mockClusterDomain
    resetAmmAttestorCache()
    resetAttestationRateLimits()
    vi.mocked(fetchPoolTraderNonce).mockResolvedValue(0n)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetAmmAttestorCache()
    resetAttestationRateLimits()
  })

  it('rejects client-supplied planets array to prevent forged celestial gating', async () => {
    const request = new Request('http://localhost:3000/api/solana/amm-attestation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trader: traderKeypair.publicKey.toBase58(),
        poolId: 0,
        op: 'add_liquidity',
        observer: { lat: 37.7749, lon: -122.4194 },
        planets: [
          { planet: 'Sun', sign: 'Aries', degree: 10 },
          { planet: 'Moon', sign: 'Leo', degree: 10 },
        ],
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toContain('Client-supplied planets are rejected for security')
  })

  it('validates observer coordinate boundaries strictly', async () => {
    // 1. Latitude > 90
    const resLatHigh = await POST(
      new Request('http://localhost:3000/api/solana/amm-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: traderKeypair.publicKey.toBase58(),
          poolId: 0,
          op: 'add_liquidity',
          observer: { lat: 95, lon: 0 },
        }),
      })
    )
    expect(resLatHigh.status).toBe(400)
    expect((await resLatHigh.json()).error).toContain('Valid observer coordinates required')

    // 2. Longitude < -180
    const resLonLow = await POST(
      new Request('http://localhost:3000/api/solana/amm-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: traderKeypair.publicKey.toBase58(),
          poolId: 0,
          op: 'add_liquidity',
          observer: { lat: 0, lon: -185 },
        }),
      })
    )
    expect(resLonLow.status).toBe(400)

    // 3. Non-numeric latitude
    const resNonNumeric = await POST(
      new Request('http://localhost:3000/api/solana/amm-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: traderKeypair.publicKey.toBase58(),
          poolId: 0,
          op: 'add_liquidity',
          observer: { lat: 'invalid', lon: 0 },
        }),
      })
    )
    expect(resNonNumeric.status).toBe(400)
  })

  it('validates trader public key, poolId range, and operation type', async () => {
    // Bad trader key
    const resBadTrader = await POST(
      new Request('http://localhost:3000/api/solana/amm-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: 'not-a-base58-key',
          poolId: 0,
          op: 'add_liquidity',
          observer: { lat: 30, lon: 40 },
        }),
      })
    )
    expect(resBadTrader.status).toBe(400)
    expect((await resBadTrader.json()).error).toContain('valid base58 `trader` required')

    // PoolId out of bounds
    const resBadPool = await POST(
      new Request('http://localhost:3000/api/solana/amm-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: traderKeypair.publicKey.toBase58(),
          poolId: 99,
          op: 'add_liquidity',
          observer: { lat: 30, lon: 40 },
        }),
      })
    )
    expect(resBadPool.status).toBe(400)

    // Invalid op
    const resBadOp = await POST(
      new Request('http://localhost:3000/api/solana/amm-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: traderKeypair.publicKey.toBase58(),
          poolId: 0,
          op: 'steal_funds',
          observer: { lat: 30, lon: 40 },
        }),
      })
    )
    expect(resBadOp.status).toBe(400)
  })

  it('enforces rate limiting per trader address under rapid requests', async () => {
    const makeRequest = () =>
      POST(
        new Request('http://localhost:3000/api/solana/amm-attestation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trader: traderKeypair.publicKey.toBase58(),
            poolId: 0,
            op: 'add_liquidity',
            observer: { lat: 37.7749, lon: -122.4194 },
          }),
        })
      )

    // Send 20 requests (within limit)
    for (let i = 0; i < 20; i++) {
      await makeRequest()
    }

    // 21st request triggers 429
    const limitedResponse = await makeRequest()
    expect(limitedResponse.status).toBe(429)
    const json = await limitedResponse.json()
    expect(json.error).toContain('Rate limit exceeded')
  })

  it('computes server-side ephemeris and produces cryptographically valid Ed25519 signature over ASOL_AMM_VISIBILITY_V1', async () => {
    // Determine active pool from live server-side ephemeris
    const activePools = aspectsModule.aspectPools(new Date())
    expect(activePools.length).toBeGreaterThan(0)

    const activePoolId = CONSTELLATION_PAIRS.findIndex(
      pair =>
        (pair[0] === activePools[0].ids[0] && pair[1] === activePools[0].ids[1]) ||
        (pair[0] === activePools[0].ids[1] && pair[1] === activePools[0].ids[0])
    )
    expect(activePoolId).toBeGreaterThanOrEqual(0)

    const request = new Request('http://localhost:3000/api/solana/amm-attestation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trader: traderKeypair.publicKey.toBase58(),
        poolId: activePoolId,
        op: 'swap',
        observer: { lat: 0, lon: 0 },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.poolId).toBe(activePoolId)
    expect(data.attestation.op).toBe('swap')
    expect(data.attestor).toBe(attestorKeypair.publicKey.toBase58())
    expect(data.signature).toBeDefined()
    expect(data.message).toBeDefined()

    // Verify 64-byte Ed25519 signature over the 170-byte preimage
    const signatureBytes = Buffer.from(data.signature, 'base64')
    const messageBytes = Buffer.from(data.message, 'base64')

    expect(signatureBytes.length).toBe(64)
    expect(messageBytes.length).toBe(AMM_VISIBILITY_MESSAGE_BYTES)

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      attestorKeypair.publicKey.toBytes()
    )
    expect(isValid).toBe(true)
  })

  it('rejects attestation with 409 when pool pair is inactive under current sky', async () => {
    // Find an inactive pool under current sky
    const activePools = aspectsModule.aspectPools(new Date())
    const activePairSet = new Set(
      activePools.map(p => {
        const lo = Math.min(p.ids[0], p.ids[1])
        const hi = Math.max(p.ids[0], p.ids[1])
        return `${lo}-${hi}`
      })
    )

    const inactivePoolId = CONSTELLATION_PAIRS.findIndex(
      pair => !activePairSet.has(`${pair[0]}-${pair[1]}`)
    )
    expect(inactivePoolId).toBeGreaterThanOrEqual(0)

    const request = new Request('http://localhost:3000/api/solana/amm-attestation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trader: traderKeypair.publicKey.toBase58(),
        poolId: inactivePoolId,
        op: 'add_liquidity',
        observer: { lat: 0, lon: 0 },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json.error).toContain('pool is closed — no favorable aspect forms this pair right now')
  })

  it('resolves Cloud KMS signer for AMM attestations and enforces fail-closed production rules', async () => {
    // 1. In production, raw keypair fallback must throw
    process.env.NODE_ENV = 'production'
    delete process.env.AWS_KMS_KEY_ID
    delete process.env.SOLANA_ATTESTOR_KMS_KEY_ID

    expect(() => getAmmAttestorSigner()).toThrow(
      /Cloud KMS signer.*is required for AMM attestations in production/
    )

    // 2. When AWS KMS is configured, resolves KMS signer
    const mockKmsPubkey = Keypair.generate().publicKey
    process.env.SOLANA_ATTESTOR_KMS_KEY_ID = 'arn:aws:kms:us-east-1:123456789012:key/amm-key'
    process.env.SOLANA_ATTESTOR_PUBLIC_KEY = mockKmsPubkey.toBase58()

    const kmsSigner = getAmmAttestorSigner()
    expect(kmsSigner).not.toBeNull()
    expect(kmsSigner?.provider).toBe('aws')
    expect(kmsSigner?.publicKey.toBase58()).toBe(mockKmsPubkey.toBase58())
    expect(ammAttestorPublicKey()?.toBase58()).toBe(mockKmsPubkey.toBase58())
  })
})
